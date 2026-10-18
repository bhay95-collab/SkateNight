import test from 'node:test';
import assert from 'node:assert/strict';
import { startBoot, followLights } from '../fx.js';

// A deterministic clock verifies the real arrival controller without waiting
// thirteen seconds or depending on CSS animation completion.
function arrivalScene(t, { seen = false, mode = 'full' } = {}) {
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const listeners = new Map();
  const storage = new Map(seen ? [['sn_booted', '1']] : []);
  const log = { innerHTML: '' };
  const screen = { style: {} };
  const classes = new Set();
  const cabinet = { inert: false, contains: () => false };
  const alreadyInert = { inert: true, contains: () => false };
  const overlay = {
    hidden: true,
    offsetWidth: 1280,
    querySelector: (selector) => selector === '.boot-log' ? log : screen,
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
  };
  const bindings = {
    document: { body: { children: [overlay, cabinet, alreadyInert] }, documentElement: { dataset: {} } },
    window: {
      addEventListener(name, listener, options) {
        assert.equal(options.capture, true);
        listeners.set(name, listener);
      },
      removeEventListener(name, listener, options) {
        assert.equal(options.capture, true);
        assert.equal(listeners.get(name), listener);
        listeners.delete(name);
      },
    },
    sessionStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    performance: { now: () => now },
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, due: now + ms }); return id; },
    clearTimeout: (id) => timers.delete(id),
  };
  const originals = new Map(Object.keys(bindings).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(bindings)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  followLights(mode);

  return {
    overlay, log, screen, classes, cabinet, alreadyInert, listeners, storage,
    tick(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        const [id, timer] = next;
        now = timer.due;
        timers.delete(id);
        timer.fn();
      }
      now = end;
    },
  };
}

test('arrival keeps its full thirteen-second hold and has no skip API', async (t) => {
  const scene = arrivalScene(t);
  const boot = startBoot(scene.overlay);
  assert.equal(boot.played, true);
  assert.equal('skip' in boot, false);
  assert.equal(scene.storage.has('sn_booted'), false, 'refresh during arrival must not bypass it');
  scene.tick(1000);
  boot.reveal();
  boot.reveal(); // readiness may be reported more than once
  scene.tick(11999);
  assert.equal(scene.classes.has('is-booting'), true);
  assert.equal(scene.overlay.hidden, false);
  scene.tick(1);
  assert.equal(scene.classes.has('is-done'), true);
  scene.tick(639);
  assert.equal(scene.overlay.hidden, false);
  scene.tick(1);
  await boot.finished;
  assert.equal(scene.overlay.hidden, true);
  assert.equal(scene.storage.get('sn_booted'), '1', 'completed arrival is remembered');
  assert.equal(scene.listeners.size, 0);
});

test('arrival consumes keyboard and pointer input and restores existing inert states', async (t) => {
  const scene = arrivalScene(t);
  const boot = startBoot(scene.overlay);
  assert.equal(scene.cabinet.inert, true);
  assert.equal(scene.alreadyInert.inert, true);
  for (const name of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click']) {
    let prevented = false;
    let stopped = false;
    scene.listeners.get(name)({
      preventDefault() { prevented = true; },
      stopImmediatePropagation() { stopped = true; },
    });
    assert.equal(prevented, true, `${name} cannot activate a hidden control`);
    assert.equal(stopped, true, `${name} cannot reach application shortcuts`);
    assert.equal(scene.overlay.hidden, false);
  }
  boot.reveal();
  scene.tick(13640);
  await boot.finished;
  assert.equal(scene.cabinet.inert, false);
  assert.equal(scene.alreadyInert.inert, true);
});

test('CALM preserves the entire arrival with visible static diagnostics', async (t) => {
  const scene = arrivalScene(t, { mode: 'calm' });
  const boot = startBoot(scene.overlay);
  assert.equal(boot.played, true);
  assert.equal(scene.screen.style.opacity, '1');
  assert.match(scene.log.innerHTML, /SKATE BY FAITH/);
  assert.match(scene.log.innerHTML, /LOADING THE CRATES/);
  assert.equal([...scene.log.innerHTML.matchAll(/class="ln" style="opacity:1;/g)].length, 9);
  boot.reveal();
  scene.tick(12999);
  assert.equal(scene.overlay.hidden, false);
  scene.tick(641);
  await boot.finished;
  assert.equal(scene.overlay.hidden, true);
});

test('refresh in the same tab does not replay or block input', (t) => {
  const scene = arrivalScene(t, { seen: true });
  const boot = startBoot(scene.overlay);
  assert.equal(boot.played, false);
  assert.equal('skip' in boot, false);
  assert.equal(scene.overlay.hidden, true);
  assert.equal(scene.listeners.size, 0);
  assert.equal(scene.cabinet.inert, false);
});

test('recovery cap never truncates the required arrival hold', async (t) => {
  const scene = arrivalScene(t);
  const boot = startBoot(scene.overlay, { capMs: 1000 });
  scene.tick(12999);
  assert.equal(scene.overlay.hidden, false);
  assert.equal(scene.classes.has('is-booting'), true);
  scene.tick(641);
  await boot.finished;
  assert.equal(scene.overlay.hidden, true);
  assert.equal(scene.listeners.size, 0);
});

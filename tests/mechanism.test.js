import test from 'node:test';
import assert from 'node:assert/strict';
import { createMechanism, LOAD_MS, EJECT_MS, CALM_SWAP_MS } from '../mechanism.js';
import { followLights } from '../fx.js';

const first = { id: 'first', title: 'First record', accent: 'gold' };
const second = { id: 'second', title: 'Second record', accent: 'pink' };
const third = { id: 'third', title: 'Third record', accent: 'cyan' };

// Exercise the real animation controller with a clock and the small DOM
// surface it uses. A cancelled animation must never strand its callers.
function mechanismScene(t, { calm = false } = {}) {
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const animations = [];
  const sounds = [];
  function element() {
    const classes = new Set();
    const properties = new Map();
    return {
      nodeType: 1,
      dataset: {},
      style: {
        setProperty: (name, value) => properties.set(name, value),
        getPropertyValue: (name) => properties.get(name) || '',
      },
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
        toggle(name, force) {
          const enabled = force ?? !classes.has(name);
          if (enabled) classes.add(name);
          else classes.delete(name);
          return enabled;
        },
      },
      append() {},
      replaceChildren() {},
      setAttribute() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }),
      animate(keyframes, options) {
        const animation = { keyframes, options, cancelled: false, cancel() { this.cancelled = true; } };
        animations.push(animation);
        return animation;
      },
    };
  }
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const bindings = {
    document: {
      documentElement: { dataset: {} },
      getElementById: get,
      createElement: element,
      createTextNode: (text) => ({ nodeType: 3, textContent: text }),
    },
    window: { addEventListener() {} },
    setTimeout(fn, ms) {
      const id = ++nextTimer;
      timers.set(id, { fn, due: now + ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const originals = new Map(Object.keys(bindings).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(bindings)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  t.after(() => {
    followLights('full');
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  followLights(calm ? 'calm' : 'full');
  const sfx = {
    whirr: (seconds) => sounds.push({ kind: 'whirr', at: now, seconds }),
    thud: () => sounds.push({ kind: 'thud', at: now }),
    stop: (name) => sounds.push({ kind: 'stop', name, at: now }),
  };
  const mechanism = createMechanism({ sfx });
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  return {
    mechanism, get, sounds, animations, timers,
    async tick(ms) {
      const end = now + ms;
      await flush();
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        const [id, timer] = next;
        now = timer.due;
        timers.delete(id);
        timer.fn();
        await flush();
      }
      now = end;
      await flush();
    },
  };
}

test('loading completes and lands the needle at the music start deadline', async (t) => {
  const scene = mechanismScene(t);
  let settled = false;
  scene.mechanism.load(first).then(() => { settled = true; });
  await scene.tick(LOAD_MS - 1);
  assert.equal(settled, false);
  assert.equal(scene.sounds.some((sound) => sound.kind === 'thud'), false);
  await scene.tick(1);
  assert.equal(settled, true);
  assert.deepEqual(scene.sounds.filter((sound) => sound.kind === 'thud'), [{ kind: 'thud', at: LOAD_MS }]);
  assert.equal(scene.animations.every((animation) => animation.cancelled), true);
  assert.equal(scene.get('record').classList.contains('is-spinning'), true);
});

for (const speed of [1, 1.8]) {
  test(`a swap starts loading at the ejection deadline at speed ${speed}`, async (t) => {
    const scene = mechanismScene(t);
    scene.mechanism.showPlaying(first);
    let settled = false;
    scene.mechanism.swap(second, { speed }).then(() => { settled = true; });
    const ejectionMs = EJECT_MS / speed;
    const loadingMs = LOAD_MS / speed;
    await scene.tick(ejectionMs);
    assert.equal(scene.get('record-label').dataset.accent, second.accent);
    assert.equal(scene.sounds.filter((sound) => sound.kind === 'whirr').at(-1).at, ejectionMs);
    await scene.tick(loadingMs);
    assert.equal(settled, true);
    assert.deepEqual(scene.sounds.filter((sound) => sound.kind === 'thud'), [{ kind: 'thud', at: ejectionMs + loadingMs }]);
    assert.equal(scene.mechanism.phase, 'playing');
  });
}

test('reset settles a cancelled load and silences only the changer motor', async (t) => {
  const scene = mechanismScene(t);
  let settled = false;
  scene.mechanism.load(first).then(() => { settled = true; });
  await scene.tick(250);
  scene.mechanism.reset();
  await scene.tick(0);
  assert.equal(settled, true);
  assert.equal(scene.timers.size, 0);
  assert.equal(scene.animations.every((animation) => animation.cancelled), true);
  assert.deepEqual(scene.sounds.at(-1), { kind: 'stop', name: 'whirr', at: 250 });
  await scene.tick(LOAD_MS);
  assert.equal(scene.sounds.some((sound) => sound.kind === 'thud'), false);
  assert.equal(scene.mechanism.phase, 'empty');
});

test('reset during a swap settles the caller without loading the cancelled record', async (t) => {
  const scene = mechanismScene(t);
  scene.mechanism.showPlaying(first);
  let settled = false;
  scene.mechanism.swap(second).then(() => { settled = true; });
  await scene.tick(250);
  scene.mechanism.reset();
  await scene.tick(0);
  assert.equal(settled, true);
  assert.equal(scene.timers.size, 0);
  await scene.tick(EJECT_MS + LOAD_MS);
  assert.equal(scene.get('record-label').dataset.accent, first.accent);
  assert.equal(scene.mechanism.phase, 'empty');
  assert.equal(scene.sounds.some((sound) => sound.kind === 'thud'), false);
});

test('a newer swap supersedes the waiting swap without a stale needle landing', async (t) => {
  const scene = mechanismScene(t);
  scene.mechanism.showPlaying(first);
  let olderSettled = false;
  let newerSettled = false;
  scene.mechanism.swap(second).then(() => { olderSettled = true; });
  await scene.tick(250);
  scene.mechanism.swap(third).then(() => { newerSettled = true; });
  await scene.tick(0);
  assert.equal(olderSettled, true);
  assert.equal(scene.get('record-label').dataset.accent, third.accent);
  await scene.tick(LOAD_MS);
  assert.equal(newerSettled, true);
  assert.deepEqual(scene.sounds.filter((sound) => sound.kind === 'thud'), [{ kind: 'thud', at: 250 + LOAD_MS }]);
});

test('calm swaps keep their two short holds without animations or motor sound', async (t) => {
  const scene = mechanismScene(t, { calm: true });
  scene.mechanism.showPlaying(first);
  let settled = false;
  scene.mechanism.swap(second).then(() => { settled = true; });
  await scene.tick(CALM_SWAP_MS);
  assert.equal(settled, false);
  assert.equal(scene.mechanism.phase, 'playing');
  assert.deepEqual(scene.sounds.filter((sound) => sound.kind === 'thud'), [{ kind: 'thud', at: CALM_SWAP_MS }]);
  await scene.tick(CALM_SWAP_MS);
  assert.equal(settled, true);
  assert.equal(scene.animations.length, 0);
  assert.equal(scene.sounds.some((sound) => sound.kind === 'whirr'), false);
});

test('reset also invalidates a swap waiting through the calm delay', async (t) => {
  const scene = mechanismScene(t, { calm: true });
  scene.mechanism.showPlaying(first);
  let settled = false;
  scene.mechanism.swap(second).then(() => { settled = true; });
  await scene.tick(CALM_SWAP_MS / 2);
  scene.mechanism.reset();
  await scene.tick(CALM_SWAP_MS);
  assert.equal(settled, true);
  assert.equal(scene.get('record-label').dataset.accent, first.accent);
  assert.equal(scene.mechanism.phase, 'empty');
  assert.equal(scene.sounds.some((sound) => sound.kind === 'thud'), false);
});

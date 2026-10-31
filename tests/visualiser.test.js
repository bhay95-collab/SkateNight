import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisualiser } from '../visualiser.js';
import { followLights } from '../fx.js';

test('monitor glow follows bass beats, settles in silence, and resets across CALM and hidden tabs', (t) => {
  // Exercise the real source-driven visualiser
  // without an AudioContext or optional meter canvases. Advance its actual RAF.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const frames = new Map();
  let nextId = 0;
  let now = 1;
  const glow = { style: {} };
  const documentRoot = Object.assign(new EventTarget(), {
    hidden: false,
    documentElement: { dataset: {}, style: { setProperty() {} } },
    getElementById: (id) => id === 'cab-glow' ? glow : null,
    getAnimations: () => [],
  });
  const originals = new Map();
  for (const [name, value] of Object.entries({
    document: documentRoot,
    window: new EventTarget(),
    requestAnimationFrame: (fn) => { frames.set(++nextId, fn); return nextId; },
    cancelAnimationFrame: (id) => frames.delete(id),
  })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  let visualiser;
  try {
    followLights('full');
    const data = { levels: Array(36).fill(0), bass: 0 };
    visualiser = createVisualiser({ source: () => data });
    const advance = (ms, bass = () => 0) => {
      const samples = [];
      for (let elapsed = 0; elapsed < ms; elapsed += 1000 / 30) {
        data.bass = bass(elapsed);
        now += 1000 / 30;
        const callbacks = [...frames.values()];
        frames.clear();
        for (const callback of callbacks) callback(now);
        samples.push(Number(glow.style.opacity));
      }
      return samples;
    };
    const drum = (ms) => ms % 545 < 120 ? 0.2 : 0.025;
    visualiser.start();
    assert.ok(advance(1000).every((opacity) => opacity === 0.14), 'silence holds the resting glow');
    const beats = advance(6000, drum);
    assert.ok(Math.max(...beats) > 0.5, 'bass produces a visible swell');
    assert.ok(beats.every((opacity) => opacity >= 0.14 && opacity <= 0.7), 'glow remains bounded');
    const rises = beats.slice(1).map((value, i) => Math.abs(value - beats[i]));
    assert.ok(Math.max(...rises) < 0.13, 'brightness changes are smoothed, not instantaneous');
    assert.equal(advance(4000).at(-1), 0.14, 'silence releases back to rest');

    advance(2000, drum);
    followLights('calm');
    assert.equal(Number(glow.style.opacity), 0.14, 'CALM immediately restores rest');
    assert.equal(frames.size, 0, 'CALM cancels the animation loop');
    assert.ok(advance(1000, drum).every((opacity) => opacity === 0.14), 'incoming beats cannot move CALM glow');
    followLights('full');
    t.mock.timers.tick(400); // Collect animations after the FULL CSS has settled.
    assert.ok(advance(3000, drum).some((opacity) => opacity > 0.5), 'FULL resumes the beat response');

    documentRoot.hidden = true;
    documentRoot.dispatchEvent(new Event('visibilitychange'));
    assert.equal(Number(glow.style.opacity), 0.14, 'hidden tab cannot freeze at peak brightness');
    assert.equal(frames.size, 0);
    advance(1000);
    documentRoot.hidden = false;
    documentRoot.dispatchEvent(new Event('visibilitychange'));
    assert.ok(advance(1000).every((opacity) => opacity === 0.14), 'returning to a silent tab has no stale pulse');
    visualiser.stop();
    assert.equal(frames.size, 0);
    assert.equal(Number(glow.style.opacity), 0.14);
  } finally {
    visualiser?.stop();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

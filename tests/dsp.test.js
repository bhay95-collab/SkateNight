import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupBands,
  rmsFromTimeDomain,
  createEnvelope,
  createBeatGate,
  slewTo,
} from '../dsp.js';

test('groupBands returns the requested number of bars, each 0..1', () => {
  const data = new Uint8Array(512).map((_, i) => (i * 7) % 256);
  const bars = groupBands(data, 32);
  assert.equal(bars.length, 32);
  for (const b of bars) assert.ok(b >= 0 && b <= 1);
});

test('groupBands of silence is all zeros', () => {
  const bars = groupBands(new Uint8Array(512), 16);
  assert.ok(bars.every((b) => b === 0));
});

test('groupBands spreads bass over fewer bins than treble (log spacing)', () => {
  const bassOnly = new Uint8Array(512);
  bassOnly.fill(255, 0, 6);
  const bars = groupBands(bassOnly, 16);
  assert.ok(bars[0] > 0);
  assert.equal(bars[15], 0);
});

test('groupBands survives empty and tiny input', () => {
  assert.deepEqual(groupBands(new Uint8Array(0), 4), [0, 0, 0, 0]);
  assert.equal(groupBands(new Uint8Array(3).fill(255), 8).length, 8);
});

test('rmsFromTimeDomain is 0 for silence (128) and rises with level', () => {
  const quiet = new Uint8Array(256).fill(128);
  const loud = new Uint8Array(256).map((_, i) => (i % 2 ? 255 : 0));
  assert.equal(rmsFromTimeDomain(quiet), 0);
  assert.ok(rmsFromTimeDomain(loud) > 0.9);
  assert.equal(rmsFromTimeDomain(new Uint8Array(0)), 0);
});

test('envelope rises fast, falls slowly, and stays between 0 and 1', () => {
  const env = createEnvelope({ attackMs: 100, releaseMs: 600 });
  let v = 0;
  for (let i = 0; i < 6; i++) v = env.step(1, 33);
  const risen = v;
  assert.ok(risen > 0.5 && risen <= 1);
  for (let i = 0; i < 6; i++) v = env.step(0, 33);
  assert.ok(v < risen);
  assert.ok(v > risen * 0.3, 'release should be slower than attack');
});

test('envelope never swings the whole range faster than the safe limit', () => {
  // Photosensitive safety: a 10 Hz on/off input must not become a 10 Hz flash.
  const env = createEnvelope({ attackMs: 120, releaseMs: 320 });
  const frame = 33;
  let prevHigh = false;
  let crossings = 0;
  for (let t = 0; t < 3000; t += frame) {
    const input = Math.floor(t / 50) % 2 === 0 ? 1 : 0;
    const out = env.step(input, frame);
    const high = out > 0.5;
    if (t > 500 && high && !prevHigh) crossings += 1;
    prevHigh = high;
  }
  assert.ok(crossings <= 3 * 2.5, `too many rising crossings: ${crossings}`);
});

test('beat gate allows at most 3 triggers in any rolling second', () => {
  const gate = createBeatGate({ minGapMs: 340 });
  const fired = [];
  for (let t = 0; t < 10000; t += 16) {
    if (gate.trigger(t)) fired.push(t);
  }
  for (let i = 0; i + 3 < fired.length; i++) {
    assert.ok(fired[i + 3] - fired[i] > 1000, 'more than 3 triggers inside one second');
  }
});

test('slewTo limits how far a value can move per frame', () => {
  assert.equal(slewTo(0, 1, 0.1), 0.1);
  assert.equal(slewTo(1, 0, 0.1), 0.9);
  assert.equal(slewTo(0.5, 0.52, 0.1), 0.52);
});

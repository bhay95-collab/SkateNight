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

test('vuLevel reads loudness in decibels and ignores the MUSIC slider', async () => {
  const { vuLevel, rmsFromFloat } = await import('../dsp.js');
  const at = (db) => 10 ** (db / 20);
  assert.equal(vuLevel(0), 0);
  assert.equal(vuLevel(at(-40)), 0, 'very quiet rests on the stop');
  assert.ok(vuLevel(at(-18)) > 0.5 && vuLevel(at(-18)) < 0.75, 'a typical song sits just right of middle, like 0 VU');
  assert.ok(vuLevel(at(-12)) > 0.8, 'loud beats reach the red');
  assert.equal(vuLevel(at(-3)), 1);
  assert.ok(Math.abs(vuLevel(at(-18) * 0.4, 0.4) - vuLevel(at(-18))) < 1e-9, 'same needle at any volume');
  assert.ok(Math.abs(rmsFromFloat(new Float32Array([0.5, -0.5, 0.5, -0.5])) - 0.5) < 1e-9);
});

test('groupBands can stop at a top bin so no bar covers empty treble', () => {
  const data = new Uint8Array(512);
  data.fill(200, 0, 320);                       // sound up to bin 320 (15 kHz at 48 kHz / 1024)
  const capped = groupBands(data, 36, { maxBin: 320 });
  assert.ok(capped.every((v) => v > 0.7), 'every bar has sound in it');
  const uncapped = groupBands(data, 36);
  assert.ok(uncapped[35] === 0, 'without the cap the top bars sit flat');
});

test('the logo halo answers the beat softly: never dark, never a flash', async () => {
  const { logoGlow } = await import('../dsp.js');
  const rest = logoGlow(0);
  const peak = logoGlow(1);
  assert.ok(rest.haloOpacity >= 0.34 - 1e-9, 'the halo never goes dark');
  assert.ok(peak.haloOpacity <= 0.86 + 1e-9, 'and never past 86%');
  assert.ok(peak.logoScale <= 1.045 + 1e-9 && rest.logoScale === 1, 'the logo swells at most 4.5%');
  assert.ok(peak.haloScale <= 1.12 + 1e-9 && rest.haloScale >= 0.94 - 1e-9);
  assert.deepEqual(logoGlow(NaN), rest, 'junk in, calm out');
  assert.ok(logoGlow(5).haloOpacity <= 0.86 + 1e-9, 'out-of-range input is clamped');
  assert.equal(logoGlow(0.5, 0.9).haloOpacity, logoGlow(0.5, 0).haloOpacity, 'loudness never moves the halo, only the beat');
});

test('the beat detector finds drum hits in the bass, ignores a steady level, and never exceeds 3 a second', async () => {
  const { createBeatDetector } = await import('../dsp.js');
  const run = (levelAt, seconds = 20) => {
    const d = createBeatDetector();
    let beats = 0; const times = [];
    for (let ms = 0; ms < seconds * 1000; ms += 33) {
      if (d.step(levelAt(ms), ms, 33)) { beats += 1; times.push(ms); }
    }
    return { beats, times };
  };
  // 110 bpm kick: a quick swell of 0.2 over a 0.05 bed, every 545 ms
  const kick = run((ms) => 0.05 + (ms % 545 < 120 ? 0.15 * Math.sin((Math.PI * (ms % 545)) / 120) : 0));
  const perSecond = kick.beats / 20;
  assert.ok(perSecond > 1.2 && perSecond < 2.4, `about one beat per kick, got ${perSecond}/s`);
  assert.ok(kick.times.every((t, i) => i === 0 || t - kick.times[i - 1] >= 340), 'beats are at least 340 ms apart (max 3 a second)');
  assert.ok(run(() => 0.08).beats <= 1, 'a steady level is not a beat (at most the very first reading)');
  assert.equal(run(() => 0).beats, 0, 'silence never fires');
  assert.equal(run(() => 0.005).beats, 0, 'a level under the floor never fires');
  // a runaway 10-hits-a-second pattern is still capped at 3 a second
  const fast = run((ms) => 0.05 + (ms % 100 < 40 ? 0.2 : 0));
  assert.ok(fast.beats / 20 <= 3 + 1e-9, `fast pattern capped, got ${fast.beats / 20}/s`);
});

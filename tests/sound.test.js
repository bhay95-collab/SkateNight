import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unlockAudio } from '../audio.js';

const originalNames = ['coin', 'key', 'confirm', 'whirr', 'thud', 'buzz', 'page'];

test('original effects are compact PCM with conservative peaks and clean boundaries', () => {
  let totalBytes = 0;
  for (const name of originalNames) {
    const file = readFileSync(new URL(`../sfx/${name}.wav`, import.meta.url));
    totalBytes += file.byteLength;
    assert.equal(file.toString('ascii', 0, 4), 'RIFF', name);
    assert.equal(file.toString('ascii', 8, 12), 'WAVE', name);
    assert.equal(file.readUInt16LE(20), 1, `${name}: uncompressed PCM`);
    assert.equal(file.readUInt16LE(22), 1, `${name}: mono`);
    assert.equal(file.readUInt32LE(24), 22050, `${name}: sample rate`);
    assert.equal(file.readUInt16LE(34), 16, `${name}: bit depth`);
    assert.equal(file.toString('ascii', 36, 40), 'data', name);
    assert.equal(file.readUInt32LE(40), file.byteLength - 44, `${name}: complete samples`);
    const count = (file.byteLength - 44) / 2;
    let peak = 0;
    let squares = 0;
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const value = file.readInt16LE(44 + i * 2) / 32767;
      peak = Math.max(peak, Math.abs(value));
      squares += value * value;
      sum += value;
    }
    assert.ok(peak >= 0.08 && peak <= 0.251, `${name}: sufficient headroom`);
    assert.ok(Math.sqrt(squares / count) < 0.07, `${name}: restrained sustained energy`);
    assert.ok(Math.abs(sum / count) < 0.001, `${name}: no material DC offset`);
    assert.equal(file.readInt16LE(44), 0, `${name}: clean start`);
    assert.equal(file.readInt16LE(file.byteLength - 2), 0, `${name}: clean end`);
    assert.ok(count / 22050 <= 1.2, `${name}: short effect`);
  }
  assert.ok(totalBytes < 130_000, 'the complete pack remains small enough to precache');
});

test('file priorities and failures preserve mechanical effects without blocking music', async (t) => {
  const savedWindow = globalThis.window;
  const savedFetch = globalThis.fetch;
  const savedWarn = console.warn;
  const parameter = () => ({
    value: 0,
    setValueAtTime() {}, setTargetAtTime() {},
    linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {},
  });
  const node = () => ({ connect() { return this; } });
  class FakeContext {
    currentTime = 0;
    sampleRate = 22050;
    state = 'running';
    sources = [];
    decoded = [];
    destination = node();
    createGain() { return { ...node(), gain: parameter() }; }
    createDynamicsCompressor() {
      return { ...node(), threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} };
    }
    createAnalyser() { return node(); }
    createChannelSplitter() { return node(); }
    createBufferSource() {
      const source = { ...node(), start() {}, stop() {} };
      this.sources.push(source);
      return source;
    }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBiquadFilter() { return { ...node(), frequency: {}, Q: {} }; }
    createOscillator() {
      return { ...node(), frequency: parameter(), start() {}, stop() {} };
    }
    async decodeAudioData(bytes) {
      const marker = new Uint8Array(bytes)[0];
      this.decoded.push(marker);
      if (marker === 255) throw new Error('bad sample');
      return { duration: 1.12, marker };
    }
  }
  try {
    globalThis.window = { AudioContext: FakeContext };
    console.warn = () => {};
    const { ctx } = unlockAudio();
    let sequence = 0;
    const load = async (files) => {
      globalThis.fetch = async (path) => ({
        ok: Object.hasOwn(files, path),
        arrayBuffer: async () => Uint8Array.of(files[path]).buffer,
      });
      const sound = await import(`../sound.js?sample-test=${++sequence}`);
      await sound.decodeSfxFiles();
      return sound;
    };

    await t.test('valid custom MP3 takes priority over the original WAV', async () => {
      const sound = await load({ 'sfx/coin.mp3': 1, 'sfx/coin.wav': 2 });
      sound.sfx.coin();
      assert.equal(ctx.sources.at(-1).buffer.marker, 1);
      assert.deepEqual(sound.recordedSfx(), ['coin']);
    });

    await t.test('an unreadable custom MP3 falls back to the original WAV', async () => {
      const sound = await load({ 'sfx/coin.mp3': 255, 'sfx/coin.wav': 2 });
      sound.sfx.coin();
      assert.equal(ctx.sources.at(-1).buffer.marker, 2);
    });

    await t.test('a missing custom MP3 uses the WAV and long movement audio can be trimmed', async () => {
      const sound = await load({ 'sfx/whirr.wav': 3 });
      assert.doesNotThrow(() => sound.sfx.whirr(0.4));
      assert.equal(ctx.sources.at(-1).buffer.marker, 3);
    });

    await t.test('missing and unreadable assets retain live fallback; ambient flicker stays silent', async () => {
      const sound = await load({ 'sfx/key.wav': 255 });
      const before = ctx.sources.length;
      assert.doesNotThrow(() => sound.sfx.key());
      assert.ok(ctx.sources.length > before, 'live switch model is available');
      assert.deepEqual(sound.recordedSfx(), []);
      const after = ctx.sources.length;
      sound.sfx.flicker([0, 350]);
      assert.equal(ctx.sources.length, after, 'no unsolicited electrical crackling');
      for (const name of originalNames) assert.doesNotThrow(() => sound.sfx[name]());
    });

    await t.test('network failures settle without rejecting setup', async () => {
      globalThis.fetch = async () => { throw new Error('offline'); };
      const sound = await import(`../sound.js?sample-test=${++sequence}`);
      await assert.doesNotReject(sound.decodeSfxFiles());
      assert.deepEqual(sound.recordedSfx(), []);
    });
  } finally {
    globalThis.window = savedWindow;
    globalThis.fetch = savedFetch;
    console.warn = savedWarn;
  }
});

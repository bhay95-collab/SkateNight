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

test('mechanical effects remain responsive, restrained and independent of music', async (t) => {
  const savedWindow = globalThis.window;
  const savedFetch = globalThis.fetch;
  const savedWarn = console.warn;
  const savedRandom = Math.random;
  const parameter = () => ({
    value: 0,
    events: [],
    setValueAtTime(value, time) { this.events.push(['set', value, time]); },
    setTargetAtTime(value, time) { this.events.push(['target', value, time]); },
    linearRampToValueAtTime(value, time) { this.events.push(['linear', value, time]); },
    exponentialRampToValueAtTime(value, time) { this.events.push(['exponential', value, time]); },
    cancelScheduledValues(time) { this.events.push(['cancel', time]); },
  });
  const node = () => ({
    connections: [], disconnected: false,
    connect(target) { this.connections.push(target); return target; },
    disconnect() { this.disconnected = true; },
  });
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
      const source = {
        ...node(), playbackRate: parameter(), stops: [], starts: [],
        start(at, offset = 0) { this.starts.push(at); this.offset = offset; },
        stop(at) { this.stops.push(at); },
      };
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
    const { ctx, sfxBus, musicBus } = unlockAudio();
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

    await t.test('shortened original motor preserves its settling contact at constant pitch', async () => {
      const sound = await load({ 'sfx/whirr.wav': 3 });
      const before = ctx.sources.length;
      assert.doesNotThrow(() => sound.sfx.whirr(0.4));
      const [body, tail] = ctx.sources.slice(before);
      assert.equal(body.buffer.marker, 3);
      assert.equal(tail.buffer.marker, 3);
      assert.equal(body.starts[0], ctx.currentTime);
      assert.ok(Math.abs(tail.offset - (tail.buffer.duration - 0.18)) < 1e-9, 'authored final contact retained');
      assert.ok(Math.abs(tail.starts[0] - ctx.currentTime - 0.22) < 1e-9);
      assert.ok(Math.abs(tail.stops[0] - ctx.currentTime - 0.4) < 1e-9, 'stops with the movement');
      assert.ok(body.stops[0] > tail.starts[0], 'body and tail crossfade');
      for (const source of [body, tail]) assert.equal(source.playbackRate.events[0][1], 1);
    });

    await t.test('custom motor recordings keep the documented fade-to-fit behavior', async () => {
      const sound = await load({ 'sfx/whirr.mp3': 5, 'sfx/whirr.wav': 3 });
      const before = ctx.sources.length;
      sound.sfx.whirr(0.4);
      assert.equal(ctx.sources.length, before + 1);
      assert.equal(ctx.sources.at(-1).buffer.marker, 5);
      assert.ok(Math.abs(ctx.sources.at(-1).stops[0] - ctx.currentTime - 0.42) < 1e-9);
    });

    await t.test('effects keep a restrained individual mix on the separate effects bus', async () => {
      const sound = await load(Object.fromEntries(originalNames.map((name, i) => [`sfx/${name}.wav`, i + 1])));
      const levels = {};
      const musicEvents = musicBus.gain.events.length;
      for (const name of originalNames) {
        sound.sfx[name]();
        const source = ctx.sources.at(-1);
        const output = source.connections[0].connections[0];
        assert.equal(output.connections[0], sfxBus, `${name}: uses effects volume`);
        levels[name] = output.gain.events[0][1];
        assert.ok(levels[name] > 0 && levels[name] < 1, `${name}: conservative trim`);
      }
      assert.ok(levels.key < levels.coin, 'frequent selector contacts sit behind the coin accent');
      assert.ok(levels.whirr < levels.confirm, 'the motor stays behind the relay confirmation');
      assert.equal(musicBus.gain.events.length, musicEvents, 'no music ducking or volume automation');
    });

    await t.test('repeat keys, pages and motor cues crossfade old tails without delaying new input', async () => {
      const sound = await load({ 'sfx/key.wav': 1, 'sfx/page.wav': 2, 'sfx/whirr.wav': 3, 'sfx/coin.wav': 4 });
      sound.sfx.coin();
      const coin = ctx.sources.at(-1);
      for (const name of ['key', 'page', 'whirr']) {
        ctx.currentTime += 1;
        const beforeOld = ctx.sources.length;
        sound.sfx[name](0.6);
        const oldSources = ctx.sources.slice(beforeOld);
        const old = oldSources[0];
        const oldOutput = old.connections[0].connections[0];
        ctx.currentTime += 0.01;
        const beforeLatest = ctx.sources.length;
        sound.sfx[name](0.6);
        const latest = ctx.sources[beforeLatest];
        const fade = oldOutput.gain.events.find((event) => event[0] === 'linear');
        assert.ok(fade[1] < 0.001, `${name}: fades the previous tail`);
        assert.ok(fade[2] - ctx.currentTime <= 0.02, `${name}: quick click-free release`);
        assert.equal(old.stops.at(-1), fade[2], `${name}: releases the previous source`);
        assert.deepEqual(latest.starts, [ctx.currentTime], `${name}: new action starts immediately`);
        oldSources.forEach((source) => source.onended());
        assert.equal(old.disconnected, true, `${name}: old source cleaned up`);
        assert.equal(oldOutput.disconnected, true, `${name}: old channel cleaned up`);
        assert.equal(latest.connections[0].connections[0].disconnected, false, `${name}: newer voice survives old cleanup`);
      }
      assert.deepEqual(coin.stops, [], 'different actions can still sound together');
    });

    await t.test('mechanical variation is subtle and never changes motor or needle speed', async () => {
      const sound = await load(Object.fromEntries(originalNames.map((name, i) => [`sfx/${name}.wav`, i + 1])));
      for (const name of originalNames) {
        const rates = [];
        for (const random of [0, 1]) {
          Math.random = () => random;
          sound.sfx[name]();
          rates.push(ctx.sources.at(-1).playbackRate.events[0][1]);
        }
        assert.ok(rates.every((rate) => rate >= 0.98 && rate <= 1.02), `${name}: no noticeable pitch shift`);
        if (['key', 'page', 'coin'].includes(name)) assert.ok(rates[0] < rates[1], `${name}: small contact variation`);
        else assert.deepEqual(rates, [1, 1], `${name}: stable mechanical cue`);
      }
      Math.random = savedRandom;
    });

    await t.test('finished files disconnect and do not leave a stale motor to fade on the next move', async () => {
      const sound = await load({ 'sfx/whirr.wav': 3 });
      const before = ctx.sources.length;
      sound.sfx.whirr();
      const source = ctx.sources.at(-1);
      const envelope = source.connections[0];
      const output = envelope.connections[0];
      ctx.sources.slice(before).forEach((entry) => entry.onended());
      assert.ok(source.disconnected && envelope.disconnected && output.disconnected);
      const stopCount = source.stops.length;
      sound.sfx.whirr();
      assert.equal(source.stops.length, stopCount, 'completed source is removed from the active channel');
    });

    await t.test('reset releases the entire motor without interrupting other actions', async () => {
      const sound = await load({ 'sfx/whirr.wav': 3, 'sfx/coin.wav': 4 });
      sound.sfx.coin();
      const coin = ctx.sources.at(-1);
      const before = ctx.sources.length;
      sound.sfx.whirr(0.5);
      const motor = ctx.sources.slice(before);
      sound.sfx.stop('whirr');
      assert.equal(motor.length, 2);
      for (const source of motor) assert.equal(source.stops.at(-1), ctx.currentTime + 0.014);
      assert.deepEqual(coin.stops, []);
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

    await t.test('live fallback contacts also release repeated tails and all their nodes', async () => {
      const sound = await load({});
      const before = ctx.sources.length;
      sound.sfx.page();
      const previous = ctx.sources.slice(before);
      const output = previous[0].connections[0].connections[0].connections[0];
      ctx.currentTime += 0.01;
      sound.sfx.page();
      for (const source of previous) {
        assert.equal(source.stops.at(-1), ctx.currentTime + 0.014, 'scheduled contacts are cancelled with their old carrier');
        source.onended();
        assert.ok(source.disconnected);
        assert.ok(source.connections[0].disconnected, 'filter disconnected');
        assert.ok(source.connections[0].connections[0].disconnected, 'envelope disconnected');
      }
      assert.equal(output.disconnected, true, 'shared channel released after its last contact');
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
    Math.random = savedRandom;
  }
});

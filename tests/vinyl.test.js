import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createVinylBuffers, createVinylSurface, loadVinylSurface } from '../vinyl.js';
import { getLevels, setMusicLevel, setSfxLevel, setVinylLevel, unlockAudio } from '../audio.js';
import { perceptualVolume } from '../format.js';

function parameter() {
  return {
    value: 0,
    events: [],
    setValueAtTime(value, time) { this.events.push(['set', value, time]); },
    setTargetAtTime(value, time, constant) { this.events.push(['target', value, time, constant]); },
    linearRampToValueAtTime(value, time) { this.events.push(['linear', value, time]); },
    cancelScheduledValues(time) { this.events.push(['cancel', time]); },
  };
}

function node() {
  return {
    connections: [],
    disconnected: false,
    connect(target) { this.connections.push(target); return target; },
    disconnect() { this.disconnected = true; },
  };
}

class FakeContext {
  constructor(sampleRate = 48000) {
    this.sampleRate = typeof sampleRate === 'number' ? sampleRate : 48000;
    this.currentTime = 10;
    this.state = 'running';
    this.sources = [];
    this.buffers = [];
    this.destination = node();
  }
  createBuffer(numberOfChannels, length, sampleRate) {
    const data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    const buffer = {
      numberOfChannels, length, sampleRate, duration: length / sampleRate,
      getChannelData(channel) { return data[channel]; },
    };
    this.buffers.push(buffer);
    return buffer;
  }
  createBufferSource() {
    const source = {
      ...node(),
      starts: [],
      stops: [],
      start(...args) { this.starts.push(args); },
      stop(time) { this.stops.push(time); },
    };
    this.sources.push(source);
    return source;
  }
  createGain() { return { ...node(), gain: parameter() }; }
  createDynamicsCompressor() {
    return { ...node(), threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} };
  }
  createAnalyser() { return node(); }
  createChannelSplitter() { return node(); }
  createBiquadFilter() { return { ...node(), frequency: {} }; }
  // the decoded sfx/vinyl-surface.wav: 9 s stereo (kept out of `buffers`, which counts synthesis)
  async decodeAudioData() { return { numberOfChannels: 2, sampleRate: this.sampleRate, duration: 9, length: 9 * this.sampleRate }; }
}

// The loop is fetched from the site; tests stand in for the network.
globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
// Decks begin decoding when created; wait for it before expecting the loop.
const loopReady = async (ctx) => { await loadVinylSurface(ctx); await Promise.resolve(); };

// The approved loop as the browser decodes it: 24-bit stereo PCM WAV.
function readLoop() {
  const file = readFileSync(new URL('../sfx/vinyl-surface.wav', import.meta.url));
  let at = 12;
  let format = null;
  while (at < file.length) {
    const id = file.toString('ascii', at, at + 4);
    const size = file.readUInt32LE(at + 4);
    if (id === 'fmt ') format = { channels: file.readUInt16LE(at + 10), rate: file.readUInt32LE(at + 12), bits: file.readUInt16LE(at + 22) };
    if (id === 'data') {
      const frames = size / (format.channels * 3);
      const channels = Array.from({ length: format.channels }, () => new Float32Array(frames));
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < format.channels; c++) channels[c][i] = file.readIntLE(at + 8 + (i * format.channels + c) * 3, 3) / 8388608;
      }
      return { ...format, frames, channels };
    }
    at += 8 + size + (size % 2);
  }
  throw new Error('no data chunk');
}

function measurements(buffer) {
  const samples = buffer.getChannelData(0);
  let sum = 0;
  let squares = 0;
  let peak = 0;
  let elevated = 0;
  for (const sample of samples) {
    assert.ok(Number.isFinite(sample), 'all generated samples are finite');
    peak = Math.max(peak, Math.abs(sample));
    sum += sample;
    squares += sample * sample;
    if (Math.abs(sample) > 0.003) elevated++;
  }
  return { peak, rms: Math.sqrt(squares / samples.length), mean: sum / samples.length,
    elevatedFraction: elevated / samples.length };
}

test('the approved surface loop is a subtle, clean, seamless record texture', () => {
  const loop = readLoop();
  assert.deepEqual([loop.channels.length, loop.rate, loop.bits], [2, 48000, 24]);
  assert.equal(loop.frames / loop.rate, 9, 'the approved 9 s loop, untouched');
  let steps = 0;
  for (const data of loop.channels) {
    let squares = 0;
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      squares += data[i] * data[i];
      peak = Math.max(peak, Math.abs(data[i]));
      sum += data[i];
      if (i) steps += Math.abs(data[i] - data[i - 1]);
    }
    const rms = Math.sqrt(squares / data.length);
    // About -45 dBFS per side: heard in quiet passages and the change gap, tucked under loud music.
    assert.ok(rms > 0.003 && rms < 0.008, `surface energy ${rms}`);
    assert.ok(peak < 0.1, 'specks leave generous headroom under the song');
    assert.ok(Math.abs(sum / data.length) < 0.0005, 'no material DC offset (under -66 dBFS)');
  }
  const meanStep = steps / (2 * (loop.frames - 1));
  for (const data of loop.channels) {
    assert.ok(Math.abs(data[0] - data.at(-1)) < 4 * meanStep, 'the end runs on into the start: no click at the seam');
  }
});

test('the needle drop is a brief, clean gesture that stands out from the surface', () => {
  const surfaceRms = 0.0045;
  for (const sampleRate of [22050, 48000]) {
    const ctx = new FakeContext(sampleRate);
    const { scratch } = createVinylBuffers(ctx);
    assert.equal(scratch.numberOfChannels, 1, 'centered gesture works with stereo and mono tracks');
    assert.equal(scratch.sampleRate, sampleRate, 'uses the device sample rate');
    const needle = measurements(scratch);
    assert.ok(scratch.duration >= 0.15 && scratch.duration <= 0.35, 'brief needle-drop gesture');
    assert.ok(needle.rms > surfaceRms * 3 && needle.rms < 0.05, 'needle drop stands out from the surface');
    assert.ok(needle.peak < 0.25, 'needle drop leaves generous headroom');
    assert.ok(Math.abs(needle.mean) < 0.0001, 'no material scratch DC offset');
    const samples = scratch.getChannelData(0);
    assert.ok(Math.abs(samples[0]) < 0.000001 && Math.abs(samples.at(-1)) < 0.000001,
      'scratch starts and ends without an abrupt discontinuity');
  }
});

test('generated vinyl buffers are reused by decks in one context, never shared across contexts', () => {
  const ctx = new FakeContext();
  const first = createVinylBuffers(ctx);
  assert.equal(createVinylBuffers(ctx), first);
  assert.equal(ctx.buffers.length, 1, 'only one scratch synthesized');
  const other = createVinylBuffers(new FakeContext());
  assert.notEqual(other.scratch, first.scratch);
  assert.equal(loadVinylSurface(ctx), loadVinylSurface(ctx), 'the loop is fetched and decoded once per context');
});

test('preloading is silent, repeated starts keep one surface, and only a requested needle cue scratches', async () => {
  const ctx = new FakeContext();
  const deck = node();
  const vinyl = createVinylSurface(ctx, deck);
  assert.equal(ctx.sources.length, 0);
  assert.equal(ctx.buffers.length, 0, 'creating a deck does not synthesize audio yet');
  await loopReady(ctx);
  assert.equal(ctx.sources.length, 0, 'decoding the loop plays nothing');
  vinyl.start();
  vinyl.start();
  assert.equal(ctx.sources.length, 1, 'one continuous surface per playing deck');
  const surface = ctx.sources[0];
  assert.equal(surface.loop, true);
  assert.equal(surface.buffer.duration, 9, 'the approved loop, not a synthesized bed');
  assert.equal(surface.loopStart, undefined, 'the whole file loops: no trimmed seam');
  assert.equal(surface.connections[0].connections[0], deck, 'texture follows the deck mix');
  assert.equal(surface.starts[0][0], ctx.currentTime);
  assert.ok(surface.starts[0][1] >= 0 && surface.starts[0][1] < surface.buffer.duration,
    'surface begins at a valid randomized position');
  vinyl.start({ needle: true });
  assert.equal(ctx.sources.length, 2);
  const needle = ctx.sources[1];
  assert.equal(needle.loop, false);
  assert.equal(needle.buffer, createVinylBuffers(ctx).scratch);
  assert.deepEqual(needle.starts, [[ctx.currentTime, 0]], 'scratch plays once from its beginning');
  vinyl.start();
  assert.equal(ctx.sources.length, 2, 'resuming an existing surface adds no scratch');
  assert.equal(ctx.buffers.length, 1);
  const anotherDeck = createVinylSurface(ctx, node());
  await loopReady(ctx);
  anotherDeck.start();
  assert.equal(ctx.buffers.length, 1, 'second deck reuses cached synthesis');
  assert.equal(ctx.sources.at(-1).buffer, surface.buffer, 'decks share one decoded loop');
  assert.notEqual(ctx.sources.at(-1), surface, 'each deck owns its playback source');
});

test('a record that starts before the loop is decoded picks it up once ready, unless it stopped', async () => {
  const ctx = new FakeContext();
  const playing = createVinylSurface(ctx, node());
  const stopped = createVinylSurface(ctx, node());
  playing.start();
  stopped.start();
  stopped.stop();
  assert.equal(ctx.sources.length, 0, 'nothing to play yet: the music does not wait');
  await loopReady(ctx);
  assert.equal(ctx.sources.length, 1, 'only the still-playing record gains its surface');
  assert.equal(ctx.sources[0].loop, true);
});

test('a loop that cannot load leaves the music and needle drop alone', async () => {
  const ctx = new FakeContext();
  const savedFetch = globalThis.fetch;
  const savedWarn = console.warn;
  const warnings = [];
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  console.warn = (...args) => warnings.push(args);
  try {
    const vinyl = createVinylSurface(ctx, node());
    createVinylSurface(ctx, node());
    await loopReady(ctx);
    vinyl.start({ needle: true });
    assert.equal(ctx.sources.length, 1, 'no surface, the needle drop still plays');
    assert.equal(ctx.sources[0].loop, false);
    assert.equal(warnings.length, 1, 'one warning per audio context, not per deck');
  } finally {
    globalThis.fetch = savedFetch;
    console.warn = savedWarn;
  }
});

test('pausing fades both voices, resumes quietly, and ended voices release their graph', async () => {
  const ctx = new FakeContext();
  const vinyl = createVinylSurface(ctx, node());
  await loopReady(ctx);
  vinyl.start({ needle: true });
  const old = [...ctx.sources];
  ctx.currentTime += 0.1;
  vinyl.stop();
  for (const source of old) {
    const fade = source.connections[0].gain.events.at(-1);
    assert.equal(fade[0], 'linear');
    assert.equal(fade[1], 0, 'pause ends in silence');
    assert.ok(fade[2] > ctx.currentTime && fade[2] <= ctx.currentTime + 0.05,
      'short fade avoids clicks without audible lingering');
    assert.ok(source.stops[0] >= fade[2] && source.stops[0] <= ctx.currentTime + 0.06);
  }
  vinyl.stop();
  assert.ok(old.every((source) => source.stops.length === 1), 'stopping twice is harmless');
  vinyl.start();
  const resumed = ctx.sources.at(-1);
  assert.equal(ctx.sources.length, 3, 'resume creates only a fresh loop, no needle gesture');
  assert.equal(resumed.loop, true);
  assert.deepEqual(resumed.connections[0].gain.events[0], ['set', 0, ctx.currentTime],
    'resumed texture fades in from silence');
  for (const source of old) {
    source.onended();
    assert.equal(source.disconnected, true);
    assert.equal(source.connections[0].disconnected, true, 'finished voice gain is disconnected');
  }
  assert.equal(resumed.disconnected, false, 'old cleanup cannot disconnect the resumed surface');
  vinyl.stop();
  resumed.onended();
  assert.ok(resumed.disconnected && resumed.connections[0].disconnected);
});

test('a fresh needle gesture replaces its old tail and level changes never revive releasing voices', async () => {
  const ctx = new FakeContext();
  const vinyl = createVinylSurface(ctx, node());
  await loopReady(ctx);
  vinyl.start({ needle: true });
  const oldNeedle = ctx.sources[1];
  ctx.currentTime += 0.01;
  vinyl.scratch();
  assert.equal(ctx.sources.filter((source) => source.loop).length, 1, 'surface continues undisturbed');
  assert.equal(oldNeedle.stops.length, 1, 'previous needle tail is released');
  const oldEvents = oldNeedle.connections[0].gain.events.length;
  vinyl.setLevel(0);
  assert.equal(oldNeedle.connections[0].gain.events.length, oldEvents,
    'volume automation cannot bring back the replaced scratch');
  for (const source of [ctx.sources[0], ctx.sources[2]]) {
    assert.equal(source.connections[0].gain.events.at(-1)[1], 0, 'effects mute reaches every current voice');
  }
  oldNeedle.onended();
  assert.ok(oldNeedle.disconnected && oldNeedle.connections[0].disconnected);
});

test('muting during the initial fade cancels future attack ramps for the surface and scratch', async () => {
  const ctx = new FakeContext();
  const vinyl = createVinylSurface(ctx, node());
  await loopReady(ctx);
  vinyl.start({ needle: true });
  ctx.currentTime += 0.005;
  const gains = ctx.sources.map((source) => source.connections[0].gain);
  for (const gain of gains) {
    assert.ok(gain.events.at(-1)[2] > ctx.currentTime, 'the initial attack is still scheduled');
    gain.value = 0.1; // Simulate a partially completed fade at the mute instant.
  }
  vinyl.setLevel(0);
  for (const gain of gains) {
    assert.deepEqual(gain.events.slice(-3), [
      ['cancel', ctx.currentTime],
      ['set', 0.1, ctx.currentTime],
      ['target', 0, ctx.currentTime, 0.03],
    ], 'cancel the pending rise, hold the present gain, then fade to silence');
  }
});

test('vinyl trim is remembered before unlock, scales under effects, and leaves cabinet sounds alone', async () => {
  const savedWindow = globalThis.window;
  const previous = getLevels();
  try {
    assert.equal(previous.vinyl, 1, 'default trim preserves the established record mix');
    globalThis.window = { AudioContext: FakeContext };
    setSfxLevel(0.3);
    setVinylLevel(0.4);
    assert.equal(getLevels().vinyl, 0.4, 'vinyl setting is remembered before a user unlocks audio');
    const engine = unlockAudio();
    assert.equal(engine.vinylLevel, 0.4, 'audio unlock keeps the pending trim');
    const vinyl = createVinylSurface(engine.ctx, engine.recordBus);
    const otherVinyl = createVinylSurface(engine.ctx, engine.recordBus);
    engine.recordSurfaces.add(vinyl);
    engine.recordSurfaces.add(otherVinyl);
    await loopReady(engine.ctx);
    vinyl.start({ needle: true });
    otherVinyl.start();
    for (const source of engine.ctx.sources) {
      assert.equal(source.connections[0].gain.events.at(-1)[1], perceptualVolume(0.3 * 0.4),
        'new surface and scratch respect both values set before audio unlock');
      assert.equal(source.connections[0].connections[0], engine.recordBus);
    }
    const cabinetEvents = engine.sfxBus.gain.events.length;
    setVinylLevel(0);
    for (const source of engine.ctx.sources) {
      assert.equal(source.connections[0].gain.events.at(-1)[1], 0, 'vinyl mute reaches every record voice');
      assert.deepEqual(source.connections[0].gain.events.slice(-3).map((event) => event[0]),
        ['cancel', 'set', 'target'], 'vinyl mute cancels pending attacks on both decks');
    }
    assert.equal(engine.sfxBus.gain.events.length, cabinetEvents,
      'independent record mute leaves cabinet effects untouched');
    setVinylLevel(0.5);
    for (const source of engine.ctx.sources) {
      assert.equal(source.connections[0].gain.events.at(-1)[1], perceptualVolume(0.3 * 0.5));
    }
    setSfxLevel(0);
    for (const source of engine.ctx.sources) {
      assert.equal(source.connections[0].gain.events.at(-1)[1], 0, 'effects mute also mutes vinyl');
    }
    setSfxLevel(0.5);
    for (const source of engine.ctx.sources) {
      assert.equal(source.connections[0].gain.events.at(-1)[1], perceptualVolume(0.5 * 0.5),
        'changing the effects master preserves the independent vinyl trim');
    }
    setMusicLevel(0);
    assert.equal(engine.musicBus.gain.events.at(-1)[1], 0, 'music mute silences the songs');
    for (const source of engine.ctx.sources) {
      assert.equal(source.connections[0].gain.events.at(-1)[1], perceptualVolume(0.5 * 0.5),
        'music mute leaves the record texture alone');
    }
    vinyl.stop();
    otherVinyl.stop();
    const releasedEvents = engine.ctx.sources.map((source) => source.connections[0].gain.events.length);
    setVinylLevel(1);
    setSfxLevel(1);
    assert.deepEqual(engine.ctx.sources.map((source) => source.connections[0].gain.events.length), releasedEvents,
      'neither fader can revive released tails');
    setVinylLevel(0);
    vinyl.start({ needle: true });
    for (const source of engine.ctx.sources.slice(-2)) {
      assert.equal(source.connections[0].gain.events.at(-1)[1], 0,
        'future songs and needle cues remain silent after vinyl is muted');
    }
    vinyl.stop();
    engine.recordSurfaces.delete(vinyl);
    engine.recordSurfaces.delete(otherVinyl);
  } finally {
    setMusicLevel(previous.music);
    setSfxLevel(previous.sfx);
    setVinylLevel(previous.vinyl);
    globalThis.window = savedWindow;
  }
});

test('all level setters retain finite slider bounds before combining the vinyl and effects trims', () => {
  const previous = getLevels();
  try {
    setMusicLevel(-0.5);
    setSfxLevel(5);
    setVinylLevel(2);
    assert.deepEqual(getLevels(), { music: 0, sfx: 1, vinyl: 1 });
    setMusicLevel(Infinity);
    setSfxLevel(NaN);
    setVinylLevel(-1);
    assert.deepEqual(getLevels(), { music: 0, sfx: 0, vinyl: 0 });
    setVinylLevel(undefined);
    assert.equal(getLevels().vinyl, 0, 'invalid persisted settings cannot produce non-finite audio gain');
  } finally {
    setMusicLevel(previous.music);
    setSfxLevel(previous.sfx);
    setVinylLevel(previous.vinyl);
  }
});

test('synthesis or source failures disable optional texture without interrupting playback', async (t) => {
  for (const failure of ['buffer', 'source', 'start', 'cleanup']) {
    await t.test(failure, async () => {
      const ctx = new FakeContext();
      const savedWarn = console.warn;
      const warnings = [];
      console.warn = (...args) => warnings.push(args);
      try {
        const vinyl = createVinylSurface(ctx, node());
        await loopReady(ctx);
        if (failure === 'buffer') {
          ctx.createBuffer = () => { throw new Error('allocation unavailable'); };
        } else {
          vinyl.start();
          if (failure === 'start') {
            const createSource = ctx.createBufferSource.bind(ctx);
            ctx.createBufferSource = () => {
              const source = createSource();
              source.start = () => { throw new Error('cannot start source'); };
              return source;
            };
          } else {
            if (failure === 'cleanup') {
              ctx.sources[0].disconnect = () => { throw new Error('damaged graph'); };
            }
            ctx.createBufferSource = () => { throw new Error('source unavailable'); };
          }
        }
        assert.doesNotThrow(() => vinyl.start({ needle: true }));
        assert.equal(warnings.length, 1, 'failure is visible for diagnosis');
        for (const source of ctx.sources) {
          if (failure !== 'cleanup') assert.ok(source.disconnected, 'failed source is disconnected');
          assert.ok(source.connections[0].disconnected,
            'voice output is disconnected even if the source graph is damaged');
          assert.equal(source.stops.length, 1);
        }
        assert.doesNotThrow(() => {
          vinyl.stop();
          vinyl.start({ needle: true });
          vinyl.scratch();
          vinyl.setLevel(0.5);
        });
        assert.equal(warnings.length, 1, 'failed synthesis does not keep retrying during music playback');
      } finally {
        console.warn = savedWarn;
      }
    });
  }
});

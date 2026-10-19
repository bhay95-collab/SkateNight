import test from 'node:test';
import assert from 'node:assert/strict';
import { createVinylBuffers, createVinylSurface } from '../vinyl.js';
import { getLevels, setMusicLevel, setSfxLevel, unlockAudio } from '../audio.js';
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

test('vinyl remains a quiet, clean record texture at low and high device sample rates', () => {
  for (const sampleRate of [22050, 48000]) {
    const ctx = new FakeContext(sampleRate);
    const { surface, scratch } = createVinylBuffers(ctx);
    for (const buffer of [surface, scratch]) {
      assert.equal(buffer.numberOfChannels, 1, 'centered texture works with stereo and mono tracks');
      assert.equal(buffer.sampleRate, sampleRate, 'uses the device sample rate');
    }
    const bed = measurements(surface);
    assert.ok(surface.duration > 10 && surface.duration < 20, 'long loop avoids a short repeated crackle');
    assert.ok(bed.rms > 0.0005 && bed.rms < 0.002, `restrained surface energy at ${sampleRate} Hz`);
    assert.ok(bed.peak < 0.008, 'no intrusive dust pops');
    assert.ok(Math.abs(bed.mean) < 0.00001, 'no material surface DC offset');
    assert.ok(bed.elevatedFraction < 0.06, 'larger contacts remain sparse');
    const needle = measurements(scratch);
    assert.ok(scratch.duration >= 0.15 && scratch.duration <= 0.35, 'brief needle-settling gesture');
    assert.ok(needle.rms > bed.rms && needle.rms < 0.01, 'start cue is audible but restrained');
    assert.ok(needle.peak < 0.045, 'scratch leaves generous headroom');
    assert.ok(Math.abs(needle.mean) < 0.00002, 'no material scratch DC offset');
    const samples = scratch.getChannelData(0);
    assert.ok(Math.abs(samples[0]) < 0.000001 && Math.abs(samples.at(-1)) < 0.000001,
      'scratch starts and ends without an abrupt discontinuity');
  }
});

test('generated vinyl buffers are reused by decks in one context, never shared across contexts', () => {
  const ctx = new FakeContext();
  const first = createVinylBuffers(ctx);
  assert.equal(createVinylBuffers(ctx), first);
  assert.equal(ctx.buffers.length, 2, 'only one loop and one scratch allocated');
  const other = createVinylBuffers(new FakeContext());
  assert.notEqual(other.surface, first.surface);
  assert.notEqual(other.scratch, first.scratch);
});

test('preloading is silent, repeated starts keep one surface, and only a requested needle cue scratches', () => {
  const ctx = new FakeContext();
  const deck = node();
  const vinyl = createVinylSurface(ctx, deck);
  assert.equal(ctx.sources.length, 0);
  assert.equal(ctx.buffers.length, 0, 'creating a deck does not synthesize audio yet');
  vinyl.start();
  vinyl.start();
  assert.equal(ctx.sources.length, 1, 'one continuous surface per playing deck');
  const surface = ctx.sources[0];
  assert.equal(surface.loop, true);
  assert.equal(surface.connections[0].connections[0], deck, 'texture follows the deck mix');
  assert.equal(surface.starts[0][0], ctx.currentTime);
  assert.ok(surface.starts[0][1] >= surface.loopStart && surface.starts[0][1] < surface.buffer.duration,
    'surface begins at a valid randomized position');
  vinyl.start({ needle: true });
  assert.equal(ctx.sources.length, 2);
  const needle = ctx.sources[1];
  assert.equal(needle.loop, false);
  assert.equal(needle.buffer, createVinylBuffers(ctx).scratch);
  assert.deepEqual(needle.starts, [[ctx.currentTime, 0]], 'scratch plays once from its beginning');
  vinyl.start();
  assert.equal(ctx.sources.length, 2, 'resuming an existing surface adds no scratch');
  assert.equal(ctx.buffers.length, 2);
  const anotherDeck = createVinylSurface(ctx, node());
  anotherDeck.start();
  assert.equal(ctx.buffers.length, 2, 'second deck reuses cached synthesis');
  assert.notEqual(ctx.sources.at(-1), surface, 'each deck owns its playback source');
});

test('pausing fades both voices, resumes quietly, and ended voices release their graph', () => {
  const ctx = new FakeContext();
  const vinyl = createVinylSurface(ctx, node());
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

test('a fresh needle gesture replaces its old tail and level changes never revive releasing voices', () => {
  const ctx = new FakeContext();
  const vinyl = createVinylSurface(ctx, node());
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

test('muting during the initial fade cancels future attack ramps for the surface and scratch', () => {
  const ctx = new FakeContext();
  const vinyl = createVinylSurface(ctx, node());
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

test('music and effects faders both govern the record surface through its deck route', () => {
  const savedWindow = globalThis.window;
  const previous = getLevels();
  try {
    globalThis.window = { AudioContext: FakeContext };
    setSfxLevel(0.3);
    const engine = unlockAudio();
    const deck = engine.ctx.createGain();
    deck.connect(engine.musicBus);
    const vinyl = createVinylSurface(engine.ctx, deck);
    engine.recordSurfaces.add(vinyl);
    vinyl.start({ needle: true });
    for (const source of engine.ctx.sources) {
      assert.equal(source.connections[0].gain.events.at(-1)[1], perceptualVolume(0.3),
        'new voice respects the effects value set before audio unlock');
      assert.equal(source.connections[0].connections[0], deck);
    }
    setSfxLevel(0);
    for (const source of engine.ctx.sources) {
      assert.equal(source.connections[0].gain.events.at(-1)[1], 0, 'effects mute also mutes vinyl');
    }
    setSfxLevel(0.5);
    for (const source of engine.ctx.sources) {
      assert.equal(source.connections[0].gain.events.at(-1)[1], perceptualVolume(0.5));
    }
    setMusicLevel(0);
    assert.equal(engine.musicBus.gain.events.at(-1)[1], 0, 'music mute silences the deck and its texture together');
    assert.equal(deck.connections[0], engine.musicBus);
    vinyl.stop();
    engine.recordSurfaces.delete(vinyl);
  } finally {
    setMusicLevel(previous.music);
    setSfxLevel(previous.sfx);
    globalThis.window = savedWindow;
  }
});

test('synthesis or source failures disable optional texture without interrupting playback', async (t) => {
  for (const failure of ['buffer', 'source', 'start', 'cleanup']) {
    await t.test(failure, () => {
      const ctx = new FakeContext();
      const savedWarn = console.warn;
      const warnings = [];
      console.warn = (...args) => warnings.push(args);
      try {
        const vinyl = createVinylSurface(ctx, node());
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

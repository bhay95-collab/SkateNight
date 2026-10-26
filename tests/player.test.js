import test from 'node:test';
import assert from 'node:assert/strict';
import { unlockAudio, setMusicLevel, setSfxLevel } from '../audio.js';
import { createPlayer } from '../player.js';

const first = { id: 'first', file: 'first.mp3' };
const second = { id: 'second', file: 'second.mp3' };

// Keep play() and the browser's actual `playing` event separate: a file can
// finish loading, or accept play(), while there is still no audible music.
test('record texture follows the real media lifecycle on its own record bus', async (t) => {
  const originals = new Map(['window', 'Audio', 'setTimeout', 'clearTimeout']
    .map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const audios = [];
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const parameter = () => ({
    value: 0,
    events: [],
    setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); },
    setTargetAtTime(value, time, constant) { this.events.push(['target', value, time, constant]); },
    linearRampToValueAtTime(value, time) { this.events.push(['linear', value, time]); },
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
    buffers = [];
    destination = node();
    createGain() { return { ...node(), gain: parameter() }; }
    createDynamicsCompressor() {
      return { ...node(), threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} };
    }
    createAnalyser() { return node(); }
    createChannelSplitter() { return node(); }
    createBiquadFilter() { return { ...node(), frequency: {} }; }
    mediaSources = [];
    createMediaElementSource(audio) {
      const source = { ...node(), mediaElement: audio };
      this.mediaSources.push(source);
      return source;
    }
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      const buffer = { duration: length / sampleRate, getChannelData: (channel) => data[channel] };
      this.buffers.push(buffer);
      return buffer;
    }
    createBufferSource() {
      const source = {
        ...node(), loop: false, starts: [], stops: [], finished: false,
        start(...args) { this.starts.push(args); },
        stop(at = 0) { this.stops.push(at); },
      };
      this.sources.push(source);
      return source;
    }
  }
  class FakeAudio extends EventTarget {
    paused = true;
    ended = false;
    currentTime = 0;
    duration = 180;
    constructor() { super(); audios.push(this); }
    load() { this.fire('emptied'); }
    async play() {
      if (this.playError) throw this.playError;
      this.paused = false;
      this.ended = false;
    }
    pause() {
      if (this.paused) return;
      this.paused = true;
      this.fire('pause');
    }
    fire(type) {
      if (type === 'ended') { this.ended = true; this.paused = true; }
      this.dispatchEvent(new Event(type));
    }
  }
  const bindings = {
    window: { AudioContext: FakeContext },
    Audio: FakeAudio,
    setTimeout(fn, ms) {
      const id = ++nextTimer;
      timers.set(id, { fn, due: now + ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  for (const [key, value] of Object.entries(bindings)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const engine = unlockAudio();
  const { ctx } = engine;
  const finishSources = () => {
    for (const source of ctx.sources) {
      const naturalEnd = source.loop ? Infinity : source.starts[0]?.[0] + source.buffer.duration;
      const end = Math.min(naturalEnd, ...source.stops);
      if (!source.finished && end <= ctx.currentTime + 1e-9) {
        source.finished = true;
        source.onended?.();
      }
    }
  };
  const tick = (ms) => {
    const target = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, timer]) => timer.due <= target)
        .sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      now = next[1].due;
      ctx.currentTime = now / 1000;
      timers.delete(next[0]);
      next[1].fn();
      finishSources();
    }
    now = target;
    ctx.currentTime = now / 1000;
    finishSources();
  };
  const scene = (handlers = {}) => {
    const before = ctx.sources.length;
    const audioBefore = audios.length;
    const player = createPlayer(handlers);
    const decks = audios.slice(audioBefore);
    return {
      player, decks,
      get sources() { return ctx.sources.slice(before); },
      get scratches() { return this.sources.filter((source) => !source.loop); },
      get surfaces() { return this.sources.filter((source) => source.loop); },
      current: () => decks.find((audio) => audio.src === `${player.currentTrackId}.mp3`),
    };
  };
  // The deck's fade gain sits between its media element and the music bus.
  const deckGainOf = (audio) => ctx.mediaSources.find((source) => source.mediaElement === audio).connections[0].gain;
  const assertReleased = (sources) => {
    for (const source of sources) {
      assert.ok(source.finished, 'source has reached its scheduled stop');
      assert.ok(source.disconnected, 'finished source disconnects');
      assert.ok(source.connections[0].disconnected, 'finished texture gain disconnects');
    }
  };
  t.after(() => {
    setMusicLevel(0.7);
    setSfxLevel(0.7);
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  await t.test('preloading and accepted play remain silent until actual playback', async () => {
    const state = scene();
    const buffers = ctx.buffers.length;
    state.player.cue(first);
    await Promise.resolve();
    assert.equal(state.sources.length, 0, 'idle preload plays no texture');
    assert.equal(ctx.buffers.length, buffers, 'preload does not allocate texture buffers');
    assert.equal(await state.player.start(first), true);
    assert.equal(state.sources.length, 0, 'play promise alone plays no texture');
    state.current().fire('playing');
    assert.equal(state.surfaces.length, 1, 'continuous record surface starts with music');
    assert.equal(state.scratches.length, 1, 'one brief needle scrape accompanies the track');
    assert.ok(state.scratches[0].buffer.duration < 0.35, 'needle scrape remains brief');
    state.current().fire('playing');
    assert.equal(state.sources.length, 2, 'duplicate media events do not layer texture');
    state.current().pause();
    tick(41);
    assertReleased(state.sources);
  });

  await t.test('buffer recovery and pause/resume restore static without another needle scrape', async () => {
    const state = scene();
    await state.player.start(first);
    const audio = state.current();
    audio.fire('playing');
    const initial = [...state.sources];
    audio.fire('waiting');
    for (const source of initial) {
      const release = source.connections[0].gain.events.at(-1);
      assert.equal(release[0], 'linear', 'buffering releases texture with a fade');
      assert.equal(release[1], 0);
      assert.ok(release[2] > ctx.currentTime);
    }
    tick(41);
    assertReleased(initial);
    audio.fire('playing');
    assert.equal(state.surfaces.length, 2);
    assert.equal(state.scratches.length, 1, 'buffer recovery is still the same record');
    const resumedSurface = state.surfaces.at(-1);
    state.player.pause();
    const deckGain = deckGainOf(audio);
    assert.deepEqual(deckGain.events.at(-1).slice(0, 2), ['linear', 0], 'pause first fades the deck');
    tick(139);
    assert.equal(audio.paused, false, 'song continues through the short fade');
    assert.equal(resumedSurface.stops.length, 0, 'static holds until the song has faded');
    tick(1);
    assert.equal(audio.paused, true);
    tick(41);
    assertReleased([resumedSurface]);
    const count = state.sources.length;
    assert.equal(await state.player.resume(), true);
    assert.equal(state.sources.length, count, 'resume also waits for actual media playback');
    audio.fire('playing');
    assert.equal(state.surfaces.length, 3);
    assert.equal(state.scratches.length, 1, 'ordinary resume adds no needle scrape');
    audio.pause();
    tick(41);
  });

  await t.test('rapid resume cancels the pending pause and restores gain without another playing event', async () => {
    const state = scene();
    await state.player.start(first);
    const audio = state.current();
    audio.fire('playing');
    const surface = state.surfaces[0];
    const deckGain = deckGainOf(audio);
    state.player.pause();
    const pauseTimers = [...timers.keys()];
    assert.equal(pauseTimers.length, 1, 'pause schedules the native media pause');
    tick(60);
    assert.equal(audio.paused, false, 'resume arrives during the fade, before native pause');
    const eventCount = deckGain.events.length;
    assert.equal(await state.player.resume(), true);
    assert.ok(pauseTimers.every((id) => !timers.has(id)), 'resume cancels the pending pause');
    assert.deepEqual(deckGain.events.slice(eventCount).map((event) => event[0]), ['cancel', 'set', 'linear'],
      'resume replaces the fading automation immediately');
    assert.deepEqual(deckGain.events.at(-1), ['linear', 1, ctx.currentTime + 0.16],
      'gain returns to full level even though play emits no new playing event');
    tick(200);
    assert.equal(audio.paused, false, 'the cancelled timer cannot pause the resumed song');
    assert.equal(state.player.isPlaying, true);
    assert.equal(surface.stops.length, 0, 'the existing surface continues without a gap');
    assert.equal(state.surfaces.length, 1, 'resume keeps the existing surface voice');
    assert.equal(state.scratches.length, 1, 'resume adds no needle scrape');
    audio.pause();
    tick(41);
    assertReleased(state.sources);
  });

  await t.test('buffer recovery preserves an armed closing fade through the remaining song', async () => {
    const state = scene();
    await state.player.start(first);
    const audio = state.current();
    audio.fire('playing');
    const deckGain = deckGainOf(audio);
    audio.currentTime = audio.duration - 0.9;
    audio.fire('timeupdate');
    assert.deepEqual(deckGain.events.at(-1).slice(0, 2), ['linear', 0],
      'the final second arms a fade to silence');
    assert.ok(Math.abs(deckGain.events.at(-1)[2] - ctx.currentTime - (audio.duration - audio.currentTime)) < 1e-9,
      'the closing fade ends with the song');
    tick(200);
    audio.currentTime = audio.duration - 0.7;
    audio.fire('waiting');
    tick(41);
    const beforeRecovery = deckGain.events.length;
    audio.fire('playing');
    assert.deepEqual(deckGain.events.at(-1).slice(0, 2), ['linear', 0],
      'buffer recovery restores the fade to silence');
    assert.ok(Math.abs(deckGain.events.at(-1)[2] - ctx.currentTime - (audio.duration - audio.currentTime)) < 1e-9,
      'the restored fade lasts for the remaining playback time');
    assert.ok(!deckGain.events.slice(beforeRecovery).some((event) => event[0] === 'linear' && event[1] === 1),
      'recovery cannot replace the closing fade with a fade to full volume');
    const afterRecovery = deckGain.events.length;
    audio.fire('timeupdate');
    assert.equal(deckGain.events.length, afterRecovery, 'the restored closing fade remains armed');
    assert.equal(state.surfaces.length, 2, 'surface texture returns with the music');
    assert.equal(state.scratches.length, 1, 'the recovered closing seconds add no needle scrape');
    audio.pause();
    tick(41);
    assertReleased(state.sources);
  });

  await t.test('queued playing events cannot revive paused or ended media', async () => {
    const state = scene();
    await state.player.start(first);
    const audio = state.current();
    audio.pause();
    audio.fire('playing');
    assert.equal(state.sources.length, 0, 'a queued event after pause starts no texture');
    await state.player.resume();
    audio.fire('playing');
    assert.equal(state.scratches.length, 1, 'the ignored event preserves the pending initial needle scrape');
    const deckGain = deckGainOf(audio);
    audio.fire('ended');
    tick(41);
    assertReleased(state.sources);
    const count = state.sources.length;
    const gainEvents = deckGain.events.length;
    // Exercise ended independently of paused: either flag must reject a stale event.
    audio.paused = false;
    audio.fire('playing');
    assert.equal(state.sources.length, count, 'a queued event after ended starts no replacement texture');
    assert.equal(deckGain.events.length, gainEvents, 'ended playback cannot reopen the deck gain');
    assert.equal(state.player.isPlaying, false);
    audio.pause();
  });

  await t.test('texture rides the record bus: EFFECTS mutes it, MUSIC leaves it alone', async () => {
    const state = scene();
    await state.player.start(first);
    state.current().fire('playing');
    for (const source of state.sources) {
      assert.equal(source.connections[0].connections[0], engine.recordBus,
        'needle and surface bypass the deck fade and music fader');
    }
    const textureEvents = state.sources.map((source) => source.connections[0].gain.events.length);
    setMusicLevel(0);
    assert.deepEqual(engine.musicBus.gain.events.at(-1).slice(0, 2), ['target', 0]);
    assert.deepEqual(state.sources.map((source) => source.connections[0].gain.events.length), textureEvents,
      'music fader does not touch the record texture');
    setSfxLevel(0);
    for (const source of state.sources) {
      assert.deepEqual(source.connections[0].gain.events.at(-1).slice(0, 2), ['target', 0],
        'effects mute also silences the active record texture');
    }
    await state.player.start(second);
    state.current().fire('playing');
    for (const source of state.sources.slice(-2)) {
      assert.deepEqual(source.connections[0].gain.events.at(-1).slice(0, 2), ['linear', 0],
        'new record respects the existing effects mute');
    }
    state.current().pause();
    tick(140);
    setMusicLevel(0.7);
    setSfxLevel(0.7);
  });

  await t.test('closing fade leaves the crackle playing: the run-out groove', async () => {
    const state = scene();
    await state.player.start(first);
    const audio = state.current();
    audio.fire('playing');
    audio.currentTime = audio.duration - 1;
    audio.fire('timeupdate');
    assert.deepEqual(deckGainOf(audio).events.at(-1).slice(0, 2), ['linear', 0], 'music fades out');
    tick(900);
    assert.equal(state.surfaces[0].stops.length, 0, 'surface keeps playing while the music fades');
    audio.fire('ended');
    tick(41);
    assertReleased(state.sources);
  });

  await t.test('lead-in: the needle drops and crackles before the music starts', async () => {
    const state = scene();
    const starting = state.player.start(first, { leadInMs: 1000 });
    await Promise.resolve();
    await Promise.resolve();
    const audio = state.current();
    assert.equal(state.surfaces.length, 1, 'surface starts at the needle drop');
    assert.equal(state.scratches.length, 1, 'needle drop scrape plays straight away');
    assert.equal(audio.paused, true, 'music waits for the lead-in');
    audio.fire('emptied');
    assert.equal(state.surfaces[0].stops.length, 0, 'the song settling its load keeps the needle down');
    tick(999);
    assert.equal(audio.paused, true);
    tick(1);
    assert.equal(await starting, true);
    assert.equal(audio.paused, false, 'music starts after the lead-in');
    audio.fire('playing');
    assert.equal(state.sources.length, 2, 'the same surface carries on into the song, no second scrape');
    audio.pause();
    tick(41);
    assertReleased(state.sources);
  });

  await t.test('lead-in: pause holds the song, skip or a new song cancels it, mute skips it', async () => {
    const paused = scene();
    const held = paused.player.start(first, { leadInMs: 1000 });
    await Promise.resolve();
    await Promise.resolve();
    tick(300);
    paused.player.pause();
    assert.equal(await held, true, 'a paused lead-in still counts as started');
    tick(2000);
    assert.equal(paused.current().paused, true, 'pause during the lead-in keeps the music waiting');
    assertReleased(paused.sources);
    assert.equal(await paused.player.resume(), true);
    paused.current().fire('playing');
    assert.equal(paused.scratches.length, 2, 'dropping the needle again scrapes again');
    paused.current().pause();
    tick(41);

    const skipped = scene();
    const cancelled = skipped.player.start(first, { leadInMs: 1000 });
    await Promise.resolve();
    await Promise.resolve();
    const fading = skipped.player.fadeOut(220);
    assert.equal(await cancelled, false, 'skip during the lead-in cancels the song');
    await fading;
    tick(2000);
    assert.equal(skipped.decks.every((audio) => audio.paused), true, 'cancelled lead-in never starts music');
    assertReleased(skipped.sources);

    const replaced = scene();
    const old = replaced.player.start(first, { leadInMs: 1000 });
    await Promise.resolve();
    await Promise.resolve();
    const oldDeck = replaced.current();
    const next = replaced.player.start(second);
    assert.equal(await old, false, 'a newer song replaces the lead-in');
    assert.equal(await next, true);
    tick(2000);
    assert.equal(oldDeck.paused, true, 'replaced lead-in never starts its music');
    replaced.current().pause();
    tick(41);

    setSfxLevel(0);
    const muted = scene();
    assert.equal(await muted.player.start(first, { leadInMs: 1000 }), true);
    assert.equal(muted.current().paused, false, 'muted vinyl skips the silent lead-in');
    muted.current().pause();
    tick(41);
    setSfxLevel(0.7);
  });

  await t.test('each new record scratches once; a stale deck cannot start more texture', async () => {
    const state = scene();
    await state.player.start(first);
    const previous = state.current();
    previous.fire('playing');
    await state.player.start(second);
    const count = state.sources.length;
    previous.fire('playing');
    assert.equal(previous.paused, true, 'late playback from an inactive deck is stopped');
    assert.equal(state.sources.length, count, 'inactive deck produces no extra texture');
    state.current().fire('playing');
    assert.equal(state.scratches.length, 2, 'the next record gets its own needle scrape');
    state.player.restart();
    assert.equal(state.scratches.length, 3, 'an intentional restart gives a fresh needle scrape');
    const fading = state.player.fadeOut(200);
    tick(230);
    await fading;
    assert.equal(state.current().paused, true);
    tick(41);
    assertReleased(state.sources);
  });

  await t.test('ended and media errors release all voices and preserve track callbacks', async () => {
    for (const event of ['ended', 'error']) {
      const calls = [];
      const state = scene({ onEnded: (...args) => calls.push(args), onError: (...args) => calls.push(args) });
      await state.player.start(first);
      const audio = state.current();
      audio.fire('playing');
      audio.error = new Error('media decode failed');
      audio.fire(event);
      assert.deepEqual(calls, [event === 'ended' ? ['first'] : ['first', audio.error]]);
      tick(41);
      assertReleased(state.sources);
      audio.pause();
    }
  });

  await t.test('rejected start or resume stays silent and reports the failure', async () => {
    const errors = [];
    const state = scene({ onError: (...args) => errors.push(args) });
    const failure = new Error('playback unavailable');
    state.decks[1].playError = failure;
    assert.equal(await state.player.start(first), false);
    assert.equal(state.sources.length, 0, 'rejected start creates no vinyl voices');
    assert.deepEqual(errors, [['first', failure]]);
    delete state.decks[1].playError;
    assert.equal(await state.player.resume(), true);
    state.current().fire('playing');
    assert.equal(state.scratches.length, 1, 'the first successful playback still gets its needle scrape');
    state.current().pause();
    tick(41);
    state.current().playError = failure;
    assert.equal(await state.player.resume(), false);
    assert.equal(state.sources.length, 2, 'rejected resume creates no replacement texture');
    assertReleased(state.sources);
    assert.equal(errors.length, 2);
  });
});

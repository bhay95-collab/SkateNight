import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { AMBIENCE, JUKEBOX_SFX_FILES, MOVES, createAmbience, loadJukeboxSfx, playChange, shuffleBag } from '../jukebox-sfx.js';
import { SPRITE } from '../jukebox-sprite.js';
import { LOAD_MS, EJECT_MS } from '../mechanism.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/* ---------- a small Web Audio double ---------- */
const param = (value = 0) => ({
  value, events: [],
  setValueAtTime(v, t) { this.events.push(['set', v, t]); },
  linearRampToValueAtTime(v, t) { this.events.push(['linear', v, t]); },
  setTargetAtTime(v, t, c) { this.events.push(['target', v, t, c]); },
  cancelScheduledValues(t) { this.events.push(['cancel', t]); },
});
const node = (extra = {}) => ({
  connections: [], disconnected: false, ...extra,
  connect(target) { this.connections.push(target); return target; },
  disconnect() { this.disconnected = true; },
});
class FakeContext {
  currentTime = 10;
  sampleRate = 48000;
  sources = [];
  createGain() { return node({ gain: param(1) }); }
  createBiquadFilter() { return node({ type: '', frequency: param(350) }); }
  createStereoPanner() { return node({ pan: param(0) }); }
  createBufferSource() {
    const source = node({
      playbackRate: param(1), loop: false, starts: [], stops: [],
      start(...args) { this.starts.push(args); },
      stop(at) { this.stops.push(at); },
      end() { this.onended?.(); },
    });
    this.sources.push(source);
    return source;
  }
  async decodeAudioData(bytes) {
    const path = new TextDecoder().decode(bytes);
    if (path.includes('broken')) throw new Error('corrupt');
    return { path, duration: path.includes('mechanics') ? 30.08 : 8 };
  }
}
// The site: every file answers with its own path, so the double can tell them apart.
function serve(files = {}) {
  globalThis.fetch = async (url) => {
    const path = String(url);
    const status = Object.entries(files).find(([name]) => path.includes(name))?.[1] ?? 200;
    return { ok: status !== 404, status, arrayBuffer: async () => new TextEncoder().encode(status === 'corrupt' ? 'broken' : path).buffer };
  };
}
async function readyContext(files) {
  serve(files);
  const ctx = new FakeContext();
  await loadJukeboxSfx(ctx);
  return ctx;
}
const voiceOn = (ctx) => {
  const tracked = [];
  return { ctx, output: node(), tracked, track(source, ...nodes) { tracked.push({ source, nodes }); } };
};
// The ambience's master gain: the last node before the Effects bus.
const masterOf = (source, bus) => {
  let n = source.connections[0];
  while (n.connections[0] && n.connections[0] !== bus) n = n.connections[0];
  return n;
};

/* ---------- the production files ---------- */
test('production sound files are small, precached for offline use and consistent with the sprite table', () => {
  const sizes = Object.fromEntries([...Object.values(JUKEBOX_SFX_FILES), 'sfx/needle-drop.wav']
    .map((path) => [path, statSync(new URL(`../${path}`, import.meta.url)).size]));
  assert.ok(sizes['sfx/jukebox/mechanics.mp3'] < 420 * 1024, 'one compact sprite of short components');
  assert.ok(sizes['sfx/jukebox/bed-machine.flac'] < 160 * 1024 && sizes['sfx/jukebox/bed-electric.flac'] < 400 * 1024);
  assert.ok(Object.values(sizes).reduce((a, b) => a + b) < 900 * 1024, `whole upgrade under 900 KiB: ${JSON.stringify(sizes)}`);
  const sw = read('sw.js');
  for (const path of [...Object.values(JUKEBOX_SFX_FILES), 'sfx/needle-drop.wav', 'jukebox-sfx.js', 'jukebox-sprite.js']) {
    assert.ok(sw.includes(`'${path}'`), `${path} is in the offline shell`);
  }
  // the table is sorted, padded and every component the mix names exists
  const entries = Object.entries(SPRITE);
  entries.forEach(([, [start, length]], i) => {
    assert.ok(length > 0.05 && length < 2.5);
    if (i) assert.ok(start >= entries[i - 1][1][0] + entries[i - 1][1][1] + 0.2, 'silence between components');
  });
  const used = read('jukebox-sfx.js').match(/'[a-z]+(?:-[a-z]+)*-[a-c]'/g).map((s) => s.slice(1, -1));
  assert.ok(used.length > 30);
  for (const name of used) assert.ok(SPRITE[name], `${name} is in the sprite`);
});

test('the recorded needle drop is crisp, brief and settles under the vinyl surface', () => {
  const file = readFileSync(new URL('../sfx/needle-drop.wav', import.meta.url));
  assert.equal(file.readUInt16LE(22), 1, 'mono');
  assert.equal(file.readUInt16LE(34), 16);
  const data = file.indexOf('data') + 8;
  const n = (file.length - data) / 2;
  const at = (i) => file.readInt16LE(data + 2 * i) / 32768;
  const rate = file.readUInt32LE(24);
  let peak = 0, peakAt = 0;
  for (let i = 0; i < n; i++) { const v = Math.abs(at(i)); if (v > peak) { peak = v; peakAt = i; } }
  assert.ok(n / rate >= 0.15 && n / rate <= 0.35, 'a touchdown, not a DJ scratch');
  assert.ok(peak > 0.12 && peak < 0.25, 'clearly audible, generous headroom');
  assert.ok(peakAt / rate < 0.08, 'the contact comes first');
  let tail = 0;
  for (let i = Math.round(n * 0.8); i < n; i++) tail += at(i) ** 2;
  assert.ok(Math.sqrt(tail / (n * 0.2)) < 0.005, 'decays to below the V4 surface (about -46 dBFS)');
  assert.ok(Math.abs(at(0)) < 0.01 && Math.abs(at(n - 1)) < 0.001, 'clean edges');
});

/* ---------- the changer ---------- */
test('each move places its components on the choreography, scaled to the move', async () => {
  const ctx = await readyContext();
  for (const [move, ms] of [['load', LOAD_MS], ['eject', EJECT_MS]]) {
    for (const speed of [1, 1.8]) {
      const seconds = ms / speed / 1000;
      const voice = voiceOn(ctx);
      assert.equal(playChange(move, seconds, voice), true);
      assert.equal(voice.tracked.length, MOVES[move].length, 'every component is tracked by the voice for release');
      voice.tracked.forEach(({ source, nodes }, i) => {
        const [at, , , fit] = MOVES[move][i];
        const [when, offset, length] = source.starts[0];
        assert.ok(Math.abs(when - (ctx.currentTime + at * seconds)) < 1e-9, `${move} cue ${i} on its beat`);
        assert.ok(when < ctx.currentTime + seconds, 'inside the move');
        assert.ok(Object.values(SPRITE).some(([start]) => start === offset), 'starts exactly at a component');
        if (fit) assert.ok(length / source.playbackRate.value <= fit * seconds + 1e-9, 'a long component is cut to its slot');
        assert.equal(nodes.at(-1).connections[0], voice.output, 'routed through the changer voice (Effects bus)');
      });
    }
  }
});

test('repeated record changes vary without repeating a take back to back', async () => {
  const ctx = await readyContext();
  const takes = [];
  for (let i = 0; i < 12; i++) {
    const voice = voiceOn(ctx);
    playChange('load', 1.5, voice);
    takes.push(voice.tracked.map(({ source }) => source.starts[0][1]));
  }
  for (let slot = 0; slot < MOVES.load.length; slot++) {
    const column = takes.map((take) => take[slot]);
    for (let i = 1; i < column.length; i++) assert.notEqual(column[i], column[i - 1], `slot ${slot} change ${i}`);
    assert.ok(new Set(column).size >= 2, 'the whole bag gets used');
  }
  const bag = shuffleBag(['a', 'b', 'c']);
  const draws = Array.from({ length: 30 }, bag);
  for (let i = 0; i < 30; i += 3) assert.deepEqual([...draws.slice(i, i + 3)].sort(), ['a', 'b', 'c'], 'each round uses every take once');
});

test('eject and load are distinct movements', () => {
  const slots = (move) => new Set(MOVES[move].map(([, slot]) => slot));
  for (const slot of ['motor', 'index', 'lock', 'drop']) assert.ok(slots('load').has(slot) && !slots('eject').has(slot));
  for (const slot of ['seat', 'slide']) assert.ok(slots('eject').has(slot) && !slots('load').has(slot));
});

test('missing or corrupt recordings fall back silently, never throwing into the music path', async () => {
  const savedWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    const ctx = await readyContext({ 'mechanics.mp3': 'corrupt', 'bed-electric': 404 });
    assert.equal(playChange('load', 1.5, voiceOn(ctx)), false, 'the caller plays the original motor instead');
    assert.equal(warnings.length, 2, 'each failure reported once');
    const ambience = createAmbience({ ctx, sfxBus: node() });
    assert.doesNotThrow(() => ambience.start());
    assert.equal(ctx.sources.filter((s) => s.loop).length, 1, 'the surviving bed still plays');
    ambience.stop();
  } finally {
    console.warn = savedWarn;
  }
});

test('sound.js plays the changer on the motor voice: a new move releases the last, nothing builds up', async (t) => {
  const savedWindow = globalThis.window;
  t.after(() => { globalThis.window = savedWindow; });
  class EngineContext extends FakeContext {
    destination = node();
    createDynamicsCompressor() { return node({ threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }); }
    createAnalyser() { return node(); }
    createChannelSplitter() { return node(); }
  }
  globalThis.window = { AudioContext: EngineContext };
  serve();
  const { unlockAudio } = await import('../audio.js');
  const engine = unlockAudio();
  await loadJukeboxSfx(engine.ctx);
  const { sfx } = await import('../sound.js');
  assert.equal(sfx.change('eject', 1), true);
  const first = [...engine.ctx.sources];
  assert.equal(first.length, MOVES.eject.length);
  assert.equal(sfx.change('load', 1.5), true);
  assert.ok(first.every((source) => source.stops.length === 1), 'the previous move fades out instead of stacking');
  const second = engine.ctx.sources.slice(first.length);
  assert.equal(second.length, MOVES.load.length);
  sfx.stop('whirr');                                     // mechanism.js reset
  assert.ok(second.every((source) => source.stops.length === 1), 'a reset silences the changer');
});

/* ---------- the living machine ---------- */
function clock(t) {
  const saved = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  const timers = new Map();
  let id = 0;
  let now = 0;
  globalThis.setTimeout = (fn, ms) => { timers.set(++id, { fn, due: now + ms }); return id; };
  globalThis.clearTimeout = (key) => timers.delete(key);
  t.after(() => Object.assign(globalThis, saved));
  return {
    timers,
    get now() { return now; },
    run(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].due;
        next[1].fn();
      }
      now = end;
    },
  };
}

test('the machine waits for the interactive jukebox, fades in, sits lower under music and cleans up', async (t) => {
  const time = clock(t);
  const ctx = await readyContext();
  const bus = node();
  const ambience = createAmbience({ ctx, sfxBus: bus }, { now: () => time.now });
  assert.equal(ctx.sources.length, 0, 'silent over the dormant screen and the film');
  ambience.start();
  const beds = ctx.sources.filter((s) => s.loop);
  assert.equal(beds.length, 2, 'motor bed and electrical hum');
  const master = masterOf(beds[0], bus);
  assert.equal(master.connections[0], bus, 'on the Effects bus');
  assert.deepEqual(master.gain.events.at(-1), ['target', AMBIENCE.idle, ctx.currentTime, AMBIENCE.arriveSec / 3],
    'a slow arrival, no abrupt start at C1');
  ambience.start();
  assert.equal(ctx.sources.filter((s) => s.loop).length, 2, 'starting again adds nothing');
  ambience.setMusic(true);
  assert.equal(master.gain.events.at(-1)[1], AMBIENCE.music);
  assert.ok(AMBIENCE.music < AMBIENCE.idle * 0.7, 'noticeably lower under a song');
  ambience.setMusic(false);
  assert.equal(master.gain.events.at(-1)[1], AMBIENCE.idle, 'a little more present when idle');

  ambience.setVisible(false);
  assert.equal(ambience.running, false);
  assert.equal(time.timers.size, 0, 'no detail timers in a hidden tab');
  assert.ok(beds.every((s) => s.stops.length === 1), 'beds stop: nothing processes while hidden');
  beds.forEach((s) => s.end());
  for (let i = 0; i < 5; i++) {                    // flicking between tabs never piles up voices
    ambience.setVisible(true);
    ambience.setVisible(false);
    ctx.sources.filter((s) => s.stops.length).forEach((s) => s.end());
  }
  ambience.setVisible(true);
  assert.equal(ambience.voices, 2, 'exactly the two beds after returning');
  ambience.stop();
  ctx.sources.forEach((s) => s.end());
  assert.equal(ambience.voices, 0);
  assert.equal(time.timers.size, 0);
});

test('details arrive irregularly, one at a time, never twice running, with steam kept rare', async (t) => {
  const time = clock(t);
  const ctx = await readyContext();
  const ambience = createAmbience({ ctx, sfxBus: node() }, { now: () => time.now });
  ambience.start();
  const starts = [];
  const names = [];
  const byOffset = Object.fromEntries(Object.entries(SPRITE).map(([name, [start]]) => [start, name]));
  for (let s = 0; s < 3600; s += 1) {
    const before = ctx.sources.length;
    time.run(1000);
    for (const source of ctx.sources.slice(before)) {
      starts.push(time.now / 1000);
      names.push(byOffset[source.starts[0][1]]);
      assert.ok(ambience.voices <= 3, 'never stacked: two beds and one detail');
      source.end();
    }
  }
  assert.ok(starts[0] >= AMBIENCE.details.firstSec, 'the first detail waits for the machine to settle in');
  const gaps = starts.slice(1).map((v, i) => v - starts[i]);
  assert.ok(gaps.every((g) => g >= AMBIENCE.details.minSec), 'never crowded');
  assert.ok(Math.max(...gaps) - Math.min(...gaps) > 10, 'irregular, not a timer you can hear');
  assert.ok(starts.length > 100 && starts.length < 400, `about every 10-20 s over an hour: ${starts.length}`);
  for (let i = 1; i < names.length; i++) assert.notEqual(names[i], names[i - 1]);
  const steam = starts.filter((_, i) => names[i].startsWith('steam'));
  for (let i = 1; i < steam.length; i++) assert.ok(steam[i] - steam[i - 1] >= AMBIENCE.details.steamGapSec, 'steam stays rare');
});

/* ---------- the app keeps its film, opener and timing ---------- */
test('the app starts the machine only after the film, and the opener never doubles the film scratch', () => {
  const app = read('app.js');
  const startNight = app.slice(app.indexOf('async function startNight'), app.indexOf('/* ---------------- the dormant drone'));
  assert.ok(startNight.indexOf('await powerOn(') < startNight.indexOf('createAmbience('), 'after the dormant screen and the film');
  const powerOn = app.slice(app.indexOf('async function powerOn'), app.indexOf('async function startNight'));
  assert.doesNotMatch(powerOn, /ambience/, 'nothing new over the 35-second film');
  assert.match(app, /startAudio\(id, token, \{ leadInMs: 0, fadeInMs: 0, needle: false \}\)/, 'the opener lands without a second needle drop');
  assert.match(app, /const NATIVE30_MEDIA_STARTUP_LEAD_MS = 50;/, 'song-start lead unchanged');
  assert.match(app, /visibilitychange', \(\) => ambience\?\.setVisible/, 'hidden tabs stop it');
});

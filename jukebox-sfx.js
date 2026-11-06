/* ============================================================
   JUKEBOX SFX - the record changer's recorded choreography and the living
   machine around it, once the interactive jukebox is on screen.

   The changer (mechanism.js times every move; sound.js sfx.change plays it
   on the changer's own voice, so a reset or a new move releases the old one):
     load   motor engaging, carousel ratchets, the index locking, the gripper,
            servos carrying the record up and down, the record settling on
            the platter, the tonearm swinging across. The needle drop itself
            belongs to vinyl.js, on the song's start, and the thud stays.
     eject  needle lift and arm return, gripper, servos, the record seating
            back in the ring, the sleeve sliding home to the rack.
   Each slot draws from a shuffle bag of trimmed components (scripts/
   build-jukebox-sfx.mjs cuts them from the owner's recordings), with a
   little speed and level variation: every change sounds like the same
   machine, never the same take twice in a row. Cue times scale with the
   move, so a skip at speed 1.8 stays on the picture.

   The living machine: a low motor bed and an electrical hum, looped
   seamlessly, with occasional distant details (rattles, servos, sparks,
   relays, movements, a rare steam release) at irregular intervals, one at
   a time. It fades in when the interactive jukebox arrives (never over the
   dormant screen or the film, which have their own soundtracks), sits
   slightly lower while music plays, and stops entirely while the page is
   hidden. Everything goes through the Effects bus; a missing or broken file
   silences only itself.
   ============================================================ */
import { SPRITE } from './jukebox-sprite.js';

export const JUKEBOX_SFX_FILES = Object.freeze({
  sprite: 'sfx/jukebox/mechanics.mp3',
  machine: 'sfx/jukebox/bed-machine.flac',
  electric: 'sfx/jukebox/bed-electric.flac',
});
const loads = new WeakMap();     // context -> Promise of every file's decode
const banks = new WeakMap();     // context -> { sprite, machine, electric } as each becomes ready

/* Fetch and decode once per audio context, each file on its own. */
export function loadJukeboxSfx(ctx) {
  if (!loads.has(ctx)) {
    const bank = {};
    banks.set(ctx, bank);
    loads.set(ctx, Promise.all(Object.entries(JUKEBOX_SFX_FILES).map(async ([key, path]) => {
      try {
        const response = await fetch(new URL(path, import.meta.url));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        bank[key] = await ctx.decodeAudioData(await response.arrayBuffer());
      } catch (error) {
        console.warn(`[jukebox sfx] ${path} unavailable; it stays silent`, error);
      }
    })).then(() => bank));
  }
  return loads.get(ctx);
}
const bankOf = (ctx) => banks.get(ctx) || {};

/* A shuffle bag: every member once per round, never the same twice running. */
export function shuffleBag(names, random = Math.random) {
  let round = [];
  let last = null;
  return () => {
    if (!round.length) {
      round = [...names];
      for (let i = round.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [round[i], round[j]] = [round[j], round[i]];
      }
      if (round.length > 1 && round[0] === last) round.push(round.shift());
    }
    last = round.shift();
    return last;
  };
}

const POOLS = {
  motor: ['motor-a', 'motor-b', 'motor-c'],
  index: ['index-a', 'index-b', 'index-c'],
  lock: ['lock-a', 'lock-b', 'lock-c'],
  tick: ['tick-a', 'tick-b', 'tick-c'],
  servo: ['servo-a', 'servo-b', 'servo-c'],
  drop: ['drop-a', 'drop-b'],
  arm: ['arm-a', 'arm-b'],
  seat: ['seat-a', 'seat-b'],
  slide: ['slide-a', 'slide-b'],
};
/* [fraction of the move it starts at, slot, level, longest fraction of the move].
   The fractions are mechanism.js's choreography (LOAD_MS / EJECT_MS). Levels:
   a load peaks about -26 LUFS momentary at equal faders (the song runs about
   -18), an eject a little under; the needle drop is vinyl.js's. */
export const MOVES = Object.freeze({
  load: [
    [0, 'motor', 0.25],
    [0.02, 'index', 0.22, 0.27],      // the carousel turns while the sleeve slides in
    [0.26, 'tick', 0.15],             // the gripper takes the record
    [0.29, 'lock', 0.33],             // the index brakes and locks
    [0.31, 'servo', 0.18, 0.36],      // the record swings up and drops
    [0.67, 'drop', 0.25],             // onto the platter
    [0.69, 'arm', 0.12, 0.30],        // the tonearm swings across (vinyl.js drops the needle)
  ],
  eject: [
    [0, 'tick', 0.2],                 // the needle lifts
    [0.01, 'arm', 0.17, 0.25],        // the arm returns to its rest
    [0.22, 'tick', 0.18],             // the gripper takes the record
    [0.22, 'servo', 0.26, 0.36],      // up out of the platter
    [0.55, 'slide', 0.32, 0.45],      // the sleeve heads home to the rack
    [0.58, 'seat', 0.40],             // the record seats back in the ring
  ],
});
const bags = Object.fromEntries(Object.entries(POOLS).map(([slot, names]) => [slot, shuffleBag(names)]));
const VARY = { rate: 0.02, level: 0.12 };
const jitter = (amount) => 1 + (Math.random() * 2 - 1) * amount;

/* One component of the sprite at `when`, cut short (with a quick fade) to `fit` seconds. */
function component(ctx, sprite, name, output, when, { level = 1, fit = Infinity, rate = 1, nodes = [] } = {}) {
  const [start, length] = SPRITE[name];
  const seconds = Math.min(length, fit * rate);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = sprite;
  source.playbackRate.value = rate;
  gain.gain.setValueAtTime(level, when);
  if (seconds < length) {
    const end = when + seconds / rate;
    gain.gain.setValueAtTime(level, Math.max(when, end - 0.04));
    gain.gain.linearRampToValueAtTime(0.0001, end);
  }
  source.connect(gain);
  let tail = gain;
  for (const node of nodes) tail = tail.connect(node);
  tail.connect(output);
  source.start(when, start, seconds);
  return { source, nodes: [gain, ...nodes] };
}

export const changerReady = (ctx) => Boolean(bankOf(ctx).sprite);

/* The changer's move on a sound.js voice ({ ctx, output, track }). Returns
   false when the recordings are not ready, so the caller plays the motor. */
export function playChange(move, seconds, voice, when = voice.ctx.currentTime) {
  const { sprite } = bankOf(voice.ctx);
  const cues = MOVES[move];
  if (!sprite || !cues || !(seconds > 0)) return false;
  for (const [at, slot, level, fit] of cues) {
    const { source, nodes } = component(voice.ctx, sprite, bags[slot](), voice.output, when + at * seconds,
      { level: level * jitter(VARY.level), rate: jitter(VARY.rate), fit: fit ? fit * seconds : Infinity });
    voice.track(source, ...nodes);
  }
  return true;
}

/* ---------------- the living machine ---------------- */
export const AMBIENCE = Object.freeze({
  idle: 0.21,                // master level with no music (on the Effects bus): about -38 LUFS, 20 dB under a song
  music: 0.125,              // about 4.5 dB lower under a song
  arriveSec: 8,              // the fade in as the interactive jukebox arrives
  returnSec: 2,              // back from a hidden page
  leaveSec: 0.35,
  beds: { machine: 0.55, electric: 0.16 },
  details: { level: 0.34, firstSec: 14, minSec: 6, meanSec: 9, maxSec: 34, steamGapSec: 100 },
});
// Weighted: the machine mostly ticks and hums; movements and steam are rare.
const DETAILS = [
  ['far-rattle-a', 2], ['far-rattle-b', 2], ['far-servo-a', 2], ['far-servo-b', 1.5],
  ['spark-a', 2], ['spark-b', 2], ['spark-c', 2], ['relay-a', 2.5], ['relay-b', 2.5],
  ['move-a', 1], ['move-b', 1.2], ['clunk-a', 1], ['steam-a', 0.6],
];

export function createAmbience(engine, { random = Math.random, now = () => performance.now() } = {}) {
  const { ctx, sfxBus } = engine;
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(sfxBus);
  const live = new Set();          // every source this ambience is playing
  let wanted = false;              // the interactive jukebox is on screen
  let visible = true;
  let music = false;
  let running = false;
  let timer = null;
  let lastDetail = null;
  let lastSteam = -Infinity;
  const level = () => (music ? AMBIENCE.music : AMBIENCE.idle);

  function play(buffer, { loop = false, offset = 0, length, when = ctx.currentTime, nodes = [], gain = 1 }) {
    const source = ctx.createBufferSource();
    const amp = ctx.createGain();
    source.buffer = buffer;
    source.loop = loop;
    amp.gain.value = gain;
    source.connect(amp);
    let tail = amp;
    for (const node of nodes) tail = tail.connect(node);
    tail.connect(master);
    live.add(source);
    source.onended = () => {
      live.delete(source);
      source.disconnect();
      amp.disconnect();
      nodes.forEach((node) => node.disconnect());
    };
    if (loop) source.start(when, offset);
    else source.start(when, offset, length);
    return source;
  }

  function nextDetailIn(first = false) {
    if (first) return AMBIENCE.details.firstSec + random() * 6;
    const { minSec, meanSec, maxSec } = AMBIENCE.details;
    const wait = minSec - Math.log(1 - random() * 0.999) * meanSec;   // irregular, never a beat
    return Math.min(maxSec, wait) * (music ? 1.4 : 1);
  }

  function detail() {
    timer = null;
    if (!running) return;
    const { sprite } = bankOf(ctx);
    let length = 1;
    if (sprite) {
      const steamOk = now() - lastSteam > AMBIENCE.details.steamGapSec * 1000;
      const choices = DETAILS.filter(([name]) => name !== lastDetail && (steamOk || !name.startsWith('steam')));
      let pick = random() * choices.reduce((sum, [, w]) => sum + w, 0);
      const [name] = choices.find(([, w]) => (pick -= w) <= 0) || choices[0];
      if (name.startsWith('steam')) lastSteam = now();
      lastDetail = name;
      // Distance: darker and placed somewhere in the cabinet, never in the listener's face.
      const far = ctx.createBiquadFilter();
      far.type = 'lowpass';
      far.frequency.value = 1800 + random() * 3600;
      const nodes = [far];
      if (ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = (random() * 2 - 1) * 0.7;
        nodes.push(pan);
      }
      const [start, len] = SPRITE[name];
      length = len;
      play(sprite, { offset: start, length: len, nodes, gain: AMBIENCE.details.level * (0.55 + 0.45 * random()) });
    }
    timer = setTimeout(detail, (length + nextDetailIn()) * 1000);   // one detail at a time
  }

  function begin(fadeSec) {
    const bank = bankOf(ctx);
    if (running || !wanted || !visible || !(bank.machine || bank.electric)) return;
    running = true;
    const t = ctx.currentTime;
    for (const key of ['machine', 'electric']) {
      const buffer = bank[key];
      if (buffer) play(buffer, { loop: true, offset: random() * buffer.duration, gain: AMBIENCE.beds[key] });
    }
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.setTargetAtTime(level(), t, fadeSec / 3);
    timer = setTimeout(detail, nextDetailIn(true) * 1000);
  }

  function halt(fadeSec) {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!running) return;
    running = false;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + fadeSec);
    for (const source of live) {
      try { source.stop(t + fadeSec + 0.02); } catch { /* already finished */ }
    }
  }

  const guard = (action) => { try { action(); } catch (error) { console.warn('[ambience]', error); } };
  return {
    /* The interactive jukebox has arrived: fade the machine in (once its files are ready). */
    start() {
      guard(() => {
        if (wanted) return;
        wanted = true;
        begin(AMBIENCE.arriveSec);
        loadJukeboxSfx(ctx).then(() => guard(() => begin(AMBIENCE.arriveSec)));
      });
    },
    setMusic(on) {
      guard(() => {
        if (music === Boolean(on)) return;
        music = Boolean(on);
        if (running) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.8);
      });
    },
    setVisible(on) {
      guard(() => {
        visible = Boolean(on);
        if (visible) begin(AMBIENCE.returnSec);
        else halt(AMBIENCE.leaveSec);
      });
    },
    stop() { guard(() => { wanted = false; halt(AMBIENCE.leaveSec); }); },
    get running() { return running; },
    get voices() { return live.size; },
  };
}

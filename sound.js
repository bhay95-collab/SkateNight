/* ============================================================
   SOUND - short, original electromechanical cabinet sounds, with
   quiet Web Audio fallbacks if an asset cannot load or decode.

   One sound per moment - do not reuse one for something else:
     coin     a coin rattling down the metal chute
     key      a dry switch contact and muted key travel
     confirm  a selection relay latching twice
     whirr    the changer motor and its gears settling
     thud     a gentle, felt-damped needle landing
     buzz     a muted refused-selection solenoid
     flicker  legacy hook; silent unless a custom MP3 is supplied
     page     the paper carrier releasing and catching
     The INSERT COIN film (startup-timing.js gives every beat):
     lift     the coin taken up and swung into the light
     contact  its edge meeting the slit, the scrape, the slip, the gate
     chute    clinks going deeper into the cabinet, the coin box, the counter
     relay    the main relay pulling in: a deep THUNK through the cabinet
     power    the supply trying, dying, catching and locking: transformer hum
              that follows SUPPLY, relays, degauss, crackle, flyback whine
     tube     one neon letter striking
     collapse the tube surging and squeezing to a line: whine, thunk

   Your own recordings: put an MP3 named after the effect in the sfx/
   folder (sfx/coin.mp3, sfx/key.mp3, sfx/confirm.mp3, sfx/whirr.mp3,
   sfx/thud.mp3, sfx/buzz.mp3, sfx/flicker.mp3, sfx/page.mp3, sfx/power.mp3, ...) and it plays instead of the
   original WAV. A missing or unreadable MP3 falls back to that WAV,
   then to a quiet live model. See sfx/README.md for the sample source.

   Every effect is wrapped so a sound failure can never stop the music.
   ============================================================ */
import { getEngine } from './audio.js';
import { BEATS, CHUTE_CLINKS_MS, supplyAt } from './startup-timing.js';

/* The film's beats in seconds, from the moment each sound is cued. */
const secs = (ms) => ms / 1000;
const SLIP_S = secs(BEATS.slip - BEATS.contact);
const GATE_S = secs(BEATS.gone - BEATS.contact);
const CLINKS_S = CHUTE_CLINKS_MS.map(secs);
const CREDIT_S = secs(BEATS.credit - BEATS.gone);
const fromRelay = (ms) => secs(ms - BEATS.relay);
const SURGE_S = secs(BEATS.collapse - BEATS.surge);
const LINE_S = secs(BEATS.end - BEATS.surge);

const STARTUP = ['lift', 'contact', 'chute', 'relay', 'power', 'tube', 'collapse'];   // the INSERT COIN film (startup.js)
const SFX_NAMES = ['coin', 'key', 'confirm', 'whirr', 'thud', 'buzz', 'flicker', 'page', ...STARTUP];
const MP3_ONLY = new Set(['flicker', ...STARTUP]);   // no bundled WAV: a custom MP3 or the live model
const rawFiles = new Map();      // name -> ordered { path, bytes } candidates
const buffers = new Map();       // name -> decoded sound, ready to play
const filePaths = new Map();     // distinguish bundled motors from custom recordings
let fetching = null;

// The asset pack already has headroom. These trims keep frequent controls and
// the changer behind the coin/relay accents, without touching the music bus.
const MIX = {
  coin: { gain: 0.95, variation: 0.008 },
  key: { gain: 0.80, variation: 0.018 },
  confirm: { gain: 0.92, variation: 0 },
  whirr: { gain: 0.82, variation: 0 },
  thud: { gain: 0.90, variation: 0 },
  buzz: { gain: 0.80, variation: 0 },
  page: { gain: 0.85, variation: 0.012 },
  flicker: { gain: 0.70, variation: 0 },
  lift: { gain: 0.85, variation: 0 },
  contact: { gain: 0.95, variation: 0 },
  chute: { gain: 0.95, variation: 0 },
  relay: { gain: 1.0, variation: 0 },
  power: { gain: 0.95, variation: 0 },
  tube: { gain: 0.70, variation: 0.05 },
  collapse: { gain: 0.85, variation: 0 },
};
/* The film's live models are drawn quietly (their partials stack), so they
   are raised to sit at music level: measured at the 70% Effects fader they
   were 18-20 dB under a typical track. A custom MP3 keeps its own level; the
   Effects fader and the limiter still apply. */
const FILM_BOOST = { lift: 12, contact: 12, chute: 10, relay: 7, power: 8, tube: 8, collapse: 7 };
const activeVoices = new Map();
const RELEASE_SECONDS = 0.014;

/* One voice per action. Fast presses still respond immediately, but the old
   tail fades instead of accumulating. File and live-model voices share this
   path, and finished sources release their audio graph connections. */
function createVoice(name) {
  const e = getEngine();
  if (!e) return null;
  const { ctx, sfxBus } = e;
  activeVoices.get(name)?.release();
  const { gain, variation } = MIX[name];
  let level = gain;
  const output = ctx.createGain();
  output.gain.setValueAtTime(level, ctx.currentTime);
  output.connect(sfxBus);
  const sources = new Set();
  const voice = {
    ctx, output,
    rate: 1 + (Math.random() * 2 - 1) * variation,
    track(source, ...nodes) {
      sources.add(source);
      source.onended = () => {
        source.disconnect();
        nodes.forEach((n) => n.disconnect());
        sources.delete(source);
        if (!sources.size) {
          output.disconnect();
          if (activeVoices.get(name) === voice) activeVoices.delete(name);
        }
      };
    },
    louder(k) {                     // the live model, raised to its film level
      level = gain * k;
      output.gain.setValueAtTime(level, ctx.currentTime);
    },
    release() {
      const t = ctx.currentTime;
      output.gain.cancelScheduledValues(t);
      output.gain.setValueAtTime(level, t);
      output.gain.linearRampToValueAtTime(0.0001, t + RELEASE_SECONDS);
      for (const source of sources) {
        try { source.stop(t + RELEASE_SECONDS); } catch { /* already finished */ }
      }
      if (!sources.size) {
        output.disconnect();
        if (activeVoices.get(name) === voice) activeVoices.delete(name);
      }
    },
  };
  activeVoices.set(name, voice);
  return voice;
}

/* Fetch early, without a sound card. Optional MP3s always take priority over
   the bundled WAVs, including when downloads finish in the opposite order. */
export function preloadSfxFiles() {
  if (!fetching) {
    fetching = Promise.all(SFX_NAMES.map(async (name) => {
      const formats = MP3_ONLY.has(name) ? ['mp3'] : ['mp3', 'wav'];
      const candidates = await Promise.all(formats.map(async (format) => {
        const path = `sfx/${name}.${format}`;
        try {
          const res = await fetch(path);
          if (res.ok) return { path, bytes: await res.arrayBuffer() };
        } catch { /* an unavailable file must never block playback */ }
        return null;
      }));
      rawFiles.set(name, candidates.filter(Boolean));
    }));
  }
  return fetching;
}

/* Decode them once the sound engine exists (after the first click). */
export async function decodeSfxFiles() {
  const e = getEngine();
  if (!e) return;
  await preloadSfxFiles();
  await Promise.all([...rawFiles].map(async ([name, candidates]) => {
    if (buffers.has(name)) return;
    for (const { path, bytes } of candidates) {
      try {
        buffers.set(name, await e.ctx.decodeAudioData(bytes.slice(0)));
        filePaths.set(name, path);
        return;
      } catch (err) {
        console.warn(`[sound] ${path} could not be read - trying the next sound source`, err);
      }
    }
  }));
}

/* File-backed effects (original samples or user recordings). Public name is
   retained for existing tools that check whether a replacement file worked. */
export const recordedSfx = () => [...buffers.keys()];

/* Play a file-backed effect if there is one. maxSeconds trims a long file
   with a quick fade (the whirr has to fit the record changer's move). */
function playFile(name, voice, maxSeconds) {
  const buf = buffers.get(name);
  if (!buf) return false;
  const { ctx, output, rate } = voice;
  const t = ctx.currentTime;
  // Shorten only the steady middle of the original motor. The authored stop
  // contact must survive faster moves, at its original pitch. Custom recordings
  // retain the documented fade-to-fit behavior rather than guessing their shape.
  if (name === 'whirr' && filePaths.get(name) === 'sfx/whirr.wav' && maxSeconds >= 0.25 && maxSeconds < buf.duration) {
    const tail = 0.18;
    const overlap = 0.025;
    const join = maxSeconds - tail;
    for (const ending of [false, true]) {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buf;
      src.playbackRate.setValueAtTime(1, t);
      src.connect(gain).connect(output);
      voice.track(src, gain);
      if (!ending) {
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(1, t + 0.003);
        gain.gain.setValueAtTime(1, t + join);
        gain.gain.linearRampToValueAtTime(0, t + join + overlap);
        src.start(t);
        src.stop(t + join + overlap);
      } else {
        gain.gain.setValueAtTime(0, t + join);
        gain.gain.linearRampToValueAtTime(1, t + join + overlap);
        // Match the final sample's zero boundary; even the release stays within
        // the movement rather than leaking into the needle-on-groove cue.
        gain.gain.setValueAtTime(1, t + maxSeconds - 0.012);
        gain.gain.linearRampToValueAtTime(0, t + maxSeconds);
        src.start(t + join, buf.duration - tail);
        src.stop(t + maxSeconds);
      }
    }
    return true;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.setValueAtTime(rate, t);
  const gain = ctx.createGain();
  // Tiny attack protects against a replacement file with an abrupt boundary.
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(1, t + 0.003);
  src.connect(gain).connect(output);
  voice.track(src, gain);
  src.start(t);
  if (maxSeconds && buf.duration / rate > maxSeconds) {
    gain.gain.setValueAtTime(1, t + Math.max(0.003, maxSeconds - 0.12));
    gain.gain.linearRampToValueAtTime(0.0001, t + maxSeconds);
    src.stop(t + maxSeconds + 0.02);
  }
  return true;
}

function tone(voice, { freq, to = freq, type = 'sine', at = 0, dur = 0.15, peak = 0.1 }) {
  const { ctx, output, rate } = voice;
  const t = ctx.currentTime + at / rate;
  dur /= rate;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq * rate, t);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(to * rate, 1), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(output);
  voice.track(osc, gain);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// A short burst of filtered noise: thud-ish when low, tick-ish when high.
function thump(voice, { at = 0, dur = 0.08, peak = 0.5, freq = 1600 }) {
  const { ctx, output, rate } = voice;
  const t = ctx.currentTime + at / rate;
  dur /= rate;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq * rate;
  filter.Q.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(output);
  voice.track(src, filter, gain);
  src.start(t);
  src.stop(t + dur + 0.05);
}

// A held tone with its own envelope: points are [seconds, gain] pairs.
function held(voice, { freq, type = 'sine', points, filterHz }) {
  const { ctx, output, rate } = voice;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq * rate, t);
  gain.gain.setValueAtTime(0.0001, t);
  for (const [at, level] of points) gain.gain.linearRampToValueAtTime(Math.max(level, 0.0001), t + at / rate);
  if (filterHz) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    osc.connect(filter).connect(gain);
    voice.track(filter);
  } else {
    osc.connect(gain);
  }
  gain.connect(output);
  voice.track(osc, gain);
  const end = points[points.length - 1][0] / rate;
  osc.start(t);
  osc.stop(t + end + 0.05);
}

// Struck metal: a few inharmonic partials ringing down (a coin, a chute wall).
function ring(voice, { freq, at = 0, peak = 0.05, decay = 0.6 }) {
  const { ctx, output, rate } = voice;
  const t = ctx.currentTime + at / rate;
  [[1, 1], [2.76, 0.55], [5.4, 0.3], [8.93, 0.16]].forEach(([ratio, weight], k) => {
    if (freq * ratio * rate > ctx.sampleRate / 2.2) return;     // above what the speakers (and Nyquist) allow
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(freq * ratio * rate, t);
    const end = t + (decay / (k + 1)) / rate;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak * weight, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(output);
    voice.track(osc, gain);
    osc.start(t);
    osc.stop(end + 0.05);
  });
}

// Air: filtered noise sweeping from one pitch to another, optionally fluttering
// (amHz) like a spinning coin cutting the air.
function whoosh(voice, { at = 0, dur = 0.6, from = 500, to = 2000, peak = 0.05, q = 1.2, amHz = 0 }) {
  const { ctx, output, rate } = voice;
  const t = ctx.currentTime + at / rate;
  dur /= rate;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + dur * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(output);
  voice.track(src, filter, gain);
  if (amHz) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.setValueAtTime(amHz, t);
    lfo.frequency.exponentialRampToValueAtTime(Math.max(amHz / 5, 1), t + dur);
    depth.gain.value = peak * 0.8;
    lfo.connect(depth).connect(gain.gain);
    voice.track(lfo, depth);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  src.start(t);
  src.stop(t + dur + 0.05);
}

/* The transformer hum from the relay to the line, its level following SUPPLY
   (the picture's own curve) and its upper partials opening with the voltage. */
const HUM_STEP_MS = 30;
const HUM_PARTIALS = [[100, 1, 0], [150, 0.55, 1], [200, 0.35, 1], [300, 0.18, 1.5]];   // [Hz, share, how much it needs volts]
function supplyHum(voice) {
  const points = [];
  for (let ms = BEATS.relay; ms <= BEATS.end; ms += HUM_STEP_MS) points.push([fromRelay(ms), supplyAt(ms)]);
  for (const [freq, share, need] of HUM_PARTIALS) {
    held(voice, { freq, type: 'sawtooth', filterHz: 700, points: points.map(([at, v]) => {
      const live = v < 0.05 ? 0 : Math.min(v, 1.15);
      return [at, 0.06 * share * live * Math.min(1, live) ** need];
    }) });
  }
}

/* Static crackle where the supply struggles: most where it is neither dead nor running. */
function crackle(voice) {
  for (let n = 0; n < 40;) {
    const ms = BEATS.attempt + Math.random() * (BEATS.ignite - BEATS.attempt);
    const v = supplyAt(ms);
    if (v < 0.05 || Math.random() > 1 - Math.abs(v - 0.5)) continue;
    thump(voice, { freq: 2600 + Math.random() * 3200, dur: 0.006 + Math.random() * 0.016, peak: 0.02 + Math.random() * 0.05, at: fromRelay(ms) });
    n++;
  }
}

const effect = (name, fallback) => (...args) => {
  let voice;
  try {
    if (!buffers.has(name) && !fallback) return;
    voice = createVoice(name);
    if (!voice || playFile(name, voice, name === 'whirr' ? args[0] ?? 0.9 : undefined)) return;
    if (FILM_BOOST[name]) voice.louder(FILM_BOOST[name]);
    fallback(voice, ...args);
  } catch (err) {
    voice?.release();
    console.warn('[sound]', err);
  }
};

export const sfx = {
  stop(name) { activeVoices.get(name)?.release(); },
  coin: effect('coin', (voice) => {
    for (const [at, peak] of [[0, 0.12], [0.065, 0.09], [0.145, 0.10], [0.24, 0.07]]) {
      thump(voice, { freq: 2100, dur: 0.035, peak, at });
    }
    tone(voice, { freq: 2353, at: 0.145, dur: 0.10, peak: 0.025 });
    thump(voice, { freq: 470, dur: 0.055, peak: 0.10, at: 0.28 });
  }),

  key: effect('key', (voice) => {
    thump(voice, { freq: 2300, dur: 0.012, peak: 0.13 });
    thump(voice, { freq: 680, dur: 0.035, peak: 0.11, at: 0.008 });
  }),

  confirm: effect('confirm', (voice) => {
    thump(voice, { freq: 1000, dur: 0.03, peak: 0.12 });
    thump(voice, { freq: 1450, dur: 0.025, peak: 0.11, at: 0.095 });
    thump(voice, { freq: 700, dur: 0.02, peak: 0.04, at: 0.12 });
  }),

  whirr: effect('whirr', (voice, seconds = 0.9) => {
    tone(voice, { freq: 135, to: 180, dur: seconds * 0.55, peak: 0.025 });
    tone(voice, { freq: 180, to: 140, at: seconds * 0.55, dur: seconds * 0.45, peak: 0.023 });
    for (let i = 0; i < 6; i++) thump(voice, { at: (seconds / 6) * i, dur: 0.03, peak: 0.025, freq: 1900 });
  }),

  thud: effect('thud', (voice) => {
    thump(voice, { freq: 850, dur: 0.035, peak: 0.065 });
    thump(voice, { freq: 1700, dur: 0.015, peak: 0.015, at: 0.025 });
  }),

  buzz: effect('buzz', (voice) => {
    thump(voice, { freq: 370, dur: 0.065, peak: 0.12 });
    thump(voice, { freq: 370, dur: 0.065, peak: 0.10, at: 0.13 });
  }),

  page: effect('page', (voice) => {
    thump(voice, { freq: 1600, dur: 0.025, peak: 0.10 });
    thump(voice, { freq: 530, dur: 0.045, peak: 0.13, at: 0.20 });
    thump(voice, { freq: 2100, dur: 0.015, peak: 0.035, at: 0.23 });
  }),

  /* ---- the INSERT COIN film (startup-timing.js times pictures and sounds alike) ---- */

  // The coin taken up, swung through the air into the light; its rim rings faintly as it is turned.
  lift: effect('lift', (voice) => {
    thump(voice, { freq: 2900, dur: 0.01, peak: 0.05 });
    ring(voice, { freq: 4100, peak: 0.012, decay: 0.3 });
    whoosh(voice, { at: 0.12, dur: 0.75, from: 380, to: 1500, peak: 0.035, q: 1.1 });
    ring(voice, { freq: 3300, at: 0.95, peak: 0.01, decay: 1.2 });
  }),

  // Its edge meets the slit and catches - a tick, a gritty scrape - then the
  // gate gives, it slides through, and the gate snaps back behind it.
  contact: effect('contact', (voice) => {
    thump(voice, { freq: 3400, dur: 0.008, peak: 0.11 });
    ring(voice, { freq: 2700, peak: 0.035, decay: 0.3 });
    whoosh(voice, { at: 0.02, dur: SLIP_S * 0.95, from: 5200, to: 3400, peak: 0.03, q: 6, amHz: 70 });   // pressed against the gate
    tone(voice, { freq: 410, to: 360, type: 'triangle', at: 0.16, dur: SLIP_S - 0.12, peak: 0.008 });     // the spring straining
    whoosh(voice, { at: SLIP_S, dur: 0.24, from: 2600, to: 900, peak: 0.05, q: 2 });
    thump(voice, { freq: 1800, dur: 0.015, peak: 0.1, at: GATE_S - 0.03 });
    thump(voice, { freq: 600, dur: 0.04, peak: 0.08, at: GATE_S - 0.025 });
  }),

  // Down inside: each clink lower, softer and longer, as if further into the
  // cabinet than you can see; then the coin box, and the counter ticking over.
  chute: effect('chute', (voice) => {
    CLINKS_S.forEach((at, i) => {
      const fade = 1 - i / CLINKS_S.length;
      ring(voice, { freq: 1900 - i * 150, at, peak: 0.015 + 0.035 * fade, decay: 0.2 + i * 0.03 });
      thump(voice, { freq: 1500 - i * 120, dur: 0.02, peak: 0.02 + 0.05 * fade, at });
    });
    whoosh(voice, { at: CLINKS_S.at(-1) + 0.03, dur: 0.3, from: 900, to: 400, peak: 0.02, q: 3, amHz: 24 });   // rolling to a stop
    thump(voice, { freq: 130, dur: 0.18, peak: 0.22, at: CREDIT_S });                                           // the coin box
    thump(voice, { freq: 520, dur: 0.05, peak: 0.1, at: CREDIT_S });
    ring(voice, { freq: 700, at: CREDIT_S, peak: 0.02, decay: 0.45 });
    thump(voice, { freq: 2600, dur: 0.008, peak: 0.06, at: CREDIT_S + 0.14 });                                  // the counter
    thump(voice, { freq: 2300, dur: 0.008, peak: 0.05, at: CREDIT_S + 0.2 });
  }),

  // The main relay: contacts, armature, the body of the cabinet booming once.
  relay: effect('relay', (voice) => {
    thump(voice, { freq: 1300, dur: 0.02, peak: 0.16 });
    thump(voice, { freq: 380, dur: 0.07, peak: 0.2, at: 0.004 });
    thump(voice, { freq: 62, dur: 0.4, peak: 0.3, at: 0.01 });
    tone(voice, { freq: 58, to: 38, dur: 0.4, peak: 0.18 });
    ring(voice, { freq: 176, at: 0.01, peak: 0.03, decay: 1.4 });
  }),

  // From the relay to the line: the transformer hum riding the same supply
  // as the picture, its upper partials opening as the voltage comes up; the
  // first attempt's sag, the second relay, the degauss as the raster opens,
  // crackle where it struggles, the flyback whine, and the lock.
  power: effect('power', (voice) => {
    supplyHum(voice);
    const gather = fromRelay(BEATS.attempt);                                                                  // A: the transformer gathering itself
    held(voice, { freq: 50, type: 'sawtooth', filterHz: 240, points: [[gather, 0], [fromRelay(BEATS.almost), 0.05],
      [fromRelay(BEATS.fail), 0.035], [fromRelay(BEATS.fail) + 0.42, 0]] });
    tone(voice, { freq: 100, to: 34, type: 'sawtooth', at: fromRelay(BEATS.fail), dur: 0.6, peak: 0.04 });     // it dies, winding down
    whoosh(voice, { at: fromRelay(BEATS.fail), dur: 0.5, from: 1400, to: 160, peak: 0.02, q: 1.4 });
    const tick = fromRelay(BEATS.tick);                                                                       // the dark: one tick somewhere inside
    thump(voice, { freq: 2400, dur: 0.006, peak: 0.035, at: tick });
    ring(voice, { freq: 1320, at: tick, peak: 0.006, decay: 0.25 });
    const relay2 = fromRelay(BEATS.catch);                                                                    // B: the deeper, heavier relay
    thump(voice, { freq: 1100, dur: 0.02, peak: 0.15, at: relay2 });
    thump(voice, { freq: 300, dur: 0.07, peak: 0.16, at: relay2 + 0.004 });
    thump(voice, { freq: 55, dur: 0.5, peak: 0.28, at: relay2 + 0.01 });
    tone(voice, { freq: 52, to: 36, dur: 0.5, peak: 0.16, at: relay2 });
    ring(voice, { freq: 160, at: relay2 + 0.01, peak: 0.028, decay: 1.6 });
    const degauss = fromRelay(BEATS.catch + 640);
    held(voice, { freq: 88, type: 'sawtooth', filterHz: 360, points: [[degauss, 0], [degauss + 0.06, 0.1], [degauss + 0.2, 0.03],
      [degauss + 0.36, 0.08], [degauss + 0.56, 0.02], [degauss + 0.76, 0.045], [degauss + 1.3, 0]] });
    thump(voice, { freq: 150, dur: 0.35, peak: 0.14, at: degauss + 0.02 });
    crackle(voice);
    held(voice, { freq: 7800, points: [[degauss, 0], [fromRelay(BEATS.catch + 900), 0.004], [fromRelay(BEATS.surge), 0.003], [fromRelay(BEATS.end), 0]] });
    const lock = fromRelay(BEATS.ignite);                                                                    // it locks
    thump(voice, { freq: 60, dur: 0.45, peak: 0.26, at: lock });
    thump(voice, { freq: 900, dur: 0.03, peak: 0.12, at: lock });
    tone(voice, { freq: 55, to: 42, at: lock, dur: 0.5, peak: 0.16 });
    ring(voice, { freq: 220, at: lock, peak: 0.03, decay: 1.6 });
    ring(voice, { freq: 1975, at: lock + 0.04, peak: 0.022, decay: 0.9 });
    tone(voice, { freq: 988, type: 'triangle', at: lock + 0.04, dur: 0.5, peak: 0.018 });
    tone(voice, { freq: 1480, type: 'triangle', at: lock + 0.1, dur: 0.45, peak: 0.013 });
    held(voice, { freq: 50, type: 'sawtooth', filterHz: 180, points: [[lock, 0], [lock + 0.6, 0.045], [fromRelay(BEATS.surge), 0.04], [fromRelay(BEATS.end), 0]] });   // the machine standing there, alive
  }),

  // One neon letter catching: a short mains buzz and the electrode tick.
  tube: effect('tube', (voice) => {
    thump(voice, { freq: 3200, dur: 0.008, peak: 0.06 });
    held(voice, { freq: 120, type: 'sawtooth', filterHz: 1400, points: [[0.005, 0.03], [0.06, 0.012], [0.09, 0.028], [0.2, 0]] });
  }),

  // The surge: the whine climbs as the camera dives in; the picture squeezes
  // to a line with a falling zip, and lands with a thunk.
  collapse: effect('collapse', (voice) => {
    tone(voice, { freq: 1800, to: 9000, dur: SURGE_S + 0.2, peak: 0.02 });
    whoosh(voice, { dur: SURGE_S, from: 300, to: 2400, peak: 0.045, q: 0.9 });
    whoosh(voice, { at: SURGE_S, dur: LINE_S - SURGE_S, from: 3200, to: 380, peak: 0.05, q: 1 });
    thump(voice, { freq: 110, dur: 0.25, peak: 0.2, at: LINE_S - 0.02 });
    thump(voice, { freq: 900, dur: 0.03, peak: 0.08, at: LINE_S - 0.02 });
  }),

  // Keep the legacy hook without introducing ambient interference during music.
  flicker: effect('flicker'),
};

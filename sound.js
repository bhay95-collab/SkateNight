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
              that follows SUPPLY (in E-flat, the opener's key), relays,
              degauss, crackle, flyback whine, and the second try's heartbeat
              quickening into two bars of thumps at the song's tempo (PULSE)
              - all of it stopping dead on the last beat, the cut
     tube     one neon letter striking

   Your own recordings: put an MP3 named after the effect in the sfx/
   folder (sfx/coin.mp3, sfx/key.mp3, sfx/confirm.mp3, sfx/whirr.mp3,
   sfx/thud.mp3, sfx/buzz.mp3, sfx/flicker.mp3, sfx/page.mp3, sfx/power.mp3, ...) and it plays instead of the
   original WAV. A missing or unreadable MP3 falls back to that WAV,
   then to a quiet live model. See sfx/README.md for the sample source.

   Every effect is wrapped so a sound failure can never stop the music.
   ============================================================ */
import { getEngine } from './audio.js';
import { BEATS, CHUTE_CLINKS_MS, EXTENDED, PULSE, ROBOT_FIRST_MS, supplyAt } from './startup-timing.js';

/* The film's beats in seconds, from the moment each sound is cued. */
const secs = (ms) => ms / 1000;
const SLIP_S = secs(BEATS.slip - BEATS.contact);
const GATE_S = secs(BEATS.gone - BEATS.contact);
const CLINKS_S = CHUTE_CLINKS_MS.map(secs);
const CREDIT_S = secs(BEATS.credit - BEATS.gone);
const UP_S = secs(BEATS.coinIn);          // lift plays at the press; the coin rises into the light later
const FACE_S = secs(BEATS.align);
const fromRelay = (ms) => secs(ms - BEATS.relay);
const CUT_S = fromRelay(BEATS.cut);

/* The opener's key (rotation.js OPENER, E-flat major): the machine hums in it, so its song is already inside. */
const EB1 = 38.89;
const EB2 = 77.78;

const STARTUP = ['lift', 'contact', 'chute', 'relay', 'power', 'tube'];   // the INSERT COIN film (startup.js)
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
};
/* The film's live models, set against the music (Sketch A): the song is the
   payoff, so it is the loudest thing. Measured at equal Music and Effects
   faders, against the opener: the coin about 20 dB under it, the first try
   15, the heartbeat 12, the lock 8 (DESIGN.md). A custom MP3 keeps its own
   level; the Effects fader and the limiter still apply. */
const FILM_BOOST = { lift: 1.56, contact: 1.56, chute: 1.3, relay: 1.08, power: 1.09, tube: 0.55 };
const activeVoices = new Map();
const RELEASE_SECONDS = 0.014;

/* The machine's interior: one shared hall for the film's voices to send
   into, so the coin's ring hangs in the air, each clink falls further away
   and the relays boom like bulkheads. A generated impulse - noise that
   darkens as it decays over about three seconds - so nothing is fetched.
   On the Effects bus, under the limiter, like everything else. */
const HALL = { seconds: 3.2, rt60: 2.6, predelay: 0.018, level: 0.55 };
let hall = null;
function interior(ctx, bus) {
  if (hall?.ctx === ctx) return hall.input;
  if (!ctx.createConvolver) return null;
  const input = ctx.createGain();
  const conv = ctx.createConvolver();
  const out = ctx.createGain();
  out.gain.value = HALL.level;
  input.connect(conv).connect(out).connect(bus);
  hall = { ctx, input };
  // The first wet sound is over a second after the press (the coin's ring):
  // fill the hall just after the press's own work, not during it.
  setTimeout(() => { conv.buffer = impulse(ctx); }, 0);   // normalised by the browser
  return input;
}

function impulse(ctx) {
  const rate = ctx.sampleRate;
  const n = Math.ceil(rate * HALL.seconds);
  const ir = ctx.createBuffer(2, n, rate);
  // Kept cheap (it is built just after the press): the decays are carried
  // sample to sample by multiplication rather than computed with exp() each time.
  const start = Math.ceil(HALL.predelay * rate);
  const ramp = 0.03 * rate;
  const fade = Math.exp(-6.9 / HALL.rt60 / rate);
  const darken = Math.exp(-1 / (0.5 * rate));
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let low = 0;
    let level = Math.exp((-6.9 * HALL.predelay) / HALL.rt60);
    let bright = 0.75 * Math.exp(-HALL.predelay / 0.5);
    for (let i = start; i < n; i++) {
      low += (0.08 + bright) * (Math.random() * 2 - 1 - low);   // brighter early, darker as it dies
      d[i] = low * level * Math.min(1, (i - start) / ramp);
      level *= fade;
      bright *= darken;
    }
  }
  return ir;
}

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
  const extras = new Set();       // routing made by via(), let go with the voice
  let space = null;               // this voice's send into the interior, following its level
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
          extras.forEach((n) => n.disconnect());
          if (activeVoices.get(name) === voice) activeVoices.delete(name);
        }
      };
    },
    // A voice for things further inside the machine: dry straight out, wet into its interior (interior()).
    via({ dry = 1, wet = 0 }) {
      const input = ctx.createGain();
      const near = ctx.createGain();
      near.gain.value = dry;
      input.connect(near).connect(output);
      extras.add(input).add(near);
      const hall = wet > 0 ? interior(ctx, sfxBus) : null;
      if (hall) {
        if (!space) {
          space = ctx.createGain();
          space.gain.setValueAtTime(level, ctx.currentTime);
          space.connect(hall);
          extras.add(space);
        }
        const far = ctx.createGain();
        far.gain.value = wet;
        input.connect(far).connect(space);
        extras.add(far);
      }
      return { ctx, rate: voice.rate, output: input, track: voice.track };
    },
    louder(k) {                     // the live model, raised to its film level
      level = gain * k;
      output.gain.setValueAtTime(level, ctx.currentTime);
      space?.gain.setValueAtTime(level, ctx.currentTime);
    },
    release() {
      const t = ctx.currentTime;
      output.gain.cancelScheduledValues(t);
      output.gain.setValueAtTime(level, t);
      output.gain.linearRampToValueAtTime(0.0001, t + RELEASE_SECONDS);
      space?.gain.cancelScheduledValues(t);
      space?.gain.setValueAtTime(level, t);
      space?.gain.linearRampToValueAtTime(0.0001, t + RELEASE_SECONDS);
      for (const source of sources) {
        try { source.stop(t + RELEASE_SECONDS); } catch { /* already finished */ }
      }
      if (!sources.size) {
        output.disconnect();
        extras.forEach((n) => n.disconnect());
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

/* The transformer hum from the relay to the cut, its level following SUPPLY
   (the picture's own curve) and its upper partials opening with the voltage. */
const HUM_STEP_MS = 30;
const HUM_PARTIALS = [[EB2, 1, 0], [EB2 * 1.5, 0.55, 1], [EB2 * 2, 0.35, 1], [EB2 * 3, 0.18, 1.5]];   // [Hz, share, how much it needs volts]: root, fifth, octave, twelfth
function supplyHum(voice) {
  const points = [];
  for (let ms = BEATS.relay; ms <= BEATS.cut; ms += HUM_STEP_MS) points.push([fromRelay(ms), supplyAt(ms)]);
  points.push([CUT_S, supplyAt(BEATS.cut)], [CUT_S + 0.03, 0]);   // the cut: it stops dead
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
    // Silence at the press (the machine holds its breath). Then the coin is
    // taken up into the lamp's light, and as it turns its face to the light
    // its rim rings - and the ring hangs, as if the room were far bigger.
    const far = voice.via({ dry: 0.8, wet: 0.75 });
    thump(voice, { freq: 2900, dur: 0.01, peak: 0.04, at: UP_S - 0.05 });
    whoosh(voice, { at: UP_S, dur: 0.6, from: 380, to: 1500, peak: 0.03, q: 1.1 });
    ring(far, { freq: 4100, at: UP_S + 0.2, peak: 0.008, decay: 0.4 });
    ring(far, { freq: 3300, at: FACE_S, peak: 0.012, decay: 1.4 });
  }),

  // Its edge meets the slit and catches - a tick, a gritty scrape - then the
  // gate gives, it slides through, and the gate snaps back behind it.
  contact: effect('contact', (dry) => {
    const voice = dry.via({ dry: 1, wet: 0.2 });
    thump(voice, { freq: 3400, dur: 0.008, peak: 0.11 });
    ring(voice, { freq: 2700, peak: 0.035, decay: 0.3 });
    whoosh(voice, { at: 0.02, dur: SLIP_S * 0.95, from: 5200, to: 3400, peak: 0.03, q: 6, amHz: 70 });   // pressed against the gate
    tone(voice, { freq: 410, to: 360, type: 'triangle', at: 0.16, dur: SLIP_S - 0.12, peak: 0.008 });     // the spring straining
    whoosh(voice, { at: SLIP_S, dur: 0.24, from: 2600, to: 900, peak: 0.05, q: 2 });
    thump(voice, { freq: 1800, dur: 0.015, peak: 0.1, at: GATE_S - 0.03 });
    thump(voice, { freq: 600, dur: 0.04, peak: 0.08, at: GATE_S - 0.025 });
  }),

  // The long fall: each clink further down - lower, quieter, and wetter, as
  // if deeper into the machine than it could possibly be; far below, the
  // coin box; then, close by on the door, the counter ticking over.
  chute: effect('chute', (voice) => {
    if (EXTENDED) whoosh(voice.via({ dry: 1, wet: 0.5 }), { at: 0.05, dur: 0.45, from: 2400, to: 500, peak: 0.03, q: 2.4 });   // the extended cut: through the slit after it
    CLINKS_S.forEach((at, i) => {
      const deep = i / (CLINKS_S.length - 1);
      const v = voice.via({ dry: 1 - 0.85 * deep, wet: 0.25 + 0.75 * deep });
      ring(v, { freq: 1900 - i * 150, at, peak: 0.02 + 0.03 * (1 - deep), decay: 0.2 + i * 0.05 });
      thump(v, { freq: 1500 - i * 120, dur: 0.02, peak: 0.025 + 0.045 * (1 - deep), at });
    });
    const below = voice.via({ dry: 0.3, wet: 1 });
    whoosh(below, { at: CLINKS_S.at(-1) + 0.03, dur: 0.3, from: 900, to: 400, peak: 0.015, q: 3, amHz: 24 });   // rolling to a stop
    thump(below, { freq: 130, dur: 0.18, peak: 0.22, at: CREDIT_S });                                           // the coin box, far below
    thump(below, { freq: 520, dur: 0.05, peak: 0.1, at: CREDIT_S });
    ring(below, { freq: 700, at: CREDIT_S, peak: 0.02, decay: 0.45 });
    thump(voice, { freq: 2600, dur: 0.008, peak: 0.06, at: CREDIT_S + 0.14 });                                  // the counter, on the door
    thump(voice, { freq: 2300, dur: 0.008, peak: 0.05, at: CREDIT_S + 0.2 });
  }),

  // The main relay: contacts, armature, the body of the cabinet booming once.
  relay: effect('relay', (dry) => {
    const voice = dry.via({ dry: 1, wet: 0.65 });   // a bulkhead, booming through the machine
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
    held(voice, { freq: EB1, type: 'sawtooth', filterHz: 240, points: [[gather, 0], [fromRelay(BEATS.almost), 0.05],
      [fromRelay(BEATS.fail), 0.035], [fromRelay(BEATS.fail) + 0.42, 0]] });
    tone(voice, { freq: EB2, to: 27, type: 'sawtooth', at: fromRelay(BEATS.fail), dur: 0.6, peak: 0.04 });     // it dies, winding down like a tape
    whoosh(voice, { at: fromRelay(BEATS.fail), dur: 0.5, from: 1400, to: 160, peak: 0.02, q: 1.4 });
    const inside = voice.via({ dry: 0.5, wet: 0.9 });
    const tick = fromRelay(BEATS.tick);                                                                       // the dark: one tick somewhere inside
    thump(inside, { freq: 2400, dur: 0.006, peak: 0.035, at: tick });
    ring(inside, { freq: 1320, at: tick, peak: 0.006, decay: 0.25 });
    const heavy = voice.via({ dry: 1, wet: 0.65 });
    const relay2 = fromRelay(BEATS.catch);                                                                    // B: the deeper, heavier relay
    thump(heavy, { freq: 1100, dur: 0.02, peak: 0.1, at: relay2 });
    thump(heavy, { freq: 300, dur: 0.07, peak: 0.1, at: relay2 + 0.004 });
    thump(heavy, { freq: 55, dur: 0.5, peak: 0.2, at: relay2 + 0.01 });
    tone(heavy, { freq: 52, to: 36, dur: 0.5, peak: 0.11, at: relay2 });
    ring(heavy, { freq: 160, at: relay2 + 0.01, peak: 0.028, decay: 1.6 });
    const degauss = fromRelay(BEATS.catch + ROBOT_FIRST_MS + 640);   // as the raster opens, after the robot's moment alone
    held(voice, { freq: EB2, type: 'sawtooth', filterHz: 360, points: [[degauss, 0], [degauss + 0.06, 0.06], [degauss + 0.2, 0.018],
      [degauss + 0.36, 0.048], [degauss + 0.56, 0.012], [degauss + 0.76, 0.027], [degauss + 1.3, 0]] });
    thump(voice, { freq: 150, dur: 0.35, peak: 0.09, at: degauss + 0.02 });
    crackle(voice);
    held(voice, { freq: 7800, points: [[degauss, 0], [fromRelay(BEATS.catch + 900), 0.004], [CUT_S, 0.003], [CUT_S + 0.03, 0]] });
    // The heartbeat: a body that sags in pitch as it rings, a sub, a contact.
    // It quickens through the second try, locks to the song's tempo, and
    // thumps for two bars; each beat a little heavier than the last.
    const beats = [...PULSE.heartbeat, ...PULSE.lock];
    beats.forEach((ms, n) => {
      const at = fromRelay(ms);
      const rising = n < PULSE.heartbeat.length;
      const k = rising ? 0.3 + 0.4 * (n / PULSE.heartbeat.length) : 1;   // the heartbeat swells into the lock
      // the extended cut rises through the machine on the heartbeat: the space shortens as we near the surface
      const v = EXTENDED && rising ? voice.via({ dry: 1, wet: 0.7 * (1 - n / PULSE.heartbeat.length) }) : voice;
      tone(v, { freq: EB2 * 1.55, to: EB2, at, dur: 0.16, peak: 0.09 * k });
      tone(v, { freq: EB1, to: EB1 * 0.92, at, dur: 0.32, peak: 0.11 * k });
      thump(v, { freq: 2200, dur: 0.006, peak: 0.035 * k, at });
    });
    if (EXTENDED) whoosh(voice, { at: fromRelay(BEATS.through), dur: 0.4, from: 6500, to: 2200, peak: 0.012, q: 0.8 });   // a hush of glass as we push through the screen
    const lock = fromRelay(BEATS.ignite);                                                                    // it locks: the first beat of the lock
    thump(voice, { freq: 60, dur: 0.45, peak: 0.26, at: lock });
    thump(voice, { freq: 900, dur: 0.03, peak: 0.12, at: lock });
    tone(voice, { freq: EB2, to: EB1, at: lock, dur: 0.5, peak: 0.16 });
    ring(voice, { freq: EB2 * 2, at: lock, peak: 0.03, decay: 1.6 });
    ring(voice, { freq: 1864.66, at: lock + 0.04, peak: 0.022, decay: 0.9 });                             // B-flat, E-flat, G: the lock rings in the song's chord
    tone(voice, { freq: 1244.51, type: 'triangle', at: lock + 0.04, dur: 0.5, peak: 0.018 });
    tone(voice, { freq: 1567.98, type: 'triangle', at: lock + 0.1, dur: 0.45, peak: 0.013 });
    held(voice, { freq: EB1, type: 'sawtooth', filterHz: 180, points: [[lock, 0], [lock + 0.6, 0.045], [CUT_S, 0.04], [CUT_S + 0.03, 0]] });   // the machine standing there, alive, to the cut
  }),

  // One neon letter catching: a short mains buzz and the electrode tick.
  tube: effect('tube', (voice) => {
    thump(voice, { freq: 3200, dur: 0.008, peak: 0.06 });
    held(voice, { freq: 120, type: 'sawtooth', filterHz: 1400, points: [[0.005, 0.03], [0.06, 0.012], [0.09, 0.028], [0.2, 0]] });
  }),

  // Keep the legacy hook without introducing ambient interference during music.
  flicker: effect('flicker'),
};

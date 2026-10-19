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

   Your own recordings: put an MP3 named after the effect in the sfx/
   folder (sfx/coin.mp3, sfx/key.mp3, sfx/confirm.mp3, sfx/whirr.mp3,
   sfx/thud.mp3, sfx/buzz.mp3, sfx/flicker.mp3, sfx/page.mp3) and it plays instead of the
   original WAV. A missing or unreadable MP3 falls back to that WAV,
   then to a quiet live model. See sfx/README.md for the sample source.

   Every effect is wrapped so a sound failure can never stop the music.
   ============================================================ */
import { getEngine } from './audio.js';

export const SFX_NAMES = ['coin', 'key', 'confirm', 'whirr', 'thud', 'buzz', 'flicker', 'page'];
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
};
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
  const { gain: level, variation } = MIX[name];
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
      const formats = name === 'flicker' ? ['mp3'] : ['mp3', 'wav'];
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

const effect = (name, fallback) => (...args) => {
  let voice;
  try {
    if (!buffers.has(name) && !fallback) return;
    voice = createVoice(name);
    if (!voice || playFile(name, voice, name === 'whirr' ? args[0] ?? 0.9 : undefined)) return;
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

  // Keep the legacy hook without introducing ambient interference during music.
  flicker: effect('flicker'),
};

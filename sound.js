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
let fetching = null;

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
function playFile(name, maxSeconds) {
  const buf = buffers.get(name);
  const e = getEngine();
  if (!buf || !e) return false;
  const { ctx, sfxBus } = e;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  src.connect(gain).connect(sfxBus);
  src.start(t);
  if (maxSeconds && buf.duration > maxSeconds) {
    gain.gain.setValueAtTime(1, t + Math.max(0, maxSeconds - 0.12));
    gain.gain.linearRampToValueAtTime(0.0001, t + maxSeconds);
    src.stop(t + maxSeconds + 0.02);
  }
  return true;
}

function tone({ freq, to = freq, type = 'sine', at = 0, dur = 0.15, peak = 0.1 }) {
  const e = getEngine();
  if (!e) return;
  const { ctx, sfxBus } = e;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(sfxBus);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// A short burst of filtered noise: thud-ish when low, tick-ish when high.
function thump({ at = 0, dur = 0.08, peak = 0.5, freq = 1600 }) {
  const e = getEngine();
  if (!e) return;
  const { ctx, sfxBus } = e;
  const t = ctx.currentTime + at;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(sfxBus);
  src.start(t);
  src.stop(t + dur + 0.05);
}

const safe = (fn) => (...args) => {
  try { fn(...args); } catch (err) { console.warn('[sound]', err); }
};

export const sfx = {
  coin: safe(() => {
    if (playFile('coin')) return;
    for (const [at, peak] of [[0, 0.12], [0.065, 0.09], [0.145, 0.10], [0.24, 0.07]]) {
      thump({ freq: 2100, dur: 0.035, peak, at });
    }
    tone({ freq: 2353, at: 0.145, dur: 0.10, peak: 0.025 });
    thump({ freq: 470, dur: 0.055, peak: 0.10, at: 0.28 });
  }),

  key: safe(() => {
    if (playFile('key')) return;
    thump({ freq: 2300, dur: 0.012, peak: 0.13 });
    thump({ freq: 680, dur: 0.035, peak: 0.11, at: 0.008 });
  }),

  confirm: safe(() => {
    if (playFile('confirm')) return;
    thump({ freq: 1000, dur: 0.03, peak: 0.12 });
    thump({ freq: 1450, dur: 0.025, peak: 0.11, at: 0.095 });
    thump({ freq: 700, dur: 0.02, peak: 0.04, at: 0.12 });
  }),

  whirr: safe((seconds = 0.9) => {
    if (playFile('whirr', seconds)) return;
    tone({ freq: 135, to: 180, dur: seconds * 0.55, peak: 0.025 });
    tone({ freq: 180, to: 140, at: seconds * 0.55, dur: seconds * 0.45, peak: 0.023 });
    for (let i = 0; i < 6; i++) thump({ at: (seconds / 6) * i, dur: 0.03, peak: 0.025, freq: 1900 });
  }),

  thud: safe(() => {
    if (playFile('thud')) return;
    thump({ freq: 850, dur: 0.035, peak: 0.065 });
    thump({ freq: 1700, dur: 0.015, peak: 0.015, at: 0.025 });
  }),

  buzz: safe(() => {
    if (playFile('buzz')) return;
    thump({ freq: 370, dur: 0.065, peak: 0.12 });
    thump({ freq: 370, dur: 0.065, peak: 0.10, at: 0.13 });
  }),

  page: safe(() => {
    if (playFile('page')) return;
    thump({ freq: 1600, dur: 0.025, peak: 0.10 });
    thump({ freq: 530, dur: 0.045, peak: 0.13, at: 0.20 });
    thump({ freq: 2100, dur: 0.015, peak: 0.035, at: 0.23 });
  }),

  // Keep the legacy hook without introducing ambient interference during music.
  flicker: safe(() => { playFile('flicker'); }),
};

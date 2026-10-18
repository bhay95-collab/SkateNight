/* ============================================================
   SOUND - the machine's own noises, synthesised live with the Web
   Audio API (ported from trivia's sound.js), unless a recording is
   supplied (below).

   One sound per moment - do not reuse one for something else:
     coin     a coin dropping in the slot (clunk + ring)
     key      a keypad button press (short square beep)
     confirm  a song was added to the queue (two quick rising notes)
     whirr    the record mechanism moving (gear sweep)
     thud     the needle dropping onto the record
     buzz     something is OUT OF ORDER / refused (low rude buzz)
     flicker  the screen dipping (a faint electrical crackle)
     page     the rack's album page flipping over (a mechanical clack)

   Your own recordings: put an MP3 named after the effect in the sfx/
   folder (sfx/coin.mp3, sfx/key.mp3, sfx/confirm.mp3, sfx/whirr.mp3,
   sfx/thud.mp3, sfx/buzz.mp3, sfx/flicker.mp3, sfx/page.mp3) and it plays instead of the
   built-in sound.
   Any effect without a file keeps the built-in one.

   Every effect is wrapped so a sound failure can never stop the music.
   ============================================================ */
import { getEngine } from './audio.js';

export const SFX_NAMES = ['coin', 'key', 'confirm', 'whirr', 'thud', 'buzz', 'flicker', 'page'];
const rawFiles = new Map();      // name -> the MP3's bytes (fetched at page load)
const buffers = new Map();       // name -> decoded sound, ready to play
let fetching = null;

/* Fetch any sfx/ files at page load (no sound card needed yet). */
export function preloadSfxFiles() {
  if (!fetching) {
    fetching = Promise.all(SFX_NAMES.map(async (name) => {
      try {
        const res = await fetch(`sfx/${name}.mp3`);
        if (res.ok) rawFiles.set(name, await res.arrayBuffer());
      } catch { /* no file - the built-in sound is used */ }
    }));
  }
  return fetching;
}

/* Decode them once the sound engine exists (after the first click). */
export async function decodeSfxFiles() {
  const e = getEngine();
  if (!e) return;
  await preloadSfxFiles();
  await Promise.all([...rawFiles].map(async ([name, bytes]) => {
    if (buffers.has(name)) return;
    try {
      buffers.set(name, await e.ctx.decodeAudioData(bytes.slice(0)));
    } catch (err) {
      console.warn(`[sound] sfx/${name}.mp3 could not be read - using the built-in sound`, err);
    }
  }));
}

/* Which effects are using a recording (for checking a new file worked). */
export const recordedSfx = () => [...buffers.keys()];

/* Play a recorded effect if there is one. maxSeconds trims a long file
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

function tone({ freq, to = freq, type = 'square', at = 0, dur = 0.15, peak = 0.4 }) {
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
    thump({ freq: 260, dur: 0.12, peak: 0.55 });                  // the clunk down the chute
    tone({ freq: 92, to: 55, type: 'sine', dur: 0.2, peak: 0.5, at: 0.02 });
    tone({ freq: 1568, type: 'sine', at: 0.14, dur: 0.35, peak: 0.22 });   // the ring
    tone({ freq: 2349, type: 'sine', at: 0.14, dur: 0.3, peak: 0.1 });
  }),

  key: safe(() => {
    if (playFile('key')) return;
    thump({ freq: 2600, dur: 0.018, peak: 0.32 });                  // the switch contact
    thump({ freq: 520, dur: 0.05, peak: 0.26, at: 0.008 });         // the key bottoming out
    tone({ freq: 1320, to: 1100, type: 'square', dur: 0.04, peak: 0.06, at: 0.01 });
  }),

  confirm: safe(() => {
    if (playFile('confirm')) return;
    tone({ freq: 659, type: 'square', dur: 0.09, peak: 0.2 });
    tone({ freq: 988, type: 'square', at: 0.09, dur: 0.16, peak: 0.2 });
  }),

  whirr: safe((seconds = 0.9) => {
    if (playFile('whirr', seconds)) return;
    tone({ freq: 90, to: 260, type: 'sawtooth', dur: seconds * 0.55, peak: 0.07 });
    tone({ freq: 260, to: 110, type: 'sawtooth', at: seconds * 0.55, dur: seconds * 0.45, peak: 0.06 });
    for (let i = 0; i < 6; i++) thump({ at: (seconds / 6) * i, dur: 0.03, peak: 0.07, freq: 3200 });
  }),

  thud: safe(() => {
    if (playFile('thud')) return;
    thump({ freq: 150, dur: 0.16, peak: 0.7 });
    tone({ freq: 80, to: 42, type: 'sine', dur: 0.24, peak: 0.6 });
    thump({ freq: 5200, dur: 0.02, peak: 0.12, at: 0.05 });       // a hint of crackle as the needle lands
  }),

  buzz: safe(() => {
    if (playFile('buzz')) return;
    tone({ freq: 120, to: 54, type: 'sawtooth', dur: 0.32, peak: 0.3 });
    tone({ freq: 62, to: 44, type: 'square', dur: 0.32, peak: 0.2 });
  }),

  page: safe(() => {
    if (playFile('page')) return;
    thump({ freq: 1800, dur: 0.03, peak: 0.22 });                   // the catch releasing
    thump({ freq: 380, dur: 0.07, peak: 0.24, at: 0.16 });          // the page landing
    thump({ freq: 4200, dur: 0.02, peak: 0.08, at: 0.17 });
  }),

  // Quiet on purpose: the room should half-notice it, never be startled.
  flicker: safe((dipStartsMs = [0]) => {
    if (playFile('flicker')) return;
    for (const ms of dipStartsMs) {
      const at = ms / 1000;
      thump({ freq: 3400, dur: 0.035, peak: 0.07, at });                          // the spark
      tone({ freq: 118, to: 96, type: 'sawtooth', dur: 0.14, peak: 0.035, at });  // mains hum sagging
      thump({ freq: 900, dur: 0.06, peak: 0.04, at: at + 0.03 });
    }
  }),
};

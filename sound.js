/* ============================================================
   SOUND - the machine's own noises, all synthesised live with the
   Web Audio API (ported from trivia's sound.js). No audio files, no
   licences, no loading.

   One sound per moment - do not reuse one for something else:
     coin     a coin dropping in the slot (clunk + ring)
     key      a keypad button press (short square beep)
     confirm  a song was added to the queue (two quick rising notes)
     whirr    the record mechanism moving (gear sweep)
     thud     the needle dropping onto the record
     buzz     something is OUT OF ORDER / refused (low rude buzz)

   Every effect is wrapped so a sound failure can never stop the music.
   ============================================================ */
import { getEngine } from './audio.js';

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
    thump({ freq: 260, dur: 0.12, peak: 0.55 });                  // the clunk down the chute
    tone({ freq: 92, to: 55, type: 'sine', dur: 0.2, peak: 0.5, at: 0.02 });
    tone({ freq: 1568, type: 'sine', at: 0.14, dur: 0.35, peak: 0.22 });   // the ring
    tone({ freq: 2349, type: 'sine', at: 0.14, dur: 0.3, peak: 0.1 });
  }),

  key: safe(() => {
    tone({ freq: 1320, to: 1100, type: 'square', dur: 0.06, peak: 0.16 });
  }),

  confirm: safe(() => {
    tone({ freq: 659, type: 'square', dur: 0.09, peak: 0.2 });
    tone({ freq: 988, type: 'square', at: 0.09, dur: 0.16, peak: 0.2 });
  }),

  whirr: safe((seconds = 0.9) => {
    tone({ freq: 90, to: 260, type: 'sawtooth', dur: seconds * 0.55, peak: 0.07 });
    tone({ freq: 260, to: 110, type: 'sawtooth', at: seconds * 0.55, dur: seconds * 0.45, peak: 0.06 });
    for (let i = 0; i < 6; i++) thump({ at: (seconds / 6) * i, dur: 0.03, peak: 0.07, freq: 3200 });
  }),

  thud: safe(() => {
    thump({ freq: 150, dur: 0.16, peak: 0.7 });
    tone({ freq: 80, to: 42, type: 'sine', dur: 0.24, peak: 0.6 });
    thump({ freq: 5200, dur: 0.02, peak: 0.12, at: 0.05 });       // a hint of crackle as the needle lands
  }),

  buzz: safe(() => {
    tone({ freq: 120, to: 54, type: 'sawtooth', dur: 0.32, peak: 0.3 });
    tone({ freq: 62, to: 44, type: 'square', dur: 0.32, peak: 0.2 });
  }),
};

/* A played-in 45: a soft hiss bed that swells once per turn, warm crackle
   in small clusters, the odd single pop, and a needle drop (contact click,
   felt thump, groove scrape). Original synthesis, no downloaded samples.
   The texture has its own record bus beside the music, so it carries on
   through a song's closing fade (the run-out groove) and plays the lead-in
   groove before the music. EFFECTS is its master, with an independent
   VINYL trim for the record texture alone; MUSIC does not touch it. */
import { getLevels } from './audio.js';
import { perceptualVolume } from './format.js';

const surfaces = new WeakMap();
const ROTATION_SECONDS = 60 / 45;               // a 45 rpm single
const SURFACE_SECONDS = ROTATION_SECONDS * 10;  // long loop: no short repeating crackle
const SCRATCH_SECONDS = 0.32;
const HISS_RMS = 0.0055;                        // about -45 dBFS: clear in quiet passages and gaps

// A repeatable source makes level measurements and regression checks useful.
function noise(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
}

// One-pole filter coefficient for a cutoff in Hz.
const pole = (hz, rate) => 1 - Math.exp(-2 * Math.PI * Math.min(hz, rate * 0.45) / rate);

// A damped ring added into data. cos starts sharp (a crackle edge); sin starts
// at zero (a soft thump).
function ring(data, rate, at, { peak, hz, decay, shape = Math.cos }) {
  const start = Math.floor(at * rate);
  const length = Math.min(data.length - start, Math.ceil(rate * decay * 7));
  for (let j = 0; j < length; j++) {
    const t = j / rate;
    data[start + j] += peak * shape(2 * Math.PI * hz * t) * Math.exp(-t / decay);
  }
}

function removeOffset(data) {
  let sum = 0;
  for (const sample of data) sum += sample;
  const mean = sum / data.length;
  for (let i = 0; i < data.length; i++) data[i] -= mean;
}

export function createVinylBuffers(ctx) {
  if (surfaces.has(ctx)) return surfaces.get(ctx);
  const rate = ctx.sampleRate;
  const random = noise(1985);
  const unit = () => (random() + 1) / 2;
  const sign = () => (random() < 0 ? -1 : 1);

  const surface = ctx.createBuffer(1, Math.ceil(rate * SURFACE_SECONDS), rate);
  const data = surface.getChannelData(0);

  // Hiss: groove friction between 350 Hz and 6.5 kHz, no mains hum.
  const lowRate = pole(6500, rate);
  const highRate = pole(350, rate);
  let low = 0;
  let high = 0;
  let squares = 0;
  for (let i = 0; i < data.length; i++) {
    low += lowRate * (random() - low);
    high += highRate * (low - high);
    data[i] = low - high;
    squares += data[i] * data[i];
  }
  const scale = HISS_RMS / Math.sqrt(squares / data.length);
  for (let i = 0; i < data.length; i++) {
    // A worn record breathes a little louder once every turn.
    data[i] *= scale * (1 + 0.18 * Math.sin(2 * Math.PI * (i / rate) / ROTATION_SECONDS));
  }

  // Crackle: many tiny dust ticks, mostly faint, some in short clusters.
  const end = SURFACE_SECONDS - 0.03;
  for (let at = 0.02; at < end; at += 0.005 + unit() * 0.07) {
    const peak = 0.004 + 0.035 * unit() ** 5;
    ring(data, rate, at, { peak: sign() * peak, hz: 2500 + unit() * 3500, decay: 0.00012 + unit() * 0.00025 });
    if (unit() < 0.3) {
      for (let k = 0, n = 1 + Math.floor(unit() * 3); k < n; k++) {
        const follow = at + 0.003 + unit() * 0.02;
        if (follow < end) ring(data, rate, follow, { peak: sign() * peak * 0.5, hz: 3000 + unit() * 3000, decay: 0.00015 });
      }
    }
  }
  // Pops: a single bigger speck every few seconds, never on a beat.
  for (let at = 0.8 + unit(); at < end; at += 1.4 + unit() * 3.2) {
    const s = sign();
    const peak = 0.06 + unit() * 0.06;
    ring(data, rate, at, { peak: s * peak, hz: 700 + unit() * 900, decay: 0.0006 });
    ring(data, rate, at, { peak: s * peak * 0.5, hz: 160 + unit() * 80, decay: 0.003, shape: Math.sin });
  }
  removeOffset(data);
  // Smooth the loop seam without a silence hole or recurrent fade.
  const seam = Math.ceil(rate * 0.015);
  for (let i = 0; i < seam; i++) {
    const mix = i / seam;
    data[data.length - seam + i] = data[data.length - seam + i] * (1 - mix) + data[i] * mix;
  }

  // Needle drop: contact click and felt thump, a scrape as the stylus finds
  // the groove, and a burst of lead-in dust.
  const scratch = ctx.createBuffer(1, Math.ceil(rate * SCRATCH_SECONDS), rate);
  const scrape = scratch.getChannelData(0);
  const contact = 0.004;
  ring(scrape, rate, contact, { peak: 0.08, hz: 2200, decay: 0.00025, shape: Math.sin });
  ring(scrape, rate, contact, { peak: 0.07, hz: 95, decay: 0.025, shape: Math.sin });
  let smooth = 0;
  let bass = 0;
  for (let i = 0; i < scrape.length; i++) {
    const t = i / rate;
    const progress = t / SCRATCH_SECONDS;
    smooth += pole(4200 - 2700 * progress, rate) * (random() - smooth);
    bass += pole(400, rate) * (smooth - bass);
    const after = Math.max(0, t - contact);
    // A textured brush settling into the groove, not a DJ backspin.
    const envelope = (1 - Math.exp(-after / 0.012)) * Math.exp(-after / 0.09);
    const grain = 0.7 + 0.3 * Math.sin(2 * Math.PI * (42 * t + 90 * t * t));
    scrape[i] += (smooth - bass) * envelope * grain * 0.3;
  }
  for (let k = 0; k < 9; k++) {
    const at = contact + 0.01 + unit() * 0.18;
    ring(scrape, rate, at, { peak: sign() * (0.01 + unit() * 0.03), hz: 2500 + unit() * 3000, decay: 0.0002 });
  }
  removeOffset(scrape);
  // Silent first and last samples: no click from the buffer edges themselves.
  const edge = Math.ceil(rate * 0.003);
  const tail = Math.ceil(rate * 0.03);
  for (let i = 0; i < edge; i++) scrape[i] *= i / edge;
  for (let i = 0; i < tail; i++) scrape[scrape.length - 1 - i] *= i / tail;

  const result = { surface, scratch };
  surfaces.set(ctx, result);
  return result;
}

export function createVinylSurface(ctx, destination) {
  // Lazy allocation: probing/preloading audio must not generate or play texture.
  let buffers;
  let surface = null;
  let scrape = null;
  let failed = false;
  const voices = new Set();
  const safe = (action) => {
    if (failed) return;
    try { action(); } catch (error) {
      failed = true;
      for (const voice of voices) {
        try { voice.source.stop(); } catch { /* already ended */ }
        try { voice.source.disconnect(); } catch { /* damaged graph */ }
        try { voice.gain.disconnect(); } catch { /* damaged graph */ }
      }
      voices.clear();
      surface = scrape = null;
      console.warn('[vinyl] texture unavailable; music continues', error);
    }
  };
  function voice(buffer, loop) {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const entry = { source, gain, releasing: false };
    voices.add(entry);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    const { sfx, vinyl } = getLevels();
    gain.gain.linearRampToValueAtTime(perceptualVolume(sfx * vinyl), ctx.currentTime + 0.025);
    source.buffer = buffer;
    source.loop = loop;
    if (loop) source.loopStart = 0.015; // end crossfade joins the following sample here
    source.connect(gain).connect(destination);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      voices.delete(entry);
      if (surface === entry) surface = null;
      if (scrape === entry) scrape = null;
    };
    source.start(ctx.currentTime, loop ? 0.015 + Math.random() * (buffer.duration - 0.015) : 0);
    return entry;
  }
  function release(entry) {
    if (!entry || entry.releasing) return;
    entry.releasing = true;
    const t = ctx.currentTime;
    entry.gain.gain.cancelScheduledValues(t);
    entry.gain.gain.setValueAtTime(entry.gain.gain.value, t);
    entry.gain.gain.linearRampToValueAtTime(0, t + 0.035);
    entry.source.stop(t + 0.04);
  }
  function scratch() {
    buffers ||= createVinylBuffers(ctx);
    release(scrape);
    scrape = voice(buffers.scratch, false);
  }
  return {
    start({ needle = false } = {}) {
      safe(() => {
        buffers ||= createVinylBuffers(ctx);
        if (!surface) surface = voice(buffers.surface, true);
        if (needle) scratch();
      });
    },
    scratch() { safe(scratch); },
    stop() {
      safe(() => {
        release(surface);
        release(scrape);
        surface = scrape = null;
      });
    },
    setLevel(level) {
      safe(() => {
        for (const entry of voices) {
          if (!entry.releasing) {
            const gain = entry.gain.gain;
            const t = ctx.currentTime;
            const current = gain.value;
            // Replace an in-flight attack too: a future ramp must never bring
            // texture back after the listener has muted EFFECTS or VINYL.
            gain.cancelScheduledValues(t);
            gain.setValueAtTime(current, t);
            gain.setTargetAtTime(perceptualVolume(level), t, 0.03);
          }
        }
      });
    },
  };
}

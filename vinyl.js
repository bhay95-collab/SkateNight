/* A clean, lightly worn record: soft groove noise, sparse tiny dust contacts,
   and a short needle settling scrape. Original synthesis, no downloaded samples.
   The surface follows the deck gain and MUSIC fader; EFFECTS scales it too. */
import { getLevels } from './audio.js';
import { perceptualVolume } from './format.js';

const surfaces = new WeakMap();
const SCRATCH_SECONDS = 0.24;
const SURFACE_SECONDS = 13.37; // no short, once-per-revolution repeating crackle

// A repeatable source makes level measurements and regression checks useful.
function noise(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
}

export function createVinylBuffers(ctx) {
  if (surfaces.has(ctx)) return surfaces.get(ctx);
  const rate = ctx.sampleRate;
  const random = noise(1985);
  const surface = ctx.createBuffer(1, Math.ceil(rate * SURFACE_SECONDS), rate);
  const data = surface.getChannelData(0);
  const frictionRate = 1 - Math.exp(-2 * Math.PI * 2400 / rate);
  const rumbleRate = 1 - Math.exp(-2 * Math.PI * 180 / rate);
  let low = 0;
  let rumble = 0;
  for (let i = 0; i < data.length; i++) {
    const white = random();
    low += frictionRate * (white - low);
    rumble += rumbleRate * (low - rumble);
    // Band-limited groove friction, not broadband white hiss or mains hum.
    data[i] = (low - rumble) * 0.005;
  }
  // Soft, irregular dust contacts; no loud pops and no rhythmic click loop.
  for (let at = 0.21; at < SURFACE_SECONDS - 0.03; at += 0.3 + (random() + 1) * 0.8) {
    const start = Math.floor(at * rate);
    const length = Math.ceil(rate * 0.008);
    const peak = 0.0015 + (random() + 1) * 0.001;
    for (let j = 0; j < length; j++) {
      const t = j / rate;
      data[start + j] += peak * Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-t / 0.0012);
    }
  }
  // Smooth the loop seam without a silence hole or recurrent fade.
  const seam = Math.ceil(rate * 0.015);
  for (let i = 0; i < seam; i++) {
    const mix = i / seam;
    data[data.length - seam + i] = data[data.length - seam + i] * (1 - mix) + data[i] * mix;
  }

  const scratch = ctx.createBuffer(1, Math.ceil(rate * SCRATCH_SECONDS), rate);
  const scrape = scratch.getChannelData(0);
  let smooth = 0;
  let bass = 0;
  for (let i = 0; i < scrape.length; i++) {
    const t = i / rate;
    const progress = t / SCRATCH_SECONDS;
    const cutoff = 3800 - 2600 * progress;
    smooth += (1 - Math.exp(-2 * Math.PI * cutoff / rate)) * (random() - smooth);
    bass += (1 - Math.exp(-2 * Math.PI * 450 / rate)) * (smooth - bass);
    // A short textured brush settling into the groove, not a DJ backspin.
    const envelope = Math.sin(Math.PI * progress) ** 2 * Math.exp(-progress * 3);
    const grain = 0.7 + 0.3 * Math.sin(2 * Math.PI * (42 * t + 90 * t * t));
    scrape[i] = (smooth - bass) * envelope * grain * 0.22;
  }
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
    gain.gain.linearRampToValueAtTime(perceptualVolume(getLevels().sfx), ctx.currentTime + 0.025);
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
            // texture back after the listener has muted EFFECTS.
            gain.cancelScheduledValues(t);
            gain.setValueAtTime(current, t);
            gain.setTargetAtTime(perceptualVolume(level), t, 0.03);
          }
        }
      });
    },
  };
}

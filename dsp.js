/* ============================================================
   DSP - the small bits of number-crunching behind the audio-reactive
   visuals. Pure functions so they can be tested in Node.

   PHOTOSENSITIVE SAFETY lives here. Anything that reacts to the music
   goes through an envelope (smooths it) and a beat gate (caps it at 3
   pulses a second), so a fast drum pattern can never become a strobe.
   See DESIGN.md "Safety rules".
   ============================================================ */

/* Squash a spectrum (bytes 0-255, low pitch first) into `count` bars of
   0..1, spaced so bass gets as much room as treble (like our ears).
   maxBin stops the bars at that bin: MP3s carry almost nothing above
   about 15 kHz, so bars past it would only ever sit flat. */
export function groupBands(freq, count, { minBin = 1, maxBin = Infinity } = {}) {
  const bars = new Array(Math.max(0, count)).fill(0);
  const n = Math.min(freq.length, Math.max(1, Math.floor(maxBin)));
  if (n === 0 || count <= 0) return bars;
  if (n === 1) {
    bars[0] = freq[0] / 255;
    return bars;
  }
  const base = Math.max(1, Math.min(minBin, n - 1));
  let start = base;
  for (let i = 0; i < count; i++) {
    if (start >= n) break;
    const ideal = i === count - 1 ? n : Math.round(base * Math.pow(n / base, (i + 1) / count));
    const end = Math.min(n, Math.max(start + 1, ideal));
    let sum = 0;
    for (let b = start; b < end; b++) sum += freq[b];
    bars[i] = sum / (end - start) / 255;
    start = end;
  }
  return bars;
}

/* Loudness 0..1 from a time-domain snapshot (bytes centred on 128). */
export function rmsFromTimeDomain(bytes) {
  const n = bytes.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = (bytes[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / n));
}

/* Same, from the analyser's float samples (-1..1): finer than 8-bit bytes,
   which matters for the quiet passages a VU needle should still show. */
export function rmsFromFloat(samples) {
  const n = samples.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += samples[i] * samples[i];
  return Math.min(1, Math.sqrt(sum / n));
}

/* Where a VU needle sits (0 = far left, 1 = pinned right) for a loudness.
   Read on a decibel scale like a real meter, with the MUSIC slider taken back
   out (the analyser listens after it), so the needles swing the same at any
   volume. Typical mastered songs average about -18 dBFS: that lands near the
   middle of the scale, and the loud beats push into the red. */
export const VU_FLOOR_DB = -30;
export const VU_TOP_DB = -12;
export function vuLevel(rms, busGain = 1) {
  const level = rms / Math.max(busGain, 0.05);
  if (!(level > 0)) return 0;
  const db = 20 * Math.log10(level);
  return Math.min(1, Math.max(0, (db - VU_FLOOR_DB) / (VU_TOP_DB - VU_FLOOR_DB)));
}

/* How the logo's halo and the logo itself answer the music. pulse is the
   smoothed kick (0..1, already capped at 3 a second by the beat gate). The
   halo follows the BEAT ONLY - loudness ripples would add extra up-and-down
   moves and break the 3-a-second rule - so it can never move faster than the
   gate allows. It never goes dark (rests at 34%) or past 86%, and the logo
   swells at most 4.5% - a soft swell, never a flash. */
export function logoGlow(pulse) {
  const p = Math.min(1, Math.max(0, pulse || 0));
  return {
    haloOpacity: 0.34 + 0.52 * p,
    haloScale: 0.94 + 0.18 * p,
    logoScale: 1 + 0.045 * p,
  };
}

/* A follower that rises quickly and falls slowly, like a VU meter. */
export function createEnvelope({ attackMs, releaseMs }) {
  let value = 0;
  return {
    step(target, dtMs) {
      const tau = target > value ? attackMs : releaseMs;
      const k = 1 - Math.exp(-dtMs / tau);
      value += (target - value) * k;
      value = Math.min(1, Math.max(0, value));
      return value;
    },
    get value() { return value; },
  };
}

/* Finds the beat in a stream of bass loudness readings (one per frame).
   A beat is a reading well above the recent average: ratio 1.15 over a
   0.4 s average, and above a small floor so silence never fires. Tuned on the
   real songs: about one beat per drum hit, 1.2 - 1.8 a second. Pass the
   level with the volume slider already divided out. The caller still puts
   the result through the 340 ms beat gate (at most 3 a second). */
export function createBeatDetector({ avgSeconds = 0.4, ratio = 1.15, floor = 0.01, minGapMs = 340 } = {}) {
  let avg = 0;
  let last = -Infinity;
  return {
    step(level, nowMs, dtMs = 33) {
      const l = Math.max(0, level || 0);
      const k = Math.min(1, dtMs / 1000 / avgSeconds);
      avg = avg > 0 ? avg + (l - avg) * k : l;
      if (l > floor && l > avg * ratio && nowMs - last >= minGapMs) { last = nowMs; return true; }
      return false;
    },
  };
}

/* Lets a pulse through only if enough time has passed since the last one.
   340 ms gap = at most 3 pulses in any second (WCAG 2.3.1). */
export function createBeatGate({ minGapMs = 340 } = {}) {
  let last = -Infinity;
  return {
    trigger(nowMs) {
      if (nowMs - last < minGapMs) return false;
      last = nowMs;
      return true;
    },
  };
}

/* Move `current` toward `target` by at most `maxDelta`. */
export function slewTo(current, target, maxDelta) {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

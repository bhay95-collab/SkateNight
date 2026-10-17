/* ============================================================
   DSP - the small bits of number-crunching behind the audio-reactive
   visuals. Pure functions so they can be tested in Node.

   PHOTOSENSITIVE SAFETY lives here. Anything that reacts to the music
   goes through an envelope (smooths it) and a beat gate (caps it at 3
   pulses a second), so a fast drum pattern can never become a strobe.
   See DESIGN.md "Safety rules".
   ============================================================ */

/* Squash a spectrum (bytes 0-255, low pitch first) into `count` bars of
   0..1, spaced so bass gets as much room as treble (like our ears). */
export function groupBands(freq, count, { minBin = 1 } = {}) {
  const bars = new Array(Math.max(0, count)).fill(0);
  const n = freq.length;
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

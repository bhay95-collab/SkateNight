/* ============================================================
   FORMAT - small pure helpers for the LED digits and sliders.
   ============================================================ */

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const pad2 = (n) => String(n).padStart(2, '0');

/* 195 -> "03:15". Unknown lengths show dashes so the screen never says NaN. */
export function formatClock(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '--:--';
  const whole = Math.floor(Math.max(0, seconds));
  return `${pad2(Math.floor(whole / 60))}:${pad2(whole % 60)}`;
}

/* Time left, shown with a minus sign: "-01:12". Rounds up so the elapsed
   and remaining readouts always add up to the full length. */
export function formatCountdown(elapsed, total) {
  if (typeof total !== 'number' || !Number.isFinite(total)) return '--:--';
  const left = Math.max(0, total - (Number.isFinite(elapsed) ? elapsed : 0));
  return `-${formatClock(Math.ceil(left))}`;
}

/* Slider position (0 to 1) -> speaker gain. Squared so the bottom half of
   the slider is gentle; loudness is judged by ear, not by maths. */
export function perceptualVolume(v) {
  const x = clamp(Number.isFinite(v) ? v : 0, 0, 1);
  return x * x;
}

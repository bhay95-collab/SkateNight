/* ============================================================
   CAROUSEL - the record magazine, seen from above: every song's record
   stands on edge in a ring around the platter, like looking down into a
   Wurlitzer. To play a song the ring turns until that record reaches the
   gripper (9 o'clock, facing the sleeve), and the record swings out of
   the ring onto the platter (mechanism.js runs the moves).

   The maths is pure and tested; drawCarousel paints the ring once onto a
   canvas, and turning it is a plain CSS rotation of that canvas.
   ============================================================ */
export const PICK_DEG = 270;        // the gripper: 9 o'clock (0 = 12 o'clock, clockwise)
export const MIN_TURN_DEG = 45;     // always turn at least this far, so the move reads

export const slotAngle = (index, count) => (count > 0 ? (360 / count) * index : 0);

/* The ring's next rotation: turning clockwise only (a real carousel has one
   motor direction), so record `index` lands at the gripper. */
export function carouselTarget(currentDeg, index, count) {
  if (count <= 0 || index < 0) return currentDeg;
  const want = PICK_DEG - slotAngle(index, count);
  let delta = (((want - currentDeg) % 360) + 360) % 360;
  if (delta < MIN_TURN_DEG) delta += 360;
  return currentDeg + delta;
}

/* Paint the ring. records = one accent name per song (in tracks.js order);
   gap = the index of a record that is out on the platter (-1 for none). */
export function drawCarousel(canvas, records, gap = -1) {
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 4) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.round(rect.width * dpr);
  if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
  const c = canvas.getContext('2d');
  const half = size / 2;
  const inner = half * 0.885;
  const outer = half * 0.985;
  const css = getComputedStyle(document.documentElement);
  const accent = (name) => css.getPropertyValue(`--sl-${name}`).trim() || '#D09A25';

  c.clearRect(0, 0, size, size);
  c.lineCap = 'round';
  // the rail the records stand in
  c.strokeStyle = 'rgba(169,140,196,.22)';
  c.lineWidth = Math.max(1, half * 0.012);
  c.beginPath(); c.arc(half, half, inner - half * 0.012, 0, Math.PI * 2); c.stroke();

  const thick = Math.max(1.5, Math.min(half * 0.04, ((2 * Math.PI * inner) / Math.max(records.length, 1)) * 0.42));
  records.forEach((acc, i) => {
    if (i === gap) return;
    const a = (slotAngle(i, records.length) * Math.PI) / 180;
    const sx = Math.sin(a);
    const sy = -Math.cos(a);
    const line = (r1, r2, style, width) => {
      c.strokeStyle = style; c.lineWidth = width;
      c.beginPath(); c.moveTo(half + sx * r1, half + sy * r1); c.lineTo(half + sx * r2, half + sy * r2); c.stroke();
    };
    line(inner, outer, '#3A2F48', thick + Math.max(1, dpr));     // the record's edge catching the light
    line(inner, outer, '#0D0912', thick);                        // black vinyl
    line(outer - (outer - inner) * 0.34, outer, accent(acc), thick * 0.7);   // its label colour, peeking out
  });
}

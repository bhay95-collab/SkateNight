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
  if (!c) return;
  const half = size / 2;
  const inner = half * 0.835;                // just under the platter's rim
  const outer = half * 0.978;
  const css = getComputedStyle(document.documentElement);
  const accent = (name) => css.getPropertyValue(`--sl-${name}`).trim() || '#D09A25';
  const circle = (r, style, width) => {
    c.strokeStyle = style; c.lineWidth = width;
    c.beginPath(); c.arc(half, half, r, 0, Math.PI * 2); c.stroke();
  };

  c.clearRect(0, 0, size, size);
  // A recessed cast-metal magazine, rather than records floating in the
  // window. These details are painted only when its size or contents change;
  // the complete assembly still turns as a single compositor-layer canvas.
  const cradle = c.createRadialGradient(half, half, inner, half, half, outer);
  cradle.addColorStop(0, '#090B10');
  cradle.addColorStop(0.2, '#282A30');
  cradle.addColorStop(0.78, '#13151A');
  cradle.addColorStop(1, '#050609');
  circle((inner + outer) / 2, cradle, outer - inner);

  const steel = c.createLinearGradient(0, 0, size * 0.7, size);
  steel.addColorStop(0, '#62666E');
  steel.addColorStop(0.23, '#DADBD4');
  steel.addColorStop(0.34, '#686E77');
  steel.addColorStop(0.67, '#242831');
  steel.addColorStop(0.85, '#B1B1A8');
  steel.addColorStop(1, '#474B53');
  circle(outer, '#050609', half * 0.036);
  circle(outer, steel, half * 0.022);
  circle(outer - half * 0.019, '#090B10', Math.max(1, dpr));
  circle(inner, steel, half * 0.019);

  const pitch = (2 * Math.PI * inner) / Math.max(records.length, 1);
  const thick = Math.max(2, Math.min(half * 0.065, pitch * 0.45));
  records.forEach((acc, i) => {
    const a = (slotAngle(i, records.length) * Math.PI) / 180;
    const sx = Math.sin(a);
    const sy = -Math.cos(a);
    const line = (r1, r2, style, width) => {
      c.strokeStyle = style; c.lineWidth = width;
      c.beginPath(); c.moveTo(half + sx * r1, half + sy * r1); c.lineTo(half + sx * r2, half + sy * r2); c.stroke();
    };
    c.lineCap = 'butt';
    line(inner + half * 0.008, outer - half * 0.018, '#050608', thick + half * 0.023);
    line(inner + half * 0.012, outer - half * 0.022, '#4E535B', Math.max(1, dpr * 0.7));
    if (i === gap) return;     // its empty metal cradle remains visible
    c.lineCap = 'round';
    line(inner + half * 0.014, outer - half * 0.025, '#777B80', thick + Math.max(1, dpr));
    line(inner + half * 0.014, outer - half * 0.025, '#0A0B0E', thick);
    // Only a narrow coloured index tab protrudes beyond the vinyl edge.
    line(outer - half * 0.052, outer - half * 0.028, accent(acc), thick * 0.68);
  });

  // Small slotted fasteners anchor the magazine rim. They turn with it,
  // making the final indexing movement readable even with a large library.
  c.lineCap = 'butt';
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 + 15) * Math.PI) / 180;
    const x = half + Math.sin(a) * (outer - half * 0.003);
    const y = half - Math.cos(a) * (outer - half * 0.003);
    c.fillStyle = '#C1C2BA';
    c.beginPath(); c.arc(x, y, Math.max(1.2, half * 0.009), 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#363A43'; c.lineWidth = Math.max(0.8, dpr * 0.55);
    c.beginPath(); c.moveTo(x - half * 0.006, y); c.lineTo(x + half * 0.006, y); c.stroke();
  }
}

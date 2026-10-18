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
  const inner = half * 0.83;                 // just under the platter's rim
  const outer = half * 0.975;
  const css = getComputedStyle(document.documentElement);
  const accent = (name) => css.getPropertyValue(`--sl-${name}`).trim() || '#D09A25';
  const circle = (radius, style, width) => {
    c.strokeStyle = style; c.lineWidth = width;
    c.beginPath(); c.arc(half, half, radius, 0, Math.PI * 2); c.stroke();
  };
  const box = (x, y, width, height, radius) => {
    const r = Math.min(radius, width / 2, height / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + width - r, y);
    c.quadraticCurveTo(x + width, y, x + width, y + r);
    c.lineTo(x + width, y + height - r);
    c.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    c.lineTo(x + r, y + height);
    c.quadraticCurveTo(x, y + height, x, y + height - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  };

  c.clearRect(0, 0, size, size);
  c.lineCap = 'butt';
  // A deep, cast magazine carries separate cradles. This is painted only on
  // resize/selection; the entire canvas still turns as one compositor layer.
  const well = c.createRadialGradient(half, half, inner, half, half, outer);
  well.addColorStop(0, '#05040B');
  well.addColorStop(0.16, '#222031');
  well.addColorStop(0.48, '#0A0912');
  well.addColorStop(0.84, '#1F1A2D');
  well.addColorStop(1, '#07060D');
  circle((inner + outer) / 2, well, outer - inner);

  const steel = c.createLinearGradient(0, 0, size * 0.8, size);
  steel.addColorStop(0, '#302A43');
  steel.addColorStop(0.17, '#B1ADC3');
  steel.addColorStop(0.28, '#51475F');
  steel.addColorStop(0.47, '#191423');
  steel.addColorStop(0.76, '#69647A');
  steel.addColorStop(0.9, '#B5A7BD');
  steel.addColorStop(1, '#33243F');
  circle(outer, '#030208', half * 0.032);
  circle(outer, steel, half * 0.015);
  circle(outer - half * 0.012, '#09060F', half * 0.009);
  circle(inner + half * 0.002, '#040309', half * 0.026);
  circle(inner + half * 0.002, steel, half * 0.012);

  // Thin coloured inlays belong to the magazine rails, rather than washing
  // the metal purple. The bright record tabs remain the dominant colour.
  c.lineWidth = Math.max(dpr * 0.55, half * 0.004);
  [
    [0.03, 0.64, 'rgba(37,232,226,.62)'],
    [1.04, 1.64, 'rgba(255,45,149,.58)'],
  ].forEach(([start, end, colour]) => {
    c.strokeStyle = colour;
    c.beginPath(); c.arc(half, half, outer + half * 0.004, start * Math.PI, end * Math.PI); c.stroke();
  });

  const pitch = (2 * Math.PI * inner) / Math.max(records.length, 1);
  const width = Math.max(2, Math.min(half * 0.067, pitch * 0.47));
  const recordTop = -outer + half * 0.014;
  const recordBottom = -inner - half * 0.009;
  const recordHeight = recordBottom - recordTop;
  const cradleWidth = width + half * 0.027;
  const grooveWidth = Math.max(dpr * 0.45, half * 0.003);

  records.forEach((acc, i) => {
    c.save(); c.translate(half, half);
    c.rotate((slotAngle(i, records.length) * Math.PI) / 180);

    // A black pocket sits below two raised, brushed-metal cradle cheeks.
    box(-cradleWidth / 2, recordTop - half * 0.004, cradleWidth, recordHeight + half * 0.01, half * 0.009);
    c.fillStyle = '#030208'; c.fill();
    const cheek = c.createLinearGradient(-cradleWidth / 2, 0, cradleWidth / 2, 0);
    cheek.addColorStop(0, '#595267');
    cheek.addColorStop(0.12, '#211C2C');
    cheek.addColorStop(0.88, '#100C18');
    cheek.addColorStop(1, '#797083');
    c.strokeStyle = cheek; c.lineWidth = Math.max(dpr * 0.6, half * 0.005); c.stroke();

    // Etched ticks give every fifth pocket a readable indexing landmark.
    if (i % 5 === 0) {
      c.strokeStyle = 'rgba(226,224,239,.62)'; c.lineWidth = grooveWidth;
      c.beginPath(); c.moveTo(-width * 0.3, -outer - half * 0.005);
      c.lineTo(width * 0.3, -outer - half * 0.005); c.stroke();
    }
    if (i === gap) {
      // Keep the empty slot black: no coloured tab or reflective vinyl edge.
      // A recessed stop at its foot makes the missing record unambiguous.
      c.strokeStyle = '#44354F'; c.lineWidth = Math.max(dpr * 0.6, half * 0.004);
      c.beginPath(); c.moveTo(-width * 0.29, recordBottom - half * 0.006);
      c.lineTo(width * 0.29, recordBottom - half * 0.006); c.stroke();
      c.restore(); return;
    }

    // The vinyl edge has a bright front bevel, a deep black face, and thin
    // parallel layers. Squared shoulders avoid the old floating-pill shape.
    const vinyl = c.createLinearGradient(-width / 2, 0, width / 2, 0);
    vinyl.addColorStop(0, '#A19AAB');
    vinyl.addColorStop(0.09, '#302B3B');
    vinyl.addColorStop(0.24, '#121019');
    vinyl.addColorStop(0.62, '#07060B');
    vinyl.addColorStop(0.86, '#292332');
    vinyl.addColorStop(1, '#0A0710');
    box(-width / 2, recordTop, width, recordHeight, half * 0.008);
    c.fillStyle = vinyl; c.fill();
    c.strokeStyle = '#07050B'; c.lineWidth = grooveWidth; c.stroke();
    c.strokeStyle = 'rgba(166,152,183,.38)'; c.lineWidth = grooveWidth;
    c.beginPath();
    c.moveTo(-width * 0.27, recordTop + half * 0.008);
    c.lineTo(-width * 0.27, recordBottom - half * 0.008); c.stroke();
    c.strokeStyle = '#030207';
    c.beginPath(); c.moveTo(width * 0.18, recordTop + half * 0.007);
    c.lineTo(width * 0.18, recordBottom - half * 0.007); c.stroke();

    // A bold album-colour index face is carried by each record. It is large
    // enough to retain the original jewel-like colour at cabinet scale.
    const tabWidth = width * 0.76;
    const tabTop = recordTop + half * 0.009;
    const tabHeight = recordHeight * 0.53;
    box(-tabWidth / 2, tabTop, tabWidth, tabHeight, half * 0.004);
    c.fillStyle = accent(acc); c.fill();
    const tabLight = c.createLinearGradient(-tabWidth / 2, tabTop, tabWidth / 2, tabTop + tabHeight);
    tabLight.addColorStop(0, 'rgba(255,246,236,.34)');
    tabLight.addColorStop(0.22, 'rgba(255,246,236,.04)');
    tabLight.addColorStop(0.62, 'rgba(0,0,0,0)');
    tabLight.addColorStop(1, 'rgba(0,0,0,.33)');
    c.fillStyle = tabLight; c.fill();
    c.strokeStyle = 'rgba(0,0,0,.68)'; c.lineWidth = grooveWidth; c.stroke();
    c.strokeStyle = 'rgba(255,248,237,.46)'; c.lineWidth = grooveWidth;
    c.beginPath(); c.moveTo(-tabWidth * 0.32, tabTop + half * 0.004);
    c.lineTo(tabWidth * 0.32, tabTop + half * 0.004); c.stroke();
    c.restore();
  });

  // Six flush slotted bolts anchor the outer rail. As the assembly indexes,
  // their movement reinforces that this is a single mechanical magazine.
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 + 15) * Math.PI) / 180;
    const x = half + Math.sin(a) * outer;
    const y = half - Math.cos(a) * outer;
    const radius = Math.max(dpr * 0.7, half * 0.007);
    c.fillStyle = '#09060F';
    c.beginPath(); c.arc(x, y + radius * 0.45, radius * 1.35, 0, Math.PI * 2); c.fill();
    const bolt = c.createRadialGradient(x - radius * 0.35, y - radius * 0.35, 0, x, y, radius);
    bolt.addColorStop(0, '#E0D9E6'); bolt.addColorStop(0.5, '#8D829A'); bolt.addColorStop(1, '#33283F');
    c.fillStyle = bolt;
    c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#17101E'; c.lineWidth = Math.max(dpr * 0.45, radius * 0.35);
    c.beginPath(); c.moveTo(x - radius * 0.62, y + radius * 0.22);
    c.lineTo(x + radius * 0.62, y - radius * 0.22); c.stroke();
  }
}

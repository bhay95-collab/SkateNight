/* ============================================================
   STARTUP INSIDE - the extended cut: Bigger on the Inside.

   The camera follows the coin through the slit and falls with it through
   an interior far bigger than the cabinet could hold: a transformer the
   size of a building, gears, girders, cable runs, all of it black
   silhouette. Inside, the only light is from what is powered - the slot
   lamp receding above, the coin's own glint, amber valves, blue-white
   arcs, and at the very top the cyan back of the screen. That is how the
   scale is drawn.

     the dive     through the slit into the dark (BEATS.gone -> inside)
     the fall     three seconds down the shaft with the coin, three depths
                  of silhouette sliding past at their own speeds
     the box      the coin lands far below; the camera settles hard
     the relay    the whole interior jolts
     A            a valve beside us gathers amber, nearly holds, arcs, dies;
                  its afterglow is the only light in the dark
     B            far above, the robot lights first - its cyan reaches down
                  the shaft - and the machine follows it: light races up a
                  cable, and on each beat of the heartbeat another pulse
                  runs up it and a valve wakes as we rise past it
     the surface  the back of the screen: the robot, enormous, reversed
     through      we push through it, onto the lit cabinet for the lock

   Drawn in code (inline SVG, no files), opacity and transform only, all
   scheduled at the press on the document timeline like the rest of the
   film (startup.js). Only with BEATS from timeline(true); never with
   reduced motion.
   ============================================================ */
import { BEATS, PULSE, supplyAt } from './startup-timing.js';
import { thin } from './startup-power.js';

const NS = 'http://www.w3.org/2000/svg';
const STEP_MS = 30;
export const SHAFT = { top: -1.2, bottom: 3 };      // where the camera can be, in screens below the slit: the screen's back above, the coin box below
const LAYERS = [                                    // depth: how fast each moves past as the camera moves (parallax)
  { name: 'far', speed: 0.35 },
  { name: 'mid', speed: 1 },
  { name: 'near', speed: 2 },
];
const SILHOUETTE = '#030205';
const RIM = 'rgba(190,170,230,.2)';             // the edge of a shape against the fog behind it

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeIn = (t) => t ** 2.2;

/* ---------------- the camera's depth in the shaft ---------------- */
/* Screens below the slit at a moment of the film (0 at the slit, SHAFT.bottom at the coin box). */
export function depthAt(ms, B = BEATS) {
  const { inside, credit, catch: caught, surface, through } = B;
  if (ms <= inside) return 0;
  if (ms <= credit) return SHAFT.bottom * ease((ms - inside) / (credit - inside));            // falling with the coin
  if (ms <= credit + 120) return SHAFT.bottom + 0.05 * Math.sin(((ms - credit) / 120) * Math.PI);   // the landing: it settles hard
  if (ms <= caught + 250) return SHAFT.bottom;                                                // the box, the relay, the first try, the dark
  if (ms <= surface) {                                                                        // the rise, accelerating after the light
    const t = (ms - caught - 250) / (surface - caught - 250);
    return SHAFT.bottom + (SHAFT.top - SHAFT.bottom) * (t < 0.85 ? easeIn(t / 0.85) * 0.93 : 0.93 + 0.07 * ((t - 0.85) / 0.15));
  }
  return SHAFT.top;                                                                           // at the surface: held while the screen fills
}

/* ---------------- drawing ---------------- */
function svg(w, h, body) {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', `0 0 ${w} ${h}`);
  el.setAttribute('preserveAspectRatio', 'none');
  el.innerHTML = body;
  return el;
}
const shape = (d, fill = SILHOUETTE) => `<path d="${d}" fill="${fill}" stroke="${RIM}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;

function gearPath(r, teeth) {
  const pts = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const rr = i % 4 < 2 ? r : r * 0.86;
    pts.push(`${(100 + rr * Math.cos(a)).toFixed(1)} ${(100 + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z M${100 + r * 0.32} 100 A${r * 0.32} ${r * 0.32} 0 1 0 ${100 - r * 0.32} 100 A${r * 0.32} ${r * 0.32} 0 1 0 ${100 + r * 0.32} 100Z`;
}
const ART = {
  gear: (teeth = 18) => svg(200, 200, `<path fill-rule="evenodd" d="${gearPath(96, teeth)}" fill="${SILHOUETTE}" stroke="${RIM}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`),
  transformer: () => {
    let fins = '';
    for (let y = 40; y < 560; y += 22) fins += `<rect x="-8" y="${y}" width="416" height="9" fill="${SILHOUETTE}" stroke="${RIM}" vector-effect="non-scaling-stroke"/>`;
    return svg(400, 600, `${shape('M30 0H370V600H30Z')}${fins}${shape('M120 -40H160V10H120Z M240 -40H280V10H240Z')}`);
  },
  girder: (h = 1000) => {
    let d = `M0 0H14V${h}H0Z M86 0H100V${h}H86Z`;
    for (let y = 0; y < h; y += 100) d += ` M14 ${y}L86 ${y + 100}L86 ${y + 90}L14 ${y - 10 < 0 ? 0 : y + 10}Z`;
    return svg(100, h, shape(d));
  },
  rails: (h = 1000) => svg(100, h, shape(`M0 0H10V${h}H0Z M90 0H100V${h}H90Z`) + Array.from({ length: Math.floor(h / 160) }, (_, i) => shape(`M-30 ${i * 160 + 60}H130V${i * 160 + 74}H-30Z`)).join('')),
  cables: (n = 3, h = 1000) => svg(60, h, Array.from({ length: n }, (_, i) => shape(`M${8 + i * 18} 0 C${2 + i * 18} ${h * 0.3} ${16 + i * 18} ${h * 0.6} ${8 + i * 18} ${h}`, 'none').replace('fill="none"', `fill="none" stroke-width="7"`).replace(`stroke="${RIM}"`, `stroke="${SILHOUETTE}"`)).join('')),
  valve: () => svg(60, 120, shape('M14 40 C14 6 46 6 46 40 V92 H14 Z') + shape('M8 92H52V120H8Z')),
  box: () => svg(300, 120, shape('M0 20H300V120H0Z M110 0H190V20H110Z')),
  beam: () => svg(100, 300, shape('M0 0H100V300H0Z')),
};

/* One piece of the interior on a layer: x in % of the width, y in screens
   down the shaft (layer coordinates), sizes in screen heights. */
function piece(layer, art, { x, y, w, h, cls = '' }) {
  const box = document.createElement('div');
  box.className = `in-piece ${cls}`.trim();
  Object.assign(box.style, { left: `${x}%`, top: `${y * 100}%`, width: `${w * 100}vh`, height: `${h * 100}vh` });
  box.append(art);
  layer.append(box);
  return box;
}
function light(layer, cls, { x, y, size }) {
  const glow = document.createElement('i');
  glow.className = `in-light ${cls}`;
  Object.assign(glow.style, { left: `${x}%`, top: `${y * 100}%`, width: `${size * 100}vh`, height: `${size * 100}vh` });
  layer.append(glow);
  return glow;
}

/* Where the rise wakes a valve: one for each heartbeat, placed where the camera is on that beat. */
const wakeDepth = (ms) => depthAt(ms) + 0.45;

export function buildInside(attract, robotCanvas) {
  const world = attract.querySelector('.attract-world');
  if (!world) return null;
  const root = document.createElement('div');
  root.className = 'inside';
  root.setAttribute('aria-hidden', 'true');
  const haze = document.createElement('div');
  haze.className = 'in-haze';
  root.append(haze);
  const layers = Object.fromEntries(LAYERS.map(({ name }) => {
    const layer = document.createElement('div');
    layer.className = `in-layer is-${name}`;
    root.append(layer);
    return [name, layer];
  }));
  const { far, mid, near } = layers;

  // far: the building-sized things, hazed by distance
  piece(far, ART.transformer(), { x: 6, y: 0.1, w: 0.95, h: 1.45, cls: 'is-hazed' });
  piece(far, ART.girder(1400), { x: 74, y: -0.6, w: 0.09, h: 2.9, cls: 'is-hazed' });
  piece(far, ART.gear(30), { x: 54, y: 0.95, w: 0.95, h: 0.95, cls: 'is-hazed is-turning' });
  piece(far, ART.cables(4, 1400), { x: 45, y: -0.6, w: 0.07, h: 2.9, cls: 'is-hazed' });

  // mid: the shaft itself - the chute the coin falls down, the gears, the valves, the cable, the box
  piece(mid, ART.rails(2000), { x: 47.2, y: -0.05, w: 0.09, h: 3.4 });
  piece(mid, ART.gear(16), { x: 12, y: 0.55, w: 0.5, h: 0.5, cls: 'is-turning' });
  piece(mid, ART.gear(22), { x: 80, y: 1.6, w: 0.7, h: 0.7, cls: 'is-turning is-back' });
  piece(mid, ART.gear(12), { x: 18, y: 2.35, w: 0.4, h: 0.4, cls: 'is-turning' });
  piece(mid, ART.girder(2600), { x: 4, y: -1.4, w: 0.07, h: 5.4 });
  piece(mid, ART.girder(2600), { x: 93, y: -1.4, w: 0.07, h: 5.4 });
  const cable = piece(mid, ART.cables(2, 2400), { x: 62, y: -1.05, w: 0.05, h: 4.85 });
  piece(mid, ART.box(), { x: 41.5, y: 3.62, w: 0.42, h: 0.17 });
  const boxGlow = light(mid, 'is-amber', { x: 50, y: 3.6, size: 0.5 });
  // the valve of the first try, beside the box; and the valves the rise wakes, one a heartbeat
  const valveA = { x: 30, y: 3.18 };
  piece(mid, ART.valve(), { ...valveA, w: 0.09, h: 0.18 });
  const glowA = light(mid, 'is-amber', { x: valveA.x + 1.4, y: valveA.y + 0.02, size: 0.42 });
  const arc = light(mid, 'is-arc', { x: valveA.x + 1.4, y: valveA.y - 0.02, size: 0.1 });
  const tick = light(mid, 'is-arc', { x: 71, y: 2.62, size: 0.05 });
  const woken = PULSE.heartbeat.map((ms, n) => {
    const at = { x: n % 2 ? 71 : 27, y: wakeDepth(ms) };
    piece(mid, ART.valve(), { ...at, w: 0.08, h: 0.16 });
    return { ms, glow: light(mid, 'is-amber', { x: at.x + 1.3, y: at.y + 0.02, size: 0.34 }) };
  });
  const pulses = [0, ...PULSE.heartbeat].map(() => light(mid, 'is-pulse', { x: 63.3, y: 3.7, size: 0.06 }));
  // the back of the screen, at the top of the shaft: the robot, reversed
  const screen = document.createElement('div');
  screen.className = 'in-screen';
  Object.assign(screen.style, { top: `${(SHAFT.top + 0.12) * 100}%` });
  if (robotCanvas) {
    const back = document.createElement('canvas');
    back.width = robotCanvas.width || 256;
    back.height = robotCanvas.height || 256;
    try {
      const c = back.getContext('2d');
      c.translate(back.width, 0);
      c.scale(-1, 1);
      c.drawImage(robotCanvas, 0, 0, back.width, back.height);
      screen.append(back);
    } catch { /* a robot we cannot copy: the glow alone */ }
  }
  mid.append(screen);

  // near: big dark edges sliding past close to the lens, out of focus
  [[-4, -1.6], [92, -0.4], [-6, 1.1], [95, 2.6], [-5, 4.4], [94, 5.7]].forEach(([x, y], n) =>
    piece(near, ART.beam(), { x, y, w: 0.28 + 0.06 * (n % 2), h: 0.9, cls: 'is-near' }));

  // the coin, falling with us: small, gold, catching what light there is
  const coin = document.createElement('i');
  coin.className = 'in-coin';
  root.append(coin);
  // the robot's light reaching down the shaft from far above
  const above = document.createElement('i');
  above.className = 'in-above';
  root.append(above);

  world.append(root);
  return { root, haze, layers, cable, boxGlow, glowA, arc, tick, woken, pulses, screen, coin, above };
}

/* ---------------- staging ---------------- */
export function stageInside(inside) {
  if (!inside) return;
  const B = BEATS;
  const { gone, inside: inAt, credit, relay, almost, fail, tick, catch: caught, surface, through, ignite, end } = B;
  const span = (from, to) => ({ delay: from, duration: to - from, fill: 'forwards', easing: 'linear' });
  const sample = (from, to, map) => {
    const frames = [];
    for (let ms = from; ms < to; ms += STEP_MS) frames.push({ offset: (ms - from) / (to - from), ...map(ms) });
    frames.push({ offset: 1, ...map(to) });
    return thin(frames);
  };

  // the dive: black rises through the slit; out again through the screen
  inside.root.animate([
    { opacity: 0 }, { opacity: 0, offset: (gone + 150) / end }, { opacity: 1, offset: inAt / end },
    { opacity: 1, offset: through / end }, { opacity: 0, offset: Math.min(1, (ignite + 80) / end) }, { opacity: 0 },
  ], { duration: end, fill: 'forwards' });

  // the camera's depth moves every layer at its own speed
  LAYERS.forEach(({ name, speed }) => inside.layers[name].animate(
    sample(inAt, through, (ms) => ({ transform: `translateY(${(-depthAt(ms) * speed * 100).toFixed(2)}%)` })), span(inAt, through)));
  // the relay jolts the whole interior; the landing too
  const jolt = (ms, px) => inside.root.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${px}px)`, offset: 0.15 }, { transform: `translateY(${-px * 0.3}px)`, offset: 0.4 }, { transform: 'translateY(0)' }],
    { delay: ms, duration: 480, easing: 'ease-out', composite: 'add' });
  jolt(credit, 7);
  jolt(relay, 10);
  jolt(caught, 8);

  // the light: the slot lamp's glow recedes above as we fall; then only what is powered
  inside.haze.animate([{ opacity: 1 }, { opacity: 1, offset: inAt / end }, { opacity: 0.6, offset: credit / end }, { opacity: 0.4, offset: relay / end },
    { opacity: 0.3, offset: caught / end }, { opacity: 0.8, offset: surface / end }, { opacity: 0.8 }], { duration: end, fill: 'forwards' });
  // the coin: falling with us, then into the box
  inside.coin.animate([
    { opacity: 0, transform: 'translate(-50%, -40vh) rotate(0deg)' }, { opacity: 0, offset: inAt / credit, transform: 'translate(-50%, -6vh) rotate(0deg)' },
    { opacity: 1, offset: (inAt + 200) / credit, transform: 'translate(-50%, 0vh) rotate(90deg)' },
    { opacity: 1, offset: (credit - 300) / credit, transform: 'translate(-48%, 4vh) rotate(1000deg)' },
    { opacity: 0, offset: 1, transform: 'translate(-50%, 15vh) rotate(1080deg)' },
  ], { duration: credit, fill: 'forwards', easing: 'cubic-bezier(.3,0,.7,1)' });
  inside.boxGlow.animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.08 }, { opacity: 0.12, offset: 0.6 }, { opacity: 0 }], span(credit, credit + 1600));

  // A: the valve gathers on the supply, nearly holds, arcs, dies; its afterglow fades through the dark
  inside.glowA.animate(sample(relay, caught, (ms) => {
    const v = supplyAt(ms);
    const lit = ms < fail + 380 ? clamp((v - 0.05) * 1.6) : 0.5 * Math.exp(-(ms - fail - 380) / 900);   // the afterglow: the only light in the dark
    return { opacity: lit.toFixed(3) };
  }), span(relay, caught));
  inside.arc.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.2, offset: 0.3 }, { opacity: 0.8, offset: 0.45 }, { opacity: 0 }], span(almost + 200, almost + 330));
  inside.tick.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.2 }, { opacity: 0 }], span(tick, tick + 90));

  // B: far above, the robot lights first, and its cyan reaches down the shaft
  inside.above.animate([
    { opacity: 0 }, { opacity: 0, offset: (caught + 60) / end }, { opacity: 0.85, offset: (caught + 310) / end }, { opacity: 0.85, offset: surface / end }, { opacity: 0.3, offset: through / end }, { opacity: 0 },
  ], { duration: end, fill: 'forwards' });
  // then the machine follows it: light races up the cable, and again on every beat of the heartbeat
  const pulseTimes = [caught + 300, ...PULSE.heartbeat];
  inside.pulses.forEach((dot, n) => {
    const from = pulseTimes[n];
    const top = depthAt(from) - 0.2;          // from just below the camera...
    dot.animate([{ opacity: 0, top: `${(top + 1) * 100}%` }, { opacity: 1, top: `${(top + 0.9) * 100}%`, offset: 0.1 },
      { opacity: 0.9, top: `${(top - 0.6) * 100}%`, offset: 0.85 }, { opacity: 0, top: `${(top - 0.8) * 100}%` }],
    { delay: from, duration: 650, fill: 'both', easing: 'cubic-bezier(.4,0,.6,1)' });   // ...up past the top of the frame, ahead of us
  });
  // and a valve wakes on each beat as we rise past it
  inside.woken.forEach(({ ms, glow }) => glow.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.15 }, { opacity: 0.45 }], span(ms, ms + 900)));

  // the surface: the back of the screen fills the frame, and we push through it
  inside.screen.animate([{ opacity: 0.25, transform: 'translateX(-50%) scale(1)' }, { opacity: 0.25, offset: (caught + 60 - inAt) / (end - inAt), transform: 'translateX(-50%) scale(1)' },
    { opacity: 0.9, offset: (caught + 310 - inAt) / (end - inAt), transform: 'translateX(-50%) scale(1)' },
    { opacity: 0.95, offset: (through - inAt) / (end - inAt), transform: 'translateX(-50%) scale(1.04)' },
    { opacity: 0, offset: Math.min(1, (ignite + 80 - inAt) / (end - inAt)), transform: 'translateX(-50%) scale(2.6)' }, { opacity: 0, transform: 'translateX(-50%) scale(2.6)' }],
  { delay: inAt, duration: end - inAt, fill: 'forwards', easing: 'linear' });
}

/* ============================================================
   STARTUP POWER - the cabinet waking on its one tired supply.

   SUPPLY (startup-timing.js) is the voltage; every electric part follows it
   through its own response, sampled into WAAPI keyframes, so a sag dims the
   sign, the tube, the lamps, the chrome's reflections and the room's light
   together - and sound.js sags the transformer hum on the same curve.
   On top of that, authored beats: the tube's line in the first attempt, the
   raster opening out of it, neon tubes striking one by one, and at ignition
   a sweep through the cabinet (dead tubes catch, bulbs climb the arch, the
   logo lights, gold blooms round the coin door, light glints across chrome).

   Every animation is created at the press with a delay, on the document
   timeline, so nothing drifts from anything else.
   ============================================================ */
import { BEATS, supplyAt } from './startup-timing.js';

const STEP_MS = 30;
const OFF = 0.12;                                     // an unlit neon tube: just the glass
const STRIKE_ORDER = [0, 5, 2, 9, 3, 6, 1, 8, 4, 7];  // the order the letters catch in phase B
const STRUGGLING = new Set([2, 6]);                   // these two catch, drop, then hold
const { relay, attempt, fail, catch: caught, ignite, surge, end } = BEATS;

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const span = (from, to) => ({ delay: from, duration: to - from, fill: 'forwards' });

/* Colour swims and the picture splits red/cyan while the supply struggles. */
function unsteady(v, ms) {
  if (ms < attempt || ms > ignite + 200) return { hue: 0, split: 0 };
  const shaky = 1 - clamp(v);
  return { hue: Math.sin(ms / 85) * 46 * shaky, split: 7 * shaky };
}

export const glow = ({ b, s = 1, hue = 0, split = 0 }) =>
  `brightness(${b.toFixed(3)}) saturate(${s.toFixed(3)}) hue-rotate(${hue.toFixed(1)}deg)` + (split < 0.05 ? '' :
    ` drop-shadow(${split.toFixed(2)}px 0 0 rgba(255,40,100,.55)) drop-shadow(${(-split).toFixed(2)}px 0 0 rgba(0,235,255,.55))`);

/* How each part answers the supply. v = 0.5 is the dormant look in styles.css. */
export const RESPONSE = {
  sign: (v) => ({ filter: `brightness(${(0.1 + 0.9 * v).toFixed(3)}) saturate(${(0.1 + 0.9 * Math.min(v, 1.1)).toFixed(3)})` }),
  picture: (v, ms) => ({ filter: glow({ b: clamp((v - 0.06) * 1.18, 0, 1.6), s: clamp(0.2 + 0.8 * v, 0, 1.2), ...unsteady(v, ms) }) }),
  door: (v) => ({ filter: `brightness(${(0.32 + 1.36 * Math.min(v, 0.5) + 0.3 * Math.max(v - 0.5, 0)).toFixed(3)})` }),
  chrome: (v) => ({ filter: `brightness(${(0.3 + 0.75 * v).toFixed(3)})` }),
  lamp: (v) => ({ opacity: clamp((v - 0.03) * 1.7) }),
  room: (v) => ({ opacity: clamp((v - 0.55) * 2.2) }),
  tubes: (v) => ({ opacity: clamp((v - 0.2) * 1.6) }),
};

/* Keyframes that follow the supply through map(v, ms), from the relay on. */
export function followSupply(target, map, from = relay - STEP_MS, to = end) {
  if (!target) return null;
  const frames = [];
  for (let ms = from; ms < to; ms += STEP_MS) frames.push({ offset: (ms - from) / (to - from), ...map(supplyAt(ms), ms) });
  frames.push({ offset: 1, ...map(supplyAt(to), to) });
  return target.animate(frames, { ...span(from, to), easing: 'linear' });
}

/* [ms, value] points -> keyframes over [from, to]. */
function track(points, from, to, prop) {
  return points.map(([ms, value]) => ({ offset: clamp((ms - from) / (to - from)), [prop]: value }));
}

/* ---------------- the neon tubes ---------------- */
function strikeSteps(t, struggle) {
  return struggle
    ? [[t, OFF], [t + 25, 0.85], [t + 90, 0.8], [t + 110, OFF], [t + 200, OFF], [t + 225, 1]]
    : [[t, OFF], [t + 25, 0.9], [t + 70, 0.45], [t + 110, 1]];
}

/* When each tube catches: live ones through phase B (quicker as the supply
   builds), the dead ones last, at ignition. The first tube tries in phase A. */
export function tubeSchedule(count, dead) {
  const live = STRIKE_ORDER.filter((i) => i < count && !dead.has(i));
  const times = new Map();
  live.forEach((i, n) => {
    const at = caught + 140 + 1160 * Math.pow(n / Math.max(1, live.length - 1), 0.8);
    times.set(i, { at: Math.round(at), struggle: STRUGGLING.has(i) });
  });
  [...dead].forEach((i, n) => times.set(i, { at: ignite + 70 * n, struggle: false }));
  return times;
}

export function stageTubes(tubes, dead, at, cue) {
  const plan = tubeSchedule(tubes.length, dead);
  const first = STRIKE_ORDER.find((i) => !dead.has(i));
  tubes.forEach((tube, i) => {
    const lit = dead.has(i) ? 0.22 : 1;
    const points = [[relay, lit], [relay + 50, OFF]];
    if (i === first) {                                 // phase A: one tube tries, stumbles with the supply, dies
      points.push([attempt + 280, OFF], [attempt + 300, 0.55], [attempt + 380, 0.7], [attempt + 460, 0.3],
        [attempt + 540, 0.65], [fail, 0.6], [fail + 200, OFF]);
      at(attempt + 300, () => cue('tube'));
    }
    const { at: strike, struggle } = plan.get(i);
    points.push(...strikeSteps(strike, struggle), [end, 1]);
    at(strike, () => { tube.classList.remove('is-dead'); cue('tube'); });
    if (struggle) at(strike + 200, () => cue('tube'));
    tube.animate(track(points, relay, end, 'opacity'), { ...span(relay, end), easing: 'linear' });
  });
}

/* ---------------- the picture tube ---------------- */
export function stageTube(el) {
  // The raster: it falls in to a line when the relay cuts the standby supply,
  // opens out of the line in phase B, rolls, and locks; at the surge it tears.
  const raster = [
    [relay, 0, 1], [relay + 70, 0, 0.004], [caught + 260, 0, 0.004], [caught + 420, 0, 0.09],
    [caught + 900, -14, 1], [caught + 1100, 5, 1], [caught + 1260, -2, 1], [ignite, 0, 1], [end, 0, 1],
  ];
  el.picture?.animate(raster.map(([ms, y, sy]) => ({
    offset: (ms - relay) / (end - relay), transform: `translateY(${y}%) scaleY(${sy})`,
  })), { ...span(relay, end), easing: 'ease-out' });
  el.picture?.animate([
    { transform: 'translateX(0) skewX(0deg)' }, { transform: 'translateX(-.8%) skewX(-1.4deg)', offset: 0.3 },
    { transform: 'translateX(.5%) skewX(.9deg)', offset: 0.6 }, { transform: 'translateX(0) skewX(0deg)' },
  ], { delay: surge + 80, duration: 420, composite: 'add', easing: 'ease-in-out' });
  followSupply(el.picture, RESPONSE.picture);

  // The bright line of the first attempt, riding the supply, shrinking to a
  // dot as it dies, then widening again as phase B catches.
  const shape = (ms) => {
    if (ms < attempt + 120 || ms > caught + 900) return { o: 0, w: 0.2 };
    if (ms < fail) return { o: 1.8, w: clamp((ms - attempt - 120) / 280, 0.25, 1) };
    if (ms < caught) return { o: 1.8, w: clamp(1 - (ms - fail) / 300, 0.02, 1) };
    return { o: 1.8 * clamp(1 - (ms - caught - 500) / 400), w: clamp((ms - caught) / 260, 0.4, 1) };
  };
  followSupply(el.line, (v, ms) => {
    const { o, w } = shape(ms);
    return { opacity: clamp(o * v), transform: `scaleX(${w.toFixed(3)})` };
  }, attempt, caught + 900);
}

/* ---------------- ignition: swept through the cabinet ---------------- */
export function stageBulbs(bulbs) {
  bulbs.forEach(({ el, rise, standby }) => {
    const on = ignite + 60 + Math.round(560 * rise);   // from the foot of the arch up to its crown
    const points = [];
    for (let ms = relay - STEP_MS; ms < on; ms += STEP_MS) points.push([ms, standby ? clamp(supplyAt(ms) * 0.6) : 0]);
    points.push([on, standby ? 0.5 : 0], [on + 90, 1], [end, 1]);
    el.animate(track(points, relay - STEP_MS, end, 'opacity'), { ...span(relay - STEP_MS, end), easing: 'linear' });
  });
}

export function stageIgnition(el, at) {
  at(ignite, () => el.attract.classList.add('is-lit'));
  el.pillars.forEach((fill) => fill.animate([
    { transform: 'scaleY(.06)' }, { transform: 'scaleY(.7)', offset: (ignite - caught - 300) / (ignite + 700 - caught - 300) },
    { transform: 'scaleY(1)' },
  ], { ...span(caught + 300, ignite + 700), easing: 'cubic-bezier(.33,0,.2,1)' }));
  el.bloom?.animate([
    { opacity: 0, transform: 'scale(.35)' }, { opacity: 0.85, transform: 'scale(1)', offset: 0.2 }, { opacity: 0, transform: 'scale(1.7)' },
  ], { delay: ignite, duration: 1500, easing: 'cubic-bezier(.23,1,.32,1)' });
  el.logo?.animate([{ filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }],
    { delay: ignite + 100, duration: 700, easing: 'ease-out', composite: 'add' });
  el.doorBloom?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0.55 }],
    { ...span(ignite + 200, ignite + 1100), easing: 'ease-out' });
  el.glint?.animate([{ transform: 'translateX(-120%) skewX(-18deg)' }, { transform: 'translateX(520%) skewX(-18deg)' }],
    { delay: ignite + 250, duration: 900, easing: 'cubic-bezier(.45,0,.25,1)' });
  for (const [part, map] of [[el.sign, RESPONSE.sign], [el.door, RESPONSE.door], [el.arch, RESPONSE.chrome],
    [el.lamp, RESPONSE.lamp], [el.halo, RESPONSE.room], [el.floor, RESPONSE.room], [el.glow, RESPONSE.room]]) followSupply(part, map);
  el.pillars.forEach((fill) => followSupply(fill, RESPONSE.tubes));
}

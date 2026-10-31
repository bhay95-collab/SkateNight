/* ============================================================
   STARTUP POWER - the cabinet waking on its one tired supply.

   SUPPLY (startup-timing.js) is the voltage; every electric part follows it
   through its own response, sampled into WAAPI keyframes, so a sag dims the
   sign, the tube, the lamps, the chrome's reflections and the room's light
   together - and sound.js sags the transformer hum on the same curve.
   On top of that, authored beats: the tube's line in the first attempt, the
   raster opening out of it after the robot has lit alone (startup-robot.js), a neon letter striking on each beat of the
   second try's heartbeat (PULSE), and at the lock the dead tubes catch, the
   bulbs climb the arch a step per beat, the robot flares, gold blooms round
   the coin door, and light glints across the chrome.

   Every animation is created at the press with a delay, on the document
   timeline, so nothing drifts from anything else.
   ============================================================ */
import { BEATS, PULSE, ROBOT_FIRST_MS, STANDBY, supplyAt } from './startup-timing.js';

const STEP_MS = 30;
const STANDBY_EMBER = 0.25;                           // the few bulbs that warm first: an ember, not a glow
const OFF = 0.12;                                     // an unlit neon tube: just the glass
const STRIKE_ORDER = [0, 5, 2, 9, 3, 6, 1, 8, 4, 7];  // the order the letters catch in phase B
const STRUGGLING = new Set([2]);                      // this one catches, drops, then holds
const { relay, attempt, almost, fail, catch: caught, ignite, end } = BEATS;

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

/* How each part answers the supply. v = STANDBY is the dormant look in
   styles.css (tests/startup.test.js holds the two together). From running
   up every part is exactly as bright as it always was. Below KNEE the lit
   parts fall into a toe: the trickle the dormant cabinet sits on lights
   nothing but the picture tube - the lacquer, chrome and coin door are seen
   only by the tube's light on them (.cab-spill) - and the dead moments of
   the film are as dark. (The static keeps its curve: on standby it is drawn
   from a fainter tile, startup.js.) toe(curve, floor, standby) bends a curve below KNEE
   so it reads floor at 0 and standby at STANDBY, and meets it at KNEE. */
const KNEE = 0.4;
function toe(curve, floor, standby) {
  const p = Math.log((standby - floor) / (curve(KNEE) - floor)) / Math.log(STANDBY / KNEE);
  return (v) => (v >= KNEE ? curve(v) : floor + (curve(KNEE) - floor) * clamp(v / KNEE) ** p);
}
const body = toe((v) => (v >= 1 ? 1 : 0.1 + 0.9 * v ** 1.5), 0.02, 0.06);
const chrome = toe((v) => (v <= 1 ? 0.05 + v * v : 0.3 + 0.75 * v), 0.015, 0.035);
const door = toe((v) => 0.03 + 0.97 * (Math.min(v, 0.5) / 0.5) ** 2.5 + 0.3 * Math.max(v - 0.5, 0), 0.012, 0.04);
// The tube: below the knee it is only ever seen on standby (the raster is a
// dead line from the relay until the supply is past it), so there it keeps
// its colour for the robot drawn on it, and a little more of its glow.
// Dead at 0.03, as the relay leaves it.
const running = (v) => (v <= 1 ? 1.11 * clamp((v - 0.03) / 0.97) ** 0.6 : clamp((v - 0.06) * 1.18, 0, 1.6));
const TUBE_STANDBY = 0.5;
const tubeToe = Math.log(TUBE_STANDBY / running(KNEE)) / Math.log((STANDBY - 0.03) / (KNEE - 0.03));
const tube = (v) => (v >= KNEE ? running(v) : running(KNEE) * clamp((v - 0.03) / (KNEE - 0.03)) ** tubeToe);

export const RESPONSE = {
  sign: (v) => ({ filter: `brightness(${(v <= 1 ? 0.03 + 0.97 * v * v : 0.1 + 0.9 * v).toFixed(3)}) saturate(${(0.1 + 0.9 * Math.min(v, 1.1)).toFixed(3)})` }),
  // Below running the tube holds its glow longer than the rest (it is the only light in the room); the relay still kills it.
  picture: (v, ms) => ({ filter: glow({ b: tube(v), s: v >= KNEE ? clamp(0.2 + 0.8 * v, 0, 1.2) : clamp(0.52 + 1.4 * (KNEE - v)), ...unsteady(v, ms) }) }),
  door: (v) => ({ filter: `brightness(${door(v).toFixed(3)})` }),
  chrome: (v) => ({ filter: `brightness(${chrome(v).toFixed(3)})` }),
  body: (v) => ({ filter: `brightness(${body(v).toFixed(3)})` }),   // the lacquer, seen only by the light on it
  spill: (v) => ({ opacity: clamp(v * 4) }),                       // the picture tube's light on its surroundings
  lamp: (v) => ({ opacity: clamp((v - 0.25) * 1.7) }),
  room: (v) => ({ opacity: clamp((v - 0.55) * 2.2) }),
  tubes: (v) => ({ opacity: clamp((v - 0.2) * 1.6) }),
  static: (v) => ({ opacity: Math.min(1.75 * v, 0.35 - 0.3 * clamp((v - 0.5) * 2)) }),   // no signal: snow on standby (a weak signal there, styles.css), .05 once the picture locks
};

/* The few bulbs still warm on standby: cold in the dark, an ember once the supply climbs past it. */
const ember = (v) => STANDBY_EMBER * v * clamp((v - STANDBY) / 0.35);

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

/* When each tube catches: one live letter on each beat of the second try's
   heartbeat, the rest on the first beats of the lock, the dead ones last, on
   the lock itself. The first tube tries in phase A. */
export function tubeSchedule(count, dead) {
  const live = STRIKE_ORDER.filter((i) => i < count && !dead.has(i));
  const beats = [...PULSE.heartbeat, ...PULSE.lock.slice(1)];
  const times = new Map();
  live.forEach((i, n) => times.set(i, { at: Math.round(beats[Math.min(n, beats.length - 1)]), struggle: STRUGGLING.has(i) }));
  [...dead].forEach((i, n) => times.set(i, { at: ignite + 70 * n, struggle: false }));
  return times;
}

export function stageTubes(tubes, dead, at, cue) {
  const plan = tubeSchedule(tubes.length, dead);
  const first = STRIKE_ORDER.find((i) => !dead.has(i));
  tubes.forEach((tube, i) => {
    const lit = dead.has(i) ? 0.22 : 1;
    const points = [[relay, lit], [relay + 50, OFF]];
    if (i === first) {                                 // phase A: one tube weakly catches, nearly holds, and dies with the supply
      points.push([attempt + 700, OFF], [attempt + 720, 0.34], [attempt + 800, 0.24], [almost - 160, 0.42], [almost, 0.62],
        [almost + 200, 0.28], [almost + 330, 0.48], [fail, 0.42], [fail + 260, OFF]);
      at(attempt + 700, () => cue('tube'));
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
  // opens out of the line in phase B, rolls, and locks.
  // In phase B the robot lights first, alone (startup-robot.js): the line
  // and the raster follow it, ROBOT_FIRST_MS later.
  const b = caught + ROBOT_FIRST_MS;
  const raster = [
    [relay, 0, 1], [relay + 70, 0, 0.004], [b + 450, 0, 0.004], [b + 640, 0, 0.09],
    [b + 1150, -16, 1], [b + 1400, 7, 1], [b + 1620, -3, 1], [b + 1900, 1, 1], [ignite, 0, 1], [end, 0, 1],
  ];
  // While it is only a line, the picture itself is not drawn at all (the
  // .tv-line carries it): a filtered layer squashed to almost nothing is
  // drawn by the GPU as a hard black box across the dead tube.
  el.picture?.animate(raster.map(([ms, y, sy]) => ({
    offset: (ms - relay) / (end - relay), transform: `translateY(${y}%) scaleY(${sy})`, opacity: sy < 0.01 ? 0 : 1, easing: 'ease-out',
  })), { ...span(relay, end), easing: 'linear' });   // eased step by step: an eased whole would bend every beat out of place
  followSupply(el.picture, RESPONSE.picture);
  followSupply(el.grain, (v, ms) => (ms >= caught && ms < b + 450 ? { opacity: 0 } : RESPONSE.static(v)));   // a dead tube shows no snow; nor does the robot's moment alone

  // The bright line of the first attempt: it creeps out from the centre as
  // the transformer gathers, nearly spans the tube, shrinks to a dot as the
  // supply dies; in phase B it snaps across and the raster opens out of it.
  const shape = (ms) => {
    if (ms < attempt + 150 || ms > b + 1100 || (ms >= caught && ms < b)) return { o: 0, w: 0.05 };
    if (ms < fail) return { o: 2, w: clamp(Math.pow((ms - attempt - 150) / (almost - attempt - 150), 1.6), 0.05, 1) };
    if (ms < caught) return { o: 2, w: clamp(1 - (ms - fail) / 360, 0.02, 1) };
    return { o: 2 * clamp(1 - (ms - b - 650) / 450), w: clamp((ms - b) / 200, 0.3, 1) };
  };
  followSupply(el.line, (v, ms) => {
    const { o, w } = shape(ms);
    return { opacity: clamp(o * v), transform: `scaleX(${w.toFixed(3)})` };
  }, attempt, b + 1100);
}

/* ---------------- ignition: swept through the cabinet ---------------- */
export function stageBulbs(bulbs) {
  const climb = PULSE.lock.slice(0, 6);                 // from the foot of the arch up to its crown, a step on each beat of the lock
  bulbs.forEach(({ el, rise, standby }) => {
    const on = Math.round(climb[Math.min(climb.length - 1, Math.floor(rise * climb.length))]);
    const points = [];
    for (let ms = relay - STEP_MS; ms < on; ms += STEP_MS) points.push([ms, standby ? ember(supplyAt(ms)) : 0]);
    points.push([on, standby ? 0.5 : 0], [on + 90, 1], [end, 1]);
    el.animate(track(points, relay - STEP_MS, end, 'opacity'), { ...span(relay - STEP_MS, end), easing: 'linear' });
  });
}

export function stageIgnition(el, at) {
  at(relay, () => el.attract.classList.add('is-powered'));   // the sign and logo exist only once the supply moves
  at(ignite, () => el.attract.classList.add('is-lit'));
  el.pillars.forEach((fill) => fill.animate([
    { transform: 'scaleY(.06)' }, { transform: 'scaleY(.7)', offset: (ignite - caught - 300) / (ignite + 700 - caught - 300) },
    { transform: 'scaleY(1)' },
  ], { ...span(caught + 300, ignite + 700), easing: 'cubic-bezier(.33,0,.2,1)' }));
  el.bloom?.animate([
    { opacity: 0, transform: 'scale(.35)' }, { opacity: 0.85, transform: 'scale(1)', offset: 0.2 }, { opacity: 0, transform: 'scale(1.7)' },
  ], { delay: ignite, duration: 1500, easing: 'cubic-bezier(.23,1,.32,1)' });
  el.doorBloom?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0.55 }],
    { ...span(ignite + 200, ignite + 1100), easing: 'ease-out' });
  const sweep = [{ transform: 'translateX(-120%) skewX(-18deg)' }, { transform: 'translateX(520%) skewX(-18deg)' }];
  el.glint?.animate(sweep, { delay: ignite + 250, duration: 900, easing: 'cubic-bezier(.45,0,.25,1)' });
  el.glint?.animate(sweep, { delay: ignite + 1350, duration: 1500, easing: 'cubic-bezier(.45,0,.25,1)' });   // the hero moment: light lingering on the chrome
  for (const [part, map] of [[el.sign, RESPONSE.sign], [el.door, RESPONSE.door], [el.arch, RESPONSE.chrome],
    [el.lamp, RESPONSE.lamp], [el.halo, RESPONSE.room], [el.floor, RESPONSE.room], [el.glow, RESPONSE.room],
    [el.body, RESPONSE.body], ...el.tubeCases.map((c) => [c, RESPONSE.body]), [el.spill, RESPONSE.spill]]) followSupply(part, map);
  el.pillars.forEach((fill) => followSupply(fill, RESPONSE.tubes));
}

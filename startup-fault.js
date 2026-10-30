/* ============================================================
   STARTUP FAULT - one bad contact inside the cabinet.

   Somewhere behind the left side panel, low down at the seam, an old
   relay contact does not quite make. Now and then a tiny discharge
   bridges it: a short crooked filament, mostly hidden by the housing
   (only what escapes past the silhouette is seen, .fault-arc clipped at
   the cabinet's edge), and a little cool light catching the lacquer rim
   and the chrome beside it (.fault-light). One place, always the same.

   Dormant: rare - 20 to 45 s apart, sometimes longer, never at load - and
   placed on the robot's falters or its recoveries (planBreath), so the
   contact and the struggling picture belong to one tired supply. One
   timer, re-armed after each event; nothing runs between them.
   The film: four authored contacts on BEATS, gated and scaled by
   supplyAt() - two as the first attempt gathers and stumbles, two as the
   second catches and hesitates - and none in the coin, the dark, the
   lit machine or after. The sparks are evidence of the supply; they never
   drive it. Reduced motion or calm lights: none at all.
   ============================================================ */
import { BEATS, supplyAt } from './startup-timing.js';
import { breathTroubles } from './lights.js';

export const FAULT = {
  minGapMs: 20000, maxGapMs: 45000, longGapMs: 65000,   // dormant: rare, irregular
  skip: 0.3,                                            // chance an opportunity passes
  coreMs: [25, 60], decayMs: [50, 110],                 // filament, then the light it leaves
  variants: 3,                                          // hand-drawn filaments in index.html
  maxStrength: 0.7,                                     // never a lamp: a contact
  minSupply: 0.15,                                      // a dead supply cannot arc
};

const { attempt, almost, fail, catch: caught, ignite } = BEATS;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export const faultsAllowed = (doc = globalThis.document, media = globalThis.matchMedia) =>
  Boolean(doc && media) && !media('(prefers-reduced-motion: reduce)').matches && doc.documentElement.dataset.lights !== 'calm';

/* How hard a contact can arc on this much supply. */
const strengthAt = (ms, k) => clamp(k * (0.45 + 0.4 * supplyAt(ms)), 0, FAULT.maxStrength);

/* The film's contacts: [at, coreMs, decayMs, variant, push] on the beats. */
const AUTHORED = [
  [attempt + 440, 30, 60, 0, 0.8],       // A: the transformer first gathering - the contact just touches
  [almost + 210, 48, 90, 2, 1],          //    the stumble as it nearly holds - a sputter, then it fails
  [caught + 130, 42, 80, 1, 0.95],       // B: the heavier relay - power back, the contact bites
  [caught + 1460, 55, 100, 2, 0.85],     //    the last hesitation before it locks - then it seats, clean
];
export const FILM_FAULTS = AUTHORED
  .filter(([at]) => supplyAt(at) >= FAULT.minSupply)
  .map(([at, coreMs, decayMs, variant, push]) => ({ at, coreMs, decayMs, variant, strength: Number(strengthAt(at, push).toFixed(3)) }));

/* Moments in the breath worth a contact: the falters (weight 3) and the
   recoveries where it starts to gather again (weight 1), in loop ms. */
export function faultMoments(plan) {
  const moments = breathTroubles(plan).falters.map((ms) => ({ ms: ms + 30, weight: 3 }));
  plan.keyframes.forEach((k, n) => {
    const next = plan.keyframes[n + 1];
    if (next && next.level > k.level + 0.3) moments.push({ ms: Math.round(k.offset * plan.duration), weight: 1 });
  });
  return moments;
}

/* The next dormant contact, from where the breath is now (phase, loop ms). */
export function nextDormantFault(plan, phase, rng = Math.random) {
  const long = rng() < FAULT.skip;                     // this time it lets an opportunity pass
  const [lo, hi] = long ? [FAULT.maxGapMs, FAULT.longGapMs] : [FAULT.minGapMs, FAULT.maxGapMs];
  const D = plan.duration;
  const options = [];
  for (const { ms, weight } of faultMoments(plan)) {
    for (let d = ((ms - phase) % D + D) % D; d <= hi; d += D) if (d >= lo) options.push({ d, weight });
  }
  let inMs = lo + rng() * (hi - lo);
  const total = options.reduce((s, o) => s + o.weight, 0);
  if (total) {
    let pick = rng() * total;
    inMs = (options.find((o) => (pick -= o.weight) < 0) ?? options.at(-1)).d;
  }
  const between = (lo2, hi2) => lo2 + rng() * (hi2 - lo2);
  return {
    inMs: Math.round(inMs),
    coreMs: Math.round(between(...FAULT.coreMs)),
    decayMs: Math.round(between(...FAULT.decayMs)),
    variant: Math.floor(rng() * FAULT.variants),
    strength: Number(between(0.4, 0.55).toFixed(3)),
  };
}

/* ---------------- drawing one contact ---------------- */

/* The filament flashes and is gone almost at once; the light it threw on
   the lacquer and chrome lingers a little longer. Opacity only. */
function spark(el, { coreMs, decayMs, variant, strength }, delay = 0) {
  const arc = el.arcs?.[variant % el.arcs.length];
  const total = coreMs + decayMs;
  const anims = [];
  if (arc) anims.push(arc.animate([
    { opacity: 0 }, { opacity: strength, offset: 4 / total }, { opacity: strength * 0.7, offset: coreMs / total },
    { opacity: 0, offset: (coreMs + decayMs * 0.35) / total }, { opacity: 0 },
  ], { delay, duration: total, easing: 'linear' }));
  if (el.light) anims.push(el.light.animate([
    { opacity: 0 }, { opacity: strength * 0.8, offset: 6 / total }, { opacity: strength * 0.55, offset: coreMs / total },
    { opacity: 0 },
  ], { delay, duration: total, easing: 'ease-out' }));
  return anims;
}

export function gatherFault(attract) {
  return { arcs: [...attract.querySelectorAll('.fault-arc')], light: attract.querySelector('.fault-light') };
}

/* The film's contacts, scheduled at the press on the document timeline like the rest of the film. */
export function stageFaults(el) {
  if (!faultsAllowed()) return [];
  return FILM_FAULTS.flatMap((ev) => spark(el, ev, ev.at));
}

/* Dormant: one timer to the next contact; a hidden tab arms nothing and
   shows nothing stale when it comes back. stop() leaves it dark. */
export function startDormantFaults(el, breath) {
  if (!faultsAllowed() || !breath?.plan) return { stop() {} };
  let timer = 0;
  let live = [];
  const arm = () => {
    clearTimeout(timer);
    const phase = breath.phase?.();
    if (phase == null) { timer = setTimeout(arm, FAULT.minGapMs); return; }
    const next = nextDormantFault(breath.plan, phase);
    timer = setTimeout(() => {
      if (!document.hidden) live = spark(el, next);
      arm();
    }, next.inMs);
  };
  const quiet = () => { clearTimeout(timer); live.forEach((a) => a.cancel()); live = []; };
  const onVisibility = () => { if (document.hidden) quiet(); else arm(); };
  document.addEventListener('visibilitychange', onVisibility);
  arm();
  return {
    stop() {
      quiet();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}

export const FAULT_WINDOW = { from: attempt, deadFrom: fail + 380, deadTo: caught, lit: ignite };

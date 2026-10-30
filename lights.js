/* ============================================================
   SCREEN FLICKER - every so often the monitor dips, like an old CRT on a
   tired power supply. One burst timeline drives a soft grid of patches: the
   dip ripples out from a random spot, each patch dips to its own depth, and
   some sit out the second dip, so it reads as a natural brown-out rather
   than one block blinking. Photosensitive-safe by design (WCAG 2.3.1,
   at most 3 flashes in any second):
   - a burst is one or two dips, and bursts are at least 25 s apart,
     so there are never more than 2 flashes in any second;
   - a dip darkens any patch by at most 60%: it never goes fully black;
   - patches only lag the burst (ripple under 180 ms), never add dips, and
     the whole ripple is over within a second;
   Returns WAAPI keyframes for the black layer's opacity, the burst length,
   and how long to wait before the next burst.
   ============================================================ */
export const FLICKER = { minGapMs: 25000, maxGapMs: 70000, maxDim: 0.6, cols: 4, rows: 3, maxRippleMs: 180 };

export function planFlicker(rng = Math.random) {
  const between = (lo, hi) => lo + rng() * (hi - lo);
  const dips = rng() < 0.45 ? 2 : 1;
  const steps = [{ t: 0, o: 0 }];
  const dipStartsMs = [];
  let t = 0;
  for (let i = 0; i < dips; i++) {
    if (i > 0) { t += between(110, 190); steps.push({ t, o: 0 }); }   // back on briefly between the two dips
    const depth = between(0.3, FLICKER.maxDim);
    dipStartsMs.push(Math.round(t));
    t += 45; steps.push({ t, o: depth });               // drop
    t += between(30, 160); steps.push({ t, o: depth * 0.8 });   // hold (a long hold reads as the screen blinking off)
    t += 70; steps.push({ t, o: 0 });                   // recover
  }
  const duration = Math.round(t);
  const keyframes = steps.map((s) => ({ opacity: Number(s.o.toFixed(3)), offset: t ? s.t / t : 0 }));
  return {
    dips,
    dipStartsMs,                                       // when each dip begins (for the electrical crackle)
    duration,
    keyframes,
    patches: planPatches(keyframes, dips, rng),
    nextInMs: Math.round(between(FLICKER.minGapMs, FLICKER.maxGapMs)),
  };
}

/* Each patch of the grid: how long after the burst it dips (distance from a
   random origin, plus a little jitter) and how deep (a share of the burst's
   depth, so it can only ever be lighter). Steps after the first dip's
   recovery belong to the second dip, which some patches skip. */
function planPatches(keyframes, dips, rng) {
  const { cols, rows, maxRippleMs } = FLICKER;
  const ox = rng() * (cols - 1);
  const oy = rng() * (rows - 1);
  const far = Math.hypot(cols - 1, rows - 1);
  const secondDipFrom = 4;                              // index of the "back on" step before dip two
  return Array.from({ length: cols * rows }, (_, i) => {
    const dist = Math.hypot((i % cols) - ox, Math.floor(i / cols) - oy) / far;
    const delayMs = Math.round(Math.min(maxRippleMs, dist * (maxRippleMs - 40) + rng() * 40));
    const share = 0.35 + rng() * 0.65;
    const skipSecond = dips === 2 && rng() < 0.3;
    return {
      delayMs,
      keyframes: keyframes.map((k, j) => ({
        offset: k.offset,
        opacity: skipSecond && j >= secondDipFrom ? 0 : Number((k.opacity * share).toFixed(3)),
      })),
    };
  });
}

/* ============================================================
   THE BREATH - the dormant cabinet's picture tube, barely powered, with the
   robot on it gathering and losing its light. One plan drives the robot,
   its glow, the static and the tube's light on the cabinet, so they are one
   weak signal: brighter robot, clearer picture, less snow, more light on
   the bezel. It loops, so it is a few dozen seconds of breaths that never
   read as a repeat.
   - each breath is 4.2 to 6.8 s: it gathers, holds, relaxes, rests;
   - the level runs 0 (dim, never gone - startup.js keeps a floor) to 1;
   - now and then it falters on the way up (a shallow dip, then on), or
     takes longer to come back;
   - now and then a soft band rolls down the tube, and the picture slips
     sideways a fraction of an em as it passes the robot's face.
   Photosensitive-safe: the robot is a small part of the screen, the level
   never moves more than maxStep in a quarter second, and a falter (at most
   one a breath) is the only change that turns back on itself quickly.
   Returns { duration, keyframes: [{ offset, level, easing }], rolls: [ms] }.
   ============================================================ */
export const BREATH = {
  breaths: 9, minMs: 4200, maxMs: 6800, falter: 0.2, falterChance: 0.3, lingerChance: 0.25, maxStep: 0.25,
  rollChance: 0.3, rollMs: 1700, maxShiftEm: 0.3,
};

export function planBreath(rng = Math.random) {
  const between = (lo, hi) => lo + rng() * (hi - lo);
  const steps = [];
  const rolls = [];
  const rest = () => between(0, 0.1);
  const first = rest();
  let t = 0;
  let level = first;
  const to = (dt, next, easing = 'ease-in-out') => { steps.push({ t, level, easing }); t += dt; level = next; };
  for (let i = 0; i < BREATH.breaths; i++) {
    const length = between(BREATH.minMs, BREATH.maxMs);
    const peak = between(0.72, 1);
    const rise = length * between(0.38, 0.48);
    const hold = length * between(0.06, 0.12);
    const fall = length * between(0.3, 0.38);
    const last = i === BREATH.breaths - 1;
    const trough = last ? first : rest();
    if (rng() < BREATH.falterChance) {          // it gathers, hesitates, then carries on
      const part = between(0.5, 0.7);
      const at = level + (peak - level) * part;
      to(rise * part, at, 'ease-in');
      to(260, at - between(0.1, BREATH.falter), 'ease-out');
      to(Math.max(rise * (1 - part), 1100), peak, 'ease-in-out');   // and gathers itself again, never in a rush
    } else {
      to(rise, peak, 'cubic-bezier(.45,0,.55,1)');
    }
    to(hold, peak * between(0.9, 0.97), 'ease-in-out');
    if (rng() < BREATH.rollChance) rolls.push(Math.round(t + between(0, fall * 0.6)));
    to(fall, trough, 'cubic-bezier(.4,0,.6,1)');
    to(Math.max(200, length - rise - hold - fall) + (rng() < BREATH.lingerChance ? between(900, 1600) : 0), trough, 'linear');
  }
  steps.push({ t, level, easing: 'linear' });
  return {
    duration: Math.round(t),
    keyframes: steps.map((s) => ({ offset: s.t / t, level: Number(Math.max(0, s.level).toFixed(3)), easing: s.easing })),
    rolls: rolls.filter((ms) => ms + BREATH.rollMs < t),
  };
}

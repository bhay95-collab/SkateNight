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

/* ============================================================
   LIGHTS - the FULL / CALM switch.

   The venue laptop's operating-system "reduce motion" setting may not
   match the room, so Ben gets an on-screen switch. With nothing saved
   it follows the operating system; once he presses it, his choice is
   remembered (localStorage) and wins.

   This file only holds the decision. The page wiring is in app.js.
   ============================================================ */

export const LIGHTS_KEY = 'sn-lights';

export function resolveLights({ stored, osReduced }) {
  if (stored === 'full' || stored === 'calm') return stored;
  return osReduced ? 'calm' : 'full';
}

export function toggleLights(current) {
  return current === 'calm' ? 'full' : 'calm';
}

/* ============================================================
   SCREEN FLICKER - every so often the whole monitor dips, like an old
   CRT on a tired power supply. Photosensitive-safe by design (WCAG 2.3.1,
   at most 3 flashes in any second):
   - a burst is one or two dips, and bursts are at least 25 s apart,
     so there are never more than 2 flashes in any second;
   - a dip darkens the screen by at most 60%: it never goes fully black;
   - CALM lights switch it off completely (fx.js checks before each burst).
   Returns WAAPI keyframes for the black layer's opacity, the burst length,
   and how long to wait before the next burst.
   ============================================================ */
export const FLICKER = { minGapMs: 25000, maxGapMs: 70000, maxDips: 2, maxDim: 0.6 };

export function planFlicker(rng = Math.random) {
  const between = (lo, hi) => lo + rng() * (hi - lo);
  const dips = rng() < 0.45 ? 2 : 1;
  const steps = [{ t: 0, o: 0 }];
  let t = 0;
  for (let i = 0; i < dips; i++) {
    if (i > 0) { t += between(110, 190); steps.push({ t, o: 0 }); }   // back on briefly between the two dips
    const depth = between(0.3, FLICKER.maxDim);
    t += 45; steps.push({ t, o: depth });               // drop
    t += between(30, 160); steps.push({ t, o: depth * 0.8 });   // hold (a long hold reads as the screen blinking off)
    t += 70; steps.push({ t, o: 0 });                   // recover
  }
  const duration = Math.round(t);
  return {
    dips,
    duration,
    keyframes: steps.map((s) => ({ opacity: Number(s.o.toFixed(3)), offset: t ? s.t / t : 0 })),
    nextInMs: Math.round(between(FLICKER.minGapMs, FLICKER.maxGapMs)),
  };
}

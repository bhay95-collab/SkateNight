/* ============================================================
   STARTUP TIMING - the INSERT COIN film's score. startup.js stages the
   pictures on these beats and sound.js plays on them, so the clink you hear
   is the jolt you see. Every time is in ms from the press.

   SUPPLY is the cabinet's one electrical supply, 0 (dead) to 1 (running),
   with STANDBY the trickle the dormant cabinet sits on: enough for a dull
   glow on the picture tube and nothing else. The sign, the
   picture tube, the lamps, the room's light and the transformer hum all
   follow it, so a sag dims everything at once and the hum sags with it.
   tests/safety.test.js holds it to the flash budget.
   ============================================================ */

export const STANDBY = 0.2;

export const BEATS = {
  coinIn: 300,      // the coin swings into shot, close to the lens, out of focus
  align: 1500,      // turned face-on, hanging over the slit; the rim catches the light
  descend: 2350,    // after a held breath, it sinks toward the door
  contact: 3050,    // its edge meets the slit and catches
  slip: 3550,       // it is pressed, it resists - then the gate gives and it drops through
  gone: 3850,       // swallowed
  credit: 4750,     // the coin box: a clunk, and 1 CREDIT
  relay: 5450,      // the main relay pulls in - THUNK - and standby cuts out
  attempt: 5950,    // A: the transformer gathers; a line creeps across the tube, one tube catches...
  almost: 7100,     //    ...it nearly holds...
  fail: 7550,       //    ...falters, and dies: line, tube, hum, all of it
  tick: 8250,       // the dark: nothing but one small tick somewhere inside
  catch: 8750,      // B: a deeper relay; the supply finds its strength and climbs
  ignite: 11050,    // C: it locks - full ignition, swept through the cabinet
  surge: 13350,     // D: after the machine has stood there lit, the tube surges and the camera dives in
  collapse: 14050,  //    the picture squeezes to a line
  end: 14530,       //    the boot screen strikes from that line
};

/* Down the chute after it is swallowed: each bounce deeper, quieter, slower to ring out. */
export const CHUTE_CLINKS_MS = [70, 250, 400, 520, 615, 690, 750];

/* [ms, volts]. Dips are a few hundred ms wide and at most two to a second. */
const { relay, attempt, almost, fail, catch: caught, ignite, surge, collapse, end } = BEATS;
export const SUPPLY = [
  [0, STANDBY], [relay, STANDBY], [relay + 50, 0.03],                                         // relay throws: standby drops out
  [attempt, 0.03], [attempt + 500, 0.2], [attempt + 850, 0.38], [almost, 0.55],       // A: the transformer gathers, slowly
  [almost + 200, 0.34], [almost + 330, 0.47], [fail, 0.42], [fail + 380, 0],           //    nearly; a stumble; then it dies away
  [caught, 0], [caught + 120, 0.3], [caught + 500, 0.52], [caught + 680, 0.36],       // B: catches hard, struggles
  [caught + 900, 0.62], [caught + 1300, 0.76], [caught + 1450, 0.6], [caught + 1800, 0.84],
  [ignite - 80, 0.86], [ignite, 1.14], [ignite + 420, 1],                             // C: locks, overshoots, settles
  [surge, 1], [collapse, 1.3], [end, 1.3],                                            // D: the surge into the line
];

/* The supply at any moment (straight lines between the points). */
export function supplyAt(ms, points = SUPPLY) {
  if (ms <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (ms <= t1) {
      const [t0, v0] = points[i - 1];
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (ms - t0)) / (t1 - t0);
    }
  }
  return points[points.length - 1][1];
}

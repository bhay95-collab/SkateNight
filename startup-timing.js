/* ============================================================
   STARTUP TIMING - the INSERT COIN film's score. startup.js stages the
   pictures on these beats and sound.js plays on them, so the clink you hear
   is the jolt you see. Every time is in ms from the press.

   SUPPLY is the cabinet's one electrical supply, 0 (dead) to 1 (running),
   with 0.5 the tired standby the dormant cabinet sits on. The sign, the
   picture tube, the lamps, the room's light and the transformer hum all
   follow it, so a sag dims everything at once and the hum sags with it.
   tests/safety.test.js holds it to the flash budget.
   ============================================================ */

export const BEATS = {
  coinIn: 160,      // the coin swings into shot, close to the lens, out of focus
  align: 860,       // turned face-on, hanging over the slit; the rim catches the light
  descend: 1180,    // it sinks toward the door
  contact: 1600,    // its edge meets the slit and catches
  slip: 1900,       // the gate gives and it drops through
  gone: 2150,       // swallowed
  credit: 2820,     // the coin box: a clunk, and 1 CREDIT
  relay: 3220,      // the main relay pulls in - THUNK - and standby cuts out
  attempt: 3560,    // A: the supply tries...
  fail: 4140,       //    ...and dies
  catch: 4600,      // B: a second relay; the supply catches and climbs
  ignite: 6040,     // C: it locks - full ignition, swept through the cabinet
  surge: 7300,      // D: the tube surges and the camera dives into it
  collapse: 7960,   //    the picture squeezes to a line
  end: 8420,        //    the boot screen strikes from that line
};

/* Down the chute after it is swallowed: each bounce deeper, quieter, faster. */
export const CHUTE_CLINKS_MS = [60, 220, 350, 455, 540, 605, 655];

/* [ms, volts]. Dips are a few hundred ms wide and at most two to a second. */
const { relay, attempt, fail, catch: caught, ignite, surge, collapse, end } = BEATS;
export const SUPPLY = [
  [0, 0.5], [relay, 0.5], [relay + 50, 0.03],                                    // relay throws: standby drops out
  [attempt, 0.03], [attempt + 260, 0.34], [attempt + 380, 0.4],                // A: the first try
  [attempt + 460, 0.24], [attempt + 540, 0.38], [fail, 0.36], [fail + 260, 0.04],  // a stumble, then it dies
  [caught, 0.04], [caught + 90, 0.3], [caught + 420, 0.52], [caught + 560, 0.36],  // B: catches, struggles
  [caught + 700, 0.6], [caught + 1000, 0.74], [caught + 1120, 0.58], [caught + 1300, 0.82],
  [ignite - 60, 0.84], [ignite, 1.14], [ignite + 420, 1],                       // C: locks, overshoots, settles
  [surge, 1], [collapse, 1.3], [end, 1.3],                                      // D: the surge into the line
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

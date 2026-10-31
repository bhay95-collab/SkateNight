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

   The Song Inside (DESIGN.md): the machine is trying to play. After the
   first try dies there is a real dark; the second try is a heartbeat that
   quickens to the opener's own tempo (PULSE), two bars of the machine
   thumping in time, and a cut to black on the last beat - the song then
   begins in the dark on the same grid (app.js). The struggle lives in the
   pulse now, so the second try's supply climbs smoothly: no full-frame
   flicker, only small things (a letter, a group of bulbs, a shudder) on
   each beat.
   ============================================================ */
import { OPENER } from './rotation.js';

export const STANDBY = 0.2;
export const BEAT_MS = OPENER.beat * 1000;      // 446.5 ms: 134.4 BPM, the opener's measured tempo
export const LOCK_BEATS = 8;                    // two bars of the song's heartbeat without the song
const DARK_MS = 1800;                           // the real dark between the tries
const QUICKEN_MS = 2800;                        // the second try, from the heavier relay to the lock
const DEAD = 7550 + 380;                        // the first try's supply reaches nothing

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
  tick: DEAD + 900,                       // the dark: nothing but one small tick somewhere inside
  catch: DEAD + DARK_MS,                  // B: a heavier relay; the robot lights first, the heartbeat starts
  ignite: DEAD + DARK_MS + QUICKEN_MS,    // the lock: the heartbeat reaches the song's tempo, the machine is lit
  cut: DEAD + DARK_MS + QUICKEN_MS + (LOCK_BEATS - 1) * BEAT_MS,   // the last beat: cut to black
};
BEATS.end = BEATS.cut;                    // the film ends on the cut; the song begins in the dark (app.js)

/* Down the chute after it is swallowed: each bounce deeper, quieter, slower to ring out. */
export const CHUTE_CLINKS_MS = [70, 250, 400, 520, 615, 690, 750];

/* The pulse: the second try's heartbeat, quickening from about 60 BPM to the
   song's tempo so that its next beat would be the lock, then the lock's
   LOCK_BEATS beats, the last of them the cut. In ms from the press. */
function quicken(from, to, bpm0 = 60, curve = 1.6) {
  const bpm1 = 60000 / BEAT_MS;
  const beats = [to - BEAT_MS];
  for (;;) {
    const prev = beats[beats.length - 1];
    const along = Math.max(0, (prev - from) / (to - from));
    const next = prev - 60000 / (bpm0 + (bpm1 - bpm0) * along ** curve);
    if (next < from) break;
    beats.push(next);
  }
  return beats.reverse().map((ms) => Math.round(ms * 10) / 10);
}
export const PULSE = Object.freeze({
  heartbeat: Object.freeze(quicken(BEATS.catch + 250, BEATS.ignite)),
  lock: Object.freeze(Array.from({ length: LOCK_BEATS }, (_, k) => Math.round((BEATS.ignite + k * BEAT_MS) * 10) / 10)),
});

/* [ms, volts]. Dips are a few hundred ms wide and at most two to a second. */
const { relay, attempt, almost, fail, catch: caught, ignite, cut } = BEATS;
export const SUPPLY = [
  [0, STANDBY], [relay, STANDBY], [relay + 50, 0.03],                                 // relay throws: standby drops out
  [attempt, 0.03], [attempt + 500, 0.2], [attempt + 850, 0.38], [almost, 0.55],       // A: the transformer gathers, slowly
  [almost + 200, 0.34], [almost + 330, 0.47], [fail, 0.42], [fail + 380, 0],           //    nearly; a stumble; then it dies away
  [caught, 0], [caught + 120, 0.3], [caught + 900, 0.5], [caught + 1800, 0.7],        // B: catches hard and climbs, steadily now
  [ignite - 80, 0.86], [ignite, 1.14], [ignite + 420, 1],                             // the lock: overshoots, settles
  [cut, 1],                                                                           //    held, in tempo, to the last beat
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

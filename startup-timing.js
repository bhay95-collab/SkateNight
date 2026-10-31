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

/* The extended cut ("Bigger on the Inside", startup-inside.js): the camera
   follows the coin through the slit and falls with it through an interior
   far bigger than the cabinet; the first try fails in there, the second
   rises up through the machine on the heartbeat and out through the back of
   the screen, onto the lit cabinet for the lock. It is NOT approved for the
   show: the standard cut always plays, and this one only for a comparison,
   asked for in the address (?cut=extended). A preference saved by an earlier
   version (STORE_EXTENDED) is ignored and cleared, so it can never switch it
   on by surprise. Never with reduced motion, and not outside a page (the
   unit tests time the standard cut; they test this one through timeline(true)). */
export const STORE_EXTENDED = 'sn-extended-cut';
export function wantsExtended(env = {}) {
  try {
    const {
      browser = Boolean(globalThis.document),
      reduced = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
      search = globalThis.location?.search ?? '',
    } = env;
    if (!env.browser && browser) globalThis.localStorage?.removeItem(STORE_EXTENDED);   // a stale preference from an earlier version
    if (!browser || reduced) return false;
    return ['extended', 'plunge'].includes(new URLSearchParams(search).get('cut'));
  } catch {
    return false;
  }
}
export const EXTENDED = wantsExtended();
/* The Plunge (startup-plunge.js): Treatment A of the extended cut, rebuilt
   in WebGL. In development on its own branch, only with ?cut=plunge; it
   keeps the extended cut's timing. */
export const PLUNGE = (() => {
  try { return EXTENDED && new URLSearchParams(globalThis.location?.search ?? '').get('cut') === 'plunge'; } catch { return false; }
})();

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

/* The whole film's timing, standard or extended. Every time is in ms from the press. */
export function timeline(extended = false) {
  const fall = extended ? 1750 : 0;               // the extended cut's longer fall pushes everything from the relay on
  const quickenMs = extended ? 3600 : 2800;       // the second try: from the heavier relay to the lock (a longer rise inside)
  const dead = 7550 + 380 + fall;                 // the first try's supply reaches nothing
  const beats = {
    look: 700,        // the press: the machine holds its breath; then the robot looks toward the slot
    coinIn: 1100,     // the camera follows its look down to the door; a small coin rises into the lamp's light
    align: 1700,      // face-on over the slit, small in frame; the rim catches the light
    descend: 2050,    // it sinks toward the door
    contact: 2550,    // its edge meets the slit and catches
    slip: 2850,       // it is pressed, it resists - then the gate gives and it drops through
    gone: 3100,       // swallowed; the camera holds on the empty slot, then tilts up the machine
    credit: extended ? 6600 : 5150,   // after a long fall, far below: the coin box, a clunk, and 1 CREDIT
    relay: 5450 + fall,               // the main relay pulls in - THUNK - and standby cuts out
    attempt: 5950 + fall,             // A: the transformer gathers; a line creeps across the tube, one tube catches...
    almost: 7100 + fall,              //    ...it nearly holds...
    fail: 7550 + fall,                //    ...falters, and dies: line, tube, hum, all of it
    tick: dead + 900,                 // the dark: nothing but one small tick somewhere inside
    catch: dead + DARK_MS,            // B: a heavier relay; the robot lights first, the heartbeat starts
    ignite: dead + DARK_MS + quickenMs,                                  // the lock: the heartbeat reaches the song's tempo, the machine is lit
    cut: dead + DARK_MS + quickenMs + (LOCK_BEATS - 1) * BEAT_MS,        // the last beat: cut to black
  };
  if (extended) {
    Object.assign(beats, {
      inside: beats.gone + 500,       // through the slit: the camera is inside, falling with the coin
      surface: beats.ignite - 700,    // the rise reaches the back of the screen: the robot, enormous, reversed
      through: beats.ignite - 250,    // and pushes through it, out onto the lit cabinet for the lock
    });
  }
  beats.end = beats.cut;              // the film ends on the cut; the song begins in the dark (app.js)

  /* Down the chute after it is swallowed: a long fall, each bounce further
     down, quieter and wetter, the gaps opening as it drops away from us
     (and further still in the extended cut, where we fall with it). */
  const clinks = extended ? [150, 520, 930, 1380, 1860, 2370, 2900] : [70, 300, 560, 850, 1170, 1510, 1870];

  const pulse = Object.freeze({
    heartbeat: Object.freeze(quicken(beats.catch + 250, beats.ignite)),
    lock: Object.freeze(Array.from({ length: LOCK_BEATS }, (_, k) => Math.round((beats.ignite + k * BEAT_MS) * 10) / 10)),
  });

  /* [ms, volts]. Dips are a few hundred ms wide and at most two to a second. */
  const { relay, attempt, almost, fail, catch: caught, ignite, cut } = beats;
  const supply = [
    [0, STANDBY], [relay, STANDBY], [relay + 50, 0.03],                                 // relay throws: standby drops out
    [attempt, 0.03], [attempt + 500, 0.2], [attempt + 850, 0.38], [almost, 0.55],       // A: the transformer gathers, slowly
    [almost + 200, 0.34], [almost + 330, 0.47], [fail, 0.42], [fail + 380, 0],           //    nearly; a stumble; then it dies away
    [caught, 0], [caught + 120, 0.3], [caught + 900, 0.5], [caught + 1800, 0.7],        // B: catches hard and climbs, steadily now
    [ignite - 80, 0.86], [ignite, 1.14], [ignite + 420, 1],                             // the lock: overshoots, settles
    [cut, 1],                                                                           //    held, in tempo, to the last beat
  ];
  return { BEATS: beats, CHUTE_CLINKS_MS: clinks, PULSE: pulse, SUPPLY: supply };
}

export const { BEATS, CHUTE_CLINKS_MS, PULSE, SUPPLY } = timeline(EXTENDED);

/* Phase B: how long the robot is alone in the black tube before the line
   and the raster follow it (startup-robot.js, startup-power.js, sound.js). */
export const ROBOT_FIRST_MS = 450;

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

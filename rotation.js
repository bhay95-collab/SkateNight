/* ============================================================
   ROTATION - "HOUSE ROTATION": when the queue is empty the jukebox
   picks the next song itself so the rink is never silent.

   Two modes (the SHUFFLE button):
   - SHUFFLE (pickShuffle): a shuffled deck. Every song plays once before any
     song repeats, and the last-5 rule below still holds across the point where
     the deck is reshuffled.
   - IN ORDER (pickInOrder): follow the order of tracks.js, wrapping round.

   Rule: never repeat any of the last 5 songs played. If the library
   is too small for that (6 songs or fewer), it at least avoids the
   song that just played. If there is only one song, it repeats it
   rather than falling silent.
   ============================================================ */

export const RECENT_LIMIT = 5;

/* The night's opening: when SHUFFLE is on, the house plays these first (in a
   fresh order each time the site loads) before the rest of the library. Queued
   songs still jump ahead. Nothing on screen marks them out. */
export const OPENING_IDS = [
  'doing-away-with-my-religion', 'come-unto-me', 'rejoice-in-the-lord-always',
  'lift-up-holy-hands', 'you-are-worthy-o-lord', 'according-to-his-power',
  'praise-lifted-on-high', 'the-way-of-salvation', 'pray-without-ceasing',
  'bread-of-heaven', 'there-is-a-way',
];

/* The night's first song when the Awakening starts the music (app.js). It
   begins in the dark after the film's cut to black, on the lock's grid, and the
   jukebox is revealed on its bar 2 downbeat - the home chord - one complete
   bar after the steady groove begins. Measured from the file and confirmed by
   ear: a free first hit at 0.207 s, then 134.4 BPM (0.4465 s a beat) from bar 1
   at 1.798 s on B-flat, bar 2 at 3.584 s on E-flat. The band speeds up later
   in the song, so only these opening seconds may be timed from it. */
/* Re-measured (onset fit over the first 11 s, every band agrees): the beat
   itself falls at 0.21 s + n beats - the first hit, 0.66, 1.10, 1.55, and the
   drop at 1.99 where the bass comes in (it drops out again 3.1-5.4 s). The
   B-flat chord at 1.798 is pushed an eighth ahead of that beat, so bar1 and
   revealAt are off the percussive grid by about 0.2 s; they are kept only for
   the 'long' reveal being compared (app.js REVEALS). */
export const OPENER = Object.freeze({ id: 'praise-lifted-on-high', firstHit: 0.207, bar1: 1.798, beat: 0.4465, revealAt: 1.798 + 4 * 0.4465,
  grid: 0.21, drop: 0.21 + 4 * 0.4465 });

/* How the Awakening hands over to the jukebox.
   autoMusic off (TOOLS): exactly as before - the diagnostics screen on the
   first arrival in a tab, then the jukebox waits for START.
   autoMusic on: no diagnostics; the opener plays and lands the reveal, or, if it
   cannot (already played in this tab, missing, or a request is first in line),
   the jukebox is revealed and the next song starts the normal way. */
export function arrivalPlan({ autoMusic, firstBoot, nextId, openerPlayed }) {
  if (!autoMusic) return { diagnostics: firstBoot, music: 'none' };
  if (!nextId) return { diagnostics: false, music: 'none' };
  return { diagnostics: false, music: nextId === OPENER.id && !openerPlayed ? 'opener' : 'house' };
}

/* The night's opening order: the opener first when it is going to land the
   reveal, then the rest shuffled. */
export function openingOrder(ids, { lead = null, rng = Math.random } = {}) {
  if (!lead || !ids.includes(lead)) return shuffled(ids, rng);
  return [lead, ...shuffled(ids.filter((id) => id !== lead), rng)];
}

/* A shuffled copy (Fisher-Yates). */
export function shuffled(ids, rng = Math.random) {
  const out = ids.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* The first opening song that can play now and is not already planned. */
export function nextOpening({ opening, pool, planned }) {
  return opening.find((id) => pool.includes(id) && !planned.includes(id)) ?? null;
}

/* Remember a song as "recently played", keeping only the last few. */
export function pushRecent(recent, id, limit = RECENT_LIMIT) {
  return [...recent, id].slice(-limit);
}

/* Pick a song id from playableIds. rng() must give a number from 0 up to
   (not including) 1 - Math.random in the browser, a seeded one in tests. */
export function pickHouseTrack({ playableIds, recent, rng = Math.random, limit = RECENT_LIMIT }) {
  if (!playableIds || playableIds.length === 0) return null;
  if (playableIds.length === 1) return playableIds[0];

  const window = recent.slice(-limit);
  let candidates = playableIds.filter((id) => !window.includes(id));

  if (candidates.length === 0) {
    const justPlayed = recent[recent.length - 1];
    candidates = playableIds.filter((id) => id !== justPlayed);
  }
  if (candidates.length === 0) candidates = playableIds;

  return candidates[Math.floor(rng() * candidates.length) % candidates.length];
}

/* SHUFFLE: a shuffled deck.
     playableIds - songs that can play now
     bag         - songs already played in this deck
     recent      - the last few songs played (the last-5 rule)
   Returns { id, bag }. `bag` is the deck to keep: it is emptied when every song
   has had its turn (the caller adds each song to the bag when it STARTS, so
   songs chosen from the queue count too). id is null if nothing can play. */
export function pickShuffle({ playableIds, bag, recent, rng = Math.random, limit = RECENT_LIMIT }) {
  if (!playableIds || playableIds.length === 0) return { id: null, bag: [] };
  if (playableIds.length === 1) return { id: playableIds[0], bag: [] };

  const window = recent.slice(-limit);
  let keep = bag.filter((id) => playableIds.includes(id));
  let remaining = playableIds.filter((id) => !keep.includes(id));
  if (remaining.length === 0) {            // everyone has had a turn: reshuffle the deck
    keep = [];
    remaining = playableIds.slice();
  }

  let candidates = remaining.filter((id) => !window.includes(id));
  if (candidates.length === 0) {
    const justPlayed = recent[recent.length - 1];
    candidates = remaining.filter((id) => id !== justPlayed);
  }
  if (candidates.length === 0) candidates = playableIds.filter((id) => id !== recent[recent.length - 1]);
  if (candidates.length === 0) candidates = playableIds;

  return { id: candidates[Math.floor(rng() * candidates.length) % candidates.length], bag: keep };
}

/* IN ORDER: the song after currentId in the tracks.js order (wrapping), skipping
   anything that cannot play. Unknown / no current song starts at the top. */
export function pickInOrder({ orderIds, playableIds, currentId }) {
  const playable = new Set(playableIds);
  const start = orderIds.indexOf(currentId);
  for (let step = 1; step <= orderIds.length; step++) {
    const id = orderIds[(start + step + orderIds.length) % orderIds.length];
    if (playable.has(id)) return id;
  }
  return null;
}

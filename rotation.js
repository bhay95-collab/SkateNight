/* ============================================================
   ROTATION - "HOUSE ROTATION": when the queue is empty the jukebox
   picks the next song itself so the rink is never silent.

   Rule: never repeat any of the last 5 songs played. If the library
   is too small for that (6 songs or fewer), it at least avoids the
   song that just played. If there is only one song, it repeats it
   rather than falling silent.
   ============================================================ */

export const RECENT_LIMIT = 5;

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

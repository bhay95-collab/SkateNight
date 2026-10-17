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

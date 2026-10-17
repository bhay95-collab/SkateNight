/* ============================================================
   QUEUE - the "UP NEXT" list. First in, first out.

   Every function returns a NEW list and leaves the old one alone,
   so the screen can safely compare before and after.
   ============================================================ */

// A stuck keypad key must never be able to queue thousands of songs.
export const MAX_QUEUE = 30;

/* Add a song to the back. Returns { queue, ok, reason }.
   reason is 'duplicate' (already waiting) or 'full'. */
export function enqueue(queue, id) {
  if (queue.includes(id)) return { queue: queue.slice(), ok: false, reason: 'duplicate' };
  if (queue.length >= MAX_QUEUE) return { queue: queue.slice(), ok: false, reason: 'full' };
  return { queue: [...queue, id], ok: true, reason: null };
}

/* Take the song at the front. Returns { next, queue }; next is null if empty. */
export function takeNext(queue) {
  if (queue.length === 0) return { next: null, queue: [] };
  return { next: queue[0], queue: queue.slice(1) };
}

/* Remove the song at this position (0 = front). Bad positions do nothing. */
export function cancelAt(queue, index) {
  if (!Number.isInteger(index) || index < 0 || index >= queue.length) return queue.slice();
  return [...queue.slice(0, index), ...queue.slice(index + 1)];
}

/* Swap a song with the one above it. The front song stays put. */
export function moveUp(queue, index) {
  if (!Number.isInteger(index) || index < 1 || index >= queue.length) return queue.slice();
  const next = queue.slice();
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next;
}

/* Remove songs that turned out to be broken (file missing, etc). */
export function dropIds(queue, ids) {
  const gone = new Set(ids);
  return queue.filter((id) => !gone.has(id));
}

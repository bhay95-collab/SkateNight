/* ============================================================
   ORNAMENT - what the film no longer needs, kept for comparison.

   Stage 5 of the Awakening retires the ornament nobody sees from the back of
   a dark rink: the coin's spin and shine, the dust shaken off the arch, the
   glints across the chrome, and the surplus neon struggle (the letter that
   catches, drops and catches again, and the two dead letters that wait for
   the lock). Each can be brought back for an A/B comparison from the address:
     ?ornament=all                  everything, as before
     ?ornament=spin,dust            just those (spin, dust, glints, neon)
   Without it, none of them. Anything nobody misses stays out.
   ============================================================ */
export const ORNAMENTS = Object.freeze(['spin', 'dust', 'glints', 'neon']);

export function ornaments(search = globalThis.location?.search ?? '') {
  const asked = new URLSearchParams(search).get('ornament');
  if (asked == null) return new Set();
  const names = asked === '' || asked === 'all' ? ORNAMENTS : asked.split(',').map((n) => n.trim());
  return new Set(names.filter((n) => ORNAMENTS.includes(n)));
}

export const ORNAMENT = ornaments();

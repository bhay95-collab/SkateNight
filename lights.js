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

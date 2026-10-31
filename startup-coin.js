/* ============================================================
   STARTUP COIN - the key, filmed small.

   The coin is a real disc: two struck faces, a reeded edge of stacked
   discs, a specular band that moves as it turns. It is never the hero: it
   rises small into the slot lamp's light, turns its face to the light,
   sinks to the door - its shadow tightening on the entry's top, the lamp
   warming its lower edge - meets the slit and catches; the gate gives a
   fraction; it wobbles on its edge; then gravity has it and the throat
   swallows it. The entry clips it exactly at the slit, so it really goes IN
   (and the coin only ever travels above that line, so the clip never has to
   change). The lamp dies as it passes. Then the long fall: seven clinks,
   each further down, and far below the coin box clunks and the mechanical
   counter flips to 1 CREDIT. The sound (sound.js, with its interior) makes
   the machine big; the picture keeps the coin small.

   Times are BEATS / CHUTE_CLINKS_MS (startup-timing.js); sound.js plays the
   matching contact, slip and chute on the same beats.
   ============================================================ */
import { BEATS, CHUTE_CLINKS_MS, STANDBY } from './startup-timing.js';
import { RESPONSE } from './startup-power.js';

const EDGE_LAYERS = 14;
const AT_SLOT = 1 / 3;              // the coin is drawn at its biggest; this is its size at the door
const { coinIn, align, descend, contact, slip, gone, credit, relay } = BEATS;

/* The coin's edge: thin discs stacked between the two faces. */
export function buildCoinEdge(spin) {
  const front = spin?.querySelector('.hero-front');
  if (!front) return;
  const layers = Array.from({ length: EDGE_LAYERS }, (_, i) => {
    const layer = document.createElement('span');
    layer.className = 'hero-edge';
    layer.style.transform = `translateZ(calc(var(--thick) * ${((i + 0.5) / EDGE_LAYERS - 0.5).toFixed(3)}))`;
    return layer;
  });
  // edges, then the back, then the front: real 3D sorts by depth anyway, and
  // where an engine flattens the coin the face showing still paints on top
  spin.prepend(...layers);
  spin.append(front);
}

const at = (ms) => ms / gone;
const pose = (x, y, s, { blur = 0, tilt = 0, seen = 1 } = {}) => ({
  transform: `translate(${x}em, ${y}em) rotate(${tilt}deg) scale(${s})`, filter: `blur(${blur}px)`, opacity: seen,
});
const turn = (x, y, z) => ({ transform: `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)` });

/* Where the coin is, from out of the light to through the slit. Its anchor
   is the middle of its bottom edge, sitting on the slit, so y = 0 is
   "touching". It rises into the lamp's light, small, hangs a moment, sinks,
   meets the slit, is pressed against it and resists - and then the gate
   gives and gravity has it. */
function flight() {
  const small = AT_SLOT * 1.12;
  return [
    { offset: 0, ...pose(0.6, -2.5, small, { seen: 0 }) },
    { offset: at(coinIn), ...pose(0.6, -2.5, small, { seen: 0 }), easing: 'cubic-bezier(.25,.6,.3,1)' },   // up out of the dark, into the lamp's light
    { offset: at(coinIn + 250), ...pose(0.4, -4.6, small, { seen: 1 }), easing: 'cubic-bezier(.3,0,.25,1)' },
    { offset: at(align), ...pose(0, -6.2, small), easing: 'ease-in-out' },
    { offset: at(descend), ...pose(0, -6.5, small), easing: 'cubic-bezier(.42,0,.2,1)' },          // hanging there, a breath
    { offset: at(contact), ...pose(0, 0, AT_SLOT), easing: 'cubic-bezier(.2,.8,.3,1)' },
    { offset: at(contact + 60), ...pose(0, 0.2, AT_SLOT, { tilt: 2.4 }), easing: 'ease-out' },           // it catches on the lip
    { offset: at(contact + 150), ...pose(0, 0.28, AT_SLOT, { tilt: -1.3 }), easing: 'ease-in-out' },     // pressed: it will not go
    { offset: at(contact + 240), ...pose(0, 0.33, AT_SLOT, { tilt: 0.5 }), easing: 'ease-in-out' },      // straining at the gate
    { offset: at(slip), ...pose(0, 0.4, AT_SLOT), easing: 'cubic-bezier(.55,0,1,.45)' },               // then it yields, and gravity
    { offset: 1, ...pose(0, 9, AT_SLOT) },
  ];
}

/* It turns its face to the light as it rises, and the rim catches it once. */
function tumble() {
  return [
    { offset: 0, ...turn(8, -38, -6) },
    { offset: at(coinIn), ...turn(8, -38, -6), easing: 'cubic-bezier(.3,.55,.3,1)' },
    { offset: at(align), ...turn(2, 4, -1), easing: 'ease-in-out' },
    { offset: at(align + 200), ...turn(0, -10, 0), easing: 'ease-in-out' },          // the rim turns into the light
    { offset: at(descend), ...turn(0, 0, 0) },
    { offset: 1, ...turn(0, 0, 0) },
  ];
}

export function stageCoin(el) {
  const total = { duration: gone, fill: 'forwards' };
  el.hero.animate(flight(), total);
  el.spin.animate(tumble(), total);
  // light crossing the face once, as it hangs in the lamp's light
  const band = (x) => ({ transform: `translateX(${x}%)` });           // -100% before the face, 33.3% past it
  el.shine.animate([
    { offset: 0, ...band(-100) }, { offset: at(align - 100), ...band(-100) }, { offset: at(descend + 100), ...band(33.3) }, { offset: 1, ...band(33.3) },
  ], { ...total, easing: 'ease-in-out' });
  // the 25 faces the light from the start (the robot side never turns to us)
  el.spin.querySelector('.hero-front')?.animate([{ opacity: 1 }, { opacity: 1 }], total);
  el.spin.querySelector('.hero-back')?.animate([{ opacity: 0 }, { opacity: 0 }], total);
  // the slot lamp warming its lower edge as it comes down to the slit
  el.coinLamp.animate([{ opacity: 0 }, { opacity: 0, offset: at(descend) }, { opacity: 0.9, offset: at(contact) }, { opacity: 1 }], total);
  el.shadow.animate([
    { opacity: 0, transform: 'scaleX(2.6)' }, { opacity: 0, transform: 'scaleX(2.6)', offset: at(descend) },
    { opacity: 0.85, transform: 'scaleX(1)', offset: at(contact) }, { opacity: 0.85, transform: 'scaleX(1)', offset: at(slip) },
    { opacity: 0, transform: 'scaleX(.8)' },
  ], { ...total, easing: 'ease-in' });
  el.throat.animate([{ opacity: 0 }, { opacity: 0, offset: at(contact) }, { opacity: 0.55, offset: at(slip) }, { opacity: 0.9, offset: 0.97 }, { opacity: 0 }], total);
}

/* The mechanism answering: the gate gives, the slot light is blocked then
   floods back, every clink in the chute, the coin box, the counter. */
export function stageMechanism(el, at, cue) {
  at(contact, () => cue('contact'));
  at(gone, () => cue('chute'));
  el.gate.animate([
    { transform: 'translateY(0)' }, { transform: 'translateY(.16em)', offset: 0.08 }, { transform: 'translateY(.09em)', offset: 0.3 },   // pressed, it pushes back
    { transform: 'translateY(.14em)', offset: 0.5 }, { transform: 'translateY(.3em)', offset: 0.57 },                                 // then gives
    { transform: 'translateY(-.06em)', offset: 0.86 }, { transform: 'translateY(0)' },
  ], { delay: contact, duration: gone + 120 - contact, easing: 'ease-out', composite: 'add' });
  // The robot's look wakes the slot lamp - it stutters, catches - and its
  // light is what shows the coin door and the coin (both dark on standby).
  // It dies as the coin passes; the relay takes the rest (followSupply).
  const lampAt = (ms) => ms / relay;
  const lampOn = coinIn - 250;
  el.lamp.animate([
    { opacity: 0 }, { opacity: 0, offset: lampAt(lampOn) }, { opacity: 0.5, offset: lampAt(lampOn + 40) },
    { opacity: 0.15, offset: lampAt(lampOn + 140) }, { opacity: 0.8, offset: lampAt(lampOn + 400) }, { opacity: 0.8, offset: lampAt(descend) },
    { opacity: 0.55, offset: lampAt(contact) }, { opacity: 0.3, offset: lampAt(gone) },
    { opacity: 0.45, offset: lampAt(gone + 120) }, { opacity: 0, offset: lampAt(gone + 900) }, { opacity: 0 },
  ], { duration: relay, fill: 'forwards' });
  const dark = RESPONSE.door(STANDBY).filter;
  const lamplit = RESPONSE.door(0.5).filter;
  el.door.animate([
    { filter: dark }, { filter: dark, offset: lampAt(lampOn) }, { filter: 'brightness(.62)', offset: lampAt(lampOn + 40) },
    { filter: 'brightness(.34)', offset: lampAt(lampOn + 140) }, { filter: lamplit, offset: lampAt(lampOn + 440) }, { filter: lamplit, offset: lampAt(gone + 120) },
    { filter: dark, offset: lampAt(gone + 900) }, { filter: dark },
  ], { duration: relay, fill: 'forwards' });
  CHUTE_CLINKS_MS.forEach((ms, i) => {
    const fade = (1 - i / CHUTE_CLINKS_MS.length) ** 2;   // only the first few are near enough to move the entry
    if (fade > 0.15) jolt(el.mech, 0.03 + 0.12 * fade, gone + ms);
  });
  jolt(el.door, 0.28, credit);
  flipCounter(el.label, at);
}

function jolt(target, em, delay) {
  target?.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${em}em)` }, { transform: `translateY(${-em * 0.3}em)` }, { transform: 'translateY(0)' }],
    { delay, duration: 220, easing: 'ease-out', composite: 'add' });
}

/* A mechanical counter flipping over to show the credit. */
function flipCounter(label, at) {
  if (!label) return;
  label.animate([{ transform: 'rotateX(0)' }, { transform: 'rotateX(-90deg)' }],
    { delay: credit, duration: 140, easing: 'cubic-bezier(.55,0,1,.45)' });
  at(credit + 140, () => { label.textContent = '1 CREDIT'; label.classList.add('is-credited'); });
  label.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(-12deg)', offset: 0.7 }, { transform: 'rotateX(0)' }],
    { delay: credit + 140, duration: 320, easing: 'cubic-bezier(.23,1,.32,1)' });
}

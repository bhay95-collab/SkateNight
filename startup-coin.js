/* ============================================================
   STARTUP COIN - the one small physical act that starts everything.

   The coin is a real disc: two struck faces, a reeded edge of stacked
   discs, a specular band that moves as it turns. It swings into shot close
   to the lens and out of focus, turns over (the robot, then the 25), comes
   face-on over the coin entry, and sinks toward the door - shrinking as it
   moves away from us, its shadow tightening on the entry's top, the slot
   lamp warming its lower edge. It meets the slit and catches; the gate
   gives a fraction; it wobbles on its edge; then gravity has it and the
   throat swallows it. The entry clips it exactly at the slit, so it really
   goes IN (and the coin only ever travels above that line, so the clip
   never has to change). Seven clinks carry it down inside the cabinet, then the coin box
   clunks and the mechanical counter flips to 1 CREDIT.

   Times are BEATS / CHUTE_CLINKS_MS (startup-timing.js); sound.js plays the
   matching contact, slip and chute on the same beats.
   ============================================================ */
import { BEATS, CHUTE_CLINKS_MS } from './startup-timing.js';

const EDGE_LAYERS = 14;
const AT_SLOT = 1 / 3;              // the coin is drawn at its biggest; this is its size at the door
const { coinIn, align, descend, contact, slip, gone, credit, relay } = BEATS;

/* The coin's edge: thin discs stacked between the two faces. */
export function buildCoinEdge(spin) {
  const back = spin?.querySelector('.hero-back');
  if (!back) return;
  for (let i = 0; i < EDGE_LAYERS; i++) {
    const layer = document.createElement('span');
    layer.className = 'hero-edge';
    layer.style.transform = `translateZ(calc(var(--thick) * ${((i + 0.5) / EDGE_LAYERS - 0.5).toFixed(3)}))`;
    spin.insertBefore(layer, back);
  }
}

const at = (ms) => ms / gone;
const pose = (x, y, s, { blur = 0, tilt = 0, seen = 1 } = {}) => ({
  transform: `translate(${x}em, ${y}em) rotate(${tilt}deg) scale(${s})`, filter: `blur(${blur}px)`, opacity: seen,
});
const turn = (x, y, z) => ({ transform: `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)` });

/* Where the coin is, from out of shot to through the slit. Its anchor is the
   middle of its bottom edge, sitting on the slit, so y = 0 is "touching". */
function flight() {
  return [
    { offset: 0, ...pose(30, -2, 1.3, { blur: 9, seen: 0 }) },
    { offset: at(coinIn), ...pose(30, -2, 1.3, { blur: 9, seen: 0 }), easing: 'cubic-bezier(.25,.7,.35,1)' },   // into the light, at the lens
    { offset: at(520), ...pose(11, -8, 0.92, { blur: 4 }), easing: 'cubic-bezier(.4,0,.2,1)' },
    { offset: at(align), ...pose(0, -11, 0.62), easing: 'ease-in-out' },
    { offset: at(1030), ...pose(0, -11.6, 0.62), easing: 'ease-in-out' },          // held, not quite still
    { offset: at(descend), ...pose(0, -11.2, 0.62), easing: 'cubic-bezier(.42,0,.18,1)' },
    { offset: at(contact), ...pose(0, 0, AT_SLOT), easing: 'cubic-bezier(.2,.8,.3,1)' },
    { offset: at(contact + 80), ...pose(0, 0.22, AT_SLOT, { tilt: 2.6 }), easing: 'ease-in-out' },  // it catches
    { offset: at(contact + 160), ...pose(0, 0.3, AT_SLOT, { tilt: -1.7 }), easing: 'ease-in-out' },
    { offset: at(contact + 230), ...pose(0, 0.36, AT_SLOT, { tilt: 0.8 }), easing: 'ease-in-out' },
    { offset: at(slip), ...pose(0, 0.42, AT_SLOT), easing: 'cubic-bezier(.55,0,1,.45)' },        // then gravity
    { offset: 1, ...pose(0, 9, AT_SLOT) },
  ];
}

/* The tumble: the robot side to the light first, then a quick turn through
   edge-on round to the 25. */
function tumble() {
  return [
    { offset: 0, ...turn(-24, -205, -24) },
    { offset: at(coinIn), ...turn(-24, -205, -24), easing: 'cubic-bezier(.3,.55,.3,1)' },
    { offset: at(520), ...turn(-10, -128, 8), easing: 'cubic-bezier(.55,0,.45,1)' },
    { offset: at(700), ...turn(4, -24, -4), easing: 'cubic-bezier(.2,.7,.3,1)' },
    { offset: at(align), ...turn(3, 6, -2), easing: 'ease-in-out' },
    { offset: at(1060), ...turn(0, -11, 0), easing: 'ease-in-out' },                 // the rim turns into the light
    { offset: at(descend), ...turn(0, 0, 0) },
    { offset: 1, ...turn(0, 0, 0) },
  ];
}

export function stageCoin(el) {
  const total = { duration: gone, fill: 'forwards' };
  el.hero.animate(flight(), total);
  el.spin.animate(tumble(), total);
  // light catching the face: a flash as it turns through the light, one slow sweep as it hangs
  const band = (x) => ({ transform: `translateX(${x}%)` });           // -100% before the face, 33.3% past it
  el.shine.animate([
    { offset: 0, ...band(-100) }, { offset: at(560), ...band(-100) }, { offset: at(720), ...band(33.3) },
    { offset: at(880), ...band(-100) }, { offset: at(1170), ...band(33.3) }, { offset: 1, ...band(33.3) },
  ], { ...total, easing: 'ease-in-out' });
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
    { transform: 'translateY(0)' }, { transform: 'translateY(.2em)', offset: 0.12 }, { transform: 'translateY(.12em)', offset: 0.55 },
    { transform: 'translateY(.26em)', offset: 0.62 }, { transform: 'translateY(-.06em)', offset: 0.9 }, { transform: 'translateY(0)' },
  ], { delay: contact, duration: gone + 120 - contact, easing: 'ease-out', composite: 'add' });
  const lampAt = (ms) => (ms - descend) / (relay - descend);
  el.lamp.animate([
    { opacity: 0.8 }, { opacity: 0.55, offset: lampAt(contact) }, { opacity: 0.3, offset: lampAt(gone) },
    { opacity: 1, offset: lampAt(gone + 140) }, { opacity: 0.85, offset: lampAt(gone + 500) }, { opacity: 0.85 },
  ], { delay: descend, duration: relay - descend, fill: 'forwards' });
  CHUTE_CLINKS_MS.forEach((ms, i) => {
    const fade = 1 - i / CHUTE_CLINKS_MS.length;
    jolt(el.mech, 0.05 + 0.12 * fade, gone + ms);
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

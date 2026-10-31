/* ============================================================
   STARTUP ROBOT - the one character, and what it does.

   The phosphor robot (drawn in startup.js) is the only living thing in the
   dormant frame. In the film it acts, with nothing but looks and light:
     the press    it stops breathing and holds at half its glow (startup.js)
     the look     its eyes brighten and drop toward the slot; the camera and
                  the slot lamp follow that look (startup.js, startup-coin.js)
     the relay    the picture collapses and takes it; it is lifted off the
                  picture so it can come back on its own
     A            it flickers back, faint, on the failing supply, and dies
                  with it
     B            at the heavier relay it lights first - alone and brighter
                  than ever in the black tube - and the machine follows it:
                  the line, the raster, the snow come after (startup-power.js)
     the lock     a bright accent, then it holds, lit, to the cut
   It stays the robot in the lit tube: the framed logo tile is never shown
   once the robot has been drawn (styles.css).
   ============================================================ */
import { BEATS, supplyAt } from './startup-timing.js';
import { thin } from './startup-power.js';

const { look, coinIn, gone, relay, attempt, fail, catch: caught, ignite, end } = BEATS;
const STEP_MS = 30;

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const span = (from, to) => ({ delay: from, duration: to - from, fill: 'forwards' });

/* Its two eyes, as glows laid over the drawn ones (the logo's eye grilles). */
export function addEyes(holder) {
  return ['is-left', 'is-right'].map((side) => {
    const eye = document.createElement('i');
    eye.className = `phos-eye ${side}`;
    holder.append(eye);
    return eye;
  });
}

/* The robot's level after the relay, 0..1.2 (holder opacity, then brightness above 1). */
export function robotLevelAt(ms) {
  if (ms < attempt + 300 || (ms >= fail + 300 && ms < caught + 60)) return 0;
  if (ms < caught) {                                   // A: faint, on the failing supply, and dying with it
    const v = supplyAt(ms);
    return clamp((v - 0.12) * 0.75, 0, 0.32) * (ms > fail ? clamp(1 - (ms - fail) / 300) : 1);
  }
  if (ms < caught + 310) return clamp((ms - caught - 60) / 250) * 1.15;   // B: it lights first, alone
  if (ms < ignite) return 1.15;
  if (ms < ignite + 700) return 1.15 + 0.35 * (1 - (ms - ignite) / 700);    // the lock: a bright accent, settling
  return 1.15;
}

export function stageRobot(el, at) {
  const { holder, core, bloom, eyes = [] } = el.robot;
  if (!holder) return;
  // The look: its eyes brighten and drop toward the slot, before anything else moves.
  eyes.forEach((eye) => eye.animate([
    { opacity: 0, transform: 'translate(0, 0)' },
    { opacity: 0, transform: 'translate(0, 0)', offset: look / relay },
    { opacity: 0.85, transform: 'translate(0, .5em)', offset: (look + 450) / relay, easing: 'ease-in-out' },
    { opacity: 0.75, transform: 'translate(0, .55em)', offset: gone / relay, easing: 'ease-in' },
    { opacity: 0.6, transform: 'translate(0, .8em)', offset: (gone + 400) / relay },   // it follows the coin down
    { opacity: 0.6, transform: 'translate(0, .8em)' },
  ], { duration: relay, fill: 'forwards', easing: 'cubic-bezier(.3,0,.2,1)' }));
  const nod = holder.animate([{ transform: 'translate(0, 0)' }, { transform: 'translate(0, 0)', offset: look / coinIn }, { transform: 'translate(0, .18em)' }],
    { duration: coinIn, fill: 'forwards', easing: 'ease-in-out' });   // a slight nod toward the door

  // The relay collapses the picture and takes the robot with it; then it is
  // lifted off the picture (still dark) so it can light on its own. Its
  // level is scheduled now, from the press, like everything else.
  const frames = [];
  for (let ms = relay + 100; ms < end; ms += STEP_MS) {
    const l = robotLevelAt(ms);
    frames.push({ offset: (ms - relay - 100) / (end - relay - 100), opacity: Math.min(1, l), filter: `brightness(${Math.max(1, l).toFixed(3)})` });
  }
  frames.push({ offset: 1, opacity: 1, filter: `brightness(${robotLevelAt(end).toFixed(3)})` });
  holder.animate(thin(frames), { ...span(relay + 100, end), easing: 'linear' });
  at(relay + 100, () => {
    eyes.forEach((eye) => eye.remove());
    nod.cancel();
    holder.style.opacity = '0';                  // dark until its level takes over, even for a frame
    holder.parentElement?.after(holder);
    holder.classList.add('is-free');
  });
  // Brighter than ever: the drawn robot and its bloom go to full as it leads.
  core?.animate([{ opacity: 0.6 }, { opacity: 1 }], { ...span(caught + 60, caught + 310), easing: 'ease-out' });
  bloom?.animate([{ opacity: 0.5 }, { opacity: 0.95 }], { ...span(caught + 60, caught + 400), easing: 'ease-out' });
}

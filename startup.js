/* ============================================================
   STARTUP - the INSERT COIN screen: an old cabinet in a basement, dust
   sheet just pulled off, waiting on standby power.

   wakeAttract(attract) brings the dormant screen to life (dust in the
   window light, grain on the glass, a couple of dead neon tubes, the supply
   browning out now and then) and returns { insert }.

   insert({ onCoin, onPower, collapse }) plays the coin going in and the
   cabinet powering up, calling onCoin as the coin drops through the slit and
   onPower as the relay pulls in (app.js plays the sounds there). With
   collapse, the picture finishes squeezed to the bright line that the boot
   screen's strike opens from; without it (boot already seen this tab) the
   caller fades the screen out instead. Resolves when it is done.

   Photosensitive budget: sags come from planSag (lights.js, tested); the
   power-up has two dips at 0.12 s and 0.6 s, matching the sound's hum.
   ============================================================ */
import { planSag } from './lights.js';

const MOTES = 16;
const DEAD_TUBES = 2;
const DORMANT = 'brightness(.5) saturate(.55)';      // matches .attract-marquee in styles.css
const POWER_MS = 1150;
const COLLAPSE_MS = 300;

const between = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* A tile of static, made once, for the grain layer to jump about. */
function grainTile() {
  const size = 140;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() < 0.5 ? 0 : 255;
  }
  ctx.putImageData(img, 0, 0);
  return `url(${canvas.toDataURL()})`;
}

function addMotes(room) {
  for (let i = 0; i < MOTES; i++) {
    const mote = document.createElement('span');
    mote.className = 'mote';
    const vars = {
      '--x': `${between(4, 60)}%`, '--y': `${between(10, 95)}%`, '--s': `${between(1.5, 3.5)}px`,
      '--dx': `${between(4, 14)}vw`, '--dy': `${between(-26, -8)}vh`, '--o': between(0.25, 0.75).toFixed(2),
      '--d': `${between(14, 28).toFixed(1)}s`, '--delay': `${(-between(0, 28)).toFixed(1)}s`,
    };
    for (const [k, v] of Object.entries(vars)) mote.style.setProperty(k, v);
    room.append(mote);
  }
}

/* Each letter of the title becomes its own neon tube ("by" is plain plastic). */
function wrapTubes(title) {
  const tubes = [];
  for (const word of title.querySelectorAll(':scope > span:not(.by)')) {
    const letters = [...word.textContent].map((ch) => {
      const tube = document.createElement('i');
      tube.className = 'neon-letter';
      tube.textContent = ch;
      tubes.push(tube);
      return tube;
    });
    word.replaceChildren(...letters);
  }
  return tubes;
}

export function wakeAttract(attract) {
  const marquee = attract.querySelector('.attract-marquee');
  const picture = attract.querySelector('.attract-picture');
  const door = attract.querySelector('.door-plate');
  const slot = attract.querySelector('.door-slot');
  const coin = attract.querySelector('.door-coin');
  const label = attract.querySelector('.attract-coin');
  const title = attract.querySelector('.attract-title');

  attract.style.setProperty('--grain', grainTile());
  addMotes(attract.querySelector('.attract-room'));
  const tubes = title ? wrapTubes(title) : [];
  const dead = new Set();
  while (tubes.length && dead.size < Math.min(DEAD_TUBES, tubes.length)) dead.add(pick(tubes));
  for (const tube of dead) tube.classList.add('is-dead');

  let awake = true;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (awake) fn(); }, ms);
    timers.add(id);
  };

  /* The tired supply: the marquee browns out and swims sideways. */
  const sag = () => {
    const plan = planSag();
    if (!document.hidden) {
      marquee.animate(plan.keyframes.map((k) => ({
        offset: k.offset,
        filter: `brightness(${(0.5 * (1 - k.dim)).toFixed(3)}) saturate(.55)`,
        transform: `translateX(${k.shift}em)`,
      })), { duration: plan.duration, easing: 'linear' });
      door.animate(plan.keyframes.map((k) => ({ offset: k.offset, filter: `brightness(${(1 - k.dim * 0.35).toFixed(3)})` })),
        { duration: plan.duration, easing: 'linear' });
    }
    later(sag, plan.duration + plan.nextInMs);
  };
  later(sag, between(700, 1600));

  /* A tube catching for a moment, now and then. */
  const stutter = () => {
    const tube = pick(tubes);
    if (tube && !document.hidden) {
      const lit = tube.classList.contains('is-dead') ? 0.22 : 1;
      tube.animate([{ opacity: lit }, { opacity: lit === 1 ? 0.3 : 0.85 }, { opacity: lit }, { opacity: lit === 1 ? 0.4 : 0.7 }, { opacity: lit }],
        { duration: 460, easing: 'steps(4, end)' });
    }
    later(stutter, between(1800, 5200));
  };
  if (tubes.length) later(stutter, between(900, 2400));

  function powerUp() {
    attract.classList.add('is-powered');
    marquee.getAnimations().forEach((a) => a.cancel());
    marquee.animate([
      { offset: 0, filter: `${DORMANT} hue-rotate(0deg)`, transform: 'translateX(0)' },
      { offset: 0.05, filter: 'brightness(.95) saturate(.9) hue-rotate(16deg)', transform: 'translateX(-.28em)' },
      { offset: 0.11, filter: 'brightness(.42) saturate(.7) hue-rotate(-14deg)', transform: 'translateX(.22em)' },    // dip 1
      { offset: 0.22, filter: 'brightness(1.06) saturate(1) hue-rotate(10deg)', transform: 'translateX(-.15em)' },
      { offset: 0.36, filter: 'brightness(.96) saturate(1) hue-rotate(-7deg)', transform: 'translateX(.09em)' },
      { offset: 0.52, filter: 'brightness(.56) saturate(.9) hue-rotate(5deg)', transform: 'translateX(-.05em)' },    // dip 2
      { offset: 0.62, filter: 'brightness(1.08) saturate(1) hue-rotate(-3deg)', transform: 'translateX(.02em)' },
      { offset: 0.8, filter: 'brightness(1) saturate(1) hue-rotate(1deg)', transform: 'translateX(0)' },
      { offset: 1, filter: 'brightness(1) saturate(1) hue-rotate(0deg)', transform: 'translateX(0)' },
    ], { duration: POWER_MS, easing: 'linear' });
    for (const tube of tubes) {                      // every tube strikes, each in its own time
      tube.classList.remove('is-dead');
      tube.animate([{ opacity: 0.22 }, { opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }],
        { duration: 420, delay: between(120, 560), easing: 'steps(3, end)', fill: 'backwards' });
    }
  }

  async function insert({ onCoin = () => {}, onPower = () => {}, collapse = true } = {}) {
    awake = false;
    timers.forEach(clearTimeout);
    timers.clear();
    attract.classList.add('is-inserting');

    // Picked up: a small lift and the coin squares up to the slit.
    await coin.animate([{ transform: 'translateY(0) rotateY(0)' }, { transform: 'translateY(-.5em) rotateY(0)' }],
      { duration: 150, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards' }).finished;

    // Dropped: gravity takes it through the slit.
    const drop = coin.animate([{ transform: 'translateY(-.5em)' }, { transform: 'translateY(4.4em)' }],
      { duration: 300, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' });
    await wait(170);                                 // the coin's lower edge reaches the slit
    onCoin();
    door.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(.16em)' }, { transform: 'translateY(0)' }],
      { duration: 240, easing: 'cubic-bezier(.23,1,.32,1)' });
    slot.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.9)' }, { filter: 'brightness(1.15)' }],
      { duration: 700, easing: 'ease-out' });
    await drop.finished;
    label.textContent = '1 CREDIT';
    label.classList.add('is-credited');

    await wait(260);                                 // the coin rattles down the chute
    onPower();
    powerUp();
    await wait(POWER_MS + 120);

    if (!collapse) return;
    // The picture squeezes to a bright line: the boot screen opens from it.
    await picture.animate([
      { transform: 'scale(1, 1)', filter: 'brightness(1)' },
      { transform: 'scale(1, .02)', filter: 'brightness(2.2)', offset: 0.75 },
      { transform: 'scale(.98, .006)', filter: 'brightness(2.4)' },
    ], { duration: COLLAPSE_MS, easing: 'cubic-bezier(.55,0,.9,.45)', fill: 'forwards' }).finished;
  }

  return { insert };
}

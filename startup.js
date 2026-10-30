/* ============================================================
   STARTUP - the INSERT COIN screen: the jukebox's own cabinet standing in
   a basement, dust sheet just pulled off, too big for the frame, alive only
   on a tired standby supply. One coin wakes it.

   wakeAttract(attract) builds the dormant cabinet (bulbs along the chrome
   arch, neon tubes, dust in the window light, grain on the glass) and keeps
   it browning out - sign, picture tube, lamps and chrome sagging together,
   because they share one supply. It returns { insert }.

   insert(sound, { collapseTo }) plays the film. Everything is scheduled at
   the press on the document timeline, from startup-timing.js:
     the coin     the camera pushes in on the coin entry; the coin swings in
                  close to the lens, turns, lines up, sinks, catches and is
                  swallowed (startup-coin.js)
     the chute    clinks deep inside; the coin box; 1 CREDIT; the camera
                  pulls back to the whole machine
     the relay    THUNK - the cabinet jolts, dust shakes off the arch, and
                  the standby supply drops out: dark
     A            the supply tries: one tube, one line on the tube. It dies.
     B            a second relay; it catches and climbs, shuddering; tubes
                  strike, the raster opens out of the line and rolls to lock
     C            it locks: ignition swept through the cabinet
     D            the tube surges, the camera dives into it, and the picture
                  squeezes to the line the boot screen strikes from
                  (collapseTo is that line; without it - boot already seen in
                  this tab - insert resolves at D and the caller fades out)
   With prefers-reduced-motion the story is told without travel, shake or
   flicker: the coin is taken at the slit and the cabinet fades up.
   sound is { lift, contact, chute, relay, power, tube, collapse }.
   ============================================================ */
import { planSag } from './lights.js';
import { BEATS } from './startup-timing.js';
import { buildCoinEdge, stageCoin, stageMechanism } from './startup-coin.js';
import { RESPONSE, stageBulbs, stageIgnition, stageTube, stageTubes } from './startup-power.js';

const MOTES = 16;
const DEAD_TUBES = 2;
const DUST_SPECKS = 10;
const ARCH = { inset: 2.8, radius: 33.2, foot: 110, gap: 8.4 };   // the chrome tube's centre line, in cabinet em
const STANDBY_BULBS = [0.28, 0.62, 0.97];                          // the few bulbs still glowing on standby
const COIN_ON_SCREEN = 0.145;                                      // the coin at the slit, as a share of the short side
const SLIT_EM = 1.12;                                              // the slit, down from the top of the coin entry (styles.css)
const { coinIn, align, descend, contact, gone, credit, relay, attempt, catch: caught, ignite, surge, collapse, end } = BEATS;

const between = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ---------------- building the cabinet ---------------- */

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

/* Each letter of the sign becomes its own neon tube ("by" is painted plastic). */
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

/* A point along the arch's centre line, d em from its left foot. */
function archPoint(d) {
  const { inset, radius: r, foot } = ARCH;
  const left = inset;
  const right = 100 - inset;
  const side = foot - (inset + r);
  const arc = (Math.PI / 2) * r;
  const top = right - left - 2 * r;
  if (d <= side) return { x: left, y: foot - d };
  d -= side;
  if (d <= arc) { const a = Math.PI + d / r; return { x: left + r + r * Math.cos(a), y: inset + r + r * Math.sin(a) }; }
  d -= arc;
  if (d <= top) return { x: left + r + d, y: inset };
  d -= top;
  if (d <= arc) { const a = -Math.PI / 2 + d / r; return { x: right - r + r * Math.cos(a), y: inset + r + r * Math.sin(a) }; }
  return { x: right, y: inset + r + (d - arc) };
}

/* Bulbs along the chrome arch; rise is 0 at either foot, 1 at the crown. */
function placeBulbs(cab) {
  const { inset, radius: r, foot, gap } = ARCH;
  const length = 2 * (foot - inset - r) + Math.PI * r + (100 - 2 * inset - 2 * r);
  const count = Math.round(length / gap) + 1;
  const bulbs = [];
  for (let i = 0; i < count; i++) {
    const d = (length * i) / (count - 1);
    const { x, y } = archPoint(d);
    const bulb = document.createElement('span');
    bulb.className = 'bulb';
    bulb.style.left = `${x.toFixed(2)}em`;
    bulb.style.top = `${y.toFixed(2)}em`;
    const lit = document.createElement('i');
    bulb.append(lit);
    cab.append(bulb);
    bulbs.push({ el: lit, rise: Math.min(d, length - d) / (length / 2) });
  }
  for (const want of STANDBY_BULBS) {
    const near = bulbs.reduce((a, b) => (Math.abs(b.rise - want) < Math.abs(a.rise - want) ? b : a));
    near.standby = true;
    near.el.classList.add('is-standby');
  }
  return bulbs;
}

function addDust(cab) {
  return Array.from({ length: DUST_SPECKS }, () => {
    const speck = document.createElement('span');
    speck.className = 'dust-speck';
    speck.style.left = `${between(22, 78).toFixed(1)}em`;
    speck.style.top = `${between(1, 9).toFixed(1)}em`;
    cab.append(speck);
    return speck;
  });
}

function gather(attract) {
  const $ = (sel) => attract.querySelector(sel);
  const $$ = (sel) => [...attract.querySelectorAll(sel)];
  return {
    attract, world: $('.attract-world'), camera: $('.attract-camera'), cab: $('.cab'), spot: $('.attract-spot'),
    sign: $('.cab-sign'), title: $('.attract-title'), bloom: $('.sign-bloom'), arch: $('.cab-arch'),
    crt: $('.tv'), picture: $('.tv-picture'), line: $('.tv-line'), flash: $('.tv-flash'), logo: $('.attract-logo'),
    door: $('.cab-door'), mech: $('.coin-mech'), gate: $('.mech-top'), lamp: $('.mech-glow'), doorBloom: $('.door-bloom'),
    label: $('.attract-coin'), hero: $('.hero-coin'), spin: $('.hero-spin'), shine: $('.hero-shine'), coinLamp: $('.hero-lamp'),
    shadow: $('.coin-shadow'), throat: $('.coin-throat'), halo: $('.cab-halo'), floor: $('.attract-floor'), glow: $('.cab-light'),
    glint: $('.cab-glint i'), pillars: $$('.cab-tube i'), grain: $('.attract-grain'), room: $('.attract-room'),
  };
}

export function wakeAttract(attract) {
  const el = gather(attract);
  attract.style.setProperty('--grain', grainTile());
  addMotes(el.room);
  buildCoinEdge(el.spin);
  el.bulbs = placeBulbs(el.cab);
  el.dust = addDust(el.cab);
  el.tubes = el.title ? wrapTubes(el.title) : [];
  el.dead = new Set();
  while (el.tubes.length && el.dead.size < Math.min(DEAD_TUBES, el.tubes.length)) el.dead.add(Math.floor(Math.random() * el.tubes.length));
  el.dead.forEach((i) => el.tubes[i].classList.add('is-dead'));

  const dormant = startDormant(el);

  async function insert(sound = {}, { collapseTo = null } = {}) {
    const cue = (name) => { try { sound[name]?.(); } catch (err) { console.warn('[startup]', err); } };
    dormant.stop();
    attract.classList.add('is-inserting');
    const film = clock(attract);
    cue('lift');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) stageGently(el, film.at, cue, collapseTo);
    else stageFilm(el, film.at, cue, collapseTo);
    await film.until(collapseTo ? end : surge);
  }

  return { insert };
}

/* One clock for the whole film: the document timeline. at() runs a step on
   its beat; until() resolves when the film reaches a time. */
function clock(root) {
  const timer = (ms) => root.animate([], { duration: 0, delay: ms }).finished;
  return {
    at(ms, fn) {
      timer(ms).then(() => { try { fn(); } catch (err) { console.warn('[startup]', err); } }, () => {});
    },
    until: (ms) => timer(ms).catch(() => {}),
  };
}

/* ---------------- dormant: one tired supply ---------------- */
function startDormant(el) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { stop() {} };   // a steady standby glow: no sags, no stutters
  let awake = true;
  const timers = new Set();
  const running = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (awake) fn(); }, ms);
    timers.add(id);
  };
  const play = (target, frames, options) => {
    if (!target) return;
    const anim = target.animate(frames, options);
    running.add(anim);
    anim.finished.finally(() => running.delete(anim)).catch(() => {});
  };

  // A brown-out: everything on the supply dips together, the picture slips sideways.
  const sag = () => {
    const plan = planSag();
    if (!document.hidden) {
      const opts = { duration: plan.duration, easing: 'linear' };
      const volts = (k) => 0.5 * (1 - k.dim);
      for (const [part, map] of [[el.sign, RESPONSE.sign], [el.door, RESPONSE.door], [el.arch, RESPONSE.chrome], [el.lamp, RESPONSE.lamp]]) {
        play(part, plan.keyframes.map((k) => ({ offset: k.offset, ...map(volts(k), 0) })), opts);
      }
      play(el.picture, plan.keyframes.map((k) => ({
        offset: k.offset, ...RESPONSE.picture(volts(k), 0), transform: `translateX(${(k.shift * 14).toFixed(1)}px)`,
      })), opts);
      const dead = [...el.dead].map((i) => el.tubes[i]);
      if (dead.length && Math.random() < 0.35) {           // a dead tube tries to catch, then the sag takes it
        play(pick(dead), [{ opacity: 0.22 }, { opacity: 0.85, offset: 0.08 }, { opacity: 0.7, offset: 0.2 }, { opacity: 0.22, offset: 0.32 }, { opacity: 0.22 }], opts);
      }
    }
    later(sag, plan.duration + plan.nextInMs);
  };
  later(sag, between(700, 1600));

  const stutter = () => {
    const i = Math.floor(Math.random() * el.tubes.length);
    if (el.tubes.length && !document.hidden) {
      const lit = el.dead.has(i) ? 0.22 : 1;
      play(el.tubes[i], [{ opacity: lit }, { opacity: lit === 1 ? 0.3 : 0.85 }, { opacity: lit }, { opacity: lit === 1 ? 0.4 : 0.7 }, { opacity: lit }],
        { duration: 460, easing: 'steps(4, end)' });
    }
    later(stutter, between(1800, 5200));
  };
  if (el.tubes.length) later(stutter, between(900, 2400));

  return {
    stop() {
      awake = false;
      timers.forEach(clearTimeout);
      timers.clear();
      running.forEach((anim) => anim.cancel());
    },
  };
}

/* ---------------- the film ---------------- */
function stageFilm(el, at, cue, collapseTo) {
  stageCamera(el, collapseTo);
  stageCoin(el);
  stageMechanism(el, at, cue);
  stageRelays(el, at, cue);
  stageTube(el);
  stageTubes(el.tubes, el.dead, at, cue);
  stageBulbs(el.bulbs);
  stageIgnition(el, at);
  if (collapseTo) stageHandoff(el, at, cue, collapseTo);
}

/* The camera: in on the coin entry, back out to the whole machine as the
   coin falls through it, a slow drift while it glows, then into the tube. */
function stageCamera(el, collapseTo) {
  const vw = innerWidth;
  const vh = innerHeight;
  const centre = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  const look = (point, s, to) => ({ transform: `translate(${(to.x - s * point.x).toFixed(1)}px, ${(to.y - s * point.y).toFixed(1)}px) scale(${s.toFixed(4)})` });
  const mid = { x: vw / 2, y: vh / 2 };
  const em = parseFloat(getComputedStyle(el.cab).fontSize) || 8;
  const push = clamp((COIN_ON_SCREEN * Math.min(vw, vh)) / (8 * em), 1.3, 2.4);
  const entry = el.mech.getBoundingClientRect();
  const slit = { x: entry.left + entry.width / 2, y: entry.top + SLIT_EM * em };
  const onCoin = { x: vw / 2, y: vh * 0.7 };
  const last = collapseTo ? collapse : surge;
  const t = (ms) => ms / last;

  const frames = [
    { offset: 0, ...look(mid, 1, mid), easing: 'cubic-bezier(.16,1,.3,1)' },
    { offset: t(950), ...look(slit, push, onCoin) },
    { offset: t(descend), ...look(slit, push, onCoin), easing: 'cubic-bezier(.45,0,.25,1)' },
    { offset: t(contact), ...look(slit, push * 1.06, onCoin) },
    { offset: t(gone + 80), ...look(slit, push * 1.06, onCoin), easing: 'cubic-bezier(.65,0,.35,1)' },
    { offset: t(relay - 80), ...look(mid, 1, mid) },
    { offset: t(ignite), ...look(mid, 1, mid), easing: 'cubic-bezier(.3,0,.25,1)' },
    { offset: t(surge), ...look(mid, 1.03, mid), easing: 'cubic-bezier(.62,0,.3,1)' },
  ];
  if (collapseTo) {
    const screen = el.crt.getBoundingClientRect();
    frames.push({ offset: 1, ...look(centre(screen), Math.max(vw / screen.width, vh / screen.height) * 1.04, mid) });
  }
  el.camera.animate(frames, { duration: last, fill: 'forwards' });
  el.spot?.animate([
    { opacity: 0 }, { opacity: 0.86, offset: 700 / relay }, { opacity: 0.86, offset: (gone + 80) / relay }, { opacity: 0 },
  ], { duration: relay, fill: 'forwards', easing: 'ease-in-out' });
}

/* Heavy things moving: the relays, the transformer's shudder, the lock. */
function impulse(target, em, delay, duration = 520) {
  target?.animate([
    { transform: 'translateY(0)' }, { transform: `translateY(${em}em)`, offset: 0.14 }, { transform: `translateY(${-em * 0.34}em)`, offset: 0.38 },
    { transform: `translateY(${em * 0.12}em)`, offset: 0.62 }, { transform: 'translateY(0)' },
  ], { delay, duration, easing: 'ease-out', composite: 'add' });
}

function shudder(target, delay, duration, amplitude) {
  const frames = [];
  for (let i = 0; i <= 28; i++) {
    const p = i / 28;
    const a = amplitude * Math.exp(-2.6 * p) * Math.sin(p * duration * 0.082);
    frames.push({ offset: p, transform: `translate(${a.toFixed(3)}em, ${(a * -0.35).toFixed(3)}em)` });
  }
  target?.animate(frames, { delay, duration, easing: 'linear', composite: 'add' });
}

function stageRelays(el, at, cue) {
  at(relay, () => { cue('relay'); cue('power'); });
  impulse(el.cab, 0.42, relay);
  el.sign?.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(.35deg)' }, { transform: 'rotate(-.2deg)' }, { transform: 'rotate(.08deg)' }, { transform: 'rotate(0)' }],
    { delay: relay + 70, duration: 420, easing: 'ease-out', composite: 'add' });   // the sign is a little loose on its brackets
  el.dust.forEach((speck) => {
    const fall = between(28, 62);
    speck.animate([
      { opacity: 0, transform: 'translate(0, 0)' }, { opacity: between(0.5, 0.9), offset: 0.12 },
      { opacity: 0, transform: `translate(${between(-3, 3).toFixed(1)}em, ${fall.toFixed(1)}em)` },
    ], { delay: relay + between(20, 260), duration: between(1500, 2400), easing: 'cubic-bezier(.4,0,.8,.6)' });
  });
  impulse(el.cab, 0.2, caught, 420);
  shudder(el.cab, caught + 80, 860, 0.16);
  impulse(el.cab, 0.26, ignite, 460);
}

/* Phase D: the surge washes the tube out, then the whole view squeezes to
   the line the boot screen strikes from. */
function stageHandoff(el, at, cue, line) {
  at(surge, () => cue('collapse'));
  el.flash?.animate([{ opacity: 0 }, { opacity: 0.85 }], { delay: collapse - 120, duration: 340, fill: 'forwards', easing: 'ease-in' });
  const dy = line.y - innerHeight / 2;
  const sx = clamp(line.width / innerWidth, 0.15, 1);
  el.world.animate([
    { transform: 'translateY(0) scale(1, 1)', filter: 'brightness(1)', easing: 'cubic-bezier(.55,0,.9,.45)' },
    { transform: `translateY(${dy.toFixed(1)}px) scale(1, .014)`, filter: 'brightness(2.2)', offset: 0.62 },
    { transform: `translateY(${dy.toFixed(1)}px) scale(${sx.toFixed(3)}, .006)`, filter: 'brightness(2.6)' },
  ], { delay: collapse, duration: end - collapse, fill: 'forwards' });
}

/* ---------------- reduced motion: the same story, gently ---------------- */
function stageGently(el, at, cue, collapseTo) {
  const fade = (target, frames, from, to) => target?.animate(frames, { delay: from, duration: to - from, fill: 'forwards', easing: 'ease-in-out' });
  el.hero.style.transform = 'translate(0, 0) scale(.3333)';
  fade(el.hero, [{ opacity: 0 }, { opacity: 1 }], coinIn, align);
  fade(el.hero, [{ opacity: 1 }, { opacity: 0 }], contact, gone);
  at(contact, () => cue('contact'));
  at(gone, () => cue('chute'));
  at(credit, () => { el.label.textContent = '1 CREDIT'; el.label.classList.add('is-credited'); });
  at(relay, () => { cue('relay'); cue('power'); });
  at(ignite, () => {
    el.attract.classList.add('is-lit');
    el.tubes.forEach((tube) => tube.classList.remove('is-dead'));
  });
  fade(el.sign, [RESPONSE.sign(0.5), RESPONSE.sign(1)], attempt, ignite);
  fade(el.picture, [RESPONSE.picture(0.5, 0), RESPONSE.picture(1, 0)], attempt, ignite);
  fade(el.arch, [RESPONSE.chrome(0.5), RESPONSE.chrome(1)], attempt, ignite);
  el.tubes.forEach((tube) => fade(tube, [{ opacity: tube.classList.contains('is-dead') ? 0.22 : 1 }, { opacity: 1 }], caught, ignite));
  el.bulbs.forEach(({ el: bulb }) => fade(bulb, [{ opacity: 0 }, { opacity: 1 }], caught, ignite + 400));
  el.pillars.forEach((fill) => fade(fill, [{ transform: 'scaleY(.06)', opacity: 0.48 }, { transform: 'scaleY(1)', opacity: 1 }], caught, ignite + 400));
  for (const part of [el.halo, el.floor, el.glow, el.doorBloom]) fade(part, [{ opacity: 0 }, { opacity: 0.8 }], caught, ignite + 400);
  if (collapseTo) fade(el.world, [{ opacity: 1 }, { opacity: 0 }], surge, end);
}

/* ============================================================
   STARTUP - the INSERT COIN screen: the jukebox's own cabinet standing in
   a basement, dust sheet just pulled off, too big for the frame, alive only
   on a tired standby supply. One coin wakes it.

   wakeAttract(attract) builds the dormant cabinet (bulbs along the chrome
   arch, neon tubes, dust in the window light, a weak signal on the glass)
   and keeps it breathing: in the dark, on its standby trickle, the picture
   tube draws the robot as faint phosphor that gathers and loses its light,
   and the static, the tube's light on the cabinet and the odd rolling band
   move with it, as one tired signal (planBreath in lights.js). It returns
   { insert, breath } (breath is for the dormant drone, drone.js).

   insert(sound, { collapseTo }) plays the film. Everything is scheduled at
   the press on the document timeline, from startup-timing.js:
     the coin     the camera pushes in on the coin entry; the coin swings in
                  close to the lens, turns, lines up, sinks, catches and is
                  swallowed (startup-coin.js)
     the chute    clinks deep inside; the coin box; 1 CREDIT; the camera
                  pulls back to the whole machine
     the relay    THUNK - the cabinet jolts, dust shakes off the arch, and
                  the standby supply drops out: dark
     A            the transformer gathers; a line creeps across the tube, one
                  tube weakly catches; it nearly holds - and dies
     the dark     nothing at all, one tick inside; the camera leans in
     B            a deeper relay; it catches and climbs, shuddering; tubes
                  strike, the raster opens out of the line and rolls to lock
     C            it locks: ignition swept through the cabinet, then the lit
                  machine is simply held for a moment
     D            the tube surges, the camera dives into it, and the picture
                  squeezes to the line the boot screen strikes from
                  (collapseTo is that line; without it - boot already seen in
                  this tab - insert resolves at D and the caller fades out)
   With prefers-reduced-motion the story is told without travel, shake or
   flicker: the coin is taken at the slit and the cabinet fades up.
   sound is { lift, contact, chute, relay, power, tube, collapse }.
   ============================================================ */
import { BREATH, planBreath } from './lights.js';
import { BEATS, STANDBY } from './startup-timing.js';
import { buildCoinEdge, stageCoin, stageMechanism } from './startup-coin.js';
import { RESPONSE, stageBulbs, stageIgnition, stageTube, stageTubes } from './startup-power.js';

const MOTES = 16;
const DEAD_TUBES = 2;
const DUST_SPECKS = 10;
const ARCH = { inset: 2.8, radius: 33.2, foot: 110, gap: 8.4 };   // the chrome tube's centre line, in cabinet em
const STANDBY_BULBS = [0.28, 0.62, 0.97];                          // the few bulbs still glowing on standby
const ROBOT_PX = 256;                                              // the phosphor robot is drawn once at this size
const COIN_ON_SCREEN = 0.145;                                      // the coin at the slit, as a share of the short side
const SLIT_EM = 1.12;                                              // the slit, down from the top of the coin entry (styles.css)
const { coinIn, align, descend, contact, gone, credit, relay, attempt, fail, catch: caught, ignite, surge, collapse, end } = BEATS;

const between = (lo, hi) => lo + Math.random() * (hi - lo);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ---------------- building the cabinet ---------------- */

/* A tile of static, made once, for the grain layer to jump about. It is
   drawn normally, not screen-blended: a blended layer re-blends against
   whatever moves beneath it and shows hard rectangles on the GPU.
   weak is the standby signal: fine, low-contrast and mostly dark, a picture
   struggling rather than snow. The film's snow takes over once the relay
   has the picture (.is-tube-lit), when there is no supply to show it. */
function grainTile(weak = false) {
  const size = 140;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    if (weak) {
      const v = 110 + Math.random() ** 2 * 145;   // few bright specks
      img.data[i] = v * 0.84; img.data[i + 1] = v * 0.93; img.data[i + 2] = v;
      img.data[i + 3] = Math.random() < 0.42 ? 0 : 40 + Math.random() * 34;
      continue;
    }
    const v = 150 + Math.random() * 105;      // light specks only, so it can lighten the glass without a blend mode
    img.data[i] = v * 0.86; img.data[i + 1] = v * 0.9; img.data[i + 2] = v;   // a cool phosphor, like the reference's starlight
    img.data[i + 3] = Math.random() < 0.5 ? 0 : 255;
  }
  ctx.putImageData(img, 0, 0);
  return `url(${canvas.toDataURL()})`;
}

/* The robot as the starved tube draws it: the logo's own pixels turned into
   phosphor light - the neon lines keep their colour, the cream face is held
   right down, the dark ground and the frame give no light at all - smeared
   a little along the scan lines, red and blue a fraction out of register,
   with a faint ghost trailing to the right. Behind it, a bloom of the same
   light, so the breath can move between a sharp robot and a soft one.
   Drawn once onto two canvases; nothing is redrawn while it breathes. */
function drawPhosphor(img, core, bloom) {
  const S = ROBOT_PX;
  const sheet = (w, h = w) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const lit = sheet(S);
  const ctx = lit.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, S, S);
  const px = ctx.getImageData(0, 0, S, S);           // throws on a tainted canvas (file://): the caller falls back
  const d = px.data;
  const bright = (p) => Math.max(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]) > 50 && d[p * 4 + 3] > 0;
  // The frame round the robot (and the coin tab on it) is one unbroken line
  // from the edge in: fill along it from its left side and leave it dark.
  const frame = new Uint8Array(S * S);
  const todo = [];
  for (let x = 0; x < S * 0.12; x++) { const p = (S >> 1) * S + x; if (bright(p)) { frame[p] = 1; todo.push(p); break; } }
  while (todo.length) {
    const p = todo.pop();
    const x = p % S;
    for (const q of [p - S, p + S, x > 0 ? p - 1 : -1, x < S - 1 ? p + 1 : -1]) {
      if (q >= 0 && q < S * S && !frame[q] && bright(q)) { frame[q] = 1; todo.push(q); }
    }
  }
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const hi = Math.max(d[i], d[i + 1], d[i + 2]);
    const lo = Math.min(d[i], d[i + 1], d[i + 2]);
    const x = p % S;
    const tab = x > S * 0.39 && x < S * 0.61 && p / S > S * 0.83;   // the coin tab hangs off the frame: not the robot either
    const glow = frame[p] || tab ? 0 : clamp((hi - 50) / 150, 0, 1) * (d[i + 3] / 255);
    const keep = 0.3 + 0.7 * clamp(((hi ? (hi - lo) / hi : 0) - 0.25) / 0.4, 0, 1);   // white held down, colour kept
    d[i] *= keep; d[i + 1] *= keep; d[i + 2] *= keep; d[i + 3] = 255 * glow;
  }
  ctx.putImageData(px, 0, 0);

  const tint = (colour) => {
    const t = sheet(S);
    const c = t.getContext('2d');
    c.drawImage(lit, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = colour;
    c.fillRect(0, 0, S, S);
    return t;
  };
  const smear = sheet(Math.round(S * 0.5), S);        // squeezed and stretched back: soft along the lines only
  smear.getContext('2d').drawImage(lit, 0, 0, smear.width, S);

  const c = core.getContext('2d');
  core.width = core.height = S;
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.6; c.drawImage(lit, 0, 0);
  c.globalAlpha = 0.5; c.drawImage(smear, 0, 0, S, S);
  c.globalAlpha = 0.2; c.drawImage(tint('#ff2d95'), 2.5, 0); c.drawImage(tint('#25e8e2'), -2.5, 0);
  c.globalAlpha = 0.1; c.drawImage(lit, 9, 0);   // the ghost

  const G = Math.round(S * 1.8);
  const pad = (G - S) / 2;
  const b = bloom.getContext('2d');
  bloom.width = bloom.height = G;
  b.globalCompositeOperation = 'lighter';
  for (const [div, alpha] of [[6, 1], [12, 0.9], [28, 0.7]]) {   // blurred by shrinking it and letting the browser smooth it back up
    const small = sheet(Math.round(S / div));
    const half = sheet(Math.round(S / div) * 2);
    small.getContext('2d').drawImage(lit, 0, 0, small.width, small.height);
    half.getContext('2d').drawImage(small, 0, 0, half.width, half.height);
    b.globalAlpha = alpha;
    b.drawImage(half, pad, pad, S, S);
    b.drawImage(half, pad, pad, S, S);
  }
}

function buildRobot(el) {
  const holder = el.attract.querySelector('.tv-phosphor');
  if (!holder) return {};
  const bloom = Object.assign(document.createElement('canvas'), { className: 'phos-bloom' });
  const core = Object.assign(document.createElement('canvas'), { className: 'phos-core' });
  holder.append(bloom, core);
  const plain = () => {                                  // no canvas to read from: the logo itself, held dim
    const img = el.logo.cloneNode();
    img.className = 'phos-core is-plain';
    core.replaceWith(img);
    return img;
  };
  const ready = el.logo.decode().then(() => drawPhosphor(el.logo, core, bloom)).then(() => core, () => { bloom.remove(); return plain(); });
  ready.then(() => holder.classList.add('is-ready'));
  return { holder, core, bloom, ready };
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
    body: $('.cab-body'), tubeCases: $$('.cab-tube'), spill: $('.cab-spill'), glint: $('.cab-glint i'), pillars: $$('.cab-tube i'), grain: $('.attract-grain'), roll: $('.attract-roll'), room: $('.attract-room'),
  };
}

export function wakeAttract(attract) {
  const el = gather(attract);
  attract.style.setProperty('--grain', grainTile());
  attract.style.setProperty('--grain-weak', grainTile(true));
  addMotes(el.room);
  buildCoinEdge(el.spin);
  el.bulbs = placeBulbs(el.cab);
  el.dust = addDust(el.cab);
  el.tubes = el.title ? wrapTubes(el.title) : [];
  el.dead = new Set();
  while (el.tubes.length && el.dead.size < Math.min(DEAD_TUBES, el.tubes.length)) el.dead.add(Math.floor(Math.random() * el.tubes.length));
  el.dead.forEach((i) => el.tubes[i].classList.add('is-dead'));

  el.robot = buildRobot(el);
  const dormant = startDormant(el);

  async function insert(sound = {}, { collapseTo = null } = {}) {
    const cue = (name) => { try { sound[name]?.(); } catch (err) { console.warn('[startup]', err); } };
    attract.classList.add('is-inserting');
    const film = clock(attract);
    film.at(relay + 120, dormant.stop);   // it breathes on while the coin goes in; the relay takes the picture
    cue('lift');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) stageGently(el, film.at, cue, collapseTo);
    else stageFilm(el, film.at, cue, collapseTo);
    await film.until(collapseTo ? end : surge);
  }

  // breath: the robot's breathing plan and where in it the screen is now
  // (ms into the loop; null when the robot is still), for drone.js to breathe with.
  return { insert, breath: { plan: dormant.plan, phase: dormant.phase } };
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

/* ---------------- dormant: the machine breathing ---------------- */
/* One looping plan, every layer on it (opacity and transform only, so it
   all runs on the compositor): the robot sharpens and brightens as its
   bloom gathers, the snow thins, the tube's light on the bezel and chrome
   swells a little; then the robot softens, the snow returns. A soft band
   rolls down the tube now and then and the picture slips as it passes the
   face. The relay takes over the light: the film's own animations follow
   the supply from there, and stop() lets these go once the picture is gone.
   Reduced motion or calm lights: the robot simply glows, still. */
function startDormant(el) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.lights === 'calm';
  if (still) return { stop() {}, plan: null, phase: () => null };
  const plan = planBreath();
  const timing = { duration: plan.duration, iterations: Infinity };
  const running = [];
  const loop = (target, frames) => { if (target) running.push(target.animate(frames, timing)); };
  const breathe = (target, map) => loop(target, plan.keyframes.map((k) => ({ offset: k.offset, easing: k.easing, ...map(k.level) })));
  const rest = (v) => Number(v.toFixed(3));

  const spill = RESPONSE.spill(STANDBY).opacity;
  const snow = RESPONSE.static(STANDBY).opacity;
  breathe(el.spill, (l) => ({ opacity: rest(spill * (0.8 + 0.32 * l)) }));
  breathe(el.grain, (l) => ({ opacity: rest(snow * (1.3 - 0.6 * l)) }));
  el.robot.ready?.then((core) => {
    breathe(el.robot.bloom, (l) => ({ opacity: rest(0.12 + 0.76 * l) }));
    breathe(core, (l) => ({ opacity: rest(0.3 + 0.56 * l) }));
  });

  // the rolling bands, and the picture slipping as each passes the robot
  const at = (ms) => ms / plan.duration;
  const band = [{ offset: 0, transform: 'translateY(-120%)' }];
  const slip = [{ offset: 0, transform: 'translate(0, 0)' }];
  let clear = 0;
  for (const ms of plan.rolls) {
    if (ms < clear) continue;
    const end = ms + BREATH.rollMs;
    band.push({ offset: at(ms), transform: 'translateY(-120%)' }, { offset: at(end), transform: 'translateY(650%)' },
      { offset: at(end + 1), transform: 'translateY(-120%)' });
    const face = ms + BREATH.rollMs * 0.49;
    const dx = (Math.random() < 0.5 ? -1 : 1) * between(0.4, 1) * BREATH.maxShiftEm;
    slip.push({ offset: at(face - 150), transform: 'translate(0, 0)', easing: 'ease-out' },
      { offset: at(face), transform: `translate(${dx.toFixed(3)}em, ${(dx * -0.25).toFixed(3)}em)`, easing: 'ease-in-out' },
      { offset: at(face + 120), transform: `translate(${(dx * -0.35).toFixed(3)}em, 0)`, easing: 'ease-out' },
      { offset: at(face + 300), transform: 'translate(0, 0)' });
    clear = end + 400;
  }
  band.push({ offset: 1, transform: 'translateY(-120%)' });
  slip.push({ offset: 1, transform: 'translate(0, 0)' });
  loop(el.roll, band);
  loop(el.robot.holder, slip);

  return {
    plan,
    phase() {
      const t = running[0]?.currentTime;
      return Number.isFinite(t) ? t % plan.duration : null;
    },
    stop() { running.forEach((anim) => anim.cancel()); running.length = 0; },
  };
}

/* ---------------- the film ---------------- */
function stageFilm(el, at, cue, collapseTo) {
  at(relay + 100, () => el.attract.classList.add('is-tube-lit'));   // the picture is a dead line by now: the lit logo waits behind it
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
    { offset: t(align - 250), ...look(slit, push, onCoin) },
    { offset: t(descend), ...look(slit, push, onCoin), easing: 'cubic-bezier(.45,0,.25,1)' },
    { offset: t(contact), ...look(slit, push * 1.06, onCoin) },
    { offset: t(gone + 80), ...look(slit, push * 1.06, onCoin), easing: 'cubic-bezier(.65,0,.35,1)' },
    { offset: t(relay - 80), ...look(mid, 1, mid), easing: 'cubic-bezier(.45,0,.55,1)' },
    { offset: t(caught), ...look(mid, 1.012, mid), easing: 'cubic-bezier(.3,0,.25,1)' },     // leaning in, in the dark, waiting
    { offset: t(ignite), ...look(mid, 1.012, mid), easing: 'cubic-bezier(.33,0,.3,1)' },
    { offset: t(surge), ...look(mid, 1.045, mid), easing: 'cubic-bezier(.62,0,.3,1)' },     // the lit machine, held, drifting closer
  ];
  if (collapseTo) {
    const screen = el.crt.getBoundingClientRect();
    frames.push({ offset: 1, ...look(centre(screen), Math.max(vw / screen.width, vh / screen.height) * 1.04, mid) });
  }
  el.camera.animate(frames, { duration: last, fill: 'forwards' });
  el.spot?.animate([
    { opacity: 0 }, { opacity: 0.86, offset: (coinIn + 600) / relay }, { opacity: 0.86, offset: (gone + 80) / relay }, { opacity: 0 },
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
  at(relay, () => { cue('relay'); cue('power'); el.attract.classList.add('is-powered'); });
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
  impulse(el.cab, 0.07, fail + 360, 600);                 // the power gone, the cabinet settles on its feet
  impulse(el.cab, 0.32, caught, 480);                     // the second relay is the heavier one
  shudder(el.cab, caught + 100, 1300, 0.17);
  impulse(el.cab, 0.26, ignite, 460);
}

/* Phase D: the surge washes the tube out, then the whole view squeezes to
   the line the boot screen strikes from. */
function stageHandoff(el, at, cue, line) {
  at(surge, () => cue('collapse'));
  el.flash?.animate([{ opacity: 0 }, { opacity: 0.12 }], { delay: collapse - 120, duration: 340, fill: 'forwards', easing: 'ease-in' });
  const dy = line.y - innerHeight / 2;
  const sx = clamp(line.width / innerWidth, 0.15, 1);
  el.world.animate([
    { transform: 'translateY(0) scale(1, 1)', filter: 'brightness(1)', easing: 'cubic-bezier(.55,0,.9,.45)' },
    { transform: `translateY(${dy.toFixed(1)}px) scale(1, .014)`, filter: 'brightness(1.25)', offset: 0.62 },
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
  at(relay, () => { cue('relay'); cue('power'); el.attract.classList.add('is-powered'); });   // the sign joins the supply, as in the film
  fade(el.robot.holder, [{ opacity: 1 }, { opacity: 0 }], attempt, attempt + 900);           // the standby robot gives way to the lit logo
  at(attempt + 900, () => el.attract.classList.add('is-tube-lit'));
  fade(el.logo, [{ opacity: 0 }, { opacity: 1 }], attempt + 900, ignite);
  at(ignite, () => {
    el.attract.classList.add('is-lit');
    el.tubes.forEach((tube) => tube.classList.remove('is-dead'));
  });
  fade(el.door, [RESPONSE.door(STANDBY), RESPONSE.door(0.5)], coinIn, align);          // the slot lamp lights the coin door
  fade(el.lamp, [{ opacity: 0 }, { opacity: 0.8 }], coinIn, align);
  fade(el.sign, [RESPONSE.sign(STANDBY), RESPONSE.sign(1)], attempt, ignite);
  fade(el.picture, [RESPONSE.picture(STANDBY, 0), RESPONSE.picture(1, 0)], attempt, ignite);
  fade(el.arch, [RESPONSE.chrome(STANDBY), RESPONSE.chrome(1)], attempt, ignite);
  for (const part of [el.body, ...el.tubeCases]) fade(part, [RESPONSE.body(STANDBY), RESPONSE.body(1)], attempt, ignite);
  el.tubes.forEach((tube) => fade(tube, [{ opacity: tube.classList.contains('is-dead') ? 0.22 : 1 }, { opacity: 1 }], caught, ignite));
  el.bulbs.forEach(({ el: bulb }) => fade(bulb, [{ opacity: 0 }, { opacity: 1 }], caught, ignite + 400));
  el.pillars.forEach((fill) => fade(fill, [{ transform: 'scaleY(.06)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1 }], caught, ignite + 400));
  for (const part of [el.halo, el.floor, el.glow, el.doorBloom]) fade(part, [{ opacity: 0 }, { opacity: 0.8 }], caught, ignite + 400);
  if (collapseTo) fade(el.world, [{ opacity: 1 }, { opacity: 0 }], surge, end);
}

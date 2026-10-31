/* ============================================================
   FX - shared visual toolbox (ported and adapted from trivia's fx.js):
   the CRT boot sequence, count-ups.

   The lights are always FULL: the on-screen FULL / CALM switch was removed.
   isCalm() and the html[data-lights="calm"] CSS remain but never switch on.
   ============================================================ */
import { BOOT_POOL, sample } from './copy.js';
import { planFlicker, FLICKER } from './lights.js';

let calm = false;
const calmListeners = new Set();

export const isCalm = () => calm;

export function onCalmChange(fn) {
  calmListeners.add(fn);
  return () => calmListeners.delete(fn);
}

/* Sets the lights mode. Nothing on the page calls this any more (the lights
   are always FULL); the tests use it to exercise the dormant CALM paths. */
export function followLights(mode) {
  if (mode !== 'calm' && mode !== 'full') return;
  calm = mode === 'calm';
  document.documentElement.dataset.lights = mode;
  for (const fn of calmListeners) {
    try { fn(calm); } catch (err) { console.warn('[lights]', err); }
  }
}

/* Run an effect so that a failure can never reach the music. */
export function safely(label, fn) {
  try {
    return fn();
  } catch (err) {
    console.warn(`[effect:${label}]`, err);
    return undefined;
  }
}

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/* The monitor dips now and then, patch by patch (planFlicker in lights.js
   holds the safety rules). Skipped in CALM and while the tab is hidden. */
export function startScreenFlicker(layer, { onBurst } = {}) {
  if (!layer || typeof layer.animate !== 'function') return;
  const patches = Array.from({ length: FLICKER.cols * FLICKER.rows }, () => document.createElement('i'));
  layer.replaceChildren(...patches);
  const next = () => {
    const plan = planFlicker();
    setTimeout(() => {
      safely('screen-flicker', () => {
        if (calm || document.hidden) return;
        plan.patches.forEach((p, i) => patches[i].animate(p.keyframes, { duration: plan.duration, delay: p.delayMs, easing: 'linear' }));
        if (onBurst) onBurst(plan);
      });
      next();
    }, plan.nextInMs);
  };
  next();
}

/* ============================================================
   Count-up. A number odometer-rolls from zero to its value.
   Calm: snaps straight to the final value.
   ============================================================ */
export function countUp(el, to, { ms = 600, format = (n) => String(Math.round(n)) } = {}) {
  if (!el) return;
  const target = Number(to) || 0;
  if (calm) {
    el.textContent = format(target);
    return;
  }
  const start = performance.now();
  (function step(now) {
    const t = Math.min((now - start) / ms, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(target * eased);
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = format(target);
      el.classList.remove('is-scoring');
      void el.offsetWidth;            // restart the pop animation
      el.classList.add('is-scoring');
    }
  })(start);
}

/* ============================================================
   Arcade boot sequence. The tube strikes to a bright line, warms up
   steadily, prints a short random self-test, then lets go softly to
   reveal the machine behind it. Plays once per browser tab
   (sessionStorage), so a refresh mid-night does not replay it.
   ============================================================ */
const BOOT_FLAG = 'sn_booted';

/* Has the full arrival already played in this tab? (startBoot skips it if so.) */
export function hasBooted() {
  try { return Boolean(sessionStorage.getItem(BOOT_FLAG)); } catch { return false; }
}
const BOOT_TEST_LINES = 5;
const BOOT_LOG_MS = 5000;            // the self-test prints across this long: the film already told the struggle

function renderBootLog(overlay, holdMs) {
  const log = overlay.querySelector('.boot-log');
  if (!log) return;

  const COL = 30;
  const dots = (label) => '.'.repeat(Math.max(3, COL - label.length));
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const test = ({ t, s, k }) => `  ${esc(t)} ${dots(t)} <span class="${k}">${esc(s)}</span>`;

  const rows = [
    '<b>SKATE BY FAITH</b> JUKEBOX',
    '(C) 1983   ·   ALL RIGHTS RESERVED',
    ' ',
    ...sample(BOOT_POOL, BOOT_TEST_LINES).map(test),
    `  LOADING THE CRATES ${dots('LOADING THE CRATES')} <span class="boot-cursor">&#9608;</span>`,
  ];

  const hold = holdMs / 1000;
  const first = 1.6;
  const last = Math.max(first + 1, hold - 0.8);
  const testCount = rows.length - 3;
  const delayFor = (i) => {
    if (i === 0) return 0.45;
    if (i === 1) return 0.7;
    if (i === 2) return 0.9;
    return first + ((i - 3) / (testCount - 1)) * (last - first);
  };

  log.innerHTML = rows
    .map((html, i) => `<span class="ln" style="opacity:1;animation-delay:${delayFor(i).toFixed(2)}s">${html}</span>`)
    .join('');
}

/* Input belongs to the cabinet only after arrival. Inert keeps focus out of
   the hidden controls; capture guards also cover the window's shortcuts.
   Preserve existing inert states.
   The INSERT COIN film holds input the same way while it plays. */
export function holdArrivalInput(overlay) {
  const background = Array.from(document.body.children)
    .filter((el) => el !== overlay && !el.contains(overlay))
    .map((el) => ({ el, inert: el.inert }));
  for (const { el } of background) el.inert = true;
  const events = ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu', 'input', 'change'];
  const block = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  for (const name of events) window.addEventListener(name, block, { capture: true, passive: false });
  return () => {
    for (const name of events) window.removeEventListener(name, block, { capture: true });
    for (const { el, inert } of background) el.inert = inert;
  };
}

/* reveal() schedules the complete arrival once the machine is ready. There
   is deliberately no skip API. A refresh in the same tab does not replay it. */
export function startBoot(overlay, { minMs = 6500, capMs = 10000 } = {}) {
  const none = { reveal() {}, played: false };
  if (!overlay) return none;

  try {
    if (sessionStorage.getItem(BOOT_FLAG)) { overlay.hidden = true; return none; }
  } catch { /* storage blocked - just boot */ }

  overlay.hidden = false;
  renderBootLog(overlay, BOOT_LOG_MS);
  const screen = overlay.querySelector('.boot-screen');
  if (screen) screen.style.opacity = '1';            // static CALM presentation
  const releaseInput = holdArrivalInput(overlay);
  overlay.classList.remove('is-done');
  void overlay.offsetWidth;
  overlay.classList.add('is-booting');

  const started = performance.now();
  let done = false;
  let revealTimer = null;
  let onDone = () => {};
  const finished = new Promise((r) => { onDone = r; });

  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(cap);
    clearTimeout(revealTimer);
    overlay.classList.remove('is-booting');
    overlay.classList.add('is-done');             // white flash + fade-out
    setTimeout(() => {
      overlay.hidden = true;
      overlay.classList.remove('is-done');
      // Only a completed arrival counts: reloading during warm-up cannot skip it.
      try { sessionStorage.setItem(BOOT_FLAG, '1'); } catch { /* storage blocked */ }
      releaseInput();
      onDone();
    }, 640);                                     // must outlast boot-out
  };

  const cap = setTimeout(finish, Math.max(minMs, capMs));

  return {
    played: true,
    finished,
    reveal() {
      if (done || revealTimer !== null) return;
      revealTimer = setTimeout(finish, Math.max(0, minMs - (performance.now() - started)));
    },
  };
}

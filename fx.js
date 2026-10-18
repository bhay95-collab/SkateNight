/* ============================================================
   FX - shared visual toolbox (ported and adapted from trivia's fx.js):
   the LIGHTS calm switch, the CRT boot sequence, count-ups.

   LIGHTS: FULL / CALM is the one place that decides whether decorative
   motion happens. Every effect asks isCalm() and, when calm, jumps to its
   FINISHED state instead of animating (trivia's "motion off, not motion
   lite" rule). CSS handles the pure-CSS animations through
   html[data-lights="calm"]; JavaScript effects check isCalm() themselves.
   ============================================================ */
import { BOOT_POOL, sample } from './copy.js';
import { LIGHTS_KEY, resolveLights, toggleLights, planFlicker } from './lights.js';

let calm = false;
const calmListeners = new Set();

export const isCalm = () => calm;

export function onCalmChange(fn) {
  calmListeners.add(fn);
  return () => calmListeners.delete(fn);
}

function applyLights(mode) {
  calm = mode === 'calm';
  document.documentElement.dataset.lights = mode;
  for (const fn of calmListeners) {
    try { fn(calm); } catch (err) { console.warn('[lights]', err); }
  }
}

/* Reads the saved choice (or the operating system's setting) and applies it. */
export function initLights() {
  let stored = null;
  try { stored = localStorage.getItem(LIGHTS_KEY); } catch { /* storage blocked - fine */ }
  const osReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  applyLights(resolveLights({ stored, osReduced }));
  return calm ? 'calm' : 'full';
}

/* The on-screen switch. Remembers the choice. */
export function flipLights() {
  const next = toggleLights(calm ? 'calm' : 'full');
  try { localStorage.setItem(LIGHTS_KEY, next); } catch { /* storage blocked - fine */ }
  applyLights(next);
  return next;
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

/* The whole monitor dips now and then (planFlicker in lights.js holds the
   safety rules). Skipped in CALM and while the tab is hidden. */
export function startScreenFlicker(layer) {
  if (!layer || typeof layer.animate !== 'function') return;
  const next = () => {
    const plan = planFlicker();
    setTimeout(() => {
      safely('screen-flicker', () => {
        if (!calm && !document.hidden) layer.animate(plan.keyframes, { duration: plan.duration, easing: 'linear' });
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
   with a flicker, prints a short random self-test, then flashes and
   fades to reveal the machine behind it. Plays once per browser tab
   (sessionStorage), so a refresh mid-night does not replay it.
   ============================================================ */
const BOOT_FLAG = 'sn_booted';
const BOOT_TEST_LINES = 5;
const BOOT_LOG_MS = 10000;           // the self-test prints across this long (trivia's pacing)

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
    .map((html, i) => `<span class="ln" style="animation-delay:${delayFor(i).toFixed(2)}s">${html}</span>`)
    .join('');
}

/* Returns { reveal(), skip() }. reveal() lifts the overlay once the machine
   is ready (after the minimum hold). skip() lifts it right now. */
export function startBoot(overlay, { minMs = 13000, capMs = 17000 } = {}) {
  const none = { reveal() {}, skip() {}, played: false };
  if (!overlay) return none;
  if (calm) { overlay.hidden = true; return none; }

  try {
    if (sessionStorage.getItem(BOOT_FLAG)) { overlay.hidden = true; return none; }
    sessionStorage.setItem(BOOT_FLAG, '1');
  } catch { /* storage blocked - just boot */ }

  overlay.hidden = false;
  renderBootLog(overlay, BOOT_LOG_MS);
  overlay.classList.remove('is-done');
  void overlay.offsetWidth;
  overlay.classList.add('is-booting');

  const started = performance.now();
  let done = false;
  let onDone = () => {};
  const finished = new Promise((r) => { onDone = r; });

  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(cap);
    overlay.classList.remove('is-booting');
    overlay.classList.add('is-done');             // white flash + fade-out
    setTimeout(() => {
      overlay.hidden = true;
      overlay.classList.remove('is-done');
      onDone();
    }, 640);                                     // must outlast boot-out
  };

  const cap = setTimeout(finish, capMs);

  return {
    played: true,
    finished,
    reveal() { setTimeout(finish, Math.max(0, minMs - (performance.now() - started))); },
    skip() { finish(); },
  };
}

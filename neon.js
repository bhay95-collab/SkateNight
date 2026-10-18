/* ============================================================
   NEON - the signage buzzes like tired neon tubes (ported from
   trivia's neon.js). Each glowing element gets one of three flicker
   patterns at a random speed and phase, so no two blink in unison -
   that desync is what reads as an old machine rather than a light show.

   Safety: the patterns in styles.css only dip to about half brightness
   and a "burst" never packs more than two dips together, so never more
   than three in a second (WCAG 2.3.1). Only SIGNAGE flickers, never the
   song title, times, or anything that has to stay readable.

   Calm: html[data-lights="calm"] switches every animation off in the
   stylesheet, so nothing here needs to change when the switch flips.
   ============================================================ */
const PATTERNS = ['neon-flicker-a', 'neon-flicker-b', 'neon-flicker-c'];

const TUBES = [
  '.w-cyan',
  '.w-mag',
  '.neon',
  '.panel-title-neon',
  '.led-chip .led',
].join(', ');

function fizz(el) {
  if (el.dataset.neon) return;
  el.dataset.neon = '1';
  const dur = 7 + Math.random() * 7;                    // 7s-14s, periods never line up
  const pattern = PATTERNS[(Math.random() * PATTERNS.length) | 0];
  const delay = -(Math.random() * dur);                 // start somewhere mid-cycle
  el.style.animation = `${pattern} ${dur.toFixed(2)}s steps(1) ${delay.toFixed(2)}s infinite`;
}

function scan(root) {
  if (root.matches?.(TUBES)) fizz(root);
  root.querySelectorAll?.(TUBES).forEach(fizz);
}

function init() {
  scan(document);
  new MutationObserver((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (node.nodeType === 1) scan(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

init();

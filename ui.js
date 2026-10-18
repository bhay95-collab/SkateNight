/* ============================================================
   UI - draws the pieces of the screen that change: the record rack,
   the title strips, the UP NEXT list, the keypad, the Now Playing
   readouts and the LED ticker.

   It holds no music logic. app.js tells it what to show and gives it
   functions to call when someone clicks something.
   ============================================================ */
import { formatClock, formatCountdown } from './format.js';
import { isCalm, countUp } from './fx.js';

/* Tiny helper: el('div', { class: 'x', onclick: fn }, child, 'text') */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/* ---------------- sleeves ----------------
   A sleeve is the "worn paper card" material: cover art inset in a paper
   border, a price-sticker chip, ring-wear. If the cover picture is missing
   the sleeve shows a plain printed front instead (never a broken image). */
const PRICES = ['$1.29', '$1.49', '$1.99', 'SPECIAL BUY!'];

function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function sleeveFace(volume) {
  const price = PRICES[hash(volume.id) % PRICES.length];
  const sleeve = el('div', { class: 'sleeve', dataset: { accent: volume.accent } });
  const fallback = el('span', { class: 'sleeve-front', 'aria-hidden': 'true' },
    el('b', {}, 'RFAI'),
    el('i', {}, volume.title),
    el('small', {}, 'SYNTHS · MACHINES · MUSIC · FOREVER'));
  sleeve.append(fallback);
  if (volume.cover) {
    const img = el('img', { class: 'sleeve-art', src: volume.cover, alt: '', draggable: 'false', decoding: 'async' });
    img.addEventListener('error', () => { sleeve.classList.add('is-bare'); img.remove(); });
    sleeve.append(img);
  } else {
    sleeve.classList.add('is-bare');
  }
  sleeve.append(el('span', { class: 'sleeve-price', 'aria-hidden': 'true' }, price));
  return sleeve;
}

/* ---------------- the UI object ---------------- */
export function createUI({ library, getStatus, handlers }) {
  const $ = (id) => document.getElementById(id);
  const trackById = new Map(library.tracks.map((t) => [t.id, t]));
  const volumeById = new Map(library.volumes.map((v) => [v.id, v]));

  const stripsEl = $('strips');
  const letterKeys = new Map();
  const stripRows = new Map();
  let shownVolumeId = null;
  const volumeIds = library.volumes.map((v) => v.id);
  // One sleeve per album, built once and reused, so flipping the rack never
  // shows a blank sleeve while a fresh copy of the cover decodes.
  const rackSleeves = new Map(library.volumes.map((v) => [v.id, sleeveFace(v)]));

  /* ---- the rack: one album page at a time ----
     Like the page display in a CD jukebox: a big sleeve with its title strips,
     flipped with the arrows. Pressing a letter on the selector flips to that
     album too, so the codes are on screen while you type. */
  function renderRack() {
    const step = (dir) => {
      if (volumeIds.length === 0) return;
      const i = volumeIds.indexOf(shownVolumeId);
      handlers.openVolume(volumeIds[(i + dir + volumeIds.length) % volumeIds.length]);
    };
    $('rack-prev').addEventListener('click', () => step(-1));
    $('rack-next').addEventListener('click', () => step(1));
    const single = volumeIds.length < 2;
    $('rack-prev').disabled = single;
    $('rack-next').disabled = single;
  }

  /* ---- title strips (show one album's page) ---- */
  function renderStrips(volumeId) {
    const v = volumeById.get(volumeId);
    if (!v) return;
    const isNewPage = shownVolumeId !== null && shownVolumeId !== volumeId;
    const forward = volumeIds.indexOf(volumeId) >= volumeIds.indexOf(shownVolumeId);
    shownVolumeId = volumeId;
    if (isNewPage && !isCalm()) {
      // the page flips over on its hinge, like a title-strip carousel turning
      const swing = forward ? 84 : -84;
      document.querySelector('.rack-page').animate(
        [
          { transform: `perspective(40rem) rotateY(${swing}deg)`, transformOrigin: forward ? 'left center' : 'right center', opacity: 0.35, filter: 'brightness(.45)' },
          { transform: 'perspective(40rem) rotateY(0deg)', transformOrigin: forward ? 'left center' : 'right center', opacity: 1, filter: 'brightness(1)' },
        ],
        { duration: RACK_TURN_MS, easing: 'cubic-bezier(.25,.8,.3,1.04)' },
      );
    }
    for (const [id, key] of letterKeys) key.classList.toggle('is-open', id === volumeId);
    $('rack-letter').textContent = v.letter;
    $('rack-title').textContent = v.title;
    $('rack-count').textContent = `${volumeIds.indexOf(volumeId) + 1} / ${volumeIds.length}`;
    const sleeve = rackSleeves.get(volumeId);
    if ($('rack-sleeve').firstChild !== sleeve) $('rack-sleeve').replaceChildren(sleeve);

    stripsEl.replaceChildren();
    stripRows.clear();
    stripsEl.dataset.accent = v.accent || 'gold';
    const list = library.tracks.filter((t) => t.volume === volumeId);
    if (list.length === 0) {
      stripsEl.append(el('p', { class: 'strips-empty' }, 'NO SONGS ON THIS ALBUM YET'));
      return;
    }
    for (const t of list) {
      // Read-only, like the title strips in a real jukebox: you read the code
      // here and punch it in on the selector. Strips are not clickable.
      const row = el('div', {
        class: 'strip', role: 'listitem', title: t.title,
        dataset: { track: t.id },
      },
        el('span', { class: 'strip-code led' }, t.code),
        el('span', { class: 'strip-title' }, t.title),
        el('span', { class: 'strip-aside' }));
      stripRows.set(t.id, row);
      stripsEl.append(row);
    }
    stripsEl.scrollTop = 0;
    updateMoreCue();
  }

  /* An album with more songs than fit scrolls inside the strip window. The
     MORE tag shows while there are songs below, and typing a code scrolls
     its strip into view. */
  function updateMoreCue() {
    const below = stripsEl.scrollHeight - stripsEl.clientHeight - stripsEl.scrollTop;
    $('strips-more').classList.toggle('is-shown', below > 12);
  }
  stripsEl.addEventListener('scroll', updateMoreCue, { passive: true });
  window.addEventListener('resize', updateMoreCue);

  /* Refresh strip states in place. Only a status shows (NOW, Q1, OUT OF ORDER);
     song lengths are left off so the titles get the room. */
  function updateStrips({ nowId, queue }) {
    for (const [id, row] of stripRows) {
      const st = getStatus(id);
      const queuePos = queue.indexOf(id);
      const aside = row.querySelector('.strip-aside');
      row.classList.toggle('is-missing', st.state === 'missing');
      row.classList.toggle('is-now', id === nowId);
      row.classList.toggle('is-queued', queuePos >= 0);
      let label = '';
      if (st.state === 'missing') label = 'OUT OF ORDER';
      else if (id === nowId) label = 'NOW';
      else if (queuePos >= 0) label = `Q${queuePos + 1}`;
      if (aside.textContent !== label) aside.textContent = label;
      const t = trackById.get(id);
      row.setAttribute('aria-label', `${t.code} ${t.title}${st.state === 'missing' ? ', out of order' : ''}`);
    }
  }

  /* ---- selector keypad ----
     Row of letters (each wears a tiny copy of its album cover), row of
     digits, then CLR / DEL / SELECT / COIN (those live in the HTML). */
  function renderKeypad() {
    const letters = $('key-letters');
    const digits = $('key-digits');
    letters.replaceChildren();
    digits.replaceChildren();
    letterKeys.clear();
    const mk = (label, key, extra = '', ariaLabel = null) => el('button', {
      class: `key ${extra}`.trim(), type: 'button', dataset: { key },
      'aria-label': ariaLabel || (label.length === 1 ? `Key ${label}` : label),
      onclick: () => handlers.keyPressed(key),
    }, label);
    for (const v of library.volumes) {
      const key = mk(v.letter, v.letter, 'key-letter', `Letter ${v.letter}, ${v.title}`);
      if (v.cover) key.style.setProperty('--cover', `url("${v.cover}")`);
      letterKeys.set(v.id, key);
      letters.append(key);
    }
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].forEach((d) => digits.append(mk(d, d)));
    letters.style.setProperty('--letter-cols', Math.min(10, Math.max(1, library.volumes.length)));
    $('key-clear').addEventListener('click', () => handlers.keyPressed('CLEAR'));
    $('key-del').addEventListener('click', () => handlers.keyPressed('BACK'));
  }

  function setCode(buffer) {
    const code = $('readout-code');
    code.textContent = buffer.length ? buffer.padEnd(2, '_') : '__';
    code.classList.toggle('is-typing', buffer.length > 0);
    // Latching keys, like a mechanical selector: the letter stays pushed in
    // (and lit) until the code is selected or cleared, and so do its digits.
    const held = new Set(buffer.split(''));
    for (const key of document.querySelectorAll('#key-letters .key, #key-digits .key')) {
      const isHeld = key.dataset.key === buffer[0] ? true : /\d/.test(key.dataset.key) && held.has(key.dataset.key);
      key.classList.toggle('is-latched', isHeld);
    }
    for (const [id, row] of stripRows) {
      const isTyped = buffer.length > 1 && trackById.get(id).code === buffer;
      row.classList.toggle('is-typed', isTyped);
      if (isTyped) row.scrollIntoView({ block: 'nearest' });
    }
  }

  /* The marquee sign announces each accepted pick, like a cabinet's
     selection display, then hands back to the wordmark. */
  let signTimer = null;
  function flashSelection(track) {
    if (!track) return;
    $('sf-code').textContent = track.code;
    $('sf-title').textContent = track.title;
    $('sign-flash').classList.add('is-on');
    clearTimeout(signTimer);
    signTimer = setTimeout(() => $('sign-flash').classList.remove('is-on'), SIGN_FLASH_MS);
  }

  let msgTimer = null;
  const IDLE_HINT = 'PICK A LETTER, THEN A NUMBER';
  function setMessage(text, kind = 'info') {
    const m = $('readout-msg');
    m.textContent = text || IDLE_HINT;
    m.dataset.kind = text ? kind : 'hint';
    clearTimeout(msgTimer);
    if (text) msgTimer = setTimeout(() => { m.textContent = IDLE_HINT; m.dataset.kind = 'hint'; }, 4200);
  }

  /* ---- up next ---- */
  const QUEUE_ROWS = 6;
  function renderQueue(queue, houseLine = [], modeLabel = 'HOUSE SHUFFLE') {
    const list = $('queue-list');
    list.replaceChildren();
    if (queue.length) list.append(el('li', { class: 'q-divider q-requests' }, 'YOUR PICKS'));
    queue.slice(0, QUEUE_ROWS).forEach((id, i) => {
      const t = trackById.get(id);
      if (!t) return;
      list.append(el('li', { class: 'q-row' },
        el('span', { class: 'q-pos led' }, String(i + 1)),
        queueText(t),
        el('button', { class: 'q-btn', type: 'button', 'aria-label': `Move ${t.title} up`, disabled: i === 0, onclick: () => handlers.moveUp(i) }, '▲'),
        el('button', { class: 'q-btn q-x', type: 'button', 'aria-label': `Cancel ${t.title}`, onclick: () => handlers.cancel(i) }, '✕')));
    });
    const more = queue.length - QUEUE_ROWS;
    if (more > 0) list.append(el('li', { class: 'q-more' }, `+${more} MORE WAITING`));
    // Spare rows show the labelled house plan; both groups remain readable.
    const spare = QUEUE_ROWS - Math.min(queue.length, QUEUE_ROWS);
    const house = houseLine.slice(0, spare).map((id) => trackById.get(id)).filter(Boolean);
    if (spare > 0) {
      list.append(el('li', { class: 'q-divider led', title: modeLabel }, house.length ? 'IF NOBODY PICKS' : 'PICK A SONG!'));
    }
    house.forEach((t, i) => {
      list.append(el('li', { class: 'q-row is-house' },
        el('span', { class: 'q-pos led' }, String(queue.length + i + 1)),
        queueText(t)));
    });
    // Long titles can make the plan taller than the screen: trim house rows first.
    const box = $('queue-screen');
    while (box.scrollHeight > box.clientHeight + 1 && list.lastElementChild?.classList.contains('is-house')) {
      list.lastElementChild.remove();
    }
  }

  function queueText(t) {
    const vol = volumeById.get(t.volume);
    return el('span', { class: 'q-text' },
      el('span', { class: 'q-title', dataset: { long: t.title.length > 28 ? '2' : t.title.length > 20 ? '1' : '0' } }, t.title),
      el('span', { class: 'q-sub led' }, `${t.code}${vol ? ` · ${vol.title.toUpperCase()}` : ''}`));
  }

  /* ---- now playing ---- */
  function setNow(track) {
    const volume = track ? volumeById.get(track.volume) : null;
    $('np-title').textContent = track ? track.title : 'PRESS START';
    $('np-volume').textContent = volume ? volume.title.toUpperCase() : ' ';
    $('np-code').textContent = track ? track.code : '--';
    fitTitle($('np-title'));
    if (!track) setProgress(0, NaN);
  }

  // Long titles shrink a step or two instead of overflowing.
  function fitTitle(node) {
    const len = node.textContent.length;
    node.dataset.size = len > 34 ? 'xs' : len > 19 ? 's' : len > 16 ? 'm' : 'l';
  }

  let lastShownSecond = -1;
  function setProgress(elapsed, duration) {
    const whole = Math.floor(elapsed || 0);
    const ratio = Number.isFinite(duration) && duration > 0 ? Math.min(1, elapsed / duration) : 0;
    $('np-fill').style.transform = `scaleX(${ratio.toFixed(4)})`;
    if (whole !== lastShownSecond) {
      lastShownSecond = whole;
      $('np-elapsed').textContent = formatClock(elapsed);
      $('np-remaining').textContent = formatCountdown(elapsed, duration);
      $('np-tube').setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    }
  }

  /* The "time left" reel spins up to the song's length as the needle drops
     (trivia's score-reel count-up). Calm: it just shows the final value. */
  function rollDuration(duration) {
    if (!Number.isFinite(duration)) return;
    lastShownSecond = 0;
    countUp($('np-remaining'), duration, { ms: 700, format: (n) => `-${formatClock(Math.ceil(n))}` });
  }

  /* ---- toast & problems ---- */
  let toastTimer = null;
  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 3800);
  }

  function showProblems(problems) {
    const list = $('problems-list');
    list.replaceChildren(...problems.map((p) => el('li', {}, p)));
    $('problems-modal').hidden = false;
    $('problems-close').focus();
  }

  return {
    renderRack, renderStrips, updateStrips, renderKeypad, setCode, setMessage,
    renderQueue, setNow, setProgress, rollDuration, toast, showProblems,
    get shownVolumeId() { return shownVolumeId; },
    /* Where a record's sleeve flies out from: the big sleeve if that album's
       page is showing, otherwise its letter key on the selector. */
    flashSelection,
    queueRows: QUEUE_ROWS,
    rackSleeve: (volumeId) => (volumeId === shownVolumeId ? $('rack-sleeve').querySelector('.sleeve') : letterKeys.get(volumeId)) || null,
    volumeIdForLetter: (letter) => library.volumes.find((v) => v.letter === letter)?.id || null,
  };
}

/* ============================================================
   TICKER - the LED sign that scrolls under the marquee. Each pass it asks
   for fresh text (so NOW PLAYING is always current), then glides right to
   left at a steady, readable speed. Calm: the text sits still and swaps
   every few seconds.
   ============================================================ */
const TICKER_REM_PER_SECOND = 4.2;      // slow enough to read every word from the back of the rink
const TICKER_CALM_MS = 8000;
const SIGN_FLASH_MS = 2200;             // how long the sign shows SELECTION J3 ACCEPTED
const RACK_TURN_MS = 700;               // the rack page flipping over when the album changes

export function createTicker({ textEl, nextText }) {
  let anim = null;
  let timer = null;
  let stopped = true;

  function remPx() { return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; }

  function clear() {
    clearTimeout(timer);
    if (anim) { anim.onfinish = null; anim.cancel(); anim = null; }
  }

  function run() {
    if (stopped) return;
    clear();
    textEl.textContent = nextText();
    if (isCalm()) {
      textEl.style.transform = 'none';
      textEl.parentElement.classList.add('is-calm');
      timer = setTimeout(run, TICKER_CALM_MS);
      return;
    }
    textEl.parentElement.classList.remove('is-calm');
    const laneW = textEl.parentElement.clientWidth;
    const textW = textEl.scrollWidth;
    const ms = ((laneW + textW) / (TICKER_REM_PER_SECOND * remPx())) * 1000;
    anim = textEl.animate(
      [{ transform: `translateX(${laneW}px)` }, { transform: `translateX(${-textW}px)` }],
      { duration: ms, easing: 'linear', fill: 'forwards' },
    );
    anim.onfinish = run;
    timer = setTimeout(run, ms + 3000);           // failsafe if the finish event is missed
  }

  return {
    start() { stopped = false; run(); },
    restart() { if (!stopped) run(); },
    stop() { stopped = true; clear(); },
  };
}

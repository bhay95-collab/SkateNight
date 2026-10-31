/* ============================================================
   UI - draws the pieces of the screen that change: the record rack,
   the title strips, the UP NEXT list, the keypad, the Now Playing
   readouts and the LED ticker.

   It holds no music logic. app.js tells it what to show and gives it
   functions to call when someone clicks something.
   ============================================================ */
import { formatClock, formatCountdown } from './format.js';
import { isCalm, onCalmChange, countUp } from './fx.js';
import { fitRackArtwork } from './rack-layout.js';
import { findTrackByCode } from './codes.js';

/* Selection guidance has one source, so a message returning to its idle state
   describes the code currently entered rather than the previous selection. */
export function selectionState(library, buffer, getStatus = () => ({})) {
  const idle = { track: null, ready: false, hint: 'PICK AN ALBUM LETTER', preview: '' };
  if (!buffer) return idle;
  const album = library.volumes.find((volume) => volume.letter === buffer[0]);
  if (!album) return idle;
  if (buffer.length === 1) return { ...idle, hint: `${album.letter}: PICK A TRACK NUMBER`, preview: album.title };
  const track = findTrackByCode(library, buffer);
  if (!track) return { ...idle, hint: `NO SONG ${buffer} · CHECK THE LIST`, preview: 'Choose a number shown on this album.' };
  const ready = getStatus(track.id).state !== 'missing';
  return {
    track, ready,
    hint: ready ? 'PRESS SELECT OR ENTER' : 'OUT OF ORDER · CHOOSE ANOTHER SONG',
    preview: `${track.code} · ${track.title}`,
  };
}

/* Keep the same action after a move. A cancellation chooses the next surviving
   request, then the previous one; the first row cannot offer Move up. */
export function queueFocusTarget(queue, focus) {
  if (!focus || !queue.length) return null;
  const same = queue.indexOf(focus.trackId);
  const index = same >= 0 ? same : Math.min(Math.max(0, focus.index), queue.length - 1);
  return { trackId: queue[index], action: focus.action === 'up' && index > 0 ? 'up' : 'cancel' };
}

/* Tiny helper: el('div', { class: 'x', onclick: fn }, child, 'text') */
function el(tag, props = {}, ...children) {
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
    // One failed load (a network blip) would otherwise leave the plain sleeve
    // up until a reload: try once more before giving up.
    let retried = false;
    img.addEventListener('error', () => {
      if (retried) { sleeve.classList.add('is-bare'); img.remove(); return; }
      retried = true;
      img.src = `${volume.cover}?retry=${Date.now()}`;
    });
    sleeve.append(img);
  } else {
    sleeve.classList.add('is-bare');
  }
  sleeve.append(el('span', { class: 'sleeve-price', 'aria-hidden': 'true' }, price));
  return sleeve;
}

/* ---------------- the UI object ---------------- */
export function createUI({ library, getStatus, handlers, getQuickPick = () => false }) {
  const $ = (id) => document.getElementById(id);
  const trackById = new Map(library.tracks.map((t) => [t.id, t]));
  const volumeById = new Map(library.volumes.map((v) => [v.id, v]));

  const stripsEl = $('strips');
  const rackPage = document.querySelector('.rack-page');
  const sleeveHost = $('rack-sleeve');
  const artwork = fitRackArtwork({
    panel: document.querySelector('.rack-panel'),
    heading: document.querySelector('.rack-heading'),
    controls: document.querySelector('.rack-album'),
    strips: stripsEl,
  });
  const letterKeys = new Map();
  const stripRows = new Map();
  let shownVolumeId = null;
  const volumeIds = library.volumes.map((v) => v.id);
  // One sleeve per album, built once and reused, so flipping the rack never
  // shows a blank sleeve while a fresh copy of the cover decodes.
  const rackSleeves = new Map(library.volumes.map((v) => [v.id, sleeveFace(v)]));

  /* Cancelling leaves both elements at their resting transform (the keyframes
     do not fill), so this is both the interrupt for a fast second press and
     the way to make the sleeve report an untransformed box mid-flip. */
  let rackFlip = [];
  function endRackFlip() {
    for (const anim of rackFlip) { try { anim.cancel(); } catch { /* already gone */ } }
    rackFlip = [];
  }
  // CALM means stop now, not stop after this turn: at 760ms plus the cascade
  // there is nearly a second of motion to cut short.
  onCalmChange((calm) => { if (calm) endRackFlip(); });

  function flipRack(forward) {
    endRackFlip();
    const frames = rackFlipKeyframes(forward);
    rackFlip = [rackPage, sleeveHost].filter(Boolean)
      .map((node) => node.animate(frames, { duration: RACK_TURN_MS, easing: RACK_TURN_EASE }));
    /* The strips then drop into the carrier one after another, as the page
       lands. They start part-way down and dimmed rather than invisible, so
       that during the first half of the turn - when the whole page is dark
       anyway - there is nothing missing to notice. */
    [...stripsEl.children].forEach((row, i) => {
      rackFlip.push(row.animate(
        [{ opacity: 0.5, transform: 'translateY(.45rem)' }, { opacity: 1, transform: 'none' }],
        {
          duration: STRIP_SETTLE_MS,
          delay: RACK_TURN_MS * STRIP_SETTLE_AT + i * STRIP_STAGGER_MS,
          easing: EASE_OUT,
          fill: 'backwards',          // hold the offset through the delay, do not flash
        },
      ));
    });
  }

  /* ---- the rack: one album page at a time ----
     Like the page display in a CD jukebox: a flexible sleeve with its title strips,
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

  /* ---- title strips (one complete album list) ---- */
  function renderStrips(volumeId) {
    const v = volumeById.get(volumeId);
    if (!v) return;
    const isNewPage = shownVolumeId !== null && shownVolumeId !== volumeId;
    const forward = volumeIds.indexOf(volumeId) >= volumeIds.indexOf(shownVolumeId);
    shownVolumeId = volumeId;
    for (const [id, key] of letterKeys) key.classList.toggle('is-open', id === volumeId);
    $('rack-letter').textContent = v.letter;
    $('rack-title').textContent = v.title;
    $('rack-count').textContent = `${volumeIds.indexOf(volumeId) + 1} / ${volumeIds.length}`;
    const sleeve = rackSleeves.get(volumeId);
    if (sleeveHost.firstChild !== sleeve) sleeveHost.replaceChildren(sleeve);

    stripsEl.replaceChildren();
    stripRows.clear();
    if (isNewPage) stripsEl.scrollTop = 0;
    stripsEl.dataset.accent = v.accent || 'gold';
    const list = library.tracks.filter((t) => t.volume === volumeId);
    $('rack-song-count').textContent = `${list.length} SONG${list.length === 1 ? '' : 'S'}`;
    if (list.length === 0) {
      stripsEl.append(el('p', { class: 'strips-empty' }, 'NO SONGS ON THIS ALBUM YET'));
    } else {
      for (const t of list) {
        // Code entry remains the default. Optional quick pick fills the code;
        // SELECT still confirms the request, so browsing never queues a song.
        const row = el('div', {
          class: 'strip', role: 'listitem', title: t.title,
          dataset: { track: t.id },
          onclick: () => { if (getQuickPick()) handlers.prefillTrack?.(t); },
          onkeydown: (event) => {
            if (!getQuickPick() || !['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            if (!event.repeat) handlers.prefillTrack?.(t);
          },
        },
          el('span', { class: 'strip-code led' }, t.code),
          el('span', { class: 'strip-title' }, t.title),
          el('span', { class: 'strip-aside' }));
        stripRows.set(t.id, row);
        stripsEl.append(row);
      }
      refreshQuickPick();
    }
    artwork.refresh();
    // Last: the strips are built and the cover is sized, so the first painted
    // frame of the turn is the real one rather than one already past the hinge.
    if (isNewPage && !isCalm()) flipRack(forward);
  }

  function refreshQuickPick() {
    const quick = getQuickPick();
    stripsEl.setAttribute('role', quick ? 'group' : 'list');
    stripsEl.classList.toggle('has-quick-pick', quick);
    for (const row of stripRows.values()) {
      row.setAttribute('role', quick ? 'button' : 'listitem');
      const track = trackById.get(row.dataset.track);
      const label = (row.getAttribute('aria-label') || `${track.code} ${track.title}`).replace(/, preview this selection$/, '');
      row.setAttribute('aria-label', `${label}${quick ? ', preview this selection' : ''}`);
      if (quick) row.setAttribute('tabindex', '0');
      else {
        if (document.activeElement === row) stripsEl.focus({ preventScroll: true });
        row.removeAttribute('tabindex');
      }
    }
  }

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
      const state = st.state === 'missing' ? ', out of order' : id === nowId ? ', now playing' : queuePos >= 0 ? `, queue position ${queuePos + 1}` : '';
      row.setAttribute('aria-label', `${t.code} ${t.title}${state}${getQuickPick() ? ', preview this selection' : ''}`);
      if (id === nowId) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    }
    showSelectionGuidance();
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
    letters.style.setProperty('--letter-cols', Math.min(5, Math.max(1, library.volumes.length)));
    letters.style.setProperty('--letter-count', Math.max(1, library.volumes.length));
    $('key-clear').addEventListener('click', () => handlers.keyPressed('CLEAR'));
    $('key-del').addEventListener('click', () => handlers.keyPressed('BACK'));
  }

  function setCode(buffer) {
    // New input starts the next selection. Routine renders of the same code
    // still preserve the current acceptance/error announcement.
    if (currentCode !== buffer) {
      messageActive = false;
      clearTimeout(msgTimer);
    }
    currentCode = buffer;
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
    const selected = selectionState(library, buffer, getStatus);
    for (const [id, row] of stripRows) {
      const isTyped = selected.track?.id === id;
      const wasTyped = row.classList.contains('is-typed');
      row.classList.toggle('is-typed', isTyped);
      // Only a newly entered code reveals its row. Moving this list's scroll
      // position directly keeps the cabinet and surrounding page in place.
      if (isTyped && !wasTyped) {
        const viewport = stripsEl.getBoundingClientRect();
        const strip = row.getBoundingClientRect();
        const top = viewport.top + stripsEl.clientTop;
        const bottom = top + stripsEl.clientHeight;
        if (strip.top < top) stripsEl.scrollTop += strip.top - top;
        else if (strip.bottom > bottom) stripsEl.scrollTop += strip.bottom - bottom;
      }
    }
    showSelectionGuidance();
  }

  /* The marquee sign announces each accepted pick, like a cabinet's
     selection display, then hands back to the wordmark. */
  let signTimer = null;
  function flashSelection(track) {
    if (!track) return;
    $('sf-code').textContent = track.code;
    $('sf-title').textContent = track.title;
    $('sign-flash').classList.add('is-on');
    if (!isCalm()) $('sf-code').animate([{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 140, easing: EASE_OUT });
    clearTimeout(signTimer);
    signTimer = setTimeout(() => $('sign-flash').classList.remove('is-on'), SIGN_FLASH_MS);
  }

  let msgTimer = null;
  let messageActive = false;
  let currentCode = '';
  function showSelectionGuidance() {
    const selected = selectionState(library, currentCode, getStatus);
    const preview = $('selection-preview');
    if (preview && preview.textContent !== selected.preview) preview.textContent = selected.preview;
    $('btn-select')?.classList.toggle('is-ready', selected.ready);
    if (messageActive) return;
    const message = $('readout-msg');
    if (message.textContent !== selected.hint) message.textContent = selected.hint;
    message.dataset.kind = 'hint';
  }

  function setMessage(text, kind = 'info') {
    const m = $('readout-msg');
    clearTimeout(msgTimer);
    messageActive = Boolean(text) && kind !== 'hint';
    if (text) {
      m.textContent = text;
      m.dataset.kind = kind;
    } else showSelectionGuidance();
    if (messageActive) msgTimer = setTimeout(() => {
      messageActive = false;
      showSelectionGuidance();
    }, 4200);
  }

  /* ---- up next ---- */
  const QUEUE_ROWS = 6;
  const requestRows = new Map();
  const houseRows = new Map();
  const requestDivider = el('li', { class: 'q-divider q-requests' }, 'YOUR PICKS');
  const houseDivider = el('li', { class: 'q-divider led' });
  let currentQueue = [];
  let queueSignature = null;
  let queueNodes = [];

  /* Requests slide to their new place instead of teleporting: measured before
     the rebuild, animated after it. House rows are deliberately left alone,
     because fitQueuePreview adds and drops them on every resize.
     ponytail: a cancelled row still vanishes at once. The rows below it slide
     up to close the gap, which is the bridge; a fading ghost would have to be
     taken out of the grid, and that breaks fitQueuePreview's overflow trim. */
  function measureRequestRows() {
    const tops = new Map();
    if (isCalm()) return tops;
    for (const [id, row] of requestRows) {
      if (row.isConnected) tops.set(id, row.getBoundingClientRect().top);
    }
    return tops;
  }

  function animateRequestRows(before) {
    if (isCalm()) return;                 // CALM: the universal transition:none rule cannot stop WAAPI
    const options = { duration: QUEUE_MOVE_MS, easing: EASE_OUT };
    for (const row of requestRows.values()) {
      if (!row.isConnected) continue;
      const was = before.get(row.dataset.track);
      if (was === undefined) {
        row.animate([{ opacity: 0, transform: 'translateY(-.4rem)' }, { opacity: 1, transform: 'none' }], options);
        continue;
      }
      const moved = was - row.getBoundingClientRect().top;
      if (Math.abs(moved) > 1) row.animate([{ transform: `translateY(${moved}px)` }, { transform: 'none' }], options);
    }
  }

  function reconcileChildren(parent, nodes) {
    let cursor = parent.firstChild;
    for (const node of nodes) {
      if (node === cursor) cursor = cursor.nextSibling;
      else parent.insertBefore(node, cursor);
    }
    while (cursor) {
      const next = cursor.nextSibling;
      cursor.remove();
      cursor = next;
    }
  }

  function renderQueue(queue, houseLine = [], modeLabel = 'HOUSE SHUFFLE') {
    const list = $('queue-list');
    const box = $('queue-screen');
    const signature = JSON.stringify([queue, houseLine.slice(0, Math.max(0, QUEUE_ROWS - queue.length)), modeLabel]);
    if (signature === queueSignature) {
      updateQueueContinuation();
      return;
    }
    queueSignature = signature;
    const before = measureRequestRows();
    const active = document.activeElement;
    const action = list.contains(active) ? active?.dataset.queueAction : null;
    const focus = action ? { trackId: active.dataset.track, action, index: currentQueue.indexOf(active.dataset.track) } : null;
    const scrollTop = box.scrollTop;
    currentQueue = queue.slice();
    queueNodes = queue.length ? [requestDivider] : [];
    queue.forEach((id, i) => {
      const t = trackById.get(id);
      if (!t) return;
      let row = requestRows.get(id);
      if (!row) {
        const activate = (operation) => {
          const index = currentQueue.indexOf(id);
          if (index >= 0) handlers[operation](index);
        };
        row = el('li', { class: 'q-row', dataset: { track: id } },
          el('span', { class: 'q-pos led' }), queueText(t),
          el('button', { class: 'q-btn', type: 'button', dataset: { track: id, queueAction: 'up' }, 'aria-label': `Move ${t.title} up`, onclick: () => activate('moveUp') }, '▲'),
          el('button', { class: 'q-btn q-x', type: 'button', dataset: { track: id, queueAction: 'cancel' }, 'aria-label': `Cancel ${t.title}`, onclick: () => activate('cancel') }, '✕'));
        requestRows.set(id, row);
      }
      row.querySelector('.q-pos').textContent = String(i + 1);
      row.querySelector('.q-pos').setAttribute('aria-label', `Queue position ${i + 1}`);
      const up = row.querySelector('[data-queue-action="up"]');
      if (up) up.disabled = i === 0;
      queueNodes.push(row);
    });
    for (const id of requestRows.keys()) if (!queue.includes(id)) requestRows.delete(id);
    // Only the automatic preview is capped. Every explicit request is available
    // to inspect, move or cancel in the operator's contained scroll area.
    const spare = QUEUE_ROWS - Math.min(queue.length, QUEUE_ROWS);
    const house = houseLine.slice(0, spare).map((id) => trackById.get(id)).filter(Boolean);
    if (spare > 0) {
      houseDivider.title = modeLabel;
      houseDivider.textContent = house.length ? 'IF NOBODY PICKS' : 'PICK A SONG!';
      queueNodes.push(houseDivider);
    }
    house.forEach((t, i) => {
      let row = houseRows.get(t.id);
      if (!row) {
        row = el('li', { class: 'q-row is-house' }, el('span', { class: 'q-pos led' }), queueText(t));
        houseRows.set(t.id, row);
      }
      row.querySelector('.q-pos').textContent = String(queue.length + i + 1);
      queueNodes.push(row);
    });
    fitQueuePreview();
    box.scrollTop = scrollTop;
    if (focus) {
      const target = queueFocusTarget(queue, focus);
      const row = target && requestRows.get(target.trackId);
      (row?.querySelector(`[data-queue-action="${target?.action}"]`) || box).focus({ preventScroll: true });
      box.scrollTop = scrollTop;
    }
    const count = $('queue-count');
    if (count) count.textContent = `${queue.length} REQUEST${queue.length === 1 ? '' : 'S'}`;
    animateRequestRows(before);           // after the scroll restore, so the deltas are honest
  }

  function fitQueuePreview() {
    const list = $('queue-list');
    const box = $('queue-screen');
    const scrollTop = box.scrollTop;
    reconcileChildren(list, queueNodes);
    for (const title of list.querySelectorAll('.q-title')) fitText(title, 'long', ['0', '1', '2']);
    // A house suggestion may yield to explicit requests, but is restored when
    // the panel grows. Resizing can never remove an accepted request.
    if (box.clientHeight > 0) {
      while (box.scrollHeight > box.clientHeight + 1 && list.lastElementChild?.classList.contains('is-house')) {
        list.lastElementChild.remove();
      }
      if (list.lastElementChild === houseDivider && queueNodes.some((node) => node.classList.contains('is-house'))) houseDivider.remove();
    }
    box.scrollTop = scrollTop;
    updateQueueContinuation();
  }

  function updateQueueContinuation() {
    const cue = $('queue-continuation');
    if (!cue) return;
    const box = $('queue-screen');
    const overflowing = box.scrollHeight > box.clientHeight + 2;
    const below = box.scrollTop + box.clientHeight < box.scrollHeight - 2;
    cue.hidden = !overflowing;
    const text = below ? 'SCROLL FOR MORE ↓' : '↑ BACK TO FIRST REQUEST';
    if (cue.textContent !== text) cue.textContent = text;
  }

  function queueText(t) {
    const vol = volumeById.get(t.volume);
    return el('span', { class: 'q-text' },
      el('span', { class: 'q-title', title: t.title, dataset: { long: '0' } }, t.title),
      el('span', { class: 'q-sub led' }, `${t.code}${vol ? ` · ${vol.title.toUpperCase()}` : ''}`));
  }

  /* ---- now playing ---- */
  let announcedTrackId = null;
  function setNow(track) {
    const volume = track ? volumeById.get(track.volume) : null;
    $('np-title').textContent = track ? track.title : 'PRESS START';
    $('np-volume').textContent = volume ? volume.title.toUpperCase() : ' ';
    $('np-code').textContent = track ? track.code : '--';
    fitText($('np-title'), 'size', ['l', 'm', 's', 'xs']);
    const nextId = track?.id ?? null;
    if (nextId !== announcedTrackId) {
      announcedTrackId = nextId;
      const announcement = $('now-announcement');
      if (announcement) announcement.textContent = track ? `Now playing: ${track.title}${volume ? `, ${volume.title}` : ''}.` : 'Playback stopped.';
    }
    if (!track) setProgress(0, NaN);
  }

  // Try the actual type at the actual available width. A short, wide-lettered
  // title and a longer narrow-lettered one need not receive the same size.
  function fitText(node, attribute, sizes) {
    if (!node || !node.clientWidth) return;
    for (const size of sizes) {
      node.dataset[attribute] = size;
      if (node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1) break;
    }
  }

  let sizingFrame = 0;
  function scheduleTextFit() {
    if (sizingFrame) return;
    sizingFrame = requestAnimationFrame(() => {
      sizingFrame = 0;
      fitText($('np-title'), 'size', ['l', 'm', 's', 'xs']);
      fitQueuePreview();
    });
  }
  const textObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleTextFit) : null;
  textObserver?.observe($('queue-screen'));
  if ($('np-title')?.parentElement) textObserver?.observe($('np-title').parentElement);
  $('queue-screen').addEventListener('scroll', updateQueueContinuation, { passive: true });
  window.addEventListener('resize', scheduleTextFit);
  document.fonts?.ready.then(scheduleTextFit).catch(() => {});

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
    const modal = $('problems-modal');
    modal.hidden = false;
    if (typeof modal.showModal === 'function' && !modal.open) modal.showModal();
    $('problems-close').focus();
  }

  return {
    renderRack, renderStrips, updateStrips, renderKeypad, refreshQuickPick, setCode, setMessage,
    renderQueue, setNow, setProgress, rollDuration, toast, showProblems,
    get shownVolumeId() { return shownVolumeId; },
    /* Where a record's sleeve flies out from: the big sleeve if that album's
       page is showing, otherwise its letter key on the selector. */
    flashSelection,
    queueRows: QUEUE_ROWS,
    rackSleeve: (volumeId) => {
      endRackFlip();        // the changer needs a resting box to fly the sleeve from
      return (volumeId === shownVolumeId ? sleeveHost.querySelector('.sleeve') : letterKeys.get(volumeId)) || null;
    },
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
/* Turning the rack is browsing, not navigating: it is meant to be watched.
   The page is heavy, so it leans into the turn and takes a long time settling
   out of it - no overshoot, which reads snappy rather than expensive. */
const RACK_TURN_MS = 760;               // the rack page flipping over when the album changes
const RACK_TURN_EASE = 'cubic-bezier(.45,0,.15,1)';      // weight going in, a long tail coming out
const STRIP_SETTLE_MS = 300;            // each title strip dropping into the carrier
const STRIP_STAGGER_MS = 42;            // ...one after another, down the page
const STRIP_SETTLE_AT = 0.52;           // they start settling just past halfway through the turn
const EASE_OUT = 'cubic-bezier(.23,1,.32,1)';   // mirrors --ease-out: WAAPI cannot read a CSS variable
const QUEUE_MOVE_MS = 200;

/* The cover and the title strips are ONE page turning on its hinge, so they
   take the same keyframes from the same edge. They sit in different branches
   of index.html (.rack-heading and .rack-page), which is the only reason this
   has to be shared by hand instead of animating a common parent. */
function rackFlipKeyframes(forward) {
  const transformOrigin = forward ? 'left center' : 'right center';
  return [
    { transform: `perspective(40rem) rotateY(${forward ? 84 : -84}deg)`, transformOrigin, opacity: 0.35, filter: 'brightness(.45)' },
    { transform: 'perspective(40rem) rotateY(0deg)', transformOrigin, opacity: 1, filter: 'brightness(1)' },
  ];
}

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

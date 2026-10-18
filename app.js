/* ============================================================
   APP - the conductor. Wires the pieces together:

     tracks.js --> codes.js (library) --> ui.js (screen)
     keypad / strips --> queue.js --> player.js (music)
                                  \--> mechanism.js (record changer)
     visualiser.js listens to the music and lights the machine

   The golden rule: THE MUSIC NEVER WAITS FOR AN ANIMATION. Audio is
   started on plain timers; the mechanism and lights run alongside and
   any of them can fail without the music noticing.
   ============================================================ */
import { buildLibrary, parseCode, findTrackByCode } from './codes.js';
import { enqueue, enqueueFront, takeNext, cancelAt, moveUp, dropIds } from './queue.js';
import { pickShuffle, pickInOrder, pushRecent } from './rotation.js';
import {
  ATTRACT_LINES, SKATE_JOKES, IDLE_JOKES, OUT_OF_ORDER_LINES,
  createRotator,
} from './copy.js';
import {
  initLights, flipLights, startBoot, isCalm, onCalmChange, delay, safely, startScreenFlicker,
} from './fx.js';
import { unlockAudio, setMusicLevel, setSfxLevel } from './audio.js';
import { sfx, preloadSfxFiles, decodeSfxFiles } from './sound.js';
import { createPlayer, probeAll } from './player.js';
import { createMechanism } from './mechanism.js';
import { createVisualiser, buildMirrorLight } from './visualiser.js';
import { createUI, createTicker } from './ui.js';
import {
  keepAwake, setupMediaSession, updateMediaSession, registerServiceWorker,
} from './rink.js';
import { listCrateFiles, crateStatus, loadCrates } from './crates.js';
import { clamp } from './format.js';

const $ = (id) => document.getElementById(id);

// How long before a song ends the record changer starts its swap (seconds).
const EJECT_LEAD_SEC = 2.5;
const LOAD_LEAD_SEC = 1.5;
const SKIP_SPEED = 1.8;           // the changer works faster on a skip
const IDLE_ATTRACT_MS = 60000;    // no input for this long -> attract light show
const ATTRACT_PAGE_MS = 9000;    // attract mode turns the rack to the next album this often
const STORE_VOL = 'sn-volumes';
const STORE_SHUFFLE = 'sn-shuffle';
const BACK_RESTART_SEC = 3;     // BACK after this long restarts the song; sooner goes to the previous one
const HISTORY_LIMIT = 50;

/* ------------------------------------------------------------
   Load tracks.js without letting a typo in it take the site down.
   ------------------------------------------------------------ */
async function loadLibrary() {
  try {
    const mod = await import('./tracks.js');
    return { library: buildLibrary(mod.volumes, mod.tracks), loadError: null };
  } catch (err) {
    console.error('[tracks.js]', err);
    return {
      library: buildLibrary([], []),
      loadError: `tracks.js could not be read - usually a missing comma, quote mark or bracket. The browser says: ${err.message || err}`,
    };
  }
}

async function main() {
  initLights();
  preloadSfxFiles();                                 // any sfx/*.mp3 recordings, fetched early
  safely('screen-flicker', () => startScreenFlicker(document.getElementById('crt-flicker')));
  $('btn-lights').addEventListener('click', () => { flipLights(); sfx.key(); });

  // Boot overlay is opaque from first paint; the machine assembles behind it.
  const boot = startBoot($('boot'));
  const attractScreen = $('attract');
  attractScreen.hidden = false;

  const { library, loadError } = await loadLibrary();
  const trackById = new Map(library.tracks.map((t) => [t.id, t]));
  const volumeById = new Map(library.volumes.map((v) => [v.id, v]));
  const problems = [...(loadError ? [loadError] : []), ...library.problems];
  problems.forEach((p) => console.warn('[tracks.js]', p));

  /* ---------------- state ---------------- */
  const status = new Map();                        // trackId -> { state, duration }
  const getStatus = (id) => status.get(id) || { state: 'unknown', duration: null };
  let queue = [];
  let recent = [];
  let houseLine = [];             // the house rotation's planned picks, in play order (shown greyed in UP NEXT)
  let takenId = null;              // taken off the queue / house line, not started yet (pre-roll)
  let takenFromHouse = false;
  let shuffle = true;              // SHUFFLE on = shuffled deck; off = play in tracks.js order
  try { shuffle = localStorage.getItem(STORE_SHUFFLE) !== 'off'; } catch { /* storage blocked - default on */ }
  let bag = [];                    // songs already played in the current shuffled deck
  let history = [];                // songs started, oldest first (for BACK)
  let nowId = null;
  let phase = 'idle';              // idle | playing | paused | changing
  let started = false;             // has the coin been inserted?
  let credits = 0;
  let codeBuffer = '';
  let codeTimer = 0;
  let changeToken = 0;
  let pre = {};                    // pre-roll bookkeeping for the natural song change
  let failures = 0;
  let engineReady = false;

  let player = null;
  let visualiser = null;

  const nextJoke = createRotator(SKATE_JOKES);
  const nextIdleJoke = createRotator(IDLE_JOKES);
  const nextAttractLine = createRotator(ATTRACT_LINES);
  const nextOutOfOrder = createRotator(OUT_OF_ORDER_LINES);

  /* ---------------- the screen ---------------- */
  const ui = createUI({
    library,
    getStatus,
    handlers: {
      openVolume: (id) => { ui.renderStrips(id); scheduleRender(); },
      keyPressed: (key) => { noteInput(); keyPressed(key); },
      moveUp: (i) => { queue = moveUp(queue, i); sfx.key(); afterQueueChange(); },
      cancel: (i) => { queue = cancelAt(queue, i); sfx.key(); afterQueueChange(); },
    },
  });
  const mech = createMechanism({ sfx });
  mech.setRackLookup((volumeId) => ui.rackSleeve(volumeId));

  ui.renderRack();
  ui.renderKeypad();
  const firstVolume = library.volumes.find((v) => library.tracks.some((t) => t.volume === v.id)) || library.volumes[0];
  if (firstVolume) ui.renderStrips(firstVolume.id);
  ui.setNow(null);
  ui.renderQueue([], []);
  buildMirrorLight($('mirror-light'));

  if (problems.length) {
    const btn = $('btn-problems');
    btn.hidden = false;
    btn.textContent = `CHECK TRACKS.JS (${problems.length})`;
    btn.addEventListener('click', () => ui.showProblems(problems));
    $('problems-close').addEventListener('click', () => { $('problems-modal').hidden = true; btn.focus(); });
  }

  /* ---------------- rendering ---------------- */
  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(() => {
      renderQueued = false;
      ui.updateStrips({ nowId, queue });
      planHouse();
      ui.renderQueue(queue, houseLine, shuffle ? 'HOUSE SHUFFLE' : 'HOUSE IN ORDER');
      const playText = phase === 'playing' ? 'PAUSE' : phase === 'paused' ? 'RESUME' : phase === 'changing' ? 'PAUSE' : 'START';
      $('btn-play-text').textContent = playText;
      $('btn-play').classList.toggle('is-playing', phase === 'playing');
    }, 0);
  }

  function renderCredits() {
    const node = $('credits-val');
    if (credits > 0) node.textContent = String(credits).padStart(2, '0');
    else node.textContent = 'FREE PLAY';
  }

  function say(text, kind = 'info') { ui.setMessage(text, kind); }

  /* ---------------- choosing what plays next ---------------- */
  const playableIds = () => library.tracks.filter((t) => getStatus(t.id).state !== 'missing').map((t) => t.id);

  /* The shuffled deck before a song is added: once every playable song has
     had its turn, a fresh deck starts (pickShuffle makes the same call). */
  const deckBefore = (deck, ids) => {
    const kept = deck.filter((id) => ids.includes(id));
    return ids.every((id) => kept.includes(id)) ? [] : kept;
  };

  /* Plan the house rotation far enough ahead to fill UP NEXT. Picks are made
     once and kept, so what UP NEXT shows greyed is exactly what plays if
     nobody chooses a song. Songs already in the queue are left out. */
  function planHouse() {
    const all = playableIds();
    houseLine = houseLine.filter((id) => all.includes(id) && !queue.includes(id));
    const ids = all.filter((id) => !queue.includes(id));
    const pool = ids.length ? ids : all;
    const want = Math.max(1, ui.queueRows - queue.length);
    const ahead = [...(takenId ? [takenId] : []), ...houseLine];
    if (!shuffle) {                                   // in order: the songs after this one
      let current = ahead.length ? ahead[ahead.length - 1] : nowId;
      const orderIds = library.tracks.map((t) => t.id);
      while (houseLine.length < want) {
        const id = pickInOrder({ orderIds, playableIds: pool, currentId: current });
        if (!id || houseLine.includes(id)) break;
        houseLine = [...houseLine, id];
        current = id;
      }
      return;
    }
    let deck = bag;
    let planRecent = recent;
    for (const id of ahead) { deck = [...deckBefore(deck, all), id]; planRecent = pushRecent(planRecent, id); }
    while (houseLine.length < want) {
      const pick = pickShuffle({ playableIds: pool, bag: deck, recent: planRecent, rng: Math.random });
      if (!pick.id) break;
      houseLine = [...houseLine, pick.id];
      deck = [...pick.bag, pick.id];
      planRecent = pushRecent(planRecent, pick.id);
    }
  }

  function ensureHouseNext() {
    planHouse();
    return houseLine[0] || null;
  }

  /* A song started. If it was not the house's next pick (someone chose it, or
     BACK), the plan adjusts: shuffle drops that song from the plan (it has now
     played); in order carries on from the song that just started. */
  function noteStarted(id) {
    const planned = takenFromHouse && takenId === id;
    takenId = null;
    takenFromHouse = false;
    if (planned) return;
    houseLine = shuffle ? houseLine.filter((h) => h !== id) : [];
  }

  /* Take the next song to play: the queue first, then the house rotation. */
  function dequeueNext() {
    while (queue.length) {
      const taken = takeNext(queue);
      queue = taken.queue;
      if (getStatus(taken.next).state !== 'missing') {
        takenId = taken.next;
        takenFromHouse = false;
        return taken.next;
      }
    }
    const id = ensureHouseNext();
    if (!id) return null;
    houseLine = houseLine.slice(1);
    takenId = id;
    takenFromHouse = true;
    return id;
  }

  /* Warm up the deck with whatever plays after this. */
  function refreshUpcoming() {
    if (!player) return;
    const id = queue.length ? queue[0] : ensureHouseNext();
    const track = id && trackById.get(id);
    if (track && getStatus(id).state !== 'missing') {
      player.cue(track);
      setTimeout(() => safely('cue', () => player.cue(track)), 500);   // the other deck may still be fading out
    }
  }

  function afterQueueChange() {
    refreshUpcoming();
    scheduleRender();
  }

  /* ---------------- starting a song ---------------- */
  function showNow(id) {
    const track = trackById.get(id);
    nowId = id;
    ui.setNow(track || null);
    ui.setProgress(0, getStatus(id).duration ?? NaN);
    if (track && phase !== 'idle') ui.renderStrips(ui.shownVolumeId || track.volume);
    scheduleRender();
  }

  async function startAudio(id, token) {
    if (token !== changeToken) return;
    const track = trackById.get(id);
    if (!track) return;
    nowId = id;
    recent = pushRecent(recent, id);
    if (!bag.includes(id)) bag = [...deckBefore(bag, playableIds()), id];
    history = [...history, id].slice(-HISTORY_LIMIT);
    noteStarted(id);
    phase = 'playing';
    mech.setPaused(false);
    const volume = volumeById.get(track.volume);
    updateMediaSession(track, volume, true);
    ui.setNow(track);
    ui.rollDuration(getStatus(id).duration);
    scheduleRender();
    const ok = await player.start(track, { fadeInMs: 300 });
    if (token !== changeToken) return;
    if (ok) {
      failures = 0;
      refreshUpcoming();
      scheduleRender();                          // so UP NEXT names the house pick
    }
  }

  /* Bring in a song from a standing start (nothing on the platter). */
  function playFromIdle() {
    if (!player) return;
    const id = dequeueNext();
    if (!id) {
      say('NO PLAYABLE SONGS - SEE THE README', 'bad');
      ui.toast('NO PLAYABLE SONGS YET - CHECK THE AUDIO FOLDER');
      return;
    }
    const token = ++changeToken;
    phase = 'changing';
    ticker.restart();                               // music starting cuts the "music has stopped" joke short
    const track = trackById.get(id);
    const volume = volumeById.get(track.volume);
    showNow(id);
    mech.load(volume, { speed: 1 }).catch(() => {});
    setTimeout(() => startAudio(id, token), mech.loadMs(1));
  }

  /* Change to a chosen song right now: fade out, swap discs quickly, drop the needle. */
  function changeTo(id) {
    const token = ++changeToken;
    pre = {};
    const wasPaused = phase === 'paused';
    phase = 'changing';
    player.fadeOut(wasPaused ? 20 : 220);
    const track = trackById.get(id);
    const volume = volumeById.get(track.volume);
    const ejectMs = mech.ejectMs(SKIP_SPEED);
    const loadMs = mech.loadMs(SKIP_SPEED);
    mech.swap(volume, { speed: SKIP_SPEED }).catch(() => {});
    setTimeout(() => { if (token === changeToken) showNow(id); }, ejectMs);
    setTimeout(() => startAudio(id, token), ejectMs + loadMs);
    scheduleRender();
  }

  /* SKIP / NEXT: the next song in the queue, or the house rotation's pick. */
  function skip() {
    if (!player) return;
    if (phase === 'idle') { playFromIdle(); return; }
    if (phase === 'changing') return;                    // the changer is already working
    const id = pre.nextId || dequeueNext();
    if (!id) return;
    changeTo(id);
  }

  /* BACK: more than 3 s into a song it starts that song again; sooner (or press it
     twice) it goes to the song played before. The song you leave goes to the top of
     UP NEXT, so NEXT brings you straight back to it. */
  function back() {
    if (!player || phase === 'idle' || phase === 'changing') return;
    const prevId = history.length >= 2 ? history[history.length - 2] : null;
    const canGoBack = prevId && getStatus(prevId).state !== 'missing';
    const elapsed = player.currentTime || 0;
    if (elapsed > BACK_RESTART_SEC || !canGoBack) {
      if (pre.ejectStarted) {                            // the changer already took the record away
        history = history.slice(0, -1);
        changeTo(nowId);
      } else {
        pre = {};
        player.restart();
        ui.setProgress(0, player.duration);
        mech.setProgress(0);
      }
      say('SONG RESTARTED', 'good');
      return;
    }
    if (pre.nextId) queue = enqueueFront(queue, pre.nextId).queue;   // keep anything already lined up
    queue = enqueueFront(queue, nowId).queue;
    history = history.slice(0, -2);
    const title = trackById.get(prevId).title;
    say(`BACK TO ${title.toUpperCase()}`, 'good');
    changeTo(prevId);
  }

  function setShuffle(on, { quiet = false } = {}) {
    shuffle = on;
    try { localStorage.setItem(STORE_SHUFFLE, on ? 'on' : 'off'); } catch { /* fine */ }
    bag = nowId ? [nowId] : [];
    houseLine = [];
    paintShuffle();
    if (player) { refreshUpcoming(); scheduleRender(); }
    if (!quiet) ui.toast(on ? 'SHUFFLE ON - EVERY SONG PLAYS BEFORE ANY REPEATS' : 'SHUFFLE OFF - PLAYING IN ORDER');
  }
  function paintShuffle() {
    const b = $('btn-shuffle');
    b.textContent = shuffle ? 'SHUFFLE: ON' : 'SHUFFLE: OFF';
    b.setAttribute('aria-pressed', String(shuffle));
  }

  /* The current song finished by itself. */
  function onEnded(endedId) {
    if (endedId !== nowId || phase !== 'playing') return;
    const token = ++changeToken;
    const id = pre.nextId || dequeueNext();
    const preloaded = Boolean(pre.loadStarted);
    pre = {};
    if (!id) { stopEverything(); return; }
    const track = trackById.get(id);
    const volume = volumeById.get(track.volume);
    showNow(id);
    if (preloaded) {
      startAudio(id, token);                     // record changer is already finished - go
    } else {
      phase = 'changing';
      const ejectMs = mech.ejectMs(SKIP_SPEED);
      const loadMs = mech.loadMs(SKIP_SPEED);
      mech.swap(volume, { speed: SKIP_SPEED }).catch(() => {});
      setTimeout(() => startAudio(id, token), ejectMs + loadMs);
    }
  }

  function onTime(current, duration, id) {
    if (id !== nowId || phase !== 'playing') return;
    ui.setProgress(current, duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    mech.setProgress(current / duration);
    const remaining = duration - current;
    safely('pre-roll', () => {
      if (!pre.ejectStarted && remaining <= EJECT_LEAD_SEC) {
        pre.ejectStarted = true;
        mech.eject({ speed: 1 }).catch(() => {});
      }
      if (!pre.loadStarted && remaining <= LOAD_LEAD_SEC) {
        const nextId = dequeueNext();
        if (nextId) {
          pre.nextId = nextId;
          pre.loadStarted = true;
          const t = trackById.get(nextId);
          mech.load(volumeById.get(t.volume), { speed: 1 }).catch(() => {});
          scheduleRender();
        }
      }
    });
  }

  function onDuration(id, duration) {
    const st = getStatus(id);
    if (!Number.isFinite(st.duration)) { status.set(id, { ...st, state: 'ok', duration }); scheduleRender(); }
  }

  /* A file would not load or play. Mark it, tell the room, move on. */
  function onError(id, err) {
    if (!trackById.has(id)) return;
    console.warn('[audio] could not play', id, err && (err.message || err.name || `code ${err.code}`));
    if (getStatus(id).state === 'missing') return;
    status.set(id, { state: 'missing', duration: null });
    queue = dropIds(queue, [id]);
    houseLine = houseLine.filter((h) => h !== id);
    const track = trackById.get(id);
    ui.toast(`${track.code} ${track.title} - ${nextOutOfOrder()}`);
    scheduleRender();
    if (id === nowId && (phase === 'playing' || phase === 'changing')) {
      failures += 1;
      if (failures >= 5 || playableIds().length === 0) {
        stopEverything();
        ui.toast('NOTHING CAN PLAY - CHECK THE AUDIO FOLDER');
        return;
      }
      pre = {};
      const next = dequeueNext();
      if (next) {
        const token = ++changeToken;
        showNow(next);
        startAudio(next, token);
      }
    } else {
      refreshUpcoming();
    }
  }

  function stopEverything() {
    changeToken += 1;
    phase = 'idle';
    pre = {};
    nowId = null;
    mech.eject({ speed: 1 }).catch(() => {});
    ui.setNow(null);
    updateMediaSession(null, null, false);
    scheduleRender();
  }

  function togglePlay() {
    if (!player) return;
    if (phase === 'idle') { playFromIdle(); return; }
    if (phase === 'playing') {
      player.pause();
      mech.setPaused(true);
      phase = 'paused';
      updateMediaSession(trackById.get(nowId), volumeById.get(trackById.get(nowId)?.volume), false);
    } else if (phase === 'paused') {
      mech.setPaused(false);
      phase = 'playing';
      player.resume();
      updateMediaSession(trackById.get(nowId), volumeById.get(trackById.get(nowId)?.volume), true);
    }
    scheduleRender();
  }

  /* ---------------- requesting songs ---------------- */
  function useCredit() {
    if (credits > 0) { credits -= 1; renderCredits(); }
  }

  function requestTrack(id) {
    if (!started) return false;
    const track = trackById.get(id);
    if (!track) return false;
    if (getStatus(id).state === 'missing') {
      sfx.buzz();
      say(nextOutOfOrder(), 'bad');
      return false;
    }
    const result = enqueue(queue, id);
    if (!result.ok) {
      sfx.buzz();
      say(result.reason === 'duplicate' ? 'ALREADY IN THE QUEUE' : 'THE QUEUE IS FULL', 'bad');
      return false;
    }
    queue = result.queue;
    sfx.confirm();
    useCredit();
    say(`ADDED ${track.code} - ${track.title}`, 'good');
    if (phase === 'idle') playFromIdle();
    else afterQueueChange();
    return true;
  }

  /* ---------------- the keypad ---------------- */
  function setBuffer(next) {
    codeBuffer = next;
    ui.setCode(codeBuffer);
    clearTimeout(codeTimer);
    if (codeBuffer) codeTimer = setTimeout(() => { codeBuffer = ''; ui.setCode(''); }, 15000);
  }

  function keyPressed(key) {
    if (!started) return;
    sfx.key();
    if (key === 'CLEAR') return setBuffer('');
    if (key === 'BACK') return setBuffer(codeBuffer.slice(0, -1));
    if (/^[A-Z]$/.test(key)) {
      const volumeId = ui.volumeIdForLetter(key);           // flip the rack to that album
      if (volumeId && volumeId !== ui.shownVolumeId) { ui.renderStrips(volumeId); scheduleRender(); }
      return setBuffer(key);
    }
    if (/^\d$/.test(key)) {
      if (!codeBuffer) { say('PICK A LETTER FIRST', 'bad'); return; }
      if (codeBuffer.length >= 3) return;
      setBuffer(codeBuffer + key);
    }
  }

  function selectPressed() {
    if (!started) return;
    noteInput();
    const parsed = parseCode(codeBuffer);
    if (!parsed) {
      sfx.buzz();
      say(codeBuffer ? 'TYPE A LETTER AND A NUMBER' : 'TYPE A CODE FIRST', 'bad');
      return;
    }
    const track = findTrackByCode(library, codeBuffer);
    setBuffer('');
    if (!track) {
      sfx.buzz();
      say(`NO SONG ${parsed.letter}${parsed.number}`, 'bad');
      return;
    }
    requestTrack(track.id);
    if (track.volume !== ui.shownVolumeId) ui.renderStrips(track.volume);
  }
  $('btn-select').addEventListener('click', selectPressed);

  /* ---------------- coins ---------------- */
  function insertCoin(quiet = false) {
    if (!quiet) sfx.coin();
    const coin = $('btn-coin');
    coin.classList.remove('is-dropping');
    void coin.offsetWidth;
    if (!isCalm()) coin.classList.add('is-dropping');
    credits += 1;
    renderCredits();
    const readout = $('credits-val');
    readout.classList.remove('is-scoring');
    void readout.offsetWidth;
    if (!isCalm()) readout.classList.add('is-scoring');   // the little punch as the counter ticks
  }
  $('btn-coin').addEventListener('click', () => { noteInput(); if (started) insertCoin(); });

  /* ---------------- operator controls ---------------- */
  $('btn-play').addEventListener('click', () => { noteInput(); togglePlay(); });
  $('btn-skip').addEventListener('click', () => { noteInput(); skip(); });
  $('btn-back').addEventListener('click', () => { noteInput(); back(); });
  $('btn-shuffle').addEventListener('click', () => { noteInput(); sfx.key(); setShuffle(!shuffle); });
  paintShuffle();

  const savedVol = (() => {
    try { return JSON.parse(localStorage.getItem(STORE_VOL)) || {}; } catch { return {}; }
  })();
  const musicSlider = $('vol-music');
  const sfxSlider = $('vol-sfx');
  if (Number.isFinite(savedVol.music)) musicSlider.value = savedVol.music;
  if (Number.isFinite(savedVol.sfx)) sfxSlider.value = savedVol.sfx;
  const applySliders = () => {
    setMusicLevel(musicSlider.value / 100);
    setSfxLevel(sfxSlider.value / 100);
    try { localStorage.setItem(STORE_VOL, JSON.stringify({ music: Number(musicSlider.value), sfx: Number(sfxSlider.value) })); } catch { /* fine */ }
  };
  musicSlider.addEventListener('input', applySliders);
  sfxSlider.addEventListener('input', applySliders);
  sfxSlider.addEventListener('change', () => sfx.key());
  applySliders();

  function nudgeVolume(delta) {
    musicSlider.value = clamp(Number(musicSlider.value) + delta, 0, 100);
    applySliders();
    ui.toast(`MUSIC VOLUME ${musicSlider.value}`);
  }

  const fsButton = $('btn-fs');
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => ui.toast('FULLSCREEN WAS BLOCKED - TRY F11'));
  }
  fsButton.addEventListener('click', () => { noteInput(); toggleFullscreen(); });
  document.addEventListener('fullscreenchange', () => {
    fsButton.firstChild.textContent = document.fullscreenElement ? 'EXIT FULLSCREEN ' : 'FULLSCREEN ';
  });

  /* LIGHTS button label follows the real state */
  const lightsBtn = $('btn-lights');
  const paintLights = (calm) => {
    lightsBtn.textContent = calm ? 'LIGHTS: CALM' : 'LIGHTS: FULL';
    lightsBtn.setAttribute('aria-pressed', String(calm));
  };
  onCalmChange(paintLights);
  paintLights(isCalm());

  /* ---------------- legend ---------------- */
  let legendTimer = 0;
  function showLegend(ms = 9000) {
    const legend = $('legend');
    legend.classList.add('is-on');
    clearTimeout(legendTimer);
    legendTimer = setTimeout(() => legend.classList.remove('is-on'), ms);
  }

  window.addEventListener('resize', scheduleRender);   // UP NEXT re-fits its greyed rows

  /* ---------------- the LED ticker ----------------
     One skate joke per pass: it rolls fully across and off before the next
     one comes in. Song changes never cut a joke short; the next pass simply
     picks from the right pool (music on, or music stopped). */
  const ticker = createTicker({
    textEl: $('ticker-text'),
    nextText: () => (phase === 'playing' || phase === 'changing' ? nextJoke() : nextIdleJoke()),
  });

  onCalmChange(() => ticker.restart());          // calm swaps the scroll for still text

  /* ---------------- idle attract mode ---------------- */
  let lastInput = performance.now();
  let attractOn = false;
  let attractTimer = 0;
  let attractIndex = 0;

  function enterAttract() {
    attractOn = true;
    document.body.classList.add('is-attract');
    // the rack flips through the albums on its own, like a jukebox on display
    const spin = () => {
      const vols = library.volumes;
      if (vols.length) {
        const v = vols[attractIndex % vols.length];
        safely('attract-page', () => { ui.renderStrips(v.id); scheduleRender(); });
        if (phase === 'idle') safely('idle-cover', () => mech.showIdleCover(v));
      }
      attractIndex += 1;
    };
    spin();
    attractTimer = setInterval(spin, ATTRACT_PAGE_MS);
  }
  function exitAttract() {
    attractOn = false;
    document.body.classList.remove('is-attract');
    clearInterval(attractTimer);
    mech.clearIdleCover();
  }
  function noteInput() {
    lastInput = performance.now();
    if (attractOn) exitAttract();
  }
  setInterval(() => {
    if (started && !attractOn && performance.now() - lastInput > IDLE_ATTRACT_MS) enterAttract();
  }, 5000);
  ['pointerdown', 'pointermove', 'wheel', 'keydown'].forEach((ev) => {
    window.addEventListener(ev, () => { if (started) noteInput(); }, { passive: true });
  });

  /* ---------------- the keyboard ---------------- */
  const codeLetters = new Set(library.volumes.map((v) => v.letter));
  window.addEventListener('keydown', (e) => {
    if (!started) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target;
    const onSlider = target instanceof HTMLInputElement && target.type === 'range';
    if (!$('problems-modal').hidden) {
      if (e.key === 'Escape') { $('problems-modal').hidden = true; $('btn-problems').focus(); }
      return;
    }
    const key = e.key;
    if (key === ' ' || key === 'Spacebar') { e.preventDefault(); if (!e.repeat) togglePlay(); return; }
    if ((key === 'ArrowLeft' || key === 'ArrowRight') && !onSlider && !(target.closest && target.closest('#rack'))) {
      e.preventDefault();
      if (!e.repeat) { if (key === 'ArrowLeft') back(); else skip(); }
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (onSlider) return;
      e.preventDefault();
      nudgeVolume(key === 'ArrowUp' ? 5 : -5);
      return;
    }
    if (key === 'Enter') {
      if (codeBuffer) { e.preventDefault(); selectPressed(); }
      return;
    }
    if (key === 'Backspace') { e.preventDefault(); keyPressed('BACK'); return; }
    if (key === 'Escape') { if (codeBuffer) { keyPressed('CLEAR'); } return; }
    if (key === '?') { showLegend(); return; }
    if (e.repeat) return;
    const upper = key.length === 1 ? key.toUpperCase() : '';
    if (upper === 'N') { skip(); return; }
    if (upper === 'P') { back(); return; }
    if (upper === 'S') { setShuffle(!shuffle); return; }
    if (upper === 'F') { toggleFullscreen(); return; }
    if (/^[A-Z]$/.test(upper) && codeLetters.has(upper)) { keyPressed(upper); return; }
    if (/^\d$/.test(upper)) { keyPressed(upper); }
  });
  // A focused button would also "click" on Space; the machine already handled it.
  window.addEventListener('keyup', (e) => {
    if (started && (e.key === ' ' || e.key === 'Spacebar')) e.preventDefault();
  });

  /* ---------------- offline crates ---------------- */
  const crateBtn = $('btn-crates');
  const crateFill = $('crate-fill');
  const ledOffline = $('led-offline');
  const offlineText = $('offline-text');
  let swOk = false;
  const setOffline = (state, text) => {
    ledOffline.dataset.state = state;
    offlineText.textContent = text;
  };
  const crateFiles = () => listCrateFiles({
    tracks: library.tracks.filter((t) => getStatus(t.id).state !== 'missing'),
    volumes: library.volumes,
  });

  async function refreshOfflineLed() {
    try {
      const files = crateFiles();
      if (files.length === 0) return setOffline('off', 'NO SONGS TO SAVE');
      const s = await crateStatus(files);
      if (!s.supported) return setOffline('bad', 'OFFLINE NOT SUPPORTED');
      if (s.saved === s.total && swOk) setOffline('ready', 'OFFLINE READY');
      else if (s.saved === s.total) setOffline('warn', 'SAVED - NEEDS HTTPS');
      else setOffline('off', s.saved ? `${s.saved}/${s.total} SAVED` : 'NOT OFFLINE YET');
    } catch (err) {
      console.warn('[crates]', err);
    }
  }

  crateBtn.addEventListener('click', async () => {
    noteInput();
    if (crateBtn.disabled) return;
    const files = crateFiles();
    if (files.length === 0) { ui.toast('NO SONGS FOUND TO SAVE YET'); return; }
    crateBtn.disabled = true;
    crateBtn.textContent = 'LOADING THE CRATES...';
    setOffline('busy', 'SAVING 0%');
    try {
      const result = await loadCrates(files, {
        onProgress: ({ done, total }) => {
          crateFill.style.transform = `scaleX(${(done / total).toFixed(3)})`;
          setOffline('busy', `SAVING ${done}/${total}`);
        },
      });
      if (result.unsupported) setOffline('bad', 'OFFLINE NOT SUPPORTED');
      else if (result.failed.length) {
        setOffline('warn', `${result.failed.length} NOT SAVED`);
        ui.toast(`${result.failed.length} FILES COULD NOT BE SAVED - PRESS THE BUTTON AGAIN`);
      } else {
        await refreshOfflineLed();
        ui.toast('THE CRATES ARE LOADED - READY TO RUN OFFLINE');
      }
    } catch (err) {
      console.warn('[crates]', err);
      setOffline('bad', 'SAVE FAILED');
    } finally {
      crateBtn.disabled = false;
      crateBtn.textContent = 'LOAD THE CRATES';
      setTimeout(() => { crateFill.style.transform = 'scaleX(0)'; }, 2500);
    }
  });

  /* ---------------- find out which songs exist, and how long they are ---------------- */
  function probeResult(track, r) {
    const prev = getStatus(track.id);
    if (r.ok === true) status.set(track.id, { state: 'ok', duration: Number.isFinite(r.duration) ? r.duration : prev.duration });
    else if (r.ok === false) status.set(track.id, { state: 'missing', duration: null });
    scheduleRender();
  }
  const probePromise = probeAll(library.tracks, probeResult).then(() => {
    const gone = library.tracks.filter((t) => getStatus(t.id).state === 'missing').map((t) => t.id);
    if (gone.length) {
      queue = dropIds(queue, gone);
      houseLine = houseLine.filter((h) => !gone.includes(h));
    }
    scheduleRender();
    refreshOfflineLed();
  });

  async function reprobeMissing() {
    const missing = library.tracks.filter((t) => getStatus(t.id).state === 'missing');
    if (missing.length === 0 || document.hidden) return;
    await probeAll(missing, probeResult, 2);
    refreshOfflineLed();
  }
  window.addEventListener('online', reprobeMissing);
  setInterval(reprobeMissing, 120000);

  /* ---------------- the INSERT COIN moment ---------------- */
  let attractLineTimer = 0;
  function rotateAttractSub() {
    const sub = $('attract-sub');
    sub.textContent = nextAttractLine();
  }

  async function startNight() {
    if (started) return;
    started = true;
    clearInterval(attractLineTimer);
    const engine = unlockAudio();                      // the click is the browser's required gesture
    engineReady = Boolean(engine);
    if (engineReady) {
      await Promise.race([decodeSfxFiles().catch(() => {}), delay(400)]);   // so a recorded coin plays first time
      safely('coin', () => sfx.coin());
      player = createPlayer({ onEnded, onTime, onError, onDuration });
      visualiser = createVisualiser();
      safely('visualiser', () => visualiser.start());
      setupMediaSession({
        onPlay: () => { if (phase === 'paused') togglePlay(); else if (phase === 'idle') playFromIdle(); },
        onPause: () => { if (phase === 'playing') togglePlay(); },
        onNext: () => skip(),
        onPrevious: () => back(),
      });
    } else {
      ui.toast('THIS BROWSER CANNOT PLAY AUDIO - TRY CHROME');
    }
    credits = 1;
    renderCredits();
    document.body.classList.remove('on-attract');
    attractScreen.classList.add('is-leaving');
    setTimeout(() => { attractScreen.hidden = true; }, isCalm() ? 0 : 520);
    keepAwake();
    ensureHouseNext();
    ticker.start();
    showLegend();
    scheduleRender();
    lastInput = performance.now();
    const reg = await registerServiceWorker();
    if (reg) {
      try { await navigator.serviceWorker.ready; swOk = true; } catch { swOk = false; }
    }
    probePromise.then(refreshOfflineLed);
    refreshOfflineLed();
  }

  /* Anything pressed on the attract screen starts the night. */
  attractScreen.addEventListener('click', () => startNight());
  window.addEventListener('keydown', (e) => {
    if (started || attractScreen.hidden) return;
    if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'].includes(e.key)) return;
    if (!bootDone) return;
    e.preventDefault();
    startNight();
  });

  /* ---------------- boot, then the attract screen ---------------- */
  let bootDone = !boot.played;
  if (boot.played) {
    boot.finished.then(() => { bootDone = true; });
    // Any press during the power-on skips ahead to INSERT COIN.
    const skipBoot = () => boot.skip();
    window.addEventListener('keydown', skipBoot, { once: true });
    window.addEventListener('pointerdown', skipBoot, { once: true });
    try { await Promise.race([document.fonts.ready, delay(2500)]); } catch { /* fonts are a nicety */ }
    boot.reveal();
  }
  rotateAttractSub();
  attractLineTimer = setInterval(rotateAttractSub, 5000);
  ticker.stop();
  $('attract').focus({ preventScroll: true });

  // Handy for tests and for Ben's console: nothing here is needed to run the night.
  window.__skateNight = {
    state: () => ({ phase, nowId, queue: queue.slice(), houseNext: houseLine[0] || null, houseLine: houseLine.slice(), started, recent: recent.slice() }),
    library,
    get player() { return player; },
  };
}

main().catch((err) => {
  console.error('[skate by faith] start-up failed', err);
  // Tell the person at the laptop instead of leaving a dead INSERT COIN screen.
  const sub = document.getElementById('attract-sub');
  if (sub) {
    sub.textContent = 'START-UP PROBLEM - PRESS F5 TO RELOAD';
    sub.style.color = 'var(--red)';
  }
  const attract = document.getElementById('attract');
  if (attract) attract.hidden = false;
  const boot = document.getElementById('boot');
  if (boot) boot.hidden = true;
});

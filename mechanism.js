/* ============================================================
   MECHANISM - the record changer in the middle of the machine.

   When a song is chosen:
     1. the volume's SLEEVE slides out of the rack (left panel) to the
        mechanism window, while the CAROUSEL (every record, on edge, in a
        ring round the platter - carousel.js) turns until the chosen record
        reaches the gripper,
     2. the RECORD swings up out of the ring, turning from edge-on to face-up,
        and DROPS onto the platter,
     3. the record starts SPINNING with the cover as its label,
     4. the TONEARM swings across and the needle lands - THUD.
   When a song ends everything runs in reverse.

   How it works: every move is one Web Animation (WAAPI) with a delay, so
   the whole sequence is scheduled at once and runs on the compositor
   (transform / opacity only). When the sequence finishes the animations
   are cancelled and plain CSS (the data-phase attribute) holds the
   finished picture, so nothing piles up over a long night.

   Calm lights: no animation at all - the finished picture is shown at once.
   A hidden tab, a slow laptop or a thrown error can never delay the
   music: app.js starts the audio on its own timers, never on these promises.
   ============================================================ */
import { sleeveFace } from './ui.js';
import { isCalm, delay } from './fx.js';
import { carouselTarget, drawCarousel } from './carousel.js';

// Timing at normal speed (milliseconds). app.js starts the next song's audio
// exactly LOAD_MS after calling load(), when the needle lands.
export const LOAD_MS = 1500;
export const EJECT_MS = 1000;
export const CALM_SWAP_MS = 200;

// Tonearm angles in degrees: parked, outer groove, inner groove.
const ARM_PARK = 3;
const ARM_START = 17;
const ARM_END = 30;

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';

export function createMechanism({ sfx, tracks = [], volumeById = new Map() }) {
  const $ = (id) => document.getElementById(id);
  const root = $('mech');
  const slot = $('mech-slot');
  const sleeveHost = $('mech-sleeve');
  const platter = $('platter');
  const mover = $('record-mover');
  const record = $('record');
  const label = $('record-label');
  const arm = $('arm');
  const ring = $('carousel');
  const gripper = $('gripper');

  // The carousel: one record per song, in tracks.js order, coloured by album.
  const trackIndex = new Map(tracks.map((t, i) => [t.id, i]));
  const ringRecords = tracks.map((t) => volumeById.get(t.volume)?.accent || 'gold');
  let ringDeg = 0;                  // how far the ring has turned (keeps growing: clockwise only)
  let outIndex = -1;                // the record out on the platter (a gap in the ring)
  const paintRing = () => drawCarousel(ring, ringRecords, outIndex);
  const setRing = (deg) => { ringDeg = deg; if (ring) ring.style.transform = `rotate(${deg}deg)`; };
  paintRing();
  window.addEventListener('resize', paintRing);

  let phase = 'empty';
  let running = null;               // { anims, timers } of the sequence in flight
  let currentVolume = null;
  let getRackSleeve = () => null;

  const setPhase = (p) => { phase = p; root.dataset.phase = p; };
  const setArm = (deg) => arm.style.setProperty('--arm-angle', `${deg}deg`);
  setArm(ARM_PARK);

  function setCover(volume) {
    if (!volume) return;
    currentVolume = volume;
    sleeveHost.replaceChildren(sleeveFace(volume));
    label.dataset.accent = volume.accent;
    label.style.backgroundImage = volume.cover ? `url("${volume.cover}")` : '';
  }

  function hardReset() {
    if (running) {
      running.timers.forEach(clearTimeout);
      running.anims.forEach((a) => { try { a.cancel(); } catch { /* already gone */ } });
      running = null;
    }
    record.classList.remove('is-spinning');
    gripper?.classList.remove('is-picking');
    outIndex = -1;
    paintRing();
    setArm(ARM_PARK);
    setPhase('empty');
  }

  function rects() {
    const slotRect = slot.getBoundingClientRect();
    const platRect = platter.getBoundingClientRect();
    const rackEl = currentVolume ? getRackSleeve(currentVolume.id) : null;
    const rackRect = rackEl ? rackEl.getBoundingClientRect() : null;
    let flip;
    if (rackRect && rackRect.width > 0) {
      flip = {
        x: rackRect.left - slotRect.left,
        y: rackRect.top - slotRect.top,
        s: rackRect.width / slotRect.width,
      };
    } else {
      flip = { x: -slotRect.width * 0.6, y: -slotRect.height * 0.2, s: 0.3 };
    }
    return { flip, radius: platRect.width / 2 };
  }

  // The record standing edge-on in the ring at the gripper, relative to the platter centre.
  const edgeOn = (radius) => tf(-radius * 0.94, 0, 1).replace(/scale\(1\)/, 'scale(0.07, 0.94)');

  const tf = (x, y, s = 1, r = 0) => `translate(${x}px, ${y}px) scale(${s}) rotate(${r}deg)`;

  /* Run a scheduled sequence, then call `finish` and clean up. */
  function runSequence(anims, ms, timers, finish) {
    return new Promise((resolve) => {
      const state = { anims, timers };
      running = state;
      const end = setTimeout(() => {
        if (running !== state) return resolve();      // pre-empted by a newer move
        running = null;
        finish();
        anims.forEach((a) => { try { a.cancel(); } catch { /* ignore */ } });
        resolve();
      }, ms);
      timers.push(end);
    });
  }

  /* Bring the next record in. Resolves when the needle is down. */
  async function load(volume, { speed = 1, trackId = null } = {}) {
    if (phase === 'playing' || running) hardReset();
    setCover(volume);
    const index = trackIndex.has(trackId) ? trackIndex.get(trackId) : -1;
    const fromDeg = ringDeg;
    const toDeg = carouselTarget(ringDeg, index, ringRecords.length);

    if (isCalm()) {
      setRing(toDeg);
      outIndex = index;
      paintRing();
      setArm(ARM_START);
      record.classList.add('is-spinning');
      setPhase('playing');
      sfx.thud();
      await delay(CALM_SWAP_MS);
      return;
    }

    const T = LOAD_MS / speed;
    const f = { sleeve: 0.31, rise: 0.23, drop: 0.13, arm: 0.33 };
    const tSleeve = f.sleeve * T;                    // the carousel turns while the sleeve slides in
    const tRise = f.rise * T;
    const tDrop = f.drop * T;
    const tArm = f.arm * T;
    const tDown = tSleeve + tRise + tDrop;
    const { flip, radius } = rects();
    const opts = (delayMs, duration, easing = EASE_OUT) => ({ delay: delayMs, duration, easing, fill: 'both' });

    setPhase('playing');         // the finished layout; the animations below paint over it
    sfx.whirr(tDown / 1000);

    setRing(toDeg);
    const anims = [
      slot.animate(
        [{ transform: tf(flip.x, flip.y, flip.s), opacity: 0.85 }, { transform: tf(0, 0, 1), opacity: 1 }],
        opts(0, tSleeve)),
      ring.animate(
        [{ transform: `rotate(${fromDeg}deg)` }, { transform: `rotate(${toDeg}deg)` }],
        opts(0, tSleeve * 0.94, EASE_IN_OUT)),
      mover.animate(
        [
          { transform: edgeOn(radius), opacity: 0, offset: 0 },
          { transform: edgeOn(radius), opacity: 1, offset: 0.06 },
          { transform: `translate(${-radius * 0.4}px, -14px) scale(0.72, 1.06)`, opacity: 1, offset: tRise / (tRise + tDrop) },
          { transform: tf(0, 0, 1), opacity: 1, offset: 1 },
        ],
        opts(tSleeve, tRise + tDrop, EASE_IN_OUT)),
      arm.animate(
        [{ transform: `rotate(${ARM_PARK}deg)` }, { transform: `rotate(${ARM_START}deg)` }],
        opts(tDown, tArm, EASE_IN_OUT)),
    ];

    gripper?.classList.add('is-picking');
    const timers = [
      setTimeout(() => { outIndex = index; paintRing(); }, tSleeve),     // the record leaves the ring
      setTimeout(() => gripper?.classList.remove('is-picking'), tDown),
      setTimeout(() => record.classList.add('is-spinning'), tDown),
      setTimeout(() => sfx.thud(), T),
    ];
    // Until the arm starts to move it stays parked; the animation's fill holds that.
    setArm(ARM_START);
    await runSequence(anims, T + 30, timers, () => { setArm(ARM_START); });
  }

  /* Take the record away again (arm lifts, record slides back under the
     sleeve, sleeve returns to the rack). */
  async function eject({ speed = 1 } = {}) {
    if (running) { hardReset(); return; }      // pre-empting a move in flight: just clear the deck
    if (phase !== 'playing') return;
    if (isCalm()) {
      hardReset();
      await delay(CALM_SWAP_MS);
      return;
    }
    const T = EJECT_MS / speed;
    const { flip, radius } = rects();
    const opts = (delayMs, duration, easing = EASE_OUT) => ({ delay: delayMs, duration, easing, fill: 'both' });
    const currentArm = parseFloat(arm.style.getPropertyValue('--arm-angle')) || ARM_START;

    sfx.whirr(T / 1000 * 0.8);
    const anims = [
      arm.animate(
        [{ transform: `rotate(${currentArm}deg)` }, { transform: `rotate(${ARM_PARK}deg)` }],
        opts(0, 0.26 * T, EASE_IN_OUT)),
      mover.animate(
        [
          { transform: tf(0, 0, 1), opacity: 1, offset: 0 },
          { transform: `translate(${-radius * 0.4}px, -14px) scale(0.72, 1.06)`, opacity: 1, offset: 0.4 },
          { transform: edgeOn(radius), opacity: 1, offset: 0.92 },
          { transform: edgeOn(radius), opacity: 0, offset: 1 },
        ],
        opts(0.22 * T, 0.36 * T, EASE_IN_OUT)),
      slot.animate(
        [{ transform: tf(0, 0, 1), opacity: 1, offset: 0 },
         { transform: tf(flip.x, flip.y, flip.s), opacity: 1, offset: 0.85 },
         { transform: tf(flip.x, flip.y, flip.s), opacity: 0, offset: 1 }],
        opts(0.55 * T, 0.45 * T)),
    ];
    const timers = [
      setTimeout(() => record.classList.remove('is-spinning'), 0.22 * T),
      setTimeout(() => { outIndex = -1; paintRing(); }, 0.58 * T),         // back in its slot in the ring
    ];
    await runSequence(anims, T + 30, timers, () => {
      record.classList.remove('is-spinning');
      setArm(ARM_PARK);
      setPhase('empty');
    });
  }

  return {
    load,
    eject,
    /* Eject whatever is there, then load the new record. */
    async swap(volume, { speed = 1, trackId = null } = {}) {
      await eject({ speed });
      await load(volume, { speed, trackId });
    },
    loadMs: (speed = 1) => (isCalm() ? CALM_SWAP_MS : LOAD_MS / speed),
    ejectMs: (speed = 1) => (isCalm() ? CALM_SWAP_MS : EJECT_MS / speed),
    setCover,
    setRackLookup(fn) { getRackSleeve = fn; },

    /* 0..1 through the song: the tonearm creeps toward the middle of the record. */
    setProgress(ratio) {
      if (phase !== 'playing' || running) return;
      const deg = ARM_START + (ARM_END - ARM_START) * Math.min(1, Math.max(0, ratio));
      setArm(deg);
    },
    setPaused(paused) { root.classList.toggle('is-paused', paused); },

    /* Idle "attract" look: show a cover on the empty mechanism without a record. */
    showIdleCover(volume) {
      if (phase === 'playing' || running) return;
      setCover(volume);
      root.classList.add('is-idle-cover');
    },
    clearIdleCover() { root.classList.remove('is-idle-cover'); },
    reset: hardReset,
    get phase() { return phase; },
  };
}

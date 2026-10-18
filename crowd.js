/* ============================================================
   CROWD SCREEN - the jukebox as the room sees it, for the projector.
   Open it from the CROWD SCREEN button (index.html?view=crowd), drag
   it to the projector and click it to go fullscreen.

   It plays no sound and has no controls. Everything it shows comes
   from the control window over link.js: what is playing, UP NEXT, the
   rack page, every record-changer move, SELECTION ACCEPTED, the song
   clock and the meter levels. Its own touches: the ticker jokes, the
   bubble tubes, the arch and the screen flicker (silent here).
   ============================================================ */
import { createUI, createTicker } from './ui.js';
import { createMechanism } from './mechanism.js';
import { createVisualiser, buildMirrorLight } from './visualiser.js';
import { mountArch } from './arch.js';
import { initLights, followLights, startBoot, startScreenFlicker, safely } from './fx.js';
import { SKATE_JOKES, IDLE_JOKES, createRotator } from './copy.js';
import { LIGHTS_KEY } from './lights.js';
import { createLink } from './link.js';

// The crowd screen is silent: every effect is a no-op here.
const silent = new Proxy({}, { get: () => () => {} });

export function runCrowd(library) {
  const $ = (id) => document.getElementById(id);
  document.body.classList.add('is-crowd');
  document.body.classList.remove('on-attract');
  $('attract').hidden = true;
  document.title = 'Skate by Faith - Crowd Screen';
  initLights();
  startBoot($('boot'));

  const trackById = new Map(library.tracks.map((t) => [t.id, t]));
  const volumeById = new Map(library.volumes.map((v) => [v.id, v]));
  let state = { phase: 'idle', nowId: null, queue: [], houseLine: [], shuffle: true, shownVolumeId: null, missing: [] };
  const getStatus = (id) => ({ state: state.missing.includes(id) ? 'missing' : 'ok', duration: null });

  const ui = createUI({ library, getStatus, handlers: { openVolume() {}, keyPressed() {}, moveUp() {}, cancel() {} } });
  const mech = createMechanism({ sfx: silent, tracks: library.tracks, volumeById });
  mech.setRackLookup((volumeId) => ui.rackSleeve(volumeId));
  ui.renderRack();
  const first = library.volumes.find((v) => library.tracks.some((t) => t.volume === v.id)) || library.volumes[0];
  if (first) ui.renderStrips(first.id);
  ui.setNow(null);
  ui.renderQueue([], []);
  $('crowd-tab').textContent = 'The Rack';
  buildMirrorLight($('mirror-light'));
  safely('arch', () => mountArch($('arch'), { rig: $('jukebox'), tubes: [$('tube-l'), $('tube-r')], cabinet: document.querySelector('.cabinet') }));
  safely('screen-flicker', () => startScreenFlicker($('crt-flicker')));

  const nextJoke = createRotator(SKATE_JOKES);
  const nextIdleJoke = createRotator(IDLE_JOKES);
  const isMusicOn = () => state.phase === 'playing' || state.phase === 'changing';
  const ticker = createTicker({ textEl: $('ticker-text'), nextText: () => (isMusicOn() ? nextJoke() : nextIdleJoke()) });
  ticker.start();

  let levels = null;
  const visualiser = createVisualiser({ source: () => levels });
  safely('visualiser', () => visualiser.start());

  // Lights follow the control window (same laptop, same saved setting).
  window.addEventListener('storage', (e) => { if (e.key === LIGHTS_KEY) followLights(e.newValue); });

  // Click (or F) for fullscreen; the pointer hides itself once fullscreen.
  const goFull = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); };
  document.addEventListener('click', goFull);
  document.addEventListener('keydown', (e) => { if (e.key === 'f' || e.key === 'F') goFull(); });

  function applyState(next) {
    const before = state;
    state = { ...state, ...next };
    if (state.shownVolumeId && state.shownVolumeId !== ui.shownVolumeId) ui.renderStrips(state.shownVolumeId);
    if (state.nowId !== before.nowId) ui.setNow(trackById.get(state.nowId) || null);
    ui.updateStrips({ nowId: state.nowId, queue: state.queue });
    ui.renderQueue(state.queue, state.houseLine, state.shuffle ? 'HOUSE SHUFFLE' : 'HOUSE IN ORDER');
    if (before.phase === 'idle' && isMusicOn()) ticker.restart();
    if (!state.nowId && mech.phase === 'playing') mech.eject({ speed: 1 });   // e.g. the control window was reloaded
  }

  const mechOps = {
    load: (d) => mech.load(volumeById.get(d.volumeId), { speed: d.speed || 1, trackId: d.trackId }),
    swap: (d) => mech.swap(volumeById.get(d.volumeId), { speed: d.speed || 1, trackId: d.trackId }),
    eject: (d) => mech.eject({ speed: d.speed || 1 }),
    paused: (d) => mech.setPaused(Boolean(d.paused)),
    idle: (d) => mech.showIdleCover(volumeById.get(d.volumeId)),
    clearIdle: () => mech.clearIdleCover(),
  };

  const link = createLink();
  link.listen(({ type, data }) => {
    if (type === 'operator') link.send('hello');
    else if (type === 'state') applyState(data);
    else if (type === 'time') {
      if (data.nowId !== state.nowId) return;
      ui.setProgress(data.current, data.duration);
      if (data.duration > 0) mech.setProgress(data.current / data.duration);
    } else if (type === 'levels') levels = data;
    else if (type === 'select') ui.flashSelection(trackById.get(data.trackId));
    else if (type === 'mech') {
      const op = mechOps[data.op];
      if (op) Promise.resolve(safely('mech', () => op(data))).catch(() => {});
    } else if (type === 'snapshot') {
      applyState(data.state);
      followLights(data.lights);
      const playing = trackById.get(data.state.nowId);
      if (playing && data.state.phase !== 'idle') {
        mech.showPlaying(volumeById.get(playing.volume), { trackId: playing.id, paused: data.state.phase === 'paused' });
      }
    }
  });
  link.send('hello');
  if (!link.available) ui.setMessage?.('THIS BROWSER CANNOT LINK THE SCREENS', 'bad');
}

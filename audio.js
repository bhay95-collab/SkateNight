/* ============================================================
   AUDIO - the one shared Web Audio engine.

   Two separate volume paths so the machine's beeps never fight the music:

       music decks --> [music volume] --+--> limiter --> speakers
                                        |
                              analysers (watch only: they feed the
                              spectrum bars, VU needles and light show)
       sound effects --> [SFX volume] ------> limiter --> speakers

   Vinyl surface voices follow each music deck's fade and music volume,
   with an additional trim that follows SFX volume.

   Browsers refuse to make sound until a person clicks or presses a key.
   unlockAudio() is called from that first click (the INSERT COIN press).
   ============================================================ */
import { perceptualVolume } from './format.js';

let engine = null;

export function unlockAudio() {
  if (!engine) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC({ latencyHint: 'playback' });

    // A gentle safety limiter: protects speakers if a loud track meets a loud beep.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);

    const musicBus = ctx.createGain();
    const sfxBus = ctx.createGain();
    musicBus.connect(limiter);
    sfxBus.connect(limiter);

    // Analysers only listen. fftSize 1024 = 512 frequency bars.
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.78;
    const splitter = ctx.createChannelSplitter(2);
    const analyserL = ctx.createAnalyser();
    const analyserR = ctx.createAnalyser();
    analyserL.fftSize = analyserR.fftSize = 512;
    musicBus.connect(analyser);
    musicBus.connect(splitter);
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);

    // A bass-only listener for beat detection: the music through a 140 Hz
    // low-pass (twice, for a steep cut), so only kick drum and bass guitar
    // reach it. Loud masters hold the full spectrum near its ceiling, which
    // hides beats there; the bass alone swings 4-5x between beats.
    const bassPass1 = ctx.createBiquadFilter();
    const bassPass2 = ctx.createBiquadFilter();
    bassPass1.type = bassPass2.type = 'lowpass';
    bassPass1.frequency.value = bassPass2.frequency.value = 140;
    const beatAnalyser = ctx.createAnalyser();
    beatAnalyser.fftSize = 1024;
    musicBus.connect(bassPass1);
    bassPass1.connect(bassPass2);
    bassPass2.connect(beatAnalyser);

    engine = { ctx, musicBus, sfxBus, analyser, analyserL, analyserR, beatAnalyser,
      musicLevel: pendingMusic, sfxLevel: pendingSfx, recordSurfaces: new Set() };
    applyVolumes();
  }
  if (engine.ctx.state === 'suspended') engine.ctx.resume().catch(() => {});
  return engine;
}

export const getEngine = () => engine;

function applyVolumes() {
  if (!engine) return;
  const t = engine.ctx.currentTime;
  engine.musicBus.gain.setTargetAtTime(perceptualVolume(engine.musicLevel), t, 0.03);
  engine.sfxBus.gain.setTargetAtTime(perceptualVolume(engine.sfxLevel), t, 0.03);
}

/* Slider values are 0 to 1. Remembered even before audio is unlocked. */
export function setMusicLevel(v) {
  pendingMusic = v;
  if (engine) { engine.musicLevel = v; applyVolumes(); }
}
export function setSfxLevel(v) {
  pendingSfx = v;
  if (engine) {
    engine.sfxLevel = v;
    applyVolumes();
    for (const surface of engine.recordSurfaces) surface.setLevel(v);
  }
}
let pendingMusic = 0.7;
let pendingSfx = 0.7;
export const getLevels = () => ({ music: pendingMusic, sfx: pendingSfx });

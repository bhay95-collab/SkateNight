import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationContinuity, songClockAlignment } from '../scripts/film-continuity.mjs';

const manifest = { fps: 30, cues: { registrationStartFrame: 1028, finalCinematicFrame: 1049 },
  handoff: { songStartSec: 31.393, openerTrackId: 'opener', record: { rpm: 45, cssAngleDeg: 91.056 } } };
function proof() {
  const filmEndedMs = 35100, period = 60000 / 45;
  return {
    stats: { filmEndedMs, outputLatencySec: 0.048 },
    frames: Array.from({ length: 1050 }, (_, frame) => [100 + frame * 1000 / 30, frame / 30]),
    samples: Array.from({ length: 35 }, (_, i) => {
      const time = (1028 + i) / 30, wall = 100 + time * 1000;
      return { film: Math.min(35, time), wall, playing: time < 35, live: true, track: 'opener',
        song: time - 31.393 + 0.048, filmOpacity: time < 35 ? 1 : 0.5,
        spinMs: 91.056 / 360 * period + wall - filmEndedMs };
    }),
  };
}

test('registration evidence includes the final sample, sink-aware drift and the exposed record phase', () => {
  const result = registrationContinuity(proof(), manifest);
  assert.ok(result.maxGapMs < 33.334);
  assert.ok(result.maxMediaStepFrames < 1.001);
  assert.equal(result.finalFramePresented, true);
  assert.equal(result.lastPresentedFrame, 1049);
  assert.ok(result.maxEstimatedAudibleDriftMs < 1e-8);
  assert.equal(result.liveBackgroundReady, true);
  assert.ok(result.exposedPhaseSamples >= 2);
  assert.ok(result.maxExposedPhaseErrorDeg < 1e-8);
});

test('a late registration stall cannot pass because the song-start window was smooth', () => {
  const result = proof();
  for (let i = 1037; i < result.frames.length; i++) result.frames[i][0] += 333;
  result.stats.filmEndedMs += 333;
  assert.ok(registrationContinuity(result, manifest).maxGapMs > 333);
  const missedFinal = proof();
  missedFinal.frames.pop();
  assert.equal(registrationContinuity(missedFinal, manifest).finalFramePresented, false);
});

test('late song slip, hidden background and crossfade phase jumps remain separate failures', () => {
  const result = proof();
  result.samples[3].song -= 0.3;
  result.samples[4].live = false;
  result.samples.find((s) => s.wall > result.stats.filmEndedMs).spinMs += 600;
  const continuity = registrationContinuity(result, manifest);
  assert.ok(continuity.maxEstimatedAudibleDriftMs > 299);
  assert.equal(continuity.liveBackgroundReady, false);
  assert.ok(continuity.maxExposedPhaseErrorDeg > 100);
});

test('presentation-clock comparison retains a biased media estimate instead of silently replacing it', () => {
  const result = proof();
  for (const sample of result.samples) sample.film -= 0.01;
  const alignment = songClockAlignment(result, manifest);
  assert.ok(alignment.presentedSamples >= 2);
  assert.ok(Math.abs(alignment.mediaStartErrorMs + 58) < 1e-8);
  assert.ok(Math.abs(alignment.estimatedAudibleStartErrorMs + 10) < 1e-8);
  assert.ok(Math.abs(alignment.presentedEstimatedAudibleStartErrorMs) < 1e-8);
  assert.ok(Math.abs(alignment.presentationClockDifferenceMs - 10) < 1e-8);
});

test('missing clock observations remain missing and legacy60 does not acquire native sink compensation', () => {
  const empty = { samples: [], frames: [], stats: {} };
  assert.equal(songClockAlignment(empty, manifest).estimatedAudibleStartErrorMs, null);
  assert.equal(songClockAlignment(empty, manifest).presentedEstimatedAudibleStartErrorMs, null);
  const legacy = songClockAlignment(proof(), { ...manifest, fps: 60 });
  assert.equal(legacy.sinkLatencyMs, 0);
  assert.ok(Math.abs(legacy.estimatedAudibleStartErrorMs + 48) < 1e-8);
});

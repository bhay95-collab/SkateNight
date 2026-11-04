import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { overlapPlan, registerRecord, validateAwakeningFilmManifest } from '../awakening-film.js';
import { OPENER } from '../rotation.js';

// The director's cut timing (cinematic/cues.json): contact on frame 951, song from 15.643 s, last frame 1154.
const overlapManifest = () => ({
  manifestVersion: 1,
  filmKind: 'production-preview',
  filmId: 'skate-by-faith-directors-cut-animatic',
  filmVersion: 1,
  width: 1920,
  height: 1080,
  fps: 60,
  frameCount: 1155,
  durationSec: 1155 / 60,
  videoCodec: 'h264',
  audioCodec: 'aac',
  audioSampleRate: 48000,
  audioChannels: 2,
  sha256: 'c'.repeat(64),
  cues: {
    coinSequenceStartFrame: 0,
    firstFailureFrame: 453,
    recoveryFrame: 584,
    stylusContactFrame: 951,
    musicHandoffFrame: 938,
    firstSongCueFrame: 951,
    registrationStartFrame: 1110,
    finalCinematicFrame: 1154,
  },
  handoff: {
    mode: 'overlap',
    videoFrame: 938,
    songStartSec: 15.643,
    openerTrackId: 'praise-lifted-on-high',
    interactiveState: 'jukebox-playing:praise-lifted-on-high',
    record: { cx: 1158 / 1920, cy: 421.4 / 1080, r: 90.5 / 1920, cssAngleDeg: 105.913, rpm: 45 },
  },
});

test('an overlap film is valid when contact lands on the first hit and the last frame on the reveal', () => {
  const manifest = overlapManifest();
  validateAwakeningFilmManifest(manifest, 'production-preview');
  const plan = overlapPlan(manifest);
  assert.equal(plan.songStartSec, 15.643);
  assert.ok(Math.abs(plan.contactSec - (15.643 + OPENER.firstHit)) <= 0.5 / 60);
  assert.ok(Math.abs(plan.endSec - (15.643 + OPENER.revealAt)) <= 1 / 60);
  assert.equal(plan.registrationStartSec, 1110 / 60);
  assert.equal(plan.record.rpm, 45);
});

test('a film that ends on the cut has no overlap plan', () => {
  const manifest = overlapManifest();
  delete manifest.handoff.mode;
  assert.equal(overlapPlan(manifest), null);
});

test('overlap timing that misses the first hit or the reveal is rejected', () => {
  const early = overlapManifest();
  early.cues.stylusContactFrame = 940;
  early.cues.firstSongCueFrame = 940;
  assert.throws(() => overlapPlan(early), /first hit/);
  const short = overlapManifest();
  short.handoff.songStartSec = 15.4;
  short.handoff.videoFrame = short.cues.musicHandoffFrame = Math.floor(15.4 * 60);
  assert.throws(() => overlapPlan(short), /first hit|reveal/);
  const handoff = overlapManifest();
  handoff.cues.musicHandoffFrame = 930;
  handoff.handoff.videoFrame = 930;
  assert.throws(() => overlapPlan(handoff), /song starts/);
});

test('overlap records must describe a circle inside the frame', () => {
  const manifest = overlapManifest();
  manifest.handoff.record.r = 0;
  assert.throws(() => overlapPlan(manifest), /record/);
});

test('registration rejects missing or invalid viewport geometry', () => {
  const { record } = overlapManifest().handoff;
  assert.throws(() => registerRecord(record, null, { x: 0, y: 0, width: 120, height: 120 }), /viewport/i);
  assert.throws(() => registerRecord(record, { width: 1920, height: 1080 }, null), /live record/i);
  assert.throws(() => registerRecord({ ...record, cx: 0 }, { width: 1920, height: 1080 }, { x: 0, y: 0, width: 120, height: 120 }), /record/i);
});

test('registration maps the film record onto the live record at the authored size', () => {
  const { record } = overlapManifest().handoff;
  const live = { x: 1067.5, y: 330.9, width: 181.1, height: 181.1 };
  const fit = registerRecord(record, { width: 1920, height: 1080 }, live);
  assert.ok(Math.abs(fit.scale - 1) < 0.002);
  assert.ok(Math.abs(fit.tx) < 1 && Math.abs(fit.ty) < 1);   // authored 90.5 px vs measured 90.55 px
  assert.ok(Math.abs(fit.mask.cx - 1158.05) < 0.5 && Math.abs(fit.mask.cy - 421.45) < 0.5);
});

test('registration follows the live record on any viewport, with the film covering the screen', () => {
  const { record } = overlapManifest().handoff;
  const viewport = { width: 1024, height: 768 };          // 4:3: the 16:9 film is cropped at the sides
  const live = { x: 600, y: 250, width: 120, height: 120 };
  const fit = registerRecord(record, viewport, live);
  const cover = 768 / 1080;
  const filmX = (1024 - 1920 * cover) / 2 + record.cx * 1920 * cover;
  const filmY = record.cy * 1080 * cover;
  // the transform carries the film's record centre onto the live centre at the live radius
  assert.ok(Math.abs(filmX * fit.scale + fit.tx - 660) < 0.01);
  assert.ok(Math.abs(filmY * fit.scale + fit.ty - 310) < 0.01);
  assert.ok(Math.abs(record.r * 1920 * cover * fit.scale - 60) < 0.01);
  assert.deepEqual([fit.mask.cx, fit.mask.cy, fit.mask.r], [660, 310, 60]);
});

test('the jukebox starts the opener from the film clock while the film is still running', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /overlapPlan\(/);
  assert.match(app, /registerRecord\(/);
  assert.match(app, /onTime/);
});

const extendedManifest = () => {
  const base = overlapManifest();
  return {
    ...base, filmId: 'production-preview-35s-native30-v1', experimental: true,
    fps: 30, frameCount: 1050, durationSec: 35,
    audioOwnership: { songEmbedded: false, trackId: OPENER.id },
    cues: { ...base.cues, firstFailureFrame: 249, recoveryFrame: 276,
      stylusContactFrame: 948, firstSongCueFrame: 948, musicHandoffFrame: 941,
      registrationStartFrame: 1028, finalCinematicFrame: 1049 },
    handoff: { ...base.handoff, videoFrame: 941, songStartSec: 31.393,
      record: { cx: 0.603125, cy: 0.39018517953378185, r: 0.047135416666666666, cssAngleDeg: 91.0557374652127, rpm: 45 } },
  };
};

test('only the explicit 35-second native30 effects preview can opt into 30 fps', () => {
  const manifest = extendedManifest();
  validateAwakeningFilmManifest(manifest, 'production-preview');
  const plan = overlapPlan(manifest);
  assert.equal(plan.fps, 30);
  assert.equal(plan.contactSec, 31.6);
  assert.equal(plan.songStartSec + OPENER.firstHit, plan.contactSec);
  assert.equal(plan.registrationStartSec, 1028 / 30);
  assert.equal(plan.endSec, 1049 / 30);
  assert.ok(Math.abs(plan.endSec - (plan.songStartSec + OPENER.revealAt)) < 1 / 30);
  assert.throws(() => validateAwakeningFilmManifest(manifest), /not a awakening/);
  for (const change of [
    { filmId: 'arbitrary-30fps-preview' }, { experimental: false }, { frameCount: 1051 },
    { audioOwnership: { songEmbedded: true, trackId: OPENER.id } },
    { audioOwnership: undefined }, { fps: 60 },
    { handoff: { ...manifest.handoff, mode: 'cut' } },
    { handoff: { ...manifest.handoff, record: { ...manifest.handoff.record, cssAngleDeg: 105.913 } } },
    { cues: { ...manifest.cues, registrationStartFrame: 1029 } },
  ]) assert.throws(() => validateAwakeningFilmManifest({ ...manifest, ...change }, 'production-preview'));
});

test('native30 registration preserves the approved C1 centre and radius across aspect ratios', () => {
  const { record } = extendedManifest().handoff;
  for (const [width, height] of [[1920,1080], [1440,900], [1280,800], [1024,768], [390,844]]) {
    const live = { x: width * 0.6, y: height * 0.35, width: 120, height: 120 };
    const fit = registerRecord(record, { width, height }, live);
    const cover = Math.max(width / 1920, height / 1080);
    const x = (width - 1920 * cover) / 2 + record.cx * 1920 * cover;
    const y = (height - 1080 * cover) / 2 + record.cy * 1080 * cover;
    assert.ok(Math.abs(x * fit.scale + fit.tx - (live.x + 60)) < 1e-9);
    assert.ok(Math.abs(y * fit.scale + fit.ty - (live.y + 60)) < 1e-9);
    assert.ok(Math.abs(record.r * 1920 * cover * fit.scale - 60) < 1e-9);
  }
});

test('both overlap formats reject coerced record dimensions before the registration cue', () => {
  for (const factory of [overlapManifest, extendedManifest]) {
    for (const key of ['cx', 'cy', 'r', 'cssAngleDeg', 'rpm']) {
      const value = factory().handoff.record[key];
      for (const invalid of [String(value), [value], null, {}, Infinity, NaN]) {
        const manifest = factory();
        manifest.handoff.record[key] = invalid;
        assert.throws(() => overlapPlan(manifest), /record/, `${key}: ${JSON.stringify(invalid)}`);
        assert.throws(() => validateAwakeningFilmManifest(manifest, 'production-preview'), /record/);
      }
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AWAKENING_FILM_FPS,
  AWAKENING_FILM_FRAME_COUNT,
  AWAKENING_FILM_HEIGHT,
  AWAKENING_FILM_ID,
  AWAKENING_FILM_WIDTH,
  validateAwakeningFilmManifest,
} from '../awakening-film.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const validManifest = () => ({
  filmId: AWAKENING_FILM_ID,
  width: AWAKENING_FILM_WIDTH,
  height: AWAKENING_FILM_HEIGHT,
  fps: AWAKENING_FILM_FPS,
  frameCount: AWAKENING_FILM_FRAME_COUNT,
  durationSec: AWAKENING_FILM_FRAME_COUNT / AWAKENING_FILM_FPS,
  videoCodec: 'h264',
  audioCodec: 'aac',
  sha256: 'a'.repeat(64),
});
const validPreviewManifest = () => ({
  manifestVersion: 1,
  filmKind: 'production-preview',
  filmId: 'skate-by-faith-groove-lookdev',
  filmVersion: 1,
  width: 1920,
  height: 1080,
  fps: 60,
  frameCount: 300,
  durationSec: 5,
  videoCodec: 'h264',
  audioCodec: 'aac',
  audioSampleRate: 48000,
  audioChannels: 2,
  sha256: 'b'.repeat(64),
  cues: {
    coinSequenceStartFrame: 0,
    firstFailureFrame: null,
    recoveryFrame: null,
    stylusContactFrame: 270,
    musicHandoffFrame: 299,
    firstSongCueFrame: 299,
    finalCinematicFrame: 299,
  },
  handoff: {
    videoFrame: 299,
    openerTrackId: 'praise-lifted-on-high',
    interactiveState: 'jukebox-playing:praise-lifted-on-high',
  },
});

test('accepts only the complete current 1080p60 H.264/AAC Awakening export', () => {
  assert.doesNotThrow(() => validateAwakeningFilmManifest(validManifest()));
  for (const change of [
    { filmId: 'old-film' },
    { width: 1280 },
    { height: 720 },
    { fps: 30 },
    { frameCount: AWAKENING_FILM_FRAME_COUNT - 1 },
    { videoCodec: 'vp9' },
    { audioCodec: 'opus' },
    { durationSec: 1 },
    { sha256: 'not-a-checksum' },
  ]) {
    assert.throws(() => validateAwakeningFilmManifest({ ...validManifest(), ...change }));
  }
});

test('validates versioned production previews and their explicit jukebox handoff', () => {
  const manifest = validPreviewManifest();
  assert.doesNotThrow(() => validateAwakeningFilmManifest(manifest, 'production-preview'));
  assert.throws(() => validateAwakeningFilmManifest(manifest), /not a awakening/);
  for (const change of [
    { manifestVersion: 2 },
    { filmId: 'unversioned_preview' },
    { filmVersion: 0 },
    { audioSampleRate: 44100 },
    { cues: { ...manifest.cues, finalCinematicFrame: 298 } },
    { handoff: { ...manifest.handoff, videoFrame: 298 } },
    { handoff: { ...manifest.handoff, openerTrackId: 'wrong-song' } },
  ]) {
    assert.throws(() => validateAwakeningFilmManifest({ ...manifest, ...change }, 'production-preview'));
  }
});

test('the film is local PWA data and never added to the service-worker shell cache', () => {
  const sw = read('sw.js');
  assert.match(sw, /'awakening-film\.js'/, 'the importer module is cached offline');
  assert.doesNotMatch(sw, /awakening-film-.*\.mp4/, 'the cinematic asset is not a Git or service-worker asset');
  const app = read('app.js');
  assert.match(app, /await awakeningFilm\.prepare\(\)/, 'film readiness is checked before the coin handler is installed');
  assert.ok(app.indexOf('await awakeningFilm.prepare()') < app.indexOf("attractScreen.addEventListener('click'"),
    'the video is verified before a coin press can start the night');
  assert.match(app, /await film\.play/, 'coin playback uses the verified local film');
  assert.match(app, /await cabinetStart\?\.insert\(filmSound\)/, 'the existing live cut remains the fallback');
  assert.match(app, /prefers-reduced-motion: reduce/, 'reduced motion keeps the live gentle cut');
});

test('operator import UI is available from TOOLS and uses OPFS-backed verification', () => {
  const html = read('index.html');
  assert.match(html, /Prepare for Show/);
  assert.match(html, /id="film-files"[^>]*multiple/);
  const app = read('app.js');
  assert.match(app, /PREPARE_ON_LAUNCH/);
  assert.match(app, /e\.code === 'KeyP' && e\.altKey && e\.shiftKey/);
  assert.match(app, /swRegistration\.then\(async \(reg\)/);
  const module = read('awakening-film.js');
  assert.match(module, /navigator\.storage\.getDirectory/);
  assert.match(module, /SHA-256/);
  assert.match(module, /createWritable/);
  assert.match(module, /const FILE_PREFIX = 'awakening-film-'/);
  assert.match(module, /const PREVIEW_PREFIX = 'cinematic-preview-'/);
  assert.match(read('app.js'), /startNight\(\{ previewFilm: true \}\)/);
});

test('export and on-device benchmarks use fixed film frames and compare live/video delivery', () => {
  const exporter = read('scripts/render-awakening.mjs');
  assert.match(exporter, /__advanceAwakening\(time\)/);
  assert.match(exporter, /frame \* frameMs/);
  assert.match(exporter, /libx264/);
  assert.match(exporter, /-c:a', 'aac/);
  assert.match(read('sound.js'), /OfflineAudioContext/);
  const bench = read('bench.js');
  assert.match(bench, /video: film \|\| 'no pre-rendered film played'/);
  assert.ok(read('README.md').includes('`?bench&cut=plunge&live=1`'));
});

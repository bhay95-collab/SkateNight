import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import {
  AWAKENING_FILM_FPS,
  AWAKENING_FILM_FRAME_COUNT,
  AWAKENING_FILM_HEIGHT,
  AWAKENING_FILM_ID,
  AWAKENING_FILM_WIDTH,
  describeFilm,
  NATIVE30_CONTRACT,
  validateAwakeningFilmManifest,
  validateHostedAwakeningManifest,
} from '../awakening-film.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
// The show-film fixture is built from the approved timing file itself, so a pass
// proves the runtime's locked contract and cinematic/extended/cues.json agree.
const cueFile = JSON.parse(read('cinematic/extended/cues.json'));
const frameAt = (seconds) => Math.floor(seconds * cueFile.fps + 0.5);   // nearest frame, half upward (cues.json rounding)
const songFrame = Math.floor(cueFile.audio.songPlayback * cueFile.fps);
const validManifest = () => ({
  manifestVersion: 1,
  filmKind: 'awakening',
  filmId: AWAKENING_FILM_ID,
  filmVersion: 1,
  experimental: false,
  width: AWAKENING_FILM_WIDTH,
  height: AWAKENING_FILM_HEIGHT,
  fps: cueFile.fps,
  frameCount: cueFile.frame_count,
  durationSec: cueFile.duration_seconds,
  videoCodec: 'h264',
  audioCodec: 'aac',
  audioSampleRate: 48000,
  audioChannels: 2,
  audioOwnership: { trackId: cueFile.opener.track_id, songEmbedded: false },
  sha256: 'a'.repeat(64),
  cues: {
    coinSequenceStartFrame: 0,
    firstFailureFrame: frameAt(cueFile.cues.failure),
    recoveryFrame: frameAt(cueFile.cues.catch),
    stylusContactFrame: frameAt(cueFile.cues.stylusContact),
    musicHandoffFrame: songFrame,
    firstSongCueFrame: frameAt(cueFile.cues.stylusContact),
    registrationStartFrame: frameAt(cueFile.cues.registrationStart),
    finalCinematicFrame: cueFile.frame_count - 1,
  },
  handoff: {
    mode: 'overlap',
    songStartSec: cueFile.audio.songPlayback,
    videoFrame: songFrame,
    openerTrackId: cueFile.opener.track_id,
    interactiveState: `jukebox-playing:${cueFile.opener.track_id}`,
    record: { ...cueFile.c1.record },
  },
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

test('the runtime contract is the approved native-30 timing file', () => {
  assert.equal(AWAKENING_FILM_FPS, cueFile.fps);
  assert.equal(AWAKENING_FILM_FRAME_COUNT, cueFile.frame_count);
  assert.equal(NATIVE30_CONTRACT.durationSec, cueFile.duration_seconds);
  assert.equal(NATIVE30_CONTRACT.songStartSec, cueFile.audio.songPlayback);
  assert.equal(NATIVE30_CONTRACT.stylusContactFrame, frameAt(cueFile.cues.stylusContact));
  assert.equal(NATIVE30_CONTRACT.stylusContactFrame, frameAt(cueFile.audio.firstHit));
  assert.equal(NATIVE30_CONTRACT.registrationStartFrame, frameAt(cueFile.cues.registrationStart));
  assert.equal(NATIVE30_CONTRACT.finalCinematicFrame, frameAt(cueFile.cues.final));
  assert.deepEqual({ ...NATIVE30_CONTRACT.record }, cueFile.c1.record);
});

test('accepts only the approved 35-second 1080p30 effects-only show film', () => {
  assert.doesNotThrow(() => validateAwakeningFilmManifest(validManifest()));
  const base = validManifest();
  for (const change of [
    { filmId: 'skate-by-faith-awakening-plunge-1080p60-v1' },   // the earlier 19.25 s cut can never be selected
    { width: 1280 },
    { height: 720 },
    { fps: 60 },
    { frameCount: AWAKENING_FILM_FRAME_COUNT - 1 },
    { videoCodec: 'vp9' },
    { audioCodec: 'opus' },
    { durationSec: 34 },
    { sha256: 'not-a-checksum' },
    { experimental: true },
    { audioOwnership: { ...base.audioOwnership, songEmbedded: true } },
    { cues: { ...base.cues, stylusContactFrame: 947, firstSongCueFrame: 947 } },
    { cues: { ...base.cues, registrationStartFrame: 1027 } },
    { handoff: { ...base.handoff, songStartSec: 31.4 } },
    { handoff: { ...base.handoff, record: { ...base.handoff.record, cx: 0.6 } } },
    { handoff: { ...base.handoff, record: { ...base.handoff.record, rpm: 33 } } },
  ]) {
    assert.throws(() => validateAwakeningFilmManifest({ ...base, ...change }), undefined, JSON.stringify(change));
  }
  assert.throws(() => validateAwakeningFilmManifest({ ...base, filmKind: 'production-preview' }), /not a awakening/);
  assert.equal(describeFilm({ ...base, sha256: 'cf4befea'.padEnd(64, '0') }),
    'V1 · 35.0 S · 1920x1080 · 30 FPS · SHA CF4BEFEA');
});

test('the committed website film is the approved asset its manifest names', () => {
  const manifest = JSON.parse(read('films/manifest.json'));
  const video = validateHostedAwakeningManifest(manifest, 'https://bhay95-collab.github.io/SkateNight/films/manifest.json');
  assert.equal(video.href, `https://bhay95-collab.github.io/SkateNight/films/${manifest.videoFile}`);
  // v2: the approved picture with Sound Design V4 (video stream copied from v1, untouched)
  assert.equal(manifest.sha256, '402b2ca892d26dd56a9762429e2fbc2a4461d020065fc57ea299adbd12983cc9');
  assert.equal(manifest.soundDesign.videoStreamCopiedFrom, 'cf4befeae5eb1f13eb142a73bfa080ae3137172d9ce5fdcb909428611f834d6c');
  const rollback = readFileSync(new URL('../films/song-inside-35s-v1.mp4', import.meta.url));
  assert.equal(createHash('sha256').update(rollback).digest('hex'), manifest.soundDesign.videoStreamCopiedFrom,
    'the published v1 film stays in place, unchanged, for rollback');
  const file = new URL(`../films/${manifest.videoFile}`, import.meta.url);
  assert.equal(statSync(file).size, manifest.hostedSizeBytes);
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), manifest.sha256);
  assert.equal(manifest.audioOwnership.songEmbedded, false, 'the website film never carries the song');
  assert.doesNotMatch(JSON.stringify(manifest), /\/Users\//, 'no local render paths are published');
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

test('hosted delivery is versioned, same-origin and gated by explicit approval', () => {
  const manifest = {
    ...validManifest(),
    videoFile: 'song-inside-35s-v1.mp4',
    productionApproval: {
      status: 'approved',
      approvedBy: 'Production review',
      approvedAt: '2026-10-31T12:00:00.000Z',
    },
  };
  assert.equal(
    validateHostedAwakeningManifest(manifest, 'https://skate.example/films/manifest.json').href,
    'https://skate.example/films/song-inside-35s-v1.mp4',
  );
  assert.equal(
    validateHostedAwakeningManifest(manifest, 'https://example.github.io/SkateNight/films/manifest.json').href,
    'https://example.github.io/SkateNight/films/song-inside-35s-v1.mp4',
  );
  assert.throws(() => validateHostedAwakeningManifest(
    { ...manifest, productionApproval: undefined },
    'https://skate.example/films/manifest.json',
  ), /not been approved/);
  for (const videoFile of [
    'https://attacker.example/film.mp4',
    '../outside.mp4',
    'awakening-v1.json',
  ]) {
    assert.throws(() => validateHostedAwakeningManifest(
      { ...manifest, videoFile },
      'https://skate.example/films/manifest.json',
    ));
  }
});

test('the film is local PWA data and never added to the service-worker shell cache', () => {
  const sw = read('sw.js');
  assert.match(sw, /'awakening-film\.js'/, 'the importer module is cached offline');
  assert.doesNotMatch(sw, /awakening-film-.*\.mp4/, 'the cinematic asset is not a Git or service-worker asset');
  assert.match(sw, /rel\.startsWith\('films\/'\)/, 'hosted MP4 range requests bypass the service worker');
  const app = read('app.js');
  assert.match(app, /await awakeningFilm\.prepare\(\)/, 'film readiness is checked before the coin handler is installed');
  assert.ok(app.indexOf('await awakeningFilm.prepare()') < app.indexOf("attractScreen.addEventListener('click'"),
    'the video is verified before a coin press can start the night');
  assert.match(app, /await film\.play/, 'coin playback uses the verified local film');
  assert.match(app, /playedFilm && !new URLSearchParams\(location\.search\)\.has\('reveal'\)\s*\?\s*REVEALS\.a/,
    'the film handoff uses the first song accent unless explicitly overridden');
  assert.match(app, /async function landOpener\(leadMs = 0, reveal = REVEAL\)/);
  assert.match(app, /const at = reveal\.at \+ \(getEngine\(\)\?\.ctx\.outputLatency \|\| 0\)/,
    'the selected film handoff reveal time is applied to the music clock');
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
  assert.match(read('app.js'), /^  awakeningFilm\.prepareHosted\(hostedManifestUrl, \{ replaceLocal: !awakeningFilm\.ready \}\)/m,
    'the launch website check is not awaited and never swaps a saved film in the background');
  assert.doesNotMatch(read('app.js'), /await awakeningFilm\.prepareHosted\(hostedManifestUrl, \{/);
  assert.match(read('awakening-film.js'), /AbortSignal\.timeout\(HOSTED_MANIFEST_TIMEOUT_MS\)/);
  assert.match(read('jukebox.css'), /body\.on-attract \.rig:has\(\.utility-drawer\[open\]\)\{\s*visibility:visible; z-index:95;/,
    'the operator tools drawer remains reachable above the opening screen');
  const promotion = read('scripts/promote-awakening.mjs');
  assert.match(promotion, /--confirm-approved/);
  assert.match(promotion, /--approved-by/);
  assert.match(promotion, /-xerror/, 'promotion runs an error-fatal full decode');
  assert.match(promotion, /productionApproval: \{ status: 'approved'/);
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
  const blender = read('cinematic/build_cinematic.py');
  assert.match(blender, /^FPS = 60$/m);
  assert.match(blender, /^VINYL_RPM = 45$/m);
  assert.match(blender, /CAM - Impossible pullback/);
  assert.match(blender, /CAM - Precision match cut/);
});

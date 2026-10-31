import { timeline } from './startup-timing.js';

export const AWAKENING_FILM_ID = 'skate-by-faith-awakening-plunge-1080p60-v1';
export const AWAKENING_FILM_FPS = 60;
export const AWAKENING_FILM_WIDTH = 1920;
export const AWAKENING_FILM_HEIGHT = 1080;
const FILE_PREFIX = 'awakening-film-';
const PREVIEW_PREFIX = 'cinematic-preview-';
const PREVIEW_CUES = [
  'coinSequenceStartFrame',
  'firstFailureFrame',
  'recoveryFrame',
  'stylusContactFrame',
  'musicHandoffFrame',
  'firstSongCueFrame',
  'finalCinematicFrame',
];
const EXPECTED_DURATION_MS = timeline(true).BEATS.end;
export const AWAKENING_FILM_FRAME_COUNT = Math.ceil((EXPECTED_DURATION_MS / 1000) * AWAKENING_FILM_FPS);

function prefixFor(kind) {
  return kind === 'production-preview' ? PREVIEW_PREFIX : FILE_PREFIX;
}

export function validateAwakeningFilmManifest(manifest, expectedKind = 'awakening') {
  const kind = manifest?.filmKind || 'awakening';
  if (!manifest || kind !== expectedKind) throw new Error(`This is not a ${expectedKind} cinematic asset.`);
  if (expectedKind === 'awakening' && manifest.filmId !== AWAKENING_FILM_ID) {
    throw new Error('This is not the current Awakening film.');
  }
  if (expectedKind === 'production-preview'
      && (manifest.manifestVersion !== 1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.filmId)
          || !Number.isInteger(manifest.filmVersion) || manifest.filmVersion < 1)) {
    throw new Error('The production preview manifest needs a versioned film identifier.');
  }

  const dimensionsMatch = expectedKind === 'awakening'
    ? manifest.width === AWAKENING_FILM_WIDTH && manifest.height === AWAKENING_FILM_HEIGHT
      && manifest.fps === AWAKENING_FILM_FPS && manifest.frameCount === AWAKENING_FILM_FRAME_COUNT
    : Number.isInteger(manifest.width) && Number.isInteger(manifest.height)
      && manifest.width > 0 && manifest.height > 0 && manifest.width * 9 === manifest.height * 16
      && manifest.fps === AWAKENING_FILM_FPS && Number.isInteger(manifest.frameCount) && manifest.frameCount > 1;
  if (!dimensionsMatch || manifest.videoCodec !== 'h264' || manifest.audioCodec !== 'aac') {
    throw new Error('The film export must be 16:9 H.264/AAC at 60 fps.');
  }
  if (expectedKind === 'production-preview') {
    if (manifest.width !== AWAKENING_FILM_WIDTH || manifest.height !== AWAKENING_FILM_HEIGHT
        || manifest.audioSampleRate !== 48000 || manifest.audioChannels !== 2
        || !manifest.cues || !manifest.handoff
        || manifest.handoff.openerTrackId !== 'praise-lifted-on-high'
        || manifest.handoff.interactiveState !== 'jukebox-playing:praise-lifted-on-high') {
      throw new Error('The production preview must include the 1080p audio handoff contract.');
    }
    for (const cue of PREVIEW_CUES) {
      const frame = manifest.cues[cue];
      if (frame !== null && (!Number.isInteger(frame) || frame < 0 || frame >= manifest.frameCount)) {
        throw new Error(`The production preview has an invalid ${cue}.`);
      }
    }
    if (manifest.cues.finalCinematicFrame !== manifest.frameCount - 1
        || manifest.handoff.videoFrame !== manifest.cues.musicHandoffFrame) {
      throw new Error('The production preview final frame or handoff frame is inconsistent.');
    }
  }
  if (!Number.isFinite(manifest.durationSec) || manifest.durationSec <= 0
      || Math.abs(manifest.durationSec - manifest.frameCount / manifest.fps) > 0.001
      || manifest.sha256 !== manifest.sha256?.toLowerCase()
      || !/^[0-9a-f]{64}$/.test(manifest.sha256)) {
    throw new Error('The film manifest is incomplete or has invalid duration or checksum data.');
  }
  if (expectedKind === 'awakening'
      && Math.abs(manifest.durationSec - AWAKENING_FILM_FRAME_COUNT / AWAKENING_FILM_FPS) > 0.001) {
    throw new Error('The film manifest duration does not match the complete Awakening cut.');
  }
}

async function digest(blob) {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function waitForMedia(video, event, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error(`Film verification timed out waiting for ${event}.`)), timeoutMs);
    const finish = (error) => {
      clearTimeout(timer);
      video.removeEventListener(event, onReady);
      video.removeEventListener('error', onError);
      if (error) reject(error);
      else resolve();
    };
    const onReady = () => finish();
    const onError = () => finish(new Error(video.error?.message || 'Chrome could not decode the film.'));
    video.addEventListener(event, onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

async function seek(video, time) {
  if (Math.abs(video.currentTime - time) < 0.001) return;
  const seeked = waitForMedia(video, 'seeked');
  video.currentTime = time;
  await seeked;
}

async function checkPlayable(video, url, manifest) {
  if (!video.canPlayType('video/mp4; codecs="avc1.64002a, mp4a.40.2"')) {
    throw new Error('This Chrome installation cannot play the Awakening MP4.');
  }
  video.pause();
  video.removeAttribute('src');
  video.src = url;
  video.preload = 'auto';
  video.load();
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) await waitForMedia(video, 'loadedmetadata');
  if (video.videoWidth !== manifest.width || video.videoHeight !== manifest.height
      || !Number.isFinite(video.duration)
      || Math.abs(video.duration - manifest.durationSec) > 1 / manifest.fps) {
    throw new Error('The stored film dimensions or duration do not match its verified manifest.');
  }
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) await waitForMedia(video, 'loadeddata');
  for (const time of [manifest.durationSec / 2, Math.max(0, manifest.durationSec - 0.1)]) {
    await seek(video, time);
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) await waitForMedia(video, 'loadeddata');
  }
  video.pause();
  await seek(video, 0);
}

async function openFilmDirectory() {
  if (!navigator.storage?.getDirectory || !crypto.subtle) {
    throw new Error('This Chrome profile does not support secure local film storage.');
  }
  return navigator.storage.getDirectory();
}

export function createAwakeningFilm(video, kind = 'awakening') {
  if (!['awakening', 'production-preview'].includes(kind)) throw new Error(`Unsupported film kind: ${kind}`);
  const filePrefix = prefixFor(kind);
  let objectUrl = null;
  let selected = null;

  const replaceSource = (blob) => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(blob);
  };

  async function prepare() {
    selected = null;
    if (!video) return { available: false, message: 'Film player is missing.' };
    let directory;
    try {
      directory = await openFilmDirectory();
    } catch (error) {
      return { available: false, message: error.message };
    }

    const candidates = [];
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind !== 'file' || !name.startsWith(filePrefix) || !name.endsWith('.json')) continue;
      try {
        const manifest = JSON.parse(await (await handle.getFile()).text());
        validateAwakeningFilmManifest(manifest, kind);
        candidates.push({ name, manifest });
      } catch (error) {
        console.warn('[awakening film]', error);
      }
    }
    candidates.sort((a, b) => String(b.manifest.importedAt || '').localeCompare(String(a.manifest.importedAt || '')));

    for (const candidate of candidates) {
      const fileName = `${filePrefix}${candidate.manifest.sha256}.mp4`;
      try {
        const fileHandle = await directory.getFileHandle(fileName);
        const blob = await fileHandle.getFile();
        if (await digest(blob) !== candidate.manifest.sha256) throw new Error('The saved film checksum does not match.');
        replaceSource(blob);
        try {
          await checkPlayable(video, objectUrl, candidate.manifest);
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          throw error;
        }
        selected = { manifest: candidate.manifest, fileName, manifestName: candidate.name };
        const persistent = await navigator.storage.persisted?.();
        return {
          available: true,
          message: persistent === false
            ? 'FILM VERIFIED - READY OFFLINE - STORAGE MAY BE EVICTED'
            : 'FILM VERIFIED - READY OFFLINE',
          manifest: selected.manifest,
        };
      } catch (error) {
        console.warn('[awakening film]', error);
      }
    }
    video.removeAttribute('src');
    video.load();
    return { available: false, message: 'NO VERIFIED FILM - LIVE CUT READY' };
  }

  async function importFiles(videoFile, manifestFile) {
    if (!videoFile || !manifestFile) throw new Error('Choose both the MP4 film and its JSON manifest.');
    const manifest = JSON.parse(await manifestFile.text());
    validateAwakeningFilmManifest(manifest, kind);
    if (await digest(videoFile) !== manifest.sha256) throw new Error('The selected MP4 does not match the manifest checksum.');
    const url = URL.createObjectURL(videoFile);
    const verifier = document.createElement('video');
    verifier.preload = 'auto';
    verifier.muted = true;
    verifier.playsInline = true;
    verifier.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.append(verifier);
    try {
      await checkPlayable(verifier, url, manifest);
    } finally {
      URL.revokeObjectURL(url);
      verifier.remove();
    }

    const directory = await openFilmDirectory();
    const persistent = await navigator.storage.persist?.();
    const estimate = await navigator.storage.estimate?.();
    const fileName = `${filePrefix}${manifest.sha256}.mp4`;
    let replacedSize = 0;
    try {
      replacedSize = (await (await directory.getFileHandle(fileName)).getFile()).size;
    } catch (error) {
      if (error.name !== 'NotFoundError') throw error;
    }
    if (Number.isFinite(estimate?.quota) && Number.isFinite(estimate.usage)
        && estimate.usage - replacedSize + videoFile.size > estimate.quota) {
      throw new Error('There is not enough local storage for this film. Free space, then try again.');
    }
    const savedFile = await directory.getFileHandle(fileName, { create: true });
    const writable = await savedFile.createWritable();
    try {
      await writable.write(videoFile);
      await writable.close();
    } catch (error) {
      await writable.abort();
      throw error;
    }
    const storedManifest = { ...manifest, importedAt: new Date().toISOString() };
    const manifestName = `${filePrefix}${manifest.sha256}.json`;
    const manifestHandle = await directory.getFileHandle(manifestName, { create: true });
    const manifestWriter = await manifestHandle.createWritable();
    await manifestWriter.write(JSON.stringify(storedManifest));
    await manifestWriter.close();

    const result = await prepare();
    if (!result.available) throw new Error(`The imported film could not be verified after saving: ${result.message}`);
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind !== 'file' || !name.startsWith(filePrefix) || name.includes(manifest.sha256)) continue;
      await directory.removeEntry(name);
    }
    return persistent === false
      ? { ...result, message: 'FILM VERIFIED - READY OFFLINE - STORAGE MAY BE EVICTED' }
      : result;
  }

  async function play(volume = 1) {
    if (!selected || !objectUrl) throw new Error('No verified Awakening film is ready.');
    video.volume = Math.min(1, Math.max(0, volume));
    video.currentTime = 0;
    video.classList.add('is-playing');
    const qualityStart = video.getVideoPlaybackQuality?.();
    const intervals = [];
    let frameCallbacks = 0;
    let previousFrame = null;
    let callbackId = null;
    const startedAt = performance.now();
    const onVideoFrame = (now, metadata) => {
      const displayedAt = metadata.expectedDisplayTime ?? now;
      if (previousFrame != null) intervals.push(displayedAt - previousFrame);
      previousFrame = displayedAt;
      frameCallbacks += 1;
      callbackId = video.requestVideoFrameCallback(onVideoFrame);
    };
    if (video.requestVideoFrameCallback) callbackId = video.requestVideoFrameCallback(onVideoFrame);
    let removePlaybackListeners = () => {};
    try {
      const playback = new Promise((resolve, reject) => {
        const ended = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error(video.error?.message || 'Film playback stopped unexpectedly.')); };
        const cleanup = () => {
          video.removeEventListener('ended', ended);
          video.removeEventListener('error', failed);
        };
        removePlaybackListeners = cleanup;
        video.addEventListener('ended', ended, { once: true });
        video.addEventListener('error', failed, { once: true });
      });
      await video.play();
      await playback;
    } catch (error) {
      video.classList.remove('is-playing');
      throw error;
    } finally {
      removePlaybackListeners();
      if (callbackId != null) video.cancelVideoFrameCallback?.(callbackId);
      const qualityEnd = video.getVideoPlaybackQuality?.();
      const ordered = intervals.slice().sort((a, b) => a - b);
      const percentile = (fraction) => ordered.length
        ? Number(ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))].toFixed(2))
        : null;
      globalThis.__awakeningFilmStats = {
        expectedFrames: selected.manifest.frameCount,
        frameCallbacks,
        mediaFrames: qualityEnd ? qualityEnd.totalVideoFrames - (qualityStart?.totalVideoFrames || 0) : null,
        droppedFrames: qualityEnd ? qualityEnd.droppedVideoFrames - (qualityStart?.droppedVideoFrames || 0) : null,
        durationMs: Math.round(performance.now() - startedAt),
        effectiveFps: intervals.length ? Number((frameCallbacks * 1000 / (performance.now() - startedAt)).toFixed(2)) : null,
        intervalP95Ms: percentile(0.95),
        intervalsOver25ms: intervals.filter((interval) => interval > 25).length,
        maxIntervalMs: ordered.length ? Number(ordered.at(-1).toFixed(2)) : null,
      };
    }
  }

  function stop() {
    video.pause();
    video.classList.remove('is-playing');
  }

  function setVolume(value) {
    video.volume = Math.min(1, Math.max(0, value));
  }

  return { prepare, importFiles, play, stop, setVolume, get ready() { return Boolean(selected && objectUrl); } };
}

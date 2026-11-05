import { OPENER } from './rotation.js';

/* The show film: "The Song Inside", 35 seconds at native 30 fps, effects only.
   Its timing comes from cinematic/extended/cues.json (approved source dcaf590);
   NATIVE30_CONTRACT below mirrors that file and tests/awakening-film.test.js
   checks the two agree. A new ID makes every earlier cached cut invalid. */
export const AWAKENING_FILM_ID = 'skate-by-faith-song-inside-35s-native30-v1';
export const AWAKENING_FILM_FPS = 30;
export const AWAKENING_FILM_FRAME_COUNT = 1050;
// Opt-in external preview only (TOOLS import + ?film=extended35); same locked contract.
export const EXTENDED_PREVIEW_ID = 'production-preview-35s-native30-v1';
export const NATIVE30_CONTRACT = Object.freeze({
  frameCount: 1050,
  durationSec: 35,
  songStartSec: 31.393,
  stylusContactFrame: 948,
  registrationStartFrame: 1028,
  finalCinematicFrame: 1049,
  record: Object.freeze({ cx: 0.603125, cy: 0.39018517953378185, r: 0.047135416666666666, cssAngleDeg: 91.0557374652127, rpm: 45 }),
});
export const AWAKENING_FILM_WIDTH = 1920;
export const AWAKENING_FILM_HEIGHT = 1080;
export const HOSTED_AWAKENING_MANIFEST = 'films/manifest.json';
export const MAX_HOSTED_FILM_BYTES = 90 * 1024 * 1024;
// Venue wifi often hangs rather than failing: never wait on it indefinitely.
const HOSTED_MANIFEST_TIMEOUT_MS = 8000;
const HOSTED_FILM_TIMEOUT_MS = 5 * 60 * 1000;
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
function prefixFor(kind) {
  return kind === 'production-preview' ? PREVIEW_PREFIX : FILE_PREFIX;
}

export function validateAwakeningFilmManifest(manifest, expectedKind = 'awakening') {
  const kind = manifest?.filmKind || 'awakening';
  if (!manifest || kind !== expectedKind) throw new Error(`This is not a ${expectedKind} cinematic asset.`);
  const showFilm = expectedKind === 'awakening';
  if (showFilm && manifest.filmId !== AWAKENING_FILM_ID) {
    throw new Error('This is not the current approved show film.');
  }
  if (manifest.manifestVersion !== 1 || !Number.isInteger(manifest.filmVersion) || manifest.filmVersion < 1
      || (!showFilm && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.filmId))) {
    throw new Error('The film manifest needs a versioned film identifier.');
  }
  // The show film and the locked preview are native 30; other previews keep the legacy 60 fps path.
  const native30 = showFilm || manifest.filmId === EXTENDED_PREVIEW_ID;
  if (manifest.width !== AWAKENING_FILM_WIDTH || manifest.height !== AWAKENING_FILM_HEIGHT
      || manifest.fps !== (native30 ? 30 : 60)
      || !Number.isInteger(manifest.frameCount) || manifest.frameCount <= 1
      || manifest.videoCodec !== 'h264' || manifest.audioCodec !== 'aac') {
    throw new Error('The film export must be 1920x1080 H.264/AAC at its supported frame rate.');
  }
  if (manifest.audioSampleRate !== 48000 || manifest.audioChannels !== 2
      || !manifest.cues || !manifest.handoff
      || manifest.handoff.openerTrackId !== OPENER.id
      || manifest.handoff.interactiveState !== `jukebox-playing:${OPENER.id}`) {
    throw new Error('The film must include the 1080p audio and jukebox handoff contract.');
  }
  for (const cue of PREVIEW_CUES) {
    const frame = manifest.cues[cue];
    if (frame !== null && (!Number.isInteger(frame) || frame < 0 || frame >= manifest.frameCount)) {
      throw new Error(`The film manifest has an invalid ${cue}.`);
    }
  }
  if (manifest.cues.finalCinematicFrame !== manifest.frameCount - 1
      || manifest.handoff.videoFrame !== manifest.cues.musicHandoffFrame) {
    throw new Error('The film manifest final frame or handoff frame is inconsistent.');
  }
  overlapPlan(manifest);
  if (native30) validateNative30Contract(manifest, showFilm);
  if (!Number.isFinite(manifest.durationSec) || manifest.durationSec <= 0
      || Math.abs(manifest.durationSec - manifest.frameCount / manifest.fps) > 0.001
      || manifest.sha256 !== manifest.sha256?.toLowerCase()
      || !/^[0-9a-f]{64}$/.test(manifest.sha256)) {
    throw new Error('The film manifest is incomplete or has invalid duration or checksum data.');
  }
}

// Keep this exception narrow: arbitrary 30 fps or song-containing review files
// must never become a prepared show asset. The source cue manifest owns timing.
// The preview stays labelled experimental; the approved show film must not be.
function validateNative30Contract(manifest, showFilm) {
  const { cues, handoff } = manifest;
  const record = handoff.record || {};
  const locked = NATIVE30_CONTRACT;
  if (manifest.experimental !== !showFilm
      || manifest.frameCount !== locked.frameCount || manifest.durationSec !== locked.durationSec
      || manifest.audioOwnership?.songEmbedded !== false
      || manifest.audioOwnership?.trackId !== OPENER.id
      || handoff.mode !== 'overlap' || handoff.songStartSec !== locked.songStartSec
      || cues.stylusContactFrame !== locked.stylusContactFrame || cues.firstSongCueFrame !== locked.stylusContactFrame
      || cues.registrationStartFrame !== locked.registrationStartFrame
      || cues.finalCinematicFrame !== locked.finalCinematicFrame
      || Math.abs(record.cx - locked.record.cx) > 1e-9
      || Math.abs(record.cy - locked.record.cy) > 1e-9
      || Math.abs(record.r - locked.record.r) > 1e-9
      || Math.abs(record.cssAngleDeg - locked.record.cssAngleDeg) > 0.001 || record.rpm !== locked.record.rpm) {
    throw new Error(showFilm
      ? 'The show film must match the approved 35-second native-30 effects-only C1 contract.'
      : 'The experimental native-30 preview needs the locked 35-second effects-only C1 contract.');
  }
}

// One line for the operator: which film, how long, what size, which bytes.
export function describeFilm(manifest) {
  return `V${manifest.filmVersion} · ${manifest.durationSec.toFixed(1)} S · ${manifest.width}x${manifest.height} · `
    + `${manifest.fps} FPS · SHA ${manifest.sha256.slice(0, 8).toUpperCase()}`;
}

/* A film that keeps running while the jukebox plays the opener (handoff.mode
   "overlap"): the song starts at handoff.songStartSec on the film clock, the
   stylus touches the groove on the song's first hit, and the film's last frame
   lands on the opener's reveal. The record block says where the record sits in
   the last frame (fractions of the 16:9 frame) and the CSS angle of its label,
   so the app can register the film onto the live #record on any screen.
   Returns null for a film that ends on the cut. Throws if the timing is off by
   more than a frame: these are the cues the music is locked to. */
export function overlapPlan(manifest) {
  const handoff = manifest?.handoff;
  if (handoff?.mode !== 'overlap') return null;
  const { fps, cues, frameCount } = manifest;
  const frame = 1 / fps;
  const songStartSec = handoff.songStartSec;
  if (!Number.isFinite(songStartSec) || songStartSec <= 0 || songStartSec >= frameCount / fps) {
    throw new Error('The overlap film needs a song start inside the film.');
  }
  if (cues.musicHandoffFrame !== Math.floor(songStartSec * fps) || handoff.videoFrame !== cues.musicHandoffFrame) {
    throw new Error('The overlap film\'s handoff frame must be the frame the song starts in.');
  }
  const contactSec = cues.stylusContactFrame / fps;
  if (cues.firstSongCueFrame !== cues.stylusContactFrame
      || Math.abs(contactSec - (songStartSec + OPENER.firstHit)) > frame / 2) {
    throw new Error('The stylus must touch the groove on the song\'s first hit.');
  }
  const endSec = cues.finalCinematicFrame / fps;
  if (cues.finalCinematicFrame !== frameCount - 1 || Math.abs(endSec - (songStartSec + OPENER.revealAt)) > frame) {
    throw new Error('The overlap film\'s last frame must land on the opener\'s reveal.');
  }
  const start = cues.registrationStartFrame;
  if (!Number.isInteger(start) || start <= cues.stylusContactFrame || start >= cues.finalCinematicFrame) {
    throw new Error('The overlap film needs a registration start between contact and the last frame.');
  }
  const record = handoff.record || {};
  const inFrame = (v) => Number.isFinite(v) && v > 0 && v < 1;
  if (!inFrame(record.cx) || !inFrame(record.cy) || !Number.isFinite(record.r) || !(record.r > 0 && record.r < 0.5)
      || !Number.isFinite(record.cssAngleDeg) || !Number.isFinite(record.rpm) || !(record.rpm > 0)) {
    throw new Error('The overlap film must say where its record lands.');
  }
  return { fps, songStartSec, contactSec, endSec, registrationStartSec: start / fps, record: { ...record } };
}

// A frame's media timestamp belongs to its expected display epoch, which can
// be a v-sync later than the callback that reports it.
export function songCuePresentationTime(songStartSec, mediaTime, anchor, observedNow) {
  const epoch = anchor?.source === 'rvfc' && Number.isFinite(anchor.expectedDisplayTime)
    ? anchor.expectedDisplayTime
    : Number.isFinite(anchor?.observedAt) ? anchor.observedAt : observedNow;
  return epoch + (songStartSec - mediaTime) * 1000;
}

/* Where the film's record lands on this screen, and the transform that puts it
   on the live record. The film is shown object-fit: cover; the result is a CSS
   transform (origin 0 0: scale, then translate tx/ty in px) and the live record
   circle in viewport px, for masking the film down to the record. */
export function registerRecord(record, viewport, live) {
  if (!record || typeof record !== 'object') throw new Error('The overlap film must say where its record lands.');
  if (!viewport || typeof viewport !== 'object') throw new Error('The viewport must include width and height.');
  if (!live || typeof live !== 'object') throw new Error('The live record must include its box geometry.');
  const viewportWidth = Number(viewport.width);
  const viewportHeight = Number(viewport.height);
  const liveX = Number(live.x);
  const liveY = Number(live.y);
  const liveWidth = Number(live.width);
  const liveHeight = Number(live.height);
  const inFrame = (v) => Number.isFinite(v) && v > 0 && v < 1;
  const recordValues = [record.cx, record.cy, record.r, record.cssAngleDeg, record.rpm];
  if (!Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight) || viewportWidth <= 0 || viewportHeight <= 0
      || !Number.isFinite(liveX) || !Number.isFinite(liveY) || !Number.isFinite(liveWidth) || !Number.isFinite(liveHeight)
      || liveWidth <= 0 || liveHeight <= 0
      || !inFrame(record.cx) || !inFrame(record.cy) || !Number.isFinite(record.r) || !(record.r > 0 && record.r < 0.5)
      || !Number.isFinite(record.cssAngleDeg) || !Number.isFinite(record.rpm) || !(record.rpm > 0)
      || !recordValues.every((value) => Number.isFinite(value))) {
    throw new Error('The overlap film must say where its record lands.');
  }

  const cover = Math.max(viewportWidth / 1920, viewportHeight / 1080);
  const offsetX = (viewportWidth - 1920 * cover) / 2;
  const offsetY = (viewportHeight - 1080 * cover) / 2;
  const filmX = offsetX + record.cx * 1920 * cover;
  const filmY = offsetY + record.cy * 1080 * cover;
  const filmR = record.r * 1920 * cover;
  const mask = { cx: liveX + liveWidth / 2, cy: liveY + liveHeight / 2, r: liveWidth / 2 };
  const scale = mask.r / filmR;
  return { scale, tx: mask.cx - filmX * scale, ty: mask.cy - filmY * scale, mask };
}

export function validateHostedAwakeningManifest(manifest, manifestUrl) {
  validateAwakeningFilmManifest(manifest, 'awakening');
  if (!manifest.productionApproval || manifest.productionApproval.status !== 'approved'
      || !manifest.productionApproval.approvedBy
      || !Number.isFinite(Date.parse(manifest.productionApproval.approvedAt))) {
    throw new Error('This film has not been approved for the website production slot.');
  }
  const base = new URL(manifestUrl);
  const videoUrl = new URL(manifest.videoFile, base);
  const filmsPath = new URL('.', base).pathname;
  if (videoUrl.origin !== base.origin || !videoUrl.pathname.startsWith(filmsPath)
      || !videoUrl.pathname.endsWith('.mp4') || videoUrl.search || videoUrl.hash) {
    throw new Error('The hosted film must be an MP4 served from this site films directory.');
  }
  return videoUrl;
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

  /* replaceLocal false (the launch check): a saved film that differs from the
     website's is reported, never swapped in the background, so a download can
     never land under a coin press. The operator's button replaces it. */
  async function prepareHosted(manifestUrl = new URL(HOSTED_AWAKENING_MANIFEST, location.href).href,
    { replaceLocal = true } = {}) {
    const unavailable = (reason) => ({
      available: Boolean(selected && objectUrl),
      message: selected && objectUrl
        ? `SAVED FILM READY OFFLINE - WEBSITE CHECK UNAVAILABLE (${reason})`
        : `NO VERIFIED FILM - LIVE CUT READY (${reason})`,
      manifest: selected?.manifest,
    });
    try {
      const manifestResponse = await fetch(manifestUrl, { cache: 'no-cache', signal: AbortSignal.timeout(HOSTED_MANIFEST_TIMEOUT_MS) });
      if (!manifestResponse.ok) return unavailable(`WEBSITE FILM NOT FOUND: HTTP ${manifestResponse.status}`);
      const manifest = await manifestResponse.json();
      const videoUrl = validateHostedAwakeningManifest(manifest, manifestUrl);
      if (selected?.manifest.sha256 === manifest.sha256 && objectUrl) {
        return { available: true, message: 'WEBSITE FILM VERIFIED - READY OFFLINE', manifest: selected.manifest };
      }
      if (!replaceLocal && selected && objectUrl) {
        return { available: true, stale: true, manifest: selected.manifest,
          message: 'SAVED FILM IS NOT THE CURRENT WEBSITE FILM - PRESS CHECK / DOWNLOAD' };
      }
      const response = await fetch(videoUrl.href, { cache: 'no-cache', signal: AbortSignal.timeout(HOSTED_FILM_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`The website film download failed: HTTP ${response.status}.`);
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_HOSTED_FILM_BYTES) {
        throw new Error('The website film exceeds the 90 MiB Git-compatible delivery limit.');
      }
      const blob = await response.blob();
      if (blob.size > MAX_HOSTED_FILM_BYTES) {
        throw new Error('The website film exceeds the 90 MiB Git-compatible delivery limit.');
      }
      const manifestFile = new File([JSON.stringify(manifest)], 'awakening-v1.json', { type: 'application/json' });
      const videoFile = new File([blob], 'awakening-v1.mp4', { type: 'video/mp4' });
      const result = await importFiles(videoFile, manifestFile);
      return { ...result, message: result.available ? 'WEBSITE FILM DOWNLOADED - VERIFIED - READY OFFLINE' : result.message };
    } catch (error) {
      console.warn('[hosted Awakening film]', error);
      return unavailable(error.message || 'WEBSITE FILM DOWNLOAD FAILED');
    }
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

  /* onTime: [{ at: film seconds, run(mediaTime) }], each run once, on the
     first presented frame at or after `at` (the film's own clock, not a timer). */
  async function play(volume = 1, { onTime = [] } = {}) {
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
    const pending = onTime.slice().sort((a, b) => a.at - b.at);
    const native30 = selected.manifest.fps === 30;
    const presentationClock = native30 && typeof video.requestVideoFrameCallback === 'function';
    if (native30) globalThis.__awakeningCueEvents = [];
    const fire = (mediaTime, anchor) => {
      while (pending.length && mediaTime >= pending[0].at - 0.5 / selected.manifest.fps) {
        const cue = pending.shift();
        if (native30) globalThis.__awakeningCueEvents.push({ at: cue.at, mediaTime, ...anchor });
        try {
          if (native30) cue.run(mediaTime, anchor);
          else cue.run(mediaTime);
        } catch (error) { console.warn('[awakening film cue]', error); }
      }
    };
    const onTimeUpdate = () => fire(video.currentTime, { source: 'timeupdate', observedAt: performance.now() });
    // Preserve the legacy60 policy; native30 uses one authoritative clock.
    if (pending.length && !presentationClock) video.addEventListener('timeupdate', onTimeUpdate);
    const onVideoFrame = (now, metadata) => {
      fire(metadata.mediaTime, { source: 'rvfc', observedAt: performance.now(), callbackNow: now,
        expectedDisplayTime: metadata.expectedDisplayTime, presentationTime: metadata.presentationTime });
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
      video.removeEventListener('timeupdate', onTimeUpdate);
      if (callbackId != null) video.cancelVideoFrameCallback?.(callbackId);
      const qualityEnd = video.getVideoPlaybackQuality?.();
      const ordered = intervals.slice().sort((a, b) => a - b);
      const percentile = (fraction) => ordered.length
        ? Number(ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))].toFixed(2))
        : null;
      globalThis.__awakeningFilmStats = {
        expectedFrames: selected.manifest.frameCount,
        expectedFps: selected.manifest.fps,
        frameCallbacks,
        mediaFrames: qualityEnd ? qualityEnd.totalVideoFrames - (qualityStart?.totalVideoFrames || 0) : null,
        droppedFrames: qualityEnd ? qualityEnd.droppedVideoFrames - (qualityStart?.droppedVideoFrames || 0) : null,
        durationMs: Math.round(performance.now() - startedAt),
        effectiveFps: intervals.length ? Number((frameCallbacks * 1000 / (performance.now() - startedAt)).toFixed(2)) : null,
        intervalP95Ms: percentile(0.95),
        intervalsOver25ms: intervals.filter((interval) => interval > 25).length,
        intervalsOverFrameBudget: intervals.filter((interval) => interval > 1500 / selected.manifest.fps).length,
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

  return {
    prepare,
    prepareHosted,
    importFiles,
    play,
    stop,
    setVolume,
    get ready() { return Boolean(selected && objectUrl); },
    get manifest() { return selected?.manifest || null; },
    get element() { return video; },
  };
}

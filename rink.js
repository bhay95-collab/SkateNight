/* ============================================================
   RINK - the "make it survive the night" helpers:
     - Screen Wake Lock: the laptop never dims or sleeps while this is open.
     - Media Session: the laptop's media keys (play/pause/next) work, and
       the song shows in the operating system's now-playing widget.
     - Service worker registration: lets the site run offline (sw.js).
   Each one fails soft: if the browser lacks it, the night goes on anyway.
   ============================================================ */

let wakeLock = null;
let wakeWanted = false;

async function acquireWakeLock() {
  if (!wakeWanted || !('wakeLock' in navigator) || document.hidden) return false;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
    return true;
  } catch (err) {
    if (err && err.name !== 'NotAllowedError') console.warn('[wake lock]', err.name || err);
    return false;
  }
}

/* Call from the first click. Re-acquires itself when the tab comes back. */
export function keepAwake() {
  wakeWanted = true;
  acquireWakeLock();
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && wakeWanted && !wakeLock) acquireWakeLock();
});

export const wakeLockActive = () => Boolean(wakeLock);

/* ---------------- Media Session ---------------- */
export function setupMediaSession({ onPlay, onPause, onNext, onPrevious }) {
  if (!('mediaSession' in navigator)) return;
  const set = (action, fn) => {
    try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* unsupported action */ }
  };
  set('play', onPlay);
  set('pause', onPause);
  set('nexttrack', onNext);
  if (onPrevious) set('previoustrack', onPrevious);
}

export function updateMediaSession(track, volume, playing) {
  if (!('mediaSession' in navigator)) return;
  try {
    if (track && 'MediaMetadata' in window) {
      const art = volume && volume.cover
        ? [{ src: new URL(volume.cover, location.href).href, sizes: '512x512' }]
        : [{ src: new URL('rfai-logo.png', location.href).href, sizes: '512x512', type: 'image/png' }];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: 'RFAI',
        album: volume ? `Skate by Faith - ${volume.title}` : 'Skate by Faith',
        artwork: art,
      });
    }
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  } catch (err) {
    console.warn('[media session]', err);
  }
}

/* ---------------- Service worker ---------------- */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!secure) return null;
  try {
    return await navigator.serviceWorker.register('sw.js');
  } catch (err) {
    console.warn('[service worker]', err);
    return null;
  }
}

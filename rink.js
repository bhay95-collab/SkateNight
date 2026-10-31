/* ============================================================
   RINK - the "make it survive the night" helpers:
     - Screen Wake Lock: the laptop never dims or sleeps while this is open.
     - Media Session: the laptop's media keys (play/pause/next) work, and
       the song shows in the operating system's now-playing widget.
     - Service worker registration: lets the site run offline (sw.js) and
       be installed as an app (manifest.webmanifest).
     - Installed app: whether this is the app's own window, and so whether
       the dormant hum should try to start by itself.
   Each one fails soft: if the browser lacks it, the night goes on anyway.
   ============================================================ */

/* The installed app (its own window, no tabs or address bar), not a browser
   tab. A tab made fullscreen before the page loads reads the same - it only
   ever means the hum is tried, which the browser may still refuse. */
export function isInstalledApp(win = globalThis) {
  const mode = (m) => Boolean(win.matchMedia?.(`(display-mode: ${m})`).matches);
  return mode('fullscreen') || mode('standalone') || mode('minimal-ui') || mode('window-controls-overlay') || win.navigator?.standalone === true;
}

/* Should the dormant hum try to start on launch? The operator's choice
   (sn-drone: 'off' or 'on', from Alt+Shift+D) always wins; with no choice
   made, the installed app tries and a browser tab stays silent. Trying is
   not playing: the browser decides whether sound is allowed. */
export function shouldTryHum(saved, installed) {
  if (saved === 'off') return false;
  if (saved === 'on') return true;
  return Boolean(installed);
}

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

globalThis.document?.addEventListener('visibilitychange', () => {   // guarded: the tests import this module without a page
  if (!document.hidden && wakeWanted && !wakeLock) acquireWakeLock();
});

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

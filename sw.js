/* ============================================================
   SERVICE WORKER - lets Skate by Faith keep running with no internet.

   Two kinds of file, two strategies:

   1. The APP itself (page, styles, scripts, fonts, logo):
      network first, so an edit to tracks.js shows up as soon as the
      laptop is online. Always asked of the server, never the browser's
      own short-term cache: GitHub Pages lets that hold a file for ten
      minutes, and a fresh page with a stale script mixes two versions. If the network is down OR slower than a few
      seconds (venue wifi dying often hangs rather than failing), the
      saved copy is used instead.

   2. The COVER PICTURES (anything in covers/):
      saved copy first. They are only saved when Ben presses LOAD THE
      CRATES (see crates.js).

   The MP3s are deliberately NOT handled here. Saved songs are played by
   the page itself from the saved copy (player.js), which proved the most
   dependable way to play audio offline: browsers are fussy about audio
   that arrives through a service worker.
   ============================================================ */
const SHELL_CACHE = 'skatenight-shell-v50';
const CRATE_CACHE = 'skatenight-crates';
const NETWORK_TIMEOUT_MS = 3500;

const SHELL_FILES = [
  './',
  'index.html',
  'classic-jukebox.html',   // the classic presentation: the emergency fallback, same app and engine
  'cabinet.js',
  'styles.css', 'jukebox.css', 'changer.css',
  'app.js', 'audio.js', 'codes.js', 'copy.js', 'crates.js', 'dsp.js', 'format.js',
  'fx.js', 'keyboard.js', 'lights.js', 'mechanism.js', 'neon.js', 'player.js', 'queue.js', 'rack-layout.js',
  'arch.js', 'awakening-film.js', 'bench.js', 'carousel.js', 'drone.js', 'rink.js', 'ornament.js', 'rotation.js', 'sound.js', 'startup.js', 'startup-coin.js', 'startup-fault.js', 'startup-inside.js', 'startup-plunge.js', 'startup-power.js', 'startup-robot.js', 'startup-timing.js', 'tracks.js', 'ui.js', 'vinyl.js', 'visualiser.js',
  'rfai-logo.png', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'fonts/bungee-400.woff2', 'fonts/barlow-400.woff2', 'fonts/barlow-500.woff2',
  'fonts/barlow-700.woff2', 'fonts/jetbrains-mono.woff2',
  'sfx/coin.wav', 'sfx/key.wav', 'sfx/confirm.wav', 'sfx/whirr.wav',
  'sfx/thud.wav', 'sfx/buzz.wav', 'sfx/page.wav', 'sfx/vinyl-surface.wav',
  'jukebox-sfx.js', 'jukebox-sprite.js', 'sfx/needle-drop.wav',
  'sfx/jukebox/mechanics.mp3', 'sfx/jukebox/bed-machine.flac', 'sfx/jukebox/bed-electric.flac',
  // The photorealistic jukebox (index.html): the same list as living/offline.js (tests keep them equal).
  'living/live.js', 'living/live.css', 'living/math.js', 'living/drive.js', 'living/film-check.js', 'living/offline.js',
  'living/assets/hero.webp', 'living/assets/changer.webp', 'living/assets/catalog.json', 'living/assets/load-mask.png',
  'living/assets/eject-mask.png', 'living/assets/load-tracking.json', 'living/assets/eject-tracking.json',
  'living/assets/arm.webp', 'living/assets/arm.json', 'living/assets/drive.json', 'living/assets/load-0.webp',
  'living/assets/load-1.webp', 'living/assets/load-2.webp', 'living/assets/load-3.webp', 'living/assets/load-4.webp',
  'living/assets/load-5.webp', 'living/assets/load-6.webp', 'living/assets/load-7.webp', 'living/assets/load-8.webp',
  'living/assets/eject-0.webp', 'living/assets/eject-1.webp', 'living/assets/eject-2.webp', 'living/assets/eject-3.webp',
  'living/assets/eject-4.webp', 'living/assets/eject-5.webp', 'living/assets/drive-play.webp', 'living/assets/drive-play-over.webp',
  'living/assets/drive-load.webp', 'living/assets/drive-load-over.webp', 'living/assets/drive-eject.webp',
  'living/assets/drive-eject-over.webp', 'living/assets/drive-gear-26.webp', 'living/assets/drive-gear-32.webp',
  'living/assets/drive-gear-28.webp', 'living/assets/drive-gear-40.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // one by one, so a single missing file cannot block the whole install
    await Promise.all(SHELL_FILES.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => {})));   // from the server, not the browser's cache
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('skatenight-shell-') && key !== SHELL_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

const scopePath = new URL(self.registration.scope).pathname;
const relPath = (url) => decodeURIComponent(url.pathname.slice(scopePath.length));
const isCover = (rel) => rel.startsWith('covers/');

async function coverFetch(request) {
  if (request.headers.has('x-sn-bypass')) return fetch(request);   // LOAD THE CRATES refreshing a file
  const cache = await caches.open(CRATE_CACHE);
  const saved = await cache.match(request.url);
  return saved || fetch(request);
}

async function shellFetch(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await Promise.race([
      fetch(request.mode === 'navigate' ? request.url : request, { cache: 'no-cache' }),   // revalidated, so every file is the same version
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow network')), NETWORK_TIMEOUT_MS)),
    ]);
    if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    const saved = await cache.match(request, { ignoreSearch: true });
    if (saved) return saved;
    if (request.mode === 'navigate') {
      const page = (await cache.match('index.html')) || (await cache.match('./'));
      if (page) return page;
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const rel = relPath(url);
  if (rel.startsWith('audio/') || rel.startsWith('films/')) return;
  event.respondWith(isCover(rel) ? coverFetch(request) : shellFetch(request));
});

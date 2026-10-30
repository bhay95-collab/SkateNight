/* ============================================================
   SERVICE WORKER - lets Skate by Faith keep running with no internet.

   Two kinds of file, two strategies:

   1. The APP itself (page, styles, scripts, fonts, logo):
      network first, so an edit to tracks.js shows up as soon as the
      laptop is online. If the network is down OR slower than a few
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
const SHELL_CACHE = 'skatenight-shell-v15';
const CRATE_CACHE = 'skatenight-crates';
const NETWORK_TIMEOUT_MS = 3500;

const SHELL_FILES = [
  './',
  'index.html',
  'cabinet.js',
  'styles.css',
  'app.js', 'audio.js', 'codes.js', 'copy.js', 'crates.js', 'dsp.js', 'format.js',
  'fx.js', 'keyboard.js', 'lights.js', 'mechanism.js', 'neon.js', 'player.js', 'queue.js', 'rack-layout.js',
  'arch.js', 'carousel.js', 'crowd.js', 'link.js', 'rink.js', 'rotation.js', 'sound.js', 'startup.js', 'startup-coin.js', 'startup-power.js', 'startup-timing.js', 'tracks.js', 'ui.js', 'vinyl.js', 'visualiser.js',
  'rfai-logo.png',
  'fonts/bungee-400.woff2', 'fonts/barlow-400.woff2', 'fonts/barlow-500.woff2',
  'fonts/barlow-700.woff2', 'fonts/jetbrains-mono.woff2',
  'sfx/coin.wav', 'sfx/key.wav', 'sfx/confirm.wav', 'sfx/whirr.wav',
  'sfx/thud.wav', 'sfx/buzz.wav', 'sfx/page.wav',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // one by one, so a single missing file cannot block the whole install
    await Promise.all(SHELL_FILES.map((f) => cache.add(f).catch(() => {})));
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
      fetch(request),
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
  if (rel.startsWith('audio/')) return;            // songs: the page handles them (see top of file)
  event.respondWith(isCover(rel) ? coverFetch(request) : shellFetch(request));
});

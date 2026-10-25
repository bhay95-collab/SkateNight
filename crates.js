/* ============================================================
   CRATES - "LOAD THE CRATES": saves every MP3 and cover picture on this
   laptop so the night keeps going if the venue wifi dies.

   The files go into a browser cache called "skatenight-crates". The
   service worker (sw.js) serves from that cache whenever it can.

   Pressing the button again is cheap: files already saved are only
   re-downloaded if the copy on the server has changed (we compare the
   file's ETag / size), so replacing an MP3 and pressing the button again
   does the right thing. Files that are no longer in tracks.js are cleared
   out so the cache doesn't grow forever.
   ============================================================ */

const CRATE_CACHE = 'skatenight-crates';   // sw.js keeps its own copy: separate script context

const abs = (rel) => new URL(rel, location.href).href;

/* Every file the night needs that is not part of the app itself. */
export function listCrateFiles(library) {
  const audio = library.tracks.map((t) => ({ url: abs(t.file), kind: 'audio' }));
  const covers = library.volumes
    .filter((v) => v.cover)
    .map((v) => ({ url: abs(v.cover), kind: 'cover' }));
  const seen = new Set();
  return [...audio, ...covers].filter((f) => (seen.has(f.url) ? false : (seen.add(f.url), true)));
}

const supported = () => 'caches' in window;

/* The saved copy of one file as a Blob, or null if it is not saved. The
   player plays saved songs from a Blob URL rather than through the service
   worker, which is the most dependable way to play audio offline. */
export async function getCachedBlob(relativeUrl) {
  if (!supported()) return null;
  try {
    const cache = await caches.open(CRATE_CACHE);
    const hit = await cache.match(abs(relativeUrl));
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}

/* How many of the files are already saved? */
export async function crateStatus(files) {
  if (!supported()) return { saved: 0, total: files.length, supported: false };
  const cache = await caches.open(CRATE_CACHE);
  let saved = 0;
  for (const f of files) {
    if (await cache.match(f.url)) saved += 1;
  }
  return { saved, total: files.length, supported: true };
}

const sameFile = (a, b) => {
  const tag = (r) => r.headers.get('etag');
  if (tag(a) && tag(b)) return tag(a) === tag(b);
  const len = (r) => r.headers.get('content-length');
  return Boolean(len(a)) && len(a) === len(b);
};

/* Download everything missing. Calls onProgress({ done, total, failed, bytes })
   as it goes. Resolves { done, failed: [urls], total }. */
export async function loadCrates(files, { onProgress = () => {}, concurrency = 2 } = {}) {
  if (!supported()) return { done: 0, total: files.length, failed: files.map((f) => f.url), unsupported: true };

  try { await navigator.storage?.persist?.(); } catch { /* optional */ }

  const cache = await caches.open(CRATE_CACHE);
  const wanted = new Set(files.map((f) => f.url));
  for (const req of await cache.keys()) {
    if (!wanted.has(req.url)) await cache.delete(req);
  }

  const state = { done: 0, total: files.length, failed: [], bytes: 0 };
  const report = () => onProgress({ ...state, failed: state.failed.slice() });
  report();

  async function fetchOne(file) {
    const cached = await cache.match(file.url);
    if (cached) {
      // Only re-download if the server's copy differs. Offline? Keep what we have.
      try {
        const head = await fetch(file.url, { method: 'HEAD', cache: 'no-cache' });
        if (!head.ok || sameFile(cached, head)) return true;
      } catch { return true; }
    }
    // The bypass header tells the service worker to go to the network instead of
    // answering from the copy we are about to replace.
    const res = await fetch(file.url, { cache: 'no-cache', headers: { 'x-sn-bypass': '1' } });
    if (!res.ok) {
      if (file.kind === 'cover') return true;       // a missing cover just shows a plain sleeve
      throw new Error(`${res.status}`);
    }
    // read the body in pieces so the meter moves smoothly on big files
    const chunks = [];
    const reader = res.body?.getReader?.();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        state.bytes += value.length;
      }
    } else {
      chunks.push(new Uint8Array(await res.arrayBuffer()));
    }
    const headers = new Headers(res.headers);
    await cache.put(file.url, new Response(new Blob(chunks), { status: 200, headers }));
    return true;
  }

  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      try {
        await fetchOne(file);
      } catch (err) {
        console.warn('[crates] could not save', file.url, err);
        state.failed.push(file.url);
      }
      state.done += 1;
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return { done: state.done, total: state.total, failed: state.failed };
}

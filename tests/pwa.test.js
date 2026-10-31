import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { isInstalledApp, shouldTryHum } from '../rink.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const png = (f) => {                                   // width and height from a PNG's IHDR
  const b = readFileSync(new URL(`../${f}`, import.meta.url));
  assert.equal(b.toString('latin1', 1, 4), 'PNG', `${f} is a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test('the manifest makes one installable arcade machine that works under any path', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.name, 'Skate by Faith — Arcade Jukebox');
  assert.equal(m.short_name, 'Skate by Faith');
  for (const k of ['start_url', 'scope', 'id']) assert.equal(m[k], './', `${k} is relative, so /SkateNight/ and / both work`);
  assert.equal(m.display, 'fullscreen');
  assert.equal(m.background_color, '#05030B', 'the dark of the dormant room');
  assert.equal(m.theme_color, '#05030B');
  const sizes = m.icons.map((i) => `${i.sizes}:${i.purpose}`);
  assert.ok(sizes.includes('192x192:any') && sizes.includes('512x512:any') && sizes.includes('512x512:maskable'));
  for (const icon of m.icons) {
    assert.ok(existsSync(new URL(`../${icon.src}`, import.meta.url)), `${icon.src} exists`);
    assert.deepEqual(png(icon.src), icon.sizes.split('x').map(Number), `${icon.src} is really ${icon.sizes}`);
    assert.ok(!icon.src.startsWith('/'), 'relative icon paths');
  }
});

test('the page links the manifest and keeps the dormant cabinet as its first screen', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<meta name="theme-color" content="#05030B">/);
  assert.match(html, /<body class="on-attract">/, 'no splash, no install button, no welcome');
  assert.doesNotMatch(html, /install|beforeinstallprompt/i, 'Chrome\'s own install command is enough');
});

test('the hum on launch: the operator\'s choice wins, the installed app tries, a tab stays silent', () => {
  assert.equal(shouldTryHum('off', true), false, 'switched off: never, even installed');
  assert.equal(shouldTryHum('off', false), false);
  assert.equal(shouldTryHum('on', false), true, 'switched on: tried in a tab too');
  assert.equal(shouldTryHum('on', true), true);
  assert.equal(shouldTryHum(null, true), true, 'installed, no choice made: tried');
  assert.equal(shouldTryHum(null, false), false, 'a browser tab, no choice made: silent until a press');
  const win = (modes, standalone) => ({ matchMedia: (q) => ({ matches: modes.some((m) => q === `(display-mode: ${m})`) }), navigator: { standalone } });
  assert.equal(isInstalledApp(win(['browser'])), false);
  for (const m of ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']) assert.equal(isInstalledApp(win([m])), true, m);
  assert.equal(isInstalledApp(win([], true)), true, 'iOS home-screen app');
  assert.equal(isInstalledApp({}), false, 'no matchMedia: a tab');
});

test('one audio engine, however often it is asked for', async (t) => {
  let made = 0;
  class FakeContext {
    constructor() { made += 1; this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.resumes = 0; }
    resume() { this.resumes += 1; return Promise.resolve(); }
    createGain() { return { gain: { value: 1, setTargetAtTime() {} }, connect() {} }; }
    createDynamicsCompressor() { const p = () => ({ value: 0 }); return { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p(), connect() {} }; }
    createAnalyser() { return { fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 8, connect() {} }; }
    createChannelSplitter() { return { connect() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect() {} }; }
  }
  globalThis.window = { AudioContext: FakeContext };
  t.after(() => { delete globalThis.window; });
  const { unlockAudio, getEngine } = await import('../audio.js');
  const atLaunch = unlockAudio();                       // the installed app trying the hum
  const atCoin = unlockAudio();                         // the coin press
  assert.equal(made, 1, 'one AudioContext');
  assert.equal(atLaunch, atCoin);
  assert.equal(getEngine(), atLaunch);
  assert.equal(atCoin.ctx.resumes, 2, 'each press asks for sound again: a blocked launch is recovered by the coin');
});

test('a blocked launch stays silent and quiet: no banner, no retry loop, no restart once the film has begun', () => {
  const app = read('app.js');
  const gate = app.slice(app.indexOf('if (shouldTryHum(savedHum, isInstalledApp()))'), app.indexOf("document.addEventListener('visibilitychange', () => drone"));
  assert.match(gate, /engine\.ctx\.state === 'running' && !started && drone\?\.state === 'dormant' && !drone\.sounding\) drone\.start\(\)/,
    'starts only on real sound, never after the coin, never twice');
  assert.doesNotMatch(gate, /toast|alert|setInterval|setTimeout|new AudioContext/, 'nothing shown, nothing polled, no second engine');
  assert.match(app, /let humFirst = new URLSearchParams\(location\.search\)\.has\('hum'\) \|\| rememberedDrone;/, 'only an explicit arm makes the first press the hum');
});

test('the service worker registers while the cabinet waits, once, and the app works offline', () => {
  const app = read('app.js');
  assert.equal(app.match(/registerServiceWorker\(\)/g).length, 1, 'one registration');
  assert.ok(app.indexOf('registerServiceWorker()') < app.indexOf('async function startNight'), 'before anyone presses anything');
  assert.match(app, /addEventListener\('load', register, \{ once: true \}\)/, 'after first paint');
  const sw = read('sw.js');
  for (const f of ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'drone.js', 'startup-fault.js']) assert.ok(sw.includes(`'${f}'`), `${f} cached`);
  for (const f of ['crowd.js', 'link.js']) assert.ok(!sw.includes(`'${f}'`), `${f} retired`);
  assert.match(sw, /const CRATE_CACHE = 'skatenight-crates';/, 'saved songs keep their cache');
  const listed = [...sw.matchAll(/'([\w./-]+\.(?:js|css|png|webmanifest|woff2|wav|html))'/g)].map((m) => m[1]);
  for (const f of listed) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} exists to cache`);
});

test('one window: no crowd screen, pop-up, heartbeat or channel left anywhere in the app', () => {
  const files = readdirSync(new URL('..', import.meta.url)).filter((f) => /\.(js|html|css)$/.test(f) && f !== 'sw.js');
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, /BroadcastChannel|view=crowd|is-crowd|btn-crowd|crowd-hint|createLink|runCrowd|window\.open\(/, `${f} is one window`);
  }
  for (const f of ['crowd.js', 'link.js']) assert.ok(!existsSync(new URL(`../${f}`, import.meta.url)), `${f} removed`);
  const app = read('app.js');
  assert.match(app, /const mech = createMechanism\(\{ sfx, tracks: library\.tracks, volumeById \}\);/, 'the real mechanism, no wrapper');
  assert.match(app, /mech\.setRackLookup\(/);
  assert.match(app, /visualiser = createVisualiser\(\);/, 'the visualiser draws its own meters, sends nothing');
  assert.match(read('index.html'), /id="btn-fs"/, 'fullscreen stays in TOOLS');
});

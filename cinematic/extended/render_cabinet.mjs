#!/usr/bin/env node
// Render the approved browser opening at its actual native-30 sample times.
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  start: { type: 'string', default: '0' }, end: { type: 'string', default: '92' },
  width: { type: 'string', default: '1920' }, height: { type: 'string', default: '1080' },
  'output-dir': { type: 'string' }, 'assets-root': { type: 'string' }, resume: { type: 'boolean', default: false },
} });
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const start = Number(values.start), end = Number(values.end);
const width = Number(values.width), height = Number(values.height);
if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 92 || start > end) throw new Error('Cabinet range must be within inclusive native frames 0..92.');
if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || width * 9 !== height * 16) throw new Error('Cabinet output must have a positive 16:9 integer size.');
if (!values['output-dir']) throw new Error('--output-dir is required.');
const output = resolve(values['output-dir']);
await mkdir(output, { recursive: true });
// Reuse the production PNG validator: checks every chunk CRC and IEND, not just IHDR.
const checked = spawnSync('python3', ['-c', `import json,sys
from pathlib import Path
sys.path.insert(0,sys.argv[1])
from frame_io import png_dimensions
folder=Path(sys.argv[2]);w,h,start,end=map(int,sys.argv[3:])
print(json.dumps({str(f):png_dimensions(folder/f'frame_{f:04d}.png') for f in range(start,end+1) if (folder/f'frame_{f:04d}.png').exists()}))`, resolve(root, 'cinematic'), output, String(width), String(height), String(start), String(end)], { encoding: 'utf8' });
if (checked.status !== 0) throw new Error(`Cabinet frame validation failed: ${checked.stderr}`);
const existing = JSON.parse(checked.stdout);
if (!values.resume && Object.keys(existing).length) throw new Error('Cabinet frames already exist; use --resume to preserve valid frames and recover incomplete ones.');
const reusable = new Set(Object.entries(existing).filter(([, size]) => size?.[0] === width && size?.[1] === height).map(([frame]) => Number(frame)));
let playwright;
if (process.env.PLAYWRIGHT_CORE_PATH) {
  playwright = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_CORE_PATH)).href);
} else {
  try { playwright = await import('playwright-core'); }
  catch {
    // An isolated git worktree can reuse the original checkout's installed tools.
    const installed = '/Users/benjaminhay/SkateNight/node_modules/playwright-core/index.mjs';
    await access(installed);
    playwright = await import(pathToFileURL(installed).href);
  }
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const path = resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
  if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try { const data = await readFile(path); response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(data); }
  catch { response.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await playwright.chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-gpu', '--enable-webgl', '--ignore-gpu-blocklist'] });
  // Keep the approved 1920x1080 composition, even for inexpensive output.
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: width / 1920, reducedMotion: 'no-preference', serviceWorkers: 'block' });
  await context.addInitScript(() => {
    let state = 0x51a7e;
    Math.random = () => { state = (state * 16807) % 2147483647; return (state - 1) / 2147483646; };
    const starts = new WeakMap();
    globalThis.__setAwakeningRenderTime = (time) => {
      globalThis.__renderAnimationTime = time;
      for (const animation of document.getAnimations({ subtree: true })) {
        if (!starts.has(animation)) { animation.pause(); starts.set(animation, globalThis.__renderAnimationTime); }
        animation.pause(); animation.currentTime = Math.max(0, time - starts.get(animation));
      }
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?cut=plunge&render=1&live=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(globalThis.__skateNight));
  await page.locator('.attract-logo').evaluate((image) => image.decode());
  await page.locator('#attract').click();
  await page.waitForFunction(() => typeof globalThis.__plungeDraw === 'function');
  const rendered = [];
  for (let frame = 0; frame <= end; frame++) {
    const file = resolve(output, `frame_${String(frame).padStart(4, '0')}.png`);
    await page.evaluate((time) => {
      globalThis.__advanceAwakening(time); globalThis.__setAwakeningRenderTime(time); globalThis.__plungeDraw(time);
    }, frame * 1000 / 30);
    if (frame < start) continue;
    if (values.resume && reusable.has(frame)) continue;
    const png = await page.screenshot({ type: 'png', animations: 'allow', scale: 'device' });
    if (png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height) throw new Error('Chrome returned the wrong cabinet frame size.');
    await writeFile(file + '.tmp', png); await rename(file + '.tmp', file);
    rendered.push(frame);
  }
  if (errors.length) throw new Error(`Cabinet page errors: ${errors.join('; ')}`);
  await writeFile(resolve(output, 'cabinet-render.json'), JSON.stringify({ fps: 30, width, height, start, end, sample: 'global frame / 30 seconds', source: 'approved browser opening', renderedFrames: rendered }, null, 2) + '\n');
  console.log(`Cabinet native30 frames ${start}..${end}, ${width}x${height}: ${output}`);
} finally { await browser?.close(); await new Promise((done) => server.close(done)); }

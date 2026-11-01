#!/usr/bin/env node
/* Prove the director's cut handoff in a real browser: the film keeps running
   while the jukebox plays the opener, the song is locked to the film's cues,
   and the film lands on the live #record at several screen sizes.

       python3 -m http.server 8091 &
       node scripts/check-film-overlap.mjs film.mp4 film.mp4.json [--base-url http://127.0.0.1:8091] [--out dir]

   Imports the film as the production preview (TOOLS -> IMPORT FILM + MANIFEST),
   presses PREVIEW EXTERNAL FILM + SONG HANDOFF, and samples the film's clock and
   the song's clock on every animation frame. Needs Google Chrome (H.264) and
   playwright-core. Writes overlap-proof.json and screenshots; exits 1 on failure. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const [mp4, manifestPath] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!mp4 || !manifestPath) throw new Error('Usage: check-film-overlap.mjs film.mp4 film.mp4.json');
const BASE = opt('--base-url', 'http://127.0.0.1:8091');
const OUT = resolve(opt('--out', 'build/cinematic-phase4/overlap-proof'));
const VIEWPORTS = [[1920, 1080], [1440, 900], [1280, 800], [1024, 768]];
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const { songStartSec } = manifest.handoff;
const FRAME_MS = 1000 / manifest.fps;
await mkdir(OUT, { recursive: true });

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function run(browser, [width, height]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => sessionStorage.setItem('sn_booted', '1'));
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.getElementById('attract').hidden, null, { timeout: 30000 });
  await page.setInputFiles('#film-files', [resolve(mp4), resolve(manifestPath)]);
  await page.waitForFunction(() => !document.getElementById('btn-film-preview').disabled, null, { timeout: 180000 });
  await page.evaluate((muteFilm) => {
    const video = document.getElementById('production-preview-video');
    video.muted = muteFilm;                        // diagnostic: is the film's own audio clock the one slipping?
    window.__samples = [];
    window.__frames = [];                          // presented film frames: [wall ms, media time]
    const onFrame = (now, meta) => { window.__frames.push([meta.presentationTime ?? now, meta.mediaTime]);
      if (!window.__stopSampling) video.requestVideoFrameCallback(onFrame); };
    video.requestVideoFrameCallback(onFrame);
    const tick = () => {
      const player = window.__skateNight?.player;
      window.__samples.push({
        film: video.currentTime, filmPlaying: !video.paused,
        song: player?.currentTime ?? null, track: player?.currentTrackId ?? null,
        media: [...document.querySelectorAll('audio, video')].filter((m) => !m.paused && !m.muted).length,
      });
      if (!window.__stopSampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    document.getElementById('btn-film-preview').click();
  }, args.includes('--mute-film'));
  const regAt = manifest.cues.registrationStartFrame / manifest.fps;
  await page.waitForFunction((t) => document.getElementById('production-preview-video').currentTime >= t,
    regAt + 0.35, { timeout: 60000 });
  await page.screenshot({ path: `${OUT}/${width}x${height}-registering.png` });
  await page.waitForFunction(() => window.__overlapStats?.revealMs, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${width}x${height}-revealed.png` });
  const result = await page.evaluate(() => {
    window.__stopSampling = true;
    const rect = document.getElementById('record-mover').getBoundingClientRect();
    const spin = document.getElementById('record').getAnimations().find((a) => a.animationName === 'record-spin');
    return {
      stats: window.__overlapStats, samples: window.__samples, frames: window.__frames,
      liveRecord: { cx: rect.x + rect.width / 2, cy: rect.y + rect.height / 2, r: rect.width / 2 },
      spinMs: spin ? spin.currentTime : null, now: performance.now(),
      attractHidden: document.getElementById('attract').hidden,
    };
  });
  await context.close();

  const locked = result.samples.filter((s) => s.filmPlaying && s.track === manifest.handoff.openerTrackId && s.song > 0.15);
  const offset = median(locked.map((s) => s.film - s.song));
  const { stats } = result;
  const period = 60000 / manifest.handoff.record.rpm;
  const spinDeg = ((result.spinMs % period) / period) * 360;
  const expectedDeg = (manifest.handoff.record.cssAngleDeg + ((result.now - stats.filmEndedMs) / period) * 360) % 360;
  const fit = stats.fit.mask;
  return {
    viewport: `${width}x${height}`,
    songStartErrorMs: Math.round((offset - songStartSec) * 10000) / 10,
    contactSongTimeSec: Math.round((manifest.cues.stylusContactFrame / manifest.fps - offset) * 1000) / 1000,
    revealAfterFilmEndMs: Math.round(stats.revealMs - stats.filmEndedMs),
    recordCentreErrorPx: Math.round(Math.hypot(fit.cx - result.liveRecord.cx, fit.cy - result.liveRecord.cy) * 100) / 100,
    recordRadiusErrorPx: Math.round(Math.abs(fit.r - result.liveRecord.r) * 100) / 100,
    filmScale: Math.round(stats.fit.scale * 1000) / 1000,
    spinPhaseErrorDeg: Math.round(Math.abs(((spinDeg - expectedDeg + 540) % 360) - 180) * 10) / 10,
    maxPlayingMedia: Math.max(...result.samples.map((s) => s.media)),
    maxDriftCorrectedMs: Math.round(stats.maxDriftMs || 0),
    filmGapsNearSongMs: (() => {                   // presentation gaps within 0.5 s of the song start
      const near = result.frames.filter(([, m]) => Math.abs(m - songStartSec) < 0.5);
      return Math.round(Math.max(...near.slice(1).map(([t], i) => t - near[i][0])));
    })(),
    firstSlip: stats.firstSlip ? `${stats.firstSlip.driftMs}ms@${stats.firstSlip.songTime.toFixed(2)}s` : "none",
    lockedSamples: locked.length,
    attractHidden: result.attractHidden,
    pageErrors: errors,
  };
}

const browser = await chromium.launch({ channel: 'chrome', headless: !args.includes('--headed'),
  args: ['--autoplay-policy=no-user-gesture-required'] });
const results = [];
for (const viewport of VIEWPORTS) results.push(await run(browser, viewport));
await browser.close();
await writeFile(`${OUT}/overlap-proof.json`, `${JSON.stringify(results, null, 2)}\n`);
console.table(results.map(({ pageErrors, ...r }) => ({ ...r, errors: pageErrors.length })));
const failed = results.filter((r) => Math.abs(r.songStartErrorMs) > FRAME_MS || Math.abs(r.revealAfterFilmEndMs) > 3 * FRAME_MS
  || r.recordCentreErrorPx > 1 || r.recordRadiusErrorPx > 1 || r.spinPhaseErrorDeg > 6 || r.pageErrors.length
  || !r.attractHidden);
if (failed.length) {
  console.error(`FAILED: ${failed.map((r) => r.viewport).join(', ')}`);
  process.exit(1);
}
console.log(`PASSED at ${results.length} screen sizes. Proof: ${OUT}/overlap-proof.json`);

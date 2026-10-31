import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(process.argv[2] || join(root, 'build/awakening-film.mp4'));
const manifestPath = `${output}.json`;
const width = 1920;
const height = 1080;
const fps = 60;
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const temp = await mkdtemp(join(tmpdir(), 'skate-awakening-'));
const wavPath = join(temp, 'awakening-sfx.wav');

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    const stdout = [];
    const stderr = [];
    child.stdout?.on('data', (chunk) => stdout.push(chunk));
    child.stderr?.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise({ stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString() });
      else reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString()}`));
    });
  });
}

function contentType(path) {
  return ({
    '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2',
  })[extname(path)] || 'application/octet-stream';
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (request.method === 'POST' && url.pathname === '/__offline-audio') {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    await writeFile(wavPath, Buffer.concat(chunks));
    response.writeHead(204).end();
    return;
  }
  const path = resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(path || join(root, 'index.html'));
    response.writeHead(200, { 'content-type': contentType(path), 'cache-control': 'no-store' }).end(data);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

async function writeFrames(page, child, count) {
  const frameMs = 1000 / fps;
  for (let frame = 0; frame < count; frame++) {
    await page.evaluate((time) => {
      globalThis.__advanceAwakening(time);
      globalThis.__setAwakeningRenderTime(time);
      globalThis.__plungeDraw(time);
    }, frame * frameMs);
    const png = await page.screenshot({ type: 'png', animations: 'allow', timeout: 30000 });
    if (!child.stdin.write(png)) await new Promise((resolvePromise) => child.stdin.once('drain', resolvePromise));
    if (frame && frame % 120 === 0) process.stdout.write(`Rendered ${frame}/${count} frames\n`);
  }
}

async function main() {
  await mkdir(dirname(output), { recursive: true });
  await new Promise((resolvePromise, reject) => server.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolvePromise()));
  const { port } = server.address();
  if (!await exists(chromePath)) throw new Error(`Chrome was not found at ${chromePath}; set CHROME_PATH to the installed Chrome executable.`);

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--enable-gpu', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  try {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
      serviceWorkers: 'block',
    });
    await context.addInitScript(() => {
      let state = 0x51a7e;
      Math.random = () => {
        state = (state * 16807) % 2147483647;
        return (state - 1) / 2147483646;
      };
      const animationStarts = new WeakMap();
      globalThis.__setAwakeningRenderTime = (time) => {
        globalThis.__renderAnimationTime = time;
        for (const animation of document.getAnimations({ subtree: true })) {
          if (!animationStarts.has(animation)) {
            animation.pause();
            animationStarts.set(animation, globalThis.__renderAnimationTime);
          }
          animation.pause();
          animation.currentTime = Math.max(0, time - animationStarts.get(animation));
        }
      };
    });

    const audioPage = await context.newPage();
    await audioPage.goto(`http://127.0.0.1:${port}/scripts/render-audio.html?cut=plunge`, { waitUntil: 'load' });
    await audioPage.waitForFunction(() => typeof globalThis.renderStartupAudio === 'function');
    await audioPage.evaluate(async () => {
      const audio = await globalThis.renderStartupAudio();
      const channels = [audio.getChannelData(0), audio.getChannelData(1)];
      const bytesPerSample = 2;
      const dataLength = channels[0].length * channels.length * bytesPerSample;
      const wav = new ArrayBuffer(44 + dataLength);
      const view = new DataView(wav);
      const text = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
      text(0, 'RIFF'); view.setUint32(4, 36 + dataLength, true); text(8, 'WAVE');
      text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
      view.setUint16(22, channels.length, true); view.setUint32(24, audio.sampleRate, true);
      view.setUint32(28, audio.sampleRate * channels.length * bytesPerSample, true);
      view.setUint16(32, channels.length * bytesPerSample, true); view.setUint16(34, 16, true);
      text(36, 'data'); view.setUint32(40, dataLength, true);
      let offset = 44;
      for (let index = 0; index < channels[0].length; index++) {
        for (const channel of channels) {
          const sample = Math.max(-1, Math.min(1, channel[index]));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
          offset += bytesPerSample;
        }
      }
      const response = await fetch('/__offline-audio', { method: 'POST', body: wav });
      if (!response.ok) throw new Error('Could not save the offline effects render.');
    });
    await audioPage.close();

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/?cut=plunge&render=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(globalThis.__skateNight));
    await page.locator('.attract-logo').evaluate((image) => image.decode());
    await page.locator('#attract').click();
    await page.waitForFunction(() => typeof globalThis.__plungeDraw === 'function', { timeout: 30000 });

    const timing = await page.evaluate(async () => {
      const { BEATS } = await import('./startup-timing.js');
      const frames = Math.ceil((BEATS.end / 1000) * 60);
      return { durationMs: BEATS.end, frames };
    });
    const count = timing.frames;
    const render = spawn(ffmpeg, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(fps), '-i', 'pipe:0',
      '-i', wavPath, '-map', '0:v:0', '-map', '1:a:0', '-frames:v', String(count),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-profile:v', 'high', '-level:v', '4.2',
      '-pix_fmt', 'yuv420p', '-r', String(fps), '-c:a', 'aac', '-b:a', '256k',
      '-movflags', '+faststart', output,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    const errors = [];
    render.stderr.on('data', (chunk) => errors.push(chunk));
    const finished = new Promise((resolvePromise, reject) => {
      render.on('error', reject);
      render.on('close', (code) => code === 0
        ? resolvePromise()
        : reject(new Error(`FFmpeg exited ${code}: ${Buffer.concat(errors).toString()}`)));
    });
    try {
      await writeFrames(page, render, count);
      render.stdin.end();
      await finished;
    } catch (error) {
      render.kill('SIGTERM');
      throw error;
    } finally {
      await page.close();
    }

    const { stdout } = await run(ffprobe, [
      '-v', 'error', '-show_entries',
      'stream=codec_name,width,height,r_frame_rate,nb_frames,duration,sample_rate,channels',
      '-show_entries', 'format=duration', '-of', 'json', output,
    ]);
    const probe = JSON.parse(stdout);
    const video = probe.streams.find((stream) => stream.codec_name === 'h264');
    const audio = probe.streams.find((stream) => stream.codec_name === 'aac');
    if (pageErrors.length) throw new Error(`Chrome render errors: ${pageErrors.join('; ')}`);
    if (!video || !audio || video.width !== width || video.height !== height || video.r_frame_rate !== '60/1'
        || Number(video.nb_frames) !== count || Math.abs(Number(video.duration) - count / fps) > 1 / fps
        || Number(audio.sample_rate) !== 48000 || Number(audio.channels) !== 2) {
      throw new Error(`FFmpeg output failed verification: ${JSON.stringify(probe.streams)}`);
    }
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(output)) hash.update(chunk);
    const manifest = {
      filmId: 'skate-by-faith-awakening-plunge-1080p60-v1',
      width, height, fps, frameCount: count, durationSec: count / fps,
      videoCodec: 'h264', audioCodec: 'aac', audioSampleRate: Number(audio.sample_rate),
      audioChannels: Number(audio.channels), sha256: hash.digest('hex'),
      sequence: 'Plunge extended cinematic source',
      sequenceEndMs: timing.durationMs,
      handoff: { filmEndsOn: 'cut', openerLeadMs: 434.5 },
      generatedAt: new Date().toISOString(),
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    process.stdout.write(`Verified ${count} frames at 1920x1080/60 fps, H.264 + AAC.\n`);
    process.stdout.write(`MP4: ${output}\nManifest: ${manifestPath}\nSHA-256: ${manifest.sha256}\n`);
  } finally {
    await browser.close();
  }
}

try {
  await main();
} finally {
  server.close();
  await rm(temp, { recursive: true, force: true });
}

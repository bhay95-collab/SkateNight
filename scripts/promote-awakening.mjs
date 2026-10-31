import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  AWAKENING_FILM_FRAME_COUNT,
  AWAKENING_FILM_HEIGHT,
  AWAKENING_FILM_ID,
  AWAKENING_FILM_WIDTH,
  validateAwakeningFilmManifest,
} from '../awakening-film.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const [movieArg, manifestArg, approvalFlag] = process.argv.slice(2);
if (!movieArg || !manifestArg || approvalFlag !== '--confirm-approved') {
  throw new Error(
    'Usage: npm run cinematic:promote -- approved-awakening.mp4 approved-awakening.mp4.json --confirm-approved',
  );
}

const movie = resolve(movieArg);
const sourceManifestPath = resolve(manifestArg);
const manifest = JSON.parse(await readFile(sourceManifestPath, 'utf8'));
validateAwakeningFilmManifest(manifest, 'awakening');
if (manifest.frameCount !== AWAKENING_FILM_FRAME_COUNT
    || manifest.width !== AWAKENING_FILM_WIDTH || manifest.height !== AWAKENING_FILM_HEIGHT
    || manifest.filmId !== AWAKENING_FILM_ID
    || manifest.cues.stylusContactFrame == null
    || manifest.productionApproval?.status !== 'approved'
    || !manifest.productionApproval.approvedBy
    || !Number.isFinite(Date.parse(manifest.productionApproval.approvedAt))) {
  throw new Error(
    'Promotion requires the complete 1080p60 Awakening, a measured stylus-contact cue, and explicit production approval metadata.',
  );
}

const limit = 50 * 1024 * 1024;
const { size } = await stat(movie);
if (size > limit) {
  throw new Error(`The MP4 is ${size} bytes; keep website assets at or below 50 MiB to avoid GitHub large-file warnings.`);
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => code === 0
      ? resolvePromise(Buffer.concat(stdout).toString())
      : reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString()}`)));
  });
}

const probe = JSON.parse(await run(process.env.FFPROBE_PATH || 'ffprobe', [
  '-v', 'error', '-show_entries',
  'stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels',
  '-of', 'json', movie,
]));
const video = probe.streams.find((stream) => stream.codec_type === 'video');
const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
if (!video || !audio || video.codec_name !== 'h264' || audio.codec_name !== 'aac'
    || video.width !== AWAKENING_FILM_WIDTH || video.height !== AWAKENING_FILM_HEIGHT
    || video.r_frame_rate !== '60/1' || Number(video.nb_frames) !== AWAKENING_FILM_FRAME_COUNT
    || Number(audio.sample_rate) !== 48000 || audio.channels !== 2) {
  throw new Error('The approved asset does not match the website H.264/AAC 1080p60 delivery contract.');
}

const hash = createHash('sha256');
for await (const chunk of createReadStream(movie)) hash.update(chunk);
const sha256 = hash.digest('hex');
if (sha256 !== manifest.sha256) throw new Error('The MP4 checksum does not match its production manifest.');

const filmsDir = join(root, 'films');
const movieName = `awakening-v${manifest.filmVersion}.mp4`;
const movieDestination = join(filmsDir, movieName);
const manifestDestination = join(filmsDir, 'manifest.json');
const tempDir = join(filmsDir, `.promotion-${process.pid}`);
await mkdir(filmsDir, { recursive: true });
try {
  await mkdir(tempDir);
  await copyFile(movie, join(tempDir, movieName));
  const publishedManifest = {
    ...manifest,
    videoFile: movieName,
    hostedSizeBytes: size,
  };
  await writeFile(join(tempDir, 'manifest.json'), `${JSON.stringify(publishedManifest, null, 2)}\n`);
  try {
    await stat(movieDestination);
    throw new Error(`${movieName} already exists. Increment filmVersion instead of replacing a published version.`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await rename(join(tempDir, movieName), movieDestination);
  await rename(join(tempDir, 'manifest.json'), manifestDestination);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

process.stdout.write(`Prepared approved website film: ${movieDestination}\n`);
process.stdout.write(`Current-film manifest: ${manifestDestination}\n`);
process.stdout.write(`Size: ${(size / (1024 * 1024)).toFixed(2)} MiB; SHA-256: ${sha256}\n`);
process.stdout.write('Review and commit only films/awakening-vN.mp4 and films/manifest.json.\n');

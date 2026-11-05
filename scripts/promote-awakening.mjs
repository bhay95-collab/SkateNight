/* Promote the assembled, reviewed native-30 render to the website's show-film slot.
   npm run cinematic:promote -- awakening-35-effects-only.mp4 awakening-35-effects-only.mp4.json \
     --confirm-approved --approved-by "Name" --source-commit dcaf590
   Writes films/song-inside-35s-vN.mp4 (immutable) and films/manifest.json. */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  AWAKENING_FILM_FPS,
  AWAKENING_FILM_FRAME_COUNT,
  AWAKENING_FILM_HEIGHT,
  AWAKENING_FILM_ID,
  AWAKENING_FILM_WIDTH,
  EXTENDED_PREVIEW_ID,
  validateAwakeningFilmManifest,
  validateHostedAwakeningManifest,
} from '../awakening-film.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const [movieArg, manifestArg] = args;
const approvedBy = option('--approved-by');
const sourceCommit = option('--source-commit');
if (!movieArg || !manifestArg || !args.includes('--confirm-approved') || !approvedBy
    || !/^[0-9a-f]{7,40}$/.test(sourceCommit || '')) {
  throw new Error('Usage: npm run cinematic:promote -- film.mp4 film.mp4.json --confirm-approved '
    + '--approved-by "Name" --source-commit <git sha>');
}

const movie = resolve(movieArg);
const source = JSON.parse(await readFile(resolve(manifestArg), 'utf8'));
// The assembler writes the locked native-30 contract as an experimental preview;
// approval is the only thing promotion adds. Timing and cues are carried unchanged.
validateAwakeningFilmManifest(source, 'production-preview');
if (source.filmId !== EXTENDED_PREVIEW_ID) {
  throw new Error(`Promotion takes the assembled ${EXTENDED_PREVIEW_ID} render manifest.`);
}

const limit = 50 * 1024 * 1024;
const { size } = await stat(movie);
if (size > limit) {
  throw new Error(`The MP4 is ${size} bytes; keep website assets at or below 50 MiB to avoid GitHub large-file warnings.`);
}

function run(command, commandArgs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => code === 0
      ? resolvePromise({ stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString() })
      : reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString()}`)));
  });
}

const probe = JSON.parse((await run(process.env.FFPROBE_PATH || 'ffprobe', [
  '-v', 'error', '-count_frames', '-show_entries',
  'stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,sample_rate,channels',
  '-of', 'json', movie,
])).stdout);
const video = probe.streams.find((stream) => stream.codec_type === 'video');
const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
if (!video || !audio || video.codec_name !== 'h264' || audio.codec_name !== 'aac'
    || video.width !== AWAKENING_FILM_WIDTH || video.height !== AWAKENING_FILM_HEIGHT
    || video.r_frame_rate !== `${AWAKENING_FILM_FPS}/1` || Number(video.nb_read_frames) !== AWAKENING_FILM_FRAME_COUNT
    || Number(audio.sample_rate) !== 48000 || audio.channels !== 2) {
  throw new Error('The approved asset does not match the website H.264/AAC 1080p30 1,050-frame delivery contract.');
}
// Every packet must decode cleanly: a damaged file must never become the show film.
const decode = await run(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-xerror', '-i', movie, '-f', 'null', '-']);
if (decode.stderr.trim()) throw new Error(`The approved asset reported decode errors: ${decode.stderr}`);

const hash = createHash('sha256');
for await (const chunk of createReadStream(movie)) hash.update(chunk);
const sha256 = hash.digest('hex');
if (sha256 !== source.sha256) throw new Error('The MP4 checksum does not match its render manifest.');

const movieName = `song-inside-35s-v${source.filmVersion}.mp4`;
const { applicationImportable, renderProvenance = [], ...carried } = source;
const manifest = {
  ...carried,
  filmKind: 'awakening',
  filmId: AWAKENING_FILM_ID,
  experimental: false,
  title: 'Skate by Faith — The Song Inside',
  source: 'Approved 1920x1080 native-30 production render; cinematic effects only',
  sourceFilmId: source.filmId,
  sourceCommit,
  // Fingerprints only: local render paths stay on the render machine.
  renderProvenance: renderProvenance.map(({ shot, fingerprint_sha256: fingerprint }) => ({ shot, fingerprint })),
  productionApproval: { status: 'approved', approvedBy, approvedAt: new Date().toISOString() },
  videoFile: movieName,
  hostedSizeBytes: size,
};
validateAwakeningFilmManifest(manifest, 'awakening');
validateHostedAwakeningManifest(manifest, 'https://example.invalid/films/manifest.json');

const filmsDir = join(root, 'films');
const movieDestination = join(filmsDir, movieName);
const manifestDestination = join(filmsDir, 'manifest.json');
const tempDir = join(filmsDir, `.promotion-${process.pid}`);
await mkdir(filmsDir, { recursive: true });
try {
  await mkdir(tempDir);
  await copyFile(movie, join(tempDir, movieName));
  await writeFile(join(tempDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
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
process.stdout.write('Review and commit only the versioned MP4 and films/manifest.json.\n');

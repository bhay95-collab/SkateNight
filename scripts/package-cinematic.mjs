import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { validateAwakeningFilmManifest } from '../awakening-film.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' },
    title: { type: 'string' },
    version: { type: 'string', default: '1' },
    source: { type: 'string', default: 'external production render' },
    'audio-description': { type: 'string', default: 'cinematic sound effects only; the opening song remains in the jukebox player' },
    'coin-frame': { type: 'string' },
    'failure-frame': { type: 'string' },
    'recovery-frame': { type: 'string' },
    'stylus-frame': { type: 'string' },
    'handoff-frame': { type: 'string' },
    'song-frame': { type: 'string' },
    'opener-lead-ms': { type: 'string', default: '434.5' },
    // the director's cut: the film keeps running into the song (see cinematic/cues.json)
    'song-start': { type: 'string' },
    'registration-frame': { type: 'string' },
    'record': { type: 'string' },
  },
});

const [inputArg, outputArg] = positionals;
if (!inputArg || !outputArg || !values.id || !values.title) {
  throw new Error(
    'Usage: node scripts/package-cinematic.mjs input.mp4 output.mp4 --id skate-by-faith-megastructure-v1 --title "Megastructure look-dev" [--coin-frame N --failure-frame N --recovery-frame N --stylus-frame N --handoff-frame N --song-frame N]',
  );
}

const input = resolve(inputArg);
const output = resolve(outputArg);
const manifestPath = `${output}.json`;
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const fps = 60;
const width = 1920;
const height = 1080;
const hashPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

if (!hashPattern.test(values.id)) throw new Error('--id must be a lowercase, hyphen-separated identifier.');
if (!Number.isInteger(Number(values.version)) || Number(values.version) < 1) throw new Error('--version must be a positive integer.');
await access(input);
if (input === output) throw new Error('Input and output must be different files.');

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise({ stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString() });
      else reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString()}`));
    });
  });
}

async function probe(path) {
  const { stdout } = await run(ffprobe, [
    '-v', 'error', '-show_entries',
    'stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration,sample_rate,channels',
    '-show_entries', 'format=duration', '-of', 'json', path,
  ]);
  return JSON.parse(stdout);
}

const sourceProbe = await probe(input);
const sourceVideo = sourceProbe.streams.find((stream) => stream.codec_type === 'video');
if (!sourceVideo) throw new Error('Input file contains no video stream.');
const sourceDuration = Number(sourceVideo.duration || sourceProbe.format.duration);
if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) throw new Error('Input video has no valid duration.');
const frameCount = Math.max(2, Math.round(sourceDuration * fps));
const durationSec = frameCount / fps;
const audioInput = sourceProbe.streams.some((stream) => stream.codec_type === 'audio');
const outputDir = dirname(output);
await mkdir(outputDir, { recursive: true });
const stagingDir = await mkdtemp(join(outputDir, '.cinematic-package-'));
const stagedMovie = resolve(stagingDir, basename(output));
const frameFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}`;
const inputs = ['-i', input];
if (!audioInput) inputs.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
const audioIndex = audioInput ? '0:a:0' : '1:a:0';

try {
  await run(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error', ...inputs,
    '-map', '0:v:0', '-map', audioIndex, '-vf', frameFilter, '-af',
    `aresample=48000,apad,atrim=duration=${durationSec},asetpts=PTS-STARTPTS`,
    '-frames:v', String(frameCount), '-t', String(durationSec),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-profile:v', 'high',
    '-level:v', '4.2', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', stagedMovie,
  ]);

  const resultProbe = await probe(stagedMovie);
  const video = resultProbe.streams.find((stream) => stream.codec_type === 'video');
  const audio = resultProbe.streams.find((stream) => stream.codec_type === 'audio');
  if (!video || !audio || video.codec_name !== 'h264' || audio.codec_name !== 'aac'
      || video.width !== width || video.height !== height || video.r_frame_rate !== '60/1'
      || Number(video.nb_frames) !== frameCount || Number(audio.sample_rate) !== 48000 || audio.channels !== 2
      || Math.abs(Number(video.duration) - durationSec) > 1 / fps) {
    throw new Error(`Normalized film failed verification: ${JSON.stringify(resultProbe.streams)}`);
  }

  const cues = {
    coinSequenceStartFrame: values['coin-frame'] == null ? null : Number(values['coin-frame']),
    firstFailureFrame: values['failure-frame'] == null ? null : Number(values['failure-frame']),
    recoveryFrame: values['recovery-frame'] == null ? null : Number(values['recovery-frame']),
    stylusContactFrame: values['stylus-frame'] == null ? null : Number(values['stylus-frame']),
    musicHandoffFrame: values['handoff-frame'] == null ? frameCount - 1 : Number(values['handoff-frame']),
    firstSongCueFrame: values['song-frame'] == null ? frameCount - 1 : Number(values['song-frame']),
    finalCinematicFrame: frameCount - 1,
  };
  for (const [cue, frame] of Object.entries(cues)) {
    if (frame !== null && (!Number.isInteger(frame) || frame < 0 || frame > frameCount - 1)) {
      throw new Error(`${cue} must be a zero-based frame within 0..${frameCount - 1}.`);
    }
  }
  const openerLeadMs = Number(values['opener-lead-ms']);
  if (!Number.isFinite(openerLeadMs) || openerLeadMs < 0) throw new Error('--opener-lead-ms must be zero or greater.');

  const digest = createHash('sha256');
  for await (const chunk of createReadStream(stagedMovie)) digest.update(chunk);
  const sha256 = digest.digest('hex');
  const manifest = {
    manifestVersion: 1,
    filmKind: 'production-preview',
    filmId: values.id,
    filmVersion: Number(values.version),
    title: values.title,
    source: values.source,
    videoFile: basename(output),
    width, height, fps, frameCount, durationSec,
    videoCodec: 'h264', audioCodec: 'aac', audioSampleRate: 48000, audioChannels: 2,
    audioDescription: values['audio-description'],
    audioOwnership: {
      film: 'cinematic sound effects and atmosphere',
      openingSong: 'Praise Lifted On High remains in the jukebox audio engine',
      trackId: 'praise-lifted-on-high',
    },
    cues,
    handoff: {
      videoFrame: cues.musicHandoffFrame,
      openerTrackId: 'praise-lifted-on-high',
      openerLeadMs,
      interactiveState: 'jukebox-playing:praise-lifted-on-high',
    },
    sha256,
    generatedAt: new Date().toISOString(),
  };
  if (values['song-start'] != null) {
    // --song-start S --registration-frame N --record handoff.json: hero_groove.py writes handoff.json
    const songStartSec = Number(values['song-start']);
    const landing = JSON.parse(await readFile(resolve(values.record), 'utf8'));
    manifest.cues.musicHandoffFrame = Math.floor(songStartSec * fps);
    manifest.cues.registrationStartFrame = Number(values['registration-frame']);
    Object.assign(manifest.handoff, {
      mode: 'overlap',
      videoFrame: manifest.cues.musicHandoffFrame,
      songStartSec,
      record: { ...landing.record, cssAngleDeg: landing.cssAngleDeg, rpm: landing.rpm },
    });
    delete manifest.handoff.openerLeadMs;
    validateAwakeningFilmManifest(manifest, 'production-preview');      // throws if the music would not lock
  }

  await writeFile(resolve(stagingDir, basename(manifestPath)), `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(stagedMovie, output);
  await rename(resolve(stagingDir, basename(manifestPath)), manifestPath);
  const actualHash = createHash('sha256').update(await readFile(output)).digest('hex');
  if (actualHash !== manifest.sha256) throw new Error('Final output checksum does not match its manifest.');
  process.stdout.write(`Packaged and verified ${frameCount} frames at 1920x1080/60, H.264 + AAC.\n`);
  process.stdout.write(`MP4: ${output}\nManifest: ${manifestPath}\nSHA-256: ${sha256}\n`);
} finally {
  await rm(stagingDir, { recursive: true, force: true });
}

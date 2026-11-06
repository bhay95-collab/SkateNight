#!/usr/bin/env node
/* Build the interactive jukebox's production sound files from the owner's
   source pack (kept OUTSIDE the repository):

     node scripts/build-jukebox-sfx.mjs /path/to/SkateNight_Jukebox_SFX_SourcePack

   Writes, and is the record of how each was cut:
     sfx/jukebox/mechanics.mp3   one mono sprite of short components (changer + machine details)
     jukebox-sprite.js           where each component sits in the sprite (generated)
     sfx/jukebox/bed-machine.flac, bed-electric.flac   seamless ambience loops
     sfx/needle-drop.wav         the stylus touchdown for interactive record changes
   Components are trimmed, filtered, faded and peak-normalised here; the mix
   (who plays when, how loud) lives in jukebox-sfx.js. Needs ffmpeg. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pack = process.argv[2];
if (!pack) throw new Error('Usage: node scripts/build-jukebox-sfx.mjs /path/to/SkateNight_Jukebox_SFX_SourcePack');
const src = (dir, name) => join(resolve(pack), 'sources', dir, name);
const S1 = src('mechanical', 'MA_SoundsByGFXSounds_SteampunkMechanicalSequence_1.wav');
const S2 = src('mechanical', 'MA_SoundsByGFXSounds_SteampunkMechanicalSequence_2.wav');
const S3 = src('mechanical', 'MA_SoundsByGFXSounds_SteampunkMechanicalSequence_3.wav');
const SERVO1 = src('mechanical', 'MA_MikalaiSenkin_ComplexServoMovement_01.wav');   // ratchet servo
const SERVO2 = src('mechanical', 'MA_MikalaiSenkin_ComplexServoMovement_02.wav');   // smooth motor whine
const GEAR = src('mechanical', 'MA_MotionAudio_MechanicalGear_02.wav');             // clicks, then a heavy lock
const RATTLE = src('mechanical', 'MA_Dauzkobza_RattlingMetalGearsMechanism_1.wav');
const STEAM = src('mechanical', 'Steam Exhale 1.wav');
const WHOOSH1 = src('transitions', 'Low Whoosh Transitions _01.mp3');
const WHOOSH2 = src('transitions', 'Low Whoosh Transitions _02.mp3');
const INDUSTRIAL = src('transitions', 'MA_HotSunset_LowIndustrialWhoosh_2.wav');
const ELEC1 = src('ambience', '1. Electricity Loop (8 sec).wav');
const ELEC3 = src('ambience', '3. Electricity Loop (8 sec).wav');
const IDLE = src('ambience', 'Seamless 15-second Loop Of A Mysterious Ancient Electrical Machine Idling. De....mp3');
const SCRATCH = src('scratch', 'MA_SoundCreator_Scratch_Vinyl_1.wav');

// name: [source, start s, length s, { hp, lp, fadeIn, fadeOut }]. Times found by
// onset/envelope analysis of each recording; every component peaks at -4 dBFS.
const CLIPS = {
  // changer: motor engaging
  'motor-a': [S1, 0.10, 0.45, { fadeOut: 0.08 }],
  'motor-b': [S3, 0.18, 0.45, { fadeOut: 0.08 }],
  'motor-c': [S2, 0.12, 0.40, { fadeOut: 0.08 }],
  // carousel indexing: ratchets and gear teeth
  'index-a': [SERVO1, 0.54, 0.50, { fadeOut: 0.06 }],
  'index-b': [GEAR, 0.22, 0.50, { fadeOut: 0.06 }],
  'index-c': [RATTLE, 0.85, 0.50, { fadeIn: 0.02, fadeOut: 0.06 }],
  // carousel locking into position
  'lock-a': [GEAR, 1.76, 0.54, { fadeOut: 0.12 }],
  'lock-b': [S2, 0.97, 0.33, { fadeOut: 0.08 }],
  'lock-c': [S1, 1.82, 0.28, { fadeOut: 0.08 }],
  // small contacts: gripper, needle lift
  'tick-a': [S1, 2.20, 0.12, { fadeOut: 0.04 }],
  'tick-b': [S3, 2.21, 0.13, { fadeOut: 0.04 }],
  'tick-c': [SERVO1, 0.07, 0.10, { fadeOut: 0.04 }],
  // servos carrying the record up out of the ring and down to the platter
  'servo-a': [SERVO2, 0.40, 0.70, { fadeIn: 0.03, fadeOut: 0.10 }],
  'servo-b': [SERVO1, 1.20, 0.60, { fadeIn: 0.02, fadeOut: 0.10 }],
  'servo-c': [S2, 1.50, 0.55, { fadeIn: 0.02, fadeOut: 0.10 }],
  // the record settling on the platter
  'drop-a': [S3, 0.31, 0.29, { fadeOut: 0.10 }],
  'drop-b': [S1, 1.10, 0.35, { fadeOut: 0.10 }],
  // the tonearm swinging across
  'arm-a': [SERVO2, 0.85, 0.45, { fadeIn: 0.03, fadeOut: 0.10, hp: 300 }],
  'arm-b': [SERVO1, 1.85, 0.25, { fadeOut: 0.08, hp: 300 }],
  // eject: the record seating back in the ring, the sleeve returning to the rack
  'seat-a': [S1, 1.50, 0.25, { fadeOut: 0.08 }],
  'seat-b': [S3, 2.78, 0.27, { fadeOut: 0.08 }],
  'slide-a': [WHOOSH2, 0.45, 0.85, { fadeIn: 0.05, fadeOut: 0.25, hp: 60 }],
  'slide-b': [WHOOSH1, 0.75, 0.80, { fadeIn: 0.05, fadeOut: 0.25, hp: 60 }],
  // the living machine: distant details
  'far-rattle-a': [RATTLE, 1.60, 1.20, { fadeIn: 0.15, fadeOut: 0.40 }],
  'far-rattle-b': [RATTLE, 3.60, 1.30, { fadeIn: 0.15, fadeOut: 0.40 }],
  'far-servo-a': [SERVO1, 0.90, 0.80, { fadeIn: 0.05, fadeOut: 0.20 }],
  'far-servo-b': [SERVO2, 0.35, 1.00, { fadeIn: 0.05, fadeOut: 0.30 }],
  'spark-a': [ELEC3, 1.40, 0.40, { fadeOut: 0.10, hp: 400 }],
  'spark-b': [ELEC3, 5.55, 0.40, { fadeOut: 0.10, hp: 400 }],
  'spark-c': [ELEC3, 0.62, 0.33, { fadeOut: 0.10, hp: 400 }],
  'steam-a': [STEAM, 0.20, 2.00, { fadeIn: 0.30, fadeOut: 0.80, lp: 7000 }],
  'move-a': [INDUSTRIAL, 0.35, 2.20, { fadeIn: 0.20, fadeOut: 0.80, hp: 35 }],
  'move-b': [WHOOSH1, 0.60, 1.30, { fadeIn: 0.20, fadeOut: 0.50, hp: 35 }],
  'relay-a': [GEAR, 1.03, 0.19, { fadeOut: 0.05 }],
  'relay-b': [S2, 2.28, 0.12, { fadeOut: 0.04 }],
  'clunk-a': [S2, 0.88, 0.42, { fadeOut: 0.12 }],
};
const SPRITE_RATE = 44100;
const PAD = 0.12;              // silence round each component: codec delay can never cut one
const PEAK = 10 ** (-4 / 20);

function decode(file, rate, { hp, lp } = {}) {
  const filters = [hp && `highpass=f=${hp}`, lp && `lowpass=f=${lp}`].filter(Boolean);
  const out = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', String(rate),
    ...(filters.length ? ['-af', filters.join(',')] : []), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(out.buffer, out.byteOffset, out.length / 4);
}
const peakOf = (x) => x.reduce((p, v) => Math.max(p, Math.abs(v)), 0);
const rmsOf = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
function fade(x, rate, fadeIn = 0.004, fadeOut = 0.02) {
  const a = Math.max(1, Math.round(fadeIn * rate)), b = Math.max(1, Math.round(fadeOut * rate));
  for (let i = 0; i < a; i++) x[i] *= Math.sin((Math.PI / 2) * (i / a));
  for (let i = 0; i < b; i++) x[x.length - 1 - i] *= Math.sin((Math.PI / 2) * (i / b));
  return x;
}
function writeAudio(samples, rate, path, codecArgs) {
  const dir = mkdtempSync(join(tmpdir(), 'jukebox-sfx-'));
  try {
    const raw = join(dir, 'in.f32');
    writeFileSync(raw, Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(rate), '-ac', '1', '-i', raw,
      ...codecArgs, '-map_metadata', '-1', path]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// 1. The sprite of short components.
const pieces = [];
const sprite = [];
let cursor = PAD;
for (const [name, [file, start, length, opt = {}]] of Object.entries(CLIPS)) {
  const all = decode(file, SPRITE_RATE, opt);
  const clip = all.slice(Math.round(start * SPRITE_RATE), Math.round((start + length) * SPRITE_RATE));
  if (clip.length < length * SPRITE_RATE * 0.99) throw new Error(`${name} runs past the end of its recording`);
  fade(clip, SPRITE_RATE, opt.fadeIn, opt.fadeOut);
  const gain = PEAK / peakOf(clip);
  pieces.push(clip.map((v) => v * gain));
  sprite.push([name, +cursor.toFixed(4), +(clip.length / SPRITE_RATE).toFixed(4)]);
  cursor += clip.length / SPRITE_RATE + 2 * PAD;
}
const total = new Float32Array(Math.ceil(cursor * SPRITE_RATE));
pieces.forEach((clip, i) => total.set(clip, Math.round(sprite[i][1] * SPRITE_RATE)));
writeAudio(total, SPRITE_RATE, join(root, 'sfx/jukebox/mechanics.mp3'), ['-c:a', 'libmp3lame', '-b:a', '96k']);
writeFileSync(join(root, 'jukebox-sprite.js'), `/* Generated by scripts/build-jukebox-sfx.mjs - do not edit.
   Where each component sits in sfx/jukebox/mechanics.mp3: [start s, length s]. */
export const SPRITE = Object.freeze({
${sprite.map(([n, s, d]) => `  '${n}': [${s}, ${d}],`).join('\n')}
});
`);

// 2. Seamless beds: an equal-power crossfade folds each loop's tail into its head.
function loop(file, rate, start, length, overlap, opt) {
  const all = decode(file, rate, opt);
  const a = Math.round(start * rate), n = Math.round(length * rate), x = Math.round(overlap * rate);
  const seg = all.slice(a, a + n + x);
  if (seg.length < n + x) throw new Error(`${file} is too short for this loop`);
  const out = seg.slice(0, n);
  for (let i = 0; i < x; i++) {
    const t = (i + 0.5) / x;
    out[i] = seg[i] * Math.sin((Math.PI / 2) * t) + seg[n + i] * Math.cos((Math.PI / 2) * t);
  }
  const gain = 10 ** (-20 / 20) / rmsOf(out);          // each bed at -20 dBFS RMS; jukebox-sfx.js sets its level
  return out.map((v) => v * gain);
}
const flac = ['-c:a', 'flac', '-sample_fmt', 's16', '-compression_level', '12'];
writeAudio(loop(IDLE, 24000, 0.5, 8.0, 1.0, { hp: 30, lp: 5000 }), 24000, join(root, 'sfx/jukebox/bed-machine.flac'), flac);
writeAudio(loop(ELEC1, 32000, 0.25, 7.0, 1.0, { hp: 120, lp: 7000 }), 32000, join(root, 'sfx/jukebox/bed-electric.flac'), flac);

// 3. The needle drop: the contact, a short textured scrape, a natural decay into the surface.
{
  const rate = 44100;
  const all = decode(SCRATCH, rate, { hp: 180, lp: 9000 });
  const n = Math.round(0.32 * rate), from = Math.round(0.02 * rate);
  const x = all.slice(from, from + n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    x[i] *= t < 0.045 ? 1 : Math.exp(-(t - 0.045) / 0.075);   // brief scrape, then it settles
  }
  fade(x, rate, 0.002, 0.03);
  const gain = 10 ** (-13 / 20) / peakOf(x);
  writeAudio(x.map((v) => v * gain), rate, join(root, 'sfx/needle-drop.wav'), ['-c:a', 'pcm_s16le']);
}

for (const f of ['sfx/jukebox/mechanics.mp3', 'sfx/jukebox/bed-machine.flac', 'sfx/jukebox/bed-electric.flac', 'sfx/needle-drop.wav']) {
  process.stdout.write(`${f}: ${(statSync(join(root, f)).size / 1024).toFixed(0)} KiB\n`);
}
process.stdout.write(`sprite: ${sprite.length} components, ${cursor.toFixed(1)} s\n`);

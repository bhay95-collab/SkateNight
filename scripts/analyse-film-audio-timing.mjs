#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { songClockAlignment } from './film-continuity.mjs';
import { validateAwakeningFilmManifest } from '../awakening-film.js';

// Match the opener's first transient instead of mistaking vinyl noise for onset.
export function matchPcm(reference, observed, sampleRate) {
  const start = Math.round(0.10 * sampleRate);
  const length = Math.round(0.35 * sampleRate);
  const minimum = -Math.round(0.08 * sampleRate);
  const maximum = Math.min(Math.round(0.30 * sampleRate), observed.length - start - length);
  const prefix = (samples) => {
    const sums = new Float64Array(samples.length + 1);
    for (let i = 0; i < samples.length; i++) sums[i + 1] = sums[i] + samples[i];
    return sums;
  };
  const referenceSums = prefix(reference), observedSums = prefix(observed);
  function score(lag, stride) {
    let dot = 0, xx = 0, yy = 0;
    for (let i = 0; i < length; i += stride) {
      // Average coarse windows before decimating, so a sub-window delay does
      // not alias a narrow transient completely out of the initial search.
      const x = stride === 16 ? (referenceSums[start + i + 16] - referenceSums[start + i]) / 16 : reference[start + i];
      const y = stride === 16 ? (observedSums[start + lag + i + 16] - observedSums[start + lag + i]) / 16 : observed[start + lag + i];
      dot += x * y; xx += x * x; yy += y * y;
    }
    return xx && yy ? dot / Math.sqrt(xx * yy) : -1;
  }
  let lagFrames = minimum, correlation = -1;
  for (let lag = minimum; lag <= maximum; lag += 16) {
    const value = score(lag, 16);
    if (value > correlation) { lagFrames = lag; correlation = value; }
  }
  const coarse = lagFrames;
  correlation = -1;
  for (let lag = Math.max(minimum, coarse - 32); lag <= Math.min(maximum, coarse + 32); lag++) {
    const value = score(lag, 2);
    if (value > correlation) { lagFrames = lag; correlation = value; }
  }
  return { lagFrames, delaySec: lagFrames / sampleRate, correlation };
}

const floatSamples = (buffer) => new Float32Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2;
};

export function timingDistribution(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { count: 0 };
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  return { count: finite.length, min: Math.min(...finite), median: median(finite), max: Math.max(...finite), mean,
    populationStdDev: Math.sqrt(finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length) };
}

export function pcmTimingAcceptance(rows, fps) {
  const qualityIssues = [], timingFailures = [];
  const frameMs = Number.isFinite(fps) && fps > 0 ? 1000 / fps : null;
  if (frameMs === null) qualityIssues.push('Frame rate must be finite and positive.');
  if (rows.length !== 10) qualityIssues.push(`Expected ten captured runs; found ${rows.length}.`);
  if (new Set(rows.map((row) => row.case)).size !== rows.length) qualityIssues.push('Duplicate run identifiers.');
  for (const row of rows) {
    if (row.error) { qualityIssues.push(`${row.case}: ${row.error}`); continue; }
    for (const channel of ['music', 'output']) {
      const match = row[channel];
      if (!match || !Number.isFinite(match.correlation) || match.correlation < 0.95) {
        qualityIssues.push(`${row.case}: weak or missing ${channel} PCM match.`);
        continue;
      }
      const timestamp = match.outputTimestamp;
      if (![match.contactErrorMs, match.hitContextSec, match.hitPerformanceMs,
        timestamp?.outputContextTime, timestamp?.outputPerformanceTime].every(Number.isFinite)
        || !(timestamp.outputContextTime > 0) || !(timestamp.outputPerformanceTime > 0)
        || Math.abs(match.hitContextSec - timestamp.outputContextTime) > 0.1) {
        qualityIssues.push(`${row.case}: missing, non-finite or distant ${channel} output timestamp.`);
      }
    }
    if (!Number.isFinite(row.measuredLimiterDelayMs) || Math.abs(row.measuredLimiterDelayMs - 6) > 2000 / 48000) {
      qualityIssues.push(`${row.case}: pre/post-limiter matches do not confirm the six millisecond path.`);
    }
    if (!Number.isFinite(row.output?.contactErrorMs) || (frameMs !== null && Math.abs(row.output.contactErrorMs) > frameMs)) {
      timingFailures.push(`${row.case}: output PCM contact error ${row.output?.contactErrorMs} ms.`);
    }
  }
  return { expectedRuns: 10, observedRuns: rows.length, minimumCorrelation: 0.95,
    maximumTimestampExtrapolationSec: 0.1, maximumContactErrorMs: frameMs,
    conclusive: qualityIssues.length === 0, passed: qualityIssues.length === 0 && timingFailures.length === 0,
    qualityIssues, timingFailures };
}

async function main() {
  const folder = resolve(process.argv[2]);
  const names = (await readdir(folder)).filter((name) => name.endsWith('-samples.json')).sort();
  const manifestPath = resolve(process.argv[3] || 'build/awakening-35-production/final-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4.json');
  const manifest = JSON.parse(await readFile(manifestPath));
  validateAwakeningFilmManifest(manifest, 'production-preview');
  if (manifest.fps !== 30) throw new Error('PCM batch analysis requires the supported native30 preview contract.');
  const source = fileURLToPath(new URL('../audio/praise-lifted-on-high.mp3', import.meta.url));
  const referenceBytes = execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-i', source,
    '-t', '0.8', '-ar', '48000', '-ac', '1', '-f', 'f32le', '-'], { maxBuffer: 1024 * 1024 });
  const reference = floatSamples(referenceBytes);
  await writeFile(resolve(folder, 'reference-opener-48000-mono.f32le'), referenceBytes);
  const rows = [];
  for (const name of names) {
    try {
    const proof = JSON.parse(await readFile(resolve(folder, name)));
    const capture = proof.pcmCapture;
    if (!capture) throw new Error('No PCM probe capture.');
    if (capture.sampleRate !== 48000) throw new Error('Reference and capture sample rates differ.');
    const clocks = proof.samples.filter((s) => s.audioClock?.outputContextTime > 0);
    const contact = proof.frames.find(([, time]) => Math.abs(time - manifest.cues.stylusContactFrame / manifest.fps) < 0.001);
    const match = {};
    for (const channel of ['music', 'output']) {
      const observed = floatSamples(await readFile(resolve(folder, capture[`${channel}File`])));
      const result = matchPcm(reference, observed, capture.sampleRate);
      const zeroContextSec = capture.contextStartSec + result.delaySec;
      const hitContextSec = zeroContextSec + 0.207;
      const closest = clocks.reduce((a, b) => Math.abs(a.audioClock.outputContextTime - hitContextSec)
        < Math.abs(b.audioClock.outputContextTime - hitContextSec) ? a : b);
      const timestamp = closest.audioClock;
      const hitPerformanceMs = timestamp.outputPerformanceTime + (hitContextSec - timestamp.outputContextTime) * 1000;
      match[channel] = { ...result, zeroContextSec, hitContextSec, hitPerformanceMs,
        contactErrorMs: hitPerformanceMs - contact[0], outputTimestamp: timestamp };
    }
    const cue = proof.cueEvents.find((event) => event.at > manifest.handoff.songStartSec - 0.5 && event.at < manifest.handoff.songStartSec);
    const target = cue.expectedDisplayTime + (manifest.handoff.songStartSec - cue.mediaTime) * 1000;
    const audioEvents = proof.mediaEvents.filter((event) => event.tag === 'AUDIO');
    const called = audioEvents.find((event) => event.event === 'play-called');
    const playing = audioEvents.find((event) => event.event === 'playing');
    const alignment = songClockAlignment(proof, manifest);
    rows.push({ case: name.replace('-samples.json', ''), alignment, cueSource: cue.source,
      callbackToExpectedDisplayMs: cue.expectedDisplayTime - cue.observedAt,
      gateEpochErrorMs: proof.stats.songGateOpenedMs - (target + proof.stats.songOffsetMs),
      gateToPlayCallMs: called.wall - proof.stats.songGateOpenedMs,
      playToPlayingMs: playing.wall - called.wall,
      baseLatencyMs: median(clocks.map((s) => s.audioClock.baseLatency)) * 1000,
      outputLatencyMs: median(clocks.map((s) => s.audioClock.outputLatency)) * 1000,
      measuredLimiterDelayMs: (match.output.zeroContextSec - match.music.zeroContextSec) * 1000,
      music: match.music, output: match.output });
    } catch (error) {
      rows.push({ case: name.replace('-samples.json', ''), error: error.message });
    }
  }
  const acceptance = pcmTimingAcceptance(rows, manifest.fps);
  const distributions = {
    mediaEstimateMs: timingDistribution(rows.map((row) => row.alignment?.estimatedAudibleStartErrorMs)),
    presentedEstimateMs: timingDistribution(rows.map((row) => row.alignment?.presentedEstimatedAudibleStartErrorMs)),
    postLimiterPcmContactErrorMs: timingDistribution(rows.map((row) => row.output?.contactErrorMs)),
    gateEpochErrorMs: timingDistribution(rows.map((row) => row.gateEpochErrorMs)),
  };
  await writeFile(resolve(folder, 'pcm-audio-timing.json'), JSON.stringify({
    method: 'Matched decoded opener PCM; post-limiter context sample mapped through nearest getOutputTimestamp pair; no latency added twice',
    analysisSha256: createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex'),
    reference: 'reference-opener-48000-mono.f32le', referenceWindowSec: [0.10, 0.45],
    acceptance, distributions, rows,
  }, null, 2) + '\n');
  console.table(rows.map((row) => ({ case: row.case, media: row.alignment?.estimatedAudibleStartErrorMs,
    presented: row.alignment?.presentedEstimatedAudibleStartErrorMs, pcm: row.output?.contactErrorMs,
    correlation: row.output?.correlation, epoch: row.gateEpochErrorMs, playMs: row.playToPlayingMs,
    limiterMs: row.measuredLimiterDelayMs, error: row.error })));
  console.log(JSON.stringify({ acceptance, distributions }, null, 2));
  if (!acceptance.passed) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

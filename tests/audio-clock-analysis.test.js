import test from 'node:test';
import assert from 'node:assert/strict';
import { matchPcm, pcmTimingAcceptance, timingDistribution } from '../scripts/analyse-film-audio-timing.mjs';

test('PCM matching recovers a known delay despite gain and a quiet second signal', () => {
  const rate = 48000, source = new Float32Array(rate), observed = new Float32Array(rate);
  let seed = 17;
  for (let i = 0; i < rate; i++) {
    seed = (seed * 16807) % 2147483647;
    const envelope = i > rate * 0.18 && i < rate * 0.6 ? Math.sin(i / 4000) ** 2 : 0;
    source[i] = (seed / 2147483647 - 0.5) * envelope;
  }
  const delay = 1500;
  for (let i = delay; i < rate; i++) observed[i] = source[i - delay] * 0.49 + Math.sin(i / 123) * 0.0001;
  const result = matchPcm(source, observed, rate);
  assert.equal(result.lagFrames, delay);
  assert.ok(result.correlation > 0.999);
  const limited = new Float32Array(rate);
  const limiterDelay = 288;
  for (let i = limiterDelay; i < rate; i++) limited[i] = observed[i - limiterDelay];
  assert.equal(matchPcm(source, limited, rate).lagFrames - result.lagFrames, limiterDelay);
});

function validRows() {
  return Array.from({ length: 10 }, (_, index) => ({ case: `run-${index}`, measuredLimiterDelayMs: 6,
    music: { correlation: 0.999, contactErrorMs: 0, hitContextSec: 31.6, hitPerformanceMs: 32000,
      outputTimestamp: { outputContextTime: 31.59, outputPerformanceTime: 31990 } },
    output: { correlation: 0.997, contactErrorMs: index - 5, hitContextSec: 31.606, hitPerformanceMs: 32006,
      outputTimestamp: { outputContextTime: 31.60, outputPerformanceTime: 32000 } } }));
}

test('PCM acceptance requires ten strong, finite, locally mapped independent captures', () => {
  assert.equal(pcmTimingAcceptance(validRows(), 30).passed, true);
  assert.equal(pcmTimingAcceptance(validRows().slice(1), 30).conclusive, false);
  for (const fps of [0, -30, NaN, Infinity, '30']) {
    assert.equal(pcmTimingAcceptance(validRows(), fps).conclusive, false);
    assert.equal(pcmTimingAcceptance(validRows(), fps).passed, false);
  }
  for (const invalidate of [
    (rows) => { rows[2].error = 'No PCM probe capture'; },
    (rows) => { rows[2].output.correlation = 0.8; },
    (rows) => { rows[2].music.contactErrorMs = NaN; },
    (rows) => { rows[2].output.outputTimestamp.outputContextTime = 30; },
    (rows) => { rows[2].measuredLimiterDelayMs = 14; },
  ]) {
    const rows = validRows(); invalidate(rows);
    const result = pcmTimingAcceptance(rows, 30);
    assert.equal(result.conclusive, false);
    assert.equal(result.passed, false);
  }
});

test('a conclusive PCM measurement still fails when contact exceeds one native frame', () => {
  const rows = validRows(); rows[4].output.contactErrorMs = 40;
  const result = pcmTimingAcceptance(rows, 30);
  assert.equal(result.conclusive, true);
  assert.equal(result.passed, false);
  assert.equal(result.timingFailures.length, 1);
  assert.deepEqual(timingDistribution([3, 1, 4, 2]), { count: 4, min: 1, median: 2.5, max: 4, mean: 2.5,
    populationStdDev: Math.sqrt(1.25) });
});

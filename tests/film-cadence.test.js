import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseFilmCadence } from '../scripts/analyse-film-cadence.mjs';

const frame = (n, wall, { submitted = wall - 12, callback = wall - 10, counter = n } = {}) =>
  [wall, n / 30, { presentationTime: submitted, observedAt: callback, presentedFrames: counter }];
const inspect = (frames) => analyseFilmCadence({ frames }, { contactFrame: 0, registrationStartFrame: 1, finalFrame: 2 });
test('a consecutive submission/presentation hold is separate from callback omissions', () => {
  const held = inspect([frame(0, 100), frame(1, 100 + 1000 / 30), frame(2, 200)]);
  assert.equal(held.overlap.counts['consecutive-picture-submission-hold'], 1);
  assert.equal(held.registration.findings[0].fromFrame, 1);
  const missed = inspect([frame(0, 100), frame(2, 100 + 2000 / 30)]);
  assert.equal(missed.overlap.counts['unobserved-intermediate-frame'], 1);
  assert.equal(missed.overlap.counts['consecutive-picture-submission-hold'], undefined);
  assert.equal(missed.conclusiveMetadata, false);
});
test('late callback delivery does not imply a picture hold', () => {
  const r = inspect([frame(0, 100), frame(1, 100 + 1000 / 30), frame(2, 100 + 2000 / 30, { callback: 210 })]);
  assert.equal(r.overlap.counts['callback-only-delay'], 1);
  assert.equal(r.overlap.counts['consecutive-picture-submission-hold'], undefined);
});
test('expected display clock changes are distinct from delayed submission', () => {
  const r = inspect([frame(0, 100), frame(1, 100 + 1000 / 30), frame(2, 200, { submitted: 100 + 2000 / 30 - 12 })]);
  assert.equal(r.overlap.counts['expected-display-clock-step'], 1);
  assert.equal(r.overlap.counts['consecutive-picture-submission-hold'], undefined);
});
test('the final ended-frame crossfade is outside the presentation window', () => {
  const r = inspect([frame(0, 100), frame(1, 100 + 1000 / 30), frame(2, 100 + 2000 / 30), frame(3, 300)]);
  assert.equal(r.conclusiveMetadata, true);
  assert.equal(r.overlap.transitionCount, 2);
  assert.equal(r.registration.sampleCount, 2);
  assert.deepEqual(r.overlap.findings, []);
});
test('missing submission metadata remains inconclusive', () => {
  const r = inspect([frame(0, 100), [100 + 1000 / 30, 1 / 30, {}], frame(2, 100 + 2000 / 30)]);
  assert.equal(r.conclusiveMetadata, false);
  assert.equal(r.qualityIssues.length, 2);
});

test('a skipped media sample differs from a missed callback', () => {
  const r = inspect([frame(0, 100), frame(2, 100 + 2000 / 30, { counter: 1 })]);
  assert.equal(r.overlap.counts['skipped-media-sample'], 1);
  assert.equal(r.overlap.counts['consecutive-picture-submission-hold'], undefined);
});
test('submission delay alone is retained without claiming an expected display hold', () => {
  const r = inspect([frame(0, 100), frame(1, 100 + 1000 / 30), frame(2, 100 + 2000 / 30, { submitted: 190 })]);
  assert.equal(r.overlap.counts['submission-delay-without-expected-display-hold'], 1);
});
test('invalid film clocks are rejected', () => {
  assert.throws(() => analyseFilmCadence({ frames: [] }, { fps: Infinity }), /Invalid native/);
  assert.throws(() => analyseFilmCadence({ frames: [] }, { contactFrame: 1050 }), /Invalid native/);
});

test('finite backwards display/submission clocks remain explicitly inconclusive', () => {
  const r = inspect([frame(0, 100), frame(1, 80), frame(2, 60)]);
  assert.equal(r.conclusiveMetadata, false);
  assert.equal(r.overlap.counts['nonmonotonic-clock-metadata'], 2);
  assert.equal(r.overlap.counts.normal, undefined);
  assert.equal(r.qualityIssues.length, 2);
});
test('an interior callback omission prevents a whole-cadence conclusion despite observed boundaries', () => {
  const r = analyseFilmCadence({ frames: [frame(0, 100), frame(2, 100 + 2000 / 30),
    frame(3, 200), frame(4, 100 + 4000 / 30)] },
  { contactFrame: 0, registrationStartFrame: 3, finalFrame: 4 });
  assert.equal(r.overlap.firstSamplePresent, true);
  assert.equal(r.registration.firstSamplePresent, true);
  assert.equal(r.overlap.finalSamplePresent, true);
  assert.equal(r.conclusiveMetadata, false);
  assert.equal(r.overlap.counts['unobserved-intermediate-frame'], 1);
  assert.deepEqual(r.registration.findings, []);
});

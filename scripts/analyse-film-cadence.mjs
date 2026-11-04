#!/usr/bin/env node
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// RVFC describes compositor submission and expected presentation, not physical
// display scanout. A missed callback cannot establish an intermediate hold.
export function analyseFilmCadence(proof, { fps = 30, contactFrame = 948,
  registrationStartFrame = 1028, finalFrame = 1049 } = {}) {
  if (!Number.isFinite(fps) || !(fps > 0) || ![contactFrame, registrationStartFrame, finalFrame].every(Number.isInteger)
      || contactFrame > registrationStartFrame || registrationStartFrame > finalFrame) {
    throw new Error('Invalid native film window.');
  }
  const periodMs = 1000 / fps;
  // Retained timestamps are rounded to 0.1 ms. Allow 1 ms of timestamp
  // precision at the two-period boundary; the PCM tolerance is unrelated.
  const precisionMs = 1;
  const twoPeriodCutoffMs = 2 * periodMs - precisionMs;
  const frames = proof.frames;
  if (!Array.isArray(frames)) throw new Error('Missing RVFC frames.');
  const qualityIssues = [], transitions = [];
  const inWindow = (row, first) => Number.isFinite(row?.[1])
    && row[1] >= first / fps - 0.00001 && row[1] <= finalFrame / fps + 0.00001;
  const rows = frames.filter((row) => inWindow(row, contactFrame));
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i], am = a[2] || {}, bm = b[2] || {};
    const values = [a[0], b[0], a[1], b[1], am.presentationTime, bm.presentationTime,
      am.presentedFrames, bm.presentedFrames];
    if (!values.every(Number.isFinite)) {
      qualityIssues.push(`Missing/non-finite submission metadata near ${b[1]} s.`);
      continue;
    }
    const ptsDeltaMs = (b[1] - a[1]) * 1000;
    const mediaStepFrames = ptsDeltaMs / periodMs;
    const counterStep = bm.presentedFrames - am.presentedFrames;
    const expectedDisplayDeltaMs = b[0] - a[0];
    const submissionDeltaMs = bm.presentationTime - am.presentationTime;
    const callbackA = am.observedAt ?? am.callbackNow;
    const callbackB = bm.observedAt ?? bm.callbackNow;
    const callbackDeltaMs = Number.isFinite(callbackA) && Number.isFinite(callbackB)
      ? callbackB - callbackA : null;
    const consecutive = Math.abs(mediaStepFrames - 1) < 0.001 && counterStep === 1;
    const expectedHold = expectedDisplayDeltaMs >= twoPeriodCutoffMs;
    const submittedHold = submissionDeltaMs >= twoPeriodCutoffMs;
    let classification = 'normal';
    if (ptsDeltaMs <= 0 || counterStep <= 0 || expectedDisplayDeltaMs <= 0 || submissionDeltaMs <= 0) {
      classification = 'nonmonotonic-clock-metadata';
      qualityIssues.push(`Clock/counter reset or non-increasing timestamps near ${b[1]} s.`);
    } else if (mediaStepFrames > 1.001 && counterStep === 1) classification = 'skipped-media-sample';
    else if (counterStep > 1) classification = 'unobserved-intermediate-frame';
    else if (!consecutive) classification = 'nonconsecutive-media-metadata';
    else if (expectedHold && submittedHold) classification = 'consecutive-picture-submission-hold';
    else if (expectedHold) classification = 'expected-display-clock-step';
    else if (submittedHold) classification = 'submission-delay-without-expected-display-hold';
    else if (callbackDeltaMs >= twoPeriodCutoffMs) classification = 'callback-only-delay';
    if (classification === 'unobserved-intermediate-frame') {
      qualityIssues.push(`Intermediate presentation was not observed near ${b[1]} s.`);
    }
    transitions.push({ fromFrame: Math.round(a[1] * fps), toFrame: Math.round(b[1] * fps),
      fromSec: a[1], toSec: b[1], mediaStepFrames, counterStep,
      ptsDeltaMs, expectedDisplayDeltaMs, submissionDeltaMs, callbackDeltaMs,
      displayEpochDeltaMs: expectedDisplayDeltaMs - ptsDeltaMs,
      submissionEpochDeltaMs: submissionDeltaMs - ptsDeltaMs, classification });
  }
  function windowReport(first) {
    const samples = rows.filter((row) => inWindow(row, first));
    const selected = transitions.filter((row) => row.fromFrame >= first && row.toFrame <= finalFrame);
    const counts = {};
    for (const row of selected) counts[row.classification] = (counts[row.classification] || 0) + 1;
    return { firstFrame: first, finalFrame, sampleCount: samples.length,
      firstSamplePresent: samples.some((row) => Math.abs(row[1] * fps - first) < 0.001),
      finalSamplePresent: samples.some((row) => Math.abs(row[1] * fps - finalFrame) < 0.001),
      transitionCount: selected.length,
      maxExpectedDisplayDeltaMs: selected.length ? Math.max(...selected.map((row) => row.expectedDisplayDeltaMs)) : null,
      maxSubmissionDeltaMs: selected.length ? Math.max(...selected.map((row) => row.submissionDeltaMs)) : null,
      counts, findings: selected.filter((row) => row.classification !== 'normal') };
  }
  const overlap = windowReport(contactFrame), registration = windowReport(registrationStartFrame);
  if (!overlap.firstSamplePresent || !overlap.finalSamplePresent) qualityIssues.push('Contact or final sample was not observed.');
  if (!registration.firstSamplePresent) qualityIssues.push('First registration sample was not observed.');
  return { fps, periodMs, timestampPrecisionAllowanceMs: precisionMs, twoPeriodCutoffMs,
    measurement: 'RVFC compositor submission and expected display; physical scanout is not measured.',
    conclusiveMetadata: qualityIssues.length === 0, qualityIssues, overlap, registration };
}

async function main() {
  const folder = resolve(process.argv[2]);
  const paths = (await readdir(folder)).filter((name) => name.endsWith('-samples.json')).sort();
  if (!paths.length) throw new Error('No retained *-samples.json captures.');
  const reports = [];
  for (const name of paths) reports.push({ case: name.replace('-samples.json', ''),
    ...analyseFilmCadence(JSON.parse(await readFile(resolve(folder, name)))) });
  const output = { reports, notes: [
    'Consecutive-picture holds require one PTS step, one submitted-frame counter step, and both submission/expected intervals of at least two native periods (within timestamp precision).',
    'Counter/PTS gaps leave intermediate presentation unobserved; they do not prove a held picture.',
    'The ended-film opacity crossfade is outside the contact-to-final-sample window.',
    'This report does not replace PCM timing or source pixel/encoded timestamp inspection.',
  ] };
  await writeFile(resolve(folder, 'film-cadence.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(reports.map(({ case: label, conclusiveMetadata, overlap, registration }) => ({
    case: label, conclusiveMetadata, overlap: overlap.counts, registration: registration.counts })), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();

import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, formatCountdown, clamp, perceptualVolume } from '../format.js';

test('formatClock gives mm:ss for LED digits', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(7.9), '00:07');
  assert.equal(formatClock(65), '01:05');
  assert.equal(formatClock(3599), '59:59');
  assert.equal(formatClock(3600), '60:00');
});

test('formatClock shows dashes for unknown lengths', () => {
  assert.equal(formatClock(NaN), '--:--');
  assert.equal(formatClock(undefined), '--:--');
  assert.equal(formatClock(Infinity), '--:--');
  assert.equal(formatClock(-3), '00:00');
});

test('formatCountdown counts down from the total', () => {
  assert.equal(formatCountdown(0, 200), '-03:20');
  assert.equal(formatCountdown(195, 200), '-00:05');
  assert.equal(formatCountdown(250, 200), '-00:00');
  assert.equal(formatCountdown(10, NaN), '--:--');
});

test('clamp keeps numbers in range', () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-5, 0, 1), 0);
  assert.equal(clamp(0.4, 0, 1), 0.4);
});

test('perceptualVolume maps the slider to a gentler gain curve', () => {
  assert.equal(perceptualVolume(0), 0);
  assert.equal(perceptualVolume(1), 1);
  assert.ok(perceptualVolume(0.5) < 0.5);
  assert.equal(perceptualVolume(2), 1);
  assert.equal(perceptualVolume(-1), 0);
});

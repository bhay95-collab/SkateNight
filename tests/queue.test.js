import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_QUEUE, enqueue, cancelAt, moveUp, takeNext, dropIds } from '../queue.js';

test('enqueue is first-in first-out and never mutates the old queue', () => {
  const q0 = [];
  const r1 = enqueue(q0, 'a');
  const r2 = enqueue(r1.queue, 'b');
  assert.deepEqual(q0, []);
  assert.deepEqual(r1.queue, ['a']);
  assert.deepEqual(r2.queue, ['a', 'b']);
  assert.equal(r2.ok, true);
});

test('the same song cannot be queued twice at once', () => {
  const r = enqueue(['a', 'b'], 'a');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'duplicate');
  assert.deepEqual(r.queue, ['a', 'b']);
});

test('the queue has a ceiling so a stuck key cannot run away', () => {
  const full = Array.from({ length: MAX_QUEUE }, (_, i) => `t${i}`);
  const r = enqueue(full, 'extra');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'full');
  assert.equal(r.queue.length, MAX_QUEUE);
});

test('takeNext returns the head and the rest', () => {
  assert.deepEqual(takeNext(['a', 'b', 'c']), { next: 'a', queue: ['b', 'c'] });
  assert.deepEqual(takeNext([]), { next: null, queue: [] });
});

test('cancelAt removes exactly one entry and ignores bad indexes', () => {
  assert.deepEqual(cancelAt(['a', 'b', 'c'], 1), ['a', 'c']);
  assert.deepEqual(cancelAt(['a', 'b'], 5), ['a', 'b']);
  assert.deepEqual(cancelAt(['a', 'b'], -1), ['a', 'b']);
});

test('moveUp swaps with the entry above; the top stays put', () => {
  assert.deepEqual(moveUp(['a', 'b', 'c'], 2), ['a', 'c', 'b']);
  assert.deepEqual(moveUp(['a', 'b', 'c'], 1), ['b', 'a', 'c']);
  assert.deepEqual(moveUp(['a', 'b', 'c'], 0), ['a', 'b', 'c']);
  assert.deepEqual(moveUp(['a', 'b', 'c'], 9), ['a', 'b', 'c']);
});

test('dropIds removes tracks that turned out to be unplayable', () => {
  assert.deepEqual(dropIds(['a', 'b', 'c'], ['b']), ['a', 'c']);
  assert.deepEqual(dropIds(['a'], []), ['a']);
});

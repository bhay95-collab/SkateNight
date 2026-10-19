import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLibrary } from '../codes.js';
import { selectionState, queueFocusTarget } from '../ui.js';

const library = buildLibrary(
  [{ id: 'album', title: 'The Record', accent: 'gold' }],
  [
    { id: 'first', title: 'First Song', volume: 'album', file: 'first.mp3' },
    { id: 'second', title: 'Second Song', volume: 'album', file: 'second.mp3' },
  ],
);

test('selection guidance follows letter, number and confirmation without accepting a request', () => {
  assert.match(selectionState(library, '').hint, /LETTER/);
  assert.equal(selectionState(library, 'A').preview, 'The Record');
  assert.match(selectionState(library, 'A').hint, /TRACK NUMBER/);
  const complete = selectionState(library, 'A1');
  assert.equal(complete.track.id, 'first');
  assert.equal(complete.ready, true);
  assert.equal(complete.preview, 'A1 · First Song');
  assert.match(complete.hint, /SELECT OR ENTER/);
  assert.equal(selectionState(library, 'A01').track.id, 'first', 'preview resolves the same leading-zero codes as submission');
});

test('invalid and out-of-order selections explain the next useful action', () => {
  const invalid = selectionState(library, 'A9');
  assert.equal(invalid.track, null);
  assert.equal(invalid.ready, false);
  assert.match(invalid.hint, /NO SONG A9/);
  const missing = selectionState(library, 'A2', (id) => ({ state: id === 'second' ? 'missing' : 'ok' }));
  assert.equal(missing.track.id, 'second');
  assert.equal(missing.ready, false);
  assert.match(missing.hint, /OUT OF ORDER/);
});

test('moving a request keeps focus on its action, including requests beyond the preview limit', () => {
  const queue = Array.from({ length: 30 }, (_, i) => `song-${i}`);
  const before = { trackId: 'song-27', action: 'up', index: 27 };
  [queue[26], queue[27]] = [queue[27], queue[26]];
  assert.deepEqual(queueFocusTarget(queue, before), { trackId: 'song-27', action: 'up' });
  assert.deepEqual(queueFocusTarget(['b', 'a'], { trackId: 'b', action: 'up', index: 1 }), { trackId: 'b', action: 'cancel' });
});

test('cancellation keeps focus near the removed request and provides a safe empty-queue fallback', () => {
  assert.deepEqual(queueFocusTarget(['a', 'c'], { trackId: 'b', action: 'cancel', index: 1 }), { trackId: 'c', action: 'cancel' });
  assert.deepEqual(queueFocusTarget(['a'], { trackId: 'b', action: 'cancel', index: 1 }), { trackId: 'a', action: 'cancel' });
  assert.equal(queueFocusTarget([], { trackId: 'a', action: 'cancel', index: 0 }), null);
  assert.equal(queueFocusTarget(['a'], null), null);
});

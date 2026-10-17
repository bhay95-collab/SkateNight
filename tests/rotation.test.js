import test from 'node:test';
import assert from 'node:assert/strict';
import { RECENT_LIMIT, pushRecent, pickHouseTrack } from '../rotation.js';

// A small deterministic random generator so failures are reproducible.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test('the house rotation remembers the last 5 plays', () => {
  assert.equal(RECENT_LIMIT, 5);
  let recent = [];
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) recent = pushRecent(recent, id);
  assert.deepEqual(recent, ['c', 'd', 'e', 'f', 'g']);
});

test('never repeats any of the last 5 when the library is big enough', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `t${i}`);
  const rng = seeded(7);
  let recent = [];
  for (let i = 0; i < 2000; i++) {
    const pick = pickHouseTrack({ playableIds: ids, recent, rng });
    assert.ok(!recent.includes(pick), `repeated ${pick} within ${recent}`);
    recent = pushRecent(recent, pick);
  }
});

test('a library of exactly 6 still never repeats inside the window', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const rng = seeded(3);
  let recent = [];
  for (let i = 0; i < 500; i++) {
    const pick = pickHouseTrack({ playableIds: ids, recent, rng });
    assert.ok(!recent.includes(pick));
    recent = pushRecent(recent, pick);
  }
});

test('a small library at least avoids the song that just played', () => {
  const ids = ['a', 'b', 'c'];
  const rng = seeded(11);
  let recent = [];
  let prev = null;
  for (let i = 0; i < 300; i++) {
    const pick = pickHouseTrack({ playableIds: ids, recent, rng });
    assert.notEqual(pick, prev);
    prev = pick;
    recent = pushRecent(recent, pick);
  }
});

test('one playable song repeats rather than falling silent', () => {
  assert.equal(pickHouseTrack({ playableIds: ['solo'], recent: ['solo'], rng: Math.random }), 'solo');
});

test('no playable songs gives null, not a crash', () => {
  assert.equal(pickHouseTrack({ playableIds: [], recent: [], rng: Math.random }), null);
});

test('every playable song gets a turn over a long run', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
  const rng = seeded(99);
  const seen = new Set();
  let recent = [];
  for (let i = 0; i < 400; i++) {
    const pick = pickHouseTrack({ playableIds: ids, recent, rng });
    seen.add(pick);
    recent = pushRecent(recent, pick);
  }
  assert.equal(seen.size, ids.length);
});

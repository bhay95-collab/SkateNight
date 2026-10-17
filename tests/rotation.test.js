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

import { pickShuffle, pickInOrder } from '../rotation.js';

test('shuffle plays every song once before any song repeats', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `t${i}`);
  const rng = seeded(21);
  let bag = [];
  let recent = [];
  for (let cycle = 0; cycle < 6; cycle++) {
    const seenThisCycle = new Set();
    for (let i = 0; i < ids.length; i++) {
      const pick = pickShuffle({ playableIds: ids, bag, recent, rng });
      bag = pick.bag;
      assert.ok(!seenThisCycle.has(pick.id), `${pick.id} repeated inside one cycle`);
      seenThisCycle.add(pick.id);
      bag = [...bag, pick.id];
      recent = pushRecent(recent, pick.id);
    }
    assert.equal(seenThisCycle.size, ids.length);
  }
});

test('shuffle never repeats any of the last 5, even across a cycle boundary', () => {
  const ids = Array.from({ length: 29 }, (_, i) => `t${i}`);
  const rng = seeded(5);
  let bag = [];
  let recent = [];
  for (let i = 0; i < 1500; i++) {
    const pick = pickShuffle({ playableIds: ids, bag, recent, rng });
    assert.ok(!recent.includes(pick.id), `${pick.id} repeated within ${recent}`);
    bag = [...pick.bag, pick.id];
    recent = pushRecent(recent, pick.id);
  }
});

test('shuffle copes with tiny libraries, one song and none', () => {
  assert.equal(pickShuffle({ playableIds: [], bag: [], recent: [], rng: Math.random }).id, null);
  assert.equal(pickShuffle({ playableIds: ['solo'], bag: ['solo'], recent: ['solo'], rng: Math.random }).id, 'solo');
  const ids = ['a', 'b', 'c'];
  let bag = [];
  let recent = [];
  let prev = null;
  const rng = seeded(8);
  for (let i = 0; i < 200; i++) {
    const pick = pickShuffle({ playableIds: ids, bag, recent, rng });
    assert.notEqual(pick.id, prev);
    prev = pick.id;
    bag = [...pick.bag, pick.id];
    recent = pushRecent(recent, pick.id);
  }
});

test('shuffle ignores songs that stopped being playable', () => {
  const pick = pickShuffle({ playableIds: ['a', 'b'], bag: [], recent: [], rng: () => 0 });
  assert.ok(['a', 'b'].includes(pick.id));
  const gone = pickShuffle({ playableIds: ['b'], bag: ['a'], recent: [], rng: () => 0 });
  assert.equal(gone.id, 'b');
});

test('in-order mode follows the list, skips broken songs and wraps round', () => {
  const order = ['a', 'b', 'c', 'd'];
  assert.equal(pickInOrder({ orderIds: order, playableIds: order, currentId: 'a' }), 'b');
  assert.equal(pickInOrder({ orderIds: order, playableIds: order, currentId: 'd' }), 'a');
  assert.equal(pickInOrder({ orderIds: order, playableIds: ['a', 'd'], currentId: 'a' }), 'd');
  assert.equal(pickInOrder({ orderIds: order, playableIds: order, currentId: null }), 'a');
  assert.equal(pickInOrder({ orderIds: order, playableIds: order, currentId: 'zzz' }), 'a');
  assert.equal(pickInOrder({ orderIds: order, playableIds: [], currentId: 'a' }), null);
  assert.equal(pickInOrder({ orderIds: ['x'], playableIds: ['x'], currentId: 'x' }), 'x');
});

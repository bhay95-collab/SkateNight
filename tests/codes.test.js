import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CODE_LETTERS,
  ACCENTS,
  buildLibrary,
  parseCode,
  formatCode,
  findTrackByCode,
} from '../codes.js';

const vols = [
  { id: 'v3', title: 'Vol. III', cover: 'covers/vol-iii.jpg', accent: 'gold' },
  { id: 'v5', title: 'Vol. V', cover: 'covers/vol-v.jpg', accent: 'teal' },
];

test('code letters skip look-alikes and keyboard shortcut keys', () => {
  for (const bad of ['F', 'N', 'I', 'O']) {
    assert.ok(!CODE_LETTERS.includes(bad), `${bad} must not be a code letter`);
  }
  assert.equal(new Set(CODE_LETTERS).size, CODE_LETTERS.length);
  assert.ok(CODE_LETTERS.startsWith('ABCDE'));
});

test('codes are generated from order: letter per volume, number per track', () => {
  const tracks = [
    { id: 'a', title: 'A', volume: 'v3', file: 'audio/a.mp3' },
    { id: 'b', title: 'B', volume: 'v3', file: 'audio/b.mp3' },
    { id: 'c', title: 'C', volume: 'v5', file: 'audio/c.mp3' },
  ];
  const lib = buildLibrary(vols, tracks);
  assert.deepEqual(lib.problems, []);
  assert.deepEqual(lib.tracks.map((t) => t.code), ['A1', 'A2', 'B1']);
});

test('numbering follows file order inside a volume even when volumes are interleaved', () => {
  const tracks = [
    { id: 'a', title: 'A', volume: 'v5', file: 'audio/a.mp3' },
    { id: 'b', title: 'B', volume: 'v3', file: 'audio/b.mp3' },
    { id: 'c', title: 'C', volume: 'v5', file: 'audio/c.mp3' },
  ];
  const lib = buildLibrary(vols, tracks);
  assert.deepEqual(lib.tracks.map((t) => t.code), ['B1', 'A1', 'B2']);
});

test('a track pointing at an unknown volume is dropped with a plain-English problem', () => {
  const lib = buildLibrary(vols, [
    { id: 'a', title: 'A', volume: 'nope', file: 'audio/a.mp3' },
    { id: 'b', title: 'B', volume: 'v3', file: 'audio/b.mp3' },
  ]);
  assert.equal(lib.tracks.length, 1);
  assert.equal(lib.tracks[0].code, 'A1');
  assert.equal(lib.problems.length, 1);
  assert.match(lib.problems[0], /nope/);
});

test('duplicate track ids keep the first and report the second', () => {
  const lib = buildLibrary(vols, [
    { id: 'a', title: 'First', volume: 'v3', file: 'audio/a.mp3' },
    { id: 'a', title: 'Second', volume: 'v3', file: 'audio/b.mp3' },
  ]);
  assert.deepEqual(lib.tracks.map((t) => t.title), ['First']);
  assert.equal(lib.problems.length, 1);
});

test('tracks missing a title or file are dropped, never crash', () => {
  const lib = buildLibrary(vols, [
    { id: 'a', volume: 'v3', file: 'audio/a.mp3' },
    { id: 'b', title: 'B', volume: 'v3' },
    null,
    'garbage',
    { id: 'c', title: 'C', volume: 'v3', file: 'audio/c.mp3' },
  ]);
  assert.deepEqual(lib.tracks.map((t) => t.id), ['c']);
  assert.equal(lib.problems.length, 4);
});

test('an unknown accent falls back to gold but keeps the volume', () => {
  const lib = buildLibrary(
    [{ id: 'v1', title: 'Vol. I', cover: 'covers/x.jpg', accent: 'hotpink' }],
    [{ id: 'a', title: 'A', volume: 'v1', file: 'audio/a.mp3' }],
  );
  assert.equal(lib.volumes[0].accent, 'gold');
  assert.equal(lib.problems.length, 1);
  assert.ok(['teal', 'mauve', 'gold', 'rust', 'paper', 'sepia'].every((a) => ACCENTS.includes(a)));
});

test('volumes beyond the available letters are reported, not crashed on', () => {
  const many = Array.from({ length: CODE_LETTERS.length + 2 }, (_, i) => ({
    id: `v${i}`, title: `Vol ${i}`, cover: 'covers/x.jpg', accent: 'gold',
  }));
  const lib = buildLibrary(many, []);
  assert.equal(lib.volumes.length, CODE_LETTERS.length);
  assert.equal(lib.problems.length, 2);
});

test('empty or broken inputs give an empty library', () => {
  assert.deepEqual(buildLibrary(undefined, undefined).tracks, []);
  assert.deepEqual(buildLibrary([], []).volumes, []);
});

test('parseCode accepts typed codes loosely', () => {
  assert.deepEqual(parseCode('b7'), { letter: 'B', number: 7 });
  assert.deepEqual(parseCode(' B 07 '), { letter: 'B', number: 7 });
  assert.deepEqual(parseCode('A12'), { letter: 'A', number: 12 });
  assert.equal(parseCode(''), null);
  assert.equal(parseCode('7'), null);
  assert.equal(parseCode('B'), null);
  assert.equal(parseCode('B0'), null);
  assert.equal(parseCode('BB7'), null);
  assert.equal(parseCode(null), null);
});

test('formatCode and findTrackByCode round-trip', () => {
  const lib = buildLibrary(vols, [
    { id: 'a', title: 'A', volume: 'v3', file: 'audio/a.mp3' },
    { id: 'c', title: 'C', volume: 'v5', file: 'audio/c.mp3' },
  ]);
  assert.equal(formatCode('B', 1), 'B1');
  assert.equal(findTrackByCode(lib, 'b1').id, 'c');
  assert.equal(findTrackByCode(lib, ' A 1').id, 'a');
  assert.equal(findTrackByCode(lib, 'A9'), null);
  assert.equal(findTrackByCode(lib, 'junk'), null);
});

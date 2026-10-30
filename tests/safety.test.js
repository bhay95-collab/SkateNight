import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = ['styles.css', 'jukebox.css'].map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');

const toSeconds = (n, unit) => (unit === 'ms' ? Number(n) / 1000 : Number(n));

test('no endlessly repeating CSS animation is faster than once a second', () => {
  // Photosensitive safety (WCAG 2.3.1: max 3 flashes in any second). A period of
  // one second or more can never exceed that, whatever the animation does.
  const rule = /animation:\s*([\w-]+)\s+([\d.]+)(ms|s)\b[^;}]*\binfinite\b/g;
  let match;
  let seen = 0;
  while ((match = rule.exec(css))) {
    seen += 1;
    const [, name, n, unit] = match;
    assert.ok(toSeconds(n, unit) >= 1, `@keyframes ${name} repeats every ${n}${unit} - too fast`);
  }
  assert.ok(seen >= 8, `expected to find the infinite animations, found ${seen}`);
});

test('calm lights switch every animation and transition off', () => {
  assert.match(css, /html\[data-lights="calm"\] \*,[\s\S]*?animation:none !important;[\s\S]*?transition:none !important;/);
});

test('the neon flicker keyframes never go fully dark', () => {
  for (const name of ['neon-flicker-a', 'neon-flicker-b', 'neon-flicker-c']) {
    const body = new RegExp(`@keyframes ${name}\\{([\\s\\S]*?)\\n\\}`).exec(css);
    assert.ok(body, `${name} not found`);
    const opacities = [...body[1].matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    assert.ok(Math.min(...opacities) >= 0.5, `${name} dips below half brightness`);
  }
});

test('the hard rule: only the cabinet tokens from trivia are used for the palette', () => {
  for (const token of ['#140722', '#1D0B33', '#2B1147', '#38175C', '#4A2670', '#0C0516', '#FF2D95', '#25E8E2', '#FFC531', '#FFF3DE', '#A98CC4']) {
    assert.ok(css.includes(token), `palette token ${token} is missing`);
  }
});

test('the screen flicker is photosensitive-safe', async () => {
  const { planFlicker, FLICKER } = await import('../lights.js');
  let seed = 7;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 500; i++) {
    const plan = planFlicker(rng);
    const peaks = plan.keyframes.filter((k) => k.opacity > 0);
    assert.ok(plan.dips >= 1 && plan.dips <= 2, 'one or two dips per burst');
    assert.equal(plan.dipStartsMs.length, plan.dips, 'one crackle per dip');
    assert.ok(plan.duration < 1000, 'a burst is over within a second, so it holds at most 2 flashes');
    assert.ok(plan.nextInMs >= FLICKER.minGapMs, 'bursts are far apart');
    assert.ok(Math.max(...peaks.map((k) => k.opacity)) <= FLICKER.maxDim, 'never goes more than 60% dark');
    assert.equal(plan.keyframes[0].opacity, 0);
    assert.equal(plan.keyframes[plan.keyframes.length - 1].opacity, 0, 'always ends fully back on');
    const offsets = plan.keyframes.map((k) => k.offset);
    assert.ok(offsets.every((o, j) => o >= 0 && o <= 1 && (j === 0 || o >= offsets[j - 1])), 'valid keyframe offsets');
  }
});

test('the screen flicker patches stay inside the same safety budget', async () => {
  const { planFlicker, FLICKER } = await import('../lights.js');
  let seed = 11;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 500; i++) {
    const plan = planFlicker(rng);
    assert.equal(plan.patches.length, FLICKER.cols * FLICKER.rows, 'one plan per patch of screen');
    for (const patch of plan.patches) {
      const dark = patch.keyframes.map((k) => k.opacity);
      assert.ok(Math.max(...dark) <= FLICKER.maxDim, 'no patch goes more than 60% dark');
      assert.equal(dark[0], 0);
      assert.equal(dark[dark.length - 1], 0, 'every patch ends fully back on');
      assert.equal(patch.keyframes.length, plan.keyframes.length, 'patches share the burst timeline');
      assert.ok(patch.delayMs >= 0 && patch.delayMs + plan.duration < 1000, 'the whole ripple is over within a second');
    }
    const depths = new Set(plan.patches.map((p) => Math.max(...p.keyframes.map((k) => k.opacity))));
    assert.ok(depths.size > 1, 'patches do not all dip the same');
  }
});

test('the dormant cabinet power sags stay inside the flash budget', async () => {
  const { planSag, SAG } = await import('../lights.js');
  let seed = 5;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 500; i++) {
    const plan = planSag(rng);
    const dims = plan.keyframes.map((k) => k.dim);
    assert.ok(plan.dips >= 1 && plan.dips <= 2, 'one or two dips per sag');
    assert.ok(plan.duration < 1000, 'a sag is over within a second');
    assert.ok(plan.nextInMs >= SAG.minGapMs, 'sags are far enough apart that no second holds 3 dips');
    assert.ok(Math.max(...dims) <= SAG.maxDim, 'a sag never darkens more than allowed');
    assert.equal(dims[0], 0);
    assert.equal(dims[dims.length - 1], 0, 'always recovers');
    assert.ok(plan.keyframes.every((k) => Math.abs(k.shift) <= SAG.maxShiftEm), 'the picture only jitters a little');
  }
});

/* Swings of at least 10% in the supply, as a zig-zag: each leg is one change
   of brightness, and a flash is a pair of opposing changes (WCAG 2.3.1). */
function supplySwings(supplyAt, endMs) {
  const start = supplyAt(0);
  const legs = [];
  let dir = 0;
  let extreme = start;
  let extremeAt = 0;
  for (let ms = 0; ms <= endMs; ms += 5) {
    const v = supplyAt(ms);
    if (dir === 0) {
      if (Math.abs(v - start) >= 0.1) { dir = Math.sign(v - start); extreme = v; extremeAt = ms; }
    } else if ((v - extreme) * dir > 0) {
      extreme = v;
      extremeAt = ms;
    } else if ((extreme - v) * dir >= 0.1) {
      legs.push(extremeAt);               // the swing turned: that leg is one change
      dir = -dir;
      extreme = v;
      extremeAt = ms;
    }
  }
  if (dir !== 0) legs.push(extremeAt);
  return legs;
}

test('the INSERT COIN power-up never packs more than two flashes into a second', async () => {
  const { BEATS, supplyAt } = await import('../startup-timing.js');
  const legs = supplySwings(supplyAt, BEATS.end);
  assert.ok(legs.length >= 8, 'the supply really does struggle before it locks');
  for (const start of legs) {
    const inSecond = legs.filter((ms) => ms >= start && ms < start + 1000).length;
    assert.ok(inSecond <= 4, `at most 4 brightness changes (2 flashes) in the second from ${start} ms (found ${inSecond})`);
  }
});

test('the INSERT COIN film keeps its beats in order', async () => {
  const { BEATS, SUPPLY, CHUTE_CLINKS_MS } = await import('../startup-timing.js');
  const times = Object.values(BEATS);
  assert.deepEqual(times, [...times].sort((a, b) => a - b), 'every beat follows the one before');
  assert.deepEqual(SUPPLY.map(([ms]) => ms), SUPPLY.map(([ms]) => ms).sort((a, b) => a - b), 'the supply curve runs forwards');
  assert.ok(BEATS.gone + CHUTE_CLINKS_MS.at(-1) < BEATS.credit, 'the coin reaches the box before the credit shows');
  assert.ok(SUPPLY.every(([, v]) => v >= 0 && v <= 1.3), 'the supply stays in range');
});

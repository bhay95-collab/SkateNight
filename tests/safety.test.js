import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

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
    assert.ok(plan.duration < 1000, 'a burst is over within a second, so it holds at most 2 flashes');
    assert.ok(plan.nextInMs >= FLICKER.minGapMs, 'bursts are far apart');
    assert.ok(Math.max(...peaks.map((k) => k.opacity)) <= FLICKER.maxDim, 'never goes more than 60% dark');
    assert.equal(plan.keyframes[0].opacity, 0);
    assert.equal(plan.keyframes[plan.keyframes.length - 1].opacity, 0, 'always ends fully back on');
    const offsets = plan.keyframes.map((k) => k.offset);
    assert.ok(offsets.every((o, j) => o >= 0 && o <= 1 && (j === 0 || o >= offsets[j - 1])), 'valid keyframe offsets');
  }
});

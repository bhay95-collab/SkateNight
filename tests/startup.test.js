import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BEATS, STANDBY, supplyAt } from '../startup-timing.js';
import { RESPONSE, tubeSchedule } from '../startup-power.js';

test('the neon tubes catch through phase B and the dead ones last, at ignition', () => {
  const dead = new Set([3, 8]);
  const plan = tubeSchedule(10, dead);
  assert.equal(plan.size, 10, 'every tube strikes');
  for (const [i, { at }] of plan) {
    if (dead.has(i)) assert.ok(at >= BEATS.ignite, `dead tube ${i} catches only when the supply locks`);
    else assert.ok(at > BEATS.catch && at < BEATS.ignite, `tube ${i} strikes while the supply climbs`);
  }
});

/* brightness and saturate out of a CSS filter, e.g. "brightness(.55) saturate(.55)". */
const levels = (filter) => ['brightness', 'saturate'].map((fn) => Number(filter.match(new RegExp(`${fn}\\(([\\d.]+)\\)`))?.[1] ?? 1));

test('the dormant cabinet in styles.css is the cabinet on standby supply', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const cssFilter = (selector) => css.match(new RegExp(`\\n${selector.replace('.', '\\.')}\\{[^}]*?filter:([^;]+);`))?.[1] ?? '';
  const standby = supplyAt(0);
  for (const [selector, response] of [['.cab-sign', RESPONSE.sign(standby)], ['.tv-picture', RESPONSE.picture(standby, 0)], ['.cab-arch', RESPONSE.chrome(standby)],
    ['.cab-body', RESPONSE.body(standby)], ['.cab-door', RESPONSE.door(standby)]]) {
    const [b, s] = levels(cssFilter(selector));
    const [vb, vs] = levels(response.filter);
    assert.ok(Math.abs(b - vb) < 0.01 && Math.abs(s - vs) < 0.01, `${selector}: CSS ${b}/${s} vs standby ${vb}/${vs}`);
  }
  assert.equal(RESPONSE.room(standby).opacity, 0, 'the room only lights once the cabinet is awake');
});

test('the film keeps its story: a failed first try, a real silence, and a held, lit machine', () => {
  const { relay, attempt, almost, fail, tick, catch: caught, ignite, surge } = BEATS;
  assert.ok(supplyAt(relay + 100) < 0.05, 'the relay cuts the standby supply');
  assert.ok(supplyAt(almost) >= 0.5 && supplyAt(almost) < 0.84, 'the first try nearly reaches running, and no more');
  assert.ok(attempt < almost && almost < fail, 'it gathers, nearly holds, then fails');
  const dark = [];
  for (let ms = fail; ms <= caught; ms += 10) if (supplyAt(ms) < 0.05) dark.push(ms);
  assert.ok(dark.length && dark.at(-1) - dark[0] >= 500, 'at least half a second of real dark before the second try');
  assert.ok(tick > dark[0] && tick < caught, 'the tick lands in the dark');
  for (let ms = ignite + 420; ms <= surge; ms += 50) assert.ok(supplyAt(ms) >= 1, 'the lit machine holds steady');
  assert.ok(surge - ignite >= 1500, 'the lit machine gets its moment before the dive');
});

test('the dormant attract scene is intentionally dark and instruction-free', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /attract:not\(\.is-powered\)[\s\S]*?\.cab-sign[\s\S]*?opacity:\s*0/,
    'the sign is hidden before the cabinet wakes');
  assert.match(css, /attract:not\(\.is-inserting\)[\s\S]*?\.door-text[\s\S]*?opacity:\s*0/,
    'the coin prompt and price stay out of the dark first frame');
  assert.match(css, /attract:not\(\.is-tube-lit\)[\s\S]*?\.attract-logo[\s\S]*?opacity:\s*0/,
    'the lit CRT logo stays off until the relay has the picture');
});

test('the dormant room is blacked out so the screen is the only light', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const opacity = (selector) => Number(css.match(new RegExp(`\\n${selector.replace(/\./g, '\\.')}{[^}]*?opacity:([\\d.]+)`))?.[1]);
  assert.ok(opacity('.attract-beam') <= 0.12, 'the room beam should be nearly swallowed by darkness');
  assert.equal(opacity('.attract-floor'), 0, 'the floor should remain blacked out on standby');
  assert.ok(css.includes('linear-gradient(180deg, #030209, #010103 62%, #000000)'), 'the room should fall fully to black on standby');
});

test('the dormant cabinet is the darkest moment: only the picture tube is really lit', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const opacity = (selector) => Number(css.match(new RegExp(`\\n${selector.replace(/\./g, '\\.')}\\{[^}]*?opacity:([\\d.]+)`))?.[1]);
  assert.equal(supplyAt(0), STANDBY);
  assert.equal(RESPONSE.lamp(STANDBY).opacity, 0, 'the coin lamp is dark until someone touches the machine');
  assert.equal(opacity('.mech-glow'), 0);
  assert.equal(RESPONSE.tubes(STANDBY).opacity, 0, 'the bubble tubes are cold');
  assert.equal(opacity('.cab-tube i'), 0);
  assert.equal(opacity('.cab-spill'), RESPONSE.spill(STANDBY).opacity, 'the tube light on the cabinet is the standby response');
  assert.equal(opacity('.attract-grain'), Number(RESPONSE.static(STANDBY).opacity.toFixed(2)));
  const [sign] = levels(RESPONSE.sign(STANDBY).filter);
  const [lit] = levels(RESPONSE.sign(1).filter);
  assert.ok(sign < lit / 10, 'the sign is barely there next to the lit machine');
  for (const v of [1, 1.14]) assert.ok(Math.abs(levels(RESPONSE.door(v).filter)[0] - (1 + 0.3 * (v - 0.5))) < 0.01, 'the lit door is as bright as ever');
});

test('the dormant picture tube is a real light: a starved picture with a weak signal on it', () => {
  const [picture, colour] = levels(RESPONSE.picture(STANDBY, 0).filter);
  assert.ok(picture >= 0.35, `the tube glows on standby (${picture})`);
  assert.ok(colour >= 0.7, 'the robot on it keeps its cyan and magenta');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../startup.js', import.meta.url), 'utf8');
  assert.match(css, /\n\.attract-grain\{[^}]*background-image:var\(--grain-weak\)/, 'on standby the static is a weak signal, not snow');
  assert.match(css, /\.attract\.is-tube-lit \.attract-grain\{ background-image:var\(--grain\); \}/, 'the film keeps its own snow');
  assert.match(js, /img\.data\[i \+ 3\] = Math\.random\(\) < 0\.42 \? 0 : 40 \+ Math\.random\(\) \* 34;/, 'the weak signal is a faint, sparse tile');
  assert.ok(RESPONSE.static(1).opacity <= 0.05, 'the snow clears once the picture locks');
  assert.ok(levels(RESPONSE.picture(0.03, 0).filter)[0] < 0.02, 'the relay still kills the tube');
  for (const v of [1, 1.14]) assert.ok(Math.abs(levels(RESPONSE.picture(v, 0).filter)[0] - (v - 0.06) * 1.18) < 0.01, 'the lit picture is unchanged');
});

test('only the dark end of the supply changed: from the knee up every part is as it was', () => {
  const was = {
    body: (v) => (v >= 1 ? 1 : 0.1 + 0.9 * v ** 1.5),
    chrome: (v) => (v <= 1 ? 0.05 + v * v : 0.3 + 0.75 * v),
    door: (v) => 0.03 + 0.97 * (Math.min(v, 0.5) / 0.5) ** 2.5 + 0.3 * Math.max(v - 0.5, 0),
    picture: (v) => (v <= 1 ? 1.11 * Math.min(1, Math.max(0, (v - 0.03) / 0.97)) ** 0.6 : (v - 0.06) * 1.18),
  };
  for (let v = 0.4; v <= 1.3; v += 0.05) {
    for (const part of ['body', 'chrome', 'door', 'picture']) {
      assert.ok(Math.abs(levels(RESPONSE[part](v, 0).filter)[0] - was[part](v)) < 0.002, `${part} at ${v.toFixed(2)}`);
    }
  }
  for (let v = 0; v < 0.4; v += 0.01) {
    for (const part of ['body', 'chrome', 'door']) {
      assert.ok(levels(RESPONSE[part](v).filter)[0] <= was[part](v) + 1e-9, `${part} only ever darker below the knee`);
    }
  }
});

test('the opening is the darkest the cabinet gets while it has any power, and the dead moments are no brighter', () => {
  const [body] = levels(RESPONSE.body(STANDBY).filter);
  const [chrome] = levels(RESPONSE.chrome(STANDBY).filter);
  const [door] = levels(RESPONSE.door(STANDBY).filter);
  assert.ok(body <= 0.08 && chrome <= 0.05 && door <= 0.05, 'lacquer, chrome and coin door are only just there');
  for (const part of ['body', 'chrome', 'door']) {
    assert.ok(levels(RESPONSE[part](0.03).filter)[0] <= levels(RESPONSE[part](STANDBY).filter)[0], `${part}: dark is darker than standby`);
  }
});

test('one robot on the tube at a time: the phosphor robot gives way to the lit logo behind the collapse', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../startup.js', import.meta.url), 'utf8');
  assert.match(css, /\.attract:not\(\.is-tube-lit\) \.attract-logo\{\s*opacity:0;\s*visibility:hidden;/, 'the lit logo waits');
  assert.match(css, /\.attract\.is-tube-lit \.tv-phosphor/, 'the phosphor robot goes when it comes');
  assert.match(js, /at\(relay \+ 100, \(\) => el\.attract\.classList\.add\('is-tube-lit'\)\)/, 'only once the relay has collapsed the picture');
  assert.ok(BEATS.relay + 100 < BEATS.catch, 'and long before the raster opens again');
  assert.doesNotMatch(readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/<button class="attract"[\s\S]*?<\/button>/)[0].replace(/aria-label="[^"]*"/, ''),
    /INSERT COIN|PRESS ANY|CLICK TO|TAP TO/i, 'no visible prompt anywhere on the cabinet');
});

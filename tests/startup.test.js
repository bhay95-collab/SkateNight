import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BEATS, BEAT_MS, CHUTE_CLINKS_MS, LOCK_BEATS, PULSE, STANDBY, supplyAt } from '../startup-timing.js';
import { RESPONSE, tubeSchedule } from '../startup-power.js';

test('the neon letters strike on the heartbeat, one a beat; the lock completes the sign in one ripple', () => {
  for (const dead of [new Set(), new Set([3, 8])]) {
    const plan = tubeSchedule(10, dead);
    assert.equal(plan.size, 10, 'every tube strikes');
    const live = [...plan].filter(([i]) => !dead.has(i)).map(([, { at }]) => at).sort((a, b) => a - b);
    const beats = PULSE.heartbeat.map(Math.round);
    assert.deepEqual(live.slice(0, beats.length), beats, 'one letter on each heartbeat');
    const rest = [...live.slice(beats.length), ...[...dead].map((i) => plan.get(i).at)];
    assert.ok(rest.every((at) => at >= BEATS.ignite && at <= BEATS.ignite + 600), 'the rest catch as the lock lands');
    assert.ok(Math.max(...plan.values().map(({ at }) => at)) < PULSE.lock[2], 'the name is whole before the lock is two beats old');
    for (const i of dead) assert.ok(plan.get(i).at >= Math.max(...live), `dead tube ${i} catches last`);
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

test('the film keeps its story: a failed first try, a real dark, a quickening pulse, a held machine, a cut', () => {
  const { relay, attempt, almost, fail, tick, catch: caught, ignite, cut } = BEATS;
  assert.ok(supplyAt(relay + 100) < 0.05, 'the relay cuts the standby supply');
  assert.ok(supplyAt(almost) >= 0.5 && supplyAt(almost) < 0.84, 'the first try nearly reaches running, and no more');
  assert.ok(attempt < almost && almost < fail, 'it gathers, nearly holds, then fails');
  const dark = [];
  for (let ms = fail; ms <= caught; ms += 10) if (supplyAt(ms) < 0.05) dark.push(ms);
  assert.ok(dark.length && dark.at(-1) - dark[0] >= 1700, 'a real dark, nearly two seconds, before the second try');
  assert.ok(tick > dark[0] && tick < caught, 'the tick lands in the dark');
  assert.ok(PULSE.heartbeat[0] > caught && PULSE.heartbeat.length >= 3, 'the heartbeat starts after the heavier relay');
  const gaps = PULSE.heartbeat.slice(1).map((ms, n) => ms - PULSE.heartbeat[n]);
  assert.ok(gaps.every((g, n) => n === 0 || g < gaps[n - 1]), `it quickens (${gaps.map(Math.round)})`);
  assert.ok(Math.abs(ignite - PULSE.heartbeat.at(-1) - BEAT_MS) < 0.1, 'and its next beat is the lock, on the song\'s tempo');
  assert.equal(PULSE.lock.length, LOCK_BEATS);
  assert.equal(PULSE.lock[0], ignite);
  PULSE.lock.slice(1).forEach((ms, n) => assert.ok(Math.abs(ms - PULSE.lock[n] - BEAT_MS) < 0.1, 'the lock keeps the tempo'));
  for (let ms = ignite + 420; ms <= cut; ms += 50) assert.ok(supplyAt(ms) >= 1, 'the lit machine holds steady');
  assert.ok(cut - ignite >= 1500, 'the lit machine gets its moment before the cut');
  assert.equal(cut, PULSE.lock.at(-1), 'the cut is the last beat');
});

test('the dormant attract scene is intentionally dark and instruction-free', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /attract:not\(\.is-powered\)[\s\S]*?\.cab-sign[\s\S]*?opacity:\s*0/,
    'the sign is hidden before the cabinet wakes');
  assert.match(css, /attract:not\(\.is-inserting\)[\s\S]*?\.door-text[\s\S]*?opacity:\s*0/,
    'the coin prompt and price stay out of the dark first frame');
  assert.match(css, /attract:not\(\.is-powered\)[\s\S]*?\.attract-logo[\s\S]*?opacity:\s*0/,
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
  assert.match(css, /\n\.attract-grain\{[^}]*background-image:var\(--grain-weak, var\(--grain\)\)/, 'on standby the static is a weak signal, not snow');
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

test('one robot, all the way through: it holds, looks, flickers, leads, and is the robot in the lit tube', async () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../startup.js', import.meta.url), 'utf8');
  const robot = readFileSync(new URL('../startup-robot.js', import.meta.url), 'utf8');
  const { robotLevelAt } = await import('../startup-robot.js');
  const { ROBOT_FIRST_MS } = await import('../startup-timing.js');
  assert.match(css, /\.attract:has\(\.tv-phosphor\.is-ready\) \.attract-logo\{\s*opacity:0;\s*visibility:hidden;/, 'once the robot is drawn, the framed logo tile never shows');
  assert.match(css, /\.attract:not\(\.is-powered\) \.attract-logo,/, 'and without the robot the logo still lights at the relay');
  assert.doesNotMatch(css, /\.attract\.is-tube-lit \.tv-phosphor/, 'the robot is not hidden when the picture comes back');
  assert.match(css, /\.attract\.is-inserting:not\(\.is-powered\) \.attract-grain\{ animation-play-state:paused; \}/, 'the press: the static freezes');
  assert.match(js, /dormant\.hold\(\);/, 'the press: it stops breathing');
  assert.match(robot, /holder\.parentElement\?\.after\(holder\)/, 'lifted off the collapsing picture at the relay');
  assert.ok(BEATS.look < BEATS.coinIn, 'it looks toward the slot before the coin appears');
  const { relay, attempt, almost, fail, catch: caught, ignite, cut } = BEATS;
  assert.equal(robotLevelAt(relay + 150), 0, 'gone with the relay');
  assert.ok(robotLevelAt(almost) > 0.1 && robotLevelAt(almost) <= 0.32, 'A: back, but faint');
  for (let ms = fail + 300; ms < caught + 60; ms += 50) assert.equal(robotLevelAt(ms), 0, 'dark with the dark');
  assert.ok(robotLevelAt(caught + ROBOT_FIRST_MS - 10) >= 1, 'B: fully lit before the line or the raster come');
  assert.ok(robotLevelAt(caught + 310) > robotLevelAt(almost) * 3, 'brighter than it ever was');
  for (let ms = ignite + 700; ms <= cut; ms += 50) assert.equal(robotLevelAt(ms), robotLevelAt(cut), 'held, lit, to the cut');
  assert.ok(attempt < almost);
  assert.doesNotMatch(readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/<button class="attract"[\s\S]*?<\/button>/)[0].replace(/aria-label="[^"]*"/, ''),
    /INSERT COIN|PRESS ANY|CLICK TO|TAP TO/i, 'no visible prompt anywhere on the cabinet');
});

test('the coin is the key, filmed small: a short hang, a long fall, all before the relay', () => {
  const { look, coinIn, contact, gone, credit, relay } = BEATS;
  assert.ok(look < coinIn && coinIn < contact && contact < gone, 'it looks, the coin comes, catches and is swallowed');
  assert.ok(gone - coinIn <= 2100, `the coin is on screen about two seconds (${gone - coinIn} ms)`);
  assert.ok(CHUTE_CLINKS_MS.at(-1) - CHUTE_CLINKS_MS[0] >= 1700, 'the fall lasts nearly two seconds');
  const gaps = CHUTE_CLINKS_MS.slice(1).map((ms, n) => ms - CHUTE_CLINKS_MS[n]);
  assert.ok(gaps.every((g, n) => n === 0 || g >= gaps[n - 1]), 'the clinks spread out as it falls away');
  assert.ok(gone + CHUTE_CLINKS_MS.at(-1) < credit && credit < relay, 'far below, the coin box, and only then the relay');
  const js = readFileSync(new URL('../startup.js', import.meta.url), 'utf8');
  assert.match(js, /const COIN_ON_SCREEN = 0\.1;/, 'small in frame');
  const coin = readFileSync(new URL('../startup-coin.js', import.meta.url), 'utf8');
  assert.doesNotMatch(coin, /blur: 9/, 'it no longer swings in past the lens');
});

test('the camera: still at the press, the low hero angle held still through the lock', () => {
  const js = readFileSync(new URL('../startup.js', import.meta.url), 'utf8');
  const cam = js.slice(js.indexOf('function stageCamera'), js.indexOf('/* Heavy things moving'));
  assert.match(cam, /\{ offset: 0, \.\.\.aim\(mid, 1, mid\) \},\s*\{ offset: t\(look \+ 200\), \.\.\.aim\(mid, 1, mid\)/, 'nothing moves at the press');
  assert.match(cam, /\{ offset: t\(ignite - 150\), \.\.\.aim\(tube, heroScale, \{ x: vw \/ 2, y: vh \* HERO\.tubeAt \}, HERO\.tilt\) \},/, 'it reaches the low angle as the lock lands');
  assert.match(cam, /\{ offset: 1, \.\.\.aim\(tube, heroScale, \{ x: vw \/ 2, y: vh \* HERO\.tubeAt \}, HERO\.tilt\) \},/, 'and holds it, still, to the cut');
  assert.match(js, /const HERO = \{ scale: 1\.16, tubeAt: 0\.37, footAt: 0\.83, tilt: 6 \}/);
});


test('the press stays light: sampled keyframes are thinned to what the eye can see, shape changes kept', async () => {
  const { thin } = await import('../startup-power.js');
  const frames = Array.from({ length: 301 }, (_, i) => ({ offset: i / 300, opacity: Math.min(1, i / 150) }));
  const kept = thin(frames);
  assert.ok(kept.length <= 4, `a ramp and a hold need only their corners (${kept.length})`);
  const at = (o) => { const i = kept.findIndex((f) => f.offset >= o); const a = kept[i - 1] ?? kept[0]; const b = kept[i]; return a === b ? a.opacity : a.opacity + (b.opacity - a.opacity) * (o - a.offset) / (b.offset - a.offset); };
  assert.ok(frames.every((f) => Math.abs(at(f.offset) - f.opacity) < 0.005), 'and nothing visible is lost');
  const curve = Array.from({ length: 201 }, (_, i) => ({ offset: i / 200, filter: `brightness(${(Math.sin(i / 20) * 0.5 + 0.6).toFixed(3)})` }));
  const c = thin(curve);
  assert.ok(c.length < curve.length / 2 && c.length > 10, `a curve keeps enough points (${c.length})`);
  const shaped = [{ offset: 0, filter: 'brightness(1)' }, { offset: 0.5, filter: 'brightness(1) drop-shadow(2px 0 0 red)' }, { offset: 1, filter: 'brightness(1)' }];
  assert.equal(thin(shaped).length, 3, 'a sample whose CSS changes shape is always kept');
});

#!/usr/bin/env node
/* Check the cabinet's motion in a real browser, because node --test cannot see
   any of it: every unit test passes just as happily with the rack flip broken.

   Start a local HTTP server, then run:
       python3 -m http.server 8080
       node scripts/check-animations.mjs --base-url http://127.0.0.1:8080

   Requires Node Playwright and its Chromium. It is NOT an application
   dependency: nothing in the jukebox imports it, and `npm test` does not run
   this file. Install it only if you want these checks:
       npm i -D playwright && npx playwright install chromium
   --chromium overrides the browser executable.

   These assert INVARIANTS, not tuning values. RACK_TURN_MS and the stagger
   constants in ui.js are meant to be tuned; what must never drift is that the
   cover and the strips move as one, that a turn can be interrupted, and that
   CALM stops everything at once. */

import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = arg('--base-url', 'http://127.0.0.1:8080');

/* ---------------- finding Playwright without depending on it ---------------- */

/* Resolve from this project first, then from anywhere npx has cached it, so
   the checks run before anyone commits to a devDependency. */
function loadPlaywright() {
  const require_ = createRequire(import.meta.url);
  const roots = [process.cwd()];
  const npx = path.join(homedir(), '.npm', '_npx');
  if (existsSync(npx)) {
    for (const dir of readdirSync(npx)) roots.push(path.join(npx, dir));
  }
  for (const root of roots) {
    try {
      return require_(require_.resolve('playwright', { paths: [root] }));
    } catch { /* keep looking */ }
  }
  return null;
}

/* A cached Playwright can want a newer browser build than the one on disk.
   Fall back to whatever headless shell is actually installed rather than
   dying with Playwright's "please run npx playwright install" message. */
function findChromium() {
  const explicit = arg('--chromium');
  if (explicit) return explicit;
  if (existsSync('/usr/bin/chromium')) return '/usr/bin/chromium';
  const caches = [
    path.join(homedir(), 'Library', 'Caches', 'ms-playwright'),
    path.join(homedir(), '.cache', 'ms-playwright'),
  ].filter(existsSync);
  for (const cache of caches) {
    const shells = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse();
    for (const shell of shells) {
      for (const platform of readdirSync(path.join(cache, shell))) {
        const exe = path.join(cache, shell, platform, 'chrome-headless-shell');
        if (existsSync(exe)) return exe;
      }
    }
  }
  return null;              // let Playwright pick its own
}

const playwright = loadPlaywright();
if (!playwright) {
  console.error('Playwright is not installed, so the motion checks did not run.\n'
    + '  npm i -D playwright && npx playwright install chromium');
  process.exit(2);          // 2 = could not run, as distinct from 1 = failed
}

try {
  const probe = await fetch(BASE, { method: 'HEAD' });
  if (!probe.ok) throw new Error(String(probe.status));
} catch {
  console.error(`Nothing is serving ${BASE}, so the motion checks did not run.\n`
    + '  python3 -m http.server 8080');
  process.exit(2);
}

/* ---------------- harness ---------------- */

let failures = 0;
const check = (ok, message, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${message}${detail ? `  -> ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const section = (title) => console.log(`\n${title}`);

const executablePath = findChromium();
const browser = await playwright.chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
const missing = [];
page.on('pageerror', (err) => pageErrors.push(err.message));
// The browser logs its own 404s as console errors. Those are tracked separately
// below, because sound.js deliberately probes for optional sfx/*.mp3 overrides.
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) pageErrors.push(m.text());
});
page.on('response', (r) => { if (r.status() >= 400) missing.push(new URL(r.url()).pathname); });

// The completed-arrival flag skips the long intro, exactly as check-ui.py does.
await page.addInitScript(() => sessionStorage.setItem('sn_booted', '1'));
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => !document.getElementById('attract').hidden, null, { timeout: 15000 });
await page.click('#attract');
await page.waitForFunction(() => window.__skateNight?.state().started === true, null, { timeout: 15000 });
// The coin drops and the cabinet powers up before the jukebox is handed over.
await page.waitForFunction(() => document.getElementById('attract').hidden, null, { timeout: 15000 });
await page.waitForTimeout(300);

/* How long a turn lasts is read from the page, not hardcoded, so tuning
   RACK_TURN_MS does not break every check below. */
const readFlip = () => page.evaluate(() => {
  const read = (sel) => [...document.querySelector(sel).getAnimations()].map((a) => ({
    duration: a.effect.getTiming().duration,
    easing: a.effect.getTiming().easing,
    time: Math.round(a.currentTime),
    origin: a.effect.getKeyframes()[0]?.transformOrigin,
    from: a.effect.getKeyframes()[0]?.transform,
  }));
  return { sleeve: read('#rack-sleeve'), page: read('.rack-page') };
});
const settle = async (turn) => page.waitForTimeout(turn + 700);

await page.click('#rack-next');
await page.waitForTimeout(40);
let flip = await readFlip();
const TURN = flip.sleeve[0]?.duration ?? 0;

section('[1] the cover and the title strips turn as one page');
check(flip.sleeve.length === 1, 'the cover is animating', JSON.stringify(flip.sleeve));
check(flip.page.length === 1, 'the strips are animating', JSON.stringify(flip.page));
if (flip.sleeve[0] && flip.page[0]) {
  check(flip.sleeve[0].duration === flip.page[0].duration, 'same duration',
    `${flip.sleeve[0].duration} vs ${flip.page[0].duration}`);
  check(flip.sleeve[0].easing === flip.page[0].easing, 'same easing', flip.sleeve[0].easing);
  check(Math.abs(flip.sleeve[0].time - flip.page[0].time) <= 2, 'started in the same frame',
    `${flip.sleeve[0].time}ms vs ${flip.page[0].time}ms`);
  check(!/,\s*1\.[0-9]*[1-9]\s*\)/.test(flip.sleeve[0].easing),
    'the curve does not overshoot (that reads snappy, not expensive)', flip.sleeve[0].easing);
}

section('[2] the strips cascade into the carrier');
const strips = await page.evaluate(() => [...document.querySelectorAll('#strips .strip')].map((row) => {
  const [a] = row.getAnimations();
  const t = a?.effect.getTiming();
  return t ? { delay: Math.round(t.delay), duration: t.duration, fill: t.fill } : null;
}));
const settled = strips.filter(Boolean);
check(settled.length === strips.length && settled.length > 1, 'every strip settles',
  `${settled.length} of ${strips.length}`);
if (settled.length > 1) {
  const gaps = settled.slice(1).map((s, i) => s.delay - settled[i].delay);
  check(new Set(gaps).size === 1 && gaps[0] > 0, 'they cascade at one even gap, in order', JSON.stringify(gaps));
  check(settled[0].delay > TURN * 0.4, 'the cascade starts once the page is well into its turn',
    `${settled[0].delay}ms into a ${TURN}ms turn`);
  check(settled.every((s) => s.fill === 'backwards'), 'the offset is held through the delay, so nothing flashes',
    settled[0].fill);
  const total = settled.at(-1).delay + settled.at(-1).duration;
  check(total < 1500, 'the whole page settles inside 1.5s', `${total}ms`);
}

section('[3] a turn can be interrupted');
await settle(TURN);
await page.click('#rack-next');
await page.waitForTimeout(30);
await page.click('#rack-next');
await page.waitForTimeout(30);
flip = await readFlip();
check(flip.sleeve.length === 1, 'two fast presses leave one cover animation, not a stack', String(flip.sleeve.length));
check(flip.page.length === 1, 'two fast presses leave one strips animation, not a stack', String(flip.page.length));

section('[4] the page hinges on the edge it travels from');
await settle(TURN);
await page.click('#rack-next');
await page.waitForTimeout(30);
flip = await readFlip();
check(flip.sleeve[0]?.origin === 'left center' && flip.page[0]?.origin === 'left center',
  'forward hinges left, both parts', `${flip.sleeve[0]?.origin} / ${flip.page[0]?.origin}`);
check(/rotateY\(\d/.test(flip.sleeve[0]?.from ?? ''), 'forward swings in from the positive side', flip.sleeve[0]?.from);
await settle(TURN);
await page.click('#rack-prev');
await page.waitForTimeout(30);
flip = await readFlip();
check(flip.sleeve[0]?.origin === 'right center' && flip.page[0]?.origin === 'right center',
  'back hinges right, both parts', `${flip.sleeve[0]?.origin} / ${flip.page[0]?.origin}`);
check(/rotateY\(-/.test(flip.sleeve[0]?.from ?? ''), 'back swings in from the negative side', flip.sleeve[0]?.from);

section('[5] CALM stops motion now, not after this turn');
await settle(TURN);
const calm = await page.evaluate(async () => {
  document.getElementById('rack-next').click();
  await new Promise((r) => setTimeout(r, 100));
  const during = document.querySelector('#rack-sleeve').getAnimations().length;
  (await import('/fx.js')).followLights('calm');   // no switch on screen now; the CALM paths still exist
  await new Promise((r) => setTimeout(r, 60));
  return {
    during,
    after: document.querySelector('#rack-sleeve').getAnimations().length,
    strips: document.querySelectorAll('#strips .strip')[0]?.getAnimations().length ?? -1,
  };
});
check(calm.during === 1, 'a turn was in flight when CALM was pressed', String(calm.during));
check(calm.after === 0 && calm.strips === 0, 'CALM cuts the turn and the cascade dead',
  `page=${calm.after} strips=${calm.strips}`);
await page.click('#rack-next');
await page.waitForTimeout(40);
flip = await readFlip();
check(flip.sleeve.length === 0 && flip.page.length === 0, 'and CALM starts no new turn',
  `sleeve=${flip.sleeve.length} page=${flip.page.length}`);
await page.evaluate(async () => (await import('/fx.js')).followLights('full'));

section('[6] requests slide into UP NEXT instead of teleporting');
const codes = await page.evaluate(() => window.__skateNight.library.tracks.slice(0, 3).map((t) => t.code));
for (const code of codes) {
  await page.click(`#key-letters .key[data-key="${code[0]}"]`);
  for (const digit of code.slice(1)) await page.click(`#key-digits .key[data-key="${digit}"]`);
  await page.click('#btn-select');
  await page.waitForTimeout(140);
}
const queued = await page.evaluate(() => window.__skateNight.state().queue);
if (queued.length >= 2) {
  const moved = await page.evaluate(async () => {
    const rows = () => [...document.querySelectorAll('.q-row:not(.is-house)')];
    document.querySelectorAll('[data-queue-action="up"]')[rows().length - 1]?.click();
    await new Promise((r) => setTimeout(r, 30));
    return rows().map((r) => r.getAnimations().map((a) => a.effect.getKeyframes()[0]?.transform));
  });
  const animating = moved.filter((m) => m.length > 0);
  check(animating.length >= 2, 'reordering animates the rows that moved', `${animating.length} of ${moved.length}`);
  check(animating.some((m) => /translateY\(-?\d/.test(m[0] ?? '')), 'rows travel a measured delta',
    animating.map((m) => m[0]).join(' | '));
} else {
  check(false, 'could not queue two songs to test the reorder', JSON.stringify(queued));
}

section('[7] SELECTION ACCEPTED wipes rather than dissolving');
await page.waitForFunction(() => !document.getElementById('sign-flash').classList.contains('is-on'), null, { timeout: 8000 });
await page.waitForTimeout(150);
const rest = await page.evaluate(() => {
  const s = getComputedStyle(document.getElementById('sign-flash'));
  return { clip: s.clipPath, transition: s.transitionProperty };
});
check(/inset\(0px 0px 0px 100%\)/.test(rest.clip), 'at rest the panel is clipped to its right edge', rest.clip);
check(rest.transition === 'clip-path', 'clip-path alone carries it, with no opacity to fight the wipe', rest.transition);
const wipe = await page.evaluate(async () => {
  const sign = document.getElementById('sign-flash');
  sign.classList.add('is-on');
  const samples = [];
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 20));
    samples.push(getComputedStyle(sign).clipPath);
  }
  sign.classList.remove('is-on');
  return samples;
});
const mid = wipe.find((v) => v !== 'inset(0px 0px 0px 100%)' && v !== 'inset(0px)');
check(Boolean(mid), 'the wipe has intermediate frames (it animates, it does not jump)', mid ?? wipe.join(','));
check(wipe.at(-1) === 'inset(0px)', 'and it settles fully open', wipe.at(-1));

section('[8] a record being picked beats a decorative page turn');
await page.waitForTimeout(400);
const guard = await page.evaluate(async () => {
  const width = () => Math.round(document.querySelector('#rack-sleeve .sleeve').getBoundingClientRect().width * 10) / 10;
  document.getElementById('rack-next').click();
  await new Promise((r) => setTimeout(r, 90));
  const during = { anims: document.querySelector('#rack-sleeve').getAnimations().length, width: width() };
  document.getElementById('btn-skip').click();        // forces mech.swap -> load -> rects()
  await new Promise((r) => setTimeout(r, 40));
  return { during, after: { anims: document.querySelector('#rack-sleeve').getAnimations().length, width: width() } };
});
check(guard.during.anims === 1, 'a turn was in flight when the changer started', JSON.stringify(guard.during));
check(guard.after.anims === 0, 'asking for the sleeve ends the turn, so its box is honest', `${guard.after.anims} left`);
check(guard.after.width > guard.during.width, 'the sleeve reports its full width again, not a squashed one',
  `${guard.during.width}px mid-turn -> ${guard.after.width}px resting`);

section('[9] nothing threw, and nothing unexpected went missing');
check(pageErrors.length === 0, 'no page or console errors', pageErrors.join(' | '));
// sound.js probes sfx/<name>.mp3 first and falls back to the bundled .wav, so
// those 404s are the design working. Anything else 404ing is a real break.
const unexpected = [...new Set(missing)].filter((p) => !/^\/sfx\/[a-z]+\.mp3$/.test(p));
check(unexpected.length === 0, 'the only 404s are the optional sfx overrides',
  unexpected.length ? unexpected.join(' | ') : `${new Set(missing).size} optional sfx probes`);

await browser.close();
console.log(`\n${failures === 0 ? 'ALL MOTION CHECKS PASSED' : `${failures} MOTION CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

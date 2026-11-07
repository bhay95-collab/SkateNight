# Living Jukebox — release candidate

Branch `release/living-jukebox-rc`, rebased onto production `main` `a5b70a1` (V5-B4 cinematic, shell v49). **Not merged or deployed.** Promotion waits on event-hardware acceptance.

## What changes

- **New, optional:** `living-jukebox.html` plus `living/` (runtime code and its visuals). The approved Living Jukebox is Codex's photorealistic cabinet and changer, with Claude's operating platter drive.
- **`mechanism.js`:**
  - an observer that does nothing unless the living page enables it. It sends the changer's existing events and owns no timers.
  - a guard that uses the plain sleeve flight when the sleeve slot has no size. On the living page the old sleeve is hidden, and dividing by its zero width produced `scale(Infinity)` keyframe warnings. Production's slot always has a size, so `index.html` is unaffected.
- **`index.html` is byte-identical to production and remains the show fallback.** So are:
  - the app, player, audio engine, sound effects and ambience
  - the film, its manifest and SHA-256
  - the 50 ms lead
  - `sw.js` (shell v49)
- **Tests and tools:**
  - `tests/engineering-integration.test.js` and `tests/living-drive.test.js`
  - `scripts/check-living-jukebox.mjs` (Chrome acceptance)
  - `scripts/soak-living-jukebox.mjs` (event-length soak)
  - an `--entry` option for `scripts/check-extended-preview.mjs`, so the same PCM timing proof runs against either page
- **Development material stays on `claude/living-jukebox-drive` and Codex's branches**, never in this release: studies, `.blend` scenes, masters, render scripts, review recordings and evidence.
- **Offline storage.** The production worker saves each file it serves. The living page fetches its file list (`living/offline.js`) once online and reports "Jukebox visuals saved offline" under Tools. A test requires every file in `living/` to be on that list, so nothing extra can ship.

| | Size |
|---|---|
| Download, all 43 files (`docs/living-jukebox-release.json` lists each with its SHA-256) | 9.9 MB |
| Decoded images | 202.5 MiB |
|   Codex's change sheets | 131.8 MiB |
|   Platter-drive layers | 39.2 MiB |
|   Plates, tonearm views and masks | 31.5 MiB |

Drive images are pre-rendered at 60 angles per gear, so their lighting stays fixed while the gear turns. The browser rotates only the remainder (at most ±3°).

**Polish decisions**

- **Gear meshing.** The centre distances are correct for full-depth meshing: 26T/32T is 63.07 px against 63.20 required, and the other pairs are within 0.7 px. Changing the phase alters the measured tooth interference by under 0.3%. The tip-on-flank look comes from the authored shallow, rounded tooth profile (about 3 px at 1080p), not from misalignment. A clean fix needs remodelled teeth and a re-render of the hero and every change frame, so it was not done.
- **Gear accent light.** A copy of an existing light, light-linked to the gears only, was tested:
  - the lower service lamp: +1% at 1.2× extra;
  - the tungsten work light: +1% at 1.2×, +4% at 10×.

  A visible lift would need a new light, which changes the approved lighting, so none was applied.
- **Assets left as they are.**
  - **Codex's change sheets:** only 18–33% of each frame changes, so splitting them into changed tiles could save about two-thirds of their memory, but risks blocky noise seams in approved frames.
  - **Drive change backgrounds:** a base plus tiles would save only 40–50%, for the same risk.
  - **Tracking data** went from 442 KB to 32 KB by removing study-only outlines.

## Verified (M2 Pro Mac mini, Chrome 156)

- **Automated tests:** 269/269 pass, and the production motion regression passes.
- **Chrome acceptance** (`scripts/check-living-jukebox.mjs`): everything passed, on both the V4 and the V5-B4 baselines.

  | Area | Result |
  |---|---|
  | Film, 1920×1080 and 1280×720 | The approved film plays to its last frame (1,048–1,050 frames presented). One song at a time. C1 fit at scale 1.000, offset under 0.01 px. No black frames at the reveal. Record, vinyl surface and ambience live. |
  | Drive while playing | Drive minus record angle is constant (0° spread). |
  | Pause | 0° drive movement while paused; 400° in the 1.5 s after resume. |
  | Changes | 9, normal, 1.8× and offline, with 6+ different labels. The drive matches every authored change pose to 1e-12°. One needle drop per change. Changer sounds start 1–21 ms after each move. |
  | Controls | Queue, faders, BACK and SKIP work. Audio sources peak at 12 and do not accumulate. |
  | Offline reload | Film and changes pass. |
  | Missing or corrupt visuals | Music continues in all three cases: missing drive layers fall back to the static plate; a corrupt change sheet or a missing drive module hands the page back to the standard production jukebox screen. |
  | Drive cost | +6 to 15 ms per second of main-thread time (about 1–1.5% of a core). |

- **Opening-song timing** (PCM, 10 offline runs per page in each session):

  | Baseline | Page | Within ±33.3 ms of stylus contact | Range | Median | SD |
  |---|---|---|---|---|---|
  | V5-B4 (`a5b70a1`) | Release candidate | 10/10 | −19.0 to +32.0 ms | +12.3 ms | 11.9 |
  | V5-B4 (`a5b70a1`) | Production | 10/10 | −9.9 to +26.4 ms | +7.3 ms | 11.4 |
  | Earlier, V4 (`bb9e0df`) | Release candidate | 10/10 | −11.5 to +26.4 ms | +8.0 ms | 11.1 |
  | Earlier, V4 (`bb9e0df`) | Production | 10/10 | −4.3 to +20.2 ms | +10.0 ms | 7.7 |

  There is no regression: the spreads match production's. The 50 ms lead is unchanged. Runs near the band edge occur on both pages, from session to session.
- **Soak:** see the end of this file.

## Operator checklist (event MacBook Pro)

Use **Google Chrome** or the installed Chrome app. **Never VS Code's built-in browser:** it cannot play the film's AAC audio and silently shows the old live-cut awakening.

1. **Online, the day before.** Open `https://bhay95-collab.github.io/SkateNight/`. Open Tools and press **Prepare for Show** (or CHECK / DOWNLOAD) until the film reads `VERIFIED - READY OFFLINE … SHA 2A2FCA5B` (V5-B4, `song-inside-35s-v3.mp4`). Press **LOAD THE CRATES** until the top right reads **OFFLINE READY**.
2. **Open `…/SkateNight/living-jukebox.html`.** Under Tools, wait for **Jukebox visuals saved offline**. Repeat this after every deployment.
3. **Turn Wi-Fi off and reload both pages.** Each must load, show OFFLINE READY, and run the complete 35-second film into the jukebox.
4. **Projector.** Check the native resolution: 1280×720 and 1920×1080 are the tested sizes. Check the refresh rate (60 Hz expected; note it if different), mirroring, and that the gears turn smoothly with no judder.
5. **Song timing on the event machine.** The song should land with the stylus touchdown. To measure it, run `node scripts/check-extended-preview.mjs --hosted --entry living-jukebox.html --offline-only --offline-runs 10 --viewports 1920x1080 --out build/event-timing`, then `node scripts/analyse-film-audio-timing.mjs build/event-timing films/manifest.json`. Do the same without `--entry` to measure `index.html`.
6. **PA.**
   - Film-to-song loudness step.
   - PA latency, by watching the stylus touchdown against the first beat.
   - Changer sounds, needle and ambience levels.
7. **Changes.** Make several picks, skip twice (1.8× changes) and let one song end naturally. Check the labels change and the gears turn with the record, stop on pause and wind up after a load.
8. **Fallback.** If anything misbehaves, open `index.html`, the approved production jukebox, which is cached and needs no network. If the film ever shows the old animation, the film is not saved or this is not Chrome: repeat step 1.
9. **Optional diagnostics.** `living-jukebox.html?diagnostics` labels which film plays. `?drive=0` shows Codex's static drive.

## Deploy (after hardware acceptance)

```sh
cd /Users/benjaminhay/SkateNight-release        # the main worktree
git fetch origin && git status                  # clean, and main still a5b70a1
git merge --ff-only release/living-jukebox-rc   # if main has moved: rebase the RC, re-run npm test and the checks
npm test
git push origin main rollback/pre-living-jukebox   # the rollback tag already exists locally at a5b70a1
```

Then:

1. Wait for GitHub Pages.
2. Open `/living-jukebox.html` online and wait for **Jukebox visuals saved offline**.
3. Confirm `index.html` behaves as before.

`sw.js` is unchanged, so installed laptops keep their saved songs, film and shell.

## Roll back

- **On the night:** use `index.html`. It is unchanged and cached.
- **Code:** run `git revert --no-edit a5b70a1..<deployed main>` and push. This removes the living page and the `mechanism.js` observer without rewriting history.
- **Exact restore:** `rollback/pre-living-jukebox` is `a5b70a1`. Earlier tags are unchanged:
  - `rollback/pre-v5-b4-production`
  - `rollback/pre-jukebox-sfx-v2`
  - `rollback/pre-v4-sound`
  - `rollback/pre-song-inside-35`
  - `rollback/pre-v5-sound`

## V5 cinematic audio

V5-B4 was approved and deployed during this work, as production `a5b70a1`: film `song-inside-35s-v3.mp4`, SHA `2a2fca5b…`, shell v49. This release was rebased onto it:

- It keeps V5's films, manifest, `app.js`, `awakening-film.js` and `sw.js` exactly; the test pins them to `a5b70a1`.
- The v3 film keeps the same handoff and cue contract as v2: frame count, stylus contact at frame 948, record block and song start.
- Acceptance and PCM timing were re-run on the V5 baseline (below).

## Outstanding event-hardware checks

All of these are still open:

- MacBook Pro and projector frame cadence
- PCM timing on the event machine
- PA latency and loudness
- a full rehearsal

Workstation results are not a substitute for these.

## Soak

`scripts/soak-living-jukebox.mjs --minutes 120`, at 1920×1080 in headless Chrome, on the V4 baseline (the full log is `build/living-jukebox/soak/soak.json`). The living runtime is identical on V5; only the film's first 35 seconds differ. The run covered:

- the film
- 120 minutes of continuous playback with 34 song changes (natural ends and 17 skips)
- 30 rounds of picks
- 10 pauses of 20 s each

**Passed:**

- **Audio:** 0 stalls, never more than one song playing, and buffer sources peaked at 10.
- **Drive:** stayed locked to the record throughout (largest spread 5×10⁻¹⁰°).
- **Frames:** 127 of 431,423 (0.03%) took longer than 33 ms.
- **Memory:**
  - the JavaScript heap went from 3.7 MB (minute 5) to 4.15 MB (minute 120) after garbage collection;
  - Chrome's resident memory ranged from 1.1 to 1.8 GB with no upward trend (1.27 GB at minute 5, 1.22 GB at the end);
  - DOM nodes went from 1,768 to 2,031 and event listeners from 239 to 285.
- **CPU:** about 158 ms of main-thread time per second on average.
- **Errors:** 0 page errors and no layer failures. The only 404s were the optional custom effect MP3s (`sfx/*.mp3`), which production also requests.

**After the rebase onto V5-B4:** a further 30-minute soak passed, with 9 changes, 0 stalls, the drive locked (spread 1×10⁻¹⁰°), the heap from 3.69 to 3.96 MB, and 0 warnings or errors.

**Fixed after the 2-hour soak:** 102 `scale(Infinity)` warnings from the hidden sleeve slot. With the `mechanism.js` guard there are none on either page. Tests, the motion check and the Chrome acceptance were re-run.

**Limits:** this ran headless on the Mac mini. It does not measure GPU load, projector cadence or audio-device behaviour over a full night on the event MacBook Pro.

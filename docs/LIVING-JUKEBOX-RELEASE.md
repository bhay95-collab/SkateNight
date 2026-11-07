# Living Jukebox — release candidate

Branch `release/living-jukebox-rc`, based on production `main` `bb9e0df`. **Not merged or deployed.** Promotion waits on event-hardware acceptance.

## What changes

- **New, optional:** `living-jukebox.html` plus `living/` (runtime code and its visuals). The approved Living Jukebox is Codex's photorealistic cabinet and changer, with Claude's operating platter drive.
- **`mechanism.js`:** an observer that does nothing unless the living page enables it. It sends the changer's existing events and owns no timers.
- **`index.html` is byte-identical to production and remains the show fallback.** So are:
  - the app, player, audio engine, sound effects and ambience
  - the film, its manifest and SHA-256
  - the 50 ms lead
  - `sw.js` (shell v48)
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
- **Chrome acceptance** (`scripts/check-living-jukebox.mjs`): everything passed.

  | Area | Result |
  |---|---|
  | Film, 1920×1080 and 1280×720 | The approved film (`SHA 402B2CA8`) plays to its last frame (1,048–1,050 frames presented). One song at a time. C1 fit at scale 1.000, offset under 0.01 px. No black frames at the reveal. Record, vinyl surface and ambience live. |
  | Drive while playing | Drive minus record angle is constant (0° spread). |
  | Pause | 0° drive movement while paused; 400° in the 1.5 s after resume. |
  | Changes | 9, normal, 1.8× and offline, with 6+ different labels. The drive matches every authored change pose to 1e-12°. One needle drop per change. Changer sounds start 1–21 ms after each move. |
  | Controls | Queue, faders, BACK and SKIP work. Audio sources peak at 12 and do not accumulate. |
  | Offline reload | Film and changes pass. |
  | Missing or corrupt visuals | Music continues in all three cases: missing drive layers fall back to the static plate; a corrupt change sheet or a missing drive module hands the page back to the standard production jukebox screen. |
  | Drive cost | +6 to 15 ms per second of main-thread time (about 1–1.5% of a core). |

- **Opening-song timing** (PCM, 10 offline runs each, same session):

  | Page | Within ±33.3 ms of stylus contact | Range | Median | SD |
  |---|---|---|---|---|
  | Release candidate (`living-jukebox.html`) | 10/10 | −11.5 to +26.4 ms | +8.0 ms | 11.1 |
  | Production (`index.html`) | 10/10 | −4.3 to +20.2 ms | +10.0 ms | 7.7 |

  There is no regression. The 50 ms lead is unchanged.
- **Soak:** see the end of this file.

## Operator checklist (event MacBook Pro)

Use **Google Chrome** or the installed Chrome app. **Never VS Code's built-in browser:** it cannot play the film's AAC audio and silently shows the old live-cut awakening.

1. **Online, the day before.** Open `https://bhay95-collab.github.io/SkateNight/`. Open Tools and press **Prepare for Show** (or CHECK / DOWNLOAD) until the film reads `VERIFIED - READY OFFLINE … SHA 402B2CA8`. Press **LOAD THE CRATES** until the top right reads **OFFLINE READY**.
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
git fetch origin && git status                  # clean, and main still bb9e0df
git merge --ff-only release/living-jukebox-rc   # if main has moved: rebase the RC, re-run npm test and the checks
npm test
git push origin main rollback/pre-living-jukebox   # the rollback tag already exists locally at bb9e0df
```

Then:

1. Wait for GitHub Pages.
2. Open `/living-jukebox.html` online and wait for **Jukebox visuals saved offline**.
3. Confirm `index.html` behaves as before.

`sw.js` is unchanged, so installed laptops keep their saved songs, film and shell.

## Roll back

- **On the night:** use `index.html`. It is unchanged and cached.
- **Code:** run `git revert --no-edit bb9e0df..<deployed main>` and push. This removes the living page and the `mechanism.js` observer without rewriting history.
- **Exact restore:** `rollback/pre-living-jukebox` is `bb9e0df`. Earlier tags are unchanged:
  - `rollback/pre-jukebox-sfx-v2`
  - `rollback/pre-v4-sound`
  - `rollback/pre-song-inside-35`
  - `rollback/pre-v5-sound` (Codex's, also `bb9e0df`)

## V5 cinematic audio

`codex/cinematic-sound-v5` holds V5-B auditions on top of `bb9e0df` and is not approved or deployed; the live film is V4 (`…native30-v2`). This release does not touch films, the manifest or the film player. An approved V5 that keeps the same manifest contract (frame count, cues, C1 record block) works with the living page unchanged. Re-run the PCM timing and acceptance checks when it lands.

## Outstanding event-hardware checks

All of these are still open:

- MacBook Pro and projector frame cadence
- PCM timing on the event machine
- PA latency and loudness
- a full rehearsal

Workstation results are not a substitute for these.

## Soak

Pending: the 120-minute run is in progress.

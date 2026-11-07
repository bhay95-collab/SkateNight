# Release, validation and rollback

Production is `main`, published by GitHub Pages to
`https://bhay95-collab.github.io/SkateNight/`. There is no build step: what is in
`main` is the site.

## Current release

| | |
|---|---|
| Default page | Photorealistic jukebox (`index.html` + `living/`) |
| Fallback page | `classic-jukebox.html` (the previous `index.html`, unchanged) |
| Film | V5-B4, `films/song-inside-35s-v3.mp4`, SHA-256 `2a2fca5bededb3751e51c5779b1e24a893e7bcba060bcccd42633bbd2d627b61` |
| Rollback film (published) | V4, `films/song-inside-35s-v2.mp4`, SHA-256 `402b2ca8…` |
| Shell cache | `skatenight-shell-v50` (`sw.js`) |
| Song lead | 50 ms (`NATIVE30_MEDIA_STARTUP_LEAD_MS` in `app.js`; unchanged) |

## Rollback tags

| Tag | Restores |
|---|---|
| `rollback/pre-final-production` | the last release before the photorealistic default (V5-B4, classic page as `index.html`) |
| `rollback/pre-living-jukebox` | the same commit (`a5b70a1`) |
| `rollback/pre-v5-b4-production` | V4 film production |
| `rollback/pre-v5-sound` | before the V5 sound work |
| `rollback/pre-jukebox-sfx-v2` | before the recorded changer and ambience |
| `rollback/pre-v4-sound` | before Sound Design V4 |
| `rollback/pre-song-inside-35` | before the 35-second film |

## Validation gates

Run in a clean worktree of the candidate:

```sh
npm test                                   # unit and contract tests (Node's built-in runner)
python3 -m http.server 8080 --bind 127.0.0.1 &
npm run test:motion                        # Chrome motion regression against the classic animations
node scripts/check-living-jukebox.mjs --previous <checkout of the live build>
                                           # Chrome acceptance: upgrade from the live build, installability,
                                           # film at 1280x720 and 1920x1080, drive, changes, controls,
                                           # offline, classic fallback, missing/corrupt visuals, cost
node scripts/check-extended-preview.mjs --hosted --offline-only --offline-runs 10 --viewports 1920x1080 --out build/timing-default
node scripts/analyse-film-audio-timing.mjs build/timing-default films/manifest.json
node scripts/check-extended-preview.mjs --hosted --entry classic-jukebox.html --offline-only --offline-runs 10 --viewports 1920x1080 --out build/timing-classic
node scripts/analyse-film-audio-timing.mjs build/timing-classic films/manifest.json
                                           # PCM song timing: 10 offline runs each, stylus contact +/-33.3 ms
node scripts/soak-living-jukebox.mjs --minutes 120   # event-length soak (independent process)
```

The PCM analysis is authoritative. The checker's coarse media-clock estimate can
flag about -40 ms on a run whose PCM measurement is in band; record such
outliers, do not chase them.

## Deploy

```sh
git fetch origin
git switch main && git merge --ff-only <release branch>   # main must not have moved; otherwise rebase and re-validate
git tag rollback/pre-<name> <previous main>
git push origin main rollback/pre-<name>
```

Then confirm the Pages build finished (`gh api repos/bhay95-collab/SkateNight/pages/builds/latest`),
and on the live URL: the shell version in `sw.js`, `films/manifest.json`, the
default page and `classic-jukebox.html`, and an offline reload of an installed
copy.

## Roll back

- **On the night:** open `classic-jukebox.html`. It is precached, offline and
  needs no Git.
- **Code:** `git revert --no-edit <tag>..main` and push. History is kept; Pages
  republishes the earlier site. Bump `SHELL_CACHE` if the revert does not.
- **Film only:** restore the earlier manifest from history
  (`git show <tag>:films/manifest.json > films/manifest.json`), the matching
  film ID in `awakening-film.js` and `SHELL_CACHE`, keep the crate cache, push,
  then CHECK / DOWNLOAD on each laptop. V4 is still published; every film and
  manifest is also in `~/SkateNight-Archive/cinematic/films/` with checksums.

## Promoting a new film

```sh
npm run cinematic:promote -- film.mp4 film.mp4.json --confirm-approved --approved-by "Name" --source-commit <sha>
```

This writes an immutable `films/song-inside-35s-vN.mp4` and `films/manifest.json`.
Keep the MP4 under 50 MiB. Re-run the acceptance and PCM timing gates; the
photorealistic layer needs no change while the handoff contract (frame count,
stylus contact, registration, C1 record block) is unchanged.

## Release history

- **Final production** - photorealistic jukebox as the default page,
  classic fallback, shell v50, repository cleanup (this release).
- **V5-B4** (`a5b70a1`) - film v3 with Sound Design V5-B4.
- **Jukebox SFX v2** (`bb9e0df`) - recorded changer, needle, living-machine ambience.
- **Sound Design V4** (`252123c`) - film v2.

# The Song Inside — 35-second film at native 30 fps

The filename retains the requested `35FPS` spelling. The film is **35 seconds at 30 fps**, with **1,050 frames**. It is an isolated production development version of *Skate by Faith — Not by Sight*.

**The technical cadence checkpoint clears the retained source sequence and encodes.** The historical late-overlap event is a delayed Chrome picture submission: the next moving image arrives one native period late. Its internal trigger remains unknown and it has not reproduced in the new controls. No evidence-backed playback patch is justified by the current evidence. The approved 35-second structure, finishing cut, C1 and playback calibration remain fixed. No complete final-resolution film has been rendered, promoted, published or installed as the default.

The finished-movie proxy retains four passing online cases, all ten passing offline first-hit PCM checks at the unchanged ±33.333 ms band, and all fourteen passing landing/control checks. The original offline PCM/output-clock errors remain **−13.738 / +10.3485 / +22.264 ms minimum/median/maximum**. The unchanged coarse checker still exits 1. This checkpoint explains its two media-estimate failures and the later 66.7 ms picture delay without changing their recorded results or the primary acceptance band. No retained gap between successive registration pictures spans two native periods. Rare Chrome/platform cadence, full-resolution inspection and physical projector/PA acceptance remain qualified below.

## Source and preservation

- Worktree: `/Users/benjaminhay/SkateNight-30fps-study`
- Branch: `codex/awakening-30fps-study`
- Starting experimental commit: `df26607`
- Earlier verified implementation: `13df8705f90b2ad6ca2a3c70cd34c69c53e7084c` (`Develop 35-second native30 cinematic production pipeline`)
- Targeted finishing started from: `b98819e717d073b30cba929722cd50a01d35665d`
- **Verified finishing implementation and rendered-media provenance: `1af1dbd445fbf732995f4f3f45c27f8183189576`**
- Cadence checkpoint started from handoff commit: `b9ded08`
- Cadence diagnostic implementation: `5616c3620395826075489cd768eee54e66a86769`

The finishing implementation commit records the twelve frozen files used for the render and application tests; their bytes were verified unchanged after the commit. The cadence checkpoint adds a read-only diagnostic helper and its tests. It changes no scene, cue, runtime player, audio scheduling, movie or manifest. This handoff is recorded by a later documentation-only commit. Use `1af1dbd` and the recorded source/asset fingerprints to identify the existing finished development cut; the diagnostic commit does not become its render provenance. A future full render must record its own current source inventory and fingerprints. Preserve the existing render state and fingerprints as historical evidence.

The approved original remains in `/Users/benjaminhay/SkateNight`, on `codex/awakening-final-prep` at `0c99f8befe80ebe4a6ea7e3c6c3432ad05c70bc8`. Its pre-existing uncommitted changes and `.playwright-mcp/` are preserved. The final original-worktree comparison matches all eleven file hashes recorded at the start, including the two pre-existing dirty files, and its HEAD remains unchanged. The original 19.25-second/60-fps builders, production cues and source movie remain the source of the approved coin/C1 elements. The separate photorealistic experiment is outside this change.

Build media are ignored local files. Keep the worktree and original source assets together until the render is packaged. The source commit does not contain the rendered movies, original song MP3, or all source textures.

| Source | Responsibility |
|---|---|
| `cinematic/extended/cues.json`, `timeline.py` | Authoritative timing, sample mapping and locked manifest/C1 validation |
| `cinematic/extended/render_scene.py` | Native30 Blender entry point, approved C1 mapping, per-frame setup and checks |
| `cinematic/extended/mechanical.py`, `changer.py`, `vinyl_world.py` | Hall recovery, physical carousel, groove environment and continuous camera |
| `cinematic/extended/render_cabinet.mjs` | Native browser-rendered coin opening and transition plates |
| `cinematic/extended/audio.py` | Reproducible effects/review WAVs and dependency provenance |
| `cinematic/extended/render_production.py`, `assemble.py`, `review.py` | Preflight, resumable rendering, encoding, manifests, checksums and review package |
| `app.js`, `awakening-film.js` | Opt-in native30 playback, song scheduling, OPFS validation, registration and fallback |

The new builders reuse the unchanged `cinematic/story_megastructure.py`, `hero_megastructure.py`, `hero_groove.py`, `kit.py`, `sound_bed.py` and existing study helper functions. The extended manifest supplies the selected 35-second timing; the earlier 38.5-second study is not the timing authority.

## Review package and acceptance status

The preserved complete baseline is `build/awakening-35-production/final-preview-v1/`. Its [baseline review page](build/awakening-35-development/final-review-v1/index.html) contains the complete song review, native clips, selected 1080p stills, comparisons, actual application ending and the original offline failure. Keep it for comparison; it is not the newly finished cut.

The finishing outputs use fresh roots:

| Deliverable | Evidence or present state |
|---|---|
| Targeted native30 groove-to-stylus clip | [`groove-to-stylus-native30.mp4`](build/awakening-35-finishing/v1/groove-to-stylus-native30.mp4); frames 655–948 inclusive, 294 frames / 9.8 seconds, with review audio |
| Revised 1920×1080 / 96-sample vinyl spots | `build/awakening-35-finishing/v1/quality/vinyl/`; frames 680, 868 and 907 completed and passed selected-still inspection |
| Fresh complete 480×270 / 4-sample preview | [`finishing-preview-v1/`](build/awakening-35-production/finishing-preview-v1/); all 1,050 frames rendered and both complete movies encoded |
| Fresh local review package | [`final-review-v1/index.html`](build/awakening-35-finishing/final-review-v1/index.html); full song review, four native clips, comparisons and current final-quality spots; 57 local references checked |
| Fresh final-quality preflight | [`final-1080-v2/preflight.json`](build/awakening-35-production/final-1080-v2/preflight.json) passed with Metal; zero image frames rendered |
| Pipeline CPU regressions | 17 pipeline Python tests and 3 earlier-study tests passed in fresh independent verification |
| Browser/application CPU regressions | 235 Node tests pass, including 10 cadence diagnostic tests |
| Ten baseline offline reloads | One run fails the existing dual-estimate gates; preserved independently from candidate results |
| Ten candidate offline reloads | All ten pass the existing dual-estimate gates and independent PCM/output-clock ±33.333 ms check |
| Finished movie application checks | Four online cases pass; ten offline first-hit PCM checks and all fourteen landing/control checks pass; coarse whole-overlap checker remains exit 1 |
| Cadence source and encoding audit | All 444 vinyl PNGs and all 1,050 decoded pictures in each of three retained movies are unique; picture/audio timestamps are continuous |
| Fresh cadence controls | Eight full-start bare replays pass; fresh PWA and long-PCM results are detailed below |
| Full-resolution full-cut inspection | Deferred to a separately authorized final render |
| Operator listening and projector/PA calibration | Requires operator listening and venue hardware |

Both complete finishing movies contain 1,050 native frames at 30 fps and run 35.0 seconds. The review generator verified the frame count, rate, source hashes and effects-only song ownership; both full exports and all four review clips passed error-fatal FFmpeg decode. A 1080p development proxy is a spatial enlargement of the 480×270 images and adds no final-render detail. No temporal interpolation or frame-rate conversion is permitted.

The standalone film ends with the registered record over black; the application supplies the real jukebox beneath the final crossfade. The refreshed review includes the baseline comparison, preserved earlier ending context and the [actual finishing-proxy jukebox ending](build/awakening-35-finishing/integration-finishing-preview-v1/1920x1080-revealed.png). Native-motion clips and selected stills supplement the complete cut; they do not establish approval of every image or replace a normal-speed audiovisual screening.

The baseline [`assembly-report.json`](build/awakening-35-production/final-preview-v1/assembled/assembly-report.json) preserves source provenance and movie checksums. Baseline effects SHA-256: `bf5d2a0dbf9406c218d79ffdce0de2fb6cdd47d977e57cbb3b00734d126a723c`; baseline song-review SHA-256: `0f6db1d536f401f46cf33f94c8781c7768b2cc75ae764481c6ffb403493a330f`. The finishing [`assembly-report.json`](build/awakening-35-production/finishing-preview-v1/assembled/assembly-report.json) records effects SHA-256 `74cedcbf2e23c76d1ac2691c9934e2b8108b11c1c4cad6b81e7b6d0ec4e2f0d8` and song-review SHA-256 `ac6f08e7d617f52a12d54799aa93528f75902a77bdccc8f672b4ca976d7318c2`. Its [review report](build/awakening-35-finishing/final-review-v1/review-report.json) records all four clip hashes and exact native ranges; [package verification](build/awakening-35-finishing/final-review-v1/package-verification.json) records the six successful movie decodes and refreshed local reference check. The independent [final artifact verification](build/awakening-35-finishing/v1/final-artifact-verification.json) confirms all 1,050 PNGs and current four-shot fingerprints against 162 source/asset file hashes per state, native packet PTS/durations, exact WAV provenance, valid proxy manifest and bit-identical copied AAC packets in the proxy. The proxy SHA-256 is `11eee99f6b38a45276ce60152d578597eeb0f536ae9b81152f3745f72c735f61`.

| Fresh review clip | Inclusive native range | Frames / duration |
|---|---|---|
| Carousel | 456–605 | 150 / 5.0 s |
| Groove world | 606–914 | 309 / 10.3 s |
| Groove exit to stylus | 813–948 | 136 / 4.533333 s |
| C1 contact and registration | 915–1049 | 135 / 4.5 s |

## What changed in the film

The approved industrial interior, failed ignition, return and recovery now drive a visible transfer shaft, bearings and index mechanism. The carousel uses the actual 60-slot source mechanism. This deliberate choice retains the working mechanical assembly and gives the wide reveal sixty physical records, rather than adding ten decorative copies to match the approximate seventy-record brief. Records, labels, shoes and pins move with the indexed magazine. The fixed motor housing stays fixed. A two-turn shaft drive, enclosed 8:1 reduction, quarter-turn 24-tooth pinion and 360-tooth internal ring produce a six-degree index and settle at frame 455.

The hall-to-carousel join uses a foreground metal housing wipe across frames 398–411. The two approved scene builders have different world scales; the wipe makes that transition explicit and visually connected. The same paper-labelled record presentation carries into the selected record. Printed labels and pressed groove bands replace the greybox discs.

The descent, hidden world, escape and stylus approach occupy one rotating record coordinate system. The rounded V-shaped channel has .4 pitch, .13 depth and .26 width in the source scene units. Five recessed service stations, wall ribs, brass fasteners, conduits, handrails, a gantry and a low inspection carriage give the groove a readable scale. The camera travels about 2.75 scene units during the 5.27-second flight. It follows the modulated channel with at least .051 floor clearance in the sampled quarter-frame checks.

The exit now holds an existing amber service station as a visible landmark on the rotating record. During frames 813–890 the camera follows that same material point as the station and curved valley shrink into the surrounding grooves. It rises and retreats on the same side of the channel, then eases into the exact frame-915 source camera. The path has no added city or station population.

The true .13-depth groove stays open during the emergence. A bounded material cutout in the original record base and groove patch prevents that skin from filling the local valley while leaving the surrounding record present. The old 813–867 depth collapse and 850–868 surface blend are superseded. The local sector and original skin now crossfade only across frames 905–914, after the landmark is hidden by the physical wall in the sampled camera rays. Original materials, geometry visibility and lighting return at frame 915.

Broad local grazing fill, restrained amber counter-light and a temporary surface rake make the walls, hardware and receding spiral easier to read. A small local charcoal-blue reflectance increase and broader reflections support that change. Global exposure and world lighting remain unchanged; the carousel and approved C1 use their original materials.

Fresh CPU verification compared all 135 C1 integer samples, global 915–1049, with their approved source camera and record poses. Position, orientation, lens and record angle errors are zero at those evaluated samples. This preserves the source pose sequence at native30, including an explicit final source-frame 443 sample. It does not establish that every subframe of the retimed motion blur is byte-identical to the original render.

The final exit proof evaluates 408 quarter-frame samples, with minimum floor clearance .055 scene units. All 40 quarter-frame landmark checks across 905–914.75 are occluded by the groove wall. Independent checks also verified 20/20 protected source hashes in both worktrees. These geometric checks support the selected image and motion evidence; they do not replace full-cut viewing. Evidence: `build/awakening-35-finishing/v1/final-cpu-validation/` and `final-verification-protected.json`.

Implementation detail and geometry qualifications: [scene development](cinematic/extended/SCENE_DEVELOPMENT.md).

## One timeline contract

[`cinematic/extended/cues.json`](cinematic/extended/cues.json) is authoritative. Renderer, audio, assembly and application manifest generation consume it through [`timeline.py`](cinematic/extended/timeline.py). Do not independently edit exported movie JSON to alter timing.

| Event | Native frame or exact time |
|---|---:|
| Cabinet/browser opening | 0–92 |
| Interior story | 93–404; 312 frames |
| Transfer/carousel | 405–605; 201 frames |
| Record world and C1 | 606–1049; 444 frames |
| Coin impact | Exact audio 5.25 s; nearest visual frame 158 / 5.2666667 s |
| Relay engages | 164 / 5.4666667 s |
| First start attempt | 179 / 5.9666667 s |
| Almost catches | 231 / 7.7 s |
| Ignition fails | 249 / 8.3 s |
| Recovery tick | 267 / 8.9 s |
| Mechanism catches | 276 / 9.2 s |
| Recovery heartbeats | 288, 312, 331, 347 / 9.6, 10.4, 11.0333333, 11.5666667 s |
| Recovered ignition | 361 / 12.0333333 s |
| Drive transfer | 405 / 13.5 s |
| Carousel discovery | 456 / 15.2 s |
| Active record | 576 / 19.2 s |
| Descent begins | 606 / 20.2 s |
| Groove flight | about 655 / cue 21.8354916067 s |
| Escape begins | about 813 / cue 27.1136690647 s |
| C1 approach | 915 / 30.5 s |
| Song playback starts | exact audio time 31.393 s; not frame-quantized |
| Diamond contact / song first hit | 948 / 31.6 s |
| Registration begins | 1028 / 34.2666666667 s |
| Last sampled image | 1049 / 34.9666666667 s |
| Encoded endpoint | 35.0 s |

Visual cue rounding is nearest frame, half upward. A frame samples `frame / 30`; its display interval lasts 1/30 second. The encoded song overlap is 3.607 seconds. The final sampled image occurs 3.5736667 seconds after song playback starts. Those are different intervals and should not be described as one exact 3.58-second overlap.

The locked live record registration is `cx=.603125`, `cy=.39018517953378185`, `r=.047135416666666666`, CSS angle `91.0557374652127°`, at 45 rpm. Blender's final evaluated angle differs only at float precision. Source approach frames 175,177,…239 map to global 915–947; source 240,242,…440 map to 948–1048; global 1049 explicitly samples source 443.

Preflight rejects altered registration, rotation speed, phase, preview identity or unsupported manifest metadata before it invokes browser dependencies. Negative fixtures cover changed values, numeric strings, booleans, missing record metadata and nonfinite numbers. The checked cue file retains the approved values.

## Sound ownership and listening

The deployment/application film contains cinematic effects and atmosphere only. **Praise Lifted On High stays in the jukebox audio engine.** The song-containing MP4/WAV exists for review and receives no importable deployment manifest.

Both WAVs are 48 kHz, stereo PCM16, exactly 1,680,000 samples / 35 seconds. The song begins at sample 1,506,864. Its .207-second first hit lands at sample 1,516,800, exactly 31.6 seconds. The audio generator uses a fixed seed and records source, helper, cue, WAV and asset hashes. A resume validates those hashes before retaining files.

The preserved baseline development mix measured effects-only **−26.5 LUFS integrated / −6.8 dBTP**, and review-with-song **−23.6 LUFS / −5.8 dBTP**. These are the development mix's measured levels, not a venue loudness target. The 8.62–8.9-second failure gap is silent; the effects bed is fully ducked from 32.6 seconds to the endpoint.

The baseline encoded AAC checked with the same FFmpeg `ebur128=peak=true` method measured effects-only **−26.5 LUFS / −6.7 dBTP**, and review-with-song **−23.6 LUFS / −5.9 dBTP**. See [`encoded-audio-qa.json`](build/awakening-35-development/final-review-v1/encoded-audio-qa.json). Metering and successful decode do not establish subjective listening approval.

Listen to the complete song review on headphones and the intended speakers. Check the failed start and quiet gap, the recovery pulse, the drive's movement into the carousel, the scale change in the groove, and the contact transient against the first song hit. Confirm that the hidden-world resonance does not mask the story or become tiring. In the application, verify that one song continues through registration, effects remain separate, and transport/fader controls work after release. Finish with the projector and PA connected so their real latency can be measured.

## Render settings and measured cost

Final settings are Cycles Metal, 1920×1080, 30 fps, 0.5-frame shutter / 1/60-second exposure, story 128 samples and changer/vinyl 96 samples. The inexpensive complete development pass uses 480×270 and 4 samples. Spatial enlargement of that pass to a 1080p application proxy adds no final render detail.

The machine is an M2 Pro Mac with 16 GiB unified memory. Run Blender pixel work and Chrome compositor acceptance tests serially. Earlier overlapping work caused compositor stalls and a Metal process failure; simultaneous acceptance/render work is not a valid timing benchmark.

The previous 19-hour study and the baseline 33.22-hour spot estimate used earlier exit geometry. Keep those reports as history; neither is the finishing estimate. The revised [`review.py`](cinematic/extended/review.py) weights 312 story, 201 changer and 444 vinyl frames, with a separate ten-frame skin blend at 905–914. It splits descent, flight, exit and C1 instead of assigning every vinyl frame the cost of one still.

The finishing spot-based Blender estimate is **38.03 hours**, with a planning allowance of **27.55–59.00 hours**. The [cost report](build/awakening-35-finishing/final-cost-v1/render-cost.md) and its JSON companion use `build/awakening-35-finishing/v1/quality` as the primary root, with unchanged story/changer/C1 spots from `v12/final-1080-spots` and the corrected shaft from `v15/corrected-1080-spots`. Current primary samples win within each phase, and the superseded exit spots at 840 and 867 do not determine the revised exit/blend estimate.

| Phase | Frames | Measured frame(s) | Seconds per frame | Estimated hours |
|---|---:|---|---:|---:|
| Story | 312 | 380 | 205.15 | 17.78 |
| Changer | 201 | 480, 542 | 69.54 | 3.88 |
| Vinyl descent | 49 | 680, borrowed | 182.25 | 2.48 |
| Groove flight | 158 | 680 | 182.25 | 8.00 |
| Groove exit | 92 | 868 | 157.89 | 4.03 |
| Skin blend | 10 | 907 | 94.93 | 0.26 |
| C1 approach and contact | 135 | 948, 1049 | 42.44 | 1.59 |

The three new 1920×1080 / 96-sample images were inspected: flight frame 680 took 182.25 seconds with 3.50 GiB process peak RSS, exit frame 868 took 157.89 seconds with 3.67 GiB, and blend frame 907 took 94.93 seconds with 4.39 GiB. The historical story spot still accounts for 17.78 hours of the estimate; descent borrows the current flight measurement, and C1 averages the unchanged contact and landing samples. These sparse inputs limit precision. Across all selected historical/current samples the observed process peak RSS is 4.85 GiB.

Cost inputs require positive render wall time, nonzero image bytes and a CRC-valid 1920×1080 PNG at 128 story samples or 96 changer/vinyl samples. Validation-only runs are excluded. The report identifies borrowed phase measurements and the real image/report paths. Its planning allowance uses 75% of each phase's observed minimum through 150% of its maximum; it is not a statistical confidence interval. Browser capture, encoding, validation, restarts and overnight thermal changes remain additional work. Process peak RSS does not measure all Metal/unified GPU allocations.

## Commands for the next operator

Run from the isolated experimental worktree. The assets root deliberately points to the original project, which holds ignored source media and textures. Do not run the full-resolution command during this development assignment.

```sh
cd /Users/benjaminhay/SkateNight-30fps-study

# Dependency, source-asset, codec, Metal and storage preflight; no image rendering.
python3 cinematic/extended/render_production.py \
  --assets-root /Users/benjaminhay/SkateNight \
  --output-dir build/awakening-35-production/final-1080-v2 --check

# Future authorized complete final-quality render; native30 throughout.
python3 cinematic/extended/render_production.py \
  --assets-root /Users/benjaminhay/SkateNight \
  --output-dir build/awakening-35-production/final-1080-v2 --render-full

# Resume the same source/assets/settings after interruption.
python3 cinematic/extended/render_production.py \
  --assets-root /Users/benjaminhay/SkateNight \
  --output-dir build/awakening-35-production/final-1080-v2 --render-full --resume
```

The runner keeps persistent unique logs in the render root's `logs/`. It fingerprints source content, browser dependencies, external assets, prepared transition textures and render settings. It rejects stale or unproven frame directories. Resume checks PNG CRCs and dimensions, preserves valid frame bytes/mtimes, and rerenders missing or corrupt frames through temporary files. A source or settings change needs a new render version. Do not delete state files to bypass that refusal.

At 1920×1080 the preflight storage allowance is about 13.69 GiB; low-resolution work has a 4 GiB minimum. Allow further room for exports, old versions, application proxies and render diagnostics. Use the actual `preflight.json` for current free space and dependency versions. Keep source assets unchanged for a resumable production run.

The earlier `final-1080-v1` preflight passed with Blender 5.2.3 and Cycles Metal on `Apple M2 Pro (GPU - 16 cores)`. The fresh finishing `final-1080-v2` preflight passed with required tools/assets present and the same Metal device. It recorded 204.08 GiB free against a 13.69 GiB allowance. The root contains only `preflight.json`, with zero rendered image frames.

If all frames and audio already exist but assembly stopped, preserve successful exports and select a fresh export directory:

```sh
python3 cinematic/extended/render_production.py \
  --assets-root /Users/benjaminhay/SkateNight \
  --output-dir build/awakening-35-production/final-1080-v2 \
  --assemble-only --skip-metal-check \
  --export-root build/awakening-35-production/final-1080-export-v2
```

Assembly validates current frame provenance, every PNG, exact WAV lengths and dependency hashes. It encodes exactly 1,050 source frames as H.264 High/yuv420p with AAC 48 kHz stereo, then verifies dimensions, 30/1 frame rate, duration and frame count. Existing successful movies and sidecars are refused and preserved. The effects-only sidecar and `assembly-report.json` contain SHA-256 checksums; preserve them with the MP4.

To reproduce the inexpensive full preview in a fresh version, then build its local review package:

```sh
python3 cinematic/extended/render_production.py \
  --assets-root /Users/benjaminhay/SkateNight \
  --output-dir build/awakening-35-production/finishing-preview-v1 \
  --width 480 --height 270 --samples 4 --importable-proxy

python3 cinematic/extended/review.py \
  --render-root build/awakening-35-production/finishing-preview-v1 \
  --quality-root build/awakening-35-finishing/v1/quality \
  --supplement-quality-root build/awakening-35-development/v12/final-1080-spots \
  --supplement-quality-root build/awakening-35-development/v15/corrected-1080-spots \
  --output-dir build/awakening-35-finishing/final-review-v1
```

Add `--export-root` to the review command if assembly used a separate export root. If later corrective quality spots live in a new root, use that as `--quality-root` and retain unchanged older spots with `--supplement-quality-root OLD_ROOT`. Their real paths and measurements remain in the report; the primary root wins duplicate frame numbers. Review output directories are also preserved; choose a new version for a repeat. Clips trim native frame ranges without interpolation, frame dropping or frame-rate conversion. The HTML package links to its source movies, WAVs, manifests and quality stills instead of duplicating those assets.

CPU checks:

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
npm test
```

## Application integration and offline use

Import the verified **effects-only** 1920×1080 MP4 and its `.mp4.json` through **TOOLS → IMPORT FILM + MANIFEST**. A 480p development export is deliberately not importable; the clearly labelled `technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4` is a one-to-one spatial upscale for this test. Its manifest identifies `qualityTier: development-proxy` and retains the underlying frame provenance.

**PREVIEW EXTERNAL FILM + SONG HANDOFF** is the explicit operator test. For the ordinary coin workflow, use `?film=extended35` after import. The default URL retains the approved 60-fps film. The native30 exception is limited to the exact experimental film ID, timeline, effects-only ownership and C1 contract. Missing/invalid preview assets use the approved or live fallback. `?film=extended35&live=1` selects the live path. No hosted/default film promotion is part of this work.

Use **LOAD THE CRATES** before disconnecting. The movie and manifest persist in OPFS; song crates and the application shell have their existing offline paths. Check an actual offline reload, normal coin insertion, song overlap and controls. The private-profile test below does not alter the operator's real Chrome profile.

```sh
# Four online viewports and missing-film fallback.
node scripts/check-extended-preview.mjs --skip-offline \
  --movie build/awakening-35-production/finishing-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4 \
  --manifest build/awakening-35-production/finishing-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4.json \
  --out build/awakening-35-finishing/integration-finishing-preview-v1

# Ten offline reloads in their own capture population.
node scripts/check-extended-preview.mjs --offline-only --offline-runs 10 --viewports 1920x1080 \
  --movie build/awakening-35-production/finishing-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4 \
  --manifest build/awakening-35-production/finishing-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4.json \
  --out build/awakening-35-finishing/integration-finishing-offline-v1

node scripts/analyse-film-audio-timing.mjs \
  build/awakening-35-finishing/integration-finishing-offline-v1 \
  build/awakening-35-production/finishing-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4.json

node scripts/check-extended-preview.mjs --fault-only --viewports 1920x1080 \
  --movie build/awakening-35-production/finishing-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4 \
  --manifest build/awakening-35-production/finishing-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4.json \
  --out build/awakening-35-finishing/integration-finishing-decode-fallback-v1
```

The online batch covers 1920×1080, 1440×900, 1280×800 and 1024×768. Keep its captures separate from the ten offline runs: the frozen PCM analyser requires exactly ten unique run identifiers and rejects a combined fourteen-capture population. The fault case fails decoding after opener preparation but before the song gate opens; it must release the gate, play one opener, reveal the live cabinet and restore controls.

Native30 now uses one authoritative presented-frame callback and an absolute `expectedDisplayTime` deadline for the cue. It accounts for elapsed callback time instead of starting a fresh relative wait after callback delivery. The competing native30 `timeupdate` cue path is removed. The approved legacy60 path and its 17 ms calibration remain unchanged.

The named native30 1.5-frame / 50 ms lead is also unchanged. Independent PCM matching measured play-to-audible startup beyond the reported sink at 31.87 / 47.42 / 58.99 ms minimum/median/maximum on this workstation. That combines buffering, compressor delay and startup/task phase; it is not a frame-quantisation constant or a portable venue guarantee. Reports retain the existing media-clock and presented-frame estimates and enforce the same ±33.333 ms gates.

The original actual-film baseline remains in [`integration-final-preview-v1/final-verification-summary.json`](build/awakening-35-development/integration-final-preview-v1/final-verification-summary.json). All five baseline viewport/offline cases presented all 1,050 unique frames with zero decoder drops and all 22 registration samples. Four online cases passed timing, while offline failed the media estimate at −40.56 ms and passed the presented estimate at −31.54 ms. Missing-film fallback and the 4.177-second before-gate decode recovery are retained. Its [revealed jukebox screenshot](build/awakening-35-development/integration-final-preview-v1/1920x1080-revealed.png) preserves the application ending context.

A separate ten-reload baseline batch reproduced one failure on each existing timing estimator; the corrected ten-reload batch passed both estimators in every run. The batches are independent, not paired causal matches. Independent analysis matched decoded source music against music-bus and post-limiter PCM, confirmed the 288-sample / 6 ms limiter delay in all twenty captures, and mapped the output clock without adding sink/base/compressor latency twice.

| Offline batch | PCM/output-clock minimum | Median | Maximum | P95 absolute | Failures at ±33.333 ms |
|---|---:|---:|---:|---:|---:|
| Baseline, 10 runs | −29.330 ms | −7.9295 ms | +6.892 ms | 29.330 ms | 0/10 |
| Corrected, 10 runs | −10.548 ms | +4.997 ms | +12.053 ms | 12.053 ms | 0/10 |

Positive error means audio late. P95 uses nearest rank; with ten observations it is the largest observed absolute error, not a precise population-tail estimate. PCM/output-clock matching measures the software path, not physical acoustic output. Baseline PCM passes do not erase the existing estimator failure. Candidate run 03 also contains a 66.6 ms hold after contact that moves its later display epoch without skipping a frame; that cadence evidence remains reported alongside the first-hit measurement.

Evidence: [`timing-baseline-offline/`](build/awakening-35-development/timing-baseline-offline/), [`timing-candidate-offline/`](build/awakening-35-development/timing-candidate-offline/), and the independent [distribution audit](build/awakening-35-development/timing-candidate-offline/independent-timing-distribution.md) with its JSON companion and capture checksums. These earlier actual-film batches remain the separate baseline/candidate comparison; the fresh finishing-proxy batch below validates the final media asset. Further detail: [PWA integration](cinematic/extended/PWA_INTEGRATION.md).

The retained checker keeps its original two-frame presentation-gap bound, native frame advances, actual presentation of frame 1049, a ready live background and exposed-record phase. Direct inspection is stricter than that permissive bound: all fourteen retained registration windows have 22 consecutive single-picture samples and a maximum 33.4 ms interval. None contains a two-period registration hold. Complete frame coverage and zero decoder drops alone do not establish uniform cadence elsewhere.

## Finished-movie first-hit and landing results

The fresh proxy was imported into the actual application and checked at four online viewports, followed by ten independent offline OPFS reloads and a separate before-gate decode fault. Source hashes match the frozen candidate and remained unchanged throughout these tests. No offset, tolerance or source change was made to turn a result into a pass.

All four online cases pass the existing checker. The offline post-limiter PCM analysis is conclusive and passes **10/10** first hits against ±33.333 ms, with minimum **−13.738 ms**, median **+10.3485 ms** and maximum **+22.264 ms**. Independent full-search FFT matching reproduces the first-hit results and confirms the 6 ms music-bus-to-limiter delay. PCM projected through the output clock is the authoritative measurement for the first hit here; physical acoustic output was not measured.

The unchanged coarse offline checker exits **1**, and `allStrictGatesPass` remains **false**. Its media-clock estimate fails run 03 at **−40.650 ms** and run 07 at **−40.432 ms**; its presented whole-overlap estimate fails run 03 at **−52.984 ms**. Those values remain in the final summary.

Run 07 has a **−13.738 ms** measured PCM contact error, no later picture hold, and a contact-relative picture epoch stable within −0.200…+0.067 ms. Its −40.432 ms media estimate is a coarse-clock disagreement, not evidence of a failed contact. The sampled song clock advances mostly in 1,024-sample / 21.333 ms steps, and its coarse presented estimate has about −14 ms bias against the output-timestamp projection. Do not change the offset to make this estimator pass.

Run 03 has a **−10.345 ms** measured first-hit error with **0.9967** correlation. After contact, the **66.7 ms** interval at frame 979→980 shifts the picture epoch by **+33.366 ms**. The later output-time projection is **−43.706 ms**, with a separate coarse-clock bias of about **−14.57 ms** before and after the shift. The original one-second PCM capture ends before this event: the later figure is a projection, not a direct late-PCM measurement. The new four-second capture population below measures late overlap directly, but cannot reconstruct the audio from this historical event.

All fourteen cases pass landing and controls: all **22 registration samples, 1028–1049**, are presented through the final frame, and exposed-record phase error is at most **3.186°**. The existing `registrationContinuity.maxGapMs` maximum remains **57.7 ms**: it includes the tail from the final callback's `expectedDisplayTime` to `filmEndedMs`. The maximum interval **between successive registration pictures** is **33.4 ms**. These are different scopes; neither records the historical frame 979→980 event. Record centre/radius registration is exact, the live background is ready, one opener continues, and no decoder drops or uncovered samples were detected. Callback counts are **1,049 in three cases and 1,050 in eleven**; initial callback holds range from 104 to 145.6 ms. These results do not claim every native image received a callback or uniformly spaced display. Missing-film fallback passes, and the before-gate decode fault restores one song, the cabinet and controls in **4.197 seconds**.

Evidence: [combined summary](build/awakening-35-finishing/integration-finishing-summary.json), [four online cases](build/awakening-35-finishing/integration-finishing-preview-v1/), [ten offline cases and captures](build/awakening-35-finishing/integration-finishing-offline-v1/), [first-hit PCM analysis](build/awakening-35-finishing/integration-finishing-offline-v1/pcm-audio-timing.json), [independent FFT/cadence audit](build/awakening-35-finishing/integration-finishing-offline-v1/independent-pcm-audit.json), and [decode-fault evidence](build/awakening-35-finishing/integration-finishing-decode-fallback-v1/).

## Technical cadence checkpoint

The source and encoding audit rules out a film-authored pause at the historical event. Global frames **979→980** are approved C1 source frames **302→304**. The camera moves **11.254782 scene units**, the lens changes **+2.227345 mm**, and raw RGB MSE is **328.254156**; decoded proxy MSE is **321.045972**. This is moving imagery, with visible reflection and groove-highlight changes.

All **444** retained vinyl PNGs have unique file and pixel hashes. The effects movie, song-review movie and development proxy each have **1,050 unique decoded pictures**, uniform **1/30-second PTS and durations**, and continuous, increasing packet DTS. All 75 late encoded pictures in each movie match their same-numbered source PNG more closely than adjacent source frames. Effects and review picture hashes agree throughout. The AAC streams also have continuous timestamps and packets. These checks found no duplicated source image, repeated encoded picture, missing encoded frame or timestamp gap that explains the event.

In historical offline run 03, frame 979 at **32.633333 s** is followed by frame 980 at **32.666667 s**, yet Chrome reports **66.8 ms** between picture submissions (`presentationTime`) and **66.7 ms** between expected display times. `presentedFrames` advances by **one**. Callback delivery also advances by **66.7 ms**, so this is more than a JavaScript callback arriving late after two pictures had already advanced. Chrome delays the next consecutive moving picture. Physical panel scanout was not measured.

The interval occurs **1.633 seconds before** registration starts at **34.266667 s**. All fourteen retained registration windows present every sample **1028–1049** consecutively with a maximum **33.4 ms** interval. The drift servo does not seek below its unchanged 250 ms threshold, and the retained event has no nearby seek, waiting or error event. The C1 source mapping, final registration and control release remain unchanged. The final encoded frame has its normal dwell before the unchanged, approved **100 ms video-to-live opacity fade**. That endpoint dwell and fade are outside the contact-to-final-sample transition analysis; they are distinct from an unplanned two-period gap between advancing pictures.

Effects AAC becomes exactly silent at **32.374667 s**, **258.667 ms before** the held-picture interval. The current Chrome traces place silent-sink transitions around **29.94–29.99 s** or **31.30–31.38 s**, rather than 32.6 s. Silence and continuous AAC are therefore insufficient to identify the trigger. The evidence does not justify a claimed audio-sink, decoder or compositor root cause.

Eight new full-start bare replays—four ordinary video-audio runs and four with the film audio routed through Web Audio—each deliver all **1,050 pictures**, zero decoder drops, and no late interval above **45 ms**. Four fresh traced PWA reloads also have no late picture hold and pass contact PCM within **±33.333 ms**. One coarse media estimate is **−40.723 ms** while its measured PCM contact error is **−13.342 ms**, independently reproducing estimator bias without a picture hold.

Ten additional traced offline PWA reloads use **four seconds of PCM** per run. This is a separate diagnostic population, with **10/10** conclusive first-hit passes: **+6.078 / +10.8475 / +31.008 ms minimum/median/maximum**. The limiter delay remains exactly **6 ms**. Each run is also matched at film times **32.6, 33.0, 33.6 and 34.2 s**. All **50 contact-plus-late matches** pass ±33.333 ms, the largest late error is **+31.193667 ms**, the lowest correlation is **0.990440**, and the matched sample lag stays identical across all five windows within each run. This directly measures late audio phase in the new runs rather than projecting it from contact.

Each new PWA run has **101 normal contact-to-final transitions** (frames 948–1049) and **21 normal registration transitions** (1028–1049), with no picture omissions or two-period submission holds. Every run presents all 1,050 callback samples, with zero decoder drops and zero uncovered samples. All ten landing/control checks and missing-film fallback pass; maximum centre/radius error is **0 px**, exposed-record phase error **4.617°**, and spin error **4.779°**. Both coarse checker gates pass all ten runs in this new population. The earlier coarse failures and primary ten PCM results remain untouched.

The new deep trace confirms ordinary submission of frames 979→980 in every run. Chrome's packet-to-frame-ready `processingDuration` includes queue time and is not a measurement of the isolated cost of decoding one frame. Neither that field nor these headless tracing runs establishes a physical-display bottleneck or excludes a rare platform transient.

The new [`analyse-film-cadence.mjs`](scripts/analyse-film-cadence.mjs) diagnoses consecutive-picture submission delays separately from clock-epoch steps and missed callbacks. It rejects regressing clocks and interior capture gaps before reporting cadence. It does not change the player, audio or existing checker gates. The native30 **50 ms** lead and legacy60 **17 ms** calibration remain fixed. No runtime patch is supported while the rare event is unreproduced and its internal trigger is unknown.

Evidence: [source/encoding audit](build/awakening-35-cadence/v1/source-audit/README.md), [coarse-clock reconciliation](build/awakening-35-cadence/v1/source-audit/COARSE_CLOCK_APPENDIX.md), [bare control report](build/awakening-35-cadence/v1/browser/bare-controls-report.json), [four traced PWA runs](build/awakening-35-cadence/v1/browser/pwa-trace-baseline/film-cadence.json), [Chrome trace audit](build/awakening-35-cadence/v1/browser/pwa-trace-baseline/trace-audit.json), [new browser result summary and capture hashes](build/awakening-35-cadence/v1/browser/browser-result-report.json), and [direct long-PCM analysis](build/awakening-35-cadence/v1/browser/pwa-long-pcm/long-pcm-audit.json). The independent [final verification](build/awakening-35-cadence/v1/final-review-verification.json) records 235 passing Node tests, byte-identical retained source/runtime files and 20/20 protected-source checks across both worktrees. Build reports remain local, ignored evidence; preserve their raw captures and hashes with this worktree.

## Work still requiring evidence

The complete development cut, selected final-quality spots, native clips, original first-hit PCM acceptance, landing/control checks, artifact verification and final-quality preflight are complete. This technical checkpoint adds source/encode diagnosis and fresh browser/PCM evidence. It requires no new 480p render because the visual and playback implementation and exact tested proxy are unchanged. The diagnostic SHA is recorded above; this handoff belongs in a later documentation-only commit. **Source and encoding are cleared for a full production render in the current tested configuration.** Delivery cadence remains qualified by the rare, unreproduced Chrome hold and pending venue physical-scanout and PA checks.

The complete 1080p render remains a separate future action and has not been started. No push, merge, deployment or default-film promotion is part of this assignment. Inspect the complete future final image sequence and encoded movie for noise, blur, contact, skin restoration and continuity before event acceptance.

The operator must watch the complete development cut at normal speed and listen on headphones and speakers. Venue playback must check physical display cadence, projector/PA latency, offline readiness, one continuing opener and control release. The rare historical Chrome picture delay remains a platform qualification; these software runs do not guarantee uniform cadence on every browser or device. Those hardware checks cannot be replaced by a headless browser, software PCM capture or selected stills.

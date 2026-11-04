# The Song Inside — 35-second film at native 30 fps

The filename retains the requested `35FPS` spelling. The film is **35 seconds at 30 fps**, with **1,050 frames**. It is an isolated production development version of *Skate by Faith — Not by Sight*.

**The complete development cut and render pipeline are delivered with one unresolved application timing gate.** The actual-film offline test measured a −40.56 ms media-clock audible-start estimate against a ±33.333 ms target; its presented-frame estimate passed at −31.54 ms. Four online viewports passed both estimates. Do not treat this handoff as unqualified production acceptance. No complete final-resolution film has been rendered, promoted, published or installed as the default.

## Source and preservation

Worktree: `/Users/benjaminhay/SkateNight-30fps-study`  
Branch: `codex/awakening-30fps-study`  
Starting experimental commit: `df26607`  
Verified implementation commit: **`13df8705f90b2ad6ca2a3c70cd34c69c53e7084c`** (`Develop 35-second native30 cinematic production pipeline`).

That commit contains the frozen source used for the verified development render. After it was created, `git status --short` showed only this untracked handoff; there were no remaining source changes. This handoff is recorded by a later documentation-only commit, which does not change the rendered source. Use the implementation SHA above when identifying or reproducing the film.

The approved original remains in `/Users/benjaminhay/SkateNight`, on `codex/awakening-final-prep` at `0c99f8befe80ebe4a6ea7e3c6c3432ad05c70bc8`. Its pre-existing uncommitted changes and `.playwright-mcp/` are preserved. The original 19.25-second/60-fps builders, production cues and source movie remain the source of the approved coin/C1 elements. The separate photorealistic experiment is outside this change.

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

The completed development render root is:

`build/awakening-35-production/final-preview-v1/`

Open [the local review page](build/awakening-35-development/final-review-v1/index.html) for the full movie with song, four native-frame clips, selected 1080p stills, comparisons, actual application ending, and the preserved offline timing failure. Its 52 local references were checked. The standalone film ends with the registered record over black; the live application supplies the real jukebox interface beneath its final crossfade.

All complete movies below contain exactly 1,050 native frames at 30 fps and run 35.0 seconds. The development picture is 480×270 Cycles at four samples; no temporal interpolation or frame-rate conversion was used. The importable 1080p proxy is a spatial enlargement of those same frames.

| Deliverable | Evidence or present state |
|---|---|
| Complete review with song | [`final-preview-v1/assembled/awakening-35-REVIEW-WITH-SONG.mp4`](build/awakening-35-production/final-preview-v1/assembled/awakening-35-REVIEW-WITH-SONG.mp4) |
| Effects-only movie and manifest | [`awakening-35-effects-only.mp4`](build/awakening-35-production/final-preview-v1/assembled/awakening-35-effects-only.mp4) and its `.mp4.json`; low-resolution development export, not application importable |
| Carousel clip | [`carousel.mp4`](build/awakening-35-development/final-review-v1/carousel.mp4); frames 456–605 inclusive, 150 frames / 5 seconds |
| Groove-world clip | [`groove-world.mp4`](build/awakening-35-development/final-review-v1/groove-world.mp4); frames 606–914 inclusive, 309 frames / 10.3 seconds |
| Groove-to-stylus clip | [`groove-exit-to-stylus.mp4`](build/awakening-35-development/final-review-v1/groove-exit-to-stylus.mp4); frames 813–948 inclusive, 136 frames / 4.533 seconds |
| C1 contact/registration clip | [`C1-contact-and-registration.mp4`](build/awakening-35-development/final-review-v1/C1-contact-and-registration.mp4); frames 915–1049 inclusive, 135 frames / 4.5 seconds |
| Selected 1920×1080 spots | Settled shaft 380 in `build/awakening-35-development/v15/corrected-1080-spots/`; optimized groove 680 in `v14/corrected-1080-spots/`; unchanged carousel/exit/contact/landing spots in `v12/final-1080-spots/` |
| Reproducible 35-second effects and song-review WAVs | [`audio/effects-only.wav`](build/awakening-35-production/final-preview-v1/audio/effects-only.wav), [`audio/review-with-song.wav`](build/awakening-35-production/final-preview-v1/audio/review-with-song.wav), and [`audio-report.json`](build/awakening-35-production/final-preview-v1/audio/audio-report.json) |
| Pipeline tests | 16 Python tests passed, including stale dependencies, corruption recovery and output preservation |
| Browser/application CPU regressions | 220 Node tests passed |
| Synthetic application/offline/fallback checks | All five playback cases pass both 33.333 ms song gates, final registration, controls and one-song checks; separate before-gate decode fault recovers in 4.166 seconds |
| Actual new-film application/offline acceptance | Four online viewports pass; offline media-clock audible-start estimate fails. All five present every frame with zero decoder drops and pass final registration. Missing-film and before-gate decode fallback pass. |
| Future final-quality production preflight | Passed in `build/awakening-35-production/final-1080-v1/preflight.json`; preflight only, no image frames rendered in that root |
| Full-resolution full-cut visual inspection | Deferred until the future authorized final render |
| Event projector/PA calibration | Requires venue hardware |

Development examples and superseded proofs remain under `build/awakening-35-development/`. They document the work; the fresh complete movie and current quality-root reports must be used for acceptance and cost estimates.

Visual review sampled the fresh full cut through the opening, failure, recovery, shaft, carousel, descent and canyon, then checked escape frames 813 and 840, the 867–868 blend, frames 900 and 915, contact 948, registration 1028 and final frame 1049. No new material geometry or camera issue was observed in those checks. The carousel reads as individual records; the glossy groove and scale reversal read in the inspected evidence. Targeted native-motion proofs and selected final-quality spots were also reviewed. This does not claim human approval of every image or a complete real-time audiovisual screening. Operator viewing of the whole cut and subjective headphone/speaker listening remain acceptance work.

[`assembly-report.json`](build/awakening-35-production/final-preview-v1/assembled/assembly-report.json) records movie SHA-256 checksums and all four shot fingerprints. The effects movie SHA-256 is `bf5d2a0dbf9406c218d79ffdce0de2fb6cdd47d977e57cbb3b00734d126a723c`; the song-review movie is `0f6db1d536f401f46cf33f94c8781c7768b2cc75ae764481c6ffb403493a330f`. Assembly validated current source/asset provenance and all 1,050 PNGs. Both complete encoded movies subsequently decoded through FFmpeg with error-fatal checking and no errors. Clip hashes and native ranges are in [`review-report.json`](build/awakening-35-development/final-review-v1/review-report.json).

## What changed in the film

The approved industrial interior, failed ignition, return and recovery now drive a visible transfer shaft, bearings and index mechanism. The carousel uses the actual 60-slot source mechanism. This deliberate choice retains the working mechanical assembly and gives the wide reveal sixty physical records, rather than adding ten decorative copies to match the approximate seventy-record brief. Records, labels, shoes and pins move with the indexed magazine. The fixed motor housing stays fixed. A two-turn shaft drive, enclosed 8:1 reduction, quarter-turn 24-tooth pinion and 360-tooth internal ring produce a six-degree index and settle at frame 455.

The hall-to-carousel join uses a foreground metal housing wipe across frames 398–411. The two approved scene builders have different world scales; the wipe makes that transition explicit and visually connected. The same paper-labelled record presentation carries into the selected record. Printed labels and pressed groove bands replace the greybox discs.

The descent, hidden world, escape and stylus approach occupy one rotating record coordinate system. The rounded V-shaped channel has .4 pitch, .13 depth and .26 width in the source scene units. Five recessed service stations, wall ribs, brass fasteners, conduits, handrails, a gantry and a low inspection carriage give the groove a readable scale. The camera travels about 2.75 scene units during the 5.27-second flight. It follows the modulated channel with at least .051 floor clearance in the sampled quarter-frame checks.

The source record's solid base would fill the deep groove. It is culled near the submerged camera, then returns as the local sector converges to the original surface. The depth closes across 813–867; the surface/normal blend spans 850–868, including 18 frames with both representations active. This measured geometry LOD removes the one-frame valley-fill/specular change found in the earlier exit proof. The original source geometry and materials are restored before C1.

All 135 C1 integer samples, global 915–1049, are compared with their approved source camera and record poses. Position, orientation, lens and record angle errors are zero at those evaluated samples. This preserves the source pose sequence at native30, including an explicit final source-frame 443 sample. It does not establish that every subframe of the retimed motion blur is byte-identical to the original render.

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

The verified development mix measured effects-only **−26.5 LUFS integrated / −6.8 dBTP**, and review-with-song **−23.6 LUFS / −5.8 dBTP**. These are the development mix's measured levels, not a venue loudness target. The 8.62–8.9-second failure gap is silent; the effects bed is fully ducked from 32.6 seconds to the endpoint.

The encoded AAC checked with the same FFmpeg `ebur128=peak=true` method measured effects-only **−26.5 LUFS / −6.7 dBTP**, and review-with-song **−23.6 LUFS / −5.9 dBTP**. See [`encoded-audio-qa.json`](build/awakening-35-development/final-review-v1/encoded-audio-qa.json). Metering and successful decode do not establish subjective listening approval.

Listen to the complete song review on headphones and the intended speakers. Check the failed start and quiet gap, the recovery pulse, the drive's movement into the carousel, the scale change in the groove, and the contact transient against the first song hit. Confirm that the hidden-world resonance does not mask the story or become tiring. In the application, verify that one song continues through registration, effects remain separate, and transport/fader controls work after release. Finish with the projector and PA connected so their real latency can be measured.

## Render settings and measured cost

Final settings are Cycles Metal, 1920×1080, 30 fps, 0.5-frame shutter / 1/60-second exposure, story 128 samples and changer/vinyl 96 samples. The inexpensive complete development pass uses 480×270 and 4 samples. Spatial enlargement of that pass to a 1080p application proxy adds no final render detail.

The machine is an M2 Pro Mac with 16 GiB unified memory. Run Blender pixel work and Chrome compositor acceptance tests serially. Earlier overlapping work caused compositor stalls and a Metal process failure; simultaneous acceptance/render work is not a valid timing benchmark.

The previous study estimated 19 hours for the 35-second version against a roughly 36-hour original-film model. Neither is a measured duration for the finished new geometry. [`review.py`](cinematic/extended/review.py) now weights actual 1080p final-sample timings by 312 story, 201 changer and 444 vinyl frames, with a separate 18-frame mixed-LOD group. It splits descent, groove flight, escape and C1 instead of assigning all vinyl frames the cost of one still.

The final-source spot-based Blender estimate is **33.22 hours**, with a stated planning allowance of **23.94–51.78 hours**. The calculation and actual image/report paths are in `build/awakening-35-development/final-cost-v2/render-cost.{json,md}`. This is a budget from sparse samples, not a measured full-render duration. It uses the settled-camera story spot from v15, the optimized groove spot from v14, and unchanged carousel/exit/contact/landing spots from v12, at their real paths.

| Final-quality spot | Samples | Measured render seconds |
|---|---:|---:|
| Settled shaft, frame 380 | 128 | 205.15 |
| Carousel close, frame 480 | 96 | 71.00 |
| Carousel wide, frame 542 | 96 | 68.08 |
| Optimized groove flight, frame 680 | 96 | 120.72 |
| Groove exit, frame 840 | 96 | 90.63 |
| Mixed-LOD exit, frame 867 | 96 | 201.37 |
| Restored record surface, frame 868 | 96 | 83.22 |
| Diamond contact, frame 948 | 96 | 74.98 |
| Final landing, frame 1049 | 96 | 9.91 |

The model assigns frame 380's 205.15 seconds to all 312 story frames, contributing 17.78 hours. It borrows groove frame 680 for the unmeasured descent and averages contact/landing frames 948 and 1049 across C1. Those assumptions limit precision. The smaller groove sector reduced geometry and observed process memory, but its 120.72-second measurement shows no meaningful speed gain over the earlier 121.10 seconds.

Cost inputs require nonzero rendered image bytes, positive wall time and a CRC-valid 1920×1080 PNG; validation-only runs are excluded. The planning allowance uses 75% of each phase's observed minimum through 150% of its maximum. It is not a statistical confidence interval. First frames may include cold kernel/cache work. Browser capture, encoding, validation, restarts and overnight thermal changes remain additional work. Observed process peak RSS reached 4.85 GiB; this cumulative macOS metric does not measure all Metal/unified GPU allocations.

## Commands for the next operator

Run from the isolated experimental worktree. The assets root deliberately points to the original project, which holds ignored source media and textures. Do not run the full-resolution command during this development assignment.

```sh
cd /Users/benjaminhay/SkateNight-30fps-study

# Dependency, source-asset, codec, Metal and storage preflight; no image rendering.
python3 cinematic/extended/render_production.py \
  --assets-root /Users/benjaminhay/SkateNight \
  --output-dir build/awakening-35-production/final-1080-v1 --check

# Future authorized complete final-quality render; native30 throughout.
python3 cinematic/extended/render_production.py \
  --assets-root /Users/benjaminhay/SkateNight \
  --output-dir build/awakening-35-production/final-1080-v1 --render-full

# Resume the same source/assets/settings after interruption.
python3 cinematic/extended/render_production.py \
  --assets-root /Users/benjaminhay/SkateNight \
  --output-dir build/awakening-35-production/final-1080-v1 --render-full --resume
```

The runner keeps persistent unique logs in the render root's `logs/`. It fingerprints source content, browser dependencies, external assets, prepared transition textures and render settings. It rejects stale or unproven frame directories. Resume checks PNG CRCs and dimensions, preserves valid frame bytes/mtimes, and rerenders missing or corrupt frames through temporary files. A source or settings change needs a new render version. Do not delete state files to bypass that refusal.

At 1920×1080 the preflight storage allowance is about 13.69 GiB; low-resolution work has a 4 GiB minimum. Allow further room for exports, old versions, application proxies and render diagnostics. Use the actual `preflight.json` for current free space and dependency versions. Keep source assets unchanged for a resumable production run.

The final 1080p preflight passed with Blender 5.2.3, FFmpeg/FFprobe, Node, Chrome and Playwright available, and `Apple M2 Pro (GPU - 16 cores)` detected as a Cycles Metal device. It recorded 206.65 GiB free against a 13.69 GiB allowance. The separate `final-1080-v1` root currently contains preflight evidence only.

If all frames and audio already exist but assembly stopped, preserve successful exports and select a fresh export directory:

```sh
python3 cinematic/extended/render_production.py \
  --assets-root /Users/benjaminhay/SkateNight \
  --output-dir build/awakening-35-production/final-1080-v1 \
  --assemble-only --skip-metal-check \
  --export-root build/awakening-35-production/final-1080-export-v2
```

Assembly validates current frame provenance, every PNG, exact WAV lengths and dependency hashes. It encodes exactly 1,050 source frames as H.264 High/yuv420p with AAC 48 kHz stereo, then verifies dimensions, 30/1 frame rate, duration and frame count. Existing successful movies and sidecars are refused and preserved. The effects-only sidecar and `assembly-report.json` contain SHA-256 checksums; preserve them with the MP4.

To reproduce the inexpensive full preview in a fresh version, then build its local review package:

```sh
python3 cinematic/extended/render_production.py \
  --assets-root /Users/benjaminhay/SkateNight \
  --output-dir build/awakening-35-production/final-preview-v2 \
  --width 480 --height 270 --samples 4 --importable-proxy

python3 cinematic/extended/review.py \
  --render-root build/awakening-35-production/final-preview-v2 \
  --quality-root build/awakening-35-development/v15/corrected-1080-spots \
  --supplement-quality-root build/awakening-35-development/v12/final-1080-spots \
  --supplement-quality-root build/awakening-35-development/v14/corrected-1080-spots \
  --output-dir build/awakening-35-development/final-review-v2
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
node scripts/check-extended-preview.mjs \
  --movie build/awakening-35-production/final-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4 \
  --manifest build/awakening-35-production/final-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4.json \
  --out build/awakening-35-development/integration-final-preview-v2

node scripts/check-extended-preview.mjs --fault-only --viewports 1920x1080 \
  --movie build/awakening-35-production/final-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4 \
  --manifest build/awakening-35-production/final-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4.json \
  --out build/awakening-35-development/integration-final-decode-fallback-v2
```

The default integration run covers 1920×1080, 1440×900, 1280×800 and 1024×768, plus offline OPFS preparation and missing-asset fallback. The fault case fails decoding after opener preparation but before the song gate opens; it must release the gate, play one opener, reveal the live cabinet and restore controls.

Native30 song timing accounts for measured AudioContext output latency and a separately named 1.5-frame / 50 ms cold-start allowance, calibrated on this workstation. The existing legacy60 calibration stays unchanged. Reports retain raw media drift, estimated audible drift and a second estimate using presented-frame timestamps with interpolated song time. Both audible estimates must meet the unchanged 33.333 ms gate. This calibration does not replace measurement of the projector and PA.

Registration-to-final continuity checks two-frame presentation-gap bounds, native frame advances, actual presentation of frame 1049, ready live background and exposed-record phase. Earlier 333/500 ms stalls and approximately 45 ms audible-timing failures remain preserved as failed evidence; replay tests reject them.

The frozen-code synthetic run now passes all five cases: four viewports and an offline OPFS reload using normal coin insertion. Each recorded all 1,050 unique native frames, 0–1049, with zero decoder drops. Media-clock estimated audible start errors ranged from −19.33 to +23.37 ms; presented-frame estimates ranged from −11.79 to +9.79 ms. Every case presented all 22 registration samples, 1028–1049. The largest late-window gap was 54.1 ms, and the largest exposed-record phase error was 5.59°. Whole-film callback gaps reached 152 ms outside that window; complete frame coverage and zero decoder drops do not imply perfectly uniform presentation cadence.

Synthetic results: `build/awakening-35-development/integration-final-synthetic/final-verification-summary.json`; its separate decode-fault case recovers in 4.166 seconds. These technical-asset passes are retained alongside the actual-film evidence below.

The actual assembled development proxy was then imported through the application and tested at all four viewports plus offline OPFS reload. All five runs recorded 1,050 unique frames, 0–1049, and zero decoder drops. Every registration sample 1028–1049 appeared; maximum late-window gap was 54.7 ms and exposed-record phase error was at most 4.73°. One song continued without a duplicate, the live background was ready, no unintended black gap was detected, and controls released. Missing-film live fallback passed. The actual-film before-gate decode fault recovered in 4.177 seconds.

**One actual-film gate remains unsatisfied:** offline coin playback measured −40.56 ms using the media-clock audible-start estimator, exceeding the ±33.333 ms target by 7.23 ms. Its presented-frame estimate was −31.54 ms, within the target. All four online viewports passed both estimates. The offline failure remains a cold-start calibration limitation; the source, calibration, report and acceptance tolerance were left unchanged rather than turning it into a pass. Application-wide timing approval therefore remains qualified.

Actual results: [`integration-final-preview-v1/final-verification-summary.json`](build/awakening-35-development/integration-final-preview-v1/final-verification-summary.json) and [`integration-final-decode-fallback-v1/integration-proof.json`](build/awakening-35-development/integration-final-decode-fallback-v1/integration-proof.json). The review page includes the actual [1920×1080 revealed jukebox screenshot](build/awakening-35-development/integration-final-preview-v1/1920x1080-revealed.png). Further detail: [PWA integration](cinematic/extended/PWA_INTEGRATION.md).

## Work still requiring evidence

The first corrected 1080p shaft frame pointed at the intended mechanism but had heavy diagonal blur. The camera now settles across frames 378–386; CPU projection checks reduce stationary-shaft travel at frame 380 from 61.85 pixels to zero, and the cheap 45-frame motion clip reads clearly. The replacement final-quality spot, `build/awakening-35-development/v15/corrected-1080-spots/story/frame_0380.png`, passed visual inspection at 128 samples. The earlier blurred image is retained as failed visual evidence.

The full native30 development cut, targeted clips, selected final-quality spots, soundtrack, resumable production workflow and actual-film application tests now exist at implementation commit `13df8705f90b2ad6ca2a3c70cd34c69c53e7084c`. The unresolved offline audible-start gate above prevents an unqualified render-ready/production-accepted claim. Resolve and recheck that timing case without relaxing its tolerance. A code change requires a fresh fingerprinted development render/proxy; do not reuse frames under stale provenance.

The complete 1080p render remains a separate future action and has not been started. Inspect its entire image sequence and encoded movie for noise, blur, contact, geometry LOD and continuity before event acceptance. The operator must also watch the complete development cut at normal speed and listen on headphones and speakers. Venue playback must check real display cadence, projector/PA delay, offline readiness, one continuing opener, and operator control release. Those hardware checks cannot be replaced by a headless browser or selected stills.

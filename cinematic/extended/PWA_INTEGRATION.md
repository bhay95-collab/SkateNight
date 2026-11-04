# Experimental 35-second PWA handoff

The approved website default remains the fixed 60 fps Awakening film. The extended film stays an explicitly imported production preview; nothing here promotes it into `films/`, changes the original worktree or replaces the default.

The finishing pass corrects the native30 song cue's presentation-clock anchor. The final finishing movie has now completed four online sizes, ten offline reloads and the bounded decode-failure case with the frozen source. All fourteen normal runs passed registration, phase, song ownership and controls. Sample-matched PCM passed all ten offline captures: post-limiter first-hit error ranges from **−13.738 to +22.264 ms**, with median **+10.349 ms**. Two offline cases still fail older coarse-clock gates, so the strict combined checker result remains qualified rather than an unconditional pass. All failures remain in their original reports.

Import the **effects-only** MP4 and JSON together through **TOOLS → IMPORT FILM + MANIFEST**. **PREVIEW EXTERNAL FILM + SONG HANDOFF** explicitly starts the imported film. For the normal coin workflow, reload the prepared PWA with `?film=extended35`, then insert the coin. This selects only the verified `production-preview-35s-native30-v1` asset. Without that option, startup keeps the approved hosted/local 60 fps film. A missing extended film falls back to the approved film or the existing live cut. `?film=extended35&live=1` forces the live cut; reduced motion retains the gentle path.

The external contract is `filmKind: production-preview`, `experimental: true`, 1920×1080, 30 fps, 1,050 frames and 35 seconds, with `audioOwnership.songEmbedded: false`. Song-containing review movies cannot use this deployment contract. Import and reload preparation verify the checksum, dimensions, duration, decoding/seeking and locked C1 cues. Record geometry must contain finite numbers; numeric strings and arrays are rejected before playback.

Use **LOAD THE CRATES** before going offline. The film and manifest live in OPFS, separate from saved songs and the service-worker shell. The song continues to play from the jukebox engine and its saved crate. The tests use a private ephemeral Chrome profile, not the operator's real profile.

Contact is frame 948 at 31.6 seconds. Audible song zero targets 31.393 seconds, placing its measured first hit at 0.207 seconds on contact. Registration begins at frame 1028. Frame 1049 samples 34.9666667 seconds; the encoded endpoint is 35 seconds. The approved record position, radius, direction, 45 rpm spin and final 91.055737° label phase remain locked.

The timing investigation found two distinct effects:

- The native scheduler anchored an RVFC frame timestamp to callback invocation instead of `expectedDisplayTime`. In ten baseline runs this advanced the gate by 10.767–14.067 ms. The fix uses an absolute presentation deadline. RVFC is authoritative when available; `timeupdate` is the fallback. All captured baseline cues happened to use RVFC, so the possible event-source race is not claimed as the cause of those particular failures.
- `HTMLAudio.currentTime` advanced mainly in 1,024-sample / 21.333 ms blocks at 48 kHz. A median over the entire musical overlap can also incorporate a later picture hold and mislabel that as a first-hit error. Candidate run 03 contains such a 33.3 ms presentation-epoch shift after contact. Both older estimators and their unchanged gates are retained; contact PCM is measured separately.

The existing **50 ms** native startup lead was not retuned. It is now named in milliseconds rather than as 1.5 video frames. Ten baseline PCM trials measured play-call → audible source zero of 79.87 / 95.42 / 106.99 ms (minimum / median / maximum). Beyond the reported 48 ms sink latency, the extra was 31.87 / 47.42 / 58.99 ms. This includes the reported 21.333 ms base latency, measured 6 ms compressor path, and a remaining 4.54–31.66 ms media/startup term that the data cannot separate into decoder and queue components. Gate bookkeeping added 2.5–10.1 ms. The 50 ms value is an explicit workstation calibration with measured cause and limits, not a universal browser guarantee. The legacy60 +17 ms policy is unchanged; `player.js` and `audio.js` were not modified.

The test-only AudioWorklet records one second from the music bus and limiter output into a silent monitor branch. Normalised correlation against the decoded opener locates the same source samples in both streams; post-limiter matching includes the compressor delay automatically. The matched context sample maps to performance time through the nearest `getOutputTimestamp()` pair, then compares with RVFC frame 948. Sink/base latency is not added again. This follows the [Web Audio output timestamp mapping](https://www.w3.org/TR/webaudio-1.0/#dom-audiocontext-getoutputtimestamp) and [RVFC presentation timestamp semantics](https://wicg.github.io/video-rvfc/).

The two non-paired batches used ten fresh offline reloads each, the same actual 35-second proxy and unchanged 50 ms lead. Values below are minimum / median / maximum, in milliseconds:

| Measurement | Baseline | Fixed presentation anchor |
| --- | ---: | ---: |
| Existing media-clock estimate | −40.536 / −19.035 / +2.280 | −19.701 / −19.069 / +2.535 |
| Existing presented-frame estimate | −44.872 / −23.603 / −8.872 | −31.666 / −10.436 / −3.539 |
| Matched post-limiter PCM at contact | −29.330 / −7.9295 / +6.892 | **−10.548 / +4.997 / +12.053** |
| Gate error against its absolute deadline | −14.067 / −12.717 / −10.767 | −0.267 / +1.033 / +1.933 |

One baseline run failed both older estimators; its matched PCM contact error was −29.330 ms. The fixed candidate passed all old gates in all ten runs, without widening tolerances. All twenty runs recorded 1,050 unique samples 0..1049, zero decoder drops and one independently playing song. Every candidate presented all 22 registration samples through frame 1049; maximum registration gap was 56.4 ms and maximum exposed-record phase error was 5.265°. Each offline run also exercised pause/resume controls. The late decode-failure test waited for an actual RVFC preparation frame, proved that the gate was still closed, then restored one opener, the live cabinet and controls in **4.215 seconds**.

PCM acceptance is conclusive only with ten unique captures, finite local output-timestamp mappings, pre/post correlations at least 0.95, and a six millisecond limiter-path match within two samples. Timing must then meet the unchanged ±33.333 ms target. Missing/poor captures or an invalid frame rate fail with a nonzero CLI exit. Both real batches are conclusive; candidate post-limiter correlations range from 0.99666 to 0.99784. An independent FFT analysis using a different reference window recovered every PCM timing sample exactly. A negative nine-run/missing-capture fixture is retained and correctly fails.

Evidence is under `build/awakening-35-development/`:

- `timing-baseline-offline/`: ten original-policy reloads, raw clocks, cue sources, play events, Float32 PCM, `pcm-audio-timing.json` and `latency-decomposition.json`.
- `timing-candidate-offline/`: ten corrected-policy reloads and PCM; `integration-proof.json` has no old-gate failures, and `pcm-audio-timing.json` has `conclusive: true` / `passed: true`.
- `timing-candidate-offline/independent-timing-distribution.json` and `.md`: independent FFT verification, raw checksums and the later-hold analysis.
- `timing-candidate-offline/frame-control-summary.json`: all native samples, decoder drops, registration and phase.
- `timing-candidate-offline/source-sha256.json` and `runtime-source-unchanged.json`: runtime source captured and verified unchanged during the batch. Analysis-only acceptance hardening occurred afterward and its current hash is embedded in the analysis report.
- `timing-baseline-candidate-comparison.json`: full distributions, preserved old-gate failures and final source hashes.
- `timing-candidate-decode-fallback/integration-proof.json`: actual presented-frame preparation, closed → opened gate, single song and released controls.
- `timing-analysis-negative/`: intentionally invalid capture batch; it is not acceptance evidence.

Reproduce the ten-run check with the existing actual proxy, using a fresh output directory:

```sh
node scripts/check-extended-preview.mjs --offline-only --offline-runs 10 --viewports 1920x1080 \
  --movie build/awakening-35-production/final-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4 \
  --manifest build/awakening-35-production/final-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4.json \
  --out build/awakening-35-development/timing-offline-repeat
node scripts/analyse-film-audio-timing.mjs build/awakening-35-development/timing-offline-repeat
```

The final finishing movie was checked separately at 1920×1080, 1440×900, 1280×800 and 1024×768 online, then through ten fresh 1920×1080 offline reloads. The new proxy is `build/awakening-35-production/finishing-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4`; its SHA-256 is `11eee99f6b38a45276ce60152d578597eeb0f536ae9b81152f3745f72c735f61`, matching its manifest. Runtime, checker, helper and test hashes match the earlier frozen candidate and were unchanged before/after the checks.

| Final movie measurement | Minimum / median / maximum (ms) | Result |
| --- | ---: | --- |
| Offline existing media-clock estimate | −40.650 / +1.9505 / +23.669 | 2 of 10 outside ±33.333 ms |
| Offline existing presented-frame estimate | −52.984 / −4.936 / +8.333 | 1 of 10 outside ±33.333 ms |
| Offline matched post-limiter PCM at contact | **−13.738 / +10.3485 / +22.264** | **10 of 10 within ±33.333 ms** |
| Offline gate error against absolute deadline | −0.367 / +1.233 / +1.733 | Absolute anchor retained |

The online media / presented estimates were −19.286 / −8.873 ms at 1920, +18.105 / +14.873 ms at 1440, +2.233 / +0.333 ms at 1280 and +23.330 / +19.000 ms at 1024; all passed. Offline run 03 failed the old media / presented gates at −40.650 / −52.984 ms, while its matched contact PCM was −10.345 ms. Run 07 failed the media gate at −40.432 ms; its presented estimate was −27.667 ms and contact PCM was −13.738 ms. These remain failed coarse-estimator assertions. The PCM result measures the first hit independently; it does not rewrite the strict checker exit status or establish external speaker/projector timing.

The ten-capture PCM analysis is conclusive and passes with no quality issues: correlations range from 0.996566 to 0.998216, every pre/post match has the measured 288-sample / 6 ms limiter delay, and all timestamp mappings meet the existing locality criterion. Across all fourteen normal runs, every registration interval presented all 22 samples through frame 1049, maximum gap was 57.7 ms, and maximum exposed-record phase error was 3.186°. Record centre/radius errors were zero, each run had one playing song plus independent film effects, there were zero uncovered samples and zero decoder-reported drops, and pause/resume worked after every handoff. The online runs also exercised the music fader. Missing-film offline startup used the live cut and saved opener with released controls. The actual-RVFC before-gate fault proved a closed gate, then recovered one song, the visible live cabinet and controls in **4.197 seconds**.

Whole-film diagnostics remain distinct: eleven runs recorded 1,050 unique frame timestamps and three recorded 1,049; all fourteen showed an initial frame 0→1 callback interval of 104.3–145.6 ms. These initial callback holds were outside the registration interval. Page exceptions were zero. Reports retain 15 HTTP 404 messages per initial browser context and offline resource failures (3,988 `ERR_FAILED`, 770 `ERR_INTERNET_DISCONNECTED`) rather than claiming an empty console. Film import, saved opener, offline shell and tested fallback still completed.

Final evidence is under `build/awakening-35-finishing/`:

- `integration-finishing-preview-v1/`: four online cases, PCM/raw clocks, revealed live PWA PNGs, `integration-proof.json`, source hashes before/after; checker exit 0.
- `integration-finishing-offline-v1/`: ten offline coin workflows and missing-asset fallback, raw PCM/clocks, `pcm-audio-timing.json`; strict checker exit 1 for the three assertions above, conclusive PCM analyser exit 0.
- `integration-finishing-decode-fallback-v1/`: bounded prepared-song fault and revealed fallback PNG; exit 0.
- `integration-finishing-summary.json`: fourteen rows, original failures, diagnostics, PCM distributions and source-hash equality. `allLandingChecksPass` is true; `allStrictGatesPass` is false.

Reproduce with three separate fresh output directories so the ten-capture analyser sees exactly ten offline rows:

```sh
node scripts/check-extended-preview.mjs --skip-offline \
  --movie MOVIE.mp4 --manifest MOVIE.mp4.json --out FRESH_ONLINE_DIRECTORY
node scripts/check-extended-preview.mjs --offline-only --offline-runs 10 --viewports 1920x1080 \
  --movie MOVIE.mp4 --manifest MOVIE.mp4.json --out FRESH_OFFLINE_DIRECTORY
node scripts/analyse-film-audio-timing.mjs FRESH_OFFLINE_DIRECTORY MOVIE.mp4.json
node scripts/check-extended-preview.mjs --fault-only --viewports 1920x1080 \
  --movie MOVIE.mp4 --manifest MOVIE.mp4.json --out FRESH_FAULT_DIRECTORY
```

The frozen source passed **225 Node tests** (`build/awakening-35-development/timing-candidate-offline/node-tests-final.log`), including fixed hosted60 validation, legacy overlap and native presentation-deadline tests. `player.js` and `audio.js` remain unchanged. No tolerance, lead or runtime source was adjusted for the final asset. The repeated PCM evidence meets the first-hit target on this workstation, while the retained coarse-estimator failures qualify combined acceptance. Final-resolution audiovisual inspection and venue projector/PA calibration remain outstanding. API output/presentation timestamps are browser estimates, not an external microphone/projector measurement.

The entire registration-to-end gate remains strict: gaps no longer than two native periods plus 1 ms; no media step skipping more than one sample; actual presentation of frame 1049; live background ready; registration audible drift within two periods; and at least two exposed-phase observations in the first 150 ms, each below six degrees. Whole-film callback holds remain separate diagnostics rather than being hidden by a smooth contact window.

Earlier synthetic and actual-proxy reports remain in `integration*`, including the original actual offline −40.564 ms media / −31.538 ms presented failure. They remain historical failures, not relabelled passes. The corrected-anchor candidate and final finishing-movie reports above are the current timing evidence; the latter preserves the remaining coarse-estimator failures alongside passing contact PCM.

The native cabinet renderer samples `frame / 30` directly at the approved 1920×1080 composition. Smaller outputs preserve that viewport and scale device pixels. Resume validates all PNG chunk checksums and the end marker, rerendering incomplete frames atomically. Repeated GPU captures showed up to three 8-bit colour levels of pixel variance without camera/coin displacement (`build/awakening-35-production/v1/assets/native-pixel-verification.json`).

```sh
node cinematic/extended/render_cabinet.mjs --start 0 --end 92 --width 1920 --height 1080 \
  --output-dir build/awakening-35-development/cabinet-native30 --resume
```

`PLAYWRIGHT_CORE_PATH` explicitly selects the module file and takes precedence over local tools; `CHROME_PATH` selects the executable. All checks use isolated local profiles and output directories. The existing test movie is a spatially upscaled 480-pixel native30 development render, not final-quality 1080p approval. No full production movie render, promotion or deployment is implied.

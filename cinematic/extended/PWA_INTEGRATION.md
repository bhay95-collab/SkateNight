# Experimental 35-second PWA handoff

The approved website default remains the fixed 60 fps Awakening film. Nothing in this branch promotes or installs the extended film in `films/`.

The actual assembled development movie passes four online viewport checks, registration/phase, OPFS offline playback and both fallback paths. Its offline coin run retains one acceptance failure: the conservative media-clock audible estimate was −40.56 ms against the unchanged ±33.333 ms gate; the presented-frame estimate was −31.54 ms and passed. Portable cold-start calibration therefore remains unresolved before promotion or venue acceptance.

The extended assembler writes an external preview manifest with `filmKind: production-preview`, `filmId: production-preview-35s-native30-v1`, `experimental: true`, 1920×1080, 30 fps, 1,050 frames, 35 seconds, and `audioOwnership.songEmbedded: false`. Song-containing review movies cannot use this deployment contract. The file checksum, dimensions, duration, complete decode/seek readiness, and locked C1 timing are checked during import and again when OPFS is prepared after a reload.

Import the **effects-only** MP4 and its JSON together through **TOOLS → IMPORT FILM + MANIFEST**. **PREVIEW EXTERNAL FILM + SONG HANDOFF** explicitly starts that film. For the normal coin workflow, reload the prepared PWA with `?film=extended35`, then insert the coin. This opt-in selects only the verified extended film with the exact identifier above. Without that URL option, normal startup keeps the approved hosted/local 60 fps film. If the extended film is absent, startup uses the approved film or the existing live cut. `?film=extended35&live=1` forces the live cut. Reduced motion retains the gentle live path.

Use **LOAD THE CRATES** before taking the show offline. The effects-only movie and manifest live in OPFS, separate from songs and the service-worker application shell. The preview can prepare from OPFS and play after an offline reload; the opener continues to come from the jukebox player and its saved crate. No music is embedded in the deployment movie.

Contact samples frame 948 at 31.6 seconds. The separate opener starts at 31.393 seconds, so its first hit at 0.207 seconds coincides with contact. Registration starts at frame 1028. The final visual sample is frame 1049 at 34.9666667 seconds; the encoded endpoint is 35 seconds. Cue lookahead, callback tolerance, and clock-drift reporting use the selected film's frame rate. Native30 starts the song engine ahead of the target by its measured AudioContext output latency plus 1.5 native frames (50 ms); the target is the audible cue on the film clock. The separately named NATIVE30_COLD_START_ALLOWANCE_FRAMES is a measured workstation cold-start calibration for block-level HTMLMediaElement startup variation; it is not a portable sync guarantee or universal venue calibration. Diagnostics retain the raw media-clock offset, measured sink latency and their sum, so a buffered audio clock cannot masquerade as audible synchronisation. The existing 17 ms empirical calibration remains only for legacy60 overlap previews. Projector/PA calibration still requires venue hardware.

Run the actual application integration check from the experimental worktree:

```sh
node scripts/check-extended-preview.mjs --out build/awakening-35-development/integration-repeat-synthetic
```

It creates a clearly labelled synthetic 1920×1080/30 H.264/AAC effects-only proxy, imports it through the real operator input, and exercises four viewport handoffs. It checks registration, spin phase, song clock, independently playing effects and one song, presentation gaps, released transport/fader controls, OPFS preparation after an offline reload, normal coin playback with the opt-in URL, and live fallback after removing the test OPFS film. It writes JSON samples (including native frame callbacks, decoder drops, presentation gaps and console/page errors), ffprobe information and screenshots in the requested `--out` directory.

This check uses a private ephemeral browser profile and HTTP server. It never writes the user's real Chrome profile or hosted film directory. Its synthetic image and test tone establish technical integration only. They do not approve the final film's image quality, sonic mix, full-film decode performance, projector sync, or event hardware.

The native cabinet renderer uses `frame / 30` seconds directly, with the approved browser composition fixed at 1920×1080. Smaller outputs use the same viewport and downscaled device pixels. It validates existing frame chunks with the shared production PNG validator before resume; incomplete frames are rerendered atomically.

```sh
node cinematic/extended/render_cabinet.mjs --start 0 --end 92 \
  --width 1920 --height 1080 --output-dir build/awakening-35-development/cabinet-native30 --resume
```

To exercise an assembled development proxy instead of the synthetic slate:

```sh
node scripts/check-extended-preview.mjs \
  --movie build/awakening-35-production/final-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4 \
  --manifest build/awakening-35-production/final-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4.json \
  --out build/awakening-35-development/integration-assembled-repeat
```

Native browser render sample times and scene state are reproducible. Repeated GPU PNG captures can differ by up to three 8-bit colour levels in the measured native cabinet frames (no camera or coin displacement); the independent decoded-pixel comparison is recorded in `build/awakening-35-production/v1/assets/native-pixel-verification.json`. This is distinct from deterministic animation timing and checksum validation of the files actually encoded.

The separate bounded fault-injection case pauses/seeks the test film to the prepared-song window and dispatches a decode failure **before the song gate opens**. It checks that the gate is released, one opener plays, the failed film stops, the live cabinet becomes visible, and transport controls work within eight seconds. The diagnostic seek does not establish normal audiovisual sync.

```sh
node scripts/check-extended-preview.mjs --fault-only --viewports 1920x1080 \
  --movie build/awakening-35-production/final-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4 \
  --manifest build/awakening-35-production/final-preview-v1/technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4.json \
  --out build/awakening-35-development/integration-decode-fallback-repeat
```

The integration gate covers the **entire registration-to-final window**: presented-frame gaps must stay within two native frame periods plus 1 ms measurement tolerance; no media-time step may skip more than one native sample; and frame 1049 must actually be presented. The live background must be ready and registration audible drift must stay within two native frame periods. During the first 150 ms of the exposed-record crossfade, at least two phase observations must exist and remain within six degrees of the final-frame phase advanced at 45 rpm. Whole-film decoder drops and maximum callback gaps remain separate diagnostics.

`PLAYWRIGHT_CORE_PATH` explicitly selects the Playwright module file and takes precedence over locally installed tools. `CHROME_PATH` explicitly selects the browser executable. Both scripts follow the same override semantics as production preflight.

The actual `final-preview-v1` development movie was tested with the frozen **1.5-frame / 50 ms workstation calibration**. It contains all 1,050 newly rendered native30 preview frames, spatially upscaled from the 480-pixel render to a 1920×1080 H.264/AAC importable proxy; it is explicitly `qualityTier: development-proxy`, not a final-resolution cinematic render. The deployed audio track is effects-only.

| Actual movie case | Media-clock audible estimate | Presented-frame audible estimate | Dual-clock gate |
| --- | ---: | ---: | --- |
| 1920×1080 | −19.21 ms | −14.33 ms | Pass |
| Offline 1920×1080 coin opt-in | **−40.56 ms** | −31.54 ms | **Fail: media estimate** |
| 1440×900 | −19.18 ms | −10.33 ms | Pass |
| 1280×800 | +1.97 ms | −14.33 ms | Pass |
| 1024×768 | +1.96 ms | −15.79 ms | Pass |

All five film runs recorded **1,050 unique native samples 0..1049**, zero decoder drops and no uncovered samples. Every case presented all 22 registration samples 1028..1049; maximum late-window gaps were 33.4–54.7 ms and exposed phase error stayed below 4.73°. Whole-film maximum callback gaps of 89.5–112.5 ms remain recorded separately. The media estimate retains the RAF film/song clock comparison; the independent presented estimate interpolates the song clock at each RVFC expected-display timestamp. Neither estimate measures projector or PA latency.

Actual-movie evidence is under `build/awakening-35-development/`:

- `integration-final-preview-v1/integration-proof.json`: complete four-viewport, offline coin and missing-film fallback results, including the preserved offline timing failure.
- `integration-final-preview-v1/final-verification-summary.json`: both clock estimates, strict registration/phase checks, unique native-frame counts and decoder drops; `allStrictGatesPass` is **false**.
- `integration-final-preview-v1/source-sha256.json`: app, validator, checker, analysis helper and cue hashes; verified unchanged throughout the run and matching the final synthetic run.
- `integration-final-preview-v1/*-samples.json` and `*-revealed.png`: raw clocks, presentation callbacks and live-UI screenshots. The 1920×1080 end-of-film screenshot is `integration-final-preview-v1/1920x1080-revealed.png`.
- `integration-final-decode-fallback-v1/integration-proof.json`: the injected failure began with the song gate closed, opened that gate, stopped the failed film, revealed the live cabinet and restored one opener plus transport controls in **4.177 seconds**.

The missing-film case exercised the real coin → live cut → opener path and verified released transport controls. The decode-fault case separately covers failure after preparation but before the scheduled song gate. No executable source or acceptance gates changed after the rendered source was frozen.

The earlier frozen synthetic pass remains in `integration-final-synthetic/`: both clock gates passed in all five runs, all 1,050 unique samples were observed, and decoder drops were zero. Its separate fault recovery passed in 4.166 seconds (`integration-final-decode-fallback/`). These synthetic results do not override the later actual-movie offline failure.

Older failed captures remain in `integration/` (333/500 ms registration stalls and approximately 45 ms start errors) and `integration-current-synthetic/` (successful prewarmed registration but approximately 44 ms start errors). Raw reports, the registration replay audit and estimator-bias audit are preserved. The final checks retain strict registration/phase requirements and both ±33.333 ms clock gates; no earlier failure has been relabelled as a pass.

The source and movie can be reviewed and the qualified render pipeline handed off, but the actual-movie dual-clock acceptance is incomplete. The 50 ms cold-start allowance is explicit workstation calibration rather than a portable guarantee. Final-resolution audiovisual inspection, reliable cold-start calibration and event projector/PA acceptance remain outstanding before promotion. No further fixed-offset tuning was applied to make this individual offline run pass.

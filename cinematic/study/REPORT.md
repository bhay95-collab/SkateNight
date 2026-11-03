# The Song Inside — 30 fps study

3 November 2026. Experimental branch: `codex/awakening-30fps-study`. Base: `0c99f8befe80ebe4a6ea7e3c6c3432ad05c70bc8`.

## Decision

Pursue a **35-second, native-30-fps version with the restrained groove world**. This selects the ambitious 35–40-second option, with a firm scope limit on environment detail. Keep the approved 19.25-second source as the event fallback while the extended version is developed and accepted.

The strongest addition is the carousel's close record pass followed by a rising reveal. The canyon supplies a second scale discovery, but it needs a convincing exit into the existing stylus shot. The study demonstrates that camera idea; it does not complete that production transition. Adding a dense city now would commit effort before the transition works at final quality.

Watch [35 seconds](../../build/awakening-30fps-study/v1/animatic-35-with-song.mp4), [38.5 seconds](../../build/awakening-30fps-study/v1/animatic-38.5-with-song.mp4), and [30 seconds](../../build/awakening-30fps-study/v1/animatic-30-with-song.mp4). The [review index](../../build/awakening-30fps-study/v1/index.html) groups the studies, comparisons and measurements. These links are relative to this repository file.

The recommendation is an editorial assessment of prototypes, not audience research or event approval. The 30-second cut asks the viewer to absorb the groove transformation quickly. At 38.5 seconds, more of the additional time goes to travelling past similar walls. The 35-second cut gives both discoveries room without requiring the longest flight.

## Treatment: follow the load

The coin opens the proven route into the hall. A relay closes. The drive moves against resistance, loses power and rolls back. In the dark, the robot returns in the dial. Each heartbeat advances the same gear train. The camera leaves the dial and follows the shaft, its coupling and the driven gear. Beneath the record magazine, a transfer shaft turns the index pinion. Rotation reaches the radial array.

The next shot begins so close to one record that its label and spindle establish its identity. We pass neighbouring discs, rise and discover the complete changer. The camera approaches the active vinyl, dives between its ridges and travels through a V-shaped channel. A few service structures and amber windows make the scale unsettling. They stay below the surface rather than forming a skyline. The camera climbs; the structures disappear into shallow grooves. The diamond approaches the place we have just left. Its contact releases the first musical hit. The approved C1 pullback takes us home.

| Beat | 35-second cut | 38.5-second reference |
|---|---:|---:|
| Coin, slot, hall and impact | 0–5.467 s | 0–5.467 s |
| Relay, resisted ignition, failure | 5.467–8.300 s | same |
| Dark and small tick | 8.300–9.200 s | same |
| Robot, heartbeat and drive recovery | 9.200–13.500 s | same |
| Shaft reaches the index mechanism | 13.500–15.200 s | same |
| Close record pass and radial reveal | 15.200–19.200 s | 15.200–20.200 s |
| Active vinyl | 19.200–20.200 s | 20.200–21.200 s |
| Continuous descent, flight and emergence | 20.200–30.500 s | 21.200–34.000 s |
| Approved stylus approach | 30.500–31.600 s | 34.000–35.100 s |
| Song playback begins | **31.393 s** | **34.893 s** |
| Contact / song's first hit | **31.600 s** | **35.100 s** |
| C1 pullback and registration | 31.600–35.000 s | 35.100–38.500 s |

The 30-second cut uses a 3-second carousel reveal and a 6.300-second continuous canyon camera. Contact is at 26.600 s and song playback at 26.393 s. It preserves the opening, mechanical beats and ending. All three cuts contain separately timed native camera animation; the shorter canyon shots do not skip sections with editorial jump cuts.

## What was reused and what was built

The approved builders provide the planetary drive, linked motors and shafts, robot dial, hall instances, record changer, carousel, cartridge and pinned camera. `groove_detail.py` contains **60 records**, not approximately 70. They are batched meshes with labels, spindle pins, cradles, twin rails and a 360-tooth index ring. The pinion and motor are present, but the existing scene does not animate a complete selected-record transfer onto the central platter.

The drive hall and changer are separate Blender scenes. Their scales differ: the drive's architecture spans tens of metres; the active record has a 600-metre radius. There is no existing continuous shaft between them to reveal merely by moving a camera. The study follows the existing hall shafts, then introduces a new transfer shaft, pillow blocks and gearbox beneath the existing changer. This is a proposed physical connection. A production layout must establish the relative scales and mountings and finish the selection linkage.

The carousel tests use the existing array and add cameras, light and simple motion. Candidate A supplies recognition followed by discovery. Candidate B's orbit establishes the whole arrangement immediately, leaving less to reveal. Bright proxy reflections on the active platter need a lighting pass; they are not a proposed final look.

The new canyon retains the approved groove proportions: pitch 0.4, width 0.26 and depth 0.13, enlarged together by 1,000 for camera work. Its centreline follows the same spiral relationship. Adjacent V profiles, modest lateral modulation and the approved vinyl ring shader keep it tied to the record. The restrained version has 16 utility structures and one bridge; the richer version has 65 structures, three bridges and four moving service carriers. Both use batched geometry. These are greyboxes, without finished surface damage, production windows, transport design or dense atmosphere.

The existing groove patch already contains real spiral geometry around the contact region. It remains intact in the native stylus and landing renders. The canyon is a separate coordinate-scale prototype. Its exit approaches the approved camera's position, direction and lens, but its lighting, surface extent and material-space phase are not yet a seamless match. The cartridge can be glimpsed overhead during the flight. Whether to use that as foreshadowing or change the approach direction remains a creative decision.

## Evidence and frame-rate findings

All study media lives under `build/awakening-30fps-study/v1/`. Start with:

| Evidence | File |
|---|---|
| Failed drive → robot → shafts → changer | `mechanical-continuity.mp4` |
| Close pass / rising reveal | `carousel-a.mp4` |
| Orbital alternative | `carousel-b.mp4` |
| Restrained groove / full exit | `canyon-sparse-v2.mp4` |
| Richer groove / moving carriers | `canyon-rich-v2.mp4` |
| Seven matched motions plus faster canyon | `native-30-60-comparison.mp4` |
| Ray-traced shutter checks | `cycles-canyon-30.mp4`, `cycles-canyon-60.mp4` |
| Complete cuts with temporary effects and opener | `animatic-{30,35,38.5}-with-song.mp4` |

Previews are 480×270, primarily EEVEE, 8 samples, with motion blur enabled and four EEVEE blur steps. The long-distance EEVEE landing lost record visibility, so the final C1 preview and its matched pair use 4-sample Cycles instead. The Cycles canyon pair uses 8 samples and denoising. Native 30 and 60 clips evaluate the same animation independently. Each 0.8-second pair contains 24 and 48 rendered frames. The camera positions and lenses agree exactly at shared sample times; `native-comparison.json` records the checks. The combined comparison uses a 60-fps container and repeats the native-30 pictures on the left. Individual native-rate files are also supplied.

A 0.5-frame shutter means 1/60 s at 30 fps and 1/120 s at 60 fps. This is the conventional 180° baseline, not an identical exposure duration. Blender documents shutter duration in frame units: [Cycles motion blur](https://docs.blender.org/manual/en/5.4/render/cycles/render_settings/motion_blur.html). The fast canyon is the demanding test: nearby walls and bridge edges expose the cadence difference most strongly. Slower revelation and the distant C1 record are more forgiving. Preview resolution cannot settle projector-size judder, texture shimmer, denoising stability or the final shutter choice.

The full animatics reuse the existing cabinet/coin opening with a labelled 60-to-30 cadence conversion. That opening is **not** evidence of native-30 rendering. The coin's Blender hall fall is separately rendered at both native rates. No interpolated frames are used in the native tests.

The preloaded 35-second animatic played at normal speed in headless Chrome: **1,050 presented frames, zero dropped frames, no page errors**. The isolated, fixed-1920×1080 handoff diagnostic measured 33.3 ms film presentation intervals, 16.7 ms display refresh, exact 91.055737° boundary phase and 270°/s live CSS rotation. The first CSS movement followed the boundary by 13.7 ms. It uses the real `changer.css`, with the CSS record already running behind the film as it is prepared in the application. Results and raw samples are in `browser-playback.json`; [play the diagnostic](../../build/awakening-30fps-study/v1/handoff-diagnostic.html). This is a static-plate diagnostic, not a bypass of the PWA's 60-fps validator.

An earlier review-page pass dropped 24 frames while the page preloaded multiple studies. The index now leaves videos unloaded until selected; the successful check explicitly preloads its chosen movie. The earlier result is retained in `browser-playback-first-pass.json`. Cold/offline event playback remains an acceptance check. The final 35-second review mix meters −23.0 LUFS integrated, 15.6 LU LRA and −3.2 dBTP after AAC encoding. Those are technical readings, not subjective listening or PA approval.

## Exact timing and C1 preservation

`cinematic/cues.json` governs the Blender director's cut and `sound_bed.py` effects. `hero_groove.py` uses its own local 60-fps frame clock. `assemble_animatic.py` maps that clock onto film frames. `startup-timing.js` governs the browser animation in milliseconds; `startup-inside.js` is a different SVG animation. `rotation.js` defines the opening song's measured clock. `app.js` owns live song playback, registration, drift observation and the final CSS rotation phase. These sources have different responsibilities and must not be retimed as one global animation.

The baseline has 1,155 frames, 19.25 s at 60 fps. Song playback starts at 15.643 s. Contact is frame 951, 15.850 s: the first hit is 0.207 s into the song. The final frame is at 19.233333 s; the encoded video ends at 19.25 s. Thus the source contains **3.607 s of video after playback starts**, or 3.590333 s from playback start to the final frame's timestamp. The song's reveal marker is 3.584 s. These numbers should not be substituted for one another.

C1 contact is local frame 240 and its endpoint frame 443: **203/60 = 3.383333 s** between source poses. The study samples the original trajectory and rotation curve at native 30 fps. The approach explicitly begins at source frame 175; 33 approach frames plus 102 contact/pullback frames last 4.5 seconds, rounding the source's 269/60 = 4.483333 seconds upward. Its last output frame explicitly evaluates source frame 443, a half-frame endpoint adjustment, rather than stopping at frame 442. The original record centre, radius, label, arm fade and final phase are retained. The measured final phase is 91.055737°, matching the approved `handoff.json` value 91.056°. It does not integrate a longer runtime into a new rotation angle.

The animatic's last registration uses the real UI screenshot as a **static proxy**, fading the area outside the pinned record over the original registration span. It demonstrates the destination composition, not live PWA acceptance. The full cuts keep 3.607 s of video after song playback begins. Effects and song are separate source files; only review MP4s combine them.

The experimental [cue file](cues.json) stores seconds independently of production. Visual cue export rounds to the nearest 30-fps frame, half up; audio retains exact seconds and 48 kHz sample timing. The original 5.250-second coin impact falls between 30-fps sample centres and quantises visually to frame 158, 5.266667 s. Its audio remains at 5.250 s. `editorial.json` gives exact timing for each assembled cut.

## Cost and scope

See [measured results](../../build/awakening-30fps-study/v1/RENDER-COSTS.md), [raw measurements](../../build/awakening-30fps-study/v1/render-costs.json) and [CSV](../../build/awakening-30fps-study/v1/benchmarks.csv). Benchmarks use this M2 Pro's Cycles/Metal device, 1920×1080 PNGs, production sample counts and denoising. The hall is measured across three consecutive frames; other scene classes use one cold frame each. Cold setup/render time and the hall's subsequent frame times are reported separately. Only representative still frames are rendered at those settings. Production volumetric step rates are retained: 3 for the hall, 4 for the approved groove scene. The earlier two-frame hall test at step rate 1 is retained under `sensitivity-mega-step1/`, outside the production cost model.

The equal-frame-count comparison omits an important detail: the baseline reuses 186 already-rendered cabinet frames; the 30-fps version reuses 93. The original needs 969 new Blender frames. The 30-, 35- and 38.5-second studies need 807, 957 and 1,062 respectively. Their per-frame costs differ. The cost model weights measured scene classes rather than multiplying a single average by 1,155.

| Version | Weighted render extrapolation | Stated planning allowance |
|---|---:|---:|
| Approved 19.25 s / 60 fps | 35.9 hours | 26.9–89.7 hours |
| Study 30 s / 30 fps | 17.3 hours | 13.0–43.4 hours |
| Study 35 s / 30 fps | 19.0 hours | 14.3–47.6 hours |
| Study 38.5 s / 30 fps | 20.1 hours | 15.1–50.3 hours |

These are scene-weighted extrapolations from sampled frames, not measured full-film durations. The allowance is explicitly 0.75–2.5× the extrapolation, not a statistical confidence interval. The hall model separates lit and dark portions; the dark sample has motion blur enabled and serves as a proxy for both versions. Most other classes have only a cold measurement. The apparent render saving comes from replacing many costly hall frames with different views and simpler sets, not from the frame count itself. A finished groove environment could erase that saving.

The exploration produced 4,049 completed measured frames, including 16 full-resolution benchmark/sensitivity stills. Accumulated render-call wall time was approximately 46 minutes; this excludes scene construction, encoding, sound generation, the cancelled sensitivity frame and analysis. The full-quality production movie was not rendered.

The canyon's low polygon count does not price a finished city. Production surfacing, moving lights, transparent windows, fog and reflection paths can increase cost without a large vertex increase. Process RSS is recorded, but it is not a complete measurement of Metal allocations in unified memory. A sampled process footprint is also retained for the hall. Allow output headroom for alternate versions and encoding, rather than treating final H.264 size as the storage budget. Blender's [performance guidance](https://docs.blender.org/manual/en/4.4/render/cycles/render_settings/performance.html) notes that persistent render data exchanges memory for faster repeated rendering; it has not been enabled as an untested production change here.

Development remains separate from rendering. A planning allowance for the restrained version is **20–40 person-hours**: 3–6 for the physical drive/changer layout, 2–4 for carousel and selection work, 8–16 for canyon surfacing and the scale transition, 2–4 for sound, 3–6 for timing/phase/integration and 2–4 for playback QA. These are judgement estimates, not tracked labour. Rich buildings and vehicles could add another 12–30 hours. The approved fallback avoids that new development but still needs its documented final render and event acceptance.

## Changes needed if selected

| Area | Required production work |
|---|---|
| Blender animation | Establish a shared drive/changer layout; finish the index/selection mechanism; author the selected 35-second cameras; finish the canyon and its lighting; retain C1's original local time axis. |
| Groove coordinates | Parent the hidden world to the rotating vinyl. Choose the material-space groove that reaches the fixed stylus at contact. Counter-track the emergence into the world-space C1 camera. The separate greybox does not yet solve this registration. |
| Rotation phase | Anchor the record angle at the existing C1 contact and endpoint. Calculate preceding rotation backwards from that anchor. Simply running the original giant-world speed for the extra seconds changes the label and groove phase. |
| Cues | Add a separately versioned, seconds-based film contract; derive visual frames per fps and retain audio precision. Do not overwrite the approved cue file. |
| Effects | Re-score the new duration. The study generates new relay/load, heartbeat, index and canyon events; it never stretches the existing effects bed. Finish spatial reverberation and frequency balance, then test on the PA. |
| Song ownership | Keep the deployed MP4 effects-only. Start the live opener 0.207 s before contact so its first hit coincides with the needle. The embedded song belongs only in review media. |
| PWA contract | Current hosted and preview validation require 60 fps; the hosted contract also fixes the existing film identity/frame count. A 30-fps file is intentionally not installed or imported by this study. Packaging, validator tests and service-worker caching need a reviewed new contract. |
| Handoff | Make frame-duration tolerances and song scheduling use the selected manifest fps; review the existing `2/60` scheduling lead and `1/60` drift diagnostics in `app.js`. Keep the mask, responsive registration and 91.056° CSS phase. |
| Acceptance | Test actual 30-fps media into the live 60-Hz jukebox at supported aspect ratios; inspect the final-resolution canyon and C1 motion; listen through the actual PA; test cold/offline playback and recovery. |

At 45 rpm, the live record advances 4.5° per 60-Hz refresh; a 30-fps film shows 9° steps near full speed. Matching position, speed and phase prevents a geometric jump, but the cadence change still needs viewing on the event display. The current application's validator prevents an honest end-to-end 30-fps overlap test without a future application change. This study does not claim that test passed.

## Preservation and reproduction

The original worktree remains on `codex/awakening-final-prep`. Its pre-existing edits to `awakening-film.js` and `tests/film-overlap.test.js`, ignored media, Blender files, `.playwright-mcp/` and the separate photorealistic worktree are untouched. No manifests, hosted films, service worker or production cues were changed. Nothing was pushed, merged, promoted, published or deployed.

The handoff calls the source render-ready but also records that a complete final-resolution film and event acceptance are outstanding. This study preserves the user's approved creative baseline without treating those outstanding checks as completed.

Run from this experimental worktree:

```sh
python3 cinematic/study/run_study.py previews
python3 cinematic/study/run_study.py comparisons
python3 cinematic/study/run_study.py refine
python3 cinematic/study/run_study.py benchmarks
python3 cinematic/study/run_study.py final-proxies
python3 cinematic/study/assemble_study.py clips
python3 cinematic/study/assemble_study.py cuts
python3 cinematic/study/finish_study.py
python3 cinematic/study/assemble_study.py verify
node cinematic/study/check_review.mjs
python3 -m unittest discover -s cinematic/study -p 'test_*.py'
```

The renderer reads approved assets from `/Users/benjaminhay/SkateNight` by default; `--source-root` changes that read-only source. Dependencies are the existing Blender, FFmpeg, Python standard library and macOS Swift/AppKit for caption PNGs. No packages were added. Keep output versions separate after source changes; the runner preserves complete generated directories and refuses incomplete ones instead of cleaning them. The final report, raw measurements, media verification, source hashes and editable study scenes accompany the videos.

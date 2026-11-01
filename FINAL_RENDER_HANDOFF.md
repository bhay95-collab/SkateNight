# Awakening Final Render Handoff

## Status

This branch contains an unapproved production-preparation prototype. The complete film has **not** been rendered at 1080p, approved, installed as the event default, or published. The editable Blender/Cycles source remains the production master; the rendered transition preview and any future film exports are local build outputs, not Git assets.

The primary workstation is the confirmed M2 Pro Mac mini with 16 GB unified memory. The event MacBook Pro, projector, and sound system remain an acceptance milestone; its specifications are not assumed here.

## Final visual checkpoint

Final visual corrections are in source revision `a35208636ae895a763ca63c361273eb5f2ba9fb0` on `codex/awakening-final-prep`. The approved coin-to-hall camera path and cue frames remain unchanged from `29da25c`; the pinned C1 pullback, registration, and timing are unchanged.

| Requested correction | Source/status | Evidence and remaining work |
|---|---|---|
| Sun-gear highlight clipping | **Corrected in representative still** | The machined-steel response and focused drive lighting were reduced. `build/awakening-visual-final-v2/megastructure/A-detail.png` is a 1920x1080, 32-sample spot render; the broad featureless near-white patch is gone and the turned-metal detail remains visible. |
| Cartridge/vinyl lighting | **Improved; localized pink reflection remains** | `build/awakening-visual-final-v5/B-contact.png` and `B-cartridge.png` are 1920x1080, 32-sample spot renders. Vinyl highlights are softer, grooves and stylus/contact reflection remain legible, and the magenta grazing light is neutralized/reduced. A localized pink neon reflection remains on the cartridge; judge it in the full film before final creative approval. |
| Tonearm ghosting at C1 | **Verified at final resolution** | Selected 1920x1080, 32-sample frames rendered from the corrected source revision are in `build/awakening-visual-final-v5/handoff-check/frame_0435.png` and `frame_0443.png`. The arm is fading at 435 and the arm/pivot are absent outside the record at the C1 endpoint, frame 443. The record remains pinned to the existing handoff registration. |
| Drive-to-record transition | **Short preview reviewed; source unchanged** | `build/awakening-visual-final-v1/drive-to-groove-preview.mp4` is a 48-frame, 480x270, 60 fps preview of the existing 12-frame dissolve. The movement reads as a continuous transition at normal speed; no transition or cue changes were made. Full-resolution motion review remains part of the complete-film check. |

These are representative still/preview checks, not a render of the full cut. Camera paths, cue frames, C1 registration, and runtime were not changed. The full film has not been rendered or approved.

## Coin-entry journey

The existing cabinet/coin animation remains intact through frame 185. The new Blender shot starts at frame 186 using the corresponding film frame as an image match plate. The plate uses the Standard view transform through frame 206 to preserve its source appearance; AgX is restored after the camera passes the plate. It stays opaque through the bezel crossing, avoiding a doubled coin during the handoff. The camera passes the modeled steel throat, follows the same 3D coin through the narrow chute, then opens into the existing megastructure at frame 240. Through the fall, the camera aims at the evaluated coin position on every frame and moves laterally to clear the central support, creating parallax against the machinery while the coin shrinks in frame. A subdued coin-fall high-bay bounce and the coin face's restrained emission keep its brass surface readable in the unlit hall. At impact, the existing relay contact flashes and the camera returns to the established relay-shot pose by frame 326. No second coin animation is introduced.

The standalone preview includes the original film's first 186 frames followed by the new shot, so the complete coin insertion is visible. This is an offline, deterministic frame render, not a real-time screen capture.

All frame numbers below are zero-based at 60 fps, as defined in `cinematic/cues.json`:

| Beat | Frame | Time |
|---|---:|---:|
| Cabinet-slot match / new camera shot | 186 | 3.100 s |
| Hall reveal begins | 240 | 4.000 s |
| Coin strikes the floor contact | 315 | 5.250 s |
| Existing relay ignition begins | 327 | 5.450 s |

The coin impact leads the relay by 12 frames (0.20 s). The camera follows from behind through the hall reveal, arcs laterally to maintain sight of the falling coin, then widens to the relay view. The journey's final camera pose matches the first relay camera pose. Keep the first 186 film frames, relay/failure/recovery cues, approved C1 record landing, song timing, registration, and final-frame timing unchanged.

The effects bed includes the source coin/chute sound and generated close metallic contact, chute rattles, and a longer reverberant impact. The opening song is deliberately **not** embedded in that bed: the interactive jukebox remains its owner. Song playback starts at 15.643 s; stylus contact is frame 951 / 15.850 s, aligning the first hit 0.207 s after playback begins. The effects bed fades as the song takes over.

### Sound review and acceptance

The generated full-cut effects stem measured **−22.7 LUFS integrated**, **14.4 LU LRA**, and **−0.8 dBTP** before AAC encoding. The reviewed v27 transition preview's effects audio measured **−22.9 LUFS integrated**, **12.3 LU LRA**, and **−0.8 dBTP**. These are technical measurements, not a loudness target or a substitute for listening. The WAV limiter keeps the sample peak at or below −1 dBFS; confirm the encoded AAC true peak and audible balance on the final export.

The effect bed is 48 kHz stereo and is separate from the opening track. Keep that ownership split: the PWA jukebox starts the song at 15.643 s, while the effects bed fades out and is silent by 17 s. Before approval, listen to the complete film on the production Mac mini, then repeat on the actual event MacBook Pro through the projector/PA. Specifically assess coin/chute intelligibility, relay and impact peaks, the effects-to-song overlap, channel routing, and the final handoff; set operating volume on the playback system rather than baking in an unverified venue gain.

For this checkpoint, the 19.25-second review mix is at `build/awakening-visual-final-v1/effects-plus-opener-review.wav`; the opening song is positioned at 15.643 s and stylus contact at 15.850 s. The mix measured **−19.0 LUFS integrated**, **3.1 LU LRA**, and **−0.4 dBTP**. Playback was started through the Mac's default audio output, but subjective listening approval cannot be claimed from this review; venue/PA loudness remains outstanding.

## Preview and render workflow

Production preflight (no scene render):

```sh
python3 cinematic/render_production.py --check
```

The check verifies the coin source's 1920x1080/60 fps video, minimum frame range, and audio track; validates the 1920x1080 UI plate; confirms FFmpeg exposes H.264/AAC encoders and Blender exposes a Cycles Metal device; and reports free space at the output volume. A successful check confirms these prerequisites only—it does not render a test frame, estimate final storage precisely, or certify image quality.

Low-cost transition proof (480x270, 60 fps, frames 0–326, 327 frames total):

```sh
python3 cinematic/render_production.py \
  --preview-coin-journey \
  --output-dir build/awakening-final-prep-v27
```

The reviewed preview is `build/awakening-final-prep-v27/preview/coin-journey/coin-journey-preview.mp4` (480x270, 60 fps, 327 H.264 frames); its stereo AAC effects track has a 7.65 s tail. It is an unapproved local review asset, not the finished film.

The production pipeline renders each requested Blender frame independently to PNG, validates its dimensions and PNG chunk checksums, and atomically installs it. `--resume` reuses only valid frames. Use the same output directory with `--resume` only when resuming the same source revision; after changing scene or camera code, use a fresh, versioned output directory so stale frames cannot be reused.

### Full render, recovery, and outputs

The full-render command for Claude is:

```sh
python3 cinematic/render_production.py \
  --output-dir build/awakening-final-render \
  --story-samples 128 \
  --groove-samples 96 \
  --resume
```

The output root is `build/awakening-final-render/`. The command writes:

- `assets/transition/entry-plate.png` and `coin-face.png`.
- `audio/sfx-bed.wav`, plus reproducible source stems in `audio/stems/`.
- `frames/story/frame_0186.png`–`frame_0858.png`.
- `frames/groove/wideseq/frame_0120.png`–`frame_0146.png`.
- `frames/groove/pullback/frame_0175.png`–`frame_0443.png`, and `frames/groove/handoff.json`.
- `assembled/director-cut-master.mp4` (effects-only) and `assembled/director-cut-review-with-song.mp4` (review mix).
- `awakening-director-cut.mp4` and `awakening-director-cut.mp4.json` (local package and manifest).

If interrupted, rerun the same command against the same output directory and unchanged source revision; `--resume` reuses only PNGs whose dimensions and every chunk CRC validate, and re-renders missing or corrupt frames. It does not fingerprint scene source, so after any source/camera/material revision use a new versioned output directory rather than resuming old frames. If all frame sequences are already complete and only assembly/package needs retrying, run:

```sh
python3 cinematic/render_production.py \
  --output-dir build/awakening-final-render \
  --assemble-only
```

Assembly independently validates all required frame paths and dimensions before encoding. The 1,155 output frames comprise 186 source-film frames, 673 story frames, 27 wide-groove frames, and 269 pinned-pullback frames. Three 12-frame segment transitions are composed by holding the outgoing frame and consuming the incoming transition frames once; the total remains 1,155 and cue positions do not move. FFmpeg verifies the resulting H.264/AAC stream metadata, dimensions, frame count, duration, and sample format before installing the staged movie.

The assembled director's cut is 1,155 frames (19.25 s). FFmpeg encodes H.264 High Profile / `yuv420p` at 1920x1080 and 60 fps, with 48 kHz stereo AAC, fast-start metadata, and frame-count verification. Its frame-preserving visual transitions are covered by a synthetic FFmpeg encode test. The complete 1080p render, full-cut visual review, and full-film playback check remain outstanding.

## Delivery and approval boundary

The render command invokes `scripts/package-cinematic.mjs` on the assembled master. It creates `build/awakening-final-render/awakening-director-cut.mp4.json`, calculates the packaged MP4 SHA-256, records the cues and C1 handoff, and verifies the packaged 1920x1080/60 H.264/AAC media. It deliberately labels this artifact `filmKind: production-preview`. The hosted promotion path requires an explicitly approved `awakening` manifest and the website's existing 1,093-frame contract. This director's cut is 1,155 frames, so it must not be promoted or treated as the website's approved film without a separately reviewed contract change and explicit production approval. Do not copy the prototype into the hosted `films/` directory or change the current PWA presentation default as part of this handoff.

## Verification completed

- Python cinematic pipeline tests: 5 passed, including preflight-media rejection cases and a real FFmpeg synthetic encode confirming exact 60 fps frame counts.
- Full Node test suite: 210 passed.
- Python syntax checks passed for the changed cinematic sources.
- Production preflight passed on Blender 5.2.3 / Apple M2 Pro 16-core Metal, confirmed the 1920x1080/60 source video plus audio, and reported 209.8 GiB free at `build/`.
- The current approved-transition proof is `build/awakening-final-prep-v27/preview/coin-journey/coin-journey-preview.mp4`: 327 H.264 frames at 480x270/60 fps, with 48 kHz stereo AAC and a 7.65 s total file duration. FFprobe verifies the file. The camera route and coin visibility were reviewed in key frames and a sample sheet. It proves the slot passage, scale reveal, and hall follow only at preview resolution.
- Representative 1920x1080 gear, cartridge, stylus-contact, and C1 handoff renders were inspected at 32 samples; PNG dimensions and checksums validated. Evidence paths and the remaining pink reflection caveat are listed above. The existing 12-frame drive-to-record dissolve was also reviewed in a short 480x270/60 fps preview.
- Production preflight confirms the M2 Pro Mac mini's Blender Cycles Metal device and checks the source media, UI plate, FFmpeg encoders, and available output-volume space. This is a prerequisite check only, not a benchmark or render-quality certification.
- The 19.25-second 48 kHz stereo effects bed regenerated byte-for-byte from `sound_bed.py` and the coin source. The −22.7 LUFS / 14.4 LU LRA / −0.8 dBTP stem and −22.9 LUFS / 12.3 LU LRA / −0.8 dBTP preview measurements are technical only; subjective listening on the event MacBook Pro and venue PA remains outstanding.
- The effects-plus-opening-song review mix measured −19.0 LUFS / 3.1 LU LRA / −0.4 dBTP. Playback was initiated on the Mac mini, but that is not subjective listening approval; venue acceptance remains outstanding.
- No complete 1080p film render, event-MacBook/projector/PA acceptance, approval, promotion, push, or merge has occurred. The source is technically ready for Claude's full render; visual/audio approval and event playback acceptance remain separate gates.

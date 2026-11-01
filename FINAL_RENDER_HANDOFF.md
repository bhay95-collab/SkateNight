# Awakening Final Render Handoff

## Status

This branch contains an unapproved production-preparation prototype. The complete film has **not** been rendered at 1080p, approved, installed as the event default, or published. The editable Blender/Cycles source remains the production master; the rendered transition preview and any future film exports are local build outputs, not Git assets.

The primary workstation is the confirmed M2 Pro Mac mini with 16 GB unified memory. The event MacBook Pro, projector, and sound system remain an acceptance milestone; its specifications are not assumed here.

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

## Preview and render workflow

Environment check:

```sh
python3 cinematic/render_production.py --check
```

Low-cost transition proof (480x270, 60 fps, frames 0–326, 327 frames total):

```sh
python3 cinematic/render_production.py \
  --preview-coin-journey \
  --output-dir build/awakening-final-prep-v27
```

The reviewed preview is `build/awakening-final-prep-v27/preview/coin-journey/coin-journey-preview.mp4` (480x270, 60 fps, 327 H.264 frames); its stereo AAC effects track has a 7.65 s tail. It is an unapproved local review asset, not the finished film.

The production pipeline renders each requested Blender frame independently to PNG, validates its dimensions and PNG chunk checksums, and atomically installs it. `--resume` reuses only valid frames. Use the same output directory with `--resume` only when resuming the same source revision; after changing scene or camera code, use a fresh, versioned output directory so stale frames cannot be reused.

The full-render command is documented for the separately scheduled production render; it was **not run** in this preparation:

```sh
python3 cinematic/render_production.py \
  --output-dir build/awakening-final-render \
  --story-samples 128 \
  --groove-samples 96 \
  --resume
```

The assembled director's cut is 1,155 frames (19.25 s). FFmpeg encodes H.264 High Profile / `yuv420p` at 1920x1080 and 60 fps, with 48 kHz stereo AAC, fast-start metadata, and frame-count verification. Its frame-preserving visual transitions are covered by a synthetic FFmpeg encode test. The complete 1080p render, final-resolution image critique, and full-film playback check remain outstanding.

## Delivery and approval boundary

`scripts/package-cinematic.mjs` deliberately emits a `production-preview` manifest. The hosted promotion path requires an explicitly approved `awakening` manifest and the website's existing 1,093-frame contract. This director's cut is 1,155 frames, so it must not be promoted or treated as the website's approved film without a separately reviewed contract change and explicit production approval. Do not copy the prototype into the hosted `films/` directory or change the current PWA presentation default as part of this handoff.

## Verification completed

- Python cinematic pipeline tests: 4 passed, including a real FFmpeg synthetic encode confirming exact 60 fps frame counts.
- Focused Node cinematic playback and overlap tests: 13 passed.
- Python syntax checks passed for the changed cinematic sources.
- The current candidate is `build/awakening-final-prep-v27/preview/coin-journey/coin-journey-preview.mp4`: 327 H.264 frames at 480x270/60 fps, with 48 kHz stereo AAC and a 7.65 s effects tail. The camera route and coin visibility were reviewed in key frames and a 10 fps sample sheet of the clip. This low-cost proof resolves the slot passage, scale reveal, and hall follow; full-resolution image critique remains outstanding.
- No complete 1080p film render, event-MacBook/projector/PA acceptance, approval, promotion, push, or merge has occurred.

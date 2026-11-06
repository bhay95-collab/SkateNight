# Website-hosted cinematic assets

Only approved, compressed MP4 delivery assets belong here. Keep Blender
projects, source frames, render intermediates, look-development movies and
high-quality masters outside Git.

The PWA discovers `manifest.json`. It downloads the manifest and MP4 over
ordinary same-origin HTTP, validates the H.264/AAC streams and SHA-256, then
stores the verified film in OPFS. Playback uses a local Blob URL, so seeking is
independent of HTTP range support and continues offline. The `/films/` URLs
are deliberately not intercepted by the service worker: ordinary direct MP4
requests, including byte ranges, remain the static host's responsibility.

## Current show film

`song-inside-35s-v2.mp4` — *The Song Inside* with **Sound Design V4**: 35.000 s,
1,050 frames at native 30 fps, 1920×1080 H.264 with AAC 256k. SHA-256
`402b2ca892d26dd56a9762429e2fbc2a4461d020065fc57ea299adbd12983cc9`. The H.264
stream is copied untouched from v1 (stream SHA-256 `514f808b…`); only the
audio changed: the original effects and the approved V4 score-and-effects
overlay, summed once at unity with no EQ, compression or limiting
(−24.2 LUFS integrated, 6.0 LU range, −6.6 dBTP). `manifest.json` records
the source checksums under `soundDesign`.

*Praise Lifted On High* is never in the film: the jukebox starts it at
31.393 s on the film's presented-frame clock so its first hit lands on the
stylus contact (frame 948), from `cinematic/extended/cues.json`.

`song-inside-35s-v1.mp4` (SHA-256 `cf4befea…`, effects only, source `dcaf590`)
stays published so a rollback is a revert of `manifest.json` and the film ID.

On launch the app verifies its saved copy before the coin is live, then checks
the website in the background (8 s manifest timeout). With nothing saved it
downloads and verifies the film; a saved film that differs from the website's
is reported in **TOOLS → Prepare for Show** and replaced only by **CHECK /
DOWNLOAD**. Earlier cuts carry a different film ID and are never selected.
OFFLINE READY on the deck LED means shell, songs and this film. Without a
verified film the coin plays the live cut.

## Promoting a new version

The manifest points at an immutable versioned file. Promote a reviewed
assembly with:

```sh
npm run cinematic:promote -- awakening-35-effects-only.mp4 \
  awakening-35-effects-only.mp4.json --confirm-approved \
  --approved-by "Name" --source-commit <sha>
```

Promotion takes the assembler's locked native-30 manifest, verifies 1080p30
H.264/AAC, exactly 1,050 decoded frames, an error-free full decode, the SHA-256
and a 50 MiB limit, then adds the approval record. Raise `filmVersion` for a new
cut; a published file is never replaced. Commit only the versioned MP4 and
`manifest.json`.

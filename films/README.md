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

`song-inside-35s-v3.mp4` — *The Song Inside* with **Sound Design V5-B4**:
35.000 s, 1,050 frames at native 30 fps, 1920×1080 H.264 with AAC 256k.
SHA-256 `2a2fca5bededb3751e51c5779b1e24a893e7bcba060bcccd42633bbd2d627b61`.
This is the approved effects-only B4 MP4 from `b68773b`, copied byte for byte;
the H.264 packet stream is identical to V4 (`514f808b…`). Its approved audio
contains We Have Come at 6.030–8.300 s, According to His Power from 9.140 s
(silent by 12.033333 s), the unchanged B3 travelling laugh and the established
cinematic bed. AAC measurements: −22.1 LUFS integrated, 10.1 LU range,
−4.2 dBTP. There is no new mix or encode during promotion.

*Praise Lifted On High* is never in the film: the jukebox starts it at
31.393 s on the film's presented-frame clock so its first hit lands on the
stylus contact (frame 948), from `cinematic/extended/cues.json`.

`song-inside-35s-v2.mp4` (V4, SHA-256 `402b2ca8…`) stays published as the
rollback film. `song-inside-35s-v1.mp4` (SHA-256 `cf4befea…`) is no longer
published: it is in Git history with its manifest (`rollback/pre-v4-sound`),
and checksum-verified copies of every film and manifest are in
`/Users/benjaminhay/SkateNight-Archive/cinematic/films/`. To return to an
earlier film, restore the matching manifest, runtime film ID and
service-worker version together (see `docs/RELEASE.md`); keep the crate cache
intact.

On launch the app verifies its saved copy before the coin is live, then checks
the website in the background (8 s manifest timeout). With nothing saved it
downloads and verifies the film; a saved film that differs from the website's
is reported in **TOOLS → Prepare for Show** and replaced only by **CHECK /
DOWNLOAD**. An older saved V4 film is explicitly marked **OUT OF DATE** and cannot play
as V5. It is replaced only when the operator presses **CHECK / DOWNLOAD**;
the new SHA-256 and playback checks must pass before readiness is restored.
Earlier cuts carry a different film ID and are never selected.
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

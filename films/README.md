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

The manifest points at an immutable versioned file such as
`awakening-v1.mp4`. Promote a reviewed film with:

```sh
npm run cinematic:promote -- build/approved-awakening.mp4 \
  build/approved-awakening.mp4.json --confirm-approved
```

Promotion requires an explicit approval record in the source manifest, the
complete expected timeline, a measured stylus-contact cue, a matching hash,
1080p60 H.264/AAC streams, and a file no larger than 50 MiB. Review and commit
only the versioned MP4 and `manifest.json`. The PWA's live-cut fallback remains
active until an approved manifest is published.

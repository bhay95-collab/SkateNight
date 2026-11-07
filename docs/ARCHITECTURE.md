# Architecture

A static PWA (HTML, CSS, ES modules; no build step) served from GitHub Pages.
One application, two presentations:

- `index.html` - the **photorealistic jukebox** (default): the application page
  plus the living layer (`living/live.css`, `living/live.js`).
- `classic-jukebox.html` - the same page without the living layer (the classic
  presentation; emergency fallback). A test keeps the two identical apart from
  those lines.

## Modules

| Area | Files |
|---|---|
| Application, state, controls | `app.js`, `ui.js`, `queue.js`, `codes.js`, `keyboard.js`, `copy.js`, `tracks.js` |
| Startup and film | `startup*.js`, `cabinet.js`, `awakening-film.js`, `bench.js` |
| Music and sound | `audio.js` (Web Audio buses: music, effects, record), `player.js` (songs from saved Blobs), `sound.js` (effects, voices), `jukebox-sfx.js` + `jukebox-sprite.js` (recorded changer, ambience), `vinyl.js` (record surface, needle), `drone.js`, `dsp.js` |
| Record changer | `mechanism.js` (choreography: load 1500 ms, eject 1000 ms, 1.8x accelerated), `carousel.js`, `changer.css` |
| Look | `styles.css`, `jukebox.css`, `lights.js`, `neon.js`, `visualiser.js`, `fx.js`, `arch.js`, `rink.js`, `ornament.js`, `rotation.js`, `rack-layout.js` |
| Photorealistic layer | `living/` (below) |
| Offline | `sw.js`, `crates.js`, `manifest.webmanifest` |

## Film and opener

`films/manifest.json` names the show film (`song-inside-35s-v3.mp4`, V5-B4,
SHA-256 `2a2fca5b…`, 1,050 frames at native 30 fps). Its handoff contract
(`handoff.mode: "overlap"`, stylus contact frame 948, registration from frame
1028, `songStartSec` 31.393, the C1 record block) comes from
`cinematic/extended/cues.json`. The film carries effects only; *Praise Lifted On
High* is started by the jukebox from the film's presented-frame clock with the
established 50 ms lead, so nothing doubles and the first hit lands on the
touchdown. Over the last frames the film is carried onto the live record and the
CSS spin takes over its label angle (91.0557 deg). A film is promoted with
`npm run cinematic:promote` (see `docs/RELEASE.md`).

### Website-hosted approved film and offline storage

The show film is **The Song Inside** (`films/song-inside-35s-v3.mp4`: 35 s,
1,050 frames at native 30 fps, approved Sound Design V5-B4 with two startup
quotations and the travelling laugh, no Praise opener; details in
`films/README.md`). V4 (`song-inside-35s-v2.mp4`) stays published as the rollback film; the
original `v1` is in Git history and the archive. The
PWA verifies its saved OPFS copy before the coin is live, then checks
`films/manifest.json` in the background with a timeout, so venue networking can
never hold up the coin. Only a manifest with explicit `productionApproval`, the
current film ID and the locked native-30 contract from
`cinematic/extended/cues.json` is accepted; the browser also verifies SHA-256,
decodability and seeks before reporting **READY OFFLINE**. A saved film that
differs from the website's is reported in Prepare for Show and replaced only by
**CHECK / DOWNLOAD**. An older V4 ID is marked **OUT OF DATE** and cannot play
as the new show film; explicit download and verification restore readiness.
Experimental previews use their separate namespace and
cannot replace the show film. Without a verified film the live cut plays.

Promote a new reviewed assembly with `npm run cinematic:promote --
awakening-35-effects-only.mp4 awakening-35-effects-only.mp4.json
--confirm-approved --approved-by "Name" --source-commit <sha>`. It writes an
immutable `films/song-inside-35s-vN.mp4` plus the current `films/manifest.json`;
only those website delivery files should enter Git. The MP4 limit is 50 MiB to avoid GitHub's large-file
warning (GitHub warns above 50 MiB and blocks files above 100 MiB). GitHub Pages
limits a published site to 1 GiB and has a soft 100 GB/month bandwidth limit;
keep the full repository and deployed site comfortably below those limits.

The application downloads the complete MP4 with a same-origin `fetch`, checks
its SHA-256, and writes it to OPFS before enabling film playback. Playback is
from the verified local Blob, so pause/seek and offline playback do not depend
on the server implementing HTTP byte ranges. Direct `/films/*.mp4` requests
are left untouched by the service worker, preserving normal static-server
range semantics. Test the deployment server's range behavior separately if a
future player streams the remote URL directly.

The show plays the standard opening. An experimental **extended cut
(Bigger on the Inside)** is under development and not approved for the
show; to look at the current version, add `?cut=extended` to the address.
It can't be switched on any other way.

To compare the opening with and without its old decoration (the coin's
spin and shine, falling dust, chrome glints, flickering dead neon letters),
open the site with **?ornament=all** on the end of the address; without it
they are left out. You can combine it with the hum: `?hum&ornament=all`.


## Audio

All sound runs through one Web Audio engine: music, effects and record buses into
a limiter, with the Music, Effects and Vinyl controls. The recorded changer (motor,
ratchets, locks, servos, tonearm), needle touchdown, record-surface loop and the
living-machine ambience are effects, scheduled from the changer's own moves and
never delaying the music. Details and sources: `sfx/README.md`,
`docs/ASSET-PROVENANCE.md`.

## Photorealistic layer (`living/`)

Codex's Blender-rendered cabinet (`living/assets/hero.webp`) with the live DOM
controls in its openings. The record changer is presented from rendered change
sheets (`load-0..8.webp`, `eject-0..5.webp`) on the changer's own clock, with
projected live album labels and 36 rendered tonearm views. `mechanism.js` sends
its moves to the layer (`jukebox:mechanism` events) and still owns every timer;
the music never waits for a picture.

The platter drive (`living/drive.js`): the spindle motor's 26T -> 32T -> 28T ->
40T train turns with the record, following the approved pose solver
(`angle = spin x 26/T x (-1)^(3-j)`). There is no clock of its own: while playing
it follows the record's CSS spin plus a fixed offset; during a change it follows
the authored spin of the change frame on screen; on seating it re-engages
continuously. Gear frames (60 lit angles per gear), clean drive plates and arm
masks are pre-rendered from the approved scene (`living/assets/drive*.webp`,
`drive.json`). The renderer and packer live on the development branch
`claude/living-jukebox-drive` (`prototypes/living-jukebox/integration/drive/`).

If any visual asset fails, the layer falls back (static drive, or the classic
controls) and the music carries on.

## Offline and updates

`sw.js` precaches the shell: both pages, all code, effects and every
photorealistic file (the list in `living/offline.js`; tests keep them equal).
Pages and code are network-first with a 3.5 s timeout, then the saved copy. Covers
come from the crate cache; songs are saved by LOAD THE CRATES (`crates.js`) and
played from Blobs by `player.js`, never through the worker; the film lives in OPFS
after SHA-256 verification. A new shell version (`SHELL_CACHE`) installs in the
background, activates and retires only the old shell cache: songs, covers and the
film are kept. Nothing reloads the page mid-show. OFFLINE READY requires every
song, the verified film and (photorealistic page) the confirmed visuals.

## Behaviour reference

- The site opens on the dormant cabinet: the jukebox almost invisible in a dark
  basement, its old picture tube the only light, the little RFAI robot faint and
  breathing in the static. There are no instructions on purpose. Click, tap or
  press any key: the coin goes in and the approved 35-second film **The Song
  Inside** plays (Sound Design V5-B4: the machine ignites, fragments of *We Have
  Come* and *According to His Power* break through, a laugh travels into the
  groove). *Praise Lifted On High* starts from the film's own frame clock so its
  first hit lands on the stylus touchdown (frame 948, 50 ms lead), and the film's
  last frame lands exactly on the live record (C1). The photorealistic jukebox is
  already playing, its record turning at 45 rpm with the drive gears turning it.
  Without a verified film the old live cut plays instead.
- **TOOLS** holds FULLSCREEN, LOAD THE CRATES, KEYBOARD SHORTCUTS, a Vinyl texture
  trim, an optional click-to-fill setting and *The Awakening starts the music*. Click it
  or use Enter/Space; Escape or a click outside closes it. Music, effects,
  shuffle and lights stay directly available on the deck.
- The music starts by itself after the Awakening (see above). **START** /
  **PAUSE** works as always; with the TOOLS setting unticked, START begins the
  house rotation by hand.
- **Pick a song by its code**, like a real jukebox. The left column is
  **PICK A SONG**: one album at a time, with a flexible sleeve above its complete
  track list. The selector sits beneath **UP NEXT** in the right column.
  Flip albums with the **arrow buttons** either side of the album name,
  or press a **letter key** (on screen or keyboard) - the rack jumps to that
  album. Then press the number and **SELECT** (or type it, for example `B`,
  `1`, `Enter`). The readout names the resolved song and prompts the next step
  before it is added. By default the title strips are for reading. In **TOOLS**,
  enable **Click a song to fill its code** to prefill a strip's code by clicking
  it or pressing Enter/Space while it is focused. This moves focus to **SELECT**;
  you still confirm the request with SELECT or Enter. The choice is remembered
  on that laptop. All current album tracks are visible together. A longer future album
  can be scrolled within its list. The chosen song joins **UP NEXT** above the
  selector, with confirmation of its position or that it is starting.
- **Smaller screens keep readable text.** The cabinet uses two columns on narrow
  windows and one column on phones, with page scrolling to reach every control.
  Normal laptop and projector windows retain the three-column cabinet. Album
  artwork still uses the space left after its complete track list.
- The scrolling LED strip under the sign rolls **one joke at a time**: skating,
  church and youth-group life, snacks and retro comedy. It draws from 234 lines
  (no repeats until every one has had a turn), with a separate set of 40 for
  when the music is stopped or paused. To add or
  change jokes, edit the `SKATE_JOKES` list in `copy.js`: ALL CAPS, 64
  characters at most, one per line in quote marks with a comma after.
- UP NEXT plays **first in, first out**. Its count includes every request, up to
  30. Scroll within the queue to inspect them all; a continuation cue appears
  when more remain below. Use the arrows to move a song up and the cross to
  remove one. Keyboard focus and the scroll position are retained while editing.
  The note says **Your picks play first. We'll keep the records turning.**
- When UP NEXT is empty, the **house rotation** picks the next song itself, so the
  rink is never silent. The **SHUFFLE** button chooses how:
  - **SHUFFLE: ON** (the default): a shuffled deck. **Every song plays once before
    any song repeats**, and a song never comes round again within 5 plays, even
    when the deck is reshuffled. Songs you pick yourself count as played.
  - **SHUFFLE: OFF**: plays in the order the songs are listed in `tracks.js`,
    then starts again at the top.

  Any spare rows in UP NEXT show the house's plan, greyed out under **IF NOBODY
  PICKS** - exactly the songs that will play, in order, if nobody chooses one.
  Pick one of those songs yourself and it moves up into your list instead.
  SHUFFLE is on every time the page loads.
- **SKIP** (or **N** / the right arrow) plays the next song straight away.
- **BACK** (or **P** / the left arrow): more than 3 seconds into a song it starts
  that song again; press it within the first 3 seconds (or twice) to go to the
  song that played before. The song you left goes to the **top of UP NEXT**, so
  SKIP brings you straight back to it. The machine remembers the last 50 songs.
- **Credits** are for show. A persistent **FREE PLAY** reminder confirms that
  requesting a song needs no payment, and the credits readout says FREE PLAY
  when the decorative credits run out.
- The **offline status** at the top is a button: press it to open TOOLS with
  **LOAD THE CRATES** focused. Saving starts only when you press LOAD THE CRATES.
- After **60 seconds** with nobody touching anything, the machine runs a light
  show. Touch any key to stop it.
- Switching songs fades out and in. You hear no hard cuts. The precision changer
  slows into its pickup position, lifts and transfers each record, then lowers
  the needle. The visible record spins at **45 rpm**.
- The coin animation and seven original mechanical sound effects accompany the
  keys, selection relay, changer, needle and page carrier. **Effects** has its own
  volume slider; custom MP3s in `sfx/` can replace individual sounds.
- Each record crackles like a played-in 45: the approved record-surface loop
  (`sfx/vinyl-surface.wav`, Sound Design V4; 9 s, seamless, saved for offline
  use with the app). On the night's opener it starts with the song at the film's
  stylus contact and carries straight on past the film. When a record is changed the
  changer works audibly - motor, ratchets, the carousel locking, servos, the
  record settling, the tonearm (recordings, varied each time) - and the needle
  drops with a recorded touchdown, then the lead-in groove crackles for about **1 second** before the song
  starts. As a song fades out the crackle carries on (the run-out groove).
  **Effects** controls this texture alongside the cabinet sounds; **Music**
  does not touch it. The **Vinyl texture** slider in TOOLS turns down just the
  texture; **0%** removes vinyl (and the 1-second lead-in) without silencing
  cabinet sounds. Music, Effects and Vinyl texture show their current
  percentages. Resuming a paused song does not replay the needle drop.

- Once the film hands over, the machine keeps working quietly around the
  music: a low motor bed, an electrical hum and occasional distant rattles,
  servos, sparks and relays, a little lower while a song plays (Effects
  volume; details in `sfx/README.md`).


## Tests and tools

See `README.md` (Local development) and `docs/RELEASE.md` (validation gates).

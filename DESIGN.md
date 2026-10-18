# Skate by Faith — Roller Palace RP–85

The site is an imagined premium jukebox for an eighties roller rink. It keeps
the RFAI identity and real worn record sleeves inside a single substantial
cabinet. It is a deliberate revival design, rather than a replica of a named
historic machine.

## Art direction

The machine is dark enamel and aubergine, smoked glass, chrome rails, warm
lamplight, paper title strips, and translucent selector keys. Cyan and magenta
belong to particular electrical circuits. Artwork keeps its original colours.

The hierarchy is cabinet identity, current song, mechanism, selection, upcoming
songs, then operator utilities. Avoid floating interface cards, uniformly glowing
borders, screen interference over physical materials, or additional permanent
visualisers. Every fitting should have a plausible purpose.

### Materials and palette

- **Enamel:** `--ink #17131F`, `--cab #241D2C`, `--cab-2 #33273B`.
  One continuous fascia, seams, consistent metal trim and subtle surface grain.
- **Smoked glass:** `--screen #100F14`. Recessed mechanical and electronic
  apertures, restrained highlights, shadows at the edges. No scanlines on paper,
  metal or artwork, and no random whole-page electrical dips.
- **Metal:** layered warm greys with a consistent highlight direction. The
  magazine, gripper, platter, arm, selector mount and outer rails use the same
  construction language. Small fasteners and a lower speaker grille establish
  the physical enclosure.
- **Paper and lamps:** `--cream #F0E6D2`, amber `--gold #F5B846`. The actual covers
  already contain their wear and price stickers; never repaint or duplicate
  those stickers. Extra ring wear stays subtle.
- **Circuits:** cyan `#54DDD5` for live readouts and focus; magenta `#EF4B99` for
  selected interaction. Left/right light rails hold cyan/magenta. The crown is
  a warm circuit. Decorative lighting never obscures useful information.
- **Errors:** `--red #FF5470`, plus readable text. State is never colour alone.

Bungee remains the signature on the marquee and welcome screen. Barlow carries
song titles and printed hardware labels; JetBrains Mono carries numbers and
readouts. All fonts are local, so the cabinet works offline.

## Layout

The main widescreen view uses a continuous frame, marquee, announcement strip,
selection bay, hero record window, upcoming list, operator deck and speaker
plinth. At 1280×720, all essential controls and three title strips fit without
page scrolling. Additional album tracks scroll within the paper-strip window.

The crowd screen has more room for the mechanism and current song, no controls,
and larger readouts. The rack shows all its paper strips; the sleeve shrinks as
needed. The same HTML and IDs support both windows, but the proportions differ.

The 4:3 arrangement stacks the rack's sleeve above its strips and centres the
mechanism vertically. Narrow screens use an intentional scrolling arrangement,
with now playing first. Desktop remains the primary projector workflow.

The operator deck keeps transport, music/effects levels, shuffle, crowd and
lights immediately available. SETUP discloses fullscreen and LOAD THE CRATES.
Native disclosure keyboard behaviour is preserved by `cabinet.js`; Escape and
outside clicks close it. Offline readiness and library errors remain visible
at the top of the operator cabinet.

The queue displays up to six actual requests and up to three house suggestions
in spare slots. House suggestions have an explicit IF NOBODY PICKS label and
remain readable. Real requests always play first. The queue can scroll when
necessary; suggested entries at the bottom are trimmed to the available space.

## Arrival and interaction

**The thirteen-second arrival is intentional and cannot be skipped.** Its
self-test prints over ten seconds, then the cabinet completes the full hold and
existing 640 ms reveal. A warm-up bar accompanies the original diagnostics.
Keyboard and pointer input cannot activate controls behind the arrival. CALM
retains the same hold with static diagnostics. A completed arrival is remembered once per tab,
so reloading during the event does not impose another wait. Reloading during
the initial warm-up starts that full sequence again. The recovery cap
and CSS failsafe remain safeguards for failed initialisation.

INSERT COIN is the browser gesture that unlocks sound. Its click/key must happen
after arrival; the diagnostic sequence is silent. Credits are decorative and
never prevent a selection. Album letters and song numbers remain generated
from `tracks.js`; F, I, N, O, P and S stay reserved or omitted.

Keys physically depress and remain latched while a code is being entered.
Selection is by code, not by clicking the paper. A brief acknowledgement and
local light transfer accompany an accepted pick. Album navigation retains the
hinged page movement and catch sound.

## Mechanism and motion

The magazine is drawn to canvas when needed, with recessed graphite, chrome
rails, individual cradles, coloured index tabs and mounting fasteners. Its
rotation is a CSS transform and always clockwise, slowing into final indexing.
The gripper engages for pickup/return; the record lifts before turning face-up,
settles onto the spindle, and returns in the reverse sequence. The tonearm
advances with playback. The visible record rotates at **45 rpm** (1⅓ s/turn).

Timing contracts are unchanged: 1.5 s normal load, 1 s normal eject; skip uses
1.8× speed. Natural changeover pre-rolls eject 2.5 s and loading 1.5 s before the
end. Music is scheduled independently of animations. A stalled effect must
never delay playback. WAAPI animations are cancelled after their sequence.

During music, VU meters, the spectrum and one gentle cabinet-light circuit react.
The spectrum uses 36 logarithmically spaced bands capped at 15 kHz, avoiding
empty high-frequency bars above the useful MP3 range.
The tube drift and crown lighting keep steady rates. No scenery or lamps race
to the beat. Idle browsing and a slow cabinet light sequence remain available.

## CALM and performance

Every decorative animation has a static equivalent. CSS disables animations
and transitions in CALM; JavaScript effects show their finished state. The
arrival retains its duration, functional clocks/progress still update, and the
music remains independent. OS reduced-motion is the initial preference; the
operator's stored LIGHTS choice takes precedence.

Keep brightness changes smoothed and gated, and avoid large-area flashing.
Photosensitivity rules and CALM behaviour have automated checks. Neon signage
uses only shallow brightness dips; the full cabinet never flickers at runtime.

Visualisers share one 30 fps loop with reusable buffers and bounded canvas
resolution. Canvas decoration is drawn once when possible; moving parts use
transform/opacity. Hidden windows pause drawing; audio does not depend on it.
Full, CALM, wide, 4:3, long-title and crowd states all need browser validation.

## Sound

Music and effects have independent levels and meet at the existing compressor.
The supplied pack contains seven small **original physically modelled WAVs**,
not field recordings. `scripts/generate-sfx.py` reproduces them using Python's
standard library. `sfx/README.md` records the source, lengths and overrides.

- Coin: dry chute impacts and a short metallic tail.
- Key: short, close switch contact.
- Confirm: a relay latch, without an arcade melody.
- Whirr: motor/gear movement, trimmed to fit its action.
- Thud: a gentle needle landing, without a bass-drop effect.
- Buzz: a muted mechanical refusal.
- Page: catch release and landing.

A custom `sfx/<name>.mp3` has priority. Missing or undecodable custom audio falls
back to the supplied WAV, then a quiet live model. Failure cannot stop music.
The public flicker effect remains a silent compatibility hook. Do not add
constant crackle, mains hum, or random electrical sounds over the songs.

The WAV pack and cabinet script are precached with the app shell for offline
use. Real speakers/projector still require a venue sound and readability check.

## Playback, offline and crowd contracts

- `tracks.js` remains the simple hand-edited volumes/tracks data file. Codes and
  durations are computed; malformed entries are reported and skipped.
- Queue/shuffle/history semantics remain intact. Broken media is marked OUT OF
  ORDER and skipped without taking the rest of the machine down.
- LOAD THE CRATES caches music/covers and reports progress/readiness. Files are
  refreshed by ETag/size and removed when no longer referenced.
- Cached songs play from Blob URLs, not through the service worker. Do not route
  song bytes through `sw.js` without separate reliability testing.
- The app shell is network-first with a 3.5 s fallback timeout. Covers use their
  saved copies; app fonts/scripts/original effects are precached.
- The crowd window is silent and follows state, rack page, selections, mechanism,
  clocks and meter levels over BroadcastChannel. It catches up through a snapshot.
- The crowd window follows the saved lights choice and goes fullscreen on a
  gesture after arrival. Minimise neither window during projection: browsers
  may pause the operator drawing that supplies crowd meter levels.
- Wake Lock and Media Session remain optional enhancements, with graceful failure.

## Main surfaces

| File | Responsibility |
|---|---|
| `index.html`, `styles.css` | Cabinet, materials, layouts, arrival and CSS motion |
| `cabinet.js` | Native operator disclosure and dismissal behaviour |
| `app.js`, `crowd.js`, `link.js` | Operator state and silent crowd mirroring |
| `ui.js` | Sleeves, strips, keypad, readouts, queue and announcements |
| `mechanism.js`, `carousel.js` | Record handling and magazine rendering |
| `fx.js`, `lights.js`, `neon.js` | Arrival, CALM decision and bounded signage effects |
| `sound.js`, `sfx/`, `scripts/generate-sfx.py` | Original mechanical effects and overrides |
| `audio.js`, `player.js` | Audio engine, probing, two music decks and fades |
| `visualiser.js`, `dsp.js`, `arch.js` | Meters, spectrum and restrained cabinet lighting |
| `crates.js`, `sw.js`, `rink.js` | Offline readiness, app shell and browser enhancements |
| `tracks.js`, `codes.js`, `queue.js`, `rotation.js`, `copy.js` | Library, pure rules and copy |
| `tests/` | `npm test`, using Node's built-in runner |

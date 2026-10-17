# Design system - the jukebox

Skate by Faith ("Not by Sight - An 80s Rollerskate Night") is an 1980s arcade
jukebox that plays a playlist at a church roller-skate night, on one laptop plugged into a projector. It is a sibling of
the trivia quiz machine (`bhay95-collab/trivia_fridays`) and reuses its visual
DNA on purpose. This file records the material system, motion rules, safety
rules and constraints so future changes stay **one coherent object** instead of
drifting back toward generic defaults.

The creative direction is decided and should not be changed casually:

> The **machine** is full 80s arcade neon (synthwave grid horizon, neon tubes,
> CRT glass, hard-shadow plastic cabinet, chasing bulbs). The **RFAI album
> covers** live *inside* it as worn record sleeves - old vinyl in a glowing
> machine. Both identities stay intact. **Never recolour the covers neon.**

## Material system

Everything on screen is built from a short list of physical materials. Nothing
else gets invented without extending this list first.

- **Cabinet** (`.panel`, `.deck`, `.tube`) - a purple face panel with a *hard
  offset shadow* (`--drop`, `0 .35rem 0 rgba(0,0,0,.45)`), never a soft glow.
  Panels do not float; they sit on the page like moulded plastic.
- **Screen** (`.screen`, `.led`, `.ticker`, `.queue`, `.readout`, `.mech`) - a
  recessed near-black CRT display for anything with a number or a queue on it.
  Inset shadow, scanlines, a curved-glass highlight and one bright band rolling
  slowly down the glass (`crt-roll`). Numbers are `JetBrains Mono` tabular.
- **Title tab** (`.panel-title`, `.tab`) - a gold tab "screwed on" to the top
  edge of a panel at a slight tilt, alternating direction (`.tab-tilt-a` /
  `.tab-tilt-b`) so no two look mass-produced.
- **Arcade button** (`.btn-gold`, `.btn-select`, `.btn-deck`, `.key`) - a hard
  drop shadow that collapses on `:active` as the button physically travels down.
- **Neon tube** (`.wordmark`, `.w-cyan`, `.w-mag`, `.neon`) - white core plus
  coloured halos, for **signage only**. Never for body copy, the song title or
  the clock.
- **Grid horizon** (`.synth-horizon`) - the synthwave world the cabinet sits in:
  faint perspective grid in the lowest band, starfield in the side gutters, one
  thin horizon line, glass vignette and whisper scanlines. Kept at trivia's
  level: atmospheric as a whole, invisible while reading.
  One fixed layer at the back. Its grid speed follows the music.
- **Bubble tubes** (`.tube`) - Wurlitzer-1015-style arches either side of the
  Now Playing panel with rising bubbles and slow colour-cycling.
- **Sleeve** (`.sleeve`) - the new material: a worn paper record sleeve with a
  hard shadow, scuffed inner edge and a faint **ring-wear** circle (the pale
  mark a record rubs into a sleeve) laid over it. The real RFAI covers already
  *are* worn sleeves (paper edge, stickers, price tags), so the artwork fills
  the card edge to edge and the jukebox adds nothing but the ring-wear. Only the
  plain fallback sleeve (cover missing) gets a **price-sticker chip** ($1.29 /
  $1.49 / $1.99 / SPECIAL BUY!, picked from the volume id so it never changes). Everything inside a sleeve is sized in
  `cqw` so one design works from the changer window to the big rack page. If the cover
  picture is missing, a plain printed front is drawn instead (`.sleeve.is-bare`).
  Title strips (`.strip`) are the same paper.

Do not introduce soft glassmorphism, AI-purple gradient blur, or **side-tab
accent borders** (a thick colour bar down one edge of a card). Selected states
use a full ring, never a side stripe.

## Palette

The cabinet tokens are trivia's, **exactly**:

```
--ink       #140722   page background base
--ink-2     #1D0B33   sign interior
--cab       #2B1147   cabinet face (dark end of gradient)
--cab-2     #38175C   cabinet face (light end of gradient)
--cab-edge  #4A2670   cabinet border / bezel
--screen    #0C0516   recessed display background
--magenta   #FF2D95   act here / selected
--cyan      #25E8E2   numbers, LEDs, focus rings
--gold      #FFC531   the ONE biggest button (Insert Coin / Start)
--cream     #FFF3DE   body text on dark
--dim       #A98CC4   secondary text, metadata
--red       #FF5470   out of order / refused - nothing else
```

Sleeve tokens (used **only** on sleeve and sticker materials, plus the record
label and the volume code chips):

```
--sl-gold   #D09A25   mustard of Vol. II, III, VI, VII
--sl-rust   #C8461E   orange-red stripe and frame (Vol. II)
--sl-paper  #E2D8C6   cream card (Vol. I, III, IV, X)
--sl-sepia  #6D5036   sepia photography
--sl-ink    #1E1510   print ink
--sl-wine   #7A1F2B   maroon of Vol. VI
--sl-teal   #3E8F8A   Vol. V, VII, X
--sl-mauve  #9B6A87   Vol. IV, IX
```

> All ten covers (Vol. I-X) are in `covers/`; every sleeve colour was sampled
> from them by eye. Volumes are lettered in list order, skipping F, I, N, O, P, S:
> I=A II=B III=C IV=D V=E VI=G VII=H VIII=J IX=K X=L.

**One accent per job, never swapped:** magenta means "act here / selected",
cyan means "this is a number or a light", gold means "this is the biggest
button on the screen". INSERT COIN is the only gold button on the attract
screen; START / PAUSE is the only gold button on the machine. SELECT is magenta.

## Typography

- **Display:** Bungee - wordmark, panel tabs, song title, buttons that need to
  shout.
- **Body:** Barlow (400 / 500 / 700) - **not** Inter or Space Grotesk.
- **Numerals:** JetBrains Mono, `font-variant-numeric: tabular-nums`, for every
  number, time, selection code and LED readout, so digits never jitter.

All three are **self-hosted** in `fonts/` (latin subset, woff2), so the machine
needs no internet to look right. The page is also pre-cached by the service
worker.

## Layout

- The whole machine is sized in `rem`, and the root font size follows the
  window: `min(window width / 64, window height / 36)`. A 16:9 projector shows
  the same picture at any resolution. The design canvas is **64 x 36 rem**
  (1280 x 720 at 20 px per rem). Check every change at **1280 x 720**.
- `body` never scrolls. The only internal scrolling is the title-strip list when
  a volume has more songs than fit.
- Rows: marquee, LED ticker, cabinet, operator deck, key legend.
- Cabinet columns: tube | **PICK A SONG** (one third) | **NOW PLAYING** + **UP
  NEXT** (two thirds, split 1.3 : 0.7) | tube.
- PICK A SONG is one panel: the rack page on top (one album at a time - a big
  sleeve as tall as the page, capped at 46% of the width so the title strips
  keep room for two-line titles, with arrows to flip albums) and the selector
  underneath (readout, letter keys wearing a dimmed copy of their cover, number
  keys, CLR / DEL / SELECT / COIN).
- Pressing a letter key (or typing it) flips the rack to that album, so the
  operator sees its songs while finishing the code.
- The most important things are the largest: song title (Bungee), the LED clock,
  the UP NEXT titles and the ticker. The strips are reference material for the
  operator; status (NOW / Q2 / OUT OF ORDER) is a small tag clipped onto the
  strip's corner so titles keep the full width.
- About 3 songs per album fit without scrolling at 1280 x 720; a 4th scrolls
  inside the strip window.

## Restraint (the October refinement pass)

The first build had every effect at full strength and read as "everything has
been added". The rule now is **one machine, quietly lit**: the cabinet, the
record changer and the readouts carry the show; the world around it stays dim.

- Removed: RFAI PRESENTS (header tab and INSERT COIN screen), the roller-skater
  silhouettes, the hanging mirror ball, the outrun sun, the bloom around the marquee sign and bubble tubes, the platter glow.
- Dimmed to trivia's levels: the rolling grid (opacity 0.16, lowest band only,
  7 s per cell, music speeds it up to 1.6x at most), stars (gutters only), the
  horizon line, the bass swell (0.14-0.34), mirror-light spots (7, half as bright,
  behind the cabinet), neon glows, LEDs, the spectrum (82%), the bubble tubes
  (liquid 5-24%, slower bubbles), the paper strips and the VU faces (warm, not white).
- Slowed: the LED ticker (4.2 rem a second, readable from the back), bulb chase
  (2.6 s), neon flicker dips only to 80% so a word never looks switched off.
- Framed: trivia's CRT bezel at .7 rem with four corner fasteners and an inner
  shadow, with the machine inset from it, so the page reads as a cabinet screen.
- Boot: trivia's pacing - a 13 s hold with the self-test printing across 10 s
  (17 s cap, 18 s CSS failsafe). Header line: SKATE BY FAITH JUKEBOX.
- VU meters: landscape windows; the scale and the needle's pivot are computed
  from the smaller side so nothing is ever cut off.

- Selection is by code only (keypad or keyboard). The title strips are read-only
  paper, as on a real Wurlitzer/Seeburg; the rack arrows and letter keys only
  flip which album's strips are showing.

Before adding anything new, ask what it replaces.

## Motion

Port of trivia's effects, then the jukebox mechanics on top.

**Ported from trivia:** CRT power-on boot with a random self-test (`startBoot`),
neon flicker with a random pattern/speed/phase per tube (`neon.js`), the synth
horizon (grid, stars, glow line), CRT glass roll band, chasing marquee
bulbs, the blinking attract prompt, score-reel count-ups (`countUp`, used for
the credits counter).

**Record mechanism** (`mechanism.js`) - on selection, one scheduled timeline of
Web Animations (compositor only):

| t (normal speed) | What happens |
|---|---|
| 0 - 0.47 s | The volume's **sleeve slides out of the rack** to the mechanism window (FLIP from the big rack sleeve if that album is showing, otherwise from its letter key). Whirr. |
| 0.47 - 1.0 s | The **record rises out** of the sleeve and glides across the platter, lifted slightly. |
| 1.0 - 1.2 s | The record **drops** onto the platter and starts **spinning** (33 1/3 rpm = 1.8 s per turn) with the cover as its label. |
| 1.0 - 1.5 s | The **tonearm swings** across; **needle-drop thud** at 1.5 s. |

At the end of a song the same moves run in reverse (1.0 s): arm lifts, record
slides back under the sleeve, sleeve returns to the rack. During the song the
tonearm creeps toward the middle of the record with progress.

For a natural song change the changer **pre-rolls**: the eject starts 2.5 s
before the end, the next record loads 1.5 s before the end, so the needle lands
as the song ends. The last 1.2 s of every song fades out (`TAIL_FADE_SEC`), which
hides the swap. Measured gap between songs: about 40 ms. On a skip the changer
runs 1.8x faster (about 1.4 s).

**Audio-reactive** (`visualiser.js`, one shared `requestAnimationFrame` loop,
capped at 30 fps): neon spectrum bars with peak caps, twin needle VU meters,
bubble tubes that speed up with the music, grid scroll speed and bulb chase speed
(`playbackRate` of the CSS animations), and a soft bass swell on the cabinet glow.

**Ambient:** a few faint mirror-ball light spots drifting *behind* the cabinet (CSS
transform only), the LED ticker scrolling NOW PLAYING / UP
NEXT / announcer lines, bubble tubes colour-cycling over 48 s.

**Idle attract mode:** after 60 s with no input the machine runs a light show:
bulbs chase faster, the rack pages through the albums
(and shows each cover in the changer window while nothing is playing), the
ticker mixes in attract lines. Any input ends it.

**Coin:** a cream coin drops into the slot, clunk + ring, the credits counter
ticks. Credits are cosmetic and never block a selection: with no credits the
LED reads **FREE PLAY** (real arcade term).

### Performance rules (3+ hours on a modest laptop)

- Animate **only** `transform`, `opacity` and `background-position`.
- Visualisers draw on `<canvas>` from preallocated buffers; **nothing is
  allocated per frame**; no `shadowBlur` (glow is faked with a wider translucent
  rect).
- One shared animation loop; it stops when the tab is hidden and when lights
  are CALM. Music never depends on it.
- WAAPI animations are cancelled when their sequence ends (no accumulating
  `fill: forwards` animations). Decks reuse
  two `<audio>` elements and revoke each Blob URL when a song is replaced.
- Soak-tested: see "Verification" in README.

## Safety rules (non-negotiable)

### Photosensitivity (WCAG 2.3.1: no more than 3 flashes in any second)

- **Nothing flashes full-screen or large-area faster than 3 times a second.**
- Music-driven brightness goes through `dsp.js`: an **envelope** (attack 140 ms,
  release 420 ms) and a **beat gate** (340 ms minimum gap = at most 3 pulses a
  second). The bass swell is an opacity *swell* on a soft glow layer between
  0.16 and 0.50, never an on/off flash. Both are unit-tested.
- Neon flicker dips only to about half brightness, a burst holds at most two
  dips, on a few words of signage only.
- The boot sequence was changed from trivia's: the screen flicker now has dips at
  least 0.45 s apart, and the logo power-on flicker is spread over 1.4 s. The
  single white boot flash happens once, at 85 % strength.
- The blinking attract prompt is 0.87 Hz and only changes text colour.
- The record's sheen is a low-contrast highlight rotating at 1.1 passes a second
  over a small area.

Audit list - every `@keyframes` in `styles.css` and its rate:
`crt-roll` 6.5 s, `star-twinkle` 7 s, `grid-scroll` 3.4 s (movement), `bulb-chase`
1.6 s (small dots moving), `neon-flicker-a/b/c` 7-14 s with 1-2 dips,
`ball-turn` 9 s, `record-spin` 1.8 s, `dot-pulse` 1.2 s (small LED),
`attract-blink` 1.15 s,
`coin-drop` once, `score-pop` once, boot sequence once per tab.

### Calm lights (`prefers-reduced-motion` and the on-screen switch)

- **Motion off, finished state shown** - not "motion lite" (trivia's rule).
- Because the venue laptop's OS setting may not reflect the room, the header
  deck has a **LIGHTS: FULL / CALM** switch. With nothing saved it follows the
  OS (`prefers-reduced-motion`); once pressed, the choice is remembered in
  `localStorage` (`sn-lights`) and wins.
- CSS: `html[data-lights="calm"]` switches every animation and transition off.
  JavaScript effects ask `isCalm()` and jump to the finished picture:
  the changer shows the record already on the platter, the ticker holds still
  text (swapped every 8 s), the visualisers draw one quiet still frame, the
  the boot sequence is skipped, the mirror-light spots hold still.
- Every animation has a calm equivalent; a new animation must add both halves.
- Functional readouts (the clock, the progress tube, the queue) still update in
  calm - they are information, not decoration.

### Errors never stop the music

- Audio is started on plain timers (`setTimeout`) and the audio element's own
  `ended` event. It never awaits an animation promise.
- Every effect is wrapped in `safely()`; a failing draw switches itself off with
  a console warning.
- A missing or unreadable MP3 becomes **OUT OF ORDER**, is dropped from the
  queue and skipped by the house rotation. A typo in `tracks.js` shows a red
  CHECK TRACKS.JS button with a plain-English list instead of crashing.
- A start-up failure shows "START-UP PROBLEM - PRESS F5" on the INSERT COIN
  screen rather than a dead page.

## Playback controls: shuffle, skip, back

- **Shuffle** (`rotation.js: pickShuffle`) is a shuffled deck: every playable song
  plays once before any repeats, the last-5 rule still holds when the deck is
  reshuffled, and songs picked from the queue count as played. Shuffle off uses
  `pickInOrder`: the order of `tracks.js`, wrapping round. The choice is saved in
  `localStorage` (`sn-shuffle`); the default is on.
- **Skip** takes the queue head or the house pick. **Back** keeps a 50-song
  history: after 3 s it restarts the song, before that it goes to the previous
  song and puts the song it left at the top of UP NEXT (`enqueueFront`), so Skip
  returns to it. Both are ignored while the record changer is mid-swap.
- Shortcuts: Left / P back, Right / N next, S shuffle, F fullscreen, Space play /
  pause. These letters (F N P S) are therefore never used as volume letters. The
  laptop's previous-track media key is wired to Back.

## Sound

Two separate volume paths: music and effects (`audio.js`). Both pass through a
gentle limiter so a loud track meeting a loud beep cannot hurt the speakers.
Effects are **synthesised** with Web Audio (`sound.js`, ported from trivia): no
audio files, no licensing, no loading. **Off until a person clicks** - the click
on INSERT COIN is the browser's required gesture.

| Effect | The one moment it belongs to |
|---|---|
| `coin` | A coin drops into the slot |
| `key` | A keypad button is pressed |
| `confirm` | A song was added to the queue |
| `whirr` | The record mechanism moving |
| `thud` | The needle lands on the record |
| `buzz` | Something is out of order / refused |

Do not reuse one for another moment, and do not add an effect without a
one-sentence reason a skater would recognise.

## Content tone

Warm, wholesome, playful, church-family friendly. **Rotating copy is the rule**
(trivia's pattern): every line a person sees all night is held in a big pool in
`copy.js` and dealt like a shuffled deck (`createRotator`) so nothing repeats
until every line has been used, and the same line never appears twice in a row.
Callers pick once and hold the line so nothing flickers.

Pools: boot self-test (`BOOT_POOL`, 30 lines), ticker lines (20), rink-announcer
calls (24, including "ALL SKATE!", "COUPLES SKATE - GRAB A FRIEND", "REVERSE
DIRECTION!"), attract lines (14), out-of-order messages (12). `tests/copy.test.js`
checks size, uniqueness, ALL CAPS, length (readable from the back of the rink),
and a family-friendly word guard.

## Data boundaries

One data file, `tracks.js`, is edited by hand by a non-developer. It is
deliberately tiny: volumes `{ id, title, cover, accent }` and tracks
`{ id, title, volume, file }`. **Durations are never typed** - they are read
from each MP3's metadata. **Codes are never typed** - the letter comes from the
volume's position, the number from the track's position within its volume. The
codes skip F, N, P, S (keyboard shortcuts) and I and O (they look like 1 and 0
from 10 metres). Everything about reading and validating that file lives in
`codes.js` and is unit-tested, including every way a hand edit can go wrong.

## Reliability design decisions

- **Wake Lock** keeps the laptop awake; re-acquired when the tab returns.
- **Media Session** gives working laptop media keys and an OS now-playing card.
- **LOAD THE CRATES** saves every MP3 and cover into a browser cache with a
  progress meter; the OFFLINE READY LED lights when everything is saved.
  Pressing it again only re-downloads files whose ETag/size changed, and clears
  files no longer in `tracks.js`.
- **Saved songs play from Blob URLs, not through the service worker.** An early
  version served MP3s from the cache through the service worker and Chrome's
  media pipeline failed with `PIPELINE_ERROR_READ`; the cause was not isolated
  in a standalone page, so the design avoids the interaction altogether.
  `player.js` reads the saved copy, plays it from a Blob URL and revokes the URL
  when the song is replaced. The service worker only handles the app itself and
  the cover pictures. Do not route audio through `sw.js` again without testing
  offline playback on a real laptop.
- The app shell is **network-first with a 3.5 s timeout** so an edit to
  `tracks.js` shows up as soon as the laptop is online, while a dying venue wifi
  (which hangs rather than fails) falls back to the saved copy.

## Surfaces

| File | Purpose |
|---|---|
| `index.html` | Page structure: boot overlay, attract screen, background world, the machine |
| `styles.css` | All styling and every `@keyframes` (single stylesheet, tokens at the top) |
| `app.js` | The conductor: state, queue flow, keypad, keyboard, attract, crates |
| `tracks.js` | **The one file Ben edits** |
| `codes.js` | Reads `tracks.js` into the library; generates selection codes |
| `queue.js` | UP NEXT list (pure) |
| `rotation.js` | House rotation: shuffled deck (every song once, never repeat the last 5) or in tracks.js order (pure) |
| `copy.js` | All rotating text pools and the rotator (pure) |
| `format.js` | LED clock formatting, volume curve (pure) |
| `dsp.js` | Spectrum bands, loudness, envelope, beat gate (pure) |
| `lights.js` | FULL / CALM decision (pure) |
| `audio.js` | Shared Web Audio engine, two volume paths, analysers |
| `sound.js` | Synthesised effects |
| `player.js` | Two audio decks, fades, gapless-feel, probing |
| `mechanism.js` | The record changer animation |
| `visualiser.js` | Shared loop, canvases, mirror light |
| `ui.js` | Rack, strips, queue, keypad, readouts, ticker |
| `fx.js` | Calm switch, boot sequence, count-up |
| `neon.js` | Desynced neon flicker |
| `rink.js` | Wake lock, media session, service worker registration |
| `crates.js` | LOAD THE CRATES, saved-copy lookup |
| `sw.js` | Service worker (app shell + covers only) |
| `tests/` | `node --test` suites for every pure module |

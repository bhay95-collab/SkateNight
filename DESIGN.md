# Design system - the jukebox

Skate by Faith ("Not by Sight - An 80s Rollerskate Night") is an 1980s arcade
jukebox that plays a playlist at a church roller-skate night, on one laptop plugged into a projector. It is a sibling of
the trivia quiz machine (`bhay95-collab/trivia_fridays`) and reuses its visual
DNA on purpose. This file records the material system, motion rules, safety
rules and constraints so future changes stay **one coherent object** instead of
drifting back toward generic defaults.

The creative direction is decided and should not be changed casually:

> **The Living Jukebox.** The machine is the cabinet the INSERT COIN film woke
> up in a dark basement, now fully running - not a website after a film. A
> dark lacquered body with precise points of light: the neon wordmark, amber
> bulbs, cyan LED digits, lit keys, the lamp over the record changer. The
> **RFAI album covers** live *inside* it as worn record sleeves. **Never
> recolour the covers.**

Darkness is part of its character, never an excuse for low contrast: titles,
codes, queue positions and times stay large and bright. Colour is emitted light
and meaningful feedback, not paint on surfaces. The three-column operator
layout (the archive | the heart | the register and selector) and the control
deck are kept on purpose: they work at a live event. Retain the original
mechanical sound pack, precision record-change choreography and timing, the
**PRECISION RECORD CHANGER** / **45 RPM · STEREO** labels, the queue note, and
the coin animation. The full thirteen-second arrival remains unskippable.

The earlier purple-plastic cabinet over a synthwave grid (ported from trivia)
was retired for this direction in October 2026; the attract cabinet's lacquer,
chrome and bulbs (`styles.css` ATTRACT) are the reference for every material.

## Material system

Everything on screen is built from a short list of physical materials. Nothing
else gets invented without extending this list first.

- **Lacquer** (`.rig::before`) - one violet-black body behind everything, its
  crown following the arch, lit from above and by its two tubes. The bays
  (`.panel`) are **recesses cut into it** (inset shadow, thin chrome trim),
  never raised cards. The deck (`.deck`) is a brushed steel shelf across its base.
- **Chrome** (`--chrome`, `--bezel`) - rails, bezels and trim that catch one
  light from above: the arch, the sign frame, the changer window, VU bezels.
- **Brass nameplate** (`.panel-title`) - each bay's name engraved on a small
  screwed plate, mono, letterspaced, `--plate` lettering.
- **Smoked glass** (`.screen`, `.led`, `.queue`, `.readout`, `.mech`) - recessed
  near-black windows for anything with a number or a queue on it, with one
  reflection from the room's light. Numbers are `JetBrains Mono` tabular, cyan.
- **Amber LED board** (`.ticker`) - lit amber text behind a dot grid.
- **Hardware** - ivory number keys (`.key`), backlit letter keys showing their
  album cover (`.key-letter`), steel deck keys (`.btn-deck`), the illuminated
  START lamp (`.btn-gold`) and SELECT button (`.btn-select`) in chrome bezels,
  chrome fader caps. A pressed or latched key lights from behind.
- **The record changer** (`changer.css`) - a dark chamber behind thick glass
  with one work lamp overhead that comes up while the gripper is working; a
  machined platter whose strobe dots catch the lamp at speed; vinyl with the
  gaps between tracks and a reflection that holds still while it turns.
- **VU meters** read loudness on a decibel scale like a real meter
  (`vuLevel` in `dsp.js`: -30 dBFS at the left stop, -12 dBFS pinned right,
  float samples, about 300 ms ballistics) with the MUSIC slider taken back out,
  so a typical song sits just right of centre and the beats swing it at any
  volume.
- **Monitor glass** (`.crt-glass`, `.crt-flicker`) - effects of the projector
  "screen" itself, so they cover the whole page inside the bezel, never one
  panel at a time: one faint bright band rolling down the whole screen
  (`crt-roll`, 9 s), and now and then the whole screen dips like an old monitor
  on a tired supply (`startScreenFlicker` in `fx.js`, planned by `planFlicker`
  in `lights.js`): one or two dips, at most 60% darker, under a second, bursts
  25-70 s apart, never in CALM. These visual dips are silent by default;
  `sfx.flicker` is only an optional custom-audio compatibility hook.
- **Travel** - every button has a lower edge that collapses on `:active` as it
  physically travels down.
- **Neon tube** (`.wordmark`, `.w-cyan`, `.w-mag`, `.neon`) - white core plus
  coloured halos, for **signage only**. Never for body copy, the song title or
  the clock.
- **The room** (`body`, `.mirror-light`) - the same basement as the film: near
  black, the cabinet's warm light on the floor, a little dust in the air.
- **Arch** (`.arch`, `arch.js`) - a chrome rail over the crown lined with steady
  amber bulbs, as on the attract cabinet.
- **Bubble tubes** (`.tube`) - the cabinet's two pillars, chrome-capped, with
  rising bubbles and slow colour-cycling.
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

The running machine adds its material and lamp tokens at the top of
`jukebox.css`: lacquer (`--lacquer-0..3`, `--bay`), `--glass`, chrome
(`--chrome`, `--chrome-lo`, `--trim`), steel keys, ivory keys, title-strip
paper, and the lamps `--amber`, `--tungsten`, `--phosphor` (text on dark),
`--label` (engraved legends, at least 8:1 on the bays) and `--plate`. The
purple `--cab*` tokens now belong to the INSERT COIN cabinet only.

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
button on the screen". The dormant cabinet has no button and no prompt at
all; START / PAUSE is the only gold button on the machine. SELECT is magenta.

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

- At normal laptop/projector sizes, the machine is sized in `rem` and the root
  font follows `min(window width / 64, window height / 36)`. The design canvas is
  **64 x 36 rem** (1280 x 720 at 20 px per rem). Check every change at
  **1280 x 720**. At widths up to 999 px, or a coarse pointer up to 1280 px,
  readable 16 px root text replaces proportional shrinking. The operator
  cabinet becomes two columns, then stacks at 600 px and below; the outer page
  scrolls. Extremely short desktop windows also allow page scrolling. These
  modes preserve the materials and reading order rather than miniaturising
  every control to keep the entire machine on one screen.
- Current album tracks fit together without paging. Contained list scrolling
  handles future albums longer than the available space; the outer cabinet
  remains fixed at the supported laptop/projector sizes.
- Rows: marquee, LED ticker, cabinet, operator deck, key legend.
- Operator columns: tube | **PICK A SONG** | **NOW PLAYING** | **UP NEXT** and
  selector | tube, with content proportions 1.04 : 1.28 : 0.88. The crowd view
  keeps its separate 1 : 1.38 : 0.62 balance and hides the operator controls.
- The marquee sign is centred on the page (wordmark 2.45 rem, subtitle .72 rem,
  both centred inside the sign) with the bulb rows hugging the sign's edges so
  the lettering never sits on a bulb. Its enclosure has a narrow bevel, flush
  fasteners and a dark recessed face. Glass lamps stay fixed in their channels;
  a separately masked light chase passes over them rather than sliding the bulbs.
- The RFAI logo (3.45 rem) has a soft cyan/pink halo behind it. Silent, the halo
  breathes over 4.8 s (opacity and scale only). With music it follows the beat:
  it brightens from 34% to at most 86% and swells, and the logo itself swells
  up to 4.5%, on each kick (`logoGlow` in `dsp.js`, driven from `visualiser.js`;
  the crowd screen does the same from the bass level the control window sends).
  It follows the beat only, never loudness ripples, so it cannot move faster than
  the beat gate allows, and it hands back to the breathing about 2.5 s after the
  music stops. Off in CALM. The logo and the CREDITS / OFFLINE chips
  are each centred in the clear space between an arch leg and the sign, and
  dropped .55 rem so they clear the arch's top bar and curved corners (checked
  at six window sizes: at least 6 px of clear space everywhere). The two chips
  are the same width.
- PICK A SONG uses the full left panel: flexible artwork and album navigation
  above a full-width track list. All seven tracks on the largest current album
  fit together at 1280 x 720, with larger .84 rem titles. The selector sits under
  a shortened UP NEXT area in the wider right column, keeping the record changer
  in the centre. Key rows respond to their available container width; letters
  become a single row only when each key retains usable width. Coarse pointers
  retain five-column key groups with larger targets.
  The readout and CLR / DEL / SELECT / COIN stay together beneath the queue.
- Artwork is content-first (`rack-layout.js`): reserve the natural rendered
  height of every track, navigation and gaps, then choose the larger square
  that fits beside or above the album controls. It measures the actual font
  and title wrapping, updates on album changes, resize and font readiness,
  and rounds down with a two-pixel safety allowance. Artwork shrinks or hides
  before an oversized future album needs contained scrolling. The same rule
  applies to the crowd screen, with its hidden controls excluded from sizing.
- **The panel is tuned for seven songs per album** (the catalogue is complete:
  70 songs, exactly seven on each of the ten albums, so the cover is the same
  size on every album at a given window size and never jumps when albums flip). The track list hugs its rows exactly - no
  dead band under the last strip (at most about 10 px of the list's own padding;
  `.strip:last-child` has no bottom margin) - and the heading above takes every
  remaining pixel. The album controls are stacked: the album name on top, then
  two chunky arrow keys that stretch to fill the height (at least 1.8 rem, at
  most 3.6 rem tall) and the count / song total beneath. Because those controls
  need little width, the cover is limited by height rather than by the controls
  (at 1440 x 900 it grows from 142 px to 203 px). With a cover above the controls
  (taller windows such as 1024 x 768) the controls drop back to one compact row
  (`stackedControlsHeight` in `planRackLayout`). The layout measures the controls'
  minimum size, not their stretched size, so it cannot feed back on itself, and
  the album label keeps its natural height (`align-self:center`) so the crowd
  screen, which hides the arrow keys, still gets its cover. Checked: all ten
  albums at ten window sizes, none scrolls, no row cut off, no overflow.
- Pressing a letter key (or typing it) flips the rack to that album, so the
  operator sees its songs while finishing the code.
- The most important things are the largest: song title (Bungee), the LED clock,
  the UP NEXT titles and the ticker. The strips are reference material for the
  operator; status (NOW / Q2 / OUT OF ORDER) is a small tag clipped onto the
  strip's corner so titles keep the full width. The changer is the hero of
  Now Playing: the title (1.42rem at most, balanced over two lines) and the
  meters (4.6rem at most) give it the height, the sleeve beside it is the
  smaller part, and the paper strips are backlit a step down (#d9cdb0 to
  #c3b591) so they no longer out-shine it. House rows in UP NEXT are a step
  tighter than requests, so a preview still fits under two picks. Now Playing
  reserves a stable two-line title area, fits against its measured width and keeps its metadata,
  clocks and progress in fixed rows. Track/album changes receive one live
  announcement; advancing clocks are not live regions. Meters reserve 48 px
  minimum, or 40 px in short landscape mode. Header space and the decorative
  changer give way before useful meter space does.
- Album tracks are one continuous list, with no MORE button or hidden groups.
  Ordinary contained scrolling accommodates future albums larger than the rack.
  A newly typed complete code reveals its row within this list and outlines it
  in cyan, without scrolling the surrounding cabinet. The current ten albums
  need no scrolling at the supported laptop sizes. The crowd screen keeps a
  complete list and uses the queue's full column because its selector is hidden.
- Transport, music/effects faders, SHUFFLE, CROWD SCREEN and LIGHTS remain on the
  deck. TOOLS groups FULLSCREEN, LOAD THE CRATES, KEYBOARD SHORTCUTS, the Vinyl
  texture trim and optional click-to-fill. Faders display their percentages. The native
  disclosure supports mouse, Enter and Space, closes on Escape or an outside
  click, and never submits a pending song code or changes playback. Offline
  status and errors stay visible at the top of the cabinet. Offline status is
  also a button that opens Tools and focuses LOAD THE CRATES, without starting
  a download. Persistent FREE PLAY text reassures operators that coins are
  decorative.
- UP NEXT keeps the note **Your picks play first. / We'll keep the records
  turning.** Requests have a YOUR PICKS heading and cyan position chips. House
  suggestions remain under IF NOBODY PICKS, with full-opacity pale-lilac titles
  and clear cyan metadata. Both stay readable over the recessed near-black
  window; decorative scanlines are subdued there. All 30 possible explicit
  requests render in the contained scroll area, with their total and a cue when
  more remain below. House suggestions are a separate short preview and are
  trimmed first. Request rows are keyed by track identity; reordering preserves
  focus and scroll, and cancellation focuses the nearest surviving action or
  the queue. Queue actions have at least 32 x 28 px fine-pointer targets,
  growing to 40 px for coarse pointers. Desktop actions sit side by side to
  protect queue height.
- SELECT keeps a deep magenta face, white lettering and its brighter edge, so
  the identity survives at smaller text sizes with readable contrast. Letter
  keys use a dark layer over the real covers for consistent label contrast.
  CLR and DEL retain their hardware labels with full accessible names.
- The ticker sits in a named landmark. Keep decorative jokes secondary to
  selection and playback; narrow/short layouts reclaim sign height and gutters.

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
  (4.6 s before music-reactive rate adjustment), neon flicker dips only to 80% so a word never looks switched off.
- Framed: trivia's CRT bezel at .7 rem with four corner fasteners and an inner
  shadow, with the machine inset from it, so the page reads as a cabinet screen.
- Start-up order: INSERT COIN first, then the boot, then the jukebox. The idea:
  **a tiny coin starts an enormous machine.** The INSERT COIN screen is the
  jukebox's own cabinet (chrome arch with bulbs, bubble tubes, a neon sign, a
  picture tube, a brushed-steel coin door) standing in a dark basement, too big
  for the frame, barely alive. Everything inside `.cab` is in cabinet em (1/100
  of its width), so it keeps its proportions anywhere.
  - **The darkest moment comes first: the machine that waits.** Before anyone
    touches it the room is nearly black and the cabinet is lit by one
    practical source: its starved picture tube (picture at .5, colour kept at
    .8 so the robot on it is still cyan and magenta). On it, small, with dark
    all round it, the RFAI robot as the tube would draw it - not the logo
    pasted on, but its own pixels turned into phosphor light by
    `drawPhosphor` (`startup.js`): the frame and coin tab dropped, the neon
    lines kept, the cream face held right down, smeared a little along the
    scan lines, red and blue a fraction out of register, a faint ghost to the
    right, and a soft bloom behind. It fades up over 2.4 s as the tube warms.
    Then it breathes (`planBreath` in `lights.js`, one looping plan of nine
    4.2-6.8 s breaths): it gathers, holds, relaxes, never vanishes; now and
    then it falters on the way up or is slow to come back, and now and then a
    soft band rolls down the tube and the picture slips sideways as it passes
    the face. The static (.1, fine and mostly dark - a weak signal, not snow)
    thins as the robot brightens and thickens as it fades, and the tube's
    light on the cabinet (`.cab-spill`, masked off the tube's own face) swells
    and sinks with it: one signal, not separate effects. All of it is
    opacity and transform on a handful of layers, so it runs on the
    compositor for as long as the machine waits. Reduced motion or calm
    lights: the robot glows, still. No sign, no printing, no bulbs, no lamp:
    the slot lamp reveals the door's markings at the touch, the sign joins the
    supply at the relay (`.is-powered`), and the lit logo takes over from the
    phosphor robot only once the relay has collapsed the picture
    (`.is-tube-lit`, relay + 100 ms), so the two are never on together; the
    robot breathes on through the coin until then.
    The sound of it waiting (`drone.js`): a low drone on 50 Hz - the mains
    the film's transformer hums on, so its harmonics are the same machine -
    from detuned saws through a resonant low-pass, a ghost of the 6th and
    7th harmonics in a dark echo, a distant flyback whine and a little hiss.
    It breathes on the robot's own plan (`breathLevelAt` at the screen's
    phase, re-read every second, the sound a fifth of a second behind the
    light): brighter robot, more harmonics through the filter, less hiss;
    a falter sags its pitch and ticks a contact; a rolling band sweeps the
    hiss. Measured dormant: about -29 LUFS, 15 dB under the lit machine.
    The operator arms it before the night (Alt+Shift+D, remembered); unarmed
    the dormant screen is silent and the touch wakes it quietly. At the
    press it stirs and steps back for the coin, drops out with standby at
    the relay, its ghost rides the first attempt and dies with it by fail +
    350 ms: the dark and the second attempt are the film's alone
    (`AFTER_PRESS`, `tests/drone.test.js`).
    The fault in the machine (`startup-fault.js`): one bad contact behind
    the left side panel, low on the seam (about y 90 em - the reference
    frames end at 100 em). A tiny crooked filament (three hand-drawn
    shapes, `.fault-arc`) is clipped at the cabinet's silhouette, so only
    what escapes the housing shows; a little cool light (`.fault-light`)
    catches the lacquer rim and the chrome beside it. Dark at rest, opacity
    only, no fill. Dormant: one contact every 20-45 s (sometimes up to
    65 s, never at load) on the robot's falters or recoveries, one timer at
    a time, quiet in a hidden tab and stopped at the press. The film: four,
    on the beats and gated by `supplyAt` - attempt + 440, almost + 210,
    catch + 130, catch + 1460 - none in the coin, the dead interval, the
    tick, or from ignition on. With the supply's swings they keep every
    second to three flashes or fewer, over a lit area under a quarter of a
    WCAG flash area (`tests/fault.test.js`, `tests/safety.test.js`). None
    with reduced motion or calm lights. The tube's light falls off
    fast across the bezel, the nearest chrome and the top of the door; the
    lacquer (.06), the arch (.035), the cold bulbs, the dark neon glass and
    the coin door (.04) are only just there. No prompt, no blinking text, no
    lit button: the whole screen is the button (keyboard, mouse and touch; the
    accessible name still says what it does), and people discover it by
    trying. The touch wakes the slot lamp - it stutters and catches - and its
    light is what first shows the coin door and the coin. The credit counter
    is an unlit window ("0 CREDITS") until it flips to a lit 1 CREDIT.
    Measured at 1280x720 (0-255): whole frame ~3 on average, lacquer 2-5,
    bezel 7, empty tube 12-15, robot 27-45 as it breathes - the opening
    carries the dynamic range, the ignition is no brighter than before.
  - **One supply.** `SUPPLY` in `startup-timing.js` is the voltage (`STANDBY`
    = 0.2, a trickle). The sign, the tube's picture and static, the lacquer,
    the door, the chrome's reflections, the tube's light on the cabinet, the
    room's light and the transformer hum all follow it through their own
    responses (`RESPONSE` in `startup-power.js`), so a sag dims them together
    and the hum sags with them. From 0.4 up every response is exactly what it
    was; below it the lacquer, chrome, coin door and static fall into a toe
    (`toe()`), so standby lights nothing but the tube and the dead moments of
    the film are at least as dark as the opening. The tube's own curve below
    0.4 is only ever seen on standby (the raster is a dead line from the relay
    until the supply is past it), so there it keeps its colour. The CSS
    dormant look IS the response at `STANDBY` (`tests/startup.test.js` holds
    the two together, that nothing changed from 0.4 up, and that the coin
    lamp and bubble tubes are dark on standby).
  - **One clock.** The whole film is scheduled at the press on the document
    timeline (WAAPI animations with delays; steps fire from zero-length timer
    animations), from `BEATS`. Nothing chains timers, so nothing drifts; and a
    paused, seeked film shows any exact frame.
  The film (~14.5 s, `startup.js`, `startup-coin.js`, `startup-power.js`) is
  cut like a scene - discovery, contact, the machine's response, a failed
  first try, silence, a second try, the awakening, a held hero shot, then the
  dive. Slow where the audience should look, sudden where something heavy
  moves, and still where nothing should happen. Every time is a `BEATS` entry;
  `tests/startup.test.js` holds the story (a first try that nearly reaches
  running, at least half a second of real dark, a steady lit hold of 1.5 s+).
  1. the coin (0-3.85 s, `lift`, `contact`): the camera pushes in on the coin
     entry; a struck, worn 3D coin (two faces, reeded edge of stacked discs,
     moving specular band) swings in from the right close to the lens, out of
     focus and robot side out, turns through edge-on to the 25 and hangs there
     for about a second, breathing, while the rim turns into the light; then it
     sinks toward the door - shrinking as it recedes, its shadow tightening on
     the entry's top, the slot lamp warming its lower edge. It catches on the
     slit and is pressed against it for half a second - it wobbles, the gate
     pushes back, a gritty scrape and a straining spring - then the gate gives
     and gravity takes it. The entry clips everything below the slit, so it
     really goes IN;
  2. the chute (`chute`): seven clinks going deeper, each jolting the entry
     less; the coin box clunks and 1 CREDIT flips over like a counter while
     the camera pulls back to reveal the whole machine;
  3. the relay (5.45 s, `relay`, `power`): THUNK - the cabinet jolts, the sign
     rattles on its brackets a beat later, dust shakes off the arch, and the
     standby supply drops out: dark;
  4. A, the first attempt (5.95-7.9 s): the transformer gathers itself (a low
     rising growl under the hum); a dot of light creeps out into a line across
     the tube; one neon letter weakly catches; the sign half-lights; for a
     moment (7.1 s) it nearly holds - then it stumbles and dies: the line
     shrinks to a dot, the letter goes out, the hum winds down, and the
     cabinet settles on its feet;
  5. the dark (7.9-8.75 s): nothing on the supply, no static on the tube, no
     lamp at the slit. One small tick somewhere inside (8.25 s). The camera
     leans in very slightly, waiting;
  6. B, it catches (8.75 s): a deeper, heavier relay and a longer shudder; the
     line snaps across the tube, the degauss thumps as the raster opens out of
     it and rolls to lock, colour swimming and splitting red/cyan as the
     voltage struggles; the letters strike one, then another, then quicker
     (two struggle), the bubble tubes warm;
  7. C, ignition (11.05 s): the supply locks with a relay and a bright accent;
     the dead tubes catch, bulbs climb the arch from both feet to the crown
     over 0.9 s, the logo lights, gold blooms round the coin door, light
     glints across glass and chrome, and the machine's own light reveals its
     lacquer, the wall behind and the floor;
  8. the hero hold (11.05-13.35 s): the machine simply stands there, lit, on a
     steady deep hum; the camera drifts closer and a second, slower glint
     travels the chrome;
  9. D, the handoff (13.35 s, `collapse`): the tube surges and tears, the
     camera dives into it, it washes out, and the clipped view squeezes to the
     line the boot screen's first strike opens from (`bootLine` in `fx.js`
     measures that line, and the boot keeps the self-test it was measured
     with); the line fades as the boot's line comes up (`.is-handing`, 200 ms).
  Clean rendering rules the film depends on:
  - everything on the tube is clipped to its curved face with `clip-path`
    (`.tv`, `.tv-glass`), not just `overflow` + `border-radius`, which lets
    animated layers out as rectangles in WebKit;
  - the coin's faces are `clip-path` discs with no blend modes inside the 3D
    coin, and the faces also swap visibility at the instant the coin is
    edge-on, so a flattening engine never paints the wrong side or the edge
    stack over the face;
  - the static is drawn plainly (light specks), never screen-blended, and
    follows the supply, so a dead tube shows no snow;
  - while the raster is only a line the picture is not drawn at all (the
    `.tv-line` carries it): a filtered layer squashed to nothing draws as a
    hard black box on the GPU;
  - long multi-step WAAPI animations ease each step, never the whole
    animation (an eased whole bends every beat out of place).
  Input is held for the whole film. If the boot already ran in this tab, the
  film plays to D and fades straight to the jukebox. With
  `prefers-reduced-motion` the same story is told without travel, shake or
  flicker: the coin appears at the slit and is taken, the cabinet fades up,
  and the screen crossfades into the boot.
- Boot: a short calibration, not a second struggle - the film already told
  that. An unskippable 6.5 s hold with the self-test printing across 5 s, one
  steady strike (no flicker dips), then a 640 ms reveal with only a faint
  phosphor bloom (10 s recovery cap, 11 s CSS failsafe). It is drawn inside the
  same tube: a faint phosphor face and dark, curved glass corners. The ignition stays
  the brightest moment of the arrival; the dive into the tube is held below it. Header line: SKATE BY FAITH JUKEBOX. Keyboard and pointer input
  cannot reach controls behind the arrival. CALM holds the same duration with
  static diagnostics. A completed arrival is remembered once per tab; reloading
  during warm-up starts the full sequence again.
- VU meters: landscape windows; the scale and the needle's pivot are computed
  from the smaller side so nothing is ever cut off.

- Selection requires a confirmed code (keypad or keyboard). The title strips
  are read-only paper by default, as on a real Wurlitzer/Seeburg. The optional
  **Click a song to fill its code** setting in Tools makes strips focusable
  buttons for prefilling only; clicking or Enter/Space fills the code and
  focuses SELECT. It never adds a request by itself. The choice defaults off
  and is saved as `sn-quick-pick`. Rack arrows and letter keys continue to browse.
  Contextual guidance follows letter, number and confirmation, names the
  resolved song, and reports whether an accepted request starts or its position.

Before adding anything new, ask what it replaces.

## Crowd screen (two windows)

The **CROWD SCREEN ↗** button opens `index.html?view=crowd` (`crowd.js`) for the
projector, with the laptop showing the full control window. The crowd screen:
- plays **no sound** and hides operator controls (deck, selector, queue buttons,
  status chips and key legend); its tab reads THE RACK, and the rack fills the
  column, with flexible artwork and larger strips following the control window's
  album. The seven tracks in the largest current album remain visible at the
  tested sizes; the artwork uses the remaining space. This is a passive display,
  so its composition must be rechecked if future albums gain many more tracks;
- mirrors everything the room should see over a `BroadcastChannel` (`link.js`):
  state (playing, UP NEXT and the house plan, rack page), every record-changer
  move, SELECTION ACCEPTED, the song clock (about 4 times a second) and the
  meter levels (30 a second, only once a crowd screen has said hello);
- catches up when opened mid-song (a `snapshot` reply to its `hello`: the
  record is shown already playing);
- follows the LIGHTS setting (shared `localStorage`, `storage` event);
- runs its own ticker jokes, bubble tubes, arch and (silent) screen flicker;
- gives a dismissible setup hint to move it to the projector and click for
  fullscreen; it goes fullscreen on a click or F and hides the pointer when
  fullscreen;
- tracks the operator heartbeat. After 30 seconds without contact it shows a
  connection warning, then clears it automatically when contact resumes. The
  operator window announces the crowd connection state beside its button.
If the control window is minimised the browser pauses its drawing, so the
crowd screen's meters freeze until it is shown again.

## Motion

Port of trivia's effects, then the jukebox mechanics on top.

**Ported from trivia:** CRT power-on boot with a random self-test (`startBoot`),
neon flicker with a random pattern/speed/phase per tube (`neon.js`), the synth
horizon (grid, stars, glow line), CRT glass roll band, chasing marquee
bulbs, score-reel count-ups (`countUp`, used for
the credits counter).

**Record mechanism** (`mechanism.js`) - on selection, one scheduled timeline of
Web Animations (compositor only):

| t (normal speed) | What happens |
|---|---|
| 0 - 0.47 s | The volume's **sleeve slides out of the rack** to the mechanism window (FLIP from the big rack sleeve if that album is showing, otherwise from its letter key) while the **record carousel turns** clockwise to the chrome gripper at 9 o'clock. The index motor slows for its final approach; the gripper engages before pickup. Whirr. |
| 0.47 - 0.81 s | The **record lifts out of the ring**, turning from edge-on to face-up while travelling towards the spindle. Its slot in the ring stays empty while it plays. |
| 0.81 - 1.0 s | The record **settles onto the spindle** and starts **spinning at 45 rpm** (1⅓ s per turn) with the cover as its label. The gripper releases. |
| 1.0 - 1.5 s | The **tonearm swings** across after the record settles; **needle-drop thud** at 1.5 s. |

At the end of a song the same moves run in reverse (1.0 s): arm lifts, record
lifts before turning edge-on, the gripper catches it into its slot in the ring,
and the sleeve returns to the rack. The mechanical window retains the small
**PRECISION RECORD CHANGER** and **45 RPM · STEREO** labels.

The changer has a satin-black sleeve cradle and a separate mechanical mounting
plate behind the glass. Its platter uses a ribbed rubber mat, machined rim,
raised hub and spindle. The tonearm has a fixed bearing mount, counterweight,
metal shaft, separate cartridge and visible stylus. In the parked position
(-5°), the cartridge rests outside the magazine; the playing arc remains 17–30°.

All fixed hardware shares an unscaled 10 em coordinate space. The 8.9 em magazine
and 7.3 em platter are concentric at (5 em, 5 em), and the assembly sizes to the
actual window with container units. Deliberate clearance keeps the magazine,
gripper and full tonearm sweep inside the case. Do not restore the former
8.9 em ring in an 8.8 em case, or use clipping to conceal a clearance failure.
Only the sleeve intentionally travels outside the window during transfer.

Pickup/return offsets come from the measured gripper and platter centres. Lift
height scales with platter radius, so the record meets the picker and spindle
at every supported size. Avoid scale transforms on the assembly: animation
translations use measured CSS pixels. Audio scheduling remains independent.

**Record carousel** (`carousel.js`): every song's record stands on edge in a
ring round the platter, seen from above (like looking down into a Wurlitzer),
each with a bold band of its album's sleeve colour, in `tracks.js` order. Recessed
cradles, bevelled black vinyl edges, indexing marks and restrained cyan/magenta
inlays give the magazine depth while retaining those colours. One canvas,
painted once; turning it is a CSS rotation, always clockwise, at least 45°
(`carouselTarget`, tested). Clipped to a circle so the turning square canvas
never pokes out.

**Cabinet details:**
- **Arch** (`arch.js`): a glass tube rises out of each side bubble tube, beside
  the ticker, and arches over the top behind the marquee sign. One SVG path
  measured from the real tube positions, redrawn on resize; follows the tubes'
  colour (`--tube-col`) with a few drifting bubbles (`arch-bubbles`, 14 s).
- **Latching keys**: the selector letter (and its digits) stay pushed in and
  lit cyan until the code is selected or cleared, like mechanical selector
  buttons.
- **SELECTION J3 ACCEPTED**: the marquee sign shows each accepted pick and its
  title for 2.2 s, then hands back to the wordmark.
- **Page flip**: the rack's album page flips over on its hinge (0.7 s, direction
  follows album order) with a clack (`sfx.page`). During the song the
tonearm creeps toward the middle of the record with progress.

For a natural song change the changer **pre-rolls**: the eject starts 2.5 s
before the end, the next record loads 1.5 s before the end, so the needle lands
as the song ends. The last 1.2 s of every song fades out (`TAIL_FADE_SEC`), which
hides the swap. Measured gap between songs: about 40 ms. On a skip the changer
runs 1.8x faster (about 1.4 s).

**Audio-reactive** (`visualiser.js`, one shared `requestAnimationFrame` loop,
capped at 30 fps): neon spectrum bars with peak caps (36 bars, log-spaced up to 15 kHz - MP3s carry almost nothing above that, so no bar sits dead), twin needle VU meters,
bubble tubes that speed up with the music, grid scroll speed and bulb chase speed
(`playbackRate` of the CSS animations), a bass swell across the monitor glass,
and the logo halo. **Beat detection** listens to the bass only: the music runs
through a 140 Hz low-pass into its own analyser (`audio.js: beatAnalyser`) and
`createBeatDetector` (`dsp.js`) calls a beat when that bass level jumps 15%
above its own 0.4 s average (volume slider divided out, small floor for
silence). Tuned on the real songs at about one beat per kick, 1.2 - 1.8 a second.
The earlier detector read the full spectrum, which loud masters keep near its
ceiling, so it never fired on these songs and the bass swell sat still.
The screen glow sits above the opaque cabinet, below the CRT glass and bezel:
broad cyan/magenta edge blooms and a faint full-screen sheen answer the same
smoothed beat. The previous central glow sat behind the panels and was barely
visible. Only the glow layer's opacity changes; controls, sleeves and text stay
in place. Silence fades back to its resting glow; CALM and hidden tabs reset
it immediately, including the pulse envelope.

**Ambient:** a few faint mirror-ball light spots drifting *behind* the cabinet (CSS
transform only), the LED ticker rolling **one skate joke at a time** (each
line crosses fully and leaves before the next enters; song changes never cut a
line short, except music starting from silence, which swaps a "music stopped"
joke for a skate joke), bubble tubes colour-cycling over 48 s. The song name lives in the
NOW PLAYING panel, not the ticker.

**Idle attract mode:** after 60 s with no input the machine runs a light show:
bulbs chase faster, the rack turns to the next album every 9 s
(`ATTRACT_PAGE_MS`; every album change slides in over 0.65 s, none in CALM)
(and shows each cover in the changer window while nothing is playing). Any
input ends it.

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
  0.14 and 0.70, with translucent gradients (at most 32% alpha per gradient),
  never an on/off flash. The visualiser lifecycle and DSP are unit-tested. The beat itself
  comes from the bass-only detector (about 1.2 - 1.8 beats a second on the real
  songs, hard-capped at 3 by the gate). The logo halo is a small area (about 110 px
  across) that follows the beat only: measured on real songs, 1.4 clean swells a
  second, at least 372 ms apart.
- Neon flicker dips only to about half brightness, a burst holds at most two
  dips, on a few words of signage only.
- The boot sequence was changed from trivia's: the screen flicker now has dips at
  least 0.45 s apart, and the logo power-on flicker is spread over 1.4 s. The
  single white boot flash happens once, at 85 % strength.
- The record's sheen is a low-contrast highlight rotating at 1.1 passes a second
  over a small area.

Audit list - every `@keyframes` in `styles.css`, `jukebox.css` and `changer.css` and its rate:
`crt-roll` 11 s (one band, whole screen), `spot-drift` 45-95 s, `logo-breathe` 4.8 s, `bulb-chase`
4.6 s / 1.6 s in attract (light passing over fixed lamps), `neon-flicker-a/b/c` 7-14 s with 1-2 dips,
`ball-turn` 9 s, `record-spin` 1.333333 s (45 rpm), `dot-pulse` 1.2 s (small LED),
`coin-drop` once, `score-pop` once, boot sequence once per tab. Dormant cabinet: `lamp-breathe` 2.8 s (the slot lamp, dark until the touch), `grain-jump` 1 s (low-contrast grain moving, not a flash), `mote-drift` 14-28 s (dimmed until the touch), `attract-roll` 6.5 s once the relay has the picture, `bubbles-rise` 2.6 s once lit; the robot's breath (a WAAPI loop from `planBreath`: level never moves more than a quarter of its range in a quarter second, at most two flashes in any second, checked in `tests/safety.test.js`) and the power-up's supply are JavaScript (see above). The supply never swings by 10% or more than four times in any second (two flashes), checked in `tests/safety.test.js`; the surge into the line is one brightening, then the bright area shrinks.
Screen flicker (JavaScript, not CSS): at most 2 dips per burst, a burst under
1 s, bursts at least 25 s apart, never more than 60% darker - so never more
than 2 flashes in any second. The burst plays across a blurred 4x3 grid of
patches that ripple out from a random spot (under 180 ms) at their own depths;
patches only lag or lighten the burst, never add dips. `tests/safety.test.js`
checks 500 random bursts, patch by patch.

### Calm lights (dormant)

- The lights are always FULL. The on-screen **LIGHTS: FULL / CALM** switch was
  removed, and the OS `prefers-reduced-motion` setting is no longer followed.
  The CALM paths below are still in the code (and tested through
  `fx.js: followLights`), but nothing on the page turns them on.
- **Motion off, finished state shown** - not "motion lite" (trivia's rule).
- CSS: `html[data-lights="calm"]` switches every animation and transition off.
  JavaScript effects ask `isCalm()` and jump to the finished picture:
  the changer shows the record already on the platter, the ticker holds still
  text (swapped every 8 s), the visualisers draw one quiet still frame, and
  the mirror-light spots hold still. The boot retains its full arrival duration
  with static diagnostics.
- Every animation has a calm equivalent; a new animation must add both halves.
- Functional readouts (the clock, the progress tube, the queue) still update in
  CALM - they are information, not decoration.

### Errors never stop the music

- Audio is started on plain timers (`setTimeout`) and the audio element's own
  `ended` event. It never awaits an animation promise.
- Every effect is wrapped in `safely()`; a failing draw switches itself off with
  a console warning.
- A missing or unreadable MP3 becomes **OUT OF ORDER**, is dropped from the
  queue and skipped by the house rotation. A typo in `tracks.js` shows a red
  CHECK TRACKS.JS button with a plain-English list instead of crashing. Its
  native modal dialog makes the background inert, blocks cabinet shortcuts,
  closes with Close or Escape, and restores focus to the warning button.
- A start-up failure shows "START-UP PROBLEM - PRESS F5" on the dormant
  cabinet's picture tube (`.attract-fault`, the only words it ever shows
  before the coin) rather than a dead page.

## Playback controls: shuffle, skip, back

- **Shuffle** (`rotation.js: pickShuffle`) is a shuffled deck: every playable song
  plays once before any repeats, the last-5 rule still holds when the deck is
  reshuffled, and songs picked from the queue count as played. Shuffle off uses
  `pickInOrder`: the order of `tracks.js`, wrapping round. Every load starts with
  shuffle on; turning it off lasts until the page is reloaded.
- **House plan** (`app.js: planHouse`): the house rotation picks ahead, enough
  to fill UP NEXT's spare rows, and keeps those picks, so the labelled rows under
  IF NOBODY PICKS are exactly what will play. Songs in the queue are left out of
  the plan; a song someone picks drops out of it once it plays (in order mode
  carries on from that song instead). House rows that would not fit on screen
  are trimmed from the end.
- **Skip** takes the queue head or the house pick. **Back** keeps a 50-song
  history: after 3 s it restarts the song, before that it goes to the previous
  song and puts the song it left at the top of UP NEXT (`enqueueFront`), so Skip
  returns to it. Both are ignored while the record changer is mid-swap.
- Shortcuts: Left / P back, Right / N next, S shuffle, F fullscreen, Space play /
  pause. These letters (F N P S) are therefore never used as volume letters. The
  laptop's previous-track media key is wired to Back.
- `keyboard.js` routes shortcuts after native control behavior: focused buttons,
  links and disclosures keep Enter/Space even when a song code is pending.
  Focused album/queue areas retain scrolling arrows, sliders/editing controls
  retain their keys, and open modal dialogs block all cabinet shortcuts.
  Left/Right inside `.rack-panel` browse albums; transport and volume arrows
  operate from the background. Handled events and Ctrl/Meta/Alt combinations
  are left alone. No global keyup handler cancels native Space activation.

## Sound

Two separate volume paths: music and effects (`audio.js`). Both pass through a
gentle limiter. Seven small **original physically modelled WAVs** are supplied;
they are not field recordings and contain no third-party samples.
`scripts/generate-sfx.py` reproduces them with Python's standard library.

A custom `sfx/<name>.mp3` takes priority over the supplied WAV. A missing or
undecodable file falls back to that WAV, then a quiet live Web Audio model.
Files are fetched early and decoded after the first click. The original motor
uses brush friction, light gear texture and subdued engagement/settling contacts.
Short moves crossfade its body into the authored ending at constant pitch;
custom long `whirr` recordings fade to fit. Missing optional MP3s may show harmless 404s.
Effects remain **off until a person clicks** INSERT COIN, which now comes before
the arrival, so the coin and the power-up are heard and the boot follows in
silence. The start-up sounds (`lift`, `contact`, `chute`, `relay`, `power`,
`tube`, `collapse`) are live Web Audio models timed from `BEATS`; an MP3 of the
same name in `sfx/` replaces any of them. `lift` plays at the press; the rest
give a custom MP3 up to 0.4 s to decode.
Audio failures must never stop the music.

| Effect | The one moment it belongs to |
|---|---|
| `coin` | A coin rattles down the metal chute and lands |
| `key` | A keypad switch makes dry contact |
| `confirm` | A song is accepted with a selection-relay latch |
| `whirr` | The record mechanism and carousel motor move |
| `page` | The rack's paper carrier releases and catches |
| `thud` | The needle lands gently on the record |
| `buzz` | A muted solenoid refuses a selection |
| `lift` | The coin taken up and swung into the light; its rim rings faintly as it turns |
| `contact` | Its edge meeting the slit: a tick and a gritty scrape, the slip, the gate snapping back |
| `chute` | Clinks going deeper into the cabinet (`CHUTE_CLINKS_MS`), the coin box, the counter ticking over |
| `relay` | The main relay pulling in: contacts, armature, a deep THUNK and the cabinet booming once |
| `power` | Relay to line: transformer hum following `SUPPLY` (upper partials opening with the voltage), the first attempt dying, a second relay, degauss, crackle where it struggles, flyback whine, the lock with a bright accent |
| `tube` | One neon letter striking: a mains buzz and the electrode tick |
| `collapse` | The surge and the dive: the whine climbing, a falling zip as it squeezes to a line, a thunk |
| `flicker` | Silent compatibility hook unless a custom MP3 is supplied |

The original WAV pack is precached with the app shell. Effects sit below the
music, with the needle landing and motor quieter than the coin and switches.
Per-effect gain trims balance frequent keys and movement against coin/relay
accents. Coin, key and page cues have less than 2% pitch variation. Repeating an
action responds immediately and fades its previous tail over 14 ms, so motors
and rapid key presses do not accumulate. Finished sources release their audio
nodes. Cancelling a mechanism sequence settles its promise and releases the
motor; stale swaps cannot reload a record after reset. Movement completion uses
the published duration so the next load and needle cue stay aligned with the
independent audio timer.

`vinyl.js` adds a clearly audible record surface: band-limited hiss that swells
gently once per 45 rpm turn, warm dust crackle in small clusters, a single pop
every few seconds, and a 320 ms needle drop (contact click, felt thump, groove
scrape and lead-in dust). It is original procedural audio, with no external
samples or mains hum. A shared per-context buffer avoids per-track synthesis;
the ten-turn surface loop starts at a random point and its seam is crossfaded.
The hiss measures about -45 dBFS RMS with pops near -19 dBFS peak, before the
EFFECTS and Vinyl texture faders: heard plainly in quiet passages and the
change gap, tucked under loud music. (The first version sat near -71 dBFS after
the faders and could not be heard.)

Vinyl voices sit on their own record bus straight into the limiter, outside the
deck fades, the MUSIC fader and the analysers. Each voice's gain is EFFECTS x
Vinyl texture (squared, like every fader). So a song's closing fade leaves the
crackle playing - the run-out groove - and the light show never reacts to a
pop. The Tools-only Vinyl texture trim is remembered locally; 0% removes only
the vinyl. When a song starts, `player.start(..., { leadInMs: 1000 })` drops the
needle and lets the lead-in groove crackle for one second before `play()`; with
vinyl muted there is no lead-in. Pause during the lead-in holds the song (resume
drops the needle again); skip, a newer song or a media error cancels it. Actual
media `playing` events otherwise start the surface; pause, waiting, ended,
error and emptied release it. Resume and buffering recovery restart the surface
without another scrape. BACK to the start replays the scrape. All voices fade
out and disconnect, and synthesis failure leaves music playing. The service
worker precaches `vinyl.js` for offline use.
Compare final levels through the venue speakers. See `sfx/README.md` for source,
lengths and replacement instructions.

Do not reuse one effect for another moment, and do not add an effect without a
one-sentence reason a skater would recognise.

## Content tone

Warm, wholesome, playful, church-family friendly - written for a teenage church
night: daft and funny, never at anyone's expense, with light, respectful Bible
nods (Peter on the water, Jericho's seven laps). **Rotating copy is the rule**
(trivia's pattern): every line a person sees all night is held in a big pool in
`copy.js` and dealt like a shuffled deck (`createRotator`) so nothing repeats
until every line has been used, and the same line never appears twice in a row.
Callers pick once and hold the line so nothing flickers.

Pools: boot self-test (`BOOT_POOL`, 30 lines), ticker skate, church and general
jokes while music plays (`SKATE_JOKES`, 234; every line runs before any repeat),
ticker jokes while the music is stopped or paused (`IDLE_JOKES`, 40), attract lines (14),
out-of-order messages (12). `tests/copy.test.js`
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
| `cabinet.js` | Native TOOLS disclosure, keyboard activation, dismissal and shortcut help |
| `keyboard.js` | Cabinet shortcuts that respect native controls, scroll areas and modal dialogs |
| `styles.css` | Fonts, shared tokens and base rules, the INSERT COIN film and the boot screen |
| `jukebox.css` | The running machine: lacquer, chrome and glass tokens, every bay, the deck, crowd screen and small-screen layouts |
| `changer.css` | The record changer's chamber, platter, vinyl and tonearm (loaded before `jukebox.css`) |
| `app.js` | The conductor: state, queue flow, keypad, keyboard, attract, crates |
| `tracks.js` | **The one file Ben edits** |
| `codes.js` | Reads `tracks.js` into the library; generates selection codes |
| `queue.js` | UP NEXT list (pure) |
| `rotation.js` | House rotation: shuffled deck (every song once, never repeat the last 5) or in tracks.js order (pure) |
| `copy.js` | All rotating text pools and the rotator (pure) |
| `format.js` | LED clock formatting, volume curve (pure) |
| `dsp.js` | Spectrum bands, loudness, envelope, beat detector and gate, logo glow (pure) |
| `lights.js` | Screen flicker and the dormant robot's breath, planned (pure) |
| `audio.js` | Shared Web Audio engine, two volume paths, analysers |
| `sound.js` | Original mechanical effects, custom MP3 overrides and quiet fallbacks |
| `drone.js` | The dormant machine's breathing drone and its hand-off to the film |
| `startup-fault.js` | The bad contact behind the side panel: dormant and film sparks |
| `sfx/`, `scripts/generate-sfx.py` | Bundled original WAVs and their reproducible generator |
| `carousel.js` | The record carousel: turn maths (pure) and its drawing |
| `arch.js` | The arched cabinet crown |
| `crowd.js` | The crowd screen (projector window): mirrors the control window |
| `link.js` | BroadcastChannel between the control window and the crowd screen |
| `player.js` | Two audio decks, fades, gapless-feel, probing |
| `rack-layout.js` | Fits the largest album artwork after reserving every track |
| `mechanism.js` | The record changer animation |
| `visualiser.js` | Shared loop, canvases, mirror light |
| `ui.js` | Rack, strips, queue, keypad, readouts, ticker |
| `fx.js` | Boot sequence, screen flicker, count-up |
| `startup.js` | The INSERT COIN cabinet: building it, the phosphor robot and its breath, the camera, the relays, the handoff, the reduced-motion telling |
| `startup-coin.js` | The coin going in: flight, tumble, catch, slip, chute, credit counter |
| `startup-power.js` | The one supply and every part's response to it; tubes, raster, bulbs, ignition |
| `startup-timing.js` | The film's score: `BEATS`, `CHUTE_CLINKS_MS`, `SUPPLY` (pure, shared with sound.js) |
| `neon.js` | Desynced neon flicker |
| `rink.js` | Wake lock, media session, service worker registration |
| `crates.js` | LOAD THE CRATES, saved-copy lookup |
| `sw.js` | Service worker (app shell + covers only) |
| `tests/` | `node --test` suites for every pure module |
| `scripts/check-ui.py` | Optional Python Playwright browser regressions; no application dependencies |
| `scripts/check-animations.mjs` | Optional motion checks in a real browser (`npm run test:motion`); asserts motion invariants, not tunings |

# UI review and responsive album artwork

Reviewed 19 October 2026, using the current 61-song catalogue, Chromium, source
inspection, manual interaction checks and automated accessibility checks.

The implementation pass is complete. The three-column cabinet remains the
standard laptop view, with the full album list, mechanical centre and
queue/selector column. The original review is retained below as the record of
the problems found and the choices considered; the status in this section
describes the current application.

## Implementation status

| Review item | Completed behavior |
|---|---|
| Flexible artwork and complete album lists | Content-first sizing reserves every track before growing the sleeve beside or above navigation. No More pages. |
| Focused controls and shortcuts | Native buttons, sliders, scroll areas and modal dialogs retain their keyboard behavior; rack arrows browse the actual rack. |
| Complete request management | All 30 accepted requests render in the operator's contained queue with a total and scroll continuation. Keyed rows preserve focus and scroll during edits. |
| Diagnostic dialog | Native modal dialog provides an inert background, keyboard containment, Close/Space/Escape and restored warning-button focus. |
| Narrow and touch layouts | Readable 16 px root text, two columns then a stacked cabinet, outer page scrolling, and larger touch targets. The crowd view prioritises Now Playing. |
| Title, clocks and meters | Actual-width title fitting, stable two-line title/meta area, useful meter minimums and a changer that grows into spare space. |
| Selection clarity | Letter/number/confirmation hints, resolved-song preview and explicit starting/queue-position feedback. |
| Optional quick pick | Tools can enable click/keyboard prefill. SELECT or Enter still confirms; code-only entry remains the default. |
| Accessible names and status | Clear/Delete labels, strip NOW/queue descriptions and once-per-track announcements; updating clocks stay outside live announcements. |
| Small control contrast | Deep-magenta SELECT face retains the bright action identity with readable white text; letter keys have a stable dark backing. |
| Queue buttons | Larger usable actions, side by side for precise pointers and stacked larger targets for touch. |
| Fader values and vinyl | Visible percentages and an independently saved Vinyl texture trim in Tools; Effects remains the cabinet/texture master. |
| Offline readiness | The status button opens Tools at Load the Crates, with no download until that action is pressed. |
| Free play | Persistent reassurance beside numeric credits, retaining the coin animation. |
| Projector workflow | Clear Crowd Screen button, connection status, temporary move/fullscreen guidance, dismissal and heartbeat-based recovery. |
| Ticker semantics | Announcements occupy a named landmark. |
| Regression coverage | Node unit tests plus a reusable real-app Playwright script for keyboard, queue, settings, responsive layout and modal behavior. |

The chosen layout is the reviewed three-column desktop composition plus a
readable narrow variant. Moving the selector above the queue, beneath the album,
or into a full-width rail were mutually exclusive alternatives; they were not
combined. Wide selector containers can use one letter row without moving panels.

Validation commands:

```sh
npm test
python3 scripts/check-ui.py --base-url http://127.0.0.1:8080 --chromium /usr/bin/chromium
```

The browser script uses Python Playwright and an already running local static
server. These are optional development tools, not application dependencies.

## Implemented: artwork uses the space left by the tracks

The cover is no longer fixed at four rem. The layout reserves the natural height
of every track, including wrapped titles, plus album navigation and spacing. It
then chooses the larger square that fits either beside the album controls or
above them. Tracks and navigation keep their existing text sizes. Artwork grows
when the window or album leaves more room, and shrinks first when space is tight.

Sizing updates when albums change, the window changes, rows change size or fonts
finish loading. Album changes are measured before their next paint, including
when the operator window is behind the crowd window. The crowd view uses the same
rule, excluding its hidden controls. No pagination or More button returns.

Measurements from the artwork-only pass, before the subsequent space refinements,
for Vol. I, the largest current album:

| Window, CSS pixels | Previous fixed cover | Flexible cover | Placement | Visible tracks |
|---|---:|---:|---|---:|
| 1280 × 720 | 80 px | 79.5 px | Beside navigation | 7 / 7 |
| 1366 × 768 | 85 px | 84.5 px | Beside navigation | 7 / 7 |
| 1024 × 768 | 64 px | 199.5 px | Above navigation | 7 / 7 |
| 1440 × 900 | 90 px | 141.5 px | Beside navigation | 7 / 7 |
| 1920 × 1080 | 120 px | 122.5 px | Beside navigation | 7 / 7 |
| 2560 × 1080 | 120 px | 122.5 px | Beside navigation | 7 / 7 |
| 1280 × 600 | 67 px | 64.5 px | Beside navigation | 7 / 7 |
| 800 × 600 | 50 px | 154.5 px | Above navigation | 7 / 7 |
| 768 × 1024 | 48 px | 199 px | Above navigation | 7 / 7 |

The small difference at tightly packed landscape sizes leaves a rounding safety
allowance. Extra width alone does not always enlarge artwork: the full list can
remain the limiting height. Six-song albums can give the cover more space than
seven-song albums in the same window. These are content measurements, rather
than a separate fixed cover size for each device.

The guarantee applies to the current catalogue at the tested sizes. If an
arbitrarily long future album cannot fit even with no artwork, its operator list
remains accessible through contained scrolling. A passive crowd display with a
much larger future album needs its composition checked separately; readable text
cannot all fit in an arbitrarily small area.

[Current laptop example](screenshots/ui-adaptive-1280x720.png) ·
[Current taller-screen example](screenshots/ui-adaptive-1024x768.png) ·
[Current mobile layout](screenshots/ui-mobile-375x812.png) ·
[Current crowd view](screenshots/ui-crowd-1280x720.png)

Implementation: [rack-layout.js](../rack-layout.js), [ui.js](../ui.js),
[styles.css](../styles.css), and [layout tests](../tests/rack-layout.test.js).
The findings below describe the original review before the implementation pass.
Their fixes are summarised above; original measurements remain useful historical
evidence rather than measurements of the final composition.

## What should stay

Preserve the purple cabinet, gold title tabs, cyan numbers, paper song strips,
real sleeve artwork, Bungee/Barlow/JetBrains typography, physical button depth,
precision changer, vinyl sound and CALM mode. The hierarchy of gold START,
magenta SELECT and quieter secondary controls is useful. Local fonts and assets,
offline song storage, and a silent independent crowd window suit venue operation.

The code-entry ritual is intentional. Album arrows and letter keys browse the
same collection; complete codes outline a track; SELECT adds it. That interaction
can remain the default while its guidance and keyboard handling improve.

## Original findings, resolved by the implementation pass

### 1. Global shortcuts can operate a different control from the one focused

With LIGHTS focused, Space starts or pauses music instead of pressing LIGHTS.
With `B2` pending, Enter on LIGHTS submits that song. ArrowRight on the next-album
button skips music instead of browsing: the shortcut exclusion refers to an
element named `#rack`, which is absent.

Let focused controls retain native activation. Keep global transport shortcuts
available when focus is on the cabinet background, and define album navigation
keys against the actual rack. The Tools drawer already provides a working local
example of preserving Enter/Space behavior.

Evidence: [app.js](../app.js), keydown and keyup handlers; existing drawer handling
in [cabinet.js](../cabinet.js). This should precede cosmetic refinements because
an unexpected transport change affects the music during an event.

### 2. Accepted requests beyond position six cannot be managed

The queue accepts up to 30 songs. The UI renders six, followed by `+N MORE
WAITING`. That text is not an action, and scrolling cannot reveal requests 7–30.
Those requests cannot be inspected, moved or cancelled until they reach the first
six positions.

Preferred option: render every explicit request in the existing queue's contained
scroll area, with a total count and a continuation cue. Keep the short automatic
house preview separate. Alternative: turn the extra-request indicator into a
clear **Manage queue** view containing the full order. The latter preserves the
small preview but adds another interaction and a dialog to maintain.

Evidence: [queue.js](../queue.js), `MAX_QUEUE`; [ui.js](../ui.js), `QUEUE_ROWS`,
`queue.slice(0, QUEUE_ROWS)` and the noninteractive extra-request indicator.

### 3. Keyboard scrolling changes volume, and queue edits lose focus

Down/Up inside the focusable album list or queue changes MUSIC by five points,
rather than scrolling. Moving a queued song with the keyboard then rebuilds the
queue DOM and sends focus to the document body.

Exempt focused scroll areas from global volume arrows. Preserve queue rows by
track identity, or restore focus to the moved track's action. After cancellation,
focus the nearest surviving action or the queue heading. This allows consecutive
edits without repeatedly tabbing back through the whole machine.

Evidence: [app.js](../app.js), arrow-key handling; [ui.js](../ui.js),
`renderQueue()` and `replaceChildren()`.

### 4. The diagnostic dialog does not contain keyboard focus

The missing/broken-library dialog correctly focuses Close on opening, and Escape
closes it and restores the warning button. Tab can nevertheless leave the dialog
for the background page. Space on Close fails because the global Space keyup
handler cancels native activation.

Use a native modal dialog, or implement contained focus and an inert background,
alongside the shortcut correction above. Keep the current purple panel and
plain-English problem list. The error path should be as usable as normal playback.

Verified with a browser-only malformed `tracks.js` response; repository catalogue
files were not changed. Evidence: [dialog markup](../index.html),
[showProblems](../ui.js), and [global keyup handling](../app.js).

### 5. The small-screen composition fits by shrinking text too far

All seven tracks remain visible at 800 × 600 and portrait 768 × 1024, but track
text is only about 10.5 px and 10.1 px respectively. Portrait retains three narrow
columns with substantial unused height in the centre. A larger cover improves
the artwork; it does not solve the rest of that composition.

Add a separate narrow layout with readable text minimums: two columns when they
fit, then a vertical cabinet when they do not. Let that mode scroll the outer
page so every control remains reachable. Keep the current fixed three-column
machine on its normal laptop/projector sizes. On short landscape windows,
reclaim header height and padding before shrinking text further.

A 640 × 360 viewport stress test produced 8.4 px track text and no remaining
house preview. At 320 × 180, controls clipped and no complete track row fitted.
These are reduced CSS viewport tests, not actual browser-zoom certification.
Because typography uses viewport units, real zoom and text enlargement need
their own assessment during a responsive pass.

### 6. Some controls need clearer or larger targets

Queue up/cancel buttons measure about 25 × 22 CSS pixels at 1280 × 720. They work
with a pointer but are small for touch or hurried venue operation. Give them
larger usable hit areas; a full queue-management view could support more spacious
controls without consuming the compact preview.

Keep visible CLR/DEL hardware labels, but add accessible names **Clear selection**
and **Delete last character**. Announce a new song's title/album once on track
change, and include NOW/queued position in strip status descriptions. Do not make
the updating clocks a continuous live announcement.

### 7. SELECT needs a contrast decision below the normal laptop scale

White text on the solid magenta SELECT face has a calculated contrast ratio of
about 3.46:1. At 1280 × 720 its bold 19 px text qualifies for the 3:1 large-text
threshold. At 1024 × 768 it is about 15.2 px, where normal text needs 4.5:1.

Retain the magenta action identity. Options are a dark ink label at smaller
scales, or the existing deeper magenta for the face with the bright magenta edge.
Evaluate the result together with the narrow layout; reducing all labels further
would make this problem worse. Cover-backed letter keys also deserve a manual
contrast check because their image backgrounds vary.

## Original whole-page usability and space review

| Area | Assessment | Suggested refinement |
|---|---|---|
| Arrival and INSERT COIN | The full arrival and coin ritual establish the cabinet. Once-per-tab completion avoids repeating it on ordinary reloads. | Preserve the timing and CALM equivalent. Keep the first actionable state obvious after arrival. |
| Sign and ticker | Strong identity; the ticker is readable in normal landscape sizes. Long CALM messages can ellipsize. | Give short screens a modestly smaller sign/gutters. Keep decorative jokes secondary to operation; avoid spending another permanent row on them. |
| Album artwork and navigation | Artwork now expands into genuine spare space; codes and titles remain aligned in one list. | Keep navigation/counts grouped. Recheck actual track content rather than assuming a permanent number of rows. |
| Code selection | Browsing and requesting remain distinct, preventing a browse click from queuing a song. Left list and right keypad require an eye movement across the centre. | Use contextual hints: album letter → track number → SELECT/Enter. Show the resolved song before submission, and report whether it started or its queue position. |
| Read-only strips | Authentic paper reference material; click behavior is intentionally absent. | Optional click-to-prefill could enter the code and highlight SELECT, while still requiring confirmation. This is a deliberate interaction choice, not a bug fix. |
| Up Next and house rotation | YOUR PICKS and IF NOBODY PICKS explain priority well. About two full requests fit at 1280 × 720; longer request lists scroll. | Add a request total and clear scroll continuation. Make every accepted request manageable. Keep house suggestions clearly separate from explicit requests. |
| Now Playing title and clocks | The current song and elapsed/remaining times are clear at normal laptop sizes. Title sizing depends on character count. | Fit titles against actual available width/wrapping, keeping time/progress positions stable. Preserve one prominent current-song title. |
| Changer and meters | The changer remains distinctive. At 1280 × 720 the idle meter band can flatten to about 34 px; at 1280 × 600 about 27 px. Tall screens leave unused centre space. | Reserve useful meter height, then let the changer grow into spare space. Reduce the changer modestly on short screens before flattening meters further. |
| Transport | BACK/START/SKIP stay together and START remains the strongest action. Restart/previous behavior already has feedback and a tooltip. | Preserve placement and the existing explanatory feedback. Fix keyboard routing before adding transport controls. |
| Faders and vinyl | MUSIC and EFFECTS are accessible native sliders. Effects intentionally adjusts cabinet sounds and vinyl together. | Show a small numeric value while adjusting. An optional Vinyl trim inside Tools would allow independent texture tuning without widening the deck. |
| Tools | Fullscreen, offline loading and keyboard help are appropriately secondary. Pointer, Enter/Space, Escape and outside-click behavior work here. | Retain the drawer. Do not spread infrequently used settings back across the main deck. |
| Offline status | The visible indicator communicates whether songs are saved; Load the Crates provides progress and result feedback. | Make the status lead directly to that action or its explanation, reducing the need to know where Tools stores it. |
| Credits/free play | Coins contribute to the character, but numeric credits can imply that playback requires payment. | Add a small persistent Free Play reassurance while preserving the coin action and animation. |
| Missing tracks and warnings | Out-of-order states and plain-English diagnostics are useful. | Fix dialog focus/activation. Keep text labels alongside color so problems are understandable without color perception. |
| Crowd screen | Correctly silent and free of operator controls; state catches up when opened during playback. Flexible artwork benefits its extra height. | Consider clearer “opens another screen” wording and a temporary projector/fullscreen hint. A connection-lost state would aid recovery. |
| Motion and performance | CALM respects the OS preference; canvases reuse buffers and the visual loop is capped. | Preserve these safeguards. Keep new sizing event-driven; avoid measuring artwork continuously with the music visualiser. |

## Layout options that retain the current feel

| Option | Benefit | Cost / tradeoff | Recommendation |
|---|---|---|---|
| Current three columns with adaptive artwork | Preserves full album lists, the mechanical centre and a stable selector position. | The list and keypad remain separated; the queue preview remains compact. | Default for normal operator laptops. |
| Selector above Up Next in the same right column | Reads as input followed by its result; some operators may find the flow clearer. | Reorders the same content, producing no additional space. | Preference to prototype after interaction fixes. |
| Selector beneath the album list | Keeps browsing, code reference and entry in one place. | Takes roughly 180 px from the album panel at 1280 × 720, competing directly with tracks and artwork. | Requires a larger redesign; avoid a simple relocation. |
| Shallow selector rail on sufficiently wide screens | Extra width can reduce keypad rows and release queue height. | Takes height from other panels and needs clear separation from transport. | Optional wide-screen variant, measured against actual key widths. |
| One row of letters only when the right column is wide enough | Saves a keypad row without moving panels. | Narrow ten-key rows are cramped; viewport width alone is an unreliable trigger. | Conservative large-screen optimisation using container width. |
| Two-column / stacked narrow cabinet | Keeps text and controls readable and uses portrait height. | The whole machine no longer fits on one screen; reading order needs care. | Preferred narrow-screen direction. |

For the crowd window, use a separate balance: larger Now Playing/changer artwork,
legible audience titles and a small useful upcoming preview. Operator metadata and
editing controls should stay absent. Keep the selected album's complete current
track list, rather than copying the operator's compact proportions blindly.

## Accessibility evidence and limits

Manual keyboard checks produced the confirmed interaction findings above. The
Tools drawer works; there is no inactive Keyboard Shortcuts control. OS reduced
motion starts CALM, sliders retain native adjustment, album and queue actions have
useful names, and acceptance/error messages use status announcements. Decorative
canvases and effects are hidden from accessibility output.

An axe-core 4.10.3 run covered idle, playing, open Tools and crowd states. Each had
one confirmed automated best-practice issue: the ticker sits outside a landmark.
Put it within an appropriate named region/landmark. Automated contrast checks
were incomplete on layered/image-backed content, covering 74 elements in the
sampled idle state, 77 playing, 82 with Tools open, and 24 in crowd view. These
counts are requests for manual inspection, not confirmed contrast failures.
Some generic-element ARIA naming also required manual review. The solid SELECT
contrast calculation above is separate confirmed evidence.

This is a functional and expert UI review, not a screen-reader certification,
novice-user study, real touch-device test, or projector-distance legibility test.
Those checks remain useful for final venue tuning.

## Completed implementation sequence

1. Correct shortcut priority, scroll-area arrows and diagnostic-dialog focus.
2. Expose every queued request and preserve focus through queue edits.
3. Add readable narrow/short layouts and adjust small-scale SELECT contrast.
4. Improve code guidance, selection preview and queue-position confirmation.
5. Tune centre proportions and add only the small volume/offline/crowd affordances
   that prove useful during a venue run-through.

The artwork change is covered by layout constraint tests and the catalogue was
checked album by album in both windows across nine sizes. Focused browser
regressions exercise the keyboard, queue and modal fixes rather than treating
unit-test success as evidence for those interactions. Accessibility automation
still leaves layered/image-backed contrast for manual assessment; final venue
legibility and real touch hardware remain practical checks for the operator.

## Final validation

- All 146 Node tests pass.
- The real-app browser regression passes focused-keyboard protection, nine-request
  management, focus/scroll retention, confirmed quick pick, saved independent
  sliders, native diagnostics and seven responsive sizes, with no JavaScript
  errors. A new selection replaces an old acceptance message with the relevant
  confirmation guidance.
- The full catalogue was checked in 180 album/window/size combinations. Additional
  touch emulation at 320, 375, 768 and 1280 px keeps all seven album tracks in
  their panel, 40 px key heights and no horizontal document overflow.
- Fresh service-worker installation and offline shell reload include the new
  keyboard and artwork modules; every precache entry exists.
- Final axe-core runs report zero confirmed violations in idle, playing, Tools
  and crowd states. Image/layer-backed contrast remains a manual-inspection item;
  this is not a claim of accessibility certification.

Responsive viewport reflow is tested. Actual browser-zoom controls could not be
exercised by this headless Chromium installation, so real browser zoom/text
enlargement remains a manual check alongside venue hardware testing. These are
validation limits, rather than unimplemented application features.

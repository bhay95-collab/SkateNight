# Cabinet sound effects

The seven bundled WAVs are original, physically inspired sound models, authored
for this cabinet. They are **not field recordings** and use no third-party
samples: deterministic noise and damped resonances suggest metal, plastic,
relays, paper carriers, and a small motor. Regenerate the exact mono 22.05 kHz /
16-bit PCM files with `python3 scripts/generate-sfx.py` (standard library only).

To use your own recording, add an MP3 with the same name. A readable MP3 takes
priority over the bundled WAV. A missing or unreadable MP3 falls back to the WAV,
then to a quiet live Web Audio model if neither file works. Failures never stop
music playback. Both originals and replacements use the separate EFFECTS volume.

The cabinet mix gives each action its own conservative gain trim. Frequently
pressed keys, page catches, and the changer stay behind the coin and relay
accents. Coin, key, and page playback varies by less than 2% per action to avoid
an identical repeated contact; the motor, needle, and confirmation keep a fixed
speed. These are small changes to the existing sounds, not additional melodies
or layers.

Repeating the same action starts its new sound immediately and fades its old
tail over 14 ms. This prevents rapid browsing and interrupted changer moves
from building up a pile of sounds. Different actions can still overlap, and
finished sources disconnect from the audio graph. The same mix and repeat
handling apply to live fallbacks. The original motor emphasizes brush friction
and uneven gear load, rather than a sustained electronic tone. Shorter changer
moves crossfade into its original settling contact at constant pitch; custom
MP3s still fade to fit. Resetting a movement releases its motor sound.

| File | When it plays | Ideal length |
|---|---|---|
| `coin.mp3` | Coin chute rattle and landing | 0.5 - 0.7 s |
| `key.mp3` | Dry selector switch | under 0.1 s |
| `confirm.mp3` | Selection relay double latch | 0.2 - 0.3 s |
| `whirr.mp3` | Changer motor (custom long files fade to fit the movement) | about 1 s |
| `thud.mp3` | Gentle needle landing | 0.1 - 0.2 s |
| `buzz.mp3` | Muted refused-selection solenoid | 0.2 - 0.4 s |
| `page.mp3` | Carrier catch releasing and landing | 0.2 - 0.4 s |

The INSERT COIN film has no bundled files: its sounds are live models, timed
from `startup-timing.js`. Any of these replaces one of them; each starts on its
beat, so line the recording up with the times below (from its own start).

| File | When it plays | Length, and what must land where |
|---|---|---|
| `lift.mp3` | Plays from the press: silence, then the coin taken up into the lamp's light, its rim ringing into a big space | about 3.1 s: taken up at 1.1 s, the ring at 1.7 s |
| `contact.mp3` | The coin's edge meets the slit | about 0.6 s: scrape, slip at 0.3 s, gate at 0.55 s |
| `chute.mp3` | Swallowed: the long fall, clinks further and wetter, the coin box far below, the counter | about 2.5 s: clinks to 1.87 s, coin box at 2.05 s |
| `relay.mp3` | The main relay pulling in | about 1.5 s: the THUNK at the very start |
| `power.mp3` | Relay to the cut: hum, the first try dying, the dark, the heartbeat, the lock's eight beats | 10.2 s: dies at 2.48 s, second relay at 4.28 s, heartbeat from 4.68 s, lock at 7.08 s (446.5 ms a beat), cut at 10.21 s |
| `tube.mp3` | One neon letter striking (plays many times) | under 0.25 s |

The original pack totals about 124 KB. Peaks are deliberately conservative;
the needle landing and motor are quieter than the coin and switches. The legacy
`flicker` API stays silent unless a custom `flicker.mp3` is supplied and explicitly
called.

## Vinyl playback texture

The record surface is the approved Sound Design V4 loop, `sfx/vinyl-surface.wav`.
Each interactive record change drops the needle with `sfx/needle-drop.wav`
(0.32 s, cut from the owner's `MA_SoundCreator_Scratch_Vinyl_1.wav`): a crisp
contact, a brief textured scrape and a natural decay under the surface - a
touchdown, not a DJ scratch. If it cannot load, `vinyl.js` synthesizes a drop
instead. The night's opener never drops the needle here (the film carries its
own stylus contact), and pausing, resuming or recovering from buffering does
not repeat it.

The surface follows the deck's fades and stops on pause, buffering, end, or
playback error. EFFECTS is its master and **Vinyl texture** trims it alone;
MUSIC does not touch it.

For independent adjustment, open **TOOLS** and use **Vinyl texture**. Its default
**100%** preserves the authored mix; lowering it reduces the scrape, surface
noise and dust ticks without changing cabinet sounds. **0%** removes the vinyl
texture. The percentage is displayed and the choice is remembered on that laptop.
This trim operates under the MUSIC and EFFECTS controls, so it cannot restore
texture when either master is at zero. No extra download or custom recording is
needed, and the texture works offline. The original audio files are unchanged.

For replacements, trim leading silence, keep files small, and compare loudness
against the supplied pack. Do not normalize all effects to full scale: they
should sit below the music. Use sounds you have the right to use. Assess final
SFX volume through the venue's speakers; browser playback alone cannot establish
the right level for a room.

## The interactive jukebox: changer and living machine

Built from the owner's recordings (Motion Array and other sources, kept
outside this repository) by `node scripts/build-jukebox-sfx.mjs <source pack>`,
which records exactly how each component was cut, filtered, faded and
normalised. Only the optimised results are committed (805 KiB in all, all
precached for offline use):

| File | What it holds |
|---|---|
| `jukebox/mechanics.mp3` | 36 short components (motor, ratchets, index lock, gripper, servos, platter drop, tonearm, record seating, sleeve return, and distant details); `jukebox-sprite.js` maps them |
| `jukebox/bed-machine.flac` | the low machine bed, 8 s seamless loop (from the idling-machine recording) |
| `jukebox/bed-electric.flac` | the electrical hum, 7 s seamless loop (from Electricity Loop 1) |
| `needle-drop.wav` | the stylus touchdown above |

`jukebox-sfx.js` plays them on the Effects bus. **The changer**: every eject
and load is placed on `mechanism.js`'s move fractions, scaled with the move
(so skips at speed 1.8 stay on the picture), each slot drawn from a shuffle bag
with slight speed and level variation. It replaces the motor whirr while the
recordings are available and plays on the same voice, so the next move or a
reset releases it. A load peaks about 8 dB under a song at equal faders.
**The living machine**: the two beds and an irregular distant detail (one at a
time, every 6-30 s or so; steam at most every 100 s). It fades in over about 8
s once the film has handed over (never over the dormant screen or the film),
sits about 4.5 dB lower while music plays, and stops entirely in a hidden tab.
Its levels are `AMBIENCE` in `jukebox-sfx.js`: about -38 LUFS idle at equal
faders, roughly 20 dB under the music. Confirm them on the event PA.

Licensing: check the Motion Array (and any other source's) terms cover public
use at the event and these trimmed files on a public GitHub Pages site.

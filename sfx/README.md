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
| `lift.mp3` | The press: the coin taken up and swung into the light | about 1.5 s |
| `contact.mp3` | The coin's edge meets the slit | about 0.6 s: scrape, slip at 0.3 s, gate at 0.55 s |
| `chute.mp3` | Swallowed: clinks going deeper inside | about 1.1 s: coin box at 0.67 s |
| `relay.mp3` | The main relay pulling in | about 1.5 s: the THUNK at the very start |
| `power.mp3` | Relay to line: hum, the first try dying, catching, the lock | 5.2 s: dies at 0.92 s, second relay at 1.38 s, lock at 2.82 s |
| `tube.mp3` | One neon letter striking (plays many times) | under 0.25 s |
| `collapse.mp3` | The surge, the dive, the squeeze to a line | 1.1 s: line and thunk at 1.1 s |

The original pack totals about 124 KB. Peaks are deliberately conservative;
the needle landing and motor are quieter than the coin and switches. The legacy
`flicker` API stays silent unless a custom `flicker.mp3` is supplied and explicitly
called.

## Vinyl playback texture

`vinyl.js` generates an original, quiet record surface in the browser: filtered
groove friction and sparse soft dust ticks under each song. A brief 240 ms
needle-settling scrape accompanies actual track starts and restarts, including
natural song changes. It is a small groove scratch, not a DJ backspin. Pausing
and resuming or recovering from buffering does not repeat the scrape.

The surface follows the deck's fades and stops on pause, buffering, end, or
playback error. Both MUSIC and EFFECTS affect it: lower EFFECTS for less vinyl
and quieter cabinet sounds; EFFECTS at zero removes both. MUSIC at zero also
silences the vinyl.

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

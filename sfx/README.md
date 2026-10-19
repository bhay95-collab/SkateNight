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
silences the vinyl. No extra download or custom recording is needed, and the
texture works offline. The original audio files are unchanged.

For replacements, trim leading silence, keep files small, and compare loudness
against the supplied pack. Do not normalize all effects to full scale: they
should sit below the music. Use sounds you have the right to use. Assess final
SFX volume through the venue's speakers; browser playback alone cannot establish
the right level for a room.

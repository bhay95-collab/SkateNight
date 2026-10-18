# Cabinet sound effects

The seven bundled WAVs are original, physically inspired sound models, authored
for this cabinet. They are **not field recordings** and use no third-party
samples: deterministic noise and damped resonances suggest metal, plastic,
relays, paper carriers, and a small motor. Regenerate the exact mono 22.05 kHz /
16-bit PCM files with `python3 scripts/generate-sfx.py` (standard library only).

To use your own recording, add an MP3 with the same name. A readable MP3 takes
priority over the bundled WAV. A missing or unreadable MP3 falls back to the WAV,
then to a quiet live Web Audio model if neither file works. Failures never stop
music playback. Both originals and replacements use the separate SFX volume.

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
handling apply to live fallbacks. None of this changes music volume, playback
timing, or the record-change sequence.

| File | When it plays | Ideal length |
|---|---|---|
| `coin.mp3` | Coin chute rattle and landing | 0.5 - 0.7 s |
| `key.mp3` | Dry selector switch | under 0.1 s |
| `confirm.mp3` | Selection relay double latch | 0.2 - 0.3 s |
| `whirr.mp3` | Changer motor (long files fade to fit the movement) | about 1 s |
| `thud.mp3` | Gentle needle landing | 0.1 - 0.2 s |
| `buzz.mp3` | Muted refused-selection solenoid | 0.2 - 0.4 s |
| `page.mp3` | Carrier catch releasing and landing | 0.2 - 0.4 s |

The original pack totals about 124 KB. Peaks are deliberately conservative;
the needle landing and motor are quieter than the coin and switches. There is
no continuous vinyl noise or electrical crackle. The legacy `flicker` API stays
silent unless a custom `flicker.mp3` is supplied and explicitly called.

For replacements, trim leading silence, keep files small, and compare loudness
against the supplied pack. Do not normalize all effects to full scale: they
should sit below the music. Use sounds you have the right to use. Assess final
SFX volume through the venue's speakers; browser playback alone cannot establish
the right level for a room.

# Sound review

The seven cabinet cues were reviewed for their source model, level, triggers,
replacement/fallback behavior, overlap and cleanup. The changing record received
the main revision. A quiet vinyl playback layer now accompanies each song.

## Cabinet effects

Levels below measure the original mono WAVs before their per-effect trims,
EFFECTS fader and shared safety limiter. The faders are squared, so the default
70% EFFECTS setting attenuates these cues by another 6.2 dB, in addition to the trim.

| Cue | Duration | Peak / RMS, dBFS | Review and result |
|---|---:|---:|---|
| Coin | 580 ms | -12.0 / -29.8 | Clear chute contacts and damped landing; retained as the strongest brief accent. |
| Key | 85 ms | -15.4 / -31.6 | Dry, short switch contact; retained below the coin, with subtle variation for repeated presses. |
| Confirmation | 245 ms | -14.9 / -35.0 | Dry relay double latch, distinct from selection keys; retained. |
| Changer motor | 1,120 ms | -19.6 / -32.1 | Reworked: less sine drone, more soft brush friction, uneven gear load and quiet engagement/settling. |
| Needle landing | 150 ms | -21.4 / -42.6 | Gentle cartridge contact; retained separately from the new groove scrape. |
| Refusal | 300 ms | -17.7 / -35.9 | Muted double solenoid contact, without a harsh electronic buzzer; retained. |
| Page carrier | 320 ms | -14.0 / -33.7 | Release, paper motion and landing catch; retained below the main accents. |
| Flicker | — | Silent by default | Remains an optional custom-recording hook; decorative light flicker adds no electrical crackle. |

The original motor's late settling contact used to be cut off when the changer
ran faster. Short moves now crossfade the steady body into the original ending
at constant pitch, rather than accelerating the whole sound. Custom motor MP3s
keep the documented fade-to-fit behavior. Repeated actions release old tails,
and cancelling a movement silences its motor without stopping other effects.

The mechanism also had a 30 ms completion padding on ejection, which pushed
the next load/needle cue behind the independently scheduled music. Completion
now uses the published duration. Cancelled sequences resolve, and a superseded
swap cannot unexpectedly resume loading an old record.

## Vinyl character and controls

A brief 240 ms brush-like groove scrape starts with actual playback of each new
track, including the first song, automatic changes, skips and restarts. This is
a stylus settling into a groove, without a DJ-style backspin or loud pop.

The continuing texture is filtered groove friction with irregular tiny dust
contacts, designed to suggest a clean, lightly worn record. It has no mains hum,
heavy rumble or conspicuous repeated crackle. At 48 kHz it measures about
-59 dBFS RMS before the faders, or -71 dBFS at the default MUSIC and EFFECTS
settings. Loud passages may mask it; quiet intros and gaps expose it more.

Both faders affect vinyl: MUSIC controls the song and its surface together;
EFFECTS adjusts the texture along with the cabinet cues. Setting either fader
to zero silences the vinyl. Remembered settings now apply correctly on the
first audio unlock.

Texture follows each deck's fades and stops during pause, buffering, completion
or error. Resuming and buffering recovery do not repeat the opening scrape.
Buffers are synthesized once per audio context, shared by both decks, and
require no external audio files. Ended sources disconnect from the graph.
Offline shell caching includes the new module.

## Verification

The automated checks cover the original assets' PCM integrity and headroom,
custom MP3 priority/fallbacks, motor-tail timing and pitch, repeat/reset cleanup,
mechanism timing/cancellation, vinyl levels and boundaries at 22.05/48 kHz,
transport events, both faders, and synthesis/playback failure isolation.

Headless Chromium checks exercise real song playback, pause/resume, rapid
transport changes, mute, skip, natural song endings and offline module loading.
These are functional and signal-level checks. Final perceptual balance still
needs a listen through the intended headphones or venue speakers.

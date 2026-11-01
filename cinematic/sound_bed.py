#!/usr/bin/env python3
"""The director's cut's effects bed, timed from cinematic/cues.json (standard library only).

    python3 cinematic/sound_bed.py [--coin build/awakening-film.mp4]

The machine's sounds share one power level, the live cut's SUPPLY curve, so
the hum, the motor whine and the gear load rise, nearly hold and die together,
exactly as the picture does. The heartbeat thumps on the cue frames and
quickens into the lock beats, where each beat also gets a mechanical clack at
the opener's tempo: the pulse becomes the song's beat. After the song starts
the bed only fades, and it is gone by 17 s. The song itself is never in this
file: the jukebox plays it.

The coin and chute (0-5.3 s) come from the existing film's tuned effects when
--coin points at it. Output: 48 kHz stereo 16-bit WAV.
"""
import argparse
import json
import math
import random
import shutil
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CUES = json.loads((Path(__file__).resolve().parent / "cues.json").read_text())
FPS = CUES["fps"]
F = CUES["frames"]
RATE = 48000
TAU = math.tau
RNG = random.Random(1985)
DURATION = (F["final"] + 1) / FPS


def sec(frame):
    return frame / FPS


def supply(t):
    pts = [(f / FPS, v) for f, v in CUES["supply"]["points"]]
    if t <= pts[0][0]:
        return pts[0][1]
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        if t0 <= t <= t1:
            return v0 + (v1 - v0) * (t - t0) / max(1e-6, t1 - t0)
    return pts[-1][1]


class Mix:
    def __init__(self, seconds):
        self.n = round(seconds * RATE)
        self.l = [0.0] * self.n
        self.r = [0.0] * self.n

    def add(self, start, samples, gain=1.0, pan=0.0):
        i0 = round(start * RATE)
        gl, gr = gain * math.cos((pan + 1) * math.pi / 4), gain * math.sin((pan + 1) * math.pi / 4)
        for k, v in enumerate(samples):
            i = i0 + k
            if 0 <= i < self.n:
                self.l[i] += v * gl
                self.r[i] += v * gr

    def write(self, path):
        peak = max(max(map(abs, self.l)), max(map(abs, self.r)), 1e-9)
        scale = min(1.0, 0.89 / peak)                  # -1 dBFS ceiling, never louder than authored
        with wave.open(str(path), "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(b"".join(struct.pack("<hh", round(a * scale * 32767), round(b * scale * 32767))
                                   for a, b in zip(self.l, self.r)))
        return peak


# ----------------------------------------------------------------- voices

def thump(freq=55.0, seconds=0.35, decay=0.08, click=0.25, harmonics=(1.0, 0.35, 0.12)):
    """A low body impact: a falling sine with a short contact click."""
    out = []
    for k in range(round(seconds * RATE)):
        t = k / RATE
        f = freq * (1 + 0.6 * math.exp(-t / 0.02))
        body = sum(a * math.sin(TAU * f * (h + 1) * t) for h, a in enumerate(harmonics))
        tick = click * (RNG.random() * 2 - 1) * math.exp(-t / 0.003)
        out.append(body * math.exp(-t / decay) + tick)
    return out


def ring(freqs, seconds, decay, level=1.0):
    """Metal ringing: inharmonic partials with their own decays."""
    out = []
    for k in range(round(seconds * RATE)):
        t = k / RATE
        out.append(level * sum(a * math.sin(TAU * f * t) * math.exp(-t / (decay * (1.4 - i * 0.2)))
                               for i, (f, a) in enumerate(freqs)))
    return out


def noise(seconds, cutoff, env):
    """One-pole low-passed noise shaped by env(t)."""
    out, y = [], 0.0
    a = 1 - math.exp(-TAU * cutoff / RATE)
    for k in range(round(seconds * RATE)):
        y += a * ((RNG.random() * 2 - 1) - y)
        out.append(y * env(k / RATE))
    return out


def machine(t0, t1, level):
    """Transformer hum, motor whine and gear load over [t0, t1], all following the supply."""
    out, phase_w, y = [], 0.0, 0.0
    a = 1 - math.exp(-TAU * 180 / RATE)
    for k in range(round((t1 - t0) * RATE)):
        t = t0 + k / RATE
        p = supply(t)
        hum = 0.5 * math.sin(TAU * 60 * t) + 0.3 * math.sin(TAU * 120 * t) + 0.12 * math.sin(TAU * 180 * t)
        phase_w += TAU * (140 + 340 * min(1.0, p)) / RATE
        whine = 0.18 * math.sin(phase_w) + 0.06 * math.sin(2.01 * phase_w)
        y += a * ((RNG.random() * 2 - 1) - y)
        teeth = 0.5 + 0.5 * math.sin(TAU * (2 + 9 * p) * t)          # tooth-pass rate rises with the load
        grind = y * 1.6 * teeth * min(1.0, p * 1.4)
        out.append(level * (p * hum * 0.55 + p * whine + grind * 0.5))
    return out


def wind_down(seconds=1.4):
    """The failure: the whine's pitch falls away and a long groan bends down."""
    out, ph, ph2 = [], 0.0, 0.0
    for k in range(round(seconds * RATE)):
        t = k / RATE
        ph += TAU * (400 * math.exp(-t / 0.35) + 40) / RATE
        ph2 += TAU * (92 - 34 * min(1, t / seconds)) / RATE
        out.append(0.22 * math.sin(ph) * math.exp(-t / 0.5) + 0.3 * math.sin(ph2) * math.sin(math.pi * t / seconds))
    return out


def crackle(seconds, rate_hz, level):
    out = [0.0] * round(seconds * RATE)
    for _ in range(round(seconds * rate_hz)):
        i = RNG.randrange(len(out) - 200)
        amp = level * (0.3 + RNG.random())
        for j in range(120):
            out[i + j] += amp * (RNG.random() * 2 - 1) * math.exp(-j / 18)
    return out


# ----------------------------------------------------------------- the bed

def add_coin(m, coin_wav):
    with wave.open(str(coin_wav)) as w:
        raw = w.readframes(w.getnframes())
    vals = struct.unpack(f"<{len(raw) // 2}h", raw)
    cut = round(5.3 * RATE)
    for i in range(min(len(vals) // 2, cut)):
        fade = min(1.0, (cut - i) / (0.3 * RATE))
        m.l[i] += vals[2 * i] / 32768 * fade
        m.r[i] += vals[2 * i + 1] / 32768 * fade


def add_attempt(m):
    relay, fail = sec(F["relay"]), sec(F["failure"])
    m.add(relay, thump(48, 0.6, 0.12, 0.4), 0.55)
    m.add(relay + 0.01, ring([(182, 0.5), (417, 0.3), (933, 0.15)], 0.8, 0.12), 0.18)
    for i in range(8):                                               # the high bays slam on, near to far
        m.add(relay + 3 * i / FPS, thump(140, 0.12, 0.02, 0.5, (1.0, 0.2)), 0.12 * (1 - i / 12), pan=(-1) ** i * 0.4)
    m.add(relay, machine(relay, fail + 0.5, 0.32))
    m.add(fail, wind_down(), 0.5)
    for k, dt in enumerate((0.42, 0.58)):                            # backlash: two dull clunks
        m.add(fail + dt, thump(70 - 12 * k, 0.4, 0.07, 0.3), 0.3 - 0.08 * k, pan=-0.2)
    m.add(sec(F["tick"]), ring([(2600, 0.6), (5100, 0.3)], 0.08, 0.01), 0.12, pan=0.3)


def add_recovery(m):
    m.add(sec(F["catch"]), thump(42, 0.7, 0.15, 0.5), 0.5)
    beats = [sec(b) for b in F["heartbeats"]] + [sec(b) for b in F["lockBeats"]]
    for i, b in enumerate(beats):                                    # lub-dub, quickening into the tempo
        grow = min(1.0, 0.45 + i * 0.08)
        m.add(b, thump(52, 0.3, 0.07, 0.15), 0.42 * grow)
        m.add(b + 0.085, thump(60, 0.22, 0.05, 0.1), 0.22 * grow)
        m.add(b - 0.12, noise(0.12, 900, lambda t: (t / 0.12) ** 2), 0.05 * grow)   # the charge before each beat
        if i >= len(F["heartbeats"]):                                # locked: each beat is also the machine's clack
            m.add(b, ring([(820, 0.5), (1640, 0.25), (2900, 0.1)], 0.14, 0.025), 0.12, pan=0.25)
    ignite = sec(F["ignite"])
    m.add(ignite, thump(38, 0.9, 0.2, 0.6), 0.6)                     # the gearbox engages
    m.add(ignite + 0.02, ring([(120, 0.6), (271, 0.4), (611, 0.2)], 1.2, 0.25), 0.2)
    m.add(ignite, machine(ignite, sec(F["stylusContact"]) + 0.6, 0.2))


def add_record(m):
    to_record, contact = sec(F["toRecord"]), sec(F["stylusContact"])
    span = contact + 1.2 - to_record
    m.add(to_record, noise(span, 120, lambda t: 0.5 * min(1, t / 0.8) * max(0.0, 1 - max(0, t - (span - 1.2)) / 1.2)),
          0.5)
    cue = sec(F["lockBeats"][6])
    m.add(cue, thump(300, 0.08, 0.015, 0.4, (1.0,)), 0.12)          # the cue lever lets go
    m.add(cue + 0.03, noise(0.6, 2400, lambda t: math.exp(-t / 0.25)), 0.08)   # the damper's hiss
    m.add(contact, thump(90, 0.25, 0.04, 0.05, (1.0, 0.2)), 0.18)   # touchdown: felt more than heard
    m.add(contact, crackle(1.2, 14, 0.12), 0.5)


def duck(m):
    """After the song starts the bed only fades: the music has the room."""
    start, end = CUES["song"]["startSec"], 17.0
    for i in range(round(start * RATE), m.n):
        g = max(0.0, 1 - (i / RATE - start) / (end - start)) ** 2
        m.l[i] *= g
        m.r[i] *= g


def compose(coin_wav=None):
    m = Mix(DURATION)
    if coin_wav:
        add_coin(m, coin_wav)
    add_attempt(m)
    add_recovery(m)
    add_record(m)
    duck(m)
    return m


def extract_coin(film, tmp):
    out = Path(tmp) / "coin.wav"
    subprocess.run([shutil.which("ffmpeg"), "-y", "-loglevel", "error", "-i", str(film), "-t", "5.4",
                    "-vn", "-ac", "2", "-ar", str(RATE), "-c:a", "pcm_s16le", str(out)], check=True)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--coin", type=Path, default=ROOT / "build" / "awakening-film.mp4")
    ap.add_argument("--out", type=Path, default=ROOT / "build" / "cinematic-phase4" / "animatic" / "sfx-bed.wav")
    args = ap.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        coin = extract_coin(args.coin, tmp) if args.coin.exists() else None
        peak = compose(coin).write(args.out)
    print(f"WROTE {args.out} ({DURATION:.3f} s, pre-limit peak {peak:.2f})")


if __name__ == "__main__":
    main()

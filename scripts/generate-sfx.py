#!/usr/bin/env python3
"""Author the cabinet's original, physically inspired sound effects.

No recordings or external libraries are used. Deterministic noise, damped
resonances, and soft motor harmonics model small electromechanical events.
Run from any directory: python3 scripts/generate-sfx.py
Output: mono 22.05 kHz / 16-bit PCM WAV, with conservative per-effect peaks.
"""

import math
from pathlib import Path
import random
import struct
import wave

RATE = 22050
DEST = Path(__file__).resolve().parent.parent / "sfx"
RNG = random.Random(1985)
TAU = math.tau


def blank(seconds):
    return [0.0] * round(seconds * RATE)


def impact(samples, at, strength, resonances, decay=0.035, grit=0.3):
    """A contact impulse exciting a few inharmonic cabinet resonances."""
    start = round(at * RATE)
    low = 0.0
    for j in range(min(round(decay * 9 * RATE), len(samples) - start)):
        t = j / RATE
        noise = RNG.uniform(-1, 1)
        low += 0.25 * (noise - low)
        contact = (noise - low) * math.exp(-t / (decay * 0.22))
        ring = sum(weight * math.sin(TAU * freq * t) * math.exp(-t / (decay * damping))
                   for freq, weight, damping in resonances)
        attack = min(1.0, t / 0.0007)
        samples[start + j] += strength * attack * (ring + grit * contact)


def write(name, samples, peak):
    # Remove DC and fade both boundaries: even the shortest key has no PCM step.
    mean = sum(samples) / len(samples)
    samples = [sample - mean for sample in samples]
    for i in range(min(90, len(samples))):
        samples[i] *= i / 90
        samples[-i - 1] *= i / 90
    scale = peak / max(abs(sample) for sample in samples)
    pcm = [round(sample * scale * 32767) for sample in samples]
    with wave.open(str(DEST / f"{name}.wav"), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(struct.pack(f"<{len(pcm)}h", *pcm))
    rms = math.sqrt(sum((sample / 32767) ** 2 for sample in pcm) / len(pcm))
    print(f"{name:8} {len(pcm) / RATE:.3f} s  peak {20 * math.log10(peak):5.1f} dBFS  "
          f"RMS {20 * math.log10(rms):5.1f} dBFS  {(DEST / f'{name}.wav').stat().st_size:6} bytes")


def main():
    DEST.mkdir(exist_ok=True)

    # A coin touches two chute rails, rattles, and lands in a damped metal box.
    coin = blank(0.58)
    metal = [(2353, 0.40, 1), (3589, 0.28, 0.72), (5417, 0.15, 0.53)]
    for at, weight in [(0.004, 0.8), (0.059, 0.55), (0.133, 0.7), (0.205, 0.43)]:
        impact(coin, at, weight, metal, decay=0.037, grit=0.45)
    impact(coin, 0.284, 0.9, [(413, 0.65, 0.8), (877, 0.32, 1), (2663, 0.15, 1.4)],
           decay=0.025, grit=0.25)
    impact(coin, 0.339, 0.22, metal, decay=0.023, grit=0.25)
    write("coin", coin, 0.25)

    key = blank(0.085)
    impact(key, 0.002, 1, [(683, 0.65, 0.9), (1471, 0.28, 0.55)], decay=0.009, grit=0.6)
    impact(key, 0.027, 0.40, [(487, 0.70, 0.8), (1193, 0.23, 0.6)], decay=0.009, grit=0.3)
    write("key", key, 0.17)

    # Relays acknowledge the selection with a dry double latch, without a melody.
    confirm = blank(0.245)
    for at, weight in [(0.004, 0.82), (0.095, 1), (0.118, 0.30)]:
        impact(confirm, at, weight, [(821, 0.6, 1), (2137, 0.28, 0.6)], decay=0.012, grit=0.5)
    write("confirm", confirm, 0.18)

    motor = blank(1.12)
    phase = 0.0
    smooth = 0.0
    for i in range(len(motor)):
        t = i / RATE
        speed = min(1, t / 0.18) * min(1, (1.12 - t) / 0.20)
        phase += TAU * (135 + 45 * speed) / RATE
        smooth += 0.16 * (RNG.uniform(-1, 1) - smooth)
        teeth = 0.74 + 0.26 * math.sin(TAU * 24 * t)
        envelope = min(1, t / 0.045) * min(1, (1.12 - t) / 0.11)
        motor[i] = envelope * (0.30 * math.sin(phase) + 0.11 * math.sin(phase * 3.03)
                               + 0.075 * math.sin(phase * 5.07) + 0.65 * smooth * teeth)
    impact(motor, 0.01, 0.42, [(629, 0.8, 1), (1831, 0.25, 0.7)], decay=0.01, grit=0.5)
    impact(motor, 1.015, 0.28, [(557, 0.8, 1), (1493, 0.25, 0.7)], decay=0.01, grit=0.5)
    write("whirr", motor, 0.105)

    # Felt-damped cartridge contact: no bass drop, pop, or continuous surface noise.
    needle = blank(0.15)
    impact(needle, 0.003, 1, [(743, 0.7, 0.65), (1709, 0.25, 0.4)], decay=0.012, grit=0.18)
    impact(needle, 0.035, 0.16, [(1103, 0.5, 0.6)], decay=0.007, grit=0.1)
    write("thud", needle, 0.085)

    # A muted solenoid refusal; two soft contact attempts rather than a harsh buzzer.
    refusal = blank(0.30)
    for at in [0.003, 0.13]:
        impact(refusal, at, 1, [(263, 0.6, 0.8), (571, 0.4, 0.6)], decay=0.021, grit=0.25)
    write("buzz", refusal, 0.13)

    page = blank(0.32)
    impact(page, 0.002, 0.65, [(1321, 0.6, 0.7), (2791, 0.22, 0.5)], decay=0.012, grit=0.5)
    # The paper carrier moves quietly between its two mechanical catches.
    low = 0.0
    for i in range(round(0.035 * RATE), round(0.20 * RATE)):
        t = i / RATE
        low += 0.14 * (RNG.uniform(-1, 1) - low)
        page[i] += 0.055 * low * math.sin(math.pi * (t - 0.035) / 0.165) ** 2
    impact(page, 0.205, 1, [(367, 0.8, 1), (977, 0.24, 0.6)], decay=0.014, grit=0.25)
    impact(page, 0.231, 0.22, [(1709, 0.65, 0.6)], decay=0.009, grit=0.3)
    write("page", page, 0.20)


if __name__ == "__main__":
    main()

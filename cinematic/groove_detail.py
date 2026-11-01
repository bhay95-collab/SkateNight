"""The two things the eye goes to in the groove world: the cartridge and the carousel.

Cartridge (lift-local coordinates: +X runs down the arm, the diamond tip is at
(L, 0, -100), which is the groove surface when the arm is down). A vintage
moving-magnet design at x4000: aluminium headshell with finger lift and brass
screws, black body with an engraved side plate, terminal pins and coloured
leads at the back, a separate stylus housing, a damped aluminium cantilever at
about 17 degrees, and a small conical diamond under its tip.

Carousel: the changer's magazine as a machine, not a light pattern: records on
pivot pins in U-cradles that ride two rails and an index ring gear turned by a
pinion drive; printed paper labels and one small lamp per slot.
"""
import math

from mathutils import Matrix, Vector

import kit
from kit import Batch

LEAD_COLOURS = ((0.7, 0.04, 0.03), (0.05, 0.4, 0.08), (0.06, 0.12, 0.6), (0.75, 0.75, 0.72))
LABEL_COLOURS = ((0.1, 0.75, 0.9), (0.9, 0.12, 0.45), (0.95, 0.55, 0.1), (0.3, 0.38, 0.9), (0.4, 0.85, 0.42))


def plastic(name, colour, rough=0.4):
    return kit.worn_metal(name, colour, 0.0, rough, wear=0.0, grime=0.3, scale=0.05)


def build_cartridge(M, lift, L):
    tip = Vector((L, 0, -100))
    shell = Batch()
    shell.box((L - 48, 0, -14), (120, 80, 8))                              # headshell plate
    shell.cyl((L - 98, 0, -6), 24, 26, rot=(0, math.pi / 2, 0), segs=64)   # collar onto the arm tube
    shell.emit("Headshell", M["satin"], lift, bevel=1.2)
    kit.tube("Finger lift", [(L - 20, 40, -12), (L - 2, 56, -9), (L + 10, 70, 2), (L + 14, 78, 14)], 3.2,
             M["satin"], parent=lift)
    body = Batch()
    body.box((L - 46, 0, -49), (70, 60, 62))                               # cartridge body
    body.box((L - 38, 0, -84), (28, 40, 16))                               # stylus housing seat
    body.emit("Cartridge body", M["black"], lift, bevel=3.0)
    Batch().box((L - 38, 0, -84.5), (24, 36, 14)).emit("Stylus housing", M["satin"], lift, bevel=1.5)
    Batch().box((L - 46, 30.6, -46), (58, 1.6, 36)).emit("Side plate", M["satin"], lift, bevel=0.4)
    kit.text("Engraved maker", "RFAI", (L - 46, 31.6, -52), (math.pi / 2, 0, math.pi), 15, M["black"],
             extrude=0.35, parent=lift)
    screws = Batch()
    for y in (-24, 24):
        screws.cyl((L - 50, y, -8.6), 5.0, 2.8, segs=32).cyl((L - 50, y, -34), 2.2, 48, segs=12)
        screws.cyl((L - 50, y, -19.5), 4.2, 3.0, segs=6)                   # nut under the shell
    pins = ((-9, -38), (9, -38), (-9, -58), (9, -58))
    for y, z in pins:
        screws.cyl((L - 83, y, z), 1.4, 6, rot=(0, math.pi / 2, 0), segs=12)   # terminal pins
    screws.emit("Screws + terminal pins", M["brass"], lift, smooth=True)
    for (y, z), colour in zip(pins, LEAD_COLOURS):
        kit.tube(f"Lead {colour}", [(L - 86, y, z), (L - 96, y * 1.4, z + 12), (L - 104, y * 0.8, -12)], 0.9,
                 plastic(f"Lead insulation {colour}", colour), parent=lift)
    # the cantilever leaves the stylus housing and drops ~17 degrees to the diamond
    root, end = Vector((L - 24, 0, -91)), tip + Vector((0, 0, 1.9))
    v = end - root
    rot = v.to_track_quat("Z", "Y").to_euler()
    Batch().cyl(tuple((root + end) / 2), 0.85, v.length, rot=rot, segs=24, r2=0.6).emit(
        "Cantilever", M["satin"], lift, smooth=True)
    Batch().cyl(tuple(root + v.normalized() * 1.2), 2.0, 2.4, rot=rot, segs=24).emit(
        "Cantilever damper", plastic("Damper rubber", (0.35, 0.04, 0.03), 0.6), lift, smooth=True)
    stylus = Batch().cyl(tuple(tip + Vector((0, 0, 1.45))), 0.3, 0.9, segs=6)          # shank
    stylus.cyl(tuple(tip + Vector((0, 0, 0.5))), 0.3, 1.0, r2=0.0, segs=6, rot=(math.pi, 0, 0))
    stylus.emit("Diamond", M["diamond"], lift, smooth=True)


def build_carousel(M, R):
    radius, n, disc = 1.22 * R, 60, 0.1 * R
    centre_z = disc - 8
    records, cradles, pins, lamps = Batch(), Batch(), Batch(), Batch()
    labels = [Batch() for _ in LABEL_COLOURS]
    for k in range(n):
        slot = Matrix.Rotation(math.tau * k / n, 4, "Z") @ Matrix.Translation((radius, 0, 0))
        face = slot @ Matrix.Translation((0, 0, centre_z)) @ Matrix.Rotation(math.pi / 2, 4, "X")
        records.cyl((0, 0, 0), disc, 4.0, segs=96, matrix=face)
        labels[k % len(LABEL_COLOURS)].cyl((0, 0, 0), 0.4 * disc, 4.3, segs=48, matrix=face)
        pins.cyl((0, 0, 0), 3.2, 15.0, segs=24, matrix=face)                # pivot pin through the spindle hole
        for side in (-1, 1):                                                # the U-cradle's two arms
            cradles.box((0, side * 6.5, centre_z / 2 - 6), (5.0, 2.4, centre_z + 12), matrix=slot)
        cradles.box((0, 0, -12), (disc * 2.1, 16, 6), matrix=slot)           # shoe riding the rails
        lamps.sphere((disc * 0.95, 8.5, -8.5), 1.1, segs=10, matrix=slot)
    records.emit("Carousel records", M["vinyl"], smooth=True)
    for batch, colour in zip(labels, LABEL_COLOURS):
        batch.emit("Carousel labels", kit.glow(f"Label paper {colour}", colour, 0.35))
    pins.emit("Carousel pivot pins", M["brass"], smooth=True)
    cradles.emit("Carousel cradles", M["iron"], bevel=0.6)
    lamps.emit("Carousel slot lamps", M["amber"], smooth=True)
    track = Batch()
    for r in (radius - 46, radius + 46):
        track.ring(r - 4, r + 4, 5, z=-17.5, segs=720)
    track.ring(radius - 60, radius - 52, 6, z=-24, teeth=360, tooth=3.0, inward=True)   # index ring gear
    track.emit("Carousel rails + index ring", M["iron"], bevel=0.5)
    drive_at = Matrix.Rotation(math.radians(205), 4, "Z") @ Matrix.Translation((radius - 72, 0, -24))
    drive = Batch().ring(4, 14, 6, teeth=24, tooth=3.0, matrix=drive_at)
    drive.cyl((0, 0, 0), 9, 40, rot=(0, math.pi / 2, 0), segs=48, matrix=drive_at @ Matrix.Translation((-26, 0, 0)))
    drive.box((0, 0, 0), (18, 22, 20), matrix=drive_at @ Matrix.Translation((-4, 0, -14)))
    drive.emit("Carousel index drive", M["black"], bevel=0.8)

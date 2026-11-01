"""Functional detail for the platter drive: the parts that explain how it works.

The drive train reads from the outside in: four gearmotors on the stator ring
turn shafts through pillow blocks and couplings into right-angle gearboxes on
the planet axles. Brake calipers pull through rods and bell cranks; conduit
rings carry their lines. Behind the drive a second flywheel and two gear trains
turn in the dark; in the foreground a pipe bridge, valves and gauges give the
walkway a near layer. Everything that turns follows the shared drive angle.
"""
import math

from mathutils import Matrix, Vector

import kit
from kit import Batch

PLANET_R = 23.0
SHAFT_Z = 7.6


def _polar(r, a, z):
    return Vector((r * math.cos(a), r * math.sin(a), z))


def build_drivetrain(M, root, drive, planet_angles, planet_ratio):
    housings, caps, couplings = Batch(), Batch(), Batch()
    for i, a in enumerate(planet_angles):
        rot = Matrix.Rotation(a, 4, "Z")
        local = lambda x, y, z: rot @ Matrix.Translation((x, y, z))
        # gearmotor: finned drum, gearbox, terminal box
        housings.cyl((0, 0, 0), 2.9, 7.0, rot=(0, math.pi / 2, 0), segs=48, matrix=local(47.0, 0, SHAFT_Z))
        for k in range(9):
            housings.ring(2.9, 3.5, 0.22, segs=48,
                          matrix=local(44.2 + k * 0.7, 0, SHAFT_Z) @ Matrix.Rotation(math.pi / 2, 4, "Y"))
        housings.box((0, 0, 0), (4.4, 5.2, 5.0), matrix=local(41.4, 0, SHAFT_Z))
        housings.box((0, 0, 0), (2.4, 2.0, 1.6), matrix=local(47.0, 0, SHAFT_Z + 3.6))
        caps.cyl((0, 0, 0), 1.6, 0.5, rot=(0, math.pi / 2, 0), segs=32, matrix=local(39.0, 0, SHAFT_Z))
        # pillow blocks on the carrier strut, a flexible coupling between them
        for r in (35.0, 29.0):
            housings.box((0, 0, 0), (2.0, 2.6, 2.2), matrix=local(r, 0, SHAFT_Z - 0.5))
            caps.cyl((0, 0, 0), 1.0, 2.2, rot=(0, math.pi / 2, 0), segs=24, matrix=local(r, 0, SHAFT_Z))
            for s in (-1, 1):
                caps.cyl((0, 0, 0), 0.22, 0.5, segs=6, matrix=local(r, s * 0.95, SHAFT_Z + 0.75))
        couplings.cyl((0, 0, 0), 1.25, 0.7, rot=(0, math.pi / 2, 0), segs=40, matrix=local(32.0, 0, SHAFT_Z))
        # right-angle gearbox on the planet axle
        housings.box((0, 0, 0), (3.6, 3.6, 3.0), matrix=local(PLANET_R, 0, SHAFT_Z - 0.6))
        caps.cyl((0, 0, 0), 1.3, 0.3, segs=32, matrix=local(PLANET_R, 0, SHAFT_Z + 0.95))
        caps.cyl((0, 0, 0), 0.7, 2.6, segs=24, matrix=local(PLANET_R, 0, 5.6))
        # the shaft itself turns about its own length
        shaft = Batch().cyl((0, 0, 0), 0.55, 15.0, rot=(0, math.pi / 2, 0), segs=24)
        for x in (-6.0, 6.0):
            shaft.cyl((x, 0, 0), 0.75, 0.5, rot=(0, math.pi / 2, 0), segs=6)
        obj = shaft.emit(f"Planet drive shaft {i + 1}", M["chrome"], root, bevel=0.03)
        obj.rotation_mode = "ZYX"
        obj.location = tuple(_polar(32.0, a, SHAFT_Z))
        obj.rotation_euler = (0, 0, a)
        kit.follow(obj, drive, planet_ratio * 1.7, axis=0)
    housings.emit("Gearmotors + pillow blocks", M["gunmetal"], root, bevel=0.1)
    caps.emit("Bearing caps + axles", M["brass"], root, smooth=True, bevel=0.04)
    couplings.emit("Flexible couplings", M["iron"], root, bevel=0.08)


def build_brake_linkage(M, root):
    rods, cranks, lines = Batch(), Batch(), Batch()
    for k in range(16):
        a = math.tau * k / 16 + math.radians(11.25)
        start, end = _polar(37.4, a, 5.0), _polar(40.8, a, 6.2)
        d = end - start
        rods.cyl(tuple((start + end) / 2), 0.18, d.length, rot=d.to_track_quat("Z", "Y").to_euler(), segs=8)
        m = Matrix.Rotation(a, 4, "Z") @ Matrix.Translation((41.2, 0, 6.2))
        cranks.box((0, 0, 0), (1.2, 1.8, 0.5), matrix=m).cyl((0, 0.7, 0.4), 0.3, 0.6, segs=12, matrix=m)
    for r, z in ((39.1, 2.3), (39.8, 2.5), (40.5, 2.3)):
        lines.ring(r - 0.22, r + 0.22, 0.44, z=z, segs=240)
    for k in range(48):
        m = Matrix.Rotation(math.tau * k / 48, 4, "Z") @ Matrix.Translation((39.8, 0, 2.5))
        cranks.box((0, 0, 0), (2.4, 0.5, 1.0), matrix=m)
    rods.emit("Brake pull rods", M["chrome"], root, smooth=True)
    cranks.emit("Bell cranks + conduit clamps", M["gunmetal"], root, bevel=0.05)
    lines.emit("Conduit rings", M["iron"], root, smooth=True)


def build_neon(M, root):
    """Neon in housings, segmented: lines of light, not glowing hoops."""
    tubes, channels = Batch(), Batch()
    for radius, z, count, span in ((37.8, 2.4, 24, 0.17), (25.55, -1.9, 16, 0.22)):
        for k in range(count):
            a0 = math.tau * k / count
            for s in range(3):
                p, q = _polar(radius, a0 + span * s / 3, z), _polar(radius, a0 + span * (s + 1) / 3, z)
                d = q - p
                tubes.cyl(tuple((p + q) / 2), 0.16, d.length, rot=d.to_track_quat("Z", "Y").to_euler(), segs=8)
            channels.box((0, 0, 0), (0.9, span * radius + 1.0, 0.5),
                         matrix=Matrix.Rotation(a0 + span / 2, 4, "Z") @ Matrix.Translation((radius, 0, z - 0.3)))
    tubes.emit("Neon tubes", M["magenta"], root)
    channels.emit("Neon channels", M["gunmetal"], root, bevel=0.04)


def build_background(M, drive):
    """A second flywheel and two gear trains behind the drive, turning in the backlight."""
    fly = kit.empty("Rear flywheel", (0, 82, 26), (math.radians(90), 0, 0))
    wheel = Batch().ring(40.0, 46.0, 5.0, segs=200).cyl((0, 0, 0), 6.0, 7.0, segs=64)
    for k in range(8):
        b = math.tau * k / 8
        wheel.ibeam(_polar(6.0, b, 0), _polar(40.0, b, 0), h=3.0, w=2.0, t=0.35)
    kit.follow(wheel.emit("Rear flywheel rim + spokes", M["gunmetal"], fly, bevel=0.15), drive, -0.21)
    for side in (-1, 1):
        train = kit.empty(f"Upper gear train {side:+d}", (side * 58, 66, 60), (math.radians(90), 0, 0))
        big = Batch().ring(9.0, 15.0, 3.0, teeth=96, tooth=0.9).cyl((0, 0, 0), 3.0, 5.0, segs=40)
        for k in range(6):
            b = math.tau * k / 6
            big.ibeam(_polar(3.0, b, 0), _polar(9.0, b, 0), h=1.6, w=1.0, t=0.2)
        kit.follow(big.emit(f"Upper gear 96T {side:+d}", M["blued"], train, bevel=0.06), drive, side * 0.4)
        pin = Batch().ring(1.5, 4.6, 3.0, teeth=30, tooth=0.9).cyl((0, 0, 0), 1.5, 9.0, segs=24)
        p = pin.emit(f"Upper pinion 30T {side:+d}", M["steel"], train, bevel=0.04)
        p.location = (side * -20.5, -6.0, 0)
        kit.follow(p, drive, -side * 0.4 * 96 / 30, phase=math.pi / 30)
        Batch().cyl((0, 0, -6.0), 1.2, 12.0, segs=24).emit(f"Upper shaft {side:+d}", M["chrome"], train).location = (
            side * -20.5, -6.0, 0)


def build_foreground(M):
    """Near layer along the walkway: pipe bridges, valve stands and gauge boxes."""
    pipes, metal, gauges = Batch(), Batch(), Batch()
    for y in (-48.0,):
        for z, r in ((9.0, 0.9), (10.9, 0.6)):
            pipes.cyl((0, y, z), r, 48.0, rot=(0, math.pi / 2, 0), segs=32)
            for x in range(-22, 23, 6):
                pipes.cyl((x, y, z), r + 0.22, 0.4, rot=(0, math.pi / 2, 0), segs=32)
        for x in (-15.0, 15.0):
            metal.ibeam((x, y, 0.0), (x, y, 12.0), h=0.6, w=0.4).box((x, y, 11.9), (1.2, 1.2, 0.3))
    for y in range(-80, 10, 15):
        for side in (-2.6, 2.6):
            metal.cyl((side, y, 3.0), 0.2, 6.0, segs=12)
            metal.ring(0.42, 0.55, 0.08, segs=24,
                       matrix=Matrix.Translation((side, y, 1.6)) @ Matrix.Rotation(math.pi / 2, 4, "Y"))
        right = (y // 15) % 2 == 0
        box = Matrix.Translation((2.3 if right else -2.3, y + 6, 1.35))
        metal.box((0, 0, 0), (0.5, 0.9, 1.1), matrix=box)
        gauges.cyl((0, 0, 0), 0.28, 0.06, rot=(0, math.pi / 2, 0), segs=24,
                   matrix=box @ Matrix.Translation((-0.27 if right else 0.27, 0, 0.15)))
    pipes.emit("Pipe bridges", M["teal"], bevel=0.03)
    metal.emit("Valve stands + gauge boxes", M["gunmetal"], bevel=0.02)
    gauges.emit("Gauge faces", M["gauge"])

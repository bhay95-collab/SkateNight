"""HERO SHOT A: the platter drive megastructure.

    blender -b --python cinematic/hero_megastructure.py -- --shot hero --w 1920 --h 1080 --samples 256
    blender -b --python cinematic/hero_megastructure.py -- --shot motion --w 1280 --h 720 --samples 32

The machine is a working planetary gearbox: a motor-driven sun gear (128 T)
turns four planets (36 T) on a fixed carrier, which turn the internal ring
gear (200 T) bolted to the platter flywheel. Tooth phases are aligned and the
angular speeds follow the tooth ratios, so the teeth mesh in motion.
Units are metres; the walkway rail is 1.1 m tall, the outer coil ring 100 m across.
"""
import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import drive_detail  # noqa: E402
import kit  # noqa: E402
from kit import Batch  # noqa: E402

C = Vector((0, 48, 26))                       # drive axis centre (world)
N_SUN, N_PLANET, N_RING = 128, 36, 200
SUN_SPEED = 0.010                              # rad / frame at 60 fps (~5.7 rpm)
PLANET_ANGLES = [math.radians(45 + 90 * i) for i in range(4)]
PLANET_R = 23.0
AMBER, CYAN, MAGENTA, BLUE = (1.0, 0.52, 0.12), (0.18, 0.85, 1.0), (1.0, 0.12, 0.55), (0.25, 0.45, 1.0)


def materials():
    return {
        "lacquer": kit.worn_metal("Black lacquer steel", (0.012, 0.014, 0.018), 0.35, 0.32, wear=0.22,
                                  wear_color=(0.42, 0.40, 0.38), coat=0.4, scale=0.4),
        "iron": kit.worn_metal("Cast iron", (0.035, 0.034, 0.033), 0.85, 0.55, wear=0.15, scale=0.6),
        "steel": machined_steel(),
        "blued": kit.worn_metal("Blued steel", (0.05, 0.07, 0.1), 1.0, 0.26, wear=0.12, wear_color=(0.5, 0.5, 0.52),
                                grime=0.5),
        "chrome": kit.worn_metal("Chrome shafting", (0.78, 0.79, 0.8), 1.0, 0.07, wear=0.0, grime=0.2),
        "gunmetal": kit.worn_metal("Gunmetal housings", (0.1, 0.105, 0.11), 1.0, 0.36, wear=0.18,
                                   wear_color=(0.5, 0.5, 0.5), grime=0.75, scale=0.7),
        "teal": kit.worn_metal("Teal enamel", (0.012, 0.045, 0.05), 0.2, 0.38, wear=0.3, scale=0.5),
        "brass": kit.worn_metal("Worn brass", (0.55, 0.36, 0.12), 1.0, 0.28, wear=0.15,
                                wear_color=(0.8, 0.62, 0.3)),
        "copper": copper_windings(),
        "ceramic": kit.worn_metal("Glazed insulator", (0.45, 0.33, 0.24), 0.0, 0.18, wear=0.0, grime=0.5),
        "grate": kit.worn_metal("Deck grating", (0.05, 0.05, 0.048), 0.8, 0.5, wear=0.35, scale=2.0),
        "amber": kit.glow("Amber pilot lamp", AMBER, 40),
        "cyan": kit.glow("Cyan bearing glow", CYAN, 0.9),
        "dial": kit.glow("Phosphor dial", CYAN, 0.16),
        "gauge": kit.glow("Gauge face", (1.0, 0.75, 0.45), 1.2),
        "magenta": kit.glow("Magenta neon", MAGENTA, 9),
        "tube": kit.glow("Cold fluorescent", (0.6, 0.85, 1.0), 3),
        "warm": kit.glow("Sodium lamp", (1.0, 0.7, 0.4), 20),
    }


def machined_steel():
    """Bright turned steel: lathe rings, clean faces, oil in the corners only."""
    mat = kit.worn_metal("Machined steel", (0.58, 0.60, 0.63), 1.0, 0.31, wear=0.0, grime=0.12)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes["Map Range"].inputs["To Min"].default_value = 0.28
    nodes["Map Range"].inputs["To Max"].default_value = 0.36
    rings = nodes.new("ShaderNodeTexWave")
    rings.wave_type = "RINGS"
    rings.rings_direction = "Z"
    rings.inputs["Scale"].default_value = 2.2
    bump = nodes["Bump"]
    bump.inputs["Strength"].default_value = 0.045
    links.new(nodes["Texture Coordinate"].outputs["Object"], rings.inputs["Vector"])
    links.new(rings.outputs["Fac"], bump.inputs["Height"])
    return mat


def copper_windings():
    mat = kit.worn_metal("Copper windings", (0.6, 0.25, 0.1), 1.0, 0.3, wear=0.05,
                         wear_color=(0.15, 0.08, 0.04), scale=0.8)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    wave = nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 9
    wave.bands_direction = "Z"
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    links.new(nodes["Texture Coordinate"].outputs["Object"], wave.inputs["Vector"])
    links.new(wave.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], nodes["Principled BSDF"].inputs["Normal"])
    return mat


# ----------------------------------------------------------------- the drive

def build_drive(M):
    root = kit.empty("Platter drive", C, (math.radians(90), 0, 0))   # local +Z faces the camera
    drive = kit.empty("Drive angle (sun gear)")                        # every gear follows this one angle
    kit.spin(drive, SUN_SPEED)
    tip_on_zero = lambda n: -math.tau * 0.375 / n
    tooth_ring = tip_on_zero(N_RING) + PLANET_ANGLES[0]
    tooth_sun = tip_on_zero(N_SUN) + PLANET_ANGLES[0]

    sun = Batch().ring(9.0, 17.3, 3.0, z=1.5, teeth=N_SUN, tooth=1.0)
    sun.ring(5.0, 9.0, 2.2, z=1.6).cyl((0, 0, 2.5), 3.0, 3.0, segs=48)
    kit.follow(sun.emit("Sun gear 128T", M["steel"], root, bevel=0.06), drive, 1.0, phase=tooth_sun)
    races = Batch()
    for r in (11.0, 14.0):
        races.ring(r - 0.25, r + 0.25, 0.5, z=3.25, segs=160)
    races.radial(48, 12.5, lambda m, a: races.cyl((0, 0, 3.3), 0.22, 0.5, segs=6, matrix=m))
    kit.follow(races.emit("Sun bearing races", M["brass"], root, bevel=0.03), drive, 1.0, phase=tooth_sun)

    for i, a in enumerate(PLANET_ANGLES):
        loc = (PLANET_R * math.cos(a), PLANET_R * math.sin(a), 0)
        p = Batch().ring(2.6, 4.6, 3.0, z=1.5, teeth=N_PLANET, tooth=0.9)
        p.ring(1.0, 2.6, 2.0, z=1.5, segs=48)
        for k in range(6):
            b = math.tau * k / 6
            p.cyl((3.6 * math.cos(b), 3.6 * math.sin(b), 1.5), 0.55, 3.2, segs=16)
        planet = p.emit(f"Planet {i + 1} 36T", M["blued"], root, bevel=0.05)
        planet.location = loc
        kit.follow(planet, drive, -N_SUN / N_PLANET, phase=a - math.tau * 0.875 / N_PLANET)
        Batch().cyl((0, 0, 3.4), 1.05, 0.5, segs=40).emit(f"Planet {i + 1} bearing glow", M["cyan"], root).location = loc
        hub = Batch().ring(1.05, 1.9, 1.4, z=3.6, segs=48)
        hub.radial(10, 1.5, lambda m, _a: hub.cyl((0, 0, 4.4), 0.14, 0.3, segs=6, matrix=m))
        hub.emit(f"Planet {i + 1} axle cap", M["brass"], root, bevel=0.03).location = loc

    rg = Batch().ring(28.7, 33.0, 3.5, z=1.5, teeth=N_RING, tooth=1.0, inward=True)
    rg.ring(26.0, 33.0, 1.6, z=-3.0, segs=200)
    for k in range(10):
        b = math.tau * k / 10
        rg.ibeam((8.5 * math.cos(b), 8.5 * math.sin(b), -3.0), (26.5 * math.cos(b), 26.5 * math.sin(b), -3.0),
                 h=2.0, w=1.4, t=0.25)
    rg.cyl((0, 0, -3.0), 8.5, 2.4, segs=64)
    rg.radial(100, 31.0, lambda m, _a: rg.cyl((0, 0, 3.35), 0.3, 0.45, segs=6, matrix=m))
    kit.follow(rg.emit("Ring gear 200T + platter flywheel", M["lacquer"], root, bevel=0.07),
               drive, -N_SUN / N_RING, phase=tooth_ring)

    frame = Batch().ring(34.0, 37.5, 4.0, z=0.5, segs=220).ring(38.0, 50.5, 2.0, z=-4.5, segs=220)
    frame.radial(120, 35.75, lambda m, _a: frame.cyl((0, 0, 2.6), 0.32, 0.4, segs=6, matrix=m))
    frame.radial(144, 49.6, lambda m, _a: frame.cyl((0, 0, -3.3), 0.3, 0.5, segs=6, matrix=m), phase=0.01)
    for a in PLANET_ANGLES:
        u = Vector((math.cos(a), math.sin(a), 0))
        frame.ibeam(u * PLANET_R + Vector((0, 0, 4.6)), u * 36.0 + Vector((0, 0, 4.6)), h=2.4, w=1.6, t=0.3)
        frame.ibeam(u * 36.0 + Vector((0, 0, 4.6)), u * 36.0 + Vector((0, 0, 0.5)), h=2.4, w=1.6, t=0.3)
    for k in range(8):
        u = Vector((math.cos(math.tau * k / 8 + math.tau / 16), math.sin(math.tau * k / 8 + math.tau / 16), 0))
        frame.ibeam(u * 50.0 + Vector((0, 0, -4.5)), u * 120.0 + Vector((0, 0, -10)), h=3.5, w=2.2, t=0.4)
    frame.emit("Drive frame + carrier", M["teal"], root, bevel=0.08)

    coils, cores = Batch(), Batch()
    for k in range(36):
        m = Matrix.Rotation(math.tau * k / 36, 4, "Z") @ Matrix.Translation((44.2, 0, -1.6))
        coils.box((0, 0, 0), (7.4, 4.6, 3.4), matrix=m)
        cores.box((0, 0, 0.4), (8.6, 2.2, 3.4), matrix=m).box((-4.5, 0, 0.6), (0.6, 5.4, 4.2), matrix=m)
    coils.emit("Stator coils", M["copper"], root, bevel=0.5)
    cores.emit("Stator cores", M["iron"], root, bevel=0.08)

    build_auxiliaries(M, root)
    drive_detail.build_drivetrain(M, root, drive, PLANET_ANGLES, -N_SUN / N_PLANET)
    drive_detail.build_brake_linkage(M, root)
    drive_detail.build_neon(M, root)
    lamps = Batch()
    lamps.radial(96, 51.6, lambda m, _a: lamps.sphere((0, 0, -3.4), 0.32, matrix=m))
    lamps.emit("Pilot lamp chain", M["amber"], root, smooth=True)

    motor = Batch().cyl((0, 0, 10.0), 8.2, 13.0, segs=96)
    for k in range(16):
        motor.ring(8.2, 10.2, 0.32, z=4.5 + k * 0.62, segs=96)
    motor.ring(6.4, 9.0, 1.4, z=16.8, segs=96)
    motor.radial(32, 7.7, lambda m, _a: motor.cyl((0, 0, 17.6), 0.26, 0.5, segs=6, matrix=m))
    motor.emit("Drive motor housing", M["lacquer"], root, bevel=0.05)
    Batch().cyl((0, 0, 17.0), 6.4, 0.6, segs=96).emit("Phosphor dial", M["dial"], root)
    needle = Batch().box((0, 2.4, 0), (0.22, 4.8, 0.12)).cyl((0, 0, 0), 0.5, 0.3, segs=24)
    needle = needle.emit("Dial needle", M["warm"], root)
    needle.location = (0, 0, 17.65)
    needle.rotation_euler = (0, 0, math.radians(120))
    ticks = Batch()
    ticks.radial(60, 5.7, lambda m, a: ticks.box(
        (0, 0, 17.4), (0.9 if round(a / (math.tau / 60)) % 5 == 0 else 0.45, 0.12, 0.2), matrix=m))
    ticks.cyl((0, 0, 17.5), 1.2, 0.5, segs=32).emit("Dial graduations", M["iron"], root)
    kit.text("Drive plate", "PLATTER DRIVE  08", (0, 41.2, 3.0), (0, 0, 0), 3.2, M["brass"], 0.15, root)
    kit.text("Drive warning", "HIGH INERTIA  ·  KEEP CLEAR", (0, -42.4, 3.0), (0, 0, math.pi), 1.6, M["brass"], 0.1, root)
    return root, drive


def build_auxiliaries(M, root):
    """Brake calipers on the frame ring and the stator's power feeds into the dark."""
    calipers, pistons, status = Batch(), Batch(), Batch()
    for k in range(16):
        a = math.tau * k / 16 + math.radians(11.25)
        m = Matrix.Rotation(a, 4, "Z") @ Matrix.Translation((36.2, 0, 3.6))
        calipers.box((0, 0, 0), (3.2, 4.6, 2.6), matrix=m).box((0, 0, 1.6), (1.6, 3.0, 0.8), matrix=m)
        for side in (-1.3, 1.3):
            pistons.cyl((1.9, side, 0.2), 0.55, 2.6, rot=(0, math.pi / 2, 0), segs=20, matrix=m)
        status.sphere((-1.2, 1.8, 1.45), 0.22, segs=10, matrix=m)
    calipers.emit("Brake calipers", M["iron"], root, bevel=0.12)
    pistons.emit("Caliper pistons", M["brass"], root, smooth=True)
    status.emit("Caliper status lamps", M["amber"], root, smooth=True)
    for k in range(14):
        a = math.tau * k / 14 + 0.12
        u = Vector((math.cos(a), math.sin(a), 0))
        start, end = u * 47.0 + Vector((0, 0, -6.5)), u * 110.0 + Vector((0, 0, -22))
        pts = [tuple(start.lerp(end, t) - Vector((0, 14 * 4 * t * (1 - t), 0))) for t in (i / 30 for i in range(31))]
        for j, r in enumerate((0.55, 0.38)):
            off = Vector((0, 0, j * 1.3))
            kit.tube(f"Stator feed {k}/{j}", [tuple(Vector(p) + off) for p in pts], r,
                     M["iron"] if j == 0 else M["copper"], parent=root)


# ----------------------------------------------------------------- the hall

def build_bay(M, variant):
    col = bpy.data.collections.new(f"Bay variant {variant}")
    bpy.context.scene.collection.children.link(col)
    struct, deck, equip, cu, glow, cer = Batch(), Batch(), Batch(), Batch(), Batch(), Batch()
    struct.ibeam((0, 0, -46), (0, 0, 74), h=1.4, w=1.0).ibeam((16, 0, -46), (16, 0, 74), h=1.4, w=1.0)
    for z in (0, 16, 32, 48, 64):
        deck.box((2.6, 5, z - 0.15), (5.2, 10, 0.3))
        struct.ibeam((0, 0, z - 0.6), (16, 0, z - 0.6), h=1.0, w=0.6)
        for y in (0, 2.5, 5, 7.5):
            struct.box((0.1, y, z + 0.55), (0.08, 0.08, 1.1))
        struct.box((0.1, 5, z + 1.1), (0.1, 10, 0.08)).box((0.1, 5, z + 0.55), (0.06, 10, 0.06))
        glow.box((2.4, 5, z - 0.75), (0.16, 6.5, 0.16))
        struct.box((2.4, 5, z - 0.6), (0.6, 7, 0.12))
    if variant == 0:
        equip.box((11, 5, 6.5), (6, 8, 13))
        for k in range(14):
            equip.box((7.75, 1.6 + k * 0.52, 6.5), (0.5, 0.08, 11))
        for y in (2.8, 5, 7.2):
            for s in range(7):
                cer.cyl((11, y, 13.4 + s * 0.42), 0.75 - (s % 2) * 0.2, 0.22, segs=24)
            equip.cyl((11, y, 16.4), 0.22, 0.9, segs=12)
        for y in (1.8, 4.2, 6.6, 9.0):
            cu.cyl((10, y, 20.5), 1.0, 7.5, segs=32).cyl((10, y, 24.4), 0.4, 0.3, segs=12)
        equip.box((12, 5, 40), (8, 9, 7))
        for y in (2.6, 5, 7.4):
            dial = Matrix.Translation((7.95, y, 40.6)) @ Matrix.Rotation(math.pi / 2, 4, "Y")
            glow.cyl((0, 0, 0), 0.85, 0.06, segs=40, matrix=dial)
            equip.ring(0.85, 1.05, 0.16, segs=40, matrix=dial)
    else:
        equip.cyl((11, 5, 5.5), 3.6, 9.0, rot=(math.pi / 2, 0, 0), segs=64)
        for k in range(10):
            equip.ring(3.6, 4.4, 0.25, segs=64,
                       matrix=Matrix.Translation((11, 1.4 + k * 0.8, 5.5)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
        cu.cyl((11, 5, 5.5), 1.2, 11.0, rot=(math.pi / 2, 0, 0), segs=24)
        for y in (1.6, 4.0, 6.4, 8.8):
            equip.box((11.5, y, 23), (7, 2.2, 13)).box((7.9, y, 26), (0.3, 0.5, 1.4))
            for s in range(4):
                glow.sphere((7.95, y - 0.6 + s * 0.4, 28.5), 0.11, segs=8)
        equip.box((12, 5, 56), (6, 9, 10))
    struct.emit(f"Bay {variant} structure", M["teal"], collection=col, bevel=0.03)
    deck.emit(f"Bay {variant} decks", M["grate"], collection=col)
    equip.emit(f"Bay {variant} equipment", M["lacquer"], collection=col, bevel=0.06)
    cu.emit(f"Bay {variant} capacitors", M["copper"] if variant == 0 else M["brass"], collection=col, bevel=0.05)
    glow.emit(f"Bay {variant} lamps", M["tube"] if variant == 0 else M["amber"], collection=col)
    if cer.bm.verts:
        cer.emit(f"Bay {variant} insulators", M["ceramic"], collection=col, smooth=True)
    bpy.context.view_layer.layer_collection.children[col.name].exclude = True
    return col


def build_hall(M):
    bays = [build_bay(M, 0), build_bay(M, 1)]
    for side in (1, -1):
        for i in range(11):
            inst = bpy.data.objects.new(f"Bay {side:+d}/{i}", None)
            inst.instance_type = "COLLECTION"
            inst.instance_collection = bays[(i + (side > 0)) % 2]
            inst.location = (24 * side, -96 + i * 10, 0)
            inst.scale = (side, 1, 1)
            bpy.context.scene.collection.objects.link(inst)

    walk, rail, lamps = Batch(), Batch(), Batch()
    walk.box((0, -35, -0.08), (3.2, 120, 0.16)).box((0, 27, -0.08), (16, 12, 0.16))
    for k in range(200):
        walk.box((0, -95 + k * 0.6, -0.25), (3.2, 0.06, 0.3))
    for y in range(-95, 25, 12):
        walk.ibeam((0, y, -0.4), (0, y, -46), h=0.9, w=0.6).ibeam((-1.6, y, -0.4), (1.6, y, -0.4), h=0.5, w=0.3)
    for side in (-1.55, 1.55):
        for k in range(48):
            rail.box((side, -95 + 2.5 * k, 0.55), (0.07, 0.07, 1.1))
        rail.box((side, -35, 1.1), (0.08, 120, 0.08)).box((side, -35, 0.55), (0.05, 120, 0.05))
        for y in range(-92, 20, 10):
            lamps.sphere((side, y, 1.25), 0.09, segs=10)
    walk.emit("Walkway deck", M["grate"], bevel=0.01)
    rail.emit("Walkway railings", M["brass"])
    lamps.emit("Walkway pilot lamps", M["amber"], smooth=True)
    for y in range(-92, 20, 20):
        kit.light("POINT", f"Walkway lamp {y}", (1.55, y, 1.3), AMBER, 6, size=0.05)

    roof, shades, sod = Batch(), Batch(), Batch()
    for y in range(-96, 20, 10):
        roof.ibeam((-40, y, 74), (40, y, 74), h=2.0, w=1.0).ibeam((-40, y, 70), (40, y, 70), h=1.2, w=0.8)
        for x in range(-40, 40, 8):
            roof.ibeam((x, y, 70), (x + 8, y, 74), h=0.5, w=0.4)
    for i, y in enumerate(range(-90, 20, 15)):
        x = 11 if i % 2 else -11
        shades.cyl((x, y, 31), 1.4, 1.2, segs=32, r2=0.35).cyl((x, y, 47), 0.08, 31, segs=6)
        sod.cyl((x, y, 30.35), 1.1, 0.1, segs=32)
        kit.light("SPOT", f"High bay {y}", (x, y, 30.2), (1.0, 0.72, 0.45), 2500, target=(0, y + 4, 0),
                  size=0.9, spot=34, blend=0.5)
    roof.emit("Roof trusses", M["teal"])
    shades.emit("High-bay lamp shades", M["iron"])
    sod.emit("High-bay lamp glass", M["warm"])
    pit = Batch()
    for x in (-13, -7, 7, 13):
        pit.cyl((x, -35, -40), 1.6, 120, rot=(math.pi / 2, 0, 0), segs=32)
    pit.box((0, -35, -46), (60, 130, 1)).emit("Pit conduits", M["iron"])
    for x, sag, r in ((-8, 9, 0.35), (-6, 12, 0.25), (5, 10, 0.4), (8, 14, 0.3), (-3, 7, 0.2)):
        for y in range(-96, 10, 20):
            kit.tube(f"Cable {x}/{y}", kit.catenary((x, y, 69), (x + 2, y + 20, 69), sag), r,
                     M["copper"] if r < 0.3 else M["iron"])


def build_lights(variant):
    lit = variant != "dormant"
    lights = {}
    lights["back"] = kit.light("SPOT", "Backlight through the drive", (0, 120, 70), (0.25, 0.6, 1.0), 9.0e5 if lit else 0,
              target=(0, 0, 18), size=6, spot=55, blend=0.6)
    lights["rim"] = kit.light("AREA", "Drive rim cyan", (0, 78, 30), (0.2, 0.7, 1.0), 1.8e4 if lit else 0, target=(0, 40, 26), size=80)
    lights["kicker"] = kit.light("SPOT", "Magenta kicker", (40, 22, 46), MAGENTA, 1.5e4 if lit else 3e3, target=C,
              size=1.5, spot=30, blend=0.4)
    lights["key"] = kit.light("AREA", "Warm raking key", (-42, 6, 3), (1.0, 0.76, 0.52), 1.2e4 if lit else 0,
              target=(0, 44, 26), size=16)
    for side in (-1, 1):                                  # work floods on the gantries, raking the drive face
        lights[f"flood{side}"] = kit.light("AREA", f"Gantry flood {side:+d}", (side * 21, 12, 34), (1.0, 0.86, 0.7),
                                           2.2e4 if lit else 0, target=(side * -6, 46, 24), size=4)
    lights["up"] = kit.light("SPOT", "Amber uplight on the motor", (0, 26, 0.6), AMBER, 2.2e4 if lit else 1.8e4,
                             target=(0, 40, 30), size=0.6, spot=46, blend=0.5)
    return lights


def cameras():
    return {
        "hero": kit.camera("A1 Establishing", (-9.0, -57, 2.2), (2.0, 48, 30), 22, fstop=8, focus=108),
        "detail": kit.camera("A2 Gear mesh detail", (-1.5, 29.5, 5.0), (-13.2, 46.0, 13.6), 35, fstop=2.8, focus=21.2),
        "alt": kit.camera("A3 Gantry three-quarter", (-21.5, -3, 49.1), (6, 46, 22), 24, fstop=8, focus=60),
    }


PUSH = ((1, (-11.0, -70.0, 1.4), (-2.0, 40.0, 18.0), 28),     # low, behind the valve stands
        (150, (-4.0, -47.0, 5.2), (0.0, 46.0, 25.0), 24),       # under the pipe bridge
        (300, (6.5, -14.0, 13.0), (-1.0, 48.0, 33.0), 18))     # up and across: the drive towers overhead


def animate_push(cam, keys=PUSH, offset=0):
    """A crane push that moves past near layers so parallax reveals the depth of the drive."""
    for frame, loc, tgt, lens in keys:
        cam.location = loc
        kit.aim(cam, tgt)
        cam.data.lens = lens
        cam.keyframe_insert("location", frame=frame + offset)
        cam.keyframe_insert("rotation_euler", frame=frame + offset)
        cam.data.keyframe_insert("lens", frame=frame + offset)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--shot", default="hero", choices=("hero", "detail", "alt", "dormant", "motion", "all", "spotchecks"))
    ap.add_argument("--w", type=int, default=960)
    ap.add_argument("--h", type=int, default=540)
    ap.add_argument("--samples", type=int, default=48)
    ap.add_argument("--frame", type=int, default=120)
    ap.add_argument("--save", action="store_true")
    args = ap.parse_args(argv)

    scene = kit.fresh_scene("A - Platter drive megastructure")
    scene.cycles.volume_step_rate = 2.0
    M = materials()
    if args.shot == "dormant":                       # before the pulse: only the pilot lamps have power
        for k in ("magenta", "cyan", "dial", "gauge", "tube", "warm"):
            M[k].node_tree.nodes["Emission"].inputs["Strength"].default_value = 0.0
    _root, drive = build_drive(M)
    build_hall(M)
    drive_detail.build_background(M, drive)
    drive_detail.build_foreground(M)
    build_lights("dormant" if args.shot == "dormant" else "lit")
    kit.fog(scene, (130, 260, 140), (0, 0, 14), 0.0016, anisotropy=0.7)
    cams = cameras()
    scene.frame_start, scene.frame_end = 1, 300
    out = kit.OUT / "megastructure"
    out.mkdir(parents=True, exist_ok=True)
    if args.save:
        bpy.ops.wm.save_as_mainfile(filepath=str(out / "hero-megastructure.blend"))

    shots = ("detail", "alt") if args.shot == "spotchecks" else (
        ("hero", "detail", "alt") if args.shot == "all" else (args.shot,)
    )
    for shot in shots:
        if shot == "motion":
            animate_push(cams["hero"])
            scene.camera = cams["hero"]
            scene.render.resolution_x, scene.render.resolution_y = args.w, args.h
            scene.cycles.samples = args.samples
            scene.render.filepath = str(out / "motion" / "frame_")
            bpy.ops.render.render(animation=True)
            continue
        raw = out / f"raw-{shot}.png"
        kit.render(scene, cams["hero" if shot == "dormant" else shot], raw, args.w, args.h, args.samples, frame=args.frame)
        kit.finish_photo(raw, out / f"A-{shot}.png")
        print(f"WROTE {out / f'A-{shot}.png'}", flush=True)


if __name__ == "__main__":
    main()

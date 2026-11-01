"""The Awakening's machine beats in the platter-drive hall, for the animatic.

    blender -b --python cinematic/story_megastructure.py -- --w 480 --h 270 --samples 8

Renders film frames coinGone..toRecord-1 (cues.json) of one continuous scene:
the fall into the dark hall, the relay, the first attempt that nearly holds and
dies, the dark, the robot appearing in the motor's dial, the heartbeat lighting
the machine ring by ring, and the lock. Power follows the live cut's SUPPLY
curve; the gears follow one baked drive angle, so they creep, stall, judder back
and step forward on the heartbeat. Frame numbers are film frames.
"""
import argparse
import json
import math
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import drive_detail  # noqa: E402
import hero_megastructure as H  # noqa: E402
import kit  # noqa: E402
from frame_io import render_frame_sequence  # noqa: E402

CUES = json.loads((Path(__file__).resolve().parent / "cues.json").read_text())
F = CUES["frames"]
ROBOT = kit.ROOT / "rfai-logo.png"
SLOT_PIXEL = (944.0, 681.0)
ENTRY_PLATE_SIZE = (10.8, 6.075)
ENTRY_PLANE_CENTER = (0.0, -60.0, 30.0)


def supply(f):
    pts = CUES["supply"]["points"]
    if f <= pts[0][0]:
        return pts[0][1]
    for (f0, v0), (f1, v1) in zip(pts, pts[1:]):
        if f0 <= f <= f1:
            return v0 + (v1 - v0) * (f - f0) / max(1, f1 - f0)
    return pts[-1][1]


def flicker(f):
    """The first attempt's unsteady supply: a deterministic shimmer between attempt and failure."""
    if not F["attempt"] <= f < F["failure"] + 20:
        return 1.0
    return 0.72 + 0.28 * abs(math.sin(f * 1.7) * math.sin(f * 0.53 + 1.1))


def key(owner, path, frames_values, index=-1):
    for f, v in frames_values:
        if index >= 0:
            getattr(owner, path)[index] = v
        else:
            setattr(owner, path, v)
        owner.keyframe_insert(path, frame=f, index=index)


def animate_lights(lights, frames):
    for obj in lights.values():
        full = obj.data.energy
        key(obj.data, "energy", [(f, full * supply(f) * flicker(f)) for f in frames])
    bays = sorted((o for o in bpy.data.objects if o.name.startswith("High bay")), key=lambda o: o.location.y)
    n = len(bays)
    for i, lamp in enumerate(bays):                      # the relay slams them on near to far; they die far to near
        on, off, back = F["relay"] + 3 * i, F["failure"] + 2 * (n - i), F["heartbeats"][3] + 2 * i
        power = lamp.data.energy
        key(lamp.data, "energy", [(on - 1, 0), (on, power), (off, power), (off + 1, 0), (back, 0), (back + 1, power)])


def animate_emission(M, frames):
    def strength(mat):
        return mat.node_tree.nodes["Emission"].inputs["Strength"]
    for name in ("tube", "gauge", "warm"):
        s = strength(M[name])
        full = s.default_value
        key(s, "default_value", [(f, full * supply(f) * flicker(f)) for f in frames])
    for name, beat in (("cyan", 0), ("magenta", 1), ("amber", 2)):   # each heartbeat lights one ring further out
        s = strength(M[name])
        full = s.default_value
        b = F["heartbeats"][beat]
        standby = 0.15 * full if name == "amber" else 0.0
        before = [(f, max(standby, full * min(1, supply(f) * 1.6) * flicker(f))) for f in frames if f < F["catch"]]
        key(s, "default_value", before + [(b - 1, standby), (b, full * 1.8), (b + 12, full)])


def animate_dial(M, needle, speed):
    """The robot is in the dial: it appears on the catch and its face pulses with the heartbeat."""
    nodes, links = M["dial"].node_tree.nodes, M["dial"].node_tree.links
    img = nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(str(ROBOT))
    coord, mapping = nodes.new("ShaderNodeTexCoord"), nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1 / 11.0, 1 / 11.0, 1)
    mapping.inputs["Location"].default_value = (0.5, 0.5, 0)
    links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], img.inputs["Vector"])
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = (*H.CYAN, 1)
    links.new(img.outputs["Color"], mix.inputs[7])
    links.new(img.outputs["Alpha"], mix.inputs["Factor"])
    links.new(mix.outputs[2], nodes["Emission"].inputs["Color"])
    s = nodes["Emission"].inputs["Strength"]
    pulses = [(F["catch"] - 1, 0.0), (F["catch"], 0.0), (F["catch"] + 6, 0.6)]
    for b in F["heartbeats"] + F["lockBeats"][:4]:
        pulses += [(b - 1, 0.55), (b, 2.4), (b + 10, 0.65)]
    attempt = [(F["attempt"], 0.0), (F["almost"], 0.25), (F["failure"], 0.18), (F["failure"] + 10, 0.0)]
    key(s, "default_value", attempt + pulses)
    key(needle, "rotation_euler", [(f, math.radians(120) - min(1.0, w / H.SUN_SPEED) * math.radians(240))
                                   for f, w in speed.items()], index=2)


def drive_profile(frames):
    """Sun-gear speed (rad/frame): creep, almost, stall with backlash, heartbeat steps, the lock."""
    tooth = math.tau / H.N_SUN
    speed = {}
    for f in frames:
        w = 0.0
        if F["attempt"] <= f < F["almost"]:
            w = 0.0045 * (f - F["attempt"]) / (F["almost"] - F["attempt"])
        elif F["almost"] <= f < F["failure"]:
            w = 0.0045 + 0.001 * math.sin(f * 0.9)
        elif F["failure"] <= f < F["failure"] + 36:
            t = (f - F["failure"]) / 36
            w = 0.0045 * (1 - t) ** 2 - (0.0012 * math.sin(t * math.pi) if t > 0.6 else 0.0)   # coasts, judders back
        for b in F["heartbeats"]:                        # each beat pulls two teeth round
            if b <= f < b + 10:
                w += 2 * tooth * math.sin(math.pi * (f - b) / 10) * math.pi / 20
        if f >= F["ignite"]:
            w = H.SUN_SPEED * min(1.0, (f - F["ignite"] + 1) / 30)
        speed[f] = w
    return speed


def camera_path(name, keys):
    cam = kit.camera(name, keys[0][1], keys[0][2], keys[0][3])
    for f, loc, tgt, lens in keys:
        cam.location = loc
        kit.aim(cam, tgt)
        cam.data.lens = lens
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
        cam.data.keyframe_insert("lens", frame=f)
    return cam


def image_plane(scene, name, image_path, center, size):
    image_path = Path(image_path)
    if not image_path.is_file():
        raise FileNotFoundError(f"Missing coin-entry plate: {image_path}")
    image = bpy.data.images.load(str(image_path), check_existing=True)
    image.pack()
    width, height = size
    cx, cy, cz = center
    vertices = (
        (cx - width / 2, cy, cz - height / 2),
        (cx + width / 2, cy, cz - height / 2),
        (cx + width / 2, cy, cz + height / 2),
        (cx - width / 2, cy, cz + height / 2),
    )
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, (), ((0, 1, 2, 3),))
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop_index, uv in zip(mesh.polygons[0].loop_indices, ((0, 0), (1, 0), (1, 1), (0, 1))):
        uv_layer.data[loop_index].uv = uv
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)

    material = bpy.data.materials.new(f"{name} image")
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    coordinates = nodes.new("ShaderNodeTexCoord")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    links.new(coordinates.outputs["UV"], texture.inputs["Vector"])
    links.new(texture.outputs["Color"], emission.inputs["Color"])
    links.new(emission.outputs[0], mix.inputs[1])
    links.new(transparent.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    mix.inputs[0].default_value = 0.0
    for frame, value in ((F["coinGone"] + 17, 0.0), (F["coinGone"] + 20, 1.0)):
        mix.inputs[0].default_value = value
        mix.inputs[0].keyframe_insert("default_value", frame=frame)
    obj.data.materials.append(material)
    return obj


def coin_mesh(scene, material):
    texture_path = Path(os.environ.get(
        "SKATENIGHT_COIN_TEXTURE",
        kit.OUT / "transition" / "coin-face.png",
    ))
    if not texture_path.is_file():
        raise FileNotFoundError(f"Missing extracted coin artwork: {texture_path}")
    image = bpy.data.images.load(str(texture_path), check_existing=True)
    image.pack()
    face_material = bpy.data.materials.new("Coin face - original 25 cent artwork")
    face_material.use_nodes = True
    nodes, links = face_material.node_tree.nodes, face_material.node_tree.links
    shader = nodes["Principled BSDF"]
    shader.inputs["Metallic"].default_value = 0.72
    shader.inputs["Roughness"].default_value = 0.24
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    links.new(texture.outputs["Color"], shader.inputs["Emission Color"])
    shader.inputs["Emission Strength"].default_value = 0.25
    output = nodes["Material Output"]
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    links.remove(next(link for link in links if link.to_socket == output.inputs["Surface"]))
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(shader.outputs["BSDF"], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    for frame, value in ((F["coinGone"], 0.0), (F["coinGone"] + 20, 1.0)):
        mix.inputs[0].default_value = value
        mix.inputs[0].keyframe_insert("default_value", frame=frame)

    vertices = [(0.0, 0.0, 0.0)]
    uvs = [(0.5, 0.5)]
    segments = 96
    for index in range(segments):
        angle = math.tau * index / segments
        vertices.append((0.34 * math.cos(angle), 0.34 * math.sin(angle), 0.0))
        uvs.append((0.515 + 0.42 * math.cos(angle), 0.50 + 0.42 * math.sin(angle)))
    faces = [(0, index + 1, (index + 1) % segments + 1) for index in range(segments)]
    mesh = bpy.data.meshes.new("Coin relief face")
    mesh.from_pydata(vertices, (), faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            uv_layer.data[loop_index].uv = uvs[mesh.loops[loop_index].vertex_index]
    face = bpy.data.objects.new("Coin relief face", mesh)
    scene.collection.objects.link(face)
    face.data.materials.append(face_material)

    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.34, depth=0.045)
    coin = bpy.context.object
    coin.name = "Single 25 cent coin entering the mechanism"
    coin.data.materials.append(material)
    bevel = coin.modifiers.new("Coin edge break", "BEVEL")
    bevel.width = 0.012
    bevel.segments = 3
    coin.modifiers.new("Coin weighted normals", "WEIGHTED_NORMAL")
    face.parent = coin
    face.location = (0.0, 0.0, 0.023)

    coin.rotation_mode = "XYZ"
    return coin


def build_coin_journey(scene, M):
    slot_x = (SLOT_PIXEL[0] - 960.0) * ENTRY_PLATE_SIZE[0] / 1920
    slot_z = ENTRY_PLANE_CENTER[2] + (540.0 - SLOT_PIXEL[1]) * ENTRY_PLATE_SIZE[1] / 1080
    image_plane(
        scene, "Dormant cabinet to coin-slot match plate",
        os.environ.get("SKATENIGHT_COIN_ENTRY_PLATE", kit.OUT / "transition" / "entry-plate.png"),
        ENTRY_PLANE_CENTER, ENTRY_PLATE_SIZE,
    )

    tunnel = kit.Batch()
    tunnel.box((slot_x - 0.62, -57.0, slot_z), (0.08, 6.0, 0.9))
    tunnel.box((slot_x + 0.62, -57.0, slot_z), (0.08, 6.0, 0.9))
    tunnel.box((slot_x, -57.0, slot_z - 0.45), (1.25, 6.0, 0.08))
    tunnel.box((slot_x, -57.0, slot_z + 0.45), (1.25, 6.0, 0.08))
    for y in (-59.0, -57.0, -55.0):
        tunnel.box((slot_x, y, slot_z - 0.48), (1.3, 0.08, 0.08))
        tunnel.box((slot_x, y, slot_z + 0.48), (1.3, 0.08, 0.08))
    tunnel.emit("Coin chute - dark enamel and steel ribs", M["blued"], bevel=0.02)
    impact = F["coinImpact"]

    bezel = kit.Batch()
    bezel.box((slot_x - 0.68, -60.16, slot_z), (0.16, 0.2, 1.08))
    bezel.box((slot_x + 0.68, -60.16, slot_z), (0.16, 0.2, 1.08))
    bezel.box((slot_x, -60.16, slot_z - 0.46), (1.52, 0.2, 0.16))
    bezel.box((slot_x, -60.16, slot_z + 0.46), (1.52, 0.2, 0.16))
    bezel.emit("Coin slot - machined steel throat", M["chrome"], bevel=0.035)
    bezel_fill = kit.light(
        "AREA", "Coin slot bezel warm bounce", (slot_x, -62.0, slot_z + 1.2),
        (1.0, 0.55, 0.24), 0.0, target=(slot_x, -60.16, slot_z), size=1.2,
    )
    key(bezel_fill.data, "energy", (
        (F["coinGone"], 0.0), (F["coinGone"] + 12, 30.0), (F["coinGone"] + 24, 0.0),
    ))

    mouth = kit.Batch()
    mouth.box((slot_x - 0.88, -53.85, slot_z), (0.18, 0.28, 1.52))
    mouth.box((slot_x + 0.88, -53.85, slot_z), (0.18, 0.28, 1.52))
    mouth.box((slot_x, -53.85, slot_z - 0.67), (1.94, 0.28, 0.18))
    mouth.box((slot_x, -53.85, slot_z + 0.67), (1.94, 0.28, 0.18))
    mouth.emit("Coin chute - expanding hall throat", M["gunmetal"], bevel=0.045)

    glows = kit.Batch()
    glows.box((slot_x - 0.49, -57.0, slot_z + 0.34), (0.035, 5.0, 0.025))
    glows.box((slot_x + 0.49, -57.0, slot_z + 0.34), (0.035, 5.0, 0.025))
    glows.emit("Coin chute - fleeting indicator strips", M["amber"])
    kit.light("AREA", "Chute entrance amber reflection", (slot_x, -58.0, slot_z + 1.8),
              (1.0, 0.38, 0.12), 18.0, target=(slot_x, -54.0, slot_z), size=1.2)
    kit.light("AREA", "Chute exit cold reflection", (slot_x, -50.0, slot_z - 1.4),
              (0.16, 0.48, 0.85), 24.0, target=(slot_x, -52.0, slot_z), size=1.0)
    coin_bounce = kit.light(
        "AREA", "Coin fall high-bay bounce", (0.0, -52.0, 31.0), (1.0, 0.62, 0.3), 0.0,
        target=(0.0, -50.0, 10.0), size=2.0,
    )
    key(coin_bounce.data, "energy", (
        (F["hallReveal"] - 1, 0.0), (F["hallReveal"], 1400.0),
        (impact - 1, 1400.0), (impact, 0.0),
    ))

    contact = kit.Batch().box((0.55, -47.0, 0.18), (0.55, 0.22, 0.36))
    contact.box((0.23, -47.0, 0.65), (0.08, 0.18, 0.6))
    contact.emit("Coin-operated relay contact", M["brass"], bevel=0.04)
    contact_light = kit.light("POINT", "Coin impact relay flash", (0.23, -47.0, 1.1),
                              (1.0, 0.42, 0.08), 0.0, size=0.25)
    key(contact_light.data, "energy", ((impact - 1, 0.0), (impact, 1100.0), (impact + 2, 0.0)))
    impact_fill = kit.light("AREA", "Coin impact face fill", (-4.2, -53.0, 3.8),
                            (1.0, 0.62, 0.28), 0.0, target=(0, -46.95, 0.38), size=1.4)
    key(impact_fill.data, "energy", ((impact - 1, 0.0), (impact, 2200.0), (impact + 3, 0.0)))

    coin = coin_mesh(scene, M["brass"])
    coin_states = (
        (F["coinGone"], slot_x, -59.78, slot_z, (math.pi / 2, 0.0, 0.0)),
        (F["coinGone"] + 14, slot_x, -57.7, slot_z, (math.pi / 2, 0.08, 0.35)),
        (F["coinGone"] + 28, slot_x + 0.04, -54.7, slot_z - 0.12, (1.9, 0.2, 1.15)),
        (F["coinGone"] + 42, slot_x - 0.08, -51.1, slot_z - 0.65, (2.3, -0.3, 2.2)),
        (F["coinGone"] + 100, -0.15, -50.2, 9.5, (1.5, -0.5, 1.4)),
        (impact - 2, -0.18, -47.2, 0.55, (1.0, -0.5, 1.0)),
        (impact, 0.0, -46.95, 0.38, (0.82, -1.31, 0.0)),
        (impact + 3, 0.0, -47.05, 0.48, (0.95, -1.1, 0.3)),
    )
    for frame, x, y, z, rotation in coin_states:
        coin.location = (x, y, z)
        coin.rotation_euler = rotation
        coin.keyframe_insert("location", frame=frame)
        coin.keyframe_insert("rotation_euler", frame=frame)

    entry_camera = kit.camera("S0 Follow the coin through the slot", (0, -75, 30), (0, -60, 30), 50)
    entry_camera.data.clip_end = 20000
    path = (
        (F["coinGone"], (0, -75, 30), (0, -60, 30), 50),
        (F["coinGone"] + 8, (0, -65, 30), (slot_x, -60, slot_z), 50),
        (F["coinGone"] + 18, (slot_x, -60.0, slot_z), (slot_x, -56.0, slot_z), 46),
        (F["coinGone"] + 32, (slot_x, -57.0, slot_z + 0.15), (slot_x, -51.0, slot_z), 36),
        (F["coinGone"] + 42, (slot_x, -55.8, slot_z + 0.15), (slot_x, -49.0, slot_z), 32),
        (F["hallReveal"] - 6, (-2, -55.8, slot_z), (0, -48, slot_z), 32),
        (F["hallReveal"], (-2, -55.8, slot_z), (-0.08, -51.8, slot_z - 1.0), 30),
        (F["coinGone"] + 70, (4, -58, slot_z - 1.0), (-0.1, -50.5, 18.5), 24),
        (F["coinGone"] + 88, (10, -58, 17), (-0.15, -50.2, 12.5), 24),
        (F["coinGone"] + 100, (10, -58, 15), (-0.15, -50.2, 9.5), 22),
        (F["coinGone"] + 114, (8, -55, 5), (-0.1, -48.9, 3.8), 24),
        (F["coinImpact"] - 8, (-6.5, -58, 3.0), (0, -47, 0.38), 28),
        (F["coinImpact"], (-7.0, -57, 2.2), (0, -47, 0.38), 30),
        (F["coinImpact"] + 3, (-7.0, -57, 2.2), (0, -47, 0.38), 30),
        (F["relay"] - 1, (-9.0, -57, 2.2), (2.0, 48, 30), 18),
    )
    entry_camera.rotation_mode = "QUATERNION"
    segment = 0
    for frame in range(F["coinGone"], F["relay"]):
        scene.frame_set(frame)
        while segment < len(path) - 2 and frame > path[segment + 1][0]:
            segment += 1
        start, end = path[segment], path[segment + 1]
        t = (frame - start[0]) / (end[0] - start[0])
        eased = t * t * (3 - 2 * t)
        location = Vector(start[1]).lerp(Vector(end[1]), eased)
        if F["hallReveal"] <= frame <= impact:
            target = coin.matrix_world.translation.copy()
        else:
            target = Vector(start[2]).lerp(Vector(end[2]), eased)
        lens = start[3] + (end[3] - start[3]) * eased
        entry_camera.location = location
        entry_camera.rotation_quaternion = (target - location).to_track_quat("-Z", "Y")
        entry_camera.data.lens = lens
        entry_camera.keyframe_insert("location", frame=frame)
        entry_camera.keyframe_insert("rotation_quaternion", frame=frame)
        entry_camera.data.keyframe_insert("lens", frame=frame)
    return entry_camera


def configure_entry_color(scene, frame):
    if frame <= F["coinGone"] + 20:
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "None"
    else:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--w", type=int, default=480)
    ap.add_argument("--h", type=int, default=270)
    ap.add_argument("--samples", type=int, default=8)
    ap.add_argument("--start", type=int, default=F["coinGone"])
    ap.add_argument("--end", type=int, default=F["toRecord"] - 1)
    ap.add_argument("--output-dir", type=Path)
    ap.add_argument("--resume", action="store_true")
    args = ap.parse_args(argv)

    scene = kit.fresh_scene("Story - the machine tries to play")
    scene.cycles.volume_step_rate = 3.0
    M = H.materials()
    _root, drive = H.build_drive(M)
    H.build_hall(M)
    drive_detail.build_background(M, drive)
    drive_detail.build_foreground(M)
    lights = H.build_lights("lit")
    kit.fog(scene, (130, 260, 140), (0, 0, 14), 0.0016, anisotropy=0.7)
    entry_camera = build_coin_journey(scene, M)

    frames = range(args.start, args.end + 1)
    animate_lights(lights, frames)
    animate_emission(M, frames)
    speed = drive_profile(range(F["coinGone"], F["toRecord"] + 1))
    drive.driver_remove("rotation_euler", 2)
    angle = 0.0
    for f in sorted(speed):
        angle += speed[f]
        drive.rotation_euler[2] = angle
        drive.keyframe_insert("rotation_euler", index=2, frame=f)
    animate_dial(M, bpy.data.objects["Dial needle"], speed)

    shots = [
        (F["relay"], camera_path("S2 The first attempt", [
            (F["relay"], (-9.0, -57, 2.2), (2.0, 48, 30), 18),
            (F["catch"] - 1, (-7.5, -49, 2.8), (2.0, 48, 30), 22)])),
        (F["catch"], camera_path("S3 The robot in the dial", [
            (F["catch"], (0.6, 19.0, 26.4), (0, 31, 26), 32),
            (F["heartbeats"][1], (0.2, 12.0, 26.0), (0, 31, 26), 30),
            (F["ignite"] - 1, (-3.5, -6.0, 22.5), (0, 40, 26.5), 26)])),
        (F["ignite"], camera_path("S4 The lock", [
            (F["ignite"], (-4.0, -47.0, 5.2), (0.0, 46.0, 25.0), 24),
            (F["toRecord"] - 1, (6.5, -14.0, 13.0), (-1.0, 48.0, 33.0), 18)])),
    ]
    scene.timeline_markers.new(entry_camera.name, frame=F["coinGone"]).camera = entry_camera
    for frame, cam in shots:
        scene.timeline_markers.new(cam.name, frame=frame).camera = cam
    scene.camera = entry_camera

    scene.frame_start, scene.frame_end = args.start, args.end
    scene.cycles.samples = args.samples
    output_dir = args.output_dir or kit.OUT / "animatic" / "story"
    render_frame_sequence(
        scene, output_dir, args.start, args.end, args.w, args.h,
        resume=args.resume, frame_setup=configure_entry_color,
    )


if __name__ == "__main__":
    main()

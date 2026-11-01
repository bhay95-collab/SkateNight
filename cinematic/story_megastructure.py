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
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy  # noqa: E402

import drive_detail  # noqa: E402
import hero_megastructure as H  # noqa: E402
import kit  # noqa: E402

CUES = json.loads((Path(__file__).resolve().parent / "cues.json").read_text())
F = CUES["frames"]
ROBOT = kit.ROOT / "rfai-logo.png"


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


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--w", type=int, default=480)
    ap.add_argument("--h", type=int, default=270)
    ap.add_argument("--samples", type=int, default=8)
    ap.add_argument("--start", type=int, default=F["coinGone"])
    ap.add_argument("--end", type=int, default=F["toRecord"] - 1)
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
        (F["coinGone"], camera_path("S1 Into the hall", [
            (F["coinGone"], (7, -26, 64), (0, 6, 0), 20),
            (F["relay"] - 1, (-6, -60, 3.0), (1, 48, 22), 22)])),
        (F["relay"], camera_path("S2 The first attempt", [
            (F["relay"], (-9.0, -57, 2.2), (2.0, 48, 30), 22),
            (F["catch"] - 1, (-7.5, -49, 2.8), (2.0, 48, 30), 22)])),
        (F["catch"], camera_path("S3 The robot in the dial", [
            (F["catch"], (0.6, 19.0, 26.4), (0, 31, 26), 32),
            (F["heartbeats"][1], (0.2, 12.0, 26.0), (0, 31, 26), 30),
            (F["ignite"] - 1, (-3.5, -6.0, 22.5), (0, 40, 26.5), 26)])),
        (F["ignite"], camera_path("S4 The lock", [
            (F["ignite"], (-4.0, -47.0, 5.2), (0.0, 46.0, 25.0), 24),
            (F["toRecord"] - 1, (6.5, -14.0, 13.0), (-1.0, 48.0, 33.0), 18)])),
    ]
    for frame, cam in shots:
        scene.timeline_markers.new(cam.name, frame=frame).camera = cam
    scene.camera = shots[0][1]

    scene.frame_start, scene.frame_end = args.start, args.end
    scene.render.resolution_x, scene.render.resolution_y = args.w, args.h
    scene.cycles.samples = args.samples
    scene.render.filepath = str(kit.OUT / "animatic" / "story" / "frame_")
    bpy.ops.render.render(animation=True)


if __name__ == "__main__":
    main()

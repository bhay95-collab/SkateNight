"""HERO SHOTS B + C: the world within the groove, the needle drop, the way home.

    blender -b --python cinematic/hero_groove.py -- --shot wide --w 1920 --h 1080 --samples 160
    blender -b --python cinematic/hero_groove.py -- --shot pullback --w 1280 --h 720 --samples 24

Scale is physical x4000: groove pitch 0.1 mm -> 0.4 m, a 150 mm record -> 600 m.
The layout is the live changer's, measured from the DOM at 1920x1080
(record radius 90.5 px, spindle at 1158,421.4, arm pivot at 1.247R,1.080R,
stylus at 0.746R,-0.531R). The pullback keeps the stylus tip pinned to the
exact pixel where the UI's arm head sits, so the giant world lands on the real
interface and a hard cut at any frame is a precision match cut.
Needs build/cinematic-phase4/ui-plate.png: a 1920x1080 screenshot of the jukebox playing.
"""
import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Euler, Matrix, Vector  # noqa: E402

import kit  # noqa: E402
from kit import Batch  # noqa: E402

R = 600.0                                     # vinyl radius (m)
PX = R / 90.5                                 # metres per UI pixel at 1920x1080
SPINDLE_PX = Vector((1158.0, 421.4))
HEAD_PX = Vector((1225.5, 469.5))             # arm head centre in the UI
PIVOT = Vector((1.247 * R, 1.080 * R, 0))
TIP = Vector((0.746 * R, -0.531 * R, 0))
CONTACT_R = TIP.length
PITCH, DEPTH, GROOVE_W = 0.4, 0.13, 0.26
LEADIN_PITCH, LEADIN_R = 1.5, 562.0
OMEGA_45 = math.tau * 45 / 60                 # rad/s
OMEGA_GIANT = 0.012                           # rad/s: 6.6 m/s of groove past the stylus
# Musical lock (rotation.js OPENER): contact lands on the song's first hit (0.207 s) and the
# pullback lands on the jukebox reveal, revealAt = bar1 + 4 beats = 3.584 s: 3.377 s later.
F_CONTACT = 240
F_END = F_CONTACT + round((1.798 + 4 * 0.4465 - 0.207) * 60)        # 443
LABEL_ART = kit.ROOT / "covers" / "vol-iv.jpg"
UI_PLATE = kit.OUT / "ui-plate.png"
AMBER, CYAN, MAGENTA = (1.0, 0.52, 0.12), (0.3, 0.85, 1.0), (1.0, 0.12, 0.55)


# ----------------------------------------------------------------- materials

def vinyl(name, rings=True):
    mat = kit.worn_metal(name, (0.0018, 0.0018, 0.0022), 0.0, 0.05, wear=0.0, grime=0.0, scale=0.05, coat=0.25)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Specular IOR Level"].default_value = 0.55
    nodes["Bump"].inputs["Strength"].default_value = 0.03          # pressed vinyl is smooth, not cast
    if rings:
        wave = nodes.new("ShaderNodeTexWave")
        wave.wave_type = "RINGS"
        wave.rings_direction = "SPHERICAL"
        wave.inputs["Scale"].default_value = 0.314159 / PITCH * 2
        wave.inputs["Distortion"].default_value = 0.0
        links.new(nodes["Texture Coordinate"].outputs["Object"], wave.inputs["Vector"])
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.35
        links.new(wave.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def label_paper():
    mat = bpy.data.materials.new("Label - VOL. IV")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    img = nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(str(LABEL_ART))
    links.new(img.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
    nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.55
    return mat


def ui_plate():
    """The real interface as an emissive plate; its strength is animated in at the end."""
    mat = bpy.data.materials.new("UI plate")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    em = nodes.new("ShaderNodeEmission")
    img = nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(str(UI_PLATE))
    links.new(nodes.new("ShaderNodeTexCoord").outputs["UV"], img.inputs["Vector"])
    links.new(img.outputs["Color"], em.inputs["Color"])
    links.new(em.outputs[0], out.inputs["Surface"])
    return mat, em


def diamond():
    mat = bpy.data.materials.new("Diamond")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Transmission Weight"].default_value = 1.0
    bsdf.inputs["IOR"].default_value = 2.42
    bsdf.inputs["Roughness"].default_value = 0.0
    return mat


def materials():
    return {
        "vinyl": vinyl("Pressed vinyl"),
        "vinyl_patch": vinyl("Pressed vinyl - groove geometry", rings=False),
        "chrome": kit.worn_metal("Satin chrome", (0.62, 0.63, 0.66), 1.0, 0.16, wear=0.0, grime=0.25, scale=0.05),
        "black": kit.worn_metal("Black anodised", (0.01, 0.01, 0.012), 0.6, 0.3, wear=0.1, scale=0.05, coat=0.3),
        "brass": kit.worn_metal("Worn brass", (0.55, 0.36, 0.12), 1.0, 0.25, wear=0.1, scale=0.05),
        "iron": kit.worn_metal("Platter iron", (0.04, 0.04, 0.045), 0.9, 0.4, wear=0.1, scale=0.02),
        "diamond": diamond(),
        "amber": kit.glow("Amber pilot", AMBER, 40),
        "magenta": kit.glow("Platter neon", MAGENTA, 24),
        "neon_rim": kit.glow("Platter neon rim", MAGENTA, 24),
        "tube": kit.glow("Mechanism fluorescent", (0.7, 0.9, 1.0), 14),
        "label": label_paper(),
    }


# ----------------------------------------------------------------- the record

def groove_patch(theta0, theta1, r0, r1, step=0.12):
    """Real V-groove geometry with spiral and lateral audio modulation (numpy-built).
    The profile is piecewise linear, so four vertices per groove are exact."""
    keys = []
    r = r0
    while r < r1:
        pitch = LEADIN_PITCH if r >= LEADIN_R else PITCH
        c = r + pitch / 2
        for off, z in ((-GROOVE_W / 2, 0.0), (-0.02, -DEPTH), (0.02, -DEPTH), (GROOVE_W / 2, 0.0)):
            keys.append((c + off, z, len(keys) // 4, r < LEADIN_R, pitch))
        r += pitch
    base, zs, gid, mod, pit = (np.array(col, dtype=float) for col in zip(*keys))
    gid = gid.astype(int)
    n_th = int((theta1 - theta0) * CONTACT_R / step)
    th = np.linspace(theta0, theta1, n_th)[:, None]
    s = th * CONTACT_R
    ph = np.random.default_rng(7).uniform(0, math.tau, (3, gid.max() + 1))
    env = 0.55 + 0.45 * np.sin(math.tau * s / 31.0 + ph[0][gid]) ** 2
    lateral = 0.07 * env * (0.5 * np.sin(math.tau * s / 23.0 + ph[0][gid])
                            + 0.32 * np.sin(math.tau * s / 5.7 + ph[1][gid])
                            + 0.18 * np.sin(math.tau * s / 1.35 + ph[2][gid])) * mod
    rr = base[None, :] + pit[None, :] * th / math.tau + lateral           # spiral + modulation
    co = np.stack([rr * np.cos(th), rr * np.sin(th), np.broadcast_to(zs, rr.shape)], axis=-1)
    nr = len(base)
    me = bpy.data.meshes.new("Groove landscape")
    me.vertices.add(n_th * nr)
    me.vertices.foreach_set("co", co.astype(np.float32).ravel())
    i, j = np.meshgrid(np.arange(n_th - 1), np.arange(nr - 1), indexing="ij")
    a = (i * nr + j).ravel()
    quads = np.stack([a, a + nr, a + nr + 1, a + 1], axis=-1).ravel().astype(np.int32)
    me.loops.add(len(quads))
    me.loops.foreach_set("vertex_index", quads)
    me.polygons.add(len(quads) // 4)
    me.polygons.foreach_set("loop_start", np.arange(0, len(quads), 4, dtype=np.int32))
    me.update(calc_edges=True)
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(25))
    obj = bpy.data.objects.new("Groove landscape (geometry)", me)
    bpy.context.scene.collection.objects.link(obj)
    print(f"groove patch: {len(me.vertices):,} vertices", flush=True)
    return obj


def build_record(M):
    rec = kit.empty("Record (rotates)")
    Batch().cyl((0, 0, -3.004), R, 6.0, segs=720).emit("Vinyl disc", M["vinyl"], rec, smooth=True)
    th_c = math.atan2(TIP.y, TIP.x)
    patch = groove_patch(th_c - math.radians(9), th_c + math.radians(22), 536.0, 592.0)
    patch.data.materials.append(M["vinyl_patch"])
    patch.parent = rec
    lab = Batch()
    lab.bm.loops.layers.uv.new("UVMap")
    bmesh.ops.create_circle(lab.bm, cap_ends=True, segments=256, radius=0.4 * R, calc_uvs=True,
                            matrix=Matrix.Translation((0, 0, 0.06)))
    lab.emit("Label", M["label"], rec)
    return rec


def build_changer(M):
    plat = Batch().cyl((0, 0, -8), 1.11 * R, 4.0, segs=720)
    plat.ring(1.11 * R - 4, 1.11 * R, 3, z=-5.5, segs=720)
    plat.emit("Platter", M["iron"], bevel=0.4)
    Batch().ring(1.02 * R, 1.035 * R, 0.8, z=-5.6, segs=720).emit("Platter neon rim", M["neon_rim"])
    Batch().cyl((0, 0, 22), 0.024 * R, 56, segs=96).emit("Spindle", M["chrome"], smooth=True, bevel=0.6)
    # The carousel: the magazine of records standing in cradles around the platter
    cols = [(0.1, 0.85, 1.0), (1.0, 0.15, 0.55), (1.0, 0.6, 0.12), (0.35, 0.45, 1.0), (0.45, 1.0, 0.5)]
    discs, lamps, cradle = Batch(), Batch(), Batch()
    labels = [Batch() for _ in cols]
    for k in range(60):
        m = (Matrix.Rotation(math.tau * k / 60, 4, "Z") @ Matrix.Translation((1.22 * R, 0, 0.1 * R - 8))
             @ Matrix.Rotation(math.pi / 2, 4, "X"))
        discs.cyl((0, 0, 0), 0.1 * R, 4.0, segs=96, matrix=m)
        labels[k % len(cols)].cyl((0, 0, 0), 0.04 * R, 4.6, segs=48, matrix=m)
        cradle.box((0, -0.1 * R + 6, 0), (0.2 * R, 12, 10), matrix=m)
        lamps.sphere((0, 0.1 * R + 6, 0), 2.2, segs=10, matrix=m)
    discs.emit("Carousel records", M["vinyl"], smooth=True)
    for b, c in zip(labels, cols):
        b.emit("Carousel labels", kit.glow(f"Label glow {c}", c, 3.0))
    cradle.emit("Carousel cradles", M["iron"], bevel=0.5)
    lamps.emit("Carousel pilot lamps", M["amber"], smooth=True)


def build_arm(M):
    """Pivot tower, lift, tube, headshell, cartridge, cantilever, diamond."""
    tower = Batch().cyl((PIVOT.x, PIVOT.y, 40), 70, 96, segs=128).cyl((PIVOT.x, PIVOT.y, 94), 52, 12, segs=128)
    tower.ring(70, 78, 6, z=8, segs=128, matrix=Matrix.Translation(PIVOT))
    tower.emit("Arm pivot tower", M["black"], bevel=1.2)
    d = (TIP - PIVOT).normalized()
    lift = kit.empty("Arm lift", (PIVOT.x, PIVOT.y, 100), (0, 0, math.atan2(d.y, d.x)))  # local +X runs down the arm
    L = (TIP - PIVOT).length
    arm = Batch()
    arm.cyl((L / 2 - 30, 0, 0), 22, L - 120, rot=(0, math.pi / 2, 0), segs=96)
    arm.cyl((-70, 0, 0), 48, 70, rot=(0, math.pi / 2, 0), segs=96)            # counterweight
    arm.cyl((0, 0, 0), 34, 60, segs=96)                                        # bearing yoke
    arm.emit("Tonearm tube", M["chrome"], lift, smooth=True, bevel=0.8)
    head = Batch()
    head.box((L - 52, 0, -10), (150, 96, 26))                                  # headshell
    head.box((L - 30, 0, -53), (110, 72, 60))                                  # cartridge body: underside 17 m up
    head.box((L - 30, 0, -24), (60, 40, 8))                                    # mounting block
    head.box((L + 22, 0, -66), (22, 40, 30))                                   # stylus housing nose
    head.emit("Headshell + cartridge", M["black"], lift, bevel=1.5)
    screws = Batch()
    for y in (-26, 26):
        screws.cyl((L - 52, y, 4), 6, 4, segs=24).cyl((L - 52, y, -40), 3, 90, segs=12)
    screws.emit("Headshell screws", M["brass"], lift, smooth=True)
    Batch().box((L - 30, 36.6, -53), (70, 1.5, 30)).emit("Cartridge plate", M["brass"], lift)
    tip_local = Vector((L, 0, -100))               # lift origin is 100 m up, so this lands on z=0
    root = Vector((L - 24, 0, -80))
    end = tip_local + Vector((0, 0, 1.9))                    # the diamond hangs under the cantilever end
    v = end - root
    Batch().cyl(tuple((root + end) / 2), 1.1, v.length, rot=v.to_track_quat("Z", "Y").to_euler(),
                segs=24).emit("Cantilever", M["chrome"], lift, smooth=True)
    stylus = Batch().cyl(tuple(tip_local + Vector((0, 0, 1.45))), 0.3, 0.9, segs=6)         # shank
    stylus.cyl(tuple(tip_local + Vector((0, 0, 0.5))), 0.3, 1.0, r2=0.0, segs=6,
               rot=(math.pi, 0, 0))                                              # conical diamond, tip down
    stylus.emit("Diamond", M["diamond"], lift, smooth=True)
    return lift, L


def lower_arm(lift, L, heights):
    """Keyframe the arm lift as stylus heights above the groove: (frame, metres)."""
    yaw = lift.rotation_euler.z
    for f, h in heights:
        lift.rotation_euler = Euler((0, -math.atan2(h, L), yaw), "XYZ")
        lift.keyframe_insert("rotation_euler", frame=f)


# ----------------------------------------------------------------- environment

def build_environment(M):
    haze = kit.fog(bpy.context.scene, (4200, 4200, 1400), (0, 0, 600), 0.0001, anisotropy=0.6)
    tubes = Batch()
    for k, x in enumerate((-380, 120, 620)):
        tubes.box((x, 150, 720), (14, 2600, 10))
        strip = kit.light("AREA", f"Fluorescent strip {k}", (x, 150, 712), (0.72, 0.9, 1.0), 2.2e6, target=(x, 150, 0))
        strip.data.shape = "RECTANGLE"
        strip.data.size, strip.data.size_y = 14, 2600
    tubes = tubes.emit("Mechanism lamp tubes", M["tube"])
    kit.light("SPOT", "Mechanism lamp on the stylus", (260, -560, 420), (1.0, 0.7, 0.42), 1.1e8,
              target=tuple(TIP), size=20, spot=16, blend=0.6)
    kit.light("SPOT", "Stylus key", tuple(TIP * 0.86 + Vector((0, 0, 55))), (0.75, 0.9, 1.0), 1.2e6,
              target=tuple(TIP + Vector((0, 0, 3))), size=3, spot=7, blend=0.7)
    kit.light("AREA", "Magenta grazing from the rim", tuple(TIP * 1.25 + Vector((0, 0, 2))), MAGENTA, 6.0e5,
              target=tuple(TIP * 0.92), size=120)
    kit.light("AREA", "Cyan haze behind the pivot", tuple(PIVOT * 2.2 + Vector((0, 0, 300))), CYAN, 3.0e7,
              target=(0, 0, 0), size=600)
    return haze, tubes


def build_plate():
    mat, em = ui_plate()
    w, h = 1920 * PX, 1080 * PX
    c = Vector(((960 - SPINDLE_PX.x) * PX, -(540 - SPINDLE_PX.y) * PX, -20))
    bm = bmesh.new()
    bm.loops.layers.uv.new("UVMap")
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5, calc_uvs=True,
                          matrix=Matrix.LocRotScale(c, None, Vector((w, h, 1))))
    obj = Batch()
    obj.bm.free()
    obj.bm = bm
    obj.emit("UI plate", mat)
    return em


# ----------------------------------------------------------------- the pinned pullback

def pinned_camera(cam, frame_range, d0, d1, lens0, lens1, pitch0, pitch1=0.0, settle=1.0):
    """Keep the stylus tip on the UI head pixel while the camera moves; pitch 0 is top-down."""
    f0, f1 = frame_range
    q0 = Euler((math.radians(pitch0), 0, 0)).to_quaternion()
    q1 = Euler((math.radians(pitch1), 0, 0)).to_quaternion()
    for f in range(f0, f1 + 1):
        u = (f - f0) / (f1 - f0)
        e = u * u * u * (u * (u * 6 - 15) + 10)                 # smootherstep
        lens = math.exp(math.log(lens0) + (math.log(lens1) - math.log(lens0)) * e)
        dist = math.exp(math.log(d0) + (math.log(d1) - math.log(d0)) * e)
        q = q0.slerp(q1, min(1.0, e / settle))
        ray = Vector(((HEAD_PX.x - 960) / 1920 * 36, -(HEAD_PX.y - 540) / 1920 * 36, -lens)).normalized()
        cam.location = TIP - (q @ ray) * dist
        cam.rotation_euler = q.to_euler()
        cam.data.lens = lens
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
        cam.data.keyframe_insert("lens", frame=f)
        yield f, dist


def final_distance(lens):
    """Distance at which a top-down camera frames the UI exactly 1920 px wide."""
    return 1920 * PX * lens / 36


def bake_record(rec, dists):
    """Giant-world speed until contact, then speed scales with camera distance, capped at 45 rpm."""
    angle, d_contact = 0.0, None
    for f in range(1, F_END + 1):
        w = OMEGA_GIANT
        if f >= F_CONTACT:
            d_contact = d_contact or dists[f]
            w = min(OMEGA_45, OMEGA_GIANT * max(1.0, dists[f] / d_contact))
        angle -= w / kit.FPS                                     # clockwise from above
        rec.rotation_euler = (0, 0, angle)
        rec.keyframe_insert("rotation_euler", frame=f)


def leave_the_giant_world(haze, tubes, dists):
    """Once the camera climbs past the lamps, the haze thins out and the lamp tubes leave frame."""
    vol = haze.data.materials[0].node_tree.nodes["Principled Volume"].inputs["Density"]
    above = next(f for f in range(F_CONTACT, F_END + 1) if dists[f] > 600)
    for f, dens in ((F_CONTACT, vol.default_value), (above, 0.0)):
        vol.default_value = dens
        vol.keyframe_insert("default_value", frame=f)
    for f, hidden in ((above - 1, False), (above, True)):
        tubes.hide_render = hidden
        tubes.keyframe_insert("hide_render", frame=f)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--shot", default="wide",
                    choices=("wide", "low", "approach", "contact", "final", "pullback", "glide", "stills"))
    ap.add_argument("--w", type=int, default=960)
    ap.add_argument("--h", type=int, default=540)
    ap.add_argument("--samples", type=int, default=48)
    ap.add_argument("--frame", type=int)
    ap.add_argument("--save", action="store_true")
    args = ap.parse_args(argv)

    scene = kit.fresh_scene("B - World within the groove")
    scene.cycles.volume_step_rate = 4.0
    scene.frame_start, scene.frame_end = 1, F_END
    M = materials()
    rec = build_record(M)
    build_changer(M)
    lift, L = build_arm(M)
    lower_arm(lift, L, ((1, 46.0), (150, 14.0), (205, 2.2), (F_CONTACT, 0.0)))
    haze, tubes = build_environment(M)
    plate = build_plate()
    for f, s in ((1, 0.0), (int(F_CONTACT + 0.62 * (F_END - F_CONTACT)), 0.0), (F_END - 24, 1.0)):
        plate.inputs["Strength"].default_value = s
        plate.inputs["Strength"].keyframe_insert("default_value", frame=f)

    th_c = math.atan2(TIP.y, TIP.x)
    cams = {
        "wide": kit.camera("B1 The record is a world", (-250, -520, 46), (520, -40, 50), 24, fstop=11, focus=700),
        "low": kit.camera("B2 Riding the groove", (556 * math.cos(th_c + 0.11), 556 * math.sin(th_c + 0.11), 2.6),
                          tuple(TIP + Vector((0, 0, 5))), 20, fstop=4, focus=60),
    }
    pin = kit.camera("C Pinned pullback", (0, 0, 10), (0, 0, 0), 18)
    pin.data.clip_end = 400000
    dists = dict(pinned_camera(pin, (1, F_CONTACT), 46, 30, 18, 18, 86.5, 84))
    dists.update(pinned_camera(pin, (F_CONTACT, F_END), 30, final_distance(600), 18, 600, 84, settle=0.85))
    bake_record(rec, dists)
    leave_the_giant_world(haze, tubes, dists)
    rim = M["neon_rim"].node_tree.nodes["Emission"].inputs["Strength"]
    for f, v in ((F_CONTACT + 60, 24.0), (F_CONTACT + 150, 0.0)):    # the UI has no neon here
        rim.default_value = v
        rim.keyframe_insert("default_value", frame=f)
    perp = Vector((-(TIP - PIVOT).normalized().y, (TIP - PIVOT).normalized().x, 0))
    side = perp if perp.dot(-TIP) > 0 else -perp                 # look inward across the dark record
    cam_at = TIP - side * 8.0 + Vector((0, 0, 1.7))
    look = TIP + Vector((0, 0, 0.9))
    cams["approach"] = kit.camera("B3 Stylus approach", tuple(cam_at), tuple(look), 50,
                                  fstop=2.8, focus=(look - cam_at).length)
    cams.update(contact=pin, final=pin)

    out = kit.OUT / "groove"
    out.mkdir(parents=True, exist_ok=True)
    if args.save:
        bpy.ops.wm.save_as_mainfile(filepath=str(out / "hero-groove.blend"))
    frames = {"wide": 120, "low": 120, "approach": 222, "contact": F_CONTACT + 4, "final": F_END}
    for shot in (("wide", "low", "approach", "contact", "final") if args.shot == "stills" else (args.shot,)):
        if shot in ("pullback", "glide"):
            scene.camera = pin
            scene.frame_start = args.frame or (1 if shot == "glide" else F_CONTACT - 60)
            scene.frame_end = F_CONTACT + 60 if shot == "glide" else F_END
            scene.render.resolution_x, scene.render.resolution_y = args.w, args.h
            scene.cycles.samples = args.samples
            scene.render.filepath = str(out / shot / "frame_")
            bpy.ops.render.render(animation=True)
            continue
        raw = out / f"raw-{shot}.png"
        kit.render(scene, cams[shot], raw, args.w, args.h, args.samples, frame=args.frame or frames[shot])
        kit.finish_photo(raw, out / f"B-{shot}.png", bloom=0.4, grain=4)
        print(f"WROTE {out / f'B-{shot}.png'}", flush=True)


main()

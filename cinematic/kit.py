"""Shared Blender helpers for the Phase 4 hero shots (Blender 5.x, Cycles/Metal).

Geometry is batched into a few bmesh objects per material so a 100 m chamber
stays light enough for the 16 GB M2 Pro.
"""
import math
import shutil
import subprocess
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

FPS = 60
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build" / "cinematic-phase4"


# ---------------------------------------------------------------- scene / render

def fresh_scene(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = name
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 6
    scene.cycles.volume_bounces = 1
    scene.cycles.transparent_max_bounces = 4
    scene.cycles.sample_clamp_indirect = 8
    scene.render.fps = FPS
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    world = bpy.data.worlds.new("Void")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.0005, 0.0008, 0.0015, 1)
    scene.world = world
    use_metal()
    return scene


def use_metal():
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.get_devices()
    if not any(d.type == "METAL" for d in prefs.devices):
        raise RuntimeError("Cycles exposes no Metal device")
    prefs.compute_device_type = "METAL"
    for d in prefs.devices:
        d.use = d.type == "METAL"


def render(scene, camera, path, width, height, samples, frame=None):
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.cycles.samples = samples
    if frame is not None:
        scene.frame_set(frame)
    scene.render.filepath = str(path)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)


def finish_photo(src, dst, bloom=0.55, grain=5):
    """Photographic finish in FFmpeg: highlight bloom, lens vignette, film grain."""
    graph = (
        f"format=gbrp,split[a][b];[b]colorlevels=rimin=0.62:gimin=0.62:bimin=0.62,gblur=sigma=28[g];"
        f"[a][g]blend=all_mode=screen:all_opacity={bloom},vignette=angle=PI/5.2,"
        f"noise=alls={grain}:allf=t"
    )
    subprocess.run([shutil.which("ffmpeg"), "-y", "-loglevel", "error", "-i", str(src),
                    "-vf", graph, str(dst)], check=True)


# ---------------------------------------------------------------- materials

def _nodes(mat):
    mat.use_nodes = True
    return mat.node_tree.nodes, mat.node_tree.links


def worn_metal(name, color, metallic=0.9, rough=0.35, wear=0.25, wear_color=(0.55, 0.53, 0.5),
               grime=0.7, scale=1.0, coat=0.0):
    """Painted or bare metal with edge-of-noise wear, crevice grime and roughness breakup."""
    mat = bpy.data.materials.new(name)
    nodes, links = _nodes(mat)
    bsdf = nodes["Principled BSDF"]
    coords = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 0.9 * scale
    noise.inputs["Detail"].default_value = 8
    noise.inputs["Roughness"].default_value = 0.62
    links.new(coords.outputs["Object"], noise.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 1 - wear * 0.6
    ramp.color_ramp.elements[1].position = 1 - wear * 0.6 + 0.05
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    paint = nodes.new("ShaderNodeMix")
    paint.data_type = "RGBA"
    paint.inputs[6].default_value = (*color, 1)
    paint.inputs[7].default_value = (*wear_color, 1)
    links.new(ramp.outputs["Color"], paint.inputs["Factor"])
    ao = nodes.new("ShaderNodeAmbientOcclusion")
    ao.only_local = True
    ao.inputs["Distance"].default_value = 0.6 * (1 / scale)
    dirt = nodes.new("ShaderNodeMix")
    dirt.data_type = "RGBA"
    dirt.blend_type = "MULTIPLY"
    dirt.inputs["Factor"].default_value = grime
    links.new(paint.outputs[2], dirt.inputs[6])
    links.new(ao.outputs["AO"], dirt.inputs[7])
    links.new(dirt.outputs[2], bsdf.inputs["Base Color"])
    rough_noise = nodes.new("ShaderNodeTexNoise")
    rough_noise.inputs["Scale"].default_value = 3.5 * scale
    rough_noise.inputs["Detail"].default_value = 6
    links.new(coords.outputs["Object"], rough_noise.inputs["Vector"])
    rmap = nodes.new("ShaderNodeMapRange")
    rmap.inputs["To Min"].default_value = rough * 0.6
    rmap.inputs["To Max"].default_value = min(1.0, rough * 1.5)
    links.new(rough_noise.outputs["Fac"], rmap.inputs["Value"])
    links.new(rmap.outputs["Result"], bsdf.inputs["Roughness"])
    metal_mix = nodes.new("ShaderNodeMapRange")
    metal_mix.inputs["To Min"].default_value = metallic
    metal_mix.inputs["To Max"].default_value = 1.0
    links.new(ramp.outputs["Color"], metal_mix.inputs["Value"])
    links.new(metal_mix.outputs["Result"], bsdf.inputs["Metallic"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.18
    links.new(rough_noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Coat Weight"].default_value = coat
    mat.diffuse_color = (*color, 1)
    return mat


def glow(name, color, strength):
    mat = bpy.data.materials.new(name)
    nodes, links = _nodes(mat)
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = strength
    links.new(em.outputs[0], out.inputs["Surface"])
    return mat


def fog(scene, size, center, density, color=(0.75, 0.85, 1.0), anisotropy=0.55, noise_scale=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    box = bpy.context.object
    box.name = "Atmosphere"
    box.scale = size
    mat = bpy.data.materials.new("Atmosphere haze")
    nodes, links = _nodes(mat)
    nodes.remove(nodes["Principled BSDF"])
    vol = nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (*color, 1)
    vol.inputs["Density"].default_value = density
    vol.inputs["Anisotropy"].default_value = anisotropy
    if noise_scale:
        n = nodes.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = noise_scale
        n.inputs["Detail"].default_value = 3
        m = nodes.new("ShaderNodeMapRange")
        m.inputs["To Min"].default_value = density * 0.35
        m.inputs["To Max"].default_value = density * 1.8
        links.new(n.outputs["Fac"], m.inputs["Value"])
        links.new(m.outputs["Result"], vol.inputs["Density"])
    links.new(vol.outputs[0], nodes["Material Output"].inputs["Volume"])
    box.data.materials.append(mat)
    box.visible_shadow = False
    return box


# ---------------------------------------------------------------- batched geometry

class Batch:
    """Accumulate primitives into one mesh, then emit a single object."""

    def __init__(self):
        self.bm = bmesh.new()

    @staticmethod
    def _m(loc, rot, scale=(1, 1, 1)):
        return Matrix.LocRotScale(Vector(loc), Euler(rot), Vector(scale))

    def box(self, loc, size, rot=(0, 0, 0), matrix=None):
        m = self._m(loc, rot, size)
        bmesh.ops.create_cube(self.bm, size=1.0, matrix=(matrix @ m) if matrix else m)
        return self

    def cyl(self, loc, r, depth, rot=(0, 0, 0), segs=32, r2=None, matrix=None):
        m = self._m(loc, rot)
        bmesh.ops.create_cone(self.bm, cap_ends=True, segments=segs, radius1=r,
                              radius2=r if r2 is None else r2, depth=depth,
                              matrix=(matrix @ m) if matrix else m)
        return self

    def sphere(self, loc, r, segs=12, matrix=None):
        m = self._m(loc, (0, 0, 0))
        bmesh.ops.create_uvsphere(self.bm, u_segments=segs, v_segments=max(6, segs // 2),
                                  radius=r, matrix=(matrix @ m) if matrix else m)
        return self

    def ring(self, r_in, r_out, depth, z=0.0, segs=128, teeth=0, tooth=0.0, inward=False,
             matrix=None):
        """Annulus in local XY at height z; with teeth, a spur gear (outward or internal)."""
        m = (matrix or Matrix.Identity(4)) @ Matrix.Translation((0, 0, z))
        n = teeth * 4 if teeth else segs
        outer, inner = [], []
        for i in range(n):
            a = math.tau * i / n
            ro, ri = r_out, r_in
            if teeth:
                k = i % 4
                tip = k in (1, 2)
                if inward:
                    ri = r_in - (tooth if tip else 0)
                else:
                    ro = r_out + (tooth if tip else 0)
                a += (math.tau / n) * (0.2 if k == 1 else -0.2 if k == 2 else 0)
            c, s = math.cos(a), math.sin(a)
            outer.append((ro * c, ro * s))
            inner.append((ri * c, ri * s))
        h = depth / 2
        new = self.bm.verts.new
        ot = [new(m @ Vector((x, y, h))) for x, y in outer]
        ob = [new(m @ Vector((x, y, -h))) for x, y in outer]
        it = [new(m @ Vector((x, y, h))) for x, y in inner]
        ib = [new(m @ Vector((x, y, -h))) for x, y in inner]
        f = self.bm.faces.new
        for i in range(n):
            j = (i + 1) % n
            f((ot[i], ot[j], it[j], it[i]))
            f((ob[j], ob[i], ib[i], ib[j]))
            f((ob[i], ob[j], ot[j], ot[i]))
            f((it[i], it[j], ib[j], ib[i]))
        return self

    def radial(self, count, radius, fn, phase=0.0):
        """Call fn(matrix) for each of count positions around a circle (local XY)."""
        for i in range(count):
            a = math.tau * i / count + phase
            fn(Matrix.Rotation(a, 4, "Z") @ Matrix.Translation((radius, 0, 0)), a)
        return self

    def ibeam(self, a, b, h=1.2, w=0.8, t=0.14):
        """Steel I-beam between two points (web vertical when possible)."""
        a, b = Vector(a), Vector(b)
        d = b - a
        rot = d.to_track_quat("Z", "Y").to_euler()
        m = Matrix.LocRotScale((a + b) / 2, rot, Vector((1, 1, 1)))
        L = d.length
        for loc, size in (((0, h / 2 - t / 2, 0), (w, t, L)),
                          ((0, -h / 2 + t / 2, 0), (w, t, L)),
                          ((0, 0, 0), (t, h, L))):
            self.box(loc, size, matrix=m)
        return self

    def emit(self, name, mat, parent=None, smooth=False, bevel=0.0, collection=None):
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        if smooth:
            me.shade_smooth()
        obj = bpy.data.objects.new(name, me)
        (collection or bpy.context.scene.collection).objects.link(obj)
        obj.data.materials.append(mat)
        if bevel:
            mod = obj.modifiers.new("Edge highlight", "BEVEL")
            mod.width = bevel
            mod.segments = 2
            mod.limit_method = "ANGLE"
            mod.harden_normals = True
        obj.parent = parent
        return obj


def tube(name, points, radius, mat, parent=None, collection=None):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = radius
    data.bevel_resolution = 3
    sp = data.splines.new("POLY")
    sp.points.add(len(points) - 1)
    for p, co in zip(sp.points, points):
        p.co = (*co, 1)
    obj = bpy.data.objects.new(name, data)
    (collection or bpy.context.scene.collection).objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def catenary(a, b, sag, n=24):
    a, b = Vector(a), Vector(b)
    return [tuple(a.lerp(b, t) - Vector((0, 0, sag * 4 * t * (1 - t)))) for t in (i / n for i in range(n + 1))]


def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location, e.rotation_euler, e.parent = loc, rot, parent
    return e


def spin(obj, rad_per_frame, axis=2, phase=0.0):
    """Constant angular velocity via a driver: exact at any frame, no keyframes."""
    fc = obj.driver_add("rotation_euler", axis)
    fc.driver.type = "SCRIPTED"
    fc.driver.expression = f"{phase} + frame * {rad_per_frame}"
    return obj


def follow(obj, source, ratio, phase=0.0, axis=2):
    """Turn obj at ratio x the source's Z rotation (gear trains share one drive angle)."""
    fc = obj.driver_add("rotation_euler", axis)
    fc.driver.type = "SCRIPTED"
    var = fc.driver.variables.new()
    var.name, var.type = "a", "SINGLE_PROP"
    var.targets[0].id = source
    var.targets[0].data_path = "rotation_euler[2]"
    fc.driver.expression = f"{phase} + {ratio} * a"
    return obj


def text(name, body, loc, rot, size, mat, extrude=0.05, parent=None):
    data = bpy.data.curves.new(name, "FONT")
    data.body = body
    data.size = size
    data.extrude = extrude
    data.align_x = "CENTER"
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location, obj.rotation_euler, obj.parent = loc, rot, parent
    obj.data.materials.append(mat)
    return obj


def light(kind, name, loc, color, power, target=None, size=1.0, spot=None, blend=0.3):
    data = bpy.data.lights.new(name, kind)
    data.color = color
    data.energy = power
    if kind == "AREA":
        data.shape = "DISK"
        data.size = size
    else:
        data.shadow_soft_size = size
    if kind == "SPOT" and spot:
        data.spot_size = math.radians(spot)
        data.spot_blend = blend
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.visible_camera = False
    if target is not None:
        obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return obj


def camera(name, loc, target, lens, fstop=None, focus=None, roll=0.0):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_width = 36
    data.clip_start = 0.02
    data.clip_end = 20000
    if fstop:
        data.dof.use_dof = True
        data.dof.aperture_fstop = fstop
        data.dof.focus_distance = focus or (Vector(target) - Vector(loc)).length
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    aim(obj, target, roll)
    return obj


def aim(obj, target, roll=0.0):
    q = (Vector(target) - Vector(obj.location)).to_track_quat("-Z", "Y")
    obj.rotation_euler = (q @ Euler((0, 0, roll)).to_quaternion()).to_euler()

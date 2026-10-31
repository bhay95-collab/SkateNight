#!/usr/bin/env python3
"""Reproducibly build the Skate by Faith cinematic look-dev scenes in Blender."""

import argparse
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "build" / "cinematic-development"
FPS = 24


def cli():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("build", "stills", "preview"), default="build")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--shot", default="all")
    parser.add_argument("--samples", type=int, default=24)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--frame", type=int)
    parser.add_argument("--preview-seconds", type=float, default=5)
    return parser.parse_args(argv)


def activate(scene):
    bpy.context.window.scene = scene


def clear_scene(scene, name):
    activate(scene)
    for obj in list(scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    scene.name = name
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_percentage = 100
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.fps = FPS
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    scene.render.film_transparent = False


def configure_metal():
    bpy.ops.preferences.addon_enable(module="cycles")
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.get_devices()
    metal = [device for device in prefs.devices if device.type == "METAL"]
    if not metal:
        raise RuntimeError("Blender Cycles did not expose a Metal GPU device.")
    for device in prefs.devices:
        device.use = device.type == "METAL"
    prefs.compute_device_type = "METAL"
    return [device.name for device in metal]


def material(name, color, metallic=0.0, roughness=0.4, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if "Coat Weight" in shader.inputs:
        shader.inputs["Coat Weight"].default_value = coat
    if metallic > 0.3:
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        coords = nodes.new("ShaderNodeTexCoord")
        grain = nodes.new("ShaderNodeTexNoise")
        grain.inputs["Scale"].default_value = 185
        grain.inputs["Detail"].default_value = 2
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.13
        bump.inputs["Distance"].default_value = 0.006
        links.new(coords.outputs["Generated"], grain.inputs["Vector"])
        links.new(grain.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return mat


def emission(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    nodes = mat.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    glow = nodes.new("ShaderNodeEmission")
    glow.inputs["Color"].default_value = (*color, 1)
    glow.inputs["Strength"].default_value = strength
    mat.node_tree.links.new(glow.outputs[0], output.inputs["Surface"])
    return mat


def set_world(scene, color=(0.003, 0.006, 0.012), strength=0.22):
    world = bpy.data.worlds.new(f"{scene.name} World") if not scene.world else scene.world
    scene.world = world
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (*color, 1)
    background.inputs["Strength"].default_value = strength


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def area_light(scene, name, location, target, color, power, size, shape="DISK"):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.shape = shape
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, target)
    return obj


def camera(scene, name, location, target, lens=42):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_end = 300
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, target)
    return obj


def box(name, location, dimensions, mat, bevel=0.08, rotation=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Machined edge radius", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    if parent:
        obj.parent = parent
    return obj


def cylinder(name, location, radius, depth, mat, axis="Z", bevel=0.04, vertices=64, parent=None):
    rotation = (math.pi / 2, 0, 0) if axis == "Y" else (0, 0, 0)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation
    )
    obj = bpy.context.object
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    if bevel:
        modifier = obj.modifiers.new("Edge break", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    if parent:
        obj.parent = parent
    return obj


def torus(name, radius, minor, location, mat, plane="XZ", parent=None, major_segments=192):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=major_segments,
        minor_segments=12,
        major_radius=radius,
        minor_radius=minor,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    if plane == "XZ":
        obj.rotation_euler.x = math.pi / 2
    if mat:
        obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    if parent:
        obj.parent = parent
    return obj


def combined_radial_boxes(name, center_z, boxes, mat, parent=None, bevel=0.035):
    vertices = []
    faces = []
    signs = [
        (-1, -1, -1), (-1, -1, 1), (-1, 1, -1), (-1, 1, 1),
        (1, -1, -1), (1, -1, 1), (1, 1, -1), (1, 1, 1),
    ]
    face_indices = [
        (0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
        (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3),
    ]
    for radius, angle, y, radial, depth, tangential in boxes:
        center = (radius * math.cos(angle), y, center_z + radius * math.sin(angle))
        c, s = math.cos(-angle), math.sin(-angle)
        base = len(vertices)
        for sx, sy, sz in signs:
            x = sx * radial / 2
            z = sz * tangential / 2
            vertices.append((
                center[0] + c * x + s * z,
                center[1] + sy * depth / 2,
                center[2] - s * x + c * z,
            ))
        faces.extend(tuple(base + index for index in face) for face in face_indices)
    mesh = bpy.data.meshes.new(f"{name} mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if bevel:
        modifier = obj.modifiers.new("Tooth edge breaks", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        obj.modifiers.new("Tooth normals", "WEIGHTED_NORMAL")
    if parent:
        obj.parent = parent
    return obj


def curve_tube(name, points, radius, mat, resolution=2):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 16
    data.bevel_depth = radius
    data.bevel_resolution = resolution
    spline = data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def text_object(name, text, location, size, mat, rotation=(math.pi / 2, 0, 0)):
    bpy.ops.object.text_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.size = size
    obj.data.extrude = 0.008
    obj.data.bevel_depth = 0.003
    obj.data.materials.append(mat)
    return obj


def image_emission(name, image_path, strength=1.6):
    mat = bpy.data.materials.new(name)
    nodes = mat.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    glow = nodes.new("ShaderNodeEmission")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(str(image_path), check_existing=True)
    texture.image.pack()
    glow.inputs["Strength"].default_value = strength
    mat.node_tree.links.new(texture.outputs["Color"], glow.inputs["Color"])
    mat.node_tree.links.new(glow.outputs[0], output.inputs["Surface"])
    return mat


def parent_preserving_world(obj, parent):
    world_matrix = obj.matrix_world.copy()
    obj.parent = parent
    bpy.context.view_layer.update()
    obj.matrix_parent_inverse = parent.matrix_world.inverted()
    obj.matrix_world = world_matrix


def add_volume(scene, density=0.0025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 10))
    obj = bpy.context.object
    obj.name = "Sparse industrial haze volume"
    obj.dimensions = (45, 50, 34)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mat = bpy.data.materials.new("Air with a trace of dust")
    nodes = mat.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    volume = nodes.new("ShaderNodeVolumePrincipled")
    volume.inputs["Density"].default_value = density
    volume.inputs["Anisotropy"].default_value = 0.22
    mat.node_tree.links.new(volume.outputs["Volume"], output.inputs["Volume"])
    obj.data.materials.append(mat)


def build_megastructure(scene):
    activate(scene)
    steel = material("Blue-black structural steel", (0.035, 0.075, 0.095), 0.84, 0.27)
    brushed = material("Cool brushed steel", (0.24, 0.34, 0.37), 0.9, 0.22)
    dark_iron = material("Oiled iron", (0.017, 0.024, 0.03), 0.78, 0.32)
    brass = material("Tarnished brass", (0.38, 0.205, 0.07), 0.82, 0.3)
    copper = material("Aged copper", (0.24, 0.09, 0.045), 0.78, 0.31)
    ceramic = material("Black enamel", (0.009, 0.014, 0.024), 0.48, 0.19, 0.34)
    amber = emission("Amber service lamps", (1.0, 0.24, 0.025), 3.2)
    cyan = emission("Cold cyan pilot lamps", (0.015, 0.58, 0.85), 2.8)
    magenta = emission("Magenta arcade spill", (0.72, 0.018, 0.18), 1.6)
    set_world(scene)

    center_z = 10.8
    floor = box("Lower service deck", (0, 1, -1.05), (40, 35, 1.8), dark_iron, 0.18)
    box("Rear bulkhead", (0, 7.5, 11), (30, 1.2, 26), steel, 0.25)
    box("Left machine spine", (-12.3, 1, 10), (1.15, 2.0, 24), brushed, 0.18)
    box("Right machine spine", (12.3, 1, 10), (1.15, 2.0, 24), brushed, 0.18)
    box("Overhead service gantry", (0, 0.8, 21.3), (29, 4.5, 0.85), steel, 0.18)
    box("Gantry amber reveal", (0, -1.53, 20.86), (25, 0.035, 0.055), amber, 0.015)
    box("Foreground maintenance rail", (0, -5.8, 1.2), (24, 0.32, 0.42), brushed, 0.09)

    ring_specs = [
        (3.15, 0.22, -0.75, brass),
        (4.45, 0.15, 0.18, brushed),
        (6.2, 0.28, 0.8, copper),
        (8.05, 0.18, 0.05, brushed),
        (9.65, 0.36, 0.88, brass),
    ]
    rotors = []
    for idx, (radius, thickness, y, ring_mat) in enumerate(ring_specs):
        rotor = bpy.data.objects.new(f"R{idx + 1} - driven ring assembly", None)
        scene.collection.objects.link(rotor)
        rotor.location = (0, 0, center_z)
        rotor.empty_display_type = "CIRCLE"
        rotor.empty_display_size = 0.6
        torus(f"R{idx + 1} bearing race", radius, thickness, (0, y, 0), ring_mat, parent=rotor)
        torus(f"R{idx + 1} inner seal", radius - thickness * 0.68, thickness * 0.15,
              (0, y - 0.23, 0), dark_iron, parent=rotor)
        bolts = []
        count = max(24, int(radius * 15))
        for index in range(count):
            angle = 2 * math.pi * index / count
            bolts.append((radius, angle, y - 0.21, 0.15, 0.19, 0.15))
        combined_radial_boxes(f"R{idx + 1} captive fasteners", 0, bolts, brushed, parent=rotor, bevel=0.025)
        if idx in (2, 4):
            teeth = []
            tooth_count = int(radius * 14)
            for index in range(tooth_count):
                angle = 2 * math.pi * index / tooth_count
                teeth.append((radius, angle, y, 0.46, 0.72, 0.34))
            combined_radial_boxes(f"R{idx + 1} service gear teeth", 0, teeth, dark_iron, parent=rotor, bevel=0.055)
        if idx == 2:
            rotors.append(rotor)

    # Twelve boxed radial beams carry load between the primary races.
    beams = []
    for index in range(12):
        angle = math.tau * index / 12
        beams.append((5.15, angle, -0.26, 3.4, 0.82, 0.34))
    combined_radial_boxes("Primary torque spokes", center_z, beams, steel, bevel=0.08)
    for radius, y in ((4.45, -0.74), (8.05, -0.3)):
        for index in range(12):
            angle = math.tau * index / 12
            x, z = radius * math.cos(angle), center_z + radius * math.sin(angle)
            cylinder(f"Spoke trunnion {radius:.1f}-{index:02d}", (x, y, z), 0.28, 0.42,
                     brass, axis="Y", bevel=0.035, vertices=24)

    # Eight loaded struts connect the outer bearing to the machine's frame.
    frame_struts = []
    for index in range(8):
        frame_struts.append((10.9, math.tau * index / 8, 0.35, 2.9, 1.15, 0.78))
    combined_radial_boxes("Outer bearing load struts", center_z, frame_struts, steel, bevel=0.12)
    for index in range(8):
        angle = math.tau * index / 8
        x, z = 7.65 * math.cos(angle), center_z + 7.65 * math.sin(angle)
        cylinder(f"Hydraulic preload ram {index:02d}", (x, -1.42, z), 0.24, 2.6,
                 dark_iron, axis="Y", bevel=0.055)
        cylinder(f"Hydraulic piston collar {index:02d}", (x, -2.78, z), 0.31, 0.32,
                 brass, axis="Y", bevel=0.045)
        cylinder(f"Hydraulic piston rod {index:02d}", (x, -3.1, z), 0.09, 0.8,
                 brushed, axis="Y", bevel=0.018, vertices=32)

    # The central shaft and motor are mechanically connected to the primary drive ring.
    for y, radius, depth, mat in (
        (-2.0, 1.65, 1.0, steel), (-1.25, 1.22, 0.65, brass),
        (-0.75, 0.78, 0.72, brushed), (0.0, 0.48, 1.1, dark_iron),
    ):
        cylinder(f"Axial drive bearing {y}", (0, y, center_z), radius, depth, mat, axis="Y")
    cylinder("Central shaft core", (0, -2.85, center_z), 0.3, 2.2, brushed, axis="Y")
    for index in range(8):
        angle = math.tau * index / 8
        cylinder(f"Hub locking dog {index:02d}",
                 (1.42 * math.cos(angle), -2.64, center_z + 1.42 * math.sin(angle)),
                 0.22, 0.48, brass, axis="Y", vertices=24)

    # Three gear motors, each with a stator shell, inspection cap and live pilot.
    for index, (x, z) in enumerate(((-6.15, center_z), (6.15, center_z), (0, center_z + 6.1))):
        cylinder(f"Torque motor {index + 1} shell", (x, -1.1, z), 1.18, 2.4, steel, axis="Y")
        torus(f"Motor end-winding {index + 1}", 0.78, 0.16, (x, -2.37, z), copper, parent=None)
        cylinder(f"Motor face enamel {index + 1}", (x, -2.39, z), 0.64, 0.18, ceramic, axis="Y")
        cylinder(f"Motor pilot lamp {index + 1}", (x, -2.51, z), 0.19, 0.05, cyan, axis="Y", bevel=0)
        for bolt_index in range(8):
            angle = math.tau * bolt_index / 8
            cylinder(f"Motor shell bolt {index + 1}-{bolt_index}",
                     (x + 0.91 * math.cos(angle), -2.4, z + 0.91 * math.sin(angle)),
                     0.09, 0.12, brass, axis="Y", vertices=16)

    # Suspended chain, conduit and bundled power cable add scale without decorative clutter.
    for side in (-1, 1):
        x = side * 10.7
        for offset in (-0.46, 0, 0.46):
            curve_tube(f"Power umbilical {side}-{offset}",
                       [(x + offset, 0.0, 20.8), (x + offset * 1.2, -0.1, 18),
                        (x + side * 0.4, -0.15, 15), (x, -0.1, 12.5)],
                       0.075 if offset == 0 else 0.045, copper if offset == 0 else dark_iron)
        for z in (4.5, 7.5, 10.5, 13.5, 16.5):
            box(f"Spine clamp {side}-{z}", (x, -0.55, z), (1.3, 0.75, 0.22), brass, 0.05)

    for index in range(18):
        x = -10.0 + index * 1.18
        cylinder(f"Gantry indicator lens {index:02d}", (x, -1.6, 20.6), 0.11, 0.08,
                 amber if index % 4 == 0 else cyan, axis="Y", bevel=0, vertices=20)

    box("Robot signal CRT housing", (0, -2.05, 19.45), (3.4, 1.0, 2.15), dark_iron, 0.22)
    box("Robot signal bezel", (0, -2.62, 19.45), (2.92, 0.16, 1.72), brushed, 0.16)
    box("Robot signal phosphor glass", (0, -2.73, 19.45), (2.55, 0.08, 1.38), ceramic, 0.13)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -2.79, 19.45), rotation=(math.pi / 2, 0, 0))
    robot_screen = bpy.context.object
    robot_screen.name = "RFAI robot - distant phosphor signal"
    robot_screen.scale = (1.0, 0.57, 1.0)
    robot_screen.data.materials.append(image_emission("Phosphor robot artwork", ROOT / "rfai-logo.png", 1.35))

    text_object("Service plate", "RFAI  /  PLATTER DRIVE  /  08", (-4.2, -3.91, 2.35), 0.42, brass)
    text_object("Motor warning", "HIGH INERTIA  -  KEEP CLEAR", (-4.3, -3.91, 1.82), 0.21, cyan)
    box("Service plate backing", (0, -3.78, 2.12), (9.2, 0.2, 1.25), dark_iron, 0.09)

    # Rotor motion: a loaded first start rebounds; the second start accelerates into tempo.
    rotor = rotors[0]
    keyframes = ((1, 0), (34, 0), (45, 0.11), (54, 0.18), (65, 0.105), (77, 0.10),
                 (108, 0.10), (121, 0.17), (160, 0.48), (210, 1.16), (260, 2.1))
    for frame, angle in keyframes:
        rotor.rotation_euler.y = angle
        rotor.keyframe_insert(data_path="rotation_euler", index=1, frame=frame)
    for name, location, target, color, power, size in (
        ("Warm rake left", (-13, -12, 14), (0, 0, 10), (1.0, 0.28, 0.09), 3600, 9),
        ("Cool key right", (10, -9, 17), (0, 0, 11), (0.12, 0.57, 0.9), 4200, 8),
        ("Magenta edge", (11, 3, 8), (0, 0, 11), (0.8, 0.025, 0.22), 2300, 6),
        ("Overhead amber", (-3, 0, 24), (0, 0, 10), (1.0, 0.45, 0.15), 2800, 5),
        ("Robot signal", (0, 5, 12), (0, -5, 10), (0.04, 0.72, 1.0), 900, 2),
    ):
        area_light(scene, name, location, target, color, power, size)
    add_volume(scene)

    scene.camera = camera(scene, "CAM - Establishing low hero", (1.5, -28, 4.7), (0, 0, 10.8), 36)
    detail = camera(scene, "CAM - Gear train close detail", (6.4, -18.5, 13.8), (4.2, 0.5, 10.5), 54)
    detail.data.dof.use_dof = True
    detail.data.dof.focus_distance = 17
    detail.data.dof.aperture_fstop = 3.5
    scene.frame_start = 1
    scene.frame_end = 260
    scene.frame_set(1)


def add_vinyl_shader(mat):
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.008, 0.012, 0.022, 1)
    shader.inputs["Metallic"].default_value = 0.38
    shader.inputs["Roughness"].default_value = 0.21
    if "Coat Weight" in shader.inputs:
        shader.inputs["Coat Weight"].default_value = 0.42
    coords = nodes.new("ShaderNodeTexCoord")
    centered = nodes.new("ShaderNodeVectorMath")
    centered.operation = "SUBTRACT"
    centered.inputs[1].default_value = (0.5, 0.5, 0.0)
    links.new(coords.outputs["Generated"], centered.inputs[0])
    grooves = nodes.new("ShaderNodeTexWave")
    grooves.wave_type = "RINGS"
    grooves.rings_direction = "Z"
    grooves.inputs["Scale"].default_value = 920
    grooves.inputs["Distortion"].default_value = 0.035
    grooves.inputs["Detail"].default_value = 2
    links.new(centered.outputs[0], grooves.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.22
    bump.inputs["Distance"].default_value = 0.012
    links.new(grooves.outputs["Color"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 500
    noise.inputs["Detail"].default_value = 2
    rough = nodes.new("ShaderNodeMapRange")
    rough.inputs["From Min"].default_value = 0
    rough.inputs["From Max"].default_value = 1
    rough.inputs["To Min"].default_value = 0.16
    rough.inputs["To Max"].default_value = 0.29
    links.new(coords.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], rough.inputs["Value"])
    links.new(rough.outputs["Result"], shader.inputs["Roughness"])


def groove_ridges():
    data = bpy.data.curves.new("Concentric pressed groove crests", "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 1
    data.bevel_depth = 0.009
    data.bevel_resolution = 1
    for index in range(260):
        radius = 5.1 + index * 0.048
        spline = data.splines.new("POLY")
        spline.points.add(383)
        for point_index, point in enumerate(spline.points):
            angle = math.tau * point_index / 384
            point.co = (radius * math.cos(angle), radius * math.sin(angle), 0.222, 1)
        spline.use_cyclic_u = True
    obj = bpy.data.objects.new("Pressed groove crests - concentric geometry", data)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build_groove(scene):
    activate(scene)
    steel = material("Tonearm satin chrome", (0.32, 0.42, 0.46), 0.92, 0.2)
    dark_iron = material("Tonearm blackened steel", (0.015, 0.024, 0.032), 0.84, 0.27)
    brass = material("Tonearm brass collars", (0.42, 0.21, 0.07), 0.82, 0.25)
    groove_metal = material("Pressed groove specular ridges", (0.035, 0.052, 0.071), 0.75, 0.24)
    vinyl = material("Black lacquer with pressed groove", (0.008, 0.012, 0.022), 0.38, 0.21, 0.42)
    add_vinyl_shader(vinyl)
    label = material("Record centre label", (0.15, 0.018, 0.055), 0.25, 0.4)
    amber = emission("Record amber strobes", (1.0, 0.28, 0.05), 2.5)
    cyan = emission("Record cyan instrumentation", (0.015, 0.65, 0.95), 2.8)
    set_world(scene, (0.002, 0.004, 0.009), 0.16)

    record_radius = 18
    bpy.ops.mesh.primitive_cylinder_add(vertices=384, radius=record_radius, depth=0.42, location=(0, 0, 0))
    disc = bpy.context.object
    disc.name = "The record - a landscape of pressed grooves"
    disc.data.materials.append(vinyl)
    for face in disc.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    bevel = disc.modifiers.new("Rolled record edge", "BEVEL")
    bevel.width = 0.12
    bevel.segments = 3
    disc.modifiers.new("Record edge normals", "WEIGHTED_NORMAL")
    record_axis = bpy.data.objects.new("Platter - 33 and one third RPM", None)
    scene.collection.objects.link(record_axis)
    record_axis.empty_display_type = "CIRCLE"
    record_axis.empty_display_size = 0.8
    parent_preserving_world(disc, record_axis)
    record_axis.rotation_euler.z = 0
    spin = record_axis.driver_add("rotation_euler", 2)
    spin.driver.expression = f"(frame - 1) * {math.tau * FPS / 43.2:.12f}"
    record_parts = [disc]
    record_parts.append(torus("Outer record rim", 17.88, 0.08, (0, 0, 0.14), steel, plane="XY", major_segments=384))
    record_parts.append(torus("Lead-in groove highlight", 16.8, 0.022, (0, 0, 0.22), brass, plane="XY", major_segments=384))
    ridges = groove_ridges()
    ridges.data.materials.append(groove_metal)
    record_parts.append(ridges)

    record_parts.append(cylinder("Centre label", (0, 0, 0.235), 4.25, 0.035, label, bevel=0.025, vertices=256))
    record_parts.append(cylinder("Spindle collar", (0, 0, 0.28), 0.62, 0.16, steel, bevel=0.035))
    record_parts.append(cylinder("Spindle pin", (0, 0, 0.4), 0.13, 0.34, brass, bevel=0.025, vertices=48))
    bpy.ops.mesh.primitive_torus_add(major_radius=2.55, minor_radius=0.023, location=(0, 0, 0.26))
    label_ring = bpy.context.object
    label_ring.name = "Label pressed ring"
    label_ring.data.materials.append(brass)
    for face in bpy.context.object.data.polygons:
        face.use_smooth = True
    record_parts.append(label_ring)
    record_parts.append(text_object("Record label title", "SKATE BY FAITH", (-2.85, -0.35, 0.27), 0.55, steel,
                                    rotation=(0, 0, 0)))
    record_parts.append(text_object("Record label subtitle", "NOT BY SIGHT  /  SIDE A", (-2.15, -1.1, 0.27), 0.22, brass,
                                    rotation=(0, 0, 0)))
    for index in range(24):
        angle = math.tau * index / 24
        x, y = 16.8 * math.cos(angle), 16.8 * math.sin(angle)
        record_parts.append(cylinder(f"Record strobe {index:02d}", (x, y, 0.31), 0.12, 0.08,
                                     amber if index % 3 == 0 else cyan, bevel=0, vertices=20))
    for part in record_parts:
        if part != record_axis:
            parent_preserving_world(part, record_axis)

    # Bearing pedestal and the mechanically articulated, weighted tonearm.
    cylinder("Tonearm pivot plinth", (12.9, 6.3, 1.05), 2.1, 2.1, dark_iron)
    cylinder("Tonearm pivot bearing", (12.9, 6.3, 2.2), 1.18, 0.42, steel)
    torus("Pivot bearing race", 0.86, 0.13, (12.9, 6.3, 2.43), brass, plane="XY")
    cylinder("Pivot cap", (12.9, 6.3, 2.72), 0.42, 0.48, brass)
    for z in (0.2, 0.55, 1.8, 2.0):
        box(f"Pivot pedestal rib {z}", (12.9, 6.3, z), (3.4, 3.4, 0.18), steel, 0.09)

    arm_points = [(12.9, 6.3, 2.95), (12.1, 5.2, 3.35), (10.4, 3.6, 3.55),
                  (8.6, 1.7, 3.3), (7.4, 0.8, 2.2), (6.3, 0.0, 1.05)]
    arm_parts = [curve_tube("Tonearm - forged articulated beam", arm_points, 0.19, steel, 4)]
    arm_parts.append(curve_tube("Tonearm copper signal cable",
                                [(13.2, 6.3, 3.15), (12.2, 5.3, 3.68), (10.4, 3.7, 3.83),
                                 (8.6, 1.8, 3.58), (7.4, 0.9, 2.48), (6.3, 0.05, 1.32)],
                                0.045, brass, 3))
    for index, (x, y, z) in enumerate(arm_points[1:-1]):
        arm_parts.append(torus(f"Tonearm articulation collar {index}", 0.28, 0.07, (x, y, z), brass,
                               plane="XY", major_segments=48))
    arm_parts.append(cylinder("Counterweight mass", (11.8, 4.8, 3.36), 0.48, 1.05, dark_iron, axis="Y"))
    arm_parts.append(torus("Counterweight knurl", 0.5, 0.055, (11.8, 4.28, 3.36), brass,
                           plane="XZ", major_segments=96))
    headshell = box("Headshell", (6.12, -0.05, 0.99), (1.1, 0.62, 0.22), dark_iron, 0.08,
                    rotation=(0, -0.45, 0))
    carrier = cylinder("Stylus carrier", (5.82, -0.05, 0.78), 0.16, 0.55, brass, bevel=0.025)
    arm_parts.extend((headshell, carrier))
    needle = curve_tube("Diamond stylus", [(5.82, -0.05, 0.56), (5.82, -0.05, 0.35),
                                           (5.83, -0.05, 0.24)], 0.035, steel, 3)
    arm_parts.append(needle)
    # Animate the complete arm and stylus as one rigid mechanism around the pivot.
    pivot = bpy.data.objects.new("Tonearm pivot axis", None)
    scene.collection.objects.link(pivot)
    pivot.location = (12.9, 6.3, 2.95)
    pivot.empty_display_type = "CIRCLE"
    for obj in arm_parts:
        parent_preserving_world(obj, pivot)
    bpy.ops.object.select_all(action="DESELECT")
    pivot.rotation_euler.x = 0
    pivot.rotation_euler.z = 0
    pivot.keyframe_insert(data_path="rotation_euler", index=0, frame=1)
    pivot.keyframe_insert(data_path="rotation_euler", index=2, frame=1)
    pivot.rotation_euler.x = 0.006
    pivot.keyframe_insert(data_path="rotation_euler", index=0, frame=116)
    pivot.rotation_euler.z = -0.19
    pivot.keyframe_insert(data_path="rotation_euler", index=2, frame=96)
    pivot.rotation_euler.z = -0.33
    pivot.keyframe_insert(data_path="rotation_euler", index=2, frame=120)

    # A distant gantry, maintenance trusses and sparse amber/cyan markers sell scale.
    box("Far maintenance deck", (0, 18, 3.8), (42, 1.0, 0.65), dark_iron, 0.1)
    for x in (-17, -11, 11, 17):
        box(f"Record chamber upright {x}", (x, 18, 8), (0.42, 0.55, 16), steel, 0.09)
        box(f"Upright cyan marker {x}", (x, 17.68, 11), (0.09, 0.045, 2.8), cyan, 0.025)
    for name, location, target, color, power, size in (
        ("Long amber rake", (-4, -8, 11), (0, 0, 0), (1.0, 0.24, 0.055), 3900, 10),
        ("Cyan groove rake", (11, -3, 7), (0, 0, 0), (0.035, 0.48, 0.85), 4400, 7),
        ("Magenta label edge", (-8, 8, 5), (0, 0, 0), (0.75, 0.018, 0.17), 2600, 8),
        ("Tonearm rim light", (17, 7, 10), (9, 3, 1), (1.0, 0.55, 0.2), 3300, 4),
        ("Far-room cyan", (0, 20, 17), (0, 0, 0), (0.04, 0.5, 0.95), 2500, 12),
    ):
        area_light(scene, name, location, target, color, power, size)
    add_volume(scene, density=0.0015)

    scene.camera = camera(scene, "CAM - The record is a world", (25, -36, 23), (0, 0, 0), 39)
    low = camera(scene, "CAM - Riding the groove", (12, -25, 1.3), (2, 0, 0.12), 42)
    low.data.dof.use_dof = True
    low.data.dof.focus_distance = 23
    low.data.dof.aperture_fstop = 5.6
    precontact = camera(scene, "CAM - Stylus before contact", (10.5, -10.7, 5.0), (6.0, 0.2, 0.35), 48)
    precontact.data.dof.use_dof = True
    precontact.data.dof.focus_distance = 13
    precontact.data.dof.aperture_fstop = 2.8
    moving = camera(scene, "CAM - Groove journey", (25, -36, 23), (0, 0, 0), 39)
    moving.keyframe_insert(data_path="location", frame=1)
    moving.data.keyframe_insert(data_path="lens", frame=1)
    moving.keyframe_insert(data_path="rotation_euler", frame=1)
    moving.location = (9.8, -5.0, 3.2)
    point_at(moving, (4.14, 2.62, 0.23))
    moving.data.lens = 48
    moving.data.keyframe_insert(data_path="lens", frame=120)
    moving.keyframe_insert(data_path="location", frame=120)
    moving.keyframe_insert(data_path="rotation_euler", frame=120)
    scene.frame_start = 1
    scene.frame_end = 120
    scene.frame_set(1)


def build_project(output):
    existing = bpy.context.scene
    clear_scene(existing, "01 - Retro-Industrial Megastructure")
    build_megastructure(existing)
    groove = bpy.data.scenes.new("02 - World Within the Groove")
    clear_scene(groove, "02 - World Within the Groove")
    build_groove(groove)
    output.mkdir(parents=True, exist_ok=True)
    path = output / "skate-by-faith-lookdev.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    return path


def render_stills(output, args):
    shots = {
        "mega-hero": ("01 - Retro-Industrial Megastructure", "CAM - Establishing low hero"),
        "mega-detail": ("01 - Retro-Industrial Megastructure", "CAM - Gear train close detail"),
        "groove-wide": ("02 - World Within the Groove", "CAM - The record is a world"),
        "groove-low": ("02 - World Within the Groove", "CAM - Riding the groove"),
        "stylus-precontact": ("02 - World Within the Groove", "CAM - Stylus before contact"),
        "stylus-contact": ("02 - World Within the Groove", "CAM - Stylus before contact"),
    }
    selected = shots if args.shot == "all" else {args.shot: shots[args.shot]}
    for name, (scene_name, camera_name) in selected.items():
        scene = bpy.data.scenes[scene_name]
        activate(scene)
        scene.camera = bpy.data.objects[camera_name]
        scene.cycles.samples = args.samples
        scene.render.resolution_x = args.width
        scene.render.resolution_y = args.height
        scene.render.resolution_percentage = 100
        frame = args.frame if args.frame is not None else (116 if name == "stylus-contact" else 1)
        if not scene.frame_start <= frame <= scene.frame_end:
            raise ValueError(f"Frame {frame} is outside the scene range.")
        scene.frame_set(frame)
        scene.render.filepath = str(output / "stills" / f"{name}.png")
        Path(scene.render.filepath).parent.mkdir(parents=True, exist_ok=True)
        print(f"Rendering {name} with {scene.cycles.samples} Cycles/Metal samples", flush=True)
        bpy.ops.render.render(write_still=True, scene=scene.name)


def render_preview(output, args):
    previews = {
        "mega-hero": ("01 - Retro-Industrial Megastructure", "CAM - Establishing low hero", "megavolt"),
        "groove-journey": ("02 - World Within the Groove", "CAM - Groove journey", "groove-journey"),
    }
    preview_shot = "mega-hero" if args.shot == "all" else args.shot
    if preview_shot not in previews:
        raise ValueError(f"Unknown motion preview shot: {args.shot}")
    scene_name, camera_name, preview_name = previews[preview_shot]
    scene = bpy.data.scenes[scene_name]
    activate(scene)
    scene.camera = bpy.data.objects[camera_name]
    scene.cycles.samples = min(args.samples, 12)
    scene.render.resolution_x = min(args.width, 768)
    scene.render.resolution_y = min(args.height, 432)
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.frame_start = 1
    scene.frame_end = max(2, int(args.preview_seconds * FPS))
    frames = output / "motion" / preview_name
    frames.mkdir(parents=True, exist_ok=True)
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(frames / "frame_")
    print(f"Rendering {scene.frame_end} frames at {scene.render.resolution_x}x{scene.render.resolution_y}, "
          f"{scene.cycles.samples} samples, Cycles/Metal", flush=True)
    bpy.ops.render.render(animation=True, scene=scene.name)
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("FFmpeg is required to encode the motion preview.")
    movie = output / "motion" / f"{preview_name}-motion-preview.mp4"
    subprocess.run([
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-framerate", str(FPS),
        "-i", str(frames / "frame_%04d.png"),
        "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
        "-frames:v", str(scene.frame_end), "-c:v", "libx264", "-preset", "medium",
        "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS), "-c:a", "aac",
        "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(movie),
    ], check=True)
    print(f"Motion preview: {movie}", flush=True)


def main():
    args = cli()
    output = args.output.resolve()
    devices = configure_metal()
    print(f"Blender {bpy.app.version_string}; Cycles/Metal devices: {', '.join(devices)}", flush=True)
    expected_scenes = {"01 - Retro-Industrial Megastructure", "02 - World Within the Groove"}
    loaded_project = Path(bpy.data.filepath)
    has_project = loaded_project.is_file() and expected_scenes.issubset({scene.name for scene in bpy.data.scenes})
    blend = loaded_project if has_project and args.mode != "build" else build_project(output)
    print(f"Editable scene project: {blend}", flush=True)
    if args.mode == "stills":
        render_stills(output, args)
    elif args.mode == "preview":
        render_preview(output, args)


if __name__ == "__main__":
    main()

"""Isolated native-30 production scenes; the approved source builders stay read-only.

Use Blender, e.g. blender -b --python cinematic/extended/render_scene.py --
 --shot vinyl --start 606 --end 1049 --output-dir build/awakening-35-development/v1/frames
Global frame numbers and the cue manifest are the only editorial time axis.
"""
import argparse
import json
import math
import os
from pathlib import Path
import resource
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path[:0] = [str(HERE), str(ROOT / 'cinematic/study'), str(ROOT / 'cinematic')]
import bpy
from mathutils import Matrix, Vector
import kit
import render_study as approved
from timeline import MANIFEST, FPS, FRAME_COUNT, FRAMES, source_frame_for_c1, manifest_sha256
from vinyl_world import build_vinyl, vinyl_frame
from changer import build_changer, changer_frame
from mechanical import build_story


def remap_original_c1(scene):
    """Strictly monotonic source-time inverse, including the endpoint sample."""
    cam=scene.camera;rec=bpy.data.objects['Record (rotates)']
    reference={}
    for f in range(915,1050):
        sf=source_frame_for_c1(f)
        scene.frame_set(math.floor(sf),subframe=sf%1)
        reference[f]=(cam.location.copy(),cam.rotation_euler.to_quaternion(),cam.data.lens,rec.rotation_euler.z)
    def mapped(x):
        if x<=239:return 915+(x-175)/2
        if x<240:return 947+(x-239)
        if x<=440:return 948+(x-240)/2
        return 1048+(x-440)/3
    for fc in approved.curves():
        points=[(p,p.co.copy(),p.handle_left.copy(),p.handle_right.copy()) for p in fc.keyframe_points]
        for p,co,left,right in points:
            p.co=(mapped(co.x),co.y)
            p.handle_left=(mapped(left.x),left.y)
            p.handle_right=(mapped(right.x),right.y)
        fc.update()
    errors=[]
    for f,(pos,q,lens,angle) in reference.items():
        scene.frame_set(f)
        error=dict(frame=f,source_frame=source_frame_for_c1(f),position_error=(cam.location-pos).length,
                   rotation_error=cam.rotation_euler.to_quaternion().rotation_difference(q).angle,
                   lens_error=abs(cam.data.lens-lens),record_angle_error=abs(rec.rotation_euler.z-angle))
        if error['position_error']>1e-4 or error['rotation_error']>1e-4 or error['lens_error']>1e-5 or error['record_angle_error']>1e-6:
            raise ValueError('C1 source pose changed: '+repr(error))
        errors.append(error)
    return errors


def story_frame(scene, frame, state):
    for marker in sorted(scene.timeline_markers, key=lambda m: m.frame):
        if marker.camera and marker.frame <= frame:
            scene.camera = marker.camera
    if frame < 164:
        approved.S.configure_entry_color(scene, frame * 2)
    else:
        approved.S.configure_entry_color(scene, 328)
    if 345<=frame<398:
        bpy.context.view_layer.update()
        camera=scene.camera
        direction=camera.rotation_euler.to_quaternion()@Vector((0,0,-1))
        hit,location,normal,index,obj,matrix=scene.ray_cast(bpy.context.evaluated_depsgraph_get(),camera.location,direction,distance=300)
        clearance=(location-camera.location).length if hit else None
        if hit and clearance<.25:
            raise ValueError(f'Story camera inside/too close to geometry at {frame}: {obj.name} {clearance}')
        return {'shaft_origin':state['shaft_origin'],'gearbox_target':state['gearbox_target'],
                'centre_ray_hit':obj.name if hit else None,'centre_ray_clearance':clearance}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shot', choices=['story', 'changer', 'vinyl'], required=True)
    ap.add_argument('--start', type=int, required=True)
    ap.add_argument('--end', type=int, required=True)
    ap.add_argument('--width', type=int, default=480)
    ap.add_argument('--height', type=int, default=270)
    ap.add_argument('--samples', type=int, default=8)
    ap.add_argument('--engine', choices=['cycles', 'eevee'], default='cycles')
    ap.add_argument('--output-dir', type=Path, required=True)
    ap.add_argument('--assets-root', type=Path, default=Path('/Users/benjaminhay/SkateNight'))
    ap.add_argument('--resume', action='store_true')
    ap.add_argument('--frames', help='Comma-separated global frames for spot validation')
    ap.add_argument('--save', action='store_true')
    ap.add_argument('--render-full','--production-render', action='store_true', help='Explicit future production opt-in; never used during development')
    ap.add_argument('--validate-only',action='store_true')
    args = ap.parse_args(sys.argv[sys.argv.index('--')+1:])
    if not 0 <= args.start <= args.end < FRAME_COUNT:
        raise ValueError('Invalid global frame range')
    ranges={shot['id']:(shot['start'],shot['end']) for shot in MANIFEST['shots'] if shot['renderer']=='blender'}
    lo,hi=ranges[args.shot]
    if args.start<lo or args.end>hi:
        raise ValueError(f'{args.shot} only owns global frames {lo}..{hi}')
    selected_count=len(args.frames.split(',')) if args.frames else args.end-args.start+1
    if args.width >= 1920 and selected_count > 8 and not args.render_full:
        raise ValueError('Full-resolution movie rendering is deliberately blocked; use selected stills only')
    args.output_dir.mkdir(parents=True, exist_ok=True)
    kit.ROOT = args.assets_root
    os.environ.setdefault('SKATENIGHT_UI_PLATE',str(args.assets_root/'build/cinematic-phase4/ui-plate.png'))
    os.environ.setdefault('SKATENIGHT_COIN_ENTRY_PLATE',str(args.assets_root/'build/awakening-final-prep-v27/assets/transition/entry-plate.png'))
    os.environ.setdefault('SKATENIGHT_COIN_TEXTURE',str(args.assets_root/'build/awakening-final-prep-v27/assets/transition/coin-face.png'))
    approved.S.ROBOT = args.assets_root/'rfai-logo.png'
    scene = kit.fresh_scene('The Song Inside — 35 seconds — '+args.shot)
    import importlib.util
    spec=importlib.util.spec_from_file_location('extended_production_pipeline',HERE/'render_production.py')
    pipeline=importlib.util.module_from_spec(spec);spec.loader.exec_module(pipeline)
    source_fingerprint=pipeline.source_fingerprint;ensure_render_state=pipeline.ensure_render_state
    from frame_io import png_dimensions
    settings=dict(width=args.width,height=args.height,samples=args.samples,engine=args.engine,shot=args.shot,fps=30)
    if not args.validate_only:
        ensure_render_state(args.output_dir,source_fingerprint(args.assets_root,settings),args.resume,state_name=f'render-state-{args.shot}.json',frame_range=ranges[args.shot])
    setup = time.perf_counter()
    G = approved.groove_module()
    if args.shot == 'story':
        state = build_story(scene); update = story_frame
        scene.cycles.volume_step_rate = 3.0
    elif args.shot == 'changer':
        state = build_changer(scene, G); update = changer_frame
        scene.cycles.volume_step_rate = 4.0
    else:
        approved.approved_groove(scene, G)
        c1_errors=remap_original_c1(scene)
        (args.output_dir/'c1-source-equivalence.json').write_text(json.dumps(c1_errors,indent=2))
        state = build_vinyl(scene, G); update = vinyl_frame
        if args.validate_only:
            subframes=[]
            for n in range((813-655)*4+1):
                t=655+n/4
                scene.frame_set(math.floor(t),subframe=t%1)
                row=vinyl_frame(scene,t,state)
                subframes.append(dict(frame=t,lateral=row['groove_lateral_offset'],floor_clearance=row['groove_floor_clearance']))
            (args.output_dir/'micro-subframe-clearance.json').write_text(json.dumps(subframes,indent=2))
        scene.cycles.volume_step_rate = 4.0
    scene.render.fps = FPS
    scene.render.engine = 'CYCLES' if args.engine == 'cycles' else 'BLENDER_EEVEE'
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    if args.engine == 'eevee':
        scene.eevee.taa_render_samples = args.samples
        scene.eevee.motion_blur_steps = 4
    scene.render.resolution_x = args.width; scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.use_motion_blur = True
    scene.render.motion_blur_shutter = .5
    scene.render.motion_blur_position = 'CENTER'
    scene.render.image_settings.file_format = 'PNG'
    scene.frame_start = 0; scene.frame_end = FRAME_COUNT-1
    scene.render.film_transparent = False
    info = dict(validate_only=args.validate_only,shot=args.shot, fps=FPS, width=args.width, height=args.height,
                samples=args.samples, engine=args.engine, manifest_sha256=manifest_sha256(),
                shutter_frames=.5, exposure_seconds=.5/FPS, setup_seconds=time.perf_counter()-setup,
                objects=len(scene.objects), mesh_vertices=sum(len(o.data.vertices) for o in scene.objects if o.type=='MESH'), frames=[])
    selected = [int(f) for f in args.frames.split(',')] if args.frames else range(args.start,args.end+1)
    if any(not args.start<=f<=args.end for f in selected):
        raise ValueError('Selected proof frames must fall inside the requested global range')
    # Frame pose metadata is appended after each atomic image rename. The pipeline
    # separately validates PNG CRC/dimensions and source fingerprints on resume.
    for f in selected:
        path = args.output_dir/f'frame_{f:04d}.png'
        if args.resume and png_dimensions(path)==(args.width,args.height):
            continue
        scene.frame_set(f)
        extra = update(scene, f, state) or {}
        bpy.context.view_layer.update()
        if not all(math.isfinite(v) for v in scene.camera.matrix_world.translation):
            raise ValueError('Non-finite camera pose')
        scene.render.filepath = str(args.output_dir/f'.frame_{f:04d}.{os.getpid()}.tmp.png')
        before = time.perf_counter()
        if not args.validate_only:
            bpy.ops.render.render(write_still=True)
            temporary=Path(scene.render.filepath)
            if png_dimensions(temporary)!=(args.width,args.height):
                raise RuntimeError(f'Blender produced invalid {args.width}x{args.height} PNG for frame {f}; previous frame preserved')
            temporary.replace(path)
        row = dict(frame=f, seconds=f/FPS, wall_seconds=time.perf_counter()-before,
                   bytes=path.stat().st_size if path.exists() else 0, peak_rss_bytes=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                   camera_position=list(scene.camera.matrix_world.translation),
                   camera_quaternion=list(scene.camera.matrix_world.to_quaternion()), lens=scene.camera.data.lens, **extra)
        info['frames'].append(row)
        (args.output_dir/f'render-{args.shot}.json').write_text(json.dumps(info,indent=2))
        print('EXTENDED_FRAME '+json.dumps(row), flush=True)
    if args.save:
        bpy.ops.wm.save_as_mainfile(filepath=str(args.output_dir/f'{args.shot}.blend'))


if __name__ == '__main__':
    main()

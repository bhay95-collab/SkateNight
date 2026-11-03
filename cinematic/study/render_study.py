"""Isolated Blender studies. Read approved builders; never write to their outputs.

blender -b --python cinematic/study/render_study.py -- --shot carousel-a --fps 30
Seconds govern motion; both rates evaluate the same continuous curves.
"""
import argparse
import json
import math
import os
from pathlib import Path
import sys
import time
import types

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "cinematic"))
import bpy
from mathutils import Matrix, Vector
import kit
import hero_megastructure as H
import story_megastructure as S
import drive_detail


def groove_module():
    # The approved groove file executes main() on import. Load definitions only.
    path = ROOT / "cinematic/hero_groove.py"
    module = types.ModuleType("study_approved_groove")
    module.__file__ = str(path)
    exec(compile(path.read_text().rsplit("\nmain()", 1)[0], str(path), "exec"), module.__dict__)
    return module


def keys(owner, path, values):
    for seconds, value in values:
        setattr(owner, path, value)
        owner.keyframe_insert(path, frame=seconds * 60)


def curves():
    for action in bpy.data.actions:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    yield from bag.fcurves


def retime(fps):
    for fc in curves():
        for p in fc.keyframe_points:
            x,left,right=p.co.x,p.handle_left.x,p.handle_right.x
            p.co.x=x*fps/60
            p.handle_left.x=left*fps/60
            p.handle_right.x=right*fps/60
        fc.update()
    for obj in bpy.data.objects:
        if obj.animation_data:
            for fc in obj.animation_data.drivers:
                if "frame" in fc.driver.expression:
                    fc.driver.expression = fc.driver.expression.replace("frame", f"(frame*{60/fps})")


def camera(name, poses):
    return S.camera_path(name, [(s * 60, p, t, l) for s, p, t, l in poses])


def simple_material(name, color, metal=0, rough=.4, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Emission Color"].default_value = (*color, 1)
    bsdf.inputs["Emission Strength"].default_value = emission
    mat.diffuse_color = (*color, 1)
    return mat


def mechanical(scene, shot):
    M = H.materials()
    root, drive = H.build_drive(M)
    H.build_hall(M)
    drive_detail.build_background(M, drive)
    drive_detail.build_foreground(M)
    lights = H.build_lights("lit")
    kit.fog(scene, (130, 260, 140), (0, 0, 14), .0016, anisotropy=.7)
    entry = S.build_coin_journey(scene, M)
    cue = json.loads((HERE / "cues.json").read_text())["seconds"]
    if shot not in ("coin","baseline-story","baseline-dark"):
        original = S.CUES
        S.F = {k: round(v*60) if isinstance(v, (int,float)) else [round(t*60) for t in v]
               for k,v in cue.items()}
        S.F["toRecord"] = round(cue["carousel"]*60)
        S.F["lockBeats"]=[round((cue["ignite"]+i*.4465)*60) for i in range(8)]
        # Interpolate the proven supply curve at the new story beats.
        anchors = [(0,0), (327,S.F["relay"]), (357,S.F["attempt"]), (426,S.F["almost"]),
                   (453,S.F["failure"]), (584,S.F["catch"]), (752,S.F["ignite"]), (859,S.F["toRecord"])]
        def mapped(f):
            for (a,x),(b,y) in zip(anchors,anchors[1:]):
                if a <= f <= b: return x+(y-x)*(f-a)/(b-a)
            return anchors[-1][1]+f-anchors[-1][0]
        S.CUES = {**original, "supply": {"points": [(mapped(f),v) for f,v in original["supply"]["points"]]}}
    frames = range(186, S.F["toRecord"]+1)
    S.animate_lights(lights, frames)
    S.animate_emission(M, frames)
    speed = S.drive_profile(frames)
    drive.driver_remove("rotation_euler", 2)
    angle = 0
    for f,w in speed.items():
        angle += w
        drive.rotation_euler[2] = angle
        drive.keyframe_insert("rotation_euler", index=2, frame=f)
    S.animate_dial(M, bpy.data.objects["Dial needle"], speed)
    if shot == "coin":
        scene.camera = entry
        return
    if shot == "baseline-story":
        scene.camera=camera("Approved lock camera",[(752/60,(-4,-47,5.2),(0,46,25),24),(858/60,(6.5,-14,13),(-1,48,33),18)])
        return
    if shot == "baseline-dark":
        scene.camera=camera("Approved failed-drive camera",[(327/60,(-9,-57,2.2),(2,48,30),18),(583/60,(-7.5,-49,2.8),(2,48,30),22)])
        return
    attempt = camera("Resistance and backlash", [
        (5.45,(-9,-57,2.2),(2,48,30),18), (8.3,(-7.5,-49,2.8),(2,48,30),22),
        (9.2,(-7.5,-49,2.8),(2,48,30),22)])
    robot = camera("Robot returns, camera finds the shaft", [
        (9.2,(.6,19,26.4),(0,31,26),32), (10.4,(.2,12,26),(0,31,26),30),
        (11.5,(-3.5,0,26),(0,40,26.5),26)])
    # The motor, coupling and planet shaft are already present in the master.
    # Travel beside the lowest accessible shaft, then follow its driven gear.
    chase = camera("Follow torque", [
        (11.5,(-3.5,0,26),(0,40,26.5),26),
        (12.2,(14,22,9),(28,36,8),23),
        (13.0,(24,26,5),(33,37,3),24),
        (14.1,(23,25,14),(16,42,18),22),
        (15.2,(10,8,12),(0,46,26),19)])
    for s,cam in ((5.45,attempt),(9.2,robot),(11.5,chase)):
        scene.timeline_markers.new(cam.name, frame=round(s*60)).camera = cam
    scene.camera = attempt


def carousel(scene, G, shot):
    M = G.materials()
    G.build_changer(M)
    rec = kit.Batch().cyl((0,0,-3),G.R,6,segs=384).emit("Active vinyl proxy",M["vinyl"])
    kit.Batch().cyl((0,0,.1),G.R*.4,.2,segs=192).emit("Active record label proxy", M["label"],rec)
    kit.spin(rec,-G.OMEGA_GIANT/60)
    # Wire the index rails to one rotor; selection arm is deliberately greybox.
    rotor = kit.empty("Index rotor")
    for obj in list(scene.objects):
        if obj.name.startswith("Carousel") and obj.type == "MESH": obj.parent = rotor
    keys(rotor,"rotation_euler",[(0,(0,0,0)),(5,(0,0,-math.radians(6)))])
    select = kit.Batch().box((0,0,0),(22,250,18)).emit("Selection linkage PROXY",M["brass"])
    keys(select,"location",[(0,(-250,470,-34)),(3,(-250,470,-34)),(5,(-100,220,-34))])
    for loc,target in (((-450,-450,500),(0,0,0)),((500,300,450),(0,0,20)),((0,0,700),(500,0,0))):
        kit.light("AREA","Magazine softbox",loc,(.65,.8,1),3e7,target=target,size=450)
    kit.light("AREA","Magazine warm rim",(-900,200,220),(1,.55,.22),2e7,target=(0,0,0),size=500)
    if shot == "carousel-a":
        scene.camera = camera("A — label pass to radial crane",[
            (0,(-780,-140,88),(-700,110,58),25),
            (1.4,(-840,200,145),(-620,280,55),25),
            (3.3,(-1000,-620,720),(0,0,5),26),
            (5,(-650,-1000,1270),(0,0,0),28)])
    else:
        poses=[]
        for i in range(6):
            s=i
            a=math.radians(212-70*i/5)
            poses.append((s,(1100*math.cos(a),1100*math.sin(a),360+180*i/5),(0,0,20),24))
        scene.camera=camera("B — constant-radius orbit",poses)


def transmission(scene,G):
    """Greybox a visible drive path into the existing 360-tooth index ring."""
    carousel(scene,G,"carousel-b")
    for marker in list(scene.timeline_markers):scene.timeline_markers.remove(marker)
    M=G.materials()
    angle=math.radians(205)
    origin=Vector((660*math.cos(angle),660*math.sin(angle),-24))
    basis=Matrix.Rotation(angle,3,"Z")
    frame=kit.empty("Transfer gearbox PROXY",origin,(0,0,angle))
    shaft=kit.Batch().cyl((0,0,0),4,340,rot=(0,math.pi/2,0),segs=32)
    for x in (-140,-30,100):shaft.cyl((x,0,0),8,9,rot=(0,math.pi/2,0),segs=12)
    shaft=shaft.emit("New transmission shaft PROXY",M["chrome"],frame)
    shaft.location=(-185,0,-15)
    kit.spin(shaft,1.1/60,axis=0)
    housing=kit.Batch()
    for x in (-320,-180,-60):housing.box((x,0,-25),(22,32,28))
    housing.box((-10,0,-18),(40,40,38)).emit("Pillow blocks and transfer gearbox PROXY",M["iron"],frame)
    pinion=kit.Batch().ring(4,14,6,teeth=24,tooth=3).emit("Driven index pinion PROXY",M["brass"],frame)
    pinion.location=(0,0,5)
    kit.spin(pinion,1.1/60,axis=2)
    rotor=bpy.data.objects["Index rotor"]
    rotor.animation_data_clear()
    kit.spin(rotor,-1.1/60*24/360)
    # The fixed index motor must not orbit with its magazine.
    bpy.data.objects["Carousel index drive"].parent=None
    def p(v):return origin+basis@Vector(v)
    scene.camera=camera("Power reaches the record changer",[
        (0,p((-340,-75,-85)),p((-180,0,-15)),25),
        (.8,p((-120,-90,-65)),p((0,0,-15)),25),
        (1.15,p((90,-140,-45)),p((0,0,0)),24),
        (1.7,p((160,-190,120)),p((55,0,55)),23)])
    kit.light("AREA","Transfer service key",p((-180,-100,-80)),(1,.72,.42),3e6,target=p((-130,0,-15)),size=160)


def canyon(scene, G, rich):
    """Same V groove at x1000 camera scale. No change to vinyl depth/pitch ratio."""
    K=1000.0
    radius=G.CONTACT_R*K
    pitch,depth,width=G.PITCH*K,G.DEPTH*K,G.GROOVE_W*K
    vinyl=G.vinyl("Greybox vinyl, approved spiral shading")
    vinyl.node_tree.nodes["Mix"].inputs[6].default_value=(.02,.023,.03,1)
    texture_space=kit.empty("Vinyl coordinates at x1000",(-radius,0,0))
    texture_space.scale=(K,K,K)
    vinyl.node_tree.nodes["Texture Coordinate"].object=texture_space
    metal=simple_material("Integrated service structures",(.13,.17,.18),.65,.35)
    amber=simple_material("Window amber",(1,.38,.08),emission=3)
    cyan=simple_material("Guide cyan",(.12,.6,.7),emission=2)
    # Coordinates measured along the true curved groove centreline; each adjacent
    # groove retains its V profile. Industrial pieces stay below the surface.
    def point(s,x=0,z=0):
        theta=s/radius
        r=radius+G.PITCH*K*theta/math.tau+x
        return Vector((r*math.cos(theta)-radius,r*math.sin(theta),z))
    vertices=[];faces=[]
    n=800
    profile=[]
    for j in range(-5,6):
        for x,z in ((-width/2,0),(-20,-depth),(20,-depth),(width/2,0),(pitch-width/2,0)):
            profile.append((j*pitch+x,z))
    for i in range(n+1):
        s=-500+4200*i/n
        for x,z in profile:
            modulation=5*math.sin(s/170)+2*math.sin(s/37)
            vertices.append(point(s,x+modulation,z))
    row=len(profile)
    for i in range(n):
        for j in range(row-1):
            a=i*row+j;faces.append((a,a+1,a+row+1,a+row))
    me=bpy.data.meshes.new("V profile, 0.4 pitch / 0.13 depth x1000")
    me.from_pydata(vertices,[],faces);me.update()
    obj=bpy.data.objects.new("Actual proportion vinyl canyon",me)
    scene.collection.objects.link(obj);obj.data.materials.append(vinyl)
    kit.Batch().box((0,1600,-depth-6),(160000,160000,10)).emit("Vinyl surface beyond camera detail",vinyl)
    structures,windows=kit.Batch(),kit.Batch()
    count=65 if rich else 16
    for i in range(count):
        s=80+i*(2900/count); side=(-1)**i
        x=side*(62+9*math.sin(i*1.7)); z=-68
        h=26+(i*17%38)
        p=point(s,x,z)
        structures.box(p,(12,20,h))
        for k in range(2 if rich else 1): windows.box(p+Vector((-side*6.2,0,h*.15-k*9)),(.6,12,2))
    for s in ((600,1400,2200) if rich else (1400,)):
        a,b=point(s,-78,-45),point(s,78,-45)
        structures.ibeam(a,b,h=7,w=7,t=1)
        for x in (-78,78): structures.box(point(s,x,-73),(8,10,60))
    structures.emit("Rich utilities" if rich else "Restrained utilities",metal)
    windows.emit("Windows embedded below groove lip",amber)
    # The lead-in surface remains readable in the exit, with a stylus at exactly
    # the point the flight has been approaching. Reuse the approved arm assembly.
    GM=G.materials(); lift,L,tower=G.build_arm(GM)
    destination=point(2920)
    th=math.atan2(G.TIP.y,G.TIP.x)
    transform=kit.empty("Approved stylus at canyon's exit",destination)
    transform.rotation_euler.z=-th
    transform.scale=(K,K,K)
    transform.location=destination-(Matrix.Rotation(-th,3,"Z") @ G.TIP)*K
    lift.parent=transform;tower.parent=transform
    G.lower_arm(lift,L,((0,2),(9*60,.6),(12.8*60,.12),(13.9*60,0)))
    # Authored flight lasts 13.9 s, including a full emergence and needle hold.
    q=G.macro_orientation()
    ray=Vector(((G.HEAD_PX.x-960)/1920*36,-(G.HEAD_PX.y-540)/1920*36,-35)).normalized()
    u=174/239; e=u*u*u*(u*(u*6-15)+10)
    dist=math.exp(math.log(21)+(math.log(16)-math.log(21))*e)
    rz=Matrix.Rotation(-th,3,"Z")
    match_position=destination-rz@(q@ray)*dist*K
    match_target=match_position+rz@(q@Vector((0,0,-1)))*dist*K
    path=[(0,point(-500,450,1400),point(160,0,-70),24),
          (1.2,point(40,25,16),point(270,0,-90),21),
          (2.2,point(260,0,-76),point(510,0,-82),20),
          (4.3,point(860,8,-83),point(1100,0,-82),20),
          (6.4,point(1520,-6,-82),point(1780,0,-80),20),
          (8.4,point(2160,5,-78),point(2420,0,-72),21),
          (9.3,point(2450,0,-60),point(2760,0,-20),22),
          (10.3,point(2750,-130,250),point(2920,0,0),26),
          (11.5,point(2920,-1500,3300),point(2920,0,160),30),
          (12.8,point(2920,-11000,15000),point(2920,0,1000),35),
          (13.9,match_position,match_target,35)]
    scene.camera=camera("Descend — fly — emerge — reveal",path)
    scene.camera.data.clip_end=4e6
    if rich:
        for i in range(4):
            vehicle=kit.Batch().box((0,0,0),(6,13,4)).emit(f"Service carrier {i}",cyan)
            keys(vehicle,"location",[(0,point(300+i*700,38,-105)),(13.9,point(1000+i*700,38,-105))])
    for s in (0,1000,2000,3200):
        kit.light("AREA","Groove strip",point(s,80,180),(.65,.8,1),1.6e6,target=point(s,0,-80),size=420)
    for s in range(-200,3600,400):
        kit.light("AREA","Recessed service light",point(s,0,-25),(1,.62,.3),3e4,target=point(s+60,0,-125),size=85)
    kit.light("AREA","Exit broad key",point(2600,-3000,12000),(1,.7,.4),2e10,target=destination,size=10000)
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value=(.08,.10,.14,1)


def approved_groove(scene,G):
    M=G.materials();rec=G.build_record(M);G.build_changer(M)
    lift,L,tower=G.build_arm(M)
    G.lower_arm(lift,L,((1,46),(150,14),(175,7.5),(215,1.3),(232,.25),(240,0)))
    haze,tubes=G.build_environment(M)
    G.ui_match_light(373,443);G.match_css_record(M,373,443)
    pin=kit.camera("Approved C1, original time axis",(0,0,10),(0,0,0),18)
    pin.data.clip_end=400000
    q=G.macro_orientation()
    d=dict(G.pinned_camera(pin,(1,240),21,16,35,35,q,q))
    d.update(G.pinned_camera(pin,(240,443),16,G.final_distance(600),35,600,q,settle=.85))
    angles=G.bake_record(rec,d);G.leave_the_giant_world(haze,tubes,d)
    pin.data.dof.use_dof=True;pin.data.dof.aperture_fstop=4
    for f,dist in d.items():
        pin.data.dof.focus_distance=dist;pin.data.keyframe_insert("dof.focus_distance",frame=f)
    rim=M["neon_rim"].node_tree.nodes["Emission"].inputs["Strength"]
    keys(rim,"default_value",[(5,24),(6.5,0)])
    G.fade_tonearm((lift,tower),373,443)
    scene.camera=pin
    return angles[443]


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--shot",required=True,choices=["mechanical","coin","baseline-story","baseline-dark","baseline-carousel","transmission","carousel-a","carousel-b","canyon-sparse","canyon-rich","stylus","landing","vinyl"])
    ap.add_argument("--source-root",type=Path,default=Path("/Users/benjaminhay/SkateNight"))
    ap.add_argument("--fps",type=int,choices=[30,60],default=30)
    ap.add_argument("--engine",choices=["eevee","cycles","workbench"],default="eevee")
    ap.add_argument("--samples",type=int,default=8)
    ap.add_argument("--width",type=int,default=480)
    ap.add_argument("--height",type=int,default=270)
    ap.add_argument("--start",type=float,default=0)
    ap.add_argument("--end",type=float)
    ap.add_argument("--still",type=float)
    ap.add_argument("--out",type=Path,required=True)
    ap.add_argument("--save",action="store_true")
    ap.add_argument("--no-blur",action="store_true")
    ap.add_argument("--motion-duration",type=float)
    ap.add_argument("--source-origin-sec",type=float,default=0)
    args=ap.parse_args(sys.argv[sys.argv.index("--")+1:])
    args.out.mkdir(parents=True,exist_ok=True)
    kit.ROOT=args.source_root
    os.environ["SKATENIGHT_UI_PLATE"]=str(args.source_root/"build/cinematic-phase4/ui-plate.png")
    os.environ["SKATENIGHT_COIN_ENTRY_PLATE"]=str(args.source_root/"build/awakening-final-prep-v27/assets/transition/entry-plate.png")
    os.environ["SKATENIGHT_COIN_TEXTURE"]=str(args.source_root/"build/awakening-final-prep-v27/assets/transition/coin-face.png")
    S.ROBOT=args.source_root/"rfai-logo.png"
    scene=kit.fresh_scene("30 fps STUDY — "+args.shot)
    if args.shot in ("mechanical","coin","baseline-story","baseline-dark"):scene.cycles.volume_step_rate=3.0
    elif args.shot in ("stylus","landing","vinyl","baseline-carousel"):scene.cycles.volume_step_rate=4.0
    G=groove_module()
    setup=time.perf_counter()
    final_angle=None
    if args.shot in ("mechanical","coin","baseline-story","baseline-dark"): mechanical(scene,args.shot)
    elif args.shot=="transmission": transmission(scene,G)
    elif args.shot.startswith("carousel"): carousel(scene,G,args.shot)
    elif args.shot.startswith("canyon"):
        canyon(scene,G,args.shot.endswith("rich"))
        retime(60*385/417)  # fit the full entrance/flight/exit before the unchanged C1 approach
    else:
        final_angle=approved_groove(scene,G)
        if args.shot=="vinyl":
            scene.camera=camera("Approved record, experimental glide",[(0,(-250,-520,46),(520,-40,50),24),(3,(50,-620,90),(520,-40,50),24)])
        elif args.shot=="baseline-carousel":
            scene.camera=kit.camera("Approved B1 wide",(-250,-520,46),(520,-40,50),24,fstop=11,focus=700)
    if args.motion_duration:
        canonical=385/30 if args.shot.startswith("canyon") else 5
        retime(60*args.motion_duration/canonical)
    retime(args.fps)
    for marker in scene.timeline_markers: marker.frame=round(marker.frame*args.fps/60)
    scene.render.fps=args.fps
    scene.render.engine={"eevee":"BLENDER_EEVEE","cycles":"CYCLES","workbench":"BLENDER_WORKBENCH"}[args.engine]
    if args.engine=="eevee":
        scene.eevee.taa_render_samples=args.samples
        scene.eevee.motion_blur_steps=4
    scene.cycles.samples=args.samples
    scene.cycles.use_denoising=True
    scene.render.resolution_x=args.width;scene.render.resolution_y=args.height
    scene.render.resolution_percentage=100
    scene.render.use_motion_blur=not args.no_blur
    scene.render.motion_blur_shutter=.5
    scene.render.motion_blur_position="CENTER"
    scene.render.image_settings.file_format="PNG"
    scene.render.film_transparent=False
    end=args.end if args.end is not None else {"mechanical":15.2,"coin":5.45,"carousel-a":5,"carousel-b":5,"canyon-sparse":13.9,"canyon-rich":13.9,"stylus":4.1,"landing":443/60,"vinyl":2.45}[args.shot]
    start=args.start
    scene.frame_start=round(start*args.fps);scene.frame_end=round(end*args.fps)-1
    metadata={"shot":args.shot,"fps":args.fps,"engine":scene.render.engine,"samples":args.samples,"width":args.width,"height":args.height,
              "shutterFrames":.5 if not args.no_blur else 0,"exposureSec":.5/args.fps if not args.no_blur else 0,"motionBlur":not args.no_blur,"setupSec":time.perf_counter()-setup,
              "objects":len(scene.objects),"meshVertices":sum(len(o.data.vertices) for o in scene.objects if o.type=="MESH"),
              "volumeStepRate":scene.cycles.volume_step_rate,"maxBounces":scene.cycles.max_bounces,"volumeBounces":scene.cycles.volume_bounces,
              "sourceCommit":"0c99f8befe80ebe4a6ea7e3c6c3432ad05c70bc8","sourceRoot":str(args.source_root),"finalCssAngleDeg":math.degrees(-final_angle)%360 if final_angle is not None else None,"frames":[]}
    if args.save: bpy.ops.wm.save_as_mainfile(filepath=str(args.out/(args.shot+".blend")))
    frames=[round(args.still*args.fps)] if args.still is not None else range(scene.frame_start,scene.frame_end+1)
    if args.out.name.startswith("bench-") and args.out.name!="bench-mega-approved":
        frames=list(frames)[:1]  # one full-quality spot per class; repeat the expensive baseline for a warm measurement
    for f in frames:
        evaluation=f+args.source_origin_sec*args.fps
        scene.frame_set(math.floor(evaluation),subframe=evaluation%1)
        if args.shot=="landing" and args.fps==30 and f==221:
            scene.frame_set(221,subframe=.5)  # preserve approved g443 endpoint within half a 30-fps frame
        markers=sorted((m.frame,m.camera) for m in scene.timeline_markers if m.camera)
        for mf,cam in markers:
            if mf<=evaluation: scene.camera=cam
        if args.shot=="coin": S.configure_entry_color(scene,f*60/args.fps)
        path=args.out/f"frame_{f:05d}.png"
        scene.render.filepath=str(path)
        t=time.perf_counter();bpy.ops.render.render(write_still=True)
        import resource
        metadata["frames"].append({"frame":f,"seconds":f/args.fps,"wallSec":time.perf_counter()-t,"bytes":path.stat().st_size,
                                   "evaluatedFrame":scene.frame_current+scene.frame_subframe,
                                   "peakRssBytes":resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                                   "cameraPosition":list(scene.camera.location),"cameraQuaternion":list(scene.camera.rotation_euler.to_quaternion()),"lens":scene.camera.data.lens})
        (args.out/"render.json").write_text(json.dumps(metadata,indent=2))
        print("STUDY_FRAME "+json.dumps(metadata["frames"][-1]),flush=True)


if __name__=="__main__": main()

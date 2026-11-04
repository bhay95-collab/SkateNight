"""Approved hall geometry with the selected manifest's failure/recovery beats."""
import math
import bpy
from mathutils import Vector
import kit
import hero_megastructure as H
import story_megastructure as S
import drive_detail
import render_study as A
from timeline import CUES


def build_story(scene):
    M=H.materials();root,drive=H.build_drive(M)
    H.build_hall(M);drive_detail.build_background(M,drive);drive_detail.build_foreground(M)
    lights=H.build_lights('lit')
    kit.fog(scene,(130,260,140),(0,0,14),.0016,anisotropy=.7)
    entry=S.build_coin_journey(scene,M)
    original=S.CUES
    S.F={k:round(v*60) if isinstance(v,(int,float)) else [round(t*60) for t in v] for k,v in CUES.items()}
    S.F['toRecord']=round(CUES['carousel']*60)
    S.F['lockBeats']=[round((CUES['ignite']+i*.4465)*60) for i in range(8)]
    anchors=[(0,0),(327,S.F['relay']),(357,S.F['attempt']),(426,S.F['almost']),
             (453,S.F['failure']),(584,S.F['catch']),(752,S.F['ignite']),(859,S.F['toRecord'])]
    def mapped(f):
        for (a,x),(b,y) in zip(anchors,anchors[1:]):
            if a<=f<=b:return x+(y-x)*(f-a)/(b-a)
        return anchors[-1][1]+f-anchors[-1][0]
    S.CUES={**original,'supply':{'points':[(mapped(f),v) for f,v in original['supply']['points']]}}
    frames=range(186,S.F['toRecord']+1)
    S.animate_lights(lights,frames);S.animate_emission(M,frames)
    speed=S.drive_profile(frames);drive.driver_remove('rotation_euler',2);angle=0
    for f,w in speed.items():
        angle+=w;drive.rotation_euler[2]=angle;drive.keyframe_insert('rotation_euler',index=2,frame=f)
    S.animate_dial(M,bpy.data.objects['Dial needle'],speed)
    attempt=A.camera('Resistance and backlash',[
        (5.45,(-9,-57,2.2),(2,48,30),18),(8.3,(-7.5,-49,2.8),(2,48,30),22),
        (9.2,(-7.5,-49,2.8),(2,48,30),22)])
    robot=A.camera('Robot returns, camera finds the shaft',[
        (9.2,(.6,19,26.4),(0,31,26),32),(10.4,(.2,12,26),(0,31,26),30),
        (11.5,(-3.5,0,26),(0,40,26.5),26)])
    bpy.context.view_layer.update()
    actual=bpy.data.objects['Planet drive shaft 4']
    origin=actual.matrix_world.translation.copy()
    axis=(actual.matrix_world.to_3x3()@Vector((1,0,0))).normalized()
    motor=origin+axis*15
    gearbox=origin-axis*9
    chase=A.camera('Follow the actual keyed shaft into its planet axle',[
        (11.5,(-3.5,0,26),(0,40,26.5),26),
        (366/30,origin+Vector((-7,-18,9)),origin-axis,27),
        (378/30,origin+Vector((-6,-17,8.5)),origin-axis,28),
        (386/30,origin+Vector((-6,-17,8.5)),origin-axis,28),
        (397/30,origin+Vector((-5,-16,8)),origin-axis*3,28),
        (404/30,origin+Vector((-5,-16,8)),origin-axis*3,28)])
    service=kit.light('AREA','Recovered power shaft service key',origin+Vector((-2,-10,8)),(1,.72,.43),650,target=origin,size=5)
    for f,v in ((345*2,0),(361*2,0),(366*2,650),(404*2,650)):
        service.data.energy=v;service.data.keyframe_insert('energy',frame=f)
    for sec,cam in ((3.1,entry),(5.45,attempt),(9.2,robot),(11.5,chase)):
        scene.timeline_markers.new(cam.name,frame=round(sec*60)).camera=cam
    scene.camera=entry
    A.retime(30)
    for marker in scene.timeline_markers:marker.frame=round(marker.frame/2)
    # Exact eased dwell: no camera translation/lens drift across the shutter at
    # the readable shaft pose. Blender5 uses layered action channel bags.
    for owner in (chase,chase.data):
        for layer in owner.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            if abs(key.co.x-378)<.001 or abs(key.co.x-386)<.001:
                                key.handle_left_type='FREE';key.handle_right_type='FREE'
                                key.handle_left=(key.co.x-2,key.co.y)
                                key.handle_right=(key.co.x+2,key.co.y)
                        curve.update()
    wipe=kit.Batch().box((0,0,0),(2,1.5,.08)).emit('Near driven coupling housing occluder',M['iron'],chase)
    for f,x in ((398,-2),(404,0)):
        wipe.location=(x,0,-.5);wipe.keyframe_insert('location',frame=f)
    for f,hidden in ((397,True),(398,False)):
        wipe.hide_render=hidden;wipe.keyframe_insert('hide_render',frame=f)
    return {'shaft_origin':list(origin),'shaft_axis':list(axis),'gearbox_target':list(gearbox)}

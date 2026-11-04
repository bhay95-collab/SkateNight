"""A physical magazine and driven transfer shaft in the approved record world."""
import math
import bpy
from mathutils import Matrix, Vector
import kit
import render_study as A


def refine_magazine(scene,G,M,catalog_offset=0,build_details=True):
    # Printed, non-luminous paper: real text and concentric pressed grooves on
    # every visible face, on both sides of each spindle-mounted record.
    paper=A.simple_material('Magazine printed warm paper',(.22,.15,.075),rough=.62)
    ink=A.simple_material('Magazine carbon ink',(.015,.022,.027),rough=.7)
    originals=[]
    before=set(scene.objects)
    # Replace the old emissive labels with calm coloured paper.
    for ob in scene.objects:
        if ob.name.startswith('Carousel labels'):
            originals.append((ob,ob.data.materials[0]))
            ob.data.materials.clear(); ob.data.materials.append(paper)
    if not build_details:
        return originals,[]
    rings=kit.Batch()
    for k in range(60):
        theta=math.tau*k/60
        face=Matrix.Rotation(theta,4,'Z')@Matrix.Translation((732,0,52))@Matrix.Rotation(math.pi/2,4,'X')
        for side in (-1,1):
            for r in (27,29,31,33,35,38,42,46,50,54,57):
                rings.ring(r-.10,r+.10,.09,z=side*2.03,segs=96,matrix=face)
            # A few engraved label lines remain readable at the close pass.
            if k in range(25,40):
                txt=kit.text(f'Catalog {k:02d} {side}',f'FAITH\nVOL. {(k+catalog_offset)%60+1:02d}\n45 RPM',(0,0,0),(0,0,0),4.5,ink)
                txt.data.align_y='CENTER'
                txt.matrix_world=face@Matrix.Translation((0,0,side*2.22))@(Matrix.Rotation(math.pi,4,'Y') if side<0 else Matrix.Identity(4))
    rings.emit('Pressed magazine groove bands',M['vinyl'],smooth=True)
    return originals,[ob for ob in scene.objects if ob not in before]


def build_changer(scene,G):
    M=G.materials(); G.build_changer(M)
    lift,L,tower=G.build_arm(M)
    G.lower_arm(lift,L,((0,46),(605,46)))
    G.build_environment(M)
    M['neon_rim'].node_tree.nodes['Emission'].inputs['Strength'].default_value=24
    rec=G.build_record(M)
    bpy.data.objects['Mechanism lamp tubes'].hide_render=True
    for ob in scene.objects:
        if ob.type=='LIGHT': ob.data.energy*=.35
    refine_magazine(scene,G,M)
    angle=math.radians(205)
    origin=Vector((660*math.cos(angle),660*math.sin(angle),-24))
    basis=Matrix.Rotation(angle,3,'Z')
    frame=kit.empty('Bolted transfer casing',origin,(0,0,angle))
    shaft=kit.Batch().cyl((-185,0,-15),4,340,rot=(0,math.pi/2,0),segs=32)
    for x in (-320,-180,-60):
        shaft.cyl((x,0,-15),7,9,rot=(0,math.pi/2,0),segs=16)
    shaft=shaft.emit('Continuous keyed transfer shaft',M['chrome'],frame,smooth=True)
    shaft.data.transform(Matrix.Translation((185,0,15)))
    shaft.location=(-185,0,-15)
    kit.Batch().box((0,4.0,0),(255,1.5,1.5)).emit('Raised shaft key and rotation witness',M['brass'],shaft,bevel=.2)
    bearing=kit.Batch()
    for x in (-320,-180,-60):
        bearing.box((x,0,-36),(24,34,28))
        for y in (-13,13):
            bearing.cyl((x,y,-20),2,4,segs=6)
    bearing.box((-34.2,0,-28),(70,70,34)).emit('Bolted bearing supports',M['iron'],frame,bevel=.6)
    pinion=kit.Batch().ring(4,43.05,6,teeth=24,tooth=3).emit('Driven 24T index pinion',M['brass'],frame)
    pinion.location=(-34.2,0,0)
    kit.Batch().cyl((-34.2,0,-15),4,30,segs=32).emit('Transfer vertical output shaft',M['chrome'],frame,smooth=True)
    bpy.data.objects['Carousel index drive'].hide_render=True
    rotor=kit.empty('Magazine index rotor, physical six-degree step')
    for ob in list(scene.objects):
        if (ob.name.startswith('Carousel') and ob.name!='Carousel index drive') or ob.name.startswith('Catalog ') or ob.name=='Pressed magazine groove bands':
            ob.parent=rotor
    for f in range(405,606):
        u=max(0,min(1,(f-405)/50));u=u*u*(3-2*u)
        pinion.rotation_euler.z=-math.pi/2*u
        pinion.keyframe_insert('rotation_euler',frame=f,index=2)
        rotor.rotation_euler.z=-math.tau/60*u
        rotor.keyframe_insert('rotation_euler',frame=f,index=2)
        shaft.rotation_euler.x=-math.tau*2*u
        shaft.keyframe_insert('rotation_euler',frame=f,index=0)
        rec.rotation_euler.z=-.035+(915-f)*G.OMEGA_GIANT/30
        rec.keyframe_insert('rotation_euler',frame=f,index=2)
    def p(v):return origin+basis@Vector(v)
    cam=kit.camera('Magazine continuous transfer and label crane',p((-340,-75,-85)),p((-180,0,-15)),25)
    poses=[(405,p((-340,-75,-85)),p((-180,0,-15)),25),
           (432,p((-120,-90,-65)),p((0,0,-15)),25),
           (455,p((160,-190,120)),p((55,0,55)),23),
           (466,(-740,-60,155),(-716,-152,65),38),
           (494,(-765,-45,155),(-716,-152,65),38),
           (542,(-1000,-620,720),(0,0,5),27),
           (576,(-650,-1000,900),(0,0,0),28),
           (605,(-250,-520,46),(520,-40,50),24)]
    for f,loc,tgt,lens in poses:
        cam.location=loc;kit.aim(cam,tgt);cam.data.lens=lens
        cam.keyframe_insert('location',frame=f);cam.keyframe_insert('rotation_euler',frame=f);cam.data.keyframe_insert('lens',frame=f)
    scene.camera=cam;cam.data.clip_end=20000
    # A close bearing-housing edge wipes across the lens across the concealed
    # hall/record-world cut, maintaining drive direction through the transfer.
    wipe=kit.Batch().box((0,0,0),(2,1.5,.08)).emit('Near transfer housing occluder',M['black'],cam)
    for f,x in ((405,0),(411,2)):
        wipe.location=(x,0,-.5);wipe.keyframe_insert('location',frame=f)
    for f,hidden in ((411,False),(412,True)):
        wipe.hide_render=hidden;wipe.keyframe_insert('hide_render',frame=f)
    # Long, narrow reflections reveal curvature without washing out black discs.
    kit.light('AREA','Magazine grazing strip',(-850,-250,220),(.55,.72,1),2.2e6,target=(-650,100,40),size=180)
    kit.light('AREA','Magazine amber edge',(-200,600,260),(1,.54,.20),1.6e6,target=(-500,100,20),size=180)
    kit.light('AREA','Magazine overhead pool',(0,0,650),(.45,.60,.85),2.8e6,target=(0,0,0),size=450)
    kit.light('AREA','Transfer service key',p((-180,-100,-80)),(1,.72,.42),3e6,target=p((-130,0,-15)),size=160)
    for ob in scene.objects:
        if ob.type=='LIGHT' and (ob.name.startswith('Magazine') or ob.name.startswith('Transfer service')):
            power=ob.data.energy
            for f,v in ((575,power),(605,0)):
                ob.data.energy=v;ob.data.keyframe_insert('energy',frame=f)
    return {'G':G,'record':rec,'rotor':rotor,'shaft':shaft,'pinion':pinion}


def changer_frame(scene,f,state):
    if abs(state['rotor'].rotation_euler.z-state['pinion'].rotation_euler.z/15)>1e-6:
        raise ValueError('Magazine/pinion tooth ratio drift')
    if abs(state['rotor'].rotation_euler.z*670.5-state['pinion'].rotation_euler.z*44.7)>1e-5:
        raise ValueError('Internal mesh pitch-surface velocity/sign mismatch')
    if abs(state['shaft'].rotation_euler.x-state['pinion'].rotation_euler.z*8)>1e-5:
        raise ValueError('Transfer reduction phase drift')
    return {'record_angle_radians':state['record'].rotation_euler.z,'carousel_slots':60,'index_angle_radians':state['rotor'].rotation_euler.z,'shaft_angle_radians':state['shaft'].rotation_euler.x,'pinion_angle_radians':state['pinion'].rotation_euler.z,'index_pitch_radius':670.5,'pinion_nominal_pitch_radius':44.7,'pinion_centre_radius':625.8,'mesh_tip_clearance':.15}

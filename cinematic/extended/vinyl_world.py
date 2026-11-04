"""One rotating record space: approach, a true spiral V groove, escape, C1.

The microscopic flight is at the approved dimensions (pitch .4, depth .13).
Only the submerged disc base is culled; original C1 geometry is restored before
macro handoff. Fixtures and the flight sector share the record's transform.
"""
import math
import bpy
from mathutils import Matrix, Vector
import kit
import render_study as A
from timeline import MANIFEST, source_frame_for_c1
from changer import refine_magazine


def ease(x):
    x=max(0,min(1,x));return x*x*x*(x*(x*6-15)+10)


def build_vinyl(scene,G):
    rec=bpy.data.objects['Record (rotates)']
    original_cam=scene.camera
    # The same printed magazine survives the changer/record boundary. Ease its
    # paper presentation back to the exact original source labels before C1.
    materials={'vinyl':bpy.data.objects['Carousel records'].data.materials[0]}
    original_labels,magazine_detail=refine_magazine(scene,G,materials,catalog_offset=1,build_details=False)
    mixed_labels=[]
    for ob,original in original_labels:
        mat=original.copy();mat.name='Printed magazine to approved C1 '+original.name
        nodes=mat.node_tree.nodes;links=mat.node_tree.links
        emission=nodes['Emission'];out=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
        paper=nodes.new('ShaderNodeBsdfPrincipled');paper.inputs['Base Color'].default_value=(.22,.15,.075,1);paper.inputs['Roughness'].default_value=.62
        mix=nodes.new('ShaderNodeMixShader');links.new(paper.outputs[0],mix.inputs[1]);links.new(emission.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],out.inputs['Surface'])
        for f,v in ((606,0),(840,0),(915,1)):
            mix.inputs[0].default_value=v;mix.inputs[0].keyframe_insert('default_value',frame=f)
        ob.data.materials[0]=mat;mixed_labels.append((ob,original,mat))
    base=bpy.data.objects['Vinyl disc']
    oldpatch=bpy.data.objects['Groove landscape (geometry)']
    # Preserve C1 lighting, easing out of a quieter record reveal beforehand.
    for ob in scene.objects:
        if ob.type=='LIGHT' and not ob.data.animation_data:
            power=ob.data.energy
            for f,v in ((606,power*.35),(840,power*.35),(915,power)):
                ob.data.energy=v;ob.data.keyframe_insert('energy',frame=f)
    endtheta=math.atan2(G.TIP.y,G.TIP.x)+.048
    # Match one channel of the approved modulated spiral, not a straight trench.
    keys=[];r=536.0
    while r<592:
        p=1.5 if r>=562 else .4
        keys.append((r+p/2,r<562,p));r+=p
    import numpy as np
    ph=np.random.default_rng(7).uniform(0,math.tau,(3,len(keys)))
    def center(theta,j):
        r,mod,p=keys[j];s=theta*G.CONTACT_R
        env=.55+.45*math.sin(math.tau*s/31+ph[0,j])**2
        lateral=.07*env*(.5*math.sin(math.tau*s/23+ph[0,j])+.32*math.sin(math.tau*s/5.7+ph[1,j])+.18*math.sin(math.tau*s/1.35+ph[2,j]))*mod
        return r+p*theta/math.tau+lateral
    lane=min(range(len(keys)),key=lambda j:abs(center(endtheta,j)-G.CONTACT_R))
    contact_lane_offset=G.CONTACT_R-center(endtheta,lane)
    if abs(contact_lane_offset)>G.GROOVE_W/2:
        raise ValueError('Flight channel does not feed the approved stylus contact material coordinate')
    def point(theta,x=0,z=0):
        rr=center(theta,lane)+x
        return Vector((rr*math.cos(theta),rr*math.sin(theta),z))
    # Cross-section: exact .13 valley and .26 width, gently rounded ridge and
    # valley arrises. Longitudinal sampling captures actual lateral modulation.
    profile=[(-.13,0),(-.124,-.005),(-.10,-.033),(-.07,-.069),(-.04,-.105),(-.025,-.124),(-.018,-.13),(0,-.13),(.018,-.13),(.025,-.124),(.04,-.105),(.07,-.069),(.10,-.033),(.124,-.005),(.13,0)]
    theta0=endtheta-.015;theta1=endtheta+.025
    vertices=[];faces=[];N=600
    for i in range(N+1):
        th=theta0+(theta1-theta0)*i/N
        for j in range(max(0,lane-7),min(len(keys),lane+8)):
            rr=center(th,j)
            for x,z in profile:
                vertices.append(((rr+x)*math.cos(th),(rr+x)*math.sin(th),z))
    row=len(vertices)//(N+1)
    for i in range(N):
        for j in range(row-1):
            a=i*row+j;faces.append((a,a+row,a+row+1,a+1))
    mesh=bpy.data.meshes.new('Continuous modulated spiral, rounded V profile')
    mesh.from_pydata(vertices,[],faces);mesh.update();mesh.shade_smooth()
    patch=bpy.data.objects.new('Flight sector — same vinyl record',mesh)
    scene.collection.objects.link(patch);patch.parent=rec;mesh.materials.append(G.vinyl('Smooth flight vinyl',rings=False))
    # The approved solid base fills the physical V below -.004. During the
    # scale escape, smoothly converge the deep sector to that visible source
    # skin before restoring its original mesh; no one-frame depth/normal pop.
    patch.shape_key_add(name='Physical .13-depth groove')
    skin=patch.shape_key_add(name='Approved distant record skin LOD')
    for v in skin.data:v.co.z*=.0039/.13
    for f,v in ((813,0),(867,1)):
        skin.value=v;skin.keyframe_insert('value',frame=f)

    def opacity_copy(mat,name,values):
        copy=mat.copy();copy.name=name
        nodes=copy.node_tree.nodes;links=copy.node_tree.links
        out=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
        source=out.inputs['Surface'].links[0].from_socket
        transparent=nodes.new('ShaderNodeBsdfTransparent');mix=nodes.new('ShaderNodeMixShader')
        links.new(transparent.outputs[0],mix.inputs[1]);links.new(source,mix.inputs[2]);links.new(mix.outputs[0],out.inputs['Surface'])
        for f,v in values:
            mix.inputs[0].default_value=v;mix.inputs[0].keyframe_insert('default_value',frame=f)
        return copy
    skins=[]
    for ob in (base,oldpatch):
        mat=ob.data.materials[0]
        skins.append((ob,mat,opacity_copy(mat,'Escape LOD '+mat.name,((850,0),(868,1)))))
    patchmat=patch.data.materials[0]
    patch.data.materials[0]=opacity_copy(patchmat,'Escape LOD physical sector',((850,1),(868,0)))
    # No concrete shader: restrained vinyl and thin buried service machinery.
    metal=A.simple_material('Recessed groove service metal',(.075,.095,.11),metal=.75,rough=.30)
    bolts=A.simple_material('Groove service brass fasteners',(.25,.16,.06),metal=.8,rough=.24)
    warm=A.simple_material('Groove amber status window',(1,.29,.045),rough=.2,emission=2)
    cable=A.simple_material('Groove rubber cable',(.008,.012,.016),rough=.42)
    fixtures=[];station_lights=[]
    # Sparse stations attached to a wall below its lip, including braced
    # gantries and cable runs. None protrudes into the camera channel.
    for n,th in enumerate([endtheta+.0016+i*.0010 for i in range(5)]):
        origin=point(th)
        basis=Matrix.Rotation(th,4,'Z')
        frame=kit.empty(f'Embedded wall service station {n}',origin,(0,0,th));frame.parent=rec
        b=kit.Batch().box((.078,0,-.055),(.030,.20,.045))
        for yy in (-.08,.08):
            b.box((.073,yy,-.071),(.014,.012,.065))
        b.emit(f'Recessed metal station {n}',metal,frame,bevel=.001)
        ribs=kit.Batch();screws=kit.Batch()
        for yy in (-.08,-.055,-.03,-.005,.02,.045,.07):
            ribs.box((.059,yy,-.069),(.007,.005,.019))
        for yy in (-.084,.084):
            for zz in (-.036,-.073):
                screws.cyl((.057,yy,zz),.0028,.002,rot=(0,math.pi/2,0),segs=6)
        ribs.emit(f'Cooling ribs and wall brackets {n}',metal,frame,bevel=.0007)
        screws.emit(f'Hex inspection fasteners {n}',bolts,frame)
        kit.tube(f'Wall conduit loop {n}',[(.060,-.14,-.076),(.055,-.115,-.084),(.055,.105,-.084),(.060,.14,-.076)],.0022,cable,parent=frame)
        kit.tube(f'Wall handrail {n}',[(.055,-.11,-.026),(.052,-.10,-.019),(.052,.10,-.019),(.055,.11,-.026)],.0012,bolts,parent=frame)
        kit.Batch().box((.061,-.006,-.047),(.002,.11,.012)).emit(f'Amber slit {n}',warm,frame)
        kit.tube(f'Buried station cable {n}',[(.064,-.10,-.065),(.058,-.15,-.08),(.056,-.24,-.086)],.0014,cable,parent=frame)
        if n == 2:
            gantry=kit.Batch()
            for xx in (-.123,.123):
                gantry.box((xx,0,-.015),(.009,.016,.08))
            gantry.box((0,0,.029),(.26,.020,.012)).emit(f'Ridge inspection gantry {n}',metal,frame,bevel=.001)
        lamp=kit.light('AREA',f'Wall station amber rake {n}',point(th,-.035,-.005),(1,.52,.19),.0065,target=point(th,.06,-.05),size=.045)
        lamp.parent=rec;station_lights.append(lamp)
        fixtures.append(frame)
    # Very fine surface-bound dust/scuffs: deterministic, no airborne glitter.
    dust=kit.Batch()
    for i in range(48):
        th=endtheta+.001+(i*0.61803398875%1)*.006
        p=point(th,(-1 if i%2 else 1)*(.14+.045*(i%5)/5),.001)
        dust.sphere(tuple(p),.0007+(i%4)*.0003,segs=6)
    dust.emit('Pressed-surface sparse dust',metal,rec)
    flight=kit.camera('Continuous record-to-groove-to-stylus',(-250,-520,46),(520,-40,50),24)
    flight.data.clip_start=.00001;flight.data.clip_end=400000
    # Keep every authored C1 channel intact and add the preceding record angle
    # on the native timeline. G175=-.035, G240=-.048 exactly.
    for f in range(405,915):
        rec.rotation_euler.z=-.035+(915-f)*G.OMEGA_GIANT/30
        rec.keyframe_insert('rotation_euler',frame=f,index=2)
    scene.frame_set(915)
    endpoint=original_cam.location.copy();qend=original_cam.rotation_euler.to_quaternion();lend=original_cam.data.lens
    def angle(f):return -.035+(915-f)*G.OMEGA_GIANT/30
    def world(p,f):return Matrix.Rotation(angle(f),3,'Z')@p
    poses={}
    for f in range(606,915):
        if f<=633:
            u=ease((f-606)/27)
            dest=world(point(endtheta+.0065,z=2.4),f)
            loc=Vector((-250,-520,46)).lerp(dest,u)
            tgt=Vector((520,-40,50)).lerp(world(point(endtheta+.0062,z=0),f),u)
            lens=24
        elif f<=655:
            u=ease((f-633)/22)
            th=endtheta+.0065-.0005*u
            loc=world(point(th,z=2.4*(1-u)-.075*u),f)
            tgt=world(point(th-.00025,z=-.100*u),f);lens=24-4*u
        elif f<=813:
            u=(f-655)/(813-655)
            th=endtheta+.006-.005*u
            loc=world(point(th,z=-.075+.004*math.sin(u*math.tau)),f)
            tgt=world(point(th-.00025,z=-.100),f);lens=20
        elif f<=864:
            u=ease((f-813)/51)
            th=endtheta+.001-.0008*u
            loc=world(point(th,z=-.075+3.075*u),f)
            tgt=world(point(th-.00025,z=-.100+2.100*u),f);lens=20+5*u
        else:
            u=ease((f-864)/51)
            start=world(point(endtheta+.0002,z=3),864)
            loc=start.lerp(endpoint,u)
            qstart=(world(point(endtheta-.00005,z=2),864)-start).to_track_quat('-Z','Y')
            q=qstart.slerp(qend,u);lens=25+(lend-25)*u
            flight.location=loc;flight.rotation_euler=q.to_euler();flight.data.lens=lens
            flight.keyframe_insert('location',frame=f);flight.keyframe_insert('rotation_euler',frame=f);flight.data.keyframe_insert('lens',frame=f)
            poses[f]=(loc,lens);continue
        flight.location=loc;kit.aim(flight,tgt);flight.data.lens=lens
        flight.keyframe_insert('location',frame=f);flight.keyframe_insert('rotation_euler',frame=f);flight.data.keyframe_insert('lens',frame=f)
        poses[f]=(loc,lens)
    # Exact last pose on the same camera rather than an approximate scale cut.
    flight.location=endpoint;flight.rotation_euler=qend.to_euler();flight.data.lens=lend
    flight.keyframe_insert('location',frame=915);flight.keyframe_insert('rotation_euler',frame=915);flight.data.keyframe_insert('lens',frame=915)
    # Local illumination is tiny because the camera and corridor have real
    # micro dimensions. It cannot affect the approved world after the escape.
    micros=list(station_lights)
    for n in range(7):
        th=endtheta+.001+n*.001
        light=kit.light('AREA',f'Groove grazing service strip {n}',point(th,-.055,.035),(.35,.55,.72),.0008,target=point(th,-.025,-.06),size=.09)
        light.parent=rec;micros.append(light)
    carriage=kit.empty('Groove inspection carriage');carriage.parent=rec
    kit.Batch().box((0,0,0),(.024,.075,.014)).emit('Inspection carriage metal',metal,carriage,bevel=.002)
    kit.Batch().box((0,-.02,.009),(.012,.012,.005)).emit('Inspection carriage pilot',warm,carriage)
    for f in range(655,814):
        th=endtheta+.0025-(f-655)/30*.00012
        carriage.location=point(th,z=-.112)
        carriage.rotation_euler.z=th
        carriage.keyframe_insert('location',frame=f);carriage.keyframe_insert('rotation_euler',frame=f)
    fixtures.append(carriage)
    return dict(G=G,record=rec,base=base,oldpatch=oldpatch,patch=patch,flight=flight,approved=original_cam,
                fixtures=fixtures,micros=micros,skins=skins,magazine_detail=magazine_detail,mixed_labels=mixed_labels,theta_contact=endtheta,contact_lane_offset=contact_lane_offset,lane=lane,center=center,point=point,
                c1_start_position=list(endpoint),c1_start_quaternion=list(qend),c1_start_lens=lend)


def vinyl_frame(scene,f,s):
    micro=639<=f<=867
    for ob,original,mixed in s['mixed_labels']:ob.data.materials[0]=original if f>=915 else mixed
    # Fine magazine bands and printing are subpixel at this record-level view.
    # Retain actual mounted discs and paper; omit only their close-pass detail.
    for ob in s['magazine_detail']:ob.hide_render=True
    if f<915:
        bpy.data.objects['Mechanism lamp tubes'].hide_render = f<840
    for ob,original,fade in s['skins']:ob.data.materials[0]=fade if 850<=f<868 else original
    s['base'].hide_render=639<=f<850
    s['oldpatch'].hide_render=639<=f<850
    s['patch'].hide_render=not micro
    for ob in s['fixtures']:
        for item in (ob,*ob.children_recursive):item.hide_render=not micro
    for ob in s['micros']:ob.hide_render=not micro
    bpy.data.objects['Pressed-surface sparse dust'].hide_render=not micro
    scene.camera=s['flight'] if f<915 else s['approved']
    result={'record_angle_radians':s['record'].rotation_euler.z,'physical_pitch':.4,'physical_depth':.13,
            'submerged_base_culled':639<=f<850,'record_skin_lod_active':850<=f<868,'coordinate_space':'approved rotating record','contact_lane_offset':s['contact_lane_offset'],'camera_clip_start':scene.camera.data.clip_start}
    if 655<=f<=813:
        local=s['record'].matrix_world.inverted()@scene.camera.location
        theta=math.atan2(local.y,local.x)
        lateral=math.hypot(local.x,local.y)-s['center'](theta,s['lane'])
        clearance=local.z+.13
        if abs(lateral)>.012 or clearance<.04 or local.z>=0:
            raise ValueError(f'Groove flight collision/escape: {f}, lateral={lateral}, floor={clearance}')
        result.update(groove_lateral_offset=lateral,groove_floor_clearance=clearance,local_camera_z=local.z)
    if f>=915:
        result['approved_source_frame']=source_frame_for_c1(f)
        if f==915:
            delta=(scene.camera.location-Vector(s['c1_start_position'])).length
            if delta>1e-5:raise ValueError('C1 camera position discontinuity')
            result['c1_start_position_error']=delta
        if f==1049:
            result['final_css_angle_deg']=math.degrees(-s['record'].rotation_euler.z)%360
            if abs(result['final_css_angle_deg']-MANIFEST['c1']['record']['cssAngleDeg'])>.0001:
                raise ValueError('Approved CSS rotation phase changed')
    return result

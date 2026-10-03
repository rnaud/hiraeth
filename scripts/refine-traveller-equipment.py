"""Rebuild gloves, boots and radio pack on the existing traveller skeleton.
Blender -b --python scripts/refine-traveller-equipment.py -- input.glb output-dir
Keeps body UVs, head, bind pose and animation; smooths only joint weights.
"""
import bpy,bmesh,math,sys,json
from pathlib import Path
from mathutils import Vector
source,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis.identity()
for o in list(bpy.data.objects):
    if o.type=='MESH' and o.name.startswith('Equipment '):bpy.data.objects.remove(o,do_unlink=True)
body=next(o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('Lavender traveller'))
bpy.context.view_layer.objects.active=body
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Cut at cuff/ankle seams, and behind the torso where the replacement pack covers it.
bm=bmesh.new();bm.from_mesh(body.data)
remove=[v for v in bm.verts if (abs(v.co.x)>.485 and v.co.z<1.055) or v.co.z<.165 or (v.co.y>.14 and .98<v.co.z<1.64 and abs(v.co.x)<.30)]
bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(body.data);bm.free()
# Relax noisy heat weights across elbows, knees and hips without moving the mesh.
adj=[set() for _ in body.data.vertices]
for e in body.data.edges:a,b=e.vertices;adj[a].add(b);adj[b].add(a)
weights=[{g.group:g.weight for g in v.groups} for v in body.data.vertices]
for _ in range(4):
    new=[]
    for v,neighbours in zip(body.data.vertices,adj):
        x,y,z=v.co;w=weights[v.index]
        joint=(.40<z<.61 and abs(x)>.10) or (1.17<z<1.34 and abs(x)>.32) or (.78<z<1.02 and abs(x)>.10 and y<.13)
        if joint and neighbours:
            avg={}
            for n in neighbours:
                for k,val in weights[n].items():avg[k]=avg.get(k,0)+val/len(neighbours)
            w={k:.55*w.get(k,0)+.45*avg.get(k,0) for k in set(w)|set(avg)}
        new.append(w)
    weights=new
for v,w in zip(body.data.vertices,weights):
    w=sorted(w.items(),key=lambda kv:kv[1],reverse=True)[:4];total=sum(val for k,val in w)
    for g in body.vertex_groups:g.remove([v.index])
    for k,val in w:
        if val>0:body.vertex_groups[k].add([v.index],val/total,'REPLACE')

def material(name,c):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.85
    return m
orange=material('Equipment orange leather',(.72,.235,.105));pink=material('Equipment dusty pink boots',(.50,.235,.215));sole=material('Equipment rubber soles',(.16,.13,.135));cream=material('Equipment ivory radio',(.74,.65,.43));brown=material('Equipment tan pouches',(.38,.205,.10));blue=material('Equipment blue metal',(.055,.15,.22));ink=material('Equipment seam ink',(.055,.047,.052));cloth=material('Equipment lavender fabric',(.37,.28,.43));screen=material('Equipment cyan glass',(.19,.49,.46))
parts=[]
def bind(o,name,mat,bone,blend=None):
    o.name='Equipment '+name
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    o.data.materials.clear();o.data.materials.append(mat);o.parent=rig
    g=o.vertex_groups.new(name=bone)
    if blend:
        h=o.vertex_groups.new(name=blend)
        for v in o.data.vertices:
            t=max(0,min(1,(v.co.z-.12)/.11));t=t*t*(3-2*t);g.add([v.index],1-t,'REPLACE');h.add([v.index],t,'REPLACE')
    else:g.add(list(range(len(o.data.vertices))),1,'REPLACE')
    m=o.modifiers.new('Skin','ARMATURE');m.object=rig
    for p in o.data.polygons:p.use_smooth=True
    parts.append(o);return o

def ellipsoid(name,pos,scale,mat,bone,rotation=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=pos);o=bpy.context.object;o.scale=scale
    if rotation:o.rotation_mode='QUATERNION';o.rotation_quaternion=rotation
    return bind(o,name,mat,bone)

def box(name,pos,size,mat,bone,r=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('Rounded edges','BEVEL');mod.width=r;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
    return bind(o,name,mat,bone)

def tube(name,points,r,mat,bone):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2
    p=c.splines.new('POLY');p.points.add(len(points)-1)
    for v,co in zip(p.points,points):v.co=(*co,1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
    return bind(o,name,mat,bone)

for side,s in [('L',1),('R',-1)]:
    hand='hand.'+side;foot='foot.'+side;shin='shin.'+side
    wrist=rig.data.bones[hand].head_local.copy();axis=(rig.data.bones[hand].tail_local-wrist).normalized()
    across=Vector((s,0,0));across=(across-axis*across.dot(axis)).normalized();normal=across.cross(axis).normalized()
    if normal.y>0:normal=-normal
    # Distinct palm, four rounded fingers and anatomical outward thumb in the palms-forward bind pose; all follow the existing hand bone.
    q=Vector((0,0,1)).rotation_difference(axis)
    ellipsoid('glove palm '+side,wrist+axis*.062,(.047,.027,.060),orange,hand,q)
    for i,(offset,length) in enumerate([(.031,.048),(.010,.058),(-.012,.054),(-.032,.042)]):
        start=wrist+axis*.098+across*offset
        ellipsoid('glove finger '+side+str(i),start+axis*(length*.42)+normal*.006,(.0105,.016,length*.62),orange,hand,q)
    a=wrist+axis*.047+across*.045;b=wrist+axis*.100+across*.067+normal*.010
    ellipsoid('glove thumb '+side,(a+b)/2,(.017,.018,(b-a).length*.67),orange,hand,Vector((0,0,1)).rotation_difference(b-a))
    # A continuous gauntlet covers the cut seam even when the wrist bends.
    vs=[];fs=[];N=24
    for distance,width,depth in [(-.038,.054,.038),(0,.047,.034),(.035,.041,.030),(.062,.039,.027)]:
        center=wrist+axis*distance
        for i in range(N):
            t=i*2*math.pi/N;vs.append(center+across*math.cos(t)*width+normal*math.sin(t)*depth)
    for j in range(3):
        for i in range(N):a=j*N+i;b=j*N+(i+1)%N;fs.append((a,b,b+N,a+N))
    fs.extend([tuple(reversed(range(N))),tuple(3*N+i for i in range(N))])
    m=bpy.data.meshes.new('Gauntlet');m.from_pydata(vs,[],fs);m.update();o=bpy.data.objects.new('Gauntlet',m);bpy.context.collection.objects.link(o);bind(o,'glove cuff '+side,orange,hand)
    x=s*.195
    # Rounded boot outline, broad toe box and a separate thin sole, with an ankle shaft.
    outline=[(-.050,.055),(.050,.055),(.060,.020),(.064,-.145),(.052,-.235),(.025,-.258),(-.025,-.258),(-.052,-.235),(-.064,-.145),(-.060,.020)]
    def bootmesh(name,rings,mat,blend=None):
        vs=[];fs=[];N=len(outline)
        for z,scale,shift in rings:
            for xx,yy in outline:vs.append((x+xx*scale,yy*scale+shift,z))
        for j in range(len(rings)-1):
            for i in range(N):a=j*N+i;b=j*N+(i+1)%N;fs.append((a,b,b+N,a+N))
        fs.extend([tuple(reversed(range(N))),tuple((len(rings)-1)*N+i for i in range(N))])
        m=bpy.data.meshes.new(name);m.from_pydata(vs,[],fs);m.update();o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o)
        return bind(o,name,mat,foot,blend)
    bootmesh('boot sole '+side,[(.008,1,0),(.025,1.02,0),(.039,1,0)],sole)
    bootmesh('boot upper '+side,[(.032,.98,0),(.065,1,0),(.095,.92,.004),(.115,.76,.014),(.127,.50,.02)],pink)
    # Shaft bends smoothly into the calf; toes stay rigid under foot contact IK.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=14,location=(x,-.01,.158));o=bpy.context.object;o.scale=(.052,.060,.080);bind(o,'boot ankle '+side,pink,foot,shin)
    for yy,zz in [(-.12,.113),(-.058,.129)]:
        tube('boot strap '+side+str(yy),[(x-.047,yy,zz-.015),(x-.025,yy-.008,zz),(x+.025,yy-.008,zz),(x+.047,yy,zz-.015)],.008,pink,foot)
        box('boot buckle '+side+str(yy),(x+s*.047,yy,zz-.012),(.016,.024,.021),cream,foot,.003)
    tube('boot toe seam '+side,[(x-.049,-.19,.076),(x-.025,-.203,.092),(x+.025,-.203,.092),(x+.049,-.19,.076)],.0016,ink,foot)
# Cover the removed pack footprint with a close-fitting cloth back panel.
box('back fabric',(0,.115,1.28),(.49,.07,.61),cloth,'chest',.03)
box('radio pack',(0,.235,1.345),(.38,.20,.43),cream,'chest',.026)
box('radio inset',(0,.343,1.36),(.30,.018,.32),cream,'chest',.015)
box('radio display',(-.068,.358,1.405),(.095,.014,.068),blue,'chest',.006)
box('radio display glass',(-.068,.367,1.411),(.073,.008,.039),screen,'chest',.003)
for i in range(5):box('radio vent '+str(i),(.066,.360,1.39-i*.015),(.088,.008,.004),blue,'chest',.001)
for x in [-.135,.135]:
    for z in [1.22,1.49]:ellipsoid('radio screw '+str(x)+str(z),(x,.36,z),(.005,.004,.005),blue,'chest')
for x in [-.102,.102]:
    box('lower pouch '+str(x),(x,.255,1.06),(.176,.18,.18),brown,'chest',.025)
    box('pouch flap '+str(x),(x,.353,1.09),(.16,.025,.062),brown,'chest',.012)
    box('pouch clasp '+str(x),(x,.374,1.069),(.025,.012,.034),cream,'chest',.003)
    tube('pack side rail '+str(x),[(x*1.8,.29,1.19),(x*1.8,.30,1.53),(x*1.4,.27,1.565)],.009,blue,'chest')
tube('tucked radio hose',[(.18,.255,1.23),(.213,.26,1.12),(.206,.23,1.00),(.14,.21,1.00)],.012,blue,'chest')
# Consistent outward-facing normals for the new closed meshes.
for o in parts:
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
# Batch by material: fingers, buckles and vents must not each cost a draw call.
batches={}
for o in parts:batches.setdefault(o.data.materials[0],[]).append(o)
for mat,batch in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in batch:o.select_set(True)
    bpy.context.view_layer.objects.active=batch[0];bpy.ops.object.join();bpy.context.object.name=mat.name
parts=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('Equipment ')]
bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str((out/'character.blend').resolve()))
bpy.ops.export_scene.gltf(filepath=str((out/'character.glb').resolve()),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS')
(out/'report.json').write_text(json.dumps({'body_vertices':len(body.data.vertices),'new_parts':len(parts),'new_vertices':sum(len(o.data.vertices) for o in parts)},indent=2))

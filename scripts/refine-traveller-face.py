"""Refine the illustrated traveller's head without rebinding its body or limbs.
Run with Blender --background --python scripts/refine-traveller-face.py -- input.glb output-directory
Blender coordinates: Z up, face toward -Y. All new parts follow the existing head bone.
"""
import bpy, bmesh, math, sys
from pathlib import Path
from mathutils import Vector
source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
for obj in list(bpy.data.objects):
    if obj.type == 'MESH' and (obj.name in ['Head', 'Eye -1', 'Eye 1', 'Nose'] or obj.name.startswith('Traveller ')):
        bpy.data.objects.remove(obj, do_unlink=True)

def mat(name, color):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = .85; p.inputs['Metallic'].default_value = 0
    return m
skin = mat('Traveller peach skin', (.67, .33, .25))
ink = mat('Traveller facial ink', (.028, .035, .043))
soft = mat('Traveller warm facial lines', (.26, .115, .09))
liner = mat('Traveller grey helmet liner', (.23, .25, .31))
# Rings give the head a broad forehead, cheek planes and a distinct chin.
profile = [(1.665,.026,.040,.050),(1.682,.049,.077,.063),(1.708,.068,.094,.077),
 (1.747,.086,.105,.085),(1.785,.100,.111,.091),(1.821,.107,.114,.093),
 (1.856,.108,.116,.093),(1.890,.104,.110,.090),(1.923,.095,.096,.083),
 (1.953,.073,.073,.065),(1.973,.040,.040,.037),(1.981,.001,.001,.001)]
center = -.023

def section(z):
    for i in range(len(profile)-1):
        a,b=profile[i:i+2]
        if z <= b[0]:
            t=max(0,min(1,(z-a[0])/(b[0]-a[0])))
            return tuple(a[j]*(1-t)+b[j]*t for j in range(1,4))
    return profile[-1][1:]

def face_y(x,z):
    width,front,_=section(z)
    c=math.sqrt(max(0,1-(x/width)**2))
    # Broad, quiet facial plane; a continuous bridge/tip instead of a separate pea.
    y=center-front*c**.58
    bridge=.017*math.exp(-((x/.018)**2+((z-1.815)/.034)**2))
    tip=.025*math.exp(-((x/.020)**2+((z-1.790)/.015)**2))
    socket=.0025*math.exp(-(((abs(x)-.040)/.018)**2+((z-1.842)/.017)**2))
    lips=.003*math.exp(-((x/.029)**2+((z-1.747)/.012)**2))
    return y-bridge-tip-lips+socket

verts=[];faces=[];N=64;R=49
for j in range(R):
    z=profile[0][0]+(profile[-1][0]-profile[0][0])*j/(R-1)
    w,front,back=section(z)
    for i in range(N):
        t=2*math.pi*i/N;x=w*math.sin(t);c=math.cos(t)
        y=face_y(x,z) if c>=0 else center-back*c
        verts.append((x,y,z))
for j in range(R-1):
    for i in range(N):
        a=j*N+i;b=j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
faces.extend([tuple(reversed(range(N))),tuple((R-1)*N+i for i in range(N))])

def bind(o):
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    o.parent=rig
    g=o.vertex_groups.new(name='head');g.add(list(range(len(o.data.vertices))),1,'REPLACE')
    mod=o.modifiers.new('Follow head','ARMATURE');mod.object=rig
    for p in o.data.polygons:p.use_smooth=True
    return o

def mesh(name, vs, fs, material):
    m=bpy.data.meshes.new(name);m.from_pydata(vs,[],fs);m.update()
    o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);o.data.materials.append(material)
    return bind(o)
head=mesh('Traveller sculpted face',verts,faces,skin)
# Small, flush, outlined eyes retain the reference's minimal expression.
def oval(name,x,z,rx,rz,material):
    vs=[(x,face_y(x,z)-.0018,z)];fs=[]
    for i in range(24):
        a=2*math.pi*i/24;xx=x+rx*math.cos(a);zz=z+rz*math.sin(a)
        vs.append((xx,face_y(xx,zz)-.0018,zz))
    for i in range(24):fs.append((0,i+1,(i+1)%24+1))
    return mesh(name,vs,fs,material)
for s in [-1,1]: oval('Traveller eye '+str(s),s*.039,1.843,.0036,.0043,ink)

def stroke(name,points,radius,material):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=radius;curve.bevel_resolution=2
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for p,(x,z) in zip(spline.points,points):p.co=(x,face_y(x,z)-.002,z,1)
    o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.data.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return bind(bpy.context.object)
stroke('Traveller mouth',[(-.012,1.748),(-.006,1.749),(0,1.748),(.008,1.749),(.014,1.750)],.0010,soft)
for s in [-1,1]:
    stroke('Traveller nostril '+str(s),[(s*.008,1.784),(s*.012,1.783),(s*.014,1.785)],.0008,soft)
# Just two broken marks, like the light pen strokes on the reference forehead.
stroke('Traveller temple mark',[(-.060,1.914),(-.063,1.908),(-.062,1.905)],.0007,soft)
stroke('Traveller brow mark',[(.046,1.866),(.052,1.864)],.00065,soft)
# Grey fabric covers the back of the scalp between the blue ear cups, as in the sheet.
vs=[];fs=[];NR=16;NT=40
for j in range(NR):
    z=1.701+(1.934-1.701)*j/(NR-1);w,front,back=section(z)
    for i in range(NT):
        t=math.pi/2+(math.pi)*i/(NT-1)
        vs.append(((w+.0015)*math.sin(t),center-(back+.0015)*math.cos(t),z))
for j in range(NR-1):
    for i in range(NT-1):a=j*NT+i;fs.append((a,a+1,a+1+NT,a+NT))
mesh('Traveller rear helmet liner',vs,fs,liner)
# Recalculate the newly authored surfaces; imported skeleton and weights are untouched.
for o in list(bpy.data.objects):
    if o.type=='MESH' and o.name.startswith('Traveller '):
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
# Open eye patches must face the viewer (-Y), regardless of Blender's open-mesh heuristic.
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name.startswith('Traveller eye') and sum(p.normal.y for p in o.data.polygons) > 0:
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str((output/'character.blend').resolve()))
bpy.ops.export_scene.gltf(filepath=str((output/'character.glb').resolve()),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True)
bpy.ops.export_scene.fbx(filepath=str((output/'character.fbx').resolve()),use_selection=True,object_types={'ARMATURE','MESH'},add_leaf_bones=False,bake_anim=True,bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,path_mode='COPY',embed_textures=True)

"""Reproducible neutral-material Blender reconstruction of selected rounded caravan A.
Blender --background --python scripts/blender/ship/build_caravan.py -- --out <dir>
Game coordinates: X length (bow negative), Y up, Z porch. Export is full 40m.
"""
import bpy, math, pathlib, sys, argparse, json
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',default='public/models/ships/caravan-a');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
ROOT=pathlib.Path(__file__).resolve().parents[3];OUT=pathlib.Path(a.out).resolve();OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
COLORS={'cream':'e7d8b6','ivory':'f1e4cb','lavender':'a295ac','coral':'da8c75','teal':'7baca7','dark':'374b50','metal':'958d78','wood':'aa8d6b','leaf':'657e66'}
M={}
for n,h in COLORS.items():
 m=bpy.data.materials.new(n);m.diffuse_color=tuple(int(h[i:i+2],16)/255 for i in (0,2,4))+(1,);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=m.diffuse_color;m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8;M[n]=m

def xyz(p):return (p[0],-p[2],p[1])
def empty(n):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);return o
G={n:empty(n) for n in ['hull','cockpit','engines','roof','water-tank']}
def mesh(n,vs,fs,mat='cream',group='hull',mi=None):
 me=bpy.data.meshes.new(n);me.from_pydata([xyz(v) for v in vs],[],fs);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);o.parent=G[group]
 for m in ([mat] if isinstance(mat,str) else mat):me.materials.append(M[m])
 for i,f in enumerate(me.polygons):f.use_smooth=True;f.material_index=mi[i] if mi else 0
 return o

def cube(n,pos,size,mat='cream',bevel=.15,group='hull'):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(pos));o=bpy.context.object;o.name=n;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[mat]);o.parent=G[group]
 if bevel:
  b=o.modifiers.new('rounded manufactured corners','BEVEL');b.width=bevel;b.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
 for f in o.data.polygons:f.use_smooth=True
 o.modifiers.new('weighted corner normals','WEIGHTED_NORMAL');return o

def ellipsoid(n,pos,size,mat='cream',group='hull'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=xyz(pos));o=bpy.context.object;o.name=n;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[mat]);o.parent=G[group]
 for f in o.data.polygons:f.use_smooth=True
 return o

def tube(n,pts,r,mat='metal',group='hull'):
 cu=bpy.data.curves.new(n,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=1;sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
 for pt,v in zip(sp.points,pts):pt.co=(*xyz(v),1)
 o=bpy.data.objects.new(n,cu);bpy.context.collection.objects.link(o);o.parent=G[group];cu.materials.append(M[mat]);return o

# Smooth longitudinal sections preserve the three major inhabited volumes rather than a uniform capsule.
def loft(n,sections,group='hull',mat='cream',bands=False,window=False):
 vs=[];fs=[];mi=[];nr=64 if group.startswith('booster-') else 96
 for x,cy,ry,rz in sections:
  for j in range(nr):
   t=2*math.pi*j/nr;ss=math.sin(t);cc=math.cos(t);power=2/2.6 if group=='hull' else 1;vs.append((x,cy+ry*math.copysign(abs(ss)**power,ss),rz*math.copysign(abs(cc)**power,cc)))
 for i in range(len(sections)-1):
  for j in range(nr):
   k=i*nr+j;ids=(k,i*nr+(j+1)%nr,(i+1)*nr+(j+1)%nr,(i+1)*nr+j);c=tuple(sum(vs[k][ax] for k in ids)/4 for ax in range(3))
   if window and c[0]<-11.8 and 9.5<c[1]<11.65:continue
   fs.append(tuple(reversed(ids)));mi.append((1 if 14.7<c[0]<17.7 else 0) if group.startswith('booster-') else (2 if bands and 6.9<c[1]<8.1 else 1 if bands and any(abs(c[0]-v)<.8 for v in [-12,-3.5,8.7]) else 0))
 if group!='hull':fs.extend([tuple(reversed(range(nr))),tuple((len(sections)-1)*nr+j for j in range(nr))]);mi.extend([0,0])
 return mesh(n,vs,fs,['cream','lavender','coral'] if bands else mat,group,mi if bands else None)
# Fine section sampling through smooth interpolation keeps intentionally distinct shoulders.
def sample(keys):
 out=[]
 for i in range(len(keys)-1):
  aa=keys[max(0,i-1)];bb=keys[i];cc=keys[i+1];dd=keys[min(len(keys)-1,i+2)]
  for j in range(8):
   t=j/8;out.append(tuple(.5*((2*bb[k])+(-aa[k]+cc[k])*t+(2*aa[k]-5*bb[k]+4*cc[k]-dd[k])*t*t+(-aa[k]+3*bb[k]-3*cc[k]+dd[k])*t*t*t) for k in range(4)))
 out.append(keys[-1]);return out
# Cabin loops explicitly follow window sill/brow and coral paint boundaries.
ys=[3.31,3.45,3.8,4.3,4.9,5.5,6.0,6.4,6.9,7.3,7.7,8.1,8.4,9.0,9.48,10.0,10.6,11.1,11.68,12.0,12.3,12.6,12.9,13.1,13.28]
vs=[];fs=[];mi=[];nr=77
for y in ys:
 r=max(.003,1-abs((y-8.3)/5.0)**2.6)**(1/2.6)
 for j in range(65):
  t=-math.pi/2+math.pi*j/64;vs.append((-13.8-6.2*r*math.cos(t),y,5.5*r*math.sin(t)))
 vs.extend([(x,y,5.5*r) for x in [-13.4,-13,-12.2,-11,-10,-9]])
 vs.extend([(x,y,-5.5*r) for x in [-9,-10,-11,-12.2,-13,-13.4]])
for i in range(len(ys)-1):
 for j in range(nr):
  if j==70 or (9.48<=ys[i]<11.68 and j<64):continue
  k=i*nr+j;fs.append((k,i*nr+(j+1)%nr,(i+1)*nr+(j+1)%nr,(i+1)*nr+j));mi.append(2 if -13.4<sum(vs[v][0] for v in fs[-1])/4<-11 else 1 if 6.9<=ys[i]<8.1 else 0)
# Close the small terminal loops: the belly must be solid in an actual underside view.
def cap_strip(points,lo,hi):
 for bound,greater in [(lo,True),(hi,False)]:
  result=[]
  for i,a in enumerate(points):
   b=points[(i+1)%len(points)];ina=a[0]>=bound if greater else a[0]<=bound;inb=b[0]>=bound if greater else b[0]<=bound
   if ina:result.append(a)
   if ina!=inb:
    t=(bound-a[0])/(b[0]-a[0]);result.append(tuple(a[k]+t*(b[k]-a[k]) for k in range(3)))
  points=result
  if not points:break
 return points
for row,reverse in [(0,True),(len(ys)-1,False)]:
 outline=vs[row*nr:(row+1)*nr]
 for lo,hi,mat in [(-100,-13.4,0),(-13.4,-11,2),(-11,100,0)]:
  polygon=cap_strip(outline,lo,hi)
  if len(polygon)<3:continue
  ids=tuple(range(len(vs),len(vs)+len(polygon)));vs.extend(polygon);fs.append(tuple(reversed(ids)) if reverse else ids);mi.append(mat)
mesh('deep rounded forecabin',vs,fs,['cream','coral','lavender'],'hull',mi)
# The middle reuses the cabin's exact side-boundary rows, then welds at x=-9.
sections=sample([(-9,8.3,5.0,5.5),(-8.4,8.25,4.85,5.2),(1,8.0,4.55,4.5),(6.7,7.6,4.15,4.15),(10,7.2,3.7,3.65),(14.7,6.9,2.7,2.6),(16,6.9,1.4,1.6)])
vs=[];fs=[];mi=[];nr=len(ys)*2
for x,cy,ry,rz in sections:
 for sign,rows in [(1,ys),(-1,list(reversed(ys)))]:
  for y in rows:
   q=(y-8.3)/5;vs.append((x,cy+ry*q,sign*rz*max(.003,1-abs(q)**2.6)**(1/2.6)))
for i in range(len(sections)-1):
 for j in range(nr):
  k=i*nr+j;ids=(k,i*nr+(j+1)%nr,(i+1)*nr+(j+1)%nr,(i+1)*nr+j);c=tuple(sum(vs[k][ax] for k in ids)/4 for ax in range(3));fs.append(ids);mi.append(2 if 6.9<c[1]<8.1 else 1 if -9<c[0]<-7.7 or abs(c[0]-8.7)<.8 else 0)
mid=mesh('stepped middle habitation',vs,fs,['cream','lavender','coral'],'hull',mi)
# Weld the shared boundary instead of hiding a gap with an overlapping collar.
cabin=bpy.data.objects['deep rounded forecabin'];bpy.ops.object.select_all(action='DESELECT');cabin.select_set(True);mid.select_set(True);bpy.context.view_layer.objects.active=cabin;bpy.ops.object.join();bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.001);bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');cabin.select_set(False)
# Swept curved glazing set high over a deep chin. Broad brow and sill are separate solid layers.
def glasspos(t,y,offset=0):
 ry=max(.01,1-abs((y-8.3)/5.0)**2.6)**(1/2.6);return (-13.8-(6.2+offset)*ry*math.cos(t),y,(5.5+offset)*ry*math.sin(t))
def glassrow(y):
 ry=max(.01,1-abs((y-8.3)/5)**2.6)**(1/2.6);z=5.62*ry;d=min(y-9.48,11.68-y);end=-12.6-(.25-math.sqrt(max(0,.25**2-max(0,.25-d)**2)))
 return [(end,y,-z)]+[glasspos(-math.pi/2+math.pi*i/48,y,.10) for i in range(49)]+[(end,y,z)]
vs=[];fs=[];ny=16;nr=51
for j in range(ny+1):vs.extend(glassrow(9.48+2.2*j/ny))
for j in range(ny):
 for i in range(nr-1):k=j*nr+i;fs.append((k,k+nr,k+nr+1,k+1))
mesh('high panoramic windshield',vs,fs,'dark','cockpit')
for y,r in [(9.48,.12),(11.68,.19),(11.90,.09)]:
 pts=glassrow(min(11.68,y));pts=[(x,yy+(y-min(11.68,y)),z) for x,yy,z in pts];tube('layered cockpit frame',pts,r,'cream','cockpit')
for side in [-1,1]:tube('rounded cockpit side return',[glassrow(9.48+2.2*j/24)[0 if side<0 else -1] for j in range(25)],.12,'cream','cockpit')
for t in [-1.05,-.55,0,.55,1.05]:tube('window structural mullion',[glasspos(t,9.5+2.16*j/12,.14) for j in range(13)],.055,'cream','cockpit')
# Four distinct rear boosters: mirrored port/starboard pairs at upper and lower levels.
BOOSTERS=[(f'booster-{side}-{level}',cy,cz,r) for side,cz in [('port',-3.2),('starboard',3.2)] for level,cy,r in [('upper',11.4,2.8),('lower',5.6,2.75)]]
for n,cy,cz,r in BOOSTERS:
 G[n]=empty(n)
 o=loft(n+' egg nacelle',sample([(9.8,cy,.15,.15),(11.2,cy,r*.75,r*.75),(13.2,cy,r,r),(17,cy,r*.98,r*.98),(19.5,cy,r*.75,r*.75),(20,cy,r*.62,r*.62)]),n,bands=True);o.location.y=-cz
 for x,rr in [(18.7,r*.84),(19.6,r*.72)]:tube(n+' nozzle collar',[(x,cy+rr*math.sin(i*math.tau/64),cz+rr*math.cos(i*math.tau/64)) for i in range(65)],.12,'metal',n)
 ellipsoid(n+' dark exhaust',(19.96,cy,cz),(.08,r*.58,r*.58),'dark',n)
 cube(n+' pylon',(11.8,cy,cz),(4.3,1.7,2.0),'metal',.55,n)
# Distinct low roof cabins, utility box and observation cupola.
cube('forward roof service cabin',(-9.0,13.15,-.6),(4.2,1.0,3.6),'cream',.45,'roof')
cube('roof service block',(-3.4,12.6,-1.3),(4.6,1.2,3.2),'cream',.5,'roof')
ellipsoid('observation cupola',(3.3,12.1,-.5),(2.3,1.5,2.1),'cream','roof')
for x in [-10,-7,-3,3,5]:cube('roof narrow blue glazing',(x,13.1 if x<0 else 12.7,1.1),(1.1,.4,.12),'dark',.12,'roof')
# Retain characteristic tank as authored volume on the porch side.
ellipsoid('tank body',(8.8,6.5,4.8),(1.12,1.95,1.12),'teal','water-tank')
for y in [5.2,7.8]:tube('tank strap',[(8.8+1.15*math.cos(i*math.tau/48),y,4.8+1.15*math.sin(i*math.tau/48)) for i in range(49)],.06,'metal','water-tank')
# Precisely cut the side aperture through a thin shell; the cabin/middle joint remains welded.
solid=cabin.modifiers.new('manufactured shell thickness','SOLIDIFY');solid.thickness=.06;bpy.context.view_layer.objects.active=cabin;bpy.ops.object.modifier_apply(modifier=solid.name)
cutter=cube('temporary bay cutter',(2,6.85,5),(10.8,4.9,10),'dark',0)
boolean=cabin.modifiers.new('side camp aperture','BOOLEAN');boolean.operation='DIFFERENCE';boolean.solver='EXACT';boolean.object=cutter;bpy.context.view_layer.objects.active=cabin;bpy.ops.object.modifier_apply(modifier=boolean.name);bpy.data.objects.remove(cutter,do_unlink=True)
# Reference-specific narrow windows, mounted hatches, joint seams and external service plumbing.
def surface(x,y):
 for i in range(len(sections)-1):
  a,b=sections[i],sections[i+1]
  if a[0]<=x<=b[0]:
   t=(x-a[0])/(b[0]-a[0]);cy=a[1]*(1-t)+b[1]*t;ry=a[2]*(1-t)+b[2]*t;rz=a[3]*(1-t)+b[3]*t;return rz*max(.001,1-abs((y-cy)/ry)**2.6)**(1/2.6)
 return 3

def window(n,x,y,w,h,side=1):
 def plate(name,ww,hh,depth,mat):
  vs=[];fs=[];nx=32;ny=8;rad=min(.22,hh/2)
  for j in range(ny+1):
   yy=-hh/2+hh*j/ny;edge=ww/2-rad+math.sqrt(max(0,rad*rad-max(0,abs(yy)-(hh/2-rad))**2))
   for i in range(nx+1):
    xx=x-edge+2*edge*i/nx;vs.append((xx,y+yy,side*(surface(xx,y+yy)+depth)))
  for j in range(ny):
   for i in range(nx):
    k=j*(nx+1)+i;f=(k,k+1,k+nx+2,k+nx+1);fs.append(f if side>0 else tuple(reversed(f)))
  return mesh(name,vs,fs,mat)
 plate(n+' continuous rounded frame',w+.22,h+.2,.10,'cream');plate(n+' continuous blue glazing',w,h,.13,'teal')
 for k in range(1,max(2,round(w/.65))):
  xx=x-w/2+w*k/max(2,round(w/.65));tube(n+' mullion',[(xx,y-h/2+i*h/8,side*(surface(xx,y-h/2+i*h/8)+.16)) for i in range(9)],.022,'cream')
for side in [-1,1]:
 window('long saloon window',1.6,10.4,5.5,.65,side);window('aft cabin window',10.9,8.8,2.4,.55,side);window('forward clerestory',-6.1,11.4,2.7,.55,side)
 for x in [-7.2,-4.8,8.1,11.7]:
  y=8.6 if x<0 else 6.9;z=side*(surface(x,y)+.07);cube('recessed service hatch',(x,y,z),(.62,.9,.12),'metal',.12)
  cube('service hatch inset',(x,y,z+side*.08),(.45,.7,.08),'cream',.08)
# Cabin broad lavender rear band and deliberately spaced panel joints.
for side in [-1,1]:
 for x in [-12.9,-11.0,-9.4]:
  pts=[]
  for y in ys:
   r=max(.003,1-abs((y-8.3)/5)**2.6)**(1/2.6);pts.append((x,y,side*(5.5*r+.025)))
  tube('forecabin vertical panel seam',pts,.014,'metal')
 for y in [5.0,8.8,12.1]:
  r=max(.003,1-abs((y-8.3)/5)**2.6)**(1/2.6);tube('forecabin horizontal panel seam',[(-13.6,y,side*(5.5*r+.02)),(-9.05,y,side*(5.5*r+.02))],.014,'metal')
 # Small cabin porthole and access panel, placed on actual broad sidewall.
 y=6;z=side*(5.5*max(.003,1-abs((y-8.3)/5)**2.6)**(1/2.6)+.06)
 tube('cabin round porthole rim',[(-11.5+.37*math.cos(t*math.tau/48),y+.37*math.sin(t*math.tau/48),z) for t in range(49)],.065,'metal')
 ellipsoid('cabin round porthole',(-11.5,y,z),(.29,.29,.05),'dark')
 cube('cabin small access door',(-10.8,9.0,side*5.5),(.48,.85,.12),'metal',.12)
for x in [-7.7,-4.0,.5,5.0,9.5,13.0]:
 pts=[]
 for i in range(53):
  y=4.3+i*.14;z=surface(x,y)
  if z>.3:pts.append((x,y,z+.025))
 if len(pts)>1:tube('habitation panel station',pts,.014,'metal')
for y in [5.4,8.5,11.2]:
 for lo,hi in [(-8,-3.6),(7.6,13.7)]:tube('longitudinal service seam',[(lo+(hi-lo)*i/40,y,surface(lo+(hi-lo)*i/40,y)+.025) for i in range(41)],.014,'metal')
# Substantial exterior umbilicals and belly machinery follow the functional joints.
for z in [-2.8,2.8]:
 tube('belly main conduit',[(-16,3.6,z),(-12,3.0,z),(-7,2.8,z),(2,2.8,z),(9,3.5,z),(13,4,z)],.11,'metal')
 for x in [-13,-8,-2,4,10]:cube('belly equipment housing',(x,3.25,z),(1.5,.55,1.1),'metal',.18)
for x in [-7.8,6.7]:
 tube('roof cable riser',[(x,9.3,4.3),(x,11.3,4.0),(x,12.5,2),(x,12.6,-1)],.075,'metal','roof')
# Reference rooftop cabins: small framed glazing, vents, antenna bases and narrow poles.
for x,y,z in [(-9.5,13.55,1.0),(-3.4,13.0,.35),(3.3,12.7,1.35)]:
 cube('roof cabin window frame',(x,y,z),(1.8,.48,.15),'cream',.12,'roof');cube('roof cabin window',(x,y,z+.1),(1.6,.3,.10),'dark',.09,'roof')
for x,z,h in [(-11,-1,2.7),(-7.2,-1.5,3.4),(-3.7,-1.3,2.4),(4.7,-.7,3.4),(10.2,-1,2.5)]:
 basey=12.8 if x<1 else 11.8;cube('antenna equipment base',(x,basey,z),(.55,.65,.55),'cream',.16,'roof');tube('roof aerial',[(x,basey,z),(x,basey+h,z)],.025,'metal','roof')
 for y in [basey+.8,basey+1.5]:cube('aerial receiver',(x,y,z),(.17,.34,.20),'metal',.04,'roof')
for x in [-12,-5.2,5.7]:ellipsoid('roof ventilation dome',(x,12.9 if x<0 else 11.5,-2.0),(.65,.45,.65),'cream','roof')
# Engine seams and service rings delineate long egg shoulders and cylindrical hot sections.
for n,cy,cz,r in BOOSTERS:
 for x,rr in [(13.0,r*.99),(15.6,r),(17.7,r*.94)]:tube('nacelle shell station',[(x,cy+rr*math.sin(i*math.tau/64),cz+rr*math.cos(i*math.tau/64)) for i in range(65)],.025,'metal',n)
 for t in [i*math.tau/12 for i in range(12)]:tube('engine longitudinal panel',[(13.2,cy+r*math.sin(t),cz+r*math.cos(t)),(17,cy+r*.98*math.sin(t),cz+r*.98*math.cos(t)),(19.5,cy+r*.75*math.sin(t),cz+r*.75*math.cos(t))],.018,'metal',n)
 for x in [10.7,11.5]:cube('engine pylon service saddle',(x,cy,cz),(1.1,1.9,2.4),'metal',.35,n)
# Complete compact camp, authored open at final scale. Runtime uses extras for staged closure.
for n in ['porch-panel','porch-rail','porch-supports','ramp','porch-furniture','plants','awning','laundry','solar-panel','roof-ladder','landing-gear','locker-shutter']:G[n]=empty(n)
mechanisms={}
def mechanism(n,pivot,stage=None,**kw):mechanisms[n]=(pivot,dict(stage=stage,**kw) if stage else kw)
floor=4.4;hingez=surface(2,floor)
# The curved outside becomes the flush side hull when the entire deck rotates upward.
vs=[];fs=[];mi=[];nx=40;ny=24
for j in range(ny+1):
 h=4.9*j/ny
 for i in range(nx+1):
  x=-3.4+10.8*i/nx;vs.append((x,floor-(surface(x,floor+h)-hingez)-.05,hingez+h))
for j in range(ny):
 for i in range(nx):
  k=j*(nx+1)+i;fs.append((k,k+1,k+nx+2,k+nx+1));mi.append(1 if 6.9<floor+4.9*(j+.5)/ny<8.1 else 0)
mesh('curved porch exterior',vs,fs,['cream','coral'],'porch-panel',mi)
cube('porch interior timber',(2,floor,hingez+2.45),(10.8,.16,4.9),'wood',.04,'porch-panel')
for x in [-3.2+i*.38 for i in range(28)]:tube('deck plank seam',[(x,floor+.085,hingez+.1),(x,floor+.085,hingez+4.8)],.012,'dark','porch-panel')
mechanism('porch-panel',(2,floor,hingez),'deck',closedRotation=[-math.pi/2,0,0])
# Fixed aperture edge, shallow threshold and deep open storage bay.
for x in [-3.4,7.4]:tube('hatch side seal',[(x,floor+i*4.9/32,surface(x,floor+i*4.9/32)+.02) for i in range(33)],.07,'metal')
for y in [floor,9.3]:tube('hatch transverse seal',[(-3.4+10.8*i/48,y,surface(-3.4+10.8*i/48,y)+.02) for i in range(49)],.07,'metal')
cube('deep storage back',(2,6.7,-.8),(10.7,4.6,.12),'cream',.02)
cube('bay ceiling',(2,9.22,1.4),(10.7,.12,4.3),'cream',.02)
cube('bay floor',(2,floor-.08,1.1),(10.7,.14,4.4),'wood',.02)
cube('locker shutter',(2.8,9.275,2.5),(8.8,.05,.12),'metal',.015,'locker-shutter')
cube('locker roller cassette',(2.8,9.3,2.5),(9.0,.20,.30),'cream',.07)
mechanism('locker-shutter',(2.8,9.3,2.5),None,range=[.55,.65],closedScale=[1,98,1])
# Entry at the fore edge, tall enough for a person but subordinate to the cabin.
cube('door rounded frame',(-2.65,5.92,2.8),(1.35,3.04,.2),'metal',.3)
cube('door inner panel',(-2.65,5.92,2.94),(1.12,2.82,.16),'cream',.24)
cube('door upper window',(-2.65,6.65,3.05),(.72,.8,.08),'dark',.16)
tube('entry grab rail',[(-1.9,5.0,3.2),(-1.9,6.7,3.2)],.045,'metal')
for x in [-.5,3.5]:
 tube('porch hanging lamp stem',[(x,9.1,2.9),(x,8.3,2.9)],.025,'metal')
 ellipsoid('porch lamp shade',(x,8.25,2.9),(.28,.16,.28),'metal')
 ellipsoid('porch lamp globe',(x,8.12,2.9),(.17,.12,.17),'ivory')
# Upright rail folds flat toward the deck before the deck closes.
for x in [-.6,1.1,2.8,4.5,6.2]:tube('porch rail upright',[(x,4.5,hingez+4.65),(x,5.55,hingez+4.65)],.038,'metal','porch-rail')
tube('porch top rail',[(-.6,5.55,hingez+4.65),(6.6,5.55,hingez+4.65)],.055,'metal','porch-rail')
mechanism('porch-rail',(2,4.5,hingez+4.65),'rails',closedRotation=[-math.pi/2,0,0])
for x in [-1.0,6.0]:
 tube('telescoping porch support',[(x,4.3,hingez+4.4),(x,1,hingez+4.4)],.08,'metal','porch-supports');cube('porch support shoe',(x,.93,hingez+4.4),(.55,.16,.55),'metal',.06,'porch-supports')
mechanism('porch-supports',(2,4.3,hingez+4.4),'supports',closedScale=[1,.001,1],hideClosed=True)
# Nested stair section retracts beneath deck while it is horizontal.
for i in range(12):
 y=4.3-i*.30;z=hingez+4.6+i*.32;cube('stair tread',(-2.55,y,z),(1.7,.10,.35),'wood',.025,'ramp')
for x in [-3.4,-1.7]:tube('stair stringer',[(x,4.25,hingez+4.5),(x,.9,hingez+8.3)],.075,'metal','ramp')
mechanism('ramp',(-2.55,4.3,hingez+4.5),'ramp',closedOffset=[0,.5,-5.8],hideClosed=True)
# Furnishings slide together on a rigid storage tray, without scale collapse.
cube('folding table top',(1.1,5.65,hingez+2.25),(1.55,.12,1.0),'wood',.06,'porch-furniture')
for x in [.5,1.7]:
 for z in [hingez+1.9,hingez+2.6]:tube('table folding leg',[(x,5.6,z),(1.1,4.5,z)],.04,'metal','porch-furniture')
for x,z in [(0,hingez+3.1),(2.4,hingez+1.8)]:
 cube('chair seat',(x,5.0,z),(.65,.1,.7),'wood',.06,'porch-furniture')
 for dx in [-.28,.28]:
  tube('chair curved frame',[(x+dx,4.5,z+.28),(x+dx,5,z+.28),(x+dx,5.9,z+.28)],.035,'metal','porch-furniture');tube('chair front leg',[(x+dx,5,z-.28),(x+dx,4.5,z-.28)],.035,'metal','porch-furniture')
 cube('chair back',(x,5.55,z+.28),(.65,.62,.07),'wood',.045,'porch-furniture')
mechanism('porch-furniture',(1.2,4.5,hingez+2.3),'props',closedOffset=[0,0,-5.7])
for i,x in enumerate([4.0,4.8,5.6,6.4]):
 cube('planter box',(x,4.8,hingez+3.8),(.65,.55,.7),'wood',.06,'plants')
 for j in range(6):
  ang=j*math.tau/6;xx=x+.22*math.cos(ang);zz=hingez+3.8+.25*math.sin(ang);tube('plant stem',[(x,5,hingez+3.8),(xx,5.5+(j%3)*.15,zz)],.018,'leaf','plants');ellipsoid('plant leaf',(xx,5.5+(j%3)*.15,zz),(.14,.10,.28),'leaf','plants')
mechanism('plants',(5.2,4.5,hingez+3.8),'props',closedOffset=[0,0,-6.5])
# Striped scalloped canvas, its leading edge and posts roll back into a fixed wall cassette.
for i in range(10):
 x=-3.2+i*1.04;mesh('awning cloth stripe',[(x,9.2,4.4),(x+1.04,9.2,4.4),(x+1.04,7.5,hingez+4.9),(x,7.5,hingez+4.9)],[(0,1,2,3)],'coral' if i%2==0 else 'teal','awning')
 ellipsoid('awning scalloped hem',(x+.52,7.42,hingez+4.9),(.53,.19,.055),'coral' if i%2==0 else 'teal','awning')
for x in [-3.2,7.2]:tube('awning folding arm',[(x,9.15,4.4),(x,7.5,hingez+4.9)],.055,'metal','awning')
tube('awning front bar',[(-3.2,7.5,hingez+4.9),(7.2,7.5,hingez+4.9)],.06,'metal','awning')
cube('awning roller cassette',(2,9.25,4.35),(10.7,.32,.4),'cream',.12)
mechanism('awning',(2,9.2,4.4),'canopy',closedScale=[1,.001,.001],hideClosed=True)
# Roof service ladder, solar grid and compact laundry retract separately before the deck moves.
for x in [7.0,7.65]:tube('ladder stile',[(x,5.0,4.6),(x,10.6,4.6),(x,12.0,2.6)],.055,'metal','roof-ladder')
for y in [5.2+i*.42 for i in range(14)]:tube('ladder rung',[(7,y,4.6),(7.65,y,4.6)],.05,'metal','roof-ladder')
mechanism('roof-ladder',(7.3,11,4.6),'canopy',closedScale=[1,.001,1],hideClosed=True)
for x in [5.0,8.6]:tube('telescoping laundry pole',[(x,11.5,-1),(x,14.0,-1)],.035,'metal','laundry')
tube('washing line',[(5,14,-1),(6.8,13.8,-1),(8.6,14,-1)],.014,'metal','laundry')
for x,mat in [(5.8,'ivory'),(7.3,'lavender')]:cube('hanging laundry',(x,13.2,-1),(.95,1.3,.035),mat,.04,'laundry')
mechanism('laundry',(6.8,11.5,-1),'laundry',closedOffset=[0,-3,0],hideClosed=True)
cube('solar panel',(-3,13.7,-.5),(5.2,.16,3.0),'dark',.06,'solar-panel')
for x in [-5.5+i*.52 for i in range(11)]:tube('solar cell column',[(x,13.79,-1.98),(x,13.79,.98)],.015,'metal','solar-panel')
for z in [-1.98+i*.5 for i in range(7)]:tube('solar cell row',[(-5.5,13.79,z),(-.5,13.79,z)],.015,'metal','solar-panel')
mechanism('solar-panel',(-3,12.9,-.5),'solar',closedOffset=[0,-.7,0],closedRotation=[-.5,0,0])
# Broad splayed articulated landing gear; each includes mounting saddle, knee, piston and shoe.
for x,z in [(-15,3.4),(-11,-3.4),(10.5,2.6),(9.5,-2.6)]:
 endx=x-1 if x<0 else x+1;endz=z*1.15
 cube('landing mount',(x,3.2,z),(1.5,.65,1.4),'metal',.2,'landing-gear')
 tube('landing upper arm',[(x,3.2,z),(endx,2.0,endz)],.25,'cream','landing-gear')
 ellipsoid('landing knee',(endx,2,endz),(.45,.4,.45),'metal','landing-gear')
 tube('landing piston',[(x+.35,3.3,z),(endx+.25,1.6,endz)],.12,'metal','landing-gear')
 tube('landing lower arm',[(endx,2,endz),(endx-.25,1.05,endz+.1)],.28,'cream','landing-gear')
 cube('landing broad shoe',(endx-.25,.93,endz+.1),(2.5,.32,1.7),'metal',.25,'landing-gear')
 cube('landing shoe pad',(endx-.25,.78,endz+.1),(2.25,.12,1.5),'dark',.12,'landing-gear')
mechanism('landing-gear',(0,3,0),'gear',closedOffset=[0,3.5,0],hideClosed=True)
# Store pivots and closed transforms in glTF extras; no model-specific coordinates in runtime.
from mathutils import Matrix
for n,(pivot,extra) in mechanisms.items():
 g=G[n];g.location=xyz(pivot)
 for child in g.children:child.matrix_parent_inverse=Matrix.Translation(-Vector(xyz(pivot)))
 g['caravanMechanism']=extra

# Solar opens at a genuine30-degree tilt; closed delta restores a flush panel.
G['solar-panel'].rotation_euler.x=.5
for g in G.values():g.location.z-=.8
# Each booster remains an editable named assembly beneath the fixed engine root.
bpy.context.view_layer.update()
for n,cy,cz,r in BOOSTERS:
 g=G[n];world=g.matrix_world.copy();g.parent=G['engines'];g.matrix_world=world
# The rail is a rigid deck child and travels with the folding panel.
rail=G['porch-rail'];world=rail.matrix_world.copy();bpy.context.view_layer.update();world=rail.matrix_world.copy();rail.parent=G['porch-panel'];rail.matrix_world=world

# Camera-neutral source asset. Lights/camera are never included in GLB.
bpy.ops.object.select_all(action='DESELECT')
for o in list(bpy.context.scene.objects):
 if o.type=='CURVE':o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o.select_set(False)
# Batch each rigid assembly into one mesh with shared material ranges. Keep animated pivots separate.
for name,g in G.items():
 children=[o for o in g.children if o.type=='MESH']
 if not children:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in children:o.select_set(True)
 bpy.context.view_layer.objects.active=children[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.join();bpy.context.object.name=name+' surfaces';bpy.context.object.select_set(False)
blend=ROOT/'references/The Travellers Ship/redesign/rounded-caravan-a/caravan-a.blend';blend.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.export_scene.gltf(filepath=str(OUT/'caravan.glb'),export_format='GLB',export_yup=True,export_apply=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
print('CARAVAN_EXPORT',OUT/'caravan.glb')

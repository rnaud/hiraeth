"""Authored anatomical prototype; no Meshy skeleton or weights are used.
Keeps source geometry, UVs and texture bytes unchanged. Coordinates below use
1.3-unit grounded height for readable landmark placement. No finger rig.
"""
import json,struct,sys,hashlib
from pathlib import Path
src,out=map(Path,sys.argv[1:3]); raw=src.read_bytes(); jl=struct.unpack_from('<I',raw,12)[0]; g=json.loads(raw[20:20+jl]); binary=bytearray(raw[28+jl:]); p=g['meshes'][0]['primitives'][0]; a=g['accessors'][p['attributes']['POSITION']]; v=g['bufferViews'][a['bufferView']]; off=v.get('byteOffset',0)+a.get('byteOffset',0); stride=v.get('byteStride',12)
positions=[struct.unpack_from('<3f',binary,off+i*stride) for i in range(a['count'])]; lo=[min(p[k] for p in positions) for k in range(3)]; hi=[max(p[k] for p in positions) for k in range(3)]; scale=1.3/(hi[1]-lo[1]); center=[(lo[k]+hi[k])/2 for k in range(3)]
bones=[]
def bone(name,parent,xyz):
    bones.append((name,parent,xyz));return len(bones)-1
hips=bone('Hips',None,[0,.44,0]);spine=bone('Spine',hips,[0,.61,-.02]);chest=bone('Chest',spine,[0,.82,-.05]);neck=bone('Neck',chest,[0,.96,-.02]);head=bone('Head',neck,[0,1.05,0])
for side,s in [('Left',1),('Right',-1)]:
    sh=bone(side+'Shoulder',chest,[s*.20,.84,-.055]);arm=bone(side+'Arm',sh,[s*.32,.84,-.055]);fore=bone(side+'ForeArm',arm,[s*.56,.84,-.04]);hand=bone(side+'Hand',fore,[s*.80,.85,.045]);thigh=bone(side+'UpLeg',hips,[s*.165,.43,0]);calf=bone(side+'Leg',thigh,[s*.22,.245,.035]);foot=bone(side+'Foot',calf,[s*.23,.09,.02]);bone(side+'ToeBase',foot,[s*.23,.045,.13])
lookup={b[0]:i for i,b in enumerate(bones)}
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def mix(n1,n2,t):return {lookup[n1]:1-t,lookup[n2]:t}
def weights(x,y,z):
    ax=abs(x);side='Left' if x>=0 else 'Right'
    # Arms are horizontal; ears above them must stay on the head.
    if ax>.28 and (y<.965 or ax>.72) and y>.69:
        if ax<.40:return mix('Chest',side+'Arm',smooth(.28,.40,ax))
        if ax<.66:return mix(side+'Arm',side+'ForeArm',smooth(.49,.63,ax))
        return mix(side+'ForeArm',side+'Hand',smooth(.74,.84,ax))
    if y>.88:return mix('Chest','Head',smooth(.88,1.0,y))
    if y>.46:return mix('Hips','Spine',smooth(.46,.68,y)) if y<.73 else mix('Spine','Chest',smooth(.73,.84,y))
    # Separate legs by their lateral position, keep front/rear loincloth at pelvis.
    leg=smooth(.055,.14,ax)*(1-smooth(.36,.46,y))
    if z>.145 or z<-.14:leg*=1-smooth(.28,.36,y)
    if y>.30:w={lookup[side+'UpLeg']:1}
    elif y>.15:w=mix(side+'Leg',side+'UpLeg',smooth(.19,.29,y))
    else:w=mix(side+'Foot',side+'Leg',smooth(.09,.17,y))
    w={k:v*leg for k,v in w.items()};w[hips]=1-leg;return w
J=[];W=[]
for pos in positions:
    x=(pos[0]-center[0])*scale;y=(pos[1]-lo[1])*scale;z=(pos[2]-center[2])*scale
    pairs=sorted(weights(x,y,z).items(),key=lambda a:-a[1]);pairs=[a for a in pairs if a[1]>0];pairs+=( [(0,0)]*(4-len(pairs)) );J.extend(k for k,w in pairs);W.extend(w for k,w in pairs)
def append(data,typ,ct,count,target=None):
    while len(binary)%4:binary.append(0)
    bv={'buffer':0,'byteOffset':len(binary),'byteLength':len(data)}
    if target:bv['target']=target
    g['bufferViews'].append(bv);binary.extend(data);g['accessors'].append({'bufferView':len(g['bufferViews'])-1,'componentType':ct,'count':count,'type':typ});return len(g['accessors'])-1
p['attributes']['JOINTS_0']=append(struct.pack('<%dH'%len(J),*J),'VEC4',5123,len(positions),34962);p['attributes']['WEIGHTS_0']=append(struct.pack('<%df'%len(W),*W),'VEC4',5126,len(positions),34962)
world=[]
for _,_,b in bones:world.append([b[0]/scale+center[0],b[1]/scale+lo[1],b[2]/scale+center[2]])
start=len(g['nodes']);ibm=[]
for i,(name,parent,_) in enumerate(bones):
    xyz=world[i];t=xyz if parent is None else [xyz[k]-world[parent][k] for k in range(3)];n={'name':name,'translation':t};children=[start+j for j,b in enumerate(bones) if b[1]==i]
    if children:n['children']=children
    g['nodes'].append(n);ibm.extend([1,0,0,0,0,1,0,0,0,0,1,0,-xyz[0],-xyz[1],-xyz[2],1])
ib=append(struct.pack('<%df'%len(ibm),*ibm),'MAT4',5126,len(bones));g['skins']=[{'name':'Authored grunt anatomical trial','joints':list(range(start,start+len(bones))),'skeleton':start,'inverseBindMatrices':ib}]
for n in g['nodes'][:start]:
    if 'mesh' in n:n['skin']=0
for sc in g['scenes']:sc['nodes'].append(start)
g.setdefault('asset',{})['generator']='Hiraeth authored landmark / anatomical weight trial';g['buffers'][0]['byteLength']=len(binary);j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary+=b'\0'*((-len(binary))%4);out.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary)
print(json.dumps({'output':str(out),'bones':len(bones),'vertices':len(positions),'sourceSha256':hashlib.sha256(raw).hexdigest(),'geometry':'Source vertex/index/normal/UV/image byte ranges preserved','fingers':'Not rigged; body-only prototype'},indent=2))

import json,struct,sys
from pathlib import Path
src=Path(sys.argv[1])
b=src.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);data=bytearray(b[28+n:]);done=set()
for m in g['meshes']:
 for p in m['primitives']:
  for name in ['POSITION','NORMAL']:
   i=p['attributes'].get(name)
   if i is None or i in done:continue
   done.add(i);a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];assert a['componentType']==5126 and a['type']=='VEC3'
   off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12);lo=[float('inf')]*3;hi=[-float('inf')]*3
   for j in range(a['count']):
    x,y,z=struct.unpack_from('<fff',data,off+j*stride);q=(-z,y,x);struct.pack_into('<fff',data,off+j*stride,*q)
    for k in range(3):lo[k]=min(lo[k],q[k]);hi[k]=max(hi[k],q[k])
   if name=='POSITION':a['min']=lo;a['max']=hi
assert all('matrix' not in n and 'rotation' not in n for n in g['nodes'])
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);out=struct.pack('<III',0x46546c67,2,28+len(j)+len(data))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(data),0x004e4942)+data
Path(sys.argv[2]).write_bytes(out)
print('Baked -90 degree Y rotation into positions and normals; preserved UVs, topology and texture.')

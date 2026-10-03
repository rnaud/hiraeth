"""Merge the revised body and equipment meshes into the shipped GLB, preserving every original rig/animation byte."""
import copy, json, struct, sys
from pathlib import Path

def read(path):
    raw=Path(path).read_bytes();n=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+n]),bytearray(raw[28+n:])
original,refined,destination=sys.argv[1:]
a,ab=read(original);b,bb=read(refined)
assert [a['nodes'][i]['name'] for i in a['skins'][0]['joints']]==[b['nodes'][i]['name'] for i in b['skins'][0]['joints']]
for node in a['nodes']:
    if node.get('name','').startswith(('Lavender traveller','Equipment ')):node.pop('mesh',None);node.pop('skin',None)
views={};accessors={};materials={}
def accessor(index):
    if index in accessors:return accessors[index]
    item=copy.deepcopy(b['accessors'][index]);view=item['bufferView']
    if view not in views:
        src=b['bufferViews'][view];start=src.get('byteOffset',0)
        while len(ab)%4:ab.append(0)
        dst=copy.deepcopy(src);dst['byteOffset']=len(ab);dst['buffer']=0
        ab.extend(bb[start:start+src['byteLength']]);views[view]=len(a['bufferViews']);a['bufferViews'].append(dst)
    item['bufferView']=views[view];accessors[index]=len(a['accessors']);a['accessors'].append(item);return accessors[index]
rig=next(n for n in a['nodes'] if n.get('name')=='Traveller_Rig')
for node in b['nodes']:
    if not node.get('name','').startswith(('Lavender traveller','Equipment ')) or 'mesh' not in node:continue
    mesh=copy.deepcopy(b['meshes'][node['mesh']])
    for p in mesh['primitives']:
        p['attributes']={k:accessor(v) for k,v in p['attributes'].items()}
        if 'indices' in p:p['indices']=accessor(p['indices'])
        material=p['material']
        if material not in materials:
            m=copy.deepcopy(b['materials'][material])
            existing=next((i for i,old in enumerate(a['materials']) if old.get('name')==m.get('name')),None)
            if existing is not None:materials[material]=existing
            else:
                assert 'baseColorTexture' not in m['pbrMetallicRoughness']
                materials[material]=len(a['materials']);a['materials'].append(m)
        p['material']=materials[material]
    new=copy.deepcopy(node);new['mesh']=len(a['meshes']);new['skin']=0;a['meshes'].append(mesh)
    rig['children'].append(len(a['nodes']));a['nodes'].append(new)
a['buffers'][0]['byteLength']=len(ab)
j=json.dumps(a,separators=(',',':')).encode();j+=b' '*((-len(j))%4);ab+=b'\0'*((-len(ab))%4)
Path(destination).write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(ab))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(ab),0x004e4942)+ab)

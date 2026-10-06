"""Read the baseline texture at each mesh UV for asset-specific garment extraction.
Does not modify or generate raster images. Requires Pillow.
"""
import io
import json
import struct
from pathlib import Path
from PIL import Image
root = Path('output/character-tripo/baseline')
b = (root / 'model.glb').read_bytes()
n = struct.unpack_from('<I', b, 12)[0]
g = json.loads(b[20:20+n])
data = b[28+n:]
p = g['meshes'][0]['primitives'][0]
a = g['accessors'][p['attributes']['TEXCOORD_0']]
v = g['bufferViews'][a['bufferView']]
assert a['componentType'] == 5126 and a['type'] == 'VEC2'
material = g['materials'][p['material']]
texture = g['textures'][material['pbrMetallicRoughness']['baseColorTexture']['index']]
image = g['images'][texture['source']]
iv = g['bufferViews'][image['bufferView']]
o = iv.get('byteOffset', 0)
im = Image.open(io.BytesIO(data[o:o+iv['byteLength']])).convert('RGB')
w, h = im.size
colors = []
for j in range(a['count']):
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0) + j*v.get('byteStride', 8)
    u, vv = struct.unpack_from('<ff', data, start)
    colors.append(im.getpixel((min(w-1,max(0,int(u*w))),min(h-1,max(0,int(vv*h))))))
(root / 'vertex-colors.json').write_text(json.dumps(colors))
print(f'Sampled {len(colors)} vertex colors from {w}x{h} texture')

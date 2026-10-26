"""Where an outfit's details are on its shape target (issue #684): the Tripo figure placed and unposed as
outfit.py loads it (shape_target.py), painted with its cleaned colour map (each texel the nearest of the outfit's
SHAPE['colours'], in those flat colours), rendered orthographic front, side and back with a line every 5 cm, so a
detail's x and z can be read off and written into the outfit's module.

  Blender --background --factory-startup --python scripts/blender/traveller/shape_views.py -- \
      --outfit void-navigator --out <folder>

Writes <outfit>-torso-<view>.png (1.20 m centre, 0.7 m tall) and <outfit>-legs-<view>.png (0.55 m, 1.1 m), 1000 px
square. In the front view +x (his left) is to the right; in the back view to the left. The grid's lines fall on
whole multiples of 5 cm: x = 0 is the middle line, and the lines through z are the multiples of 0.05 m."""
import importlib
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
import poses as PZ
import shape_target as ST
import views as V

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
arg = lambda n, d=None: argv[argv.index(n) + 1] if n in argv else d
OID = arg('--outfit', 'void-navigator')
OUT = os.path.abspath(arg('--out', '.'))
FRAMES = [('torso', 1.20, 0.70), ('legs', 0.55, 1.10)]
RES = 1000


def grid(path, cz, height):
    """Lines every 5 cm over the picture (red, half strength)."""
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    per = w / height                     # (pixels a metre: the picture is square, `height` across)
    for k in range(-20, 21):
        x = int(round(w / 2 + k * 0.05 * per))
        if 0 <= x < w:
            px[:, x, :3] = px[:, x, :3] * 0.5 + np.array([0.9, 0.1, 0.1]) * 0.5
    z0 = cz - height / 2
    for k in range(int(z0 / 0.05) - 1, int((z0 + height) / 0.05) + 2):
        y = int(round((k * 0.05 - z0) * per))       # (pixels count up from the bottom)
        if 0 <= y < h:
            px[y, :, :3] = px[y, :, :3] * 0.5 + np.array([0.9, 0.1, 0.1]) * 0.5
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def main():
    S = importlib.import_module('outfit_' + OID.replace('-', '_'))
    protos = S.SHAPE['colours']
    bpy.ops.wm.open_mainfile(filepath=os.path.join(REPO, 'data', 'characters', 'traveller-v2', 'traveller.blend'))
    arm = bpy.data.objects['TravellerRig']
    bones = {b.name for b in arm.data.bones if b.use_deform}
    J = {b.name: arm.matrix_world @ b.head_local for b in arm.data.bones}
    PZ.reset(arm)
    tgt, rep = ST.load(os.path.join(REPO, S.SHAPE['target']), J, arm,
                       [bpy.data.objects['Body'], bpy.data.objects['Skin']], bones)
    print('shape target', rep)
    names, lab = tgt.class_map(protos)
    P = np.array([protos[n] for n in names], dtype=float) / 255
    h, w = lab.shape
    out = np.ones((h, w, 4), dtype=np.float32)
    out[..., :3] = P[lab]
    img = bpy.data.images.new('classes', w, h)
    img.pixels.foreach_set(out.ravel())
    img.update()
    for m in tgt.ob.data.materials:
        for nd in m.node_tree.nodes:
            if nd.type == 'TEX_IMAGE':
                nd.image = img
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.hide_render = o is not tgt.ob
    os.makedirs(OUT, exist_ok=True)
    for name, cz, height in FRAMES:
        sc = V.setup(size=(RES, RES))
        sh = sc.display.shading
        sh.color_type = 'TEXTURE'
        sh.light = 'FLAT'
        sh.show_object_outline = False
        for view, (az, el) in [('front', (0, 0)), ('side', (90, 0)), ('back', (180, 0))]:
            path = os.path.join(OUT, f'{OID}-{name}-{view}.png')
            V.shoot(path, (0, 0, cz), height, az, el)
            grid(path, cz, height)
    print('SHAPE VIEWS', OUT)


main()

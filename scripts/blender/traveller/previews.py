"""Turnaround previews of the Blender traveller (issue #493), from its .blend:

  Blender --background --factory-startup --python scripts/blender/traveller/previews.py -- \
      --blend data/characters/traveller-v2/traveller.blend --out <dir> [--only dressed,parts,compare,wire,faces]

dressed: front, three-quarter, side, back (Workbench, flat palette colours, an outline).
parts:   the outfit off (the base body), and every part pulled apart (exploded).
compare: the current game traveller (B3 body + head-v3, their own textures) beside the new one, four views.
wire:    the topology (front and side, body and head).
faces:   the head's face keys, each at full weight.
"""
import bpy, math, os, sys
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
import views as V

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


BLEND = arg('--blend', os.path.join(REPO, 'data', 'characters', 'traveller-v2', 'traveller.blend'))
OUT = arg('--out')
ONLY = set((arg('--only') or 'dressed,parts,wire,faces,posed,seams,compare').split(','))
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene
parts = [o for o in bpy.data.collections['Parts'].objects if o.type == 'MESH']
by = {o.name: o for o in parts}
GARMENTS = [o for o in parts if o.get('kind') == 'garment']
rig = bpy.data.objects['TravellerRig']
rig.hide_render = True
for o in bpy.data.objects:
    if o.type == 'EMPTY':
        o.hide_render = True


def cull_body(on=True):
    """The body as the dressed game would draw it: its triangles in the outfit's hidden areas left out."""
    b = by.get('Body')
    if not b or 'outfit_hides' not in b:
        return
    import bmesh
    if on:
        if 'full' not in bpy.data.meshes:
            full = b.data.copy()
            full.name = 'full'
        hidden = {b.vertex_groups['area_' + a].index for a in b['outfit_hides']}
        bm = bmesh.new()
        bm.from_mesh(bpy.data.meshes['full'])
        dl = bm.verts.layers.deform.active
        gone = [f for f in bm.faces if all(any(g in hidden and w > 0.5 for g, w in v[dl].items()) for v in f.verts)]
        bmesh.ops.delete(bm, geom=gone, context='FACES')
        bm.to_mesh(b.data)
        bm.free()
    elif 'full' in bpy.data.meshes:
        b.data = bpy.data.meshes['full'].copy()


def show(objs):
    for o in parts:
        o.hide_render = o not in objs


def turnaround(prefix, centre=(0, 0, 0.9), height=1.95, size=(800, 1400), views=V.VIEWS):
    V.setup(size=size)
    for name, (az, el) in views.items():
        V.shoot(os.path.join(OUT, f'{prefix}-{name}.png'), centre, height, az, el)


cull_body(True)
if 'dressed' in ONLY:
    show(parts)
    turnaround('dressed')
    V.setup(size=(1000, 1000))
    for name, az in (('front', 0), ('three-quarter', 35), ('side', 90)):
        V.shoot(os.path.join(OUT, f'head-{name}.png'), (0, 0, 1.64), 0.42, az, 0)

if 'parts' in ONLY:
    cull_body(False)
    show([o for o in parts if o.get('kind') != 'garment'])
    turnaround('body', views={'front': (0, 0), 'side': (90, 0), 'back': (180, 0)})
    # exploded: each part pulled out along its own direction
    show(parts)
    moves = {'Head': (0, 0, 0.22), 'Hair': (0, 0, 0.42), 'Brows': (0, -0.16, 0.30), 'Eye_L': (0.06, -0.20, 0.26),
             'Eye_R': (-0.06, -0.20, 0.26), 'Scarf': (0, -0.05, 0.12), 'Shirt': (0.75, 0, 0), 'Tee': (-0.75, 0, 0),
             'Trousers': (1.35, 0, 0.0), 'Boots': (-1.35, 0, 0), 'Skin': (0, -0.45, 0)}
    saved = {}
    for name, d in moves.items():
        o = by.get(name)
        if o:
            saved[o] = o.matrix_world.copy()
            o.matrix_world = Matrix.Translation(Vector(d)) @ o.matrix_world
    V.setup(size=(2400, 1300))
    V.shoot(os.path.join(OUT, 'exploded-front.png'), (0, 0, 1.0), 2.25, 0, 0)
    V.shoot(os.path.join(OUT, 'exploded-three-quarter.png'), (0, 0, 1.0), 2.25, 25, 8)
    for o, m in saved.items():
        o.matrix_world = m
    cull_body(True)

if 'pieces' in ONLY:
    # each garment alone (as an outfit swap would show it), from the front, the back and from below
    for o in GARMENTS:
        show([o])
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        lo, hi = [min(p[k] for p in bb) for k in range(3)], [max(p[k] for p in bb) for k in range(3)]
        centre = tuple((a + b) / 2 for a, b in zip(lo, hi))
        h = max(hi[2] - lo[2], (hi[0] - lo[0]) * 0.75) * 1.15
        V.setup(size=(700, 700))
        for name, az, el in (('front', 20, 0), ('back', 200, 0), ('below', 30, -35)):
            V.shoot(os.path.join(OUT, f'piece-{o.name.lower()}-{name}.png'), centre, h, az, el)

if 'wire' in ONLY:
    cull_body(False)
    show(parts)
    for o in parts:
        w = o.modifiers.new('Wire', 'WIREFRAME')
        w.thickness = 0.0008 if o.name in ('Head', 'Eye_L', 'Eye_R', 'Brows') else 0.0014
        w.use_replace = False
        w.material_offset = 50
    show([by[n] for n in ('Body', 'Head', 'Eye_L', 'Eye_R') if n in by])
    V.setup(size=(1200, 1400))
    V.shoot(os.path.join(OUT, 'wire-body-front.png'), (0, 0, 0.9), 1.95, 0, 0)
    V.setup(size=(1400, 1000))
    V.shoot(os.path.join(OUT, 'wire-hand.png'), (0.70, 0, 1.36), 0.28, 0, 0)
    V.setup(size=(1000, 1000))
    V.shoot(os.path.join(OUT, 'wire-head-front.png'), (0, 0, 1.63), 0.34, 0, 0)
    V.shoot(os.path.join(OUT, 'wire-head-side.png'), (0, 0, 1.63), 0.34, 90, 0)
    show(GARMENTS)
    V.setup(size=(1000, 1400))
    V.shoot(os.path.join(OUT, 'wire-outfit-three-quarter.png'), (0, 0, 0.9), 1.95, 35, 5)
    for o in parts:
        o.modifiers.remove(o.modifiers['Wire'])
    cull_body(True)

if 'faces' in ONLY:
    show([by[n] for n in ('Head', 'Eye_L', 'Eye_R', 'Brows', 'Hair') if n in by])
    V.setup(size=(600, 640))
    keys = [k.name for k in by['Head'].data.shape_keys.key_blocks[1:]]
    for k in ['neutral'] + keys:
        for o in [by[n] for n in ('Head', 'Brows') if n in by]:
            if o.data.shape_keys:
                for kb in o.data.shape_keys.key_blocks[1:]:
                    kb.value = 1.0 if kb.name == k else 0.0
        V.shoot(os.path.join(OUT, f'face-{k}.png'), (0, 0, 1.635), 0.3, 12, 0)
    for o in [by[n] for n in ('Head', 'Brows') if n in by]:
        for kb in o.data.shape_keys.key_blocks[1:]:
            kb.value = 0.0

if 'posed' in ONLY:
    # the skins at work: arms down and bent, a stride, the head turned, a smile (pose bones, not clips)
    show(parts)
    pb = rig.pose.bones
    import poses as PZ   # (poses.LOWERED: the one lowered pose, #548)
    turns = {**PZ.LOWERED, 'eye_l': ((0, 0, 1), 15), 'eye_r': ((0, 0, 1), 15)}
    for name, t in turns.items():
        if name not in pb:
            continue
        b = pb[name]
        b.rotation_mode = 'QUATERNION'
        b.rotation_quaternion = PZ.turn(rig, name, t)   # (about the armature's own axes, whatever the bone's roll)
    for o in [by[n] for n in ('Head', 'Brows') if n in by]:
        o.data.shape_keys.key_blocks['smile'].value = 0.8
    bpy.context.view_layer.update()
    V.setup(size=(900, 1400))
    for name, az in (('front', 0), ('three-quarter', 35), ('side', 90)):
        V.shoot(os.path.join(OUT, f'posed-{name}.png'), (0, 0, 0.9), 1.95, az, 0)
    # pass 3: the shoulder close up, arms lowered (where the tee came through the shirt)
    V.setup(size=(700, 700))
    for name, az, x in (('front', 20, 0.17), ('side', 80, 0.17), ('back', 200, 0.17)):
        V.shoot(os.path.join(OUT, f'shoulder-{name}.png'), (x, 0, 1.33), 0.42, az, 5)
    for b in pb:
        b.rotation_quaternion = (1, 0, 0, 0)
    for o in [by[n] for n in ('Head', 'Brows') if n in by]:
        o.data.shape_keys.key_blocks['smile'].value = 0.0

if 'clips' in ONLY:
    # pass 3: frames of the game's own clips (idle, the jog's two passing poses, a sprint), whole and the
    # shoulder close up
    import poses as PZ
    show(parts)
    for clip in PZ.CLIPS:
        PZ.clip(rig, clip)
        V.setup(size=(700, 1100))
        V.shoot(os.path.join(OUT, f'clip-{clip}.png'), (0, 0, 0.9), 1.95, 30, 0)
        V.setup(size=(700, 700))
        V.shoot(os.path.join(OUT, f'clip-{clip}-shoulder.png'), (0.17, 0, 1.33), 0.42, 30, 5)
    PZ.reset(rig)

if 'seams' in ONLY:
    # the cuts close up: where B3's surface was cut into its garments
    show(parts)
    V.setup(size=(700, 700))
    for name, centre, h, az, el in (('sleeve', (0.47, 0, 1.36), 0.26, 0, 0), ('front', (0, 0, 1.12), 0.42, 15, 0),
                                    ('hem-boot', (0.13, 0, 0.2), 0.34, 30, 5), ('scarf', (0, 0, 1.46), 0.28, 25, 5),
                                    ('back-hem', (0, 0, 0.86), 0.42, 180, -10)):
        V.shoot(os.path.join(OUT, f'seam-{name}.png'), centre, h, az, el)

if 'compare' in ONLY:
    # the game's traveller today: the B3 body (its head cut, as the game cuts it) and head-v3 placed as
    # traveller-b3.js places it, both with their own textures; drawn 0.9 m to his right
    import head as H
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(REPO, 'public', 'characters', 'traveller-b3', 'model.glb'))
    bpy.ops.import_scene.gltf(filepath=os.path.join(REPO, 'public', 'characters', 'traveller-v1', 'head-v3', 'model.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = sorted([o for o in new if o.type == 'MESH' and len(o.data.vertices) > 1000], key=lambda o: -len(o.data.vertices))
    for o in new:
        if o.type == 'MESH' and o not in meshes:
            o.hide_render = True
        if o.type in ('ARMATURE', 'EMPTY'):
            o.hide_render = True
    body_b3 = next(o for o in meshes if len(o.data.vertices) == 29288)
    head_v3 = next(o for o in meshes if o is not body_b3)
    import bmesh
    for o in (body_b3, head_v3):
        o.modifiers.clear()
        o.parent = None
    # the B3 body: its own head cut away at 1.515 m (traveller-b3.js)
    bm = bmesh.new()
    bm.from_mesh(body_b3.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if any((body_b3.matrix_world @ v.co).z >= 1.515 for v in f.verts)], context='FACES')
    bm.to_mesh(body_b3.data)
    # head-v3 to its B3 fit
    M = head_v3.matrix_world.copy()
    for v in head_v3.data.vertices:
        p = M @ v.co
        v.co = H.portrait_world(p.x, p.z, -p.y)
    head_v3.matrix_world = Matrix.Identity(4)
    base = {o: o.matrix_world.copy() for o in (body_b3, head_v3)}
    show(parts)
    for o in (body_b3, head_v3):
        o.hide_render = False
    V.setup(size=(1500, 1400))
    sc.display.shading.color_type = 'TEXTURE'
    for m in bpy.data.materials:
        m.diffuse_color = m.diffuse_color   # (untextured parts draw their material colour)
    for name, (az, el) in V.VIEWS.items():
        # B3 0.9 m to the new one's right as the camera sees them, the pair's middle in frame
        a = math.radians(az)
        right = Vector((math.cos(a), math.sin(a), 0))
        for o, m in base.items():
            o.matrix_world = Matrix.Translation(right * 0.9) @ m
        V.shoot(os.path.join(OUT, f'compare-{name}.png'), right * 0.45 + Vector((0, 0, 0.9)), 1.95, az, el)

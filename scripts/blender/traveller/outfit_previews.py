"""Previews of an outfit (issue #540) next to the default, from the .blend outfit.py saves (--blend):

  Blender --background --factory-startup --python scripts/blender/traveller/outfit_previews.py -- \
      --blend <work>/outfit.blend --outfit glider-pilot --out <dir> [--only turn,posed,clips,pieces]

turn:   the default and the outfit, front, three-quarter, side and back (Workbench, their atlases, an outline);
posed:  the previews' lowered pose (arms down, a stride, the head turned), front, three-quarter and side;
clips:  frames of the game's idle, jog and sprint (poses.py), three-quarter;
pieces: each piece of the outfit alone.
The body is drawn as a loader draws it: the outfit's hidden areas left out."""
import bpy, bmesh, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import views as V, poses as PZ

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
arg = lambda n, d=None: argv[argv.index(n) + 1] if n in argv else d
OUT = arg('--out')
OID = arg('--outfit', 'glider-pilot')
ONLY = set((arg('--only') or 'turn,posed,clips,pieces').split(','))
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=arg('--blend'))
rig = bpy.data.objects['TravellerRig']
rig.hide_render = True
for o in bpy.data.objects:
    if o.type == 'EMPTY':
        o.hide_render = True
base = [o for o in bpy.data.collections['Parts'].objects if o.type == 'MESH']
outfit = [o for o in bpy.data.collections['Outfit'].objects if o.type == 'MESH']
by = {o.name: o for o in base + outfit}
body = by['Body']
full = body.data.copy()
KEEP = [by[n] for n in ('Body', 'Skin', 'Head', 'Hair')]
DEFAULT = KEEP + [by[n] for n in ('Shirt', 'Tee', 'Trousers', 'Boots', 'Scarf')]
OUTFIT = [o for o in KEEP if o.name != 'Skin'] + outfit   # (its own cut of his skin piece: 'Skin.<id>')


def dress(which):
    hides = body['outfit_hides_' + ('default' if which is DEFAULT else OID)]
    hidden = {body.vertex_groups['area_' + a].index for a in hides}
    bm = bmesh.new()
    bm.from_mesh(full)
    dl = bm.verts.layers.deform.active
    gone = [f for f in bm.faces if all(any(g in hidden and w > 0.5 for g, w in v[dl].items()) for v in f.verts)]
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    bm.to_mesh(body.data)
    bm.free()
    for o in base + outfit:
        o.hide_render = o not in which


def shoot_both(prefix, centre, height, az, el, size):
    V.setup(size=size)
    for tag, which in (('default', DEFAULT), (OID, OUTFIT)):
        dress(which)
        V.shoot(os.path.join(OUT, f'{prefix}-{tag}.png'), centre, height, az, el)


if 'turn' in ONLY:
    for name, (az, el) in V.VIEWS.items():
        shoot_both(f'turn-{name}', (0, 0, 0.9), 1.95, az, el, (800, 1400))
if 'posed' in ONLY:
    PZ.lowered(rig)
    for name, az in (('front', 0), ('three-quarter', 35), ('side', 90)):
        shoot_both(f'posed-{name}', (0, 0, 0.9), 1.95, az, 0, (900, 1400))
    PZ.reset(rig)
if 'clips' in ONLY:
    for clip in PZ.CLIPS:
        PZ.clip(rig, clip)
        shoot_both(f'clip-{clip}', (0, 0, 0.9), 1.95, 30, 0, (700, 1100))
    PZ.reset(rig)
if 'pieces' in ONLY:
    from mathutils import Vector
    for o in outfit:
        for x in base + outfit:
            x.hide_render = x is not o
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        lo, hi = [min(p[k] for p in bb) for k in range(3)], [max(p[k] for p in bb) for k in range(3)]
        centre = tuple((a + b) / 2 for a, b in zip(lo, hi))
        h = max(hi[2] - lo[2], (hi[0] - lo[0]) * 0.75) * 1.15
        V.setup(size=(700, 700))
        for name, az, el in (('front', 20, 0), ('back', 200, 0), ('below', 30, -35)):
            V.shoot(os.path.join(OUT, f'piece-{o.name.lower()}-{name}.png'), centre, h, az, el)
if 'close' in ONLY:
    # close ups: the sleeve and cuff, the collar, the crotch and seat, the puttees' top
    dress(OUTFIT)
    V.setup(size=(700, 700))
    for name, centre, h, az, el in (('sleeve', (0.45, 0, 1.36), 0.36, 0, 0), ('collar', (0, 0, 1.45), 0.34, 25, 5),
                                    ('crotch', (0, 0, 0.88), 0.36, 10, 0), ('seat', (0, 0, 0.92), 0.4, 180, 0),
                                    ('knee', (0.12, 0, 0.42), 0.3, 30, 0)):
        V.shoot(os.path.join(OUT, f'close-{name}.png'), centre, h, az, el)

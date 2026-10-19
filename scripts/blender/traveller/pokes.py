"""How much of what lies under the shirt comes out through it, posed (issue #493, pass 3: the shoulder):

  Blender --background --factory-startup --python scripts/blender/traveller/pokes.py -- \
      --blend data/characters/traveller-v2/traveller.blend [--json out.json]

For the tee and the trousers under the shirt: the verts under it at rest, and in the lowered-arm pose and
frames of the game's idle, jog and sprint (poses.py), how many are out through it by over 1 mm, and the
deepest. Runs on any pass's .blend, so passes compare."""
import bpy, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import poses as PZ

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
arg = lambda n, d=None: argv[argv.index(n) + 1] if n in argv else d
bpy.ops.wm.open_mainfile(filepath=arg('--blend'))
rig = bpy.data.objects['TravellerRig']
shirt = bpy.data.objects['Shirt']
inner = {n: bpy.data.objects[n] for n in ('Tee', 'Trousers')}
PZ.reset(rig)
idx = {n: PZ.under_set(o, shirt) for n, o in inner.items()}
out = {'under': {n: len(i) for n, i in idx.items()}}
for pose in ['rest', 'lowered'] + list(PZ.CLIPS):
    if pose == 'rest':
        PZ.reset(rig)
    elif pose == 'lowered':
        PZ.lowered(rig)
    else:
        PZ.clip(rig, pose)
    out[pose] = {n: (lambda r: {'out': r[0], 'deepest_mm': round(r[1] * 1000, 1)})(PZ.poke(o, shirt, idx[n])) for n, o in inner.items()}
print('POKES', json.dumps(out))
if arg('--json'):
    json.dump(out, open(arg('--json'), 'w'), indent=1)

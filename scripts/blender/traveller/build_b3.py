"""The traveller in Blender, phase 2 (issue #493): the look taken from the approved assets, not modelled.

- The garments are B3's own surface (public/characters/traveller-b3/model.glb: its folds, collar and
  laced boots, its UVs and texture, its skin weights on the game's 53 bones), cut along its colour
  regions (b3cut.py) into the shirt, the tee, the trousers, the boots, the scarf and his visible skin (hands,
  forearms, ankles); each cut edge turned in as a hem. Where B3 has no cloth (under the shirt: the tee's
  back and sides, the trousers' top) the phase-1 pieces back it, inside B3's.
- The head is the game's portrait head (head-v3) with its texture and painted eyes, placed and skinned as
  traveller-b3.js does, the six face keys baked from portrait-head.js's formulas, its hair its own mesh.
- The body under it all is phase 1's (body.py), kept inside B3's garments, in B3's skin colour.

  node scripts/blender/traveller/export-donor.mjs <work>/donor.json
  Blender --background --factory-startup --python scripts/blender/traveller/build_b3.py -- \
      --donor <work>/donor.json --out data/characters/traveller-v2
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
import loft, body as B, head as H, garments as G, rig as R, b3cut, portrait as PH
import build as P1   # phase 1's helpers (materials, collections, subdivision)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


DONOR = arg('--donor')
OUT = os.path.abspath(arg('--out', os.path.join(REPO, 'data', 'characters', 'traveller-v2')))
B3 = os.path.join(REPO, 'public', 'characters', 'traveller-b3')
HEAD_V3 = os.path.join(REPO, 'public', 'characters', 'traveller-v1', 'head-v3', 'model.glb')
HAIR_TRIS = 9000
os.makedirs(OUT, exist_ok=True)
NAMES = {'shirt': 'Shirt', 'tee': 'Tee', 'trousers': 'Trousers', 'boots': 'Boots', 'scarf': 'Scarf', 'skin': 'Skin'}
LAYER = {'Skin': 0, 'Tee': 1, 'Trousers': 1, 'Boots': 1, 'Shirt': 2, 'Scarf': 3}


def flat(name, rgb):
    m = bpy.data.materials.new(name)
    c = [((x / 255 + 0.055) / 1.055) ** 2.4 if x / 255 > 0.04045 else x / 255 / 12.92 for x in rgb] + [1.0]
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = c
    m.diffuse_color = c
    m.use_backface_culling = True
    return m


def inside(ob, shells, gap=0.006, reach=0.05):
    """Verts of ob that stand out of (or within `gap` under) any of the shells are drawn back under them."""
    dg = bpy.context.evaluated_depsgraph_get()
    trees = [BVHTree.FromObject(s, dg) for s in shells]
    moved = 0
    for v in ob.data.vertices:
        p = v.co.copy()
        for t in trees:
            hit = t.find_nearest(p, reach)
            if hit[0] is None:
                continue
            q, n = hit[0], hit[1]
            if (p - q).dot(n) > -gap:
                p = q - n * gap
                moved += 1
        v.co = p
    return moved


def inside_smooth(ob, shells, gap=0.007, reach=0.08, rounds=4):
    """inside(), as a smooth field: each round the push each vert needs is spread over the mesh (so the body
    goes in as a whole, not dented into every fold of the clothes over it), applied, and measured again."""
    dg = bpy.context.evaluated_depsgraph_get()
    trees = [BVHTree.FromObject(s, dg) for s in shells]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    nbr = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
    bm.free()
    vs = ob.data.vertices
    for r in range(rounds):
        need = [Vector() for _ in vs]
        hold = [0.0] * len(vs)
        for v in vs:
            for t in trees:
                hit = t.find_nearest(v.co, reach)
                if hit[0] is None:
                    continue
                q, n = hit[0], hit[1]
                depth = (v.co - q).dot(n) + gap
                if depth > 0:
                    need[v.index] = -n * (depth + 0.002)
                    hold[v.index] = 0.6
        for _ in range(12):
            need = [need[i] * hold[i] + (sum((need[j] for j in nb), Vector()) / max(1, len(nb))) * (1 - hold[i])
                    if nb else need[i] for i, nb in enumerate(nbr)]
        for v in vs:
            v.co += need[v.index]
        print('fit round %d: %d verts out' % (r, sum(1 for h in hold if h)))


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    d = json.load(open(DONOR))
    J = {x['name']: H.b(x['head']) for x in d['bones']}
    root = P1.collection('Traveller')
    parts = P1.collection('Parts', root)
    src_coll = P1.collection('Sources (not exported)')
    arm = R.armature(d, J, None, root)

    # ---- B3, cut along its colours
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(B3, 'model.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    b3 = max((o for o in new if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
    colors = json.load(open(os.path.join(B3, 'colors.json')))
    skin_rgb = [sum(c[k] for c in colors if b3cut.vertex_label(Vector((0.6, 0, 1.3)), c) == "skin") /
                max(1, sum(1 for c in colors if b3cut.vertex_label(Vector((0.6, 0, 1.3)), c) == "skin")) for k in range(3)]
    lab = b3cut.label_faces(b3, colors)
    b3cut.smooth_cut(b3, lab)
    cut = b3cut.split(b3, b3.data.materials[0])
    outfit = {}
    for label, o in cut.items():
        b3cut.bake_world(o)
        for c in list(o.users_collection):
            c.objects.unlink(o)
        if label == 'head':
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        if label == 'scarf':   # B3's neck lining above the scarf goes: head-v3's own neck is there
            bm = bmesh.new()
            bm.from_mesh(o.data)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if (lambda c: c.z > 1.478 and math.hypot(c.x, c.y - 0.02) < 0.065)(f.calc_center_median())], context='FACES')
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
            bm.to_mesh(o.data)
            bm.free()
        parts.objects.link(o)
        o.name = o.data.name = NAMES[label]
        o.data.materials[0].name = 'b3_' + label
        o.data.materials[0]['texture'] = 'traveller-b3'
        o['kind'] = 'skin' if label == 'skin' else 'garment'
        o['layer'] = LAYER[o.name]
        o['source'] = 'traveller-b3'
        outfit[o.name] = o
    keep = {o.name for o in outfit.values()}
    for o in list(bpy.data.objects):
        if o.parent is None and o.type in ('ARMATURE', 'MESH') and o.name not in keep and o.name != arm.name:
            bpy.data.objects.remove(o, do_unlink=True)   # B3's armature, the importer's bone shape

    # ---- the head
    head, src, hair_mask = PH.load(HEAD_V3, parts)
    head['kind'] = 'head'
    PH.skin(head, src)
    scalp = flat('scalp', (41, 47, 42))
    scalp['palette'] = 'hair'
    hair = PH.split_hair(head, hair_mask, parts, HAIR_TRIS, scalp)
    hair['kind'] = 'hair'
    PH.face_keys(head)
    head.data.materials[0]['texture'] = 'head-v3'

    # ---- the body: phase 1's, its neck inside head-v3's, kept under the clothes
    neck = [v.co for v in head.data.vertices if abs(v.co.z - 1.47) < 0.004]
    cy = (max(p.y for p in neck) + min(p.y for p in neck)) / 2
    rx = max(abs(p.x) for p in neck) * 0.9
    rf, rb = (cy - min(p.y for p in neck)) * 0.9, (max(p.y for p in neck) - cy) * 0.9
    cage = B.build(J, [(1.474, rx, rf, rb, cy, 13), (1.488, rx * 0.97, rf * 0.97, rb * 0.97, cy, 13)])
    cage_ob = P1.mesh_object('Body_cage', cage, src_coll, ['skin'])
    body = P1.mesh_object('Body', cage.copy(), parts, [])
    body.data.materials.append(flat('skin', [round(x) for x in skin_rgb]))
    body.data.materials[0]['palette'] = 'skin'
    P1.subdivide(body)
    body['kind'] = 'body'
    R.weight_body(arm, body, cage_ob)   # (bone heat on the clean body, before it is drawn in under the clothes)
    inside_smooth(body, [outfit[n] for n in ('Shirt', 'Tee', 'Trousers', 'Boots', 'Scarf', 'Skin')])

    # ---- backing where B3 has no cloth (under the shirt): phase 1's tee and trousers top, inside B3's
    backing = {}
    for name, fn, keep in (('Tee', G.tee, lambda p: True), ('Trousers', G.trousers, lambda p: p.z > 0.70)):
        bm = fn(cage, J)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f.calc_center_median())], context='FACES')
        o = P1.mesh_object(name + '_backing', bm, parts, [])
        P1.subdivide(o)
        inside(o, [outfit['Shirt'], outfit[name]], gap=0.010, reach=0.08)
        # its colour: the B3 piece's own, flat (it has no place in B3's texture)
        lab_name = name.lower()
        rgb = [sum(c[k] for c in colors if b3cut.vertex_label(Vector((0, 0, 1.2 if name == 'Tee' else 0.6)), c) == lab_name) /
               max(1, sum(1 for c in colors if b3cut.vertex_label(Vector((0, 0, 1.2 if name == 'Tee' else 0.6)), c) == lab_name)) for k in range(3)]
        m = flat(name.lower() + '_backing', [round(x) for x in rgb])
        m['palette'] = 'suit'
        o.data.materials.append(m)
        backing[name] = o

    # ---- skins: B3's pieces keep their own weights; the rest from the body
    for o in outfit.values():
        R.bind(arm, o)
        for g in list(o.vertex_groups):
            if g.name == 'Root':
                o.vertex_groups.remove(g)
    for name, o in backing.items():
        R.transfer_weights(arm, body, o)
        # one object a garment: the backing joins its B3 piece (a shell inside it, its own flat colour)
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        outfit[name].select_set(True)
        bpy.context.view_layer.objects.active = outfit[name]
        bpy.ops.object.join()
    bind_head = R.bind(arm, head)
    R.rigid(arm, hair, 'Head')

    # ---- the cut edges turned in
    for o in outfit.values():
        print('lip', o.name, b3cut.lip(o))

    sockets = R.sockets(arm, root)
    areas = G.body_areas(body, J)
    cover = {name: G.hidden_areas(body, o, areas) for name, o in outfit.items()}
    union = [any(c[1][i] for c in cover.values()) for i in range(len(body.data.vertices))]
    body['outfit_hides'] = G.covered_areas(areas, union)   # (previews.py leaves these out, as a loader would)
    every = [head, hair, body, *outfit.values()]
    for o in every:
        if not o.data.uv_layers:
            G.unwrap(o)
    cage_ob.hide_render = True
    cage_ob.hide_set(True)
    src_coll.hide_render = True
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'traveller.blend'), compress=True)
    P1.OUT = OUT
    P1.export(arm, every, sockets)
    manifest = {
        'source': 'scripts/blender/traveller/build_b3.py (issue #493, phase 2: B3 cut into its garments, head-v3)',
        'skeleton': R.bone_map(arm),
        'parts': {o.name: {
            'kind': o.get('kind'), 'triangles': P1.tri_count(o), 'vertices': len(o.data.vertices),
            'materials': {m.name: (m.get('palette') or m.get('texture')) for m in o.data.materials},
            'shapeKeys': [k.name for k in o.data.shape_keys.key_blocks[1:]] if o.data.shape_keys else [],
            **({'hides': cover[o.name][0]} if o.name in cover else {}),
            **({'layer': o['layer']} if 'layer' in o else {}),
        } for o in every},
        'areas': areas['names'],
        'outfits': {'default': {'parts': list(outfit), 'hides': G.covered_areas(areas, union)}},
        'sockets': sockets,
        'triangles': sum(P1.tri_count(o) for o in every),
    }
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    print('TRAVELLER', json.dumps({k: v['triangles'] for k, v in manifest['parts'].items()}), 'total', manifest['triangles'])


if __name__ == '__main__':
    main()

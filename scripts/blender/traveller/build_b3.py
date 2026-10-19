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
import loft, body as B, head as H, garments as G, rig as R, b3cut, portrait as PH, finish as F
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
# pass 3: the garments over each piece (its edges under them get a lip, not a band) and each hem's band width
# (the skin closes the sleeves' cuffs and the boots' tops: no band needed there)
COVERS = {'Skin': ['Shirt', 'Trousers', 'Boots'], 'Tee': ['Shirt', 'Scarf', 'Trousers'], 'Trousers': ['Shirt', 'Tee'], 'Boots': ['Trousers', 'Skin'],
          'Shirt': ['Scarf', 'Skin'], 'Scarf': ['Head']}
HEM_WIDTH = {'Shirt': 0.03, 'Trousers': 0.03, 'Tee': 0.025, 'Boots': 0.02, 'Scarf': 0.025}
ATLAS = (4096, 2048)       # one texture for every part (B3's and head-v3's 2048 maps repacked, the body, swatches)
ATLAS_TOP = 0.975          # the islands below this; the swatches in the strip above
BODY_RATIO = 0.55         # the base body's share of its subdivided faces kept (pass 3)
HAIR_SCALE = 0.8          # the hair's islands against the face's (dark curls: the face gets the texels)
BODY_SCALE = 0.32          # the body's islands, in 2048-texel units (it is plain skin, mostly hidden)
INSIDE = 0.45              # a garment's inside: its own colour this much as light
SHIN_Z = 0.177              # pass 4: the boots' faces above this are his shin (B3 paints it skin)
COLLAR_KEEP = (1.40, 0.14)   # pass 4: the back of the shirt's collar stand (above, within): B3's cream paint kept
TRIM_MARGIN = 0.03         # pass 4: B3's tee and trousers under the shirt go only this far in from its open front
# the dressed default's draws: parts in one group share the material, the skeleton and their attributes, so
# a loader can join them (BufferGeometryUtils.mergeGeometries / Unity's CombineMeshes) after culling the body
DRAWS = {'body': ['Body', 'Skin'], 'head': ['Head', 'Hair'], 'clothes': ['Shirt', 'Tee', 'Trousers', 'Boots', 'Scarf']}


def atlas(every, outfit, head, hair, body):
    """Pass 3: every part's colour in one texture through new UVs, one material (its double-sided twin on
    the head and hair). The garments' foreign paint is turned to their own colour; the bands inside, the
    backing and the scalp are flat swatches."""
    import numpy as np
    W, H = ATLAS
    swatch_kinds = (F.BAND, F.BACKING, F.SCALP)
    swatch_faces = {o.name: {i for i, k in enumerate(F.get_kind(o.data)) if k in swatch_kinds} for o in every}
    kinds = {o.name: F.get_kind(o.data) for o in every}

    def swatch_of(o, fi):
        return (o.name, {F.BAND: 'inside', F.BACKING: 'backing', F.SCALP: 'scalp'}[kinds[o.name][fi]])

    F.pack_uvs(every, swatch_faces, BODY_SCALE, [['Head', 'Hair'], [o.name for o in every if o.name not in ('Head', 'Hair')]], top=ATLAS_TOP,
                scales={'hair': HAIR_SCALE})
    where = F.put_swatches(every, swatch_faces, swatch_of, ATLAS, ATLAS_TOP)
    # the colour
    img = bpy.data.images.new('traveller-atlas', W, H, alpha=False)
    src_img = {o.name: next((F.tex_of(o, p) for p in o.data.polygons if F.tex_of(o, p)), None) for o in every}
    made = {}

    def colour_mat(o):
        if o.get('kind') == 'body':
            return F.emission_material('bake_' + o.name, F.attr_source('skin_col'))
        im = src_img[o.name]
        if im.name not in made:
            made[im.name] = F.emission_material('bake_' + im.name, F.tex_source(im))
        return made[im.name]

    F.bake(every, img, colour_mat)
    px = F.image_array(img)
    # which part each texel is
    ids_img = bpy.data.images.new('traveller-atlas-ids', W, H, alpha=False, float_buffer=True)
    # (and, in green, B3's paint kept as it is: pass 4, the cream collar at the back of the neck, painted on the
    # shirt's collar stand, went pink as foreign paint; in blue, his skin on another part: the shin over the
    # boots' tops, which the cut gave the boots, went their pale grey)
    for o in every:
        a = o.data.color_attributes.new('bake_id', 'FLOAT_COLOR', 'CORNER')
        vals = []
        for p in o.data.polygons:
            c = p.center
            collar = o.name == 'Shirt' and c.z > COLLAR_KEEP[0] and c.y > -0.025 and math.hypot(c.x, c.y - 0.02) < COLLAR_KEEP[1]
            shin = o.name == 'Boots' and c.z > SHIN_Z
            vals += [every.index(o) + 1, 1.0 if collar or shin else 0.0, 1.0 if shin else 0.0, 1.0] * p.loop_total
        a.data.foreach_set('color', vals)
    F.bake(every, ids_img, lambda o: F.emission_material('id_' + o.name, F.attr_source('bake_id')), margin=8)
    idpx = F.image_array(ids_img)
    ids = np.rint(idpx[..., 0]).astype(int)
    as_painted = idpx[..., 1] > 0.5
    shin = idpx[..., 2] > 0.5
    bpy.data.images.remove(ids_img)
    for o in every:
        o.data.color_attributes.remove(o.data.color_attributes['bake_id'])
    cloth = {every.index(o) + 1: o.name.lower() for o in every if o.get('kind') in ('garment', 'skin')}
    cleaned = F.clean_paint(px, ids, cloth, keep=as_painted)
    print('paint cleaned (% of each part\'s texels):', cleaned)
    # pass 4: one skin tone, the game's (B3's pale forearms and head-v3's orange neck were two)
    skin_was = F.even_skin(px, ids, {every.index(o) + 1: o.get('kind') for o in every if o.get('kind') in ('head', 'skin', 'body')}, also=shin)
    print('skin made even (each part\'s median before):', skin_was)
    base = {o.name: F.garment_base(px, ids, every.index(o) + 1) for o in every}
    swatch = {}
    for (name, what), (x0, y0, s) in where.items():
        if what == 'inside':
            c = base[name] * INSIDE
        elif what == 'backing':
            c = base[name]
        else:   # the scalp: the hair's own dark
            c = np.array([41, 47, 42]) / 255
        px[y0 - 2:y0 + s + 2, x0 - 2:x0 + s + 2, :3] = c
        swatch[f'{name}.{what}'] = [int(round(x * 255)) for x in c]
    img.pixels.foreach_set(px.ravel())
    img.update()
    # into the .blend and the GLB as a JPEG
    path = os.path.join(OUT, '.atlas-tmp.jpg')
    img.filepath_raw = path
    img.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = 90
    img.save(filepath=path, quality=90)
    bpy.data.images.remove(img)
    img = bpy.data.images.load(path)
    img.name = 'traveller-atlas.jpg'
    img.pack()
    img.filepath = '//traveller-atlas.jpg'
    os.remove(path)
    # one material (and its double-sided twin), the 'atlas' UVs the only ones
    def final(name, cull):
        m = bpy.data.materials.new(name)
        nt = m.node_tree
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = img
        nt.links.new(t.outputs[0], nt.nodes['Principled BSDF'].inputs['Base Color'])
        nt.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
        m.use_backface_culling = cull
        m['texture'] = 'atlas'
        return m
    single, double = final('traveller', True), final('traveller_double', False)
    for o in every:
        me = o.data
        for l in [l for l in me.uv_layers if l.name != 'atlas']:
            me.uv_layers.remove(l)
        me.uv_layers['atlas'].name = 'UVMap'
        me.materials.clear()
        me.materials.append(double if o.get('kind') in ('head', 'hair') else single)
    for m in list(bpy.data.materials):
        if m.users == 0:
            bpy.data.materials.remove(m)
    for im in list(bpy.data.images):
        if im.users == 0:
            bpy.data.images.remove(im)
    # the hair carries the head's keys (all zero: sparse, nearly free) so the two join into one draw
    hair.shape_key_add(name='Basis', from_mix=False)
    for kb in head.data.shape_keys.key_blocks[1:]:
        hair.shape_key_add(name=kb.name, from_mix=False).value = 0.0
    return {'size': [W, H], 'swatches': swatch, 'cleaned': cleaned, 'skin': [int(round(x * 255)) for x in F.GAME_SKIN],
            'skinBefore': skin_was}


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
            # pass 4: and B3's own neck round it, painted skin, that the cut gave the scarf (a grey ring under
            # the chin; the game paints it skin: traveller-b3.js, oldNeck): its colour told by the same test
            tex = F.image_array(F.tex_of(o, o.data.polygons[0]))
            uvl = bm.loops.layers.uv.active

            def b3_neck(f):
                c = f.calc_center_median()
                if c.z < 1.45 or math.hypot(c.x, c.y - 0.02) > 0.085:
                    return False
                uv = sum((l[uvl].uv for l in f.loops), Vector((0, 0))) / len(f.loops)
                r, g, b = (max(1e-3, x) for x in F.sample(tex, uv))
                return 0.70 < g / r < 0.85 and g / b > 1.17
            gone = [f for f in bm.faces if b3_neck(f)]
            print('scarf: %d faces of B3\'s neck go' % len(gone))
            bmesh.ops.delete(bm, geom=gone, context='FACES')
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
    # pass 4: in the shirt's open front the tee's hem and the trousers' top stay as cut, edge on edge (B3's one
    # surface there; each relaxed and turned in on its own, they opened a slit with the backing and ink in it)
    print('seam pinned (verts):', F.pin_seams(outfit['Tee'], outfit['Trousers'], where=lambda c: c.y < 0 and abs(c.x) < 0.2))
    # pass 3: the cut's crumbs, pinholes and zigzag edges cleaned; B3's imported normals dropped (the hems
    # below add faces; smooth normals are recomputed, the cut and hem edges kept sharp)
    for o in outfit.values():
        print('tidy', o.name, F.tidy(o, min_faces=30 if o.name == 'Skin' else 150,
                                     keep=(lambda c: c.z > b3cut.COLLAR_Z and c.y > 0) if o.name == 'Tee' else None))
        with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]):
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
        for p in o.data.polygons:
            p.use_smooth = True
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
    F.set_kind(head.data, [F.SCALP if head.data.materials[p.material_index] == scalp else F.SURFACE for p in head.data.polygons])
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
    # pass 3: the base body is plain skin and mostly hidden dressed; collapsed to BODY_RATIO of its faces
    # (the triangles go to the hems and the backing)
    dec = body.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = BODY_RATIO
    with bpy.context.temp_override(object=body, active_object=body):
        bpy.ops.object.modifier_apply(modifier=dec.name)
    body['kind'] = 'body'
    R.weight_body(arm, body, cage_ob)   # (bone heat on the clean body, before it is drawn in under the clothes)
    inside_smooth(body, [outfit[n] for n in ('Shirt', 'Tee', 'Trousers', 'Boots', 'Scarf', 'Skin')])

    # ---- backing where B3 has no cloth (under the shirt): phase 1's tee and trousers top, inside B3's
    backing = {}
    for name, fn, keep in (('Tee', G.tee, lambda p: True), ('Trousers', G.trousers, lambda p: p.z > 0.76)):
        bm = fn(cage, J)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f.calc_center_median())], context='FACES')
        o = P1.mesh_object(name + '_backing', bm, parts, [])
        P1.subdivide(o)
        # (pass 3: drawn in as a smooth field, then relaxed and held inside: a vert-by-vert snap made spikes
        # wherever the shirt folds)
        # (only the shirt: B3's own scraps of the piece are cut away below, and snapping to them tore the hem)
        inside_smooth(o, [outfit['Shirt']], gap=0.010, reach=0.08, rounds=6)
        for _ in range(4):
            F.relax(o, 0.5, 2)
            inside(o, [outfit['Shirt']], gap=0.008, reach=0.08)
        # its colour: the B3 piece's own, flat (it has no place in B3's texture)
        lab_name = name.lower()
        rgb = [sum(c[k] for c in colors if b3cut.vertex_label(Vector((0, 0, 1.2 if name == 'Tee' else 0.6)), c) == lab_name) /
               max(1, sum(1 for c in colors if b3cut.vertex_label(Vector((0, 0, 1.2 if name == 'Tee' else 0.6)), c) == lab_name)) for k in range(3)]
        m = flat(name.lower() + '_backing', [round(x) for x in rgb])
        m['palette'] = 'suit'
        o.data.materials.append(m)
        F.set_kind(o.data, [F.BACKING] * len(o.data.polygons))
        backing[name] = o

    # ---- skins: B3's pieces keep their own weights; the rest from the body
    for o in outfit.values():
        R.bind(arm, o)
        for g in list(o.vertex_groups):
            if g.name == 'Root':
                o.vertex_groups.remove(g)
    for o in outfit.values():
        if 'p3' not in o.data.attributes:
            F.set_kind(o.data, [F.SURFACE] * len(o.data.polygons))
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

    # ---- pass 3: under the shirt the backing is the tee and the trousers' top; B3's torn scraps there go,
    # and B3's edge is eased down onto the backing (no ledge when the shirt is off)
    for name, zmin in (('Tee', 0.90), ('Trousers', 0.78)):
        o = outfit[name]
        # (just under the shirt's hem B3's trousers stay: the hem is open below, they show there; the tee's
        # collar stays: it shows over the shirt's at the back of the neck; pass 4: so do the trousers' front
        # under the shirt's open panels, real cloth (the backing in its place showed past the panels' edges))
        window = (lambda c: c.z < b3cut.HEM(c) + 0.04 or (c.y < -0.03 and abs(c.x) < 0.2)) if name == 'Trousers' else (lambda c: c.z > 1.36)
        print('trim', name, F.trim_under(o, outfit['Shirt'], zmin, keep=window, margin=TRIM_MARGIN,
                                       edge=lambda c: c.y < -0.02 and abs(c.x) < 0.2 and 0.86 < c.z < 1.40), F.tidy(o, min_faces=60, hole=0.0, relax=10),
              F.clamp_backing(o, [outfit['Shirt']]), F.taper(o, shell=outfit['Shirt']), F.drop_hidden_backing(o))

    # ---- pass 3: what lies under the shirt moves with it (no tee through the shoulder)
    print('under shirt: tee', F.under(outfit['Tee'], outfit['Shirt']))
    print('under shirt: trousers', F.under(outfit['Trousers'], outfit['Shirt'], reach=0.04))
    # ---- pass 4: the backing under every garment's cloth, its own and the others' (it came out through the
    # shirt's front panel and back hem, and lay over B3's tee and trousers at the waist in the open front)
    for name in ('Tee', 'Trousers'):
        print('backing settled', name, F.clamp_backing(outfit[name], [outfit[n] for n in ('Shirt', 'Tee', 'Trousers', 'Scarf') if n != name],
                                                         gap=0.005, reach=0.03, rounds=5),
              F.pull_inside(outfit[name], [outfit[n] for n in ('Shirt', 'Tee', 'Trousers', 'Scarf') if n != name], body))

    # (the body drawn in again: the trims, the taper and the backing moved the cloth over it)
    dressed = [outfit[n] for n in ('Shirt', 'Tee', 'Trousers', 'Boots', 'Scarf', 'Skin')]
    inside_smooth(body, dressed, gap=0.008, rounds=4)
    inside(body, dressed, gap=0.004, reach=0.03)   # (what is still out, in a deep fold, vert by vert)

    # ---- the cut edges: open ones hemmed (a lip and a dark band inside), covered ones a lip
    for name, o in outfit.items():
        covers = [head if c == 'Head' else outfit[c] for c in COVERS[name]]
        print('hem', name, F.hem(o, covers, width=HEM_WIDTH.get(name, 0.03), lip_only=name == 'Skin'))

    # pass 4: backing nothing covers (flaps past the shirt's hem) goes
    for name in ('Tee', 'Trousers'):
        print('backing exposed', name, F.drop_exposed_backing(outfit[name], [o for n, o in outfit.items() if n != name] + [head]))

    sockets = R.sockets(arm, root)
    areas = G.body_areas(body, J)
    cover = {name: G.hidden_areas(body, o, areas) for name, o in outfit.items()}
    union = [any(c[1][i] for c in cover.values()) for i in range(len(body.data.vertices))]
    body['outfit_hides'] = G.covered_areas(areas, union)   # (previews.py leaves these out, as a loader would)
    every = [head, hair, body, *outfit.values()]
    # (the skin piece joins the body's draw: the same attributes, its area -1, never left out)
    a = outfit['Skin'].data.attributes.new('_AREA', 'FLOAT', 'POINT')
    a.data.foreach_set('value', [-1.0] * len(outfit['Skin'].data.vertices))
    for o in every:
        if not o.data.uv_layers:
            G.unwrap(o)
    # ---- pass 3: his skin on the body; everything in one atlas
    F.skin_colours(body, [(outfit['Skin'], None),
                          (head, lambda o, pi: o.data.polygons[pi].material_index == 0 and o.data.polygons[pi].center.z < 1.56)])
    atlas_info = atlas(every, outfit, head, hair, body)
    cage_ob.hide_render = True
    cage_ob.hide_set(True)
    src_coll.hide_render = True
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'traveller.blend'), compress=True)
    P1.OUT = OUT
    P1.export(arm, every, sockets)
    manifest = {
        'source': 'scripts/blender/traveller/build_b3.py (issue #493, pass 3: B3 cut into its garments, hemmed, head-v3, one atlas)',
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
        'atlas': atlas_info,
        'draws': DRAWS,
        'triangles': sum(P1.tri_count(o) for o in every),
    }
    # pass 3: what lies under the shirt, posed (lowered arms; the game's idle, jog and sprint), against it
    import poses as PZ
    shirt = outfit['Shirt']
    idx = {n: PZ.under_set(outfit[n], shirt) for n in ('Tee', 'Trousers')}
    checks = {}
    for pose in ['lowered'] + list(PZ.CLIPS):
        PZ.lowered(arm) if pose == 'lowered' else PZ.clip(arm, pose)
        checks[pose] = {n: dict(zip(('out', 'deepestMm'), (lambda r: (r[0], round(r[1] * 1000, 1)))(PZ.poke(outfit[n], shirt, i))))
                        for n, i in idx.items()}
    PZ.reset(arm)
    manifest['underShirt'] = {'verts': {n: len(i) for n, i in idx.items()}, 'outThroughShirt': checks}
    print('POKES', json.dumps(checks))
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    print('TRAVELLER', json.dumps({k: v['triangles'] for k, v in manifest['parts'].items()}), 'total', manifest['triangles'])


if __name__ == '__main__':
    main()

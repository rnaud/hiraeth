"""An outfit for the Blender traveller (issue #540): new garments on the pass-3 body and skeleton, its own
atlas, its own GLB; the body, his skin piece (hands, forearms, ankles), the head and the hair stay the base's.

  Blender --background --factory-startup --python scripts/blender/traveller/outfit.py -- \
      --outfit glider-pilot [--base data/characters/traveller-v2/traveller.blend] \
      [--out data/characters/traveller-v2/outfits/<id>] [--blend <work>/outfit.blend]

The outfit's module (outfit_<id with _>.py) gives PIECES (each piece's layer, what it is fitted over, the
garments over it, its hem, its subdivision, its gap), BUILDERS (a bmesh from the base body's cage and the
joints), ZONES (each piece's material slots), BOOTS (the default's boots kept, recoloured) and paint() (a
texel's colour from its rest position and normal); optionally (#544) RELIEF (tailor.py ops per piece: its
volume), PROPS (gloves, a can: tailor.py), SHADE (inkpaint.py's options per piece; None: not shaded),
KEEP_AREAS (body areas drawn though covered). Here, the same steps for every outfit:

1. each piece built from the cage, subdivided, then fitted outside what lies under it (the body, his skin
   piece, the pieces listed in `outside`) as a smooth field, `gap` clear, and relaxed; then its RELIEF
   (quilting, raised pockets and straps, wound turns, pile), before the pieces over it are fitted; then
   the PROPS, built on what is made;
2. weighted from what it covers: each vertex the inverse-distance mix of the nearest verts of the body and
   his skin piece (so a sleeve over his forearm bends with that forearm), smoothed, four bones;
3. unwrapped, hemmed (finish.hem: open edges turned in with a dark band inside, edges under another piece a lip);
4. the body areas it hides measured (garments.hidden_areas: 97 % covered);
5. one atlas (2048 square): each piece's islands at one texel density, the bands' swatches in a strip on top;
   its colour painted per texel from the rest-pose position and normal Cycles bakes for it, then shaded by
   the shared painter (inkpaint.py: occlusion, valleys, fold strokes, hatching), the kept boots baked from
   the base atlas and recoloured;
6. the GLB (the rig and the pieces, one material) and manifest.json, with the triangles and what pokes
   through what in the lowered pose and frames of the game's idle, jog and sprint (poses.py)."""
import bpy, bmesh, importlib, json, math, os, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
import garments as G, rig as R, finish as F, poses as PZ, tailor as T, inkpaint as IP, shape_target as ST

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
arg = lambda n, d=None: argv[argv.index(n) + 1] if n in argv else d
OID = arg('--outfit', 'glider-pilot')
BASE = os.path.abspath(arg('--base', os.path.join(REPO, 'data', 'characters', 'traveller-v2', 'traveller.blend')))
OUT = os.path.abspath(arg('--out', os.path.join(REPO, 'data', 'characters', 'traveller-v2', 'outfits', OID)))
BLEND_OUT = arg('--blend')
S = importlib.import_module('outfit_' + OID.replace('-', '_'))
SIZE = getattr(S, 'ATLAS_SIZE', 2048)
if SIZE not in (1024, 2048):
    raise ValueError('Outfit ATLAS_SIZE must be 1024 or 2048')
TOP = 0.97          # the islands below; the swatches in the strip above
INSIDE = 0.45       # a band inside: the piece's own colour this much as light
os.makedirs(OUT, exist_ok=True)


def srgb_to_lin(c):
    c = np.asarray(c, dtype=float)
    return np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)


def flat(name, rgb):
    m = bpy.data.materials.new(name)
    c = list(srgb_to_lin(np.array(rgb) / 255)) + [1.0]
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = c
    m.diffuse_color = c
    m.use_backface_culling = True
    return m


def mesh_object(name, bm, coll, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def subdivide(ob, levels):
    if levels <= 0:        # (a piece of rigid props keeps its bevels)
        return
    mod = ob.modifiers.new('Subdivision', 'SUBSURF')
    mod.levels = mod.render_levels = levels
    mod.boundary_smooth = 'PRESERVE_CORNERS'
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def fit_outside(ob, shells, gap, reach=0.08, rounds=6):
    """Each vert that lies inside (or within `gap` over) one of the shells is pushed out along its normal there,
    the pushes spread over the mesh as a smooth field (a garment goes out as a whole, not dented by every
    bump under it), then Taubin-relaxed; measured again each round. Returns the verts still in."""
    dg = bpy.context.evaluated_depsgraph_get()
    trees = [BVHTree.FromObject(s, dg) for s in shells]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    nbr = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
    bm.free()
    vs = ob.data.vertices

    def measure():
        need = [Vector() for _ in vs]
        hold = [0.0] * len(vs)
        for v in vs:
            for t in trees:
                hit = t.find_nearest(v.co, reach)
                if hit[0] is None:
                    continue
                q, n = hit[0], hit[1]
                off = v.co - q
                d = off.dot(n)
                if (off.length > gap and abs(d) < 0.5 * off.length) or d < -0.025:
                    continue   # (#544) beside a shell's open edge, or across a thin one, not in it: the collar's
                    #            front over the body's open neck had been pushed back through the head's neck
                if d < gap and (gap - d) > need[v.index].length:
                    need[v.index] = n * (gap - d + 0.0015)
                    hold[v.index] = 0.6
        return need, hold

    for r in range(rounds):
        need, hold = measure()
        if not any(hold):
            break
        for _ in range(10):
            need = [need[i] * hold[i] + (sum((need[j] for j in nb), Vector()) / max(1, len(nb))) * (1 - hold[i])
                    if nb else need[i] for i, nb in enumerate(nbr)]
        for v in vs:
            v.co += need[v.index]
        if r < rounds - 2:
            F.relax(ob, 0.4, 1)
    need, hold = measure()
    return sum(1 for h in hold if h)


BONES = None


def in_cut(p, boxes):
    return any(b['absx'][0] <= abs(p.x) <= b['absx'][1] and b['z'][0] <= p.z <= b['z'][1] for b in boxes)


def cut_skin_faces(ob, boxes):
    """Leave out the faces whose verts all lie in one of the boxes (the loader does the same, game.js side)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    gone = [f for f in bm.faces if any(all(in_cut(v.co, [b]) for v in f.verts) for b in boxes)]
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()
    return len(gone)


def weight_from(arm, sources, ob, sample=None, k=8):
    """rig.transfer_weights over several sources (the body and his skin piece), bone groups only."""
    pts, W = [], []
    for s in sources:
        names = {g.index: g.name for g in s.vertex_groups if g.name in BONES}
        for v in s.data.vertices:
            pts.append(v.co.copy())
            W.append({names[g.group]: g.weight for g in v.groups if g.group in names and g.weight > 0})
    kd = KDTree(len(pts))
    for i, p in enumerate(pts):
        kd.insert(p, i)
    kd.balance()
    out = []
    for v in ob.data.vertices:
        q = sample(v.co.copy()) if sample else v.co
        acc, tot = {}, 0.0
        for co, i, dist in kd.find_n(q, k):
            w = 1.0 / max(dist, 1e-4) ** 2
            tot += w
            for name, x in W[i].items():
                acc[name] = acc.get(name, 0) + x * w
        out.append({n: x / tot for n, x in acc.items()})
    out = R.smooth_weights(ob, out, iters=3, k=0.5)
    R.set_weights(ob, out)
    R.bind(arm, ob)


def hidden_areas(body, garment, areas, share=0.97, reach=0.20):
    """garments.hidden_areas with a longer reach: the base body is drawn in under the default's loose clothes,
    so a full garment (the jodhpurs' thighs) stands further off it than 10 cm."""
    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(garment, dg)
    hit = [bvh.ray_cast(v.co - v.normal * 0.002, v.normal, reach)[0] is not None for v in body.data.vertices]
    return G.covered_areas(areas, hit, share), hit


def uv_area_scale(ob, layer):
    """sqrt(3D area / UV area) over the surface faces: the factor that brings its UVs to metres."""
    me = ob.data
    uv = me.uv_layers[layer]
    kinds = F.get_kind(me)
    a3 = a2 = 0.0
    for p in me.polygons:
        if kinds[p.index] != F.SURFACE:
            continue
        a3 += p.area
        li = list(p.loop_indices)
        for k in range(1, len(li) - 1):
            (x0, y0), (x1, y1), (x2, y2) = uv.data[li[0]].uv, uv.data[li[k]].uv, uv.data[li[k + 1]].uv
            a2 += abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) / 2
    return math.sqrt(a3 / a2) if a2 else 1.0


def pack(objs, swatch_faces):
    """'atlas' UVs: every piece's islands at one texel density, packed into the square below TOP."""
    for o in objs:
        me = o.data
        src = me.uv_layers['UVMap']
        at = me.uv_layers.get('atlas') or me.uv_layers.new(name='atlas')
        n = len(me.loops)
        buf = np.empty(n * 2, dtype=np.float32)
        src.data.foreach_get('uv', buf)
        at.data.foreach_set('uv', buf * uv_area_scale(o, 'UVMap'))
        me.uv_layers.active = at
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.context.scene.tool_settings.use_uv_select_sync = False
    for o in objs:
        bm = bmesh.from_edit_mesh(o.data)
        skip = swatch_faces.get(o.name, set())
        for f in bm.faces:
            f.select = f.index not in skip
        bmesh.update_edit_mesh(o.data)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, rotate_method='ANY', scale=True, merge_overlap=False,
                            margin_method='FRACTION', margin=0.003, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in objs:
        at = o.data.uv_layers['atlas']
        n = len(o.data.loops)
        buf = np.empty(n * 2, dtype=np.float32)
        at.data.foreach_get('uv', buf)
        buf = buf.reshape(n, 2)
        buf[:, 1] *= TOP
        at.data.foreach_set('uv', buf.ravel())
    # texels a metre, the same for every piece
    o = objs[0]
    return round(SIZE / uv_area_scale(o, 'atlas'))


def geometry_source(kind):
    def make(nt, sock):
        g = nt.nodes.new('ShaderNodeNewGeometry')
        nt.links.new(g.outputs['Position' if kind == 'P' else 'Normal'], sock)
    return make


def float_bake(objs, mats_for, name):
    img = bpy.data.images.new(name, SIZE, SIZE, alpha=False, float_buffer=True)
    F.bake(objs, img, mats_for, margin=6)
    a = F.image_array(img)[..., :3].copy()
    bpy.data.images.remove(img)
    return a


def main():
    global BONES
    bpy.ops.wm.open_mainfile(filepath=BASE)
    arm = bpy.data.objects['TravellerRig']
    BONES = {b.name for b in arm.data.bones if b.use_deform}
    body, skin = bpy.data.objects['Body'], bpy.data.objects['Skin']
    base_manifest = json.load(open(os.path.join(os.path.dirname(BASE), 'manifest.json')))
    J = {b.name: arm.matrix_world @ b.head_local for b in arm.data.bones}
    cage = bmesh.new()
    cage.from_mesh(bpy.data.objects['Body_cage'].data)
    coll = bpy.data.collections.get('Outfit') or bpy.data.collections.new('Outfit')
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    PZ.reset(arm)

    # his skin piece as this outfit draws it: its triangles under the sleeves and the like left out
    cut_skin = skin.copy()
    cut_skin.data = skin.data.copy()
    cut_skin.name = cut_skin.data.name = 'Skin.' + S.ID
    for c in cut_skin.users_collection:
        c.objects.unlink(cut_skin)
    coll.objects.link(cut_skin)
    print('skin cut:', cut_skin_faces(cut_skin, getattr(S, 'SKIN_CUT', [])), 'faces')

    # (#684) an outfit's shape target: a Tripo figure of it placed on him and unposed, its garments cut out of it
    SHAPE = getattr(S, 'SHAPE', None)
    tgt, shape_report = None, None
    if SHAPE:
        tgt, shape_report = ST.load(os.path.join(REPO, SHAPE['target']), J, arm, [body, skin], BONES)
        print('shape target', json.dumps(shape_report))
        # (#684, second pass: the builders cut their garments out of the shell itself, by its labelled triangles)
        labels = ST.face_labels(tgt, SHAPE['colours'])
        if SHAPE.get('reach_wrists'):
            shape_report['sleeves'] = ST.reach_wrists(tgt, labels, J)
            print('sleeves stretched', shape_report['sleeves'])
        ST.ACTIVE = {'tgt': tgt, 'labels': labels, 'J': J}

    made = {}
    report = {}
    for name in S.BUILDERS:      # (in order: what lies under comes first)
        spec = S.PIECES[name]
        bm = S.BUILDERS[name](cage, J)
        mats = [flat(f'{S.ID}.{name}.{z}', S.PAL[z]) for z in S.ZONES[name]]
        ob = mesh_object(name, bm, coll, mats)
        bm.free()
        retopo = (ST.retopo(ob, spec['retopo'], getattr(S.BUILDERS[name], 'hems', lambda J: [])(J))
                  if spec.get('retopo') else None)   # (#684: a piece cut from the shell)
        subdivide(ob, spec['levels'])
        left = fit_outside(ob, [body, cut_skin] + [made[n] for n in spec['outside']], spec['gap'])
        ob['kind'] = 'garment'
        ob['layer'] = spec['layer']
        ob['outfit'] = S.ID
        made[name] = ob
        report[name] = {'fitLeft': left, **({'fromShell': {'retopo': retopo, 'triangles': tris(ob)}} if retopo else {})}
        # its volume (tailor.py: quilting, raised pockets and straps, wound turns, pile), before what goes over it
        ops = getattr(S, 'RELIEF', {}).get(name)
        if ops:
            report[name]['relief'] = T.run(ops, ob, J)
            print('relief', name, json.dumps(report[name]['relief']))
        print('piece', name, tris(ob), 'tris; verts still within the gap:', left)
    # props (tailor.py: gloves over his hands, a rigid can on its strap): built on what is made, weighted
    # from the hand they cover or all on one bone
    prop_weights = {}
    ctx = {'cage': cage, 'J': J, 'skin': skin, 'body': body, 'made': made, 'arm': arm, 'bones': BONES, 'target': tgt,
           'colours': (SHAPE or {}).get('colours')}
    for name, spec in getattr(S, 'PROPS', {}).items():
        res = spec['build'](ctx)
        bm, w = res if isinstance(res, tuple) else (res, None)
        mats = [flat(f'{S.ID}.{name}.{z}', S.PAL[z]) for z in S.ZONES[name]]
        ob = mesh_object(name, bm, coll, mats)
        bm.free()
        if spec.get('levels'):
            subdivide(ob, spec['levels'])
        ob['kind'] = 'garment'
        ob['layer'] = spec.get('layer', 3)
        ob['outfit'] = S.ID
        made[name] = ob
        prop_weights[name] = w
        report[name] = {'prop': spec.get('bone') or 'weighted'}
        print('prop', name, tris(ob), 'tris')
    # the kept boots, their own weights, hems and UVs (into the base atlas, read for their colour); an outfit
    # without them (BOOTS None: the salt pilgrim's sandals) builds its own footwear as a piece
    boots = None
    if getattr(S, 'BOOTS', None):
        src = bpy.data.objects['Boots']
        boots = src.copy()
        boots.data = src.data.copy()
        if boots.data.shape_keys:   # (#493 pass 5: the default's clothes carry the shirt's thigh-lift keys at zero)
            boots.shape_key_clear()
        boots.name = boots.data.name = S.BOOTS
        for c in boots.users_collection:
            c.objects.unlink(boots)
        coll.objects.link(boots)
        boots['outfit'] = S.ID

    # 2. weights: from the body and his skin piece (a sleeve over his forearm bends with it)
    PROPS = getattr(S, 'PROPS', {})
    for name, ob in made.items():
        if name in PROPS:
            if PROPS[name].get('bone'):
                R.rigid(arm, ob, PROPS[name]['bone'])
            else:
                R.set_weights(ob, prop_weights[name] or T.nearest_weights([body, skin], ob, BONES))
                R.bind(arm, ob)
            continue
        sample = (lambda p: Vector((p.x, p.y, max(p.z, 1.03))) if abs(p.x) < 0.22 else p) if name == 'Jacket' else None
        weight_from(arm, [body, skin], ob, sample=S.PIECES[name].get('sample', sample))
        if hasattr(S, 'reweight'):     # an outfit's own weights over these (a robe's skirt, a rigid prop)
            S.reweight(name, ob, arm, J)

    # 3. UVs and hems
    for name, ob in made.items():
        G.unwrap(ob)
        F.set_kind(ob.data, [F.SURFACE] * len(ob.data.polygons))
    every = {**made, **({S.BOOTS: boots} if boots else {})}
    for name, ob in made.items():
        spec = S.PIECES.get(name) or PROPS[name]
        if spec.get('hem') is None:
            continue
        covers = [every[c] for c in spec.get('covers', []) if c in every]
        report[name]['hem'] = F.hem(ob, covers, width=spec['hem'])
        for p in ob.data.polygons:
            p.use_smooth = True

    # 4. what each hides
    per = [None] * len(body.data.vertices)
    for g in body.vertex_groups:
        if g.name.startswith('area_'):
            for v in body.data.vertices:
                for x in v.groups:
                    if x.group == g.index and x.weight > 0.5:
                        per[v.index] = g.name[5:]
    areas = {'names': sorted({a for a in per if a}), 'per': per}
    hides, hits = {}, []
    for name, ob in every.items():
        hides[name], hit = hidden_areas(body, ob, areas)
        hits.append(hit)
    union = [any(h[i] for h in hits) for i in range(len(per))]
    # (KEEP_AREAS: areas drawn even when covered: a stand collar leaves the neck, seen from above, into it)
    keep_areas = set(getattr(S, 'KEEP_AREAS', []))
    hides = {n: [a for a in h if a not in keep_areas] for n, h in hides.items()}
    outfit_hides = sorted((set(G.covered_areas(areas, union)) | set(base_manifest['parts']['Skin']['hides'])
                           | set(getattr(S, 'EXTRA_HIDES', []))) - keep_areas)

    # 5. the atlas
    objs = list(every.values())
    kinds = {o.name: F.get_kind(o.data) for o in objs}
    swatch_faces = {o.name: {i for i, k in enumerate(kinds[o.name]) if k == F.BAND} for o in objs}
    texels = pack(objs, swatch_faces)
    where = F.put_swatches(objs, swatch_faces, lambda o, fi: (o.name, 'inside'), (SIZE, SIZE), TOP)
    P = float_bake(objs, lambda o: F.emission_material('P_' + o.name, geometry_source('P')), 'P')
    N = float_bake(objs, lambda o: F.emission_material('N_' + o.name, geometry_source('N')), 'N')
    # each texel's piece and zone: (piece index + 1) * 8 + material index, one material per zone slot
    def id_mat(o):
        return F.emission_material('id_' + o.name, F.flat_source(((objs.index(o) + 1), 0, 0)))
    pid = np.rint(float_bake(objs, id_mat, 'ids')[..., 0]).astype(int)
    # the zone: the material index, through a vertex-colour-free route: a second bake per slot
    saved = {o: [s.material for s in o.material_slots] for o in objs}
    zimg = bpy.data.images.new('zones', SIZE, SIZE, alpha=False, float_buffer=True)
    zmats = []
    for o in objs:
        for zi, s in enumerate(o.material_slots):
            m = F.emission_material(f'zone_{o.name}_{zi}', F.flat_source((float(zi), 0, 0)))
            F.add_target(m, zimg)
            s.material = m
            zmats.append(m)
        o.data.uv_layers.active = o.data.uv_layers['atlas']
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 1
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type='EMIT', use_clear=True, margin=6, margin_type='EXTEND', target='IMAGE_TEXTURES')
    zone = np.rint(F.image_array(zimg)[..., 0]).astype(int)
    bpy.data.images.remove(zimg)
    for o in objs:
        for s, m in zip(o.material_slots, saved[o]):
            s.material = m
    # the shared painter's shadow (inkpaint.py): per vertex ao, concavity, facing down; baked per texel
    SHADE = getattr(S, 'SHADE', {})
    shaded = [o for o in objs if o.name != S.BOOTS and SHADE.get(o.name, {}) is not None]
    occluders = [body, cut_skin] + ([boots] if boots else []) + [bpy.data.objects[n] for n in ('Head',) if n in bpy.data.objects]
    vs = IP.vertex_shade(shaded, occluders)
    for o in objs:
        IP.store(o, vs.get(o.name, np.tile([1.0, 0.0, 0.0], (len(o.data.vertices), 1))))
    SH = float_bake(objs, lambda o: F.emission_material('shade_' + o.name, F.attr_source('shade')), 'shade')
    print('shade', {o.name: [round(float(x), 3) for x in vs[o.name].mean(0)] for o in shaded})
    # the kept boots' own paint, from the base atlas
    if boots:
        base_img = next(i for i in bpy.data.images if i.name.startswith('traveller-atlas'))
        bimg = bpy.data.images.new('boots-src', SIZE, SIZE, alpha=False)
        F.bake([boots], bimg, lambda o: F.emission_material('src_' + o.name, F.tex_source(base_img)), margin=6)
        bpx = F.image_array(bimg)[..., :3].copy()
        bpy.data.images.remove(bimg)

    shading = {}
    px = np.ones((SIZE, SIZE, 4))
    px[..., :3] = np.array([0.5, 0.5, 0.5])
    base_col = {}
    for oi, o in enumerate(objs):
        m = pid == oi + 1
        if not m.any():
            continue
        if boots and o.name == S.BOOTS:
            src = bpx[m]
            Y = src @ np.array([0.299, 0.587, 0.114])
            lit = Y > 0.33
            med = np.median(src[lit], axis=0)
            target = np.array(S.PAL['boot']) / 255
            px[m, :3] = np.clip(src * (target / np.maximum(med, 1e-3)), 0, 1)
            base_col[o.name] = target
        elif SHAPE and o.name in SHAPE.get('paint', {}):
            # (#684, second pass: a piece cut from the shell takes the shell's colour map, in the sheet's flat colours:
            # each texel the palette colour of the class the map has there among the piece's own, a 3 x 3 vote twice
            # over the atlas against specks, then the outfit's flat details over it)
            spec = SHAPE['paint'][o.name]
            names = ST.transfer(tgt, SHAPE['colours'], P[m], N[m], spec['classes'], spec['default'], spec.get('limits'))
            keys = sorted(set(spec['classes'].values()) | {spec['default']})
            lab = np.full((SIZE, SIZE), -1)
            lab[m] = [keys.index(x) for x in names]
            for _ in range(2):
                votes = np.zeros((len(keys), SIZE, SIZE), dtype=np.int16)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        sh_ = np.roll(np.roll(lab, dy, 0), dx, 1)
                        for k in range(len(keys)):
                            votes[k] += (sh_ == k)
                lab = np.where(m, votes.argmax(0), -1)
            col = (np.array([S.PAL[k] for k in keys], dtype=float) / 255)[lab[m]]
            if hasattr(S, 'paint_after'):
                col = S.paint_after(o.name, col, zone[m], P[m], N[m], J)
            px[m, :3] = col
            base_col[o.name] = np.array(S.PAL[spec['default']]) / 255
        else:
            col = S.paint(o.name, zone[m], P[m], N[m], J)
            if o in shaded:
                opts = dict(SHADE.get(o.name, {}))
                folds = opts.pop('folds', None)
                base = col
                col, sh = IP.shade(col, P[m], N[m], SH[m], np.array(S.PAL['ink']) / 255, opts,
                                   folds(P[m], N[m], zone[m], J) if folds else None)
                # what the painter did: the mean shadow, the share of texels in shadow deep enough to hatch,
                # and how much the colour moved (0..1, mean over the texels)
                o_ = dict(IP.DEFAULT, **opts)
                shading[o.name] = {'shadow': round(float(sh.mean()), 3),
                                   'hatched': round(float((sh > o_['hatch_from']).mean()), 3),
                                   'change': round(float(np.abs(col - base).mean()), 4)}
            px[m, :3] = col
            base_col[o.name] = np.array(S.PAL[S.ZONES[o.name][0]]) / 255
    swatch = {}
    # (an outfit's INSIDE_ZONES = {piece: (zone, light)}: that piece's bands in one of its zones' colours instead, where a
    # rolled cuff or a folded collar turns its band out to be seen: the storm courier's cream cuffs, issue #680)
    inside_zones = getattr(S, 'INSIDE_ZONES', {})
    for (name, what), (x0, y0, s) in where.items():
        c = base_col[name] * INSIDE
        if name in inside_zones:
            zname, light = inside_zones[name]
            c = np.array(S.PAL[zname]) / 255 * light
        px[y0 - 2:y0 + s + 2, x0 - 2:x0 + s + 2, :3] = c
        swatch[f'{name}.{what}'] = [int(round(x * 255)) for x in c]
    img = bpy.data.images.new(f'{S.ID}-atlas', SIZE, SIZE, alpha=False)
    img.pixels.foreach_set(px.astype(np.float32).ravel())
    img.update()
    tmp = os.path.join(OUT, '.atlas-tmp.jpg')
    img.filepath_raw = tmp
    img.file_format = 'JPEG'
    img.save(filepath=tmp, quality=90)
    bpy.data.images.remove(img)
    img = bpy.data.images.load(tmp)
    img.name = f'{S.ID}-atlas.jpg'
    img.pack()
    img.filepath = f'//{S.ID}-atlas.jpg'
    os.remove(tmp)
    mat = bpy.data.materials.new('outfit_' + S.ID)
    t = mat.node_tree.nodes.new('ShaderNodeTexImage')
    t.image = img
    mat.node_tree.links.new(t.outputs[0], mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
    mat.use_backface_culling = True
    mat['texture'] = 'atlas'
    for o in objs:
        me = o.data
        for l in [l for l in me.uv_layers if l.name != 'atlas']:
            me.uv_layers.remove(l)
        me.uv_layers['atlas'].name = 'UVMap'
        me.materials.clear()
        me.materials.append(mat)
        for a in [a.name for a in me.attributes if a.name in ('label', 'nx', 'ny', 'nz', 'part', 'shade')]:
            me.attributes.remove(me.attributes[a])

    if tgt is not None:      # (the shape target is never part of the outfit)
        bpy.data.objects.remove(tgt.ob)
        tgt.bm.free()

    # 6. the GLB: the rig and the pieces
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, f'{S.ID}.glb'), export_format='GLB', use_selection=True,
        export_apply=False, export_skins=True, export_morph=False, export_attributes=False, export_extras=True,
        export_yup=True, export_animations=False, export_def_bones=False, export_leaf_bone=False,
        export_materials='EXPORT', export_tangents=False, export_vertex_color='NONE', export_influence_nb=4)

    # what pokes through what, posed: his skin and each inner piece against what is over it
    # (an outfit's piece may list pieces it is checked against but not fitted over: 'checks')
    pairs = [(i, o) for o, spec in S.PIECES.items() for i in ['Skin'] + spec['outside'] + spec.get('checks', [])]
    pairs += [(name, o) for name, spec in PROPS.items() for o in spec.get('under', [])]
    pieces = {**every, 'Skin': cut_skin, 'Body': body}
    PZ.reset(arm)
    idx = {(i, o): PZ.under_set(pieces[i], pieces[o]) for i, o in pairs}
    pokes = {}
    for pose in ['lowered'] + list(PZ.CLIPS):
        PZ.lowered(arm) if pose == 'lowered' else PZ.clip(arm, pose)
        pokes[pose] = {f'{i}>{o}': dict(zip(('out', 'deepestMm'), (lambda r: (r[0], round(r[1] * 1000, 1)))(PZ.poke(pieces[i], pieces[o], ix))))
                       for (i, o), ix in idx.items()}
    PZ.reset(arm)
    print('POKES', json.dumps(pokes))

    manifest = {
        'source': f'scripts/blender/traveller/outfit.py --outfit {S.ID} (issue #540)',
        'id': S.ID, 'name': S.NAME, 'reference': S.SHEET,
        'glb': f'{S.ID}.glb',
        'base': 'data/characters/traveller-v2/traveller.glb',
        'keeps': ['Body', 'Skin', 'Head', 'Hair'],
        'parts': {o.name: {'kind': 'garment', 'triangles': tris(o), 'vertices': len(o.data.vertices), 'hides': hides[o.name],
                           'layer': o.get('layer', 1), 'materials': {mat.name: 'atlas'},
                           **({'prop': PROPS[o.name].get('bone') or 'weighted'} if o.name in PROPS else {})} for o in objs},
        'hides': outfit_hides,
        # his skin piece's triangles left out under this outfit: boxes in the game's frame (x mirrored)
        'skinCut': [{'absx': b['absx'], 'y': b['z']} for b in getattr(S, 'SKIN_CUT', [])],
        'draws': {'clothes': [o.name for o in objs]},
        'atlas': {'size': [SIZE, SIZE], 'texelsPerMetre': texels, 'swatches': swatch, 'palette': S.PAL},
        'triangles': sum(tris(o) for o in objs),
        'fit': report,
        **({'shapeTarget': {'source': SHAPE['target'], **shape_report}} if SHAPE else {}),
        'shading': shading,
        'pokes': {'under': {f'{i}>{o}': len(ix) for (i, o), ix in idx.items()}, 'posed': pokes},
    }
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    print('OUTFIT', S.ID, json.dumps({k: v['triangles'] for k, v in manifest['parts'].items()}), 'total', manifest['triangles'],
          'hides', outfit_hides)
    if BLEND_OUT:
        body['outfit_hides_' + S.ID] = outfit_hides
        body['outfit_hides_default'] = base_manifest['outfits']['default']['hides']
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND_OUT), compress=True)


if __name__ == '__main__':
    main()

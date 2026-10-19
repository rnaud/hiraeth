"""The traveller's head (issue #493): MakeHuman's head (the game's own CC0 body.bin, at his B3 face
targets; export-donor.mjs) for its topology (loops round the eyes and the mouth, the face keys' vertex
order), its skin drawn onto the approved portrait head (head-v3) where the two are both skin, the scalp
kept under the hair, the neck cut where the scarf hides the seam. The portrait's hair becomes its own mesh."""
import math
import bmesh
import bpy
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from loft import smoothstep

# head-v3's placement on the B3 body (traveller-b3.js B3_HEAD_FIT, portrait-head.js makePortraitHead)
FIT = dict(scale=0.280, offset=(-0.001, 1.487, -0.006))
# portrait-head.js PORTRAIT_HEAD: the source's landmarks (x, y in source units)
EYES = [(-0.118, 0.522), (0.125, 0.522)]
CHIN_Y = 0.134
MOUTH_Y = 0.293


def b(p):
    """three.js (x, y, z) to Blender (x, -z, y)."""
    return Vector((p[0], -p[2], p[1]))


def portrait_world(x, y, z):
    s, o = FIT['scale'], FIT['offset']
    collar = 1 - smoothstep(0, 0.12, y)
    return b((x * s + o[0], y * s + o[1] - 0.05 * collar, z * s + o[2]))


def load_portrait(path):
    """head-v3 as a world-placed bmesh with its hair mask (a float layer 'hair')."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    ob = max((o for o in new if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
    me = ob.data
    hair = None
    for a in me.attributes:
        if 'portrait_hair' in a.name.lower():
            hair = [d.value for d in a.data]
    bm = bmesh.new()
    bm.from_mesh(me)
    lay = bm.verts.layers.float.new('hair')
    M = ob.matrix_world
    for v in bm.verts:
        p = M @ v.co           # the importer's frame: Blender (x, -z, y) of the source
        src = (p.x, p.z, -p.y)  # back to source (x, y, z)
        v.co = portrait_world(*src)
        v[lay] = hair[v.index] if hair else 0.0
    uv = bm.loops.layers.uv.active
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    return bm, lay


def donor_bm(d, part='Body'):
    m = next(x for x in d['meshes'] if x['name'] == part)
    p, idx = m['position'], m['index']
    bm = bmesh.new()
    src = bm.verts.layers.int.new('src')
    vs = []
    for i in range(0, len(p), 3):
        v = bm.verts.new(b(p[i:i + 3]))
        v[src] = i // 3
        vs.append(v)
    for i in range(0, len(idx), 3):
        try:
            bm.faces.new((vs[idx[i]], vs[idx[i + 1]], vs[idx[i + 2]]))
        except ValueError:
            pass
    bm.normal_update()
    bmesh.ops.join_triangles(bm, faces=bm.faces, angle_face_threshold=0.5, angle_shape_threshold=0.9,
                             cmp_seam=False, cmp_sharp=False, cmp_uvs=False, cmp_vcols=False, cmp_materials=False)
    return bm, src


def eye_centres(d):
    m = next(x for x in d['meshes'] if x['name'] == 'Eyes')
    p = m['position']
    pts = [b(p[i:i + 3]) for i in range(0, len(p), 3)]
    out = {}
    for s, side in ((1, 'l'), (-1, 'r')):
        q = [v for v in pts if v.x * s > 0]
        c = sum(q, Vector()) / len(q)
        out[side] = (c, c.y - min(v.y for v in q))   # its centre, and how far its front is ahead of it
    return out


def landmarks_donor(bm, eyes):
    mid = [v.co for v in bm.verts if abs(v.co.x) < 0.0025 and v.co.z > 1.45]
    tip = min(mid, key=lambda p: p.y)
    eye_z = eyes['l'][0].z
    front = [p for p in mid if p.z < tip.z - 0.03 and p.y < tip.y + 0.045]
    chin = min(front, key=lambda p: p.z)
    return dict(eye_l=eyes['l'][0], eye_r=eyes['r'][0], tip=tip, chin=chin, eye_z=eye_z)


def landmarks_portrait(bvh, pbm, hair):
    eye_l = portrait_world(EYES[1][0], EYES[1][1], 0.0)
    eye_r = portrait_world(EYES[0][0], EYES[0][1], 0.0)
    # the surface in front of each eye, along -Y from behind the face
    def front_hit(p):
        hit = bvh.ray_cast(Vector((p.x, -0.5, p.z)), Vector((0, 1, 0)))
        return hit[0]
    sl, sr = front_hit(eye_l), front_hit(eye_r)
    mid = [v.co for v in pbm.verts if abs(v.co.x + 0.001) < 0.0015 and v[hair] < 0.5 and v.co.z > 1.5]
    tip = min(mid, key=lambda p: p.y)
    chin = front_hit(portrait_world(-0.001, CHIN_Y, 0.0))
    return dict(surf_l=sl, surf_r=sr, tip=tip, chin=chin)


def head_transform(L, P, eye_radius):
    """Per-axis scale and offset taking the donor's face onto the portrait's: the eyes' spacing (x), the
    eyes to the chin (z), the eyes' surface to the nose's tip (y)."""
    de = (L['eye_l'] - L['eye_r']).length
    pe = (P['surf_l'] - P['surf_r']).length
    sx = pe / de
    dz = L['eye_z'] - L['chin'].z
    pz = (P['surf_l'].z + P['surf_r'].z) / 2 - P['chin'].z
    sz = pz / dz
    # depth: the mean of the other two (the portrait's painted eyes lie flush with its face, so its eyes'
    # depth says nothing of the skull's); the skin is drawn onto the portrait's afterwards
    d_surf_y = L['eye_l'].y - eye_radius
    sy = L.get('sy') or (sx + sz) / 2
    S = Vector((sx, sy, sz))
    dc = Vector((0.0, d_surf_y, L['eye_z']))
    pc = Vector(((P['surf_l'].x + P['surf_r'].x) / 2, (P['surf_l'].y + P['surf_r'].y) / 2, (P['surf_l'].z + P['surf_r'].z) / 2))
    return S, dc, pc


def apply_transform(p, S, dc, pc):
    q = p - dc
    return Vector((q.x * S.x, q.y * S.y, q.z * S.z)) + pc


def cut_neck(bm, z_cut):
    """Delete everything under z_cut (the donor's frame) and lay the cut's edge on the plane."""
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if min(v.co.z for v in f.verts) < z_cut - 1e-6], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # only the head's own piece (the decimated torso's scraps go)
    bm.verts.ensure_lookup_table()
    top = max(bm.verts, key=lambda v: v.co.z)
    keep, todo = {top}, [top]
    while todo:
        v = todo.pop()
        for e in v.link_edges:
            o = e.other_vert(v)
            if o not in keep:
                keep.add(o)
                todo.append(o)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v not in keep], context='VERTS')
    # whatever hangs below the plane comes up to it
    for v in bm.verts:
        if v.co.z < z_cut:
            v.co.z = z_cut
    bnd = [e for e in bm.edges if e.is_boundary]
    return bnd


def boundary_loop(bm):
    edges = [e for e in bm.edges if e.is_boundary]
    if not edges:
        return []
    start = edges[0].verts[0]
    loop = [start]
    prev = None
    v = start
    while True:
        nxt = [e.other_vert(v) for e in v.link_edges if e.is_boundary and e.other_vert(v) is not prev]
        if not nxt:
            break
        prev, v = v, nxt[0]
        if v is start:
            break
        loop.append(v)
        if len(loop) > 2000:
            break
    return loop


def portrait_bvh(pbm, want_hair):
    """A BVH of the portrait's skin (want_hair False) or its hair (True)."""
    bm = pbm.copy()
    lay = bm.verts.layers.float.get('hair')
    kill = [f for f in bm.faces if (sum(v[lay] for v in f.verts) / len(f.verts) > 0.5) != want_hair]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    return BVHTree.FromBMesh(bm), bm


def neighbours(bm):
    bm.verts.ensure_lookup_table()
    return [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]


def smooth_field(field, nbr, fixed, iters):
    """Laplacian smoothing of per-vertex vectors; a vert holds its own by its `fixed` weight (0..1)."""
    f = [x.copy() for x in field]
    for _ in range(iters):
        g = []
        for i, n in enumerate(nbr):
            if not n:
                g.append(f[i])
                continue
            avg = sum((f[j] for j in n), Vector()) / len(n)
            k = fixed[i]
            g.append(f[i] * k + avg * (1 - k))
        f = g
    return f


def fit_to_portrait(hb, pbm, centre, depth=0.0):
    """Draw the head toward the portrait in three gentle steps, each a smooth field over the mesh (no vertex
    snapped on its own, so the loops stay even and the Tripo surface's noise stays out): the face's outline
    (its half-width at each height where the portrait shows skin), the face's depth (rays from the front onto
    the portrait's skin, smoothed over the face), and the scalp kept 9 mm under the hair."""
    skin, skin_bm = portrait_bvh(pbm, False)
    hairb, _ = portrait_bvh(pbm, True)
    pskin = [v.co.copy() for v in skin_bm.verts if v.link_faces]
    hb.verts.ensure_lookup_table()
    nbr = neighbours(hb)
    n = len(hb.verts)
    P = [v.co.copy() for v in hb.verts]
    fit_to_portrait.before = P
    # 1. the outline: the face's half-width in front of the ears, per 4 mm band
    z0, z1 = centre.z - 0.14, centre.z - 0.01
    zs, rs = [], []
    for k in range(int((z1 - z0) / 0.004) + 1):
        z = z0 + k * 0.004
        lim = centre.y - 0.035
        m = [abs(p.x) for p in P if abs(p.z - z) < 0.003 and p.y < lim]
        q = [abs(p.x) for p in pskin if abs(p.z - z) < 0.003 and p.y < lim]
        if m and q:
            zs.append(z)
            rs.append(min(1.2, max(0.8, max(q) / max(m))))
    for _ in range(4):
        rs = [rs[0]] + [(rs[i - 1] + rs[i] * 2 + rs[i + 1]) / 4 for i in range(1, len(rs) - 1)] + [rs[-1]]

    def ratio(z):
        if not zs:
            return 1.0
        if z <= zs[0]:
            return rs[0]
        if z >= zs[-1]:
            return 1.0 + (rs[-1] - 1.0) * (1 - smoothstep(zs[-1], zs[-1] + 0.04, z))
        for i in range(len(zs) - 1):
            if zs[i] <= z <= zs[i + 1]:
                t = (z - zs[i]) / (zs[i + 1] - zs[i])
                return rs[i] * (1 - t) + rs[i + 1] * t
        return 1.0
    for v in hb.verts:
        back = smoothstep(centre.y - 0.03, centre.y + 0.05, v.co.y)
        r = ratio(v.co.z)
        v.co.x *= r * (1 - 0.7 * back) + 0.7 * back
    # 2. the depth: rays along +Y onto the portrait's front-facing skin, a smooth field
    disp = [Vector() for _ in range(n)]
    fixed = [0.0] * n
    for v in hb.verts:
        p = v.co
        if p.y > centre.y - 0.03 or p.z > centre.z + 0.07 or p.z < centre.z - 0.16:
            continue
        hit = skin.ray_cast(Vector((p.x, p.y - 0.05, p.z)), Vector((0, 1, 0)), 0.1)
        if hit[0] is None or hit[1].y > -0.25:
            continue
        w = smoothstep(0.0, 0.025, (centre.y - 0.03) - p.y)
        disp[v.index] = Vector((0, hit[0].y - p.y, 0))
        fixed[v.index] = 0.6 * w
    disp = smooth_field(disp, nbr, fixed, 30)
    for v in hb.verts:
        v.co.y += disp[v.index].y * depth
    # 3. the scalp, under the hair
    disp = [Vector() for _ in range(n)]
    hold = [0.0] * n
    for v in hb.verts:
        p = v.co
        # (the scalp only: above the brows, or behind the face; never the face itself, whose lips the
        # portrait's hair mask partly covers)
        if not (p.z > centre.z + 0.025 or (p.y > centre.y - 0.01 and p.z > centre.z - 0.08)):
            continue
        d = p - centre
        if d.length < 1e-4:
            continue
        d = d.normalized()
        hit = hairb.ray_cast(centre, d, 0.4)
        if hit[0] is None:
            continue
        r_h = (hit[0] - centre).length - 0.009
        r_p = (p - centre).length
        if r_p > r_h:
            disp[v.index] = d * (r_h - r_p)
            hold[v.index] = 0.8
    disp = smooth_field(disp, nbr, hold, 8)
    for v in hb.verts:
        v.co += disp[v.index]


def level_neck(hb, z):
    """The neck's cut edge laid on the plane at z, the ring above eased to it."""
    loop = boundary_loop(hb)
    for v in loop:
        v.co.z = z
    return loop


def depth_ratio(hb, pbm, L, P):
    """The portrait's skull, front to back, against MakeHuman's (at the forehead; the portrait's less its hair)."""
    ez = L['eye_z'] + 0.04
    mid = [v.co for v in hb.verts if abs(v.co.x) < 0.008 and abs(v.co.z - ez) < 0.01]
    lay = pbm.verts.layers.float.get('hair')
    pz = (P['surf_l'].z + P['surf_r'].z) / 2 + 0.034
    pm = [v.co for v in pbm.verts if abs(v.co.x + 0.001) < 0.006 and abs(v.co.z - pz) < 0.006]
    mh = max(p.y for p in mid) - min(p.y for p in mid)
    pl = max(p.y for p in pm) - min(p.y for p in pm) - 0.012
    return pl / mh


def follow(points, before, after, k=6):
    """Points carried by the head's fit: each moves as its nearest head verts moved."""
    kd = KDTree(len(before))
    for i, p in enumerate(before):
        kd.insert(p, i)
    kd.balance()
    out = []
    for p in points:
        acc, tot = Vector(), 0.0
        for co, i, dist in kd.find_n(p, k):
            w = 1.0 / max(dist, 1e-4)
            acc += (after[i] - before[i]) * w
            tot += w
        out.append(p + acc / tot)
    return out


# The game's face contract (portrait-head.js names, head-ink.js headInkState): blink, smile, brow, browTilt,
# asymmetry, open; built from MakeHuman's face units. Then MakeHuman's own, for the expressions to come.
GAME_KEYS = [
    ('blink', [('blink', 1.0)]),
    ('smile', [('smile', 1.0)]),
    ('brow', [('browInnerUp', 1.0), ('browOuterUp', 1.0)]),
    ('browTilt', [('browInnerUp', 1.0), ('browOuterUp', -0.4)]),
    ('asymmetry', 'asym'),
    ('open', [('jawOpen', 1.0)]),
]
EXTRA_KEYS = [('frown', 'frown'), ('browDown', 'browDown'), ('squint', 'squint'), ('cheekSquint', 'cheekSquint'),
              ('eyeWide', 'eyeWide'), ('viseme_aa', 'v_aa')]


def key_deltas(d, part, S):
    out = {}
    for name, parts in d['keys'].items():
        m = {}
        for i, dx, dy, dz in parts.get(part, []):
            m[i] = Vector((dx * S.x, -dz * S.y, dy * S.z))
        out[name] = m
    return out


def add_face_keys(ob, d, src_index, part, S):
    D = key_deltas(d, part, S)
    if not any(D.values()):
        return
    ob.shape_key_add(name='Basis', from_mix=False)
    base = [v.co.copy() for v in ob.data.vertices]

    def delta(recipe, i, s, x):
        if recipe == 'asym':
            m = smoothstep(-0.006, 0.006, x) * 2 - 1
            r = D['browInnerUp'].get(s, Vector()) + D['browOuterUp'].get(s, Vector()) + D['smile'].get(s, Vector()) * 0.5
            return r * (0.6 * m)
        acc = Vector()
        for name, k in recipe:
            acc += D.get(name, {}).get(s, Vector()) * k
        return acc
    for name, recipe in GAME_KEYS + [(n, [(m, 1.0)]) for n, m in EXTRA_KEYS]:
        kb = ob.shape_key_add(name=name, from_mix=False)
        kb.value = 0.0     # (a new key comes in at full weight)
        for i, s in enumerate(src_index):
            kb.data[i].co = base[i] + delta(recipe, i, s, base[i].x)


def seam_rings(seam, base_z):
    """The body's neck rings up to the head's seam: its half-width, front and back measured off the seam."""
    xs = [v.co.x for v in seam]
    ys = [v.co.y for v in seam]
    z = sum(v.co.z for v in seam) / len(seam)
    rx = max(abs(x) for x in xs)
    cy = (max(ys) + min(ys)) / 2
    rf, rb = cy - min(ys), max(ys) - cy
    half = len(seam) // 4 + 1   # the body's cage: a half ring of `half` verts, subdivided to the seam's count
    mid = (base_z + z) / 2
    k = 1.03
    return [(mid, rx * 1.06, rf * 1.04, rb * 1.04, cy, half), (z, rx * k, rf * k, rb * k, cy, half)]


def boundary_loop_ob(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    loop = boundary_loop(bm)
    out = [v.index for v in loop]
    bm.free()
    return out


def snap_seam(body, head):
    """The body's neck edge laid onto the head's: vert for vert when the counts agree (they are made to),
    else each onto the head's edge at its own angle."""
    bl, hl = boundary_loop_ob(body), boundary_loop_ob(head)
    bv, hv = body.data.vertices, head.data.vertices
    c = sum((hv[i].co for i in hl), Vector()) / len(hl)
    ang = lambda p: math.atan2(p.x - c.x, -(p.y - c.y))
    bl.sort(key=lambda i: ang(bv[i].co))
    hl.sort(key=lambda i: ang(hv[i].co))
    if len(bl) == len(hl):
        # the rotation that matches them best
        n = len(bl)
        best = min(range(n), key=lambda r: sum((bv[bl[k]].co - hv[hl[(k + r) % n]].co).length for k in range(n)))
        moved = 0.0
        for k in range(n):
            q = hv[hl[(k + best) % n]].co
            moved = max(moved, (bv[bl[k]].co - q).length)
            bv[bl[k]].co = q.copy()
        print('seam: %d verts matched, at most %.1f mm moved' % (n, moved * 1000))
        # the band under the seam relaxed (the head's verts are not evenly spaced round its neck)
        bm = bmesh.new()
        bm.from_mesh(body.data)
        bm.verts.ensure_lookup_table()
        z = hv[hl[0]].co.z
        band = [v for v in bm.verts if z - 0.05 < v.co.z < z - 1e-5 and not v.is_boundary]
        for _ in range(12):
            new = {v: sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges) for v in band}
            for v, p in new.items():
                k = smoothstep(z - 0.05, z - 0.01, v.co.z)
                v.co = v.co.lerp(Vector((p.x, p.y, v.co.z)), 0.5 * k)
        bm.to_mesh(body.data)
        bm.free()
    else:
        hp = [hv[i].co for i in hl]
        ha = [ang(p) for p in hp]
        for i in bl:
            a = ang(bv[i].co)
            j = min(range(len(ha)), key=lambda k: abs(math.remainder(ha[k] - a, 2 * math.pi)))
            bv[i].co = hp[j].copy()
        print('seam: counts differ (body %d, head %d): snapped by angle' % (len(bl), len(hl)))


def make_eyes(eye_c, r, coll, material):
    """Each eye its own sphere (latitudes set at the pupil's and the iris's edges), facing forward (-Y),
    rigid on its own bone (eye_l, eye_r) so the gaze turns it."""
    lats = [0, 13, 22, 34, 48, 64, 82, 100, 120, 140, 160, 180]
    seg = 16
    out = []
    for side in 'lr':
        c = eye_c[side]
        bm = bmesh.new()
        rings = []
        for la in lats[1:-1]:
            a = math.radians(la)
            ring = []
            for k in range(seg):
                t = 2 * math.pi * k / seg
                ring.append(bm.verts.new(c + Vector((math.sin(a) * math.cos(t), -math.cos(a), math.sin(a) * math.sin(t))) * r))
            rings.append(ring)
        front = bm.verts.new(c + Vector((0, -r, 0)))
        back = bm.verts.new(c + Vector((0, r, 0)))
        for k in range(seg):
            k1 = (k + 1) % seg
            f = bm.faces.new((front, rings[0][k], rings[0][k1]))
            f.material_index = 2
        for i in range(len(rings) - 1):
            for k in range(seg):
                k1 = (k + 1) % seg
                f = bm.faces.new((rings[i][k], rings[i + 1][k], rings[i + 1][k1], rings[i][k1]))
                f.material_index = 1 if lats[i + 1] < 34 else 0
        for k in range(seg):
            k1 = (k + 1) % seg
            bm.faces.new((rings[-1][k], back, rings[-1][k1]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(f'Eye_{side.upper()}')
        bm.to_mesh(me)
        for m in ('eye_white', 'iris', 'pupil'):
            me.materials.append(material(m))
        for p in me.polygons:
            p.use_smooth = True
        ob = bpy.data.objects.new(f'Eye_{side.upper()}', me)
        ob['kind'] = 'eye'
        coll.objects.link(ob)
        out.append(ob)
    return out


def make_brows(d, S, dc, pc, after, coll, material):
    """MakeHuman's brows (the man's), carried by the head's fit, with their own share of the brow keys."""
    m = next(x for x in d['meshes'] if x['name'] == 'Eyebrows')
    p, idx = m['position'], m['index']
    pts = [apply_transform(b(p[i:i + 3]), S, dc, pc) for i in range(0, len(p), 3)]
    before = fit_to_portrait.before
    pts = follow(pts, before, after)
    bm = bmesh.new()
    vs = [bm.verts.new(q) for q in pts]
    for i in range(0, len(idx), 3):
        try:
            bm.faces.new((vs[idx[i]], vs[idx[i + 1]], vs[idx[i + 2]]))
        except ValueError:
            pass
    me = bpy.data.meshes.new('Brows')
    bm.to_mesh(me)
    me.materials.append(material('brow'))
    for f in me.polygons:
        f.use_smooth = True
    ob = bpy.data.objects.new('Brows', me)
    ob['kind'] = 'brow'
    coll.objects.link(ob)
    add_face_keys(ob, d, list(range(len(pts))), 'brows1', S)
    return ob


def make_hair(pbm, lay, head_ob, coll, material, tris):
    """The portrait's own hair (its hair mask's faces), apart from the head: decimated, its edge along the
    hairline turned in to the scalp so no gap shows under it."""
    bm = pbm.copy()
    hl = bm.verts.layers.float.get('hair')
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if sum(v[hl] for v in f.verts) / len(f.verts) <= 0.5], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # small islands (stray strands under a few faces) go
    bm.verts.ensure_lookup_table()
    seen = set()
    for v in list(bm.verts):
        if v in seen:
            continue
        comp, todo = {v}, [v]
        while todo:
            x = todo.pop()
            for e in x.link_edges:
                o = e.other_vert(x)
                if o not in comp:
                    comp.add(o)
                    todo.append(o)
        seen |= comp
        if len(comp) < 30:
            bmesh.ops.delete(bm, geom=list(comp), context='VERTS')
    me = bpy.data.meshes.new('Hair')
    bm.to_mesh(me)
    ob = bpy.data.objects.new('Hair', me)
    coll.objects.link(ob)
    n = len(me.polygons)
    dec = ob.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = min(1.0, tris / max(1, n))
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=dec.name)
    print('hair: %d faces cut, %d after decimating' % (n, len(ob.data.polygons)))
    # the portrait's hair is an open surface of locks (thousands of open edges): drawn from both sides
    # (a double-sided material) rather than closed, which would double it
    ob.data.materials.append(material('hair'))
    ob.data.materials[0].use_backface_culling = False
    for f in ob.data.polygons:
        f.use_smooth = True
    ob['kind'] = 'hair'
    return ob


def scalp_under_hair(head_ob, hair_ob, material):
    """The scalp under the hair takes the hair's colour (a second material), so a gap between locks shows
    dark, as a drawing would, not skin."""
    head_ob.data.materials.append(material('hair'))
    bvh = BVHTree.FromObject(hair_ob, bpy.context.evaluated_depsgraph_get())
    n = 0
    for f in head_ob.data.polygons:
        c, nr = f.center, f.normal
        hit = bvh.ray_cast(c + nr * 0.001, nr, 0.05)
        if hit[0] is not None and nr.z > -0.3:
            f.material_index = 1
    # no speckle: each face takes its neighbours' majority, a few times
    bm = bmesh.new()
    bm.from_mesh(head_ob.data)
    bm.faces.ensure_lookup_table()
    for _ in range(4):
        new = []
        for f in bm.faces:
            nb = {g for e in f.edges for g in e.link_faces if g is not f}
            k = sum(g.material_index for g in nb)
            new.append(1 if k * 2 > len(nb) else (0 if k * 2 < len(nb) else f.material_index))
        for f, m in zip(bm.faces, new):
            f.material_index = m
    n = sum(f.material_index for f in bm.faces)
    bm.to_mesh(head_ob.data)
    bm.free()
    print('scalp: %d faces under the hair' % n)

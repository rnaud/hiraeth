"""Shared parts for the outfits of issue #545 (the pearl diver, the salt pilgrim, the moss gardener): small
rigid props as geometry (boxes with bevelled edges, tori), bands round a limb or the waist, skirts hung from a
hem (a robe's drape), and weights for props and layers (rigid islands, weights copied from the piece under);
and (#547) a skirt's swing: its panels' weights and a driven rig for Blender's checks and previews.
The volume on the cloth itself (pockets, patches, straps) is tailor.py's RELIEF; the shading inkpaint.py's.

Geometry is added to a piece's bmesh after it is oriented (outfit_<id>._orient): each prop is closed and
gets its own outward normals."""
import math
import bmesh
import numpy as np
from mathutils import Matrix, Vector



# ------------------------------------------------------------------ geometry

def _layers(bm, verts, part=0):
    pl = bm.verts.layers.int.get('part')
    if pl is not None:
        for v in verts:
            v[pl] = part


def box(bm, centre, size, rot=None, bevel=0.003, mat=0, part=0):
    """A closed box (size: full x, y, z), its edges bevelled (two segments: it catches a line of light), turned
    by `rot` (a 3x3 Matrix) about its centre. Returns its faces."""
    before = set(bm.faces)
    M = Matrix.Translation(Vector(centre)) @ ((rot.to_4x4() if rot else Matrix.Identity(4))) @ Matrix.Diagonal((*size, 1.0))
    r = bmesh.ops.create_cube(bm, size=1.0, matrix=M)
    verts = r['verts']
    if bevel > 0:
        edges = list({e for v in verts for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges + verts, offset=bevel, segments=2, affect='EDGES', profile=0.5)
    faces = [f for f in bm.faces if f not in before]
    _layers(bm, {v for f in faces for v in f.verts}, part)
    for f in faces:
        f.material_index = mat
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def torus(bm, centre, axis, R, r, seg=24, sides=6, mat=0, part=0, squash=1.0):
    """A closed torus round `axis` through `centre`: major radius R, tube r (squash < 1 flattens it)."""
    axis = Vector(axis).normalized()
    u = axis.orthogonal().normalized()
    w = axis.cross(u)
    c = Vector(centre)
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        d = u * math.cos(a) + w * math.sin(a)
        ring = []
        for j in range(sides):
            b = 2 * math.pi * j / sides
            p = c + d * (R + r * math.cos(b)) + axis * (r * squash * math.sin(b))
            ring.append(bm.verts.new(p))
        rings.append(ring)
    faces = []
    for i in range(seg):
        A, B = rings[i], rings[(i + 1) % seg]
        for j in range(sides):
            j1 = (j + 1) % sides
            f = bm.faces.new((A[j], B[j], B[j1], A[j1]))
            f.material_index = mat
            faces.append(f)
    _layers(bm, {v for rg in rings for v in rg}, part)
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def ring_of(cage, part, z, tol=0.012, side=None):
    """The cage's verts of `part` at height z (one ring), as (x, y) points sorted by angle round their centre;
    side +1/-1 keeps one leg's ring."""
    lay = cage.verts.layers.int.get('part')
    mine = [v.co for v in cage.verts if v[lay] == part and (side is None or v.co.x * side > 0)]
    z = min((v.z for v in mine), key=lambda h: abs(h - z))       # the nearest ring
    pts = [v.copy() for v in mine if abs(v.z - z) < tol]
    c = sum(pts, Vector()) / len(pts)
    pts.sort(key=lambda p: math.atan2(p.y - c.y, p.x - c.x))
    return pts, c


def radius_at(pts, c, ang):
    """The ring's distance from its centre in direction `ang` (linear between its points)."""
    a = [math.atan2(p.y - c.y, p.x - c.x) for p in pts]
    r = [math.hypot(p.x - c.x, p.y - c.y) for p in pts]
    a2 = a + [x + 2 * math.pi for x in a]
    r2 = r + r
    order = np.argsort(a2)
    return float(np.interp(ang if ang >= a2[order[0]] else ang + 2 * math.pi, np.array(a2)[order], np.array(r2)[order]))


def band(bm, cage, part, z0, z1, off, n=32, mat=0, side=None, thick=0.006, part_id=0, flare=0.0):
    """A closed band (a belt, a strap round a limb) between heights z0 and z1, `off` outside the cage's ring
    there (`flare` more at z0: a belt sitting on the hips), `thick` deep: four rings (inner and outer at each edge) bridged. Returns its faces."""
    pts, c = ring_of(cage, part, (z0 + z1) / 2, side=side)
    rings = []
    for (z, o) in ((z0, off + flare), (z0, off + flare + thick), (z1, off + thick), (z1, off)):
        ring = []
        for i in range(n):
            a = -math.pi + 2 * math.pi * i / n
            rr = radius_at(pts, c, a) + o
            ring.append(bm.verts.new((c.x + rr * math.cos(a), c.y + rr * math.sin(a), z)))
        rings.append(ring)
    faces = []
    for k in range(4):
        A, B = rings[k], rings[(k + 1) % 4]
        for i in range(n):
            i1 = (i + 1) % n
            f = bm.faces.new((A[i], A[i1], B[i1], B[i]))
            f.material_index = mat
            faces.append(f)
    _layers(bm, {v for rg in rings for v in rg}, part_id)
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces, c


def on_ring(pts, c, ang, out, z):
    """A point `out` outside the ring at angle `ang` (radians, x = 0), at height z, and the outward direction."""
    rr = radius_at(pts, c, ang) + out
    d = Vector((math.cos(ang), math.sin(ang), 0))
    return Vector((c.x + rr * d.x, c.y + rr * d.y, z)), d


def face_rot(d):
    """A rotation whose local -y faces along the horizontal direction d (a box's front out from the body)."""
    a = math.atan2(d.y, d.x) + math.pi / 2
    return Matrix.Rotation(a, 3, 'Z')


# ------------------------------------------------------------------ paint

def band_mask(d, w, aa):
    """1 inside |d| < w, soft over aa."""
    return np.clip((w - np.abs(d)) / aa + 0.5, 0, 1)


def grain(rng, n, k=0.05):
    """The sheets' paper and pen grain: a light mottle."""
    return (1 - k * 0.6 + k * rng.random((n, 1)))


# ------------------------------------------------------------------ weights

def weights_of(ob):
    names = {g.index: g.name for g in ob.vertex_groups}
    return [{names[g.group]: g.weight for g in v.groups if g.weight > 0} for v in ob.data.vertices]


def rigid_islands(ob, skip_mats=(0,), min_share=0.25):
    """Each connected island of faces whose material is not in `skip_mats` (a pouch, a buckle, a coil of
    line) moves as one: every vert takes the island's mean weights (what outfit.py gave it from the body
    under it), so a box keeps its shape on a bending body. Returns the new weights (set them with
    rig.set_weights)."""
    W = weights_of(ob)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    seen = set()
    for f in bm.faces:
        if f.index in seen or f.material_index in skip_mats:
            continue
        stack, isl = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            isl.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen and h.material_index not in skip_mats:
                        seen.add(h.index)
                        stack.append(h)
        vs = {v.index for g in isl for v in g.verts}
        acc = {}
        for i in vs:
            for k, x in W[i].items():
                acc[k] = acc.get(k, 0) + x / len(vs)
        # a small share of a far bone (the foot's under a boot strap) bends a rigid prop off its place
        acc = {k: x for k, x in acc.items() if x >= min_share} or acc
        for i in vs:
            W[i] = dict(acc)
    bm.free()
    return W


def copy_weights(ob, src, W=None, only=None, k=6):
    """Weights for `ob`'s verts (those in `only`, a set of indices; all when None) as the inverse-distance
    mix of the nearest verts of `src` (the piece it lies on: a belt bends as the suit under it, not as the
    body a layer further in). W: the weights to start from (weights_of(ob) when None)."""
    from mathutils.kdtree import KDTree
    W = W if W is not None else weights_of(ob)
    SW = weights_of(src)
    kd = KDTree(len(src.data.vertices))
    for v in src.data.vertices:
        kd.insert(v.co, v.index)
    kd.balance()
    for v in ob.data.vertices:
        if only is not None and v.index not in only:
            continue
        acc, tot = {}, 0.0
        for co, i, d in kd.find_n(v.co, k):
            w = 1.0 / max(d, 1e-4) ** 2
            tot += w
            for n, x in SW[i].items():
                acc[n] = acc.get(n, 0) + x * w
        W[v.index] = {n: x / tot for n, x in acc.items()}
    return W


def verts_of_mats(ob, mats):
    return {i for p in ob.data.polygons if p.material_index in mats for i in p.vertices}


def slide_v(bm, depth_z, top_z, half, front=0.01):
    """A neckline's V cut through the cage's coarse faces: its open edge's verts in front slid across to the
    straight V (x = half at top_z, 0 at depth_z), so it reads as a V and not as the cage's steps."""
    edge = {v for e in bm.edges if e.is_boundary for v in e.verts}
    for v in edge:
        if v.co.y < front and depth_z - 0.03 <= v.co.z <= top_z + 0.02:
            t = min(1.0, max(0.0, (v.co.z - depth_z) / (top_z - depth_z)))
            v.co.x = math.copysign(max(half * t, 0.004), v.co.x if abs(v.co.x) > 1e-6 else 1.0)


def skirt(bm, run, centre, hem_z, rings, radius, closed=False, slits=(), slit_top=0.0, part=0):
    """A skirt hung from a run of boundary verts (a robe's open hem, a tunic's): `rings` rings of verts down
    to hem_z, each vert at the run vert's angle round `centre` (x, y) and at radius(theta, r0, z, t)
    (t 0 at the run, 1 at the hem): a flare, a drape's folds. The faces of the columns whose middle angle is
    nearest one of `slits` (radians) are left out below slit_top (side slits a running leg goes through).
    Returns the rings (the run first)."""
    pl = bm.verts.layers.int.get('part')
    nl = [bm.verts.layers.float.get(k) for k in ('nx', 'ny', 'nz')]
    cx, cy = centre
    th = [math.atan2(v.co.y - cy, v.co.x - cx) for v in run]
    r0 = [math.hypot(v.co.x - cx, v.co.y - cy) for v in run]
    z0 = [v.co.z for v in run]
    out = [list(run)]
    n = len(run)
    m = n if closed else n - 1
    mids = [math.atan2(math.sin(th[i]) + math.sin(th[(i + 1) % n]), math.cos(th[i]) + math.cos(th[(i + 1) % n])) for i in range(m)]
    cut = set()
    for s in slits:
        cut.add(min(range(m), key=lambda i: abs(math.atan2(math.sin(mids[i] - s), math.cos(mids[i] - s)))))
    for k in range(1, rings + 1):
        t = k / rings
        ring = []
        for i in range(n):
            z = z0[i] + (hem_z - z0[i]) * t
            r = radius(th[i], r0[i], z, t)
            v = bm.verts.new((cx + r * math.cos(th[i]), cy + r * math.sin(th[i]), z))
            if pl is not None:
                v[pl] = part
            if all(l is not None for l in nl):
                v[nl[0]], v[nl[1]], v[nl[2]] = math.cos(th[i]), math.sin(th[i]), 0.0
            ring.append(v)
        A = out[-1]
        for i in range(m):
            if i in cut and max(A[i].co.z, A[(i + 1) % n].co.z) <= slit_top + 1e-6:
                continue
            i1 = (i + 1) % n
            try:
                bm.faces.new((A[i], A[i1], ring[i1], ring[i]))
            except ValueError:
                pass
        out.append(ring)
    return out


# ------------------------------------------------------------------ a skirt's swing (issue #547)
#
# A long skirt (a robe's, a tunic's) cannot follow the thighs by its weights alone: skinned to them it lifts
# like a board with each knee and spreads behind. Its swing instead: four panels (front and back, left and
# right) of two bones each (hip to knee, knee to hem) hung from the pelvis; each bone's angle forward is its
# hang (plumb: a share of the pelvis' lean) unless its leg pushes it (the front ones never behind the thigh
# and the shin, the back ones never in front of them). In the game (src/characters/outfits.js, SkirtSwing)
# a damped spring carries the hang (it lags, swings, settles); here, for the checks and the previews, the
# same rule without the spring, as drivers on a small armature riding the pelvis. Both weight the skirt by
# the same rule from the rest position (swing_weights), in the game's frame (x left, y up, z forward). The
# spec reaches the manifest as a relief op's report (outfit.py records them: the op `swing`).

SWING_PANELS = ('fl', 'fr', 'bl', 'br')


def swing_bone_names():
    return [f'swing_{p}_{k}' for p in SWING_PANELS for k in ('u', 'l')]


def _sm(a, b, x):
    t = np.clip((np.asarray(x, dtype=float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def swing_weights(P, spec, garment):
    """P (n, 3) rest positions in the game's frame. Returns (mix (n,), W (n, 8)): how much of each vert the
    swing takes (0 over the hips, 1 down the skirt) and its weights on the eight bones (rows sum to 1),
    panel by panel as SWING_PANELS, upper then lower. As skirtSwingWeights in src/characters/outfits.js."""
    g = spec['garments'][garment]
    X, Y, Z = P[:, 0], P[:, 1], P[:, 2]
    mix = _sm(spec['mix'][0], spec['mix'][1], Y)
    lo = _sm(spec['knee'][0], spec['knee'][1], Y)
    st = g.get('slitTop')
    soft = spec['blend'] * (np.ones(len(P)) if st is None else _sm(st, st + spec['soften'], Y))
    # (the panels part where the slits are: the back one's x, the sides' z; a skirt unslit, at the middle)
    side_z = g.get('sideZ') or [spec['centre'], spec['centre']]
    dz = Z - np.where(X > 0, side_z[0], side_z[1])
    dx = X - g.get('backX', 0.0)
    s = np.maximum(soft, 1e-9)
    f = np.where(soft > 1e-6, _sm(-s, s, dz), (dz > 0) * 1.0)
    left = np.where(soft > 1e-6, _sm(-s, s, dx), (dx > 0) * 1.0)
    fl = (X > 0) * 1.0
    shares = [f * fl, f * (1 - fl), (1 - f) * left, (1 - f) * (1 - left)]
    W = np.zeros((len(P), 8))
    for k, sh in enumerate(shares):
        W[:, 2 * k] = sh * (1 - lo)
        W[:, 2 * k + 1] = sh * lo
    return mix, W


def slit_lines(ob, slit_top, hem_z, centre_y=0.02):
    """Where a skirt's slits part its panels (the game's frame): the back slit's x and each side slit's z,
    the middles of its open edges between its hem and slit_top (Blender's rest coordinates in, centre_y
    the skirt's axis)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    edge = [v.co.copy() for v in {v for e in bm.edges if e.is_boundary for v in e.verts}
            if hem_z + 0.03 < v.co.z < slit_top - 0.03]
    bm.free()
    back = [p.x for p in edge if p.y > centre_y + 0.05 and abs(p.x) < 0.15]
    sides = [[-p.y for p in edge if p.x * s > 0.08 and abs(p.y - centre_y) < 0.06] for s in (1, -1)]
    mid = lambda a, d: round((min(a) + max(a)) / 2, 4) if a else d
    return {'backX': mid(back, 0.0), 'sideZ': [mid(sides[0], -centre_y), mid(sides[1], -centre_y)]}


def game_frame(P):
    """Blender's rest coordinates (z up, -y forward) to the game's (y up, z forward)."""
    P = np.asarray(P, dtype=float)
    return np.stack([P[:, 0], P[:, 2], -P[:, 1]], axis=1)


def swing_rig(arm, spec, name='SkirtSwing'):
    """The swing's armature in Blender (made once): eight bones from the hip joints and the knees, riding
    the pelvis, each bone's angle forward a driver of the rig's pelvis, thighs and calves (SWING_TWIST_Y: the
    swing about their local x, forward positive), the upper ones also turned with their thigh's twist and
    sideways swing. Not exported (outfit.py exports the game's rig and the pieces)."""
    import bpy
    rig = bpy.data.objects.get(name)
    if rig:
        return rig
    data = bpy.data.armatures.new(name)
    rig = bpy.data.objects.new(name, data)
    for c in arm.users_collection:
        c.objects.link(rig)
    hy, hz = spec['pivot']                 # the hips' axis (game frame: height, forward)
    ky = spec['kneePivot']
    rig.matrix_world = arm.matrix_world
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    # a root on the pelvis (its pose copied from the game rig's: an armature modifier deforms in its own
    # armature's space, so riding the pelvis is a bone's work, not the object's)
    src = arm.data.bones['pelvis']
    root = data.edit_bones.new('swing_root')
    root.head, root.tail = src.head_local.copy(), src.tail_local.copy()
    root.align_roll(src.matrix_local.to_3x3() @ Vector((0, 0, 1)))
    root.use_deform = False
    for p in SWING_PANELS:
        x = spec['hipX'] if p[1] == 'l' else -spec['hipX']
        up = data.edit_bones.new(f'swing_{p}_u')
        up.head, up.tail = Vector((x, -hz, hy)), Vector((x, -hz, ky))
        up.parent = root
        lo = data.edit_bones.new(f'swing_{p}_l')
        lo.head, lo.tail = Vector((x, -hz, ky)), Vector((x, -hz, ky - 0.12))
        lo.parent = up
        for b in (up, lo):
            b.align_roll(Vector((0, -1, 0)))   # local x = -x: a turn about it swings the bone's foot forward
            b.use_deform = True
    bpy.ops.object.mode_set(mode='OBJECT')
    c = rig.pose.bones['swing_root'].constraints.new('COPY_TRANSFORMS')
    c.target, c.subtarget = arm, 'pelvis'
    H, HL, R = spec['hang'], spec['lowerHang'], spec['lowerReach']
    for p in SWING_PANELS:
        side = p[1]
        front = p[0] == 'f'
        U = f'max({H}*p, t)' if front else f'min({H}*p, t)'
        L = (f'max({HL}*(p-{U}), t+c-{U})' if front else f'min({HL}*(p-{U}), max(t+c-{U}, -{R}))')
        # the upper bones also turn with their thigh sideways and about its length (a stance, the hips
        # turned over planted feet): euler y the thigh's twist, z its sideways swing
        chans = [('u', 0, U, ('p', 't', 'c')), ('l', 0, L, ('p', 't', 'c')), ('u', 1, 'y', ('y',)), ('u', 2, 'z', ('z',))]
        for k, axis, expr, names in chans:
            b = rig.pose.bones[f'swing_{p}_{k}']
            b.rotation_mode = 'XYZ'
            d = b.driver_add('rotation_euler', axis).driver
            d.type = 'SCRIPTED'
            src = {'p': ('pelvis', 'ROT_X'), 't': (f'thigh_{side}', 'ROT_X'), 'c': (f'calf_{side}', 'ROT_X'),
                   'y': (f'thigh_{side}', 'ROT_Y'), 'z': (f'thigh_{side}', 'ROT_Z')}
            for vn in names:
                v = d.variables.new()
                v.name = vn
                v.type = 'TRANSFORMS'
                tg = v.targets[0]
                tg.id = arm
                tg.bone_target, tg.transform_type = src[vn]
                tg.transform_space = 'LOCAL_SPACE'
                tg.rotation_mode = 'SWING_TWIST_Y'
            d.expression = expr
    rig.hide_render = True
    return rig


def swing_bind(ob, rig, spec, garment):
    """The piece's swing in Blender: its mix and bone groups from swing_weights, and a second armature
    modifier on the swing's rig mixed over the first by the mix (multi-modifier: both from the rest)."""
    co = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get('co', co)
    mix, W = swing_weights(game_frame(co.reshape(-1, 3)), spec, garment)
    g = ob.vertex_groups.get('swing_mix') or ob.vertex_groups.new(name='swing_mix')
    for i in np.nonzero(mix > 1e-4)[0]:
        g.add([int(i)], float(mix[i]), 'REPLACE')
    for k, name in enumerate(swing_bone_names()):
        g = ob.vertex_groups.get(name) or ob.vertex_groups.new(name=name)
        for i in np.nonzero((W[:, k] > 1e-4) & (mix > 1e-4))[0]:
            g.add([int(i)], float(W[i, k]), 'REPLACE')
    mod = ob.modifiers.new('Swing', 'ARMATURE')
    mod.object = rig
    mod.use_multi_modifier = True
    mod.vertex_group = 'swing_mix'
    return {'swung': int((mix > 0.5).sum()), 'mixed': int(((mix > 1e-4) & (mix <= 0.5)).sum())}

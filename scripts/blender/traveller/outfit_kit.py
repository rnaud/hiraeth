"""Shared parts for the outfits of issue #545 (the pearl diver, the salt pilgrim, the moss gardener): small
rigid props as geometry (boxes with bevelled edges, tori), bands round a limb or the waist, skirts hung from a
hem (a robe's drape), and weights for props and layers (rigid islands, weights copied from the piece under).
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

"""Volume for the outfits (issue #544): geometry an outfit module asks for on its fitted pieces, and props.
Shared by every outfit (docs/systems/characters.md, "Outfits": "Volume and props"); outfit.py runs it.

Relief ops (an outfit's RELIEF = {piece: [op, ...]}): each op is made here and called by outfit.py on the
piece right after it is fitted (so the pieces over it fit over its relief), as op(ob, J). An op cuts the
piece's mesh where a crisp edge is wanted (bisect planes, only through the faces near the feature) and moves
its verts out along their normals:

  quilt(families, puff)      puffed bands between stitch rows (rows cut, each band raised in its middle)
  raised(shape, height)      a patch, a flap, a strap or a band standing proud (its outline cut twice: a step)
  wound(axis, pitch, depth)  a wound cloth's turns: a spiral of steps (rings cut every `ring` metres)
  fleece(where, amp)         curly pile: a bumpy displacement
  rect(), strap(), ring()    shapes for raised(): a signed distance (n, 3) -> (n,) and the planes to cut

Props (an outfit's PROPS = {name: spec}; outfit.py builds them after the pieces):

  glove(skin, xmin, ...)     a glove over his hands: his skin piece's hand, grown out, a cuff; its weights
                             copied vertex for vertex from the hand (copy_weights), the hand cut away
  lathe(), ribbon()          a turned prop (a can, a lamp) and a strap, as bmesh pieces for a rigid prop
                             (rig.rigid: all its weight on one bone)
"""
import math
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree


def smooth01(a, b, x):
    t = np.clip((np.asarray(x, dtype=float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _coords(me):
    a = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', a)
    return a.reshape(-1, 3)


def _normals(me):
    a = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('normal', a)
    return a.reshape(-1, 3)


def _move(me, d):
    co = _coords(me) + d
    me.vertices.foreach_set('co', co.ravel())
    me.update()


def cut(ob, planes, near=None):
    """Bisect `ob` along each plane (co, no), through the faces that pass near(face) only.
    Verts within 1.5 mm of a plane snap onto it (no slivers). Returns the number of cuts made."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    n = 0
    for co, no in planes:
        bm.normal_update()
        faces = [f for f in bm.faces if near is None or near(f)]
        if not faces:
            continue
        edges = {e for f in faces for e in f.edges}
        verts = {v for f in faces for v in f.verts}
        r = bmesh.ops.bisect_plane(bm, geom=list(faces) + list(edges) + list(verts), dist=0.0015,
                                   plane_co=Vector(co), plane_no=Vector(no).normalized())
        n += len([g for g in r['geom_cut'] if isinstance(g, bmesh.types.BMVert)])
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return n


# ------------------------------------------------------------------ quilting

def quilt(families, puff=0.007, sharp=0.55, fade=None):
    """Puffed quilting. families: [(axis, rows, where)]: `axis` (3,) the direction across the bands (the band
    coordinate is P . axis; with axis[0] < 0 meaning 'mirrored', |x| is used for x, so one family serves both
    sleeves), `rows` the stitch rows' coordinates (sorted), `where(P) -> (n,)` 0..1 how much of the puff a
    vert takes (0 outside the family's region: a seam, the placket, the hem). Each band rises `puff` in its
    middle as sin(pi t) ** sharp: round in the middle, a crisp valley on its stitch row."""
    def op(ob, J):
        me = ob.data
        cuts = 0
        for axis, rows, where in families:
            ax = np.asarray(axis, dtype=float)
            mir = ax[0] < 0
            ax = np.abs(ax) if mir else ax
            ax = ax / np.linalg.norm(ax)
            lo, hi = rows[0] - 0.03, rows[-1] + 0.03
            def near(f, ax=ax, mir=mir, where=where, lo=lo, hi=hi):
                c = f.calc_center_median()
                p = np.array([[abs(c.x) if mir else c.x, c.y, c.z]])
                return where(np.array([[c.x, c.y, c.z]]))[0] > 0 and lo <= float(p[0] @ ax) <= hi
            planes = []
            for s in rows:
                planes.append((Vector(tuple(ax * s)), Vector(tuple(ax))))
                if mir:
                    m = ax * np.array([-1, 1, 1])
                    planes.append((Vector(tuple(m * s)), Vector(tuple(m))))
            cuts += cut(ob, planes, near)
        P = _coords(me)
        N = _normals(me)
        d = np.zeros(len(P))
        for axis, rows, where in families:
            ax = np.asarray(axis, dtype=float)
            mir = ax[0] < 0
            ax = np.abs(ax) if mir else ax
            ax = ax / np.linalg.norm(ax)
            Q = P.copy()
            if mir:
                Q[:, 0] = np.abs(Q[:, 0])
            t = Q @ ax
            r = np.asarray(rows)
            k = np.clip(np.searchsorted(r, t) - 1, 0, len(r) - 2)
            a, b = r[k], r[k + 1]
            inside = (t >= r[0]) & (t <= r[-1])
            f = np.clip((t - a) / (b - a), 0, 1)
            prof = np.sin(np.pi * f) ** sharp
            w = where(P) * inside
            d = np.maximum(d, puff * prof * w)
        if fade is not None:
            d *= fade(P)
        _move(me, N * d[:, None])
        return {'cuts': cuts, 'puffed': int((d > 1e-4).sum())}
    op.__name__ = 'quilt'
    return op


# ------------------------------------------------------------------ raised shapes

def rect(c, u, v, half_u, half_v, step=0.003):
    """A rectangle on the surface: centre c (3,), its axes u, v (unit, in the plane it is seen in), half sizes.
    Returns (sdf, planes): the signed distance (negative inside) in the u, v plane, and the cut planes: the
    outline and the outline `step` in (the step's two edges)."""
    c, u, v = (np.asarray(x, dtype=float) for x in (c, u, v))

    def sdf(P):
        d = P - c
        return np.maximum(np.abs(d @ u) - half_u, np.abs(d @ v) - half_v)
    planes = []
    for ax, h in ((u, half_u), (v, half_v)):
        for s in (1, -1):
            for off in (h, h - step):
                planes.append((Vector(tuple(c + ax * s * off)), Vector(tuple(ax * s))))
    return sdf, planes


def strap(a, b, normal, half_w, step=0.0025, ends=True):
    """A strap from a to b (3,), lying on the surface seen along `normal`: a band of half width half_w."""
    a, b, n = (np.asarray(x, dtype=float) for x in (a, b, normal))
    d = b - a
    L = np.linalg.norm(d)
    t = d / L
    s = np.cross(n, t)
    s /= np.linalg.norm(s)
    mid = (a + b) / 2

    def sdf(P):
        q = P - mid
        across = np.abs(q @ s) - half_w
        along = np.abs(q @ t) - L / 2
        return np.maximum(across, along) if ends else across
    planes = []
    for sg in (1, -1):
        for off in (half_w, half_w - step):
            planes.append((Vector(tuple(mid + s * sg * off)), Vector(tuple(s * sg))))
    if ends:
        for sg in (1, -1):
            for off in (L / 2, L / 2 - step):
                planes.append((Vector(tuple(mid + t * sg * off)), Vector(tuple(t * sg))))
    return sdf, planes


def ring(centre, axis, half_w, step=0.0025):
    """A band round a limb: the slab |(P - centre) . axis| < half_w."""
    c, ax = np.asarray(centre, dtype=float), np.asarray(axis, dtype=float)
    ax = ax / np.linalg.norm(ax)

    def sdf(P):
        return np.abs((P - c) @ ax) - half_w
    planes = []
    for sg in (1, -1):
        for off in (half_w, half_w - step):
            planes.append((Vector(tuple(c + ax * sg * off)), Vector(tuple(ax * sg))))
    return sdf, planes


def raised(shape, height=0.003, step=0.003, facing=None, where=None, reach=0.03):
    """A patch standing `height` proud: verts inside `shape` (rect/strap/ring) move out along their normals,
    over a `step`-wide edge (the outline is cut twice, so the edge is a crisp step, not a slope). `facing`
    (3,): only where the normal faces it (> 0.25: a pocket on the front, not through to the back); `where(P)`
    a further 0..1 mask."""
    sdf, planes = shape
    fv = None if facing is None else np.asarray(facing, dtype=float) / np.linalg.norm(facing)

    def ok(P):
        return np.ones(len(P)) if where is None else where(P)

    def op(ob, J):
        me = ob.data
        # the cuts only through faces near the shape (and, with `facing`, on its side of the piece)
        def near(f):
            c = f.calc_center_median()
            p = np.array([[c.x, c.y, c.z]])
            return sdf(p)[0] <= reach * 0.5 and ok(p)[0] > 0 and (fv is None or f.normal.dot(Vector(tuple(fv))) > 0.05)
        n = cut(ob, planes, near)
        P = _coords(me)
        N = _normals(me)
        s = sdf(P)
        k = np.clip(-s / step, 0, 1) * ok(P)
        if fv is not None:
            k *= smooth01(0.15, 0.35, N @ fv)
        _move(me, N * (height * k)[:, None])
        return {'cuts': n, 'raised': int((k > 0.5).sum())}
    op.__name__ = 'raised'
    return op


# ------------------------------------------------------------------ wound cloth, fleece

def wound(axis_of, z0, z1, pitch=0.04, depth=0.0035, ring_step=0.005, sense=1, starts=1):
    """A wound cloth (puttees, a bandage): rings cut every `ring_step` from z0 to z1, then each turn of the
    spiral raised as a ramp, `depth` proud at its lower edge (where it lies over the turn below) down to
    nothing at its top (where the next turn covers it). axis_of(x, z) -> (cx, cy): the limb's centre line;
    `starts` > 1 winds that many strips at once (their edges slant `starts` times as steeply)."""
    def op(ob, J):
        me = ob.data
        zs = np.arange(z0, z1 + 1e-9, ring_step)
        n = cut(ob, [(Vector((0, 0, z)), Vector((0, 0, 1))) for z in zs], lambda f: z0 - 0.01 <= f.calc_center_median().z <= z1 + 0.01)
        P = _coords(me)
        N = _normals(me)
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        cx, cy = axis_of(x, z)
        ang = np.arctan2(y - cy, (x - cx) * np.sign(x + 1e-9))
        w = (z / pitch + sense * starts * ang / (2 * np.pi)) % 1.0
        ramp = (1 - w) ** 0.8
        # each turn's lower edge sits on the turn below: a full step there; faded at both ends of the wrap
        k = smooth01(z0, z0 + 0.012, z) * smooth01(z1, z1 - 0.012, z)
        _move(me, N * (depth * ramp * k)[:, None])
        return {'cuts': n, 'rings': len(zs)}
    op.__name__ = 'wound'
    return op


def fleece(where=None, amp=0.0025, scale=0.018, seed=7, mat=None, thick=0.0):
    """Curly pile: verts where(P) > 0 (and, with `mat`, on a face of that material slot) move out `thick`
    plus a sum of a few random bumps (cells `scale` wide), `amp` at most; always outward (the pile stands on
    the cloth)."""
    def op(ob, J):
        me = ob.data
        P = _coords(me)
        N = _normals(me)
        m = np.ones(len(P)) if where is None else where(P)
        if mat is not None:
            on = np.zeros(len(P))
            for p in me.polygons:
                if p.material_index == mat:
                    on[list(p.vertices)] = 1
            m = m * on
        rng = np.random.default_rng(seed)
        acc = np.zeros(len(P))
        for _ in range(6):
            k = rng.normal(size=3)
            k = k / np.linalg.norm(k) * (2 * np.pi / scale) * rng.uniform(0.7, 1.4)
            acc += np.sin(P @ k + rng.uniform(0, 2 * np.pi))
        bump = np.clip(acc / 6 * 1.6 + 0.5, 0, 1)
        _move(me, N * ((thick + amp * (0.35 + 0.65 * bump)) * m)[:, None])
        return {'fleece': int((m > 0).sum())}
    op.__name__ = 'fleece'
    return op


def run(ops, ob, J):
    """outfit.py: a piece's relief ops in order; their reports by name."""
    out = {}
    for op in ops:
        r = op(ob, J) or {}
        key = op.__name__
        i = 1
        while key in out:
            i += 1
            key = f'{op.__name__}{i}'
        out[key] = r
    return out


# ------------------------------------------------------------------ props

def glove(skin, xmin=0.60, grow=0.0026, cuff_x=(0.60, 0.672), cuff_grow=0.0055, cuff_flare=0.004):
    """A glove over his hands from his skin piece (rest pose, T: the hands at |x| > xmin): its faces copied,
    grown `grow` out along the normals; from cuff_x[0] to cuff_x[1] a cuff, grown cuff_grow and flaring
    another cuff_flare towards its open end (under the sleeve). Returns (bmesh, src): src[i] is the skin's
    vert each glove vert came from (copy_weights gives each its weights)."""
    me = skin.data
    keep = [p for p in me.polygons if all(abs(me.vertices[i].co.x) > xmin for i in p.vertices)]
    bm = bmesh.new()
    m, src = {}, []
    for p in keep:
        vs = []
        for i in p.vertices:
            if i not in m:
                v = me.vertices[i]
                ax = abs(v.co.x)
                g = grow + (cuff_grow - grow) * float(smooth01(cuff_x[1], cuff_x[1] - 0.012, ax)) \
                    + cuff_flare * float(smooth01(cuff_x[0] + 0.03, cuff_x[0], ax))
                m[i] = bm.verts.new(v.co + v.normal * g)
                src.append(i)
            vs.append(m[i])
        try:
            bm.faces.new(vs)
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    # outward: most faces point away from the hand's centre line
    score = sum(f.normal.dot(f.calc_center_median() - Vector((f.calc_center_median().x, 0.05, 1.37))) for f in bm.faces)
    if score < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return bm, src


def copy_weights(src_ob, src_index, bones):
    """Per vert of a piece made from src_ob's verts src_index (a glove from the hand): their weights."""
    names = {g.index: g.name for g in src_ob.vertex_groups if g.name in bones}
    out = []
    for i in src_index:
        v = src_ob.data.vertices[i]
        out.append({names[g.group]: g.weight for g in v.groups if g.group in names and g.weight > 0})
    return out


def lathe(bm, base, axis, profile, segments=20, cap_top=True, cap_bottom=True, mat=0):
    """A turned solid into `bm`: profile [(h, r), ...] from the bottom up, round `axis` (unit) from `base`.
    Returns its faces."""
    base, axis = Vector(base), Vector(axis).normalized()
    u = axis.orthogonal().normalized()
    v = axis.cross(u)
    rings = []
    for h, r in profile:
        ring = [bm.verts.new(base + axis * h + (u * math.cos(a) + v * math.sin(a)) * r)
                for a in (2 * math.pi * k / segments for k in range(segments))]
        rings.append(ring)
    faces = []
    for a, b in zip(rings, rings[1:]):
        for k in range(segments):
            k1 = (k + 1) % segments
            faces.append(bm.faces.new((a[k], a[k1], b[k1], b[k])))
    if cap_bottom:
        faces.append(bm.faces.new(list(reversed(rings[0]))))
    if cap_top:
        faces.append(bm.faces.new(rings[-1]))
    for f in faces:
        f.material_index = mat
    return faces


def ribbon(bm, pts, normal_of, half_w, thick=0.002, mat=0):
    """A flat strap along pts [(3,), ...], half_w wide, `thick` thick, its face turned to normal_of(p)."""
    pts = [Vector(p) for p in pts]
    rows = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        n = Vector(normal_of(p)).normalized()
        s = t.cross(n).normalized()
        n = s.cross(t).normalized()
        rows.append([bm.verts.new(p + s * sx * half_w + n * nz * thick) for sx, nz in ((-1, 1), (1, 1), (1, -1), (-1, -1))])
    faces = []
    for a, b in zip(rows, rows[1:]):
        for k in range(4):
            k1 = (k + 1) % 4
            faces.append(bm.faces.new((a[k], a[k1], b[k1], b[k])))
    faces.append(bm.faces.new(list(reversed(rows[0]))))
    faces.append(bm.faces.new(rows[-1]))
    for f in faces:
        f.material_index = mat
    return faces


def torus(bm, centre, axis, R, r, seg=16, seg2=6, mat=0):
    """A ring (a bail, a buckle's loop) into bm."""
    c, ax = Vector(centre), Vector(axis).normalized()
    u = ax.orthogonal().normalized()
    v = ax.cross(u)
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        d = u * math.cos(a) + v * math.sin(a)
        rings.append([bm.verts.new(c + d * (R + r * math.cos(b)) + ax * r * math.sin(b))
                      for b in (2 * math.pi * j / seg2 for j in range(seg2))])
    faces = []
    for i in range(seg):
        a, b = rings[i], rings[(i + 1) % seg]
        for j in range(seg2):
            j1 = (j + 1) % seg2
            faces.append(bm.faces.new((a[j], a[j1], b[j1], b[j])))
    for f in faces:
        f.material_index = mat
    return faces


def nearest_weights(src_objs, ob, bones, k=1):
    """Each vert of `ob` the weights of the nearest vert of src_objs (k=1: no blur between fingers)."""
    pts, W = [], []
    for s in src_objs:
        names = {g.index: g.name for g in s.vertex_groups if g.name in bones}
        for v in s.data.vertices:
            pts.append(v.co.copy())
            W.append({names[g.group]: g.weight for g in v.groups if g.group in names and g.weight > 0})
    kd = KDTree(len(pts))
    for i, p in enumerate(pts):
        kd.insert(p, i)
    kd.balance()
    out = []
    for v in ob.data.vertices:
        acc, tot = {}, 0.0
        for co, i, dist in kd.find_n(v.co, k):
            w = 1.0 / max(dist, 1e-4) ** 2
            tot += w
            for n, x in W[i].items():
                acc[n] = acc.get(n, 0) + x * w
        out.append({n: x / tot for n, x in acc.items()})
    return out

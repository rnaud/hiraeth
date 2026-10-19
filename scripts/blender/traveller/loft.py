"""Ring lofting for the traveller's body and clothes (issue #493): rings of vertices round an axis, bridged
into quads. A ring is a list of BMVerts in order round its axis. Blender's frame: Z up, the traveller faces -Y,
his left is +X."""
import math
import bmesh
from mathutils import Vector, Quaternion


def frame(axis, ref):
    """An orthonormal frame (A, U, V) round axis A, U the reference direction made square to it."""
    A = Vector(axis).normalized()
    U = Vector(ref) - A * A.dot(ref)
    if U.length < 1e-6:
        U = A.orthogonal()
    U.normalize()
    return A, U, A.cross(U)


def transport(A0, U0, A1):
    """U0 carried from axis A0 to A1 (the smallest turn): rings along a bending tube do not twist."""
    q = A0.rotation_difference(A1)
    U = q @ U0
    return frame(A1, U)


def angle_of(p, c, U, V):
    d = p - c
    return math.atan2(d.dot(V), d.dot(U))


def ring(bm, c, U, V, angles, shape):
    """New verts at `angles` (radians) round centre c in the frame (U, V); shape(phi) -> (u, v) offsets."""
    out = []
    for a in angles:
        u, v = shape(a)
        out.append(bm.verts.new(c + U * u + V * v))
    return out


def ellipse(r_u_pos, r_u_neg, r_v_pos, r_v_neg=None, e=2.0):
    """A ring shape: radius along +U / -U / +V / -V (superellipse exponent e; 2 an ellipse, more squarer)."""
    r_v_neg = r_v_pos if r_v_neg is None else r_v_neg
    k = 2.0 / e

    def shape(a):
        cu, sv = math.cos(a), math.sin(a)
        u = math.copysign(abs(cu) ** k, cu) * (r_u_pos if cu >= 0 else r_u_neg)
        v = math.copysign(abs(sv) ** k, sv) * (r_v_pos if sv >= 0 else r_v_neg)
        return u, v
    return shape


def bridge(bm, a, b, closed=True, faces=None):
    """Quads between two rings of the same count (b follows a)."""
    n = len(a)
    assert n == len(b), (n, len(b))
    out = []
    for k in range(n if closed else n - 1):
        k1 = (k + 1) % n
        f = bm.faces.new((a[k], a[k1], b[k1], b[k]))
        out.append(f)
    if faces is not None:
        faces.extend(out)
    return out


def bridge_uneven(bm, a, b, ta, tb, closed=True):
    """Faces between rings of different counts, walked by their parameters ta, tb (increasing, 0..1):
    quads where both advance together, triangles where one does. (Subdivision makes them quads.)"""
    out = []
    i = j = 0
    na, nb = len(a), len(b)
    ea = na if closed else na - 1
    eb = nb if closed else nb - 1
    while i < ea or j < eb:
        ai, aj = a[i % na], a[(i + 1) % na]
        bi, bj = b[j % nb], b[(j + 1) % nb]
        nta = ta[i + 1] if i + 1 < len(ta) else 1.0 + ta[0]
        ntb = tb[j + 1] if j + 1 < len(tb) else 1.0 + tb[0]
        if i < ea and j < eb and abs(nta - ntb) < 0.5 / max(na, nb):
            out.append(bm.faces.new((ai, aj, bj, bi))); i += 1; j += 1
        elif j >= eb or (i < ea and nta < ntb):
            out.append(bm.faces.new((ai, aj, bi))); i += 1
        else:
            out.append(bm.faces.new((ai, bj, bi))); j += 1
    return out


def blend_angles(start, n, t, offset=None):
    """Angles that start as `start` (sorted, unwrapped) and become uniform as t goes 0 -> 1."""
    a0 = start[0] if offset is None else offset
    uni = [a0 + 2 * math.pi * k / n for k in range(n)]
    return [s * (1 - t) + u * t for s, u in zip(start, uni)]


def sorted_loop(verts, c, U, V):
    """A loop's verts ordered by angle round (c, U, V), unwrapped to increase from the first."""
    items = sorted(((angle_of(v.co, c, U, V), v) for v in verts), key=lambda x: x[0])
    angs = [a for a, _ in items]
    return [v for _, v in items], angs


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t

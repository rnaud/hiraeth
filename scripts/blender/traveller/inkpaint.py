"""The outfits' shared painter (issue #544): what turns a palette paint into the sheets' gouache and pen, for
every outfit (docs/systems/characters.md, "Outfits": "Folds and shading"). outfit.py runs it after the
outfit's own paint(); an outfit tunes it with SHADE = {piece: {...}} (or turns it off for a piece: None).

1. vertex_shade(): per vertex of every piece, in the rest pose, with the body, his skin, the head and every
   piece as occluders: ambient occlusion (rays out to `ao_reach`), concavity (the vert below its ring's
   mean: the quilting's valleys, a collar's fold, a strap's edge), and how much it faces down. Stored as a
   colour attribute and baked into the atlas (outfit.py), so each texel has them interpolated.
2. shade(): from those, a shadow amount; the paint darkened by it (moderately: the game's ink material lights
   the clothes again, `tone`), and hatched where it is deep: pen strokes in the ink colour, at 45 degrees in
   the plane the texel faces most (front/back, side, top), broken here and there, denser as the shadow deepens.
3. folds: pen strokes the sheets draw where cloth gathers, as curves round a limb (limb_strokes): the elbow's
   and the knee's compression folds, the long drape lines of a full trouser, the gathers over a rib band.
   Each stroke is a fine line with a soft shadow on one side.

Also the small helpers every paint() repeats: band(), rgb(), Canvas (mix colours by masks)."""
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def band(d, w, aa):
    """1 inside |d| < w, soft over aa."""
    return np.clip((w - np.abs(d)) / aa + 0.5, 0, 1)


def smooth01(a, b, x):
    t = np.clip((np.asarray(x, dtype=float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def rgb(pal, name):
    return np.array(pal[name], dtype=float) / 255


class Canvas:
    """out: (n, 3) colours; mix(mask, colour, k) lays colour over where mask (n,) says, k its opacity."""
    def __init__(self, n, colour):
        self.out = np.tile(np.asarray(colour, dtype=float), (n, 1))

    def mix(self, mask, colour, k=1.0):
        a = (np.clip(mask, 0, 1) * k)[:, None]
        self.out = self.out * (1 - a) + np.asarray(colour, dtype=float)[None, :] * a


# ------------------------------------------------------------------ 1. per-vertex shadow

def _fibonacci(n):
    i = np.arange(n) + 0.5
    phi = np.arccos(1 - i / n)            # (the upper hemisphere, cosine-ish)
    th = np.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(th) * np.sin(phi), np.sin(th) * np.sin(phi), np.cos(phi)], 1)


def vertex_shade(objs, occluders, ao_reach=0.06, rays=24):
    """{object name: (n, 3) per vert: ao (1 open, 0 shut), concavity (0..1), facing down (0..1)}."""
    import bmesh
    dirs = _fibonacci(rays)
    # one tree of everything (the meshes' rest coordinates are the scene's)
    verts, polys = [], []
    for o in list(objs) + list(occluders):
        k = len(verts)
        verts += [v.co.copy() for v in o.data.vertices]
        polys += [[k + i for i in p.vertices] for p in o.data.polygons]
    tree = BVHTree.FromPolygons(verts, polys)
    out = {}
    for o in objs:
        me = o.data
        n = len(me.vertices)
        P = np.empty(n * 3)
        me.vertices.foreach_get('co', P)
        P = P.reshape(-1, 3)
        N = np.empty(n * 3)
        me.vertices.foreach_get('normal', N)
        N = N.reshape(-1, 3)
        ao = np.ones(n)
        for i in range(n):
            nn = Vector(N[i])
            t = nn.orthogonal().normalized()
            b = nn.cross(t)
            p = Vector(P[i]) + nn * 0.0015
            shut = 0.0
            for d in dirs:
                hit = tree.ray_cast(p, t * d[0] + b * d[1] + nn * d[2], ao_reach)
                if hit[0] is not None:
                    shut += (1 - hit[3] / ao_reach) ** 0.5
            ao[i] = 1 - shut / rays
        # concavity: the vert below its neighbours' mean, along its normal, over the local edge length
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.verts.ensure_lookup_table()
        cav = np.zeros(n)
        for v in bm.verts:
            if not v.link_edges:
                continue
            nb = [e.other_vert(v).co for e in v.link_edges]
            m = sum(nb, Vector()) / len(nb)
            L = sum((x - v.co).length for x in nb) / len(nb)
            cav[v.index] = (m - v.co).dot(Vector(N[v.index])) / max(L, 1e-4)
        nbr = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
        bm.free()
        for _ in range(3):
            cav = np.array([0.5 * cav[i] + 0.5 * cav[nb].mean() if nb else cav[i] for i, nb in enumerate(nbr)])
        cav = np.clip((cav - 0.04) / 0.25, 0, 1)     # (small bumps of what is under it: no shadow)
        down = np.clip(-N[:, 2] - 0.25, 0, 1)
        out[o.name] = np.stack([ao, cav, down], 1)
    return out


def store(ob, values, name='shade'):
    """values (n, 3) as a POINT colour attribute (baked by outfit.py through the atlas UVs)."""
    me = ob.data
    if name in me.attributes:
        me.attributes.remove(me.attributes[name])
    a = me.attributes.new(name, 'FLOAT_COLOR', 'POINT')
    rgba = np.ones((len(values), 4))
    rgba[:, :3] = values
    a.data.foreach_set('color', rgba.ravel().astype(np.float32))


# ------------------------------------------------------------------ 3. folds as strokes round a limb

def limb_frame(P, A, B, mirror=True):
    """t along the limb A -> B (0 at A, 1 at B), its length, and the angle round it (0 at the front, -y;
    pi/2 towards +z on the arms, towards the limb's outside (+x) on the legs). mirror: |x| (left joints
    serve both sides)."""
    Q = P.copy()
    if mirror:
        Q[:, 0] = np.abs(Q[:, 0])
    A, B = np.asarray(A, dtype=float), np.asarray(B, dtype=float)
    u = B - A
    L = np.linalg.norm(u)
    u /= L
    f = np.array([0.0, -1.0, 0.0])
    f = f - u * (f @ u)
    f /= np.linalg.norm(f)
    s = np.cross(u, f)
    if s[0] < 0 and abs(u[2]) > 0.7:      # a leg: the second axis to the outside
        s = -s
    d = Q - A
    t = (d @ u) / L
    r = d - np.outer(d @ u, u)
    ang = np.arctan2(r @ s, r @ f)
    return t, L, ang, np.linalg.norm(r, axis=1)


def limb_strokes(P, A, B, strokes, width=0.0011, shadow=0.005, mirror=True, seed=0):
    """Pen strokes round a limb: each (t0, amp, a0, span, wave): the curve t = t0 + amp * cos(a - a0) (in
    metres along the limb for amp), drawn over the angles |a - a0| < span, and `wave` metres of wobble.
    Returns (ink, shade): the lines (0..1) and a soft shadow on their lower-t side (0..1)."""
    t, L, ang, rad = limb_frame(P, A, B, mirror)
    ink = np.zeros(len(P))
    shd = np.zeros(len(P))
    rng = np.random.default_rng(seed)
    for (t0, amp, a0, span, wave) in strokes:
        da = np.angle(np.exp(1j * (ang - a0)))
        on = smooth01(span, span * 0.6, np.abs(da))
        ph = rng.uniform(0, 6.28)
        curve = t0 + (amp * np.cos(da) + wave * np.sin(3 * da + ph)) / L
        d = (t - curve) * L                         # metres from the stroke, along the limb
        taper = 0.55 + 0.45 * on
        ink = np.maximum(ink, band(d, width * taper, 0.0007) * on)
        shd = np.maximum(shd, np.clip(1 + d / shadow, 0, 1) * (d < 0) * on)
    return ink, shd


def elbow_folds(J, n=4, seed=1):
    """The sleeve's compression folds at the elbow, chevrons on its front (the inside of the bend)."""
    rng = np.random.default_rng(seed)
    A, B = J['upperarm_l'], J['hand_l']
    L = (B - A).length
    te = (J['lowerarm_l'] - A).length / L
    out = []
    for k in range(n):
        out.append((te + (k - n / 2) * 0.022 + rng.uniform(-0.004, 0.004), rng.uniform(-0.012, -0.004) if k % 2 else 0.008,
                    rng.uniform(-0.3, 0.3), rng.uniform(1.0, 1.6), 0.003))
    return ((tuple(A), tuple(B)), out)


def knee_folds(J, n=3, back=True, seed=2):
    """A trouser's folds behind the knee (and two across its front)."""
    rng = np.random.default_rng(seed)
    A, B = J['thigh_l'], J['foot_l']
    L = (B - A).length
    tk = (J['calf_l'] - A).length / L
    out = []
    for k in range(n):
        out.append((tk + (k - 1) * 0.026, 0.01, np.pi if back else 0.0, 1.1, 0.003))
    out.append((tk - 0.05, -0.012, 0.0, 0.8, 0.002))
    out.append((tk + 0.03, 0.01, 0.2, 0.7, 0.002))
    return ((tuple(A), tuple(B)), out)


def drapes(P, J, angles, t_range, width=0.0012, shadow=0.008, bow=0.25, mirror=True):
    """Long lines down a leg (a full trouser's drape: the jodhpurs' seams and folds), at `angles` round it,
    over t_range of thigh -> foot, bowed out by `bow` radians at their middle."""
    A, B = J['thigh_l'], J['foot_l']
    t, L, ang, rad = limb_frame(P, A, B, mirror)
    ink = np.zeros(len(P))
    shd = np.zeros(len(P))
    t0, t1 = t_range
    on = smooth01(t0, t0 + 0.04, t) * smooth01(t1, t1 - 0.04, t)
    mid = (t - t0) / (t1 - t0)
    for a in angles:
        c = a + bow * np.sin(np.pi * np.clip(mid, 0, 1)) * np.sign(a + 1e-6)
        da = np.angle(np.exp(1j * (ang - c))) * np.maximum(rad, 0.03)    # metres round the leg
        ink = np.maximum(ink, band(da, width, 0.0007) * on)
        shd = np.maximum(shd, np.clip(1 + da / shadow, 0, 1) * (da < 0) * on)
    return ink, shd


def gathers(P, z_at, n=26, length=0.035, width=0.0011, where=None, seed=3, centre=(0.0, 0.03)):
    """Short upright strokes above a band at z_at (a blouson's fullness over its rib, a sleeve over its
    cuff when z_at is a function of P): fanned round the body's axis."""
    rng = np.random.default_rng(seed)
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    ang = np.arctan2(x - centre[0], -(y - centre[1]))
    zb = z_at(P) if callable(z_at) else z_at
    up = z - zb
    ink = np.zeros(len(P))
    for k in range(n):
        a = -np.pi + 2 * np.pi * (k + rng.uniform(0.2, 0.8)) / n
        ln = length * rng.uniform(0.5, 1.0)
        da = np.angle(np.exp(1j * (ang - a))) * 0.15
        on = smooth01(0, 0.004, up) * smooth01(ln, ln * 0.5, up)
        ink = np.maximum(ink, band(da + (up / ln) * 0.004, width, 0.0007) * on)
    if where is not None:
        ink *= where
    return ink


# ------------------------------------------------------------------ 2. shading and hatching

DEFAULT = dict(
    ao=0.55,          # how much the occlusion darkens (its 0..1 shut)
    cavity=0.45,      # how much the valleys do
    down=0.20,        # faces turned down
    tone=0.30,        # the paint darkened by at most this (the game's ink lights it again)
    hatch=0.75,       # the hatching's ink opacity at its deepest
    hatch_from=0.30,  # the shadow amount where the hatching starts
    spacing=0.0062,   # metres between strokes
    width=0.0010,     # a stroke's half width at its deepest
    fold_ink=0.85,    # the fold strokes' ink opacity (SHADE's `folds` is the function that draws them)
)


def shade(colour, P, N, S, ink, opts=None, folds=None, seed=544):
    """The paint (n, 3) shaded: S (n, 3) the baked ao / concavity / down, `ink` the outfit's ink colour,
    `folds` [(ink, shadow)] strokes from limb_strokes / drapes / gathers. Returns (colour, shadow amount)."""
    o = dict(DEFAULT, **(opts or {}))
    ao, cav, down = S[:, 0], S[:, 1], S[:, 2]
    s = np.clip(o['ao'] * (1 - ao) * 1.6 + o['cavity'] * cav + o['down'] * down, 0, 1)
    fold_ink = np.zeros(len(P))
    for f_ink, f_shd in (folds or []):
        s = np.maximum(s, 0.55 * f_shd)
        fold_ink = np.maximum(fold_ink, f_ink)
    out = colour * (1 - o['tone'] * s)[:, None]
    # hatching: 45 degrees in the plane the texel faces most
    a = np.abs(N)
    side = a[:, 0] >= np.maximum(a[:, 1], a[:, 2])
    top = a[:, 2] > np.maximum(a[:, 0], a[:, 1])
    u = np.where(side, P[:, 1] + P[:, 2], np.where(top, P[:, 0] + P[:, 1], P[:, 0] + P[:, 2])) / (o['spacing'] * 1.4142)
    fr = u - np.floor(u)
    deep = smooth01(o['hatch_from'], 1.0, s)
    # broken strokes: a slow noise along the stroke's direction cuts them into dashes
    rng = np.random.default_rng(seed)
    k = rng.normal(size=(3, 3)) * 40
    noise = (np.sin(P @ k[0]) + np.sin(P @ k[1] + 1.3) + np.sin(P @ k[2] + 2.1)) / 3
    keep = smooth01(-0.35, -0.05, noise + deep * 0.4)
    w = o['width'] / o['spacing'] * (0.4 + 0.6 * deep)
    line = band(fr - 0.5, w, 0.12) * deep * keep
    a_h = (line * o['hatch'])[:, None]
    out = out * (1 - a_h) + np.asarray(ink)[None, :] * a_h
    a_f = (fold_ink * o['fold_ink'])[:, None]
    out = out * (1 - a_f) + np.asarray(ink)[None, :] * a_f
    return np.clip(out, 0, 1), s

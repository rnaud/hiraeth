"""The salt pilgrim (issue #545): the traveller's sixth outfit, from
references/characters/traveller-outfits/salt-pilgrim/sheet-1.jpg (front, side, back) and sheet-2.jpg.

A long sleeveless white over-robe, open down the front, to under the knee, slit at the sides, its hood lying
on his back, edged with a stitched border of turquoise and terracotta triangles; under it a saffron wrapped
tunic with full sleeves gathered at the wrists, a rose sash knotted at his left hip with its ends hanging;
cream trousers full to the shin and gathered above the ankle; woven sandals laced up over his bare feet.

The robe cannot be a live cloth in the game, so it is a drape: its body cut from the base body's cage and
grown out; its skirt hung from the cut's hem as rings flaring to the hem, with folds (fuller toward the hem
and the back), slits left open below the thigh at the sides and up the back. Since #547 its four panels
swing (outfit_kit.py, "a skirt's swing"; swing_spec here): each hangs from the hips' axis on two bones of
its own, goes with its thigh and shin where they push it and hangs plumb where they leave it, and in the
game a damped spring carries the hang (src/characters/outfits.js); the tunic's skirt the same. Their weights
on the thighs (_skirt_weights) stay as the fallback and over the hips. outfit.py's checks measure, with
the swing, how far his trousers come through them at full stride.

The hood (#547) lies on his back as on sheet-1: a roll round his neck along the robe's neckline and the
hood's bag down his back to a point (Hood, over the robe). The sandals (#547): his foot in his skin's
colour (the base body's foot hidden under it), flat on a woven sole with thickness and five toes (Soles,
a prop), the straps raised over it (RELIEF). The robe's border stands proud round its hem and down its
front edges (RELIEF); the shared painter (inkpaint.py) shades it all, with the trousers' long folds and
the sleeves' at the elbows.

Palette (#547): medians of sheet-1's robe (the paper's warm white), tunic, sash and the border's turquoise
and terracotta."""
import math
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix
import garments as G
import rig as R
import outfit_kit as K
import tailor as T
import inkpaint as IP
from loft import smoothstep

ID = 'salt-pilgrim'
NAME = 'Salt pilgrim'
SHEET = 'references/characters/traveller-outfits/salt-pilgrim/sheet-1.jpg'

# (#547: the cloth's colours as the sheet's, medians of sheet-1's robe, tunic, sash and border stitching: the
# robe the paper's warm white, the saffron and the rose lighter, the border's turquoise and terracotta)
PAL = {
    'robe': (247, 237, 221), 'saffron': (232, 164, 90), 'rose': (212, 122, 100), 'cream': (232, 214, 190),
    'turquoise': (108, 176, 180), 'terracotta': (214, 124, 88), 'skin': (201, 134, 94), 'strap': (112, 84, 64),
    'sole': (186, 150, 104), 'ink': (40, 34, 30),
}
PIECES = {
    # (the trousers one subdivision level fewer: under the tunic and the robe all but their shins, and the
    # outfit within the default's triangles)
    'PilgrimTrousers': dict(layer=1, outside=[], covers=['Tunic', 'Sandals'], hem=0.02, levels=1, gap=0.005),
    # (his feet: their toes and straps are geometry, the soles a prop under them)
    'Sandals': dict(layer=1, outside=[], covers=[], hem=0.01, levels=1, gap=0.002),
    'Tunic': dict(layer=2, outside=['PilgrimTrousers'], covers=['Robe', 'Sash'], hem=0.02, levels=2, gap=0.005),
    'Sash': dict(layer=3, outside=['Tunic'], covers=[], hem=0.01, levels=1, gap=0.003),
    # (the robe fitted over the tunic and the trousers, only checked against the sash: fitted over its knot
    # and ends, which hang in the robe's opening, it bent its front edges in front of them)
    'Robe': dict(layer=4, outside=['Tunic', 'PilgrimTrousers'], checks=['Sash'], covers=[], hem=0.025, levels=2, gap=0.006),
    # (#547) the hood lying down: a rolled rim round his neck and the hood's bag on his back, over the robe;
    # weighted from his back and shoulders, never his neck and head (it would turn with his head)
    'Hood': dict(layer=5, outside=['Robe', 'Tunic'], covers=[], hem=None, levels=1, gap=0.004,
                 sample=lambda p: Vector((p.x, p.y, min(p.z, 1.40)))),
}
BOOTS = None          # his feet bare in sandals: the Sandals piece and the Soles under it
ZONES = {'PilgrimTrousers': ['cream', 'cream'], 'Sandals': ['skin'], 'Tunic': ['saffron', 'saffron'],
         'Sash': ['rose', 'rose'], 'Robe': ['robe'], 'Hood': ['robe', 'robe'], 'Soles': ['sole', 'skin']}
PART = G.PART
EDGE = {}
ROBE_HEM = 0.37       # under the knee (the sheet: a hand and more under it; #547: it hangs on from the knee)
SLIT_TOP = 0.66       # the side slits from the hem to the middle of the thigh
TUNIC_HEM = 0.78


def _orient(bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    score = 0.0
    for f in bm.faces:
        n = sum((G.normal(bm, v) for v in f.verts), Vector())
        score += f.normal.dot(n)
    if score < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)


def trousers(cage, J):
    """Full: wide from the hip, fullest over the shin, gathered into a band above the ankle."""
    bm = G.cut(cage, lambda v, p: (p == PART['torso'] and v.co.z <= 1.09) or (p == PART['leg'] and v.co.z >= 0.235))
    G.inflate(bm, lambda p, part: 0.010 + 0.004 * smoothstep(0.95, 0.75, p.z) + 0.020 * smoothstep(0.62, 0.40, p.z) * smoothstep(0.24, 0.32, p.z))
    for v in bm.verts:     # the seat hangs low
        if abs(v.co.x) < 0.035 and v.co.z < 0.9:
            v.co.z -= 0.025 * (1 - abs(v.co.x) / 0.035)
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z > 0.7:
            continue
        out = G.radial((c.x, c.y))
        r1 = G.extrude(bm, loop, lambda p, v: p - out(p) * 0.016 - Vector((0, 0, 0.010)))
        G.extrude(bm, r1, lambda p, v: p - Vector((0, 0, 0.022)))
        EDGE['cuff'] = c.z - 0.032
        for f in bm.faces:
            if f.calc_center_median().z < c.z - 0.008:
                f.material_index = 1
    _orient(bm)
    return bm


SOLE_TOP = 0.017      # the soles' top: his feet stand on them (#547)


def _foot_box(cage, side):
    lay = cage.verts.layers.int.get('part')
    fv = [v.co for v in cage.verts if v[lay] == PART['foot'] and v.co.x * side > 0]
    return (min(p.x for p in fv), max(p.x for p in fv)), (min(p.y for p in fv), max(p.y for p in fv))


def _toes(side, xs, ys):
    """The five toes of a foot (centre, half sizes x y z), big toe inside: they stand from the foot's front
    on the sole (#547: the sheet's bare toes, not a slipper's round front)."""
    (x0, x1), (y0, y1) = xs, ys
    inner = x0 if side > 0 else x1                       # (his big toe at the inside of each foot)
    out = []
    for k, (u, ln, w, h, back) in enumerate(((0.16, 0.021, 0.0115, 0.0095, 0.000), (0.37, 0.017, 0.0080, 0.0078, 0.004),
                                            (0.55, 0.016, 0.0074, 0.0072, 0.009), (0.71, 0.014, 0.0068, 0.0066, 0.015),
                                            (0.86, 0.012, 0.0062, 0.0060, 0.022))):
        x = inner + side * u * (x1 - x0)
        y = y0 + 0.002 + back + ln
        out.append(((x, y, SOLE_TOP + h * 1.2), (w * 1.1, ln, h * 1.2)))
    return out


def sandals(cage, J):
    """His foot, a breath over the base body's (the base body's is hidden under it); its RELIEF shapes it
    after its fitting (the underside flat on the sole, the front shortened to the root of his toes) and
    raises the straps on it; the soles and the toes are a prop (Soles)."""
    bm = G.cut(cage, lambda v, p: p == PART['foot'] or (p == PART['leg'] and v.co.z <= 0.18))
    G.inflate(bm, lambda p, part: 0.003)
    _orient(bm)
    for side in (-1, 1):
        FEET[side] = _foot_box(cage, side)
    return bm


FEET = {}


def _shape_feet(ob, J):
    """(relief) The feet stand on the soles: the foot's underside raised flat onto their top, its front
    drawn back to the toes' root (the toes stand from it: Soles). After the fitting: the body's own foot,
    hidden, lies under it."""
    me = ob.data
    P = T._coords(me)
    d = np.zeros_like(P)
    for side in (-1, 1):
        (x0, x1), (y0, y1) = FEET[side]
        root = y0 + 0.034
        m = (P[:, 0] * side > 0) & (P[:, 1] < root)
        d[m, 1] = (root + (P[m, 1] - root) * 0.35) - P[m, 1]
        # the foot's top low over the toes' root (the toes show), rising up the instep
        y = P[:, 1] + d[:, 1]
        s = (P[:, 0] * side > 0) & (y < root + 0.05)
        cap = SOLE_TOP + 0.020 + np.maximum(0.0, y - root) * 0.55
        d[s, 2] += np.minimum(0.0, cap[s] - P[s, 2])
    z = P[:, 2] + d[:, 2]
    d[:, 2] += np.maximum(0.0, SOLE_TOP + 0.0015 - z)
    T._move(me, d)
    return {'moved': int((np.abs(d).sum(1) > 1e-5).sum())}


def _straps():
    """The sandals' straps (tailor.py shapes, both feet): across the root of the toes, over the instep, round
    the ankle, and two laces crossing up the shin. Each (shape, where): raised by RELIEF, coloured by paint."""
    out = []
    for side in (-1, 1):
        cx = side * 0.140
        here = (lambda s: (lambda P: (P[:, 0] * s > 0) * 1.0))(side)
        out += [
            (T.ring((cx, -0.078, 0.03), (0.22 * side, 1.0, 0.25), 0.0075), lambda P, h=here: h(P) * (P[:, 1] > -0.10) * (P[:, 2] > SOLE_TOP + 0.002)),
            (T.ring((cx, -0.022, 0.05), (-0.28 * side, 1.0, 0.65), 0.0070), lambda P, h=here: h(P) * (P[:, 2] > SOLE_TOP + 0.002)),
            (T.ring((cx, 0.010, 0.098), (0.0, 0.22, 1.0), 0.0060), here),
            (T.ring((cx, 0.020, 0.140), (0.0, 0.55, 1.0), 0.0045), lambda P, h=here: h(P) * (P[:, 2] > 0.105)),
            (T.ring((cx, 0.020, 0.140), (0.0, -0.55, 1.0), 0.0045), lambda P, h=here: h(P) * (P[:, 2] > 0.105)),
        ]
    return out


STRAPS = _straps()


def soles(ctx):
    """The soles (a prop): a slab under each foot, its outline the foot's footprint grown 6 mm, its edges
    eased (four rings), SOLE_TOP thick; each vert weighted as the body's nearest (it bends at the ball)."""
    cage = ctx['cage']
    bm = bmesh.new()
    for side in (-1, 1):
        (x0, x1), (y0, y1) = _foot_box(cage, side)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        hl = (y1 - y0) / 2 + 0.008
        n = 28
        rings = []
        for z, grow in ((0.0, -0.0015), (0.003, 0.0), (SOLE_TOP - 0.003, 0.0), (SOLE_TOP, -0.0015)):
            ring = []
            for i in range(n):
                a = 2 * math.pi * i / n
                t = -math.sin(a)                         # -1 at the heel's end... +1 at the toes'
                # a foot's footprint: wide at the ball, narrower at the heel, a straight inner edge
                half_w = (x1 - x0) / 2 * (0.78 + 0.30 * smoothstep(-0.2, 0.55, -t) - 0.10 * smoothstep(0.75, 1.0, -t)) + 0.006
                x = cx + side * 0.006 * (-t) + math.cos(a) * (half_w + grow)
                y = cy - 0.004 + math.sin(a) * (hl + grow)
                ring.append(bm.verts.new((x, y, z)))
            rings.append(ring)
        for A, B in zip(rings, rings[1:]):
            for i in range(n):
                bm.faces.new((A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]))
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        # his toes, on the sole: small ellipsoids, rounder at the tip, their backs in the foot's front
        for c, (w, ln, h) in _toes(side, (x0, x1), (y0, y1)):
            r = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=1.0)
            for v in r['verts']:
                x, y, z = v.co
                v.co = Vector((c[0] + x * w, c[1] + y * ln * (1.0 if y < 0 else 1.35), c[2] + z * h * (1.0 if z > 0 else 0.7)))
            faces = list({f for v in r['verts'] for f in v.link_faces})
            for f in faces:
                f.material_index = 1
            bmesh.ops.recalc_face_normals(bm, faces=faces)
    return bm


PROPS = {'Soles': dict(build=soles, layer=1)}


def tunic(cage, J):
    """Wrapped: full long sleeves gathered into a cuff at the wrist; a round neck; the skirt hung from the
    hips to the middle of the thigh, open at the front where it wraps."""
    bm = G.cut(cage, lambda v, p: (p == PART['torso'] and v.co.z >= 0.94) or (p == PART['arm'] and abs(v.co.x) <= 0.63))

    def off(p, part):
        if part == PART['arm']:
            t = G.arm_t(p, J)
            return 0.014 + 0.020 * smoothstep(0.20, 0.55, t) * smoothstep(0.98, 0.80, t)
        return 0.012 + 0.006 * smoothstep(1.20, 1.32, p.z) + 0.002 * smoothstep(1.08, 0.96, p.z)
    G.inflate(bm, off)
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z > 1.30 and abs(c.x) < 0.12:     # the neck: a narrow band standing
            out = G.radial((0.0, c.y))
            G.extrude(bm, loop, lambda p, v: p + Vector((0, 0, 0.012)) + out(p) * 0.002)
        elif c.z > 1.1:                          # a sleeve's end: gathered into a cuff over the wrist
            sx = math.copysign(1.0, c.x)
            ctr = Vector((0, c.y, c.z))
            rad = lambda p: (p - Vector((p.x, ctr.y, ctr.z))).normalized()
            r1 = G.extrude(bm, loop, lambda p, v: p + Vector((sx * 0.006, 0, 0)) - rad(p) * 0.006)
            G.extrude(bm, r1, lambda p, v: p + Vector((sx * 0.022, 0, 0)))
            EDGE['sleeveCuff'] = abs(c.x) + 0.006
            for f in bm.faces:
                if abs(f.calc_center_median().x) > abs(c.x) + 0.003:
                    f.material_index = 1
        else:                                    # the hips: the skirt, open where it wraps in front
            for run in G.runs(loop, lambda v: not (v.co.y < 0 and abs(v.co.x) < 0.03)):
                if len(run) < 4:
                    continue
                K.skirt(bm, run, (0.0, 0.015), TUNIC_HEM, 5,
                        lambda th, r0, z, t: r0 + 0.034 * t + 0.004 * t * math.sin(th * 9), part=PART['torso'])
            EDGE['tunicHem'] = TUNIC_HEM
    _orient(bm)
    return bm


def sash(cage, J):
    """A rose band round the waist, knotted at his left hip, two ends hanging from the knot."""
    bm = bmesh.new()
    bm.verts.layers.int.new('part')
    for k in ('nx', 'ny', 'nz'):
        bm.verts.layers.float.new(k)
    z0, z1 = 0.985, 1.075
    K.band(bm, cage, PART['torso'], z0, z1, off=0.022, n=40, mat=0, thick=0.005)
    zc = (z0 + z1) / 2
    pts, c = K.ring_of(cage, PART['torso'], zc)
    a = -math.pi / 2 + 0.04
    p, d = K.on_ring(pts, c, a, 0.044, zc)
    rot = K.face_rot(d)
    K.box(bm, p, (0.040, 0.020, 0.044), rot, bevel=0.008, mat=1)
    for k, (dx, ln, tilt) in enumerate(((-0.010, 0.19, 0.05), (0.014, 0.15, -0.08))):
        q = p + d * 0.006 + rot @ Vector((dx, 0, 0)) - Vector((0, 0, 0.022 + ln / 2))
        K.box(bm, q, (0.034, 0.006, ln), rot @ Matrix.Rotation(tilt, 3, 'Y'), bevel=0.002, mat=1)
    return bm


def robe(cage, J):
    """Its body: the torso from the hips up, the front open from the neck down (a gap a hand wide), no
    sleeves, a low band at the neck; its skirt: rings hung from the hips to under the knee, flaring, with
    folds, slit at the sides and up the back (each of its four panels swings on its own: swing_spec); its hood a
    piece of its own (Hood)."""
    bm = G.cut(cage, lambda v, p: p == PART['torso'] and v.co.z >= 0.93,
               keep_face=lambda f: not (f.calc_center_median().y < 0 and abs(f.calc_center_median().x) < 0.05))
    G.inflate(bm, lambda p, part: 0.030 + 0.016 * smoothstep(1.22, 1.00, p.z) + 0.004 * smoothstep(1.30, 1.40, p.z))
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if abs(c.x) > 0.12:
            continue                             # an armhole
        low = min(v.co.z for v in loop)
        if low > 1.0:
            continue                             # the neck (when the front's cut stops under it)
        # the hem's run, from one front edge round the back to the other
        runs = G.runs(loop, lambda v: v.co.z < low + 0.02 and not (v.co.y < 0 and abs(v.co.x) < 0.035))
        run = max(runs, key=len)
        # the skirt: flaring to the hem, folds deepening down it (fuller behind)
        def radius(th, r0, z, t):
            back = max(0.0, math.sin(th))
            flare = 0.050 * t + 0.030 * t * back
            folds = (0.006 + 0.012 * t) * math.sin(th * 7 + 0.6) + 0.004 * t * math.sin(th * 13)
            return r0 + flare + folds
        rings = K.skirt(bm, run, (0.0, 0.020), ROBE_HEM, 9, radius, slits=(0.0, math.pi, math.pi / 2), slit_top=SLIT_TOP,
                        part=PART['torso'])
        EDGE['front'] = [math.atan2(run[0].co.y - 0.02, run[0].co.x), math.atan2(run[-1].co.y - 0.02, run[-1].co.x)]
    _orient(bm)
    EDGE['hem'] = ROBE_HEM
    return bm


def _robe_neckline():
    """The robe's open edge from its front edge on his left chest round the back of his neck to the right
    one (above HOOD_LOW), as points in order, resampled every 1 cm and smoothed."""
    me = bpy.data.objects['Robe'].data
    bm = bmesh.new()
    bm.from_mesh(me)
    loops = G.boundary_loops(bm)
    best = []
    for loop in loops:
        for run in G.runs(loop, lambda v: v.co.z > HOOD_LOW):
            if len(run) > len(best) and max(v.co.z for v in run) > 1.40:
                best = run
    pts = [v.co.copy() for v in best]
    bm.free()
    if pts[0].x < pts[-1].x:
        pts.reverse()                                   # from his left (+x) round the back to his right
    # resample by arc length
    L = [0.0]
    for a, b in zip(pts, pts[1:]):
        L.append(L[-1] + (b - a).length)
    n = max(8, int(L[-1] / 0.022))
    out = []
    j = 0
    for k in range(n + 1):
        s = L[-1] * k / n
        while j < len(L) - 2 and L[j + 1] < s:
            j += 1
        t = (s - L[j]) / max(1e-9, L[j + 1] - L[j])
        out.append(pts[j].lerp(pts[j + 1], t))
    for _ in range(6):
        out = [out[0]] + [(out[i - 1] + out[i] * 2 + out[i + 1]) / 4 for i in range(1, len(out) - 1)] + [out[-1]]
    return out


HOOD_LOW = 1.20       # the rim's ends: down his chest beside the robe's front edges
HOOD_TIP = 1.12       # the hood's point, down his back


def hood(cage, J):
    """The hood lying down (#547; sheet-1's back: a cowl, its rim rolled round his neck, the hood's bag
    lying on his back to a point between his shoulder blades): the rim a soft roll along the robe's
    neckline (thicker behind, thinning down his chest), the bag a quilted-flat sack below it, built on the
    robe's back (rays onto it), fuller under the rim and with two folds running down to its point. Fitted
    over the robe and the tunic (PIECES)."""
    robe = bpy.data.objects['Robe']
    from mathutils.bvhtree import BVHTree
    rb = bmesh.new()
    rb.from_mesh(robe.data)
    bvh = BVHTree.FromBMesh(rb)
    bm = bmesh.new()
    pl = bm.verts.layers.int.new('part')
    for k in ('nx', 'ny', 'nz'):
        bm.verts.layers.float.new(k)
    # -- the rim: a roll swept along the neckline, lying on the robe just inside its edge
    line = _robe_neckline()
    n = len(line)
    sides = 6
    rings = []
    for i, p in enumerate(line):
        t = i / (n - 1)
        behind = math.sin(math.pi * t) ** 1.5           # 1 behind his neck, 0 at the ends
        tang = (line[min(n - 1, i + 1)] - line[max(0, i - 1)]).normalized()
        out = bvh.find_nearest(p)[1].normalized()       # the robe's outward normal there
        inward = out.cross(tang).normalized()           # along the robe, away from its edge
        a_, b_ = bvh.find_nearest(p + inward * 0.012), bvh.find_nearest(p - inward * 0.012)
        if (a_[3] if a_[0] is not None else 1) > (b_[3] if b_[0] is not None else 1):
            inward = -inward
        r_out = 0.008 + 0.009 * behind
        r_in = 0.010 + 0.013 * behind
        c = p + out * (r_out * 0.85) + inward * (r_in * 0.55)
        ring = []
        for j in range(sides):
            a = 2 * math.pi * j / sides
            q = c + out * (math.sin(a) * r_out) + inward * (math.cos(a) * r_in)
            v = bm.verts.new(q)
            v[pl] = PART['torso']
            ring.append(v)
        rings.append(ring)
    for A, B in zip(rings, rings[1:]):
        for j in range(sides):
            f = bm.faces.new((A[j], A[(j + 1) % sides], B[(j + 1) % sides], B[j]))
            f.material_index = 1
    for ring, rev in ((rings[0], True), (rings[-1], False)):
        f = bm.faces.new(list(reversed(ring)) if rev else ring)
        f.material_index = 1
    # -- the bag: a grid across his back, its top under the rim behind, narrowing to its point
    top = max(p.z for p in line) - 0.03
    nu, nv = 13, 9
    grid = []
    for iv in range(nv + 1):
        v_ = iv / nv
        z = top + (HOOD_TIP - top) * v_
        half = 0.135 * (1 - v_) ** 0.62 + 0.004
        row = []
        for iu in range(nu + 1):
            u = -1 + 2 * iu / nu
            x = u * half
            hit = bvh.ray_cast(Vector((x, 0.0, z)), Vector((0, 1, 0)), 0.4)
            y = hit[0].y if hit[0] is not None else 0.16
            # the bag's fullness over the robe: most under the rim and in its middle, nothing at its edges,
            # two folds down to the point
            edge = (1 - abs(u) ** 2.2) * math.sin(math.pi * min(1.0, v_ ** 0.75))   # (nothing at its top, tucked under the rim, nor at its point)
            fold = 0.006 * math.cos(u * math.pi * 2.0) * (0.3 + v_) * (1 - abs(u))
            y += 0.004 + 0.036 * edge + fold
            vv = bm.verts.new((x, y, z))
            vv[pl] = PART['torso']
            row.append(vv)
        grid.append(row)
    for A, B in zip(grid, grid[1:]):
        for iu in range(nu):
            bm.faces.new((A[iu], B[iu], B[iu + 1], A[iu + 1]))
    rb.free()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # the bag faces out from his back
    bag = [f for f in bm.faces if f.material_index == 0]
    if sum(f.normal.y for f in bag) < 0:
        bmesh.ops.reverse_faces(bm, faces=bag)
    nx, ny, nz = (bm.verts.layers.float.get(k) for k in ('nx', 'ny', 'nz'))
    bm.normal_update()
    for v in bm.verts:
        v[nx], v[ny], v[nz] = v.normal
    EDGE['hoodTop'] = top
    return bm


def _skirt_weights(ob, W, top=0.96, front_k=0.10, k_max=1.0):
    """The skirt's own weights under `top`: the pelvis less a share of each thigh growing down it (more at
    the front, where each panel lies over its own leg; shared behind and at the sides), blended into the
    body's weights over the hips."""
    out = []
    for v, w in zip(ob.data.vertices, W):
        p = v.co
        if p.z > top + 0.04:
            out.append(w)
            continue
        fr = min(1.0, max(0.0, -(p.y - 0.02) / 0.10))
        a = smoothstep(top + 0.02, 0.80, p.z) * (k_max - front_k + front_k * fr)
        sl = smoothstep(-0.10, 0.10, p.x)
        mine = {'pelvis': 1 - a, 'thigh_l': a * sl, 'thigh_r': a * (1 - sl)}
        b = smoothstep(top + 0.04, top - 0.04, p.z)
        acc = {n: x * (1 - b) for n, x in w.items()}
        for n, x in mine.items():
            acc[n] = acc.get(n, 0) + x * b
        out.append({n: x for n, x in acc.items() if x > 1e-4})
    return R.smooth_weights(ob, out, iters=4, k=0.5)


def swing_spec(J):
    """The robe's and the tunic's swing (#547; outfit_kit.py, "a skirt's swing"), in the game's frame: hung
    from the hips' axis, the knee where the lower bones take over; the mix from the hips down; the panels
    soft into each other above the robe's slits (the tunic's skirt, unslit, all down); the hang a share of
    the pelvis' lean; the springs that carry it in the game (rad/s, damping ratio) and how hard the body's
    acceleration swings the panels."""
    return {
        # (the robe's panels apart below its slits' tops, joined over them: from a little under, where
        # its subdivided corners round the slits' tops off)
        # (the tunic's skirt, unslit under them, parts where the robe's panels do: it moves as they do)
        'garments': {'Robe': {'slitTop': round(SLIT_TOP - 0.07, 3), **SLITS}, 'Tunic': {'slitTop': None, **SLITS}},
        'pivot': [round(J['thigh_l'].z, 4), round(-J['thigh_l'].y, 4)],
        'kneePivot': round(J['calf_l'].z, 4), 'hipX': round(J['thigh_l'].x, 4),
        'centre': -0.020,
        'mix': [0.98, 0.88], 'knee': [0.58, 0.47], 'blend': 0.05, 'soften': 0.08,
        'hang': 0.8, 'lowerHang': 0.9, 'lowerReach': 0.7,
        'bones': {'pelvis': 'pelvis', 'thigh': ['thigh_l', 'thigh_r'], 'calf': ['calf_l', 'calf_r']},
        'spring': {'upper': [8.0, 0.32], 'lower': [14.0, 0.4], 'inertia': 0.5},
        'doubleSided': True,      # (its skirts swing open: their insides are seen)
    }


def swing(ob, J):
    """(relief) No change to the robe: its report is the swing's spec (the manifest's fit.Robe.relief.swing,
    which src/characters/outfits.js reads)."""
    SLITS.update(K.slit_lines(ob, SLIT_TOP, ROBE_HEM))     # (where its slits part its panels: measured once, here)
    return swing_spec(J)


SLITS = {}


def reweight(name, ob, arm, J):
    if name == 'Robe':
        R.set_weights(ob, _skirt_weights(ob, K.weights_of(ob)))
    elif name == 'Tunic':
        # (its skirt ends at mid-thigh: all but held to each thigh, as the robe's panel over it nearly is)
        R.set_weights(ob, _skirt_weights(ob, K.weights_of(ob), front_k=0.0, k_max=1.0))
    elif name == 'Sash':
        R.set_weights(ob, K.copy_weights(ob, bpy.data.objects['Tunic']))
        R.set_weights(ob, K.rigid_islands(ob, skip_mats=(0,)))      # the knot and its ends: as one
    if name in ('Robe', 'Tunic'):
        # (#547) the skirts' swing: the weights above stay the fallback (and the hips'); in Blender the swing's
        # rig is mixed over them for the checks and the previews; in the game outfits.js swings them
        spec = swing_spec(J)
        K.swing_bind(ob, K.swing_rig(arm, spec), spec, name)


def _robe_relief(ob, J):
    """The border stands proud: a band round the hem (crisp, cut), and the strip along each front edge (each
    vert by its distance round from the edge, as the paint draws the border)."""
    rep = {'hem': T.raised(T.ring((0, 0, ROBE_HEM + 0.013), (0, 0, 1), 0.013), height=0.0022)(ob, J)}
    me = ob.data
    P = T._coords(me)
    N = T._normals(me)
    th = np.arctan2(P[:, 1] - 0.020, P[:, 0])
    r = np.hypot(P[:, 0], P[:, 1] - 0.020)
    de = np.min([np.abs(np.arctan2(np.sin(th - e), np.cos(th - e))) * r for e in EDGE['front']], axis=0)
    k = np.clip((0.026 - de) / 0.003, 0, 1) * (P[:, 1] < 0.02) * (P[:, 2] > ROBE_HEM + 0.02) * (P[:, 2] < 1.44)
    T._move(me, N * (0.0022 * k)[:, None])
    rep['front'] = int((k > 0.5).sum())
    return rep


def _strap_ops():
    return [T.raised(shape, height=0.0026, step=0.0022, where=where) for shape, where in STRAPS]


# (the robe's swing: a report, no change; the sandals shaped after their fitting, then their straps)
RELIEF = {'Robe': [_robe_relief, swing], 'Sandals': [_shape_feet] + _strap_ops()}


def _folds(piece):
    def f(P, N, zone, J):
        if piece == 'PilgrimTrousers':
            dr = IP.drapes(P, J, angles=(-0.6, 0.3, 1.4, 2.6), t_range=(0.30, 0.86), bow=0.35)
            leg = (P[:, 2] < 0.7) * 1.0
            return [(dr[0] * leg, dr[1] * leg)]
        if piece == 'Tunic':
            (A, B), st = IP.elbow_folds(J, n=4)
            ink, shd = IP.limb_strokes(P, A, B, st)
            arm = T.smooth01(0.30, 0.34, np.abs(P[:, 0])) * (zone == 0)
            return [(ink * arm, shd * arm)]
        return []
    return f


# the shared painter (inkpaint.py): the trousers' long folds, the sleeves' at the elbows; the white robe's
# shadow a step lighter so it stays white; the trousers and the sash lighter (most of them lie under the
# robe, in its shadow: their shins and knot kept from going muddy)
SHADE = {'PilgrimTrousers': dict(folds=_folds('PilgrimTrousers'), fold_ink=0.55, tone=0.2),
         'Tunic': dict(folds=_folds('Tunic'), fold_ink=0.6, tone=0.24), 'Robe': dict(tone=0.18, hatch=0.4),
         'Hood': dict(tone=0.18, hatch=0.4), 'Sandals': dict(hatch=0.2), 'Soles': dict(hatch=0.3),
         'Sash': dict(tone=0.22, hatch=0.4)}

# his skin piece under the full sleeves (B3's forearms) left out, as the glider pilot's; his hands show
SKIN_CUT = [{'absx': [0.20, 0.62], 'z': [1.15, 1.60]}]
# body areas left out besides the measured ones (97 % under a piece): none since #493's pass 5. On the pass-4
# base the hips and thighs came out under 97 % (the crumpled crotch), and the ankles and feet under the sandals'
# (their feet 3 mm off the body's); on the refitted base the trousers measure the hips and thighs, the sandals
# the ankles and feet
EXTRA_HIDES = []

BUILDERS = {'PilgrimTrousers': trousers, 'Sandals': sandals, 'Tunic': tunic, 'Sash': sash, 'Robe': robe, 'Hood': hood}


# ------------------------------------------------------------------ the paint

def _rgb(name):
    return np.array(PAL[name], dtype=float) / 255


def _leg_axis(x, z, J):
    zs = [J['foot_l'].z, J['calf_l'].z, J['thigh_l'].z]
    cx = np.where(x > 0, 1, -1) * np.interp(z, zs, [J['foot_l'].x, J['calf_l'].x, J['thigh_l'].x])
    cy = np.interp(z, zs, [J['foot_l'].y, J['calf_l'].y, J['thigh_l'].y])
    return cx, cy


def _border(s, t, w):
    """The border's pattern along an edge: s metres along it, t metres in from it, w wide: turquoise and
    terracotta triangles alternating between two stitched lines."""
    tri = np.abs(((s / 0.022) % 1.0) - 0.5) * 2         # 0..1 along each triangle's base
    up = (np.floor(s / 0.022) % 2) == 0
    inside = (t > w * 0.18) & (t < w * 0.82)
    h = (t - w * 0.18) / (w * 0.64)
    tri_on = inside & (h < 1 - tri)
    return tri_on, up


def paint(piece, zone, P, N, J):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    ax = np.abs(x)
    n = len(P)
    rng = np.random.default_rng(5452)
    out = np.zeros((n, 3))
    ink = _rgb('ink')
    band = K.band_mask

    def mix(mask, colour, k=1.0):
        nonlocal out
        a = (np.clip(mask, 0, 1) * k)[:, None]
        out = out * (1 - a) + np.asarray(colour)[None, :] * a

    front = np.clip(-N[:, 1] * 2.5, 0, 1)
    if piece == 'Robe':
        out[:] = _rgb('robe')
        th = np.arctan2(y - 0.020, x)
        r = np.hypot(x, y - 0.020)
        W = 0.026
        # the border down each front edge (metres round from the edge) and round the hem
        e0, e1 = EDGE['front']
        d0 = np.abs(np.arctan2(np.sin(th - e0), np.cos(th - e0))) * r
        d1 = np.abs(np.arctan2(np.sin(th - e1), np.cos(th - e1))) * r
        de = np.minimum(d0, d1)
        dh = z - EDGE['hem']
        for t, s, on in ((de, z, (y < 0.02) & (de < W)), (dh, th * 0.25, dh < W)):
            tri, up = _border(s, t, W)
            mix(on * tri * up, _rgb('turquoise'))
            mix(on * tri * ~up, _rgb('terracotta'))
            mix(on * band(t - W * 0.12, 0.0013, 0.0008), ink, 0.6)
            mix(on * band(t - W * 0.88, 0.0013, 0.0008), ink, 0.6)
        out *= K.grain(rng, n, 0.025)
    elif piece == 'Tunic':
        out[:] = _rgb('saffron')
        cuff = zone == 1
        torso = ax < 0.2
        # the wrap: the left front over the right, its edge from his right neck to his left hip
        a = np.array([-0.045, 1.44])
        b = np.array([0.10, 0.96])
        dvec = b - a
        tt = np.clip(((x - a[0]) * dvec[0] + (z - a[1]) * dvec[1]) / dvec.dot(dvec), 0, 1)
        dist = np.hypot(x - (a[0] + tt * dvec[0]), z - (a[1] + tt * dvec[1]))
        mix(band(dist, 0.0018, 0.001) * front * torso * (z > 0.95), ink, 0.75)
        mix(band(dist - 0.008, 0.0012, 0.0008) * front * torso * (z > 0.95), ink, 0.35)
        # the skirt's wrapped edge in front
        mix(band(x - 0.03, 0.0016, 0.001) * front * (z < 0.96), ink, 0.6)
        # gathers: fine folds drawn down the sleeves into the cuffs
        arm = ax > 0.2
        g = np.sin(np.arctan2(y - 0.05, z - 1.36) * 14)
        mix(arm * (g > 0.7) * np.clip((ax - 0.45) / 0.15, 0, 1), ink, 0.25)
        out[cuff] = out[cuff] * 0.92
        out *= K.grain(rng, n)
    elif piece == 'Sash':
        out[:] = _rgb('rose')
        # its folds: lines along the band; fringe at the ends
        mix((np.sin(z / 0.006) > 0.75) * (z > 0.97), ink, 0.25)
        mix((z < 0.78) * (np.sin(x / 0.003) > 0.3), ink, 0.35)
        out *= K.grain(rng, n)
    elif piece == 'PilgrimTrousers':
        out[:] = _rgb('cream')
        cx, cy = _leg_axis(x, z, J)
        # gathers above the cuff: folds drawn up from it
        ang = np.arctan2(y - cy, (x - cx) * np.sign(x + 1e-9))
        g = np.sin(ang * 11)
        near = np.clip(1 - (z - EDGE['cuff'] - 0.03) / 0.10, 0, 1) * (zone == 0) * (z < 0.5)
        mix(near * (g > 0.6), ink, 0.35)
        out[zone == 1] = out[zone == 1] * 0.93
        mix(band(z - (EDGE['cuff'] + 0.032), 0.0015, 0.001), ink, 0.5)
        out *= K.grain(rng, n, 0.04)
    elif piece == 'Sandals':
        out[:] = _rgb('skin')
        # the straps (raised by RELIEF): the strap's leather, an inked edge
        strap = np.zeros(n)
        for (sdf, _), where in STRAPS:
            strap = np.maximum(strap, np.clip(-sdf(P) / 0.0012, 0, 1) * where(P))
        mix(strap, _rgb('strap'))
        mix(band(strap - 0.5, 0.22, 0.12), ink, 0.55)
        out *= K.grain(rng, n, 0.03)
    elif piece == 'Soles':
        out[:] = _rgb('sole')
        toe = zone == 1
        out[toe] = _rgb('skin')
        # the sole: woven (a fine herringbone on its top), its edge a darker band; the toes' nails
        sole = ~toe
        weave = band(((x * np.sign(x) * 0.7 + y) / 0.006) % 1.0 - 0.5, 0.12, 0.08) * (N[:, 2] > 0.7)
        mix(weave * sole, ink, 0.18)
        side = np.abs(N[:, 2]) < 0.5
        mix(side * sole, _rgb('strap'), 0.45)
        mix(side * sole * band(z - SOLE_TOP * 0.5, 0.0009, 0.0006), ink, 0.4)
        nail = toe * (N[:, 2] > 0.55) * (N[:, 1] < -0.1)
        mix(nail, np.array([0.93, 0.78, 0.68]), 0.55)
        out *= K.grain(rng, n, 0.03)
    elif piece == 'Hood':
        out[:] = _rgb('robe')
        rim = zone == 1
        bag = ~rim
        # the bag's seam down its middle and its stitched edge; the rim's stitching along its roll
        mix(bag * band(x, 0.0011, 0.0007), ink, 0.45)
        mix(bag * band(np.abs(x) - (0.135 * np.clip((z - HOOD_TIP) / (EDGE['hoodTop'] - HOOD_TIP), 0, 1) ** 0.62 - 0.006), 0.0009, 0.0006), ink, 0.25)
        out *= K.grain(rng, n, 0.03)
    return np.clip(out, 0, 1)

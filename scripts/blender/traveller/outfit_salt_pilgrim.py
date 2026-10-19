"""The salt pilgrim (issue #545): the traveller's sixth outfit, from
references/characters/traveller-outfits/salt-pilgrim/sheet-1.jpg (front, side, back) and sheet-2.jpg.

A long sleeveless white over-robe, open down the front, to under the knee, slit at the sides, its hood lying
on his back, edged with a stitched border of turquoise and terracotta triangles; under it a saffron wrapped
tunic with full sleeves gathered at the wrists, a rose sash knotted at his left hip with its ends hanging;
cream trousers full to the shin and gathered above the ankle; woven sandals laced up over his bare feet.

The robe cannot be a live cloth in the game, so it is a drape: its body cut from the base body's cage and
grown out; its skirt hung from the cut's hem as rings flaring to the hem, with folds (fuller toward the hem
and the back), slits left open below the thigh at the sides and up the back, so each of its four panels
follows its own leg. It is skinned to the pelvis and the thighs with
smooth weights (more to each thigh at the front, where the leg pushes; shared at the back), so it swings with
the run; outfit.py's checks measure how far his trousers come through it at full stride. The tunic's skirt is
built the same way, shorter, open at the front where it wraps. The sandals are a piece of their own: his
foot in his skin's colour (the base body's foot is hidden under it), a sole under it, the straps and laces
painted. The robe's border stands proud round its hem and down its front edges (RELIEF); the shared
painter (inkpaint.py) shades it all, with the trousers' long folds and the sleeves' at the elbows.

Palette: picked from sheet-1 (median of small boxes on the robe, the tunic, the sleeve, the sash, the
trousers, the sandals); the border's turquoise and terracotta from the sheet's stitching."""
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

PAL = {
    'robe': (238, 228, 210), 'saffron': (222, 152, 74), 'rose': (190, 108, 90), 'cream': (226, 208, 182),
    'turquoise': (86, 166, 168), 'terracotta': (196, 104, 70), 'skin': (201, 134, 94), 'sandal': (142, 100, 66),
    'sole': (176, 140, 96), 'ink': (40, 34, 30),
}
PIECES = {
    # (the trousers one subdivision level fewer: under the tunic and the robe all but their shins, and the
    # outfit within the default's triangles)
    'PilgrimTrousers': dict(layer=1, outside=[], covers=['Tunic', 'Sandals'], hem=0.02, levels=1, gap=0.005),
    'Sandals': dict(layer=1, outside=[], covers=[], hem=0.01, levels=1, gap=0.002),
    'Tunic': dict(layer=2, outside=['PilgrimTrousers'], covers=['Robe', 'Sash'], hem=0.02, levels=2, gap=0.005),
    'Sash': dict(layer=3, outside=['Tunic'], covers=[], hem=0.01, levels=1, gap=0.003),
    # (the robe fitted over the tunic and the trousers, only checked against the sash: fitted over its knot
    # and ends, which hang in the robe's opening, it bent its front edges in front of them)
    'Robe': dict(layer=4, outside=['Tunic', 'PilgrimTrousers'], checks=['Sash'], covers=[], hem=0.025, levels=2, gap=0.006),
}
BOOTS = None          # his feet bare in sandals: the Sandals piece
ZONES = {'PilgrimTrousers': ['cream', 'cream'], 'Sandals': ['skin', 'sole'], 'Tunic': ['saffron', 'saffron'],
         'Sash': ['rose', 'rose'], 'Robe': ['robe']}
PART = G.PART
EDGE = {}
ROBE_HEM = 0.40       # under the knee (the sheet: a hand under it)
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


def sandals(cage, J):
    """His foot, a breath over the base body's (painted in his skin's colour, the straps on it), and a sole
    under each: a rounded slab the foot stands in."""
    bm = G.cut(cage, lambda v, p: p == PART['foot'] or (p == PART['leg'] and v.co.z <= 0.18))
    G.inflate(bm, lambda p, part: 0.003)
    _orient(bm)
    for side in (-1, 1):
        fv = [v.co for v in cage.verts if v[cage.verts.layers.int.get('part')] == PART['foot'] and v.co.x * side > 0]
        y0, y1 = min(p.y for p in fv), max(p.y for p in fv)
        x0, x1 = min(p.x for p in fv), max(p.x for p in fv)
        ctr = ((x0 + x1) / 2, (y0 + y1) / 2 - 0.004, 0.009)
        K.box(bm, ctr, (x1 - x0 + 0.004, y1 - y0 + 0.008, 0.014), None, bevel=0.010, mat=1, part=PART['foot'])
    return bm


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
    folds, slit at the sides and up the back (each panel then follows its own leg); the hood a soft lump lying between his shoulders."""
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
    # the hood: a soft lump lying on his back between the shoulder blades, its point down
    r = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=1.0)
    hood = r['verts']
    for v in hood:
        x, y, z = v.co
        v.co = Vector((x * 0.105 * (1 - 0.35 * max(0.0, -z)), 0.130 + y * 0.032 + 0.02 * (1 - z * z), 1.345 + z * 0.085 - 0.03 * max(0.0, -z)))
    pl = bm.verts.layers.int.get('part')
    for v in hood:
        v[pl] = PART['torso']
    hf = list({f for v in hood for f in v.link_faces})
    for f in hf:
        f.material_index = 0
    _orient(bm)
    bmesh.ops.recalc_face_normals(bm, faces=hf)
    EDGE['hem'] = ROBE_HEM
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


def reweight(name, ob, arm, J):
    if name == 'Robe':
        R.set_weights(ob, _skirt_weights(ob, K.weights_of(ob)))
    elif name == 'Tunic':
        # (its skirt ends at mid-thigh: all but held to each thigh, as the robe's panel over it nearly is)
        R.set_weights(ob, _skirt_weights(ob, K.weights_of(ob), front_k=0.0, k_max=1.0))
    elif name == 'Sash':
        R.set_weights(ob, K.copy_weights(ob, bpy.data.objects['Tunic']))
        R.set_weights(ob, K.rigid_islands(ob, skip_mats=(0,)))      # the knot and its ends: as one
    elif name == 'Sandals':
        R.set_weights(ob, K.rigid_islands(ob, skip_mats=(0,)))


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


RELIEF = {'Robe': [_robe_relief]}


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
         'Tunic': dict(folds=_folds('Tunic'), fold_ink=0.6), 'Robe': dict(tone=0.26), 'Sandals': dict(hatch=0.2),
         'Sash': dict(tone=0.24, hatch=0.4)}

# his skin piece under the full sleeves (B3's forearms) left out, as the glider pilot's; his hands show
SKIN_CUT = [{'absx': [0.20, 0.62], 'z': [1.15, 1.60]}]
# the hips and thighs as the other outfits; the ankles under the sandals' feet (measured under 97 %: the feet stand
# 3 mm off the body's, whose ankles would show through in patches)
EXTRA_HIDES = ['hips', 'thigh.L', 'thigh.R', 'ankle.L', 'ankle.R']

BUILDERS = {'PilgrimTrousers': trousers, 'Sandals': sandals, 'Tunic': tunic, 'Sash': sash, 'Robe': robe}


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
        hood = (y > 0.09) & (z > 1.24) & (ax < 0.12) & (N[:, 1] > 0.2)
        for t, s, on in ((de, z, (y < 0.02) & (de < W) & ~hood), (dh, th * 0.25, (dh < W) & ~hood)):
            tri, up = _border(s, t, W)
            mix(on * tri * up, _rgb('turquoise'))
            mix(on * tri * ~up, _rgb('terracotta'))
            mix(on * band(t - W * 0.12, 0.0013, 0.0008), ink, 0.6)
            mix(on * band(t - W * 0.88, 0.0013, 0.0008), ink, 0.6)
        # the hood's edge, stitched, and its seam down the middle
        mix(hood * band(x, 0.0012, 0.0008), ink, 0.35)
        out *= K.grain(rng, n, 0.04)
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
        sole = zone == 1
        out[sole] = _rgb('sole')
        # the straps: a toe loop, two bands over the instep, laces crossing up round the ankle
        foot = ~sole
        cx = np.sign(x) * 0.133
        u = (x - cx) * np.sign(x)                      # across the foot, + outside
        strap = np.zeros(n)
        strap = np.maximum(strap, band(y + 0.110, 0.006, 0.002) * (z < 0.06))          # over the toes
        strap = np.maximum(strap, band(y + 0.040 + 0.25 * u, 0.007, 0.002) * (z < 0.11))  # instep, crossed
        strap = np.maximum(strap, band(y + 0.040 - 0.25 * u, 0.007, 0.002) * (z < 0.11))
        lace = band(((z - 0.10) / 0.028 + np.arctan2(y - 0.03, u) / np.pi) % 1.0 - 0.5, 0.06, 0.03) * (z > 0.10) * (z < 0.18)
        strap = np.maximum(strap, lace)
        mix(strap * foot, _rgb('sandal'))
        mix(band(strap - 0.5, 0.15, 0.1) * foot, ink, 0.4)
        # toes: a few lines
        mix(band(((u + 0.05) / 0.018) % 1.0 - 0.5, 0.05, 0.04) * (y < -0.115) * (z < 0.05) * foot, ink, 0.35)
        out[sole] = out[sole] * (0.9 + 0.1 * (N[sole, 2] > 0.5))[:, None]
    return np.clip(out, 0, 1)

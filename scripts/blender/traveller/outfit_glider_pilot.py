"""The glider pilot (issue #540): the traveller's second outfit, from
references/characters/traveller-outfits/glider-pilot/sheet-1.jpg (front, side, back) and sheet-2.jpg.

A cropped mustard flight jacket (a cream fleece collar, ribbed olive cuffs and waistband, two patch pockets,
a leather strap across the chest and the back, a sky-blue roundel between the shoulders), olive jodhpurs
full at the thigh and tight below the knee, cream puttees wound round the shins, brown lace-up boots.

Each piece is cut from the base body's quad cage (garments.cut: the cage's rings, so its loops sit at the
elbows and knees), grown out from it, given its collar, cuffs and bands, subdivided, then fitted outside
what lies under it (outfit.py). The boots are his own (B3's laced boots) in brown. The paint is a function
of the rest-pose surface (outfit.py bakes each texel's position and normal; paint() colours them).

Palette: picked from sheet-1 (median of small boxes on the jacket, the jodhpurs, the puttees, the boots, the
fleece, the roundel), evened out where the sheet's shading moved them."""
import math
import bmesh
import numpy as np
from mathutils import Vector
import garments as G
import tailor as T
import inkpaint as IP
from loft import smoothstep

ID = 'glider-pilot'
NAME = 'Glider pilot'
SHEET = 'references/characters/traveller-outfits/glider-pilot/sheet-1.jpg'

PAL = {
    'mustard': (222, 172, 82), 'rib': (104, 106, 62), 'fleece': (234, 221, 194), 'olive': (128, 126, 80),
    'puttee': (226, 208, 170), 'leather': (116, 74, 42), 'roundel': (146, 184, 192), 'ink': (44, 36, 30),
    'brass': (196, 160, 84), 'boot': (124, 86, 52),
}
# pieces: name -> layer (1 next to the skin, 2 over that), what it is fitted outside of (besides the body and
# his skin), the garments over it (its edges under them get a lip, not a band), the hem band's width, the
# subdivision levels, and the gap it keeps over what is under it
PIECES = {
    'Jodhpurs': dict(layer=1, outside=[], covers=['Jacket', 'Puttees'], hem=0.025, levels=2, gap=0.005),
    # (#544: one level, its rings cut every 6 mm for the wound turns instead: _puttee_relief)
    'Puttees': dict(layer=2, outside=['Jodhpurs'], covers=['PilotBoots'], hem=0.015, levels=1, gap=0.004),
    'Jacket': dict(layer=2, outside=['Jodhpurs'], covers=[], hem=0.03, levels=2, gap=0.007),
}
BOOTS = 'PilotBoots'   # B3's boots (the default's 'Boots'), brown
ZONES = {'Jacket': ['mustard', 'rib', 'fleece'], 'Jodhpurs': ['olive'], 'Puttees': ['puttee'], BOOTS: ['boot']}
PART = G.PART


def _orient(bm):
    """Faces turned out: consistent, then the whole flipped if most face against the cage's normals."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    score = 0.0
    for f in bm.faces:
        n = sum((G.normal(bm, v) for v in f.verts), Vector())
        score += f.normal.dot(n)
    if score < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)


def jodhpurs(cage, J):
    """Full at the thigh (out to the side most), close from the knee down; the waist at the hip bones, the
    cuff just under the knee (under the puttees)."""
    bm = G.cut(cage, lambda v, p: (p == PART['torso'] and v.co.z <= 1.09) or (p == PART['leg'] and v.co.z >= 0.395))
    pl = bm.verts.layers.int.get('part')
    for v in bm.verts:
        p = v.co
        n = G.normal(bm, v)
        # (#544) the sheet's flare: widest a hand over the knee, mostly out to the side, gathered in sharply
        # to the band under the knee
        puff = smoothstep(0.475, 0.585, p.z) * smoothstep(0.96, 0.64, p.z)
        side = Vector((math.copysign(1.0, p.x) if abs(p.x) > 1e-4 else 0.0, 0, 0))
        off = 0.010 + 0.004 * smoothstep(0.80, 1.0, p.z) + 0.026 * puff
        lat = 0.050 * puff * max(0.0, n.dot(side)) ** 0.8 if v[pl] == PART['leg'] else 0.0
        v.co = p + n * off + side * lat
    for v in bm.verts:     # the seat hangs a little
        if abs(v.co.x) < 0.03 and v.co.z < 0.9:
            v.co.z -= 0.02 * (1 - abs(v.co.x) / 0.03)
    _orient(bm)
    return bm


def puttees(cage, J):
    """Wound cloth from inside the boot's top to just under the knee, over the jodhpurs' cuff."""
    bm = G.cut(cage, lambda v, p: p == PART['leg'] and 0.165 <= v.co.z <= 0.47)
    G.inflate(bm, lambda p, part: 0.012 + 0.010 * smoothstep(0.36, 0.45, p.z))
    _orient(bm)
    return bm


def jacket(cage, J):
    """Cropped at the hip bones on a ribbed band, long sleeves to ribbed cuffs, closed by a zip, a fleece
    collar standing at the neck and lying over onto the shoulders."""
    bm = G.cut(cage, lambda v, p: (p == PART['torso'] and v.co.z >= 1.005) or p == PART['arm'])
    TURN = bm.faces.layers.int.new('turn')

    def off(p, part):
        # (#544) the shoulders' cap thinner: a full cap spread out broad when the arms came down
        if part == PART['arm']:
            t = G.arm_t(p, J)
            return (0.026 + 0.012 * smoothstep(0.15, 0.55, t) - 0.016 * smoothstep(0.66, 0.84, t)
                    - 0.010 * smoothstep(0.22, 0.0, t))
        return (0.026 + 0.016 * smoothstep(1.24, 1.08, p.z) * smoothstep(1.00, 1.06, p.z)
                - 0.008 * smoothstep(1.06, 1.01, p.z) - 0.008 * smoothstep(1.30, 1.40, p.z) * smoothstep(0.08, 0.15, abs(p.x)))
    G.inflate(bm, off)
    for f in bm.faces:
        c = f.calc_center_median()
        if (abs(c.x) > 0.25 and G.arm_t(c, J) > 0.80):
            f.material_index = 1      # the cuffs
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z > 1.40 and abs(c.x) < 0.1:      # the neck: the fleece collar
            out = G.radial((0.0, c.y))
            # (#544) wider and fuller, as the sheet's: it lies well out over the shoulders and down the front,
            # on them (its outer ring set down onto the jacket under it, 1.4 cm over it: the pile's thickness)
            from mathutils.bvhtree import BVHTree
            under = BVHTree.FromBMesh(bm)
            stand = G.extrude(bm, loop, lambda p, v: p + Vector((0, 0, 0.024)) + out(p) * 0.012)
            fold = G.extrude(bm, stand, lambda p, v: p + out(p) * 0.030 + Vector((0, 0, 0.006)))
            lie = G.extrude(bm, fold, lambda p, v: p + out(p) * 0.034 - Vector((0, 0, 0.050)))
            for v in lie:
                q, nq = under.find_nearest(v.co)[:2]
                if q is not None:
                    v.co = q + nq * 0.014
            for f_, s_, l_ in zip(fold, stand, lie):      # the fold rolled over between the stand and it
                f_.co = (s_.co + l_.co) / 2 + (f_.co - (s_.co + l_.co) / 2).normalized() * 0.022
            ring = set(loop) | set(stand) | set(fold) | set(lie)
            for f in bm.faces:
                if all(v in ring for v in f.verts):
                    f.material_index = 2
                    f[TURN] = int(not all(v in set(loop) | set(stand) for v in f.verts))   # turned over
        elif c.z < 1.1:                         # the waistband: a rib gathered in round the hips
            ax = Vector((0.0, c.y, 0.0))
            r1 = G.extrude(bm, loop, lambda p, v: p - (p - Vector((ax.x, ax.y, p.z))).normalized() * 0.006 - Vector((0, 0, 0.022)))
            G.extrude(bm, r1, lambda p, v: p - (p - Vector((ax.x, ax.y, p.z))).normalized() * 0.002 - Vector((0, 0, 0.020)))
            for f in bm.faces:
                if f.calc_center_median().z < 1.012 and abs(f.calc_center_median().x) < 0.25:
                    f.material_index = 1
        else:                                   # a sleeve's end: a short cuff on past the wrist ring
            G.extrude(bm, loop, lambda p, v: p + Vector((math.copysign(0.014, p.x), 0, 0)) - (p - Vector((p.x, c.y, c.z))).normalized() * 0.002)
            for f in bm.faces:
                if abs(f.calc_center_median().x) > 0.6:
                    f.material_index = 1
    _orient(bm)
    # the collar's fold and the part lying on the shoulders show the stand's other side: turned to face out
    TURN = bm.faces.layers.int['turn']
    bmesh.ops.reverse_faces(bm, faces=[f for f in bm.faces if f[TURN]])
    return bm


# his skin piece (B3's forearms and ankles) under the outfit's sleeves and puttees is left out, so it cannot
# come through them: boxes in Blender's rest frame (x mirrored: |x|), the triangles all inside one go
SKIN_CUT = [{'absx': [0.20, 0.64], 'z': [1.15, 1.60]}, {'absx': [0.0, 0.40], 'z': [-1.0, 0.45]}, {'absx': [0.0, 0.20], 'z': [0.70, 1.15]}]

# body areas left out besides the measured ones (garments.hidden_areas wants 97 % of an area under a piece):
# the chest's top reaches up under the collar and the hips' under the jacket's band and the jodhpurs' seat,
# both covered by two pieces together, neither alone; the drawn-in body came out at the crotch otherwise.
# The thighs too on the pass-4 base (#493): measured under 97 %, every miss a vert at the crotch whose ray
# goes down between the legs (pass 3's base had them measured)
EXTRA_HIDES = ['chest', 'hips', 'thigh.L', 'thigh.R']

BUILDERS = {'Jodhpurs': jodhpurs, 'Puttees': puttees, 'Jacket': jacket}


# ------------------------------------------------------------------ the volume (#544, tailor.py)
# The sheet's pieces that stand off the cloth, as geometry: the pockets and their flaps, the chest strap, the
# back strap and its buckle, the sleeve's pocket, the belt, the harness straps down the thighs; the fleece's
# pile; the puttees' turns. The paint draws on the same shapes (paint() reads them from here).

POCKETS = [(sx * 0.085, 1.15) for sx in (-1, 1)]     # centres (x, z); 5.5 cm by 6 cm, a flap over the top
POCKET = (0.055, 0.060)
CHEST_STRAP = ((-0.11, 1.43), (0.14, 1.03), 0.017)   # from his right shoulder to his left hip (x, z), half width
BACK_STRAP = (1.20, 0.19, 0.016)                     # z, half length, half width
SLEEVE_POCKET = (0.30, 0.050, 0.030, 0.026)          # on his left upper arm's outside (on top, in the rest pose)
BELT = (0.948, 0.012)                                # z, half width
HARNESS = [((sx * 0.075, 0.94), (sx * 0.165, 0.77), -1) for sx in (-1, 1)] + \
          [((sx * 0.070, 0.94), (sx * 0.160, 0.79), 1) for sx in (-1, 1)]     # (top, bottom, -1 front / 1 back)
PUTTEE = dict(pitch=0.046, z0=0.172, z1=0.462, starts=2)   # (two starts: the turns' edges slant as the sheet's)


def _leg_axis(x, z, J):
    zs = [J['foot_l'].z, J['calf_l'].z, J['thigh_l'].z]
    cx = np.where(x > 0, 1, -1) * np.interp(z, zs, [J['foot_l'].x, J['calf_l'].x, J['thigh_l'].x])
    cy = np.interp(z, zs, [J['foot_l'].y, J['calf_l'].y, J['thigh_l'].y])
    return cx, cy


def _jacket_relief(ob, J):
    rep = {}
    for i, (cx, cz) in enumerate(POCKETS):
        rep[f'pocket{i}'] = T.raised(T.rect((cx, 0, cz), (1, 0, 0), (0, 0, 1), *POCKET), height=0.0035,
                                     facing=(0, -1, 0))(ob, J)
        rep[f'flap{i}'] = T.raised(T.rect((cx, 0, cz + 0.040), (1, 0, 0), (0, 0, 1), POCKET[0] + 0.003, 0.022),
                                   height=0.0025, facing=(0, -1, 0))(ob, J)
    (ax, az), (bx, bz), w = CHEST_STRAP
    rep['strap'] = T.raised(T.strap((ax, 0, az), (bx, 0, bz), (0, -1, 0), w), height=0.003, facing=(0, -1, 0),
                            where=lambda P: (np.abs(P[:, 0]) < 0.235) * 1.0)(ob, J)
    z, hl, hw = BACK_STRAP
    rep['backStrap'] = T.raised(T.rect((0, 0, z), (1, 0, 0), (0, 0, 1), hl, hw), height=0.003, facing=(0, 1, 0))(ob, J)
    x, y, hu, hv = SLEEVE_POCKET
    rep['sleevePocket'] = T.raised(T.rect((x, y, 0), (1, 0, 0), (0, 1, 0), hu, hv), height=0.003, facing=(0, 0, 1),
                                   where=lambda P: (P[:, 0] > 0.2) * 1.0)(ob, J)
    rep['fleece'] = T.fleece(mat=2, amp=0.0035, thick=0.0035, scale=0.022)(ob, J)
    return rep


def _jodhpur_relief(ob, J):
    rep = {}
    z, w = BELT
    rep['belt'] = T.raised(T.ring((0, 0, z), (0, 0, 1), w), height=0.0028)(ob, J)
    rep['buckle'] = T.raised(T.rect((0, 0, z), (1, 0, 0), (0, 0, 1), 0.020, 0.016), height=0.002, facing=(0, -1, 0))(ob, J)
    for i, ((ax, az), (bx, bz), side) in enumerate(HARNESS):
        rep[f'harness{i}'] = T.raised(T.strap((ax, 0, az), (bx, 0, bz), (0, side, 0), 0.0085), height=0.0025,
                                      facing=(math.copysign(0.5, ax), side * 0.85, 0),
                                      where=lambda P, s=math.copysign(1, ax): (P[:, 0] * s > 0) * 1.0)(ob, J)
    return rep


def _puttee_relief(ob, J):
    return T.wound(lambda x, z: _leg_axis(x, z, J), PUTTEE['z0'], PUTTEE['z1'], pitch=PUTTEE['pitch'], depth=0.0035,
                   ring_step=0.006, starts=2)(ob, J)


RELIEF = {'Jacket': [_jacket_relief], 'Jodhpurs': [_jodhpur_relief], 'Puttees': [_puttee_relief]}


# ------------------------------------------------------------------ the paint

def _band(d, w, aa):
    """1 inside |d| < w, soft over aa."""
    return np.clip((w - np.abs(d)) / aa + 0.5, 0, 1)


def _rgb(name):
    return np.array(PAL[name], dtype=float) / 255


def paint(piece, zone, P, N, J):
    """sRGB colour (n, 3) of texels at rest positions P (n, 3) with normals N, of `piece`, in `zone` (n,)
    (the material index: for the jacket 0 shell, 1 rib, 2 fleece)."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    ax = np.abs(x)
    n = len(P)
    rng = np.random.default_rng(540)
    out = np.zeros((n, 3))
    ink = _rgb('ink')

    def mix(mask, colour, k=1.0):
        nonlocal out
        a = (np.clip(mask, 0, 1) * k)[:, None]
        out = out * (1 - a) + np.asarray(colour)[None, :] * a

    front = np.clip(-N[:, 1] * 2.5, 0, 1)
    back = np.clip(N[:, 1] * 2.5, 0, 1)
    if piece == 'Jacket':
        out[:] = _rgb('mustard')
        rib = zone == 1
        fleece = zone == 2
        # the rib: dark lines across the band (along the arm on the cuffs)
        ang = np.arctan2(y - 0.01, x)
        r_t = np.where(ax > 0.25, np.sin(np.arctan2(z - 1.36, y - 0.05) * 18), np.sin(ang * 70))
        out[rib] = _rgb('rib') * (0.92 + 0.08 * r_t[rib, None])
        # the fleece: cream, curled: small dark curls and light tips (#544: on a pile in geometry)
        sp = rng.random(n)
        k = np.array([[61.0, 23.0, -40.0], [-17.0, 55.0, 37.0], [29.0, -48.0, 66.0]]) * 5
        curl = (np.sin(P @ k[0]) + np.sin(P @ k[1] + 1.1) + np.sin(P @ k[2] + 2.3)) / 3
        fl = _rgb('fleece') * (1 - 0.10 * _band(curl - 0.35, 0.05, 0.06) - 0.05 * (sp > 0.85))[:, None] \
            * (1 + 0.04 * np.clip(curl, 0, 1))[:, None]
        out[fleece] = fl[fleece]
        shell = ~rib & ~fleece
        torso = shell & (ax < 0.24)
        # the zip: a dark line down the front, a lighter tape either side
        zip_ = torso * front * (z > 1.0) * (z < 1.47)
        mix(_band(x, 0.007, 0.002) * zip_, _rgb('rib') * 1.1, 0.8)
        mix(_band(x, 0.0016, 0.001) * zip_, ink)
        # two patch pockets low on the chest (raised, _jacket_relief), each with a flap and a button
        for cx, cz in POCKETS:
            box = np.maximum(np.abs(x - cx) / POCKET[0], np.abs(z - cz) / POCKET[1])
            mix(_band(box - 1, 0.025, 0.015) * torso * front, ink, 0.85)
            flap = (np.abs(x - cx) < POCKET[0] + 0.003) * _band(z - (cz + 0.018), 0.0018, 0.0015) * torso * front
            mix(flap, ink, 0.8)
            mix(_band(np.abs(z - (cz + 0.010)) - 0.002, 0.0012, 0.001) * (np.abs(x - cx) < POCKET[0] - 0.006) * torso * front, ink, 0.3)
            mix(_band(np.hypot(x - cx, z - (cz + 0.030)), 0.006, 0.002) * torso * front, _rgb('brass'))
        # the sleeve's pocket on his left upper arm (on top of it in the rest pose)
        sx_, sy_, su, sv = SLEEVE_POCKET
        up = np.clip(N[:, 2] * 2.5, 0, 1) * (x > 0.2) * shell
        sbox = np.maximum(np.abs(x - sx_) / su, np.abs(y - sy_) / sv)
        mix(_band(sbox - 1, 0.03, 0.02) * up, ink, 0.85)
        mix((np.abs(y - sy_) < sv) * _band(x - (sx_ - su * 0.45), 0.0016, 0.0012) * up, ink, 0.7)
        # the strap: from his right shoulder across the chest to the left hip, and across the back
        a, b = np.array([-0.11, 1.43]), np.array([0.14, 1.03])
        d = b - a
        t = np.clip(((x - a[0]) * d[0] + (z - a[1]) * d[1]) / d.dot(d), 0, 1)
        dist = np.hypot(x - (a[0] + t * d[0]), z - (a[1] + t * d[1]))
        strap = _band(dist, 0.017, 0.002) * shell * np.clip(-N[:, 1] * 3 + 0.4, 0, 1) * (ax < 0.24)
        mix(strap, _rgb('leather'))
        mix(_band(dist - 0.017, 0.0015, 0.001) * shell * (ax < 0.24) * np.clip(-N[:, 1] * 3 + 0.4, 0, 1), ink, 0.8)
        bz = 1.20
        bstrap = _band(z - bz, 0.016, 0.002) * shell * back * (ax < 0.19)
        mix(bstrap, _rgb('leather'))
        mix(_band(np.abs(z - bz) - 0.016, 0.0015, 0.001) * shell * back * (ax < 0.19), ink, 0.8)
        buckle = np.maximum(np.abs(x) / 0.022, np.abs(z - bz) / 0.022)
        mix(_band(buckle - 1, 0.12, 0.08) * shell * back, _rgb('brass'))
        # the roundel between the shoulders
        r = np.hypot(x, z - 1.31)
        disc = shell * back * (r < 0.095)
        mix(_band(r, 0.088, 0.003) * disc, _rgb('roundel'))
        mix(_band(r - 0.088, 0.0022, 0.0015) * shell * back, ink, 0.8)
        # seams: the shoulder seam and the sleeve's join
        mix(_band(ax - 0.215, 0.0014, 0.001) * shell * (z > 1.30), ink, 0.45)
        # the sheet's pen grain: a light mottle
        out *= (0.97 + 0.05 * rng.random((n, 1)))
    elif piece == 'Jodhpurs':
        out[:] = _rgb('olive')
        mix(_band(x, 0.0016, 0.001) * front * (z > 0.87) * (z < 1.06), ink, 0.7)          # the fly
        bz, bw = BELT                                                                      # the belt (raised)
        mix(_band(z - bz, bw, 0.002), _rgb('leather'))
        mix(_band(np.abs(z - bz) - bw, 0.0012, 0.0008), ink, 0.8)
        buckle = np.maximum(np.abs(x) / 0.020, np.abs(z - bz) / 0.016)
        mix(_band(buckle - 0.85, 0.15, 0.08) * front, _rgb('brass'))
        # the harness straps down the thighs, each to a small buckle
        for (ax_, az_), (bx_, bz_), side in HARNESS:
            a, b = np.array([ax_, az_]), np.array([bx_, bz_])
            d = b - a
            t = np.clip(((x - a[0]) * d[0] + (z - a[1]) * d[1]) / d.dot(d), 0, 1)
            dist = np.hypot(x - (a[0] + t * d[0]), z - (a[1] + t * d[1]))
            face = np.clip(N[:, 1] * side * 2.5 + np.sign(ax_) * N[:, 0], 0, 1) * (x * ax_ > 0)
            mix(_band(dist, 0.0085, 0.0015) * face, _rgb('leather'))
            mix(_band(dist - 0.0085, 0.0011, 0.0008) * face, ink, 0.8)
            mix(_band(np.hypot(x - b[0], z - b[1]) - 0.009, 0.0025, 0.0015) * face, _rgb('brass'))
        for sx in (-1, 1):                                                                 # back pockets' flaps
            mix((np.abs(x - sx * 0.07) < 0.045) * _band(z - 0.96, 0.0016, 0.001) * back, ink, 0.6)
        out *= (0.97 + 0.05 * rng.random((n, 1)))
    elif piece == 'Puttees':
        out[:] = _rgb('puttee')
        cx, cy = _leg_axis(x, z, J)
        ang = np.arctan2(y - cy, (x - cx) * np.sign(x + 1e-9))
        w = (z / PUTTEE['pitch'] + PUTTEE['starts'] * ang / (2 * np.pi)) % 1.0     # the spiral of _puttee_relief's turns
        edge = np.minimum(w, 1 - w) * PUTTEE['pitch']           # metres from a turn's lower edge
        mix(_band(edge, 0.0012, 0.0009), ink, 0.75)
        out *= (0.86 + 0.14 * np.clip(w * 1.3, 0, 1))[:, None]  # each turn shaded where the next lies over it
        mix(_band(edge - 0.004, 0.0007, 0.0006) * (w < 0.5), ink, 0.25)
    return np.clip(out, 0, 1)


def _folds(piece):
    def f(P, N, zone, J):
        z = P[:, 2]
        ax = np.abs(P[:, 0])
        if piece == 'Jacket':
            (A, B), st = IP.elbow_folds(J, n=4)
            ink, shd = IP.limb_strokes(P, A, B, st)
            arm = T.smooth01(0.30, 0.34, ax) * (zone == 0)
            return [(ink * arm, shd * arm)]
        if piece == 'Jodhpurs':
            dr = IP.drapes(P, J, angles=(-0.5, 0.35, 2.6), t_range=(0.10, 0.92), bow=0.35)
            (A, B), st = IP.knee_folds(J, n=2)
            ink, shd = IP.limb_strokes(P, A, B, st)
            leg = (z < 0.88) * 1.0
            return [(dr[0] * leg, dr[1] * leg), (ink * leg, shd * leg)]
        return []
    return f


# the shared painter's options per piece (inkpaint.DEFAULT; folds: pen strokes where the cloth gathers)
SHADE = {'Jacket': dict(folds=_folds('Jacket'), fold_ink=0.6), 'Jodhpurs': dict(folds=_folds('Jodhpurs'), tone=0.18, ao=0.3, cavity=0.1, hatch=0.45, hatch_from=0.45),
         'Puttees': dict(cavity=0.6, hatch=0.5)}

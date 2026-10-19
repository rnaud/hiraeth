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
    'Puttees': dict(layer=2, outside=['Jodhpurs'], covers=['PilotBoots'], hem=0.015, levels=2, gap=0.004),
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
        puff = smoothstep(0.47, 0.60, p.z) * smoothstep(0.90, 0.72, p.z)
        side = Vector((math.copysign(1.0, p.x) if abs(p.x) > 1e-4 else 0.0, 0, 0))
        off = 0.010 + 0.004 * smoothstep(0.80, 1.0, p.z) + 0.013 * puff
        lat = 0.026 * puff * max(0.0, n.dot(side)) ** 0.7 if v[pl] == PART['leg'] else 0.0
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
        if part == PART['arm']:
            t = G.arm_t(p, J)
            return 0.026 + 0.012 * smoothstep(0.15, 0.55, t) - 0.016 * smoothstep(0.66, 0.84, t)
        return (0.026 + 0.016 * smoothstep(1.24, 1.08, p.z) * smoothstep(1.00, 1.06, p.z)
                - 0.008 * smoothstep(1.06, 1.01, p.z) + 0.006 * smoothstep(1.32, 1.42, p.z) * smoothstep(0.05, 0.12, abs(p.x)))
    G.inflate(bm, off)
    for f in bm.faces:
        c = f.calc_center_median()
        if (abs(c.x) > 0.25 and G.arm_t(c, J) > 0.80):
            f.material_index = 1      # the cuffs
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z > 1.40 and abs(c.x) < 0.1:      # the neck: the fleece collar
            out = G.radial((0.0, c.y))
            stand = G.extrude(bm, loop, lambda p, v: p + Vector((0, 0, 0.026)) + out(p) * 0.010)
            fold = G.extrude(bm, stand, lambda p, v: p + out(p) * 0.024 + Vector((0, 0, 0.004)))
            lie = G.extrude(bm, fold, lambda p, v: p + out(p) * 0.020 - Vector((0, 0, 0.036)))
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
# both covered by two pieces together, neither alone; the drawn-in body came out at the crotch otherwise
EXTRA_HIDES = ['chest', 'hips']

BUILDERS = {'Jodhpurs': jodhpurs, 'Puttees': puttees, 'Jacket': jacket}


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
        # the fleece: cream, curled (a soft dark speckle)
        sp = rng.random(n)
        out[fleece] = _rgb('fleece') * (1 - 0.10 * (sp[fleece, None] > 0.82))
        shell = ~rib & ~fleece
        torso = shell & (ax < 0.24)
        # the zip: a dark line down the front, a lighter tape either side
        zip_ = torso * front * (z > 1.0) * (z < 1.47)
        mix(_band(x, 0.007, 0.002) * zip_, _rgb('rib') * 1.1, 0.8)
        mix(_band(x, 0.0016, 0.001) * zip_, ink)
        # two patch pockets low on the chest, each with a flap and a button
        for sx in (-1, 1):
            cx, cz = sx * 0.085, 1.15
            box = np.maximum(np.abs(x - cx) / 0.055, np.abs(z - cz) / 0.060)
            outline = _band(box - 1, 0.035, 0.02) * torso * front
            mix(outline, ink, 0.85)
            flap = (np.abs(x - cx) < 0.055) * _band(z - (cz + 0.035), 0.0018, 0.0015) * torso * front
            mix(flap, ink, 0.8)
            mix(_band(np.hypot(x - cx, z - (cz + 0.025)), 0.006, 0.002) * torso * front, _rgb('brass'))
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
        mix(_band(z - 1.035, 0.012, 0.002), _rgb('leather'))                               # the belt (under the band)
        for sx in (-1, 1):                                                                 # back pockets' flaps
            mix((np.abs(x - sx * 0.07) < 0.045) * _band(z - 0.96, 0.0016, 0.001) * back, ink, 0.6)
        out *= (0.97 + 0.05 * rng.random((n, 1)))
    elif piece == 'Puttees':
        out[:] = _rgb('puttee')
        cx = np.where(x > 0, 1, -1) * np.interp(z, [J['foot_l'].z, J['calf_l'].z], [J['foot_l'].x, J['calf_l'].x])
        cy = np.interp(z, [J['foot_l'].z, J['calf_l'].z], [J['foot_l'].y, J['calf_l'].y])
        ang = np.arctan2(y - cy, (x - cx) * np.sign(x + 1e-9))
        w = (z / 0.034 + ang / (2 * np.pi)) % 1.0      # a spiral: one turn every 3.4 cm
        mix(_band(w - 0.5, 0.035, 0.02), ink, 0.55)
        out *= (0.88 + 0.12 * w)[:, None]               # each turn a little shaded under the next
    return np.clip(out, 0, 1)

"""The pearl diver (issue #545): the traveller's fourth outfit, from
references/characters/traveller-outfits/pearl-diver/sheet-1.jpg (front, side, back) and sheet-2.jpg.

A fitted sea-blue diving suit, short sleeves to above the elbow and legs to just under the knee, each ended
in a dark rolled cuff; cream panels (a yoke over the chest and the shoulders, a stripe down each side and
down the outside of each leg) stitched on; a brass collar ring standing round the neck; a cream webbing belt
with a brass buckle, two khaki pouches at the hips and a coil of line hanging at his right hip; tall
sea-green rubber boots with a rolled rim and a strap and buckle at the top. Between the suit's knees and the
boots, and from the sleeves down, his own skin.

Built as the others are (outfit.py, docs/systems/characters.md "Outfits"): the suit cut from the base body's
quad cage, grown out, its collar ring and cuffs extruded (geometry: the ring is a brass tube, the cuffs
roll), subdivided and fitted. The boots' feet are his own (B3's boots) in sea-green, the shafts a piece over
his shins; the belt, the pouches, the buckles and the line are geometry (DiveGear: boxes, tori and a band,
each prop rigid on the body under it, the belt weighted as the suit); the cream stripes and the boots' straps
stand proud (tailor.py's RELIEF). The paint: flat colour from the sheet, its panels, stitching and rivets;
the shared painter (inkpaint.py) shades it, with fold strokes behind the knees.

Palette: picked from sheet-1 (median of small boxes on the suit, the panels, the boots, the ring, the belt,
the pouches), the blue lifted a little so it reads under the game's ink."""
import math
import bpy
import bmesh
import numpy as np
from mathutils import Vector
import garments as G
import rig as R
import outfit_kit as K
import tailor as T
import inkpaint as IP
from loft import smoothstep

ID = 'pearl-diver'
NAME = 'Pearl diver'
SHEET = 'references/characters/traveller-outfits/pearl-diver/sheet-1.jpg'

PAL = {
    'blue': (52, 82, 116), 'cream': (214, 197, 162), 'slate': (58, 62, 70), 'brass': (198, 152, 84),
    'boot': (112, 142, 124), 'rubber': (104, 134, 116), 'webbing': (208, 190, 154), 'khaki': (156, 136, 96),
    'line': (200, 182, 142), 'ink': (30, 34, 46),
}
PIECES = {
    # (the sleeves' ends weighted as the upper arm a little above them: the elbow bent them otherwise)
    'DiveSuit': dict(layer=1, outside=[], covers=[], hem=0.02, levels=2, gap=0.005,
                     sample=lambda p: Vector((math.copysign(min(abs(p.x), 0.30), p.x), p.y, p.z)) if abs(p.x) > 0.2 and p.z > 1.15 else p),
    # (the shafts weighted as the shin under their top: the knee's share bent the rim off the leg)
    'DiveShafts': dict(layer=2, outside=[], covers=['DiveBoots'], hem=0.02, levels=2, gap=0.004,
                       sample=lambda p: Vector((p.x, p.y, min(p.z, 0.27)))),
    'DiveGear': dict(layer=3, outside=['DiveSuit', 'DiveShafts'], covers=[], hem=0.01, levels=0, gap=0.002),
}
BOOTS = 'DiveBoots'    # B3's boots (the default's 'Boots'), sea-green
ZONES = {'DiveSuit': ['blue', 'slate', 'brass'], 'DiveShafts': ['rubber', 'rubber'],
         'DiveGear': ['webbing', 'khaki', 'brass', 'line', 'rubber'], BOOTS: ['boot']}
PART = G.PART
EDGE = {}


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


SLEEVE = 0.35    # |x| the sleeves' cage rings end by (the ring at 0.305, two-thirds down the upper arm: one
                 # ring further, at 0.372, his forearm came through the cuff as the elbow bent)
KNEE = 0.39      # the legs' end ring (0.398, a hand under the knee)


def suit(cage, J):
    """Fitted: the torso, the upper arms and the thighs to under the knee; a little fuller at the chest and
    the seat; the collar ring and the cuffs extruded."""
    bm = G.cut(cage, lambda v, p: p == PART['torso'] or (p == PART['arm'] and abs(v.co.x) <= SLEEVE)
               or (p == PART['leg'] and v.co.z >= KNEE))

    def off(p, part):
        if part == PART['arm']:
            return 0.011 + 0.003 * smoothstep(0.30, 0.20, abs(p.x))
        if part == PART['leg']:
            return 0.011 + 0.003 * smoothstep(0.60, 0.80, p.z)
        return (0.012 + 0.006 * smoothstep(1.18, 1.30, p.z) * smoothstep(1.46, 1.38, p.z)
                + 0.003 * smoothstep(1.05, 0.90, p.z))
    G.inflate(bm, off)
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z > 1.40 and abs(c.x) < 0.1:      # the neck: a short seal, then the brass ring, level all round
            out = G.radial((0.0, c.y))
            # the ring sits on the neckline, half levelled (the neckline dips in front: followed whole, the ring
            # tipped forward; level at its top, it stood off the chest in front)
            z0 = sum(v.co.z for v in loop) / len(loop) + 0.003
            orig = {v: v.co.z for v in loop}         # each ring vert's neckline height, carried down the rings
            lvl = lambda p, h, v: Vector((p.x, p.y, z0 + 0.6 * (orig[v] - z0) + h))

            def ext(run, off, h):
                new = G.extrude(bm, run, lambda p, v: lvl(p + out(p) * off, h, v))
                for x, y in zip(run, new):
                    orig[y] = orig[x]
                return new
            s1 = ext(loop, 0.002, 0.0)
            b1 = ext(s1, 0.028, 0.001)
            b2 = ext(b1, 0.008, 0.012)
            b3 = ext(b2, -0.006, 0.024)
            b4 = ext(b3, -0.022, 0.026)
            EDGE['ringBottom'] = z0
            EDGE['ringTop'] = z0 + 0.024
            ring = set(s1) | set(b1) | set(b2) | set(b3) | set(b4)
            for f in bm.faces:
                if all(v in ring for v in f.verts):
                    f.material_index = 2
        elif c.z < 0.6:                          # a leg's end: a rolled cuff
            ax = (c.x, c.y)
            out = G.radial(ax)
            r1 = G.extrude(bm, loop, lambda p, v: p + out(p) * 0.005 - Vector((0, 0, 0.008)))
            G.extrude(bm, r1, lambda p, v: p - out(p) * 0.002 - Vector((0, 0, 0.012)))
            EDGE['legEnd'] = c.z - 0.020
            for f in bm.faces:
                cc = f.calc_center_median()
                if cc.z < c.z + 0.012 and cc.z < 0.6:
                    f.material_index = 1
        else:                                    # a sleeve's end: a cuff on a little past the ring
            sx = math.copysign(1.0, c.x)
            ctr = Vector((0, c.y, c.z))
            G.extrude(bm, loop, lambda p, v: p + Vector((sx * 0.016, 0, 0)) + (p - Vector((p.x, ctr.y, ctr.z))).normalized() * 0.003)
            EDGE['sleeveEnd'] = abs(c.x) + 0.016
            for f in bm.faces:
                cc = f.calc_center_median()
                if abs(cc.x) > abs(c.x) - 0.014 and abs(cc.x) > 0.25 and cc.z > 1.1:
                    f.material_index = 1
    _orient(bm)
    return bm


SHAFT_TOP = 0.33


def shafts(cage, J):
    """The rubber boots' legs from inside his boots' tops to two hands under the knee, wide (a welly stands
    off the shin), a rolled rim round the top."""
    bm = G.cut(cage, lambda v, p: p == PART['leg'] and 0.165 <= v.co.z <= SHAFT_TOP)
    G.inflate(bm, lambda p, part: 0.020 + 0.008 * smoothstep(0.22, 0.32, p.z))
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z < 0.25:
            continue
        out = G.radial((c.x, c.y))
        r1 = G.extrude(bm, loop, lambda p, v: p + out(p) * 0.004 + Vector((0, 0, 0.006)))
        r2 = G.extrude(bm, r1, lambda p, v: p - out(p) * 0.004 + Vector((0, 0, 0.004)))
        G.extrude(bm, r2, lambda p, v: p - out(p) * 0.005 - Vector((0, 0, 0.004)))
        EDGE['shaftTop'] = c.z + 0.010
        for f in bm.faces:
            if f.calc_center_median().z > c.z - 0.002:
                f.material_index = 1
    _orient(bm)
    return bm


def gear(cage, J):
    """The belt (a band round the suit at the hip bones), its buckle, two pouches, a coil of line at his
    right hip; a strap and buckle round each boot's top."""
    bm = bmesh.new()
    bm.verts.layers.int.new('part')
    for k in ('nx', 'ny', 'nz'):
        bm.verts.layers.float.new(k)
    z0, z1 = 1.022, 1.066
    zb = (z0 + z1) / 2
    K.band(bm, cage, PART["torso"], z0, z1, off=0.026, n=48, mat=0, thick=0.005, flare=0.0)
    pts, c = K.ring_of(cage, PART['torso'], zb)
    # the buckle: a brass frame at the front
    p, d = K.on_ring(pts, c, -math.pi / 2, 0.033, zb)
    K.box(bm, p, (0.050, 0.008, 0.040), K.face_rot(d), bevel=0.002, mat=2)
    # the pouches: either side at the front of the hips, a flap over each
    for sx in (-1, 1):
        a = -math.pi / 2 + sx * 1.45
        p, d = K.on_ring(pts, c, a, 0.056, zb - 0.006)
        rot = K.face_rot(d)
        K.box(bm, p, (0.064, 0.034, 0.070), rot, bevel=0.005, mat=1)
        fp = p + Vector((0, 0, 0.022)) + d * 0.019
        K.box(bm, fp, (0.068, 0.008, 0.032), rot, bevel=0.002, mat=1)
        K.box(bm, fp + d * 0.004 - Vector((0, 0, 0.010)), (0.012, 0.004, 0.010), rot, bevel=0.0015, mat=2)
    # the line: coiled loops hanging at his right hip, a little behind the side
    a = math.pi - 0.15
    p, d = K.on_ring(pts, c, a, 0.040, zb - 0.105)
    for k in range(3):
        K.torus(bm, p + d * (0.006 * k) + Vector((0, 0.004 * k, -0.004 * k)), d, 0.050 - 0.004 * k, 0.0065,
                seg=28, sides=6, mat=3)
    # the boots' straps: a band round each shaft under the rim, a brass buckle on the outside
    for side in (-1, 1):
        zs = SHAFT_TOP - 0.05
        lp, lcen = K.ring_of(cage, PART['leg'], zs, side=side)
        p, d = K.on_ring(lp, lcen, 0.0 if side > 0 else math.pi, 0.034, zs)
        K.box(bm, p, (0.026, 0.006, 0.024), K.face_rot(d), bevel=0.0015, mat=2)
    return bm


def reweight(name, ob, arm, J):
    """The props move as one with the body under them (the belt bends as the suit it goes round)."""
    if name == 'DiveGear':
        R.set_weights(ob, K.copy_weights(ob, bpy.data.objects['DiveSuit'], only=K.verts_of_mats(ob, {0})))
        R.set_weights(ob, K.rigid_islands(ob, skip_mats=(0,)))


# volume (tailor.py): the cream panels sewn on proud of the blue (the stripes down his sides and the outside
# of his legs), the boots' straps standing round the shafts under the rim
def _suit_relief(ob, J):
    rep = {}
    for sx in (-1, 1):
        n = (sx, 0, 0)
        rep[f'side{sx}'] = T.raised(T.strap((sx * 0.15, 0.015, 1.24), (sx * 0.15, 0.015, 0.90), n, 0.028), height=0.0016,
                                    facing=n, where=lambda P, s=sx: (P[:, 0] * s > 0.1) * 1.0)(ob, J)
        rep[f'leg{sx}'] = T.raised(T.strap((sx * 0.17, 0.035, 0.86), (sx * 0.17, 0.040, 0.38), n, 0.028), height=0.0016,
                                   facing=n, where=lambda P, s=sx: (P[:, 0] * s > 0.1) * 1.0)(ob, J)
    return rep


def _shaft_relief(ob, J):
    return T.raised(T.ring((0, 0, SHAFT_TOP - 0.05), (0, 0, 1), 0.010), height=0.004)(ob, J)


RELIEF = {'DiveSuit': [_suit_relief], 'DiveShafts': [_shaft_relief]}


def _folds(piece):
    def f(P, N, zone, J):
        if piece == 'DiveSuit':
            (A, B), st = IP.knee_folds(J, n=2)
            ink, shd = IP.limb_strokes(P, A, B, st)
            leg = (P[:, 2] < 0.8) * (zone == 0)
            return [(ink * leg, shd * leg)]
        return []
    return f


# the shared painter (inkpaint.py): the suit's folds behind the knees; the rubber less hatched
SHADE = {'DiveSuit': dict(folds=_folds('DiveSuit'), fold_ink=0.6), 'DiveShafts': dict(hatch=0.35), 'DiveGear': dict(hatch=0.3)}

SKIN_CUT = []          # his forearms and hands all show
# the hips: under the belt and the suit's seat together (each alone misses the crotch's verts); the thighs
# as the other outfits (every miss a vert at the crotch whose ray goes down between the legs)
EXTRA_HIDES = ['hips', 'thigh.L', 'thigh.R']

BUILDERS = {'DiveSuit': suit, 'DiveShafts': shafts, 'DiveGear': gear}


# ------------------------------------------------------------------ the paint

def _rgb(name):
    return np.array(PAL[name], dtype=float) / 255


def _leg_axis(x, z, J):
    zs = [J['foot_l'].z, J['calf_l'].z, J['thigh_l'].z]
    cx = np.where(x > 0, 1, -1) * np.interp(z, zs, [J['foot_l'].x, J['calf_l'].x, J['thigh_l'].x])
    cy = np.interp(z, zs, [J['foot_l'].y, J['calf_l'].y, J['thigh_l'].y])
    return cx, cy


def paint(piece, zone, P, N, J):
    """sRGB colour (n, 3) of texels at rest positions P with normals N, of `piece`, in `zone` (the material
    index: the suit's 0 cloth, 1 cuffs, 2 the ring; the gear's 0 webbing, 1 pouches, 2 brass, 3 line,
    4 straps)."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    ax = np.abs(x)
    n = len(P)
    rng = np.random.default_rng(545)
    out = np.zeros((n, 3))
    ink = _rgb('ink')
    band = K.band_mask

    def mix(mask, colour, k=1.0):
        nonlocal out
        a = (np.clip(mask, 0, 1) * k)[:, None]
        out = out * (1 - a) + np.asarray(colour)[None, :] * a

    front = np.clip(-N[:, 1] * 2.5, 0, 1)
    if piece == 'DiveSuit':
        out[:] = _rgb('blue')
        cloth = zone == 0
        arm = (ax > 0.20) & (z > 1.15)
        torso = cloth & ~arm & (z > 0.86)
        leg = cloth & (z <= 0.86)
        # the yoke: cream over the top of the chest, its lower edge dipping to a point at the breastbone (the
        # sheet's bib), up over the shoulders to the collar; behind, the cream runs up from the side stripes
        # over the shoulder blades, the back's middle blue
        fr = y < 0.02
        edge = np.where(fr, 1.335 - 0.055 * np.clip(1 - ax / 0.13, 0, 1) ** 1.5 + 0.03 * (ax / 0.2), 1.27 + 0.9 * np.clip(0.11 - ax, 0, 1))
        d_yoke = z - edge
        yoke = torso & (d_yoke > 0)
        mix(yoke, _rgb('cream'))
        # the side stripes: one band either side from the armpit down the outside of the leg to the cuff,
        # 3 cm either side of the side line (the torso's side, then each leg's outside, blended over the hip)
        cx, cy = _leg_axis(x, z, J)
        k = np.clip((z - 0.84) / 0.14, 0, 1)            # 0 on the legs, 1 on the torso
        yc = 0.015 * k + cy * (1 - k)
        outer = ((x - cx) * np.sign(x) > 0) | (k > 0.5)
        sidey = np.abs(N[:, 0]) > 0.25
        dy = np.abs(y - yc)
        W = 0.030
        body_ = (torso | leg)
        side = body_ & outer & sidey & (dy < W) & (z < edge)
        mix(side, _rgb('cream'))
        # stitching: a dashed ink line along every panel edge
        dash = (np.sin((x + z * 0.7 + y) / 0.004) > -0.2)
        mix(band(d_yoke, 0.0016, 0.001) * torso * dash, ink, 0.55)
        mix(band(dy - W, 0.0016, 0.001) * body_ * outer * sidey * (z < edge) * dash, ink, 0.5)
        # the front's seam and a brass button under the ring
        mix(band(x, 0.0014, 0.001) * front * torso * (z < edge - 0.01) * (z > 0.9), ink, 0.45)
        r = np.hypot(x, z - (EDGE['ringBottom'] - 0.065))
        mix((r < 0.011) * front * torso, _rgb('brass'))
        mix(band(r - 0.011, 0.0018, 0.001) * front * torso, ink, 0.8)
        # the cuffs: dark, a lighter roll at the edge
        out[zone == 1] = _rgb('slate')
        # the ring: brass, a lit band round its top, rivets round its side
        br = zone == 2
        seal = br & (z < EDGE['ringBottom'] - 0.001)
        out[br] = _rgb('brass')
        out[seal] = _rgb('slate')
        a = np.arctan2(y - 0.03, x)
        riv = np.hypot(((a * 12 / (2 * np.pi)) % 1 - 0.5) * 0.48, z - (EDGE['ringBottom'] + 0.010))
        mix((riv < 0.0035) * br * ~seal, ink * 1.6, 0.9)
        out[br] = out[br] * (0.85 + 0.35 * np.clip(N[br, 2], 0, 1))[:, None]
        # the seat and the crotch seams
        mix(band(x, 0.0014, 0.001) * (np.clip(N[:, 1] * 2.5, 0, 1)) * torso * (z < 1.25), ink, 0.4)
        out *= K.grain(rng, n)
    elif piece == 'DiveShafts':
        out[:] = _rgb('rubber')
        rim = zone == 1
        # the strap round the top: darker rubber
        mix(band(z - (SHAFT_TOP - 0.05), 0.010, 0.001) * ~rim, _rgb('rubber') * 0.78)
        # rubber: a sheen down the front, a seam down the back, the rim rolled
        out *= (1 + 0.14 * front * ~rim)[:, None]
        back = np.clip(N[:, 1] * 2.5, 0, 1)
        mix(band(x - np.sign(x) * 0.128, 0.0014, 0.001) * back * ~rim, ink, 0.45)
        mix(band(z - (EDGE['shaftTop'] - 0.012), 0.0018, 0.001), ink, 0.5)
        out[rim] = out[rim] * 0.92
        out *= K.grain(rng, n, 0.04)
    elif piece == 'DiveGear':
        out[:] = _rgb('webbing')
        out[zone == 1] = _rgb('khaki')
        out[zone == 2] = _rgb('brass')
        out[zone == 3] = _rgb('line')
        out[zone == 4] = _rgb('rubber') * 0.92   # (no props of this zone left: the straps are the shafts' relief)
        web = zone == 0
        # the webbing: two stitched lines along it
        mix(band(np.abs(z - 1.009) - 0.014, 0.0012, 0.0008) * web, ink, 0.5)
        # the line: its twist
        tw = np.sin((x * 3 + y * 2 + z * 5) / 0.006)
        mix((tw > 0.6) * (zone == 3), ink, 0.35)
        # the brass catches the light
        b = zone == 2
        out[b] = out[b] * (0.85 + 0.35 * np.clip(-N[b, 1] * 0.5 + N[b, 2] * 0.5 + 0.3, 0, 1))[:, None]
        out *= K.grain(rng, n, 0.04)
    return np.clip(out, 0, 1)

"""The lamplighter (issue #542): the traveller's third outfit, from
references/characters/traveller-outfits/lamplighter/sheet-1.jpg (front, side, back) and sheet-2.jpg.

A short quilted indigo jacket to the hips, its quilting in wide horizontal bands (rings round the sleeves),
a stand-up collar, piped in lamp-yellow at the collar, down the front, round the hem and at the cuffs, five
brass toggles down the front, a lamp-yellow armband on his left upper arm; slim charcoal trousers with a
yellow stripe down the outside of each leg, tucked into tall black boots with a turned-down cuff.

Built as the glider pilot is (outfit.py, docs/systems/characters.md "Outfits"): each piece cut from the base
body's quad cage, grown out, its collar and cuffs extruded, subdivided and fitted outside what lies under it.
The boots' feet are his own (B3's boots) in black; the tall shafts and their cuffs are a piece of their own
over the trousers. The paint is a function of the rest-pose surface.

Left out from the sheet: the short brown gloves (his hands are the base's skin piece: a glove would be a
mesh over the fingers) and the brass oil can on its strap at the hip (a hanging rigid prop, not cloth).

Palette: picked from sheet-1 (median of small boxes on the jacket, the armband, the trousers, the boots),
the indigo lifted and the trousers set a step lighter than the boots so they read apart under the game's ink."""
import math
import bmesh
import numpy as np
from mathutils import Vector
import garments as G
from loft import smoothstep

ID = 'lamplighter'
NAME = 'Lamplighter'
SHEET = 'references/characters/traveller-outfits/lamplighter/sheet-1.jpg'

PAL = {
    'indigo': (54, 64, 114), 'collar': (54, 64, 114), 'lamp': (230, 182, 84), 'charcoal': (78, 78, 84),
    'shaft': (50, 49, 52), 'cuff': (62, 60, 62), 'brass': (198, 158, 76), 'ink': (28, 28, 40), 'boot': (46, 45, 48),
}
# pieces: as outfit_glider_pilot.PIECES (layer, fitted outside of, covered by, hem band, levels, gap)
PIECES = {
    'LampTrousers': dict(layer=1, outside=[], covers=['Jacket', 'BootShafts'], hem=0.025, levels=2, gap=0.005),
    'BootShafts': dict(layer=2, outside=['LampTrousers'], covers=['LampBoots'], hem=0.02, levels=2, gap=0.004),
    'Jacket': dict(layer=2, outside=['LampTrousers'], covers=[], hem=0.03, levels=2, gap=0.007),
}
BOOTS = 'LampBoots'    # B3's boots (the default's 'Boots'), black
ZONES = {'Jacket': ['indigo', 'collar'], 'LampTrousers': ['charcoal'], 'BootShafts': ['shaft', 'cuff'], BOOTS: ['boot']}
PART = G.PART

# measured by the builders, read by paint(): the jacket's hem, the collar's top, the sleeves' ends,
# the shafts' cuff
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


def trousers(cage, J):
    """Slim: close round the leg, a little ease at the seat; the waist at the hip bones, the legs on down
    inside the boots' shafts."""
    bm = G.cut(cage, lambda v, p: (p == PART['torso'] and v.co.z <= 1.09) or (p == PART['leg'] and v.co.z >= 0.25))
    G.inflate(bm, lambda p, part: 0.009 + 0.004 * smoothstep(0.80, 1.0, p.z) + 0.003 * smoothstep(0.50, 0.70, p.z) * smoothstep(0.92, 0.80, p.z))
    for v in bm.verts:     # the seat hangs a little
        if abs(v.co.x) < 0.03 and v.co.z < 0.9:
            v.co.z -= 0.015 * (1 - abs(v.co.x) / 0.03)
    _orient(bm)
    return bm


def boot_shafts(cage, J):
    """The tall boots' legs from inside his boots' tops to two-thirds up the shin, over the trousers, and
    a turned-down cuff hanging round the top."""
    top = 0.37
    bm = G.cut(cage, lambda v, p: p == PART['leg'] and 0.165 <= v.co.z <= top + 0.02)
    G.inflate(bm, lambda p, part: 0.017 + 0.003 * smoothstep(0.24, 0.36, p.z))
    TURN = bm.faces.layers.int.new('turn')
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z < 0.3:
            continue
        out = G.radial((c.x, c.y))
        z0 = max(v.co.z for v in loop)
        EDGE['cuffTop'] = z0 + 0.008
        lip = G.extrude(bm, loop, lambda p, v: p + out(p) * 0.006 + Vector((0, 0, 0.008)))
        fold = G.extrude(bm, lip, lambda p, v: p + out(p) * 0.006)
        hang = G.extrude(bm, fold, lambda p, v: p + out(p) * 0.004 - Vector((0, 0, 0.062)))
        EDGE['cuffBottom'] = z0 + 0.008 - 0.062
        ring = set(fold) | set(hang)
        for f in bm.faces:
            if all(v in ring for v in f.verts):
                f.material_index = 1
                f[TURN] = 1
            elif all(v in set(lip) | set(fold) | set(loop) for v in f.verts):
                f.material_index = 1
    _orient(bm)
    TURN = bm.faces.layers.int['turn']
    bmesh.ops.reverse_faces(bm, faces=[f for f in bm.faces if f[TURN]])
    return bm


def jacket(cage, J):
    """To the hips, long sleeves, a little full (quilted), a stand-up collar at the neck."""
    bm = G.cut(cage, lambda v, p: (p == PART['torso'] and v.co.z >= 1.005) or p == PART['arm'])

    def off(p, part):
        if part == PART['arm']:
            t = G.arm_t(p, J)
            return 0.024 + 0.008 * smoothstep(0.15, 0.55, t) - 0.010 * smoothstep(0.70, 0.90, t)
        return (0.026 + 0.010 * smoothstep(1.26, 1.10, p.z) * smoothstep(1.00, 1.06, p.z)
                + 0.004 * smoothstep(1.32, 1.42, p.z) * smoothstep(0.05, 0.12, abs(p.x)))
    G.inflate(bm, off)
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z > 1.40 and abs(c.x) < 0.1:      # the neck: a stand-up collar, leaning in a little
            ax = (0.0, c.y)
            inn = G.radial(ax)
            s1 = G.extrude(bm, loop, lambda p, v: p + Vector((0, 0, 0.024)) - inn(p) * 0.003)
            s2 = G.extrude(bm, s1, lambda p, v: p + Vector((0, 0, 0.022)) - inn(p) * 0.002)
            EDGE['collarTop'] = sum(v.co.z for v in s2) / len(s2)
            EDGE['collarBottom'] = sum(v.co.z for v in loop) / len(loop)
            ring = set(loop) | set(s1) | set(s2)
            for f in bm.faces:
                if all(v in ring for v in f.verts):
                    f.material_index = 1
        elif c.z < 1.1:                         # the hem: on down a little to the hips, straight
            r1 = G.extrude(bm, loop, lambda p, v: p - Vector((0, 0, 0.020)))
            G.extrude(bm, r1, lambda p, v: p - Vector((0, 0, 0.020)))
            EDGE['hem'] = min(v.co.z for v in loop) - 0.040
        else:                                   # a sleeve's end: on past the wrist ring a little
            G.extrude(bm, loop, lambda p, v: p + Vector((math.copysign(0.012, p.x), 0, 0)))
            EDGE['cuff'] = max(abs(v.co.x) for v in loop) + 0.012
    _orient(bm)
    return bm


# his skin piece (B3's forearms and ankles) under the sleeves and the boots' shafts left out (as the glider
# pilot's): boxes in Blender's rest frame (x mirrored: |x|)
SKIN_CUT = [{'absx': [0.20, 0.64], 'z': [1.15, 1.60]}, {'absx': [0.0, 0.40], 'z': [-1.0, 0.45]}, {'absx': [0.0, 0.20], 'z': [0.70, 1.15]}]

# body areas left out besides the measured ones (97 % under a piece): the hips come out at 94 %, the
# misses all on a lump of the base body at his right front hip that stands 14 mm proud of the rest
# (drawn for the default's trousers) and comes through these slim ones; the trousers and the jacket's
# hem cover the whole area
EXTRA_HIDES = ['hips']

BUILDERS = {'LampTrousers': trousers, 'BootShafts': boot_shafts, 'Jacket': jacket}


# ------------------------------------------------------------------ the paint

def _band(d, w, aa):
    """1 inside |d| < w, soft over aa."""
    return np.clip((w - np.abs(d)) / aa + 0.5, 0, 1)


def _rgb(name):
    return np.array(PAL[name], dtype=float) / 255


def _leg_axis(x, z, J):
    """The leg's centre line (x, y) at height z, either side."""
    zs = [J['foot_l'].z, J['calf_l'].z, J['thigh_l'].z]
    cx = np.where(x > 0, 1, -1) * np.interp(z, zs, [J['foot_l'].x, J['calf_l'].x, J['thigh_l'].x])
    cy = np.interp(z, zs, [J['foot_l'].y, J['calf_l'].y, J['thigh_l'].y])
    return cx, cy


def paint(piece, zone, P, N, J):
    """sRGB colour (n, 3) of texels at rest positions P (n, 3) with normals N, of `piece`, in `zone` (n,)
    (the material index: the jacket's 0 shell, 1 collar; the shafts' 0 leg, 1 cuff)."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    ax = np.abs(x)
    n = len(P)
    rng = np.random.default_rng(542)
    out = np.zeros((n, 3))
    ink = _rgb('ink')
    lamp = _rgb('lamp')

    def mix(mask, colour, k=1.0):
        nonlocal out
        a = (np.clip(mask, 0, 1) * k)[:, None]
        out = out * (1 - a) + np.asarray(colour)[None, :] * a

    front = np.clip(-N[:, 1] * 2.5, 0, 1)
    back = np.clip(N[:, 1] * 2.5, 0, 1)
    if piece == 'Jacket':
        out[:] = _rgb('indigo')
        collar = zone == 1
        arm = (ax > 0.215) & ~collar
        torso = ~arm & ~collar
        hem, cuff = EDGE['hem'], EDGE['cuff']
        top = EDGE['collarTop']
        # the quilting: wide horizontal bands on the body, rings round the sleeves, each a little fuller in
        # its middle and stitched along a dark line
        qt = (z - hem) / 0.058
        qa = (cuff - ax) / 0.052
        q = np.where(arm, qa, qt)
        frac = q - np.floor(q)
        out *= (0.90 + 0.12 * np.sin(np.pi * frac))[:, None]
        stitch = _band(frac - 0.5, 0.5 - 0.035, 0.012)      # 1 in the band, 0 on its line
        quilted = (~collar) & np.where(arm, ax < cuff - 0.03, (z > hem + 0.03) & (z < 1.44))
        mix((1 - stitch) * quilted, ink, 0.55)
        # the front's opening: piping either side of a dark gap, from the hem to the collar's top
        opening = front * (z < top + 0.01)
        mix(_band(x, 0.009, 0.002) * opening, lamp)
        mix(_band(x, 0.0016, 0.001) * opening, ink, 0.9)
        # five brass toggles across it, each a bar with a loop of cord either side
        for k in range(5):
            tz = 1.10 + k * 0.072
            bar = np.maximum(np.abs(x) / 0.020, np.abs(z - tz) / 0.0055)
            mix(_band(bar - 1, 0.25, 0.10) * (bar < 1.25) * front * torso, ink, 0.9)
            mix((bar < 0.85) * front * torso, _rgb('brass'))
            for sx in (-1, 1):
                loop_ = np.hypot((x - sx * 0.030) / 0.012, (z - tz) / 0.006)
                mix(_band(loop_ - 1, 0.22, 0.12) * front * torso, _rgb('brass'), 0.9)
        # piping: round the hem, at the cuffs, the collar's top edge and its front edges
        mix(_band(z - (hem + 0.006), 0.007, 0.002) * torso, lamp)
        mix(_band(z - (hem + 0.014), 0.0012, 0.0008) * torso, ink, 0.6)
        mix(_band(ax - (cuff - 0.006), 0.007, 0.002) * arm, lamp)
        mix(_band(ax - (cuff - 0.014), 0.0012, 0.0008) * arm, ink, 0.6)
        mix(_band(z - (top - 0.004), 0.006, 0.002) * collar, lamp)
        mix(_band(z - EDGE['collarBottom'], 0.0013, 0.0008) * collar, ink, 0.7)
        # the armband on his left upper arm (+x), with an inked edge either side
        ab = 0.27
        mix(_band(x - ab, 0.032, 0.002) * arm, lamp)
        mix(_band(np.abs(x - ab) - 0.032, 0.0014, 0.001) * arm, ink, 0.8)
        # seams: the shoulder and the sleeve's join
        mix(_band(ax - 0.215, 0.0014, 0.001) * (z > 1.30), ink, 0.45)
        mix(_band(x, 0.0012, 0.001) * back * (z < top) * torso, ink, 0.35)       # the back's centre seam
        out *= (0.97 + 0.05 * rng.random((n, 1)))
    elif piece == 'LampTrousers':
        out[:] = _rgb('charcoal')
        cx, cy = _leg_axis(x, z, J)
        ang = np.arctan2(y - cy, (x - cx) * np.sign(x + 1e-9))
        r = np.hypot(x - cx, y - cy)
        leg = (z < 0.90)
        mix(_band(ang * r, 0.0035, 0.0012) * leg, lamp)                                    # the side stripe
        mix(_band(x, 0.0016, 0.001) * front * (z > 0.87) * (z < 1.06), ink, 0.7)           # the fly
        mix(_band(z - 1.035, 0.012, 0.002), _rgb('ink') * 1.6)                             # the belt (under the jacket)
        for sx in (-1, 1):                                                                 # back pockets
            mix((np.abs(x - sx * 0.07) < 0.045) * _band(z - 0.96, 0.0016, 0.001) * back, ink, 0.5)
        out *= (0.97 + 0.05 * rng.random((n, 1)))
    elif piece == 'BootShafts':
        out[:] = _rgb('shaft')
        cuff = zone == 1
        out[cuff] = _rgb('cuff')
        # leather: a soft sheen up the front of the shaft, a seam down the back, the cuff's fold inked
        out *= (1 + 0.10 * front * ~cuff)[:, None]
        mix(_band(x - np.sign(x) * 0.133, 0.0015, 0.001) * back * ~cuff, ink, 0.5)
        mix(_band(z - EDGE['cuffTop'], 0.003, 0.002) * cuff, ink, 0.6)
        mix(_band(z - (EDGE['cuffBottom'] + 0.004), 0.0015, 0.001) * cuff, ink, 0.4)
        out *= (0.96 + 0.06 * rng.random((n, 1)))
    return np.clip(out, 0, 1)

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

Since #544 (tailor.py, inkpaint.py): the quilting puffed in geometry between stitched rows, a taller stand
collar, the toggles and the armband raised, the short brown gloves (his hands' skin grown out, weighted as
the hands, the hands cut away) and the brass oil can on a strap at his left hip (rigid on his left thigh's bone), the
folds and hatching painted by the shared painter.

Palette: picked from sheet-1 (median of small boxes on the jacket, the armband, the trousers, the boots),
the indigo lifted and the trousers set a step lighter than the boots so they read apart under the game's ink."""
import math
import bmesh
import numpy as np
from mathutils import Vector
import garments as G
import tailor as T
import inkpaint as IP
from loft import smoothstep

ID = 'lamplighter'
NAME = 'Lamplighter'
SHEET = 'references/characters/traveller-outfits/lamplighter/sheet-1.jpg'

PAL = {
    'indigo': (54, 64, 114), 'collar': (54, 64, 114), 'lamp': (230, 182, 84), 'charcoal': (78, 78, 84),
    'shaft': (50, 49, 52), 'cuff': (62, 60, 62), 'brass': (198, 158, 76), 'ink': (28, 28, 40), 'boot': (46, 45, 48),
    'glove': (124, 76, 44), 'strap': (104, 66, 40),
}
# pieces: as outfit_glider_pilot.PIECES (layer, fitted outside of, covered by, hem band, levels, gap)
PIECES = {
    'LampTrousers': dict(layer=1, outside=[], covers=['Jacket', 'BootShafts'], hem=0.025, levels=2, gap=0.005),
    'BootShafts': dict(layer=2, outside=['LampTrousers'], covers=['LampBoots'], hem=0.02, levels=2, gap=0.004),
    'Jacket': dict(layer=2, outside=['LampTrousers'], covers=[], hem=0.03, levels=2, gap=0.007),
}
BOOTS = 'LampBoots'    # B3's boots (the default's 'Boots'), black
ZONES = {'Jacket': ['indigo', 'collar'], 'LampTrousers': ['charcoal'], 'BootShafts': ['shaft', 'cuff'], BOOTS: ['boot'],
         'Gloves': ['glove'], 'OilCan': ['brass', 'strap']}
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
        # (#544) the shoulders' cap thinner: the quilting's puff goes on top, and a full cap there spread
        # out broad when the arms came down
        if part == PART['arm']:
            t = G.arm_t(p, J)
            return (0.022 + 0.008 * smoothstep(0.15, 0.55, t) - 0.010 * smoothstep(0.70, 0.90, t)
                    - 0.008 * smoothstep(0.22, 0.0, t))
        return (0.024 + 0.010 * smoothstep(1.26, 1.10, p.z) * smoothstep(1.00, 1.06, p.z)
                - 0.008 * smoothstep(1.30, 1.40, p.z) * smoothstep(0.08, 0.15, abs(p.x)))
    G.inflate(bm, off)
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z > 1.40 and abs(c.x) < 0.1:      # the neck: a tall stand-up collar, leaning in a little
            ax = (0.0, c.y)
            inn = G.radial(ax)
            zb = max(v.co.z for v in loop)
            # its top nearly level, 4.7 cm at the back; each ring leaning in towards the neck but kept 9 mm
            # off it (the head's own neck, head-v3, met by a ray out from the neck's middle): it is thicker
            # and further forward than the body's, and a collar straight up from the ring went into it
            import bpy
            from mathutils.bvhtree import BVHTree
            hb = bmesh.new()
            hb.from_mesh(bpy.data.objects['Head'].data)
            neck = BVHTree.FromBMesh(hb)
            hb.free()
            top = lambda p: max(p.z + 0.047, zb + 0.047 - 0.35 * (zb - p.z))

            def ring(p, z, lean):
                o = Vector((0.0, 0.012, z))
                d = Vector((p.x, p.y, 0.0)) - Vector((0.0, 0.012, 0.0))
                r0 = d.length
                d.normalize()
                hit = neck.ray_cast(o, d, 0.3)
                r = max(r0 - lean, (hit[0] - o).length + 0.009) if hit[0] is not None else r0 - lean
                return o + d * r
            s1 = G.extrude(bm, loop, lambda p, v: ring(p, (p.z + top(p)) / 2, 0.004))
            s2 = G.extrude(bm, s1, lambda p, v: p)
            for a, b in zip(loop, s2):
                b.co = ring(a.co, top(a.co), 0.007)
            EDGE['collarTop'] = zb + 0.047
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
# (#544: the first box on out past his fingertips: the gloves cover his hands, the hands' skin goes)
SKIN_CUT = [{'absx': [0.20, 1.0], 'z': [1.15, 1.60]}, {'absx': [0.0, 0.40], 'z': [-1.0, 0.45]}, {'absx': [0.0, 0.20], 'z': [0.70, 1.15]}]

# body areas left out besides the measured ones (97 % under a piece): none since #493's pass 5 (the base
# body's hips and legs are fitted from its bones: the lump at his right front hip and the crumpled crotch,
# which made the hips and thighs come out at 92-97 %, are gone; they measure now)
EXTRA_HIDES = []
# the taller collar (#544) covers the neck's area, but from above he is seen into it: the neck stays
KEEP_AREAS = ['neck']

BUILDERS = {'LampTrousers': trousers, 'BootShafts': boot_shafts, 'Jacket': jacket}


# ------------------------------------------------------------------ the volume and the props (#544, tailor.py)

def _quilting(ob, J):
    """The jacket's quilting as the sheet's: wide bands puffed between stitched rows (five across the front,
    six down the back), rings round the sleeves; the front's placket and the shoulder seam left flat."""
    hem, cuff = EDGE['hem'], EDGE['cuff']
    EDGE['rowsT'] = rows_t = [float(z) for z in np.arange(hem + 0.034, 1.44, 0.078)]
    EDGE['rowsA'] = rows_a = [float(x) for x in np.arange(0.245, cuff - 0.03 + 1e-6, 0.074)]

    def torso(P):
        ax = np.abs(P[:, 0])
        placket = np.where(P[:, 1] < 0.03, T.smooth01(0.012, 0.030, ax), 1.0)
        return T.smooth01(0.212, 0.192, ax) * placket

    def sleeve(P):
        ax = np.abs(P[:, 0])
        return T.smooth01(0.222, 0.240, ax) * T.smooth01(cuff - 0.020, cuff - 0.034, ax)
    return T.quilt([((0, 0, 1), rows_t, torso), ((-1, 0, 0), rows_a, sleeve)], puff=0.0075)(ob, J)


def _toggles(ob, J):
    """The five brass toggles stand out of the placket."""
    rep = {}
    for k in range(5):
        tz = 1.10 + k * 0.072
        rep[k] = T.raised(T.rect((0, 0, tz), (1, 0, 0), (0, 0, 1), 0.021, 0.0062, step=0.0025), height=0.0045,
                          step=0.0025, facing=(0, -1, 0))(ob, J)
    return rep


def _armband(ob, J):
    return T.raised(T.ring((0.27, 0, 0), (1, 0, 0), 0.032), height=0.0028, where=lambda P: (P[:, 0] > 0.22) * 1.0)(ob, J)


RELIEF = {'Jacket': [_quilting, _toggles, _armband]}


def _gloves(ctx):
    """Short brown gloves over his hands: his skin piece's hands grown out, a flared cuff under the sleeve's
    end; his hands' own triangles go (SKIN_CUT)."""
    bm, src = T.glove(ctx['skin'], xmin=0.60, cuff_x=(0.60, 0.672))
    return bm, T.copy_weights(ctx['skin'], src, ctx['bones'])


def _oil_can(ctx):
    """The brass oil can on a short strap at his left hip: the strap from under the jacket's hem down the
    outside of the hip, a ring, the can (a turned body, a domed top, a spout, a bail). The can is rigid on
    his left thigh's bone (on the pelvis, the game's idle swung the thigh 3 cm into it), the strap goes over
    from the pelvis at its top to the thigh at its foot."""
    import bmesh
    from mathutils.bvhtree import BVHTree
    tr = ctx['made']['LampTrousers']
    b = bmesh.new()
    b.from_mesh(tr.data)
    tree = BVHTree.FromBMesh(b)
    b.free()
    pts = []
    for z in np.linspace(0.99, 0.80, 9):
        hit = tree.ray_cast(Vector((0.5, 0.012, float(z))), Vector((-1, 0, 0)), 0.5)
        pts.append(hit[0] + hit[1] * 0.006)
    EDGE['strapEnd'] = pts[-1].copy()
    bm = bmesh.new()
    T.ribbon(bm, pts, lambda p: (1, 0, 0.15), half_w=0.010, thick=0.0018, mat=1)
    K = 1.22      # (the sheet's can: about a hand tall)
    axis_x = pts[-1].x + 0.031
    top = pts[-1].z - 0.016
    T.torus(bm, (pts[-1].x + 0.006, pts[-1].y, pts[-1].z - 0.004), (0, 1, 0), 0.010, 0.0022, seg=12, seg2=5, mat=0)
    base = Vector((axis_x, pts[-1].y, top - 0.118 * K))
    EDGE['can'] = (axis_x, pts[-1].y, top - 0.118 * K, top, K)
    T.lathe(bm, base, (0, 0, 1), [(h * K, r * K) for h, r in (
        (0.0, 0.021), (0.004, 0.026), (0.010, 0.027), (0.014, 0.0255), (0.016, 0.027), (0.070, 0.027), (0.073, 0.0255),
        (0.076, 0.027), (0.082, 0.025), (0.092, 0.018), (0.100, 0.010), (0.104, 0.007), (0.112, 0.007), (0.114, 0.004))],
        segments=16)
    # the spout, out of the dome to his front-left, and the bail over the top
    T.lathe(bm, base + Vector((0.012, -0.010, 0.088)) * K, Vector((0.55, -0.45, 0.70)),
            [(0.0, 0.0045 * K), (0.034 * K, 0.0030 * K), (0.038 * K, 0.0026 * K)], segments=8)
    T.torus(bm, base + Vector((0, 0, 0.112 * K)), (0, 1, 0), 0.014 * K, 0.0019, seg=12, seg2=5, mat=0)
    w = [(lambda k: {'thigh_l': k, 'pelvis': 1 - k} if k < 1 else {'thigh_l': 1.0})(float(T.smooth01(0.975, 0.86, v.co.z)))
         for v in bm.verts]
    return bm, w


PROPS = {
    'Gloves': dict(build=_gloves, layer=1, covers=['Jacket'], hem=0.012, under=['Jacket']),
    'OilCan': dict(build=_oil_can, layer=3, hem=None),
}


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
        # the quilting (puffed in geometry, _quilting): each stitched row a fine dark line, each band a
        # little lighter in its middle
        rt, ra = np.array(EDGE['rowsT']), np.array(EDGE['rowsA'])
        dt = np.min(np.abs(z[:, None] - rt[None, :]), 1)
        da = np.min(np.abs(ax[:, None] - ra[None, :]), 1)
        d = np.where(arm, da, dt)
        quilted = (~collar) & np.where(arm, (ax > 0.235) & (ax < cuff - 0.025), (z > hem + 0.02) & (z < rt[-1] + 0.01) & (ax < 0.205))
        mix(_band(d, 0.0012, 0.0009) * quilted, ink, 0.65)
        out *= (1 + 0.06 * T.smooth01(0.03, 0.0, np.abs(d - 0.037)) * quilted)[:, None]
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
    elif piece == 'Gloves':
        out[:] = _rgb('glove')
        # leather: a sheen over the back of the hand, the cuff's edge and its seam inked, a seam down each finger's back
        out *= (1 + 0.10 * np.clip(N[:, 2], 0, 1))[:, None]
        mix(_band(ax - 0.671, 0.0012, 0.0008), ink, 0.8)
        mix(_band(ax - 0.655, 0.0009, 0.0007), ink, 0.45)
        mix(_band(ax - 0.705, 0.0009, 0.0007) * (N[:, 2] > 0.3), ink, 0.35)       # the knuckles' line
        out *= (0.97 + 0.05 * rng.random((n, 1)))
    elif piece == 'OilCan':
        out[:] = _rgb('brass')
        strap = zone == 1
        out[strap] = _rgb('strap')
        cx, cy, z0, z1, K = EDGE['can']
        h = (z - z0) / K
        # brass: bright towards his front-left, dark at the turned rings, a sharp highlight stripe
        out *= (0.86 + 0.24 * np.clip(N[:, 0] * 0.6 - N[:, 1] * 0.6 + 0.3, 0, 1))[:, None] * (~strap)[:, None] + strap[:, None]
        for hz in (0.004, 0.014, 0.073, 0.082):
            mix(_band(h - hz, 0.0012, 0.0008) * ~strap, ink, 0.55)
        mix(_band(np.arctan2(y - cy, x - cx) + 0.9, 0.12, 0.05) * ~strap * (h > 0.016) * (h < 0.07), (1, 0.95, 0.8), 0.55)
        # the strap: its edges inked
        mix(_band(np.abs(y - EDGE['strapEnd'].y) - 0.009, 0.0012, 0.0008) * strap, ink, 0.6)
    return np.clip(out, 0, 1)


def _folds(piece):
    def f(P, N, zone, J):
        ax = np.abs(P[:, 0])
        if piece == 'Jacket':
            (A, B), st = IP.elbow_folds(J, n=4)
            ink, shd = IP.limb_strokes(P, A, B, st)
            arm = T.smooth01(0.30, 0.34, ax) * (zone == 0)
            return [(ink * arm, shd * arm)]
        if piece == 'LampTrousers':
            (A, B), st = IP.knee_folds(J)
            ink, shd = IP.limb_strokes(P, A, B, st)
            return [(ink, shd)]
        if piece == 'BootShafts':
            (A, B), _ = IP.knee_folds(J)
            st = [(0.80 + k * 0.025, 0.004, 0.0, 1.0, 0.002) for k in range(3)]
            ink, shd = IP.limb_strokes(P, A, B, st, seed=6)
            return [(ink * (zone == 0), shd * (zone == 0))]
        return []
    return f


# the shared painter's options per piece (inkpaint.DEFAULT; folds: pen strokes where the cloth gathers)
SHADE = {'Jacket': dict(folds=_folds('Jacket')), 'LampTrousers': dict(folds=_folds('LampTrousers'), tone=0.18, ao=0.3, cavity=0.1, hatch=0.45, hatch_from=0.45),
         'BootShafts': dict(folds=_folds('BootShafts'), hatch=0.5), 'Gloves': dict(hatch=0.6), 'OilCan': dict(hatch=0.4)}

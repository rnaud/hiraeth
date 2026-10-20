"""The moss gardener (issue #545): the traveller's fifth outfit, from
references/characters/traveller-outfits/moss-gardener/sheet-1.jpg (front, side, back) and sheet-2.jpg.

A moss-green waistcoat (a deep V at the neck, buttoned below, two patch pockets on the chest and two below
with flaps, a pencil in one, a half-belt and buckle across the back) over a short-sleeved ochre shirt (an
open collar, the sleeves rolled once to show their turquoise lining); rust shorts to the knee with turquoise
patches over the knees and a cargo pocket on each thigh, turned up at the hem, a brown belt; folded cream
wool socks bunched over the tops of chunky brown boots. His forearms, his elbows and his shins show his skin.

Built as the others (outfit.py; outfit_kit for the props and the shading): each cloth piece cut from the
base body's cage, grown out, its collar, cuffs and turn-ups extruded, subdivided and fitted; the boots are
his own (B3's) in brown; the waistcoat's pockets and flaps, the cargo pockets and the knee patches stand proud
on the cloth (tailor.py's RELIEF); the pencil, the belt and the back's half-belt are GardenGear (boxes and a
band, rigid on the cloth they are on). The paint: the sheet's flat colours, seams, buttons and patches; the
shared painter (inkpaint.py) shades it, with the shorts' long folds.

Palette: picked from sheet-1 (median of small boxes on the waistcoat's back, the shirt, the shorts, the
patches, the socks, the boots, the belt), the shorts a little warmer and the moss lifted so it reads apart
from the rust under the game's ink."""
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

ID = 'moss-gardener'
NAME = 'Moss gardener'
SHEET = 'references/characters/traveller-outfits/moss-gardener/sheet-1.jpg'

PAL = {
    'moss': (112, 120, 72), 'ochre': (200, 150, 72), 'turquoise': (96, 152, 146), 'rust': (162, 88, 58),
    'wool': (222, 206, 172), 'boot': (100, 74, 54), 'belt': (88, 64, 46), 'iron': (120, 116, 108),
    'button': (78, 60, 44), 'pencil': (214, 170, 70), 'ink': (36, 32, 28),
}
PIECES = {
    'GardenShirt': dict(layer=1, outside=[], covers=['Waistcoat', 'Shorts'], hem=0.02, levels=2, gap=0.004,
                        sample=lambda p: Vector((math.copysign(min(abs(p.x), 0.27), p.x), p.y, p.z)) if abs(p.x) > 0.2 and p.z > 1.15 else p),
    'Shorts': dict(layer=1, outside=['GardenShirt'], covers=['Waistcoat'], hem=0.02, levels=2, gap=0.005),
    'Socks': dict(layer=1, outside=[], covers=['GardenBoots'], hem=0.015, levels=2, gap=0.004,
                  sample=lambda p: Vector((p.x, p.y, min(p.z, 0.26)))),
    'Waistcoat': dict(layer=2, outside=['GardenShirt', 'Shorts'], covers=[], hem=0.02, levels=2, gap=0.005),
    'GardenGear': dict(layer=3, outside=['Waistcoat', 'Shorts'], covers=[], hem=0.01, levels=0, gap=0.002),
}
BOOTS = 'GardenBoots'      # B3's boots (the default's 'Boots'), brown
ZONES = {'GardenShirt': ['ochre', 'turquoise'], 'Shorts': ['rust', 'rust'], 'Socks': ['wool'],
         'Waistcoat': ['moss'], 'GardenGear': ['belt', 'moss', 'rust', 'iron', 'moss', 'pencil'],
         BOOTS: ['boot']}
PART = G.PART
EDGE = {}


def _orient(bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    score = 0.0
    for f in bm.faces:
        n = sum((G.normal(bm, v) for v in f.verts), Vector())
        score += f.normal.dot(n)
    if score < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)


def _v_open(depth_z, top_z, half):
    """A face test: the front's V opening from the neck down to depth_z, `half` wide at top_z."""
    def gone(f):
        c = f.calc_center_median()
        if c.y > 0.0 or c.z < depth_z:
            return False
        return abs(c.x) < half * (c.z - depth_z) / (top_z - depth_z)
    return gone


def shirt(cage, J):
    """Short sleeves to the middle of the upper arm, rolled once (the turn-up shows the lining), a collar
    standing round the neck and lying over (the placket's opening painted under it); tucked in at the
    waist."""
    bm = G.cut(cage, lambda v, p: (p == PART['torso'] and v.co.z >= 0.94) or (p == PART['arm'] and abs(v.co.x) <= 0.31))
    G.inflate(bm, lambda p, part: (0.011 + 0.004 * smoothstep(0.25, 0.20, abs(p.x))) if part == PART['arm']
              else 0.010 + 0.004 * smoothstep(1.20, 1.30, p.z))
    TURN = bm.faces.layers.int.new('turn')
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z > 1.30 and abs(c.x) < 0.12:     # the neck: a collar standing, folded over and lying out
            out = G.radial((0.0, c.y))
            st = G.extrude(bm, loop, lambda p, v: p + Vector((0, 0, 0.020)) + out(p) * 0.003)
            fo = G.extrude(bm, st, lambda p, v: p + out(p) * 0.008 + Vector((0, 0, 0.003)))
            lie = G.extrude(bm, fo, lambda p, v: p + out(p) * 0.010 - Vector((0, 0, 0.018)))
            EDGE['collar'] = sum(v.co.z for v in loop) / len(loop)
            ring = set(fo) | set(lie)
            for f in bm.faces:
                if all(v in ring for v in f.verts):
                    f[TURN] = 1
        elif c.z > 1.1:                          # a sleeve's end: rolled once, the roll's outside the lining
            sx = math.copysign(1.0, c.x)
            ctr = Vector((0, c.y, c.z))
            rad = lambda p: (p - Vector((p.x, ctr.y, ctr.z))).normalized()
            r1 = G.extrude(bm, loop, lambda p, v: p + Vector((sx * 0.006, 0, 0)) + rad(p) * 0.006)
            r2 = G.extrude(bm, r1, lambda p, v: p - Vector((sx * 0.030, 0, 0)) + rad(p) * 0.002)
            EDGE['sleeveEnd'] = abs(c.x) + 0.006
            roll = set(r1) | set(r2)
            for f in bm.faces:
                if all(v in roll for v in f.verts):
                    f.material_index = 1
                    f[TURN] = 1
    _orient(bm)
    TURN = bm.faces.layers.int['turn']
    bmesh.ops.reverse_faces(bm, faces=[f for f in bm.faces if f[TURN]])
    return bm


def shorts(cage, J):
    """Full to the knee (out at the sides most), a turn-up at each hem; the waist at the navel."""
    bm = G.cut(cage, lambda v, p: (p == PART['torso'] and v.co.z <= 1.09) or (p == PART['leg'] and v.co.z >= 0.455))
    pl = bm.verts.layers.int.get('part')
    for v in bm.verts:
        p = v.co
        n = G.normal(bm, v)
        side = Vector((math.copysign(1.0, p.x) if abs(p.x) > 1e-4 else 0.0, 0, 0))
        full = smoothstep(0.98, 0.80, p.z)
        lat = 0.010 * full * max(0.0, n.dot(side)) if v[pl] == PART['leg'] else 0.0
        v.co = p + n * (0.012 + 0.010 * full + 0.004 * smoothstep(0.70, 0.50, p.z)) + side * lat
    for v in bm.verts:     # the seat hangs a little
        if abs(v.co.x) < 0.03 and v.co.z < 0.9:
            v.co.z -= 0.012 * (1 - abs(v.co.x) / 0.03)
    TURN = bm.faces.layers.int.new('turn')
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z > 0.7:
            continue
        out = G.radial((c.x, c.y))
        r1 = G.extrude(bm, loop, lambda p, v: p + out(p) * 0.006 - Vector((0, 0, 0.004)))
        r2 = G.extrude(bm, r1, lambda p, v: p + out(p) * 0.001 + Vector((0, 0, 0.034)))
        EDGE['shortsHem'] = c.z - 0.004
        roll = set(r1) | set(r2)
        for f in bm.faces:
            if all(v in roll for v in f.verts):
                f.material_index = 1
                f[TURN] = 1
    _orient(bm)
    TURN = bm.faces.layers.int['turn']
    bmesh.ops.reverse_faces(bm, faces=[f for f in bm.faces if f[TURN]])
    return bm


SOCK_TOP = 0.30


def socks(cage, J):
    """Thick wool from inside the boots to the middle of the shin, bunched in soft rolls, the top folded
    over."""
    bm = G.cut(cage, lambda v, p: p == PART['leg'] and 0.165 <= v.co.z <= 0.25)
    for v in bm.verts:      # (the cut ends at the 0.24 ring: carried up to the sock's top before the folds)
        if v.co.z > 0.2:
            v.co.z += (SOCK_TOP - 0.03 - v.co.z) * smoothstep(0.2, 0.245, v.co.z)
    G.inflate(bm, lambda p, part: 0.013 + 0.004 * math.sin((p.z - 0.17) / 0.045 * 2 * math.pi) ** 2)
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z < 0.22:
            continue
        out = G.radial((c.x, c.y))
        r1 = G.extrude(bm, loop, lambda p, v: p + out(p) * 0.004 + Vector((0, 0, 0.014)))
        r2 = G.extrude(bm, r1, lambda p, v: p + out(p) * 0.009 + Vector((0, 0, 0.012)))
        r3 = G.extrude(bm, r2, lambda p, v: p + out(p) * 0.008 + Vector((0, 0, -0.004)))
        G.extrude(bm, r3, lambda p, v: p - out(p) * 0.002 - Vector((0, 0, 0.022)))
        EDGE['sockTop'] = c.z + 0.026
    _orient(bm)
    return bm


VEST_HEM = 1.03


def waistcoat(cage, J):
    """No sleeves (the armholes are the cage's shoulder ring), a deep V at the neck, to the waist, a little
    shaped; the hem a hand over the belt's top."""
    vgone = _v_open(1.22, 1.46, 0.085)
    bm = G.cut(cage, lambda v, p: p == PART['torso'] and v.co.z >= 1.08,
               keep_face=lambda f: not vgone(f))
    G.inflate(bm, lambda p, part: (0.022 + 0.004 * smoothstep(1.15, 1.30, p.z) - 0.003 * smoothstep(1.30, 1.10, p.z)
                                   - 0.006 * smoothstep(1.36, 1.44, p.z) * smoothstep(0.12, 0.06, abs(p.x))
                                   + 0.006 * smoothstep(0.14, 0.18, abs(p.x)) * smoothstep(1.22, 1.32, p.z)))
    for loop in G.boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z < 1.12:                           # the hem: on down to over the belt
            r1 = G.extrude(bm, loop, lambda p, v: p - Vector((0, 0, 0.026)))
            G.extrude(bm, r1, lambda p, v: p - Vector((0, 0, 1.085 - VEST_HEM - 0.026)) + G.radial((0.0, 0.015))(p) * 0.003)
            EDGE['vestHem'] = VEST_HEM
    _orient(bm)
    return bm


def gear(cage, J):
    """The belt (round the shorts under the waistcoat's hem) and its buckle; a pencil in the left chest
    pocket; the back's half-belt and buckle."""
    bm = bmesh.new()
    bm.verts.layers.int.new('part')
    for k in ('nx', 'ny', 'nz'):
        bm.verts.layers.float.new(k)
    z0, z1 = 0.990, 1.030
    K.band(bm, cage, PART['torso'], z0, z1, off=0.030, n=48, mat=0, thick=0.004)
    pts, c = K.ring_of(cage, PART['torso'], (z0 + z1) / 2)
    p, d = K.on_ring(pts, c, -math.pi / 2, 0.036, (z0 + z1) / 2)
    K.box(bm, p, (0.040, 0.006, 0.034), K.face_rot(d), bevel=0.002, mat=3)
    # the pencil standing out of the left chest pocket (the pockets are the waistcoat's relief)
    (cx, zc, w, h) = POCKETS[0]
    tp, tc = K.ring_of(cage, PART['torso'], zc)
    a = -math.pi / 2 + math.asin(min(0.95, cx / 0.15))
    p, d = K.on_ring(tp, tc, a, 0.030, zc)
    K.box(bm, p + Vector((-0.012, 0, h + 0.020)), (0.009, 0.009, 0.075), K.face_rot(d), bevel=0.002, mat=5)
    # the back's half-belt: a strap across the small of the back with a buckle
    zb = 1.10
    bp, bc = K.ring_of(cage, PART['torso'], zb)
    p, d = K.on_ring(bp, bc, math.pi / 2, 0.031, zb)
    K.box(bm, p, (0.150, 0.006, 0.022), K.face_rot(d), bevel=0.002, mat=4)
    K.box(bm, p + d * 0.004, (0.026, 0.005, 0.028), K.face_rot(d), bevel=0.0015, mat=3)
    return bm


def reweight(name, ob, arm, J):
    """The belt bends as the shorts under it, the back's strap as the waistcoat; the pencil and the buckles
    ride the cloth they are on, as one."""
    if name != 'GardenGear':
        return
    vest, shorts_ = bpy.data.objects['Waistcoat'], bpy.data.objects['Shorts']
    W = K.copy_weights(ob, shorts_, only=K.verts_of_mats(ob, {0}))
    W = K.copy_weights(ob, vest, W, only=K.verts_of_mats(ob, {4, 5}) | {i for i in K.verts_of_mats(ob, {3}) if ob.data.vertices[i].co.z > 1.06})
    R.set_weights(ob, W)
    R.set_weights(ob, K.rigid_islands(ob, skip_mats=(0,)))


# volume (tailor.py): the waistcoat's four patch pockets and their flaps, the shorts' cargo pockets and their
# flaps on the outside of the thighs, the knee patches sewn on proud
POCKETS = [(0.105, 1.255, 0.028, 0.028), (0.092, 1.115, 0.034, 0.032)]     # (|x|, z, half w, half h): chest, low


def _vest_relief(ob, J):
    rep = {}
    for i, (cx, cz, hw, hh) in enumerate(POCKETS):
        for sx in (-1, 1):
            rep[f'pocket{i}{sx}'] = T.raised(T.rect((sx * cx, 0, cz), (1, 0, 0), (0, 0, 1), hw, hh), height=0.0035,
                                             facing=(0, -1, 0))(ob, J)
            rep[f'flap{i}{sx}'] = T.raised(T.rect((sx * cx, 0, cz + hh * 0.62), (1, 0, 0), (0, 0, 1), hw + 0.003, hh * 0.42),
                                           height=0.0025, facing=(0, -1, 0))(ob, J)
    return rep


def _shorts_relief(ob, J):
    rep = {}
    kz = EDGE['shortsHem'] + 0.075
    for sx in (-1, 1):
        n = (sx, 0, 0)
        side = lambda P, s=sx: (P[:, 0] * s > 0.1) * 1.0
        rep[f'cargo{sx}'] = T.raised(T.rect((sx * 0.17, 0.030, 0.68), (0, 1, 0), (0, 0, 1), 0.036, 0.046), height=0.004,
                                     facing=n, where=side)(ob, J)
        rep[f'cargoFlap{sx}'] = T.raised(T.rect((sx * 0.17, 0.030, 0.712), (0, 1, 0), (0, 0, 1), 0.039, 0.015), height=0.0025,
                                         facing=n, where=side)(ob, J)
        rep[f'patch{sx}'] = T.raised(T.rect((sx * 0.12, 0, kz), (1, 0, 0), (0, 0, 1), 0.040, 0.043), height=0.0015,
                                     facing=(0, -1, 0), where=lambda P, s=sx: (P[:, 0] * s > 0.03) * (P[:, 2] < 0.7) * 1.0)(ob, J)
    return rep


RELIEF = {'Waistcoat': [_vest_relief], 'Shorts': [_shorts_relief]}


def _folds(piece):
    def f(P, N, zone, J):
        if piece == 'Shorts':
            dr = IP.drapes(P, J, angles=(-0.5, 0.4, 2.6), t_range=(0.12, 0.40), bow=0.25)
            leg = (P[:, 2] < 0.86) * (zone == 0)
            return [(dr[0] * leg, dr[1] * leg)]
        return []
    return f


# the shared painter (inkpaint.py): the shorts' long folds; the wool less hatched; the shirt lighter (most of
# it lies under the waistcoat, in its shadow: its sleeves kept from going muddy beside the armholes)
SHADE = {'Shorts': dict(folds=_folds('Shorts'), fold_ink=0.55), 'Socks': dict(hatch=0.3, cavity=0.5, tone=0.24),
         'GardenShirt': dict(tone=0.16, hatch=0.35)}

SKIN_CUT = []          # his forearms and hands all show
# the chest under the shirt's closed collar (measured under 97 % on the shared fit of #544, the misses at the
# collar's foot, where the fit no longer pushes the shirt out); the hips and thighs measure since #493's pass 5
EXTRA_HIDES = ['chest']

BUILDERS = {'GardenShirt': shirt, 'Shorts': shorts, 'Socks': socks, 'Waistcoat': waistcoat, 'GardenGear': gear}


# ------------------------------------------------------------------ the paint

def _rgb(name):
    return np.array(PAL[name], dtype=float) / 255


def _leg_axis(x, z, J):
    zs = [J['foot_l'].z, J['calf_l'].z, J['thigh_l'].z]
    cx = np.where(x > 0, 1, -1) * np.interp(z, zs, [J['foot_l'].x, J['calf_l'].x, J['thigh_l'].x])
    cy = np.interp(z, zs, [J['foot_l'].y, J['calf_l'].y, J['thigh_l'].y])
    return cx, cy


def paint(piece, zone, P, N, J):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    ax = np.abs(x)
    n = len(P)
    rng = np.random.default_rng(5451)
    out = np.zeros((n, 3))
    ink = _rgb('ink')
    band = K.band_mask

    def mix(mask, colour, k=1.0):
        nonlocal out
        a = (np.clip(mask, 0, 1) * k)[:, None]
        out = out * (1 - a) + np.asarray(colour)[None, :] * a

    front = np.clip(-N[:, 1] * 2.5, 0, 1)
    back = np.clip(N[:, 1] * 2.5, 0, 1)
    dash = (np.sin((x + z * 0.7 + y) / 0.004) > -0.2)
    if piece == 'GardenShirt':
        out[:] = _rgb('ochre')
        out[zone == 1] = _rgb('turquoise')
        torso = (ax < 0.2) & (zone == 0)
        # the placket and its buttons below the open neck
        mix(band(x - 0.004, 0.0013, 0.0008) * front * torso * (z < EDGE['collar']), ink, 0.6)
        # the open neck: a short V of shadow under the collar's front
        vv = (EDGE['collar'] - z) / 0.07
        mix((np.abs(x) < 0.022 * np.clip(1 - vv, 0, 1)) * (vv > 0) * front * torso, ink, 0.55)
        for k in range(3):
            mix((np.hypot(x - 0.010, z - (1.30 - k * 0.07)) < 0.0055) * front * torso, _rgb('button'))
        # seams: the shoulder, the sleeve's join
        mix(band(ax - 0.205, 0.0013, 0.0008) * (z > 1.28) * (zone == 0), ink, 0.45)
        mix(band(np.abs(x) - EDGE['sleeveEnd'] + 0.003, 0.0016, 0.001) * (zone == 1), ink, 0.5)
        out *= K.grain(rng, n)
    elif piece == 'Waistcoat':
        out[:] = _rgb('moss')
        # the front's edges (the V and on down), buttons below the V, darts, the back's centre seam
        mix(band(x, 0.0016, 0.001) * front * (z < 1.22), ink, 0.7)
        for k in range(4):
            mix((np.hypot(x - 0.006, z - (1.20 - k * 0.048)) < 0.0062) * front, _rgb('button'))
            mix(band(np.hypot(x - 0.006, z - (1.20 - k * 0.048)) - 0.0062, 0.0012, 0.0008) * front, ink, 0.8)
        mix(band(x, 0.0013, 0.0008) * back, ink, 0.4)
        for sx in (-1, 1):
            mix(band(x - sx * 0.07, 0.0012, 0.0008) * back * (z < 1.24), ink, 0.35)
        # top-stitching a little inside every edge
        mix(band(z - (VEST_HEM + 0.010), 0.0011, 0.0008) * dash, ink, 0.45)
        out *= K.grain(rng, n, 0.06)
    elif piece == 'Shorts':
        out[:] = _rgb('rust')
        roll = zone == 1
        cx, cy = _leg_axis(x, z, J)
        leg = z < 0.84
        # the turquoise patches over the knees, stitched round
        kz = EDGE['shortsHem'] + 0.075
        px = np.abs(x - cx) / 0.042
        pz = np.abs(z - kz) / 0.045
        patch = np.maximum(px, pz)
        on = leg & ~roll & (y - cy < 0) & (front > 0.2)
        mix((patch < 1) * on, _rgb('turquoise'))
        mix(band(patch - 0.92, 0.035, 0.02) * on * dash, ink, 0.7)
        mix(band(patch - 1.0, 0.02, 0.015) * on, ink, 0.5)
        # the fly, the side seams, the back pockets, the turn-ups' fold
        mix(band(x, 0.0016, 0.001) * front * (z > 0.86) * (z < 1.07), ink, 0.7)
        sidey = np.abs(N[:, 0]) > 0.35
        mix(band(y - cy, 0.0014, 0.001) * leg * sidey * ((x - cx) * np.sign(x) > 0) * dash, ink, 0.45)
        for sx in (-1, 1):
            box = np.maximum(np.abs(x - sx * 0.068) / 0.042, np.abs(z - 0.93) / 0.050)
            mix(band(box - 1, 0.03, 0.02) * back * (z > 0.86), ink, 0.6)
        mix(band(z - (EDGE['shortsHem'] + 0.032), 0.0015, 0.001) * roll, ink, 0.5)
        out *= K.grain(rng, n, 0.07)
    elif piece == 'Socks':
        out[:] = _rgb('wool')
        cx, cy = _leg_axis(x, z, J)
        ang = np.arctan2(y - cy, (x - cx) * np.sign(x + 1e-9))
        rib = np.sin(ang * 22)
        out *= (0.93 + 0.07 * rib)[:, None]
        mix((rib > 0.85), ink, 0.12)
        out *= K.grain(rng, n, 0.08)
    elif piece == 'GardenGear':
        out[:] = _rgb('belt')
        out[(zone == 1) | (zone == 4)] = _rgb('moss')
        out[zone == 2] = _rgb('rust')
        out[zone == 3] = _rgb('iron')
        out[zone == 5] = _rgb('pencil')
        mix((zone == 5) * (z > 1.385), _rgb('ink') * 2.2)
        out *= K.grain(rng, n, 0.05)
    return np.clip(out, 0, 1)

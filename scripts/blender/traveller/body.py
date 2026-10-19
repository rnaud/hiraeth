"""The traveller's base body (issue #493): a quad cage lofted round his bones, the left half built and
mirrored, subdivided once (every face a quad). Shapes in metres, Blender's frame (Z up, facing -Y, his left +X).
The rings sit where the joints bend (three loops round each elbow, knee and knuckle) so the skin folds there."""
import math
import bmesh
from mathutils import Vector
from loft import frame, transport, ring, ellipse, bridge, bridge_uneven, angle_of, sorted_loop, smoothstep, lerp

D = math.radians

# The torso's rings, hips to the base of the neck: height, half-width, front and back depth from the
# centre line y, the centre line, the superellipse (2 round, more square). The arm leaves through the
# side between the armpit ring and the shoulder ring.
TORSO = [
    # z      rx     front  back   cy     e
    (0.865, 0.160, 0.082, 0.100, 0.008, 2.3),   # 0 the hips at the crotch (the legs leave here)
    (0.940, 0.158, 0.080, 0.104, 0.010, 2.3),   # 1 hips / seat
    (1.010, 0.146, 0.075, 0.090, 0.010, 2.3),   # 2 the hip bones
    (1.085, 0.130, 0.074, 0.078, 0.012, 2.2),   # 3 waist
    (1.160, 0.136, 0.082, 0.082, 0.012, 2.2),   # 4 lower ribs
    (1.235, 0.146, 0.094, 0.090, 0.012, 2.3),   # 5 chest
    (1.300, 0.150, 0.098, 0.096, 0.014, 2.4),   # 6 armpit (the arm's hole, bottom)
    (1.345, 0.156, 0.094, 0.098, 0.016, 2.5),   # 7
    (1.388, 0.160, 0.084, 0.094, 0.018, 2.5),   # 8
    (1.425, 0.150, 0.066, 0.082, 0.022, 2.4),   # 9 shoulder top (the hole's top)
    (1.462, 0.074, 0.046, 0.058, 0.024, 2.0),   # 10 base of the neck
]
PARTS = ['torso', 'neck', 'arm', 'hand', 'finger', 'thumb', 'leg', 'foot']
MARKS = []


def mark(bm, name):
    """The verts made from here on belong to `name` (a part of PARTS), written to the 'part' layer."""
    MARKS.append((len(bm.verts), name))


HALF = 13          # verts in a half ring, front centre to back centre
HOLE_RINGS = (6, 9)
HOLE_COLS = (5, 7)
# the shoulder's point: the hole's columns pushed out (ring index -> x added)
SHOULDER_PUSH = {7: 0.012, 8: 0.016, 9: 0.008}


def torso_ring(bm, z, rx, rf, rb, cy, e, n=HALF):
    out = []
    k2 = 2.0 / e
    for k in range(n):
        th = math.pi * k / (n - 1)
        s, c = math.sin(th), math.cos(th)
        x = rx * (abs(s) ** k2)
        y = cy - math.copysign(abs(c) ** k2, c) * (rf if c >= 0 else rb)
        if k in (0, n - 1):
            x = 0.0
        out.append(bm.verts.new((x, y, z)))
    return out


def build(J, neck_rings, tag=None):
    """J: joint name -> Vector (Blender frame). neck_rings: [(z, rx, rf, rb, cy, half_count)] above the base
    of the neck, the last one the neck's top. Returns the bmesh (whole body, cage) and named loops."""
    bm = bmesh.new()
    MARKS.clear()
    mark(bm, 'torso')
    loops = {}
    rings = []
    for i, (z, rx, rf, rb, cy, e) in enumerate(TORSO):
        r = torso_ring(bm, z, rx, rf, rb, cy, e)
        if i in SHOULDER_PUSH:
            for k in range(HOLE_COLS[0], HOLE_COLS[1] + 1):
                r[k].co.x += SHOULDER_PUSH[i]
        rings.append(r)
    # the torso's faces, leaving the arm's hole
    for i in range(len(rings) - 1):
        for k in range(HALF - 1):
            if HOLE_RINGS[0] <= i < HOLE_RINGS[1] and HOLE_COLS[0] <= k < HOLE_COLS[1]:
                continue
            bm.faces.new((rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k]))
    # the neck: rings of its own count, up to the head's seam
    prev, prev_t = rings[-1], [k / (HALF - 1) for k in range(HALF)]
    mark(bm, 'neck')
    for (z, rx, rf, rb, cy, m) in neck_rings:
        r = torso_ring(bm, z, rx, rf, rb, cy, 2.0, m)
        t = [k / (m - 1) for k in range(m)]
        if len(r) == len(prev):
            bridge(bm, prev, r, closed=False)
        else:
            bridge_uneven(bm, prev, r, prev_t, t, closed=False)
        prev, prev_t = r, t
    loops['neck_top'] = prev

    # ---- the arm, out of the hole
    i0, i1 = HOLE_RINGS
    c0, c1 = HOLE_COLS
    hole = [rings[i0][k] for k in range(c0, c1 + 1)] + [rings[i][c1] for i in range(i0 + 1, i1)] \
        + [rings[i1][k] for k in range(c1, c0 - 1, -1)] + [rings[i][c0] for i in range(i1 - 1, i0, -1)]
    mark(bm, 'arm')
    arm(bm, J, hole)

    # ---- the leg, out of the hips' ring and the crotch
    mark(bm, 'torso')
    crotch = bm.verts.new((0.0, 0.012, 0.825))
    mark(bm, 'leg')
    leg(bm, J, rings[0] + [crotch])
    bm.verts.ensure_lookup_table()
    lay = bm.verts.layers.int.new('part')
    marks = MARKS + [(len(bm.verts), None)]
    for (a, name), (b, _) in zip(marks, marks[1:]):
        for i in range(a, b):
            bm.verts[i][lay] = PARTS.index(name)
    # mirror to the right side, welding the centre line
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.mirror(bm, geom=geom, axis='X', merge_dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def chain_rings(bm, first, rings_spec, A0, U0, target=None):
    """Loft from a loop `first` (verts) along rings_spec [(centre, axis, shape)], blending the loop's own
    angles into `target` (a list of angles) or a uniform spacing over the first few rings."""
    c0 = sum((v.co for v in first), Vector()) / len(first)
    A, U, V = frame(A0, U0)
    verts, angs = sorted_loop(first, c0, U, V)
    n = len(verts)
    if target is None:
        target = [angs[0] + 2 * math.pi * k / n for k in range(n)]
    else:
        # start the loop at the vert nearest the target's first angle
        best = min(range(n), key=lambda k: abs(math.remainder(angs[k] - target[0], 2 * math.pi)))
        verts = verts[best:] + verts[:best]
        angs = angs[best:] + [a + 2 * math.pi for a in angs[:best]]
        shift = round((target[0] - angs[0]) / (2 * math.pi))
        angs = [a + shift * 2 * math.pi for a in angs]
    prev = verts
    out = [verts]
    blend_n = min(3, len(rings_spec))
    for i, (c, axis, shape) in enumerate(rings_spec):
        A, U, V = transport(A, U, Vector(axis).normalized())
        t = min(1.0, (i + 1) / blend_n)
        a = [s * (1 - t) + g * t for s, g in zip(angs, target)]
        r = ring(bm, c, U, V, a, shape)
        bridge(bm, prev, r)
        prev = r
        out.append(r)
    return out, (A, U, V), target


def arm(bm, J, hole):
    sh, el, wr = J['upperarm_l'], J['lowerarm_l'], J['hand_l']
    up_axis = (el - sh).normalized()
    fo_axis = (wr - el).normalized()
    U0 = Vector((0, 0, 1))
    spec = []

    def at(a, b, t):
        return a.lerp(b, t)
    # (point, axis, radii up, down, front, back) along the upper arm and forearm
    rows = [
        (at(sh, el, 0.12) + Vector((0, 0, -0.004)), up_axis, 0.050, 0.046, 0.050, 0.052),  # the deltoid
        (at(sh, el, 0.32), up_axis, 0.044, 0.041, 0.043, 0.044),
        (at(sh, el, 0.55), up_axis, 0.040, 0.038, 0.041, 0.040),   # biceps
        (at(sh, el, 0.80), up_axis, 0.036, 0.034, 0.035, 0.036),
        (el + up_axis * -0.012, up_axis, 0.034, 0.033, 0.033, 0.036),
        (el, (up_axis + fo_axis).normalized(), 0.034, 0.033, 0.032, 0.038),   # the elbow
        (el + fo_axis * 0.018, fo_axis, 0.036, 0.034, 0.035, 0.036),
        (at(el, wr, 0.25), fo_axis, 0.037, 0.034, 0.036, 0.033),   # the forearm's muscle
        (at(el, wr, 0.50), fo_axis, 0.034, 0.031, 0.031, 0.029),
        (at(el, wr, 0.75), fo_axis, 0.030, 0.028, 0.025, 0.023),
    ]
    for (c, ax, ru, rd, rf, rb) in rows:
        spec.append((c, ax, ellipse(ru * 1.08, rd * 1.08, rf * 1.08, rb * 1.08)))
    target = [D(18 + 36 * k) for k in range(10)]
    out, fr, _ = chain_rings(bm, hole, spec, (el - sh).normalized(), U0, target)
    hand(bm, J, out[-1])


def hand(bm, J, last):
    """The left hand, palm forward (-Y), thumb up: four palm rings (wrist to knuckles) of ten verts, five
    columns across on the palm and the back; the four fingers out of the knuckle ring, the thumb out of the
    index side."""
    fingers = ['index', 'middle', 'ring', 'pinky']
    k01 = [J[f'{f}_01_l'] for f in fingers]
    zf = [p.z for p in k01]
    cols_k = [zf[0] + 0.5 * (zf[0] - zf[1]) + 0.002] + [(zf[i] + zf[i + 1]) / 2 for i in range(3)] + [zf[3] - 0.5 * (zf[2] - zf[3]) - 0.002]
    xk = [k01[0].x] + [(k01[i].x + k01[i + 1].x) / 2 for i in range(3)] + [k01[3].x]
    hj = J['hand_l']
    cy = hj.y
    wrist_x = hj.x - 0.010
    zc_w = hj.z + 0.002
    cols_w = [zc_w + 0.026, zc_w + 0.013, zc_w, zc_w - 0.013, zc_w - 0.025]
    # (x of each column, z of each column, half thickness palm side, back side)
    def palm_ring(t):
        xs = [lerp(wrist_x, xk[j] - 0.008, t) for j in range(5)]
        zs = [lerp(cols_w[j], cols_k[j], t ** 0.8) for j in range(5)]
        tp = lerp(0.018, 0.012, t) + 0.004 * math.sin(math.pi * min(1, t * 1.4))   # the thenar and palm pad
        tb = lerp(0.016, 0.011, t)
        verts = []
        for j in range(5):
            edge = 0.72 if j in (0, 4) else (0.94 if j in (1, 3) else 1.0)
            verts.append(bm.verts.new((xs[j], cy - tp * edge, zs[j])))
        for j in range(4, -1, -1):
            edge = 0.72 if j in (0, 4) else (0.94 if j in (1, 3) else 1.0)
            verts.append(bm.verts.new((xs[j], cy + tb * edge, zs[j])))
        return verts
    mark(bm, 'hand')
    r0 = palm_ring(0.0)
    bridge(bm, last, r0)
    r1, r2, r3 = palm_ring(0.36), palm_ring(0.70), palm_ring(1.0)
    for a, b, skip in ((r0, r1, True), (r1, r2, True), (r2, r3, False)):
        for k in range(10):
            if skip and k == 9:
                continue
            k1 = (k + 1) % 10
            bm.faces.new((a[k], a[k1], b[k1], b[k]))
    # the four fingers: finger i rises from palm columns i, i+1
    radii = {'index': 0.0092, 'middle': 0.0095, 'ring': 0.0090, 'pinky': 0.0080}
    tips = {'index': 0.024, 'middle': 0.026, 'ring': 0.025, 'pinky': 0.021}
    for i, f in enumerate(fingers):
        base = [r3[i], r3[i + 1], r3[9 - (i + 1)], r3[9 - i]]
        p1, p2, p3 = J[f'{f}_01_l'], J[f'{f}_02_l'], J[f'{f}_03_l']
        tip = p3 + (p3 - p2).normalized() * tips[f]
        mark(bm, 'finger')
        finger(bm, base, [p1, p2, p3, tip], radii[f], 4)
    # the thumb out of the index side's two lower faces
    hole = [r0[0], r1[0], r2[0], r2[9], r1[9], r0[9]]
    t1, t2, t3 = J['thumb_01_l'], J['thumb_02_l'], J['thumb_03_l']
    tip = t3 + (t3 - t2).normalized() * 0.026
    mark(bm, 'thumb')
    finger(bm, hole, [t1, t2, t3, tip], 0.0115, 6, thumb=True)


def finger(bm, base, pts, r, n, thumb=False):
    p1, p2, p3, tip = pts
    A0 = (p2 - p1).normalized()
    U0 = Vector((0, 0, 1)) if not thumb else Vector((0, -1, 0))
    spec = []
    k = 1.32 if n == 4 else 1.12   # the cage's corners lie outside its smoothed surface

    def row(c, ax, rr, flat=0.86):
        spec.append((c, ax, ellipse(rr * k, rr * k, rr * k * flat, rr * k * flat)))
    s1, s2, s3 = (p2 - p1), (p3 - p2), (tip - p3)
    if thumb:
        row(p1 + s1 * 0.15, s1, r * 1.25, 0.9)
        row(p1 + s1 * 0.55, s1, r * 1.05, 0.9)
    else:
        row(p1 + s1 * 0.18, s1, r * 1.04)
        row(p1 + s1 * 0.60, s1, r * 0.96)
    row(p2, (s1 + s2), r * 1.0)
    row(p2 + s2 * 0.5, s2, r * 0.92)
    row(p3, (s2 + s3), r * 0.92)
    row(p3 + s3 * 0.5, s3, r * 0.86)
    row(p3 + s3 * 0.88, s3, r * 0.70)
    if n == 4:
        target = [D(45 + 90 * j) for j in range(4)]
    else:
        target = None
    out, _, _ = chain_rings(bm, base, spec, A0, U0, target)
    last = out[-1]
    bm.faces.new(last if n == 4 else last)


def leg(bm, J, top):
    hip, knee, ankle, ball = J['thigh_l'], J['calf_l'], J['foot_l'], J['ball_l']
    down = Vector((0, 0, -1))
    U0 = Vector((0, -1, 0))   # the front
    # rings: (centre, axis, front, back, medial, lateral)
    def at(a, b, t):
        return a.lerp(b, t)
    thigh_axis = (knee - hip).normalized()
    shin_axis = (ankle - knee).normalized()
    rows = [
        (Vector((0.098, 0.014, 0.800)), thigh_axis, 0.082, 0.086, 0.074, 0.084),
        (at(hip, knee, 0.33) + Vector((0, -0.006, 0)), thigh_axis, 0.074, 0.074, 0.066, 0.074),
        (at(hip, knee, 0.55) + Vector((0, -0.006, 0)), thigh_axis, 0.066, 0.064, 0.058, 0.064),
        (at(hip, knee, 0.78) + Vector((0, -0.006, 0)), thigh_axis, 0.056, 0.054, 0.051, 0.054),
        (knee + Vector((0, -0.006, 0.020)), thigh_axis, 0.052, 0.050, 0.048, 0.050),   # above the knee
        (knee + Vector((0, -0.004, 0.0)), (thigh_axis + shin_axis).normalized(), 0.052, 0.047, 0.047, 0.048),   # the knee
        (knee + Vector((0, 0.0, -0.030)), shin_axis, 0.045, 0.052, 0.046, 0.048),
        (at(knee, ankle, 0.25), shin_axis, 0.042, 0.060, 0.046, 0.048),   # the calf
        (at(knee, ankle, 0.45), shin_axis, 0.038, 0.052, 0.041, 0.043),
        (at(knee, ankle, 0.68), shin_axis, 0.031, 0.038, 0.033, 0.034),
        (at(knee, ankle, 0.86), shin_axis, 0.027, 0.032, 0.028, 0.030),
        (ankle + Vector((0, 0.002, 0.010)), shin_axis, 0.029, 0.034, 0.032, 0.031),   # the ankle bones
    ]
    spec = [(c, ax, ellipse(f * 1.06, b * 1.06, m * 1.06, l * 1.06)) for (c, ax, f, b, m, l) in rows]
    out, (A, U, V), angs = chain_rings(bm, top, spec, down, U0)
    # the foot: the rings turn from down to forward round the heel
    fwd = (ball - Vector((ankle.x, ankle.y, ball.z))).normalized()
    fx = ankle.x + 0.002
    frows = [
        # centre, axis, up/front(U), back(-U), medial(V), lateral(-V)
        (Vector((fx, ankle.y + 0.004, 0.072)), (down + fwd * 0.9).normalized(), 0.040, 0.048, 0.036, 0.036),
        (Vector((fx + 0.002, ankle.y - 0.030, 0.045)), (down * 0.35 + fwd).normalized(), 0.044, 0.044, 0.040, 0.044),
        (Vector((fx + 0.004, ankle.y - 0.075, 0.034)), fwd, 0.034, 0.032, 0.040, 0.046),
        (Vector((fx + 0.004, ball.y - 0.006, 0.026)), fwd, 0.026, 0.025, 0.042, 0.048),   # the ball
        (Vector((fx + 0.002, ball.y - 0.040, 0.020)), fwd, 0.019, 0.018, 0.038, 0.040),   # the toes
        (Vector((fx + 0.001, ball.y - 0.060, 0.017)), fwd, 0.012, 0.012, 0.026, 0.028),
    ]
    prev = out[-1]
    mark(bm, 'foot')
    for (c, ax, f, b, m, l) in frows:
        A, U, V = transport(A, U, Vector(ax).normalized())
        r = ring(bm, c, U, V, angs, ellipse(f * 1.08, b * 1.08, m * 1.08, l * 1.08))
        bridge(bm, prev, r)
        prev = r
    bm.faces.new(prev)

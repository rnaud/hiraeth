"""A shape target for an outfit (issue #684): a Tripo figure of the outfit (one fused shell: body, clothes,
hair) placed on the traveller and unposed to his rest pose, so the Blender garments can be drawn to its shape.
It is only a shape (and, through its texture, a map of which garment is where): its colours, face and hair are
never used in the outfit.

    tgt = load(path, J, arm, body)       # imported, turned to face -Y, scaled and placed, arms unposed
    hit = tgt.ray(p, n, reach)           # nearest surface along +-n: (point, normal, colour) or None

Placement (`place`): the Tripo export is 1 unit tall (soles to the top of the hair), facing +X, Y up in glTF.
It is turned to face -Y, scaled so its neck (the narrowest section between the shoulders and the head) sits at
the traveller's, its soles on the ground, and centred over his pelvis and ankles in plan.

Unposing (`unpose`): the Tripo figure stands in an A-pose (arms ~76-78 degrees down from his T-pose rest). The
rig is posed to the figure's arms (each upper arm turned down about the armature's Y axis to the angle of the
figure's arm, measured from its shoulder to its hand), every Tripo vertex takes the skinning of the nearest posed
body (an arm's or the rest's, smoothed over the shell within its group), and is carried back to the rest pose by
the inverse of its blended bone matrix: a linear-blend unskin. Away from the armpits this is exact; there the
shell's fused arm-to-torso faces stretch, and they are left out (stretched past 2.5x).

Straightening (`straighten`): the figure's trunk and legs moved in plan onto his, section by section."""
import math
import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

NECK_Z = 1.528        # the traveller's narrowest neck section (head-v3's neck), metres


def _import(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    for o in new:
        if o.type != 'MESH':
            o.parent = None
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
        o.parent = None
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    with bpy.context.temp_override(selected_editable_objects=[ob], object=ob, active_object=ob):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o.name in bpy.data.objects and o != ob and o.type != 'MESH':
            bpy.data.objects.remove(o)
    ob.name = 'ShapeTarget'
    bm = bmesh.new()                       # (the glTF's verts split at its UV seams: one surface again)
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def _coords(ob):
    a = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get('co', a)
    return a.reshape(-1, 3)


def _set_coords(ob, a):
    ob.data.vertices.foreach_set('co', np.asarray(a, dtype=float).ravel())
    ob.data.update()


def neck_z(P):
    """The narrowest horizontal section between the shoulders and the head: the neck."""
    lo, hi = P[:, 2].min(), P[:, 2].max()
    h = hi - lo
    best = None
    for z in np.linspace(lo + 0.78 * h, lo + 0.92 * h, 60):
        s = P[np.abs(P[:, 2] - z) < 0.004 * h]
        if len(s) < 8:
            continue
        w = (s[:, 0].max() - s[:, 0].min()) + (s[:, 1].max() - s[:, 1].min())
        if best is None or w < best[0]:
            best = (w, z)
    return best[1]


def place(ob, J, facing=-90.0):
    """Turn the figure to face -Y (`facing`: degrees about Z), scale its neck to the traveller's, soles on the
    ground, centred in plan on his ankles below the knee and on his pelvis above it. Returns the scale."""
    P = _coords(ob)
    r = math.radians(facing)
    c, s = math.cos(r), math.sin(r)
    P = P @ np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])
    P[:, 2] -= P[:, 2].min()
    k = NECK_Z / neck_z(P)
    P *= k
    # plan: the trunk's centre between the hips and the chest, measured on the shell's middle third (no arms)
    trunk = P[(P[:, 2] > 0.95) & (P[:, 2] < 1.30)]
    mid = trunk[np.abs(trunk[:, 0] - np.median(trunk[:, 0])) < 0.12]
    cx = 0.5 * (mid[:, 0].min() + mid[:, 0].max())
    cy = 0.5 * (mid[:, 1].min() + mid[:, 1].max())
    P[:, 0] -= cx
    P[:, 1] += J['spine_01'].y - cy if 'spine_01' in J else J['pelvis'].y - cy
    _set_coords(ob, P)
    return k


def hands(P, J):
    """Each hand's centre on the shell: the lowest tenth of what lies outside the trunk on that side."""
    out = {}
    for side, s in (('l', 1), ('r', -1)):
        sh = J['upperarm_' + side]
        cand = P[(s * P[:, 0] > abs(sh.x) * 0.9 + 0.05) & (P[:, 2] > 0.55) & (P[:, 2] < sh.z - 0.15)]
        lo = cand[cand[:, 2] < np.percentile(cand[:, 2], 8)]
        out[side] = Vector(lo.mean(0))
    return out


def arm_pose(arm, P, J):
    """Pose the rig's arms down to the figure's: each upper arm about the armature's Y (forward) axis so its
    shoulder-to-hand line meets the figure's hand. Returns the angles (degrees)."""
    hs = hands(P, J)
    ang = {}
    pb = arm.pose.bones
    for side, s in (('l', 1), ('r', -1)):
        sh = J['upperarm_' + side]
        rest = (J['hand_' + side] - sh)
        want = (hs[side] - sh)
        # angle in the frontal (XZ) plane, and the forward lean in the side (YZ) plane
        a_rest = math.atan2(rest.z, s * rest.x)
        a_want = math.atan2(want.z, s * want.x)
        da = a_want - a_rest
        lean = math.atan2(want.y - rest.y * (want.length / rest.length), math.hypot(want.x, want.z))
        b = pb['upperarm_' + side]
        b.rotation_mode = 'QUATERNION'
        q_world = Matrix.Rotation(-s * da, 4, 'Y').to_quaternion()
        # world rotation about the shoulder carried into the bone's local frame
        M = arm.matrix_world @ b.bone.matrix_local
        local = M.to_3x3().inverted() @ q_world.to_matrix() @ M.to_3x3()
        b.rotation_quaternion = local.to_quaternion()
        ang[side] = round(math.degrees(da), 1)
    bpy.context.view_layer.update()
    return ang, hs


def _skin_mats(arm):
    return {b.name: (arm.matrix_world @ b.matrix @ b.bone.matrix_local.inverted() @ arm.matrix_world.inverted())
            for b in arm.pose.bones}


def _weights(ob, bones):
    names = {g.index: g.name for g in ob.vertex_groups if g.name in bones}
    return [{names[g.group]: g.weight for g in v.groups if g.group in names and g.weight > 0} for v in ob.data.vertices]


ARM_CHAIN = ('upperarm', 'lowerarm', 'hand')


def unpose(ob, arm, sources, bones, k=6):
    """Carry the shell from the rig's current pose back to rest. Each vertex is first given to an arm or to the
    rest of him by the nearest posed body surface of each (the rest by a 5 mm margin), the labels then voted over
    the shell's edges so no island flies off with the wrong limb (a hand hangs beside the thigh), then takes the inverse-distance mix of the nearest posed source verts of that group, and
    is unskinned by the inverse of its blended bone matrix. Returns the faces stretched past 2.5x (the shell's
    fused arm-to-torso faces), which the target leaves out."""
    dg = bpy.context.evaluated_depsgraph_get()
    arm_bones = {s: {b for b in bones if b.endswith('_' + s) and (b.startswith(ARM_CHAIN) or
                     b.startswith(('thumb', 'index', 'middle', 'ring', 'pinky')))} for s in 'lr'}
    pts, W, grp = [], [], []
    for s in sources:
        ev = s.evaluated_get(dg)
        me = ev.to_mesh()
        w = _weights(s, bones)
        for v, wv in zip(me.vertices, w):
            pts.append((s.matrix_world @ v.co).copy())
            W.append(wv)
            share = {g: sum(x for b, x in wv.items() if b in arm_bones[g]) for g in 'lr'}
            grp.append('l' if share['l'] > 0.5 else 'r' if share['r'] > 0.5 else 'rest')
        ev.to_mesh_clear()
    trees = {}
    for g in ('l', 'r', 'rest'):
        ids = [i for i, x in enumerate(grp) if x == g]
        kd = KDTree(len(ids))
        for i in ids:
            kd.insert(pts[i], i)
        kd.balance()
        trees[g] = kd
    mats = _skin_mats(arm)
    P = _coords(ob)
    # each vertex to the group whose posed body surface is nearest (the rest of him by a 5 mm margin), then the
    # labels voted over the shell's edges so no island flies off with the wrong limb
    D = np.stack([[trees[g].find(Vector(p))[2] for p in P] for g in ('l', 'r', 'rest')], 1)
    D[:, 2] -= 0.005
    cls = D.argmin(1)
    n = len(P)
    ea0 = np.array([e.vertices[:] for e in ob.data.edges])
    for _ in range(8):
        votes = np.zeros((n, 3))
        np.add.at(votes, (ea0[:, 0], cls[ea0[:, 1]]), 1)
        np.add.at(votes, (ea0[:, 1], cls[ea0[:, 0]]), 1)
        votes[np.arange(n), cls] += 1.5
        cls = votes.argmax(1)
    names = sorted(bones)
    col = {b: i for i, b in enumerate(names)}
    Wm = np.zeros((n, len(names)))
    for vi, p in enumerate(P):
        tot = 0.0
        for co, i, d in trees[('l', 'r', 'rest')[cls[vi]]].find_n(Vector(p), k):
            w = 1.0 / max(d, 1e-4) ** 2
            tot += w
            for b, x in W[i].items():
                Wm[vi, col[b]] += x * w
        Wm[vi] /= max(tot, 1e-9)
    # smoothed over the shell's edges within a group (never across an arm's side and the torso it touches)
    ea = np.array([e.vertices[:] for e in ob.data.edges])
    ea = ea[cls[ea[:, 0]] == cls[ea[:, 1]]]
    deg = np.bincount(ea.ravel(), minlength=n).astype(float)[:, None]
    for _ in range(4):
        acc = np.zeros_like(Wm)
        np.add.at(acc, ea[:, 0], Wm[ea[:, 1]])
        np.add.at(acc, ea[:, 1], Wm[ea[:, 0]])
        Wm = np.where(deg > 0, 0.5 * Wm + 0.5 * acc / np.maximum(deg, 1), Wm)
    Wm /= np.maximum(Wm.sum(1, keepdims=True), 1e-9)
    Ms = np.array([np.array(mats[b]) for b in names])
    used = np.where(Wm.max(0) > 0)[0]
    out = np.empty_like(P)
    for vi in range(n):
        idx = used[Wm[vi, used] > 1e-4]
        M = np.tensordot(Wm[vi, idx], Ms[idx], axes=1)
        q = np.linalg.solve(M, np.append(P[vi], 1.0))
        out[vi] = q[:3] / q[3]
    before = [p.area for p in ob.data.polygons]
    _set_coords(ob, out)
    stretched = {p.index for p, a in zip(ob.data.polygons, before) if p.area > 2.5 * a + 2e-6}
    return stretched


def straighten(ob, body, crotch=0.86, sigma=0.03):
    """The figure's stance to his: above the crotch each 1 cm section's front-to-back centre (a strip down the
    middle) moved onto his body's; below it each leg's section centre onto his leg's, in plan; the moves smoothed
    over the height. Returns the largest move (m)."""
    P = _coords(ob)
    B = np.array([body.matrix_world @ v.co for v in body.data.vertices])
    zs = np.arange(0.0, 1.80, 0.01)

    def centre(Q, z, sel):
        s = Q[(np.abs(Q[:, 2] - z) < 0.012) & sel(Q)]
        if len(s) < 6:
            return None
        return np.array([0.5 * (np.percentile(s[:, 0], 3) + np.percentile(s[:, 0], 97)),
                         0.5 * (np.percentile(s[:, 1], 3) + np.percentile(s[:, 1], 97))])

    def series(sel_t, sel_b, use_x):
        d = []
        for z in zs:
            a, b = centre(P, z, sel_t), centre(B, z, sel_b)
            d.append(None if a is None or b is None else (b - a) * np.array([use_x, 1.0]))
        good = [i for i, x in enumerate(d) if x is not None]
        arr = np.array([d[i] if d[i] is not None else d[min(good, key=lambda g: abs(g - i))] for i in range(len(zs))])
        w = np.exp(-0.5 * ((zs[:, None] - zs[None, :]) / sigma) ** 2)
        return (w @ arr) / w.sum(1, keepdims=True)

    trunk = series(lambda Q: np.abs(Q[:, 0]) < 0.06, lambda Q: np.abs(Q[:, 0]) < 0.06, 0.0)
    legs = {s: series(lambda Q, s=s: (s * Q[:, 0] > 0.02) & (s * Q[:, 0] < 0.30),
                      lambda Q, s=s: (s * Q[:, 0] > 0.02) & (s * Q[:, 0] < 0.30), 1.0) for s in (1, -1)}
    move = np.zeros_like(P)
    zi = np.clip(np.rint(P[:, 2] / 0.01).astype(int), 0, len(zs) - 1)
    t = np.clip((P[:, 2] - (crotch - 0.04)) / 0.08, 0, 1)[:, None]       # legs below, trunk above, blended
    side = np.where(P[:, 0] >= 0, 1, -1)
    leg = np.where(side[:, None] > 0, legs[1][zi], legs[-1][zi])
    move[:, :2] = leg * (1 - t) + trunk[zi] * t
    _set_coords(ob, P + move)
    return float(np.abs(move).max())


class Target:
    """The placed, unposed shell: rays against it and its texture's colour where they land."""

    def __init__(self, ob):
        self.ob = ob
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        bm.faces.ensure_lookup_table()
        self.bm = bm
        self.uv = bm.loops.layers.uv.active
        self.tree = BVHTree.FromBMesh(bm)
        img = None
        for m in ob.data.materials:
            for nd in (m.node_tree.nodes if m and m.node_tree else []):
                if nd.type == 'TEX_IMAGE' and nd.image and nd.outputs[0].links and \
                        any(l.to_socket.name == 'Base Color' for l in nd.outputs[0].links):
                    img = nd.image
        self.tex = None
        if img is not None:
            w, h = img.size
            a = np.empty(w * h * 4, dtype=np.float32)
            img.pixels.foreach_get(a)
            self.tex = a.reshape(h, w, 4)[..., :3]
        self._maps = {}

    def uv_at(self, loc, fi):
        """The shell's UV at a point on face fi."""
        f = self.bm.faces[fi]
        a, b, c = (l.vert.co for l in f.loops)
        v0, v1, v2 = b - a, c - a, loc - a
        d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
        den = d00 * d11 - d01 * d01 or 1e-12
        wb = (d11 * d20 - d01 * d21) / den
        wc = (d00 * d21 - d01 * d20) / den
        wa = 1 - wb - wc
        uv = sum((l[self.uv].uv * w for l, w in zip(f.loops, (wa, wb, wc))), Vector((0, 0)))
        return uv[0], uv[1]

    def class_map(self, protos, among=None, radius=2, rounds=2):
        """The shell's texture as classes (each the nearest prototype, chroma counted twice: the baked light moves lightness more than hue), cleaned in its own UV space: a vote over
        a (2 radius + 1) square, `rounds` times, so the texture's ink lines and specks of baked light go and its
        flat zones stay. Cached per set of classes."""
        key = (tuple(sorted(protos)), tuple(sorted(among)) if among else None)
        if key in self._maps:
            return self._maps[key]
        names = [n for n in protos if among is None or n in among]
        Pc = np.array([protos[n] for n in names], dtype=float)
        a = self.tex.reshape(-1, 3).astype(float) * 255
        cl = a.mean(1, keepdims=True)
        pl = Pc.mean(1, keepdims=True)
        dl = cl - pl.T
        dc = (a - cl)[:, None, :] - (Pc - pl)[None]
        lab = (0.5 * dl ** 2 + 2.0 * (dc ** 2).sum(-1)).argmin(1).reshape(self.tex.shape[:2])
        h, w = lab.shape
        for _ in range(rounds):
            votes = np.zeros((len(names), h, w), dtype=np.int16)
            for k in range(len(names)):
                one = (lab == k).astype(np.int32)
                c = np.pad(one, radius, mode='edge').cumsum(0).cumsum(1)
                c = np.pad(c, ((1, 0), (1, 0)))
                r2 = 2 * radius + 1
                votes[k] = c[r2:r2 + h, r2:r2 + w] - c[:h, r2:r2 + w] - c[r2:r2 + h, :w] + c[:h, :w]
            lab = votes.argmax(0)
        self._maps[key] = (names, lab)
        return names, lab

    def klass(self, uv, protos, among=None):
        """The cleaned class at a UV (class_map)."""
        names, lab = self.class_map(protos, among)
        h, w = lab.shape
        return names[lab[int(min(h - 1, max(0, uv[1] * h))), int(min(w - 1, max(0, uv[0] * w)))]]

    def ray(self, p, n, out=0.04, inward=0.02):
        """The shell along the vert's normal: the nearer of the hits out (up to `out`) and in (up to `inward`).
        Returns (signed distance along n, point, face normal, uv) or None."""
        p, n = Vector(p), Vector(n).normalized()
        best = None
        for d, reach in ((n, out), (-n, inward)):
            loc, nor, fi, dist = self.tree.ray_cast(p, d, reach)
            if loc is None:
                continue
            sd = dist if d is n else -dist
            if best is None or abs(sd) < abs(best[0]):
                best = (sd, loc, nor, fi)
        if best is None:
            return None
        return best[0], best[1], best[2], self.uv_at(best[1], best[3])


def load(path, J, arm, sources, bones):
    """Import, place and unpose a shape target. Returns (Target, report)."""
    from poses import reset
    ob = _import(path)
    k = place(ob, J)
    P = _coords(ob)
    ang, hs = arm_pose(arm, P, J)
    stretched = unpose(ob, arm, sources, bones)
    reset(arm)
    bpy.context.view_layer.update()
    moved = straighten(ob, sources[0])
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in stretched], context='FACES')
    # what the cut leaves as small islands (a hand's fragments beside the thigh) goes too
    seen, small = set(), []
    for f in bm.faces:
        if f in seen:
            continue
        isl, stack = [], [f]
        seen.add(f)
        while stack:
            g = stack.pop()
            isl.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen:
                        seen.add(h)
                        stack.append(h)
        if len(isl) < 400:
            small += isl
    bmesh.ops.delete(bm, geom=small, context='FACES')
    bm.to_mesh(ob.data)
    bm.free()
    report = {'scale': round(k, 4), 'armDown': ang, 'hands': {s: [round(x, 3) for x in h] for s, h in hs.items()},
              'stance': round(moved, 3), 'stretchedFaces': len(stretched),
              'triangles': sum(len(p.vertices) - 2 for p in ob.data.polygons)}
    return Target(ob), report


# ---- the garments drawn to the shell -------------------------------------------------------------------------

def conform(ob, tgt, protos, accept, out=0.04, inward=0.025, where=None, sigma=0.02, limit=None, k0=0.6):
    """Draw a garment to the shell: each vert's ray along its normal (out up to `out`, in up to `inward`) to the
    shell counts where it lands on one of the `accept` colours (the garment's own: the shell's harness, skin or
    hair never shape a jacket), where the shell faces the same way (cos > 0.3) and `where(p)` allows. The signed
    distances are low-passed in space (a Gaussian of `sigma` over the hits facing the same way: the shell's sculpted
    crinkles go, its cut and volume stay), fading out where there are few hits (`k0`), and applied along the
    normals. Returns a report."""
    me = ob.data
    n = len(me.vertices)
    sd = np.zeros(n)
    hit = np.zeros(n, bool)
    names = set(protos)
    # the direction each vert moves: its normal averaged over `sigma` (a garment's sewn gathers tilt the normals
    # every centimetre; moved along those, a few centimetres bunch the verts into stripes)
    N0 = np.array([v.normal[:] for v in me.vertices])
    allkd = KDTree(n)
    for v in me.vertices:
        allkd.insert(v.co, v.index)
    allkd.balance()
    Ns = np.zeros_like(N0)
    for v in me.vertices:
        idx = [(j, d) for co, j, d in allkd.find_range(v.co, 1.5 * sigma) if N0[j] @ N0[v.index] > 0.3]
        acc = sum((N0[j] * math.exp(-0.5 * (d / (0.75 * sigma)) ** 2) for j, d in idx), np.zeros(3))
        Ns[v.index] = acc / max(np.linalg.norm(acc), 1e-9)
    for v in me.vertices:
        if where is not None and not where(v.co):
            continue
        nv = Vector(Ns[v.index])
        r = tgt.ray(v.co, nv, out, inward)
        if r is None or r[2].dot(nv) < 0.3:
            continue
        if tgt.klass(r[3], protos) in accept:
            sd[v.index] = r[0]
            hit[v.index] = True
    ids = np.where(hit)[0]
    field = np.zeros(n)
    if len(ids):
        kd = KDTree(len(ids))
        for j, i in enumerate(ids):
            kd.insert(me.vertices[int(i)].co, j)
        kd.balance()
        N = Ns
        for v in me.vertices:
            acc = tot = 0.0
            for co, j, d in kd.find_range(v.co, 3 * sigma):
                i = ids[j]
                c = float(N[i] @ N[v.index])
                if c <= 0.2:
                    continue
                w = math.exp(-0.5 * (d / sigma) ** 2) * c
                acc += w * sd[i]
                tot += w
            if tot > 0:
                field[v.index] = acc / tot * (tot / (tot + k0))
    if limit is not None:
        field = np.clip(field, -limit, limit)
    for v in me.vertices:
        v.co += Vector(Ns[v.index]) * float(field[v.index])
    me.update()
    return {'hit': round(float(hit.mean()), 3), 'meanMm': round(float(np.abs(field[hit]).mean() * 1000), 1) if hit.any() else 0,
            'outMm': round(float(field.max() * 1000), 1), 'inMm': round(float(-field.min() * 1000), 1)}

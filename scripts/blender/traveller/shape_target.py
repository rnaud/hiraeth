"""A shape target for an outfit (issue #684): a Tripo figure of the outfit (one fused shell: body, clothes, hair)
placed on the traveller and unposed to his rest pose; the outfit's garments are cut out of it. Its texture is used
only as a map of which garment is where; its colours, face, hair and hands are never used in the outfit.

    tgt, report = load(path, J, arm, [body, skin], bones)   # imported, turned, scaled, unposed, straightened
    labels = face_labels(tgt, colours)                       # each triangle's class from the cleaned colour map
    reach_wrists(tgt, labels, J)                             # its sleeves carried out to his wrists
    BUILDERS = {piece: shell(select, hems, under)}           # a piece cut out (region), re-meshed later (retopo)
    transfer(tgt, colours, P, N, classes, default)           # the map on a piece's texels, for flat paint

Placement (`place`): the Tripo export is 1 unit tall (soles to the top of the hair), facing +X, Y up in glTF. It is
turned to face -Y, scaled so its neck (the narrowest section between the shoulders and the head) sits at the
traveller's, its soles on the ground, and centred over his trunk in plan.

Unposing (`unpose`): the figure stands in an A-pose (arms ~76-78 degrees down from his T-pose rest). The rig is
posed to the figure's arms (each upper arm turned down about the armature's Y axis to the angle of the figure's arm,
measured from its shoulder to its hand); every vertex takes the skinning of the nearest posed body (an arm's or the
rest's, smoothed over the shell within its group) and is carried back to the rest pose by the inverse of its blended
bone matrix: a linear-blend unskin. Away from the armpits this is exact; there the shell's fused arm-to-torso faces
stretch, and they are left out (stretched past 2.5x).

Straightening (`straighten`): the figure's trunk leaned onto his as a straight line, each leg's sections onto his.
"""
import math
import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

DEBUG = False
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
    """The figure's stance to his: above the crotch the trunk leaned onto his body (a straight line fitted to its 1 cm
    sections' front-to-back centres, a strip down the middle, against his: section by section, its pack and lapels
    sheared the chest forward); below it each leg's section centre onto his leg's, in plan, smoothed over 8 cm.
    Returns the largest move (m)."""
    P = _coords(ob)
    B = np.array([body.matrix_world @ v.co for v in body.data.vertices])
    zs = np.arange(0.0, 1.80, 0.01)

    def centre(Q, z, sel):
        s = Q[(np.abs(Q[:, 2] - z) < 0.012) & sel(Q)]
        if len(s) < 6:
            return None
        return np.array([0.5 * (np.percentile(s[:, 0], 3) + np.percentile(s[:, 0], 97)),
                         0.5 * (np.percentile(s[:, 1], 3) + np.percentile(s[:, 1], 97))])

    def series(sel_t, sel_b, use_x, sig, line=None):
        d = []
        for z in zs:
            a, b = centre(P, z, sel_t), centre(B, z, sel_b)
            d.append(None if a is None or b is None else (b - a) * np.array([use_x, 1.0]))
        good = [i for i, x in enumerate(d) if x is not None]
        arr = np.array([d[i] if d[i] is not None else d[min(good, key=lambda g: abs(g - i))] for i in range(len(zs))])
        if line:     # (a straight lean fitted over the range: the trunk's own features, a chest plate, a pack, a lapel,
            #          never shear it section by section)
            sel = (zs >= line[0]) & (zs <= line[1])
            A_ = np.stack([np.ones(sel.sum()), zs[sel]], 1)
            coef = np.linalg.lstsq(A_, arr[sel], rcond=None)[0]
            return np.stack([np.ones(len(zs)), zs], 1) @ coef
        w = np.exp(-0.5 * ((zs[:, None] - zs[None, :]) / sig) ** 2)
        return (w @ arr) / w.sum(1, keepdims=True)

    trunk = series(lambda Q: np.abs(Q[:, 0]) < 0.06, lambda Q: np.abs(Q[:, 0]) < 0.06, 0.0, sigma, line=(0.95, 1.45))
    legs = {s: series(lambda Q, s=s: (s * Q[:, 0] > 0.02) & (s * Q[:, 0] < 0.30),
                      lambda Q, s=s: (s * Q[:, 0] > 0.02) & (s * Q[:, 0] < 0.30), 1.0, 0.08) for s in (1, -1)}
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
        if radius != 2 or rounds != 2:
            key = key + (radius, rounds)
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


# ---- the shell's own geometry as garments (#684, second pass) ---------------------------------------------------

def face_labels(tgt, protos, among=None, rounds=3):
    """Each triangle of the shell (tgt.bm) labelled with the class at its centre and halfway to each corner (the
    commonest of four), then voted over the triangles sharing its edges `rounds` times (a lone triangle of another
    class goes). Returns a list of class names, one a triangle."""
    names, lab = tgt.class_map(protos, among)
    h, w = lab.shape
    idx = {n: i for i, n in enumerate(names)}
    out = np.zeros(len(tgt.bm.faces), dtype=int)
    for f in tgt.bm.faces:
        uvs = [l[tgt.uv].uv for l in f.loops]
        c = sum(uvs, Vector((0, 0))) / 3
        votes = np.zeros(len(names), dtype=int)
        for q in [c] + [(c + u) / 2 for u in uvs]:
            votes[lab[int(min(h - 1, max(0, q[1] * h))), int(min(w - 1, max(0, q[0] * w)))]] += 1
        out[f.index] = votes.argmax()
    nbr = [[g.index for e in f.edges for g in e.link_faces if g is not f] for f in tgt.bm.faces]
    for _ in range(rounds):
        nxt = out.copy()
        for i, nb in enumerate(nbr):
            if not nb:
                continue
            v = np.bincount(out[nb], minlength=len(names))
            v[out[i]] += 1
            if v.max() >= 2 and v.argmax() != out[i] and v[out[i]] <= 1:
                nxt[i] = v.argmax()
        out = nxt
    return [names[i] for i in out]


def _islands(faces):
    seen, out = set(), []
    for f in faces:
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
        out.append(isl)
    return out


def boundary_loops(bm):
    """The open edges of a bmesh as loops of verts."""
    edges = {e for e in bm.edges if e.is_boundary}
    loops = []
    while edges:
        e = edges.pop()
        loop = [e.verts[0], e.verts[1]]
        while True:
            v = loop[-1]
            nxt = [x for x in v.link_edges if x in edges]
            if not nxt:
                break
            x = nxt[0]
            edges.discard(x)
            w = x.other_vert(v)
            if w is loop[0]:
                break
            loop.append(w)
        loops.append(loop)
    return loops


def region(tgt, labels, select, zones=None, hems=(), hem_reach=0.10, min_faces=40, smooth=2):
    """A garment cut out of the shell: the triangles `select(centre, label)` keeps, each its material slot from
    `zones` ({label: slot}, 0 otherwise); islands under `min_faces` go; every open loop that is not one of the
    garment's hems (a loop whose centre lies within `hem_reach` of a point in `hems`: the neck, the wrists, the
    waist...) is a hole the shell's cut or its stretched armpits left, and is filled; then `smooth` light Taubin
    passes against the generator's noise. Returns a bmesh."""
    src = tgt.bm
    keep = [f for f, l in zip(src.faces, labels) if select(f.calc_center_median(), l)]
    bm = bmesh.new()
    vmap = {}
    for f in keep:
        vs = []
        for v in f.verts:
            if v not in vmap:
                vmap[v] = bm.verts.new(v.co)
            vs.append(vmap[v])
        try:
            g = bm.faces.new(vs)
        except ValueError:
            continue
        g.material_index = (zones or {}).get(labels[f.index], 0)
    bm.faces.ensure_lookup_table()
    for isl in _islands(list(bm.faces)):
        if len(isl) < min_faces:
            bmesh.ops.delete(bm, geom=isl, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    cut_planes(bm, hems)
    # (slivers: the unposing stretches a few long thin triangles from the arms to the trunk)
    long_ = [f for f in bm.faces if max(e.calc_length() for e in f.edges) > 0.05]
    bmesh.ops.delete(bm, geom=long_, context='FACES')
    bm.faces.ensure_lookup_table()
    for isl in _islands(list(bm.faces)):
        if len(isl) < min_faces:
            bmesh.ops.delete(bm, geom=isl, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    filled = fill_holes(bm, hems, hem_reach)
    for _ in range(smooth):
        for k in (0.5, -0.53):
            new = {}
            for v in bm.verts:
                nb = [e.other_vert(v) for e in v.link_edges if (e.is_boundary or not v.is_boundary)]
                if nb:
                    new[v] = v.co + (sum((w.co for w in nb), Vector()) / len(nb) - v.co) * k
            for v, p in new.items():
                v.co = p
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    return bm, filled


def extend_under(bm, near, up=0.06, inset=0.012, rings=3):
    """A garment carried on under the one over it: the open loop whose centre is nearest `near` extruded `up` (+z) in
    `rings` rings, each drawn `inset` toward the body's axis by its top (the trousers' top under a cropped jacket, so a
    bend never opens a gap onto the body under them)."""
    loops = boundary_loops(bm)
    loop = min(loops, key=lambda L: (sum((v.co for v in L), Vector()) / len(L) - Vector(near)).length)
    c = sum((v.co for v in loop), Vector()) / len(loop)
    prev = loop
    for k in range(1, rings + 1):
        t = k / rings
        ring = []
        for v in prev:
            p = v.co.copy()
            d = Vector((p.x - c.x, p.y - c.y, 0))
            q = Vector((p.x, p.y, p.z + up / rings)) - d.normalized() * (inset / rings) if d.length > 1e-6 else p
            ring.append(bm.verts.new(q))
        for i in range(len(prev)):
            j = (i + 1) % len(prev)
            try:
                bm.faces.new([prev[i], prev[j], ring[j], ring[i]])
            except ValueError:
                pass
        prev = ring
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()


def retopo(ob, tris, hems=(), levels=1):
    """Clean, even topology near `tris` triangles: made manifold and its holes filled (fill_holes, `hems` kept open),
    then QuadriFlow (quads, the boundary kept), else one subdivision and a collapse to the budget; its holes filled
    again after. Returns how."""
    def clean(after=False):
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        if after:       # (QuadriFlow caps some of the open loops: the level hems are cut open again)
            cut_planes(bm, hems, nudge=0.002)
        fill_holes(bm, hems)
        orient_out(bm)  # (one consistent winding, facing out: QuadriFlow wants it, the hems and the ink too)
        bm.to_mesh(ob.data)
        bm.free()
    clean()
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    try:
        r = bpy.ops.object.quadriflow_remesh(target_faces=max(100, tris // 2), use_preserve_boundary=True,
                                             use_mesh_symmetry=False, use_preserve_sharp=False, seed=1)
    except RuntimeError:
        r = {'CANCELLED'}
    how = 'quadriflow'
    if 'FINISHED' not in r:
        how = 'subdivided and collapsed'
        if levels:
            m = ob.modifiers.new('Subdivision', 'SUBSURF')
            m.levels = m.render_levels = levels
            m.boundary_smooth = 'PRESERVE_CORNERS'
            with bpy.context.temp_override(object=ob, active_object=ob):
                bpy.ops.object.modifier_apply(modifier=m.name)
        now = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        if now > tris:
            m = ob.modifiers.new('Decimate', 'DECIMATE')
            m.ratio = tris / now
            with bpy.context.temp_override(object=ob, active_object=ob):
                bpy.ops.object.modifier_apply(modifier=m.name)
    clean(after=True)
    return how


def transfer(tgt, protos, P, N, classes, default, limits=None, radius=4, rounds=3, out=0.03, inward=0.03):
    """The shell's colour map on a garment's texels (their rest positions and normals, as the atlas's bakes give
    them): each classified among `classes` ({shell class: palette name}) and skin and hair (which give `default`),
    on the map cleaned over a wider square than for the cutting (`radius` texels, `rounds` votes: the shell's baked
    shadows in the folds go, its colour zones stay); `limits` ({shell class: where(P) -> bool}) keeps a class to
    where it belongs (the dark knit to the forearms and the waistband, not the jacket's shaded folds). Returns one
    palette name per texel."""
    names = np.empty(len(P), dtype=object)
    names[:] = default
    among = set(classes) | {'skin', 'hair'}
    cls_names, lab = tgt.class_map(protos, among, radius=radius, rounds=rounds)
    h, w = lab.shape
    for i in range(len(P)):
        r = tgt.ray(P[i], N[i], out, inward)
        if r is None:
            continue
        uv = r[3]
        c = cls_names[lab[int(min(h - 1, max(0, uv[1] * h))), int(min(w - 1, max(0, uv[0] * w)))]]
        if c in classes and (not limits or c not in limits or limits[c](P[i])):
            names[i] = classes[c]
    return names


def orient_out(bm, body=None):
    """Faces turned to face away from his body (each sampled face's normal against its way out from the nearest
    point of the body), consistently over the piece."""
    body = body or bpy.data.objects['Body']
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    score = 0.0
    for f in list(bm.faces)[::7]:
        c = f.calc_center_median()
        ok, q, n, _ = body.closest_point_on_mesh(c)
        if ok:
            score += f.normal.dot(c - q)
    if score < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.normal_update()
    return bm


def reach_wrists(tgt, labels, J, shoulder=0.2, body=('skin', 'hair')):
    """The figure's sleeves carried out to his wrists: scaled by its neck, the figure's arms are shorter than his, and
    its cuffs stopped on his forearms. Each side's arm (|x| past `shoulder`) is stretched along x so the end of its
    sleeve (the furthest triangle that is not skin) meets his wrist. Returns the stretch on each side."""
    out = {}
    for side, s in (('l', 1), ('r', -1)):
        # (the sleeve ends where the arm's 1 cm slices turn mostly skin: a hand's shaded or dark-nailed triangles
        #  are classed as cloth here and there, so the furthest cloth triangle is not the cuff)
        arm = [(s * f.calc_center_median().x, l in body) for f, l in zip(tgt.bm.faces, labels)
               if f.calc_center_median().z > 1.2 and s * f.calc_center_median().x > 0.3]
        xe = None
        for x0 in np.arange(0.35, 0.95, 0.01):
            sl = [b for x, b in arm if x0 <= x < x0 + 0.01]
            if len(sl) >= 4 and sum(sl) / len(sl) > 0.5:
                xe = x0
                break
        if xe is None:
            continue
        want = abs(J['hand_' + side].x) - 0.012
        k = (want - shoulder) / (xe - shoulder)
        for v in tgt.bm.verts:
            if s * v.co.x > shoulder:
                v.co.x = s * (shoulder + (s * v.co.x - shoulder) * k)
        out[side] = round(float(k), 3)
    tgt.bm.normal_update()
    tgt.tree = BVHTree.FromBMesh(tgt.bm)
    return out


def cut_planes(bm, hems, nudge=0.0):
    """A hem given as (x, y, z, 'above' | 'below'): the piece cut on the level plane at z (moved `nudge` toward the
    kept side), that side kept."""
    for h in hems:
        if len(h) > 3 and h[3] in ('above', 'below'):
            z = h[2] + (nudge if h[3] == 'above' else -nudge)
            geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1), dist=1e-5,
                                   clear_inner=h[3] == 'above', clear_outer=h[3] == 'below')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.faces.ensure_lookup_table()


def make_manifold(bm):
    """Doubled verts merged, degenerate triangles dissolved, the faces on edges shared by three (and on verts where two
    sheets touch) taken out: the re-mesh needs a manifold, and fill_holes closes what this opens."""
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
    for _ in range(4):
        bad = {f for e in bm.edges if len(e.link_faces) > 2 for f in e.link_faces}
        bad |= {f for v in bm.verts if (not v.is_manifold or sum(e.is_boundary for e in v.link_edges) > 2)
                for f in v.link_faces}
        if not bad:
            break
        bmesh.ops.delete(bm, geom=list(bad), context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.faces.ensure_lookup_table()
    for isl in _islands(list(bm.faces)):
        if len(isl) < 40:
            bmesh.ops.delete(bm, geom=isl, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')


def fill_holes(bm, hems, hem_reach=0.10, rounds=3):
    """Every open loop that is not one of the garment's hems (the biggest loops near each point of `hems`) filled with
    triangles, each taking the commonest material round it; again while a filling has made an edge three faces share
    (two holes touching at a vert). Returns how many."""
    n = 0
    for _ in range(rounds):
        n += _fill_once(bm, hems, hem_reach)
        if not any(len(e.link_faces) > 2 for e in bm.edges) and all(v.is_manifold for v in bm.verts):
            break
    return n


def _fill_once(bm, hems, hem_reach):
    make_manifold(bm)
    loops = boundary_loops(bm)
    centres = [sum((v.co for v in L), Vector()) / len(L) for L in loops]
    hem_ids = set()
    for h in hems:      # (a hem: the loops near its point at least 0.3 the size of the biggest there: a cuff cut level and
        #               the fold under it are both open, a crumb of a hole beside them is not)
        near = [i for i, c in enumerate(centres) if (c - Vector(h[:3])).length < hem_reach]
        if near:
            big = max(len(loops[i]) for i in near)
            hem_ids |= {i for i in near if len(loops[i]) >= 0.3 * big}
    if DEBUG:
        print('loops', [(len(L), [round(x, 2) for x in c], i in hem_ids) for i, (L, c) in enumerate(zip(loops, centres)) if len(L) > 8],
              'hems', [tuple(round(x, 2) for x in h[:3]) for h in hems])
    filled = 0
    for i, loop in enumerate(loops):
        if i in hem_ids or any(not v.is_valid for v in loop):
            continue
        if DEBUG:
            print('fill', len(loop), [round(x, 2) for x in centres[i]])
        edges = list({e for v in loop for e in v.link_edges if e.is_boundary})
        res = bmesh.ops.holes_fill(bm, edges=edges, sides=0)
        new = res['faces']
        if new:
            mats = [f.material_index for v in loop for f in v.link_faces if f not in new]
            for f in new:
                f.material_index = max(set(mats), key=mats.count) if mats else 0
            bmesh.ops.triangulate(bm, faces=new)
            filled += 1
    return filled


# ---- an outfit's builders ----------------------------------------------------------------------------------------

ACTIVE = None   # (outfit.py sets it once the shape target is loaded: {'tgt', 'labels', 'J'})


def cloth(label):
    """A triangle the figure painted as cloth: not its skin, not its hair."""
    return label not in ('skin', 'hair')


def shell(select, hems, under=None):
    """An outfit's builder for a piece cut out of the shape target: its triangles that `select(centre, label)` keeps,
    `hems(J)` its open loops (a level one as (x, y, z, 'above' | 'below'); the other loops are filled), carried on
    `under` the piece over it if given (region, extend_under). The builder's `hems` are its open loops for the
    re-mesh (retopo)."""
    def build(cage, J):
        bm, filled = region(ACTIVE['tgt'], ACTIVE['labels'], select, hems=hems(J))
        if under is not None:
            extend_under(bm, under, up=.07, inset=.03)
        return orient_out(bm)

    def loops(J):       # (carried on under: its level cut moves up to the top of what was added, 7 cm)
        out = []
        for h in hems(J):
            if under is not None and abs(h[2] - under[2]) < 1e-6:
                h = (h[0], h[1], h[2] + .0705) + tuple(h[3:])
            out.append(h)
        return out
    build.hems = loops
    return build

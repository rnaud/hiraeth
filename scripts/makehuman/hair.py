"""
The MakeHuman bodies' hair (scripts/makehuman/build.py --reference): MakeHuman's ten CC0 hairstyles
(its system assets: "This asset was explicitly released as CC0 in september 2020"), fitted by MPFB
to the reference body, turned into something the game's ink draws well.

A MakeHuman hairstyle is a few hundred alpha-textured cards: through a flat-colour ink pass they
would be strips and holes. Each becomes a closed shell with the style's own cut, drawn as Moebius
draws hair, a few big shapes with a few strand lines inside:

  1. the cards cut to their texture's drawn strands (the alpha, widened a little, so neighbouring
     strands join and a lock's tip keeps its point);
  2. thickened and voxel-remeshed into one closed volume, small islands dropped, smoothed into
     clean silhouettes, decimated;
  3. the cards grouped into a few big locks (k-means on where each card lies, stretched along the
     fall of the hair), and a groove pressed along every border between two locks: the ink pass draws
     those creases as the strand lines;
  4. the inside of the shell, deep in the skull, left out;
  5. every vertex bound to the low body: its nearest point on a triangle of the head, neck or upper
     back (the triangle, its barycentric weights) and its offset from it; src/makehuman/body.js fits
     the shell to any head on load (the offset scaled with the head) and weights it from the same
     triangle (the head, the neck, the upper spine: never the arms);
  6. the scalp under it (scalp_of): the head's triangles the shell lies over, which the game draws in
     the hair's colour just off the skin, so wherever the smoothed shell sank under the skin (the
     crowns of short02 and short04, where the cards fan out) no skin shows through.

The beard is made the same way from the skin itself: the jaw, chin, cheeks below the cheekbones,
the sideburns and the upper lip, the lips left clear.
"""
import bpy, bmesh, os, math
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.locationservice import LocationService

HAIR_DIR = os.path.join(LocationService.get_user_data(''), 'hair')

# per style: how many locks, how deep their grooves (m), how far the fall stretches them (y squeezed),
# the shell's voxel and thickness (m), the decimated size (triangles)
STYLES = {
    'short01': {'locks': 7, 'groove': 0.0040, 'fall': 0.45, 'tris': 2200},
    'short02': {'locks': 7, 'groove': 0.0040, 'fall': 0.45, 'tris': 2200},
    'short03': {'locks': 7, 'groove': 0.0043, 'fall': 0.45, 'tris': 2200},
    'short04': {'locks': 6, 'groove': 0.0032, 'fall': 0.45, 'tris': 2000},
    'bob01': {'locks': 8, 'groove': 0.0054, 'fall': 0.35, 'tris': 2600},
    'bob02': {'locks': 9, 'groove': 0.0054, 'fall': 0.3, 'tris': 2600},
    'long01': {'locks': 10, 'groove': 0.0063, 'fall': 0.25, 'tris': 3000},
    'ponytail01': {'locks': 8, 'groove': 0.0054, 'fall': 0.35, 'tris': 2800},
    'braid01': {'locks': 11, 'groove': 0.0063, 'fall': 1.0, 'tris': 3000},
    'afro01': {'locks': 9, 'groove': 0.0063, 'fall': 1.0, 'tris': 2400, 'thick': 0.01},
}
VOX = 0.0055
THICK = 0.006
DILATE = 6          # px the alpha is widened by (the textures are 1024 or 2048 px)
INSIDE = 0.004      # m under the skin: a shell triangle wholly that deep is left out
# the bones a hair or a beard may follow (its weights: never the arms)
FOLLOW = ('head', 'neck_01', 'spine_03', 'spine_02', 'clavicle_l', 'clavicle_r')


def activate(o):
    for x in bpy.context.view_layer.objects:
        x.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)


def apply_mod(o, m):
    activate(o)
    bpy.ops.object.modifier_apply(modifier=m.name)


def mesh_arrays(o):
    me = o.data
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co)
    me.calc_loop_triangles()
    tris = np.array([tuple(t.vertices) for t in me.loop_triangles], dtype=np.int64)
    return co.reshape(-1, 3), tris


def new_object(name, co, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(map(float, p)) for p in co], [], [tuple(map(int, f)) for f in faces])
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def alpha_map(d):
    png = [f for f in os.listdir(d) if f.endswith('.png') and 'normal' not in f.lower()][0]
    img = bpy.data.images.load(os.path.join(d, png))
    W, H = img.size
    a = np.array(img.pixels[:]).reshape(H, W, 4)[..., 3]
    r = max(1, int(DILATE * W / 1024))
    for axis in (0, 1):
        b = a.copy()
        for k in range(1, r + 1):
            b = np.maximum(b, np.roll(a, k, axis)); b = np.maximum(b, np.roll(a, -k, axis))
        a = b
    return a, W, H


def cut_cards(o, d):
    """The cards cut to their (widened) strands: faces of the twice-subdivided cards over transparent texture go."""
    alpha, W, H = alpha_map(d)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    uv = bm.loops.layers.uv.active
    gone = []
    for f in bm.faces:
        u = sum(l[uv].uv.x for l in f.loops) / len(f.loops); v = sum(l[uv].uv.y for l in f.loops) / len(f.loops)
        if alpha[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W)))] < 0.25:
            gone.append(f)
    bmesh.ops.delete(bm, geom=gone, context='FACES_ONLY')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(o.data); bm.free()


def islands(o):
    """Connected pieces of a mesh: a label per vertex."""
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    lab = -np.ones(len(bm.verts), dtype=np.int64)
    n = 0
    for v in bm.verts:
        if lab[v.index] >= 0:
            continue
        stack = [v]; lab[v.index] = n
        while stack:
            x = stack.pop()
            for e in x.link_edges:
                y = e.other_vert(x)
                if lab[y.index] < 0:
                    lab[y.index] = n; stack.append(y)
        n += 1
    bm.free()
    return lab, n


def drop_small(o, frac=0.05):
    lab, n = islands(o)
    size = np.bincount(lab, minlength=n)
    small = size < size.max() * frac
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if small[lab[v.index]]], context='VERTS')
    bm.to_mesh(o.data); bm.free()
    return n


def kmeans(X, k, w=None, iters=40, seed=7):
    rng = np.random.default_rng(seed)
    w = np.ones(len(X)) if w is None else w
    C = [X[rng.choice(len(X), p=w / w.sum())]]
    for _ in range(1, k):
        d = np.min([((X - c) ** 2).sum(1) for c in C], axis=0) * w
        C.append(X[rng.choice(len(X), p=d / d.sum())])
    C = np.array(C)
    for _ in range(iters):
        lab = np.argmin(((X[:, None, :] - C[None]) ** 2).sum(2), 1)
        for j in range(k):
            m = lab == j
            if m.any():
                C[j] = (X[m] * w[m, None]).sum(0) / w[m].sum()
    return lab


def neighbours(tris, n):
    nb = [set() for _ in range(n)]
    for a, b, c in tris:
        nb[a].update((b, c)); nb[b].update((a, c)); nb[c].update((a, b))
    return nb


def vertex_normals(co, tris):
    n = np.zeros_like(co)
    fn = np.cross(co[tris[:, 1]] - co[tris[:, 0]], co[tris[:, 2]] - co[tris[:, 0]])
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def face_locks(tris, lab):
    """Each triangle's lock: the one most of its corners have (as src/makehuman/hair.js splitLocks)."""
    a, b, c = lab[tris[:, 0]], lab[tris[:, 1]], lab[tris[:, 2]]
    return np.where((a == b) | (a == c), a, np.where(b == c, b, np.minimum(np.minimum(a, b), c)))


def groove(co, tris, lab, depth):
    """
    A groove pressed along every border between two locks: the vertices where triangles of two locks
    meet pressed in by depth (the game splits them there, each lock smooth on its side: a crease the
    ink draws), their neighbours a little.
    """
    fl = face_locks(tris, lab)
    first = -np.ones(len(co), dtype=np.int64); border = np.zeros(len(co), bool)
    for f, t in enumerate(tris):
        for v in t:
            if first[v] < 0:
                first[v] = fl[f]
            elif first[v] != fl[f]:
                border[v] = True
    # the borders straightened: each border vertex eased toward its neighbours along the border (the
    # edges between two locks' triangles), so the strand lines are smooth curves, not the mesh's steps
    edge_faces = {}
    for f, t in enumerate(tris):
        for k in range(3):
            e = tuple(sorted((int(t[k]), int(t[(k + 1) % 3]))))
            edge_faces.setdefault(e, []).append(fl[f])
    along = [[] for _ in range(len(co))]
    for (a, b), L in edge_faces.items():
        if len(set(L)) > 1:
            along[a].append(b); along[b].append(a)
    co = co.copy()
    for _ in range(8):
        new = co.copy()
        for i in np.nonzero(border)[0]:
            if len(along[i]) >= 2:
                new[i] = co[i] + 0.5 * (co[along[i]].mean(0) - co[i])
        co = new
    nb = neighbours(tris, len(co))
    nrm = vertex_normals(co, tris)
    ring = np.array([not border[i] and any(border[j] for j in nb[i]) for i in range(len(co))])
    out = co.copy()
    d = np.broadcast_to(np.asarray(depth, dtype=float).reshape(-1, 1), (len(co), 1))
    out[border] -= nrm[border] * d[border]
    out[ring] -= nrm[ring] * d[ring] * 0.2
    return out, int(border.sum())


def smooth_labels(lab, tris, n, rounds=6):
    nb = neighbours(tris, n)
    for _ in range(rounds):
        new = lab.copy()
        for i in range(n):
            if nb[i]:
                vals = np.bincount(np.array([lab[j] for j in nb[i]] + [lab[i]]))
                new[i] = int(np.argmax(vals))
        lab = new
    return lab


class Body:
    """The low body (game frame) for binding: its triangles, those the hair may follow, a BVH of them."""

    def __init__(self, co, tris, J, W, bone_names):
        self.co, self.tris = co, tris
        follow = [bone_names.index(b) for b in FOLLOW if b in bone_names]
        fw = (W * np.isin(J, follow)).sum(1)
        ok = (fw[tris] > 0.5).all(1)
        self.idx = np.nonzero(ok)[0]
        self.bvh = BVHTree.FromPolygons([Vector(p) for p in co], [tuple(t) for t in tris[self.idx]])
        self.all = BVHTree.FromPolygons([Vector(p) for p in co], [tuple(t) for t in tris])
        self.fn = np.cross(co[tris[:, 1]] - co[tris[:, 0]], co[tris[:, 2]] - co[tris[:, 0]])
        self.fn /= np.maximum(np.linalg.norm(self.fn, axis=1, keepdims=True), 1e-12)

    def depth(self, p):
        """How far a point is under the skin (m; negative outside)."""
        loc, nrm, fi, dist = self.all.find_nearest(Vector(p))
        return -float(np.dot(np.asarray(p) - np.array(loc), self.fn[fi]))

    def bind(self, pts):
        """Each point: its nearest followed triangle (index into tris), barycentric weights, offset."""
        T = np.zeros(len(pts), dtype=np.int64); B = np.zeros((len(pts), 3)); O = np.zeros((len(pts), 3))
        for i, p in enumerate(pts):
            loc, nrm, fi, dist = self.bvh.find_nearest(Vector(p))
            t = self.idx[fi]
            a, b, c = self.tris[t]
            A, Bv, C = Vector(self.co[a]), Vector(self.co[b]), Vector(self.co[c])
            v0, v1, v2 = Bv - A, C - A, loc - A
            d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
            den = d00 * d11 - d01 * d01 or 1e-12
            wb = (d11 * d20 - d01 * d21) / den; wc = (d00 * d21 - d01 * d20) / den
            T[i] = t; B[i] = (1 - wb - wc, wb, wc); O[i] = np.asarray(p) - np.array(loc)
        return T, B, O


def shell_from(o, cfg, card_co, card_lab, body, log, name):
    """A card or skin mesh (object o, game frame) made into a closed, grooved shell: (co, tris) of the result."""
    m = o.modifiers.new('S', 'SOLIDIFY'); m.thickness = cfg.get('thick', THICK); m.offset = cfg.get('offset', 0); apply_mod(o, m)
    m = o.modifiers.new('R', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = cfg.get('vox', VOX); m.adaptivity = 0; apply_mod(o, m)
    n_isl = drop_small(o)
    m = o.modifiers.new('L', 'LAPLACIANSMOOTH'); m.lambda_factor = 0.9; m.iterations = cfg.get('smooth', 16); m.use_volume_preserve = True; apply_mod(o, m)
    m = o.modifiers.new('C', 'CORRECTIVE_SMOOTH'); m.iterations = 6; m.smooth_type = 'SIMPLE'; m.use_only_smooth = True; apply_mod(o, m)
    co, tris = mesh_arrays(o)
    m = o.modifiers.new('D', 'DECIMATE'); m.ratio = min(1.0, cfg['tris'] * 1.1 / max(1, len(tris))); apply_mod(o, m)
    co, tris = mesh_arrays(o)
    # the locks: each shell vertex takes the lock of the nearest card point, smoothed, then the grooves
    grooved = 0
    lab = np.zeros(len(co), dtype=np.int64)
    if card_lab is not None:
        kd = KDTree(len(card_co))
        for i, p in enumerate(card_co):
            kd.insert(Vector(p), i)
        kd.balance()
        lab = np.array([card_lab[kd.find(Vector(p))[1]] for p in co])
        lab = smooth_labels(lab, tris, len(co))
        # (no deeper than 60 % of the way to the skin under it: the shell is never pierced)
        room = np.array([max(0.0, -body.depth(p)) for p in co])
        co, grooved = groove(co, tris, lab, np.minimum(cfg['groove'], room * 0.6)[:, None])
    # the inside, deep in the skull, left out
    deep = np.array([body.depth(p) > INSIDE for p in co])
    keep = ~deep[tris].all(1)
    tris = tris[keep]
    used = np.unique(tris)
    remap = -np.ones(len(co), dtype=np.int64); remap[used] = np.arange(len(used))
    co, tris, lab = co[used], remap[tris], lab[used]
    log(f'{name}: {n_isl} pieces -> shell {len(tris)} triangles, {len(co)} vertices, {grooved} on the grooves')
    return co, tris, lab


def card_locks(o, cfg):
    """The cards grouped into locks: a label per vertex of the (cut) card mesh (k-means on where they lie, the fall squeezed)."""
    co, tris = mesh_arrays(o)
    X = (co - co.mean(0)) * np.array([1.0, cfg['fall'], 1.0])
    pick = np.random.default_rng(3).choice(len(X), size=min(len(X), 3000), replace=False)
    C = X[pick][kmeans_centres(X[pick], cfg['locks'])]
    lab = np.argmin(((X[:, None, :] - C[None]) ** 2).sum(2), 1)
    return co, lab


def kmeans_centres(X, k):
    """Indices of the points nearest each k-means centre (the centres as data points, for card_locks)."""
    lab = kmeans(X, k)
    out = []
    for j in range(k):
        m = np.nonzero(lab == j)[0]
        if len(m):
            c = X[m].mean(0)
            out.append(m[np.argmin(((X[m] - c) ** 2).sum(1))])
    return np.array(out)


def build_hair(style, body_obj, s, dz, to_frame, body, log):
    d = os.path.join(HAIR_DIR, style)
    cards = HumanService.add_mhclo_asset(os.path.join(d, f'{style}.mhclo'), body_obj, asset_type='Hair', subdiv_levels=0, material_type='NONE')
    o = cards.copy(); o.data = cards.data.copy(); bpy.context.collection.objects.link(o)
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    o.parent = None
    co = np.empty(len(o.data.vertices) * 3); cards.data.vertices.foreach_get('co', co)
    W = np.array(cards.matrix_world)
    co = (W[:3, :3] @ co.reshape(-1, 3).T).T + W[:3, 3]
    g = to_frame(co, s, dz)
    o.matrix_world = Matrix.Identity(4)
    o.data.vertices.foreach_set('co', g.ravel())
    o.data.update()
    cut_cards(o, d)
    cfg = STYLES[style]
    card_co, card_lab = card_locks(o, cfg)
    out = shell_from(o, cfg, card_co, card_lab, body, log, style)
    bpy.data.objects.remove(cards)
    return out


def build_beard(body, face, log):
    """The beard: the skin of the jaw, chin, lower cheeks, sideburns and upper lip (the lips clear), thickened into a shell."""
    co, tris = body.co, body.tris
    eyeY, eyeX, noseY, noseZ, chinY, earZ = face
    mouthY = noseY - 0.032
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    head = body.headw > 0.5
    # the cheek line: under the mouth's corners in front, curving up along the jaw to the sideburns
    side = np.clip((np.abs(x) - 0.034) / 0.04, 0, 1)
    region = head & (y < noseY - 0.016 + 0.04 * side ** 2.2) & (y > chinY - 0.05) & (z > earZ + 0.016)
    # the sideburns reach up in front of the ears; the cheeks stop below the cheekbones
    region &= ~((np.abs(x) < 0.05) & (y > noseY - 0.015) & (y < noseY + 0.03) & (z > noseZ - 0.05))
    # the moustache: over the upper lip, between the nose and the mouth
    region |= head & (np.abs(x) < 0.03) & (y < noseY - 0.012) & (y > mouthY + 0.003) & (z > noseZ - 0.04)
    # the lips and the mouth's corners clear (the moustache over them, the beard under)
    lips = ((x / 0.027) ** 2 + ((y - mouthY) / 0.0085) ** 2 < 1) & (z > noseZ - 0.06)
    region &= ~lips
    # under the jaw only to the throat's top
    region &= ~((z < noseZ - 0.075) & (y < chinY - 0.01))
    sel = region[tris].all(1)
    faces = tris[sel]
    used = np.unique(faces)
    remap = -np.ones(len(co), dtype=np.int64); remap[used] = np.arange(len(used))
    o = new_object('beard', co[used] + vertex_normals(co, tris)[used] * 0.0015, remap[faces])
    cfg = {'tris': 1100, 'thick': 0.0055, 'offset': 1, 'vox': 0.003, 'smooth': 12}
    out = shell_from(o, cfg, None, None, body, log, 'beard')
    return out


# the scalp under a style: the head's skin its shell lies over (a ray from SCALP['out'] outside the skin
# back down to SCALP['in'] under it meets the shell), drawn in the hair's colour just off the skin
# (src/makehuman/hair.js): where the cards left a gap and the smoothed shell sank under the skin
# (the crown of short02 and short04), the skin no longer shows through
SCALP = {'out': 0.03, 'in': 0.008}


def scalp_of(co, tris, body, face):
    """
    The low body's triangles (indices) under a shell (co, tris): those whose three corners a ray down
    the skin's normal meets the shell over, on the skull (above the brows; behind the ears, down to the
    nape): never the face, whatever hangs in front of it.
    """
    eyeY, earZ = face[0], face[5]
    bvh = BVHTree.FromPolygons([Vector(p) for p in co], [tuple(map(int, t)) for t in tris])
    nrm = vertex_normals(body.co, body.tris)
    y, z = body.co[:, 1], body.co[:, 2]
    head = (body.headw > 0.5) & ((y > eyeY + 0.02) | ((z < earZ - 0.01) & (y > eyeY - 0.06)))
    under = np.zeros(len(body.co), bool)
    for i in np.nonzero(head)[0]:
        n = Vector(nrm[i]); p = Vector(body.co[i])
        hit = bvh.ray_cast(p + n * SCALP['out'], -n, SCALP['out'] + SCALP['in'])
        under[i] = hit[0] is not None
    return np.nonzero(under[body.tris].all(1))[0]


def build_all(body_obj, P, s, dz, low_game, low_tris, headw, to_frame, log, J, W, bone_names, face):
    """Every style's shell (game frame) and its binding to the low body: (meta, arrays)."""
    body = Body(low_game, low_tris, J, W, bone_names)
    body.headw = headw
    meta, arrays = {}, {}
    shells = {st: build_hair(st, body_obj, s, dz, to_frame, body, log) for st in STYLES}
    shells['beard'] = build_beard(body, face, log)
    for st, (co, tris, lab) in shells.items():
        T, B, O = body.bind(co)
        arrays[f'{st}_tris'] = tris
        arrays[f'{st}_tri'] = T
        arrays[f'{st}_bary'] = B
        arrays[f'{st}_off'] = O
        arrays[f'{st}_co'] = co
        arrays[f'{st}_lock'] = lab
        if st != 'beard':
            arrays[f"{st}_scalp"] = scalp_of(co, tris, body, face)
            log(f'{st}: the scalp under it, {len(arrays[st + "_scalp"])} triangles')
        meta[st] = {'vertices': int(len(co)), 'triangles': int(len(tris)), 'maxOffset': float(np.abs(O).max())}
    return meta, arrays

"""Pass 3 of issue #493 (the author's call, 2026-10-19): the cut garments finished as clothes.

- tidy():    crumbs of a cut dropped, pinholes closed, each cut edge relaxed along the surface (no zigzag).
- hem():     every open edge of a garment turned in (a lip) and carried on inside as a band of the same
             surface 3 mm under it (a facing), so the border is closed and looking in shows plain dark cloth;
             edges under another garment get the lip alone.
- under():   what lies under the shirt (the tee, the trousers' top) takes the shirt's own weights where it is
             under it, and stays a few mm inside it: one skin moves both, so the tee cannot poke out.
- skin_colours(): the base body coloured from his own skin (B3's forearms and ankles, head-v3's neck),
             spread over the body so every seam matches.
- atlas():   every part's colour baked into one texture (B3's and head-v3's painted surfaces repacked, the
             body's skin, flat swatches for the insides, the backing and the scalp), one material for all
             (and its double-sided twin for the head and hair), each garment's foreign paint (another
             garment's colour that the cut left on it) turned to its own colour.

The face attribute 'p3' says what each face is: 0 the surface, 1 a lip, 2 an inside band, 3 a backing
(flat, under the shirt), 4 the scalp."""
import math
import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

SURFACE, LIP, BAND, BACKING, SCALP = range(5)


def face_kind(me):
    a = me.attributes.get('p3')
    if a is None:
        a = me.attributes.new('p3', 'INT', 'FACE')
    return a


def set_kind(me, kinds):
    a = face_kind(me)
    a.data.foreach_set('value', list(kinds))


def get_kind(me):
    a = face_kind(me)
    out = [0] * len(me.polygons)
    a.data.foreach_get('value', out)
    return out


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- tidy

def boundary_loops(bm):
    """Each run of boundary edges, as an ordered list of verts (closed loops; pinch verts end a run)."""
    left = {e for e in bm.edges if e.is_boundary}
    loops = []
    while left:
        e = left.pop()
        run = [e.verts[0], e.verts[1]]
        closed = False
        for end in (1, 0):
            while True:
                v = run[-1] if end else run[0]
                nxt = [x for x in v.link_edges if x in left]
                if len(nxt) != 1:
                    break
                x = nxt[0]
                left.discard(x)
                w = x.other_vert(v)
                if w is (run[0] if end else run[-1]):
                    closed = True
                    break
                if end:
                    run.append(w)
                else:
                    run.insert(0, w)
            if closed:
                break
        loops.append((run, closed))
    return loops


def tidy(o, min_faces=150, hole=0.10, relax=6):
    """Crumbs (islands under `min_faces`) go; holes shorter round than `hole` are closed; each boundary is
    relaxed along the surface (its verts toward their neighbours on the edge, put back on the surface)."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.active
    # crumbs
    seen, gone = set(), []
    for f in bm.faces:
        if f in seen:
            continue
        comp, todo = [f], [f]
        seen.add(f)
        while todo:
            g = todo.pop()
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen:
                        seen.add(h)
                        comp.append(h)
                        todo.append(h)
        if len(comp) < min_faces:
            gone += comp
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # pinholes
    filled = 0
    for run, closed in boundary_loops(bm):
        if not closed:
            continue
        per = sum((run[i].co - run[i - 1].co).length for i in range(len(run)))
        if per < hole:
            edges = [bm.edges.get((run[i - 1], run[i])) for i in range(len(run))]
            res = bmesh.ops.holes_fill(bm, edges=[e for e in edges if e], sides=0)
            new = res['faces']
            if new:
                tri = bmesh.ops.triangulate(bm, faces=new)
                # the patch's UVs: one point of the surface round it (its colour, flat; a UV per corner
                # taken from faces either side of a UV seam stretched one triangle across the atlas)
                ref = next((m for m in run[0].link_loops if m.face not in tri['faces']), None)
                for f in tri['faces']:
                    f.smooth = True
                    for l in f.loops:
                        if ref is not None and uvl:
                            l[uvl].uv = ref[uvl].uv
                filled += 1
    # relax the edges
    ref = bm.copy()
    tree = BVHTree.FromBMesh(ref)
    for it in range(relax):
        moves = {}
        for run, closed in boundary_loops(bm):
            n = len(run)
            for i, v in enumerate(run):
                if not closed and (i == 0 or i == n - 1):
                    continue
                if sum(1 for e in v.link_edges if e.is_boundary) != 2:
                    continue
                a, b = run[i - 1], run[(i + 1) % n]
                target = v.co * 0.5 + (a.co + b.co) * 0.25
                hit = tree.find_nearest(target)
                if hit[0] is not None:
                    moves[v] = hit[0]
        for v, p in moves.items():
            v.co = p
    ref.free()
    bm.to_mesh(o.data)
    bm.free()
    return {'crumbs': len(gone), 'holes': filled}


def relax(o, k=0.5, iters=1):
    """Taubin smoothing (toward the neighbours' mean by k, then away by a little more: a plain Laplacian
    shrinks a sleeve or a leg at every pass); open edges along their edge only."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for _ in range(iters):
        for f in (k, -(k + 0.03)):
            new = {}
            for v in bm.verts:
                if v.is_boundary:
                    nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
                else:
                    nb = [e.other_vert(v) for e in v.link_edges]
                if nb:
                    new[v] = v.co + (sum((w.co for w in nb), Vector()) / len(nb) - v.co) * f
            for v, p in new.items():
                v.co = p
    bm.to_mesh(o.data)
    bm.free()


# ---------------------------------------------------------------- the shirt over the tee

def weights_of(ob):
    names = {g.index: g.name for g in ob.vertex_groups}
    return [{names[g.group]: g.weight for g in v.groups if g.weight > 0} for v in ob.data.vertices]


def under(o, shell, reach=0.05, gap=0.004, ease=6):
    """Verts of `o` under `shell` (a ray out along the vertex normal meets it within `reach`) take the
    shell's weights where the ray meets it (eased into their own over `ease` rings at the border) and sit
    at least `gap` inside it."""
    import rig as R
    tri = bmesh.new()
    tri.from_mesh(shell.data)
    bmesh.ops.triangulate(tri, faces=tri.faces)
    tri.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(tri)
    SW = weights_of(shell)
    OW = weights_of(o)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.normal_update()
    bm.verts.ensure_lookup_table()
    k = [0.0] * len(bm.verts)
    take = [None] * len(bm.verts)
    pushed = 0
    for v in bm.verts:
        n = v.normal
        if n.length < 0.5:
            continue
        hit = tree.ray_cast(v.co - n * 0.002, n, reach)
        if hit[0] is None:
            continue
        loc, hn, fi, dist = hit
        f = tri.faces[fi]
        a, b, c = (x.co for x in f.verts)
        # barycentric weights at the hit
        v0, v1, v2 = b - a, c - a, loc - a
        d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
        den = d00 * d11 - d01 * d01 or 1e-12
        wb = (d11 * d20 - d01 * d21) / den
        wc = (d00 * d21 - d01 * d20) / den
        wa = 1 - wb - wc
        acc = {}
        for x, w in zip(f.verts, (wa, wb, wc)):
            for name, val in SW[x.index].items():
                acc[name] = acc.get(name, 0) + val * max(0.0, w)
        take[v.index] = acc
        k[v.index] = 1.0
        depth = dist - 0.002
        if depth < gap:
            v.co -= n * (gap - depth)
            pushed += 1
    # ease the border: k spread outwards a few rings (verts with k=1 stay 1)
    nbr = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
    for _ in range(ease):
        k = [k[i] if k[i] >= 1 else max([k[i]] + [k[j] * 0.75 for j in nbr[i]]) for i in range(len(k))]
    # verts eased but without a hit of their own take their neighbours' shell weights
    for _ in range(ease):
        for i in range(len(take)):
            if take[i] is None and k[i] > 0:
                got = [take[j] for j in nbr[i] if take[j] is not None]
                if got:
                    acc = {}
                    for g in got:
                        for name, val in g.items():
                            acc[name] = acc.get(name, 0) + val / len(got)
                    take[i] = acc
    W = []
    for i in range(len(OW)):
        if take[i] is None or k[i] <= 0:
            W.append(OW[i])
            continue
        s = sum(take[i].values()) or 1
        m = {}
        for name in set(OW[i]) | set(take[i]):
            m[name] = OW[i].get(name, 0) * (1 - k[i]) + take[i].get(name, 0) / s * k[i]
        W.append(m)
    bm.to_mesh(o.data)
    bm.free()
    tri.free()
    R.set_weights(o, W)
    return {'under': sum(1 for x in k if x >= 1), 'eased': sum(1 for x in k if 0 < x < 1), 'pushed': pushed}


# ---------------------------------------------------------------- hems

def hem(o, covers, width=0.04, depth=0.003, lip_only=False):
    """Every open boundary of `o` turned in `depth` (the lip) and carried on inside as a band `width` wide,
    `depth` under the surface, facing in (kind BAND: plain dark cloth in the atlas). Boundaries under one of
    `covers` (the garments over it) get the lip alone. The lip's UVs are the edge's own (it reads as the
    garment's edge); the cut edge and the lip's fold are marked sharp."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.normal_update()
    uvl = bm.loops.layers.uv.active
    kl = bm.faces.layers.int.get('p3') or bm.faces.layers.int.new('p3')
    trees = []
    for c in covers:
        b2 = bmesh.new()
        b2.from_mesh(c.data)
        trees.append((BVHTree.FromBMesh(b2), b2))
    nrm = {v: v.normal.copy() for v in bm.verts}
    own = bmesh.new()   # the piece's own backing covers B3's edge eased onto it
    own.from_mesh(o.data)
    klo = own.faces.layers.int['p3']
    bmesh.ops.delete(own, geom=[f for f in own.faces if f[klo] != BACKING], context='FACES')
    if own.faces:
        trees.append((BVHTree.FromBMesh(own), own))
    else:
        own.free()

    def covered(v):
        for t, _ in trees:
            q = t.find_nearest(v.co, 0.006)
            if q[0] is not None:
                return True
            if t.ray_cast(v.co + nrm[v] * 0.001, nrm[v], 0.05)[0] is not None:
                return True
        return False

    bnd = [e for e in bm.edges if e.is_boundary]
    cov = {}
    for e in bnd:
        for v in e.verts:
            if v not in cov:
                cov[v] = covered(v)
    open_e = [] if lip_only else [e for e in bnd if not (cov[e.verts[0]] and cov[e.verts[1]])]
    shut_e = [e for e in bnd if e not in set(open_e)]
    stats = {'open': len(open_e), 'covered': len(shut_e)}

    # -- the plain lip on covered edges (as phase 2's)
    def edge_uv(e):
        f = e.link_faces[0]
        return {l.vert: l[uvl].uv.copy() for l in f.loops if l.vert in e.verts} if uvl else {}

    if shut_e:
        uv_before = {e: edge_uv(e) for e in shut_e}
        ret = bmesh.ops.extrude_edge_only(bm, edges=shut_e)
        for x in ret['geom']:
            if isinstance(x, bmesh.types.BMFace):
                x[kl] = LIP
        # move each extruded vert in along its source's normal
        for x in ret['geom']:
            if isinstance(x, bmesh.types.BMVert):
                for e in x.link_edges:
                    w = e.other_vert(x)
                    if w in nrm and (w.co - x.co).length < 1e-7:
                        x.co = w.co - nrm[w] * 0.004
                        break
        for e in shut_e:
            e.smooth = False

    if open_e:
        # -- distance from the open edges, over the mesh
        import heapq
        d = {}
        heap = []
        for e in open_e:
            for v in e.verts:
                if v not in d:
                    d[v] = 0.0
                    heapq.heappush(heap, (0.0, id(v), v))
        cap = width * 1.6
        while heap:
            dv, _, v = heapq.heappop(heap)
            if dv > d.get(v, 1e9) or dv > cap:
                continue
            for e in v.link_edges:
                w = e.other_vert(v)
                nd = dv + e.calc_length()
                if nd < d.get(w, 1e9):
                    d[w] = nd
                    heapq.heappush(heap, (nd, id(w), w))
        # (Dijkstra over B3's long triangles zigzags: within its reach, the straight distance to the open
        # edges, sampled every 4 mm, gives a band with a smooth far edge)
        from mathutils.kdtree import KDTree
        pts = []
        for e in open_e:
            a, b = e.verts[0].co, e.verts[1].co
            n = max(1, int((b - a).length / 0.004))
            pts += [a.lerp(b, i / n) for i in range(n + 1)]
        kd = KDTree(len(pts))
        for i, q in enumerate(pts):
            kd.insert(q, i)
        kd.balance()
        d = {v: (0.0 if dv == 0.0 else kd.find(v.co)[2]) for v, dv in d.items()}
        region = [f for f in bm.faces if f[kl] == SURFACE and any(d.get(v, 1e9) < width for v in f.verts)]
        dup = bmesh.ops.duplicate(bm, geom=region)
        vmap = {k: v for k, v in dup['vert_map'].items() if isinstance(k, bmesh.types.BMVert) and k in nrm}
        new_faces = [x for x in dup['geom'] if isinstance(x, bmesh.types.BMFace)]
        dd = {}
        for a, b in vmap.items():
            b.co = a.co - nrm[a] * depth
            dd[b] = d.get(a, 1e9) - width
        for f in new_faces:
            f[kl] = BAND
        # trim the band's far side along d = width
        made = set()
        edges = {e for f in new_faces for e in f.edges}
        for e in list(edges):
            a, b = e.verts
            fa, fb = dd.get(a, 1.0), dd.get(b, 1.0)
            if fa * fb < 0:
                t = fa / (fa - fb)
                if t < 0.03 or t > 0.97:
                    v = a if t < 0.5 else b
                    dd[v] = 0.0
                    made.add(v)
                    continue
                ne, nv = bmesh.utils.edge_split(e, a, t)
                dd[nv] = 0.0
                made.add(nv)
        for f in list(new_faces):
            if not f.is_valid:
                continue
            zero = [v for v in f.verts if v in made]
            if len(zero) == 2 and bm.edges.get(zero) is None:
                res = bmesh.ops.connect_verts(bm, verts=zero)
                for e in res['edges']:
                    for g in e.link_faces:
                        g[kl] = BAND
        band = [f for f in bm.faces if f[kl] == BAND]
        far = [f for f in band if sum(dd.get(v, 1.0) for v in f.verts) / len(f.verts) > 0]
        bmesh.ops.delete(bm, geom=far, context='FACES')
        band = [f for f in bm.faces if f.is_valid and f[kl] == BAND]
        bmesh.ops.reverse_faces(bm, faces=band)
        # the lip: a quad from each open edge to its twin on the band
        lips = 0
        for e in open_e:
            a, b = e.verts
            if a not in vmap or b not in vmap or not vmap[a].is_valid or not vmap[b].is_valid:
                continue
            f0 = e.link_faces[0]
            # the edge's direction in its face: a -> b or b -> a
            seq = [l.vert for l in f0.loops]
            ia = seq.index(a)
            if seq[(ia + 1) % len(seq)] is not b:
                a, b = b, a
            uv = {l.vert: l[uvl].uv.copy() for l in f0.loops} if uvl else {}
            try:
                f = bm.faces.new((b, a, vmap[a], vmap[b]))
            except ValueError:
                continue
            f[kl] = LIP
            f.smooth = True
            if uvl:
                for l, src in zip(f.loops, (b, a, a, b)):
                    l[uvl].uv = uv[src]
            e.smooth = False
            lips += 1
        stats.update(band=len(band), lips=lips)
    # a lip on the backing's edge is the backing's (a flat swatch), not an edge of B3's painted surface
    for f in bm.faces:
        if f[kl] == LIP and any(g[kl] == BACKING for e in f.edges for g in e.link_faces if g is not f):
            f[kl] = BACKING
    for t, b2 in trees:
        b2.free()
    bm.to_mesh(o.data)
    bm.free()
    return stats


# ---------------------------------------------------------------- texture sampling

def image_array(img):
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)


def sample(arr, uv):
    h, w = arr.shape[:2]
    x = min(w - 1.001, max(0.0, uv[0] * w - 0.5))
    y = min(h - 1.001, max(0.0, uv[1] * h - 0.5))
    x0, y0 = int(x), int(y)
    fx, fy = x - x0, y - y0
    c = (arr[y0, x0] * (1 - fx) * (1 - fy) + arr[y0, x0 + 1] * fx * (1 - fy) +
         arr[y0 + 1, x0] * (1 - fx) * fy + arr[y0 + 1, x0 + 1] * fx * fy)
    return c[:3]


def tex_of(o, poly):
    m = o.data.materials[poly.material_index]
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            return n.image
    return None


def surface_colour(o, arrays, tree_tri, loc, fi):
    """The texture colour of `o` at a point on its triangulated copy (tree_tri: (tree, bm, tri->poly, uvl))."""
    tree, bm, poly_of, uvl = tree_tri
    f = bm.faces[fi]
    img = tex_of(o, o.data.polygons[poly_of[fi]])
    if img is None:
        return None
    a, b, c = (l.vert.co for l in f.loops)
    v0, v1, v2 = b - a, c - a, loc - a
    d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
    den = d00 * d11 - d01 * d01 or 1e-12
    wb = (d11 * d20 - d01 * d21) / den
    wc = (d00 * d21 - d01 * d20) / den
    wa = 1 - wb - wc
    uv = sum((l[uvl].uv * w for l, w in zip(f.loops, (wa, wb, wc))), Vector((0, 0)))
    return sample(arrays[img.name], uv)


def tri_tree(o):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    orig = bm.faces.layers.int.new('orig')
    for f in bm.faces:
        f[orig] = f.index
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.faces.ensure_lookup_table()
    return BVHTree.FromBMesh(bm), bm, [f[orig] for f in bm.faces], bm.loops.layers.uv.active


def skin_like(c):
    import colorsys
    r, g, b = (float(x) for x in c)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    return 0.30 < v and 0.2 < s < 0.8 and (h * 360 < 45 or h * 360 > 350)


def skin_colours(body, sources, reach=0.03, keep=None):
    """The body's colour from his skin: each body vertex near one of `sources` ((object, face test)) takes
    its colour there (where it reads as skin), and those colours are spread over the rest of the body.
    Writes a point colour attribute 'skin_col' (sRGB values); returns the mean colour."""
    arrays = {im.name: image_array(im) for im in bpy.data.images if im.size[0] > 0}
    trees = [(o, test, tri_tree(o)) for o, test in sources]
    vs = body.data.vertices
    col = np.zeros((len(vs), 3))
    fixed = np.zeros(len(vs), bool)
    for v in vs:
        best = None
        for o, test, tt in trees:
            loc, n, fi, dist = tt[0].find_nearest(v.co, reach)
            if loc is None or (best and dist >= best[0]):
                continue
            if test and not test(o, tt[2][fi]):
                continue
            c = surface_colour(o, arrays, tt, loc, fi)
            if c is not None and skin_like(c):
                best = (dist, c)
        if best:
            col[v.index] = best[1]
            fixed[v.index] = True
    mean = col[fixed].mean(0) if fixed.any() else np.array([0.8, 0.6, 0.45])
    col[~fixed] = mean
    # spread: the free verts take their neighbours' mean, over and over
    ea = np.array([e.vertices[:] for e in body.data.edges])
    deg = np.bincount(ea.ravel(), minlength=len(vs)).astype(float)[:, None]
    for _ in range(400):
        acc = np.zeros_like(col)
        np.add.at(acc, ea[:, 0], col[ea[:, 1]])
        np.add.at(acc, ea[:, 1], col[ea[:, 0]])
        col = np.where(fixed[:, None], col, acc / np.maximum(deg, 1))
    # the sampled verts themselves smoothed a little (B3's painted lines are not his skin)
    for _ in range(3):
        acc = np.zeros_like(col)
        np.add.at(acc, ea[:, 0], col[ea[:, 1]])
        np.add.at(acc, ea[:, 1], col[ea[:, 0]])
        col = 0.5 * col + 0.5 * acc / np.maximum(deg, 1)
    a = body.data.attributes.get('skin_col') or body.data.attributes.new('skin_col', 'FLOAT_COLOR', 'POINT')
    for i, c in enumerate(lin(col)):   # (a float colour attribute is linear)
        a.data[i].color = (*c, 1.0)
    for _, _, tt in trees:
        tt[1].free()
    print('skin: %d of %d body verts sampled, mean %s' % (fixed.sum(), len(vs), np.round(mean * 255)))
    return mean


# ---------------------------------------------------------------- the atlas

def lin(c):
    c = np.asarray(c, dtype=float)
    return np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)


def emission_material(name, colour_node):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    colour_node(nt, em.inputs['Color'])
    return m


def tex_source(image):
    def make(nt, sock):
        uvn = nt.nodes.new('ShaderNodeUVMap')
        uvn.uv_map = 'UVMap'
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = image
        t.interpolation = 'Closest'
        nt.links.new(uvn.outputs[0], t.inputs[0])
        nt.links.new(t.outputs[0], sock)
    return make


def attr_source(name):
    def make(nt, sock):
        a = nt.nodes.new('ShaderNodeVertexColor')
        a.layer_name = name
        nt.links.new(a.outputs[0], sock)
    return make


def flat_source(rgb_linear):
    def make(nt, sock):
        sock.default_value = (*rgb_linear, 1.0)
    return make


def add_target(m, image):
    t = m.node_tree.nodes.new('ShaderNodeTexImage')
    t.image = image
    for n in m.node_tree.nodes:
        n.select = False
    t.select = True
    m.node_tree.nodes.active = t


def bake(objs, image, mats_for, margin=8):
    """Cycles' emission bake of each object's `mats_for(o)` material into `image` through the 'atlas' UVs."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 1
    sc.render.bake.margin = margin
    sc.render.bake.margin_type = 'EXTEND'
    saved = {}
    for o in objs:
        saved[o] = [s.material for s in o.material_slots]
        m = mats_for(o)
        add_target(m, image)
        for s in o.material_slots:
            s.material = m
        o.data.uv_layers.active = o.data.uv_layers['atlas']
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.hide_render = False
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type='EMIT', use_clear=True, margin=margin, margin_type='EXTEND', target='IMAGE_TEXTURES')
    for o in objs:
        for s, m in zip(o.material_slots, saved[o]):
            s.material = m


def pack_uvs(objs, swatch_faces, body_scale, groups, top=0.97, scales={}):
    """'atlas' UVs: each part's own UVs (B3's and head-v3's; the body's scaled to `body_scale`), each group
    of parts packed (turned as fits best) into its own square, the squares side by side (the atlas is as
    many times wider than tall), all below `top` (the strip above holds the swatches)."""
    aspect = len(groups)
    for o in objs:
        me = o.data
        src = me.uv_layers['UVMap']
        if 'atlas' in me.uv_layers:
            me.uv_layers.remove(me.uv_layers['atlas'])
        at = me.uv_layers.new(name='atlas')
        n = len(me.loops)
        buf = np.empty(n * 2, dtype=np.float32)
        src.data.foreach_get('uv', buf)
        buf = buf.reshape(n, 2)
        buf *= body_scale if o.get('kind') == 'body' else scales.get(o.get('kind'), 1.0)
        at.data.foreach_set('uv', buf.ravel())
        me.uv_layers.active = at
    for gi, names in enumerate(groups):
        group = [o for o in objs if o.name in names]
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:
            o.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.context.scene.tool_settings.use_uv_select_sync = False
        for o in group:
            bm = bmesh.from_edit_mesh(o.data)
            skip = swatch_faces.get(o.name, set())
            for f in bm.faces:
                f.select = f.index not in skip
            bmesh.update_edit_mesh(o.data)
        bpy.ops.uv.select_all(action='SELECT')
        # (turning the islands doubles how much of the square they fill against not turning them)
        bpy.ops.uv.pack_islands(rotate=True, rotate_method='ANY', scale=True, merge_overlap=False,
                                margin_method='FRACTION', margin=0.002, shape_method='CONCAVE')
        bpy.ops.object.mode_set(mode='OBJECT')
        for o in group:
            at = o.data.uv_layers['atlas']
            n = len(o.data.loops)
            buf = np.empty(n * 2, dtype=np.float32)
            at.data.foreach_get('uv', buf)
            buf = buf.reshape(n, 2)
            buf[:, 0] = (buf[:, 0] + gi) / aspect
            at.data.foreach_set('uv', buf.ravel())
    scale = {}
    for o in objs:
        at = o.data.uv_layers['atlas']
        n = len(o.data.loops)
        buf = np.empty(n * 2, dtype=np.float32)
        at.data.foreach_get('uv', buf)
        buf = buf.reshape(n, 2)
        buf[:, 1] *= top
        at.data.foreach_set('uv', buf.ravel())
        # texel size kept: atlas area (in texels of a 2048-tall atlas) over source area (2048 texels a unit)
        src = np.empty(n * 2, dtype=np.float32)
        o.data.uv_layers['UVMap'].data.foreach_get('uv', src)
        src = src.reshape(n, 2)
        a_src = a_dst = 0.0
        skip = swatch_faces.get(o.name, set())
        for p in o.data.polygons:
            if p.index in skip:
                continue
            li = list(p.loop_indices)
            for k in range(1, len(li) - 1):
                for arr, acc in ((src, 0), (buf, 1)):
                    (x0, y0), (x1, y1), (x2, y2) = arr[li[0]], arr[li[k]], arr[li[k + 1]]
                    ar = abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) / 2
                    if acc:
                        a_dst += ar * aspect
                    else:
                        a_src += ar
        scale[o.name] = (round(math.sqrt(a_dst / a_src), 3) if a_src else 0, round(a_src, 4))
    print('atlas: texel size kept per part', scale)
    return scale


def put_swatches(objs, swatch_faces, swatch_of, size, top):
    """Each swatch face's 'atlas' UVs onto its swatch's square in the top strip."""
    W, H = size
    keys = []
    for o in objs:
        for fi in swatch_faces.get(o.name, ()):
            k = swatch_of(o, fi)
            if k not in keys:
                keys.append(k)
    side = int(H * (1 - top)) - 4
    where = {}
    for i, k in enumerate(keys):
        x0, y0 = 4 + i * (side + 8), int(H * top) + 2
        where[k] = (x0, y0, side)
    for o in objs:
        me = o.data
        at = me.uv_layers['atlas']
        for fi in swatch_faces.get(o.name, ()):
            x0, y0, s = where[swatch_of(o, fi)]
            p = me.polygons[fi]
            corners = [(x0 + s * 0.25, y0 + s * 0.25), (x0 + s * 0.75, y0 + s * 0.25), (x0 + s * 0.75, y0 + s * 0.75), (x0 + s * 0.25, y0 + s * 0.75)]
            for j, li in enumerate(p.loop_indices):
                cx, cy = corners[min(j, 3)]
                at.data[li].uv = (cx / W, cy / H)
    return where


def clean_paint(px, ids, garments, ink=0.33, soft=0.05):
    """Each garment's foreign paint (texels whose chroma is far from the garment's own, ink lines apart)
    takes the garment's chroma, keeping its lightness. px: HxWx4 sRGB; ids: HxW object index (-1 none).
    garments: index -> name."""
    rgb = px[..., :3]
    Y = rgb @ np.array([0.299, 0.587, 0.114])
    cb = rgb[..., 2] - Y
    cr = rgb[..., 0] - Y
    out = rgb.copy()
    report = {}
    for gi, name in garments.items():
        m = ids == gi
        if not m.any():
            continue
        lit = m & (Y > ink)
        base_cb, base_cr = np.median(cb[lit]), np.median(cr[lit])
        dist = np.hypot(cb - base_cb, cr - base_cr)
        thr = {'shirt': 0.10, 'skin': 0.10}.get(name, 0.05)
        k = np.clip((dist - thr) / soft, 0, 1) * m * (Y > ink * 0.8)
        new = np.stack([Y + base_cr, Y - 0.299 / 0.587 * base_cr - 0.114 / 0.587 * base_cb, Y + base_cb], -1)
        out = out * (1 - k[..., None]) + np.clip(new, 0, 1) * k[..., None]
        report[name] = round(float(k[m].mean()) * 100, 1)
    px[..., :3] = out
    return report


def garment_base(px, ids, gi, ink=0.33):
    rgb = px[..., :3]
    m = ids == gi
    Y = rgb @ np.array([0.299, 0.587, 0.114])
    sel = m & (Y > ink)
    return np.median(rgb[sel], axis=0) if sel.any() else np.array([0.5, 0.5, 0.5])


# ---------------------------------------------------------------- under the shirt: B3's scraps out, backing in

def _split_on(bm, faces, val, kl=None, kind=None):
    """Cut `faces` along val(v) = 0 (edges split where it changes sign, faces joined across); returns the
    verts made on the line. val: dict vert -> float, filled in for the new verts."""
    made = set()
    edges = {e for f in faces for e in f.edges}
    for e in list(edges):
        a, b = e.verts
        fa, fb = val.get(a, 1.0), val.get(b, 1.0)
        if fa * fb < 0:
            t = fa / (fa - fb)
            if t < 0.03 or t > 0.97:
                v = a if t < 0.5 else b
                val[v] = 0.0
                made.add(v)
                continue
            ne, nv = bmesh.utils.edge_split(e, a, t)
            val[nv] = 0.0
            made.add(nv)
    for f in list(faces):
        if not f.is_valid:
            continue
        zero = [v for v in f.verts if v in made]
        if len(zero) == 2 and bm.edges.get(zero) is None:
            res = bmesh.ops.connect_verts(bm, verts=zero)
            if kl is not None:
                for e in res['edges']:
                    for g in e.link_faces:
                        g[kl] = kind
    return made


def _drop_crumbs(bm, kl, kind, size):
    seen, crumbs = set(), []
    for f in bm.faces:
        if f in seen or f[kl] != kind:
            continue
        comp, todo = [f], [f]
        seen.add(f)
        while todo:
            g = todo.pop()
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen and h[kl] == kind:
                        seen.add(h)
                        comp.append(h)
                        todo.append(h)
        if len(comp) < size:
            crumbs += comp
    bmesh.ops.delete(bm, geom=crumbs, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    return len(crumbs)


def trim_under(o, shell, zmin, reach=0.08, smooth=30, keep=None):
    """B3's own surface of `o` that lies under `shell` (a ray out along the face normal meets it within
    `reach`) above `zmin` goes (`keep(centre)` spares a region), cut along a smoothed line: under the shirt
    the backing is the garment, and B3's scraps there (fused to the shirt, torn) are gone."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.normal_update()
    kl = bm.faces.layers.int['p3']
    b2 = bmesh.new()
    b2.from_mesh(shell.data)
    tree = BVHTree.FromBMesh(b2)
    surf = [f for f in bm.faces if f[kl] == SURFACE]
    drop = set()
    for f in surf:
        c = f.calc_center_median()
        if c.z < zmin or (keep and keep(c)):
            continue
        if tree.ray_cast(c + f.normal * 0.002, f.normal, reach)[0] is not None:
            drop.add(f)
    # a score on the verts (1 kept), smoothed, cut at 0.5
    sv = {v for f in surf for v in f.verts}

    def own(v):
        fs = [g for g in v.link_faces if g[kl] == SURFACE]
        return sum(1 for g in fs if g not in drop) / max(1, len(fs))
    s = {v: own(v) for v in sv}
    for _ in range(smooth):
        s = {v: 0.5 * s[v] + 0.5 * sum(s.get(e.other_vert(v), s[v]) for e in v.link_edges) / max(1, len(v.link_edges)) for v in sv}
    val = {v: x - 0.5 for v, x in s.items()}
    _split_on(bm, surf, val, kl, SURFACE)
    gone = [f for f in bm.faces if f[kl] == SURFACE and sum(val.get(v, 0.5) for v in f.verts) / len(f.verts) < 0]
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    crumbs = _drop_crumbs(bm, kl, SURFACE, 60)
    bm.to_mesh(o.data)
    bm.free()
    b2.free()
    return {'dropped': len(gone) + crumbs}


def taper(o, width=0.05, lift=0.002):
    """B3's surface of `o` eased down onto its own backing near its cut edges (within `width` of an edge
    that lies over the backing): no ledge where B3's cloth ends over the backing."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    kl = bm.faces.layers.int['p3']
    back = bmesh.new()
    back.from_mesh(o.data)
    klb = back.faces.layers.int['p3']
    bmesh.ops.delete(back, geom=[f for f in back.faces if f[klb] != BACKING], context='FACES')
    back.normal_update()
    if not back.faces:
        return {'tapered': 0}
    tree = BVHTree.FromBMesh(back)
    import heapq
    d = {}
    heap = []
    for e in bm.edges:
        if e.is_boundary and all(f[kl] == SURFACE for f in e.link_faces):
            for v in e.verts:
                hit = tree.find_nearest(v.co, 0.03)
                if hit[0] is not None and v not in d:
                    d[v] = 0.0
                    heapq.heappush(heap, (0.0, id(v), v))
    while heap:
        dv, _, v = heapq.heappop(heap)
        if dv > d.get(v, 1e9) or dv > width:
            continue
        for e in v.link_edges:
            w = e.other_vert(v)
            nd = dv + e.calc_length()
            if nd < d.get(w, 1e9):
                d[w] = nd
                heapq.heappush(heap, (nd, id(w), w))
    moved = 0
    for v, dv in d.items():
        if dv >= width:
            continue
        hit = tree.find_nearest(v.co, 0.05)
        if hit[0] is None:
            continue
        target = hit[0] + hit[1] * lift
        k = 1 - smoothstep(0.0, width, dv)
        v.co = v.co.lerp(target, k)
        moved += 1
    bm.to_mesh(o.data)
    bm.free()
    back.free()
    return {'tapered': moved}


def clamp_backing(o, shells, gap=0.008, reach=0.04, rounds=4):
    """The backing verts of `o` kept `gap` under its own (trimmed) B3 surface and under `shells`, relaxed
    between rounds (open edges along their edge), so it sits inside without a ledge or spikes."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    kl = bm.faces.layers.int['p3']
    own = bmesh.new()
    own.from_mesh(o.data)
    klo = own.faces.layers.int['p3']
    bmesh.ops.delete(own, geom=[f for f in own.faces if f[klo] != SURFACE], context='FACES')
    own.normal_update()
    trees = [BVHTree.FromBMesh(own)] if own.faces else []
    for s in shells:
        b2 = bmesh.new()
        b2.from_mesh(s.data)
        trees.append(BVHTree.FromBMesh(b2))
        b2.free()
    vs = [v for v in bm.verts if v.link_faces and all(f[kl] == BACKING for f in v.link_faces)]
    moved = 0
    for r in range(rounds):
        bm.normal_update()
        for v in vs:
            # along its own normal (a nearest-point snap follows every fold of the shell: spikes): out of the
            # shell (a ray in meets it from behind) or within `gap` under it (a ray out meets it), it goes in
            n = v.normal.copy()
            if n.length < 0.5:
                continue
            push = 0.0
            for t in trees:
                q, hn, _, d = t.ray_cast(v.co - n * reach, n, reach)   # from inside, out to the vert
                if q is not None and hn.dot(n) > 0.3:
                    push = max(push, (reach - d) + gap)                 # the vert is outside by reach - d
                    continue
                q, hn, _, d = t.ray_cast(v.co, n, gap)
                if q is not None:
                    push = max(push, gap - d)
            if push > 0:
                v.co -= n * push
                moved += 1
        if r < rounds - 1:   # (Taubin: no shrinking)
            for f in (0.5, -0.53):
                new = {}
                for v in vs:
                    nb = [e.other_vert(v) for e in v.link_edges if (e.is_boundary or not v.is_boundary)]
                    if nb:
                        new[v] = v.co + (sum((w.co for w in nb), Vector()) / len(nb) - v.co) * f
                for v, p in new.items():
                    v.co = p
    bm.to_mesh(o.data)
    bm.free()
    own.free()
    return {'clamped': moved}


def drop_hidden_backing(o, reach=0.03):
    """Backing faces right behind the garment's own B3 surface (rays out from the face and its corners all
    meet it within `reach`) go."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.normal_update()
    kl = bm.faces.layers.int['p3']
    surf = bmesh.new()
    surf.from_mesh(o.data)
    kls = surf.faces.layers.int['p3']
    bmesh.ops.delete(surf, geom=[f for f in surf.faces if f[kls] != SURFACE], context='FACES')
    tree = BVHTree.FromBMesh(surf)
    gone = []
    for f in bm.faces:
        if f[kl] != BACKING:
            continue
        pts = [f.calc_center_median()] + [v.co for v in f.verts]
        if all(tree.ray_cast(p + f.normal * 0.001, f.normal, reach)[0] is not None for p in pts):
            gone.append(f)
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    surf.free()
    return {'dropped': len(gone)}

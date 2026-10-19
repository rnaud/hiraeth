"""Phase 2 of issue #493: the approved B3 traveller's own surface (public/characters/traveller-b3/model.glb),
cut into its garments along its colour regions (colors.json, one RGB a vertex): each face labelled by the
colours of its verts and where it is, the labels smoothed over the mesh (an ink crease takes the colour
round it), small islands folded into their surroundings, then split into one object a label. B3 is
already skinned to the game's 53 bones, so each piece keeps its own weights."""
import colorsys, json, math
import bmesh
import bpy
from mathutils import Vector

LABELS = ['skin', 'shirt', 'tee', 'trousers', 'boots', 'scarf', 'head']
HEAD_CUT = 1.515      # traveller-b3.js: B3's own head goes above this (head-v3 replaces it)
SEAM_SMOOTH = 25
OPENING = 0.13       # the shirt's front opening, either side of the middle (pass 3)
HEM = None           # the shirt's hem height at a point round the hips (set by label_faces)      # how far the labels' scores diffuse before the cut (more: straighter, rounder seams)


def vertex_label(p, rgb):
    """A vertex's label from its colour and its place (Blender's frame: z up, facing -Y)."""
    r, g, b = (c / 255 for c in rgb)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    hue = h * 360
    if v < 0.33:
        return None                     # an ink line: its neighbours decide
    coral = (hue < 22 or hue > 340) and s > 0.33
    if p.z > HEAD_CUT and not coral:
        return 'head'
    if coral:
        return 'shirt'
    if 1.38 < p.z <= HEAD_CUT + 0.01 and abs(p.x) < 0.13 and s > 0.2:
        return 'scarf'
    if p.z < 0.205 and s < 0.45:
        return 'boots'
    if s >= 0.33 and 15 < hue < 45:
        # his skin shows only past the sleeves and at the ankles; skin-coloured paint elsewhere (a
        # pocket's shadow) is the cloth's
        if abs(p.x) > 0.42 or p.z < 0.3:
            return 'skin'
        return None
    if s < 0.33 and v > 0.6:
        if p.z < 0.205:
            return 'boots'
        return 'tee' if p.z > 0.965 else 'trousers'
    return None


def label_faces(ob, colors):
    """Per face: the majority of its verts' labels, then smoothed by its neighbours' majority."""
    me = ob.data
    M = ob.matrix_world
    vl = [vertex_label(M @ v.co, c) for v, c in zip(me.vertices, colors)]
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    lab = []
    for f in bm.faces:
        votes = {}
        for v in f.verts:
            if vl[v.index]:
                votes[vl[v.index]] = votes.get(vl[v.index], 0) + 1
        lab.append(max(votes, key=votes.get) if votes else None)
    # weld the glTF's split verts (UV seams stay in the loops), so labels and seams cross them
    fl = bm.faces.layers.int.new('label')
    for f, l in zip(bm.faces, lab):
        f[fl] = LABELS.index(l) if l else -1
    n0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    print('B3: %d verts welded to %d' % (n0, len(bm.verts)))
    bm.faces.ensure_lookup_table()
    bm.verts.ensure_lookup_table()
    lab = [LABELS[f[fl]] if f[fl] >= 0 else None for f in bm.faces]
    bm.to_mesh(me)
    nbr =[[g.index for e in f.edges for g in e.link_faces if g is not f] for f in bm.faces]
    for it in range(8):   # fill the unlabelled (ink) from neighbours, and smooth
        new = []
        for i, l in enumerate(lab):
            votes = {}
            for j in nbr[i]:
                if lab[j]:
                    votes[lab[j]] = votes.get(lab[j], 0) + 1
            if l:
                votes[l] = votes.get(l, 0) + 1.5
            new.append(max(votes, key=votes.get) if votes else l)
        lab = new
    lab = [l or 'shirt' for l in lab]
    # where it is known: his own head above the collar; the boots below their shaft's top
    for f in bm.faces:
        c = M @ f.calc_center_median()
        if c.z > HEAD_CUT + 0.03:
            lab[f.index] = 'head'
        elif c.z < 0.17 and abs(c.x) < 0.25:
            lab[f.index] = 'boots'
    # islands under 60 faces join the label round them
    for _ in range(3):
        seen = [False] * len(lab)
        for i in range(len(lab)):
            if seen[i]:
                continue
            comp, todo = [i], [i]
            seen[i] = True
            while todo:
                k = todo.pop()
                for j in nbr[k]:
                    if not seen[j] and lab[j] == lab[i]:
                        seen[j] = True
                        comp.append(j)
                        todo.append(j)
            if len(comp) < 60:
                votes = {}
                for k in comp:
                    for j in nbr[k]:
                        if lab[j] != lab[i]:
                            votes[lab[j]] = votes.get(lab[j], 0) + 1
                if votes:
                    w = max(votes, key=votes.get)
                    for k in comp:
                        lab[k] = w
    # pass 3: the tee, the trousers and the scarf are each one piece of cloth; their other islands (B3's
    # cream paint inside the shirt's back, say) are holes in whatever is round them, and join it
    # pass 3: cream paint on the shirt is the shirt's own, not the tee or the trousers showing through a hole:
    # outside the shirt's front opening, anything above the shirt's hem (its lowest coral, round the hips in
    # 15-degree sectors, each the lowest of itself and its neighbours) is the shirt
    cs = [M @ f.calc_center_median() for f in bm.faces]
    cy = sum(c.y for c, l in zip(cs, lab) if l == 'trousers') / max(1, sum(1 for l in lab if l == 'trousers'))
    sect = lambda c: int((math.degrees(math.atan2(c.x, c.y - cy)) + 180) // 15) % 24
    lows = [[] for _ in range(24)]
    for c, l in zip(cs, lab):
        if l == 'shirt' and 0.6 < c.z < 1.2 and abs(c.x) < 0.3:
            lows[sect(c)].append(c.z)
    raw = [sorted(z)[len(z) // 30] if z else 0.0 for z in lows]
    hem = [min(raw[(k - 1) % 24], raw[k], raw[(k + 1) % 24]) for k in range(24)]
    flipped = 0
    for i, (c, l) in enumerate(zip(cs, lab)):
        if l in ('tee', 'trousers') and c.z < 1.2 and abs(c.x) < 0.3 and not (c.y < 0 and abs(c.x) < OPENING) and hem[sect(c)] and c.z > hem[sect(c)] + 0.012:
            lab[i] = 'shirt'
            flipped += 1
    print('B3: hem by sector %s; %d cream faces above it are the shirt' % ([round(h, 2) for h in hem], flipped))
    global HEM
    HEM = lambda c: hem[sect(c)] or 0.85   # (the shirt's hem height round the hips, for build_b3's trims)
    # (opened first: a patch joined to the main piece by a thin neck of faces, across a fused hem, is cut off)
    centre = [M @ f.calc_center_median() for f in bm.faces]
    ERODE = 3
    for name in ('tee', 'trousers', 'scarf', 'skin'):
        core = {i for i, l in enumerate(lab) if l == name}
        er = 1 if name == 'skin' else ERODE
        for _ in range(er):
            core = {i for i in core if all(j in core for j in nbr[i])}
        seen = set()
        comps = []
        for i in core:
            if i in seen:
                continue
            comp, todo = [i], [i]
            seen.add(i)
            while todo:
                k = todo.pop()
                for j in nbr[k]:
                    if j in core and j not in seen:
                        seen.add(j)
                        comp.append(j)
                        todo.append(j)
            comps.append(comp)
        if name == 'skin':   # his skin: the hands and forearms, the ankles; not a painted shadow on the clothes
            keep = [c for c in comps if any(abs(centre[k].x) > 0.42 or centre[k].z < 0.3 for k in c)]
        else:
            keep = sorted(comps, key=len, reverse=True)[:1]
        reach = {k for c in keep for k in c}
        for _ in range(er + 1):
            reach |= {j for k in reach for j in nbr[k] if lab[j] == name}
        for i, l in enumerate(lab):
            if l == name and i not in reach:
                lab[i] = None
    for _ in range(30):   # the faces let go take the label round them
        todo = [i for i, l in enumerate(lab) if l is None]
        if not todo:
            break
        for i in todo:
            votes = {}
            for j in nbr[i]:
                if lab[j]:
                    votes[lab[j]] = votes.get(lab[j], 0) + 1
            if votes:
                lab[i] = max(votes, key=votes.get)
    lab = [l or 'shirt' for l in lab]
    for name in ('tee', 'trousers', 'scarf'):
        seen = [False] * len(lab)
        comps = []
        for i in range(len(lab)):
            if seen[i] or lab[i] != name:
                continue
            comp, todo = [i], [i]
            seen[i] = True
            while todo:
                k = todo.pop()
                for j in nbr[k]:
                    if not seen[j] and lab[j] == name:
                        seen[j] = True
                        comp.append(j)
                        todo.append(j)
            comps.append(comp)
        comps.sort(key=len, reverse=True)
        for comp in comps[1:]:
            votes = {}
            for k in comp:
                for j in nbr[k]:
                    if lab[j] != name:
                        votes[lab[j]] = votes.get(lab[j], 0) + 1
            if votes:
                w = max(votes, key=votes.get)
                for k in comp:
                    lab[k] = w
    bm.free()
    return lab


CUT_ORDER = ['head', 'boots', 'scarf', 'skin', 'tee', 'trousers', 'shirt']


def smooth_cut(ob, lab):
    """Straight seams (the painted edges are ragged, the triangles big): each label a score on the verts,
    diffused over the mesh; then, label by label, the triangles are cut along the line where that label's
    score meets the best of the rest (the edges split there, UVs and weights interpolated), and the faces
    on its side take it. Sets each face's material index to its label."""
    import numpy as np
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    nv, nl = len(bm.verts), len(LABELS)
    score = np.zeros((nv, nl))
    for f, l in zip(bm.faces, lab):
        for v in f.verts:
            score[v.index, LABELS.index(l)] += 1
    score /= np.maximum(score.sum(1, keepdims=True), 1e-9)
    ea = np.array([[e.verts[0].index, e.verts[1].index] for e in bm.edges])
    deg = np.bincount(ea.ravel(), minlength=nv).astype(float)[:, None]
    for _ in range(SEAM_SMOOTH):
        acc = np.zeros_like(score)
        np.add.at(acc, ea[:, 0], score[ea[:, 1]])
        np.add.at(acc, ea[:, 1], score[ea[:, 0]])
        score = 0.5 * score + 0.5 * acc / np.maximum(deg, 1)
    S = {v: score[v.index] for v in bm.verts}
    remaining = set(bm.faces)
    left = list(CUT_ORDER)
    out = {}
    for L in CUT_ORDER[:-1]:
        li = LABELS.index(L)
        others = [LABELS.index(x) for x in left if x != L]
        left.remove(L)
        fval = lambda v: S[v][li] - max(S[v][k] for k in others)
        edges = {e for f in remaining for e in f.edges}
        made = set()
        for e in list(edges):
            a, b = e.verts
            fa, fb = fval(a), fval(b)
            if fa * fb < 0 and abs(fa - fb) > 1e-9:
                t = fa / (fa - fb)
                if t < 0.02 or t > 0.98:      # (nearly on a vert: snap the vert instead)
                    v = a if t < 0.5 else b
                    S[v] = S[v].copy()
                    S[v][li] = max(S[v][k] for k in others)
                    made.add(v)
                    continue
                sa, sb = S[a], S[b]
                ne, nv_ = bmesh.utils.edge_split(e, a, t)
                S[nv_] = sa * (1 - t) + sb * t
                S[nv_][li] = max(S[nv_][k] for k in others)
                made.add(nv_)
        new_faces = set()
        for f in list(remaining):
            if not f.is_valid:
                continue
            zero = [v for v in f.verts if v in made]
            if len(zero) == 2 and bm.edges.get(zero) is None:
                res = bmesh.ops.connect_verts(bm, verts=zero)
                for e in res['edges']:
                    for g in e.link_faces:
                        new_faces.add(g)
        remaining = {f for f in remaining if f.is_valid} | {f for f in new_faces if f.is_valid}
        print('cut %s: %d seam verts, %d faces split' % (L, len(made), len(new_faces)))
        mine = set()
        for f in remaining:
            if sum(fval(v) for v in f.verts) / len(f.verts) > 0:
                mine.add(f)
        for f in mine:
            out[f] = L
        remaining -= mine
    for f in remaining:
        out[f] = CUT_ORDER[-1]
    for f in bm.faces:
        f.material_index = LABELS.index(out.get(f, CUT_ORDER[-1]))
    bm.to_mesh(ob.data)
    bm.free()


def split(ob, base_material):
    """One object a label (vertex groups, UVs and the texture kept: each label its own copy of B3's
    material, so each garment can be tinted alone)."""
    me = ob.data
    idx = [p.material_index for p in me.polygons]
    me.materials.clear()
    for name in LABELS:
        m = base_material.copy()
        m.name = 'b3_' + name
        me.materials.append(m)
    for p, i in zip(me.polygons, idx):
        p.material_index = i
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')
    out = {}
    for o in bpy.context.selected_objects:
        used = {p.material_index for p in o.data.polygons}
        if len(used) != 1:
            continue
        mat = o.data.materials[used.pop()]
        name = mat.name[len('b3_'):]
        # keep only the one material
        o.data.materials.clear()
        o.data.materials.append(mat)
        out[name] = o
    return out


def bake_world(o):
    """Into world space, off B3's armature (its weights stay as vertex groups)."""
    M = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = M
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    o.data.transform(M)
    o.matrix_world.identity()


def lip(o, depth=0.004):
    """Every open edge turned in a little (a hem's thickness): the cut reads as cloth, not a paper edge."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.normal_update()
    edges = [e for e in bm.edges if e.is_boundary]
    vn = {}
    for e in edges:
        for v in e.verts:
            vn[v] = v.normal.copy()
    from mathutils.kdtree import KDTree
    srcs = list(vn)
    kd = KDTree(max(1, len(srcs)))
    for i, s in enumerate(srcs):
        kd.insert(s.co, i)
    kd.balance()
    ret = bmesh.ops.extrude_edge_only(bm, edges=edges)
    new = [x for x in ret['geom'] if isinstance(x, bmesh.types.BMVert)]
    for v in new:
        co, i, d = kd.find(v.co)      # the extruded vert sits on its source
        if i is not None and d < 1e-6:
            v.co -= vn[srcs[i]] * depth
    bm.to_mesh(o.data)
    bm.free()
    return len(edges)

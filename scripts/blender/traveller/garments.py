"""The traveller's clothes (issue #493), each its own mesh: cut from the body's cage (the same rings, so
the same loops at the joints), grown out from the skin, given hems, cuffs and a collar, subdivided like
the body and given a thickness. Also the body's areas (what each garment hides) and the UVs.

A new outfit adds an entry to SPEC (docs/systems/characters.md, "Outfits")."""
import math
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from loft import smoothstep, lerp
import body as B

PART = {name: i for i, name in enumerate(B.PARTS)}


def arm_t(p, J):
    sh, wr = J['upperarm_l'], J['hand_l']
    return (abs(p.x) - sh.x) / (wr.x - sh.x)


# Each garment: the cage's parts and heights it covers, how far it stands off the skin, its layer (0 the
# skin, 1 next to it, 2 over that, 3 outermost), its materials, its thickness, and where its verts sample
# the body's weights (a long shirt's hem samples the hips, not the thighs).
SPEC = {
    'Tee': dict(layer=1, materials=['tee'], thickness=0.002,
                sample=None),
    'Trousers': dict(layer=1, materials=['trousers'], thickness=0.0025,
                     sample=None),
    'Boots': dict(layer=1, materials=['boot', 'sole'], thickness=0.004,
                  sample=None),
    'Shirt': dict(layer=2, materials=['shirt', 'shirt_lining'], thickness=0.0028,
                  sample=lambda p: Vector((p.x, p.y, max(p.z, 0.905)))),
    'Scarf': dict(layer=3, materials=['scarf'], thickness=0.0,
                  sample=lambda p: Vector((p.x * 0.75, p.y * 0.75 + 0.004, min(max(p.z, 1.44), 1.50)))),
}


def cut(cage, keep_vert, keep_face=None):
    """A new bmesh of the cage's faces whose every vert passes keep_vert(v, part); each new vert carries the
    cage's normal there (layer 'n' as three floats) and its part."""
    cage.normal_update()
    lay = cage.verts.layers.int.get('part')
    out = bmesh.new()
    pl = out.verts.layers.int.new('part')
    nx, ny, nz = (out.verts.layers.float.new(k) for k in ('nx', 'ny', 'nz'))
    m = {}
    for f in cage.faces:
        if not all(keep_vert(v, v[lay]) for v in f.verts):
            continue
        if keep_face and not keep_face(f):
            continue
        vs = []
        for v in f.verts:
            if v not in m:
                w = out.verts.new(v.co)
                w[pl] = v[lay]
                w[nx], w[ny], w[nz] = v.normal
                m[v] = w
            vs.append(m[v])
        out.faces.new(vs)
    return out


def normal(bm, v):
    nx, ny, nz = (bm.verts.layers.float.get(k) for k in ('nx', 'ny', 'nz'))
    return Vector((v[nx], v[ny], v[nz]))


def inflate(bm, offset):
    pl = bm.verts.layers.int.get('part')
    moves = [(v, normal(bm, v) * offset(v.co, v[pl])) for v in bm.verts]
    for v, d in moves:
        v.co += d


def boundary_loops(bm):
    """The boundary's loops, each a list of verts in order."""
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
            o = x.other_vert(v)
            if o is loop[0]:
                break
            loop.append(o)
        loops.append(loop)
    return loops


def extrude(bm, loop_verts, move, closed=True):
    """Extrude a boundary run of verts; move(v_old_co) -> new position. Returns the new run."""
    new = [bm.verts.new(move(v.co.copy(), v)) for v in loop_verts]
    pl = bm.verts.layers.int.get('part')
    nl = [bm.verts.layers.float.get(k) for k in ('nx', 'ny', 'nz')]
    for a, b in zip(loop_verts, new):
        b[pl] = a[pl]
        for l in nl:
            b[l] = a[l]
    n = len(loop_verts)
    for k in range(n if closed else n - 1):
        k1 = (k + 1) % n
        try:
            bm.faces.new((loop_verts[k], loop_verts[k1], new[k1], new[k]))
        except ValueError:
            pass
    return new


def radial(c_axis):
    """Outward from a vertical axis through c_axis (x, y)."""
    def f(p):
        d = Vector((p.x - c_axis[0], p.y - c_axis[1], 0))
        return d.normalized() if d.length > 1e-6 else Vector((1, 0, 0))
    return f


def runs(loop, pred):
    """The contiguous runs of a closed loop's verts that pass pred, each in the loop's order."""
    n = len(loop)
    ok = [pred(v) for v in loop]
    if all(ok):
        return [loop]
    start = next(k for k in range(n) if not ok[k])
    out, cur = [], []
    for k in range(1, n + 1):
        v = loop[(start + k) % n]
        if ok[(start + k) % n]:
            cur.append(v)
        elif cur:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


# ------------------------------------------------------------------ the garments

def tee(cage, J):
    bm = cut(cage, lambda v, p: (p == PART['torso'] and v.co.z >= 0.93) or (p == PART['arm'] and arm_t(v.co, J) < 0.36))
    inflate(bm, lambda p, part: 0.006 + 0.004 * smoothstep(1.25, 1.05, p.z) * (part == PART['torso']))
    return bm


def shirt(cage, J):
    """The coral overshirt: open down the front, long to the top of the thighs, its sleeves rolled to
    below the elbow, a collar standing up behind the neck and falling over."""
    bm = cut(cage, lambda v, p: p == PART['torso'] or (p == PART['arm'] and arm_t(v.co, J) < 0.70),
             keep_face=lambda f: not any(abs(v.co.x) < 1e-5 and v.co.y < 0 for v in f.verts))

    def off(p, part):
        if part == PART['arm']:
            t = arm_t(p, J)
            return 0.026 + 0.010 * smoothstep(0.2, 0.5, t) - 0.006 * smoothstep(0.55, 0.7, t)
        return 0.024 + 0.018 * smoothstep(1.28, 0.90, p.z) + 0.010 * smoothstep(1.30, 1.42, p.z) * smoothstep(0.06, 0.14, abs(p.x))
    inflate(bm, off)
    loops = boundary_loops(bm)
    # the boundary: two sleeve ends (out at the arms), and one loop up each front edge, round the collar
    # and back along the hem
    for loop in loops:
        xs = [abs(v.co.x) for v in loop]
        if min(xs) > 0.3:     # a sleeve's end: roll it back
            c = sum((v.co for v in loop), Vector()) / len(loop)
            out = lambda p, v: p + (p - Vector((p.x, c.y, c.z))).normalized() * 0.011 + Vector((math.copysign(0.004, p.x), 0, 0))
            r1 = extrude(bm, loop, out)
            r2 = extrude(bm, r1, lambda p, v: p + Vector((-math.copysign(0.036, p.x), 0, 0)))
            extrude(bm, r2, lambda p, v: p - (p - Vector((p.x, c.y, c.z))).normalized() * 0.010)
            continue
        out = radial((0.0, 0.02))
        for run in runs(loop, lambda v: v.co.z > 1.44):   # the collar stands, then falls over
            if len(run) >= 4:
                stand = extrude(bm, run, lambda p, v: p + Vector((0, 0, 0.026)) - out(p) * 0.004, closed=False)
                extrude(bm, stand, lambda p, v: p + out(p) * 0.018 - Vector((0, 0, 0.012)), closed=False)
        for run in runs(loop, lambda v: v.co.z < 0.90):   # the hem: on down over the hips, flaring
            if len(run) >= 4:
                r1 = extrude(bm, run, lambda p, v: Vector((p.x, p.y, 0.835)) + out(p) * 0.006, closed=False)
                extrude(bm, r1, lambda p, v: Vector((p.x, p.y, 0.805)) + out(p) * 0.004, closed=False)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def trousers(cage, J):
    bm = cut(cage, lambda v, p: (p == PART['torso'] and v.co.z <= 1.015) or (p == PART['leg'] and v.co.z >= 0.29))

    def off(p, part):
        return 0.009 + 0.015 * smoothstep(0.90, 0.60, p.z) - 0.004 * smoothstep(0.42, 0.26, p.z)
    inflate(bm, off)
    for v in bm.verts:     # a looser seat: the crotch hangs lower
        if abs(v.co.x) < 0.03 and v.co.z < 0.9:
            v.co.z -= 0.035 * (1 - abs(v.co.x) / 0.03)
    for loop in boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        if c.z > 0.9:          # the waistband: turned in
            extrude(bm, loop, lambda p, v: p - (p - Vector((0, c.y, p.z))).normalized() * 0.006 - Vector((0, 0, 0.012)))
        else:                  # on down to mid-shin, level, and a turned-up hem
            loop = extrude(bm, loop, lambda p, v: Vector((c.x, c.y, 0.25)) + (p - Vector((c.x, c.y, p.z))) * 0.95)
            out = lambda p, v: p + (p - Vector((c.x, c.y, p.z))).normalized() * 0.008
            r1 = extrude(bm, loop, out)
            r2 = extrude(bm, r1, lambda p, v: p + Vector((0, 0, 0.034)))
            extrude(bm, r2, lambda p, v: p - (p - Vector((c.x, c.y, p.z))).normalized() * 0.009)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def boots(cage, J):
    ankle = J['foot_l']
    bm = cut(cage, lambda v, p: p == PART['foot'] or (p == PART['leg'] and v.co.z <= 0.205))

    def off(p, part):
        toe = smoothstep(ankle.y - 0.05, ankle.y - 0.13, p.y)
        return 0.014 + 0.008 * toe
    inflate(bm, off)
    for v in bm.verts:
        if v.co.z < 0.045:   # a flat sole under him
            v.co.z = max(0.0, v.co.z - 0.016 * smoothstep(0.045, 0.0, v.co.z))
        if v.co.y < ankle.y - 0.10:   # a rounder, higher toe
            v.co.z += 0.006 * smoothstep(ankle.y - 0.10, ankle.y - 0.17, v.co.y)
    for loop in boundary_loops(bm):
        c = sum((v.co for v in loop), Vector()) / len(loop)
        extrude(bm, loop, lambda p, v: p + (p - Vector((c.x, c.y, p.z))).normalized() * 0.004 + Vector((0, 0, 0.004)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if all(v.co.z < 0.008 for v in f.verts):
            f.material_index = 1
    return bm


def scarf(cage, J):
    """A neckerchief wound once round the neck, sagging at the front: a tube round the neck's ring."""
    lay = cage.verts.layers.int.get('part')
    neck = [v.co for v in cage.verts if v[lay] == PART['neck'] or (v[lay] == PART['torso'] and v.co.z > 1.44)]
    z0 = 1.476
    band = [p for p in neck if abs(p.z - z0) < 0.03]
    cy = (max(p.y for p in band) + min(p.y for p in band)) / 2
    rx = max(abs(p.x) for p in band)
    rf, rb = cy - min(p.y for p in band), max(p.y for p in band) - cy
    bm = bmesh.new()
    n_around, n_sec = 24, 8
    rings = []
    for k in range(n_around):
        th = 2 * math.pi * k / n_around
        s, c = math.sin(th), math.cos(th)
        front = max(0.0, c)
        R = Vector((s * (rx + 0.020), cy - c * ((rf if c > 0 else rb) + 0.020), z0 - 0.045 * front ** 4))
        out = Vector((s, -c, 0)).normalized()
        ring = []
        h, t = 0.032 + 0.016 * front ** 4, 0.011 + 0.006 * front ** 2
        for j in range(n_sec):
            a = 2 * math.pi * j / n_sec
            ring.append(bm.verts.new(R + out * (math.cos(a) * t) + Vector((0, 0, math.sin(a) * h))))
        rings.append(ring)
    for k in range(n_around):
        a, b = rings[k], rings[(k + 1) % n_around]
        for j in range(n_sec):
            j1 = (j + 1) % n_sec
            bm.faces.new((a[j], a[j1], b[j1], b[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


BUILDERS = {'Tee': tee, 'Trousers': trousers, 'Boots': boots, 'Shirt': shirt, 'Scarf': scarf}


def build_all(cage, J, coll, material, mesh_object, subdivide):
    out = {}
    for name, fn in BUILDERS.items():
        spec = SPEC[name]
        bm = fn(cage, J)
        ob = mesh_object(name, bm, coll, spec['materials'])
        subdivide(ob)
        if spec['thickness']:
            sol = ob.modifiers.new('Thickness', 'SOLIDIFY')
            sol.thickness = spec['thickness']
            sol.offset = -1.0
            sol.use_rim = True
            sol.use_even_offset = True
            sol.material_offset = 1 if len(spec['materials']) > 1 and name == 'Shirt' else 0
            with bpy.context.temp_override(object=ob, active_object=ob):
                bpy.ops.object.modifier_apply(modifier=sol.name)
        ob['kind'] = 'garment'
        ob['layer'] = spec['layer']
        out[name] = ob
    return out


# ------------------------------------------------------------------ the body's areas

def area_of(p, part, J):
    side = '.L' if p.x > 0 else '.R'
    name = B.PARTS[part]
    if name == 'torso':
        return 'chest' if p.z > 1.27 else ('belly' if p.z > 1.04 else 'hips')
    if name == 'neck':
        return 'neck'
    if name == 'arm':
        t = arm_t(p, J)
        return ('upperarm' if t < 0.5 else 'forearm_upper' if t < 0.76 else 'forearm_lower') + side
    if name in ('hand', 'finger', 'thumb'):
        return 'hand' + side
    if name == 'leg':
        z = p.z
        return ('thigh' if z >= 0.65 else 'knee' if z >= 0.40 else 'shin' if z >= 0.26 else
                'shin_lower' if z >= 0.15 else 'ankle') + side
    return 'foot' + side


def body_areas(body, J):
    """Each body vertex's area (by the cage's part nearest it): written to the '_AREA' attribute (its index in
    `names`, exported) and as vertex groups 'area_<name>' for authoring."""
    cage = bpy.data.objects['Body_cage']
    pa = cage.data.attributes['part'].data
    kd = KDTree(len(cage.data.vertices))
    for v in cage.data.vertices:
        kd.insert(v.co, v.index)
    kd.balance()
    per = []
    for v in body.data.vertices:
        co, i, _ = kd.find(v.co)
        per.append(area_of(v.co, pa[i].value, J))
    names = sorted(set(per))
    attr = body.data.attributes.new('_AREA', 'FLOAT', 'POINT')
    for i, a in enumerate(per):
        attr.data[i].value = names.index(a)
    for a in names:
        g = body.vertex_groups.new(name='area_' + a)
        g.add([i for i, x in enumerate(per) if x == a], 1.0, 'REPLACE')
    return {'names': names, 'per': per}


def hidden_areas(body, garment, areas, share=0.97):
    """The areas a garment covers all but (1 - share) of: a ray out along each body vertex's normal meets
    the garment within 10 cm. Also a vertex group 'covered_<garment>' on the body."""
    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(garment, dg)
    body.data.update()
    hit = []
    for v in body.data.vertices:
        h = bvh.ray_cast(v.co - v.normal * 0.002, v.normal, 0.10)
        hit.append(h[0] is not None)
    g = body.vertex_groups.new(name='covered_' + garment.name)
    g.add([i for i, x in enumerate(hit) if x], 1.0, 'REPLACE')
    return covered_areas(areas, hit, share), hit


def covered_areas(areas, hit, share=0.97):
    out = []
    for a in areas['names']:
        idx = [i for i, x in enumerate(areas['per']) if x == a]
        if idx and sum(hit[i] for i in idx) / len(idx) >= share:
            out.append(a)
    return out


def unwrap(ob):
    """UVs per part: seams where the faces' main direction changes (six directions, as a box projection
    would cut them, smoothed so islands are not ragged), then each island unwrapped conformally and packed."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    axes = [Vector(a) for a in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]
    bm.faces.ensure_lookup_table()
    cl = [max(range(6), key=lambda k: f.normal.dot(axes[k])) for f in bm.faces]
    for _ in range(3):   # majority of neighbours: no one-face islands
        new = []
        for f in bm.faces:
            votes = {}
            for e in f.edges:
                for g in e.link_faces:
                    votes[cl[g.index]] = votes.get(cl[g.index], 0) + 1
            new.append(max(votes, key=votes.get) if votes else cl[f.index])
        cl = new
    for e in bm.edges:
        e.seam = len(e.link_faces) == 2 and cl[e.link_faces[0].index] != cl[e.link_faces[1].index]
    bm.to_mesh(ob.data)
    bm.free()
    if not ob.data.uv_layers:
        ob.data.uv_layers.new(name='UVMap')
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    print('unwrap', ob.name, len(ob.data.polygons), len(ob.data.vertices))
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.unwrap(method='CONFORMAL', margin=0.01)
    bpy.ops.object.mode_set(mode='OBJECT')

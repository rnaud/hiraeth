"""Phase 2 of issue #493: the game's own portrait head (public/characters/traveller-v1/head-v3), placed and
skinned as traveller-b3.js places it (B3_HEAD_FIT), with the six face keys portrait-head.js makes at load
(the same formulas, baked as shape keys), its hair (its hair mask's faces) apart, and the scalp under it."""
import math
import bmesh
import bpy
from mathutils import Vector
from loft import smoothstep
from head import portrait_world, FIT

# portrait-head.js PORTRAIT_HEAD and B3_HEAD_FIT (source units: x across, y up from the neck, z forward)
EYES = [(-0.118, 0.522), (0.125, 0.522)]
BROW_Y, MOUTH_Y = 0.588, 0.293
NECK = (1.450, 1.523)
SCALP_RATIO = 0.12   # the scalp under the hair, decimated to this share
KEYS = ['blink', 'smile', 'brow', 'browTilt', 'asymmetry', 'open']


def patch(x, y, w, h):
    return 1 - smoothstep(0.55, 1, math.hypot(x / w, y / h))


def key_deltas(x, y, z, hair):
    """portrait-head.js makePortraitHead: each key's delta at a source point (three.js axes, source units)."""
    front = smoothstep(0.10, 0.18, z) * (1 - hair)
    eye = EYES[0 if x < 0 else 1]
    ex, ey = x - eye[0], y - eye[1]
    lid = (1 - smoothstep(0.053, 0.083, abs(ex))) * (1 - smoothstep(0.026, 0.054, abs(ey))) * front
    brow = patch(ex, y - BROW_Y, 0.095, 0.049) * front
    mouth = patch(x, y - MOUTH_Y, 0.18, 0.095) * front
    corner = smoothstep(0.025, 0.10, abs(x)) * mouth
    lower = smoothstep(0.13, 0.20, y) * (1 - smoothstep(0.285, 0.306, y)) * patch(x, y - 0.235, 0.21, 0.17) * front
    sx = math.copysign(1, x) if x else 0.0
    return [
        (0, -ey * 0.995 * lid, 0),
        (sx * 0.009 * corner, 0.016 * corner, 0),
        (0, 0.018 * brow, 0),
        (0, (0.12 - abs(x)) * 0.25 * brow, 0),
        (0, sx * (0.007 * brow + 0.004 * corner), 0),
        (0, -0.040 * lower, -0.004 * lower),
    ]


def load(path, coll):
    """head-v3 in the B3 body's frame: the object, and each vertex's source point and hair mask."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    ob = max((o for o in new if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
    for o in new:
        if o is not ob:
            bpy.data.objects.remove(o, do_unlink=True)
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll.objects.link(ob)
    ob.name = 'Head'
    me = ob.data
    M = ob.matrix_world.copy()
    hair = [0.0] * len(me.vertices)
    for a in me.attributes:
        if 'portrait_hair' in a.name.lower():
            hair = [d.value for d in a.data]
    src = []
    for v in me.vertices:
        p = M @ v.co
        s = (p.x, p.z, -p.y)
        src.append(s)
        v.co = portrait_world(*s)
    ob.matrix_world.identity()
    a = me.attributes.new('hairmask', 'FLOAT', 'POINT')
    for i, h in enumerate(hair):
        a.data[i].value = h
    return ob, src, hair


def skin(ob, src):
    """portrait-head.js: the skull on Head, the low neck easing onto neck_01 (B3's neck band, 1.450-1.523 m)."""
    ob.vertex_groups.clear()
    gh, gn = ob.vertex_groups.new(name='Head'), ob.vertex_groups.new(name='neck_01')
    for v, (x, y, z) in zip(ob.data.vertices, src):
        k = max(smoothstep(NECK[0], NECK[1], v.co.z), smoothstep(0.12, 0.15, y) * smoothstep(0.12, 0.19, z))
        if k > 0:
            gh.add([v.index], k, 'REPLACE')
        if k < 1:
            gn.add([v.index], 1 - k, 'REPLACE')


def face_keys(ob):
    """The six keys at each vertex's source point (portrait_world undone: above the collar it is linear) and
    its hair mask (carried through the scalp's decimation as the 'hairmask' attribute)."""
    s, o = FIT['scale'], FIT['offset']
    src = [((v.co.x - o[0]) / s, (v.co.z - o[1]) / s, (-v.co.y - o[2]) / s) for v in ob.data.vertices]
    hair = [d.value for d in ob.data.attributes['hairmask'].data]
    ob.shape_key_add(name='Basis', from_mix=False)
    for k, name in enumerate(KEYS):
        kb = ob.shape_key_add(name=name, from_mix=False)
        kb.value = 0.0
        for i, (x, y, z) in enumerate(src):
            dx, dy, dz = key_deltas(x, y, z, hair[i])[k]
            kb.data[i].co = ob.data.vertices[i].co + Vector((dx * s, -dz * s, dy * s))


def split_hair(ob, hair, coll, tris, scalp_material):
    """The hair (its mask's faces) copied out as its own mesh, decimated; on the head those faces sink 7 mm
    toward the skull's middle and take a dark scalp colour, so the head stays closed under the hair."""
    me = ob.data
    hv = [h > 0.5 for h in hair]
    hair_faces = [p.index for p in me.polygons if sum(hv[i] for i in p.vertices) * 2 > len(p.vertices)]
    # the copy
    hob = ob.copy()
    hob.data = me.copy()
    hob.name = 'Hair'
    hob.data.name = 'Hair'
    if hob.data.shape_keys:
        hob.shape_key_clear()
    coll.objects.link(hob)
    bm = bmesh.new()
    bm.from_mesh(hob.data)
    keep = set(hair_faces)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
    bm.to_mesh(hob.data)
    bm.free()
    n = len(hob.data.polygons)
    dec = hob.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = min(1.0, tris / max(1, n))
    with bpy.context.temp_override(object=hob, active_object=hob):
        bpy.ops.object.modifier_apply(modifier=dec.name)
    hob.vertex_groups.clear()
    for m in hob.data.materials:
        pass
    hob.data.materials[0].use_backface_culling = False
    # the scalp: the head's hair verts sink, smoothed, and go dark
    c = Vector((0.0, sum(v.co.y for v in me.vertices) / len(me.vertices), 0.0))
    top = max(v.co.z for v in me.vertices)
    c.z = top - 0.11
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    sunk = [v for v in bm.verts if hv[v.index]]
    for v in sunk:
        d = (v.co - c)
        if d.length > 1e-4:
            v.co -= d.normalized() * 0.007
    for _ in range(4):
        new = {v: sum((e.other_vert(v).co for e in v.link_edges), Vector()) / max(1, len(v.link_edges)) for v in sunk}
        for v, p in new.items():
            v.co = v.co.lerp(p, 0.5)
    me.materials.append(scalp_material)
    bm.faces.ensure_lookup_table()
    for f in bm.faces:
        if f.index in keep:
            f.material_index = len(me.materials) - 1
    bm.to_mesh(me)
    bm.free()
    # the scalp, hidden under the hair, need not keep the locks' detail: decimated alone
    g = ob.vertex_groups.new(name='scalp')
    g.add([i for i, h in enumerate(hv) if h], 1.0, 'REPLACE')
    n_head = len(me.polygons)
    dec = ob.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = SCALP_RATIO
    dec.vertex_group = 'scalp'
    dec.vertex_group_factor = 1.0
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=dec.name)
    ob.vertex_groups.remove(ob.vertex_groups['scalp'])
    print('hair: %d faces, %d after decimating; head %d -> %d faces' % (n, len(hob.data.polygons), n_head, len(me.polygons)))
    return hob

"""The traveller's skeleton and skins (issue #493): the game's 53 bones by their own names at the B3 fit
(traveller-b3-fit.js, through export-donor.mjs), two eye bones under Head; the body weighted by bone heat and
cleaned, the head by MakeHuman's own weights, the clothes by the body's weights carried across, the kit's
sockets as empties on the game's anchors (docs/systems/traveller-kit.md)."""
import math
import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
from loft import smoothstep

TIP = {'Head': Vector((0, 0, 0.17)), 'Root': Vector((0, 0, 0.12))}
# the main child each bone's tail points at
CHILD = {'pelvis': 'spine_01', 'spine_01': 'spine_02', 'spine_02': 'spine_03', 'spine_03': 'neck_01',
         'neck_01': 'Head', 'thigh': 'calf', 'calf': 'foot', 'foot': 'ball', 'clavicle': 'upperarm',
         'upperarm': 'lowerarm', 'lowerarm': 'hand', 'hand': 'middle_01'}
FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky']


def child_of(name):
    if name in CHILD:
        return CHILD[name]
    base, _, side = name.rpartition('_')
    if side in ('l', 'r'):
        if base in CHILD:
            return f'{CHILD[base]}_{side}'
        f, _, k = base.rpartition('_')
        if f in FINGERS and k in ('01', '02'):
            return f'{f}_0{int(k) + 1}_{side}'
    return None


def armature(d, J, eye_c, coll):
    """eye_c: the eyes' centres for eye_l / eye_r under Head, or None for the game's 53 bones alone."""
    arm_data = bpy.data.armatures.new('TravellerRig')
    arm = bpy.data.objects.new('TravellerRig', arm_data)
    coll.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones
    for x in d['bones']:
        b = eb.new(x['name'])
        b.head = J[x['name']]
    for x in d['bones']:
        b = eb[x['name']]
        if x['parent']:
            b.parent = eb[x['parent']]
        c = child_of(x['name'])
        if c and c in J:
            tail = J[c]
        elif x['name'] in TIP:
            tail = b.head + TIP[x['name']]
        elif x['name'].startswith('ball'):
            tail = b.head + Vector((0, -0.06, 0))
        else:   # the third phalanx: on along its finger
            prev = b.parent.head
            tail = b.head + (b.head - prev).normalized() * 0.022
        if (tail - b.head).length < 0.005:
            tail = b.head + Vector((0, 0, 0.02))
        b.tail = tail
        dirn = (b.tail - b.head).normalized()
        b.align_roll(Vector((0, -1, 0)) if abs(dirn.z) > 0.7 else Vector((0, 0, 1)))
        b.use_connect = False
    for side in ('lr' if eye_c else ''):
        b = eb.new(f'eye_{side}')
        b.head = eye_c[side]
        b.tail = eye_c[side] + Vector((0, -0.025, 0))
        b.parent = eb['Head']
        b.align_roll(Vector((0, 0, 1)))
    bpy.ops.object.mode_set(mode='OBJECT')
    arm_data.bones['Root'].use_deform = False
    arm_data.display_type = 'STICK'
    arm.show_in_front = True
    return arm


def bind(arm, ob):
    ob.parent = arm
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm


def groups_of(ob, v):
    return {ob.vertex_groups[g.group].name: g.weight for g in v.groups if g.weight > 0}


def set_weights(ob, weights, limit=4):
    """weights: per vertex a dict bone -> weight; kept to the `limit` largest, normalised."""
    ob.vertex_groups.clear()
    vg = {}
    for i, w in enumerate(weights):
        top = sorted(w.items(), key=lambda x: -x[1])[:limit]
        s = sum(x[1] for x in top)
        if s <= 0:
            continue
        for name, x in top:
            if name not in vg:
                vg[name] = ob.vertex_groups.new(name=name)
            vg[name].add([i], x / s, 'REPLACE')


def smooth_weights(ob, weights, iters=2, k=0.5, keep=None):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    nbr = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
    bm.free()
    for _ in range(iters):
        out = []
        for i, w in enumerate(weights):
            if keep and keep[i]:
                out.append(w)
                continue
            acc = {}
            for j in nbr[i]:
                for n, x in weights[j].items():
                    acc[n] = acc.get(n, 0) + x / len(nbr[i])
            m = {n: w.get(n, 0) * (1 - k) + acc.get(n, 0) * k for n in set(w) | set(acc)}
            out.append({n: x for n, x in m.items() if x > 1e-4})
        weights = out
    return weights


def weight_body(arm, body, cage):
    """Bone heat on the body (eye bones and Root left out), then each finger's verts kept to their own
    chain and the hand, at most four bones a vertex."""
    for b in arm.data.bones:
        b.use_deform = not (b.name.startswith('eye_') or b.name == 'Root')
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for b in arm.data.bones:
        b.use_deform = b.name != 'Root'
    W = [groups_of(body, v) for v in body.data.vertices]
    bones = arm.data.bones
    # each finger's own chain: the vertex's nearest finger segment decides
    segs = []
    for side in 'lr':
        for f in ['thumb', 'index', 'middle', 'ring', 'pinky']:
            chain = [bones[f'{f}_0{k}_{side}'] for k in (1, 2, 3)]
            pts = [b.head_local for b in chain] + [chain[2].tail_local]
            segs.append((f, side, pts))
    for i, v in enumerate(body.data.vertices):
        p = v.co
        side = 'l' if p.x > 0 else 'r'
        hand = bones[f'hand_{side}']
        if abs(p.x) < abs(hand.head_local.x) + 0.01:
            # nothing past the wrist on the arm: no finger bones
            W[i] = {n: x for n, x in W[i].items() if not any(n.startswith(f + '_0') for f in FINGERS)}
            continue
        best, bd = None, 1e9
        for f, s, pts in segs:
            if s != side:
                continue
            for a, b in zip(pts, pts[1:]):
                t = max(0.0, min(1.0, (p - a).dot(b - a) / (b - a).length_squared))
                dist = (a + (b - a) * t - p).length
                if dist < bd:
                    bd, best = dist, f
        if bd < 0.02:
            own = {n: x for n, x in W[i].items() if n.startswith(best + '_0') or n.startswith('hand_') or n.startswith('lowerarm_')}
            if sum(own.values()) > 1e-3:
                W[i] = own
    W = smooth_weights(body, W, iters=1, k=0.3)
    set_weights(body, W)


def weight_head(arm, head, d, src_index):
    m = d['meshes'][0]
    names = [b['name'] for b in d['bones']]
    J, Wt = m['joints'], m['weights']
    W = []
    for s in src_index:
        w = {}
        for k in range(4):
            x = Wt[s * 4 + k]
            if x > 0:
                n = names[J[s * 4 + k]]
                w[n] = w.get(n, 0) + x
        W.append(w)
    set_weights(head, W)
    bind(arm, head)


def boundary_verts(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    out = sorted({v.index for e in bm.edges if e.is_boundary for v in e.verts})
    bm.free()
    return out


def seam_weights(body, head):
    """The body's neck takes the head's weights at the seam and eases into its own below it."""
    hb = boundary_verts(head)
    kd = KDTree(len(hb))
    for n, i in enumerate(hb):
        kd.insert(head.data.vertices[i].co, n)
    kd.balance()
    seam_z = sum(head.data.vertices[i].co.z for i in hb) / len(hb)
    W = [groups_of(body, v) for v in body.data.vertices]
    for i, v in enumerate(body.data.vertices):
        t = smoothstep(seam_z - 0.045, seam_z, v.co.z)
        if t <= 0:
            continue
        co, n, dist = kd.find(Vector((v.co.x, v.co.y, seam_z)))
        hw = groups_of(head, head.data.vertices[hb[n]])
        W[i] = {k: W[i].get(k, 0) * (1 - t) + hw.get(k, 0) * t for k in set(W[i]) | set(hw)}
    set_weights(body, W)


def rigid(arm, ob, bone):
    ob.vertex_groups.clear()
    ob.vertex_groups.new(name=bone).add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
    bind(arm, ob)


def transfer_weights(arm, body, ob, sample=None, k=8):
    """The body's weights carried to a garment: each garment vertex takes the inverse-distance mix of the
    body's nearest verts (to a sample point: a hem below the hips samples the hips, not the thighs), then
    smoothed over the garment, four bones at most."""
    n = len(body.data.vertices)
    kd = KDTree(n)
    for v in body.data.vertices:
        kd.insert(v.co, v.index)
    kd.balance()
    BW = [groups_of(body, v) for v in body.data.vertices]
    W = []
    for v in ob.data.vertices:
        q = sample(v.co.copy()) if sample else v.co
        acc = {}
        tot = 0
        for co, i, dist in kd.find_n(q, k):
            w = 1.0 / max(dist, 1e-4) ** 2
            tot += w
            for name, x in BW[i].items():
                acc[name] = acc.get(name, 0) + x * w
        W.append({name: x / tot for name, x in acc.items()})
    W = smooth_weights(ob, W, iters=3, k=0.5)
    set_weights(ob, W)
    bind(arm, ob)


# The kit's anchors, in the chest anchor's frame (three.js: x, y up from the chest anchor, z forward), which
# sits on spine_03 at the neck's height less 0.76 (humanoid.js chestAnchor); traveller-kit.md.
SOCKETS = {
    'socket_chest': ('spine_03', (0, 0, 0)),
    'socket_tank': ('spine_03', (0, 0.4, -0.1886)),        # characters/traveller.js tankAt
    'socket_sheath': ('spine_03', (-0.205, 0.72, -0.215)),  # sword-sheath.js SHEATH.at
    'socket_lantern': ('spine_03', (0.225, 0.37, -0.3)),    # boxes/effects.js LANTERN_AT
    'socket_star': ('spine_03', (-0.125, 0.61, 0.18)),      # boxes/effects.js TRAVELLER_STAR.at
}


def sockets(arm, coll):
    bones = arm.data.bones
    chest_z = bones['neck_01'].head_local.z - 0.76
    out = {}

    def empty(name, bone, at):
        e = bpy.data.objects.new(name, None)
        e.empty_display_type = 'ARROWS'
        e.empty_display_size = 0.05
        coll.objects.link(e)
        e.parent = arm
        e.parent_type = 'BONE'
        e.parent_bone = bone
        bpy.context.view_layer.update()
        e.matrix_world = Matrix.Translation(at)
        # the game's frame (three.js): x, y up, z forward
        out[name] = {'bone': bone, 'position': [round(at.x, 4), round(at.z, 4), round(-at.y, 4)]}
    for name, (bone, (x, y, z)) in SOCKETS.items():
        empty(name, bone, Vector((x, -z, chest_z + y)))
    # the hands' grips (the palm's middle, where a held thing's origin goes), the head's (hats)
    for side in 'lr':
        h, m = bones[f'hand_{side}'].head_local, bones[f'middle_01_{side}'].head_local
        empty(f'socket_grip_{side}', f'hand_{side}', h.lerp(m, 0.6) + Vector((0, -0.022, 0)))
    h = bones['Head'].head_local
    empty('socket_head', 'Head', Vector((0, h.y - 0.01, h.z + 0.115)))   # the skull's middle (hats)
    return out


def bone_map(arm):
    """Every bone, its parent and its rest head (the game's frame); the game's names are kept as they are."""
    out = {}
    for b in arm.data.bones:
        h = b.head_local
        out[b.name] = {'game': b.name if not b.name.startswith('eye_') else None,
                       'parent': b.parent.name if b.parent else None,
                       'head': [round(h.x, 4), round(h.z, 4), round(-h.y, 4)], 'deform': b.use_deform}
    return out

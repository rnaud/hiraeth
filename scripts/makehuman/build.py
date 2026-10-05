"""
The MakeHuman bodies (docs/makehuman.md), stage 1: ONE parametric body for everyone, built headless
by MPFB (the MakeHuman add-on for Blender) and packed for the game (public/anim/mh/body.json + .bin).

  .local-tools/makehuman/blender.sh --python scripts/makehuman/build.py -- --reference
  .local-tools/makehuman/blender.sh --python scripts/makehuman/build.py -- --samples 0/4   (and 1/4, 2/4, 3/4: in parallel)
  .local-tools/makehuman/blender.sh --python scripts/makehuman/build.py -- --pack
  (scripts/makehuman/build.sh runs the three steps)

Needs MPFB 2.0.17 in that Blender and the CC0 packs in MPFB's user data (MakeHuman's system assets:
eyes, eyebrows, the ten CC0 hairstyles; faceunits01, visemes01): scripts/makehuman/fetch.sh.

1. --reference: the default person (every macro at 0.5) with the 'game_engine' rig (the game's bone
   names), the low-poly eyes and two eyebrows, T-posed (the game's bodies are bound in one) and that
   pose applied as the rest. Then:
   - the body's helper geometry dropped and the body decimated to --tris (the head kept whole), and
     every low vertex written as a point of the full mesh (a triangle and its weights), so any other
     shape of the same full mesh maps onto the same low mesh;
   - its frame: scaled so the hips stand where the Quaternius man's do, moved so the skull is where
     his is front to back (the face ink's rounded light is centred there); the game's axes;
   - the ARKit face units and visemes as shape keys (the ones the game uses), onto the brows too;
   - the hairstyles (hair.py): MakeHuman's own CC0 hair fitted by MPFB, its alpha cards turned into
     closed shells, a few big locks each with grooves between them (the ink draws those as the
     strand lines), and a beard round the jaw from the skin; each shell vertex bound to the low body
     (a triangle, its weights, an offset) so the game fits it to every head on load.
2. --samples: the corners of MakeHuman's own macro space (gender x age x muscle x weight: its macro
   targets are blended multilinearly between exactly these), height and proportions at each gender
   and age, and the reference with a few targets of its own (a belly, wider hips, the face targets
   that make the Moebius face and bigger eyes): each built the same way, mapped onto the low mesh.
3. --pack: the shapes compressed (principal components of the corners; the targets as sparse deltas),
   the topology, the skin weights, the bones, the face keys and the hair: body.json and body.bin.
   src/makehuman/body.js makes a body of any age, sex and build from them on load.
"""
import bpy, bmesh, json, os, sys, math, time
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.faceservice import FaceService
from bl_ext.user_default.mpfb.services.locationservice import LocationService

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = os.path.abspath(arg('--out', os.path.join(REPO, 'public', 'anim', 'mh')))
WORK = os.path.abspath(arg('--work', os.path.join(REPO, '.local-tools', 'makehuman', 'work')))
TRIS = int(arg('--tris', '12000'))
EYES = 'low-poly'
BROWS = ['eyebrow002', 'eyebrow004']   # a fine one (women, children), a man's
DATA = LocationService.get_user_data('')

HIP_Y = 0.9712          # the Quaternius man's thigh joints (scripts/makehuman/measure-quaternius.mjs)
SKULL_Z = -0.0074       # and his skull's centre, front to back (humanoid.js: the head bone's z + 0.01)
FACE_PITCH = 0.08       # the Quaternius faces' lean (chin to forehead against the vertical)

# the face's shape keys the game uses (src/makehuman/face-keys.js KEY_GAIN, and the blink), each a
# sum of MPFB's face units / visemes (the left and right halves together)
KEYS = {
    'smile': ['mouthSmileLeft', 'mouthSmileRight'],
    'frown': ['mouthFrownLeft', 'mouthFrownRight'],
    'jawOpen': ['jawOpen'],
    'browInnerUp': ['browInnerUp'],
    'browDown': ['browDownLeft', 'browDownRight'],
    'browOuterUp': ['browOuterUpLeft', 'browOuterUpRight'],
    'blink': ['eyeBlinkLeft', 'eyeBlinkRight'],
    'squint': ['eyeSquintLeft', 'eyeSquintRight'],
    'cheekSquint': ['cheekSquintLeft', 'cheekSquintRight'],
    'eyeWide': ['eyeWideLeft', 'eyeWideRight'],
    'v_aa': ['aa_02'],
}

# ------------------------------------------------------------------ the samples
AGES = [0.0, 0.1875, 0.5, 1.0]          # MakeHuman's age corners: 1, 11, 25 and 90 years
LEVELS = [0.0, 0.5, 1.0]                # muscle and weight: min, average, max
def both(t):
    return {f'l-{t}': 1.0, f'r-{t}': 1.0}
# targets on the reference person, each a delta of its own: the body's (a belly, hips, a waist) and
# the face's (combined in src/makehuman/shape.js: the Moebius face, bigger eyes, rounder cheeks)
TARGETS = {
    'belly': {'stomach-pregnant-incr': 1.0},
    'hips': {'measure-hips-circ-incr': 1.0},
    'waist': {'measure-waist-circ-incr': 1.0},
    'eyes': both('eye-scale-incr'),
    'chinLong': {'chin-height-incr': 1.0},
    'chinNarrow': {'chin-width-decr': 1.0},
    'chinStrong': {'chin-prominent-incr': 1.0},
    'jawNarrow': {'chin-bones-decr': 1.0},
    'cheekLean': both('cheek-volume-decr'),
    'cheekHollow': both('cheek-inner-decr'),
    'cheekBones': both('cheek-bones-incr'),
    'cheekFull': both('cheek-volume-incr'),
    'noseLong': {'nose-scale-vert-incr': 1.0},
    'noseStraight': {'nose-hump-decr': 1.0, 'nose-greek-decr': 1.0},
    'noseNarrow': {'nose-scale-horiz-decr': 1.0},
    'faceOval': {'head-oval': 1.0},
    'faceRound': {'head-round': 1.0},
    'browForward': {'eyebrows-trans-forward': 1.0},
    'mouthNarrow': {'mouth-scale-horiz-decr': 1.0},
}
FACE_TARGETS = [k for k in TARGETS if k not in ('belly', 'hips', 'waist')]

def sample_list():
    out = []
    for g in (0.0, 1.0):
        for a in AGES:
            for m in LEVELS:
                for w in LEVELS:
                    out.append({'id': f'u-{g:g}-{a:g}-{m:g}-{w:g}', 'kind': 'universal', 'macro': {'gender': g, 'age': a, 'muscle': m, 'weight': w}})
    for g in (0.0, 1.0):
        for a in AGES:
            for h in (0.0, 1.0):
                out.append({'id': f'h-{g:g}-{a:g}-{h:g}', 'kind': 'height', 'macro': {'gender': g, 'age': a, 'height': h}})
            if a > 0:   # (MakeHuman has no baby proportions)
                for p in (0.0, 1.0):
                    out.append({'id': f'p-{g:g}-{a:g}-{p:g}', 'kind': 'proportions', 'macro': {'gender': g, 'age': a, 'proportions': p}})
    for name, t in TARGETS.items():
        out.append({'id': f't-{name}', 'kind': 'target', 'name': name, 'macro': {}, 'targets': t})
    return out

# ------------------------------------------------------------------ helpers
def log(*a):
    print('[mh]', *a, flush=True)

def to_game(co):
    """(n, 3) Blender (z up, the face toward -y) -> the game's frame (y up, the face toward +z)."""
    co = np.asarray(co, dtype=np.float64)
    return np.stack([co[..., 0], co[..., 2], -co[..., 1]], axis=-1)

def activate(obj):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

def apply_modifier(obj, name):
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=name)

def coords(obj):
    n = len(obj.data.vertices)
    a = np.empty(n * 3); obj.data.vertices.foreach_get('co', a)
    return (np.array(obj.matrix_world)[:3, :3] @ a.reshape(-1, 3).T).T + np.array(obj.matrix_world)[:3, 3]

def key_arrays(obj):
    keys = obj.data.shape_keys
    if not keys:
        return {}
    n = len(obj.data.vertices)
    out = {}
    for kb in keys.key_blocks:
        a = np.empty(n * 3); kb.data.foreach_get('co', a)
        out[kb.name] = a.reshape(-1, 3)
    return out

def merged_deltas(obj):
    A = key_arrays(obj)
    if not A:
        return {}
    basis = A['Basis']
    return {name: sum((A[p] - basis for p in parts if p in A), np.zeros_like(basis)) for name, parts in KEYS.items()}

def group_weights(obj, group):
    g = obj.vertex_groups.get(group)
    w = np.zeros(len(obj.data.vertices))
    if g is None:
        return w
    gi = g.index
    for v in obj.data.vertices:
        for e in v.groups:
            if e.group == gi:
                w[v.index] = e.weight
    return w

def triangles(obj):
    obj.data.calc_loop_triangles()
    return np.array([tuple(t.vertices) for t in obj.data.loop_triangles], dtype=np.int64)

def delete_verts(obj, keep_mask):
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep_mask[v.index]], context='VERTS')
    bm.to_mesh(obj.data); bm.free(); obj.data.update()

# ------------------------------------------------------------------ the pose
def aim_bone(rig, name, frm, to, target_dir):
    bpy.context.view_layer.update()
    pb = rig.pose.bones[name]
    cur = (rig.pose.bones[to].head - rig.pose.bones[frm].head).normalized()
    q = cur.rotation_difference(target_dir.normalized())
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()

def t_pose(rig):
    """MPFB's T-pose for the game engine rig, then each arm made straight and level (the game's rest)."""
    pose = json.load(open(os.path.join(LocationService.get_mpfb_data('poses'), 'game_engine_fk', 't-pose.json')))
    for name, value in pose['bone_rotations'].items():
        pb = rig.pose.bones.get(name)
        if not pb:
            continue
        if len(value) == 4:
            pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = value
        else:
            pb.rotation_mode = 'XYZ'; pb.rotation_euler = value
    bpy.context.view_layer.update()
    for s, sx in (('l', 1), ('r', -1)):
        d = rig.pose.bones[f'hand_{s}'].head - rig.pose.bones[f'upperarm_{s}'].head
        level = Vector((sx * math.hypot(d.x, 0), d.y * 0.25, 0.0))
        aim_bone(rig, f'upperarm_{s}', f'upperarm_{s}', f'lowerarm_{s}', level)
        aim_bone(rig, f'lowerarm_{s}', f'lowerarm_{s}', f'hand_{s}', level)
        aim_bone(rig, f'hand_{s}', f'hand_{s}', f'middle_01_{s}', level)

def evaluated_game_coords(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    co = to_game(np.array([ev.matrix_world @ v.co for v in me.vertices]))
    ev.to_mesh_clear()
    return co

def face_pitch(body, eyes, keep):
    co = evaluated_game_coords(body)[keep]
    E = evaluated_game_coords(eyes)
    eyeY = float(E[:, 1].mean())
    mid = co[(np.abs(co[:, 0]) < 0.006) & (co[:, 1] > eyeY - 0.2) & (co[:, 1] < eyeY + 0.1)]
    tip = mid[np.argmax(mid[:, 2])]
    front = mid[(mid[:, 1] < tip[1] - 0.025) & (mid[:, 1] > tip[1] - 0.14) & (mid[:, 2] > tip[2] - 0.075)]
    chinY = float(front[:, 1].min())
    F = mid[(mid[:, 1] > eyeY + 0.02) & (mid[:, 1] < eyeY + 0.045)]
    C = mid[(mid[:, 1] > chinY) & (mid[:, 1] < chinY + 0.02)]
    f, c = F[np.argmax(F[:, 2])], C[np.argmax(C[:, 2])]
    return math.atan2(f[2] - c[2], f[1] - c[1])

def lift_face(rig, body, eyes, keep, turn=None):
    """The neck and head turned back until the face stands as the Quaternius ones (`turn`: by this much, rad)."""
    def turn_by(a):
        for name, share in (('neck_01', 0.4), ('head', 0.6)):
            pb = rig.pose.bones[name]
            h = pb.head.copy()
            pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(-a * share, 4, 'X') @ Matrix.Translation(-h) @ pb.matrix
            bpy.context.view_layer.update()
    if turn is not None:
        turn_by(turn)
        return turn
    try:
        before = face_pitch(body, eyes, keep)
    except ValueError:   # (a face too small for the measuring line: a baby's)
        return 0.0
    turn = max(-0.2, min(0.2, before - FACE_PITCH))
    turn_by(turn)
    try:
        after = face_pitch(body, eyes, keep)
    except ValueError:
        after = 1e9
    if abs(after - FACE_PITCH) > abs(before - FACE_PITCH):   # (a face the line doesn't measure well)
        turn_by(-turn)
        turn = 0.0
    return turn

def apply_rest(rig, meshes):
    for m in meshes:
        for mod in list(m.modifiers):
            if mod.type == 'ARMATURE':
                apply_modifier(m, mod.name)
    activate(rig)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    for m in meshes:
        mod = m.modifiers.new('Armature', 'ARMATURE')
        mod.object = rig

def cut_brows(brows, mhclo_dir):
    """The eyebrow card cut to its drawn shape (the texture's alpha; the card twice subdivided): the game paints flat colour."""
    png = [f for f in os.listdir(mhclo_dir) if f.endswith('.png') and 'normal' not in f.lower()]
    img = bpy.data.images.load(os.path.join(mhclo_dir, png[0]))
    W, H = img.size
    px = np.array(img.pixels[:]).reshape(H, W, 4)
    alpha = px[..., 3] if px[..., 3].min() < 0.99 else px[..., :3].mean(axis=2)
    bm = bmesh.new(); bm.from_mesh(brows.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    uv = bm.loops.layers.uv.active
    gone = []
    for f in bm.faces:
        u = sum(l[uv].uv.x for l in f.loops) / len(f.loops)
        v = sum(l[uv].uv.y for l in f.loops) / len(f.loops)
        if alpha[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W)))] < 0.3:
            gone.append(f)
    bmesh.ops.delete(bm, geom=gone, context='FACES_ONLY')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(brows.data); bm.free(); brows.data.update()

def cut_all(brows):
    for st, o in brows.items():
        cut_brows(o, os.path.join(DATA, 'eyebrows', st))

# ------------------------------------------------------------------ one person
def make_person(macro, targets=None, turn=None, cut=True):
    """A person in the game's rest pose: { body, keep (its own vertices, not the helpers), rig, eyes, brows: {style: obj}, turn }."""
    bpy.ops.wm.read_homefile(use_empty=True)
    m = TargetService.get_default_macro_info_dict()
    m.update(macro)
    body = HumanService.create_human(macro_detail_dict=m)
    for name, w in (targets or {}).items():
        path = TargetService.target_full_path(name)
        if not path:
            raise ValueError(f'no target {name}')
        TargetService.load_target(body, path, weight=w, name=name)
    rig = HumanService.add_builtin_rig(body, 'game_engine', import_weights=True)
    eyes = HumanService.add_mhclo_asset(os.path.join(DATA, 'eyes', EYES, f'{EYES}.mhclo'), body, asset_type='Eyes', subdiv_levels=0, material_type='NONE')
    brows = {}
    for st in BROWS:
        brows[st] = HumanService.add_mhclo_asset(os.path.join(DATA, 'eyebrows', st, f'{st}.mhclo'), body, asset_type='Eyebrows', subdiv_levels=0, material_type='NONE')
    TargetService.bake_targets(body)
    for mod in list(body.modifiers):
        if mod.type == 'MASK':
            body.modifiers.remove(mod)
    keep = group_weights(body, 'body') > 0.5
    t_pose(rig)
    turn = lift_face(rig, body, eyes, keep, turn)
    apply_rest(rig, [body, eyes, *brows.values()])
    if cut:
        cut_all(brows)
    return {'body': body, 'keep': keep, 'rig': rig, 'eyes': eyes, 'brows': brows, 'turn': turn}

def bone_heads(rig):
    return {b.name: np.array(rig.matrix_world @ b.head_local) for b in rig.data.bones}

def frame_of(heads, low_game, headw):
    """The person's frame: s (the hips at HIP_Y) and dz (the skull's centre at SKULL_Z), from Blender bone heads and the low body (game axes, unscaled)."""
    s = HIP_Y / heads['thigh_l'][2]
    H = low_game[headw > 0.5] * s
    eyeY = H[:, 1].max() - 0.115
    up = H[H[:, 1] > eyeY + 0.01]
    zc = (up[:, 2].max() + up[:, 2].min()) / 2
    return s, SKULL_Z - zc

def to_frame(co_blender, s, dz):
    g = to_game(co_blender) * s
    g[..., 2] += dz
    return g

def collect(P, ref):
    """The person's shapes on the reference's low mesh, in the game's frame: { body, eyes, brows: [...], bones, s, dz }."""
    full = coords(P['body'])[P['keep']]
    A, Wt = ref['map_tri'], ref['map_w']
    low = (full[A] * Wt[..., None]).sum(1)
    heads = bone_heads(P['rig'])
    s, dz = frame_of(heads, to_game(low), ref['headw'])
    return {
        'body': to_frame(low, s, dz),
        'eyes': to_frame(coords(P['eyes']), s, dz),
        'brows': [to_frame(coords(P['brows'][st]), s, dz) for st in BROWS],
        'bones': np.array([to_frame(heads[n], s, dz) for n in ref['bone_names']]),
        's': s, 'dz': dz, 'turn': P['turn'], 'full': full,
    }

# ------------------------------------------------------------------ the reference
def decimate(full_obj, target_tris):
    """The body decimated (Blender's Decimate, symmetric, the head weighted out of it). Returns the low object."""
    low = full_obj.copy(); low.data = full_obj.data.copy()
    bpy.context.collection.objects.link(low)
    activate(low)
    head = group_weights(low, 'head'); neck = group_weights(low, 'neck_01')
    # the hands kept finer too (the fingers pose: src/hands.js), not whole
    hand = sum(group_weights(low, g.name) for g in low.vertex_groups if g.name.startswith(('hand_', 'thumb_', 'index_', 'middle_', 'ring_', 'pinky_')))
    keep = low.vertex_groups.new(name='decimate-keep')
    for i in range(len(low.data.vertices)):
        w = 0.0 if head[i] > 0.2 else 1.0 - min(1.0, neck[i] * 1.5)
        keep.add([i], min(w, 1.0 - 0.75 * min(1.0, hand[i] * 2)), 'REPLACE')
    mod = low.modifiers.new('Decimate', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = min(1.0, target_tris / len(triangles(low)))
    mod.use_collapse_triangulate = True
    mod.use_symmetry = True; mod.symmetry_axis = 'X'
    mod.vertex_group = keep.name; mod.vertex_group_factor = 8.0
    while low.modifiers[0] != mod:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    apply_modifier(low, mod.name)
    low.vertex_groups.remove(low.vertex_groups['decimate-keep'])
    return low

def point_map(points, mesh_co, tris):
    """Each point as a point of the mesh: (n, 3) vertex indices and (n, 3) barycentric weights of its nearest point."""
    bvh = BVHTree.FromPolygons([Vector(p) for p in mesh_co], [tuple(t) for t in tris])
    idx = np.zeros((len(points), 3), dtype=np.int64); w = np.zeros((len(points), 3))
    for i, p in enumerate(points):
        loc, nrm, fi, dist = bvh.find_nearest(Vector(p))
        a, b, c = tris[fi]
        A, B, C = Vector(mesh_co[a]), Vector(mesh_co[b]), Vector(mesh_co[c])
        v0, v1, v2 = B - A, C - A, loc - A
        d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
        den = d00 * d11 - d01 * d01 or 1e-12
        wb = (d11 * d20 - d01 * d21) / den; wc = (d00 * d21 - d01 * d20) / den
        idx[i] = (a, b, c); w[i] = (1 - wb - wc, wb, wc)
    return idx, w

def skin(obj, bone_names):
    """The 4 strongest bone weights of each vertex (normalised): (n, 4) bone indices, (n, 4) weights."""
    gi = {g.index: g.name for g in obj.vertex_groups}
    bi = {n: i for i, n in enumerate(bone_names)}
    J = np.zeros((len(obj.data.vertices), 4), dtype=np.int64); W = np.zeros((len(obj.data.vertices), 4))
    for v in obj.data.vertices:
        e = sorted(((g.weight, bi[gi[g.group]]) for g in v.groups if gi.get(g.group) in bi and g.weight > 0), reverse=True)[:4]
        tot = sum(w for w, _ in e) or 1
        for k, (w, j) in enumerate(e):
            J[v.index, k] = j; W[v.index, k] = w / tot
        if not e:
            J[v.index, 0] = bi['Head' if 'Head' in bi else 'head']; W[v.index, 0] = 1
    return J, W

def reference():
    import hair
    t0 = time.time()
    os.makedirs(WORK, exist_ok=True)
    P = make_person({}, cut=False)
    body, rig, keep = P['body'], P['rig'], P['keep']
    bone_names = [b.name for b in rig.data.bones]
    # the full body without its helpers, then decimated; each low vertex a point of the full mesh
    full_obj = body.copy(); full_obj.data = body.data.copy(); bpy.context.collection.objects.link(full_obj)
    for m in list(full_obj.modifiers):
        if m.type != 'ARMATURE':
            full_obj.modifiers.remove(m)
    delete_verts(full_obj, keep)
    full = coords(full_obj)
    assert np.allclose(full, coords(body)[keep]), 'the helpers dropped in order'
    full_tris = triangles(full_obj)
    low = decimate(full_obj, TRIS)
    low_co = coords(low)
    low_tris = triangles(low)
    map_tri, map_w = point_map(low_co, full, full_tris)
    exact = int((map_w.max(1) > 1 - 1e-6).sum())
    log(f'body {len(full_tris)} -> {len(low_tris)} triangles, {len(low_co)} vertices ({exact} unmoved)')
    J, W = skin(low, bone_names)
    head_i = bone_names.index('head')
    headw = (W * (J == head_i)).sum(1)
    ref = {'map_tri': map_tri, 'map_w': map_w, 'headw': headw, 'bone_names': bone_names}
    # the face: MPFB's face units and visemes as shape keys, carried onto the brows (MHCLO
    # interpolation, on the brows as fitted), then the brows cut to their drawn shape (the keys with them)
    FaceService.load_targets(body, load_microsoft_visemes=True, load_meta_visemes=False, load_arkit_faceunits=True)
    FaceService.interpolate_targets(body)
    cut_all(P['brows'])
    S = collect(P, ref)
    s, dz = S['s'], S['dz']
    kd = merged_deltas(body)
    keys = {k: (to_game(d[keep][map_tri]) * map_w[..., None]).sum(1) * s for k, d in kd.items()}
    brow_keys = []
    for st in BROWS:
        bd = merged_deltas(P['brows'][st])
        brow_keys.append({k: to_game(d) * s for k, d in bd.items()} if bd else {})
    eye_kd = merged_deltas(P['eyes'])
    eye_keys = {k: to_game(d) * s for k, d in eye_kd.items()} if eye_kd else {}
    # the bones' rest rotations, as Blender's glTF exporter writes them (GLTFLoader's frames): from a scratch export
    glb = os.path.join(WORK, 'ref-bones.glb')
    activate(rig); low.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_texcoords=False,
                              export_normals=False, export_materials='NONE', export_skins=True, export_def_bones=False,
                              export_morph=False, export_animations=False, export_apply=False, export_extras=False)
    bones = glb_bones(glb)
    # the hair: MakeHuman's CC0 styles fitted to this body, as shells bound to the low body; the beard from the skin
    face = landmarks(S['body'], headw, S['eyes'])
    styles, hair_arrays = hair.build_all(body, P, s, dz, S['body'], low_tris, headw, to_frame, log, J, W, bone_names, face)
    np.savez_compressed(os.path.join(WORK, 'hair.npz'), **hair_arrays)
    np.savez_compressed(os.path.join(WORK, 'ref.npz'), map_tri=map_tri, map_w=map_w, headw=headw, low_tris=low_tris, J=J, W=W,
                        body=S['body'], eyes=S['eyes'], bones=S['bones'], **{f'brows{i}': b for i, b in enumerate(S['brows'])},
                        eye_tris=triangles(P['eyes']), **{f'brow_tris{i}': triangles(P['brows'][st]) for i, st in enumerate(BROWS)},
                        **{f'key_{k}': v for k, v in keys.items()},
                        **{f'bkey{i}_{k}': v for i, bk in enumerate(brow_keys) for k, v in bk.items()},
                        **{f'ekey_{k}': v for k, v in eye_keys.items()})
    json.dump({'bone_names': bone_names, 'bones': bones, 'turn': P['turn'], 's': s, 'dz': dz, 'styles': styles,
               'brows': BROWS, 'keys': list(KEYS)}, open(os.path.join(WORK, 'ref.json'), 'w'), indent=1)
    log(f'reference: {time.time() - t0:.1f} s')

def landmarks(co, headw, eyes):
    """The face's landmarks (game frame): eyeY, eyeX, noseY, noseZ, chinY, earZ (as src/makehuman/shape.js measures them)."""
    El = eyes[eyes[:, 0] > 0]
    c = (El.min(0) + El.max(0)) / 2
    eyeY, eyeX = float(c[1]), float(c[0])
    H = co[headw > 0.5]
    mid = H[np.abs(H[:, 0]) < 0.004]
    tip = mid[np.argmax(mid[:, 2])]
    noseY, noseZ = float(tip[1]), float(tip[2])
    front = mid[(mid[:, 1] < noseY - 0.025) & (mid[:, 1] > noseY - 0.14) & (mid[:, 2] > noseZ - 0.075)]
    chinY = float(front[:, 1].min())
    half = float(np.abs(H[:, 0]).max())
    side = H[(np.abs(H[:, 0]) > half - 0.012) & (H[:, 1] < eyeY + 0.01) & (H[:, 1] > eyeY - 0.05)]
    earZ = float(side[:, 2].mean()) if len(side) else -0.02
    return eyeY, eyeX, noseY, noseZ, chinY, earZ

def glb_bones(path):
    """{name: {parent, rotation}} of the joints of a GLB (Blender's export of the rig)."""
    import struct
    b = open(path, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + n])
    nodes = j['nodes']
    parent = {}
    for i, nd in enumerate(nodes):
        for c in nd.get('children', []):
            parent[c] = i
    joints = j['skins'][0]['joints']
    out = {}
    for i in joints:
        nd = nodes[i]
        p = parent.get(i)
        out[nd['name']] = {'parent': nodes[p]['name'] if p is not None and p in joints else None, 'rotation': nd.get('rotation', [0, 0, 0, 1])}
    return out

# ------------------------------------------------------------------ the samples
def samples(part):
    i, n = map(int, part.split('/'))
    R = json.load(open(os.path.join(WORK, 'ref.json')))
    z = np.load(os.path.join(WORK, 'ref.npz'))
    ref = {'map_tri': z['map_tri'], 'map_w': z['map_w'], 'headw': z['headw'], 'bone_names': R['bone_names']}
    todo = [s for k, s in enumerate(sample_list()) if k % n == i]
    out = {}
    for sp in todo:
        t0 = time.time()
        P = make_person(sp['macro'], sp.get('targets'), turn=R['turn'])
        S = collect(P, ref)
        for key in ('body', 'eyes', 'bones'):
            out[f"{sp['id']}|{key}"] = S[key].astype(np.float32)
        for k, b in enumerate(S['brows']):
            out[f"{sp['id']}|brows{k}"] = b.astype(np.float32)
        out[f"{sp['id']}|s"] = np.array([S['s'], S['dz'], S['turn']])
        log(f"{sp['id']}: s {S['s']:.3f}, turn {S['turn']:.3f}, {time.time() - t0:.1f} s")
    np.savez_compressed(os.path.join(WORK, f'samples-{i}-{n}.npz'), **out)

if '--reference' in argv:
    reference()
elif '--samples' in argv:
    samples(arg('--samples'))
elif '--pack' in argv:
    import pack
    pack.main(WORK, OUT, sample_list(), TARGETS, FACE_TARGETS, AGES, LEVELS, HIP_Y, log)

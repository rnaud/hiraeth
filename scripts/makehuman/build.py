"""
The MakeHuman prototype's people (docs/makehuman.md): MPFB (the MakeHuman add-on for Blender)
driven headless, one GLB per person of scripts/makehuman/people.json, in the game's frame.

  blender -b -noaudio --python scripts/makehuman/build.py -- [--only child,teen] [--tris 12000] [--out public/anim/mh]

Needs MPFB 2.0.17 installed in that Blender, and the CC0 asset packs it reads (MakeHuman's system
assets: eyes and eyebrows; faceunits01 and visemes01: the ARKit face units and the visemes) in
MPFB's user data folder: scripts/makehuman/fetch.sh puts all of it under .local-tools/makehuman/.

Each person:
  1. MPFB's base mesh with the person's macro sliders (gender, age, muscle, weight, height,
     proportions), its 'game_engine' rig (the Unreal mannequin's bone names, as the game's
     skeleton) with MPFB's weights, the low-poly eyes and an eyebrow (MHCLO assets fitted to it);
  2. posed into a T-pose (the game's bodies are bound in one: the outfit's regions, the
     costumes' frames) and that pose applied as the rest pose;
  3. the face units (ARKit) and visemes loaded as shape keys, carried onto the brows, the left
     and right halves merged (the game's expressions are symmetric) and a few kept (KEYS);
  4. the helper geometry dropped, the body decimated to about --tris triangles with the head
     kept whole (its shape keys copied vertex for vertex; the rest by the nearest point);
  5. the eyebrow card cut to its drawn shape (the texture's alpha: the game paints flat colour);
  6. scaled so its hips stand where the Quaternius man's do (0.971 m: the game's rig puts the
     pelvis there and every body is ~1.8 m in bind space; the person's real size is the root's
     scale, `scale` in the manifest), 'head' renamed 'Head';
  7. measured for the game (the face ink's landmarks, the outfit's regions, the ears, the skull
     for the hair) and exported (no textures, no UVs, morph targets sparse, no morph normals).
Writes public/anim/mh/<id>.glb and public/anim/mh/people.json (the manifest the studio reads).
"""
import bpy, bmesh, json, os, sys, math, time
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.faceservice import FaceService
from bl_ext.user_default.mpfb.services.locationservice import LocationService
from bl_ext.user_default.mpfb.services.rigservice import RigService

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = os.path.abspath(arg('--out', os.path.join(REPO, 'public', 'anim', 'mh')))
ONLY = set(filter(None, (arg('--only', '') or '').split(',')))
TRIS = int(arg('--tris', '12000'))
KEEP_BLEND = '--blend' in argv
EYES = arg('--eyes', 'low-poly')

HIP_Y = 0.9712          # the Quaternius man's thigh joints (scripts/makehuman/measure-quaternius.mjs)
SKULL_Z = -0.0074       # and his skull's centre, front to back (humanoid.js: the head bone's z + 0.01)

# the shape keys kept, each a sum of MPFB's face units / visemes (the left and right halves together)
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
    'pucker': ['mouthPucker'],
    'press': ['mouthPressLeft', 'mouthPressRight'],
    'stretch': ['mouthStretchLeft', 'mouthStretchRight'],
    'v_aa': ['aa_02'], 'v_E': ['ey_eh_uh_04'], 'v_I': ['y_iy_ih_ix_06'], 'v_O': ['ow_08'], 'v_U': ['w_uw_07'],
    'v_PBM': ['p_b_m_21'], 'v_FV': ['f_v_18'],
}

def log(*a):
    print('[mh]', *a, flush=True)

def to_game(v):
    """Blender (z up, the face toward -y) to the game's frame (y up, the face toward +z)."""
    return (v[0], v[2], -v[1])

def activate(obj):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

def apply_modifier(obj, name):
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=name)

def key_arrays(obj):
    """{name: (n, 3) co} of an object's shape keys (Basis first)."""
    keys = obj.data.shape_keys
    if not keys:
        return {}
    n = len(obj.data.vertices)
    out = {}
    for kb in keys.key_blocks:
        a = np.empty(n * 3, dtype=np.float64)
        kb.data.foreach_get('co', a)
        out[kb.name] = a.reshape(-1, 3)
    return out

def set_keys(obj, basis, deltas, min_delta=2e-5):
    """Replace an object's shape keys by Basis + {name: delta}, dropping those that move nothing."""
    if obj.data.shape_keys:
        activate(obj)
        obj.shape_key_clear()
    kept = [k for k, d in deltas.items() if np.abs(d).max() > min_delta]
    if not kept:
        return []
    obj.shape_key_add(name='Basis', from_mix=False)
    for k in kept:
        kb = obj.shape_key_add(name=k, from_mix=False)
        kb.data.foreach_set('co', (basis + deltas[k]).ravel())
    return kept

def merged_deltas(obj):
    """The kept keys (KEYS) of an object as deltas from its basis."""
    A = key_arrays(obj)
    if not A:
        return None, {}
    basis = A['Basis']
    out = {}
    for name, parts in KEYS.items():
        d = np.zeros_like(basis)
        for p in parts:
            if p in A:
                d += A[p] - basis
        out[name] = d
    return basis, out

def bone_head(rig, name):
    return rig.matrix_world @ rig.pose.bones[name].head

def aim_bone(rig, name, frm, to, target_dir):
    """Turn a pose bone (about its head) so the direction from bone `frm`'s head to bone `to`'s head becomes target_dir."""
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
        # the arm out along x, level (its small lean forward or back kept), the forearm in line with it
        d = rig.pose.bones[f'hand_{s}'].head - rig.pose.bones[f'upperarm_{s}'].head
        level = Vector((sx * math.hypot(d.x, 0), d.y * 0.25, 0.0))
        aim_bone(rig, f'upperarm_{s}', f'upperarm_{s}', f'lowerarm_{s}', level)
        aim_bone(rig, f'lowerarm_{s}', f'lowerarm_{s}', f'hand_{s}', level)
        # the hand in line with the forearm, palm down
        aim_bone(rig, f'hand_{s}', f'hand_{s}', f'middle_01_{s}', level)

def evaluated_game_coords(obj):
    """An object's vertices as posed (its modifiers applied), in the game's frame."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.array([to_game(ev.matrix_world @ v.co) for v in me.vertices])
    ev.to_mesh_clear()
    return co

def face_pitch(body, eyes):
    """How far the face leans forward (rad, + looks down): the chin-to-forehead line against the vertical (measure-quaternius.mjs)."""
    co = evaluated_game_coords(body)
    co = co[group_weights(body, 'body') > 0.5]   # (not the helper geometry: the tights, the skirt, the hair's)
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

FACE_PITCH = 0.08       # the Quaternius faces' (0.10 the man, 0.05 the woman: measure-quaternius.mjs)

def lift_face(rig, body, eyes):
    """MakeHuman's head hangs a little forward at rest: the neck and head turned back until the face stands as the Quaternius ones."""
    def turn_by(a):
        for name, share in (('neck_01', 0.4), ('head', 0.6)):
            pb = rig.pose.bones[name]
            h = pb.head.copy()
            pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(-a * share, 4, 'X') @ Matrix.Translation(-h) @ pb.matrix
            bpy.context.view_layer.update()
    before = face_pitch(body, eyes)
    turn = max(-0.2, min(0.2, before - FACE_PITCH))
    turn_by(turn)
    after = face_pitch(body, eyes)
    if abs(after - FACE_PITCH) > abs(before - FACE_PITCH):   # (a face the line doesn't measure well: an old man's chin, a child's brow)
        turn_by(-turn)
        after = face_pitch(body, eyes)
    log(f'face pitch {before:.3f} -> {after:.3f}')

def apply_rest(rig, meshes):
    """Apply the current pose as the rest pose (the meshes have no shape keys yet)."""
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

def delete_verts(obj, keep_mask):
    """Delete the vertices of a mesh (with its shape keys) where keep_mask is False."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep_mask[v.index]], context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()

def group_weights(obj, group):
    """Per vertex weight of a vertex group (0 where absent)."""
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
    return len(obj.data.loop_triangles)

def decimate(body, target_tris):
    """
    The body decimated to about target_tris triangles, the head (and its shape keys) kept whole:
    a copy without shape keys is collapsed (Blender's Decimate, symmetric, the head weighted out of
    it), then every vertex takes its shape keys from where it lies on the original surface (the
    head's are its own vertices, unmoved).
    """
    basis, deltas = merged_deltas(body)
    keys = list(deltas.keys())
    src_tris = triangles(body)
    low = body.copy()
    low.data = body.data.copy()
    bpy.context.collection.objects.link(low)
    activate(low)
    low.shape_key_clear()
    head = group_weights(low, 'head')
    neck = group_weights(low, 'neck_01')
    keep = low.vertex_groups.new(name='decimate-keep')
    for i in range(len(low.data.vertices)):
        # (0: decimated first; the face and the skull stay)
        w = 0.0 if head[i] > 0.2 else 1.0 - min(1.0, neck[i] * 1.5)
        keep.add([i], w, 'REPLACE')
    mod = low.modifiers.new('Decimate', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = min(1.0, target_tris / src_tris)
    mod.use_collapse_triangulate = True
    mod.use_symmetry = True
    mod.symmetry_axis = 'X'
    mod.vertex_group = keep.name
    mod.vertex_group_factor = 8.0
    while low.modifiers[0] != mod:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    apply_modifier(low, mod.name)
    low.vertex_groups.remove(low.vertex_groups['decimate-keep'])
    # shape keys onto the low mesh: the same vertex where it is one, else the nearest point's
    n = len(low.data.vertices)
    co = np.empty(n * 3); low.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    body.data.calc_loop_triangles()
    tris = [tuple(t.vertices) for t in body.data.loop_triangles]
    bvh = BVHTree.FromPolygons([Vector(p) for p in basis], tris)
    out = {k: np.zeros((n, 3)) for k in keys}
    exact = 0
    for i in range(n):
        p = Vector(co[i])
        loc, nrm, fi, dist = bvh.find_nearest(p)
        a, b, c = tris[fi]
        A, B, C = Vector(basis[a]), Vector(basis[b]), Vector(basis[c])
        # barycentric weights of loc in ABC
        v0, v1, v2 = B - A, C - A, loc - A
        d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
        den = d00 * d11 - d01 * d01 or 1e-12
        wb = (d11 * d20 - d01 * d21) / den
        wc = (d00 * d21 - d01 * d20) / den
        wa = 1 - wb - wc
        if dist < 1e-7:
            exact += 1
        for k in keys:
            D = deltas[k]
            out[k][i] = D[a] * wa + D[b] * wb + D[c] * wc
    kept = set_keys(low, co, out)
    log(f'decimated {src_tris} -> {triangles(low)} triangles, {n} vertices ({exact} unmoved), keys {len(kept)}')
    return low

def cut_brows(brows, mhclo_dir):
    """The eyebrow card cut to its drawn shape: faces (twice subdivided) whose texture is mostly transparent go."""
    png = [f for f in os.listdir(mhclo_dir) if f.endswith('.png') and 'normal' not in f.lower()]
    img = bpy.data.images.load(os.path.join(mhclo_dir, png[0]))
    W, H = img.size
    px = np.array(img.pixels[:]).reshape(H, W, 4)
    alpha = px[..., 3] if px[..., 3].min() < 0.99 else px[..., :3].mean(axis=2)
    bm = bmesh.new()
    bm.from_mesh(brows.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    uv = bm.loops.layers.uv.active
    gone = []
    for f in bm.faces:
        u = sum(l[uv].uv.x for l in f.loops) / len(f.loops)
        v = sum(l[uv].uv.y for l in f.loops) / len(f.loops)
        a = alpha[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W)))]
        if a < 0.3:
            gone.append(f)
    bmesh.ops.delete(bm, geom=gone, context='FACES_ONLY')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(brows.data)
    bm.free()
    brows.data.update()
    log(f'brows: {len(gone)} faces cut, {len(brows.data.polygons)} kept')

def skull_z(body):
    """The skull's centre front to back (game z) over the eye line: between the forehead and the back of the head."""
    M = body.matrix_world
    co = np.array([to_game(M @ v.co) for v in body.data.vertices])
    head = np.maximum(group_weights(body, 'Head'), group_weights(body, 'head'))
    H = co[head > 0.5]
    eyeY = H[:, 1].max() - 0.115
    up = H[H[:, 1] > eyeY + 0.01]
    return float((up[:, 2].max() + up[:, 2].min()) / 2)

def measure(rig, body, eyes):
    """The landmarks the game needs, in the game's frame (metres, bind pose)."""
    M = body.matrix_world
    co = np.array([to_game(M @ v.co) for v in body.data.vertices])
    head = np.maximum(group_weights(body, 'Head'), group_weights(body, 'head'))
    bone = {b.name: np.array(to_game(rig.matrix_world @ b.head_local)) for b in rig.data.bones}
    E = np.array([to_game(eyes.matrix_world @ v.co) for v in eyes.data.vertices])
    El = E[E[:, 0] > 0]
    eye_c = (El.min(0) + El.max(0)) / 2
    eyeY, eyeX = float(eye_c[1]), float(eye_c[0])
    H = co[head > 0.5]
    mid = H[np.abs(H[:, 0]) < 0.004]
    tip = mid[np.argmax(mid[:, 2])]
    noseY, noseZ = float(tip[1]), float(tip[2])
    front = mid[(mid[:, 1] < noseY - 0.025) & (mid[:, 1] > noseY - 0.14) & (mid[:, 2] > noseZ - 0.075)]
    chinY = float(front[:, 1].min())
    # the ears: the head's sides round the eye line, behind the cheeks
    half = float(np.abs(H[:, 0]).max())
    side = H[(np.abs(H[:, 0]) > half - 0.012) & (H[:, 1] < eyeY + 0.01) & (H[:, 1] > eyeY - 0.05)]
    earZ = float(side[:, 2].mean()) if len(side) else -0.02
    # the skull over the eyes: an egg round (0, eyeY, zc)
    top = float(H[:, 1].max())
    up = H[H[:, 1] > eyeY + 0.01]
    zf, zb = float(up[:, 2].max()), float(up[:, 2].min())
    zc = (zf + zb) / 2
    skull = {'x': float(np.abs(up[:, 0]).max()), 'y': top - eyeY, 'front': zf - zc, 'back': zc - zb}
    # grown until it holds the whole crown (the hair's shells sit on it: MakeHuman's skull is no egg,
    # flatter on top and fuller over the temples), the ears and the brow left out
    crown = H[(H[:, 1] > eyeY + 0.03) & (np.abs(H[:, 0]) < skull['x'] - 0.008)]
    rz = np.where(crown[:, 2] > zc, skull['front'], skull['back'])
    r = np.sqrt((crown[:, 0] / skull['x']) ** 2 + ((crown[:, 1] - eyeY) / skull['y']) ** 2 + ((crown[:, 2] - zc) / rz) ** 2)
    k = max(1.0, float(np.percentile(r, 99)))
    skull = {key: v * k for key, v in skull.items()}
    hb = bone['Head']
    hand = bone['hand_l']
    return {
        'face': [round(x, 4) for x in (eyeY, eyeX, noseY, noseZ, chinY)],
        'outfit': [round(x, 4) for x in (bone['foot_l'][1] + 0.045, bone['thigh_l'][1], bone['neck_01'][1] - 0.05, abs(hand[0]) - 0.065)],
        'earZ': round(earZ, 4),
        'head': [round(x, 4) for x in hb],
        'headFrame': [0.0, round(eyeY - hb[1], 4), round(zc - hb[2], 4)],
        'skull': {k: round(v, 4) for k, v in skull.items()},
        'height': round(float(co[:, 1].max()), 4),
        'bones': {n: [round(x, 4) for x in bone[n]] for n in ('pelvis', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'spine_03', 'neck_01', 'Head', 'upperarm_l', 'lowerarm_l', 'hand_l')},
    }

def build(person):
    t0 = time.time()
    bpy.ops.wm.read_homefile(use_empty=True)
    macro = TargetService.get_default_macro_info_dict()
    macro.update({k: v for k, v in person['macro'].items() if k != 'race'})
    if 'race' in person['macro']:
        macro['race'] = person['macro']['race']
    body = HumanService.create_human(macro_detail_dict=macro)
    # the person's own targets on top of the macros (MakeHuman's sliders: a belly, wider hips)
    for name, w in person.get('targets', {}).items():
        TargetService.load_target(body, TargetService.target_full_path(name), weight=w, name=name)
    rig = HumanService.add_builtin_rig(body, 'game_engine', import_weights=True)
    data = LocationService.get_user_data('')
    eyes = HumanService.add_mhclo_asset(os.path.join(data, 'eyes', EYES, f'{EYES}.mhclo'), body, asset_type='Eyes', subdiv_levels=0, material_type='NONE')
    brow_dir = os.path.join(data, 'eyebrows', person.get('brows', 'eyebrow001'))
    brows = HumanService.add_mhclo_asset(os.path.join(brow_dir, f"{person.get('brows', 'eyebrow001')}.mhclo"), body, asset_type='Eyebrows', subdiv_levels=0, material_type='NONE')
    # the T-pose as the rest pose (the macro targets baked first)
    TargetService.bake_targets(body)
    for m in list(body.modifiers):
        if m.type == 'MASK':
            body.modifiers.remove(m)
    t_pose(rig)
    lift_face(rig, body, eyes)
    apply_rest(rig, [body, eyes, brows])
    # the face: MPFB's face units and visemes as shape keys, onto the brows too
    FaceService.load_targets(body, load_microsoft_visemes=True, load_meta_visemes=False, load_arkit_faceunits=True)
    FaceService.interpolate_targets(body)
    # (the helper geometry out: only the body's own vertices)
    keep = group_weights(body, 'body') > 0.5
    delete_verts(body, keep)
    for o in (eyes, brows):
        b, d = merged_deltas(o)
        if b is not None:
            set_keys(o, b, d)
    low = decimate(body, TRIS)
    bpy.data.objects.remove(body)
    body = low
    cut_brows(brows, brow_dir)
    # scale: the hips where the Quaternius man's are (bind space); the person's size is the root's scale
    bpy.context.view_layer.update()
    hip = (rig.matrix_world @ rig.data.bones['thigh_l'].head_local).z
    s = HIP_Y / hip
    rig.scale = (s, s, s)
    bpy.context.view_layer.update()
    for o in (body, eyes, brows):
        o.select_set(True)
    activate(rig)
    for o in (body, eyes, brows):
        o.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # and the skull where the Quaternius man's is, front to back (the face ink's rounded light is
    # centred there: face-ink.js FACE_ROUND_GLSL; MakeHuman's whole body stands ~6 cm further forward)
    bpy.context.view_layer.update()
    zc = skull_z(body)
    rig.location.y -= SKULL_Z - zc
    bpy.context.view_layer.update()
    for o in (body, eyes, brows):
        o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    rig.data.bones['head'].name = 'Head'
    body.name = 'Body'; body.data.name = 'Body'
    eyes.name = 'Eyes'; eyes.data.name = 'Eyes'
    brows.name = 'Eyebrows'; brows.data.name = 'Eyebrows'
    rig.name = 'Armature'
    for o in (body, eyes, brows):
        o.data.materials.clear()
    bpy.context.view_layer.update()
    info = measure(rig, body, eyes)
    info.update({
        'id': person['id'], 'label': person['label'], 'kind': person['kind'], 'years': person['years'],
        'scale': round(hip / HIP_Y, 4), 'macro': person['macro'], 'targets': person.get('targets', {}), 'inkFace': person.get('face', {}), 'brows': person.get('brows'), 'like': person.get('like', {}),
        'triangles': {'body': triangles(body), 'eyes': triangles(eyes), 'brows': triangles(brows)},
        'vertices': {'body': len(body.data.vertices), 'eyes': len(eyes.data.vertices), 'brows': len(brows.data.vertices)},
        'keys': {o.name: [k.name for k in o.data.shape_keys.key_blocks][1:] if o.data.shape_keys else [] for o in (body, eyes, brows)},
    })
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{person['id']}.glb")
    activate(rig)
    for o in (body, eyes, brows):
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
                              export_texcoords=False, export_normals=True, export_materials='NONE',
                              export_skins=True, export_all_influences=False, export_def_bones=False,
                              export_morph=True, export_morph_normal=False, export_morph_tangent=False,
                              export_try_sparse_sk=True, export_animations=False, export_apply=False, export_extras=False)
    info['bytes'] = os.path.getsize(path)
    if KEEP_BLEND:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"{person['id']}.blend"))
    log(f"{person['id']}: {info['triangles']} triangles, {info['bytes'] / 1024:.0f} KB, scale {info['scale']}, {time.time() - t0:.1f} s")
    return info

def main():
    people = json.load(open(os.path.join(HERE, 'people.json')))['people']
    manifest_path = os.path.join(OUT, 'people.json')
    old = {}
    if os.path.exists(manifest_path):
        old = {p['id']: p for p in json.load(open(manifest_path)).get('people', [])}
    out = []
    for p in people:
        out.append(build(p) if not ONLY or p['id'] in ONLY else old.get(p['id']))
    out = [p for p in out if p]
    manifest = {
        'source': 'MakeHuman / MPFB 2.0.17 (CC0 assets), scripts/makehuman/build.py; see docs/makehuman.md',
        'hipY': HIP_Y, 'tris': TRIS, 'eyes': EYES, 'people': out,
    }
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=1)
    log('wrote', manifest_path)

main()

"""Poses for the Blender traveller's previews and checks (issue #493): the lowered-arm pose the previews
have used since phase 1, and frames of the game's own clips (public/anim/ual.glb: Idle_Loop, Jog_Fwd_Loop,
Sprint_Loop, on the same bone names), carried onto the rig bone by bone as each bone's world rotation away
from its rest (the hips stay at their rest height). Not the game's retarget, near enough to see cloth.

poke(): how much of what lies under the shirt (the tee, the trousers' top) comes out through it in the
current pose, over the verts that are under it at rest."""
import math
import os
import bpy
import bmesh
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
UAL = os.path.join(HERE, '..', '..', '..', 'public', 'anim', 'ual.glb')

PALMS_IN = 100   # degrees
# the previews' pose: arms down and bent, a stride, the head turned. Each turn is about an axis of the armature
# (Blender's frame: z up, facing -Y, his left at +x), whatever the bone's roll, from the rest T-pose: the upper
# arms lowered about y, the forearms bent forward (toward -y) about z, so the left one (along +x) turns by a
# negative angle and the right one (along -x) by a positive one. (Until #548 the forearms' signs were the other
# way round: the elbows bent backwards, the hands flung out behind, palms forward, in every posed preview.)
# His rest T-pose has the palms forward: the forearms and hands turned palms in (about x, the arms' line at rest,
# a turn shared between the forearm and the wrist), as arms hang. A bone's turns are made in the order given
# (the forearm's: turned on its own line, then bent).
LOWERED = {'upperarm_l': ((0, 1, 0), 68), 'upperarm_r': ((0, 1, 0), -68),
           'lowerarm_l': [((1, 0, 0), PALMS_IN / 2), ((0, 0, 1), -35)], 'lowerarm_r': [((1, 0, 0), PALMS_IN / 2), ((0, 0, 1), 35)],
           'hand_l': ((1, 0, 0), PALMS_IN / 2), 'hand_r': ((1, 0, 0), PALMS_IN / 2),
           'thigh_l': ((1, 0, 0), -28), 'calf_l': ((1, 0, 0), 45),
           'thigh_r': ((1, 0, 0), 14), 'neck_01': ((0, 0, 1), 12), 'Head': ((0, 0, 1), 14),
           'spine_02': ((0, 0, 1), -6)}
# frames of the game's clips (fraction of the clip): idle, the jog's two passing poses, a sprint stride
CLIPS = {'idle': ('Idle_Loop', 0.0), 'jog-a': ('Jog_Fwd_Loop', 0.25), 'jog-b': ('Jog_Fwd_Loop', 0.75),
         'sprint': ('Sprint_Loop', 0.25)}


def reset(rig):
    for b in rig.pose.bones:
        b.rotation_mode = 'QUATERNION'
        b.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()


def lowered(rig):
    reset(rig)
    for name, turns in LOWERED.items():
        if name in rig.pose.bones:
            rig.pose.bones[name].rotation_quaternion = turn(rig, name, turns)
    bpy.context.view_layer.update()


def turn(rig, name, turns):
    """A pose bone's rotation for turns about the armature's axes ((axis, degrees) or a list of them, made in order)."""
    M = rig.data.bones[name].matrix_local.to_3x3().inverted()
    q = Quaternion()
    for axis, deg in (turns if isinstance(turns, list) else [turns]):
        q = Quaternion(M @ Vector(axis), math.radians(deg)) @ q
    return q


_src = {}


def source():
    """ual.glb read straight (it is node tracks, no skin): its nodes (name, parent, rest rotation) and each
    clip's rotation tracks, (times, quaternions xyzw) by node."""
    if 'nodes' in _src:
        return _src
    import json, struct
    import numpy as np
    raw = open(os.path.abspath(UAL), 'rb').read()
    jl = struct.unpack_from('<I', raw, 12)[0]
    j = json.loads(raw[20:20 + jl])
    binoff = 20 + jl + 8

    def acc(i):
        a = j['accessors'][i]
        bv = j['bufferViews'][a['bufferView']]
        n = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
        off = binoff + bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        return np.frombuffer(raw, dtype=np.float32, count=a['count'] * n, offset=off).reshape(a['count'], n)
    parent = {}
    for i, nd in enumerate(j['nodes']):
        for c in nd.get('children', []):
            parent[c] = i
    nodes = [(nd['name'], parent.get(i), nd.get('rotation', [0, 0, 0, 1])) for i, nd in enumerate(j['nodes'])]
    clips = {}
    for an in j['animations']:
        tr = {}
        for ch in an['channels']:
            if ch['target']['path'] != 'rotation':
                continue
            sm = an['samplers'][ch['sampler']]
            tr[ch['target']['node']] = (acc(sm['input'])[:, 0], acc(sm['output']))
        clips[an['name']] = tr
    _src.update(nodes=nodes, clips=clips)
    return _src


def _q(xyzw):
    return Quaternion((xyzw[3], xyzw[0], xyzw[1], xyzw[2]))


def _world(nodes, local):
    out = {}
    for i in range(len(nodes)):
        chain, k = [], i
        while k is not None:
            chain.append(k)
            k = nodes[k][1]
        q = Quaternion()
        for k in reversed(chain):
            q = q @ local[k]
        out[nodes[i][0]] = q
    return out


def clip(rig, name):
    """The rig in a frame of one of the game's clips (CLIPS)."""
    import numpy as np
    src = source()
    nodes = src['nodes']
    clip_name, at = CLIPS[name]
    tracks = src['clips'][clip_name]
    t_end = max(t[-1] for t, _ in tracks.values())
    t = t_end * at
    rest_l = [_q(r) for _, _, r in nodes]
    pose_l = list(rest_l)
    for ni, (times, qs) in tracks.items():
        k = int(np.searchsorted(times, t))
        k0, k1 = max(0, k - 1), min(len(times) - 1, k)
        f = 0.0 if k0 == k1 else float((t - times[k0]) / (times[k1] - times[k0]))
        pose_l[ni] = _q(qs[k0]).slerp(_q(qs[k1]), f)
    rest_w, pose_w = _world(nodes, rest_l), _world(nodes, pose_l)
    # glTF (y up) to Blender (z up): x, y, z -> x, -z, y
    C = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0))).to_quaternion()
    reset(rig)
    Mt = rig.matrix_world
    for b in rig.data.bones:   # (parents before children)
        n = b.name
        if n not in pose_w or n in ('Root', 'root', 'root_motion'):
            continue
        delta = C @ (pose_w[n] @ rest_w[n].inverted()) @ C.inverted()
        rt = (Mt @ b.matrix_local).to_quaternion()
        pb = rig.pose.bones[n]
        head = (Mt @ pb.matrix).translation
        pb.matrix = Mt.inverted() @ Matrix.LocRotScale(head, delta @ rt, None)
        bpy.context.view_layer.update()


def bend(rig, side, limb='arm'):
    """How a limb bends in the current pose: (degrees between its two bones, the lower bone's lean off the upper
    one's line toward the upper bone's front carried by its pose, -1..1). His front is -y at rest, so an elbow
    bends the right way when the lean is positive and a knee when it is negative (#548)."""
    a, b, c = (f'upperarm_{side}', f'lowerarm_{side}', f'hand_{side}') if limb == 'arm' else (f'thigh_{side}', f'calf_{side}', f'foot_{side}')
    M = rig.matrix_world
    at = lambda n: M @ rig.pose.bones[n].head
    rest = (M @ rig.data.bones[a].matrix_local).to_quaternion()
    front = ((M @ rig.pose.bones[a].matrix).to_quaternion() @ rest.inverted()) @ Vector((0, -1, 0))
    u, f = (at(b) - at(a)).normalized(), (at(c) - at(b)).normalized()
    return math.degrees(u.angle(f)), (f - u * f.dot(u)).dot(front)


def under_set(inner, outer, reach=0.05):
    """The verts of `inner` under `outer` at rest (a ray out along the vertex normal meets it)."""
    b = bmesh.new()
    b.from_mesh(outer.data)
    t = BVHTree.FromBMesh(b)
    b.free()
    inner.data.update()
    return [v.index for v in inner.data.vertices if t.ray_cast(v.co + v.normal * 0.001, v.normal, reach)[0] is not None]


def poke(inner, outer, idx, depth=0.001):
    """Of the verts `idx` of `inner` (under `outer` at rest), how many are out through it now by more than
    `depth`, and the deepest, in the evaluated (posed) meshes."""
    dg = bpy.context.evaluated_depsgraph_get()
    eo = outer.evaluated_get(dg)
    t = BVHTree.FromObject(eo, dg)
    ei = inner.evaluated_get(dg)
    me = ei.to_mesh()
    out, worst = 0, 0.0
    for i in idx:
        v = me.vertices[i]
        p, n = v.co, v.normal
        if t.ray_cast(p + n * 0.0005, n, 0.06)[0] is not None:
            continue   # still under it
        hit = t.ray_cast(p, -n, 0.04)
        if hit[0] is not None:
            # the shell is behind this vert: it is out by the hit's distance (when the shell faces out here)
            if hit[1].dot(n) > 0 and hit[3] > depth:
                out += 1
                worst = max(worst, hit[3])
    ei.to_mesh_clear()
    return out, worst

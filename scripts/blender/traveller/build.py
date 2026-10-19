"""The traveller rebuilt in Blender (issue #493): a base body, a head with its face keys, eyes, brows and
hair, and each piece of clothing apart, all skinned to the game's own 53-bone skeleton (plus the eyes' two
bones), with the body's areas each garment hides, kit sockets, flat palette materials and UVs.

  node scripts/blender/traveller/export-donor.mjs <work>/donor.json
  Blender --background --factory-startup --python scripts/blender/traveller/build.py -- \
      --donor <work>/donor.json --out data/characters/traveller-v2

Writes <out>/traveller.blend, <out>/traveller.glb (every part a named mesh on one skin) and
<out>/manifest.json (the parts, their materials' palette keys, the areas each garment hides, the bone map,
the sockets, the counts). docs/systems/characters.md, "The traveller in Blender" and "Outfits"."""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
import loft, body as B, head as H, garments as G, rig as R

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


DONOR = arg('--donor')
OUT = os.path.abspath(arg('--out', os.path.join(REPO, 'data', 'characters', 'traveller-v2')))
PORTRAIT = os.path.join(REPO, 'public', 'characters', 'traveller-v1', 'head-v3', 'model.glb')
SEAM_Z = 1.515          # the head meets the body here, under the scarf
HAIR_TRIS = 7000        # the portrait's hair, decimated to about this many triangles
os.makedirs(OUT, exist_ok=True)

# The palette: each material is a region the game colours from TRAVELLER_PALETTE (src/traveller-style.js)
# or eyes.js; the display colours here are the same values, for the previews.
MATERIALS = {
    'skin': ('skin', '#d9a17e'), 'hair': ('hair', '#292f2a'), 'brow': ('brow', '#35362d'),
    'eye_white': ('EYE_WHITE', '#f4ecdc'), 'iris': ('TRAVELLER_IRIS', '#5a4030'), 'pupil': ('dark', '#1c1a17'),
    'mouth': ('dark', '#5a2a24'),
    'tee': ('suit', '#efe6cf'), 'shirt': ('jacket', '#dc826c'), 'shirt_lining': ('jacketShade', '#bd6e59'),
    'trousers': ('suit', '#e8ddbf'), 'boot': ('boot', '#d6c6a6'), 'sole': ('sole', '#8f7754'),
    'scarf': ('scarf', '#d6b07a'),
}


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c] + [1.0]


def material(name):
    m = bpy.data.materials.get(name)
    if m:
        return m
    key, hexc = MATERIALS[name]
    m = bpy.data.materials.new(name)
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    col = srgb(hexc)
    bsdf.inputs['Base Color'].default_value = col
    bsdf.inputs['Roughness'].default_value = 0.9
    m.diffuse_color = col
    m.use_backface_culling = True     # (glTF single-sided; the hair turns it off)
    m['palette'] = key
    return m


def link(ob, coll):
    coll.objects.link(ob)
    return ob


def collection(name, parent=None):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in (parent or bpy.context.scene.collection).children:
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def mesh_object(name, bm, coll, mats=()):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    for m in mats:
        me.materials.append(material(m))
    for p in me.polygons:
        p.use_smooth = True
    return link(bpy.data.objects.new(name, me), coll)


def subdivide(ob, levels=1):
    mod = ob.modifiers.new('Subdivision', 'SUBSURF')
    mod.levels = mod.render_levels = levels
    mod.boundary_smooth = 'PRESERVE_CORNERS'
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    d = json.load(open(DONOR))
    J = {x['name']: H.b(x['head']) for x in d['bones']}
    root = collection('Traveller')
    parts = collection('Parts', root)
    src_coll = collection('Sources (not exported)')

    # ---- the head, from MakeHuman's (topology, keys), drawn toward the portrait
    hb, srcl = H.donor_bm(d)
    eyes = H.eye_centres(d)
    L = H.landmarks_donor(hb, eyes)
    pbm, hair_lay = H.load_portrait(PORTRAIT)
    pbvh = BVHTree.FromBMesh(pbm)
    P = H.landmarks_portrait(pbvh, pbm, hair_lay)
    L['sy'] = H.depth_ratio(hb, pbm, L, P)
    S, dc, pc = H.head_transform(L, P, eyes['l'][1])
    # the cut nearest SEAM_Z whose edge has a multiple of four verts: the body's mirrored, subdivided
    # neck ring then meets it vert for vert
    for dz in [0.0] + [s * k * 0.002 for k in range(1, 12) for s in (1, -1)]:
        z_cut = (SEAM_Z + dz - pc.z) / S.z + L['eye_z']
        trial = hb.copy()
        H.cut_neck(trial, z_cut)
        if len(H.boundary_loop(trial)) % 4 == 0:
            break
    hb.free()
    hb = trial
    srcl = hb.verts.layers.int.get('src')
    seam_z = SEAM_Z + dz
    for v in hb.verts:
        v.co = H.apply_transform(v.co, S, dc, pc)
    eye_c = {k: H.apply_transform(eyes[k][0], S, dc, pc) for k in 'lr'}
    centre = Vector((0.0, eye_c['l'].y + 0.07, eye_c['l'].z + 0.01))
    H.fit_to_portrait(hb, pbm, centre)
    after = [v.co.copy() for v in hb.verts]
    eye_c = dict(zip('lr', H.follow([eye_c['l'], eye_c['r']], H.fit_to_portrait.before, after)))
    seam = H.level_neck(hb, seam_z)
    head_ob = mesh_object('Head', hb, parts, ['skin'])
    head_ob['kind'] = 'head'
    src_index = [v[srcl] for v in hb.verts]
    H.add_face_keys(head_ob, d, src_index, 'body', S)

    # ---- the body: the cage, its neck ring fitted to the head's seam
    neck = H.seam_rings(seam, B.TORSO[-1][0])
    cage = B.build(J, neck)
    cage_ob = mesh_object('Body_cage', cage, src_coll, ['skin'])
    body_bm = cage.copy()
    body_ob = mesh_object('Body', body_bm, parts, ['skin'])
    subdivide(body_ob)
    H.snap_seam(body_ob, head_ob)
    body_ob['kind'] = 'body'

    # ---- eyes, brows, hair
    eye_obs = H.make_eyes(eye_c, eyes['l'][1] * S.x, parts, material)
    brows = H.make_brows(d, S, dc, pc, after, parts, material)
    hair = H.make_hair(pbm, hair_lay, head_ob, parts, material, HAIR_TRIS)
    H.scalp_under_hair(head_ob, hair, material)

    # ---- the clothes, each from the body's cage
    outfit = G.build_all(cage, J, parts, material, mesh_object, subdivide)

    # ---- the skeleton and the skins
    arm = R.armature(d, J, eye_c, root)
    R.weight_body(arm, body_ob, cage_ob)
    R.weight_head(arm, head_ob, d, src_index)
    R.seam_weights(body_ob, head_ob)
    for ob in eye_obs:
        R.rigid(arm, ob, 'eye_' + ob.name[-1].lower())
    for ob in [brows, hair]:
        R.rigid(arm, ob, 'Head')
    for name, ob in outfit.items():
        R.transfer_weights(arm, body_ob, ob, G.SPEC[name].get('sample'))
    sockets = R.sockets(arm, root)

    # ---- the areas each garment hides; UVs; the manifest
    areas = G.body_areas(body_ob, J)
    cover = {name: G.hidden_areas(body_ob, ob, areas) for name, ob in outfit.items()}
    hides = {name: c[0] for name, c in cover.items()}
    # the whole outfit together hides more than its pieces each do (the tee and the shirt share the chest)
    union = [any(c[1][i] for c in cover.values()) for i in range(len(body_ob.data.vertices))]
    outfits = {'default': {'parts': list(outfit), 'hides': G.covered_areas(areas, union)}}
    every = [head_ob, body_ob, *eye_obs, brows, hair, *outfit.values()]
    for ob in every:
        G.unwrap(ob)
    cage_ob.hide_render = True
    cage_ob.hide_set(True)
    src_coll.hide_render = True

    bpy.context.preferences.filepaths.save_version = 0   # (no .blend1 beside it)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'traveller.blend'), compress=True)
    export(arm, every, sockets)
    manifest = {
        'source': 'scripts/blender/traveller/build.py (issue #493)',
        'skeleton': R.bone_map(arm),
        'parts': {ob.name: {
            'kind': ob.get('kind', 'body'), 'triangles': tri_count(ob), 'vertices': len(ob.data.vertices),
            'materials': {m.name: m.get('palette') for m in ob.data.materials},
            'shapeKeys': [k.name for k in ob.data.shape_keys.key_blocks[1:]] if ob.data.shape_keys else [],
            **({'hides': hides[ob.name]} if ob.name in hides else {}),
            **({'layer': ob['layer']} if 'layer' in ob else {}),
        } for ob in every},
        'areas': areas['names'],
        'outfits': outfits,
        'sockets': sockets,
        'triangles': sum(tri_count(ob) for ob in every),
    }
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    print('TRAVELLER', json.dumps({k: v['triangles'] for k, v in manifest['parts'].items()}), 'total', manifest['triangles'])


def export(arm, obs, sockets):
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    for ob in obs:
        ob.select_set(True)
    for s in arm.children:
        if s.type == 'EMPTY':
            s.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, 'traveller.glb'), export_format='GLB', use_selection=True,
        export_apply=False, export_skins=True, export_morph=True, export_morph_normal=True,
        export_attributes=True, export_extras=True, export_yup=True, export_animations=False,
        export_def_bones=False, export_leaf_bone=False, export_materials='EXPORT', export_tangents=False,
        export_vertex_color='NONE', export_influence_nb=4)


if __name__ == '__main__':
    main()

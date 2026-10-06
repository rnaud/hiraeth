// The Godot side of the scene mirror (engine/mirror.js), in the GodotJS VM: every op becomes
// Godot nodes, meshes and materials. Bulk data crosses as ArrayBuffers (GodotJS hands an
// ArrayBuffer to Godot as a PackedByteArray, a copy at memory speed); typed packed arrays are
// decoded from them natively with bytes_to_var, so no vertex is converted one by one in JS.
//
// Frames: three.js and Godot agree (right-handed, y up, a camera looking down -z), so matrices
// pass as they are. Winding does not: three's front faces are counter-clockwise, Godot's
// clockwise, so every triangle's last two corners are swapped (pack.js godotIndex).
import godot from 'godot';   // (the default import: GodotJS's module is a lazy proxy, a namespace copy of it would be empty)
import { VARIANT as T, packedBytes, godotIndex, multimeshBuffer, rgbaColors } from './pack.js';
import { skinMatrices } from '../skin.js';

/** A Godot packed array of `type` from a typed array. */
export const packed = (type, arr, count) => godot.bytes_to_var(packedBytes(type, arr, count));
const f32 = (a) => (a instanceof Float32Array ? a : Float32Array.from(a));

/** A three.js world matrix (16, column-major) as a Godot Transform3D. */
export function transformOf(e, o = 0) {
  return new godot.Transform3D(
    new godot.Basis(new godot.Vector3(e[o], e[o + 1], e[o + 2]), new godot.Vector3(e[o + 4], e[o + 5], e[o + 6]), new godot.Vector3(e[o + 8], e[o + 9], e[o + 10])),
    new godot.Vector3(e[o + 12], e[o + 13], e[o + 14]),
  );
}


/** A skin attribute (skinIndex: integers; skinWeight: floats) as 4 floats a vertex, for CUSTOM0 / CUSTOM1. */
function skinFloats(attr, n) {
  if (!attr) return null;
  const k = attr.itemSize, src = attr.array, out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) out[i * 4 + c] = c < k ? src[i * k + c] : 0;
  return out;
}

export class GodotBackend {
  /**
   * @param root   the Node3D everything is added under
   * @param o.shaders { 0, 1, 2: the ink surface for front, back and both sides; skinned, skinned2: skinned, front and both } (stage.js)
   * @param o.materialParams (spec) → { name: value } for those shaders (engine/godot/look.js)
   */
  constructor(root, { shaders = {}, materialParams = null } = {}) {
    this.root = root;
    this.shaders = shaders;
    this.materialParams = materialParams;
    this.meshes = new Map();       // gid → { mesh: ArrayMesh, surfaces, skinned }
    this.materials = new Map();    // mid → Material
    this.params = new Map();       // mid → the ink parameters (a skinned node makes its own materials from them)
    this.specs = new Map();        // mid → the spec
    this.nodes = new Map();        // id → { node, kind, gid, mids, mm, mats, skin, tex }
    this.cam = null;               // the Camera3D the mirror's camera drives (set by the entry)
    this.globals = new Map();      // the look's global shader parameters last set
    this.stats = { meshes: 0, surfaces: 0, nodes: 0, vertices: 0, triangles: 0, skinned: 0, ms: { geometry: 0, transforms: 0, instances: 0, bones: 0 } };
  }

  geometry(gid, g) {
    const t0 = Date.now();
    const A = g.attributes;
    const pos = A.position;
    if (!pos || pos.itemSize !== 3) return;
    const n = pos.array.length / 3;
    const AT = godot.Mesh.ArrayType;
    const skinned = !!(A.skinIndex && A.skinWeight);
    const sIdx = skinned ? packed(T.PACKED_FLOAT32, skinFloats(A.skinIndex, n), n * 4) : null;
    const sW = skinned ? packed(T.PACKED_FLOAT32, skinFloats(A.skinWeight, n), n * 4) : null;
    const verts = packed(T.PACKED_VECTOR3, f32(pos.array), n);
    const nrm = A.normal?.itemSize === 3 ? packed(T.PACKED_VECTOR3, f32(A.normal.array), n) : null;
    const uv = A.uv?.itemSize === 2 ? packed(T.PACKED_VECTOR2, f32(A.uv.array), n) : null;
    const col = A.color ? packed(T.PACKED_COLOR, rgbaColors(A.color, n), n) : null;
    const arrays = () => {
      const a = new godot.GArray();
      a.resize(AT.ARRAY_MAX);
      a.set(AT.ARRAY_VERTEX, verts);
      if (nrm) a.set(AT.ARRAY_NORMAL, nrm);
      if (uv) a.set(AT.ARRAY_TEX_UV, uv);
      if (col) a.set(AT.ARRAY_COLOR, col);
      if (skinned) { a.set(AT.ARRAY_CUSTOM0, sIdx); a.set(AT.ARRAY_CUSTOM1, sW); }
      return a;
    };
    const AF = godot.Mesh.ArrayFormat, CF = godot.Mesh.ArrayCustomFormat;
    const flags = skinned ? (CF.ARRAY_CUSTOM_RGBA_FLOAT << AF.ARRAY_FORMAT_CUSTOM0_SHIFT) | (CF.ARRAY_CUSTOM_RGBA_FLOAT << AF.ARRAY_FORMAT_CUSTOM1_SHIFT) : 0;
    const mesh = new godot.ArrayMesh();
    const total = g.index ? g.index.length : n;
    const range = g.drawRange ?? { start: 0, count: total };
    const groups = g.groups ?? [{ start: range.start, count: Math.min(range.count, total - range.start), materialIndex: 0 }];
    const surfaces = [];
    for (const grp of groups) {
      const idx = godotIndex(g.index ?? null, n, grp.start, Math.min(grp.count, total - grp.start));
      if (!idx.length) continue;
      const a = arrays();
      a.set(AT.ARRAY_INDEX, packed(T.PACKED_INT32, idx, idx.length));
      mesh.add_surface_from_arrays(godot.Mesh.PrimitiveType.PRIMITIVE_TRIANGLES, a, new godot.GArray(), new godot.GDictionary(), flags);
      surfaces.push(grp.materialIndex ?? 0);
      this.stats.triangles += idx.length / 3;
    }
    this.stats.vertices += n;
    this.stats.surfaces += surfaces.length;
    this.stats.meshes++;
    this.meshes.set(gid, { mesh, surfaces, skinned });
    this.stats.ms.geometry += Date.now() - t0;
  }

  _ink(shader, params) {
    const m = new godot.ShaderMaterial();
    m.shader = shader;
    for (const [k, v] of Object.entries(params)) m.set_shader_parameter(k, v);
    return m;
  }

  material(mid, spec) {
    let m;
    this.specs.set(mid, spec);
    if (spec.type === 'ink' && this.shaders[0]) {
      const params = this.materialParams ? this.materialParams(spec) : {};
      this.params.set(mid, params);
      m = this._ink(this.shaders[spec.side] ?? this.shaders[0], params);
    } else {
      m = new godot.StandardMaterial3D();
      const c = spec.u.uColor ?? [1, 1, 1];
      m.albedo_color = new godot.Color(c[0], c[1], c[2], spec.opacity ?? 1);
      m.shading_mode = godot.BaseMaterial3D.ShadingMode.SHADING_MODE_UNSHADED;
      if (spec.transparent) m.transparency = godot.BaseMaterial3D.Transparency.TRANSPARENCY_ALPHA;
      if (spec.vertexColors) m.vertex_color_use_as_albedo = true;
      if (spec.side === 2) m.cull_mode = godot.BaseMaterial3D.CullMode.CULL_DISABLED;
    }
    this.materials.set(mid, m);
  }

  /** The material for a mid on a node of this kind: skinned nodes and coloured instances get their own. */
  _materialFor(mid, kind) {
    const params = this.params.get(mid);
    if (kind === 'skinned' && params && this.shaders.skinned) return this._ink(this.specs.get(mid)?.side === 2 ? this.shaders.skinned2 : this.shaders.skinned, params);
    return this.materials.get(mid);
  }

  create(id, d) {
    const geo = this.meshes.get(d.gid);
    let node, mm = null;
    const mats = [];
    if (d.kind === 'instanced' && geo) {
      node = new godot.MultiMeshInstance3D();
      mm = new godot.MultiMesh();
      mm.transform_format = godot.MultiMesh.TransformFormat.TRANSFORM_3D;
      mm.mesh = geo.mesh;
      node.multimesh = mm;
      const mat = this.materials.get(d.mids[0]);
      if (mat) { node.material_override = mat; mats.push(mat); }
    } else if ((d.kind === 'mesh' || d.kind === 'skinned') && geo) {
      node = new godot.MeshInstance3D();
      node.mesh = geo.mesh;
      const kind = d.kind === 'skinned' && geo.skinned ? 'skinned' : 'mesh';
      geo.surfaces.forEach((mi, s) => {
        const mat = this._materialFor(d.mids[Math.min(mi, d.mids.length - 1)], kind);
        if (mat) { node.set_surface_override_material(s, mat); mats.push(mat); }
      });
      if (kind === 'skinned') { node.extra_cull_margin = 2.5; this.stats.skinned++; }
    } else {
      node = new godot.Node3D();   // (points, lines, sprites: not drawn yet)
    }
    node.visible = false;
    if (d.shadow === false && node.cast_shadow !== undefined) node.cast_shadow = godot.GeometryInstance3D.ShadowCastingSetting.SHADOW_CASTING_SETTING_OFF;
    if (d.name) node.name = `${d.name.replace(/[^A-Za-z0-9_ -]/g, '_')}_${id}`;
    this.root.add_child(node);
    this.nodes.set(id, { node, kind: d.kind, gid: d.gid, mids: d.mids, mm, mats, colors: false, skin: null, tex: null });
    this.stats.nodes++;
  }

  /** A drawable's geometry rewritten (cloth, a trail): the new mesh, the node's materials kept. */
  geometryOf(id, gid) {
    const e = this.nodes.get(id), geo = this.meshes.get(gid);
    if (!e || !geo) return;
    if (e.mm) { e.mm.mesh = geo.mesh; return; }
    if (!e.node.set_surface_override_material) return;
    e.node.mesh = geo.mesh;
    geo.surfaces.forEach((mi, s) => { const mat = e.mats[Math.min(s, e.mats.length - 1)]; if (mat) e.node.set_surface_override_material(s, mat); });
    e.gid = gid;
  }

  transforms(ids, mats, n) {
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      const e = this.nodes.get(ids[i]);
      if (e) e.node.transform = transformOf(mats, i * 16);
    }
    this.stats.ms.transforms += Date.now() - t0;
  }

  visible(id, on) { const e = this.nodes.get(id); if (e) e.node.visible = on; }

  instances(id, count, mats, colors) {
    const e = this.nodes.get(id);
    if (!e?.mm) return;
    const t0 = Date.now();
    const mm = e.mm;
    if (colors && !e.colors) {
      mm.instance_count = 0; mm.use_colors = true; e.colors = true;
      // (the instances' colours reach the shader as COLOR: a copy of the material that reads it)
      const params = this.params.get(e.mids[0]);
      if (params) { const mat = this._ink(this.shaders[this.specs.get(e.mids[0])?.side] ?? this.shaders[0], { ...params, use_vertex_color: 1 }); e.node.material_override = mat; e.mats = [mat]; }
    }
    mm.instance_count = count;
    if (count) mm.buffer = packed(T.PACKED_FLOAT32, multimeshBuffer(mats, count, e.colors ? colors : null), count * (e.colors ? 16 : 12));
    this.stats.ms.instances += Date.now() - t0;
  }

  /**
   * A skinned mesh's bones into its row of the frame's bone atlas (one RGBA-float texture for every
   * skinned mesh, 4 texels a bone: the shader's global g_bones, each material its bone_row); the
   * atlas goes to Godot once a frame (frame()).
   */
  bones(id, boneMatrices, n, bind, bindInverse) {
    const e = this.nodes.get(id);
    if (!e || e.kind !== 'skinned' || !e.mats.length) return;
    const t0 = Date.now();
    const A = this.atlas ??= { bones: 0, rows: 0, used: 0, data: null, tex: null, dirty: false };
    if (e.row === undefined) {
      e.row = A.used++;
      for (const m of e.mats) m.set_shader_parameter('bone_row', e.row);
    }
    if (n > A.bones || A.used > A.rows) {
      // (grown: wider for a bigger skeleton, taller for more meshes; rows keep their places)
      const bones = Math.max(A.bones, Math.ceil(n / 32) * 32), rows = Math.max(A.rows, Math.ceil(A.used / 64) * 64);
      const data = new Float32Array(bones * 16 * rows);
      if (A.data) for (let r = 0; r < A.rows; r++) data.set(A.data.subarray(r * A.bones * 16, (r + 1) * A.bones * 16), r * bones * 16);
      Object.assign(A, { bones, rows, data, tex: null });
    }
    skinMatrices(boneMatrices, n, bind, bindInverse, A.data.subarray(e.row * A.bones * 16, e.row * A.bones * 16 + n * 16));
    A.dirty = true;
    this.stats.ms.bones += Date.now() - t0;
  }

  frame() {
    const A = this.atlas;
    if (!A?.dirty) return;
    const t0 = Date.now();
    const img = godot.Image.create_from_data(A.bones * 4, A.rows, false, godot.Image.Format.FORMAT_RGBAF, A.data.buffer);
    if (!A.tex) { A.tex = godot.ImageTexture.create_from_image(img); godot.RenderingServer.global_shader_parameter_set('g_bones', A.tex); }
    else A.tex.update(img);
    A.dirty = false;
    this.stats.ms.bones += Date.now() - t0;
  }

  remove(id) { const e = this.nodes.get(id); if (e) { e.node.queue_free(); this.nodes.delete(id); this.stats.nodes--; } }

  camera(c) {
    if (!this.cam) return;
    this.cam.transform = transformOf(c.world);
    this.cam.fov = c.fov / (c.zoom || 1);
    this.cam.near = c.near;
    this.cam.far = c.far;
  }

  /** The frame's look as Godot's global shader parameters (godot/project.godot [shader_globals]); only what changed. */
  look(params) {
    const RS = godot.RenderingServer;
    for (const [name, v] of Object.entries(params)) {
      const key = Array.isArray(v) ? v.join(',') : v;
      if (this.globals.get(name) === key) continue;
      this.globals.set(name, key);
      const val = !Array.isArray(v) ? v : v.length === 2 ? new godot.Vector2(v[0], v[1]) : v.length === 3 ? new godot.Vector3(v[0], v[1], v[2]) : new godot.Vector4(v[0], v[1], v[2], v[3]);
      RS.global_shader_parameter_set(name, val);
    }
  }
}

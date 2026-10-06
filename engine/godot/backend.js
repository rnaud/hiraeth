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


export class GodotBackend {
  /**
   * @param root      the Node3D everything is added under
   * @param o.shaders { surface: Shader } the ink surface shader (godot/shaders/ink_surface.gdshader)
   */
  constructor(root, { surfaceShader, materialParams = null } = {}) {
    this.root = root;
    this.surfaceShader = surfaceShader;
    this.materialParams = materialParams;   // (spec) → { name: value } for the shader (engine/godot/look.js)
    this.meshes = new Map();       // gid → { mesh: ArrayMesh, surfaces, groups }
    this.materials = new Map();    // mid → Material
    this.nodes = new Map();        // id → { node, kind, gid, mids, mm }
    this.cam = null;               // the Camera3D the mirror's camera drives (set by the entry)
    this.stats = { meshes: 0, surfaces: 0, nodes: 0, vertices: 0, triangles: 0, ms: { geometry: 0, transforms: 0, instances: 0 } };
  }

  geometry(gid, g) {
    const t0 = Date.now();
    const A = g.attributes;
    const pos = A.position;
    if (!pos || pos.itemSize !== 3) return;
    const n = pos.array.length / 3;
    const arrays = () => {
      const a = new godot.GArray();
      a.resize(godot.Mesh.ArrayType.ARRAY_MAX);
      a.set(godot.Mesh.ArrayType.ARRAY_VERTEX, packed(T.PACKED_VECTOR3, f32(pos.array), n));
      if (A.normal?.itemSize === 3) a.set(godot.Mesh.ArrayType.ARRAY_NORMAL, packed(T.PACKED_VECTOR3, f32(A.normal.array), n));
      if (A.uv?.itemSize === 2) a.set(godot.Mesh.ArrayType.ARRAY_TEX_UV, packed(T.PACKED_VECTOR2, f32(A.uv.array), n));
      if (A.color) {
        a.set(godot.Mesh.ArrayType.ARRAY_COLOR, packed(T.PACKED_COLOR, rgbaColors(A.color, n), n));
      }
      return a;
    };
    const mesh = new godot.ArrayMesh();
    const groups = g.groups ?? [{ start: 0, count: g.index ? g.index.length : n, materialIndex: 0 }];
    const surfaces = [];
    for (const grp of groups) {
      const idx = godotIndex(g.index ?? null, n, grp.start, Math.min(grp.count, (g.index ? g.index.length : n) - grp.start));
      if (!idx.length) continue;
      const a = arrays();
      a.set(godot.Mesh.ArrayType.ARRAY_INDEX, packed(T.PACKED_INT32, idx, idx.length));
      mesh.add_surface_from_arrays(godot.Mesh.PrimitiveType.PRIMITIVE_TRIANGLES, a);
      surfaces.push(grp.materialIndex ?? 0);
      this.stats.triangles += idx.length / 3;
    }
    this.stats.vertices += n;
    this.stats.surfaces += surfaces.length;
    this.stats.meshes++;
    this.meshes.set(gid, { mesh, surfaces });
    this.stats.ms.geometry += Date.now() - t0;
  }

  material(mid, spec) {
    let m;
    if (spec.type === 'ink' && this.surfaceShader) {
      m = new godot.ShaderMaterial();
      m.shader = this.surfaceShader;
      const params = this.materialParams ? this.materialParams(spec) : {};
      for (const [k, v] of Object.entries(params)) m.set_shader_parameter(k, v);
    } else {
      m = new godot.StandardMaterial3D();
      const c = spec.u.uColor ?? [1, 1, 1];
      m.albedo_color = new godot.Color(c[0], c[1], c[2], spec.opacity ?? 1);
      m.shading_mode = godot.BaseMaterial3D.ShadingMode.SHADING_MODE_UNSHADED;
      if (spec.transparent) m.transparency = godot.BaseMaterial3D.Transparency.TRANSPARENCY_ALPHA;
      if (spec.vertexColors) m.vertex_color_use_as_albedo = true;
    }
    if (spec.side === 2) { if (m.cull_mode !== undefined) m.cull_mode = godot.BaseMaterial3D.CullMode.CULL_DISABLED; }
    this.materials.set(mid, m);
  }

  create(id, d) {
    const geo = this.meshes.get(d.gid);
    let node, mm = null;
    if (d.kind === 'instanced' && geo) {
      node = new godot.MultiMeshInstance3D();
      mm = new godot.MultiMesh();
      mm.transform_format = godot.MultiMesh.TransformFormat.TRANSFORM_3D;
      mm.mesh = geo.mesh;
      node.multimesh = mm;
    } else if ((d.kind === 'mesh' || d.kind === 'skinned') && geo) {
      node = new godot.MeshInstance3D();
      node.mesh = geo.mesh;
    } else {
      node = new godot.Node3D();   // (points, lines, sprites: not drawn yet)
    }
    if (geo && node.set_surface_override_material) {
      geo.surfaces.forEach((mi, s) => {
        const mat = this.materials.get(d.mids[Math.min(mi, d.mids.length - 1)]);
        if (mat) node.set_surface_override_material(s, mat);
      });
    } else if (geo && mm) {
      const mat = this.materials.get(d.mids[0]);
      if (mat) node.material_override = mat;
    }
    node.visible = false;
    if (d.name) node.name = `${d.name.replace(/[^A-Za-z0-9_ -]/g, '_')}_${id}`;
    this.root.add_child(node);
    this.nodes.set(id, { node, kind: d.kind, gid: d.gid, mids: d.mids, mm, colors: false });
    this.stats.nodes++;
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
    if (colors && !e.colors) { mm.instance_count = 0; mm.use_colors = true; e.colors = true; }
    mm.instance_count = count;
    if (count) mm.buffer = packed(T.PACKED_FLOAT32, multimeshBuffer(mats, count, e.colors ? colors : null), count * (e.colors ? 16 : 12));
    this.stats.ms.instances += Date.now() - t0;
  }

  remove(id) { const e = this.nodes.get(id); if (e) { e.node.queue_free(); this.nodes.delete(id); this.stats.nodes--; } }

  camera(c) {
    if (!this.cam) return;
    this.cam.transform = transformOf(c.world);
    this.cam.fov = c.fov / (c.zoom || 1);
    this.cam.near = c.near;
    this.cam.far = c.far;
  }
}

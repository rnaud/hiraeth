// The Unity side of the scene mirror (engine/mirror.js), in Puerts' V8. Puerts calls C# by
// reflection, slower a call than GodotJS, so the ops are batched: geometry and materials go once
// each (an ArrayBuffer, a JSON string), and everything a frame changes goes in one command buffer
// (pack.js CommandWriter) handed to C# once a frame (unity/Memento/Assets/MementoJS: BridgeHost,
// BridgeRenderer). The frame is mirrored in x on the way (pack.js), as the port's exporter does.
import { unityGeometry, CommandWriter, OP, mirrorMatrix } from './pack.js';
import { portMaterial } from './port-format.js';
import { skinMatrices } from '../skin.js';

export class UnityBackend {
  /** @param host  the C# side: CS.Memento.Bridge.BridgeHost (or a stand-in in the tests) */
  constructor(host) {
    this.host = host;
    this.geoms = new Map();    // gid → the mirror's geometry (uploaded per variant when a node needs it)
    this.sent = new Set();     // the variants sent: `${gid}:${colours}:${bind}`
    this.specs = new Map();    // mid → spec
    this.w = new CommandWriter();
    this.skin = new Float32Array(16 * 128);
    this.stats = { geometries: 0, bytes: 0, frames: 0, commandBytes: 0 };
  }

  geometry(gid, g) {
    this.geoms.set(gid, g);
    // (a geometry rewritten: its variants go again when next drawn)
    for (const k of [...this.sent]) if (k.startsWith(`${gid}:`)) { this.sent.delete(k); this._resend = true; }
  }

  _variant(gid, colors, bind) {
    const key = `${gid}:${colors ? 1 : 0}:${bind ? 1 : 0}`;
    if (!this.sent.has(key)) {
      const g = this.geoms.get(gid);
      if (!g) return null;
      const buf = unityGeometry(g, { colors, bind });
      this.host.Geometry(key, buf);
      this.sent.add(key);
      this.stats.geometries++; this.stats.bytes += buf.byteLength;
    }
    return key;
  }

  material(mid, spec) {
    this.specs.set(mid, spec);
    this.host.Material(mid, JSON.stringify(portMaterial(spec, mid)));
  }

  create(id, d) {
    const specs = d.mids.map((m) => this.specs.get(m));
    const colors = specs.some((s) => s?.vertexColors);
    const figure = specs.some((s) => (s?.u?.uMode === 4 || s?.u?.uFigure > 0 || s?.u?.uMode === 6 || s?.defines?.FACE_PART));
    const mesh = d.gid ? this._variant(d.gid, colors, figure || d.kind === 'skinned') : null;
    this.nodes ??= new Map();
    this.nodes.set(id, { gid: d.gid, colors, bind: figure || d.kind === 'skinned', kind: d.kind });
    this.host.Create(id, JSON.stringify({ kind: d.kind, mesh, mids: d.mids, name: d.name, shadow: d.shadow !== false, bones: d.bones ?? 0 }));
  }

  geometryOf(id, gid) {
    const n = this.nodes?.get(id);
    if (!n) return;
    n.gid = gid;
    const mesh = this._variant(gid, n.colors, n.bind);
    if (mesh) this.host.SetMesh(id, mesh);
  }

  transforms(ids, mats, n) {
    const w = this.w;
    w.reserve(2 + n * 17);
    w.u(OP.transforms); w.u(n);
    for (let i = 0; i < n; i++) { w.i(ids[i]); w.matrix(mats, i * 16); }
  }

  visible(id, on) { const w = this.w; w.reserve(3); w.u(OP.visible); w.i(id); w.u(on ? 1 : 0); }

  instances(id, count, mats, colors) {
    const w = this.w;
    w.reserve(4 + count * 19);
    w.u(OP.instances); w.i(id); w.u(count); w.u(colors ? 1 : 0);
    for (let i = 0; i < count; i++) w.matrix(mats, i * 16);
    if (colors) for (let i = 0; i < count * 3; i++) w.f(colors[i]);
  }

  bones(id, boneMatrices, n, bind, bindInverse) {
    if (this.skin.length < n * 16) this.skin = new Float32Array(n * 16);
    skinMatrices(boneMatrices, n, bind, bindInverse, this.skin);
    const w = this.w;
    w.reserve(3 + n * 16);
    w.u(OP.bones); w.i(id); w.u(n);
    for (let i = 0; i < n; i++) w.matrix(this.skin, i * 16);
  }

  remove(id) { const w = this.w; w.reserve(2); w.u(OP.remove); w.i(id); this.nodes?.delete(id); }

  camera(c) {
    const w = this.w;
    w.reserve(21);
    w.u(OP.camera); w.matrix(c.world); w.f(c.fov / (c.zoom || 1)); w.f(c.near); w.f(c.far);
  }

  /** The frame's commands to C#, once. */
  frame() {
    const buf = this.w.take();
    this.stats.frames++; this.stats.commandBytes = buf.byteLength;
    this.host.Frame(buf);
  }

  /** The look in the port's own format (port-format.js portLook), when it changed. */
  look(json) { if (json !== this._look) { this._look = json; this.host.Look(json); } }
}

export { mirrorMatrix };

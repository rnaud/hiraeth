// The Unity side of the scene mirror (engine/mirror.js), in Puerts' V8. Puerts calls C# by
// reflection, slower a call than GodotJS, so the ops are batched: geometry and materials go once
// each (an ArrayBuffer, a JSON string), and everything a frame changes goes in one command buffer
// (pack.js CommandWriter) handed to C# once a frame (unity/Memento/Assets/MementoJS: BridgeHost,
// BridgeRenderer). The frame is mirrored in x on the way (pack.js), as the port's exporter does.
import { unityGeometry, CommandWriter, OP, mirrorMatrix, crowdInstances, puffInstances } from './pack.js';
import { portMaterial } from './port-format.js';
import { skinMatrices } from '../skin.js';

const tally = (self, op, before) => { self._opWords[op] = (self._opWords[op] ?? 0) + self.w.n - before; };

export class UnityBackend {
  /** @param host  the C# side: CS.Memento.Bridge.BridgeHost (or a stand-in in the tests) */
  constructor(host) {
    this.host = host;
    this.geoms = new Map();    // gid → the mirror's geometry (uploaded per variant when a node needs it)
    this.sent = new Set();     // the variants sent: `${gid}:${colours}:${bind}`
    this.sentGids = new Set(); // (and the geometries they come from)
    this.specs = new Map();    // mid → spec
    this.ports = new Map();    // mid → the port's own shader for it, if any ('mote', 'print', 'flame')
    this.w = new CommandWriter();
    this.skin = new Float32Array(16 * 128);
    this.stats = { geometries: 0, bytes: 0, frames: 0, commandBytes: 0, hostMs: 0, opWords: {} };
    this._opWords = {};
  }

  geometry(gid, g) {
    this.geoms.set(gid, g);
    // (a geometry rewritten: its variants go again when next drawn)
    for (const k of [...this.sent]) if (k.startsWith(`${gid}:`)) { this.sent.delete(k); this._resend = true; }
  }

  _variant(gid, colors, bind, rig = false) {
    const key = `${gid}:${colors ? 1 : 0}:${bind ? 1 : 0}${rig ? ':r' : ''}`;
    if (!this.sent.has(key)) {
      const g = this.geoms.get(gid);
      if (!g) return null;
      const buf = unityGeometry(g, { colors, bind, rig });
      this.host.Geometry(key, buf);
      this.sent.add(key); this.sentGids.add(gid);
      this.stats.geometries++; this.stats.bytes += buf.byteLength;
    }
    return key;
  }

  material(mid, spec) {
    this.specs.set(mid, spec);
    const pm = portMaterial(spec, mid);
    if (pm.port) this.ports.set(mid, pm.port);
    this.host.Material(mid, JSON.stringify(pm));
  }

  create(id, d) {
    const specs = d.mids.map((m) => this.specs.get(m));
    const colors = specs.some((s) => s?.vertexColors);
    const crowd = d.kind === 'instanced' && specs.some((s) => s?.defines?.CROWD);
    const figure = !crowd && specs.some((s) => (s?.u?.uMode === 4 || s?.u?.uFigure > 0 || s?.u?.uMode === 6 || s?.defines?.FACE_PART));
    const mesh = d.gid ? this._variant(d.gid, colors, figure || d.kind === 'skinned', crowd) : null;
    if (d.kind === 'instanced' && d.mids.some((m) => this.ports.get(m) === 'print')) {
      // the footprints: the port's Puffs (its Print decal), instanced from op 10
      (this.puffs ??= new Set()).add(id);
      this.nodes ??= new Map();
      this.nodes.set(id, { gid: d.gid, colors, bind: false, kind: 'puffs' });
      this.host.Create(id, JSON.stringify({ kind: 'puffs', mesh, mids: d.mids, name: d.name, shadow: false }));
      return;
    }
    if (crowd) {
      // the crowd's figures: the port's own (FarCrowd.cs), posed in its shader from the same numbers as crowd-shader.js
      (this.crowds ??= new Set()).add(id);
      this.nodes ??= new Map();
      this.nodes.set(id, { gid: d.gid, colors, bind: false, kind: 'crowd' });
      this.host.Create(id, JSON.stringify({ kind: 'crowd', mesh, mids: d.mids, name: d.name, shadow: false }));
      return;
    }
    this.nodes ??= new Map();
    this.nodes.set(id, { gid: d.gid, colors, bind: figure || d.kind === 'skinned', kind: d.kind });
    const desc = { kind: d.kind, mesh, mids: d.mids, name: d.name, shadow: d.shadow !== false, bones: d.bones ?? 0 };
    // (a skinned mesh bound "attached": its skeleton's bones are shared, its bind matrix is its bind pose)
    if (d.kind === 'skinned' && d.skeleton && d.attached) { desc.skeleton = d.skeleton; desc.bind = Array.from(mirrorMatrix(d.bind)); }
    this.host.Create(id, JSON.stringify(desc));
  }

  geometryOf(id, gid) {
    const n = this.nodes?.get(id);
    if (!n) return;
    n.gid = gid;
    const mesh = this._variant(gid, n.colors, n.bind);
    if (mesh) this.host.SetMesh(id, mesh);
  }

  transforms(ids, mats, n) { const b0 = this.w.n; this._transforms(ids, mats, n); tally(this, 'transforms', b0); }
  _transforms(ids, mats, n) {
    const w = this.w;
    w.reserve(2 + n * 17);
    w.u(OP.transforms); w.u(n);
    for (let i = 0; i < n; i++) { w.i(ids[i]); w.matrix(mats, i * 16); }
  }

  visible(id, on) { const b0 = this.w.n; this._visible(id, on); tally(this, 'visible', b0); }
  _visible(id, on) { const w = this.w; w.reserve(3); w.u(OP.visible); w.i(id); w.u(on ? 1 : 0); }

  instances(id, count, mats, colors, attrs, time) { const b0 = this.w.n; this._instances(id, count, mats, colors, attrs, time); tally(this, 'instances', b0); }
  _instances(id, count, mats, colors, attrs = null, time = 0) {
    const w = this.w;
    if (this.crowds?.has(id)) {
      if (count && !this._crowdSaid) { this._crowdSaid = true; console.log(`[unity] the crowd: ${count} figures in one draw`); }
      this._crowd = crowdInstances(mats, count, attrs, this._crowd?.length >= count * 32 ? this._crowd : new Float32Array(Math.max(count, 64) * 32));
      w.reserve(4 + count * 32);
      w.u(OP.crowd); w.i(id); w.u(count); w.f(time);
      for (let i = 0; i < count * 32; i++) w.f(this._crowd[i]);
      return;
    }
    if (this.puffs?.has(id)) {
      this._puff = puffInstances(mats, count, attrs, this._puff?.length >= count * 8 ? this._puff : new Float32Array(Math.max(count, 64) * 8));
      w.reserve(3 + count * 8);
      w.u(OP.puffs); w.i(id); w.u(count);
      for (let i = 0; i < count * 8; i++) w.f(this._puff[i]);
      return;
    }
    w.reserve(4 + count * 19);
    w.u(OP.instances); w.i(id); w.u(count); w.u(colors ? 1 : 0);
    for (let i = 0; i < count; i++) w.matrix(mats, i * 16);
    if (colors) for (let i = 0; i < count * 3; i++) w.f(colors[i]);
  }

  bones(id, boneMatrices, n, bind, bindInverse) { const b0 = this.w.n; this._bones(id, boneMatrices, n, bind, bindInverse); tally(this, 'bones', b0); }
  _bones(id, boneMatrices, n, bind, bindInverse) {
    if (this.skin.length < n * 16) this.skin = new Float32Array(n * 16);
    skinMatrices(boneMatrices, n, bind, bindInverse, this.skin);
    const w = this.w;
    w.reserve(3 + n * 16);
    w.u(OP.bones); w.i(id); w.u(n);
    for (let i = 0; i < n; i++) w.matrix(this.skin, i * 16);
  }

  /** A geometry's points and normals moved (cloth): into the frame's buffer, for every variant of it sent (op 8). */
  vertices(gid, pos, nrm, n) { const b0 = this.w.n; this._vertices(gid, pos, nrm, n); tally(this, 'vertices', b0); }
  _vertices(gid, pos, nrm, n) {
    if (!this.sentGids.has(gid)) return;
    const w = this.w;
    w.reserve(4 + n * 6);
    w.u(OP.vertices); w.i(gid); w.u(n); w.u(nrm ? 1 : 0);
    for (let i = 0; i < n; i++) { w.f(-pos[i * 3]); w.f(pos[i * 3 + 1]); w.f(pos[i * 3 + 2]); }
    if (nrm) for (let i = 0; i < n; i++) { w.f(-nrm[i * 3]); w.f(nrm[i * 3 + 1]); w.f(nrm[i * 3 + 2]); }
    this.stats.vertexBytes = (this.stats.vertexBytes ?? 0) + n * 24;
  }

  /** A skeleton's bones, world matrices (three's boneMatrices), mirrored: once a frame for every mesh it moves. */
  skeleton(sid, boneMatrices, n) { const b0 = this.w.n; this._skeleton(sid, boneMatrices, n); tally(this, 'skeleton', b0); }
  _skeleton(sid, boneMatrices, n) {
    const w = this.w;
    w.reserve(3 + n * 16);
    w.u(OP.skeleton); w.i(sid); w.u(n);
    for (let i = 0; i < n; i++) w.matrix(boneMatrices, i * 16);
  }

  remove(id) { const b0 = this.w.n; this._remove(id); tally(this, 'remove', b0); }
  _remove(id) { const w = this.w; w.reserve(2); w.u(OP.remove); w.i(id); this.nodes?.delete(id); }

  camera(c) { const b0 = this.w.n; this._camera(c); tally(this, 'camera', b0); }
  _camera(c) {
    const w = this.w;
    w.reserve(21);
    w.u(OP.camera); w.matrix(c.world); w.f(c.fov / (c.zoom || 1)); w.f(c.near); w.f(c.far);
  }

  /** The frame's commands to C#, once. */
  frame() {
    this.stats.opWords = this._opWords; this._opWords = {};
    const buf = this.w.take();
    this.stats.frames++; this.stats.commandBytes = buf.byteLength;
    const t0 = performance.now();
    this.host.Frame(buf);
    this.stats.hostMs += performance.now() - t0;   // (the call: Puerts' marshalling and the C# apply)
  }

  /** The frame's local lights ([x, y, z, reach], three's space), when they changed: op 11, mirrored (MementoLook's own list). */
  lights(list) {
    const key = list.map((l) => l.map((v) => Math.fround(v)).join(',')).join(';');
    if (key === this._lights) return;
    this._lights = key;
    const w = this.w, b0 = w.n;
    w.reserve(2 + list.length * 4);
    w.u(OP.lights); w.u(list.length);
    for (const [x, y, z, r] of list) { w.f(-x); w.f(y); w.f(z); w.f(r); }
    tally(this, 'lights', b0);
  }

  /** The look in the port's own format (port-format.js portLook), when it changed. */
  look(json) { if (json !== this._look) { this._look = json; this.host.Look(json); this.stats.looks = (this.stats.looks ?? 0) + 1; } }
}

export { mirrorMatrix };

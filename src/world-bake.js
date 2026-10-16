import { MeshBVH } from 'three-mesh-bvh';
import { Physics, BURIED_MEMO } from './physics.js';
import { CROWD_MEMO } from './crowd.js';

// ---------------------------------------------------------------------------
// A world's costly results worked out ahead of time (issue #385: the Unity builds only; the web generates as ever).
//
// Not the world itself: its creation is spread over dozens of builders and also makes its runtime state (temples,
// doors, spots, the story's hooks), so it still runs. What is kept are the results that are pure functions of what
// that creation made, each under a key of its own inputs, so that a bake can only ever answer exactly what the load
// would have worked out:
//   the collision's BVH   under the fingerprint of the triangles gathered from the scene (Physics.bake: the save's
//                         effects on the world, the desert's walking dunes or a temple's change, give other triangles,
//                         so another key, and the BVH is built as before; the desert's six dune visits are all baked),
//                         its boxes widened by BVH_SLACK (the engines' floats are a few ulps from node's: fingerprint);
//   the buried instances  each dropBuriedInstancesSteps call's dropped ids (the City-Shaft's trees in houses, every
//                         world's buried flora), under the collision's key (its colliders added since included), the
//                         mesh's instances and the test's heights: dropped at once, no distant-detail job queued;
//   the crowd's answers   every ray test buildPeopleSteps asks in order (the walks' samples, the circles' and the
//                         perches' places), under the collision's key and the crowd's spots: replayed in that order,
//                         nothing deferred.
// And the whole file under the source key: a hash of the game's code the bundle was built from (engine-bundle.mjs
// defines __HIRAETH_SOURCE_KEY__; scripts/bake-worlds.mjs writes the same key), so a bundle updated over the air past
// its bake ignores it.
//
// The file (`bake/<world>.bin` among the public files: StreamingAssets/hiraeth-js/public/bake in a Unity build):
//   'HBK1', u32 header length, the header (JSON), padding to 8, then the blobs the header points at ([offset, length]).
// ---------------------------------------------------------------------------

export const BAKE_VERSION = 1;
/** The code's key the bundle was built with, or null outside a bundle (no bake is ever used then). */
export const SOURCE_KEY = typeof __HIRAETH_SOURCE_KEY__ !== 'undefined' ? __HIRAETH_SOURCE_KEY__ : null;

/** 64 bits of FNV-1a (two 32-bit lanes) over a typed array's bytes, as 16 hex digits. */
export function hashBytes(view, h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995) {
  const n4 = view.byteLength >> 2;
  const u32 = new Uint32Array(view.buffer, view.byteOffset, n4);
  for (let i = 0; i < n4; i++) {
    const w = u32[i];
    h1 = Math.imul(h1 ^ w, 0x01000193);
    h2 = Math.imul(h2 ^ ((w << 13) | (w >>> 19)), 0x5bd1e995);
    h2 ^= h2 >>> 15;
  }
  const tail = new Uint8Array(view.buffer, view.byteOffset + n4 * 4, view.byteLength - n4 * 4);
  for (const b of tail) { h1 = Math.imul(h1 ^ b, 0x01000193); h2 = Math.imul(h2 ^ b, 0x5bd1e995); }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}
// (the crowd's spots to a micrometre: the engines' V8 and node's differ in the last bits of a sine, issue #385)
const near = (k, v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : v);
/**
 * A float array's fingerprint: its length and its components' sums (and sums of squares) by lane, to 9 figures. Not a
 * hash of its bits: the engines' V8 and node's differ in the last bits of a sine (Puerts' V8 is built with libm's
 * trigonometry, node's with fdlibm), so the same world generated in each has its floats a few ulps apart. Whatever the
 * save or the code changes moves something by far more than that (and the code is the source key's).
 */
export function fingerprint(a, lanes = 3) {
  const s = new Float64Array(lanes * 2);
  for (let i = 0; i < a.length; i++) { const v = a[i], k = (i % lanes) * 2; s[k] += v; s[k + 1] += v * v; }
  return `${a.length}:${Array.from(s, (v) => (Math.abs(v) < 1e-6 ? '0' : v.toPrecision(9))).join(',')}`;
}
/** m the baked BVH's boxes are widened by: a few float32 ulps at the worlds' sizes, so the floats' last bits never matter. */
export const BVH_SLACK = 0.01;
const widen = (root, by) => { const f = new Float32Array(root); for (let i = 0; i < f.length; i += 8) { f[i] -= by; f[i + 1] -= by; f[i + 2] -= by; f[i + 3] += by; f[i + 4] += by; f[i + 5] += by; } return root; };
const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
/** The hash of a string. */
export function hashText(s) {
  if (enc) return hashBytes(enc.encode(s));
  const a = new Uint16Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return hashBytes(a);
}

/**
 * The collision's content key: its level triangles' hash (kept on it) and every collider added since (its kind, its
 * triangles and where its box is now). Queries answer the same for the same key.
 */
export function collisionKey(physics) {
  const extras = (physics.extras ?? []).map((e) => [e.moving ? 1 : 0, e.triangles ?? 0, ...(e.box ? [...e.box.min.toArray(), ...e.box.max.toArray()].map((v) => Math.round(v * 1e4)) : [])].join(','));
  const late = physics.late?.extras?.length ?? 0;
  return `${physics.levelHash ?? '-'}|${extras.join(';')}|${late}`;
}

/** Read a bake file: { header, buf, blob(name or [off, len]) }, or null (no file, not a bake, another version). */
export function readBake(buf) {
  if (!buf || buf.byteLength < 8) return null;
  const u8 = new Uint8Array(buf);
  if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'HBK1') return null;
  const len = new DataView(buf).getUint32(4, true);
  let json = '';
  for (let i = 0; i < len; i++) json += String.fromCharCode(u8[8 + i]);
  const header = JSON.parse(decodeURIComponent(escape(json)));
  if (header.v !== BAKE_VERSION) return null;
  const base = (8 + len + 7) & ~7;
  // (a copy: the BVH keeps its roots as they are, three's attributes their arrays)
  const blob = ([off, n]) => buf.slice(base + off, base + off + n);
  return { header, buf, blob };
}

/** A bake being recorded: blobs added as they come, written once the load is done. */
class BakeWriter {
  constructor(world, source) { this.header = { v: BAKE_VERSION, world, source, bvhs: [], buried: {}, crowd: {} }; this.blobs = []; this.size = 0; }
  put(bytes) {
    const b = new Uint8Array(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength);
    const off = this.size;
    this.blobs.push(b);
    this.size += (b.byteLength + 7) & ~7;
    return [off, b.byteLength];
  }
  write() {
    const json = unescape(encodeURIComponent(JSON.stringify(this.header)));
    const base = (8 + json.length + 7) & ~7;
    const out = new Uint8Array(base + this.size);
    out.set([72, 66, 75, 49]);
    new DataView(out.buffer).setUint32(4, json.length, true);
    for (let i = 0; i < json.length; i++) out[8 + i] = json.charCodeAt(i);
    let at = base;
    for (const b of this.blobs) { out.set(b, at); at += (b.byteLength + 7) & ~7; }
    return out.buffer;
  }
}

const textBytes = (s) => { const t = unescape(encodeURIComponent(s)); const a = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) a[i] = t.charCodeAt(i); return a; };
const bytesText = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return decodeURIComponent(escape(s)); };
// (a ray's answer as JSON keeps: NaN and the infinities as strings)
const toJ = (v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v);
const fromJ = (v) => (v === 'NaN' ? NaN : v === 'Infinity' ? Infinity : v === '-Infinity' ? -Infinity : v);

/**
 * Bakes of one world under other saves (the desert's walking dunes: each visit's), as one file: every variant's BVH,
 * every check's answer under its own key (the same key twice holds the same answer).
 */
export function mergeBakes(bufs) {
  const files = bufs.map(readBake).filter(Boolean);
  if (!files.length) return null;
  const out = new BakeWriter(files[0].header.world, files[0].header.source);
  const copy = (f, at) => out.put(new Uint8Array(f.blob(at)));
  for (const f of files) {
    const H = f.header;
    if (H.world !== out.header.world || H.source !== out.header.source) throw new Error(`mergeBakes: ${H.world} (${H.source}) is not ${out.header.world} (${out.header.source})`);
    for (const b of H.bvhs) if (!out.header.bvhs.some((x) => x.key === b.key)) out.header.bvhs.push({ ...b, roots: b.roots.map((at) => copy(f, at)), index: b.index ? [...copy(f, b.index), b.index[2]] : null, indirect: b.indirect ? copy(f, b.indirect) : null });
    for (const [k, at] of Object.entries(H.buried)) out.header.buried[k] ??= copy(f, at);
    for (const [k, at] of Object.entries(H.crowd)) out.header.crowd[k] ??= copy(f, at);
  }
  return out.write();
}

/**
 * A world's bake for its load: `use` (a file read) answers from it, `record` writes one. `stats` says what it did.
 *   const bake = WorldBake.use(buffer, levelId) ?? null     (null: none, or not this code's)
 *   const physics = bake ? bake.physics(scene, base) : new Physics(scene, base);
 *   bake.begin(); … the level's init, the crowd, the flora … bake.end();
 */
export class WorldBake {
  static use(buf, world, log = () => {}) {
    const r = readBake(buf);
    if (!r) return null;
    if (!SOURCE_KEY || r.header.source !== SOURCE_KEY || r.header.world !== world) { log(`bake: ${r.header.world}'s of code ${r.header.source}, not ${world}'s of ${SOURCE_KEY}: generating`); return null; }
    return new WorldBake('use', world, r);
  }
  static record(world) { return new WorldBake('record', world, null); }
  constructor(mode, world, file) {
    this.mode = mode; this.world = world; this.file = file;
    this.out = mode === 'record' ? new BakeWriter(world, SOURCE_KEY) : null;
    this.stats = { bvh: null, buried: 0, buriedMissed: 0, crowd: null, ms: 0 };
  }

  /** The level's collision, its BVH from the bake when the triangles are the same, else built (and recorded). */
  physics(scene, base = null, o = {}) {
    const t0 = performance.now();
    const p = new Physics(scene, base, true, o);
    const pos = p.geometry.attributes.position?.array;
    p.levelHash = pos ? hashText(fingerprint(pos)) : 'empty';
    const baked = this.file?.header.bvhs ?? [], B = baked.find((b) => b.key === p.levelHash);
    if (pos && B) {
      p.bvh = MeshBVH.deserialize({ version: 1, roots: B.roots.map((at) => widen(this.file.blob(at), BVH_SLACK)), index: B.index ? new (B.index[2] === 2 ? Uint16Array : Uint32Array)(this.file.blob(B.index)) : null, indirectBuffer: B.indirect ? new Uint32Array(this.file.blob(B.indirect)) : null }, p.geometry, { ...p.bvhOptions, setIndex: true });
      this.stats.bvh = 'baked';
    } else {
      p.bvh = pos ? new MeshBVH(p.geometry, p.bvhOptions) : null;
      this.stats.bvh = baked.length ? `other triangles (${p.triangles} here, ${baked.map((b) => b.tris).join(' / ')} baked)` : 'built';
      if (this.out && p.bvh) {
        const s = MeshBVH.serialize(p.bvh, { cloneBuffers: false });
        this.out.header.bvhs.push({ key: p.levelHash, tris: p.triangles, roots: s.roots.map((r) => this.out.put(new Uint8Array(r))), index: s.index ? [...this.out.put(s.index), s.index.BYTES_PER_ELEMENT] : null, indirect: s.indirectBuffer ? this.out.put(s.indirectBuffer) : null });
      }
    }
    this.physicsRef = p;
    this.stats.ms += performance.now() - t0;
    return p;
  }

  /** From here on the buried-instance checks and the crowd ask the bake (or tell it). */
  begin() {
    const H = this.out?.header, F = this.file?.header;
    BURIED_MEMO.get = F ? (key) => { const at = F.buried[key]; if (!at) { this.stats.buriedMissed++; return null; } this.stats.buried++; return new Uint32Array(this.file.blob(at)); } : null;
    BURIED_MEMO.put = H ? (key, ids) => { H.buried[key] = this.out.put(Uint32Array.from(ids)); } : null;
    BURIED_MEMO.key = (physics) => collisionKey(physics);
    CROWD_MEMO.begin = (physics, inputs) => {
      let key, ik;
      try { ik = hashText(JSON.stringify(inputs, near)); key = hashText(collisionKey(physics) + '|' + ik); } catch { return null; }
      this.stats.crowdKey = ik;
      if (F) {
        const at = F.crowd[key];
        if (!at) { this.stats.crowd = `other inputs (${this.stats.crowdKey})`; return null; }
        const answers = JSON.parse(bytesText(this.file.blob(at)));
        let i = 0;
        this.stats.crowd = `${answers.length} answers`;
        return { replay: true, ask: (f) => (i < answers.length ? fromJ(answers[i++]) : f()), done: () => { if (i !== answers.length) this.stats.crowd += ` (${i} asked)`; } };
      }
      if (H) {
        const answers = [];
        return { replay: false, ask: (f) => { const v = f(); answers.push(toJ(v)); return v; }, done: () => { H.crowd[key] = this.out.put(textBytes(JSON.stringify(answers))); this.stats.crowd = `${answers.length} answers recorded (${this.stats.crowdKey})`; } };
      }
      return null;
    };
  }
  /** The checks back to asking nobody. */
  end() { WorldBake.end(); }
  static end() { BURIED_MEMO.get = BURIED_MEMO.put = BURIED_MEMO.key = null; CROWD_MEMO.begin = null; }

  /** The recorded bake's bytes. */
  write() { return this.out?.write() ?? null; }
}

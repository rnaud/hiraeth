import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { SkinLegs, bendFrame } from '../../characters/creature-legs.js';
import { RENDER_FRAME } from '../../render-frame.js';

// The machines' Tripo bodies (issue #800, family D: the crucible walker, the bell walker, the pearl roller), on the wood
// cutter's route (plans/woodcutter-tripo.js): a mesh cut into rigid parts by geometry, each part on its own bone, its
// vertices blended across each cut so a bent joint stays closed. Unlike the wood cutter's, these assets carry their
// weights (JOINTS_0 / WEIGHTS_0, the bone index the part's index in the foe's PARTS, written by its trial's prepare.mjs:
// references/enemy-redesign-2026-10-30/trials/<foe>-tripo/), so the build only stands the bones where the parts are and
// adds the model's own pieces (eyes, joints' balls, props) in the same skinned mesh: one draw for the body.
//
//   raw(hex)                        a colour's own channels (the vertex colours are the texture's bytes: no conversion)
//   rolesOf(src)                    each vertex's colour role (the nearest of the asset's palette), once a source
//   skinColours(src, roles, want)   a skin's colours over those roles (a world's look on the same body)
//   kitLegs({ plan, g, body, hipParent, legs })  the motion kit's legs fitted to the mesh's own (planLeg, their segments
//                                   hidden), the Rig, and SkinLegs' thigh / shin / foot bones in each leg's bend plane
//   RigidSkin                       the skinned mesh: the asset's arrays and weights, the model's own pieces appended
//                                   (rigid on a bone, a colour each); let go (each vertex its main bone) as it dies
//   boneBoxes(sm, bones)            each bone's box of its vertices: the body the blade meets, its bounds as it moves

const vec = (a) => new THREE.Vector3(...a);
export const raw = (hex) => { const h = parseInt(hex.slice(1), 16); return new THREE.Color((h >> 16) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255); };

const ROLES = new WeakMap();
/** Each vertex's colour role (an index in keys, the asset's palette's), worked out once a source. */
export function rolesOf(src) {
  const hit = ROLES.get(src.geometry); if (hit) return hit;
  const C = src.geometry.attributes.color, L = src.rig, keys = Object.keys(L.palette), ref = keys.map((k) => raw(L.palette[k])), role = new Uint8Array(C.count);
  for (let i = 0; i < C.count; i++) { const r = C.getX(i), g = C.getY(i), b = C.getZ(i); let best = 0, d = Infinity; ref.forEach((c, k) => { const e = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2; if (e < d) { d = e; best = k; } }); role[i] = best; }
  const out = { keys, role };
  ROLES.set(src.geometry, out);
  return out;
}
/** A skin's colours (want: { role: hex }) over the roles: Float32 RGB a vertex. */
export function skinColours(src, roles, want) {
  const n = roles.role.length, out = new Float32Array(n * 3), cols = roles.keys.map((k) => raw(want[k] ?? src.rig.palette[k]));
  for (let i = 0; i < n; i++) { const c = cols[roles.role[i]]; out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; }
  return out;
}

/**
 * The kit's legs on the mesh's own: legs [{ hip, knee, ankle, foot }] (the asset's landmarks, the model's frame), each a
 * planLeg (its segments' meshes taken out; `pole` its knees' side, else the plan's) and a thigh, shin and foot bone in its bend plane (SkinLegs). Returns
 * { legs, rig, bones: [{ thigh, shin, foot }], skinLegs, hide }.
 */
export function kitLegs({ plan, g, body, hipParent, legs: LM, seed, pole }) {
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  const G = LM.map((l) => ({ hip: vec(l.hip), knee: vec(l.knee), ankle: vec(l.ankle), foot: vec(l.foot) }));
  const legs = G.map((l, k) => {
    const leg = planLeg(plan, { group: g, body, hipParent, hip: { x: l.hip.x, y: l.hip.y, z: l.hip.z }, foot: { x: l.foot.x, z: l.foot.z }, lenA: l.hip.distanceTo(l.knee), lenB: l.knee.distanceTo(l.ankle), ankle: l.ankle.y, radius: 0.02, mats: { joint: hide }, name: `leg ${k}`, ...(pole ? { pole } : {}) });
    const gone = []; leg.root.traverse((o) => { if (o.isMesh) gone.push(o); }); for (const o of gone) { o.geometry.dispose(); o.removeFromParent(); }
    return leg;
  });
  const rig = new Rig({ plan, group: g, body, legs, ...(seed != null ? { seed } : {}) });
  const bones = legs.map((leg, k) => {
    const l = G[k];
    const mk = (name, at, dir) => { const b = new THREE.Bone(); b.name = `leg${k}_${name}`; b.position.copy(at); if (dir) bendFrame(dir, leg.pole, b.quaternion); g.add(b); return b; };
    return { thigh: mk('thigh', l.hip, l.knee.clone().sub(l.hip)), shin: mk('shin', l.knee, l.ankle.clone().sub(l.knee)), foot: mk('foot', l.ankle.clone().setY(l.ankle.y - leg.ankle), null) };
  });
  legs.forEach((leg, k) => { const l = G[k]; leg.root.position.copy(l.hip); leg.shin.position.copy(l.knee.clone().sub(l.hip)); leg.foot.position.copy(l.ankle.clone().sub(l.hip)).setY(l.ankle.y - leg.ankle - l.hip.y); });
  const skinLegs = new SkinLegs({ kit: { legs, rig }, bones: Object.assign({}, ...bones.map((b, k) => ({ [`leg${k}_thigh`]: b.thigh, [`leg${k}_shin`]: b.shin, [`leg${k}_foot`]: b.foot }))), group: g, body: hipParent });
  return { legs, rig, bones, skinLegs, hide };
}

/**
 * The body's one skinned mesh. src: the asset ({ geometry with skinIndex/skinWeight, rig }); colour: Float32 RGB a
 * vertex (a skin's) or null (the asset's own); keep(part) false leaves a part out (a skin's own piece in its place).
 * own(geo, obj, bone, rgb): one of the model's pieces, geo in obj's frame (its world matrix as the bones are bound),
 * rigid on bone index `bone`, in colour rgb (a THREE.Color) and at uv (a swatch). Then make(material, bones).
 */
export class RigidSkin {
  constructor(src, colour, keep = null) {
    const geo = src.geometry, L = src.rig, PARTS = L.partNames;
    this.pos = []; this.nor = []; this.uv = []; this.col = []; this.si = []; this.sw = []; this.idx = []; this.main = [];
    const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, C = geo.attributes.color, J = geo.attributes.skinIndex, W = geo.attributes.skinWeight, I = geo.index.array;
    const f = C.array instanceof Uint8Array && !C.normalized ? 1 / 255 : 1;   // (a normalized attribute reads 0–1 already)
    // (the parts kept: their triangles; their vertices copied once, renumbered)
    const tri = new Uint8Array(I.length / 3);
    for (const [name, [first, count]] of Object.entries(L.parts)) tri.fill(PARTS.indexOf(name), first, first + count);
    const map = new Int32Array(P.count).fill(-1);
    for (let t = 0; t < tri.length; t++) {
      if (keep && !keep(PARTS[tri[t]])) continue;
      for (let k = 0; k < 3; k++) {
        const i = I[t * 3 + k];
        if (map[i] < 0) {
          map[i] = this.main.length;
          this.pos.push(P.getX(i), P.getY(i), P.getZ(i)); this.nor.push(N.getX(i), N.getY(i), N.getZ(i)); this.uv.push(U.getX(i), U.getY(i));
          if (colour) this.col.push(colour[i * 3], colour[i * 3 + 1], colour[i * 3 + 2]); else this.col.push(C.getX(i) * f, C.getY(i) * f, C.getZ(i) * f);
          for (let q = 0; q < 4; q++) { this.si.push(J.getComponent(i, q)); this.sw.push(W.getComponent(i, q)); }
          // (its part's own bone, the part's index: each vertex is one part's, prepare.mjs copies a vertex two parts share)
          this.main.push(tri[t]);
        }
        this.idx.push(map[i]);
      }
    }
    this.asset = this.main.length;
  }
  own(geo, obj, bone, rgb, uv = [0, 0]) {
    const g2 = geo.index ? geo : geo.clone();
    obj.updateWorldMatrix(true, false);
    const m = obj.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(m), P = g2.attributes.position, N = g2.attributes.normal, v = new THREE.Vector3(), base = this.main.length;
    if (!N) g2.computeVertexNormals();
    const NN = g2.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(NN, i).applyMatrix3(nm).normalize(); this.nor.push(v.x, v.y, v.z);
      this.uv.push(uv[0], uv[1]); this.col.push(rgb.r, rgb.g, rgb.b);
      this.si.push(bone, 0, 0, 0); this.sw.push(1, 0, 0, 0); this.main.push(bone);
    }
    if (g2.index) for (const i of g2.index.array) this.idx.push(base + i); else for (let i = 0; i < P.count; i++) this.idx.push(base + i);
    if (g2 !== geo) g2.dispose();
    geo.dispose();
  }
  make(material, bones, name = 'tripo skin') {
    const g = new THREE.BufferGeometry(), n = this.main.length;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(Uint16Array.from(this.si), 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(this.sw), 4));
    g.setIndex(new THREE.BufferAttribute(n < 65536 ? Uint16Array.from(this.idx) : Uint32Array.from(this.idx), 1));
    const sm = new THREE.SkinnedMesh(g, material); sm.name = name; sm.frustumCulled = false;
    this.mesh = sm; this.bones = bones;
    return sm;
  }
  /** After the bones are posed at their rest and the mesh is in the model: bound, its bones' boxes measured. */
  bind() { this.mesh.updateMatrixWorld(true); this.mesh.bind(new THREE.Skeleton(this.bones)); boneBoxes(this.mesh, this.bones, this.main); }
  /** Going down: the cuts' blends let go, each vertex all its main bone's, so the parts come apart clean. */
  letGo() {
    if (this.loose) return; this.loose = true;
    // (its own copy first: the foes of one kind and skin draw one geometry, src/foe-shapes.js, and the others still stand)
    if (this.mesh.geometry.userData.foeShared) { const own = this.mesh.geometry.clone(); own.userData = {}; this.mesh.geometry = own; }
    const j = this.mesh.geometry.attributes.skinIndex, w = this.mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < this.main.length; i++) { j.setXYZW(i, this.main[i], 0, 0, 0); w.setXYZW(i, 1, 0, 0, 0); }
    j.needsUpdate = w.needsUpdate = true;
  }
}

/** Each bone's box of its vertices (the body the blade meets, src/foe-body.js; the pieces' sizes), as kit.js skinned. */
export function boneBoxes(sm, bones, main) {
  const local = bones.map(() => new THREE.Box3()), pos = sm.geometry.attributes.position, v = new THREE.Vector3();
  sm.updateMatrixWorld(true);
  for (let i = 0; i < pos.count; i++) { const b = main[i]; local[b].expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(sm.matrixWorld).applyMatrix4(sm.skeleton.boneInverses[b])); }
  sm.userData.boneBoxes = { bones, local };
  const box = new THREE.Box3(), sphere = new THREE.Sphere(), back = new THREE.Matrix4(), corner = new THREE.Vector3();
  const bounds = () => { sm.updateWorldMatrix(true, false); back.copy(sm.matrixWorld).invert(); box.makeEmpty();
    bones.forEach((b, i) => { const Lb = local[i]; if (Lb.isEmpty()) return; b.updateWorldMatrix(true, false); for (let k = 0; k < 8; k++) box.expandByPoint(corner.set(k & 1 ? Lb.max.x : Lb.min.x, k & 2 ? Lb.max.y : Lb.min.y, k & 4 ? Lb.max.z : Lb.min.z).applyMatrix4(b.matrixWorld).applyMatrix4(back)); });
    return box; };
  let at = -1;
  Object.defineProperty(sm, 'boundingBox', { configurable: true, get: bounds, set() {} });
  Object.defineProperty(sm, 'boundingSphere', { configurable: true, get: () => { if (RENDER_FRAME.on && at === RENDER_FRAME.n) return sphere; at = RENDER_FRAME.on ? RENDER_FRAME.n : -1; return bounds().getBoundingSphere(sphere); }, set() {} });
}

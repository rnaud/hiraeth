// The shadow QC's probes, in the page (.claude/skills/shadow-qc/run.mjs imports this file into the running game).
//  - casters(): every static mesh of the world, in world space, in one BVH (the truth's occluders)
//  - layProbes(): the Shadow Room's receiver patches (src/levels/shadow-room.js SHADOW_ROOM.receivers) cast onto the
//    surfaces: a probe is a point and its normal on what is drawn
//  - trace(): the truth for the sun's (quantised) direction: a ray from each probe to the sun, its first hit
//  - ProbeEval: the game's own shadow lookup (materials.js SHADOW_GLSL: the cascades, the tent filter, the
//    steepening, with the frame's maps, matrices, biases and offsets) evaluated at every probe on the GPU, one point
//    a probe, with whether the probe is on screen (against the G-buffer's depth) and its pixel's footprint
//  - the traveller: his bones as capsules (the truth of his shadow) and probes laid on the ground under his shadow
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { SHADOW_GLSL, sharedUniforms as SU } from '../../src/materials.js';
import { selfLitSkips } from '../../src/shadows.js';
import { edgeDistances, LIMITS } from './lib.mjs';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _ray = new THREE.Ray();

const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const under = (o, roots) => { for (let p = o; p; p = p.parent) if (roots.includes(p)) return true; return false; };

/**
 * The static occluders: every visible mesh that casts in the game's shadow passes (not self-lit, not the level's
 * noShadow, not skinned, not under `exclude`), instanced ones expanded, in world space, in one BVH.
 * Returns { bvh, meshOf (the mesh index of each triangle), meshes, tris }.
 */
export function casters(scene, { exclude = [], noShadow = [] } = {}) {
  scene.updateMatrixWorld(true);
  const parts = [], meshes = [], owner = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || !o.geometry?.attributes?.position || !shown(o) || under(o, exclude) || noShadow.includes(o)) return;
    if (selfLitSkips(o) || o.material?.colorWrite === false || o.material?.visible === false) return;
    const g = o.geometry, pos = g.attributes.position, idx = g.index;
    const n = idx ? idx.count : pos.count;
    if (n < 3) return;
    const mats = o.isInstancedMesh ? Array.from({ length: o.count }, (_, k) => { o.getMatrixAt(k, _m); return new THREE.Matrix4().multiplyMatrices(o.matrixWorld, _m); }) : [o.matrixWorld];
    const id = meshes.push(o) - 1;
    for (const M of mats) {
      const out = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { _v.fromBufferAttribute(pos, idx ? idx.getX(k) : k).applyMatrix4(M); out[3 * k] = _v.x; out[3 * k + 1] = _v.y; out[3 * k + 2] = _v.z; }
      parts.push(out); owner.push([id, n / 3]);
    }
  });
  const total = parts.reduce((s, p) => s + p.length, 0), all = new Float32Array(total);
  let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
  const meshOf = new Int32Array(total / 9);
  let t = 0; for (const [id, n] of owner) { meshOf.fill(id, t, t + n); t += n; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(all, 3));
  return { bvh: new MeshBVH(geometry), geometry, meshOf, meshes, tris: total / 9 };
}

/** A triangle's normal (world), by its index in the casters' geometry. */
function faceNormal(geo, f, out) {
  const p = geo.attributes.position.array, a = 9 * f;
  _v.set(p[a + 3] - p[a], p[a + 4] - p[a + 1], p[a + 5] - p[a + 2]);
  _w.set(p[a + 6] - p[a], p[a + 7] - p[a + 1], p[a + 8] - p[a + 2]);
  return out.crossVectors(_v, _w).normalize();
}

/**
 * The probes: each patch's grid of rays cast onto the casters' surfaces. Returns { N, pos, nor (Float32Array 3N),
 * spot (Int8Array: index into `spotIds`), spacing, patches: [{ nu, nv, step, cells: Int32Array (probe index or -1) }] }.
 */
export function layProbes(C, receivers, spotIds) {
  const pos = [], nor = [], spot = [], spacing = [], patches = [];
  const n = new THREE.Vector3(), from = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3(), d = new THREE.Vector3();
  for (const R of receivers) {
    from.fromArray(R.from); u.fromArray(R.u); v.fromArray(R.v); d.fromArray(R.dir).normalize();
    const cells = new Int32Array(R.nu * R.nv).fill(-1);
    for (let j = 0; j < R.nv; j++) for (let i = 0; i < R.nu; i++) {
      _ray.origin.copy(from).addScaledVector(u, i).addScaledVector(v, j); _ray.direction.copy(d);
      const hit = C.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, R.max);
      if (!hit) continue;
      faceNormal(C.geometry, hit.faceIndex, n);
      if (n.dot(d) > 0) n.negate();
      cells[j * R.nu + i] = pos.length / 3;
      pos.push(hit.point.x, hit.point.y, hit.point.z); nor.push(n.x, n.y, n.z);
      spot.push(spotIds.indexOf(R.spot)); spacing.push(R.step);
    }
    patches.push({ nu: R.nu, nv: R.nv, step: R.step, cells });
  }
  return { N: spot.length, pos: new Float32Array(pos), nor: new Float32Array(nor), spot: Int8Array.from(spot), spacing: Float32Array.from(spacing), patches };
}

/**
 * The truth for light direction `L` (towards the sun, the shadow maps' quantised one): per probe 1 shaded, 0 lit, -1
 * not judged (facing away or grazing under FACET_EDGE); reach (m to the occluder), hit (its point), the edge distance
 * per probe from its patch. Fills P.truth, P.reach, P.hit, P.edge.
 */
export function trace(P, C, L) {
  const truth = new Int8Array(P.N), reach = new Float32Array(P.N).fill(Infinity), hit = new Float32Array(3 * P.N);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.N; i++) {
    p.fromArray(P.pos, 3 * i); n.fromArray(P.nor, 3 * i);
    if (n.dot(L) < LIMITS.facet) { truth[i] = -1; continue; }
    _ray.origin.copy(p).addScaledVector(n, 0.004).addScaledVector(L, 0.002); _ray.direction.copy(L);
    const h = C.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, 3000);
    if (h) { truth[i] = 1; reach[i] = h.distance; hit[3 * i] = h.point.x; hit[3 * i + 1] = h.point.y; hit[3 * i + 2] = h.point.z; }
  }
  const edge = new Float32Array(P.N).fill(Infinity);
  for (const Q of P.patches) {
    const t = Array.from(Q.cells, (k) => (k < 0 ? null : truth[k])), ps = Array.from(Q.cells, (k) => (k < 0 ? [1e9, 1e9, 1e9] : [P.pos[3 * k], P.pos[3 * k + 1], P.pos[3 * k + 2]]));
    const d = edgeDistances(Q.nu, Q.nv, t, ps, Q.step);
    Q.cells.forEach((k, c) => { if (k >= 0) edge[k] = d[c]; });
  }
  Object.assign(P, { truth, reach, hit, edge, L: L.clone(), edgeAt: null, clearTo: null });
  return P;
}

/**
 * Is probe i further than `limit` m from every change of the truth round it, on its surface's plane? Rings of rays
 * (12 a ring) out to `limit`, stopping at the first that disagrees. A probe's patch grid can miss a shadow narrower
 * than its spacing (a fence's 2 cm bars between probes 6 cm apart); a probe judged wrong is asked this before it
 * counts. What each probe was found to be is kept (P.edgeAt, P.clearTo), so the rays are cast once.
 * Returns the distance to the edge found (≤ limit), or a distance over `limit` (clear that far).
 */
export function exactEdge(P, C, i, L, limit = 1.6) {
  P.edgeAt ??= new Float32Array(P.N).fill(Infinity);
  P.clearTo ??= new Float32Array(P.N);
  if (P.edgeAt[i] <= limit) return P.edgeAt[i];
  if (P.clearTo[i] > limit) return P.clearTo[i];
  const p = new THREE.Vector3().fromArray(P.pos, 3 * i), n = new THREE.Vector3().fromArray(P.nor, 3 * i);
  const t1 = new THREE.Vector3(Math.abs(n.y) < 0.9 ? 0 : 1, Math.abs(n.y) < 0.9 ? 1 : 0, 0).cross(n).normalize(), t2 = new THREE.Vector3().crossVectors(n, t1);
  const want = P.truth[i] === 1, s = P.spacing[i];
  const radii = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48].map((k) => k * s);
  for (const r of radii) {
    if (r <= P.clearTo[i]) continue;
    for (let a = 0; a < 12; a++) {
      const th = (a / 12) * Math.PI * 2 + r * 7.3;
      _ray.origin.copy(p).addScaledVector(t1, Math.cos(th) * r).addScaledVector(t2, Math.sin(th) * r).addScaledVector(n, 0.004).addScaledVector(L, 0.002);
      _ray.direction.copy(L);
      if (!!C.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, 3000) !== want) { P.edgeAt[i] = r; return r; }
    }
    P.clearTo[i] = r;
    if (r > limit) return r;
  }
  P.clearTo[i] = Infinity;
  return Infinity;
}

// ------------------------------------------------------------------ the traveller as capsules
/** His bones, joined as capsules (a, b, radius m): the truth of his shadow (a simple body, near enough). */
export const BODY = [
  ['pelvis', 'spine_03', 0.15], ['spine_03', 'Head', 0.13], ['Head', null, 0.12],
  ['upperarm_l', 'lowerarm_l', 0.055], ['lowerarm_l', 'hand_l', 0.045], ['upperarm_r', 'lowerarm_r', 0.055], ['lowerarm_r', 'hand_r', 0.045],
  ['thigh_l', 'calf_l', 0.08], ['calf_l', 'foot_l', 0.06], ['foot_l', 'ball_l', 0.045], ['thigh_r', 'calf_r', 0.08], ['calf_r', 'foot_r', 0.06], ['foot_r', 'ball_r', 0.045],
];

/** This frame's capsules: [{ a: Vector3, b: Vector3, r }] from the traveller's bones (none if he has none). */
export function bodyCapsules(player) {
  const B = player.humanoid?.b;
  if (!B) return [];
  const out = [];
  for (const [x, y, r] of BODY) {
    if (!B[x]) continue;
    const a = B[x].getWorldPosition(new THREE.Vector3());
    const b = y && B[y] ? B[y].getWorldPosition(new THREE.Vector3()) : a.clone().add(new THREE.Vector3(0, 0.1, 0));
    out.push({ a, b, r });
  }
  return out;
}

/**
 * His body as drawn this frame (every visible mesh under player.object, skinned as the GPU skins it), in world
 * space, in a BVH: the truth of his shadow. The BVH is built once and refitted every frame (a few ms); built again
 * when what he wears changes. Returns { bvh, tris } or null.
 */
export function bodyBVH(player) {
  player.object.updateMatrixWorld(true);
  const meshes = [];
  player.object.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position && shown(o) && o.material?.visible !== false && !selfLitSkips(o)) meshes.push(o); });
  if (!meshes.length) return null;
  const key = meshes.map((o) => `${o.id}:${o.geometry.id}`).join(',');
  let B = player.object.userData.__qcBody;
  if (!B || B.key !== key) {
    const n = meshes.reduce((s, o) => s + (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count), 0);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * n), 3));
    B = player.object.userData.__qcBody = { key, geometry, bvh: null, tris: n / 3, world: meshes.map((o) => new Float32Array(3 * o.geometry.attributes.position.count)) };
  }
  const out = B.geometry.attributes.position.array, M = new THREE.Matrix4();
  let w = 0;
  meshes.forEach((o, m) => {
    const g = o.geometry, pos = g.attributes.position.array, nv = g.attributes.position.count, world = B.world[m], idx = g.index?.array;
    if (o.isSkinnedMesh && o.skeleton) {
      // (as the vertex shader: bindMatrix, the bones' matrices by weight, bindMatrixInverse, then the world)
      const bm = o.skeleton.boneMatrices, si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array;
      const b = o.bindMatrix.elements;
      M.multiplyMatrices(o.matrixWorld, o.bindMatrixInverse);
      const e = M.elements;
      for (let k = 0; k < nv; k++) {
        const x0 = pos[3 * k], y0 = pos[3 * k + 1], z0 = pos[3 * k + 2];
        const x = b[0] * x0 + b[4] * y0 + b[8] * z0 + b[12], y = b[1] * x0 + b[5] * y0 + b[9] * z0 + b[13], z = b[2] * x0 + b[6] * y0 + b[10] * z0 + b[14];
        let ax = 0, ay = 0, az = 0;
        for (let j = 0; j < 4; j++) {
          const wt = sw[4 * k + j];
          if (!wt) continue;
          const q = 16 * si[4 * k + j];
          ax += wt * (bm[q] * x + bm[q + 4] * y + bm[q + 8] * z + bm[q + 12]);
          ay += wt * (bm[q + 1] * x + bm[q + 5] * y + bm[q + 9] * z + bm[q + 13]);
          az += wt * (bm[q + 2] * x + bm[q + 6] * y + bm[q + 10] * z + bm[q + 14]);
        }
        world[3 * k] = e[0] * ax + e[4] * ay + e[8] * az + e[12]; world[3 * k + 1] = e[1] * ax + e[5] * ay + e[9] * az + e[13]; world[3 * k + 2] = e[2] * ax + e[6] * ay + e[10] * az + e[14];
      }
    } else {
      const e = o.matrixWorld.elements;
      for (let k = 0; k < nv; k++) {
        const x = pos[3 * k], y = pos[3 * k + 1], z = pos[3 * k + 2];
        world[3 * k] = e[0] * x + e[4] * y + e[8] * z + e[12]; world[3 * k + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; world[3 * k + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      }
    }
    const n = idx ? idx.length : nv;
    for (let k = 0; k < n; k++, w += 3) { const j = 3 * (idx ? idx[k] : k); out[w] = world[j]; out[w + 1] = world[j + 1]; out[w + 2] = world[j + 2]; }
  });
  B.geometry.attributes.position.needsUpdate = true;
  if (!B.bvh) B.bvh = new MeshBVH(B.geometry); else B.bvh.refit();
  return B;
}

/** Does the ray (o, unit d, s ≥ 0) pass within r of the segment a–b? (closest points of a ray and a segment) */
export function rayHitsCapsule(o, d, a, b, r) {
  const u = _v.subVectors(b, a), w = _w.subVectors(o, a);
  const A = d.dot(d), B = d.dot(u), Cc = u.dot(u), D = d.dot(w), E = u.dot(w);
  const den = A * Cc - B * B;
  let s = den > 1e-9 ? (B * E - Cc * D) / den : 0, t;
  s = Math.max(0, s);
  t = Cc > 1e-9 ? THREE.MathUtils.clamp((B * s + E) / Cc, 0, 1) : 0;
  // (re-solve s for the clamped t)
  s = Math.max(0, (B * t - D) / A);
  const dx = w.x + d.x * s - u.x * t, dy = w.y + d.y * s - u.y * t, dz = w.z + d.z * s - u.z * t;
  return dx * dx + dy * dy + dz * dz < r * r;
}

/** Is the point p (on the ground) in his shadow (any capsule between it and the sun)? */
export const inBody = (caps, p, L) => caps.some((c) => rayHitsCapsule(p, L, c.a, c.b, c.r));

// ------------------------------------------------------------------ the GPU evaluator
const VS = /* glsl */ `
  precision highp float;
  in vec3 position; in vec3 normal; in float aIdx;
  uniform vec2 uRT;
  out vec3 vWp; out vec3 vN;
  void main() {
    vWp = position; vN = normal;
    float x = mod(aIdx, uRT.x), y = floor(aIdx / uRT.x);
    gl_Position = vec4((x + 0.5) / uRT.x * 2.0 - 1.0, (y + 0.5) / uRT.y * 2.0 - 1.0, 0.0, 1.0);
    gl_PointSize = 1.0;
  }`;
const FS = /* glsl */ `
  precision highp float;
  precision highp sampler2DShadow;
  uniform vec3 uSunDir;
  uniform highp sampler2DShadow uShadowMap; uniform mat4 uShadowMatrix; uniform float uShadowBias; uniform float uShadowNormalOffset;
  uniform highp sampler2DShadow uShadowMap0; uniform mat4 uShadowMatrix0; uniform float uShadowBias0; uniform float uShadowNormalOffset0;
  uniform highp sampler2DShadow uShadowMap2; uniform mat4 uShadowMatrix2; uniform float uShadowBias2; uniform float uShadowNormalOffset2;
  uniform vec3 uShadowTexel; uniform float uShadowTaps; uniform float uShadowHero;
  uniform mat4 uView; uniform mat4 uProj; uniform vec3 uCam; uniform float uPxAngle;
  uniform sampler2D tNormal;
  in vec3 vWp; in vec3 vN;
  layout(location = 0) out highp vec4 o0;
  layout(location = 1) out highp vec4 o1;
  layout(location = 2) out highp vec4 o2;
  ${SHADOW_GLSL}
  void main() {
    vec3 n = normalize(vN);
    float ndl = dot(n, uSunDir);
    vec4 v = uView * vec4(vWp, 1.0);
    float vd = -v.z;
    vec4 c = uProj * v;
    float vis = 0.0;
    if (c.w > 0.0) {
      vec2 ndc = c.xy / c.w;
      if (abs(ndc.x) < 1.0 && abs(ndc.y) < 1.0) {
        vec4 g = texture(tNormal, ndc * 0.5 + 0.5);
        if (g.w > 0.0 && abs(g.w - vd) < 0.04 + 0.012 * vd) vis = 1.0;
      }
    }
    // the pixel's footprint on the surface (materials.js shadowPx: the larger of the screen derivatives of the position)
    float px = max(vd, 0.01) * uPxAngle / max(abs(dot(n, normalize(uCam - vWp))), 0.05);
    float sh = ndl > 0.0 ? getShadow(vWp, n, ndl, px, 1.0) : 0.0;
    float sinL = sqrt(max(1.0 - ndl * ndl, 0.0));
    vec3 spread = clamp(vec3(px) / uShadowTexel, 1.0, 2.5);
    float iF, i0, i1;
    float sF = sampleShadow(uShadowMap0, uShadowMatrix0, vWp, n, sinL, uShadowNormalOffset0, uShadowBias0, spread.x, iF);
    float s0 = sampleShadow(uShadowMap, uShadowMatrix, vWp, n, sinL, uShadowNormalOffset, uShadowBias, spread.y, i0);
    float s1 = sampleShadow(uShadowMap2, uShadowMatrix2, vWp, n, sinL, uShadowNormalOffset2, uShadowBias2, spread.z, i1);
    o0 = vec4(sh, vis, px, vd);
    o1 = vec4(sF, s0, s1, ndl);
    o2 = vec4(iF, i0, i1, 0.0);
  }`;

/**
 * The game's shadow lookup at N fixed probes plus K moving ones (the traveller's: setDynamic), every frame. The fixed
 * ones are drawn and read back by spot, only the spots asked for (read's `active`: those near the camera), each spot
 * on whole rows of the target. read() returns { sh, vis, px, vd, sF, s0, s1, ndl, iF, i0, i1 } (Float32Arrays of
 * N + K; a spot not read has vis 0).
 */
export class ProbeEval {
  constructor(renderer, P, K = 0) {
    this.renderer = renderer; this.N = P.N; this.K = K;
    const W = 512;
    // the spots' ranges of probes (layProbes keeps a spot's patches together), each from a whole row
    const ranges = [];
    for (let i = 0; i < P.N; i++) { const s = P.spot[i]; if (!ranges[s]) ranges[s] = [i, i + 1]; else ranges[s][1] = i + 1; }
    let row = 0;
    this.parts = [];
    const U = {
      uSunDir: SU.uSunDir, uShadowMap: SU.uShadowMap, uShadowMatrix: SU.uShadowMatrix, uShadowBias: SU.uShadowBias, uShadowNormalOffset: SU.uShadowNormalOffset,
      uShadowMap0: SU.uShadowMap0, uShadowMatrix0: SU.uShadowMatrix0, uShadowBias0: SU.uShadowBias0, uShadowNormalOffset0: SU.uShadowNormalOffset0,
      uShadowMap2: SU.uShadowMap2, uShadowMatrix2: SU.uShadowMatrix2, uShadowBias2: SU.uShadowBias2, uShadowNormalOffset2: SU.uShadowNormalOffset2,
      uShadowTexel: SU.uShadowTexel, uShadowTaps: SU.uShadowTaps, uShadowHero: SU.uShadowHero ?? { value: 0 },
      uView: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() }, uPxAngle: { value: 0.001 },
      tNormal: { value: null }, uRT: { value: new THREE.Vector2(W, 1) },
    };
    this.U = U;
    this.material = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VS, fragmentShader: FS, uniforms: U, depthTest: false, depthWrite: false });
    this.scene = new THREE.Scene();
    const part = (spot, start, n, pos, nor) => {
      const idx = new Float32Array(n);
      for (let i = 0; i < n; i++) idx[i] = row * W + i;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('aIdx', new THREE.BufferAttribute(idx, 1));
      const pts = new THREE.Points(g, this.material);
      pts.frustumCulled = false;
      this.scene.add(pts);
      const rows = Math.ceil(n / W), q = { spot, start, n, row, rows, pts, buf: [0, 1, 2].map(() => new Float32Array(rows * W * 4)) };
      row += rows;
      this.parts.push(q);
      return q;
    };
    ranges.forEach((r, s) => { if (r) part(s, r[0], r[1] - r[0], P.pos.slice(3 * r[0], 3 * r[1]), P.nor.slice(3 * r[0], 3 * r[1])); });
    if (K) { const nor = new Float32Array(3 * K); for (let i = 0; i < K; i++) nor[3 * i + 1] = 1; this.dyn = part(-1, P.N, K, new Float32Array(3 * K), nor); }
    this.H = row; this.W = W; U.uRT.value.set(W, row);
    this.rt = new THREE.WebGLRenderTarget(W, row, { count: 3, type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const T = P.N + K;
    this.out = Object.fromEntries(['sh', 'vis', 'px', 'vd', 'sF', 's0', 's1', 'ndl', 'iF', 'i0', 'i1'].map((k) => [k, new Float32Array(T)]));
  }

  /** The K moving probes this frame (positions and normals, 3K each). */
  setDynamic(pos, nor) {
    const g = this.dyn.pts.geometry, a = g.attributes.position, b = g.attributes.normal;
    a.array.set(pos); b.array.set(nor);
    a.needsUpdate = b.needsUpdate = true;
  }

  /** This frame's lookups at the spots in `active` (a Set of spot indices; all when null) and the moving probes. */
  read(camera, tNormal, pxAngle, active = null) {
    const r = this.renderer, U = this.U;
    camera.updateMatrixWorld();
    U.uView.value.copy(camera.matrixWorldInverse); U.uProj.value.copy(camera.projectionMatrix);
    camera.getWorldPosition(U.uCam.value); U.uPxAngle.value = pxAngle; U.tNormal.value = tNormal;
    const on = (q) => q.spot < 0 || !active || active.has(q.spot);
    for (const q of this.parts) q.pts.visible = on(q);
    const prev = r.getRenderTarget(), auto = r.autoClear, cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
    try {
      r.setRenderTarget(this.rt); r.setClearColor(0x000000, 0); r.clear(); r.autoClear = false;
      r.render(this.scene, this.cam);
      for (const q of this.parts) if (on(q)) for (let k = 0; k < 3; k++) r.readRenderTargetPixels(this.rt, 0, q.row, this.W, q.rows, q.buf[k], undefined, k);
    } finally { r.setRenderTarget(prev); r.autoClear = auto; r.setClearColor(cc, ca); }
    const o = this.out;
    for (const q of this.parts) {
      if (!on(q)) { o.vis.fill(0, q.start, q.start + q.n); continue; }
      const [b0, b1, b2] = q.buf;
      for (let j = 0; j < q.n; j++) {
        const i = q.start + j, x = 4 * j;
        o.sh[i] = b0[x]; o.vis[i] = b0[x + 1]; o.px[i] = b0[x + 2]; o.vd[i] = b0[x + 3];
        o.sF[i] = b1[x]; o.s0[i] = b1[x + 1]; o.s1[i] = b1[x + 2]; o.ndl[i] = b1[x + 3];
        o.iF[i] = b2[x]; o.i0[i] = b2[x + 1]; o.i1[i] = b2[x + 2];
      }
    }
    return o;
  }

  dispose() { this.rt.dispose(); for (const q of this.parts) q.pts.geometry.dispose(); this.material.dispose(); }
}

// ------------------------------------------------------------------ the traveller's ground probes
/**
 * Probes on the ground under his shadow: a grid `across` × `along` laid along the shadow's direction from his feet
 * (from 0.5 m behind him to the shadow's tip and 0.5 m past it), and a line of `line` probes from each foot along it
 * at 1.5 cm. ground(x, y, z) gives the floor's height under a point. Returns { pos, nor, w, n, feet: [[start, count,
 * contact Vector3]...], grid } for this frame.
 */
export function charProbes(player, L, ground, { across = 36, along = 90, line = 40, width = 1.4 } = {}) {
  const K = across * along + 2 * line, pos = new Float32Array(3 * K), nor = new Float32Array(3 * K), w = new Float32Array(K);
  const g = new THREE.Vector3(-L.x, 0, -L.z);
  if (g.lengthSq() < 1e-6) g.set(0, 0, 1); g.normalize();
  const side = new THREE.Vector3(-g.z, 0, g.x);
  const tanEl = Math.max(0.08, L.y / Math.hypot(L.x, L.z));
  const len = Math.min(10, 2 / tanEl) + 1, o = player.pos;
  const dA = len / along, dS = width / across;
  let k = 0;
  for (let j = 0; j < along; j++) for (let i = 0; i < across; i++, k++) {
    const a = -0.5 + (j + 0.5) * dA, s = (i + 0.5) * dS - width / 2;
    const x = o.x + g.x * a + side.x * s, z = o.z + g.z * a + side.z * s;
    pos[3 * k] = x; pos[3 * k + 1] = ground(x, o.y, z) + 0.002; pos[3 * k + 2] = z; nor[3 * k + 1] = 1; w[k] = dA * dS;
  }
  const feet = [];
  const B = player.humanoid?.b;
  for (const f of ['l', 'r']) {
    const start = k;
    const a = B?.[`foot_${f}`]?.getWorldPosition(new THREE.Vector3()), b = B?.[`ball_${f}`]?.getWorldPosition(new THREE.Vector3());
    const c = a && b ? a.clone().lerp(b, 0.5) : o.clone();
    const gy = ground(c.x, c.y, c.z);
    const planted = b ? b.y - gy < 0.06 : false;
    for (let m = 0; m < line; m++, k++) {
      const x = c.x + g.x * m * 0.015, z = c.z + g.z * m * 0.015;
      pos[3 * k] = x; pos[3 * k + 1] = ground(x, c.y, z) + 0.002; pos[3 * k + 2] = z; nor[3 * k + 1] = 1;
    }
    feet.push({ start, count: line, planted, contact: new THREE.Vector3(c.x, gy, c.z) });
  }
  return { pos, nor, w, K, feet, grid: across * along };
}

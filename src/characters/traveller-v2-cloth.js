// The v2 traveller's overshirt as cloth (issue #493): the default clothes' Shirt (B3's own surface, cut) hangs from his
// chest and swings behind him at a jog or a sprint, as B3's does. The same solver as B3's (tripo-cloth.js: a 33 × 15
// cage of particles round his hips, pinned at the chest, stepped at 90 Hz in a worker, tripo-cloth-sim.js) and the same
// vertex shader (garmentShader): each shirt vertex below the chest is the rest shape carried by spine_02 plus its cage
// cell's displacement, by its freedom (0 at 1.20 m, 1 18 cm lower), so its folds, collar and hems ride along. B3 built
// the cage on its own body's mesh at load; here it is built on the joined clothes draw (outfits.js dress), whose other
// garments, the tee, the trousers, the boots and the scarf, keep a freedom of 0: skinned as before, one draw still.
// The thigh-lift keys (pass 5) stay on: the shader carries the shape with its keys applied (`morphRest`), and the
// cage's leg capsules push the hem out as B3's do. Its shadow is drawn the same shape (garmentDepthMaterial).
// Web only: an engine that takes the cloth over (CLOTH_HOST.offload, Unity's Burst job) gets none here, the shirt
// stays skinned there (characters/traveller-v2.js).
import * as T from 'three';
import { CAP, CLOTH_STEP, setCap, simulate } from './tripo-cloth-sim.js';
import { garmentShader, garmentDepthMaterial, GARMENT_CAPS } from './tripo-cloth.js';

/** B3's own fit (traveller-b3.js): the shirt is B3's surface, so the cage is B3's. maxX: wider than this is a sleeve. */
export const V2_CLOTH = {
  garment: 'Shirt', top: 1.20, bottom: 0.825, freeHeight: 0.18, maxX: 0.25,
  width: [0.20, 0.22], depth: [0.13, 0.15], hipX: 0.105, kneeX: 0.115, legZ: -0.015, thighRadius: 0.108,
  cols: 32, rows: 14,
};
const START = 0.40, END = Math.PI * 2 - START;
const angleOf = (x, z) => { const a = Math.atan2(x, z + 0.016); return a < 0 ? a + Math.PI * 2 : a; };
const smooth = T.MathUtils.smoothstep, clamp = T.MathUtils.clamp;

/** Each vertex's freedom (0 skinned, 1 the cage's alone): the garment's verts below `top`, narrower than maxX. */
export function clothFreedom(position, [start, count], fit = V2_CLOTH) {
  const free = new Float32Array(position.count);
  for (let i = start; i < start + count; i++) {
    if (Math.abs(position.getX(i)) >= fit.maxX) continue;
    free[i] = smooth(fit.top - position.getY(i), 0, fit.freeHeight);
  }
  return free;
}

/**
 * The cloth on `mesh` (a SkinnedMesh bound to his skeleton: the joined clothes), `range` = [start, count] its
 * garment's verts. gpu: its material is patched (garmentShader) and the shader moves the verts (the game); without,
 * the cage alone is stepped (tests). Returns { update(dt, motion, enabled), shadow, dispose(), free, positions, rest,
 * targets, gpuState, threaded }.
 */
export function makeV2Cloth(mesh, range, { fit = V2_CLOTH, gpu = typeof window !== 'undefined', useWorker = typeof window !== 'undefined' && typeof Worker !== 'undefined' } = {}) {
  const COLS = fit.cols, ROWS = fit.rows, TOP = fit.top, BOTTOM = fit.bottom;
  const g = mesh.geometry, pos = g.attributes.position, index = g.index.array;
  const skeleton = mesh.skeleton, bones = skeleton.bones, bind = mesh.bindMatrix.clone(), bindInv = bind.clone().invert();
  const boneAt = (name) => { const i = bones.findIndex((b) => b.name === name); if (i < 0) throw new Error(`v2 cloth: no ${name}`); return i; };
  const [start, count] = range, inGarment = (i) => i >= start && i < start + count;
  const free = clothFreedom(pos, range, fit);
  const P = (i, v = new T.Vector3()) => v.fromBufferAttribute(pos, i);

  // the ring the cage hangs from: where the garment's edges cross `top`
  const section = [];
  for (let k = 0; k < index.length; k += 3) {
    const ids = [index[k], index[k + 1], index[k + 2]];
    if (!ids.every(inGarment)) continue;
    for (let d = 0; d < 3; d++) {
      const a = ids[d], b = ids[(d + 1) % 3], ya = pos.getY(a), yb = pos.getY(b);
      if ((ya - TOP) * (yb - TOP) >= 0) continue;
      const t = (TOP - ya) / (yb - ya), p = P(a).lerp(P(b), t);
      if (Math.abs(p.x) < fit.maxX) section.push({ p, a, b, t });
    }
  }
  if (!section.length) throw new Error('v2 cloth: the garment does not cross its top');
  const top = Array.from({ length: COLS + 1 }, (_, col) => {
    const theta = T.MathUtils.lerp(START, END, col / COLS);
    return section.reduce((best, s) => (Math.abs(angleOf(s.p.x, s.p.z) - theta) < Math.abs(angleOf(best.p.x, best.p.z) - theta) ? s : best));
  });

  // the cage at rest (B3's: an ellipse a row, tapering out to the hem, its top row on the ring) and its edges
  const id = (row, col) => row * (COLS + 1) + col;
  const rest = [], pins = [], edges = [];
  for (let row = 0; row <= ROWS; row++) for (let col = 0; col <= COLS; col++) {
    const theta = T.MathUtils.lerp(START, END, col / COLS), y = T.MathUtils.lerp(TOP + 0.025, BOTTOM, row / ROWS), v = row / ROWS;
    const rx = T.MathUtils.lerp(fit.width[0], fit.width[1], v), rz = T.MathUtils.lerp(fit.depth[0], fit.depth[1], v);
    const radius = 1 / Math.sqrt((Math.sin(theta) / rx) ** 2 + (Math.cos(theta) / rz) ** 2);
    const p = row === 0 ? top[col].p.clone().add(new T.Vector3(0, 0.008, 0)) : new T.Vector3(Math.sin(theta) * radius, y, Math.cos(theta) * radius - 0.016);
    rest.push(p); pins.push(row === 0 ? 0 : 1);
  }
  const add = (a, b, k) => edges.push([a, b, rest[a].distanceTo(rest[b]), k]);
  for (let row = 0; row <= ROWS; row++) for (let col = 0; col <= COLS; col++) {
    if (col < COLS) add(id(row, col), id(row, col + 1), 1);
    if (row < ROWS) add(id(row, col), id(row + 1, col), 1);
    if (row < ROWS && col < COLS) { add(id(row, col), id(row + 1, col + 1), 0.7); add(id(row, col + 1), id(row + 1, col), 0.7); }
    if (row + 2 <= ROWS) add(id(row, col), id(row + 2, col), 0.7);
    if (col + 2 <= COLS) add(id(row, col), id(row, col + 2), 0.7);
  }
  const N = rest.length;

  // the attachment (spine_02) at bind: a rest point (the mesh's frame) into its frame is boneInverse · bindMatrix
  const att = boneAt('spine_02'), attachment = bones[att];
  const restToAttach = skeleton.boneInverses[att].clone().multiply(bind);
  const attachmentRest = rest.map((p) => p.clone().applyMatrix4(restToAttach));
  // a bone's place at bind, in the mesh's frame
  const restOf = (i) => new T.Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert()).applyMatrix4(bindInv);

  // the leg capsules (B3's: each thigh and shin, and the crotch's), carried by their bones
  const caps = [];
  const collider = (a, b, from, to, radius) => {
    const into = (k, p) => p.clone().applyMatrix4(bind).applyMatrix4(skeleton.boneInverses[k]);
    caps.push({ a: bones[a], b: bones[b], radius, from: new T.Vector3(), to: new T.Vector3(), localFrom: into(a, from), localTo: into(b, to) });
  };
  for (const side of ['l', 'r']) {
    const sign = side === 'l' ? 1 : -1, hip = boneAt('thigh_' + side), knee = boneAt('calf_' + side), foot = boneAt('foot_' + side);
    const h = restOf(hip).setX(sign * fit.hipX).setZ(fit.legZ), k = restOf(knee).setX(sign * fit.kneeX).setZ(fit.legZ);
    collider(hip, knee, h, k, fit.thighRadius);
    collider(knee, foot, k, restOf(foot), 0.085);
  }
  collider(boneAt('thigh_l'), boneAt('thigh_r'), new T.Vector3(0.065, 0.948, -0.012), new T.Vector3(-0.065, 0.948, -0.012), 0.096);
  if (caps.length > GARMENT_CAPS) throw new Error('v2 cloth: more leg capsules than the shader takes');

  // the solver's arrays (tripo-cloth-sim.js)
  const outwards = new Float64Array(N * 3);
  rest.forEach((p, i) => { const o = new T.Vector3(p.x, 0, p.z + 0.016).normalize(); outwards.set([o.x, o.y, o.z], i * 3); });
  const constants = { pins: Float64Array.from(pins), outwards, edgeA: Int32Array.from(edges, (e) => e[0]), edgeB: Int32Array.from(edges, (e) => e[1]), edgeLength: Float64Array.from(edges, (e) => e[2]), edgeK: Float64Array.from(edges, (e) => e[3]) };
  const sim = { ...constants, P: new Float64Array(N * 3), Q: new Float64Array(N * 3) }, G = new Float64Array(N * 3), simTarget = new Float64Array(N * 3);
  const simCaps = new Float64Array(caps.length * CAP);

  // the shader's inputs: each vertex's cell (its first particle, where in it, its freedom) and its outward direction
  let gpuState = null, shadow = null;
  if (gpu) {
    const cell = new Float32Array(pos.count * 4), outward = new Float32Array(pos.count * 3), p = new T.Vector3();
    for (let v = 0; v < pos.count; v++) {
      if (!(free[v] > 0)) continue;
      P(v, p);
      const u = clamp((angleOf(p.x, p.z) - START) / (END - START) * COLS, 0, COLS - 1e-6), w = clamp((TOP + 0.025 - p.y) / (TOP + 0.025 - BOTTOM) * ROWS, 0, ROWS - 1e-6);
      const c = Math.floor(u), r = Math.floor(w), o = new T.Vector3(p.x, 0, p.z + 0.016).normalize();
      cell.set([id(r, c), u - c, w - r, free[v]], v * 4);
      outward.set([o.x, o.y, o.z], v * 3);
    }
    g.setAttribute('aCage', new T.BufferAttribute(cell, 4));
    g.setAttribute('aOutward', new T.BufferAttribute(outward, 3));
    const tex = () => { const t = new T.DataTexture(new Float32Array(N * 4), N, 1, T.RGBAFormat, T.FloatType); t.minFilter = t.magFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };
    gpuState = { P: tex(), G: tex(), rigid: new T.Matrix4(), capA: Array.from({ length: GARMENT_CAPS }, () => new T.Vector4(0, 0, 0, 0)), capB: Array.from({ length: GARMENT_CAPS }, () => new T.Vector4(0, 0, 0, 1)) };
    garmentShader(mesh.material, COLS, { morphRest: true });
    // its shadow: the same shape (the shadow passes' one material would draw it skinned, unmoved)
    shadow = new T.SkinnedMesh(g, garmentDepthMaterial(COLS, { morphRest: true }));
    shadow.name = `${mesh.name} shadow`;
    shadow.bindMode = 'detached';
    shadow.bind(skeleton, mesh.bindMatrix);
    shadow.frustumCulled = false;
    shadow.matrixAutoUpdate = false;
    shadow.matrixWorldAutoUpdate = false;
    shadow.morphTargetInfluences = mesh.morphTargetInfluences;   // (one set of keys: the thigh lifts drawn in both)
    shadow.morphTargetDictionary = mesh.morphTargetDictionary;
    const lift = mesh.userData.thighLift;
    if (lift) shadow.onBeforeRender = () => lift.update();
  }

  // off the main thread where there are workers (tripo-cloth-worker.js: the same protocol as B3's)
  let worker = null, waiting = false, pendingSteps = 0, reset = true, requestId = 0;
  if (useWorker) {
    try {
      worker = new Worker(new URL('./tripo-cloth-worker.js', import.meta.url), { type: 'module' });
      worker.postMessage({ type: 'init', constants });
      worker.onmessage = ({ data }) => { waiting = false; if (data.id !== requestId) return; sim.P.set(data.P); simTarget.set(data.G); };
      worker.onerror = (e) => { console.warn('v2 cloth: the worker failed; simulating on the main thread', e.message ?? e); worker = null; waiting = false; initialized = false; };
    } catch { worker = null; }
  }

  // a point skinned with vertex v's weights (SkinnedMesh.applyBoneTransform's sums), into the mesh's frame
  const SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, boneSkin = bones.map(() => new T.Matrix4());
  const base = new T.Vector4(), toLocal = new T.Matrix4(), attachToLocal = new T.Matrix4();
  const skin = (v, p) => {
    base.set(p.x, p.y, p.z, 1).applyMatrix4(bind);
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) {
      const w = SW.getComponent(v, k);
      if (!w) continue;
      const e = boneSkin[SI.getComponent(v, k)].elements;
      x += (e[0] * base.x + e[4] * base.y + e[8] * base.z + e[12]) * w; y += (e[1] * base.x + e[5] * base.y + e[9] * base.z + e[13]) * w; z += (e[2] * base.x + e[6] * base.y + e[10] * base.z + e[14]) * w;
    }
    return p.set(x, y, z).applyMatrix4(toLocal);
  };
  const target = rest.map((p) => p.clone()), a = new T.Vector3(), b = new T.Vector3();
  let initialized = false, accumulator = 0, lastMotion = null;

  /** One frame: the targets from the pose, the cage stepped (dt) unless at rest, the shader's inputs written. */
  function update(dt, motion = 'game', enabled = true) {
    mesh.updateMatrixWorld();
    toLocal.copy(mesh.matrixWorld).invert();
    for (let k = 0; k < bones.length; k++) boneSkin[k].multiplyMatrices(bones[k].matrixWorld, skeleton.boneInverses[k]);
    attachToLocal.multiplyMatrices(toLocal, attachment.matrixWorld);
    for (let i = 0; i < N; i++) target[i].copy(attachmentRest[i]).applyMatrix4(attachToLocal);
    for (let i = 0; i <= COLS; i++) { const s = top[i]; target[i].copy(skin(s.a, a.copy(rest[i])).lerp(skin(s.b, b.copy(rest[i])), s.t)); }
    for (let i = 0; i < N; i++) { G[i * 3] = target[i].x; G[i * 3 + 1] = target[i].y; G[i * 3 + 2] = target[i].z; }
    caps.forEach((c, k) => {
      c.from.copy(c.localFrom).applyMatrix4(c.a.matrixWorld).applyMatrix4(toLocal);
      c.to.copy(c.localTo).applyMatrix4(c.b.matrixWorld).applyMatrix4(toLocal);
      setCap(simCaps, k, c.from, c.to, c.radius + 0.012);
    });
    const simulated = enabled && motion !== 'rest';
    if (!initialized || motion !== lastMotion || !simulated) {
      sim.P.set(G); sim.Q.set(G); simTarget.set(G);
      initialized = true; accumulator = 0; lastMotion = motion; reset = true; pendingSteps = 0; requestId++;
    }
    if (simulated) {
      accumulator += Math.min(dt, 0.05);
      let steps = 0;
      while (accumulator >= CLOTH_STEP) { accumulator -= CLOTH_STEP; steps++; }
      if (worker) {
        pendingSteps = Math.min(pendingSteps + steps, 9);
        if (!waiting && pendingSteps) {
          const msg = { type: 'step', id: ++requestId, G: G.slice(), caps: simCaps.slice(), steps: pendingSteps, reset: reset ? G.slice() : null };
          worker.postMessage(msg, [msg.G.buffer, msg.caps.buffer, ...(msg.reset ? [msg.reset.buffer] : [])]);
          waiting = true; pendingSteps = 0; reset = false;
        }
      } else if (steps) { simulate(sim, G, simCaps, steps); simTarget.set(G); }
    }
    if (gpuState) {
      const S = gpuState, tp = S.P.image.data, tg = S.G.image.data;
      for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) { tp[i * 4 + c] = sim.P[i * 3 + c]; tg[i * 4 + c] = simTarget[i * 3 + c]; }
      S.P.needsUpdate = S.G.needsUpdate = true;
      S.rigid.multiplyMatrices(attachToLocal, restToAttach);
      // (the shader's own push off the legs stays off, as B3's: detailCollisions false, its fused folds kept apart;
      // a capsule of radius 0, capA.w, is skipped)
      for (const m of [mesh.material, shadow.material]) {
        const u = m.uniforms;
        if (!u?.uClothP) continue;
        u.uClothP.value = S.P; u.uClothG.value = S.G; u.uGarmentRigid.value.copy(S.rigid); u.uGarmentSim.value = simulated ? 1 : 0;
        for (let k = 0; k < GARMENT_CAPS; k++) { u.uGarmentCapA.value[k].copy(S.capA[k]); u.uGarmentCapB.value[k].copy(S.capB[k]); }
      }
      shadow.matrixWorld.copy(mesh.matrixWorld);
      shadow.bindMatrixInverse.copy(mesh.bindMatrixInverse);
    }
    return { particles: N, simulated, threaded: !!worker };
  }

  /** How far each particle hangs off its target now (m): the swing (tests, the measuring pages). */
  const swing = () => { let max = 0, sum = 0; for (let i = (COLS + 1); i < N; i++) { const d = Math.hypot(sim.P[i * 3] - simTarget[i * 3], sim.P[i * 3 + 1] - simTarget[i * 3 + 1], sim.P[i * 3 + 2] - simTarget[i * 3 + 2]); max = Math.max(max, d); sum += d; } return { max, mean: sum / (N - COLS - 1) }; };
  const dispose = () => { worker?.terminate(); worker = null; if (shadow) shadow.material.dispose(); };
  return { update, swing, shadow, dispose, free, rest, caps, sim, simTarget, cols: COLS, get gpuState() { return gpuState; }, get threaded() { return !!worker; } };
}

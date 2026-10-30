import * as THREE from 'three';
import { Rig, planLeg } from '../../../../src/motion-kit/rig.js';
import { PLANS } from '../../../../src/motion-kit/plans.js';
import { materials, add, pivot, ease, eyeColor, finish, plate } from '../../../../src/enemies/plans/kit.js';
import { gazePart } from '../../../../src/enemies/gaze.js';
import { SkinLegs, bendFrame } from '../../../../src/characters/creature-legs.js';
import { RENDER_FRAME } from '../../../../src/render-frame.js';

// The shellback from Tripo (issue #800 phase 2a; a trial body, web only, behind the trial page): Tripo task
// 5f2aa15f-… from the approved image (the untouched export in the shellback folder's tripo/), made into the game
// asset by prepare.mjs (the game's frame and size, a flat 1024² texture, vertex colours, 12k triangles) and put on the
// crab's rig family here: the motion kit's walker plan, an alternating tripod, its legs fitted to the mesh's own
// (landmarks.json: each leg's hip, knee, ankle and foot, the claws' shoulder, hand and tip).
//
// No humanoid skeleton: a custom skin. Each leg's thigh, shin and foot are bones framed in the leg's bend plane
// (src/characters/creature-legs.js SkinLegs, the Keeper's route, #267: the kit's own segments solve, the bones follow
// without the half-turn flips of a straight-down shin); the dome, face, collar and belly ride the body; each claw an
// arm and a blade. Every vertex is weighted to its nearest part (a capsule round each segment; the body an ellipsoid
// under the dome), blended with the next over a few centimetres at the hips, knees, ankles and the claws' joints, so the
// fused mesh bends there instead of tearing. The dome is cut out as its own mesh on the body (a bomb cracks it off),
// its two front scutes copied off it as the armour that falls (Foes.dropPlate); two slit eyes over the painted ones
// (they go orange as it winds up). The claw has no moving finger (Tripo fused it): the snap swings the whole pincer.
//
// The crab in everything else: the same archetype, def, attacks, sounds, death recipe, lying body.

/** The roles of the flat texture's colours (prepare.mjs's k-means), by the reference's colour nearest each. */
const ROLES = { shell: '#e6a53f', leg: '#f3e08a', claw: '#c96834', collar: '#82aa73', dark: '#1f2f12' };
const BLEND = 0.05;   // m over which a vertex is shared by its two nearest parts

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
/** Distance from p to the segment a–b. */
const segDist = (p, a, b) => { _a.subVectors(b, a); const t = THREE.MathUtils.clamp(_v.subVectors(p, a).dot(_a) / Math.max(1e-9, _a.lengthSq()), 0, 1); return _v.copy(a).addScaledVector(_a, t).distanceTo(p); };
const vec = (a) => new THREE.Vector3(...a);

/**
 * The trial's source, loaded once (browser): { geometry, map, landmarks }. url: the trial folder's tripo-lod.glb.
 */
export async function loadTripoShellback(base) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const get = async (name) => { const r = await fetch(`${base}${name}`); if (!r.ok || /text\/html/.test(r.headers.get('content-type') ?? '')) throw new Error(`no ${base}${name} (${r.status})`); return r; };
  const [bytes, landmarks] = await Promise.all([get('tripo-lod.glb').then((r) => r.arrayBuffer()), get('landmarks.json').then((r) => r.json())]);
  const gltf = await new GLTFLoader().parseAsync(bytes, base);
  let mesh = null; gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const map = mesh.material.map; if (map) { map.colorSpace = THREE.NoColorSpace; map.flipY = false; map.needsUpdate = true; }   // (its texels are the printed colours the G-buffer takes)
  return { geometry: mesh.geometry, map, landmarks };
}

/** The colour role of each vertex (its COLOR_0, nearest of ROLES). */
function rolesOf(geo) {
  const C = geo.attributes.color, n = C.count, out = new Uint8Array(n), keys = Object.keys(ROLES), ref = keys.map((k) => new THREE.Color(ROLES[k]));
  for (let i = 0; i < n; i++) {
    const r = C.getX(i), g = C.getY(i), b = C.getZ(i); let best = 0, d = Infinity;
    ref.forEach((c, k) => { const e = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2; if (e < d) { d = e; best = k; } });
    out[i] = best;
  }
  return { out, keys };
}

const CACHE = new WeakMap();
/** The weights and splits of one source geometry (worked out once: every shellback shares them). */
function prepare(src, bones) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const geo = src.geometry, L = src.landmarks, P = geo.attributes.position, n = P.count;
  const { out: role, keys } = rolesOf(geo);
  const isDome = (i) => keys[role[i]] === 'shell' && P.getY(i) > L.legs[0].hip[1] + 0.1;
  // the parts' segments, in the group's frame (bone index: the order of `bones.list`)
  const segs = [];
  L.claws.forEach((c, k) => { segs.push({ b: bones.claw[k].arm, a: vec(c.shoulder), z: vec(c.hand), r: 0.1 }); segs.push({ b: bones.claw[k].blade, a: vec(c.hand), z: vec(c.tip), r: 0.15 }); });
  L.legs.forEach((l, k) => {
    segs.push({ b: bones.leg[k].thigh, a: vec(l.hip), z: vec(l.knee), r: 0.12 });
    segs.push({ b: bones.leg[k].shin, a: vec(l.knee), z: vec(l.ankle), r: 0.12 });
    segs.push({ b: bones.leg[k].foot, a: vec(l.ankle).setY(0.07), z: vec(l.foot).setY(0.05), r: 0.16, foot: true });
  });
  // the body: an ellipsoid under the dome, its sides at the hips
  const hipX = Math.abs(L.legs[0].hip[0]), cy = L.legs[0].hip[1] + 0.12, zs = L.legs.map((l) => l.hip[2]), cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const ex = hipX * 0.98, ey = 0.42, ez = (Math.max(...zs) - Math.min(...zs)) / 2 + 0.32;
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), p = new THREE.Vector3();
  const dome = [];
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i);
    const e = Math.hypot(p.x / ex, (p.y - cy) / ey, (p.z - cz) / ez);
    let best = { s: (e - 1) * ex, b: bones.body }, second = { s: Infinity, b: bones.body };
    for (const s of segs) {
      let d = segDist(p, s.a, s.z) - s.r;
      if (s.foot && p.y > 0.16) d += 1;   // (the foot only under the ankle)
      if (d < best.s) { second = best; best = { s: d, b: s.b }; } else if (d < second.s && s.b !== best.b) second = { s: d, b: s.b };
    }
    const w = second.b === best.b ? 1 : THREE.MathUtils.clamp(0.5 + (second.s - best.s) / (2 * BLEND), 0.5, 1);
    SI[i * 4] = best.b; SW[i * 4] = w; SI[i * 4 + 1] = second.b; SW[i * 4 + 1] = 1 - w;
    if (isDome(i)) dome.push(i);
  }
  // the triangles: the dome's (all three corners dome) to the dome's mesh, the rest skinned
  const I = geo.index.array, domeSet = new Uint8Array(n); for (const i of dome) domeSet[i] = 1;
  const domeTris = [], restTris = [];
  for (let t = 0; t < I.length; t += 3) (domeSet[I[t]] && domeSet[I[t + 1]] && domeSet[I[t + 2]] ? domeTris : restTris).push(I[t], I[t + 1], I[t + 2]);
  const out = { SI, SW, role, keys, domeTris, restTris, cy };
  CACHE.set(src.geometry, out);
  return out;
}

/** The colours of a skin over the mesh's roles (a world's own look on the same body): COLOR_0 recoloured. */
function skinColours(geo, prep, P) {
  const C = geo.attributes.color, n = C.count, out = new Float32Array(n * 3);
  const want = { shell: P.shell, leg: P.leg, claw: P.claw, collar: P.collar ?? P.joint, dark: P.dark };
  const cols = prep.keys.map((k) => new THREE.Color(want[k] ?? ROLES[k]));
  for (let i = 0; i < n; i++) { const c = cols[prep.role[i]]; out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; }
  return new THREE.BufferAttribute(out, 3);
}

/** A sub-geometry of `geo` with these triangles (its attributes shared, its own index). */
const subset = (geo, tris, attrs) => { const g = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(attrs)) g.setAttribute(k, a); g.setIndex(tris); return g; };

/** The trial body (the model contract of plans/index.js), from the loaded source (loadTripoShellback). */
export function tripoShellbackModel(skin, src) {
  const L = src.landmarks, home = skin.id === 'arzach2';
  const P = { ...skin.palette, ...(home ? { shell: '#e6a53f', leg: '#f3e08a', claw: '#c96834', collar: '#82aa73', dark: '#1f2f12', eye: '#1e1d24' } : {}) };
  const M = materials('crab', skin);
  const bodyY = L.legs[0].hip[1];
  const g = new THREE.Group(), body = pivot(g, 0, bodyY, 0, 'shell'); g.name = `${skin.name} · shellback (Tripo)`;
  const B = (o) => new THREE.Vector3(o[0], o[1] - bodyY, o[2]);   // (a landmark in the body's frame)
  // ---------------------------------------------------------------- the kit's legs on the mesh's own, their segments hidden
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  const legs = L.legs.map((l, k) => {
    const hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const along = ankle.clone().sub(hip), pole = knee.clone().sub(hip).addScaledVector(along, -knee.clone().sub(hip).dot(along) / along.lengthSq()).normalize();
    pole.y += 0.35; pole.normalize();   // (knees out and a little up: the walker's own)
    const leg = planLeg(PLANS.walker, { group: g, body, hip: B(l.hip), foot: { x: l.foot[0], z: l.foot[2] }, lenA: hip.distanceTo(knee), lenB: knee.distanceTo(ankle), pole, ankle: ankle.y, radius: 0.02, mats: { joint: hide }, name: `shellback leg ${k}` });
    const gone = []; leg.root.traverse((o) => { if (o.isMesh) gone.push(o); }); for (const o of gone) { o.geometry.dispose(); o.removeFromParent(); }
    return leg;
  });
  const rig = new Rig({ plan: PLANS.walker, group: g, body, legs });
  // ---------------------------------------------------------------- the bones: legs (group children, bend-plane framed), claws on the body
  const list = [body], index = (o) => { list.push(o); return list.length - 1; };
  const legBones = legs.map((leg, k) => {
    const l = L.legs[k], hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const mk = (name, at, dir) => { const b = new THREE.Bone(); b.name = `leg${k}_${name}`; b.position.copy(at); if (dir) bendFrame(dir, leg.pole, b.quaternion); g.add(b); return b; };
    const thigh = mk('thigh', hip, knee.clone().sub(hip)), shin = mk('shin', knee, ankle.clone().sub(knee)), foot = mk('foot', ankle.clone().setY(ankle.y - leg.ankle), null);
    return { thigh: index(thigh), shin: index(shin), foot: index(foot), objs: { [`leg${k}_thigh`]: thigh, [`leg${k}_shin`]: shin, [`leg${k}_foot`]: foot } };
  });
  const clawBones = L.claws.map((c) => {
    const shoulder = pivot(body, ...B(c.shoulder).toArray(), 'shoulder');
    const hand = pivot(shoulder, ...vec(c.hand).sub(vec(c.shoulder)).toArray(), 'claw');
    const tip = pivot(hand, ...vec(c.tip).sub(vec(c.hand)).toArray());
    return { arm: index(shoulder), blade: index(hand), shoulder, hand, tip };
  });
  // the rest pose (the bind's): the kit's segments at the landmarks, so SkinLegs measures its offsets there
  legs.forEach((leg, k) => { const l = L.legs[k]; leg.root.position.copy(vec(l.hip)); leg.shin.position.copy(vec(l.knee).sub(vec(l.hip))); leg.foot.position.copy(vec(l.ankle).sub(vec(l.hip))).setY(l.ankle[1] - leg.ankle - l.hip[1]); });
  const skinLegs = new SkinLegs({ kit: { legs, rig }, bones: Object.assign({}, ...legBones.map((x) => x.objs)), group: g, body });
  // ---------------------------------------------------------------- the meshes
  const prep = prepare(src, { body: 0, leg: legBones, claw: clawBones });
  const geo = src.geometry;
  const colour = home ? null : skinColours(geo, prep, P);
  const attrs = { position: geo.attributes.position, normal: geo.attributes.normal, uv: geo.attributes.uv, ...(colour ? { color: colour } : {}) };
  // (both sides drawn: Tripo's lip is an open sheet, its inside showed as holes under the rim)
  const skinM = M.mat(home ? 'sbTripo' : 'sbTripoTint', '#ffffff', { side: THREE.DoubleSide, ...(home ? { map: src.map } : { vertexColors: true }) });
  const domeM = home ? skinM : M.mat('sbTripoDome', '#ffffff', { side: THREE.DoubleSide, vertexColors: true });
  const restGeo = subset(geo, prep.restTris, { ...attrs, skinIndex: new THREE.BufferAttribute(prep.SI, 4), skinWeight: new THREE.BufferAttribute(prep.SW, 4) });
  const sm = new THREE.SkinnedMesh(restGeo, skinM); sm.name = 'tripo skin'; sm.frustumCulled = false; g.add(sm);
  // the dome: on the body (in its frame), its own mesh; its two front scutes copied off it, a little proud, the armour
  const domeGeo = subset(geo, prep.domeTris, attrs).toNonIndexed(); domeGeo.translate(0, -bodyY, 0);
  const shell = add(body, domeGeo, domeM); shell.name = 'dome';
  // (they wear the dome's own texture: unseen as plates until one is knocked off)
  const plateM = domeM;
  const DP = domeGeo.attributes.position, DN = domeGeo.attributes.normal, front = Math.max(...Array.from({ length: DP.count }, (_, i) => DP.getZ(i)));
  const plates = [1, -1].map((s) => {
    const pos = [], nor = [], uv = [], col = [], DU = domeGeo.attributes.uv, DC = domeGeo.attributes.color;
    for (let t = 0; t < DP.count; t += 3) {
      let ok = true; for (let k = 0; k < 3; k++) { const x = DP.getX(t + k), y = DP.getY(t + k), z = DP.getZ(t + k), a = Math.atan2(x, z); if (!(s * a > 0.08 && s * a < 1.45 && y > 0.32 && y < 0.62 && z > front - 0.9)) ok = false; }
      if (!ok) continue;
      for (let k = 0; k < 3; k++) { const j = t + k; pos.push(DP.getX(j) + DN.getX(j) * 0.006, DP.getY(j) + DN.getY(j) * 0.006, DP.getZ(j) + DN.getZ(j) * 0.006); nor.push(DN.getX(j), DN.getY(j), DN.getZ(j)); uv.push(DU.getX(j), DU.getY(j)); if (DC) col.push(DC.getX(j), DC.getY(j), DC.getZ(j)); }
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (col.length) pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return plate(body, pg, plateM, 0, 0, 0, `scute ${s > 0 ? 'left' : 'right'}`);
  });
  const meat = add(body, new THREE.SphereGeometry(0.66, 12, 6).scale(1, 0.34, 1.1), M.mat('meat', '#e08a70'), 0, 0.2, -0.2); meat.visible = false;
  // the eyes over the painted ones: two slits (its own material, they glow as it winds up)
  const eyeM = M.own('eye', P.eye, { glow: 0.35 });
  const eyeGeo = L.eyes.filter(Boolean).map((e) => new THREE.CapsuleGeometry(0.022, 0.07, 3, 8).scale(1, 1, 0.4).translate(e.at[0], e.at[1] - bodyY, e.at[2] + 0.035));
  const eyes = add(body, eyeGeo.length > 1 ? mergeTwo(eyeGeo) : eyeGeo[0], eyeM); eyes.name = 'eyes';
  const gaze = [gazePart(g, eyes, { slide: 0.02 })];
  const shellTop = pivot(body, 0, L.crown - bodyY + 0.05, -0.2);
  finish(g);
  g.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(list));
  boneBoxes(sm, list, prep);
  const parts = [shell, ...plates, ...clawBones.map((c) => c.shoulder), ...legs.map((l) => l.root)];
  let side = 0, sink = 0, spin = 0, flip = 0, clampK = 0;
  return {
    group: g, body, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.shell, P.leg, P.claw], gaze, plates,
    trial: 'tripo',
    tell: (id) => (id === 'snap' ? clawBones[1].tip : id === 'burrow' ? eyes : shellTop),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      const flipped = f.dying ? (f.dying.onBack ??= flip > Math.PI / 2) : f.flipped > 0;
      clampK = ease(clampK, f.guardK ?? 0, 12, dt);
      const tuck = Math.max(id === 'spin' ? (wind ? c.wind : strike ? 1 : 0) : 0, clampK);
      const scuttle = c.moving && f.state === 'chase' && f.dist > 3 ? 1 : 0;
      side = ease(side, scuttle * (f.home.x > 0 ? 1 : -1) * Math.PI / 2, 7, dt);
      g.rotation.y = f.heading + side;
      const buried = id === 'burrow' && wind ? c.wind : 0;
      sink = ease(sink, buried, buried > sink ? 6 : 10, dt);
      const o = rig.update({ pos: f.pos, heading: f.heading + side, state: f.state, k: f.k, atk: f.atk, stunned: f.stunned }, dt,
        { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery, air: flipped ? 1 : tuck > 0.02 ? 1 + tuck : sink > 0.05 ? 1 + sink * 0.6 : 0 });
      legs.forEach((l, k) => { l.air.set(0, flipped ? Math.sin(c.now / 60 + k) * 0.2 : 0, flipped ? Math.cos(c.now / 75 + k) * 0.14 : 0); });
      const snap = id === 'snap' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0;
      const chop = strike && id === 'snap' ? Math.sin(Math.min(1, c.release) * Math.PI) : 0;
      const limp = f.dying ? THREE.MathUtils.smoothstep(f.dying.u, 0.05, 0.45) : 0;
      clawBones.forEach((cl, i) => {
        const near = i === 1 ? snap : snap * 0.25, s = i ? -1 : 1;
        cl.shoulder.rotation.set(-near * 0.9 + chop * 0.35 - tuck * 0.3 + limp * 0.45, s * tuck * 0.45, -s * tuck * 0.2);
        cl.hand.rotation.set(-near * 0.6 + chop * 0.6 + tuck * 0.8 - limp * 0.35, 0, 0);
      });
      const rock = id === 'spin' && wind ? Math.sin(c.now / 70) * 0.08 * c.wind : 0;
      spin += dt * (strike && id === 'spin' ? 26 : tuck > 0 ? tuck * 4 : 0);
      flip = ease(flip, flipped ? Math.PI : 0, 12, dt);
      body.position.set(o.x, bodyY - tuck * 0.24 - clampK * 0.12 - sink * 0.6 + o.y, o.z);
      body.rotation.set(o.pitch - (id === 'spin' && wind ? 0.3 * c.wind : 0) + rock, tuck > 0.5 && strike ? spin : o.yaw, flip + o.roll);
      rig.write();
      skinLegs.write(f.heading + side, { air: flipped || tuck > 0.02 ? 1 : 0 });
      shell.visible = f.shelled; meat.visible = !f.shelled;
      for (const x of plates) if (!f.shelled) x.visible = false;
      if ((tuck > 0.5 && strike) || (buried > 0.3 && Math.random() < 0.5)) c.dust(f.pos, P.leg, 2);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
    },
    dispose() { M.dispose(); hide.dispose(); restGeo.dispose(); domeGeo.dispose(); for (const x of plates) x.geometry.dispose(); },
  };
}

function mergeTwo(geos) {
  const g = new THREE.BufferGeometry(), pos = [], nor = [], uv = [];
  for (const x of geos.map((a) => a.toNonIndexed())) { pos.push(...x.attributes.position.array); nor.push(...x.attributes.normal.array); uv.push(...x.attributes.uv.array); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Each bone's box of the vertices it carries most (the body the blade meets, src/foe-body.js; a gallery's frame), as kit.js skinned. */
function boneBoxes(sm, bones, prep) {
  const local = bones.map(() => new THREE.Box3()), pos = sm.geometry.attributes.position, idx = sm.geometry.index.array, v = new THREE.Vector3(), seen = new Uint8Array(pos.count);
  sm.updateMatrixWorld(true);
  for (const i of idx) { if (seen[i]) continue; seen[i] = 1; const b = prep.SI[i * 4]; local[b].expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(sm.matrixWorld).applyMatrix4(sm.skeleton.boneInverses[b])); }
  sm.userData.boneBoxes = { bones, local };
  const box = new THREE.Box3(), sphere = new THREE.Sphere(), back = new THREE.Matrix4(), corner = new THREE.Vector3();
  const bounds = () => { sm.updateWorldMatrix(true, false); back.copy(sm.matrixWorld).invert(); box.makeEmpty();
    bones.forEach((b, i) => { const Lb = local[i]; if (Lb.isEmpty()) return; b.updateWorldMatrix(true, false); for (let k = 0; k < 8; k++) box.expandByPoint(corner.set(k & 1 ? Lb.max.x : Lb.min.x, k & 2 ? Lb.max.y : Lb.min.y, k & 4 ? Lb.max.z : Lb.min.z).applyMatrix4(b.matrixWorld).applyMatrix4(back)); });
    return box; };
  let at = -1;
  Object.defineProperty(sm, 'boundingBox', { configurable: true, get: bounds, set() {} });
  Object.defineProperty(sm, 'boundingSphere', { configurable: true, get: () => { if (RENDER_FRAME.on && at === RENDER_FRAME.n) return sphere; at = RENDER_FRAME.on ? RENDER_FRAME.n : -1; return bounds().getBoundingSphere(sphere); }, set() {} });
}

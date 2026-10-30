import * as THREE from 'three';
import { Rig, planLeg } from '../../../../src/motion-kit/rig.js';
import { PLANS } from '../../../../src/motion-kit/plans.js';
import { materials, add, merged, pivot, pair, ease, eyeColor, finish, shade } from '../../../../src/enemies/plans/kit.js';
import { hornGeometries } from '../../../../src/enemies/plans/broad-hound.js';
import { gazePart } from '../../../../src/enemies/gaze.js';
import { SkinLegs, bendFrame } from '../../../../src/characters/creature-legs.js';
import { RENDER_FRAME } from '../../../../src/render-frame.js';

// The broad-pawed hound from Tripo (issue #800 phase 2b; a trial body, web only, behind the trial page): Tripo task
// 09f5de9e-… from the approved image, rigged by Tripo's quadruped rig (task 66154a67-…; the untouched exports in the
// hound folder's tripo/), made into the game asset by prepare.mjs (the game's frame and size, a flat 1024² texture,
// vertex colours, 12k triangles, Tripo's weights gathered onto the game's bones) and put on the hound's rig family
// here: the motion kit's quadruped plan, a trot on diagonal pairs, its legs fitted to the rig's own joints.
//
// No humanoid skeleton, and not Tripo's skeleton either (54 joints, its left hind leg twice over, stray tail
// branches): the game's bones carry Tripo's weights. Each leg's thigh, shin and foot are bones framed in the leg's bend
// plane (src/characters/creature-legs.js SkinLegs, the Keeper's route: the kit's own segments solve, the bones follow);
// the body, neck, head and four tail joints are pivots on the kit's body. Its eyes look at you (issue #508, the
// author's rule for every Tripo body): the head turns toward the traveller (gaze.js 'turn', the bone the head's
// vertices hang on is the gaze's own node), and two slit eyes of their own (they go orange as it winds up) sit over the
// painted ones on that bone. Its shadow form is kept: lying in wait, stepping behind you or phased it is a pool with
// its head and horns rising out of it. Tripo fused the jaw: the bite and the snarl are the head's.
//
// The author's cleanups when he picked it (2026-10-30): the reference's big cream ram's horns (Tripo's small crescents
// are taken off by prepare.mjs; these are swept here, from the landmarks' roots, into the same skinned mesh on the head's
// bone: no extra draw; a world's own horns, bleached thicker in the Mangrove, a tangle of wire in the Market), its
// worlds' props fitted to this body (the Mangrove's ink drips hanging off its chin, neck, chest and belly, in the skin
// on their bones; the Garden of Spheres' gold glints along the horns and its halo over them, on the head's gaze bone,
// one draw each, as the current hound's), and a little more leg (prepare.mjs: its chase steps at 5 Hz, not 5.9).
//
// The hound in everything else: the same archetype, def, attacks, sounds, death recipe, lying body.

/** The flat texture's colour roles: the coat's shades, the mauve saddle, the cream horns and muzzle. */
const ROLE = (hex) => { const c = new THREE.Color(hex); return c.r + c.g + c.b > 2 ? 'cream' : c.r > 0.35 ? 'patch' : 'coat'; };

/** The trial's source, loaded once (browser): { geometry, map, landmarks }. base: this folder's URL. */
export async function loadTripoHound(base) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const get = async (name) => { const r = await fetch(`${base}${name}`); if (!r.ok || /text\/html/.test(r.headers.get('content-type') ?? '')) throw new Error(`no ${base}${name} (${r.status})`); return r; };
  const [bytes, landmarks] = await Promise.all([get('tripo-lod.glb').then((r) => r.arrayBuffer()), get('landmarks.json').then((r) => r.json())]);
  const gltf = await new GLTFLoader().parseAsync(bytes, base);
  let mesh = null; gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const map = mesh.material.map; if (map) { map.colorSpace = THREE.NoColorSpace; map.flipY = false; map.needsUpdate = true; }
  return { geometry: mesh.geometry, map, landmarks };
}

/** A skin's colours over the mesh's roles (a world's own look on the same body): COLOR_0 recoloured, its shades kept. */
function skinColours(geo, P, palette) {
  const C = geo.attributes.color, n = C.count, out = new Float32Array(n * 3), c = new THREE.Color();
  const coats = palette.filter((h) => ROLE(h) === 'coat').map((h) => new THREE.Color(h)), mid = coats[Math.floor(coats.length / 2)];
  const lum = (x) => x.r + x.g + x.b;
  const want = { cream: new THREE.Color(P.antler), patch: new THREE.Color(P.patch) };
  for (let i = 0; i < n; i++) {
    c.setRGB(C.getX(i), C.getY(i), C.getZ(i));
    const role = ROLE(`#${c.getHexString()}`);
    const t = role === 'coat' ? new THREE.Color(P.ink).multiplyScalar(Math.min(1.6, lum(c) / Math.max(1e-3, lum(mid)))) : want[role];
    out[i * 3] = t.r; out[i * 3 + 1] = t.g; out[i * 3 + 2] = t.b;
  }
  return new THREE.BufferAttribute(out, 3);
}

const vec = (a) => new THREE.Vector3(...a);

/** A ram's horn on side s, from its root (offsets in the mesh frame, m, × k): up and back over the ear, round and down
 * behind it, the tip turning forward beneath (the reference's cream crescents, a C open to the front). */
export function hornPath(s, k = 1) {
  return [[-0.03, -0.02, 0.01], [0.04, 0.08, -0.03], [0.095, 0.135, -0.12], [0.125, 0.105, -0.21], [0.14, 0.01, -0.245], [0.15, -0.08, -0.2], [0.145, -0.12, -0.12], [0.13, -0.11, -0.05]]
    .map(([x, y, z]) => [s * x * k, y * k, z * k]);
}
/** A smooth tube swept along points, its radius radius(t) (t 0 at the first point, 1 at the last), the root capped. */
function sweep(points, radius, radial = 10, steps = 28) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => vec(p))), F = curve.computeFrenetFrames(steps, false);
  const pos = [], nor = [], idx = [], n = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const c = curve.getPointAt(i / steps), r = radius(i / steps);
    for (let j = 0; j < radial; j++) { const a = (j / radial) * Math.PI * 2; n.copy(F.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(F.binormals[i], Math.sin(a)); pos.push(c.x + n.x * r, c.y + n.y * r, c.z + n.z * r); nor.push(n.x, n.y, n.z); }
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + ((j + 1) % radial); idx.push(a, b, a + radial, b, b + radial, a + radial); }
  const c0 = curve.getPointAt(0), t0 = F.tangents[0], ci = pos.length / 3; pos.push(c0.x, c0.y, c0.z); nor.push(-t0.x, -t0.y, -t0.z);
  for (let j = 0; j < radial; j++) idx.push(ci, (j + 1) % radial, j);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}
/** The horns' size (× hornPath), root radius (thicker bleached) and tip radius. */
export const HORN = { k: 0.98, r: 0.054, bleached: 0.064, tip: 0.008 };
/** The horns of a skin's props, in the mesh frame: [geometry, …] (both sides). */
function hornShapes(L, props) {
  const out = [];
  for (const h of L.hornRoot) {
    const pts = hornPath(h.side, HORN.k).map(([x, y, z]) => [x + h.at[0], y + h.at[1], z + h.at[2]]);
    if (props.has('wire')) { for (let i = 0; i < 4; i++) out.push(sweep(pts.map(([x, y, z], j) => [x + h.side * (i - 1) * 0.014, y + Math.sin(j * 1.7 + i * 1.3) * 0.022, z + Math.cos(j * 1.3 + i) * 0.014]), () => 0.016, 6, 24)); continue; }
    const r0 = props.has('bleached') ? HORN.bleached : HORN.r;
    // (a crescent: full through its first third, swelling a little in the middle, then tapering to the tip)
    out.push(sweep(pts, (t) => THREE.MathUtils.lerp(r0, HORN.tip, THREE.MathUtils.smoothstep(t, 0.3, 1)) * (1 + 0.22 * Math.sin(Math.PI * t))));
  }
  return out;
}
/** The Mangrove's ink drips: [x, z, bone, length] under the chin, the neck, the chest and the belly. */
const DRIPS = [[0, 1.1, 'head', 0.12], [0.07, 0.8, 'neck', 0.15], [-0.07, 0.86, 'neck', 0.11], [0.12, 0.45, 'body', 0.2], [-0.1, 0.33, 'body', 0.16], [0.1, 0.05, 'body', 0.18], [-0.09, -0.12, 'body', 0.14], [0.08, -0.3, 'body', 0.12]];
/**
 * The source's skin dressed for a skin's props (cached on the source, a geometry a props set): the mesh with the horns
 * (on the head's bone, the cream's colour and texel) and the drips (on their bones, the darkest coat's) added.
 */
function dressed(src, props) {
  const key = `${props.has('wire') ? 'wire' : props.has('bleached') ? 'bleached' : 'horn'}${props.has('drips') ? '+drips' : ''}`;
  src.dressed ??= new Map();
  if (src.dressed.has(key)) return src.dressed.get(key);
  const L = src.landmarks, geo = src.geometry, bone = (n) => L.bones.indexOf(n);
  const cream = new THREE.Color(L.palette[L.palette.length - 1]), coat = new THREE.Color(L.palette[0]);
  // (each part: its geometry, its joints and weights, its colour and texel)
  const parts = hornShapes(L, props).map((g) => [g, { j: [bone('head'), 0, 0, 0], w: [1, 0, 0, 0] }, cream, L.creamUV]);
  if (props.has('drips')) {
    const P = geo.attributes.position, N = geo.attributes.normal, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
    for (const [x, z, b, len] of DRIPS) {
      // (hung from the underside there: the lowest downward-facing vertex of that part within 4 cm (the body's or a
      // thigh's under the trunk), the drop on that vertex's own weights, so it moves as the skin it hangs from)
      const ok = new Set(b === 'body' ? ['body', ...[0, 1, 2, 3].map((k) => `leg${k}_thigh`)].map(bone) : [bone(b)]);
      let a = -1; for (let i = 0; i < P.count; i++) if (ok.has(SI.getX(i)) && N.getY(i) < -0.4 && Math.abs(P.getX(i) - x) < 0.04 && Math.abs(P.getZ(i) - z) < 0.04 && (a < 0 || P.getY(i) < P.getY(a))) a = i;
      if (a < 0) continue;
      const w = { j: [SI.getX(a), SI.getY(a), SI.getZ(a), SI.getW(a)], w: [SW.getX(a), SW.getY(a), SW.getZ(a), SW.getW(a)] };
      parts.push([new THREE.ConeGeometry(0.022, len, 6).rotateX(Math.PI).translate(P.getX(a), P.getY(a) - len / 2 + 0.012, P.getZ(a)), w, coat, L.coatUV]);
    }
  }
  const n0 = geo.attributes.position.count, n = n0 + parts.reduce((s, [g]) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const A = geo.attributes;
  for (let i = 0; i < n0; i++) {
    pos.set([A.position.getX(i), A.position.getY(i), A.position.getZ(i)], i * 3); nor.set([A.normal.getX(i), A.normal.getY(i), A.normal.getZ(i)], i * 3);
    uv.set([A.uv.getX(i), A.uv.getY(i)], i * 2); col.set([A.color.getX(i), A.color.getY(i), A.color.getZ(i)], i * 3);
    si.set([A.skinIndex.getX(i), A.skinIndex.getY(i), A.skinIndex.getZ(i), A.skinIndex.getW(i)], i * 4); sw.set([A.skinWeight.getX(i), A.skinWeight.getY(i), A.skinWeight.getZ(i), A.skinWeight.getW(i)], i * 4);
  }
  const index = [...geo.index.array];
  let at = n0;
  for (const [g, b, c, t] of parts) {
    const gp = g.attributes.position, gn = g.attributes.normal;
    for (let i = 0; i < gp.count; i++) { const v = at + i; pos.set([gp.getX(i), gp.getY(i), gp.getZ(i)], v * 3); nor.set([gn.getX(i), gn.getY(i), gn.getZ(i)], v * 3); uv.set(t, v * 2); col.set([c.r, c.g, c.b], v * 3); si.set(b.j, v * 4); sw.set(b.w, v * 4); }
    if (g.index) for (const i of g.index.array) index.push(at + i); else for (let i = 0; i < gp.count; i++) index.push(at + i);
    at += gp.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); out.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  out.setIndex(new THREE.Uint32BufferAttribute(Uint32Array.from(index), 1));
  out.userData.added = n - n0;
  src.dressed.set(key, out);
  return out;
}

/** The trial body (the model contract of plans/index.js), from the loaded source (loadTripoHound, or node-source.mjs). */
export function tripoHoundModel(skin, src) {
  const L = src.landmarks, home = skin.id === 'eclipse', props = new Set(skin.props);
  const P = { ...skin.palette, ...(home ? { eye: '#f2e8c8' } : {}) };
  P.patch ??= P.smoke2 ?? P.smoke;
  const M = materials('hound', skin);
  const white = !props.has('glints');
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0, 'body'); g.name = `${skin.name} · broad hound (Tripo)`;
  // ---------------------------------------------------------------- the kit's legs on the rig's own, their segments hidden
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  const plan = PLANS.quadruped;
  const legs = L.legs.map((l, k) => {
    const hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const along = ankle.clone().sub(hip), pole = knee.clone().sub(hip).addScaledVector(along, -knee.clone().sub(hip).dot(along) / along.lengthSq()).normalize();
    // (the feet's homes made even, left and right: the mesh stands mid-stride)
    const pair2 = L.legs.find((m) => m.front === l.front && m !== l), fx = (Math.abs(l.foot[0]) + Math.abs(pair2.foot[0])) / 2 * l.side, fz = (l.foot[2] + pair2.foot[2]) / 2;
    const leg = planLeg(plan, { group: g, body, hip: vec(l.hip), foot: { x: fx, z: fz }, lenA: hip.distanceTo(knee), lenB: knee.distanceTo(ankle), pole, ankle: ankle.y, radius: 0.02, mats: { joint: hide }, name: `tripo hound leg ${k}` });
    const gone = []; leg.root.traverse((o) => { if (o.isMesh) gone.push(o); }); for (const o of gone) { o.geometry.dispose(); o.removeFromParent(); }
    return leg;
  });
  const rig = new Rig({ plan, group: g, body, legs });
  // ---------------------------------------------------------------- the bones (prepare.mjs's BONES order)
  const bones = {};
  bones.body = body;
  const neck = bones.neck = pivot(body, ...L.neck, 'neck');
  const headPivot = pivot(neck, ...vec(L.headBase).sub(vec(L.neck)).toArray(), 'head');
  // (its look: the head turns toward the traveller; the bone the head's vertices hang on is the gaze's own node)
  const headGaze = gazePart(g, headPivot, { mode: 'turn', yaw: 0.55, up: 0.3, down: 0.35 });
  bones.head = headGaze.node;
  let parent = body, prev = [0, 0, 0];
  L.tail.slice(0, 4).forEach((t, i) => { const b = pivot(parent, ...vec(t).sub(vec(prev)).toArray(), `tail ${i}`); bones[`tail${i}`] = b; parent = b; prev = t; });
  const legBones = legs.map((leg, k) => {
    const l = L.legs[k], hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const mk = (name, at, dir) => { const b = new THREE.Bone(); b.name = `leg${k}_${name}`; b.position.copy(at); if (dir) bendFrame(dir, leg.pole, b.quaternion); g.add(b); bones[b.name] = b; return b; };
    return { thigh: mk('thigh', hip, knee.clone().sub(hip)), shin: mk('shin', knee, ankle.clone().sub(knee)), foot: mk('foot', ankle.clone().setY(ankle.y - leg.ankle), null) };
  });
  // the rest pose (the bind's): the kit's segments at the landmarks, so SkinLegs measures its offsets there
  legs.forEach((leg, k) => { const l = L.legs[k]; leg.root.position.copy(vec(l.hip)); leg.shin.position.copy(vec(l.knee).sub(vec(l.hip))); leg.foot.position.copy(vec(l.ankle).sub(vec(l.hip))).setY(l.ankle[1] - leg.ankle - l.hip[1]); });
  const skinLegs = new SkinLegs({ kit: { legs, rig }, bones: Object.fromEntries(legBones.flatMap((b, k) => [[`leg${k}_thigh`, b.thigh], [`leg${k}_shin`, b.shin], [`leg${k}_foot`, b.foot]])), group: g, body });
  const list = L.bones.map((n) => bones[n]);
  // ---------------------------------------------------------------- the skin
  // (the mesh, its horns and its world's drips: dressed() once a props set; a skin's own colours over its roles)
  const geo = dressed(src, props);
  const colour = home ? null : skinColours(geo, P, L.palette);
  const restGeo = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) restGeo.setAttribute(k, geo.attributes[k]);
  if (colour) restGeo.setAttribute('color', colour);
  restGeo.setIndex(geo.index);
  const skinM = M.mat(home ? 'bhTripo' : 'bhTripoTint', '#ffffff', { lineWhite: white, ...(home ? { map: src.map } : { vertexColors: true }) });
  const sm = new THREE.SkinnedMesh(restGeo, skinM); sm.name = 'tripo skin'; sm.frustumCulled = false; g.add(sm);
  // the eyes over the painted ones: two pale slits on the head's gaze bone (its own material, they glow as it winds up)
  const eyeM = M.own('eye', P.eye, { glow: 0.85 });
  const hb = vec(L.headBase);
  const eyeGeo = merged(L.eyes.filter(Boolean).map((e) => new THREE.CapsuleGeometry(0.016, 0.04, 3, 8).rotateZ(Math.PI / 2 - e.side * 0.35).scale(1, 1, 0.5).translate(...vec(e.at).sub(hb).add(new THREE.Vector3(0, 0, 0.012)).toArray())));
  const eyes = add(headGaze.node, eyeGeo, eyeM); eyes.name = 'eyes';
  // (the rake's glow on the horns' crown)
  const root = vec(L.hornRoot[0].at).add(vec(L.hornRoot[1].at)).multiplyScalar(0.5), crown = root.clone().add(new THREE.Vector3(0, 0.13 * HORN.k, -0.15 * HORN.k));
  const hornTip = pivot(headGaze.node, ...crown.clone().sub(hb).toArray());
  // the Garden of Spheres: gold glints along the horns and a pearl-and-gold halo over them, on the head's gaze bone
  const glintM = props.has('glints') ? M.own('glint', P.glow, { glow: 0.9 }) : null;
  const propGeos = [];
  if (glintM) {
    const g = merged(L.hornRoot.flatMap((h) => hornPath(h.side, HORN.k).slice(1, 7).map(([x, y, z], i) => new THREE.SphereGeometry(0.013, 6, 4).translate(x + h.at[0] - hb.x + h.side * (HORN.r * (1 - i / 7) + 0.006), y + h.at[1] - hb.y, z + h.at[2] - hb.z))));
    propGeos.push(g); add(headGaze.node, g, glintM).name = 'glints';
  }
  if (props.has('halo')) {
    const h = pivot(headGaze.node, 0, crown.y - hb.y + 0.05, crown.z - hb.z + 0.04, 'halo'); h.rotation.set(-0.12, 0, 0.06);
    const g = new THREE.TorusGeometry(0.3, 0.011, 5, 48).rotateX(Math.PI / 2); propGeos.push(g);
    add(h, g, M.own('halo', P.glow, { glow: 0.8 })).name = 'halo';
  }
  // ---------------------------------------------------------------- its shadow form: a pool, its head and horns rising out of it
  const poolShape = new THREE.Shape(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, r = 0.55 * (1 + (i % 2 ? 0.18 : -0.05) + Math.sin(i * 2.3) * 0.08); poolShape[i ? 'lineTo' : 'moveTo'](Math.sin(a) * r, Math.cos(a) * r); }
  const poolM = M.mat('bhPool', P.ink, { flat: true, lineWhite: white });
  const pool = add(g, new THREE.ShapeGeometry(poolShape).scale(0.95, 1.7, 1).rotateX(-Math.PI / 2), poolM, 0, 0.03, 0);
  const glowRim = add(g, new THREE.RingGeometry(0.62, 0.72, 24).scale(0.95, 1.7, 1).rotateX(-Math.PI / 2), M.own('glow', P.glow, { glow: 0.8, side: THREE.DoubleSide }), 0, 0.04, 0);
  const rising = pivot(g, 0, 0, 0.4, 'rising');
  add(rising, new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.15, 0.16, 0.22), poolM);
  add(rising, merged([...hornGeometries(props, 0.85).map((x) => x.translate(0, 0.06, -0.02)), new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.1, 0.07, 0.11).translate(0, 0, 0.17)]), M.mat('bhRiseLight', P.antler, { flat: true, lineWhite: white }));
  add(rising, merged(pair((s) => new THREE.SphereGeometry(0.04, 8, 6).scale(1, 0.55, 1).translate(s * 0.08, 0.08, 0.15))), eyeM);
  const gaze = [headGaze, gazePart(g, rising, { mode: 'turn', yaw: 0.5, up: 0.3, down: 0.3 })];
  finish(g);
  g.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(list));
  boneBoxes(sm, list);
  const tailBones = [0, 1, 2, 3].map((i) => bones[`tail${i}`]);
  let solid = 1, crouch = 0, rake = 0, coil = 0, bite = 0;
  return {
    group: g, gaze, body, rig, parts: [], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, shadowy: true, tones: [P.ink, P.antler, P.patch],
    trial: 'tripo',
    tell: (id) => (id === 'rake' ? hornTip : headPivot),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      const sinking = wind && f.atk?.blink;
      const lying = f.state === 'idle' && !f.provoked && !f.watcher;
      const gone = f.phased || sinking || lying;
      solid = ease(solid, gone ? 0 : 1, gone ? 6 : 14, dt);
      sm.visible = body.visible = solid > 0.08; body.scale.set(1, Math.max(0.05, solid), 1);
      pool.visible = solid < 0.9; pool.scale.setScalar(1.2 - solid * 0.5);
      glowRim.visible = rising.visible = solid < 0.6;
      rising.position.y = -0.12 + (1 - solid) * 0.12 + Math.sin(c.now / 140) * 0.015;
      glowRim.scale.setScalar(1 + Math.sin(c.now / 200) * 0.06);
      crouch = ease(crouch, id === 'pounce' && wind ? c.wind : 0, 10, dt);
      coil = ease(coil, id === 'pounce' && wind ? THREE.MathUtils.smoothstep(f.k, 0.5, 0.8) : 0, 14, dt);
      rake = ease(rake, id === 'rake' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0, 12, dt);
      bite = ease(bite, (strike && id === 'bite' ? Math.sin(Math.PI * f.k) : 0) + coil * 0.4, 20, dt);
      const leap = strike && f.atk?.lunge ? Math.min(1, Math.sin(Math.PI * Math.min(1, f.k * 1.4)) * 3) : 0;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, recovery: c.recovery, air: leap });
      const shiver = coil * Math.sin(c.now / 22) * 0.018;
      body.position.set(o.x + shiver, -(1 - solid) * 0.3 + o.y - crouch * 0.2 + coil * 0.06, o.z);
      body.rotation.set(o.pitch + crouch * 0.12 + coil * 0.14, o.yaw + rake * (strike ? -0.5 : 0.25), o.roll + shiver);
      neck.rotation.set(crouch * 0.7 + rake * 0.6 - o.pitch * 0.6, 0, rake * 0.4);
      headPivot.rotation.x = crouch * 0.3 + rake * 0.3 + bite * 0.35;
      g.position.y += leap ? Math.sin(Math.PI * f.k) * 0.5 : 0;
      const run = c.moving ? Math.min(1, (f.def.speed ?? 5) / 5) : 0;
      const sway = Math.sin(c.now / (c.moving ? 170 : 520)) * (c.moving ? 0.22 : 0.1) * (1 - coil);
      tailBones.forEach((t, i) => t.rotation.set(-run * 0.15 - leap * 0.2 + coil * (i ? 0.08 : 0.45) + Math.sin(c.now / 30 + i) * coil * 0.03 - crouch * 0.12 * (1 - coil), sway * (0.5 + i * 0.3), 0));
      rig.write();
      skinLegs.write(f.heading, { air: leap > 0.5 ? 1 : 0 });
      eyeM.uniforms.uColor.value.set(eyeColor(f, f.lit > 0 ? '#ffe2a8' : P.eye, '#ff6a8a'));
      if (solid > 0.5 && Math.random() < (props.has('drips') ? 0.25 : 0.12)) c.drip(f, P.ink);
    },
    dispose() { M.dispose(); hide.dispose(); restGeo.dispose(); eyeGeo.dispose(); for (const x of propGeos) x.dispose(); },
  };
}

/** Each bone's box of the vertices it carries most (the body the blade meets, src/foe-body.js; a gallery's frame), as kit.js skinned. */
function boneBoxes(sm, bones) {
  const local = bones.map(() => new THREE.Box3()), pos = sm.geometry.attributes.position, SI = sm.geometry.attributes.skinIndex, SW = sm.geometry.attributes.skinWeight, v = new THREE.Vector3();
  sm.updateMatrixWorld(true);
  for (let i = 0; i < pos.count; i++) { let b = SI.getX(i), w = SW.getX(i); for (const [bb, ww] of [[SI.getY(i), SW.getY(i)], [SI.getZ(i), SW.getZ(i)], [SI.getW(i), SW.getW(i)]]) if (ww > w) { b = bb; w = ww; } local[b].expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(sm.matrixWorld).applyMatrix4(sm.skeleton.boneInverses[b])); }
  sm.userData.boneBoxes = { bones, local };
  const box = new THREE.Box3(), sphere = new THREE.Sphere(), back = new THREE.Matrix4(), corner = new THREE.Vector3();
  const bounds = () => { sm.updateWorldMatrix(true, false); back.copy(sm.matrixWorld).invert(); box.makeEmpty();
    bones.forEach((b, i) => { const Lb = local[i]; if (Lb.isEmpty()) return; b.updateWorldMatrix(true, false); for (let k = 0; k < 8; k++) box.expandByPoint(corner.set(k & 1 ? Lb.max.x : Lb.min.x, k & 2 ? Lb.max.y : Lb.min.y, k & 4 ? Lb.max.z : Lb.min.z).applyMatrix4(b.matrixWorld).applyMatrix4(back)); });
    return box; };
  let at = -1;
  Object.defineProperty(sm, 'boundingBox', { configurable: true, get: bounds, set() {} });
  Object.defineProperty(sm, 'boundingSphere', { configurable: true, get: () => { if (RENDER_FRAME.on && at === RENDER_FRAME.n) return sphere; at = RENDER_FRAME.on ? RENDER_FRAME.n : -1; return bounds().getBoundingSphere(sphere); }, set() {} });
}

import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { PathTrail } from '../../motion-kit/chain.js';
import { WaveLegs } from '../../motion-kit/wave-legs.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { twoBone } from '../../motion-kit/ik.js';
import { slopeAlong } from '../slope.js';
import { materials, add, pivot, ease, eyeColor, finish, merged } from './kit.js';
import { gazePart } from '../gaze.js';
import { bendFrame } from '../../characters/creature-legs.js';
import { RENDER_FRAME } from '../../render-frame.js';
import { tripoBody, boneBoxes, subset } from './tripo-body.js';
import { centipedeLegacyModel } from './centipede-legacy.js';

// The drill-head centipede (issue #800): the game's `centipede`, the ring centipede, everywhere it is fielded (the Buried
// Machine, the Garden of Spheres, the Fallen Ring, the Eclipse, the Waterfall, the Forest of Antennas, the Arena, the
// gallery). Its body is Tripo's (task 7a924a40-…, from the approved image,
// references/enemy-redesign-2026-10-30/centipede/616e0bd4-…-3.png), made into the game's asset by the family A trial's
// prepare-centipede.mjs (references/enemy-redesign-2026-10-30/trials/familyA-tripo/: the game's frame, 2.4 m to the top
// of its reared head and 4.3 m long, 12k triangles, its parts by their colour and by geometry: the salmon plates, the
// head, the dark teal under them, the cream underside; the painted eyes painted out) and shipped by
// scripts/tripo/ship-body.mjs as public/enemies/centipede/body.glb.
//
// Its rig, the many-legged family's (a custom skin on the game's own walking): the centipede's plan as it was (src/motion-
// kit/chain.js PathTrail: its head is the foe, its path kept, every spine bone at its fixed distance back along it, so the
// body follows the head's path exactly and nothing slides sideways; the legs in a metachronal wave that runs down the
// body, src/motion-kit/wave-legs.js). Fourteen spine bones along the mesh's measured spine, from the tail's tip up the
// reared neck to the head's base: each keeps its height and its rest tilt, so the neck stays reared as the body runs flat
// on the ground; every body vertex shared by the two spine bones round it (by its place along the spine), so the body
// bends smoothly. Five pairs of stubby legs on their own thigh, shin and foot bones (two-bone IK, knees out and up,
// framed in their bend plane, src/characters/creature-legs.js bendFrame), the pads flat on the ground. Four skinned
// meshes on one skeleton, one a part (plates, head, the dark under them, the underside), each its part's flat colour and
// painted surface (src/enemies/surfaces.js).
//
// The head (the author's rule, #800: it looks at you): the head turns to the traveller about its base (the gaze), and its
// two halves are their own bones, hinged at the back of the head: they gape apart through a wind-up, the dark drill
// between them showing, and snap shut in the strike; two slit eyes of their own, one on each half, slide on toward him
// (they go orange as it winds up).
//
// Its wind-ups (src/telegraph.js), from the body alone, as the legacy centipede's:
//   ring    the head lifts and turns inward, its legs ripple faster (the wave quickens), the spiral closes
//   lunge   the head rears and the front of the body bunches up like a spring, then it shoots forward
// Cut from behind under two thirds of its health, its tail's last segments break off and run (the segment shed: their
// bones fold away into the last one kept). Going down, a ripple runs from the head to the tail, each part sinking flat.
// Skins: the home skin (the Buried Machine's drill-head centipede) the reference's colours with a drill between the
// halves; every other skin recolours the parts and dresses them (pearls, a gold head, glowing seams, wet droplets, copper
// wire round each segment). Where the body is not loaded, the legacy ring centipede (plans/centipede-legacy.js) stands in.

/** The shipped body, under public/. */
export const CENTIPEDE_BODY = 'enemies/centipede/body.glb';
const LOADER = tripoBody(CENTIPEDE_BODY, 'drill-head centipede', (host, fs) => (host ? host.readFile(CENTIPEDE_BODY) : fs?.readFileSync(new URL(`../../../public/${CENTIPEDE_BODY}`, import.meta.url))));
export const centipedeSource = LOADER.source;
export const loadCentipedeBody = (base) => LOADER.load(base);
export const setCentipedeSource = LOADER.set;

/** The centipede's builder (src/enemies/plans/index.js): the Tripo body, or the legacy ring centipede where it is not loaded. */
export function centipedeModel(skin) {
  const src = centipedeSource();
  return src ? tripoCentipedeModel(skin, src) : centipedeLegacyModel(skin);
}

/** The reference's flat colours (prepare-centipede.mjs PALETTE): the home skin's (skins.js SKINS.centipede.buried). */
export const CENTIPEDE_ROLES = { plate: '#d9876b', head: '#d9876b', dark: '#1f3a37', under: '#f2ead0' };
const BLEND = 0.06;   // m over which a leg's vertex is shared with the body
/** The stubs stand nearly straight: their solve a little longer than the mesh's, so a foot reaches the ground it is set on. */
const SLACK = 1.14;
/** A foot's pad: what lies under `top` (m) within `r` of a foot is its foot bone's. */
const PAD = { top: 0.1, r: 0.36 };
/** A step's lift, a share of the leg (the legacy's long thin legs 0.42 of theirs: these stubs lift less), and its stride (m):
 *  the legacy's 0.5 m left a planted stub's foot out of its reach at the end of a stance. */
const LIFT = 0.3, STRIDE = 0.3;
const N_SPINE = 12;   // (the corral's wall: the head and this many points down the body, as the legacy's segments)

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _knee = new THREE.Vector3(), _end = new THREE.Vector3(), _hip = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _pole = new THREE.Vector3(), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1), _slopeQ = new THREE.Quaternion();
const vec = (a) => new THREE.Vector3(...a);
const smooth = THREE.MathUtils.smoothstep;
const segDist = (p, a, b) => { _d.subVectors(b, a); const t = THREE.MathUtils.clamp(_v.subVectors(p, a).dot(_d) / Math.max(1e-9, _d.lengthSq()), 0, 1); return _v.copy(a).addScaledVector(_d, t).distanceTo(p); };

const CACHE = new WeakMap();
/** The weights of one source geometry (worked out once): bones { spine: [i], head, lobe: [l, r], leg: [{ thigh, shin, foot }] }. */
function weigh(src, bones) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const geo = src.geometry, L = src.landmarks, P = geo.attributes.position, n = P.count, S = L.spine.map(vec), H = L.head;
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), p = new THREE.Vector3(), w = new Map();
  const tops = new Float32Array(S.length).fill(0);
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i); w.clear();
    const put = (b, x) => { if (x > 1e-4) w.set(b, (w.get(b) ?? 0) + x); };
    // the legs: a capsule round each stub (hip–knee, knee–foot), the pad under 6 cm its foot's
    let leg = -1, ld = Infinity, which = 0;
    L.legs.forEach((l, k) => { const a = segDist(p, vec(l.hip), vec(l.knee)) - l.r, b = segDist(p, vec(l.knee), vec(l.foot)) - l.r * 1.25; const d = Math.min(a, b); if (d < ld) { ld = d; leg = k; which = a < b ? 0 : 1; } });
    let wl = THREE.MathUtils.clamp(0.5 - ld / (2 * BLEND), 0, 1);
    // (a pad's rim, wider than its stub: on the ground near a foot, that foot's)
    if (p.y < PAD.top) L.legs.forEach((l, k) => { const d = Math.hypot(p.x - l.foot[0], p.z - l.foot[2]); if (d < PAD.r && (k !== leg ? d < Math.hypot(p.x - L.legs[leg].foot[0], p.z - L.legs[leg].foot[2]) || wl === 0 : true)) { leg = k; ld = -1; wl = 1; } });
    if (wl > 0) {
      const B = bones.leg[leg], pad = 1 - smooth(p.y, 0.05, 0.1);
      put(B.foot, wl * pad); put(which ? B.shin : B.thigh, wl * (1 - pad));
    }
    const torso = 1 - wl;
    if (torso > 0) {
      // the head over its base (its halves either side of the slit, eased across it), the spine the rest
      const h = smooth(p.y, H.from - 0.12, H.from + 0.08) * smooth(p.z, H.base[2] - 0.35, H.base[2] - 0.15);
      if (h > 0) {
        const lobe = smooth(Math.abs(p.x), H.split * 0.5, H.split * 1.6);
        put(bones.head, torso * h * (1 - lobe)); put(bones.lobe[p.x > 0 ? 1 : 0], torso * h * lobe);
      }
      // (its place along the spine: the nearest point on the spine's polyline in its side view, shared by that segment's two bones)
      let best = Infinity, at = 0, t = 0;
      for (let k = 0; k < S.length - 1; k++) {
        const a = S[k], b = S[k + 1], dz = b.z - a.z, dy = b.y - a.y, l2 = dz * dz + dy * dy;
        const u = THREE.MathUtils.clamp(((p.z - a.z) * dz + (p.y - a.y) * dy) / l2, 0, 1), d = Math.hypot(a.z + dz * u - p.z, a.y + dy * u - p.y);
        if (d < best) { best = d; at = k; t = u; }
      }
      put(bones.spine[at], torso * (1 - h) * (1 - t)); put(bones.spine[at + 1], torso * (1 - h) * t);
      if (Math.abs(p.x) < 0.12 && h < 0.5) { const k = t < 0.5 ? at : at + 1; tops[k] = Math.max(tops[k], p.y - S[k].y); }
    }
    const top = [...w].sort((u, v) => v[1] - u[1]).slice(0, 4), sum = top.reduce((s, [, x]) => s + x, 0) || 1;
    if (!top.length) top.push([bones.spine[0], 1]);
    top.forEach(([b, x], j) => { SI[i * 4 + j] = b; SW[i * 4 + j] = x / sum; });
  }
  const out = { SI, SW, tops };
  CACHE.set(src.geometry, out);
  return out;
}

/** The centipede's body (the model contract of plans/index.js), from the loaded source (centipedeSource). */
export function tripoCentipedeModel(skin, src) {
  const PL = PLANS.centipede, P = skin.palette, props = new Set(skin.props), M = materials('centipede', skin), L = src.landmarks;
  const g = new THREE.Group(); g.name = `${skin.name} · drill-head centipede`;
  // the body lives in the foes' space (its bones on the path), so it hangs from a holder the anim keeps at the group's
  // inverse: the group itself is placed at the head by Foes.look (the legacy centipede's way)
  const holder = pivot(g, 0, 0, 0, 'body (path space)');
  const S = L.spine.map(vec), HB = vec(L.head.base), headZ = HB.z;
  // ---------------------------------------------------------------- the spine's bones, each framed along the spine there (+z toward the head)
  const list = [], index = (o) => { list.push(o); return list.length - 1; };
  const spine = S.map((at, i) => {
    const b = new THREE.Bone(); b.name = `spine${i}`; b.position.copy(at);
    _d.copy(S[Math.min(S.length - 1, i + 1)]).sub(S[Math.max(0, i - 1)]).normalize();
    b.quaternion.setFromUnitVectors(FWD, _d);
    holder.add(b);
    return { bone: b, rest: b.quaternion.clone(), back: headZ - at.z, h: at.y, i: index(b) };
  });
  // the head: on its base, turned by the pose and the gaze; its two halves hinged at its back
  const head = new THREE.Bone(); head.name = 'head'; head.position.copy(HB); holder.add(head);
  const headGaze = gazePart(g, head, { mode: 'turn', yaw: 0.45, up: 0.2, down: 0.25 });
  const headBone = index(headGaze.node);
  const lobes = L.head.hinge.map((h, k) => { const b = pivot(headGaze.node, ...vec(h).sub(HB).toArray(), k ? 'lobe right' : 'lobe left'); return b; });
  // (the hinge's x: hinge[0] is +x in Tripo's frame, the game's too: the right half)
  const lobeBones = [lobes[1], lobes[0]];   // ([left (−x), right (+x)])
  if (L.head.hinge[0][0] < 0) lobeBones.reverse();
  const lobeIdx = lobeBones.map(index);
  // ---------------------------------------------------------------- the legs: a thigh, shin and foot bone each, on the nearest spine bone
  const legs = L.legs.map((l, k) => {
    const hip = vec(l.hip), knee = vec(l.knee), foot = vec(l.foot);
    let near = 0; spine.forEach((s, i) => { if (Math.abs(s.bone.position.z - hip.z) < Math.abs(spine[near].bone.position.z - hip.z)) near = i; });
    const mk = (name, at) => { const b = new THREE.Bone(); b.name = `leg${k}_${name}`; b.position.copy(at); holder.add(b); return b; };
    const thigh = mk('thigh', hip), shin = mk('shin', knee), pad = mk('foot', foot);
    const pole = new THREE.Vector3(l.side, 1, 0).normalize();
    const offThigh = bendFrame(_d.subVectors(knee, hip), pole, new THREE.Quaternion()).invert(), offShin = bendFrame(_d.subVectors(foot, knee), pole, new THREE.Quaternion()).invert();
    // (the hip and the rest foot in the spine bone's rest frame)
    _m.compose(spine[near].bone.position, spine[near].rest, _v.set(1, 1, 1)).invert();
    return { k, side: l.side, seg: near, hipLocal: hip.clone().applyMatrix4(_m), footLocal: foot.clone().applyMatrix4(_m), lenA: hip.distanceTo(knee) * SLACK, lenB: knee.distanceTo(foot) * SLACK, back: headZ - hip.z,
      thigh, shin, pad, pole, offThigh, offShin, idx: { thigh: index(thigh), shin: index(shin), foot: index(pad) }, root: thigh, foot: pad, lowest: (o) => pad.getWorldPosition(o) };
  });
  // (a leg's foot for the walk audit, scripts/motion-audit/walk-procedural.mjs lowest: its pad bone, where the wave plants it)
  for (const l of legs) l.thigh.lowest = (o) => l.pad.getWorldPosition(o);
  const legLen = legs[0].lenA + legs[0].lenB;
  // ---------------------------------------------------------------- the meshes: one a part, on one skeleton
  const prep = weigh(src, { spine: spine.map((s) => s.i), head: headBone, lobe: lobeIdx, leg: legs.map((l) => l.idx) });
  const geo = src.geometry, I = geo.index.array;
  const attrs = { position: geo.attributes.position, normal: geo.attributes.normal, skinIndex: new THREE.BufferAttribute(prep.SI, 4), skinWeight: new THREE.BufferAttribute(prep.SW, 4) };
  const glowSeams = props.has('glow');
  const PARTS = {
    plate: M.mat('plate', P.plate, { color2: P.plate2 }),
    head: M.mat('head', P.head, { color2: P.plate2, metal: props.has('gold') ? 'brass' : undefined }),
    // (the dark under the plates: the crescent crawler's glowing seams, the orbital centipede's gold)
    // (the drain crawler's wet seams catching the light: its dark plates need a light part to read, foe-presence.js)
    dark: glowSeams ? M.own('accent', P.accent, { glow: 0.7 }) : M.mat('dark', props.has('gold') || props.has('slick') ? P.accent : P.dark, { flat: true }),
    under: M.mat('under', P.under),
  };
  const meshes = Object.entries(L.parts).map(([part, [first, count]]) => {
    const sm = new THREE.SkinnedMesh(subset(geo, Array.from(I.subarray(first * 3, (first + count) * 3)), attrs), PARTS[part]);
    sm.name = `centipede ${part}`; sm.frustumCulled = false; g.add(sm); return sm;
  });
  // ---------------------------------------------------------------- the dress: one skinned mesh, each piece on its spine bone
  // (the drain crawler's wet droplets are glints, its eyes' pale: a light part along a dark body, foe-presence.js)
  const accentM = props.has('slick') ? M.mat('glint', P.eye) : M.mat('accent', P.accent);
  const dressGeo = [], dressBone = [];
  const along = (i, geom) => { const s = spine[i]; geom.applyQuaternion(s.rest).translate(s.bone.position.x, s.bone.position.y, s.bone.position.z); dressGeo.push(geom); dressBone.push(s.i); };
  // (the body's segments only: from the third bone up from the tail's tip to the neck's foot)
  for (let i = 2; i < spine.length - 4; i++) {
    const r = Math.max(0.2, prep.tops[i] || 0.4);
    if (props.has('wire')) for (let k = 0; k < 3; k++) along(i, new THREE.TorusGeometry(r * 0.94, 0.014, 4, 18).scale(1.05, 1, 1).translate(0, 0, -0.1 + k * 0.08));
    if (props.has('pearl')) along(i, new THREE.SphereGeometry(0.07, 8, 6).translate(0, r + 0.02, 0));
    if (props.has('slick') && i % 2 === 0) for (const s of [-1, 1]) along(i, new THREE.SphereGeometry(0.045, 6, 4).scale(1, 1.6, 1).translate(s * r * 0.72, r * 0.62, 0.05));
  }
  let dress = null;
  if (dressGeo.length) {
    const dg = merged(dressGeo), counts = dressGeo.map((x) => x.attributes.position.count), si = new Uint16Array(dg.attributes.position.count * 4), sw = new Float32Array(dg.attributes.position.count * 4);
    let o = 0; counts.forEach((c, j) => { for (let v = 0; v < c; v++) { si[(o + v) * 4] = dressBone[j]; sw[(o + v) * 4] = 1; } o += c; });
    dg.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); dg.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    dress = new THREE.SkinnedMesh(dg, accentM); dress.name = 'centipede dress'; dress.frustumCulled = false; g.add(dress);
  }
  // the drill (the drill-head's: between the halves, where the reference draws its dark beak), spinning
  let drill = null;
  if (props.has('drill')) {
    drill = add(headGaze.node, new THREE.ConeGeometry(0.15, 0.5, 9).rotateX(Math.PI / 2), M.mat('drill', '#a8b0b4', { metal: 'iron' }), 0, (L.head.at[1] - HB.y) * 0.55, L.front - HB.z - 0.12);
    drill.name = 'drill';
  }
  // the eyes: a slit each on the halves' fronts (where the painted ones were, the face's own surface), sliding on toward him
  const eyeM = M.own('eye', P.eye, { glow: 0.85 });
  const eyes = lobeBones.map((lobe, k) => {
    const s = k ? 1 : -1, at = frontAt(geo, s * 0.2, L.eyes.reduce((t, e) => t + e.at[1], 0) / L.eyes.length);
    const e = add(lobe, new THREE.CapsuleGeometry(0.022, 0.09, 3, 6).rotateZ(Math.PI / 2 + s * 0.35).scale(1, 1, 0.45), eyeM);
    e.position.copy(at).add(_v.set(0, 0, 0.012)).sub(HB).sub(lobe.position); e.name = `eye ${k ? 'right' : 'left'}`;
    return e;
  });
  const tip = pivot(headGaze.node, 0, (L.head.at[1] - HB.y) * 0.5, L.front - HB.z + 0.1);   // (where the lunge's glow gathers, before the halves)
  const gaze = [headGaze, ...eyes.map((e) => gazePart(g, e, { mode: 'slide', slide: 0.025 }))];
  finish(g);
  g.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  for (const sm of [...meshes, ...(dress ? [dress] : [])]) { sm.bind(skeleton); if (sm !== dress) boneBoxes(sm, list, prep.SI, RENDER_FRAME); }
  // ---------------------------------------------------------------- the walk: the path, the wave, the poses (the legacy centipede's)
  const wave = new WaveLegs({ n: legs.length, stride: STRIDE, duty: PL.legs.duty, height: LIFT * legLen, lag: PL.legs.lag, seed: (serial++ * 0.618034) % 1 });
  const total = headZ - S[0].z;
  const trail = new PathTrail({ spacing: 0.06, length: total + 1.5 });
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const corral = Array.from({ length: N_SPINE + 1 }, () => new THREE.Vector3());   // (head and points down the body in the foes' space: Foes.corral's wall)
  let seeded = false, lastWalked = 0, arc = 0, bunch = 0, lift = 0, turn = 0, pinch = 0;
  const rig = { legs, length: legLen, update: () => {}, write: () => {}, wave, trail };
  const coil = (head0, heading) => (s) => {
    const R = 1.15, a = s / R, bx = -Math.sin(heading), bz = -Math.cos(heading), lx = Math.cos(heading), lz = -Math.sin(heading);
    return { x: head0.x + (Math.sin(a) * bx + (1 - Math.cos(a)) * lx) * R, z: head0.z + (Math.sin(a) * bz + (1 - Math.cos(a)) * lz) * R };
  };
  const _sa = {};
  const segPos = spine.map(() => new THREE.Vector3()), segDir = spine.map(() => new THREE.Vector3(0, 0, 1)), segYaw = new Float32Array(spine.length);
  return {
    group: g, gaze, body: head, rig, parts: [...meshes, head, ...spine.map((x) => x.bone)], eyeMat: eyeM, base: P.eye, size: 1, skin: skin.id, tones: [P.plate, P.under, P.head],
    spine: corral, tripo: 'tripo',
    tell: (id) => (id === 'ring' ? eyes[0] : tip),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      if (!seeded) { trail.seed(f.pos, f.wilds && !f.provoked ? coil(f.pos, f.heading) : (s) => ({ x: f.pos.x - Math.sin(f.heading) * s, z: f.pos.z - Math.cos(f.heading) * s })); seeded = true; }
      trail.update(f.pos);
      g.updateMatrix(); _inv.copy(g.matrix).invert();
      holder.matrixAutoUpdate = false; holder.matrix.copy(_inv); holder.matrixWorldNeedsUpdate = true;
      const P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      bunch = ease(bunch, id === 'lunge' ? (wind ? c.wind : 0) : 0, 10, dt);
      lift = ease(lift, id === 'ring' && wind ? 1 : id === 'lunge' && wind ? c.wind : 0, 6, dt);
      let inward = 0;
      if (id === 'ring' && wind) { const a = Math.atan2(f.attackAt.x - f.pos.x, f.attackAt.z - f.pos.z); inward = Math.atan2(Math.sin(a - f.heading), Math.cos(a - f.heading)) * Math.min(1, c.wind * 1.5) * 0.7; }
      turn = ease(turn, inward, 8, dt);
      pinch = ease(pinch, wind ? c.wind : strike ? 1 - c.release : 0, 14, dt);
      const shed = f.shed ?? 0, kept = total * (1 - shed / N_SPINE);
      const dying = f.dying ? f.dying.u : 0, fall = (u) => (dying > 0 ? THREE.MathUtils.smoothstep(dying, 0.04 + u * 0.5, 0.4 + u * 0.5) : 0);   // (u: 0 the head … 1 the tail)
      const SL = f.slope ?? null;
      // the head, on its own spot on the path, lifted and turned by the pose
      trail.at(0, _a, _d);
      const hy = (Math.hypot(_d.x, _d.z) > 1e-6 ? Math.atan2(_d.x, _d.z) : f.heading) + turn + P0.yaw;
      const g0 = c.ground?.(f.pos.x, f.pos.y + 1, f.pos.z), y0 = Number.isFinite(g0) ? g0 : f.pos.y;
      slopeAlong(SL, hy, _sa);
      head.position.set(f.pos.x + Math.sin(hy) * P0.z, y0 + HB.y + P0.y + lift * 0.18 - fall(0) * HB.y * 0.55, f.pos.z + Math.cos(hy) * P0.z);
      head.rotation.set(P0.pitch - lift * 0.35 + fall(0) * 0.45 - Math.atan(_sa.ahead), hy, Math.atan(_sa.side), 'YXZ');
      corral[0].copy(head.position).setY(y0);
      // the spine: each bone at its distance back along the path, at its own height, its rest tilt kept; the front
      // bunches through the lunge's wind-up; the shed ones folded into the last one kept
      const walked = trail.travelled, stepRate = id === 'ring' && wind ? 1.6 : 1;
      arc += (walked - lastWalked) * stepRate;
      const moving = Math.min(1, (walked - lastWalked) / Math.max(dt, 1e-3) / 2);
      let lastKept = spine.length - 1;
      for (let i = spine.length - 1; i >= 0; i--) {
        const s = spine[i], front = s.back < 1.4 ? (1 - s.back / 1.4) : 0;
        const back = s.back * (1 - bunch * 0.3 * front);
        trail.at(back, segPos[i], segDir[i]);
        const yaw = Math.hypot(segDir[i].x, segDir[i].z) > 1e-6 ? Math.atan2(segDir[i].x, segDir[i].z) : f.heading;
        segYaw[i] = yaw;
        const gy = c.ground?.(segPos[i].x, segPos[i].y + 1, segPos[i].z), y = Number.isFinite(gy) ? gy : segPos[i].y;
        const u = s.back / total, roll = Math.sin((walked / STRIDE) * Math.PI * 2 - u * 6) * 0.05 * moving;
        slopeAlong(SL, yaw, _sa);
        // (the neck's bones near the head ride up with its lift)
        s.bone.position.set(segPos[i].x, y + s.h + (front > 0 ? lift * 0.18 * front : 0) - fall(u) * Math.min(s.h, 0.55) * 0.6, segPos[i].z);
        _q.setFromEuler(_e.set(-Math.atan(_sa.ahead), yaw, roll + Math.atan(_sa.side), 'YXZ'));
        s.bone.quaternion.copy(_q).multiply(s.rest);
        s.bone.scale.setScalar(1);
        if (s.back > kept) lastKept = Math.min(lastKept, i);
      }
      // (the shed: every bone past the kept length folded into the first one behind the cut, its vertices with it)
      if (shed > 0) { const keep = spine.find((s) => s.back <= kept) ?? spine[spine.length - 1]; for (const s of spine) if (s.back > kept) { s.bone.position.copy(keep.bone.position); s.bone.quaternion.copy(keep.bone.quaternion); s.bone.scale.setScalar(0.001); } }
      for (let k = 1; k <= N_SPINE; k++) { trail.at(Math.min(kept, (k / N_SPINE) * total), _b); corral[k].copy(_b); }
      lastWalked = walked;
      // the halves: apart through a wind-up, the drill showing; shut in the strike
      lobeBones.forEach((b, k) => { b.rotation.y = (k ? -1 : 1) * (pinch * 0.42 - (strike ? 0.4 * c.release : 0)); });
      if (drill) drill.rotation.z += dt * (wind ? 30 : 6);
      // the legs: each stepping on its own distance along the path (the wave runs down the body)
      g.updateMatrixWorld(true);
      wave.touches.length = 0; wave.plane = SL;
      if (SL) _slopeQ.setFromUnitVectors(UP, _v.set(-SL.sx, 1, -SL.sz).normalize()); else _slopeQ.identity();
      for (const l of legs) {
        const s = spine[l.seg], hidden = s.back > kept;
        // its rest foot (in the foes' space) and the segment's heading
        _m.compose(s.bone.position, s.bone.quaternion, _v.set(1, 1, 1));
        _hip.copy(l.hipLocal).applyMatrix4(_m);
        _b.copy(l.footLocal).applyMatrix4(_m);
        const gy = c.ground?.(_b.x, _b.y + 1, _b.z); _b.y = Number.isFinite(gy) ? gy : s.bone.position.y - s.h;
        _d.set(Math.sin(segYaw[l.seg]), 0, Math.cos(segYaw[l.seg]));
        const foot = wave.update(l.k, arc - l.back, _b, _d, c.ground);
        _end.copy(foot);
        _pole.copy(l.pole).applyAxisAngle(UP, segYaw[l.seg]);
        twoBone(_hip, _end, l.lenA, l.lenB, _pole, _knee, _end);
        if (bendFrame(_d.subVectors(_knee, _hip), _pole, _q)) l.thigh.quaternion.copy(_q).multiply(l.offThigh);
        if (bendFrame(_d.subVectors(_end, _knee), _pole, _q2)) l.shin.quaternion.copy(_q2).multiply(l.offShin);
        l.thigh.position.copy(_hip); l.shin.position.copy(_knee);
        l.pad.position.copy(_end); l.pad.quaternion.copy(_slopeQ).multiply(_q.setFromAxisAngle(UP, segYaw[l.seg]));   // (its pad flat on the ground's plane)
        for (const b of [l.thigh, l.shin, l.pad]) b.scale.setScalar(hidden ? 0.001 : 1);
        if (hidden) for (const b of [l.thigh, l.shin, l.pad]) b.position.copy(s.bone.position);
      }
      if (c.touch) for (const t of wave.touches) if (Math.random() < 0.08) c.touch(t.at, legLen, t.leg);
      if (glowSeams) PARTS.dark.uniforms.uGlow.value = 0.7 + (id === 'ring' && wind ? c.wind * 0.6 : 0);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
    },
    dispose() { M.dispose(); for (const sm of meshes) sm.geometry.dispose(); dress?.geometry.dispose(); },
  };
}
let serial = 0;

/** The face's front surface at (x, y): the mesh's most forward point near that column. */
function frontAt(geo, x, y) {
  const P = geo.attributes.position, out = new THREE.Vector3(x, y, -Infinity);
  for (let i = 0; i < P.count; i++) if (Math.abs(P.getX(i) - x) < 0.05 && Math.abs(P.getY(i) - y) < 0.05 && P.getZ(i) > out.z) out.z = P.getZ(i);
  if (!Number.isFinite(out.z)) out.z = 0;
  return out;
}

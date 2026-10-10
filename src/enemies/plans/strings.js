import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { Pendulum } from '../../motion-kit/machines.js';
import { materials, add, many, skinBy, pivot, pair, lerp, ease, smooth, finish } from './kit.js';

// Plan 21, suspended on strings (docs/systems/procedural-animation.md §4, the kit's `strings`): the marionette
// (docs/design/enemy-roster.md, archetype 21), drawn to its sheets (references/enemy-archetypes/marionette/: sheet-1 the
// Garden of Spheres' glass puppet, sheet-2 the Signal Market's parcel puppet). A thin rigid puppet two metres tall,
// hanging limp a metre off the ground, its head tipped forward: an egg of a head, a chest and a pelvis joined by a
// ringed waist, thin limbs with ball joints at the shoulders, elbows, wrists, hips, knees and ankles; four long strings
// from its head, its hands and its back rise straight up into a knot of black smoke far overhead. It has no eyes.
//
// The manifestation: the puppeteer. The spirit is the hand you never see: the strings go up into the smoke, and they
// drop down onto other things (a creature it drives: src/foes.js `possess`).
//
// On the kit's `strings` plan: the anchor in the smoke glides where it goes; the puppet hangs from it as a pendulum
// (src/motion-kit/machines.js Pendulum: it swings behind as it sets off and past as it stops), each limb swinging on its
// own loose spring; moving, it jerks, its limbs tugged up in turns by the strings and dropped. It never touches the
// ground. Draws: its body and its joints one skinned mesh each (kit.js skinBy), its four strings one mesh skinned
// between the anchor and the parts they hold, the smoke one, the strings it drops two.
//
// Its attacks read from the body (src/telegraph.js; nothing on the ground):
//   strings   it lifts both arms, the fingers curling, and two strings unspool down from its hands onto a creature near
//             it: the creature's eyes go black and it fights faster and harder until the strings are cut
//   yank      one arm rises and a string swings out toward you (1 s); caught, you are lifted off your feet toward it
//   dance     alone (nothing to hold): it drops low on its strings and its legs jerk up together; then it whirls,
//             kicking round itself, and hangs slack after, open
// Calm (`hang`): it hangs still under bridges and arches, swaying a little, like a coat on a hook. Skins
// (src/enemies/skins.js): glass on silver threads (the Garden of Spheres), parcels tied with string, a paper-bag head and
// wax seals (the Signal Market), girders and rivets (the Underside), a drowned sailor on wet rope (the Salt Harbour).

const NECK = 1.66, CHEST = 1.5, SH = 0.21, UPPER = 0.3, FORE = 0.28, THIGH = 0.43, SHIN = 0.42;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _down = new THREE.Vector3(0, -1, 0), _gq = new THREE.Quaternion();

/**
 * Strings between joints as one skinned mesh: each a thin tube from `a` (its top joint) to `b` (the joint it holds),
 * its top ring bound to a's joint and its bottom ring to b's, so it stretches between them as they move (one draw).
 */
function stringMesh(owner, pairs, mat, r = 0.006) {
  owner.updateMatrixWorld(true);
  const bones = [], index = new Map(), boneOf = (o) => { if (!index.has(o)) { index.set(o, bones.length); bones.push(o); } return index.get(o); };
  const inv = new THREE.Matrix4().copy(owner.matrixWorld).invert(), pos = [], nrm = [], si = [], sw = [], idx = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), q = new THREE.Quaternion();
  for (const [ja, jb] of pairs) {
    A.setFromMatrixPosition(ja.matrixWorld).applyMatrix4(inv); B.setFromMatrixPosition(jb.matrixWorld).applyMatrix4(inv);
    const ia = boneOf(ja), ib = boneOf(jb), d = B.clone().sub(A), base = pos.length / 3;
    q.setFromUnitVectors(_up, d.clone().normalize());
    for (let ring = 0; ring < 2; ring++) for (let s = 0; s < 4; s++) {
      const t = (s / 4) * Math.PI * 2 + Math.PI / 4, n = new THREE.Vector3(Math.cos(t), 0, Math.sin(t)).applyQuaternion(q);
      const p = (ring ? B : A).clone().addScaledVector(n, r);
      pos.push(p.x, p.y, p.z); nrm.push(n.x, n.y, n.z); si.push(ring ? ib : ia, 0, 0, 0); sw.push(1, 0, 0, 0);
    }
    for (let s = 0; s < 4; s++) { const a = base + s, b = base + ((s + 1) % 4), c = a + 4, e = b + 4; idx.push(a, c, b, b, c, e); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(idx);
  const sm = new THREE.SkinnedMesh(geo, mat); sm.name = 'strings'; sm.frustumCulled = false;
  owner.add(sm); sm.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(bones));
  return sm;
}

export function marionetteModel(skin) {
  const PL = PLANS.strings, P = skin.palette, props = new Set(skin.props), M = materials('marionette', skin);
  const parcel = props.has('parcel'), girder = props.has('girder');
  const g = new THREE.Group(); g.name = skin.name;
  // the anchor: the knot of smoke where the strings go up into the dark, PL.anchor m over its feet
  const anchor = pivot(g, 0, PL.anchor, 0, 'anchor');
  // (the strings glow faintly: the possession's own light, and what you cut; they read against any ground)
  const smokeM = M.mat('smoke', P.smoke), threadM = M.mat('thread', P.thread, { flat: true, glow: 0.55, line: 0.25, lineTint: 1 });
  const puffs = [];
  // (a billowing knot wider than the puppet, heaped up, a wisp of it twisting down where the strings go in)
  for (let i = 0; i < 34; i++) {
    const a = i * 2.39996, r = 0.1 + Math.sqrt(i / 34) * 0.75, s = 0.12 + ((i * 7) % 5) * 0.045;
    puffs.push(new THREE.IcosahedronGeometry(s, 1).scale(1.15, 0.85, 1.15).translate(Math.sin(a) * r, 0.3 + ((i * 3) % 7) * 0.06 - r * r * 0.35, Math.cos(a) * r * 0.85));
  }
  // (the sheet's: under the cloud the ink pours down in a twisting funnel, narrowing to where the strings go in)
  for (let i = 0; i < 12; i++) {
    const t = i / 11, a = t * 7.5, r = 0.06 + (1 - t) * 0.12;
    puffs.push(new THREE.IcosahedronGeometry(lerp(0.3, 0.055, Math.pow(t, 0.8)), 1).scale(1.1, 0.8, 1.1).translate(Math.sin(a) * r, 0.08 - t * 1.05, Math.cos(a) * r * 0.8));
  }
  const smoke = new THREE.Group(); anchor.add(smoke); smoke.name = 'knot';
  many(smoke, puffs, smokeM);
  // the puppet hangs from the anchor (`hang`: the pendulum turns it about the knot)
  const hang = pivot(anchor, 0, 0, 0, 'hang');
  const body = pivot(hang, 0, CHEST - PL.anchor, 0, 'puppet');
  const bodyB = M.mat('bodyBuild', P.body), jointB = M.mat('jointBuild', P.joint), sealB = parcel ? M.mat('sealBuild', P.seal) : null;
  // (glass catches the light even in its shade: a little of its own)
  const bodyM = M.mat('body', P.body, { vertexColors: true, flat: parcel || girder, glow: props.has('silver') ? 0.22 : 0 }), jointM = M.mat('joint', P.joint, { vertexColors: true, glow: props.has('silver') ? 0.15 : 0 });
  // (a limb: a glass capsule, a parcel's box, a girder's I-beam; a joint: a pearl ball, a knot of twine, a bolt)
  const limb = (len, r0) => { const r = r0 * 1.35; return (parcel ? new THREE.BoxGeometry(r * 2.4, len * 0.92, r * 2.1) : girder ? new THREE.BoxGeometry(r * 1.6, len * 0.95, r * 2.2) : new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 8)).translate(0, -len / 2, 0); };
  const ball = (r0) => { const r = r0 * 1.3; return girder ? new THREE.CylinderGeometry(r * 0.9, r * 0.9, r * 1.6, 8).rotateZ(Math.PI / 2) : new THREE.SphereGeometry(r, 10, 8); };
  // the chest (its back string's hold behind it), the ringed waist, the pelvis
  if (parcel) add(body, new THREE.BoxGeometry(0.4, 0.42, 0.24).translate(0, -0.04, 0), bodyB);
  else add(body, new THREE.SphereGeometry(1, 16, 12).scale(0.23, 0.27, 0.15).translate(0, -0.04, 0), bodyB);
  const waist = pivot(body, 0, -0.27, 0, 'waist');
  many(waist, [0, 1, 2].map((i) => new THREE.CylinderGeometry(0.085 - i * 0.004, 0.085 - i * 0.004, 0.045, 12).translate(0, -0.02 - i * 0.055, 0)), jointB);
  const pelvis = pivot(waist, 0, -0.2, 0, 'pelvis');
  if (parcel) add(pelvis, new THREE.BoxGeometry(0.34, 0.18, 0.22).translate(0, -0.06, 0), bodyB);
  else add(pelvis, new THREE.SphereGeometry(1, 14, 10).scale(0.19, 0.12, 0.14).translate(0, -0.05, 0), bodyB);
  // the head: tipped forward on its neck (limp); an egg of glass, a paper bag, a girder's block
  const neck = pivot(body, 0, NECK - CHEST, 0, 'neck');
  add(neck, ball(0.045), jointB);
  const headM = parcel ? new THREE.BoxGeometry(0.22, 0.28, 0.2).translate(0, 0.17, 0) : girder ? new THREE.BoxGeometry(0.2, 0.26, 0.22).translate(0, 0.16, 0) : new THREE.SphereGeometry(1, 16, 12).scale(0.13, 0.165, 0.14).translate(0, 0.17, 0);
  add(neck, headM, bodyB);
  // the wax seals and the twine knots on the parcel puppet; rivets on the girder's
  if (parcel) many(body, [new THREE.CylinderGeometry(0.05, 0.05, 0.015, 12).rotateX(Math.PI / 2).translate(0, 0.02, 0.125), new THREE.CylinderGeometry(0.045, 0.045, 0.015, 12).rotateX(Math.PI / 2).translate(0, -0.17, 0.125)], sealB);
  if (parcel) many(neck, [new THREE.CylinderGeometry(0.045, 0.045, 0.015, 12).rotateX(Math.PI / 2).translate(0, 0.17, 0.105)], sealB);
  // the arms and the legs: ball joints at every bend
  const arms = pair((s) => {
    const sh = pivot(body, s * SH, 0.08, 0, 'shoulder');
    add(sh, ball(0.055), jointB);
    add(sh, limb(UPPER, 0.036), bodyB);
    const el = pivot(sh, 0, -UPPER, 0, 'elbow');
    add(el, ball(0.043), jointB);
    add(el, limb(FORE, 0.032), bodyB);
    const wr = pivot(el, 0, -FORE, 0, 'wrist');
    add(wr, ball(0.035), jointB);
    // (the hand: a palm and three long fingers that curl)
    const fingers = pivot(wr, 0, -0.08, 0, 'fingers');
    add(wr, new THREE.BoxGeometry(0.05, 0.08, 0.025).translate(0, -0.05, 0), bodyB);
    many(fingers, [-1, 0, 1].map((k) => new THREE.CapsuleGeometry(0.009, 0.07, 3, 5).translate(k * 0.017, -0.045, 0)), bodyB);
    const hold = pivot(wr, 0, -0.03, 0, 'hand string');
    return { sh, el, wr, fingers, hold, s };
  });
  const legs = pair((s) => {
    const hip = pivot(pelvis, s * 0.1, -0.08, 0, 'hip');
    add(hip, ball(0.05), jointB);
    add(hip, limb(THIGH, 0.042), bodyB);
    const kn = pivot(hip, 0, -THIGH, 0, 'knee');
    add(kn, ball(0.046), jointB);
    add(kn, limb(SHIN, 0.036), bodyB);
    const an = pivot(kn, 0, -SHIN, 0, 'ankle');
    add(an, ball(0.034), jointB);
    add(an, parcel || girder ? new THREE.BoxGeometry(0.07, 0.05, 0.16).translate(0, -0.04, 0.04) : new THREE.SphereGeometry(1, 10, 6).scale(0.04, 0.035, 0.09).translate(0, -0.035, 0.035), bodyB);
    return { hip, kn, an, s };
  });
  // the strings' holds: the top of its head, its back, its hands; each rises to the knot
  const headHold = pivot(neck, 0, 0.32, 0, 'head string'), backHold = pivot(body, 0, 0.06, -0.12, 'back string');
  const tops = [0, 1, 2, 3].map((i) => pivot(anchor, 0, 0, 0, `knot ${i}`));
  skinBy(g, [{ from: [bodyB], into: bodyM }, { from: [jointB, ...(sealB ? [sealB] : [])], into: jointM }]);
  const strings = stringMesh(g, [[tops[0], headHold], [tops[1], backHold], [tops[2], arms[0].hold], [tops[3], arms[1].hold]], threadM, props.has('rope') ? 0.02 : 0.012);
  // the strings it drops onto a creature (or swings at you): two lines from its hands, unspooling down
  const drops = pair(() => { const m = add(g, new THREE.CylinderGeometry(0.012, 0.012, 1, 5).translate(0, -0.5, 0), threadM); m.visible = false; return m; });
  finish(g);
  const parts = [body, waist, pelvis, neck, ...arms.flatMap((a) => [a.sh, a.el]), ...legs.flatMap((l) => [l.hip, l.kn])];
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const swing = new Pendulum(PL.swing);
  // each limb its own loose spring (arms and legs swinging after the body's moves); the tugs of the strings
  const Lm = PL.limb, spring = () => new SecondOrder(Lm.f, Lm.z, Lm.r);
  const limbs = { arms: arms.map(() => [spring(), spring()]), legs: legs.map(() => [spring(), spring()]) };
  const tugs = [0, 0, 0, 0];   // (left arm, right arm, left leg, right leg)
  let tugT = 0, prevX = null, prevZ = 0, lift = 0, spinY = 0, unspool = 0;
  const anchorW = new THREE.Vector3();
  return {
    group: g, body, parts, eyeMat: null, base: P.thread, size: skin.scale, skin: skin.id, tones: [P.body, P.joint, P.smoke], strings, drops,
    tell: (id) => (id === 'dance' ? legs[0].kn : id === 'yank' ? arms[0].wr : arms[1].wr),
    /**
     * Going down (src/enemies/defeat.js): its strings snap and the knot of smoke thins away; the puppet drops and folds
     * up where it lands, knees under it, head down, arms loose: a heap of limbs with nothing holding it up.
     */
    defeat(f, c, u) {
      strings.visible = u < 0.16;
      const thin = smooth(u, 0.05, 0.5);
      smoke.scale.multiplyScalar(Math.max(0.01, 1 - thin)); smoke.visible = thin < 0.98;
      const k = smooth(u, 0.35, 0.8);
      legs.forEach((L) => { L.hip.rotation.x = lerp(L.hip.rotation.x, -1.35, k); L.kn.rotation.x = lerp(L.kn.rotation.x, 2.4, k); L.an.rotation.x = lerp(L.an.rotation.x, 0.6, k); });
      arms.forEach((A) => { A.sh.rotation.x = lerp(A.sh.rotation.x, 0.3, k); A.sh.rotation.z = lerp(A.sh.rotation.z, A.s * 0.35, k); A.el.rotation.x = lerp(A.el.rotation.x, -0.6, k); });
      neck.rotation.x = lerp(neck.rotation.x, 1.1, k);
      hang.rotation.set(lerp(hang.rotation.x, 0, k), hang.rotation.y, lerp(hang.rotation.z, 0, k));
      body.position.y -= 0.62 * k; body.rotation.x = lerp(body.rotation.x, 0.5, k);
    },
    /** Where a string it dropped on a creature can be cut (Foes.possess): its hand's end of it, in the world. */
    handAt: (i, out = new THREE.Vector3()) => arms[i].hold.getWorldPosition(out),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike', k = f.k ?? 0;
      const vx = prevX == null ? 0 : (f.pos.x - prevX) / dt, vz = prevX == null ? 0 : (f.pos.z - prevZ) / dt;
      prevX = f.pos.x; prevZ = f.pos.z;
      const speed = Math.min(6, Math.hypot(vx, vz));
      const P0 = pose.update(dt, { state: f.state, k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      g.position.y += f.alt;
      // the pendulum from the knot: it swings behind as it sets off, past as it stops
      anchor.getWorldPosition(anchorW);
      swing.update(dt, anchorW, f.heading);
      const slack = f.stunned > 0 ? 1 : 0;
      hang.rotation.set(-swing.a * (1 - slack * 0.5) + P0.pitch, P0.yaw, swing.b + P0.roll);
      // it jerks as it moves: every so often a string tugs a limb up, and lets it drop
      tugT -= dt;
      if (speed > 0.4 && tugT <= 0) { tugs[Math.floor(Math.random() * 4)] = 1; tugT = PL.jerk.every * (0.7 + Math.random() * 0.6); lift = 1; }
      for (let i = 0; i < 4; i++) tugs[i] = Math.max(0, tugs[i] - dt * 3.5);
      lift = Math.max(0, lift - dt * 5);
      // the dance: dropped low, legs jerked up together; then the whirl
      const dance = id === 'dance' ? (wind ? c.wind : strike ? 1 : 0) : 0;
      if (id === 'dance' && strike) spinY += dt * 16; else spinY = ease(spinY, Math.round(spinY / (Math.PI * 2)) * Math.PI * 2, 4, dt);
      body.position.set(0, CHEST - PL.anchor + P0.y + lift * 0.06 - slack * 0.35, P0.z);
      body.rotation.set(0.08 + slack * 0.4, spinY, 0);
      // the limbs: loose springs after the body's drift and the swing, the tugs on top; the poses of its attacks
      const ch = Math.cos(f.heading), sh = Math.sin(f.heading), fwd = vx * sh + vz * ch, side = vx * ch - vz * sh;
      const sway = (i) => Math.sin(c.now / 900 + i * 1.9 + f.home.x) * (f.state === 'idle' ? 0.05 : 0.08);
      const up = id === 'strings' && wind ? c.wind : 0, yank = id === 'yank' ? (wind ? c.wind : strike ? 1 : 0) : 0;
      arms.forEach((A, i) => {
        const [sx, sz] = limbs.arms[i];
        let x = sx.update(dt, THREE.MathUtils.clamp(-fwd * 0.12 + swing.va * 0.1, -0.8, 0.8) + sway(i)) - tugs[i] * 0.9;
        let z = sz.update(dt, THREE.MathUtils.clamp(side * 0.1, -0.6, 0.6)) + A.s * (0.06 + slack * 0.2);
        let elb = -0.15 - tugs[i] * 0.8, curl = 0.2, raise = 0;
        // the strings: both upper arms lifted out level, the forearms up, the hands high, the fingers curling
        x = lerp(x, 0, up); z = lerp(z, A.s * 1.45, up); elb = lerp(elb, 0, up); raise = A.s * 1.5 * up; curl = lerp(curl, 1.2, up);
        // the yank: its right arm rises high, the string swinging out
        if (i === 0) { x = lerp(x, -2.4, yank); z = lerp(z, A.s * 0.3, yank); elb = lerp(elb, -0.3, yank); }
        // the dance: arms flung out
        z = lerp(z, A.s * 1.0, dance); elb = lerp(elb, -0.5, dance);
        A.sh.rotation.set(x, 0, z); A.el.rotation.set(elb, 0, raise);
        A.fingers.rotation.x = curl + (wind ? Math.sin(c.now / 90 + i) * 0.15 : 0);
      });
      legs.forEach((L, i) => {
        const [sx, sz] = limbs.legs[i];
        let x = sx.update(dt, THREE.MathUtils.clamp(-fwd * 0.1 - swing.va * 0.12, -0.7, 0.7) + sway(i + 2)) - tugs[2 + i] * 0.7;
        const z = sz.update(dt, THREE.MathUtils.clamp(side * 0.08, -0.4, 0.4)) * 0.6;
        let knee = 0.12 + tugs[2 + i] * 0.9 + slack * 0.6;
        // the dance: both legs jerked up together, knees bent; kicking round in the whirl
        x = lerp(x, -1.25, dance); knee = lerp(knee, 1.5, dance);
        if (id === 'dance' && strike) { x = -0.9 + Math.sin(c.now / 60 + i * Math.PI) * 0.6; knee = 0.6 + Math.sin(c.now / 60 + i * Math.PI + 1) * 0.5; }
        L.hip.rotation.set(x, 0, z + L.s * 0.03); L.kn.rotation.x = knee; L.an.rotation.x = 0.25 - knee * 0.2;
      });
      // the head: tipped forward, limp; lifted a little as it winds up (it has no eyes: the strings do the looking)
      neck.rotation.set(lerp(0.55, 0.1, Math.max(up, yank)) + slack * 0.3, 0, Math.sin(c.now / 1300 + f.home.z) * 0.05);
      waist.rotation.set(-0.04 + swing.va * 0.03, 0, swing.vb * 0.03);
      smoke.rotation.y += dt * 0.25;
      const breath = 1 + Math.sin(c.now / 500 + f.home.x) * 0.06 + (wind ? 0.12 * c.wind : 0);
      smoke.scale.setScalar(breath);
      if (Math.random() < 0.04 + (wind ? 0.15 : 0)) c.spray(anchor.localToWorld(_v.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)), [P.smoke, P.smoke2 ?? P.smoke], 1, 0.4, -0.8);
      // the strings it drops: unspooling from its hands down onto its creature (or out at you for the yank), held taut
      const host = f.host?.alive && f.host.dead === undefined ? f.host : null, target = wind && id === 'strings' ? f.allyTarget : host;
      const reach = wind && id === 'strings' ? smooth(k, 0.25, 0.95) : host ? 1 : 0;
      unspool = ease(unspool, reach, 8, dt);
      g.updateMatrixWorld(true);
      drops.forEach((m, i) => {
        // (nothing to drop them on yet, as the sheet draws it: the strings unspool straight down from its hands)
        const at = id === 'yank' && (wind || strike) ? c.eye : target ? _a.copy(target.chest) : wind && id === 'strings' ? arms[i].hold.getWorldPosition(_a).add(_w.set(arms[i].s * 0.15, -2.4, 0.1)) : null;
        const show = at && (id === 'yank' ? (wind ? smooth(k, 0.4, 1) : 1) : unspool) > 0.02 && !(id === 'yank' && i === 1);
        m.visible = !!show;
        if (!show) return;
        const from = arms[i].hold.getWorldPosition(_v), to = _w.copy(at);
        if (id === 'yank') to.y += 1.2 * (1 - (strike ? 1 : smooth(k, 0.4, 1))) + 1;
        const u = id === 'yank' ? (strike ? 1 : smooth(k, 0.4, 1) * 0.9) : unspool;
        const d = to.sub(from).multiplyScalar(u), len = Math.max(0.01, d.length());
        m.position.copy(g.worldToLocal(from));
        d.applyQuaternion(_gq.copy(g.getWorldQuaternion(_gq)).invert()).normalize();
        m.quaternion.setFromUnitVectors(_down, d);
        m.scale.set(1, len / Math.max(1e-3, g.scale.y), 1);
      });
    },
    dispose: M.dispose,
  };
}

import * as THREE from 'three';
import { materials, add, pivot, finish, skinBy, merged, tubeGeometry, ease, eyeColor } from './kit.js';
import { gazePart } from '../gaze.js';
import { HumanoidDriver, HOLD_AT } from '../humanoid-rig.js';
import { Wielder } from '../wield.js';
import { PROWLER_MOVES, PROWLER_HOLD, PROWLER_STANCE, TailSpring, spinAngle, curvedBlade } from './monster.js';
import { tripoBiped, rolesOf } from './biped-tripo.js';

// The prowler's body (issue #800, family H: the pod stalker, the rebuild's approved image
// references/enemy-redesign-2026-10-30/prowler/5d011893-…-2.png): Tripo multiview task 283212a4-… from its T-pose sheets
// (the agent's pick, prowler/tpose/), rigged by Tripo (task 97ca2b8c-…, biped, Mixamo names, 23 joints, no fingers); the
// untouched exports in references/enemy-redesign-2026-10-30/prowler/tripo/, made into public/enemies/prowler/ by the
// trial's prepare-prowler.mjs (references/enemy-redesign-2026-10-30/trials/familyH-tripo/: the game's frame, 1.9 m to its
// crown in the T-pose, four flat colours by part with clean cut borders, 12.7k triangles, Tripo's weights kept, a tail of
// five joints added after Tripo's), loaded by src/enemies/foe-assets.js. Every skin is drawn in vertex colours. The
// legacy lizard (monster.js legacyProwlerModel) stands in only while the asset loads.
//
// Tripo's biped rig posed directly by the clips (biped-tripo.js): the same moves (PROWLER_MOVES), stance (leaning
// forward, the head brought back up level), holds and life as the legacy body: the curved blade in its right hand (its
// slash and its dart: the haft through the hand's measured centre, Wielder `at`; Tripo's hands are mittens), the tail on
// its own five bones sprung (TailSpring: lashing as it winds up, straight out at knee height through the tail sweep,
// curled in the back-flip, kept off the ground), the spit lobbed from its mouth, the back-flip out of a combo. Its head
// turns to the traveller on Tripo's head bone, its two black dot eyes (painted on Tripo's texture, painted out by the
// prepare, measured) sliding the rest of the way; its mouth line an ink line on the head.

/** The flat texture's parts (prepare-prowler.mjs PALETTE, skeleton.json palette), for another skin's recolour. */
const ROLES = { skin: '#926456', muzzle: '#dcc99b', belly: '#767957', ink: '#1a1210' };
/** A skin's colour for each part (its palette; the home skin draws the asset's own). */
const roleColours = (P) => ({ skin: P.skin, muzzle: P.muzzle ?? P.belly2 ?? P.belly, belly: P.belly, ink: P.ink });
/** The arms a little out from its heavy flanks (rad, over the clips'), as the dune mummer's gourd. */
export const PROWLER_TRIPO_ARMS = 0.22;
/** The blade a little bigger than the legacy lizard's, for Tripo's broad hands (× its size). */
export const PROWLER_TRIPO_BLADE = 1.25;
/** How far its curved blade's edge and point stand off the haft's line (m): kept that much more off the ground (Wielder `head`). */
export const PROWLER_TRIPO_BLADE_CURVE = 0.12;
const STANCE = PROWLER_STANCE;
/** Its pads stiff under this height (m): carried whole on the foot (biped-tripo.js soles), flat on a slope. */
export const PROWLER_TRIPO_SOLES = 0.08;

/** The prowler's body (the model contract of plans/index.js), from its loaded source (src/enemies/foe-assets.js). */
export function tripoProwlerModel(skin, src) {
  const home = skin.id === 'desert' && !skin.tier;
  const P = skin.palette, M = materials('prowler', skin);
  const g = new THREE.Group(); g.name = `${skin.name} · pod stalker (Tripo)`;
  // the tail's bones (made in the bind pose: each segment along the measured line, its rest pitch from the one before)
  const T = (src.rig ?? src.skeleton).tail, segs = [], rest = [];
  const B = tripoBiped(g, src, {
    look: { yaw: 0.55, up: 0.3, down: 0.35 }, soles: PROWLER_TRIPO_SOLES,
    recolour: home ? null : (col) => { const { keys, role } = rolesOf(col, ROLES), want = roleColours(P), c = keys.map((k) => new THREE.Color(want[k] ?? ROLES[k])), out = new Float32Array(col.count * 3);
      for (let v = 0; v < col.count; v++) { const x = c[role[v]]; out[v * 3] = x.r; out[v * 3 + 1] = x.g; out[v * 3 + 2] = x.b; } return out; },
    extra: (J, look, at) => {
      const pts = T.points.map((p) => new THREE.Vector3(...p)), out = {};
      let prev = 0;
      for (let i = 0; i < T.n; i++) {
        const d = pts[i + 1].clone().sub(pts[i]), abs = Math.atan2(-d.y, -d.z);
        rest.push(abs - prev); prev = abs;
        const s = i ? pivot(segs[i - 1], 0, 0, -T.len, `tail ${i}`) : pivot(J.torso, pts[0].x - at.Hips.x, pts[0].y - at.Hips.y, pts[0].z - at.Hips.z, 'tail 0');
        s.rotation.set(-rest[i], 0, 0, 'YXZ');
        segs.push(s); out[`Tail${i}`] = s;
      }
      return out;
    },
  });
  const { J, rig, look, gaze, D, hands: hc, side } = B;
  // (its broad flat pads on the ground while planted: humanoid-rig.js J.ballOnGround, J.flatFeet)
  J.ballOnGround = true; J.flatFeet = 0.8;
  // ---------------------------------------------------------------- the face: eyes and the mouth line, on the look
  const face = pivot(look, 0, 0, 0, 'face');
  look.updateWorldMatrix(true, false);
  const inLook = new THREE.Matrix4().copy(look.matrixWorld).invert(), local = (p) => new THREE.Vector3(...p).applyMatrix4(inLook);
  const builds = new Map(), tint = (hex) => { if (!builds.has(hex)) builds.set(hex, M.mat(`prB${hex}`, hex)); return builds.get(hex); };
  const S = B.S, eyeM = M.own('eye', P.eye, { glow: 0.6 });
  const eyeGeo = merged((S.eyes ?? []).filter(Boolean).map((e) => {
    const r = [Math.max(0.011, e.size[0] * 0.55), Math.max(0.016, e.size[1] * 0.5), 0.012], c = local(e.centre);
    return new THREE.SphereGeometry(1, 12, 9).scale(...r).translate(c.x, c.y, c.z + 0.004);
  }));
  // (the mesh at the eyes' middle, its geometry about it: the slide moves it from there)
  eyeGeo.computeBoundingBox();
  const eyeMid = eyeGeo.boundingBox.getCenter(new THREE.Vector3());
  eyeGeo.translate(-eyeMid.x, -eyeMid.y, -eyeMid.z);
  const eyes = add(face, eyeGeo, eyeM, eyeMid.x, eyeMid.y, eyeMid.z);
  gaze.push(gazePart(g, eyes, { mode: 'slide', slide: 0.012 }));
  const mouth = (S.marks?.mouth ?? []).map(local);
  if (mouth.length > 3) add(face, tubeGeometry(mouth.filter((_, i) => i % 3 === 0 || i === mouth.length - 1), 0.0045), tint(P.ink));
  // ---------------------------------------------------------------- the blade: through the right hand's centre
  const gripAt = [0, 1].map((i) => J.hands[i].worldToLocal(new THREE.Vector3(...hc[side(i)].centre)));
  const grip = pivot(J.hands[0], gripAt[0].x, gripAt[0].y, gripAt[0].z, 'grip');
  const k = PROWLER_TRIPO_BLADE;
  add(grip, merged([curvedBlade(0.44 * k, 0.1 * k, 0.3, 0.06 * k, 0.011 * k), new THREE.BoxGeometry(0.034 * k, 0.016 * k, 0.1 * k).translate(0, 0.058 * k, 0.01 * k)]), tint(P.steel));
  add(grip, merged([new THREE.CylinderGeometry(0.014 * k, 0.016 * k, 0.11 * k, 7), new THREE.SphereGeometry(0.018 * k, 6, 5).translate(0, -0.06 * k, 0)]), tint(P.leather));
  // ---------------------------------------------------------------- bound, then the clips
  const bodyM = M.mat('prTripo', '#ffffff', { vertexColors: true });
  B.bind(bodyM);
  for (let i = 0; i < T.n; i++) segs[i].rotation.set(-rest[i], 0, 0, 'YXZ');
  const limbM = M.mat('prLimb', '#ffffff', { vertexColors: true });
  skinBy(g, [{ from: [...builds.values()], into: limbM }]);
  // (swept, straight out level at its root's knee height: the torso's lean taken back at the root)
  // (its rest the measured line, the stance's lean of its torso taken back at the root: it lies on the ground as built)
  const tail = new TailSpring(segs, rest.map((x, i) => (i ? x : x + STANCE.lean)), { len: T.len, flat: segs.map((_, i) => (i ? 0 : STANCE.lean)), radius: T.radius });
  let cur = null;
  const style = (Jt, want) => {
    J.torso.rotateX(STANCE.lean); J.head.rotateX(STANCE.look);
    for (const kn of J.knees) kn.rotateX(STANCE.knee);
    // (its broad flat feet kept as the clip has them under the knees' bend: tipped with the shins, its toes went 5 cm into
    //  the ground standing; the legacy lizard stood on its toes)
    for (const ft of J.feet) ft.rotateX(-STANCE.knee);
    J.arms[0].rotateZ(-PROWLER_TRIPO_ARMS); J.arms[1].rotateZ(PROWLER_TRIPO_ARMS);
    const Mv = cur?.atk ? PROWLER_MOVES[cur.atk.id] : null;
    if (Mv && want.clip) J.body.rotateY(spinAngle(want, cur.k, Mv));
    if (cur?.atk?.id === 'spit' && want.clip) { const kk = want.kind === 'wind' ? Math.min(1, want.load ?? 0) * (want.thrown > 0 ? 1 - want.thrown : 1) : 0; J.head.rotateX(-0.6 * kk); J.torso.rotateX(-0.15 * kk); }
  };
  const driver = new HumanoidDriver(J, rig, { moves: PROWLER_MOVES, speeds: { walk: 0.8, jog: 2.6, sprint: 5.0 }, style, seat: 0.3 });
  // (its reach the bigger blade's and its curve over the line: the wielder keeps it that far off the ground, #332)
  const wield = new Wielder(J, driver, { fists: [null, null], grips: [grip, null], at: gripAt.map((p) => p.toArray()), weapons: { blade: { ...PROWLER_HOLD.blade, reach: PROWLER_HOLD.blade.reach.map((x) => x * k), head: PROWLER_TRIPO_BLADE_CURVE } } });
  finish(g);
  eyes.castShadow = false;
  const parts = [J.torso, J.head, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet, ...segs];
  let glow = 0;
  const _hinge = new THREE.Vector3(), _hq = new THREE.Quaternion(), _ax = new THREE.Vector3(1, 0, 0);
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.skin, P.belly, P.muzzle ?? P.belly],
    driver, joints: J, tail, wield, fists: [null, null], archetype: 'prowler', body3d: 'tripo',
    tripo: { bones: B.bones.length, tail: T.n, eyes: (S.eyes ?? []).filter(Boolean).length, mouth: mouth.length, eyeMid: eyeMid.toArray() },
    tell: (id) => (id === 'tail' ? segs[3] : id === 'spit' ? look : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0);
      cur = f;
      const want = driver.update(f, c);
      // (its broad pads over the ground as posed, standing and walking: biped-tripo.js soleUp)
      if (!f.hopBack && !['down', 'sleep', 'sit', 'fall'].includes(want?.kind)) B.soleUp(c.ground, f.pos.y);
      // the back-flip (its evade, fight.evade.flip): the whole body turned over backwards about its hips over the hop,
      // its legs tucked, its tail curled up over it
      const H_ = f.hopBack, flip = H_ && f.fight?.evade?.flip ? Math.min(1, H_.u ?? 0) : 0;
      if (flip > 0) {
        const e = flip * flip * (3 - 2 * flip), tuck = Math.sin(Math.PI * flip);
        _hinge.set(0, D.hip, 0);
        _hq.setFromAxisAngle(_ax, -Math.PI * 2 * e);
        J.body.position.sub(_hinge).applyQuaternion(_hq).add(_hinge);
        J.body.quaternion.premultiply(_hq);
        for (const l of J.legs) l.rotateX(-STANCE.flipTuck * tuck);
        for (const kn of J.knees) kn.rotateX(STANCE.flipTuck * 1.3 * tuck);
      }
      wield.update(f, want, c, 'blade');
      const id = f.atk?.id, active = f.state === 'wind' || f.state === 'strike';
      const sweep = id === 'tail' && active ? (f.state === 'strike' ? 1 : Math.min(1, (f.k ?? 0) / HOLD_AT)) : 0;
      tail.update(dt, f.heading + (rig.rotation.y ?? 0) + (sweep ? spinAngle(want, f.k, PROWLER_MOVES.tail) : 0), driver.speed,
        { lash: f.state === 'wind' ? (id === 'dart' ? 1 : 0.6) : f.rage ? 0.5 : 0.18, sweep, curl: flip > 0 ? Math.sin(Math.PI * flip) : 0 });
      if (!flip) tail.keepUp(f.pos.y, 0.05, c.ground);
      if (id === 'spit' && f.state === 'wind' && f.k > PROWLER_MOVES.spit.release) c.lob(f, (f.k - PROWLER_MOVES.spit.release) / (1 - PROWLER_MOVES.spit.release), P.spit); else c.lob(f, -1, P.spit);
      glow = ease(glow, f.state === 'wind' ? 1 : 0, 6, dt || 1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.5 + 0.4 * glow;
      return want;
    },
    dispose: M.dispose,
  };
}

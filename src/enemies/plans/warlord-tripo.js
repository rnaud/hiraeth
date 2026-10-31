import * as THREE from 'three';
import { materials, add, pivot, finish, skinBy, merged, ease, eyeColor, plate, shellPlate } from './kit.js';
import { gazePart } from '../gaze.js';
import { HumanoidDriver } from '../humanoid-rig.js';
import { Wielder } from '../wield.js';
import { WARLORD_MOVES, WARLORD_HOLD, WARLORD_STANCE, spinAngle } from './monster.js';
import { tripoBiped, rolesOf } from './biped-tripo.js';

// The warlord's body (issue #800, family H: the resonator chief, the rebuild's approved image
// references/enemy-redesign-2026-10-30/warlord/b7d9aa56-…-2.png): Tripo multiview task 3216cc93-… from its T-pose sheets
// (the agent's pick, warlord/tpose/), rigged by Tripo (task 7a282536-…, biped, Mixamo names, 23 joints, no fingers); the
// untouched exports in references/enemy-redesign-2026-10-30/warlord/tripo/, made into public/enemies/warlord/ by the
// trial's prepare-warlord.mjs (references/enemy-redesign-2026-10-30/trials/familyH-tripo/: the game's frame, 2.5 m to the
// egg's top in the T-pose, four flat colours with clean cut borders, the salmon belly painted on its oval, Tripo's
// weights kept), loaded by src/enemies/foe-assets.js. Every skin is drawn in vertex colours. The legacy crimson lion
// (monster.js legacyWarlordModel) stands in only while the asset loads.
//
// Tripo's biped rig posed directly by the clips (biped-tripo.js): the same moves (WARLORD_MOVES: the sweep, the overhead,
// the charge, the roar, the last stand's whirl), stance and holds as the legacy body. What it wields is the approved
// picture's: a long forked iron staff, the resonator, in its right hand (WARLORD_HOLD's glaive: the same length, held
// through the hand's measured centre, Wielder `at`; Tripo's hands are mittens). Its four bronze plates (src/enemies/
// fight.js ARMOUR.warlord, in the order they fall: the right shoulder, the left, the right greave, the left) fitted to
// Tripo's arms and shins (their girth measured in the prepare). Its head turns to the traveller on Tripo's head bone, its
// two heavy-lidded slit eyes (painted on Tripo's texture, painted out by the prepare, measured) on it, sliding the rest of
// the way; in the roar its head is thrown back, its arms flung wide.

/** The flat texture's parts (prepare-warlord.mjs PALETTE, skeleton.json palette), for another skin's recolour. */
const ROLES = { body: '#c75c3f', belly: '#dc7a54', cream: '#e4c89b', shoe: '#51304a' };
/** A skin's colour for each part (its palette; the home skin draws the asset's own). */
const roleColours = (P) => ({ body: P.skin, belly: P.belly ?? P.skin2, cream: P.cream ?? P.horn, shoe: P.shoe ?? P.leather });
/** The arms out from its round flanks (rad over the clips'), as the dune mummer's gourd. */
export const WARLORD_TRIPO_ARMS = 0.32;
/** Its flat shoes stiff under this height (m): carried whole on the foot (biped-tripo.js soles). */
export const WARLORD_TRIPO_SOLES = 0.1;
/** The staff (m at size 1): its length, where it is held (from its butt), the fork's prongs' height and spread, the shaft's radius. */
export const STAFF = { L: 2.4, lo: -0.72, prong: 0.34, spread: 0.13, r: 0.034 };

/** The resonator: a long iron shaft along +y from `lo` with a two-pronged fork on top (a tuning fork's), a collar at its grip. */
function staffParts() {
  const S = STAFF, top = S.lo + S.L, base = top - S.prong, out = [];
  out.push(new THREE.CylinderGeometry(S.r, S.r * 1.1, S.L - S.prong + 0.02, 8).translate(0, S.lo + (S.L - S.prong) / 2, 0));
  // (the fork's crown: a bar across, the two prongs up from its ends, a little apart at their tips)
  out.push(new THREE.CylinderGeometry(S.r * 1.15, S.r * 1.15, S.spread * 2 + S.r * 2, 8).rotateZ(Math.PI / 2).translate(0, base, 0));
  for (const s of [-1, 1]) out.push(new THREE.CylinderGeometry(S.r * 0.8, S.r * 1.05, S.prong, 7).rotateZ(-s * 0.06).translate(s * (S.spread + S.r * 0.4), base + S.prong / 2, 0));
  for (const s of [-1, 1]) out.push(new THREE.SphereGeometry(S.r * 1.1, 8, 6).translate(s * S.spread, base, 0));
  // (a knob at the butt)
  out.push(new THREE.SphereGeometry(S.r * 1.3, 8, 6).translate(0, S.lo, 0));
  return merged(out);
}

/** The warlord's body (the model contract of plans/index.js), from its loaded source (src/enemies/foe-assets.js). */
export function tripoWarlordModel(skin, src) {
  const home = skin.id === 'desert' && !skin.tier;
  const P = skin.palette, M = materials('warlord', skin);
  const g = new THREE.Group(); g.name = `${skin.name} · resonator chief (Tripo)`;
  const S0 = src.rig ?? src.skeleton;
  const B = tripoBiped(g, src, {
    look: { yaw: 0.6, up: 0.3, down: 0.35 }, soles: WARLORD_TRIPO_SOLES,
    recolour: home ? null : (col) => { const { keys, role } = rolesOf(col, ROLES), want = roleColours(P), c = keys.map((k) => new THREE.Color(want[k] ?? ROLES[k])), out = new Float32Array(col.count * 3);
      for (let v = 0; v < col.count; v++) { const x = c[role[v]]; out[v * 3] = x.r; out[v * 3 + 1] = x.g; out[v * 3 + 2] = x.b; } return out; },
  });
  const { J, rig, look, gaze, hands: hc, side } = B;
  // (its broad shoes flat on the ground while planted: humanoid-rig.js J.flatFeet; biped-tripo.js soleUp. Not the
  //  prowler's J.ballOnGround: the ball held up out of the clip's height dragged its long shoes 0.14 m in a strafe)
  J.flatFeet = 0.8;
  // ---------------------------------------------------------------- the face: its slit eyes, on the look
  const face = pivot(look, 0, 0, 0, 'face');
  look.updateWorldMatrix(true, false);
  const inLook = new THREE.Matrix4().copy(look.matrixWorld).invert(), local = (p) => new THREE.Vector3(...p).applyMatrix4(inLook);
  const eyeM = M.own('eye', P.eye, { glow: 0.6 });
  const eyeGeo = merged((S0.eyes ?? []).filter(Boolean).map((e) => {
    const w = Math.max(0.06, e.size[0] * 0.95), h = Math.max(0.016, e.size[1] * 0.7), c = local([e.centre[0], e.centre[1], e.front]);
    return new THREE.CapsuleGeometry(h / 2, w - h, 3, 8).rotateZ(Math.PI / 2).scale(1, 1, 0.6).translate(c.x, c.y, c.z - 0.004);
  }));
  eyeGeo.computeBoundingBox();
  const eyeMid = eyeGeo.boundingBox.getCenter(new THREE.Vector3());
  eyeGeo.translate(-eyeMid.x, -eyeMid.y, -eyeMid.z);
  const eyes = add(face, eyeGeo, eyeM, eyeMid.x, eyeMid.y, eyeMid.z);
  gaze.push(gazePart(g, eyes, { mode: 'slide', slide: 0.01 }));
  // ---------------------------------------------------------------- the staff: through the right hand's centre
  const builds = new Map(), tint = (hex) => { if (!builds.has(hex)) builds.set(hex, M.mat(`wlB${hex}`, hex)); return builds.get(hex); };
  const gripAt = [0, 1].map((i) => J.hands[i].worldToLocal(new THREE.Vector3(...hc[side(i)].centre)));
  const grip = pivot(J.hands[0], gripAt[0].x, gripAt[0].y, gripAt[0].z, 'grip');
  add(grip, staffParts(), tint(P.iron ?? '#1f2e24'));
  // ---------------------------------------------------------------- bound, then its plates and the clips
  const bodyM = M.mat('wlTripo', '#ffffff', { vertexColors: true });
  B.bind(bodyM);
  const limbM = M.mat('wlLimb', '#ffffff', { vertexColors: true });
  skinBy(g, [{ from: [...builds.values()], into: limbM }]);
  // its four bronze plates (ARMOUR.warlord, in the order they fall): a dome over each shoulder and its lame, fitted to
  // the upper arm's girth; a greave down each shin with its knee cop, fitted to the shin's
  const plateM = M.mat('plate', P.bronze, { side: THREE.DoubleSide });
  const plates = [], Lb = S0.limbs ?? {};
  for (const [k, arm] of J.arms.entries()) {
    // (both sides the same: the two upper arms' median girth, the larger, a third out over it)
    const s = k ? 1 : -1, r = Math.max(0.12, Math.max(Lb.LeftArm?.median ?? 0.12, Lb.RightArm?.median ?? 0.12) * 1.35);
    const geo = merged([new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, 1.12).scale(1.05, 0.78, 1.05).rotateZ(s * 0.32).translate(s * 0.02, r * 0.3, 0),
      new THREE.SphereGeometry(r * 1.13, 14, 4, 0, Math.PI * 2, 0.95, 0.42).scale(1.04, 0.92, 1.06).rotateZ(s * 0.36).translate(s * 0.035, -r * 0.15, 0)]);
    plates.push(plate(arm, geo, plateM, 0, 0, 0, `pauldron ${s > 0 ? 'left' : 'right'}`));
  }
  for (const [k, knee] of J.knees.entries()) {
    const s = k ? 1 : -1, shin = B.D.shin, r = Math.max(0.08, Math.max(Lb.LeftLeg?.median ?? 0.1, Lb.RightLeg?.median ?? 0.1) * 1.05);
    const prof = Array.from({ length: 6 }, (_, i) => [r - 0.015 * (i / 5), -0.04 - (shin * 0.62) * (i / 5)]).reverse();
    const geo = merged([shellPlate(prof, -1.15, 2.3, { out: 0.012, thick: 0.03, segs: 10 }), new THREE.SphereGeometry(r * 1.1, 12, 7, -1.4, 2.8, 0.5, 1.6).translate(0, 0, 0.02)]);
    plates.push(plate(knee, geo, plateM, 0, 0, 0, `greave ${s > 0 ? 'left' : 'right'}`));
  }
  let cur = null;
  const style = (Jt, want) => {
    J.torso.rotateX(WARLORD_STANCE.chest);
    J.arms[0].rotateZ(-WARLORD_TRIPO_ARMS); J.arms[1].rotateZ(WARLORD_TRIPO_ARMS);
    const Mv = cur?.atk ? WARLORD_MOVES[cur.atk.id] : null;
    if (Mv && want.clip) J.body.rotateY(spinAngle(want, cur.k, Mv));
    if (cur?.atk?.id === 'roar' && want.kind === 'wind') J.head.rotateX(-0.5 * Math.min(1, want.load ?? 0));
    if (cur?.atk?.id === 'charge' && (want.kind === 'wind' || want.phase === 'strike')) J.head.rotateX(0.35 * (want.kind === 'wind' ? Math.min(1, want.load ?? 0) : 1));
  };
  const driver = new HumanoidDriver(J, rig, { moves: WARLORD_MOVES, speeds: { walk: 1.0, jog: 2.6, sprint: 5.2 }, style, seat: 0.4 });
  const wield = new Wielder(J, driver, { fists: [null, null], grips: [grip, null], at: gripAt.map((p) => p.toArray()), weapons: WARLORD_HOLD });
  finish(g);
  eyes.castShadow = false;
  const parts = [J.torso, J.head, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  let glow = 0;
  return {
    group: g, gaze, body: rig, rig: null, upright: true, ownRest: true, parts, plates, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.skin, P.cream ?? P.skin2, P.bronze],
    driver, joints: J, wield, fists: [null, null], archetype: 'warlord', body3d: 'tripo',
    tripo: { bones: B.bones.length, eyes: (S0.eyes ?? []).filter(Boolean).length, eyeMid: eyeMid.toArray() },
    tell: (id) => (id === 'roar' ? J.head : grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0);
      cur = f;
      const want = driver.update(f, c);
      // (its shoes over the ground as posed, standing and walking: biped-tripo.js soleUp)
      if (!['down', 'sleep', 'sit', 'fall'].includes(want?.kind)) { B.soleUp(c.ground, f.pos.y); }
      wield.update(f, want, c, 'glaive');
      glow = ease(glow, f.state === 'wind' ? 1 : 0, 6, dt || 1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.5 + 0.4 * glow;
      return want;
    },
    dispose: M.dispose,
  };
}

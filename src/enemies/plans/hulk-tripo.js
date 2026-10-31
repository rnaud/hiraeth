import * as THREE from 'three';
import { materials, add, many, pivot, finish, skinBy, merged, ease, eyeColor } from './kit.js';
import { HumanoidDriver } from '../humanoid-rig.js';
import { Wielder } from '../wield.js';
import { HULK_MOVES, HULK_HOLD, HULK_STANCE, liftOver, bandedClub } from './monster.js';
import { skinWith } from './dune-mummer.js';
import { tripoBiped, gripAt, roleColours } from './tripo-biped.js';

// The hulk's body (issue #800, family G): the approved redesign, the root crusher (references/enemy-redesign-2026-10-30/
// hulk/69ae4d9f-…-2.png: an enormous hunched brute of muted teal, a massive rounded back, a small head low at the front
// with two short black slit eyes and a dark mouth, a cream chest and belly, huge arms on rust-red knuckled fists, short
// thick legs on terracotta-toed feet), modelled by Tripo from the agent's T-pose picks (hulk/tpose/; multiview task
// c5f67b39-…; Tripo's v1.0 biped rig crossed its arms and set its feet behind it, so its v2.5 rig, e9f65356-…, the
// generic skeleton named as the Mixamo one by where each joint is: trials/familyG-tripo/foes.mjs), made the game's asset
// by the trial's prepare.mjs (2.6 m to the hump, six flat colours by part in the vertex colours, 12k triangles, Tripo's
// weights on every vertex), public/enemies/hulk/, loaded by src/enemies/foe-assets.js. Posed directly on the humanoid foe
// rig (plans/tripo-biped.js), its fists carried whole on the hands. Its old slate-blue horned hulk (plans/monster.js
// legacyHulkModel) stands in while it loads.
//
// Kept from the old hulk: its moves and holds (HULK_MOVES, HULK_HOLD: the club's smash and sweep in both fists, the stomp
// with one great foot raised high and stamped down, the grunt held high over its head and thrown), its banded club (no
// club in the approved image, which draws bare fists: kept, as the smash and the sweep are a club's swings and their reach
// is the club's), its look (the head bone: the low head and its slits turn to the traveller), its eyes taking the
// wind-up's colour. The approved image's hunch is the mesh's own, so less of it is laid over the clips (TRIPO_STANCE).

export const HULK_TRIPO_HEIGHT = 2.6;
/**
 * Its head's joint brought forward from Tripo's neck toward the middle of its low head (m): its face stands 0.45 m before
 * the neck, and the ragdoll's head, a ball at the head's middle, trembled on its long lever lying on its back and never slept
 * (tests/foe-ragdoll.test.js); turning about its middle, the head turns in place, as the approved image's sits.
 */
export const HULK_NECK = new THREE.Vector3(0, 0, 0.1);
/**
 * Its stance over the clip's pose (rad): the mesh is hunched already (the approved image's), and the clips' own lean on top
 * of it put its face and fists 0.75 m before its hips (into a wall 0.6 m before it, tests/foe-ragdoll.test.js): its chest
 * drawn back a little, its head tipped down as much so it looks ahead. Its stamp's leg swung higher than the old hulk's:
 * its thigh is a quarter shorter, and the great foot raised over its knee is the tell a jump answers.
 */
export const TRIPO_STANCE = { ...HULK_STANCE, hunch: -0.15, look: 0.15, stomp: { ...HULK_STANCE.stomp, thigh: 1.35, knee: 1.2 } };
/** The slits' size (m): the approved image's short black dashes (Tripo painted two specks of them). */
const SLIT = { w: 0.075, h: 0.016 };
const CLUB = { wood: '#6f5034', iron: '#4a4a50' };
/**
 * Its club shorter than the old hulk's (1.3 m against 1.75), carried with its forearm brought forward (`fore`): its long
 * arms hang its fists by its knees, and a club slanting off a hanging fist ran 66 cm into a slope behind it as it ran.
 * Its hold the old one's otherwise (HULK_HOLD: the same swings and reach, kept off the ground as far as the old club ran),
 * the other fist's place on the haft brought in with the club.
 */
export const HULK_CLUB = 1.3;
const K = HULK_CLUB / 1.75;
const scaled = (moves) => Object.fromEntries(Object.entries(moves).map(([id, m]) => [id, m.both ? { ...m, both: { ...m.both, at: m.both.at * K } } : m]));
export const HULK_TRIPO_HOLD = { club: { ...HULK_HOLD.club, carry: { ...HULK_HOLD.club.carry, fore: [0.1, -0.4, 0.9] }, moves: scaled(HULK_HOLD.club.moves) } };
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

/** The hulk's body (the model contract of plans/index.js), from its loaded source (src/enemies/foe-assets.js). */
export function tripoHulkModel(skin, src) {
  const P = skin.palette, M = materials('hulk', skin), S = src.rig, pal = S.palette;
  const g = new THREE.Group(); g.name = `${skin.name} · hulk (Tripo)`;
  const B = tripoBiped(g, src, roleColours(skin, pal, 'desert'), { rigid: { fist: 'hand' }, gaze: { yaw: 0.6, up: 0.35, down: 0.45 }, neck: HULK_NECK });
  const { J, look, gaze } = B;
  const builds = new Map(), tint = (hex) => { if (!builds.has(hex)) builds.set(hex, M.mat(`hkB${hex}`, hex)); return builds.get(hex); };
  const limbM = M.mat('hkLimb', '#ffffff', { vertexColors: true }), bodyM = M.mat('hkTripo', '#ffffff', { vertexColors: true });
  const dark = skin.tier ? 0.52 : 1, shade = (hex) => (dark === 1 ? hex : `#${new THREE.Color(hex).multiplyScalar(dark).getHexString()}`);
  // ---------------------------------------------------------------- the eyes: two short black slits on the head bone, either side
  const E = B.landmarks.eyes, mid = (E.left.centre[0] + E.right.centre[0]) / 2, half = (E.left.centre[0] - E.right.centre[0]) / 2;
  const y = (E.left.centre[1] + E.right.centre[1]) / 2, front = Math.max(E.left.front, E.right.front);
  look.updateWorldMatrix(true, false);
  const inLook = new THREE.Matrix4().copy(look.matrixWorld).invert(), eyes = pivot(look, 0, 0, 0, 'eyes');
  const slits = [1, -1].map((s) => { const c = new THREE.Vector3(mid + s * half, y, front + 0.002).applyMatrix4(inLook);
    return new THREE.CapsuleGeometry(SLIT.h / 2, SLIT.w - SLIT.h, 3, 8).rotateZ(Math.PI / 2).scale(1, 1, 0.5).rotateY(s * 0.25).translate(c.x, c.y, c.z); });
  const eyeM = M.own('eye', '#000000', { glow: 0.5 });
  add(eyes, merged(slits), eyeM);
  // ---------------------------------------------------------------- the club in its right fist
  const R = gripAt(J, B.hands, 0, 'grip'), L = gripAt(J, B.hands, 1, 'grip l');
  const club = pivot(R.grip, 0, 0, 0, 'club');
  { const p = bandedClub(HULK_CLUB); many(club, p.wood, tint(shade(CLUB.wood))); many(club, p.iron, tint(shade(CLUB.iron))); }
  // ---------------------------------------------------------------- bound in the bind pose, then the rig's rest
  const body = skinWith(g, B.geo, bodyM, B.bones); body.name = 'tripo body';
  B.rest();
  skinBy(g, [{ from: [...builds.values()], into: limbM }]);
  let cur = null;
  const style = (Jt, want) => {
    J.torso.rotateX(TRIPO_STANCE.hunch); J.head.rotateX(TRIPO_STANCE.look);
    J.arms[0].rotateZ(-0.12); J.arms[1].rotateZ(0.12);
    if (cur?.atk?.id !== 'stomp' || !want.clip) return;
    const k = want.kind === 'wind' ? smooth(want.load) : want.kind === 'strike' ? 1 - smooth((cur.k ?? 0) * 3) : 0, St = TRIPO_STANCE.stomp;
    if (k <= 0) return;
    // (a wrestler's stamp: the body raised over its standing leg, the other swung up and out, the knee half bent)
    liftOver(J, 1, St.rise * k, 0.08 * k);
    J.legs[0].rotateX(-St.thigh * k); J.legs[0].rotateZ(-St.out * k); J.knees[0].rotateX(St.knee * k); J.feet[0].rotateX(St.foot * k);
  };
  const driver = new HumanoidDriver(J, B.rig, { moves: HULK_MOVES, speeds: { walk: 1.0, jog: 2.4, sprint: 4.6 }, style, seat: 0.36 });
  const wield = new Wielder(J, driver, { fists: [null, null], grips: [R.grip, L.grip], at: [R.at.toArray(), L.at.toArray()], weapons: HULK_TRIPO_HOLD });
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [J.torso, J.head, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
  let glow = 0;
  return {
    group: g, gaze, body: B.rig, rig: null, body3d: 'tripo', upright: true, ownRest: true, parts, eyeMat: eyeM, base: '#000000', size: skin.scale, skin: skin.id, tones: [pal.skin, pal.belly, pal.fist],
    driver, joints: J, wield, fists: [null, null], archetype: 'hulk', height: HULK_TRIPO_HEIGHT, tripo: { bones: B.bones.length, slits: slits.length },
    tell: (id) => (id === 'throw' ? J.hands[1] : id === 'stomp' ? J.feet[0] : R.grip),
    anim(f, c) {
      const dt = Math.max(c.dt, 0);
      cur = f;
      const want = driver.update(f, c);
      // the club in its fist (HULK_HOLD); set down while it holds a grunt up, its hands open
      const throwing = f.atk?.id === 'throw' && f.state !== 'chase' && f.state !== 'idle';
      club.scale.setScalar(throwing ? 1e-3 : 1);
      wield.update(f, want, c, throwing ? null : 'club');
      glow = ease(glow, f.state === 'wind' ? 1 : 0, 6, dt || 1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, '#000000', P.flare ?? '#ffcf6a'));
      eyeM.uniforms.uGlow.value = 0.5 + 0.4 * glow;
      return want;
    },
    dispose: M.dispose,
  };
}

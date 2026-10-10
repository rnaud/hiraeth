import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { VerletChain } from '../../motion-kit/chain.js';
import { materials, add, tubeGeometry, many, skinBy, pivot, pair, lerp, ease, smooth, finish, V } from './kit.js';

// Plan 9, the humanoid spirit (docs/systems/procedural-animation.md §4, the kit's `humanoid`): the shade
// (docs/design/enemy-roster.md, archetype 19), drawn to its sheets (references/enemy-archetypes/shade/: sheet-1 Lorn II's
// hollow woodsman, sheet-2 the Eclipse's pilgrim). A cloak worn by nothing, 2.2 m to the hood's point: a long cloak
// from the shoulders to below the knees, open down the front on the dark inside, its hem torn into tatters that break
// into smoke; a capelet and a tall pointed hood (the woodsman's of rough bark, its point swept back; the pilgrim's round
// with a brass crescent on top), no face, only two white eyes in the dark of the hood; wide sleeves bent at the elbow,
// empty at the cuff but for a gauntlet on the sword hand; a brass clasp at the chest; long ribbons trailing from the
// hood; below the hem two empty boots, greaves to the knee ringed in brass, the knees bending.
//
// The manifestation: a cloak of smoke worn by nothing. The cloak hangs empty, its hem breaks into smoke that drops
// away; the sword is poured ink, drawn out of the sleeve as it comes for you and running back in when it calms.
//
// On the kit's `humanoid` plan: a biped on the gait planner, the boots touching down late and lifting early (it floats
// a little), the knees bending forward; the cloak hangs from its shoulders on springs that lag its moves (it sways back
// as it goes and swings round as it turns), its ribbons trail on verlet chains, the sleeves swing against the legs. Draws:
// every part of a material one skinned mesh on the kit's joints (kit.js skinBy), about eleven a shade.
//
// Its attacks read from the body (src/telegraph.js; nothing on the ground):
//   cut    the sword drawn back over its shoulder, the body turning away and the hood turning to keep you in sight;
//          then the cut across its front
//   feint  it starts the cut and stops halfway, the hood tilting; the sword drops to its hip and it sinks; then a
//          thrust, low and straight (a guard raised for the cut comes too early for the parry)
//   step   it sinks into its own shadow: the cloak collapses into a pool and the pool slides round beside you; it pours
//          up out of it there and cuts (recut). Lit (an ember), it is solid and can't step
// Calm (`pace`): it walks a path it walked in life, back and forth, and stops at the end of it as at a doorway, waiting.
// Skins (src/enemies/skins.js): the woodsman's bark hood (Lorn II), the vagrant's ragged coat (the City-Shaft), the
// mechanic's pointed hood and goggles (the Hangar), a halo over the hood (the Garden of Spheres), a glinting veil (the
// Glass Dunes), the pilgrim's crescent and belt lantern (the Eclipse).

const HIP_Y = 0.98, SH = { x: 0.27, y: 1.5 }, NECK = 1.62, UPPER = 0.34, FORE = 0.36;
const DEPTH = 0.78;   // (the cloak's depth to its width: the sheet's side view)
/** The cloak's profile (r, y) from the neck down to the hem (the hem torn: jag()). */
const CLOAK = [[0.13, 1.64], [0.25, 1.6], [0.32, 1.52], [0.35, 1.38], [0.37, 1.2], [0.41, 1.0], [0.47, 0.82], [0.52, 0.66]];
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _mr = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);

/** The torn hem: how far above its line a tatter's tip ends at angle a (rad round the body; 0 ahead), m. */
export const jag = (a, ragged = 1) => (0.1 * Math.abs(Math.sin(a * 5)) + 0.05 * Math.abs(Math.sin(a * 11 + 1)) - 0.12 * Math.max(0, -Math.cos(a))) * ragged;

/** A lathe from (r, y) pairs, its bottom row torn (jag), its front open by `gap` rad, its depth squashed. */
function cloakGeometry(profile, { gap = 0, ragged = 1, depth = DEPTH, seg = 28 } = {}) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, seg, gap / 2, Math.PI * 2 - gap);
  const pos = geo.attributes.position, n = pts.length;
  for (let i = 0; i < pos.count; i++) {
    const row = i % n, x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(x, z);
    let y = pos.getY(i);
    if (row === n - 1) y += jag(a, ragged);
    if (row >= n - 2) y -= 0.04 * Math.max(0, -Math.cos(a));   // (it trails a little longer behind)
    pos.setXYZ(i, x, y, z * depth);
  }
  geo.computeVertexNormals();
  return geo;
}

/** The hood: a lathe to a point, its point swept back (sweep m at the tip), or round and tall (the pilgrim's). */
function hoodGeometry(round, sweep) {
  const P = round ? [[0.2, -0.02], [0.215, 0.08], [0.205, 0.22], [0.17, 0.33], [0.11, 0.41], [0.03, 0.45], [0.001, 0.455]]
    : [[0.2, -0.02], [0.215, 0.08], [0.195, 0.22], [0.15, 0.34], [0.095, 0.44], [0.045, 0.54], [0.001, 0.62]];
  const geo = new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(r, y)), 18);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), k = Math.max(0, y - 0.18); pos.setZ(i, pos.getZ(i) * 0.95 - k * k * sweep); }
  geo.computeVertexNormals();
  return geo;
}

export function shadeModel(skin) {
  const PL = PLANS.humanoid, P = skin.palette, props = new Set(skin.props), M = materials('shade', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  const hull = pivot(body, 0, 0, 0, 'hull');
  // built in these; drawn as one skinned mesh a material on the moving parts' own joints (kit.js skinBy)
  const cloakB = M.mat('cloakBuild', P.cloak), liningB = M.mat('liningBuild', P.lining), faceB = M.mat('faceBuild', P.face);
  const hoodB = M.mat('hoodBuild', P.hood), stripB = M.mat('stripBuild', P.strip), brassB = M.mat('brassBuild', P.brass);
  const bootB = M.mat('bootBuild', P.boot), innerB = M.mat('innerBuild', P.inner), swordB = M.mat('swordBuild', P.sword), smokeB = M.mat('smokeBuild', P.smoke);
  // (the dark inside, the void of the hood: white-lined, the cartoon's negative, so a shade reads on dark ground at night)
  const cloakM = M.mat('cloak', P.cloak, { vertexColors: true }), liningM = M.mat('lining', P.lining, { vertexColors: true, flat: true, lineWhite: true });
  const hoodM = M.mat('hood', P.hood, { vertexColors: true, flat: props.has('bark') }), stripM = M.mat('strip', P.strip, { vertexColors: true });
  const brassM = M.mat('brass', P.brass, { metal: 'brass', color: P.brass, vertexColors: true });
  const bootM = M.mat('boot', P.boot, { vertexColors: true }), innerM = M.mat('inner', P.inner, { vertexColors: true });
  const swordM = M.own('sword', P.sword, { vertexColors: true, flat: false, glow: 0.05 }), smokeM = M.mat('smoke', P.smoke, { vertexColors: true });
  const eyeM = M.own('eye', P.eye, { glow: 0.95 }), poolM = M.own('pool', P.face, { flat: true });
  const ragged = props.has('ragged') ? 1.7 : 1;
  // the cloak: hung from its shoulders (`drape`: it lags the body on springs), open down the front on the dark inside
  const drape = pivot(hull, 0, SH.y, 0, 'drape');
  const shoulder = (geo) => geo.translate(0, -SH.y, 0);
  add(drape, shoulder(cloakGeometry(CLOAK, { gap: 0.55, ragged })), cloakB);
  add(drape, shoulder(cloakGeometry(CLOAK.map(([r, y]) => [r * 0.93, y]), { gap: 0, ragged: ragged * 0.9 })), liningB);
  // (gold trim down the opening and round the hem: the pilgrim's; the woodsman's a darker hem)
  // the brass clasp at the chest, where the cloak closes under the capelet
  many(drape, [new THREE.TorusGeometry(0.055, 0.016, 6, 16).translate(0, 1.43 - SH.y, 0.29 * DEPTH + 0.06), new THREE.CircleGeometry(0.04, 12).translate(0, 1.43 - SH.y, 0.29 * DEPTH + 0.055)], brassB);
  // smoke under the hem: puffs where the tatters break up, a few lower round the boots (they drift and drop)
  const smoke = pivot(drape, 0, 0.62 - SH.y, 0, 'smoke'), puffs = [];
  for (let i = 0; i < 22; i++) {
    const a = i * 2.39996, r = 0.34 + (i % 3) * 0.06, y = -0.02 - (i % 4) * 0.07 + jag(a, ragged) * 0.5;
    puffs.push(new THREE.IcosahedronGeometry(0.07 + (i % 3) * 0.03, 0).translate(Math.sin(a) * r, y, Math.cos(a) * r * DEPTH));
  }
  many(smoke, puffs, smokeB);
  // the head: a capelet over the shoulders, the hood (no face: the dark of it, two white eyes), its ribbons' roots
  const head = pivot(hull, 0, NECK, 0, 'head');
  add(head, cloakGeometry([[0.12, 0.04], [0.24, -0.02], [0.33, -0.1], [0.37, -0.2], [0.38, -0.26]], { gap: 0, ragged: 0.6, depth: 0.85, seg: 22 }), hoodB);
  const round = props.has('crescent');
  add(head, hoodGeometry(round, props.has('bark') || props.has('pointed') ? 1.3 : 0.6), hoodB, 0, 0.0, 0);
  // (the face: the dark inside the hood's opening, a rim of hood round it)
  many(head, [new THREE.CircleGeometry(1, 20).scale(0.13, 0.16, 1).translate(0, 0.17, 0.198)], faceB);
  many(head, [new THREE.TorusGeometry(1, 0.13, 6, 20).scale(0.15, 0.18, 0.4).translate(0, 0.17, 0.2)], hoodB);
  const eyes = new THREE.Group(); head.add(eyes); eyes.name = 'eyes';
  for (const s of [-1, 1]) add(eyes, new THREE.SphereGeometry(1, 8, 6).scale(0.024, 0.017, 0.01), eyeM, s * 0.05, 0.19, 0.21);
  // the skins' dress on the hood: the pilgrim's crescent on a knob, the halo shade's ring, the mechanic's goggles, the
  // nomad's glinting veil
  if (round) {
    many(head, [new THREE.TorusGeometry(0.075, 0.018, 6, 18, Math.PI * 1.3).rotateZ(-Math.PI * 0.15 + Math.PI).translate(0, 0.6, -0.02), new THREE.SphereGeometry(0.035, 8, 6).translate(0, 0.47, -0.02)], brassB);
  }
  if (props.has('halo')) many(head, [new THREE.TorusGeometry(0.2, 0.018, 6, 28).rotateX(Math.PI / 2 - 0.2).translate(0, 0.78, -0.12)], brassB);
  if (props.has('goggles')) many(head, pair((s) => new THREE.TorusGeometry(0.045, 0.014, 6, 14).translate(s * 0.06, 0.3, 0.17)), brassB);
  if (props.has('veil')) many(head, [new THREE.CylinderGeometry(0.17, 0.19, 0.12, 18, 1, true, -1, 2).translate(0, 0.08, 0.02)], stripB);
  // its ribbons: four long strips from the hood and the shoulders, trailing on verlet chains (each link its own joint)
  const STRIP = { n: 6, len: 0.15 };
  const strips = [[-0.14, NECK + 0.12, -0.06], [0.14, NECK + 0.12, -0.06], [-0.3, SH.y + 0.02, -0.04], [0.3, SH.y + 0.02, -0.04]].map(([x, y, z], k) => {
    const links = [];
    for (let i = 0; i < STRIP.n; i++) {
      const j = pivot(g, 0, 0, 0, `strip ${k}.${i}`);
      add(j, new THREE.BoxGeometry(0.055 - i * 0.004, STRIP.len * 1.15, 0.008).translate(0, -STRIP.len / 2, 0), stripB);
      links.push(j);
    }
    return { at: V(x, y, z), links, chain: new VerletChain({ n: STRIP.n, length: STRIP.len, stiffness: 0.08, damping: 0.9, gravity: 3.2 }), seed: k * 1.7 };
  });
  // the sleeves: a ball of shoulder under the cloak, an upper sleeve bent at the elbow, a wide bell of a forearm sleeve
  // open at the cuff (dark inside); on the sword hand a gauntlet, and the ink sword in it
  const arms = pair((s) => {
    const sh = pivot(hull, s * SH.x, SH.y, 0, 'shoulder');
    add(sh, new THREE.SphereGeometry(0.1, 10, 8), cloakB);
    add(sh, new THREE.CylinderGeometry(0.085, 0.1, UPPER, 10).translate(0, -UPPER / 2, 0), cloakB);
    const el = pivot(sh, 0, -UPPER, 0, 'elbow');
    add(el, new THREE.SphereGeometry(0.09, 10, 8), cloakB);
    add(el, new THREE.CylinderGeometry(0.085, 0.17, FORE, 12, 1, true).translate(0, -FORE / 2, 0), cloakB);
    add(el, new THREE.CylinderGeometry(0.078, 0.155, FORE * 0.96, 12, 1, true).translate(0, -FORE / 2, 0), liningB);
    add(el, new THREE.CircleGeometry(0.15, 12).rotateX(Math.PI / 2).translate(0, -FORE + 0.04, 0), liningB);
    const hand = pivot(el, 0, -FORE + 0.04, 0, 'hand');
    return { sh, el, hand, s };
  });
  // (the sword hand: arms[0] is its right (x < 0)): a gauntlet, and the sword poured out of it
  const [R, Lf] = arms;
  many(R.hand, [new THREE.CapsuleGeometry(0.05, 0.08, 4, 8).translate(0, -0.06, 0), new THREE.TorusGeometry(0.055, 0.012, 5, 12).rotateX(Math.PI / 2).translate(0, 0.0, 0)], bootB);
  const sword = pivot(R.hand, 0, -0.1, 0.02, 'sword');
  {
    // poured ink: a long flattened blade that waves a little, thinning to a point, drops hanging off its edges
    const L = props.has('ragged') ? 0.95 : 1.1, pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([Math.sin(t * 5) * 0.012, -t * L, Math.sin(t * 3 + 1) * 0.015]); }
    const blade = tubeGeometry(pts, 0.05, 0.006).scale(0.32, 1, 1);
    const drops = [blade, new THREE.SphereGeometry(0.045, 8, 6).scale(1.6, 0.7, 1).translate(0, -0.02, 0)];
    for (let i = 0; i < 7; i++) drops.push(new THREE.SphereGeometry(0.012 + (i % 3) * 0.005, 6, 4).translate((i % 2 ? 1 : -1) * 0.02, -0.15 - i * 0.12, 0.004));
    many(sword, drops, swordB);
  }
  // the belt lantern (the pilgrim's: it glows), the mechanic's wrench, the vagrant's patch
  let lamp = null;
  if (props.has('lantern')) {
    lamp = pivot(drape, 0.22, 1.12 - SH.y, 0.24, 'lantern');
    many(lamp, [new THREE.CylinderGeometry(0.03, 0.04, 0.03, 8).translate(0, 0.03, 0), new THREE.CylinderGeometry(0.035, 0.035, 0.015, 8).translate(0, -0.08, 0), new THREE.TorusGeometry(0.02, 0.005, 4, 8).translate(0, 0.06, 0)], brassB);
    add(lamp, new THREE.CylinderGeometry(0.03, 0.03, 0.09, 6).translate(0, -0.03, 0), M.own('flame', P.glow ?? '#ffd27a', { glow: 0.9 }));
  }
  if (props.has('wrench')) many(drape, [new THREE.BoxGeometry(0.03, 0.26, 0.02).translate(-0.24, 1.0 - SH.y, 0.26), new THREE.TorusGeometry(0.035, 0.012, 5, 10, Math.PI * 1.4).translate(-0.24, 1.14 - SH.y, 0.26)], brassB);
  // the empty boots on the kit: thighs of dark cloth (mostly under the cloak), greaves to the knee with a brass ring at
  // the knee and the ankle, pointed boots
  const legs = pair((s) => planLeg(PL, { group: g, body, hipParent: hull, hip: { x: s * 0.13, y: HIP_Y, z: 0 }, foot: { x: s * 0.15, z: 0.02 },
    radius: 0.065, balls: 0.8, taper: 0.3, pad: 'pad', ankle: 0.07, mats: { joint: innerB, thigh: innerB, shin: bootB, foot: bootB }, name: `shade leg ${s > 0 ? 'left' : 'right'}` }));
  for (const L of legs) {
    many(L.shin, [new THREE.CylinderGeometry(0.085, 0.072, L.lenB * 0.82, 10).translate(0, L.lenB * 0.47, 0), new THREE.SphereGeometry(0.075, 8, 6).scale(1, 0.7, 1.1).translate(0, 0.02, 0.02)], bootB);
    many(L.shin, [new THREE.TorusGeometry(0.083, 0.014, 5, 14).rotateX(Math.PI / 2).translate(0, 0.07, 0), new THREE.TorusGeometry(0.075, 0.012, 5, 14).rotateX(Math.PI / 2).translate(0, L.lenB * 0.86, 0)], brassB);
    many(L.foot, [new THREE.SphereGeometry(1, 10, 6).scale(0.07, 0.06, 0.16).translate(0, 0.06, 0.06), new THREE.ConeGeometry(0.045, 0.1, 8).rotateX(Math.PI / 2).translate(0, 0.045, 0.22)], bootB);
  }
  const rig = new Rig({ plan: PL, group: g, body, legs });
  // the pool it sinks into for the step (its own: it slides round beside you)
  const pool = add(g, new THREE.CircleGeometry(0.55, 18).rotateX(-Math.PI / 2), poolM, 0, 0.03, 0); pool.visible = false;
  const [, , , , , , , swordS] = skinBy(g, [
    { from: [cloakB], into: cloakM }, { from: [liningB, faceB], into: liningM }, { from: [hoodB], into: hoodM }, { from: [stripB], into: stripM },
    { from: [brassB], into: brassM }, { from: [bootB], into: bootM }, { from: [innerB], into: innerM }, { from: [swordB], into: swordM }, { from: [smokeB], into: smokeM },
  ]);
  finish(g);
  const parts = [hull, head, drape, ...arms.flatMap((a) => [a.sh, a.el, a.hand]), ...legs.map((l) => l.root)];
  // the cloak's lag and the hood's turn: springs
  const lagP = new SecondOrder(1.4, 0.35, 0), lagR = new SecondOrder(1.4, 0.35, 0), look = new SecondOrder(2.5, 0.7, 0);
  let drawn = 0, sink = 0, rise = 1, prevX = null, prevZ = 0, prevH = 0, swing = 0;
  const local = new THREE.Vector3();
  return {
    group: g, body: hull, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.cloak, P.smoke, P.face],
    tell: (id) => (id === 'step' ? hull : sword),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      const k = f.k ?? 0;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, recovery: c.recovery, air: 0, touch: c.touch });
      hull.position.set(o.x, o.y, o.z);
      hull.rotation.set(o.pitch, o.yaw, o.roll);
      // the velocity in its own frame: the cloak sways back as it goes, swings out as it turns
      const vx = prevX == null ? 0 : (f.pos.x - prevX) / dt, vz = prevX == null ? 0 : (f.pos.z - prevZ) / dt;
      const turn = prevX == null ? 0 : Math.atan2(Math.sin(f.heading - prevH), Math.cos(f.heading - prevH)) / dt;
      prevX = f.pos.x; prevZ = f.pos.z; prevH = f.heading;
      const ch = Math.cos(f.heading), sh = Math.sin(f.heading), fwd = vx * sh + vz * ch, side = vx * ch - vz * sh;
      const flutter = Math.sin(c.now / 380 + f.home.x) * 0.02;
      drape.rotation.x = lagP.update(dt, THREE.MathUtils.clamp(-fwd * 0.07, -0.35, 0.2)) + flutter;
      drape.rotation.z = lagR.update(dt, THREE.MathUtils.clamp(side * 0.06 + turn * 0.04, -0.3, 0.3));
      smoke.rotation.y += dt * 0.35;
      const breath = 1 + Math.sin(c.now / 300 + f.home.z) * 0.06;
      smoke.scale.set(breath, 1 + Math.sin(c.now / 410) * 0.1, breath);
      // the sword: poured out of the sleeve as it comes for you, back in as it calms (and gone into the pool)
      const fighting = f.state !== 'idle' && f.state !== 'home';
      drawn = ease(drawn, fighting && !(id === 'step' && wind) ? 1 : 0, fighting ? 5 : 2, dt);
      sword.scale.set(1, Math.max(0.02, drawn), 1);
      if (swordS) swordS.visible = drawn > 0.04;
      // the sleeves swing against the legs (by the distance walked); the sword arm carries its blade low and forward
      const walk = Math.sin(rig.walked * 3.4) * Math.min(1, Math.hypot(rig.vel.x, rig.vel.z) / 2) * 0.32;
      let rx = walk, rz = 0.08, re = -0.35, rh = -0.9 * drawn, lx = -walk, lz = -0.08, le = -0.4;
      let tilt = 0;
      if (id === 'cut' || id === 'recut') {
        // the cut: the arm up and back over its shoulder, the sword pointing back; then across its front
        const w = wind ? c.wind : 0;
        rx = lerp(rx, -2.75, w); rz = lerp(rz, 0.35, w); re = lerp(re, -1.35, w); rh = lerp(rh, 0.2, w);
        lx = lerp(lx, -0.7, w); le = lerp(le, -0.9, w);
        if (strike) { const r = c.release; rx = lerp(-2.75, -0.7, r); rz = lerp(0.35, -0.75, r); re = lerp(-1.35, -0.15, r); rh = lerp(0.2, -0.3, r); lx = -0.4; le = -0.6; }
      } else if (id === 'feint') {
        // the feint: the cut's wind-up begun (to half), held, the hood tilting; the sword dropped to its hip; the thrust
        const A = f.atk.feint ?? 0.45;
        const up = wind ? smooth(k, 0, A * 0.8) * (1 - smooth(k, A + 0.05, A + 0.2)) : 0, hip = wind ? smooth(k, A + 0.05, 0.75) : 0;
        rx = lerp(lerp(rx, -1.7, up), 0.25, hip); rz = lerp(lerp(rz, 0.3, up), 0.1, hip); re = lerp(lerp(re, -1.2, up), -1.75, hip); rh = lerp(lerp(rh, 0.1, up), 0.1, hip);
        lx = lerp(lx, 0.45, hip); le = lerp(le, -0.5, hip);
        tilt = wind ? smooth(k, A - 0.05, A + 0.08) * (1 - smooth(k, A + 0.3, 0.75)) * 0.4 : 0;
        if (strike) { const r = c.release; rx = lerp(0.25, -1.45, r); rz = 0.05; re = lerp(-1.75, -0.08, r); rh = lerp(0.1, -0.05, r); lx = 0.6; le = -0.3; }
      }
      // the step: it sinks into its pool, the pool slides round beside you; it pours up out of it for the recut
      const stepping = id === 'step' && wind;
      sink = ease(sink, stepping ? c.wind : 0, stepping ? 9 : 14, dt);
      rise = id === 'recut' && wind ? Math.min(rise, 0.2) : 1;
      if (id === 'recut' && wind) rise = Math.max(0.22, smooth(k, 0, 0.55));
      const tall = Math.min(1 - sink * 0.85, rise);
      const squash = Math.max(0.22, tall);
      g.scale.set(skin.scale, skin.scale * squash, skin.scale);
      pool.visible = sink > 0.05 || tall < 0.95;
      if (pool.visible) {
        pool.scale.setScalar(0.6 + 0.8 * Math.max(sink, 1 - tall));
        pool.scale.y = 1 / squash;   // (flat on the ground whatever the body's squash)
        // (it slides toward where it will come up: beside you)
        if (stepping) { g.updateMatrixWorld(true); local.copy(f.attackAt); g.worldToLocal(local); const t = smooth(k, 0.35, 1); pool.position.set(local.x * t, 0.03 / squash, local.z * t); }
        else pool.position.set(0, 0.03, 0);
      }
      R.sh.rotation.set(rx, 0, -rz); R.el.rotation.x = re; R.hand.rotation.x = rh;
      Lf.sh.rotation.set(lx, 0, -lz); Lf.el.rotation.x = le;
      // the hood: turned to keep you in sight against the body's own turn (the cut turns it away), tilted in the feint
      const want = THREE.MathUtils.clamp(-o.yaw, -0.9, 0.9) + (f.state === 'idle' ? Math.sin(c.now / 1700 + f.home.x) * 0.25 : 0);
      head.rotation.set(-0.05, look.update(dt, want), tilt);
      // the ribbons trail on their chains (world space), each link a joint of the skinned strips
      g.updateMatrixWorld(true); _m.copy(g.matrixWorld).invert(); _mr.extractRotation(_m);
      for (const S of strips) {
        const root = head.localToWorld(_v.copy(S.at).sub(V(0, NECK, 0)));
        const back = _w.set(-Math.sin(f.heading) * 0.35 + Math.sin(c.now / 500 + S.seed) * 0.12, -1, -Math.cos(f.heading) * 0.35);
        const pts = S.chain.update(dt, root, back);
        for (let i = 0; i < S.links.length; i++) {
          const a = pts[i], b = pts[i + 1], j = S.links[i];
          j.position.copy(a).applyMatrix4(_m);
          const dir = _w.subVectors(a, b).applyMatrix4(_mr).normalize();
          j.quaternion.setFromUnitVectors(_up, dir);
          j.scale.setScalar(1);
        }
      }
      // smoke drops off its hem as it goes, more as it is hurt; the eyes flare as it winds up
      swing = ease(swing, wind ? 1 : 0, 6, dt);
      if (Math.random() < 0.03 + 0.08 * (1 - f.hp / f.def.hp) + (fighting ? 0.03 : 0)) c.drip(f, P.smoke);
      if (stepping && Math.random() < 0.4) c.spray(f.pos.clone().setY(f.pos.y + 0.1), [P.face, P.smoke], 1, 1.2, -0.5);
      eyeM.uniforms.uColor.value.set(f.lit > 0 ? (P.lit ?? '#ffb36a') : wind ? (P.flare ?? '#fff6d8') : f.stunned > 0 ? '#bfe9ff' : P.eye);
      eyeM.uniforms.uGlow.value = 0.8 + swing * 0.2;
      // lit (an ember), it burns solid: the smoke thins and the sword glows
      swordM.uniforms.uGlow.value = 0.05 + (f.lit > 0 ? 0.4 : 0) + swing * 0.25;
      if (lamp) lamp.rotation.x = Math.sin(c.now / 260) * 0.25 - fwd * 0.08;
      rig.write();
    },
    dispose: M.dispose,
  };
}

import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, tube, rod, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 12, the tentacled (docs/systems/procedural-animation.md §4): the root knot (docs/design/enemy-roster.md,
// archetype 8), drawn to its sheets (references/enemy-archetypes/rootknot/: sheet-1 Lorn's reed knot, sheet-2 Lorn II's
// root crawler). A mushroom 3.2 m tall: a broad conical cap over a ribbed bulb, two small pale eyes under the rim, a
// skirt of tendrils hanging under the bulb, and five long root-arms round its base, each with two bends like elbows
// and a fan of rootlets planted at its tip; no legs, the body carried between the arms. From afar a tree that shouldn't
// be there (the sheet's silhouette: a cap on a bulb on spider's arms).
//
// The arms are the kit's feet, three segments each solved by FABRIK from a curled guess (src/motion-kit/rig.js
// solveChain), stepping one at a time round the ring; slow and heavy, it can't be knocked back.
//
// Its attacks read from the body alone (src/telegraph.js):
//   grip   two front arms lifted and plunged into the soil before it, its cap tipping toward you; then the soil heaves
//          along the ground at you, a root running under it (drawn: humps of earth, its own body), and bursts up
//   lash   two front arms coiled back high; then whipped forward
//   puff   (Lorn II) it squats and its cap shudders, the gills swelling; a cloud of spores
// Asleep in a bloom its cap droops and its eyes close; calm, it stands rooted and only its cap turns to follow you.

/** The bulb: ribbed, widest low, a point under it where the tendrils hang (r, y round the core). */
const BULB = [[0.001, -0.52], [0.18, -0.44], [0.42, -0.24], [0.62, 0.0], [0.72, 0.28], [0.7, 0.58], [0.6, 0.86], [0.45, 1.06], [0.3, 1.16], [0.001, 1.2]].map(([r, y]) => new THREE.Vector2(r, y));
/** The cap: a broad low cone, rounded at the top, its rim turned down a little. */
const CAP = [[1.32, -0.06], [1.3, 0.03], [1.18, 0.16], [0.98, 0.36], [0.7, 0.58], [0.4, 0.74], [0.001, 0.8]].map(([r, y]) => new THREE.Vector2(r, y));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);

export function rootknotModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('rootknot', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  const core = pivot(body, 0, 1.3, 0, 'core');
  const capM = M.mat('cap', P.cap, { color2: P.cap2 }), bulbM = M.mat('bulb', P.bulb, { color2: P.bulb2 }), rootM = M.mat('root', P.root, { color2: P.root2 });
  const tendrilM = M.mat('tendril', P.tendril), darkM = M.mat('dark', P.dark, { flat: true });
  const gillM = props.has('glow') ? M.own('gill', P.gill, { glow: 0.55, side: THREE.DoubleSide }) : M.mat('gill', P.gill, { side: THREE.DoubleSide });
  const eyeM = M.own('eye', P.eye, { glow: 0.95 });
  const bulb = add(core, new THREE.LatheGeometry(BULB, 22), bulbM);
  bulb.scale.set(1, 1, 0.92);
  // the cap and its gills, on their own pivot: it turns to follow you, tips toward you for the grip, shudders, droops
  const capP = pivot(core, 0, 1.12, 0, 'cap');
  const cap = add(capP, new THREE.LatheGeometry(CAP, 28), capM);
  if (props.has('clipped')) cap.scale.set(1, 0.85, 1);
  const gills = add(capP, new THREE.LatheGeometry([new THREE.Vector2(0.32, 0.12), new THREE.Vector2(1.29, -0.05)], 28), gillM);
  // two small pale eyes under the rim, at the bulb's top
  const eyes = pair((s) => add(core, new THREE.SphereGeometry(0.075, 8, 6), eyeM, s * 0.17, 1.0, 0.44));
  // the skirt of tendrils under the bulb: short, drooping, a little sway
  const skirt = pivot(core, 0, -0.3, 0, 'skirt');
  const tendrils = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + 0.2, r = 0.22 + (k % 3) * 0.1, l = 0.34 + (k % 4) * 0.12;
    tendrils.push(tube(skirt, [[Math.sin(a) * r, 0, Math.cos(a) * r], [Math.sin(a) * (r + 0.05), -l * 0.5, Math.cos(a) * (r + 0.05)], [Math.sin(a) * (r + 0.02), -l, Math.cos(a) * (r + 0.02)]], 0.042, tendrilM, 0.01));
  }
  // five root-arms round the base: up and out to a first bend, down to a second, the tip down into a fan of rootlets
  const legs = [];
  for (let k = 0; k < 5; k++) {
    const a = Math.PI / 5 + (k / 5) * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
    const leg = planLeg(PLANS.tentacled, { group: g, body, hipParent: core, hip: { x: sx * 0.5, y: -0.05, z: cz * 0.5 * 0.92 }, foot: { x: sx * 1.4, z: cz * 1.4 }, radius: 0.11, pad: 'point',
      mats: { joint: rootM, thigh: rootM, shin: rootM, tip: rootM, foot: rootM }, name: `root arm ${k}` });
    // the rootlets: a little fan splayed out over the ground from the tip
    for (let j = 0; j < 6; j++) { const b = a + (j - 2.5) * 0.48; tube(leg.foot, [[0, 0.1, 0], [Math.sin(b) * 0.18, 0.03, Math.cos(b) * 0.18], [Math.sin(b) * 0.4, -0.01, Math.cos(b) * 0.4]], 0.035, rootM, 0.006); }
    legs.push(leg);
  }
  const front = [legs[0], legs[4]];   // (±36° off its nose: the grip's and the lash's arms)
  // the grip's root under the ground: humps of heaved earth running out along the lane, and the root up to you
  const heave = pivot(g, 0, 0, 0, 'heave');
  const humps = Array.from({ length: 6 }, (_, i) => { const h = add(heave, new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.32, 0.2, 0.42), darkM, 0, 0, 0); h.visible = false; return h; });
  const line = add(g, new THREE.CylinderGeometry(0.05, 0.08, 1, 6).translate(0, 0.5, 0), rootM); line.visible = false;
  const rig = new Rig({ plan: PLANS.tentacled, group: g, body, legs });
  finish(g);
  const parts = [bulb, capP, ...eyes, skirt, ...legs.map((l) => l.root)];
  let turn = 0, tip = 0, plunge = 0, coil = 0, shudder = 0, droop = 0;
  return {
    group: g, body: core, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.cap, P.bulb, P.root], spore: P.spore,
    tell: (id) => (id === 'puff' ? capP : id === 'lash' ? front[0].foot : front[1].foot),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // the cap follows you (calm too: the lens shows it), tips to you for the grip, droops asleep
      if (c.eye) {
        g.updateMatrixWorld(true); _m.copy(g.matrixWorld).invert(); _a.copy(c.eye).applyMatrix4(_m);
        turn = ease(turn, Math.max(-1, Math.min(1, Math.atan2(_a.x, _a.z))), 2.5, dt);
      }
      plunge = ease(plunge, id === 'grip' ? (wind ? c.wind : strike ? 1 : 0) : 0, 9, dt);
      coil = ease(coil, id === 'lash' ? (wind ? c.wind : strike ? -c.release : 0) : 0, strike ? 20 : 9, dt);
      shudder = id === 'puff' && wind ? c.wind : ease(shudder, 0, 6, dt);
      droop = ease(droop, f.sleep > 0 ? 1 : 0, 4, dt);
      tip = plunge * 0.35 + droop * 0.4;
      // the front arms: lifted and plunged into the soil before it (the grip), or coiled back high and whipped (the lash)
      const L = rig.length;
      front.forEach((leg, i) => {
        const s = i ? -1 : 1;
        if (plunge > 0.02) { leg.lift = Math.min(1, plunge * 1.4); leg.air.set(-s * 0.35, -0.3 * L + Math.sin(Math.PI * Math.min(1, plunge)) * 0.4 * L, 0.55 * L); }
        else if (Math.abs(coil) > 0.02) { leg.lift = Math.min(1, Math.abs(coil) * 1.3); leg.air.set(0, (coil > 0 ? 0.75 : 0.35) * L, (coil > 0 ? -0.15 : 0.85) * L); }
        else leg.lift = 0;
      });
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery });
      core.position.set(o.x, 1.3 + o.y - shudder * 0.18, o.z);
      core.rotation.set(o.pitch, o.yaw, o.roll);
      capP.rotation.set(tip + Math.sin(c.now / 28) * 0.05 * shudder, turn * (1 - plunge), Math.sin(c.now / 33) * 0.05 * shudder);
      skirt.rotation.set(Math.sin(c.now / 700 + f.home.x) * 0.06 + (c.moving ? 0.08 : 0), 0, Math.sin(c.now / 900) * 0.05);
      rig.write();
      // the root under the ground: humps of earth heaving out along the lane through the strike, then the root to you
      const held = c.tethered?.(f) ?? 0;
      const run = id === 'grip' && strike ? f.k : 0;
      heave.rotation.y = (f.attackH ?? f.heading) - f.heading;
      const D = Math.max(1.5, Math.hypot(f.attackAt.x - f.pos.x, f.attackAt.z - f.pos.z));
      humps.forEach((h, i) => {
        const u = run * 1.25 - i * 0.12;
        h.visible = run > 0 && u > 0 && u < 1.1;
        if (h.visible) { h.position.set(Math.sin(i * 2.1) * 0.08, 0, lerp(1.2, D, Math.min(1, u))); h.scale.setScalar(0.6 + Math.sin(Math.PI * Math.min(1, u)) * 0.6); }
      });
      if (run > 0 && Math.random() < 0.5) c.dust(_b.set(f.pos.x + Math.sin(f.attackH) * lerp(1.2, D, run), f.pos.y, f.pos.z + Math.cos(f.attackH) * lerp(1.2, D, run)), P.root2, 2, 0.4);
      line.visible = held > 0;
      if (held > 0 && c.eye) {
        front[1].foot.getWorldPosition(_a).applyMatrix4(_m); _b.copy(c.eye).setY(c.eye.y + 0.4).applyMatrix4(_m);
        line.position.copy(_a); const d = _b.sub(_a); line.scale.set(1, d.length(), 1); line.quaternion.setFromUnitVectors(UP, d.normalize());
      }
      if (id === 'puff' && f.state === 'recover' && f.timer > (f.atk.recover ?? f.def.recover) - 0.35) c.spray(capP.getWorldPosition(_a), [P.spore, P.gill], 4, 3, -0.3);   // (the cloud of spores)
      if (shudder > 0.5 && Math.random() < 0.3) c.spray(capP.getWorldPosition(_a), [P.spore], 1, 1, -0.5);
      eyeM.uniforms.uColor.value.set(f.sleep > 0 ? P.dark : eyeColor(f, P.eye));
      if (props.has('glow')) gillM.uniforms.uGlow.value = 0.45 + shudder * 0.5 + Math.sin(c.now / 500 + f.home.z) * 0.08;
    },
    dispose: M.dispose,
  };
}

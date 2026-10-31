import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, tubeGeometry, many, pivot, pair, ease, eyeColor, finish } from './kit.js';
import { gazePart } from '../gaze.js';

// The legacy root knot (kept, issue #800): the game's root knot until the Tripo body (plans/rootknot-tripo.js) took its place; it
// stands in where that body is not loaded, and is kept so the old look can come back as a foe of its own.
//
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
// Its attacks read from the body (src/telegraph.js), and the lobs' landing marks from the ground (src/ground-warnings.js):
//   pod    its cap tips back, the gills swell and a pod of spores fattens under the rim; over the wind-up's last third the
//          cap snaps forward and flings the pod in a high arc onto its mark (issue #769: it shoots, it no longer grips
//          and lashes)
//   seeds  it rises up on its arms, the cap shuddering, three seeds rattling under the rim; then they fly, one after the
//          other, onto their row of marks
//   puff   (Lorn II) it squats and its cap shudders, the gills swelling; a cloud of spores
// Asleep in a bloom its cap droops and its eyes close; calm, it stands rooted and only its cap turns to follow you.

/** The bulb: ribbed, widest low, a point under it where the tendrils hang (r, y round the core). */
const BULB = [[0.001, -0.52], [0.18, -0.44], [0.42, -0.24], [0.62, 0.0], [0.72, 0.28], [0.7, 0.58], [0.6, 0.86], [0.45, 1.06], [0.3, 1.16], [0.001, 1.2]].map(([r, y]) => new THREE.Vector2(r, y));
/** The cap: a broad low cone, rounded at the top, its rim turned down a little. */
const CAP = [[1.32, -0.06], [1.3, 0.03], [1.18, 0.16], [0.98, 0.36], [0.7, 0.58], [0.4, 0.74], [0.001, 0.8]].map(([r, y]) => new THREE.Vector2(r, y));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4();
/** The share of a lob's wind-up after which what it throws is in the air (the pod, the seeds), onto its mark at the end. */
export const THROW = 0.66;

export function rootknotLegacyModel(skin) {
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
  // the cap and its gills, on their own pivot: it turns to follow you, tips back to throw, shudders, droops
  const capP = pivot(core, 0, 1.12, 0, 'cap');
  const cap = add(capP, new THREE.LatheGeometry(CAP, 28), capM);
  if (props.has('clipped')) cap.scale.set(1, 0.85, 1);
  const gills = add(capP, new THREE.LatheGeometry([new THREE.Vector2(0.32, 0.12), new THREE.Vector2(1.29, -0.05)], 28), gillM);
  // two small pale eyes under the rim, at the bulb's top
  const eyes = pair((s) => add(core, new THREE.SphereGeometry(0.075, 8, 6), eyeM, s * 0.17, 1.0, 0.44));
  // the skirt of tendrils under the bulb: short, drooping, a little sway
  const skirt = pivot(core, 0, -0.3, 0, 'skirt');
  const tendrils = [];   // (geometries, merged into one mesh: one draw for the skirt)
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + 0.2, r = 0.22 + (k % 3) * 0.1, l = 0.34 + (k % 4) * 0.12;
    tendrils.push(tubeGeometry([[Math.sin(a) * r, 0, Math.cos(a) * r], [Math.sin(a) * (r + 0.05), -l * 0.5, Math.cos(a) * (r + 0.05)], [Math.sin(a) * (r + 0.02), -l, Math.cos(a) * (r + 0.02)]], 0.042, 0.01));
  }
  many(skirt, tendrils, tendrilM);
  // five root-arms round the base: up and out to a first bend, down to a second, the tip down into a fan of rootlets
  const legs = [];
  for (let k = 0; k < 5; k++) {
    const a = Math.PI / 5 + (k / 5) * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
    const leg = planLeg(PLANS.tentacled, { group: g, body, hipParent: core, hip: { x: sx * 0.5, y: -0.05, z: cz * 0.5 * 0.92 }, foot: { x: sx * 1.4, z: cz * 1.4 }, radius: 0.11, pad: 'point',
      mats: { joint: rootM, thigh: rootM, shin: rootM, tip: rootM, foot: rootM }, name: `root arm ${k}` });
    // the rootlets: a little fan splayed out over the ground from the tip
    many(leg.foot, Array.from({ length: 6 }, (_, j) => { const b = a + (j - 2.5) * 0.48; return tubeGeometry([[0, 0.1, 0], [Math.sin(b) * 0.18, 0.03, Math.cos(b) * 0.18], [Math.sin(b) * 0.4, -0.01, Math.cos(b) * 0.4]], 0.035, 0.006); }), rootM);
    legs.push(leg);
  }
  const front = [legs[0], legs[4]];   // (±36° off its nose: the arms it rises on for the volley)
  // what it throws, under the front of the rim: the spore pod fattening, and the three seeds rattling (hidden at rest)
  const podM = M.mat('pod', P.spore, { color2: P.gill, glow: 0.3 });
  const pod = add(capP, new THREE.IcosahedronGeometry(1, 1).scale(1, 0.85, 1), podM, 0, -0.34, 0.8); pod.visible = false;
  const seeds = [-1, 0, 1].map((s) => { const m = add(capP, new THREE.IcosahedronGeometry(0.11, 0).scale(1, 1.3, 1), darkM, s * 0.3, -0.16, 0.66 - Math.abs(s) * 0.06); m.visible = false; return m; });
  const rig = new Rig({ plan: PLANS.tentacled, group: g, body, legs });
  // its eyes on you once it has noticed you, on its way before (src/enemies/gaze.js, issue #508)
  const gaze = eyes.map((e) => gazePart(g, e, { slide: 0.04 }));
  finish(g);
  const parts = [bulb, capP, ...eyes, skirt, ...legs.map((l) => l.root)];
  let turn = 0, tip = 0, draw = 0, rise = 0, shudder = 0, droop = 0;
  return {
    group: g, gaze, body: core, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.cap, P.bulb, P.root], spore: P.spore,
    tell: (id) => (id === 'pod' ? pod : capP),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind';
      // the cap follows you (calm too: the lens shows it), droops asleep
      if (c.eye) {
        g.updateMatrixWorld(true); _m.copy(g.matrixWorld).invert(); _a.copy(c.eye).applyMatrix4(_m);
        turn = ease(turn, Math.max(-1, Math.min(1, Math.atan2(_a.x, _a.z))), 2.5, dt);
      }
      // the pod drawn back under the tipped cap, or the body raised on its arms for the volley; over the wind-up's last
      // third (THROW) the cap snaps forward and what it holds flies onto its mark
      const pod_ = id === 'pod' && wind, seeds_ = id === 'seeds' && wind, out = wind ? Math.max(0, (f.k - THROW) / (1 - THROW)) : 0;
      draw = ease(draw, pod_ ? c.wind * (1 - out) : 0, out > 0 ? 22 : 8, dt);
      rise = ease(rise, seeds_ ? c.wind : 0, 8, dt);
      shudder = (id === 'puff' || id === 'seeds') && wind ? c.wind * (id === 'seeds' ? 0.6 : 1) : ease(shudder, 0, 6, dt);
      droop = ease(droop, f.sleep > 0 ? 1 : 0, 4, dt);
      tip = droop * 0.4 - draw * 0.75 + (pod_ || seeds_ ? out * 0.45 : 0);
      // the front arms planted wide and pressed down as it rises for the volley
      const L = rig.length;
      front.forEach((leg, i) => {
        if (rise > 0.05) { leg.lift = Math.min(1, rise) * 0.5; leg.air.set((i ? -1 : 1) * 0.45 * L, -0.15 * L, 0.6 * L); }
        else leg.lift = 0;
      });
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery });
      core.position.set(o.x, 1.3 + o.y - shudder * (id === 'puff' ? 0.18 : 0) + rise * 0.32 - draw * 0.12, o.z);
      core.rotation.set(o.pitch - draw * 0.12, o.yaw, o.roll);
      capP.rotation.set(tip + Math.sin(c.now / 28) * 0.05 * shudder, turn * (1 - Math.max(draw, rise)), Math.sin(c.now / 33) * 0.05 * shudder);
      skirt.rotation.set(Math.sin(c.now / 700 + f.home.x) * 0.06 + (c.moving ? 0.08 : 0), 0, Math.sin(c.now / 900) * 0.05);
      rig.write();
      // the pod fattening under the rim until it is flung; the seeds rattling there until they fly
      pod.visible = pod_ && out <= 0;
      if (pod.visible) pod.scale.setScalar(0.1 + 0.32 * c.wind + Math.sin(c.now / 60) * 0.015 * c.wind);
      seeds.forEach((m, i) => {
        m.visible = seeds_ && out <= i * 0.08;
        if (m.visible) m.position.y = -0.16 + Math.sin(c.now / 23 + i * 2.1) * 0.03 * c.wind;
      });
      // in flight: the pod (glob 0) and the seeds (globs 1-3), from under the cap to their marks (each seed a little behind)
      const pts = f.attackPts ?? [f.attackAt];
      if (pod_ || seeds_ || f.globs) {
        const from = capP.getWorldPosition(_a);
        c.lob(f, pod_ ? out : -1, P.spore, 0, f.attackAt, from);   // (the pod's glob first, always: the seeds' 1-3 after it, no hole in f.globs for Foes.remove)
        for (let i = 0; i < 3; i++) if (seeds_ || f.globs?.[i + 1]) c.lob(f, seeds_ && pts[i] ? out - i * 0.08 : -1, P.root2, i + 1, pts[i] ?? f.attackAt, from);
      }
      if (id === 'puff' && f.state === 'recover' && f.timer > (f.atk.recover ?? f.def.recover) - 0.35) c.spray(capP.getWorldPosition(_a), [P.spore, P.gill], 4, 3, -0.3);   // (the cloud of spores)
      if (shudder > 0.5 && Math.random() < 0.3) c.spray(capP.getWorldPosition(_a), [P.spore], 1, 1, -0.5);
      if (pod_ && out <= 0 && c.wind > 0.5 && Math.random() < 0.25) c.spray(pod.getWorldPosition(_b), [P.spore, P.gill], 1, 0.8, -0.4);   // (spores sifting off the pod)
      eyeM.uniforms.uColor.value.set(f.sleep > 0 ? P.dark : eyeColor(f, P.eye));
      if (props.has('glow')) gillM.uniforms.uGlow.value = 0.45 + shudder * 0.5 + Math.sin(c.now / 500 + f.home.z) * 0.08;
    },
    dispose: M.dispose,
  };
}

import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, tube, rod, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 7, the stilt-walker (docs/systems/procedural-animation.md §4): the stilt heron (docs/design/enemy-roster.md,
// archetype 6), drawn to its sheets (references/enemy-archetypes/heron/: sheet-1 the Desert's cistern heron, sheet-2
// Vael's ridge runner). The tallest thing in the game and the thinnest: two stilt legs 2.5 m to the hip, each with the
// bird's joint two thirds of the way up bending back, wide three-toed wading feet; a body on top of them (the Desert's a
// round cream clay jug with a narrow mouth, ochre bands round its belly; Vael's a slim egg of pale blue feathers with
// folded wings and a fan of tail feathers); a long S-neck rising from it to a small head with a long spear bill. Nearly
// 5 m to the head, the traveller reaching its leg's joint.
//
// It steps one leg at a time, slowly, the high body swaying over the planted foot on a soft spring (StiltMotor's rules
// as the kit's `stilt` plan); the neck is a curve of segments blended between its key shapes (rest, the spear's tight
// S drawn back, the thrust, down to the water), the head held level on it.
//
// Its attacks read from the body alone (src/telegraph.js):
//   spear   the neck drawn back into a tight S, the bill pointed at you, the body leaning back; then all at once
//   sweep   one foot lifted high, its weight on the other; then the stamp, the planted leg turning it round
//   buffet  (Vael) the folded wings flare wide and draw back, then beat
// Toppled (a charged cut at a leg) it lies on its side, legs out, its head on the ground; parried, its head droops.

const HIP = 2.95, NSEG = 10, JS = 0.82;   // (the hip; the neck's segments; the jug's scale: the sheet's legs over half its height)
/** The cistern jug: a lathe profile (r, y) round the torso's centre, a rounded bottom, a full belly, a narrow mouth with a lip. */
const JUG = [[0.001, -0.3], [0.24, -0.27], [0.44, -0.15], [0.55, 0.05], [0.57, 0.24], [0.52, 0.46], [0.38, 0.64], [0.22, 0.76], [0.14, 0.84], [0.15, 0.92], [0.19, 0.96], [0.15, 0.99]].map(([r, y]) => new THREE.Vector2(r, y));
// the neck's key shapes: control points from its base (torso frame, +z ahead), and where the bill points at each
const KEYS = {
  rest: { pts: [[0, 0, 0], [0, 0.3, 0.1], [0, 0.62, 0.02], [0, 0.94, -0.12], [0, 1.22, -0.04], [0, 1.38, 0.16]], dir: [0, -0.05, 1] },
  coil: { pts: [[0, 0, 0], [0, 0.42, -0.2], [0, 0.66, -0.66], [0, 0.86, -0.3], [0, 0.7, 0.06], [0, 0.66, 0.42]], dir: [0, 0, 1] },
  strike: { pts: [[0, 0, 0], [0, 0.16, 0.4], [0, 0.1, 0.86], [0, -0.06, 1.32], [0, -0.26, 1.78], [0, -0.46, 2.18]], dir: [0, -0.22, 1] },
  down: { pts: [[0, 0, 0], [0, 0.22, 0.3], [0, 0.06, 0.62], [0, -0.4, 0.78], [0, -0.96, 0.84], [0, -1.52, 0.86]], dir: [0, -1, 0.2] },
};
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);

export function heronModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('heron', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  const torso = pivot(body, 0, HIP, 0, 'torso');
  const bodyM = M.mat('body', P.body, { color2: P.body2 }), neckM = M.mat('neck', P.neck), legM = M.mat('leg', P.leg), jointM = M.mat('joint', P.joint);
  const billM = M.mat('bill', P.bill), darkM = M.mat('dark', P.dark, { flat: true }), crestM = M.mat('crest', P.crest);
  const eyeM = M.own('eye', P.eye, { glow: 0.35 });
  const jug = props.has('jug'), feathers = props.has('feathers'), neckK = jug ? 1 : 1.25;   // (the feathered birds' neck longer, from a lower base)
  const shell = [];
  let neckBase, wings = [];
  if (jug) {
    // the cistern jug: glazed cream clay, its ochre bands painted; a round clay plug on its flank (the sheet's)
    const jugM = add(torso, new THREE.LatheGeometry(JUG, 26), bodyM); jugM.scale.setScalar(JS); shell.push(jugM);
    const plug = add(torso, new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16).rotateZ(Math.PI / 2), jointM, 0.36, -0.02, -0.28); plug.rotation.y = -0.7; shell.push(plug);
    shell.push(add(torso, new THREE.TorusGeometry(0.14, 0.022, 6, 18).rotateX(Math.PI / 2), bodyM, 0, 0.97 * JS, 0));
    neckBase = V(0, 0.96 * JS, 0);
  } else {
    // a slim egg of feathers, carried level, the folded wings along its sides and a fan of tail feathers behind
    const egg = add(torso, new THREE.SphereGeometry(1, 20, 14).scale(0.5, 0.56, 0.9), bodyM, 0, 0.22, -0.06); egg.rotation.x = -0.18; shell.push(egg);
    const wingM = M.mat('wing', P.body2 ?? P.body);
    wings = pair((s) => {
      const w = pivot(torso, s * 0.44, 0.46, 0.34, 'wing');
      add(w, new THREE.SphereGeometry(1, 14, 10).scale(0.11, 0.42, 0.96), wingM, 0, -0.1, -0.52);
      for (let k = 0; k < 5; k++) add(w, new THREE.ConeGeometry(0.08, 0.75, 5).rotateX(-Math.PI / 2 + 0.32).translate(0, -0.12 - k * 0.05, -1.0 - k * 0.05), wingM, s * 0.02, 0, 0).rotation.z = s * k * 0.05;
      return w;
    });
    for (let k = 0; k < 5; k++) { const t = add(torso, new THREE.ConeGeometry(0.06, 0.5, 5).rotateX(-Math.PI / 2 - 0.35).translate(0, -0.08, -0.82), bodyM, (k - 2) * 0.07, 0.08, 0); t.rotation.y = (k - 2) * 0.12; shell.push(t); }
    neckBase = V(0, 0.5, 0.56);
  }
  // the hip joints: round knobs where the legs meet the body (the sheet's discs)
  for (const s of [-1, 1]) shell.push(add(torso, new THREE.SphereGeometry(0.1, 10, 8), jointM, s * 0.3, -0.14, 0));
  // the neck: a curve of segments from its base, blended between its key shapes each frame
  const neckRoot = pivot(torso, neckBase.x, neckBase.y, neckBase.z, 'neck');
  const segs = Array.from({ length: NSEG }, (_, i) => { const r0 = lerp(0.16, 0.085, i / NSEG), r1 = lerp(0.16, 0.085, (i + 1) / NSEG); return add(neckRoot, new THREE.CylinderGeometry(r1, r0, 1, 8).translate(0, 0.5, 0), neckM); });
  const knots = Array.from({ length: NSEG - 1 }, (_, i) => add(neckRoot, new THREE.SphereGeometry(lerp(0.16, 0.085, (i + 1) / NSEG), 8, 6), neckM));
  const ctrl = KEYS.rest.pts.map((p) => V(...p)), curve = new THREE.CatmullRomCurve3(ctrl), pts = Array.from({ length: NSEG + 1 }, () => V());
  // the head: small and long, a pale eye each side, the spear bill (Vael's shorter and hooked), a crest (Vael's rust-red
  // feathers, the Desert's little point), Lorn's lilac mushroom cap over it
  const head = pivot(neckRoot, 0, 0, 0, 'head');
  add(head, new THREE.SphereGeometry(1, 14, 10).scale(0.12, 0.11, 0.21), neckM, 0, 0.02, 0.02);
  const eyes = pair((s) => add(head, new THREE.SphereGeometry(0.032, 8, 6), eyeM, s * 0.09, 0.05, 0.06));
  pair((s) => add(head, new THREE.SphereGeometry(1, 8, 6).scale(0.03, 0.012, 0.04), darkM, s * 0.095, 0.08, 0.06));   // (its brow)
  const hook = props.has('hook'), billLen = hook ? 0.62 : 0.92;
  const bill = pivot(head, 0, 0.0, 0.18, 'bill');
  add(bill, new THREE.ConeGeometry(0.055, billLen, 8).rotateX(Math.PI / 2).translate(0, 0, billLen / 2), billM);
  if (hook) tube(bill, [[0, 0.01, billLen - 0.06], [0, -0.01, billLen + 0.04], [0, -0.07, billLen + 0.07], [0, -0.11, billLen + 0.03]], 0.025, billM, 0.008);
  add(bill, new THREE.BoxGeometry(0.002, 0.004, billLen * 0.7), darkM, 0, -0.005, billLen * 0.4);   // (the line of its beak)
  const tip = pivot(bill, 0, 0, billLen);
  const crest = [];
  if (props.has('crest')) for (let k = 0; k < 9; k++) { const l = 0.44 + ((k * 3) % 4) * 0.07; const c = add(head, new THREE.ConeGeometry(0.048, l, 5).translate(0, l / 2, 0), crestM, (k - 4) * 0.012, 0.08, -0.08); c.rotation.set(-0.45 - Math.abs(k - 4) * 0.06, 0, (k - 4) * 0.2); crest.push(c); }
  else if (!props.has('cap')) crest.push(add(head, new THREE.ConeGeometry(0.035, 0.16, 5).rotateX(-1.9), crestM, 0, 0.07, -0.18));
  if (props.has('cap')) { const cap = add(head, new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), crestM, 0, -0.02, -0.01); cap.scale.set(1, 0.7, 1); crest.push(cap); add(head, new THREE.CircleGeometry(0.28, 16).rotateX(Math.PI / 2), M.mat('gill', P.body2), 0, 0.05, 0); }
  // the legs on the kit: a short thigh down to the bird's joint two thirds up (bending back), a long shank to the foot
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = planLeg(PLANS.stilt, { group: g, body, hipParent: torso, hip: { x: s * 0.3, y: -0.14, z: 0 }, foot: { x: s * 0.34, z: 0.06 }, radius: 0.075, pad: 'point', mats: { joint: jointM, thigh: legM, shin: legM, foot: legM }, name: `heron leg ${legs.length}` });
    // wide wading feet: three long toes forward, one back (the Mangrove's like roots, longer and knotted)
    const roots = props.has('roots'), L = roots ? 0.68 : 0.56;
    for (const a of [-0.5, 0, 0.5]) tube(leg.foot, [[0, 0.04, 0], [Math.sin(a) * L * 0.5, 0.03, Math.cos(a) * L * 0.5], [Math.sin(a) * L, 0.0, Math.cos(a) * L]], roots ? 0.04 : 0.034, legM, 0.01);
    tube(leg.foot, [[0, 0.04, 0], [0, 0.015, -L * 0.45]], 0.03, legM, 0.01);
    legs.push(leg);
  }
  const rig = new Rig({ plan: PLANS.stilt, group: g, body, legs });
  finish(g);
  const parts = [...shell, ...segs, head, ...wings, ...legs.map((l) => l.root)];
  // the high body's own sway (StiltMotor's hub): a pendulum over the feet that lags a turn, a stop and a blow
  const S = PLANS.stilt.sway, swayZ = new SecondOrder(S.f, S.z, 0), swayX = new SecondOrder(S.f, S.z, 0);
  let wCoil = 0, wStrike = 0, wDown = 0, lift = 0, flare = 0, topple = 0, prevV = 0, prevH = null, fish = 0, spin = 0;
  const w = { rest: 1, coil: 0, strike: 0, down: 0 };
  return {
    group: g, body: torso, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.body, P.leg, P.band ?? P.bill],
    tell: (id) => (id === 'sweep' ? legs[1].foot : id === 'buffet' ? (wings[1] ?? head) : tip),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // the neck's shape: the spear's S drawn back, then straight out all at once; parried (open) or toppled, down;
      // wading calm, a stab at the water now and then
      const calmIdle = f.state === 'idle' && !f.provoked;
      fish = calmIdle ? Math.max(0, Math.sin(c.now / 900 + f.home.x * 3)) ** 8 : 0;
      wCoil = ease(wCoil, id === 'spear' && wind ? c.wind : 0, 12, dt);
      wStrike = ease(wStrike, id === 'spear' && strike ? 1 : 0, strike ? 30 : 9, dt);
      wDown = ease(wDown, f.open > 0 || f.toppled > 0 ? 1 : fish, f.open > 0 ? 7 : 5, dt);
      const tot = Math.max(1, wCoil + wStrike + wDown);
      w.coil = wCoil / tot; w.strike = wStrike / tot; w.down = wDown / tot; w.rest = Math.max(0, 1 - w.coil - w.strike - w.down);
      for (let i = 0; i < ctrl.length; i++) {
        ctrl[i].set(0, 0, 0);
        for (const k of ['rest', 'coil', 'strike', 'down']) if (w[k] > 0) { const p = KEYS[k].pts[i], q = w[k] * neckK; ctrl[i].x += p[0] * q; ctrl[i].y += p[1] * q; ctrl[i].z += p[2] * q; }
      }
      for (let i = 0; i <= NSEG; i++) curve.getPoint(i / NSEG, pts[i]);
      for (let i = 0; i < NSEG; i++) {
        _d.subVectors(pts[i + 1], pts[i]);
        const L = _d.length();
        segs[i].position.copy(pts[i]); segs[i].scale.set(1, L, 1);
        segs[i].quaternion.setFromUnitVectors(UP, _d.divideScalar(L || 1));
        if (i < NSEG - 1) knots[i].position.copy(pts[i + 1]);
      }
      // the head at the neck's end, the bill along the key's direction (held level against the body's pitch)
      head.position.copy(pts[NSEG]);
      _a.set(0, 0, 0);
      for (const k of ['rest', 'coil', 'strike', 'down']) if (w[k] > 0) _a.addScaledVector(_b.set(...KEYS[k].dir), w[k]);
      _a.normalize();
      head.quaternion.setFromUnitVectors(FWD, _a);
      // the sweep: one foot lifted high (its weight on the other), then stamped down as the planted leg turns it round
      const sweep = id === 'sweep' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0;
      lift = ease(lift, sweep, 10, dt);
      legs[1].lift = lift; legs[1].air.set(0.05, 1.05, 0.35);
      spin = id === 'sweep' && strike ? c.release * 1.1 : ease(spin, 0, 4, dt);
      // the buffet (Vael): the folded wings flare wide and draw back, then beat forward
      flare = ease(flare, id === 'buffet' ? (wind ? c.wind : strike ? 1 - c.release * 0.5 : 0) : 0, 10, dt);
      wings.forEach((wg, i) => { const s = i ? 1 : -1; wg.rotation.set(-flare * 0.5 + (id === 'buffet' && strike ? c.release * 0.9 : 0), s * flare * 0.3, s * flare * 1.25); });
      // toppled: down on its side, legs out, its head on the ground
      topple = ease(topple, f.toppled > 0 ? 1 : 0, f.toppled > 0 ? 5 : 3, dt);
      const open = f.open > 0 ? 1 : 0;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery, air: topple > 0.2 ? 1 : 0 });
      // the high body's sway: lags a change of pace forward and back, swings out on a turn
      const v = c.moving ? (f.def.speed ?? 2) : 0, acc = dt > 0 ? (v - prevV) / dt : 0; prevV = v;
      const turn = prevH == null || !(dt > 0) ? 0 : Math.atan2(Math.sin(f.heading - prevH), Math.cos(f.heading - prevH)) / dt; prevH = f.heading;
      const sz = swayZ.update(dt, -Math.max(-6, Math.min(6, acc)) * 0.03 + (f.recoil > 0 ? -f.recoil * 0.12 : 0));
      const sx = swayX.update(dt, Math.max(-3, Math.min(3, turn)) * v * 0.02);
      g.rotation.y = f.heading + spin;
      body.position.y = -topple * (HIP - 0.55);
      body.rotation.set(0, 0, topple * 1.45);
      torso.position.set(o.x + sx, HIP + o.y - open * 0.35, o.z + sz);
      torso.rotation.set(o.pitch + sz * 0.4 + open * 0.42 + fish * 0.12, o.yaw, o.roll - sx * 0.3 - lift * 0.08);
      rig.write();
      // fishing: a splash where the bill goes in
      if (fish > 0.9 && Math.random() < 0.2) c.dust(tip.getWorldPosition(_a), '#cfe6ee', 2, 0.3);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
    },
    dispose: M.dispose,
  };
}

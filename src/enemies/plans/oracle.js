import * as THREE from 'three';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, many, skinBy, pivot, ease, finish } from './kit.js';
import { gazePart } from '../gaze.js';
import { humanoidSkeleton, HumanoidDriver, PROC_POSES } from '../humanoid-rig.js';
import { droidMaterials, droidGlow, lathe, lensParts } from './droid.js';

// The oracle (issue #726, docs/design/enemy-roster-v4.md; its sheet: a new `oracle/` folder under the enemy references,
// sheet-1): the makers' defunct caster droid, 1.8 m, hovering. A person's head, shoulders and thin arms in the droids'
// ivory ceramic over dark joints, an egg of a head with one round amber eye and a centre line; a grey ribbed waist; below
// it no legs but a long tapering ceramic shell to a point, amber seams running down it in a Y; a thin ring turning round
// its shoulders; between its hands a sphere of light gathers as it casts.
//
// The upper body is the humanoid foe rig's (src/enemies/humanoid-rig.js): the idle's breathing and the arms by hand for
// its casts (PROC_POSES gather, ward, call); no leg clips: the legs are joints with nothing on them, the shell hangs from
// the hips, and the body bobs and drifts on springs, leaning into where it goes.
//
// What the body says (nothing on the ground):
//   volley   its hands come together before its chest and a sphere of light swells between them; three bolts follow,
//            one after another, down the line to you (a perfect parry sends one back)
//   ward     one arm out to a packmate, a beam of light runs to it and rings close round it (half harm, no staggers):
//            cut the beam half-way, or the oracle
//   wake     both arms thrown up, the ring spins fast and flashes: every sleeping droid near it wakes
//   pulse    (too close) its arms flung down and out, the ring drops: a burst round it
//   blink    (low health, fight.low 'flee' with `blink`) it flickers and is gone, a few metres off, and backs away

const D = { hip: 0.86, hipX: 0.1, thigh: 0.4, shin: 0.4, chest: 0.42, shoulder: 0.19, upper: 0.33, fore: 0.33, neck: 0.08 };
export const ORACLE_BODY = D;
export const ORACLE_HEIGHT = 1.85;
/** The hover: m it bobs, its rate (rad/s); how far it leans into its drift (rad per m/s) and at most. */
export const HOVER_LOOK = { bob: 0.05, rate: 1.7, lean: 0.09, most: 0.22 };
const UP = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

Object.assign(PROC_POSES, {
  // its hands cupped before its chest round the sphere of light, elbows out (the sheet's cast); then thrust at you
  gather: { r: [[-0.5, -0.72, 0.35], [0.55, 0.3, 0.78]], l: [[0.5, -0.72, 0.35], [-0.55, 0.3, 0.78]], strike: { r: [[-0.2, -0.05, 1], [0.05, 0, 1]], l: [[0.2, -0.05, 1], [-0.05, 0, 1]] } },
  // one arm out at its packmate (to its left), the other hand at its chest
  warding: { l: [[0.75, 0.2, 0.62], [0.6, 0.3, 0.75]], r: [[-0.45, -0.75, 0.4], [0.6, 0.25, 0.75]] },
  // both arms thrown up and out, calling
  calling: { r: [[-0.6, 0.72, 0.25], [-0.25, 0.95, 0.15]], l: [[0.6, 0.72, 0.25], [0.25, 0.95, 0.15]], lean: -0.15 },
  // arms flung down and out
  pulsing: { r: [[-0.7, -0.6, 0.3], [-0.6, -0.7, 0.3]], l: [[0.7, -0.6, 0.3], [0.6, -0.7, 0.3]], lean: 0.12 },
});

/** Each move: a pose of the arms by hand over the idle (no clip has a cast). */
export const ORACLE_MOVES = {
  volley: { pose: 'gather' }, volley2: { pose: 'gather' }, volley3: { pose: 'gather' },
  ward: { pose: 'warding' }, wake: { pose: 'calling' }, pulse: { pose: 'pulsing' },
};

export function oracleModel(skin) {
  const P = skin.palette, M = materials('oracle', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const rig = pivot(g, 0, 0, 0, 'rig');
  const J = humanoidSkeleton(rig, D), hull = J.torso, head = J.head;
  const X = droidMaterials(M, P), C = X.ceramicB, K = X.jointB, S = X.seamB;
  const ringB = M.mat('ringBuild', P.ring), ringM = M.mat('ring', P.ring, { vertexColors: true });
  // ---- the shell: from the hips down to a point, its widest a little under the hips; amber seams in a Y down it
  const shellP = [[0.001, -D.hip], [0.04, -D.hip + 0.1], [0.1, -D.hip + 0.32], [0.16, -0.36], [0.2, -0.16], [0.205, -0.06], [0.17, 0.02], [0.001, 0.03]];
  add(J.body, lathe(shellP.map(([r, y]) => [r, y + D.hip]), 22, 0.86), C);
  const seams = [];
  // (the Y: a seam from each hip down to the middle front, then one line down to the point; a ring round its waist; the sides)
  const along = (pts, r = 0.009) => { for (let i = 0; i < pts.length - 1; i++) { const A = new THREE.Vector3(...pts[i]), B = new THREE.Vector3(...pts[i + 1]), d = B.clone().sub(A); seams.push(new THREE.CylinderGeometry(r, r, d.length(), 4).applyMatrix4(_m.compose(A.clone().add(B).multiplyScalar(0.5), _q.setFromUnitVectors(UP, d.normalize()), _b.set(1, 1, 1)))); } };
  const surf = (y, a) => { const rr = shellRadius(shellP, y - D.hip) + 0.004; return [Math.sin(a) * rr, y, Math.cos(a) * rr * 0.86]; };
  for (const s of [-1, 1]) along([0.9, 0.78, 0.66, 0.56].map((y, i) => surf(y, s * (0.9 - i * 0.3))));
  along([0.56, 0.45, 0.34, 0.24, 0.14].map((y) => surf(y, 0)));
  for (const s of [-1, 1]) along([0.86, 0.7, 0.5, 0.3].map((y) => surf(y, s * 1.75)));
  many(J.body, seams, S);
  // ---- the waist: grey ribs; the chest: a ceramic plate with a centre line; the collar dark
  add(hull, lathe([[0.12, -0.02], [0.105, 0.06], [0.1, 0.16], [0.13, 0.22], [0.001, 0.22]], 14, 0.8), K);
  many(hull, [0.03, 0.08, 0.13].map((y) => new THREE.TorusGeometry(0.108, 0.013, 4, 16).rotateX(Math.PI / 2).scale(1, 1, 0.8).translate(0, y, 0)), C);
  add(hull, lathe([[0.001, 0.16], [0.15, 0.17], [0.19, 0.26], [0.205, 0.36], [0.16, 0.44], [0.07, 0.47], [0.001, 0.47]], 20, 0.68), C);
  many(hull, [new THREE.BoxGeometry(0.008, 0.2, 0.012).translate(0, 0.32, 0.138)], K);
  add(hull, lathe([[0.001, 0.43], [0.09, 0.44], [0.05, 0.5], [0.001, 0.51]], 12, 0.8), K);
  // ---- the head: a smooth egg on two dark neck pipes, its lens a little above its middle, a centre line over its crown
  many(head, [-0.025, 0.025].map((x) => new THREE.CylinderGeometry(0.014, 0.016, D.neck + 0.06, 6).translate(x, -0.03, 0)), K);
  add(head, lathe([[0.001, 0.03], [0.08, 0.05], [0.13, 0.14], [0.155, 0.27], [0.15, 0.38], [0.115, 0.46], [0.06, 0.5], [0.001, 0.51]], 22, 1.05, 0.95), C);
  many(head, [new THREE.BoxGeometry(0.006, 0.14, 0.008).translate(0, 0.42, 0.135), new THREE.BoxGeometry(0.006, 0.08, 0.008).translate(0, 0.1, 0.14)], K);
  const lens = lensParts(0.05);
  add(head, lens.socket, K, 0, 0.27, 0.155);
  const eyes = new THREE.Group(); head.add(eyes); eyes.name = 'eyes';
  add(eyes, lens.glass, X.eye, 0, 0.27, 0.155);
  // ---- the arms: a round shoulder joint under a cap, thin dark upper arms with ceramic sleeves, dark elbow discs,
  // thin ceramic forearms, long-fingered dark hands
  J.arms.forEach((sh, i) => {
    const s = i ? 1 : -1, el = J.elbows[i];
    add(sh, new THREE.SphereGeometry(0.055, 10, 8), K);
    add(sh, new THREE.SphereGeometry(0.085, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(s * 0.012, 0.02, 0), C);
    add(sh, new THREE.CylinderGeometry(0.032, 0.03, D.upper, 8).translate(0, -D.upper / 2, 0), K);
    add(sh, new THREE.CylinderGeometry(0.044, 0.038, D.upper * 0.6, 10).translate(0, -D.upper * 0.42, 0), C);
    add(el, new THREE.CylinderGeometry(0.045, 0.045, 0.04, 12).rotateZ(Math.PI / 2), K);
    add(el, new THREE.CylinderGeometry(0.036, 0.026, D.fore, 10).translate(0, -D.fore / 2, 0), C);
    const hand = J.hands[i];
    many(hand, [new THREE.SphereGeometry(0.026, 8, 6), new THREE.BoxGeometry(0.05, 0.06, 0.022).translate(0, -0.035, 0),
      ...[-0.018, -0.006, 0.006, 0.018].map((x) => new THREE.CylinderGeometry(0.006, 0.005, 0.08, 4).translate(x, -0.1, 0.004)),
      new THREE.CylinderGeometry(0.006, 0.005, 0.06, 4).rotateZ(-s * 0.6).translate(-s * 0.03, -0.06, 0.01)], K);
  });
  // ---- the ring round its shoulders: thin, tilted forward a little, turning; notches so it reads turning
  const ringPivot = pivot(hull, 0, D.chest + 0.02, 0, 'ring');
  const ring = pivot(ringPivot, 0, 0, 0, 'ring turn');
  many(ring, [new THREE.TorusGeometry(0.43, 0.022, 6, 48).rotateX(Math.PI / 2).scale(1, 1.4, 1),
    ...[0, 1, 2, 3, 4, 5].map((i) => new THREE.BoxGeometry(0.03, 0.05, 0.05).translate(0, 0, 0.43).rotateY(i * Math.PI / 3))], ringB);
  ringPivot.rotation.x = 0.16;
  // ---- the sphere of light between its hands, and its bolts and its ward (in the foes' space, a holder of its own)
  const orbM = M.own('orb', P.seam, { glow: 1, hatch: 0 });
  const orb = add(g, new THREE.SphereGeometry(0.11, 14, 10), orbM); orb.name = 'orb'; orb.visible = false;
  const holder = pivot(g, 0, 0, 0, 'casts (foes space)'); holder.matrixAutoUpdate = false;
  const bolt = add(holder, new THREE.SphereGeometry(0.1, 10, 8).scale(1, 1, 1.8), orbM); bolt.visible = false; bolt.scale.setScalar(1e-3);
  const beam = add(holder, new THREE.CylinderGeometry(0.025, 0.025, 1, 5).translate(0, 0.5, 0), orbM); beam.visible = false; beam.scale.setScalar(1e-3);
  // (the ward: three thin hoops of light round the one it guards, turning)
  const wardG = pivot(holder, 0, 0, 0, 'ward');
  const hoops = [0, 1, 2].map((i) => { const m = add(wardG, new THREE.TorusGeometry(1, 0.02, 4, 32), orbM); m.rotation.set(Math.PI / 2 + (i - 1) * 0.5, i * 1.1, 0); return m; });
  wardG.visible = false; wardG.scale.setScalar(1e-3);
  const driver = new HumanoidDriver(J, rig, { moves: ORACLE_MOVES, speeds: { walk: 40, jog: 80, sprint: 120 } });   // (hovering: no stride; the idle)
  const gaze = [gazePart(g, head, { mode: 'turn' })];
  skinBy(g, [...X.sets, { from: [ringB], into: ringM }]);
  finish(g);
  for (const o of [eyes, orb, holder]) o.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  holder.traverse((o) => { o.userData.noGround = true; o.userData.noHurt = true; });   // (its casts are light, not body: the blade passes through)
  orb.userData.noHurt = true;
  const parts = [J.body, hull, head, ...J.arms, ...J.elbows, ...J.hands, ring];
  const tilt = { x: new SecondOrder(1.6, 0.5, 0), z: new SecondOrder(1.6, 0.5, 0) }, prev = { x: null, z: 0 };
  const st = { glow: 0 };
  let spin = 0, gather = 0, call = 0, t0 = Math.random() * 10;
  const handsAt = (out) => { J.hands[0].getWorldPosition(_a); J.hands[1].getWorldPosition(_b); return out.copy(_a).add(_b).multiplyScalar(0.5); };
  return {
    group: g, gaze, body: rig, rig: null, upright: true, parts, eyeMat: X.eye, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.ceramic, P.seam, P.joint],
    driver, joints: J, height: ORACLE_HEIGHT, floats: true,
    tell: (id) => (id === 'ward' ? J.hands[1] : id === 'wake' || id === 'pulse' ? ring : orb),
    // (where its ward's beam leaves it: Foes.support cuts it half-way)
    lanternAt: (i, out = new THREE.Vector3()) => { J.hands[1].getWorldPosition(out); return out; },
    handAt: (i, out = new THREE.Vector3()) => J.hands[i ? 1 : 0].getWorldPosition(out),
    anim(f, c) {
      const dt = Math.max(c.dt, 1e-4), id = f.atk?.id, wind = f.state === 'wind', strike = f.state === 'strike';
      g.position.y += f.alt;
      const want = driver.update(f, c);
      // the hover: no stride; the hips held over the shell's point, a bob, leaning into its drift (its velocity in its frame)
      const vx = prev.x == null ? 0 : (f.pos.x - prev.x) / dt, vz = prev.x == null ? 0 : (f.pos.z - prev.z) / dt;
      prev.x = f.pos.x; prev.z = f.pos.z;
      const ch = Math.cos(f.heading), sh = Math.sin(f.heading), fwd = vx * sh + vz * ch, side = vx * ch - vz * sh, H = HOVER_LOOK;
      const lx = tilt.x.update(dt, THREE.MathUtils.clamp(fwd * H.lean, -H.most, H.most)), lz = tilt.z.update(dt, THREE.MathUtils.clamp(-side * H.lean, -H.most, H.most));
      t0 += dt;
      if (want.kind !== 'down' && want.kind !== 'fall') {
        // (turned about its hips, not the shell's point)
        J.body.quaternion.setFromEuler(_e.set(lx + (want.pose === 'pulsing' && wind ? 0.1 * c.wind : 0), 0, lz));
        _a.set(0, D.hip, 0); _b.copy(_a).applyQuaternion(J.body.quaternion);
        J.body.position.set(0, Math.sin(t0 * H.rate) * H.bob - (f.stunned > 0 ? 0.1 : 0), 0).add(_a).sub(_b);
      }
      // the ring: turning slowly, fast as it calls; dropped round its hips for the pulse
      call = ease(call, id === 'wake' && wind ? c.wind : 0, 8, dt);
      spin += dt * (0.6 + call * 9 + (id === 'pulse' && wind ? 6 : 0));
      ring.rotation.y = spin;
      ringPivot.position.y = D.chest + 0.02 - (id === 'pulse' && (wind || strike) ? 0.45 * (wind ? c.wind : 1) : 0);
      // the sphere of light between its hands: swelling through the volley's wind-up, gone as the bolt leaves
      gather = ease(gather, (id === 'volley' || id === 'volley2' || id === 'volley3') && wind ? Math.min(1, f.k / 0.6) : 0, 12, dt);
      g.updateMatrixWorld(true);
      orb.visible = gather > 0.03;
      { handsAt(_a); g.worldToLocal(orb.position.copy(_a)).add(_b.set(0, 0, 0.04)); orb.scale.setScalar((orb.visible ? 0.35 + gather * 0.9 : 1e-3) / (skin.scale ?? 1)); }
      // its bolt down the line to you through the strike; the ward's beam and its hoops round the one it guards
      g.updateMatrix(); holder.matrix.copy(_m.copy(g.matrix).invert()); holder.matrixWorldNeedsUpdate = true;
      const volley = id === 'volley' || id === 'volley2' || id === 'volley3';
      bolt.visible = volley && strike; bolt.scale.setScalar(bolt.visible ? 1 : 1e-3);
      if (bolt.visible) {
        handsAt(_a); const d = Math.min(f.atk.range ?? 14, Math.max(1, f.dist ?? 8)), u = Math.min(1, f.k / Math.max(0.05, f.atk.contact ?? 0.5));
        _b.set(Math.sin(f.attackH), 0, Math.cos(f.attackH));
        bolt.position.copy(_a).addScaledVector(_b, d * u); bolt.position.y += (1.1 - (_a.y - f.pos.y)) * u;
        bolt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _b);
      }
      const T = f.wards?.[0];
      const warding = !!T && T.alive && T.dead === undefined;
      beam.visible = warding || (id === 'ward' && wind && f.k > 0.5 && !!f.allyTarget);
      wardG.visible = warding; if (!warding) wardG.scale.setScalar(1e-3);
      if (!beam.visible) beam.scale.setScalar(1e-3);
      if (beam.visible) {
        const to = (warding ? T : f.allyTarget).chest;
        J.hands[1].getWorldPosition(_a); _b.subVectors(to, _a); const l = _b.length();
        beam.position.copy(_a); beam.scale.set(1, Math.max(1e-3, l), 1); if (l > 1e-6) beam.quaternion.setFromUnitVectors(UP, _b.divideScalar(l));
      }
      if (warding) {
        const r = Math.max(T.def.radius + 0.25, (T.def.height ?? 1) * 0.55);
        wardG.position.copy(T.pos).setY(T.pos.y + (T.over ?? 0) + (T.alt ?? 0) + (T.def.height ?? 1) * 0.55);
        wardG.scale.setScalar(r); wardG.rotation.y += dt * 1.2;
      }
      droidGlow(f, X, P, st, dt, { call, over: f.fleeT > 0 ? 0.6 : 0 });
      orbM.uniforms.uGlow.value = 0.85 + 0.15 * Math.sin(t0 * 9);
      return want;
    },
    dispose: M.dispose,
  };
}

/** The shell's radius at y (a profile's linear interpolation; y from the hips, negative down). */
function shellRadius(prof, y) {
  for (let i = 0; i < prof.length - 1; i++) { const [r0, y0] = prof[i], [r1, y1] = prof[i + 1]; if (y >= y0 && y <= y1) return r0 + (r1 - r0) * ((y - y0) / Math.max(1e-6, y1 - y0)); }
  return prof.at(-1)[0];
}

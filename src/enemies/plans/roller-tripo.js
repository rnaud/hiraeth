import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { materials, add, many, tubeGeometry, pivot, pair, lerp, ease, smooth, eyeColor, finish } from './kit.js';
import { gazePart } from '../gaze.js';
import { RigidSkin, rolesOf, skinColours, raw } from './tripo-rigid.js';
import { rollAngle } from './roller.js';

// The pearl roller (issue #800, family D: its approved redesign, references/enemy-redesign-2026-10-30/keep-roller/
// f586ce93-…-1.png, "snail plus pearl: a smooth round shell and broad muscular foot; retracts to roll"): Tripo task
// bac43175-… from that image (the untouched export in keep-roller/tripo/), made into the game's asset by the trial's
// prepare.mjs (references/enemy-redesign-2026-10-30/trials/roller-tripo/: 1.55 m, 12,000 triangles cut into parts by
// geometry, Tripo's ground puddle left out, the reference's flat colours sampled into the vertex colours; public/enemies/
// roller/, loaded by src/enemies/foe-assets.js). The archetype keeps its id, def, attacks and windows; today's steel snail
// (plans/roller.js legacyRollerModel) stands in where the mesh is not loaded, and can come back as a foe of its own.
//
// On the kit's `roller` plan, the machines' rigid parts (plans/tripo-rigid.js): the shell (it spins, locked to the ground
// it rolls over: angle = distance / radius), the head, each eye stalk (lagging its moves on springs, sinking for a
// wind-up) and each eyeball (turning on its stalk's tip to look at you, #508: its pupil its own part), the foot in three
// lengths (a ripple runs back along them by the distance it glides, never a skate). Rolled up, the foot, head and stalks
// draw into the shell (their bones shrunk to its middle) and it is a ball.
//
// Its attacks read from the body (nothing on the ground):
//   bowl       its stalks sink and the shell rocks back and forth on its foot three times; then it pulls in and rolls at
//              you along a lane, bouncing off a wall once
//   ricochet   (its tier-2 skins) the same rocking, faster, the spiral glowing; it bounces twice
//   last       at a quarter of its health it spins in place, glowing, then rolls at you and shatters in a ring
// Skins recolour the same roles and wear their dress: the Garden of Spheres' pearl (its spiral glowing gold), its brass
// wind-up key and its rocking runners; the Salt Harbour's, the White Mangrove's and Space City's their own colours.

/** The pearl roller's asset parts (its triangles grouped in this order: landmarks.parts) and bones (the same order). */
export const ROLLER_PARTS = ['shell', 'head', 'stalk0', 'stalk1', 'eye0', 'eye1', 'foot0', 'foot1', 'foot2'];
/** The reference's flat colours (keep-roller/f586ce93-…-1.png, sampled): the home skin's (the Sealed Hangar's, the Arena's). */
export const ROLLER_HOME = { shell: '#dbe6cc', line: '#465646', foot: '#a5ab82', fold: '#57694a', head: '#d68c6a', eye: '#ece1b1', pupil: '#10140e', brass: '#c9a35e' };
const BI = Object.fromEntries(ROLLER_PARTS.map((p, i) => [p, i]));
const _v = new THREE.Vector3();
const vec = (a) => new THREE.Vector3(...a);

/** The pearl roller's body (the model contract of plans/index.js), from its loaded source (src/enemies/foe-assets.js). */
export function tripoRollerModel(skin, src) {
  const L = src.rig, home = skin.id === 'garage', props = new Set(skin.props), PL = PLANS.roller;
  const P = { ...skin.palette, ...(home ? { shell: ROLLER_HOME.shell, spiral: ROLLER_HOME.line, foot: ROLLER_HOME.foot, foot2: ROLLER_HOME.fold, stalk: ROLLER_HOME.head, eyeball: ROLLER_HOME.eye, eye: ROLLER_HOME.pupil } : {}) };
  const M = materials('roller', skin);
  // (its roll locked to the ground on the plan's radius, 0.7 m: the asset's shell was fitted to it, prepare.mjs)
  const R = PL.shell.radius, C = vec(L.shell.centre), REST = C.y, ROLLED = R;   // (the shell's middle: on its foot, and rolled on the ground)
  const g = new THREE.Group(); g.name = `${skin.name} · pearl roller (Tripo)`;
  const body = pivot(g, 0, 0, 0, 'body');
  // ---------------------------------------------------------------- the bones
  const shell = pivot(body, C.x, C.y, C.z, 'shell'), spin = pivot(shell, 0, 0, 0, 'spin'), shellB = pivot(spin, -C.x, -C.y, -C.z, 'shell part');
  // (the soft parts' bones stood at the shell's middle: shrunk, they draw into it)
  const soft = pivot(body, C.x, C.y, C.z, 'soft'), inner = pivot(soft, -C.x, -C.y, -C.z, 'soft frame');
  const foot = [0, 1, 2].map((k) => { const z = k === 0 ? (L.foot.front + 0.4) : k === 1 ? (L.foot.front + L.foot.back) / 2 : L.foot.back - 0.35; const j = pivot(inner, 0, 0, z, `sole ${k}`), b = pivot(j, 0, 0, -z, `sole ${k} part`); return { j, b, z }; });
  const H = vec(L.head.centre), headJ = pivot(inner, H.x, 0.05, H.z, 'head'), headB = pivot(headJ, -H.x, -0.05, -H.z, 'head part');
  const stalks = L.stalks.map((s, k) => {
    const base = pivot(headB, ...s.base, 'stalk'), b = pivot(base, ...s.base.map((x) => -x), 'stalk part');
    const tip = pivot(base, ...vec(s.tip).sub(vec(s.base)).toArray(), 'eye');
    const eb = pivot(tip, ...s.tip.map((x) => -x), 'eye part');
    return { base, b, tip, eb, s: s.base[0] > 0 ? 1 : -1, k };
  });
  const bones = [shellB, headB, stalks[0].b, stalks[1].b, stalks[0].eb, stalks[1].eb, foot[0].b, foot[1].b, foot[2].b];
  // ---------------------------------------------------------------- the skin's colours over the asset's roles
  const want = home ? null : { shell: P.shell, line: P.spiral ?? P.band, foot: P.foot, fold: P.foot2 ?? P.foot, head: P.stalk ?? P.foot, eye: P.eyeball ?? '#efe8d6' };
  const colour = want ? skinColours(src, rolesOf(src), want) : null;
  const S = new RigidSkin(src, colour);
  const sw = (key) => L.swatches[key] ?? L.swatches.shell;
  g.updateMatrixWorld(true);
  // the pearl shell's wind-up key on its back (it turns as it winds up its bowl): its own bone
  let key = null;
  if (props.has('key')) {
    key = pivot(shell, 0, 0.06, -R - 0.02, 'key'); g.updateMatrixWorld(true);
    const bk = bones.length; bones.push(key); const kc = raw(P.key ?? P.band);
    for (const geo of [new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8).rotateX(Math.PI / 2).translate(0, 0, -0.12), new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14).rotateX(Math.PI / 2), ...pair((s) => new THREE.TorusGeometry(0.09, 0.032, 6, 14).translate(s * 0.1, 0, -0.3))]) S.own(geo, key, bk, kc, sw('brass'));
  }
  const bodyM = M.mat('pearlroller', '#ffffff', { side: THREE.DoubleSide, vertexColors: true });
  const sm = S.make(bodyM, bones, 'tripo skin'); g.add(sm);
  // the pupils: their own mesh (the eye's colour tells its state), on each eyeball, looking ahead
  const eyeM = M.own('eye', P.eye, { glow: 0.2 });
  for (const st of stalks) { const E = L.eyes[st.k]; add(st.eb, new THREE.SphereGeometry(E.r * 0.42, 10, 8).scale(1, 1, 0.5), eyeM, E.centre[0], E.centre[1], E.centre[2] + E.r * 0.92).name = 'pupil'; }
  // the spiral, a fine line of its own on the side the shell coils (it glows: the pearl's always a little, winding up the
  // ricochet, spinning for its last)
  const spiralM = M.own('spiral', P.spiral ?? ROLLER_HOME.line, { glow: props.has('pearl') ? 0.35 : 0.02, line: 0.25, lineTint: 1 });
  {
    const sx = L.shell.spiralSide, pts = [];
    for (let i = 0; i <= 48; i++) { const t = i / 48, th = 0.08 + t * 0.85, ph = t * Math.PI * 2 * 2.2; pts.push([sx * R * Math.cos(th) * 1.006, R * Math.sin(th) * Math.sin(ph) * 1.006, R * Math.sin(th) * Math.cos(ph) * 1.006]); }
    many(spin, [tubeGeometry(pts, 0.012)], spiralM);
  }
  // the pearl shell's rocking runners (its wind-up): two brass rails curving up at both ends, slid out under its foot
  let runners = null;
  const RUN = { r: 1.5, half: 0.62, x: 0.42, lift: 0.07, z: C.z };
  if (props.has('runners')) {
    runners = pivot(body, 0, 0, 0, 'runners');
    const keyM = M.mat('key', P.key ?? P.band, { metal: 'brass', color: P.key ?? P.band });
    const rail = (x) => { const pts = []; for (let i = 0; i <= 10; i++) { const a = -RUN.half + (i / 10) * RUN.half * 2; pts.push([x, RUN.r - Math.cos(a) * RUN.r + 0.025, Math.sin(a) * RUN.r + RUN.z]); } return tubeGeometry(pts, 0.024); };
    many(runners, [rail(-RUN.x), rail(RUN.x), ...[-0.35, 0.35].map((z) => new THREE.CylinderGeometry(0.014, 0.014, RUN.x * 2, 6).rotateZ(Math.PI / 2).translate(0, 0.07 + z * z * 0.25, z + RUN.z))], keyM);
    runners.visible = false;
  }
  // its eyes on you once it has noticed you, on its way before (each eyeball turns on its stalk's tip)
  const gaze = stalks.map(({ tip }) => gazePart(g, tip, { mode: 'turn', yaw: 0.8, up: 0.5, down: 0.5 }));
  finish(g);
  g.updateMatrixWorld(true);
  S.bind();
  const parts = [shell, spin, soft, headJ, ...stalks.map((x) => x.base)];
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const W = PL.wobble, wobble = new SecondOrder(W.f, W.z, W.r), lagX = new SecondOrder(PL.stalks.f, PL.stalks.z, PL.stalks.r), lagZ = new SecondOrder(PL.stalks.f, PL.stalks.z, PL.stalks.r);
  const tuckS = new SecondOrder(PL.shell.tuck.f, PL.shell.tuck.z, PL.shell.tuck.r);
  const rest = stalks.map((x) => x.base.quaternion.clone());
  let prevX = null, prevZ = 0, angle = 0, ripple = 0, glow = 0, speed0 = 0, sinkS = 0, turned = 0, rolled = 0, runK = 0, slid = 0;
  return {
    group: g, gaze, body: shell, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.shell, P.band, P.foot], body3d: 'tripo',
    rollerJoints: { stalks, shell, spin, soft, foot },
    tell: () => spin,
    /** How far its spin has turned (rad) and how far it has rolled: the roll is locked to the distance (tests). */
    get spin() { return angle; },
    get rolled() { return rolled; },
    anim(f, c) {
      if (f.dying) S.letGo();
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike', k = f.k ?? 0;
      const vx = prevX == null ? 0 : (f.pos.x - prevX) / dt, vz = prevX == null ? 0 : (f.pos.z - prevZ) / dt;
      const step = prevX == null ? 0 : Math.hypot(f.pos.x - prevX, f.pos.z - prevZ);
      prevX = f.pos.x; prevZ = f.pos.z;
      const along = step > 3 ? 0 : (vx * Math.sin(f.heading) + vz * Math.cos(f.heading)) * dt;
      const roll = (strike && f.atk?.rolls) || (wind && id === 'last') || f.stunned > 0 || (f.state === 'recover' && f.reel === 'bounced');
      const tuck = THREE.MathUtils.clamp(tuckS.update(dt, roll ? 1 : f.state === 'idle' && f.dist < 1.6 ? 0.8 : 0), 0, 1);
      const P0 = pose.update(dt, { state: f.state, k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      if (tuck > 0.5) { angle += rollAngle(along, R); rolled += along; }
      else angle = ease(angle, Math.round(angle / (Math.PI * 2)) * Math.PI * 2, 3, dt);
      if (wind && id === 'last') angle += dt * lerp(4, 18, c.wind);
      spin.rotation.x = angle;
      const speed = Math.abs(along) / dt;
      if (Math.abs(speed - speed0) > 1.5) wobble.yd += (Math.random() < 0.5 ? -1 : 1) * W.kick * Math.min(3, Math.abs(speed - speed0)) * 0.6;
      if (tuck > 0.5 && speed > 1 && Math.random() < dt * 2) wobble.yd += (Math.random() - 0.5) * W.kick;
      speed0 = speed;
      const wob = wobble.update(dt, 0);
      const rocks = (id === 'bowl' || id === 'ricochet') && wind ? Math.sin(k * Math.PI * 2 * (id === 'ricochet' ? 4.5 : 3)) * 0.22 * smooth(k, 0, 0.3) : 0;
      runK = runners ? ease(runK, (id === 'bowl' || id === 'ricochet') && wind ? 1 : 0, 8, dt) : 0;
      const onRun = runK > 0.02, th = onRun ? rocks * 1.2 * runK : 0;
      if (runners) {
        runners.visible = onRun; runners.scale.set(1, 1, Math.max(0.05, runK));
        body.rotation.x = th;
        const zc = RUN.z;
        body.position.set(0, RUN.lift * runK + RUN.r * (1 - Math.cos(th)) + zc * Math.sin(th), zc * (1 - Math.cos(th)) + RUN.r * (th - Math.sin(th)));
      }
      const shellRock = onRun ? rocks * (1 - runK) : rocks;
      shell.position.set(C.x, lerp(REST, ROLLED, tuck) + P0.y, C.z * (1 - tuck) + P0.z * (1 - tuck));
      shell.rotation.set(shellRock + P0.pitch * (1 - tuck), 0, wob + P0.roll);
      // the soft parts with the shell (rocking with it) and drawn into it as it tucks
      soft.position.copy(shell.position); soft.rotation.set(shellRock * 0.6 + P0.pitch * (1 - tuck), 0, wob * 0.5);
      soft.scale.setScalar(Math.max(0.02, 1 - tuck));
      // the foot: a ripple runs back along its three lengths by the distance glided (never a skate)
      ripple += Math.abs(along) / PL.foot.ripple;
      foot.forEach((s, i) => { const u = Math.sin(Math.PI * 2 * (ripple / PL.foot.waves * 3 - i / 3)); s.j.scale.set(1, 1 + 0.12 * u * Math.min(1, speed), 1 + 0.04 * u * Math.min(1, speed)); });
      headJ.rotation.x = rocks * -0.6;
      // the stalks: lagging its moves; sinking for a wind-up; swaying while it grazes
      const ch = Math.cos(f.heading), sh = Math.sin(f.heading), fwd = vx * sh + vz * ch, side = vx * ch - vz * sh;
      const lx = lagX.update(dt, THREE.MathUtils.clamp(-fwd * 0.12, -0.5, 0.5)), lz = lagZ.update(dt, THREE.MathUtils.clamp(side * 0.12, -0.5, 0.5));
      sinkS = ease(sinkS, wind && id !== 'last' ? 1 : 0, 6, dt);
      turned = f.state === 'idle' ? Math.sin(c.now / 900 + f.home.x) : turned * 0.95;
      stalks.forEach(({ base, s }, i) => {
        base.quaternion.copy(rest[i]);
        base.rotateX(lx + Math.sin(c.now / 600 + i * 1.7) * 0.08 * (f.state === 'idle' ? 1 : 0.3) + sinkS * 0.5); base.rotateY(turned * 0.2); base.rotateZ(lz);
        base.scale.set(1, Math.max(0.3, 1 - 0.6 * sinkS), 1);
      });
      glow = ease(glow, wind && (id === 'ricochet' || id === 'last') ? 0.5 + 0.5 * c.wind : 0, 6, dt);
      spiralM.uniforms.uGlow.value = (props.has('pearl') ? 0.35 : 0.02) + glow * 0.6;
      if (key) { key.visible = tuck < 0.4; if (wind) key.rotation.z += dt * 9; }
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#f3a361'));
      if (strike && f.atk?.rolls && speed > 2 && Math.random() < 0.3) c.dust(f.pos, P.dust ?? '#cdb89a', 1, 0.5);
      if (tuck < 0.3 && !wind) { slid += Math.abs(along); if (slid > 0.24) { slid = 0; c.trail?.(f, -0.35); } }
      if (wind && id === 'last' && Math.random() < 0.3) c.spray(_v.copy(f.pos).setY(f.pos.y + R), [P.shell, P.spiral ?? P.shell], 1, 2.5, 3);
      g.position.y += f.alt;   // (a bubble lifts it: helpless, it floats)
    },
    // (its geometries are its kind's, shared: src/foes.js lets its own go, disposeOwnShapes)
    dispose() { M.dispose(); },
  };
}

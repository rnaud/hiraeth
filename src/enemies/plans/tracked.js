import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { SecondOrder, SecondOrderAngle, quantise } from '../../motion-kit/spring.js';
import { TrackDrive } from '../../motion-kit/machines.js';
import { materials, add, many, skinBy, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 17, the tracked machine (docs/systems/procedural-animation.md §4, the kit's `tracked`): the crucible cart
// (docs/design/enemy-roster.md, archetype 14), drawn to its sheets (references/enemy-archetypes/cart/: sheet-1 the Sealed
// Hangar's welding cart, sheet-2 the Moon Foundry's crucible cart). Two metres wide and as tall as the traveller: a
// squat open crucible, wider than it is tall, with a pouring lip at its front, hung on trunnions in a yoke on a slow
// brass turntable; under it a riveted chassis under patched canvas covers that hang over the tracks; two caterpillar
// tracks with five road wheels, a toothed sprocket at the front and an idler at the back; small springs between the
// tracks and the chassis; (the Hangar's) two short jointed welding-torch arms at the turret's sides, their flames lit.
//
// The possession: boiling over. Ink froths over the crucible's rim like a pot left on the fire and runs down its sides,
// and a column of black smoke with two white eyes rises out of it, sways, and sinks back.
//
// On the kit: the tracks turn by the distance each side covered (src/motion-kit/machines.js TrackDrive: never a slip; a
// turn on the spot runs them opposite ways), the road wheels with them; the chassis pitches and rolls on springs over
// the ground; the turret turns on a slow spring with a servo's overshoot and notches. The belts' treads are painted
// (src/foe-surface.js bands, their offset the belt's run), the wheels one instanced mesh.
//
// Its attacks read from the body (src/telegraph.js):
//   pour   the crucible tips toward you on its trunnions, the lip glowing and the smoke leaning the same way; then a
//          stream of burning slag that stays as patches (foes.js leaveSlag)
//   ram    it backs up, its tracks spinning in place and spitting gravel; then charges in a line (it stalls on a wall)
//   trail  it drips slag behind it as it goes (def.trail)
// A plain shot cools its crust (grey, cuts double); a bomb on its tracks jams them (it can't turn). Calm (`trundle`):
// it trundles its old route between the furnaces, tipping into moulds that are no longer there. Skins
// (src/enemies/skins.js): black-teal and gunmetal with canvas and torches (the Hangar), a rusted ore bucket (the Buried
// Machine), cream enamel and soot-dark brass (the Moon Foundry), a luggage trolley (the Overnight Train, the Arena only).

const T = PLANS.tracked.track, G = T.gauge / 2, TW = 0.42, TH = 0.55, ER = 0.27, RUN = T.length / 2 - ER;
const TRUN_Y = 1.45, TURRET_Y = 0.9;
/** The crucible's profile (r, y) round its trunnions: a rounded bottom, sides flaring to a thick rim. */
const POT = [[0.001, -0.42], [0.3, -0.4], [0.5, -0.33], [0.64, -0.2], [0.72, 0], [0.77, 0.22], [0.8, 0.42], [0.82, 0.5]].map(([r, y]) => new THREE.Vector2(r, y));
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _e = new THREE.Euler();
const WHEELS = [[0.68, 0.28, 0.22, 'sprocket'], [-0.68, 0.27, 0.2, 'idler'], ...[-0.48, -0.24, 0, 0.24, 0.48].map((z) => [z, 0.17, 0.15, 'road'])];

export function cartModel(skin) {
  const PL = PLANS.tracked, P = skin.palette, props = new Set(skin.props), M = materials('cart', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  const chassis = pivot(body, 0, 0, 0, 'chassis');
  // (built in these; drawn as one skinned mesh a material on the moving parts' own joints: kit.js skinBy)
  const hullM = M.mat('hullBuild', P.body), brassM = M.mat('brassBuild', P.brass), darkM = M.mat('darkBuild', P.dark), potM = M.mat('potBuild', P.pot);
  const canvasM = M.mat('canvas', P.canvas, { side: THREE.DoubleSide });
  const brewM = M.own('brew', P.brew, { hatch: 0.45, patches: 0 }), lipM = M.own('lip', P.lip, { glow: 0.55 }), streamM = M.own('stream', P.slag, { glow: 0.95 });
  const smokeB = M.mat('smokeBuild', P.smoke), smokeM = M.mat('smoke', P.smoke, { vertexColors: true, flat: true }), eyeM = M.own('eye', P.eye, { glow: 0.95 });
  // the tracks: each a belt round its wheels (the lower run and the ends one mesh, the upper run turned round so its
  // treads run the other way), their treads painted and run by the distance each side covered
  const beltB = pair((s) => M.mat(`beltBuild${s}`, P.track)), beltM = pair(() => M.own('belt', P.track, { flat: true, vertexColors: true, hatch: 0.45, patches: 0 }));
  const sides = pair((s, i) => {
    const t = pivot(body, s * G, 0, 0, `track ${s > 0 ? 'left' : 'right'}`);
    const low = [new THREE.BoxGeometry(TW, 0.06, RUN * 2).translate(0, 0.03, 0)];
    for (const z of [-1, 1]) low.push(new THREE.CylinderGeometry(ER, ER, TW, 14, 1, true, z > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).translate(0, ER, z * RUN));
    many(t, low, beltB[i]);
    // (the upper run on its own joint, bound unturned and turned round after: its treads, painted in the bound frame, run
    // the other way, and the box looks the same either way round)
    const top = pivot(t, 0, TH - 0.03, 0, 'upper run'); add(top, new THREE.BoxGeometry(TW, 0.06, RUN * 2), beltB[i]);
    // the track frame between the wheels, and the springs up to the chassis
    many(t, [new THREE.BoxGeometry(TW * 0.5, 0.12, RUN * 1.9).translate(0, 0.3, 0), ...[-0.4, 0, 0.4].map((z) => new THREE.CylinderGeometry(0.045, 0.045, 0.24, 8).translate(-s * 0.18, 0.48, z))], darkM);
    many(t, [-0.4, 0, 0.4].flatMap((z) => [0, 1, 2, 3].map((k) => new THREE.TorusGeometry(0.06, 0.012, 4, 10).rotateX(Math.PI / 2).translate(-s * 0.18, 0.4 + k * 0.045, z))), brassM);
    t.userData.top = top;
    return t;
  });
  // the wheels: road wheels, the sprocket and the idler, both sides, one instanced mesh (spokes painted), turned by the belts
  const wheelGeo = new THREE.CylinderGeometry(1, 1, TW * 0.7, 16);
  const wheels = new THREE.InstancedMesh(wheelGeo, M.mat('wheel', P.wheel, { metal: P.wheelMetal ?? undefined }), WHEELS.length * 2);
  wheels.frustumCulled = false; body.add(wheels);
  // the chassis: a riveted box under canvas covers draped over the tracks, brass straps, a patch or two
  add(chassis, new THREE.BoxGeometry(T.gauge - TW + 0.1, 0.5, 1.5), hullM, 0, 0.62, 0);
  const cover = new THREE.Shape(); cover.moveTo(-1.05, 0); cover.lineTo(-0.98, 0.32); cover.lineTo(-0.7, 0.42); cover.lineTo(0.7, 0.42); cover.lineTo(0.98, 0.32); cover.lineTo(1.05, 0); cover.lineTo(0.96, 0.02); cover.lineTo(0.9, 0.3); cover.lineTo(-0.9, 0.3); cover.lineTo(-0.96, 0.02);
  if (!props.has('trolley')) add(chassis, new THREE.ExtrudeGeometry(cover, { depth: 1.62, bevelEnabled: false, steps: 1 }).translate(0, 0, -0.81), canvasM, 0, 0.5, 0);
  many(chassis, [-0.45, 0.45].flatMap((z) => [new THREE.BoxGeometry(2.12, 0.05, 0.08).translate(0, 0.93, z), ...pair((s) => new THREE.BoxGeometry(0.05, 0.36, 0.08).translate(s * 1.02, 0.7, z))]), brassM);
  // (rivets along the chassis' front and back plates)
  many(chassis, [-1, 1].flatMap((z) => Array.from({ length: 8 }, (_, k) => new THREE.SphereGeometry(0.025, 5, 4).translate(-0.5 + k * (1 / 7), 0.8, z * 0.76))), brassM);
  // the turret: a brass turntable, a yoke up to the trunnions, the crucible hung between them
  const turret = pivot(chassis, 0, TURRET_Y, 0, 'turret');
  many(turret, [new THREE.CylinderGeometry(0.74, 0.8, 0.1, 28), new THREE.TorusGeometry(0.78, 0.035, 6, 30).rotateX(Math.PI / 2).translate(0, 0.05, 0), new THREE.CylinderGeometry(0.62, 0.66, 0.08, 24).translate(0, 0.1, 0),
    ...pair((s) => new THREE.BoxGeometry(0.1, TRUN_Y - TURRET_Y + 0.05, 0.22).translate(s * 0.9, (TRUN_Y - TURRET_Y) / 2 + 0.02, 0)), ...pair((s) => new THREE.CylinderGeometry(0.13, 0.13, 0.08, 16).rotateZ(Math.PI / 2).translate(s * 0.95, TRUN_Y - TURRET_Y, 0))], brassM);
  many(turret, Array.from({ length: 14 }, (_, k) => { const a = (k / 14) * Math.PI * 2; return new THREE.BoxGeometry(0.06, 0.06, 0.05).translate(Math.sin(a) * 0.8, 0.0, Math.cos(a) * 0.8).rotateY(0); }), darkM);
  const pot = pivot(turret, 0, TRUN_Y - TURRET_Y, 0, 'crucible');
  add(pot, new THREE.LatheGeometry(POT, 28), potM);
  add(pot, new THREE.TorusGeometry(0.82, 0.055, 8, 30).rotateX(Math.PI / 2), potM, 0, 0.5, 0);
  // the pouring lip at its front: a spout drawn out of the rim, glowing as it tips
  const lip = pivot(pot, 0, 0.47, 0.8, 'lip');
  add(lip, new THREE.CylinderGeometry(0.2, 0.14, 0.32, 12, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2 - 0.3).translate(0, 0.0, 0.1), potM);
  add(lip, new THREE.BoxGeometry(0.3, 0.03, 0.22).translate(0, -0.06, 0.08), lipM);
  // the brew, frothing over: its surface, bubbles on it, ink running down over the rim; a few bands round the pot
  add(pot, new THREE.CircleGeometry(0.78, 26).rotateX(-Math.PI / 2), brewM, 0, 0.44, 0);
  const froth = [];
  for (let k = 0; k < 22; k++) { const a = k * 2.39996, r = 0.3 + ((k * 7) % 5) * 0.1; froth.push(new THREE.SphereGeometry(0.06 + (k % 3) * 0.03, 7, 5).translate(Math.sin(a) * Math.min(r, 0.76), 0.47, Math.cos(a) * Math.min(r, 0.76))); }
  for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2 + (k % 2) * 0.1, l = 0.08 + ((k * 5) % 4) * 0.07; froth.push(new THREE.ConeGeometry(0.035, l, 5).rotateX(Math.PI).translate(Math.sin(a) * 0.86, 0.5 - l / 2, Math.cos(a) * 0.86)); }
  const brew = many(pot, froth, brewM);
  // the column of smoke with two eyes, a chain of puffs each on its own joint (it sways and leans), one skinned mesh
  // (billowing: a broad lump at its foot where the face is, then wisps narrowing and curling off to one side, paler as
  // they rise; each puff a cluster of lumps, the upper ones a lighter grey)
  const puffs = [], smokeHi = M.mat('smokeHiBuild', P.smoke2 ?? P.smoke);
  let parent = pot;
  const R0 = [0.46, 0.42, 0.36, 0.32, 0.28, 0.24, 0.2];
  for (let i = 0; i < R0.length; i++) {
    const p = pivot(parent, i ? 0.04 : 0, i === 0 ? 0.6 : 0.3, 0, `smoke ${i}`), r = R0[i];
    const lumps = [new THREE.IcosahedronGeometry(r, 1).scale(1.15, 0.85, 1)];
    for (let k = 0; k < 5; k++) { const a = k * 1.26 + i * 0.7; lumps.push(new THREE.IcosahedronGeometry(r * (0.5 + (k % 2) * 0.18), 1).translate(Math.sin(a) * r * 0.9, ((k % 3) - 1) * r * 0.35, Math.cos(a) * r * 0.7)); }
    many(p, lumps, i < 3 ? smokeB : smokeHi);
    p.rotation.z = i ? -0.16 : 0;
    puffs.push(p); parent = p;
  }
  const face = pivot(puffs[1], 0, 0, 0.36, 'eyes');
  many(face, pair((s) => new THREE.SphereGeometry(0.07, 8, 6).scale(1, 1.25, 0.6).translate(s * 0.12, 0, 0)), eyeM);
  // the stream of slag from the lip as it pours
  const stream = add(pot, new THREE.CylinderGeometry(0.08, 0.2, 1, 8).translate(0, -0.5, 0), streamM, 0, 0.45, 1.0); stream.visible = false;
  // the Hangar's welding-torch arms at the turret's sides: shoulder, two segments, a torch with its flame
  const torches = [];
  if (props.has('torches')) {
    const flameM = M.own('flame', P.flame ?? '#ffd27a', { glow: 1 });
    for (const s of [-1, 1]) {
      const sh = pivot(turret, s * 0.98, 0.32, -0.1, 'torch arm');
      many(sh, [new THREE.SphereGeometry(0.09, 10, 8), new THREE.CylinderGeometry(0.045, 0.05, 0.5, 8).translate(0, 0.25, 0)], brassM);
      const el = pivot(sh, 0, 0.5, 0, 'torch elbow');
      many(el, [new THREE.SphereGeometry(0.07, 8, 6), new THREE.CylinderGeometry(0.04, 0.045, 0.42, 8).translate(0, 0.21, 0), new THREE.CylinderGeometry(0.06, 0.04, 0.14, 8).translate(0, 0.48, 0)], darkM);
      const fl = add(el, new THREE.ConeGeometry(0.05, 0.2, 8), flameM, 0, 0.64, 0);
      sh.rotation.set(-0.4, 0, -s * 0.5); el.rotation.x = 1.0;
      torches.push({ sh, el, fl, s });
    }
  }
  // dress: the ore cart's rusted bucket bands; the trolley's luggage
  if (props.has('trolley')) {
    const bagM = M.mat('bag', P.canvas);
    many(chassis, [new THREE.BoxGeometry(0.9, 0.42, 0.6).translate(-0.3, 1.0, 0.1), new THREE.BoxGeometry(0.6, 0.32, 0.5).translate(0.45, 0.98, -0.2)], bagM);
  }
  skinBy(g, [{ from: [smokeB, smokeHi], into: smokeM }, { from: [hullM], into: M.mat('hull', P.body, { color2: P.body2, vertexColors: true }) },
    { from: [brassM], into: M.mat('brass', P.brass, { metal: 'brass', color: P.brass, vertexColors: true }) }, { from: [darkM], into: M.mat('dark', P.dark, { flat: true, vertexColors: true }) },
    { from: [potM], into: M.mat('pot', P.pot, { color2: P.pot2, vertexColors: true }) }, { from: [beltB[0]], into: beltM[0] }, { from: [beltB[1]], into: beltM[1] }]);
  for (const t of sides) t.userData.top.rotation.y = Math.PI;
  finish(g);
  const parts = [chassis, turret, pot, ...sides, ...puffs.slice(0, 1)];
  const drive = new TrackDrive({ gauge: T.gauge, length: T.length, wheel: T.wheel, spring: PL.body.spring, tilt: PL.body.tilt });
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const aim = new SecondOrderAngle(PL.turret.f, PL.turret.z, PL.turret.r);
  const tip = new SecondOrder(2.2, 0.6, 0), lean = new SecondOrder(1.2, 0.5, 0);
  let spinRun = 0, rise = 0, phase = Math.random() * 6, crusted = 0;
  const placeWheels = () => {
    let n = 0;
    for (const s of [1, -1]) {
      const ang = drive.wheelAngle(s) + (s > 0 ? spinRun : spinRun);
      for (const [z, y, r] of WHEELS) {
        _e.set(ang * (T.wheel / r), 0, Math.PI / 2, 'XYZ');
        _m.compose(_p.set(s * G, y, z), _q.setFromEuler(_e), _s.set(r, 1, r));
        wheels.setMatrixAt(n++, _m);
      }
    }
    wheels.instanceMatrix.needsUpdate = true;
  };
  placeWheels();
  return {
    group: g, body: chassis, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.body, P.pot, P.smoke],
    tell: (id) => (id === 'ram' ? sides[0] : lip),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      const P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      const o = drive.update(dt, f.pos, f.heading, c.ground);
      // the ram's wind-up: backing up, its tracks spinning in place and spitting gravel off the back
      const spinning = id === 'ram' && wind ? c.wind : 0;
      spinRun += dt * spinning * 9;
      beltM.forEach((m, i) => { const u = m.uniforms.uFs_bandsO; if (u) u.value = ((i ? drive.right : drive.left) + spinRun) / 0.12; });
      placeWheels();
      if (spinning > 0.3 && Math.random() < 0.5) c.spray(V(f.pos.x - Math.sin(f.heading) * 1.1, f.pos.y + 0.15, f.pos.z - Math.cos(f.heading) * 1.1), [P.dust ?? '#9a8a72', '#5a5048'], 2, 3, 9);
      chassis.position.set(0, o.y + P0.y, P0.z);
      chassis.rotation.set(o.pitch + P0.pitch, 0, o.roll + P0.roll);
      sides.forEach((t) => { t.rotation.x = o.pitch * 0.4; });
      // the turret: toward you while it hunts (on its slow spring, notched), square for the pour; sweeping as it trundles
      const hunting = f.state !== 'idle' && f.state !== 'home';
      phase += dt * 0.4;
      const want = wind || strike ? 0 : hunting ? 0 : Math.sin(phase) * 0.7;
      turret.rotation.y = quantise(aim.update(dt, want), PL.turret.notch);
      // the pour: the crucible tips toward you on its trunnions (held from 75 %), the lip glowing, the smoke leaning
      const pour = id === 'pour' ? (wind ? c.wind : strike ? 1 : 0) : 0;
      const calmTip = f.state === 'idle' ? Math.max(0, Math.sin(phase * 0.7) - 0.85) * 3 : 0;   // (into moulds no longer there)
      pot.rotation.x = tip.update(dt, pour * 1.05 + (strike && id === 'pour' ? 0.1 : 0) + calmTip * 0.6);
      lipM.uniforms.uGlow.value = 0.55 + pour * 0.45; lipM.uniforms.uColor.value.set(pour > 0.2 ? P.slag : P.lip);
      stream.visible = id === 'pour' && strike;
      if (stream.visible) { stream.rotation.x = -pot.rotation.x; stream.scale.set(1, 1.5 + Math.sin(c.now / 50) * 0.1, 1); if (Math.random() < 0.6) c.spray(V(f.pos.x + Math.sin(f.heading) * 2.2, f.pos.y + 0.2, f.pos.z + Math.cos(f.heading) * 2.2), [P.slag, P.slag2 ?? '#ffd36a'], 2, 3); }
      // the smoke: a swaying column out of the brew, leaning with the pour; it sinks back down now and then and rises
      rise = ease(rise, f.state === 'idle' ? 0.55 + 0.45 * Math.max(0, Math.sin(c.now / 2600 + f.home.x)) : 1, 1.5, dt);
      const l = lean.update(dt, pour * 0.22 - (o.speed ?? 0) * 0.04);
      puffs.forEach((p, i) => {
        p.rotation.set(l + Math.sin(c.now / 900 + i * 0.8) * 0.06, 0, (i ? -0.16 : 0) + Math.sin(c.now / 1100 + i * 1.1) * 0.08);
        p.scale.setScalar(lerp(0.35, 1, rise) * (1 + Math.sin(c.now / 300 + i) * 0.04));
      });
      face.rotation.x = -pot.rotation.x * 0.7;   // (it keeps looking at you as the pot tips)
      if (Math.random() < 0.12) c.spray(puffs.at(-1).getWorldPosition(_v), [P.smoke, P.smoke2 ?? P.smoke], 1, 0.4, -1.4);
      brew.position.y = Math.sin(c.now / 160) * 0.012;
      // the torches: lit, swaying; raised as it pours
      torches.forEach((t, i) => { t.sh.rotation.x = -0.4 - pour * 0.5 + Math.sin(c.now / 700 + i) * 0.08; t.el.rotation.x = 1.0 - pour * 0.4; t.fl.scale.setScalar(0.85 + Math.random() * 0.3); });
      // doused by a shot, its crust goes grey and cold; jammed by a bomb, its tracks don't turn (sparks off them)
      crusted = ease(crusted, f.crust > 0 ? 1 : 0, 6, dt);
      brewM.uniforms.uColor.value.set(crusted > 0.5 ? P.crust : P.brew);
      if (f.jammed > 0 && Math.random() < 0.2) c.spray(sides[Math.random() < 0.5 ? 0 : 1].getWorldPosition(_v), ['#ffe7a0', '#ff9a3e'], 2, 2.5);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, '#ffb36a'));
      g.position.y += f.alt;   // (lifted by the magnet glove)
    },
    dispose: M.dispose,
  };
}

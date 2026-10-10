import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { materials, add, tubeGeometry, many, skinBy, pivot, pair, lerp, ease, smooth, eyeColor, finish } from './kit.js';

// Plan 16, the roller (docs/systems/procedural-animation.md §4, the kit's `roller`): the pearl roller
// (docs/design/enemy-roster.md, archetype 7), drawn to its sheets (references/enemy-archetypes/roller/: sheet-1 the
// Hangar's ball-bearing snail, sheet-2 the Garden of Spheres' pearl shell). A snail with a shell bigger than itself: a
// nearly round spiral shell 1.4 m across, as tall as the traveller's chest, its spiral raised on its side, a riveted
// band running round it over the top and a lip ring where the foot comes out; under it a soft muscular foot longer than
// the shell, rippled along its sole, its head rising in front with two long eye stalks and two short feelers. Rolled
// up, the foot and the head tuck inside and it is a perfect ball, a shape no other foe has.
//
// On the kit's `roller` plan: unrolled it glides on its foot, a ripple running back along the sole by the distance it
// covers (it never skates), its eye stalks lagging its moves on springs; rolled up, its spin is locked to the ground it
// covers (angle = distance / radius: it never slips) and it wobbles on a spring over bumps and as it starts and stops.
// Draws: the foot's segments, the stalks and the head one skinned mesh (kit.js skinBy), the shell a handful.
//
// Its attacks read from the body (src/telegraph.js; nothing on the ground):
//   bowl       its eye stalks sink and the shell rocks back and forth on its foot three times; then it pulls in and
//              rolls at you along a straight lane, bouncing off a wall once (a guard bounces it off stunned)
//   ricochet   (its tier-2 skins) the same rocking, faster, the spiral glowing; it bounces twice, off the walls at you
//   last       at a quarter of its health it spins in place, glowing, then rolls at you and shatters in a ring of pearl
// Calm (`graze`): it grazes in slow trails, its stalks swaying; touch it and it pulls in. Skins (src/enemies/skins.js):
// the pearl shell's wind-up key (the Garden of Spheres), the brine mollusk's salt crust (the Salt Harbour), the magnetic
// mollusk's bands (Space City), the salt mollusk's chalk (the White Mangrove).

const _v = new THREE.Vector3();

/** The roll locked to the ground: the angle a ball of radius r turns through rolling d m (never a slip). */
export const rollAngle = (d, r) => d / r;

export function rollerModel(skin) {
  const PL = PLANS.roller, P = skin.palette, props = new Set(skin.props), M = materials('roller', skin);
  const R = PL.shell.radius, UP_Y = R + 0.13;   // (the shell's centre: on its foot, and rolled on the ground)
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  const shell = pivot(body, 0, UP_Y, -0.12, 'shell');
  const spin = pivot(shell, 0, 0, 0, 'spin');
  // (the spiral and the band are drawn as the sheet's fine pen lines: a hairline in their own colour, not the heavy ink)
  const shellM = M.mat('shell', P.shell), bandM = M.mat('band', P.band, { metal: props.has('pearl') ? 'brass' : 'steel', color: P.band, line: 0.45, lineTint: 1 });
  const spiralM = M.own('spiral', P.spiral, { glow: props.has('pearl') ? 0.35 : 0.02, line: 0.25, lineTint: 1 });
  const footB = M.mat('footBuild', P.foot), stalkB = M.mat('stalkBuild', P.stalk ?? P.foot), ballB = M.mat('eyeballBuild', P.eyeball ?? '#efe8d6');
  const footM = M.mat('foot', P.foot, { vertexColors: true });
  const eyeM = M.own('eye', P.eye, { glow: 0.2, vertexColors: true }), pupilB = M.mat('pupilBuild', P.eye);
  // the shell: a ball, its spiral raised on its sides (the axis it rolls on), a riveted band round it over the top
  add(spin, new THREE.SphereGeometry(R, 32, 22), shellM);
  const spiral = [];
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48, th = 0.05 + t * 0.95, ph = t * Math.PI * 2 * 2.4 * s;
      pts.push([s * R * Math.cos(th) * 1.004, R * Math.sin(th) * Math.sin(ph) * 1.004, R * Math.sin(th) * Math.cos(ph) * 1.004]);
    }
    spiral.push(tubeGeometry(pts, 0.014));
  }
  many(spin, spiral, spiralM);
  const band = [new THREE.TorusGeometry(R * 0.985, 0.028, 6, 48).rotateY(Math.PI / 2).translate(R * 0.17, 0, 0)];
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; band.push(new THREE.SphereGeometry(0.018, 5, 4).translate(R * 0.17, Math.sin(a) * R * 0.99, Math.cos(a) * R * 0.99)); }
  // (the lip ring where the foot comes out, low at its front, and a second seam round its waist: the sheet's plates)
  band.push(new THREE.TorusGeometry(R * 0.62, 0.035, 6, 32).rotateX(Math.PI / 2 + 0.55).translate(0, -R * 0.62, R * 0.38));
  many(spin, band, bandM);
  // the pearl shell's wind-up key (it turns as it winds up its bowl): on the shell's back, not on the spin
  let key = null;
  if (props.has('key')) {
    key = pivot(shell, 0, 0.06, -R - 0.02, 'key');
    const keyM = M.mat('key', P.key ?? P.band, { metal: 'brass', color: P.key ?? P.band });
    many(key, [new THREE.CylinderGeometry(0.035, 0.035, 0.26, 8).rotateX(Math.PI / 2).translate(0, 0, -0.1), new THREE.CylinderGeometry(0.09, 0.09, 0.05, 14).rotateX(Math.PI / 2),
      ...pair((s) => new THREE.TorusGeometry(0.08, 0.03, 6, 14).translate(s * 0.09, 0, -0.26))], keyM);
  }
  // the foot: seven soft segments along the sole (each its own joint: the ripple runs back along them), longer than
  // the shell, tapering to a point behind; the head rising in front, two long eye stalks, two short feelers
  const foot = pivot(body, 0, 0, 0, 'foot');
  const segs = [];
  for (let i = 0; i < 9; i++) {
    // (overlapping, flat and wide: one soft skirt wider than the shell in front, thinning to a point behind)
    const t = i / 8, z = lerp(0.78, -1.08, t), w = 0.64 * Math.sin(Math.PI * Math.min(1, 0.22 + t * 0.85)) + 0.05, h = 0.08 + 0.04 * Math.sin(Math.PI * t);
    const j = pivot(foot, 0, 0, z, `sole ${i}`);
    add(j, new THREE.SphereGeometry(1, 16, 8).scale(w, h, 0.32), footB, 0, h * 0.55, 0);
    segs.push(j);
  }
  const head = pivot(foot, 0, 0.06, 0.62, 'head');
  add(head, new THREE.SphereGeometry(1, 14, 10).scale(0.24, 0.2, 0.3), footB, 0, 0.1, 0.06);
  const stalks = pair((s) => {
    const base = pivot(head, s * 0.1, 0.3, 0.12, 'stalk');
    add(base, new THREE.CylinderGeometry(0.018, 0.034, 0.74, 7).translate(0, 0.37, 0), stalkB);
    const tip = pivot(base, 0, 0.74, 0, 'eye');
    add(tip, new THREE.SphereGeometry(0.058, 10, 8), ballB);   // (a pale eyeball, its dark pupil looking ahead: the eye's colour tells its state)
    add(tip, new THREE.SphereGeometry(0.028, 8, 6), pupilB, 0, 0.005, 0.045);
    base.rotation.set(0.42, 0, -s * 0.28);
    return { base, tip, s };
  });
  const feelers = pair((s) => {
    const base = pivot(head, s * 0.14, 0.08, 0.32, 'feeler');
    add(base, new THREE.CylinderGeometry(0.012, 0.022, 0.24, 6).translate(0, 0.12, 0), stalkB);
    base.rotation.set(1.3, 0, -s * 0.5);
    return base;
  });
  skinBy(g, [{ from: [footB, stalkB, ballB], into: footM }, { from: [pupilB], into: eyeM }]);   // (the pupils one mesh: their colour tells its state)
  finish(g);
  const parts = [shell, spin, foot, head, ...stalks.map((x) => x.base)];
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const W = PL.wobble, wobble = new SecondOrder(W.f, W.z, W.r), lagX = new SecondOrder(PL.stalks.f, PL.stalks.z, PL.stalks.r), lagZ = new SecondOrder(PL.stalks.f, PL.stalks.z, PL.stalks.r);
  const tuckS = new SecondOrder(PL.shell.tuck.f, PL.shell.tuck.z, PL.shell.tuck.r);
  let prevX = null, prevZ = 0, angle = 0, ripple = 0, glow = 0, speed0 = 0, sinkS = 0, turned = 0, rolled = 0;
  return {
    group: g, body: shell, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.shell, P.band, P.foot],
    tell: () => spin,
    /** How far its spin has turned (rad) and how far it has rolled: the roll is locked to the distance (tests). */
    get spin() { return angle; },
    get rolled() { return rolled; },
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike', k = f.k ?? 0;
      const vx = prevX == null ? 0 : (f.pos.x - prevX) / dt, vz = prevX == null ? 0 : (f.pos.z - prevZ) / dt;
      const step = prevX == null ? 0 : Math.hypot(f.pos.x - prevX, f.pos.z - prevZ);
      prevX = f.pos.x; prevZ = f.pos.z;
      const along = step > 3 ? 0 : (vx * Math.sin(f.heading) + vz * Math.cos(f.heading)) * dt;   // (signed: m along its heading this frame; a teleport is no roll)
      // rolled up: striking with a roll (the bowl, the ricochet, the last), spinning for its last, stunned, or startled
      const roll = (strike && f.atk?.rolls) || (wind && id === 'last') || f.stunned > 0 || f.state === 'recover' && f.reel === 'bounced';
      const tuck = THREE.MathUtils.clamp(tuckS.update(dt, roll ? 1 : f.state === 'idle' && f.dist < 1.6 ? 0.8 : 0), 0, 1);
      const P0 = pose.update(dt, { state: f.state, k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      // the spin: locked to the ground it covers while it rolls; unrolled, it settles back upright
      if (tuck > 0.5) { angle += rollAngle(along, R); rolled += along; }
      else angle = ease(angle, Math.round(angle / (Math.PI * 2)) * Math.PI * 2, 3, dt);
      if (wind && id === 'last') angle += dt * lerp(4, 18, c.wind);   // (the last roll: spinning in place, faster)
      spin.rotation.x = angle;
      // the wobble: a spring kicked when its speed changes (a start, a stop, a wall) and over bumps
      const speed = Math.abs(along) / dt;
      if (Math.abs(speed - speed0) > 1.5) wobble.yd += (Math.random() < 0.5 ? -1 : 1) * W.kick * Math.min(3, Math.abs(speed - speed0)) * 0.6;
      if (tuck > 0.5 && speed > 1 && Math.random() < dt * 2) wobble.yd += (Math.random() - 0.5) * W.kick;
      speed0 = speed;
      const wob = wobble.update(dt, 0);
      // the rocking: back and forth on its foot three times (faster for the ricochet), growing to the strike
      const rocks = (id === 'bowl' || id === 'ricochet') && wind ? Math.sin(k * Math.PI * 2 * (id === 'ricochet' ? 4.5 : 3)) * 0.22 * smooth(k, 0, 0.3) : 0;
      shell.position.set(0, lerp(UP_Y, R, tuck) + P0.y, lerp(-0.12, 0, tuck) + P0.z * (1 - tuck));
      shell.rotation.set(rocks + P0.pitch * (1 - tuck), 0, wob + P0.roll);
      // the foot: a ripple runs back along the sole by the distance glided (never a skate); tucked, it pulls in
      ripple += Math.abs(along) / PL.foot.ripple;
      segs.forEach((j, i) => { const u = Math.sin(Math.PI * 2 * (ripple / PL.foot.waves * 3 - i / PL.foot.waves)); j.scale.set(1, 1 + 0.25 * u * Math.min(1, speed), 1); j.position.y = 0.012 * Math.max(0, u) * Math.min(1, speed); });
      foot.scale.setScalar(Math.max(0.02, 1 - tuck));
      foot.position.set(0, tuck * (UP_Y - 0.2), tuck * -0.1);
      head.rotation.x = rocks * -0.6;
      // the stalks: lagging its moves; sinking for a wind-up; swaying while it grazes
      const ch = Math.cos(f.heading), sh = Math.sin(f.heading), fwd = vx * sh + vz * ch, side = vx * ch - vz * sh;
      const lx = lagX.update(dt, THREE.MathUtils.clamp(-fwd * 0.12, -0.5, 0.5)), lz = lagZ.update(dt, THREE.MathUtils.clamp(side * 0.12, -0.5, 0.5));
      sinkS = ease(sinkS, wind && id !== 'last' ? 1 : 0, 6, dt);
      turned = f.state === 'idle' ? Math.sin(c.now / 900 + f.home.x) : turned * 0.95;
      stalks.forEach(({ base, s }, i) => {
        base.rotation.set(0.42 + lx + Math.sin(c.now / 600 + i * 1.7) * 0.08 * (f.state === 'idle' ? 1 : 0.3), turned * 0.2, -s * 0.28 + lz);
        base.scale.set(1, Math.max(0.15, 1 - 0.8 * sinkS), 1);
      });
      feelers.forEach((b, i) => { b.rotation.x = 1.3 + Math.sin(c.now / 350 + i) * 0.12; });
      // the spiral glows: winding up its ricochet, spinning for its last; the pearl shell's always a little
      glow = ease(glow, wind && (id === 'ricochet' || id === 'last') ? 0.5 + 0.5 * c.wind : 0, 6, dt);
      spiralM.uniforms.uGlow.value = (props.has('pearl') ? 0.35 : 0.02) + glow * 0.6;
      if (key) { key.visible = tuck < 0.4; if (wind) key.rotation.z += dt * 9; }
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, P.flare ?? '#f3a361'));
      if (strike && f.atk?.rolls && speed > 2 && Math.random() < 0.3) c.dust(f.pos, P.dust ?? '#cdb89a', 1, 0.5);
      if (wind && id === 'last' && Math.random() < 0.3) c.spray(_v.copy(f.pos).setY(f.pos.y + R), [P.shell, P.spiral], 1, 2.5, 3);
      g.position.y += f.alt;   // (a bubble lifts it: helpless, it floats)
    },
    dispose: M.dispose,
  };
}

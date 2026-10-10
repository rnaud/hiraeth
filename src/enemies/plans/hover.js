import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { PoseBlend } from '../../motion-kit/pose.js';
import { SecondOrder, quantise } from '../../motion-kit/spring.js';
import { materials, add, many, skinBy, pivot, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 13 for a machine, the hovering machine (docs/systems/procedural-animation.md §4, the kit's `hover`): the ring
// drone (docs/design/enemy-roster.md, archetype 16), drawn to its sheets (references/enemy-archetypes/drone/: sheet-1 the
// City-Shaft's rust drone, sheet-2 the Garden of Spheres' ring drone). A floating cake stand: three flat round plates
// 1.2 m across stacked on a brass spindle with a hand's gap between them, each free to spin, a row of round vents round
// each enamel rim; a brass knob on top and a hub like an upturned bell under it; three thin jointed arms dangling from
// under the bottom plate, each with an elbow and a small three-pronged claw. It hovers with its plates over your head.
//
// The possession: a caught cloud. Black smoke is trapped between the plates like a held breath and bulges out at the
// gaps, leaking wisps; two white eyes drift in it.
//
// On the kit: it hovers on springs, each plate spinning at its own speed, tilting into its drift with a servo's
// overshoot (an underdamped spring) and turning in notches; its arms dangle and lag behind its moves. Draws: the plates,
// their rims, the vents and claws, the brass and the smoke are each one skinned mesh on their own joints (kit.js skinBy).
//
// Its attacks read from the body (src/telegraph.js):
//   harpoon  the plates part and slow, and a reel with a harpoon slides out between them, clicking; it fires along a
//            line and a hit reels you in (guard it to cut the line)
//   ram      its plates lock and spin up, whining higher, as it rises rocked back; then it dives
// Between strikes it hides behind the world (foes.js COVER), as the rust drone did. Calm (`circle`): it circles its post,
// polishing a dome that isn't there, its arms reaching up. Skins (src/enemies/skins.js): pink rust on brass (the
// City-Shaft), pearl and gold with grey smoke (the Garden of Spheres), mismatched plates (the Hangar), a dish for its top
// plate (the Antennas), white enamel with blue (Space City), plates at odd angles (the Fallen Ring).

const R = 0.6, TH = 0.16, YS = [0.42, 0.8, 1.18], ARM = { r: 0.36, y: 0.3, a: 0.5, b: 0.46 };
const _v = new THREE.Vector3();

export function droneModel(skin) {
  const PL = PLANS.hover, P = skin.palette, props = new Set(skin.props), M = materials('drone', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  const plateB = M.mat('plateBuild', P.plate), rimB = M.mat('rimBuild', P.rim), darkB = M.mat('darkBuild', P.dark), brassB = M.mat('brassBuild', P.brass), smokeB = M.mat('smokeBuild', P.smoke), ventB = M.mat('ventBuild', P.vent ?? P.dark);
  const plateM = M.mat('plate', P.plate, { vertexColors: true, metal: P.metal ?? undefined, color: P.plate }), rimM = M.mat('rim', P.rim, { vertexColors: true });
  const darkM = M.mat('dark', P.dark, { vertexColors: true, flat: true }), brassM = M.mat('brass', P.brass, { vertexColors: true, metal: 'brass', color: P.brass });
  const smokeM = M.mat('smoke', P.smoke, { vertexColors: true, flat: true }), eyeM = M.own('eye', P.eye, { glow: 0.9 });
  const tints = P.tints ?? [];   // (the scrap drone's mismatched plates)
  // the three plates on the spindle, each its own pivot (it spins); the rim's vents; the top plate's rings
  const plates = YS.map((y, i) => {
    const p = pivot(body, 0, y, 0, `plate ${i}`);
    const top = i === 2 && props.has('dish');
    const plM = tints[i] ? M.mat(`plateTint${i}`, tints[i]) : plateB;
    if (top) {
      // the relay drone's top plate: a shallow dish facing up, a feed horn on a tripod over it
      add(p, new THREE.CylinderGeometry(R, R * 0.35, TH * 1.4, 28, 1, true), plM);
      add(p, new THREE.CircleGeometry(R, 28).rotateX(-Math.PI / 2), plM, 0, TH * 0.4, 0);
      many(p, [0, 1, 2].map((k) => { const a = (k / 3) * Math.PI * 2; return new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4).translate(0, 0.25, 0).rotateZ(-0.6).rotateY(a).translate(Math.sin(a) * 0.45, TH * 0.5, Math.cos(a) * 0.45); }), brassB);
      add(p, new THREE.ConeGeometry(0.07, 0.16, 10).rotateX(Math.PI), brassB, 0, 0.52, 0);
    } else add(p, new THREE.CylinderGeometry(R, R, TH, 32), plM);
    add(p, new THREE.CylinderGeometry(R + 0.012, R + 0.012, TH * 0.72, 32, 1, true), rimB);
    const vents = [];
    for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; vents.push(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 8).rotateX(Math.PI / 2).translate(0, 0, R + 0.014).rotateY(a)); }
    many(p, vents, ventB);   // (round vents, or the pearl drone's gold rivets: a tint of the dark mesh)
    if (i === 2 && !top) many(p, [new THREE.TorusGeometry(R * 0.72, 0.012, 4, 30).rotateX(Math.PI / 2).translate(0, TH / 2 + 0.005, 0), new THREE.TorusGeometry(R * 0.4, 0.014, 4, 24).rotateX(Math.PI / 2).translate(0, TH / 2 + 0.005, 0)], brassB);
    if (props.has('stripe')) add(p, new THREE.CylinderGeometry(R + 0.016, R + 0.016, TH * 0.18, 32, 1, true), M.mat('stripeBuild', P.accent), 0, 0, 0);
    if (props.has('gyro')) p.userData.tilt = [0.22 * (i - 1), 0.3 * Math.sin(i * 2.1)];
    return p;
  });
  // (the stripes: tinted into the rims' mesh)
  // the spindle through them, collars at each plate; the knob on top, the hub under
  const spindle = [new THREE.CylinderGeometry(0.055, 0.055, YS[2] - YS[0] + 0.1, 10).translate(0, (YS[0] + YS[2]) / 2, 0)];
  for (const y of YS) spindle.push(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12).translate(0, y + TH / 2 + 0.03, 0), new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12).translate(0, y - TH / 2 - 0.03, 0));
  spindle.push(new THREE.CylinderGeometry(0.09, 0.14, 0.1, 14).translate(0, YS[2] + TH / 2 + 0.05, 0), new THREE.CylinderGeometry(0.06, 0.08, 0.08, 12).translate(0, YS[2] + TH / 2 + 0.14, 0), new THREE.SphereGeometry(0.05, 8, 6).translate(0, YS[2] + TH / 2 + 0.2, 0));
  spindle.push(new THREE.SphereGeometry(0.24, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, YS[0] - TH / 2, 0), new THREE.TorusGeometry(0.24, 0.025, 5, 18).rotateX(Math.PI / 2).translate(0, YS[0] - TH / 2 - 0.01, 0));
  many(body, spindle, brassB);
  // the caught cloud: a ring of puffs in each gap, bulging out past the rims, round a dark heart; two white eyes in the lower
  const gaps = [0, 1].map((i) => {
    const p = pivot(body, 0, (YS[i] + YS[i + 1]) / 2, 0, `smoke ${i}`), puffs = [new THREE.CylinderGeometry(R * 0.9, R * 0.9, 0.2, 18)];
    // (puffs bulging out at the gaps, more at its sides and back than at its front, where the eyes look out)
    for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2 + i * 0.4 + Math.sin(k * 3.1) * 0.12, back = 0.5 - 0.5 * Math.cos(a), r = R * (0.86 + back * 0.16 + ((k * 7) % 3) * 0.03), s = 0.05 + back * 0.05 + ((k * 5) % 4) * 0.012; puffs.push(new THREE.IcosahedronGeometry(s, 1).scale(1.5, 0.7, 1.2).translate(Math.sin(a) * r, ((k % 3) - 1) * 0.035, Math.cos(a) * r)); }
    many(p, puffs, smokeB);
    return p;
  });
  const eyes = pivot(gaps[0], 0, 0, R * 0.84, 'eyes');
  many(eyes, [-1, 1].map((s) => new THREE.SphereGeometry(0.05, 8, 6).scale(1, 1.2, 0.6).translate(s * 0.1, 0, 0)), eyeM);
  // three thin arms dangling from under the bottom plate: an upper arm, an elbow, a forearm and a three-pronged claw
  const arms = [0, 1, 2].map((k) => {
    const a = (k / 3) * Math.PI * 2, sh = pivot(body, Math.sin(a) * ARM.r, ARM.y, Math.cos(a) * ARM.r, `arm ${k}`);
    sh.rotation.y = a;
    many(sh, [new THREE.SphereGeometry(0.065, 8, 6), new THREE.CylinderGeometry(0.038, 0.042, ARM.a, 7).translate(0, -ARM.a / 2, 0), new THREE.CylinderGeometry(0.052, 0.052, 0.07, 8).translate(0, -ARM.a * 0.55, 0)], brassB);
    const el = pivot(sh, 0, -ARM.a, 0, 'elbow');
    many(el, [new THREE.SphereGeometry(0.06, 8, 6), new THREE.CylinderGeometry(0.034, 0.038, ARM.b, 7).translate(0, -ARM.b / 2, 0), new THREE.SphereGeometry(0.05, 8, 6).translate(0, -ARM.b, 0)], brassB);
    const claw = pivot(el, 0, -ARM.b - 0.02, 0, 'claw');
    const prongs = [0, 1, 2].map((j) => { const q = pivot(claw, 0, 0, 0, 'prong'); q.rotation.y = (j / 3) * Math.PI * 2; const t = pivot(q, 0, 0, 0.03, 'prong joint'); add(t, new THREE.CylinderGeometry(0.014, 0.026, 0.17, 5).translate(0, -0.085, 0), darkB); return t; });
    return { sh, el, claw, prongs, a };
  });
  // the harpoon: a brass reel of cable and its harpoon on a slide between the middle and the bottom plate (hidden till it aims)
  const gun = pivot(body, 0, (YS[0] + YS[1]) / 2, 0, 'harpoon');
  const reelM = M.mat('reel', P.brass, { metal: 'brass', color: P.brass }), steelM = M.mat('steel', P.steel ?? '#d0d4da');
  many(gun, [new THREE.CylinderGeometry(0.13, 0.13, 0.3, 14).rotateZ(Math.PI / 2), new THREE.CylinderGeometry(0.17, 0.17, 0.03, 14).rotateZ(Math.PI / 2).translate(0.16, 0, 0), new THREE.CylinderGeometry(0.17, 0.17, 0.03, 14).rotateZ(Math.PI / 2).translate(-0.16, 0, 0),
    new THREE.BoxGeometry(0.06, 0.12, 0.3).translate(0.2, -0.05, 0.05), new THREE.BoxGeometry(0.06, 0.12, 0.3).translate(-0.2, -0.05, 0.05)], reelM);
  const harpoon = pivot(gun, 0, 0.02, 0.15, 'harpoon head');
  many(harpoon, [new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6).rotateX(Math.PI / 2).translate(0, 0, 0.35), new THREE.ConeGeometry(0.05, 0.18, 4).rotateX(Math.PI / 2).translate(0, 0, 0.78),
    new THREE.ConeGeometry(0.025, 0.12, 3).rotateX(-Math.PI / 2).rotateY(0.5).translate(0.05, 0, 0.66), new THREE.ConeGeometry(0.025, 0.12, 3).rotateX(-Math.PI / 2).rotateY(-0.5).translate(-0.05, 0, 0.66)], steelM);
  const line = add(gun, new THREE.CylinderGeometry(0.008, 0.008, 1, 4).translate(0, 0.5, 0).rotateX(Math.PI / 2), M.mat('line', P.dark, { flat: true }), 0, 0.02, 0.15);
  line.visible = false; gun.visible = false;
  // (one draw a material for every moving part: skinned on their own pivots)
  const stripeB = props.has('stripe') ? M.mat('stripeBuild', P.accent) : null;
  const tintB = tints.map((t, i) => (t ? M.mat(`plateTint${i}`, t) : null)).filter(Boolean);
  skinBy(g, [{ from: [plateB, ...tintB], into: plateM }, { from: [rimB, ...(stripeB ? [stripeB] : [])], into: rimM }, { from: [darkB, ventB], into: darkM }, { from: [brassB], into: brassM }, { from: [smokeB], into: smokeM }]);
  finish(g);
  const parts = [...plates, ...gaps, ...arms.map((a) => a.sh)];
  const pose = new PoseBlend({ poses: Object.fromEntries(Object.entries(PL.poses).map(([k, p]) => [k, { ...p }])), style: PL.style });
  const B = PL.body, tiltX = new SecondOrder(B.spring.f, B.spring.z, B.spring.r), tiltZ = new SecondOrder(B.spring.f, B.spring.z, B.spring.r);
  const lagX = new SecondOrder(1.6, 0.3, 0), lagZ = new SecondOrder(1.6, 0.3, 0);   // (the dangling arms: they lag the body's moves)
  const spin = PL.plates.spin.map((x) => x * (0.85 + Math.random() * 0.3));
  const prev = { x: null, z: 0 };
  let part = 0, lock = 0, reach = 0, polish = Math.random() * 6;
  return {
    group: g, body, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.plate, P.rim, P.smoke], line, harpoon,
    tell: (id) => (id === 'harpoon' ? harpoon : plates[1]),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      const vx = prev.x == null ? 0 : (f.pos.x - prev.x) / dt, vz = prev.x == null ? 0 : (f.pos.z - prev.z) / dt;
      prev.x = f.pos.x; prev.z = f.pos.z;
      const P0 = pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: c.recovery, stunned: f.stunned });
      g.position.y += f.alt + Math.sin(c.now / 520 + f.home.x) * B.bob;
      // it tilts into its drift with a servo's overshoot, and turns in notches (its aim moves in steps)
      const ch = Math.cos(f.heading), sh = Math.sin(f.heading), fwd = vx * sh + vz * ch, side = vx * ch - vz * sh;
      const tx = tiltX.update(dt, THREE.MathUtils.clamp(fwd * B.tilt, -B.tiltMax, B.tiltMax)), tz = tiltZ.update(dt, THREE.MathUtils.clamp(-side * B.tilt, -B.tiltMax, B.tiltMax));
      body.rotation.set(tx + P0.pitch, quantise(f.heading, PL.aim) - f.heading + P0.yaw, tz + P0.roll);
      body.position.set(0, P0.y, P0.z);
      // the plates: each spins at its own speed; they part and slow for the harpoon, lock and spin up for the ram
      part = ease(part, id === 'harpoon' && (wind || strike) || c.tethered(f) ? 1 : 0, 6, dt);
      lock = ease(lock, id === 'ram' && (wind || strike) ? (strike ? 1 : c.wind) : 0, 5, dt);
      const still = f.stunned > 0 ? 0.15 : 1;
      plates.forEach((p, i) => {
        p.rotation.y += dt * still * lerp(lerp(spin[i], PL.plates.lock * (1 + i * 0.02), lock), spin[i] * 0.2, part);
        const t = p.userData.tilt ?? [0, 0];
        // (parted: the top plate lifts and tips back, the bottom one drops and tips forward, like jaws)
        p.position.y = YS[i] + (i === 2 ? 0.12 : i === 0 ? -0.08 : 0.02) * part;
        p.rotation.x = t[0] + (i === 2 ? -0.28 : i === 0 ? 0.18 : 0) * part;
        p.rotation.z = t[1];
      });
      // the cloud breathes, bulging out of the gaps (a held breath: it swells through a wind-up), and leaks
      const breath = 1 + Math.sin(c.now / 420 + f.home.z) * 0.05 + (wind ? 0.12 * c.wind : 0) + part * 0.15;
      gaps.forEach((p, i) => { p.rotation.y -= dt * (0.25 + i * 0.1); p.scale.set(breath, 1 + part * 0.6 * (i === 0 ? 1 : 0.5), breath); });
      eyes.position.set(Math.sin(c.now / 900) * 0.08, Math.sin(c.now / 650) * 0.03, R * 0.84);
      eyes.rotation.y = -gaps[0].rotation.y;   // (the eyes stay at its front as the cloud turns)
      if (Math.random() < 0.05 + part * 0.2) { const a = Math.random() * Math.PI * 2; c.spray(gaps[Math.random() < 0.5 ? 0 : 1].localToWorld(_v.set(Math.sin(a) * R, 0, Math.cos(a) * R)), [P.smoke, P.smoke2 ?? P.smoke], 1, 0.4, -1.2); }
      // the arms dangle, lagging its moves; they draw up when it is low or rams, reach up to polish when it idles
      const lx = lagX.update(dt, THREE.MathUtils.clamp(fwd * 0.07, -0.35, 0.35)), lz = lagZ.update(dt, THREE.MathUtils.clamp(side * 0.07, -0.35, 0.35));
      const fold = Math.max(lock, f.alt < 1 ? 1 - f.alt : 0), idle = f.state === 'idle' ? 1 : 0;
      polish += dt * 2.2;
      arms.forEach((A, k) => {
        const sway = Math.sin(c.now / 700 + k * 2.1) * 0.08;
        A.sh.rotation.set(lx + sway - fold * 0.9 + (k === 0 ? idle * (-0.9 + Math.sin(polish) * 0.25) : 0), A.a, lz * 0.5);
        A.el.rotation.x = -0.25 - fold * 1.2 - part * 0.3 + (k === 0 ? idle * -0.9 : 0);
        const open = wind ? 0.5 : 0.15 + Math.sin(c.now / 300 + k) * 0.08;
        A.prongs.forEach((q) => { q.rotation.x = -0.45 - open; });
      });
      // the harpoon: the reel slides out between the plates as it aims, clicking round; out along the line as it strikes
      gun.visible = part > 0.05;
      gun.position.z = lerp(-0.2, R * 0.75, part);
      gun.children[0].rotation.x = wind ? Math.floor(c.now / 90) * 0.4 : 0;
      reach = 0;
      if (id === 'harpoon' && strike) reach = (f.atk.range ?? 9) * Math.min(1, f.k / 0.7);
      const held = c.tethered(f);
      if (held) reach = held;
      harpoon.position.z = 0.15 + reach;
      line.visible = reach > 0.2; line.scale.set(1, 1, Math.max(0.01, reach));
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, '#ff8a6a'));
    },
    dispose: M.dispose,
  };
}

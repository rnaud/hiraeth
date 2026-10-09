import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, tube, rod, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 18, the piston-legged machine (docs/systems/procedural-animation.md §4): the lamp tripod
// (docs/design/enemy-roster.md, archetype 13), drawn to its sheets (references/enemy-archetypes/tripod/: sheet-1 the
// City-Shaft's inspection tripod, sheet-2 the Underwater City's diving bell). A lighthouse on stilts, 3.5 m, the
// traveller at its knee: a tall riveted barrel of a boiler in ivory enamel with a slate-blue band at its foot, a big
// round porthole in its front, two smokestacks at its shoulders; on top, on a brass fork, a searchlight as wide as
// the boiler with a grid over its lens; under it three long ivory legs, nearly upright, each with a brass hip, a
// knee that bends out, a brass piston from the boiler to the thigh and a round flat foot. It steps one leg at a time
// in hard straight moves (the kit's machine arc), its lamp turning in a servo's notches.
//
// The possession: a face at the porthole. The dark presses against the boiler's round window from inside, two eyes
// and fingers smearing the glass; its steam comes out black; now and then a leg twitches past its stop.
//
// Its attacks read from the body (src/telegraph.js; the beam is its lamp's light, not a mark on the ground):
//   beam   the searchlight finds you and holds; the shutter closes in notches, the light narrowing and brightening,
//          a harpoon gun slides out under the boiler, then a bolt flies down the beam (break the line, guard it, or
//          parry it back into the lamp)
//   stamp  one leg lifts high and its piston hisses black steam
//   vent   the valves round the boiler rattle open, then black steam bursts round its feet
// Skins (src/enemies/skins.js): enamel and brass (the City-Shaft), a drill under the lamp (the Buried Machine), a
// copper diving bell with portholes, a wind-up key and bubbles (Underwater), gyroscope rings round the lamp (the
// Fallen Ring), a cistern pump with its handle (the Desert).

const HIP_Y = 1.55, FOOT_R = 0.64, LAMP_Y = 3.1, LAMP_R = 0.36;
/** Its legs nearly upright, as drawn: the plan's machine with a straighter knee (thigh and shin 0.535 of hip to foot). */
const LEGS = { ...PLANS.machine, knee: { ...PLANS.machine.knee, lenA: 0.535, lenB: 0.535 } };
/** The boiler's profile: a barrel, a little fuller below its middle, rounding in at the shoulder. */
const BARREL = [[0.001, 1.7], [0.47, 1.7], [0.5, 1.74], [0.53, 2.0], [0.52, 2.3], [0.49, 2.58], [0.44, 2.66], [0.3, 2.71], [0.001, 2.72]].map(([r, y]) => new THREE.Vector2(r, y));
/** The diving bell's: an egg, broad below its middle, round on top. */
const EGG = [[0.001, 1.62], [0.3, 1.64], [0.5, 1.74], [0.6, 1.98], [0.6, 2.2], [0.54, 2.46], [0.42, 2.66], [0.24, 2.78], [0.001, 2.82]].map(([r, y]) => new THREE.Vector2(r, y));
/** The boiler's radius at height y (where its dress sits). */
const radiusAt = (prof, y) => { for (let i = 1; i < prof.length; i++) if (prof[i].y >= y) { const a = prof[i - 1], b = prof[i]; return lerp(a.x, b.x, (y - a.y) / Math.max(1e-6, b.y - a.y)); } return 0.001; };

export function tripodModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('tripod', skin.id);
  const g = new THREE.Group(), hull = pivot(g, 0, 0, 0, 'hull'); g.name = skin.name;
  const bodyM = M.mat('body', P.body, { color2: P.body2 }), brassM = M.mat('brass', P.brass, { metal: 'brass', color: P.brass }), darkM = M.mat('dark', P.dark, { flat: true });
  const accentM = M.mat('accent', P.accent), rustM = M.mat('rust', P.rust, { flat: true }), legM = M.mat('leg', P.leg ?? P.body, { color2: P.body2 });
  const inkM = M.mat('ink', '#141019', { flat: true, lineWhite: true }), glassM = M.mat('glass', '#2a2238', { flat: true });
  const eyeM = M.own('eye', '#f8f0dc', { glow: 0.9 }), lampM = M.own('lamp', P.lamp, { glow: 0.85 }), beamM = M.own('beam', P.lamp, { glow: 0.7, side: THREE.DoubleSide });
  const bell = props.has('bell'), prof = bell ? EGG : BARREL;
  const top = prof[prof.length - 1].y, foot = prof[0].y;
  const R = (y) => radiusAt(prof, y);
  // the boiler: a riveted barrel (an egg of a diving bell Underwater), a band of the accent colour round its foot
  const boiler = add(hull, new THREE.LatheGeometry(prof, 28), bodyM);
  const bandY = bell ? [1.76, 2.0] : [1.74, 1.9];
  const band = add(hull, new THREE.CylinderGeometry(R(bandY[1]) + 0.012, R(bandY[0]) + 0.012, bandY[1] - bandY[0], 28, 1, true), accentM, 0, (bandY[0] + bandY[1]) / 2, 0);
  const keel = add(hull, new THREE.CylinderGeometry(0.34, 0.2, 0.22, 16), darkM, 0, foot - 0.08, 0);
  add(hull, new THREE.TorusGeometry(0.3, 0.03, 6, 20).rotateX(Math.PI / 2), brassM, 0, foot - 0.02, 0);
  const bands = [bandY[0], bandY[1], bell ? 2.46 : 2.58].map((y) => add(hull, new THREE.TorusGeometry(R(y) + 0.015, 0.024, 6, 30).rotateX(Math.PI / 2), brassM, 0, y, 0));
  // a brass cap on the crown (the boiler; the bell's crown is its own)
  if (!bell) add(hull, new THREE.CylinderGeometry(0.3, 0.42, 0.08, 20), brassM, 0, 2.68, 0);
  // rivets round the bands, a panel and a gauge on its flank, pink rust running down from the seams
  for (const y of [bandY[1] + 0.05, bell ? 2.4 : 2.52]) for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = R(y) + 0.005; add(hull, new THREE.SphereGeometry(0.018, 5, 4), brassM, Math.sin(a) * r, y, Math.cos(a) * r); }
  const panel = pivot(hull, 0, 2.05, 0); panel.rotation.y = Math.PI * 0.62;
  add(panel, new THREE.BoxGeometry(0.22, 0.34, 0.05), accentM, 0, 0, R(2.05) + 0.01);
  add(panel, new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12).rotateX(Math.PI / 2), brassM, 0, -0.28, R(1.77) + 0.03);
  for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.32 + (i % 2) * 0.08, y = (bell ? 2.0 : 1.98) + (i % 3) * 0.12, l = 0.12 + (i % 3) * 0.08, r = R(y) + 0.004;
    const st = add(hull, new THREE.BoxGeometry(0.018, l, 0.006), rustM, Math.sin(a) * r, y - l / 2, Math.cos(a) * r); st.rotation.y = a; }
  // the porthole, and the dark pressed against it from inside: two eyes and inky fingers smearing the glass
  const portholes = [];
  const porthole = (y, ry, size, face) => {
    const p = pivot(hull, 0, y, 0); p.rotation.y = ry;
    const at = pivot(p, 0, 0, R(y) + 0.01);
    add(at, new THREE.TorusGeometry(size, size * 0.2, 8, 22), brassM);
    add(at, new THREE.CircleGeometry(size * 0.92, 22), glassM, 0, 0, -0.005);
    if (face) {
      const k = size / 0.17;
      pair((s) => add(at, new THREE.SphereGeometry(0.035 * k, 8, 6).scale(1, 1.3, 0.5), eyeM, s * 0.055 * k, 0.035 * k, 0.01));
      add(at, new THREE.SphereGeometry(0.1 * k, 10, 8).scale(1, 1.05, 0.15), inkM, 0, 0.02 * k, 0.0);
      for (let i = 0; i < 4; i++) { const f = add(at, new THREE.CapsuleGeometry(0.018 * k, 0.09 * k, 3, 6), inkM, (0.03 + i * 0.03) * k, (-0.09 + (i % 2) * 0.02) * k, 0.02); f.rotation.z = -0.3 + i * 0.12; }
    }
    portholes.push(at); return at;
  };
  const face = porthole(bell ? 2.24 : 2.24, 0, bell ? 0.2 : 0.21, true);
  if (bell || props.has('portholes')) { for (const s of [-1, 1]) porthole(2.2, s * 1.25, 0.12, true); porthole(2.2, Math.PI, 0.13, true); }
  // two smokestacks at its shoulders, black steam from their mouths (the vent's tell); valves round its foot
  const vents = pair((s) => { const x = s * (R(2.45) - 0.02); tube(hull, [[x, 2.3, 0.05], [x + s * 0.1, 2.36, 0.05], [x + s * 0.12, 2.5, 0.05], [x + s * 0.12, 2.92, 0.05]], 0.042, brassM);
    add(hull, new THREE.TorusGeometry(0.05, 0.016, 5, 10).rotateX(Math.PI / 2), brassM, x + s * 0.12, 2.72, 0.05);
    return pivot(hull, x + s * 0.12, 2.94, 0.05); });
  const valves = [0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2 + 0.3, r = R(1.82) + 0.03; const v = pivot(hull, Math.sin(a) * r, 1.82, Math.cos(a) * r); add(v, new THREE.CylinderGeometry(0.045, 0.045, 0.07, 8).rotateX(Math.PI / 2), brassM); add(v, new THREE.BoxGeometry(0.11, 0.02, 0.02), darkM, 0, 0.045, 0); v.rotation.y = a; return v; });
  // the wind-up key in the diving bell's side
  if (props.has('key')) { const k = pivot(hull, R(1.95) + 0.02, 1.95, 0); k.rotation.z = -Math.PI / 2; rod(k, [0, 0, 0], [0, 0.14, 0], 0.02, brassM); for (const s of [-1, 1]) add(k, new THREE.TorusGeometry(0.06, 0.02, 6, 12), M.mat('key', P.rust), s * 0.065, 0.2, 0); valves.push(k); }
  // the lamp: a neck from the crown to a brass fork that turns (yaw); between its arms the searchlight, a drum as
  // wide as the boiler, tips (pitch); its lens behind a grid and a shutter of four leaves that close in notches
  const neckTop = top + 0.08;
  rod(hull, [0, top - 0.05, 0], [0, neckTop, 0], 0.08, brassM);
  const lampYaw = pivot(hull, 0, neckTop, 0, 'lamp yaw'), lamp = pivot(lampYaw, 0, LAMP_Y - neckTop, 0, 'lamp');
  add(lampYaw, new THREE.CylinderGeometry(0.16, 0.2, 0.06, 14), brassM);
  for (const s of [-1, 1]) tube(lampYaw, [[0, 0.02, 0], [s * 0.3, 0.06, 0], [s * (LAMP_R + 0.07), 0.14, 0], [s * (LAMP_R + 0.07), LAMP_Y - neckTop, 0]], 0.03, brassM);
  pair((s) => add(lamp, new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10).rotateZ(Math.PI / 2), brassM, s * (LAMP_R + 0.06), 0, 0));
  add(lamp, new THREE.CylinderGeometry(LAMP_R, LAMP_R * 0.9, 0.38, 22).rotateX(Math.PI / 2), bodyM, 0, 0, -0.02);
  add(lamp, new THREE.CylinderGeometry(LAMP_R + 0.012, LAMP_R + 0.012, 0.1, 22, 1, true).rotateX(Math.PI / 2), accentM, 0, 0, -0.1);
  add(lamp, new THREE.TorusGeometry(LAMP_R, 0.04, 8, 28), brassM, 0, 0, 0.18);
  add(lamp, new THREE.TorusGeometry(LAMP_R * 0.9, 0.025, 6, 24), brassM, 0, 0, -0.21);
  add(lamp, new THREE.CylinderGeometry(LAMP_R * 0.75, LAMP_R * 0.6, 0.12, 16).rotateX(Math.PI / 2), darkM, 0, 0, -0.26);
  const lens = add(lamp, new THREE.CircleGeometry(LAMP_R * 0.94, 26), lampM, 0, 0, 0.175);
  for (const r of [0, Math.PI / 2]) { const b = add(lamp, new THREE.BoxGeometry(LAMP_R * 1.9, 0.02, 0.015), brassM, 0, 0, 0.19); b.rotation.z = r; }
  add(lamp, new THREE.TorusGeometry(LAMP_R * 0.32, 0.012, 5, 16), brassM, 0, 0, 0.19);
  const shutter = [0, 1, 2, 3].map((k) => { const s = pivot(lamp, 0, 0, 0.2); s.rotation.z = (k * Math.PI) / 2; add(s, new THREE.BoxGeometry(LAMP_R * 1.1, LAMP_R * 0.5, 0.012), darkM, 0, LAMP_R * 0.95, 0); return s; });
  if (props.has('drill')) { const d = pivot(lamp, 0, -LAMP_R - 0.06, 0.05); for (let i = 0; i < 4; i++) add(d, new THREE.ConeGeometry(0.11 - i * 0.022, 0.1, 8).rotateX(Math.PI / 2), rustM, 0, 0, 0.12 + i * 0.08); }
  const rings = [];
  if (props.has('gyro')) for (let k = 0; k < 2; k++) { const r = pivot(lamp, 0, 0, 0); add(r, new THREE.TorusGeometry(LAMP_R + 0.14 + k * 0.08, 0.016, 6, 30), brassM); r.rotation.set(k ? 1.1 : 0.4, k * 0.8, 0); rings.push(r); }
  if (props.has('pump')) { const h = pivot(hull, 0.5, 2.5, 0); rod(h, [0, 0, 0], [0.45, 0.35, -0.1], 0.035, brassM); add(h, new THREE.SphereGeometry(0.06, 8, 6), darkM, 0.45, 0.35, -0.1); rings.push(h);
    tube(hull, [[-0.45, 2.0, 0.1], [-0.75, 2.05, 0.2], [-0.85, 1.75, 0.25]], 0.06, brassM); }
  if (props.has('enamel')) for (const s of [-1, 1]) { const p = pivot(hull, 0, 2.2, 0); p.rotation.y = s * 0.55; add(p, new THREE.BoxGeometry(0.05, 0.6, 0.02), accentM, 0, 0, R(2.2) + 0.006); }
  // the light: a short cone of it always (sweeping as it patrols), a shaft to you as it aims, and the bolt
  const light = pivot(lamp, 0, 0, 0.2, 'light');
  const glowCone = add(light, new THREE.ConeGeometry(LAMP_R * 0.95, 0.8, 16, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 0.4), beamM);
  const shaft = add(light, new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5), beamM); shaft.visible = false;
  const bolt = pivot(light, 0, 0, 0, 'bolt');
  add(bolt, new THREE.ConeGeometry(0.06, 0.3, 6).rotateX(Math.PI / 2), brassM, 0, 0, 0.5); rod(bolt, [0, 0, -0.1], [0, 0, 0.36], 0.018, darkM); bolt.visible = false;
  // the harpoon gun under the boiler: it slides out, loaded, as the beam narrows
  const gun = pivot(hull, 0, foot - 0.14, 0, 'harpoon');
  add(gun, new THREE.CylinderGeometry(0.075, 0.075, 0.42, 12).rotateX(Math.PI / 2), brassM, 0, 0, 0.1);
  add(gun, new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10).rotateX(Math.PI / 2), darkM, 0, 0, -0.14);
  rod(gun, [0, 0, 0.3], [0, 0, 0.7], 0.016, darkM);
  add(gun, new THREE.ConeGeometry(0.05, 0.16, 4).rotateX(Math.PI / 2), M.mat('steel', '#c9ccd2'), 0, 0, 0.76);
  tube(gun, [[0.07, 0.02, -0.1], [0.16, 0.12, -0.05], [0.12, 0.2, 0.02]], 0.015, M.mat('hose', '#7a5a9a'));
  gun.visible = false;
  // three long jointed legs on the kit (plan 18), nearly upright: a brass hip under the boiler, an ivory thigh down
  // to a brass knee that bends out, a shin down to a round flat foot, a brass piston from the boiler to each thigh; a
  // wave, one leg at a time, in three straight moves
  const legs = [0, 1, 2].map((k) => {
    const a = (k / 3) * Math.PI * 2 + Math.PI, sx = Math.sin(a), cz = Math.cos(a);
    return planLeg(LEGS, { group: g, body: hull, hip: { x: sx * 0.36, y: HIP_Y, z: cz * 0.36 }, foot: { x: sx * FOOT_R, z: cz * FOOT_R }, radius: 0.062, pad: 'disc',
      pole: { x: sx * 1.4, y: 0.15, z: cz * 1.4 },
      piston: { at: { x: sx * 0.42, y: HIP_Y + 0.3, z: cz * 0.42 } }, mats: { joint: brassM, thigh: legM, shin: legM, foot: brassM, piston: brassM, rod: darkM }, name: `tripod leg ${k}` });
  });
  const rig = new Rig({ plan: LEGS, group: g, body: hull, legs });
  finish(g);
  const parts = [boiler, band, keel, ...bands, panel, ...portholes, lampYaw, ...legs.map((l) => l.root)];
  const sweepPhase = Math.random() * 6;
  let aimYaw = 0, aimPitch = 0, close = 0, stamp = 0, twitch = 0, twitchLeg = 0, nextTwitch = 2 + Math.random() * 3;
  return {
    group: g, body: hull, rig, parts, eyeMat: eyeM, base: '#f8f0dc', size: skin.scale, skin: skin.id, tones: [P.body, P.brass, '#141019'],
    tell: (id) => (id === 'beam' ? lens : id === 'stamp' ? legs[0].foot : vents[0]),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // the stamp: leg 0 lifts high under the boiler, its piston hissing; the vent: valves rattling
      stamp = ease(stamp, id === 'stamp' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0, wind ? 8 : 20, dt);
      legs[0].lift = stamp; legs[0].air.set(0, stamp * 0.75, stamp * 0.25);
      // possessed: now and then a leg twitches past its stop (not while it aims)
      nextTwitch -= dt;
      if (nextTwitch < 0 && !wind) { twitch = 0.18; twitchLeg = 1 + Math.floor(Math.random() * 2); nextTwitch = 2.5 + Math.random() * 4; }
      twitch = Math.max(0, twitch - dt);
      legs[1].lift = twitchLeg === 1 ? twitch * 2 : 0; legs[2].lift = twitchLeg === 2 ? twitch * 2 : 0;
      legs[1].air.set(0, 0.2, 0); legs[2].air.set(0, 0.2, 0);
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery, air: f.alt > 0.05 ? 1 : 0 });
      const aimBack = id === 'beam' && wind ? c.wind : 0;
      hull.position.set(o.x, o.y - stamp * 0.12, o.z);
      hull.rotation.set(o.pitch - aimBack * 0.06 + (twitch > 0 ? Math.sin(c.now / 20) * 0.03 : 0), o.yaw, o.roll + stamp * 0.08);
      // the lamp: sweeps as it patrols, turns on you when it hunts, holds as it aims (in a servo's notches)
      const hunting = f.state !== 'idle' && f.state !== 'home';
      const d = Math.max(1, f.dist === Infinity ? 10 : f.dist);
      const wantYaw = hunting ? 0 : Math.sin(c.now / 1400 + sweepPhase) * 0.9;
      const wantPitch = hunting ? Math.atan2(LAMP_Y * (skin.scale ?? 1) - 1.1, d) : 0.32 + Math.sin(c.now / 900 + sweepPhase) * 0.12;
      aimYaw = ease(aimYaw, wantYaw, wind ? 12 : 3, dt); aimPitch = ease(aimPitch, wantPitch, 6, dt);
      lampYaw.rotation.y = Math.round(aimYaw / 0.06) * 0.06;
      lamp.rotation.x = Math.round(aimPitch / 0.04) * 0.04 - o.pitch;
      for (const r of rings) r.rotation.y += dt * (hunting ? 3 : 0.8);
      // the shutter closes in notches through the beam's wind-up: the light narrows to a shaft and brightens
      close = id === 'beam' && wind ? Math.floor(c.wind * 5) / 5 : id === 'beam' && strike ? 1 : 0;
      shutter.forEach((s) => { s.children[0].position.y = lerp(LAMP_R * 0.95, LAMP_R * 0.4, close); });
      const aiming = id === 'beam' && (wind || strike);
      glowCone.visible = !aiming && f.state !== 'dead';
      glowCone.scale.set(1, 1, hunting ? 1.4 : 1);
      shaft.visible = aiming;
      if (aiming) { const len = Math.min(f.atk.range ?? 18, Math.hypot(d, LAMP_Y - 1)); const r = lerp(0.36, 0.05, close); shaft.scale.set(r, r, len); }
      lampM.uniforms.uGlow.value = 0.7 + close * 0.3; lampM.uniforms.uColor.value.set(close > 0.7 ? '#ffffff' : P.lamp);
      beamM.uniforms.uGlow.value = 0.45 + close * 0.5;
      // the harpoon gun slides out under the boiler as it aims, and turns with the lamp
      gun.visible = aiming;
      if (aiming) { gun.position.z = lerp(-0.25, 0.12, wind ? Math.min(1, c.wind * 1.6) : 1); gun.rotation.set(Math.round(aimPitch / 0.04) * 0.04 * 0.6, lampYaw.rotation.y, 0); }
      // the bolt flies down the beam as it strikes
      bolt.visible = id === 'beam' && strike;
      if (bolt.visible) bolt.position.z = Math.min(f.atk.range ?? 18, d) * Math.min(1, f.k / Math.max(0.05, f.atk.contact ?? 0.6));
      // the valves rattle before the vent; black steam from the stacks as it walks, and a burst round its feet
      const rattle = id === 'vent' && wind ? c.wind : 0;
      valves.forEach((v, i) => { v.rotation.z = rattle ? Math.sin(c.now / 25 + i) * 0.5 * rattle : 0; });
      if ((c.moving && Math.random() < 0.06) || (rattle > 0.4 && Math.random() < 0.4) || Math.random() < 0.015) { const v = vents[Math.floor(Math.random() * 2)]; c.spray(v.getWorldPosition(V()), ['#1a1620', '#3b2a4c'], 1, 0.6, -1.5); }
      if (props.has('bubbles') && Math.random() < 0.05) c.spray(vents[Math.floor(Math.random() * 2)].getWorldPosition(V()), ['#e4edf6', '#bccde2'], 1, 0.3, -2.5);
      if (id === 'vent' && strike && !f._vented) { f._vented = true; for (let i = 0; i < 6; i++) c.spray(V(f.pos.x + Math.sin(i) * 1.2, f.pos.y + 0.4, f.pos.z + Math.cos(i) * 1.2), ['#1a1620', '#3b2a4c', '#6a5a7a'], 6, 3, -1); }
      if (!strike) f._vented = false;
      if (stamp > 0.6 && Math.random() < 0.3) c.spray(legs[0].foot.getWorldPosition(V()), ['#1a1620', '#3b2a4c'], 1, 0.8, -1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, '#f8f0dc', '#ff8a5a'));
      // (the face presses closer to the glass as it aims)
      face.scale.setScalar(1 + aimBack * 0.06);
      g.position.y += f.alt;   // (held up off its feet by the magnet glove)
      rig.write();
    },
    dispose: M.dispose,
  };
}

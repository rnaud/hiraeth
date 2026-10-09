import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, tube, rod, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 18, the piston-legged machine (docs/systems/procedural-animation.md §4): the lamp tripod
// (docs/design/enemy-roster.md, archetype 13). A tall ivory boiler with a searchlight on top, on three thin jointed
// legs with a brass piston from the boiler to each thigh: a lighthouse on stilts, 3.5 m. It steps one leg at a time
// in hard straight moves (the kit's machine arc), its lamp turning in a servo's notches.
//
// The possession: a face at the porthole. The dark presses against the boiler's round window from inside, two eyes
// and fingers smearing the glass; its steam comes out black; now and then a leg twitches past its stop.
//
// Its attacks read from the body (src/telegraph.js; the beam is its lamp's light, not a mark on the ground):
//   beam   the searchlight finds you and holds; the shutter closes in notches, the light narrowing and brightening,
//          then a harpoon bolt flies down the beam (break the line, guard it, or parry it back into the lamp)
//   stamp  one leg lifts high and its piston hisses black steam
//   vent   the valves round the boiler rattle open, then black steam bursts round its feet
// Skins (src/enemies/skins.js): enamel and brass (the City-Shaft), a drill under the lamp (the Buried Machine), a
// diving bell with portholes (Underwater), gyroscope rings round the lamp (the Fallen Ring), a cistern pump with its
// handle (the Desert). Art match pending its sheet (docs/design/enemy-roster-prompts.md, `tripod`).

const HIP_Y = 1.62, FOOT_R = 1.3, LAMP_Y = 3.02;

export function tripodModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('tripod', skin.id);
  const g = new THREE.Group(), hull = pivot(g, 0, 0, 0, 'hull'); g.name = skin.name;
  const bodyM = M.mat('body', P.body, { color2: P.body2 }), brassM = M.mat('brass', P.brass, { metal: 'brass', color: P.brass }), darkM = M.mat('dark', P.dark, { flat: true });
  const accentM = M.mat('accent', P.accent), rustM = M.mat('rust', P.rust, { flat: true });
  const inkM = M.mat('ink', '#141019', { flat: true, lineWhite: true });
  const eyeM = M.own('eye', '#f8f0dc', { glow: 0.9 }), lampM = M.own('lamp', P.lamp, { glow: 0.85 }), beamM = M.own('beam', P.lamp, { glow: 0.7, side: THREE.DoubleSide });
  const bell = props.has('bell');
  // the boiler: a tall riveted drum (a round diving bell Underwater) with a domed top and a cone beneath
  const boiler = bell
    ? add(hull, new THREE.SphereGeometry(0.62, 20, 14).scale(1, 1.05, 1), bodyM, 0, 2.18, 0)
    : add(hull, new THREE.CylinderGeometry(0.48, 0.5, 1.12, 20), bodyM, 0, 2.12, 0);
  const dome = bell ? null : add(hull, new THREE.SphereGeometry(0.48, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), bodyM, 0, 2.68, 0);
  const keel = add(hull, new THREE.ConeGeometry(0.42, 0.42, 16).rotateX(Math.PI), darkM, 0, 1.42, 0);
  const bands = (bell ? [1.85, 2.5] : [1.62, 2.12, 2.62]).map((y) => add(hull, new THREE.TorusGeometry(bell ? 0.58 : 0.5, 0.035, 6, 28).rotateX(Math.PI / 2), brassM, 0, y, 0));
  // a riveted panel on its back and rivets round the bands
  const panel = add(hull, new THREE.BoxGeometry(0.4, 0.5, 0.04), accentM, 0, 2.15, -0.49);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(hull, new THREE.SphereGeometry(0.022, 5, 4), brassM, Math.sin(a) * 0.51, 1.9, Math.cos(a) * 0.51); }
  // the porthole, and the dark pressed against it from inside: two eyes and inky fingers smearing the glass
  const portholes = [];
  const porthole = (x, y, z, ry, face) => {
    const p = pivot(hull, x, y, z); p.rotation.y = ry;
    add(p, new THREE.TorusGeometry(0.17, 0.035, 8, 20), brassM);
    add(p, new THREE.CircleGeometry(0.155, 20), inkM, 0, 0, -0.005);
    if (face) {
      pair((s) => add(p, new THREE.SphereGeometry(0.035, 8, 6).scale(1, 1.3, 0.5), eyeM, s * 0.055, 0.03, 0.01));
      for (let i = 0; i < 4; i++) { const f = add(p, new THREE.CapsuleGeometry(0.018, 0.09, 3, 6), inkM, -0.1 + i * 0.065, -0.11 + (i % 2) * 0.02, 0.02); f.rotation.z = -0.2 + i * 0.12; }
    }
    portholes.push(p); return p;
  };
  const face = porthole(0, 2.25, bell ? 0.62 : 0.5, 0, true);
  if (bell || props.has('portholes')) for (const s of [-1, 1]) porthole(s * 0.5, 2.15, 0.36, s * 0.95, true);
  // black steam vents on its shoulders, and valves round the boiler (they rattle before the vent)
  const vents = [0, 1, 2].map((k) => { const a = (k / 3) * Math.PI * 2 + Math.PI / 3; const v = pivot(hull, Math.sin(a) * 0.4, bell ? 2.72 : 2.78, Math.cos(a) * 0.4); rod(v, [0, 0, 0], [Math.sin(a) * 0.08, 0.22, Math.cos(a) * 0.08], 0.04, brassM); return v; });
  const valves = [0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2; const v = pivot(hull, Math.sin(a) * 0.5, 1.72, Math.cos(a) * 0.5); add(v, new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8).rotateX(Math.PI / 2), brassM); add(v, new THREE.BoxGeometry(0.12, 0.02, 0.02), darkM, 0, 0.05, 0); v.rotation.y = a; return v; });
  // the lamp: a neck from the dome to a searchlight housing that turns (yaw) and tips (pitch), its lens behind a
  // shutter of four leaves that close in notches as it aims
  const neckTop = bell ? 2.82 : 2.86;
  rod(hull, [0, bell ? 2.7 : 2.6, 0], [0, neckTop, 0], 0.07, brassM);
  const lampYaw = pivot(hull, 0, neckTop, 0, 'lamp yaw'), lamp = pivot(lampYaw, 0, LAMP_Y - neckTop, 0, 'lamp');
  add(lampYaw, new THREE.TorusGeometry(0.16, 0.03, 6, 14).rotateX(Math.PI / 2), brassM);
  rod(lampYaw, [-0.2, 0, 0], [-0.2, LAMP_Y - neckTop, 0], 0.03, brassM); rod(lampYaw, [0.2, 0, 0], [0.2, LAMP_Y - neckTop, 0], 0.03, brassM);
  add(lamp, new THREE.CylinderGeometry(0.24, 0.2, 0.46, 16).rotateX(Math.PI / 2), brassM, 0, 0, -0.02);
  add(lamp, new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12).rotateX(Math.PI / 2), darkM, 0, 0, -0.3);
  const lens = add(lamp, new THREE.CircleGeometry(0.2, 20), lampM, 0, 0, 0.215);
  const shutter = [0, 1, 2, 3].map((k) => { const s = pivot(lamp, 0, 0, 0.22); s.rotation.z = (k * Math.PI) / 2; add(s, new THREE.BoxGeometry(0.22, 0.12, 0.012), darkM, 0, 0.21, 0); return s; });
  if (props.has('drill')) { const d = pivot(lamp, 0, -0.26, 0.05); for (let i = 0; i < 4; i++) add(d, new THREE.ConeGeometry(0.11 - i * 0.022, 0.1, 8).rotateX(Math.PI / 2), rustM, 0, 0, 0.12 + i * 0.08); }
  const rings = [];
  if (props.has('gyro')) for (let k = 0; k < 2; k++) { const r = pivot(lamp, 0, 0, 0); add(r, new THREE.TorusGeometry(0.36 + k * 0.07, 0.016, 6, 30), brassM); r.rotation.set(k ? 1.1 : 0.4, k * 0.8, 0); rings.push(r); }
  if (props.has('pump')) { const h = pivot(hull, 0.5, 2.5, 0); rod(h, [0, 0, 0], [0.45, 0.35, -0.1], 0.035, brassM); add(h, new THREE.SphereGeometry(0.06, 8, 6), darkM, 0.45, 0.35, -0.1); rings.push(h);
    tube(hull, [[-0.45, 2.0, 0.1], [-0.75, 2.05, 0.2], [-0.85, 1.75, 0.25]], 0.06, brassM); }
  if (props.has('enamel')) for (const s of [-1, 1]) add(hull, new THREE.BoxGeometry(0.06, 0.7, 0.02), accentM, s * 0.25, 2.12, 0.48);
  // the light: a short cone of it always (sweeping as it patrols), a shaft to you as it aims, and the bolt
  const light = pivot(lamp, 0, 0, 0.22, 'light');
  const glowCone = add(light, new THREE.ConeGeometry(0.5, 1.7, 16, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 0.85), beamM);
  const shaft = add(light, new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5), beamM); shaft.visible = false;
  const bolt = pivot(light, 0, 0, 0, 'bolt');
  add(bolt, new THREE.ConeGeometry(0.06, 0.3, 6).rotateX(Math.PI / 2), brassM, 0, 0, 0.5); rod(bolt, [0, 0, -0.1], [0, 0, 0.36], 0.018, darkM); bolt.visible = false;
  // three jointed legs on the kit (plan 18): a hip under the boiler, a thigh out and up to a brass knee, a shin down to a
  // round pad, a piston from the boiler to each thigh; a wave, one leg at a time, in three straight moves
  const legs = [0, 1, 2].map((k) => {
    const a = (k / 3) * Math.PI * 2 + Math.PI, sx = Math.sin(a), cz = Math.cos(a);
    return planLeg(PLANS.machine, { group: g, body: hull, hip: { x: sx * 0.32, y: HIP_Y, z: cz * 0.32 }, foot: { x: sx * FOOT_R, z: cz * FOOT_R }, radius: 0.055, pad: 'disc',
      piston: { at: { x: sx * 0.46, y: HIP_Y + 0.42, z: cz * 0.46 } }, mats: { joint: brassM, thigh: darkM, shin: darkM, foot: brassM, piston: brassM, rod: darkM }, name: `tripod leg ${k}` });
  });
  const rig = new Rig({ plan: PLANS.machine, group: g, body: hull, legs });
  finish(g);
  const parts = [boiler, ...(dome ? [dome] : []), keel, ...bands, panel, ...portholes, ...vents, lampYaw, ...legs.map((l) => l.root)];
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
      shutter.forEach((s) => { s.children[0].position.y = lerp(0.21, 0.1, close); });
      const aiming = id === 'beam' && (wind || strike);
      glowCone.visible = !aiming && f.state !== 'dead';
      glowCone.scale.set(1, 1, hunting ? 1.4 : 1);
      shaft.visible = aiming;
      if (aiming) { const len = Math.min(f.atk.range ?? 18, Math.hypot(d, LAMP_Y - 1)); const r = lerp(0.3, 0.05, close); shaft.scale.set(r, r, len); }
      lampM.uniforms.uGlow.value = 0.7 + close * 0.3; lampM.uniforms.uColor.value.set(close > 0.7 ? '#ffffff' : P.lamp);
      beamM.uniforms.uGlow.value = 0.45 + close * 0.5;
      // the bolt flies down the beam as it strikes
      bolt.visible = id === 'beam' && strike;
      if (bolt.visible) bolt.position.z = Math.min(f.atk.range ?? 18, d) * Math.min(1, f.k / Math.max(0.05, f.atk.contact ?? 0.6));
      // the valves rattle before the vent; black steam from the vents as it walks, and a burst round its feet
      const rattle = id === 'vent' && wind ? c.wind : 0;
      valves.forEach((v, i) => { v.rotation.z = rattle ? Math.sin(c.now / 25 + i) * 0.5 * rattle : 0; });
      if ((c.moving && Math.random() < 0.06) || (rattle > 0.4 && Math.random() < 0.4)) { const v = vents[Math.floor(Math.random() * 3)]; c.spray(v.getWorldPosition(V()), ['#1a1620', '#3b2a4c'], 1, 0.6, -1.5); }
      if (id === 'vent' && strike && !f._vented) { f._vented = true; for (let i = 0; i < 6; i++) c.spray(V(f.pos.x + Math.sin(i) * 1.2, f.pos.y + 0.4, f.pos.z + Math.cos(i) * 1.2), ['#1a1620', '#3b2a4c', '#6a5a7a'], 6, 3, -1); }
      if (!strike) f._vented = false;
      if (stamp > 0.6 && Math.random() < 0.3) c.spray(legs[0].foot.getWorldPosition(V()), ['#1a1620', '#3b2a4c'], 1, 0.8, -1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, '#f8f0dc', '#ff8a5a'));
      // (the face presses closer to the glass as it aims)
      face.children[1].scale.setScalar(1 + aimBack * 0.08);
      g.position.y += f.alt;   // (held up off its feet by the magnet glove)
      rig.write();
    },
    dispose: M.dispose,
  };
}

import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { Pendulum } from '../../motion-kit/machines.js';
import { materials, add, pivot, finish, plate, shellPlate, plateMat, shade, ease, eyeColor } from './kit.js';
import { gazePart } from '../gaze.js';
import { RigidSkin, kitLegs, rolesOf, skinColours, raw } from './tripo-rigid.js';

// The bell walker (issue #800, family D: its approved clean-background redesign, references/enemy-redesign-2026-10-30/
// keep-bell/b4852320-…-1.png, "bell, arch, clapper and four sturdy legs retained"): Tripo task 63c37cb8-… from that image
// (the untouched export in keep-bell/tripo/), made into the game's asset by the trial's prepare.mjs
// (references/enemy-redesign-2026-10-30/trials/bell-tripo/: 3.4 m to the arch's top, 12,000 triangles cut into parts by geometry, Tripo's web
// across the arch dropped, the reference's flat colours sampled into the vertex colours, the weights blended across the
// knees and ankles; public/enemies/bell/, loaded by src/enemies/foe-assets.js). The archetype keeps its id, def, attacks
// and windows; today's spider-legged bell walker (plans/siege.js legacyBellModel) stands in where the mesh is not loaded,
// and can come back as a foe of its own.
//
// A machine's rig (plans/tripo-rigid.js, the crucible walker's): the hull (the machine behind and the pink skirt), the
// bell's dome (it shivers as it tolls), the arch, the spirit and each leg's thigh, shin and foot rigid; the legs the motion
// kit's on the siege plan (one leg at a time, a machine's moves), their knees bending forward. The spirit is the clapper:
// the black ball under the bell's mouth swings on its own pendulum and is the only part that takes harm (def.clapper); its
// slit eyes are its own, and the whole ball turns about its centre to look at you (#508, the author's rule).
//
// Its attacks read from the body (nothing on the ground):
//   toll   it rears back on its rear legs, the front ones lifting, and the clapper swings higher three times; then BONG:
//          the dome shivers and three rings run out over the ground (jump each). The bell-note whistle chokes it
//   drop   its legs straighten and it rises; then it slams down where you stand and sits trembling; then it tips back,
//          its mouth toward you: the clapper in reach (the opening)
// Its armour (#722, #754): three curved plates strapped round the skirt (the winches': round the drum). The Salt Harbour's
// dock winch and the Underside's cable crane wear a drum in the arch where the dome was, its chain down to the spirit and
// a hook under it; the Signal Market's sign automaton its coins on cords and patched pennants hung from the arch.

/** The bell walker's asset parts (its triangles grouped in this order: landmarks.parts) and bones (the same order). */
export const BELL_PARTS = ['hull', 'dome', 'arch', 'spirit', ...[0, 1, 2, 3].flatMap((k) => [`thigh${k}`, `shin${k}`, `foot${k}`])];
/** The reference's flat colours (keep-bell/b4852320-…-1.png, sampled): the home skin's (the Signal Market's). */
export const BELL_HOME = { body: '#728773', dark: '#253e28', bell: '#ddbc9f', arch: '#efd7a0', brass: '#ae8c58', spirit: '#1b2826', eye: '#e8d9b0' };
const BI = Object.fromEntries(BELL_PARTS.map((p, i) => [p, i]));
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

/** The bell walker's body (the model contract of plans/index.js), from its loaded source (src/enemies/foe-assets.js). */
export function tripoBellModel(skin, src) {
  const L = src.rig, home = skin.id === 'bazaar', props = new Set(skin.props), PL = PLANS.siege, winch = props.has('winch');
  const P = { ...skin.palette, ...(home ? { leg: BELL_HOME.body, dark: BELL_HOME.dark, bell: BELL_HOME.bell, yoke: BELL_HOME.arch, joint: BELL_HOME.brass, spirit: BELL_HOME.spirit, eye: BELL_HOME.eye } : {}) };
  const M = materials('bell', skin);
  const g = new THREE.Group(); g.name = `${skin.name} · bell walker (Tripo)`;
  const body = pivot(g, 0, 0, 0, 'body');
  // (the whole of it turns about its middle, PIVOT m up: the toll's rearing back, the opening's tipping, a blow's tip)
  const PIVOT = 1.6, frameTurn = pivot(body, 0, PIVOT, 0, 'frame'), hull = pivot(frameTurn, 0, -PIVOT, 0, 'frame part');
  const S0 = L.spirit, zc = L.bell.axisZ, top = L.bell.skirtTop;
  // ---------------------------------------------------------------- the bones
  const domePivot = pivot(hull, 0, top, zc, 'dome'), domeB = pivot(domePivot, 0, -top, -zc, 'dome part');
  const archB = pivot(hull, 0, 0, 0, 'arch');
  // the spirit: hung from the bell's mouth (its pendulum), turning about its own centre (its look)
  const mouthY = S0.centre[1] + S0.r * 0.95;
  const clapPivot = pivot(hull, S0.centre[0], mouthY, S0.centre[2], 'clapper');
  const spiritC = pivot(clapPivot, 0, S0.centre[1] - mouthY, 0, 'spirit');
  const spiritB = pivot(spiritC, -S0.centre[0], -S0.centre[1], -S0.centre[2], 'spirit part');
  const K = kitLegs({ plan: PL, g, body, hipParent: hull, legs: L.legs, pole: { x: 0, y: 0.1, z: 1 } });
  const bones = [hull, domeB, archB, spiritB, ...K.bones.flatMap((b) => [b.thigh, b.shin, b.foot])];
  // ---------------------------------------------------------------- the skin's colours over the asset's roles
  const want = home ? null : { body: P.leg, dark: P.dark, bell: P.bell, arch: P.yoke, brass: P.joint, spirit: P.spirit };
  const colour = want ? skinColours(src, rolesOf(src), want) : null;
  const S = new RigidSkin(src, colour, (part) => !(winch && part === 'dome'));
  const sw = (key) => L.swatches[key] ?? L.swatches.body, col = (k, hex) => raw(want?.[k] ?? hex ?? L.palette[k]);
  g.updateMatrixWorld(true);
  // (a dark ball inside each knee and ankle: as a joint bends, it fills what opens)
  for (const [name, c] of Object.entries(L.cuts)) { const k = +name.slice(-1), part = name.startsWith('knee') ? `thigh${k}` : `shin${k}`; S.own(new THREE.SphereGeometry(c.inner * 0.85, 10, 7).translate(...c.at), g, BI[part], col('dark'), sw('dark')); }
  // the winches' drum in the arch where the dome was, its flanges, its axle to the arch's feet; its chain to the spirit
  let drum = null, hook = null;
  if (winch) {
    const dy = top + 0.75, dz = zc;
    drum = pivot(hull, 0, dy, dz, 'drum');
    g.updateMatrixWorld(true);
    const bd = bones.length; bones.push(drum);
    S.own(new THREE.CylinderGeometry(0.44, 0.44, 1.0, 22).rotateZ(Math.PI / 2), drum, bd, raw(P.chain ?? P.dark), sw('dark'));
    for (const s of [-1, 1]) S.own(new THREE.CylinderGeometry(0.66, 0.66, 0.08, 24).rotateZ(Math.PI / 2).translate(s * 0.54, 0, 0), drum, bd, raw(P.bell), sw('bell'));
    S.own(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8).rotateZ(Math.PI / 2), drum, bd, raw(P.dark), sw('dark'));
    // the chain from the drum down to the spirit, on the clapper's own bone (it swings with the spirit)
    const bc = bones.length; bones.push(clapPivot);
    const span = dy - 0.44 - mouthY;
    for (let i = 0; i < 6; i++) S.own(new THREE.TorusGeometry(0.07, 0.022, 5, 10).scale(1, 1.4, 1).rotateY((i % 2) * Math.PI / 2).translate(0, (span * (i + 0.5)) / 6, 0), clapPivot, bc, raw(P.chain ?? P.dark), sw('dark'));
    hook = pivot(spiritC, 0, -S0.r - 0.05, 0, 'hook');
    g.updateMatrixWorld(true);
    const bh = bones.length; bones.push(hook);
    S.own(new THREE.TorusGeometry(0.2, 0.055, 6, 16, Math.PI * 1.3).rotateZ(Math.PI * 0.9).translate(0, -0.22, 0), hook, bh, raw(P.drum2 ?? P.bell), sw('bell'));
    S.own(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 8), hook, bh, raw(P.dark), sw('dark'));
  }
  // the Signal Market's coins on cords and its patched pennants, hung from the arch
  const arch = L.arch.curve, side = (s) => arch.filter((p) => Math.sign(p[0]) === s).sort((a, b) => b[1] - a[1]);
  if (props.has('coins')) for (const s of [-1, 1]) for (const [i, p] of side(s).slice(1, 5).entries()) {
    const l = 0.28 + (i % 2) * 0.22;
    S.own(new THREE.CylinderGeometry(0.008, 0.008, l, 3).translate(p[0], p[1] - l / 2, p[2] + 0.12), archB, BI.arch, raw(P.dark), sw('dark'));
    S.own(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 12).rotateX(Math.PI / 2).translate(p[0], p[1] - l - 0.06, p[2] + 0.12), archB, BI.arch, raw(P.coin ?? P.joint), sw('brass'));
  }
  const pennants = [];
  if (props.has('pennants')) {
    const clothM = M.mat('cloth', P.cloth, { side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const at = side(s)[3] ?? side(s)[0], p = pivot(hull, at[0] + s * 0.05, at[1], at[2], 'pennant'), sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(s * 0.42, -0.08); sh.lineTo(s * 0.36, -0.42); sh.lineTo(s * 0.46, -0.88); sh.lineTo(s * 0.16, -0.72); sh.lineTo(0, -0.96); sh.lineTo(0, 0);
      add(p, new THREE.ShapeGeometry(sh).rotateY(Math.PI / 2), clothM);
      pennants.push(p);
    }
  }
  // ---------------------------------------------------------------- the mesh (one draw), the spirit's eyes, the plates
  const bodyM = M.mat('bellwalker', '#ffffff', { side: THREE.DoubleSide, vertexColors: true });
  const sm = S.make(bodyM, bones, 'tripo skin'); g.add(sm);
  const eyeM = M.own('eye', P.eye ?? '#f8f4ff', { glow: 0.9 });
  const centre = new THREE.Vector3(...S0.centre);
  for (const e of S0.eyes ?? []) {
    if (!e) continue;
    const at = new THREE.Vector3(...e), n = at.clone().sub(centre).normalize(), on = centre.clone().addScaledVector(n, S0.r * 1.005);
    const slit = add(spiritB, new THREE.CapsuleGeometry(0.035, 0.1, 3, 10).rotateZ(Math.PI / 2 + Math.sign(e[0]) * 0.25).scale(1, 0.7, 0.35), eyeM, ...on.toArray());
    slit.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); slit.name = 'eye';
  }
  const plateM = plateMat(M, P.plate ?? shade(winch ? P.bell : P.bell, 0.6));
  const plates = [];
  if (!winch) {
    // (high on the skirt: under it the spirit's eyes must show)
    const prof = [[0.94, 1.24], [0.95, 1.36], [0.9, 1.5]];
    for (let k = 0; k < 3; k++) plates.push(plate(hull, shellPlate(prof, -0.95 + k * 0.62, 0.55, { out: 0.02, thick: 0.05, segs: 8 }).translate(0, 0, zc), plateM, 0, 0, 0, `skirt plate ${k}`));
  } else {
    const prof = [[0.44, -0.45], [0.44, 0], [0.44, 0.45]];
    for (let k = 0; k < 3; k++) plates.push(plate(drum, shellPlate(prof, 0, 1.7, { out: 0.02, thick: 0.05, segs: 10 }).rotateZ(Math.PI / 2).rotateX((k / 3) * Math.PI * 2), plateM, 0, 0, 0, `drum plate ${k}`));
  }
  // its look: the spirit's ball turns about its centre toward you (its slit eyes on it)
  const gaze = [gazePart(g, spiritC, { mode: 'turn', yaw: 1.0, up: 0.35, down: 0.3 })];
  finish(g);
  g.updateMatrixWorld(true);
  S.bind();
  const parts = [frameTurn, clapPivot, ...K.bones.flatMap((b) => [b.thigh, b.shin, b.foot])];
  const sway = new Pendulum(PL.swing), clap = new Pendulum(PL.clapper);
  let rear = 0, open = 0, shake = 0, softT = 8 + Math.random() * 14, soft = 0, ring = 0;
  const front = K.legs.map((_, i) => i).filter((i) => K.legs[i].home.z > 0.3);   // (the front legs: they lift as it rears back)
  return {
    group: g, gaze, body: frameTurn, rig: K.rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.bell, P.yoke, P.spirit], clapper: spiritC,
    plates, weak: { obj: spiritC, r: 0.4, name: winch ? 'hook' : 'clapper' }, body3d: 'tripo', bellJoints: { legs: K.legs, legBones: K.bones, spirit: spiritC, clapper: clapPivot, dome: domePivot },
    tell: (id) => (id === 'toll' ? spiritC : frameTurn),
    anim(f, c) {
      if (f.dying) S.letGo();
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      // the toll: reared back on its rear legs, the front ones lifting (held from 75 %)
      rear = ease(rear, id === 'toll' && wind ? c.wind : 0, 6, dt);
      for (const i of front) { K.legs[i].lift = rear * 0.9; K.legs[i].air.set(0, 0.3 * rear, 0.12 * rear); }
      const o = K.rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: (at, len) => { c.touch(at, len); c.thump?.(at, 0.25); }, recovery: c.recovery, air: f.alt > 0.05 ? 1 : 0 });
      // sitting trembling after the drop, then tipped back toward you (the opening: the clapper in reach)
      open = ease(open, f.open > 0 ? 1 : 0, f.open > 0 ? 5 : 2, dt);
      if (strike && id === 'drop' && f.k > 0.9) shake = 1;
      shake = Math.max(0, shake - dt * 1.2);
      const tremble = shake > 0 ? Math.sin(c.now / 22) * 0.03 * shake : 0;
      frameTurn.position.set(o.x + tremble, o.y + PIVOT, o.z);
      frameTurn.rotation.set(o.pitch - open * 0.32, o.yaw, o.roll + tremble);
      // the clapper: a pendulum driven by the body's moves; the toll's three swings, each higher
      frameTurn.getWorldPosition(_v); sway.update(dt, _v, f.heading);
      clapPivot.getWorldPosition(_w); clap.update(dt, _w, f.heading);
      if (id === 'toll' && wind) {
        const k = f.k, amp = 0.25 + 0.85 * Math.min(1, k / 0.75), w = Math.PI * 2 * 3 / Math.max(0.3, f.atk.wind ?? 1.5);
        clap.a = amp * Math.sin(k * Math.PI * 2 * 3); clap.va = amp * Math.cos(k * Math.PI * 2 * 3) * w;
      }
      softT -= dt;
      if (f.state === 'idle' && softT < 0) { soft = 1; softT = 18 + Math.random() * 14; }
      if (soft > 0) { soft = Math.max(0, soft - dt / 3); clap.a = 0.35 * Math.sin((1 - soft) * Math.PI * 6) * soft; }
      clapPivot.rotation.set(-clap.a * 0.8 + sway.a * 0.2 + open * 0.5, 0, clap.b * 0.8);
      // BONG: the dome shivers as the rings go out (the toll's strike), softly as it tolls the hours
      ring = strike && id === 'toll' ? 1 - f.k : Math.max(0, ring - dt * 2);
      domePivot.rotation.set(Math.sin(c.now / 18) * 0.012 * ring + sway.a * 0.05, 0, Math.cos(c.now / 23) * 0.012 * ring + sway.b * 0.05);
      if (drum) drum.rotation.x += dt * (id === 'toll' && wind ? 3 : f.state === 'chase' ? 0.3 : 0);   // (the drum winds as it tolls)
      if (Math.random() < 0.05) c.drip(f, P.spirit);
      pennants.forEach((p, i) => { p.rotation.y = Math.sin(c.now / 600 + i * 2) * 0.25 + sway.b * 0.5; });
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye ?? '#f8f4ff', '#ffb070'));
      g.position.y += f.alt;   // (the drop's lift and fall, or the magnet glove)
      K.rig.write(); K.skinLegs.write(f.heading, { air: f.alt > 0.05 ? 1 : 0 });
    },
    // (its geometries are its kind's, shared: src/foes.js lets its own go, disposeOwnShapes)
    dispose() { M.dispose(); K.hide.dispose(); },
  };
}

import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, tube, rod, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 1, the multi-legged walker (docs/systems/procedural-animation.md §4): the shellback crab
// (docs/design/enemy-roster.md, archetype 1). Low and wide: a domed shell wider than it is tall, two raised
// pincers on jointed arms, six legs splayed out like a table, knees out and up above the rim, an alternating
// tripod on the locomotion kit. It scuttles sideways in bursts and turns to face you to strike.
//
// Its attacks read from the body alone (src/telegraph.js):
//   snap    the near pincer opens wide and draws back past the eye stalks, the back legs planted (the kit's brace)
//   spin    legs pulled under, the shell tilted up at the front and rocking, then a top along the lane
//   burrow  it sinks to its eyes, the stalks swivel to you and the sand trembles at its rim (Salt Harbour, Underwater)
// Guarded, the spin turns it onto its back, legs waving; a bomb cracks its shell for good.
// Skins (src/enemies/skins.js) dress it: lichen, a beetle's antennae, a hermit's awning, barnacles and rope, glass
// facets, coral, a copper patina. Art match pending its sheet (docs/design/enemy-roster-prompts.md, `crab`).

const SHELL_R = 0.8;

export function crabModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('crab', skin.id);
  const g = new THREE.Group(), body = pivot(g, 0, 0.62, 0, 'shell'); g.name = skin.name;
  const shellM = M.mat('shell', P.shell, { color2: P.shell2 }), underM = M.mat('under', P.under), clawM = M.mat('claw', P.claw, { color2: P.shell2 });
  const darkM = M.mat('dark', P.dark, { flat: true }), accentM = M.mat('accent', P.accent, { flat: true });
  const eyeM = M.own('eye', P.eye, { glow: 0.75 });
  const beetle = props.has('antennae'), glass = props.has('facets');
  // the shell: a low dome wider than it is tall (faceted glass in the Glass Dunes; a beetle's long elytra in the Hangar and the Antennas)
  const domeGeo = glass ? new THREE.IcosahedronGeometry(SHELL_R, 1) : new THREE.SphereGeometry(SHELL_R, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const shell = add(body, domeGeo, shellM);
  shell.scale.set(1, glass ? 0.36 : 0.62, beetle ? 1.12 : 0.86);
  if (glass) shell.position.y = 0.04;
  const rim = add(body, new THREE.TorusGeometry(SHELL_R * 0.98, 0.05, 6, 28).rotateX(Math.PI / 2), darkM, 0, 0.01, 0);
  rim.scale.set(1, beetle ? 1.12 : 0.86, 1);
  const belly = add(body, new THREE.SphereGeometry(SHELL_R * 0.94, 16, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), underM);
  belly.scale.set(1, 0.32, beetle ? 1.08 : 0.82);
  // the shell's seams: arcs across the dome (a beetle's centre seam)
  const seams = [];
  if (beetle) seams.push(tube(body, [[0, 0.05, 0.92], [0, 0.42, 0.45], [0, 0.5, 0], [0, 0.42, -0.45], [0, 0.05, -0.92]], 0.014, darkM));
  else for (const k of [-0.45, 0, 0.45]) seams.push(tube(body, Array.from({ length: 7 }, (_, i) => { const a = -1.2 + i * 0.4; return [Math.sin(a) * SHELL_R * 0.96 * Math.cos(k), Math.cos(a) * 0.48 * Math.cos(k * 0.8) + 0.02, Math.sin(k) * 0.66]; }), 0.012, darkM));
  // what is under the shell (a bomb cracks it off: the soft back shows)
  const meat = add(body, new THREE.SphereGeometry(0.6, 12, 6).scale(1, 0.32, 0.78), M.mat('meat', '#e08a70'), 0, 0.06, 0); meat.visible = false;
  const dress = [];   // (what a cracked shell loses)
  if (props.has('lichen')) for (let i = 0; i < 9; i++) { const a = i * 2.39, r = 0.18 + (i % 3) * 0.17; const l = add(body, new THREE.CircleGeometry(0.07 + (i % 2) * 0.04, 7), accentM, Math.sin(a) * r, 0.47 - r * 0.32, Math.cos(a) * r * 0.8); l.lookAt(l.position.clone().multiplyScalar(3).setY(3)); dress.push(l); }
  if (props.has('patina')) for (let i = 0; i < 7; i++) { const a = i * 2.1, r = 0.25 + (i % 3) * 0.15; const l = add(body, new THREE.SphereGeometry(0.11, 6, 4).scale(1, 0.25, 1), accentM, Math.sin(a) * r, 0.5 - r * 0.35, Math.cos(a) * r * 0.9); dress.push(l); }
  if (props.has('barnacles')) for (let i = 0; i < 10; i++) { const a = i * 2.4, r = 0.2 + (i % 4) * 0.13; dress.push(add(body, new THREE.ConeGeometry(0.06, 0.1, 6), accentM, Math.sin(a) * r, 0.48 - r * 0.3, Math.cos(a) * r * 0.8)); }
  if (props.has('rope')) { const ropeM = M.mat('rope', P.rope); dress.push(tube(body, [[-0.78, 0.0, 0.2], [-0.4, 0.42, 0.35], [0.1, 0.5, 0.1], [0.5, 0.36, -0.3], [0.82, 0.0, -0.25], [0.95, -0.25, -0.1]], 0.03, ropeM)); }
  if (props.has('coral')) {
    const coralM = M.mat('coral', P.accent, { flat: true });
    for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.24, z = (i % 2 ? -0.15 : 0.12); const base = [x, 0.42, z];
      dress.push(tube(body, [base, [x * 1.1, 0.68, z], [x * 1.25 + 0.05, 0.85, z - 0.04]], 0.035, coralM, 0.018));
      dress.push(tube(body, [[x * 1.05, 0.6, z], [x * 1.05 + 0.13, 0.74, z + 0.05]], 0.022, coralM, 0.012)); }
  }
  if (props.has('facets')) for (let i = 0; i < 5; i++) { const a = i * 1.26; dress.push(add(body, new THREE.OctahedronGeometry(0.1, 0).scale(1, 1.8, 1), accentM, Math.sin(a) * 0.35, 0.36, Math.cos(a) * 0.28)); }
  let awning = null;
  if (props.has('awning')) {
    // a hermit's awning of patched cloth on four poles, over the shell: a stall on legs
    awning = pivot(body, 0, 0.3, -0.05, 'awning');
    const clothA = M.mat('cloth', P.cloth, { side: THREE.DoubleSide }), clothB = M.mat('cloth2', P.cloth2, { side: THREE.DoubleSide });
    for (const [x, z] of [[-0.55, 0.45], [0.55, 0.45], [-0.55, -0.5], [0.55, -0.5]]) rod(awning, [x, 0, z], [x * 1.05, 0.62, z * 1.05], 0.022, darkM);
    for (let i = 0; i < 4; i++) {
      const roof = add(awning, new THREE.PlaneGeometry(0.34, 1.25), i % 2 ? clothA : clothB, -0.45 + i * 0.3, 0.72, -0.02);
      roof.rotation.set(-Math.PI / 2, 0, 0); roof.rotation.y = 0; roof.rotateX(0); roof.position.y = 0.66 + Math.sin(i * 1.3) * 0.03;
    }
    for (const s of [-1, 1]) { const flap = add(awning, new THREE.PlaneGeometry(1.25, 0.2), s > 0 ? clothB : clothA, 0, 0.56, s * 0.62); flap.rotation.x = s * 0.25; }
    dress.push(awning);
  }
  // eyes on stalks between the pincers (they swivel and sink)
  const stalks = pair((s) => { const st = pivot(body, s * 0.16, 0.3, SHELL_R * 0.72); rod(st, [0, 0, 0], [0, 0.32, 0.03], 0.026, darkM); add(st, new THREE.SphereGeometry(0.065, 10, 8), eyeM, 0, 0.34, 0.04); return st; });
  if (beetle) for (const s of [-1, 1]) tube(body, [[s * 0.12, 0.2, 0.9], [s * 0.3, 0.55, 1.25], [s * 0.55, 0.75, 1.45], [s * 0.75, 0.72, 1.6]], 0.014, darkM);
  // the pincers: a shoulder at the front rim, an upper arm raised up and out, a forearm, and a claw of two fingers
  // (the right one bigger). Each joint is its own pivot, so the snap can open and draw back.
  const claws = pair((s) => {
    const big = s > 0 ? 1.15 : 0.9;
    const shoulder = pivot(body, s * 0.5, 0.05, SHELL_R * 0.6, 'shoulder');
    add(shoulder, new THREE.SphereGeometry(0.08, 8, 6), clawM);
    rod(shoulder, [0, 0, 0], [s * 0.22, 0.32, 0.18], 0.06, clawM, 0.05);
    const elbow = pivot(shoulder, s * 0.22, 0.32, 0.18, 'elbow');
    add(elbow, new THREE.SphereGeometry(0.07, 8, 6), clawM);
    rod(elbow, [0, 0, 0], [s * 0.05, 0.12, 0.32], 0.055, clawM, 0.07);
    const hand = pivot(elbow, s * 0.05, 0.12, 0.34, 'claw');
    add(hand, new THREE.SphereGeometry(0.16 * big, 10, 8).scale(0.8, 0.7, 1.25), clawM, 0, 0, 0.06);
    const upper = pivot(hand, 0, 0.05, 0.16), lower = pivot(hand, 0, -0.05, 0.16);
    add(upper, new THREE.ConeGeometry(0.075 * big, 0.36 * big, 6).rotateX(Math.PI / 2).translate(0, 0, 0.16 * big), clawM);
    add(lower, new THREE.ConeGeometry(0.06 * big, 0.3 * big, 6).rotateX(Math.PI / 2).translate(0, 0, 0.13 * big), darkM);
    const tip = pivot(hand, 0, 0, 0.42 * big);
    return { shoulder, elbow, hand, upper, lower, tip };
  });
  // six jointed legs on the kit (plan 1): a thigh up and out to a high knee, a shin down to a pointed foot, splayed
  // out like a table; an alternating tripod, the shell riding on the feet
  const legs = [];
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const z = 0.32 - k * 0.34;
    legs.push(planLeg(PLANS.walker, { group: g, body, hip: { x: s * 0.66, y: -0.04, z }, foot: { x: s * 1.42, z: z * 1.5 + 0.04 }, radius: 0.042, pad: 'point', mats: { joint: clawM, thigh: clawM, shin: darkM, foot: darkM }, name: `crab leg ${legs.length}` }));
  }
  const rig = new Rig({ plan: PLANS.walker, group: g, body, legs });
  const shellTop = pivot(body, 0, 0.55, 0);   // (the spin's glow rides on the shell)
  finish(g);
  const parts = [shell, rim, belly, ...seams, ...stalks, ...claws.map((c) => c.shoulder), ...dress, ...legs.map((l) => l.root)];
  let side = 0, sink = 0, spin = 0, flip = 0;
  return {
    group: g, body, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.shell, P.under, P.claw],
    tell: (id) => (id === 'snap' ? claws[1].tip : id === 'burrow' ? stalks[0].children[1] : shellTop),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      const flipped = f.flipped > 0;
      const tuck = id === 'spin' ? (wind ? c.wind : strike ? 1 : 0) : 0;
      // sideways: while it scuttles at you it travels side-on, its shell turned a quarter; to strike it turns to face you
      const scuttle = c.moving && f.state === 'chase' && f.dist > 3 ? 1 : 0;
      side = ease(side, scuttle * (f.home.x > 0 ? 1 : -1) * Math.PI / 2, 7, dt);
      g.rotation.y = f.heading + side;
      // the burrow: it sinks into the sand to its eyes through the wind-up, then comes up where it surfaced
      const buried = id === 'burrow' && wind ? c.wind : 0;
      sink = ease(sink, buried, buried > sink ? 6 : 10, dt);
      const o = rig.update({ pos: f.pos, heading: f.heading + side, state: f.state, k: f.k, atk: f.atk, stunned: f.stunned }, dt,
        { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery, air: flipped ? 1 : tuck > 0.02 ? 1 + tuck : sink > 0.05 ? 1 + sink * 0.6 : 0 });
      legs.forEach((l, k) => { l.air.set(0, flipped ? Math.sin(c.now / 60 + k) * 0.2 : 0, flipped ? Math.cos(c.now / 75 + k) * 0.14 : 0); });
      // the snap: the near (right) pincer raised, its fingers wide, drawn back past the stalks; then through
      const snap = id === 'snap' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0;
      claws.forEach((cl, i) => {
        const near = i === 1 ? snap : snap * 0.3;
        cl.shoulder.rotation.set(-near * 0.5 + tuck * 0.9, (i ? -1 : 1) * (near * 0.7 - tuck * 0.6), 0);
        cl.elbow.rotation.x = -near * 0.9 + (strike && id === 'snap' && i === 1 ? 0.6 * c.release : 0);
        const open = near * 0.75 + (f.state === 'idle' ? Math.max(0, Math.sin(c.now / 400 + i * 2)) * 0.25 : 0);
        cl.upper.rotation.x = -open; cl.lower.rotation.x = open * 0.6;
        cl.shoulder.scale.setScalar(1 - tuck * 0.45);
      });
      // the eye stalks: sink with the tuck; swivel to you as it burrows
      stalks.forEach((st, i) => { st.scale.y = Math.max(0.2, 1 - tuck * 0.8); st.rotation.z = (i ? -1 : 1) * buried * 0.5; st.rotation.x = -buried * 0.4 + (f.state === 'chase' ? Math.sin(c.now / 300 + i) * 0.08 : 0); });
      // the spin: tucked into its shell, rocking back and forth, then turning faster and faster as a top
      const rock = id === 'spin' && wind ? Math.sin(c.now / 70) * 0.08 * c.wind : 0;
      spin += dt * (strike && id === 'spin' ? 26 : tuck > 0 ? tuck * 4 : 0);
      flip = ease(flip, flipped ? Math.PI : 0, 12, dt);
      body.position.set(o.x, 0.62 - tuck * 0.22 - sink * 0.5 + o.y, o.z);
      body.rotation.set(o.pitch - (id === 'spin' && wind ? 0.32 * c.wind : 0) + rock, tuck > 0.5 && strike ? spin : o.yaw, flip + o.roll);
      if (awning) awning.rotation.z = Math.sin(c.now / 260) * 0.03 * (c.moving ? 1 : 0.3);
      rig.write();
      // cracked: the dress and the shell's dome come off, the soft back shows
      for (const x of dress) x.visible = f.shelled;
      meat.visible = !f.shelled;
      shell.visible = f.shelled; seams.forEach((x) => { x.visible = f.shelled; });
      if ((tuck > 0.5 && strike) || (buried > 0.3 && Math.random() < 0.5)) c.dust(f.pos, P.under, 2);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
    },
    dispose: M.dispose,
  };
}

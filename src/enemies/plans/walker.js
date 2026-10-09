import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, tube, rod, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 1, the multi-legged walker (docs/systems/procedural-animation.md §4): the shellback crab
// (docs/design/enemy-roster.md, archetype 1), drawn to its sheets (references/enemy-archetypes/crab/: sheet-1 the
// Vael II cliff crab, sheet-2 the Salt Harbour's anchor crab). A deep domed shell wider than it is tall, its sides
// falling steeply to a lip over an ivory belly of plates; six thick jointed legs coming out from under the lip,
// knees out at the rim and hooked dark tips, splayed like a table; two tall arms rising from the shell's shoulders
// to big upright pincers (the right one bigger) above it; two black eyes on thin stalks between them. From afar a
// black lump with two hooks on top. An alternating tripod on the locomotion kit; it scuttles sideways in bursts and
// turns to face you to strike.
//
// Its attacks read from the body alone (src/telegraph.js):
//   snap    the near pincer opens wide and draws back past the eye stalks, the back legs planted (the kit's brace)
//   spin    legs pulled under, the shell tilted up at the front and rocking, then a top along the lane
//   burrow  it sinks to its eyes, the stalks swivel to you and the sand trembles at its rim (Salt Harbour, Underwater)
// Guarded, the spin turns it onto its back, legs waving; a bomb cracks its shell for good.
// Skins (src/enemies/skins.js) dress it: lichen stars, a beetle's antennae, a hermit's awning, barnacles with a rope
// and an anchor caught on its back, glass facets, coral, a copper patina.

const SHELL_R = 0.8, SHELL_H = 0.54, DEEP = 0.92;
/** The dome's height over the rim at a share ρ of its radius (steep sides, a rounded top: the sheet's profile). */
const domeY = (rho) => SHELL_H * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, rho), 2.6)), 0.5);
/** A lathe profile of the dome: rim to crown. */
const DOME = Array.from({ length: 15 }, (_, i) => { const r = SHELL_R * (1 - i / 14); return new THREE.Vector2(Math.max(0.001, r), domeY(r / SHELL_R)); });
/** The belly: a bowl of ivory plates under the lip. */
const BELLY = [[0.96, 0], [0.93, -0.08], [0.84, -0.17], [0.66, -0.24], [0.36, -0.28], [0.001, -0.29]].reverse().map(([r, y]) => new THREE.Vector2(r * SHELL_R, y));   // (bottom up: faces out)
/** A six-pointed fleck of lichen (the sheet's pale stars). */
const STAR = (() => { const s = new THREE.Shape(); for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2, r = i % 2 ? 0.4 : 1; s[i ? 'lineTo' : 'moveTo'](Math.sin(a) * r, Math.cos(a) * r); } return s; })();

export function crabModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('crab', skin.id);
  const g = new THREE.Group(), body = pivot(g, 0, 0.6, 0, 'shell'); g.name = skin.name;
  const shellM = M.mat('shell', P.shell, { color2: P.shell2 }), underM = M.mat('under', P.under), clawM = M.mat('claw', P.claw, { color2: P.leg });
  const legM = M.mat('leg', P.leg), jointM = M.mat('joint', P.joint), armM = P.arm ? M.mat('arm', P.arm) : legM, tipM = P.tip ? M.mat('tip', P.tip) : null;
  const darkM = M.mat('dark', P.dark, { flat: true }), accentM = M.mat('accent', P.accent, { flat: true });
  const eyeM = M.own('eye', P.eye, { glow: 0.5 });
  const beetle = props.has('antennae'), glass = props.has('facets');
  const deep = beetle ? 1.12 : DEEP;
  // a point on the shell (x, z in the body's frame) and its outward normal: where the dress sits
  const onShell = (x, z) => { const rho = Math.hypot(x / SHELL_R, z / (SHELL_R * deep)); return V(x, domeY(rho), z); };
  const sit = (m, x, z, lift = 0) => { const p = onShell(x, z); m.position.set(x, p.y + lift, z); const n = V(x / SHELL_R, Math.max(0.35, p.y / SHELL_H) * 1.2, z / (SHELL_R * deep)).normalize(); m.quaternion.setFromUnitVectors(V(0, 0, 1), n); return m; };
  // the shell: a deep dome, steep at the sides (faceted glass in the Glass Dunes; a beetle's long elytra in the Hangar and the Antennas)
  const domeGeo = glass ? new THREE.IcosahedronGeometry(SHELL_R, 1).scale(1, SHELL_H / SHELL_R * 0.8, 1) : new THREE.LatheGeometry(DOME, 26);
  const shell = add(body, domeGeo, shellM);
  shell.scale.set(1, 1, deep);
  if (glass) shell.position.y = 0.02;
  // the lip: the shell's edge standing proud over the legs
  const rim = add(body, new THREE.TorusGeometry(SHELL_R * 0.99, 0.03, 6, 30).rotateX(Math.PI / 2), shellM, 0, 0.0, 0);
  rim.scale.set(1, deep, 1);
  const belly = add(body, new THREE.LatheGeometry(BELLY, 22), underM);
  belly.scale.set(1, 1, deep);
  // the belly's plates: seams round it under the lip
  for (const [r, y] of [[0.9, -0.1], [0.74, -0.2]]) { const s = add(body, new THREE.TorusGeometry(SHELL_R * r, 0.012, 4, 26).rotateX(Math.PI / 2), darkM, 0, y, 0); s.scale.set(1, deep, 1); }
  // the shell's seams: a ridge down its middle and an arc each side
  const seams = [];
  const arc = (x0) => Array.from({ length: 9 }, (_, i) => { const z = SHELL_R * deep * (-0.94 + i * 0.235), x = x0 * Math.sqrt(Math.max(0, 1 - (z / (SHELL_R * deep)) ** 2)); const p = onShell(x, z); return [x, p.y + 0.006, z]; });
  seams.push(tube(body, arc(0), beetle ? 0.014 : 0.009, darkM));
  // what is under the shell (a bomb cracks it off: the soft back shows)
  const meat = add(body, new THREE.SphereGeometry(0.6, 12, 6).scale(1, 0.32, 0.78), M.mat('meat', '#e08a70'), 0, 0.06, 0); meat.visible = false;
  const dress = [];   // (what a cracked shell loses)
  if (props.has('lichen')) {
    const starGeo = new THREE.ShapeGeometry(STAR);
    for (let i = 0; i < 26; i++) { const a = i * 2.39996, r = SHELL_R * 0.92 * Math.sqrt((i + 0.5) / 26); const s = sit(add(body, starGeo, accentM), Math.sin(a) * r, Math.cos(a) * r * deep, 0.008); s.scale.setScalar(0.07 + (i % 3) * 0.02); s.rotateZ(i); dress.push(s); }
  }
  if (props.has('patina')) for (let i = 0; i < 7; i++) { const a = i * 2.1, r = 0.25 + (i % 3) * 0.15; dress.push(sit(add(body, new THREE.SphereGeometry(0.11, 6, 4).scale(1, 1, 0.25), accentM), Math.sin(a) * r, Math.cos(a) * r * 0.9)); }
  if (props.has('barnacles')) {
    // crusts of barnacles in patches over the shell (the anchor crab's cream rosettes)
    const cone = new THREE.CylinderGeometry(0.03, 0.055, 0.05, 7).rotateX(Math.PI / 2).translate(0, 0, 0.03);
    for (let i = 0; i < 13; i++) { const a = i * 2.4 + 0.3, r = SHELL_R * (0.2 + (i % 5) * 0.15);
      for (let k = 0; k < 6; k++) { const b = a + (k % 3) * 0.13, rr = r + (k > 2 ? 0.08 : 0); const m = sit(add(body, cone, accentM), Math.sin(b) * rr, Math.cos(b) * rr * deep); m.scale.setScalar(0.8 + ((i + k) % 3) * 0.25); dress.push(m); } }
  }
  if (props.has('rope')) {
    // an old rope tangled over its back, and a small iron anchor caught in it, hanging off its right side
    const ropeM = M.mat('rope', P.rope);
    dress.push(tube(body, [[-0.3, onShell(-0.3, 0.55).y, 0.55], [0.05, onShell(0.05, 0.3).y + 0.02, 0.3], [0.35, onShell(0.35, 0.05).y + 0.03, 0.05], [0.62, onShell(0.62, -0.2).y + 0.02, -0.2], [0.8, 0.02, -0.3]], 0.026, ropeM));
    const coil = add(body, new THREE.TorusKnotGeometry(0.15, 0.026, 56, 6, 2, 5), ropeM, 0.4, onShell(0.4, -0.05).y + 0.06, -0.05); coil.rotation.set(-1.2, 0, 0.5); dress.push(coil);
    const anchor = pivot(body, 0.86, 0.05, -0.32, 'anchor'); anchor.rotation.set(0.15, 0.4, -0.35);
    const ironM = M.mat('iron', P.iron ?? P.dark);
    add(anchor, new THREE.TorusGeometry(0.035, 0.012, 5, 10), ironM, 0, 0.02, 0);
    rod(anchor, [0, -0.01, 0], [0, -0.36, 0], 0.018, ironM);
    rod(anchor, [-0.08, -0.07, 0], [0.08, -0.07, 0], 0.014, ironM);
    add(anchor, new THREE.TorusGeometry(0.11, 0.016, 5, 12, Math.PI).rotateZ(Math.PI), ironM, 0, -0.26, 0);
    pair((s) => add(anchor, new THREE.ConeGeometry(0.03, 0.07, 4).rotateZ(s * 0.6), ironM, s * 0.11, -0.25, 0));
    dress.push(anchor);
  }
  if (props.has('coral')) {
    const coralM = M.mat('coral', P.accent, { flat: true });
    for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.24, z = (i % 2 ? -0.15 : 0.12), y = onShell(x, z).y - 0.02; const base = [x, y, z];
      dress.push(tube(body, [base, [x * 1.1, y + 0.26, z], [x * 1.25 + 0.05, y + 0.43, z - 0.04]], 0.035, coralM, 0.018));
      dress.push(tube(body, [[x * 1.05, y + 0.18, z], [x * 1.05 + 0.13, y + 0.32, z + 0.05]], 0.022, coralM, 0.012)); }
  }
  if (props.has('facets')) for (let i = 0; i < 5; i++) { const a = i * 1.26, x = Math.sin(a) * 0.35, z = Math.cos(a) * 0.28; dress.push(add(body, new THREE.OctahedronGeometry(0.1, 0).scale(1, 1.8, 1), accentM, x, onShell(x, z).y * 0.8, z)); }
  let awning = null;
  if (props.has('awning')) {
    // a hermit's awning of patched cloth on four poles, over the shell: a stall on legs
    awning = pivot(body, 0, 0.36, -0.05, 'awning');
    const clothA = M.mat('cloth', P.cloth, { side: THREE.DoubleSide }), clothB = M.mat('cloth2', P.cloth2, { side: THREE.DoubleSide });
    for (const [x, z] of [[-0.55, 0.45], [0.55, 0.45], [-0.55, -0.5], [0.55, -0.5]]) rod(awning, [x, -0.1, z], [x * 1.05, 0.62, z * 1.05], 0.022, darkM);
    for (let i = 0; i < 4; i++) {
      const roof = add(awning, new THREE.PlaneGeometry(0.34, 1.25), i % 2 ? clothA : clothB, -0.45 + i * 0.3, 0.66 + Math.sin(i * 1.3) * 0.03, -0.02);
      roof.rotation.set(-Math.PI / 2, 0, 0);
    }
    for (const s of [-1, 1]) { const flap = add(awning, new THREE.PlaneGeometry(1.25, 0.2), s > 0 ? clothB : clothA, 0, 0.56, s * 0.62); flap.rotation.x = s * 0.25; }
    dress.push(awning);
  }
  // two black eyes on thin stalks, rising from the shell's front between the arms (they swivel and sink)
  const stalkAt = (s) => { const x = s * 0.12, z = SHELL_R * deep * 0.62; return [x, onShell(x, z).y - 0.03, z]; };
  const stalks = pair((s) => { const st = pivot(body, ...stalkAt(s)); rod(st, [0, 0, 0], [0, 0.3, 0.02], 0.022, legM, 0.016); add(st, new THREE.SphereGeometry(0.062, 10, 8), eyeM, 0, 0.34, 0.02); add(st, new THREE.SphereGeometry(0.03, 6, 4), legM, 0, 0.29, 0.02); return st; });
  if (beetle) for (const s of [-1, 1]) tube(body, [[s * 0.12, 0.2, 0.9], [s * 0.3, 0.55, 1.25], [s * 0.55, 0.75, 1.45], [s * 0.75, 0.72, 1.6]], 0.014, darkM);
  // the arms: a shoulder on the shell's upper flank, an upper arm out and up to the elbow, a forearm up to the wrist,
  // and an upright pincer over the shell: a fat hand and two fingers whose tips take the claw's colour, the opening
  // turned in and forward (the right one bigger). Each joint is its own pivot, so the snap can open and draw back.
  const claws = pair((s) => {
    const big = s > 0 ? 1.15 : 0.9;
    const sx = s * 0.56, sz = SHELL_R * deep * 0.42;
    const shoulder = pivot(body, sx, onShell(sx, sz).y - 0.04, sz, 'shoulder');
    add(shoulder, new THREE.SphereGeometry(0.075, 8, 6), jointM);
    rod(shoulder, [0, 0, 0], [s * 0.26, 0.17, 0.05], 0.065, armM, 0.056);
    const elbow = pivot(shoulder, s * 0.26, 0.17, 0.05, 'elbow');
    add(elbow, new THREE.SphereGeometry(0.07, 8, 6), jointM);
    rod(elbow, [0, 0, 0], [-s * 0.03, 0.3, 0.02], 0.056, armM, 0.066);
    const wrist = pivot(elbow, -s * 0.03, 0.3, 0.02, 'wrist');
    add(wrist, new THREE.SphereGeometry(0.068, 8, 6), jointM);
    wrist.rotation.set(-Math.PI / 2 + 0.12, 0, -s * 0.6);   // (the hand upright, its opening in and forward)
    const hand = pivot(wrist, 0, 0, 0, 'claw');
    add(hand, new THREE.SphereGeometry(1, 14, 10).scale(0.2 * big, 0.14 * big, 0.26 * big), legM, 0, 0, 0.19 * big);
    const upper = pivot(hand, 0, 0.045 * big, 0.36 * big), lower = pivot(hand, 0, -0.06 * big, 0.33 * big);
    // the fixed finger carries on from the hand; the moving one is hinged below it, both curving to meet
    tube(upper, [[0, 0, 0], [0, -0.005, 0.18 * big], [0, -0.07 * big, 0.38 * big]], 0.1 * big, clawM, 0.016);
    tube(lower, [[0, 0, 0], [0, 0.012, 0.15 * big], [0, 0.08 * big, 0.32 * big]], 0.08 * big, clawM, 0.014);
    const tip = pivot(hand, 0, 0, 0.66 * big);
    return { shoulder, elbow, hand, upper, lower, tip };
  });
  // six thick jointed legs on the kit (plan 1), coming out from under the lip: a thigh out to a knee at the rim, a
  // shin down to a hooked dark tip, splayed out like a table; an alternating tripod, the shell riding on the feet
  const legs = [];
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const z = (0.34 - k * 0.34) * deep;
    const leg = planLeg(PLANS.walker, { group: g, body, hip: { x: s * 0.52, y: -0.16, z }, foot: { x: s * 1.24, z: z * 2.1 + 0.04 }, pole: { x: s * 1.6, y: 0.7, z: z * 0.8 }, radius: 0.076, pad: 'point', mats: { joint: jointM, thigh: legM, shin: legM, foot: tipM ?? darkM }, name: `crab leg ${legs.length}` });
    // (the hooked tip: a dark claw curling in under the shin's end)
    tube(leg.foot, [[0, 0.12, 0], [s * 0.025, 0.05, 0], [-s * 0.015, 0.0, 0]], 0.03, tipM ?? darkM, 0.006);
    legs.push(leg);
  }
  const rig = new Rig({ plan: PLANS.walker, group: g, body, legs });
  const shellTop = pivot(body, 0, SHELL_H + 0.05, 0);   // (the spin's glow rides on the shell)
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
      // the snap: the near (right) pincer opens wide and draws back past the stalks; then through
      const snap = id === 'snap' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0;
      claws.forEach((cl, i) => {
        const near = i === 1 ? snap : snap * 0.3, s = i ? 1 : -1;
        // (tucked for the spin: the arms fold down onto the shell, the pincers pulled in over the eyes)
        cl.shoulder.rotation.set(-near * 0.45 + tuck * 0.5, 0, s * (tuck * 0.9 - near * 0.15));
        cl.elbow.rotation.set(-near * 0.7 + (strike && id === 'snap' && i === 1 ? 0.9 * c.release : 0) + tuck * 0.6, 0, -s * tuck * 0.5);
        const open = near * 0.8 + (f.state === 'idle' ? Math.max(0, Math.sin(c.now / 400 + i * 2)) * 0.25 : 0);
        cl.upper.rotation.x = -open * 0.4; cl.lower.rotation.x = 0.3 + open;   // (a little open at rest, as drawn)
        cl.shoulder.scale.setScalar(1 - tuck * 0.3);
      });
      // the eye stalks: sink with the tuck; swivel to you as it burrows
      stalks.forEach((st, i) => { st.scale.y = Math.max(0.2, 1 - tuck * 0.8); st.rotation.z = (i ? -1 : 1) * buried * 0.5; st.rotation.x = -buried * 0.4 + (f.state === 'chase' ? Math.sin(c.now / 300 + i) * 0.08 : 0); });
      // the spin: tucked into its shell, rocking back and forth, then turning faster and faster as a top
      const rock = id === 'spin' && wind ? Math.sin(c.now / 70) * 0.08 * c.wind : 0;
      spin += dt * (strike && id === 'spin' ? 26 : tuck > 0 ? tuck * 4 : 0);
      flip = ease(flip, flipped ? Math.PI : 0, 12, dt);
      body.position.set(o.x, 0.6 - tuck * 0.22 - sink * 0.5 + o.y, o.z);
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

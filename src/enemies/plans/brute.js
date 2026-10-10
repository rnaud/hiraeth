import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, tubeGeometry, many, skinBy, pivot, pair, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 8, the giant slow brute (docs/systems/procedural-animation.md §4): the furnace brute (docs/design/enemy-roster.md,
// archetype 17), drawn to its sheets (references/enemy-archetypes/brute/: sheet-1 Lorn II's wood cutter, sheet-2 the
// Glass Dunes' furnace walker). A wardrobe with fists, 4.2 m: a huge headless egg of a torso, taller than wide, the
// traveller reaching its hip; a brass collar on its crown and a brass belt round its middle with a round boss in front;
// great ball shoulders; two massive arms long enough to reach the ground (an upper arm and a thicker forearm, each
// banded in brass) ending in big three-fingered fists; short thick legs with brass knee pads, the knee bending forward,
// and broad flat elephant feet with toes.
//
// The possession: ink in the cracks. The hull is cracked all over like a dropped jar (src/foe-surface.js `cracks`: a fine
// net of seams, and a wider net of veins glowing violet), tar hangs in drips from every seam and edge and runs down its
// limbs; as it is hurt the veins widen and burn brighter (Foe hp: its own body material's `open`). Its fingers twitch
// while it waits.
//
// It walks on the kit's `brute` plan: a slow heavy step, the body dipping deep at each footfall on soft springs, its
// hips over the standing foot, an overshoot when it stops; each footfall shakes the camera and the pad near it
// (Foes.animKit thump). Its arms swing against its legs. Draws: the hull and every limb are one skinned mesh in each of
// its materials (kit.js skinBy: the kit's joints move them), so a brute is about seven draws.
//
// Its attacks read from the body (src/telegraph.js; only the hurled slab marks the ground):
//   slam   both fists rise high over the top of its body, the torso arching back and the veins blazing; then down onto
//          the ground before it, and a quake runs out (jump it); a perfect parry chips it (a crack bursts)
//   hurl   it bends over and tears a slab out of the ground, straightens with it held high over its shoulder, and
//          throws it (the landing mark)
//   sweep  one arm swings back behind it, the shoulder turning; then a backhand across its front
// Calm (`stand`): rusted mid-task where it stopped working, slumped, its tool in its hand; it wakes as you come close,
// lifting its arms with a groan. Skins (src/enemies/skins.js): roots, moss and a saw blade (Lorn II), shears for hands
// (Viridel), glass plates and a furnace door (the Glass Dunes), a turbine in its chest, dripping (the Waterfall), a ladle
// and soot (the Moon Foundry).

const HIP_Y = 1.32, SH = { x: 1.34, y: 3.12 }, UPPER = 1.24, FORE = 1.02;   // (the shoulders' tops well under the collar, as drawn)
/** The torso's profile (r, y): a headless egg, roundest a little above its middle, narrowing to the crotch and the collar. */
const EGG = [[0.001, 1.36], [0.5, 1.42], [0.82, 1.58], [1.02, 1.85], [1.14, 2.2], [1.19, 2.58], [1.15, 2.95], [1.03, 3.28], [0.82, 3.58], [0.55, 3.82], [0.44, 3.9], [0.001, 3.93]].map(([r, y]) => new THREE.Vector2(r, y));
const DEPTH = 0.84;   // (the egg's depth to its width: the sheet's side view)
const radiusAt = (y) => { for (let i = 1; i < EGG.length; i++) if (EGG[i].y >= y) { const a = EGG[i - 1], b = EGG[i]; return lerp(a.x, b.x, (y - a.y) / Math.max(1e-6, b.y - a.y)); } return 0.001; };
const _v = new THREE.Vector3();

export function bruteModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('brute', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  const hull = pivot(body, 0, 0, 0, 'hull');
  // the materials it is built with; the skinned meshes wear `body`, `brass` and `tar` (own: the veins open as it is hurt)
  const hullB = M.mat('hullBuild', P.body), jointB = M.mat('jointBuild', P.joint ?? P.body), brassB = M.mat('brassBuild', P.brass), tarB = M.mat('tarBuild', P.tar);
  const bodyM = M.own('body', P.body, { color2: P.body2, vertexColors: true, flat: false, hatch: 0.45, patches: 0 });   // (its own: the veins open as it is hurt)
  const brassM = M.mat('brass', P.brass, { metal: 'brass', color: P.brass, vertexColors: true });
  const tarM = M.mat('tar', P.tar, { vertexColors: true, flat: false });
  const coreM = M.own('core', P.core, { glow: 0.55 });
  // the torso: the egg, its brass belt with the boss in front, the collar on its crown, sockets at the shoulders
  const torso = add(hull, new THREE.LatheGeometry(EGG, 30), hullB); torso.scale.z = DEPTH;
  const R = radiusAt(2.12) + 0.02;
  const belt = [new THREE.CylinderGeometry(R + 0.02, R + 0.03, 0.2, 30, 1, true).scale(1, 1, DEPTH).translate(0, 2.12, 0),
    new THREE.TorusGeometry(R + 0.03, 0.05, 6, 30).rotateX(Math.PI / 2).scale(1, 1, DEPTH).translate(0, 2.23, 0),
    new THREE.TorusGeometry(R + 0.03, 0.05, 6, 30).rotateX(Math.PI / 2).scale(1, 1, DEPTH).translate(0, 2.01, 0)];
  const front = R * DEPTH + 0.04;
  belt.push(new THREE.CylinderGeometry(0.34, 0.36, 0.12, 20).rotateX(Math.PI / 2).translate(0, 2.12, front), new THREE.TorusGeometry(0.25, 0.04, 6, 20).translate(0, 2.12, front + 0.07));
  // (rivets round the belt)
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; belt.push(new THREE.SphereGeometry(0.035, 5, 4).translate(Math.sin(a) * (R + 0.05), 2.12, Math.cos(a) * (R + 0.05) * DEPTH)); }
  belt.push(new THREE.TorusGeometry(0.5, 0.08, 8, 24).rotateX(Math.PI / 2).translate(0, 3.84, 0), new THREE.CylinderGeometry(0.4, 0.46, 0.12, 22).translate(0, 3.92, 0),
    new THREE.CylinderGeometry(0.18, 0.22, 0.12, 14).translate(0, 4.02, 0));
  for (const s of [-1, 1]) belt.push(new THREE.TorusGeometry(0.42, 0.07, 8, 22).rotateY(Math.PI / 2).translate(s * (SH.x - 0.32), SH.y, 0));
  many(hull, belt, brassB);
  // the boss's heart (the furnace walker's door, glowing; the wood cutter's a brass eye that warms as it winds up)
  const core = add(hull, new THREE.CircleGeometry(props.has('door') ? 0.22 : 0.14, 18), coreM, 0, 2.12, front + 0.065);
  const gem = add(hull, new THREE.SphereGeometry(0.08, 8, 6), coreM, 0, 4.08, 0.06);
  // tar: drips hanging from the belt, the crotch, the collar and the shoulder sockets (the sheet's icicles of ink)
  const drips = [];
  const drip = (x, y, z, l, r = 0.035) => drips.push(new THREE.ConeGeometry(r, l, 5).rotateX(Math.PI).translate(x, y - l / 2, z), new THREE.SphereGeometry(r * 1.15, 5, 4).translate(x, y - l + r * 0.4, z));
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.07; drip(Math.sin(a) * (R + 0.04), 2.0, Math.cos(a) * (R + 0.04) * DEPTH, 0.18 + ((i * 7) % 5) * 0.09, 0.05); }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; drip(Math.sin(a) * 0.72, 1.56, Math.cos(a) * 0.72 * DEPTH, 0.2 + ((i * 3) % 4) * 0.1, 0.06); }
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; drip(Math.sin(a) * 0.52, 3.8, Math.cos(a) * 0.52, 0.1 + (i % 3) * 0.05); }
  many(hull, drips, tarB);
  // the arms: a ball shoulder, an upper arm and an elbow, a thicker forearm, a wrist band and a big fist of three fingers
  // and a thumb; brass bands round each; tar running down from the bands
  const arms = pair((s) => {
    const sh = pivot(hull, s * SH.x, SH.y, 0, 'shoulder');
    add(sh, new THREE.SphereGeometry(0.52, 18, 14), hullB);
    add(sh, new THREE.CylinderGeometry(0.31, 0.29, UPPER, 14).translate(0, -UPPER / 2 - 0.1, 0), hullB);
    many(sh, [0.55, 1.1].map((y) => new THREE.TorusGeometry(0.31, 0.05, 6, 18).rotateX(Math.PI / 2).translate(0, -y, 0)), brassB);
    many(sh, [0, 1, 2, 3, 4].map((k) => { const a = (k / 5) * Math.PI * 2 + s, l = 0.14 + (k % 3) * 0.07; return new THREE.ConeGeometry(0.03, l, 5).rotateX(Math.PI).translate(Math.sin(a) * 0.33, -1.13 - l / 2, Math.cos(a) * 0.33); }), tarB);
    const el = pivot(sh, 0, -UPPER - 0.12, 0.02, 'elbow');
    add(el, new THREE.SphereGeometry(0.35, 14, 10), jointB);
    add(el, new THREE.CylinderGeometry(0.42, 0.36, FORE, 14).translate(0, -FORE / 2 - 0.08, 0), hullB);
    many(el, [new THREE.TorusGeometry(0.4, 0.06, 6, 18).rotateX(Math.PI / 2).translate(0, -0.3, 0), new THREE.CylinderGeometry(0.45, 0.45, 0.16, 18, 1, true).translate(0, -FORE + 0.02, 0)], brassB);
    many(el, [0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2, l = 0.12 + (k % 3) * 0.08; return new THREE.ConeGeometry(0.035, l, 5).rotateX(Math.PI).translate(Math.sin(a) * 0.45, -FORE - 0.06 - l / 2, Math.cos(a) * 0.45); }), tarB);
    const fist = pivot(el, 0, -FORE - 0.12, 0.04, 'fist');
    add(fist, new THREE.SphereGeometry(1, 16, 12).scale(0.4, 0.36, 0.38), hullB, 0, -0.22, 0.02);
    // (three fingers curled forward and down, a thumb on the inside: each finger three plated segments, as a
    // gauntlet's (the sheet's), a little gap between them, curling further at each joint)
    const fingers = [];
    for (let k = 0; k < 3; k++) {
      const x = (k - 1) * 0.24;
      fingers.push(new THREE.BoxGeometry(0.21, 0.17, 0.23).translate(x, -0.44, 0.22),
        new THREE.BoxGeometry(0.2, 0.15, 0.21).rotateX(0.45).translate(x, -0.6, 0.2),
        new THREE.BoxGeometry(0.18, 0.13, 0.19).rotateX(1.0).translate(x, -0.71, 0.1));
    }
    fingers.push(new THREE.BoxGeometry(0.19, 0.16, 0.2).rotateZ(s * 0.7).translate(-s * 0.34, -0.26, 0.18), new THREE.BoxGeometry(0.17, 0.14, 0.18).rotateZ(s * 1.0).translate(-s * 0.44, -0.38, 0.18));
    const hand = new THREE.Group(); fist.add(hand); hand.name = 'fingers';
    if (props.has('shears')) {
      // the pruning machine's: two long steel blades for fingers, a pivot bolt between them
      const bladeM = M.mat('blade', P.blade);
      many(hand, pair((t) => new THREE.ConeGeometry(0.1, 1.0, 4).scale(1, 1, 0.35).rotateZ(Math.PI + t * 0.12).translate(t * 0.12, -0.85, 0.1)), bladeM);
      add(hand, new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10).rotateZ(Math.PI / 2), brassB, 0, -0.42, 0.1);
    } else many(hand, fingers, hullB);
    sh.rotation.z = s * 0.06;
    return { sh, el, fist, hand };
  });
  // short thick legs on the kit: a brass knee pad, the knee bending forward, a broad elephant foot with three toes
  const legs = pair((s) => planLeg(PLANS.brute, { group: g, body, hipParent: hull, hip: { x: s * 0.62, y: HIP_Y, z: 0 }, foot: { x: s * 0.72, z: 0.06 },
    radius: 0.3, balls: 0.82, taper: 0.6, pad: 'pad', ankle: 0.3, mats: { joint: jointB, thigh: hullB, shin: hullB, foot: jointB }, name: `brute leg ${s > 0 ? 'left' : 'right'}` }));
  for (const L of legs) {
    many(L.foot, [-1, 0, 1].map((k) => new THREE.SphereGeometry(1, 8, 6).scale(0.13, 0.1, 0.16).translate(k * 0.2, 0.13, 0.6)), jointB);
    many(L.shin, [new THREE.CylinderGeometry(0.27, 0.3, 0.1, 16).rotateX(Math.PI / 2).translate(0, 0.04, 0.33), new THREE.TorusGeometry(0.2, 0.04, 6, 16).translate(0, 0.04, 0.38), new THREE.TorusGeometry(0.31, 0.045, 6, 18).rotateX(Math.PI / 2).translate(0, 0.5, 0)], brassB);
  }
  // the dress: roots grown over it and moss on its shoulders, a rusted saw blade in its left fist (Lorn II); a turbine
  // in its chest (the Waterfall); a ladle (the Moon Foundry)
  const extras = [];
  if (props.has('roots')) {
    const rootM = M.mat('root', P.root), mossM = M.mat('moss', P.moss);
    const roots = [];
    // (a few short dark roots curling up out of the collar and over the shoulders, as the sheet's tufts)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3, pts = [];
      for (let i = 0; i <= 3; i++) { const y = 3.9 - i * 0.16, r = radiusAt(Math.max(1.4, y)) + 0.03, aa = a + i * 0.12; pts.push([Math.sin(aa) * r, y + (i === 0 ? 0.12 : 0), Math.cos(aa) * r * DEPTH]); }
      roots.push(tubeGeometry(pts.reverse(), 0.035, 0.012));
    }
    for (const s of [-1, 1]) roots.push(tubeGeometry([[s * SH.x, SH.y + 0.4, 0.05], [s * (SH.x + 0.12), SH.y + 0.62, 0.0], [s * (SH.x + 0.05), SH.y + 0.78, -0.1]], 0.03, 0.01));
    many(hull, roots, rootM);
    const moss = [];
    for (let i = 0; i < 26; i++) { const a = i * 2.39996, y = 3.55 + (i % 4) * 0.1, r = radiusAt(y) * 0.98; moss.push(new THREE.IcosahedronGeometry(0.09 + (i % 3) * 0.035, 0).translate(Math.sin(a) * r, y, Math.cos(a) * r * DEPTH)); }
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) moss.push(new THREE.IcosahedronGeometry(0.1, 0).translate(s * SH.x + Math.sin(i * 2) * 0.3, SH.y + 0.38 + (i % 2) * 0.06, Math.cos(i * 2) * 0.3));
    many(hull, moss, mossM);
  }
  if (props.has('saw')) {
    const sawM = M.mat('saw', P.saw), saw = pivot(arms[0].fist, -0.15, -0.5, 0.42, 'saw');
    const teeth = [new THREE.CylinderGeometry(0.55, 0.55, 0.04, 28).rotateX(Math.PI / 2)];   // (the disc facing forward, as the sheet's)
    for (let i = 0; i < 24; i++) teeth.push(new THREE.ConeGeometry(0.06, 0.12, 3).translate(0, 0.6, 0).rotateZ((i / 24) * Math.PI * 2));
    many(saw, teeth, sawM);
    add(saw, new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14).rotateX(Math.PI / 2), brassB);
    saw.rotation.y = -0.15; extras.push(saw);
  }
  let fan = null;
  if (props.has('turbine')) {
    fan = pivot(hull, 0, 2.62, R * DEPTH * 0.98 + 0.05, 'turbine');
    const vanes = [];
    for (let k = 0; k < 8; k++) vanes.push(new THREE.BoxGeometry(0.09, 0.42, 0.03).translate(0, 0.25, 0).rotateY(0.5).rotateZ((k / 8) * Math.PI * 2));
    many(fan, vanes, brassB); add(fan, new THREE.CylinderGeometry(0.1, 0.1, 0.1, 12).rotateX(Math.PI / 2), M.mat('dark', P.dark, { flat: true }));
    add(hull, new THREE.TorusGeometry(0.5, 0.06, 6, 24), brassB, 0, 2.62, R * DEPTH * 0.98 + 0.02);
  }
  if (props.has('ladle')) {
    const lad = pivot(arms[0].fist, 0, -0.45, 0.2, 'ladle'), ironM = M.mat('iron', P.dark);
    many(lad, [new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8).translate(0, -0.55, 0.2).rotateX(0.5), new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, -1.3, 0.75)], ironM);
    add(lad, new THREE.CircleGeometry(0.28, 14).rotateX(-Math.PI / 2), coreM, 0, -1.33, 0.75);
    extras.push(lad);
  }
  const rig = new Rig({ plan: PLANS.brute, group: g, body, legs });
  // (one draw per material for the hull and every limb: skinned on the kit's joints)
  skinBy(g, [{ from: [hullB, jointB], into: bodyM }, { from: [brassB], into: brassM }, { from: [tarB], into: tarM }]);
  finish(g);
  const parts = [hull, ...arms.flatMap((a) => [a.sh, a.el, a.fist]), ...extras, ...legs.map((l) => l.root)];
  // the hurled slab: torn out of the ground in its right fist, then thrown (Foes.animKit lob)
  const slab = add(arms[1].fist, new THREE.DodecahedronGeometry(0.42, 0).scale(1.3, 0.7, 1), M.mat('slab', P.slab ?? '#8a7f70', { flat: true }), 0, -0.6, 0.35);
  slab.visible = false;
  const U = bodyM.uniforms.uFsCracksO;   // (the veins: wider and brighter as it is hurt)
  let raise = 0, bend = 0, back = 0, swing = 0, wake = 0, glow = 0, twitchT = 0;
  const twitch = [0, 0];
  return {
    group: g, body: hull, rig, parts, eyeMat: coreM, base: P.core, size: skin.scale, skin: skin.id, tones: [P.body, P.brass, P.tar],
    tell: (id) => (id === 'hurl' ? arms[1].fist : arms[0].fist),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // calm: slumped where it stopped working; roused, it lifts its arms (a groan: Foes.meet)
      wake = ease(wake, f.state === 'idle' && !f.provoked ? 0 : 1, 1.6, dt);
      // the slam: both fists over the top, held from 75 %; down onto the ground before it
      const up = id === 'slam' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0;
      raise = ease(raise, up, wind ? 9 : 16, dt);
      // the hurl: bent over to tear the slab (to 45 %), straightened with it high over its shoulder (by 75 %), thrown
      const hk = id === 'hurl' && wind ? f.k : 0;
      bend = ease(bend, hk > 0 ? (hk < 0.45 ? THREE.MathUtils.smoothstep(hk, 0, 0.3) : 1 - THREE.MathUtils.smoothstep(hk, 0.45, 0.75)) : 0, 10, dt);
      const lift = hk > 0.45 ? THREE.MathUtils.smoothstep(hk, 0.45, 0.75) : 0;
      // the sweep: the left arm swung back behind it, the shoulder turned; then across its front
      back = ease(back, id === 'sweep' && wind ? c.wind : 0, 9, dt);
      swing = ease(swing, id === 'sweep' && strike ? 1 : 0, 18, dt);
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, recovery: c.recovery, air: f.alt > 0.05 ? 1 : 0,
        touch: (at, L) => { c.touch(at, L); c.thump?.(at, 0.7); } });
      const slump = 1 - wake;
      hull.position.set(o.x, o.y - slump * 0.12, o.z);
      hull.rotation.set(o.pitch + slump * 0.16, o.yaw, o.roll);
      // the arms swing against the legs as it walks (by the distance walked, so the swing follows its pace)
      const walk = Math.sin(rig.walked * 1.45) * Math.min(1, Math.hypot(rig.vel.x, rig.vel.z) / 1.2) * 0.22;
      const [A, B] = arms;   // (A: the right arm (x < 0), B: the left)
      for (const [k, a] of [[0, A], [1, B]]) {
        const sgn = k ? 1 : -1;
        let x = sgn * walk + slump * -0.12, z = sgn * 0.06, y = 0, elb = -0.08 - slump * 0.22;
        // slam: both arms straight up over the top, the elbows a little bent, the fists together; down hard
        x = lerp(x, -2.95, raise); elb = lerp(elb, -0.35, raise); z = lerp(z, -sgn * 0.36, raise);   // (the fists meeting over its head: the sheet's)
        if (strike && id === 'slam') { x = lerp(-2.95, -0.7, c.release); elb = lerp(-0.35, -0.1, c.release); }
        // hurl: the left arm (the free one) down to the ground, then up over its shoulder with the slab
        if (k === 1) { x = lerp(x, -0.55, bend); elb = lerp(elb, -0.25, bend); x = lerp(x, -2.7, lift); elb = lerp(elb, -1.1, lift); z = lerp(z, 0.25, lift); }
        // sweep: the right arm (the saw's) back and out behind it, then across the front at the height of your chest
        if (k === 0) { x = lerp(x, 0.9, back); z = lerp(z, -1.15, back); y = lerp(y, -0.6, back); if (swing > 0) { x = lerp(0.9, -1.4, swing); z = lerp(-1.15, 0.5, swing); y = lerp(-0.6, 0.9, swing); } }
        a.sh.rotation.set(x, y, z);
        a.el.rotation.x = elb;
      }
      // possessed: its fingers twitch while it waits (calm, or between blows)
      twitchT -= dt;
      if (twitchT < 0) { twitch[Math.random() < 0.5 ? 0 : 1] = 0.25; twitchT = 0.6 + Math.random() * 1.6; }
      arms.forEach((a, i) => { twitch[i] = Math.max(0, twitch[i] - dt); a.hand.rotation.x = (f.state === 'chase' || f.state === 'idle') && twitch[i] > 0 ? Math.sin(c.now / 30) * 0.12 : 0; });
      // the slab: torn up through the bend, held high, thrown in the last quarter (its arc onto the mark)
      slab.visible = id === 'hurl' && wind && hk > 0.3 && hk < 0.8;
      if (id === 'hurl' && wind && f.k > 0.8) c.lob(f, (f.k - 0.8) / 0.2, P.slab ?? '#8a7f70'); else c.lob(f, -1);
      if (id === 'hurl' && wind && hk > 0.28 && hk < 0.4 && Math.random() < 0.5) c.dust(arms[1].fist.getWorldPosition(_v), P.slab ?? '#8a7f70', 2, 0.4);
      // the veins: open as it is hurt, blazing through a wind-up; the boss's heart warms with them
      glow = ease(glow, wind ? 0.5 + 0.5 * c.wind : 0, 6, dt);
      if (U) U.value = Math.min(1, 1 - f.hp / f.def.hp + glow * 0.6);
      coreM.uniforms.uColor.value.set(eyeColor(f, P.core, P.glow));
      coreM.uniforms.uGlow.value = 0.45 + glow * 0.5;
      gem.visible = !props.has('door');
      if (fan) fan.rotation.z += dt * (f.state === 'chase' ? 6 : 2);
      // tar drips off it, more as it is hurt; the Waterfall's runs with water
      if (Math.random() < 0.02 + 0.06 * (1 - f.hp / f.def.hp)) c.drip(f, P.tar);
      if (props.has('wet') && Math.random() < 0.08) c.drip(f, '#bfe2f2');
      g.position.y += f.alt;   // (held up off its feet: the magnet glove)
      rig.write();
    },
    dispose: M.dispose,
  };
}

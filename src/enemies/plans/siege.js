import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { Pendulum } from '../../motion-kit/machines.js';
import { materials, add, tubeGeometry, many, skinBy, pivot, lerp, ease, eyeColor, finish, V } from './kit.js';

// Plan 19, the siege machine (docs/systems/procedural-animation.md §4, the kit's `siege`): the bell walker
// (docs/design/enemy-roster.md, archetype 15), drawn to its sheets (references/enemy-archetypes/bell/: sheet-1 the Signal
// Market's sign automaton, sheet-2 the Salt Harbour's dock winch). A bell on legs, 4.4 m: a great bronze bell hung by
// its crown in a tall riveted yoke, a closed loop of brass round it from a hub at its foot to a hanging ring on top;
// five short spider legs round the hub, each a thigh up and out to a high knee and a long shin down to a point; inside
// the bell a clapper on a rod, its ball hanging just below the mouth. The yoke is hung with coins and patched pennants.
// The Salt Harbour's winch has a drum in the yoke instead, its chain wound round it and a hook swinging below.
//
// The possession: the clapper is the spirit. A black body with two white eyes peers over the bell's lip from inside,
// its thin arms hooked over the rim; ink drips from the mouth.
//
// On the kit: a very slow walk, one leg at a time round the ring in a machine's three straight moves; the bell swings
// on its yoke with its own lag and the clapper inside it (src/motion-kit/machines.js Pendulum, driven by the hub's
// moves). Its legs are one skinned mesh in each material (kit.js skinBy).
//
// Its attacks read from the body (src/telegraph.js; nothing on the ground):
//   toll   it rears back on its rear legs, the front ones lifting, and the clapper swings higher three times; then BONG:
//          three rings of sound run out over the ground one after another (jump each; a guard doesn't stop them). The
//          bell-note whistle answered while it winds up chokes the toll, and the bell sits open
//   drop   its legs straighten and the bell rises a metre; then it slams its rim down where you stand, and sits there
//          trembling; then it tips up to rise, its mouth toward you: the clapper in reach (the opening)
// Only the clapper takes harm (foes.js `clapper`): while the bell sits open, tipped toward you, or stilled.
// Calm (`toll`): it stands in its square and tolls the hours softly, no ring.

const HUB_Y = 1.05, PIV_Y = 3.95, BELL = [[0.001, -0.06], [0.36, -0.08], [0.53, -0.18], [0.6, -0.38], [0.62, -0.7], [0.66, -1.0], [0.76, -1.28], [0.88, -1.48], [0.95, -1.6]];
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

export function bellModel(skin) {
  const PL = PLANS.siege, P = skin.palette, props = new Set(skin.props), M = materials('bell', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  const frame = pivot(body, 0, 0, 0, 'frame');
  // (built in these; drawn as one skinned mesh a material on the moving parts' own joints: kit.js skinBy)
  const yokeM = M.mat('yokeBuild', P.yoke), darkM = M.mat('darkBuild', P.dark), bellM = M.mat('bellBuild', P.bell);
  const legB = M.mat('legBuild', P.leg), jointB = M.mat('jointBuild', P.joint), legM = M.mat('leg', P.leg, { vertexColors: true, metal: 'brass', color: P.leg });
  const spiritM = M.mat('spirit', P.spirit), eyeM = M.own('eye', P.eye, { glow: 0.9 }), inkM = M.mat('ink', P.spirit, { flat: true });
  const winch = props.has('winch');
  // the hub at its foot: a squat drum with a brass band, where the legs and the yoke meet
  many(frame, [new THREE.CylinderGeometry(0.42, 0.46, 0.38, 18).translate(0, HUB_Y, 0), new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, HUB_Y - 0.19, 0)], darkM);
  // the yoke: a closed loop of brass round the bell, from the hub up to the hanging ring; riveted plates; the hanger block
  const loop = [[0, 1.12], [0.62, 1.2], [1.0, 1.55], [1.1, 2.2], [1.1, 3.1], [0.98, 3.65], [0.62, 4.05], [0, 4.22]];
  const yoke = [tubeGeometry([...loop.map(([x, y]) => [x, y, 0]), ...loop.slice(0, -1).reverse().map(([x, y]) => [-x, y, 0])], 0.13)];
  yoke.push(new THREE.BoxGeometry(0.46, 0.4, 0.42).translate(0, 4.08, 0), new THREE.TorusGeometry(0.17, 0.05, 8, 18).translate(0, 4.44, 0), new THREE.BoxGeometry(0.32, 0.22, 0.32).translate(0, HUB_Y + 0.3, 0));
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const y = 1.5 + i * 0.4; yoke.push(new THREE.BoxGeometry(0.3, 0.06, 0.32).translate(s * 1.08, y, 0)); }
  for (let i = 0; i < 26; i++) { const t = i / 25, pt = loop[Math.min(loop.length - 1, Math.floor(t * (loop.length - 1)))]; for (const s of [-1, 1]) yoke.push(new THREE.SphereGeometry(0.03, 5, 4).translate(s * pt[0], pt[1], 0.13)); }
  many(frame, yoke, yokeM);
  // the coins on cords and the patched pennants hung from the yoke (the Market's); salt crust (the harbour's: painted)
  if (props.has('coins')) {
    const coinM = M.mat('coin', P.coin, { metal: 'brass', color: P.coin }), cords = [], coins = [];
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const x = s * (0.7 + i * 0.1), y = 3.85 - i * 0.12, l = 0.3 + (i % 2) * 0.25; cords.push(new THREE.CylinderGeometry(0.008, 0.008, l, 3).translate(x * 1.08, y - l / 2, 0.1)); coins.push(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 12).rotateX(Math.PI / 2).translate(x * 1.08, y - l - 0.06, 0.1)); }
    many(frame, cords, darkM); many(frame, coins, coinM);
  }
  const pennants = [];
  if (props.has('pennants')) {
    const clothM = M.mat('cloth', P.cloth, { side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const p = pivot(frame, s * 1.2, 3.62, 0, 'pennant'), sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(s * 0.46, -0.08); sh.lineTo(s * 0.4, -0.45); sh.lineTo(s * 0.5, -0.95); sh.lineTo(s * 0.18, -0.78); sh.lineTo(0, -1.05); sh.lineTo(0, 0);
      add(p, new THREE.ShapeGeometry(sh).rotateY(Math.PI / 2), clothM);
      pennants.push(p);
    }
  }
  // the bell (or the winch's drum) on its swing pivot under the hanger; inside it the clapper on its own
  const swing = pivot(frame, 0, PIV_Y, 0, 'bell swing');
  let bell, clapPivot, ball, spirit;
  if (!winch) {
    const prof = BELL.map(([r, y]) => new THREE.Vector2(r, y)), inner = BELL.slice().reverse().map(([r, y]) => new THREE.Vector2(Math.max(0.001, r - 0.05), y + 0.01));
    bell = add(swing, new THREE.LatheGeometry(prof, 30), bellM);
    add(swing, new THREE.LatheGeometry(inner, 30), M.mat('bellInside', P.bellInside ?? P.dark, { side: THREE.DoubleSide, flat: true }));
    add(swing, new THREE.TorusGeometry(0.94, 0.045, 6, 32).rotateX(Math.PI / 2), bellM, 0, -1.6, 0);
    // (the crown's loop up into the hanger)
    add(swing, new THREE.TorusGeometry(0.13, 0.05, 6, 14), yokeM, 0, 0.02, 0);
    clapPivot = pivot(swing, 0, -0.18, 0, 'clapper');
    many(clapPivot, [new THREE.CylinderGeometry(0.035, 0.03, 1.45, 8).translate(0, -0.72, 0)], darkM);
    ball = add(clapPivot, new THREE.SphereGeometry(0.17, 14, 10), M.mat('clapper', P.clapper ?? P.dark), 0, -1.55, 0);
    // the spirit at the lip: a black body peering over the rim from inside, eyes, two thin arms hooked over it
    // (it peers over the front of the lip: its head just over the rim, its arms hooked over the rim to either side)
    spirit = pivot(swing, 0, -1.64, 0.6, 'spirit');
    add(spirit, new THREE.SphereGeometry(0.28, 14, 10).scale(1.15, 0.75, 0.8), spiritM, 0, -0.04, -0.06);
    many(spirit, [-1, 1].map((s) => new THREE.SphereGeometry(0.055, 8, 6).scale(1, 1.25, 0.6).translate(s * 0.11, 0.06, 0.16)), eyeM);
    many(spirit, [-1, 1].map((s) => tubeGeometry([[s * 0.22, -0.02, 0.0], [s * 0.36, 0.06, 0.16], [s * 0.4, 0.0, 0.3], [s * 0.38, -0.12, 0.32]], 0.028, 0.014)), inkM);
  } else {
    // the winch: a drum with flanges on an axle across the yoke, its chain wound round it; the chain and its hook below
    const drumM = M.mat('drum', P.bell, { color2: P.bell2 }), chainM = M.mat('chain', P.chain, { metal: 'iron', color: P.chain });
    bell = add(swing, new THREE.CylinderGeometry(0.5, 0.5, 1.0, 24).rotateZ(Math.PI / 2), M.mat('wound', P.chain, { metal: 'iron', color: P.chain }), 0, -0.95, 0);
    many(swing, [-1, 1].map((s) => new THREE.CylinderGeometry(0.72, 0.72, 0.08, 26).rotateZ(Math.PI / 2).translate(s * 0.54, -0.95, 0)), drumM);
    many(swing, [new THREE.CylinderGeometry(0.06, 0.06, 2.1, 8).rotateZ(Math.PI / 2).translate(0, -0.95, 0), ...[-1, 1].map((s) => new THREE.CylinderGeometry(0.03, 0.03, 0.95, 5).translate(s * 0.25, -0.45, 0.0))], darkM);
    clapPivot = pivot(swing, 0, -1.42, 0.3, 'chain');
    const links = [];
    for (let i = 0; i < 8; i++) links.push(new THREE.TorusGeometry(0.075, 0.024, 5, 10).scale(1, 1.4, 1).rotateY((i % 2) * Math.PI / 2).translate(0, -0.1 - i * 0.14, 0));
    many(clapPivot, links, chainM);
    ball = pivot(clapPivot, 0, -1.2, 0, 'hook');
    many(ball, [new THREE.TorusGeometry(0.24, 0.065, 6, 16, Math.PI * 1.3).rotateZ(Math.PI * 0.9).translate(0, -0.26, 0), new THREE.CylinderGeometry(0.08, 0.08, 0.2, 8)], M.mat('hook', P.drum2 ?? P.bell));
    spirit = pivot(clapPivot, 0, -0.35, 0.06, 'spirit');
    add(spirit, new THREE.SphereGeometry(0.2, 12, 8).scale(1, 0.9, 0.8), spiritM);
    many(spirit, [-1, 1].map((s) => new THREE.SphereGeometry(0.04, 8, 6).scale(1, 1.25, 0.6).translate(s * 0.07, 0.05, 0.15)), eyeM);
    many(spirit, [-1, 1].map((s) => tubeGeometry([[s * 0.12, 0, 0], [s * 0.18, 0.1, 0.05], [s * 0.06, 0.18, 0.06]], 0.02, 0.012)), inkM);
  }
  // ink dripping from the mouth (static runs at the lip; drops fall: Foes.animKit drip)
  const runs = [];
  for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2 + (k % 3) * 0.1, l = 0.1 + ((k * 5) % 4) * 0.08, r = winch ? 0.5 : 0.93; runs.push(new THREE.ConeGeometry(0.028, l, 5).rotateX(Math.PI).translate(Math.sin(a) * r, (winch ? -1.45 : -1.62) - l / 2, Math.cos(a) * r)); }
  many(swing, runs, inkM);
  // five short spider legs round the hub on the kit: a plated thigh up and out to a high knee, a long shin to a point
  const legs = [0, 1, 2, 3, 4].map((k) => {
    const a = Math.PI + (k / 5) * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
    return planLeg(PL, { group: g, body, hipParent: frame, hip: { x: sx * 0.38, y: HUB_Y - 0.02, z: cz * 0.38 }, foot: { x: sx * 1.05, z: cz * 1.05 },
      radius: 0.13, balls: 0.9, taper: 0.7, pad: 'point', mats: { joint: jointB, thigh: legB, shin: legB, foot: legB }, name: `bell leg ${k}` });
  });
  for (const L of legs) many(L.shin, [new THREE.BoxGeometry(0.2, 0.5, 0.06).translate(0, 0.35, 0.09), new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10).rotateX(Math.PI / 2).translate(0, 0, 0.1)], jointB);
  const rig = new Rig({ plan: PL, group: g, body, legs });
  skinBy(g, [{ from: [legB, jointB], into: legM }, { from: [yokeM], into: M.mat('yoke', P.yoke, { metal: 'brass', color: P.yoke, vertexColors: true }) },
    { from: [darkM], into: M.mat('dark', P.dark, { flat: true, vertexColors: true }) }, { from: [bellM], into: M.mat('bell', P.bell, { color2: P.bell2, side: THREE.DoubleSide, vertexColors: true }) }]);
  finish(g);
  const parts = [frame, swing, ...legs.map((l) => l.root)];
  const sway = new Pendulum(PL.swing), clap = new Pendulum(PL.clapper);
  let rear = 0, open = 0, shake = 0, softT = 8 + Math.random() * 14, soft = 0;
  const front = legs.map((L, i) => i).filter((i) => legs[i].home.z > 0.3);   // (the front legs: they lift as it rears back)
  return {
    group: g, body: frame, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.bell, P.yoke, P.spirit], clapper: ball,
    tell: (id) => (id === 'toll' ? ball : swing),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      // the toll: reared back on its rear legs, the front ones lifting (held from 75 %)
      rear = ease(rear, id === 'toll' && wind ? c.wind : 0, 6, dt);
      for (const i of front) { legs[i].lift = rear * 0.9; legs[i].air.set(0, 0.35 * rear, 0.15 * rear); }
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: (at, L) => { c.touch(at, L); c.thump?.(at, 0.25); }, recovery: c.recovery, air: f.alt > 0.05 ? 1 : 0 });
      // sitting trembling after the drop, then tipped up toward you (the opening: the clapper in reach)
      open = ease(open, f.open > 0 ? 1 : 0, f.open > 0 ? 5 : 2, dt);
      if (strike && id === 'drop' && f.k > 0.9) shake = 1;
      shake = Math.max(0, shake - dt * 1.2);
      const tremble = shake > 0 ? Math.sin(c.now / 22) * 0.03 * shake : 0;
      frame.position.set(o.x + tremble, o.y, o.z);
      frame.rotation.set(o.pitch - open * 0.18, o.yaw, o.roll + tremble);
      // the bell on its yoke and the clapper in it: pendulums driven by the hub's moves
      frame.getWorldPosition(_v); _v.y += PIV_Y;
      sway.update(dt, _v, f.heading);
      swing.getWorldPosition(_w);
      clap.update(dt, _w, f.heading);
      // the toll's three swings, each higher (the clapper driven round), then the strike: BONG, the bell ringing
      if (id === 'toll' && wind) {
        const k = f.k, amp = 0.25 + 0.95 * Math.min(1, k / 0.75), w = Math.PI * 2 * 3 / Math.max(0.3, f.atk.wind ?? 1.5);
        clap.a = amp * Math.sin(k * Math.PI * 2 * 3); clap.va = amp * Math.cos(k * Math.PI * 2 * 3) * w;
      }
      // calm: now and then a soft toll of the hours (three small swings, no ring)
      softT -= dt;
      if (f.state === 'idle' && softT < 0) { soft = 1; softT = 18 + Math.random() * 14; }
      if (soft > 0) { soft = Math.max(0, soft - dt / 3); clap.a = 0.35 * Math.sin((1 - soft) * Math.PI * 6) * soft; }
      const ring = strike && id === 'toll' ? Math.sin(c.now / 18) * 0.02 * (1 - f.k) : 0;
      // (+a swings a weight forward: a turn about x the other way; +b toward +x)
      swing.rotation.set(-sway.a * 0.6 - open * 1.25, 0, sway.b * 0.6 + ring);
      clapPivot.rotation.set(-clap.a + sway.a * 0.3 + open * 0.9, 0, clap.b);
      if (winch) bell.rotation.x += dt * (id === 'toll' && wind ? 3 : f.state === 'chase' ? 0.3 : 0);   // (the drum winds as it tolls)
      // the spirit: it peers over the lip, ducking as the bell tolls; ink drips from the mouth
      spirit.position.y = (winch ? -0.35 : -1.64) + Math.sin(c.now / 800) * 0.02 - rear * 0.05;
      if (Math.random() < 0.05) c.drip(f, P.spirit);
      pennants.forEach((p, i) => { p.rotation.y = Math.sin(c.now / 600 + i * 2) * 0.25 + sway.b * 0.5; });
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, '#ffb070'));
      g.position.y += f.alt;   // (the drop's lift and fall, or the magnet glove)
      rig.write();
    },
    dispose: M.dispose,
  };
}

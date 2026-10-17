import * as THREE from 'three';
import { materials, add, merged, tubeGeometry, skinBy, pivot, ease, eyeColor, finish } from './kit.js';

// Plan 22, the ember bud: the ember wisp (issue #398; docs/design/fireball-foe.md), the bombardier, drawn to its picked
// sheet (references/enemy-archetypes/wisp/sheet-1.jpg, issue #440): a false flower of light. Four curved petals of
// glossy hardened ink closed into a pointed bud round a glowing coal (the coal showing at the slit where their tips part),
// each petal edged in a thin gold line; a thin ring of white-gold light round the bud's waist; a rounded cup of ink under
// the ring; two round lilac eyes, one on each front petal; three drips of ink hanging from its base like a tassel. It
// bobs slowly, no limbs. (Sheets 2 and 3, the clam shell and the lantern cage, are references only.)
//
// Its wind-ups (src/telegraph.js), from the body alone:
//   fireball  the four petals open outward like a flower, the coal swells and brightens white-hot, the body tilts back
//             (the sheet's fourth view); at the throw it snaps forward and the petals clap shut (Foes.throwBall sends the
//             ball from the coal)
//   flare     the petals clench shut and shake, the coal glowing through the seams and the slit; then the heat bursts
// Stunned by its own fire (src/fireballs.js), it drops low (the mind: Foe.update's HOVER), the petals hang half open,
// the coal dimmed to an ember: cut it then.
// Draws: the ink (petals, cup, drips: one skinned mesh on their pivots), the petals' gold edges (one more), the ring,
// the coal, two eyes: 6 (the stand-in's clam was 11).
// Skins (src/enemies/skins.js): the Moon Foundry's cinder wisp (sheet-1's own colours), Lorn II's marsh wisp (a green
// marsh-light), the Eclipse's corona wisp (a ring of white fire round a black bud).

export const EMBER = {
  w: 0.56,             // the bud's widest radius (m)
  h: 1.15,             // the petals' height over the ring (m)
  cup: 0.34,           // the cup's depth under the ring (m)
  waist: 0.82,         // the petals' radius at the ring, a share of the widest
  widest: 0.36,        // where the bud is widest, a share of its height
  ring: -0.3,          // the ring's height in the body (m): the coal at the body's middle
  bob: 0.16,           // m it bobs, slowly
  sit: 0.9,            // m its middle is held over the ground at the lowest (its cup's foot a hand over it)
  open: [1.9, 1.05],   // rad the front pair and the back pair open outward at the full wind-up (the front down under the coal)
  rest: 0.07,          // rad they stand parted at rest (the slit at the tip, the sheet's notch)
  rear: 0.35,          // rad it tilts back over the wind-up; snap: rad forward at the throw
  snap: 0.55,
  glow: [0.6, 1.6],    // the coal's glow: at rest → the full wind-up (and the flare's seam)
  swell: 0.55,         // the coal's swelling at the full wind-up (share)
  drips: [[-0.08, 0.05, 0.66], [0.08, 0.05, 0.66], [0, -0.08, 0.48]],   // x, z where each hangs from the cup, its length (m)
};

/** The petals' profile (radius by height over the ring): a pointed ogive, its waist at the ring, widest a third up. */
export function petalProfile(E = EMBER, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, y = t * E.h;
    const r = t < E.widest ? E.w * (E.waist + (1 - E.waist) * Math.sin((t / E.widest) * Math.PI / 2))
      : E.w * Math.cos(((t - E.widest) / (1 - E.widest)) * Math.PI / 2) ** 0.95;
    pts.push(new THREE.Vector2(Math.max(r, 0.004), y));
  }
  return pts;
}

export function wispModel(skin) {
  const P = skin.palette, props = new Set(skin.props), M = materials('wisp', skin), E = EMBER;
  const g = new THREE.Group(); g.name = skin.name;
  // (built in build materials on the pivots that move them, then one skinned mesh a material: kit.js skinBy)
  const inkB = M.mat('petalBuild', P.shell), edgeB = M.mat('edgeBuild', P.rim);
  const inkM = M.mat('petal', P.shell, { vertexColors: true, side: THREE.DoubleSide }), edgeM = M.mat('edge', P.rim, { vertexColors: true });
  const ringM = M.own('ring', P.ring ?? P.fire, { glow: 0.9 }), coreM = M.own('core', P.core, { glow: E.glow[0] }), eyeM = M.own('eye', P.eye, { glow: 0.7 });
  const body = pivot(g, 0, 0, 0, 'body');
  const base = pivot(body, 0, E.ring, 0, 'base');
  // the coal, in the middle of the bud; the ball is thrown from it
  const core = add(body, new THREE.IcosahedronGeometry(0.29, 2), coreM, 0, 0.1, 0);
  // the four petals, each hinged at the ring on its own side (seams at the front, the sides and the back: the front view's
  // one seam down the middle, an eye each side of it)
  const prof = petalProfile(E), half = (Math.PI / 4) * 0.985, R0 = E.w * E.waist;
  const petals = [0, 1, 2, 3].map((i) => {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const turn = pivot(base, 0, 0, 0, `petal ${i}`); turn.rotation.y = a;
    const hinge = pivot(turn, 0, 0, R0, `petal ${i} hinge`);
    // (lathe phi 0 is +z: the wedge centred on its own side, moved back so the hinge sits on its foot)
    add(hinge, new THREE.LatheGeometry(prof, 9, -half, 2 * half).translate(0, 0, -R0), inkB);
    // its gold edges, up both sides from the ring to the tip
    // (an even tube on five points: ~300 triangles an edge, where a tapered one is ~750)
    const edge = (phi) => prof.filter((_, k) => k % 4 === 0).map((p) => [Math.sin(phi) * p.x, p.y, Math.cos(phi) * p.x - R0]);
    add(hinge, merged([tubeGeometry(edge(-half), 0.009), tubeGeometry(edge(half), 0.009)]), edgeB);
    return hinge;
  });
  // the eyes, one on each front petal (the petals at ±45°), on its surface a third up
  const eyeY = E.h * 0.42, eyeR = E.w * 0.97;
  const eyes = [petals[0], petals[3]].map((p, k) => {
    const phi = (k ? 1 : -1) * 0.32;   // (toward the front seam)
    const e = add(p, new THREE.SphereGeometry(0.068, 10, 8).scale(1, 1, 0.45), eyeM, Math.sin(phi) * eyeR, eyeY, Math.cos(phi) * eyeR - R0);
    e.rotation.y = phi;
    return e;
  });
  // the cup under the ring: rounded, drawn down to where the drips leave it
  const cupPts = [];
  for (let i = 0; i <= 8; i++) { const s = i / 8; cupPts.push(new THREE.Vector2(Math.max(R0 * 0.98 * Math.cos(s * Math.PI / 2) ** 0.7, 0.03), -s * E.cup + 0.02)); }
  add(base, new THREE.LatheGeometry(cupPts.reverse(), 16), inkB);
  // the ring of light round the waist
  add(base, new THREE.TorusGeometry(R0 + 0.035, 0.022, 6, 40).rotateX(Math.PI / 2), ringM);
  const corona = props.has('corona') ? add(base, new THREE.TorusGeometry(E.w + 0.3, 0.03, 5, 40).rotateX(Math.PI / 2), M.own('corona', P.fire, { glow: 0.9 }), 0, 0.45, 0) : null;
  // the drips: each a thinning run of ink and its drop, on a pivot at the cup that swings behind its drift
  const drips = E.drips.map(([x, z, len], i) => {
    const p = pivot(base, x, -E.cup * 0.82, z, `drip ${i}`);
    add(p, merged([tubeGeometry([[0, 0.08, 0], [0, -len * 0.4, 0], [0, -len * 0.92, 0]], 0.065, 0.026),
      new THREE.SphereGeometry(0.055, 10, 8).scale(1, 1.4, 1).translate(0, -len + 0.01, 0)]), inkB);
    return p;
  });
  const [inkMesh, edgeMesh] = skinBy(g, [{ from: [inkB], into: inkM }, { from: [edgeB], into: edgeM }]);
  finish(g);
  const prev = { x: null, z: 0, state: 'idle' };
  let open = 0, clench = 0, kick = 0, glowK = 0;
  return {
    group: g, body, parts: [inkMesh, edgeMesh, core].filter(Boolean), eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.shell, P.core, P.fire],
    tell: () => core,
    /** Where the ball leaves it: the coal, in the world. */
    mouthAt: (out = new THREE.Vector3()) => { g.updateMatrixWorld(true); return core.getWorldPosition(out); },
    fire: P.fire, coreTone: P.core,
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', stunned = f.stunned > 0;
      const vx = prev.x == null ? 0 : (f.pos.x - prev.x) / dt, vz = prev.x == null ? 0 : (f.pos.z - prev.z) / dt;
      prev.x = f.pos.x; prev.z = f.pos.z;
      // (out of the fireball's wind-up: thrown, it snaps forward)
      if (prev.state === 'wind' && !wind && f.atk?.ball && !stunned) kick = 1;
      prev.state = f.state;
      kick = Math.max(0, kick - dt * 3.5);
      // (down low, stunned, its cup held a hand over the ground and its drips splayed on it: never through it)
      const low = Math.max(0, E.sit - f.alt);   // (alt itself eases down: Foe.update)
      g.position.y += f.alt + low + Math.sin(c.now / 650 + f.home.x) * E.bob * (stunned ? 0.3 : 1);
      const throwing = wind && id === 'fireball', flaring = wind && id === 'flare';
      // (the held pose complete at 75 % of the wind-up)
      open = ease(open, throwing ? THREE.MathUtils.smoothstep(f.k, 0, 0.75) : stunned ? 0.45 : 0, throwing ? 9 : kick > 0 ? 18 : 5, dt);
      clench = ease(clench, flaring ? 1 : 0, 10, dt);
      const shake = clench * Math.sin(c.now / 22) * 0.05, breathe = 0.012 * Math.sin(c.now / 520 + f.home.z);
      // each petal outward on its hinge, the front pair furthest, clenched in past shut
      petals.forEach((p, i) => { p.rotation.x = E.rest + breathe + E.open[i === 0 || i === 3 ? 0 : 1] * open - clench * (E.rest + 0.02); });
      // tilted back through the wind-up, snapping forward at the throw; tilted into its drift
      const ch = Math.cos(f.heading), sh = Math.sin(f.heading), fwd = vx * sh + vz * ch, side = vx * ch - vz * sh;
      body.rotation.set(-E.rear * open + E.snap * Math.sin(Math.PI * kick) + THREE.MathUtils.clamp(fwd * 0.05, -0.3, 0.3), 0, THREE.MathUtils.clamp(-side * 0.05, -0.3, 0.3) + shake);
      body.position.y = clench * -0.1;
      // the coal: swelling and brightening through a wind-up, dimmed to an ember stunned
      const want = stunned ? 0.2 : throwing ? f.k : flaring ? f.k : 0;
      glowK = ease(glowK, want, 8, dt);
      core.position.y = 0.1 + 0.1 * open;   // (it rises out of the opened bud, as the sheet's wind-up draws it)
      core.scale.setScalar((1 + E.swell * glowK - (stunned ? 0.25 : 0)) * (1 + 0.05 * Math.sin(c.now / 90)));
      coreM.uniforms.uGlow.value = stunned ? 0.25 : THREE.MathUtils.lerp(E.glow[0], E.glow[1], glowK);
      ringM.uniforms.uGlow.value = stunned ? 0.3 : 0.9 + 0.3 * glowK;
      if (corona) { corona.rotation.z += dt * (0.8 + 3 * glowK); corona.scale.setScalar(1 + 0.2 * glowK); }
      // the drips trail behind its drift and sway, each a little later than the one before
      const splay = THREE.MathUtils.clamp((E.sit + 0.75 - f.alt) / 0.75, 0, 1);   // (from a drip's length over its low, splaying as it comes down)
      drips.forEach((d, i) => {
        d.rotation.x = THREE.MathUtils.clamp(-fwd * 0.08, -0.5, 0.5) + Math.sin(c.now / 480 + i * 1.3) * 0.06 + (0.25 * open) * (1 - splay) + splay * (i === 2 ? -1.45 : 0);
        d.rotation.z = THREE.MathUtils.clamp(side * 0.08, -0.5, 0.5) + Math.sin(c.now / 610 + i * 2.1) * 0.05 + splay * (i === 2 ? 0 : i ? 1.45 : -1.45);
      });
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
      for (const e of eyes) e.scale.y = stunned ? 0.35 : 1;
      // embers off the coal as it winds up
      if (throwing && Math.random() < 0.5 * f.k) { core.getWorldPosition(_w); c.spray(_w, [P.core, P.fire], 1, 1.4, -1); }
    },
    dispose: M.dispose,
  };
}
const _w = new THREE.Vector3();

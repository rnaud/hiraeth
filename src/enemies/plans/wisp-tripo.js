import * as THREE from 'three';
import { materials, add, pivot, merged, ease, eyeColor, finish } from './kit.js';
import { gazePart } from '../gaze.js';
import { RENDER_FRAME } from '../../render-frame.js';
import { boneBoxes, subset, surfaceNormal } from './tripo-body.js';
import { foeSource } from '../foe-assets.js';
import { wispLegacyModel, EMBER } from './ember-legacy.js';

// The cinder wisp (issue #800): the game's `wisp`, the ember wisp, the bombardier, everywhere it is fielded (the Moon
// Foundry, Lorn II, the Eclipse, the Arena, the gallery). Its body is Tripo's (task fbbea7ea-…, from the approved image,
// references/enemy-redesign-2026-10-30/keep-wisp/885e3431-…-3.png: an ember inside a flower bud, four broad petals of dark
// teal closed round it, the side ones flaring at their tips, a darker cup under them, two pale eyes on the front petal, no
// limbs), made into the game's asset by the family F trial's prepare-wisp.mjs (references/enemy-redesign-2026-10-30/trials/
// familyF-tripo/: the bud alone (the picture's stain and loose ember dropped), the game's frame, 1.3 m tall, 14k triangles, the
// four petals cut apart on the planes through their creases above the hinge ring, the cup under it, Tripo's coal dropped,
// the reference's flat colours, the painted eyes painted out) and shipped by scripts/tripo/ship-body.mjs as
// public/enemies/wisp/body.glb.
//
// Its rig, the rigid parts' (a bud does not bend: each petal hinged at the ring, blended across it so a petal tipped out
// stays joined to the cup): the cup on the body, each petal on its own hinge bone, the four petals one mesh (one material). The game's own glowing coal sits where
// Tripo's was, the ball thrown from it; the eyes their own parts on the front petal, sliding toward the traveller (the
// author's rule, #800). It bobs slowly, high over the ground (`hover` 4.2), as the legacy bud did, with the legacy's motion:
//   fireball  the petals open outward like a flower, the coal swells and brightens and rises out of the bud, the body tilts
//             back; at the throw it snaps forward and the petals clap shut (Foes.throwBall sends the ball from the coal)
//   flare     the petals clench shut and shake, the coal glowing through the seams; then the heat bursts
// Stunned by its own fire it drops low, the petals hang half open, the coal dimmed to an ember. As it dies it drops, turning,
// and lands (its DEATHS recipe, `flyer`). Skins (src/enemies/skins.js): the Moon Foundry's cinder wisp (the reference's
// colours), Lorn II's marsh wisp (mossy petals with lichen, its brass band, a green marsh-light), the Eclipse's corona wisp
// (a black bud in its ring of white fire). Where the body is not loaded, the legacy bud (plans/ember-legacy.js) stands in.

export { EMBER };
/** The shipped body, under public/. */
export const WISP_BODY = 'enemies/wisp/body.glb';
/** The loaded body { geometry, landmarks } (src/enemies/foe-assets.js), or null. */
export function wispSource() { const S = foeSource('wisp'); return S ? (S.wisp ??= { geometry: S.geometry, landmarks: S.rig, triangles: S.triangles }) : null; }

/** The wisp's builder (src/enemies/plans/index.js): the Tripo body, or the legacy bud where it is not loaded. */
export function wispModel(skin) {
  const src = wispSource();
  return src ? tripoWispModel(skin, src) : wispLegacyModel(skin);
}

/** The reference's flat colours (prepare-wisp.mjs PALETTE): the home skin's (skins.js SKINS.wisp.moonfoundry). */
export const WISP_ROLES = { petal: '#3d5c55', cup: '#1d3b32' };
export const BUD = {
  mid: 0.66,           // m of the bud under its middle (the hover height is its middle's, as the legacy's: E.sit holds it over the ground)
  open: { front: 1.45, left: 1.25, right: 1.25, back: 0.95 },   // rad each petal tips outward at the full wind-up
  rest: 0.03,          // rad they stand parted at rest
  coal: 0.3,           // m: the coal's radius (inside Tripo's, which was its hollow)
  blend: [0.06, 0.1],  // m under and over the hinge ring a vertex is shared by the cup and its petal
  eye: { w: 0.042, h: 0.055, slide: 0.04 },
};

const CACHE = new WeakMap();
const NAMES = ['front', 'left', 'back', 'right'];
/** The weights of one source geometry (once): bone 0 the cup's, 1-4 the petals' (NAMES). */
function weigh(src) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const L = src.landmarks, P = src.geometry.attributes.position, I = src.geometry.index.array, n = P.count;
  const of = new Int8Array(n).fill(-1);   // (each vertex's petal, from its triangles: the cut planes split their shared edges)
  NAMES.forEach((name, k) => { const r = L.parts[name]; if (r) for (let t = r[0] * 3; t < (r[0] + r[1]) * 3; t++) of[I[t]] = k; });
  const azs = NAMES.map((name) => L.petals[name].az);
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), hy = L.hinge.y;
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    let k = of[i];
    if (k < 0) { const a = Math.atan2(x, z); k = azs.reduce((b, q, j) => (Math.abs(Math.atan2(Math.sin(a - q), Math.cos(a - q))) < Math.abs(Math.atan2(Math.sin(a - azs[b]), Math.cos(a - azs[b]))) ? j : b), 0); }
    const w = THREE.MathUtils.smoothstep(y, hy - BUD.blend[0], hy + BUD.blend[1]);
    SI[i * 4] = 0; SW[i * 4] = 1 - w; SI[i * 4 + 1] = 1 + k; SW[i * 4 + 1] = w;
  }
  const out = { SI, SW };
  CACHE.set(src.geometry, out);
  return out;
}

/** The wisp's body (the model contract of plans/index.js), from the loaded source (wispSource). */
export function tripoWispModel(skin, src) {
  const L = src.landmarks, P = skin.palette, props = new Set(skin.props), M = materials('wisp', skin), E = EMBER;
  const g = new THREE.Group(); g.name = `${skin.name} · cinder wisp`;
  const body = pivot(g, 0, 0, 0, 'body');
  const bud = pivot(body, 0, -BUD.mid, 0, 'bud');   // (the mesh's frame: its foot on y 0)
  // ---------------------------------------------------------------- the bones: the cup, each petal on its hinge at the ring
  const hinges = NAMES.map((name) => {
    const a = L.petals[name].az, turn = pivot(bud, 0, L.hinge.y, 0, `petal ${name}`); turn.rotation.y = a;
    return pivot(turn, 0, 0, L.hinge.r * 0.82, `petal ${name} hinge`);
  });
  // ---------------------------------------------------------------- the meshes: the cup and each petal, on one skeleton
  const prep = weigh(src), geo = src.geometry, I = geo.index.array;
  const attrs = { position: geo.attributes.position, normal: geo.attributes.normal, skinIndex: new THREE.BufferAttribute(prep.SI, 4), skinWeight: new THREE.BufferAttribute(prep.SW, 4) };
  const petalM = M.mat('petal', P.shell, { color2: P.shell2 }), cupM = M.mat('cup', P.cup ?? P.shell2 ?? P.shell);
  // (the cup, and the four petals as one mesh: one material, each petal its own bone; their triangles follow the cup's)
  const petalTris = NAMES.map((n) => L.parts[n]), lo = Math.min(...petalTris.map((r) => r[0])), hi = Math.max(...petalTris.map((r) => r[0] + r[1]));
  const meshes = [['cup', L.parts.cup], ['petals', [lo, hi - lo]]].filter(([, [, count]]) => count > 0).map(([part, [first, count]]) => {
    const sm = new THREE.SkinnedMesh(subset(geo, Array.from(I.subarray(first * 3, (first + count) * 3)), attrs), part === 'cup' ? cupM : petalM);
    // (bound where the bud hangs: its mesh's frame has its foot on y 0, the bones' are under the body's middle)
    sm.name = `wisp ${part}`; sm.frustumCulled = false; sm.position.y = -BUD.mid; g.add(sm); return sm;
  });
  // ---------------------------------------------------------------- the coal where Tripo's was; the eyes on the front petal
  const coreM = M.own('core', P.core, { glow: E.glow[0] }), eyeM = M.own('eye', P.eye, { glow: 0.7 });
  const coalY = L.coal.at[1];
  const core = add(bud, new THREE.IcosahedronGeometry(BUD.coal, 2), coreM, L.coal.at[0], coalY, L.coal.at[2]);
  g.updateMatrixWorld(true);
  const front = hinges[0], inv = new THREE.Matrix4().copy(front.matrixWorld).invert(), Z = new THREE.Vector3(0, 0, 1), q = new THREE.Quaternion(), qf = new THREE.Quaternion();
  front.getWorldQuaternion(qf); qf.invert();
  const eyes = add(front, merged(L.eyes.map((e) => {
    const at = new THREE.Vector3(...e.at), n = surfaceNormal(geo, at, 0.05);
    const p = at.clone().addScaledVector(n, 0.006).applyMatrix4(new THREE.Matrix4().makeTranslation(0, -BUD.mid, 0)).applyMatrix4(inv), nl = n.clone().applyQuaternion(qf);
    q.setFromUnitVectors(Z, nl);
    return new THREE.SphereGeometry(1, 10, 8).scale(BUD.eye.w, BUD.eye.h, 0.012).applyQuaternion(q).translate(p.x, p.y, p.z);
  })), eyeM);
  eyes.name = 'eyes';
  // (the marsh wisp's brass band round the waist; the corona wisp's ring of white fire round the bud)
  const brass = props.has('brass');
  const ringM = brass ? M.own('ring', P.ring ?? P.rim, { metal: 'brass', glow: 0 }) : null;
  if (brass) add(bud, new THREE.TorusGeometry(L.hinge.r + 0.01, 0.03, 6, 40).rotateX(Math.PI / 2), ringM, 0, L.hinge.y, 0).name = 'band';
  const corona = props.has('corona') ? add(bud, new THREE.TorusGeometry(L.widest + 0.3, 0.03, 5, 40).rotateX(Math.PI / 2), M.own('corona', P.fire, { glow: 0.9 }), 0, coalY + 0.1, 0) : null;
  // its eyes on you once it has noticed you, on its way before (src/enemies/gaze.js, issue #508): they slide over the petal
  const gaze = [gazePart(g, eyes, { mode: 'slide', slide: BUD.eye.slide })];
  finish(g);
  g.updateMatrixWorld(true);
  const bones = [bud, ...hinges];
  const skeleton = new THREE.Skeleton(bones);
  for (const sm of meshes) { sm.bind(skeleton); boneBoxes(sm, bones, prep.SI, RENDER_FRAME); }
  const prev = { x: null, z: 0, state: 'idle' };
  let open = 0, clench = 0, kick = 0, glowK = 0;
  const _w = new THREE.Vector3();
  return {
    group: g, gaze, body, parts: [...meshes, core, eyes], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.shell, P.core, P.fire],
    tripo: 'tripo',
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
      // (down low, stunned, its cup held a hand over the ground: never through it)
      const low = Math.max(0, E.sit - f.alt);
      g.position.y += f.alt + low + Math.sin(c.now / 650 + f.home.x) * E.bob * (stunned ? 0.3 : 1);
      const throwing = wind && id === 'fireball', flaring = wind && id === 'flare';
      // (the held pose complete at 75 % of the wind-up)
      open = ease(open, throwing ? THREE.MathUtils.smoothstep(f.k, 0, 0.75) : stunned ? 0.45 : 0, throwing ? 9 : kick > 0 ? 18 : 5, dt);
      clench = ease(clench, flaring ? 1 : 0, 10, dt);
      const shake = clench * Math.sin(c.now / 22) * 0.05, breathe = 0.012 * Math.sin(c.now / 520 + f.home.z);
      // each petal outward on its hinge, the front furthest, clenched in past shut
      hinges.forEach((h, i) => { h.rotation.x = BUD.rest + breathe + BUD.open[NAMES[i]] * open - clench * (BUD.rest + 0.02); });
      // tilted back through the wind-up, snapping forward at the throw; tilted into its drift
      const ch = Math.cos(f.heading), sh = Math.sin(f.heading), fwd = vx * sh + vz * ch, side = vx * ch - vz * sh;
      body.rotation.set(-E.rear * open + E.snap * Math.sin(Math.PI * kick) + THREE.MathUtils.clamp(fwd * 0.05, -0.3, 0.3), 0, THREE.MathUtils.clamp(-side * 0.05, -0.3, 0.3) + shake);
      body.position.y = clench * -0.1;
      // the coal: swelling and brightening through a wind-up, dimmed to an ember stunned, rising out of the opened bud
      const want = stunned ? 0.2 : throwing ? f.k : flaring ? f.k : 0;
      glowK = ease(glowK, want, 8, dt);
      core.position.y = coalY + 0.18 * open;
      core.scale.setScalar((1 + E.swell * glowK - (stunned ? 0.25 : 0)) * (1 + 0.05 * Math.sin(c.now / 90)));
      coreM.uniforms.uGlow.value = stunned ? 0.25 : THREE.MathUtils.lerp(E.glow[0], E.glow[1], glowK);
      if (ringM) ringM.uniforms.uGlow.value = 0.25 * glowK;
      if (corona) { corona.rotation.z += dt * (0.8 + 3 * glowK); corona.scale.setScalar(1 + 0.2 * glowK); }
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
      eyes.scale.y = stunned ? 0.35 : 1;
      // embers off the coal as it winds up
      if (throwing && Math.random() < 0.5 * f.k) { core.getWorldPosition(_w); c.spray(_w, [P.core, P.fire], 1, 1.4, -1); }
    },
    dispose() { M.dispose(); for (const sm of meshes) sm.geometry.dispose(); },
  };
}

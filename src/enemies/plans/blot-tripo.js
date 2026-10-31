import * as THREE from 'three';
import { materials, add, pivot, merged, lerp, ease, eyeColor, finish, V } from './kit.js';
import { gazePart } from '../gaze.js';
import { RENDER_FRAME } from '../../render-frame.js';
import { boneBoxes, subset, surfaceNormal } from './tripo-body.js';
import { foeSource } from '../foe-assets.js';
import { blotLegacyModel } from './blob-legacy.js';

// The ink blot (issue #800): the game's `blot`, the teacher, in all 22 of its worlds' skins (every world, the Arena, the
// fight temples, the gallery). Its body is Tripo's (task ebbb5fc2-…, from the approved image,
// references/enemy-redesign-2026-10-30/blob/eb43fb37-…-2.png: a self-contained drop of ink, its tip swept back into a hook, a tan belly plate, a lilac
// light down one flank, two cream eyes with slit pupils), made into the game's asset by the family F trial's
// prepare-blot.mjs (references/enemy-redesign-2026-10-30/trials/familyF-tripo/: the game's frame, 1.05 m to the hook's tip,
// 6.5k triangles, its three parts cut by geometry, the reference's flat colours, the painted eyes painted out) and shipped by
// scripts/tripo/ship-body.mjs as public/enemies/blot/body.glb.
//
// Its rig (a soft body: the nearest family is the rigid parts', a drop that does not bend but squashes): one skinned mesh a
// part (the ink, the lilac flank, the belly) on two bones, the drop and its hook, the hook lagging behind the hops and
// leaning over you as it rears. The drop squashes and stretches as the legacy blot's did (the hop's phase following the
// distance covered, never a clock); its eyes are their own parts (cream ovals where the painted ones were, the slit pupils
// sliding across them toward the traveller: the author's rule, #800). Each world's skin keeps its palette: the ink, its
// light, the eyes, and the world's own colour at its edge (sand in the Desert, moss in Lorn, rust in the Hangar), worn on
// its belly and on the pool's rim; the Hangar's metal shavings stuck in it.
//
// Left alone it pools, a low stain with its eyes on top and its rim in the world's colour, and stands up as you come near
// (calm: 'pool'); standing, it is a drop on its own, the pool under it gone (the approved design: the floor-attached version
// was rejected). Its wind-ups read from the body (src/telegraph.js), as the legacy's:
//   lunge, combo   it coils down into a flattened spring of stacked rings, leaning back, the pool spreading under it
//   spit           it rears up tall and thin, leaning over you, and lobs a glob (the one move with a landing mark)
// Where the body is not loaded, the legacy blot (plans/blob-legacy.js) stands in.

/** The shipped body, under public/. */
export const BLOT_BODY = 'enemies/blot/body.glb';
/** The loaded body { geometry, landmarks } (src/enemies/foe-assets.js), or null. */
export function blotSource() { const S = foeSource('blot'); return S ? (S.blot ??= { geometry: S.geometry, landmarks: S.rig, triangles: S.triangles }) : null; }

/** The blot's builder (src/enemies/plans/index.js): the Tripo body, or the legacy blot where it is not loaded. */
export function blotModel(skin) {
  const src = blotSource();
  return src ? tripoBlotModel(skin, src) : blotLegacyModel(skin);
}

/** The reference's flat colours (prepare-blot.mjs PALETTE): the home skin's (skins.js SKINS.blot.desert). */
export const BLOT_ROLES = { ink: '#24363b', shine: '#a28c97', belly: '#e3b279' };
const STRIDE = 1.2, HOP = 0.3;
/** The hook: carried by its own bone above this height (m, blended over the span), lagging. */
const HOOK = [0.74, 0.98];
/** The eyes' size (m: the painted ones' measured half-width and half-height) and how far the pupils slide. */
const EYE = { w: 0.042, h: 0.03, slide: 0.016 };

const CACHE = new WeakMap();
/** The weights of one source geometry (once): the drop below the hook, the hook above, blended. */
function weigh(src) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const P = src.geometry.attributes.position, n = P.count, SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const w = THREE.MathUtils.smoothstep(P.getY(i), HOOK[0], HOOK[1]);
    SI[i * 4] = 0; SW[i * 4] = 1 - w; SI[i * 4 + 1] = 1; SW[i * 4 + 1] = w;
    if (w === 0) { SW[i * 4] = 1; SW[i * 4 + 1] = 0; }
  }
  const out = { SI, SW };
  CACHE.set(src.geometry, out);
  return out;
}

/** The surface point of `geo` furthest out toward azimuth a (rad from the front, +x its left) at height y. */
function surfaceAt(geo, a, y) {
  const P = geo.attributes.position, dx = Math.sin(a), dz = Math.cos(a), v = new THREE.Vector3(), out = new THREE.Vector3(0, y, 0);
  let best = -Infinity;
  for (let i = 0; i < P.count; i++) { if (Math.abs(P.getY(i) - y) > 0.03) continue; const d = P.getX(i) * dx + P.getZ(i) * dz; if (d > best) { best = d; out.copy(v.fromBufferAttribute(P, i)); } }
  return out;
}

/** A ragged pool's outline (radius r, its splashes at every other point), flat on the ground. */
function ragged(r, n, seed) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, k = r * (1 + (i % 2 ? 0.14 : -0.06) + Math.sin(i * 2.7 + seed) * 0.09); s[i ? 'lineTo' : 'moveTo'](Math.sin(a) * k, Math.cos(a) * k); }
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
}

/** The blot's body (the model contract of plans/index.js), from the loaded source (blotSource). */
export function tripoBlotModel(skin, src) {
  const L = src.landmarks, P = skin.palette, props = new Set(skin.props), M = materials('blot', skin);
  const g = new THREE.Group(); g.name = `${skin.name} · ink blot`;
  const body = pivot(g, 0, 0, 0, 'drop');
  const hook = pivot(body, 0, HOOK[0], 0, 'hook');
  // ---------------------------------------------------------------- the meshes: one a part, on the drop's two bones
  const prep = weigh(src), geo = src.geometry, I = geo.index.array;
  const attrs = { position: geo.attributes.position, normal: geo.attributes.normal, skinIndex: new THREE.BufferAttribute(prep.SI, 4), skinWeight: new THREE.BufferAttribute(prep.SW, 4) };
  const inkM = M.mat('ink', P.ink), PARTS = { ink: inkM, shine: M.mat('shine', P.shine ?? '#5a4a8a'), belly: M.mat('belly', P.belly ?? P.edge) };
  const meshes = Object.entries(L.parts).filter(([, [, count]]) => count > 0).map(([part, [first, count]]) => {
    const sm = new THREE.SkinnedMesh(subset(geo, Array.from(I.subarray(first * 3, (first + count) * 3)), attrs), PARTS[part]);
    sm.name = `blot ${part}`; sm.frustumCulled = false; g.add(sm); return sm;
  });
  // ---------------------------------------------------------------- the eyes: cream ovals where the painted ones were, slit pupils
  const eyeM = M.own('eye', P.eye, { glow: 0.6 }), pupilM = M.mat('pupil', '#15121a', { flat: true });
  const whites = [], slits = [], q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
  for (const e of L.eyes) {
    const at = new THREE.Vector3(e.at[0], e.at[1], e.surface ?? e.at[2]), n = surfaceNormal(geo, at, 0.05);
    q.setFromUnitVectors(Z, n);
    const put = (g0, out) => g0.applyQuaternion(q).translate(at.x + n.x * out, at.y + n.y * out, at.z + n.z * out);
    whites.push(put(new THREE.SphereGeometry(1, 14, 8).scale(EYE.w, EYE.h, 0.012), 0.004));
    slits.push(put(new THREE.SphereGeometry(1, 10, 6).scale(EYE.w * 0.62, EYE.h * 0.22, 0.008), 0.014));
  }
  const eyes = add(body, merged(whites), eyeM); eyes.name = 'eyes';
  const pupils = add(body, merged(slits), pupilM); pupils.name = 'pupils';
  // where the spit gathers: its front under the eyes
  const mouth = pivot(body, ...L.mouth, 'mouth');
  // metal shavings stuck in it (the Hangar's): short rods on its surface, as the legacy's
  if (props.has('shavings')) {
    const steelM = M.mat('steel', '#b8b0a0', { metal: 'brass', color: '#b89a6a' }), rods = [];
    for (const [a, y, l] of [[0.5, 0.42, 0.07], [-0.7, 0.3, 0.06], [1.6, 0.22, 0.08], [-1.9, 0.5, 0.05], [2.6, 0.34, 0.07], [0.1, 0.62, 0.05]]) {
      const at = surfaceAt(geo, a, y);
      rods.push(new THREE.CylinderGeometry(0.012, 0.012, l, 6).applyMatrix4(new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.6, a, 0.9)), V(1, 1, 1))));
    }
    add(body, merged(rods), steelM).name = 'shavings';
  }
  // its coils: as it winds up a lunge it sinks into a flattened spring of stacked rings (one mesh, hidden at rest)
  const R0 = L.base ?? 0.3;
  const coils = add(body, merged([0, 1, 2].map((i) => new THREE.TorusGeometry(R0 + 0.06 - i * 0.05, 0.06, 8, 26).rotateX(Math.PI / 2).translate(0, 0.07 + i * 0.1, -i * 0.03))), inkM);
  coils.name = 'coils'; coils.visible = false;
  // the pool it melts into when calm: ink over a ragged rim of the ground's colour where the ink has soaked up the world
  const edgeM = M.mat('edge', P.edge, { flat: true }), edge2M = P.edge2 ? M.mat('edge2', P.edge2, { flat: true }) : null;
  const flecks = Array.from({ length: 7 }, (_, i) => { const a = i * 0.9 + 0.3, r = 0.5 + (i % 2) * 0.05; return new THREE.SphereGeometry(0.05, 6, 4).scale(1, 0.5, 1).translate(Math.sin(a) * r, 0.03, Math.cos(a) * r); });
  const poolAt = pivot(g, 0, 0, 0, 'pool');
  const rim = add(poolAt, merged([ragged(0.62, 22, 1).translate(0, 0.012, 0), ...flecks]), edgeM);
  const rim2 = edge2M ? add(poolAt, ragged(0.5, 18, 4).translate(0.08, 0.016, -0.05), edge2M) : null;
  const pool = add(poolAt, ragged(0.5, 20, 2).translate(0, 0.02, 0), inkM);
  // its eyes on you once it has noticed you, on its way before (src/enemies/gaze.js, issue #508): the slits slide across
  const gaze = [gazePart(g, pupils, { mode: 'slide', slide: EYE.slide })];
  finish(g);
  g.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([body, hook]);
  for (const sm of meshes) { sm.bind(skeleton); boneBoxes(sm, [body, hook], prep.SI, RENDER_FRAME); }
  let phase = Math.random(), up = 1, last = null, coil = 0, rear = 0, lagX = 0, lagV = 0;
  return {
    group: g, gaze, body, parts: [...meshes, eyes, pupils], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.ink, P.shine ?? '#3b3350', P.edge],
    tripo: 'tripo',
    tell: (id) => (id === 'spit' ? mouth : eyes),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // the hop's phase by the distance covered
      const moved = last ? Math.hypot(f.pos.x - last.x, f.pos.z - last.z) : 0;
      last = (last ?? V()).copy(f.pos);
      if (moved < 1) phase = (phase + moved / STRIDE) % 1;
      const hopping = c.moving && moved > 1e-4;
      const h = hopping ? Math.sin(Math.PI * phase) : 0;
      // pooled while calm, standing as it comes for you
      up = ease(up, f.state === 'idle' && !f.provoked ? 0 : 1, f.provoked ? 6 : 2, dt);
      coil = ease(coil, (id === 'lunge' || id === 'combo' || id === 'again') && wind ? c.wind : 0, 14, dt);
      rear = ease(rear, id === 'spit' && wind ? c.wind : 0, 9, dt);
      const stretch = strike && f.atk?.lunge ? Math.sin(Math.PI * f.k) : 0;
      const land = hopping ? Math.max(0, 1 - phase * 5) + Math.max(0, phase * 5 - 4) : 0;   // (squashed as it lands and takes off)
      const wob = Math.sin(c.now / 160 + f.home.x) * 0.04;
      const sy = lerp(0.34, 1, up) * (1 - coil * 0.45 - land * 0.14 + h * 0.12 + rear * 0.6 - stretch * 0.12) - wob;
      const sxz = lerp(1.45, 1, up) * (1 + coil * 0.22 + land * 0.12 - rear * 0.3 - stretch * 0.1) + wob;
      body.scale.set(sxz, sy, sxz * (1 + stretch * 0.6));
      body.position.y = h * HOP + (strike && f.atk?.lunge ? Math.sin(Math.PI * f.k) * 0.25 : 0);
      body.rotation.x = -coil * 0.2 + stretch * 0.35 + rear * 0.42;
      // the hook: a spring behind the hop's rise and fall (it trails as the drop goes up, flicks as it lands), leaning in
      // over you as it rears to spit, swaying a little
      const want = (hopping ? -0.35 * Math.cos(2 * Math.PI * phase) : 0) + rear * 0.35 - coil * 0.25;
      lagV += ((want - lagX) * 90 - lagV * 11) * dt; lagX += lagV * dt;
      hook.rotation.set(lagX, 0, Math.sin(c.now / 340 + f.home.z) * 0.06);
      // the coiled spring: its rings show as it sinks, the drop pressed down into them
      coils.visible = coil > 0.12; coils.scale.set(1, 0.6 + coil * 0.7, 1);
      // the pool: under it as it melts down, and spreading under its coil (the lunge's flat puddle); gone standing
      const pk = Math.max(1 - up, coil * 0.8);
      poolAt.visible = pk > 0.04; poolAt.scale.setScalar(0.35 + 0.65 * pk + coil * 0.2);
      pool.scale.setScalar(1 + (1 - up) * 0.1);
      // the spit: the glob in the air over the last half of the wind-up, onto its landing mark
      if (id === 'spit' && wind && f.k > 0.45) c.lob(f, (f.k - 0.45) / 0.55, P.ink); else c.lob(f, -1);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye, '#f05a3c'));
    },
    dispose() { M.dispose(); for (const sm of meshes) sm.geometry.dispose(); },
  };
}

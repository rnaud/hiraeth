import * as THREE from 'three';
import { ease, eyeColor } from './kit.js';

// The makers' defunct droids (issue #726, docs/design/enemy-roster-v4.md): one material family for the sentinel, the
// oracle and the crawler (and, later, the fencer and the lamp tripod): weathered ivory ceramic panels over dark jointed
// limbs, one amber eye, amber seams of light; chipped, stained low on each part and a little moss in the joints. The
// sheets (a new `sentinel/`, `oracle/` and `crawler/` folder under the enemy references) draw all three in it.
//
// Built once here: the palette every droid skin starts from (DROID_PALETTE; its stronger tier the same, #748),
// the named materials (droidMaterials: each a build material the parts are made in and the skinned one they are drawn
// in, kit.js skinBy), and the glow of the eye and the seams through a fight (droidGlow). The painted surfaces of these
// names are in src/enemies/surfaces.js (DROID_SURFACE).
//
//   ceramic   the ivory panels: stains, chips, grime low on the part, moss in the low corners, a dull glaze
//   joint     the dark frame between them: the neck's pipes, the waist, the elbows, knees and hips
//   seam      amber lines of light along the panels' edges (they brighten through a wind-up)
//   moss      a few tufts in the joints (sentinel) and on the dome (crawler)
//   eye       the one round lens: amber, the wind-up's flare paler, red enraged

/** The droids' palette (src/enemies/skins.js, where the skins' colours live). */
export { DROID_PALETTE } from '../skins.js';

/**
 * The droid materials of one body (M: kit.js materials of its archetype and skin; P: the skin's palette): for each name a
 * build material (`…B`, the parts are made in it) and the drawn one (skinned on the joints, vertex colours as tints); the
 * eye and the seams their own (they glow through a fight). sets: kit.js skinBy's table.
 */
export function droidMaterials(M, P) {
  const ceramicB = M.mat('ceramicBuild', P.ceramic), jointB = M.mat('jointBuild', P.joint), seamB = M.mat('seamBuild', P.seam), mossB = M.mat('mossBuild', P.moss);
  const ceramic = M.mat('ceramic', P.ceramic, { vertexColors: true }), joint = M.mat('joint', P.joint, { vertexColors: true });
  const moss = M.mat('moss', P.moss, { vertexColors: true });
  const seam = M.own('seam', P.seam, { vertexColors: true, glow: 0.65, hatch: 0 });
  const eye = M.own('eye', P.eye, { glow: 0.95 });
  return {
    ceramicB, jointB, seamB, mossB, ceramic, joint, seam, moss, eye,
    sets: [{ from: [ceramicB], into: ceramic }, { from: [jointB], into: joint }, { from: [seamB], into: seam }, { from: [mossB], into: moss }],
  };
}

/** A lathe from (r, y) pairs (bottom to top), squashed front to back by `depth` (x by `width`). */
export function lathe(profile, seg = 20, depth = 1, width = 1) {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-3, r), y)), seg);
  if (depth !== 1 || width !== 1) geo.scale(width, 1, depth);
  geo.computeVertexNormals();
  return geo;
}

/** The droids' lens: a dark socket ring and the lit glass in it, facing +z (r the glass's radius). */
export function lensParts(r) {
  return {
    socket: new THREE.TorusGeometry(r * 1.18, r * 0.2, 6, 20),
    glass: new THREE.SphereGeometry(r, 14, 10).scale(1, 1, 0.55),
  };
}

/** The light of a droid through its fight (each frame; o: { over: 0..1 overloaded, call: 0..1 a flash, dim: 0..1 }). */
export function droidGlow(f, mats, P, st, dt, o = {}) {
  const wind = f.state === 'wind';
  st.glow = ease(st.glow ?? 0, wind ? 0.5 + 0.5 * Math.min(1, f.k / 0.75) : 0, 6, dt);
  const broke = f.reel === 'guardbroken' || f.stunned > 0 || f.downT > 0;
  const over = o.over ?? 0, call = o.call ?? 0;
  // (the eye: amber; its flare winding up, pale blue stunned, red enraged or overloaded)
  mats.eye.uniforms.uColor.value.set(broke ? '#bfe9ff' : call > 0.3 ? P.flare : over > 0.5 && !wind ? P.over ?? '#ff3a24' : eyeColor(f, P.eye, P.flare));
  mats.eye.uniforms.uGlow.value = 0.75 + st.glow * 0.25 + call * 0.3 - (broke ? 0.3 : 0);
  mats.seam.uniforms.uGlow.value = 0.45 + st.glow * 0.45 + over * 0.35 + call * 0.4 - (broke ? 0.3 : 0) - (o.dim ?? 0) * 0.3;
  return st.glow;
}

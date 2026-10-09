// How much of a foe can be seen (playtest 2026-10-08: "no invisible enemies").
//
// Every foe, in every state it can be in (idle, chasing, winding up each attack, striking, recovering,
// a dune ray under the sand, a shadow hound running as a shadow), must show the player something:
//   - a shape standing at least PRESENCE.height over its footing and PRESENCE.width across (or, flat,
//     PRESENCE.flat), so it is never only a decal on the ground or a sliver of a fin;
//   - a light part (a pale piece, a glowing one, or a white contour: makeMaterial({ lineWhite })) at least
//     PRESENCE.light across, so an ink-black foe still reads on dark ground, at night or in the Eclipse.
// presenceOf() measures that from the meshes actually drawn (visible all the way up the tree), in world
// space, so a test can walk each kind through its states and check the drawing, not a flag.

import * as THREE from 'three';

export const PRESENCE = { height: 0.4, width: 0.4, flat: { width: 1.5, height: 0.3 }, light: 0.2, lightLum: 0.55, glow: 0.5 };

const _box = new THREE.Box3(), _c = new THREE.Color();

/** Drawn: it and every parent up to the root are visible. */
function drawn(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }

/** A material that reads on dark ground: a white contour, a glow, or a pale colour. */
export function lightMaterial(m) {
  const u = m?.uniforms;
  if (!u) return false;
  if (u.uLineWhite?.value) return true;
  const col = u.uColor?.value;
  if (!col) return false;
  _c.copy(col);
  const lum = 0.2126 * _c.r + 0.7152 * _c.g + 0.0722 * _c.b;   // (linear: a pale paper tone is ~0.6+)
  return lum >= PRESENCE.lightLum || (u.uGlow?.value ?? 0) >= PRESENCE.glow;   // (a glowing eye, red or pale, blooms off any ground)
}

/**
 * What of `group` is drawn over the ground at height `groundY`: { height (the tallest point over the
 * ground), width (the widest horizontal extent of what shows above it), light (the widest light part
 * above it) }, all in metres.
 */
export function presenceOf(group, groundY = 0) {
  group.updateMatrixWorld(true);
  const all = new THREE.Box3(), lit = new THREE.Box3();
  group.traverse((o) => {
    if (!o.isMesh || !drawn(o)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    _box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    if (_box.max.y <= groundY + 0.005) return;   // (under the ground, or flat on it)
    _box.min.y = Math.max(_box.min.y, groundY);
    all.union(_box);
    if (lightMaterial(o.material)) lit.union(_box);
  });
  const across = (b) => (b.isEmpty() ? 0 : Math.max(b.max.x - b.min.x, b.max.z - b.min.z, b.max.y - b.min.y));
  return {
    height: all.isEmpty() ? 0 : all.max.y - groundY,
    width: all.isEmpty() ? 0 : Math.max(all.max.x - all.min.x, all.max.z - all.min.z),
    light: across(lit),
  };
}

/** Does this presence pass (PRESENCE)? A list of what is missing (empty: it reads). */
export function presenceProblems(p) {
  const out = [];
  const flat = p.width >= PRESENCE.flat.width && p.height >= PRESENCE.flat.height;   // (a wide flat foe, a surfaced ray, reads by its spread)
  if (p.height < PRESENCE.height && !flat) out.push(`only ${p.height.toFixed(2)} m over the ground`);
  if (p.width < PRESENCE.width) out.push(`only ${p.width.toFixed(2)} m across`);
  if (p.light < PRESENCE.light) out.push(`no light part (${p.light.toFixed(2)} m)`);
  return out;
}

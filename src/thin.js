import * as THREE from 'three';

// Thin bars that never break into a crawl of pixels (materials.js S_THIN, makeMaterial({ thin: px })): a mast's
// struts, its wires and vines, seen from far off, are a fraction of a pixel wide, and such a bar is drawn on one
// frame and missed on the next as it slides under the pixels (docs/systems/rendering.md, "Thin bars at any
// distance"). Each vertex of a bar carries the point of its axis it stands round (aThin: xyz, w 1 on a bar); the
// vertex shader pushes it out from that point wherever the bar would be thinner on screen than `thin` pixels, so
// it stays that wide however far it is, and the haze fades it into the sky as the sheets fade their far masts.
// Built geometry carries its axes when moved (keepThin), merged with what has none (padThin: w 0, left as it is).
// ---------------------------------------------------------------------------

export const THIN_ATTR = 'aThin';
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _d = new THREE.Vector3();

/** Moved (translate, rotate, scale, applyMatrix4), a bar's axis points move with it. */
export function keepThin(g) {
  if (!g.attributes[THIN_ATTR] || g.userData.thinKept) return g;
  const prev = g.applyMatrix4;
  g.applyMatrix4 = function (m) {
    prev.call(this, m);
    const t = this.attributes[THIN_ATTR];
    if (t) { for (let i = 0; i < t.count; i++) { _v.set(t.getX(i), t.getY(i), t.getZ(i)).applyMatrix4(m); t.setXYZ(i, _v.x, _v.y, _v.z); } t.needsUpdate = true; }
    return this;
  };
  g.userData.thinKept = true;
  return g;
}
const set = (g, f) => {
  const P = g.attributes.position, A = new Float32Array(P.count * 4);
  for (let i = 0; i < P.count; i++) { f(i, _a.set(P.getX(i), P.getY(i), P.getZ(i))); A.set([_a.x, _a.y, _a.z, 1], i * 4); }
  g.setAttribute(THIN_ATTR, new THREE.BufferAttribute(A, 4));
  return keepThin(g);
};
/** A straight bar from a to b: each vertex's axis point is the nearest point of the segment. */
export function thinBar(g, a, b) {
  _d.subVectors(b, a); const L2 = Math.max(_d.lengthSq(), 1e-12);
  return set(g, (i, p) => { const t = Math.min(1, Math.max(0, _v.subVectors(p, a).dot(_d) / L2)); p.copy(a).addScaledVector(_d, t); });
}
/** A tube along a curve (THREE.TubeGeometry's layout: rings of radial + 1 vertices, tubular + 1 of them). */
export function thinTube(g, curve, tubular, radial) {
  const C = Array.from({ length: tubular + 1 }, (_, i) => curve.getPointAt(i / tubular));
  return set(g, (i, p) => p.copy(C[Math.min(tubular, Math.floor(i / (radial + 1)))]));
}
/** A torus round the origin in its own plane (THREE.TorusGeometry's layout), its ring R round. */
export function thinRing(g, R, tubular, radial, arc = Math.PI * 2) {
  return set(g, (i, p) => { const u = ((i % (tubular + 1)) / tubular) * arc; p.set(Math.cos(u) * R, Math.sin(u) * R, 0); });
}
/** A vertical pole (a cylinder along y round x = z = 0). */
export const thinPole = (g) => set(g, (i, p) => p.set(0, p.y, 0));

/** A list of geometries to merge: those with no axes get an empty one (w 0: drawn as they are). */
export function padThin(list) {
  if (!list.some((g) => g.attributes[THIN_ATTR])) return list;
  for (const g of list) if (!g.attributes[THIN_ATTR]) g.setAttribute(THIN_ATTR, new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 4), 4));
  return list;
}

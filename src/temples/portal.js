// The makers' doorway: one kit for the way into every house (issue #383).
//
// The fourteen landmark references (references/temples/landmarks-2026-10-14/) draw each house's door the same way:
// a dark opening set deep in the wall, framed two or three times, each frame a step wider and a step nearer than the
// one inside it, on a threshold of its own. The game's houses had a flat dark shape on the facade and a rectangular
// collider behind it, so a round or pointed door drawn in the wall glowed as a rectangle (src/door-light.js fills the
// opening it measures). Here the opening is cut once, in its own shape, and the same outline makes:
//   - the frames (solid, so the light's jambs are the drawn ones), stepping back into the house;
//   - a thin line of light round the innermost frame and along the threshold's edge: the makers' high technology,
//     one colour per house (the house rule: ancient machined geometry, never organic);
//   - the dark at the back, the solid that shuts it, a machined threshold plate;
//   - the door's own shape for its light (`door`: w, h and the heights across, src/thresholds.js openingAt `top`).
//
//   const P = portal(K, { y, z, w, h, shape: 'round', layers: 3, step: 0.8, frame, inlay: '#7fdcca' });
//   return { door: { at, heading, ...P.door } }
//
// Local frame as TempleKit's: +z out of the house; z is the dark's plane, the frames stand in front of it.
import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { T, box } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * The opening's outline grown by g on its sides and top (its foot stays on the sill): points from the foot of the left
 * jamb up over the top to the foot of the right one. Shapes: 'round' (a half circle over straight jambs), 'pointed'
 * (two curves to a point, as the landmarks' arches), 'rect' (machined: its top corners cut), 'oval' (a tall half
 * ellipse over short jambs, the Engine-House's).
 */
export function openingPoints(shape, w, h, g = 0, n = 20) {
  const hw = w / 2 + g, top = h + g, out = [];
  if (shape === 'round') {
    const r = hw, spring = Math.max(0, top - r);
    out.push([-hw, 0], [-hw, spring]);
    for (let i = 1; i < n; i++) { const a = Math.PI - (i / n) * Math.PI; out.push([Math.cos(a) * r, spring + Math.sin(a) * r]); }
    out.push([hw, spring], [hw, 0]);
  } else if (shape === 'oval') {
    const spring = (h * 0.42) + g * 0.4, ry = top - spring;
    out.push([-hw, 0], [-hw, spring]);
    for (let i = 1; i < n; i++) { const a = Math.PI - (i / n) * Math.PI; out.push([Math.cos(a) * hw, spring + Math.sin(a) * ry]); }
    out.push([hw, spring], [hw, 0]);
  } else if (shape === 'pointed') {
    // (landmarks.js arch(): straight to 0.48 of the height, then a quadratic curve to the apex)
    const spring = h * 0.48 + g * 0.5, c = [hw * 0.92, spring + (top - spring) * 0.77];
    out.push([-hw, 0], [-hw, spring]);
    const q = (t, s) => { const u = 1 - t; return [s * (u * u * hw + 2 * u * t * c[0]), u * u * spring + 2 * u * t * c[1] + t * t * top]; };
    for (let i = 1; i < n / 2; i++) out.push(q(i / (n / 2), -1));
    out.push([0, top]);
    for (let i = n / 2 - 1; i >= 1; i--) out.push(q(i / (n / 2), 1));
    out.push([hw, spring], [hw, 0]);
  } else {   // rect, its two top corners cut
    const k = Math.min(w, h) * 0.16 + g * 0.42;
    out.push([-hw, 0], [-hw, top - k], [-hw + k, top], [hw - k, top], [hw, top - k], [hw, 0]);
  }
  return out;
}

/** The heights of the opening across it, `cols + 1` points from its left jamb to its right (openingAt's `top`). */
export function openingTops(shape, w, h, cols = 16) {
  const pts = openingPoints(shape, w, h, 0, 48), tops = [];
  for (let i = 0; i <= cols; i++) {
    const x = (i / cols - 0.5) * w * 0.999;
    let y = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
      if ((x - ax) * (x - bx) <= 0 && ax !== bx) y = Math.max(y, ay + (by - ay) * (x - ax) / (bx - ax));
    }
    tops.push(+y.toFixed(2));
  }
  return tops;
}

/** A band between two outlines (outer grown by `g1`, inner by `g0`), `depth` deep, its front at z. */
function band(shape, w, h, g0, g1, z, depth, foot = 0) {
  const outer = openingPoints(shape, w, h, g1), inner = openingPoints(shape, w, h, g0).reverse();
  const s = new THREE.Shape();
  const pts = [...outer, ...inner].map(([x, y], i, a) => [x, y === 0 && foot ? -foot : y]);
  s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, z - depth);
}

/** A thin tube along an outline at z (an open path: up one jamb, over, down the other). */
function line(points, z, r) {
  const curve = new THREE.CurvePath();
  for (let i = 0; i < points.length - 1; i++) curve.add(new THREE.LineCurve3(V(points[i][0], points[i][1], z), V(points[i + 1][0], points[i + 1][1], z)));
  return new THREE.TubeGeometry(curve, points.length * 2, r, 5, false);
}

/** The light of a house's inlays: flat, lit from within, one material per colour (one batch per house). */
export const inlayMaterial = (color) => makeMaterial({ color, glow: 0.75, flat: true, hatch: 0, key: `temple.portal.inlay.${color}` });

/**
 * Build a house's doorway in K (a TempleKit, local frame).
 * @param o.y        the sill (local)
 * @param o.z        the dark's plane; the frames stand in front of it, and reach `into` behind it into the wall
 * @param o.w, o.h   the opening
 * @param o.shape    'round' | 'pointed' | 'rect' | 'oval'
 * @param o.layers   frames (the innermost the reveal, `back` deep; each further one `step` wider and `recess` nearer)
 * @param o.frame    the frames' material (the house's own stone, ceramic or metal: it batches with the landmark's)
 * @param o.inlay    the light's colour, or a material (a house's own glowing accent)
 * @param o.foot     how far the frames reach down under the sill (onto a lower apron, into the water)
 * @param o.sill     false, or { w, d, t, mat }: the threshold plate in front of the door, its top 7 cm over the sill
 * @param o.dark     false: no dark plane (a house that draws its own)
 * @returns { door: { w, h, top }, outer: { w, h, front } }
 */
export function portal(K, o) {
  const { y = 0, z, w, h, shape = 'round', layers = 2, step = 0.8, recess = 0.6, back = 1.2, into = 1.5, foot = 0,
    frame, inlay = null, sill = {}, dark = true, lineR = 0.07 } = o;
  const front = (i) => z + back + i * recess;   // (frame i's front face)
  for (let i = 0; i < layers; i++) {
    const d = front(i) - (z - into);
    K.both(frame, T(band(shape, w, h, i * step, (i + 1) * step, front(i), d, foot), [0, y, 0]));
  }
  const outerG = layers * step, outerFront = front(layers - 1);
  const light = inlay ? (inlay.isMaterial ? inlay : inlayMaterial(inlay)) : null;
  if (light) {
    // round the innermost frame's face and the outermost's, a hand in from each one's inner edge
    const inset = Math.min(0.22, step * 0.3);
    K.add(light, T(line(openingPoints(shape, w, h, inset), front(0) + 0.03, lineR), [0, y, 0]));
    if (layers > 1) K.add(light, T(line(openingPoints(shape, w, h, (layers - 1) * step + inset), outerFront + 0.03, lineR), [0, y, 0]));
  }
  if (sill) {
    const sw = sill.w ?? w + 2 * outerG, sd = sill.d ?? (outerFront - z) + 1.6, st = sill.t ?? 0.5;
    const z0 = z, z1 = z + sd;
    K.both(sill.mat ?? frame, box(sw, st, z1 - z0, 0, y + 0.07 - st / 2, (z0 + z1) / 2));
    if (light) K.add(light, T(line([[-sw / 2 + 0.3, 0], [sw / 2 - 0.3, 0]], z1 + 0.03, lineR), [0, y + 0.07 - 0.14, 0]));
  }
  if (dark) {
    const s = new THREE.Shape(), pts = openingPoints(shape, w, h, 0.01);
    s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath();
    // (on the threshold plate's top, not through it: the plate's back face lies in the dark's plane)
    K.add(K.M.voidM, new THREE.ShapeGeometry(s, 1).scale(1, (h - (sill ? 0.07 : 0)) / h, 1).translate(0, y + (sill ? 0.07 : 0), z));
    // (shut behind it in its own shape: a block would stand square into the frames over a round head)
    const back = new THREE.Shape(), q = openingPoints(shape, w, h, 0);
    back.moveTo(...q[0]); for (const p of q.slice(1)) back.lineTo(...p); back.closePath();
    K.solid(new THREE.ExtrudeGeometry(back, { depth: 0.3, bevelEnabled: false, curveSegments: 1 }).translate(0, y, z - 0.31));
  }
  return { door: { w, h, top: openingTops(shape, w, h) }, outer: { w: w + 2 * outerG, h: h + outerG, front: outerFront } };
}

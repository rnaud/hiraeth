import * as THREE from 'three';

/**
 * Where a beam aimed at the traveller stops (issue #485, the author: "the targeting laser is going through me vs just
 * stopping at my shield"): the first thing of his it meets. His raised shield, when it would take a blow from the
 * beam's source (P.shieldFace(from), src/fluid-blade.js: the same test as the block, so what you see stop is what is
 * blocked): the beam ends level with the shield's hub. Else his body, an upright cylinder BODY.r round his feet from
 * BODY.foot to BODY.head (along P.frame.up). Neither in the way: `len`.
 * from: the beam's start; dir: its unit direction; len: how long it is at most (m). Returns the length to draw.
 */
export const BODY = { r: 0.3, foot: 0.05, head: 1.8 };
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);

export function beamStop(from, dir, len, P, body = BODY) {
  if (!P?.pos || P.dead) return len;
  const face = P.shieldFace?.(from);
  if (face) {
    const t = _f.subVectors(face, from).dot(dir);
    if (t > 0) return Math.min(len, t);
  }
  return Math.min(len, bodyHit(from, dir, P.pos, P.frame?.up ?? Y, body));
}

/** How far along the ray (from, unit dir) it meets the upright cylinder `body` standing at `pos` (Infinity: never; 0: it starts inside). */
export function bodyHit(from, dir, pos, up = Y, body = BODY) {
  const o = _o.subVectors(from, pos), oy = o.dot(up), dy = dir.dot(up);
  const ox = o.addScaledVector(up, -oy), dx = _d.copy(dir).addScaledVector(up, -dy);
  const a = dx.lengthSq(), b = 2 * ox.dot(dx), c = ox.lengthSq() - body.r * body.r;
  const within = (t) => { const h = oy + dy * t; return h >= body.foot && h <= body.head; };
  if (c <= 0 && within(0)) return 0;
  if (a < 1e-9) return Infinity;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const s = Math.sqrt(disc);
  for (const t of [(-b - s) / (2 * a), (-b + s) / (2 * a)]) if (t >= 0 && within(t)) return t;
  return Infinity;
}

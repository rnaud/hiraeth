import * as THREE from 'three';
import { FURROWS, toGreat } from './spheres-explorations.js';

// ---------------------------------------------------------------------------
// The Garden of Spheres' detours (level design audit v1.59, issue #233): its new country lies on the way (27 of 32
// optional places within 30 m of it). Four places off it, 30-150 m out in the meadow, each a thing to look at with one
// line (src/story/spheres.js, DETOURS in src/story/spheres-data.js):
//   the yellow sphere's cairn   at the head of the furrow the yellow sphere east of the landing ploughed, a cairn
//   the names stone             round the foot of the white monolith past the cracked moon, a ring of small stones
//   the empty arcade            in the android wood, a fallen drum of a column before the arches with nothing behind
//   the lantern at the stone    at the foot of the white monolith north of the landing, a lantern left lit
// Drawn in the world's white stone with the world's batching kit, after everything else (nothing moves). Each is
// { id, name, stand, look } for the story and a sight for the audit.
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Where they are: the yellow sphere's furrow, the monoliths (src/levels/spheres.js monolith), the arcade in the wood. */
export const DETOURS = {
  cairn: { sphere: [250, 60] },
  names: { x: 205, z: -300, w: 4.2 },
  arcade: { x: -122, z: -455, ry: 1.2 },
  lantern: { x: 60, z: 120, w: 3.8 },
};

/** Builds the four with the world's kit `{ add, proxy, M, H, makeMaterial, WHITE_SHADE }`: { sights, detours }. */
export function buildDetours(k) {
  const { add, proxy, M, H } = k, out = { sights: [], detours: [] };
  const solid = (mat, g) => { add(mat, g); proxy(g.clone()); };
  const put = (id, name, stand, look) => { out.detours.push({ id, name, stand, look }); out.sights.push({ name, at: stand.clone() }); };
  const ground = (x, z) => V(x, H(x, z), z);

  // the cairn at the head of the yellow sphere's furrow (the side toward the great sphere it fell from)
  {
    const [sx, sz] = DETOURS.cairn.sphere, f = FURROWS.find((q) => q.x === sx && q.z === sz), d = f.R + 4;
    const side = [-f.dz, f.dx], c = ground(sx + f.dx * d + side[0] * 3.2, sz + f.dz * d + side[1] * 3.2);
    // (rough stones, each set a little off the one under it, a few more round its foot)
    let y = c.y - 0.15;
    for (const [r, h, ox, oz, ry] of [[0.95, 0.5, 0, 0, 0.3], [0.72, 0.42, 0.12, -0.08, 1.4], [0.55, 0.38, -0.1, 0.06, 2.2], [0.4, 0.3, 0.06, 0.1, 0.7], [0.24, 0.26, -0.03, 0, 1.9]]) {
      solid(M.rock, new THREE.DodecahedronGeometry(r, 0).scale(1, h / r, 0.85).rotateY(ry).translate(c.x + ox, y + h * 0.45, c.z + oz));
      y += h * 0.8;
    }
    for (const [a, r, s] of [[0.4, 1.35, 0.32], [2.1, 1.25, 0.26], [3.9, 1.4, 0.3], [5.2, 1.3, 0.22]]) solid(M.rock, new THREE.DodecahedronGeometry(s, 0).scale(1, 0.6, 1).translate(c.x + Math.cos(a) * r, c.y + s * 0.2, c.z + Math.sin(a) * r));
    const stand = ground(sx + f.dx * d + side[0] * 1.4, sz + f.dz * d + side[1] * 1.4);
    put('cairn', 'the cairn at the yellow sphere’s furrow', stand, c.clone().setY(c.y + 1));
  }
  // the ring of small stones round the foot of the monolith past the cracked moon; you stand on the plaza's side
  {
    const T = DETOURS.names, b = H(T.x, T.z) - 0.4, r = T.w + 0.6;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, x = T.x + Math.cos(a) * r, z = T.z + Math.sin(a) * r;
      solid(M.white, new THREE.BoxGeometry(0.7, 0.45, 0.5).rotateY(-a).translate(x, Math.max(b, H(x, z) - 0.25) + 0.22, z));
    }
    const [dx, dz] = toGreat(T.x, T.z), stand = ground(T.x + dx * (r + 1.6), T.z + dz * (r + 1.6));
    put('names', 'the ring of stones at the white monolith', stand, V(T.x + dx * r, stand.y + 0.4, T.z + dz * r));
  }
  // before the arcade in the android wood: a drum of one of its columns, fallen
  {
    const T = DETOURS.arcade, n = [Math.sin(T.ry), Math.cos(T.ry)], along = [Math.cos(T.ry), -Math.sin(T.ry)];
    const c = ground(T.x + n[0] * 4 + along[0] * 2, T.z + n[1] * 4 + along[1] * 2);
    solid(M.white, new THREE.CylinderGeometry(0.85, 0.85, 1.6, 14).rotateZ(Math.PI / 2).rotateY(0.5).translate(c.x, c.y + 0.6, c.z));
    const stand = ground(T.x + n[0] * 6.5, T.z + n[1] * 6.5);
    put('arcade', 'the empty arcade in the android wood', stand, V(T.x, stand.y + 3, T.z));
  }
  // the lantern at the foot of the white monolith north of the landing, toward the landing
  {
    const T = DETOURS.lantern, l = Math.hypot(T.x, T.z), dx = -T.x / l, dz = -T.z / l, c = ground(T.x + dx * (T.w + 0.9), T.z + dz * (T.w + 0.9));
    const glow = k.makeMaterial({ color: '#fff1c2', glow: 0.9, flat: true });
    const S = 1.5;   // (a hand lantern, a little large: seen from the grove)
    solid(M.white, new THREE.BoxGeometry(0.5 * S, 0.12 * S, 0.5 * S).translate(c.x, c.y + 0.06 * S, c.z));
    for (const [ex, ez] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add(M.white, new THREE.BoxGeometry(0.05 * S, 0.5 * S, 0.05 * S).translate(c.x + ex * 0.2 * S, c.y + 0.37 * S, c.z + ez * 0.2 * S));
    add(M.white, new THREE.ConeGeometry(0.36 * S, 0.26 * S, 4).rotateY(Math.PI / 4).translate(c.x, c.y + 0.75 * S, c.z));
    add(M.white, new THREE.TorusGeometry(0.1 * S, 0.02 * S, 4, 10).translate(c.x, c.y + 0.92 * S, c.z));
    add(glow, new THREE.SphereGeometry(0.15 * S, 10, 7).translate(c.x, c.y + 0.36 * S, c.z));
    const stand = ground(T.x + dx * (T.w + 2.6), T.z + dz * (T.w + 2.6));
    put('lantern', 'the lantern at the white stone', stand, c.clone().setY(c.y + 0.4));
  }
  return out;
}

import * as THREE from 'three';

// The world's edge (Player opts.limit: a square, ±limit m on x and z, with nothing drawn there).
// It used to clamp the position and leave the velocity alone, so pushing on made the traveller
// run on the spot, the feet sliding and the body stuttering. Now:
//  - keepInside() takes the outward part of the velocity away where the body meets the edge, so
//    it stops, or slides along it at the speed along it, with no jitter;
//  - EdgePush eases how hard you lean into it (the stick's push outward) and says where you touch;
//  - the traveller turns to face it and leans into it, an arm up against the wind (pose());
//  - the wind's ink wisps stream in from the edge round the traveller (src/wind.js edgeGust);
//  - the first time in a world, a line says what holds you back (EDGE_HINTS, Player opts.edgeHint).

export const EDGE = { press: 0.25, rise: 5, fall: 3, hintAt: 0.6 };

/** What holds you back at each world's edge (shown once, the first time you lean into it). */
export const EDGE_HINTS = {
  desert: 'The desert wind pushes you back.',
  buried: 'The wind off the dunes pushes you back.',
  arzach: 'The wind over the needles pushes you back.',
  arzach2: 'The wind over the clouds pushes you back.',
  edena: 'A warm wind turns you back toward the garden.',
  spheres: 'A warm wind turns you back toward the lake.',
  perdide: 'The swamp’s mist thickens and turns you back.',
  perdide2: 'The swamp’s mist thickens and turns you back.',
  mangrove: 'The mist over the black water thickens and turns you back.',
  waterfall: 'The spray thickens into a wall of white and turns you back.',
  saltharbour: 'The glare off the salt grows blinding and turns you back.',
  bazaar: 'The wind between the towers pushes you back.',
  incal: 'The wind up the shaft pushes you back.',
  atelier: 'The page ends here.',
  lab: 'The Lab ends here.',
  default: 'The wind pushes you back.',
  underwater: 'The water darkens into the deep and turns you back.',
};

/**
 * Keep `pos` within ±L on x and z; where it meets the edge, the outward velocity goes and `n`
 * (if given) gets the inward normal. Returns true if it touched.
 */
export function keepInside(pos, vel, L, n = null) {
  if (!(L < Infinity)) return false;
  let hit = false;
  n?.set(0, 0, 0);
  if (pos.x > L) { pos.x = L; if (vel.x > 0) vel.x = 0; n?.set(-1, 0, n.z); hit = true; }
  else if (pos.x < -L) { pos.x = -L; if (vel.x < 0) vel.x = 0; n?.set(1, 0, n.z); hit = true; }
  if (pos.z > L) { pos.z = L; if (vel.z > 0) vel.z = 0; n?.set(n.x, 0, -1); hit = true; }
  else if (pos.z < -L) { pos.z = -L; if (vel.z < 0) vel.z = 0; n?.set(n.x, 0, 1); hit = true; }
  if (hit) n?.normalize();
  return hit;
}

/** How hard the body leans into the edge, eased (k 0..1), where it touches (at) and its inward normal (n). */
export class EdgePush {
  constructor() { this.k = 0; this.n = new THREE.Vector3(); this.at = new THREE.Vector3(); this.touch = false; this.hinted = false; }

  /**
   * @param touching did the body meet the edge this frame (keepInside), n its inward normal
   * @param move the stick's direction (world, unit or zero)
   */
  update(dt, touching, n, pos, move) {
    this.touch = touching;
    if (touching) { this.n.copy(n); this.at.copy(pos); }
    const press = touching && move ? -move.dot(this.n) : 0;   // into the edge
    const want = press > EDGE.press ? THREE.MathUtils.smoothstep(press, EDGE.press, 0.9) : 0;
    this.k += (want - this.k) * (1 - Math.exp(-(want > this.k ? EDGE.rise : EDGE.fall) * dt));
    if (this.k < 1e-3 && want === 0) this.k = 0;
    return this.k;
  }

  /** The first lean in hard enough: true once (the hint). */
  wantsHint() {
    if (this.hinted || this.k < EDGE.hintAt) return false;
    this.hinted = true;
    return true;
  }

  /**
   * Leaning into the wind (after the clips; scaled down while walking along the edge): the body
   * tips into it, the head ducks, one forearm comes up before the face, the other arm back.
   */
  pose(c, still = 1) {
    const k = this.k * still;
    if (k < 0.01) return;
    const turn = (j, x, y, z) => j?.quaternion.premultiply(_q.setFromEuler(_e.set(x, y, z)));
    turn(c.body, 0.16 * k, 0, 0);
    turn(c.torso, 0.22 * k, 0, 0);
    turn(c.head, 0.12 * k, 0, 0);
    turn(c.arms[1], -1.25 * k, 0, 0.2 * k);
    turn(c.elbows[1], -1.3 * k, 0, 0);
    turn(c.arms[0], 0.35 * k, 0, -0.25 * k);
    turn(c.elbows[0], -0.35 * k, 0, 0);
  }
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler();

/**
 * The ink at the contact point: a patch of short slanted hatch strokes on the edge itself, just
 * in front of the traveller, that fades in as you lean into it and shimmers (each stroke
 * flickers and, when it fades out, comes back somewhere else in the patch). Drawn with the wind's
 * material (src/wind.js: after the composite pass, depth-tested against the G-buffer), so it
 * reads as the same ink as the wisps: `material` is WindStreaks.mesh.material.
 */
export class EdgeInk {
  constructor(material, count = 64) {
    this.count = count;
    this.strokes = Array.from({ length: count }, () => ({ u: 0, v: 0, r: 0, len: 0, ph: Math.random() * 6.3, f: 3 + Math.random() * 4, cyc: -1 }));
    const verts = count * 4;
    this.positions = new Float32Array(verts * 3);
    this.alphas = new Float32Array(verts);
    const index = [];
    for (let i = 0; i < count; i++) { const a = i * 4; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(index);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.time = 0;
  }

  /** edge: the player's EdgePush; up: the way up; pxScale: world size of a pixel a metre away. */
  update(dt, edge, up, camera, pxScale) {
    this.time += dt;
    const k = edge?.k ?? 0;
    this.mesh.visible = k > 0.01;
    if (!this.mesh.visible) return;
    const n = edge.n, t = _t.crossVectors(up, n).normalize();
    // the patch: on the edge, just past the body (the position is held at the edge, the body reaches over it)
    const C = _c.copy(edge.at).addScaledVector(n, -0.55);
    const dir = _d.copy(t).multiplyScalar(0.42).addScaledVector(up, 0.91);   // the hatching's slant
    for (let i = 0; i < this.count; i++) {
      const s = this.strokes[i];
      const w = this.time * s.f + s.ph, cyc = Math.floor(w / (Math.PI * 2));
      if (cyc !== s.cyc) {   // (faded out: back somewhere else in the patch)
        s.cyc = cyc;
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
        s.u = Math.cos(a) * r * 1.5; s.v = 1.15 + Math.sin(a) * r * 1.05; s.len = 0.16 + Math.random() * 0.32; s.r = r;
      }
      const flick = Math.sin(w * 0.5) ** 2;
      const alpha = k * 0.85 * flick * (1 - s.r * s.r * 0.8);
      const P = _p.copy(C).addScaledVector(t, s.u).addScaledVector(up, s.v);
      const A = _a.copy(P).addScaledVector(dir, -s.len / 2), B = _b.copy(P).addScaledVector(dir, s.len / 2);
      const dist = _v.subVectors(camera.position, P).length();
      const S = _s.crossVectors(dir, _v).normalize().multiplyScalar(0.5 * 1.5 * Math.max(dist * pxScale, 0.004));
      const j = i * 12, X = this.positions;
      X[j] = A.x - S.x; X[j + 1] = A.y - S.y; X[j + 2] = A.z - S.z;
      X[j + 3] = A.x + S.x; X[j + 4] = A.y + S.y; X[j + 5] = A.z + S.z;
      X[j + 6] = B.x - S.x; X[j + 7] = B.y - S.y; X[j + 8] = B.z - S.z;
      X[j + 9] = B.x + S.x; X[j + 10] = B.y + S.y; X[j + 11] = B.z + S.z;
      this.alphas.fill(alpha, i * 4, i * 4 + 4);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.aAlpha.needsUpdate = true;
  }
}
const _t = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

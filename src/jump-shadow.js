import * as THREE from 'three';
import { standGround } from './carriers.js';

// The jump's shadow: a small round patch of shade on the ground straight under the traveller
// whenever they are off it (jumping, falling, gliding, on the jets), so a landing can be judged
// even where the sun's shadow falls off to one side, behind or off-screen, and indoors and in caves
// where no sun reaches the floor. Drawn as a shadow is in this game: the G-buffer's light term under
// it taken away (the post pass shades and hatches it), the surface's colour darkened (it reads on
// ground already in shade), and a crisp ring of ink round its edge, as an inker spots a shadow in
// (issue #666: the soft grey patch alone was hard to read on floors in shade). It shrinks with the
// height and is gone by JUMP_SHADOW.far.
//
// Where it lies (issue #666, precise platforming): one ray straight down finds the surface under the
// feet (physics.heightAbove, along the player's up, so the Hangar's turned gravity works), the moving
// floors counted (level.dynamic: a lift, a taxi's roof, a riding disc: src/carriers.js standGround),
// and the patch lies on it, tipped to its slope. Its rim is then checked against the surface, a short
// ray at each of RIM.probes points round it: a point over a drop, a step or anything off the plane
// the centre found is pulled in toward the centre (RIM.tries), so at a ledge's edge the patch is cut
// along the edge instead of hanging out over the drop, darkening the floor far below or the wall
// under the lip. Only under +Y gravity; under a turned gravity the patch is whole.
//
// Standing, nothing (the real shadow is there, and a disc always under the feet reads as a marker,
// not a shadow); just off the ground (a step, a hop of a few centimetres) it grows in from nothing
// over `appear`.

export const JUMP_SHADOW = {
  radius: 0.42,      // m: the patch's radius just off the ground (under the body, a little narrower than the shoulders)
  high: 0.18,        // m: its radius at `far`
  far: 40,           // m up: gone from here on
  appear: [0.15, 0.6],   // m off the ground: it grows in over this
  lift: 0.03,        // m: off the surface along its normal
  dark: 0.5,         // the surface colour inside it, multiplied (it shows on ground already in shade)
  ink: 0.2,          // the surface colour under its ring, multiplied: the ink of its edge
  ring: 0.1,         // its ring's width, a share of its radius
};

/** The rim's check against the surface: probes round it, the shares of the radius tried in turn, the height off the centre's plane allowed (m). */
export const RIM = { probes: 16, segments: 32, tries: [1, 0.66, 0.36], tol: 0.12 };

/** The patch for a height `h` (m) above the ground: its radius (m, 0 = none). */
export function jumpShadowRadius(h) {
  const S = JUMP_SHADOW;
  if (!(h > S.appear[0]) || h >= S.far) return 0;
  const grow = THREE.MathUtils.smoothstep(h, S.appear[0], S.appear[1]);
  const shrink = THREE.MathUtils.lerp(S.radius, S.high, Math.sqrt(h / S.far));
  const end = 1 - THREE.MathUtils.smoothstep(h, S.far * 0.75, S.far);   // the last stretch: it shrinks away
  return shrink * grow * end;
}

/** Off the ground in a way that wants the patch: jumping, falling, gliding, the jets (not riding, swimming, climbing or lying knocked down). */
export function wantsJumpShadow(p) {
  return !p.onGround && !p.ride && !p.swim && !p.climbing && !p.mantle && !p.down && !p.boarding && p.object?.visible !== false;
}

/**
 * How far out the patch reaches toward each of `probes` directions round centre `c` (a share of its radius `r`, 0..1),
 * on the plane through c with normal n: `groundAt(x, fromY, z, maxDrop)` asked at each point from `fromY`; a point whose
 * surface is more than `tol` off the plane (a drop, a step up or down, a railing over it) is tried again nearer, at each
 * of `tries`, and is 0 when none holds. Into `out` (a Float32Array of probes). Rays: at most probes × tries.length.
 */
export function rimReach(groundAt, c, n, r, fromY, out, { probes = RIM.probes, tries = RIM.tries, tol = RIM.tol } = {}) {
  const ny = Math.max(n.y, 0.3);
  for (let k = 0; k < probes; k++) {
    const a = (k / probes) * Math.PI * 2, dx = Math.cos(a), dz = -Math.sin(a);
    let reach = 0;
    for (const f of tries) {
      const x = c.x + dx * r * f, z = c.z + dz * r * f;
      const want = c.y - (n.x * (x - c.x) + n.z * (z - c.z)) / ny;   // (the plane's height there)
      const y = groundAt(x, fromY, z, fromY - want + tol + 0.5);
      if (Math.abs(y - want) <= tol) { reach = f; break; }
    }
    out[k] = reach;
  }
  return out;
}

/** The patch's mesh: a fan, its centre and `segments` rim points round a unit circle flat on y = 0 (facing +y). */
function fanGeometry(segments) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array((segments + 1) * 3);
  const idx = [];
  for (let k = 0; k < segments; k++) idx.push(0, 1 + k, 1 + ((k + 1) % segments));   // (counter-clockwise seen from +y)
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  setRim(g, null, segments);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
  return g;
}

/** Rim point k of the fan at reach[k / 2] (each odd point the nearer of its two probes'), or whole when reach is null. */
function setRim(g, reach, segments) {
  const p = g.attributes.position.array, probes = reach?.length ?? 0, step = probes ? segments / probes : 1;
  for (let k = 0; k < segments; k++) {
    const a = (k / segments) * Math.PI * 2;
    let f = 1;
    if (probes) {
      const i = k / step, lo = Math.floor(i) % probes, hi = Math.ceil(i) % probes;
      f = Math.min(reach[lo], reach[hi]);
    }
    p[3 * (k + 1)] = Math.cos(a) * f; p[3 * (k + 1) + 1] = 0; p[3 * (k + 1) + 2] = -Math.sin(a) * f;
  }
  g.attributes.position.needsUpdate = true;
}

const _q = new THREE.Quaternion(), _n = new THREE.Vector3(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

export class JumpShadow {
  constructor(scene, { segments = RIM.segments } = {}) {
    this.segments = segments;
    const g = fanGeometry(segments);
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uDark: { value: JUMP_SHADOW.dark }, uInk: { value: JUMP_SHADOW.ink }, uRing: { value: JUMP_SHADOW.ring } },
      vertexShader: `out vec2 vR; void main() { vR = position.xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
      // multiplied into the G-buffer (like the footprints, src/life.js): colour by uDark inside and by uInk in the ring
      // round its edge (vR: the unit circle's point, its rim at 1), the light term by 0 (shade); normals, depth and
      // the surface flags left as they are
      fragmentShader: `precision highp float; uniform float uDark; uniform float uInk; uniform float uRing; in vec2 vR;
        layout(location = 0) out highp vec4 gAlbedoLight;
        layout(location = 1) out highp vec4 gNormalDepth;
        layout(location = 2) out highp vec4 gHatch;
        void main() {
          float d = length(vR), w = fwidth(d);
          float ring = smoothstep(1.0 - uRing - w, 1.0 - uRing, d);
          gAlbedoLight = vec4(vec3(mix(uDark, uInk, ring)), 0.0);
          gNormalDepth = vec4(1.0);
          gHatch = vec4(1.0);
        }`,
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
      blendSrcAlpha: THREE.DstAlphaFactor, blendDstAlpha: THREE.ZeroFactor,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.name = 'jump shadow';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
    this.mesh.userData.noCollide = true;
    this.mesh.userData.castShadow = false;
    this.height = Infinity;   // the last height found (m)
    this.reach = new Float32Array(RIM.probes);   // how far out it reaches toward each probe (rimReach), 1 = whole
    this._last = new Float32Array(RIM.probes).fill(1);   // what the mesh's rim was last set to (rewritten only when it moves)
    this._ground = null;
    scene.add(this.mesh);
  }

  /** The ground the patch asks: the level's, its moving floors counted (src/carriers.js standGround). */
  ground(player, physics) {
    const G = this._ground;
    if (G && G.physics === physics && G.player === player) return G.q;
    const q = player.opts?.dynamic ? standGround(physics, player.opts.dynamic, () => player.ride) : physics;
    this._ground = { physics, player, q };
    return q;
  }

  /**
   * Per frame, after the player has moved: under them if they are off the ground.
   * `physics`: heightAbove(pos, up, step), groundNormal(x, fromY, z), groundAt(x, fromY, z, maxDrop) (level ground only).
   * Its rays leave the physics' last ground query as they found it (groundMover, groundKind: the player's).
   */
  update(player, physics) {
    const M = this.mesh;
    if (!wantsJumpShadow(player)) { M.visible = false; return; }
    const gm = physics.groundMover, gk = physics.groundKind, gb = physics.groundBase;
    try { this.place(player, this.ground(player, physics)); }
    finally { physics.groundMover = gm; physics.groundKind = gk; physics.groundBase = gb; }
  }

  place(player, G) {
    const M = this.mesh;
    const U = player.frame?.up ?? _y;
    const h = G.heightAbove(player.pos, U, 0.05);
    this.height = h;
    const r = Number.isFinite(h) ? jumpShadowRadius(h) : 0;
    if (r < 0.02) { M.visible = false; return; }
    _p.copy(player.pos).addScaledVector(U, -h);
    const level = U.y > 0.999;
    // the surface's slope (the heightfield's or the mesh's under it), else flat to up
    if (level && G.groundNormal) G.groundNormal(_p.x, _p.y + 0.05, _p.z, _n);
    else _n.copy(U);
    if (_n.dot(U) < 0.3) _n.copy(U);   // (a wall's edge: lie flat rather than stand up)
    // its rim on the surface: cut back where it would hang over a drop (only under +Y: the rays are straight down)
    if (level && G.groundAt) rimReach(G.groundAt.bind(G), _p, _n, r, player.pos.y + 0.05, this.reach);
    else this.reach.fill(1);
    if (!this.reach.some((f) => f > 0)) { M.visible = false; return; }
    let moved = false;
    for (let k = 0; k < this.reach.length; k++) if (this.reach[k] !== this._last[k]) { moved = true; this._last[k] = this.reach[k]; }
    if (moved) setRim(M.geometry, this._last.every((f) => f === 1) ? null : this._last, this.segments);
    M.position.copy(_p).addScaledVector(_n, JUMP_SHADOW.lift);
    M.quaternion.copy(_q.setFromUnitVectors(_y, _n));
    M.scale.copy(_s.set(r, 1, r));
    M.visible = true;
  }

  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

import * as THREE from 'three';

// The jump's shadow: a small round patch of shade on the ground straight under the traveller
// whenever they are off it (jumping, falling, gliding, on the jets), so a landing can be judged
// even where the sun's shadow falls off to one side, behind or off-screen. Drawn as a shadow is
// in this game: the G-buffer's light term under it is taken away (the post pass shades and
// hatches it, and inks its edge like any shadow's), the surface's colour a little darker too, so
// it reads on ground already in shade. It shrinks with the height and is gone by JUMP_SHADOW.far.
// One downward ray a frame finds the surface (physics.heightAbove, along the player's up, so the
// Hangar's turned gravity works), and the patch lies on it, tipped to its slope.
//
// Standing, nothing (the real shadow is there); just off the ground (a step, a hop of a few
// centimetres) it grows in from nothing over `appear`.

export const JUMP_SHADOW = {
  radius: 0.42,      // m: the patch's radius just off the ground (under the body, a little narrower than the shoulders)
  high: 0.18,        // m: its radius at `far`
  far: 40,           // m up: gone from here on
  appear: [0.15, 0.6],   // m off the ground: it grows in over this
  lift: 0.03,        // m: off the surface along its normal
  dark: 0.75,        // the surface colour under it, multiplied (it shows on ground already in shade)
};

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

const _q = new THREE.Quaternion(), _n = new THREE.Vector3(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

export class JumpShadow {
  constructor(scene, { segments = 28 } = {}) {
    const g = new THREE.CircleGeometry(1, segments);
    g.rotateX(-Math.PI / 2);   // flat on the ground, facing up (+y)
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uDark: { value: JUMP_SHADOW.dark } },
      vertexShader: `void main() { gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
      // multiplied into the G-buffer (like the footprints, src/life.js): colour by uDark, the light
      // term by 0 (shade); normals, depth and the surface flags left as they are
      fragmentShader: `precision highp float; uniform float uDark;
        layout(location = 0) out highp vec4 gAlbedoLight;
        layout(location = 1) out highp vec4 gNormalDepth;
        layout(location = 2) out highp vec4 gHatch;
        void main() {
          gAlbedoLight = vec4(vec3(uDark), 0.0);
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
    scene.add(this.mesh);
  }

  /**
   * Per frame, after the player has moved: under them if they are off the ground.
   * `physics`: heightAbove(pos, up, step), groundNormal(x, fromY, z) (level ground only).
   */
  update(player, physics) {
    const M = this.mesh;
    if (!wantsJumpShadow(player)) { M.visible = false; return; }
    const U = player.frame?.up ?? _y;
    const h = physics.heightAbove(player.pos, U, 0.05);
    this.height = h;
    const r = Number.isFinite(h) ? jumpShadowRadius(h) : 0;
    if (r < 0.02) { M.visible = false; return; }
    _p.copy(player.pos).addScaledVector(U, -h);
    // the surface's slope (the heightfield's or the mesh's under it), else flat to up
    if (U.y > 0.999 && physics.groundNormal) physics.groundNormal(_p.x, _p.y + 0.3, _p.z, _n);
    else _n.copy(U);
    if (_n.dot(U) < 0.3) _n.copy(U);   // (a wall's edge: lie flat rather than stand up)
    M.position.copy(_p).addScaledVector(_n, JUMP_SHADOW.lift);
    M.quaternion.copy(_q.setFromUnitVectors(_y, _n));
    M.scale.copy(_s.set(r, 1, r));
    M.visible = true;
  }

  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

import * as THREE from 'three';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// The render targets and the last steps of the game's pipeline, shared by the
// game (main.js) and the character studio (studio.html, src/studio/), so the
// studio draws people exactly as the game does:
//   1. shadow maps (shadows.js cascades)
//   2. the G-buffer: every surface writes albedo + light, normal + depth and
//      its hatching / drawn detail (materials.js)
//   3. the ink composite (post.js) into composeRT
//   4. FXAA, scaled to the display (the blit)

/** G-buffer: [0] albedo + light, [1] normal + view depth, [2] surface hatching. */
export function createGBuffer() {
  return new THREE.WebGLRenderTarget(1, 1, {
    count: 3,
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });
}

/** The composited frame, before FXAA (linear: the blit scales it to the display). */
export function createComposeTarget() {
  return new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
}

/** Smooth the final colour with FXAA and scale it to the display. */
export function createBlit(texture) {
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
    vertexShader: FXAAShader.vertexShader,
    fragmentShader: FXAAShader.fragmentShader,
    depthTest: false, depthWrite: false,
  });
  material.uniforms.tDiffuse.value = texture;
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  return { scene, material };
}

const _subj = new THREE.Vector3();
/**
 * post.js uSubject: the subject (the player in the game, the person in the studio) on screen:
 * uv, view depth and radius. Its projected size decides how much fine ink detail stays.
 * `at` is the subject's feet, `up` its up; hidden: no subject.
 */
export function setSubject(U, camera, at, up, hidden = false) {
  _subj.copy(at).addScaledVector(up, 0.95).applyMatrix4(camera.matrixWorldInverse);
  const sdep = -_subj.z;
  if (sdep > 0.5 && !hidden) {
    _subj.applyMatrix4(camera.projectionMatrix);
    U.uSubject.value.set(_subj.x * 0.5 + 0.5, _subj.y * 0.5 + 0.5, sdep, 1.35 * U.uProj11.value / (2 * sdep));
  } else U.uSubject.value.w = -1;
}

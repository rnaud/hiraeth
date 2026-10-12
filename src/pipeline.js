import * as THREE from 'three';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// The render targets and the last steps of the game's pipeline, shared by the
// game (main.js) and the character studio (studio.html, src/studio/), so the
// studio draws people exactly as the game does:
//   1. shadow maps (shadows.js cascades)
//   2. the G-buffer: every surface writes albedo + light, normal + depth and
//      its hatching / drawn detail (materials.js)
//   3. the ink composite (post.js) into composeRT
//   4. FXAA, scaled to the display (the blit); SMAA instead on a preset that asks for it (aa: 'smaa', the handheld)

/**
 * G-buffer: [0] albedo + light, [1] normal + view depth, [2] surface hatching. depthTexture: its depth buffer
 * readable (the water's contact foam reads the scene's depth at full precision: water.js renderGBuffer).
 */
export function createGBuffer({ depthTexture = false } = {}) {
  return new THREE.WebGLRenderTarget(1, 1, {
    count: 3,
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    ...(depthTexture ? { depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType) } : {}),
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

/** The last pass's antialiasing for a graphics preset (perf.js QUALITY_PRESETS `aa`): 'fxaa' unless it says otherwise. */
export const aaOf = (preset) => (preset?.aa === 'smaa' ? 'smaa' : 'fxaa');

/**
 * SMAA in place of the blit (docs/systems/rendering.md, "Far lines that would alias"): its edges and blend weights at
 * the render size, the blend drawn straight to the canvas (sampling the linear-filtered frame, it scales as it blends:
 * no extra pass). Sharper on the ink than FXAA (it blends along the edges it finds, not across every contrast).
 */
export function createSmaa() {
  const pass = new SMAAPass();
  pass.renderToScreen = true;
  pass.clear = true;   // (the edges pass discards where there are none: its target cleared each frame)
  // (8 bits are what SMAA's edges and weights need: half the bandwidth of the pass's own half floats, on a handheld)
  for (const rt of [pass._edgesRT, pass._weightsRT]) if (rt) rt.texture.type = THREE.UnsignedByteType;
  return {
    pass,
    setSize: (w, h) => pass.setSize(w, h),
    render: (renderer, source) => pass.render(renderer, null, source),
    dispose: () => pass.dispose(),
  };
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

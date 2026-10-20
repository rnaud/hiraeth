// The same four passes as the game and character studio. This standalone review creates no world, sound or save.
import * as THREE from 'three';
import { sharedUniforms as SU, setEnvGround } from '../src/materials.js';
import { createPost, PRESETS } from '../src/post.js';
import { createGBuffer, createComposeTarget, createBlit, setSubject } from '../src/pipeline.js';
import { Cascade, shadowDirection } from '../src/shadows.js';
import { applyTimeOfDay, colourScript } from '../src/timeofday.js';
import { DESERT_WORLD_LOOK, DESERT_CLOUD_SHADOWS } from '../src/desert-sites.js';
import { DESERT_SKY } from '../src/minigames/kit/world.js';

export function createCaravanInkRenderer({ canvas, scene, camera, subject }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.autoClear = false;
  const gbuffer = createGBuffer(), compose = createComposeTarget(), post = createPost(), U = post.uniforms;
  const blit = createBlit(compose.texture);
  U.tAlbedo.value = gbuffer.textures[0]; U.tNormal.value = gbuffer.textures[1]; U.tHatch.value = gbuffer.textures[2];
  for (const [key, value] of Object.entries({ ...PRESETS['Moebius print'], ...DESERT_WORLD_LOOK })) if (U[key]) U[key].value = value;
  applyTimeOfDay(9.5, SU.uSunDir.value, U, null, colourScript(DESERT_SKY.script));
  SU.uCloudShadows.value = DESERT_CLOUD_SHADOWS;
  SU.uShadowTaps.value = 9;
  setEnvGround('#e1bca4');
  const cascades = [
    new Cascade({ name: 'fine', size: 2048, extent: 12, depth: 1600, bias: 3.4, offset: 2.6, uniforms: { map: SU.uShadowMap0, matrix: SU.uShadowMatrix0, bias: SU.uShadowBias0, offset: SU.uShadowNormalOffset0, texel: [SU.uShadowTexel, 0] } }),
    new Cascade({ name: 'near', size: 4096, extent: 220, depth: 1600, bias: 2.3, offset: 3.2, uniforms: { map: SU.uShadowMap, matrix: SU.uShadowMatrix, bias: SU.uShadowBias, offset: SU.uShadowNormalOffset, texel: [SU.uShadowTexel, 1] } }),
    new Cascade({ name: 'far', size: 256, extent: 1150, depth: 3200, bias: 2.2, offset: 2.4, uniforms: { map: SU.uShadowMap2, matrix: SU.uShadowMatrix2, bias: SU.uShadowBias2, offset: SU.uShadowNormalOffset2, texel: [SU.uShadowTexel, 2] } }),
  ];
  for (const cascade of cascades) cascade.prime(renderer);
  cascades[2].disable();
  const shadowOverride = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
  const sun = new THREE.Vector3(), centre = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3(0, 1, 0);
  function resize(width, height, pixelRatio = Math.min(devicePixelRatio, 2)) {
    const rw = Math.max(1, Math.floor(width * pixelRatio)), rh = Math.max(1, Math.floor(height * pixelRatio));
    renderer.setPixelRatio(1); renderer.setSize(rw, rh, false);
    gbuffer.setSize(rw, rh); compose.setSize(rw, rh);
    blit.material.uniforms.resolution.value.set(1 / rw, 1 / rh);
    U.uRes.value.set(rw, rh); U.uPixelRatio.value = pixelRatio; SU.uPixelRatio.value = pixelRatio; SU.uViewH.value = rh;
  }
  function render() {
    scene.updateMatrixWorld(); camera.updateMatrixWorld();
    shadowDirection(SU.uSunDir.value, sun);
    scene.overrideMaterial = shadowOverride;
    try {
      // Shadows update on every frame, including every camp deployment frame.
      for (const cascade of cascades) if (cascade.enabled) { cascade.aim(sun); cascade.place(subject.position); cascade.render(renderer, scene); }
    } finally { scene.overrideMaterial = null; }
    renderer.setRenderTarget(gbuffer); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    U.uInvProj.value.copy(camera.projectionMatrixInverse); U.uCamWorld.value.copy(camera.matrixWorld); U.uProj11.value = camera.projectionMatrix.elements[5];
    setSubject(U, camera, subject.position ?? centre, up, !subject.visible);
    renderer.setRenderTarget(compose); renderer.clear(); renderer.render(post.scene, post.camera);
    renderer.setRenderTarget(null); renderer.render(blit.scene, post.camera);
  }
  return { renderer, render, resize, gbuffer, post, cascades };
}

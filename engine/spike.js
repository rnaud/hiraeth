// The spike (stage 1 of docs/systems/engine-bridge.md): a world built by the game's own code inside
// the engine's VM, mirrored to the engine's nodes, one frame drawn. No player yet: a camera where
// the desert's opening shot stands.
import { page } from './boot.js';
import * as THREE from 'three';
import { levelById } from '../src/levels/index.js';
import { sharedUniforms } from '../src/materials.js';
import { SceneMirror } from './mirror.js';

export { page };

/**
 * Build `levelId` and mirror it once. Returns { scene, camera, mirror, level, ms }.
 * @param o.backend   the engine's side of the mirror (engine/mirror.js)
 * @param o.eye, o.target  the camera (defaults: behind the level's spawn, looking along its heading)
 */
export function buildSpike({ levelId = 'desert', backend, eye = null, target = null, width = 1280, height = 720 } = {}) {
  const t0 = performance.now();
  const meta = levelById(levelId);
  const scene = new THREE.Scene();
  const level = meta.create(scene);
  const tBuild = performance.now() - t0;
  const spawn = level.spawn ?? new THREE.Vector3();
  const h = level.spawnHeading ?? 0;
  const ground = (x, z) => level.ground?.heightAt?.(x, z) ?? spawn.y;
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.3, 5000);
  const tgt = target ? new THREE.Vector3(...target) : new THREE.Vector3(spawn.x + Math.sin(h) * 40, 0, spawn.z + Math.cos(h) * 40);
  if (!target) tgt.y = ground(tgt.x, tgt.z) + 2;
  const at = eye ? new THREE.Vector3(...eye) : new THREE.Vector3(spawn.x - Math.sin(h) * 9, 0, spawn.z - Math.cos(h) * 9);
  if (!eye) at.y = ground(at.x, at.z) + 4.5;
  camera.position.copy(at);
  camera.lookAt(tgt);
  const mirror = new SceneMirror(backend);
  const t1 = performance.now();
  const stats = mirror.sync(scene, camera);
  backend.sun?.({ dir: sharedUniforms.uSunDir.value.toArray(), hour: level.defaults?.hour ?? 10 });
  return { scene, camera, mirror, level, stats, ms: { build: tBuild, mirror: performance.now() - t1 } };
}

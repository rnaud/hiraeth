// Shaders compiled before the first frame, a slice at a time (docs/systems/performance.md, "Loading"): the
// loading screen's (src/main.js) and the title's world (src/title-world.js).
//
// compile() for a whole scene at once built every program's source and key in one task (100-500 ms, far
// longer on a handheld), and compileAsync's promise then ran the first frame, whose first use of each program
// asks the GPU process for its uniforms and log: a wait on everything queued, 0.5-7 s in one task on the title
// (it froze the menu). Here one object stands for each kind of program (its material, and what of the mesh
// goes into the key: instanced, skinned, points or lines, its optional attributes), compiled between yields;
// then the wait for the driver, polled; then each program's first use, a slice at a time (firstUse).

import * as THREE from 'three';

/** What of a mesh and its material goes into a program's key. */
export const programKind = (o, m) => `${m.id}|${o.isInstancedMesh ? 1 : 0}${o.instanceColor ? 1 : 0}${o.isSkinnedMesh ? 1 : 0}${o.isBatchedMesh ? 1 : 0}${o.isPoints ? 1 : 0}${o.isLine ? 1 : 0}${o.isSprite ? 1 : 0}|${Object.keys(o.geometry?.morphAttributes ?? {}).length}|${['color', 'uv1', 'uv2', 'uv3', 'tangent'].map((a) => (o.geometry?.attributes?.[a] ? 1 : 0)).join('')}`;

// (the scene a program's key is taken from: no lights, fog or environment, as the worlds' own; an empty one,
// so each compile doesn't walk the whole world looking for lights)
const keyScene = new THREE.Scene();

/**
 * Compile the programs `targetScene` draws with, one kind at a time, with `target` (the render target the pass
 * really draws into: a program's key includes the output colour space) bound. `wear`: a material every mesh
 * wears for the pass (the shadow maps' depth-only one). Then waits up to `wait` ms for the driver
 * (KHR_parallel_shader_compile), polling. slice: a slicer (src/load-steps.js); pace: a gpuPacer, or nothing.
 * Returns how many kinds it compiled.
 */
export async function warmShadersSliced(renderer, targetScene, targetCamera, { target = null, wear = null, slice, pace = null, wait = 2000 } = {}) {
  const reps = new Map();
  targetScene.traverse((o) => {
    if (!o.material || !(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
    for (const m of [wear ?? o.material].flat()) { const k = programKind(o, m); if (!reps.has(k)) reps.set(k, o); }
  });
  const prev = renderer.getRenderTarget(), mats = new Set();
  try {
    for (const o of reps.values()) {
      const own = o.material;
      if (wear) o.material = wear;
      try {
        renderer.setRenderTarget(target);
        for (const m of renderer.compile(o, targetCamera, keyScene)) mats.add(m);
      } finally { if (wear) o.material = own; renderer.setRenderTarget(prev); }
      await slice();
      await pace?.();   // (one compile queued at a time: the GPU process keeps up, the page keeps painting)
    }
  } finally { renderer.setRenderTarget(prev); }
  // the driver compiles in parallel (KHR_parallel_shader_compile): wait for it a while, yielding
  await settle(renderer, mats, wait);
  return reps.size;
}

/** Wait (polling, never blocking) until the materials' programs are compiled, or `wait` ms. */
export async function settle(renderer, mats, wait = 2000) {
  const pending = () => [...mats].filter((m) => { const p = renderer.properties.get(m).currentProgram; return p && !p.isReady(); }).length;
  const t0 = performance.now();
  while (pending() && performance.now() - t0 < wait) await new Promise((r) => setTimeout(r, 10));
}

/**
 * Each program's first use now, a slice at a time: it asks the GPU process for the program's uniforms and log,
 * a wait on everything queued, which the first frame would otherwise do for every program in one task.
 * Each waits (polling, `wait` ms at most) until the driver says its program is linked (isReady:
 * KHR_parallel_shader_compile): asked before, the query blocks the page until it is. On the Xbox (ANGLE on D3D11,
 * a second or more for each program, compiled two at a time) that was the menu frozen 0.6-4 s at a time, for a
 * minute (docs/systems/xbox.md, "The 100-second title").
 */
export async function firstUse(renderer, slice, { wait = 60000 } = {}) {
  for (const p of renderer.info.programs) {
    const t0 = performance.now();
    while (p.isReady && !p.isReady() && performance.now() - t0 < wait) await new Promise((r) => setTimeout(r, 10));
    p.getUniforms?.(); await slice();
  }
}

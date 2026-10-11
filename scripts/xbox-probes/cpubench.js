// The same JavaScript timed on the console and on the Mac (docs/systems/xbox.md, "Why 20 fps"): plain math, the
// game's own scene walked and culled the way three.js does each frame. Best of five each, ms.
// Run: node scripts/xbox-devtools.mjs js @scripts/xbox-probes/cpubench.js (or evaluate it in Chrome on the Mac)
(() => {
  const { THREE, scene, camera } = window;
  const best = (f, n = 5) => { let b = Infinity; for (let i = 0; i < n; i++) { const t = performance.now(); f(); b = Math.min(b, performance.now() - t); } return +b.toFixed(2); };
  const a = new THREE.Matrix4().makeRotationY(0.3), b = new THREE.Matrix4().makeTranslation(1, 2, 3), c = new THREE.Matrix4();
  const mat = best(() => { for (let i = 0; i < 1e6; i++) c.multiplyMatrices(a, b); });
  let objs = 0; scene.traverse(() => objs++);
  const upd = best(() => scene.updateMatrixWorld(true));
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const meshes = []; scene.traverse((o) => { if (o.isMesh && o.geometry) meshes.push(o); });
  const cull = best(() => { let n = 0; for (const m of meshes) if (fr.intersectsObject(m)) n++; return n; });
  const arr = best(() => { const x = []; for (let i = 0; i < 3e5; i++) x.push({ i, v: i * 0.5 }); x.sort((p, q) => q.v - p.v); });
  const loop = best(() => { let s = 0; for (let i = 0; i < 1e7; i++) s = ((s + i * 7) ^ (s >>> 3)) | 0; window.__s = s; });
  return { mat4x1e6: mat, objs, updateMatrixWorld: upd, meshes: meshes.length, frustumAll: cull, objSort3e5: arr, intLoop1e7: loop };
})()

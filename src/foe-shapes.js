import { sameShape } from './part-batch.js';

// ---------------------------------------------------------------------------
// A foe's shapes shared by every foe of its kind and skin (issue #468, docs/systems/performance.md "Stutters"). Each
// body builder (src/enemies/plans/) makes its geometries afresh, so two brutes carried two copies of the same 2.7 MB:
// on the web two uploads to the GPU, in the Unity players two meshes made from the bytes sent (a brute and a swarm
// of skitters came to 14 MB in one frame, 100 ms of the Mac player's main thread). The first foe of a kind and skin
// keeps its geometries in the cache; every later one, mesh by mesh in the same order, takes the cached geometry
// where it holds the same shape (part-batch.js sameShape: value for value, so a builder that draws at random keeps
// its own) and lets its own go. A shared geometry is marked (userData.foeShared) and outlives the foes that draw it:
// it goes with the cache (Foes.dispose), never with a foe.
//
//   shareShapes(cache, key, root) → { shared, kept }   the meshes under root given the cache's geometry, or kept
//   disposeOwnShapes(root)                             a foe's own geometries let go (the shared ones stay)
//   disposeShapes(cache)                               every shared geometry let go, the cache emptied
// ---------------------------------------------------------------------------

/**
 * Geometries that may be shared: not rewritten as the foe moves (a dynamic attribute is written each frame), and none of
 * their own per instance (those are the foe's, as an InstancedMesh's matrices are the mesh's).
 */
const shareable = (g) => !!g?.attributes?.position && !g.userData?.noShare && !g.isInstancedBufferGeometry
  && !Object.values(g.attributes).some((a) => a.usage === 35048 /* THREE.DynamicDrawUsage */ || a.isInstancedBufferAttribute);

/** The meshes of a body, in the order a builder makes them. */
function meshesOf(root) {
  const out = [];
  root.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine) && o.geometry) out.push(o); });
  return out;
}

/**
 * The meshes under root given the geometries the first body of `key` (its kind and skin) kept, where they are the same
 * shape; that first body's own become the cache's. Returns how many meshes took a shared geometry and how many kept
 * their own.
 */
export function shareShapes(cache, key, root) {
  const meshes = meshesOf(root);
  const known = cache.get(key);
  if (!known) {
    const list = meshes.map((m) => (shareable(m.geometry) ? m.geometry : null));
    for (const g of list) if (g) g.userData.foeShared = true;
    cache.set(key, list);
    return { shared: 0, kept: meshes.length };
  }
  let shared = 0, kept = 0;
  // (the same geometry drawn by two meshes of one body, swapped once)
  const swapped = new Map();
  meshes.forEach((m, i) => {
    const own = m.geometry, g = swapped.get(own) ?? (known.length === meshes.length ? known[i] : null);
    if (g && g !== own && (swapped.has(own) || (shareable(own) && sameShape(own, g)))) {
      swapped.set(own, g);
      m.geometry = g;
      shared++;
    } else kept++;
  });
  // (its own let go once no mesh of it draws them)
  const still = new Set(meshes.map((m) => m.geometry));
  for (const own of swapped.keys()) if (!still.has(own)) own.dispose();
  return { shared, kept };
}

/** A foe's own geometries let go (the ones it shares stay for the next of its kind). */
export function disposeOwnShapes(root) {
  root?.traverse((o) => { if (o.geometry && !o.geometry.userData?.foeShared) o.geometry.dispose(); });
}

/** Every shared geometry let go, and the cache emptied (the foes' world unloaded). */
export function disposeShapes(cache) {
  for (const list of cache.values()) for (const g of list) if (g) { g.userData.foeShared = false; g.dispose(); }
  cache.clear();
}

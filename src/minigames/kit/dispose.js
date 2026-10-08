// What a game's session made for one run (its skis, its sprays, its fish, a drop's thermals) taken out of
// the scene and its GPU buffers let go, so a Retry (a new session) does not pile them up
// (tests/minigames-qa.test.js). Only the geometry: the materials are the game's cached ones
// (makeMaterial's `key`), and a geometry still shared elsewhere is simply uploaded again when next drawn.
//
//   import { disposeTree } from './kit/dispose.js';   end() { disposeTree(skis, spray.mesh); }

/** Each object out of its parent, the geometries under it (and an instanced mesh's own buffers) disposed. */
export function disposeTree(...objects) {
  for (const o of objects) {
    if (!o) continue;
    o.removeFromParent?.();
    o.traverse?.((m) => {
      m.geometry?.dispose?.();
      if (m.isInstancedMesh) m.dispose?.();
    });
  }
}

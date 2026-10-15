import * as THREE from 'three';
import { sceneList } from '../engine/scene-matrices.js';

// Instanced meshes with nothing to draw, left out of a frame's passes (issue #111, the Steam Deck's main thread).
//
// The world keeps pools of instanced meshes for things that come and go (the gadgets' effects, the fluid's splashes,
// the chimes, a world's responsive bits): most of the time they hold no instance (count 0), but three still takes each
// through a whole draw in every pass (its program, its material's uniforms, its buffers, a drawElementsInstanced of
// nothing): 12-17 such draws in each G-buffer pass in the City-Shaft and the Signal Market, most in materials of their
// own. renderFrame hides them with the frame's culled things (frameHidden) and shows them again after the passes, so
// nothing is drawn differently: an instanced draw of no instances draws nothing.
//
// Left alone: a mesh with an onBeforeRender of its own (it might fill itself there) or with children (hiding it would
// hide them).

const plainBefore = THREE.Object3D.prototype.onBeforeRender;
/** Could this object be one: an instanced mesh with no hook of its own and no children? */
export const emptyCandidate = (o) => !!o.isInstancedMesh && o.onBeforeRender === plainBefore && o.children.length === 0;

export class EmptyInstances {
  constructor(scene) { this.scene = scene; this.list = []; this.built = -1; this.hidden = 0; }

  /** The scene's instanced meshes, from the frame's list of the scene (engine/scene-matrices.js) when it was remade. */
  refresh() {
    const L = sceneList(this.scene);
    if (!L) return false;   // (an edit since: the list is made again next frame; until then nothing is hidden)
    if (L.built !== this.built) {
      this.built = L.built;
      this.list = [];
      for (let i = 0; i < L.n; i++) if (emptyCandidate(L.objs[i])) this.list.push(L.objs[i]);
    }
    return true;
  }

  /** Hide those holding no instance this frame; pushed on `out` (shown again after the passes). */
  hide(out = []) {
    this.hidden = 0;
    if (!this.refresh()) return out;
    for (const o of this.list) {
      if (o.count !== 0 || !o.visible || !emptyCandidate(o)) continue;   // (a hook or a child given to it since: drawn)
      o.visible = false; out.push(o); this.hidden++;
    }
    return out;
  }
}

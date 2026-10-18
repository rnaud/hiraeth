// Change notices for the Unity bridge's mirror (engine/mirror.js `noticed`, issue #455): what three keeps on an object
// or a geometry that the mirror would otherwise have to look at again and again to know it did not change.
//
// The mirror's frame used to look again at every drawable (its geometry and its attributes' versions, its render hooks,
// its shape keys) every frame it had moved in the last half second and every 4th frame otherwise: most of its time, in
// a world where almost nothing of the sort changes. Here the ways those change that cost the most to watch tell it:
//
//   - a render hook put on an object (onBeforeRender, onAfterRender: accessors on Object3D's prototype, the hook kept in
//     _nBefore, _nAfter): its mirror node is marked (node.touched) and looked at in full the next time it is reached;
//   - an attribute rewritten (BufferAttribute's and InterleavedBuffer's needsUpdate, the only way three counts a
//     version; nothing in the game writes .version itself), or a geometry given another index or attribute (setIndex,
//     setAttribute, deleteAttribute): each geometry record of the mirror's that holds it is marked stale, and its version
//     summed again (its attributes listed again) when next drawn.
//
// What is left is read, cheaply: matrices and visibility by the scene's list (engine/scene-matrices.js), which reads
// them every frame anyway; a drawable's geometry and material by the mirror, two reads off the object a frame (as
// accessors on Object3D, they cost the game's own update more on the Steam Deck than they saved the mirror); a
// material's values (colour, glow, live vectors) once a frame per material.
// The accessors go on before any of the game's objects are made (engine/unity/notices-on.js, the Unity entry's first
// import after its host); a hook put on an object before keeps a data property of its own, which the mirror reads too
// (ownHook). Only the Unity bridge installs them: the web game is untouched.
// tests/mirror-noticed.test.js: the noticed mirror tells the backend what the mirror looking at everything every frame
// tells it, call for call, through random moves, swaps, rewrites, hooks, hides, adds and removes.
import * as THREE from 'three';

let installed = false;
/** Whether the notices are on (installNotices has run). */
export const noticesOn = () => installed;

const touch = (o) => { const nd = o.__mirror; if (nd) nd.touched = true; };

// (attribute → the mirror's geometry records it is in, beside the attributes, not on them: a property put on three's
// attributes gave them a second shape, and the game's own code that writes them grew slower on the Steam Deck)
const IN = new WeakMap();

/** A geometry's attribute (or interleaved buffer, or index) rewritten: every geometry record of the mirror's holding it is stale. */
export function attrTouched(a) {
  const G = IN.get(a);
  if (G !== undefined) for (let i = 0; i < G.length; i++) G[i].stale = true;
}

/** The mirror's geometry record c holds the attribute (its interleaved buffer, the index) a: tell c when a is rewritten. */
export function attrIn(a, c) {
  const G = IN.get(a);
  if (G === undefined) IN.set(a, [c]);
  else if (!G.includes(c)) G.push(c);
}

/** The accessors and wraps, once (they stay for the session). */
export function installNotices() {
  if (installed) return;
  installed = true;
  const O = THREE.Object3D.prototype;
  const plainBefore = O.onBeforeRender, plainAfter = O.onAfterRender;
  Object.defineProperty(O, 'onBeforeRender', { configurable: true, get() { return this._nBefore ?? plainBefore; }, set(v) { this._nBefore = v; touch(this); } });
  Object.defineProperty(O, 'onAfterRender', { configurable: true, get() { return this._nAfter ?? plainAfter; }, set(v) { this._nAfter = v; touch(this); } });
  for (const P of [THREE.BufferAttribute.prototype, THREE.InterleavedBuffer.prototype]) {
    const d = Object.getOwnPropertyDescriptor(P, 'needsUpdate');
    const set = d.set;
    Object.defineProperty(P, 'needsUpdate', { ...d, set(v) { set.call(this, v); if (v === true) attrTouched(this); } });
  }
  const G = THREE.BufferGeometry.prototype;
  for (const name of ['setIndex', 'setAttribute', 'deleteAttribute']) {
    const plain = G[name];
    G[name] = function (...args) { const c = this.__mirrorAttrs; if (c) c.stale = true; return plain.apply(this, args); };
  }
}

/** Has this object a render hook of its own (put on it through the accessor, or a data property of its own)? */
export const ownHook = (o, name) => (name === 'onBeforeRender' ? o._nBefore !== undefined : o._nAfter !== undefined) || Object.prototype.hasOwnProperty.call(o, name);

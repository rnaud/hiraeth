// src/matrix-cache.js's subtree lists (issue #457): a walk entered from outside one goes down a list of the subtree made
// once between edits, and must make exactly what the walk's own recursion makes, matrix for matrix, flag for flag, call
// for call. Two copies of the same random rigs get the same changes and the same walks, entered at their roots and at
// inner joints, forced or not; one is walked by the recursion (EDITS.on off), the other down the lists. Between the
// walks: moves, owners' matrices written by hand (flagged or not), world matrices left to their owners, objects added,
// removed and attached elsewhere, a holder lending its children to a walk (the hero map's scene), objects with their own
// updateMatrixWorld (a camera, a subclass that reads its matrices), updateChain's reads, and the mirror's stamps.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installMatrixCache, updateChain, EDITS, WORLD_STAMP } from '../src/matrix-cache.js';
import { watchSceneEdits } from '../engine/scene-matrices.js';

installMatrixCache();
watchSceneEdits();

class Reader extends THREE.Object3D {
  constructor() { super(); this.seen = []; }
  updateMatrixWorld(force) { super.updateMatrixWorld(force); this.seen.push(this.matrixWorld.elements[12], force ? 1 : 0); }
}

function build(seed) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const scene = new THREE.Scene(), all = [], roots = [];
  scene.position.set(0, 2, 1); scene.rotation.y = 0.3; scene.updateMatrixWorld();   // (not where a holder is)
  const make = (k) => (k % 11 === 4 ? new Reader() : k % 13 === 7 ? new THREE.PerspectiveCamera() : k % 3 === 1 ? new THREE.Mesh() : k % 3 === 2 ? new THREE.Bone() : new THREE.Object3D());
  let made = 0;
  const add = (parent, depth) => {
    const n = depth === 0 ? 2 : 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const o = make(made++);
      o.position.set(rnd() * 2, rnd() * 2, rnd() * 2);
      o.rotation.set(rnd(), rnd(), rnd());
      o.scale.setScalar(0.5 + rnd());
      o.__mirror = { mw: -1 };
      parent.add(o); all.push(o);
      if (depth < 5) add(o, depth + 1);
    }
  };
  for (let r = 0; r < 3; r++) { const root = new THREE.Group(); root.position.set(r * 3, 0, 0); root.__mirror = { mw: -1 }; scene.add(root); all.push(root); roots.push(root); add(root, 0); }
  const holder = new THREE.Scene(), keeper = new THREE.Scene();
  keeper.children = [roots[1], roots[2]];   // (lent for good: the same array every walk)
  return { scene, all, roots, rnd, holder, keeper };
}

/** The state a walk leaves: every world matrix, its flag, the Readers' calls, the mirror's stamps. */
const state = (W) => W.all.map((o) => [...o.matrixWorld.elements, o.matrixWorldNeedsUpdate ? 1 : 0, o.__mirror.mw, ...(o.seen ? [o.seen.length, ...o.seen.slice(-4)] : [])].join(','));

test('a walk down a subtree\'s list makes what the recursion makes, through edits, owners, holders and reads', () => {
  const A = build(457), B = build(457);
  let listed = 0, compared = 0;
  const twin = (fn) => {
    EDITS.on = false; try { fn(A); } finally { EDITS.on = true; }
    fn(B);
  };
  WORLD_STAMP.on = true;
  try {
    for (let frame = 0; frame < 400; frame++) {
      WORLD_STAMP.n = frame;
      const r = A.rnd(); B.rnd();
      const pick = Math.floor(r * A.all.length), other = Math.floor(((frame * 7919) % 101) / 101 * A.all.length);
      twin((W) => {
        const o = W.all[pick], q = W.all[other];
        const kind = frame % 12;
        if (kind === 0) o.position.x += 0.25;
        else if (kind === 1) o.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), frame * 0.1);
        else if (kind === 2) o.scale.y = 1 + frame * 0.01;
        else if (kind === 3) { o.matrixAutoUpdate = false; o.matrix.makeTranslation(frame * 0.01, 0, 0); o.matrixWorldNeedsUpdate = true; }
        else if (kind === 4) { o.matrixAutoUpdate = false; o.matrix.makeTranslation(0, frame * 0.01, 0); }   // (written without a flag)
        else if (kind === 5) { o.matrixAutoUpdate = true; o.matrixWorldAutoUpdate = frame % 24 !== 5; }
        else if (kind === 6 && frame % 36 === 6) { const c = new THREE.Object3D(); c.__mirror = { mw: -1 }; c.position.set(1, 1, 1); o.add(c); W.all.push(c); }   // (an edit)
        else if (kind === 7 && frame % 48 === 7 && q !== o && !q.isScene && !W.roots.includes(q)) { let p = o; while (p && p !== q) p = p.parent; if (!p) o.attach(q); }   // (another parent)
        else if (kind === 8) updateChain(q, W.roots.find((root) => { let p = q; while (p && p !== root) p = p.parent; return p; }) ?? null);
        else if (kind === 9) q.getWorldPosition(new THREE.Vector3());
        else if (kind === 10) { o.position.z -= 0.1; o.updateMatrix(); }
        // (11: nothing)
      });
      // (a holder that keeps the rigs it lends walked first, sometimes, with their changes still to make)
      if (frame % 3 === 0) { twin((W) => { W.roots[1 + frame % 2].position.y += 0.01; W.keeper.updateMatrixWorld(frame % 2 === 0); }); const a = state(A), b = state(B); for (let j = 0; j < a.length; j++) assert.equal(b[j], a[j], `object ${j}, frame ${frame}, the keeper`); }
      // the frame's walks: each rig from its root, forced as the game's are, and from inner joints, forced or not
      const entries = [];
      for (let k = 0; k < 3; k++) entries.push([A.all.indexOf(A.roots[k]), true]);
      for (let k = 0; k < 4; k++) entries.push([Math.floor(A.rnd() * A.all.length), k % 2 === 0]), B.rnd();
      for (const [i, force] of entries) {
        twin((W) => W.all[i].updateMatrixWorld(force));
        const a = state(A), b = state(B);
        for (let j = 0; j < a.length; j++) assert.equal(b[j], a[j], `object ${j}, frame ${frame}, the walk from ${i}`);
        compared += a.length;
      }
      // a holder lending a rig to a walk of its own (its children not its own)
      if (frame % 5 === 0) twin((W) => { W.holder.children = [W.roots[frame % 3]]; try { W.holder.updateMatrixWorld(); } finally { W.holder.children = []; } });
      const a = state(A), b = state(B);
      for (let j = 0; j < a.length; j++) assert.equal(b[j], a[j], `object ${j}, frame ${frame}, after the holders`);
      listed++;
    }
  } finally { WORLD_STAMP.on = false; }
  assert.ok(listed === 400 && compared > 100000, `${listed} ${compared}`);
});

test('the lists are walked (a walk from a rig\'s root reads no position through the recursion between edits)', () => {
  const root = new THREE.Group(), leaves = [];
  new THREE.Scene().add(root);
  for (let i = 0; i < 4; i++) { const arm = new THREE.Object3D(); root.add(arm); for (let k = 0; k < 3; k++) { const l = new THREE.Bone(); arm.add(l); leaves.push(l); } }
  root.updateMatrixWorld(true); root.updateMatrixWorld(true);   // (the recursion, then the list made)
  let reads = 0;
  const leaf = leaves[5];
  const d = Object.getOwnPropertyDescriptor(leaf, 'children');
  Object.defineProperty(leaf, 'children', { configurable: true, get() { reads++; return d.value; } });
  root.updateMatrixWorld(true);
  assert.equal(reads, 0, 'the leaf\'s children were read: the walk went by the recursion');
  root.add(new THREE.Object3D());   // (an edit: the next walk by the recursion again)
  root.updateMatrixWorld(true);
  assert.ok(reads > 0);
});

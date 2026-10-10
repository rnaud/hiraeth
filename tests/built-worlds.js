// The worlds built once per test process (docs/systems/testing.md, "Heavy tests"). Building a world
// (its level and its collision) is most of what a test of every world costs, and each test file runs in
// a process of its own: tests in one file that need the same world, as main.js builds it minus the
// drawing, share it from here instead of building it again. Only for tests that leave the world as
// they found it (or run last): a test that plays a world's story or changes its state builds its own.
import * as THREE from 'three';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';

/** Run f with the console quiet; the three.js warnings it printed go to `warned` when given. */
export function quiet(f, warned = null) {
  const w = console.warn, l = console.log, i = console.info;
  console.log = console.info = () => {};
  console.warn = warned ? (...a) => { const m = a.map(String).join(' '); if (/THREE\./.test(m)) warned.push(m); } : () => {};
  try { return f(); } finally { console.warn = w; console.log = l; console.info = i; }
}

const built = new Map();

/**
 * The world `id` built and its collision set up, once per process: { id, scene, level, physics, warned }
 * (warned: the three.js warnings its build printed, tests/contact-audit.test.js checks there are none).
 */
export function builtWorld(id) {
  if (!built.has(id)) {
    const scene = new THREE.Scene(), warned = [];
    // (a level, a merged world's part on its own, a dismissed world: src/levels/buildable.js)
    const level = quiet(() => buildableById(id).create(scene), warned);
    const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
    quiet(() => level.init?.(physics), warned);
    built.set(id, { id, scene, level, physics, warned });
  }
  return built.get(id);
}

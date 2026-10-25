// Shared actual-world builders and camera probes for finale contracts.
// Each test file keeps its own lazy house cache; no simplified temple substitute.
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { wayOut } from '../src/temples/finale.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; console.info = i; } };

const built = new Map();
/** A house in its world, built once: { rt, physics }; the traveller stood in its arena between the keeper and the way out. */
function house(id) {
  if (built.has(id)) return built.get(id);
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, id) ?? level.temple;
  scene.updateMatrixWorld(true);
  const out = { rt, physics, scene };
  built.set(id, out);
  return out;
}
function standBy(rt) {
  const G = rt.guardian, way = wayOut(rt);
  const c = G.arena.center, door = way.piece.group.position;
  const dir = V(door.x - G.model.pos.x, 0, door.z - G.model.pos.z).normalize();
  const pos = G.model.pos.clone().addScaledVector(dir, Math.min(6, G.arena.r * 0.5)).setY(G.arena.y);
  rt.player = { pos, vel: V(), heading: Math.atan2(-dir.x, -dir.z), riding: false };
  return rt.player;
}
/** What drawn surface of the house stands between the lens and p (not the keeper, not the way out's own door, nothing see-through), or null. */
function blocker(rt, from, p, skip, near = 0.4) {
  const d = from.distanceTo(p);
  const ray = new THREE.Raycaster(from, p.clone().sub(from).normalize(), 0.05, d - near);
  const shown = (o) => { for (let q = o; q; q = q.parent) { if (!q.visible) return false; if (skip.includes(q)) return false; } return true; };
  for (const h of ray.intersectObject(rt.root, true)) {
    const mat = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
    if (!h.object.isMesh || mat?.transparent || mat?.visible === false || !shown(h.object)) continue;
    return { name: h.object.name || h.object.parent?.name || '?', at: h.distance.toFixed(1) };
  }
  return null;
}
/** Is p in the frame of camera c (inside the letterbox, in front)? */
function inFrame(c, p) {
  const cam = new THREE.PerspectiveCamera(c.fov, 16 / 9, 0.1, 2000);
  cam.position.copy(c.pos); cam.lookAt(c.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const v = p.clone().project(cam);
  return v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.78;
}

export { V, quiet, house, standBy, blocker, inFrame };

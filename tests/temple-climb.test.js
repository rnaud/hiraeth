// No wall inside a temple is climbed but the climbs its layout marks (issue #115: "most walls in temples not climbable,
// otherwise it trivializes the puzzles"). The kit bakes the interior's solids noClimb (src/temples/kit.js, physics
// climbable()); K.climbable() marks the few its route uses. A real Player, pushed into the wall beside every lock's
// doorway (both faces) and into whatever a key stands up on, never takes hold.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLES, TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { Door, Key } from '../src/temples/pieces.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

function world(id) {
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  return { level, physics, rt: templeOf(level, id) ?? level.temple };
}

/**
 * Stand at `from` (on its floor), facing `to`, and push into it for a while: did he take hold of the wall, and how
 * high did he get? null when `from` is no place to stand (inside a wall, over a gap), or nothing is in front of it.
 */
function push(w, P, from, to) {
  const { physics } = w;
  const g = physics.groundAt(from.x, from.y + 1.5, from.z, 3);
  if (!Number.isFinite(g) || Math.abs(g - from.y) > 0.6) return null;
  const at = V(from.x, g, from.z), dir = V(to.x - at.x, 0, to.z - at.z).normalize();
  const chest = at.clone().add(V(0, 1.2, 0));
  if (physics.rayDistance(chest, dir, 2.5) >= 2.5) return null;                       // (nothing to push into)
  if (physics.pushCapsule(at.clone(), 0.45, 0.3, 1.7, V(), V(0, 1, 0))) return null;  // (standing in something)
  P.teleport(at, V(0, 1, 0), V(0, 0, 1));
  P.vel.set(0, 0, 0); P.climbing = false; P._climbCooldown = 0; P.stamina = 1; P.winded = false;
  const yaw = Math.atan2(-dir.x, -dir.z);
  let held = false, top = at.y;
  for (let i = 0; i < 2.5 / DT; i++) {
    physics.syncMovers(DT); w.rt.update(DT, (w.t = (w.t ?? 0) + DT));
    P.update(DT, { KeyW: true }, yaw);
    held ||= P.climbing; top = Math.max(top, P.pos.y);
  }
  return { held, rise: top - at.y };
}

/** The probes: beside every lock's doorway, both faces of its wall; round every key that stands above its floor. */
function probes(rt, physics) {
  const out = [];
  for (const p of rt.pieces) {
    if (!(p instanceof Door) || !p.id || !rt.logic.el(p.id)) continue;
    const o = p.group.position, yaw = p.group.rotation.y;
    const n = V(Math.sin(yaw), 0, Math.cos(yaw)), t = V(n.z, 0, -n.x);
    for (const side of [1, -1]) for (const s of [1, -1]) {
      const along = t.clone().multiplyScalar(s * (p.w / 2 + 1.8));
      const wall = o.clone().add(along);
      out.push({ what: `${p.id} (${s > 0 ? 'right' : 'left'}, ${side > 0 ? 'front' : 'back'})`, door: p.id, from: wall.clone().addScaledVector(n, side * 1.7), from2: wall.clone().addScaledVector(n, side * 2.4), to: wall });
    }
  }
  for (const p of rt.pieces) {
    if (!(p instanceof Key)) continue;
    // a key up on something: from the floor below it, into whatever it stands on
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, d = V(Math.sin(a), 0, Math.cos(a));
      for (const r of [3, 5]) {
        const q = p.pos.clone().addScaledVector(d, r);
        const g = physics.groundAt(q.x, p.pos.y - 0.5, q.z, 12);
        if (!Number.isFinite(g) || p.pos.y - g < 1.5) continue;
        out.push({ what: `${p.id} (from ${(p.pos.y - g).toFixed(1)} m below)`, key: p.id, from: V(q.x, g, q.z), to: p.pos.clone().setY(g) });
        break;
      }
    }
  }
  return out;
}

// (each temple's kept climbs, read while the test before builds its world: the next test needs nothing else of it)
const climbWhy = {};

test('a temple\'s walls are not climbed past its puzzles: not beside any lock\'s doorway, nor up to a key (issue #115)', () => {
  game.reset();
  for (const id of Object.keys(ITEMS)) if (['backpack', 'gun'].includes(id)) items.grant(id); else items.revoke(id);
  const doors = {};
  for (const id of Object.keys(TEMPLES)) {
    const w = world(id);
    assert.ok(w.physics.climbMask, `${id}: its walls are baked not to be climbed`);
    const P = new Player(w.physics, { spawn: w.rt.arrival.pos.clone(), dynamic: w.level.dynamic, limit: Infinity });
    const said = [];
    w.rt.connect({ player: P, toast: (x) => said.push(x) });
    let tried = 0;
    for (const pr of probes(w.rt, w.physics)) {
      said.length = 0;
      // Each probe independently checks the glass's slip response. The runtime deliberately
      // tells this hint only once, so a previous probe must not suppress this one's evidence.
      w.rt.told.delete('glass.slip');
      // (a round hall's wall curves away from a wide door's side: a step further out when 1.7 m stands in its stones, issue #336)
      const r = push(w, P, pr.from, pr.to) ?? (pr.from2 ? push(w, P, pr.from2, pr.to) : null);
      if (!r) continue;
      tried++;
      if (pr.door) doors[`${id}.${pr.door}`] = true;
      // (a pane of glass a vine or rungs will climb is taken hold of, and slips you off it, saying so: src/temples/pieces.js Glass)
      const slipped = r.rise < 1 && said.some((x) => /smooth/.test(x));
      assert.ok(!r.held || slipped, `${id}: the wall at ${pr.what} is not climbed (it rose ${r.rise.toFixed(1)} m)`);
    }
    if (process.env.PROBES) console.log(id, tried, Object.keys(doors).filter((k) => k.startsWith(id + '.')).length);
    assert.ok(tried >= 3, `${id}: probed (${tried})`);
    climbWhy[id] = w.rt.kit.climbWhy;
    w.rt.dispose?.();
  }
  assert.ok(Object.keys(doors).length >= 40, `the locks probed (${Object.keys(doors).length})`);
});

test('the climbs a temple keeps are marked, each with its why, and are still climbed', () => {
  const kept = {};
  for (const id of Object.keys(TEMPLES)) {
    if (!climbWhy[id]) { const { rt } = world(id); climbWhy[id] = rt.kit.climbWhy; rt.dispose?.(); }
    kept[id] = climbWhy[id];
    for (const why of kept[id]) assert.ok(why.length > 20, `${id}: a climb says what it is for (${why})`);
  }
  // (the houses whose route climbs: the rest have none)
  // (the Clock-House's wall up the Winding Well went with its rework round the great hall, issue #414: its stair turns)
  for (const id of ['desert', 'incal', 'perdide', 'perdide2', 'edena', 'underwater']) assert.ok(kept[id].length > 0, `${id} keeps its climb`);
  for (const id of ['arzach', 'arzach2', 'bazaar', 'buried', 'garage', 'moonfoundry', 'spacecity', 'spheres']) assert.deepEqual(kept[id], [], `${id} has no climb`);
});

test('a climbable wall next to one that is not: the climb holds to its own wall', () => {
  // a 10 m wall, its left half climbable; pushed into the right half he never takes hold, and climbing the left half
  // he can't shuffle across onto the right
  const scene = new THREE.Scene();
  const mk = (x, flag) => { const m = new THREE.Mesh(new THREE.BoxGeometry(5, 10, 1), new THREE.MeshBasicMaterial()); m.position.set(x, 5, -0.5); m.userData[flag] = true; scene.add(m); };
  mk(-2.5, 'climb'); mk(2.5, 'noClimb');
  const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 40), new THREE.MeshBasicMaterial()); floor.position.set(0, -0.5, 10); floor.userData.noClimb = true; scene.add(floor);
  const physics = new Physics(scene);
  assert.ok(physics.climbMask);
  const P = new Player(physics, { spawn: V(2.5, 0, 2), limit: Infinity });
  for (let i = 0; i < 2 / DT; i++) P.update(DT, { KeyW: true }, 0);
  assert.equal(P.climbing, false, 'not on the right half');
  P.teleport(V(-2.5, 0, 2), V(0, 1, 0), V(0, 0, 1));
  P._climbCooldown = 0;
  for (let i = 0; i < 2 / DT && !P.climbing; i++) P.update(DT, { KeyW: true }, 0);
  assert.equal(P.climbing, true, 'the left half is climbed');
  for (let i = 0; i < 4 / DT && P.climbing; i++) P.update(DT, { KeyD: true }, 0);
  assert.ok(P.pos.x < 0.5, `and not shuffled across onto the right (${P.pos.x.toFixed(2)})`);
});

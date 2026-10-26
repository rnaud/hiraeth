// Map placement, collection and persisted puzzle state use the real attached worlds.
// Keep this expensive reload audit separate from HUD counters and key-chest presentation.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLE_HOME, templeOf } from '../src/temples/attachment.js';
import { Key, MapChest, KEY_CHEST } from '../src/temples/pieces.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { game } from '../src/game-state.js';

function world(id) {
  const scene = new THREE.Scene();
  const warn = console.warn;
  let level;
  try { console.warn = () => {}; level = buildableById(TEMPLE_HOME[id] ?? id).create(scene); }
  finally { console.warn = warn; }
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  return { level, physics, rt: templeOf(level, id) ?? level.temple };
}

test('the nine map displays retain optional collection and opened-save state without enlarging keys', () => {
  for(const id of ['desert','bazaar','arzach','buried','underwater','arzach2','perdide2','garage','spheres']) {
    game.reset();
    const first=world(id), rt=first.rt;
    const map=rt.pieces.find(p=>p instanceof MapChest);
    const e=rt.def.logic.elements[map.id];
    assert.equal(map.scale,1.5);
    assert.ok(map.pos.distanceTo(rt.kit.world(e.at[0],e.at[1]+.24,e.at[2]))<1e-6);
    for(const key of rt.pieces.filter(p=>p instanceof Key && !(p instanceof MapChest))) {
      assert.equal(key.scale,key.o.big?KEY_CHEST.big:KEY_CHEST.small,'unrelated key size preserved');
    }
    const before=rt.keyCount();
    const gates = r => Object.fromEntries(Object.entries(r.def.logic.elements)
      .filter(([, e]) => ['door','bridge'].includes(e.type)).map(([key]) => [key, r.logic.isOpen(key)]));
    const beforeGates=gates(rt);
    assert.ok(map.openIt(),'optional map opens through its actual interaction handler');
    assert.equal(map.openIt(),false,'cannot grant twice');
    assert.deepEqual(rt.keyCount(),before,'map is not a puzzle key');
    assert.deepEqual(gates(rt),beforeGates,'collecting a map cannot open a puzzle gate');
    rt.dispose?.();
    const loaded=world(id);
    const old=loaded.rt.pieces.find(p=>p instanceof MapChest);
    assert.equal(old.taken,true,'existing saved map stays opened at its new display');
    assert.deepEqual(gates(loaded.rt),beforeGates,'map-only reload preserves puzzle gates');
    assert.equal(old.openIt(),false,'reload cannot reannounce or grant the map');
    loaded.rt.dispose?.();
  }
});

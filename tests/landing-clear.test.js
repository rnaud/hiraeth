// Nothing through the ship where it lands (issue #706; src/ship/landing-clear.js, docs/systems/ship.md "Clear ground"):
// the walk-through scenery scattered by the instance is left out of the hull, the ramp and the first steps off it, and in
// every world the ship lands in (the route, Home, the Lantern, the developer's rooms) nothing else drawn stands in them:
// checked vertex by vertex against the caravan the game flies, as main.js builds it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { builtWorld, quiet } from './built-worlds.js';
import { Ship } from '../src/ship/ship.js';
import { clearLanding, landingIntruders, landingZones } from '../src/ship/landing-clear.js';
import { dropBuriedFlora } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT } from '../src/levels/content.js';
import { isDiscarded, isSub } from '../src/levels/names.js';
import { Physics } from '../src/physics.js';

globalThis.window ??= { addEventListener() {} };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const caravan = async () => {
  const b = readFileSync(new URL('../public/models/ships/caravan-a/playable.glb', import.meta.url));
  return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene;
};
const NONE = { npcs: [], relics: { spots: [] } };

test('a shrub on the ramp and one in the hull are left out where the ship stands; one beside it stays', async () => {
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400).translate(0, -0.5, 0), new THREE.MeshBasicMaterial());
  scene.add(floor);
  const level = { spawn: V(0, 0, 0), ground: null, shipSite: { x: 0, z: 0, heading: 0 } };
  const physics = new Physics(scene), model = await caravan();
  // three shrubs (walk-through instances, 1.2 m high): spots filled in once the ship shows where its ramp comes down
  const shrubs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 1.2, 6).translate(0, 0.6, 0), new THREE.MeshBasicMaterial(), 3);
  shrubs.userData.noCollide = true; shrubs.name = 'shrubs';
  scene.add(shrubs);
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test-pad', content: NONE, caravan: model }));
  const mid = ship.hinge.clone().lerp(ship.rampFoot, 0.6), side = V(ship.outDir.z, 0, -ship.outDir.x);
  const spots = [V(mid.x, 0, mid.z), ship.restPos.clone().setY(0).addScaledVector(side, 6), ship.rampFoot.clone().setY(0).addScaledVector(side, 9)];
  spots.forEach((p, i) => shrubs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, 0, p.z)));
  assert.equal(clearLanding(scene, ship), 2, 'the one on the ramp and the one under the hull');
  const m = new THREE.Matrix4();
  for (const [i, gone] of [[0, true], [1, true], [2, false]]) { shrubs.getMatrixAt(i, m); assert.equal(m.elements[0] === 0, gone, `shrub ${i}`); }
  const Z = landingZones(ship);
  assert.equal(Z.boxOf(V(mid.x, mid.y + 1, mid.z)), 'ramp');
  assert.equal(Z.boxOf(ship.rampFoot.clone().addScaledVector(ship.outDir, 3).setY(ship.rampFoot.y + 1)), 'walk');
  assert.equal(Z.boxOf(ship.rampFoot.clone().addScaledVector(side, 9).setY(1)), null);
});

test('every world the ship lands in: nothing drawn through its hull, over its ramp or across the walk off it', async () => {
  const model = await caravan();
  const failed = [], report = [];
  for (const { id } of LEVELS) {
    if (isDiscarded(id) || isSub(id)) continue;   // (the side worlds, debug only since 2026-10-18; a train's carriage)
    let built;
    try { built = builtWorld(id); } catch (e) { if (/runStepsAsync/.test(e.message)) continue; throw e; }
    const { scene, level, physics } = built;
    quiet(() => dropBuriedFlora(scene, physics));   // (main.js: before the ship)
    const ship = quiet(() => new Ship({ scene, physics, level, levelId: id, content: CONTENT[id] ?? NONE, caravan: model }));
    const found = await landingIntruders(scene, ship, { groundAt: (x, z) => physics.groundAt(x, ship.rampFoot.y + 3, z, 30), skip: [level.ground?.mesh] });
    report.push(`${id}: ${ship.clearedScenery} instances left out, ${found.length} through it`);
    for (const f of found) failed.push(`${id}: ${f.name}${f.instance !== null ? ` #${f.instance}` : ''} ${f.solid ? '(solid)' : '(walk-through)'} in the ${f.where}, ${f.n} points, at ${f.at.toArray().map((v) => v.toFixed(1))}`);
  }
  if (process.env.LANDING_REPORT) console.log(report.join('\n'));
  assert.ok(report.length >= 15, report.join('\n'));
  assert.deepEqual(failed, [], failed.join('\n'));
});

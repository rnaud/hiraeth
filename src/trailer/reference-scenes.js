import * as THREE from 'three';
import { REFERENCE_VIEWS } from '../levels/reference-views.js';
import { ringGround, sunTurn, sunHour } from '../levels/references.js';
import { RoomKit } from '../levels/lab-kit.js';
import { makeMaterial, MODE_TERRAIN } from '../materials.js';
import { buildShipModel } from '../ship/model.js';
import { LIFT } from '../ship/hull.js';

// Reuse the reference level's actual geometry, palette and sun, without its UI or NPCs.
export const REFERENCE_SCENES = {
  horizon: 'bones', shaft: '3779-down-to-water',
  stream: '3797-egg-heaps', garden: '3793-arch-lake', grove: '3793-grove-pyramid',
};
export function referenceBuilder(id) {
  return function* (scene) {
    const def = REFERENCE_VIEWS.find(v => v.id === REFERENCE_SCENES[id]);
    if (!def) throw new Error(`Unknown trailer reference ${id}`);
    const stage = new THREE.Group(); stage.rotation.y = sunTurn(def.sun, def.camera.yaw); scene.add(stage);
    const heightAt = def.ground.height;
    const ground = { heightAt, baseAt: (x, z) => heightAt(x, z) };
    stage.add(new THREE.Mesh(ringGround(heightAt, { at: [0, 0], ...def.ground.rings }), makeMaterial({ mode: MODE_TERRAIN, ...def.ground.material })));
    const kit = new RoomKit({ group: stage, ground, centre: new THREE.Vector3(), seed: 3775 });
    if (id === 'horizon') {
      // Empty dunes: the traveller and the game's ship are the only subjects.
      const ship = buildShipModel({ legs: 'down' });
      ship.group.position.set(65, heightAt(65, -180) + LIFT, -180);
      ship.group.rotation.y = -0.5; stage.add(ship.group);
    } else def.build(kit, { ...def, omitCabs: id === 'shaft' });
    kit.finish(); stage.updateMatrixWorld(true); yield;
    const lights = kit.lights.map(l => {
      const p = new THREE.Vector3(l.x, l.y, l.z).applyMatrix4(stage.matrixWorld);
      return new THREE.Vector4(p.x, p.y, p.z, l.w);
    });
    return {
      id, stage, ground, lights, noShadow: kit.noShadow,
      defaults: { hour: sunHour(def.sun.el).hour, preset: def.preset ?? 'Moebius print', look: def.look ?? {}, cloudShadows: 0 },
      sky: { script: { day: def.sky, dusk: def.sky, night: def.sky } },
      atmo: () => ({ tint: [1, 1, 1], fog: def.fog ?? 0.35 }),
      update(dt, time) { kit.movers.forEach(fn => fn(time)); },
    };
  };
}

// The real furnished ship and its ground ramp, in a silent scene with no saved progress.
import * as THREE from 'three';
import { loadPlayableCaravan } from '../src/ship/caravan-asset.js';
import { buildShipModel, poseRamp } from '../src/ship/model.js';
import { CaravanDeployment, caravanStowPose } from '../src/ship/caravan-deployment.js';
import { LIFT, LENGTH } from '../src/ship/caravan-layout.js';

export async function loadPlayableCaravanReview() {
  const caravan = await loadPlayableCaravan(import.meta.env?.BASE_URL ?? '/');
  // Match the production ramp's 27-degree ground search, including its small overlap.
  const run = Math.ceil((LIFT / Math.tan(THREE.MathUtils.degToRad(27)) - 1.2) / .2) * .2 + 1.2;
  const slope = new THREE.Vector3(-run, -LIFT - .08, 0);
  const ship = buildShipModel({ caravan, footY: () => -LIFT, ramp: { dir: slope.clone().normalize(), length: slope.length() + .25 } });
  const root = new THREE.Group(); root.rotation.y = Math.PI / 2; root.add(ship.group);
  let camp = 1;
  const deployment = new CaravanDeployment({
    applyCamp(value) {
      camp = value;
      poseRamp(ship.ramp, caravanStowPose(value).ramp);
      ship.door.position.copy(ship.doorRest); ship.door.position.x -= 1.9 * value;
    },
    applyAltitude(value) { root.position.y = LIFT + value; ship.applyCamp(camp, value); },
  });
  const parts = {}; ship.authored.traverse(node => { parts[node.name] = node; });
  return { root, ship, parts, deployment, dimensions: { length: LENGTH, humanHeight: 1.75, deckHeight: LIFT } };
}

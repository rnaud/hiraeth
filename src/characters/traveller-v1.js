import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadBody, makeBody } from '../makehuman/body.js';
import { Humanoid } from '../humanoid.js';
import { fitDonorToSurface } from './tripo-fit.js';
import { makeTripoCloth } from './tripo-cloth.js';
import { makeReviewInkMaterial } from './tripo-material.js';
import { relaxWalkArms, relaxWalkHands } from './tripo-walk.js';
import { softenTripoHands } from './tripo-hands.js';
import { markTripoHair } from './tripo-hair.js';
import { wearTripoFace } from './tripo-face.js';
import { cleanExpression } from '../expression.js';
import { TRAVELLER } from '../traveller.js';

/** The fluid flask's place on his back (the chest anchor's frame; fluid-tool.js TANK.at is the rucksack's). */
export const TRAVELLER_V1_TANK_AT = [0, 0.4, -0.235];

export async function loadTravellerV1(base) {
  const folder = `${base}characters/traveller-v1/`;
  const json = async name => {
    const response = await fetch(folder + name);
    if (!response.ok) throw new Error(`Traveller ${name}: HTTP ${response.status}`);
    return response.json();
  };
  const [gltf, data, report, colors] = await Promise.all([
    new GLTFLoader().loadAsync(folder + 'model.glb'), loadBody(base), json('rig.json'), json('colors.json'),
  ]);
  return { gltf, data, report, colors };
}

// Build in the same origin/rest frame as the fitted export and review. Gameplay
// can spawn at any position and orientation (including a sphere's far side).
export function createTravellerV1(char, { gltf, data, report, colors }, { gpu } = {}) {
  const skins = [];
  gltf.scene.traverse(o => { if (o.isSkinnedMesh) skins.push(o); });
  if (skins.length !== 1 || colors.length !== skins[0].geometry.attributes.position.count)
    throw new Error('Traveller v1 needs its matching mesh and per-vertex colour data');
  const template = makeBody(data, report.params), surface = [];
  const source = skins[0], p = source.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) surface.push(new T.Vector3().fromBufferAttribute(p, i));
  fitDonorToSurface(template, surface);
  const root = char.root, position = root.position.clone(), quaternion = root.quaternion.clone(), scale = root.scale.clone();
  root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.setScalar(1); root.updateMatrixWorld(true);
  try {
    const humanoid = new Humanoid(template, char, 'm');
    humanoid.ownOutfit = true;
    root.traverse(o => { if (o.isMesh) o.visible = false; });
    const mesh = new T.SkinnedMesh(source.geometry.clone(), source.material.clone());
    mesh.name = 'TravellerV1'; mesh.frustumCulled = false;
    humanoid.body.parent.add(mesh);
    mesh.bind(humanoid.body.skeleton, humanoid.body.bindMatrix);
    humanoid.body.skeleton.pose(); root.updateMatrixWorld(true);
    markTripoHair(mesh.geometry, colors);
    const cloth = makeTripoCloth(mesh, colors, gpu === undefined ? {} : { gpu });
    for (const part of [mesh, cloth.garment, cloth.underlayer, cloth.innerShirt]) {
      const standard = part.material;
      part.material = makeReviewInkMaterial(part, { lining: part === cloth.garment });
      standard.dispose();
    }
    // his face, drawn over the painted one so it can move (tripo-face.js): the same expressions, blinks and
    // talking mouth as everyone's (Humanoid.setExpression / updateEyes), resting with his little smile
    humanoid.drawnFace = wearTripoFace(mesh);
    humanoid.restExpression = cleanExpression(TRAVELLER.rest);
    humanoid.setExpression(humanoid.restExpression);
    cloth.gpuMaterial(cloth.garment.material);   // (the game: skinned and moved by the cage on the GPU, tripo-cloth.js)
    // (its shadow drawn the same shape by itself: the shadow passes' one plain material can't move it with the cage)
    if (cloth.shadow) humanoid.noShadow.push(cloth.garment);
    cloth.garment.name = 'TravellerOvershirt';
    cloth.underlayer.name = 'TravellerTrousers';
    cloth.innerShirt.name = 'TravellerInnerShirt';
    // the fluid glove over his right hand (shown while the tank is worn: fluid-tool.js), on the skin as
    // the cloth left it (it gives the mesh its own geometry)
    humanoid.wearGlove(mesh);
    // the flask (fluid-tool.js TANK) sits right on his back: he has no rucksack for it to sink into
    humanoid.tankAt = TRAVELLER_V1_TANK_AT;
    return {
      humanoid, mesh, cloth,
      shadowCasters: cloth.shadow ? [cloth.shadow] : [],
      // Before Humanoid.update, while the fresh clip is still on the control rig.
      poseArms(player) {
        const w = player.animator?.w;
        const active = w && player.onGround && !player.ride && !player.aim && !player.overlay &&
          !player.climbing && !player.mantle && !player.swim && !player.gliding && !player.thrusting && !player.boarding;
        if (!active) return [];
        const moving = (w.walk ?? 0) + (w.jog ?? 0) + (w.sprint ?? 0);
        const running = (w.jog ?? 0) + (w.sprint ?? 0);
        return relaxWalkArms(char, 'walk', true, {
          minimum: T.MathUtils.lerp(7, 12, running), maximum: T.MathUtils.lerp(8, 40, running), weight: moving,
        });
      },
      poseWrists(rotations) { relaxWalkHands(humanoid, rotations); },
      updateHands() { softenTripoHands(humanoid); },
      updateCloth(dt) {
        root.updateMatrixWorld(true);
        // Keep one simulation state across blended clips instead of resetting at
        // every walk/jog transition. All targets/colliders are character-local.
        cloth.update(dt, 'game', true);
      },
    };
  } finally {
    root.position.copy(position); root.quaternion.copy(quaternion); root.scale.copy(scale); root.updateMatrixWorld(true);
  }
}

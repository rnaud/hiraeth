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
import { makeTripoHead, removeOriginalHead, wearTripoHeadFace } from './tripo-head.js';
import { wearTripoFace } from './tripo-face.js';
import { cleanExpression } from '../expression.js';
import { TRAVELLER } from '../traveller.js';

/** The fluid flask's place on his back (the chest anchor's frame; fluid-tool.js TANK.at is the rucksack's). */
export const TRAVELLER_V1_TANK_AT = [0, 0.4, -0.1886];   // (v1.38: the round backpack, its slim canvas plate on his back where v1.37's sphere had its plate's back)

export async function loadTravellerV1(base) {
  const folder = `${base}characters/traveller-v1/`;
  const json = async name => {
    const response = await fetch(folder + name);
    if (!response.ok) throw new Error(`Traveller ${name}: HTTP ${response.status}`);
    return response.json();
  };
  const [gltf, data, report, colors, head, headColors] = await Promise.all([
    new GLTFLoader().loadAsync(folder + 'model.glb'), loadBody(base), json('rig.json'), json('colors.json'),
    new GLTFLoader().loadAsync(folder + 'head-v2/model.glb'), json('head-v2/colors.json'),
  ]);
  return { gltf, data, report, colors, head, headColors };
}

// Build in the same origin/rest frame as the fitted export and review. Gameplay
// can spawn at any position and orientation (including a sphere's far side).
export function createTravellerV1(char, { gltf, data, report, colors, head: headAsset }, { gpu } = {}) {
  const skins = [];
  gltf.scene.traverse(o => { if (o.isSkinnedMesh) skins.push(o); });
  if (skins.length !== 1 || colors.length !== skins[0].geometry.attributes.position.count)
    throw new Error('Traveller v1 needs its matching mesh and per-vertex colour data');
  // (his own template: the fit below reshapes it, and the cached one is shared by every traveller built,
  // the title's and the game's, whose bind matrices it would rewrite: his fingers bound off their bones)
  const template = makeBody(data, report.params, { fresh: true }), surface = [];
  const source = skins[0], p = source.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) surface.push(new T.Vector3().fromBufferAttribute(p, i));
  fitDonorToSurface(template, surface);
  const root = char.root, position = root.position.clone(), quaternion = root.quaternion.clone(), scale = root.scale.clone();
  root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.setScalar(1); root.updateMatrixWorld(true);
  try {
    const humanoid = new Humanoid(template, char, 'm');
    humanoid.ownOutfit = true;
    // his forearms bend on their elbows, rolled as the upper arm is (Humanoid.update): swung from the T-pose
    // on their own they rolled up to 90° off it, and the elbow, the rolled sleeve and the wrist wrung round
    humanoid.hingeElbows = true; humanoid._plan = null;
    root.traverse(o => { if (o.isMesh) o.visible = false; });
    const mesh = new T.SkinnedMesh(source.geometry.clone(), source.material.clone());
    mesh.name = 'TravellerV1'; mesh.frustumCulled = false;
    humanoid.body.parent.add(mesh);
    mesh.bind(humanoid.body.skeleton, humanoid.body.bindMatrix);
    humanoid.body.skeleton.pose();
    // (the pose above put the fingers back in the fitted rig's rest, bent back: his hands relaxed again)
    softenTripoHands(humanoid);
    root.updateMatrixWorld(true);
    markTripoHair(mesh.geometry, colors);
    const cloth = makeTripoCloth(mesh, colors, gpu === undefined ? {} : { gpu });
    const head = headAsset ? makeTripoHead(headAsset, mesh) : null;
    if (head) removeOriginalHead(mesh);
    for (const part of [mesh, cloth.garment, cloth.underlayer, cloth.innerShirt, head].filter(Boolean)) {
      const standard = part.material;
      part.material = makeReviewInkMaterial(part, { lining: part === cloth.garment });
      standard.dispose();
    }
    // The replacement keeps its generated face and moves its own shape keys.
    // Original-body tools retain the old painted-face adapter.
    humanoid.drawnFace = head ? wearTripoHeadFace(head) : wearTripoFace(mesh);
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
      humanoid, mesh, head, cloth,
      // standing, no thumb hooked in the belt (Player.idleLayer): the belt is under the open overshirt
      beltHook: false,
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

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildFlask, TANK, TANK_RAIL, SCOUT_DOCK_Y, SCOUT_CAP, tankRadiusAt } from '../src/fluid-tool.js';
import { makeMaterial } from '../src/materials.js';
import { buildItemModel } from '../src/boxes/model.js';
import { TRAVELLER_V1_TANK_AT } from '../src/characters/traveller-v1.js';

// The fluid tank as the reference sheets draw it (src/fluid-tool.js buildFlask): a flat framed reservoir of jade
// fluid with an ivory rim, sage backing, brass fittings and leather shoulder tabs.

const glassMat = () => makeMaterial({ color: '#ffffff', fluid: 'tank', fluidBox: [0, TANK.full, 0.16, 0], fluidBase: TANK.base });

test('a framed reservoir: about as wide as it is tall, flat front to back, its level a third a charge', () => {
  const R = Math.max(...TANK.profile.map(([r]) => r));
  const w = 2 * R * TANK.squash * TANK.scale, h = TANK.height * TANK.scale, d = 2 * R * TANK.depth * TANK.scale;
  assert.ok(w > 0.8 * h && w < 1.2 * h, `jar proportions (${w.toFixed(2)} × ${h.toFixed(2)} m)`);
  assert.ok(d < 0.6 * w, 'flat front to back');
  // rounded foot and shoulders, straight sides
  assert.ok(tankRadiusAt(0.005) < R * 0.9 && tankRadiusAt(TANK.height - 0.005) < R * 0.9 && tankRadiusAt(TANK.height / 2) > R * 0.99);
  assert.ok(TANK.full < TANK.height && TANK.full > TANK.height * 0.9, 'the fluid fills it at three charges');
  assert.deepEqual(TANK.straps, [], 'no band across the fluid');
});

test('its fittings, its green fluid, and the item picture is the same flask', () => {
  const { group, glass } = buildFlask(glassMat());
  assert.ok(glass.material.uniforms.uFluidBase, 'the fluid\'s own colour');
  assert.equal('#' + glass.material.uniforms.uFluidBase.value.getHexString(), TANK.base);
  const box = new THREE.Box3().setFromObject(group), glassBox = new THREE.Box3().setFromObject(glass);
  assert.ok(box.max.y > TANK.neck.y + TANK.neck.h, 'the neck and stopper over the collar');
  assert.ok(box.max.z > glassBox.max.z + 0.15, 'leather tabs forward over the shoulders');
  const bare = buildFlask(glassMat(), { worn: false }).group;
  assert.ok(new THREE.Box3().setFromObject(bare).max.z < glassBox.max.z + 0.02, 'no shoulder tabs on the item');
  assert.ok(group.children.length > bare.children.length);
  // the menu's picture (src/boxes/model.js): the same glass
  const item = buildItemModel('backpack');
  let fluid = null;
  item.traverse((o) => { if (o.isMesh && o.material?.uniforms?.uFluidBase) fluid = o; });
  assert.ok(fluid && fluid.geometry.attributes.position.count === glass.geometry.attributes.position.count);
});

test('the scout keeps its place on the body, over the jar; the coral-shirt traveller wears it on his back', () => {
  // the dock at the same chest height as with the old tank (glass bottom 0.28, dock 0.52 × 1.2 up it, × 0.8)
  assert.ok(Math.abs(TANK.at[1] + SCOUT_DOCK_Y * TANK.scale - (0.28 + 0.52 * 1.2 * 0.8)) < 0.002);
  assert.ok(TANK_RAIL.top > TANK.neck.y + TANK.neck.h && SCOUT_CAP.y > TANK.neck.y + TANK.neck.h + 0.04, 'over the neck');
  assert.ok(TRAVELLER_V1_TANK_AT[2] > TANK.at[2] && TRAVELLER_V1_TANK_AT[1] === TANK.at[1], 'closer in: no rucksack under it');
});

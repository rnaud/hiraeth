import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildFlask, setStage, TANK, TANK_RAIL, SCOUT_DOCK_Y, SCOUT_CAP, tankRadiusAt } from '../src/fluid-tool.js';
import { makeMaterial } from '../src/materials.js';
import { buildItemModel } from '../src/boxes/model.js';
import { TRAVELLER_V1_TANK_AT } from '../src/characters/traveller-v1.js';
import { BACKPACK_STAGES, backpackStage } from '../src/items.js';

// The round backpack (v1.38, references/Core Objects/Round Backpack/: the sheet's first pick, the states sheets):
// a glass sphere of jade fluid in a brass cradle, its equator band with three charge lights, a capped neck with a
// cloth tied round it, an olive canvas back plate and leather straps; its three stages, one per strength found.

const glassMat = () => makeMaterial({ color: '#ffffff', fluid: 'tank', fluidBox: [0, TANK.full, TANK.radius, 0], fluidBase: TANK.base });
const visibleBox = (root) => { const b = new THREE.Box3(); root.updateMatrixWorld(true); root.traverse((o) => { for (let w = o; w; w = w.parent) if (!w.visible) return; if (o.isMesh) b.expandByObject(o); }); return b; };

test('a glass sphere about 30 cm across: round every way, its fluid standing at the magic bar\'s level', () => {
  const R = Math.max(...TANK.profile.map(([r]) => r));
  assert.ok(Math.abs(R - TANK.radius) < 1e-9);
  const w = 2 * R * TANK.squash * TANK.scale, h = (TANK.height - 0.01) * TANK.scale, d = 2 * R * TANK.depth * TANK.scale;
  assert.ok(w > 0.27 && w < 0.33, `about 30 cm across (${w.toFixed(2)} m)`);
  assert.ok(Math.abs(w - d) < 1e-9 && Math.abs(w - h) < 0.01, 'a sphere, not a flask');
  // round: the radius at its middle is its widest, small at its foot and its top
  assert.ok(tankRadiusAt(TANK.center) > R * 0.99 && tankRadiusAt(0.02) < R * 0.5 && tankRadiusAt(TANK.height - 0.01) < R * 0.5);
  assert.ok(TANK.full < TANK.height && TANK.full > TANK.height * 0.9, 'the fluid fills it with the bar full');
  assert.deepEqual(TANK.straps, [], 'no band across the fluid');
  assert.ok(TANK.glow[1] > TANK.glow[0], 'it glows brighter the fuller the bar');
});

test('its cradle, neck, cloth, back plate and straps; three charge lights on its band; the item picture is the same sphere', () => {
  const { group, glass, lights } = buildFlask(glassMat(), { stage: 0 });
  assert.ok(glass.material.uniforms.uFluidBase, 'the fluid\'s own colour');
  assert.equal('#' + glass.material.uniforms.uFluidBase.value.getHexString(), TANK.base);
  assert.equal(lights.length, 3, 'three charge lights');
  for (const l of lights) assert.ok(l.position.z < 0, 'on the band\'s outer face, away from his back');
  const box = visibleBox(group), glassBox = new THREE.Box3().setFromObject(glass);
  assert.ok(box.max.y > TANK.neck.y + TANK.neck.h, 'the neck and its cap over the glass');
  assert.ok(box.max.z > glassBox.max.z + 0.15, 'the straps forward over the shoulders');
  const bare = buildFlask(glassMat(), { worn: false, stage: 0 }).group;
  assert.ok(visibleBox(bare).max.z < glassBox.max.z + 0.03, 'no plate or straps on the item');
  assert.ok(group.children.length > bare.children.length);
  // the menu's picture (src/boxes/model.js): the same glass
  const item = buildItemModel('backpack');
  let fluid = null;
  item.traverse((o) => { if (o.isMesh && o.material?.uniforms?.uFluidBase) fluid = o; });
  assert.ok(fluid && fluid.geometry.attributes.position.count === glass.geometry.attributes.position.count);
});

test('the stages: the lift valve, the wings and the jets each add their parts (the valve\'s wheel, the vanes, the second valve)', () => {
  assert.deepEqual(BACKPACK_STAGES, ['doublejump', 'glider', 'jetpack'], 'the double jump is its first strength');
  assert.equal(backpackStage(() => false), 0);
  assert.equal(backpackStage((id) => id === 'doublejump'), 1);
  assert.equal(backpackStage((id) => ['doublejump', 'glider', 'jetpack'].includes(id)), 3);
  const f = buildFlask(glassMat(), { stage: 0 });
  assert.equal(f.stages.length, 4);
  const heights = [];
  for (let s = 0; s <= 3; s++) {
    setStage(f, s);
    f.stages.forEach((g, i) => { if (g) assert.equal(g.visible, i <= s, `stage ${s}: its parts and those below it, ${i}`); });
    let n = 0; f.group.traverse((o) => { for (let w = o; w; w = w.parent) if (!w.visible) return; if (o.isMesh) n++; });
    heights.push(n);
  }
  for (let s = 1; s <= 3; s++) assert.ok(heights[s] > heights[s - 1], `stage ${s} adds something to see (${heights.join(' < ')})`);
  // the lift valve's wheel stands on the neck's cap
  setStage(f, 1);
  assert.ok(visibleBox(f.group).max.y > TANK.neck.y + TANK.neck.h + 0.03, 'the valve\'s wheel over the cap');
});

test('the scout keeps its place on the body, over the jar; the coral-shirt traveller wears it on his back', () => {
  // the dock at the same chest height as with the old tank (glass bottom 0.28, dock 0.52 × 1.2 up it, × 0.8)
  assert.ok(Math.abs(TANK.at[1] + SCOUT_DOCK_Y * TANK.scale - (0.28 + 0.52 * 1.2 * 0.8)) < 0.002);
  assert.ok(TANK_RAIL.top > TANK.neck.y + TANK.neck.h && SCOUT_CAP.y > TANK.neck.y + TANK.neck.h + 0.04, 'over the neck');
  assert.ok(TRAVELLER_V1_TANK_AT[2] > TANK.at[2] && TRAVELLER_V1_TANK_AT[1] === TANK.at[1], 'closer in: no rucksack under it');
});

// The pale star (a makers' box's cosmetic, src/boxes/effects.js): on the hood's brow when the hood is up,
// on the lapel with the head bare. Pinned to the brow over bare hair it hung in the air in front of his
// face in every moment's close-up (the cinematics QC pass, docs/systems/cinematics-qc.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createItemEffects, LAPEL_STAR } from '../src/boxes/effects.js';
import { items } from '../src/items.js';

const starOf = (o) => o.children.find((c) => c.geometry?.type === 'ExtrudeGeometry');
const rig = (hoodUp) => {
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial());
  hood.visible = hoodUp;
  const goggles = new THREE.Group();   // (a group in the hood's list that stays visible)
  return { headAnchor: new THREE.Group(), chestAnchor: new THREE.Group(), hood: [hood, goggles], outfit: false };
};

test('the star sits on the lapel with the head bare, on the brow under a hood, and moves when the hood does', () => {
  items.grant('star');
  const H = rig(false);
  const fx = createItemEffects({ player: { humanoid: H }, keys: null });
  assert.ok(starOf(H.chestAnchor), 'bare head: on the chest');
  assert.ok(!starOf(H.headAnchor), 'not over the hair');
  assert.ok(starOf(H.chestAnchor).position.equals(LAPEL_STAR.at));
  fx.dispose();
  const hooded = rig(true);
  const fx2 = createItemEffects({ player: { humanoid: hooded }, keys: null });
  assert.ok(starOf(hooded.headAnchor), 'hood up: on its brow');
  hooded.hood[0].visible = false;
  fx2.update(1 / 30, 0);
  assert.ok(items.has('star') && starOf(hooded.chestAnchor) && !starOf(hooded.headAnchor), 'the hood down: to the lapel');
  fx2.dispose();
});

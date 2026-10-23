import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { game } from '../src/game-state.js';
import { items, ITEMS, gearHtml } from '../src/items.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { createItemEffects } from '../src/boxes/effects.js';
import { migrateSave } from '../src/boxes/index.js';

// Exercise the shared effects implementation used by the browser and engine.
test('old seed-pouch saves keep their other gear but no longer grow flowers while walking', () => {
  game.reset();
  game.set('item.pouch', true);
  game.set('box.edena.pouch', true);
  game.set('item.fourthpouch', true);
  const player = { scene: new THREE.Scene(), pos: new THREE.Vector3(), onGround: true };
  const fx = createItemEffects({ player, keys: null });
  try {
    for (let step = 0; step < 60; step++) {
      player.pos.x += 0.5;
      fx.update(1 / 30, step / 30);
    }
    assert.equal(player.scene.children.filter(o => o.isInstancedMesh).length, 0, 'walking never allocates a flower pool');
    assert.equal(ITEMS.pouch, undefined);
    assert.equal(items.grant('pouch'), false);
    assert.ok(!items.owned().includes('pouch'));
    assert.doesNotMatch(gearHtml(items.owned()), /Seed pouch|flowers come up in your footsteps/);
    assert.ok(items.owned().includes('fourthpouch'), 'the unrelated ink-bomb upgrade is retained');
    assert.equal(game.flag('item.pouch'), true, 'obsolete save flags need no destructive migration');
    assert.equal(game.flag('box.edena.pouch'), true);
    assert.ok(!Object.values(PLACEMENTS).flat().some(p => p.item === 'pouch' || p.id === 'edena.pouch'));
    assert.ok(PLACEMENTS.edena.some(p => p.item === 'bloom'), 'the bloom gun remains available');
    assert.ok(PLACEMENTS.edena.some(p => p.item === 'lantern'), 'the court reward remains available');
  } finally { fx.dispose(); game.reset(); }
});

test('the bloom gun still plants five flowers at impact; later walking adds none', () => {
  game.reset();
  game.set('item.pouch', true); // A legacy ownership flag must not reactivate walking flowers.
  const player = { scene: new THREE.Scene(), pos: new THREE.Vector3(), onGround: true };
  const fx = createItemEffects({ player, keys: null });
  try {
    const point = new THREE.Vector3(8, 2, 4);
    game.emit('tool:bloom', { point });
    fx.update(0.6, 0.6);
    const pool = player.scene.children.find(o => o.isInstancedMesh);
    assert.ok(pool, 'a real bloom impact creates the shared instanced effect');
    const matrix = new THREE.Matrix4(), pos = new THREE.Vector3();
    const grown = () => {
      const out = [];
      for (let i = 0; i < pool.count; i++) {
        pool.getMatrixAt(i, matrix);
        // Zero-scale hidden instances use a singular matrix; decomposition may
        // return its safe identity fallback. Measure the actual basis instead.
        const e = matrix.elements;
        if (Math.hypot(e[0], e[1], e[2]) > 0.01) out.push(pos.setFromMatrixPosition(matrix).clone());
      }
      return out;
    };
    assert.equal(grown().length, 5);
    assert.ok(grown().every(p => p.distanceTo(point) < 0.8), 'all flowers grow around the impact');
    for (let step = 0; step < 60; step++) {
      player.pos.x += 0.5;
      fx.update(1 / 30, 0.6 + step / 30);
    }
    assert.equal(grown().length, 5, 'walking adds no flowers even after the bloom pool exists');
  } finally { fx.dispose(); game.reset(); }
});

// Retiring an inventory definition must not turn an item-era save into a pre-items save.
test('a retired pouch flag remains migration evidence without granting unrelated gear', () => {
  for (const owned of [true, false]) {
    game.reset();
    game.set('prologue.done', true);
    game.set('item.pouch', owned);
    try {
      assert.equal(migrateSave(game), false);
      assert.equal(!!game.flag('item.backpack'), false);
      assert.equal(game.flag('item.pouch'), owned);
      assert.equal(game.flag('items.v'), 2);
    } finally { game.reset(); }
  }
});

test('disposing bloom effects removes their pool and unsubscribes future impacts', () => {
  game.reset();
  const player = { scene: new THREE.Scene(), pos: new THREE.Vector3(), onGround: true };
  const fx = createItemEffects({ player, keys: null });
  try {
    game.emit('tool:bloom', { point: new THREE.Vector3(2, 0, 2) });
    fx.update(.6, .6);
    const pool = player.scene.children.find(o => o.isInstancedMesh);
    assert.ok(pool);
    fx.dispose();
    assert.equal(pool.parent, null);
    game.emit('tool:bloom', { point: new THREE.Vector3(3, 0, 3) });
    assert.equal(player.scene.children.filter(o => o.isInstancedMesh).length, 0);
  } finally { fx.dispose(); game.reset(); }
});

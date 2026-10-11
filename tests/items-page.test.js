import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ITEMS } from '../src/items.js';
import { PLACEMENTS, FALLBACKS } from '../src/boxes/placements.js';
import { TITLES } from '../src/levels/names.js';
import { itemsPage, whereFound } from '../src/items-page/view.js';
import { BUILD_INPUT } from '../vite.config.js';

test('the items page: every item with its picture, what it does, and where it is found', () => {
  assert.ok(Object.values(BUILD_INPUT).some((p) => p.endsWith('/items.html')), 'vite builds items.html');
  const cards = itemsPage(ITEMS, PLACEMENTS, FALLBACKS, TITLES);
  assert.equal(cards.length, Object.keys(ITEMS).length);
  for (const id of Object.keys(ITEMS)) assert.ok(existsSync(new URL(`../public/item-pictures/${id}.webp`, import.meta.url)), `${id}: its picture (node scripts/item-pictures.mjs)`);
  const w = whereFound('backpack', PLACEMENTS, FALLBACKS, TITLES);
  assert.ok(w.some((x) => x.world === 'desert' && /ledge/.test(x.note)), 'the backpack: Qanat\'s ledge on the tree');
  assert.ok(w.some((x) => x.title === 'By the ship'), 'and the spare by the ship');
  assert.ok(whereFound('sword', PLACEMENTS, FALLBACKS, TITLES).some((x) => x.temple), 'the blade: in a temple');
  // ember mode comes with the gun, in its chest in the Givers' Hearth (issue #83: one chest, not two side by side)
  assert.equal(whereFound('fire', PLACEMENTS, FALLBACKS, TITLES).length, 0, 'ember: no chest of its own');
  assert.ok(ITEMS.gun.with.includes('fire') && /Hearth/.test(ITEMS.fire.where), 'ember: with the gun, in the Givers’ Hearth');
  assert.match(cards.find((c) => c.id === 'fire').html, /comes with the fluid gun/);
  assert.match(cards.find((c) => c.id === 'glider').html, /Fluid wings/);
});

test('the items in 3D: dragging turns them within limits, zoom stays within its range', async () => {
  const { dragOrbit, zoomOrbit, VIEW } = await import('../src/items-page/viewer.js');
  const o = { yaw: 0, pitch: 0, zoom: 1 };
  dragOrbit(o, 100, 0); assert.ok(o.yaw < 0, 'a drag to the right turns it');
  dragOrbit(o, 0, 10000); assert.equal(o.pitch, VIEW.maxPitch, 'never over the top');
  zoomOrbit(o, 100); assert.equal(o.zoom, VIEW.maxZoom);
  zoomOrbit(o, 1e-6); assert.equal(o.zoom, VIEW.minZoom);
});

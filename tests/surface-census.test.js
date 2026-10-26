// The surface census's classes (scripts/surface-census/lib.mjs, docs/audits/surfaces-v2.30.md): what a material's
// options and compiled defines make it, and the shares by class.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, shares, walkPoints, TREATMENTS } from '../scripts/surface-census/lib.mjs';
import { surfaceDefines, MODE_STRATA, MODE_TERRAIN } from '../src/materials.js';

const of = (opts, extra = {}) => classify({ defines: surfaceDefines(opts), opts, ...extra }).cls;

test('a flat colour is plain, a ruled grid is grid only, bands alone are bands', () => {
  assert.equal(of({ color: '#ffffff', flat: true }), 'plain');
  assert.equal(of({ color: '#9fb2c6', grid: 3 }), 'grid');
  assert.equal(of({ color: '#9fb2c6', mode: MODE_STRATA, grid: 3 }), 'grid');
  assert.equal(of({ color: '#e6d6b8', mode: MODE_STRATA }), 'bands');
});

test('every surface treatment since v2.27 counts as treated', () => {
  assert.equal(of({ color: '#e9dcc2', grid: 3, paving: true }), 'treated');
  assert.equal(of({ color: '#c97a5a', timber: true }), 'treated');
  assert.equal(of({ color: '#c97a5a', weathered: 0.5 }), 'treated');
  for (const k of ['S_PAVING', 'S_INTERIOR', 'S_SHEET', 'S_TIMBER', 'S_SEAWALL', 'S_PALESTONE', 'S_BURIED', 'S_DOMES', 'S_CHANNEL', 'S_ROCKTOP', 'S_CRYSTAL'])
    assert.ok(TREATMENTS.includes(k), k);
});

test('skins, crystals and the left-out kinds', () => {
  assert.equal(of({ color: '#5b6585' }, { skin: true, finished: true }), 'skin');
  assert.equal(of({ color: '#a03a2a' }, { skin: true, finished: false }), 'skin-bare');
  assert.equal(of({ color: '#c7a6f2', flat: true, glow: 0.8, greatCrystal: true }), 'pending');
  assert.equal(of({ color: '#c7a6f2', flat: true, glow: 0.55 }, { world: 'perdide' }), 'pending');
  assert.equal(of({ color: '#ffd080', glow: 1 }), 'glow');
  assert.equal(of({ color: '#eebd8e', mode: MODE_TERRAIN, ticks: true }), 'terrain');
  assert.equal(of({ color: '#ffffff', glass: true }), 'glass');
});

test('shares count only the counted classes', () => {
  const s = shares([{ cls: 'plain', area: 30 }, { cls: 'treated', area: 70 }, { cls: 'terrain', area: 1000 }]);
  assert.equal(s.plain, 30); assert.equal(s.treated, 70); assert.equal(s.grid, 0);
});

test('a place stood at weighs more than a step on the path, with a ring round it', () => {
  const p = walkPoints({ samples: [{ pos: [0, 0, 0] }], places: [{ kind: 'person', pos: [10, 0, 0] }], dwell: 3, around: 6 });
  assert.equal(p.length, 1 + 1 + 6);
  assert.equal(p.reduce((s, x) => s + x.w, 0), 1 + 3 + 3);
});

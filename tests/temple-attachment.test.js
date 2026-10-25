// The compatibility registry and isolated world builders must share one runtime/helper contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import * as registry from '../src/temples/index.js';
import * as attachment from '../src/temples/attachment.js';
import { DESERT_TEMPLE } from '../src/temples/desert.js';
import * as DESERT_WORDS from '../src/temples/desert-data.js';
import { TempleRuntime } from '../src/temples/runtime.js';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
test('temple attachment helpers share identity through the compatibility registry', () => {
  for (const key of ['TEMPLE_HOME', 'templeWorld', 'addTemple', 'templeOf', 'navigationPortal', 'clearInstances', 'nextSpot']) {
    assert.equal(registry[key], attachment[key], key);
  }
  assert.equal(registry.TEMPLES.desert.def, DESERT_TEMPLE);
  assert.equal(registry.TEMPLES.desert.words, DESERT_WORDS);
  const level = { id: 'arzach' }, a = { id: 'arzach2', player: { pos: {} }, inside: () => false }, b = { id: 'arzach', inside: () => false };
  attachment.addTemple(level, a); registry.addTemple(level, b);
  assert.equal(level.temple, b, 'merged world defaults to its own temple');
  a.inside = () => true;
  assert.equal(level.temple, a, 'actual occupied temple wins');
  assert.equal(registry.templeOf(level, 'arzach2'), a);
  level.temple = a;
  assert.equal(level.temples.length, 2, 'compatibility setter cannot duplicate runtime');
});

test('explicit and registry attachments construct the same actual Rose House and preserve level hooks', () => {
  const make = explicit => {
    const scene = new THREE.Scene(), order = [], flags = {};
    const game = { flag: k => flags[k], set: (k, v) => { flags[k] = v; }, on: () => () => {}, emit() {} };
    const ownPortal = { id: 'own' }, ownSolid = {};
    const level = { id: 'desert', lights: [], portals: [ownPortal], dynamic: () => [ownSolid], update: () => order.push('world') };
    const result = explicit
      ? attachment.attachTempleDefinition('desert', { def: DESERT_TEMPLE, words: DESERT_WORDS }, scene, level, { game })
      : registry.attachTemple('desert', scene, level, { game });
    assert.equal(result, level);
    const rt = level.temple;
    assert.ok(rt instanceof TempleRuntime);
    assert.equal(rt.def, DESERT_TEMPLE);
    assert.equal(rt.game, game);
    assert.equal(level.portals.at(-1), ownPortal);
    assert.equal(level.dynamic()[0], ownSolid);
    rt.change = { late: () => order.push('temple') };
    const fade = () => {};
    level.update(.01, 2, { fade });
    assert.deepEqual(order, ['world', 'temple']);
    assert.equal(rt.fadeFn, fade);
    const shape = { id: rt.id, pieces: [...rt.byId.keys()], portals: rt.portals.map(p => ({ at: p.at.toArray(), to: p.to?.toArray() })) };
    rt.dispose();
    return shape;
  };
  assert.deepEqual(make(true), make(false));
  const level = {};
  assert.equal(registry.attachTemple('unknown', new THREE.Scene(), level), level, 'unknown compatibility id remains a no-op');
});

test('world builders import explicit temple entries, never the all-temple registry', () => {
  const worlds = ['arzach', 'arzach2', 'bazaar', 'buried', 'desert', 'edena', 'glass-dunes', 'incal', 'moon-foundry', 'perdide', 'perdide2', 'space-city', 'spheres', 'underwater'];
  for (const world of worlds) {
    const text = source(`../src/levels/${world}.js`);
    assert.doesNotMatch(text, /from\s*['"][^'"]*temples\/index\.js['"]/, world);
    assert.match(text, /attachTempleDefinition\(/, world);
  }
  const text = source('../src/temples/attachment.js');
  assert.doesNotMatch(text, /from\s*['"]\.\/index\.js['"]|\bTEMPLES\[/);
});

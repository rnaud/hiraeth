// The temple visual pass (docs/audits/temple-visuals-v1.31.md, docs/systems/temples.md "Each house its own look"):
// every house its own palette, bands, ornament and light inside; the bands cut the drawn wall, never its collision;
// the light handed over with the air only inside.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TempleKit, templeMaterials, templeLight, bandsOver } from '../src/temples/kit.js';
import { TEMPLES } from '../src/temples/index.js';
import { KEYS } from '../src/timeofday.js';
import { builtWorld } from './built-worlds.js';

test('every house has a look of its own: its walls, its frames, its light inside, its ornament', () => {
  const seen = new Map();
  for (const [id, { def }] of Object.entries(TEMPLES)) {
    const P = def.palette;
    assert.ok(P.light?.shadow && P.light?.light, `${id}: its own light inside`);
    assert.ok(P.look?.all, `${id}: its own shade (look.all)`);
    assert.ok(P.ornament?.kind, `${id}: an ornament by its friezes`);
    const key = `${P.wall} ${P.trim} ${P.light.shadow}`;
    assert.ok(!seen.has(key), `${id} looks as ${seen.get(key)} does`);
    seen.set(key, id);
    const M = templeMaterials(P);
    assert.ok(M.wall && M.floor && M.glyph && M.trimMat, `${id}: its materials`);
    assert.equal(M.ornament.kind, P.ornament.kind);
  }
  assert.equal(new Set(Object.values(TEMPLES).map(({ def }) => def.palette.ornament.kind)).size, Object.keys(TEMPLES).length, 'no two houses share an ornament');
});

test('a band crosses a wall at its share of the height, repeats up a tall one, and never runs into the cap', () => {
  const B = [{ at: 0.5, h: 1, mat: 'a' }, { y: 1, h: 1, every: 4, mat: 'b' }];
  const over = bandsOver(B, 10, 0, 10);
  assert.deepEqual(over.map((b) => [b.y0, b.y1, b.mat]), [[0.5, 1.5, 'b'], [4.5, 5.5, 'a'], [8.5, 9.5, 'b']], 'in order, the overlap given to the first');
  for (const b of over) assert.ok(b.y1 <= 9.5 + 1e-9, 'under the cap');
  assert.deepEqual(bandsOver(B, 10, 6, 10).map((b) => b.y0), [8.5], 'clipped to the block');
  assert.deepEqual(bandsOver(null, 10, 0, 10), []);
});

test('bands cut the drawn wall only: its collision is the same blocks, and no face inside the wall where pieces meet', () => {
  const build = (bands) => {
    const root = new THREE.Group();
    const M = templeMaterials({ wall: '#cccccc', floor: '#bbbbbb', trim: '#eeeeee', glow: '#70e7df', bands });
    const K = new TempleKit(root, 'test hall', new THREE.Vector3(), 0, M);
    K.hall({ x: 0, z: 0, w: 12, d: 16, h: 8, doors: [{ side: 'n', w: 4, h: 5 }], roof: false, frieze: false });
    K.flush();
    const coll = root.getObjectByName('test hall collision');
    return { root, coll, M };
  };
  const plain = build(), banded = build([{ at: 0.72, h: 1.2, color: '#884444' }, { y: 0.4, h: 0.6, color: '#448844' }]);
  const box = (m) => new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position);
  assert.equal(banded.coll.geometry.attributes.position.count, plain.coll.geometry.attributes.position.count, 'the same collision blocks');
  assert.ok(box(banded.coll).equals(box(plain.coll)));
  // where a band meets the wall (5.76 ± 0.6 and 0.4 ± 0.3 up an 8 m wall): drawn in its colour, and no face turned up or
  // down there (inside the wall they read as tops to stand on: src/contact-audit.js)
  const cuts = [0.1, 0.7, 5.16, 6.36];
  let inner = 0, bandTris = 0;
  banded.root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const P = o.geometry.attributes.position, N = o.geometry.attributes.normal, C = o.geometry.attributes.color;
    for (let i = 0; i < P.count; i += 3) {
      if (Math.abs(N.getY(i)) > 0.9 && cuts.some((y) => Math.abs(P.getY(i) - y) < 1e-3)) inner++;
      if (C && Math.abs(C.getX(i) - new THREE.Color('#884444').r) < 1e-3 && Math.abs(C.getY(i) - new THREE.Color('#884444').g) < 1e-3) bandTris++;
    }
  });
  assert.equal(inner, 0, 'no tops or bottoms where the pieces meet');
  assert.ok(bandTris > 20, `the band drawn in its own colour (${bandTris} triangles)`);
});

test('the house’s light: its own shade and light by day, the world’s mostly by night, the sky the world’s', () => {
  const L = templeLight(KEYS, { shadow: '#ff0000', light: '#00ff00', sun: '#0000ff' });
  assert.equal(L.length, KEYS.length);
  const at = (h) => L.find((k) => k[0] === h);
  assert.equal(at(9.0)[3], '#ff0000');
  assert.equal(at(9.0)[4], '#00ff00');
  assert.equal(at(9.0)[1], KEYS.find((k) => k[0] === 9)[1], 'the sky keeps the world’s');
  const night = new THREE.Color(at(0)[3]), world = new THREE.Color(KEYS[0][3]);
  assert.ok(Math.abs(night.r - world.r) < Math.abs(1 - world.r) * 0.5, 'by night mostly the world’s shade');
});

test('inside a temple the air carries the house’s light; outside, the world’s', () => {
  const { level } = builtWorld('desert');
  const rt = level.temple;
  const inside = rt.kit.world(0, 1, 20), outside = rt.outside.doorOut ?? rt.doorOut;
  const a = level.atmo(inside.x, inside.z, inside.y), b = level.atmo(outside.x, outside.z, outside.y);
  assert.ok(Array.isArray(a.script) && a.script === rt.lightScript, 'the house’s colour script inside');
  assert.notEqual(b.script, rt.lightScript, 'not outside');
  assert.ok(Array.isArray(a.tint) && typeof a.fog === 'number' && typeof a.name === 'string', 'the rest of the air the world’s');
});

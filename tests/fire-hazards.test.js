import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

// Every fire burns (issue #77, src/story/flames.js fireHazard): every set of flame tongues alive and every fire drawn
// as a still shape (staticFlame) burns whoever stands in it, as the Qanat tree's flame does, while it is drawn (lit,
// shown); a fire in another scene (a minigame's, the title's) never burns you in the world.

const { Flames, fireHazard, fireColumns, staticFlame, burningAt } = await import('../src/story/flames.js');
const { registerHazard, clearHazards, hazardAt, updateHazards, resetHazardNotes, HAZARD_DPS } = await import('../src/hazards.js');
const { buildableById } = await import('../src/levels/buildable.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

test('a fire burns while you stand in it, as the tree’s does; out of it, unlit, hidden or in another scene, it doesn’t', () => {
  clearHazards(); resetHazardNotes();
  const scene = new THREE.Scene(), g = new THREE.Group();
  g.position.set(10, 2, -4); scene.add(g);
  const f = new Flames(g, [{ at: V(0, 0, 0), h: 1.7, r: 0.5 }]);
  scene.updateMatrixWorld();
  const off = registerHazard(fireHazard(scene));
  const hurts = [];
  const player = { pos: V(10, 2, -4), hurt: (n, why) => hurts.push([n, why]), ride: null };
  for (let i = 0; i < 30; i++) updateHazards(1 / 30, player, { notice: () => {} });
  assert.ok(hurts.length >= 3 && hurts.every(([, why]) => why === 'fire'), `burnt (${hurts.length} bites)`);
  assert.equal(hazardAt(V(10, 2, -4))?.kind, 'fire');
  assert.equal(hazardAt(V(11.2, 2, -4)), null, 'a step beside it: no');
  assert.equal(hazardAt(V(10, 4.2, -4)), null, 'over its tip: no');
  f.intensity = 0; assert.equal(hazardAt(V(10, 2, -4)), null, 'out (no intensity): no'); f.intensity = 1;
  f.mesh.visible = false; assert.equal(hazardAt(V(10, 2, -4)), null, 'hidden (unlit): no'); f.mesh.visible = true;
  // a fire in another scene (a minigame's stage, the title's world) never burns you in this one
  const other = new THREE.Scene(); new Flames(other, [{ at: V(0, 0, 0), h: 2, r: 1 }]); other.updateMatrixWorld();
  assert.equal(burningAt(scene, V(0, 0, 0)), false);
  // a still flame (a glowing cone in a brazier) burns too, while its mesh is shown
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 6)); cone.position.set(-5, 1, 0); scene.add(cone); scene.updateMatrixWorld();
  staticFlame(cone, [V(0, -0.5, 0)], { r: 0.4, h: 1 });
  assert.equal(hazardAt(V(-5, 0.4, 0))?.kind, 'fire');
  cone.visible = false; assert.equal(hazardAt(V(-5, 0.4, 0)), null, 'a lamp not lit: no');
  assert.equal(HAZARD_DPS.fire, fireHazard(scene).dps, 'the same burn as the tree’s flame');
  off(); clearHazards();
});

test('every fire in the worlds burns: each tongue of every flame drawn, the braziers, the hearth, the candles, the lit cairn lamps', () => {
  for (const id of ['desert', 'arena', 'home', 'incal']) {
    const scene = new THREE.Scene();
    const level = quiet(() => buildableById(id).create(scene));
    void level;
    if (id === 'desert') scene.traverse((o) => { if (o.isMesh && /cairn lamp/i.test(o.name)) o.visible = true; });   // (the pilgrims' road lit)
    scene.updateMatrixWorld(true);
    clearHazards();
    registerHazard(fireHazard(scene));
    const cols = fireColumns(scene);
    assert.ok(cols.length > 0, `${id}: its fires`);
    for (const c of cols) {
      const feet = V(c.base.x, c.base.y - 0.3, c.base.z);
      assert.equal(hazardAt(feet)?.kind, 'fire', `${id}: the fire at ${c.base.toArray().map((n) => n.toFixed(1))} burns`);
    }
    // anything drawn as a flame by name is one of them (a new still flame must be registered: staticFlame)
    const named = [];
    scene.traverse((o) => { if (o.isMesh && o.visible && /flame|candle|hearth fire|cairn lamp/i.test(o.name)) named.push(o); });
    for (const o of named) {
      const box = new THREE.Box3().setFromObject(o), c = box.getCenter(V(0, 0, 0));
      const near = cols.some((k) => Math.hypot(k.base.x - c.x, k.base.z - c.z) < Math.max(2, box.getSize(V(0, 0, 0)).length()));
      assert.ok(near, `${id}: “${o.name}” is drawn as a fire and burns (src/story/flames.js staticFlame)`);
    }
    clearHazards();
  }
});

test('main.js registers the one fire hazard for the world, and the still flames are registered where they are drawn', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /registerHazard\(fireHazard\(scene\)\)/);
  for (const f of ['../src/levels/arena.js', '../src/levels/home-houses.js', '../src/desert-road.js', '../src/levels/incal.js'])
    assert.match(readFileSync(new URL(f, import.meta.url), 'utf8'), /staticFlame\(/, f);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { templeOf } from '../src/temples/index.js';
import { FINALE, finaleShots, keeperBox } from '../src/temples/finale.js';
import { Moment } from '../src/story/moment.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { V, quiet, blocker } from './temple-finale-house.js';

for (const generated of [false, true]) test(`Elder helper celebration keeps a readable animated subject with a normal lens (${generated ? 'accepted GLB' : 'procedural fallback'})`, async () => {
  // A fresh actual room/model: this must catch the observed cropped head, not
  // merely assert that the new camera helper was called.
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById('arzach').create(scene));
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, 'arzach'), G = rt.guardian;
  if (generated) {
    const { loadElderGltf } = await import('../scripts/tripo/elder-cycles.mjs');
    const { createElderCreature } = await import('../src/characters/elder-v3-creature.js');
    G.model.swap(createElderCreature(await loadElderGltf(), { gameMaterial: true }));
    assert.equal(G.model.generated, true, 'actual committed accepted Elder skin, not its procedural stand-in');
  }
  const bodyBounds = () => {
    const inner = G.model.inner;
    G.model.group.updateMatrixWorld(true);
    if (!generated) return keeperBox({ group: inner.rig });
    const bounds = new THREE.Box3();
    for (const mesh of inner.meshes) bounds.union(keeperBox({ group: mesh }));
    assert.ok(!bounds.isEmpty(), 'posed accepted skin has real bounds');
    return bounds;
  };
  scene.updateMatrixWorld(true);
  // Actual grounded return recorded in both completed browser runs, including
  // 1792772473162 (the rejected 148.94-degree frame), not a recomputed arena pose.
  const pos = V(-390, 1672, -461.95);
  rt.player = { pos, vel: V(), heading: 0, riding: false, dead: false };
  quiet(() => G.resolve());
  const film = finaleShots(rt), moment = new Moment({ shots: film.shots, stage: { physics } });
  const dt = 1 / 30; let samples = 0;
  for (let t = 0; t < FINALE.keeper + FINALE.reward; t += dt) {
    quiet(() => G.update(dt, t));
    if (t < FINALE.keeper + .05) continue;
    moment.t = t; const c = moment.camera(), body = bodyBounds();
    assert.equal(film.shots[1].portraitAvailable, true, 'room-view fallback is not accepted as Elder framing');
    assert.ok(Number.isFinite(c.fov) && c.fov <= 60, `bounded finite lens at ${t}`);
    assert.ok(!physics.embedded(c.pos), `lens outside real room solids at ${t}`);
    assert.ok(!body.containsPoint(c.pos), `lens outside animated Elder at ${t}`);
    for (const aspect of [4 / 3, 16 / 9]) {
      const cam = new THREE.PerspectiveCamera(c.fov, aspect, .1, 2000);
      cam.position.copy(c.pos); cam.lookAt(c.look); cam.updateMatrixWorld();
      const projected = [];
      for (const x of [body.min.x, body.max.x]) for (const y of [body.min.y, body.max.y]) for (const z of [body.min.z, body.max.z]) {
        const ndc = V(x, y, z).project(cam); projected.push(ndc);
        assert.ok(ndc.z < 1 && Math.abs(ndc.x) < .92 && Math.abs(ndc.y) < .78, `whole animated body in ${aspect} letterbox at ${t}: ${ndc.toArray()}`);
      }
      const height = (Math.max(...projected.map(p => p.y)) - Math.min(...projected.map(p => p.y))) / 2;
      assert.ok(height >= .22, `Elder occupies at least 22% of image height, not a distant speck: ${height}`);
      assert.ok(rt.inside(c.pos), 'normal lens remains inside the hall');
      assert.equal(blocker(rt, c.pos, c.look, [G.model.group]), null, 'drawn walls do not hide the Elder');
    }
    samples++;
  }
  assert.ok(samples > 50, 'exercise the animated second panel throughout, including the observed 4.2-second crop');
  const inside = rt.inside;
  try {
    rt.inside = () => false;
    moment.camera();
    assert.equal(film.shots[1].portraitAvailable, false, 'invalidated cached lens uses explicitly identified room fallback');
    assert.equal(film.shots[1].clear, film.shots[0].clear, 'fallback retains checked room collision policy');
  } finally { rt.inside = inside; }
});

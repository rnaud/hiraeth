import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Grass, GRASS_QUALITY, FAR_TUFT, tuftGeometry } from '../src/flora-grass.js';
import { grassLod, tuftScale, tuftLook, GRASS_VERT_PARS } from '../src/grass-shader.js';

// Looking straight ahead: a tuft dc metres in front of the camera is |dc - 0.45 R| from its patch's centre.
const AHEAD = 0.45;
const layers = (q) => ({ near: grassLod(q.radius, q.far.radius, false, q.far.density / q.density), far: grassLod(q.radius, q.far.radius, true) });
const ranks = Array.from({ length: 200 }, (_, i) => (i + 0.5) / 200);

test('grass fade: every tuft shrinks away smoothly with distance (no step anywhere, near or far)', () => {
  for (const [key, q] of Object.entries(GRASS_QUALITY)) {
    const L = layers(q);
    for (const [name, P, R] of [['near', L.near, q.radius], ['far', L.far, q.far.radius]]) {
      for (const r of ranks) {
        let last = tuftScale(P, r, 0, AHEAD * R), worst = 0;
        for (let dc = 0.05; dc < R * 1.6; dc += 0.05) {
          const s = tuftScale(P, r, dc, Math.abs(dc - AHEAD * R));
          worst = Math.max(worst, Math.abs(s - last));
          last = s;
        }
        assert.ok(worst < 0.05, `${key} ${name} rank ${r.toFixed(3)}: a step of ${worst.toFixed(3)} over 5 cm (each grows or goes over a metre at least)`);
      }
      // and gone before the patch wraps (its edge round the centre)
      for (const r of ranks) assert.equal(tuftScale(P, r, R * (AHEAD + 0.9), R * 0.9), 0);
    }
  }
});

test('grass fade: the field thins from the near patch into the far layer, without a gap, and fades into the ground at the end', () => {
  for (const [key, q] of Object.entries(GRASS_QUALITY)) {
    const L = layers(q), end = q.far.radius * (AHEAD + 0.9);
    // the blades drawn per m² (each weighted by its height left), along the view
    const cover = (dc) => {
      let n = 0, f = 0;
      for (const r of ranks) {
        n += tuftScale(L.near, r, dc, Math.abs(dc - AHEAD * q.radius));
        f += tuftScale(L.far, r, dc, Math.abs(dc - AHEAD * q.far.radius));
      }
      return (n * q.density + f * q.far.density) / ranks.length;
    };
    let prev = cover(0), rises = 0;
    for (let dc = 0.5; dc < end; dc += 0.5) {
      const c = cover(dc);
      if (dc < q.far.radius * (AHEAD + 0.6)) assert.ok(c > 0.03, `${key}: grass at ${dc} m (${c.toFixed(3)} per m²)`);
      if (c > prev * 1.08 + 1e-4) rises++;
      prev = c;
    }
    assert.ok(rises === 0, `${key}: the density never climbs again on the way out (${rises})`);
    assert.equal(cover(end + 0.1), 0, `${key}: nothing past the far layer`);
    // the far layer has taken the ground's colour (and lost its outline) by its end
    assert.ok(tuftLook(L.far, end * 0.95) > 0.9, `${key}: blended at the far end`);
    assert.ok(tuftLook(L.near, q.radius * 0.5) === 0, `${key}: near blades keep their own colour`);
    // a near tuft and a far one at the same distance look alike (one look for both layers)
    assert.deepEqual(L.near.look.slice(0, 2), L.far.look.slice(0, 2));
  }
});

test('grass fade: twice the reach for fewer triangles than before, on every preset', () => {
  // before: one patch, three-blade tufts; the field ended 1.35 R ahead of the camera
  const before = { high: [26, 4.5], medium: [22, 4], auto: [22, 4], low: [15, 3.4], handheld: [13, 3] };
  const tris = (R, d, perTuft) => Math.max(8, Math.round(R * 2 * Math.sqrt(d))) ** 2 * perTuft;
  const farTris = tuftGeometry(FAR_TUFT).index.count / 3;
  assert.equal(farTris, 6, 'two blades a far tuft');
  for (const [key, [R0, d0]] of Object.entries(before)) {
    const q = GRASS_QUALITY[key];
    const old = tris(R0, d0, 9), now = tris(q.radius, q.density, 9) + tris(q.far.radius, q.far.density, farTris);
    assert.ok(now <= old, `${key}: ${now} triangles, before ${old}`);
    assert.ok(q.far.radius * (AHEAD + 0.9) >= 2 * R0 * (AHEAD + 0.9), `${key}: the field reaches twice as far`);
  }
  const g = new Grass({ scene: new THREE.Scene(), fields: [{ heightAt: () => 0, color: new THREE.Color('#8cc77e'), color2: new THREE.Color('#9fd08a'), inside: () => true }], quality: GRASS_QUALITY.high });
  assert.equal(g.meshes.length, 2, 'two draw calls');
  assert.equal(g.triangles, tris(22, 4.5, 9) + tris(58, 0.3, 6));
  assert.ok(g.far.mesh.material !== g.mesh.material && g.far.mask === g.mask, 'its own fade, the same built-on mask');
});

test('grass fade: turning round slides the patch across instead of jumping it', () => {
  const field = { heightAt: () => 0, color: new THREE.Color('#8cc77e'), color2: new THREE.Color('#9fd08a'), inside: () => true };
  const g = new Grass({ scene: new THREE.Scene(), fields: [field], quality: { radius: 10, density: 1 } });
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(0, 2, 0); cam.lookAt(0, 2, -10); cam.updateMatrixWorld();
  let t = 1000;
  g.update(cam, t);
  const centre = () => g.material.uniforms.uGrassView.value;
  assert.ok(Math.abs(centre().y + 4.5) < 1e-6, 'the first frame: straight ahead at once');
  cam.lookAt(0, 2, 10); cam.updateMatrixWorld();   // a quick turn round
  g.update(cam, (t += 16.7));
  assert.ok(centre().y < -3.5, `one frame later it has hardly moved (${centre().y.toFixed(2)})`);
  for (let i = 0; i < 120; i++) g.update(cam, (t += 16.7));
  assert.ok(Math.abs(centre().y - 4.5) < 0.1, `then it follows within two seconds (${centre().y.toFixed(2)})`);
  // walking moves it with you at once
  cam.position.x += 3; cam.updateMatrixWorld();
  g.update(cam, (t += 16.7));
  assert.ok(Math.abs(centre().x - 3) < 1e-6);
  assert.ok(GRASS_VERT_PARS.includes('flat out vec3 vGrassLook'));
});

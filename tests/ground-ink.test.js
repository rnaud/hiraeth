import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GROUND, penLine, lineField } from '../src/ground-ink.js';
import { makeMaterial, MODE_OUTFIT, MODE_TERRAIN } from '../src/materials.js';
import { createPost } from '../src/post.js';

// average ink of a line field over one period (u in periods), sampled finely
const meanInk = (g, hw, mask = 1, maskMean = 1) => {
  let s = 0; const n = 4000;
  for (let i = 0; i < n; i++) s += lineField(i / n, g, hw, mask, maskMean);
  return s / n;
};

test('ground ink: a line field keeps its average tone at every distance (no pop as it fades)', () => {
  for (const { period, half } of [GROUND.ripple, GROUND.wind]) {
    const hw = half / period;            // in periods
    const tone = 2 * hw;                 // what it hands over to
    let prev = null;
    // from a few px per period (where it is only its tone) out to resolved but sub-pixel lines
    for (let pxPerPeriod = 1.5; pxPerPeriod <= 0.5 * GROUND.minHalfPx / hw; pxPerPeriod *= 1.07) {
      const m = meanInk(1 / pxPerPeriod, hw);
      assert.ok(Math.abs(m - tone) < tone * 0.12, `${period} m lines at ${pxPerPeriod.toFixed(1)} px/period: ${m} vs ${tone}`);
      if (prev !== null) assert.ok(Math.abs(m - prev) < tone * 0.05, 'no jump between neighbouring distances');
      prev = m;
    }
  }
});

test('ground ink: pen lines stay within 0..1, at least ~1 px wide, lighter (not thinner) once sub-pixel', () => {
  for (const g of [0.001, 0.01, 0.05, 0.2]) for (let d = 0; d < 0.5; d += 0.01) {
    const v = penLine(d, g, 0.01);
    assert.ok(v >= 0 && v <= 1);
  }
  const thin = penLine(0, 0.1, 0.01), thinner = penLine(0, 0.2, 0.01);   // true half widths 0.1 px, 0.05 px
  assert.ok(thin > thinner && Math.abs(thin / thinner - 2) < 0.05, 'ink halves as the true width halves');
  assert.ok(penLine(0.5 * GROUND.minHalfPx * 0.2, 0.2, 0.01) > 0, 'drawn over at least ~1 px');
  assert.equal(penLine(0, 0.001, 0.01), 1, 'close up: full ink');
});

test('terrain material carries the ground ink by distance; facets take their normal from camera-relative derivatives', () => {
  const m = makeMaterial({ color: '#efd29b', mode: MODE_TERRAIN, ripples: true, biomes: true, sandInk: true });
  for (const fn of ['float penLine(', 'float sandRipples(vec2 p, float slope)', 'float sandGrains(', 'float voronoiEdge(', 'float mudCracks(vec2 p, vec2 q1']) {
    assert.ok(m.fragmentShader.includes(fn), fn);
  }
  // the old pixel-width fade-outs (the pop-in band) are gone
  assert.ok(!m.fragmentShader.includes('rippleFw') && !m.fragmentShader.includes('crackFw'));
  assert.ok(m.vertexShader.includes('vObjRel = vObjPos -'));
  assert.ok(m.fragmentShader.includes('cross(dFdx(vObjRel), dFdy(vObjRel))'));
});

test('camera-relative object position: same point as the object-space position, measured from the camera', () => {
  // mirrors the vertex shader: vObjRel = vObjPos - (dot(M[i], cam - T) / scl[i])
  const M = new THREE.Matrix4().compose(new THREE.Vector3(230, 4, 400), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -2.6, 0.1)), new THREE.Vector3(1.5, 2, 0.7));
  const cam = new THREE.Vector3(180, 7, 300);
  const e = M.elements, col = (i) => new THREE.Vector3(e[i * 4], e[i * 4 + 1], e[i * 4 + 2]);
  const scl = [0, 1, 2].map((i) => col(i).length()), T = col(3);
  const camL = cam.clone().sub(T);
  const camS = [0, 1, 2].map((i) => col(i).dot(camL) / scl[i]);
  const R = new THREE.Matrix4().extractRotation(M), Rt = R.clone().transpose();
  for (const p of [[1, 2, 3], [-4, 0.5, 9], [0, 0, 0]]) {
    const pos = new THREE.Vector3(...p);
    const objPos = pos.clone().multiply(new THREE.Vector3(...scl));
    const rel = objPos.clone().sub(new THREE.Vector3(...camS));
    const expect = pos.clone().applyMatrix4(M).sub(cam).applyMatrix4(Rt);   // world offset from the camera, in the object's axes
    assert.ok(rel.distanceTo(expect) < 1e-9, `${rel.toArray()} vs ${expect.toArray()}`);
  }
});

test('people are flagged for the outline pass; post.js decodes the flag before the hero bit', () => {
  assert.equal(makeMaterial({ color: '#c8483a', mode: MODE_OUTFIT }).uniforms.uFigure.value, 1);
  assert.equal(makeMaterial({ color: '#ffffff', crowd: true }).uniforms.uFigure.value, 1);
  assert.equal(makeMaterial({ color: '#3a2a22', figure: true }).uniforms.uFigure.value, 1);
  assert.equal(makeMaterial({ color: '#3a2a22' }).uniforms.uFigure.value, 0, 'a plain prop is not a person (and is a separate cached material)');
  const m = makeMaterial({ color: '#ffffff' });
  assert.ok(m.fragmentShader.includes('+ 2.0 * uHero + 4.0 * uFigure'));
  const post = createPost().scene.children[0].material.fragmentShader;
  const flag = post.indexOf('float figure = step(3.5, surface.a)'), hero = post.indexOf('float hero = step(1.5, surface.a)');
  assert.ok(flag > 0 && hero > flag, 'figure bit removed before the hero bit is read');
  assert.ok(post.includes('float figPx = 1.8 * uRes.y * 0.5 * uProj11'));
});

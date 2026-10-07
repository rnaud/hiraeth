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

// Pebbles on the sand (ground-ink.js PEBBLES): the print's spots are small cast shadows of pebbles and stones
test('pebbles: the shadow runs away from the light, longer as the light is low, and the lit side stays the sand', async () => {
  const { PEBBLES, pebbleShadow, pebbleInk } = await import('../src/ground-ink.js');
  // longer at a low sun, within its bounds
  assert.ok(pebbleShadow(0.2) > pebbleShadow(0.6) && pebbleShadow(0.6) >= pebbleShadow(0.95));
  assert.equal(pebbleShadow(0.01), PEBBLES.len[1]);
  assert.equal(pebbleShadow(1), PEBBLES.len[0]);
  const r = 0.05, gm = 0.005, len = pebbleShadow(0.3);   // a 10 px pebble, an afternoon sun
  // (x toward the light) the side away from the light is inked, its lit side is not (bar the rim)
  assert.ok(pebbleInk([-0.6 * r, 0], r, len, gm, 1) > 1, 'its dark side');
  assert.equal(pebbleInk([0.5 * r, 0], r, len, gm, 1), 0, 'its lit side keeps the sand');
  // the cast shadow behind it, away from the light, and none on the light's side
  assert.ok(pebbleInk([-(1 + 0.5 * len) * r, 0], r, len, gm, 1) > 0.9, 'its shadow on the sand');
  assert.equal(pebbleInk([2.5 * r, 0], r, len, gm, 1), 0, 'nothing toward the light');
  assert.equal(pebbleInk([-(1 + 0.5 * len) * r, 0], r, len, gm, 0), 0, 'no cast shadow where the sand is already in shade');
});

test('pebbles: far off a pebble is drawn lighter, not thinner, so the ink it holds stays the same', async () => {
  const { pebbleShadow, pebbleInk } = await import('../src/ground-ink.js');
  const r = 0.02, len = pebbleShadow(0.4);
  const inkOf = (gm) => {
    let s = 0; const st = gm / 4, R = r * (len + 3) * 2;
    for (let x = -R; x <= R; x += st) for (let y = -R; y <= R; y += st) s += pebbleInk([x, y], r, len, gm, 1) * st * st;
    return s;
  };
  const near = inkOf(0.004);   // 5 px radius
  for (const gm of [0.03, 0.06, 0.1]) {   // under a pixel
    const far = inkOf(gm);
    assert.ok(Math.abs(far - near) < near * 0.35, `at ${gm} m/px: ${far.toExponential(2)} vs ${near.toExponential(2)}`);
  }
});

test('pebbles take the place of the dots and grains on rippled sand in the print look', () => {
  const f = makeMaterial({ color: '#efd29b', mode: MODE_TERRAIN, ripples: true, sandInk: true, key: 't.pebbles' }).fragmentShader;
  assert.equal((f.match(/pebbleField\(gp, gm, s2, len, castK,/g) ?? []).length, 3, 'grit, pebbles and stones');
  assert.ok(f.includes('float grains = uDots > 0.0 ? 0.0 : sandGrains('), "the grains' dots only outside the print look");
  assert.ok(f.includes('vec2 s2 = uSunDir.xz / max(length(uSunDir.xz), 1e-3);'), "the shadows from the world's light");
  assert.ok(!f.includes('0.55, 0.03, 0.06, 13.0)'), 'the coarse pen dots gone from the sand');
});

// "At noon the sand looks much emptier": as the sun climbs the pebbles' shadows shrink to stubs, so a high sun
// lays more of them, a little bigger (PEBBLES.noon); dawn and dusk, their long shadows, are as they were.
test('pebbles: a high sun lays more of them, a little bigger; a low sun none more', async () => {
  const { PEBBLES, pebbleNoon, pebbleShadow, pebbleMean } = await import('../src/ground-ink.js');
  for (const y of [0.05, 0.276, 0.515, 0.693]) assert.deepEqual(pebbleNoon(y), { count: 1, size: 1 }, `a lower sun (${y}: dawn, dusk, 8 and 9 h): as drawn`);
  const noon = pebbleNoon(0.88);
  assert.equal(noon.count, 1 + PEBBLES.noon.count); assert.equal(noon.size, 1 + PEBBLES.noon.size);
  for (let y = 0.3; y < 1; y += 0.05) assert.ok(pebbleNoon(y + 0.05).count >= pebbleNoon(y).count, 'rising with the sun');
  // the ink a patch of sand holds (the pebbles' scale): at noon at least what mid-morning (the sun at ~31°) held
  const ink = (y) => { const { count, size } = pebbleNoon(y), P = PEBBLES.pebble, r = (P.r[0] + P.r[1]) / 2 * size; return pebbleMean(r * r, pebbleShadow(y), P.cell, P.density * count, 1); };
  assert.ok(ink(0.88) >= ink(0.515), `noon ${ink(0.88).toFixed(5)} against mid-morning ${ink(0.515).toFixed(5)}`);
  assert.ok(ink(0.88) < 2.2 * ink(0.515), 'and not a carpet');
  // the shader's: the same numbers, on all three scales
  const f = makeMaterial({ color: '#efd29b', mode: MODE_TERRAIN, ripples: true, sandInk: true, key: 't.pebbles.noon' }).fragmentShader;
  assert.match(f, new RegExp(`smoothstep\\(${PEBBLES.noon.from.toFixed(2)}, ${PEBBLES.noon.to.toFixed(2)}, uSunDir\\.y\\)`));
  assert.equal((f.match(/\* nc, vec2\(/g) ?? []).length, 3);
  assert.equal((f.match(/\) \* ns, /g) ?? []).length, 3);
});

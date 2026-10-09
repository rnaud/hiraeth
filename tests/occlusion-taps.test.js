// The composite's two screen-space occlusion estimates (post.js: crease shading's creaseAO, the spot
// blacks' enclosure) made cheaper without changing what they compute: constant tap directions, the
// view ray taken as affine in uv, no branch inside the loops (docs/systems/performance.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createPost, OCCLUSION_TAPS, glslVec2s, occlusionShare } from '../src/post.js';

const shader = createPost().scene.children[0].material.fragmentShader;
const body = (name) => {
  const a = shader.indexOf(`float ${name}(`);
  assert.ok(a >= 0, name);
  let depth = 0, i = shader.indexOf('{', a);
  for (let j = i; j < shader.length; j++) {
    if (shader[j] === '{') depth++;
    else if (shader[j] === '}' && --depth === 0) return shader.slice(i, j + 1);
  }
  throw new Error(`unclosed ${name}`);
};

test('the spot taps are the directions the shader used to work out per pixel', () => {
  for (const n of [8, 4]) {
    const taps = OCCLUSION_TAPS.spot(n);
    assert.equal(taps.length, n);
    taps.forEach(([x, y], i) => {
      const a = 0.39 + (i * 6.2832) / n, r = (Math.floor(i / 2) * 2 === i) ? 1 : 0.55;
      assert.ok(Math.abs(x - Math.cos(a) * r) < 1e-12 && Math.abs(y - Math.sin(a) * r) < 1e-12, `${n} taps, #${i}`);
    });
    assert.ok(shader.includes(glslVec2s(`SPOT_TAPS${n}`, taps)), `SPOT_TAPS${n} in the composite`);
  }
  assert.match(glslVec2s('X', [[1, -0.5]]), /^const vec2 X\[1\] = vec2\[1\]\(vec2\(1\.0000000, -0\.5000000\)\);$/);
});

test('no skip (continue / break), cos or sin inside the occlusion loops', () => {
  for (const name of ['enclosure', 'creaseAO']) {
    const b = body(name);
    assert.ok(!/\bcontinue\b|\bbreak\b/.test(b), `${name}: a tap that doesn't count weighs 0, it isn't skipped`);
  }
  const enc = body('enclosure');
  assert.ok(!/\b(cos|sin)\(/.test(enc), 'the spot taps are constants');
  assert.ok(!/viewPos\(suv/.test(enc), 'the tap positions from the affine ray');
  const ao = body('creaseAO');
  assert.equal((ao.match(/\bcos\(/g) ?? []).length, 2, 'crease shading: one turn per pixel (and the spiral\'s own constant steps)');
  // the surface flags (is the tap on a grass blade, or a person?) only read for a tap that would close something in,
  // or one nearer than the point (a person hiding what stands behind them)
  assert.match(ao, /if \(c > 0\.0 \|\| \(sd > 0\.0 && sd < d\)\) \{ float t = mod\(texture\(tHatch, suv\)\.a, 16\.0\); np = step\(mod\(t, 8\.0\), 1\.5\); c \*= step\(t, 7\.5\) \* np; \}/);
  assert.equal((ao.match(/texture\(tHatch/g) ?? []).length, 1);
});

test('a person closes nothing in: no spot-black or crease halo round a climber or round people’s feet', () => {
  // gHatch.a packs glow (0..1) + 2 hero + 4 figure + 8 soft + 16 face + 32 drift: notPerson(suv) is 0 on the
  // traveller and on anyone else, whatever else the pixel carries, and 1 on everything that isn't a person
  const notPerson = (a) => ((a % 8) <= 1.5 ? 1 : 0);   // (GLSL step(mod(a, 8), 1.5))
  for (const glow of [0, 0.6, 1]) for (const soft of [0, 8]) for (const face of [0, 16]) for (const drift of [0, 32]) {
    const rest = glow + soft + face + drift;
    assert.equal(notPerson(rest), 1, `not a person: ${rest}`);
    assert.equal(notPerson(rest + 2), 0, `the traveller: ${rest + 2}`);
    assert.equal(notPerson(rest + 4), 0, `a figure: ${rest + 4}`);
  }
  assert.ok(shader.includes('float notPerson(vec2 suv) { return step(mod(texture(tHatch, suv).a, 8.0), 1.5); }'));
  const enc = body('enclosure');
  // both loops (8 taps, 4 on the handheld): a person's tap is left out of the share (below)
  // (a tap on a person first looks past them, twice as far out; still on one, it is left out)
  assert.equal((enc.match(/float np = notPerson\(suv\);\s*if \(np < 0\.5\) \{ suv = uv \+ 2\.0 \* o; np = notPerson\(suv\); \}/g) ?? []).length, 2);
  assert.equal((enc.match(/occ \+= c \* np; seen \+= np;/g) ?? []).length, 2);
  assert.equal((enc.match(/return occ \/ max\(seen, 1\.0\);/g) ?? []).length, 2);
  assert.ok(!/texture\(tHatch/.test(enc));
});

test('a person in front leaves no pale ghost in the shading behind them (Marrow by the ship, the tree’s stairs)', () => {
  // a point in a recess: 6 of 8 taps close it in. A person steps in front and hides 3 of them: counted as open
  // (before) the share fell from 0.75 to 0.375 and the spot-black mass got a pale hole the person's shape; left
  // out, the share is the remaining taps' and a person in front of open ground closes nothing
  const recess = [1, 1, 1, 1, 1, 1, 0, 0].map((c) => ({ c, person: false }));
  assert.equal(occlusionShare(recess), 0.75);
  const hidden = recess.map((t, i) => (i < 3 ? { c: 0, person: true } : t));
  assert.ok(Math.abs(occlusionShare(hidden) - 0.6) < 1e-12, 'the five taps still seeing the recess');
  const before = hidden.reduce((a, t) => a + t.c, 0) / 8;
  assert.ok(occlusionShare(hidden) > before + 0.2, 'no longer counted as open');
  // a uniform recess: hiding any taps leaves the share as it was
  const full = Array.from({ length: 8 }, () => ({ c: 1, person: false }));
  assert.equal(occlusionShare(full.map((t, i) => (i % 3 ? t : { c: 0, person: true }))), 1);
  // open ground with a person in front: still open; every tap on the person: open
  assert.equal(occlusionShare(Array.from({ length: 8 }, (_, i) => ({ c: 0, person: i < 5 }))), 0);
  assert.equal(occlusionShare(Array.from({ length: 4 }, () => ({ c: 1, person: true }))), 0);
  // crease shading takes the same share (the clamp x 2.2 over it)
  assert.match(body('creaseAO'), /return clamp\(ao \/ max\(seen, 1\.0\) \* 2\.2, 0\.0, 1\.0\);/);
  // and so does the Unity port's composite (it had no person test at all)
  const unity = readFileSync(new URL('../unity/Memento/Assets/Memento/Shaders/Composite.shader', import.meta.url), 'utf8');
  assert.equal((unity.match(/return (saturate\(ao|occ) \/ max\(seen, 1\.0\)/g) ?? []).length, 2);
  assert.equal((unity.match(/np = step\(fmod\((t|tH\(suv\)\.a), 8\.0\), 1\.5\)/g) ?? []).length, 2);
});

test('the view ray is affine in uv, so a tap can be placed without the inverse projection', () => {
  // post.js viewPos(uv, d) = r / -r.z * d with r = invProj * (uv * 2 - 1, 1, 1): its xy at d = 1 must be
  // uv * rA + rB, rA and rB taken from viewPos at (0, 0) and (1, 1), for any perspective camera (an
  // off-centre one too: the photo mode's and the portraits' view offsets)
  const viewPos = (inv, u, v) => {
    const p = new THREE.Vector4(u * 2 - 1, v * 2 - 1, 1, 1).applyMatrix4(inv);
    const r = new THREE.Vector3(p.x / p.w, p.y / p.w, p.z / p.w);
    return r.multiplyScalar(1 / -r.z);
  };
  const cams = [new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000), new THREE.PerspectiveCamera(30, 0.75, 0.1, 800)];
  cams[1].setViewOffset(1600, 1200, 300, 120, 800, 600);
  for (const cam of cams) {
    cam.updateProjectionMatrix();
    const inv = cam.projectionMatrixInverse;
    const b = viewPos(inv, 0, 0), a = viewPos(inv, 1, 1).sub(b);
    for (const [u, v] of [[0.13, 0.71], [0.5, 0.5], [0.97, 0.02], [-0.04, 1.05]]) {
      const want = viewPos(inv, u, v);
      assert.ok(Math.abs(want.z + 1) < 1e-9);
      assert.ok(Math.abs(u * a.x + b.x - want.x) < 1e-6 && Math.abs(v * a.y + b.y - want.y) < 1e-6, `${cam.fov}° at ${u}, ${v}`);
    }
  }
});

test('crease shading turns its spiral with one rotation: the same directions as a cos and a sin per tap', () => {
  // GLSL mat2(c, s, -s, c) is column-major: turn * (x, y) = (c x - s y, s x + c y)
  for (const a0 of [0, 0.7, 2.9, 6.1]) {
    const c = Math.cos(a0), s = Math.sin(a0);
    for (let i = 0; i < 8; i++) {
      const b = i * 2.39996, x = Math.cos(b), y = Math.sin(b);
      assert.ok(Math.abs(c * x - s * y - Math.cos(a0 + b)) < 1e-12 && Math.abs(s * x + c * y - Math.sin(a0 + b)) < 1e-12);
    }
  }
  assert.ok(body('creaseAO').includes('mat2 turn = mat2(cs.x, cs.y, -cs.y, cs.x);'));
});

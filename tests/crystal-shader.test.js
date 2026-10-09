// The chimes' crystal shader (src/crystal-shader.js, compiled into materials.js; docs/systems/items.md "The crystal's
// look"): the material's gate and uniforms, the geometry's edge attribute, the outline-only ink, and one instanced
// draw for every piece, whatever its worth, whatever lies about.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { makeMaterial } from '../src/materials.js';
import { CHIME_CRYSTAL, CRYSTAL_ATTR, CRYSTAL_GLOW_ATTR, CRYSTAL_DEFAULT, CRYSTAL_GLSL, CRYSTAL_VERT, CRYSTAL_VERT_PARS } from '../src/crystal-shader.js';
import { ChimeView, ChimeField, CRYSTAL, PIECE, TIERS, crystalGeometry, crystalLook } from '../src/chimes.js';
import { selfLitSkips } from '../src/shadows.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const seeded = (s = 7) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('the crystal material: compiled only where asked, its uniforms from CHIME_CRYSTAL, never black in shade', () => {
  const m = crystalLook();
  assert.equal(m.defines.CHIME_CRYSTAL, 1);
  for (const u of ['uCrystalCore', 'uCrystalEdge', 'uCrystalDeep', 'uCrystalA', 'uCrystalB', 'uCrystalSeam', 'uCrystalC']) assert.ok(m.uniforms[u]?.value?.isVector4, u);
  const c = new THREE.Color(CHIME_CRYSTAL.core);
  assert.deepEqual(m.uniforms.uCrystalCore.value.toArray().slice(0, 3).map((x) => +x.toFixed(4)), c.toArray().map((x) => +x.toFixed(4)));
  assert.equal(m.uniforms.uCrystalCore.value.w, CHIME_CRYSTAL.glow);
  assert.equal(m.uniforms.uCrystalEdge.value.w, CHIME_CRYSTAL.edgeW);
  assert.equal(m.uniforms.uCrystalDeep.value.w, CHIME_CRYSTAL.pen);
  assert.deepEqual(m.uniforms.uCrystalA.value.toArray(), [CHIME_CRYSTAL.pulse, CHIME_CRYSTAL.speed, ...CHIME_CRYSTAL.spark]);
  assert.deepEqual(m.uniforms.uCrystalB.value.toArray(), [CHIME_CRYSTAL.streaks, CHIME_CRYSTAL.fringe, CHIME_CRYSTAL.rim, CHIME_CRYSTAL.tierGlow]);
  assert.equal(m.uniforms.uCrystalSeam.value.w, CHIME_CRYSTAL.seamK);
  assert.deepEqual(m.uniforms.uCrystalC.value.toArray().slice(0, 2), [CHIME_CRYSTAL.heart, CHIME_CRYSTAL.ink]);
  assert.ok(CHIME_CRYSTAL.spark[0] < CHIME_CRYSTAL.spark[1] && CHIME_CRYSTAL.spark[1] < 1, 'the sparkle a band of the mirror ray');
  assert.ok(CHIME_CRYSTAL.glow < 0.62, 'its inner glow under post.js\' bloom threshold (0.62): only the sparkle blooms');
  assert.ok(CHIME_CRYSTAL.glow + CHIME_CRYSTAL.tierGlow * 0.6 < 0.62 && CHIME_CRYSTAL.glow + CHIME_CRYSTAL.tierGlow > 0.62, 'up to a twenty under it; a fifty and a hundred, and a piece drawn in, a soft halo');
  assert.ok(m.vertexColors, 'the vertex colours (cyan, the lavender seam) under it');
  assert.equal(m.uniforms.uSpotStep.value, makeMaterial({ color: '#fff', glow: 0.5, key: 'crystal-test-spot' }).uniforms.uSpotStep.value, 'no spot black, as a self-lit surface');
  assert.deepEqual(m.defaultAttributeValues[CRYSTAL_ATTR], CRYSTAL_DEFAULT);
  assert.equal(CRYSTAL_DEFAULT[3], CRYSTAL.one);
  assert.deepEqual(m.defaultAttributeValues[CRYSTAL_GLOW_ATTR], [0], 'no glow attribute: a one\'s');
  // fields of its own: merged over the defaults
  const own = makeMaterial({ color: '#fff', crystal: { pulse: 0, fringe: 0 }, key: 'crystal-test-own' });
  assert.equal(own.uniforms.uCrystalA.value.x, 0); assert.equal(own.uniforms.uCrystalB.value.y, 0); assert.equal(own.uniforms.uCrystalB.value.x, CHIME_CRYSTAL.streaks);
  // a material without it: none of it
  const plain = makeMaterial({ color: '#fff', key: 'crystal-test-plain' });
  assert.ok(!plain.defines.CHIME_CRYSTAL && !plain.uniforms.uCrystalA && !(CRYSTAL_ATTR in plain.defaultAttributeValues));
});

test('the shader: gated by its define in both stages, called once, outline-only soft ink, lit above the toon threshold', () => {
  for (const g of [CRYSTAL_GLSL, CRYSTAL_VERT, CRYSTAL_VERT_PARS]) assert.match(g.trim(), /^#ifdef CHIME_CRYSTAL[\s\S]*#endif$/, 'all of it behind CHIME_CRYSTAL');
  const M = src('src/materials.js');
  for (const k of ['${CRYSTAL_VERT_PARS}', '${CRYSTAL_VERT}', '${CRYSTAL_GLSL}']) assert.equal(M.split(k).length, 2, `${k} included once`);
  assert.match(M, /#ifdef CHIME_CRYSTAL\s+chimeCrystal\(albedo, L, emit, n\);/);
  // after the light term and before the G-buffer is written
  assert.ok(M.indexOf('chimeCrystal(albedo, L, emit, n)') > M.indexOf('L = mix(L, 1.0, max(uGlow, emit));'));
  assert.ok(M.indexOf('chimeCrystal(albedo, L, emit, n)') < M.indexOf('gAlbedoLight = vec4(albedo'));
  // soft ink (+8) with its pen share: post.js draws the outline only, no crease / colour-edge / shadow-edge line between facets, no hatching
  assert.match(M, /#ifdef CHIME_CRYSTAL\s+\/\/[^\n]*\n\s+gHatch\.rgb = vec3\(uCrystalDeep\.a, 0\.0, 0\.0\);\s+gHatch\.a \+= 8\.0;/);
  assert.match(src('src/post.js'), /ink = \(soft > 0\.5 \? min\(ink, eS\.x\)/, 'post.js: a soft surface keeps only its silhouette line');
  assert.match(CRYSTAL_GLSL, /L = max\(L, uToon \+ /, 'never under the toon threshold: no shadow line across it');
  // derivatives in uniform flow: no fwidth inside a branch of chimeCrystal
  const body = CRYSTAL_GLSL.slice(CRYSTAL_GLSL.indexOf('void chimeCrystal'));
  assert.doesNotMatch(body, /\bif\s*\(/, 'no branches (its fwidth calls stay in uniform flow)');
  for (const w of ['refract(', 'reflect(', 'uTime', 'vCrystalBeat', 'fwidth(e)', 'vCrystalGlow', 'heart', 'step(vCrystal.w, 0.0)']) assert.ok(body.includes(w), w);
  assert.match(CRYSTAL_VERT_PARS, /in float aChimeGlow;/);
});

test('the geometry: an edge attribute per corner, the hidden edges left out, the shard\'s length in w (negative on the seam)', () => {
  for (const [g, L] of [[crystalGeometry(), CRYSTAL.one], [crystalGeometry(0.5, 3), 0.5]]) {
    const B = g.attributes[CRYSTAL_ATTR], N = g.attributes.normal;
    assert.equal(B.itemSize, 4); assert.equal(B.count, g.attributes.position.count);
    let diagonals = 0, spokes = 0, seam = 0;
    for (let t = 0; t < B.count; t += 3) {
      const held = [0, 1, 2].filter((k) => [0, 1, 2].every((c) => B.getComponent(t + c, k) === 1));
      for (let c = 0; c < 3; c++) {
        assert.ok(Math.abs(Math.abs(B.getW(t + c)) - L) < 1e-6, 'w: the shard\'s length');
        assert.equal(Math.sign(B.getW(t + c)), Math.sign(B.getW(t)), 'one side of the seam or the other, the whole triangle');
        assert.equal(B.getComponent(t + c, c), 1, 'each corner its own weight');
      }
      if (B.getW(t) < 0) seam++;
      if (held.length === 2) { spokes++; assert.ok(N.getY(t) > 0.999, 'two edges left out: only on the flat cap (its spokes)'); }
      else { assert.ok(held.length <= 1, 'at most one edge left out'); diagonals += held.length; }
    }
    assert.equal(diagonals, 7 * 3 * 2, 'the side quads (seven round, three bands): each triangle leaves out the diagonal');
    assert.equal(spokes, 7, 'the cap: one flat facet of seven triangles');
    assert.equal(seam, 3 * 2 + 1, 'the seam: one column of facets down its length, to the point below');
  }
});

test('instanced: every piece (whatever its worth), the glints and the shade a draw each, whatever lies about; no shadow passes', () => {
  const scene = new THREE.Scene(), view = new ChimeView(scene), F = new ChimeField({ groundAt: () => 0, rng: seeded(4) });
  for (let i = 0; i < 28; i++) F.drop(new THREE.Vector3(0, 0, 0), 1);
  F.drop(new THREE.Vector3(0, 0, 0), 15);   // (a ten and a five)
  for (let t = 0; t < 1; t += 1 / 60) F.update(1 / 60, null);
  view.update(F, null);
  const meshes = scene.children.filter((o) => o.isMesh);
  assert.equal(meshes.length, 3, 'three meshes (the crystals of every tier, the glints, the patches of shade under them)');
  assert.ok(meshes.every((m) => m.isInstancedMesh));
  assert.equal(view.crystals.count, 30, 'thirty crystals in one');
  assert.equal(view.blobs.count, 30, 'a patch of shade under each, in one draw');
  assert.equal(new Set(F.list.map((p) => p.value)).size, 3, 'three tiers among them');
  assert.ok(view.crystals.material.defines.CHIME_CRYSTAL);
  assert.ok(view.crystals.instanceMatrix.count >= PIECE.max && view.glow.count >= PIECE.max, 'room for a full field');
  assert.ok(TIERS.length === 6);
  for (const m of meshes) assert.ok(selfLitSkips(m), `${m.name}: left out of the shadow passes (unculled, it would be drawn in each)`);
  view.dispose();
});

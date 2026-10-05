import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeMaterial, METALS, sharedUniforms, setEnvGround } from '../src/materials.js';
import { createPost, createBloom } from '../src/post.js';
import { GLYPH, GLYPH_SIGNS, GLYPH_GLSL, glyphHash, glyphSign, glyphSeal } from '../src/glyphs.js';
import { Grass, GRASS_QUALITY, wrapPatch, tuftGeometry, grassFields, buildGrass } from '../src/flora-grass.js';
import { LAB_MATERIALS } from '../src/levels/lab.js';

// ------------------------------------------------------------------ metal
test('metal: every kind compiles the METAL block with its own tones, the colour defaulting to the metal', () => {
  for (const [name, m] of Object.entries(METALS)) {
    const mat = makeMaterial({ metal: name, key: `t.metal.${name}` });
    assert.equal(mat.defines.METAL, 1, name);
    assert.equal(mat.uniforms.uMetal.value.x, m.kind);
    assert.equal(mat.uniforms.uMetal.value.z, m.refl);
    assert.equal(`#${mat.uniforms.uColor.value.getHexString()}`, m.color);
  }
  const b = makeMaterial({ metal: 'steel', brushed: true, brushAxis: 'x', refl: 0.3, key: 't.brushed' });
  assert.equal(b.uniforms.uMetal.value.y, 1);
  assert.equal(b.uniforms.uMetal.value.z, 0.3);
  assert.deepEqual(b.uniforms.uBrushAxis.value.toArray(), [1, 0, 0]);
  // an unknown kind is steel; a material without metal is unchanged
  assert.equal(makeMaterial({ metal: 'unobtainium', key: 't.x' }).uniforms.uMetal.value.x, METALS.steel.kind);
  assert.equal(makeMaterial({ color: '#ffffff', key: 't.plain' }).defines?.METAL, undefined);
  // the shader reads the shared sky and ground
  assert.ok(b.fragmentShader.includes('metalAlbedo') && b.uniforms.uSkyTop === sharedUniforms.uSkyTop);
});

test('metal: it reflects the post pass sky, and the ground follows the level', () => {
  const post = createPost();
  assert.equal(post.uniforms.uSkyTop, sharedUniforms.uSkyTop);
  assert.equal(post.uniforms.uSkyHorizon, sharedUniforms.uSkyHorizon);
  assert.equal(post.uniforms.uNight, sharedUniforms.uNight);
  setEnvGround(new THREE.Color('#123456'));
  assert.equal(sharedUniforms.uEnvGround.value.getHexString(), '123456');
  setEnvGround(null);   // (a level without a ground keeps the last)
  assert.equal(sharedUniforms.uEnvGround.value.getHexString(), '123456');
  setEnvGround('#b9a98c');
});

test('lab: the materials room shows every metal, the inscriptions and a lamp', () => {
  const names = LAB_MATERIALS.map((m) => m.name);
  for (const k of ['steel', 'brushed', 'chrome', 'brass', 'copper', 'iron', 'painted', 'glyphs', 'glow', 'lamp']) assert.ok(names.includes(k), k);
  for (const m of LAB_MATERIALS.filter((m) => m.o.metal)) assert.ok(METALS[m.o.metal], m.name);
});

// ------------------------------------------------------------------ glow
test('glow: the composite reads a quarter- and an eighth-resolution glow buffer, off unless switched on', () => {
  const post = createPost();
  assert.equal(post.uniforms.uBloom.value, 0);
  assert.ok('tBloom' in post.uniforms && 'tBloom2' in post.uniforms);
  const gb = new THREE.WebGLRenderTarget(1, 1, { count: 3 });
  const bloom = createBloom(gb);
  bloom.setSize(1921, 1081);
  assert.ok(bloom.texture && bloom.wide && bloom.texture !== bloom.wide);
  const a = bloom.texture.image, w = bloom.wide.image;
  assert.deepEqual([a.width, a.height], [481, 271]);
  assert.deepEqual([w.width, w.height], [241, 136]);
});

// ------------------------------------------------------------------ the makers' inscriptions
test('inscriptions: the layout hash is a fixed integer recipe, the same in the shader', () => {
  for (let a = -500; a < 500; a++) {
    const h = glyphHash(a);
    assert.ok(h >= 0 && h < 1, `${a}: ${h}`);
    assert.equal(glyphHash(a), glyphHash(a + 89), 'period 89');
  }
  assert.ok(GLYPH_GLSL.includes('float glyphHash(float a) { a = mod(a, 89.0); return mod(a * a * 13.0 + a * 7.0 + 3.0, 61.0) / 61.0; }'));
  assert.ok(GLYPH_GLSL.includes(GLYPH.groove.toFixed(4)) && GLYPH_GLSL.includes(GLYPH.band.toFixed(4)));
});

test('inscriptions: the makers\' mark opens every sixth sign; the others come from the vocabulary, rarely twice running', () => {
  const counts = new Array(GLYPH_SIGNS.length).fill(0);
  let repeats = 0, n = 0;
  for (let r = -6; r < 6; r++) {
    for (let j = -60; j < 60; j++) {
      const k = glyphSign(r, j);
      assert.ok(Number.isInteger(k) && k >= 0 && k < GLYPH_SIGNS.length);
      assert.equal(k === 0, ((j % 6) + 6) % 6 === 0, `row ${r} slot ${j}`);
      counts[k]++;
      if (k !== 0 && k === glyphSign(r, j - 1)) repeats++;
      n++;
    }
  }
  for (let k = 1; k < GLYPH_SIGNS.length; k++) assert.ok(counts[k] > n * 0.05, `${GLYPH_SIGNS[k]} appears`);
  assert.ok(repeats < n * 0.25, `${repeats} repeats in ${n}`);
});

test('inscriptions: seals only on odd rows, now and then', () => {
  let seals = 0, odd = 0;
  for (let r = -20; r < 20; r++) for (let c = -40; c < 40; c++) {
    if (((r % 2) + 2) % 2 === 0) assert.equal(glyphSeal(r, c), false);
    else { odd++; if (glyphSeal(r, c)) seals++; }
  }
  assert.ok(seals > odd * 0.05 && seals < odd * 0.3, `${seals} of ${odd}`);
});

// ------------------------------------------------------------------ grass blades
test('grass: the patch wraps round the camera, each tuft staying put in the world until it falls off the edge', () => {
  const S = 40;
  for (const o of [0, 3.3, 17, 39.9]) {
    let last = null, moves = 0;
    for (let c = -100; c <= 100; c += 0.25) {
      const x = wrapPatch(o, c, S);
      assert.ok(Math.abs(x - c) <= S / 2 + 1e-9);
      assert.ok(Math.abs(((x - o) / S) % 1) < 1e-9);
      if (last !== null && x !== last) { moves++; assert.ok(Math.abs(Math.abs(x - last) - S) < 1e-9); }
      last = x;
    }
    assert.ok(moves >= 4 && moves <= 6, `${moves} wraps over 200 m`);
  }
});

test('grass: a tuft is a few tapered blades, root at 0, tip at most 1', () => {
  const g = tuftGeometry();
  const y = Array.from({ length: g.attributes.position.count }, (_, i) => g.attributes.position.getY(i));
  assert.equal(Math.min(...y), 0);
  assert.ok(Math.max(...y) <= 1 && Math.max(...y) > 0.6);
  assert.equal(g.index.count / 3, 3 * 3);
});

const flatField = (extra = {}) => ({ heightAt: (x, z) => (x > 30 ? (x - 30) * 2 : 0), color: new THREE.Color('#8cc77e'), color2: new THREE.Color('#9fd08a'), inside: () => true, ...extra });
const cam = (x, z) => ({ position: new THREE.Vector3(x, 2, z) });

test('grass: placed once, then only the tufts that wrap; none on steep ground, in water or on the paths', () => {
  const scene = new THREE.Scene();
  const avoid = (x, z) => Math.abs(z) < 2;   // a path along x
  const grass = new Grass({ scene, fields: [flatField({ water: -1 })], quality: { radius: 10, density: 3 }, avoid });
  assert.equal(scene.children.includes(grass.mesh), true);
  const first = grass.update(cam(0, 0));
  assert.equal(first, grass.count, 'every tuft placed at first');
  assert.equal(grass.update(cam(0, 0)), 0, 'nothing moves while the camera stays');
  const moved = grass.update(cam(0.5, 0));
  assert.ok(moved > 0 && grass.placed <= grass.count);
  const A = grass.at;
  let onPath = 0, grown = 0;
  for (let i = 0; i < grass.count; i++) {
    const x = A[i * 4], z = A[i * 4 + 2], h = A[i * 4 + 3];
    if (h > 0) { grown++; if (Math.abs(z) < 2) onPath++; }
    assert.ok(h >= 0 && h < 0.6);
  }
  assert.equal(onPath, 0);
  assert.ok(grown > grass.count * 0.5, `${grown} of ${grass.count} grow`);
  // the steep bank past x = 30 grows nothing
  grass.placeMs = Infinity;   // (a jump: all of it this frame)
  grass.update(cam(36, 0));
  for (let i = 0; i < grass.count; i++) if (A[i * 4] > 31) assert.equal(A[i * 4 + 3], 0);
  // under water: nothing
  const wet = new Grass({ scene, fields: [flatField({ water: 5 })], quality: { radius: 6, density: 2 } });
  wet.update(cam(0, 0));
  for (let i = 0; i < wet.count; i++) assert.equal(wet.at[i * 4 + 3], 0);
  // outside every field the mesh is hidden
  const none = new Grass({ scene, fields: [flatField({ inside: () => false })], quality: { radius: 6, density: 2 } });
  none.update(cam(0, 0));
  assert.equal(none.mesh.visible, false);
});

test('grass: after a jump the patch is placed over a few frames, carrying on where it stopped', () => {
  const scene = new THREE.Scene();
  const grass = new Grass({ scene, fields: [flatField({ water: -1 })], quality: { radius: 10, density: 3 } });
  grass.placeMs = 0;   // (stop at the first check: 64 tufts a frame)
  assert.equal(grass.update(cam(0, 0)), grass.count, 'the first patch at once (the loading screen)');
  const where = () => { let n = 0; for (let i = 0; i < grass.count; i++) if (Math.abs(grass.at[i * 4] - 500) < 15) n++; return n; };
  let frames = 0;
  while (where() < grass.count && frames < 100) { grass.update(cam(500, 0)); frames++; }
  assert.equal(where(), grass.count, 'all of it gets there');
  grass.placeMs = 3;
  assert.equal(grass.update(cam(500, 0)), 0, 'far from the origin, standing still places nothing again (compared in 32-bit floats)');
  assert.ok(frames >= Math.ceil(grass.count / 64) - 1 && frames <= Math.ceil(grass.count / 64) + 1, `${frames} frames for ${grass.count} tufts`);
  // walking: the few that wrap are placed the same frame
  grass.placeMs = 3;
  grass.update(cam(501, 0));
  assert.equal(grass.update(cam(501, 0)), 0, 'nothing left over');
});

test('grass: something built over a cell (a slab, a path, a roof) keeps the blades off it', () => {
  const scene = new THREE.Scene();
  const physics = { rayHit: (o) => (o.x > 0 ? { point: new THREE.Vector3(o.x, 0.3, o.z) } : null) };
  const grass = new Grass({ scene, fields: [flatField()], quality: { radius: 8, density: 2 }, physics });
  grass.update(cam(0, 0));
  for (let i = 0; i < grass.count; i++) if (Math.floor(grass.at[i * 4]) + 0.5 > 0) assert.equal(grass.at[i * 4 + 3], 0);
});

test('grass: the presets grow fewer, closer blades on the handheld; grassy grounds are the ones drawn with ticks', () => {
  const n = (q) => Math.round(q.radius * 2 * Math.sqrt(q.density)) ** 2;
  assert.ok(n(GRASS_QUALITY.handheld) < n(GRASS_QUALITY.medium) / 3);
  assert.ok(n(GRASS_QUALITY.low) < n(GRASS_QUALITY.medium));
  assert.ok(n(GRASS_QUALITY.handheld) <= 2500, `${n(GRASS_QUALITY.handheld)} tufts on the handheld`);
  const ticks = makeMaterial({ color: '#b4d896', color2: '#c9e4a8', mode: 1, ticks: true, key: 't.ticks' });
  const sand = makeMaterial({ color: '#efd29b', mode: 1, key: 't.sand' });
  const lvl = (m) => ({ ground: { mesh: { material: m }, heightAt: () => 0 } });
  assert.equal(grassFields(lvl(ticks)).length, 1);
  assert.equal(grassFields(lvl(sand)).length, 0);
  assert.equal(buildGrass({ scene: new THREE.Scene(), level: lvl(sand) }), null);
  const g = buildGrass({ scene: new THREE.Scene(), level: lvl(ticks), presetKey: 'handheld' });
  assert.equal(g.R, GRASS_QUALITY.handheld.radius);
  assert.equal(g.material.defines.GRASS, 1);
});

test('grass: soft ink, the blades flag themselves (+8) and every reader of gHatch.a takes the flag off first', () => {
  const grass = makeMaterial({ color: '#8cc77e', grass: true, key: 't.grass.soft' });
  assert.ok(grass.fragmentShader.includes('gHatch.a += 8.0;'));
  // (r and g carry the pen line's share and the outline's fade; post.js clears them before the hatching reads them)
  assert.ok(grass.fragmentShader.includes('gHatch.rgb = vec3(vGrassLook.x, vGrassLook.y, 0.0)'));
  const post = createPost();
  const fs = post.scene.children[0].material.fragmentShader;
  assert.ok(fs.includes('float soft = step(7.5, surface.a)') && fs.includes('hm -= 8.0 * step(vec4(7.5), hm)') && fs.includes('fa -= 8.0 * faSoft'));
  // the figure test comes after the soft flag is taken off (a blade is not a person)
  assert.ok(fs.indexOf('surface.a -= 8.0 * soft') < fs.indexOf('float figure = step(3.5, surface.a)'));
  assert.ok(fs.indexOf('surface.rgb *= 1.0 - soft') < fs.indexOf('vec3 H = surface.rgb'), 'no hatching read off a blade');
  assert.equal(tuftGeometry().index.count / 3, 9, 'three wide blades a tuft');
});

// The shadow maps' setup, wherever a page makes them (the game, the title, the studio, the items' and the creatures'
// galleries, the trailer, the motion check). The creatures' gallery (enemies.html, October 2026: "look at the shadows in
// motion, there is something really wrong") reconfigured its map to ±16 m without telling the shader, whose tent then
// spread its taps 2.7 times too far: every shadow torn into ragged streaks that crawled as the creature moved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { Cascade, FINE_CASCADE, fitShadowExtent, shadowDirection } from '../src/shadows.js';

const uniforms = (texels) => ({ map: { value: null }, matrix: { value: new THREE.Matrix4() }, bias: { value: 0 }, offset: { value: 0 }, ...(texels ? { texel: texels } : {}) });

test('a cascade given its uShadowTexel slot keeps the shader\'s texel in step with every reconfiguration', () => {
  const T = { value: new THREE.Vector3(0.0117, 0.107, 1.12) };
  const fine = new Cascade({ size: 1024, extent: 3, depth: 60, bias: 3.4, offset: 2.6, uniforms: uniforms([T, 0]) });
  const near = new Cascade({ size: 256, extent: 20, depth: 60, uniforms: uniforms([T, 1]) });
  assert.equal(T.value.x, fine.texel);
  assert.equal(T.value.y, near.texel);
  for (const [size, extent] of [[2048, 16], [2048, 4], [512, 12]]) {
    fine.configure(size, extent);
    assert.equal(T.value.x, (2 * extent) / size, `${size} px over ±${extent} m`);
    assert.equal(T.value.y, near.texel, 'the other cascades\' slots are left alone');
  }
});

// every `new Cascade({...})` call in src, with the file it is in
function cascadeCalls() {
  const calls = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.js') && p !== join('src', 'shadows.js')) {
        const s = readFileSync(p, 'utf8');
        for (const m of s.matchAll(/new Cascade\(\{/g)) {
          let depth = 0, i = m.index + 'new Cascade('.length;
          for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}' && --depth === 0) break; }
          calls.push({ file: p, src: s.slice(m.index, i + 1) });
        }
      }
    }
  };
  walk('src');
  return calls;
}

test('every shadow map in src tells the shader its texel (uShadowTexel slot), with bias and offset in the game\'s range', () => {
  const calls = cascadeCalls();
  assert.ok(calls.length >= 15, `found ${calls.length}`);
  for (const { file, src } of calls) {
    assert.match(src, /texel: \[SU\.uShadowTexel, (?:[012]|i)\]/, `${file}: ${src.slice(0, 80)}… has no texel slot`);
    const own = /\.\.\.FINE_CASCADE/.test(src) ? FINE_CASCADE : { bias: 2.2, offset: 3 };   // (the defaults)
    const bias = Number(src.match(/bias: ([\d.]+)/)?.[1] ?? own.bias), offset = Number(src.match(/offset: ([\d.]+)/)?.[1] ?? own.offset);
    assert.ok(bias >= 1.5 && bias <= 4, `${file}: bias ${bias} texels (acne under 1.5, peter-panning over 4)`);
    assert.ok(offset >= 2 && offset <= 3.5, `${file}: normal offset ${offset} texels`);
  }
  // the galleries' fine map is the game's fine map: the same bias and offset in texels
  const fine = (f) => calls.find((c) => c.file === f && /name: 'fine'/.test(c.src)).src;
  assert.match(fine(join('src', 'main.js')), /\.\.\.FINE_CASCADE/);
  assert.match(fine(join('src', 'items-page', 'viewer.js')), new RegExp(`bias: ${FINE_CASCADE.bias}, offset: ${FINE_CASCADE.offset}`));
  assert.deepEqual(FINE_CASCADE, { size: 2048, extent: 12, bias: 3.4, offset: 2.6 });
});

test('fitShadowExtent: the window holds the subject and its whole shadow, in whole metres, within the game\'s fine map', () => {
  const sunAt = (elDeg) => shadowDirection(new THREE.Vector3(Math.cos(elDeg * Math.PI / 180), Math.sin(elDeg * Math.PI / 180), 0.1).normalize());
  for (const elDeg of [57, 35, 75, 20])
    for (const [r, h] of [[0.6, 0.55], [1.1, 1.3], [1.6, 3.2], [2.4, 1.2 + 3.6], [0.3, 0.3]]) {
      const dir = sunAt(elDeg), e = fitShadowExtent(r, h, dir.y);
      assert.equal(e, Math.round(e));
      assert.ok(e >= 2 && e <= 12, `${e}`);
      if (e === 12) continue;   // (capped at the game's ±12 m)
      // the subject: a box of radius r, height h at the origin; its corners and its top's shadow on the floor
      const c = new Cascade({ size: 2048, extent: e, depth: 60, uniforms: uniforms() });
      c.update(new THREE.Vector3(0, 0, 0), dir);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
        for (const p of [new THREE.Vector3(x, 0, z), new THREE.Vector3(x, h, z), new THREE.Vector3(x - dir.x / dir.y * h, 0, z - dir.z / dir.y * h)]) {
          const v = new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(c.U.matrix.value);
          for (const u of [v.x * 0.5 + 0.5, v.y * 0.5 + 0.5])   // inside the part of the map the shader doesn't fade (0.06 … 0.94)
            assert.ok(u > 0.06 && u < 0.94, `sun ${elDeg}°, r ${r}, h ${h}: a point at ${u.toFixed(3)} of ±${e} m`);
        }
      }
    }
  // the gallery's biggest (a ray at its hover: 2.4 m round, 4.8 m up) fits the game's ±12 m under the page's sun (57°);
  // under a low one its long shadow widens the window rather than running off it
  assert.equal(fitShadowExtent(1.3 * 2.4, 1.15 * 1.2 + 3.6, Math.sin(57 * Math.PI / 180), { min: 12, max: 24 }), 12);
  assert.ok(fitShadowExtent(1.3 * 2.4, 1.15 * 1.2 + 3.6, Math.sin(25 * Math.PI / 180), { min: 12, max: 24 }) > 12);
  assert.equal(fitShadowExtent(0.05, 0.05, 0.8), 2);
});

test('the creatures\' gallery draws with the game\'s fine map (wider only for a creature that needs it), centred on its foot', () => {
  const s = readFileSync(join('src', 'enemies', 'page.js'), 'utf8');
  assert.match(s, /fitShadowExtent\([^;]*\{min:FINE_CASCADE\.extent,max:2\*FINE_CASCADE\.extent\}\)/);
  assert.match(s, /this\.cascade\.configure\(FINE_CASCADE\.size,e\)/);
  assert.match(s, /shadowCentre\(m\)/);
  assert.doesNotMatch(s, /cascade\.configure\(\s*\d+\s*,\s*\d+\s*\)/, 'a hard-coded shadow window');
  const v = readFileSync(join('src', 'items-page', 'viewer.js'), 'utf8');
  assert.match(v, /this\.cascade\.place\(this\.shadowCentre\?\.\(m\) \?\? centre\)/);
});

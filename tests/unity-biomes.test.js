// The desert's ground palettes are written twice: src/biome.js (the web's shader, made from BIOMES) and the Unity port's
// HiraethCommon.hlsl biomeGround (by hand). The golden dunes' warmer ochre (October 2026) reached the web alone, and the
// Unity version's sand stayed the old cream: found by the visual check (scripts/unity-compare/, issue #264).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIOMES } from '../src/biome.js';

const hlsl = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/HiraethCommon.hlsl', import.meta.url), 'utf8');
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

test('Unity\'s ground palettes are the web\'s (BIOMES: dunes, rose, salt)', () => {
  const body = hlsl.match(/void biomeGround\([^)]*\)\s*\{([\s\S]*?)\n\}/)[1];
  for (const [i, c] of ['c1', 'c2', 'c3'].entries()) {
    const line = body.match(new RegExp(`${c} = (.*);`))[1];
    const nums = [...line.matchAll(/float3\(([^)]*)\)/g)].map((m) => m[1].split(',').map(Number));
    assert.equal(nums.length, 3, line);
    for (const [k, biome] of ['dunes', 'rose', 'salt'].entries()) {
      const want = rgb(BIOMES[biome].ground[i]);
      nums[k].forEach((v, j) => assert.ok(Math.abs(v - want[j]) < 0.002, `${biome}'s ${c}: ${nums[k]} against ${BIOMES[biome].ground[i]}`));
    }
  }
});

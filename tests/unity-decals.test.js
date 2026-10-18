// The ground's decals in the Unity bridge (issue #463): three pulls them in front of the ground with a polygon offset
// (sand banked against things, the salt pan, the tide lines, the sand river, the basin's shore, the crash's scorch, a
// guardian's shade, Nima's pool), which reached Unity for the splats alone (#459). Every decal but the splats now goes
// with one shared offset, DECAL_OFFSET, weaker than the splats' so a splat on a decal is drawn over it: two raster
// states in all, and BridgePrewarm keeps a pair for each (its state key names the offset).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { inkSpec } from '../engine/ink-spec.js';
import { portMaterial, DECAL_OFFSET } from '../engine/unity/port-format.js';
import { makeMaterial } from '../src/materials.js';
import { Splats } from '../src/fluid-tool.js';
import * as THREE from 'three';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const pulled = (o, f, u) => Object.assign(makeMaterial(o), { polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: u });

test('every web decal\'s offset reaches Unity as the shared decal state; the splats keep theirs', () => {
  // the values src/ uses today (sand-drifts, desert-water, desert-dunes: -1/-2; desert-vistas, temples/boss: -2/-4;
  // ship/crash: -2/-6; levels/incal: -1/-2)
  for (const [f, u, c] of [[-1, -2, '#f1ece0'], [-2, -4, '#d6c19c'], [-2, -6, '#e2be86'], [-1, -2, '#f2c54b']]) {
    assert.deepEqual(portMaterial(inkSpec(pulled({ color: c, flat: true }, f, u)), 1).offset, DECAL_OFFSET, `${f}, ${u}`);
  }
  const splat = portMaterial(inkSpec(new Splats(new THREE.Group(), null).material), 2);
  assert.deepEqual(splat.offset, [-2, -4]);
  assert.ok(DECAL_OFFSET[0] > splat.offset[0] && DECAL_OFFSET[1] > splat.offset[1], 'a splat on a decal is pulled further than the decal');
  assert.equal(portMaterial(inkSpec(makeMaterial({ color: '#fff' })), 3).offset, undefined, 'no offset: none sent');
});

test('the decals with an offset in src/ are the ones this issue counted (a new one: check it in Unity)', () => {
  const files = [];
  const walk = (d) => { for (const e of readdirSync(new URL(`../${d}`, import.meta.url), { withFileTypes: true })) e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith('.js') && files.push(`${d}/${e.name}`); };
  walk('src');
  const found = files.filter((f) => /polygonOffsetFactor\s*[:=]\s*-/.test(read(f))).sort();
  assert.deepEqual(found, ['src/chimes.js', 'src/desert-dunes.js', 'src/desert-vistas.js', 'src/desert-water.js', 'src/jump-shadow.js', 'src/life.js',
    'src/levels/incal.js', 'src/sand-drifts.js', 'src/ship/crash.js', 'src/splat-decal.js', 'src/temples/boss.js'].sort());
  // (the footprints, the jump's shade: their own shaders' Offset; the chimes' shade has no port yet, engine/bridge-gaps.js)
  assert.match(read('unity/Hiraeth/Assets/Hiraeth/Shaders/Print.shader'), /Offset -2, -2/);
  assert.match(read('unity/Hiraeth/Assets/Hiraeth/Shaders/JumpShade.shader'), /Offset -3, -3/);
});

test('BridgePrewarm keys a pair by its offset, so a decal\'s pipeline is warmed apart from the plain one', () => {
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgePrewarm.cs'), /StateKey\(Material m\)[\s\S]{0,700}_OffsetFactor[\s\S]{0,120}_OffsetUnits/);
});

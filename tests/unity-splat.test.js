// A splat of the fluid in the Unity bridge (issue #459: "a splat appears a beat later in Unity, not drawn 0.08 s after the
// shot, there by 1 s"). The splats lie exactly on the surface they hit; the web pulls them in front of it in depth with
// three's polygon offset, which never reached Unity, so the ground hid them, whole or in part, as the depth test fell frame
// by frame. The offset now goes with the splats' material (ink-spec.js offset, port-format.js, WorldLoader, Surface.shader's
// Offset). And a splat's middle no longer takes atan2(0, 0) (NaN on Metal: the bloom spread it over the whole picture).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Splats } from '../src/fluid-tool.js';
import { inkSpec } from '../engine/ink-spec.js';
import { portMaterial } from '../engine/unity/port-format.js';
import { makeMaterial } from '../src/materials.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the splats\' material takes three\'s polygon offset to Unity, their own', () => {
  const splats = new Splats(new THREE.Group(), null), m = splats.material;
  assert.ok(m.polygonOffset);
  const pm = portMaterial(inkSpec(m), 1);
  assert.equal(pm.splatOn, 1);
  assert.deepEqual(pm.offset, [m.polygonOffsetFactor, m.polygonOffsetUnits]);
  const other = makeMaterial({ color: '#f1ece0', flat: true });
  Object.assign(other, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  assert.deepEqual(portMaterial(inkSpec(other), 2).offset, [-1, -2], 'the ground\'s other decals: the shared decal offset (issue #463)');
  assert.equal(portMaterial(inkSpec(makeMaterial({ color: '#fff' })), 3).offset, undefined);
});

test('Surface.shader draws its G-buffer pass with the material\'s offset, 0 by default; WorldLoader sets it', () => {
  const sh = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
  assert.match(sh, /_OffsetFactor \("[^"]*", Float\) = 0/);
  assert.match(sh, /_OffsetUnits \("[^"]*", Float\) = 0/);
  assert.match(sh, /Name "HiraethGBuffer"[\s\S]{0,400}?Offset \[_OffsetFactor\], \[_OffsetUnits\]/);
  assert.match(sh, /sA = sR > 1e-6 \? atan2\(sp\.y, sp\.x\) : 0\.0/, 'no atan2(0, 0) at a splat\'s middle');
  assert.match(read('unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs'), /m\.L\("offset"\) is List<object> off[^\n]*_OffsetFactor[^\n]*_OffsetUnits/);
});

test('the traveller\'s cloth is never a surface for a splat to paint (the engines\' overshirt is a plain mesh)', () => {
  assert.match(read('src/characters/traveller-b3.js'), /for\(const m of \[cloth\.garment,cloth\.underlayer,cloth\.innerShirt\]\)if\(m\)m\.userData\.noSplat=true;/);
});

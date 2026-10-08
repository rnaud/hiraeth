import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { LINE, INK_WHITE, packLight, unpackLight, makeMaterial } from '../src/materials.js';
import { FLAME, TONGUES, EYES, SHADE_MATERIAL, flameRest, flameTarget, flameDrive, tongueRadius, tongueAxis, tongueLength, ShadeFlame } from '../src/shade.js';

// The shade's look (docs/systems/foes.md, "The shade"): a cartoon's negative, flat black with white lines (the
// material's lineWhite: RT0.a's sign bit, post.js 1b), its head a black flame that answers how it moves and fights.

/** What the half-float G-buffer keeps of a value: 11 significant bits. */
const half = (x) => { if (x === 0) return 0; const step = 2 ** (Math.floor(Math.log2(Math.abs(x))) - 10); return Math.sign(x) * Math.round(Math.abs(x) / step) * step; };

test('a white line packs into the sign bit and comes back out of the half float with its light, weight and tint', () => {
  for (let step = 0; step < 16; step++) for (const L of [0, 0.01, 0.49, 0.51, 1]) {
    const a = packLight(L, step, true);
    assert.ok(a < 0 && a > -33, `packed ${a}`);
    const [l, w, t, white] = unpackLight(half(a));
    assert.equal(white, true);
    assert.ok(Math.abs(l - L) <= 1 / 64 + 1e-9, `the light ${L} → ${l} (step ${step})`);
    assert.equal(w, LINE.weights[step % 4]);
    assert.equal(t, Math.floor(step / 4) / (LINE.tints - 1));
  }
  // (L 0 with no step is still negative: −1, never the −0 a sign can't hold)
  assert.equal(packLight(0, 0, true), -1);
  assert.equal(unpackLight(packLight(0.7, 3))[3], false, 'every other material: the ink');
});

test('the material says it: lineWhite sets its uniform; the shaders write and read the sign bit', () => {
  assert.equal(makeMaterial({ color: '#000', lineWhite: true, key: 'test-white' }).uniforms.uLineWhite.value, 1);
  assert.equal(makeMaterial({ color: '#000' }).uniforms.uLineWhite.value, 0);
  assert.equal(SHADE_MATERIAL.lineWhite, true);
  assert.equal(SHADE_MATERIAL.fluid, 'shadow');
  const mat = readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8'), post = readFileSync(new URL('../src/post.js', import.meta.url), 'utf8');
  const water = readFileSync(new URL('../src/water.js', import.meta.url), 'utf8');
  assert.match(mat, /uLineWhite > 0\.5 \? -1\.0 - packedL : packedL/, 'written as −(1 + packed)');
  assert.match(post, /float lightOf\(float a\) \{ a = a < 0\.0 \? -a - 1\.0 : a;/, 'post.js reads the light under it');
  assert.match(post, /if \(Ao\.a < 0\.0\) lineC = vec3\(\$\{INK_WHITE/, "and draws the owner's line white");
  assert.equal((water.match(/la = la < 0\.0 \? -la - 1\.0 : la;/g) ?? []).length, 2, "the water's sparkle reads it too");
  assert.ok(INK_WHITE.every((v) => v > 0.85), "the paper's white");
});

test('the flame leans back from where it goes, at most so far', () => {
  const t = flameTarget({ vx: 0, vz: 4, state: 'chase' });
  assert.ok(t.lz < 0 && Math.abs(t.lx) < 1e-9, 'running ahead, it streams back');
  assert.ok(Math.abs(t.lz + 4 * FLAME.lean) < 1e-9);
  assert.ok(flameTarget({ vx: -2, vz: 0 }).lx > 0, 'stepping left, it leans right');
  const fast = flameTarget({ vx: 30, vz: 30 });
  assert.ok(Math.hypot(fast.lx, fast.lz) <= FLAME.leanMax + 1e-9);
  assert.equal(flameTarget({}).size, 1, 'at rest: its own size');
});

test('it flares as it winds up, whips with the cut, gutters when hit or stilled, and is gone as it runs away', () => {
  let last = 0;
  for (let k = 0; k <= 1.0001; k += 0.1) { const s = flameTarget({ state: 'wind', k }).size; assert.ok(s >= last - 1e-9); last = s; }
  assert.ok(Math.abs(last - (1 + FLAME.flare)) < 1e-6, 'fully flared at the end of the wind-up');
  assert.ok(Math.abs(flameTarget({ state: 'strike', k: 0.2 }).whip) > 0.5, 'the cut whips it across');
  assert.equal(flameTarget({ state: 'recover' }).whip, 0);
  const st = flameTarget({ stunned: 1 }), hit = flameTarget({ flash: 0.8 });
  assert.ok(st.size < 1 && st.gutter === 1 && hit.gutter === 1, 'guttering, smaller');
  assert.ok(st.flick > flameTarget({}).flick, 'and flickering faster');
  assert.equal(flameTarget({ melt: 1 }).size, 0, 'run away: no flame');
  assert.ok(flameTarget({ melt: 0.5 }).size < 1);
});

test('the drive eases toward it: it flares fast and dies down slower; its clock runs at its flicker', () => {
  const up = flameRest(); up.size = 1;
  flameDrive(up, { state: 'wind', k: 1 }, 0.1);
  const down = flameRest(); down.size = 1 + FLAME.flare;
  flameDrive(down, {}, 0.1);
  assert.ok(up.size - 1 > 1 + FLAME.flare - down.size, 'up faster than down');
  const d = flameRest();
  for (let i = 0; i < 300; i++) flameDrive(d, { vz: 3 }, 1 / 60);
  assert.ok(Math.abs(d.lz + 3 * FLAME.lean) < 1e-3 && Math.abs(d.size - 1) < 1e-3, 'it settles where it wants');
  assert.ok(Math.abs(d.time - 5) < 0.05, 'its own clock, at its flicker (1 at rest)');
});

test('a tongue: closed at its root and tip, widest a little over a third up; its axis rooted, leaning and whipped toward its tip', () => {
  assert.equal(tongueRadius(0), 0); assert.equal(tongueRadius(1), 0);
  let best = 0, at = 0;
  for (let u = 0.01; u < 1; u += 0.01) { const r = tongueRadius(u); assert.ok(r > 0); if (r > best) { best = r; at = u; } }
  assert.ok(at > 0.25 && at < 0.5, `widest at ${at}`);
  const T = { ...TONGUES[1], wave: 0, curl: 0 }, rest = { ...flameRest(), size: 1 };
  assert.ok(tongueAxis(0, T, rest).length() < 1e-9, 'rooted');
  const tip = tongueAxis(1, T, rest), lean = tongueAxis(1, T, { ...rest, lz: -0.6 }), whip = tongueAxis(1, T, { ...rest, whip: 1 });
  assert.ok(tip.y > 0.5 * T.len, 'it rises');
  assert.ok(lean.z < tip.z - 0.1 * T.len, 'leaning back');
  assert.ok(whip.x > tip.x + 0.2 * T.len, 'whipped across');
  assert.equal(tongueLength(T, { ...rest, size: 0 }), 0);
});

test("the flame mesh: its tongues and eye-slits follow the drive, the head's tongue marked for the material", () => {
  const root = new THREE.Group(), mat = makeMaterial({ ...SHADE_MATERIAL, key: 'test-flame' });
  const flame = new ShadeFlame(root, mat, makeMaterial({ color: '#fff', key: 'test-flame-eyes' }));
  root.updateMatrixWorld(true);
  const d = { ...flameRest(), size: 1 }, neck = new THREE.Vector3(0, 1.47, 0);
  flame.update(d, neck);
  assert.ok(flame.mesh.geometry.attributes.position.array.every(Number.isFinite));
  const fold = flame.mesh.geometry.attributes.aFold.array;
  assert.ok(fold[0] >= 3 && fold[0] < 4, "the head's tongue: no lick drawn on it");
  assert.ok(fold[fold.length - 2] >= 1 && fold[fold.length - 2] < 2, 'the others: a lick');
  for (const e of flame.eyes) { assert.ok(e.visible); assert.ok(e.position.z > 0.05, 'on its front'); }
  assert.ok(flame.eyes[0].position.x * flame.eyes[1].position.x < 0, 'one each side');
  const tall = flame.tips[0].y;
  flame.update({ ...d, size: 1 + FLAME.flare }, neck);
  assert.ok(flame.tips[0].y > tall, 'flared, taller');
  flame.update({ ...d, size: 0 }, neck);
  assert.ok(flame.eyes.every((e) => !e.visible), 'gone: no eyes');
  assert.ok(EYES.u > 0 && EYES.u < 1 && TONGUES.filter((t) => t.main).length === 1);
});

// The fluid sword's living blade (src/blade-shader.js, compiled into materials.js; src/fluid-blade.js alive();
// docs/systems/foes.md "Alive"): the material's gate and uniforms, the shader's pieces and its lite path, the
// preset's say, the smear and lag of a swing, the ripple of a hit or a parry, the idle tongue, the drops that splash.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { makeMaterial } from '../src/materials.js';
import { BLADE_LOOK, BLADE_QUALITY, bladeLiteFor, BLADE_FLUID_GLSL, BLADE_VERT, BLADE_VERT_PARS, BLADE_DISCARD, BLADE_INK } from '../src/blade-shader.js';
import { swordMaterial, WAKE_TONES } from '../src/fluid-sword.js';
import { bladeSmear, bladeLag, bladeIdle, bladeLite, shedDrops, BLADE } from '../src/fluid-blade.js';
import { wakeStyle } from '../src/fluid-sword.js';
import { QUALITY_PRESETS, resolveQuality } from '../src/perf.js';
import { FluidTool, Dots } from '../src/fluid-tool.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { playerHands } from '../src/hands.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), dt = 1 / 60;

test('the blade\'s material: the living blade compiled only into the sword\'s fluid, its uniforms there', () => {
  const m = swordMaterial();
  assert.equal(m.defines.FLUID, 1);
  assert.equal(m.defines.BLADE_FLUID, 1);
  for (const u of ['uBlade', 'uBladeB', 'uBladeC']) assert.ok(m.uniforms[u]?.value?.isVector4, u);
  assert.equal(m.uniforms.uBladeC.value.w, BLADE_LOOK.pen, 'the outline\'s pen share');
  assert.ok(m.uniforms.uBladeB.value.z > 1.2, 'no ripple running at first');
  // the other fluids (the wake, the tank, the shade): none of it
  for (const fluid of ['trail', 'tank', 'shadow', 'glob']) {
    const o = makeMaterial({ color: '#fff', fluid, key: `blade-test-${fluid}` });
    assert.ok(o.defines.FLUID && !o.defines.BLADE_FLUID && !o.uniforms.uBlade, fluid);
  }
});

test('the shader: behind its define, hooked once into each stage, outline-only soft ink, lit above the toon threshold', () => {
  for (const g of [BLADE_VERT, BLADE_VERT_PARS, BLADE_DISCARD, BLADE_INK]) assert.match(g.trim(), /^#ifdef BLADE_FLUID[\s\S]*#endif$/, 'all of it behind BLADE_FLUID');
  const M = src('src/materials.js');
  for (const k of ['${BLADE_VERT_PARS}', '${BLADE_VERT}', '${BLADE_FLUID_GLSL}', '${BLADE_DISCARD}', '${BLADE_INK}']) assert.equal(M.split(k).length, 2, `${k} included once`);
  assert.match(M, /#ifdef BLADE_FLUID\s+bladeLight\(albedo, L, emit, n\);/);
  assert.ok(M.indexOf('bladeLight(albedo, L, emit, n)') > M.indexOf('L = mix(L, 1.0, max(uGlow, emit));') && M.indexOf('bladeLight(albedo, L, emit, n)') < M.indexOf('gAlbedoLight = vec4(albedo'), 'after the light term, before the G-buffer');
  assert.ok(M.indexOf('${BLADE_DISCARD}') < M.indexOf('// stroke coordinates + derivatives first'), 'the skin discarded before the strokes');
  assert.match(BLADE_INK, /gHatch\.rgb = vec3\(uBladeC\.w, 0\.0, 0\.0\);\s+gHatch\.a \+= 8\.0;/, 'soft ink with its pen share: post.js draws the outline only');
  assert.match(BLADE_FLUID_GLSL, /L = max\(L, uToon \+ /, 'never under the toon threshold');
  // the pieces: the currents (smeared), the ripples' lines, the motes, the skin and its edge line, the ring, the light
  for (const w of ['uBlade.x', 'bladeSkin(', 'bladeRing(', 'caus', 'mote', 'fleck', 'rim', 'uBlade.z', 'uBlade.y', 'uBladeC.z', 'uNight']) assert.ok(BLADE_FLUID_GLSL.includes(w), w);
  // the lite path: the ripples and the motes behind uBlade.w (a uniform: their fwidth stays in uniform flow)
  assert.match(BLADE_FLUID_GLSL, /bool lite = uBlade\.w > 0\.5;[\s\S]*if \(!lite\) \{[\s\S]*caus[\s\S]*mote[\s\S]*\}/);
  // a FLUID material of another kind compiles bladeFluid too: the plain currents there
  assert.match(BLADE_FLUID_GLSL, /vec3 bladeFluid\(float t\) \{[\s\S]*#else[\s\S]*#endif/);
  // the vertices: bowed back along the lag, the ring's bulge; only the blade (the bead has no fold)
  assert.match(BLADE_VERT, /if \(aFold\.y > 0\.0\)/);
  assert.ok(BLADE_VERT.includes('uBladeB.x') && BLADE_VERT.includes('uBladeB.y') && BLADE_VERT.includes('bladeRing(bv)'));
  // its glow: under the bloom threshold by day, over it after dark (a halo: it reads in the dark)
  assert.ok(BLADE_LOOK.glow + BLADE_LOOK.breath + BLADE_LOOK.full < 0.62, 'by day under post.js\' bloom threshold (0.62)');
  assert.ok(BLADE_LOOK.glow + BLADE_LOOK.night > 0.62, 'at night over it');
});

test('the preset\'s say: the handheld and Low go lite, the Deck and High keep the whole look', () => {
  const at = (k, low) => bladeLiteFor({ ...QUALITY_PRESETS[k], key: k }, low);
  assert.equal(at('handheld'), true, 'the handheld (its lighter ink pass)');
  assert.equal(at('low'), true, 'Low');
  assert.equal(at('deck'), false, 'the Deck');
  for (const k of ['high', 'medium', 'xbox', 'auto']) assert.equal(at(k), false, k);
  assert.equal(at('auto', true), true, 'a desktop Auto that had to drop resolution');
  assert.equal(bladeLiteFor(resolveQuality('auto', { handheld: true })), true, 'Auto on a handheld');
  assert.equal(bladeLiteFor(resolveQuality('auto', { deck: true })), false, 'Auto on the Deck');
  assert.match(src('src/main.js'), /BLADE_QUALITY\.lite = bladeLiteFor\(preset, low\);/, 'main.js applyDetail says it');
  BLADE_QUALITY.lite = true; assert.equal(bladeLite(), true);
  BLADE_QUALITY.lite = false; assert.equal(bladeLite(), false);
});

test('the smear and the lag follow the point\'s speed, capped; the idle tongue breathes about its share', () => {
  assert.equal(bladeSmear(0), 0);
  assert.ok(bladeSmear(10) > 0 && bladeSmear(10) < bladeSmear(20) && bladeSmear(BLADE_LOOK.smearAt) === 1 && bladeSmear(80) === 1);
  assert.equal(bladeLag(0), 0);
  assert.ok(bladeLag(20) < bladeLag(30) && bladeLag(1000) === BLADE_LOOK.lagMax, 'capped');
  assert.ok(bladeLag(47) > 0.04, `a fast cut trails the fluid several cm (${bladeLag(47).toFixed(3)} m)`);
  let lo = 1, hi = 0;
  for (let t = 0; t < 6; t += 0.05) { const k = bladeIdle(t); lo = Math.min(lo, k); hi = Math.max(hi, k); }
  assert.ok(lo > 0.8 * BLADE_LOOK.idle && hi < 1.2 * BLADE_LOOK.idle && hi - lo > 0.1 * BLADE_LOOK.idle, 'breathing about its share');
  assert.ok(BLADE_LOOK.idle * BLADE.length < 0.15, 'a short tongue, not a blade');
});

test('drops off the point: from its outer part when asked', () => {
  const style = wakeStyle(null), from = { a: v(0, 1, 0), b: v(0, 1, 1) }, seg = { a: v(0, 1, 0), b: v(1, 1, 0) };
  for (const d of shedDrops(from, seg, dt, { ...style, drops: 8 }, Math.random, 0.85)) assert.ok(d.pos.distanceTo(seg.a) >= 0.85 - 1e-9, 'off the point');
});

test('a drop with a floor lands once: gone, its land called; a flat splash lies on the ground', () => {
  const D = new Dots(new THREE.Group(), 16, new THREE.MeshBasicMaterial()), up = v(0, 1, 0), landed = [];
  D.add({ pos: v(0, 0.5, 0), vel: v(0, -2, 0), grav: 9, life: 2, floor: 0, land: (d) => landed.push(d.pos.y) });
  D.add({ pos: v(1, 0.5, 0), vel: v(0, -2, 0), grav: 9, life: 2 });   // (no floor: falls through)
  for (let i = 0; i < 40; i++) D.update(dt, up);
  assert.equal(landed.length, 1, 'landed once');
  assert.ok(landed[0] < 0 && landed[0] > -0.2, 'where it crossed the floor');
  assert.equal(D.list.length, 1, 'gone; the one without a floor still falling');
  D.add({ pos: v(0, 0, 0), flat: true, size: 0.05, life: 1 });
  D.update(dt, up);
  const m = new THREE.Matrix4(), s = v(), q = new THREE.Quaternion(), p = v();
  D.mesh.getMatrixAt(D.mesh.count - 1, m); m.decompose(p, q, s);
  assert.ok(s.y < 0.3 * s.x, 'flat on the ground');
});

test('in play: a swing smears and bows the fluid, a parry sends a gold ring and flares it, the tongue stands between cuts', async () => {
  items.grant('backpack');
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, v(0, 0, -60), { moves: true, body: 'plain' });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const b = tool.blade, U = b.swordMat.uniforms;
  const drops = [], add = tool.drops.add.bind(tool.drops);
  tool.drops.add = (d) => { drops.push(d); return add(d); };
  const tick = (input = {}) => { p.update(dt, input, CAM_PLUS_Z); tool.update(dt, input); p.humanoid.hands.update(dt, playerHands(p)); };
  for (let i = 0; i < 10; i++) tick({});
  assert.ok(!b.bladeGroup.visible, 'on his back: no blade out of the cup');
  tick({ KeyF: true });
  let smear = 0, lag = 0, clock = U.uFluidA.value.z;
  for (let i = 0; i < 60 && b.swinging; i++) { tick({}); smear = Math.max(smear, U.uBlade.value.x); lag = Math.max(lag, Math.hypot(U.uBladeB.value.x, U.uBladeB.value.y)); }
  assert.ok(smear > 0.5, `the cut smears it (${smear.toFixed(2)})`);
  assert.ok(lag > 0.01, `and bows it back (${lag.toFixed(3)} object m)`);
  assert.ok(U.uFluidA.value.z - clock > 60 * dt, 'its currents ran faster than the clock through the cut');
  assert.ok(drops.some((d) => d.land && d.floor !== undefined && WAKE_TONES.includes(d.color)), 'drops that splash where they land');
  // between cuts, in the fist: the tongue of fluid, breathing; smear gone
  for (let i = 0; i < 40; i++) tick({});
  assert.ok(b.swinging === false && b.lit < 0.05 && b.bladeGroup.visible, 'the tongue stands out of the cup');
  const len = b.bladeGroup.scale.y * b.builtLength;
  assert.ok(len > 0.05 && len < 0.15, `a short one (${len.toFixed(3)} m)`);
  assert.ok(U.uBlade.value.x < 0.2, 'calm again');
  const breath = U.uBlade.value.z; tick({}); assert.ok(U.uBlade.value.z > breath, 'breathing');
  // a perfect parry: a gold ring up from the cup, a flash, the blade flared out of it
  b.guardK = 1; b.perfectReady = true; b.guardAge = 0; b.guardArc = null; tool.reserve.level = tool.reserve.max;
  const front = p.pos.clone().addScaledVector(b.dir, 2);
  assert.equal(b.block(front), 'perfect');
  assert.ok(b.ripple.age === 0 && b.ripple.gold === 1 && b.ripple.from === 0 && b.flash > 0.5 && b.lit >= 0.9);
  b.place(dt);
  assert.ok(U.uBladeB.value.z < 0.1 && U.uBladeC.value.y === 1 && U.uBladeC.value.x === BLADE_LOOK.ripple.parry, 'the ring in the shader');
  // the lite look: in the shader's uniform, and no extra drops off the point
  BLADE_QUALITY.lite = true; b.place(dt);
  assert.equal(U.uBlade.value.w, 1);
  BLADE_QUALITY.lite = false; b.place(dt);
  assert.equal(U.uBlade.value.w, 0);
  tool.dispose();
});

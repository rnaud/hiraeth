// The Unity twin of the water's contact foam (unity/Memento/Assets/Memento/Shaders/Surface.shader contactFoam; its
// passes in Rendering/MementoFeature.cs): the same CONTACT numbers as src/water-shader.js, the water drawn last and
// writing no depth, over a copy of the scene's depth (docs/systems/water.md, "Contact foam").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTACT } from '../src/water-shader.js';

const read = (p) => readFileSync(new URL(`../unity/Memento/Assets/Memento/${p}`, import.meta.url), 'utf8');
const surface = read('Shaders/Surface.shader');
const feature = read('Rendering/MementoFeature.cs');
const loader = read('Runtime/WorldLoader.cs');
const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

test("the Unity shader's contact foam uses the web's CONTACT numbers", () => {
  const fn = surface.slice(surface.indexOf('float contactFoam('), surface.indexOf('float3 waterLook('));
  assert.ok(fn.length > 200, 'Surface.shader has contactFoam before waterLook');
  const want = [
    `clamp(fwidth(ray) / max(px, 1e-4), ${f(CONTACT.slope[0])}, ${f(CONTACT.slope[1])})`,
    `clamp(max(${f(CONTACT.band)}, ${f(CONTACT.minPx)} * pr * px), ${f(CONTACT.band)}, ${f(CONTACT.maxBand)})`,
    `max(${f(CONTACT.gap)}, ${f(CONTACT.gapPx)} * pr * px)`,
    `smoothstep(${f(CONTACT.far[0])}, ${f(CONTACT.far[1])}, px)`,
    `smoothstep(${f(CONTACT.detail[0])}, ${f(CONTACT.detail[1])}, px)`,
    `bw * (1.0 + ${f(CONTACT.breathe)})`,
    `bw * (1.0 + ${f(CONTACT.breathe)} * sin(`,
  ];
  for (const w of want) assert.ok(fn.includes(w), `contactFoam has ${w}`);
  assert.match(surface, /float wavelets = contactFoam\(p, t, px, wd, pix, vd, foam\);/, 'waterLook raises its foam and draws its wavelets');
});

test('the foam is off unless asked for (-waterContact): the shipped render path unchanged until it is seen working', () => {
  assert.match(feature, /public static bool waterContact = System\.Array\.IndexOf\(System\.Environment\.GetCommandLineArgs\(\), "-waterContact"\) >= 0;/);
  assert.match(feature, /bool split = Settings\.waterContact && WaterSeen;/, 'off, no water pass and no water list');
});

test('the water is drawn last over the scene depth, writing none of its own', () => {
  assert.match(surface, /ZWrite \[_ZWrite\]/, 'the G-buffer pass takes its depth writes from the material');
  assert.match(loader, /if \(Rendering\.MementoFeature\.Settings\.waterContact\)\s*\{\s*mat\.renderQueue = Rendering\.MementoFeature\.WaterQueue; mat\.SetFloat\("_ZWrite", 0\);/, 'the water materials, only with the foam on');
  assert.match(feature, /new RenderQueueRange\(WaterQueue, WaterQueue\)/, 'the water pass draws the water queue');
  assert.match(feature, /new FilteringSettings\(RenderQueueRange\.opaque\)/, 'the opaque pass leaves it out (WaterQueue is past the opaque range)');
  const q = Number(feature.match(/WaterQueue = (\d+)/)?.[1]);
  assert.ok(q > 2500, 'WaterQueue is outside RenderQueueRange.opaque (0..2500)');
  assert.ok(feature.indexOf('"Memento scene depth"') < feature.indexOf('"Memento G-buffer water"'), 'the depth is copied before the water is drawn');
});

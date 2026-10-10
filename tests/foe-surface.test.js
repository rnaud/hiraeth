// The enemies' painted surfaces (src/foe-surface.js, src/enemies/surfaces.js; docs/systems/foes.md, "Procedural
// surfaces"): a material compiles only the features it names, every skin's colours resolve from its palette, every
// part named in the table is a part its body builder makes, and every built archetype wears a surface in every skin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeMaterial } from '../src/materials.js';
import { FOE_SURFACE_FEATURES, FOE_SURFACE_GLSL, FOE_SURFACE_PARS, foeSurfaceDefines, foeSurfaceOf } from '../src/foe-surface.js';
import { SURFACES, surfaceColor, surfaceFor } from '../src/enemies/surfaces.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { archetypeModel } from '../src/enemies/plans/index.js';

const BUILT = Object.keys(SURFACES);

test('a foe surface compiles only the features it names, with their uniforms', () => {
  assert.deepEqual(foeSurfaceDefines({ spots: { color: '#fff' }, gloss: true }), { FOE_SURFACE: 1, FS_SPOTS: 1, FS_GLOSS: 1 });
  assert.deepEqual(Object.keys(foeSurfaceOf({ spots: true, nonsense: true, mottle: null })), ['spots'], 'unknown and unset features dropped');
  const m = makeMaterial({ color: '#7b8697', foeSurface: { spots: { color: '#efe5c4', star: 1 }, belly: { color: '#e9dfc8' } }, key: 'test.foe-surface' });
  assert.equal(m.defines.FOE_SURFACE, 1);
  assert.ok(m.defines.FS_SPOTS && m.defines.FS_BELLY && !m.defines.FS_MOTTLE);
  assert.ok(m.uniforms.uFs_spotsC && m.uniforms.uFsBellyC && !m.uniforms.uFsMottleC);
  assert.equal(m.uniforms.uFs_spotsS.value.x, 1, 'a lichen star');
  const plain = makeMaterial({ color: '#7b8697', key: 'test.foe-surface.plain' });
  assert.ok(!plain.defines.FOE_SURFACE, 'a material without one is unchanged');
  for (const f of FOE_SURFACE_FEATURES) {
    assert.match(FOE_SURFACE_GLSL, new RegExp(`#ifdef FS_${f.toUpperCase()}\\b`), `${f}: drawn`);
    assert.match(FOE_SURFACE_PARS, new RegExp(`#ifdef FS_${f.toUpperCase()}\\b`), `${f}: its uniforms`);
  }
  // bands and stripes across x, y, z, rings round y (3) and lines out from it by angle (4: a bulb's ribs, a cap's gills)
  assert.match(FOE_SURFACE_GLSL, /a < 3\.5 \? length\(p\.xz\) : atan\(p\.z, p\.x\)/);
  const ribs = makeMaterial({ color: '#93ad98', foeSurface: { stripes: { color: '#5a7060', axis: 4, period: 0.18, width: 0.07 } }, key: 'test.foe-surface.ribs' });
  assert.equal(ribs.uniforms.uFs_stripes.value.x, 4, 'the angle axis');
  // hooked into the surface shader additively: its patterns in the albedo stage, its gloss once the light is known
  assert.match(m.fragmentShader, /foeSurface\(albedo, emit, n\)/);
  assert.match(m.fragmentShader, /foeGloss\(albedo, L, n\)/);
});

test('the table’s colours: hex, a palette key, darker or paler', () => {
  const P = { shell: '#808080' };
  assert.equal(surfaceColor('#123456', P), '#123456');
  assert.equal(surfaceColor('shell', P), '#808080');
  assert.equal(surfaceColor('shell*0.5', P), '#404040');
  assert.equal(surfaceColor('shell+0.5', P), '#c0c0c0');
  assert.equal(surfaceColor('nothing', P), undefined);
});

test('every skin’s surfaces resolve from its palette, on parts its body really makes', () => {
  for (const a of BUILT) {
    assert.ok(SKINS[a], `${a}: an archetype with skins`);
    const src = readFileSync(new URL(`../src/enemies/plans/${{ crab: 'walker', lizard: 'quadruped', hound: 'quadruped', tripod: 'piston', blot: 'blob', centipede: 'centipede', worm: 'burrower', ray: 'glider', moth: 'flyer', jelly: 'floater', toad: 'hopper', heron: 'stilt', skitter: 'skitterers', rootknot: 'tentacled', brute: 'brute', drone: 'hover', cart: 'tracked', bell: 'siege', shade: 'humanoid', roller: 'roller', marionette: 'strings' }[a]}.js`, import.meta.url), 'utf8');
    const parts = new Set([...src.matchAll(/M\.(?:mat|own)\([`'"]([a-z0-9]+)/g)].map((m) => m[1]));
    for (const [skin, table] of Object.entries(SURFACES[a])) {
      if (skin !== '*') assert.ok(SKINS[a][skin], `${a}: a skin ${skin}`);
      for (const name of Object.keys(table)) assert.ok(parts.has(name), `${a}.${skin}: ${name} is a part of its body`);
    }
    for (const w of Object.keys(SKINS[a])) {
      const S = skinOf(a, w);
      for (const name of new Set([...Object.keys(SURFACES[a]['*'] ?? {}), ...Object.keys(SURFACES[a][w] ?? {})])) {
        const s = surfaceFor(a, S, name);
        for (const [f, v] of Object.entries(s ?? {})) {
          if (f === 'mat') continue;
          assert.ok(FOE_SURFACE_FEATURES.includes(f), `${a}@${w}.${name}: ${f} is a feature`);
          for (const k of ['color', 'color2']) if (k in v) assert.match(v[k], /^#[0-9a-f]{6}$/i, `${a}@${w}.${name}.${f}.${k} resolves (${v[k]})`);
        }
      }
    }
  }
});

test('a cracked hull (the furnace brute’s): a fine net of seams and a wider net of glowing veins, opening as it is hurt', () => {
  const m = makeMaterial({ color: '#e6d8b4', foeSurface: { cracks: { color: '#a77bff', ink: '#4a4452', scale: 0.3, veins: 0.8, open: 0.25 } }, key: 'test.foe-surface.cracks' });
  assert.ok(m.defines.FS_CRACKS && m.uniforms.uFsCracksC && m.uniforms.uFsCracksV && m.uniforms.uFsCracksI);
  assert.equal(m.uniforms.uFsCracksO.value, 0.25, 'its opening: a uniform its body sets as it is hurt');
  assert.ok(Math.abs(m.uniforms.uFsCracksV.value.x - 0.8) < 1e-9, 'the veins’ cells');
  assert.match(FOE_SURFACE_GLSL, /uFsCracksO/);
  // (the ink of its seams resolves from the skin's palette like a colour)
  const S = skinOf('brute', 'perdide2'), s = surfaceFor('brute', S, 'body');
  assert.match(s.cracks.ink, /^#[0-9a-f]{6}$/i);
  assert.equal(s.cracks.color, S.palette.glow);
});

test('every built archetype wears a painted surface in every skin, at no extra draw', () => {
  for (const a of BUILT) {
    assert.equal(ARCHETYPES[a].status, 'built', a);
    for (const w of Object.keys(SKINS[a])) {
      const m = archetypeModel(ARCHETYPES[a].kind, w);
      let painted = 0, meshes = 0;
      m.group.traverse((o) => { if (o.isMesh) { meshes++; if (o.material?.defines?.FOE_SURFACE) painted++; } });
      assert.ok(painted > 0, `${a}@${w}: painted`);
      m.dispose?.();
    }
  }
});

// The Surface shader's walls and bare variants and the veil on the glass's lean one (issue #727, docs/systems/performance.md
// "Unity on the AYN Thor, round two"): a variant leaves out code its materials never run, so every check of a material that
// keeps it off one must match a branch the variant leaves out, and the other way round.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../unity/Hiraeth/', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const shader = read('Assets/Hiraeth/Shaders/Surface.shader');
const renderer = read('Assets/HiraethJS/Runtime/BridgeRenderer.cs');
const runner = read('Assets/HiraethJS/Runtime/BridgeRunner.cs');
const leanBody = renderer.split('static void Lean(Material m)')[1].split('/// <summary>How many of the full variant')[0];
const fewOk = leanBody.split('bool fewOk = ')[1].split(';')[0];
const wallsOk = leanBody.split('bool wallsOk = ')[1].split(';')[0];
const plainOk = leanBody.split('bool plainOk = ')[1].split(';   // (and Lorn')[0];
const frag = shader.split('GBufferOut frag(Varyings i')[1].split('#if defined(HIRAETH_PREPASS)')[0];
// (the material's property each guarded branch reads, by its guard)
const guarded = (k) => [...frag.matchAll(new RegExp(`\\b${k} && \\(?(_[A-Za-z]+)`, 'g'))].map((m) => m[1]);

test('the macros: walls leave out the newer marks, both the few materials\' paths, walls a room\'s light too', () => {
  assert.match(shader, /#pragma multi_compile_local_fragment _ HIRAETH_PLAIN HIRAETH_WALLS HIRAETH_BARE\n/);
  assert.match(shader, /#if defined\(HIRAETH_PLAIN\) \|\| defined\(HIRAETH_BARE\) \|\| defined\(HIRAETH_SKIN\)\n\s+#define WALLK false/);
  assert.match(shader, /#if defined\(HIRAETH_WALLS\)\n\s+#define MARKSK false\n\s+#define ROOMK false\n\s+#else\n\s+#define MARKSK WALLK\n\s+#define ROOMK true/);
  assert.match(shader, /#if defined\(HIRAETH_WALLS\) \|\| defined\(HIRAETH_BARE\)\n\s+#define OTHERK false\n\s+#else\n\s+#define OTHERK true/);
  // (plain or strata only: the outfit's, the eye's, the ribbon's, the ground's and the water's paths folded away)
  assert.match(frag, /#if defined\(HIRAETH_WALLS\) \|\| defined\(HIRAETH_BARE\)\n\s+int mode = _Mode > 1\.5 \? MODE_STRATA : MODE_PLAIN;/);
});

test('every newer mark the walls variant leaves out keeps a material off it', () => {
  const marks = guarded('MARKSK');
  assert.deepEqual([...new Set(marks)].sort(), ['_Beds', '_Domes', '_FacetMarks', '_Interior', '_RockTop', '_SeaWall', '_Sheet', '_ShellCenter', '_Stone', '_Timber'].sort());
  // (the sea walls' branch also draws the pale stone, the buried city and the channels)
  for (const k of [...marks, '_PaleStone', '_Buried', '_Channel']) assert.match(wallsOk, new RegExp(`V\\(m, "${k}"\\)\\.[xw] <= 0`), k);
  // (and every one of them is a wall's mark: none of them on the plain or bare variants either)
  for (const k of [...marks, '_PaleStone', '_Buried', '_Channel']) assert.match(plainOk, new RegExp(`V\\(m, "${k}"\\)`), k);
  // (paving stays in the walls variant: the City-Shaft's plazas)
  assert.match(frag, /UNITY_BRANCH if \(WALLK && _Paving\.x > 0\.0/);
});

test('every path of the few that walls and bare leave out keeps a material off both', () => {
  const few = [...new Set(guarded('OTHERK'))].sort();
  assert.deepEqual(few, ['_DuneOn', '_Folds', '_Creases', '_Lining', '_Plates', '_ToDisplay'].sort());
  for (const k of few) assert.match(fewOk, new RegExp(`${k}"\\)(\\.w)? <= 0`), k);
  assert.match(fewOk, /^\(mode == 0 \|\| mode == 2\)/);
  // (a room's light: walls only, ROOMK)
  assert.deepEqual([...new Set(guarded('ROOMK'))], ['_Room']);
  assert.match(wallsOk, /V\(m, "_Room"\)\.w <= 0f/);
  assert.doesNotMatch(leanBody.split('bool bareOk = ')[1].split(';')[0], /_Room/);
  // (the stipple and the form's hatching are the world's look, globals: never a reason, never left out)
  assert.doesNotMatch(frag, /OTHERK && [^\n]*(_ShadeStyle|_FormHatch)/);
});

test('bare is plain, walls is the plain lean one with marks, neither slim; Android only by default', () => {
  assert.match(leanBody, /bool bareOk = plainOk && walls && kw == "HIRAETH_LEAN" && fewOk;/);
  assert.match(wallsOk, /^kw == "HIRAETH_LEAN" && !plainOk && walls && fewOk && /);
  assert.match(leanBody, /&& !wallsOk && Slim\(m, mode\)\) kw = "HIRAETH_LEAN_SLIM";/);
  assert.match(renderer, /public static bool walls =\n#if UNITY_ANDROID && !UNITY_EDITOR\n\s+true;\n#else\n\s+false;\n#endif/);
  assert.match(runner, /if \(BridgeArgs\.Flag\("-walls"\)\) BridgeRenderer\.walls = true;/);
  assert.match(runner, /if \(BridgeArgs\.Flag\("-no-walls"\)\) BridgeRenderer\.walls = false;/);
});

test('a veil alone cuts on the glass\'s lean variant', () => {
  assert.match(leanBody, /if \(leanRare && \(why == "scrub" \|\| why == "glass" \|\| why == "see" \|\| why == "veil"\) && mode != 1 && mode != 3 && RareCount\(m\) == 1\)/);
  assert.match(frag, /UNITY_BRANCH if \(GLASSK && _Veil > 0\.0 && _MSurfaceDebug < 3\.5/);
  assert.match(shader, /void fragEntry\(DepthVaryings i\) \{ if \(\(GLASSK && \(_Glass > 0\.0 \|\| _Veil > 0\.0 \|\|/);
  assert.doesNotMatch(shader, /LEANK && _Veil/);
});

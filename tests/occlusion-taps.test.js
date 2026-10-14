// The composite's screen-space occlusion, the crease shading (post.js creaseAO, CREASE): smooth and stable, no grain
// (issue #322: its per-pixel random turn drew a grey speckle crawling in every room), no row of an edge's copies (its
// 48 taps shared over the 2 x 2 quad and averaged there), people and movers seen past; and the spot blacks gone (issue
// #322's second look, the author: "we removed the shadows which were helpful, but we kept the botched dark patterns":
// blotches with torn edges along every room's wall-ceiling corner and under every arch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPost, PRESETS, CREASE, CREASE_TAPS, glslVec2s, glslVec3s, occlusionShare, DUST_PAST, inkFeatures } from '../src/post.js';
import { QUALITY_PRESETS } from '../src/perf.js';

const post = createPost();
const shader = post.scene.children[0].material.fragmentShader;
const unity = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Composite.shader', import.meta.url), 'utf8');
const body = (name, src = shader) => {
  const a = src.indexOf(`float ${name}(`);
  assert.ok(a >= 0, name);
  let depth = 0, i = src.indexOf('{', a);
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error(`unclosed ${name}`);
};

test('the crease shading is back, web and Unity, on the presets that drew it before (issue #322)', () => {
  assert.ok(/uniform float uAO;/.test(shader) && /uniform float uCrevice;/.test(shader));
  assert.ok(shader.includes('float ao = creaseOcc * (1.0 - smoothstep(80.0, 260.0, depth)) * uAO * (1.0 - emitHere);'));
  assert.ok(PRESETS['Moebius print'].uCrevice > 0, 'the print fills its deepest crevices');
  for (const k of ['auto', 'deck']) assert.equal(QUALITY_PRESETS[k].ao, true, `${k}: crease shading`);
  for (const k of ['handheld', 'low']) assert.equal(QUALITY_PRESETS[k].ao, false, `${k}: none (its cost)`);
  assert.ok(/float creaseAO\(float2 uv, float3 nW, float d, int lane\)/.test(unity) && /_AO > 0\.0/.test(unity));
  const look = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Runtime/HiraethLook.cs', import.meta.url), 'utf8');
  assert.ok(look.includes('"uAO:_AO"') && look.includes('post.F("uCrevice", 0)'));
});

test('its taps are the same for every quad: no random turn, no hash, no cos or sin per pixel (no grain to crawl)', () => {
  const ao = body('creaseAO');
  assert.ok(!/hash\(|gl_FragCoord|\bfc\b/.test(ao), 'nothing per pixel turns the pattern');
  assert.ok(!/\bcos\(|\bsin\(/.test(ao), 'the directions are constants');
  assert.ok(!/\bcontinue\b|\bbreak\b/.test(ao), 'a tap that doesn\'t count weighs 0, it isn\'t skipped');
  for (let l = 0; l < CREASE.lanes; l++) assert.ok(shader.includes(glslVec3s(`CREASE_TAPS${l}`, CREASE_TAPS[l])), `lane ${l}'s taps in the composite`);
  assert.match(glslVec3s('X', [[1, -0.5, 0.25]]), /^const vec3 X\[1\] = vec3\[1\]\(vec3\(1\.0000000, -0\.5000000, 0\.2500000\)\);$/);
  assert.match(glslVec2s('X', [[1, -0.5]]), /^const vec2 X\[1\] = vec2\[1\]\(vec2\(1\.0000000, -0\.5000000\)\);$/);
  // the surface flags (is the tap on a grass blade, or a person?) only read for a tap that would close something in,
  // or one nearer than the point (a person hiding what stands behind them)
  assert.ok(ao.includes('if (c > 0.0 || (sd > 0.0 && sd < d)) { float a = texture(tHatch, suv).a, t = mod(a, 16.0); np = step(mod(t, 8.0), 1.5) * max(step(a, 63.5), self); c *= step(t, 7.5) * np; }'));
  assert.equal((ao.match(/texture\(tHatch/g) ?? []).length, 1);
  // the Unity port: the same spiral and lanes worked out per tap, no hash, and the quad's mean in uniform control flow
  const u = body('creaseAO', unity);
  assert.ok(!/hash\(/.test(u) && u.includes('float k = float(i * 4 + lane);') && u.includes('float a = 0.4 + k * 2.39996;'));
  assert.ok(u.includes('float rn = sqrt((k + 0.5) / 48.0), w = 1.0 - 0.6 * rn * rn;') && u.includes(`i < ${CREASE.taps}`));
  const frag = unity.slice(unity.indexOf('float4 frag(V2F i) : SV_Target'));
  assert.ok(frag.indexOf('creaseOcc = quadMean(creaseOcc, i.pos.xy);') > 0 && frag.indexOf('creaseOcc = quadMean(creaseOcc, i.pos.xy);') < frag.indexOf('float ao = creaseOcc'));
  assert.ok(body('quadMean', unity).includes('ddx(v)') && body('quadMean', unity).includes('ddy(h)'));
});

test('the quad\'s four lanes share one golden-angle spiral of 48 taps out to the radius, outer taps weighing less', () => {
  const n = CREASE.taps * CREASE.lanes;
  assert.equal(CREASE_TAPS.length, 4);
  const all = CREASE_TAPS.flat();
  assert.equal(all.length, n);
  const radii = all.map(([x, y]) => Math.hypot(x, y)).sort((a, b) => a - b);
  radii.forEach((r, k) => assert.ok(Math.abs(r - Math.sqrt((k + 0.5) / n)) < 1e-9, `tap ${k}: √-spaced`));
  for (let l = 0; l < 4; l++) CREASE_TAPS[l].forEach(([x, y, w], i) => {
    const k = i * 4 + l, a = CREASE.turn + k * 2.39996, r = Math.sqrt((k + 0.5) / n);
    assert.ok(Math.abs(x - Math.cos(a) * r) < 1e-12 && Math.abs(y - Math.sin(a) * r) < 1e-12);
    assert.ok(Math.abs(w - (1 - CREASE.falloff * r * r)) < 1e-12 && w > 0.3 && w <= 1);
  });
  // every lane covers the whole radius (not one lane the inner taps, another the outer)
  for (const lane of CREASE_TAPS) {
    const r = lane.map(([x, y]) => Math.hypot(x, y));
    assert.ok(Math.min(...r) < 0.3 && Math.max(...r) > 0.95);
  }
});

test('the quad\'s mean is taken in uniform control flow, from both derivatives: each pixel then reads the four lanes\' mean', () => {
  // quadMean: the left / bottom pixel of a pair adds half its difference to the other, the right / top one takes it off
  const q = [[0.1, 0.7], [0.4, 0.25]];   // [y][x] in a quad
  const dx = (row) => row[1] - row[0];
  const h = q.map((row) => row.map((v, x) => v + 0.5 * (x === 0 ? 1 : -1) * dx(row)));
  const m = h.map((row, y) => row.map((v, x) => v + 0.5 * (y === 0 ? 1 : -1) * (h[1][x] - h[0][x])));
  const mean = (0.1 + 0.7 + 0.4 + 0.25) / 4;
  for (const row of m) for (const v of row) assert.ok(Math.abs(v - mean) < 1e-12);
  assert.ok(body('quadMean').includes('float h = v + 0.5 * (q.x < 0.5 ? 1.0 : -1.0) * dFdx(v);'));
  assert.ok(body('quadMean').includes('return h + 0.5 * (q.y < 0.5 ? 1.0 : -1.0) * dFdy(h);'));
  // worked out at the top of main, before the first branch that isn't the same over the screen (the debug views'
  // early returns are uniform), and only read further down
  const main = shader.slice(shader.lastIndexOf('void main() {', shader.indexOf('creaseOcc = quadMean(creaseOcc);')));
  const at = main.indexOf('creaseOcc = quadMean(creaseOcc);');
  assert.ok(at > 0 && main.indexOf('if (isSky) {') > at && main.indexOf('// ---- 3b. crease shading') > at);
  assert.ok(main.slice(0, at).includes('creaseOcc = creaseAO(uv, N.xyz, depth, mover, int(lq.x + 2.0 * lq.y));'));
});

test('a person closes nothing in: no crease halo round a climber or round people’s feet', () => {
  // gHatch.a packs glow (0..1) + 2 hero + 4 figure + 8 soft + 16 face + 32 drift: notPerson(suv) is 0 on the
  // traveller and on anyone else, whatever else the pixel carries, and 1 on everything that isn't a person
  const notPerson = (a) => ((a % 8) <= 1.5 ? 1 : 0);   // (GLSL step(mod(a, 8), 1.5))
  for (const glow of [0, 0.6, 1]) for (const soft of [0, 8]) for (const face of [0, 16]) for (const drift of [0, 32]) {
    const rest = glow + soft + face + drift;
    assert.equal(notPerson(rest), 1, `not a person: ${rest}`);
    assert.equal(notPerson(rest + 2), 0, `the traveller: ${rest + 2}`);
    assert.equal(notPerson(rest + 4), 0, `a figure: ${rest + 4}`);
  }
  assert.ok(shader.includes('float notPerson(vec2 suv) { return step(mod(texture(tHatch, suv).a, 8.0), 1.5); }'));
});

test('a mover (a foe, the drone) is seen past as a person is: no dark halo on the wall behind a hovering drone', () => {
  // gHatch.a + 64 (materials.js MOVER): 0 on a mover's pixel, unless the point is on a mover itself (self = 1)
  const notStanding = (a, self) => ((a % 8) <= 1.5 ? 1 : 0) * Math.max(a <= 63.5 ? 1 : 0, self);
  for (const glow of [0, 0.5, 0.875]) for (const soft of [0, 8]) for (const face of [0, 16]) for (const drift of [0, 32]) {
    const rest = glow + soft + face + drift;
    assert.equal(notStanding(rest, 0), 1);
    assert.equal(notStanding(rest + 64, 0), 0, `a mover: ${rest + 64}`);
    assert.equal(notStanding(rest + 64, 1), 1, `seen from the mover itself: ${rest + 64}`);
    assert.equal(notStanding(rest + 4, 1), 0, 'a person, from a mover');
  }
  // every reader of gHatch.a takes the mover's 64 off first (the main decode, the line kernel's drift test)
  assert.ok(shader.indexOf('surface.a -= 64.0 * mover;') < shader.indexOf('float drift = step(31.5, surface.a);'));
  assert.ok(shader.includes('vec4 fa = mod(vec4(t1.a, t2.a, t3.a, t4.a), 64.0);'));
});

test('a person in front leaves no pale ghost in the shading behind them (Marrow by the ship, the tree’s stairs)', () => {
  // a point in a recess: 6 of 8 taps close it in. A person steps in front and hides 3 of them: counted as open the
  // share would fall from 0.75 to 0.375 and the shading get a pale hole the person's shape; left out, the share is
  // the remaining taps' and a person in front of open ground closes nothing
  const recess = [1, 1, 1, 1, 1, 1, 0, 0].map((c) => ({ c, person: false }));
  assert.equal(occlusionShare(recess), 0.75);
  const hidden = recess.map((t, i) => (i < 3 ? { c: 0, person: true } : t));
  assert.ok(Math.abs(occlusionShare(hidden) - 0.6) < 1e-12, 'the five taps still seeing the recess');
  assert.ok(occlusionShare(hidden) > hidden.reduce((a, t) => a + t.c, 0) / 8 + 0.2, 'no longer counted as open');
  assert.equal(occlusionShare(Array.from({ length: 8 }, (_, i) => ({ c: 0, person: i < 5 }))), 0);
  assert.equal(occlusionShare(Array.from({ length: 4 }, () => ({ c: 1, person: true })), CREASE.minSeen), 0);
  // weighted: a uniform recess stays a uniform share whatever the weights
  assert.equal(occlusionShare(CREASE_TAPS[0].map(([, , w]) => ({ c: 1, w }))), 1);
  // the shader takes the same share (× gain, clamped), and so does the Unity port
  assert.ok(body('creaseAO').includes(`return clamp(ao / max(seen, ${CREASE.minSeen.toFixed(2)}) * ${CREASE.gain.toFixed(2)}, 0.0, 1.0);`));
  assert.ok(body('creaseAO').includes('ao += c * tap.z; seen += np * tap.z;'));
  assert.ok(body('creaseAO', unity).includes('return saturate(ao / max(seen, 0.6) * 2.2);'));
  assert.ok(body('creaseAO', unity).includes('np = step(fmod(t, 8.0), 1.5)'));
});

test('the spot blacks are gone, web and Unity: no enclosure, no pocket filled with a hard-edged mass (issue #322)', () => {
  for (const src of [shader, unity]) {
    assert.ok(!/enclosure\(|spotUv|spotTapAt|planeNear|SPOT_TAPS/.test(src));
    assert.ok(!/float spot = smoothstep/.test(src) && !/lerp\(col, spotC, spot \* k\)|mix\(col, spotC, spot \* k\)/.test(src));
  }
  // what is left of the tier: cast shadows a step deeper toward the darkest tone (uSpot.w), compiled in only then
  assert.ok(shader.includes('float castK = smoothstep(0.05, 0.2, dot(N.xyz, uSunDir)) * (1.0 - shadeLift) * uSpot.w;'));
  const U = post.uniforms;
  U.uSpot.value = [1, 3, 0.3, 0];
  assert.ok(!('INK_SPOT' in inkFeatures(U)), 'no cast darkening: nothing compiled in');
  U.uSpot.value = [1, 3, 0.3, 0.2];
  assert.ok('INK_SPOT' in inkFeatures(U));
  const look = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Runtime/HiraethLook.cs', import.meta.url), 'utf8');
  assert.ok(look.includes('Keyword("HIRAETH_INK_SPOT", spot.x > 0 && spot.w > 0);'));
  // its JS mirrors are gone too
  return import('../src/post.js').then((m) => { for (const k of ['spotShare', 'spotBehind', 'spotFrame', 'spotSwell', 'SPOT_PAST', 'SPOT_POCKET', 'SPOT_FRAME', 'OCCLUSION_TAPS']) assert.ok(!(k in m), k); });
});

test('the dust band at a wall’s foot looks past a person on its probe: no pale copy of the traveller in it', () => {
  const at = shader.indexOf('weathered walls: a flat band of darker dust');
  const part = shader.slice(at, shader.indexOf('...and where sand banks', at));
  assert.ok(part.includes('float onPerson = 1.0 - notPerson(puv);'), 'the probe asks whether it is on a person');
  assert.ok(part.includes(`for (int k = 0; k < ${DUST_PAST.steps}; k++)`) && part.includes(`max(dyPx, ${DUST_PAST.minStep.toFixed(3)} * uRes.y)`), 'and looks on down past them');
  assert.ok(part.includes('Np.y > 0.7 && onPerson < 0.5'), 'never takes a person for the ground');
});

// Ink lines by the size of what they draw (post.js 1a, INK_SIZE; the traveller's face from afar, head-ink.js
// HEAD_INK_FAR): docs/systems/rendering.md "Ink lines by size on screen", docs/audits/ink-lines-v1.34.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPost, INK_SIZE, inkFrame, DEBUG_VIEWS } from '../src/post.js';
import { HEAD_INK, HEAD_INK_FAR, HEAD_INK_GLSL } from '../src/characters/head-ink.js';

const shader = createPost().scene.children[0].material.fragmentShader;

test('the frame: lines drawn at their width from 900 CSS px tall, thinner on a smaller frame, never under 0.6', () => {
  assert.equal(inkFrame(1080), 1);
  assert.equal(inkFrame(950), 1);   // (a 1080p monitor's browser window: as approved)
  assert.ok(Math.abs(inkFrame(720) - 0.8) < 1e-9);
  assert.ok(Math.abs(inkFrame(800) - 800 / 900) < 1e-9);
  assert.equal(inkFrame(390), 0.6);   // (a phone held sideways)
  assert.ok(shader.includes(`float frameK = clamp(uRes.y / max(uPixelRatio, 1e-3) / ${INK_SIZE.frame[0].toFixed(1)}, ${INK_SIZE.frame[1].toFixed(2)}, 1.0);`));
  // every kernel of the line pass takes it: silhouettes, interior lines, the figures' redraw and its probe
  for (const k of ['silW * uPixelRatio * frameK, false', 'inW * uPixelRatio * frameK, true', 'mix(silW, inW, 0.5) * uPixelRatio * frameK', 'max(silW * uPixelRatio * frameK, 1.0)'])
    assert.ok(shader.includes(k), k);
});

test('the size rules run only where there is ink, never on the traveller or the sky, and read what inkLines left', () => {
  const a = shader.indexOf('1a. lines by the size of what they draw');
  assert.ok(a > 0);
  const block = shader.slice(a, shader.indexOf('People far away', a));
  assert.ok(block.includes('if (ink > 0.02 && hero < 0.5 && !isSky)'));
  assert.ok(block.includes(`mix(1.0, ${INK_SIZE.onSliver.toFixed(2)},`), 'a sliver keeps its colour');
  assert.ok(block.includes(`mix(1.0, ${INK_SIZE.farSide.toFixed(2)},`), 'a thin shape\'s outline is lighter');
  assert.ok(block.includes('ownK.z > 0.5 * uDepthThresh'), 'the probe only on a depth edge\'s far side');
  assert.equal((block.match(/texture\(tNormal/g) ?? []).length, 2, 'two taps, no more');
  // inkLines only stores the neighbours' differences (no smoothstep for pixels without ink)
  const lines = shader.slice(shader.indexOf('vec4 inkLines('), shader.indexOf('// ---------------------------------------------------------------- crease shading'));
  assert.ok(lines.includes('gSliver = vec4(') && lines.includes('gSliver.z =') && lines.includes('gSliver.w ='));
  assert.ok(!/gSliver[^\n]*smoothstep/.test(lines));
  // the sky is far: a neighbour on the sky counts as behind
  assert.ok(lines.includes('mix(vec4(big), vec4(n1.w, n2.w, n3.w, n4.w)'));
});

test('the constants stay sensible: lighter, never gone; a step a line would be drawn for', () => {
  assert.ok(INK_SIZE.onSliver > 0 && INK_SIZE.onSliver < 1);
  assert.ok(INK_SIZE.farSide > INK_SIZE.onSliver && INK_SIZE.farSide < 1);
  assert.ok(INK_SIZE.step[0] < INK_SIZE.step[1] && INK_SIZE.step[1] <= 0.2);
  assert.ok(INK_SIZE.minAlpha >= 0.5 && INK_SIZE.minAlpha < 1);
});

test('debug 14 shows the lines as drawn, after every fade and before they are laid on', () => {
  assert.equal(DEBUG_VIEWS['Lines as drawn (the ink-lines audit)'], 14);
  const d = shader.indexOf('if (uDebug == 14)');
  assert.ok(d > shader.indexOf('// grass: its edges drawn in a darker shade') && d < shader.indexOf('col = mix(col, inkC, ink);'));
});

test('the face from afar: strokes carry their coverage, the far eye is one warm tone, the close face as before', () => {
  const g = HEAD_INK_GLSL;
  assert.ok(g.includes('float hiStroke(float d, float w, float wMin, float aa)'));
  // no stroke is drawn a pixel wide in full ink any more
  assert.ok(!/hiLine\([^;]*max\(/.test(g), 'a hiLine with a least width');
  assert.equal((g.match(/hiStroke\(/g) ?? []).length, 8, 'the lid, crease, lower lid, nose, wing, mouth and lip, and its definition');
  const [f0, f1] = HEAD_INK_FAR.from, [e0, e1] = HEAD_INK_FAR.eye;
  assert.ok(f0 < f1 && e0 < e1 && f0 < e0, 'coverage starts before the eye turns to its tone');
  assert.ok(f0 >= 0.0028, 'a face over ~110 px is drawn as before');
  assert.ok(HEAD_INK_FAR.keep > 0 && HEAD_INK_FAR.keep < 1);
  const lum = ([r, g2, b]) => 0.3 * r + 0.59 * g2 + 0.11 * b;
  assert.ok(lum(HEAD_INK_FAR.tone) < lum(HEAD_INK.skin) * 0.7, 'darker than the skin: it still reads as an eye');
  assert.ok(lum(HEAD_INK_FAR.tone) > 0.15, 'not black');
  assert.ok(HEAD_INK_FAR.tone[0] > HEAD_INK_FAR.tone[2], 'warm');
});

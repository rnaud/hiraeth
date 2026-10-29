// Issue #575: on the Retroid (Unity, render scale 0.585-0.67) the bench's shots came out with a rectangle of the screen
// (the render scale's share of its width, from the bottom up to the horizon as the G-buffer has it) lit and the rest of
// the ground under a dark. The live screen was even. A shot draws the camera into a picture of the screen's size, and
// URP makes no smaller copy for a camera drawn into a picture (UniversalRenderer: requiresBlitForOffscreenCamera
// ignores the render scale): the G-buffer is at the render scale, the composite and the transparents at the picture's
// size. What is laid over the page after the composite reads the G-buffer's depth by hand at its own pixel (GAt), so
// the world's deadly void (PitVoid, a wash under the kill height) read the G-buffer at the picture's pixel: past the
// G-buffer's width and height nothing (the void's dark laid over the ground), inside it the scene from elsewhere.
// Now the pixel is scaled to the G-buffer's size (_GPixelScale, set by the composite from its target's size).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as shaders from './catalogs/unity-shaders-sources.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const DIR = 'unity/Hiraeth/Assets/Hiraeth/Shaders/';
const GAT = read(`${DIR}GAt.hlsl`);
const FEATURE = read('unity/Hiraeth/Assets/Hiraeth/Rendering/HiraethFeature.cs');

test('every shader reading the G-buffer at its own pixel does it through GAt.hlsl', () => {
  const users = [];
  // (the directory through its literal catalogue, checked against it: tests/test-catalogs.test.js)
  for (const f of shaders.files.filter((f) => /\.(shader|hlsl)$/.test(f) && f !== 'GAt.hlsl')) {
    const s = shaders.source(f);
    if (!/_GNormalTex|GAt\(/.test(s)) continue;
    users.push(f);
    assert.match(s, /#include "GAt\.hlsl"/, `${f}: includes GAt.hlsl`);
    assert.doesNotMatch(s, /Texture2D _GNormalTex|float4 GAt\(/, `${f}: no GAt of its own`);
    assert.doesNotMatch(s, /_GNormalTex\.Load/, `${f}: no read of its own`);
  }
  assert.deepEqual(users.sort(), ['DoorLight.shader', 'HoloFigure.shader', 'Mote.shader', 'PitVoid.shader', 'Veil.shader', 'Wisp.shader']);
  assert.ok(/\bguid: [0-9a-f]{32}\b/.test(read(`${DIR}GAt.hlsl.meta`)));
});

test('GAt scales the target\'s pixel to the G-buffer\'s, 1 while unset, and flips after scaling', () => {
  assert.match(GAT, /float4 _GPixelScale;/);
  assert.match(GAT, /_GPixelScale\.x > 0\.0 \? _GPixelScale\.xy : float2\(1\.0, 1\.0\)/);
  const body = GAT.slice(GAT.indexOf('float4 GAt('));
  assert.ok(body.indexOf('q * k') < body.indexOf('gh - 1 - p.y'), 'scaled, then the row turned in the G-buffer\'s rows');
});

test('the composite sets _GPixelScale from the G-buffer\'s size over its target\'s', () => {
  assert.match(FEATURE, /Shader\.PropertyToID\("_GPixelScale"\)/);
  assert.match(FEATURE, /SetGlobalVector\(IdGPixelScale, d\.gscale\)/);
  assert.match(FEATURE, /GetRenderTargetInfo\(res\.activeColorTexture\)/, 'the target\'s own size (a picture: not the camera\'s scaled one)');
  assert.match(FEATURE, /pass\.gscale = GPixelScale\(GW, GH, tw, th\)/);
  // the formula, as the C#: G / target, 1 for an unknown target
  const k = /GPixelScale\(int gw, int gh, int tw, int th\) =>\s*([^;]+);/.exec(FEATURE)[1];
  assert.match(k, /tw > 0 && th > 0 \? new Vector4\(\(float\)gw \/ tw, \(float\)gh \/ th, 0, 0\) : new Vector4\(1, 1, 0, 0\)/);
});

test('the Retroid\'s shot: every pixel of the picture reads inside the G-buffer once scaled, none past it before', () => {
  const G = [857, 643], T = [1280, 960];   // (the Handheld's 0.67 of a 1280 x 960 picture)
  const k = [G[0] / T[0], G[1] / T[1]];
  let outBefore = 0, outNow = 0, n = 0;
  for (let y = 0.5; y < T[1]; y += 7) for (let x = 0.5; x < T[0]; x += 7) {
    n++;
    if (Math.floor(x) >= G[0] || Math.floor(y) >= G[1]) outBefore++;
    const p = [Math.floor(x * k[0]), Math.floor(y * k[1])];
    if (p[0] >= G[0] || p[1] >= G[1] || p[0] < 0 || p[1] < 0) outNow++;
  }
  assert.ok(outBefore / n > 0.5, `before: ${(100 * outBefore / n).toFixed(0)} % of the picture read past the G-buffer`);
  assert.equal(outNow, 0);
  // on the screen (target = G-buffer) the scale is 1: the read is the pixel itself, as before
  assert.deepEqual([857 / 857, 643 / 643], [1, 1]);
});

test('scaled pixel centres cover all corners, including flipped targets and supersampled buffers', () => {
  for (const [gw, gh, tw, th] of [[857, 643, 1280, 960], [749, 421, 1280, 720], [1280, 720, 1280, 720], [1920, 1080, 1280, 720]]) {
    for (const flip of [false, true]) {
      for (const [x, y] of [[0.5, 0.5], [tw - 0.5, 0.5], [0.5, th - 0.5], [tw - 0.5, th - 0.5]]) {
        const px = Math.floor(x * gw / tw);
        const row = Math.floor(y * gh / th), py = flip ? gh - 1 - row : row;
        assert.ok(px >= 0 && px < gw && py >= 0 && py < gh);
        assert.ok(Math.abs((px + 0.5) / gw - x / tw) <= 0.5 / gw + 1e-9);
        const uy = flip ? 1 - (py + 0.5) / gh : (py + 0.5) / gh;
        assert.ok(Math.abs(uy - y / th) <= 0.5 / gh + 1e-9);
      }
    }
  }
});

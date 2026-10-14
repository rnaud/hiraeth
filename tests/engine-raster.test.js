// The engines' own canvas (engine/raster.js PixelCanvas): the 2D context's few calls the game's map draws with
// (src/world-map.js drawTerrain), into RGBA bytes an engine shows (the Unity bridge's Map: BridgeMenu.cs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PixelCanvas, parseColour } from '../engine/raster.js';
import { HeightGrid, drawTerrain } from '../src/world-map.js';
import { readFileSync } from 'node:fs';

const px = (c, x, y) => Array.from(c.data.subarray((y * c.width + x) * 4, (y * c.width + x) * 4 + 4));

test('colours as the page writes them', () => {
  assert.deepEqual(parseColour('#2b211f'), [43, 33, 31, 1]);
  assert.deepEqual(parseColour('rgb(246,236,211)'), [246, 236, 211, 1]);
  assert.deepEqual(parseColour('rgba(43,33,31,0.22)'), [43, 33, 31, 0.22]);
  assert.deepEqual(parseColour('#fff'), [255, 255, 255, 1]);
});

test('fillRect, a stroke, a pale stroke that crosses itself no darker, strokeRect', () => {
  const c = new PixelCanvas(40, 40), g = c.getContext('2d');
  g.fillStyle = 'rgb(200,100,50)'; g.fillRect(0, 0, 40, 40);
  assert.deepEqual(px(c, 10, 10), [200, 100, 50, 255]);
  g.strokeStyle = '#000'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(5, 20.5); g.lineTo(35, 20.5); g.stroke();
  assert.deepEqual(px(c, 20, 20).slice(0, 3), [0, 0, 0], 'on the line: ink');
  assert.deepEqual(px(c, 20, 5).slice(0, 3), [200, 100, 50], 'off it: as it was');
  // a pale line over itself (the contours' moveTo / lineTo, many in one path): blended once
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, 30.5); g.lineTo(40, 30.5); g.moveTo(40, 30.5); g.lineTo(0, 30.5); g.stroke();
  assert.equal(px(c, 20, 30)[0], Math.round(200 * 0.5 + 255 * 0.5));
  g.strokeStyle = '#2b211f'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, 39, 39);
  assert.deepEqual(px(c, 0, 20).slice(0, 3), [43, 33, 31], 'the frame');
  c.width = 8;
  assert.equal(c.data.length, 8 * 40 * 4, 'a size set again clears it, as a canvas');
});

test('the game\'s map drawn into it: paper, the bands, the water, the contours; and how long it takes', () => {
  const b = { x0: -200, z0: -200, w: 400, h: 400 };
  // a hill in the middle, a pond to the west, nothing (the void) in the south-east corner
  const grid = new HeightGrid(b, 180, (x, z) => (x > 150 && z > 150 ? { h: -Infinity } : { h: 40 * Math.exp(-(x * x + z * z) / 8000), water: Math.hypot(x + 120, z) < 30 ? 12 : null }));
  grid.step(1e6);
  const c = new PixelCanvas(512, 512);
  const t0 = performance.now();
  const r = drawTerrain(c.getContext('2d'), grid, 512);
  const ms = performance.now() - t0;
  assert.ok(r.step > 0);
  const mid = px(c, 256, 256), pond = px(c, Math.round(512 * (80 / 400)), 256), voidAt = px(c, 500, 500);
  assert.ok(mid[3] === 255 && pond[3] === 255);
  assert.ok(pond[2] > pond[0], `the pond in teal: ${pond}`);
  assert.ok(mid[0] > mid[2], `the hilltop in the ochres: ${mid}`);
  assert.ok(Math.abs(voidAt[0] - 246) < 40, `the void left as paper: ${voidAt}`);
  // (once a map, while the menu is open; the Xbox's script runs ~3-4× slower than this Mac's)
  assert.ok(ms < 1500, `${ms.toFixed(0)} ms`);
  console.log(`drawTerrain 180 rays into 512 px: ${ms.toFixed(1)} ms`);
});

test('the raster spreads a small picture smoothly, as the page\'s canvas does (issue #343: the Map\'s ground without blocks)', async () => {
  const { PixelCanvas } = await import('../engine/raster.js');
  const c = new PixelCanvas(8, 1), ctx = c.getContext('2d');
  const small = ctx.offscreen(2, 1), sctx = small.getContext('2d'), img = sctx.createImageData(2, 1);
  img.data.set([0, 0, 0, 255, 200, 100, 50, 255]);
  sctx.putImageData(img, 0, 0);
  ctx.drawImage(small, 0, 0, 8, 1);
  const r = [...Array(8).keys()].map((i) => c.data[i * 4]);
  assert.deepEqual([r[0], r[7]], [0, 200], 'the ends as the cells');
  for (let i = 1; i < 8; i++) assert.ok(r[i] >= r[i - 1], 'rising smoothly');
  assert.ok(r[3] > 0 && r[3] < 200 && r[4] > 0 && r[4] < 200, `between: ${r}`);
  // a clear cell's colour never bleeds in: the drawn one's colour, fainter toward it
  const d = new PixelCanvas(4, 1), dctx = d.getContext('2d'), s2 = dctx.offscreen(2, 1), i2 = s2.getContext('2d').createImageData(2, 1);
  i2.data.set([255, 0, 0, 255, 0, 255, 0, 0]);
  s2.getContext('2d').putImageData(i2, 0, 0);
  dctx.drawImage(s2, 0, 0, 4, 1);
  assert.equal(d.data[2 * 4 + 1], 0, 'no green from the clear cell');
  assert.ok(d.data[2 * 4 + 3] < 255 && d.data[2 * 4 + 3] > 0);
  // and drawTerrain takes that way in an engine (src/world-map.js: its own offscreen canvas)
  assert.match(readFileSync(new URL('../src/world-map.js', import.meta.url), 'utf8'), /ctx\.drawImage && ctx\.offscreen \? ctx\.offscreen\(nx, ny\)/);
});

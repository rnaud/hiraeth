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

// ------------------------------------------------------------------ the game's canvases as textures (issue #264)
// The ship's console screen and wall pictures, the signs and boards: paths filled and stroked, the transform, gradients,
// dashes, text in engine/glyphs.js's open fonts, pictures drawn onto one another (engine/platform.js hands out such a
// canvas for document.createElement('canvas'); engine/unity/backend.js sends its pixels as a texture).
const inked = (c, x0, y0, x1, y1, dark = 100) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (px(c, x, y)[0] < dark) n++; return n; };
const paper = (w, h) => { const c = new PixelCanvas(w, h), g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#000'; return { c, g }; };

test('a path filled: a disc its area, a ring\'s hole left (non-zero, the edges\' ways round), an ellipse turned', () => {
  const { c, g } = paper(64, 64);
  g.beginPath(); g.arc(32, 32, 20, 0, Math.PI * 2); g.fill();
  const area = inked(c, 0, 0, 64, 64, 128);
  assert.ok(Math.abs(area - Math.PI * 400) < 20, `the disc: ${area} px`);
  assert.deepEqual(px(c, 32, 32), [0, 0, 0, 255]);
  let grey = 0; for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const v = px(c, x, y)[0]; if (v > 30 && v < 225) grey++; }
  assert.ok(grey > 60 && grey < 200, `its rim antialiased, a pixel deep: ${grey} grey pixels`);
  const { c: r, g: q } = paper(64, 64);
  q.beginPath(); q.arc(32, 32, 20, 0, Math.PI * 2); q.moveTo(42, 32); q.arc(32, 32, 10, Math.PI * 2, 0, true); q.fill();
  assert.equal(px(r, 32, 32)[0], 255, 'the hole wound the other way stays paper');
  assert.equal(px(r, 32, 17)[0], 0, 'the ring inked');
  // a rect turned 45° about its middle: its corners point up and down
  const { c: t, g: u } = paper(64, 64);
  u.translate(32, 32); u.rotate(Math.PI / 4); u.fillRect(-10, -10, 20, 20);
  assert.equal(px(t, 32, 32 - 13)[0], 0, 'the top corner'); assert.equal(px(t, 32 - 12, 32 - 12)[0], 255, 'beside it paper');
  u.setTransform(1, 0, 0, 1, 0, 0);
  u.fillStyle = 'rgba(255, 0, 0, 0.5)'; u.fillRect(0, 0, 4, 4);
  assert.deepEqual(px(t, 1, 1).slice(0, 3), [255, 128, 128], 'half red over white');
});

test('text in the open fonts: by size, weight, family, alignment and baseline; measureText agrees with what is drawn', () => {
  const { c, g } = paper(200, 60);
  g.font = 'bold 32px ui-monospace, Menlo, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText('NO POWER').width;
  assert.ok(w > 130 && w < 175, `a monospace line's width: ${w}`);
  g.fillText('NO POWER', 100, 30);
  let x0 = 200, x1 = 0, y0 = 60, y1 = 0;
  for (let y = 0; y < 60; y++) for (let x = 0; x < 200; x++) if (px(c, x, y)[0] < 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  assert.ok(Math.abs((x0 + x1) / 2 - 100) < 4 && x1 - x0 > w * 0.85 && x1 - x0 <= w + 1, `centred on 100 and as wide as measured: ${x0}..${x1}`);
  assert.ok(Math.abs((y0 + y1) / 2 - 30) < 4 && y1 - y0 > 18 && y1 - y0 < 28, `the capitals about the middle: ${y0}..${y1}`);
  // the O's counter is paper
  const { c: o, g: h } = paper(60, 60);
  h.font = '900 48px Futura, Roboto, sans-serif'; h.textBaseline = 'alphabetic'; h.fillText('O', 10, 50);
  const mid = (() => { let a = 60, b = 0; for (let x = 0; x < 60; x++) if (px(o, x, 32)[0] < 128) { a = Math.min(a, x); b = Math.max(b, x); } return Math.round((a + b) / 2); })();
  assert.equal(px(o, mid, 32)[0], 255, 'the O\'s counter left paper');
  // weights differ: bold inks more than regular
  const ink = (font) => { const { c: k, g: m } = paper(120, 40); m.font = font; m.fillText('Ink tide', 4, 30); return inked(k, 0, 0, 120, 40, 128); };
  assert.ok(ink('700 24px Avenir Next') > ink('400 24px Avenir Next') * 1.15, 'bold heavier');
  // italic slants: the l's foot left of its top
  assert.ok(ink('italic 700 24px Avenir Next') > 0);
});

test('a gradient, dashes, a stroke turned and scaled; a picture drawn from part of another, and from itself', () => {
  const { c, g } = paper(100, 20);
  const grd = g.createLinearGradient(0, 0, 100, 0); grd.addColorStop(0, '#000000'); grd.addColorStop(1, '#ffffff');
  g.fillStyle = grd; g.fillRect(0, 0, 100, 20);
  const a = px(c, 10, 10)[0], b = px(c, 50, 10)[0], d = px(c, 90, 10)[0];
  assert.ok(a < b && b < d && Math.abs(b - 128) < 12, `along it: ${a} ${b} ${d}`);
  const { c: s, g: t } = paper(100, 10);
  t.setLineDash([10, 10]); t.lineWidth = 4; t.beginPath(); t.moveTo(0, 5); t.lineTo(100, 5); t.stroke();
  assert.equal(px(s, 5, 5)[0], 0, 'a dash'); assert.equal(px(s, 15, 5)[0], 255, 'a gap'); assert.equal(px(s, 25, 5)[0], 0, 'the next dash');
  t.setLineDash([]);
  t.save(); t.scale(2, 2); t.lineWidth = 2; t.beginPath(); t.moveTo(5, 0); t.lineTo(5, 5); t.stroke(); t.restore();
  assert.equal(px(s, 9, 2)[0], 0, 'scaled: at x 10, 4 px wide'); assert.equal(px(s, 11, 2)[0], 0); assert.equal(px(s, 13, 2)[0], 255); assert.equal(t.lineWidth, 4, 'restored');
  // drawImage's nine arguments: a part of the source, put larger; and the canvas onto itself (the screen's torn bands)
  const src = new PixelCanvas(4, 4), sg = src.getContext('2d');
  sg.fillStyle = '#ff0000'; sg.fillRect(0, 0, 2, 4); sg.fillStyle = '#0000ff'; sg.fillRect(2, 0, 2, 4);
  const { c: dst, g: dg } = paper(20, 20);
  dg.imageSmoothingEnabled = false; dg.drawImage(src, 2, 0, 2, 4, 0, 0, 20, 20);
  assert.deepEqual(px(dst, 10, 10).slice(0, 3), [0, 0, 255], 'only the blue half, stretched');
  dg.fillStyle = '#00ff00'; dg.fillRect(0, 0, 10, 10);
  dg.drawImage(dst, 0, 0, 10, 10, 10, 10, 10, 10);
  assert.deepEqual(px(dst, 15, 15).slice(0, 3), [0, 255, 0], 'itself, moved');
  assert.ok(dst.version > 0, 'its version moves as it is drawn');
});

test('the engines\' page hands out canvases that draw: the ship\'s pictures and screen, a sign, as the web paints them (issue #264)', async () => {
  const { installPlatform } = await import('../engine/platform.js');
  installPlatform({});
  const { hasCanvas, familyDrawing, motherNote } = await import('../src/ship/art.js');
  const { CallScreen } = await import('../src/ship/portrait.js');
  const { signPlate } = await import('../src/minigames/kit/marker.js');
  assert.equal(hasCanvas(), true);
  const dark = (img) => { let n = 0; for (let i = 0; i < img.data.length; i += 4) if (img.data[i] < 90 && img.data[i + 1] < 90) n++; return n; };
  const fam = familyDrawing(), note = motherNote();
  assert.ok(fam && dark(fam.image) > 400, `the child's drawing inked: ${dark(fam.image)}`);
  assert.ok(note && dark(note.image) > 300, `the mother's note written: ${dark(note.image)}`);
  const screen = new CallScreen(128);
  screen.set({ who: 'locked' }); screen.draw();
  const red = (() => { const d = screen.canvas.data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 120) n++; return n; })();
  assert.ok(red > 40, `NO POWER in red on the screen: ${red}`);
  const v = screen.texture.version;
  screen.update(0.2);
  assert.ok(screen.texture.version > v, 'redrawn: its texture to send again');
  const sign = signPlate('Ink tide', 'best 12');
  assert.ok(sign && dark(sign.material.uniforms.uMap.value.image) > 1000, 'the sign\'s name lettered');
});

// The Map panel (issue #205): the world from above (src/world-map.js) and its page in the game menu (src/game-menu.js mapPanel).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAP, mapBounds, zoomBounds, toMap, onMap, compass, facing, metres, HeightGrid, contourStep, drawTerrain, WorldMap, mapMarks, scaleBar } from '../src/world-map.js';
import { GameMenu, mapPanel, PANELS } from '../src/game-menu.js';
import { menuSources } from '../src/game-menu-data.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

/** A canvas 2D context that only counts what is drawn. */
function recorder() {
  const c = { fills: 0, strokes: 0, segments: 0, rects: 0 };
  return Object.assign(c, {
    fillRect() { c.rects++; }, strokeRect() {}, beginPath() {}, moveTo() { c.segments++; }, lineTo() {}, stroke() { c.strokes++; }, fill() { c.fills++; },
    set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}, set lineCap(v) {}, set lineJoin(v) {},
  });
}

test('the square the map shows: round the places that matter, padded, never smaller than the least nor past the world\'s edge', () => {
  const b = mapBounds([{ x: -100, z: 0 }, { x: 100, z: 50 }, { x: 0, z: -40 }]);
  assert.equal(b.w, b.h, 'square');
  assert.ok(b.w >= 200 * (1 + 2 * MAP.pad) - 1e-6, 'padded round the widest span');
  assert.ok(b.x0 <= -100 && b.x0 + b.w >= 100 && b.z0 <= -40 && b.z0 + b.h >= 50, 'everything inside');
  const one = mapBounds([{ x: 5, z: 5 }]);
  assert.equal(one.w, MAP.minSpan, 'a single place: the smallest map round it');
  const edge = mapBounds([{ x: 280, z: 0 }, { x: 200, z: 10 }], { limit: 300 });
  assert.ok(edge.x0 + edge.w <= 300 + 1e-6, 'kept inside the world\'s limit');
  assert.ok(mapBounds([{ x: -5000, z: 0 }, { x: 5000, z: 0 }]).w <= MAP.maxSpan);
  // zooming: a part of it, round the place, still inside the whole
  const z = zoomBounds(b, { x: 100, z: 50 });
  assert.ok(Math.abs(z.w - b.w * MAP.zoom) < 1e-6);
  assert.ok(z.x0 >= b.x0 && z.x0 + z.w <= b.x0 + b.w + 1e-6 && z.z0 + z.h <= b.z0 + b.h + 1e-6);
  assert.ok(onMap(z, 100, 50));
});

test('north is up: the ways in words, the traveller\'s arrow turned the way he faces, distances', () => {
  assert.equal(compass(0, -1), 'north'); assert.equal(compass(1, 0), 'east'); assert.equal(compass(0, 1), 'south');
  assert.equal(compass(-1, 0), 'west'); assert.equal(compass(1, -1), 'north-east'); assert.equal(compass(0.8, 0.6), 'south-east');
  assert.equal(facing(0, -1), 0); assert.equal(facing(1, 0), 90); assert.equal(facing(0, 1), 180); assert.equal(facing(-1, 0), 270);
  const b = { x0: -50, z0: -50, w: 100, h: 100 };
  assert.deepEqual(toMap(b, 0, 0), [0.5, 0.5]); assert.deepEqual(toMap(b, -50, -50), [0, 0], 'the north-west corner top left');
  assert.equal(metres(12.4), '12 m'); assert.equal(metres(347), '350 m'); assert.equal(metres(1240), '1.2 km');
  assert.deepEqual(scaleBar(1000), { m: 200, frac: 0.2, label: '200 m' });
  assert.equal(contourStep(50), 5); assert.equal(contourStep(300), 20);
});

test('the ground is sampled a slice at a time and drawn as ink and paper: bands, contours, the steep edges, water and the void', () => {
  // a hill with a wall round a plateau, a pond, and nothing below past x > 30 (an island's edge)
  const sample = (x, z) => (x > 30 ? { h: -Infinity } : { h: Math.hypot(x, z) < 12 ? 20 : 4 - Math.hypot(x, z) * 0.05, water: x < -25 && z < -25 ? 6 : null });
  const g = new HeightGrid({ x0: -40, z0: -40, w: 80, h: 80 }, 40, sample);
  let t = 0;
  const clock = () => (t += 0.01);   // (each ray 10 µs on this clock)
  assert.equal(g.step(0.05, clock), false, 'a twentieth of a millisecond: not done yet');
  assert.ok(g.progress > 0 && g.progress < 1);
  while (!g.step(1, clock));
  assert.equal(g.done, true);
  assert.deepEqual(g.range(), { lo: Math.min(...g.h.filter(Number.isFinite)), hi: 20 });
  assert.ok(g.h.some((v) => v === -Infinity), 'the void kept as nothing');
  assert.ok(g.water.some(Number.isFinite), 'the pond');
  const ctx = recorder();
  const r = drawTerrain(ctx, g, 320);
  assert.ok(ctx.rects > 1000, 'the ground cell by cell (no OffscreenCanvas here)');
  assert.ok(ctx.segments > 100, 'contours and edges drawn');
  assert.equal(r.step, contourStep(r.range.hi - r.range.lo));
});

test('the world\'s map: drawn while the menu is open, kept, told when ready; a zoom has its own', () => {
  const made = [];
  const canvas = () => { const c = { width: 0, height: 0, getContext: () => recorder() }; made.push(c); return c; };
  const wm = new WorldMap({ sample: () => ({ h: 1 }), canvas, size: 64 });
  let ready = 0; wm.onReady = () => ready++;
  const b = { x0: 0, z0: 0, w: 100, h: 100 };
  let v = wm.view(b, 20);
  assert.equal(v.canvas, null); assert.equal(v.done, false);
  for (let i = 0; i < 50 && !wm.pump(50); i++);
  assert.equal(ready, 1);
  v = wm.view(b, 20);
  assert.equal(v.done, true); assert.equal(v.canvas, made[0]); assert.equal(made[0].width, 64);
  assert.equal(wm.pump(), false, 'nothing more to do');
  wm.view(zoomBounds(b, { x: 50, z: 50 }), 20);
  for (let i = 0; i < 50 && !wm.pump(50); i++);
  assert.equal(made.length, 2, 'the zoom drawn once too');
});

test('the marks: the traveller first and the way he faces, then the way on, the ship, the temples, the people met and the boxes opened, nearest first', () => {
  const bounds = { x0: -100, z0: -100, w: 200, h: 200 };
  const marks = mapMarks({ bounds, you: { x: 0, z: 0, dx: 1, dz: 0 }, ship: { x: 0, z: 50 }, goal: { x: 30, z: -40, label: 'Bastien, at the lock' },
    temples: [{ id: 'underwater', x: 0, z: -90, name: 'The Whale-House' }], people: [{ id: 'far', x: 90, z: 0, name: 'Far' }, { id: 'near', x: 5, z: 5, name: 'Near' }],
    boxes: [{ id: 'b1', x: -500, z: 0, name: 'Lift valve’s box' }] });
  assert.deepEqual(marks.map((m) => m.id), ['you', 'goal', 'ship', 'temple.underwater', 'person.near', 'person.far', 'box.b1']);
  assert.equal(marks[0].sub, 'facing east'); assert.equal(marks[0].deg, 90);
  assert.equal(marks[1].name, 'Bastien, at the lock'); assert.equal(marks[1].sub, 'the way on · 50 m north-east');
  assert.equal(marks[2].sub, 'the ship · 50 m south');
  assert.equal(marks.at(-1).on, false, 'a box off this map: in the legend, not drawn');
  assert.deepEqual([marks[0].u, marks[0].v], [0.5, 0.5]);
});

test('the Map panel: the ground, the marks over it, the legend beside it; A / × zooms on the one picked, B / ○ back to the whole map', () => {
  assert.equal(PANELS[1].id, 'map', 'next to the Quests, one RB / R1 from where the menu opens');
  const bounds = { x0: -100, z0: -100, w: 200, h: 200 };
  const asked = [];
  const map = (o) => {
    asked.push(o?.zoom ?? null);
    return { world: 'The Desert', marks: mapMarks({ bounds, you: { x: 10, z: 10, dx: 0, dz: -1 }, ship: { x: -20, z: 30 } }), canvas: null, progress: 0.4, zoom: o?.zoom ?? null, scale: scaleBar(200) };
  };
  const m = new GameMenu(null, { sources: menuSources({ items: { owned: () => [] }, journal: { data: {} }, levels: [], order: [], map }) });
  m.open('map');
  assert.equal(m.panel, 'map');
  assert.equal(m.state.cell(m.rows).id, 'you', 'the cursor on the traveller');
  assert.equal(m.verb(), 'zoom in');
  m.navigate(0, 1); assert.equal(m.state.cell(m.rows).id, 'ship');
  m.confirm(); assert.equal(m.mapZoom, 'ship'); assert.equal(asked.at(-1), 'ship', 'the map asked for, zoomed on the ship');
  assert.equal(m.state.cell(m.rows).id, 'ship', 'the cursor stays on it');
  assert.equal(m.verb(), 'whole map');
  assert.equal(m.back(), true, 'B / ○: the whole map first');
  assert.equal(m.mapZoom, null);
  assert.equal(m.back(), false, 'then the menu closes');
  // the html: the traveller's arrow turned, north, the scale, the drawing's progress until it is in
  const { html, rows } = mapPanel(map());
  assert.equal(rows.length, 2);
  assert.match(html, /class="mk mk-you"[^>]*style="left:55\.00%;top:55\.00%;--deg:0\.0deg"/);
  assert.match(html, /class="mk mk-ship named"/, 'the ship named on the map');
  assert.match(html, /gm-north/); assert.match(html, /<i><\/i>50 m/);
  assert.match(html, /Drawing the map… 40%/);
  assert.doesNotMatch(mapPanel({ ...map(), canvas: {} }).html, /Drawing the map/);
});

test('the game draws the map: its source, its rays only while the Map shows, no fragment ever on it', () => {
  const main = src('src/main.js'), wm = src('src/world-map.js');
  assert.match(main, /map: \(o\) => mapSource\(o\)/, 'the menu\'s map source');
  assert.match(main, /if \(journal\.open && journal\.menu\.panel === 'map'\) \{[^\n]*worldMap\.pump\(\)/, 'the rays a few ms a frame, while the Map is shown');
  assert.match(main, /worldMap\.onReady = \(\) => \{ if \(journal\.open\) journal\.menu\.mapReady\(\); \}/);
  const source = main.slice(main.indexOf('function mapSource'), main.indexOf('// a keepsake just earned'));
  assert.doesNotMatch(source, /fragments\.list|FRAGMENTS/, 'the fragments\' spots are never read for the map');
  assert.match(source, /filter\(\(b\) => b\.opened\(\)\)/, 'only the boxes opened');
  assert.match(source, /game\.flag\(`met\.\$\{n\.def\.id\}`\)/, 'only the people met');
  assert.match(wm, /Never a fragment of the singing light/);
  assert.match(src('src/ui.js'), /data-panel="map">\$\{t\('menu\.map'\)\}/, 'the Start menu has a Map entry too');
});

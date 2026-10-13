// The Map panel (issue #205): the world from above (src/world-map.js) and its page in the game menu (src/game-menu.js mapPanel).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAP, VIEW, MapView, mapBounds, zoomBounds, toMap, onMap, compass, facing, metres, HeightGrid, contourStep, drawTerrain, WorldMap, mapMarks, scaleBar } from '../src/world-map.js';
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

test('the other quests under way have their marks too, after the way on; one at the way on\'s place is the way on', () => {
  const bounds = { x0: -100, z0: -100, w: 200, h: 200 };
  const marks = mapMarks({ bounds, you: { x: 0, z: 0 }, goal: { x: 30, z: -40, label: 'The skull' },
    quests: [{ id: 'desert.drum', x: -50, z: 20, title: 'The Drum', label: 'Teo’s drum, in the camp' }, { id: 'same', x: 30.5, z: -40, title: 'Same place' }], ship: { x: 0, z: 50 } });
  assert.deepEqual(marks.map((m) => m.id), ['you', 'goal', 'quest.desert.drum', 'ship']);
  assert.equal(marks[2].kind, 'quest'); assert.equal(marks[2].name, 'The Drum');
  assert.match(marks[2].sub, /^Teo’s drum, in the camp · \d+ m west$/, 'its step and how far, one line');
});

test('the Map\'s view (issue #244): the stick moves a cursor, the view zooms round it and pans to keep it in sight, inside the map', () => {
  const V = new MapView().reset([0.5, 0.5]);
  assert.equal(V.z, 1); assert.equal(V.zoomed, false);
  // the whole map: the cursor goes anywhere on it, the view doesn't move
  V.stick(1, 0, 0.5);
  assert.ok(Math.abs(V.u - (0.5 + VIEW.pan * 0.5)) < 1e-9); assert.equal(V.u0, 0);
  V.stick(1, 0, 5); assert.equal(V.u, 1, 'never off the map');
  // zoom in round the cursor: it stays where it is on the sheet
  const W = new MapView().reset([0.3, 0.6]);
  const before = W.toSheet(W.u, W.v);
  W.zoomBy(3);
  assert.ok(Math.abs(W.z - 3) < 1e-9 && W.zoomed);
  const after = W.toSheet(W.u, W.v);
  assert.ok(Math.abs(before[0] - after[0]) < 1e-9 && Math.abs(before[1] - after[1]) < 1e-9, 'the cursor holds its place');
  // pushed to the view's edge, the view pans after it; never past the map's edge
  for (let i = 0; i < 60; i++) W.stick(1, 0, 0.1);
  assert.ok(W.u0 > 0.1, 'the view followed');
  assert.ok(W.u0 <= 1 - W.span + 1e-9);
  const [sx] = W.toSheet(W.u, W.v); assert.ok(sx >= 0 && sx <= 1, 'the cursor in sight');
  // the zoom's bounds
  W.zoomBy(100); assert.equal(W.z, VIEW.maxZoom); W.zoomBy(0.0001); assert.equal(W.z, 1);
  // the sheet and the map, both ways; a point of the sheet (the mouse) puts the cursor there
  const Z = new MapView().reset([0.5, 0.5]).zoomBy(2);
  const [u, v] = Z.fromSheet(0.25, 0.75); assert.deepEqual(Z.toSheet(u, v).map((x) => +x.toFixed(9)), [0.25, 0.75]);
  const z0 = [Z.u0, Z.v0];
  Z.point(0.9, 0.1); assert.deepEqual(Z.toSheet(Z.u, Z.v).map((x) => +x.toFixed(6)), [0.9, 0.1]);
  assert.deepEqual([Z.u0, Z.v0], z0, 'the mouse never pans the map (it would slide away under it)');
  // a finger's drag moves the map under it
  const u0 = Z.u0; Z.drag(-0.1, 0); assert.ok(Z.u0 > u0);
  // a sharper part asked for only from twice as close, round the view, the same one for a small pan
  assert.equal(new MapView().detailWindow(), null);
  const D = new MapView().reset([0.5, 0.5]).zoomBy(4), d1 = D.detailWindow();
  assert.ok(d1.s >= D.span && d1.u0 <= D.u0 && d1.u0 + d1.s >= D.u0 + D.span - 1e-9, 'the view inside it');
  D.stick(0.05, 0, 0.1); assert.deepEqual(D.detailWindow(), d1, 'a small pan: the same part');
  // the scale bar follows the zoom
  assert.ok(D.scale(800).m < new MapView().scale(800).m);
});

test('the mark under the cursor: the nearest within reach of it, the traveller only when nothing else is', () => {
  const V = new MapView().reset([0.5, 0.5]);
  const marks = [{ id: 'you', kind: 'you', u: 0.5, v: 0.5, on: true }, { id: 'ship', kind: 'ship', u: 0.52, v: 0.5, on: true }, { id: 'far', kind: 'person', u: 0.9, v: 0.9, on: true }, { id: 'off', kind: 'box', u: 0.5, v: 0.5, on: false }];
  assert.equal(V.pick(marks).id, 'you', 'right on him');
  V.point(0.53, 0.5); assert.equal(V.pick(marks).id, 'ship');
  V.point(0.7, 0.7); assert.equal(V.pick(marks), null, 'nothing near');
  // zoomed in, the reach is smaller in the map's units
  const Z = new MapView().reset([0.55, 0.5]).zoomBy(5);
  assert.equal(Z.pick([{ id: 'a', kind: 'ship', u: 0.5, v: 0.5, on: true }]), null);
});

test('the Map panel: no list, the cursor named beside it; the stick moves it, the triggers and A / × zoom, B / ○ the whole map first', () => {
  assert.equal(PANELS[1].id, 'map', 'next to the Quests, one RB / R1 from where the menu opens');
  const bounds = { x0: -100, z0: -100, w: 200, h: 200 };
  const asked = [];
  const map = (o) => {
    asked.push(o ?? null);
    return { world: 'The Desert', marks: mapMarks({ bounds, you: { x: 10, z: 10, dx: 0, dz: -1 }, ship: { x: -20, z: 30 } }), canvas: null, progress: 0.4, zoom: null, scale: scaleBar(200), span: 200 };
  };
  const m = new GameMenu(null, { sources: menuSources({ items: { owned: () => [] }, journal: { data: {} }, levels: [], order: [], map }) });
  m.open('map');
  assert.equal(m.panel, 'map');
  assert.deepEqual([m.mapView.u, m.mapView.v].map((x) => +x.toFixed(3)), [0.55, 0.55], 'the cursor on the traveller');
  assert.equal(m.verb(), 'zoom in');
  // the stick: the cursor moves, the panel doesn't turn; it is taken (the controller leaves its steps to the D-pad)
  assert.equal(m.mapAnalog({ x: -1, y: 1 }, 0.25), true);
  assert.ok(m.mapView.u < 0.55 && m.mapView.v > 0.55);
  assert.equal(m.panel, 'map');
  // the D-pad steps it; off the map's side it stays on the map (the shoulders turn the panels)
  for (let i = 0; i < 40; i++) m.navigate(-1, 0);
  assert.equal(m.panel, 'map'); assert.equal(m.mapView.u, 0);
  // the triggers zoom round it (RT in, LT out), A / × twice as close
  m.mapAnalog({ rt: 1 }, 0.5); assert.ok(m.mapView.z > 1.5);
  m.mapAnalog({ lt: 1 }, 2); assert.equal(m.mapView.z, 1);
  m.confirm(); assert.equal(m.mapView.z, 2);
  m.render(); assert.ok(asked.at(-1)?.detail, 'zoomed in twice: a sharper part asked for (a moment after, on the page)');
  assert.equal(m.back(), true, 'B / ○: the whole map first');
  assert.equal(m.mapView.z, 1);
  assert.equal(m.back(), false, 'then the menu closes');
  // at the closest, A / × is the whole map again
  m.mapView.zoomBy(100); assert.equal(m.verb(), 'whole map'); m.confirm(); assert.equal(m.mapView.z, 1);
  // a page that isn't the Map leaves the stick to the controller
  m.show('quests'); assert.equal(m.mapAnalog({ x: 1 }, 0.1), false);
  // the html: the traveller's arrow turned, north, the scale, the drawing's progress, the cursor, its label, the zoom's
  // buttons; no list, no name written on the map but the one under the cursor
  const { html, rows } = mapPanel(map());
  assert.equal(rows.length, 2, 'a mark a row still (the strip, an engine\'s own menus)');
  assert.match(html, /class="mk mk-you"[^>]*style="left:55\.00%;top:55\.00%;--deg:0\.0deg"/);
  assert.doesNotMatch(html, /gm-legend|mline/, 'no list');
  assert.doesNotMatch(html, /class="mk[^"]*named/, 'no names on the map at rest');
  assert.match(html, /gm-cursor/); assert.match(html, /gm-maptip/); assert.match(html, /data-map-zoom="1"/); assert.match(html, /data-map-zoom="-1"/);
  assert.match(html, /gm-north/); assert.match(html, /<i><\/i><span>50 m<\/span>/);
  assert.match(html, /Drawing the map… 40%/);
  assert.doesNotMatch(mapPanel({ ...map(), canvas: {} }).html, /Drawing the map/);
  assert.match(mapPanel({ ...map(), detail: { canvas: {}, u0: 0.25, v0: 0.5, s: 0.25 } }).html, /gm-mapdetail" style="left:25\.000%;top:50\.000%;width:25\.000%/);
});

test('the pad reads the Map\'s stick and triggers each frame in a menu; the keys zoom with − and +, the mouse with its wheel', () => {
  const ctl = src('src/controller.js'), gm = src('src/game-menu.js'), main = src('src/main.js');
  assert.match(ctl, /const analog = ctx === 'menu' && !!this\.menuAnalog\?\.\(\{ x: left\.x, y: left\.y, lt: values\[LT\] \?\? 0, rt: values\[RT\] \?\? 0 \}, dt\)/);
  assert.match(ctl, /!analog && Math\.abs\(left\.x\) > 0\.5/, 'the stick\'s steps left to the Map');
  assert.match(main, /menuAnalog: \(a, dt\) => menuRoot\(\) === journal\.el && journal\.menu\.panel === 'map' && journal\.menu\.mapAnalog\(a, dt\)/);
  assert.match(gm, /\['Minus', 'NumpadSubtract', 'Equal', 'NumpadAdd'\]/);
  assert.match(gm, /addEventListener\('wheel'/);
  assert.match(main, /quests: \(storyRt\.quests\.objectives\?\.\(\) \?\? \[\]\)/, 'the quests\' marks from the quests under way');
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

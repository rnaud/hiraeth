// The level design audit's pure logic (scripts/level-design/lib.mjs, .claude/skills/level-design-qc):
// each function shown the case it is for, on small made-up worlds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupe, spacing, samplePath, pathLength, interestGaps, returnLegs, remote, gravity, landmarksFrom, visibleCount, legGuidance, vertical, pacing, scoreWorld, viaPortals, portalRoute, encodePNG, mapPng, RUN, TRAVEL, lonelyFor, lineFor, followLines } from '../scripts/level-design/lib.mjs';

const P = (name, x, z, o = {}) => ({ name, kind: o.kind ?? 'person', pos: [x, o.y ?? 0, z], ...o });
const S = (label, x, z, kind = 'go', y = 0) => ({ label, kind, pos: [x, y, z] });

test('places closer than the radius merge, keeping their kinds', () => {
  const d = dedupe([P('Ama', 0, 0), P('the jar', 3, 0, { kind: 'goal', main: true }), P('far', 50, 0)], 6);
  assert.equal(d.length, 2);
  assert.deepEqual(d[0].kinds.sort(), ['goal', 'person']);
  assert.equal(d[0].main, true);
});

test('spacing finds the loner', () => {
  const s = spacing([P('a', 0, 0), P('b', 20, 0), P('c', 40, 0), P('hermit', 400, 0)]);
  assert.equal(s.median, 20);
  assert.deepEqual(s.loners.map((l) => l.name), ['hermit']);
});

test('the path is sampled leg by leg; an empty stretch shows as a gap with its running time', () => {
  const stops = [S('ship', 0, 0, 'ship'), S('far', 500, 0)];
  const samples = samplePath(stops, 10);
  assert.equal(samples.length, 51);
  assert.equal(pathLength(stops), 500);
  const g = interestGaps(samples, [P('ship', 0, 0), P('far', 500, 0), P('halfway', 250, 0)], 40);
  assert.equal(g.gaps.length, 2);
  assert.ok(g.longest.metres >= 140 && g.longest.metres <= 180, `${g.longest.metres}`);   // (40 m to 210 m out, between samples)
  assert.equal(g.longest.seconds, +(g.longest.metres / RUN).toFixed(1));
  assert.ok(g.emptyShare > 0.5, `${g.emptyShare}`);
});

test('the walk back: a long leg to where you were, with nothing new on it, is empty; a loop past new things is not', () => {
  const out = [S('ship', 0, 0, 'ship'), S('tower', 0, 400), S('back to the ship', 0, 0, 'ship')];
  const pois = [P('ship', 0, 0), P('tower', 0, 400), P('on the way', 5, 200)];
  const r = returnLegs(out, pois);
  assert.equal(r.length, 1);
  assert.equal(r[0].empty, true, 'the way back passes only what you passed going');
  const loop = [S('ship', 0, 0, 'ship'), S('tower', 0, 400), S('back to the ship', 0, 0, 'ship')];
  const r2 = returnLegs([loop[0], loop[1], S('ruin', 300, 300), loop[2]], [...pois, P('ruin', 300, 300), P('lake', 160, 160)]);
  assert.ok(r2.every((x) => !x.empty), JSON.stringify(r2));
});

test('a portal hop: the leg goes through it when that is much shorter, and the hop is not walked', () => {
  const portals = [{ at: [0, 0, 10], to: [3000, 0, 0], label: 'ring' }, { at: [3000, 0, 20], to: [2000, 900, 2000], label: 'upside' }];
  assert.equal(portalRoute([0, 0, 0], [2000, 900, 2010], portals).via.length, 2, 'two portals in a row');
  const p = viaPortals([S('ship', 0, 0, 'ship'), S('in the ring', 3000, 30)], portals);
  assert.deepEqual(p.map((s) => s.kind), ['ship', 'portal', 'portal', 'go']);
  assert.ok(pathLength(p) < 50, `${pathLength(p)}`);
  assert.ok(samplePath(p, 10).every((s) => s.pos[0] < 20 || s.pos[0] > 2990), 'nothing sampled in the void between');
});

test('a leg draped over a basin: the points laid on the ground under the straight line, its length the straight one', () => {
  const stops = [S('a', 0, 0, 'go', 40), S('b', 400, 0, 'go', 40)];
  const basin = (pos) => [pos[0], Math.min(pos[1], 40 - 30 * Math.sin(Math.PI * pos[0] / 400)), pos[2]];
  const straight = samplePath(stops, 10), draped = samplePath(stops, 10, basin);
  assert.equal(draped.length, straight.length);
  assert.equal(draped.at(-1).at, straight.at(-1).at);
  assert.ok(Math.abs(draped[20].pos[1] - 10) < 0.1, 'down in the basin halfway');
  // something at the basin's bottom is on the draped path, not on the straight one
  const pois = [P('wreck', 200, 0, { y: 10, optional: true })];
  assert.equal(interestGaps(straight, pois, 15).gaps.length > 0, true);
  assert.equal(interestGaps(draped, pois, 15).longest.metres < interestGaps(straight, pois, 15).longest.metres, true);
});

test('optional places: remote dead ends, and their pull from the path', () => {
  const samples = samplePath([S('a', 0, 0), S('b', 200, 0)], 10);
  const pois = [P('on', 100, 10, { optional: true }), P('tempting', 100, 90, { optional: true }), P('nowhere', 100, 600, { optional: true }), P('main', 200, 0)];
  assert.deepEqual(remote(pois, samples).map((r) => r.name), ['nowhere']);
  const g = gravity(pois, samples);
  assert.deepEqual([g.on, g.pulling, g.remote], [1, 1, 1]);
});

test('landmarks: a tower on a plain is one, a gentle slope is none', () => {
  const nx = 40, nz = 40, top = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) top[j * nx + i] = i * 0.2;   // a slope: 8 m over 40 cells
  for (const [i, j] of [[20, 20], [21, 20], [20, 21], [21, 21]]) top[j * nx + i] = 60;
  const L = landmarksFrom({ x0: 0, z0: 0, cell: 5, nx, nz, top }, { min: 25, win: 6 });
  assert.equal(L.length, 1);
  assert.ok(Math.abs(L[0].pos[0] - 102.5) <= 5 && L[0].height > 50, JSON.stringify(L[0]));
});

test('sight: a wall hides a landmark, a leg whose goal is hidden but has a landmark by it is still guided', () => {
  const wallAtX50 = (a, b) => !(Math.min(a[0], b[0]) < 50 && Math.max(a[0], b[0]) > 50 && Math.max(a[1], b[1]) < 30);
  const marks = [{ pos: [100, 80, 0], height: 80 }, { pos: [100, 10, 100], height: 25 }];
  assert.deepEqual(visibleCount([[0, 0, 0]], marks, wallAtX50), [1], 'the tall one shows over the wall');
  const g = legGuidance([S('a', 0, 0), S('tower foot', 100, 20), S('hut', 100, 100)], marks, wallAtX50);
  assert.equal(g.legs[0].how, 'landmark by it');
  assert.equal(g.legs[1].how, 'goal in sight');
});

test('height and pacing', () => {
  const v = vertical([P('low', 0, 0), P('roof', 10, 0, { y: 20 })], samplePath([S('a', 0, 0), S('b', 10, 0, 'go', 20)], 5), () => 0);
  assert.deepEqual([v.range, v.raised, v.climb], [20, 1, 20]);
  const p = pacing([S('ship', 0, 0, 'ship'), S('x', 1, 1, 'talk'), S('y', 2, 2, 'talk'), S('z', 3, 3, 'talk'), S('w', 4, 4, 'go')]);
  assert.deepEqual(p.longest, { kind: 'talk', n: 3 });
});

test('the rubric: a world with long empty walks and blind legs scores low there, and every criterion is 1-5', () => {
  const m = {
    travel: { by: 'running', speed: RUN },
    spacing: { count: 8, median: 120, p90: 260, max: 400, loners: [{}, {}] },
    path: { stops: 5, metres: 6000, seconds: 730 },
    gaps: { longest: { metres: 1200, seconds: 146 }, emptyShare: 0.7, gaps: [] },
    returns: [{ empty: true, metres: 900 }], remote: [{}, {}, {}, {}],
    gravity: { optional: 4, on: 1, pulling: 0, remote: 3, pullShare: 0 },
    landmarks: { count: 1, fromSpawn: 0, seenShare: 0.2 },
    guidance: { guidedShare: 0.1, legs: [] },
    vertical: { range: 5, raised: 0, raisedShare: 0, climb: 4 },
    pacing: { distinct: 2, longest: { kind: 'talk', n: 3 } },
    spawn: { firstGoal: 400, near: 0 },
  };
  const s = scoreWorld(m);
  for (const c of Object.values(s.criteria)) assert.ok(c.score >= 1 && c.score <= 5 && c.from);
  assert.equal(s.criteria.density.score, 1);
  assert.equal(s.criteria.wayfinding.score, 1);
  assert.equal(s.criteria.loops.score, 1);
});

test('a loner is 18 s from anything at the world’s travel speed: 150 m running, 366 m on the bike', () => {
  assert.equal(lonelyFor(RUN), 150);
  assert.equal(lonelyFor(TRAVEL.bike), 366);
  const pois = [P('a', 0, 0), P('b', 20, 0), P('stop on the ride', 300, 0)];
  assert.equal(spacing(pois).loners.length, 1, 'on foot, 280 m out is a loner');
  assert.equal(spacing(pois, { lonely: lonelyFor(TRAVEL.bike) }).loners.length, 0, 'on the bike it is 14 s away');
});

test('a leading line carries a leg laid from beside its start to beside its goal; one that ends elsewhere, or wanders, does not', () => {
  const stones = { name: 'stones', points: [[10, 0, 0], [100, 0, 60], [200, 0, 80], [290, 0, 10]] };
  const hit = lineFor([0, 0, 0], [300, 0, 0], [stones]);
  assert.equal(hit.name, 'stones');
  assert.equal(hit.points.length, 4);
  assert.equal(lineFor([0, 0, 0], [300, 0, 300], [stones]), null, 'it ends nowhere near that goal');
  const wander = { name: 'maze', points: [[5, 0, 0], [0, 0, 400], [300, 0, 400], [295, 0, 0]] };
  assert.equal(lineFor([0, 0, 0], [300, 0, 0], [wander]), null, 'far longer than the straight way: nobody walks it');
  assert.deepEqual(lineFor([300, 0, 0], [0, 0, 0], [stones]).points[0], [290, 0, 10], 'walked the other way, the line is reversed');
});

test('followLines: a leg is walked along its line; a stage that names its line follows it from farther off', () => {
  const road = { name: 'the road', points: [[100, 0, 50], [60, 0, 200], [0, 0, 300]] };
  const stops = [S('tree', 160, 20), S('ship', 0, 310, 'ship')];
  assert.equal(followLines(stops, [road])[1].via, undefined, 'the road starts 67 m from the tree: not picked up by itself');
  const named = followLines([stops[0], { ...stops[1], via: 'the road' }], [road]);
  assert.equal(named[1].line, 'the road');
  assert.equal(named[1].via.length, 3);
  assert.ok(pathLength(named) > pathLength(stops), 'the way along the road is longer than the straight one');
  assert.ok(Math.abs(samplePath(named, 10).at(-1).at - pathLength(named)) < 0.1);
  assert.equal(followLines([stops[0], { ...stops[1], via: 'no such line' }], [road])[1].via, undefined);
});

test('a way home along a different line, past new things, is a loop, not a walk back', () => {
  const pois = [P('ship', 0, 0), P('tree', 0, 400), P('on the way out', 0, 200), P('cairn shrine', 150, 200)];
  const cairns = { name: 'cairns', points: [[10, 0, 390], [150, 0, 200], [10, 0, 10]] };
  const stops = [S('ship', 0, 0, 'ship'), S('tree', 0, 400), S('back to the ship', 0, 0, 'ship')];
  assert.equal(returnLegs(stops, pois)[0].empty, true);
  // a line laid from the ship to the tree carries the way out as well: nothing on the way home is new
  assert.equal(returnLegs(followLines(stops, [cairns]), pois)[0].empty, true, 'out and home by the same cairns');
  // the way home named by its stage, the line not followed by itself (`auto: false`: its lamps are lit for the way home)
  const home = [stops[0], stops[1], { ...stops[2], via: 'cairns' }];
  const r = returnLegs(followLines(home, [{ ...cairns, auto: false }]), pois)[0];
  assert.equal(r.empty, false, JSON.stringify(r));
  assert.equal(r.along, 'cairns');
  assert.ok(r.metres > 450);
});

test('a leg whose goal is out of sight but a leading line runs there is guided by the line', () => {
  const blind = () => false;
  const stones = { name: 'stones', points: [[20, 0, 0], [200, 0, 0], [380, 0, 0]] };
  const g = legGuidance([S('a', 0, 0), S('b', 400, 0)], [], blind, { lines: [stones] });
  assert.equal(g.legs[0].how, 'leading line (stones)');
  assert.equal(g.guidedShare, 1);
  const short = { name: 'short', points: [[20, 0, 0], [120, 0, 0]] };
  assert.equal(legGuidance([S('a', 0, 0), S('b', 400, 0)], [], blind, { lines: [short] }).legs[0].how, 'blind', 'a line that stops short, the goal still out of sight, is not enough');
});

test('the map is a real PNG', () => {
  const png = encodePNG(2, 1, Buffer.from([255, 0, 0, 0, 0, 255]));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const top = new Float32Array(16).fill(1);
  const m = mapPng({ x0: 0, z0: 0, cell: 10, nx: 4, nz: 4, top }, { path: [[0, 0, 0], [30, 0, 30]], pois: [P('a', 10, 10)], spawn: [0, 0, 0], px: 64 });
  assert.equal(m.w, 64);
  assert.ok(m.png.length > 100);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bladeEdges, bladeWidthAt, bladeGeometry, buildSword, BladeWake, wakeStyle, HILT, WAKE_STRANDS, WAKE_TONES } from '../src/fluid-sword.js';
import { BLADE, CHARGE, AIR, RIPOSTE, DASH, SWINGS, bladeLength, bladeWidth, bladeGrowth, INK_BROADER, shedDrops, REACH_UP } from '../src/fluid-blade.js';
import { UPGRADES } from '../src/ink.js';
import { FluidTool } from '../src/fluid-tool.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { playerHands } from '../src/hands.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), dt = 1 / 60;
const inked = (n) => ({ flag: (k) => (k === 'ink' ? n : undefined) });

test('the blade\'s outline is the sheet\'s: narrow at the cup, broadest a tenth to a third up, a long point leaning to the leading edge', () => {
  const W = BLADE.width, at = (v) => bladeWidthAt(v, W);
  let widest = 0, where = 0;
  for (let i = 0; i <= 200; i++) { const w = at(i / 200); if (w > widest) { widest = w; where = i / 200; } }
  assert.ok(Math.abs(widest - W) / W < 0.03, `its widest is BLADE.width (${widest.toFixed(4)} m)`);
  assert.ok(where > 0.1 && where < 0.35, `broadest near the hilt (${where})`);
  assert.ok(at(0) < 0.5 * W, 'narrow where it leaves the cup');
  assert.ok(at(0.06) > 0.75 * W, 'splashing out to its width within a tenth of the way');
  assert.ok(at(0.75) < 0.7 * W && at(0.95) < 0.3 * W && at(1) < 1e-3, 'tapering to a point');
  const e3 = bladeEdges(0.3, W, false), e9 = bladeEdges(0.9, W, false);
  assert.ok(Math.abs(e3.trail - e9.trail) > 2 * Math.abs(e3.lead - e9.lead), 'the leading edge nearly straight, the trailing edge curving up into the point');
  assert.ok(bladeEdges(1, W).lead > 0, 'the point leans to the leading edge');
  // ragged by the hilt (as water thrown), smooth further up
  let jag = 0;
  for (let v = 0.04; v < 0.25; v += 0.01) jag = Math.max(jag, Math.abs(bladeEdges(v, W).trail - bladeEdges(v, W, false).trail));
  assert.ok(jag > 0.002, `ragged near the hilt (${jag.toFixed(4)} m)`);
  assert.equal(bladeEdges(0.5, W).trail, bladeEdges(0.5, W, false).trail, 'smooth past a third of the way');
});

test('the blade\'s mesh: a lens from the cup to the point, inside its outline, its fold coordinates across and along', () => {
  const L = 0.85, W = BLADE.width, g = bladeGeometry(L, W);
  g.computeBoundingBox();
  const b = g.boundingBox;
  assert.ok(Math.abs(b.min.y) < 1e-6 && Math.abs(b.max.y - L) < 1e-6, 'from the cup (y 0) to the point (y = length)');
  assert.ok(b.max.z - b.min.z < 0.02 && b.max.z - b.min.z > 0.008, `thin (${(b.max.z - b.min.z).toFixed(4)} m through its ridge)`);
  const P = g.attributes.position, F = g.attributes.aFold;
  for (let i = 0; i < P.count; i++) {
    const u = F.getX(i), t = F.getY(i), e = bladeEdges(t, W);
    assert.ok(u >= -1 && u <= 1 && t >= 0 && t <= 1);
    assert.ok(P.getX(i) >= e.trail - 1e-6 && P.getX(i) <= e.lead + 1e-6, 'inside the outline');
    if (Math.abs(u) === 1) assert.ok(Math.abs(P.getZ(i)) < 0.001, 'thin at the edges');
  }
  assert.ok(g.index.count / 3 < 1600, 'a cheap mesh');
});

test('the sword: a hilt of three meshes in the fist (grip, brass, the cup\'s bead), the blade out of the cup', () => {
  const S = buildSword({ length: BLADE.length, width: BLADE.width, bladeBase: BLADE.guard + 0.012 });
  const meshes = []; S.group.traverse((o) => o.isMesh && meshes.push(o.name));
  assert.deepEqual(meshes.sort(), ['bead', 'blade', 'brass', 'grip']);
  assert.ok(S.hilt.children.length === 3, 'three draw calls held');
  const box = (name) => { const m = S.group.getObjectByName(name); m.geometry.computeBoundingBox(); return m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld); };
  S.group.updateMatrixWorld(true);
  const grip = box('grip'), brass = box('brass'), blade = box('blade');
  assert.ok(grip.min.y < -0.07 && grip.max.y > 0.05, 'the wrapped grip spans the fist round its middle (the origin)');
  assert.ok(brass.min.y < HILT.grip[0] && brass.max.y > HILT.mouth, 'brass at both ends: the pommel under the grip, the collar over it');
  assert.ok(Math.abs(blade.min.y - (BLADE.guard + 0.012)) < 1e-6 && blade.min.y < HILT.mouth + 0.004, 'the blade starts inside the cup\'s lip');
  assert.ok(brass.max.x - brass.min.x > 0.07, 'the cup opens oval along the edge, for the broad blade');
  // the wrap: bands spiralling round the grip, grooves between
  const P = S.group.getObjectByName('grip').geometry.attributes.position;
  let lo = Infinity, hi = 0;
  for (let i = 0; i < P.count; i++) { const r = Math.hypot(P.getX(i), P.getZ(i)); lo = Math.min(lo, r); hi = Math.max(hi, r); }
  assert.ok(hi - lo > 0.0018, `wrapped: bands raised off the grooves (${(hi - lo).toFixed(4)} m)`);
});

test('the blade grows out of the cup as it lights, and broader with each step of ink (longer with the reach)', () => {
  const none = inked(0);
  assert.equal(bladeWidth(none), BLADE.width);
  let wasL = 0, wasW = 0;
  for (const lit of [0.1, 0.3, 0.6, 1]) {
    const g = bladeGrowth(lit, none);
    assert.ok(g.length > wasL && g.width > wasW, `growing at lit ${lit}`); wasL = g.length; wasW = g.width;
    assert.ok(Math.abs(g.length - bladeLength(none) * lit) < 1e-9, 'its length as it cuts (bladeSegment)');
  }
  assert.ok(Math.abs(bladeGrowth(1, none).width - BLADE.width) < 1e-9 && bladeGrowth(0.1, none).width < 0.5 * BLADE.width, 'narrow at first, full when lit');
  UPGRADES.forEach((u, i) => {
    const s = inked(u.at);
    assert.ok(Math.abs(bladeWidth(s) - BLADE.width * (1 + INK_BROADER * (i + 1))) < 1e-9, `${u.id}: ${i + 1} step(s) broader`);
  });
  assert.ok(Math.abs(bladeGrowth(1, inked(UPGRADES[0].at)).length - BLADE.length * REACH_UP) < 1e-9, 'the reach: longer too');
});

test('each cut trails its own fluid: the charged cut widest, the riposte gold, the air cut falling, the dash cut a long streak', () => {
  const plain = wakeStyle(null), full = wakeStyle(CHARGE, true), early = wakeStyle(CHARGE, false);
  assert.ok(full.wide > early.wide && early.wide > plain.wide && full.drops > early.drops && early.drops > plain.drops, 'the charge widens and spills more, more when full');
  assert.ok(wakeStyle(RIPOSTE).tones.includes('#ffd46b') && wakeStyle(RIPOSTE).dropTones.includes('#ffd46b'), 'gold in the riposte');
  assert.ok(wakeStyle(AIR).grav > plain.grav, 'the air cut thrown down');
  assert.ok(wakeStyle(DASH).life >= Math.max(...[plain, full, wakeStyle(AIR), wakeStyle(RIPOSTE)].map((s) => s.life)), 'the dash cut the longest streak');
  assert.ok(!plain.dropTones.includes(WAKE_TONES[2]), 'no cream drops (they read as coins)');
  for (const S of SWINGS) assert.deepEqual(wakeStyle(S), plain, 'the combo\'s swings trail alike');
});

test('drops fly off the outer part of the edge, with the cut, as many as the style says', () => {
  const style = wakeStyle(null), from = { a: v(0, 1, 0), b: v(0, 1, 1) }, seg = { a: v(0, 1, 0), b: v(1, 1, 0.2) };
  const ds = shedDrops(from, seg, dt, style, () => 0.5);
  assert.equal(ds.length, style.drops);
  for (const d of ds) {
    const along = d.pos.distanceTo(seg.a) / seg.a.distanceTo(seg.b);
    assert.ok(along >= 0.35 && along <= 1 + 1e-9, 'off the outer part of the blade');
    assert.ok(d.vel.x > 0 && d.vel.length() <= 9 + 1e-9, 'flung along the cut (capped)');
    assert.ok(d.grav === style.grav && d.stretch > 1 && style.dropTones.includes(d.color));
  }
  assert.equal(shedDrops(null, seg, dt, style).length, 0, 'none on the first frame of a cut');
  assert.equal(shedDrops(from, seg, 0, style).length, 0, 'none on a paused frame');
});

test('the wake: laid through the cut only, narrowing and falling as it ages, gone after its life', () => {
  const parent = new THREE.Group(), W = new BladeWake(parent), style = wakeStyle(null), up = v(0, 1, 0);
  assert.equal(W.mesh.parent, parent);
  W.update(dt, { a: v(0, 1, 0), b: v(0, 1, 1) }, false, style, up);
  assert.ok(!W.mesh.visible && W.list.length === 0, 'nothing laid outside the cut');
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 1.5; W.update(dt, { a: v(0, 1, 0), b: v(Math.sin(a), 1, Math.cos(a)) }, true, style, up); }
  assert.ok(W.mesh.visible && W.list.length === 6, 'laid each frame of the cut');
  const P = W.geo.attributes.position, N = W.n;
  for (let i = 0; i < P.count; i++) assert.ok(Number.isFinite(P.getX(i) + P.getY(i) + P.getZ(i)));
  // strand 0 (off the point): the newest sample spans its share of the blade, the oldest narrower and lower
  const width = (k, i) => v().fromArray(W.pos, (k * N + i) * 6).distanceTo(v().fromArray(W.pos, (k * N + i) * 6 + 3));
  const [from, to] = WAKE_STRANDS[0];
  assert.ok(Math.abs(width(0, 0) - (to - from)) < 0.03, `the newest as wide as its strand (${width(0, 0).toFixed(3)})`);
  assert.ok(width(0, 5) < width(0, 0), 'older: narrower');
  assert.ok(W.pos[(0 * N + 5) * 6 + 4] < W.pos[(0 * N + 0) * 6 + 4], 'older: fallen');
  assert.ok(width(1, 0) < width(0, 0), 'the middle strand thinner');
  for (let i = 0; i < 40; i++) W.update(dt, null, false, style, up);
  assert.ok(!W.mesh.visible && W.list.length === 0, 'gone after its life');
});

test('in play: the lit blade is the broad one, the wake laid on the swing\'s own cut frames, drops off its edge', async () => {
  items.grant('backpack');
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, v(0, 0, -60), { moves: true, body: 'plain' });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const b = tool.blade, drops = [], add = tool.drops.add.bind(tool.drops);
  tool.drops.add = (d) => { drops.push(d); return add(d); };
  const tick = (input = {}) => { p.update(dt, input, CAM_PLUS_Z); tool.update(dt, input); p.humanoid.hands.update(dt, playerHands(p)); };
  for (let i = 0; i < 10; i++) tick({});
  tick({ KeyF: true });
  let laidOutside = 0, laidIn = 0, maxW = 0;
  for (let i = 0; i < 60 && (b.swinging || i < 2); i++) {
    const before = b.wake.laid;
    tick({});
    const laid = b.wake.laid - before;
    if (b.swinging && b.trailFrom && !b.charging && laid && !(await import('../src/fluid-blade.js')).trailCut(b)) laidOutside++;
    laidIn += laid;
    maxW = Math.max(maxW, b.bladeGroup.scale.x * b.builtWidth);
  }
  assert.ok(laidIn >= 3, `the wake laid through the cut (${laidIn} frames)`);
  assert.equal(laidOutside, 0, 'and only there');
  assert.ok(Math.abs(maxW - bladeWidth(tool.state)) < 0.005, `lit, the blade at its full width (${maxW.toFixed(3)} m)`);
  assert.ok(drops.some((d) => WAKE_TONES.includes(d.color)), 'drops of the sword\'s fluid off its edge');
  assert.equal(b.wake.mesh.parent, tool.fx, 'the wake in the world, not the fist');
  tool.dispose();
  assert.equal(b.wake.mesh.parent, null, 'disposed with the blade');
});

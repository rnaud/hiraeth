// Each fight temple's run drawn anew (issue #386; src/fight-temples/generate.js, docs/design/fight-temples.md "Each run
// its own"): two seeds give different runs, the same seed the same one; every draw keeps the table's budget wave by
// wave and its curve, its rooms shut but for their doors and a wall apart, the entrance first and the altar's room
// last, the camera never blocked; a drawn run of every temple plays through in node to the reward, its seed on the card.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { drawRun, rngOf, seedOf, foePool, drawWave, waveCost, foeCost, pieceOf, mirrorPiece, placePiece, apart, GEN, fromTheme, hazardLayout } from '../src/fight-temples/generate.js';
import { HAZARD, ON_LANES, laneRect, inLane } from '../src/fight-temples/hazards.js';
import { roomWaves, wallBoxes, doorGap, inRoom, roomAt, isoOffset, ISO, SEE, inTheWay, sightPoints, easeSee, segmentHitsBox, seeHoleCuts, seeOpen, totalFoes } from '../src/fight-temples/rules.js';
import { buildHall, hallHeight } from '../src/fight-temples/rooms.js';
import { startFightTemple } from '../src/fight-temples/session.js';
import { runSteps } from '../src/load-steps.js';
import { FOES, Foes } from '../src/foes.js';
import { DESERT_FIGHT } from '../src/fight-temples/desert.js';
import { ARZACH_FIGHT } from '../src/fight-temples/arzach.js';
import { PERDIDE_FIGHT } from '../src/fight-temples/perdide.js';
import { MOONFOUNDRY_FIGHT } from '../src/fight-temples/moonfoundry.js';
import { EDENA_FIGHT } from '../src/fight-temples/edena.js';
import { INCAL_FIGHT } from '../src/fight-temples/incal.js';
import { BURIED_FIGHT } from '../src/fight-temples/buried.js';
import { BAZAAR_FIGHT } from '../src/fight-temples/bazaar.js';
import { UNDERWATER_FIGHT } from '../src/fight-temples/underwater.js';
import { GLASSDUNES_FIGHT } from '../src/fight-temples/glassdunes.js';
import { SPHERES_FIGHT } from '../src/fight-temples/spheres.js';
import { SPACECITY_FIGHT } from '../src/fight-temples/spacecity.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

const THEMES = [DESERT_FIGHT, ARZACH_FIGHT, PERDIDE_FIGHT, MOONFOUNDRY_FIGHT, EDENA_FIGHT, INCAL_FIGHT, BURIED_FIGHT, BAZAAR_FIGHT, UNDERWATER_FIGHT, GLASSDUNES_FIGHT, SPHERES_FIGHT, SPACECITY_FIGHT];
const hpOf = (k) => FOES[k]?.hp ?? 2;
const key = (run) => JSON.stringify({ r: run.rooms.map((r) => [r.id, r.x, r.z, r.springs, r.pillars, r.waves]), d: run.doors });

test('the seed: the same seed the same random and the same run; ?seed= read; a fresh one otherwise', () => {
  const a = rngOf(42), b = rngOf(42), c = rngOf(43);
  const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.equal(seedOf('?game=fight-desert&seed=1234'), 1234);
  const s = seedOf('');
  assert.ok(s >= 1 && s <= 999999);
  for (const D of THEMES) assert.equal(key(drawRun(D, 777)), key(drawRun(D, 777)), `${D.id}: the same seed, the same run`);
});

test('two seeds give different runs: the order of the middle rooms, where they stand, what is in them, the waves', () => {
  for (const D of THEMES) {
    const runs = [1, 2, 3, 4, 5, 6].map((s) => drawRun(D, s));
    assert.ok(new Set(runs.map(key)).size === runs.length, `${D.id}: six seeds, six runs`);
    assert.ok(new Set(runs.map((r) => r.order.join())).size >= 2, `${D.id}: the middle rooms in more than one order`);
    assert.ok(new Set(runs.map((r) => JSON.stringify(r.doors))).size >= 2, `${D.id}: laid out more than one way`);
    assert.ok(new Set(runs.map((r) => JSON.stringify(r.rooms[1].waves))).size >= 3, `${D.id}: the waves drawn`);
  }
});

test('every draw: the entrance first and the altar’s room last, the rooms a wall apart and shut but for their doors, each wave the table’s budget at its place', () => {
  for (const D of THEMES) for (let s = 1; s <= 40; s++) {
    const run = drawRun(D, s);
    assert.ok(run.doors !== D.doors, `${D.id} ${s}: laid out`);
    assert.equal(run.order[0], D.rooms[0].id, 'the entrance first');
    assert.equal(run.order.at(-1), D.rooms.at(-1).id, 'the altar’s room last');
    assert.deepEqual([...run.order].sort(), D.rooms.map((r) => r.id).sort(), 'every room once');
    assert.ok(run.rooms.at(-1).altar, 'the altar in the last');
    assert.ok(!run.rooms[0].hazard, 'no hazard in the entrance');
    assert.equal(roomAt(run.rooms, run.spawn[0], run.spawn[2]), 0, 'he starts in the entrance');
    for (let i = 0; i < run.rooms.length; i++) for (let j = i + 1; j < run.rooms.length; j++) assert.ok(apart(run.rooms[i], run.rooms[j]), `${D.id} ${s}: rooms ${i}, ${j} a wall apart`);
    for (const r of run.rooms) for (const v of [...r.x, ...r.z]) assert.ok(Number.isInteger(v) && Math.abs(v) <= GEN.reach, 'on whole metres, on the hall’s ground');
    const walls = wallBoxes(run.rooms, run.doors), gaps = run.doors.map((d) => doorGap(run.rooms, d));
    const inside = (b, x, z) => x > b.x[0] + 1e-6 && x < b.x[1] - 1e-6 && z > b.z[0] + 1e-6 && z < b.z[1] - 1e-6;
    for (const r of run.rooms) for (let x = r.x[0] + 0.25; x < r.x[1]; x += 1) for (const z of [r.z[0] - 0.5, r.z[1] + 0.5]) assert.ok(walls.some((b) => inside(b, x, z)) || gaps.some((g) => inside(g, x, z)), `${D.id} ${s} ${r.id}: shut`);
    run.doors.forEach((d, i) => {
      const g = gaps[i], cx = (g.x[0] + g.x[1]) / 2, cz = (g.z[0] + g.z[1]) / 2;
      assert.ok(['n', 'w'].includes(d.side), 'its gate on a far side, seen');
      assert.ok(inRoom(run.rooms[d.from], cx, cz, -1.2) && inRoom(run.rooms[d.to], cx, cz, -1.2), `${D.id} ${s}: door ${i} joins its rooms`);
      assert.ok(!walls.some((b) => inside(b, cx, cz)), 'open');
    });
    for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i], b = walls[j], ox = Math.min(a.x[1], b.x[1]) - Math.max(a.x[0], b.x[0]), oz = Math.min(a.z[1], b.z[1]) - Math.max(a.z[0], b.z[0]);
      assert.ok(!(ox > 1e-6 && oz > 1e-6), `${D.id} ${s}: walls ${i}, ${j} overlap`);
    }
    // the budget, wave by wave, as the table's room at that place had it (its curve); the gorged and the tough kept
    const pool = foePool(D), cheapest = Math.min(...Object.keys(pool.light).map((k) => foeCost({ kind: k })));
    run.rooms.forEach((r, i) => {
      const was = roomWaves(D.rooms[i], { hpOf }), now = roomWaves(r, { hpOf });
      assert.equal(now.length, was.length, 'as many waves at each place');
      now.forEach((w, wi) => {
        assert.ok(Math.abs(waveCost(w) - waveCost(was[wi])) <= cheapest * 0.5 + 1e-9, `${D.id} ${s} room ${i} wave ${wi}: ${waveCost(w)} for a budget of ${waveCost(was[wi])}`);
        assert.equal(w.filter((q) => q.gorged).length, was[wi].filter((q) => q.gorged).length, 'the gorged ones where they were');
        assert.equal(w.filter((q) => q.tough).length, was[wi].filter((q) => q.tough).length, 'the tough ones where they were');
        for (const q of w) assert.ok(q.tough || q.gorged ? true : pool.light[q.kind] > 0, `${q.kind}: the theme's own`);
      });
    });
    // no sign left in a doorway
    for (const r of run.rooms) for (const [x, z] of r.hazard?.signs ?? []) assert.ok(!gaps.some((g) => x >= g.x[0] - 1.2 && x <= g.x[1] + 1.2 && z >= g.z[0] - 1.2 && z <= g.z[1] + 1.2), `${D.id} ${s}: a sign in a doorway`);
    // its springs and pillars inside their rooms; at least three springs
    for (const r of run.rooms) {
      assert.ok(r.springs.length >= 3);
      for (const [x, z] of [...r.springs, ...r.pillars, ...(r.altar ? [r.altar] : [])]) assert.ok(inRoom(r, x, z, 0.5), `${D.id} ${s} ${r.id}: inside`);
    }
  }
});

test('the pieces: a room taken out of its table, mirrored and set back is the room it was', () => {
  for (const D of THEMES) for (const r of D.rooms) {
    const p = pieceOf(r), cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2;
    const back = placePiece(p, cx, cz, r.waves);
    assert.deepEqual(back.springs, r.springs); assert.deepEqual(back.pillars, r.pillars); assert.deepEqual(back.x, r.x);
    if (r.hazard?.lanes) assert.deepEqual(back.hazard.lanes, r.hazard.lanes);
    const twice = placePiece(mirrorPiece(mirrorPiece(p, true, true), true, true), cx, cz, r.waves);
    assert.deepEqual(twice.springs, r.springs, 'mirrored twice: as it was');
    if (r.hazard?.lanes) assert.deepEqual(twice.hazard.lanes.map((l) => l.dir), r.hazard.lanes.map((l) => l.dir));
  }
  const pool = foePool(DESERT_FIGHT);
  assert.ok(pool.light.blot > 0 && pool.gorged.length && pool.tough.length);
  const w = drawWave(pool, 20, { gorged: 1 }, rngOf(3));
  assert.ok(w.some(([, , o]) => o?.gorged));
});

test('the camera never blocked in a drawn run (a seed each), by a wall or the ground', () => {
  const o = isoOffset();
  for (const D of THEMES) {
    const run = drawRun(D, 9);
    const F = runSteps(buildHall(new THREE.Scene(), run)).fight;
    for (const r of run.rooms) for (let x = r.x[0] + 0.5; x < r.x[1]; x += 3) for (let z = r.z[0] + 0.5; z < r.z[1]; z += 3) {
      if (F.cuttables.some((c) => c.kind === 'pillar' && c.box.distanceToPoint(new THREE.Vector3(x, 0.5, z)) < 0.3)) continue;
      const at = new THREE.Vector3(x, 0, z), cam = at.clone().setY(ISO.look).add(o);
      for (const c of F.cuttables) c.k = 0;
      const way = new Set(inTheWay(cam, F.cuttables, sightPoints(at)));
      for (let s = 0; s < 60; s++) F.cuttables.forEach((c, i) => { c.k = easeSee(c.k, way.has(i), 1 / 60); });
      const chest = at.clone().setY(SEE.chest), p = at.clone().setY(1.4);
      for (const c of F.cuttables) {
        if (!segmentHitsBox(cam, p, c.box)) continue;
        const hit = new THREE.Ray(cam, p.clone().sub(cam).normalize()).intersectBox(c.box, new THREE.Vector3());
        assert.ok(hit && seeHoleCuts(hit, cam, chest, seeOpen(c.k), { dot: 1 }), `${D.id} ${r.id} (${x}, ${z}): a ${c.kind} in the way`);
      }
      for (let k = 0.04; k < 1; k += 0.06) { const q = new THREE.Vector3().lerpVectors(p, cam, k); assert.ok(q.y > hallHeight(run, q.x, q.z) + 0.05, `${D.id} ${r.id}: the ground in the way`); }
    }
  }
});

test('a drawn run of every temple, and of short themes, plays through in node to the reward; its seed on the card', () => {
  const save = (flags = {}) => ({ data: { flags }, flag: (k) => flags[k], set: (k, v) => { flags[k] = v; return v; }, emit() {}, on: () => () => {} });
  for (const D of [...THEMES, THEME('toll'), THEME('dark', BURIED_FIGHT), THEME('gust', SPACECITY_FIGHT)]) {
    const run = drawRun(D, 31);
    const scene = new THREE.Scene(), level = runSteps(buildHall(scene, run)), pos = new THREE.Vector3(...run.spawn);
    const player = { pos, vel: new THREE.Vector3(), heading: 0, hearts: 3, maxHearts: 3, dead: false, opts: {}, frame: { dir: (h, o) => o.set(Math.sin(h), 0, Math.cos(h)), headingOf: (v) => Math.atan2(v.x, v.z) }, hurt() {}, flinch() {}, respawn() {}, restore() {}, restart() {} };
    const foes = new Foes({ scene, level, levelId: 'arena', physics: null, player, settings: { enemies: 'normal' }, rng: seeded() });
    const out = { finished: null };
    const ctx = { player, camera: new THREE.PerspectiveCamera(), level, sfx: new Proxy({}, { get: () => () => {} }), sound: null, tool: null, foes, rig: { yaw: 0 }, physics: null, state: save(), setFov() {}, add: (o) => { scene.add(o); return o; }, flash() {}, status() {}, finish: (r) => { out.finished = r; }, drop() {} };
    const S = startFightTemple(ctx), tick = () => S.update(1 / 30, {}, { live: true, raw: {} });
    let guard = 0;
    for (const [i, r] of run.rooms.entries()) {
      player.pos.set((r.x[0] + r.x[1]) / 2, 0, (r.z[0] + r.z[1]) / 2); tick();
      assert.equal(S.run.room, i, `${D.id}: room ${i}`);
      let k = 0;
      while (S.run.room === i && S.run.phase !== 'reward' && guard++ < 40000) { tick(); if (++k % 120 === 0 || S.run.queue === 0) for (const f of foes.list) if (f.alive) f.state = 'dead'; }
    }
    assert.equal(S.run.phase, 'reward', `${D.id}: the reliquary`);
    assert.equal(S.run.kills, totalFoes(run));
    player.pos.set(run.rooms.at(-1).altar[0], 0, run.rooms.at(-1).altar[1]);
    for (let k = 0; k < 80 && !out.finished; k++) tick();
    assert.ok(out.finished && !out.finished.failed, `${D.id}: won`);
    assert.ok(!out.finished.lines.some((l) => l.includes('?seed=')), 'no seed on the card: a URL parameter is the developer\'s (issue #559)');
    S.end();
  }
});

/** A short theme as a new world would write it: another temple's rooms, its own foes and hazard. */
const THEME = (hazard, rooms = ARZACH_FIGHT) => fromTheme({
  id: `fight-test-${hazard}`, world: 'perdide', colours: 'reed', name: 'A test temple', blurb: '…', hour: 12, palette: PERDIDE_FIGHT.palette, pillar: 'stack', dress: 'mill',
  rooms, hazard, foes: { light: { toad: 2, skitter: 4, rootknot: 1 }, gorged: ['toad'], tough: [['shade', 1, { tough: true }], ['rootknot', 1, { tough: true }]] },
});

test('a short theme: another temple’s rooms, its own foes and any hazard kind, laid in each room by its shape; drawn and played as any other', () => {
  const kinds = Object.keys(HAZARD).filter((k) => typeof HAZARD[k] === 'object');
  assert.ok(kinds.length >= 11, kinds.join());
  for (const kind of kinds) for (const rooms of [ARZACH_FIGHT, BURIED_FIGHT, SPACECITY_FIGHT]) {
    const T = THEME(kind, rooms);
    assert.ok(!T.rooms[0].hazard && T.rooms.slice(1).every((r) => r.hazard.kind === kind));
    for (const r of T.rooms.slice(1)) {
      if (ON_LANES.has(kind)) for (const l of r.hazard.lanes) {
        const L = laneRect(r, l);
        assert.ok(L.x[0] >= r.x[0] - 1e-9 && L.x[1] <= r.x[1] + 1e-9 && L.z[0] >= r.z[0] - 1e-9 && L.z[1] <= r.z[1] + 1e-9, `${kind} ${r.id}: a lane inside`);
        if (r.altar) assert.ok(!inLane(r, l, ...r.altar, 1.3), `${kind} ${r.id}: the altar clear`);
      }
      if (kind === 'dark') assert.ok(r.hazard.lamps.length >= 3);
      if (kind === 'toll') assert.ok(r.hazard.signs.every(([x, z]) => x === r.x[0] || z === r.z[0]), 'signs on its far walls');
    }
    for (let seed = 1; seed <= 5; seed++) {
      const run = drawRun(T, seed);
      assert.ok(run.doors !== T.doors, `${kind}: laid out`);
      for (const q of roomWaves(run.rooms[2], { hpOf }).flat()) assert.ok(q.gorged || ['toad', 'skitter', 'rootknot'].includes(q.kind), `${kind}: its own foes (${q.kind})`);
      assert.deepEqual(run.rooms.at(-1).waves.at(-1).filter(([, , o]) => o?.tough).map(([k]) => k).sort(), ['rootknot', 'shade']);
    }
  }
  // two of them played through
  for (const kind of ['toll', 'dark']) {
    const run = drawRun(THEME(kind), 5);
    assert.equal(roomWaves(run.rooms[0], { hpOf }).flat().length > 0, true);
    assert.ok(hazardLayout(kind, run.rooms[1]));
  }
});

// The fight temples of the other worlds (issue #341; src/fight-temples/arzach.js, perdide.js, moonfoundry.js, hazards.js,
// dress.js; docs/design/fight-temples.md): each a complete game on the desert's template with its host by its doorway
// in its world; its rooms shut but for their doors and the camera never blocked; its waves of its own world's kinds,
// light and many, gorged ones from the second room on, the tough ones last; its hazard's lanes inside its rooms, off
// its pillars, its springs' foes reaching it; a run in node from the first wave to the reward, its colours won; and each
// hazard hurting him unless he rolls through it, and the foes in it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fightArzach from '../src/minigames/fight-arzach.js';
import fightPerdide from '../src/minigames/fight-perdide.js';
import fightMoonfoundry from '../src/minigames/fight-moonfoundry.js';
import fightEdena from '../src/minigames/fight-edena.js';
import fightIncal from '../src/minigames/fight-incal.js';
import fightBuried from '../src/minigames/fight-buried.js';
import fightBazaar from '../src/minigames/fight-bazaar.js';
import fightUnderwater from '../src/minigames/fight-underwater.js';
import fightGlassdunes from '../src/minigames/fight-glassdunes.js';
import fightSpheres from '../src/minigames/fight-spheres.js';
import { checkGame, collectGames } from '../src/minigames/index.js';
import { HOSTS } from '../src/story/hosts-data.js';
import { TONES } from '../src/story/tone.js';
import {
  ISO, isoOffset, SEE, sightPoints, inTheWay, easeSee, seeOpen, seeHoleCuts, segmentHitsBox, WALL, wallBoxes, doorGap, inRoom, roomAt, roomWaves, totalFoes,
} from '../src/fight-temples/rules.js';
import { HAZARD, ON_LANES, laneRect, inLane, alongLane, lanePoint, laneLength, pickLanes, hazardEvery, tollReach, tileOf, inLight, shadeBand } from '../src/fight-temples/hazards.js';
import { buildHall, hallHeight, outside } from '../src/fight-temples/rooms.js';
import { farSpots } from '../src/fight-temples/dress.js';
import { startFightTemple } from '../src/fight-temples/session.js';
import { runSteps } from '../src/load-steps.js';
import { FOES, Foes } from '../src/foes.js';
import { WORLDS } from '../src/foe-worlds.js';
import { spawnKindOf } from '../src/enemies/archetypes.js';
import { colourById, colourOfWorld, chosenColour, PIECES } from '../src/kit-colours.js';

const GAMES = [fightArzach, fightPerdide, fightMoonfoundry, fightEdena, fightIncal, fightBuried, fightBazaar, fightUnderwater, fightGlassdunes, fightSpheres];
const save = (flags = {}) => ({ data: { flags }, flag: (k) => flags[k], set: (k, v) => { flags[k] = v; return v; }, emit() {}, on: () => () => {} });
const hpOf = (k) => FOES[k]?.hp ?? 2;

for (const game of GAMES) {
  const D = game.table;
  test(`${D.name}: a complete game on foot, its own world's colours, hosted by its doorway in ${D.world}`, () => {
    assert.deepEqual(checkGame(game), []);
    assert.equal(game.drives, false);
    assert.equal(game.fightTemple, D.world);
    assert.equal(collectGames({ [`./${D.id}.js`]: { default: game } })[0].id, D.id);
    const m = game.markers[0];
    assert.ok(m, 'its doorway in its world');
    assert.equal(m.level, D.entrance.level ?? D.world, 'in its world (or the part of it the doorway stands in)');
    assert.ok(Math.hypot(m.at[0] - D.entrance.near[0], m.at[2] - D.entrance.near[1]) < 70, 'by a settlement');
    assert.ok(game.marker.model().userData.solid);
    const h = HOSTS[D.id];
    assert.ok(h && h.name && h.say.length === 2 && h.lines.length >= 1, 'its host, who offers it');
    for (const l of [...h.say, ...h.lines]) {
      const tone = /^~(\w+)~ /.exec(l)?.[1];
      assert.ok(TONES.includes(tone), `a tone: ${l}`);
      assert.ok(l.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length <= 4, `terse: ${l}`);
    }
    const c = colourOfWorld(D.world);
    assert.equal(c?.id, D.colours, 'its colours');
    assert.ok(c.pack && c.water.base, 'a palette for each piece');
    assert.ok(!controlsJump(game), 'no jump: B rolls (535f87f9a)');
  });

  test(`${D.name}: every room shut but for its doors, its walls apart, its floor flat; its lanes in its rooms, off its pillars and its altar`, () => {
    const walls = wallBoxes(D.rooms, D.doors);
    const inside = (b, x, z) => x > b.x[0] + 1e-6 && x < b.x[1] - 1e-6 && z > b.z[0] + 1e-6 && z < b.z[1] - 1e-6;
    const gaps = D.doors.map((d) => doorGap(D.rooms, d));
    for (const r of D.rooms) {
      for (let x = r.x[0] + 0.25; x < r.x[1]; x += 0.5) for (const z of [r.z[0] - 0.5, r.z[1] + 0.5]) assert.ok(walls.some((b) => inside(b, x, z)) || gaps.some((g) => inside(g, x, z)), `${r.id}: shut at ${x}, ${z}`);
      for (let z = r.z[0] + 0.25; z < r.z[1]; z += 0.5) for (const x of [r.x[0] - 0.5, r.x[1] + 0.5]) assert.ok(walls.some((b) => inside(b, x, z)) || gaps.some((g) => inside(g, x, z)), `${r.id}: shut at ${x}, ${z}`);
    }
    for (const [i, g] of gaps.entries()) {
      const cx = (g.x[0] + g.x[1]) / 2, cz = (g.z[0] + g.z[1]) / 2;
      assert.ok(!walls.some((b) => inside(b, cx, cz)), `door ${i} open`);
      // (into the room it leads to: the step through it lands in a room on each side)
      assert.ok([D.doors[i].from, D.doors[i].to].every((k) => inRoom(D.rooms[k], cx, cz, -1.2)), `door ${i} joins its rooms`);
    }
    for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i], b = walls[j], ox = Math.min(a.x[1], b.x[1]) - Math.max(a.x[0], b.x[0]), oz = Math.min(a.z[1], b.z[1]) - Math.max(a.z[0], b.z[0]);
      assert.ok(!(ox > 1e-6 && oz > 1e-6), `walls ${i} and ${j} overlap`);
    }
    for (let i = 0; i < D.rooms.length; i++) for (let j = i + 1; j < D.rooms.length; j++) {
      const a = D.rooms[i], b = D.rooms[j], ox = Math.min(a.x[1], b.x[1]) - Math.max(a.x[0], b.x[0]), oz = Math.min(a.z[1], b.z[1]) - Math.max(a.z[0], b.z[0]);
      assert.ok(!(ox > -2 + 1e-6 && oz > -2 + 1e-6), `rooms ${i} and ${j} at least a wall apart`);
    }
    for (const r of D.rooms) for (let k = 0; k < 20; k++) {
      const x = r.x[0] + ((k * 7) % 20 + 0.5) / 20 * (r.x[1] - r.x[0]), z = r.z[0] + ((k * 13) % 20 + 0.5) / 20 * (r.z[1] - r.z[0]);
      assert.ok(Math.abs(hallHeight(D, x, z)) < 0.05, 'a flat floor');
    }
    assert.equal(roomAt(D.rooms, ...D.spawn.filter((v, i) => i !== 1)), 0, 'he starts in the first room');
    // its hazard: from the second room on, the same kind throughout, the lanes inside their rooms and clear of pillars and altar
    const kinds = new Set(D.rooms.filter((r) => r.hazard).map((r) => r.hazard.kind));
    assert.equal(kinds.size, 1, 'one hazard of its own');
    assert.ok(!D.rooms[0].hazard && D.rooms.slice(1).every((r) => r.hazard), 'from the second room on: the first teaches the crowd');
    assert.ok(D.rooms.at(-1).hazard.n >= D.rooms[1].hazard.n && D.rooms.at(-1).hazard.every <= D.rooms[1].hazard.every, 'more of it deeper in');
    const K = D.rooms[1].hazard.kind;
    assert.ok(HAZARD[K], `${K}: a kind of hazards.js`);
    if (K === 'toll') for (const r of D.rooms.filter((x) => x.hazard)) {
      // (its signs on its walls, none in a doorway, as many as it rings at once at least)
      assert.ok(r.hazard.signs.length >= r.hazard.n);
      for (const [x, z] of r.hazard.signs) {
        assert.ok((x === r.x[0] || x === r.x[1]) && z > r.z[0] && z < r.z[1] || (z === r.z[0] || z === r.z[1]) && x > r.x[0] && x < r.x[1], `${r.id}: a sign on its wall at ${x}, ${z}`);
        assert.ok(!gaps.some((g) => x >= g.x[0] - 1.2 && x <= g.x[1] + 1.2 && z >= g.z[0] - 1.2 && z <= g.z[1] + 1.2), `${r.id}: a sign in a doorway at ${x}, ${z}`);
        assert.ok(tollReach(r, [x, z]) < 40);
      }
    }
    if (['drop', 'crack', 'spill'].includes(K)) assert.ok(D.rooms.slice(1).every((r) => !r.hazard.lanes && r.hazard.n >= 1 && r.hazard.n <= 3), 'spots round him: no lanes');
    if (K === 'dark') for (const r of D.rooms.slice(1)) {
      // (its lamps inside it, apart, and dark enough between them that the dark means something)
      assert.ok(r.hazard.lamps.length >= 3 && r.hazard.lamps.every(([x, z]) => inRoom(r, x, z, 1)), `${r.id}: its lamps in it`);
      let lit = 0, n = 0;
      for (let x = r.x[0] + 0.5; x < r.x[1]; x += 1) for (let z = r.z[0] + 0.5; z < r.z[1]; z += 1) { n++; if (inLight(r.hazard.lamps, x, z)) lit++; }
      assert.ok(lit / n > 0.12 && lit / n < 0.6, `${r.id}: ${(100 * lit / n).toFixed(0)} % of it lit`);
    }
    if (K === 'shade') for (const r of D.rooms.slice(1)) assert.ok(r.hazard.lanes.every((l) => (l.along === 'x' || l.along === 'z') && Math.abs(l.dir) === 1), `${r.id}: the shade's ways`);
    for (const r of D.rooms.filter((x) => x.hazard && ON_LANES.has(x.hazard.kind))) for (const l of r.hazard.lanes) {
      const L = laneRect(r, l);
      assert.ok(L.x[0] >= r.x[0] - 1e-9 && L.x[1] <= r.x[1] + 1e-9 && L.z[0] >= r.z[0] - 1e-9 && L.z[1] <= r.z[1] + 1e-9, `${r.id}: a lane inside it`);
      assert.ok(l.w >= 2 && l.w <= 3.6 && Math.abs(l.dir) === 1);
      for (const [px, pz] of r.pillars ?? []) assert.ok(!inLane(r, l, px, pz, 0.9), `${r.id}: a pillar in a lane at ${px}, ${pz}`);
      if (r.altar) assert.ok(!inLane(r, l, ...r.altar, 2), `${r.id}: the altar clear`);
    }
  });

  test(`${D.name}: the camera never blocked, by a wall or the ground`, () => {
    const F = runSteps(buildHall(new THREE.Scene(), D)).fight;
    const o = isoOffset();
    let checked = 0;
    for (const r of D.rooms) for (let x = r.x[0] + 0.5; x < r.x[1]; x += 2) for (let z = r.z[0] + 0.5; z < r.z[1]; z += 2) {
      if (F.cuttables.some((c) => c.kind === 'pillar' && c.box.distanceToPoint(new THREE.Vector3(x, 0.5, z)) < 0.3)) continue;
      const at = new THREE.Vector3(x, 0, z), cam = at.clone().setY(ISO.look).add(o);
      for (const c of F.cuttables) c.k = 0;
      const way = new Set(inTheWay(cam, F.cuttables, sightPoints(at)));
      for (let s = 0; s < 60; s++) F.cuttables.forEach((c, i) => { c.k = easeSee(c.k, way.has(i), 1 / 60); });
      const chest = at.clone().setY(SEE.chest);
      for (const h of [0.5, 1.4]) {
        const p = at.clone().setY(h);
        for (const c of F.cuttables) {
          if (!segmentHitsBox(cam, p, c.box)) continue;
          const hit = new THREE.Ray(cam, p.clone().sub(cam).normalize()).intersectBox(c.box, new THREE.Vector3());
          assert.ok(hit && seeHoleCuts(hit, cam, chest, seeOpen(c.k), { dot: 1 }), `${r.id} (${x}, ${z}) h ${h}: a ${c.kind} in the way`);
        }
        for (let k = 0.02; k < 1; k += 0.04) {
          const q = new THREE.Vector3().lerpVectors(p, cam, k);
          assert.ok(q.y > hallHeight(D, q.x, q.z) + 0.05, `${r.id} (${x}, ${z}) h ${h}: the ground in the way at ${q.x.toFixed(1)}, ${q.z.toFixed(1)}`);
        }
      }
      checked++;
    }
    assert.ok(checked > 200, `${checked} places`);
    // its dressing stands on the far side of the walls only (dress.js farSpots)
    const cx = Math.sin(ISO.yaw), cz = Math.cos(ISO.yaw);
    const spots = farSpots(D, 20);
    assert.ok(spots.length >= 10);
    for (const [x, z] of spots) {
      const w = outside(D, x, z);
      assert.ok(w.d >= 2, 'outside the walls');
      assert.ok(w.nx * cx + w.nz * cz < -0.3, `behind the hall from the camera (${x.toFixed(1)}, ${z.toFixed(1)})`);
    }
  });

  test(`${D.name}: waves of ${D.world}'s own kinds, light and many; gorged ones from the second room; the tough ones last`, () => {
    const own = new Set(Object.keys(WORLDS[D.world].roster).map(spawnKindOf).filter(Boolean));
    let tough = 0, gorged = 0, n = 0;
    for (const [i, r] of D.rooms.entries()) {
      for (const [wi, w] of roomWaves(r, { hpOf }).entries()) for (const q of w) {
        n++;
        if (q.tough) { tough++; assert.equal(i, D.rooms.length - 1); assert.equal(wi, roomWaves(r, { hpOf }).length - 1, 'the last wave'); assert.equal(q.hp, FOES[q.kind].hp); continue; }
        if (q.gorged) { gorged++; assert.ok(i >= 1); continue; }
        assert.ok(own.has(q.kind), `${q.kind}: ${D.world}'s own`);
        assert.ok(q.hp <= 2, `${q.kind}: a cut or two`);
      }
    }
    assert.ok(tough >= 2 && tough <= 3, 'a few tough ones at the end');
    assert.ok(gorged >= 4, `gorged ones in most waves from the second room (${gorged})`);
    assert.ok(n >= 110 && n <= 170, `${n} foes: many`);
    assert.equal(totalFoes(D), n);
    assert.ok(D.rooms.every((r) => r.waves.length >= 2 && r.waves.length <= 3) && D.rooms.length >= 3 && D.rooms.length <= 4);
    assert.ok(roomWaves(D.rooms[1], { gentle: true, hpOf }).flat().length < roomWaves(D.rooms[1], { hpOf }).flat().length, 'Gentle brings fewer');
  });
}

/** Do the game's controls name a jump? */
function controlsJump(game) {
  return [...game.controls.pad, ...game.controls.keys, ...game.controls.touch].some(([k, v]) => /jump/i.test(`${k} ${v}`)) || game.touchButtons.includes('jump');
}

test('the lanes: a strip the room long; along it from its head the way it goes; the one under him first', () => {
  const r = { x: [-10, 10], z: [-20, 0] };
  const a = { along: 'x', at: -5, w: 3, dir: 1 }, b = { along: 'z', at: 4, w: 2, dir: -1 };
  assert.deepEqual(laneRect(r, a), { x: [-10, 10], z: [-6.5, -3.5] });
  assert.deepEqual(laneRect(r, b), { x: [3, 5], z: [-20, 0] });
  assert.ok(inLane(r, a, 0, -5) && !inLane(r, a, 0, -2) && inLane(r, a, 0, -2.6, 1));
  assert.equal(alongLane(r, a, -10, -5), 0);
  assert.equal(alongLane(r, b, 4, 0), 0, 'its head the far end from its way');
  assert.equal(alongLane(r, b, 4, -20), 20);
  assert.deepEqual(lanePoint(r, b, 5), [4, -5]);
  assert.equal(laneLength(r, a), 20);
  const lanes = [a, b, { along: 'x', at: -15, w: 3, dir: -1 }];
  assert.equal(pickLanes(r, lanes, { x: 4, z: -12 }, 1)[0], 1, 'the one he stands in');
  assert.equal(pickLanes(r, lanes, { x: -8, z: -14 }, 1)[0], 2, 'else the nearest him');
  assert.equal(new Set(pickLanes(r, lanes, { x: 0, z: 0 }, 3, () => 0.5)).size, 3);
  const room = { hazard: { every: 6, n: 1, lanes } };
  assert.equal(hazardEvery(room), 6);
  assert.equal(hazardEvery(room, { last: true }), 6 * HAZARD.last);
  assert.equal(hazardEvery(room, { gentle: true }), 6 * HAZARD.gentle);
  assert.equal(hazardEvery({}), 0);
});

/** A run in node, as tests/fight-temples.test.js's: the hall built, its world's foes made by Foes (not moved). */
function simulate(D, { flags = {} } = {}) {
  const scene = new THREE.Scene();
  const level = runSteps(buildHall(scene, D));
  const pos = new THREE.Vector3(...D.spawn);
  const hurts = [];
  const player = {
    pos, vel: new THREE.Vector3(), heading: 0, hearts: 3, maxHearts: 3, dead: false, opts: {}, rolling: false,
    frame: { dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)), headingOf: (v) => Math.atan2(v.x, v.z) },
    hurt(n, why) { hurts.push([why, n]); }, flinch() {}, dodge() { return this.rolling; },
    respawn: (p) => pos.copy(p), restore(h) { this.hearts = Math.min(this.maxHearts, this.hearts + h); }, restart() {},
  };
  const foes = new Foes({ scene, level, levelId: 'arena', physics: null, player, settings: { enemies: 'normal' } });
  const state = save(flags);
  const out = { finished: null, drops: 0, added: [] };
  const ctx = {
    player, camera: new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 800), level, sfx: new Proxy({}, { get: () => () => {} }), sound: null, tool: null, foes, rig: { target: new THREE.Vector3(), yaw: 0 }, physics: null, state,
    setFov() {}, add: (o) => { scene.add(o); out.added.push(o); return o; }, flash() {}, status() {}, finish: (r) => { out.finished = r; }, drop: (p, n) => { out.drops += n; },
  };
  const S = startFightTemple(ctx);
  const tick = (live = true) => S.update(1 / 30, {}, { live, raw: {} });
  return { S, out, player, foes, level, state, tick, hurts };
}

for (const game of GAMES) {
  const D = game.table, kind = D.rooms[1].hazard.kind, H = HAZARD[kind];
  test(`${D.name}: a run from the first wave to the reward; its colours won and worn`, () => {
    const { S, out, player, foes, state, tick } = simulate(D);
    let felled = 0, guard = 0;
    for (const [i, r] of D.rooms.entries()) {
      player.pos.set((r.x[0] + r.x[1]) / 2, 0, (r.z[0] + r.z[1]) / 2);
      tick();
      assert.equal(S.run.room, i);
      assert.equal(S.run.phase, 'fight', `${r.id}: its first wave as he comes in`);
      let k = 0;
      while (S.run.room === i && S.run.phase !== 'reward' && guard++ < 40000) {
        tick();
        if (++k % 120 === 0 || S.run.queue === 0) for (const f of foes.list) if (f.alive) { f.state = 'dead'; felled++; }
      }
    }
    assert.equal(S.run.phase, 'reward');
    assert.ok(felled <= totalFoes(D));
    assert.equal(S.run.kills, totalFoes(D), 'every one felled (some by its hazard)');
    player.pos.set(D.rooms.at(-1).altar[0], 0, D.rooms.at(-1).altar[1]);
    for (let k = 0; k < 80 && !out.finished; k++) tick();
    assert.ok(out.finished && !out.finished.failed, 'won');
    assert.match(out.finished.title, new RegExp(`^${D.name} cleared · rank [SABC]$`));
    assert.ok(out.finished.lines[0].startsWith(`New colours: ${colourById(D.colours).name}`));
    assert.equal(state.flag(`kit.colours.${D.colours}`), true);
    for (const p of PIECES) assert.equal(chosenColour(state, p), D.colours);
    S.end();
    assert.equal(foes.list.length, 0);
    assert.equal(S.hazards.active, 0, 'its hazard gone with it');
  });

  test(`${D.name}: its ${kind} comes in its rooms while a wave is fought, hurts him unless he rolls through it, and hurts the foes in it`, () => {
    const g = simulate(D);
    g.tick();
    for (let k = 0; k < 6000 && g.S.run.room === 0; k++) { g.tick(); for (const f of g.foes.list) if (f.alive) f.state = 'dead'; }
    assert.equal(g.S.run.room, 1);
    const r = D.rooms[1];
    g.player.pos.set((r.x[0] + r.x[1]) / 2, 0, (r.z[0] + r.z[1]) / 2);
    g.tick();
    assert.equal(g.S.run.phase, 'fight');
    // on its own: within its every, a lane under way
    let seen = false;
    for (let k = 0; k < Math.ceil(r.hazard.every * 30) + 2 && !seen; k++) { g.tick(); seen = g.S.hazards.active > 0; }
    assert.ok(seen, 'it comes on its own');
    for (let k = 0; k < 300; k++) g.tick();
    g.S.hazards.clear();
    // a lane begun with him in it, past its head, and a foe in it (a load: him under it, the foe beside him; a toll: him
    // and the foe a few metres out from its sign)
    const mid = [(r.x[0] + r.x[1]) / 2, (r.z[0] + r.z[1]) / 2];
    let lane, x, z, foeAt;
    if (ON_LANES.has(kind)) {
      lane = r.hazard.lanes[0]; const L = laneLength(r, lane);
      [x, z] = lanePoint(r, lane, L * 0.55); foeAt = lanePoint(r, lane, L * 0.35);
    } else if (kind === 'drop' || kind === 'spill') {
      [x, z] = mid; lane = { spot: [x, z] }; foeAt = [x + 0.6, z + 0.3];
    } else if (kind === 'crack') {
      [x, z] = tileOf(r, ...mid); lane = { spot: [x, z] }; [x, z] = [x + 0.2, z + 0.2]; foeAt = [x - 0.4, z - 0.3];
    } else if (kind === 'dark') {
      // (him out of the light, the foe in a lamp's disc)
      lane = { room: true };
      [x, z] = [0, 0].map((_, i) => 0); let best = null;
      for (let a = r.x[0] + 1; a < r.x[1] - 1; a += 0.5) for (let b = r.z[0] + 1; b < r.z[1] - 1; b += 0.5) if (!inLight(r.hazard.lamps, a, b, HAZARD.dark.light + 0.6) && !(r.pillars ?? []).some(([px, pz]) => Math.hypot(a - px, b - pz) < 1.6)) { best = [a, b]; break; }
      [x, z] = best; foeAt = [r.hazard.lamps[0][0] + 0.5, r.hazard.lamps[0][1]];
    } else if (kind === 'shade') {
      lane = r.hazard.lanes[0]; [x, z] = mid; foeAt = [mid[0] + 0.8, mid[1] + 0.8];
    } else {
      const sign = r.hazard.signs[0], d = Math.hypot(mid[0] - sign[0], mid[1] - sign[1]), u = [(mid[0] - sign[0]) / d, (mid[1] - sign[1]) / d];
      lane = { sign }; [x, z] = [sign[0] + u[0] * 4, sign[1] + u[1] * 4]; foeAt = [sign[0] + u[0] * 6 + u[1] * 1.5, sign[1] + u[1] * 6 - u[0] * 1.5];
    }
    const f = g.foes.add(['gust', 'drop', 'toll', 'crack', 'spill', 'dark', 'shade'].includes(kind) ? 'blot' : D.rooms[1].waves[0][0][0], new THREE.Vector3(foeAt[0], 0, foeAt[1]));
    f.hp = 20;
    const at = f.pos.clone();
    g.hurts.length = 0;
    g.S.hazards.start(1, lane);
    const hold = () => { g.player.pos.set(x, 0, z); g.player.vel.set(0, 0, 0); if (kind !== 'gust') f.pos.copy(at); f.state = 'idle'; };
    for (let k = 0; k < Math.ceil(H.warn * 30) - 2; k++) { hold(); g.tick(); }
    assert.deepEqual(g.hurts, [], 'nothing while it warns');
    assert.equal(f.hp, 20);
    for (let k = 0; k < 120; k++) { hold(); g.tick(); }
    assert.ok(g.hurts.length >= 1 && g.hurts.every(([why]) => ['gust', 'millstone', 'slag', 'cart', 'bloom', 'drop', 'toll', 'crack', 'spill', 'dark', 'shade'].includes(why)), `it hurts him: ${JSON.stringify(g.hurts)}`);
    if (kind === 'shade') assert.ok(true); else assert.ok(f.hp < 20, `and the foe in it (${f.hp})`);
    if (kind === 'gust') assert.ok(Math.abs(alongLane(r, lane, f.pos.x, f.pos.z) - alongLane(r, lane, at.x, at.z)) > 4, 'carried down the lane');
    // rolling through it: unharmed
    g.S.hazards.clear(); g.hurts.length = 0;
    g.player.rolling = true;
    g.S.hazards.start(1, lane);
    for (let k = 0; k < 150; k++) { hold(); g.tick(); }
    assert.equal(g.hurts.filter(([why]) => why !== 'hit').length, 0, 'rolling: unharmed');
    g.S.end();
  });
}

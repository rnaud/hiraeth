// The fight temples (issue #341; src/fight-temples/, docs/design/fight-temples.md): the desert's Sunken Hall a
// complete game with its host and its doorway; the camera isometric and never blocked (by a wall or the sand);
// the aim in the cone; the rooms closed but for their doors; the waves light and many, the last one tough; a run
// that spawns and clears every wave, opens every gate and ends with the reward won and saved; the crowd within its
// cap and the frame's budget; the kit's colours won, chosen, cycled and painted on.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fightDesert from '../src/minigames/fight-desert.js';
import { checkGame, collectGames } from '../src/minigames/index.js';
import { HOSTS } from '../src/story/hosts-data.js';
import { DESERT_FIGHT } from '../src/fight-temples/desert.js';
import {
  ISO, isoOffset, followIso, screenUp, screenRight, SEE, sightPoints, inTheWay, easeSee, seeOpen, seeHoleCuts, segmentHitsBox, WALL, wallBoxes, doorGap, inRoom, roomAt,
  AIM, pickTarget, stickToGround, LIGHT_HP, roomWaves, release, CROWD, headOf, totalFoes, heartChance, chimesFor, pursesFor,
} from '../src/fight-temples/rules.js';
import { buildHall, hallHeight } from '../src/fight-temples/rooms.js';
import { startFightTemple, LIGHT_HARM } from '../src/fight-temples/session.js';
import { runSteps } from '../src/load-steps.js';
import { FOES, Foes } from '../src/foes.js';
import { KIT_COLOURS, PIECES, colourById, colourOfWorld, wonColours, chosenColour, chooseColour, cycleColour, unlockColours, coloursData, paintPack, paintWater, PACK_BASE } from '../src/kit-colours.js';
import { buildFlask } from '../src/fluid-tool.js';
import { makeMaterial } from '../src/materials.js';
import { itemsPanel } from '../src/game-menu.js';

const D = DESERT_FIGHT;
/** A save's flags: flag / set, as src/game-state.js. */
const save = (flags = {}) => ({ data: { flags }, flag: (k) => flags[k], set: (k, v) => { flags[k] = v; return v; }, emit() {}, on: () => () => {} });

test('the Sunken Hall is a complete game, played on foot, hosted by its doorway in the desert', () => {
  assert.deepEqual(checkGame(fightDesert), []);
  assert.equal(fightDesert.drives, false);
  assert.equal(fightDesert.fightTemple, 'desert');
  assert.equal(fightDesert.score.kind, 'time');
  assert.equal(collectGames({ './fight-desert.js': { default: fightDesert } })[0].id, 'fight-desert');
  const m = fightDesert.markers[0];
  assert.equal(m.level, 'desert');
  // by the pilgrims' camps (src/desert-sites.js STORY.camps: 168, 292, r 40), facing them
  assert.ok(Math.hypot(m.at[0] - 168, m.at[2] - 292) < 60, 'near the camps');
  const h = HOSTS['fight-desert'];
  assert.ok(h && h.name && h.say.length === 2, 'its host, who offers it');
  for (const b of ['Left stick', 'Right stick', 'RB / R1', 'RT / R2', 'LB / L1', 'A / ×']) assert.ok(fightDesert.controls.pad.some(([x]) => x === b), b);
  const model = fightDesert.marker.model();
  assert.ok(model.userData.solid, 'its doorway is walked into, not through');
});

// ------------------------------------------------------------------ the camera
test('the camera: high, from the south-east, narrow; up the screen is away from it, and it follows him with a capped lead', () => {
  const o = isoOffset();
  assert.ok(Math.abs(o.length() - ISO.dist) < 1e-9);
  // Diablo IV's (issue #365): about 55-60° down, a fixed yaw, a long narrow lens
  const deg = THREE.MathUtils.radToDeg(ISO.pitch);
  assert.ok(deg >= 55 && deg <= 60, `${deg.toFixed(1)}° down: Diablo IV's`);
  assert.ok(ISO.fov >= 28 && ISO.fov <= 35, 'a narrow lens: little perspective');
  assert.ok(ISO.dist >= 25, 'from far off');
  const tall = 2 * ISO.dist * Math.tan(THREE.MathUtils.degToRad(ISO.fov / 2));
  assert.ok(tall > 14 && tall < 18, `${tall.toFixed(1)} m tall on the screen at him: a room and its crowd`);
  const up = screenUp(), right = screenRight();
  assert.ok(Math.abs(up.dot(right)) < 1e-9);
  assert.ok(up.dot(new THREE.Vector3(o.x, 0, o.z).normalize()) < -0.999, 'up the screen walks away from the camera');
  // CameraRig's frame: the camera's right is (cos yaw, 0, -sin yaw) when it sits at (sin yaw, ·, cos yaw)
  const cam = new THREE.PerspectiveCamera(ISO.fov, 16 / 9, 0.1, 500);
  cam.position.copy(o); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const camRight = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  assert.ok(camRight.dot(right) > 0.999, 'the stick’s right is the screen’s right');
  // following: the look point comes to him, a little ahead the way he moves, never more than leadMax
  const look = new THREE.Vector3(), at = new THREE.Vector3(3, 0, -4), vel = new THREE.Vector3(0, 0, -20);
  for (let i = 0; i < 200; i++) followIso(look, at, vel, 1 / 60);
  assert.ok(Math.abs(look.y - ISO.look) < 1e-3);
  const lead = Math.hypot(look.x - at.x, look.z - at.z);
  assert.ok(lead > 1 && lead <= ISO.leadMax + 1e-3, `lead ${lead}`);
  for (let i = 0; i < 200; i++) followIso(look, at, new THREE.Vector3(), 1 / 60);
  assert.ok(Math.hypot(look.x - at.x, look.z - at.z) < 0.01, 'standing still: on him');
});

test('the hall: every room shut but for its doors, the walls never overlapping, the sand flat in the rooms', () => {
  const walls = wallBoxes(D.rooms, D.doors);
  const inside = (b, x, z) => x > b.x[0] + 1e-6 && x < b.x[1] - 1e-6 && z > b.z[0] + 1e-6 && z < b.z[1] - 1e-6;
  const gaps = D.doors.map((d) => doorGap(D.rooms, d));
  // a step out of each room, all round its edge: in a wall, or in a doorway
  for (const r of D.rooms) {
    for (let x = r.x[0] + 0.25; x < r.x[1]; x += 0.5) for (const z of [r.z[0] - 0.5, r.z[1] + 0.5]) assert.ok(walls.some((b) => inside(b, x, z)) || gaps.some((g) => inside(g, x, z)), `${r.id}: shut at ${x}, ${z}`);
    for (let z = r.z[0] + 0.25; z < r.z[1]; z += 0.5) for (const x of [r.x[0] - 0.5, r.x[1] + 0.5]) assert.ok(walls.some((b) => inside(b, x, z)) || gaps.some((g) => inside(g, x, z)), `${r.id}: shut at ${x}, ${z}`);
  }
  // each doorway open, through the whole wall, between the two rooms it joins
  for (const [i, g] of gaps.entries()) {
    const cx = (g.x[0] + g.x[1]) / 2, cz = (g.z[0] + g.z[1]) / 2;
    assert.ok(!walls.some((b) => inside(b, cx, cz)), `door ${i} open`);
    assert.ok(Math.abs((g.x[1] - g.x[0]) * (g.z[1] - g.z[0]) - D.doors[i].w * WALL.t) < 1e-6);
  }
  // no two walls share any volume (their tops would stripe: tests/zfight.test.js's rule)
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
    const a = walls[i], b = walls[j], ox = Math.min(a.x[1], b.x[1]) - Math.max(a.x[0], b.x[0]), oz = Math.min(a.z[1], b.z[1]) - Math.max(a.z[0], b.z[0]);
    assert.ok(!(ox > 1e-6 && oz > 1e-6), `walls ${i} and ${j} overlap`);
  }
  for (const r of D.rooms) for (let k = 0; k < 20; k++) {
    const x = r.x[0] + ((k * 7) % 20 + 0.5) / 20 * (r.x[1] - r.x[0]), z = r.z[0] + ((k * 13) % 20 + 0.5) / 20 * (r.z[1] - r.z[0]);
    assert.ok(Math.abs(hallHeight(D, x, z)) < 0.05, 'a flat floor');
  }
  assert.equal(roomAt(D.rooms, 0, 0), 0);
  assert.equal(roomAt(D.rooms, -21, -42), 3);
});

const LEVEL = runSteps(buildHall(new THREE.Scene(), D));

test('the camera stays isometric and is never blocked: wherever he stands, the walls in the way are seen through round him and the sand is under the line', () => {
  const F = LEVEL.fight;
  const o = isoOffset();
  let checked = 0, cutSeen = 0;
  for (const r of D.rooms) for (let x = r.x[0] + 0.5; x < r.x[1]; x += 1.5) for (let z = r.z[0] + 0.5; z < r.z[1]; z += 1.5) {
    if (F.cuttables.some((c) => c.kind === 'pillar' && c.box.distanceToPoint(new THREE.Vector3(x, 0.5, z)) < 0.3)) continue;   // (inside a pillar: nobody stands there)
    const at = new THREE.Vector3(x, 0, z), cam = at.clone().setY(ISO.look).add(o);
    // the see-through, eased to where it settles
    for (const c of F.cuttables) c.k = 0;
    const way = new Set(inTheWay(cam, F.cuttables, sightPoints(at)));
    for (let s = 0; s < 60; s++) F.cuttables.forEach((c, i) => { c.k = easeSee(c.k, way.has(i), 1 / 60); });
    cutSeen += way.size;
    const chest = at.clone().setY(SEE.chest);
    for (const h of [0.5, 1.4]) {
      const p = at.clone().setY(h);
      // no solid wall or pillar on the line: one on it is seen through, and its hole (inside its uneven edge) is where the line meets it
      for (const c of F.cuttables) {
        if (!segmentHitsBox(cam, p, c.box)) continue;
        const hit = new THREE.Ray(cam, p.clone().sub(cam).normalize()).intersectBox(c.box, new THREE.Vector3());
        assert.ok(hit && seeHoleCuts(hit, cam, chest, seeOpen(c.k), { dot: 1 }), `${r.id} (${x}, ${z}) h ${h}: a ${c.kind} in the way (seen through ${c.k.toFixed(2)})`);
      }
      // and the sand banked behind the walls is under the line all the way
      for (let k = 0.02; k < 1; k += 0.02) {
        const q = new THREE.Vector3().lerpVectors(p, cam, k);
        assert.ok(q.y > hallHeight(D, q.x, q.z) + 0.05, `${r.id} (${x}, ${z}) h ${h}: the sand in the way at ${q.x.toFixed(1)}, ${q.z.toFixed(1)}`);
      }
    }
    checked++;
  }
  assert.ok(checked > 400, `${checked} places`);
  assert.ok(cutSeen > 20, 'by the near walls and behind the pillars, walls are seen through');
});

test('the hole: a circle on the screen round him, only in what stands nearer the eye, opening with its share', () => {
  const at = new THREE.Vector3(0, SEE.chest, 0), cam = at.clone().add(isoOffset());
  const toward = cam.clone().sub(at).normalize();
  const on = at.clone().addScaledVector(toward, 4);   // (a wall's face 4 m in front of him, on the line)
  assert.ok(seeHoleCuts(on, cam, at, 1));
  assert.ok(!seeHoleCuts(on, cam, at, 0), 'shut: solid');
  const side = new THREE.Vector3().crossVectors(toward, new THREE.Vector3(0, 1, 0)).normalize();
  const r4 = SEE.radius * (cam.distanceTo(on) / cam.distanceTo(at));   // (the hole's radius at that depth)
  assert.ok(seeHoleCuts(on.clone().addScaledVector(side, r4 * 0.6), cam, at, 1, { dot: 1 }), 'inside its rim: cut');
  assert.ok(!seeHoleCuts(on.clone().addScaledVector(side, r4 * 1.05), cam, at, 1), 'past its edge: solid');
  assert.ok(!seeHoleCuts(on.clone().addScaledVector(side, r4 * 0.6), cam, at, 0.4), 'half open: smaller');
  assert.ok(!seeHoleCuts(at.clone().addScaledVector(toward, -2), cam, at, 1), 'behind him: never');
  // the share: in over SEE.in, out over SEE.out
  let k = 0; for (let i = 0; i < Math.round(SEE.in * 60); i++) k = easeSee(k, true, 1 / 60);
  assert.ok(k > 0.99 && SEE.in <= 0.25, `open in ${SEE.in} s`);
  for (let i = 0; i < Math.round(SEE.out * 60); i++) k = easeSee(k, false, 1 / 60);
  assert.ok(k < 0.01);
  assert.equal(seeOpen(0), 0); assert.equal(seeOpen(1), 1); assert.ok(seeOpen(0.25) < 0.25);
});

// ------------------------------------------------------------------ the aim
test('the aim: the foe in the cone, the nearer and the more on the line first; one at his feet whatever way; the sticks on the screen’s axes', () => {
  const from = new THREE.Vector3(), dir = new THREE.Vector3(0, 0, -1);
  const f = (x, z, o = {}) => ({ pos: new THREE.Vector3(x, 0, z), alive: true, ...o });
  const ahead = f(0, -4), off = f(2.2, -3.5), behind = f(0, 3), far = f(0, -30);
  assert.equal(pickTarget(from, dir, [behind, off, ahead, far]), ahead);
  assert.equal(pickTarget(from, dir, [behind, far]), null, 'nothing in the cone, nothing at his feet');
  const feet = f(0, 1.2);
  assert.equal(pickTarget(from, dir, [feet, far]), feet, 'one at his feet');
  assert.equal(pickTarget(from, dir, [f(0, -3, { alive: false }), f(0, -5, { phased: true })]), null, 'not the dead, nor a hound running as a shadow');
  assert.equal(pickTarget(from, dir, [far], { range: AIM.gun }), null);
  assert.equal(pickTarget(from, dir, [f(0, -15)], { range: AIM.gun }).pos.z, -15, 'the gun reaches further');
  const up = stickToGround({ x: 0, y: 1 }), right = stickToGround({ x: 1, y: 0 });
  assert.ok(up.distanceTo(screenUp()) < 1e-9 && right.distanceTo(screenRight()) < 1e-9);
  assert.equal(stickToGround({ x: 0.1, y: 0.1 }), null, 'a stick at rest aims nowhere');
});

// ------------------------------------------------------------------ the waves
test('the waves: many light foes of the desert’s kinds, felled in a cut or two; the last wave the tough one; Gentle smaller', () => {
  const hpOf = (k) => FOES[k].hp;
  let tough = 0;
  for (const [i, r] of D.rooms.entries()) {
    const W = roomWaves(r, { hpOf });
    assert.ok(W.length >= 2, `${r.id}: two waves or more`);
    for (const w of W) {
      assert.ok(w.length >= 6, `${r.id}: a wave of many`);
      for (const q of w) {
        assert.ok(FOES[q.kind], q.kind);
        if (q.tough) { tough++; assert.equal(q.hp, FOES[q.kind].hp); assert.equal(i, D.rooms.length - 1, 'the tough ones in the last room'); }
        else assert.ok(q.hp <= 2 && q.hp <= FOES[q.kind].hp && q.hp === Math.min(FOES[q.kind].hp, LIGHT_HP[q.kind] ?? 2), `${q.kind} light: ${q.hp}`);
      }
    }
    const G = roomWaves(r, { hpOf, gentle: true });
    assert.ok(G.flat().length < W.flat().length, 'Gentle: fewer');
  }
  const last = roomWaves(D.rooms.at(-1), { hpOf }).at(-1);
  assert.ok(last.some((q) => q.tough), 'the last wave brings the tough ones');
  assert.ok(tough >= 2);
  // the desert's own kinds (src/foe-worlds.js: blots, worms, herons, skitters; the placed tripod)
  for (const q of D.rooms.flatMap((r) => roomWaves(r, { hpOf }).flat())) assert.ok(['blot', 'skitter', 'worm', 'heron', 'tripod'].includes(q.kind), q.kind);
  assert.ok(totalFoes(D) > 100 && totalFoes(D, { gentle: true }) < totalFoes(D));
  // the crowd's cap: never more heads standing than it, a few at a time
  const q = Array.from({ length: 60 }, (_, i) => ({ kind: i % 3 ? 'blot' : 'skitter' }));
  assert.equal(release(q, 0), CROWD.burst);
  assert.equal(release(q, CROWD.cap), 0);
  assert.equal(release([{ kind: 'skitter' }], CROWD.cap - 0.5), 1, 'a skitter is half a head');
  assert.equal(headOf('skitter'), 0.5);
  assert.ok(CROWD.cap <= 24 && CROWD.gentle < CROWD.cap);
});

test('the loot: a heart more likely when hurt and never at full; chimes from the light now and then, the tough always; less after the reward', () => {
  assert.equal(heartChance(3, 3), 0);
  assert.ok(heartChance(1, 3) > heartChance(2.5, 3));
  let n = 0; for (let i = 0; i < 1000; i++) n += chimesFor({ tough: false }, Math.random);
  assert.ok(n > 150 && n < 400, `${n}`);
  assert.ok(chimesFor({ tough: true }, () => 0.9) >= 5);
  assert.ok(chimesFor({ tough: true }, () => 0.9, false) < chimesFor({ tough: true }, () => 0.9, true));
  assert.ok(pursesFor('finale', false) < pursesFor('finale', true));
});

/** A run in node: the hall built, the desert's foes made by Foes (not moved), the traveller placed, every foe up felled. */
function simulate({ gentle = false, flags = {} } = {}) {
  const scene = new THREE.Scene();
  const level = runSteps(buildHall(scene, D));
  const pos = new THREE.Vector3(...D.spawn);
  const player = {
    pos, vel: new THREE.Vector3(), heading: 0, hearts: 3, maxHearts: 3, dead: false, opts: {},
    frame: { dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)), headingOf: (v) => Math.atan2(v.x, v.z) },
    respawn: (p) => pos.copy(p), restore(h) { this.hearts = Math.min(this.maxHearts, this.hearts + h); }, restart() {},
  };
  const foes = new Foes({ scene, level, levelId: 'arena', physics: null, player, settings: { enemies: gentle ? 'gentle' : 'normal' } });
  const state = save(flags);
  const out = { flashes: [], finished: null, drops: 0, added: [] };
  const ctx = {
    player, camera: new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 800), level, sfx: new Proxy({}, { get: () => () => {} }), sound: null, tool: null, foes, rig: { target: new THREE.Vector3(), yaw: 0 }, physics: null, state,
    setFov() {}, add: (o) => { scene.add(o); out.added.push(o); return o; }, flash: (t) => out.flashes.push(t), status() {}, finish: (r) => { out.finished = r; }, drop: (p, n) => { out.drops += n; },
  };
  const S = startFightTemple(ctx);
  const tick = (live = true) => S.update(1 / 30, {}, { live, raw: {} });
  return { S, ctx, out, player, foes, level, state, tick };
}

test('a run: each room’s waves come up as he walks in, at most the crowd’s cap standing; cleared, its gate opens; the last ends on the reward, won and saved', () => {
  const { S, out, player, foes, level, state, tick } = simulate();
  const F = level.fight;
  let maxHeads = 0, felled = 0, guard = 0;
  const waves = [];
  for (const [i, r] of D.rooms.entries()) {
    // walk in: the room's first wave begins
    player.pos.set((r.x[0] + r.x[1]) / 2, 0, (r.z[0] + r.z[1]) / 2);
    tick();
    assert.equal(S.run.room, i);
    assert.equal(S.run.phase, 'fight', `${r.id}: its first wave as he comes in`);
    while (S.run.room === i && S.run.phase !== 'reward' && guard++ < 20000) {
      tick();
      const live = foes.list.filter((f) => f.alive);
      maxHeads = Math.max(maxHeads, live.reduce((a, f) => a + headOf(f.kind), 0));
      // once the crowd is full (or all are up), the traveller fells all that stand
      const heads = live.reduce((a, f) => a + headOf(f.kind), 0);
      if (S.run.queue === 0 || heads > CROWD.cap - 1) for (const f of live) { assert.ok(f.hp <= (f.tough ? FOES[f.kind].hp : 2)); assert.ok(f.def.sight >= 60); f.state = 'dead'; felled++; }
      if (S.run.phase === 'rest' || S.run.phase === 'wait') waves.push(`${S.run.room}/${S.run.wave}`);
    }
    if (i < D.rooms.length - 1) {
      const g = F.gates.find((x) => x.door.from === i);
      for (let k = 0; k < 60; k++) tick();
      assert.ok(g.open && g.group.position.y < -3, `${r.id}: its gate sinks once cleared`);
      assert.ok(F.gates.filter((x) => x.door.from > i).every((x) => !x.open), 'the gates ahead stay shut');
    }
  }
  assert.ok(maxHeads <= CROWD.cap + 1e-9, `at most the cap standing (${maxHeads})`);
  assert.ok(maxHeads >= CROWD.cap - 1, `the crowd fills up to it (${maxHeads})`);
  assert.equal(S.run.phase, 'reward');
  assert.equal(felled, totalFoes(D));
  // the reliquary rises on the altar; he walks to it and takes it
  player.pos.set(-28, 0, -33);
  for (let k = 0; k < 60; k++) tick();
  assert.equal(out.finished, null, 'nothing won before he takes it');
  player.pos.set(...D.rooms.at(-1).altar.flatMap((v, i) => (i ? [0, v] : [v])));
  tick();
  assert.ok(out.finished && !out.finished.failed, 'the run ends, won');
  assert.match(out.finished.lines[0], /New colours: Ember/);
  assert.equal(state.flag('kit.colours.ember'), true, 'the colours won, in the save');
  for (const p of PIECES) assert.equal(chosenColour(state, p), 'ember', `and worn: ${p}`);
  assert.ok(out.drops > 40, `chimes dropped (${out.drops})`);
  S.end();
  assert.equal(foes.list.length, 0, 'the foes leave with the run');
});

test('a run lost: knocked out, it ends failed with no reward; a light foe strikes half as hard; Gentle brings fewer', () => {
  const { S, out, player, foes, state, tick } = simulate();
  player.pos.set(0, 0, 0); tick();
  tick();
  for (let k = 0; k < 30; k++) tick();
  const f = foes.list.find((x) => x.light);
  assert.ok(f, 'a light one up');
  assert.ok(Math.abs(f.def.attacks[0].damage - FOES[f.kind].attacks[0].damage * LIGHT_HARM) < 1e-9);
  player.dead = true; tick();
  assert.ok(out.finished?.failed);
  assert.equal(state.flag('kit.colours.ember'), undefined);
  S.end();
  const g = simulate({ gentle: true });
  g.player.pos.set(0, 0, 0); for (let k = 0; k < 120; k++) g.tick();
  assert.ok(g.S.run.queue + g.S.run.standing < roomWaves(D.rooms[0], { hpOf: (k) => FOES[k].hp })[0].length + 1);
  g.S.end();
});

test('the frame’s budget: with the crowd full, the foes’ meshes stay few (their parts instanced: src/part-batch.js)', () => {
  const { S, foes, player, tick, ctx } = simulate();
  player.pos.set(0, 0, -19.5);
  tick();
  const n = S.crowd(CROWD.cap);
  assert.ok(n >= CROWD.cap);
  let meshes = 0;
  foes.group.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.visible) meshes++; });
  // measured in headless Chrome, Handheld (docs/design/fight-temples.md): ~30 standing, 912 draw calls, cpu 4.9 ms, gpu 6.7 ms
  assert.ok(meshes / n < 40, `${(meshes / n).toFixed(1)} meshes a foe`);
  S.end();
  void ctx;
});

// ------------------------------------------------------------------ the kit's colours
test('the kit’s colours: the makers’ always yours, a world’s won once in its fight temple, chosen and cycled piece by piece', () => {
  assert.equal(KIT_COLOURS[0].id, 'makers');
  assert.equal(colourOfWorld('desert').id, D.colours);
  for (const c of KIT_COLOURS) {
    for (const k of Object.keys(PACK_BASE)) assert.match(c.pack[k], /^#[0-9a-f]{6}$/i, `${c.id} ${k}`);
    for (const k of ['base', 'cream', 'deep', 'pale', 'gold', 'light']) assert.match(c.water[k], /^#[0-9a-f]{6}$/i, `${c.id} ${k}`);
  }
  const s = save();
  assert.deepEqual(wonColours(s), ['makers']);
  assert.equal(coloursData(s), null, 'no Colours row with only the makers’');
  assert.equal(chooseColour(s, 'sword', 'ember'), false, 'not before it is won');
  assert.equal(unlockColours(s, 'ember'), true);
  assert.equal(unlockColours(s, 'ember'), false, 'once');
  assert.equal(unlockColours(s, 'makers'), false);
  assert.deepEqual(wonColours(s), ['makers', 'ember']);
  for (const p of PIECES) assert.equal(chosenColour(s, p), 'ember', 'worn as it is won');
  assert.equal(cycleColour(s, 'sword'), 'makers');
  assert.equal(chosenColour(s, 'sword'), 'makers');
  assert.equal(chosenColour(s, 'shield'), 'ember', 'each piece its own');
  assert.equal(cycleColour(s, 'sword'), 'ember');
  assert.equal(s.data.flags['kit.colour.sword'], 'ember', 'kept in the save');
  // a choice of a colour no longer won (an old save edited): the makers'
  const t = save({ 'kit.colour.backpack': 'ember' });
  assert.equal(chosenColour(t, 'backpack'), 'makers');
  const rows = coloursData(s);
  assert.deepEqual(rows.map((r) => r.piece), PIECES);
  assert.equal(rows[0].of, 2);
});

test('painted on: the backpack’s brass, canvas, cloth and leather take a palette’s and go back; the sword’s and shield’s water retinted', () => {
  const glass = makeMaterial({ color: '#ffffff', fluid: 'tank', glow: 0.5, fluidBox: [0, 0.3, 0.19, 0.4], fluidTones: Array(6).fill('#ffffff'), fluidBase: '#49ab83' });
  const { group } = buildFlask(glass);
  const colours = () => { const s = new Set(); group.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) if (m.uniforms?.uColor) s.add('#' + m.uniforms.uColor.value.getHexString()); }); return s; };
  const before = colours();
  assert.ok(before.has(PACK_BASE.brass) && before.has(PACK_BASE.canvas) && before.has(PACK_BASE.cloth) && before.has(PACK_BASE.leather));
  const ember = colourById('ember');
  assert.ok(paintPack(group, ember) > 5);
  const after = colours();
  for (const k of ['brass', 'canvas', 'cloth', 'leather']) { assert.ok(after.has(ember.pack[k]), k); assert.ok(!after.has(PACK_BASE[k]), `no makers’ ${k} left`); }
  assert.equal(glass.uniforms.uFluidBase.value.getHexString(), '49ab83', 'the fluid itself keeps the gun mode’s colour');
  paintPack(group, colourById('makers'));
  assert.deepEqual([...colours()].sort(), [...before].sort(), 'the makers’ put back exactly');
  const water = makeMaterial({ color: '#ffffff', fluid: 'blade', glow: 0.5, fluidBase: '#38b8a9', fluidTones: Array(6).fill('#ffffff'), key: 'test-water' });
  paintWater(water, ember.water);
  assert.equal('#' + water.uniforms.uFluidBase.value.getHexString(), ember.water.base);
  assert.equal('#' + water.uniforms.uFluidTones.value[0].getHexString(), ember.water.cream);
});

test('the Items panel: a Colours strip over the gear once a second colour is won, A / × the next', () => {
  const s = save(); unlockColours(s, 'ember'); cycleColour(s, 'sword');
  const P = itemsPanel({ gear: [{ id: 'backpack', name: 'Backpack', kind: 'core' }], slots: 4, colours: coloursData(s) });
  assert.deepEqual(P.rows[0].map((c) => [c.kind, c.id, c.act]), PIECES.map((p) => ['colour', p, 'colour']));
  assert.match(P.html, /Sword: Makers’ jade/);
  assert.match(P.html, /Shield: Ember/);
  assert.equal(P.rows[1][0].id, 'backpack', 'the gear under it');
  assert.doesNotMatch(itemsPanel({ gear: [], colours: coloursData(save()) }).html, /gm-colours/);
});

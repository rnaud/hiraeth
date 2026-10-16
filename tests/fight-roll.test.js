// The fight temples' own moves (issue #365; src/fight-temples/session.js, src/fluid-blade.js ROLL and WIDE_CUT): B / ○
// (Alt, the touch ↶) makes a dodge roll there (a burst along the stick or the way he faces, i-frames, a cooldown, a
// tucked roll), jumping is disabled, the evade untouched everywhere else; the blade's cut takes every foe the drawn crescent
// covers (#368: drawn, its reach brought down to the sword's look), and none behind a wall; the walls in the camera's way seen through while the others stay solid.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { FluidTool } from '../src/fluid-tool.js';
import { EVADE, ROLL, WIDE_CUT, CHARGE, iframeWindow, sweepSpan, underSweep, wideSweep } from '../src/fluid-blade.js';
import { slashBand } from '../src/slash-arc.js';
import { ROLL_FLIP, flipAngle } from '../src/jump.js';
import { clearTargets, registerTarget } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { DESERT_FIGHT } from '../src/fight-temples/desert.js';
import { buildHall } from '../src/fight-temples/rooms.js';
import { startFightTemple } from '../src/fight-temples/session.js';
import { fightTempleGame } from '../src/fight-temples/index.js';
import { SEE, inTheWay, sightPoints } from '../src/fight-temples/rules.js';
import { SEE_HOLE } from '../src/materials.js';
import { runSteps } from '../src/load-steps.js';

items.grant('backpack');
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;

/** A stand-in traveller (as tests/evade-iframes.test.js's), facing +z. */
function player(at = v()) {
  const frame = { up: v(0, 1, 0), fwd: v(0, 0, 1), right: v(1, 0, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)), headingOf: (d) => Math.atan2(d.x, d.z), quaternion: (h, q) => q };
  return { pos: at, vel: v(), heading: 0, frame, vehicles: [], object: { visible: true }, ride: null, onGround: true, aim: null, opts: {}, health: 1, down: null, dead: false,
    hearts: 3, maxHearts: 3, hurts: [], flinch() {}, hurt(a) { this.hurts.push(a); }, knockDown() { return true; }, respawn() {}, restore() {}, restart() {} };
}
/** The tool and the blade, a wall (a box: its line-of-sight ray stops on it) if given. */
function setup({ wall = null } = {}) {
  clearTargets();
  const ray = new THREE.Ray();
  const physics = { groundAt: () => 0, rayHit: () => null, rayDistance: (o, d, far) => { if (!wall) return Infinity; ray.set(o, d); const h = ray.intersectBox(wall, v()); return h ? Math.min(far, o.distanceTo(h)) : Infinity; } };
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.6, -3); camera.lookAt(0, 1.6, 10); camera.updateMatrixWorld();
  const P = player();
  const tool = new FluidTool({ scene: new THREE.Scene(), player: P, physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500) }, levelId: 'arena', physics, player: P, tool, settings: { enemies: true }, game: new GameState(null) });
  const B = tool.blade;
  const rest = () => { for (let i = 0; i < 1.5 / DT; i++) tool.update(DT, {}); P.pos.set(0, 0, 0); P.vel.set(0, 0, 0); };
  return { P, tool, foes, B, physics, rest };
}
const slam = () => { for (const [kind, d] of Object.entries(FOES)) { const a = d.attacks?.find((x) => x.id === 'slam'); if (a) return { kind, a }; } throw new Error('slam'); };

test('the roll: a press of the evade rolls forward (the way he faces, or along the stick), longer and further than the evade, tucked head over heels', () => {
  const { P, tool, B, rest } = setup();
  B.roll = ROLL;
  rest();
  tool.update(DT, { AltLeft: true });
  assert.ok(B.rolling != null && B.rolling < 0.02, 'rolling');
  assert.ok(B.evadeDir.distanceTo(v(0, 0, 1)) < 1e-6, 'standing still: the way he faces, not a backstep');
  assert.ok(B.dir.distanceTo(v(0, 0, 1)) < 1e-6, 'he faces the way he rolls');
  let dist = 0, frames = 1, peak = 0;
  while (B.evadeT > 0 && frames < 100) {
    const C = P.combatMotion;
    assert.ok(C && C.evade && C.roll != null && C.roll >= 0 && C.roll <= ROLL.duration, 'the player rolls (combatMotion.roll: s into it)');
    dist += C.speed * DT; peak = Math.max(peak, C.speed);
    tool.update(DT, {}); frames++;
  }
  assert.ok(Math.abs(frames * DT - ROLL.duration) < 2.5 * DT, `${(frames * DT).toFixed(2)} s`);
  assert.ok(dist > 2.8 && dist < 4.5, `${dist.toFixed(2)} m: a short burst`);
  assert.ok(dist > EVADE.speed * EVADE.duration * 0.8, 'further than the evade');
  assert.equal(B.rolling, null, 'over');
  // along the stick: his move's way
  rest();
  P._moveDir = v(1, 0, 0);
  tool.update(DT, { AltLeft: true });
  assert.ok(B.evadeDir.distanceTo(v(1, 0, 0)) < 1e-6, 'along the stick');
  P._moveDir = null;
  // the pose: a whole turn over its length, tucked, round a low pivot
  assert.equal(ROLL_FLIP.time, ROLL.duration);
  assert.ok(Math.abs(flipAngle(ROLL.duration, ROLL_FLIP) - Math.PI * 2) < 1e-6 && Math.abs(flipAngle(ROLL.duration / 2, ROLL_FLIP) - Math.PI) < 1e-6);
  assert.ok(ROLL_FLIP.pivot < 0.8 && ROLL_FLIP.tuck.torso > 0.5, 'rolled along the floor, the back rounded');
  tool.dispose?.(); clearTargets();
});

test('the roll\'s i-frames: a blow inside the window misses, outside it lands; a short cooldown between rolls', () => {
  const { P, tool, foes, B, rest } = setup();
  B.roll = ROLL;
  const { kind, a } = slam();
  const f = foes.add(kind, v(0, 0, 1.5));
  const [w0, w1] = iframeWindow(false, ROLL);
  assert.ok(w1 - w0 > iframeWindow()[1] - iframeWindow()[0], 'a longer window than the evade (the roll is longer)');
  assert.ok(w1 <= ROLL.duration && (w1 - w0) / ROLL.cooldown < 0.45, 'under half the time even rolling back to back');
  for (let frames = 0; frames <= 26; frames += 2) {
    rest();
    tool.update(DT, { AltLeft: true });
    for (let i = 0; i < frames; i++) tool.update(DT, {});
    P.pos.set(0, 0, 0);
    const age = B.evadeAge, inside = B.evadeT > 0 && age >= w0 && age < w1;
    const before = P.hurts.length;
    assert.equal(foes.strike(f, a), !inside, `${(age * 1000).toFixed(0)} ms into the roll: ${inside ? 'swallowed' : 'lands'}`);
    assert.equal(P.hurts.length - before, inside ? 0 : 1);
  }
  // the cooldown: a second press before it is over does nothing; after it, a roll
  rest();
  tool.update(DT, { AltLeft: true });
  for (let i = 0; i < Math.round((ROLL.duration + 0.05) / DT); i++) tool.update(DT, {});
  assert.equal(B.evadeT, 0);
  tool.update(DT, { AltLeft: true });
  assert.equal(B.rolling, null, 'too soon: no roll');
  for (let i = 0; i < Math.round(ROLL.cooldown / DT); i++) tool.update(DT, {});
  tool.update(DT, { AltLeft: true });
  assert.ok(B.rolling != null, 'after the cooldown: a roll');
  assert.ok(ROLL.cooldown - ROLL.duration < 0.45, 'a short cooldown');
  tool.dispose?.(); clearTargets();
});

test('outside the fight temples the evade is as it was: a short backstep, its own window', () => {
  const { P, tool, B, rest } = setup();
  assert.equal(B.roll, null);
  rest();
  tool.update(DT, { AltLeft: true });
  assert.equal(B.rolling, null, 'no roll');
  assert.ok(Math.abs(B.evadeT - (EVADE.duration - DT)) < 1e-9 || Math.abs(B.evadeT - EVADE.duration) < 1e-9);
  assert.ok(B.evadeDir.distanceTo(v(0, 0, -1)) < 1e-6, 'standing still: a backstep');
  assert.equal(P.combatMotion?.roll ?? null, null);
  tool.dispose?.(); clearTargets();
});

test('the generous cut (#368): what the drawn crescent covers is what it cuts, as it reaches it; past its edge, behind a wall, behind him: nothing', () => {
  // a swing with foes (bodies `radius` round) at flat [x, z] off him (he faces +z); the hits in order, the crescent's state at each
  const swing = (wide, at, { wall = null, radius = 0.5 } = {}) => {
    const { tool, B } = setup({ wall });
    B.wide = wide;
    const hits = [], seen = [];
    at.forEach(([x, z], i) => registerTarget({ kind: 'foe', accepts: ['blade'], radius, position: () => v(x, 1, z), onHit: () => { hits.push(i); seen.push(B.slash && { ...B.slash, span: sweepSpan(B.slash.sweep, B.slash.u) }); } }));
    let arc = null;
    for (let i = 0; i < 90; i++) { tool.update(DT, i < 3 ? { KeyF: true } : {}); if (B.arc?.drawn) arc = { pos: Float32Array.from(B.arc.pos), drawn: B.arc.drawn }; }
    tool.dispose?.(); clearTargets();
    return { hits, seen, arc };
  };
  const R = WIDE_CUT.reach, S0 = WIDE_CUT.sweeps[0], r = 0.5;
  assert.ok(R > 2.2 && R < 3.0, `a reach to the sword's look (${R} m; v1.77 3.9 from the chest)`);
  assert.ok(Math.max(Math.abs(S0.from), Math.abs(S0.to)) < 1.35, 'a sweep narrower than v1.77\'s 1.5 rad either side');
  // ahead: its body just inside the crescent's edge is cut, just past it is not
  const ahead = (d) => [[0, d]];
  assert.deepEqual(swing(WIDE_CUT, ahead(R + r - 0.1)).hits, [0], 'at the edge: cut');
  assert.deepEqual(swing(WIDE_CUT, ahead(R + r + 0.15)).hits, [], 'just past the edge: not');
  // the first swing sweeps from his right to his left: the one on his right falls first; each when the crescent has reached it
  const side = 1.0, d = 2.2, right = [-Math.sin(side) * d, Math.cos(side) * d], left = [Math.sin(side) * d, Math.cos(side) * d];
  const s = swing(WIDE_CUT, [left, right]);
  assert.deepEqual(s.hits, [1, 0], `right first, then left (${s.hits})`);
  for (const [k, i] of s.hits.entries()) {
    const [x, z] = [left, right][i], S = s.seen[k];
    assert.ok(S && underSweep(x, z, r, v(0, 0, 1), S.span, S.reach), 'under the crescent laid so far when it fell');
  }
  // outside the sweep's angle (past its far end by more than its body takes up), behind a wall, behind him: safe
  const past = S0.to + Math.asin(r / d) + 0.25;
  assert.deepEqual(swing(WIDE_CUT, [[Math.sin(past) * d, Math.cos(past) * d]]).hits, [], 'past the sweep\'s end');
  const wall = new THREE.Box3(v(-3, 0, 1.8), v(3, 3.4, 2.2));
  assert.deepEqual(swing(WIDE_CUT, [[0, 2.9], [0, 1.2]], { wall }).hits, [1], 'not through the wall');
  assert.deepEqual(swing(WIDE_CUT, [[0, -2]]).hits, [], 'not behind him');
  // the crescent as drawn: its outer edge the reach, exactly, round him
  const { arc } = swing(WIDE_CUT, ahead(R + r - 0.1));
  assert.ok(arc, 'drawn');
  const P = arc.pos, outer = [];
  for (let i = 0; i < P.length / 6; i++) outer.push(Math.hypot(P[i * 6 + 3], P[i * 6 + 5]));
  assert.ok(outer.every((x) => Math.abs(x - R) < 1e-4), `its outer edge at the reach (${Math.min(...outer).toFixed(3)}..${Math.max(...outer).toFixed(3)})`);
  assert.equal(arc.drawn.reach, R);
  // a crescent's band: laid up to how far the cut has gone, nothing past it; thinning to its edge as it fades
  assert.equal(slashBand(0.6, 0.5, R), null);
  assert.equal(slashBand(0.5, 0.5, R)[1], R);
  assert.ok(slashBand(0.2, 1, R, 0.8)[0] > slashBand(0.2, 1, R, 0)[0], 'thinner as it fades');
  assert.equal(wideSweep(WIDE_CUT, 1), WIDE_CUT.sweeps[1]);
  assert.equal(wideSweep(WIDE_CUT, 0, CHARGE), WIDE_CUT.charge);
  assert.equal(wideSweep(null, 0), null);
});

/** The Sunken Hall's run in node with the real tool and blade (tests/fight-temples.test.js's simulate, with a tool). */
function hall() {
  const scene = new THREE.Scene();
  const level = runSteps(buildHall(scene, DESERT_FIGHT));
  const { P, tool, foes: _f } = setup();
  void _f;
  P.pos.set(...DESERT_FIGHT.spawn);
  const foes = new Foes({ scene, level, levelId: 'arena', physics: null, player: P, settings: { enemies: 'normal' } });
  const flags = {};
  const state = { data: { flags }, flag: (k) => flags[k], set: (k, x) => { flags[k] = x; return x; }, emit() {}, on: () => () => {} };
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 800);
  const ctx = {
    player: P, camera, level, sfx: new Proxy({}, { get: () => () => {} }), sound: null, tool, foes, rig: { target: v(), yaw: 0 }, physics: null, state,
    setFov() {}, add: (o) => { scene.add(o); return o; }, flash() {}, status() {}, finish() {}, drop() {},
  };
  const S = startFightTemple(ctx);
  return { S, P, tool, level, camera, tick: (n = 1) => { for (let i = 0; i < n; i++) S.update(DT, {}, { live: true, raw: {} }); } };
}

test('in the Sunken Hall: only B / ○ rolls (Alt, the touch ↶); A / × and Space cannot jump; all of it put back as he leaves', () => {
  const { S, tool, tick, P } = hall();
  tick();
  assert.equal(tool.blade.roll, ROLL);
  assert.equal(tool.blade.wide, WIDE_CUT);
  // Filter the keyboard, pad and touch jump (touch feeds Space) before movement reads them.
  for (const c of [{ Space: true }, { PadJump: true }, { Space: true, PadJump: true }]) {
    S.input(c);
    assert.equal(c.Space, false, 'keyboard and touch cannot jump');
    assert.equal(c.PadJump, false, 'the pad cannot jump');
    assert.ok(!c.PadEvade, 'and is never the roll\'s press');
  }
  // the jump does not roll; B / ○, Alt and the touch evade do
  const B = tool.blade;
  const settle = () => { for (let i = 0; i < 1.5 / DT; i++) tool.update(DT, {}); P.vel.set(0, 0, 0); };
  settle();
  tool.update(DT, { Space: true, PadJump: true });
  assert.equal(B.rolling, null, 'A / × or Space: no roll');
  for (const press of [{ PadEvade: true }, { AltLeft: true }, { TouchEvade: true }]) {
    settle();
    const c = { ...press, Space: true, PadJump: true };
    S.input(c);
    assert.equal(c[Object.keys(press)[0]], true, 'jump suppression preserves the roll');
    tool.update(DT, c);
    assert.ok(B.rolling != null && B.rolling < 0.02, `${Object.keys(press)[0]}: a roll`);
  }
  // The controls cards omit jump; the touch roll stays available.
  const game = fightTempleGame(DESERT_FIGHT);
  const row = (list, key) => list.find(([k]) => k === key)?.[1];
  assert.equal(row(game.controls.pad, 'B / ○'), 'roll');
  assert.equal(row(game.controls.pad, 'A / ×'), undefined);
  assert.equal(row(game.controls.keys, 'Alt'), 'roll');
  assert.equal(row(game.controls.keys, 'Space'), undefined);
  assert.equal(row(game.controls.touch, '↶'), 'roll');
  assert.equal(row(game.controls.touch, '⤒'), undefined);
  assert.ok(!game.touchButtons.includes('jump') && game.touchButtons.includes('evade'), 'only the touch roll button is shown');
  const plain = { KeyW: true };
  S.input?.(plain);
  assert.ok(!plain.PadEvade, 'nothing pressed, nothing rolls');
  S.end();
  assert.equal(tool.blade.roll, null, 'out of the hall: the evade again');
  assert.equal(tool.blade.wide, null);
  tool.dispose?.(); clearTargets();
});

test('in the Sunken Hall: the walls and pillars between the camera and him are seen through, the others stay solid; back once he moves off', () => {
  const { S, P, level, camera, tick, tool } = hall();
  const F = level.fight;
  // by the stair foot's south-east corner: its south and east walls stand between him and the camera
  P.pos.set(5.5, 0, 5.5);
  tick(Math.round(0.6 / DT));   // (the camera settles on him)
  const way = new Set(inTheWay(camera.position, F.cuttables, sightPoints(P.pos)));
  assert.ok(way.size >= 1 && way.size < F.cuttables.length / 3, `${way.size} in the way of ${F.cuttables.length}`);
  for (const [i, c] of F.cuttables.entries()) {
    const k = c.see.map((u) => u.value);
    assert.ok(c.see.length >= 2, 'its wall and its cap course (and the glyph band) fade together');
    if (way.has(i)) assert.ok(k.every((x) => x > 0.99), `${c.kind} ${i} in the way: seen through (${k})`);
    else assert.ok(k.every((x) => x === 0), `${c.kind} ${i}: solid`);
  }
  for (const c of F.cuttables) assert.equal(c.mesh.scale.y, 1, 'standing to their full height (no more cut down to a stub)');
  assert.ok(Math.abs(SEE_HOLE.value.x - P.pos.x) < 1e-9 && Math.abs(SEE_HOLE.value.y - SEE.chest) < 1e-9, 'the hole round his chest');
  for (const c of F.cuttables) assert.ok(c.mesh.material.defines?.SEE_HOLE, 'compiled with the hole');
  // smooth: half way in about half the time
  P.pos.set(0, 0, 0); tick(Math.round(0.6 / DT));
  P.pos.set(5.5, 0, 5.5);
  tick(Math.round(SEE.in / 2 / DT));
  const half = F.cuttables.filter((c, i) => way.has(i)).map((c) => c.k);
  assert.ok(half.every((k) => k > 0.3 && k < 0.7), `half way in: ${half.map((k) => k.toFixed(2))}`);
  // moved off into the room: back to solid
  P.pos.set(0, 0, -2);
  tick(Math.round((SEE.out + 0.6) / DT));
  const now = new Set(inTheWay(camera.position, F.cuttables, sightPoints(P.pos)));
  for (const [i, c] of F.cuttables.entries()) if (way.has(i) && !now.has(i)) assert.equal(c.see[0].value, 0, `${c.kind} ${i} solid again`);
  S.end();
  for (const c of F.cuttables) assert.equal(c.see[0].value, 0);
  tool.dispose?.(); clearTargets();
});

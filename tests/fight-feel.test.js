// The fight temples' feel (issue #442; src/fight-temples/rules.js rollInput, src/fluid-blade.js QUICK_CUT and
// rollCancels, src/fight-temples/hazards.js, src/fight-temples/kill-fx.js): the roll on the button printed B, whatever
// the pad's letters; a quicker combo in there only; the roll cutting a swing off in its wind-up or follow-through and
// waiting out its cut; the roll's i-frames taking him through every kind of hazard with the real blade; a kill thrown
// back, ringed, splashed and stained, the stain drying away, within a budget in a crowd.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { FluidTool } from '../src/fluid-tool.js';
import { ROLL, SWINGS, BLADE, QUICK_CUT, quickSwing, rollCancels, attackSample } from '../src/fluid-blade.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { rollInput, rollKey } from '../src/fight-temples/rules.js';
import { fightTempleGame } from '../src/fight-temples/index.js';
import { DESERT_FIGHT } from '../src/fight-temples/desert.js';
import { setFaces } from '../src/native-pad.js';
import { HAZARD, ON_LANES, LINGERING, lanePoint, laneLength, tileOf, inLight } from '../src/fight-temples/hazards.js';
import { buildHall } from '../src/fight-temples/rooms.js';
import { startFightTemple } from '../src/fight-temples/session.js';
import { KILL, KillFx, knockAt, splatAt, fullKill } from '../src/fight-temples/kill-fx.js';
import { runSteps } from '../src/load-steps.js';
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
import fightSpacecity from '../src/minigames/fight-spacecity.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

items.grant('backpack');
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;

/** A stand-in traveller (as tests/fight-roll.test.js's), facing +z. */
function player(at = v()) {
  const frame = { up: v(0, 1, 0), fwd: v(0, 0, 1), right: v(1, 0, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)), headingOf: (d) => Math.atan2(d.x, d.z), quaternion: (h, q) => q };
  return { pos: at, vel: v(), heading: 0, frame, vehicles: [], object: { visible: true }, ride: null, onGround: true, aim: null, opts: {}, health: 1, down: null, dead: false,
    hearts: 3, maxHearts: 3, hurts: [], flinch() {}, hurt(a, why) { this.hurts.push([why, a]); }, knockDown() { return true; }, respawn() {}, restore() {}, restart() {} };
}
function blade() {
  clearTargets();
  const physics = { groundAt: () => 0, rayHit: () => null, rayDistance: () => Infinity };
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.6, -3); camera.lookAt(0, 1.6, 10); camera.updateMatrixWorld();
  const P = player();
  const tool = new FluidTool({ scene: new THREE.Scene(), player: P, physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const B = tool.blade;
  const rest = () => { for (let i = 0; i < 1.5 / DT; i++) tool.update(DT, {}); P.pos.set(0, 0, 0); P.vel.set(0, 0, 0); };
  return { P, tool, B, rest };
}

test('the roll is on the button printed B: the right one on Xbox / PlayStation pads, the bottom one with Nintendo letters; A does nothing, nothing jumps', () => {
  // Xbox / PlayStation: B / ○ (PadEvade) rolls, A / × (PadJump) and Space are cleared
  assert.deepEqual(rollInput({ PadEvade: true, PadJump: false, Space: false }), { PadEvade: true, PadJump: false, Space: false });
  const a = rollInput({ PadJump: true, Space: true });
  assert.ok(!a.PadEvade && !a.PadJump && !a.Space, 'A / ×: no roll, no jump');
  // Nintendo letters (the Retroid, a Switch pad): B at the bottom (the jump's place) rolls, A on the right does nothing
  const nb = rollInput({ PadJump: true, Space: true }, 'nintendo');
  assert.ok(nb.PadEvade && !nb.PadJump && !nb.Space, 'printed B (bottom): a roll');
  const na = rollInput({ PadEvade: true }, 'nintendo');
  assert.ok(!na.PadEvade, 'printed A (right): nothing');
  // Alt and the touch roll are left alone
  const k = rollInput({ AltLeft: true, TouchEvade: true }, 'nintendo');
  assert.ok(k.AltLeft && k.TouchEvade);
  // the card names that button (in Xbox form, by position: the page then prints it as the pad's B)
  assert.equal(rollKey('xbox'), 'B / ○');
  assert.equal(rollKey('nintendo'), 'A / ×');
  const game = fightTempleGame(DESERT_FIGHT);
  const roll = () => game.controls.pad.find(([, w]) => w === 'roll')?.[0];
  assert.equal(roll(), 'B / ○');
  setFaces('nintendo');
  try { assert.equal(roll(), 'A / ×', 'Nintendo letters: the bottom button (printed B)'); } finally { setFaces('auto'); }
  assert.equal(roll(), 'B / ○');
});

test('the quick cut: the temples\' combo about a third quicker (wind-ups and follow-throughs most), the world\'s as it was', () => {
  const total = (S) => S.wind + S.active + S.recover;
  const was = SWINGS.reduce((a, S) => a + total(S), 0), now = SWINGS.reduce((a, S) => a + total(quickSwing(S, QUICK_CUT)), 0);
  assert.ok(now < was * 0.72 && now > was * 0.55, `the combo's swings ${was.toFixed(2)} → ${now.toFixed(2)} s`);
  for (const S of SWINGS) {
    const Q = quickSwing(S, QUICK_CUT);
    assert.ok(Q.wind < S.wind * 0.7 && Q.recover < S.recover * 0.6 && Q.active >= S.active * 0.85, 'the wind-up and follow-through cut most, the cut itself little');
    assert.equal(Q.clip, S.clip); assert.equal(Q.hit, S.hit);
    assert.equal(quickSwing(S, QUICK_CUT), Q, 'memoised');
    assert.ok(Q.wind >= 0.1, `a wind-up still seen (${Q.wind.toFixed(3)} s)`);
  }
  assert.equal(quickSwing(SWINGS[0], null), SWINGS[0]);
  // played: the first swing over in its quick time in the temples, its own elsewhere
  const swingTime = (quick) => {
    const { tool, B, rest } = blade();
    B.quick = quick; rest();
    tool.update(DT, { KeyF: true });
    let n = 1; while (B.swinging && n < 200) { tool.update(DT, {}); n++; }
    tool.dispose?.(); clearTargets();
    return n * DT;
  };
  assert.ok(Math.abs(swingTime(QUICK_CUT) - total(quickSwing(SWINGS[0], QUICK_CUT))) < 3 * DT);
  assert.ok(Math.abs(swingTime(null) - total(SWINGS[0])) < 3 * DT);
  assert.ok(BLADE.cooldown * QUICK_CUT.cooldown < BLADE.cooldown);
});

test('the roll cuts a swing off: at once in its wind-up or follow-through; pressed in the cut, it rolls as the cut ends; the evade elsewhere only from the follow-through', () => {
  assert.ok(rollCancels('wind') && rollCancels('recover') && rollCancels(null) && rollCancels('charge', true) && !rollCancels('strike'));
  // the swing's phase `at` s in, then the roll pressed: frames until it rolls (0: that frame), and whether the cut landed
  const rollAt = (phaseWanted, roll = ROLL) => {
    const { tool, B, rest } = blade();
    B.roll = roll; B.quick = QUICK_CUT; rest();
    tool.update(DT, { KeyF: true });
    let n = 0; while (B.phase !== phaseWanted && n < 100) { tool.update(DT, {}); n++; }
    assert.equal(B.phase, phaseWanted);
    tool.update(DT, { AltLeft: true });
    let wait = 0; while ((roll ? B.rolling : B.evadeT > 0 ? 0 : null) == null && wait < 60) { tool.update(DT, {}); wait++; }
    const out = { wait, swinging: B.swinging, rolled: wait < 60 };
    tool.dispose?.(); clearTargets();
    return out;
  };
  const w = rollAt('wind');
  assert.ok(w.rolled && w.wait === 0 && !w.swinging, 'the wind-up: rolled that frame, the swing dropped');
  const r = rollAt('recover');
  assert.ok(r.rolled && r.wait === 0 && !r.swinging, 'the follow-through: rolled that frame');
  const s = rollAt('strike');
  const active = quickSwing(SWINGS[0], QUICK_CUT).active;
  assert.ok(s.rolled && s.wait >= 1 && s.wait * DT <= active + 2 * DT, `the cut: rolled as it ended (${s.wait} frames, the cut ${(active / DT).toFixed(1)})`);
  assert.ok(ROLL.buffer >= active, 'the press kept through the whole cut');
  // outside the temples: the evade still waits out the wind-up (a press there is lost, as before)
  const e = rollAt('wind', null);
  assert.ok(!e.rolled || e.wait > 0, 'the evade: not from a wind-up');
});

// ------------------------------------------------------------------ the hazards, with the real blade's roll
const GAMES = [fightArzach, fightPerdide, fightMoonfoundry, fightEdena, fightIncal, fightBuried, fightBazaar, fightUnderwater, fightGlassdunes, fightSpheres, fightSpacecity];
const save = (flags = {}) => ({ data: { flags }, flag: (k) => flags[k], set: (k, x) => { flags[k] = x; return x; }, emit() {}, on: () => () => {} });

/** A run in node with a real FluidTool and its blade on the stand-in traveller (player.dodge is the blade's). */
function run(D) {
  const scene = new THREE.Scene();
  const level = runSteps(buildHall(scene, D));
  const { P, tool, B } = blade();
  P.pos.set(...D.spawn);
  const foes = new Foes({ scene, level, levelId: 'arena', physics: null, player: P, settings: { enemies: 'normal' }, rng: seeded() });
  const ctx = {
    player: P, camera: new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 800), level, sfx: new Proxy({}, { get: () => () => {} }), sound: null, tool, foes, rig: { target: v(), yaw: 0 }, physics: null, state: save(),
    setFov() {}, add: (o) => { scene.add(o); return o; }, flash() {}, status() {}, finish() {}, drop() {},
  };
  const S = startFightTemple(ctx);
  return { S, P, tool, B, foes, tick: (c = {}) => { tool.update(DT, c); S.update(DT, {}, { live: true, raw: {} }); } };
}

/** Where to stand for the kind's harm (as tests/fight-temples-worlds.test.js), and how to start it. */
function spot(r, kind) {
  const mid = [(r.x[0] + r.x[1]) / 2, (r.z[0] + r.z[1]) / 2];
  if (ON_LANES.has(kind)) { const lane = r.hazard.lanes[0]; return { lane, at: lanePoint(r, lane, laneLength(r, lane) * 0.55) }; }
  if (kind === 'drop' || kind === 'spill') return { lane: { spot: mid }, at: mid };
  if (kind === 'crack') { const t = tileOf(r, ...mid); return { lane: { spot: t }, at: [t[0] + 0.2, t[1] + 0.2] }; }
  if (kind === 'dark') {
    for (let a = r.x[0] + 1; a < r.x[1] - 1; a += 0.5) for (let b = r.z[0] + 1; b < r.z[1] - 1; b += 0.5) if (!inLight(r.hazard.lamps, a, b, HAZARD.dark.light + 0.6) && !(r.pillars ?? []).some(([px, pz]) => Math.hypot(a - px, b - pz) < 1.6)) return { lane: { room: true }, at: [a, b] };
  }
  if (kind === 'shade') return { lane: r.hazard.lanes[0], at: mid };
  const sign = r.hazard.signs[0], d = Math.hypot(mid[0] - sign[0], mid[1] - sign[1]), u = [(mid[0] - sign[0]) / d, (mid[1] - sign[1]) / d];
  return { lane: { sign }, at: [sign[0] + u[0] * 4, sign[1] + u[1] * 4] };
}

for (const game of GAMES) {
  const D = game.table, kind = D.rooms[1].hazard.kind;
  test(`${D.name}: its ${kind} hurts him standing; a roll pressed just before it lands takes him through unharmed (the real blade's i-frames)`, () => {
    // to the second room, its foes cleared away (only the hazard)
    const first = (rolling) => {
      const g = run(D);
      g.tick();
      for (let k = 0; k < 6000 && g.S.run.room === 0; k++) { g.tick(); for (const f of g.foes.list) if (f.alive) f.state = 'dead'; }
      const r = D.rooms[1];
      g.P.pos.set((r.x[0] + r.x[1]) / 2, 0, (r.z[0] + r.z[1]) / 2); g.tick();
      g.S.hazards.clear(); g.foes.list.slice().forEach((f) => g.foes.remove?.(f));
      const { lane, at } = spot(r, kind);
      for (let k = 0; k < 90; k++) g.tick();   // (the roll's cooldown and rest long over)
      g.P.hurts.length = 0;
      g.S.hazards.start(1, lane);
      let hitAt = -1, rolled = -1;
      for (let k = 0; k < 900; k++) {
        const pressNow = rolling != null && k === rolling;
        // standing there through it; after a roll he walks on out of lingering ground (as a roll across it would)
        if (rolled < 0 || g.B.evadeT > 0) { g.P.pos.set(at[0], 0, at[1]); g.P.vel.set(0, 0, 0); } else if (LINGERING.has(hurtName(kind))) g.P.pos.set(at[0] + 40, 0, at[1] + 40);
        else g.P.pos.set(at[0], 0, at[1]);
        if (pressNow) rolled = k;
        g.tick(pressNow ? { AltLeft: true } : {});
        g.P.hurts = g.P.hurts.filter(([why]) => why !== 'hit');
        if (hitAt < 0 && g.P.hurts.length) hitAt = k;
        if (rolled >= 0 && g.B.evadeT === 0 && k > rolled + 30) break;
        if (rolling == null && hitAt >= 0) break;
      }
      const hurts = g.P.hurts.slice();
      g.S.end(); g.tool.dispose?.(); clearTargets();
      return { hitAt, hurts };
    };
    const stand = first(null);
    assert.ok(stand.hitAt >= 0, `standing in it: hurt (${kind})`);
    const roll = first(Math.max(0, stand.hitAt - 4));
    assert.deepEqual(roll.hurts, [], `rolling through it: unharmed (${JSON.stringify(roll.hurts)})`);
  });
}
/** The hurt's name a kind gives (hazards.js hurtHim). */
function hurtName(kind) { return kind === 'pour' ? 'slag' : kind === 'stone' ? 'millstone' : kind; }

// ------------------------------------------------------------------ the kills
test('a kill reads from up there: thrown back about a metre, quicker down; a ring; a splash; a splat that spreads, lies, dries and goes', () => {
  // the knock eases out to about a metre
  assert.ok(knockAt(0) === 0 && knockAt(0.1) > 0.4 && Math.abs(knockAt(5) - KILL.knock / KILL.drag) < 1e-3);
  assert.ok(KILL.knock / KILL.drag > 0.7 && KILL.knock / KILL.drag < 1.5, 'about a metre');
  // the splat: spread in a blink, lying, then drying into the floor and gone
  const S = KILL.splat;
  assert.ok(splatAt(S.grow).s > 0.95 && splatAt(S.grow + S.hold * 0.5).dry === 0);
  const mid = splatAt(S.grow + S.hold + S.fade * 0.5);
  assert.ok(mid.dry > 0.4 && mid.dry < 0.6 && !mid.gone);
  assert.ok(splatAt(S.grow + S.hold + S.fade + 0.01).gone);
  assert.ok(S.grow + S.hold + S.fade < 5, 'gone within a few seconds');
  // played: a foe killed by a blow from the south: thrown north, its ring and splat out, the splash's drops, the thump
  const scene = new THREE.Scene(), drops = [], thumps = [];
  const fx = new KillFx({ add: (o) => { scene.add(o); return o; }, tool: { drops: { add: (d) => drops.push(d) } }, sound: { foeKill: (k) => thumps.push(k) }, palette: DESERT_FIGHT.palette });
  const f = { pos: v(0, 0, 0), chest: v(0, 0.6, 0), def: { radius: 0.5 }, heading: 0, dying: { t: 0 }, model: { group: Object.assign(new THREE.Group(), {}) } };
  scene.add(f.model.group);
  fx.felled(f, v(0, 0, -2));
  assert.equal(drops.length, KILL.drops); assert.equal(thumps.length, 1);
  for (let i = 0; i < 10; i++) fx.update(DT);
  assert.ok(fx.splats.count === 1 && fx.rings.count === 1, 'its ring and its splat');
  for (let i = 0; i < 20; i++) fx.update(DT);
  assert.ok(f.pos.z > 0.6 && Math.abs(f.pos.x) < 1e-6, `thrown along the blow (${f.pos.z.toFixed(2)} m)`);
  assert.ok(f.dying.t > 30 * DT * (KILL.pace - 1) - 1e-9, 'its defeat run on: down quicker');
  assert.ok(fx.splats.count === 1 && fx.rings.count === 0, 'the ring quick, the splat lying');
  for (let i = 0; i < (S.grow + S.hold + S.fade + 0.2) / DT; i++) fx.update(DT);
  assert.equal(fx.splats.count, 0, 'the splat gone');
  assert.equal(fx.rings.count, 0);
  // kept in the room: a keep() is asked after each step
  const kept = new KillFx({ add: (o) => o, keep: (x) => { x.pos.z = Math.min(x.pos.z, 0.3); } });
  const g = { pos: v(), def: {}, model: { group: Object.assign(new THREE.Group(), { parent: scene }) } };
  kept.felled(g, v(0, 0, -1)); for (let i = 0; i < 30; i++) kept.update(DT);
  assert.ok(g.pos.z <= 0.3 + 1e-9, 'not through the wall');
  fx.dispose(); kept.dispose();
});

test('a kill in a crowd: every one marked, but only a few at once splash and thump (a cut through eight is eight marks, not a cloud)', () => {
  assert.ok(fullKill([], 0) && !fullKill([0, 0.01, 0.02, 0.03], 0.05) && fullKill([0, 0.01, 0.02, 0.03], 0.05 + KILL.window));
  const drops = [], thumps = [];
  const fx = new KillFx({ add: (o) => o, tool: { drops: { add: (d) => drops.push(d) } }, sound: { foeKill: (k) => thumps.push(k) }, palette: DESERT_FIGHT.palette });
  const g = new THREE.Group(); new THREE.Scene().add(g);
  for (let i = 0; i < 8; i++) fx.felled({ pos: v(i, 0, 0), def: { radius: 0.4 }, model: { group: g } }, v(i, 0, -1));
  fx.update(DT);
  assert.equal(fx.counts.splats, 8, 'eight marks');
  assert.equal(fx.counts.rings, KILL.full, 'the rings within the budget');
  assert.equal(drops.length, KILL.full * KILL.drops, `the splash for ${KILL.full} of them`);
  assert.equal(thumps.length, 1, 'one thump (never two in the same few frames)');
  assert.ok(drops.length <= 60, 'the shared drops pool (360) is never flooded');
  // a moment later, the next kills splash again
  for (let i = 0; i < KILL.window / DT + 2; i++) fx.update(DT);
  fx.felled({ pos: v(), def: {}, model: { group: g } }, v(0, 0, -1));
  assert.equal(drops.length, (KILL.full + 1) * KILL.drops);
  // the pool is bounded
  for (let i = 0; i < 40; i++) fx.felled({ pos: v(i, 0, 0), def: {}, model: { group: g } }, v(i, 0, -1));
  assert.ok(fx.counts.splats <= KILL.max && fx.counts.rings <= KILL.max);
  fx.dispose();
});

test('the run marks its kills: a foe felled in a fight temple is thrown, ringed and stained; the marks go with the run', () => {
  const g = run(DESERT_FIGHT);
  g.P.pos.set(0, 0, 0); g.tick();
  let f = null;
  for (let k = 0; k < 400 && !f; k++) { g.tick(); f = g.foes.list.find((x) => x.alive); }
  assert.ok(f, 'a foe up');
  const at = f.pos.clone();
  g.P.pos.set(at.x, 0, at.z - 1.5);
  g.foes.hurt(f, 'blade', v(0, 0, 1), { damage: 99 });
  g.tick();
  assert.ok(g.S.kills.counts.splats >= 1 && g.S.kills.counts.rings >= 1, 'marked');
  for (let k = 0; k < 20; k++) g.tick();
  assert.ok(f.pos.z > at.z + 0.3, `thrown away from him (${(f.pos.z - at.z).toFixed(2)} m)`);
  g.S.end();
  assert.equal(g.S.kills.counts.splats, 0, 'gone with the run');
  g.tool.dispose?.(); clearTargets();
});

test('the hazards that lie on the ground are crossed in a roll without a perfect dodge; a blow swallowed is one', () => {
  assert.deepEqual([...LINGERING].sort(), ['crack', 'dark', 'shade', 'slag', 'spill']);
  const { tool, B, P, rest } = blade();
  B.roll = ROLL; rest();
  tool.update(DT, { AltLeft: true }); tool.update(DT, {}); tool.update(DT, {});
  assert.equal(P.dodge(v(), 'burn'), true);
  assert.equal(B.dodged, false, 'crossing slag: no perfect dodge');
  assert.equal(P.dodge(v(), 'strike'), 'perfect');
  tool.dispose?.(); clearTargets();
  void attackSample;
});

for (const fps of [30,60]) for (const roll of [null,ROLL]) test(`${fps}fps: ${roll?'roll':'ordinary evade'} buffers a committed cut once without extending i-frames`,()=>{
  const {tool,B,rest}=blade();const dt=1/fps;B.roll=roll;rest();
  tool.update(dt,{KeyF:true});let n=0;
  while(B.phase!=='strike' && n++<100)tool.update(dt,{});
  assert.equal(B.phase,'strike');tool.update(dt,{AltLeft:true});assert.equal(B.evadeT,0,'active cut remains committed');
  let starts=0,previous=0,ageAtStart=null;
  for(let i=0;i<fps*2;i++) {tool.update(dt,{AltLeft:true});if(B.evadeT>previous){starts++;ageAtStart=B.evadeAge;}previous=B.evadeT;}
  assert.equal(starts,1,'held button does not repeat');assert.ok(ageAtStart<=dt);assert.equal(B.rollWant,0);
  tool.dispose?.();clearTargets();
});
for (const fps of [30,60]) test(`${fps}fps: ordinary evade queue expires during long recovery and clears when control is denied`,()=>{
  const {tool,B,rest}=blade();const dt=1/fps;rest();B.evadeCool=.5;
  tool.update(dt,{AltLeft:true});assert.ok(B.rollWant>0);
  for(let i=0;i<fps;i++)tool.update(dt,{});
  assert.equal(B.evadeT,0,'stale intent never fires later');
  B.evadeCool=.1;tool.update(dt,{AltLeft:true});assert.ok(B.rollWant>0);
  B.update(dt,false,false,false,false);assert.equal(B.rollWant,0,'loss of control discards pending action');
  tool.dispose?.();clearTargets();
});

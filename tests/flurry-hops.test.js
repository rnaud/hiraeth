// Locked on, the back flip and the side hop (src/jump.js HOP, BACK_FLIP, SIDE_HOP, Player.hop), the perfect dodge's window
// and its flurry's slow time (src/flurry.js, src/feel.js flurry), against every archetype's attacks and the guardians'; the
// lock on a guardian (src/foes.js GuardianLock); the puff of smoke a defeated foe goes out in (src/smoke-puff.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FLIP, BACK_FLIP, SIDE_HOP, HOP, flipAngle, flipPose, hopKind } from '../src/jump.js';
import { DODGE, FLURRY, dodgeLead, landsIn, foeThreat, guardianThreat, perfectAgainst, harmful } from '../src/flurry.js';
import { feelDt, selfDt, flurry, endFlurry, flurryLeft, flurryK, resetFeel, hitStop } from '../src/feel.js';
import { Foes, FOES, GuardianLock } from '../src/foes.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { FluidTool } from '../src/fluid-tool.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { clearTargets } from '../src/targets.js';
import { SmokePuffs, SMOKE, blobScale } from '../src/smoke-puff.js';
import { GUARDIANS } from '../src/arena-guardians.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60;

// ---------------------------------------------------------------- the flips' directions

/** A bare rig: the body and its limbs as Object3Ds (flipPose turns them). */
function rig() {
  const o = () => new THREE.Object3D();
  return { body: o(), torso: o(), head: o(), arms: [o(), o()], elbows: [o(), o()], legs: [o(), o()], knees: [o(), o()] };
}
/** Where the body's up (its head) points s seconds into a flip of spec F. */
function headAt(F, s) { const c = rig(); flipPose(c, s, 1, F); return v(0, 1, 0).applyQuaternion(c.body.quaternion); }

test('the flips turn the right way: the double jump forward, the back flip backward, the side hop leaning into its side and back', () => {
  // (the body faces +z, its right is -x)
  assert.ok(Math.abs(flipAngle(FLIP.time, FLIP) - Math.PI * 2) < 1e-9, 'the front flip: all the way round, forward');
  assert.ok(Math.abs(flipAngle(BACK_FLIP.time, BACK_FLIP) + Math.PI * 2) < 1e-9, 'the back flip: all the way round, backward');
  assert.ok(headAt(FLIP, FLIP.time / 2 - 0.08).z > 0.3, 'front flip: the head goes forward first');
  assert.ok(headAt(BACK_FLIP, BACK_FLIP.time / 2 - 0.08).z < -0.3, 'back flip: the head goes back first');
  const right = { ...SIDE_HOP, side: 1 }, left = { ...SIDE_HOP, side: -1 };
  assert.ok(headAt(right, right.time / 2).x < -0.2, 'side hop to his right: leaning right (-x)');
  assert.ok(headAt(left, left.time / 2).x > 0.2, 'to his left: leaning left');
  assert.equal(flipAngle(0, right), 0); assert.ok(Math.abs(flipAngle(right.time, right)) < 1e-9, 'the side hop comes back upright');
  assert.ok(Math.abs(flipAngle(right.time / 2, right)) <= SIDE_HOP.lean + 1e-9, 'a lean, not a cartwheel');
  // each is done before the hop lands (the flip never reaches the ground)
  const air = (up) => (2 * up) / 32;
  assert.ok(BACK_FLIP.time < air(HOP.back.up) && SIDE_HOP.time < air(HOP.side.up), 'each turn done in the air');
  // past its time, nothing
  assert.equal(flipPose(rig(), BACK_FLIP.time + 0.01, 1, BACK_FLIP), false);
});

test('which hop a jump is, locked on: back, left, right; ahead, barely tilted or not locked: the jump', () => {
  assert.equal(hopKind(-1, 0), 'back');
  assert.equal(hopKind(-0.8, 0.3), 'back');
  assert.equal(hopKind(0, 1), 'right');
  assert.equal(hopKind(-0.3, -1), 'left');
  assert.equal(hopKind(0.3, 1), 'right', 'a little toward it still hops aside');
  assert.equal(hopKind(1, 0), null, 'toward the foe: a jump');
  assert.equal(hopKind(0.2, 0.1), null, 'barely tilted: a jump');
  assert.equal(hopKind(0, 0), null, 'no stick: a jump');
  assert.equal(hopKind(-1, 0, false), null, 'not locked on: a jump (the double jump stays)');
});

// ---------------------------------------------------------------- the window and the slow time

test('the perfect dodge\'s window: a third of the wind-up before the blow lands, 0.2-0.42 s, a little longer on Gentle', () => {
  assert.equal(dodgeLead(0.6).toFixed(3), (0.6 * DODGE.share).toFixed(3));
  assert.equal(dodgeLead(0.3), DODGE.min, 'a fast jab: never a frame-perfect guess');
  assert.equal(dodgeLead(3), DODGE.max, 'a slow wind-up: never a free flurry');
  assert.ok(dodgeLead(0.9, true) > dodgeLead(0.9));
  // the time left before a blow lands: the rest of the wind-up, then the strike up to its contact; a lob at the wind-up's end
  const a = { wind: 0.8, strike: 0.3, contact: 0.5, damage: 1 };
  assert.ok(Math.abs(landsIn({ state: 'wind', timer: 0.5 }, a, 0.8) - (0.3 + 0.15)) < 1e-9);
  assert.ok(Math.abs(landsIn({ state: 'strike', k: 0.2, contacted: false }, a, 0.8) - 0.09) < 1e-9);
  assert.equal(landsIn({ state: 'strike', k: 0.7, contacted: true }, a, 0.8), null, 'landed: too late');
  assert.equal(landsIn({ state: 'wind', timer: 0.6 }, { ...a, at: 'target' }, 0.8).toFixed(3), '0.200', 'a lob lands as the wind-up ends');
  assert.equal(landsIn({ state: 'chase' }, a, 0.8), null);
  // in the window and in its way: perfect; too early, too late, or out of its way: not
  const lead = dodgeLead(0.8);
  assert.ok(perfectAgainst({ t: lead - 0.01, wind: 0.8, near: true }));
  assert.ok(perfectAgainst({ t: 0, wind: 0.8, near: true }), 'right at the blow');
  assert.ok(!perfectAgainst({ t: lead + 0.05, wind: 0.8, near: true }), 'too early');
  assert.ok(!perfectAgainst({ t: lead - 0.05, wind: 0.8, near: false }), 'not in its way');
  assert.ok(!perfectAgainst(null));
  // the window from every archetype's attacks: never under 0.2 s nor over 0.42 s
  for (const [kind, d] of Object.entries(FOES)) for (const at of d.attacks ?? [d.attack]) if (harmful(at)) {
    const L = dodgeLead(at.wind ?? 0.8);
    assert.ok(L >= DODGE.min - 1e-9 && L <= DODGE.max + 1e-9, `${kind}.${at.id}: ${L}`);
  }
});

test('the flurry\'s slow time: the world at FLURRY.rate, the traveller at full speed, eased in and out, over after its time', () => {
  resetFeel();
  assert.equal(feelDt(DT), DT); assert.equal(selfDt(), DT);
  flurry(FLURRY.time, FLURRY.rate, FLURRY.ease);
  let world = 0, self = 0, frames = 0, min = 1;
  while (flurryLeft() > 0 && frames < 1000) { const w = feelDt(DT); world += w; self += selfDt(); min = Math.min(min, w / DT); frames++; }
  assert.ok(Math.abs(self - FLURRY.time) < 2 * DT, `his time ran ${self.toFixed(2)} s`);
  assert.ok(Math.abs(min - FLURRY.rate) < 1e-6, `the world at ${min} of his speed`);
  assert.ok(world < FLURRY.time * 0.25, `the world ran ${world.toFixed(2)} s of the ${FLURRY.time}`);
  assert.equal(feelDt(DT), DT, 'and then back to speed');
  // eased: not a step from full speed to slow
  flurry(1, 0.1, 0.2);
  const first = feelDt(DT) / DT;
  assert.ok(first > 0.8, 'eases in');
  for (let i = 0; i < 15; i++) feelDt(DT);
  assert.ok(flurryK() > 0.99);
  endFlurry();
  assert.ok(flurryLeft() <= 0.2 + 1e-9, 'ended early: it eases out over its ease');
  // a hit-stop inside it freezes both (the blow still lands hard)
  resetFeel(); flurry(2); for (let i = 0; i < 20; i++) feelDt(DT);
  hitStop(0.1); feelDt(DT);
  assert.ok(selfDt() < 1e-3, 'a hit-stop freezes him too');
  resetFeel();
});

// ---------------------------------------------------------------- against every archetype

function stillPlayer(at = v()) {
  const frame = { up: v(0, 1, 0), fwd: v(0, 0, 1), right: v(1, 0, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) };
  return { pos: at, vel: v(), heading: 0, frame, vehicles: [], object: { visible: true }, ride: null, onGround: true, aim: null, opts: {}, health: 1, down: null, dead: false,
    hurts: [], knocks: 0, flinch() {}, hurt(a) { this.hurts.push(a); }, knockDown() { this.knocks++; return true; } };
}
function world() {
  clearTargets(); items.grant('backpack');
  const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
  const P = stillPlayer();
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.6, -3); camera.lookAt(0, 1.6, 10); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene: new THREE.Scene(), player: P, physics: flat, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, tool, settings: { enemies: 'normal' }, game: new GameState(null) });
  return { P, tool, foes };
}

test('the perfect dodge against every archetype\'s every attack: begun in its window, in its way, it is perfect; too early, not', () => {
  const { P, foes, tool } = world();
  const seen = [];
  for (const [arch, A] of Object.entries(ARCHETYPES)) {
    const d = FOES[A.kind];
    for (const a of d?.attacks ?? []) {
      if (!harmful(a) || a.ward || a.mend) continue;
      for (const f of foes.list.slice()) foes.remove(f);
      // the foe at the attack's own distance from you, facing you; you stand still
      const dist = THREE.MathUtils.clamp(((a.min ?? 0) + (a.max ?? 2)) / 2, 0.8, 10);
      P.pos.set(0, 0, 0);
      const f = foes.add(A.kind, v(0, 0, dist));
      f.heading = Math.PI; f.state = 'chase'; f.provoked = true; f.buried = false; if (d.hover) f.alt = d.hover;
      f.beginWind(a, P);
      const wind = a.wind * (foes.env.slow?.() ?? 1);
      // at the start of a wind-up longer than the window: not yet
      if (wind > dodgeLead(wind) + 0.1) assert.equal(foes.perfectDodge(), null, `${arch}.${a.id}: too early at the start of its wind-up`);
      // late in its wind-up (half the window left before it lands)
      // (half the window before it lands: late in its wind-up, or into its strike when the strike's own run-up is longer)
      const half = dodgeLead(wind) / 2, strike = a.strike ?? 0.24, contact = a.sweep ? a.contact ?? 0 : a.contact ?? 0.55;
      const pre = a.instant || a.at === 'target' ? 0 : contact * strike;
      if (pre <= half) f.timer = wind - (half - pre);
      else { f.state = 'strike'; f.timer = 0; f.k = contact - half / strike; f.contacted = false; }
      const now = foeThreat(f, P);
      assert.ok(now && now.t <= dodgeLead(wind) + 1e-6, `${arch}.${a.id}: lands in ${now?.t?.toFixed(2)} s`);
      assert.equal(foes.perfectDodge(), f, `${arch}.${a.id}: a perfect dodge (lands in ${now.t.toFixed(2)} s, in its way: ${now.near})`);
      seen.push(`${arch}.${a.id}`);
    }
  }
  assert.ok(seen.length >= 40, `${seen.length} attacks checked`);
  foes.dispose(); tool.dispose(); clearTargets();
});

test('during the flurry nothing touches you; outside it the guard still parries and the evade still dodges as before', () => {
  const { P, foes, tool } = world();
  const B = tool.blade;
  resetFeel();
  // a blow in the flurry: swallowed, even with no evade
  flurry(FLURRY.time);
  assert.equal(P.dodge(v(0, 0, 2), 'strike', false), true, 'in the flurry: untouched');
  resetFeel();
  assert.equal(P.dodge(v(0, 0, 2), 'strike', false), false, 'after it: a blow lands again');
  // a hop's dodge frames: on through its window, off after, and its first swallowed blow tells main.js (the flurry)
  let told = 0; B.onHopDodge = () => told++;
  for (let i = 0; i < 60; i++) tool.update(DT, {});
  B.hop(HOP.back.iframes);
  tool.update(DT, {}); tool.update(DT, {});
  assert.equal(P.dodge(v(0, 0, 2), 'strike', false), 'perfect');
  assert.equal(told, 1, 'a hop\'s frames swallowing a blow: a perfect dodge');
  for (let i = 0; i < 30; i++) tool.update(DT, {});
  assert.equal(P.dodge(v(0, 0, 2), 'strike', false), false, 'the window closed');
  // the parry is untouched: a fresh guard raised just as the strike comes is still perfect
  for (let i = 0; i < 60; i++) tool.update(DT, {});
  tool.update(DT, { KeyZ: true }); for (let i = 0; i < 4; i++) tool.update(DT, { KeyZ: true });
  assert.equal(P.guard(v(0, 0, 2)), 'perfect', 'the perfect parry as before');
  foes.dispose(); tool.dispose(); clearTargets(); resetFeel();
});

// ---------------------------------------------------------------- the guardians

/** A stand-in guardian: its model, its state and a move under way (src/temples/boss.js Guardian's fields). */
function fakeGuardian(G, { at = 0, state = 'fight' } = {}) {
  const ids = Object.keys(G.def.attacks), id = G.def.phases[0].attacks[0] ?? ids[0], a = { id, ...G.def.attacks[id] };
  const group = new THREE.Group(); new THREE.Scene().add(group);
  const model = { group, pos: v(0, 0, 6), heading: Math.PI, radius: 3, height: 4, mouth: v(0, 3, 5) };
  const wind = a.wind ?? a.telegraph ?? 1.2;
  return { def: G.def, model, state, attack: a, at, windFor: wind, struck: false, attackH: Math.PI, attackK: at / wind, phaseIndex: 0,
    attackAt: a.at === 'self' ? model.pos.clone() : v(0, 0, 0), points() { return [this.attackAt]; } };
}

test('every guardian\'s opening move: a hop in its window and in its way is perfect, too early not; the lock-on reads a guardian', () => {
  const P = stillPlayer(v(0, 0, 0));
  for (const G of GUARDIANS) {
    const g = fakeGuardian(G);
    const T0 = guardianThreat(g, P);
    assert.ok(T0, `${G.id}: its move is a threat`);
    assert.ok(!perfectAgainst(T0), `${G.id}: not at the start of a ${g.windFor} s wind-up`);
    g.at = g.windFor - dodgeLead(g.windFor) / 2;
    const T = guardianThreat(g, P);
    assert.ok(perfectAgainst(T), `${G.id}.${g.attack.id}: perfect (lands in ${T.t.toFixed(2)} s, in its way ${T.near})`);
    g.struck = true;
    assert.equal(guardianThreat(g, P), null, `${G.id}: struck, too late`);
    // the lock on it: alive in its fight, its chest, its wind-up, pips for its phases
    const L = new GuardianLock({ ...g, struck: false });
    assert.ok(L.alive && L.pos === g.model.pos && L.chest.y > 0 && L.def.radius > 0, `${G.id}: locked on`);
    assert.equal(L.state, 'wind'); assert.ok(L.hp >= 1 && L.hp === L.def.hp);
    assert.ok(!new GuardianLock({ ...g, state: 'weary' }).alive, `${G.id}: weary, the lock lets go`);
  }
});

// ---------------------------------------------------------------- the smoke

test('the puff of smoke: pooled, one mesh; its blobs swell and thin away, and nothing lingers once it is over', () => {
  const scene = new THREE.Scene(), P = new SmokePuffs(scene, 40);
  assert.equal(scene.children.length, 1, 'one mesh for every puff');
  assert.equal(blobScale(0), 0); assert.equal(blobScale(1), 0); assert.ok(blobScale(0.4) > 0.9);
  for (let i = 0; i < 10; i++) P.add(v(i, 1, 0), 1.2, ['#8e64d6']);
  assert.ok(P.live <= 40, 'never more than its pool');
  P.update(0.2);
  assert.ok(P.mesh.count > 0);
  for (let t = 0; t < SMOKE.life[1] + 0.5; t += DT) P.update(DT);
  assert.equal(P.live, 0); assert.equal(P.mesh.count, 0, 'nothing drawn after');
  assert.equal(scene.children.length, 1, 'no mesh made per puff');
  P.dispose(); assert.equal(scene.children.length, 0);
});

test('a defeated foe lies a second after its defeat, goes up in smoke and is gone, its model out of the scene', () => {
  const { P, foes, tool } = world();
  const f = foes.add('blot', v(0, 0, 3));
  for (let i = 0; i < 10; i++) foes.update(DT);
  const g = f.model.group;
  f.hp = 1; foes.hurt(f, 'blade', v(0, 0, 1), { damage: 5, source: 'blade' });
  let t = 0;
  while (foes.list.includes(f) && t < 5) { foes.update(DT); t += DT; }
  assert.ok(!foes.list.includes(f), 'gone');
  assert.ok(t > SMOKE.linger + SMOKE.fade, `after its defeat, a second and its puff (${t.toFixed(2)} s)`);
  assert.equal(g.parent, null, 'its model out of the scene');
  for (let i = 0; i < 120; i++) foes.update(DT);
  assert.equal(foes.puffs.live, 0, 'the smoke gone too');
  foes.dispose(); tool.dispose(); clearTargets();
  void P;
});

test('the traveller, locked on: jump with back is the back flip, with a side the side hop, carried its own way; not locked on, the jump', async () => {
  const { traveller, course, CAM_PLUS_Z } = await import('./gait-sim.js');
  items.grant('backpack');
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, v(0, 0, -60), { moves: true, body: 'v1' });
  const hops = [];
  p.onHop = (kind, win) => hops.push([kind, win]);
  const settle = () => { p.lockOn = null; for (let i = 0; i < 90; i++) p.update(DT, {}, CAM_PLUS_Z); };
  const press = (keys, locked = true) => {
    settle();
    p.lockOn = locked ? { dir: v(0, 0, 1) } : null; p.heading = 0;
    for (let i = 0; i < 3; i++) p.update(DT, { ...keys }, CAM_PLUS_Z);   // (the stick held a moment)
    p.update(DT, { ...keys, Space: true }, CAM_PLUS_Z);
  };
  press({ KeyS: true });
  assert.equal(p.hopping?.kind, 'back', 'back + jump: the back flip');
  assert.ok(p.vel.z < -HOP.back.out * 0.8 && p.vel.y > HOP.back.up * 0.6, `away from the foe and up (${p.vel.z.toFixed(1)}, ${p.vel.y.toFixed(1)})`);
  assert.deepEqual(hops.at(-1), ['back', HOP.back.iframes], 'its dodge frames asked for');
  // carried its own way: the stick doesn't steer it in the air
  for (let i = 0; i < 6; i++) p.update(DT, { KeyW: true, Space: true }, CAM_PLUS_Z);
  assert.ok(p.vel.z < -HOP.back.out * 0.8, 'no steering in the hop');
  assert.ok(p.flipping == null, 'no double jump in a hop');
  for (const key of ['KeyD', 'KeyA']) {
    press({ [key]: true });
    assert.ok(['left', 'right'].includes(p.hopping?.kind), `${key} + jump: the side hop (${p.hopping?.kind})`);
    assert.ok(Math.abs(p.vel.x) > HOP.side.out * 0.8 && Math.abs(p.vel.z) < 1, `sideways (${p.vel.x.toFixed(1)}, ${p.vel.z.toFixed(1)})`);
  }
  const sides = hops.slice(-2).map((h) => h[0]);
  assert.notEqual(sides[0], sides[1], 'D and A hop to opposite sides');
  press({ KeyW: true });
  assert.equal(p.hopping, null, 'toward the foe: the jump');
  press({ KeyS: true }, false);
  assert.equal(p.hopping, null, 'not locked on: the jump');
  assert.ok(p.vel.y > 8, 'a jump');
});

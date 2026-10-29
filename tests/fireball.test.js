// Issue #398: the ember wisp and its fireball (src/fireballs.js, src/foes.js Foes.throwBall …, src/enemies/archetypes.js
// `wisp`): it floats out of reach and keeps its distance, winds up about a second, throws a slow ball that homes gently;
// a cut timed as the ball arrives (the window) sends it back along the line, faster; hit by its own fire it is hurt and
// flinches, never stunned (issue #766: a shot sent back, src/shot-return.js); a missed ball burns you for an ordinary
// blow; a perfect parry returns it too, a guard puts it out, an evade lets it pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Fireball, FIREBALL, catchable, aimAt } from '../src/fireballs.js';
import { RETURN } from '../src/shot-return.js';
import { Foes, FOES, attackOf } from '../src/foes.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { worldArchetypes } from '../src/foe-worlds.js';
import { clearTargets, allTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { BALL_VOICES, CUES, FOE_VOICES } from '../src/foe-voices.js';
import { MOONFOUNDRY_FIGHT } from '../src/fight-temples/moonfoundry.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function player(at = v(), o = {}) {
  return { pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: [], knocks: 0, flinches: 0,
    hurt(a) { this.hurts.push(a); }, knockDown() { this.knocks++; return true; }, flinch() { this.flinches++; }, ...o };
}
const world = (P, o = {}) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), ...o });
/** A wisp 10 m ahead of the traveller (who faces it, +z), a blade that cuts when told. */
function fight(o = {}) {
  clearTargets();
  const blade = { cutting: false };
  const P = player(v(0, 0, 0), o), foes = world(P, { tool: { blade } }); foes.waveRest = 1e9;
  const f = foes.add('wisp', v(0, 0, 10));
  return { P, foes, f, blade };
}
/** Run until `until()` (or `max` s). */
const run = (foes, max, until = () => false) => { for (let t = 0; t < max; t += DT) { foes.update(DT); if (until()) return t; } return null; };

test('the ember wisp: a spirit of the roster, built, a flyer for the hook, out of reach; its moves told by the body', () => {
  const A = ARCHETYPES.wisp, D = FOES.wisp;
  assert.equal(A.family, 'spirit'); assert.equal(A.status, 'built'); assert.equal(A.art, 'sheet-1', 'drawn to its picked sheet (issue #440)');
  assert.equal(D.hook, 'flyer', 'the grappling hook pulls it down');
  assert.ok(D.hover >= 3 && D.hover <= 5, `it floats 3–5 m up (${D.hover})`);
  assert.ok(D.keep >= 5, 'it keeps its distance');
  const F = attackOf('wisp', 'fireball');
  assert.ok(F.ball && F.instant && F.wind >= 0.95 && F.wind <= 1.2, `a clear wind-up of about a second (${F.wind} s)`);
  assert.ok(F.tell && F.counter && CUES[F.cue], 'its tell, its answer, its sound');
  assert.ok(FOE_VOICES.wisp, 'its own voice');
  for (const k of ['throw', 'hum', 'tink', 'back', 'stun']) assert.ok(BALL_VOICES[k]?.length, `the ball's ${k}`);
  for (const w of ['moonfoundry', 'perdide2', 'eclipse']) assert.ok(worldArchetypes(w).includes('wisp'), `met in ${w}`);
  const kinds = MOONFOUNDRY_FIGHT.rooms.flatMap((r) => r.waves.flat().map((x) => x[0]));
  assert.ok(kinds.includes('wisp'), 'in the Pour Floor’s waves');
});

test('the ball: slow, homing gently, straight on inside its last stretch; sent back it flies straight at its thrower, faster', () => {
  const owner = { alive: true, chest: v(0, 4.7, 10), def: { radius: 0.6 } };
  const target = v(0, 1.1, 0);
  const b = new Fireball(owner, owner.chest.clone(), target);
  assert.ok(Math.abs(b.vel.length() - FIREBALL.speed) < 1e-9 && FIREBALL.speed < 8, 'slow');
  // you run sideways: it turns after you, but at most FIREBALL.turn rad/s
  const dir0 = b.dir.clone();
  target.x = 6;
  for (let i = 0; i < 30; i++) b.step(DT, target);
  const turned = dir0.angleTo(b.dir);
  assert.ok(turned > 0.1 && turned <= FIREBALL.turn * 0.5 + 1e-6, `it curves after you, gently (${turned.toFixed(2)} rad in 0.5 s)`);
  // inside its last stretch it flies straight: a step aside then is a miss
  const c = new Fireball(owner, v(0, 1.1, FIREBALL.near - 0.8), v(0, 1.1, 0));
  const d0 = c.dir.clone();
  c.step(DT, v(1, 1.1, 0));   // (you step aside, still inside its last stretch)
  assert.ok(d0.angleTo(c.dir) < 1e-6, 'no homing in the last stretch');
  // it arrives
  let e = null;
  const a = new Fireball(owner, owner.chest.clone(), v(0, 1.1, 0));
  for (let t = 0; t < 5 && !e; t += DT) e = a.step(DT, v(0, 1.1, 0));
  assert.equal(e, 'arrive');
  // sent back: along the line to its thrower, faster, and it strikes it
  assert.ok(a.deflect(), 'sent back');
  assert.equal(a.state, 'back'); assert.ok(a.vel.length() > FIREBALL.speed * 2);
  assert.equal(a.deflect(), false, 'only a ball on its way to you can be sent back');
  let r = null, t = 0;
  for (; t < 3 && !r; t += DT) r = a.step(DT, owner.chest);
  assert.equal(r, 'struck');
  assert.ok(t < 10.5 / FIREBALL.back + 0.1, `fast: ${t.toFixed(2)} s back`);
});

test('the deflect window: a cut cutting with the ball within reach in front of you; a quarter second before it lands, forgiving', () => {
  const feet = v(0, 0, 0);
  const at = (z, x = 0) => v(x, FIREBALL.chest, z);
  assert.ok(catchable(at(2), feet, 0), 'in reach, ahead');
  assert.ok(!catchable(at(3), feet, 0), 'too far yet');
  assert.ok(!catchable(at(-2), feet, 0), 'behind you');
  assert.ok(catchable(at(1.5, 1.5), feet, 0), 'off to the side, in front');
  // how long the window stays open before it lands, at its speed (the cut's own active frames add to it)
  const open = (FIREBALL.reach - FIREBALL.hit) / FIREBALL.speed;
  assert.ok(open >= 0.2 && open <= 0.4, `open ${open.toFixed(2)} s before it lands`);
  // Gentle: slower, a longer window
  assert.ok(FIREBALL.gentle < 1);
});

test('a fight: it rises out of reach, winds up about a second, throws; a missed ball burns for an ordinary blow', () => {
  const { P, foes, f } = fight();
  run(foes, 3, () => f.state === 'wind');
  assert.equal(f.state, 'wind', 'it winds up');
  assert.ok(f.chest.y - P.pos.y > 3.5, `out of the blade's reach (${(f.chest.y - P.pos.y).toFixed(1)} m up)`);
  const tw = run(foes, 2, () => foes.balls.length > 0);
  assert.ok(tw != null && tw > 0.8, `the throw after its wind-up (${tw?.toFixed(2)} s)`);
  assert.ok(foes.balls[0].mesh?.parent, 'drawn');
  assert.ok(allTargets().some((t) => t.kind === 'ball' && t.accepts.includes('blade')), 'the blade can meet it');
  assert.equal(attackOf('wisp', 'fireball').ball, true);
  const tf = run(foes, 4, () => P.hurts.length > 0);
  assert.ok(tf != null && tf > 1, `it takes its time (${tf?.toFixed(2)} s in the air)`);
  assert.equal(P.hurts.length, 1, 'burnt once');
  assert.ok(Math.abs(P.hurts[0] - FIREBALL.damage) < 1e-9, `an ordinary blow (${P.hurts[0]})`);
  assert.equal(foes.balls.length, 0, 'gone');
  foes.dispose(); clearTargets();
});

test('a cut as it arrives sends it back: the wisp is hurt and flinches, never stunned (#766); three returns bring it down', () => {
  const { P, foes, f, blade } = fight();
  const hp = f.hp;
  run(foes, 4, () => foes.balls.length > 0);
  const b = foes.balls[0];
  // cut too early: nothing
  blade.cutting = true; foes.update(DT); blade.cutting = false;
  assert.equal(b.state, 'out', 'too early: the cut meets air');
  // cut as it arrives
  run(foes, 4, () => b.pos.distanceTo(aimAt(P)) < 1.6);
  blade.cutting = true; foes.update(DT); blade.cutting = false;
  assert.equal(b.state, 'back', 'sent back');
  run(foes, 2, () => b.state === 'gone');
  assert.equal(b.why, 'struck', 'into the wisp');
  assert.equal(P.hurts.length, 0, 'no harm to you');
  assert.ok(Math.abs(f.hp - (hp - FIREBALL.returned)) < 1e-9, `hurt by its own fire (${f.hp})`);
  assert.equal(FIREBALL.returned, RETURN.damage, 'the harm every shot sent back does');
  assert.ok(!(f.stunned > 0) && !(f.downT > 0), `never stunned, never down (stunned ${f.stunned}, down ${f.downT})`);
  assert.equal(f.reel, 'flinched', 'a flinch');
  assert.ok(f.state === 'recover' && f.timer <= f.def.hit + 1e-9, `a short reel (${f.state} ${f.timer?.toFixed(2)} s)`);
  run(foes, 1);
  assert.ok(f.chest.y - P.pos.y > 2.5, `it stays up out of reach (${(f.chest.y - P.pos.y).toFixed(2)} m)`);
  assert.ok(f.alive);
  // three returns, from fresh, bring one down
  foes.dispose(); clearTargets();
  const W = fight();
  for (let n = 0; n < 3; n++) {
    W.f.stunned = 0; W.f.cool = 0;
    run(W.foes, 8, () => W.foes.balls.length > 0);
    const ball = W.foes.balls[0];
    run(W.foes, 4, () => ball.pos.distanceTo(aimAt(W.P)) < 1.6);
    W.blade.cutting = true; W.foes.update(DT); W.blade.cutting = false;
    run(W.foes, 2, () => ball.state === 'gone');
    assert.equal(ball.why, 'struck', `return ${n + 1}`);
  }
  assert.ok(!W.f.alive || W.f.dying || W.f.dead !== undefined, 'three returns: down');
  W.foes.dispose(); clearTargets();
});

test('a perfect parry sends it back; a guard puts it out; an evade lets it fly past; the hook pulls the wisp down', () => {
  for (const [o, want] of [[{ guard: () => 'perfect' }, 'struck'], [{ guard: () => true }, 'block'], [{ dodge: () => true }, 'fizzle']]) {
    const { P, foes } = fight(o);
    run(foes, 4, () => foes.balls.length > 0);
    const b = foes.balls[0];
    run(foes, 8, () => b.state === 'gone');
    assert.equal(b.why, want, JSON.stringify(Object.keys(o)));
    assert.equal(P.hurts.length, 0, 'no harm');
    foes.dispose(); clearTargets();
  }
  const { foes, f } = fight();
  run(foes, 1);
  const up = f.alt;
  f.hookDown(2);
  run(foes, 0.6);
  assert.ok(f.alt < up * 0.5, `pulled down (${up.toFixed(1)} → ${f.alt.toFixed(1)} m)`);
  foes.dispose(); clearTargets();
});

test('a shot douses a ball; one ball of its own in the air at a time', () => {
  const { foes, f } = fight();
  run(foes, 4, () => foes.balls.length > 0);
  const b = foes.balls[0];
  assert.equal(f.ballOut, b);
  assert.ok(!f.attacksAt(10).some((a) => a.ball), 'no second throw while its ball flies');
  b.target && allTargets().find((t) => t.kind === 'ball').onHit('shoot');
  assert.equal(b.why, 'douse');
  assert.equal(f.ballOut, null);
  foes.dispose(); clearTargets();
});

test('its body (issue #440, its sheet): the petals open wide for the fireball; stunned low, nothing of it goes under the sand', () => {
  const { foes, f } = fight();
  const box = new THREE.Box3(), size = new THREE.Vector3();
  const width = () => { f.model.group.updateMatrixWorld(true); box.setFromObject(f.model.group); box.getSize(size); return Math.max(size.x, size.z); };
  foes.update(DT);
  const rest = width();
  const t = run(foes, 20, () => f.state === 'wind' && f.atk?.id === 'fireball' && f.k > 0.8);
  assert.ok(t != null, 'it winds up a fireball');
  const open = width();
  // (the resting box swings 1.5–2.0 m with the drips trailing as it drifts, so the open flower is held to the bud's own
  // width too: EMBER.w across, about 1.1 m; open it spans about 3 m)
  assert.ok(open > rest * 1.4 && open > 2.4, `the petals opened like a flower (${rest.toFixed(2)} → ${open.toFixed(2)} m across)`);
  // stunned (its own fire back at it): down low, its cup and drips over the ground
  let lowest = Infinity;
  f.stunned = 3; f.state = 'chase'; f.atk = null;
  run(foes, 2.5, () => { f.stunned = Math.max(f.stunned, 1); f.model.group.updateMatrixWorld(true); box.setFromObject(f.model.group); lowest = Math.min(lowest, box.min.y - f.pos.y); return false; });
  assert.ok(f.alt < 0.6, `it dropped low (${f.alt.toFixed(2)} m)`);
  assert.ok(lowest > -0.02, `nothing of it under the sand (lowest ${lowest.toFixed(2)} m)`);
  foes.dispose(); clearTargets();
});

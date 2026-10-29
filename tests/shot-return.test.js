// Issue #766 (the author: "Me deflecting projectiles shouldn't stun the enemy"): every shot a foe fires or throws from
// afar (an arrow, a rock, a glob, the worm's stones, a bolt; src/shot-return.js) is stopped by a plain guard with nothing
// done to its shooter, and sent back by a perfect parry: its harm (RETURN) and a flinch, never a stun, a knock-down or a
// broken poise. A blow struck from arm's length and guarded still throws its striker off balance as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, attackOf } from '../src/foes.js';
import { isShot, RETURN, returnedBlow } from '../src/shot-return.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function player(guard) {
  return { pos: v(), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: [], flinches: 0,
    hurt(a) { this.hurts.push(a); }, knockDown() { return true; }, flinch() { this.flinches++; }, guard: () => guard };
}
/** `kind` `dist` m ahead of a traveller whose guard answers `guard` ('perfect', true or false), its blow `id` landing. */
function shotAt(kind, id, guard, dist = 9) {
  clearTargets();
  const P = player(guard);
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });
  foes.waveRest = 1e9;
  const f = foes.add(kind, v(0, 0, dist));
  if (f.buried) f.surfaced();   // (the worm spits only while it is up)
  f.state = 'chase'; f.provoked = true; f.heading = Math.PI;
  const a = attackOf(kind, id);
  assert.ok(a, `${kind} ${id}`);
  const hp = f.hp, poise = f.poise;
  const r = foes.strike(f, a);
  return { P, foes, f, a, r, hp, poise };
}

const SHOTS = [['mummer', 'volley'], ['mummer', 'rock'], ['grunt', 'volley'], ['grunt', 'rock'], ['blot', 'spit'], ['toad', 'lob'], ['brute', 'hurl'], ['worm', 'spit'], ['tripod', 'beam'], ['oracle', 'volley']];

test('the shots: every lob, bow, bolt and the worm\'s stones are shots; a blow at arm\'s length and a harpoon\'s line are not', () => {
  for (const [k, id] of SHOTS) assert.ok(isShot(attackOf(k, id)), `${k} ${id} is a shot`);
  assert.ok(isShot(attackOf('wisp', 'fireball')), 'the wisp\'s fireball');
  for (const [k, id] of [['brute', 'sweep'], ['fencer', 'bash'], ['mummer', 'whack'], ['drone', 'harpoon'], ['drone', 'ram'], ['shade', 'cut']]) {
    const a = attackOf(k, id);
    if (a) assert.ok(!isShot(a), `${k} ${id} is not a shot`);
  }
  const B = returnedBlow();
  assert.equal(B.damage, RETURN.damage); assert.ok(B.flinch && !B.stun, 'a flinch, no stun');
});

test('a plain guard stops a shot: nothing happens to its shooter metres away (#766)', () => {
  for (const [k, id] of SHOTS) {
    const { P, foes, f, r, hp, poise } = shotAt(k, id, true);
    assert.equal(r, false, `${k} ${id}: no harm to you`);
    assert.equal(P.hurts.length, 0);
    assert.equal(f.hp, hp, `${k} ${id}: unhurt`);
    assert.ok(!(f.stunned > 0) && !(f.downT > 0), `${k} ${id}: not stunned (${f.stunned}) nor down`);
    assert.notEqual(f.state, 'recover', `${k} ${id}: not staggered (${f.reel})`);
    assert.equal(f.poise, poise, `${k} ${id}: its poise untouched`);
    foes.dispose();
  }
  clearTargets();
});

test('a perfect parry sends a shot back: its harm and a flinch, never a stun, a knock-down or a broken poise (#766)', () => {
  for (const [k, id] of SHOTS) {
    const { P, foes, f, r, hp } = shotAt(k, id, 'perfect');
    assert.equal(r, false, `${k} ${id}: no harm to you`);
    assert.equal(P.hurts.length, 0);
    const took = hp - f.hp;
    assert.ok(Math.abs(took - RETURN.damage * (FOES[k].weak?.returned ?? 1)) < 1e-9 || !f.alive, `${k} ${id}: hurt by its own shot (${took})`);
    if (!f.alive) continue;
    assert.ok(!(f.stunned > 0) && !(f.downT > 0) && !(f.flipped > 0) && !(f.toppled > 0), `${k} ${id}: not stunned (${f.stunned}), not down (${f.downT})`);
    assert.equal(f.reel, 'flinched', `${k} ${id}: a flinch (${f.reel})`);
    assert.ok(f.timer <= f.def.hit + 1e-9, `${k} ${id}: a short reel (${f.timer.toFixed(2)} s, its hit ${f.def.hit})`);
    foes.dispose();
  }
  clearTargets();
});

test('a blow struck at arm\'s length and guarded still throws its striker off balance (unchanged)', () => {
  const plain = shotAt('mummer', 'whack', true, 1.6);
  assert.equal(plain.f.state, 'recover', 'a plain block: it stumbles');
  plain.foes.dispose();
  const perfect = shotAt('mummer', 'whack', 'perfect', 1.6);
  assert.ok(perfect.f.stunned > 0, 'a perfect parry of a blow: stunned, open');
  perfect.foes.dispose(); clearTargets();
});

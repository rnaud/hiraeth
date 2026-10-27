import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { STANCE, guardBreaker, guardCovers, wantsGuard } from '../src/foe-guard.js';
import { hopFits, perfectAgainst } from '../src/flurry.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { setHintLevel } from '../src/hint-level.js';

// Guards and their breakers (issue #661, docs/design/combat-botw-study.md ranked changes 2-4; docs/systems/foes.md
// "Guards and their breakers"). Each guarded kind is fought in the Arena, headless: the right answer wins it, the wrong
// one is turned away but never for long (its answer comes), and nothing is left invulnerable.

setHintLevel('full');
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function player(o = {}) {
  return { pos: v(), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: 0, hurt() { this.hurts++; }, knockDown() { return true; }, stagger() {}, flinch() {}, ...o };
}
function arena(kind, o = {}) {
  clearTargets();
  const notes = [], P = player(o);
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), notice: (t) => notes.push(t) });
  const f = foes.add(kind, v(0, 0, o.at ?? 2.4)); f.heading = Math.PI;   // (facing the traveller at the origin)
  return { foes, f, P, notes, done: () => { foes.dispose(); clearTargets(); } };
}
const FRONT = v(0, 0, 1), SIDE = v(1, 0, 0);
/** Run the Arena until its guard is up (its blow held off: cool). */
function raise(foes, f) {
  for (let i = 0; i < 100 && f.guardK < 1; i++) { f.cool = Math.max(f.cool, 3); foes.update(DT); }   // (after its alert beat: issue #722)
  return f.guardK;
}
const light = (n = 0) => ({ damage: n === 2 ? 2 : 1, combo: n });
const CHARGED = { damage: 2, combo: 2, breaks: true, charged: false };
const PLUNGE = { damage: 2, combo: 2, air: true };

test('the breaker of each blow: the charged cut, the air cut’s plunge (not the air combo’s light swings), a bomb, the riposte', () => {
  const G = { breaks: ['charged', 'air', 'bomb', 'riposte'] };
  assert.equal(guardBreaker(G, 'blade', CHARGED), 'charged');
  assert.equal(guardBreaker(G, 'blade', PLUNGE), 'air');
  assert.equal(guardBreaker(G, 'blade', { damage: 1, combo: 0, air: true }), null, 'a light air swing glances');
  assert.equal(guardBreaker(G, 'blade', { damage: 2, combo: 2, source: 'bomb' }), 'bomb');
  assert.equal(guardBreaker(G, 'blade', { damage: 3, breaks: true, riposte: true }), 'riposte');
  assert.equal(guardBreaker(G, 'blade', light(2)), null, 'the combo’s third swing glances');
  assert.equal(guardBreaker({ breaks: ['air'] }, 'blade', CHARGED), null, 'only its own breaker');
});

test('a guard covers its front arc; all round for the crab’s clamped shell', () => {
  const G = { arc: 1.05 };
  assert.ok(guardCovers(G, Math.PI, FRONT), 'a blow into its face');
  assert.ok(!guardCovers(G, Math.PI, SIDE), 'a blow into its side');
  assert.ok(!guardCovers(G, Math.PI, v(0, 0, -1)), 'a blow into its back');
  assert.ok(guardCovers({ arc: Math.PI }, Math.PI, v(0, 0, -1)), 'all round');
});

test('a guard is raised only chasing you, near, not stunned, not past its hold', () => {
  const G = FOES.brute.guard, f = { def: FOES.brute, state: 'chase', stunned: 0, guardRest: 0, guardT: 0 };
  assert.ok(wantsGuard(f, 3, G));
  assert.ok(!wantsGuard({ ...f, state: 'wind' }, 3, G), 'not while it winds up');
  assert.ok(!wantsGuard(f, G.near + 1, G), 'not from afar');
  assert.ok(!wantsGuard({ ...f, stunned: 1 }, 3, G));
  assert.ok(!wantsGuard({ ...f, guardT: G.hold }, 3, G), 'never held for ever');
  assert.ok(!wantsGuard({ ...f, guardRest: 0.5 }, 3, G));
});

test('the guarded kinds: a few, each with its own breaker and an answer to spam, every window short (0.6-1.5 s)', () => {
  const guarded = Object.entries(FOES).filter(([, D]) => D.guard).map(([k]) => k).sort();
  assert.deepEqual(guarded, ['brute', 'crab', 'fencer', 'shade'], 'a few archetypes, not all');
  for (const k of guarded) {
    const G = FOES[k].guard;
    assert.ok(G.breaks.length >= 1 && G.hint, `${k}: a breaker and a hint`);
    assert.ok(G.hold <= 3 && G.rest >= 1.5, `${k}: held at most 3 s, then down a while`);
    assert.ok(G.open >= 0.6 && G.open <= 1.5, `${k}: a short window (${G.open} s), not a long free stun`);
    assert.ok(FOES[k].attacks.some((a) => a.id === G.counter), `${k}: its answer (${G.counter}) is one of its blows`);
  }
  const breakers = new Set(guarded.map((k) => FOES[k].guard.breaks[0]));
  assert.ok(breakers.size >= 3, `different breakers: ${[...breakers]}`);
});

test('the furnace brute: light cuts ring off its forearms, the charged cut smashes through into a short window of double cuts', () => {
  const { foes, f, done } = arena('brute', { at: 2.8 });
  assert.equal(raise(foes, f), 1, 'its forearms come up as you come near');
  const hp = f.hp;
  for (let i = 0; i < 2; i++) foes.hurt(f, 'blade', FRONT, light(i));
  assert.equal(f.hp, hp, 'no harm through the guard');
  assert.equal(f.blocked, 2);
  assert.match(FOES.brute.guard.hint, /charged cut/, 'what breaks it, said the first time (tips)');
  foes.hurt(f, 'blade', FRONT, { ...CHARGED });
  assert.equal(f.reel, 'guardbroken');
  assert.ok(f.stunned >= 1 && f.stunned <= 1.5, `open ${f.stunned} s`);
  assert.equal(f.hp, hp - 2, 'the charged cut lands');
  assert.ok(['stagger', 'down'].includes(f.react.kind), 'its body thrown into the stagger (its poise broken by the charged cut too: down, issue #722)');
  foes.hurt(f, 'blade', FRONT, light(0));
  assert.equal(f.hp, hp - 4, 'the first cut into the window lands double');
  done();
});

test('the furnace brute: round its side the guard does not reach; three cuts into it and it answers with its backhand', () => {
  const { foes, f, done } = arena('brute', { at: 2.8 });
  raise(foes, f);
  const hp = f.hp;
  foes.hurt(f, 'blade', SIDE, light(0));
  assert.ok(f.hp < hp, 'the side is open');
  raise(foes, f);
  for (let i = 0; i < 3; i++) foes.hurt(f, 'blade', FRONT, light(i));
  foes.update(DT);
  assert.equal(f.state, 'wind', 'spam is answered at once');
  assert.equal(f.atk.id, 'sweep');
  assert.equal(f.guardK, 0, 'its guard down while it swings');
  // and it can be cut while it swings (never untouchable)
  const before = f.hp; foes.hurt(f, 'blade', FRONT, light(0));
  assert.ok(f.hp < before, 'its swing is open to a cut');
  done();
});

test('the shellback crab: its clamped shell turns every side, the air cut onto it flips it open; spam brings its snap', () => {
  const { foes, f, done } = arena('crab', { at: 2.2 });
  assert.equal(raise(foes, f), 1);
  const hp = f.hp;
  foes.hurt(f, 'blade', SIDE, light(0));
  foes.hurt(f, 'blade', v(0, 0, -1), { damage: 2, combo: 2, dash: true, source: 'dash' });
  assert.equal(f.hp, hp, 'side and back both ring off');
  foes.hurt(f, 'blade', FRONT, CHARGED);
  assert.equal(f.hp, hp, 'even the charged cut: only the plunge from above cracks it');
  foes.update(DT);
  assert.equal(f.state, 'wind', 'the third blow into it: it springs out into its snap');
  assert.equal(f.atk.id, 'snap');
  done();
  const B = arena('crab', { at: 2.2 });
  raise(B.foes, B.f);
  B.foes.hurt(B.f, 'blade', FRONT, PLUNGE);
  assert.equal(B.f.reel, 'guardbroken');
  assert.ok(B.f.flipped > 1, 'on its back');
  assert.ok(B.f.hp < 3, 'the plunge lands');
  B.done();
});

test('the shade: its sword turns two cuts, then it answers with its cut; parried, it stands open to the riposte', () => {
  let guard = null;
  const { foes, f, P, done } = arena('shade', { at: 2.2, guard: () => guard });
  raise(foes, f);
  const hp = f.hp;
  foes.hurt(f, 'blade', FRONT, light(0)); foes.hurt(f, 'blade', FRONT, light(1));
  assert.equal(f.hp, hp);
  foes.update(DT);
  assert.equal(f.state, 'wind'); assert.equal(f.atk.id, 'cut');
  // its cut, parried as it lands
  guard = 'perfect';
  for (let i = 0; i < 120 && f.state !== 'recover'; i++) foes.update(DT);
  assert.equal(f.state, 'recover');
  assert.ok(f.stunned > 1, 'parried: stunned');
  assert.equal(P.hurts, 0);
  foes.hurt(f, 'blade', FRONT, { damage: 3, breaks: true, stagger: 1.2, riposte: true });
  assert.ok(f.hp <= hp - 6 || !f.alive, 'the riposte lands double on the stunned');
  done();
});

test('no stalemate: the wrong attack spammed at each guard ends in a blow you can answer, within a few seconds', () => {
  for (const kind of ['brute', 'crab', 'shade', 'fencer']) {
    const { foes, f, done } = arena(kind, { at: kind === 'crab' ? 2.2 : 2.6 });
    raise(foes, f);
    let t = 0, answered = false;
    for (; t < 6 && !answered; t += DT) {
      if (Math.round(t / DT) % 24 === 0 && f.state === 'chase') foes.hurt(f, 'blade', FRONT, light(0));   // (a light cut every 0.4 s)
      foes.update(DT);
      answered = f.state === 'wind';
    }
    assert.ok(answered, `${kind}: it answers the spam`);
    assert.ok(t < 3, `${kind}: within ${t.toFixed(2)} s`);
    done();
  }
});

test('attack-specific perfect dodge: a sweep asks for the back flip, an overhead or a thrust for the side hop', () => {
  assert.ok(hopFits({ dodge: 'back' }, 'back'));
  assert.ok(!hopFits({ dodge: 'back' }, 'left'));
  assert.ok(hopFits({ dodge: 'side' }, 'right') && hopFits({ dodge: 'side' }, 'left'));
  assert.ok(!hopFits({ dodge: 'side' }, 'back'));
  assert.ok(hopFits({}, 'back') && hopFits({ dodge: 'any' }, 'left'), 'unset: any hop');
  assert.ok(hopFits({ dodge: 'back' }, null), 'the hop unknown (a test, a guardian): any');
  const th = { t: 0.1, wind: 1, near: true, a: { dodge: 'side' } };
  assert.ok(perfectAgainst(th, false, 'left'));
  assert.ok(!perfectAgainst(th, false, 'back'));
  assert.equal(FOES.brute.attacks.find((a) => a.id === 'sweep').dodge, 'back');
  assert.equal(FOES.shade.attacks.find((a) => a.id === 'feint').dodge, 'side');
});

test('the guard rises over STANCE.raise and drops the moment it winds up', () => {
  const { foes, f, done } = arena('brute', { at: 2.8 });
  f.cool = 3; f.state = 'chase';
  let n = 0;
  while (f.guardK < 1 && n < 60) { foes.update(DT); n++; }
  assert.ok(n * DT <= STANCE.raise + 0.1, `raised in ${(n * DT).toFixed(2)} s`);
  f.cool = 0;
  // (its move by weight, maybe one it steps back to throw first: issue #722)
  for (let i = 0; i < 150 && f.state === 'chase'; i++) foes.update(DT);
  for (let i = 0; i < 12; i++) foes.update(DT);
  assert.notEqual(f.state, 'chase');
  assert.ok(f.guardK < 0.2);
  done();
});

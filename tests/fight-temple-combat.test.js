import test from 'node:test';
import assert from 'node:assert/strict';
import { FluidBlade, ROLL, EVADE } from '../src/fluid-blade.js';
import { Reserve } from '../src/fluid-tool.js';
import { templeCombat, TEMPLE_COMBAT } from '../src/fight-temples/combat.js';
import { resetFeel } from '../src/feel.js';

function setup() {
  resetFeel();
  const blade = Object.assign(Object.create(FluidBlade.prototype), {
    tool: {}, evadeSpec: ROLL, evadeT: ROLL.duration - 0.1, evadeAge: 0.1,
    evadeGranted: true, hopAge: Infinity, hopGranted: false, dodged: false,
  });
  const reserve = new Reserve(3); reserve.level = 0;
  let rewards = 0, live = true;
  const elite = { gorged: true, hp: 10 }, ordinary = { hp: 10 };
  const foes = { hurt(f, mode, dir, info) { f.hp -= info.damage; return 'hit'; } };
  const original = foes.hurt;
  const restore = templeCombat({ blade, foes, reserve, active: () => live,
    contains: (f) => f === elite || f === ordinary, reward: () => rewards++ });
  return { blade, reserve, foes, elite, ordinary, original, restore, rewards: () => rewards, pause: () => live = false };
}

test('only a real blow inside a roll pays, once per roll; burn and ordinary evades never pay', () => {
  const s = setup(), b = s.blade;
  b.evadeAge = 0;
  assert.equal(b.dodge(null), false);
  assert.equal(s.rewards(), 0);
  b.evadeAge = 0.1;
  assert.equal(b.dodge(null, 'burn'), true);
  assert.equal(s.rewards(), 0);
  assert.equal(b.dodge(null), 'perfect');
  assert.equal(s.rewards(), 1); assert.equal(s.reserve.level, 1);
  assert.equal(b.dodge(null), true); assert.equal(s.rewards(), 1);
  b.dodged = false; b.evadeSpec = EVADE;
  b.dodge(null); assert.equal(s.rewards(), 1);
  s.restore();
});

test('reward caps the tank and is inactive outside a live fight; teardown removes callbacks', () => {
  const s = setup(); s.reserve.level = 2.8;
  s.blade.dodge(null); assert.equal(s.reserve.level, 3);
  s.pause(); s.blade.dodged = false; s.blade.dodge(null);
  assert.equal(s.rewards(), 1);
  s.restore(); assert.equal(s.blade.onRollDodge, undefined); assert.equal(s.foes.hurt, s.original);
});

test('full charged cuts and ripostes gain two against temple elites, never ordinary cuts or unrelated foes', () => {
  const s = setup(), hit = (foe, info, mode = 'blade') => {
    const hp = foe.hp; assert.equal(s.foes.hurt(foe, mode, null, info), 'hit'); return hp - foe.hp;
  };
  const info = { damage: 3, charged: true };
  assert.equal(hit(s.elite, info), 5); assert.deepEqual(info, { damage: 3, charged: true });
  assert.equal(hit(s.elite, { damage: 2, riposte: true }), 4);
  assert.equal(hit(s.elite, { damage: 2, breaks: true, charged: false }), 2);
  assert.equal(hit(s.ordinary, info), 3);
  assert.equal(hit({ gorged: true, hp: 10 }, info), 3);
  assert.equal(hit(s.elite, info, 'shoot'), 3);
  s.restore(); assert.equal(hit(s.elite, info), 3);
});

test('a spent shot returns after a short pause but holding fire cannot refill the tank', () => {
  const r = new Reserve(3, TEMPLE_COMBAT.refillDelay, TEMPLE_COMBAT.refillRate);
  for (let i = 0; i < 3; i++) { assert.ok(r.use()); r.update(0.2); }
  assert.equal(r.level, 0); assert.equal(r.use(), false);
  r.update(0.6); assert.equal(r.level, 0);
  r.update(1); assert.equal(r.level, 1); assert.ok(r.use());
});

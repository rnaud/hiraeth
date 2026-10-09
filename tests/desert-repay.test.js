// Qanat repays the traveller by repowering his ship (src/story/desert-repay.js): because he put the tree's water
// and fire back, the city chooses to help him in return, and its people pool what they can spare to fill the ship.
// The ship's power is their gift, never the tree's fire by itself, nor his jar alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { repayPlan, repayDue, REPAY_TIMING, setupRepay } from '../src/story/desert-repay.js';
import { REPAY, REPAY_CALL, QUESTS, PEOPLE } from '../src/story/desert-data.js';
import { parseLine } from '../src/story/tone.js';

const main = QUESTS.find((q) => q.id === 'desert.power');
const say = (who, node) => [PEOPLE[who].talk.nodes[node].say].flat().map((l) => (typeof l === 'string' ? l : l.text)).join(' ');

test('the gate: the ship is powered only once the tree burns and Qanat has brought its gift', () => {
  assert.equal(repayDue({ lit: false, fed: false }), false, 'a cold tree: nothing to give');
  assert.equal(repayDue({ lit: true, fed: false }), true, 'it burns: Qanat comes to the ship');
  assert.equal(repayDue({ lit: true, fed: true }), false, 'given once');
  const last = main.stages.at(-1);
  assert.equal(last.id, 'ship');
  assert.equal(last.flag, 'desert.ship.fed');
  assert.match(last.text, /Qanat is repaying you/);
  assert.match(main.outro, /gave Qanat back its light, and Qanat filled your ship/);
});

test('the beat: Nour calls him over, each brings something in turn, Nour last, then the ship wakes', () => {
  const plan = repayPlan(REPAY, REPAY_CALL);
  assert.equal(plan[0].kind, 'call');
  assert.equal(plan[0].who, 'nour');
  const gifts = plan.filter((b) => b.kind === 'gift');
  assert.deepEqual(gifts.map((b) => b.who), REPAY.map((g) => g.who));
  assert.ok(gifts.length >= 5, 'the village pools its things: several houses, not one jar');
  assert.equal(gifts.at(-1).who, 'nour');
  assert.ok(gifts.every((b, i) => i === 0 || Math.abs(b.at - gifts[i - 1].at - REPAY_TIMING.gap) < 1e-9));
  assert.equal(plan.at(-1).kind, 'fed');
  assert.ok(plan.at(-1).at > gifts.at(-1).at, 'after the last gift');
  // the reciprocity said in so many words, and every line with a tone
  assert.match(REPAY.at(-1).say, /You gave us back our light, child\. So Qanat gives your ship its own/);
  for (const l of [REPAY_CALL, ...REPAY.map((g) => g.say)]) assert.ok(parseLine(l).explicit, l);
});

test('the words: Qanat helps because he helped; the tree alone never powers the ship', () => {
  // Marrow: the ship is drained; only the whole city held that much, and it doesn't give its fire to strangers
  assert.match(say('marrow', 'fire'), /drained/);
  assert.match(say('marrow', 'fire'), /doesn’t hand its fire to strangers/);
  // Nour: help us, and Qanat will see to your ship
  assert.match(say('nour', 'power'), /Qanat will not let you leave in the dark/);
  assert.match(say('nour', 'why'), /Qanat will see to your ship/);
  assert.match(say('nour', 'drinking'), /Qanat pays its debts/);
  for (const [who, node] of [['ama', 'power'], ['nour', 'power'], ['nour', 'why'], ['ama', 'drinking'], ['nour', 'drinking']]) {
    assert.ok(!/water will power your ship|glowing water to your ship|Take it to the ship|Take your jar to the ship/.test(say(who, node)), `${who}.${node}`);
  }
});

test('the people: they go down to the ship, pour in turn, and the flag is set once, at the end', () => {
  const V = (x, z) => ({ x, y: 0, z, clone() { return V(this.x, this.z); }, copy(o) { this.x = o.x; this.z = o.z; return this; }, distanceTo(o) { return Math.hypot(this.x - o.x, this.z - o.z); } });
  const mk = (x) => ({ pos: V(x, 300), route: [V(x, 300)], seat: 0.02, heading: 0, time: 0 });
  const people = Object.fromEntries(REPAY.map((g, i) => [g.who, mk(i)]));
  let lit = false, fed = 0;
  // (THREE vectors for the spots: the module works in them; the stub ramp and hull are plain points)
  const r = setupRepay({ sound: null }, {
    people, gifts: REPAY, call: REPAY_CALL,
    ramp: () => ({ x: 0, y: 0, z: 0, clone() { return { ...this, clone: this.clone, addScaledVector(v, k) { this.x += v.x * k; this.z += v.z * k; return this; } }; } }),
    hull: () => ({ x: 0, y: 0, z: -14 }),
    lit: () => lit, fed: () => fed > 0, feed: () => { fed++; },
  });
  const far = { x: 0, z: 300 }, near = { x: 0, z: 5 };
  r.update(1, far);
  assert.equal(r.state.placed, false, 'a cold tree: nobody goes anywhere');
  lit = true;
  r.update(1, far);
  assert.equal(r.state.placed, false, 'not at once: the tree catches first');
  for (let t = 0; t < 30; t++) r.update(1, far);
  assert.equal(r.state.placed, true, 'they set off for the ship');
  assert.ok(Object.values(people).every((n) => n.follow && n.seat === null), 'every one of them, off their seats');
  assert.equal(fed, 0, 'nothing until he comes');
  r.update(0.1, near);
  assert.ok(r.state.t >= 0, 'he comes to the ship: it starts');
  for (let t = 0; t < 40 && !fed; t += 0.1) r.update(0.1, near);
  assert.equal(fed, 1, 'the ship is filled, once');
  for (let t = 0; t < 10; t++) r.update(1, near);
  assert.equal(fed, 1);
  r.update(1, { x: 0, z: 400 });
  assert.equal(r.state.home, true, 'and home again once he has gone');
});

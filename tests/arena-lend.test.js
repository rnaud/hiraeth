// The Arena lends the backpack for the visit (src/levels/arena.js lendTool, main.js): the blade and the
// shield are there on any save, a brand-new one too, and nothing is written to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lendTool } from '../src/minigames/kit/onfoot.js';

test('the Arena asks for the tool lent, and main.js lends it', () => {
  assert.match(readFileSync(new URL('../src/levels/arena.js', import.meta.url), 'utf8'), /lendTool:\s*\{/);
  assert.match(readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /if \(level\.lendTool\) lendTool\(tool, level\.lendTool\)/);
});

test('lent with no size given: the save\'s own tank (its upgrades still apply); a game lent inside it puts back the Arena\'s lending', () => {
  const owned = new Set();
  const items = { has: (id) => owned.has(id), on: () => () => {}, owned: () => [...owned] };
  const R = { max: 3, delay: 2, level: 0, fill() { this.level = this.max; } };
  const proto = { get dry() { return true; }, get modes() { return this.items.has('backpack') ? ['shoot'] : []; }, shimmer() {} };
  const tool = Object.assign(Object.create(proto), { items, reserve: R, mode: 'shoot', enabled: false });
  const arena = lendTool(tool, { mode: null });
  assert.equal(tool.items.has('backpack'), true, 'a brand-new save: the backpack lent');
  assert.equal(owned.has('backpack'), false, 'not written to the save');
  assert.equal(tool.dry, false);
  R.max = 5;   // (an upgrade of the save's tank)
  assert.equal(R.max, 5, 'the save\'s own tank');
  const game = lendTool(tool, { max: 3, delay: 2 });   // (Ink tide, played in the Arena)
  assert.equal(R.max, 3);
  game();
  assert.equal(tool.dry, false, 'back to the Arena\'s lending: still not dry');
  assert.equal(tool.items.has('backpack'), true);
  arena();
  assert.equal(tool.dry, true); assert.equal(tool.items, items);
});

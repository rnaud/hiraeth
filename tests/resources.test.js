// Hearts, the magic bar and the potions (src/resources.js; docs/systems/items.md "Hearts, magic and potions").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { HEARTS, MAGIC, MAGIC_COST, MAGIC_ITEMS, POTION, DAMAGE, HIT, quarters, strikeDamage, sparing, heartsOf, meetsWith, Resources, RES_VERSION } from '../src/resources.js';
import { GameState } from '../src/game-state.js';
import { migrateFlags, MIGRATED } from '../src/save-migrate.js';
import { Reserve, FLUID } from '../src/fluid-tool.js';
import { FOES, GENTLE } from '../src/foes.js';
import { ATTACKS } from '../src/enemies/attacks.js';
import { heartsSvg, heartQuarters, magicHud, healthHud, Fader } from '../src/hud.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** A store of items for one test: has / owned. */
const itemSet = (...ids) => { const s = new Set(ids); return { has: (id) => s.has(id), grant: (id) => s.add(id), revoke: (id) => s.delete(id) }; };
const DT = 1 / 60;

test('hearts: three to start, every hurt counted in quarters; an ordinary blow is half a heart', () => {
  assert.equal(HEARTS.start, 3);
  assert.equal(quarters(0), 0); assert.equal(quarters(-1), 0);
  assert.equal(quarters(0.01), 0.25, 'any hurt at all: at least a quarter');
  assert.equal(quarters(0.3), 0.25); assert.equal(quarters(0.4), 0.5); assert.equal(quarters(0.5), 0.5);
  assert.equal(quarters(0.375), 0.25, 'a tie rounds down (halving three quarters gives one)');
  assert.equal(DAMAGE.blow, 0.5, 'the baseline');
  assert.ok(DAMAGE.graze < DAMAGE.blow && DAMAGE.blow < DAMAGE.heavy && DAMAGE.heavy < DAMAGE.crushing && DAMAGE.crushing <= DAMAGE.fall);
});

test('the damage table: every foe and guardian attack in whole quarters, ordinary ones half a heart, nothing over a heart', () => {
  const all = [];
  for (const [kind, D] of Object.entries(FOES)) for (const a of D.attacks) {
    all.push([`${kind}.${a.id}`, a.damage]);
    if (a.wave) all.push([`${kind}.${a.id}.wave`, a.wave.damage]);
  }
  for (const [id, a] of Object.entries(ATTACKS)) all.push([`world.${id}`, a.damage]);
  for (const [id, d] of all) {
    if (!d) continue;   // (a blink, a step: no blow)
    assert.equal(d * 4, Math.round(d * 4), `${id}: whole quarters (${d})`);
    assert.ok(d >= 0.25 && d <= 1, `${id}: a quarter to a heart (${d})`);
  }
  assert.equal(FOES.blot.attacks.find((a) => a.id === 'lunge').damage, DAMAGE.blow, 'the ink blot\'s lunge: the baseline');
  assert.equal(FOES.machine.attacks.find((a) => a.id === 'slam').damage, DAMAGE.crushing, 'a machine\'s slam: a heart');
  // the guardians' strikes: half a heart (a combo's link, a volley's shard) to a heart
  const dir = new URL('../src/temples/', import.meta.url);
  let n = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    for (const m of src(`src/temples/${f}`).matchAll(/wind: [\d.]+,[^}]*?damage: ([\d.]+)/g)) {
      const d = +m[1]; n++;
      assert.ok(d >= DAMAGE.blow && d <= DAMAGE.crushing && d * 4 === Math.round(d * 4), `${f}: a guardian strike of ${d} hearts`);
    }
  }
  assert.ok(n >= 30, `every guardian's strikes read (${n})`);
});

test('Gentle halves the foes\' harm, still in quarters, never under one', () => {
  assert.equal(GENTLE.harm, 0.5);
  const harmOf = (d) => quarters(d * GENTLE.harm);
  assert.equal(harmOf(1), 0.5); assert.equal(harmOf(0.5), 0.25); assert.equal(harmOf(0.75), 0.25); assert.equal(harmOf(0.25), 0.25);
  // (since v1.22 the last worlds' stage raises it too, after Gentle's half: HARM_BY_STAGE, tests/archetypes.test.js)
  assert.match(src('src/foes.js'), /harmOf\(d\) \{ return quarters\(d \* \(this\.difficulty === 'gentle' \? GENTLE\.harm : 1\) \* \(HARM_BY_STAGE\[this\.stageHere\] \?\? 1\)\); \}/);
});

test('the forgiving rule: one blow never takes you from more than a heart to nothing; falls and drowning never take the last quarter', () => {
  assert.equal(strikeDamage(3, 0.5), 0.5);
  assert.equal(strikeDamage(3, 9), 3 - HIT.floor, 'from full: a quarter left');
  assert.equal(strikeDamage(1.25, 1), 1, 'a heart and a quarter, a heart\'s blow: a quarter left');
  assert.equal(strikeDamage(1.25, 2), 1, 'a bigger one too');
  assert.equal(strikeDamage(1, 1), 1, 'at one heart, a blow can knock you out');
  assert.equal(sparing(0.5, 2), 0.25); assert.equal(sparing(0.25, 1), 0);
  assert.equal(heartsOf({ hearts: 1.5 }), 1.5);
  assert.equal(heartsOf({ health: 0.5 }), 1.5, 'a stand-in with only a share counts as three hearts');
});

test('potions: a count, three to start and five at most since the first shop; two hearts each; the dev menu can make them infinite', () => {
  assert.equal(POTION.heal, 2);
  assert.ok(POTION.at < POTION.time && POTION.time <= 1.2, 'a short drink');
  assert.equal(POTION.start, 3); assert.equal(POTION.cap, 5);
  const g = new GameState(null), R = new Resources(g, itemSet());
  assert.deepEqual(R.potions, { count: 3, infinite: false }, 'a new save: three');
  assert.ok(R.takePotion() && R.takePotion() && R.takePotion());
  assert.equal(R.takePotion(), false, 'none left');
  assert.equal(R.addPotions(2), 2);
  assert.deepEqual(R.potions, { count: 2, infinite: false });
  assert.equal(R.addPotions(9), 3, 'up to the carry cap');
  assert.equal(R.potions.count, POTION.cap);
  assert.ok(R.takePotion() && R.takePotion());
  assert.equal(g.flag('res.potions'), 3, 'kept in the save');
  R.setPotionsInfinite(true);
  for (let i = 0; i < 50; i++) assert.equal(R.takePotion(), true, 'infinite (the dev menu): never runs out');
  assert.equal(R.potions.count, 3);
});

test('the magic bar: three units (a unit is what a chamber was); refills 1 s after the last spend, empty to full in 4 s', () => {
  assert.equal(MAGIC.start, 3); assert.equal(MAGIC.delay, 1); assert.equal(MAGIC.fill, 4);
  assert.equal(FLUID.charges, MAGIC.start);
  for (const k of ['shoot', 'push', 'boost', 'shield', 'gadget']) assert.equal(MAGIC_COST[k], 1, `${k}: a third of the starting bar`);
  assert.equal(MAGIC_COST.jets, 0.3, 'the jets: ten seconds on the starting bar');
  assert.equal(FLUID.jet.drain, MAGIC_COST.jets);
  const r = new Reserve();
  assert.ok(r.use(MAGIC_COST.shoot) && r.use(MAGIC_COST.push) && r.use(MAGIC_COST.boost));
  assert.equal(r.use(), false, 'spent');
  let t = 0;
  while (r.level < 1e-9 && t < 5) { r.update(DT); t += DT; }
  assert.ok(Math.abs(t - MAGIC.delay) < 2 * DT, `it starts after ${t.toFixed(2)} s`);
  while (r.level < r.max && t < 10) { r.update(DT); t += DT; }
  assert.ok(Math.abs(t - MAGIC.delay - MAGIC.fill) < 2 * DT, `full ${t.toFixed(2)} s after the last spend`);
  // a burn holds it (the jets: the bar waits for the ground)
  r.drain(1); for (let i = 0; i < 120; i++) { r.hold(); r.update(DT); }
  assert.equal(r.level, 2, 'held: nothing back');
});

test('the upgrades: the fourth chamber lengthens the bar a unit, the coil quickens it; magic:4 is a capacity threshold', () => {
  const g = new GameState(null), it = itemSet('backpack'), R = new Resources(g, it);
  assert.equal(R.maxMagic, 3);
  assert.deepEqual(R.magicPace, { delay: MAGIC.delay, rate: MAGIC.start / MAGIC.fill });
  assert.equal(R.meets('magic:4'), false, 'the Engine-House door: not with the starting bar');
  it.grant('cell');
  assert.equal(MAGIC_ITEMS.cell, 1);
  assert.equal(R.maxMagic, 4, 'the fourth chamber: a fourth unit');
  assert.equal(R.meets('magic:4'), true);
  assert.equal(R.meets('backpack'), true, 'any other requirement: an item');
  it.revoke('cell'); R.addMagic(1);
  assert.equal(R.maxMagic, 4, 'an expansion from elsewhere (a shop, later) opens it too');
  it.grant('coil');
  assert.deepEqual(R.magicPace, { delay: MAGIC.coil.delay, rate: MAGIC.start / MAGIC.coil.fill });
  R.addHeartContainer();
  assert.equal(R.maxHearts, 4, 'a heart container (later: the shops)');
  // the temple solver reads the same: the items alone
  assert.equal(meetsWith((x) => x === 'backpack', 'magic:4'), false);
  assert.equal(meetsWith((x) => x === 'cell', 'magic:4'), true);
  // the requirements that wanted the fourth chamber now want the capacity
  assert.match(src('src/temples/buried.js'), /needs: \['magic:4'\]/);
  assert.match(src('src/trials/kit-data.js'), /needs: \['backpack', 'magic:4'\]/);
  assert.doesNotMatch(src('src/temples/buried.js'), /needs: \[[^\]]*'cell'/);
});

test('the Engine-House\'s four eyes in a breath (2.6 s): the starting bar can\'t, the fourth chamber can; the coil\'s six in 4.6 s', () => {
  const shots = (n, max, pace) => {
    const R = new Reserve(max, pace.delay, pace.rate);
    let k = 0, cool = 0, t = 0, first = -1;
    for (let i = 0; i < 20 / DT && k < n; i++) { if (cool <= 0 && R.use()) { if (first < 0) first = t; k++; cool = 0.28; } cool -= DT; t += DT; R.update(DT); }
    return t - first;
  };
  const base = { delay: MAGIC.delay, rate: MAGIC.start / MAGIC.fill }, coil = { delay: MAGIC.coil.delay, rate: MAGIC.start / MAGIC.coil.fill };
  assert.ok(shots(4, 3, base) > 2.6, 'three units: the fourth comes too late');
  assert.ok(shots(4, 4, base) < 2.6, 'four units: four at once');
  assert.ok(shots(6, 3, base) > 4.6 && shots(6, 4, base) > 4.6, 'six without the coil: too slow');
  assert.ok(shots(6, 3, coil) < 4.6, 'with the coil: in time');
});

test('old saves: the format stamped once, the fourth chamber read as a longer bar; a new game starts current', () => {
  const old = { 'item.backpack': true, 'item.cell': true, 'item.coil': true, 'save.migrated': 3, 'quest.desert.power': 'done' };
  assert.equal(migrateFlags(old), true);
  assert.equal(old['res.v'], RES_VERSION);
  assert.equal(old['save.migrated'], MIGRATED());
  const g = new GameState({ getItem: () => JSON.stringify({ flags: old }), setItem() {} });
  const R = new Resources(g, { has: (id) => !!g.flag(`item.${id}`) });
  assert.equal(R.maxMagic, 4, 'a save that had the fourth chamber: a bar of four');
  assert.equal(R.meets('magic:4'), true, 'and the Engine-House doors still open');
  assert.equal(R.magicPace.delay, MAGIC.coil.delay, 'the coil still quick');
  assert.deepEqual(R.potions, { count: POTION.cap, infinite: false }, 'potions were infinite before the shop: a full stock now');
  const fresh = new GameState(null); fresh.reset();
  assert.equal(fresh.flag('res.v'), RES_VERSION);
});

test('the HUD: inked hearts filled by quarters, the magic bar with a tick per unit, the potion', () => {
  assert.deepEqual(heartQuarters(3, 3), [4, 4, 4]);
  assert.deepEqual(heartQuarters(1.75, 3), [4, 3, 0]);
  assert.deepEqual(heartQuarters(0.25, 4), [1, 0, 0, 0]);
  const svg = heartsSvg(1.75, 3, { low: false });
  assert.equal((svg.match(/data-q=/g) ?? []).length, 3, 'three hearts');
  assert.match(svg, /data-q="3"/, 'a three-quarter heart');
  assert.match(svg, /clip-path="url\(#hq1\)"/, 'drawn by its quarters');
  assert.match(svg, /class="hq"/, 'with its quarter lines (a quarter reads at any size)');
  assert.match(svg, /class="ho"/, 'and the ink outline');
  assert.match(heartsSvg(0.5, 3, { low: true }), /class="h low" data-q="2"/, 'the last heart pulses when low');
  assert.deepEqual(magicHud(1.5, 3), { fill: 0.5, units: 3, short: false });
  assert.equal(magicHud(0.4, 4).short, true, 'short of a unit: it says so (hatched)');
  const html = src('index.html');
  assert.match(html, /<div id="health"[^>]*><div class="row"><span class="hearts"><\/span><button type="button" class="potion"/, 'the hearts and the potion, where the bar was');
  assert.match(html, /<div class="magic"><i><\/i><u><\/u><\/div>/, 'the magic bar under them');
  assert.match(src('src/ship/cinema.js'), /OBSTACLES = \['#health'/, 'notices stay clear of all of it');
  const s = healthHud({ hearts: 2, max: 3, magic: 3, magicMax: 3, potions: 0, infinite: true }, new Fader(3), 0.1);
  assert.equal(s.potions, 0); assert.equal(s.infinite, true);
});

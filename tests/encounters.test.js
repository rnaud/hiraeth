// The encounter sites (issue #722, src/encounters/): the data (every route world has its sites, each built from its own
// roster), the layout of each kind, and the sites at work against the real Foes in a flat world: the foes come out calm
// in their idle, a sleeper takes a sneak strike, one noticing you wakes the rest, a site cut down is cleared for good and
// its coffer pays once, and no wandering pack comes in round a site still to clear. And the wandering packs (B10): a pack
// stands together where the ground holds all of it, or waits; its fillers are the world's own. Where every site stands in
// its world (on the ground, off the path, clear of doors, people, the landing and the temples) is checked on the worlds as
// the play-through builds them: tests/route-worlds.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SITES, SITE, SITE_PURSE, layoutSite, siteFootprint, sitesOf, siteFlag, cofferFlag } from '../src/encounters/sites.js';
import { Encounters, siteFlammables, BODIES } from '../src/encounters/index.js';
import { makeIdle, restPose, IDLE } from '../src/encounters/idle.js';
import { Foes, FOES, PACK } from '../src/foes.js';
import { WORLDS, ROSTERS, packOf, worldArchetypes, costOf, GROUP, GROUP_COST, BUDGET } from '../src/foe-worlds.js';
import { spawnKindOf } from '../src/enemies/archetypes.js';
import { ORDER, DISCARDED, partsOf } from '../src/levels/names.js';
import { GameState } from '../src/game-state.js';
import { ChimeField, connectDrops } from '../src/chimes.js';
import { clearTargets } from '../src/targets.js';
import { clearInteractables, allInteractables } from '../src/interact.js';
import { hintsFor } from '../src/hint-level.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 30;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function player(at = v()) {
  return { pos: at, vel: v(), heading: 0, hearts: 3, maxHearts: 3, down: null, dead: false, ride: null, onGround: true, hurt() {}, knockDown() { return true; }, frame: { up: v(0, 1, 0) } };
}
const { hovers } = BODIES;

test('every world on the route has three to six sites, none in a discarded world, each built from its own roster', () => {
  for (const w of ORDER) {
    const list = sitesOf(w);
    assert.ok(list.length >= 3 && list.length <= 6, `${w}: ${list.length} sites`);
    assert.equal(new Set(list.map((s) => s.id)).size, list.length, `${w}: ids unique`);
    assert.ok(new Set(list.map((s) => s.kind)).size >= 3, `${w}: at least three kinds of site`);
    const own = new Set(partsOf(w).flatMap(worldArchetypes));
    for (const s of list) {
      for (const a of [...s.foes, ...(s.lookout ? [s.lookout] : [])]) assert.ok(own.has(a), `${w}.${s.id}: ${a} is of ${w}'s roster`);
      assert.equal(s.at.length, 3, `${w}.${s.id}: at [x, y, z]`);
    }
  }
  for (const w of Object.keys(SITES)) assert.ok(ORDER.includes(w) && !DISCARDED.includes(w), `${w}: a route world`);
  // every kind is somewhere
  assert.deepEqual([...new Set(Object.values(SITES).flat().map((s) => s.kind))].sort(), ['ambush', 'camp', 'hoard', 'nest', 'patrol']);
});

test('each kind of site laid out: a camp round its fire with a lookout, a nest asleep, a hoard on guard, an ambush hidden, a patrol on its beat', () => {
  const at = [0, 0, 0];
  const camp = layoutSite({ kind: 'camp', at, heading: 0, foes: ['blot', 'blot', 'blot'], lookout: 'heron' });
  assert.equal(camp.foes.filter((f) => f.idle === 'sit').length, 3);
  assert.equal(camp.foes.filter((f) => f.idle === 'lookout').length, 1);
  for (const f of camp.foes.filter((x) => x.idle === 'sit')) assert.ok(Math.abs(Math.hypot(...f.at) - 2.9) < 0.01 && f.face, 'round the fire, facing it');
  const lookout = camp.foes.find((f) => f.idle === 'lookout');
  assert.ok(lookout.at[1] > 6, 'the lookout out front, toward the way in');
  assert.ok(camp.props.some((p) => p.type === 'fire') && camp.props.filter((p) => p.type === 'bramble').length >= 3);
  assert.ok(camp.coffer.at[1] < -4, 'the coffer behind the fire');
  // the logs clear of the sitters
  for (const l of camp.props.filter((p) => p.type === 'log')) for (const f of camp.foes) assert.ok(Math.hypot(l.at[0] - f.at[0], l.at[1] - f.at[1]) > 1.2, 'no log under a foe');
  const nest = layoutSite({ kind: 'nest', at, heading: 1, foes: ['crab', 'crab', 'crab'] }, BODIES);
  assert.ok(nest.foes.every((f) => f.idle === 'sleep' && Math.hypot(...f.at) < 3.4), 'asleep inside its ring');
  // no body in the coffer, nor in another, nor (round the fire) in a log
  for (const [kind, foes] of [['nest', ['toad', 'toad', 'toad']], ['camp', ['brute', 'toad', 'blot']], ['nest', Array(6).fill('skitter')]]) {
    const L = layoutSite({ kind, at, foes, lookout: kind === 'camp' ? 'heron' : undefined }, BODIES);
    const r = (f) => BODIES.radius(f.archetype), d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    for (const f of L.foes) {
      assert.ok(d(f.at, L.coffer.at) > r(f) + 0.6, `${kind} ${f.archetype}: clear of the coffer`);
      for (const g of L.foes) if (g !== f) assert.ok(d(f.at, g.at) > (r(f) + r(g)) * 0.75, `${kind}: ${f.archetype} clear of ${g.archetype}`);
      for (const l of L.props.filter((p) => p.type === 'log')) assert.ok(d(f.at, l.at) > r(f) + 0.3, `${kind} ${f.archetype}: clear of a log`);
    }
  }
  assert.ok(layoutSite({ kind: 'nest', at, foes: ['moth'] }, { hovers }).foes[0].idle === 'orbit', 'a flyer circles instead of sleeping');
  assert.ok(layoutSite({ kind: 'hoard', at, foes: ['brute', 'shade'] }).foes.every((f) => f.idle === 'guard'));
  const amb = layoutSite({ kind: 'ambush', at, foes: ['worm', 'worm'], sign: 'sand' });
  assert.ok(amb.foes.every((f) => f.idle === 'hidden') && amb.trigger === SITE.trigger && amb.props.some((p) => p.type === 'sand'));
  const pat = layoutSite({ kind: 'patrol', at, heading: 0, foes: ['shade', 'shade'], beat: 10 });
  assert.ok(pat.foes.every((f) => f.idle === 'patrol' && f.path.length === 2 && Math.hypot(f.path[1][0] - f.path[0][0], f.path[1][1] - f.path[0][1]) > 15));
  // turned with its heading: the front is where you come from
  const turned = layoutSite({ kind: 'camp', at: [10, 0, 10], heading: Math.PI / 2, foes: ['blot'], lookout: 'heron' });
  const lk = turned.foes.find((f) => f.idle === 'lookout');
  assert.ok(lk.at[0] > 16, 'heading π/2: the lookout out along +x');
  assert.ok(siteFootprint({ kind: 'camp', at, foes: ['blot'], lookout: 'heron' }).length >= 6);
});

test('the idles: a sleeper wakes only right beside it or to someone running up; a lookout sees you first; the body rests and wakes', () => {
  const f = { def: FOES.crab, pos: v(), home: v(), level: 0, chest: v(0, 0.6, 0), heading: 0, face() {}, walkTo() {}, provoked: false, state: 'idle', model: { rig: {} } };
  const P = player(v(0, 0, 5)), env = { seen: () => true };
  const sleep = makeIdle('sleep', { rng: () => 0.5 });
  assert.equal(sleep.calm(f, DT, P, 5, env), false, 'walked up to 5 m: asleep still');
  assert.equal(sleep.calm(f, DT, P, IDLE.sleep.near - 0.1, env), true, 'right beside it: it wakes');
  P.vel.set(7, 0, 0);
  assert.equal(sleep.calm(f, DT, P, 5, env), true, 'running up: it wakes');
  P.vel.set(0, 0, 0);
  assert.equal(sleep.sneak(), IDLE.sleep.sneak);
  const look = makeIdle('lookout'), sit = makeIdle('sit');
  assert.ok(look.reach(f) > sit.reach(f) * 1.8, `the lookout sees further (${look.reach(f)} m) than one sat by the fire (${sit.reach(f)} m)`);
  assert.equal(makeIdle('hidden').calm(f, DT, P, 0.5, env), false, 'a hidden one waits for its ambush to spring');
  assert.equal(look.calm(f, DT, P, 5, { seen: () => false }), false, 'not through a wall');
  // the rest pose eases in while it rests, out as it wakes
  f.idle = sleep;
  let pose = null; for (let i = 0; i < 60; i++) pose = restPose(f, DT, {});
  assert.ok(pose.y < 0 && pose.pitch > 0, 'lowered, head down');
  f.provoked = true; f.state = 'chase';
  for (let i = 0; i < 30; i++) pose = restPose(f, DT, pose ?? {});
  assert.equal(pose, null, 'awake: up on its feet');
});

function world({ sites = null, at = v(0, 0, 0), enemies = true } = {}) {
  clearTargets(); clearInteractables();
  const game = new GameState(null), P = player(at), toasts = [];
  const levelId = 'desert';
  const saved = SITES[levelId];
  if (sites) SITES[levelId] = sites;
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -900), id: levelId }, levelId, content: { npcs: [] }, physics: flat, player: P, settings: { enemies: enemies ? 'normal' : 'off' }, game, rng: seeded() });
  const E = new Encounters({ foes, scene: new THREE.Scene(), level: { id: levelId }, levelId, physics: flat, player: P, game, toast: (t) => toasts.push(t), teach: (t) => toasts.push(t), rng: () => 0.5 });
  const restore = () => { SITES[levelId] = saved; E.dispose(); foes.dispose(); };
  const step = (secs) => { for (let i = 0; i < secs / DT; i++) { foes.update(DT); E.update(DT, i * DT); } };
  return { game, P, foes, E, toasts, step, restore };
}

test('a camp at work: its foes come out calm, sat round the fire; one noticing you wakes the rest; cut down, it is cleared and its coffer pays once', () => {
  const camp = { id: 'test-fire', kind: 'camp', at: [0, 0, 0], heading: 0, foes: ['blot', 'blot', 'blot'], lookout: 'heron' };
  const W = world({ sites: [camp], at: v(0, 0, 60) });
  try {
    W.step(0.5);
    const out = W.foes.list.filter((f) => f.site);
    assert.equal(out.length, 4, 'three by the fire and the lookout, out as you came within reach');
    assert.ok(out.every((f) => !f.provoked && f.idle), 'calm, living their life there');
    assert.ok(out.filter((f) => f.idle.mode === 'sit').every((f) => Math.hypot(f.pos.x, f.pos.z) < 3.5), 'round the fire');
    assert.ok(W.E.sites[0].props.length >= 4 && W.E.sites[0].coffer, 'its things made (the fire, the logs, the lookout\'s post)');
    // no wandering pack round it
    W.step(PACK.settle + 2);
    assert.equal(W.foes.list.filter((f) => !f.site).length, 0, 'no pack comes in round a site still to clear');
    // you walk up to the lookout: it calls, and the camp wakes a moment after
    W.P.pos.set(3, 0, 16);
    W.step(0.2);
    const lookout = out.find((f) => f.idle.mode === 'lookout');
    assert.ok(lookout.provoked, 'the lookout saw you');
    W.step(1.2);
    assert.ok(out.every((f) => f.provoked), 'and the camp is up');
    // the coffer won't open before they are beaten
    const coffer = allInteractables().find((i) => i.id === 'site.desert.test-fire');
    assert.ok(coffer && !coffer.enabled(), 'shut while they stand');
    for (const f of out) { f.hp = 0; f.state = 'dead'; }
    W.step(3);
    assert.equal(W.game.flag(siteFlag('desert', 'test-fire')), true, 'cleared for good');
    assert.ok(W.toasts.some((t) => /camp is quiet/.test(t)));
    assert.ok(coffer.enabled(), 'now its coffer opens');
    // opened: a purse, once (src/chimes.js connectDrops)
    const field = new ChimeField({ groundAt: () => 0 }), off = connectDrops(W.game, field);
    coffer.use(W.P);
    const got = field.pieces?.reduce?.((a, p) => a + p.value, 0) ?? null;
    assert.equal(W.game.flag(cofferFlag('desert', 'test-fire')), true);
    if (got != null) assert.equal(got, SITE_PURSE[WORLDS.desert.stage], 'the stage\'s purse');
    assert.ok(!coffer.enabled(), 'opened once');
    off();
    // cleared: nothing comes out again
    W.step(1);
    assert.equal(W.foes.list.filter((f) => f.site && f.alive).length, 0);
  } finally { W.restore(); }
});

test('a nest asleep: walk up softly and the first cut is a sneak strike, three times over; the nest wakes', () => {
  const W = world({ sites: [{ id: 'test-nest', kind: 'nest', at: [0, 0, 0], heading: 0, foes: ['crab', 'crab', 'crab'] }], at: v(0, 0, 40) });
  try {
    W.step(0.5);
    const out = W.foes.list.filter((f) => f.site);
    assert.equal(out.length, 3);
    W.P.pos.set(0, 0, 4.5);   // (walked up, not run: still asleep)
    W.step(1.5);
    assert.ok(out.every((f) => !f.provoked), 'asleep as you stand over them');
    assert.ok(out.every((f) => f.idle.rest > 0.9), 'their bodies at rest');
    const f = out[0], hp = f.hp;
    f.hit('blade', v(0, 0, -1), { damage: 1 });
    assert.equal(hp - f.hp, IDLE.sleep.sneak, 'a sneak strike: three times the cut (a crab of three, gone in one)');
    W.step(1.5);
    if (hintsFor('tip')) assert.ok(W.toasts.some((t) => /sneak strike/.test(t)), 'said the first time (hints full)');
    // a cut that leaves one standing: it wakes, and the nest with it (each through its alert beat)
    if (out[1].alive) { out[1].hp = 9; out[1].hit('blade', v(0, 0, -1), { damage: 1 }); }
    W.step(2.5);
    assert.ok(out.slice(1).every((x) => x.state !== 'idle'), 'up and at you');
    assert.ok(out.slice(1).every((x) => x.provoked), 'the nest wakes');
  } finally { W.restore(); }
});

test('an ambush: nothing but its coffer and its sign until you step in; then they come up round you; left, it sets again', () => {
  const W = world({ sites: [{ id: 'test-sand', kind: 'ambush', at: [0, 0, 0], heading: 0, foes: ['worm', 'worm'], sign: 'sand' }], at: v(0, 0, 30) });
  try {
    W.step(1);
    assert.equal(W.foes.list.filter((f) => f.site).length, 0, 'nothing out yet');
    assert.ok(W.E.sites[0].sign?.group.visible, 'its sign showing');
    W.P.pos.set(0, 0, SITE.trigger - 1);
    W.step(0.2);
    const out = W.foes.list.filter((f) => f.site);
    assert.equal(out.length, 2, 'up they come');
    assert.ok(out.every((f) => f.provoked), 'straight at you');
    assert.ok(!W.E.sites[0].sign.group.visible, 'the sign gone with it');
    // walk away far: they go with the packs, and the ambush is set again
    W.P.pos.set(0, 0, SITE.drop + 40);
    W.step(1);
    assert.equal(W.foes.list.filter((f) => f.site).length, 0);
    assert.equal(W.E.sites[0].sprung, false, 'set again');
  } finally { W.restore(); }
});

test('with the Enemies setting off no foe comes out, and a site\'s coffer opens at once', () => {
  const W = world({ sites: [{ id: 'calm', kind: 'hoard', at: [0, 0, 0], heading: 0, foes: ['blot'] }], at: v(0, 0, 3), enemies: false });
  try {
    W.step(0.5);
    assert.equal(W.foes.list.length, 0);
    assert.ok(allInteractables().find((i) => i.id === 'site.desert.calm').enabled());
  } finally { W.restore(); }
});

test('the camps\' fires and their brush are the world\'s flammables (an ember flares the fire; fire runs through the brush)', () => {
  const sp = siteFlammables({ id: 'desert', ground: { heightAt: () => SITES.desert.find((s) => s.kind === 'camp').at[1] } });
  const camps = SITES.desert.filter((s) => s.kind === 'camp').length;
  assert.equal(sp.filter((s) => s.kind === 'campfire').length, camps);
  assert.ok(sp.filter((s) => s.kind === 'bramble').length >= camps * 3);
  assert.deepEqual(siteFlammables({ id: 'mangrove' }), [], 'none in a discarded world');
});

// ------------------------------------------------------------------ the wandering packs (B10)
test('a pack\'s fillers are the world\'s own: no tutorial blot where the world has none, every filler of its roster, the places kept', () => {
  for (const w of ORDER) {
    const own = new Set(worldArchetypes(w).map(spawnKindOf));
    for (const k of Object.keys(ROSTERS[w].fill)) assert.ok(own.has(k), `${w}: filler ${k} is its own`);
  }
  assert.ok(!('blot' in ROSTERS.bazaar.fill), 'the Market fills with its own, not blots');
  const rng = (() => { let s = 3; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (const w of ORDER) {
    const [, hi] = WORLDS[w].budget ?? BUDGET[WORLDS[w].stage];
    for (let n = 1; n < 80; n++) {
      const p = packOf(n, w, rng);
      // its places: the lead's and each filler's (a group's counted once)
      let places = 0; const seen = { ...GROUP };
      for (const k of p) { if (GROUP[k]) { if (seen[k] === GROUP[k]) places += GROUP_COST[k]; seen[k] = seen[k] - 1 || GROUP[k]; } else places += costOf(k); }
      assert.ok(places <= hi + 0.5 + 1e-9, `${w} pack ${n}: ${p} in ${hi} places (${places}; the last filler may run half a place over)`);
    }
  }
});

test('a pack comes in together where the ground holds all of it, or not at all (the Market and the City-Shaft lost most of theirs)', () => {
  const game = new GameState(null);
  // ground only on a narrow ledge 2 m wide along x, 22 m out: no room for a pack spread round its lead
  const ledge = { groundAt: (x, y, z) => (Math.abs(z - 22) < 1 ? 0 : NaN), rayDistance: () => Infinity, rayHit: () => null };
  const P = player(v(0, 0, 0));
  const F = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -900) }, levelId: 'bazaar', content: { npcs: [] }, physics: ledge, player: P, settings: { enemies: 'normal' }, game, rng: () => 0.37 });
  F.packs = 3;
  const kinds = ['lizard', 'lizard', 'crab', 'crab'];
  assert.equal(F.packSpots(kinds), null, 'no spot holds the pack: it waits');
  // open ground: all of it, round its lead, each within the spread
  const G = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -900) }, levelId: 'bazaar', content: { npcs: [] }, physics: flat, player: P, settings: { enemies: 'normal' }, game, rng: seeded() });
  const spots = G.packSpots(kinds);
  assert.equal(spots.length, 4);
  for (const s of spots.slice(1)) assert.ok(s.distanceTo(spots[0]) <= PACK.spread[1] + 1e-6, 'together round its lead');
  const d = Math.hypot(spots[0].x, spots[0].z);
  assert.ok(d >= PACK.near - 1e-6 && d <= PACK.far + 1e-6, 'the lead on the ring round you');
  assert.ok(PACK.rest[0] >= 60, 'fewer: a minute or more between packs');
  F.dispose(); G.dispose();
});

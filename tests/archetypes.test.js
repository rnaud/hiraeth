// The enemy roster (docs/design/enemy-roster.md; src/enemies/archetypes.js, src/enemies/skins.js, src/foe-worlds.js,
// src/enemies/plans/): the 21 archetypes and their skins, every world's table valid and diverse, the batch-1 archetypes'
// attacks, telegraphs, counterplay, calm and drops, spawning by world, and the 100 world enemies retired.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ARCHETYPES, ARCHETYPE_IDS, BUILT, ARCHETYPE_KINDS, ARCHETYPE_NOTES, spawnKindOf, archetypeOfKind, parseKind, skinned } from '../src/enemies/archetypes.js';
import { SKINS, HOME_SKIN, skinFor, skinOf, skinWorlds } from '../src/enemies/skins.js';
import { ATTACKS, fromPattern } from '../src/enemies/attacks.js';
import { WORLDS, ROSTERS, rosterOf, packOf, BUDGET, GROUP, GROUP_COST, COSTS, rangedKind, worldArchetypes } from '../src/foe-worlds.js';
import { Foe, Foes, FOES, attackOf, ARENA_WAVES, WAVES, aloneWave, waveWords, RING, GROUNDED, BURROW, CHOKE, LEAP_FLIP, TOPPLE, OPEN, SPORES, TURNS, HARM_BY_STAGE, strikersAt, coolAt } from '../src/foes.js';
import { KINDS } from '../src/foe-kinds.js';
import { existsSync } from 'node:fs';
import { windMin, groundMark, isProjectile } from '../src/telegraph.js';
import { DROP_OF } from '../src/chimes.js';
import { ORDER, SIDE, TITLES, ROUTE_PARTS } from '../src/levels/names.js';
import { VerletChain } from '../src/motion-kit/chain.js';
import { clearTargets, allTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { setHintLevel } from '../src/hint-level.js';

// (these check the game's words as hints full says them, every tip and step; subtle, the default, is checked in tests/hint-level.test.js)
setHintLevel('full');

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const env = { ground: () => 0, seen: () => true };
function player(at = v(), o = {}) {
  return { pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: [], knocks: 0, flinches: 0,
    hurt(a) { this.hurts.push(a); }, knockDown() { this.knocks++; return true; }, flinch() { this.flinches++; }, ...o };
}
const world = (P, o = {}) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), ...o });
const ROUTE_ROLES = new Set(['rusher', 'tank', 'swarm', 'trapper', 'lobber', 'flanker', 'reach', 'charger', 'grappler', 'support', 'disruptor', 'air striker', 'ambusher', 'sniper', 'area denier', 'siege', 'tether', 'heavy', 'duelist', 'stalker', 'puppeteer']);

// ------------------------------------------------------------------------------------------- the tables
test('the roster: 21 archetypes, 12 creatures, 5 machines and 4 spirits, each its own role, plan and answers; no two machines or spirits share a plan', () => {
  assert.equal(ARCHETYPE_IDS.length, 21);
  const fam = (f) => ARCHETYPE_IDS.filter((a) => ARCHETYPES[a].family === f);
  assert.deepEqual([fam('creature').length, fam('machine').length, fam('spirit').length], [12, 5, 4]);
  assert.equal(new Set(ARCHETYPE_IDS.map((a) => ARCHETYPES[a].role)).size, 21, 'a job each');
  for (const a of ARCHETYPE_IDS) {
    const A = ARCHETYPES[a];
    assert.ok(ROUTE_ROLES.has(A.role), `${a}: a role of the doc's (${A.role})`);
    assert.ok(A.tier >= 1 && A.tier <= 4, `${a}: tier`);
    assert.ok(['built', 'stand-in', 'planned'].includes(A.status), `${a}: status`);
    assert.ok(A.moves.length >= 2 && A.moves.length <= 3, `${a}: two or three attacks`);
    assert.ok(A.answers.length >= 2 && !A.answers.every((x) => /charged cut/.test(x)), `${a}: answered by more than the charged cut`);
    assert.ok(A.idle && A.drop > 0 && A.sound, `${a}: idle, drop, sound`);
    assert.ok(A.art === 'pending' || /^sheet-\d+$/.test(A.art) || (A.art.main && A.art.alt), `${a}: art pending its sheet, or matched to one or to both (${A.art})`);
    if (A.art.main) {
      // drawn to its sheets: the main skin's world on sheet-1, the alternate's on sheet-2, both its own skins
      assert.ok(A.status === 'built' && A.art.main && A.art.alt && A.art.main !== A.art.alt, `${a}: art { main, alt }`);
      for (const [n, w] of [[1, A.art.main], [2, A.art.alt]]) {
        assert.ok(SKINS[a][w], `${a}: sheet-${n}'s world (${w}) is one of its skins`);
        assert.ok(existsSync(new URL(`../references/enemy-archetypes/${a}/sheet-${n}.jpg`, import.meta.url)), `${a}: sheet-${n}.jpg`);
      }
    }
    if (A.status === 'planned') assert.equal(A.kind, null);
    else assert.ok(FOES[A.kind], `${a}: its kind (${A.kind}) is a foe kind`);
    if (A.family === 'machine') assert.ok(A.possession, `${a}: how its possession shows`);
    if (A.family === 'spirit') assert.ok(A.manifestation, `${a}: how the dark shows`);
  }
  for (const f of ['machine', 'spirit']) {
    const plans = fam(f).map((a) => ARCHETYPES[a].planNo + ARCHETYPES[a].plan);
    assert.equal(new Set(plans).size, plans.length, `no two ${f}s share a body plan`);
  }
  assert.deepEqual(BUILT.sort(), [...ARCHETYPE_IDS].sort(), 'batches 1 to 5: all 21 are built');
  for (const a of ['blot', 'crab', 'hound', 'lizard', 'tripod']) assert.ok(ARCHETYPES[a].art.main, `${a}: batch 1 is drawn to both its sheets`);
  assert.equal(ARCHETYPES.lizard.plan, ARCHETYPES.hound.plan, 'the lizard and the hound: one quadruped rig');
  assert.ok(ARCHETYPE_IDS.filter((a) => ARCHETYPES[a].ranged).length >= 8, 'eight ranged or area roles (the blot spits too)');
});

test('skins: each archetype in each of its worlds, its own first; palettes whole; a skin only dresses (no unknown world)', () => {
  for (const a of ARCHETYPE_IDS) {
    const S = SKINS[a];
    assert.ok(S && Object.keys(S).length >= 3, `${a}: at least three skins`);
    assert.equal(HOME_SKIN[a], Object.keys(S)[0]);
    for (const [w, s] of Object.entries(S)) {
      assert.ok(TITLES[w], `${a}: ${w} is a world`);
      assert.ok(s.name && s.palette, `${a}@${w}: named and coloured`);
      if (!s.arena && a !== 'blot') assert.ok(worldArchetypes(w).includes(a), `${a}@${w}: the world table fields it there`);
    }
  }
  // every world's archetypes have a skin there
  for (const w of Object.keys(WORLDS)) for (const a of worldArchetypes(w)) assert.ok(SKINS[a][w] || a === 'blot', `${a} has a skin in ${w}`);
  assert.equal(skinFor('crab', 'arena'), 'arzach2', 'where it has none, its own');
  assert.equal(skinOf('crab', 'saltharbour').name, 'anchor crab');
  assert.deepEqual(skinOf('crab', 'saltharbour').moves, ['burrow']);
  assert.ok(skinOf('crab', 'bazaar').palette.under, 'a skin’s palette falls back to its own skin’s');
  assert.equal(skinWorlds('blot').length, 22, 'the blot is in every world');
  assert.deepEqual(parseKind('crab@saltharbour'), { kind: 'crab', skin: 'saltharbour' });
  assert.deepEqual(parseKind('blot'), { kind: 'blot', skin: null });
  assert.equal(skinned('lizard', 'bazaar'), 'lizard@bazaar');
});

test('every world’s table is valid and diverse: 3–6 archetypes, a ranged or area role on every route world, no two route leads alike in a row', () => {
  for (const [w, T] of Object.entries(WORLDS)) {
    assert.ok(TITLES[w], `${w} is a world`);
    const list = worldArchetypes(w);
    assert.ok(list.length >= 3 && list.length <= 7, `${w}: ${list.length} archetypes`);
    for (const a of list) assert.ok(ARCHETYPES[a], `${w}: ${a}`);
    assert.ok(T.roster[T.lead], `${w}: its lead is on its roster`);
    const roles = new Set(list.map((a) => ARCHETYPES[a].role));
    assert.equal(roles.size, list.length, `${w}: a role each`);
  }
  for (const w of ROUTE_PARTS) {
    assert.ok(WORLDS[w], `${w}: on the route, it has a table`);
    assert.ok(worldArchetypes(w).some((a) => ARCHETYPES[a].ranged), `${w}: a ranged or area role`);
  }
  for (let i = 1; i < ORDER.length; i++) assert.notEqual(WORLDS[ORDER[i]].lead, WORLDS[ORDER[i - 1]].lead, `${ORDER[i - 1]} → ${ORDER[i]}: leads differ`);
  for (const w of SIDE.filter((x) => x !== 'overnighttrain')) assert.ok(WORLDS[w], `${w}: a side world with a table`);
  assert.ok(!WORLDS.home && !WORLDS.atelier && !WORLDS.overnighttrain, 'the peaceful worlds field none');
  // each archetype in 3–7 worlds, 1–4 of them on the route (the blot: every world)
  for (const a of ARCHETYPE_IDS.filter((x) => x !== 'blot')) {
    const all = Object.keys(WORLDS).filter((w) => worldArchetypes(w).includes(a)), route = all.filter((w) => ROUTE_PARTS.includes(w));
    assert.ok(all.length >= 3 && all.length <= 7, `${a}: in ${all.length} worlds`);
    assert.ok(route.length >= 1 && route.length <= 4, `${a}: on the route in ${route.length}`);
  }
  // the decisions: the bell walker saved for the Signal Market, none in Vael II
  assert.ok(!worldArchetypes('arzach2').includes('bell') && worldArchetypes('bazaar').includes('bell'));
  // role coverage: every role fielded somewhere on the route or off it
  assert.equal(new Set(Object.keys(WORLDS).flatMap((w) => worldArchetypes(w)).map((a) => ARCHETYPES[a].role)).size, 21);
});

test('the difficulty curve: tier 1 alone in the first worlds, tier 4 only in the last; pack budgets by stage', () => {
  const tiers = (w) => worldArchetypes(w).map((a) => ARCHETYPES[a].tier);
  for (const w of ['desert', 'arzach']) assert.ok(Object.keys(WORLDS[w].roster).every((a) => ARCHETYPES[a].tier === 1), `${w}: tier 1 alone`);
  for (const w of ORDER.slice(0, -3)) assert.ok(tiers(w).every((t) => t < 4), `${w}: no tier 4 before the last three`);
  for (const w of ['spheres', 'bazaar']) assert.ok(tiers(w).includes(4), `${w}: tier 4`);
  // (v1.22, the roster's step 8: the third stage up to five places, the last three four to five, the Market a summit of its own)
  assert.deepEqual(BUDGET, [[1, 2], [2, 3], [3, 5], [4, 5], [5, 6]]);
  const rng = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (const w of ORDER) {
    const stage = WORLDS[w].stage, [, hi] = WORLDS[w].budget ?? BUDGET[stage];
    for (let n = 1; n < 60; n++) {
      const p = packOf(n, w, rng);
      if (!GROUP[p[0]] && p[0] !== 'shade') assert.ok(p.length - 1 + (COSTS[p[0]] ?? 1) <= hi + 1e-9, `${w} pack ${n}: ${p} in ${hi} places`);
      if (GROUP[p[0]]) assert.ok(stage < 2 ? p.length === GROUP[p[0]] : p.length - GROUP[p[0]] + GROUP_COST[p[0]] <= hi, `${w} pack ${n}: a group (${p}), alone early, filled later`);
      if (stage <= 1 && !GROUP[p[0]]) assert.ok(p.filter(rangedKind).length <= 1, `${w} pack ${n}: at most one ranged early (${p})`);
    }
  }
});

test('the route\'s difficulty rises to the Market: stages never fall, packs grow, the late kinds lead at the end (the roster\'s step 8)', () => {
  const stages = ORDER.map((w) => WORLDS[w].stage);
  stages.forEach((s, i) => i && assert.ok(s >= stages[i - 1], `${ORDER[i]}: stage ${s} after ${stages[i - 1]}`));
  assert.ok(WORLDS.bazaar.stage > WORLDS.spheres.stage, 'the Signal Market stands alone at the top');
  const rng = (() => { let s = 5; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const size = (w) => { let n = 0; for (let i = 1; i <= 600; i++) n += packOf(i, w, rng).filter((k) => k !== 'skitter').length; return n / 600; };
  const mean = (ws) => ws.reduce((a, w) => a + size(w), 0) / ws.length;
  const early = mean(ORDER.slice(0, 5)), middle = mean(ORDER.slice(5, 8)), late = mean(ORDER.slice(8));
  assert.ok(early < middle && middle < late, `packs grow: ${early.toFixed(2)} < ${middle.toFixed(2)} < ${late.toFixed(2)} (a flock of skitters not counted)`);
  assert.ok(ORDER.every((w) => w === 'bazaar' || size(w) < size('bazaar')), 'the Market\'s packs are the biggest on the route');
  // the hounds and the marionettes lead in the last two (from the third pack on in the Garden)
  for (const [w, kinds] of [['spheres', ['hound']], ['bazaar', ['hound', 'marionette']]]) {
    let n = 0; for (let i = 3; i < 603; i++) if (kinds.includes(packOf(i, w, rng)[0])) n++;
    assert.ok(n / 600 > 0.15, `${w}: ${kinds} lead ${Math.round((n / 600) * 100)} % of the later packs`);
  }
});

test('the last worlds press harder: three strikers at once, quicker turns, heavier blows; the Market heaviest; Gentle as ever', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((s) => strikersAt(s)), [2, 2, 2, 3, 3]);
  assert.deepEqual([0, 2, 3, 4].map((s) => strikersAt(s, true)), [1, 1, 1, 1], 'Gentle: one at a time everywhere');
  assert.deepEqual([2, 3, 4].map((s) => coolAt(s)), [1, TURNS.late.cool, TURNS.late.cool]);
  assert.equal(coolAt(4, true), 1);
  const at = (levelId, enemies = 'normal') => { clearTargets(); return new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500) }, levelId, physics: flat, player: player(), settings: { enemies }, game: new GameState(null), rng: () => 0.5 }); };
  const blows = (F) => [0.25, 0.5, 0.75, 1].map((d) => F.harmOf(d));
  const desert = at('desert'), buried = at('buried'), bazaar = at('bazaar'), gentle = at('bazaar', 'gentle'), arena = at('arena');
  assert.deepEqual(blows(desert), [0.25, 0.5, 0.75, 1], 'early on, the damage table as it is');
  assert.deepEqual(blows(buried), [0.25, 0.5, 1, 1.25], 'the last three: a heavy blow lands as a crushing one');
  assert.deepEqual(blows(bazaar), [0.25, 0.75, 1, 1.5], 'the Market: an ordinary blow as a heavy one');
  assert.equal(gentle.harmOf(0.5), 0.25, 'Gentle still halves it (in quarters)');
  assert.deepEqual(blows(arena), [0.25, 0.5, 0.75, 1], 'the Arena: as the table');
  assert.equal(buried.strikers, 3); assert.equal(desert.strikers, 2); assert.equal(gentle.strikers, 1); assert.equal(arena.strikers, 2);
  arena.stage = 4; assert.equal(arena.strikers, 3, 'a stage set by hand (the review script plays a world\'s turns)'); assert.equal(arena.harmOf(0.5), 0.75);
  assert.equal(HARM_BY_STAGE.length, BUDGET.length, 'a harm for every stage');
  for (const F of [desert, buried, bazaar, gentle, arena]) F.dispose();
  clearTargets();
});

test('spawning by world: the wilds draw each world’s archetypes (or the old kinds standing in), in its skin; planned ones wait', () => {
  for (const [w, R] of Object.entries(ROSTERS)) {
    const kinds = new Set([...Object.keys(R.wild), ...Object.keys(R.fill), R.first, ...R.guards]);
    for (const k of kinds) {
      assert.ok(FOES[k], `${w}: ${k}`);
      const a = archetypeOfKind(k);
      assert.ok(a && (worldArchetypes(w).includes(a) || k === 'blot'), `${w}: ${k} stands for one of its archetypes (${a})`);
    }
    for (const a of worldArchetypes(w)) if (ARCHETYPES[a].status === 'planned') assert.ok(!kinds.has(a), `${w}: ${a} waits until built`);
    assert.equal(R.first, spawnKindOf(WORLDS[w].lead) ?? R.first, `${w}: its first pack is its lead`);
  }
  // a pack in the Signal Market: coin lizards, in pairs, in their skin
  clearTargets();
  const P = player(v(0, 0, 0)), foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500) }, levelId: 'bazaar', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: () => 0.05 });
  foes.packs = 2; foes.spawnPack();
  assert.ok(foes.list.length >= 1);
  for (const f of foes.list) if (f.kind === 'lizard') { assert.equal(f.skin, 'bazaar'); assert.equal(f.model.group.name, 'coin lizard'); }
  assert.ok(foes.list.every((f) => !f.provoked || !f.def.calm), 'out in the wilds they keep to their calm');
  foes.dispose(); clearTargets();
});

test('the 100 world enemies are retired: no world enemy kind in spawning, the Arena, the list or the tables; their attack patterns kept as a library', async () => {
  const fs = await import('node:fs');
  assert.ok(!fs.existsSync(new URL('../src/enemies/roster.js', import.meta.url)), 'the roster of 100 is gone');
  assert.ok(!fs.existsSync(new URL('../src/enemies/models.js', import.meta.url)), 'their shared rigs too');
  assert.ok(Object.keys(FOES).every((k) => !k.includes('/')), 'no world enemy kind');
  assert.ok(ARENA_WAVES.flat().every((k) => !k.includes('/')), 'none in the Arena');
  for (const R of Object.values(ROSTERS)) assert.ok([...Object.keys(R.wild), ...Object.keys(R.fill)].every((k) => !k.includes('/')));
  assert.throws(() => new Foe('desert/dune-skitter', v()), /Unknown enemy/);
  assert.equal(Object.keys(ATTACKS).length, 15, 'the fifteen patterns stay');
  const a = fromPattern('tail', { id: 'whip', max: 3 });
  assert.equal(a.shape, 'cone'); assert.equal(a.range, ATTACKS.tail.range); assert.equal(a.contact, ATTACKS.tail.contacts[0]); assert.equal(a.max, 3);
  assert.ok(fromPattern('lob').lob && fromPattern('lob').instant, 'a lobbed pattern stays a lob');
  // the old kinds the doc retires: the glass splinter gone; the spitting blot's spit on the ink blot
  assert.ok(!FOES.splinter);
  assert.ok(attackOf('blot', 'spit')?.lob, 'the blot spits (the spitting blot folded in)');
});

test('old saves are unaffected: enemies are never saved, only flags of kinds that still exist', () => {
  const store = new Map([['moebius.game.v1', JSON.stringify({ flags: { 'foes.met.crab': true, 'foes.met.hound': true, 'foes.seen': true, 'foes.desert.m1': true }, keepsakes: [] })]]);
  const game = new GameState({ getItem: (k) => store.get(k) ?? null, setItem: (k, x) => store.set(k, x) });
  assert.equal(game.flag('foes.met.crab'), true);
  clearTargets();
  const notes = [], P = player(v(0, 0, 0)), foes = world(P, { game, notice: (t) => notes.push(t) });
  foes.waveRest = 1e9;
  foes.add('crab', v(0, 0, 6)); foes.add('lizard', v(3, 0, 6));
  for (let i = 0; i < 30; i++) foes.update(DT);
  assert.ok(!notes.some((t) => /shellback/.test(t)), 'a crab already met is not explained again');
  assert.ok(notes.some((t) => /Horn lizards/.test(t)), 'the new lizard is');
  const saved = JSON.parse(store.get('moebius.game.v1'));
  assert.ok(Object.keys(saved.flags).every((k) => !/\//.test(k)), 'no foe kinds or skins in the save');
  foes.dispose(); clearTargets();
});

// ------------------------------------------------------------------------------------------- batch 1
test('batches 1 and 2: each attack winds up at least its telegraph minimum; only a lob marks the ground; every move says its tell and its answer', () => {
  for (const a of BUILT) {
    const D = ARCHETYPE_KINDS[ARCHETYPES[a].kind];
    assert.ok(D.attacks.filter((x) => !x.chain).length >= 2 && D.attacks.filter((x) => !x.chain).length <= 4, `${a}: its attacks`);
    for (const x of D.attacks) {
      assert.ok(x.wind >= windMin(x) - 1e-9, `${a}.${x.id}: ${x.wind} s ≥ ${windMin(x)} s`);
      assert.ok(x.damage * 4 === Math.round(x.damage * 4) && x.damage <= 1, `${a}.${x.id}: hearts in quarters`);
      if (groundMark(x)) assert.ok(x.lob && isProjectile(x), `${a}.${x.id}: only a lob marks the ground`);
      if (x.lob) assert.ok(groundMark(x), `${a}.${x.id}: a lob keeps its landing mark`);
      if (!x.chain) assert.ok(x.tell && x.counter && x.name, `${a}.${x.id}: its tell, its answer, its name`);
      assert.ok((x.max ?? D.reach) <= D.reach + 1e-9 || x.far, `${a}.${x.id}: within its reach`);
    }
    assert.ok(ARCHETYPE_NOTES[ARCHETYPES[a].kind] || a === 'blot', `${a}: said once when met`);
  }
  assert.equal(attackOf('lizard', 'whip').pattern, 'tail', 'the tail whip from the pattern library');
  assert.equal(attackOf('tripod', 'stamp').pattern, 'stomp');
  assert.equal(attackOf('hound', 'pounce').wind, 0.8, 'the pounce stays at 0.8 s (combat-v1.4)');
});

test('the shellback crab: the shell glances from the front, a guarded spin flips it, a parried snap chips it, bombs crack it; it burrows only in its tier-2 skins', () => {
  const c = new Foe('crab', v()); c.heading = 0;
  assert.equal(c.hit('blade', v(0, 0, -1), { damage: 1 }), 'glance');
  clearTargets();
  const P = player(v(0, 0, 0), { guard: () => 'perfect' }), foes = world(P);
  const s = foes.add('crab', v(0, 0, 2)); s.heading = Math.PI;
  const hp = s.hp;
  foes.strike(s, attackOf('crab', 'snap'));
  assert.equal(s.hp, hp - 1, 'a perfect parry chips its claw, shell or no shell');
  foes.strike(s, attackOf('crab', 'spin'));
  assert.ok(s.flipped > 2, 'the guarded spin turns it onto its back');
  // the burrow: only the anchor crab and the coral crab
  const own = new Foe('crab', v()), harbour = new Foe('crab@saltharbour', v());
  assert.ok(!own.attacksAt(5).some((a) => a.id === 'burrow'), 'the cliff crab never burrows');
  assert.ok(harbour.attacksAt(5).some((a) => a.id === 'burrow'), 'the anchor crab does');
  const b = new Foe('crab@underwater', v(0, 0, 0), { rng: () => 0.5 }); b.attacksAt = (d) => [attackOf('crab', 'burrow')];
  b.state = 'chase'; b.cool = 0; const Q = player(v(0, 0, 5));
  for (let i = 0; i < 60 && b.state !== 'wind'; i++) b.update(DT, Q, env);
  assert.equal(b.atk.id, 'burrow');
  for (let i = 0; i < 1.3 / DT; i++) b.update(DT, Q, env);
  assert.ok(b.pos.distanceTo(Q.pos) < 1, 'it springs out where you stood');
  foes.dispose(); clearTargets();
});

test('the horn lizard: a pair works together, the blare shoves you toward the partner, the bite comes only from behind you, the whip only at your back', () => {
  clearTargets();
  const P = player(v(0, 0, 0), { heading: 0 }), foes = world(P);
  foes.waveRest = 1e9;
  const [a, b] = foes.spawnKind('lizard');
  assert.ok(a && b, 'they come in pairs');
  assert.ok(!a.flanker && b.flanker, 'the second circles behind you');
  b.pos.set(0, 0, -4);   // (behind you: you face +z)
  P.pos.set(0, 0, 0);
  foes.strike(a, attackOf('lizard', 'blare'));
  assert.ok(P.vel.z < -3, `shoved toward its partner behind you (${P.vel.z.toFixed(1)})`);
  assert.ok(P.knocks === 0, 'shoved, not knocked down');
  // the bite: only from behind you
  const L = new Foe('lizard', v(0, 0, 4), { rng: () => 0.5 }); L.heading = Math.PI;
  L.update(DT, player(v(0, 0, 0), { heading: 0 }), env);
  assert.ok(!L.attacksAt(4).some((x) => x.id === 'bite'), 'in front of you: no bite');
  const L2 = new Foe('lizard', v(0, 0, -4), { rng: () => 0.5 }); L2.heading = 0;
  L2.update(DT, player(v(0, 0, 0), { heading: 0 }), env);
  assert.ok(L2.attacksAt(4).some((x) => x.id === 'bite'), 'behind you: it bites');
  // the whip: only with you behind it, its area behind it
  const W = new Foe('lizard', v(0, 0, 0), { rng: () => 0.5 }); W.heading = 0;
  W.update(DT, player(v(0, 0, -2), { heading: 0 }), env);
  assert.ok(W.attacksAt(2).some((x) => x.id === 'whip'), 'you at its back: the whip');
  W.beginWind(attackOf('lizard', 'whip'), player(v(0, 0, -2)));
  assert.ok(Math.abs(W.attackH - W.heading - Math.PI) < 1e-6, 'the sweep is behind it');
  foes.dispose(); clearTargets();
});

test('the lamp tripod: its searchlight follows you then locks; cover breaks the beam; a perfect parry sends the bolt back; it is metal and heavy', () => {
  const T = new Foe('tripod', v(0, 0, 0), { rng: () => 0.5 }); T.heading = 0;
  T.attacksAt = () => [attackOf('tripod', 'beam')]; T.state = 'chase'; T.cool = 0; T.retreat = 0;
  const Q = player(v(0, 0, 12));
  for (let i = 0; i < 30 && T.state !== 'wind'; i++) T.update(DT, Q, env);
  assert.equal(T.atk.id, 'beam');
  Q.pos.set(6, 0, 10);
  for (let i = 0; i < 0.3 / DT; i++) T.update(DT, Q, env);
  assert.ok(Math.abs(T.attackH - Math.atan2(6, 10)) < 0.05, 'the light follows you while it aims');
  for (let i = 0; i < 2 / DT && T.k < attackOf('tripod', 'beam').track + 0.03; i++) T.update(DT, Q, env);
  const held = T.attackH;
  Q.pos.set(-6, 0, 10);
  for (let i = 0; i < 0.3 / DT && T.state === 'wind'; i++) T.update(DT, Q, env);
  assert.ok(Math.abs(T.attackH - held) < 0.25, 'then locks: step out of its line');
  // cover: no clear line, no hit
  const C = new Foe('tripod', v(0, 0, 0), { rng: () => 0.5 }); C.attacksAt = () => [attackOf('tripod', 'beam')]; C.state = 'chase'; C.cool = 0; C.retreat = 0;
  const R = player(v(0, 0, 10)), blind = { ground: () => 0, seen: () => false };
  const ev = []; for (let i = 0; i < 3 / DT; i++) ev.push(...C.update(DT, R, blind));
  assert.ok(ev.filter((e) => e?.type === 'strike').every((e) => !e.hit), 'behind cover the bolt never lands');
  // the parry
  clearTargets();
  const P = player(v(0, 0, 0), { guard: () => 'perfect' }), foes = world(P);
  const t = foes.add('tripod', v(0, 0, 8));
  const hp = t.hp;
  foes.strike(t, attackOf('tripod', 'beam'));
  assert.equal(t.hp, hp - 2, 'the bolt back into its lamp');
  assert.ok(FOES.tripod.metal && FOES.tripod.heavy && FOES.tripod.keep > 5, 'metal (the magnet glove), heavy, it keeps its distance');
  foes.dispose(); clearTargets();
});

test('the antler hound: the rake only once it is hurt; a shadow while it runs, solid when lit; the ink blot spits only once you keep away', () => {
  const H = new Foe('hound', v(), { rng: () => 0.5 });
  assert.ok(!H.attacksAt(2).some((a) => a.id === 'rake'), 'whole: no rake');
  H.hp = FOES.hound.hp * 0.6;
  assert.ok(H.attacksAt(2).some((a) => a.id === 'rake'), 'at two thirds: the antler rake');
  const B = new Foe('blot', v(0, 0, 0), { rng: () => 0.5 }); B.state = 'chase'; B.cool = 0;
  const Q = player(v(0, 0, 7));
  const wound = new Set(), t0 = [];
  for (let i = 0; i < 4 / DT; i++) { B.update(DT, Q, { ...env, ground: () => 0 }); if (B.state === 'wind') { wound.add(B.atk.id); t0.push(i * DT); } B.pos.set(0, 0, 0); }
  assert.ok(wound.has('spit'), 'kept away, it spits');
  assert.ok(t0[0] >= attackOf('blot', 'spit').far - 1e-6, `only after chasing a while (${t0[0]?.toFixed(2)} s)`);
});

test('calm until provoked: wildlife grazes or basks, backs off or watches; close in, hurt, or one of its own roused, and it fights; home, it calms again', () => {
  // a crab out in the wilds: keeps away from you, no fight at 5 m; at 3 m it is cornered
  const c = new Foe('crab', v(0, 0, 0), { rng: () => 0.5, calm: true }), P = player(v(0, 0, 5));
  for (let i = 0; i < 2 / DT; i++) c.update(DT, P, env);
  assert.equal(c.state, 'idle', 'calm at 5 m');
  assert.ok(c.pos.z < -0.3, `it backed away (${c.pos.z.toFixed(2)})`);
  P.pos.set(c.pos.x, 0, c.pos.z + 2.5);
  const ev = []; for (let i = 0; i < 10; i++) ev.push(...c.update(DT, P, env));
  assert.ok(ev.includes('notice') && c.state !== 'idle', 'cornered, it fights');
  // hurt, it fights back
  const l = new Foe('lizard', v(0, 0, 0), { rng: () => 0.5, calm: true });
  l.update(DT, player(v(0, 0, 12)), env);
  assert.equal(l.state, 'idle');
  l.hit('blade', v(0, 0, 1), { damage: 1 });
  assert.ok(l.provoked && l.state !== 'idle', 'hurt: provoked');
  // one of its own roused nearby: the partner too (Foes.alarm)
  clearTargets();
  const Q = player(v(0, 0, 0)), foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500) }, levelId: 'bazaar', physics: flat, player: Q, settings: { enemies: 'normal' }, game: new GameState(null) });
  const a = foes.add('lizard', v(0, 0, 4), { calm: true }), b = foes.add('lizard', v(4, 0, 9), { calm: true });
  for (let i = 0; i < 30; i++) foes.update(DT);
  assert.ok(a.state !== 'idle', 'the near one is roused (6 m)');
  assert.ok(b.provoked, 'and its partner with it');
  foes.dispose(); clearTargets();
  // a machine patrols but always comes for you; anywhere but the wilds every kind comes for you
  const t = new Foe('tripod', v(0, 0, 0), { rng: () => 0.5, calm: true });
  t.update(DT, player(v(0, 0, 15)), env);
  assert.equal(t.state, 'chase', 'the tripod sees you at 15 m');
  assert.ok(new Foe('crab', v()).provoked, 'outside the wilds (the Arena, a test) it is roused');
  // home again, wildlife calms down
  const h = new Foe('crab', v(0, 0, 0), { rng: () => 0.5, calm: true }); h.provoked = true; h.state = 'home'; h.pos.set(0.3, 0, 0);
  h.update(DT, player(v(0, 0, 40)), env);
  assert.ok(h.state === 'idle' && !h.provoked, 'calm again');
  // not every hound hunts
  let watchers = 0; for (let i = 0; i < 20; i++) watchers += new Foe('hound', v(), { rng: () => (i + 0.5) / 20, calm: true }).watcher ? 1 : 0;
  assert.ok(watchers > 2 && watchers < 12, `some only watch (${watchers}/20)`);
});

test('drops: each built archetype leaves its chimes; the wave words name a skin', () => {
  for (const a of BUILT) assert.equal(DROP_OF[ARCHETYPES[a].kind], ARCHETYPES[a].drop);
});

test('a verlet chain: pinned at its root, its links keep their length, it settles toward its rest shape and curls', () => {
  const c = new VerletChain({ n: 6, length: 0.2, stiffness: 0.5, curl: 0.3, gravity: 0 });
  const root = v(0, 1, 0), dir = v(0, 0, -1);
  for (let i = 0; i < 240; i++) { root.x = Math.sin(i / 20) * 0.5; c.update(DT, root, dir); }
  const P = c.points;
  assert.ok(P[0].distanceTo(root) < 1e-9, 'the root pinned');
  for (let i = 1; i < P.length; i++) assert.ok(Math.abs(P[i].distanceTo(P[i - 1]) - 0.2) < 1e-6, `link ${i} keeps its length`);
  for (let i = 0; i < 300; i++) c.update(DT, root, dir);
  assert.ok(P.at(-1).y > root.y + 0.2, `at rest it curls up behind (${(P.at(-1).y - root.y).toFixed(2)})`);
  const stiff = new VerletChain({ n: 4, length: 0.2, stiffness: 0.95 }), loose = new VerletChain({ n: 4, length: 0.2, stiffness: 0.05, gravity: 6 });
  for (let i = 0; i < 120; i++) { stiff.update(DT, v(), v(1, 0, 0)); loose.update(DT, v(), v(1, 0, 0)); }
  assert.ok(stiff.points.at(-1).x > loose.points.at(-1).x, 'a stiff chain holds its line, a loose one sags');
});

// ------------------------------------------------------------------------------------------- batch 2
const run = (f, P, s, e = env) => { const ev = []; for (let i = 0; i < s / DT; i++) ev.push(...f.update(DT, P, e)); return ev; };
const windOn = (f, P, id, s = 6) => { for (let i = 0; i < s / DT; i++) { f.update(DT, P, env); if (f.state === 'wind' && f.atk.id === id) return true; } return false; };

test('batch 2: the mound worm, the sky ray, the signal moth, the ring centipede and the lantern jelly are built in every skin; the stand-ins they replace are retired', () => {
  for (const a of ['worm', 'ray', 'moth', 'centipede', 'jelly']) {
    const A = ARCHETYPES[a];
    assert.equal(A.status, 'built', a); assert.equal(A.kind, a);
    for (const w of skinWorlds(a)) { const f = new Foe(skinned(a, w), v()); assert.equal(f.archetype, a); }
  }
  // the dune ray, the sign moth's old body and the winged blot are gone (the worm, the moth and the sky ray took them)
  assert.ok(!FOES.flyer && !KINDS.ray && !KINDS.moth, 'retired');
  assert.ok(!WAVES.flat().includes('flyer') && ARENA_WAVES.flat().every((k) => parseKind(k).kind !== 'flyer'));
  assert.throws(() => new Foe('flyer', v()), /Unknown enemy/);
  // the art: each drawn to its picked sheet (references/enemy-archetypes/<id>/sheet-1.jpg)
  for (const a of ['worm', 'ray', 'moth', 'centipede', 'jelly']) assert.equal(ARCHETYPES[a].art, 'sheet-1', a);
  for (const a of ['worm', 'ray', 'moth', 'centipede', 'jelly']) assert.ok(existsSync(new URL(`../references/enemy-archetypes/${a}/${ARCHETYPES[a].art}.jpg`, import.meta.url)), `${a}: its sheet is in`);
  // Vael II runs wholly on the new roster now (every kind it spawns is a built archetype's own)
  const R = ROSTERS.arzach2, kinds = new Set([...Object.keys(R.wild), ...Object.keys(R.fill), R.first, ...R.guards]);
  for (const k of kinds) assert.equal(ARCHETYPES[archetypeOfKind(k)].status, 'built', `Vael II: ${k}`);
  // a lantern jelly comes into the Arena alone with something to ward
  assert.deepEqual(aloneWave('jelly', 'spheres'), ['jelly@spheres', 'blot@spheres']);
  assert.deepEqual(aloneWave('moth', 'bazaar'), Array(3).fill('moth@bazaar'), 'moths in threes');
});

test('the mound worm: it bursts up only from under the sand, up it spits and dives back under; the air cut onto its mound flushes it double; it ignores you off its mound', () => {
  const W = new Foe('worm', v(0, 0, 0), { rng: () => 0.5 });
  assert.ok(W.buried);
  assert.deepEqual(W.attacksAt(5).map((a) => a.id), ['erupt'], 'under: only the burst');
  W.surfaced();
  assert.deepEqual(W.attacksAt(5).map((a) => a.id).sort(), ['spit'], 'up and away: the stones');
  assert.deepEqual(W.attacksAt(1.5).map((a) => a.id).sort(), ['dive'], 'up and close: the dive');
  // the dive takes it back under
  const P = player(v(0, 0, 1.5));
  W.beginWind(attackOf('worm', 'dive'), P);
  run(W, P, 1.4);
  assert.ok(W.buried, 'dived back under');
  // the air cut onto the mound: up it comes, the blow double
  const M = new Foe('worm', v());
  assert.equal(M.hit('blade', v(0, 0, 1), { damage: 1, air: true }), 'flushed');
  assert.ok(!M.buried && M.hp === FOES.worm.hp - 2, `up, and hurt double (${M.hp})`);
  // calm: wildlife, it swims on past you unless you stand on it
  const C = new Foe('worm', v(0, 0, 0), { rng: () => 0.5, calm: true });
  run(C, player(v(0, 0, 4)), 1);
  assert.equal(C.state, 'idle', 'at 4 m it swims on');
  const ev = run(C, player(v(C.pos.x, 0, C.pos.z + 1)), 0.2);
  assert.ok(ev.includes('notice'), 'standing on its mound, it comes up for you');
});

test('the sky ray: a perfect parry of its skim grounds it; the downdraft only in Vael and Vael II, and it breaks your glide; the lash only at its back', () => {
  clearTargets();
  const P = player(v(0, 0, 0), { guard: () => 'perfect' }), foes = world(P);
  const r = foes.add('ray', v(0, 0, 5));
  foes.strike(r, attackOf('ray', 'skim'));
  assert.ok(r.stunned >= GROUNDED - 1e-9 && r.alt < 0.5, 'ploughed into the ground, open');
  foes.dispose(); clearTargets();
  assert.ok(!new Foe('ray@garage', v()).attacksAt(1).some((a) => a.id === 'draft'), 'the scrap ray never stalls over you');
  assert.ok(new Foe('ray@arzach', v()).attacksAt(1).some((a) => a.id === 'draft'), 'the storm ray does');
  const Q = player(v(0, 0, 0), { gliding: true, vel: v(0, 1, 0), endJets() { this.jets = false; }, jets: true }), G = world(Q);
  G.strike(G.add('ray@arzach', v(0, 0, 1)), attackOf('ray', 'draft'));
  assert.ok(!Q.gliding && !Q.jets && Q.vel.y <= -attackOf('ray', 'draft').draft + 1e-9, 'thrown down, the glide and the jets broken');
  G.dispose(); clearTargets();
  const L = new Foe('ray', v(0, 0, 0), { rng: () => 0.5 }); L.heading = 0;
  L.update(DT, player(v(0, 0, 2)), env);
  assert.ok(!L.attacksAt(2).some((a) => a.id === 'lash'), 'you in front: no lash');
  const B = new Foe('ray', v(0, 0, 0), { rng: () => 0.5 }); B.heading = 0; B.state = 'strike'; B.atk = attackOf('ray', 'skim');
  B.update(DT, player(v(0, 0, -2)), env);
  assert.ok(B.attacksAt(2).some((a) => a.id === 'lash'), 'you behind it as it passes: the lash');
  // past you after a skim, with nothing to strike with, it wheels off to come round again
  const Wh = new Foe('ray', v(0, 0, 0), { rng: () => 0.5 }); Wh.state = 'chase'; Wh.cool = 0; Wh.hid = true; Wh.heading = 0;
  const Y = player(v(0, 0, 1.2)); run(Wh, Y, 1);
  assert.ok(Wh.pos.distanceTo(Y.pos) > 2.5 || Wh.state === 'wind', `it wheels off (${Wh.pos.distanceTo(Y.pos).toFixed(2)} m)`);
});

test('the signal moth: three together; its dust (the lamp moth, the Antennas’ moth) makes your lock slip a while', () => {
  assert.equal(FOES.moth.group, 3);
  assert.ok(!new Foe('moth@bazaar', v()).attacksAt(1).some((a) => a.id === 'dust'), 'the sign moth has no dust');
  assert.ok(new Foe('moth@perdide2', v()).attacksAt(1).some((a) => a.id === 'dust'), 'the lamp moth does');
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P);
  const m = foes.add('moth@antennas', v(0, 0, 1.5));
  assert.ok(foes.cycleLock() === m, 'locked on');
  foes.strike(m, attackOf('moth', 'dust'));
  assert.equal(foes.lock, null, 'the lock slips off');
  assert.equal(foes.cycleLock(), null, 'and won’t take');
  foes.updateLock(attackOf('moth', 'dust').slip + 0.1);
  assert.equal(foes.cycleLock(), m, 'then it takes again');
  assert.equal(P.hurts.length, 0, 'no harm');
  foes.dispose(); clearTargets();
});

test('the ring centipede: it spirals round where you stood into a ring and closes; its body walls you in (out only over its back); the push breaks it; plated, only its head counts; cut from behind it sheds its tail', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P);
  foes.waveRest = 1e9;
  const c = foes.add('centipede', v(0, 0, 4));
  c.attacksAt = () => [attackOf('centipede', 'ring')]; c.state = 'chase'; c.cool = 0;
  let r0 = null, min = Infinity, around = 0, last = null;
  for (let i = 0; i < 3 / DT && c.state !== 'recover' && c.state !== 'chase' || i < 2; i++) {
    foes.update(DT); P.health = 1; P.down = null;
    if (c.state !== 'wind') continue;
    const d = Math.hypot(c.pos.x - c.attackAt.x, c.pos.z - c.attackAt.z), a = Math.atan2(c.pos.x - c.attackAt.x, c.pos.z - c.attackAt.z);
    r0 ??= d; min = Math.min(min, d);
    if (last != null) around += Math.abs(Math.atan2(Math.sin(a - last), Math.cos(a - last)));
    last = a;
    // you try to walk out through its body: held in
    if (c.k > 0.7) { const sp = c.model.spine[4]; P.pos.lerp(v(sp.x, 0, sp.z), 0.5); foes.corral(); }
    if (c.k > 0.7) assert.ok(c.model.spine.every((p) => Math.hypot(P.pos.x - p.x, P.pos.z - p.z) >= RING.wall - 0.05), 'never through its body');
  }
  assert.ok(r0 <= 4.01 && min < 1.4, `it spirals in (${r0.toFixed(2)} → ${min.toFixed(2)} m)`);
  assert.ok(around > Math.PI * 1.2, `round you (${around.toFixed(2)} rad)`);
  // over its back from high enough: no wall
  const p = c.model.spine[3]; P.pos.set(p.x, p.y + RING.over + 0.2, p.z);
  c.state = 'wind'; c.k = 0.8; const before = P.pos.clone(); foes.corral();
  assert.ok(P.pos.distanceTo(before) < 1e-9, 'over its back, free');
  foes.dispose(); clearTargets();
  // the push breaks the ring
  const b = new Foe('centipede', v(0, 0, 3), { rng: () => 0.5 }); b.beginWind(attackOf('centipede', 'ring'), player(v()));
  b.hit('push', v(0, 0, -1), { shove: 2 });
  assert.equal(b.state, 'recover', 'pushed apart');
  // plated: from behind half, no stagger; the head turned in for the ring takes double
  const h = new Foe('centipede', v(), { rng: () => 0.5 }); h.heading = 0; h.state = 'chase';
  h.hit('blade', v(0, 0, 1), { damage: 2 });
  assert.equal(h.hp, FOES.centipede.hp - 1, 'its back: half');
  assert.notEqual(h.state, 'recover', 'and it never reels');
  const t = new Foe('centipede', v(), { rng: () => 0.5 }); t.heading = 0; t.beginWind(attackOf('centipede', 'ring'), player(v(0, 0, 4))); t.k = 0.8; t.heading = 0;
  t.hit('blade', v(0, 0, -1), { damage: 1 });
  assert.equal(t.hp, FOES.centipede.hp - 2, 'its head, turned in: double');
  // the shed: cut from behind under two thirds, two skitterers run off its tail, once
  clearTargets();
  const Q = player(v(0, 0, 0)), G = world(Q); G.waveRest = 1e9;
  const s = G.add('centipede', v(0, 0, 3)); s.heading = 0; s.hp = 4.5;
  for (let i = 0; i < 5; i++) G.update(DT);
  const n = G.list.length;
  G.hurt(s, 'blade', v(Math.sin(s.heading), 0, Math.cos(s.heading)), { damage: 1 });
  assert.equal(G.list.length, n + 2, 'two skitterers off its tail');
  assert.ok(G.list.slice(-2).every((x) => x.kind === 'skitter'));
  G.hurt(s, 'blade', v(Math.sin(s.heading), 0, Math.cos(s.heading)), { damage: 1 });
  assert.equal(G.list.length, n + 2, 'only once');
  G.dispose(); clearTargets();
  // calm: coiled on its rock it doesn't move; close in and it uncoils for you
  const k = new Foe('centipede', v(0, 0, 0), { rng: () => 0.5, calm: true });
  run(k, player(v(0, 0, 8)), 1);
  assert.ok(k.state === 'idle' && k.pos.length() < 1e-9, 'coiled, still');
  assert.ok(run(k, player(v(0, 0, 5)), 0.1).includes('notice'), 'at 5 m it takes offence');
});

test('the lantern jelly: it never starts a fight but joins one; it wards a neighbour (half the harm, no staggers) with a lantern a shot or the boomerang pops; it mends in its tier-2 skins; its curtain stings under it', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500) }, levelId: 'spheres', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });
  const j = foes.add('jelly', v(0, 0, 1), { calm: true }), r = foes.add('crab', v(0, 0, 9), { calm: true });
  for (let i = 0; i < 30; i++) foes.update(DT);
  assert.equal(j.state, 'idle', 'right over you, it still starts nothing');
  foes.alarm(r);
  assert.ok(j.provoked, 'a neighbour’s fight: it joins');
  foes.dispose(); clearTargets();
  // the ward: one of its lanterns on a neighbour; half the harm and no reel; a shot pops it, the ward with it
  const Q = player(v(0, 0, 0)), G = world(Q); G.waveRest = 1e9;
  const J = G.add('jelly@spheres', v(0, 0, 6)), B = G.add('blot@spheres', v(1, 0, 5));
  let warded = false;
  for (let i = 0; i < 8 / DT && !warded; i++) { G.update(DT); Q.health = 1; Q.down = null; warded = B.ward?.by === J; }
  assert.ok(warded, 'it wards the blot');
  assert.ok(J.wards.includes(B) && J.lanterns === 3);
  B.state = 'wind'; B.k = 0.2; B.atk = attackOf('blot', 'lunge');
  const hp = B.hp; B.hit('blade', v(0, 0, 1), { damage: 1 });
  assert.equal(B.hp, hp - 0.5, 'half the harm');
  assert.equal(B.state, 'wind', 'it shrugs off the stagger');
  assert.equal(G.hurt(J, 'shoot', v(0, 0, 1), {}), true);
  assert.ok(J.lanterns === 2 && !B.ward && J.hp === FOES.jelly.hp, 'the shot pops a lantern and ends the ward; the jelly unhurt');
  J.pop(); J.pop();
  assert.equal(J.lanterns, 0); assert.equal(J.hit('shoot', v(0, 0, 1)), true); assert.equal(J.hp, FOES.jelly.hp - 1, 'no lanterns left: the shot hurts it');
  assert.ok(!J.attacksAt(5).some((a) => a.id === 'ward'), 'no lantern, no ward');
  G.dispose(); clearTargets();
  // the mend: only the tier-2 skins, and only with a hurt neighbour; it comes down within reach to do it
  const H = player(v(0, 0, 0)), M = world(H); M.waveRest = 1e9;
  const cloud = M.add('jelly@arzach2', v(0, 0, 6)), halo = M.add('jelly@spheres', v(4, 0, 6)), hurt = M.add('blot@spheres', v(2, 0, 7));
  hurt.hp = 0.5;
  for (const x of [cloud, halo]) x.allies = [hurt];
  assert.ok(!cloud.attacksAt(5).some((a) => a.id === 'mend'), 'the cloud jelly (Vael II) never mends');
  assert.ok(halo.attacksAt(5).some((a) => a.id === 'mend'), 'the halo jelly does');
  halo.beginWind(attackOf('jelly', 'mend'), H);
  for (let i = 0; i < 1.6 / DT; i++) { halo.update(DT, H, env); }
  assert.ok(halo.alt < 2, `it came down within reach (${halo.alt.toFixed(2)} m)`);
  M.support(halo, { type: 'mend', target: hurt, atk: attackOf('jelly', 'mend') });
  assert.equal(hurt.hp, Math.min(hurt.def.hp, 0.5 + attackOf('jelly', 'mend').mend.hp), 'mended');
  M.dispose(); clearTargets();
  // the curtain: under it, it stings
  const C = new Foe('jelly', v(0, 0, 0), { rng: () => 0.5 }); C.beginWind(attackOf('jelly', 'curtain'), player(v(0.5, 0, 0)));
  const ev = run(C, player(v(0.5, 0, 0)), 1.4);
  assert.ok(ev.some((e) => e.type === 'strike' && e.hit), 'under it: stung');
});
test('a cut across a lantern jelly’s thread of light breaks its ward (combat-v1.9 rec. 2)', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P); foes.waveRest = 1e9;
  const J = foes.add('jelly', v(0, 0, 8)), T = foes.add('blot', v(2, 0, 7));
  foes.support(J, { type: 'ward', target: T, atk: attackOf('jelly', 'ward') });
  assert.ok(T.ward?.by === J && J.wards.includes(T), 'warded');
  // the thread: a thing to cut half-way from its lantern to the one it guards; only the blade cuts it
  const threads = [...allTargets()].filter((t) => t.kind === 'rope' && t.enabled());
  assert.equal(threads.length, 1, 'one thread of light');
  const at = threads[0].position();
  assert.ok(at.distanceTo(T.chest) < at.distanceTo(J.chest) + 3 && at.distanceTo(T.chest) > 0.3, 'between the lantern and the foe');
  assert.equal(threads[0].onHit('shot', at, v(0, 0, 1), {}), false, 'a shot passes through the light (it pops the lantern instead)');
  assert.ok(T.ward, 'still warded');
  assert.equal(threads[0].onHit('blade', at, v(0, 0, 1), {}), true);
  assert.equal(T.ward, null, 'cut: the ward is broken');
  assert.ok(!J.wards.includes(T) && J.lanterns === J.def.lanterns, 'the jelly keeps its lantern (it may ward again)');
  assert.equal([...allTargets()].filter((t) => t.kind === 'rope' && t.enabled()).length, 0, 'the thread gone');
  // a ward that runs out takes its thread with it
  foes.support(J, { type: 'ward', target: T, atk: attackOf('jelly', 'ward') });
  T.unward();
  assert.equal([...allTargets()].filter((t) => t.kind === 'rope' && t.enabled()).length, 0, 'no thread left over');
  foes.dispose(); clearTargets();
});


// ------------------------------------------------------------------------------------------- batch 3
const BATCH3 = ['toad', 'heron', 'skitter', 'rootknot'];

test('batch 3: the bellows toad, the stilt heron, the skitter swarm and the root knot are built in every skin, drawn to both their sheets; the stand-ins they replace are retired; the Desert, Vael and Lorn run wholly on the new roster', () => {
  for (const a of BATCH3) {
    const A = ARCHETYPES[a];
    assert.equal(A.status, 'built', a); assert.equal(A.kind, a);
    assert.ok(A.art.main && A.art.alt, `${a}: drawn to both its sheets`);
    for (const n of [1, 2]) assert.ok(existsSync(new URL(`../references/enemy-archetypes/${a}/sheet-${n}.jpg`, import.meta.url)), `${a}: sheet-${n}`);
    for (const w of skinWorlds(a)) { const f = new Foe(skinned(a, w), v()); assert.equal(f.archetype, a); }
  }
  assert.deepEqual([ARCHETYPES.toad.art, ARCHETYPES.heron.art, ARCHETYPES.skitter.art, ARCHETYPES.rootknot.art].map((x) => `${x.main}/${x.alt}`), ['perdide/incal', 'desert/arzach', 'desert/moonfoundry', 'perdide/perdide2']);
  // the spitting blot, the blot swarm and the root stalker are gone (the toad, the skitters and the root knot took them)
  for (const k of ['spitter', 'swarm', 'stalker']) {
    assert.ok(!FOES[k], `${k} retired`);
    assert.throws(() => new Foe(k, v()), /Unknown enemy/);
    assert.ok(ARENA_WAVES.flat().every((x) => parseKind(x).kind !== k), `${k}: not in the Arena`);
  }
  for (const k of BATCH3) assert.ok(WAVES.some((w) => w.includes(k)), `${k}: in the Arena's old waves, where the stand-ins came`);
  assert.equal(FOES.centipede.shed.kind, 'skitter', 'the centipede sheds skitters');
  // the early worlds wholly on the new roster: every kind they spawn is a built archetype's own
  for (const w of ['desert', 'arzach', 'arzach2', 'perdide']) {
    const R = ROSTERS[w], kinds = new Set([...Object.keys(R.wild), ...Object.keys(R.fill), R.first, ...R.guards, ...(WORLDS[w].placed ?? []).map(spawnKindOf)]);
    for (const k of kinds) assert.equal(ARCHETYPES[archetypeOfKind(k)].status, 'built', `${w}: ${k}`);
  }
  assert.deepEqual(aloneWave('skitter', 'desert'), Array(8).fill('skitter@desert'), 'a flock of eight');
  assert.equal(waveWords([...Array(8).fill('skitter@desert'), 'blot']), '1 ink blot and a swarm of dune skitters');
});

test('the bellows toad: it keeps its distance and lobs a glob that leaves spores that slow you; a shot in its swollen throat makes it choke; the volley only in the City-Shaft and the Waterfall; its belly flop leaps onto where you stood, a ring of shock as it lands; the air cut in the leap turns it on its back, double', () => {
  // the lob: a mark where you stand; spores there that slow you
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P); foes.waveRest = 1e9;
  const t = foes.add('toad', v(0, 0, 7)); t.attacksAt = () => [attackOf('toad', 'lob')]; t.state = 'chase'; t.cool = 0; t.retreat = 0;
  let landed = false;
  for (let i = 0; i < 4 / DT && !landed; i++) { foes.update(DT); P.health = 1; P.down = null; landed = (foes.patches ?? []).some((p) => p.kind === 'spores'); }
  assert.ok(landed, 'spores where the glob landed');
  const patch = foes.patches.find((p) => p.kind === 'spores');
  assert.ok(Math.hypot(patch.pos.x, patch.pos.z) < 0.6 && Math.abs(patch.life - SPORES.life) < 0.2, 'where you stood, for a while');
  P.pos.copy(patch.pos); P.vel.set(4, 0, 0);
  foes.updateHazards(0.1);
  assert.ok(P.vel.x < 4 * 0.6, `wading through them slows you (${P.vel.x.toFixed(2)} m/s)`);
  foes.dispose(); clearTargets();
  // the choke: a shot while its throat is swollen
  const c = new Foe('toad', v(0, 0, 0), { rng: () => 0.5 }); c.beginWind(attackOf('toad', 'lob'), player(v(0, 0, 8))); c.k = 0.5;
  assert.equal(c.hit('shoot', v(0, 0, -1), {}), 'choked');
  assert.ok(c.stunned >= CHOKE - 1e-9 && c.state === 'chase' && c.hp === FOES.toad.hp - 1, 'it chokes on its glob, stunned, the lob lost');
  // the volley: only the pressure toads
  assert.ok(!new Foe('toad@perdide', v()).attacksAt(8).some((a) => a.id === 'volley'), 'the spore toad lobs one');
  assert.ok(new Foe('toad@incal', v()).attacksAt(8).some((a) => a.id === 'volley'), 'the pressure toad lobs three');
  // the belly flop: a leap onto where you stood, up in the air, a ring of shock as it lands
  clearTargets();
  const Q = player(v(0, 0, 0)), F = world(Q); F.waveRest = 1e9;
  const b = F.add('toad', v(0, 0, 4)); b.attacksAt = () => [attackOf('toad', 'flop')]; b.state = 'chase'; b.cool = 0; b.retreat = 0;
  let high = 0, wave = false;
  for (let i = 0; i < 3 / DT && !wave; i++) { F.update(DT); Q.health = 1; Q.down = null; high = Math.max(high, b.alt); wave = (F.shocks ?? []).length > 0; }
  assert.ok(high > 2, `up in the air (${high.toFixed(2)} m)`);
  assert.ok(wave && b.pos.distanceTo(v(0, 0, 0)) < 0.6, 'it came down where you stood, a ring of shock running out');
  for (let i = 0; i < 30 && b.state === 'strike'; i++) F.update(DT);
  assert.equal(b.alt, 0, 'down again');
  F.dispose(); clearTargets();
  const L = new Foe('toad', v(0, 0, 4), { rng: () => 0.5 }); L.beginWind(attackOf('toad', 'flop'), player(v())); L.state = 'strike'; L.k = 0.5; L.alt = 2;
  assert.equal(L.hit('blade', v(0, 0, 1), { damage: 1, air: true }), true);
  assert.ok(L.flipped >= LEAP_FLIP - 1e-9 && L.hp === FOES.toad.hp - 2 && L.alt === 0, 'met in the air: on its back, the cut double');
  // calm: it sits by the water; within 4 m it fights
  const s = new Foe('toad', v(0, 0, 0), { rng: () => 0.5, calm: true });
  run(s, player(v(0, 0, 6)), 1);
  assert.equal(s.state, 'idle', 'at 6 m it sits on');
  assert.ok(run(s, player(v(0, 0, 3.5)), 0.1).includes('notice'), 'at 3.5 m it fights');
});

test('the stilt heron: the spear reaches 5 m along its line; a guard knocks the bill aside and leaves it open; a charged cut at its legs topples it (down, cuts double, it stays down); the sweep only under it; the buffet only Vael’s, straight back', () => {
  const h = new Foe('heron', v(0, 0, 0), { rng: () => 0.5 }); h.heading = 0;
  assert.deepEqual(h.attacksAt(4.8).map((a) => a.id), ['spear'], 'at 5 m: the spear');
  assert.deepEqual(h.attacksAt(1.5).map((a) => a.id), ['sweep'], 'under it: the sweep');
  const S = new Foe('heron', v(0, 0, 0), { rng: () => 0.5 }); S.attacksAt = () => [attackOf('heron', 'spear')]; S.state = 'chase'; S.cool = 0;
  const ev = run(S, player(v(0, 0, 4.8)), 1.5);
  assert.equal(ev.find((e) => e.type === 'strike')?.hit, true, 'the bill reaches you at 4.8 m');
  // guarded: open
  clearTargets();
  const P = player(v(0, 0, 0), { guard: () => true }), foes = world(P);
  const g = foes.add('heron', v(0, 0, 4));
  foes.strike(g, attackOf('heron', 'spear'));
  assert.ok(g.open >= OPEN.guard - 1e-9 && g.stunned >= OPEN.guard - 1e-9, 'a plain guard knocks the bill aside: open');
  P.guard = () => 'perfect'; const g2 = foes.add('heron', v(2, 0, 4)); foes.strike(g2, attackOf('heron', 'spear'));
  assert.ok(g2.open >= OPEN.perfect - 1e-9, 'a perfect parry: open longer');
  foes.dispose(); clearTargets();
  // toppled by a charged cut; it stays down for the cuts, double
  const T = new Foe('heron', v(), { rng: () => 0.5 });
  assert.equal(T.hit('blade', v(0, 0, 1), { damage: 1, breaks: true }), 'toppled');
  assert.ok(T.toppled >= TOPPLE - 1e-9 && T.stunned >= TOPPLE - 1e-9, 'down');
  T.hit('blade', v(0, 0, 1), { damage: 1 });
  assert.equal(T.hp, FOES.heron.hp - 3, 'the next cut lands double');
  assert.ok(T.toppled > 0 && T.stunned > 0, 'and it stays down');
  // the buffet: Vael's alone, and it shoves you straight back (no partner to shove you to)
  assert.ok(!new Foe('heron@desert', v()).attacksAt(2).some((a) => a.id === 'buffet'));
  clearTargets();
  const Q = player(v(0, 0, 2)), F = world(Q); const r = F.add('heron@arzach', v(0, 0, 0)); F.add('heron@arzach', v(-3, 0, 5));
  F.strike(r, attackOf('heron', 'buffet'));
  assert.ok(Q.vel.z > 5 && Math.abs(Q.vel.x) < 0.5, `straight back (${Q.vel.x.toFixed(1)}, ${Q.vel.z.toFixed(1)})`);
  F.dispose(); clearTargets();
  // calm: it wades, walks off as you come near, fights cornered
  const c = new Foe('heron', v(0, 0, 0), { rng: () => 0.5, calm: true });
  run(c, player(v(0, 0, 5)), 1.5);
  assert.ok(c.state === 'idle' && c.pos.z < -0.2, `it walks off (${c.pos.z.toFixed(2)})`);
  assert.ok(run(c, player(v(c.pos.x, 0, c.pos.z + 2.2)), 0.1).includes('notice'), 'cornered at 2.2 m, it fights');
});

test('the skitter swarm: a flock of eight rings you and darts in one at a time; three climb into a heap that topples onto you; the push scatters the heap, an ember the flock; calm, it scatters when you run at it and fights only if you stay in the middle of it', () => {
  assert.equal(FOES.skitter.group, 8);
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P); foes.waveRest = 1e9;
  const flock = foes.spawnKind('skitter', { dist: 5 });
  let most = 0, near = Infinity, far = 0;
  for (let i = 0; i < 6 / DT; i++) {
    foes.update(DT); P.health = 1; P.down = null;
    most = Math.max(most, flock.filter((f) => f.alive && !f.riding && (f.state === 'wind' || f.state === 'strike')).length);
    if (i > 2 / DT) for (const f of flock) if (f.alive && f.state === 'chase' && !f.riding && f.cool === 0) { const d = f.pos.distanceTo(P.pos); near = Math.min(near, d); far = Math.max(far, d); }   // (waiting their turn)
  }
  assert.equal(most, 1, 'one at a time');
  assert.ok(near > 2 && far < 6.5, `between darts they ring you at about ${FOES.skitter.flock.ring} m (${near.toFixed(1)}-${far.toFixed(1)})`);
  foes.dispose(); clearTargets();
  // the pile: its flock climbs on as it winds up; the push on any of the heap breaks it
  const Q = player(v(0, 0, 0)), F = world(Q); F.waveRest = 1e9;
  const base = F.add('skitter', v(0, 0, 2.5)), m = [F.add('skitter', v(1, 0, 3)), F.add('skitter', v(-1, 0, 3)), F.add('skitter', v(0, 0, 4))];
  for (const x of [base, ...m]) x.cool = 99;
  for (let i = 0; i < 3; i++) F.update(DT);
  assert.ok(base.mates >= 2 && base.attacksAt(2.5).some((a) => a.id === 'pile'), 'with its flock near it may pile');
  base.beginWind(attackOf('skitter', 'pile'), Q); F.pile(base);
  assert.equal(m.filter((x) => x.riding?.on === base).length, 3, 'three climb on');
  for (let i = 0; i < 0.6 / DT; i++) { F.update(DT); Q.health = 1; Q.down = null; }
  assert.ok(m.every((x) => x.pos.distanceTo(base.pos) < 0.5), 'onto it');
  F.hurt(m[0], 'push', v(0, 0, 1), { shove: 2 });
  F.update(DT);
  assert.equal(base.state, 'recover', 'the push on the heap scatters it');
  assert.ok(m.slice(1).every((x) => !x.riding), 'they tumble off');
  F.dispose(); clearTargets();
  // an ember into the flock sends the others running
  const R = player(v(0, 0, 0)), G = world(R); const e = [G.add('skitter', v(0, 0, 4)), G.add('skitter', v(1, 0, 4)), G.add('skitter', v(-1, 0, 4))];
  G.hurt(e[0], 'fire', v(0, 0, 1), {});
  assert.ok(e.slice(1).every((x) => x.scatter > 1), 'the rest run from the ember');
  G.dispose(); clearTargets();
  // calm: run at it and it scatters; stand in the middle of it and it fights
  const k = new Foe('skitter', v(0, 0, 0), { rng: () => 0.5, calm: true });
  run(k, player(v(0, 0, 4), { vel: v(0, 0, -5) }), 0.3);
  assert.ok(k.scatter > 0 && k.pos.z < -0.5, 'it scatters from you running at it');
  const j = new Foe('skitter', v(0, 0, 0), { rng: () => 0.5, calm: true }), Y = player(v(0, 0, 0.5));
  assert.ok(!run(j, Y, 1).includes('notice'), 'a moment among them: nothing');
  assert.ok(run(j, Y, 2).includes('notice'), 'stay in the middle of the flock and it fights');
});

test('the root knot: it can’t be knocked back; its grip runs along the ground (a jump clears it); the spore puff only in Lorn II, a blur and no harm; calm, it stands rooted', () => {
  const r = new Foe('rootknot', v(), { rng: () => 0.5 });
  r.hit('blade', v(0, 0, 1), { damage: 1, combo: 2 }); r.hit('push', v(0, 0, 1), { shove: 3 });
  assert.equal(r.vel.length(), 0, 'rooted: neither the third swing nor the push moves it');
  r.staggered(true);
  assert.equal(r.vel.length(), 0, 'nor a parry');
  clearTargets();
  const J = player(v(0, 0, 0), { onGround: false }), F = world(J), g = F.add('rootknot', v(0, 0, 5));
  assert.equal(F.strike(g, attackOf('rootknot', 'grip')), false, 'in the air: the roots pass under you');
  assert.equal(F.hold ?? null, null);
  J.onGround = true;
  F.strike(g, attackOf('rootknot', 'grip'));
  assert.equal(F.hold?.kind, 'grab', 'on your feet: caught');
  F.dispose(); clearTargets();
  assert.ok(!new Foe('rootknot@perdide', v()).attacksAt(2).some((a) => a.id === 'puff'), 'the reed knot never puffs');
  assert.ok(new Foe('rootknot@perdide2', v()).attacksAt(2).some((a) => a.id === 'puff'), 'the root crawler does');
  const Q = player(v(0, 0, 0)), G = world(Q), p = G.add('rootknot@perdide2', v(0, 0, 2));
  G.strike(p, attackOf('rootknot', 'puff'));
  assert.ok(G.blinded > 1.5 && Q.hurts.length === 0, 'a blur of spores, no harm');
  G.dispose(); clearTargets();
  // calm: rooted where it stands
  const c = new Foe('rootknot', v(0, 0, 0), { rng: () => 0.5, calm: true });
  run(c, player(v(0, 0, 6)), 2);
  assert.ok(c.state === 'idle' && c.pos.length() < 1e-9, 'it stands rooted');
  assert.ok(run(c, player(v(0, 0, 3)), 0.1).includes('notice'), 'pass close and it takes you');
});

test('batch 3: drops; each new move winds up at least its minimum, only the toad’s lobs mark the ground', () => {
  for (const a of BATCH3) {
    assert.equal(DROP_OF[a], ARCHETYPES[a].drop);
    for (const x of FOES[a].attacks) {
      assert.ok(x.wind >= windMin(x) - 1e-9, `${a}.${x.id}`);
      assert.equal(groundMark(x), a === 'toad' && (x.id === 'lob' || x.id === 'volley'), `${a}.${x.id}: a mark only for a lob`);
    }
  }
});

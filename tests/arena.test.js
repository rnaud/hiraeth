// The Arena (docs/systems/foes.md "The Arena"): its old cycle ("Waves from here") through every kind, then every built
// archetype in each of its skins, then each world's archetypes and packs (src/foe-worlds.js; its default run of one foe
// at a time: tests/arena-run.test.js); the FOES list, grouped by world, with
// a search and a world filter; the temple guardians called into a ring on the sand.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, WAVES, ARENA_WAVES, arenaWave, arenaWaveOf, waveText, worldWaves } from '../src/foes.js';
import { BUILT, ARCHETYPES, parseKind } from '../src/enemies/archetypes.js';
import { HOME_SKIN } from '../src/enemies/skins.js';
import { WORLDS } from '../src/foe-worlds.js';
import { foeSections, filterSections, FoeList } from '../src/foe-spawner.js';
import { GUARDIANS, ArenaGuardians, RING } from '../src/arena-guardians.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function player(at = v()) { return { pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: 0, knocks: 0, hurt() { this.hurts++; }, knockDown() { this.knocks++; return true; }, flinch() {} }; }
const world = (P, notes = []) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), notice: (t) => notes.push(t) });
const skinWaves = BUILT.length;   // (one look each, #748)

test('the Arena’s waves: the ink and the worlds’ kinds first, then each built archetype in its one look, then each world’s own; round again', () => {
  assert.deepEqual(ARENA_WAVES.slice(0, WAVES.length), WAVES, 'the old waves first, as they were');
  const skins = ARENA_WAVES.slice(WAVES.length, WAVES.length + skinWaves);
  for (const a of BUILT) assert.ok(skins.some((x) => x[0] === `${ARCHETYPES[a].kind}@${HOME_SKIN[a]}`), `${a} in its one look`);
  assert.ok(skins.every((x) => new Set(x).size === 1 || (FOES[parseKind(x[0]).kind].escort && new Set(x.slice(0, -1)).size === 1)), 'each alone (a pair kind as its pair; a support with its escort)');
  // every kind, every built archetype in every skin, and every world comes round
  const all = new Set(ARENA_WAVES.flat().map((k) => parseKind(k).kind));
  for (const k of Object.keys(FOES)) if (!FOES[k].noWild) assert.ok(all.has(k), k);
  for (const w of Object.keys(WORLDS)) {
    assert.ok(arenaWaveOf(w) >= WAVES.length + skinWaves, `${w} has waves`);
    assert.deepEqual(arenaWave(arenaWaveOf(w)), worldWaves(w)[0], `${w}: its waves start with its first archetype alone`);
    assert.ok(worldWaves(w).flat().every((k) => parseKind(k).skin === w && FOES[parseKind(k).kind]), `${w}: each in its skin`);
  }
  assert.deepEqual(arenaWave(ARENA_WAVES.length), ARENA_WAVES[0], 'round and round');
  assert.equal(arenaWaveOf('nowhere'), -1);
  // no world enemy is left (retired: docs/design/enemy-roster.md)
  assert.ok(ARENA_WAVES.flat().every((k) => !k.includes('/')), 'no world enemy ids');
});

test('the old cycle (the FOES list’s “Waves from here”) comes in that order in a running Arena, and says what and from where', () => {
  clearTargets();
  const notes = [], P = player(), foes = world(P, notes);
  foes.startWaves('desert');   // (the cycle, not the run of one foe at a time: tests/arena-run.test.js)
  foes.wave = WAVES.length - 1;   // (the last of the old waves)
  const seen = [];
  for (let n = 0; n < 3; n++) {
    foes.waveRest = 0; foes.updateWaves(DT);
    seen.push(foes.list.filter((f) => f.alive).map((f) => `${f.kind}@${f.skin}`));
    for (const f of foes.list.slice()) foes.remove(f);
  }
  assert.deepEqual(seen[1], ARENA_WAVES[WAVES.length].map((k) => k));
  assert.match(notes.at(-1), /Wave \d+ · .+: /);
  assert.equal(waveText(['blot', 'blot']), '2 ink blots');
  assert.equal(waveText(['crab@saltharbour', 'tripod@incal']), '1 cliff crab and 1 inspection tripod', 'one look, one name (#748)');
  // waves from a world: the field cleared, the cycle from its first archetype (in its one look)
  foes.startWaves('incal');
  foes.waveRest = 0; foes.updateWaves(DT);
  assert.deepEqual(foes.list.filter((f) => f.alive).map((f) => f.kind), worldWaves('incal')[0].map((k) => parseKind(k).kind));
  assert.ok(foes.list.filter((f) => f.alive).every((f) => f.skin === HOME_SKIN[f.archetype]));
  foes.dispose(); clearTargets();
});

test('the FOES list: the roster first, a section per world (its archetypes in its skin), the guardians last; searched and filtered', () => {
  const s = foeSections();
  assert.equal(s[0].id, 'roster');
  assert.deepEqual(s.slice(1, -1).map((x) => x.id), Object.keys(WORLDS), 'a section per world, in the table’s order');
  assert.equal(s.at(-1).id, 'guardians');
  assert.equal(s.at(-1).items.length, GUARDIANS.length);
  assert.ok(s.slice(0, -1).every((x) => x.items.every((i) => FOES[parseKind(i.kind).kind])), 'every row is a kind there is');
  assert.ok(s.slice(0, -1).every((x) => x.items.every((i) => !i.kind.includes('/'))), 'no world enemy is left');
  for (const a of BUILT) assert.ok(s[0].items.some((i) => parseKind(i.kind).kind === ARCHETYPES[a].kind), `${a} in the roster`);
  // a search: by name, by world, by attack
  const crab = filterSections(s, { q: 'crab' });
  assert.ok(crab.length > 2 && crab.every((x) => x.items.every((i) => /crab/i.test(i.search))));
  assert.ok(filterSections(s, { q: 'cliff crab' }).some((x) => x.id === 'saltharbour'), 'one look, one name in every world (#748)');
  assert.ok(!filterSections(s, { q: 'anchor crab' }).length, 'no other world’s skin offered');
  assert.ok(filterSections(s, { q: 'blare' }).flatMap((x) => x.items).length > 0, 'by attack');
  // a world filter
  assert.deepEqual(filterSections(s, { world: 'bazaar' }).map((x) => x.id), ['bazaar']);
  assert.deepEqual(filterSections(s, { world: 'guardians' }).map((x) => x.id), ['guardians']);
  // (issue #726: the Market fields roster v4; a side world keeps its own in their skins, and the roster every retired one)
  assert.ok(filterSections(s, { world: 'saltharbour', q: 'cliff crab' })[0].items.some((i) => i.kind === 'crab@saltharbour'), 'met there: its moves the Salt Harbour’s');
  assert.ok(filterSections(s, { world: 'bazaar', q: 'prowler' })[0].items.some((i) => parseKind(i.kind).kind === 'prowler'));
  for (const a of ['lizard', 'crab', 'mummer', 'heron']) assert.ok(s[0].items.some((i) => parseKind(i.kind).kind === a), `${a}: retired, still in the debug menu's roster`);
});

test('the list chooses: an archetype in a skin practised alone, a world’s waves, the field cleared; LB / RB turn the world filter', () => {
  clearTargets();
  const P = player(), foes = world(P), list = new FoeList({ doc: null, win: null });
  list.attach({ foes, player: P, physics: flat, scene: new THREE.Scene() });
  list.choose({ kind: 'tripod@underwater' });
  assert.equal(foes.practice.kind, 'tripod@underwater');
  assert.equal(foes.list.filter((f) => f.alive).length, 1);
  assert.equal(foes.list[0].skin, 'incal', 'it comes in alone, in its one look (spawnKind takes kind@world, #748)');
  assert.equal(foes.list[0].model.group.name, 'inspection tripod');
  list.choose({ waves: 'mangrove' });
  assert.equal(foes.practice, null);
  assert.equal(foes.wave, arenaWaveOf('mangrove'));
  list.choose({ clear: true });
  assert.equal(foes.list.filter((f) => f.alive).length, 0);
  // the world filter turns with LB / RB, round
  assert.equal(list.filter.world, 'all');
  list.turn(1); assert.equal(list.filter.world, 'roster');
  list.turn(1); assert.equal(list.filter.world, 'desert');
  list.turn(-1); list.turn(-1); list.turn(-1); assert.equal(list.filter.world, 'guardians', 'back past All: the guardians');
  // a guardian: the field cleared, the waves held, the guardian in its ring
  list.choose({ guardian: 'desert' });
  assert.equal(list.guardians.id, 'desert');
  assert.ok(foes.practice && !foes.practice.kind, 'no waves while it is out');
  list.choose({ waves: 'desert' });
  assert.equal(list.guardians.id, null, 'waves again send it back');
  foes.dispose(); list.dispose(); clearTargets();
});

test('every temple guardian can be called into the ring: it wakes as you step in, telegraphs and strikes, and can be brought to its end there', () => {
  for (const G of GUARDIANS) {
    clearTargets();
    const notes = [], P = player(v(0, 0, 0)), scene = new THREE.Scene();
    const A = new ArenaGuardians({ scene, player: P, physics: flat, notice: (t) => notes.push(t) });
    const g = A.call(G.id);
    assert.ok(g, G.id);
    assert.ok(Math.hypot(g.arena.center.x, g.arena.center.z - RING.ahead) < 1e-9, `${G.id}: the ring ahead of you`);
    P.pos.set(0, 0, RING.ahead - 6);   // (into the ring)
    let tele = false, t = 0;
    for (let i = 0; i < 40 / DT; i++) {
      t += DT; A.update(DT, t);
      // (read from its body: its wind-up's pose, nothing on the floor)
      if (g.attack && !g.attack.lob && g.attackK > 0 && !g.tele.group.visible) tele = true;
      P.down = null; P.dead = false; P.health = 1;
    }
    assert.notEqual(g.state, 'sleep', `${G.id}: awake`);
    assert.ok(tele, `${G.id}: a move told by its body`);
    assert.ok(P.knocks > 0 || P.hurts > 0 || g.order > 1, `${G.id}: it fought (${g.order} attacks)`);
    // spar it to its end: shots while it is open
    // (a phase that asks for a second verb first, src/temples/boss.js asks: answered against its move)
    const answer = () => { if (!g.asking) return; const Q = g.phase.asks; g.enter('fight'); g.begin(P, null, Q.moves[0]); assert.ok(g.answer(Q.verb), `${G.id}: its ${Q.verb} answered`); };
    for (let i = 0; i < 400 && g.state !== 'weary' && g.state !== 'resolved'; i++) { answer(); g.enter('open'); g.hit('mouth', 'shoot', v(), {}); }
    assert.ok(g.state === 'weary' || g.state === 'resolved', `${G.id}: ${g.state} at ${g.meter.toFixed(2)}`);
    if (g.state === 'weary') { g.resolve(); }
    assert.equal(g.state, 'resolved');
    A.dismiss();
    assert.equal(scene.children.length, 0, `${G.id}: the ring and the guardian gone`);
  }
  clearTargets();
});

// The Arena (docs/systems/foes.md "The Arena"): its waves cycle through every kind, then every built archetype in
// each of its skins, then each world's archetypes and packs (src/foe-worlds.js); the FOES list, grouped by world, with
// a search and a world filter; the temple guardians called into a ring on the sand.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, WAVES, ARENA_WAVES, arenaWave, arenaWaveOf, waveText, worldWaves } from '../src/foes.js';
import { BUILT, ARCHETYPES, parseKind } from '../src/enemies/archetypes.js';
import { SKINS } from '../src/enemies/skins.js';
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
const skinWaves = BUILT.reduce((n, a) => n + Object.keys(SKINS[a]).length, 0);

test('the Arena’s waves: the ink and the worlds’ kinds first, then each built archetype in each of its skins, then each world’s own; round again', () => {
  assert.deepEqual(ARENA_WAVES.slice(0, WAVES.length), WAVES, 'the old waves first, as they were');
  const skins = ARENA_WAVES.slice(WAVES.length, WAVES.length + skinWaves);
  for (const a of BUILT) for (const w of Object.keys(SKINS[a])) assert.ok(skins.some((x) => x[0] === `${ARCHETYPES[a].kind}@${w}`), `${a} in ${w}`);
  assert.ok(skins.every((x) => new Set(x).size === 1), 'each alone (a pair kind as its pair)');
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

test('the waves come in that order in a running Arena, and say what and from where', () => {
  clearTargets();
  const notes = [], P = player(), foes = world(P, notes);
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
  assert.equal(waveText(['crab@saltharbour', 'tripod@incal']), '1 anchor crab and 1 inspection tripod');
  // waves from a world: the field cleared, the cycle from its first archetype
  foes.startWaves('incal');
  foes.waveRest = 0; foes.updateWaves(DT);
  assert.deepEqual(foes.list.filter((f) => f.alive).map((f) => `${f.kind}@${f.skin}`), worldWaves('incal')[0]);
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
  assert.ok(filterSections(s, { q: 'anchor crab' }).some((x) => x.id === 'saltharbour'));
  assert.ok(filterSections(s, { q: 'blare' }).flatMap((x) => x.items).length > 0, 'by attack');
  // a world filter
  assert.deepEqual(filterSections(s, { world: 'bazaar' }).map((x) => x.id), ['bazaar']);
  assert.deepEqual(filterSections(s, { world: 'guardians' }).map((x) => x.id), ['guardians']);
  assert.ok(filterSections(s, { world: 'bazaar', q: 'coin lizard' })[0].items.some((i) => i.kind === 'lizard@bazaar'));
});

test('the list chooses: an archetype in a skin practised alone, a world’s waves, the field cleared; LB / RB turn the world filter', () => {
  clearTargets();
  const P = player(), foes = world(P), list = new FoeList({ doc: null, win: null });
  list.attach({ foes, player: P, physics: flat, scene: new THREE.Scene() });
  list.choose({ kind: 'tripod@underwater' });
  assert.equal(foes.practice.kind, 'tripod@underwater');
  assert.equal(foes.list.filter((f) => f.alive).length, 1);
  assert.equal(foes.list[0].skin, 'underwater', 'it comes in alone, in its skin (spawnKind takes kind@skin)');
  assert.equal(foes.list[0].model.group.name, 'diving bell');
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
      if (g.attack && !g.attack.lob && g.glows[0].visible && !g.tele.group.visible) tele = true;   // (read from its body: a glow, nothing on the floor)
      P.down = null; P.dead = false; P.health = 1;
    }
    assert.notEqual(g.state, 'sleep', `${G.id}: awake`);
    assert.ok(tele, `${G.id}: a move told by its body`);
    assert.ok(P.knocks > 0 || P.hurts > 0 || g.order > 1, `${G.id}: it fought (${g.order} attacks)`);
    // spar it to its end: shots while it is open
    for (let i = 0; i < 400 && g.state !== 'weary' && g.state !== 'resolved'; i++) { g.enter('open'); g.hit('mouth', 'shoot', v(), {}); }
    assert.ok(g.state === 'weary' || g.state === 'resolved', `${G.id}: ${g.state} at ${g.meter.toFixed(2)}`);
    if (g.state === 'weary') { g.resolve(); }
    assert.equal(g.state, 'resolved');
    A.dismiss();
    assert.equal(scene.children.length, 0, `${G.id}: the ring and the guardian gone`);
  }
  clearTargets();
});

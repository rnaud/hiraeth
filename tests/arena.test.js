// The Arena (docs/systems/foes.md "The Arena"): its waves cycle through every kind, the 100 world enemies
// included; the FOES list, grouped by world, with a search and a world filter; the temple guardians called into
// a ring on the sand.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, WAVES, ARENA_WAVES, arenaWave, arenaWaveOf, waveText } from '../src/foes.js';
import { ENEMY_ROSTER, WORLD_ENEMIES } from '../src/enemies/roster.js';
import { foeSections, filterSections, FoeList } from '../src/foe-spawner.js';
import { GUARDIANS, ArenaGuardians, RING } from '../src/arena-guardians.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function player(at = v()) { return { pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: 0, knocks: 0, hurt() { this.hurts++; }, knockDown() { this.knocks++; return true; }, flinch() {} }; }
const world = (P, notes = []) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), notice: (t) => notes.push(t) });

test('the Arena’s waves: the ink and the worlds’ kinds first, then every world enemy alone in world order, then in pairs, then each world’s four; round again', () => {
  assert.deepEqual(ARENA_WAVES.slice(0, WAVES.length), WAVES, 'the old waves first, as they were');
  const singles = ARENA_WAVES.slice(WAVES.length, WAVES.length + ENEMY_ROSTER.length);
  assert.deepEqual(singles, ENEMY_ROSTER.map((e) => [e.id]), 'each of the 100 alone, in world order');
  const worlds = Object.values(WORLD_ENEMIES);
  const pairs = ARENA_WAVES.slice(WAVES.length + ENEMY_ROSTER.length, WAVES.length + ENEMY_ROSTER.length + worlds.length * 2);
  assert.ok(pairs.every((w) => w.length === 2), 'then pairs');
  pairs.forEach((w, i) => assert.ok(w.every((id) => worlds[Math.floor(i / 2)].some((e) => e.id === id)), `pair ${i} from one world`));
  assert.ok(pairs.every((w) => ENEMY_ROSTER.find((e) => e.id === w[0]).category !== ENEMY_ROSTER.find((e) => e.id === w[1]).category), 'a pair mixes a creature with a machine or a spirit');
  const full = ARENA_WAVES.slice(-worlds.length);
  assert.deepEqual(full, worlds.map((r) => r.map((e) => e.id)), 'and last each world’s whole roster');
  // every kind and every world enemy comes round
  const all = new Set(ARENA_WAVES.flat());
  for (const k of Object.keys(FOES)) if (!FOES[k].noWild) assert.ok(all.has(k), k);
  for (const e of ENEMY_ROSTER) assert.ok(all.has(e.id), e.id);
  assert.deepEqual(arenaWave(ARENA_WAVES.length), ARENA_WAVES[0], 'round and round');
  assert.equal(arenaWaveOf('desert'), WAVES.length, 'a world’s first wave is its first enemy alone');
  assert.deepEqual(arenaWave(arenaWaveOf('arzach')), [WORLD_ENEMIES.arzach[0].id]);
});

test('the waves come in that order in a running Arena, and say what and from where', () => {
  clearTargets();
  const notes = [], P = player(), foes = world(P, notes);
  foes.wave = WAVES.length - 1;   // (the last of the old waves)
  const seen = [];
  for (let n = 0; n < 3; n++) {
    foes.waveRest = 0; foes.updateWaves(DT);
    seen.push(foes.list.filter((f) => f.alive).map((f) => f.species ?? f.kind));
    for (const f of foes.list.slice()) foes.remove(f);
  }
  assert.deepEqual(seen[1], [ENEMY_ROSTER[0].id]);
  assert.deepEqual(seen[2], [ENEMY_ROSTER[1].id]);
  assert.match(notes.at(-1), /Wave \d+ · The Desert: cistern beast/i);
  assert.equal(waveText(['blot', 'blot']), '2 ink blots');
  assert.equal(waveText([WORLD_ENEMIES.desert[0].id, WORLD_ENEMIES.desert[2].id]), 'dune skitter and possessed cistern pump');
  // waves from a world: the field cleared, the cycle from its first enemy
  foes.startWaves('arzach');
  foes.waveRest = 0; foes.updateWaves(DT);
  assert.deepEqual(foes.list.filter((f) => f.alive).map((f) => f.species), [WORLD_ENEMIES.arzach[0].id]);
  foes.dispose(); clearTargets();
});

test('the FOES list: grouped by world (the ink first, the guardians last), searched and filtered', () => {
  const s = foeSections();
  assert.equal(s[0].id, 'ink');
  assert.deepEqual(s.slice(1, -1).map((x) => x.id), Object.keys(WORLD_ENEMIES), 'a section per world, in world order');
  assert.equal(s.at(-1).id, 'guardians');
  assert.equal(s.at(-1).items.length, GUARDIANS.length);
  assert.equal(s.slice(1, -1).reduce((n, x) => n + x.items.length, 0), 100);
  assert.ok(s[0].items.every((i) => FOES[i.kind]));
  // a search: by name, by world, by attack
  const crab = filterSections(s, { q: 'crab' });
  assert.ok(crab.length > 2 && crab.every((x) => x.items.every((i) => /crab/i.test(i.search))));
  assert.deepEqual(filterSections(s, { q: 'salt harbour' }).map((x) => x.id), ['saltharbour']);
  assert.ok(filterSections(s, { q: 'beam' }).flatMap((x) => x.items).length > 0, 'by attack');
  // a world filter
  assert.deepEqual(filterSections(s, { world: 'desert' }).map((x) => x.id), ['desert']);
  assert.deepEqual(filterSections(s, { world: 'guardians' }).map((x) => x.id), ['guardians']);
  assert.equal(filterSections(s, { world: 'desert', q: 'shade' })[0].items.length, 1);
});

test('the list chooses: a world enemy practised alone, a world’s waves, the field cleared; LB / RB turn the world filter', () => {
  clearTargets();
  const P = player(), foes = world(P), list = new FoeList({ doc: null, win: null });
  list.attach({ foes, player: P, physics: flat, scene: new THREE.Scene() });
  list.choose({ kind: WORLD_ENEMIES.glassdunes[1].id });
  assert.equal(foes.practice.kind, WORLD_ENEMIES.glassdunes[1].id);
  assert.equal(foes.list.filter((f) => f.alive).length, 1);
  assert.equal(foes.list[0].species, WORLD_ENEMIES.glassdunes[1].id, 'a world enemy comes in alone (spawnKind takes its id)');
  list.choose({ waves: 'mangrove' });
  assert.equal(foes.practice, null);
  assert.equal(foes.wave, arenaWaveOf('mangrove'));
  list.choose({ clear: true });
  assert.equal(foes.list.filter((f) => f.alive).length, 0);
  // the world filter turns with LB / RB, round
  assert.equal(list.filter.world, 'all');
  list.turn(1); assert.equal(list.filter.world, 'ink');
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
      if (g.tele.group.visible && g.attack) tele = true;
      P.down = null; P.dead = false; P.health = 1;
    }
    assert.notEqual(g.state, 'sleep', `${G.id}: awake`);
    assert.ok(tele, `${G.id}: an attack drawn on the floor`);
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

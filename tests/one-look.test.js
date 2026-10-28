import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, ARENA_FOES } from '../src/foes.js';
import { ARCHETYPES, BUILT, parseKind } from '../src/enemies/archetypes.js';
import { SKINS, HOME_SKIN, skinOf, skinWorlds } from '../src/enemies/skins.js';
import { TIERS, TIER_UP, fightOf } from '../src/enemies/fight.js';
import { WORLDS, PLACED, worldArchetypes, packOf } from '../src/foe-worlds.js';
import { SITES } from '../src/encounters/sites.js';
import { foeSections } from '../src/foe-spawner.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

// One look per kind (issue #748, the author's rule of 2026-10-28: "only 1 variation of each enemy for now, not slight
// variations and colors per worlds"): every foe wears its one skin (its main sheet's) in every world, the Arena, the fight
// temples and the lists; its stronger tier changes its stats and adds one move, never its look.

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
const player = () => ({ pos: v(0, 0, -40), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {} });
const field = (levelId) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: {} }, levelId, physics: flat, player: player(),
  settings: { enemies: 'normal' }, game: new GameState(null), rng: seeded() });
/** What a body looks like: each material's name and colour, and its painted surface (sorted: the same body, the same list). */
function lookOf(model) {
  const out = [];
  model.group.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) {
      const u = m.uniforms ?? {};
      out.push(JSON.stringify([o.name, u.uColor?.value?.getHexString?.() ?? m.color?.getHexString?.() ?? null, u.uColor2?.value?.getHexString?.() ?? null, Object.keys(m.defines ?? {}).filter((d) => d.startsWith('FS_')).sort()]));
    }
  });
  return out.sort();
}
/** Every archetype a world can field anywhere: its packs, sites, posts and its fight temple's horde. */
const fielded = (w) => [...new Set([...worldArchetypes(w), ...Object.keys(WORLDS[w].horde ?? {}), ...(PLACED[w] ?? []).map((p) => p.archetype),
  ...(SITES[w] ?? []).flatMap((s) => s.foes ?? [])])].filter((a) => ARCHETYPES[a]?.status === 'built' && FOES[ARCHETYPES[a].kind]);

test('one skin a kind: its main sheet\'s, offered alone; every other world\'s kept as data, never worn', () => {
  for (const a of Object.keys(SKINS)) {
    const A = ARCHETYPES[a];
    if (A.art?.main) assert.equal(HOME_SKIN[a], A.art.main, `${a}: its main sheet's skin`);
    assert.deepEqual(skinWorlds(a), [HOME_SKIN[a]], `${a}: one look offered`);
    const home = skinOf(a, HOME_SKIN[a]);
    for (const w of [...Object.keys(SKINS[a]), ...Object.keys(WORLDS), 'arena', null]) {
      const s = skinOf(a, w);
      assert.equal(s.id, home.id, `${a}@${w}: its one skin`);
      assert.equal(s.name, home.name, `${a}@${w}: its one name`);
      assert.deepEqual(s.palette, home.palette, `${a}@${w}: its one palette`);
      assert.deepEqual(s.props, home.props, `${a}@${w}: dressed the same`);
    }
  }
  // the lists: the Arena's run, the debug menu's foes
  for (const x of ARENA_FOES) { const { kind, skin } = parseKind(x[0]); const a = BUILT.find((b) => ARCHETYPES[b].kind === kind); if (a && skin) assert.equal(skin, HOME_SKIN[a], `${x[0]}: the Arena's in its one look`); }
  for (const s of foeSections()) for (const i of s.items ?? []) {
    if (!i.kind) continue;
    const a = BUILT.find((b) => ARCHETYPES[b].kind === parseKind(i.kind).kind);
    if (a) assert.equal(i.name, skinOf(a, null).name, `${s.id}: ${i.kind} named for its one look`);
  }
});

test('every enemy in every world wears its single skin: the same body as in the Arena, whatever the world or its stage', () => {
  clearTargets();
  const arena = field('arena'), own = {};
  for (const a of BUILT) { const f = arena.add(ARCHETYPES[a].kind, v(0, 0, 0), { tier: 0 }); own[a] = lookOf(f.model); arena.remove(f); }
  arena.dispose(); clearTargets();
  let n = 0;
  for (const w of Object.keys(WORLDS)) {
    const F = field(w);
    // each archetype it fields, met there (its packs', sites', posts', horde's), and each of its first packs' foes
    const kinds = [...fielded(w).map((a) => ARCHETYPES[a].kind), ...[0, 1, 2, 3, 4, 5].flatMap((p) => packOf(p, w, seeded(p + 1)))];
    for (const k of new Set(kinds)) {
      const f = F.add(k, v(0, 0, 0));
      if (!f.archetype || ARCHETYPES[f.archetype].status !== 'built') { F.remove(f); continue; }
      assert.equal(f.skin, HOME_SKIN[f.archetype], `${w}: ${k} in its one skin`);
      assert.deepEqual(lookOf(f.model), own[f.archetype], `${w}: ${k} looks as it does in the Arena`);
      F.remove(f); n++;
    }
    F.dispose(); clearTargets();
  }
  assert.ok(n > 100, `${n} foes looked at`);
});

test('a stronger tier changes its stats and adds its one move, never its look', () => {
  clearTargets();
  const F = field('bazaar');
  let n = 0;
  for (const a of BUILT) {
    const k = ARCHETYPES[a].kind;
    if (!TIERS[a] || fightOf(a, FOES[k]).fodder) continue;
    const base = F.add(k, v(0, 0, 0), { tier: 0 }), up = F.add(`${k}*`, v(4, 0, 0));
    assert.equal(base.tierN, 0); assert.equal(up.tierN, 1, `${a}: in tier`);
    assert.equal(up.skin, base.skin, `${a}: its skin`);
    assert.deepEqual(lookOf(up.model), lookOf(base.model), `${a}: its look`);
    assert.equal(up.model.group.name, base.model.group.name, `${a}: its name`);
    // the curve: tougher (its health and poise TIER_UP over its stage's, under the cap) and one new move
    assert.ok(up.hp > base.hp || up.hp === 16, `${a}: tougher (${up.hp} > ${base.hp})`);
    assert.ok(up.poiseMax >= base.poiseMax && up.poiseMax <= Math.ceil(base.poiseMax * TIER_UP.poise * 2) / 2 + 0.5, `${a}: steadier (${up.poiseMax} ≥ ${base.poiseMax}, in halves)`);
    const T = TIERS[a];
    if (T.combo) assert.ok(T.combo.every((id) => up.def.attacks.some((x) => x.id === id)), `${a}: its combo's moves`);
    if (T.unlock) assert.ok(up.def.attacks.find((x) => x.id === T.unlock && !x.skins), `${a}: ${T.unlock} unlocked`);
    if (T.patch) assert.notDeepEqual(up.def.attacks, base.def.attacks, `${a}: a move made stronger`);
    F.remove(base); F.remove(up); n++;
  }
  assert.ok(n >= 25, `${n} tiers`);
  F.dispose(); clearTargets();
});

test('a world\'s skin-only moves stay where they were met, in the one look (the crab\'s burrow in the Salt Harbour, the ray\'s draft in Vael)', () => {
  clearTargets();
  const F = field('arena');
  const crab = F.add('crab@saltharbour', v()), cliff = F.add('crab', v(3, 0, 0));
  assert.deepEqual(crab.moves, ['burrow']); assert.deepEqual(cliff.moves, []);
  assert.equal(crab.skin, cliff.skin);
  F.dispose(); clearTargets();
  const V = field('arzach'), ray = V.add('ray', v());
  assert.ok(ray.moves.includes('draft'), 'Vael\'s ray: its downdraft');
  V.dispose(); clearTargets();
  const U = field('underwater'), ray2 = U.add('ray', v());
  assert.ok(!ray2.moves.includes('draft'), 'the Underwater City\'s: none');
  assert.equal(ray2.skin, ray.skin, 'the same look');
  U.dispose(); clearTargets();
});

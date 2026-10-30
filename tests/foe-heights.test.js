// No foe in the game's worlds is tiny (issue #741, the author: "we can just scale up all the monsters that were tiny, all
// the bi-pedal ones should be at least my size"; and before it, "I want no enemy that is shorter than hip level, the tiny
// critters are too hard to hit"): every foe a world, a temple or the Arena fields stands, as the game draws it, at least
// as tall as the traveller if it walks on two legs, and at least to his hip otherwise. The ones that were not are grown
// through their archetype's scale (src/enemies/archetypes.js GROWN): drawn bigger, their body with them.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, BODY_BLOCK } from '../src/foes.js';
import { ARCHETYPES, BUILT, GROWN, grow } from '../src/enemies/archetypes.js';
import { OUT_OF_PLAY } from '../src/foe-worlds.js';
import { skinOf, HOME_SKIN } from '../src/enemies/skins.js';
import { visibleBox } from '../src/enemies/frame.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { B3_HEIGHT, B3_JOINTS } from '../src/characters/traveller-b3-fit.js';

/** The traveller: 1.75 m, his hips (the pelvis) at 0.955 m. */
const TALL = B3_HEIGHT, HIP = B3_JOINTS.pelvis[1];
/** The foes on two legs (the rest walk on more, crawl, roll, hover or swim under the sand). */
const BIPEDS = ['mummer', 'mummerking', 'grunt', 'hulk', 'prowler', 'warlord', 'sentinel', 'fencer', 'shade', 'brute'];
/** Every foe in play: the built archetypes but the ones out of play (the Arena's and the gallery's only), and the temples' makers' machine. */
const IN_PLAY = [...BUILT.filter((a) => !OUT_OF_PLAY.includes(a)).map((a) => ARCHETYPES[a].kind), 'machine'];

/** How tall it stands as the game draws it (m): its visible body's top over its feet, posed by Foes.look a while. */
function standing(kinds) {
  clearTargets();
  // (rng low: each its first weapon, a club for the mummers and the grunts; never its stronger tier)
  const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(0, 0, 40), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
  const out = {};
  for (const k of kinds) {
    const f = foes.add(k, new THREE.Vector3(), { tier: 0 }); f.heading = 0;
    for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
    out[k] = { top: visibleBox(f.model.group).max.y, f };
  }
  return { out, done: () => { foes.dispose(); clearTargets(); } };
}

test('every biped in play stands at least as tall as the traveller, every other foe at least to his hip (#741)', () => {
  assert.ok(Math.abs(TALL - 1.75) < 1e-9 && Math.abs(HIP - 0.955) < 1e-9, 'the traveller: 1.75 m, his hips at 0.955 m');
  for (const a of BIPEDS) assert.ok(ARCHETYPES[a], a);
  const { out, done } = standing(IN_PLAY);
  const short = [];
  for (const [k, { top }] of Object.entries(out)) {
    const need = BIPEDS.includes(k) ? TALL : HIP;
    if (top < need) short.push(`${k} ${top.toFixed(2)} m (at least ${need.toFixed(2)})`);
  }
  done();
  assert.deepEqual(short, [], `too short: ${short.join(', ')}`);
});

test('the grown ones: drawn GROWN times as built, their body with them; short as built, so the growth is what lifts them (#741)', () => {
  assert.deepEqual(Object.keys(GROWN).sort(), ['crawler', 'grunt', 'mummer', 'skitter']);
  const { out, done } = standing(Object.keys(GROWN).map((a) => ARCHETYPES[a].kind));
  for (const [a, k] of Object.entries(GROWN)) {
    const A = ARCHETYPES[a], { top, f } = out[A.kind];
    assert.equal(A.scale, k, `${a}: its scale`);
    assert.equal(skinOf(a, HOME_SKIN[a]).scale, k, `${a}: its skin drawn grown`);
    assert.equal(f.model.size, k, `${a}: its model's size`);
    assert.ok(Math.abs(f.model.group.scale.y - k) < 1e-9, `${a}: its body drawn ${k} times as big`);
    // (as built it was under its mark: the growth is needed, and no more than a fifth over it)
    const need = BIPEDS.includes(a) ? TALL : HIP;
    assert.ok(top / k < need, `${a}: ${(top / k).toFixed(2)} m as built, under ${need}`);
    assert.ok(top < need * 1.45, `${a}: ${top.toFixed(2)} m grown, not a giant`);
    // its body: the collision's and the hit body's radius and its height grown with it, its senses and speed not
    assert.equal(f.def, A.def);
  }
  assert.deepEqual(grow({ radius: 0.4, height: 1.2, speed: 3, sight: 16, attacks: [] }, 1.5), { radius: 0.4 * 1.5, height: 1.2 * 1.5, speed: 3, sight: 16, attacks: [] });
  done();
});

test('their attacks still connect: every blow from close reaches past the grown body to him, and begins from where its body holds him (#741)', () => {
  for (const a of Object.keys(GROWN)) {
    const D = ARCHETYPES[a].def, held = D.radius + BODY_BLOCK.player;   // (the nearest the two stand: body against body)
    for (const atk of D.attacks) {
      if (atk.lob || atk.at === 'target' || atk.horn || !(atk.damage > 0)) continue;   // (a lob, a shot at where he stands, a call)
      const reach = atk.at === 'self' ? atk.radius : atk.shape === 'ring' ? (atk.ahead ?? 0) + atk.radius : atk.range;
      assert.ok(reach + (atk.lunge ?? 0) > held, `${a}.${atk.id}: reaches ${(reach + (atk.lunge ?? 0)).toFixed(2)} m, past ${held.toFixed(2)}`);
      assert.ok((atk.max ?? Infinity) > held && (atk.min ?? 0) < (atk.max ?? Infinity), `${a}.${atk.id}: begun from ${atk.min ?? 0}–${atk.max} m`);
    }
  }
});

test('they still fit where they spawn: no grown foe wider or taller than the makers\' machine, which walks every temple\'s rooms and doors (#741)', () => {
  const { out, done } = standing(['machine', ...Object.keys(GROWN).map((a) => ARCHETYPES[a].kind)]);
  const M = out.machine;
  for (const a of Object.keys(GROWN)) {
    const { top, f } = out[ARCHETYPES[a].kind];
    assert.ok(f.def.radius <= M.f.def.radius, `${a}: radius ${f.def.radius.toFixed(2)} m, the machine's ${M.f.def.radius}`);
    assert.ok(top <= M.top, `${a}: ${top.toFixed(2)} m tall, the machine ${M.top.toFixed(2)}`);
  }
  done();
});

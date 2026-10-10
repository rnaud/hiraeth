// The enemy roster's batch 5 (docs/design/enemy-roster.md, build plan step 7; src/enemies/archetypes.js): the late
// spirits and the roller: the shade reworked (a cloak worn by nothing: the feint, the step through its shadow; plan 9,
// src/enemies/plans/humanoid.js), the pearl roller (its roll locked to the ground; plan 16, roller.js) and the marionette
// (a puppet on strings that drives the creatures near it; plan 21, strings.js), each drawn to both its sheets. With them
// every archetype is built: no stand-in is left and every world runs on the new roster.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { existsSync } from 'node:fs';
import { ARCHETYPES, ARCHETYPE_IDS, BUILT, archetypeOfKind, parseKind, skinned, spawnKindOf, RETIRED_KINDS } from '../src/enemies/archetypes.js';
import { skinWorlds } from '../src/enemies/skins.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { rollAngle } from '../src/enemies/plans/roller.js';
import { jag } from '../src/enemies/plans/humanoid.js';
import { ROSTERS, WORLDS, PLACED, worldArchetypes, packOf } from '../src/foe-worlds.js';
import { Foe, Foes, FOES, attackOf, ARENA_WAVES, WAVES, worldWaves, BOUNCE, POSSESS, LIT } from '../src/foes.js';
import { KINDS } from '../src/foe-kinds.js';
import { SPAWN_KINDS, foeSections } from '../src/foe-spawner.js';
import { windMin, groundMark } from '../src/telegraph.js';
import { DROP_OF } from '../src/chimes.js';
import { clearTargets, allTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const env = { ground: () => 0, seen: () => true };
function player(at = v(), o = {}) {
  return { pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: [], knocks: 0, flinches: 0,
    hurt(a) { this.hurts.push(a); }, knockDown() { this.knocks++; return true; }, flinch() { this.flinches++; }, ...o };
}
const world = (P, o = {}) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), ...o });
const run = (f, P, secs, e = env) => { const ev = []; for (let i = 0; i < secs / DT; i++) ev.push(...f.update(DT, P, e)); return ev; };
const BATCH5 = ['shade', 'roller', 'marionette'];

test('batch 5: the shade, the pearl roller and the marionette are built in every skin, drawn to both their sheets; no stand-in is left', () => {
  for (const a of BATCH5) {
    const A = ARCHETYPES[a];
    assert.equal(A.status, 'built', a); assert.equal(A.kind, a); assert.ok(BUILT.includes(a));
    assert.ok(A.art.main && A.art.alt, `${a}: drawn to both its sheets`);
    for (const n of [1, 2]) assert.ok(existsSync(new URL(`../references/enemy-archetypes/${a}/sheet-${n}.jpg`, import.meta.url)), `${a}: sheet-${n}`);
    for (const w of skinWorlds(a)) { const f = new Foe(skinned(a, w), v()); assert.equal(f.archetype, a); const m = archetypeModel(a, w); assert.ok(m, `${a}@${w} has a body`); m.dispose?.(); }
    assert.equal(DROP_OF[a], A.drop);
  }
  assert.deepEqual(BATCH5.map((a) => `${ARCHETYPES[a].art.main}/${ARCHETYPES[a].art.alt}`), ['perdide2/eclipse', 'garage/spheres', 'spheres/bazaar']);
  // every archetype on its own body: the roster's stand-ins and planned ones are gone
  assert.deepEqual(ARCHETYPE_IDS.filter((a) => ARCHETYPES[a].status !== 'built'), [], 'all 21 built');
  for (const a of ARCHETYPE_IDS) { assert.equal(ARCHETYPES[a].kind, a, `${a}: its own kind`); assert.equal(FOES[a], ARCHETYPES[a].def, `${a}: its own tuning`); }
  assert.deepEqual(Object.keys(KINDS), [], 'no old kind stands in');
  assert.deepEqual(RETIRED_KINDS, ['splinter']);
});

test('every world runs on the new roster: its packs, relic guards and placed ones are built archetypes in its skin; the Arena, the FOES list and the gallery field all three', () => {
  for (const w of Object.keys(WORLDS)) {
    const R = ROSTERS[w], kinds = new Set([...Object.keys(R.wild), ...Object.keys(R.fill), R.first, ...R.guards, ...Object.keys(R.late ?? {}), ...(WORLDS[w].placed ?? []).map(spawnKindOf)]);
    for (const k of kinds) assert.equal(ARCHETYPES[archetypeOfKind(k)]?.status, 'built', `${w}: ${k}`);
    for (const a of worldArchetypes(w)) assert.ok(kinds.has(ARCHETYPES[a].kind) || ARCHETYPES[a].family === 'spirit' || WORLDS[w].late?.includes(a), `${w}: ${a} spawns`);
    for (let n = 0; n < 40; n++) for (const k of packOf(n, w, () => (n * 0.137) % 1)) assert.ok(FOES[k], `${w} pack ${n}: ${k}`);
    // its own waves in the Arena: each archetype alone in the world's skin
    for (const wave of worldWaves(w)) for (const k of wave) assert.ok(FOES[parseKind(k).kind], `${w}: wave ${k}`);
  }
  // the shades walk their worlds (later packs, rarely in Lorn II); the roller leads the Garden; the marionette is late there
  assert.ok(ROSTERS.perdide2.wild.shade > 0 && ROSTERS.eclipse.wild.shade > 0);
  assert.equal(ROSTERS.spheres.first, 'roller');
  assert.ok(ROSTERS.spheres.late.marionette && ROSTERS.bazaar.late.marionette, 'the marionette comes late');
  assert.deepEqual(PLACED.spheres.map((p) => p.archetype), ['marionette'], 'the Garden’s glass puppet is placed by hand');
  for (const a of BATCH5) {
    assert.ok(WAVES.some((wv) => wv.includes(a)), `${a}: in the Arena's waves`);
    for (const w of skinWorlds(a)) assert.ok(ARENA_WAVES.some((wv) => wv.includes(skinned(a, w))), `${a}@${w}: alone in the Arena's cycle`);
    assert.ok(SPAWN_KINDS.includes(a), `${a}: on the FOES list`);
  }
  const rows = foeSections().flatMap((s) => s.items);
  for (const a of BATCH5) assert.ok(rows.some((r) => r.kind && parseKind(r.kind).kind === a), `${a}: in the gallery`);
  assert.ok(!rows.some((r) => /stand-in/.test(r.sub ?? '')), 'nothing in the gallery stands in');
  assert.ok(ARENA_WAVES.flat().every((k) => FOES[parseKind(k).kind]), 'the Arena calls only kinds that exist');
});

test('batch 5: every move winds up at least its minimum, says its tell and its answer, hurts in quarter hearts; none marks the ground (no lobs)', () => {
  for (const a of BATCH5) for (const x of FOES[a].attacks) {
    assert.ok(x.wind >= windMin(x) - 1e-9, `${a}.${x.id}: ${x.wind} s`);
    assert.equal(groundMark(x), false, `${a}.${x.id}: read from the body`);
    if (!x.chain) assert.ok(x.tell && x.counter, `${a}.${x.id}: its tell and its answer`);
    assert.ok((x.max ?? FOES[a].reach) <= FOES[a].reach + 1e-9, `${a}.${x.id}: within its reach`);
    assert.ok(Math.abs(x.damage * 4 - Math.round(x.damage * 4)) < 1e-9, `${a}.${x.id}: harm in quarter hearts`);
  }
});

test('the shade: its cut is parried into a riposte; its feint winds the cut halfway, drops the sword to the hip and thrusts; it steps through its shadow to your side, unless an ember lit it; calm, it walks its path and waits at the end', () => {
  // the cut: a perfect parry stuns it (the riposte's opening)
  clearTargets();
  const P = player(v(0, 0, 0), { guard: () => 'perfect' }), foes = world(P); foes.waveRest = 1e9;
  const s = foes.add('shade', v(0, 0, 2));
  assert.equal(foes.strike(s, attackOf('shade', 'cut')), false, 'parried');
  assert.ok(s.stunned >= 2 - 1e-9 && s.state === 'recover', 'stunned: the riposte');
  // the feint's body: the sword arm up for the cut at a third of the wind-up, at the hip by its end; the thrust a lane
  const F = attackOf('shade', 'feint');
  assert.equal(F.shape, 'lane'); assert.ok(F.feint > 0.3 && F.feint < 0.6 && F.lunge > 1);
  const f = foes.add('shade', v(4, 0, 2)); f.state = 'wind'; f.atk = F; f.heading = 0;
  const arm = () => f.model.group.getObjectByName('shoulder').rotation.x;   // (its right: the sword arm)
  for (let i = 0; i < 40; i++) { f.k = Math.min(1, i / 40 * 0.35); foes.look(f, DT); }
  const raised = arm();
  for (let i = 0; i < 60; i++) { f.k = 0.35 + (i / 60) * 0.6; foes.look(f, DT); }
  assert.ok(raised < -1, `the cut begun: the arm raised (${raised.toFixed(2)})`);
  assert.ok(arm() > 0, `then the sword dropped to the hip (${arm().toFixed(2)})`);
  foes.dispose(); clearTargets();
  // the step: it sinks and comes up beside you, then cuts (recut)
  const st = new Foe('shade', v(0, 0, 6), { rng: () => 0.3 }), Q = player(v(0, 0, 0));
  st.attacksAt = (d) => [attackOf('shade', 'step')].filter((a) => !a.dark || !(st.lit > 0)); st.state = 'chase'; st.cool = 0;
  const ev = run(st, Q, attackOf('shade', 'step').wind + 0.1);
  assert.ok(ev.includes('warn') && st.atk.id === 'recut', 'out of its pool: the cut follows');
  assert.ok(st.pos.distanceTo(Q.pos) < 2.2 && st.pos.distanceTo(Q.pos) > 0.8, `beside you (${st.pos.distanceTo(Q.pos).toFixed(2)} m)`);
  // lit by an ember: solid, no step
  const lit = new Foe('shade', v(0, 0, 6), { rng: () => 0.5 });
  lit.hit('fire', v(0, 0, -1), {});
  assert.ok(lit.lit >= LIT - 1e-9, 'an ember lights it');
  assert.ok(!lit.attacksAt(5).some((a) => a.id === 'step'), 'lit, it can’t step');
  assert.ok(new Foe('shade', v()).attacksAt(5).some((a) => a.id === 'step'), 'unlit, it steps from afar');
  assert.ok(lit.hp < FOES.shade.hp, 'and the ember burns it');
  // calm: it walks a path and stops at its end, waiting; only close does it turn on you
  const c = new Foe('shade', v(0, 0, 0), { rng: () => 0.5, calm: true }); c.heading = 0;
  const far = player(v(0, 0, -30));
  let waited = 0, moved = 0;
  for (let i = 0; i < 12 / DT; i++) { const p = c.pos.clone(); c.update(DT, far, env); if (c.pos.distanceTo(p) < 1e-6) waited += DT; else moved += DT; }
  assert.equal(c.state, 'idle'); assert.ok(moved > 2 && waited > 2, `it walks its path (${moved.toFixed(1)} s) and waits at its ends (${waited.toFixed(1)} s)`);
  assert.ok(run(c, player(c.pos.clone().add(v(0, 0, 3))), 0.1).includes('notice'), 'cross its path and it turns on you');
  // its torn hem: tatters round it, longer behind
  assert.ok(jag(Math.PI) < jag(0) && jag(0.3) !== jag(0.9));
});

test('the pearl roller: rolling, nothing harms it; a guard bounces it off stunned; it bounces off a wall once back at you, the next stalls it; at a quarter of its health its last roll shatters in a ring; calm, it grazes until provoked', () => {
  const r = new Foe('roller', v(), { rng: () => 0.5 }), P = player(v(0, 0, 6));
  r.heading = 0; r.beginWind(attackOf('roller', 'bowl'), P); r.state = 'strike'; r.timer = 0;
  assert.equal(r.hit('blade', v(0, 0, -1), { damage: 1 }), 'glance', 'rolling: a cut glances off');
  assert.equal(r.hit('shoot', v(0, 0, -1), {}), 'glance');
  assert.equal(r.hp, FOES.roller.hp);
  // a guard: it bounces off stunned
  clearTargets();
  const G = player(v(0, 0, 0), { guard: () => true }), foes = world(G); foes.waveRest = 1e9;
  const g = foes.add('roller', v(0, 0, 3)); g.state = 'strike'; g.atk = attackOf('roller', 'bowl');
  assert.equal(foes.strike(g, attackOf('roller', 'bowl')), false);
  assert.ok(g.stunned >= BOUNCE.guard - 1e-9 && g.reel === 'bounced', 'bounced off, stunned');
  assert.equal(g.hit('blade', v(0, 0, -1), { damage: 1 }), true, 'stunned and unrolled: the blade bites (double)');
  assert.equal(g.hp, FOES.roller.hp - 2);
  foes.dispose(); clearTargets();
  // a wall: back at you once, then it stalls
  const w = new Foe('roller', v(), { rng: () => 0.5 }), Q = player(v(0, 0, 4));
  w.heading = 0; w.beginWind(attackOf('roller', 'bowl'), Q);
  const walled = { ...env, canStep: (from, x, z) => Math.abs(z) < 2 };
  const ev = run(w, Q, attackOf('roller', 'bowl').wind + 3, walled);
  assert.equal(ev.filter((e) => e?.type === 'bounced').length, 1, 'one bounce');
  assert.ok(ev.some((e) => e?.type === 'stalled') && w.stunned > 0, 'the next wall stalls it');
  // the last roll: only at a quarter of its health; it shatters at its end, in a ring
  const L = new Foe('roller', v(), { rng: () => 0.5 });
  assert.ok(!L.attacksAt(5).some((a) => a.id === 'last'));
  L.hp = 1; assert.ok(L.attacksAt(5).some((a) => a.id === 'last'), 'hurt, its last roll');
  clearTargets();
  const R = player(v(0, 0, 0)), F = world(R); F.waveRest = 1e9;
  const x = F.add('roller', v(0, 0, 5)); x.hp = 1; x.attacksAt = () => [attackOf('roller', 'last')]; x.cool = 0;
  let rings = 0;
  for (let i = 0; i < 5 / DT && x.dead === undefined; i++) { const n = F.shocks?.length ?? 0; F.update(DT); R.health = 1; R.down = null; rings += (F.shocks?.length ?? 0) > n ? 1 : 0; }
  assert.ok(x.dead !== undefined && !x.alive, 'it shatters');
  assert.equal(rings, 1, 'in a ring that runs out over the ground (jump it)');
  F.dispose(); clearTargets();
  // calm: it grazes; close in and it fights
  const c = new Foe('roller', v(), { rng: () => 0.5, calm: true });
  run(c, player(v(0, 0, 8)), 2);
  assert.equal(c.state, 'idle');
  assert.ok(run(c, player(c.pos.clone().add(v(0, 0, 2))), 0.1).includes('notice'), 'touch it and it rolls up to fight');
});

test('the pearl roller’s body: rolled up, its spin is locked to the ground it covers (never a slip); unrolled, its foot ripples back by the distance glided', () => {
  assert.equal(rollAngle(Math.PI * 2 * 0.7, 0.7), Math.PI * 2, 'a turn a circumference');
  clearTargets();
  const P = player(v(0, 0, 40)), foes = world(P); foes.waveRest = 1e9;
  const f = foes.add('roller', v(0, 0, 0)); f.heading = 0;
  f.state = 'strike'; f.atk = attackOf('roller', 'bowl'); f.k = 0.3;
  foes.look(f, DT);
  const a0 = f.model.spin, d0 = f.model.rolled;
  for (let i = 0; i < 90; i++) { f.pos.z += 6 * DT; f.k = 0.3; foes.look(f, DT); }
  const turned = f.model.spin - a0, went = f.model.rolled - d0;
  assert.ok(went > 8.5, `it rolled ${went.toFixed(2)} m`);
  assert.ok(Math.abs(turned * 0.7 - went) < 1e-6, `spin × radius = distance (${(turned * 0.7).toFixed(3)} vs ${went.toFixed(3)})`);
  foes.dispose(); clearTargets();
});

test('the marionette: it drops its strings on a creature near it (a calm one too): its eyes go black, its wind-ups quicken, light cuts never stagger it; cut the strings and it drops free; its yank lifts you; it dances only alone', () => {
  clearTargets();
  const P = player(v(0, 0, -10)), foes = world(P); foes.waveRest = 1e9;
  const m = foes.add('marionette', v(0, 0, 4));
  const crab = foes.add('crab', v(3, 0, 6), { calm: true });
  assert.ok(!crab.provoked, 'a calm crab, grazing');
  m.attacksAt = (d) => [attackOf('marionette', 'strings')].filter((a) => !m.hosting && m.allyFor(a)); m.state = 'chase'; m.cool = 0;
  for (let i = 0; i < 2.5 / DT && !crab.possessed; i++) { foes.update(DT); P.health = 1; }
  assert.ok(crab.possessed?.by === m && m.host === crab, 'its strings on the crab');
  assert.ok(crab.provoked, 'driven: it comes for you');
  foes.look(crab, DT);
  assert.ok(crab.model.eyeMat.uniforms.uColor.value.getHexString() === '050407', 'its eyes black');
  // quicker wind-ups; light blows don't stagger it
  crab.beginWind(attackOf('crab', 'snap'), P); crab.k = 0.2;
  crab.hit('blade', v(0, 0, 1), { damage: 1 });
  assert.equal(crab.state, 'wind', 'a light cut early in its wind-up: it winds on');
  crab.timer = 0; crab.k = 0; crab.update(DT, P, env);
  assert.ok(Math.abs(crab.k - DT / (attackOf('crab', 'snap').wind * POSSESS.wind)) < 1e-9, 'its wind-up quicker');
  // the strings: two things to cut (the blade, the boomerang, an ember find them)
  const ropes = [...allTargets()].filter((t) => t.kind === 'rope' && t.enabled());
  assert.equal(ropes.length, 2, 'two strings');
  assert.ok(ropes.every((t) => t.accepts.includes('blade') && t.accepts.includes('fire')));
  ropes[0].onHit('blade', ropes[0].position(), v(0, 0, 1), {});
  assert.equal(crab.possessed, null, 'cut: it drops free');
  assert.ok(crab.stunned > 0 && !crab.provoked && crab.state === 'idle', 'stunned a moment, then back to grazing');
  assert.equal([...allTargets()].filter((t) => t.kind === 'rope' && t.enabled()).length, 0, 'the strings gone');
  // killing the marionette lets its creature go too
  const crab2 = foes.add('crab', v(-3, 0, 6));
  foes.possess(m, crab2, attackOf('marionette', 'strings'));
  assert.ok(crab2.possessed);
  while (m.alive) foes.hurt(m, 'blade', v(0, 0, 1), { damage: 2, breaks: true });
  for (let i = 0; i < 3; i++) foes.update(DT);
  assert.equal(crab2.possessed, null, 'its puppeteer gone, the crab is let go');
  foes.dispose(); clearTargets();
  // the yank: a line that lifts you
  const Q = player(v(0, 0, 0)), F = world(Q); F.waveRest = 1e9;
  const y = F.add('marionette', v(0, 0, 6));
  assert.equal(F.strike(y, attackOf('marionette', 'yank')), true);
  assert.equal(F.hold?.kind, 'tether'); assert.ok(Q.vel.y >= 4.5 - 1e-9, 'lifted off your feet');
  // the dance: only with nothing to hold
  const alone = F.add('marionette', v(10, 0, 0));
  alone.allies = [];
  assert.ok(alone.attacksAt(2).some((a) => a.id === 'dance'), 'alone, it dances');
  alone.allies = [F.add('lizard', v(11, 0, 1))];
  assert.ok(!alone.attacksAt(2).some((a) => a.id === 'dance') && alone.attacksAt(2).some((a) => a.id === 'strings'), 'with a creature near: its strings instead');
  F.dispose(); clearTargets();
  // it hangs off the ground; calm, it hangs still where it hangs
  assert.ok(FOES.marionette.hover >= 1 && FOES.marionette.puppeteer);
  const c = new Foe('marionette', v(), { rng: () => 0.5, calm: true });
  run(c, player(v(0, 0, 20)), 2);
  assert.ok(c.state === 'idle' && Math.hypot(c.pos.x, c.pos.z) < 1e-9, 'it hangs still');
  assert.ok(POSSESS.wind < 1);
});

test('the marionette’s body hangs from its knot as a pendulum: it swings behind as it sets off; four strings, one mesh; its own pieces few', () => {
  clearTargets();
  const P = player(v(0, 0, 40)), foes = world(P); foes.waveRest = 1e9;
  const f = foes.add('marionette', v(0, 0, 0)); f.heading = 0; f.state = 'chase';
  for (let i = 0; i < 30; i++) foes.look(f, DT);
  const hang = f.model.group.getObjectByName('hang');
  let most = 0;
  for (let i = 0; i < 40; i++) { f.pos.z += 3 * DT; foes.look(f, DT); most = Math.max(most, Math.abs(hang.rotation.x)); }
  assert.ok(most > 0.01, `it swings on its strings (${most.toFixed(3)} rad)`);
  assert.ok(f.model.strings.isSkinnedMesh && f.model.strings.skeleton.bones.length === 8, 'four strings, skinned between the knot and what they hold');
  foes.dispose(); clearTargets();
});

test('cheap to draw: each of batch 5 is a handful of meshes (its moving parts skinned on its joints)', () => {
  const most = { shade: 13, roller: 8, marionette: 7 };
  for (const [a, n] of Object.entries(most)) for (const w of skinWorlds(a)) {
    const m = archetypeModel(a, w);
    let meshes = 0; m.group.traverse((o) => { meshes += o.isMesh ? 1 : 0; });
    assert.ok(meshes <= n, `${a}@${w}: ${meshes} meshes`);
    m.dispose?.();
  }
});

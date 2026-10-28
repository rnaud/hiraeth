// The mummers (issue #724; docs/design/enemy-roster-v2.md "The mummers"): the camp tribe on the humanoid rig. Each mummer
// carries one weapon and fights with it (a club's whack, a spear's jab, a bow's volley), a guarded whack knocks the club
// out of its hands and it digs up rocks until it has it back; its mask is knocked off by a headshot (two for the metal
// mask of its stronger tier), a charged cut, or as it breaks low: it drops what it holds, runs, and comes back swinging
// wide. The mummer king blows its horn (the camp within 25 m wakes) and throws a mummer at you, which lands dazed. The
// Desert keeps their camp (its blots' fire became theirs, with the king) and a pair of them walks the dunes; the Arena
// fields both.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, WAVES, CARRY, BLIND, pickWeight } from '../src/foes.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { FIGHT, TIERS, tierDef } from '../src/enemies/fight.js';
import { SITES, layoutSite } from '../src/encounters/sites.js';
import { WORLDS, ROSTERS, worldArchetypes, packOf } from '../src/foe-worlds.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { skinWorlds } from '../src/enemies/skins.js';
import { windMin } from '../src/telegraph.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function camp(o = {}) {
  clearTargets();
  const P = { pos: v(), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: 0, guardUp: false, parry: false,
    hurt() { this.hurts++; }, knockDown() { return true; }, stagger() {}, flinch() {},
    guarding() { return this.guardUp || this.parry; }, guard() { return this.parry ? 'perfect' : this.guardUp ? true : false; }, ...o };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: o.rng ?? Math.random });
  foes.setPractice('');
  return { foes, P, done: () => { foes.dispose(); clearTargets(); } };
}
const add = (foes, kind, at, o = {}) => { const f = foes.add(kind, at); f.heading = Math.PI; Object.assign(f, o); return f; };

test('the mummers on the roster: two spirits of their own plans, a camp\'s rank and file and its chief; built, skinned, every wind-up fair', () => {
  for (const id of ['mummer', 'mummerking']) {
    const A = ARCHETYPES[id];
    assert.equal(A.family, 'spirit'); assert.equal(A.status, 'built'); assert.equal(FOES[id], A.def);
    assert.ok(FIGHT[id] && TIERS[id], `${id}: its fight and its tier`);
    for (const w of skinWorlds(id)) { const m = archetypeModel(id, w); assert.ok(m?.driver, `${id}@${w}: a body on the humanoid rig`); m.dispose(); }
    for (const a of A.def.attacks) assert.ok(a.wind >= windMin(a) - 1e-9, `${id}.${a.id}: ${a.wind} s`);
  }
  assert.equal(ARCHETYPES.mummer.tier, 1); assert.equal(ARCHETYPES.mummerking.tier, 3);
  assert.ok(ARCHETYPES.mummer.def.height <= 1.15 && ARCHETYPES.mummerking.def.height >= 2.5, 'a head shorter than the traveller\'s shoulder; the king 2.6 m');
  // a body is a handful of draws: its parts skinned by material
  for (const id of ['mummer', 'mummerking']) { const m = archetypeModel(id, skinWorlds(id)[0]); let n = 0; m.group.traverse((o) => { if (o.isMesh) n++; }); assert.ok(n <= 12, `${id}: ${n} meshes`); m.dispose(); }
});

test('each carries one weapon and fights with it: the club\'s whack, the spear\'s jab, the bow\'s volley from afar; unarmed, rocks', () => {
  assert.equal(pickWeight({ club: 1, spear: 1 }, () => 0.1), 'club'); assert.equal(pickWeight({ club: 1, spear: 1 }, () => 0.9), 'spear');
  const { foes, done } = camp();
  const f = add(foes, 'mummer', v(0, 0, 2));
  assert.ok(['club', 'spear', 'bow'].includes(f.weapon), f.weapon);
  for (const [w, d, id] of [['club', 2, 'whack'], ['spear', 2.2, 'jab'], ['bow', 10, 'volley']]) {
    f.weapon = w;
    const can = f.attacksAt(d, 0).map((a) => a.id);
    assert.ok(can.includes(id), `${w}: ${can}`);
    for (const other of ['whack', 'jab', 'volley']) if (other !== id) assert.ok(!can.includes(other), `${w} never ${other}`);
    assert.ok(!can.includes('rock'), 'armed: no rock');
  }
  f.weapon = 'club'; f.disarmed = { at: v(3, 0, 3), from: v(), t: 9 };
  assert.deepEqual(f.attacksAt(6, 0).map((a) => a.id), ['rock'], 'its club knocked away: it lobs rocks');
  assert.ok(f.def.attacks.find((a) => a.id === 'rock').lob, 'a thrown rock shows its landing mark');
  done();
});

test('a guarded whack knocks the club out of its hands (a plain guard, not only a parry): it runs for it and picks it up', () => {
  const { foes, P, done } = camp({ guardUp: true });
  const f = add(foes, 'mummer', v(0, 0, 1.6), { weapon: 'club', provoked: true });
  f.state = 'chase'; f.cool = 0;
  f.beginWind(f.def.attacks.find((a) => a.id === 'whack'), P);
  for (let i = 0; i < 120 && !f.disarmed; i++) foes.update(DT);
  assert.ok(f.disarmed, 'the club flew');
  assert.equal(P.hurts, 0, 'the guard took it');
  assert.equal(f.droppedWeapon, 'club');
  P.guardUp = false; P.pos.set(0, 0, -20);   // (out of its rocks' reach, in its sight: it runs for its club)
  let picked = false;
  for (let i = 0; i < 900 && f.disarmed; i++) { foes.update(DT); if (f.reel === 'pickup') picked = true; }
  assert.ok(picked && !f.disarmed, 'bent to pick it up, armed again');
  done();
});

test('its mask: a headshot knocks it off (the metal mask of its tier takes two), and so does a charged cut; low, it comes off as it runs; then it swings wide', () => {
  const { foes, P, done } = camp();
  P.pos.set(0, 0, -6);
  const f = add(foes, 'mummer', v(0, 0, 0), { weapon: 'spear', provoked: true, state: 'chase' });
  foes.hurt(f, 'shoot', v(0, 0, 1), { damage: 0.25, zone: 'head' });
  assert.ok(f.unmasked, 'a headshot knocks the pot flying');
  assert.ok(f.disarmed, 'it drops its spear');
  assert.ok(f.fleeT > 0, 'and runs');
  // its stronger tier: a metal mask, two headshots
  assert.equal(tierDef('mummer', FOES.mummer).mask.hits, 2);
  const t = foes.add('mummer*', v(4, 0, 0)); t.provoked = true;
  foes.hurt(t, 'shoot', v(0, 0, 1), { damage: 0.25, zone: 'head' });
  assert.ok(!t.unmasked && t.alive, 'one shot rings off the metal');
  foes.hurt(t, 'shoot', v(0, 0, 1), { damage: 0.25, zone: 'head' });
  assert.ok(t.unmasked || !t.alive, 'the second knocks it off');
  // a charged cut
  const c = add(foes, 'mummer', v(-4, 0, 0), { provoked: true });
  c.hp = 5; c.def = { ...c.def, hp: 5 };
  foes.hurt(c, 'blade', v(0, 0, 1), { damage: 1, breaks: true, charged: true });
  assert.ok(c.unmasked, 'a charged cut knocks it off');
  // low: as it breaks and runs
  const l = add(foes, 'mummer', v(8, 0, 0), { provoked: true });
  foes.hurt(l, 'blade', v(0, 0, 1), { damage: 1 });
  assert.ok(l.alive && l.unmasked, `under half its health, unmasked (${l.hp}/${l.def.hp})`);
  // unmasked it can hardly see: its blows go wide of where you stand
  f.disarmed = null; f.weapon = 'club';
  const wide = [];
  for (let i = 0; i < 40; i++) { f.state = 'chase'; f.heading = 0; f.beginWind(f.def.attacks.find((a) => a.id === 'whack'), P); wide.push(f.attackH); }
  assert.ok(Math.max(...wide) - Math.min(...wide) > BLIND.wide * 0.5, 'its whack goes wide');
  done();
});

test('the mummer king: its horn wakes every mummer within 25 m; it picks one up, holds it over its crown and throws it: it lands dazed at the mark', () => {
  const { foes, P, done } = camp();
  P.pos.set(0, 0, 8);
  const k = add(foes, 'mummerking', v(0, 0, 0), { provoked: true, state: 'chase' });
  const near = add(foes, 'mummer', v(2, 0, -1)), far = add(foes, 'mummer', v(20, 0, 0)), away = add(foes, 'mummer', v(40, 0, 0));
  for (const m of [near, far, away]) { m.provoked = false; m.state = 'idle'; }
  // the horn: when it first comes on
  const horn = k.def.attacks.find((a) => a.id === 'horn');
  assert.ok(k.attacksAt(6, 0).includes(horn), 'its horn ready');
  k.cool = 0; k.beginWind(horn, P);
  for (let i = 0; i < 120 && k.state === 'wind'; i++) foes.update(DT);
  assert.ok(far.provoked && near.provoked, 'the camp within 25 m wakes');
  assert.ok(!away.provoked, '40 m off sleeps on');
  assert.ok(!k.attacksAt(6, 0).includes(horn), 'once, until half its health');
  k.hp = k.def.hp * 0.45;
  assert.ok(k.attacksAt(6, 0).includes(horn), 'and once more at half');
  // the throw: the nearest mummer, held high, then flying at the mark
  for (let i = 0; i < 60; i++) foes.update(DT);
  near.pos.set(1.5, 0, -1); near.stunned = 0; near.state = 'chase';
  k.state = 'chase'; k.cool = 0; k.pos.set(0, 0, 0);
  foes.update(DT);
  const thr = k.def.attacks.find((a) => a.id === 'throw');
  // (its turn come, it may choose the throw itself; else begun here)
  if (!(k.state === 'wind' && k.atk === thr)) { assert.ok(k.attacksAt(7, 0).includes(thr), 'a mummer near it to throw'); k.beginWind(thr, P); }
  assert.equal(k.carry, near, 'it picks up the nearest');
  let top = 0;
  for (let i = 0; i < 200 && k.state === 'wind'; i++) { foes.update(DT); top = Math.max(top, near.pos.y); }
  assert.ok(top > k.def.height, `held over its crown (${top.toFixed(2)} m)`);
  for (let i = 0; i < 5; i++) foes.update(DT);
  assert.equal(near.carriedBy, null, 'let go');
  assert.ok(near.pos.distanceTo(k.attackAt) < 0.5 && near.pos.y === 0, 'landed at the mark');
  assert.ok(near.stunned > CARRY.daze * 0.5, 'dazed: an easy cut');
  // nothing near it: no throw
  near.pos.set(30, 0, 30);
  foes.update(DT);
  assert.ok(!k.attacksAt(7, 0).includes(thr), 'no mummer near: no throw');
  done();
});

test('the Desert: the mummers\' camp (the blots\' old fire) with its lookout and its king, a pair of them out walking; the Arena fields both', () => {
  const S = SITES.desert.find((s) => s.id === 'mummer-camp');
  assert.ok(S && S.kind === 'camp' && S.lookout === 'mummer', 'a camp with a lookout');
  assert.deepEqual([...new Set(S.foes)].sort(), ['mummer', 'mummerking']);
  const L = layoutSite(S, { radius: (a) => FOES[a].radius });
  assert.equal(L.foes.filter((f) => f.idle === 'sit').length, S.foes.length, 'round the fire');
  assert.ok(L.foes.some((f) => f.idle === 'lookout' && f.archetype === 'mummer'));
  assert.ok(worldArchetypes('desert').includes('mummerking') && !ROSTERS.desert.wild.mummerking, 'the king only at its camp, never in a pack');
  assert.ok(ROSTERS.desert.wild.mummer > 0 && ROSTERS.desert.first === 'blot', 'the blot still leads: the Desert teaches');
  assert.equal(WORLDS.desert.stage, 0);
  const packs = Array.from({ length: 60 }, (_, n) => packOf(n, 'desert', () => ((n * 0.371) % 1)));
  for (const p of packs) if (p.includes('mummer')) assert.deepEqual(p, ['mummer', 'mummer'], 'a pair of mummers, alone');
  assert.ok(WAVES.some((w) => w.includes('mummer')) && WAVES.some((w) => w.includes('mummerking')), 'the Arena\'s waves');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, weakAt, headOf } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets, raycastTargets } from '../src/targets.js';
import { ARMOUR, BARE, PLATE, WEAK, HEAD, TIERS, TIER_FROM, TIER_SHARE, TIER_UP, plateBlow, rayNear, tierDef, tierMove, fightOf } from '../src/enemies/fight.js';
import { ARCHETYPES, BUILT, parseKind } from '../src/enemies/archetypes.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { skinOf, tierSkin, HOME_SKIN } from '../src/enemies/skins.js';
import { surfaceFor, TIER_SURFACE } from '../src/enemies/surfaces.js';

// Armour that comes off, weak points, the head zone and the stronger tiers (issue #722, docs/design/enemy-fun.md C11, C12,
// D13; docs/systems/foes.md "Armour, weak points and tiers"). Every random pick here is seeded.

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
const player = (at = v(), o = {}) => ({ pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {}, ...o });
const world = (P, o = {}) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true, ...(o.world ? { world: o.world } : {}) } }, levelId: o.world ?? 'arena', physics: flat, player: P,
  settings: { enemies: o.gentle ? 'gentle' : 'normal' }, game: new GameState(null), rng: o.rng ?? seeded(), ...(o.tool ? { tool: o.tool } : {}) });
const FRONT = v(0, 0, 1);
const cut = (n = 0) => ({ damage: [1, 1, 3][n], combo: n });

test('the heavy foes wear their plates as real parts of their bodies, each its own mesh (never merged, batched or skinned)', () => {
  for (const [a, A] of Object.entries(ARMOUR)) {
    assert.ok(A.plates >= 2 && A.plates <= 4, `${a}: 2-4 plates (${A.plates})`);
    assert.ok(A.hold >= 1, `${a}: a hold`);
    for (const world of Object.keys(skinOf(a, null) ? { [HOME_SKIN[a]]: 1 } : {})) {
      const M = archetypeModel(ARCHETYPES[a].kind, world);
      assert.equal(M.plates?.length, A.plates, `${a}@${world}: ${A.plates} plates on its body`);
      for (const p of M.plates) {
        assert.ok(p.isMesh && !p.isSkinnedMesh && p.userData.plate && p.userData.noBatch, `${a}: ${p.name} a mesh of its own`);
        let root = p; while (root.parent) root = root.parent;
        assert.equal(root, M.group, `${a}: ${p.name} in its body`);
      }
      M.dispose?.();
    }
  }
  assert.ok(!ARMOUR.blot && !ARMOUR.skitter && !ARMOUR.moth, 'fodder wears none');
});

test('plateBlow: a light cut chips 1, the heavy third 2; the breakers, a broken stance or guard, a bomb and its gun mode knock one off', () => {
  const A = ARMOUR.bell;
  assert.equal(plateBlow(A, 'blade', cut(0), 'glance'), 1);
  assert.equal(plateBlow(A, 'blade', cut(2), 'glance'), 2);
  for (const b of [{ breaks: true }, { riposte: true, breaks: true }, { dash: true }, { source: 'parry' }]) assert.equal(plateBlow(A, 'blade', b), 'pop');
  assert.equal(plateBlow(A, 'blade', cut(0), true, true), 'pop', 'its stance broke with the blow');
  assert.equal(plateBlow(A, 'blade', cut(0), 'guardbreak'), 'pop');
  assert.equal(plateBlow(A, 'shoot', { source: 'bomb' }), 'pop');
  assert.equal(plateBlow(A, 'push', {}), 'pop', 'the bell: the push');
  assert.equal(plateBlow(A, 'shoot', {}, 'glance'), 0, 'a plain shot does nothing to its bronze');
  assert.equal(plateBlow(A, 'blade', cut(0), 'burst'), 0);
  assert.equal(plateBlow(null, 'blade', { breaks: true }), 0);
});

test('the bell walker: glances chip its plates, heavy blows knock them off, and bare it no longer turns your blade and comes on faster', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), F = world(P);
  F.waveRest = 1e9;
  const f = F.add('bell', v(0, 0, 3));
  assert.equal(f.platesOn, 3);
  // the first plate's hold: three light glances
  for (let i = 0; i < ARMOUR.bell.hold; i++) assert.equal(f.hit('blade', FRONT, { ...cut(0), plate: 0 }), 'glance');
  assert.equal(f.platesOn, 2, 'three glances: the first plate off');
  assert.equal(f.hp, f.def.hp, 'the bronze still takes no harm');
  // a charged cut knocks the next off at once, a perfect parry's riposte the last
  F.hurt(f, 'blade', FRONT, { damage: 2, breaks: true, charged: true }, null);
  assert.equal(f.platesOn, 1);
  const wind0 = f.windFor(f.def.attacks[0]), speed0 = f.speedNow;
  f.downT = 0; f.stunned = 0; f.open = 0;
  F.hurt(f, 'blade', FRONT, { damage: 2, combo: 2, breaks: true, riposte: true }, null);
  assert.equal(f.platesOn, 0);
  assert.ok(f.armour.bare && !f.def.clapper, 'bare: its bronze no longer turns the blade');
  assert.ok(f.windFor(f.def.attacks[0]) < wind0 && f.speedNow > speed0, 'and it is quicker');
  f.downT = 0; f.stunned = 0; f.open = 0;
  const hp = f.hp;
  assert.equal(f.hit('blade', FRONT, cut(0)), true, 'a light cut lands now');
  assert.equal(hp - f.hp, BARE.takes, 'harder');
  assert.equal(FOES.bell.clapper, true, 'the kind itself untouched');
  F.dispose(); clearTargets();
});

test('a knocked-off plate falls from its body: hidden there, a copy tumbles to the ground, lies, and sinks away', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), F = world(P);
  F.waveRest = 1e9;
  const f = F.add('brute', v(0, 0, 4));
  F.look(f, DT);
  const before = F.group.children.length;
  F.hurt(f, 'blade', FRONT, { damage: 2, breaks: true, charged: true }, null);
  const off = f.model.plates.filter((p) => !p.visible);
  assert.equal(off.length, 1, 'one plate gone from its body');
  assert.equal(F.fallen.length, 1);
  assert.equal(F.group.children.length, before + 1, 'its copy in the world');
  const c = F.fallen[0].o, y0 = c.position.y;
  for (let i = 0; i < 90; i++) F.updatePlates(DT);
  assert.ok(c.position.y < y0 && c.position.y >= -0.01 && c.position.y < 0.4, `it fell to the ground (${c.position.y.toFixed(2)})`);
  for (let i = 0; i < (PLATE.lie + PLATE.sink) * 60 + 10; i++) F.updatePlates(DT);
  assert.equal(F.fallen.length, 0); assert.ok(!c.parent, 'sunk away');
  F.dispose(); clearTargets();
});

test('plates take a share of light cuts on the brute; the tripod bare takes the gun; the crab bare loses its shell', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), F = world(P);
  F.waveRest = 1e9;
  const b = F.add('brute', v(0, 0, 4));
  b.guardRest = 99;
  const hp = b.hp;
  b.hit('blade', v(1, 0, 0), cut(0));
  assert.ok(Math.abs(hp - b.hp - (1 - ARMOUR.brute.soak)) < 1e-9, `the plates take ${ARMOUR.brute.soak} of it`);
  const t = F.add('tripod', v(3, 0, 4));
  assert.equal(t.hit('shoot', FRONT, {}), 'glance', 'its iron turns the gun');
  t.goBare();
  assert.equal(t.def.takes.shoot, 1); assert.ok(!t.def.heavy);
  const c = F.add('crab', v(-3, 0, 4));
  assert.ok(c.shelled);
  c.goBare();
  assert.ok(!c.shelled && !c.def.guard, 'its shell and its tuck gone with them');
  F.dispose(); clearTargets();
});

test('its gun mode knocks a plate off, once every PLATE.gun s', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), F = world(P);
  F.waveRest = 1e9;
  const t = F.add('tripod', v(0, 0, 4));
  F.hurt(t, 'stun', FRONT, {}, null);
  assert.equal(t.platesOn, ARMOUR.tripod.plates - 1);
  t.stunned = 0;
  F.hurt(t, 'stun', FRONT, {}, null);
  assert.equal(t.platesOn, ARMOUR.tripod.plates - 1, 'not again at once');
  for (let i = 0; i < PLATE.gun * 60 + 5; i++) t.update(DT, P, { ground: () => 0, seen: () => true });
  t.stunned = 0;
  F.hurt(t, 'stun', FRONT, {}, null);
  assert.equal(t.platesOn, ARMOUR.tripod.plates - 2);
  F.dispose(); clearTargets();
});

test('weak points: the tripod’s lamp, the brute’s furnace door, the bell’s clapper, the cart’s eyes: on the body, a target of their own', () => {
  for (const a of ['tripod', 'brute', 'bell', 'cart']) {
    const M = archetypeModel(ARCHETYPES[a].kind, HOME_SKIN[a]);
    assert.ok(M.weak?.obj && M.weak.r > 0.2 && M.weak.name, `${a}: a weak point`);
    let root = M.weak.obj; while (root.parent) root = root.parent;
    assert.equal(root, M.group);
    M.dispose?.();
  }
  clearTargets();
  const P = player(v(0, 0, 0)), F = world(P);
  F.waveRest = 1e9;
  const t = F.add('tripod', v(0, 0, 8));
  F.look(t, DT);
  const at = weakAt(t).clone();
  assert.ok(at.y > t.chest.y + 0.8, 'the lamp stands over its body');
  // a shot straight at the lamp: its own target takes it
  const from = v(0, at.y, 0), hit = raycastTargets(from, at.clone().sub(from).normalize(), 30);
  assert.equal(hit?.target.kind, 'foe-weak');
  F.dispose(); clearTargets();
});

test('a shot in the weak point stuns it and opens the riposte; the same weak point rests WEAK.cool s; a cut there too', () => {
  clearTargets();
  let opened = 0;
  const P = player(v(0, 0, 0)), F = world(P, { tool: { blade: { openRiposte() { opened++; } } } });
  F.waveRest = 1e9;
  const t = F.add('tripod', v(0, 0, 8));
  F.look(t, DT);
  t.state = 'wind'; t.atk = t.def.attacks[0]; t.k = 0.5;
  const at = weakAt(t).clone(), from = v(0, at.y, 0), dir = at.clone().sub(from).normalize();
  F.hurt(t, 'shoot', dir, {}, at.clone().addScaledVector(dir, -0.3));
  assert.ok(t.stunned >= WEAK.stun - 1e-9 && t.downT > 0 && t.state === 'recover', 'stunned, down, its beam broken off');
  assert.equal(opened, 1, 'the riposte’s window');
  assert.equal(t.platesOn, ARMOUR.tripod.plates, 'a weak point is not a plate');
  t.stunned = t.downT = 0; t.state = 'chase';
  F.hurt(t, 'shoot', dir, {}, at.clone().addScaledVector(dir, -0.3));
  assert.ok(!(t.downT > 0), 'resting: not again at once');
  // the brute's furnace door to the blade
  const b = F.add('brute', v(4, 0, 4));
  F.look(b, DT);
  b.guardRest = 99;
  const door = weakAt(b).clone(), hp = b.hp;
  F.hurt(b, 'blade', v(0, 0, 1), { ...cut(0) }, door);
  assert.ok(b.downT > 0 && b.weakNow, 'cut in the door: down');
  assert.ok(hp - b.hp > 1, 'a cut on the stunned lands double');
  F.dispose(); clearTargets();
});

test('the head zone: a shot along a line through its eyes is a headshot (a creature’s stance breaks; fodder takes double)', () => {
  assert.ok(rayNear(v(0, 1, 0), v(0, 0, 1), v(0.1, 1.1, 3), 0.3));
  assert.ok(!rayNear(v(0, 1, 0), v(0, 0, 1), v(0.5, 1, 3), 0.3));
  assert.ok(!rayNear(v(0, 1, 0), v(0, 0, 1), v(0, 1, -3), 0.3), 'not behind where it came from');
  clearTargets();
  const P = player(v(0, 0, 0)), F = world(P);
  F.waveRest = 1e9;
  const liz = F.add('lizard', v(0, 0, 5));
  liz.heading = Math.PI;
  F.look(liz, DT);
  const H = headOf(liz);
  assert.ok(H && !H.weak && H.r > 0.2);
  const at = H.at.clone(), from = v(0, at.y, 0), dir = at.clone().sub(from).normalize();
  const poise = liz.poise;
  F.hurt(liz, 'shoot', dir, {}, at.clone().addScaledVector(dir, -0.4));
  if (liz.def.takes.shoot > 0) assert.ok(liz.headNow && liz.downT > 0, `a headshot breaks its stance (poise ${poise})`);
  else assert.ok(liz.headNow);
  // a shot wide of its head: a body shot
  const lz2 = F.add('lizard', v(4, 0, 5));
  lz2.heading = Math.PI; F.look(lz2, DT);
  F.hurt(lz2, 'shoot', v(0, 0, 1), {}, v(4.4, 0.3, 4.2));
  assert.ok(!lz2.headNow);
  assert.equal(HEAD.fodder, 2);
  F.dispose(); clearTargets();
});

test('lock-on switches to the weak point and back to the next foe', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), F = world(P);
  F.waveRest = 1e9;
  const t = F.add('tripod', v(0, 0, 6)), b = F.add('lizard', v(3, 0, 7));
  for (const f of [t, b]) F.look(f, DT);
  const first = F.cycleLock();
  assert.equal(first, t, 'the nearest first');
  assert.ok(!t.aimWeak && t.aim === t.chest);
  F.cycleLock();
  assert.equal(F.lock, t); assert.ok(t.aimWeak, 'then its lamp');
  assert.ok(t.aim.y > t.chest.y + 0.8 && t.aimR > 0.3, 'the lock aims at the lamp, the reticle its size');
  F.cycleLock();
  assert.equal(F.lock, b, 'then the next foe'); assert.ok(!t.aimWeak);
  F.dispose(); clearTargets();
});

test('tiers: every non-fodder archetype has one new move, built from its own moves (combo, unlocked or stronger)', () => {
  for (const id of BUILT) {
    const T = TIERS[id], F = fightOf(id, ARCHETYPES[id].def);
    if (F.fodder) { assert.ok(!T, `${id}: fodder stays fodder`); continue; }
    assert.ok(T, `${id}: a tier`);
    assert.equal([T.combo, T.unlock, T.patch].filter(Boolean).length, 1, `${id}: one new move`);
    assert.ok(T.words, `${id}: what it does`);
    const D = ARCHETYPES[id].def, X = tierDef(id, D);
    if (T.combo) for (const m of T.combo) assert.ok(D.attacks.some((a) => a.id === m), `${id}: ${m} is its own move`);
    if (T.unlock) { const a = X.attacks.find((x) => x.id === T.unlock); assert.ok(a && !a.skins, `${id}: ${T.unlock} unlocked in every skin`); assert.ok(tierMove(id, T.unlock)); }
    if (T.patch) for (const [m, p] of Object.entries(T.patch)) { const a = X.attacks.find((x) => x.id === m); for (const k of Object.keys(p)) assert.deepEqual(a[k], p[k]); assert.ok(tierMove(id, m)); }
    assert.notEqual(X.attacks, D.attacks, `${id}: the kind's own moves untouched`);
  }
  assert.ok(TIER_SHARE[TIER_FROM] > 0 && TIER_SHARE.slice(0, TIER_FROM).every((x) => x === 0), 'only from the late worlds');
});

test('a tier is darker and banded, with its own materials and name; its body is the same shape', () => {
  const s = skinOf('bell', 'bazaar'), t = skinOf('bell', 'bazaar', 1);
  assert.deepEqual(tierSkin(s), t);
  assert.ok(t.tier && t.key !== s.id && t.name.startsWith('banded '));
  const lum = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
  assert.ok(lum(t.palette.bell) < lum(s.palette.bell) * 0.8, 'darker bronze');
  assert.equal(t.palette.eye, s.palette.eye, 'its eyes kept');
  assert.deepEqual(surfaceFor('bell', t, 'bell').stripes, TIER_SURFACE.stripes, 'banded');
  assert.ok(!surfaceFor('bell', s, 'bell')?.stripes, 'the base: no bands');
  assert.ok(!surfaceFor('bell', t, 'eye')?.stripes, 'no bands on its eyes');
  assert.deepEqual(parseKind('bell@bazaar*'), { kind: 'bell', skin: 'bazaar', tier: 1 });
  assert.deepEqual(parseKind('tripod*'), { kind: 'tripod', skin: null, tier: 1 });
  assert.deepEqual(parseKind('crab'), { kind: 'crab', skin: null });
});

test('a tier in the game: tougher, its combo after its move, the flare its tell; mixed into the late worlds only', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), F = world(P, { world: 'buried' });
  F.waveRest = 1e9;
  const base = F.add('tripod', v(0, 0, 8), { tier: 0 }), up = F.add('tripod*', v(3, 0, 8));
  assert.equal(up.tierN, 1); assert.equal(base.tierN, 0);
  assert.ok(up.hp > base.hp && up.poiseMax > base.poiseMax, `tougher (${up.hp} > ${base.hp})`);
  assert.equal(up.hp, Math.round(base.hp * TIER_UP.hp * 2) / 2);
  // its beam, then a second at once (quicker)
  const beam = up.def.attacks.find((a) => a.id === 'beam'), ev = [];
  up.state = 'strike'; up.atk = beam; up.provoked = true;
  up.next(beam, P, ev);
  assert.equal(up.state, 'wind'); assert.equal(up.atk.id, 'beam'); assert.equal(up.tierChained, 1);
  assert.ok(up.windFor(up.atk) < beam.wind, 'the follow’s wind-up quicker');
  assert.ok(tierMove('tripod', 'beam', true) && !tierMove('tripod', 'beam', false), 'the flare on the second');
  up.state = 'strike'; up.next(up.atk, P, ev);
  assert.equal(up.state, 'recover', 'once');
  F.dispose(); clearTargets();
  // the mix: seeded, the late worlds' foes come in tier at about their share; the early worlds' never
  for (const [w, share] of [['bazaar', TIER_SHARE[4]], ['desert', 0], ['arzach2', 0]]) {
    const G = world(P, { world: w, rng: seeded(11) }); G.waveRest = 1e9;
    let n = 0, k = 0;
    for (let i = 0; i < 80; i++) { const f = G.add('lizard', v(i, 0, 30)); n++; k += f.tierN; G.remove(f); }
    if (!share) assert.equal(k, 0, `${w}: none`);
    else assert.ok(Math.abs(k / n - share) < 0.15, `${w}: ${k}/${n} in tier (share ${share})`);
    G.dispose(); clearTargets();
  }
  const G = world(P, { world: 'bazaar', rng: seeded(3) }); G.waveRest = 1e9;
  for (let i = 0; i < 40; i++) assert.equal(G.add('blot', v(i, 0, 30)).tierN, 0, 'fodder never');
  G.dispose(); clearTargets();
});

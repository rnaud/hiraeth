// Roster v4's third batch (issue #726; docs/design/enemy-roster-v4.md): the prowler and the warlord on the humanoid rig.
// The prowler circles you, back-flips out of your combo (its second light cut in a row) and darts back in, slashes,
// sweeps its tail round at your knees (jump it), spits at range, rages low; its tier darts twice. The warlord sweeps,
// brings its glaive down overhead, charges, roars (every one round it wakes), wears four bronze plates that come off,
// and low makes its last stand (always seen). It holds a place of its own with a coffer (a 'warlord-hold' site), staged
// in Arzach behind ?staged=roster4. The combat review v2.34's asks, measured: no foe dies to one combo; short recovery
// after a miss; each signature move fires in a fight against a masher.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, WAVES, CARRY } from '../src/foes.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { FIGHT, TIERS, ARMOUR, tierDef } from '../src/enemies/fight.js';
import { SITES, STAGED, SITE_IDLE, SITE_PAYS, layoutSite, sitesOf, stagedFrom, siteFootprint } from '../src/encounters/sites.js';
import { BODIES } from '../src/encounters/index.js';
import { worldArchetypes, WORLDS } from '../src/foe-worlds.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { skinWorlds, skinOf } from '../src/enemies/skins.js';
import { surfaceFor, TIER_SURFACE } from '../src/enemies/surfaces.js';
import { windMin } from '../src/telegraph.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { libraryFrom } from '../src/animator.js';
import { attachMotion } from '../src/motion-match.js';
import { HOLD_AT, PROC_POSES, setFoeClips, stateClip } from '../src/enemies/humanoid-rig.js';
import { PROWLER_MOVES, WARLORD_MOVES, PROWLER_TAIL, spinAngle } from '../src/enemies/plans/monster.js';
import { foeSections } from '../src/foe-spawner.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function arena(o = {}) {
  clearTargets();
  const P = { pos: v(), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: 0, guardUp: false, parry: false,
    hurt() { this.hurts++; }, knockDown() { return true; }, stagger() {}, flinch() {},
    guarding() { return this.guardUp || this.parry; }, guard() { return this.parry ? 'perfect' : this.guardUp ? true : false; }, ...o };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: o.rng ?? Math.random });
  foes.setPractice('');
  return { foes, P, done: () => { foes.dispose(); clearTargets(); } };
}
const add = (foes, kind, at, o = {}) => { const f = foes.add(kind, at); f.heading = Math.PI; Object.assign(f, o); return f; };
const atk = (f, id) => (f.def ?? f).attacks.find((a) => a.id === id);
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const _dir = (from, to) => new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();

test('the prowler and the warlord on the roster: monsters on the humanoid rig, built and skinned (the tier darker and banded), every wind-up fair, a handful of draws', () => {
  for (const [id, h, most] of [['prowler', 1.8, 8], ['warlord', 2.5, 12]]) {
    const A = ARCHETYPES[id];
    assert.equal(A.family, 'monster'); assert.equal(A.status, 'built'); assert.equal(FOES[id], A.def); assert.equal(A.art, 'sheet-1');
    assert.equal(A.def.height, h, `${id}: the sheet's ${h} m`);
    assert.ok(FIGHT[id] && TIERS[id], `${id}: its fight and its tier`);
    for (const a of A.def.attacks) assert.ok(a.wind >= windMin(a) - 1e-9, `${id}.${a.id}: ${a.wind} s`);
    for (const tier of [0, 1]) for (const w of skinWorlds(id)) {
      const m = archetypeModel(id, w, tier);
      assert.ok(m?.driver, `${id}@${w}: on the humanoid rig`);
      let n = 0; m.group.traverse((o) => { if (o.isMesh) n++; });
      assert.ok(n <= most, `${id}: ${n} meshes`);
      m.dispose();
    }
    const base = skinOf(id, 'desert'), dark = skinOf(id, 'desert', 1), lum = (x) => new THREE.Color(x).getHSL({}).l;
    assert.ok(lum(dark.palette.skin) < lum(base.palette.skin) * 0.75 && dark.palette.eye === base.palette.eye, 'its tier darker, its eyes kept');
    assert.deepEqual(surfaceFor(id, dark, 'skin').stripes.amount, TIER_SURFACE.stripes.amount, 'banded');
    assert.ok(Object.keys(surfaceFor(id, base, 'skin')).length >= 2, 'its skin painted');
  }
  assert.ok(surfaceFor('prowler', skinOf('prowler', 'desert'), 'skin').spots2, 'the prowler\'s fine scales, stippled');
  assert.ok(surfaceFor('warlord', skinOf('warlord', 'desert'), 'plate').rust, 'the warlord\'s rough bronze plates');
  // the Arena's waves and its foe list (the gallery's roster is ARCHETYPE_IDS); no world fields them
  assert.ok(WAVES.some((w) => w.includes('prowler')) && WAVES.some((w) => w.includes('warlord')), 'the Arena\'s waves');
  const list = foeSections().find((s) => s.id === 'roster').items.map((i) => i.kind);
  assert.ok(list.includes('prowler@desert') && list.includes('warlord@desert'), 'the Arena\'s foe list');
  for (const w of Object.keys(WORLDS)) assert.ok(!worldArchetypes(w).includes('prowler') && !worldArchetypes(w).includes('warlord'), `${w}: not on its roster`);
});

test('every move is a shipped clip (a pose of the arms, a spin or a run over it at most); the wind-ups pinned', () => {
  const pinned = { prowler: { slash: [0.7, 0.22, 0.5], dart: [0.75, 0.3, 0.55], tail: [0.85, 0.35, 0.45], spit: [0.95, undefined, undefined] },
    warlord: { sweep: [1.0, 0.35, 0.5], overhead: [1.1, 0.3, 0.55], charge: [1.2, 0.8, 0.05], roar: [1.1, undefined, undefined], whirl: [1.3, 0.7, 0.4] } };
  for (const [id, moves] of Object.entries(pinned)) {
    assert.deepEqual(FOES[id].attacks.map((a) => a.id).sort(), Object.keys(moves).sort(), `${id}: its moves`);
    for (const [a, [wind, strike, contact]] of Object.entries(moves)) { const A = atk(FOES[id], a); assert.deepEqual([A.wind, A.strike, A.contact], [wind, strike, contact], `${id}.${a}`); }
  }
  for (const [id, MOVES] of [['prowler', PROWLER_MOVES], ['warlord', WARLORD_MOVES]]) for (const a of FOES[id].attacks) {
    const M = MOVES[a.id];
    assert.ok(M?.clip, `${id}.${a.id}: a clip`);
    assert.ok(M.from < M.load && M.load < M.cut && M.cut < M.to, `${id}.${a.id}: from < load < cut < to`);
    if (M.pose) assert.ok(PROC_POSES[M.pose], `${id}.${a.id}: its pose ${M.pose}`);
    if (a.lob && a.instant) assert.equal(M.release, CARRY.fly, `${id}.${a.id}: let go as it flies`);
  }
  // (the spins: side-on held from HOLD_AT, whole turns through the strike, ending where they began)
  const T = PROWLER_MOVES.tail, W = WARLORD_MOVES.whirl;
  assert.ok(Math.abs(spinAngle({ kind: 'wind' }, HOLD_AT, T) + T.spin.coil) < 1e-9 && spinAngle({ kind: 'wind' }, 1, T) === spinAngle({ kind: 'wind' }, HOLD_AT, T));
  assert.ok(Math.abs(spinAngle({ kind: 'strike' }, 1, W) - Math.PI * 4) < 1e-9, 'the last stand: two turns');
  // (the charge: its strike runs on the locomotion, the lance held)
  const f = { state: 'strike', k: 0.5, atk: atk(FOES.warlord, 'charge') };
  assert.deepEqual([stateClip(f, WARLORD_MOVES).loop, stateClip(f, WARLORD_MOVES).pose], ['move', 'lance']);
});

test('the prowler circles you while it waits, and back-flips out of a combo: the second light cut in a row and it is gone, then darts back in', () => {
  const { foes, P, done } = arena({ rng: seeded(5) });
  P.pos.set(0, 0, 0);
  const f = add(foes, 'prowler', v(0, 0, 2.4), { provoked: true, state: 'chase' });
  f.cool = 2.5;
  const a0 = Math.atan2(f.pos.x, f.pos.z);
  for (let i = 0; i < 60; i++) f.update(DT, P, foes.env);
  const a1 = Math.atan2(f.pos.x, f.pos.z), r = Math.hypot(f.pos.x, f.pos.z);
  assert.ok(Math.abs(a1 - a0) > 0.3 && r > 2.6 && r < 4.2, `it circles at its ring (${(a1 - a0).toFixed(2)} rad, ${r.toFixed(2)} m)`);
  // the masher: two light cuts close together
  f.pos.set(0, 0, 1.6); f.cool = 0.8; f.state = 'chase'; f.evadeCool = 0;
  const hp = f.hp;
  foes.hurt(f, 'blade', _dir(P.pos, f.pos), { damage: 1, combo: 0 });
  f.update(0.3, P, foes.env);
  foes.hurt(f, 'blade', _dir(P.pos, f.pos), { damage: 1, combo: 1 });
  f.update(DT, P, foes.env);
  assert.ok(f.hopBack, 'it flips back out of your reach');
  assert.equal(f.plan?.a.id, 'dart', 'and plans its dart back in');
  let dist = 0;
  for (let i = 0; i < 60 && f.hopBack; i++) { f.update(DT, P, foes.env); dist = Math.max(dist, Math.hypot(f.pos.x, f.pos.z)); }
  assert.ok(dist > 3.8, `well out of the third swing's reach (${dist.toFixed(2)} m)`);
  assert.equal(f.hp, hp - 2, 'the two cuts landed');
  let darted = false;
  for (let i = 0; i < 120 && !darted; i++) { f.update(DT, P, foes.env); if (f.state === 'wind' && f.atk?.id === 'dart') darted = true; }
  assert.ok(darted, 'landed, it darts back in');
  done();
});

test('the tail sweep is round it at your knees (a jump clears it), the spit a lob with its landing shown; low it rages; its tier darts twice', () => {
  const T = atk(FOES.prowler, 'tail'), S = atk(FOES.prowler, 'spit');
  assert.ok(T.ground && T.at === 'self' && T.shape === 'ring', 'the tail sweep: on the ground round it');
  assert.ok(S.lob && S.instant && S.at === 'target' && S.min >= 4, 'the spit: lobbed at range, its mark shown');
  const { foes, P, done } = arena();
  P.pos.set(0, 0, 1.5);
  const f = add(foes, 'prowler', v(0, 0, 0), { provoked: true, state: 'chase', heading: 0 });
  f.cool = 0; f.beginWind(T, P);
  P.onGround = false;   // (in the air as it strikes)
  for (let i = 0; i < 120 && (f.state === 'wind' || f.state === 'strike'); i++) foes.update(DT);
  assert.equal(P.hurts, 0, 'jumped: it missed');
  f.hp = f.def.hp * 0.45; foes.hurt(f, 'blade', v(0, 0, 1), { damage: 1, breaks: true });
  assert.ok(f.rage, 'low, it rages');
  assert.deepEqual(TIERS.prowler.combo, ['dart', 'dart'], 'the tier: a double dart');
  done();
});

test('the warlord\'s roar wakes every one round it; its four plates come off; low it makes its last stand, always seen', () => {
  const { foes, P, done } = arena();
  P.pos.set(0, 0, 6);
  const w = add(foes, 'warlord', v(0, 0, 0), { provoked: true, state: 'chase', heading: 0 });
  const sat = [add(foes, 'grunt', v(8, 0, -6), { state: 'idle', provoked: false }), add(foes, 'grunt', v(-12, 0, -10), { state: 'idle', provoked: false })];
  const far = add(foes, 'grunt', v(40, 0, 0), { state: 'idle', provoked: false });
  w.cool = 0; w.beginWind(atk(w, 'roar'), P);
  for (let i = 0; i < 90 && w.state === 'wind'; i++) foes.update(DT);
  assert.ok(sat.every((x) => x.provoked), 'its band, within 25 m, woke');
  assert.ok(!far.provoked, 'one far off did not');
  // the plates: rough bronze, four, knocked off by breakers (a charged cut each), then it is bare and quicker
  assert.equal(ARMOUR.warlord.plates, 4); assert.equal(w.model.plates.length, 4);
  assert.equal(w.platesOn, 4);
  for (let i = 0; i < 4; i++) { w.downT = 0; w.stunned = 0; foes.hurt(w, 'blade', v(0, 0, -1), { damage: 1, breaks: true, charged: true }); }
  assert.equal(w.platesOn, 0, 'every plate off');
  assert.ok(w.armour.bare && !w.def.stout, 'bare: light cuts stagger it now');
  assert.ok(w.model.plates.every((m) => !m.visible), 'off its body');
  // the last stand: a blow that would end it from above 30 % leaves it a sliver, and its whirl comes next
  const x = add(foes, 'warlord', v(20, 0, 20), { provoked: true, state: 'chase' });
  x.downT = 0; x.hp = x.def.hp * 0.32;
  foes.hurt(x, 'blade', v(0, 0, -1), { damage: 6, breaks: true });
  assert.ok(x.alive && x.hp > 0, 'it clings on');
  assert.equal(x.plan?.a.id ?? x.atk?.id, 'whirl', 'its last stand next');
  assert.ok(atk(x, 'whirl').opens > 1, 'it sits open after');
  done();
});

test('no prowler or warlord dies to one light combo at any stage or tier; after a missed blow each is quickly at it again', () => {
  for (const kind of ['prowler', 'warlord']) for (const stage of [0, 2, 4]) for (const tier of [0, 1]) {
    const { foes, P, done } = arena({ rng: seeded(3 + stage) });
    P.pos.set(0, 0, 0);
    const f = add(foes, kind, v(0, 0, 1.6), { provoked: true, state: 'chase' });
    if (tier) f.tierN = 1;
    f.toughen(stage);
    // the 1/1/3 combo into its face at the blade's cadence; the prowler may hop out of it
    for (const [n, d] of [[0, 1], [1, 1], [2, 3]]) {
      if (f.alive && f.pos.distanceTo(P.pos) < 2.9) foes.hurt(f, 'blade', _dir(P.pos, f.pos), { damage: d, combo: n });
      for (let i = 0; i < 37; i++) foes.update(DT);
    }
    assert.ok(f.alive, `${kind} at stage ${stage}${tier ? ', its tier' : ''}: alive after one combo (${f.hp} hp)`);
    done();
  }
  for (const kind of ['prowler', 'warlord']) {
    const { foes, P, done } = arena();
    const f = add(foes, kind, v(5, 0, 0), { provoked: true, state: 'chase' });
    f.whiffed = true; f.next(f.def.attacks[0], { ...P, dead: false, down: true });
    assert.ok(f.state === 'recover' && f.timer <= FOES[kind].whiffRecover + 1e-9 && f.timer <= 0.6, `${kind}: back at it in ${f.timer} s`);
    done();
  }
});

// the masher (the combat review's): runs at the nearest, cuts the light combo at the blade's cadence (BLADE: 0.62 s a
// swing, the cut at half, 1/1/3, 0.4 s after the third), never guards or dodges; topped up so it never falls
function mash(foes, P, list, secs = 60) {
  let swingT = 0, n = 0, pending = null, cool = 0;
  const B = { swinging: false, phase: 'wind', special: false };
  foes.tool = { blade: B };   // (its swing as a foe sees it begin: fight.evade)
  for (let t = 0; t < secs && list.some((f) => f.alive); t += DT) {
    B.swinging = swingT > 0.31;
    foes.update(DT);
    P.dead = false; P.down = null; P.health = 1;
    const live = list.filter((f) => f.alive && !f.carriedBy);
    if (!live.length) break;
    const T = live.sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos))[0], d = T.pos.distanceTo(P.pos);
    P.heading = Math.atan2(T.pos.x - P.pos.x, T.pos.z - P.pos.z);
    cool = Math.max(0, cool - DT); swingT = Math.max(0, swingT - DT);
    if (pending && (pending.t -= DT) <= 0) {
      const p = pending; pending = null;
      if (p.f.alive && p.f.pos.distanceTo(P.pos) < 2.9 + p.f.def.radius * 0.5) foes.hurt(p.f, 'blade', _dir(P.pos, p.f.pos), { damage: [1, 1, 3][p.n], combo: p.n });
    }
    if (d > 2.4 && !pending) { const s = Math.min(5.5 * DT, d - 2); P.pos.addScaledVector(_dir(P.pos, T.pos), s); continue; }
    if (swingT === 0 && cool === 0 && !pending) { pending = { t: 0.31, f: T, n }; swingT = 0.62; n = (n + 1) % 3; if (n === 0) cool = 0.4 + 0.62; }
  }
}

test('against a masher every signature move fires: the prowler\'s dart, slash, tail sweep, spit and back-flip; the warlord\'s sweep, overhead, charge, roar, plates off and last stand', (t) => {
  const seen = { prowler: new Map(), warlord: new Map() };
  const count = (k, id) => seen[k].set(id, (seen[k].get(id) ?? 0) + 1);
  for (const seed of [3, 7, 11, 19]) {
    const { foes, P, done } = arena({ rng: seeded(seed) });
    P.pos.set(0, 0, -12);
    const list = [add(foes, 'prowler', v(-2, 0, 0), { provoked: true, state: 'chase' }), add(foes, 'prowler', v(2, 0, 0), { provoked: true, state: 'chase' })];
    for (const f of list) { const begin = f.beginWind.bind(f); f.beginWind = (a, ...r) => { count('prowler', a.id); return begin(a, ...r); }; }
    mash(foes, P, list, 45);
    for (const f of list) if (f.flips) seen.prowler.set('flip', (seen.prowler.get('flip') ?? 0) + f.flips);
    done();
  }
  for (const seed of [3, 7, 11, 19]) {
    const { foes, P, done } = arena({ rng: seeded(seed) });
    P.pos.set(0, 0, -14);
    const w = add(foes, 'warlord', v(0, 0, 0), { provoked: true, state: 'chase' });
    const band = [add(foes, 'grunt', v(-5, 0, 4), { state: 'idle' }), add(foes, 'grunt', v(5, 0, 4), { state: 'idle' })];
    const begin = w.beginWind.bind(w); w.beginWind = (a, ...r) => { count('warlord', a.id); return begin(a, ...r); };
    // (the masher after the warlord alone; the band only if the roar woke it)
    mash(foes, P, [w], 90);
    if (w.armour && w.platesOn < 4) seen.warlord.set('plate', (seen.warlord.get('plate') ?? 0) + 4 - w.platesOn);
    if (band.some((g) => g.provoked)) seen.warlord.set('woke', (seen.warlord.get('woke') ?? 0) + 1);
    done();
  }
  t.diagnostic(`prowler: ${JSON.stringify(Object.fromEntries(seen.prowler))}; warlord: ${JSON.stringify(Object.fromEntries(seen.warlord))}`);
  for (const id of ['dart', 'slash', 'tail', 'spit', 'flip']) assert.ok(seen.prowler.get(id) > 0, `the prowler's ${id} fired`);
  for (const id of ['sweep', 'overhead', 'charge', 'roar', 'whirl', 'plate', 'woke']) assert.ok(seen.warlord.get(id) > 0, `the warlord's ${id} fired`);
});

test('the warlord holds a place of its own (a warlord-hold site with a coffer), staged in Arzach behind a site flag, off by default', () => {
  assert.equal(STAGED.roster4, false);
  assert.equal(SITE_IDLE['warlord-hold'], 'guard'); assert.ok(SITE_PAYS['warlord-hold'] > 1, 'its coffer pays more');
  for (const w of Object.keys(SITES)) for (const s of sitesOf(w)) assert.ok(s.kind !== 'warlord-hold' && !s.foes.includes('warlord'), `${w}.${s.id}: no warlord by default`);
  const holds = Object.keys(SITES).flatMap((w) => sitesOf(w, stagedFrom('?staged=roster4')).filter((s) => s.kind === 'warlord-hold').map((s) => [w, s]));
  assert.equal(holds.length, 1, 'one hold');
  const [world, hold] = holds[0];
  assert.equal(world, 'arzach', 'the second world');
  assert.equal(hold.foes[0], 'warlord'); assert.ok(hold.foes.slice(1).every((a) => a === 'grunt') && hold.foes.length >= 3, 'its band of grunts');
  const L = layoutSite(hold, BODIES);
  assert.ok(L.coffer && L.props.filter((p) => p.type === 'banner').length === 2 && L.props.some((p) => p.type === 'fire'), 'its coffer between two banners, its band\'s fire');
  const lord = L.foes[0], c = L.coffer.at;
  assert.ok(lord.idle === 'guard' && Math.hypot(lord.at[0] - c[0], lord.at[1] - c[1]) < 3.2, 'the warlord on guard before its coffer');
  assert.ok(L.foes.slice(1).every((f) => f.idle === 'sit'), 'its band sat round the fire');
  // (a compact place: everything within the hoard's own room, so it stands where the hoard stood)
  for (const p of siteFootprint(hold, BODIES)) assert.ok(Math.hypot(p.at[0] - hold.at[0], p.at[1] - hold.at[2]) < 7, `${p.what}: near its centre`);
});

test('at the hold the warlord noticing you does not wake its band: its roar does', async () => {
  const { Encounters } = await import('../src/encounters/index.js');
  const { foes, P, done } = arena();
  P.pos.set(0, 0, 30);
  const hold = { id: 'test-hold', kind: 'warlord-hold', at: [0, 0, 0], heading: 0, foes: ['warlord', 'grunt', 'grunt'] };
  const saved = SITES.arena; SITES.arena = [hold];
  const E = new Encounters({ foes, levelId: 'arena', player: P, game: foes.game, staged: STAGED });
  E.update(DT); E.update(DT);
  const s = E.sites[0];
  for (let i = 0; i < 30; i++) { E.update(DT); foes.update(DT); }
  const [w, ...band] = s.out;
  assert.ok(w && band.length === 2, 'out');
  w.provoked = true; w.state = 'chase'; w.called = false;
  for (let i = 0; i < 90; i++) { E.update(DT); }
  assert.ok(band.every((g) => !g.provoked), 'its band sits on');
  w.cool = 0; w.beginWind(atk(w, 'roar'), P);
  for (let i = 0; i < 90 && w.state === 'wind'; i++) foes.update(DT);
  assert.ok(band.every((g) => g.provoked), 'the roar woke them');
  SITES.arena = saved; E.dispose(); done();
});

// (with the clips: the held poses read)
const parse = async (n) => { const b = await readFile(new URL(`../public/anim/${n}`, import.meta.url)); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
test('with the clips: the dart crouched, the tail swung out at knee height round it, the back-flip upside down, the spit\'s head reared; the warlord\'s lance, roar and whirl; the cost a foe', async (t) => {
  const [u, m, g] = await Promise.all([parse('ual.glb'), parse('moves.glb'), parse('gestures.glb')]);
  const lib = libraryFrom(u); attachMotion(lib, m); attachMotion(lib, g);
  setFoeClips(lib);
  const { foes, P, done } = arena({ dead: true, frame: { up: v(0, 1, 0) } });
  P.pos.set(0, 0, -6);
  const W = (f, j) => { f.model.group.updateMatrixWorld(true); return j.getWorldPosition(v()); };
  const run = (f, n, set) => { for (let i = 0; i < n; i++) { set?.(i); foes.look(f, DT); } };
  const cost = {};
  // the prowler
  {
    const f = foes.add('prowler', v()); f.provoked = true; f.heading = 0; f.state = 'chase';
    const J = f.model.joints, tail = f.model.tail.segs;
    run(f, 40);
    const stand = { head: W(f, J.head).y, hips: W(f, J.torso).y };
    assert.ok(stand.head > 1.4 && stand.head < 1.75, `its head at ${stand.head.toFixed(2)} m`);
    const tip = () => { const s = tail.at(-1); s.updateMatrixWorld(true); return v(0, 0, -PROWLER_TAIL.len).applyMatrix4(s.matrixWorld); };
    assert.ok(tip().y > -0.01 && tip().y < 0.35 && tip().z < -0.6, `its tail down to the ground behind it (${tip().y.toFixed(2)}, ${tip().z.toFixed(2)})`);
    const wind = (id, k) => run(f, 20, () => { f.state = 'wind'; f.atk = atk(f, id); f.k = k; });
    wind('dart', HOLD_AT);
    assert.ok(W(f, J.torso).y < stand.hips - 0.12, `the dart: crouched low (${(stand.hips - W(f, J.torso).y).toFixed(2)} m)`);
    wind('tail', HOLD_AT);
    run(f, 30, () => { f.state = 'strike'; f.atk = atk(f, 'tail'); f.k = 0.4; });
    const tp = tip();
    assert.ok(tp.y > 0.2 && tp.y < 0.8, `the tail at knee height (${tp.y.toFixed(2)} m)`);
    assert.ok(Math.hypot(tp.x, tp.z) > 1.0, `swung out round it (${Math.hypot(tp.x, tp.z).toFixed(2)} m)`);
    wind('spit', 0.7);
    f.state = 'chase'; f.atk = null; run(f, 30);
    // the back-flip: halfway through it is upside down
    f.hopBack = { t: 0, u: 0.5, from: f.pos.clone(), dir: v(0, 0, -1), dist: 3 };
    run(f, 1);
    assert.ok(W(f, J.head).y < W(f, J.legs[0]).y, 'halfway through its flip: its head under its hips');
    f.hopBack = null; run(f, 20);
    const ts = [];
    for (let i = 0; i < 300; i++) { f.pos.z += 0.04; const t0 = performance.now(); foes.look(f, DT); ts.push(performance.now() - t0); }
    cost.prowler = ts.sort((a, b) => a - b)[150];
    foes.remove(f);
  }
  // the warlord
  {
    const f = foes.add('warlord', v()); f.provoked = true; f.heading = 0; f.state = 'chase';
    const J = f.model.joints;
    run(f, 40);
    const stand = { head: W(f, J.head).y };
    assert.ok(stand.head > 1.9 && stand.head < 2.3, `its head at ${stand.head.toFixed(2)} m`);
    const wind = (id, k) => run(f, 20, () => { f.state = 'wind'; f.atk = atk(f, id); f.k = k; });
    wind('roar', HOLD_AT);
    assert.ok(Math.abs(W(f, J.hands[0]).x - W(f, J.hands[1]).x) > 1.2, 'the roar: its arms flung wide');
    wind('charge', HOLD_AT);
    const grip = f.model.tell('charge'); grip.updateMatrixWorld(true);
    const up = v(0, 1, 0).transformDirection(grip.matrixWorld);
    assert.ok(up.z > 0.6, `the charge: its glaive levelled at you (${up.z.toFixed(2)})`);
    wind('whirl', HOLD_AT);
    f.state = 'chase'; f.atk = null; run(f, 30);
    const ts = [];
    for (let i = 0; i < 300; i++) { f.pos.z += 0.03; const t0 = performance.now(); foes.look(f, DT); ts.push(performance.now() - t0); }
    cost.warlord = ts.sort((a, b) => a - b)[150];
    foes.remove(f);
  }
  t.diagnostic(`Foes.look a frame, walking: ${JSON.stringify(cost)} ms`);
  assert.ok(cost.prowler < 1 && cost.warlord < 1, JSON.stringify(cost));
  done();
});

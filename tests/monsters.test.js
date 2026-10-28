// Roster v4's monsters (issue #726; docs/design/enemy-roster-v4.md): the grunt and the hulk on the humanoid rig. The grunt
// carries a club (an overhead and a lunge) or nothing (it digs up rocks), runs to a camp's rack for a spear (a jab) or a
// bow (a volley), shrugs the first light cut of an exchange, hangs back with a bow or bare hands, and low, runs to its
// hulk. The hulk smashes, sweeps and stomps, answers three light cuts in a row with its stomp, picks up a grunt and
// throws it, and rages low. Both in the Arena, the gallery and the foe list, and since the world rosters (#726) in every
// route world: the grunts in the packs, the two together at every camp. The combat review v2.34's asks: a camp of grunts
// starts at least two attacks a grunt against a mashing traveller.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, WAVES, CARRY, RACK } from '../src/foes.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { FIGHT, TIERS, POISE, tierDef } from '../src/enemies/fight.js';
import { SITES, layoutSite, siteFootprint } from '../src/encounters/sites.js';
import { BODIES } from '../src/encounters/index.js';
import { worldArchetypes, WORLDS } from '../src/foe-worlds.js';
import { ROUTE_PARTS, SIDE } from '../src/levels/names.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { skinWorlds, skinOf } from '../src/enemies/skins.js';
import { surfaceFor } from '../src/enemies/surfaces.js';
import { windMin } from '../src/telegraph.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { libraryFrom } from '../src/animator.js';
import { attachMotion } from '../src/motion-match.js';
import { HOLD_AT, PROC_POSES, releaseReach, setFoeClips } from '../src/enemies/humanoid-rig.js';
import { GRUNT_MOVES, HULK_MOVES } from '../src/enemies/plans/monster.js';
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
const atk = (f, id) => f.def.attacks.find((a) => a.id === id);
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('the grunt and the hulk on the roster: monsters on their own plan, built, skinned (its tier the same look, #748), every wind-up fair, a handful of draws', () => {
  for (const id of ['grunt', 'hulk']) {
    const A = ARCHETYPES[id];
    assert.equal(A.family, 'monster'); assert.equal(A.status, 'built'); assert.equal(FOES[id], A.def); assert.equal(A.art, 'sheet-1');
    assert.ok(FIGHT[id] && TIERS[id], `${id}: its fight and its tier`);
    for (const a of A.def.attacks) assert.ok(a.wind >= windMin(a) - 1e-9, `${id}.${a.id}: ${a.wind} s`);
    for (const w of skinWorlds(id)) {
      const m = archetypeModel(id, w);
      assert.ok(m?.driver, `${id}@${w}: a body on the humanoid rig`);
      let n = 0; m.group.traverse((o) => { if (o.isMesh) n++; });
      assert.ok(n <= 12, `${id}: ${n} meshes`);
      m.dispose();
    }
    // one look (#748): the Market's the Desert's, no bands
    const base = skinOf(id, 'desert');
    assert.deepEqual(skinOf(id, 'bazaar'), base, 'the same skin in a late world');
    assert.ok(!surfaceFor(id, base, 'skin').stripes, 'no bands');
    assert.ok(surfaceFor(id, base, 'skin').mottle, 'its skin painted');
  }
  assert.ok(ARCHETYPES.grunt.def.height === 1.3 && ARCHETYPES.hulk.def.height === 2.7, 'the sheets: 1.3 m and 2.7 m');
  assert.equal(FOES.hulk.throws, 'grunt');
  // the Arena's waves and its foe list, the gallery's roster (ARCHETYPE_IDS)
  assert.ok(WAVES.some((w) => w.includes('grunt')) && WAVES.some((w) => w.includes('hulk') && w.includes('grunt')), 'the Arena\'s waves');
  const list = foeSections().find((s) => s.id === 'roster').items.map((i) => i.kind);
  assert.ok(list.includes('grunt@desert') && list.includes('hulk@desert'), 'the Arena\'s foe list');
  // (the world rosters, #726: every route world fields them, the grunt in its packs, the hulk at its camps; no side world)
  for (const w of ROUTE_PARTS) assert.ok(WORLDS[w].roster.grunt && worldArchetypes(w).includes('hulk') === !!WORLDS[w].sites?.includes('hulk'), `${w}: the grunt in its packs`);
  for (const w of SIDE) assert.ok(!worldArchetypes(w).includes('grunt'), `${w}: a discarded world, as it was`);
});

test('every move is a shipped clip (a pose of the arms over it at most); the wind-ups pinned', () => {
  const pinned = { grunt: { club: [0.8, 0.3, 0.55], lunge: [0.85, 0.35, 0.5], jab: [0.7, 0.2, 0.5], volley: [0.95, 0.2, 0.6], rock: [0.85, undefined, undefined] },
    hulk: { smash: [1.15, 0.3, 0.55], sweep: [1.1, 0.35, 0.5], stomp: [1.0, 0.25, 0.4], throw: [1.0, undefined, undefined] } };
  for (const [id, moves] of Object.entries(pinned)) {
    assert.deepEqual(FOES[id].attacks.map((a) => a.id).sort(), Object.keys(moves).sort(), `${id}: its moves`);
    for (const [a, [wind, strike, contact]] of Object.entries(moves)) { const A = FOES[id].attacks.find((x) => x.id === a); assert.deepEqual([A.wind, A.strike, A.contact], [wind, strike, contact], `${id}.${a}`); }
  }
  for (const [id, MOVES] of [['grunt', GRUNT_MOVES], ['hulk', HULK_MOVES]]) for (const a of FOES[id].attacks) {
    const M = MOVES[a.id];
    assert.ok(M?.clip, `${id}.${a.id}: a clip`);
    assert.ok(M.from < M.load && M.load < M.cut && M.cut < M.to, `${id}.${a.id}: from < load < cut < to`);
    if (M.pose) assert.ok(PROC_POSES[M.pose], `${id}.${a.id}: its pose ${M.pose}`);
    if (a.lob && a.instant) assert.equal(M.release, CARRY.fly, `${id}.${a.id}: let go as it flies`);
  }
  // (the sheet's attack pose: the club over its head in both fists; the stomp's arms flung up)
  assert.equal(GRUNT_MOVES.club.pose, 'overhead'); assert.equal(HULK_MOVES.stomp.pose, 'stomp');
});

test('what it holds is what it does: the club\'s overhead and lunge, the spear\'s jab, the bow\'s volley; empty-handed or disarmed, rocks', () => {
  const { foes, done } = arena();
  const f = add(foes, 'grunt', v(0, 0, 2));
  assert.ok(['club', 'none'].includes(f.weapon), `it comes with a club or with nothing (${f.weapon})`);
  const can = (d) => f.attacksAt(d, 0).map((a) => a.id).sort();
  f.weapon = 'club'; assert.deepEqual(can(2), ['club']); assert.deepEqual(can(4), ['lunge'], 'the lunge from further off');
  f.weapon = 'spear'; assert.deepEqual(can(2.2), ['jab']);
  f.weapon = 'bow'; assert.deepEqual(can(10), ['volley']);
  f.weapon = 'none'; assert.deepEqual(can(6), ['rock'], 'nothing in its hands: rocks');
  f.weapon = 'club'; f.disarmed = { at: v(3, 0, 3), from: v(), t: 9 };
  assert.ok(can(6).includes('rock') && !can(2).includes('club'), 'its club knocked away: rocks, no overhead');
  assert.ok(atk(f, 'rock').lob, 'a thrown rock shows its landing mark');
  done();
});

test('the camp\'s rack: an empty-handed grunt runs to it and takes a bow (you far off) or a spear, and it is gone from the rack', () => {
  const { foes, P, done } = arena();
  P.pos.set(0, 0, -14);
  const R = { pos: v(4, 0, 2), stock: ['spear', 'bow'] };
  foes.racks.push(R);
  const f = add(foes, 'grunt', v(0, 0, 0), { weapon: 'none', provoked: true, state: 'chase' });
  let took = false;
  for (let i = 0; i < 600 && !took; i++) { foes.update(DT); if (f.weapon !== 'none') took = true; }
  assert.equal(f.weapon, 'bow', 'you are far: the bow');
  assert.deepEqual(R.stock, ['spear'], 'gone from the rack');
  assert.ok(f.pos.distanceTo(R.pos) < 1.2, 'it went to the rack for it');
  P.pos.set(2, 0, 0);
  const g = add(foes, 'grunt', v(1, 0, 0), { weapon: 'none', provoked: true, state: 'chase' });
  for (let i = 0; i < 600 && g.weapon === 'none'; i++) foes.update(DT);
  assert.equal(g.weapon, 'spear', 'close in: the spear'); assert.deepEqual(R.stock, []);
  // (nothing left: the next one digs up rocks)
  const h = add(foes, 'grunt', v(-1, 0, 0), { weapon: 'none', provoked: true, state: 'chase' });
  for (let i = 0; i < 30; i++) foes.update(DT);
  assert.ok(!h.fetching && h.weapon === 'none' && RACK.reach > 10);
  done();
});

test('it shrugs the first light cut of an exchange (no harm, no poise worn), not a charged cut; left alone a while, it shrugs again', () => {
  const { foes, P, done } = arena();
  P.pos.set(0, 0, -1.5);
  const f = add(foes, 'grunt', v(0, 0, 0), { provoked: true, state: 'chase' });
  const hp = f.hp, poise = f.poise;
  foes.hurt(f, 'blade', v(0, 0, 1), { damage: 1, combo: 0 });
  assert.equal(f.hp, hp, 'the first cut: shrugged'); assert.equal(f.poise, poise);
  foes.hurt(f, 'blade', v(0, 0, 1), { damage: 1, combo: 1 });
  assert.equal(f.hp, hp - 1, 'the second lands');
  for (let i = 0; i < Math.ceil((POISE.after + 0.3) / DT); i++) f.update(DT, P, foes.env);
  const h2 = f.hp;
  foes.hurt(f, 'blade', v(0, 0, 1), { damage: 1, combo: 0 });
  assert.equal(f.hp, h2, 'a new exchange: shrugged again');
  const c = add(foes, 'grunt', v(4, 0, 0), { provoked: true, state: 'chase' });
  foes.hurt(c, 'blade', v(0, 0, 1), { damage: 1, breaks: true, charged: true });
  assert.ok(c.hp < c.def.hp || !c.alive, 'a charged cut is never shrugged');
  done();
});

test('low, a grunt runs to its hulk (not to the mummer nearer it); the hulk rages low', () => {
  const { foes, P, done } = arena();
  P.pos.set(0, 0, -3);
  const g = add(foes, 'grunt', v(0, 0, 0), { provoked: true, state: 'chase' });
  const m = add(foes, 'mummer', v(2, 0, 0), { provoked: true, state: 'chase' });
  const h = add(foes, 'hulk', v(0, 0, 9), { provoked: true, state: 'chase' });
  foes.hurt(g, 'blade', v(0, 0, 1), { damage: 1, combo: 0 });   // (shrugged)
  foes.hurt(g, 'blade', v(0, 0, 1), { damage: 1, combo: 1 });
  assert.ok(g.alive && g.fleeT > 0, 'it breaks and runs');
  assert.equal(g.fleeTo, h, 'to its hulk');
  assert.ok(m.pos.distanceTo(g.pos) < h.pos.distanceTo(g.pos));
  const d0 = g.pos.distanceTo(h.pos);
  for (let i = 0; i < 60; i++) foes.update(DT);
  assert.ok(g.pos.distanceTo(h.pos) < d0 - 1, 'toward it');
  h.hp = h.def.hp * 0.45;
  foes.hurt(h, 'blade', v(0, 0, 1), { damage: 1, breaks: true });
  assert.ok(h.rage, 'the hulk rages');
  done();
});

test('the hulk picks up the nearest grunt, holds it over its horn and throws it: it lands dazed at the mark; none near, no throw', () => {
  const { foes, P, done } = arena();
  P.pos.set(0, 0, 8);
  const k = add(foes, 'hulk', v(0, 0, 0), { provoked: true, state: 'chase' });
  const near = add(foes, 'grunt', v(1.5, 0, -1), { state: 'chase' }), far = add(foes, 'grunt', v(4, 0, -3), { state: 'chase' });
  foes.update(DT);
  const thr = atk(k, 'throw');
  assert.ok(k.attacksAt(7, 0).includes(thr), 'a grunt near it to throw');
  k.state = 'chase'; k.cool = 0; k.beginWind(thr, P);
  assert.equal(k.carry, near, 'the nearest');
  let top = 0;
  for (let i = 0; i < 200 && k.state === 'wind'; i++) { foes.update(DT); top = Math.max(top, near.pos.y); }
  assert.ok(top > k.def.height * 0.9, `held up over it (${top.toFixed(2)} m)`);
  for (let i = 0; i < 5; i++) foes.update(DT);
  assert.equal(near.carriedBy, null);
  assert.ok(near.pos.distanceTo(k.attackAt) < 0.5, 'landed at the mark');
  assert.ok(near.stunned > CARRY.daze * 0.5, 'dazed');
  near.pos.set(30, 0, 30); far.pos.set(-30, 0, 30);
  foes.update(DT);
  assert.ok(!k.attacksAt(7, 0).includes(thr), 'none near: no throw');
  done();
});

test('the hulk answers a masher: three light cuts in a row and it stomps at once (a jump clears it); its tier\'s stomp sends a quake', () => {
  const { foes, P, done } = arena();
  P.pos.set(0, 0, 1.6);
  const k = add(foes, 'hulk', v(0, 0, 0), { provoked: true, state: 'chase', heading: 0 });
  k.cool = 2;   // (waiting its turn: the masher's moment)
  for (let i = 0; i < 3; i++) { foes.hurt(k, 'blade', v(0, 0, -1), { damage: 1, combo: i % 2 }); foes.update(0.3); }
  assert.equal(k.state, 'wind', 'it winds up at once');
  assert.equal(k.atk.id, 'stomp');
  assert.ok(atk(k, 'stomp').ground && atk(k, 'stomp').at === 'self', 'round it, on the ground: a jump clears it');
  // (two cuts and a pause: no answer)
  const j = add(foes, 'hulk', v(10, 0, 0), { provoked: true, state: 'chase' });
  j.cool = 3;
  foes.hurt(j, 'blade', v(0, 0, -1), { damage: 1 }); foes.update(0.3); foes.hurt(j, 'blade', v(0, 0, -1), { damage: 1 }); foes.update(1.5); foes.hurt(j, 'blade', v(0, 0, -1), { damage: 1 }); foes.update(DT);
  assert.ok(!(j.state === 'wind' && j.atk.id === 'stomp' && j.answering), 'cuts with a pause between are no mash');
  assert.ok(tierDef('hulk', FOES.hulk).attacks.find((a) => a.id === 'stomp').wave, 'the tier: a quake');
  done();
});

test('the archers and the rock throwers hang back; a grunt that missed is quickly at it again', () => {
  const { foes, P, done } = arena();
  P.pos.set(0, 0, 0);
  const b = add(foes, 'grunt', v(0, 0, 3), { weapon: 'bow', provoked: true, state: 'chase' });
  b.cool = 5; b.retreat = 1.1;
  for (let i = 0; i < 40; i++) b.update(DT, P, foes.env);
  assert.ok(b.pos.distanceTo(P.pos) > 3.6, `the archer backs off (${b.pos.distanceTo(P.pos).toFixed(2)} m)`);
  assert.equal(FOES.grunt.hangBack.none, 6); assert.equal(FOES.grunt.hangBack.club, undefined, 'a club comes in');
  const c = add(foes, 'grunt', v(5, 0, 0), { weapon: 'club', provoked: true, state: 'chase' });
  c.whiffed = true; c.next(atk(c, 'club'), { ...P, dead: false, down: true });
  assert.ok(c.state === 'recover' && c.timer <= FOES.grunt.whiffRecover + 1e-9, `back at it in ${c.timer} s`);
  done();
});

test('a camp of grunts starts at least two attacks a grunt against a mashing traveller (combat-v2.34, rec. 1)', (t) => {
  const runs = [];
  for (const seed of [3, 7, 11]) {
    const { foes, P, done } = arena({ rng: seeded(seed) });
    P.pos.set(0, 0, -12);
    const site = { kind: 'camp', at: [0, 0, 0], heading: Math.PI, foes: ['grunt', 'grunt', 'grunt', 'grunt'], rack: true, unarmed: 2 };
    const L = layoutSite(site, BODIES);
    const rack = L.props.find((p) => p.type === 'rack');
    foes.racks.push({ pos: v(rack.at[0], 0, rack.at[1]), stock: ['spear', 'bow'] });
    const list = L.foes.map((F) => {
      const f = foes.add('grunt', v(F.at[0], 0, F.at[1])); if (F.weapon) f.weapon = F.weapon; f.provoked = true; f.state = 'chase';
      f.started = 0; const begin = f.beginWind.bind(f); f.beginWind = (...a) => { f.started++; return begin(...a); };
      return f;
    });
    // the masher: runs at the nearest, cuts the light combo at the blade's cadence (BLADE: 0.62 s a swing, the cut at half,
    // 1/1/3, 0.4 s after the third), never guards or dodges
    let t = 0, swingT = 0, n = 0, pending = null, cool = 0;
    for (; t < 60 && list.some((f) => f.alive); t += DT) {
      foes.update(DT);
      const live = list.filter((f) => f.alive && !f.carriedBy);
      if (!live.length) break;
      const T = live.sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos))[0], d = T.pos.distanceTo(P.pos);
      cool = Math.max(0, cool - DT); swingT = Math.max(0, swingT - DT);
      if (pending && (pending.t -= DT) <= 0) {
        const p = pending; pending = null;
        if (p.f.alive && p.f.pos.distanceTo(P.pos) < 2.9) foes.hurt(p.f, 'blade', _dir(P.pos, p.f.pos), { damage: [1, 1, 3][p.n], combo: p.n });
      }
      if (d > 2.4 && !pending) { const s = Math.min(5.5 * DT, d - 2); P.pos.addScaledVector(_dir(P.pos, T.pos), s); continue; }
      if (swingT === 0 && cool === 0 && !pending) { pending = { t: 0.31, f: T, n }; swingT = 0.62; n = (n + 1) % 3; if (n === 0) cool = 0.4 + 0.62; }
    }
    runs.push(list.map((f) => f.started));
    done();
  }
  const all = runs.flat(), mean = all.reduce((a, b) => a + b, 0) / all.length;
  t.diagnostic(`attacks a grunt: ${mean.toFixed(2)} (${runs.map((r) => r.join('/')).join(', ')})`);
  assert.ok(mean >= 2, `attacks a grunt: ${mean.toFixed(2)} (${runs.map((r) => r.join('/')).join(', ')})`);
});
const _dir = (from, to) => new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();

test('every camp on the route (roster v4, #726): grunts round the fire with a hulk, a lookout grunt, their rack and some empty-handed for it', () => {
  const camps = Object.values(SITES).flat().filter((s) => s.kind === 'camp');
  assert.ok(camps.length >= 9, `${camps.length} camps`);
  for (const on of camps) {
    assert.ok(on.foes.filter((a) => a === 'grunt').length >= 2 && on.foes.filter((a) => a === 'hulk').length === 1 && on.foes.every((a) => a === 'grunt' || a === 'hulk'), `${on.id}: grunts and a hulk`);
    assert.ok(on.lookout === 'grunt' && on.rack, `${on.id}: a lookout grunt, a rack`);
    const L = layoutSite(on, BODIES);
    assert.ok(L.props.some((p) => p.type === 'rack'), 'the rack');
    assert.equal(L.foes.filter((f) => f.weapon === 'none').length, on.unarmed, `${on.id}: ${on.unarmed} of them empty-handed, for the rack`);
    // (nobody sits in another: each pair of bodies round the fire at least their radii apart)
    const R = (a) => BODIES.radius(a), sit = L.foes.filter((f) => f.idle === 'sit');
    for (let i = 0; i < sit.length; i++) for (let j = i + 1; j < sit.length; j++) {
      const d = Math.hypot(sit[i].at[0] - sit[j].at[0], sit[i].at[1] - sit[j].at[1]);
      assert.ok(d >= R(sit[i].archetype) + R(sit[j].archetype) - 0.05, `${on.id}: ${sit[i].archetype} and ${sit[j].archetype}: ${d.toFixed(2)} m`);
    }
    assert.ok(siteFootprint(on, BODIES).some((p) => p.what === 'rack'));
  }
});

// (with the clips: the held poses read)
const parse = async (n) => { const b = await readFile(new URL(`../public/anim/${n}`, import.meta.url)); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
test('with the clips: the club held high over its head, the stomp\'s foot up then down, the grunt held over the hulk then thrown; the cost a foe', async (t) => {
  const [u, m, g] = await Promise.all(['ual.glb', 'moves.glb', 'gestures.glb'].map(parse));
  const lib = libraryFrom(u); attachMotion(lib, m); attachMotion(lib, g);
  setFoeClips(lib);
  const { foes, P, done } = arena({ dead: true, frame: { up: v(0, 1, 0) } });
  P.pos.set(0, 0, -6);
  const W = (f, j) => { f.model.group.updateMatrixWorld(true); return j.getWorldPosition(v()); };
  const run = (f, n, set) => { for (let i = 0; i < n; i++) { set?.(i); foes.look(f, DT); } };
  const cost = {};
  for (const kind of ['grunt', 'hulk']) {
    const f = foes.add(kind, v()); f.provoked = true; f.heading = 0; f.state = 'chase'; f.weapon = kind === 'grunt' ? 'club' : null;
    const J = f.model.joints;
    run(f, 40);
    const stand = { head: W(f, J.head).y, foot: W(f, J.feet[0]).y };
    const wind = (id, k) => run(f, 14, () => { f.state = 'wind'; f.atk = atk(f, id); f.k = k; });
    if (kind === 'grunt') {
      wind('club', HOLD_AT);
      assert.ok(Math.min(W(f, J.hands[0]).y, W(f, J.hands[1]).y) > stand.head, 'both fists over its head (the sheet\'s attack pose)');
    } else {
      wind('stomp', HOLD_AT);
      assert.ok(W(f, J.feet[0]).y > stand.foot + 0.35, `a foot raised high (${(W(f, J.feet[0]).y - stand.foot).toFixed(2)} m)`);
      run(f, 14, () => { f.state = 'strike'; f.k = 0.6; });
      assert.ok(W(f, J.feet[0]).y < stand.foot + 0.12, 'and stamped down');
      wind('throw', releaseReach(HULK_MOVES.throw));
      assert.ok(Math.min(W(f, J.hands[0]).y, W(f, J.hands[1]).y) > stand.head, 'the grunt held up over its head');
    }
    // the cost: Foes.look a frame, walking (median of 300)
    f.state = 'chase'; f.atk = null;
    const t = [];
    for (let i = 0; i < 300; i++) { f.pos.z += 0.03; const t0 = performance.now(); foes.look(f, DT); t.push(performance.now() - t0); }
    cost[kind] = t.sort((a, b) => a - b)[150];
    foes.remove(f);
  }
  t.diagnostic(`Foes.look a frame, walking: ${JSON.stringify(cost)} ms`);
  assert.ok(cost.grunt < 1 && cost.hulk < 1, `a frame's pose: ${JSON.stringify(cost)} ms`);
  done();
});

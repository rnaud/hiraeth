// The enemy roster's batch 4 (docs/design/enemy-roster.md, build plan step 6; src/enemies/archetypes.js): the possessed
// machines: the furnace brute, the ring drone, the crucible cart and the bell walker, drawn to both their sheets, on the
// kit's plans 8, 13 (a machine's), 17 and 19 (src/enemies/plans/brute.js, hover.js, tracked.js, siege.js); the stand-ins
// they replace retired; Viridel wholly on the new roster and Lorn II all but its rare shade (batch 5).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { existsSync } from 'node:fs';
import { ARCHETYPES, BUILT, archetypeOfKind, parseKind, skinned, spawnKindOf } from '../src/enemies/archetypes.js';
import { skinWorlds } from '../src/enemies/skins.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { ROSTERS, WORLDS } from '../src/foe-worlds.js';
import { Foe, Foes, FOES, attackOf, ARENA_WAVES, WAVES, HUSH } from '../src/foes.js';
import { KINDS } from '../src/foe-kinds.js';
import { windMin, groundMark } from '../src/telegraph.js';
import { DROP_OF } from '../src/chimes.js';
import { clearTargets } from '../src/targets.js';
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
const BATCH4 = ['brute', 'drone', 'cart', 'bell'];

test('batch 4: the furnace brute, the ring drone, the crucible cart and the bell walker are built in every skin, drawn to both their sheets; the stand-ins they replace are retired; Viridel runs wholly on the new roster, Lorn II all but its shade', () => {
  for (const a of BATCH4) {
    const A = ARCHETYPES[a];
    assert.equal(A.status, 'built', a); assert.equal(A.kind, a); assert.ok(BUILT.includes(a));
    assert.equal(A.family, 'machine'); assert.ok(A.possession, `${a}: how its possession shows`);
    for (const n of [1, 2]) assert.ok(existsSync(new URL(`../references/enemy-archetypes/${a}/sheet-${n}.jpg`, import.meta.url)), `${a}: sheet-${n}`);
    for (const w of skinWorlds(a)) { const f = new Foe(skinned(a, w), v()); assert.equal(f.archetype, a); assert.ok(archetypeModel(a, w), `${a}@${w} has a body`); }
  }
  assert.deepEqual(BATCH4.map((a) => `${ARCHETYPES[a].art.main}/${ARCHETYPES[a].art.alt}`), ['perdide2/glassdunes', 'incal/spheres', 'garage/moonfoundry', 'bazaar/saltharbour']);
  // the glass golem and the slag walker are gone (the brute and the cart took their places); the drone is the archetype's
  for (const k of ['golem', 'slag']) {
    assert.ok(!FOES[k], `${k} retired`);
    assert.throws(() => new Foe(k, v()), /Unknown enemy/);
    assert.ok(ARENA_WAVES.flat().every((x) => parseKind(x).kind !== k), `${k}: not in the Arena`);
  }
  assert.deepEqual(Object.keys(KINDS), [], 'no stand-in left');
  assert.equal(FOES.drone, ARCHETYPES.drone.def, 'the drone kind is the ring drone');
  for (const k of BATCH4) assert.ok(WAVES.some((w) => w.includes(k)), `${k}: in the Arena's old waves`);
  // Viridel wholly on the new roster; Lorn II too but for its rare shade (the batch-5 rework)
  for (const w of ['edena', 'perdide2']) {
    const R = ROSTERS[w], kinds = new Set([...Object.keys(R.wild), ...Object.keys(R.fill), R.first, ...R.guards, ...(WORLDS[w].placed ?? []).map(spawnKindOf)]);
    for (const k of kinds) if (!(w === 'perdide2' && k === 'shade')) assert.equal(ARCHETYPES[archetypeOfKind(k)].status, 'built', `${w}: ${k}`);
  }
  assert.ok(Object.keys(ROSTERS.edena.wild).includes('brute'), 'Viridel fields its pruning machines');
});

test('batch 4: every move winds up at least its minimum and says its tell and its answer; only the brute’s hurled slab marks the ground; drops by weight', () => {
  for (const a of BATCH4) {
    assert.equal(DROP_OF[a], ARCHETYPES[a].drop);
    for (const x of FOES[a].attacks) {
      assert.ok(x.wind >= windMin(x) - 1e-9, `${a}.${x.id}: ${x.wind} s`);
      assert.equal(groundMark(x), a === 'brute' && x.id === 'hurl', `${a}.${x.id}: a mark only for what is thrown`);
      assert.ok(x.tell && x.counter, `${a}.${x.id}: its tell and its answer`);
      assert.ok((x.max ?? FOES[a].reach) <= FOES[a].reach + 1e-9, `${a}.${x.id}: within its reach`);
      assert.ok(Math.abs(x.damage * 4 - Math.round(x.damage * 4)) < 1e-9, `${a}.${x.id}: harm in quarter hearts`);
    }
  }
});

test('the furnace brute: light cuts never stagger it (only a charged cut, a riposte, a parry); its slam sends a quake out over the ground (jump it); it stands where it stopped working until you come close', () => {
  // stout: a light cut early in its wind-up rings off; a charged one staggers it
  const b = new Foe('brute', v(), { rng: () => 0.5 }), P = player(v(0, 0, 2));
  b.beginWind(attackOf('brute', 'slam'), P); b.k = 0.2;
  assert.equal(b.hit('blade', v(0, 0, 1), { damage: 1 }), true);
  assert.equal(b.state, 'wind', 'a light cut early in its wind-up: it winds on');
  assert.ok(b.shrugged, 'its armour answers');
  b.hit('blade', v(0, 0, 1), { damage: 2, breaks: true });
  assert.equal(b.state, 'recover', 'the charged cut staggers it');
  // the slam: a ring of shock runs out; jump it
  clearTargets();
  const Q = player(v(0, 0, 0)), foes = world(Q); foes.waveRest = 1e9;
  const s = foes.add('brute', v(0, 0, 2.6)); s.attacksAt = () => [attackOf('brute', 'slam')]; s.heading = Math.PI;
  let quake = false;
  for (let i = 0; i < 4 / DT && !quake; i++) { foes.update(DT); Q.health = 1; Q.down = null; quake = (foes.shocks?.length ?? 0) > 0; }
  assert.ok(quake, 'a quake runs out from it');
  foes.dispose(); clearTargets();
  // calm: it stands still where it stopped, and wakes as you come within its reach
  const c = new Foe('brute', v(0, 0, 0), { rng: () => 0.5, calm: true });
  run(c, player(v(0, 0, 10)), 2);
  assert.ok(c.state === 'idle' && c.pos.length() < 1e-9, 'it stands where it stopped working');
  assert.ok(run(c, player(v(0, 0, 5)), 0.1).includes('notice'), 'close in and it wakes');
});

test('the ring drone: it hovers out of the blade’s reach and hides between strikes; its harpoon reels you in until a guard cuts the line (dazed); stilled it drops; it is metal', () => {
  const D = FOES.drone;
  assert.ok(D.hover > 1.5 && D.metal, 'hovering, metal (the magnet glove takes it)');
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P); foes.waveRest = 1e9;
  const d = foes.add('drone', v(0, 0, 7));
  assert.equal(foes.strike(d, attackOf('drone', 'harpoon')), true);
  assert.equal(foes.hold?.kind, 'tether', 'the line holds you');
  for (let i = 0; i < 10; i++) foes.updateHold(DT);
  assert.ok(P.vel.z > 5, 'pulled toward it');
  P.guard = () => true;
  const e = foes.add('drone', v(3, 0, 7));
  foes.hold = null;
  assert.equal(foes.strike(e, attackOf('drone', 'harpoon')), false);
  assert.ok(e.stunned >= 1 && !foes.hold, 'guarded: the line is cut, the drone dazed');
  // stilled, it drops out of the air
  P.guard = null;
  const s = foes.add('drone', v(-3, 0, 7));
  for (let i = 0; i < 30; i++) foes.update(DT);
  foes.hurt(s, 'stun', v(0, 0, 1), {});
  for (let i = 0; i < 1 / DT; i++) foes.update(DT);
  assert.ok(s.alt < 0.5, `stilled, it drops (${s.alt.toFixed(2)} m)`);
  foes.dispose(); clearTargets();
});

test('the crucible cart: it drives along its heading on its tracks; a bomb jams them (it can’t turn); its ram backs up first, then charges, and a wall stalls it', () => {
  // tracks: it turns before it goes, never sliding sideways
  const c = new Foe('cart', v(), { rng: () => 0.5 }); c.heading = 0;
  c.walkTo(5, 0, 2, DT, env);
  assert.ok(c.pos.length() < 2 * DT * 0.25, 'facing away from where it goes, it turns first (hardly a step)');
  for (let i = 0; i < 120; i++) c.walkTo(5, 0, 2, DT, env);
  assert.ok(c.pos.x > 0.5, 'then drives there');
  // a bomb on its tracks: no turning for a while
  const j = new Foe('cart', v(), { rng: () => 0.5 }); j.heading = 0;
  j.hit('blade', v(0, 0, 1), { damage: 1, source: 'bomb' });
  assert.ok(j.jammed > 4, 'jammed');
  j.face(1, 0, 1);
  assert.equal(j.heading, 0, 'it can’t turn');
  // the ram: it backs up through its wind-up, then charges along its line
  const r = new Foe('cart', v(), { rng: () => 0.5 }), P = player(v(0, 0, 6));
  r.heading = 0; r.beginWind(attackOf('cart', 'ram'), P);
  run(r, P, attackOf('cart', 'ram').wind * 0.9);
  assert.ok(r.pos.z < -0.5, `it backs up first (${r.pos.z.toFixed(2)} m)`);
  // a wall in its way: it stalls there, stunned
  const w = new Foe('cart', v(), { rng: () => 0.5 }), Q = player(v(0, 0, 6));
  w.heading = 0; w.beginWind(attackOf('cart', 'ram'), Q);
  const walled = { ...env, canStep: (from, x, z) => z < 1.5 };
  const ev = run(w, Q, attackOf('cart', 'ram').wind + 0.5, walled);
  assert.ok(ev.some((e) => e?.type === 'stalled'), 'a wall stops its ram');
  assert.ok(w.stunned > 0 && w.state === 'recover', 'it stalls there, open');
  assert.ok(FOES.cart.trail && FOES.cart.douse, 'it drips slag; a shot douses it');
});

test('the bell walker: only the clapper takes harm (a cut rings off unless it sits open or is stilled); its toll sends three rings out (jump each); the bell-note whistle chokes the toll; its drop slams where you stood, then it tips up open', () => {
  const b = new Foe('bell', v(), { rng: () => 0.5 });
  assert.equal(b.hit('blade', v(0, 0, -1), { damage: 1 }), 'glance', 'a cut rings off the bronze');
  assert.equal(b.hit('blade', v(0, 0, -1), { damage: 1, source: 'bomb' }), 'glance', 'a bomb too');
  assert.equal(b.hp, FOES.bell.hp);
  b.open = 1;
  assert.equal(b.hit('blade', v(0, 0, -1), { damage: 1 }), true, 'sitting open: the clapper takes it');
  assert.equal(b.hp, FOES.bell.hp - 1);
  const st = new Foe('bell', v()); st.hit('stun', v(0, 0, 1)); assert.equal(st.hit('blade', v(0, 0, 1), { damage: 1 }), true, 'stilled: open to the blade');
  // the toll: three rings, some way apart, a jump clears each
  clearTargets();
  const P = player(v(0, 0, 0)), foes = world(P); foes.waveRest = 1e9;
  const t = foes.add('bell', v(0, 0, 6)); t.attacksAt = () => [attackOf('bell', 'toll')];
  let rings = 0, first = null, last = null;
  for (let i = 0; i < 6 / DT; i++) {
    const n = foes.shocks?.length ?? 0; foes.update(DT); P.health = 1; P.down = null;
    if ((foes.shocks?.length ?? 0) > n) { rings += (foes.shocks.length - n); first ??= i * DT; last = i * DT; }
    if (rings >= 3) break;
  }
  assert.equal(rings, 3, 'three rings');
  assert.ok(last - first > 1, `one after another (${(last - first).toFixed(2)} s)`);
  foes.dispose(); clearTargets();
  // the whistle answered as it winds up the toll: it chokes and sits open
  const G = new GameState(null), Q = player(v(0, 0, 0)), F = world(Q, { game: G }); F.waveRest = 1e9;
  const h = F.add('bell', v(0, 0, 6)); h.beginWind(attackOf('bell', 'toll'), Q);
  G.emit('bell', { pos: Q.pos.clone() });
  assert.equal(h.state, 'recover'); assert.ok(h.open >= HUSH - 1e-9, 'choked: it sits open');
  assert.equal(F.hurt(h, 'blade', v(0, 0, -1), { damage: 1 }), true);
  assert.equal(h.hp, FOES.bell.hp - 1, 'and the clapper takes the cut');
  F.dispose(); clearTargets();
  // the drop: it leaps onto where you stood and tips up open after
  const d = new Foe('bell', v(), { rng: () => 0.5 }), R = player(v(0, 0, 3));
  d.attacksAt = () => [attackOf('bell', 'drop')]; d.state = 'chase'; d.cool = 0;
  let landed = false;
  for (let i = 0; i < 4 / DT && !landed; i++) { const ev = d.update(DT, R, env); landed = ev.some((e) => e?.type === 'strike'); }
  assert.ok(landed && d.pos.distanceTo(v(0, 0, 3)) < 0.8, 'it slams down where you stood');
  for (let i = 0; i < 0.5 / DT; i++) d.update(DT, R, env);
  assert.ok(d.open > 0, 'then it sits tipped up toward you: the clapper in reach');
  // calm, it stands in its square
  const c = new Foe('bell', v(), { rng: () => 0.5, calm: true });
  run(c, player(v(0, 0, 16)), 2);
  assert.ok(c.state === 'idle' && c.pos.length() < 1e-9, 'it stands and tolls the hours');
});

test('cheap to draw: each of batch 4 is a handful of meshes (its moving parts skinned on the kit’s joints), the skitter five (44 before)', () => {
  const most = { brute: 11, drone: 10, cart: 17, bell: 14, skitter: 6 };   // (the cart: its sprockets' teeth one more, v1.26)
  for (const [a, n] of Object.entries(most)) for (const w of skinWorlds(a)) {
    const m = archetypeModel(a, w);
    let meshes = 0; m.group.traverse((o) => { meshes += o.isMesh ? 1 : 0; });
    assert.ok(meshes <= n, `${a}@${w}: ${meshes} meshes`);
    m.dispose?.();
  }
  // a skinned mesh's bounds follow its joints (a gallery frames it; a box taken of it)
  const m = archetypeModel('brute', 'perdide2'), sm = [];
  m.group.traverse((o) => { if (o.isSkinnedMesh) sm.push(o); });
  assert.ok(sm.length >= 1);
  m.group.updateMatrixWorld(true);
  const before = new THREE.Box3().setFromObject(m.group).max.y;
  const sh = m.group.getObjectByName('shoulder'); sh.rotation.x = -3; m.group.updateMatrixWorld(true);
  const after = new THREE.Box3().setFromObject(m.group).max.y;
  assert.ok(after > before + 0.8, `an arm raised over its head raises its bounds (${before.toFixed(2)} → ${after.toFixed(2)} m)`);
  m.dispose?.();
});

test('Lorn II’s wood cutter: placed by hand on the lit path’s bank (src/foe-worlds.js PLACED), it comes out calm as you come near and stands rusted mid-task; cut down, it is gone for good', async () => {
  const { PLACED } = await import('../src/foe-worlds.js');
  assert.deepEqual(PLACED.perdide2.map((p) => p.archetype), ['brute']);
  assert.ok(WORLDS.perdide2.placed.includes('brute'));
  clearTargets();
  const game = new GameState(null), P = player(v(13.7, 0, -200));
  const make = () => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, 0) }, levelId: 'perdide2', content: { npcs: [] }, physics: flat, player: P, settings: { enemies: 'normal' }, game });
  let foes = make(); foes.packRest = 1e9;
  foes.update(DT);
  assert.equal(foes.list.filter((f) => f.post).length, 0, 'far off: not out');
  P.pos.set(13.7, 0, -240); foes.update(DT);
  const w = foes.list.find((f) => f.post);
  assert.ok(w && w.kind === 'brute' && w.skin === 'perdide2', 'near: the wood cutter, in its own skin');
  assert.ok(Math.hypot(w.pos.x - 13.7, w.pos.z + 280) < 0.5 && w.state === 'idle', 'standing where it was placed, calm');
  for (let i = 0; i < 60; i++) foes.update(DT);
  assert.equal(w.state, 'idle', 'it stands where it stopped working');
  while (w.alive) foes.hurt(w, 'blade', v(0, 0, 1), { damage: 2, breaks: true });
  for (let i = 0; i < 60; i++) foes.update(DT);
  foes.dispose(); clearTargets();
  foes = make(); foes.packRest = 1e9; foes.update(DT);
  assert.equal(foes.list.filter((f) => f.post).length, 0, 'broken, it does not come back');
  foes.dispose(); clearTargets();
});

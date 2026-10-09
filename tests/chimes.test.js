// Chimes, the currency (src/chimes.js, the wallet in src/resources.js; docs/systems/items.md "Chimes"): what each foe
// drops, the pieces' arc, magnet, pickup and fade, the wallet's add / spend / save, and no drops where there should be none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { DROP_OF, DROP_CATEGORY, PURSE, SPREAD, PIECE, CRYSTAL, dropAmount, dropPolicy, pieceValues, pieceVisible, ChimeField, ChimeView, connectDrops, crystalGeometry, clusterGeometry } from '../src/chimes.js';
import { CHIME_ICON_PATHS } from '../src/chime-icon.js';
import { CHIME_SVG } from '../src/shop-panel.js';
const view0 = () => new ChimeView(null).crystals;
import { Resources, CHIMES } from '../src/resources.js';
import { GameState } from '../src/game-state.js';
import { Foes, FOES } from '../src/foes.js';
import { ENEMY_ROSTER } from '../src/enemies/roster.js';
import { walletTick, healthHud, Fader } from '../src/hud.js';
import { itemsPanel } from '../src/game-menu.js';
import { firstPurse } from '../src/trials/index.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const itemSet = () => ({ has: () => false });
/** A repeatable rng. */
const seeded = (s = 7) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('drop amounts: every foe kind has one, small ones a little, heavy ones more; world enemies by their category', () => {
  for (const kind of Object.keys(FOES)) assert.ok(DROP_OF[kind] > 0, `${kind} drops something`);
  assert.ok(DROP_OF.swarm < 1 && DROP_OF.splinter < 1, 'the swarm\'s blots and the splinters: a chance of one');
  assert.ok(DROP_OF.blot < DROP_OF.machine && DROP_OF.machine < DROP_OF.golem, 'by weight');
  for (const c of new Set(ENEMY_ROSTER.map((e) => e.category))) assert.ok(DROP_CATEGORY[c] > 0, `${c} drops something`);
  assert.ok(DROP_CATEGORY['local-creature'] < DROP_CATEGORY['shadow-spirit'] && DROP_CATEGORY['shadow-spirit'] < DROP_CATEGORY['possessed-machine']);
  assert.ok(PURSE.guardian > 4 * Math.max(...Object.values(DROP_OF), ...Object.values(DROP_CATEGORY)), 'a guardian\'s purse is a big one');
  // the spread: within ±25 %, at least one
  for (const [kind, base] of Object.entries(DROP_OF)) {
    if (base < 1) continue;
    for (const r of [0, 0.5, 0.999]) {
      const n = dropAmount({ kind }, () => r);
      assert.ok(n >= 1 && n >= Math.round(base * (1 - SPREAD)) && n <= Math.round(base * (1 + SPREAD)), `${kind} at ${r}: ${n}`);
    }
  }
  assert.equal(dropAmount({ kind: 'swarm' }, () => 0.2), 1); assert.equal(dropAmount({ kind: 'swarm' }, () => 0.8), 0);
  assert.equal(dropAmount({ kind: 'blot', category: 'possessed-machine' }, () => 0.5), DROP_CATEGORY['possessed-machine'], 'a world enemy by its category, not its family');
  // on average, about the base
  const rng = seeded(3); let sum = 0; for (let i = 0; i < 2000; i++) sum += dropAmount({ kind: 'swarm' }, rng);
  assert.ok(Math.abs(sum / 2000 - 0.5) < 0.05);
});

test('pieces: ones, and fives for a big drop; the values add up', () => {
  assert.deepEqual(pieceValues(3), [1, 1, 1]);
  assert.deepEqual(pieceValues(0), []);
  for (const n of [1, 4, 9, 10, 13, 40, 57]) assert.equal(pieceValues(n).reduce((a, b) => a + b, 0), n);
  assert.ok(pieceValues(PURSE.guardian).length <= 12, 'a purse is a handful of pieces, not forty');
  assert.ok(pieceValues(PURSE.guardian).every((x) => x === 5));
});

test('where they drop: everywhere but a game\'s own foes (Ink tide); the Arena\'s as training', () => {
  assert.equal(dropPolicy({}), 'on'); assert.equal(dropPolicy(null), 'on');
  assert.equal(dropPolicy({ foes: { wild: false } }), 'on', 'a world with no wild packs: its foes still drop');
  assert.equal(dropPolicy({ foes: { own: true, noInk: true } }), 'off', 'a game\'s own foes');
  assert.equal(dropPolicy({ foes: { waves: true } }), 'training');
  assert.equal(dropPolicy({ foes: { chimes: false } }), 'off');
  assert.match(src('src/minigames/waves.js'), /foes: \{ own: true, wild: false, noInk: true, chimes: false \}/, 'Ink tide: none');
  assert.match(src('src/levels/arena.js'), /chimes: 'training'/, 'the Arena: training');
  assert.match(src('src/main.js'), /connectDrops\(game, chimes, \{ policy: chimePolicy/, 'main.js wires them by the policy');
});

test('the pieces pop out in an arc, bounce, hover; walked over they are picked up', () => {
  const taken = [], F = new ChimeField({ groundAt: () => 0, rng: seeded(5), onTake: (p) => taken.push(p.value) });
  F.drop(v(0, 0, 0), 4);
  assert.equal(F.list.length, 4); assert.equal(F.lying, 4);
  let top = 0;
  for (let t = 0; t < 1; t += DT) { F.update(DT, null); for (const p of F.list) top = Math.max(top, p.pos.y); }
  assert.ok(top > 1.2, `they arc up (${top.toFixed(2)} m)`);
  for (const p of F.list) {
    assert.equal(p.phase, 'rest');
    const d = Math.hypot(p.pos.x, p.pos.z);
    assert.ok(d >= PIECE.spread[0] - 1e-6 && d <= PIECE.spread[1] + 1e-6, `scattered round it (${d.toFixed(2)} m)`);
    assert.ok(Math.abs(p.pos.y - PIECE.hover) < 0.06, 'hovering over the ground');
  }
  // too soon: not picked up while it pops out
  const G = new ChimeField({ groundAt: () => 0, rng: seeded(1) });
  G.drop(v(0, 0, 0), 1);
  assert.equal(G.update(DT, v(0, 0, 0)).length, 0, 'not in the first moment');
  // walking over one picks it up
  const p = F.list[0], feet = v(p.pos.x, 0, p.pos.z);
  const got = F.update(DT, feet);
  assert.ok(got.includes(p)); assert.ok(!F.list.includes(p)); assert.deepEqual(taken.slice(0, got.length), got.map((x) => x.value));
});

test('the magnet: within reach a piece is drawn in and taken; out of reach it stays', () => {
  const F = new ChimeField({ groundAt: () => 0, rng: seeded(9) });
  F.drop(v(0, 0, 0), 1);
  for (let t = 0; t < 1; t += DT) F.update(DT, null);
  const p = F.list[0];
  const far = v(p.pos.x + PIECE.magnet + 1, 0, p.pos.z);
  for (let t = 0; t < 1; t += DT) F.update(DT, far);
  assert.equal(p.phase, 'rest', 'out of the magnet\'s reach: it stays');
  const near = v(p.pos.x + PIECE.magnet - 0.4, 0, p.pos.z);
  let t = 0, got = [];
  while (!got.length && t < 2) { got = F.update(DT, near); t += DT; }
  assert.equal(got.length, 1, 'drawn in and taken');
  assert.ok(t < 0.8, `quickly (${t.toFixed(2)} s)`);
  // knocked out / in a scene (null): nothing taken, even standing on it
  const G = new ChimeField({ groundAt: () => 0, rng: seeded(2) });
  G.drop(v(0, 0, 0), 2);
  for (let k = 0; k < 2; k += DT) assert.equal(G.update(DT, null).length, 0);
});

test('left lying, they blink before the end and are gone after PIECE.life s', () => {
  const F = new ChimeField({ groundAt: () => 0, rng: seeded(4) });
  F.drop(v(0, 0, 0), 3);
  let blinked = false;
  for (let t = 0; t < PIECE.life - PIECE.blink - 0.1; t += DT) { F.update(DT, null); for (const p of F.list) assert.ok(pieceVisible(p), 'steady until the blink'); }
  assert.equal(F.list.length, 3);
  for (let t = 0; t < PIECE.blink - 0.2; t += DT) { F.update(DT, null); if (F.list.some((p) => !pieceVisible(p))) blinked = true; }
  assert.ok(blinked, 'they blink'); assert.equal(F.list.length, 3, 'still there');
  for (let t = 0; t < 0.5; t += DT) F.update(DT, null);
  assert.equal(F.list.length, 0, 'gone');
});

test('a drop over a ledge stays at the foe\'s height; with no ground, where it fell', () => {
  const F = new ChimeField({ groundAt: () => -40, rng: seeded(6) });
  F.drop(v(0, 5, 0), 2);
  for (const p of F.list) assert.equal(p.to.y, 5);
  const G = new ChimeField({ groundAt: () => -Infinity, rng: seeded(6) });
  G.drop(v(0, 2, 0), 1);
  assert.equal(G.list[0].to.y, 2);
  const H = new ChimeField({ groundAt: () => 1.5, rng: seeded(6) });
  H.drop(v(0, 1, 0), 1);
  assert.equal(H.list[0].to.y, 1.5, 'a step up: on it');
});

test('the wallet: add, spend (fails cleanly when short), the cap, the save, the event; training not counted as earned', () => {
  const g = new GameState(null), R = new Resources(g, itemSet()), seen = [];
  g.on('wallet', (e) => seen.push(e));
  assert.equal(R.chimes, 0);
  assert.equal(R.addChimes(7, { source: 'pickup' }), 7);
  assert.equal(R.chimes, 7); assert.equal(g.flag('res.chimes'), 7); assert.equal(R.chimesEarned, 7);
  assert.deepEqual(seen.at(-1), { count: 7, delta: 7, source: 'pickup', training: false });
  assert.equal(R.spend(10), false, 'short: refused'); assert.equal(R.chimes, 7, 'nothing taken');
  assert.equal(seen.length, 1, 'a refused spend says nothing');
  assert.equal(R.spend(-3), false); assert.equal(R.spend('x'), false); assert.equal(R.spend(NaN), false);
  assert.equal(R.canAfford(7), true); assert.equal(R.canAfford(8), false);
  assert.equal(R.spend(5, { source: 'shop' }), true); assert.equal(R.chimes, 2);
  assert.deepEqual(seen.at(-1), { count: 2, delta: -5, source: 'shop' });
  assert.equal(R.spend(0), true); assert.equal(R.chimes, 2);
  R.addChimes(10, { training: true });
  assert.equal(R.chimes, 12, 'the Arena\'s go into the wallet'); assert.equal(R.chimesEarned, 7, 'but are not counted as earned');
  assert.equal(R.addChimes(0), 0); assert.equal(R.addChimes(-4), 0); assert.equal(R.chimes, 12);
  R.addChimes(CHIMES.cap * 2);
  assert.equal(R.chimes, CHIMES.cap, 'never past the cap');
  // the save: a game reloaded from its own data has the same wallet
  let saved = null;
  const store = { getItem: () => saved, setItem: (_, s) => { saved = s; } };
  const a = new GameState(store); new Resources(a, itemSet()).addChimes(23);
  const b = new GameState(store);
  assert.equal(new Resources(b, itemSet()).chimes, 23);
  // a broken flag reads as none
  const c = new GameState(null); c.set('res.chimes', 'lots'); assert.equal(new Resources(c, itemSet()).chimes, 0);
});

test('picked-up pieces go into the wallet (main.js), Arena pieces as training', () => {
  const g = new GameState(null), R = new Resources(g, itemSet());
  const F = new ChimeField({ groundAt: () => 0, rng: seeded(8), onTake: (p) => R.addChimes(p.value, { source: 'pickup', training: p.training }) });
  F.drop(v(0, 0, 0), 12); F.drop(v(0, 0, 0), 3, { training: true });
  for (let t = 0; t < 1; t += DT) F.update(DT, null);
  for (let t = 0; t < 2 && F.list.length; t += DT) F.update(DT, v(0, 0, 0));
  assert.equal(F.list.length, 0, 'all in reach drawn in');
  assert.equal(R.chimes, 15); assert.equal(R.chimesEarned, 12);
  assert.match(src('src/main.js'), /resources\.addChimes\(p\.value, \{ source: 'pickup', training: p\.training \}\)/);
});

/** A traveller stand-in and a Foes on flat ground (as tests/arena.test.js). */
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function player(at = v()) { return { pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {} }; }
function arena(level) {
  const game = new GameState(null);
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), ...level }, levelId: 'arena', physics: flat, player: player(v(0, 0, -30)), settings: { enemies: 'normal' }, game });
  foes.waveRest = 1e9;
  return { foes, game };
}

test('a foe cut down scatters its chimes where it fell; a world enemy by its category; a guardian\'s purse once', () => {
  const { foes, game } = arena({ foes: {} });
  const F = new ChimeField({ groundAt: () => 0, rng: seeded(11) });
  connectDrops(game, F, { policy: dropPolicy({ foes: {} }), rng: () => 0.5 });
  const f = foes.add('machine', v(3, 0, -30));
  foes.burst(f);
  assert.equal(F.lying, DROP_OF.machine); assert.ok(F.list.every((p) => !p.training));
  assert.ok(F.list.every((p) => Math.hypot(p.from.x - 3, p.from.z + 30) < 1e-6), 'from where it fell');
  F.clear();
  const spirit = ENEMY_ROSTER.find((e) => e.category === 'shadow-spirit');
  foes.burst(foes.add(spirit.id, v(0, 0, -25)));
  assert.equal(F.lying, DROP_CATEGORY['shadow-spirit']);
  F.clear();
  // knocked out of the world or into deep water: nothing
  const lost = foes.add('blot', v(0, 0, -20)); lost.lost = true; foes.burst(lost);
  assert.equal(F.lying, 0);
  foes.worldEvent(foes.add('blot', v(0, 0, -20)), { type: 'fell' });
  assert.equal(F.lying, 0, 'fallen out of the world');
  // a temple's guardian: a purse, once
  game.emit('temple:resolved', { id: 'desert', pos: v(1, 0, 1) });
  assert.equal(F.lying, PURSE.guardian); assert.equal(game.flag('res.purse.desert'), true);
  game.emit('temple:resolved', { id: 'desert', pos: v(1, 0, 1) });
  assert.equal(F.lying, PURSE.guardian, 'only the first time');
});

test('no drops from a game\'s own foes (Ink tide); the Arena\'s waves, list and ring drop as training', () => {
  {
    const level = { foes: { own: true, wild: false, noInk: true, chimes: false } };
    const { foes, game } = arena(level);
    const F = new ChimeField({ groundAt: () => 0 });
    connectDrops(game, F, { policy: dropPolicy(level) });
    for (const k of ['blot', 'machine', 'shade']) foes.burst(foes.add(k, v(0, 0, -28)));
    game.emit('guardian:spar', { pos: v() });
    assert.equal(F.lying, 0, 'Ink tide: none');
  }
  {
    const level = { foes: { waves: true, chimes: 'training' } };
    const { foes, game } = arena(level);
    const F = new ChimeField({ groundAt: () => 0 });
    connectDrops(game, F, { policy: dropPolicy(level), rng: () => 0.5 });
    foes.burst(foes.add('blot', v(0, 0, -28)));
    assert.equal(F.lying, DROP_OF.blot); assert.ok(F.list.every((p) => p.training), 'training pieces');
    game.emit('guardian:spar', { pos: v(0, 0, -20) });
    game.emit('guardian:spar', { pos: v(0, 0, -20) });
    assert.equal(F.lying, DROP_OF.blot + 2 * PURSE.guardian, 'a purse each bout in the ring');
  }
  assert.match(src('src/arena-guardians.js'), /emit\?\.\('guardian:spar'/);
  assert.match(src('src/temples/runtime.js'), /emit\('temple:resolved', \{ id: this\.id, pos:/);
});

test('a makers\' run\'s first finish: its purse into the wallet, and the card says so', () => {
  const g = new GameState(null);
  assert.equal(firstPurse(g, itemSet()), `First finish: ${PURSE.run} chimes.`);
  assert.equal(new Resources(g, itemSet()).chimes, PURSE.run);
  assert.equal((src('src/trials/index.js').match(/if \(first\) lines\.push\(firstPurse\(game, items\)\)/g) ?? []).length, 2, 'both kinds of run');
});

test('the HUD: the count ticks up to the wallet; a change shows the hearts\' block; the game menu shows the wallet', () => {
  let s = 0, t = 0;
  while (s !== PURSE.guardian && t < 3) { s = walletTick(s, PURSE.guardian, DT); t += DT; }
  assert.equal(s, PURSE.guardian); assert.ok(t > 0.2 && t < 1, `a purse counts up in about half a second (${t.toFixed(2)} s)`);
  assert.equal(walletTick(5, 5, DT), 5); assert.equal(walletTick(4.7, 5, DT), 5);
  assert.ok(walletTick(10, 3, DT) < 10, 'counts down too (a spend)');
  assert.equal(healthHud({ health: 1, chimes: 3 }, new Fader(3), 0.1), null, 'at rest: nothing');
  assert.deepEqual(healthHud({ health: 1, chimes: 3, wallet: true }, new Fader(3), 0.1), { value: 1, low: false, hearts: 3, max: 3, chimes: 3 }, 'a change: shown, with the count');
  const html = src('index.html');
  assert.match(html, /<span class="chimes none" role="img" aria-label="Chimes"/);
  assert.ok(html.includes(`<svg viewBox="0 0 16 16" aria-hidden="true">${CHIME_ICON_PATHS}</svg><b>0</b>`), 'the HUD draws the crystal (src/chime-icon.js), not the brass disc');
  assert.ok(CHIME_ICON_PATHS.includes('#63d3e4') && !CHIME_ICON_PATHS.includes('#d6a13e'), 'cyan, not brass');
  assert.ok(itemsPanel({ chimes: 42 }).html.includes(CHIME_ICON_PATHS) && CHIME_SVG.includes(CHIME_ICON_PATHS), 'the game menu\'s wallet and the shop\'s prices draw it too');
  assert.match(src('src/main.js'), /game\.on\('wallet'/);
  assert.match(itemsPanel({ chimes: 42 }).html, /class="gm-wallet"[^>]*>.*42 chimes/);
  assert.doesNotMatch(itemsPanel({}).html, /gm-wallet/);
});

test('the view draws each visible piece: the ones as shards, the fives as clusters, hovering tilted and turning', () => {
  const scene = new THREE.Scene(), view = new ChimeView(scene), F = new ChimeField({ groundAt: () => 0, rng: seeded(12) });
  F.drop(v(0, 0, 0), 12);   // (two fives, two ones)
  for (let t = 0; t < 1; t += DT) F.update(DT, null);
  view.update(F, null);
  assert.equal(view.crystals.count, 2, 'two ones');
  assert.equal(view.clusters.count, 2, 'two fives');
  assert.equal(view.crystals.material, view.clusters.material, 'one material for both (a draw call each)');
  assert.equal(view.glints.count, 4, 'each at rest keeps a small spark (its inner light), so a 3 cm crystal is found a few metres off');
  const gm = new THREE.Matrix4(), gs = new THREE.Vector3(); view.glints.getMatrixAt(0, gm); gm.decompose(new THREE.Vector3(), new THREE.Quaternion(), gs);
  assert.ok(gs.x * CRYSTAL.glint < 0.02, `the spark small at rest (${(gs.x * CRYSTAL.glint * 100).toFixed(1)} cm)`);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3();
  view.crystals.getMatrixAt(0, m); m.decompose(new THREE.Vector3(), q, sc);
  assert.ok(Math.abs(sc.x - 1) < 1e-6, 'at rest, its own size');
  const tilt = up.set(0, 1, 0).applyQuaternion(q).angleTo(new THREE.Vector3(0, 1, 0));
  assert.ok(Math.abs(tilt - CRYSTAL.tilt) < 1e-3, `it hovers tilted (${tilt.toFixed(2)} rad)`);
  // it turns: a later frame, another heading
  const before = q.clone();
  for (let t = 0; t < 0.5; t += DT) F.update(DT, null);
  view.update(F, null); view.crystals.getMatrixAt(0, m); m.decompose(new THREE.Vector3(), q, sc);
  assert.ok(q.angleTo(before) > 0.3, 'and turns');
  view.dispose(); assert.equal(scene.children.length, 0);
});

test('a chime is a small crystal at the scale of a palm: about 3 cm, faceted, cyan with a lavender seam, not a coin', () => {
  const size = (g) => { g.computeBoundingBox(); return g.boundingBox.getSize(new THREE.Vector3()); };
  const one = crystalGeometry(), s1 = size(one);
  assert.ok(s1.y > 0.028 && s1.y < 0.04, `a one is about three centimetres long (${(s1.y * 100).toFixed(1)} cm)`);
  assert.ok(Math.max(s1.x, s1.z) < s1.y * 0.65, 'longer than it is wide: a shard, not a disc');
  assert.equal(CRYSTAL.one, s1.y.toFixed(3) * 1);
  const five = clusterGeometry(), s5 = size(five);
  assert.ok(s5.y > s1.y * 1.2 && s5.y < 0.07, `a five a little larger (${(s5.y * 100).toFixed(1)} cm), still palm-sized`);
  assert.ok(five.attributes.position.count > one.attributes.position.count * 2.5, 'a cluster of three shards');
  // flat facets: each triangle's three normals are one
  const N = one.attributes.normal;
  for (let i = 0; i < N.count; i += 3) for (let k = 1; k < 3; k++) assert.ok(Math.abs(N.getX(i) - N.getX(i + k)) + Math.abs(N.getY(i) - N.getY(i + k)) + Math.abs(N.getZ(i) - N.getZ(i + k)) < 1e-6);
  // facing outward, and closed (the faces' areas times their normals sum to nothing)
  const P = one.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), sum = new THREE.Vector3(), mid = new THREE.Vector3();
  for (let i = 0; i < P.count; i += 3) {
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    assert.ok(n.dot(mid.copy(a).add(b).add(c)) >= 0, 'every face turned outward');
    sum.add(n);
  }
  assert.ok(sum.length() < 1e-7, `closed (${sum.length().toExponential(1)})`);
  // its colours: mostly cyan (blue and green over red), a few lavender faces (the seam: red and blue over green)
  const K = one.attributes.color; let cyan = 0, lavender = 0;
  for (let i = 0; i < K.count; i += 3) { const r = K.getX(i), g = K.getY(i), bl = K.getZ(i); if (g > r && bl > r) cyan++; if (r > g && bl > g) lavender++; }
  assert.ok(cyan > lavender * 3 && lavender >= 2, `cyan faces (${cyan}) and the seam (${lavender})`);
  assert.ok(view0().material.uniforms.uGlow.value > 0.3, 'a soft light inside');
});

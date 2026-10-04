import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Ship } from '../src/ship/ship.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT } from '../src/levels/content.js';
import { game, GameState } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { createBoxes, migrateSave, resolvePlacement, placementsFor } from '../src/boxes/index.js';
import { BoxScene, STAND_AT, LIFT } from '../src/boxes/scene.js';
import { BOX, BOX_SCALE } from '../src/boxes/model.js';
import { DevMenu } from '../src/dev-menu.js';
import { bestInteractable, clearInteractables } from '../src/interact.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const worlds = new Map();
function world(id) {
  if (worlds.has(id)) return worlds.get(id);
  const meta = LEVELS.find((l) => l.id === id);
  const scene = new THREE.Scene();
  const level = quiet(() => meta.create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const w = { scene, level, physics };
  worlds.set(id, w);
  return w;
}
const ship = (id) => {
  const w = world(id);
  return (w.ship ??= quiet(() => new Ship({ scene: w.scene, physics: w.physics, level: w.level, levelId: id, content: CONTENT[id] })));
};
const player = (pos) => ({ pos: pos.clone(), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), quaternion: (h, q) => q.setFromAxisAngle(V(0, 1, 0), h) } });

/** Solid, walkable ground at p, with room to stand in front of the box and for it to rise. */
function reachable(physics, p, yaw, label) {
  const g = physics.groundAt(p.x, p.y + 1.5, p.z, 4);
  assert.ok(Number.isFinite(g) && Math.abs(g - p.y) < 0.7, `${label}: ground under the box (${g} vs ${p.y.toFixed(2)})`);
  const n = physics.groundNormal(p.x, p.y + 1, p.z);
  assert.ok(n.y > 0.8, `${label}: level enough (${n.y.toFixed(2)})`);
  const F = V(Math.sin(yaw), 0, Math.cos(yaw));
  const stand = p.clone().addScaledVector(F, STAND_AT);
  const gs = physics.groundAt(stand.x, p.y + 1.5, stand.z, 4);
  assert.ok(Number.isFinite(gs) && Math.abs(gs - p.y) < 0.8, `${label}: somewhere to stand in front (${gs} vs ${p.y.toFixed(2)})`);
  // head room over the box (it rises before it comes apart) and the standing spot
  const top = LIFT + (BOX.h + BOX.lid) * BOX_SCALE;
  for (const q of [p, stand]) assert.ok(physics.rayDistance(V(q.x, Math.max(g, gs) + 0.3, q.z), V(0, 1, 0), 2.2) > Math.max(1.9, top - 0.2), `${label}: room above`);
}

test('every placement stands on reachable ground, with room to stand and rise', () => {
  for (const [id, list] of Object.entries(PLACEMENTS)) {
    const { level, physics } = world(id);
    for (const p of list) {
      assert.ok(ITEMS[p.item], `${p.id}: a real item`);
      assert.ok(p.id.startsWith(`${id}.`), `${p.id}: named for its world`);
      const at = resolvePlacement(p, { physics, level });
      assert.ok(at, `${p.id}: resolves`);
      reachable(physics, at.pos.clone().setY(at.pos.y - (p.lift ?? 0)), at.yaw, p.id);
      const d = Math.hypot(at.pos.x - level.spawn.x, at.pos.z - level.spawn.z);
      assert.ok(d < 600, `${p.id}: within reach of the spawn (${d.toFixed(0)} m)`);
    }
  }
  // ids are unique across worlds
  const ids = Object.values(PLACEMENTS).flat().map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('the jetpack, glider, stun and fire unlocks each have a box; every special item too', () => {
  const where = Object.fromEntries(Object.values(PLACEMENTS).flat().map((p) => [p.item, p.id]));
  for (const id of Object.keys(ITEMS)) assert.ok(where[id], `${id} is in a box somewhere`);
  assert.match(where.jetpack, /^incal\./);
  assert.match(where.glider, /^arzach2?\./);
  assert.match(where.stun, /^(perdide|spheres)\./);
  assert.match(where.fire, /^(buried|desert)\./);
});

test('jetpack worlds without the jets get a box with them beside the ship', () => {
  game.reset();
  for (const id of ['garage', 'buried', 'bazaar']) {
    const { level, physics } = world(id);
    const list = placementsFor(id, { level });
    const fb = list.find((p) => p.item === 'jetpack');
    assert.ok(fb?.fallback, `${id}: a jetpack fallback`);
    assert.ok(list.find((p) => p.item === 'backpack')?.fallback, `${id}: and the backpack, which you don't have either`);
    const s = ship(id);
    for (const p of list.filter((x) => x.fallback)) {
      const at = resolvePlacement(p, { physics, level, anchor: s.arrivalSpot() });
      assert.ok(at, `${id}: ${p.item} fallback resolves`);
      assert.ok(at.pos.distanceTo(s.rampFoot) < 14, `${id}: next to the ramp`);
      reachable(physics, at.pos, at.yaw, `${id} ${p.item}`);
    }
  }
  // the City-Shaft has its own box; with the jets you get no fallback
  assert.ok(!placementsFor('incal', { level: world('incal').level }).some((p) => p.fallback && p.item === 'jetpack'));
  items.grant('jetpack');
  assert.ok(!placementsFor('garage', { level: world('garage').level }).some((p) => p.item === 'jetpack'));
  game.reset();
});

test('the desert backpack box sits in Qanat, under the Givers’ shrine by the well, on reachable ground', () => {
  const { physics, level } = world('desert');
  const C = level.qanat.city;
  const p = PLACEMENTS.desert.find((x) => x.item === 'backpack');
  assert.ok(!p.debris && p.beacon, 'no crash trail; a pale column over it');
  const at = resolvePlacement(p, { physics, level });
  assert.ok(at, 'resolves');
  // inside the walls, up on the top terrace at the burning tree's roots, beside the well
  assert.ok(Math.hypot(at.pos.x - C.center.x, at.pos.z - C.center.z) < 20, 'in the middle of the city');
  assert.ok(Math.abs(at.pos.y - C.top) < 0.2, `on the top terrace (${at.pos.y.toFixed(2)} vs ${C.top.toFixed(2)})`);
  assert.ok(at.pos.distanceTo(C.shrine.box) < 0.05, 'under the shrine');
  const dw = Math.hypot(at.pos.x - C.well.x, at.pos.z - C.well.z);
  assert.ok(dw > 3.5 && dw < 9, `beside the well (${dw.toFixed(1)} m)`);
  // the shrine's roof is over it, with head room for the opening scene
  assert.ok(physics.rayDistance(at.pos.clone().add(V(0, 0.5, 0)), V(0, 1, 0), 6) < 4, 'a roof overhead');
  reachable(physics, at.pos, at.yaw, 'desert.backpack');
  // its front faces the top of the main stairs, the way you come up from the gate
  const F = V(Math.sin(at.yaw), 0, Math.cos(at.yaw)), to = C.stairTop.clone().sub(at.pos).setY(0).normalize();
  assert.ok(F.dot(to) > 0.95, 'it faces the stairs');
  // on foot from the gate: up the avenue, the stairs, across the terrace to where you stand (no step over 0.62 m, no wall)
  const kneel = at.pos.clone().addScaledVector(F, STAND_AT);
  const route = [C.gate, C.plinthStair, C.stairTop, kneel];
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1], n = Math.ceil(a.distanceTo(b) / 0.5);
    let y = physics.groundAt(a.x, a.y + 1, a.z);
    const dir = b.clone().sub(a).setY(0).normalize();
    for (let k = 1; k <= n; k++) {
      const q = a.clone().lerp(b, k / n), g = physics.groundAt(q.x, y + 0.65, q.z);
      assert.ok(g > y - 3 && g - y < 0.62, `a step of ${(g - y).toFixed(2)} m at ${q.x.toFixed(1)},${q.z.toFixed(1)} (leg ${i})`);
      for (const h of [0.9, 1.6]) assert.ok(physics.rayDistance(V(q.x, g + h, q.z).addScaledVector(dir, -0.25), dir, 0.5) > 0.49, `a wall at ${q.x.toFixed(1)},${q.z.toFixed(1)}`);
      y = g;
    }
  }
  // open behind and to the right: the opening scene's two cameras see the traveller from there
  const S = V(Math.cos(at.yaw), 0, -Math.sin(at.yaw)), chest = kneel.clone().add(V(0, 0.95, 0)).addScaledVector(F, -0.15);
  for (const [label, cam] of [['right', at.pos.clone().addScaledVector(S, 2.7).add(V(0, 0.9, 0))], ['behind', at.pos.clone().addScaledVector(S, 0.66).addScaledVector(F, -2.25).add(V(0, 1.1, 0))]]) {
    const d = cam.distanceTo(chest);
    assert.ok(physics.rayDistance(chest, cam.clone().sub(chest).normalize(), d) >= d - 0.05, `the ${label} camera has a clear view`);
  }
});

test('a box opens through E and its scene, grants its item and stays open', () => {
  game.reset();
  clearInteractables();
  const { scene, physics, level } = world('desert');
  const s = ship('desert');
  const pl = player(s.rampFoot);
  const shots = [];
  const cam = { shot: (o) => shots.push(o), release: () => shots.push('release'), hud() {}, bars() {} };
  const opened = [];
  game.on('box:opened', (e) => opened.push(e));
  const boxes = createBoxes({ levelId: 'desert', scene, physics, level, player: pl, cam, anchor: s.arrivalSpot() });
  const box = boxes.list.find((b) => b.item === 'backpack');
  assert.ok(box && !box.spent(), 'the backpack box, closed');
  assert.ok(box.parts.carve && box.parts.mats.carve, 'carved with the glyph');
  // it reacts as you come close: light, seam, star
  pl.pos.copy(box.pos).add(V(10, 0, 0));
  boxes.update(1 / 30, 1);
  const far = box.light.w;
  pl.pos.copy(box.pos).add(V(2, 0, 0));
  boxes.update(1 / 30, 1.1);
  assert.ok(box.light.w > far && box.parts.mats.seam.uniforms.uGlow.value > 0, 'it glows as you approach');
  assert.ok(box.parts.mats.carve.uniforms.uGlow.value > 0.2, 'its carvings wake');
  // E: "open"
  const e = bestInteractable(pl);
  assert.equal(e?.entry.id, `box.${box.id}`);
  assert.equal(e.entry.prompt, 'open');
  e.entry.use(pl);
  assert.ok(boxes.busy(), 'the scene plays');
  assert.ok(Math.abs(pl.pos.distanceTo(box.pos) - STAND_AT) < 0.3, 'the traveller is set before the box');
  for (let i = 0; i < 30 * 2.2; i++) boxes.update(1 / 30, 2 + i / 30);
  assert.ok(box.parts.root.position.y > box.pos.y + LIFT * 0.6, 'it lifts off the ground');
  for (let i = 0; i < 30 * 4; i++) boxes.update(1 / 30, 4.2 + i / 30);
  assert.equal(boxes.scene.phase, 'card', 'the card waits');
  assert.equal(box.parts.mats.body.uniforms.uDissolve.value.x, 1, 'the box has come apart');
  assert.ok(boxes.scene.model.visible && boxes.scene.model.position.distanceTo(box.pos) > LIFT, 'the item hangs where it was');
  assert.ok(box.sceneLight > 0.9, 'light pours out');
  assert.ok(shots.length > 100 && shots.at(-1).pos, 'the camera is the scene’s');
  assert.equal(items.has('backpack'), false, 'not yours until you press on');
  assert.equal(boxes.dismiss(), true);
  for (let i = 0; i < 60; i++) boxes.update(1 / 30, 9 + i / 30);
  assert.ok(!boxes.busy(), 'over');
  assert.ok(shots.includes('release'), 'the camera goes back');
  assert.equal(items.has('backpack'), true, 'granted');
  assert.equal(game.flag(`box.${box.id}`), true, 'persisted');
  assert.deepEqual(opened.map((o) => o.id), [box.id]);
  assert.ok(box.spent() && !box.parts.root.visible && !box.collider, 'gone for good, nothing left to bump into');
  assert.equal(bestInteractable(pl)?.entry.id === `box.${box.id}`, false, 'nothing to open any more');
  // a fresh load: still open
  boxes.dispose();
  const again = createBoxes({ levelId: 'desert', scene, physics, level, player: pl, anchor: s.arrivalSpot() });
  assert.ok(again.list.find((b) => b.id === box.id).spent());
  // skip: straight to the card, then past it
  const star = again.list.find((b) => b.item === 'star');
  pl.pos.copy(star.pos).add(V(1, 0, 0));
  again.open(star.id);
  again.update(1 / 30, 0);
  again.skip();
  assert.equal(again.scene.phase, 'card');
  again.skip();
  for (let i = 0; i < 60; i++) again.update(1 / 30, i / 30);
  assert.ok(!again.busy() && items.has('star'));
  // instant (the dev menu)
  again.reset();
  items.revoke('star');
  assert.ok(!again.list.find((b) => b.id === star.id).spent());
  again.open(star.id, { instant: true });
  assert.ok(items.has('star') && game.flag(`box.${star.id}`));
  again.dispose();
  clearInteractables();
  game.reset();
});

test('the scene never traps: an error ends it and still grants the item', () => {
  game.reset();
  const parts = { lid: { rotation: { x: 0 } }, rays: { visible: false, children: [], rotation: {} }, glowFloor: { visible: false } };
  let granted = 0, ended = 0;
  const sc = new BoxScene({ box: { pos: V(), yaw: 0, parts, scene: null }, def: ITEMS.lens, item: 'lens', player: null, onGrant: () => granted++, onEnd: () => ended++ });
  sc.start();
  sc.box.parts = null;   // break it
  quiet(() => sc.update(1 / 30));
  assert.ok(sc.done && granted === 1 && ended === 1);
});

test('old saves that finished the prologue keep the backpack; new games start without it', () => {
  const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
  const old = new GameState(store());
  old.set('prologue.done', true); old.set('quest.desert.power', 'speaker'); old.set('item.jar', 1);
  assert.equal(migrateSave(old), true);
  assert.equal(old.flag('item.backpack'), true);
  assert.equal(old.flag('box.desert.backpack'), true, 'the shrine’s box is theirs already (open, counted as found)');
  assert.equal(migrateSave(old), false, 'once');
  // a save from the crash-site box days (items.v 1, the backpack found): the shrine shows it open too
  const v1 = new GameState(store());
  v1.set('prologue.done', true); v1.set('items.v', 1); v1.set('item.backpack', true);
  assert.equal(migrateSave(v1), false);
  assert.equal(v1.flag('box.desert.backpack'), true);
  assert.equal(v1.flag('items.v'), 2);
  // a new game: not yet through the prologue
  const fresh = new GameState(store());
  assert.equal(migrateSave(fresh), false);
  assert.equal(fresh.flag('item.backpack'), undefined);
  assert.equal(fresh.flag('box.desert.backpack'), undefined, 'the shrine’s box waits for them');
  // ...and it stays without after the prologue ends (the migration is spent)
  fresh.set('prologue.done', true);
  assert.equal(migrateSave(fresh), false);
  assert.equal(fresh.flag('item.backpack'), undefined);
  // someone who already has items (a newer save) is left alone
  const newer = new GameState(store());
  newer.set('prologue.done', true); newer.set('item.backpack', false);
  assert.equal(migrateSave(newer), false);
});

test('the dev menu grants and revokes items, all and none', () => {
  game.reset();
  const dev = new DevMenu({ levelId: 'desert' });
  dev.setItem('glider', true);
  assert.equal(items.has('glider'), true);
  dev.setItem('glider', false);
  assert.equal(items.has('glider'), false);
  dev.allItems();
  assert.deepEqual(items.owned().sort(), Object.keys(ITEMS).sort());
  dev.noItems();
  assert.deepEqual(items.owned(), []);
  dev.setFlag('prologue.done', true);
  assert.equal(game.flag('prologue.done'), true);
  game.reset();
});

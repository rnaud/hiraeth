import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';   // (the gadgets as items: the makers' courts' boxes hold them)
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Ship } from '../src/ship/ship.js';
import { buildableById } from '../src/levels/buildable.js';
import { partOf } from '../src/levels/names.js';
import { templeOf } from '../src/temples/index.js';
import { CONTENT } from '../src/levels/content.js';
import { game, GameState } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { createBoxes, migrateSave, resolvePlacement, placementsFor, boxesFound, BOX_QUEST_DELAY, shiftPlacement } from '../src/boxes/index.js';
import { Quests } from '../src/story/quests.js';
import { BoxScene, STAND_AT, LIFT, TIMES, WOBBLES, wobbleAngle } from '../src/boxes/scene.js';
import { BOX, BOX_SCALE, buildBox, roundedBox, chestKind } from '../src/boxes/model.js';
import { chestGeometry, TEMPLE_CHEST } from '../src/boxes/chest.js';
import { makeMaterial } from '../src/materials.js';
import { gearHtml } from '../src/items.js';
import { DevMenu } from '../src/dev-menu.js';
import { bestInteractable, clearInteractables } from '../src/interact.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const worlds = new Map();
function world(id) {
  if (worlds.has(id)) return worlds.get(id);
  const meta = buildableById(id);   // (a level, a merged world's part on its own, a dismissed world: src/levels/buildable.js)
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
  // (a merged world's part's boxes in the merged world, where they are placed, measured from the part's own landing;
  // the Glass Dunes' Clock-House boxes keep the temple's 'garage.' ids, as the saves know them)
  for (const [id, list] of Object.entries(PLACEMENTS)) {
    const { level, physics } = world(partOf(id));
    const home = level.partSpawns?.[id] ?? level.spawn;
    for (const raw of list) {
      const p = shiftPlacement(id, raw);
      assert.ok(ITEMS[p.item], `${p.id}: a real item`);
      assert.ok(p.id.startsWith(`${id}.`) || (id === 'glassdunes' && p.id.startsWith('garage.')), `${p.id}: named for its world`);
      const at = resolvePlacement(p, { physics, level });
      assert.ok(at, `${p.id}: resolves`);
      reachable(physics, at.pos.clone().setY(at.pos.y - (p.lift ?? 0)), at.yaw, p.id);
      // (a temple's chest by its door: the rooms lie off the map, reached through it)
      const door = p.temple ? templeOf(level, p.temple)?.outside?.door?.at : null;
      const d = Math.min(...[at.pos, door].filter(Boolean).map((q) => Math.hypot(q.x - home.x, q.z - home.z)));
      if (!p.story) assert.ok(d < 600, `${p.id}: within reach of the spawn (${d.toFixed(0)} m)`);   // (the story's interiors are built far off, through their doors)
    }
  }
  // ids are unique across worlds
  const ids = Object.values(PLACEMENTS).flat().map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('the jetpack, glider, stun and fire unlocks each have a box; every special item too', () => {
  const where = Object.fromEntries(Object.values(PLACEMENTS).flat().flatMap((p) => [[p.item, p.id], ...(ITEMS[p.item]?.with ?? []).map((w) => [w, p.id])]));   // (what comes with an item is in its box: the gun's ember mode)
  for (const id of Object.keys(ITEMS)) if (!ITEMS[id].quest && !ITEMS[id].trial && !ITEMS[id].debug && !ITEMS[id].retired && !ITEMS[id].fragments) assert.ok(where[id], `${id} is in a box somewhere`);   // (a trial's reward is won: src/trials/; a retired one, kept for the saves that won it, is nowhere now; the scientist fits his for the fragments of the singing light: src/story/scientist.js)
  assert.ok(!where.cabpass, 'the cab pass is a quest’s, not a box’s');
  assert.match(where.wardenbellows, /^incal\./, 'the Warden’s bellows in the City-Shaft (the jets anywhere are a debug item: no box)');
  assert.equal(where.jetpack, undefined);
  assert.match(where.glider, /^arzach2?\./);
  assert.match(where.stun, /^(perdide|spheres)\./);
  assert.match(where.fire, /^(buried|desert)\./);
});

test('worlds after the desert give a box of what the route brought by the ship to a save without it; never the debug jets', () => {
  game.reset();
  for (const id of ['glassdunes', 'buried', 'bazaar']) {
    const { level, physics } = world(id);
    const list = placementsFor(id, { level });
    assert.ok(!list.some((p) => p.item === 'jetpack'), `${id}: no jets (a debug item since v1.38)`);
    for (const it of ['backpack', 'doublejump', 'gun']) assert.ok(list.find((p) => p.item === it)?.fallback, `${id}: the ${it}, which you don't have either`);
    const s = ship(id), at = new Set();
    for (const p of list.filter((x) => x.fallback)) {
      const spot = resolvePlacement(p, { physics, level, anchor: s.arrivalSpot() });
      assert.ok(spot, `${id}: ${p.item} fallback resolves`);
      assert.ok(spot.pos.distanceTo(s.rampFoot) < 16, `${id}: next to the ramp`);
      for (const q of at) assert.ok(q.distanceTo(spot.pos) > 1.5, `${id}: ${p.item}'s box apart from the others`);
      at.add(spot.pos);
      reachable(physics, spot.pos, spot.yaw, `${id} ${p.item}`);
    }
  }
  game.reset();
});

test('a run never lands beside free chests: the desert done and the Rose House skipped, nothing by the ship in Vael (issue #91)', () => {
  // (the desert's main quest gives the backpack, the lift valve and the gun before the ship flies: src/story/desert.js)
  const run = new Set(['backpack', 'doublejump', 'gun']);
  for (const id of ['arzach', 'perdide', 'edena', 'incal']) {
    const list = placementsFor(id, { has: (it) => run.has(it) });
    assert.deepEqual(list.filter((p) => p.fallback).map((p) => p.item), [], `${id}: no fallback box`);
    assert.ok(!list.some((p) => p.near === 'ship'), `${id}: no box by the ship`);
  }
  // the blade and the guard wait in the Rose House, never by the ship, even for a save with nothing at all
  const bare = placementsFor('arzach', { has: () => false });
  assert.ok(!bare.some((p) => p.fallback && (p.item === 'sword' || p.item === 'shield')), 'no blade or guard by the ship');
  assert.ok(PLACEMENTS.desert.some((p) => p.item === 'sword' && p.temple) && PLACEMENTS.desert.some((p) => p.item === 'shield' && p.temple), 'both in the house');
});

test('the desert backpack box is a temple chest on the makers’ dais at the burning tree’s foot: on the ground, in sight from the avenue, nothing round it (issue #140)', () => {
  const { physics, level } = world('desert');
  const C = level.qanat.city, L = C.shrine;
  const p = PLACEMENTS.desert.find((x) => x.item === 'backpack');
  assert.equal(p.id, 'desert.backpack', 'the same id: a save that opened it keeps it opened');
  assert.ok(!p.debris && p.beacon, 'no crash trail; a pale column over it');
  // the temples' own chest: the same model, the same opening
  assert.equal(chestKind(p), 'temple', 'the temple chest');
  const model = buildBox(p.id, { kind: chestKind(p) });
  assert.equal(model.kind, 'temple');
  assert.equal(model.shell.geometry, chestGeometry('temple').closed, 'the one temple chest model');
  const sword = PLACEMENTS.desert.find((x) => x.id === 'desert.temple.sword');
  assert.equal(buildBox(sword.id, { kind: chestKind(sword) }).shell.geometry, model.shell.geometry, 'exactly the Givers’ House’s chest');
  const at = resolvePlacement(p, { physics, level });
  assert.ok(at, 'resolves');
  assert.ok(at.pos.distanceTo(L.box) < 0.05, 'on the dais');
  // on the ground: the dais's top, three steps up from the square (no ledge, no climb; issue #160: it was two)
  const rise = at.pos.y - C.top;
  assert.ok(rise > 0.8 && rise < 1.0, `on the dais on the square (${rise.toFixed(2)} m up)`);
  const g = physics.groundAt(at.pos.x, at.pos.y + 1, at.pos.z, 2);
  assert.ok(Math.abs(g - at.pos.y) < 0.03, 'the dais holds it');
  // at the tree's foot, left of the trunk from the avenue, in the middle of the city
  assert.ok(Math.hypot(at.pos.x - C.center.x, at.pos.z - C.center.z) < 20, 'in the middle of the city');
  const dt = Math.hypot(at.pos.x - C.treeBase.x, at.pos.z - C.treeBase.z);
  assert.ok(dt > 7 && dt < 13.5, `at the tree’s foot (${dt.toFixed(1)} m from its axis; the mound of issue #162 stands wider)`);
  const dr = Math.hypot(at.pos.x - C.roots.x, at.pos.z - C.roots.z);
  assert.ok(dr > 3.5 && dr < 12, `beside the roots the water climbs (${dr.toFixed(1)} m)`);
  // open sky over it (the light, the beacon, room for the opening scene) and somewhere to stand in front
  assert.equal(physics.rayDistance(at.pos.clone().add(V(0, 0.5, 0)), V(0, 1, 0), 12), Infinity, 'open sky over it');
  reachable(physics, at.pos, at.yaw, 'desert.backpack');
  // nothing round it within 3 m at a body's height but the dais it stands on (the author's rule, issue #81)
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, d = V(Math.sin(a), 0, Math.cos(a));
    for (const h of [0.25, 0.85, 1.55]) assert.equal(physics.rayDistance(V(at.pos.x, at.pos.y + h, at.pos.z), d, 3), Infinity, `clear round it (${(a * 180 / Math.PI).toFixed(0)}° at ${h} m over the dais)`);
  }
  // the bark behind it, the chest facing out of the tree toward the avenue's end
  const F = V(Math.sin(at.yaw), 0, Math.cos(at.yaw));
  const out = at.pos.clone().sub(C.treeBase).setY(0).normalize();
  assert.ok(F.dot(out) > 0.5, 'it faces out from the trunk');
  assert.ok(physics.rayDistance(V(at.pos.x, C.top + 1, at.pos.z), out.clone().negate(), 8) < 8, 'the bark behind it (past the mound’s foot: issue #162)');
  const toAvenue = C.plinthStair.clone().sub(at.pos).setY(0).normalize();
  assert.ok(F.dot(toAvenue) > 0.95, 'it faces the way you come up the avenue');
  // in sight all the way up the avenue: from the gate, the avenue's end and the square before the trunk
  for (const [name, q] of [['the gate', C.gate], ['the avenue’s end', C.plinthStair], ['the square', C.stairTop]]) {
    const eye = q.clone().setY(physics.groundAt(q.x, q.y + 2, q.z) + 1.6), lid = at.pos.clone().add(V(0, 0.8, 0)), d = eye.distanceTo(lid);
    assert.ok(physics.rayDistance(eye, lid.clone().sub(eye).normalize(), d) > d - 0.2, `seen from ${name}`);
  }
  // on foot from the gate: up the avenue, across the square, up the dais's three steps to the chest (no step over 0.62 m, no wall)
  const route = [C.gate, C.plinthStair, C.stairTop, L.foot, at.pos.clone().addScaledVector(F, 0.9)];
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1], n = Math.ceil(a.distanceTo(b) / 0.5);
    let y = physics.groundAt(a.x, a.y + 1, a.z);
    const dir = b.clone().sub(a).setY(0).normalize();
    for (let k = 1; k <= n; k++) {
      const q = a.clone().lerp(b, k / n), gq = physics.groundAt(q.x, y + 0.65, q.z);
      assert.ok(gq > y - 3 && gq - y < 0.62, `a step of ${(gq - y).toFixed(2)} m at ${q.x.toFixed(1)},${q.z.toFixed(1)} (leg ${i})`);
      for (const h of [0.9, 1.6]) assert.ok(physics.rayDistance(V(q.x, gq + h, q.z).addScaledVector(dir, -0.25), dir, 0.5) > 0.49, `a wall at ${q.x.toFixed(1)},${q.z.toFixed(1)}`);
      y = gq;
    }
  }
  // walked there: the traveller walks from the square up onto the dais, in front of the chest
  {
    const P = new Player(physics, { health: false });
    P.pos.copy(L.foot); P.heading = at.yaw + Math.PI; P.onGround = true;
    const camYaw = Math.atan2(F.x, F.z);   // W walks toward -F: to the chest
    let onDais = false, climbed = false;
    for (let i = 0; i < 60 * 6 && !onDais; i++) {
      quiet(() => P.update(1 / 60, { KeyW: true }, camYaw));
      climbed ||= P.climbing;
      onDais = P.onGround && Math.abs(P.pos.y - L.dais.y) < 0.1;
    }
    assert.ok(onDais, `up its steps onto the dais (${P.pos.y.toFixed(2)} vs ${L.dais.y.toFixed(2)})`);
    assert.ok(!climbed, 'walked, not climbed');
  }
  // the opening scene there: every shot sees the traveller and the chest, from the open air
  game.reset();
  clearInteractables();
  const shots = [];
  const cam = { shot: (o) => shots.push(o), release() {}, hud() {}, bars() {} };
  const pl = player(at.pos.clone().addScaledVector(F, 1.6));
  const boxes = createBoxes({ levelId: 'desert', scene: world('desert').scene, physics, level, player: pl, cam });
  const box = boxes.list.find((b) => b.item === 'backpack');
  boxes.open(box.id);
  for (let i = 0; i < 30 * 7; i++) boxes.update(1 / 30, i / 30);
  const real = shots.filter((s) => s.pos);
  assert.ok(real.length > 100, 'the scene films it');
  const chest = at.pos.clone().addScaledVector(F, STAND_AT).add(V(0, 1.3, 0));
  for (const s of real.filter((_, i) => i % 10 === 0)) {
    const d = s.pos.distanceTo(chest);
    assert.ok(physics.rayDistance(chest, s.pos.clone().sub(chest).normalize(), d) >= d - 0.05, 'a clear view of the traveller');
    assert.ok(!physics.embedded(s.pos), 'the lens is in the open');
    assert.ok(s.pos.y > C.top + 0.5 && s.pos.y < C.top + 12 * 1.45, 'by the dais, under the flame');
  }
  boxes.dispose();
  clearInteractables();
  game.reset();
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
  const A = box.parts.mats.body.uniforms.uBoxA.value;
  assert.ok(box.parts.shell && A, 'one shell, marked and lit by its own shader');
  // it reacts as you come close: light, the marks, the ray
  pl.pos.copy(box.pos).add(V(30, 0, 0));
  boxes.update(1 / 30, 1);
  const far = box.light.w, farRay = A.x, c0 = A.w;
  boxes.update(1 / 30, 1.03);
  const farStep = A.w - c0;
  pl.pos.copy(box.pos).add(V(2, 0, 0));
  boxes.update(1 / 30, 1.1);
  const c1 = A.w;
  boxes.update(1 / 30, 1.13);
  assert.ok(box.light.w > far && A.x > farRay, 'it glows as you approach, its ray brighter');
  assert.ok(A.w - c1 > farStep * 1.3, 'the ray crosses it more often close up');
  assert.ok(A.y > 0.5, 'its star and glyphs wake');
  // E: "open"
  const e = bestInteractable(pl);
  assert.equal(e?.entry.id, `box.${box.id}`);
  assert.equal(e.entry.prompt, 'open');
  e.entry.use(pl);
  assert.ok(boxes.busy(), 'the scene plays');
  assert.ok(Math.abs(pl.pos.distanceTo(box.pos) - STAND_AT) < 0.3, 'the traveller is set before the box');
  for (let i = 0; i < 30 * 2.2; i++) boxes.update(1 / 30, 2 + i / 30);
  // (issue #223: it no longer floats up; it rocks on its foot where it stands)
  assert.ok(Math.abs(box.parts.root.position.y - box.pos.y) < 0.15, `it stays on the ground (${(box.parts.root.position.y - box.pos.y).toFixed(2)} m)`);
  for (let i = 0; i < 30 * 6.8; i++) boxes.update(1 / 30, 4.2 + i / 30);
  assert.equal(boxes.scene.phase, 'card', 'the card waits');
  assert.ok(box.parts.mats.body.uniforms.uDissolve.value.x === 0 && box.parts.opened.visible && !box.parts.shell.visible, 'it has opened where it stands, nothing come apart');
  assert.ok(boxes.scene.light.visible && boxes.scene.lightK > 0.4, 'light pours up out of it');
  assert.ok(pl.offer?.k > 0.99, 'he holds his hand out');
  assert.ok(boxes.scene.model.visible && boxes.scene.model.position.distanceTo(boxes.scene.handAt()) < 0.1, 'the item floats over his open hand');
  assert.ok(boxes.scene.model.position.y - pl.pos.y > 0.9 && boxes.scene.model.position.y - pl.pos.y < 1.5, 'at about his waist, a little over the palm');
  assert.ok(box.sceneLight > 0.9, 'light pours out');
  assert.ok(shots.length > 100 && shots.at(-1).pos, 'the camera is the scene’s');
  // one continuous camera: the reveal pushes in from the first angle, no jump between frames (the cinematics QC pass)
  const real = shots.filter((o) => o.pos);
  const step = Math.max(...real.slice(1).map((o, i) => o.pos.distanceTo(real[i].pos)));
  assert.ok(step < 0.25, `no jump in the camera (largest step ${step.toFixed(2)} m)`);
  assert.equal(items.has('backpack'), false, 'not yours until you press on');
  // (the author's playthrough, issue #58: the tank came out of the chest full when it is empty)
  assert.equal(boxes.scene.fill, 0, 'the backpack comes out of the city’s chest dry, as it will be on his back');
  assert.ok(boxes.scene.fluid.length && boxes.scene.fluid.every((m) => m.uniforms.uFluidA.value.x === 0), 'its glass drawn empty');
  assert.equal(boxes.dismiss(), true);
  // (no beat for the backpack: it is on his back from the card on; nothing flies off and shrinks, issue #58)
  assert.equal(boxes.scene.phase, 'out', 'no closing beat for the backpack: he wears it');
  assert.equal(items.has('backpack'), true, 'granted as the card goes');
  assert.equal(boxes.scene.model.visible, false, 'the hovering one gone, not flying into him and shrinking');
  for (let i = 0; i < 30 * 3.5; i++) boxes.update(1 / 30, 9 + i / 30);
  assert.ok(!boxes.busy(), 'over');
  assert.ok(shots.includes('release'), 'the camera goes back');
  assert.equal(items.has('backpack'), true, 'granted');
  assert.equal(game.flag(`box.${box.id}`), true, 'persisted');
  assert.deepEqual(opened.map((o) => o.id), [box.id]);
  assert.ok(box.spent() && box.parts.root.visible && box.parts.opened.visible && !box.collider, 'it stays where it stood, open (no block where its halves part)');
  assert.ok(Math.abs(box.parts.root.position.y - box.pos.y) < 1e-6 && !pl.offer, 'set down square, his hand let go');
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
  const parts = { mats: {} };
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

test('every hidden box has a quest that says where to look; it starts on arrival and ends when the box opens', () => {
  for (const [id, list] of Object.entries(PLACEMENTS)) for (const p of list) {
    if (p.id === 'desert.backpack' || p.story) continue;   // (the story's own)
    if (p.temple) { assert.ok(!p.hint, `${p.id}: a temple's chest has no quest of its own (the temple's leads there)`); continue; }
    assert.ok(p.hint && p.hint.length > 20 && !/\*/.test(p.hint), `${p.id}: a plain hint`);
  }
  game.reset(); clearInteractables();
  const { scene, physics, level } = world('edena');
  const quests = new Quests({ game });
  const toasts = [];
  const pl = player(level.spawn);
  game.set('box.desert.backpack', true);   // (box quests come once you have found a box: the next test)
  const boxes = createBoxes({ levelId: 'edena', scene, physics, level, player: pl, quests, toast: (t) => toasts.push(t) });
  const [qid] = boxes.quests;
  assert.equal(qid, 'box.edena.pouch');   // (the canopy's box: the lantern moved into Lorn II's temple, src/temples/)
  assert.equal(quests.isStarted(qid), false, 'not straight away');
  for (let i = 0; i < 30 * (BOX_QUEST_DELAY + 1); i++) boxes.update(1 / 30, i / 30);
  assert.equal(quests.isActive(qid), true, 'started after the landing');
  assert.deepEqual(toasts, [], 'hints subtle: no nudge toward the Quests page (hints full says where to look: src/hint-level.js tip)');
  assert.ok(quests.journalHtml().includes('umbrella tree'), 'the sketchbook says where');
  boxes.open('edena.pouch', { instant: true });
  quests.update(pl);   // (the story runtime does this every frame)
  assert.equal(quests.isDone(qid), true, 'opening the box finishes it');
  boxes.dispose(); clearInteractables(); game.reset(); items.revoke('pouch');
});

test('a rounded box (the small items’ slabs) has no edges: one closed smooth shell', () => {
  const g = roundedBox(0.33, 0.27, 0.29, 0.15);
  const p = g.attributes.position, n = g.attributes.normal;
  g.computeBoundingBox();
  assert.ok(Math.abs(g.boundingBox.max.x - 0.33) < 1e-3 && Math.abs(g.boundingBox.max.y - 0.27) < 1e-3, 'its size');
  const idx = g.index.array, faceN = [], edges = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    a.fromBufferAttribute(p, idx[i]); b.fromBufferAttribute(p, idx[i + 1]); c.fromBufferAttribute(p, idx[i + 2]);
    faceN.push(new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize());
    for (const [u, v] of [[idx[i], idx[i + 1]], [idx[i + 1], idx[i + 2]], [idx[i + 2], idx[i]]]) {
      const k = Math.min(u, v) + ',' + Math.max(u, v);
      (edges.get(k) ?? edges.set(k, []).get(k)).push(i / 3);
    }
  }
  let worst = 1;
  for (const f of edges.values()) { assert.equal(f.length, 2, 'closed: every edge between two faces'); worst = Math.min(worst, faceN[f[0]].dot(faceN[f[1]])); }
  assert.ok(worst > 0.9, `no hard edge (the sharpest bend between faces: ${(Math.acos(worst) * 180 / Math.PI).toFixed(1)}°)`);
  for (let i = 0; i < n.count; i++) assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n, i).length() - 1) < 1e-3);
});

test('one chest for every world: the makers’ everywhere, the temple chest in the temples and the desert’s first, nothing by the world', () => {
  const seen = { makers: 0, temple: 0 };
  for (const [world, list] of Object.entries(PLACEMENTS)) {
    for (const p of list) {
      const kind = chestKind(p);
      assert.equal(kind, p.temple || p.chest === 'temple' ? 'temple' : 'makers', `${world} ${p.id}: its kind by what it is, not where`);
      const box = buildBox(p.id, { kind });
      assert.equal(box.kind, kind);
      assert.equal(box.shell.geometry, chestGeometry(kind).closed, `${p.id}: the one shared model of its kind`);
      seen[kind]++;
    }
  }
  assert.ok(seen.makers > 20 && seen.temple >= 8, `both kinds placed (${seen.makers} makers’, ${seen.temple} temple chests)`);
  // the two models: the makers’ hip high and wider than tall, the temple’s bud taller than wide
  const M = chestGeometry('makers'), T = chestGeometry('temple');
  M.closed.computeBoundingBox(); T.closed.computeBoundingBox();
  const mb = M.closed.boundingBox, tb = T.closed.boundingBox;
  assert.ok(mb.max.x - mb.min.x > mb.max.y - mb.min.y, 'the makers’ chest is wider than tall');
  assert.ok(Math.abs(mb.max.y - BOX.h) < 0.01 && Math.abs(mb.min.y) < 0.01, 'standing on the ground, BOX tall');
  assert.ok(mb.max.z > BOX.d / 2 + 0.02, 'its lens stands out of its front');
  assert.ok(Math.abs(tb.max.y - TEMPLE_CHEST.h) < 0.01 && tb.max.y - tb.min.y > tb.max.x - tb.min.x, 'the temple’s bud taller than wide');
  // every vertex coloured, normals unit; the jade a light (a colour over 1), the shell not
  for (const g of [M.closed, T.closed]) {
    const n = g.attributes.normal, c = g.attributes.color;
    assert.ok(c && c.count === g.attributes.position.count && !g.attributes.uv, 'vertex colours, no uv');
    let lights = 0;
    for (let i = 0; i < n.count; i++) {
      assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n, i).length() - 1) < 1e-3, 'unit normals');
      if (Math.max(c.getX(i), c.getY(i), c.getZ(i)) > 1) lights++;
    }
    assert.ok(lights > 50 && lights < n.count / 2, `some of it a light (${lights} of ${n.count})`);
  }
});

test('the chests add no shader program: one mesh closed, one material, the old box’s program', () => {
  // the program the old blue box compiled (MAKERS_BOX and DISSOLVE): the chests' material keys the same one
  const old = makeMaterial({ color: '#25386c', key: 'test.old-box', dissolve: '#fff4d6', makersBox: { half: [0.6, 0.5, 0.55], center: 0.5 } });
  for (const kind of ['makers', 'temple']) {
    const box = buildBox(`t.${kind}`, { kind });
    const m = box.mats.body;
    assert.deepEqual(Object.keys(m.defines).sort(), Object.keys(old.defines).sort(), `${kind}: the same defines as the old box`);
    assert.equal(m.side, old.side);
    assert.equal(m.userData.sharesProgram, true, 'its vertex colours don’t split the program (scripts/three-program-keys.mjs)');
    assert.equal(m.vertexShader, old.vertexShader); assert.equal(m.fragmentShader, old.fragmentShader);
    const meshes = []; box.root.traverse((o) => { if (o.isMesh) meshes.push(o); });
    assert.ok(meshes.every((o) => o.material === m), 'all its parts in its one material');
    const visible = meshes.filter((o) => { let v = true; o.traverseAncestors((a) => { v &&= a.visible; }); return v && o.visible; });
    assert.deepEqual(visible, [box.shell], 'closed: one mesh, one draw');
    assert.notEqual(buildBox(`u.${kind}`, { kind }).mats.body, m, 'each chest its own material (each sweeps and glows on its own)');
  }
});

test('a chest opens in stages: its halves part like petals, the temple’s bud like a flower, its heart rising', () => {
  for (const [kind, n] of [['makers', 2], ['temple', TEMPLE_CHEST.petals]]) {
    const box = buildBox(`o.${kind}`, { kind });
    assert.equal(box.petals.length, n, `${kind}: ${n} petals`);
    box.setOpen(0.5);
    assert.ok(!box.shell.visible && box.opened.visible, 'opening: the parts in place of the shell');
    const half = box.petals.map((p) => 2 * Math.acos(Math.min(1, Math.abs(p.pivot.quaternion.w))));
    box.setOpen(1);
    const full = box.petals.map((p) => 2 * Math.acos(Math.min(1, Math.abs(p.pivot.quaternion.w))));
    for (let i = 0; i < n; i++) assert.ok(half[i] > 0.2 && full[i] > half[i] && full[i] > 1.4, `petal ${i} swings out (${full[i].toFixed(2)} rad)`);
    // each petal's top goes outward and down, away from the middle
    for (const p of box.petals) {
      const tip = new THREE.Vector3(0, box.size.h, 0).sub(p.pivot.position).applyQuaternion(p.pivot.quaternion).add(p.pivot.position);
      assert.ok(Math.hypot(tip.x, tip.z) > Math.hypot(p.pivot.position.x, p.pivot.position.z) - 1e-6, 'outward');
    }
    if (kind === 'temple') assert.ok(box.core.scale.x < 0.01 && box.core.position.y > TEMPLE_CHEST.h * 0.42, 'its heart has risen and given itself to the item');
    box.setOpen(0);
    assert.ok(box.shell.visible && !box.opened.visible, 'shut again: the one shell');
  }
});

test('opening: on the ground, it rocks two or three times with rests between, then opens where it stands (issue #223)', () => {
  // the wobbles: two or three, each a rock both ways that settles, with still rests between them
  assert.ok(WOBBLES.length >= 2 && WOBBLES.length <= 3);
  for (let i = 0; i < WOBBLES.length; i++) {
    const w = WOBBLES[i];
    let lo = 0, hi = 0;
    for (let u = 0; u <= w.dur; u += 0.005) { lo = Math.min(lo, wobbleAngle(w, u)); hi = Math.max(hi, wobbleAngle(w, u)); }
    assert.ok(lo < -0.05 && hi > 0.05, `wobble ${i} rocks both ways`);
    assert.ok(Math.max(hi, -lo) < 0.35, `slightly (${Math.max(hi, -lo).toFixed(2)} rad)`);
    assert.ok(Math.abs(wobbleAngle(w, w.dur * 0.999)) < 0.01, 'and settles');
    if (i) assert.ok(w.at - (WOBBLES[i - 1].at + WOBBLES[i - 1].dur) > 0.25, 'a rest before it');
  }
  const last = WOBBLES.at(-1);
  assert.ok(TIMES.wobble - (last.at + last.dur) > 0.2, 'a still moment before it opens');
  // in a scene: on the ground all through the wobbles, never into it, a knock each time, then it opens
  game.reset(); clearInteractables();
  const { scene, physics, level } = world('desert');
  const knocks = [];
  const sound = { boxWobble: (i) => knocks.push(i) };
  const boxes = createBoxes({ levelId: 'desert', scene, physics, level, player: player(V()), sound });
  const box = boxes.list.find((b) => b.item === 'star');
  boxes.open(box.id);
  const seen = { leanMax: 0, restFrames: 0, minLift: Infinity, phases: [] };
  for (let i = 0; i < 30 * 12 && boxes.busy(); i++) {
    boxes.update(1 / 30, i / 30);
    const sc = boxes.scene;
    if (!sc) break;
    if (seen.phases.at(-1) !== sc.phase) seen.phases.push(sc.phase);
    if (sc.phase === 'wobble') {
      seen.leanMax = Math.max(seen.leanMax, Math.abs(sc.lean));
      if (sc.lean === 0) seen.restFrames++;
      seen.minLift = Math.min(seen.minLift, box.parts.root.position.y - box.pos.y);
      seen.maxLift = Math.max(seen.maxLift ?? -Infinity, box.parts.root.position.y - box.pos.y);
    }
    if (sc.phase === 'card') boxes.dismiss();
  }
  assert.deepEqual(seen.phases.slice(0, 6), ['approach', 'wake', 'rise', 'wobble', 'dissolve', 'reveal']);
  assert.ok(seen.leanMax > 0.1, 'it rocks');
  assert.ok(seen.restFrames > 10, 'and rests between');
  assert.ok(seen.minLift > -0.01 && seen.maxLift < 0.15, `on the ground all the while, rocking on its foot (${seen.minLift.toFixed(3)}..${seen.maxLift.toFixed(3)} m)`);
  assert.equal(LIFT, 0, 'nothing floats');
  assert.deepEqual(knocks, WOBBLES.map((_, i) => i), 'a knock with each wobble (the star: the plain three)');
  assert.ok(items.has('star'), 'and the item is yours');
  boxes.dispose(); clearInteractables(); game.reset(); items.revoke('star');
});

test('nothing tells of the makers’ boxes before you find your first one', () => {
  game.reset(); clearInteractables();
  assert.equal(boxesFound(game), false);
  const { scene, physics, level } = world('edena');
  const quests = new Quests({ game });
  const toasts = [];
  const pl = player(level.spawn);
  const boxes = createBoxes({ levelId: 'edena', scene, physics, level, player: pl, quests, toast: (t) => toasts.push(t) });
  const [qid] = boxes.quests;
  // a long while in a world with a box hidden in it: no quest, no toast, no page in the sketchbook
  for (let i = 0; i < 30 * (BOX_QUEST_DELAY * 4); i++) boxes.update(1 / 30, i / 30);
  assert.equal(quests.isStarted(qid), false, 'no box quest');
  assert.deepEqual(toasts, [], 'no toast');
  assert.equal(boxes.journalHtml(), '', 'no "Item boxes" page');
  assert.ok(!/box|chest|maker/i.test(gearHtml([])), 'the empty gear page doesn’t mention them');
  assert.ok(!/box/i.test(quests.journalHtml()), 'the sketchbook’s quests don’t either');
  // the first one found (here the backpack's box by the ship): the others are offered a little later
  const fb = boxes.list.find((b) => b.fallback && b.item === 'backpack');
  boxes.open(fb.id, { instant: true });
  assert.equal(boxesFound(game), true);
  for (let i = 0; i < 30 * 2; i++) boxes.update(1 / 30, i / 30);
  assert.equal(quests.isStarted(qid), false, 'not on the heels of the first');
  for (let i = 0; i < 30 * (BOX_QUEST_DELAY + 1); i++) boxes.update(1 / 30, i / 30);
  assert.equal(quests.isActive(qid), true, 'then the world’s other box is offered');
  assert.deepEqual(toasts, [], 'hints subtle: no toast pointing at them (hints full says one: src/hint-level.js tip)');
  assert.match(boxes.journalHtml(), /Item boxes/);
  boxes.dispose(); clearInteractables(); game.reset(); items.revoke('backpack');
});

test('box openings vary: a few camera plans, one per box, the first box as it was, a blocked plan falls back (the QC pass)', async () => {
  const { BOX_PLANS, boxPlan } = await import('../src/boxes/scene.js');
  const { PLACEMENTS } = await import('../src/boxes/placements.js');
  const ids = Object.values(PLACEMENTS).flat().map((p) => p.id);
  assert.equal(boxPlan('desert.backpack'), 'shoulder', 'the first box keeps the first opening');
  const used = {};
  for (const id of ids) { const p = boxPlan(id); assert.ok(BOX_PLANS[p], id); assert.equal(boxPlan(id), p, 'the same every time'); used[p] = (used[p] ?? 0) + 1; }
  assert.ok(Object.keys(used).length >= 3, `three plans or more in use (${JSON.stringify(used)})`);
  assert.ok(Math.max(...Object.values(used)) <= ids.length * 0.5, 'none takes over');
  // every plan frames the box and the item from outside it, in front of or beside him, never under the ground
  for (const [name, plan] of Object.entries(BOX_PLANS)) {
    for (const [x, y, z] of [plan.A(1, 0), plan.A(0.82, 1), plan.B(1), plan.B(0.88)]) {
      assert.ok(y > 0.5 && y < 3.5, `${name}: a sensible height (${y})`);
      assert.ok(Math.abs(x) > (BOX.w / 2) * BOX_SCALE + 0.2 || Math.abs(z) > (BOX.d / 2) * BOX_SCALE + 0.2, `${name}: outside the box`);
    }
  }
  // in a scene: a box whose plan is not the first plays it (or falls back where a wall stands too close)
  game.reset(); clearInteractables();
  const { scene, physics, level } = world('desert');
  const boxes = createBoxes({ levelId: 'desert', scene, physics, level, player: player(V()), sound: {} });
  const shots = [];
  const cam = { shot: (s) => shots.push(s), release() {}, hud() {}, bars() {} };
  const box = boxes.list.find((b) => b.item === 'star');
  const sc = new BoxScene({ box, def: ITEMS.star, item: 'star', player: player(V()), cam, physics, groundAt: (x, z, y) => physics.groundAt(x, y, z, 6), onGrant() {}, onEnd() {} });
  sc.start();
  assert.ok(sc.plan === boxPlan(box.id) || sc.plan === 'shoulder', `a plan (${sc.plan})`);
  for (let i = 0; i < 30 * 8 && !sc.done; i++) { sc.update(1 / 30); if (sc.phase === 'card') break; }
  assert.ok(shots.length > 100 && shots.every((s) => Number.isFinite(s.pos.x + s.pos.y + s.pos.z + s.fov)), 'a camera every frame');
  sc.end?.();
  // a wall right beside and behind the box: the plan falls back to the first
  const s2 = new THREE.Scene();
  const p2 = new Physics(s2, { heightAt: () => 0 });
  for (const [w, d, x, z] of [[0.3, 8, 1.1, 0], [8, 0.3, 0, -0.75]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 4, d)); m.position.set(x, 2, z); m.updateMatrixWorld(); s2.add(m); p2.addCollider?.(m); }
  const sc2 = new BoxScene({ box: { id: 'x', pos: V(), yaw: 0, parts: { mats: {} }, scene: null }, def: ITEMS.lens, item: 'lens', player: null, physics: p2, onGrant() {}, onEnd() {} });
  assert.equal(sc2.clearPlan('side'), 'shoulder', 'side blocked by the wall: back to the first');
  assert.equal(sc2.clearPlan('shoulder'), 'shoulder');
});

test('the major chests stand on a ramped mound: walked up to from in front, the ground rises smoothly, no step (issue #162)', async () => {
  const { MOUND_MAX_SLOPE } = await import('../src/boxes/mound.js');
  // (the Whale-House's chest stands on the Horn Chamber's shell pulpit, 3 m up: its riding disc is the room's puzzle)
  const PUZZLE = new Set(['underwater.temple.horn']);
  const major = (p) => (p.temple || p.story || p.chest === 'temple') && !p.find && !PUZZLE.has(p.id);
  const seen = [];
  for (const [id, list] of Object.entries(PLACEMENTS)) {
    const { level, physics } = world(partOf(id));
    for (const raw of list) {
      const p = shiftPlacement(id, raw);
      if (!major(p)) continue;
      const at = resolvePlacement(p, { physics, level });
      if (!at) continue;
      const F = V(Math.sin(at.yaw), 0, Math.cos(at.yaw));
      // from 4.6 m in front of it to under its front edge, every 10 cm
      let prev = null, rise = 0;
      const gs = [];
      for (let d = 4.6; d >= 0.7; d -= 0.1) {
        const q = at.pos.clone().addScaledVector(F, d), g = physics.groundAt(q.x, at.pos.y + 1.2, q.z, 4);
        if (prev !== null) assert.ok(g - prev < 0.06, `${p.id}: a step of ${(g - prev).toFixed(2)} m ${d.toFixed(1)} m in front of it`);
        gs.push(g); prev = g;
      }
      // (its slope over half a metre at a time: a 10 cm sample at its foot meets the paving's lip)
      for (let i = 5; i < gs.length; i++) rise = Math.max(rise, (gs[i] - gs[i - 5]) / 0.5);
      assert.ok(rise <= MOUND_MAX_SLOPE + 0.05, `${p.id}: its slope ${rise.toFixed(2)}`);
      // (up onto its flat top, raised over the floor: the chest itself may have a collider once a scene has built it)
      assert.ok(Math.abs(prev - gs.at(-4)) < 0.02 && prev - gs[0] > 0.25, `${p.id}: onto the mound's flat top, ${(prev - gs[0]).toFixed(2)} m over the floor`);
      seen.push(p.id);
    }
  }
  for (const id of ['desert.backpack', 'desert.lift', 'desert.gun', 'desert.temple.sword', 'buried.temple.cell', 'bazaar.temple.echo']) assert.ok(seen.includes(id), `${id} checked`);
  assert.ok(seen.length >= 14, `${seen.length} chests`);
});

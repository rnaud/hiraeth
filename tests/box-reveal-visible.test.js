import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';   // (the gadgets as items: the temples' and courts' boxes hold them)
import '../src/trials/index.js';  // (the trials' prizes register their own models)
import { ITEMS } from '../src/items.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { buildItemModel, ITEM_SCALE } from '../src/boxes/model.js';
import { BoxScene, BOX_PLANS, HAND, STAND_AT, boxPlan, offerSide } from '../src/boxes/scene.js';

// Issue #652 (the author: "when I'm opening a chest I don't see the item floating in 3-D like I used to"). Every item a
// makers' box can hold comes out as its own model, and through the card (the longest look at it) it floats where the
// lens can see it: in the frame, and never behind the traveller. Under the 'left' plan (the lens over his left shoulder)
// he held it out in his right hand, and his body and pack hid it for the whole card in ten of the 42 boxes.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const meshes = (root) => { const out = []; root.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
const isFallbackGem = (g) => meshes(g).length === 1 && meshes(g)[0].geometry.type === 'OctahedronGeometry';
const boxes = Object.values(PLACEMENTS).flat();

test('every item a makers’ box can hold is built as its own model, not the generic gem, at a size that reads', () => {
  const kinds = new Set();
  for (const p of boxes) {
    assert.ok(ITEMS[p.item], `${p.id}: holds a known item (${p.item})`);
    kinds.add(ITEMS[p.item].kind);
    const g = buildItemModel(p.item);
    assert.ok(!isFallbackGem(g), `${p.id}: ${p.item} has a model of its own`);
    assert.ok(meshes(g).some((m) => m.visible), `${p.id}: something visible`);
    g.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(g).getSize(V()).length();
    // over his hand it is ITEM_SCALE × HAND.scale its size: never a speck, never bigger than he is wide
    const held = size * ITEM_SCALE * HAND.scale;
    assert.ok(held > 0.15 && held < 0.9, `${p.id}: ${p.item} ${held.toFixed(2)} m across over his hand`);
  }
  assert.ok(['gadget', 'charm', 'weapon', 'movement', 'upgrade', 'mode', 'core', 'cosmetic'].every((k) => kinds.has(k)), `every kind of reward checked (${[...kinds]})`);
});

/** The closest distance between segment a-b and segment c-d (sampled finely enough for metres). */
function segGap(a, b, c, d) {
  const axis = new THREE.Line3(c, d), p = V(), q = V();
  let best = Infinity;
  for (let i = 0; i <= 60; i++) { new THREE.Line3(a, b).at(i / 60, p); axis.closestPointToPoint(p, true, q); best = Math.min(best, p.distanceTo(q)); }
  return best;
}

/** What hides the item: his body (feet to head) and the tank on his back, about him where he stands before the box. */
function hiddenBy(lens, item, sc, player) {
  const F = sc.F, P = player.pos;   // (F: the box's front; he faces back along it, his back toward +F)
  const body = segGap(lens, item, V(P.x, P.y + 0.25, P.z), V(P.x, P.y + 1.8, P.z));
  const packAt = P.clone().addScaledVector(F, 0.3);
  const pack = segGap(lens, item, V(packAt.x, P.y + 0.9, packAt.z), V(packAt.x, P.y + 1.6, packAt.z));
  return body < 0.3 ? `his body (${body.toFixed(2)} m)` : pack < 0.28 ? `his pack (${pack.toFixed(2)} m)` : null;
}

function inFrame(shot, p) {
  const cam = new THREE.PerspectiveCamera(shot.fov, 16 / 9, 0.05, 100);
  cam.position.copy(shot.pos); cam.lookAt(shot.look); cam.updateMatrixWorld(true);
  const n = p.clone().project(cam);
  return n.z < 1 && Math.abs(n.x) < 0.95 && Math.abs(n.y) < 0.75;   // (inside the letterbox's picture)
}

function play(id, item, { skip = false, yaw = 0.7 } = {}) {
  const shots = [];
  const cam = { shot: (o) => shots.push({ pos: o.pos.clone(), look: o.look.clone(), fov: o.fov }), release() {}, hud() {}, bars() {} };
  const player = { pos: V(), vel: V(), heading: 0, object: null };
  const sc = new BoxScene({ box: { id, pos: V(3, 1, -2), yaw, parts: { mats: {} }, scene: null }, def: ITEMS[item], item, player, cam, onGrant() {}, onEnd() {} });
  sc.start();
  if (skip) { sc.update(1 / 30); sc.skip(); }
  for (let i = 0; i < 30 * 15 && sc.phase !== 'card'; i++) sc.update(1 / 30);
  for (let i = 0; i < 20; i++) sc.update(1 / 30);   // (the card's push-in settled)
  return { sc, player, shots };
}

test('through the card every box’s item floats in the frame, over the hand on the lens’s side, never behind him', () => {
  const plans = new Set();
  for (const p of boxes) {
    for (const skip of [false, true]) {
      const { sc, player, shots } = play(p.id, p.item, { skip });
      const what = `${p.id} (${sc.plan}${skip ? ', skipped' : ''})`;
      plans.add(sc.plan);
      assert.equal(sc.phase, 'card', what);
      assert.ok(sc.model.visible && sc.model.scale.x > 0.5, `${what}: the item is out`);
      assert.equal(player.offer?.side, offerSide(sc.plan), `${what}: the hand on the lens's side`);
      const shot = shots.at(-1), item = sc.model.position.clone();
      assert.ok(item.distanceTo(sc.handAt()) < 0.05, `${what}: over his open hand`);
      assert.ok(inFrame(shot, item), `${what}: in the frame`);
      const hid = hiddenBy(shot.pos, item, sc, player);
      assert.equal(hid, null, `${what}: hidden by ${hid}`);
    }
  }
  assert.deepEqual([...plans].sort(), Object.keys(BOX_PLANS).sort(), 'every plan seen');
});

test('the left plan offers the left hand; the others the right (the old right hand under it was hidden)', () => {
  assert.deepEqual(Object.fromEntries(Object.keys(BOX_PLANS).map((k) => [k, offerSide(k)])), { shoulder: 'r', left: 'l', side: 'r', high: 'r' });
  const left = boxes.find((p) => boxPlan(p.id) === 'left');
  const { sc, player, shots } = play(left.id, left.item);
  // the regression: the same card shot with the item over his right hand is hidden by him
  sc.hand = 'r';
  assert.ok(hiddenBy(shots.at(-1).pos, sc.handAt(), sc, player), 'held in his right under the left lens, he hides it');
  assert.ok(sc.handTarget().distanceTo(player.pos) > 0.3 && Math.abs(sc.handTarget().y - player.pos.y - HAND.at[1]) < 1e-6);
  assert.ok(STAND_AT > 0);
});

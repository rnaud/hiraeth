import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { bestInteractable, updateInteract, registerInteractable, clearInteractables, allInteractables, PRIORITY } from '../src/interact.js';
import { interactionAnchor, interactionEligible, interactionReachable, promptVisible } from '../src/interaction-view.js';
import { registerCarryable } from '../src/carry.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const player = () => ({ pos: V(), heading: 0, onGround: true, frame: { up: V(0, 1, 0), dir: (_h, out) => out.set(0, 0, 1) } });
function camera() {
  const c = new THREE.PerspectiveCamera(60, 4 / 3, 0.1, 100);
  c.position.set(0, 1.1, 0); c.lookAt(V(0, 1.1, 3)); c.updateMatrixWorld(true);
  return c;
}
const policy = (p, c, physics = null) => ({ eligible: e => interactionEligible(p, e, { camera: c, physics, anchor: interactionAnchor(e, c, V()) }) });
function solid(x, y, z, w = 1, h = 2, d = 0.1) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); return m;
}
test.afterEach(() => clearInteractables());

test('a visible candidate wins over a closer off-screen candidate, and owns both prompt and fresh use', () => {
  const p = player(), c = camera(), used = [];
  registerInteractable({ id: 'behind', at: () => V(0, 1.1, -1), distance: () => 0.1, use: () => used.push('behind') });
  registerInteractable({ id: 'ahead', at: () => V(0, 1.1, 2), distance: () => 2, prompt: 'inspect the chest', use: () => used.push('ahead') });
  const options = policy(p, c);
  assert.equal(bestInteractable(p, options).entry.id, 'ahead');
  const shown = updateInteract(p, false, options);
  assert.equal(shown.prompt, 'inspect the chest'); assert.equal(shown.handled, false);
  const pressed = updateInteract(p, true, options);
  assert.equal(pressed.entry.id, shown.entry.id); assert.equal(pressed.handled, true);
  assert.deepEqual(used, ['ahead']);
  updateInteract(p, false, options); assert.deepEqual(used, ['ahead'], 'holding does not add another fresh press');
});

test('camera loss or a new barrier is revalidated on the press without silently calling the player fallback', () => {
  const p = player(), c = camera(), ph = new Physics(new THREE.Scene()); let uses = 0;
  registerInteractable({ at: () => V(0, 1.1, 2), reachAt: () => V(0, 1.1, 2), distance: () => 2, use: () => uses++ });
  const options = policy(p, c, ph);
  assert.ok(updateInteract(p, false, options).entry);
  const wall = ph.addCollider(solid(0, 1, 1));
  const blocked = updateInteract(p, true, options);
  assert.equal(blocked.entry, null); assert.equal(blocked.prompt, null); assert.equal(blocked.handled, true); assert.equal(uses, 0);
  ph.removeCollider(wall); c.lookAt(V(0, 1.1, -2)); c.updateMatrixWorld(true);
  assert.equal(updateInteract(p, true, options).entry, null); assert.equal(uses, 0);
  clearInteractables(); assert.equal(updateInteract(p, true, options).handled, false, 'no nearby entry leaves the ordinary fallback alone');
});

test('visibility rejects points behind, beyond and before the camera near plane', () => {
  const c = camera();
  for (const at of [V(0, 1.1, -1), V(0, 1.1, 0.05), V(0, 1.1, 101), V(50, 1.1, 2)]) assert.equal(promptVisible(at, c), false);
  assert.equal(promptVisible(V(0, 1.1, 2), c), true);
  assert.equal(promptVisible(null, c), true, 'unanchored entries use the HUD');
  assert.equal(promptVisible(V(0, 0, -1), null), true, 'camera-free domain checks keep their existing contract');
});

test('a shoulder tag uses the same borrowed-anchor-safe position for selection and presentation', () => {
  const c = camera(), borrowed = V(0, 1.3, 2), e = { at: () => borrowed, beside: () => ({ mid: borrowed, half: 0.2 }), npc: { object: { scale: { y: 1 } } } };
  const a = interactionAnchor(e, c, V()), b = interactionAnchor(e, c, V(), -1);
  assert.ok(Math.abs(a.distanceTo(b) - 0.56) < 1e-9);
  assert.ok(promptVisible(a, c) && promptVisible(b, c));
  borrowed.set(9, 9, 9); assert.equal(a.y, 1.3, 'registered shared vector cannot mutate the saved anchor');
});

test('one owned collider can be ignored without ignoring an intervening solid or changing collision lists', () => {
  const scene = new THREE.Scene(), wall = solid(0, 1, 1); scene.add(wall);
  const ph = new Physics(scene), target = ph.addCollider(solid(0, 1, 2, 1, 2, 1));
  const extras = ph.extras, before = [...extras], p = player();
  const e = { reachAt: () => V(0, 1.1, 2), reachCollider: () => target };
  assert.equal(interactionReachable(p, e, ph), false, 'level wall still blocks an owned body');
  assert.equal(ph.extras, extras); assert.deepEqual(ph.extras, before);
  const clear = new Physics(new THREE.Scene()), own = clear.addCollider(solid(0, 1, 2, 1, 2, 1));
  assert.ok(clear.rayDistance(V(0, 1.1, 0), V(0, 0, 1), 2) < 2, 'target body is solid');
  assert.equal(interactionReachable(p, { ...e, reachCollider: () => own }, clear), true, 'own collider does not block the reach');
  const added = clear.addCollider(solid(0, 1, 1));
  assert.equal(interactionReachable(p, { ...e, reachCollider: () => own }, clear), false, 'an added wall is not the owned body');
  clear.removeCollider(added);
  assert.equal(clear.rayDistance(V(0, 1.1, 0), V(0, 0, 1), 2, own), Infinity);
  assert.ok(clear.rayDistance(V(0, 1.1, 0), V(0, 0, 1), 2) < 2, 'the ignore does not persist into the next query');
});

test('late world geometry and ground handles cannot be excluded by the owned-body option', () => {
  const ph = new Physics(new THREE.Scene()), own = ph.addCollider(solid(0, 1, 2, 1, 2, 1));
  const late = ph.addCollider(solid(0, 1, 1)); ph.removeCollider(late);
  ph.late = { extras: [late], pending: false };
  assert.ok(ph.rayDistance(V(0, 1.1, 0), V(0, 0, 1), 2, late) < 1, 'late world collider is not an interaction-owned prop');
  assert.equal(interactionReachable(player(), { reachAt: () => V(0, 1.1, 2), reachCollider: () => own }, ph), false);
  ph.late.extras = []; own.ground = true;
  assert.ok(ph.rayDistance(V(0, 1.1, 0), V(0, 0, 1), 2, own) < 2, 'world ground stays solid');
});

test('a moving owned collider is excluded only for this query; a nearby moving barrier still blocks', () => {
  const ph = new Physics(new THREE.Scene()), body = solid(0, 1, 2, 1, 2, 1), own = ph.addMover(body);
  const entry = { reachAt: () => body.position, reachCollider: () => own }, p = player();
  assert.equal(interactionReachable(p, entry, ph), true);
  const barrier = solid(0, 1, 1); ph.addMover(barrier);
  assert.equal(interactionReachable(p, entry, ph), false);
  barrier.position.x = 3; ph.syncMovers();
  assert.equal(interactionReachable(p, entry, ph), true);
});

test('local-up reach starts at the body and never at the floating label', () => {
  const p = player(); p.frame.up.set(1, 0, 0);
  const ph = { rayDistance: (o, d, far, ignore) => { assert.deepEqual(o.toArray(), [1.1, 0, 0]); assert.ok(d.y > 0); assert.equal(ignore, null); assert.ok(far > 1); return Infinity; } };
  const e = { at: () => V(50, 50, 50), reachAt: () => V(1.1, 2, 0) };
  assert.equal(interactionReachable(p, e, ph), true);
});

test('ordinary carry entries opt into owned-body reach while held-object release has explicit off-screen ownership', () => {
  const ph = new Physics(new THREE.Scene()), object = solid(0, 0.4, 1, 0.8, 0.8, 0.8);
  const t = { id: 'view-crate', pos: object.position, object, r: 0.4, h: 0.4, collider: ph.addCollider(object) };
  const off = registerCarryable(t), p = player(), c = camera(), options = policy(p, c, ph);
  try {
    const entry = bestInteractable(p, options)?.entry;
    assert.equal(entry?.id, 'carry.view-crate'); assert.equal(entry.reachCollider(), t.collider);
    assert.equal(allInteractables().find(e => e.id === 'carry.put')?.offscreenUse, true, 'the real put-down registration retains ownership');
    const barrier = ph.addCollider(solid(0, 1, 0.5));
    assert.equal(bestInteractable(p, options), null);
    ph.removeCollider(barrier); object.visible = false;
    assert.equal(bestInteractable(p, options), null, 'hidden objects are not offered');
    object.visible = true; p.onGround = false;
    assert.equal(bestInteractable(p, options), null, 'the original ground restriction remains');
  } finally { off(); }
});

test('unanchored, explicitly off-screen and riding ownership remain explicit; visibility never raises priority', () => {
  const p = player(), c = camera(), options = policy(p, c), used = [];
  registerInteractable({ id: 'held', offscreenUse: true, at: () => V(0, 1, -1), distance: () => 0, priority: PRIORITY.use + 2, use: () => used.push('held') });
  registerInteractable({ id: 'ship-owned', priority: PRIORITY.ship, offscreenUse: true, at: () => V(0, 1, -2), distance: () => 1, use: () => used.push('ship') });
  assert.equal(updateInteract(p, true, options).entry.id, 'ship-owned'); assert.deepEqual(used, ['ship']);
  p.riding = true; assert.equal(bestInteractable(p, options), null);
  registerInteractable({ id: 'riding-exit', whileRiding: true, distance: () => 0, prompt: 'get off', use: () => used.push('exit') });
  assert.equal(updateInteract(p, true, options).entry.id, 'riding-exit'); assert.deepEqual(used, ['ship', 'exit']);
});


test('a new person at the screen edge is selectable when the opposite shoulder fits', () => {
  const p = player(), c = camera();
  // Centre of the real body is at 98% of the right edge; its default outer shoulder is offscreen.
  const mid = V(Math.tan(Math.PI / 6) * c.aspect * 3 * 0.98, 0, -3).applyMatrix4(c.matrixWorld);
  const body = { mid, half: 0.2 }, entry = { id: 'edge-person', npc: { object: { scale: { y: 1 } } },
    at: () => mid, beside: () => body, distance: () => 2.5, prompt: 'talk', use() {} };
  assert.equal(promptVisible(mid, c), true);
  const placement = {}, offered = interactionAnchor(entry, c, V(), 1, placement);
  assert.equal(placement.side, -1, 'initial selection flips before rejecting the visible person');
  assert.equal(promptVisible(offered, c), true);
  registerInteractable(entry);
  assert.equal(updateInteract(p, false, policy(p, c)).entry?.id, 'edge-person');
  const rendered = interactionAnchor(entry, c, V(), 1, placement);
  assert.ok(rendered.distanceTo(offered) < 1e-9, 'display and eligibility choose the same feasible anchor');
  const repeated = interactionAnchor(entry, c, V(), placement.side, placement);
  assert.ok(repeated.distanceTo(offered) < 1e-9, 'the feasible side remains stable on the next frame');
});

test('rejected use does not disable the explicit controller mount call or no-nearby keyboard fallback', () => {
  const ph = new Physics(new THREE.Scene(), { heightAt: () => 0 }), calls = [];
  const p = new Player(ph, { mount: () => ({ pos: V(80, 0, 80), summon: (...args) => calls.push(args) }) });
  p.pos.set(0, 0, 0); p.onGround = true;
  const c = camera(), options = policy(p, c, ph);
  registerInteractable({ id: 'hidden', at: () => V(0, 1.1, -1), distance: () => 1, use: () => assert.fail('offscreen target used') });
  const blocked = updateInteract(p, true, options);
  if (!blocked.handled) p.interact();
  assert.equal(calls.length, 0, 'the rejected use press does not whistle');
  p.callMount(); assert.equal(calls.length, 1, 'the controller call action bypasses use selection as before');
  clearInteractables();
  const empty = updateInteract(p, true, options);
  assert.equal(empty.handled, false);
  if (!empty.handled) p.interact();
  assert.equal(calls.length, 2, 'keyboard E still calls with no target nearby');
  p.interact({ call: false }); assert.equal(calls.length, 2, 'a controller use press is still separate from call');
});

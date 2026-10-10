import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setHintLevel } from '../src/hint-level.js';

// (these check the game's words as hints full says them, every tip and step; subtle, the default, is checked in tests/hint-level.test.js)
setHintLevel('full');

// Pip's ration tin, hands-on (src/story/incal.js, the goods hoist): it hangs in the old hoist's
// basket out over the void; shoot the rusted pin out of the collar, push the weight on the arm's
// short end round the post, take the tin from the basket, carry it up to Dov.

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };

const { createIncal } = await import('../src/levels/incal.js');
const { Physics } = await import('../src/physics.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE, THINGS } = await import('../src/story/incal-data.js');
const { bestInteractable } = await import('../src/interact.js');
const { allTargets } = await import('../src/targets.js');

game.reset();
const scene = new THREE.Scene();
const level = createIncal(scene);
const physics = new Physics(scene, null);
level.init(physics);
const P = level.shaft.places;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, vehicles: [...level.vehicles], frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
const rt = createStory({ levelId: 'incal', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests, dialogue } = rt;
const H = rt.world.hoist;
let clock = 0;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
const talk = (person, choices) => {
  const r = new DialogueRunner(person, { game, quests });
  for (const c of choices) {
    while (!r.ended && (!r.lastPage || !r.choices().length) && r.advance());
    const pick = r.choices().find((x) => x.text.startsWith(c));
    assert.ok(pick, `${person.name}: no choice "${c}" in ${JSON.stringify(r.choices().map((x) => x.text))}`);
    r.choose(pick.index);
    while (!r.ended && r.advance());
  }
  return r;
};
const target = (kind) => allTargets().find((t) => t.kind === kind);
const toasted = (re) => toasts.some((t) => re.test(t));
const basket = () => H.rig.hang.localToWorld(V(0, -3.0, 0));
const flatTo = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('the hoist stands at the edge of the bottom terrace, its basket out over the void, in reach of a shot', () => {
  const g = physics.groundAt(P.hoist.x, P.hoist.y + 3, P.hoist.z, 8);
  assert.ok(Math.abs(g - P.hoist.y) < 0.3, 'the post stands on the terrace');
  const b = basket();
  assert.ok(!Number.isFinite(physics.groundAt(b.x, P.hoist.y + 1, b.z, 30)) || physics.groundAt(b.x, P.hoist.y + 1, b.z, 30) < P.hoist.y - 5, 'the basket hangs out over the void');
  assert.ok(Math.hypot(b.x, b.z) < Math.hypot(P.hoist.x, P.hoist.z) - 2, 'toward the middle of the shaft');
  const gIn = physics.groundAt(P.hoistIn.x, P.hoistIn.y + 3, P.hoistIn.z, 8);
  assert.ok(Math.abs(gIn - P.hoistIn.y) < 0.3, 'where it swings in to is terrace');
  assert.ok(flatTo(P.hoist, P.pip) < 25 && flatTo(P.hoist, P.pip) > 5, `a little way past Pip (${flatTo(P.hoist, P.pip).toFixed(1)} m)`);
  assert.ok(H.rig.tin.visible, 'the tin is in the basket');
  // the pin and the weight are within a push or a shot from where you stand on the terrace
  const pin = target('hoistPin'), weight = target('hoistWeight');
  at(P.hoist.clone().add(V(Math.cos(3.155) * -3, 0, Math.sin(3.155) * -3)));
  assert.ok(pin.enabled() && weight.enabled());
  assert.ok(pin.position().y - P.hoist.y > 2 && pin.position().y - P.hoist.y < 4.5, 'the pin at the collar, above your head');
  assert.ok(weight.position().y - P.hoist.y < 3.6, 'the weight low enough to push');
});

test('the hoist: the weight won’t turn while the pin is in, nor pushed along the arm; pin out, pushed round, the basket comes in', () => {
  at(P.pip.clone());
  talk(PEOPLE.pip, ['Why doesn', 'I could take him']);
  assert.equal(quests.stage('incal.ration'), 'hoist');
  assert.ok(!quests.has('ration'), 'Pip doesn’t have it: it’s in the basket');
  assert.match(new DialogueRunner(PEOPLE.pip, { game, quests }).text, /pin first/i, 'asked again, Pip says how');
  const pin = target('hoistPin'), weight = target('hoistWeight');
  const w = weight.position().clone();
  const radial = V(w.x - P.hoist.x, 0, w.z - P.hoist.z).normalize(), round = V(-radial.z, 0, radial.x);
  // the weight, pushed round with the pin still in: it groans, nothing turns
  at(P.hoist.clone().addScaledVector(round, -2.5));
  assert.equal(weight.onHit('push', w, round), false);
  assert.ok(toasted(/rusted pin/));
  assert.ok(!H.swungIn());
  // a shot at the weight only clangs; a push at the pin only rattles it
  weight.onHit('shoot', w, round);
  H.state.hintT = -1e9;
  pin.onHit('push', pin.position(), round);
  assert.ok(!H.pinOut() && toasted(/rusted fast/));
  // a shot knocks the pin out; it falls onto the stones
  assert.equal(pin.onHit('shoot', pin.position(), round), true);
  assert.ok(H.pinOut() && game.flag('incal.hoist.pin'));
  step(30);
  assert.ok(H.rig.pin.getWorldPosition(V(0, 0, 0)).y - P.hoist.y < 0.3, 'the pin lies on the terrace');
  assert.equal(pin.enabled(), false);
  // pushed along the arm (toward the void, from the house side): it rocks, nothing turns
  H.state.hintT = -1e9;
  assert.equal(weight.onHit('push', w, radial.clone().negate()), false);
  assert.ok(toasted(/round the post, not along the arm/));
  assert.ok(!H.swungIn());
  // round the post: it swings in
  assert.equal(weight.onHit('push', w, round.clone().negate()), true);
  assert.ok(game.flag('incal.hoist.in'));
  step(5);
  at(P.hoistIn.clone());
  assert.notEqual(bestInteractable(player)?.entry.id, 'hoistBasket', 'not while it swings');
  step(30 * 3);
  const b = basket();
  assert.ok(flatTo(b, P.hoistIn) < 0.3, `the basket hangs over the terrace (${flatTo(b, P.hoistIn).toFixed(2)} m off)`);
  assert.ok(b.y - P.hoist.y > 1 && b.y - P.hoist.y < 2, 'at chest height');
  assert.equal(weight.enabled(), false);
  // take the tin
  const e = bestInteractable(player);
  assert.equal(e?.entry.id, 'hoistBasket');
  assert.match(e.entry.prompt(), /ration tin/);
  e.entry.use(player);
  assert.ok(quests.has('ration'));
  assert.equal(H.rig.tin.visible, false);
  assert.equal(quests.stage('incal.ration'), 'carry');
  // up to Dov: done, as before
  at(P.palace.dov.clone().add(V(2, 0, 0)));
  const r = talk(PEOPLE.dov, ['Thank you, Dov. I’ll keep it safe']);   // (or give it back: a choice the stone remembers, tests/finale.test.js)
  while (!r.ended && r.advance());
  assert.equal(quests.isDone('incal.ration'), true);
  assert.ok(game.keepsakes().some((k) => k.id === 'incal.token'));
  // the hoist's look, swung in: an empty basket is no longer offered
  at(P.hoistIn.clone());
  assert.notEqual(bestInteractable(player)?.entry.id, 'hoistBasket');
  assert.match(new DialogueRunner(THINGS.hoist, { game, quests }).text, /over the terrace/);
  void dialogue;
});

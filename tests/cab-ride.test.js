import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Cabs drive themselves (TODO 2026-10-06): nobody up front; you ride seated inside, choose a stop
// from the dash's question, it flies you there, and you step out at the stop. Played through with
// the real traveller, in the Signal Market's streets and the City-Shaft's pit (src/taxi.js,
// src/story/cab.js, docs/systems/movement.md "Riding a cab").

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };

const { Taxi, SEAT, CABIN, CAB_PASS, planRoute } = await import('../src/taxi.js');
const { Physics } = await import('../src/physics.js');
const { Player } = await import('../src/player.js');
const { createBazaar } = await import('../src/levels/bazaar.js');
const { createIncal } = await import('../src/levels/incal.js');
const { Dialogue } = await import('../src/story/dialogue.js');
const { Quests } = await import('../src/story/quests.js');
const { setupCabs } = await import('../src/story/cab.js');
const { CAB_LINES } = await import('../src/story/cab-lines.js');
const { parseLine } = await import('../src/story/tone.js');
const { cueText } = await import('../src/hud.js');
const { RIDE_GRIPS } = await import('../src/hands.js');
const { Controller } = await import('../src/controller.js');
const { game } = await import('../src/game-state.js');

const DT = 1 / 30;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const world = (create) => { const scene = new THREE.Scene(), level = create(scene), physics = new Physics(scene, null); level.init(physics); return { level, physics }; };
const market = world(createBazaar);
const shaft = world(createIncal);

/** Where the seated traveller is, in the cab's own units: his hips, and the top of his head. */
function seated(p, cab) {
  const inv = cab.object.matrixWorld.clone().invert();
  const up = V(0, 1, 0).applyQuaternion(p.object.quaternion);   // (he leans with the cab)
  const hips = p.object.position.clone().addScaledVector(up, 0.9).applyMatrix4(inv);
  const head = p.object.position.clone().addScaledVector(up, 1.8).applyMatrix4(inv);
  return { hips, head };
}

test('nobody drives: every cab in both worlds is driverless, a seat in its open cabin', () => {
  for (const { level } of [market, shaft]) {
    const cabs = level.vehicles.filter((v) => v.kind === 'taxi');
    assert.ok(cabs.length >= 12);
    for (const c of cabs) {
      assert.ok(!('cabbie' in c.parts), 'no driver');
      assert.ok(c.parts.seat, 'a seat');
      // what the cab is made of: its body, trim, fins, glow, lamps and seat (and a passenger, now and then)
      assert.equal(c.object.children.length, 6 + (c.parts.pax ? 1 : 0));
      // a passenger, if any, sits in the seat, in the cabin's opening
      if (c.parts.pax) assert.ok(c.parts.pax.position.z > CABIN.z0 && c.parts.pax.position.z < CABIN.z1 && c.parts.pax.position.y === SEAT.y);
    }
  }
});

test('every stop: you step out on solid ground, it hovers in the clear, and a cab can fly from any stop to any other', () => {
  for (const [name, { level, physics }] of [['market', market], ['shaft', shaft]]) {
    const stops = level.cabStops;
    assert.ok(stops.length >= 4, `${name}: ${stops.length} stops`);
    for (const s of stops) {
      const g = physics.groundAt(s.step.x, s.step.y + 2, s.step.z, 6);
      assert.ok(Math.abs(g - s.step.y) < 0.3, `${name} ${s.id}: ground where you step out (${g} vs ${s.step.y})`);
      assert.ok(!physics.embedded(s.step.clone().add(V(0, 1, 0))), `${name} ${s.id}: not inside anything`);
      for (const d of [V(1, 0, 0), V(-1, 0, 0), V(0, 0, 1), V(0, 0, -1), V(0, 1, 0)]) assert.ok(physics.rayDistance(s.at, d, 3) === Infinity, `${name} ${s.id}: room for the cab`);
    }
    for (const a of stops) for (const b of stops) {
      if (a === b) continue;
      assert.ok(planRoute(physics, level.cabRoutes(a.at, b), 1.5 * 2.6), `${name}: a clear way from ${a.id} to ${b.id}`);
    }
  }
  assert.deepEqual(shaft.level.cabStops.filter((s) => s.depths).map((s) => s.id), ['bottom'], 'below the smog only Wren stops');
});

test('a ride: in with E, seated, choose a stop, flown there, out at the stop with B / ○; X / □ asks again', () => {
  const { level, physics } = market;
  game.set(`item.${CAB_PASS}`, true);
  const toasts = [];
  const quests = new Quests({ game });
  const dialogue = new Dialogue({ game, quests });
  const p = new Player(physics);
  p.vehicles = [...level.vehicles];
  const cabs = setupCabs({ player: p, dialogue, level, toast: (t) => toasts.push(t) });
  const cab = level.vehicles[0], home = level.cabStops[0];
  Taxi.playerPos = p.pos;
  // waiting at the market's stop, empty
  cab.pos.copy(home.at); cab.mode = 'parked'; cab.parkY = home.at.y; cab.heading = home.heading; cab.update(DT, null, 0);
  p.pos.copy(home.step); p.heading = 0;
  for (let i = 0; i < 5; i++) p.update(DT, {}, 0);
  // E: in
  p.update(DT, { KeyE: true }, 0);
  assert.equal(p.ride, cab, 'aboard');
  assert.equal(cab.mode, 'aboard');
  for (let i = 0; i < 3; i++) p.update(DT, {}, 0);
  // seated in the cabin: hips on the cushion, inside the opening, head well under the canopy
  const { hips, head } = seated(p, cab);
  assert.ok(Math.abs(hips.y - SEAT.y) < 0.02 && Math.abs(hips.z - SEAT.z) < 0.02 && Math.abs(hips.x) < 0.02, `hips on the cushion (${hips.toArray().map((x) => x.toFixed(2))})`);
  assert.ok(hips.z > CABIN.z0 && hips.z < CABIN.z1, 'inside the cabin, not on the roof');
  assert.ok(head.y < 1.05 - 0.15, `head under the canopy (${head.y.toFixed(2)})`);
  // the seated pose: thighs level, shins down, hands resting (no grip on a wheel: nobody drives)
  const c = p.char;
  assert.ok(c.legs[0].rotation.x < -1.4 && c.legs[1].rotation.x < -1.4 && c.knees[0].rotation.x > 1.3, 'seated');
  assert.ok(c.arms[0].rotation.x > -0.8 && c.elbows[0].rotation.x < -0.4, 'forearms down on the thighs');
  assert.equal(RIDE_GRIPS.taxi, 'relaxed');
  // the dash asks where to: every other stop, and getting out
  cabs.update();
  assert.ok(dialogue.open && dialogue.person.name === 'Cab');
  const choices = dialogue.runner.choices().map((x) => x.text);
  assert.deepEqual(choices, [...level.cabStops.slice(1).map((s) => s.name), 'Nowhere, thanks. I’ll get out.']);
  // the driving keys and triggers do nothing to it while you choose (and after): it drives itself
  const before = cab.pos.clone();
  for (let i = 0; i < 20; i++) p.update(DT, { KeyW: true, KeyA: true, PadRide: true, Throttle: 1, stick: { x: 1, y: 1 } }, 0);
  assert.ok(Math.hypot(cab.pos.x - before.x, cab.pos.z - before.z) < 0.01, 'it waits');
  // Signal Square (a number key, a click or A / × on it: Dialogue.choose)
  const square = level.cabStops.find((s) => s.id === 'square');
  dialogue.revealed = Infinity;
  dialogue.choose(dialogue.runner.choices().find((x) => x.text === square.name).index);
  assert.equal(dialogue.open, false);
  assert.equal(cab.mode, 'route');
  assert.ok(toasts.at(-1).startsWith('Cab: Signal Square.'));
  // the flight: seated all the way, high over the market, then down at the square
  let top = -Infinity, steps = 0;
  while (cab.mode === 'route' && steps++ < 30 * 60) {
    p.update(DT, {}, 0);
    top = Math.max(top, cab.pos.y);
    const s = seated(p, cab).hips;
    assert.ok(Math.abs(s.y - SEAT.y) < 0.02 && Math.abs(s.z - SEAT.z) < 0.02, 'still in the seat');
  }
  assert.equal(cab.mode, 'aboard', `arrived (${steps} frames)`);
  assert.ok(steps < 30 * 25, `in good time (${(steps / 30).toFixed(1)} s)`);
  assert.ok(top > 25, `over the low skybridges (${top.toFixed(1)} m up)`);
  assert.ok(cab.pos.distanceTo(square.at) < 0.6 && cab.stop === square);
  assert.ok(toasts.at(-1).startsWith('Cab: Signal Square.'), 'it says where you are');
  assert.equal(p.ride, cab, 'and waits for you to get out');
  // X / □ (SPACE): where to now? Closing the question leaves you seated
  p.update(DT, { Space: true }, 0); p.update(DT, {}, 0);
  cabs.update();
  assert.ok(dialogue.open && dialogue.runner.text === parseLine(CAB_LINES.again).text);
  assert.ok(!dialogue.runner.choices().some((x) => x.text === square.name), 'not where you are');
  dialogue.close();
  p.update(DT, {}, 0);
  assert.equal(p.ride, cab);
  // B / ○ (the pad's E): out, onto the stop
  p.update(DT, { KeyE: true, PadE: true }, 0);
  assert.equal(p.ride, null, 'out');
  assert.ok(p.pos.distanceTo(square.step) < 0.3, `standing at the stop (${p.pos.toArray().map((x) => x.toFixed(1))})`);
  assert.equal(cab.mode, 'parked');
  for (let i = 0; i < 20; i++) p.update(DT, {}, 0);
  assert.ok(Math.abs(p.pos.y - physics.groundAt(p.pos.x, p.pos.y + 1, p.pos.z)) < 0.1, 'on the ground');
  // in again and straight out ("Nowhere"): back where you got in
  for (let i = 0; i < 12; i++) p.update(DT, {}, 0);
  p.update(DT, { KeyE: true }, 0);
  assert.equal(p.ride, cab);
  cabs.update();
  dialogue.revealed = Infinity;
  dialogue.choose(dialogue.runner.choices().find((x) => x.text.startsWith('Nowhere')).index);
  assert.equal(p.ride, null);
  assert.ok(p.pos.distanceTo(square.step) < 0.5);
  Taxi.playerPos = null;
  game.set(`item.${CAB_PASS}`, undefined);
});

test('the pad in a cab: X / □ is SPACE (where to), B / ○ gets out, A / × jumps off', () => {
  const t = { pad: { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) } };
  const ctl = new Controller({ pads: () => [t.pad], context: () => 'ride', action() {}, look() {}, navigate() {}, scroll() {} });
  const press = (i) => { t.pad.buttons.forEach((b) => { b.pressed = false; b.value = 0; }); t.pad.buttons[i] = { pressed: true, value: 1 }; return ctl.update(DT); };
  assert.ok(press(2).Space, 'X / □');
  const b = press(1);
  assert.ok(b.KeyE && b.PadE, 'B / ○');
  assert.ok(press(0).JumpOff, 'A / ×');
});

test('the cue: no button hints in a cab (its dash asks where to by itself)', () => {
  assert.equal(cueText({ ride: 'taxi', rideFor: 0 }), '');
  assert.equal(cueText({ ride: 'taxi', rideFor: 0, controller: true }), '');
});

test('the cab\'s words each carry a tone, and none of them is a driver\'s', () => {
  const all = Object.values(CAB_LINES).flat();
  assert.ok(all.length > 10);
  for (const s of all) assert.ok(parseLine(s).explicit, `a tone: ${s}`);
  assert.doesNotMatch(all.join(' '), /driver/i);
});

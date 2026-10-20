// The Underwater City's sea port and its lift (issue #572: "when I first come out the ship I'm in the water and I cannot
// get into the city. The ship needs to land in a spaceport above the water. then I take an elevator down to the
// underwater city"; src/underwater-port.js, docs/systems/worlds.md "The sea port"). The ship stood on the Dock's dome
// under the sea, outside the glass: its ramp let the traveller out into the water with no helmet and no way in.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { Waters } = await import('../src/water.js');
const { Player } = await import('../src/player.js');
const { SEA_PORT, SHAFT, CABIN, STATIONS, PORT_SHIP, liftRun, doorSpot, SeaLift } = await import('../src/underwater-port.js');
const { SEA_Y, DOMES, SHIP_SITE, placeAt } = await import('../src/levels/underwater.js');
const { UNDERWATER_PORT } = await import('../src/levels/ports.js');
const { CONTENT } = await import('../src/levels/content.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };

globalThis.location = { search: '?level=underwater' };
const W = A.loadWorld('underwater');
const { level, physics, scene } = W;
const waters = quiet(() => new Waters(scene, { physics, drops: false }));
test.after(() => W.dispose());

/** The real traveller on the sea port, the level's moving solids under him (the cabin, the shut gates). */
function traveller(at) {
  const P = quiet(() => new Player(physics, { water: waters, climb: true, dynamic: level.dynamic, killY: level.killY, spawn: level.spawn }));
  P.respawn(at.clone().add(V(0, 0.3, 0)));
  return P;
}
let t = 0;
const frame = (P, inp = {}, yaw = 0) => { t += 1 / 60; level.update(1 / 60, t, { player: P }); P.update(1 / 60, inp, yaw); };
function walkTo(P, to, { secs = 12, near = 0.5 } = {}) {
  for (let i = 0; i < 60 * secs && flat(P.pos, to) > near; i++) {
    const h = Math.atan2(to.x - P.pos.x, to.z - P.pos.z);
    P.heading = h;
    frame(P, { KeyW: true }, h + Math.PI);
  }
  return flat(P.pos, to) <= near + 0.2;
}

test('the cabin’s run: from rest to rest, never faster than its speed, under a quarter of a minute', () => {
  const len = CABIN.top - CABIN.foot, r0 = liftRun(len, 0), T = r0.T;
  assert.ok(T > 8 && T < 15, `the run takes ${T.toFixed(1)} s`);
  let last = 0, fastest = 0;
  for (let s = 0; s <= T + 0.5; s += 0.05) {
    const r = liftRun(len, s);
    assert.ok(r.s >= last - 1e-9 && r.s <= len + 1e-9, 'on along the shaft');
    fastest = Math.max(fastest, r.v);
    last = r.s;
  }
  assert.ok(fastest <= CABIN.speed + 1e-9, `at most ${CABIN.speed} m/s: ${fastest.toFixed(2)}`);
  assert.equal(liftRun(len, T + 1).s, len);
  assert.equal(liftRun(len, T + 1).v, 0);
  assert.ok(liftRun(len, 0.01).v < 0.1 && liftRun(len, T - 0.01).v < 0.1, 'still at either end');
});

test('the ship lands on the sea port’s deck, three metres over the sea, the lift’s house ahead of its ramp', () => {
  assert.deepEqual({ ...level.shipSite }, { ...PORT_SHIP });
  assert.deepEqual([UNDERWATER_PORT.site.x, UNDERWATER_PORT.site.y, UNDERWATER_PORT.site.z, UNDERWATER_PORT.site.h], [SHIP_SITE.x, SHIP_SITE.y, SHIP_SITE.z, SHIP_SITE.heading]);
  assert.equal(SEA_PORT.y, SEA_Y + 3);
  // the deck under the ship's plan and between the ramp and the lift
  for (const [x, z] of [[PORT_SHIP.x, PORT_SHIP.z], [PORT_SHIP.x - 22, PORT_SHIP.z], [PORT_SHIP.x + 20, PORT_SHIP.z], [PORT_SHIP.x, PORT_SHIP.z - 18], [0, 140], doorSpot('top').filter((_, i) => i !== 1)]) {
    const g = physics.groundAt(x, SEA_PORT.y + 4, z, 10);
    assert.ok(Math.abs(g - SEA_PORT.y) < 0.05, `the deck at ${x}, ${z}: ${g}`);
  }
  // the lift's house is ahead of the hatch (north), clear of the hull's plan
  assert.ok(SHAFT.z < PORT_SHIP.z - 8.4 - 12, 'the house north of the hull, past the ramp');
  // over the side: the sea, no deck
  const off = physics.groundAt(SEA_PORT.x, SEA_PORT.y + 4, SEA_PORT.z + SEA_PORT.r + 4, 10);
  assert.ok(!(off > SEA_Y), 'past the rail, nothing to stand on');
  assert.equal(placeAt(V(0, SEA_PORT.y, 140)), 'The sea port');
});

test('the lift: on at the deck, down through the sea and the Dock’s crown, dry all the way, out by Bastien; and back up', () => {
  const L = level.seaPort.lift;
  L.placed = false;
  const P = traveller(V(0, SEA_PORT.y, 142));
  for (let i = 0; i < 30; i++) frame(P);
  assert.equal(L.at, 'top', 'the cabin waits at the deck when you are up there');
  assert.ok(!P.swim && !(P.inWater?.over > 0), 'on the deck, out of the water');
  assert.ok(walkTo(P, V(...doorSpot('top', SHAFT.r + 1))), 'to the house’s door');
  assert.ok(walkTo(P, V(SHAFT.x, 0, SHAFT.z)), 'into the cabin');
  let wet = 0, off = 0, swam = false;
  for (let i = 0; i < 60 * 18 && L.at !== 'foot'; i++) {
    frame(P);
    if (P.inWater?.over > 0) wet++;
    if (P.swim) swam = true;
    if (Math.abs(P.pos.y - L.y) > 0.3) off++;
    assert.ok(level.air(P.pos.x, P.pos.y + 1, P.pos.z) || P.pos.y > SEA_Y, `dry in the shaft at ${P.pos.y.toFixed(1)}`);
  }
  assert.equal(L.at, 'foot', 'down at the Dock');
  assert.equal(L.rides, 1);
  assert.ok(!swam && wet === 0, `never in the water (${wet} frames)`);
  assert.ok(off < 3, `carried on the cabin all the way (${off} frames off it)`);
  assert.ok(Math.abs(P.pos.y - CABIN.foot) < 0.1, `on the Dock’s floor: ${P.pos.y.toFixed(2)}`);
  for (let i = 0; i < 90; i++) frame(P);
  assert.equal(L.at, 'foot', 'standing on after the ride: it stays');
  // out of its door to Bastien, who keeps the lock
  assert.ok(walkTo(P, V(...doorSpot('foot', SHAFT.r + 1.4))), 'out of the foot’s door');
  const bastien = CONTENT.underwater.npcs.find((n) => n.id === 'bastien');
  assert.ok(Math.hypot(bastien.at[0] - SHAFT.x, bastien.at[1] - SHAFT.z) < 13, 'Bastien by the lift’s foot');
  assert.ok(walkTo(P, V(bastien.at[0] - 1.2, 0, bastien.at[1] + 1.2)), 'walked to Bastien');
  assert.equal(placeAt(P.pos), 'The Dock');
  // and back up
  assert.ok(walkTo(P, V(...doorSpot('foot', SHAFT.r + 1))) && walkTo(P, V(SHAFT.x, 0, SHAFT.z)), 'back into the cabin');
  for (let i = 0; i < 60 * 18 && L.at !== 'top'; i++) frame(P);
  assert.equal(L.at, 'top');
  assert.ok(Math.abs(P.pos.y - SEA_PORT.y) < 0.1, `up on the deck: ${P.pos.y.toFixed(2)}`);
  assert.ok(walkTo(P, V(...doorSpot('top', SHAFT.r + 2))), 'out onto the deck');
});

test('the lift comes when called, and a shut gate keeps you out of the empty shaft', () => {
  const L = level.seaPort.lift;
  L.place('foot');
  const P = traveller(V(...doorSpot('top', SHAFT.r + 5)));
  for (let i = 0; i < 10; i++) frame(P);
  assert.ok(L.gates.top.shut, 'the deck’s gate shut, the cabin down at the Dock');
  assert.ok(!walkTo(P, V(SHAFT.x, 0, SHAFT.z), { secs: 3 }), 'not into the shaft');
  assert.ok(flat(P.pos, V(SHAFT.x, 0, SHAFT.z)) > SHAFT.r - 0.1 && P.pos.y > SEA_PORT.y - 0.2, 'kept out on the deck');
  // standing by the door calls it up
  assert.ok(L.moving || L.at === 'top', 'called up');
  for (let i = 0; i < 60 * 16 && L.at !== 'top'; i++) frame(P);
  assert.equal(L.at, 'top');
  assert.ok(!L.gates.top.shut, 'its gate open');
  assert.ok(walkTo(P, V(SHAFT.x, 0, SHAFT.z)), 'in now');
  // a lift on its own (no one about): stays put
  const lone = new SeaLift({ at: 'top' });
  for (let i = 0; i < 600; i++) lone.update(1 / 60, null);
  assert.equal(lone.at, 'top');
});

test('over the side of the sea port, you are put back on its deck', () => {
  const P = traveller(V(SEA_PORT.x, SEA_PORT.y, SEA_PORT.z + SEA_PORT.r + 6));
  for (let i = 0; i < 60 * 3; i++) frame(P);
  assert.ok(Math.abs(P.pos.y - SEA_PORT.y) < 0.2 && flat(P.pos, V(SEA_PORT.x, 0, SEA_PORT.z)) < SEA_PORT.r, `back on the deck: ${P.pos.toArray().map((v) => v.toFixed(1))}`);
});

test('the shaft: open up through the Dock’s crown, dry from the Dock’s floor to the deck', () => {
  // (the dome's glass is open round it: nothing between the Dock's floor and the cupola over the deck)
  const up = physics.rayDistance(V(SHAFT.x + 1.5, 1, SHAFT.z), V(0, 1, 0), 200);
  assert.ok(up > SEA_PORT.y, `clear up the shaft: ${up.toFixed(1)} m`);
  for (let y = 0.5; y < SEA_PORT.y + 3; y += 4) assert.ok(level.air(SHAFT.x + 2, y, SHAFT.z - 1), `the shaft’s air at ${y}`);
  assert.ok(!level.air(SHAFT.x + SHAFT.r + 2, 40, SHAFT.z), 'the sea outside its glass');
  assert.ok(DOMES.dock.r > SHAFT.oculus && Math.hypot(SHAFT.x - DOMES.dock.x, SHAFT.z - DOMES.dock.z) < 1e-6, 'through the Dock’s crown');
  for (const st of Object.values(STATIONS)) assert.ok(typeof st.label === 'string');
});

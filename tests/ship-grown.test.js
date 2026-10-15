// Issue #338, the author: "My space ship and its interior should be 100% bigger. So it's more spacious inside when I'm
// walking around and feels less cramped. Also the lighting in the ship feels a bit flat? Do we have no light in there?"
// The ship built twice the blockout's size (src/ship/hull.js SHIP_SCALE), the furniture at the traveller's own; every
// place aboard you use still reached on foot from the hatch; the rooms lit by their own key and their lamps
// (materials.js ROOM_LIGHT), the same data for the Unity port. Sizes: tests/room-size.test.js; every world's landing:
// tests/contact-audit.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Ship } from '../src/ship/ship.js';
import { SHIP_SCALE, DECK, CEIL, WALL_IN, HALF_W, NOSE_Z, STERN_Z, LIFT, ROOF } from '../src/ship/hull.js';
import { ROOMS, LAMPS, ROOM_KEY, TABLE, CONSOLE, ALCOVE, DASH, SEATS, inRooms, cockpitHalf, cockpitZ } from '../src/ship/interior.js';
import { ROOM_LIGHT, makeMaterial } from '../src/materials.js';
import { ABOARD } from '../src/story/scientist.js';
import { portMaterial } from '../engine/unity/port-format.js';
import { inkSpec } from '../engine/ink-spec.js';

globalThis.window ??= { addEventListener() {} };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

function flatShip() {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: V(0, 0, 80), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } } }));
  return { physics, level, ship, m: ship.parked };
}

test('twice the blockout: the hull and the rooms grew, the furniture kept the traveller\'s size', () => {
  assert.equal(SHIP_SCALE, 2);
  assert.ok(Math.abs(STERN_Z - NOSE_Z - 52) < 0.01 && Math.abs(HALF_W - 8.4) < 0.01 && Math.abs(CEIL - 5.8) < 0.01, 'the hull 52 m long, 16.8 m wide; 5.8 m under the ceiling');
  assert.ok(Math.abs(ROOF - 8.8) < 0.01 && LIFT >= 3.8 && LIFT <= 4.4, 'the roof 8.8 m over the deck, the deck 4 m up on its legs');
  // the furniture: a table and a console at the waist, a bunk a bed long, seats a seat apart
  assert.ok(TABLE.h < 1 && CONSOLE.h < 1 && DASH.h <= 1, 'the table, the console and the dash at the waist');
  assert.ok(ALCOVE.z1 - ALCOVE.z0 < 3 && WALL_IN - ALCOVE.x < 1.4, 'the bunk\'s alcove a bed long and deep');
  assert.ok(SEATS.x < 1.6 && SEATS.z - DASH.z1 < 1, 'the two seats side by side at the dash');
  // the cockpit's shots follow its seats (cinematics.js, homecoming.js, ShipScene.cs: cockpitZ)
  assert.ok(Math.abs(cockpitZ(-8.15) - SEATS.z) < 1e-9);
  // the windshield comes down near the dash: a seated pilot sees out ahead, not the sky alone
  const { physics, ship, m } = flatShip();
  const eye = ship.world(m, V(-SEATS.x, DECK + 1.25, SEATS.z));
  const fwd = V(0, -0.05, -1).normalize().applyQuaternion(m.group.quaternion);
  const d = physics.rayDistance(eye, fwd, 12);
  assert.ok(d > 0.8, `from the pilot's seat, eyes level, the way ahead clear of the dash and the wall (${d.toFixed(2)} m to the glass)`);
});

/** Walk the real Player along ship-local waypoints; true once `done()` holds. */
function walk({ physics, ship, m }, from, way, done, secs = 40) {
  const P = new Player(physics);
  P.opts.climb = false;
  ship.player = P;
  P.pos.copy(ship.world(m, from.clone().setY(DECK + 0.05)));
  let i = 0;
  for (let f = 0; f < 60 * secs; f++) {
    if (done(P)) return true;
    const t = ship.world(m, way[i].clone().setY(DECK));
    if (Math.hypot(t.x - P.pos.x, t.z - P.pos.z) < 0.6 && i < way.length - 1) i++;
    const h = Math.atan2(t.x - P.pos.x, t.z - P.pos.z);
    P.update(1 / 60, { KeyW: true }, h + Math.PI);
  }
  return done(P);
}

test('every place aboard you use is reached on foot from the hatch: the voicemail, the holo table, the seat, the bunk, Anselm\'s spot', () => {
  const W = flatShip(), { ship, m } = W, P = m.interior.points;
  const near = (p, r) => (pl) => { const l = ship.local(m, pl.pos); return Math.hypot(l.x - p.x, l.z - p.z) < r; };
  const start = P.hatchIn;
  const legs = {
    voicemail: [[P.cockpit], () => ship.atConsole()],
    'holo table': [[V(TABLE.x + 2.2, 0, TABLE.z + 2.0), V(TABLE.x + 1.2, 0, TABLE.z + 0.2)], () => ship.atTable()],
    'the pilot\'s seat': [[V(0, 0, ROOMS.main.z0 + 1), V(-SEATS.x + 0.9, 0, SEATS.z + 0.6)], near(P.seat, 1.2)],
    'the bunk': [[V(2.5, 0, -2.0), P.bunkStand], near(P.bunkStand, 0.8)],
    'Anselm\'s spot in the hold': [[V(0, 0, ROOMS.cabin.z0 - 1), V(0, 0, ROOMS.hold.z0 + 1), V(ABOARD.at[0] - 0.8, 0, ABOARD.at[2] - 0.8)], near(V(...ABOARD.at), 1.4)],
  };
  for (const [name, [way, done]] of Object.entries(legs)) assert.ok(walk(W, start, way, done), `${name}: reached from the hatch`);
});

test('the rooms are lit: lamps in every room, local lights in the level\'s list, and each room\'s own key light', () => {
  const { level, ship, m } = flatShip();
  const lamps = m.interior.lamps;
  assert.ok(lamps.length >= 10, `${lamps.length} lamps`);
  for (const [room, { z0, z1 }] of Object.entries(ROOMS)) assert.ok(lamps.some((l) => l.p.z > z0 && l.p.z < z1), `a lamp in the ${room}`);
  for (const l of lamps) {
    assert.ok(inRooms(l.p, { margin: 0 }) && l.p.y > DECK + 1 && l.p.y < CEIL, `${l.name}: in the rooms, over the furniture`);
    assert.ok(l.r >= 5 && l.r <= 12, `${l.name}: reaches ${l.r} m`);
  }
  // they are the level's local lights (main.js updateLights; the Unity export's level lights), lit with the power on
  const lit = m.lightVecs.filter((v) => level.lights.includes(v) && v.w > 0);
  assert.equal(lit.length, lamps.length, 'every lamp lit, in the level\'s lights');
  ship.setPower('dead', m);
  assert.ok(m.lightVecs.every((v) => v.w === 0), 'dark when the ship is dead');
  // every room material takes the key light (the ship's own frame: nothing to turn) and the lamps' warm pools
  for (const k of ['wallIn', 'wall', 'floor', 'ceiling', 'wood', 'locker', 'cushion']) {
    const mat = m.mats[k];
    assert.ok(mat.defines.ROOM_LIGHT && mat.defines.LAMP_TINT, `${k}: lit as a room`);
    assert.ok(mat.uniforms.uRoomKey.value.w > 0, `${k}: its key on`);
  }
  assert.ok(m.interior.props.material.defines.ROOM_LIGHT, 'the small things too');
  assert.ok(!m.mats.hull.defines.ROOM_LIGHT, 'not the hull outside');
  const k = m.mats.wallIn.uniforms.uRoomKey.value;
  assert.ok(Math.abs(V(k.x, k.y, k.z).length() - 1) < 1e-6 && k.z < -0.5, 'the key from ahead (the windshield)');
  // the cockpit's lamp hangs under its roof, over the floor between the seats and the frame
  const c = lamps.find((l) => l.name === 'cockpit');
  assert.ok(c && Math.abs(c.p.x) < cockpitHalf(c.p.z) - 1, 'the cockpit\'s lamp in the cockpit');
});

test('the room light is engine-neutral: the key and the lamps in the Unity export\'s terms, the port\'s shader the same numbers', () => {
  // the bridge's material (port-format) and the C# port's (export-world materialOf) carry the key as `room`
  const mat = makeMaterial({ color: '#efe2c4', flat: true, room: new THREE.Vector4(ROOM_KEY.dir.x, ROOM_KEY.dir.y, ROOM_KEY.dir.z, 1) });
  const e = portMaterial(inkSpec(mat));
  assert.deepEqual(e.room.map((x) => +x.toFixed(4)), [ROOM_KEY.dir.x, ROOM_KEY.dir.y, ROOM_KEY.dir.z, 1].map((x) => +x.toFixed(4)));
  const exporter = readFileSync(new URL('../scripts/unity-export/export-world.mjs', import.meta.url), 'utf8');
  assert.match(exporter, /m\.defines\?\.ROOM_LIGHT && u\.uRoomKey\) e\.room/);
  assert.match(exporter, /roomLight: \{ key:/);
  assert.match(readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs', import.meta.url), 'utf8'), /SetVector\("_Room"/);
  // Surface.shader: the web's numbers (ROOM_LIGHT) in the port's room branch and its lamps
  const hlsl = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader', import.meta.url), 'utf8');
  const L = ROOM_LIGHT, f = (x) => String(x);
  assert.ok(hlsl.includes(`smoothstep(${f(L.edge[0])}, ${f(L.edge[1])}, dot(normalize(i.objNormal), _Room.xyz))`), 'the key\'s edge');
  assert.ok(hlsl.includes(`lerp(${f(L.shade)}, ${f(L.lit)}, roomKey)`), 'its shade and its lit side');
  assert.ok(hlsl.includes(`${f(L.sky)} * roomKey * _Room.w`), 'the sky\'s colour on the key-lit faces');
  assert.ok(hlsl.includes(`smoothstep(${f(L.cone[0])}, ${f(L.cone[1])}, dl.y / d) * (${f(L.face)} + ${f(+(1 - L.face).toFixed(2))} * max(dot(n, dl / d), 0.0))`), 'the lamps\' cone');
  assert.ok(hlsl.includes(`lerp(L, ${f(L.poolTop)}, smoothstep(${f(L.pool[0])}, ${f(L.pool[1])}, local))`), 'the lamps\' pools');
});

test('?roomlights=folded (issue #364): the console tops and the brushed steel in the lockers\' plain metal, two programs fewer; off, as it was', async () => {
  const { shipMaterials, ROOM_LIGHTS_FOLDED } = await import('../src/ship/model.js');
  assert.equal(ROOM_LIGHTS_FOLDED, false, 'off unless asked for');
  const room = { value: new THREE.Vector4(0, 0, -1, 1) };
  // (a program: its defines and its sources; side and vertex colours share one, scripts/three-program-keys.mjs)
  const key = (m) => JSON.stringify([Object.entries(m.defines ?? {}).sort(), m.vertexShader, m.fragmentShader]);
  const count = (mats, only = () => true) => new Set(Object.values(mats).filter(only).map(key)).size;
  const now = shipMaterials('fold-a', { room }), folded = shipMaterials('fold-b', { room, folded: true });
  const inRoom = (m) => !!m.defines?.ROOM_LIGHT;
  assert.equal(count(now, inRoom), 5, 'the rooms\' five programs: plain, grid, metal, gridded metal, brushed');
  assert.equal(count(folded, inRoom), 3);
  assert.equal(count(folded), count(now) - 2, 'two fewer in all');
  assert.ok(now.panel.defines.S_GRID && now.metal.defines.METAL_BRUSHED, 'by default the grid and the brushing as they were');
  assert.equal(key(folded.panel), key(folded.locker));
  assert.equal(key(folded.metal), key(folded.locker));
  for (const k of Object.keys(now)) if (k !== 'panel' && k !== 'metal') assert.equal(key(folded[k]), key(now[k]), `${k} untouched`);
});

test('?aboard=<room> starts you in that room of the parked ship (development)', () => {
  const { ship, m } = flatShip();
  for (const r of Object.keys(ROOMS)) {
    const s = ship.roomSpot(r);
    const l = ship.local(m, s.pos);
    assert.ok(inRooms(l, { margin: 0 }) && l.z > ROOMS[r].z0 && l.z < ROOMS[r].z1, `${r}: inside it`);
  }
  assert.equal(ship.roomSpot('nowhere'), null);
  assert.match(readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /query\.get\('aboard'\) && !viaShip \? ship\.roomSpot\(query\.get\('aboard'\)\)/);
});

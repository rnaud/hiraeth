import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LEVELS } from '../src/levels/index.js';
import { ORDER, CONTENT } from '../src/levels/content.js';
import { createLab, LAB_MATERIALS, LAB_FACES, LAB_DOORS, LAB_PEOPLE, ROOM_RING, roomCentre } from '../src/levels/lab.js';
import { ROOMS } from '../src/levels/lab-rooms.js';
import { Physics } from '../src/physics.js';
import { buildFlora, floraKeep } from '../src/flora.js';
import { Wildlife, WILDLIFE } from '../src/wildlife.js';
import { COSTUMES } from '../src/costumes.js';

const WORLDS = ['desert', 'incal', 'arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar'];
let built = null;
/** the Lab with its collision, flora and wildlife (built once) */
function lab() {
  if (built) return built;
  const scene = new THREE.Scene();
  const level = createLab(scene);
  const physics = new Physics(scene, level.ground);
  const flora = buildFlora({ scene, level, levelId: 'lab', physics, keep: floraKeep({ level, content: CONTENT.lab }) });
  const wildlife = new Wildlife(scene, level, physics, { content: CONTENT.lab, defs: level.wildlife });
  return (built = { scene, level, physics, flora, wildlife });
}
/** a stand-in player the level can move through its doors */
function walker(pos) {
  return {
    pos: pos.clone(), vel: new THREE.Vector3(), heading: 0, riding: false,
    teleport(p) { this.pos.copy(p); this.vel.set(0, 0, 0); this.heading = 0; },
  };
}
const step = (level, player, n = 3) => { for (let i = 0; i < n; i++) level.update(1 / 60, i / 60, { player }); };

test('the lab: a developer world in no menu, every surface on a pedestal, giant faces', () => {
  const L = LEVELS.find((l) => l.id === 'lab');
  assert.ok(L && L.dev && L.hidden, 'dev only (?level=lab)');
  assert.ok(!ORDER.includes('lab'), 'not on the route');
  const { level } = lab();
  assert.equal(level.id, 'lab');
  assert.ok(LAB_MATERIALS.length >= 10 && new Set(LAB_MATERIALS.map((m) => m.name)).size === LAB_MATERIALS.length);
  const giants = CONTENT.lab.npcs.filter((n) => n.scale >= 3);
  assert.equal(giants.length, LAB_FACES.length, 'the four giants still stand on their plinths');
  level.update(1 / 60, 1);   // the samples turn and the dissolve breathes
});

test('the lab has a biome room for every world, a door to each in the hub, far apart', () => {
  assert.deepEqual(ROOMS.map((r) => r.id).sort(), [...WORLDS].sort());
  assert.equal(LAB_DOORS.length, ROOMS.length);
  for (const [i, d] of LAB_DOORS.entries()) {
    assert.equal(d.title, ROOMS[i].title, 'each door carries its world\'s name');
    assert.ok(Math.hypot(d.x, d.z) > 50 && Math.hypot(d.x, d.z) < 80, 'the doors ring the hub');
  }
  for (let i = 0; i < ROOMS.length; i++) {
    assert.ok(Math.abs(roomCentre(i).length() - ROOM_RING) < 1e-6);
    for (let j = i + 1; j < ROOMS.length; j++) assert.ok(roomCentre(i).distanceTo(roomCentre(j)) > 1200, 'rooms are far apart: only one is ever drawn');
  }
  for (const r of ROOMS) {
    assert.ok(r.sky?.script?.day?.length === 5, `${r.id} has its world's sky`);
    assert.ok(r.atmo && Number.isFinite(r.atmo.fog) && Number.isFinite(r.hour), `${r.id} has its world's haze and hour`);
    assert.ok(r.flora && WILDLIFE[r.id]?.length >= 2, `${r.id} grows its plants and keeps its creatures`);
    assert.ok(r.people.length >= 2, `${r.id} has a few of its people`);
  }
});

test('the rooms\' people are dressed for their own world', () => {
  assert.equal(LAB_PEOPLE.length, ROOMS.reduce((s, r) => s + r.people.length, 0));
  for (const p of LAB_PEOPLE) {
    assert.ok(COSTUMES[p.world], `${p.world} has costumes`);
    assert.ok(CONTENT.lab.npcs.includes(p));
    assert.ok(Number.isFinite(p.y));
  }
});

test('walking into a door takes you to its room and the door behind you takes you home; only that room is drawn', () => {
  const { level } = lab();
  const portals = level.navigationPortals;
  for (const [i, room] of level.rooms.entries()) {
    const into = portals.find((p) => p.room === room);
    const p = walker(into.at.clone().setY(0));
    step(level, p);
    assert.ok(p.pos.distanceTo(room.arrive) < 1e-6, `${room.def.id}: through the door`);
    assert.equal(level.roomAt(p.pos.x, p.pos.z), room);
    assert.ok(room.group.visible && level.rooms.every((r) => r === room || !r.group.visible), 'only the room you are in is drawn');
    // its sky, haze, planets, hour and ink
    assert.equal(level.atmo(p.pos.x, p.pos.z, p.pos.y), room.atmo);
    assert.ok(room.atmo.script?.length > 4, 'its colour script');
    const zone = level.zoneAt(p.pos);
    assert.equal(zone.hour, ROOMS[i].hour);
    assert.equal(zone.preset, 'Moebius print');
    // and home again, in front of the hub's door
    const home = portals.find((q) => q.room === null && q.at.distanceTo(room.arrive) < 20);
    p.pos.copy(home.at);
    for (let k = 0; k < 120; k++) level.update(1 / 60, k / 60, { player: p });   // (past the cooldown)
    assert.equal(level.roomAt(p.pos.x, p.pos.z), null, `${room.def.id}: back in the hub`);
    assert.ok(p.pos.distanceTo(new THREE.Vector3(LAB_DOORS[i].x, 0, LAB_DOORS[i].z)) < 13, "in front of its door");
    assert.ok(level.rooms.every((r) => !r.group.visible), 'no room is drawn from the hub');
    for (let k = 0; k < 120; k++) level.update(1 / 60, k / 60, { player: walker(new THREE.Vector3(0, 0, 4)) });
  }
});

test('straying off a room (over its banks, into the cloud) puts you back at its door', () => {
  const { level } = lab();
  const room = level.rooms.find((r) => r.def.id === 'arzach2');
  const p = walker(room.centre.clone().add(new THREE.Vector3(10, -80, 0)));
  for (let k = 0; k < 120; k++) level.update(1 / 60, k / 60, { player: p });
  assert.ok(p.pos.distanceTo(room.arrive) < 1e-6);
});

test('every room stands on solid ground at its door, its world\'s plants grow in it and its creatures live there', () => {
  const { level, physics, flora, wildlife } = lab();
  for (const room of level.rooms) {
    const a = room.arrive, g = physics.groundAt(a.x, a.y + 2, a.z);
    assert.ok(Number.isFinite(g) && a.y - g > -0.05 && a.y - g < 2.5, `${room.def.id}: ground under the door (${g})`);
    const mine = flora.plants.filter((pl) => level.roomAt(pl.x, pl.z) === room);
    assert.ok(mine.length > 60, `${room.def.id}: ${mine.length} plants`);
    assert.ok(mine.every((pl) => pl.sp.id.startsWith(`${room.def.id}.`)), `${room.def.id}: only its own world's species`);
    assert.ok(mine.every((pl) => Math.hypot(pl.x - room.centre.x, pl.z - room.centre.z) < 130), 'inside the room');
    const herds = wildlife.herds.filter((h) => WILDLIFE[room.def.id].some((d) => d.id === h.def.id));
    assert.ok(herds.length >= 2 && herds.every((h) => h.members.length >= 2), `${room.def.id}: its creatures`);
    for (const h of herds) for (const c of h.members) assert.equal(level.roomAt(c.pos.x, c.pos.z), room);
  }
  // the ground is each room's own heightfield, and the hub's out of them
  const desert = level.rooms.find((r) => r.def.id === 'desert');
  assert.equal(level.ground.heightAt(desert.centre.x + 5, desert.centre.z - 3), desert.ground.heightAt(5, -3));
  assert.equal(level.ground.heightAt(0, 4), 0);
});

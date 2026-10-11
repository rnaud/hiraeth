// The Shadow Room (src/levels/shadow-room.js, ?level=shadows): a test room in the Debug menu with the hard cases for
// the sun's shadows along one walk, the sun held by boards; the shadow QC (.claude/skills/shadow-qc) walks it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SHADOW_ROOM, SUN, sunDir, spotAt, roomParts, moverPoses, leafPanel, groundHeight, MOUND } from '../src/levels/shadow-room.js';
import { LEVELS } from '../src/levels/index.js';
import { worldSections } from '../src/world-picker.js';
import { PEACEFUL } from '../src/foes.js';

test('the room is a test room of the Debug menu, opened with ?level=shadows, peaceful', () => {
  const meta = LEVELS.find((l) => l.id === 'shadows');
  assert.ok(meta && meta.dev && meta.hidden, 'a dev world, off the route');
  assert.ok(worldSections(LEVELS).rooms.some((l) => l.id === 'shadows'), 'under Test rooms');
  assert.ok(PEACEFUL.has('shadows'), 'no foes');
});

test('every case the issue asks for has its spot, and the walk goes through every spot', () => {
  const ids = SHADOW_ROOM.spots.map((s) => s.id);
  assert.deepEqual(ids, ['props', 'poles', 'colonnade', 'foliage', 'arch', 'stairs', 'slopes', 'interior', 'movers', 'tower']);
  const visited = new Set();
  const P = SHADOW_ROOM.path;
  for (let k = 1; k < P.length; k++) for (let t = 0; t <= 1; t += 0.1) {
    const x = P[k - 1][0] + (P[k][0] - P[k - 1][0]) * t, z = P[k - 1][1] + (P[k][1] - P[k - 1][1]) * t;
    const s = spotAt(x, z);
    if (s) visited.add(s);
  }
  assert.deepEqual([...visited].sort(), [...ids].sort(), 'the walk passes through all of them');
  assert.ok(P.filter((w) => w[2] === 'look').length >= 8, 'and stops to look round in most');
  assert.ok(Math.hypot(P.at(-1)[0] - SHADOW_ROOM.spawn[0], P.at(-1)[1] - SHADOW_ROOM.spawn[2]) < 2, 'a loop back to the spawn');
});

test('the receivers (the QC\'s probe patches) lie in their spots and are not too many', () => {
  let n = 0;
  for (const R of SHADOW_ROOM.receivers) {
    assert.ok(SHADOW_ROOM.spots.some((s) => s.id === R.spot), R.spot);
    n += R.nu * R.nv;
    // the patch's middle, on the ground: in its own spot (the tower's face stands just east of its yard)
    const mx = R.from[0] + (R.u[0] * R.nu + R.v[0] * R.nv) / 2, mz = R.from[2] + (R.u[2] * R.nu + R.v[2] * R.nv) / 2;
    if (R.dir[1] < 0) assert.equal(spotAt(mx, mz), R.spot, `${R.spot} patch at ${mx.toFixed(1)}, ${mz.toFixed(1)}`);
  }
  assert.ok(n > 100000 && n < 500000, `${n} rays`);
});

test('the build: a mesh per station and material, the tower tall enough to cross the cascades', () => {
  const P = roomParts();
  for (const s of SHADOW_ROOM.spots) assert.ok(P[s.id] && Object.values(P[s.id]).some((l) => l.length), `${s.id} has things in it`);
  const T = SHADOW_ROOM.tower;
  // a 35° sun throws its top's shadow past the near map's 120 m (the Steam Deck's window) from its foot
  assert.ok(T.spire / Math.tan((35 * Math.PI) / 180) > 110);
  const g = leafPanel(6, 6, 40, 7, 3);
  g.computeBoundingBox();
  assert.ok(Math.abs(g.boundingBox.max.y - 3.04) < 1e-3 && g.boundingBox.max.x <= 3.001, 'a 6 m panel of leaves, 4 cm thick, at 3 m');
  assert.ok(groundHeight(MOUND.x, MOUND.z) > 4.9 && groundHeight(0, 0) < 1e-6, 'flat but for the mound');
});

test('the sun: the boards\' presets and its direction; the movers move', () => {
  const d = sunDir(35, 90);
  assert.ok(Math.abs(d.y - Math.sin((35 * Math.PI) / 180)) < 1e-9 && d.x > 0.8 && Math.abs(d.z) < 1e-9, 'from the east at 35°');
  assert.ok(SUN.el.includes(6) && SUN.el.includes(62), 'from grazing to noon');
  const a = moverPoses(0), b = moverPoses(2);
  for (const k of ['lift', 'slider', 'pendulum', 'fan', 'ball']) assert.notDeepEqual(a[k], b[k], k);
  assert.ok(moverPoses(4).lift.pos[1] > 3, 'the lift up at the top of its run');
});

test('the room builds: the boards hold the sun, the clock gives it back, the lift and the slider can be stood on', () => {
  const scene = new THREE.Scene();
  const meta = LEVELS.find((l) => l.id === 'shadows');
  const warn = console.warn; console.warn = () => {};
  let level;
  try { level = meta.create(scene); } finally { console.warn = warn; }
  assert.equal(level.id, 'shadows');
  const api = level.shadowRoom;
  api.setSun(12, 180);
  const dir = new THREE.Vector3(0, 1, 0);
  level.lightAt(new THREE.Vector3(), dir);
  assert.ok(dir.distanceTo(sunDir(12, 180)) < 1e-9, 'the held sun');
  api.useClock(9.5);
  const keep = new THREE.Vector3(0.3, 0.8, 0.1);
  level.lightAt(new THREE.Vector3(), keep);
  assert.deepEqual(keep.toArray(), [0.3, 0.8, 0.1], 'the clock\'s own');
  assert.equal(level.dynamic().length, 2);
  const y0 = level.dynamic()[0].solid.top;
  level.update(2, 2);
  assert.ok(level.dynamic()[0].solid.top > y0, 'the lift rose');
  api.freeze(true);
  const y1 = level.dynamic()[0].solid.top;
  level.update(1, 3);
  assert.equal(level.dynamic()[0].solid.top, y1, 'held still');
  assert.equal(api.movers.length, 5);
  assert.ok(scene.children.filter((o) => o.isMesh && /^Shadow room tower/.test(o.name)).length >= 1, 'the tower a mesh of its own');
});

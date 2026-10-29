// Issue #776, the author: "The back of my ship is see through? Fix that. Also when I'm about to enter the ship on the left
// is can see through as well. Same when I'm in the cockpit." Three holes in the playable caravan's shell, held shut here by
// rays through the built model (src/ship/caravan-shell.js, src/ship/caravan-interior.js cockpitArc):
//   - the tail: the hull's loft ended in an open ring between the four boosters, a view down the hull to the bow;
//   - forward of the porch: nothing closed the 3 m between the skin and the main room's wall, a tunnel to the windshield;
//   - the cockpit: its deck was a 4.7 m half-width slab in a 7 m wide nose, a slot each side down into the hull.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildShipModel } from '../src/ship/model.js';
import { PORCH_POCKET } from '../src/ship/caravan-shell.js';
import { ROOMS } from '../src/ship/caravan-layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
let model;
async function caravan() {
  if (model) return model;
  const b = readFileSync(new URL('../public/models/ships/caravan-a/playable.glb', import.meta.url));
  const tpl = (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene;
  model = buildShipModel({ caravan: tpl });
  model.group.updateMatrixWorld(true);
  return model;
}
/** Every drawn mesh of the parked ship, hit from either side (a ray that meets nothing went through the ship). */
function drawn(m, skip = () => false) {
  const out = [];
  m.group.traverse((n) => {
    if (!n.isMesh || skip(n)) return;
    for (let p = n; p; p = p.parent) if (p.visible === false) return;
    out.push(n);
  });
  return out;
}
const firstHit = (meshes, o, d, far) => {
  const rc = new THREE.Raycaster(o, d, 0, far);
  rc.params.Mesh = {};
  const sides = new Map();
  for (const n of meshes) for (const mat of [].concat(n.material)) { sides.set(mat, mat.side); mat.side = THREE.DoubleSide; }
  try { return rc.intersectObjects(meshes, false)[0] ?? null; } finally { for (const [mat, s] of sides) mat.side = s; }
};

test('the tail is closed: from behind, nothing between the boosters looks down the hull', async () => {
  const m = await caravan();
  const hull = drawn(m, (n) => !/hull/.test(n.parent?.name ?? '') && n.name !== 'hull-tail-cap');
  const open = [];
  for (let x = -2.5; x <= 2.5; x += 0.25) for (let y = 0.5; y <= 6; y += 0.25) {
    const h = firstHit(hull, V(x, y, 32), V(0, 0, -1), 16);   // (the hold's back wall stands at z 16.1)
    if (!h) open.push(`${x},${y}`);
  }
  assert.deepEqual(open, [], 'rays from behind that met no shell before the rooms');
  assert.ok(m.group.getObjectByName('hull-tail-cap'), 'the tail is capped');
});

test('forward of the porch: the skin and the room wall are closed off just past where the door parks', async () => {
  const m = await caravan();
  const all = drawn(m);
  const open = [];
  // from just forward of the doorway, looking toward the bow between the skin and the room's wall
  for (let x = -5.75; x <= -3.5; x += 0.25) for (let y = 0.5; y <= 5.75; y += 0.25) {
    const o = V(x, y, -1.2);
    if (!firstHit(all, o, V(-1, 0, 0), 3)) continue;   // (out past the skin: the outside air)
    if (!firstHit(all, o, V(0, 0, -1), 4)) open.push(`${x},${y}`);
  }
  assert.deepEqual(open, [], 'rays that ran on forward inside the hull');
  // the plate stands clear of the open door (it slides 2.47 m toward the bow: Ship.setDoor)
  const door = m.group.getObjectByName('entry-door');
  door.position.x -= 1.9; m.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(door);
  door.position.x += 1.9; m.group.updateMatrixWorld(true);
  assert.ok(box.min.z > PORCH_POCKET.z + 0.03, `the open door (to z ${box.min.z.toFixed(2)}) clear of the pocket's plate (${PORCH_POCKET.z})`);
});

test('the porch pocket\'s outline still follows the shell and the walls round it', async () => {
  const m = await caravan();
  const around = drawn(m, (n) => n.name === 'porch-pocket' || !(/hull/.test(n.parent?.name ?? '') || /ship-interior-(wall|floor|ceiling)$/.test(n.name)));
  const [cx, cy] = PORCH_POCKET.centre, z = PORCH_POCKET.z, P = PORCH_POCKET.outline;
  // where the ray from the centre leaves the outline polygon
  const exit = (dx, dy) => {
    let best = Infinity;
    for (let i = 0; i < P.length; i++) {
      const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
      const ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((ax - cx) * ey - (ay - cy) * ex) / den, u = ((ax - cx) * dy - (ay - cy) * dx) / den;
      if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
    }
    return best;
  };
  const off = [];
  for (let a = 0; a < 360; a += 4) {
    const dx = Math.cos((a * Math.PI) / 180), dy = Math.sin((a * Math.PI) / 180);
    const h = firstHit(around, V(cx, cy, z), V(dx, dy, 0), 14);
    if (!h) { off.push(`${a}°: open`); continue; }
    const e = exit(dx, dy);
    if (Math.abs(h.distance - e) > 0.15) off.push(`${a}°: shell at ${h.distance.toFixed(2)} m, outline at ${e.toFixed(2)} m`);
  }
  assert.deepEqual(off, [], 'remeasure PORCH_POCKET.outline (src/ship/caravan-shell.js) against the shell');
});

test('the cockpit\'s deck reaches the curved shell: no slot beside or ahead of it down into the hull', async () => {
  const m = await caravan();
  const all = drawn(m);
  const hull = drawn(m, (n) => !/hull|cockpit/.test(n.parent?.name ?? ''));
  const r = ROOMS.cockpit, holes = [];
  for (let z = r.z0 - 2; z <= r.z1 - 0.25; z += 0.5) for (let x = -7.25; x <= 7.25; x += 0.5) {
    const o = V(x, r.floor + 0.4, z);
    // only points inside the shell at that height (a shell surface out beyond them on both sides)
    if (!firstHit(hull, o, V(-1, 0, 0), 9) || !firstHit(hull, o, V(1, 0, 0), 9) || !firstHit(hull, o, V(0, 0, -1), 9)) continue;
    // within 10 cm of the shell's inner face the deck's 8 cm inset is allowed
    const near = [V(-1, 0, 0), V(1, 0, 0), V(0, 0, -1)].some((d) => (firstHit(hull, o, d, 0.12)));
    if (near) continue;
    const h = firstHit(all, o, V(0, -1, 0), 6);
    if (!h || h.point.y < r.floor - 0.3) holes.push(`${x.toFixed(2)},${z.toFixed(2)}`);
  }
  assert.deepEqual(holes, [], 'places in the cockpit where a look down falls past its deck');
});

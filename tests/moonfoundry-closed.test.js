// The Moon Foundry closed in (issue #731: "closed up, not in an open world, with more mood and steam"; src/foundry-hall.js,
// src/foundry-steam.js, docs/systems/worlds.md "The Moon Foundry, closed in"): walls on every side up to the roof, the
// dock roofed round its hatch, no horizon from anywhere you stand; the steam pooled; every place the quests, the people,
// the sites and the finds use inside, and walked to on foot from the ship.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { WALL, DOCK, HATCH, GATES, BAY, FURNACES, HALL, GRATES, enclosed, inHall, dockDepth, outside, steamVents, chainSpots } = await import('../src/foundry-hall.js');
const { FoundrySteam, STEAM, BREATHS, steamScale, nearestVents } = await import('../src/foundry-steam.js');
const { sitesOf } = await import('../src/encounters/sites.js');
const { MOONFOUNDRY_CONTENT, SHIP, MOUTH } = await import('../src/levels/moon-foundry.js');
const { BENCHES } = await import('../src/benches-data.js');
const { FRAGMENTS } = await import('../src/fragments-data.js');
const { COURTS } = await import('../src/finds/courts.js');
const { TRIALS } = await import('../src/trials/data.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
globalThis.location = { search: '?level=moonfoundry' };
const W = A.loadWorld('moonfoundry');
const { level, physics } = W;
test.after(() => W.dispose());
const blocked = (x, z, y = 0.3) => physics.pushCapsule(V(x, y + 0.05, z), 0.35, 0.6, 1.9) !== null;

test('closed in: the hall walled on every side from the floor to the roof, the front wall shut but for its two gates, the dock walled', () => {
  // a capsule set in the walls' line is pushed out of it everywhere along them (but in a gate's opening)
  const misses = [];
  for (let z = WALL.z0 + 2; z < WALL.z1 - 2; z += 6) for (const x of [WALL.x0 - 0.2, WALL.x1 + 0.2]) if (!blocked(x, z)) misses.push([x, z]);
  for (let x = WALL.x0 + 2; x < WALL.x1 - 2; x += 6) if (!blocked(x, WALL.z0 - 0.2)) misses.push([x, WALL.z0]);
  for (let x = WALL.x0 + 2; x < WALL.x1 - 2; x += 6) {
    const gate = Object.values(GATES).some((g) => x > g.x0 + 1 && x < g.x1 - 1);
    const b = blocked(x, WALL.z1 + 0.2);
    if (gate && b) misses.push(['the gate is shut', x]);
    if (!gate && !b && !Object.values(GATES).some((g) => x > g.x0 - 7 && x < g.x1 + 7)) misses.push(['the front wall is open', x]);
  }
  for (let z = DOCK.z0 + 3; z < DOCK.z1 - DOCK.cut; z += 6) for (const x of [DOCK.x0 - 0.2, DOCK.x1 + 0.2]) if (!blocked(x, z)) misses.push(['dock', x, z]);
  for (let x = DOCK.x0 + DOCK.cut; x < DOCK.x1 - DOCK.cut; x += 6) if (!blocked(x, DOCK.z1 + 0.2)) misses.push(['dock back', x]);
  assert.deepEqual(misses, []);
  // up to the roof: a capsule high on a wall is stopped too, and nothing climbs them (noClimb)
  for (const [x, z] of [[WALL.x0 - 0.2, -100], [WALL.x1 + 0.2, -100], [0, WALL.z0 - 0.2], [-120, WALL.z1 + 0.2]]) assert.ok(blocked(x, z, HALL.roof - 4), `the wall reaches the roof at ${x}, ${z}`);
  assert.ok(physics.noClimbNear(V(WALL.x0 + 0.3, 6, -100), 0.8), 'the walls are not climbed');
  // the gates: walked through from the dock into the hall up the aisle, and by the rail gate up the east bay
  for (const x of [0, GATES.rail.x0 + 4]) for (let z = SHIP.z - 30; z > MOUTH - 20; z -= 2) assert.ok(!blocked(x, z, level.ground.heightAt(x, z)), `through the gate at ${x}, ${z}`);
});

test('closed in: no horizon from where you stand, the roof over the hall and the dock but for the hatch over the ship', () => {
  // every way you look, level, from the landing, the hall's middle, the far corners: a wall within the foundry
  for (const eye of [level.spawn.clone().add(V(0, 1.6, 0)), V(0, 6, -120), V(-150, 4, -270), V(150, 4, -20), V(0, 40, -150)]) {
    for (let a = 0; a < 32; a++) {
      const dir = V(Math.sin(a / 32 * Math.PI * 2), 0, Math.cos(a / 32 * Math.PI * 2)), d = physics.rayDistance(eye.clone(), dir, 2000);
      assert.ok(d < 520, `a wall seen from ${eye.toArray().map((v) => v.toFixed(0))} toward ${a}`);
    }
  }
  // a roof overhead everywhere but the hatch: the drawn ceilings, cast at from below
  const meshes = []; W.scene.traverse((o) => { if (o.isMesh && o.visible && !o.isInstancedMesh && !o.isSkinnedMesh) meshes.push(o); });
  const rc = new THREE.Raycaster(), up = V(0, 1, 0);
  const roofOver = (x, z) => { rc.set(V(x, 50, z), up); rc.far = 80; return rc.intersectObjects(meshes, false).some((h) => h.point.y > 58); };
  for (const [x, z] of [[-140, -260], [-100, 0], [0, -60], [60, -200], [140, -100], [150, 20], [-90, 70], [100, 170], [-60, 120]]) assert.ok(roofOver(x, z), `a roof over ${x}, ${z}`);
  rc.set(V(SHIP.x, 50, SHIP.z), up); rc.far = 400;
  assert.ok(!rc.intersectObjects(meshes, false).length, 'the hatch open over the ship: it comes down and goes up through it');
  assert.ok(level.shipSite.shaft && SHIP.x > HATCH.x0 + 20 && SHIP.x < HATCH.x1 - 20 && SHIP.z > HATCH.z0 + 15 && SHIP.z < HATCH.z1 - 15, 'the ship stands under the hatch');
});

test('closed in: the ground rises to the crater’s rock outside the walls; inside it is the floor', () => {
  for (let x = -160; x <= 160; x += 40) for (let z = -280; z <= 40; z += 40) assert.equal(outside(x, z), 0);
  assert.ok(level.ground.heightAt(WALL.x1 + 40, -100) > 40 && level.ground.heightAt(0, DOCK.z1 + 40) > 40 && level.ground.heightAt(DOCK.x0 - 40, 100) > 40, 'the rock round it');
  assert.ok(Math.abs(level.ground.heightAt(SHIP.x, SHIP.z)) < 0.01, 'the dock’s floor flat under the ship');
  assert.ok(dockDepth(SHIP.x, SHIP.z) > 40 && !inHall(SHIP.x, SHIP.z), 'the ship in the dock');
  assert.ok(BAY.roof > HALL.roof && FURNACES.length >= 6);
});

test('every place the world uses is inside: the people, the quests’ marks, the sites, the temple’s door, the finds', () => {
  const out = [];
  const check = (what, x, z) => { if (!enclosed(x, z, 1)) out.push(`${what} at ${x.toFixed(0)}, ${z.toFixed(0)}`); };
  check('the spawn', level.spawn.x, level.spawn.z);
  for (const p of MOONFOUNDRY_CONTENT.npcs) check(p.id ?? 'a foundry hand', p.at[0], p.at[1]);
  for (const s of sitesOf('moonfoundry')) check(s.id, s.at[0], s.at[2]);
  check('the temple’s door', level.temple.outside.door.at.x, level.temple.outside.door.at.z);
  for (const b of BENCHES.moonfoundry ?? []) check('a bench', b.at[0], b.at[2]);
  for (const f of FRAGMENTS.moonfoundry ?? []) check('a fragment', f[0], f[2]);
  const court = COURTS?.moonfoundry; if (court) check('the founders’ yard', court.at[0], court.at[1]);
  for (const g of TRIALS?.moonfoundry?.gates ?? []) check('a trial gate', g[0], g[1]);
  for (const s of level.sights ?? []) check(s.name, s.at[0], s.at[2]);
  assert.deepEqual(out, []);
});

test('the quests’ places are walked to on foot from the ship: Hedda, Liesel, Bertil, Dun, the gantry’s stair, the Casting-House’s door', () => {
  const from = level.spawn.clone();
  const ids = { hedda: null, ottilie: null, bertil: null, dun: null };
  for (const p of MOONFOUNDRY_CONTENT.npcs) if (p.id in ids) ids[p.id] = V(p.at[0], p.y ?? level.ground.heightAt(p.at[0], p.at[1]), p.at[1]);
  const door = level.temple.outside.door.at;
  const goals = { ...ids, 'the stair': V(level.ways.main[0][0], 0, 20), 'the Casting-House’s door': V(door.x, door.y, door.z) };
  for (const [name, to] of Object.entries(goals)) {
    assert.ok(to, `${name} is in the world`);
    const s = A.standNear(W, to, { radius: 4, up: 3 }) ?? to;
    const w = A.walkTo(W, from, s, { cell: 2, near: 4 });
    assert.ok(w.ok, `on foot from the ship to ${name} (within ${w.closest?.toFixed?.(0)} m)`);
  }
});

test('the steam: one pooled mesh, the nearest vents breathing, never over its pool, nothing stolen from a live puff, the same every run', () => {
  assert.ok(steamScale(0) === 0 && steamScale(1) === 0 && steamScale(0.5) > 0.9);
  const vents = steamVents({ furnace: { x: 70, z: -14, r: 6.5 }, pillars: level.pillars });
  assert.ok(vents.length > 30 && vents.every((v) => BREATHS[v.kind]), 'vents of every kind round the walls, the furnaces, the grates');
  assert.ok(vents.filter((v) => v.kind === 'smoke').length >= FURNACES.length, 'smoke off every furnace');
  assert.ok(GRATES.every(([x, z]) => vents.some((v) => v.x === x && v.z === z)), 'a column out of every grate');
  const eye = V(-140, 5, -30), near = nearestVents(vents, eye);
  assert.ok(near.length === STEAM.active && near.every((i, k) => k === 0 || eye.distanceToSquared(V(vents[i].x, vents[i].y, vents[i].z)) >= eye.distanceToSquared(V(vents[near[k - 1]].x, vents[near[k - 1]].y, vents[near[k - 1]].z))));
  assert.equal(nearestVents(vents, V(0, 0, 5000)).length, 0, 'none breathe far from every vent');
  const run = () => {
    const S = new FoundrySteam(null, vents);
    let most = 0, early = 0;
    for (let i = 0; i < 60 * 40; i++) {
      const before = S.list.slice();
      S.update(1 / 60, i / 60, i < 1200 ? eye : V(0, 3, -120));
      most = Math.max(most, S.live);
      const kept = new Set(S.list);
      for (const p of before) if (!kept.has(p) && p.age < p.life - 1e-9) early++;
    }
    assert.ok(most <= STEAM.max && S.mesh.count <= STEAM.max && most > 60, `the pool holds (${most} at most)`);
    assert.equal(early, 0, 'no puff taken away before its time');
    const out = S.list.map((p) => p.pos.toArray().map((v) => v.toFixed(3)).join()).join('|');
    S.dispose();
    return out;
  };
  assert.equal(run(), run(), 'the same breath every time (no rng per frame)');
  assert.equal(level.steam.mesh.parent, W.scene, 'one mesh in the world');
});

test('the chains hang clear of the moons, the cranes’ runs and the gantry', () => {
  const spots = chainSpots((x, z) => Math.hypot(x + 52, z + 40) > 30);
  assert.ok(spots.length > 20 && spots.every(([x, z, L]) => inHall(x, z) && L > 10 && L < 70));
});

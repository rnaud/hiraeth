import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// a little DOM for the people's speech balloons (the story never needs a real page)
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createDesert } = await import('../src/levels/desert.js');
const { Physics } = await import('../src/physics.js');
const { Crowd } = await import('../src/crowd.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE, THINGS } = await import('../src/story/desert-data.js');
const { STORY } = await import('../src/desert-sites.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { allTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');

const scene = new THREE.Scene();
const level = createDesert(scene);
const terrain = level.ground;
const physics = new Physics(scene, terrain);
const Q = level.qanat;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const fakeNPC = (kind) => ({ kind, pooled: true, person: null, assign(p) { this.person = p; }, release() { this.person = null; } });
const crowd = new Crowd(scene, physics, { spots: level.crowdSpots(), makeNPC: fakeNPC });

// a stand-in player who can be put anywhere
const player = { pos: V(0, terrain.heightAt(0, 0), 0), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
let storyDone = false;
const npcs = [];
const rt = createStory({ levelId: 'desert', scene, physics, level, player, npcs, crowd, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete: () => { storyDone = true; } },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests } = rt;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, i * dt, { camera }); crowd.update(dt, i * dt, player, camera); } };
const talk = (person, choices) => {
  const r = new DialogueRunner(person, { game, quests });
  for (const c of choices) {
    while (!r.lastPage) r.advance();
    const pick = r.choices().find((x) => (typeof c === 'number' ? x.index === c : x.text.startsWith(c)));
    assert.ok(pick, `${person.name}: no choice "${c}" in ${JSON.stringify(r.choices().map((x) => x.text))} at ${r.nodeId}`);
    r.choose(pick.index);
    while (!r.ended && r.advance());
  }
  return r;
};
const stand = (p, label) => {
  const g = physics.groundAt(p.x, p.y + 3, p.z, 8);
  assert.ok(Number.isFinite(g) && Math.abs(g - p.y) < 1.2, `${label} has solid ground (${g?.toFixed?.(2)} vs ${p.y.toFixed(2)})`);
  return g;
};

test('the city, its camps, the giant and the cave stand on solid ground, 300–600 m from the start', () => {
  const c = Q.city.center, d = Math.hypot(c.x, c.z);
  assert.ok(d > 300 && d < 600, `city ${d.toFixed(0)} m from spawn`);
  stand(Q.city.gate, 'the main gate');
  stand(Q.city.backGate, 'the back gate');
  stand(Q.city.plinthStair, 'the foot of the stairs');
  stand(Q.city.wellLook, 'the top terrace by the well');
  stand(Q.city.stele, 'the stele');
  stand(Q.camps.center, 'the camps');
  for (const f of Q.camps.fires) stand(f.clone().setY(f.y), 'a camp fire');
  stand(Q.giant.door, 'the skull’s mouth');
  stand(Q.cave.inside, 'the cave passage');
  const pool = Q.cave.poolCenter, bed = physics.groundAt(pool.x, pool.y + 3, pool.z);
  assert.ok(bed < Q.cave.origin.y - 1 && bed > Q.cave.origin.y - 2.2, 'the pool has a shallow bed you can wade on');
  // the top terrace is high above the plaza (you climb the stairs to the tree)
  assert.ok(Q.city.wellLook.y - Q.city.center.y > 6, 'terraces rise round the tree');
  // the cave has a roof: nothing of the sky above the pool
  assert.ok(physics.rayDistance(V(pool.x, pool.y + 2, pool.z), V(0, 1, 0), 60) < 30, 'the dome closes over the pool');
});

test('you can walk from the camps through the gate, up the stairs to the well, and out of the back gate', () => {
  const path = [Q.camps.center, Q.city.gate, Q.city.plinthStair, Q.city.wellLook];
  // round the trunk on the top terrace, down the back stairs, out through the back gate
  const C = Q.city, top = C.top - C.center.y;
  const back = [C.wellLook.clone(), C.local(-4, top, 9.6), C.local(-8, top, 4), C.local(-8, top, -6), C.local(0, top, -11), C.local(0, 0, -32), C.backGate, Q.giant.local(-22, 0, -8), Q.giant.local(-18, 0, 17), Q.giant.door];
  for (const route of [path, back]) {
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1], n = Math.ceil(a.distanceTo(b) / 0.5);
      let y = physics.groundAt(a.x, a.y + 1, a.z);
      for (let k = 1; k <= n; k++) {
        const p = a.clone().lerp(b, k / n);
        const g = physics.groundAt(p.x, y + 0.65, p.z);
        assert.ok(g > y - 3 && g - y < 0.62, `a step of ${(g - y).toFixed(2)} m at ${p.x.toFixed(1)},${p.z.toFixed(1)} (leg ${i})`);
        // nothing at knee or chest height in the way
        const dir = b.clone().sub(a).setY(0).normalize();
        for (const h of [0.9, 1.6]) assert.ok(physics.rayDistance(V(p.x, g + h, p.z).addScaledVector(dir, -0.25), dir, 0.5) > 0.49, `a wall at ${p.x.toFixed(1)},${p.z.toFixed(1)} h ${h}`);
        y = g;
      }
    }
  }
  // and down: the skull's mouth leads to the cave, the passage leads back out
  const [down, up] = level.portals.slice(-2);
  assert.ok(down.at.distanceTo(Q.giant.door) < 2 && down.to.distanceTo(Q.cave.inside) < 0.1);
  assert.ok(up.to.distanceTo(Q.giant.door) < 5);
});

test('the procession walks one loop round the city: on the sand, clear of the camps, 40–120 people', () => {
  const r = crowd.route('procession');
  assert.ok(r?.loop && r.column, 'one unbroken loop');
  const walkers = crowd.people.filter((p) => p.walk?.route === r);
  assert.ok(walkers.length >= 40 && walkers.length <= 120, `${walkers.length} walkers`);
  for (const q of r.pts) assert.ok(Math.abs(physics.groundAt(q.x, q.y + 1, q.z, 3) - q.y) < 1e-3, 'on the ground');
  assert.ok(r.total > 1200, `${r.total.toFixed(0)} m round`);
  // it circles the city: every point between 120 and 300 m out
  for (const q of r.pts) { const d = Math.hypot(q.x - STORY.city.x, q.z - STORY.city.z); assert.ok(d > 110 && d < 320, `${d.toFixed(0)} m from the city`); }
  // a banner, a lantern and a drummer walk in it
  for (const role of ['banner', 'lantern', 'drum']) assert.ok(walkers.some((p) => p.role === role), role);
  // the column moves, and stops while someone in it talks to you
  const before = r.column.clock;
  crowd.update(1, 100, at(V(0, 0, 0)), camera);
  assert.ok(r.column.clock > before);
  crowd.hold('procession', 5);
  const held = r.column.clock;
  crowd.update(1, 101, player, camera);
  assert.equal(r.column.clock, held);
  // the Speaker keeps to its head
  const head = crowd.columnHead('procession', 0);
  assert.ok(head && Math.abs(physics.groundAt(head.x, head.y + 2, head.z, 4) - head.y) < 1.5);
});

test('scattered props keep out of the city, and the camps’ people are placed', () => {
  // nothing from the random scatter stands inside the walls (a mesa in the plaza would be a disaster)
  scene.updateMatrixWorld(true);
  for (const o of scene.children) {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry.boundingSphere && !o.geometry.computeBoundingSphere) continue;
    o.geometry.computeBoundingSphere?.();
    const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
    if (o.geometry.boundingSphere.radius > 400) continue;   // the terrain, the horizon
    assert.ok(Math.hypot(c.x - STORY.city.x, c.z - STORY.city.z) > 75 || o.name === '', `a ${o.geometry.type} at ${c.x.toFixed(0)},${c.z.toFixed(0)} inside the city`);
  }
  const camp = crowd.people.filter((p) => p.spot?.id === 'camp');
  assert.ok(camp.length > 25, `${camp.length} people at the camps`);
  assert.ok(camp.some((p) => p.perch === 'kerb'), 'some sit on the benches by the fires');
});

// the instanced puffs of the tree's smoke column: their centres and how much bluer than red they are, on average
const smokePuffs = (sm) => {
  const m = new THREE.Matrix4(), p = V(0, 0, 0), s = V(0, 0, 0), q = new THREE.Quaternion(), c = new THREE.Color();
  const out = [];
  for (let i = 0; i < sm.mesh.count; i++) {
    sm.mesh.getMatrixAt(i, m); m.decompose(p, q, s);
    sm.mesh.getColorAt(i, c);
    out.push({ pos: p.clone(), size: Math.max(s.x, s.y, s.z), cool: c.b - c.r });
  }
  return out;
};
const coolness = (sm) => { const ps = smokePuffs(sm); return ps.reduce((a, p) => a + p.cool, 0) / ps.length; };

test('the burning tree sends up a tall column of smoke, a landmark that never gets in the way', () => {
  const sm = Q.city.smoke;
  assert.ok(sm?.mesh?.isInstancedMesh, 'one instanced mesh of puffs');
  assert.ok(sm.mesh.userData.noCollide, 'the smoke is not solid');
  assert.ok(level.noShadow?.includes(sm.mesh), 'it casts no shadow on the city');
  assert.ok(sm.material.userData.farDepth, 'its far-shading exception matches the material shader (it stays clear of the distance fog)');
  // run it a while: puffs rise from the crown flame, swell, and drift off downwind
  const wind = V(2.07, 0, 1.41);
  for (let i = 0; i < 600; i++) sm.update(1 / 2, i / 2, wind);
  const base = Q.city.treeBase;
  const puffs = smokePuffs(sm).filter((p) => p.size > 0.5);
  const top = Math.max(...puffs.map((p) => p.pos.y));
  assert.ok(top - base.y > 250, `the column reaches ${(top - base.y).toFixed(0)} m above the tree`);
  // it starts in the tree's crown and leans downwind (never upwind)
  const low = puffs.filter((p) => p.pos.y - base.y < 70);
  assert.ok(low.length > 4 && low.every((p) => Math.hypot(p.pos.x - base.x, p.pos.z - base.z) < 25), 'the lowest puffs rise out of the crown');
  const high = puffs.filter((p) => p.pos.y - base.y > 0.9 * (top - base.y));
  const downwind = high.reduce((a, p) => a + (p.pos.x - base.x) * wind.x + (p.pos.z - base.z) * wind.z, 0);
  assert.ok(downwind > 0, 'the plume drifts downwind');
  // nothing to stand on: straight down through the column you land on the tree or the sand, not on smoke
  const mid = puffs.find((p) => p.pos.y - base.y > 150);
  const g = physics.groundAt(mid.pos.x, mid.pos.y + 5, mid.pos.z, 400);
  assert.ok(!Number.isFinite(g) || g < base.y + 40, `the ray through a puff at ${mid.pos.y.toFixed(0)} m lands at ${g}`);
});

test('the main quest runs from the dead ship to a powered one', () => {
  assert.equal(quests.stage('desert.power'), 'camps');
  assert.equal(quests.objective().label, 'The pilgrims’ camps');
  at(Q.camps.center); step(3);
  assert.equal(quests.stage('desert.power'), 'ama');
  talk(PEOPLE.ama, ['My ship']);
  assert.ok(quests.has('jar'), 'Ama gives a jar');
  step(2);
  assert.equal(quests.stage('desert.power'), 'speaker');
  // the marker follows the Speaker round the circuit
  const sp = rt.world.people.speaker;
  assert.ok(quests.objective().position.distanceTo(sp.pos) < 0.01);
  talk(PEOPLE.speaker, ['Why is the tree']);
  step(2);
  assert.equal(quests.stage('desert.power'), 'well');
  talk(THINGS.well, [0]);
  step(2);
  assert.equal(quests.stage('desert.power'), 'down');
  // the objective is in the cave, so the guide routes through the skull's mouth
  at(Q.city.wellLook);
  assert.match(rt.objective().label, /giant’s mouth/);
  at(Q.cave.inside); step(2);
  assert.equal(quests.stage('desert.power'), 'channel');
  // the fallen rib: the tool's push clears it
  const bone = allTargets().find((t) => t.kind === 'bone');
  assert.ok(bone?.enabled(), 'the rib is a target while it blocks the channel');
  bone.onHit('shoot');
  assert.equal(game.flag('desert.channel.open'), undefined, 'a shot only rocks it');
  bone.onHit('push');
  assert.equal(game.flag('desert.channel.open'), true, 'a push rolls it off');
  // the tree drinks: its smoke takes on the cool colours of the new fire, rising up the column
  const warm = coolness(Q.city.smoke);
  for (let i = 0; i < 80; i++) Q.city.smoke.update(1 / 2, i / 2, null);
  assert.ok(coolness(Q.city.smoke) > warm + 0.03, `the smoke turns cool (${warm.toFixed(3)} → ${coolness(Q.city.smoke).toFixed(3)})`);
  step(90, 1 / 10);   // the rib rolls, the pool rises
  assert.equal(quests.stage('desert.power'), 'fill');
  const refills = [];
  game.on('tool:refill', (e) => refills.push(e));
  at(Q.cave.poolCenter.clone().setY(Q.cave.origin.y - 1.5)); step(2);
  assert.ok(quests.has('water') && !quests.has('jar'), 'the jar fills');
  assert.deepEqual(refills.map((e) => e.addColour), [true], 'wading refills the tool, with a new colour the first time');
  step(2);
  assert.equal(quests.stage('desert.power'), 'ship');
  // back to the ship (the ship's own hatch emits ship:enter; walking up works too)
  game.emit('ship:enter');
  step(2);
  assert.equal(quests.isDone('desert.power'), true);
  assert.equal(game.flag('ship.powered'), true);
  assert.equal(game.flag('world.desert.done'), true);
  assert.ok(game.keepsakes().some((k) => k.id === 'desert.knowing'), 'the keepsake: what the giants left');
});

test('side quests: Teo’s drum, Ilo at the skull, Oum home from the dunes, the mask in the sand', async () => {
  // the drum, picked up under the old ribcage (with E), returned to Teo
  talk(PEOPLE.teo, ['I’ll look']);
  assert.equal(quests.stage('desert.drum'), 'find');
  const drumAt = V(STORY.drum.x, terrain.heightAt(STORY.drum.x, STORY.drum.z), STORY.drum.z);
  at(drumAt);
  const e = bestInteractable(player);
  assert.equal(e?.entry.id, 'drum');
  e.entry.use(player);
  assert.equal(quests.stage('desert.drum'), 'return');
  talk(PEOPLE.teo, []);
  assert.equal(quests.isDone('desert.drum'), true);
  assert.ok(game.keepsakes().some((k) => k.kind === 'song'));
  // Ilo follows you to the skull and waits there; you tell her what you saw
  talk(PEOPLE.ilo, ['Come with me']);
  assert.equal(quests.stage('desert.ilo'), 'lead');
  const ilo = rt.world.people.ilo;
  at(Q.giant.door.clone()); ilo.pos.copy(Q.giant.door).add(V(2, 0, 0));
  step(3);
  assert.equal(quests.stage('desert.ilo'), 'below');
  talk(PEOPLE.ilo, ['A pool']);
  assert.equal(quests.isDone('desert.ilo'), true);
  // Oum walks with you, slowly, to the fire
  const oum = rt.world.people.oum;
  at(oum.pos.clone().add(V(1.5, 0, 0)));
  talk(PEOPLE.oum, ['Walk with me']);
  assert.equal(quests.stage('desert.oum'), 'lead');
  at(Q.camps.fires[0].clone().add(V(4, 0, 0))); oum.pos.copy(Q.camps.fires[0]).add(V(6, 0, 0));
  step(3);
  assert.equal(quests.isDone('desert.oum'), true);
  talk(PEOPLE.oum, []);
  assert.ok(quests.has('cord'));
  // the old story beacon is now a short visit
  talk(CONTENT.desert.npcs[1], ['What sleeps']);
  at(V(-20, terrain.heightAt(-20, -372), -372)); step(2);
  assert.equal(quests.isDone('desert.mask'), true);
  await new Promise((r) => setTimeout(r, 1300));
  assert.ok(storyDone, 'the main quest closed the desert’s story page');
  clearInteractables();
});

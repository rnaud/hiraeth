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
const { PEOPLE, THINGS, LINES, ITEMS } = await import('../src/story/desert-data.js');
const { COOL_FIRE } = await import('../src/story/flames.js');
const { STORY } = await import('../src/desert-sites.js');
const INTERACT = await import('../src/interact.js');
const { clearInteractables, bestInteractable } = INTERACT;
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
const player = { pos: V(0, terrain.heightAt(0, 0), 0), vel: V(), wind: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
/** Turned toward a point, as a player walking up to it is (E picks what you face: src/interact.js). */
const facing = (p) => { const d = p.clone().sub(player.pos); d.y = 0; if (d.lengthSq() > 1e-6) player.heading = Math.atan2(d.x, d.z); return player; };   // (the stub frame: dir(h) = (sin h, 0, cos h))
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, pssts: 0, psst() { this.pssts++; } };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
let storyDone = false;
const npcs = [];
const rt = createStory({ levelId: 'desert', scene, physics, level, player, npcs, crowd, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete: () => { storyDone = true; } },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests } = rt;
const wellEntry = INTERACT.allInteractables().find((x) => x.id === 'well');   // (the well's prompt: the last test looks into it)
// people: also walk the story people (main.js does it every frame; most tests don't need them to move)
const step = (n = 1, dt = 1 / 30, { people = false } = {}) => { for (let i = 0; i < n; i++) { camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, i * dt, { camera }); crowd.update(dt, i * dt, player, camera); if (people) for (const p of npcs) p.update(dt, player, camera); } };
const talk = (person, choices) => {
  quests.opening(person.id);   // (as Dialogue.start does: the main quest starts with its first talk)
  const r = new DialogueRunner(person, { game, quests });
  for (const c of choices) {
    // to the last page of a node with choices (through any `next` chain)
    while (!r.ended && (!r.lastPage || !r.choices().length) && r.advance());
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


test('places to stop: the Hearth’s frieze, the little mask in the head’s chamber, the salvager’s slate at the crashed hull', () => {
  const { allInteractables } = INTERACT;
  const H = level.hearth, LM = level.landmarks, R = level.maskRooms[0];
  const find = (id) => allInteractables().find((e) => e.id === id);
  for (const [id, foot, label] of [['hearth.carving', H.carvingFoot, 'before the frieze'], ['slate', LM.wreckSlateFoot, 'by the slate'], ['smallMask', R.floor, 'the chamber’s floor']]) {
    const e = find(id);
    assert.ok(e, `${id} can be looked at`);
    const g = physics.groundAt(foot.x, foot.y + 3, foot.z, 8);
    assert.ok(Number.isFinite(g) && Math.abs(g - foot.y) < 1.2, `${label} is walkable (${g?.toFixed?.(2)} vs ${foot.y.toFixed(2)})`);
    assert.ok(e.distance({ pos: foot.clone() }) < 3.2, `${id} answers from ${label}`);
  }
  // the frieze knows when you have carried the stone yourself; the mask, when you have seen its face in Vael II
  const said = (def) => { const r = new DialogueRunner(def, { game, quests }); return r.pages.join(' '); };
  assert.ok(!/You have been one of them/.test(said(THINGS.carving)) || game.flag('desert.stone.taken') || game.flag('world.desert.done'));
  const was = game.flag('arzach2.face.seen');
  game.set('arzach2.face.seen', true);
  assert.match(said(THINGS.smallMask), /lone tower’s plinth in Vael II/);
  game.set('arzach2.face.seen', was ?? false);
  // the slate, then Marrow about it, once
  new DialogueRunner(THINGS.slate, { game, quests });
  assert.equal(game.flag('desert.wreck.read'), true);
  const metBefore = game.flag('met.marrow');
  game.set('met.marrow', true);
  const r = new DialogueRunner(PEOPLE.marrow, { game, quests });
  if (!quests.isActive('desert.bike') && !(game.flag('desert.bike.found') && !game.flag('desert.marrow.bike'))) {
    assert.equal(r.nodeId, 'hull', 'Marrow brings up his old camp himself');
    assert.match(r.pages.join(' '), /Most ships that come down just come down/);
    assert.equal(game.flag('desert.marrow.hull'), true);
    assert.notEqual(new DialogueRunner(PEOPLE.marrow, { game, quests }).nodeId, 'hull', 'once');
  }
  game.set('met.marrow', metBefore ?? false);
});

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

test('the roofs are solid where they are drawn: domes, bulbs and flat roofs hold you up', () => {
  // from above the city: wherever a roof is drawn (well over the street), the feet land on it, not inside it
  const C = Q.city, meshes = [];
  Q.root.traverse((o) => { if (o.isMesh && o.visible && !/collision/.test(o.name) && o.geometry?.attributes.position && !o.isInstancedMesh) meshes.push(o); });
  const rc = new THREE.Raycaster(), bad = [];
  let roofs = 0;
  for (let x = -60; x <= 60; x += 1.3) for (let z = -60; z <= 60; z += 1.3) {
    if (Math.hypot(x, z) < 28 || Math.hypot(x, z) > 58) continue;              // (the tree and its terraces: own tests)
    const w = C.local(x, 60, z);
    rc.set(w, V(0, -1, 0)); rc.far = 90;
    const hit = rc.intersectObjects(meshes, false)[0];
    if (!hit) continue;
    const street = physics.groundAt(w.x, C.center.y + 0.6, w.z, 3);
    if (!Number.isFinite(street) || hit.point.y - street < 2.5) continue;   // not a roof
    if (hit.face && hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y < 0.35) continue;   // a wall's edge, a needle
    roofs++;
    const g = physics.groundAt(w.x, hit.point.y + 0.5, w.z, 1.5);
    if (!Number.isFinite(g) || hit.point.y - g > 0.25) bad.push(`${x.toFixed(1)},${z.toFixed(1)} (${hit.object.name}): ${Number.isFinite(g) ? (hit.point.y - g).toFixed(2) + ' m into it' : 'hollow'}`);
  }
  assert.ok(roofs > 200, `roofs sampled (${roofs})`);
  assert.ok(bad.length < roofs * 0.03, `you sink into ${bad.length} of ${roofs} roof spots: ${bad.slice(0, 6).join('; ')}`);
});

test('feet stand on what is drawn: the terraces round the tree, the plaza, the avenue, and the trunk', () => {
  // the drawn surfaces (render meshes, never collided) against the ground the feet are planted on (physics)
  const C = Q.city, meshes = [];
  Q.root.traverse((o) => { if (o.isMesh && o.visible && !/collision/.test(o.name) && o.geometry?.attributes.position) meshes.push(o); });
  const rc = new THREE.Raycaster();
  const drawnBelow = (p) => { rc.set(p, V(0, -1, 0)); rc.far = 40; return rc.intersectObjects(meshes, false)[0]; };
  const T = C.top - C.center.y;
  let checked = 0, total = 0;
  const bad = [];
  // rings on each tier (between the stairs), the plaza round the terraces, the avenue to the gate
  const spots = [];
  for (const [r0, r1, h] of [[19, 24.6, 2.2], [12.5, 17.1, 4.4], [6, 11.2, T]]) for (let r = r0; r <= r1; r += 1.4) for (let a = 0.35; a < Math.PI * 2 - 0.35; a += 0.21) if (Math.abs(a - Math.PI) > 0.35) spots.push([Math.sin(a) * r, h, Math.cos(a) * r]);
  for (let r = 26; r <= 29.5; r += 1.5) for (let a = 0.4; a < Math.PI * 2 - 0.4; a += 0.3) spots.push([Math.sin(a) * r, 0, Math.cos(a) * r]);
  for (let z = 27; z <= 62; z += 2.5) for (const x of [-1.5, 1.5]) spots.push([x, 0, z]);
  for (const [x, h, z] of spots) {
    const w = C.local(x, h + 3, z);
    if (Math.hypot(w.x - C.treeBase.x, w.z - C.treeBase.z) < 6.6) continue;     // the trunk's foot and its flare
    total++;
    const g = physics.groundAt(w.x, w.y, w.z, 10), hit = drawnBelow(w);
    if (!hit || Math.abs(hit.point.y - g) > 0.5) continue;                     // a root, a bench, a prop over it
    if (hit.object === C.bark) continue;                                        // a root's tail, low over the paving (walked through)
    checked++;
    if (Math.abs(hit.point.y - g) > 0.04) bad.push(`${x.toFixed(1)},${z.toFixed(1)}: drawn ${(hit.point.y - g).toFixed(3)} m off`);
  }
  assert.ok(checked > total * 0.8, `most of the paving checked (${checked} of ${total})`);
  assert.deepEqual(bad.slice(0, 6), [], `the drawn paving is where the feet stand (${bad.length} off)`);
  // the trunk: its collider is the bark, so climbing hands and feet touch what you see
  let n = 0;
  for (let y = 3.1; y < 17.5; y += 1.6) for (let a = 0; a < Math.PI * 2; a += 0.45) {   // (over the roots, under the crown's flame)
    const d = V(Math.sin(a), 0, Math.cos(a)), from = C.treeBase.clone().addScaledVector(d, 9).setY(C.top + y);
    const dir = d.clone().negate(), solid = physics.rayDistance(from, dir, 9);
    rc.set(from, dir); rc.far = 9;
    const hit = rc.intersectObjects(meshes, false).find((h) => h.object.material?.uniforms && h.distance > 0);
    if (!hit || !Number.isFinite(solid) || Math.abs(hit.distance - solid) > 1) continue;   // (the ledge, a limb)
    n++;
    assert.ok(Math.abs(hit.distance - solid) < 0.22, `the bark at ${y.toFixed(1)} m, angle ${a.toFixed(2)}: drawn ${hit.distance.toFixed(2)}, solid ${solid.toFixed(2)}`);
  }
  assert.ok(n > 40, `the trunk checked all round (${n})`);
});

test('you can walk from the camps through the gate, up the stairs to the well, and out of the back gate', () => {
  const path = [Q.camps.center, Q.city.gate, Q.city.plinthStair, Q.city.wellLook];
  // round the trunk, through the back gate, then round the jaw to its open front
  const C = Q.city, top = C.top - C.center.y;
  const back = [C.wellLook.clone(), C.local(-4, top, 9.6), C.local(-8, top, 4), C.local(-8, top, -6), C.local(0, top, -11), C.local(0, 0, -32), C.backGate, Q.giant.local(-22, 0, -8), Q.giant.local(-18, 0, 24), Q.giant.local(0, 0, 24), Q.giant.door];
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
  const down = level.portals.find((p) => p.label === 'giant’s mouth'), up = level.portals.find((p) => p.label === 'passage up');
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

test('the great tree’s smoke column (once it burns) is a tall landmark that never gets in the way', () => {
  const sm = Q.city.smoke;
  assert.equal(sm.mesh.visible, false, 'none while the tree is cold');
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

test('a new game: the quest doesn’t just appear; Marrow, at your ship, calls you over and points you to the city', () => {
  const W = rt.world, m = W.people.marrow;
  assert.equal(quests.isStarted('desert.power'), false, 'no quest on landing');
  assert.equal(quests.objective().label, 'Marrow, by your ship', 'the scout finds the one to ask');
  assert.ok(flat(m.pos, level.spawn) < 18, 'Marrow is at your ship');
  // (but well clear of where it came down: the hull is 13 m round, he stands 22 m from its centre: src/ship/landing.js)
  assert.ok(flat(m.pos, level.spawn) > 6, 'not under the ramp');
  // he calls you over (a word, every few seconds), and turns to you; he never starts talking himself
  at(m.pos.clone().add(V(9, 0, 0)));
  for (let i = 0; i < 12 * 30; i += 10) step(10, 1 / 30, { people: true });
  assert.ok(W.calls.marrow.calls >= 1 && /Sky-person|Over here/.test(m.shout?.text ?? ''), 'he calls');
  assert.ok(!rt.dialogue.open, 'no talk on its own');
  // talk to him (the usual prompt): the quest starts in that talk, in his words
  at(m.pos.clone().add(V(1.5, 0, 0)));
  assert.equal(bestInteractable(player)?.entry.id, 'talk.marrow');
  bestInteractable(player).entry.use(player);
  assert.ok(rt.dialogue.open && rt.dialogue.runner.nodeId === 'wreck', 'the scar on the hull');
  assert.equal(quests.stage('desert.power'), 'city', 'under way as he speaks');
  const r = rt.dialogue.runner;
  for (let i = 0; i < 12 && rt.dialogue.open; i++) {
    rt.dialogue.revealed = Infinity;
    const c = r.choices();
    if (r.lastPage && c.length && !c.every((x) => x.end)) rt.dialogue.choose((c.find((x) => /no power/.test(x.text)) ?? c[0]).index);
    else rt.dialogue.next();
  }
  if (rt.dialogue.open) rt.dialogue.close();
  assert.match(r.pages.join(' '), /Qanat/, 'he says where');
  assert.match(r.pages.join(' '), /Nour/, 'and whom to ask');
  assert.ok(toasts.some((t) => /^Quest: The Tree That Drinks/.test(t)), 'the quest, said once the talk is over');
  assert.equal(quests.objective().label, 'Qanat, under the dark tree', 'now the scout finds the city');
  step(30, 1 / 30, { people: true });
  const ticks = W.calls.marrow.calls;
  step(12 * 30, 1 / 30, { people: true });
  assert.equal(W.calls.marrow.calls, ticks, 'he has said his piece: no more calling');
});

test('a new game steps out with a bare back to a cold tree: no flame, no smoke, no sparks, no burn; walk to the city past the camps', async () => {
  const { items } = await import('../src/items.js');
  const { updateHazards } = await import('../src/hazards.js');
  assert.equal(items.has('backpack'), false, 'the traveller’s back is bare');
  assert.equal(quests.stage('desert.power'), 'city');
  assert.equal(quests.objective().label, 'Qanat, under the dark tree');
  // the tree stands cold
  assert.equal(game.flag('desert.tree.lit'), undefined);
  assert.equal(Q.city.lit, 0, 'not lit');
  assert.equal(Q.city.flames.lit, 0, 'no flame');
  assert.equal(Q.city.smoke.mesh.visible, false, 'no smoke column');
  assert.equal(Q.city.embers.mesh.visible, false, 'no sparks');
  step(2);
  assert.equal(Q.city.light.w, 0, 'it gives no light');
  const inFlame = { pos: Q.city.crown.clone().add(V(0, -6, 0)), vel: V(), hurt() { this.hurtBy = true; } };
  assert.equal(updateHazards(0.5, inFlame), null, 'climbing into the crown burns nothing');
  assert.equal(talk(PEOPLE.ama, ['What is that great dark tree?']).pages.join(' ').includes('went out'), true, 'Ama: it went out the night the light sang');
  assert.ok(quests.objective().position.distanceTo(Q.city.gate) < 0.01, 'the marker stands at the city gate');
  // without the backpack the rib is heaved by hand (nothing breaks without a tool)
  assert.equal(rt.world.toolHasPush(), false);
  // the camps and the gate wave you on toward the city
  const campers = crowd.people.filter((p) => p.spot?.id === 'camp');
  assert.ok(campers.some((p) => p.lines.some((l) => /city|tree|Nour/.test(l))), 'the camps point the way');
  assert.equal(talk(PEOPLE.ama, ['My ship']).nodeId, 'early', 'Ama sends you on to the city');
  assert.ok(!quests.has('jar'), 'no jar yet: that comes when Nour sends you');
  assert.equal(talk(PEOPLE.speaker, []).nodeId, 'early', 'the Speaker waves you on too');
  at(Q.camps.center); step(3);
  assert.equal(quests.stage('desert.power'), 'city', 'the camps are on the way, not the goal');
  assert.ok(flat(rt.world.people.marrow.pos, Q.camps.center) < 40, 'Marrow is home by his crates');
  // through the gate: inside the walls
  at(Q.city.plinthStair); step(2);
  assert.equal(quests.stage('desert.power'), 'box');
  assert.equal(quests.current('desert.power').label, 'The ledge on the tree');
});

test('the makers’ chest is on its ledge up the tree; opening it (its tank empty) gathers Qanat at the foot and brings Nour', async () => {
  const { items } = await import('../src/items.js');
  const { createBoxes } = await import('../src/boxes/index.js');
  const boxes = createBoxes({ levelId: 'desert', scene, physics, level, player, quests });
  const box = boxes.list.find((b) => b.item === 'backpack');
  const L = Q.city.ledge;
  assert.ok(box.pos.distanceTo(L.box) < 0.05, 'on the makers’ ledge');
  assert.ok(quests.objective().position.distanceTo(box.pos) < 0.01, 'the marker stands on the box');
  const W = rt.world, nour = W.people.nour;
  assert.ok(nour.seat !== null && nour.pos.distanceTo(L.bench.at) < 0.5, 'Nour sits on her bench under the ledge');
  // first sight of it: the people on the terrace turn and murmur (the tree's flare: it shows once the tree burns)
  W.state.flare = 0;
  at(Q.city.stairTop); step(40);
  assert.ok(W.ledge.noticed, 'the chest is noticed');
  assert.ok(W.state.flare > 0.5, 'the tree notices');
  assert.ok([...W.villagers, W.people.hessa].some((n) => n.shout && /sky|hum|fell|tree|Grandmother/.test(n.shout.text)), 'a murmur');
  // Nour, before it opens: it has not opened in living memory; it opens for one who fell from the sky
  const before = talk(PEOPLE.nour, []);
  assert.equal(before.nodeId, 'shut');
  assert.match(before.pages.join(' '), /living memory/);
  assert.match(before.pages.join(' '), /fell from the sky/);
  // open it (the opening scene itself is tested in boxes.test.js)
  at(box.pos.clone().add(V(Math.sin(box.yaw) * 0.8, 0, Math.cos(box.yaw) * 0.8)));
  boxes.open(box.id, { instant: true });
  assert.equal(items.has('backpack'), true);
  step(2);
  assert.equal(quests.stage('desert.power'), 'elder');
  assert.equal(quests.objective().label, 'Nour, the eldest');
  assert.equal(game.flag('desert.shrine.gathered'), true);
  assert.equal(game.flag('tool.empty'), true, 'the tank in it is empty');
  assert.equal(game.flag('tool.dregs'), 1, 'but for one shot of the makers’ old fluid');
  assert.equal(Q.city.lit, 0, 'the tree stays cold');
  assert.ok(W.gatherSpots.length >= W.villagers.length, `room for everyone to gather (${W.gatherSpots.length} spots)`);
  for (const p of W.gatherSpots) stand(p, 'a gathering spot');
  // they walk over (the ones in the avenue up the main stairs); Nour gets up and waits at the tree's foot
  // while you're still up on the ledge, calling you down; once you're down, she comes to you and calls you
  // over (a "psst", every few seconds), but never starts talking herself: that is yours, on the prompt
  assert.equal(nour.seat, null, 'Nour stands');
  for (let i = 0; i < 12 * 30; i += 10) step(10, 1 / 30, { people: true });
  assert.ok(!rt.dialogue.open, 'not while you are up there');
  assert.ok(flat(nour.pos, L.foot) < 3 && Math.abs(nour.pos.y - L.foot.y) < 0.6, 'she waits at the foot of the ledge');
  assert.match(nour.shout?.text ?? '', /Come down/, 'and calls you down');
  at(L.foot.clone().addScaledVector(V(Math.sin(L.yaw), 0, Math.cos(L.yaw)), 1.5));
  const p0 = sound.pssts;
  for (let i = 0; i < 30 * 30 && sound.pssts - p0 < 2; i += 10) step(10, 1 / 30, { people: true });
  assert.ok(!rt.dialogue.open, 'Nour doesn’t start talking by herself');
  assert.ok(flat(nour.pos, player.pos) < 3, 'she has come to you');
  assert.ok(sound.pssts - p0 >= 2, `she calls you, again and again (${sound.pssts - p0})`);
  assert.match(nour.shout?.text ?? '', /Psst|child/, 'a psst');
  const turned = Math.atan2(player.pos.x - nour.pos.x, player.pos.z - nour.pos.z) - nour.heading;
  assert.ok(Math.abs(Math.atan2(Math.sin(turned), Math.cos(turned))) < 0.6, 'turned to you');
  const prompt = bestInteractable(player);
  assert.equal(prompt?.entry.id, 'talk.nour', 'the usual prompt');
  prompt.entry.use(player);
  assert.ok(rt.dialogue.open && rt.dialogue.person.id === 'nour', 'and you talk');
  assert.equal(rt.dialogue.runner.nodeId, 'opened');
  assert.match(rt.dialogue.runner.pages.join(' '), /opened/);
  rt.dialogue.close();
  step(18 * 30, 1 / 30, { people: true });
  const near = W.villagers.filter((n) => flat(n.pos, box.pos) < 7).length;
  assert.ok(near >= 4, `Qanat gathers at the tree’s foot under the ledge (${near} of ${W.villagers.length})`);
  // a real conversation, with choices
  // (and the well beside her, listened at with her: it was a stage of its own)
  const r = talk(PEOPLE.nour, ['Who are the Givers?', 'Why a star?', 'My ship has no power', 'Why me?', 'All right', 'The well is right here', 'Ama’s jar']);
  assert.equal(game.flag('desert.elder.heard'), true);
  assert.equal(game.flag('desert.well.seen'), true, 'the well, heard with Nour');
  assert.match(PEOPLE.nour.talk.nodes.rim.say.join(' '), /face the back gate/, 'what the well said is hers to say now');
  assert.equal(r.ended, false, 'a last word before you go');
  step(2);
  assert.equal(quests.stage('desert.power'), 'ask');
  await new Promise((res) => setTimeout(res, 3400));
  assert.ok(toasts.some((t) => /nearly empty: one last swallow/.test(t) && /One shot/.test(t)), 'it says the tank is nearly empty: one shot');
  assert.ok(!toasts.some((t) => /Try shooting/.test(t)), 'no nudge to try an empty tool');
  boxes.dispose();
});
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const use = (id) => {
  const e = bestInteractable(player);
  assert.equal(e?.entry.id, id, `E is "${id}" here (got ${e?.entry.id})`);
  e.entry.use(player);
  return e;
};
const promptOf = (e) => (typeof e.entry.prompt === 'function' ? e.entry.prompt() : e.entry.prompt);

test('the main quest, end to end: an empty tank, the rib levered off, the tank filled, the well, the bike, the Hearth, the stone, the tree lit, the ship', async () => {
  const { items } = await import('../src/items.js');
  const W = rt.world, H = level.hearth;
  assert.equal(quests.stage('desert.power'), 'ask');
  assert.equal(quests.objective().label, 'Ama’s jar, at the camp fires');
  assert.ok(quests.objective().position.distanceTo(W.people.ama.pos) < 0.01, 'the marker is on Ama');
  // Nour said the Speaker's verse herself (the first hour shorter: the Speaker is no stage of his own now)
  assert.match(PEOPLE.nour.talk.nodes.quest.say.map((s) => s.text ?? s).join(' '), /mouth is a door/);
  talk(THINGS.well, [0]);   // (the well can still be looked at: it isn't a stage any more)
  const ama = talk(PEOPLE.ama, ['I’ll bring it back full']);
  assert.ok(quests.has('jar'), 'Ama gives the jar, now that Nour sent you');
  assert.match(ama.pages.join(' '), /skull is beyond the back gate/, 'and points the way');
  step(2);
  assert.equal(quests.stage('desert.power'), 'down', 'the jar is the one errand before the way down');
  // the Speaker still has the old words whole, for whoever walks with him
  const said = talk(PEOPLE.speaker, ['Nour says', 'Is there a way down']);
  assert.match(said.pages.join(' '), /mouth is a door/);
  assert.equal(game.flag('desert.speaker.heard'), true, 'his old words (the giants, the swamp of lights)');
  step(2);
  assert.equal(quests.stage('desert.power'), 'down');
  // the objective is in the cave, so the guide routes through the skull's mouth
  at(Q.city.wellLook);
  assert.match(rt.objective().label, /giant’s mouth/);
  at(Q.cave.inside); step(2);
  assert.equal(quests.stage('desert.power'), 'channel');

  // ---- the rib: the tank is empty, so no push; your arms can't move it; the keepers' pole can
  assert.equal(items.has('backpack'), true);
  assert.equal(game.flag('tool.empty'), true, 'the tank is empty');
  assert.equal(W.dry(), true);
  assert.equal(W.toolHasPush(), false, 'an empty tank pushes nothing');
  const bone = allTargets().find((t) => t.kind === 'bone');
  assert.ok(quests.objective().position.distanceTo(Q.cave.bone.position) < 0.01, 'the marker is on the rib');
  at(Q.cave.bone.position.clone().setY(Q.cave.origin.y).add(V(-1.5, 0, 1.5))); facing(Q.cave.bone.position);
  const heaveIt = bestInteractable(player);
  assert.equal(heaveIt?.entry.id, 'bone');
  assert.equal(promptOf(heaveIt), 'heave the fallen rib');
  heaveIt.entry.use(player);
  assert.equal(game.flag('desert.channel.open'), undefined, 'far too heavy for your arms');
  assert.ok(toasts.at(-1).includes('far too heavy'), 'it says so');
  const L = W.lever;
  assert.ok(quests.objective().position.distanceTo(L.leanFoot) < 0.01, 'then the marker goes to the keepers’ pole by the mural');
  at(L.leanFoot.clone().add(V(0.6, 0, 0.6)));
  use('keepers.pole');
  assert.ok(quests.has('pole'), 'you carry the pole');
  assert.ok(quests.objective().position.distanceTo(L.pivot) < 0.01, 'and the marker on the carved post');
  at(L.postAt.clone().addScaledVector(V(-Q.cave.chDir.z, 0, Q.cave.chDir.x).normalize(), -2.4));
  for (let i = 0; i < L.HEAVES; i++) {
    const e = bestInteractable(player);
    assert.equal(e?.entry.id, 'keepers.post');
    assert.match(promptOf(e), i === 0 ? /lever the rib/ : /lean on the pole/);
    e.entry.use(player);
    step(30);
    if (i < L.HEAVES - 1) assert.equal(game.flag('desert.channel.open'), undefined, `heave ${i + 1}: it lifts, and settles back`);
  }
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(game.flag('desert.channel.open'), true, 'the third heave tips it off the channel');
  assert.ok(!quests.has('pole'), 'the pole stays by the post');
  bone.onHit('push');   // (nothing left to push)
  // the water runs; the tree drinks, and the tree stays cold
  step(90, 1 / 10);   // the rib rolls, the pool rises
  assert.ok(flat(Q.cave.bone.position, Q.cave.boneRest.pos) > 2, 'the rib lies where it rolled');
  assert.equal(Q.city.lit, 0, 'the water alone lights nothing');
  assert.equal(quests.stage('desert.power'), 'fill');

  // ---- the pool: the empty tank fills (and takes the giant's colour), and the jar
  const refills = [];
  game.on('tool:refill', (e) => refills.push(e));
  at(Q.cave.poolCenter.clone().setY(Q.cave.origin.y - 1.5)); step(2);
  assert.ok(quests.has('water') && !quests.has('jar'), 'the jar fills');
  assert.deepEqual(refills.map((e) => e.addColour), [true], 'wading fills the tool, with a new colour the first time');
  assert.equal(game.flag('tool.empty'), false, 'the tank is full now, for good');
  assert.equal(W.dry(), false);
  assert.ok(toasts.some((t) => /empty tank fills/.test(t)), 'it says so');
  step(2);
  assert.equal(quests.stage('desert.power'), 'rise');

  // ---- not yet: the ship won't take still water
  game.emit('ship:enter');
  assert.ok(quests.has('water') && !game.flag('desert.ship.fed'), 'the jar’s water is still: it wants the spark too');

  // ---- the well: you watch the water rise up the shaft; the tree stays cold
  assert.ok(quests.objective().position.distanceTo(Q.city.wellLook) < 0.01, 'the marker is at the well');
  at(Q.city.wellLook);
  step(3);
  assert.ok(W.rise.on, 'the water rises while you watch');
  assert.ok(Q.city.wellWater.visible && Q.city.wellWater.position.y < Q.city.well.y + 0.4, 'from low in the shaft');
  for (let i = 0; i < 40 && !game.flag('desert.well.watched'); i++) step(30, 1 / 10);
  assert.equal(game.flag('desert.well.watched'), true);
  assert.ok(Math.abs(Q.city.wellWater.position.y - (Q.city.well.y + 0.95)) < 1e-3, 'it brims');
  assert.equal(Q.city.lit, 0, 'and still the tree is cold');
  assert.equal(talk(THINGS.well, []).nodeId, 'full');
  step(2);
  assert.equal(quests.stage('desert.power'), 'spark');
  // Nour tells of the spark-stone and the Givers' Hearth
  const cold = new DialogueRunner(PEOPLE.nour, { game, quests });
  assert.equal(cold.nodeId, 'cold', 'Nour: the tree drank, and stays cold');
  assert.match(cold.pages.join(' '), /spark-stone/);
  assert.match(cold.pages.join(' '), /Givers’ Hearth/);
  while (!cold.ended && (!cold.lastPage || !cold.choices().length) && cold.advance());
  assert.deepEqual(cold.choices().map((c) => c.text.replace(/^~\w+~ /, '')), ['How far is it?', 'I’ll bring the stone back.']);
  assert.equal(game.flag('desert.spark.heard'), true);
  step(2);
  assert.equal(quests.stage('desert.power'), 'bike');
  // the bike's errand starts a moment after her words; the marker goes to Marrow, then the hollow
  await new Promise((r) => setTimeout(r, 2600));
  assert.equal(quests.stage('desert.bike'), 'ask');
  quests.track('desert.power');
  assert.ok(quests.objective().position.distanceTo(W.people.marrow.pos) < 0.01, 'the marker is on Marrow');
  talk(PEOPLE.marrow, ['I’ll go and dig it out']);
  quests.track('desert.power');
  assert.ok(quests.objective().position.distanceTo(W.hollow.site.bike) < 0.01, 'then on the hollow');
  at(W.hollow.site.bike.clone().add(V(1.5, 0, 0)).setY(terrain.heightAt(W.hollow.site.bike.x + 1.5, W.hollow.site.bike.z)));
  use('bike.tarp');           // the tarp
  step(30);
  const wake = bestInteractable(player);
  assert.equal(promptOf(wake), 'wake the hoverbike', 'a full tank wakes it');
  wake.entry.use(player);
  step(2);
  assert.equal(game.flag('desert.bike.found'), true);
  assert.equal(quests.stage('desert.power'), 'hearth');

  // ---- the Givers' Hearth: far out in the red rocks, the marked stones on the way
  const d = Math.hypot(H.door.x - Q.city.center.x, H.door.z - Q.city.center.z);
  assert.ok(d > 1500, `the Hearth is ${d.toFixed(0)} m from Qanat: farther than walking`);
  assert.ok(quests.objective().position.distanceTo(H.door) < 0.01, 'the marker is at its door');
  assert.ok(H.stones.length >= 8, `${H.stones.length} marked stones on the way`);
  for (let i = 1; i < H.stones.length; i++) assert.ok(H.stones[i].distanceTo(H.stones[i - 1]) < 200, 'a stone in sight of the last');
  at(H.doorFront); step(2);
  assert.equal(quests.stage('desert.power'), 'stone');
  const [inPortal] = level.portals.filter((p) => p.label === 'Givers’ Hearth');
  assert.ok(inPortal && inPortal.to.distanceTo(H.inside) < 0.1, 'its door leads into the hall');
  at(H.inside); step(2);
  // the stone breathes light behind its grille: take it? not yet
  const glowA = H.stoneLight.w;
  step(45);
  assert.notEqual(H.stoneLight.w, glowA, 'the stone’s light pulses');
  at(H.shelfFront.clone().add(V(0, 0, -1.6)));
  assert.notEqual(bestInteractable(player)?.entry.id, 'hearth.stone', 'the grille is down: no taking it');
  // a shot rocks the ball; a push rolls it down its groove, it drops, and the grille rises
  const weight = allTargets().find((t) => t.kind === 'weight');
  at(H.plinthFront); step(1);
  assert.ok(weight.enabled());
  weight.onHit('shoot');
  assert.equal(game.flag('desert.hearth.open'), undefined, 'a shot only rocks it');
  weight.onHit('push');
  step(30 * 5);
  assert.equal(game.flag('desert.hearth.open'), true, 'the grille is up');
  assert.ok(H.grille.position.y - H.grilleRest.y > 1.5);
  // climb up to the shelf and take it
  at(H.shelfFront.clone().add(V(0, 0, -1.6)));
  use('hearth.stone');
  assert.ok(quests.has('stone') && game.flag('desert.stone.taken'));
  step(2);
  assert.equal(quests.stage('desert.power'), 'light');
  assert.equal(H.stone.visible, false, 'in your pack: nothing floats about you');
  assert.ok(quests.carried().includes(ITEMS.stone), 'your gear lists it');
  assert.equal(talk(PEOPLE.nour, []).nodeId, 'stone');

  // ---- home to the well: set the stone in the water; the spark climbs the trunk and the tree catches
  at(Q.city.wellLook); step(2);
  assert.equal(Q.city.lit, 0);
  const sm = Q.city.smoke, warm = coolness(sm);
  const setIt = bestInteractable(player);
  assert.equal(setIt?.entry.id, 'well.stone');
  assert.equal(promptOf(setIt), 'set the spark-stone in the well');
  setIt.entry.use(player);
  step(8);
  assert.ok(H.stone.visible && H.stone.position.distanceTo(player.pos) < 6, 'out of your pack, from your hand into the well');
  assert.equal(game.flag('desert.tree.lit'), true);
  assert.ok(!quests.has('stone'), 'the stone stays in the well');
  step(30 * 4);
  assert.ok(Q.city.lit > 0 && Q.city.lit < 1, `it catches, and the fire grows (${Q.city.lit.toFixed(2)})`);
  step(30 * 8);
  assert.equal(Q.city.lit, 1, 'it burns');
  assert.equal(Q.city.flames.lit, 1, 'a flame over the crown');
  assert.ok(sm.mesh.visible, 'smoke rises from it');
  assert.equal('#' + Q.city.flames.palB[1].getHexString(), COOL_FIRE[1], 'cool fire: the drinking’s own colours');
  for (let i = 0; i < 80; i++) sm.update(1 / 2, i / 2, null);
  assert.ok(coolness(sm) > warm + 0.03, `the smoke is cool too (${warm.toFixed(3)} → ${coolness(sm).toFixed(3)})`);
  assert.ok(crowd.people.filter((p) => p.spot?.id === 'procession').every((p) => p.lines === LINES.drinking), 'the procession sings');
  assert.equal(talk(PEOPLE.ama, []).nodeId, 'drinking');
  step(2);
  assert.equal(quests.stage('desert.power'), 'ship');
  // back to the ship (the ship's own hatch emits ship:enter; walking up works too): Qanat repays you. Its people
  // come down to the ship with what they can spare and pour it in, one by one (src/story/desert-repay.js)
  const R = rt.world.repay;
  at(R.ramp().clone().add(V(0, 0, 0))); step(2);
  game.emit('ship:enter');
  step(2);
  assert.equal(quests.isDone('desert.power'), false, 'not the jar alone: Qanat brings its gift first');
  assert.ok(R.state.placed && R.party.length >= 5, `they came (${R.party.map((g) => g.who).join(', ')})`);
  step(30 * 26, 1 / 30, { people: true });
  const hull = rt.world.repay.state.spots[0].pour;
  assert.ok(R.party.every((g) => g.n.pos.distanceTo(hull) < 30), 'all of them down at the ship');
  assert.equal(quests.isDone('desert.power'), true);
  assert.equal(game.flag('ship.powered'), true);
  assert.equal(game.flag('world.desert.done'), true);
  assert.ok(game.keepsakes().some((k) => k.id === 'desert.knowing'), 'the keepsake: what the giants left');
  assert.equal(talk(PEOPLE.nour, []).nodeId, 'after');
});

test('old saves: stages that moved go to Nour, the ones done advance on their flags, the cave stays where it was', async () => {
  const { GameState } = await import('../src/game-state.js');
  const { Quests } = await import('../src/story/quests.js');
  const { QUESTS } = await import('../src/story/desert-data.js');
  const { migrateDesertQuest } = await import('../src/story/desert.js');
  const { migrateSave } = await import('../src/boxes/index.js');
  const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
  const save = (stage, flags = {}) => {
    const g = new GameState(store());
    g.set('prologue.done', true); g.set('items.v', 1); g.set('quest.desert.power', stage);
    for (const [k, v] of Object.entries(flags)) g.set(k, v);
    const q = new Quests({ game: g });
    for (const d of QUESTS) q.define(d);
    return { g, q, run: () => { for (let i = 0; i < 12; i++) q.update(null); return q.stage('desert.power'); } };
  };
  // found the crash box, not yet at the camps: walk to the city; the shrine's box is already open (yours)
  let s = save('camps', { 'item.backpack': true, 'box.desert.backpack': true });
  migrateSave(s.g);
  assert.equal(migrateDesertQuest(s.g), 'city');
  s.g.set('desert.city.entered', true);
  assert.equal(s.run(), 'elder', 'the box stage passes on the backpack you already carry');
  // a pre-items save the v1 migration gave the backpack to: the shrine's box counts as found
  s = save('pack');
  s.g.set('items.v', undefined);
  assert.equal(migrateSave(s.g), true);
  assert.equal(s.g.flag('box.desert.backpack'), true);
  assert.equal(migrateDesertQuest(s.g), 'city');
  // half way (jar given, the Speaker heard): to Nour, then straight through (the well is no stage now)
  s = save('well', { 'item.backpack': true, 'desert.jar.given': true, 'desert.speaker.heard': true });
  assert.equal(migrateDesertQuest(s.g), 'elder');
  assert.equal(s.run(), 'elder', 'Nour first');
  s.g.set('desert.elder.heard', true);
  s.g.set('desert.asked', true);   // (setupDesert's askedDone: the jar was given)
  assert.equal(s.run(), 'down', 'the jar and the Speaker were done already');
  // in the cave already: untouched
  s = save('channel', { 'item.backpack': true });
  assert.equal(migrateDesertQuest(s.g), null);
  assert.equal(s.q.stage('desert.power'), 'channel');
  // once only, and never for a new save
  assert.equal(migrateDesertQuest(s.g), null);
  const fresh = new GameState(store());
  assert.equal(migrateDesertQuest(fresh), null);
  assert.equal(fresh.flag('quest.desert.power'), undefined);
});

test('side quests: Teo’s drum, Ilo at the skull, Oum home from the dunes, the mask in the sand', async () => {
  // the drum, picked up under the old ribcage (with E), returned to Teo
  talk(PEOPLE.teo, ['I’ll look']);
  assert.equal(quests.stage('desert.drum'), 'find');
  const drumAt = V(STORY.drum.x, terrain.heightAt(STORY.drum.x, STORY.drum.z), STORY.drum.z);
  at(drumAt); step(1);
  assert.equal(quests.stage('desert.drum'), 'free', 'found: jammed against a rib');
  // (src/story/desert-errands.js: heaved by hand from the side, the knuckle rolls off and the drum rolls out)
  const D = rt.world.drum;
  at(D.knuckle.position.clone().addScaledVector(D.along, -1.6).setY(drumAt.y)); facing(D.knuckle.position);
  const k = bestInteractable(player);
  assert.equal(k?.entry.id, 'knuckle');
  k.entry.use(player);
  assert.ok(D.freed());
  step(90);
  at(D.drum.position.clone().setY(drumAt.y));
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
  assert.equal(quests.stage('desert.mask'), 'eyes', 'there: sand over its eyes');
  // both eyes washed clear at once (src/story/desert-errands.js)
  for (const t of allTargets().filter((x) => x.kind === 'maskEye')) t.onHit('shoot');
  step(2);
  assert.equal(quests.isDone('desert.mask'), true);
  await new Promise((r) => setTimeout(r, 1300));
  assert.ok(storyDone, 'the main quest closed the desert’s story page');
  // afterwards: Oum doesn't hand over her cord twice; Pell hears how the mask went
  const cords = game.flag('item.cord');
  talk(PEOPLE.oum, ['I still have it']);
  assert.equal(game.flag('item.cord'), cords, 'one cord');
  assert.equal(new DialogueRunner(CONTENT.desert.npcs[1], { game, quests }).nodeId, 'washed');
});

test('the water let out before anyone sent you down: the steps that lead there pass, and Ama still gives the jar', () => {
  // Ilo, Bako and Hessa all point at the giant's mouth: a player can lever the rib off before Nour, the well, Ama and the Speaker
  for (const f of ['desert.elder.heard', 'desert.well.seen', 'desert.speaker.heard', 'desert.asked', 'desert.cave.seen', 'desert.jar.given', 'desert.jar.filled', 'desert.tree.lit', 'desert.ship.fed']) game.set(f, undefined);
  while (quests.has('water')) quests.take('water');
  game.set('desert.channel.open', true);
  quests.set('desert.power', 'elder');
  step(6);
  assert.equal(quests.stage('desert.power'), 'ask', 'Nour’s sending and the well pass over; the jar is still needed');
  talk(PEOPLE.ama, ['I’ll bring it back full']);
  assert.ok(quests.has('jar'), 'Ama gives the jar');
  step(6);
  assert.equal(quests.stage('desert.power'), 'fill', 'the Speaker and the way down pass too: on to the pool');
  clearInteractables();
});

test('looking into the well: he turns to the shaft, not to the spot on the terrace he was asked from', () => {
  const C = Q.city, e = wellEntry;   // (taken as the story set it up: later tests clear the prompts)
  assert.ok(e, 'the well can be looked into');
  // between the rim and the place the prompt is asked from (city.wellLook, 3.4 m out from the middle), a little to the side
  const p = C.well.clone().lerp(C.wellLook, 0.85); p.x += 0.6;
  at(p); facing(C.well);
  assert.ok(e.distance(player) < e.range, 'the prompt answers there');
  e.use(player);
  assert.ok(rt.dialogue.open, 'the well speaks');
  step(1);
  const to = player.faceToward;
  assert.ok(to, 'he turns to something');
  const dir = (a) => { const d = a.clone().sub(player.pos); d.y = 0; return d.normalize(); };
  assert.ok(dir(to).dot(dir(C.well)) > 0.99, `toward the well (${dir(to).dot(dir(C.well)).toFixed(2)}; it was -0.62: his back to it)`);
  assert.ok(flat(to, C.well) < 0.01 && to.y > C.well.y && to.y < C.well.y + 1.15, 'down into the shaft, under the rim');
  rt.dialogue.close();
  step(1);
});

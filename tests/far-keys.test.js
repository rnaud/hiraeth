// Issue #561 (the v1.87 design audit): the locks whose answer was out of sight and rooms away, made readable from where you
// stand at them, as the temple design audit scores it (scripts/temple-design/audit.mjs, .claude/skills/temple-design-qc:
// a room away -1, out of sight -1, over 20 m -0.5, two verbs -1; 1.5 or under is obscure). The Mooring-House's west door
// (gN: its Chain Locker three rooms off, now the room it stands in), its moorers' gate (sc: a ball four rooms off, now two
// keyholes), its great door (d1: the lamp-eye two rooms off, now seen through two glazed windows), and the Footprint's Lens
// Chamber (dL: a ball two rooms off, now a keyhole and the key across the pool); and the Glass Dunes' half-buried court, the
// last remote dead end, on a row of the carriers' posts. Each lock at 2.5 or over, or a keyhole: a lock a key alone opens is
// no puzzle (its key's step is), and the key's own step at 2.5 or over.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** The temple design audit's report for these houses, as the audit measures them (each built, its sight lines cast). */
async function audit(temples) {
  const { measureTemples } = await import('../scripts/temple-design/measure.mjs');
  return (await measureTemples({ temples })).report;
}

test('the far keys read from their locks: the Mooring-House’s west door, great door and moorers’ gate, the Footprint’s Lens Chamber (obviousness 2.5 or over, or a keyhole)', async () => {
  const rep = await audit(['spacecity', 'spheres']);
  const house = (id) => rep.temples.find((t) => t.id === id);
  const step = (id, lock) => house(id).metrics.steps.find((s) => s.lock === lock);
  const lockOf = (id, lock) => house(id).graph.locks.find((l) => l.id === lock);
  for (const id of ['spacecity', 'spheres']) assert.ok(house(id).solved && house(id).rules.count === 0, `${id}: solved, and it breaks no rule of the redesign`);
  // a step its keys are in the lock's room or the next, in sight, and not obscure
  for (const [id, lock] of [['spacecity', 'gN'], ['spacecity', 'd1']]) {
    const s = step(id, lock);
    assert.ok(s, `${id} ${lock} is a step`);
    assert.ok(s.obvious >= 2.5, `${id} ${lock}: obviousness ${s.obvious} (${s.why.join('; ')})`);
    assert.ok(s.keys.every((k) => k.visible), `${id} ${lock}: every key in sight from the lock (${s.keys.map((k) => `${k.id} ${k.visible}`).join(', ')})`);
  }
  // a keyhole: the lock wants keys alone, and each key's own step is readable
  for (const [id, lock, keys] of [['spacecity', 'sc', ['cage:kH']], ['spheres', 'dL', ['stones']]]) {
    const l = lockOf(id, lock);
    assert.ok(l.keys.length && l.keys.every((k) => k.how === 'key'), `${id} ${lock}: a keyhole (${l.keys.map((k) => `${k.id}:${k.how}`).join(', ')})`);
    assert.equal(step(id, lock), undefined, `${id} ${lock}: no puzzle of its own`);
    for (const k of keys) assert.ok(step(id, k)?.obvious >= 2.5, `${id} ${k}: the key's step at ${step(id, k)?.obvious}`);
  }
  // and the Mooring-House has no obscure step left, its mean between painfully obvious and obscure
  const O = house('spacecity').metrics.obviousness;
  assert.equal(O.obscure, 0, 'no Mooring-House step at 1.5 or under');
  assert.ok(O.mean >= 2.5 && O.mean <= 3.5, `its mean ${O.mean}`);
});

test('the Mooring-House’s great door sees its lamp-eye through two windows, the hub’s glazed: the glass stops a splash (issue #561)', async () => {
  const { TEMPLES } = await import('../src/temples/index.js');
  const { recordTemple } = await import('../scripts/temple-design/record.mjs');
  const { Pane, D1_WINDOWS } = await import('../src/temples/spacecity.js');
  const { Physics } = await import('../src/physics.js');
  const { rt } = recordTemple(TEMPLES.spacecity.def);
  try {
    rt.root.updateMatrixWorld(true);
    const panes = rt.pieces.filter((p) => p instanceof Pane);
    assert.equal(panes.length, 1, 'glass in the hub’s window');
    assert.ok(D1_WINDOWS.hall && D1_WINDOWS.shaft);
    // from where you stand at the great door, the eye: nothing drawn in the way but the glass
    // (where the audit stands to face the door, give or take a step, and the eye itself)
    const door = rt.piece('d1').group.position, eye = rt.piece('s1').center, hub = rt.kit.world(0, 0, 30);
    const at0 = door.clone().add(hub.clone().sub(door).setY(0).normalize().multiplyScalar(4)).add(V(0, 1.7, 0));
    const solids = [];
    rt.root.traverse((o) => { if (o.isMesh && o.geometry && !o.userData.seeThrough) solids.push(o); });
    const own = new Set(); rt.piece('s1').group.traverse((o) => own.add(o));   // (the eye's own stone lids never hide it)
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const at = at0.clone().add(V(dx, 0, dz));
      const ray = new THREE.Raycaster(at, eye.clone().sub(at).normalize(), 0, at.distanceTo(eye) - 1.2);
      const hits = ray.intersectObjects(solids, false).filter((h) => !own.has(h.object));
      assert.equal(hits.length, 0, `the eye in sight from ${dx}, ${dz} m by the great door (${hits.slice(0, 2).map((h) => rt.kit.local(h.point).toArray().map((v) => v.toFixed(1)).join(',')).join(' / ')})`);
    }
    const at = at0;
    // but a splash from there meets the glass (the panes are solid to the physics, as a shut door is)
    const scene = new THREE.Scene(), physics = new Physics(scene);
    for (const p of panes) p.init(physics);
    const d = eye.clone().sub(at), n = d.length();
    assert.ok(physics.rayDistance(at, d.normalize(), n) < n - 2, 'the glass stops what is thrown at the eye from the hub');
  } finally { rt.dispose?.(); }
});

test('old saves (issue #561): the Mooring-House’s last mark in the old Chain Locker finds its way back east open; the Footprint past the Lens Chamber has its key in its door', async () => {
  const { GameState } = await import('../src/game-state.js');
  const { migrateTempleLayouts, LAYOUTS } = await import('../src/temples/migrate.js');
  const g = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 5, entered: true, 'drum.ballW': 1, 'open.g1': true, 'lit.s1': true, 'open.d1': true, gadget: true, 'lit.r1': true, 'open.d2': true, 'drum.mooring': 0, checkpoint: 'locker' })) g.set(`temple.spacecity.${k}`, v);
  migrateTempleLayouts(g);
  assert.equal(g.flag('temple.spacecity.layout'), LAYOUTS.spacecity.v);
  assert.ok(g.flag('temple.spacecity.open.br2') && g.flag('temple.spacecity.lit.rW'), 'the gangway taut and the Cable Walk’s catch pulled: the way back east from the locker’s new place');
  assert.equal(g.flag('temple.spacecity.relaid'), true, 'taken to its last mark in the new rooms');
  // a save past the moorers' gate, one key in it (v5): both keys in it now, none left in hand, the gate open
  const { TempleLogic, flagStore } = await import('../src/temples/logic.js');
  const { TEMPLES } = await import('../src/temples/index.js');
  const p = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 5, entered: true, 'found.kS': true, 'lit.arR': true, 'unlocked.sc': 1, 'open.sc': true, 'open.gN': true, 'lit.rK': true, checkpoint: 'perch' })) p.set(`temple.spacecity.${k}`, v);
  migrateTempleLayouts(p);
  const B = new TempleLogic(TEMPLES.spacecity.def.logic, { store: flagStore(p, 'spacecity') });
  B.update();
  assert.ok(B.isOpen('sc') && B.keysIn('sc') === 2 && B.keys('small') === 0, `past the moorers’ gate: still open, both keys in it (${B.keysIn('sc')}, ${B.keys('small')} in hand)`);
  const f = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 4, entered: true, 'drum.ball3': 1, 'open.stones': true, 'open.dL': true, gadget: true, checkpoint: 'lens' })) f.set(`temple.spheres.${k}`, v);
  migrateTempleLayouts(f);
  assert.ok(f.flag('temple.spheres.found.kP') && f.flag('temple.spheres.unlocked.dL') === 1, 'its key found and in the Lens Chamber’s door: no spare key on the ledge for the far door');
});

test('the Glass Dunes’ half-buried court (issue #561): no longer a remote dead end, a row of the carriers’ posts to it from their oil jars on the way up to the breaker’s cairn, each float in sight of the next', async () => {
  globalThis.location = { search: '?level=glassdunes' };
  const A = await import('./playthrough-agent.js');
  const { COURT } = await import('../src/glass-dunes-quarter.js');
  const W = A.loadWorld('glassdunes');
  try {
    const L = W.level, court = L.sights.find((s) => s.name === 'the half-buried court').at, jars = L.sights.find((s) => s.name === 'the carriers’ oil jars')?.at;
    assert.ok(jars, 'the oil jars, a place to stop at');
    assert.ok(flat(jars, court) < 150, `the jars ${flat(jars, court).toFixed(0)} m from the court (the audit's remote: 150 m)`);
    const way = L.cairnWay.posts;
    assert.ok(Math.min(...way.map((p) => flat(p, jars))) < 12, 'the jars by the posts of the way up');
    const P = L.cairnWay.court.posts;
    assert.ok(P.length >= 3, 'a row of posts');
    assert.ok(flat(P[0], jars) < 12 && flat(P.at(-1), court) < 50 && P.at(-1).x < COURT.x, 'from the jars to the court’s sand, before it');
    const blocker = (a, b) => { const d = a.distanceTo(b), dir = b.clone().sub(a).normalize(), hit = W.physics.rayHit(a, dir, d); return hit && hit.distance < d - 0.6 ? hit.point : null; };
    for (let i = 1; i < P.length; i++) {
      assert.ok(flat(P[i], P[i - 1]) < 32, `posts ${i - 1} and ${i} ${flat(P[i], P[i - 1]).toFixed(0)} m apart`);
      assert.equal(blocker(V(P[i - 1].x + 1, P[i - 1].y - 1.6, P[i - 1].z), P[i]), null, `post ${i}’s float in sight from post ${i - 1}`);
    }
    assert.ok((typeof L.lines === 'function' ? L.lines() : L.lines).some((l) => l.name === 'the court’s posts'), 'the audit reads them as a line');
  } finally { W.dispose(); }
});

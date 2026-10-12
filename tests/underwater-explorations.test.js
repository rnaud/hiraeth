// The Underwater City's explorations, the author's three picks woven into one way through the city (issue #192;
// docs/systems/worlds.md "The Underwater City's explorations"): a helmet off the divers' rack, out by the divers' lock and
// bell to bell over the seabed, a whale passing overhead at the lip (src/underwater-seabed.js); down the canyon street's
// terraces to the Whale Gallery on its shelf, the bridge to the far wall, the cage to the canyon's floor
// (src/underwater-canyon.js); the halls' great pipes tuned on the way to the Whale-House (src/underwater-song.js,
// src/story/underwater-ways.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { Waters } = await import('../src/water.js');
const { Player } = await import('../src/player.js');
const { SWIM } = await import('../src/swim.js');
const { HELMET, BELLS, SEABED_WAY, BELL_AIR } = await import('../src/underwater-seabed.js');
const { TERRACES, BRIDGE, FAR_TERRACE, CANYON, GALLERY_SHELF, westEdge } = await import('../src/underwater-canyon.js');
const { PIPES } = await import('../src/underwater-song.js');
const { PIPE_FLAG, HELMET_FLAG, TUNED_FLAG, LINES } = await import('../src/story/underwater-ways.js');
const { DOMES } = await import('../src/levels/underwater.js');
const { QUESTS, THINGS, PEOPLE } = await import('../src/story/underwater-people.js');
const { auditContact, formatContact } = await import('../src/contact-audit.js');
const { toneOf } = await import('../src/story/tone.js');
const { allInteractables } = await import('../src/interact.js');
const { game } = await import('../src/game-state.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };

globalThis.location = { search: '?level=underwater' };
const W = A.loadWorld('underwater');
const { level, physics, scene } = W, U = level.uw, ground = (x, z) => level.ground.heightAt(x, z);
const waters = quiet(() => new Waters(scene, { physics, drops: false }));
test.after(() => { for (const k of [HELMET_FLAG, TUNED_FLAG, ...PIPES.map((p) => PIPE_FLAG(p.id))]) game.set(k, undefined); W.dispose(); });

/** As the level design audit sees: nothing the collision holds between the eye and the point, and no ground over the ray. */
function sees(eye, at, near = 3) {
  const d = eye.distanceTo(at), dir = at.clone().sub(eye).normalize();
  if (physics.rayDistance(eye.clone(), dir, d) < d - near) return false;
  for (let s = 6; s < d - near; s += 6) { const p = eye.clone().addScaledVector(dir, s); if (ground(p.x, p.z) > p.y + 0.3) return false; }
  return true;
}
/** A diver: the real traveller, in the city's sea (its helmet's rules: src/swim.js). */
function diver(at) {
  const P = quiet(() => new Player(physics, { water: waters, climb: true }));
  P.respawn(at.clone().add(V(0, 0.3, 0)));
  return P;
}
/** Walked through the points in turn on the bed (a point he stalls short of ends the walk). */
function walk(P, points, { secs = 25 } = {}) {
  let reached = 0;
  for (const to of points) {
    for (let i = 0; i < 60 * secs && flat(P.pos, to) > 0.9; i++) {
      const heading = Math.atan2(to.x - P.pos.x, to.z - P.pos.z);
      P.heading = heading;
      P.update(1 / 60, { KeyW: true }, heading + Math.PI);
    }
    if (flat(P.pos, to) > 0.9 || Math.abs(P.pos.y - to.y) > 1.3) break;
    reached++;
  }
  return reached;
}

// ------------------------------------------------------------------ the walk on the seabed
test('the helmet: off the divers’ rack, and the locks out to the sea open only with it', () => {
  const take = allInteractables().find((e) => e.id === 'underwater.helmet');
  assert.ok(take && flat(take.at(), V(...level.uw.ways.rack.at)) < 1.5, 'a helmet to take on the rack');
  const out = [U.ways.locks.dock.portals[0], U.ways.locks.gallery.portals[0]];
  game.set(HELMET_FLAG, undefined);
  for (const p of out) assert.ok(p.when && !p.when() && p.refuse === LINES.refuse, `${p.label}: shut without a helmet`);
  assert.ok(U.ways.locks.dock.portals[1].when === undefined, 'back in from the sea: always');
  take.use(W.player);
  assert.equal(game.flag(HELMET_FLAG), true);
  assert.ok(!U.ways.rack.helmet.visible, 'gone off the rack');
  for (const p of out) assert.ok(p.when(), `${p.label}: open with it`);
  // the doorways come out on the floor either side: the bed outside the Dock, the bottom terrace by the Gallery
  for (const L of [U.ways.locks.dock, U.ways.locks.gallery]) for (const p of L.portals) {
    const g = physics.groundAt(p.to.x, p.to.y + 2, p.to.z, 6);
    assert.ok(Math.abs(g - p.to.y) < 0.5, `${p.label}: comes out on a floor (${g.toFixed(2)} for ${p.to.y.toFixed(2)})`);
    assert.ok(p.to.distanceTo(L.portals.find((q) => q !== p).at) > 2.5, `${p.label}: never straight back`);
  }
  assert.ok(level.air(...U.ways.locks.dock.portals[1].to.toArray().map((v, i) => (i === 1 ? v + 1 : v))), 'in: in the Dock’s air');
  assert.ok(!level.air(...U.ways.locks.dock.portals[0].to.toArray().map((v, i) => (i === 1 ? v + 1 : v))), 'out: in the sea');
});

test('in the helmet you walk the bed, never swimming: its air runs down, a bell gives it back, a fall sinks you slowly and breaks nothing', () => {
  const at = V(SEABED_WAY[1][0], ground(SEABED_WAY[1][0], SEABED_WAY[1][1]), SEABED_WAY[1][1]);
  const P = diver(at);
  for (let i = 0; i < 30; i++) P.update(1 / 60, {}, 0);
  assert.ok(P.inWater?.body?.sea?.helmet, 'out in the helmet’s sea');
  // a jump: up and down again on the bed, no swimming
  P.update(1 / 60, { Space: true }, 0);
  for (let i = 0; i < 120; i++) P.update(1 / 60, {}, 0);
  assert.ok(!P.swim && P.onGround, 'the jump lands you back on the bed, not swimming');
  // the air: down over HELMET.air s
  P.breath = 1;
  for (let i = 0; i < 60 * HELMET.air * 0.5; i++) P.update(1 / 60, {}, 0);
  assert.ok(Math.abs(P.breath - 0.5) < 0.05, `half the helmet’s air after ${HELMET.air / 2} s: ${P.breath.toFixed(2)}`);
  // out of it: it hurts, but never the last of you
  const hearts = P.health ?? null;
  for (let i = 0; i < 60 * HELMET.air * 1.5; i++) P.update(1 / 60, {}, 0);
  assert.equal(P.breath, 0);
  if (hearts != null) assert.ok(P.health > 0, 'never the last heart');
  // a bell: the hood's air gives it back
  const b = U.ways.bells[0], hood = V(...b.hood);
  P.respawn(V(hood.x, b.at[1] + 0.3, hood.z));
  P.breath = 0.1;
  for (let i = 0; i < 60 * SWIM.refill * 1.2; i++) P.update(1 / 60, {}, 0);
  assert.ok(P.breath > 0.99, `under the bell: breathing (${P.breath.toFixed(2)})`);
  // a fall: from the bridge into the canyon, slowly, to the floor, unhurt
  const Q = diver(V(150, BRIDGE.y + 2, BRIDGE.z + 6));
  const h0 = Q.health;
  let fastest = 0;
  for (let i = 0; i < 60 * 20 && !(Q.onGround && Q.pos.y < -50); i++) { Q.update(1 / 60, {}, 0); if (!Q.onGround) fastest = Math.min(fastest, Q.vel.y); }
  assert.ok(Q.onGround && Q.pos.y < CANYON.floor + 6, `down on the canyon’s floor (${Q.pos.y.toFixed(1)})`);
  assert.ok(fastest >= -HELMET.sink - 1, `sinking, not falling: ${fastest.toFixed(1)} m/s at most`);
  assert.ok(!Q.swim && (h0 == null || Q.health === h0), 'never swimming, and unhurt');
});

test('the bells are the way: the walk from the Dock’s lock to the canyon street runs on the bed, a bell within the helmet’s air of the last', () => {
  const pts = SEABED_WAY.map(([x, z]) => V(x, ground(x, z), z));
  const P = diver(pts[0]);
  const n = walk(P, pts.slice(1));
  assert.equal(n, pts.length - 1, `walked the bells’ way: ${n} of ${pts.length - 1} legs, stopped at ${P.pos.toArray().map((v) => v.toFixed(1))}`);
  // the air is enough from bell to bell at a walk on the bed (and from the lock to the first, the last to the street's café)
  const run = 8.2 * 0.8;
  const stops = [U.ways.locks.dock.outer, ...U.ways.bells.slice(0, 3).map((b) => b.at), [104, 0, TERRACES[0].z]].map((p) => V(...p));
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i - 1].distanceTo(stops[i]) / run < HELMET.air * 0.85, `bell to bell in ${(stops[i - 1].distanceTo(stops[i]) / run).toFixed(1)} s`);
  // each bell's hood is an air pocket, and the sea is round it
  for (const b of U.ways.bells) {
    assert.ok(level.air(b.hood[0], b.at[1] + 1.6, b.hood[2]) && waters.surfaceAt(b.hood[0], b.hood[2], b.at[1] + 1.6) === null, 'air under the hood');
    assert.ok(!level.air(b.hood[0] + BELL_AIR.r + 0.6, b.at[1] + 1.6, b.hood[2]), 'sea beside it');
  }
  assert.equal(BELLS.length + 1, U.ways.bells.length, 'and one on the far wall’s terrace');
});

test('the whale overhead: its loop passes over the lip and the end of the bells’ walk, clear of every tower', () => {
  const W0 = U.overhead, lip = V(104, 0, TERRACES[0].z), bell = V(...U.ways.bells[2].at);
  let nearLip = Infinity, nearBell = Infinity, low = Infinity;
  const towers = [];
  scene.traverse((o) => { if (o.isMesh && !o.userData.noCollide && o.geometry?.boundingBox == null) o.geometry.computeBoundingBox?.(); });
  for (let t = 0; t < 140; t += 0.5) {
    level.update(1 / 60, t, {});
    const p = W0.position;
    nearLip = Math.min(nearLip, flat(p, lip)); nearBell = Math.min(nearBell, flat(p, bell)); low = Math.min(low, p.y);
    // nothing solid within 7 m of its middle (a body 26 m long, its half-height about 4.5)
    for (const d of [V(1, 0, 0), V(-1, 0, 0), V(0, 0, 1), V(0, 0, -1), V(0, -1, 0)]) assert.ok(physics.rayDistance(p.clone(), d, 7) >= 7, `the whale clear at ${p.toArray().map((v) => v.toFixed(0))}`);
    towers.push(p.clone());
  }
  assert.ok(nearLip < 30 && nearBell < 30, `over the lip (${nearLip.toFixed(0)} m) and the last bell (${nearBell.toFixed(0)} m)`);
  assert.ok(low > 24, `high overhead: ${low.toFixed(0)} m`);
  assert.ok(sees(V(bell.x + 2, bell.y + 1.7, bell.z), towers[towers.findIndex((p) => flat(p, bell) === nearBell)] ?? towers[0], 6), 'seen from the last bell');
});

// ------------------------------------------------------------------ the canyon street
test('the canyon street: five terraces a storey apart down the canyon’s side, stairs between, every deck over the ground', () => {
  for (const [i, T] of TERRACES.entries()) {
    for (const x of [T.x[0] + 1.5, (T.x[0] + T.x[1]) / 2, T.x[1] - 1.5]) {
      const g = physics.groundAt(x, T.y + 1.5, T.z, 3);
      assert.ok(Math.abs(g - T.y) < 0.35, `terrace ${i}: its deck at ${x.toFixed(0)} (${g.toFixed(2)} for ${T.y})`);
      assert.ok(ground(x, T.z) < T.y - 0.2, `terrace ${i}: over the bed at ${x.toFixed(0)}`);
      assert.ok(physics.roomAt?.(V(x, T.y + 1.0, T.z), 0.45) >= 0.45 || physics.rayDistance(V(x, T.y + 0.3, T.z), V(0, 1, 0), 2.2) >= 2.2, `terrace ${i}: room to stand at ${x.toFixed(0)}`);
    }
    if (i) assert.ok(TERRACES[i - 1].y - T.y >= 3.4, 'a storey down');
  }
  assert.equal(TERRACES[0].y, 0, 'its head on the plain');
  assert.ok(Math.abs(TERRACES.at(-1).y - DOMES.gallery.y) < 0.05, 'its foot level with the Gallery’s floor');
  // the stairs: each step a step, top to foot
  for (const s of U.canyon.stairs) {
    let last = s.top[1];
    for (let k = 0; k <= 20; k++) {
      const z = s.top[2] + ((s.foot[2] - s.top[2]) * k) / 20, g = physics.groundAt(s.top[0], last + 1.2, z, 3);
      assert.ok(last - g < 0.5, `a stair at ${s.top[0]}, ${z.toFixed(1)}: ${(last - g).toFixed(2)} m down at once`);
      last = g;
    }
    assert.ok(Math.abs(last - s.foot[1]) < 0.4, 'down to the next terrace');
  }
  // walked: a diver goes down the whole street, terrace to terrace, to the Gallery's lock
  const line = level.lines.find((l) => l.name === 'the canyon street').points.map((p) => V(...p));
  const P = diver(line[0]);
  const lock = line.findIndex((p) => flat(p, U.ways.locks.gallery.portals[1].at) < 0.5);
  const n = walk(P, line.slice(1, lock + 1));
  assert.equal(n, lock, `walked down the street: ${n} of ${lock} legs, at ${P.pos.toArray().map((v) => v.toFixed(1))}`);
});

test('the canyon: its floor deep in the dark, the Gallery on its shelf at the street’s foot, the far wall across, the bridge over', () => {
  for (const z of [-60, -100, -140]) assert.ok(ground((westEdge(z) + CANYON.wall + CANYON.east[0]) / 2, z) < CANYON.floor + 1, `the floor at ${z}`);
  // the shelf: the bed just under the Gallery's floor all round its foot (no gap a diver sees under it)
  const G = DOMES.gallery;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const x = G.x + Math.sin(a) * G.r, z = G.z + Math.cos(a) * G.r, g = ground(x, z);
    assert.ok(g < G.y && g > G.y - 2.2, `the shelf under the Gallery at ${a.toFixed(2)}: ${g.toFixed(1)}`);
  }
  assert.ok(Math.abs(GALLERY_SHELF.y - (G.y - 1.4)) < 0.1 && GALLERY_SHELF.r > G.r + 3, 'its shelf wider than its foot');
  // the bridge, walked across, and the far wall's café (its air)
  for (let x = BRIDGE.x[0] + 1; x < BRIDGE.x[1]; x += 4) assert.ok(Math.abs(physics.groundAt(x, BRIDGE.y + 1, BRIDGE.z, 3) - BRIDGE.y) < 0.3, `the bridge at ${x}`);
  const P = diver(V(BRIDGE.x[0] - 1, BRIDGE.y, BRIDGE.z));
  assert.equal(walk(P, [V(BRIDGE.x[1] + 3, FAR_TERRACE.y, BRIDGE.z)], { secs: 30 }), 1, 'across the bridge to the far wall');
  const far = U.canyon.cafes.at(-1);
  assert.ok(far.air(far.x, far.y + 1.2, far.z), 'the far wall’s café is dry inside');
  // seen: the far wall and the bridge from the street's head; the Gallery from its middle terrace
  const head = V(104, 1.7, TERRACES[0].z);
  assert.ok(sees(head, V(150, BRIDGE.y + 1, BRIDGE.z), 4), 'the bridge from the street’s head');
  assert.ok(sees(V(112, TERRACES[2].y + 1.7, TERRACES[2].z), V(G.x + 10, G.y + 8, G.z + 14), 6), 'the Gallery from the middle terrace');
  // the cage: down to the floor and back up to the bottom terrace
  const down = level.portals.find((p) => /cage down/.test(p.label)), up = level.portals.find((p) => /cage up/.test(p.label));
  assert.ok(down.to.y < CANYON.floor + 4 && Math.abs(physics.groundAt(down.to.x, down.to.y + 2, down.to.z, 5) - down.to.y) < 0.6, 'the cage’s foot on the floor');
  assert.ok(Math.abs(physics.groundAt(up.to.x, up.to.y + 2, up.to.z, 5) - TERRACES.at(-1).y) < 0.3, 'its top on the bottom terrace');
});

test('the whales of the deep keep to the canyon, clear of its walls, and come up to the Gallery’s glass once calmed', () => {
  const G = DOMES.gallery;
  for (const k of [0, 1]) {
    level.whalesNear(k);
    let nearest = Infinity;
    for (let t = 0; t < 200; t += 1) {
      level.update(1 / 60, t, {});
      for (const w of level.whales) {
        const p = w.position;
        assert.ok(ground(p.x, p.z) < p.y - 6, `a whale clear of the bed at ${p.toArray().map((v) => v.toFixed(0))} (near ${k})`);
        for (const d of [V(1, 0, 0), V(-1, 0, 0), V(0, -1, 0)]) assert.ok(physics.rayDistance(p.clone(), d, 5) >= 5, `clear of anything at ${p.toArray().map((v) => v.toFixed(0))}`);
        nearest = Math.min(nearest, flat(p, V(G.x, 0, G.z)) - G.r);
      }
    }
    if (k) assert.ok(nearest < 16, `calmed, one comes within ${nearest.toFixed(0)} m of the Gallery’s glass`);
  }
  level.whalesNear(0);
});

// ------------------------------------------------------------------ the city that sings
test('the great pipes: one in each of three halls, its wheel turned, it plays in tune; all three and the city is in tune', () => {
  assert.deepEqual(U.song.pipes.map((p) => p.id), PIPES.map((p) => p.id));
  for (const p of U.song.pipes) {
    const d = DOMES[p.hall];
    assert.ok(Math.hypot(p.at[0] - d.x, p.at[2] - d.z) < d.r - 4, `${p.id}: in its hall`);
    assert.ok(p.top > d.y + d.r * d.sy * 0.4 && level.air(p.stand[0], d.y + 1, p.stand[2]), `${p.id}: up through the glass, turned from its dry floor`);
    assert.ok(p.mouth[1] < 78, `${p.id}: its horn under the surface`);
    assert.ok(Math.abs(physics.groundAt(p.stand[0], d.y + 2, p.stand[2], 4) - d.y) < 0.3, `${p.id}: room to stand at its wheel`);
  }
  for (const p of PIPES) game.set(PIPE_FLAG(p.id), undefined);
  game.set(TUNED_FLAG, undefined);
  for (const p of U.song.pipes) U.song.setTuned(p.id, false, true);
  const pools = [];
  scene.traverse((o) => { if (o.isMesh && o.parent?.name === 'The singing city' && o.material === U.song.pipes && o) pools.push(o); });
  for (const [i, p] of U.song.pipes.entries()) {
    const e = allInteractables().find((x) => x.id === `underwater.pipe.${p.id}`);
    assert.ok(e && e.enabled(), `${p.id}: a wheel to turn`);
    const toasts = W.toasts.length;
    e.use(W.player);
    assert.equal(game.flag(PIPE_FLAG(p.id)), true);
    assert.ok(U.song.tuned.has(p.id) && !e.enabled(), `${p.id}: in tune, its wheel turned for good`);
    assert.equal(W.toasts.length, toasts + 1, 'one line');
    assert.equal(!!game.flag(TUNED_FLAG), i === U.song.pipes.length - 1, 'the city in tune after the third');
  }
  for (let t = 0; t < 3; t += 0.1) U.song.update(t, 0.1);
  assert.ok(U.song.isTuned());
});

test('the main quest goes out by the bells and down the canyon street, then the great pipes, then the Whale-House', () => {
  const q = QUESTS.find((x) => x.id === 'underwater.note');
  assert.deepEqual(q.stages.map((s) => s.id), ['bastien', 'helmet', 'bells', 'window', 'pipes', 'house']);
  const st = (id) => q.stages.find((s) => s.id === id);
  assert.equal(st('bells').via, 'the air bells');
  assert.equal(st('window').via, 'the canyon street');
  assert.equal(st('pipes').flag, TUNED_FLAG);
  for (const name of ['the air bells', 'the canyon street']) {
    const l = level.lines.find((x) => x.name === name);
    assert.ok(l && l.auto === false && l.points.length > 6, name);
  }
  const bells = level.lines.find((x) => x.name === 'the air bells').points, street = level.lines.find((x) => x.name === 'the canyon street').points;
  assert.ok(flat(V(...bells[0]), V(...level.uw.ways.rack.at)) < 4 && flat(V(...bells.at(-1)), V(...street[0])) < 1, 'the bells from the rack to the street’s head');
  assert.ok(flat(V(...street.at(-1)), V(DOMES.gallery.x + DOMES.gallery.r - 4, 0, DOMES.gallery.z)) < 1, 'the street to the window');
  // the words: Bastien sends you out by the lock, every line toned
  const where = PEOPLE.bastien.talk.nodes.where.say.join(' ');
  assert.ok(/helmet/.test(where) && /lock/.test(where), 'Bastien names the helmet and the lock');
  for (const line of [...PEOPLE.bastien.talk.nodes.where.say, ...PEOPLE.bastien.talk.nodes.again.say, ...THINGS.window.talk.nodes.listen.say, ...level.crowdLines]) assert.ok(toneOf(line), `toned: ${line}`);
  for (const line of [LINES.helmet, LINES.refuse, LINES.tuned, ...Object.values(LINES.pipe)]) assert.ok(!/\n/.test(line) && line.length < 110, `one line: ${line}`);
});

// ------------------------------------------------------------------ solid as drawn, within budget
test('the new pieces stand as they are drawn (the contact audit on them), within their collision budget', () => {
  const ours = new Set(['The canyon street', 'The walk on the seabed', 'The singing city']);
  const keep = new Set(), exclude = [];
  scene.traverse((o) => { if (o.isMesh) { if (ours.has(o.parent?.name) && ours.has(o.name)) keep.add(o); else exclude.push(o); } });
  const r = auditContact({ physics, scene, exclude, max: 12000 });
  assert.ok(r.checked.walk > 300, `drawn tops checked: ${r.checked.walk}`);
  const off = r.groups.filter((g) => ours.has(g.name) && /feet (sink|hover)|climbs inside/.test(g.issue)), n = off.reduce((a, g) => a + g.n, 0);
  assert.ok(n <= 12, `${n} contact samples off on them\n${formatContact(r)}`);
  const tris = {};
  for (const m of keep) if (!m.userData.noCollide) tris[m.name] = (tris[m.name] ?? 0) + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  const CAP = { 'The canyon street': 60000, 'The walk on the seabed': 6000, 'The singing city': 6000 };
  for (const [k, cap] of Object.entries(CAP)) assert.ok((tris[k] ?? 0) > 0 && tris[k] <= cap, `${k}: ${tris[k]} triangles (cap ${cap})`);
  assert.ok(physics.triangles < 260000, `the city’s static collision: ${physics.triangles}`);
  // the drawn-only pieces are flagged so
  for (const name of ['The air bells’ bubbles', 'The pipes’ bubbles', 'The song’s rings', 'The cable car']) assert.ok(scene.getObjectByName(name)?.userData.noCollide, `${name}: drawn only`);
});

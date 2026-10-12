// Vael's explorations, the author's three picks woven into one way through the world (issue #187; docs/systems/worlds.md
// "Vael's explorations"): the riders' road sunk below the plain from beside the shrine to the lone tower, which rises out
// of a pit at its end (src/vael-canyon.js); the sundial of needles round the tower, its shadow laid by the riders' hour
// as the way on (src/vael-sundial.js); and past the riders' gate the plain breaking up and falling upward, a step of
// stones out over the cloud, three of them rising while you stand on them (src/vael-edge.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { THINGS } = await import('../src/story/arzach-data.js');
const { riderHour, HOUR_EL, SWING, RINGS, bearing } = await import('../src/vael-sundial.js');
const { ROAD_LENGTH, roadAt, bedAt, CLEFT, EARS, inRoad, ridersCut } = await import('../src/vael-canyon.js');
const { CHAIN, RISERS, RISE } = await import('../src/vael-edge.js');
const { SWING_CUE, RISE_CUE } = await import('../src/story/arzach-explorations.js');
const { templeOf } = await import('../src/temples/index.js');
const { auditContact, formatContact } = await import('../src/contact-audit.js');
const { stripTone, parseLine } = await import('../src/story/tone.js');
const { game } = await import('../src/game-state.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const deg = (a) => (a * 180) / Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** As the level design audit sees: nothing the collision holds between the eye and the point, and no ground over the ray. */
function sees(W, eye, at) {
  const d = eye.distanceTo(at), dir = at.clone().sub(eye).normalize();
  if (W.physics.rayDistance(eye.clone(), dir, d) < d - 3) return false;
  for (let s = 6; s < d - 3; s += 6) { const p = eye.clone().addScaledVector(dir, s); if (W.level.ground.heightAt(p.x, p.z) > p.y + 0.3) return false; }
  return true;
}
const ground = (W, x, z, from = 400) => W.physics.groundAt(x, from, z, from + 200);

globalThis.location = { search: '?level=arzach' };
for (const k of ['item.glider', 'item.doublejump']) game.set(k, true);
const W = A.loadWorld('arzach');
const L = W.level, R = L.arzach.road, D = L.arzach.sundial, E = L.arzach.edge, T = L.arzach.tower;
test.after(() => { for (const k of ['item.glider', 'item.doublejump', 'arzach.bird.promise', 'arzach2.bell.rung', 'arzach.stone.rose']) game.set(k, undefined); W.dispose(); });

/** Run from the middle of stone a toward stone b, jump at the rim, jump again, glide down: does he land on b? */
function leap(a, b, y0 = a.top) {
  const P = new A.Player(W.physics, { unsafe: L.unsafe, health: false });
  const from = V(a.at.x, y0, a.at.z), to = V(b.at.x, b.top, b.at.z);
  P.respawn(from.clone()); P.heading = Math.atan2(to.x - from.x, to.z - from.z);
  let phase = 0;
  for (let i = 0; i < 900; i++) {
    const out = Math.hypot(P.pos.x - from.x, P.pos.z - from.z), input = { KeyW: Math.hypot(to.x - P.pos.x, to.z - P.pos.z) > 1, ShiftLeft: true };
    if (phase === 0 && out > a.r * 0.74) { input.Space = true; phase = 1; } else if (phase === 1 && !P.onGround && P.vel.y < 1) phase = 2;
    else if (phase === 2) { input.Space = true; phase = 3; } else if (phase === 3 && !P.onGround) input.Space = P.vel.y < 0;
    P.update(1 / 60, input, Math.atan2(to.x - P.pos.x, to.z - P.pos.z) + Math.PI);
    if (phase >= 3 && P.onGround) break;
  }
  return Math.abs(P.pos.y - b.top) < 0.8 && Math.hypot(P.pos.x - b.at.x, P.pos.z - b.at.z) < b.r * 1.1;
}

// ------------------------------------------------------------------ the riders' road
test('the riders’ road: from beside the shrine down between sheer walls to the pit, the tower rising out of it', () => {
  const shrine = L.arzach.plain.shrine.at;
  assert.ok(flat(R.head, shrine) < 40, `the road starts by the riders’ shrine (${flat(R.head, shrine).toFixed(0)} m)`);
  // walked on foot, the head to the wind at the pit's floor, and down the steps
  const wind = W.world.wind.foot.clone().add(V(0, 0.5, 0));
  const walk = A.walkTo(W, R.head.clone(), wind, { cell: 2, max: 60000 });
  assert.ok(walk.ok, `walked from the road's head to the wind (${walk.closest.toFixed(0)} m short)`);
  assert.ok(R.steps.length > 30 && R.steps.every((p, i) => !i || p.y <= R.steps[i - 1].y + 0.3) && R.steps[0].y - R.steps.at(-1).y > 15, 'the worn steps go down');
  // deep and narrow: halfway along, the bed 20 m wide at most and the plain 12 m and more over it on both sides
  for (const s of [110, 140, 165]) {
    const r = roadAt(s), bed = ground(W, r.x, r.z, r.floor + 3);
    assert.ok(Math.abs(bed - r.floor) < 0.6, `the bed at ${s} m`);
    for (const side of [1, -1]) {
      const n = V(-r.tz * side, 0, r.tx * side), x = r.x + n.x * (bedAt(s) + 6), z = r.z + n.z * (bedAt(s) + 6), lip = ground(W, x, z);
      assert.ok(lip - r.floor > 12, `the wall at ${s} m stands ${(lip - r.floor).toFixed(1)} m`);
      // a sheer face: a ray across from the middle meets it at the bed's edge
      const hit = W.physics.rayDistance(V(r.x, r.floor + 4, r.z), n, 20);
      assert.ok(hit > bedAt(s) - 2 && hit < bedAt(s) + 1.6, `the face at ${hit.toFixed(1)} m`);
    }
  }
  // the tower rises out of the pit: its foot on the pit's floor, its window and balcony where they were over the plain
  assert.ok(Math.abs(T.base - CLEFT.floor) < 0.3, `the tower stands on the pit’s floor (${T.base.toFixed(1)})`);
  assert.ok(Math.abs(T.floor - 286.88) < 0.05, `its balcony where it was (${T.floor.toFixed(2)})`);
  const wall = ground(W, CLEFT.x + CLEFT.R + 5, CLEFT.z);
  assert.ok(wall - CLEFT.floor > 18, `the pit is ${(wall - CLEFT.floor).toFixed(0)} m deep`);
  // nothing of the plain's scatter stands in it; the cut is the road's and the pit's alone
  assert.equal(ridersCut(600, -900, 12), 12);
  assert.ok(inRoad(roadAt(100).x, roadAt(100).z) && !inRoad(-300, -1200));
});

test('down in the road the tower’s foot is lost behind its bends, and found again rising out of the pit at its end', () => {
  const foot = V(T.x - 10, T.base + 4, T.z + 10), balcony = V(T.x, T.floor + 3, T.z + 21);
  // along the winding bed the foot is out of sight behind the walls; from the last stretch and the pit it is there
  const seen = (s) => { const r = roadAt(s); return sees(W, V(r.x, r.floor + 1.7, r.z), foot); };
  let hidden = 0, n = 0;
  for (let s = 10; s < ROAD_LENGTH - 45; s += 6) { n++; if (!seen(s)) hidden++; }
  assert.ok(hidden / n > 0.8, `the tower's foot hidden from ${hidden} of ${n} places along the road`);
  assert.ok(seen(ROAD_LENGTH - 20) && seen(ROAD_LENGTH), 'and found at the road’s end');
  const eye = W.world.wind.foot.clone().add(V(0, 1.7, 0));
  const skin = (y) => { const d = V(eye.x - T.x, 0, eye.z - T.z).normalize(); return V(T.x + d.x * 14.5, y, T.z + d.z * 14.5); };   // (the shaft's face toward the eye)
  assert.ok(sees(W, eye, skin(T.base + 12)) && sees(W, eye, skin(T.base + 120)), 'from the pit: the tower rising straight up');
  // and its top over the plain, from the road's head: the way to go
  assert.ok(sees(W, R.head.clone().add(V(0, 1.7, 0)), balcony), 'from the road’s head: the balcony over the plain');
});

test('the ears: carved in the cleft’s walls, whispered into, the whisper runs on to the tower', () => {
  assert.equal(R.ears.length, EARS.length);
  for (const e of R.ears) {
    const d = flat(e.at, roadAt(e.s));
    assert.ok(d > bedAt(e.s) - 1.6 && d < bedAt(e.s) + 0.5, `ear on the wall's face (${d.toFixed(1)} m out)`);
    assert.ok(Math.abs(e.stand.y - roadAt(e.s).floor) < 0.6, 'stood before on the bed');
    assert.ok(sees(W, e.stand.clone().add(V(0, 1.7, 0)), e.look), 'seen from the bed');
  }
  assert.ok(R.echo(0) > 3 && R.running());
  let t = 0;
  while (R.running() && t < 30) { R.update(1 / 30); t += 1 / 30; }
  assert.ok(t > 2 && t < 30, `the whisper reached the tower in ${t.toFixed(1)} s`);
  assert.ok(W.scene.getObjectByName('The whisper').userData.noCollide);
  const ear = THINGS.ear.talk.nodes.look.say;
  assert.ok(ear.length >= 3 && ear.every((l) => parseLine(l).explicit), 'the ear’s look, every line with its tone');
});

// ------------------------------------------------------------------ the sundial
test('the sundial: the needles in three rings round the tower, an hour stone at each of the outer ring’s', () => {
  RINGS.forEach((ring, k) => {
    const on = D.needles.filter((n) => n.k === k && !n.named);
    assert.ok(on.length >= ring.n * 0.6, `ring ${k + 1}: ${on.length} of ${ring.n}`);
    for (const n of on) assert.ok(Math.abs(Math.hypot(n.x - T.x, n.z - T.z) - ring.R) < 1, 'on its ring');
  });
  assert.ok(D.hours.length >= 10, `${D.hours.length} hour stones`);
  for (const h of D.hours) assert.ok(Math.abs(h.at.y - L.ground.heightAt(h.at.x, h.at.z)) < 0.6 && !inRoad(h.at.x, h.at.z), 'on the plain, out of the road');
  // the plain's own scatter keeps off the face
  const pebbled = L.arzach.spires.filter((s) => Math.hypot(s.x - T.x, s.z - T.z) < RINGS[2].R + 20);
  assert.ok(pebbled.length <= 1, 'no scattered spire on the dial but Senn’s');
  // Senn's spire is the home hour's, its cap still under the hush-cloth's box
  const senn = W.npcs.find((n) => n.def?.id === 'senn');
  const spire = L.arzach.spires.find((q) => flat(q, senn.pos) < 20);
  assert.ok(D.named.home && spire && flat(D.named.home.at, spire) < spire.r + 6, 'the home hour’s stone at the foot of Senn’s spire');
  const hush = W.boxes.list.find((b) => b.id === 'arzach.hush');
  if (hush) { const g = ground(W, hush.pos.x, hush.pos.z, hush.pos.y + 20); assert.ok(Math.abs(g - hush.pos.y) < 1.2, `the hush-cloth on the cap (${g.toFixed(1)} vs ${hush.pos.y.toFixed(1)})`); }
});

test('the riders’ hour: the tower’s shadow lies toward the white house once the wings are yours, the gate once the bird has answered, home once the bell has rung', () => {
  const flags = (o) => (k) => !!o[k];
  assert.equal(riderHour(flags({})), 'morning');
  assert.equal(riderHour(flags({ 'item.glider': true })), 'aerie');
  assert.equal(riderHour(flags({ 'item.glider': true, 'arzach.bird.promise': true })), 'gate');
  assert.equal(riderHour(flags({ 'item.glider': true, 'bird.promise': true, 'arzach2.bell.rung': true })), 'home');
  const door = templeOf(L, 'arzach').outside.door.at, gate = L.arzach.gate.at;
  const sun = D.sun, dir = V();
  sun.set('aerie', { swing: false });
  assert.ok(Math.abs(deg(wrap(D.shadowAz() - bearing(T.x, T.z, door.x, door.z)))) < 1, 'toward the Aerie’s door');
  // long enough to lead: from the tower's top at the riders' height of sun, most of the way to the door
  const length = (T.base + T.H + 40 - door.y) / Math.tan((HOUR_EL * Math.PI) / 180);
  assert.ok(length > 0.8 * flat(T, door), `the shadow ${length.toFixed(0)} m, the door ${flat(T, door).toFixed(0)} m off`);
  // the level's light comes from that sun (the clock's own sun in, the riders' out); at night the moon's, untouched
  const clock = V(0.7, 0.6, 0.2).normalize();
  L.lightAt(V(), dir.copy(clock));
  assert.ok(Math.abs(Math.asin(dir.y) - (HOUR_EL * Math.PI) / 180) < 1e-3 && Math.abs(wrap(Math.atan2(-dir.x, -dir.z) - D.shadowAz())) < 1e-3, 'the riders’ sun');
  const moon = V(0.3, 0.04, 0.9).normalize();
  L.lightAt(V(), dir.copy(moon));
  assert.ok(dir.distanceTo(moon) < 1e-9, 'the moon left alone');
  // the stone the shadow lies on has its lamp lit, and only that one
  D.update(0, 0);
  assert.ok(D.lit(D.named.aerie) && D.named.aerie.lamp.visible, 'the white house’s hour stone lit');
  assert.ok(D.hours.filter((h) => h.lamp.visible).length <= 2, 'and next to none other');
  // the hour turns: the sun swings round over SWING seconds, the shadow sweeping to the gate
  sun.set('gate');
  D.update(SWING / 2, 1);
  const mid = D.shadowAz();
  assert.ok(Math.abs(wrap(mid - D.bearings.aerie)) > 0.01 && Math.abs(wrap(mid - D.bearings.gate)) > 0.01 && !D.lit(D.named.gate), 'halfway round');
  D.update(SWING / 2 + 0.1, 2);
  assert.ok(Math.abs(deg(wrap(D.shadowAz() - bearing(T.x, T.z, gate.x, gate.z)))) < 1 && D.lit(D.named.gate), 'on to the riders’ gate');
  sun.set('home', { swing: false });
  assert.ok(Math.abs(deg(wrap(D.shadowAz() - bearing(T.x, T.z, L.spawn.x, L.spawn.z)))) < 1, 'home toward the landing');
  sun.set('morning', { swing: false });
  sun.clock = null;
  L.lightAt(V(), dir.copy(clock));
  assert.ok(dir.distanceTo(clock) < 1e-6, 'in the morning, the clock’s own sun');
  assert.ok(THINGS.hourstone.talk.nodes.look.say.every((l) => parseLine(l).explicit));
});

test('the story turns the hour as the wings, the bird and the bell come, with one line; not while you are in a house overhead', () => {
  const toasts = W.toasts.length;
  game.set('item.glider', true);
  W.step(2);
  game.set('arzach.bird.promise', true);
  W.at(V(T.x + 120, 60, T.z)); W.step(2);
  assert.equal(D.sun.hour, 'gate');
  assert.ok(W.toasts.slice(toasts).includes(SWING_CUE), 'one line says so');
  assert.ok(SWING_CUE.length < 70 && RISE_CUE.length < 70, 'one-line hints');
  game.set('arzach2.bell.rung', true);
  W.at(V(T.x, 1500, T.z)); W.step(2);
  assert.equal(D.sun.hour, 'gate', 'it waits while you are up in a temple');
  W.at(V(T.x + 120, 60, T.z)); W.step(2);
  assert.equal(D.sun.hour, 'home');
  game.set('arzach2.bell.rung', undefined);
});

// ------------------------------------------------------------------ where the stones fall up
test('where the stones fall up: cracks, tipped slabs, then a step of stones out over the cloud, each a leap from the last', () => {
  const lip = { at: V(-6, 0, -965), top: ground(W, -6, -965, 80), r: 9 };
  assert.ok(leap(lip, E.slabs[0]), 'from the plain onto the first stone');
  for (let i = 0; i + 1 < E.slabs.length; i++) {
    const a = E.slabs[i], b = E.slabs[i + 1];
    if (a.riser) continue;
    assert.ok(leap(a, b), `stone ${i + 1} to ${i + 2}`);
  }
  // they hang over the cloud, rising toward the sky stones; the highest a sight over the plain behind
  assert.ok(E.slabs.every((s) => L.ground.heightAt(s.at.x, s.at.z) < s.top - 20 || s.i === 0), 'over the cliff and the cloud');
  assert.ok(E.slabs.at(-1).top - E.slabs[0].top > 35, 'rising');
  assert.ok(sees(W, E.high.stand.clone().add(V(0, 1.7, 0)), V(T.x, T.floor + 3, T.z + 21)), 'from the highest stone, the tower over the plain');
  const lipEye = V(-20, ground(W, -20, -960, 80) + 1.7, -960);
  const rim = (sl) => { const d = V(lipEye.x - sl.at.x, 0, lipEye.z - sl.at.z).normalize(); return V(sl.at.x + d.x * sl.r * 0.7, sl.top - 1, sl.at.z + d.z * sl.r * 0.7); };
  assert.ok([0, 1, 3].every((i) => sees(W, lipEye, rim(E.slabs[i]))), 'the first stones seen from the lip beside the riders’ gate');
  for (const id of ['broken', 'highstone']) assert.ok(THINGS[id].talk.nodes.look.say.every((l) => parseLine(l).explicit), `${id}: tones`);
});

test('the stones that rise: still, they lift whoever stands on them up to the next, and sink back once left', () => {
  assert.equal(E.risers.length, RISERS.length);
  for (const q of E.risers) {
    const a = E.slabs[q.i], b = E.slabs[q.i + 1];
    assert.ok(b.top - a.top > 6, 'the next stone out of reach from below');
    assert.ok(!leap(a, b), 'so it cannot be leapt to');
    assert.ok(q.collider?.moving, 'a moving collider');
  }
  // stand on the first: it lifts, carrying him, to a leap below the next
  const q = E.risers[0], P = W.player;
  W.at(V(q.x, q.rest + 0.05, q.z));
  let t = 0;
  for (let i = 0; i < 60 * 20; i++) {
    W.physics.syncMovers(1 / 60);
    P.update(1 / 60, {}, 0);
    L.update(1 / 60, (t += 1 / 60), { player: P });
  }
  assert.ok(q.h > q.up - 0.05, `risen ${q.h.toFixed(1)} of ${q.up} m`);
  assert.ok(Math.abs(P.pos.y - (q.rest + q.up)) < 0.6, `carried up with it (${P.pos.y.toFixed(1)})`);
  assert.ok(Math.abs(ground(W, q.x, q.z, q.rest + q.up + 5) - (q.rest + q.up)) < 0.3, 'it collides where it stands now');
  const next = E.slabs[q.i + 1];
  assert.ok(next.top - (q.rest + q.up) < 2.5, 'the next stone a leap away');
  // left alone it waits, then sinks back
  W.at(V(next.at.x, next.top + 0.05, next.at.z));
  for (let i = 0; i < 60 * (RISE.wait + q.up / RISE.down + 2); i++) { W.physics.syncMovers(1 / 60); L.update(1 / 60, (t += 1 / 60), { player: W.player }); }
  assert.ok(q.h < 0.05, 'sunk back');
});

// ------------------------------------------------------------------ solid as drawn, and what it costs
test('what you stand on and climb in the new pieces is what is drawn', () => {
  // (the new pieces: the road, the dial, the broken edge; not what stood there before them: the tower and the old plinth at its foot, Senn’s spire and its cap)
  const old = (p) => Math.hypot(p.x - T.x, p.z - T.z) < 17.5 || p.y > 100 || Math.hypot(p.x + 20, p.z + 1362) < 14;
  const near = (p) => !old(p) && (inRoad(p.x, p.z, -8) || Math.hypot(p.x - T.x, p.z - T.z) < RINGS[2].R + 8 || (p.z > -1080 && p.z < -700 && p.x > -200 && p.x < 70));
  const r = auditContact({ physics: W.physics, scene: W.scene, region: near, max: 12000 });
  assert.ok(r.checked.wall > 500 && r.checked.top > 500, JSON.stringify(r.checked));
  // (what is left: an ear's rim proud of its wall, a wall's ledge over the cap's lip, sand banked by Senn's spire)
  assert.ok((r.counts['climbs inside'] ?? 0) <= 6, formatContact(r));   // (the audit samples afresh as the scene changes: a little room)
  assert.ok((r.counts['feet sink'] ?? 0) + (r.counts['feet hover'] ?? 0) <= 5, formatContact(r));
  assert.ok((r.counts['walks through'] ?? 0) <= 12, formatContact(r));
  assert.ok((r.counts['unseen floor'] ?? 0) < 60, formatContact(r));
  // the drawn-only pieces are flagged so
  for (const name of ['The whisper', 'The sundial’s marker stones', 'Pebbles falling up', 'The cracks toward the edge', 'The rider’s rope']) assert.ok(W.scene.getObjectByName(name)?.userData.noCollide, `${name}: drawn only`);
  for (const name of ['The riders’ road: its walls', 'The riders’ road: the stone ears', 'The hour stones', 'The stones that fell up']) assert.ok(!W.scene.getObjectByName(name)?.userData.noCollide, `${name}: solid`);
});

test('Vael’s collision budget holds with them', () => {
  assert.ok(W.physics.triangles < 520000, `static collision ${W.physics.triangles} triangles`);
  // what they add to the drawn world, all told
  let tris = 0;
  for (const name of ['The riders’ road: its walls', 'The riders’ road: the plain over its walls', 'The sundial’s needles', 'The stones that fell up', 'The stones that fell up: their broken sides']) {
    W.scene.traverse((o) => { if (o.isMesh && o.name === name) tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; });
  }
  assert.ok(tris < 60000, `${tris} triangles in the pieces`);
});

test('for the audit: the riders’ way named by the climb’s stage, and the places on it', () => {
  const line = L.lines.find((l) => l.name === 'the riders’ way');
  const door = templeOf(L, 'arzach').outside.door.at;
  assert.ok(line && line.auto === false && flat(V(...line.points[0]), door) < 1 && flat(V(...line.points.at(-1)), W.world.wind.foot) < 2, 'from the white house to the wind');
  const stage = W.quests.def('arzach.bird').stages.find((s) => s.id === 'tower');
  assert.equal(stage.via, 'the riders’ way');
  for (const name of ['a stone ear in the riders’ road (1)', 'the hour stone toward the white house', 'the hour stone toward the riders’ gate', 'the first broken slab', 'the stone that rises', 'the highest stone']) assert.ok(L.sights.some((s) => s.name === name), name);
  assert.ok(stripTone(THINGS.broken.talk.nodes.look.say[0]).length > 20);
});

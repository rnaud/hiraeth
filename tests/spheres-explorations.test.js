// The Garden of Spheres' picked explorations as one way through the world (issue #190; docs/systems/worlds.md "The
// Garden's explorations"): over the mirror lake's stepping stones, the garden the water remembers; past its far shore the
// cracked moon in its crater of ringed terraces at the head of its furrow, the furrows of every fallen sphere pointing
// back to the great one; out of the crater up the pillar forest, along its tops and down to the plaza
// (src/levels/spheres-explorations.js, src/story/spheres-explorations.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const X = await import('../src/levels/spheres-explorations.js');
const { MOONS_CUE, MOON_CUE, CHORD_CUE, DOWNHILL_CUE, FURROWS_CUE, NOTE_SPEED } = await import('../src/story/spheres-explorations.js');
const { THINGS, QUESTS } = await import('../src/story/spheres-data.js');
const { auditContact, formatContact } = await import('../src/contact-audit.js');
const { stripTone } = await import('../src/story/tone.js');
const { bestInteractable } = await import('../src/interact.js');
const { game } = await import('../src/game-state.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** As the level design audit sees: nothing the collision holds between the eye and the point, and no ground over the ray. */
function sees(W, eye, at, near = 3) {
  const d = eye.distanceTo(at), dir = at.clone().sub(eye).normalize();
  if (W.physics.rayDistance(eye.clone(), dir, d) < d - near) return false;
  for (let s = 6; s < d - near; s += 6) { const p = eye.clone().addScaledVector(dir, s); if (W.level.ground.heightAt(p.x, p.z) > p.y + 0.3) return false; }
  return true;
}

globalThis.location = { search: '?level=spheres' };
game.reset();
const W = A.loadWorld('spheres');
const L = W.level, G = L.spheres, E = G.explore, S = W.world.explore;
const way = E.way.map((p) => V(...p));
test.after(() => W.dispose());

/** The real traveller walking the high way from point i to point j, steering at each in turn: where he ends. */
function walkWay(i, j) {
  const P = new A.Player(W.physics, { unsafe: L.unsafe, health: false, climb: true });
  P.respawn(way[i].clone().add(V(0, 0.5, 0)));
  let k = i + 1, stuck = 0, last = P.pos.clone();
  for (let f = 0; f < 60 * 400 && k <= j; f++) {
    const g = way[k];
    if (flat(P.pos, g) < 1.4 && Math.abs(g.y - P.pos.y) < 3) { k++; continue; }
    P.update(1 / 60, { KeyW: true }, Math.atan2(g.x - P.pos.x, g.z - P.pos.z) + Math.PI);
    if (f % 120 === 119) { stuck = P.pos.distanceTo(last) < 0.5 ? stuck + 1 : 0; last.copy(P.pos); if (stuck > 3) break; }
    if (P.onGround && P.pos.y < Math.min(g.y, way[k - 1].y) - 4) break;   // (fell off)
  }
  return { ok: k > j, at: k, pos: P.pos.clone() };
}
const index = (pred) => way.findIndex(pred);

// ------------------------------------------------------------------ one way through: the main quest's stage names it
test('the plaza stage sends you over the lake’s stones and the high walk, a line the world declares from the pearl to the plaza', () => {
  const stage = QUESTS[0].stages.find((s) => s.id === 'plaza');
  assert.equal(stage.via, 'the lake’s stones and the high walk');
  const line = L.lines.find((l) => l.name === stage.via);
  assert.ok(line, 'declared');
  assert.ok(flat(way[0], V(96, 0, -36)) < 2 && flat(way.at(-1), V(G.plaza.x, 0, G.plaza.z + G.plaza.r - 4)) < 2, 'from the pearl to the plaza');
  // (within the audit's slack: 1.6 times the straight walk)
  let len = 0; for (let i = 1; i < way.length; i++) len += way[i].distanceTo(way[i - 1]);
  assert.ok(len < 1.6 * way[0].distanceTo(way.at(-1)), `${len.toFixed(0)} m`);
  for (const name of ['the first stepping stone', 'the middle of the lake’s stones', 'the cracked moon', 'the founders’ mark', 'the terraces round the sphere west of the arch', 'the first sphere on the pillars', 'a sphere high on the pillars (3)'])
    assert.ok(L.sights.some((s) => s.name === name), name);
  assert.ok(L.beacons.filter((b) => /pillar of the forest/.test(b.name)).length === 6, 'the pillars are beacons');
});

test('walked by the real traveller: over the stones, down into the crater and up out of it, up the pillar, over the tops, down to the plaza', () => {
  const stones = [index((p) => flat(p, E.stones[0]) < 0.1), index((p) => flat(p, E.stones.at(-1)) < 0.1)];
  const up = index((p) => flat(p, E.spirals.up[0]) < 0.1), top = index((p, i) => i > up && Math.abs(p.y - E.pillars[0].top) < 0.1 && flat(p, E.pillars[0]) < 0.1);
  const down = index((p, i) => i > top && flat(p, E.spirals.down.at(-1)) < 0.1);
  for (const [a, b, what] of [[0, stones[1] + 1, 'the causeway'], [stones[1], up, 'through the crater'], [up, top + 1, 'up the first pillar'], [top, down, 'over the tops'], [down, way.length - 1, 'down and on to the plaza']]) {
    const r = walkWay(a, b);
    assert.ok(r.ok, `${what}: stopped before point ${r.at} at ${r.pos.toArray().map((v) => v.toFixed(1))}`);
  }
});

// ------------------------------------------------------------------ what the lake remembers
test('the causeway: stones touching from shore to shore just over the water, the lake’s depth under them', () => {
  const s = E.stones;
  assert.ok(s.length >= 20 && s.filter((q) => q.mid).length === 1);
  for (let i = 1; i < s.length; i++) assert.ok(Math.hypot(s[i].x - s[i - 1].x, s[i].z - s[i - 1].z) - s[i].r - s[i - 1].r < 0.02, `stones ${i - 1} and ${i} touch`);
  for (const q of s) {
    const g = W.physics.groundAt(q.x, q.top + 2, q.z, 4);
    assert.ok(Math.abs(g - q.top) < 0.05, `stone ${q.i} stood on as drawn`);
    assert.ok(q.top > L.spheres.lake.level + 0.6 && q.top < L.spheres.lake.level + 1, 'just over the water');
    assert.ok(!L.unsafe(V(q.x, q.top, q.z)), 'safe on it');
  }
  // off it, the lake puts you back
  const mid = E.lake.mid;
  assert.ok(L.unsafe(V(mid.x + 9, L.spheres.lake.level, mid.z)), 'the water beside it');
  // the landing on the far shore, between the temple and the pyramid
  assert.ok(flat(s.at(-1), V(X.LANDING[0], 0, X.LANDING[1])) < 6);
});

test('in the water a garden that is not on the shore, and once the bell is heard the spheres in its sky', () => {
  const reflections = W.scene.children.filter((o) => o.isMesh && o.userData.noCollide && o.material?.uniforms?.uColor && Math.abs(o.position.y) < 1e-6);
  assert.ok(reflections.length > 20, `${reflections.length} reflected shapes`);
  // (none of the memory is standing on the shore: it is only in the water)
  assert.ok(!W.physics.rayHit(V(205, 30, -258), V(0, -1, 0), 25), 'no great pyramid on the far shore itself');
  const moons = E.lake.moons;
  assert.ok(moons.children.length === 2 && moons.children.every((m) => m.userData.noCollide));
  W.at(E.lake.look.stand.clone()); W.step(2);
  assert.equal(moons.visible, false, 'no spheres in its sky yet');
  assert.ok(!W.toasts.includes(MOONS_CUE));
  game.set('spheres.heard.bell', true);
  W.step(2);
  assert.ok(moons.visible && W.toasts.filter((t) => t === MOONS_CUE).length === 1, 'they hang there, one line');
  W.step(2);
  assert.ok(W.toasts.filter((t) => t === MOONS_CUE).length === 1, 'once');
  // look into the lake from the middle stone
  const it = bestInteractable(W.player)?.entry;
  assert.ok(it?.prompt === 'look into the lake', it?.prompt);
  const say = THINGS.lake.talk.nodes.look.say;
  assert.ok(say.some((l) => typeof l === 'object' && l.if?.flag === 'spheres.heard.bell'), 'what it shows once the bell is heard');
  game.set('spheres.heard.bell', undefined);
});

// ------------------------------------------------------------------ where the moons fell
test('every fallen sphere lies at the end of its furrow, all pointing back to the great sphere, the ground lowered along it', () => {
  for (const f of X.FURROWS) {
    const [dx, dz] = X.toGreat(f.x, f.z);
    assert.ok(Math.abs(dx - f.dx) < 1e-9 && Math.abs(dz - f.dz) < 1e-9, 'toward the great sphere');
    assert.ok(G.orbs.some((o) => Math.hypot(o.x - f.x, o.z - f.z) < 1 && Math.abs(o.R - f.R) < 1), `a sphere at its head (${f.x}, ${f.z})`);
    // halfway along, its bed under its banks
    const s = f.len * 0.5, bx = f.x + f.dx * s, bz = f.z + f.dz * s, nx = f.dz * f.half * 1.35, nz = -f.dx * f.half * 1.35;
    if (X.inCrater(bx, bz) || G.lake && Math.hypot((bx - G.lake.x) / G.lake.rx, (bz - G.lake.z) / G.lake.rz) < 2) continue;
    if (Math.abs(bx) < 70 && bz < -40) continue;   // (levelled for the path and the avenue)
    if (X.FURROWS.some((g) => g !== f && Math.abs((bx - g.x) * g.dz - (bz - g.z) * g.dx) < g.half * 3 && (bx - g.x) * g.dx + (bz - g.z) * g.dz > 0)) continue;   // (across another's)
    const H = (x, z) => L.ground.heightAt(x, z);
    assert.ok(H(bx, bz) < Math.min(H(bx + nx, bz + nz), H(bx - nx, bz - nz)) - 1, `the furrow from (${f.x}, ${f.z}) lies lower than its banks`);
  }
  // the sphere of the drum still sits as it sat (its furrow starts past its footing)
  const drum = G.listen.drum;
  assert.ok(Math.abs(drum.y - (L.ground.baseAt(drum.x, drum.z, drum.R * 0.6) + drum.R * 0.5)) < 0.01);
});

test('from the belvedere the furrows are seen running to the great sphere, and one line says so the first time', () => {
  const eye = E.belvedere.clone().add(V(0, 1.6, 0));
  let seen = 0, all = 0;
  for (const f of X.FURROWS) for (const s of [0.4, 0.7]) {
    const x = f.x + f.dx * f.len * s, z = f.z + f.dz * f.len * s;
    if (X.inCrater(x, z) || Math.hypot(x - eye.x, z - eye.z) > 900) continue;
    all++; if (sees(W, eye, V(x, L.ground.heightAt(x, z) + 0.5, z), 6)) seen++;
  }
  assert.ok(seen >= all * 0.5 && seen >= 5, `${seen} of ${all} stretches of the furrows in sight`);
  W.at(E.belvedere.clone()); W.step(2);
  assert.ok(W.toasts.includes(FURROWS_CUE));
});

test('the craters: ringed terraces down to a floor, stairs down each wall, the meadow’s ground far under the terraces', () => {
  for (const [id, C] of Object.entries(E.craters)) {
    const [rf, r1, r2] = C.rings, lv = C.levels;
    for (const [r, y] of [[rf * 0.5, lv[0]], [(rf + r1) / 2, lv[1]], [(r1 + r2) / 2, lv[2]], [r2 + 5, lv[3]]]) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + 0.13, x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r;
        if (id === 'cracked' && r < C.R + 1) continue;
        const g = W.physics.groundAt(x, y + 1.5, z, 3);
        if (Math.abs(g - y) > 0.05) continue;   // (a flight of stairs or the sphere there)
        assert.ok(L.ground.heightAt(x, z) < y - 0.3, `${id}: the terrain under the terrace at ${r} m`);
      }
    }
    // each stair walked from the rim to the floor
    for (const a of C.stairs) {
      const from = V(C.x + Math.cos(a) * (r2 + 3), lv[3], C.z + Math.sin(a) * (r2 + 3)), to = V(C.x + Math.cos(a) * (rf - 3), lv[0], C.z + Math.sin(a) * (rf - 3));
      const w = A.walkTo(W, from, to, { cell: 1, max: 40000 });
      assert.ok(w.ok, `${id}: down the stair at ${a.toFixed(2)} (${w.closest.toFixed(1)} m short)`);
    }
  }
  // the sphere west of the arch on its crater's floor, its ring of light round its foot on the floor too
  const ch = W.world.listeners.find((s) => s.id === 'chant'), C = E.craters.chant;
  assert.ok(Math.abs(ch.o.y - (C.levels[0] + ch.o.R * X.CRATERS.chant.sink)) < 0.01);
  assert.ok(Math.abs(ch.footY - (C.levels[0] + 0.12)) < 0.05, `its ring at ${ch.footY.toFixed(2)}`);
});

test('the craters carry sound: the sphere west of the arch louder the lower down its terraces', () => {
  const C = E.craters.chant, b = () => S.boost('chant');
  W.at(V(C.x + C.rings[3] + 30, C.y0, C.z)); assert.equal(b(), 0, 'outside, nothing');
  const at = (r, y) => { W.at(V(C.x + r, y, C.z)); return b(); };
  const rim = at(C.rings[2] + 2, C.levels[3]), mid = at((C.rings[0] + C.rings[1]) / 2, C.levels[1]), floor = at(C.rings[0] - 2, C.levels[0]);
  assert.ok(rim < mid && mid < floor && floor > 0.4, `${rim.toFixed(2)} < ${mid.toFixed(2)} < ${floor.toFixed(2)}`);
  game.set('spheres.heard.chant', true);
  assert.ok(at(C.rings[0] - 2, C.levels[0]) > 0.95, 'all of it, once it has remembered');
  // (the band plays it there, in the story's frame)
  W.step(1);
  const band = W.sound.band?.('sphere.chant');
  if (band) assert.ok(band.vol > 0.9);
  game.set('spheres.heard.chant', undefined);
});

test('the cracked moon: a crack opening toward the causeway, a room inside, its last sound within, the founders’ mark', () => {
  const C = E.cracked;
  // through the crack, in: a ray from outside, level with a person, meets nothing until the back of the room
  const out = V(C.x + Math.cos(C.face) * (C.R + 6), C.floor + 1.6, C.z + Math.sin(C.face) * (C.R + 6)), d = V(-Math.cos(C.face), 0, -Math.sin(C.face));
  assert.ok(W.physics.rayDistance(out, d, 40) > 6 + C.R * 1.7, 'the crack is open');
  // beside the crack, the shell is closed
  const side = V(-Math.sin(C.face), 0, Math.cos(C.face)), off = out.clone().addScaledVector(side, C.R * 0.75);
  assert.ok(W.physics.rayDistance(off, d, 40) < 6 + C.R, 'the shell beside it');
  // walked in from the threshold to the mark
  const w = A.walkTo(W, V(C.x + Math.cos(C.face) * (C.R + 2), C.floor, C.z + Math.sin(C.face) * (C.R + 2)), C.mark.stand.clone(), { cell: 1, max: 40000 });
  assert.ok(w.ok, `in to the mark (${w.closest.toFixed(1)} m short)`);
  // headroom over the room's floor
  assert.ok(W.physics.rayDistance(V(C.x, C.floor + 0.5, C.z), V(0, 1, 0), 40) > 10);
  // inside: its sound, and one line the first time
  const heard = [];
  W.sound.remembered = (kind, at) => heard.push(kind);
  W.at(V(C.x, C.floor, C.z)); W.step(2);
  assert.ok(heard.includes('foundry') && W.toasts.filter((t) => t === MOON_CUE).length === 1, 'its last sound');
  W.step(30 * 8);
  assert.ok(heard.filter((k) => k === 'foundry').length >= 2, 'coming round while you stay');
  W.at(C.mark.stand.clone()); W.step(1);
  assert.equal(bestInteractable(W.player)?.entry.prompt, 'look at the founders’ mark');
  assert.ok(THINGS.mark.talk.nodes.look.say.every((l) => stripTone(l).length > 10));
  delete W.sound.remembered;
});

// ------------------------------------------------------------------ the pillar forest
test('the pillars: tops 30-56 m up, walkways between them gentle enough to walk, a stair round the first and the last with headroom', () => {
  const P = E.pillars;
  assert.equal(P.length, 6);
  for (const p of P) {
    assert.ok(p.top - p.base > 28 && p.top - p.base < 58, `pillar ${p.i}: ${(p.top - p.base).toFixed(0)} m`);
    assert.ok(Math.abs(W.physics.groundAt(p.x, p.top + 2, p.z, 4) - p.top) < 0.05, `pillar ${p.i}: its top stood on`);
    // its sphere in its cup, off the way across
    assert.ok(flat(p.sphere, p) > p.R + 1.5 && flat(p.sphere, p) < p.plat);
  }
  assert.ok(Math.max(...P.map((p) => p.top)) === P[2].top, 'the third the highest');
  for (const w of E.walkways) {
    const L2 = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z);
    assert.ok(Math.abs(w.b.y - w.a.y) / L2 < 0.45, `walkway ${w.from}-${w.to}`);
    for (const t of [0.25, 0.5, 0.75]) { const q = w.a.clone().lerp(w.b, t); assert.ok(Math.abs(W.physics.groundAt(q.x, q.y + 1, q.z, 3) - q.y) < 0.1, `walkway ${w.from}-${w.to} at ${t}`); }
  }
  for (const [name, pts] of Object.entries(E.spirals)) {
    for (let i = 1; i < pts.length - 1; i++) {
      const q = pts[i];
      assert.ok(W.physics.rayDistance(q.clone().add(V(0, 0.3, 0)), V(0, 1, 0), 3) >= 2.6, `${name}: headroom at its step ${i}`);
    }
  }
});

test('the pillars’ chord: splash the highest and its note runs down every walkway, all six ring; a lower one rings only those below', () => {
  const notes = [];
  W.sound.orbNote = (deg, at) => notes.push({ deg, at });
  const P = E.pillars, high = (i) => A.allTargets().find((t) => t.kind === 'orb' && t.orb === G.explore.high[i]);
  // the lowest first: only itself (nothing lower beside it along the walk), and the hint that notes run down
  W.at(V(P[5].x, P[5].top, P[5].z)); W.step(1);
  notes.length = 0;
  high(5).onHit('shoot', high(5).position().clone());
  W.step(30 * 6);
  assert.equal(notes.length, 1, 'the lowest rings alone');
  assert.ok(W.toasts.includes(DOWNHILL_CUE));
  assert.ok(!game.flag('spheres.pillars.chord'));
  // the highest: every one, each as its note arrives (the walkway's length at NOTE_SPEED)
  W.at(V(P[2].x, P[2].top, P[2].z)); W.step(1);
  notes.length = 0;
  high(2).onHit('shoot', high(2).position().clone());
  assert.equal(notes.length, 1, 'it rings at once');
  const longest = Math.max(...E.walkways.map((w) => w.length));
  W.step(Math.ceil(30 * (3 * longest / NOTE_SPEED + 1)));
  assert.equal(new Set(notes.map((n) => n.deg)).size, 6, 'six notes, a chord');
  assert.ok(game.flag('spheres.pillars.chord') && W.toasts.filter((t) => t === CHORD_CUE).length === 1);
  delete W.sound.orbNote;
});

test('the pillars’ spheres are seen from the ship, from the causeway’s landing and from the crater, and their tops see the plaza', () => {
  const P = E.pillars, top = (p) => V(p.sphere.x, p.sphere.y + p.R + 0.5, p.sphere.z), eyeAt = (x, z) => V(x, L.ground.heightAt(x, z) + 1.7, z);
  const C = E.craters.cracked, rim = V(C.x + Math.cos(C.stairs[0]) * (C.rings[3] + 4), C.y0 + 1.7, C.z + Math.sin(C.stairs[0]) * (C.rings[3] + 4));
  assert.ok(P.filter((p) => sees(W, eyeAt(0, 8), top(p))).length >= 3, 'from the landing by the ship');
  assert.ok(P.filter((p) => sees(W, eyeAt(...X.LANDING), top(p))).length >= 4, 'from the causeway’s landing');
  assert.ok(P.filter((p) => sees(W, rim, top(p))).length >= 3, 'over the crater from its rim, where the way comes in');
  const eye = V(P[2].x, P[2].top + 1.7, P[2].z), pole = V(G.plaza.x, G.plaza.top, G.plaza.z);
  assert.ok(sees(W, eye, pole, 4), 'the plaza’s pole from the highest top');
  // the place's name up there
  assert.match(L.atmo(P[2].x, P[2].z, P[2].top).name, /pillar forest/);
  assert.equal(L.atmo(P[2].x, P[2].z, 0).name, 'Garden of Spheres');
});

// ------------------------------------------------------------------ solid as drawn, and the heel path untouched
test('what you stand on and climb in the new pieces is what is drawn', () => {
  // (not the umbrella that stood over the cracked moon's rim before it: its canopy as it was)
  const near = (p) => p.y < 400 && !(p.y > 10 && Math.hypot(p.x - 155, p.z + 282) < 32) && (Object.values(E.craters).some((C) => Math.hypot(p.x - C.x, p.z - C.z) < C.rings[3] + 12)
    || E.pillars.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < 12) || E.walkways.some((w) => { const t = THREE.MathUtils.clamp(((p.x - w.a.x) * (w.b.x - w.a.x) + (p.z - w.a.z) * (w.b.z - w.a.z)) / ((w.b.x - w.a.x) ** 2 + (w.b.z - w.a.z) ** 2), 0, 1); return Math.hypot(p.x - w.a.x - (w.b.x - w.a.x) * t, p.z - w.a.z - (w.b.z - w.a.z) * t) < 3; })
    || E.stones.some((s) => Math.hypot(p.x - s.x, p.z - s.z) < s.r + 0.5));
  // (not the story's rings of light round the spheres' feet: drawn, walked through)
  const rings = [...W.world.listeners.flatMap((s) => [s.ring, ...s.pulses]), ...['The furrows’ beds', 'The furrows’ banks', 'The cracked moon’s broken edge'].map((n) => W.scene.getObjectByName(n))];
  const r = auditContact({ physics: W.physics, scene: W.scene, region: near, max: 12000, exclude: rings });
  assert.ok(r.checked.wall > 300 && r.checked.top > 300, JSON.stringify(r.checked));
  assert.ok((r.counts['climbs inside'] ?? 0) <= 6, formatContact(r));
  assert.ok((r.counts['feet sink'] ?? 0) + (r.counts['feet hover'] ?? 0) <= 8, formatContact(r));
  // (the new paths are paint 0.12 m over the meadow, as every path in the Garden: walked through, nothing deeper)
  assert.ok(r.groups.filter((g) => g.issue === 'walks through' && g.max > 0.15).reduce((n, g) => n + g.n, 0) <= 6, formatContact(r));
  for (const name of ['The furrows’ beds', 'The furrows’ banks', 'The cracked moon’s broken edge', 'the lake’s moons']) assert.ok(W.scene.getObjectByName(name), name);
});

test('the heel path, the little Footprint, the tall white stone and the keepers’ stone stand as they stood', () => {
  const h = G.heel;
  assert.ok(h.path.length >= 6 && h.little && h.tall && h.stone);
  for (const [x, z] of h.path) assert.ok(!X.inCrater(x, z, 30), 'the heel path is nowhere near the craters');
  for (const name of ['the little Footprint', 'the tall white stone', 'the keepers’ stone']) assert.ok(L.sights.some((s) => s.name === name), name);
  assert.ok(L.lines.some((l) => l.name === 'the white hill path' && l.auto === false));
});

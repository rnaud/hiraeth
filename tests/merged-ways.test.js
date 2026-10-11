// The merged worlds' follow-ups (October 2026): the crossings between Vael's plain and the sky stones and between Lorn's
// swamp and the Deep Wood, and the Glass Dunes' ways (src/vael-crossing.js, src/lorn-crossing.js, src/glass-dunes-ways.js;
// docs/systems/worlds.md "The merged worlds' crossings").
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { Player } = await import('../src/player.js');
const { SKY_STONES } = await import('../src/levels/arzach2.js');
const { GATE, RIDERS_LANTERNS } = await import('../src/vael-crossing.js');
const { KEEPERS_LIGHT } = await import('../src/lorn-crossing.js');
const { FLOAT_POSTS } = await import('../src/glass-dunes-ways.js');
const { game } = await import('../src/game-state.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
/** The traveller walks from `from` toward `to` (as tests/level-design-round5.test.js pitch does) until he stands at `to.y`. */
function pitch(physics, from, to, { seconds = 20 } = {}) {
  const P = new Player(physics, { health: false });
  P.pos.copy(from); P.onGround = true;
  let ok = false;
  for (let i = 0; i < 60 * seconds && !ok; i++) {
    const yaw = Math.atan2(to.x - P.pos.x, to.z - P.pos.z);
    P.heading = yaw;
    quiet(() => P.update(1 / 60, { KeyW: true }, yaw + Math.PI));
    ok = P.onGround && !P.climbing && !P.mantle && Math.abs(P.pos.y - to.y) < 0.3;
  }
  return { ok, y: P.pos.y };
}
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const line = (L, name) => (typeof L.lines === 'function' ? L.lines() : L.lines).find((l) => l.name === name);
const offLine = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz))); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); };

test('Vael: the sky stones’ first plateaus are reached on foot from the plain (the long aqueduct, then the short one); the rose cliff and the island are the bird’s', () => {
  globalThis.location = { search: '?level=arzach' };
  const W = A.loadWorld('arzach');
  try {
    const from = W.level.spawn.clone();
    for (const id of ['ondine', 'aube']) {
      const r = A.walkTo(W, from, W.quests.resolve(id), { cell: 3, max: 200000 });
      assert.ok(r.ok, `${id}: not reached on foot from the landing (${r.closest.toFixed(0)} m short)`);
    }
    // (the monastery's rose cliff and the floating island stand out of the cloud on their own: the bell's quest is flown)
    const m = A.walkTo(W, from, W.quests.resolve('monastery'), { cell: 4, max: 60000 });
    assert.ok(!m.ok, 'the monastery is not a walk from the plain');
  } finally { W.dispose(); }
});

test('Vael: the riders’ gate stands on the plain at its edge, the riders’ lanterns lead home to it from the rose cliff, and both light when the bell rings', () => {
  globalThis.location = { search: '?level=arzach' };
  const W = A.loadWorld('arzach');
  try {
    const { gate, riders } = W.level.arzach2, edge = SKY_STONES.plainEdge(GATE.x);
    assert.ok(gate.at.z < edge - 20 && gate.at.z > edge - 45, `the gate ${gate.at.z.toFixed(0)} m, the edge ${edge.toFixed(0)}`);
    assert.ok(Math.abs(W.physics.groundAt(gate.at.x, gate.at.y + 3, gate.at.z, 8) - gate.at.y) < 1.5, 'the gate stands on the ground');
    const L = line(W.level, 'the riders’ lanterns').points;
    assert.ok(flat(V(...L.at(-1)), gate.at) < 5, 'the lanterns end at the gate');
    assert.ok(flat(V(...L[0]), W.level.arzach2.monastery) < 100, 'and start off the rose cliff');
    assert.equal(RIDERS_LANTERNS.length, 9);
    // dark, then lit with the monks' own lanterns once the bell has rung (src/story/arzach2.js)
    W.step(2);
    assert.ok(!riders.isLit() && !gate.isLit(), 'dark while the bell is silent');
    game.set('arzach2.bell.rung', true);
    W.step(2);
    assert.ok(riders.isLit() && gate.isLit(), 'lit once it has rung');
    assert.equal(line(W.level, 'the old rope way').points.length, 5, 'the rope way: two posts and three knots');
  } finally { game.set('arzach2.bell.rung', undefined); W.dispose(); }
});

test('Lorn: the keepers’ light stands on the way from the crystal cave to Hollin, and the water-way runs home to the ship', () => {
  globalThis.location = { search: '?level=perdide' };
  const W = A.loadWorld('perdide');
  try {
    const heart = W.quests.resolve('heart'), hollin = W.quests.resolve('hollin');
    assert.ok(offLine(V(KEEPERS_LIGHT.x, 0, KEEPERS_LIGHT.z), heart, hollin) < 25, 'the light on the crossing');
    const way = line(W.level, 'the water-way').points;
    assert.ok(flat(V(...way.at(-1)), W.level.spawn) < 200, `the water-way ends ${flat(V(...way.at(-1)), W.level.spawn).toFixed(0)} m from the ship`);
    assert.ok(flat(V(...way[0]), W.quests.resolve('hollinEnd')) < 90, 'and starts by the root cave');
    // the lamps south light with the rest of the water-way
    const { south } = W.level.crossing;
    assert.equal(typeof south.lit, 'function');
  } finally { W.dispose(); }
});

test('the Glass Dunes: the float-posts lead from the Clock-House’s door to the landing flat, and the wave’s cairn is walked up to', () => {
  globalThis.location = { search: '?level=glassdunes' };
  const W = A.loadWorld('glassdunes');
  try {
    const door = W.level.temples?.find((t) => t.id === 'garage')?.outside?.door?.at ?? W.level.temple.outside.door.at;
    const posts = line(W.level, 'the float-posts').points;
    assert.equal(posts.length, FLOAT_POSTS.length);
    assert.ok(flat(V(...posts[0]), door) < 25, 'from beside the door');
    assert.ok(flat(V(...posts.at(-1)), W.level.spawn) < 40, 'to the landing flat');
    const cairn = W.level.sights.find((s) => /cairn/.test(s.name)).at;
    assert.ok(cairn.y > 30, `the cairn ${cairn.y.toFixed(0)} m up`);
    const g = W.physics.groundAt(-30, 300, 0, 600);
    const r = pitch(W.physics, V(-30, g, 0), cairn.clone().setY(cairn.y - 0.5), { seconds: 40 });
    assert.ok(r.ok, `up the wave's back on foot to the cairn (reached ${r.y.toFixed(1)} m)`);
  } finally { W.dispose(); }
});

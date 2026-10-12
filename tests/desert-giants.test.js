// The giants' road (issue #167; src/desert-giants.js, src/story/desert-giants.js): four fallen giants down the old
// river's dry wash, between the straight ride out to the Hearth and the marked stones home, at mid-distance from both;
// a shrine at each, its verse read outward from Qanat; the arm across the wash, ridden up from its shoulder.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadWorld } from './playthrough-agent.js';
import { allInteractables } from '../src/interact.js';
import { Hoverbike } from '../src/bike.js';
import { game } from '../src/game-state.js';
import { DialogueRunner } from '../src/story/dialogue.js';
import { STORY, DRY_WASH, hearthStones } from '../src/desert-sites.js';
import { WASH } from '../src/desert-landmarks.js';
import { cutDepth } from '../src/desert-ground.js';
import { VERSES } from '../src/story/desert-giants.js';

const W = loadWorld('desert');
const { level, physics, rt } = W;
const R = level.giants, G = R.giants;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** The shortest way from p to a polyline of [x, z]. */
const toLine = (p, pts) => {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(ax + dx * t - p.x, az + dz * t - p.z));
  }
  return best;
};
const RIDE = [[STORY.bike.x, STORY.bike.z], [STORY.hearth.x, STORY.hearth.z]];
const STONES = [[STORY.city.x, STORY.city.z], ...hearthStones()];

test('four giants lie out between the ride out and the stones home, at mid-distance from both', () => {
  for (const id of ['hand', 'arm', 'spine', 'jaw']) {
    const g = G[id], r = toLine(g.at, RIDE), s = toLine(g.at, STONES);
    assert.ok(r > 30 && r < 150, `the ${id} ${r.toFixed(0)} m off the ride out`);
    assert.ok(s > 30 && s < 150, `the ${id} ${s.toFixed(0)} m off the marked stones`);
    assert.ok(g.mesh.geometry.attributes.position.count / 3 < 6000, `the ${id} is modest (${g.mesh.geometry.attributes.position.count / 3} triangles)`);
  }
  // the level design audit reads them as sights
  const names = level.sights().map((s) => s.name);
  for (const n of ['the giant’s hand', 'the giant’s arm over the dry wash', 'the giant’s spine', 'the giant’s jaw']) assert.ok(names.includes(n), n);
  // the hand stands tall enough to be seen over the dunes from the ship
  assert.ok(G.hand.top.y - G.hand.at.y > 30, `the hand ${(G.hand.top.y - G.hand.at.y).toFixed(0)} m tall`);
});

test('the dry wash is cut into the dunes, its lips smooth enough for the bike', () => {
  for (let a = 80; a < WASH.length - 80; a += 40) {
    const u = a / WASH.length, c = WASH.curve.getPointAt(u), t = WASH.curve.getTangentAt(u), n = V(-t.z, 0, t.x);
    const h = (s) => level.ground.heightAt(c.x + n.x * s, c.z + n.z * s);
    const bed = h(0);
    assert.ok(Math.max(h(-40), h(40)) - bed > 3, `${a} m along: the banks stand over the bed (${(Math.max(h(-40), h(40)) - bed).toFixed(1)} m)`);
    for (let s = -60; s <= 60; s += 2) {
      const k = -(h(s + 6) - 2 * h(s) + h(s - 6)) / 36;
      assert.ok(k < 0.035, `${a} m along, ${s} m across: a lip too sharp (${k.toFixed(3)})`);
    }
  }
  // the bank's own bend, under the dunes' (tests/dunes.test.js)
  const o = DRY_WASH, conv = 2 * o.depth / (o.bank * o.bank);
  assert.ok(conv < 0.016, `the lip bends ${conv.toFixed(4)}`);
  assert.ok(Math.abs(cutDepth(o.bed + o.bank, o)) < 1e-9 && cutDepth(o.bed, o) === o.depth);
});

test('the arm bridges the wash: ridden up from its shoulder, the bike crosses high over the bed', () => {
  const A = G.arm, d = A.across;
  assert.ok(A.at.y - A.bed.y > 5.5, `its top ${(A.at.y - A.bed.y).toFixed(1)} m over the bed`);
  // solid as drawn: the ground over the bed is the arm's top
  const g = physics.groundAt(A.at.x, A.at.y + 5, A.at.z, 20);
  assert.ok(Math.abs(g - A.at.y) < 0.8, `the arm collides where it is drawn (${g.toFixed(1)} vs ${A.at.y.toFixed(1)})`);
  const bike = new Hoverbike(physics), start = A.shoulder.clone().addScaledVector(d, -22);
  bike.place(start.x, start.z, Math.atan2(d.x, d.z));
  let over = null;
  for (let i = 0; i < 60 * 8 && over == null; i++) {
    bike.update(1 / 60, { KeyW: true });
    if (bike.pos.clone().sub(A.bed).dot(d) > 0) over = bike.pos.y - A.bed.y;
  }
  assert.ok(over > 5.5, `the bike crosses ${over?.toFixed(1)} m over the bed`);
});

test('a shrine at each giant, its verse read outward from Qanat; the last points on to the swamp of lights', () => {
  assert.equal(R.shrines.length, 4);
  const city = V(STORY.city.x, 0, STORY.city.z);
  for (let i = 1; i < 4; i++) assert.ok(flat(R.shrines[i].at, city) > flat(R.shrines[i - 1].at, city), `verse ${i + 1} farther out than verse ${i}`);
  R.shrines.forEach((s, i) => assert.equal(s.n, i + 1));
  const reads = allInteractables().filter((e) => /^giants\.verse/.test(e.id));
  assert.equal(reads.length, 4);
  for (const e of reads) assert.equal(e.prompt, 'read the verse');
  // the arm's shrine stands on its elbow, a raised place
  assert.ok(R.shrines[1].at.y - A0().bed.y > 5, 'the second verse is up on the arm');
  // read them in order: each a look and a verse; the fourth sets the Speaker's clue
  for (const [i, def] of VERSES.entries()) {
    const r = new DialogueRunner(def, { game, quests: rt.quests });
    while (!r.ended && r.advance());
    assert.ok(game.flag(`desert.giants.verse${i + 1}`), `verse ${i + 1} read`);
  }
  assert.ok(game.flag('clue.desert.perdide'), 'the last verse points toward the swamp of lights');
});
const A0 = () => G.arm;

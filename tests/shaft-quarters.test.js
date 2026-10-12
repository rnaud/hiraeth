// The City-Shaft's quarters (issue #169: src/shaft-quarters.js): the ring cut into four you tell apart, the hanging
// gardens, the cab-wrights' cliff, the bell quarter and the balcony market, each with props of its own in colours of
// its own, each reached on foot from its terraces (the market's balconies walked out onto through gaps in the railing),
// each named as you walk into it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createIncal } from '../src/levels/incal.js';
import { Physics } from '../src/physics.js';
import { QUARTERS, quarterAt, inQuarter, balconySpots, balconyGap } from '../src/shaft-quarters.js';
import { dropLandings } from '../src/shaft-ways.js';

const quiet = (f) => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return f(); } finally { console.warn = w; console.log = l; } };
const scene = new THREE.Scene(), level = quiet(() => createIncal(scene));
const physics = new Physics(scene, null);
level.init(physics);
const S = level.shaft, Q = S.quarters, TAU = Math.PI * 2, V = (x, y, z) => new THREE.Vector3(x, y, z);
const ground = (p) => physics.groundAt(p.x, p.y + 1.5, p.z, 4);
/** The colours a quarter is drawn in (its meshes' materials), and what it holds. */
const drawn = (id) => {
  const q = QUARTERS.find((x) => x.id === id), colours = new Set(), meshes = [];
  Q.root.traverse((o) => { if (o.isMesh && o.parent?.name?.startsWith(q.name)) { meshes.push(o); colours.add('#' + o.material.uniforms.uColor.value.getHexString()); } });
  return { colours, meshes };
};

test('four quarters go round the ring once, none over another', () => {
  for (let a = 0; a < TAU; a += 0.01) assert.equal(QUARTERS.filter((q) => inQuarter(q, a)).length, 1, `one quarter at ${a.toFixed(2)} rad`);
  assert.deepEqual(QUARTERS.map((q) => q.id), ['gardens', 'cabs', 'bells', 'market']);
});

test('each quarter is its own: props of its own kind in colours of its own', () => {
  const d = Object.fromEntries(QUARTERS.map((q) => [q.id, drawn(q.id)]));
  for (const q of QUARTERS) assert.ok(d[q.id].meshes.length >= 8, `${q.name}: drawn on its terraces (${d[q.id].meshes.length} meshes)`);
  // the colour each is known by, found in it and in no other
  const own = { gardens: '#5f8a3e', cabs: '#2a2f4a', bells: '#b8403a', market: '#c98a5a' };
  for (const [id, c] of Object.entries(own)) {
    assert.ok(d[id].colours.has(c), `${id} has its ${c}`);
    for (const other of QUARTERS.filter((q) => q.id !== id)) assert.ok(!d[other.id].colours.has(c), `${c} is ${id}’s, not ${other.id}’s`);
  }
  // their silhouettes: the bells hang in the bell quarter only; the balconies in the market only
  assert.ok(Q.bells.length >= 40, `${Q.bells.length} bells`);
  for (const b of Q.bells) assert.equal(quarterAt(b.a).id, 'bells');
  assert.ok(Q.balconies.length >= 30, `${Q.balconies.length} balconies`);
  for (const b of Q.balconies) assert.equal(quarterAt(b.a).id, 'market');
  // every quarter's colours as a whole differ from every other's
  for (const a of QUARTERS) for (const b of QUARTERS) if (a !== b) assert.ok([...d[a.id].colours].some((c) => !d[b.id].colours.has(c)), `${a.id} vs ${b.id}`);
});

test('each quarter is reached: the walk passes through it or lands by it, and its sight stands on walkable ground', () => {
  const landings = dropLandings(S.terraces);
  const by = Object.fromEntries(QUARTERS.map((q) => [q.id, landings.filter((L) => inQuarter(q, L.a)).length]));
  assert.ok(by.gardens >= 2 && by.cabs >= 2 && by.bells >= 1, `the lamplighters’ drops land in the gardens, the cliff and the bells (${JSON.stringify(by)})`);
  assert.ok(inQuarter(QUARTERS.find((q) => q.id === 'bells'), Math.atan2(S.places.shrine.z, S.places.shrine.x)), 'the Upward Shrine is in the bell quarter');
  assert.equal(Q.sights.length, 4, 'a sight for each');
  for (const s of Q.sights) {
    const g = ground(s.at);
    assert.ok(Number.isFinite(g) && Math.abs(g - s.at.y) < 0.6, `${s.name}: on the ground (${g} vs ${s.at.y})`);
    assert.equal(quarterAt(Math.atan2(s.at.z, s.at.x)).id, s.quarter, `${s.name} is in its quarter`);
  }
  // the market's high balconies under the rim by the ship: what the cab ride home flies over (src/shaft-ways.js CAB_RANK)
  const high = Q.balconies.filter((b) => b.y === S.LEVELS[0] && Math.abs(Math.atan2(Math.sin(b.a), Math.cos(b.a))) < 0.5);
  assert.ok(high.length >= 2, 'balconies on the high terrace under the cab rank');
});

test('a balcony is walked out onto from the promenade: a gap in the railing, ground out to its rail', () => {
  let checked = 0;
  for (const b of Q.balconies) {
    const t = S.terraces.find((s) => s.y === b.y && balconySpots(s).some((x) => Math.abs(x.a - b.a) < 1e-6));
    assert.ok(t, 'a spot of its sector');
    assert.ok(balconyGap(b.r0) > 0);
    const out = V(-Math.cos(b.a), 0, -Math.sin(b.a)), from = V(Math.cos(b.a) * (b.r0 + 2.5), b.y, Math.sin(b.a) * (b.r0 + 2.5));
    for (let d = 0; d <= 5; d += 0.5) {   // (out to the counter on the deck)
      const p = from.clone().addScaledVector(out, d), g = ground(p);
      assert.ok(Number.isFinite(g) && Math.abs(g - b.y) < 0.45, `balcony at ${b.y} m, ${b.a.toFixed(2)} rad: ground ${d} m out (${g})`);
    }
    const eye = from.clone().setY(b.y + 0.7);
    assert.ok(physics.rayDistance(eye, out, 4.5) >= 4.4, `balcony at ${b.y} m, ${b.a.toFixed(2)} rad: no railing across its way in`);
    checked++;
  }
  assert.ok(checked >= 30);
});

test('walking round, the place name says the quarter you are in; the bells give a sound to walk toward', () => {
  const names = new Set();
  for (const q of QUARTERS) {
    const a = (q.a0 + q.a1) / 2, p = V(Math.cos(a) * 220, -24, Math.sin(a) * 220);
    const n = level.atmo(p.x, p.z, p.y).name;
    assert.equal(n, q.name);
    names.add(n);
  }
  assert.equal(names.size, 4);
  assert.equal(level.atmo(300, 0, 200).name, 'The rim');
  const near = Q.nearestBell(S.places.shrine);
  assert.ok(near && near.at.distanceTo(S.places.shrine) < 120, 'a bell near the shrine');
});

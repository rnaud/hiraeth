// The traveller's overshirt made cheap (docs/systems/performance.md, "The traveller's shirt"): the cage on flat
// arrays (and in a worker), the garment cut down to its own vertices, its normals on the arrays. Each against
// the plain three.js steps it replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { simulate, pushOut, setCap, CAP, CLOTH_STEP, CLOTH_ITERATIONS, clothWorkerHandler } from '../src/characters/tripo-cloth-sim.js';
import { projectOutward, vertexNormals, compactGeometry } from '../src/characters/tripo-cloth.js';

let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** a small hanging cage: a 9 x 7 grid, the top row held, with the shirt's own kinds of edges, two leg capsules */
function cage() {
  const COLS = 8, ROWS = 6, id = (r, c) => r * (COLS + 1) + c, rest = [], pins = [], edges = [];
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) {
    const a = 0.4 + c / COLS * 5.5;
    rest.push(new T.Vector3(Math.sin(a) * 0.18, 1.2 - r * 0.08, Math.cos(a) * 0.14 - 0.016)); pins.push(r === 0 ? 0 : 1);
  }
  const add = (a, b, k) => edges.push([a, b, rest[a].distanceTo(rest[b]), k]);
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) {
    if (c < COLS) add(id(r, c), id(r, c + 1), 1);
    if (r < ROWS) add(id(r, c), id(r + 1, c), 1);
    if (r < ROWS && c < COLS) { add(id(r, c), id(r + 1, c + 1), 0.7); add(id(r, c + 1), id(r + 1, c), 0.7); }
    if (r + 2 <= ROWS) add(id(r, c), id(r + 2, c), 0.7);
  }
  const caps = [[new T.Vector3(0.07, 0.95, -0.01), new T.Vector3(0.09, 0.5, -0.01), 0.103], [new T.Vector3(-0.07, 0.95, -0.01), new T.Vector3(-0.09, 0.5, 0.02), 0.103]];
  return { rest, pins, edges, caps };
}

/** the cage's steps as they were written on vectors (src/characters/tripo-cloth.js before the arrays) */
function reference({ rest, pins, edges, caps }, positions, previous, target, steps) {
  const current = new T.Vector3(), delta = new T.Vector3(), step = CLOTH_STEP;
  for (let n = 0; n < steps; n++) {
    for (let i = 0; i < positions.length; i++) {
      if (!pins[i]) { positions[i].copy(target[i]); previous[i].copy(target[i]); continue; }
      current.copy(positions[i]); delta.subVectors(positions[i], previous[i]).multiplyScalar(0.90);
      positions[i].add(delta); positions[i].y -= 1.5 * step * step;
      positions[i].lerp(target[i], 0.02); previous[i].copy(current);
    }
    for (let iteration = 0; iteration < CLOTH_ITERATIONS; iteration++) {
      for (const [a, b, length, k] of edges) { delta.subVectors(positions[b], positions[a]); const d = delta.length(), w = pins[a] + pins[b]; if (d < 1e-8 || !w) continue; delta.multiplyScalar((d - length) / d * k / w); if (pins[a]) positions[a].addScaledVector(delta, pins[a]); if (pins[b]) positions[b].addScaledVector(delta, -pins[b]); }
      for (let i = 0; i < positions.length; i++) {
        if (!pins[i]) { positions[i].copy(target[i]); continue; }
        const outward = new T.Vector3(rest[i].x, 0, rest[i].z + 0.016).normalize();
        for (const [from, to, r] of caps) projectOutward(positions[i], from, to, r + 0.012, outward);
        const inward = delta.subVectors(positions[i], target[i]).dot(outward); if (inward < -0.02) positions[i].addScaledVector(outward, -0.02 - inward);
      }
    }
  }
}

const flat = (vs) => Float64Array.from(vs.flatMap((v) => [v.x, v.y, v.z]));
function arrays(c) {
  const N = c.rest.length, outwards = new Float64Array(N * 3);
  c.rest.forEach((p, i) => { const o = new T.Vector3(p.x, 0, p.z + 0.016).normalize(); outwards.set([o.x, o.y, o.z], i * 3); });
  const caps = new Float64Array(c.caps.length * CAP);
  c.caps.forEach(([from, to, r], k) => setCap(caps, k, from, to, r + 0.012));
  return { constants: { pins: Float64Array.from(c.pins), outwards, edgeA: Int32Array.from(c.edges, (e) => e[0]), edgeB: Int32Array.from(c.edges, (e) => e[1]), edgeLength: Float64Array.from(c.edges, (e) => e[2]), edgeK: Float64Array.from(c.edges, (e) => e[3]) }, caps };
}
/** targets swinging like a walking body's, frame by frame */
const targetsAt = (c, f) => c.rest.map((p, i) => p.clone().add(new T.Vector3(Math.sin(f * 0.21 + i * 0.1) * 0.03, 0, Math.cos(f * 0.17) * 0.04 * (1 - p.y))));

test('the cage on flat arrays takes exactly the steps it took on vectors', () => {
  const c = cage(), { constants, caps } = arrays(c), N = c.rest.length;
  const positions = c.rest.map((p) => p.clone()), previous = c.rest.map((p) => p.clone());
  const s = { ...constants, P: flat(c.rest), Q: flat(c.rest) };
  let moved = 0;
  for (let f = 0; f < 120; f++) {
    const target = targetsAt(c, f), steps = 1 + (f % 3);
    reference(c, positions, previous, target, steps);
    simulate(s, flat(target), caps, steps);
    for (let i = 0; i < N; i++) {
      assert.equal(s.P[i * 3], positions[i].x); assert.equal(s.P[i * 3 + 1], positions[i].y); assert.equal(s.P[i * 3 + 2], positions[i].z);
      assert.equal(s.Q[i * 3 + 1], previous[i].y);
    }
    moved = Math.max(moved, positions.reduce((m, p, i) => Math.max(m, p.distanceTo(target[i])), 0));
  }
  assert.ok(moved > 0.01, `the cloth really moved off its targets (${moved})`);
});

test('a capsule\'s box only skips points the full test would have left alone', () => {
  const caps = new Float64Array(CAP), from = new T.Vector3(0.07, 0.95, 0), to = new T.Vector3(0.1, 0.5, 0.03);
  setCap(caps, 0, from, to, 0.115);
  let inside = 0;
  for (let n = 0; n < 4000; n++) {
    const p = new T.Vector3(rand() * 0.6 - 0.3, 0.3 + rand() * 0.9, rand() * 0.6 - 0.3), o = new T.Vector3(p.x, 0, p.z + 0.016).normalize();
    const want = projectOutward(p.clone(), from, to, 0.115, o), got = pushOut(p.x, p.y, p.z, o.x, o.y, o.z, caps, 0);
    assert.equal(got, want);
    if (want) inside++;
  }
  assert.ok(inside > 100, 'some points were inside');
});

test('the worker\'s side answers what the cage on this thread would', () => {
  const c = cage(), { constants, caps } = arrays(c);
  const handle = clothWorkerHandler();
  assert.equal(handle({ type: 'init', constants }), null);
  const s = { ...constants, P: flat(c.rest), Q: flat(c.rest) };
  for (let f = 0; f < 30; f++) {
    const G = flat(targetsAt(c, f));
    const r = handle({ type: 'step', id: f + 1, G: G.slice(), caps, steps: 2, reset: f === 0 ? flat(c.rest) : null });
    simulate(s, G, caps, 2);
    assert.equal(r.id, f + 1);
    assert.deepEqual(Array.from(r.P), Array.from(s.P));
    assert.deepEqual(Array.from(r.G), Array.from(G), 'the targets it simulated against come back with it');
  }
});

test('the shirt\'s normals on the arrays are three.js\'s own', () => {
  const g = new T.SphereGeometry(1, 23, 17);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + rand() * 0.2), p.getY(i), p.getZ(i) * 0.7);
  const want = g.clone(); want.computeVertexNormals();
  vertexNormals(g);
  assert.deepEqual(Array.from(g.attributes.normal.array), Array.from(want.attributes.normal.array));
});

test('the garment keeps only the vertices its triangles use, and the same triangles', () => {
  const g = new T.BufferGeometry(), n = 60;
  g.setAttribute('position', new T.Float32BufferAttribute(Array.from({ length: n * 3 }, () => rand()), 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(Array.from({ length: n * 2 }, () => rand()), 2));
  g.setAttribute('skinWeight', new T.Float32BufferAttribute(new Array(n * 4).fill(0.25), 4));
  const index = Array.from({ length: 45 }, () => 10 + Math.floor(rand() * 30));
  g.setIndex(index);
  const used = [...new Set(index)], c = compactGeometry(g, used, ['skinWeight']);
  assert.equal(c.attributes.position.count, used.length);
  assert.equal(c.attributes.skinWeight, undefined);
  assert.equal(new Set(c.index.array).size, used.length, 'every vertex kept is used');
  for (let k = 0; k < index.length; k++) {
    const a = index[k], b = c.index.getX(k);
    assert.deepEqual([c.attributes.position.getX(b), c.attributes.position.getY(b), c.attributes.position.getZ(b)], [g.attributes.position.getX(a), g.attributes.position.getY(a), g.attributes.position.getZ(a)]);
    assert.equal(c.attributes.uv.getY(b), g.attributes.uv.getY(a));
  }
});

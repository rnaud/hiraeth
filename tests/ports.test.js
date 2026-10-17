// The cities' space ports (issue #441, after the #397 stand-in; src/levels/ports.js, src/levels/port-pad.js,
// docs/systems/worlds.md "Space ports"): each port is data round its city's landing, which does not move; nothing of it
// stands on the hull's plan or its ramp; it costs a handful of merged meshes; its craft fly; its staff speak in tones.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PORTS, portAt } from '../src/levels/ports.js';
import { buildPort, hullFrame, PAD_LIFT } from '../src/levels/port-pad.js';
import { levelById } from '../src/levels/index.js';
import { HALF_W, NOSE_Z, STERN_Z, HINGE_R } from '../src/ship/hull.js';
import { SITE_OVERRIDES } from '../src/ship/sites.js';
import { TONES } from '../src/story/tone.js';

const IDS = ['spacecity', 'incal', 'bazaar', 'underwater', 'glassdunes', 'eclipse', 'saltharbour', 'waterfall', 'buried'];
/** The hull's plan (a metre round it) and the ramp's way out of the hatch, in the hull's frame. */
const onHull = (u, v, pad = 1) => Math.abs(u) < HALF_W + pad && v > NOSE_Z - pad && v < STERN_Z + pad;
const onRamp = (u, v) => u > HINGE_R - 1 && u < 28 && Math.abs(v) < 5;

test('every city of the brief has its port, each from its picked sheet', () => {
  assert.deepEqual(Object.keys(PORTS).sort(), [...IDS].sort());
  for (const [id, P] of Object.entries(PORTS)) {
    assert.equal(P.id, id);
    assert.ok(P.pieces.length >= 3, `${id}: a port, not a pad alone`);
  }
});

test('nothing of a port but its pad stands on the hull’s plan or on the ramp’s way out', () => {
  for (const [id, P] of Object.entries(PORTS)) {
    const F = hullFrame(P.site);
    for (const p of P.pieces) {
      const [u, v] = p.xz ? F.uv(...p.xz) : p.at;
      assert.ok(!onHull(u, v), `${id} ${p.kind} at (${u.toFixed(1)}, ${v.toFixed(1)}): on the hull's plan`);
      assert.ok(!onRamp(u, v), `${id} ${p.kind} at (${u.toFixed(1)}, ${v.toFixed(1)}): on the ramp's way`);
    }
    for (const s of P.staff ?? []) {
      const [u, v] = F.uv(s.at[0], s.at[1]);
      assert.ok(!onHull(u, v, 2) && !onRamp(u, v), `${id}: ${s.name} clear of the hull and the ramp`);
    }
  }
});

test('a port is a handful of merged meshes; only what is marked solid stops you; its craft fly their loops', () => {
  for (const [id, P] of Object.entries(PORTS)) {
    const port = buildPort(P);
    const statics = port.group.children.filter((o) => o.isMesh);
    assert.ok(statics.length <= 6, `${id}: ${statics.length} meshes`);
    for (const m of statics) {
      const solid = !m.userData.noCollide;
      if (solid) assert.ok(P.pieces.some((p) => p.solid), `${id}: a solid mesh only from solid pieces`);
      if (/glow|mark|cable/.test(m.name)) assert.ok(!solid, `${id} ${m.name}: walked through`);
    }
    // the solid meshes keep off the hull's plan (a metre round it) and the ramp's way
    const F = hullFrame(P.site);
    for (const m of statics.filter((o) => !o.userData.noCollide)) {
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        const [u, v] = F.uv(pos.getX(i), pos.getZ(i));
        assert.ok(!onHull(u, v) && !onRamp(u, v), `${id}: a solid vertex at (${u.toFixed(1)}, ${v.toFixed(1)})`);
      }
    }
    assert.equal(port.craft.length, (P.traffic ?? []).length);
    const start = port.craft.map((c) => c.position.clone());
    for (let i = 0; i < 60; i++) port.update(1 / 30);
    port.craft.forEach((c, i) => {
      const T = P.traffic[i], moved = c.position.distanceTo(start[i]);
      assert.ok(moved > (T.speed ?? 12) * 2 * (Math.min(T.rx, T.rz) / Math.max(T.rx, T.rz)) * 0.9 && moved < (T.speed ?? 12) * 2.1,   // (an ellipse: slower along its short way)
         `${id} craft ${i} moved ${moved.toFixed(1)} m in 2 s`);
      assert.ok(Math.abs(c.position.y - (T.centre[1] + T.h)) < 1, `${id} craft ${i} at its height`);
      assert.ok(c.children.length <= 1, `${id} craft ${i}: one mesh in flight`);
    });
  }
  assert.ok(PAD_LIFT > 0.02 && PAD_LIFT < 0.1, 'the paint just over the deck');
});

test('the staff: a name of their own, two toned lines each, standing in the hull’s frame where the data says', () => {
  const tones = new Set(TONES);
  for (const [id, P] of Object.entries(PORTS)) for (const s of P.staff ?? []) {
    assert.ok(s.id && s.name && s.at?.length === 2, `${id}: ${s.name}`);
    assert.equal(s.lines.length, 2);
    for (const l of s.lines) assert.ok(tones.has(l.match(/^~([a-z]+)~ /)?.[1]), `${id} ${s.name}: "${l}" toned`);
    const [x, z] = portAt(P, hullFrame(P.site).uv(...s.at));
    assert.ok(Math.hypot(x - s.at[0], z - s.at[1]) < 1e-6);
  }
});

test('in each city: the ship lands where it did, on the port’s site; the port is in the scene and the level flies its craft', { timeout: 600000 }, async () => {
  for (const id of IDS) {
    const scene = new THREE.Scene(), warn = console.warn; console.warn = () => {};
    let level; try { level = await levelById(id).create(scene); } finally { console.warn = warn; }
    const site = level.shipSite ?? SITE_OVERRIDES[id], P = PORTS[id];
    assert.ok(Math.abs(site.x - P.site.x) < 0.01 && Math.abs(site.z - P.site.z) < 0.01, `${id}: the pad round the ship's site`);
    assert.ok(Math.abs(Math.atan2(Math.sin(site.heading - P.site.h), Math.cos(site.heading - P.site.h))) < 0.01, `${id}: the hull's frame turned with the ship`);
    const group = scene.getObjectByName(`${id} port`);
    assert.ok(group, `${id}: the port in the scene`);
    if (P.traffic?.length) {
      const flyer = scene.getObjectByName('port traffic 0'), was = flyer.position.clone();
      level.update(0.5, 0.5, {});
      assert.ok(flyer.position.distanceTo(was) > 1, `${id}: the level moves its craft`);
    }
  }
});

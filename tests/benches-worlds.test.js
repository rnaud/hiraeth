// The benches in their worlds (issue #363, src/benches-data.js; docs/systems/worlds.md "Benches"): every world on the
// route and off it has at least one, each on solid, flat, dry ground outdoors, with room round the seat to walk up and
// sit, nothing over it, the camera's seated shot behind it clear of the world, its seat stood on once it is there, and
// away from the races' starts. (Off the route's line: tests/route-worlds.test.js. How sitting works: tests/benches.test.js.)
// Each world built once (tests/built-worlds.js); the benches' colliders are taken out again after each.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { builtWorld, quiet } from './built-worlds.js';

const { ORDER, SIDE, isDiscarded } = await import('../src/levels/names.js');
const { BENCHES } = await import('../src/benches-data.js');
const { createBenches, benchFraming, BENCH } = await import('../src/benches.js');
const { Waters } = await import('../src/water.js');
const { interiorAt } = await import('../src/interior-kit.js');
const { trialsFor } = await import('../src/trials/data.js');
const { kitTrialsFor } = await import('../src/trials/kit-data.js');
const { CAPSULE } = await import('../src/player.js');
const { clearInteractables } = await import('../src/interact.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** The nearest a bench may stand to a race's start (m). */
export const RACE_CLEAR = 30;

test('every world’s benches stand on solid, flat, dry ground outdoors, clear round and over the seat, their shot clear, their seat stood on', () => {
  const bad = [];
  for (const id of [...ORDER, ...SIDE].filter((w) => !isDiscarded(w))) {   // (not the discarded worlds: names.js DISCARDED)
    globalThis.location = { search: `?level=${id}` };
    const { scene, level, physics } = builtWorld(id);
    const waters = quiet(() => new Waters(scene, { physics, drops: false }));
    const races = [...trialsFor(id).map((T) => T.marker), ...kitTrialsFor(id).map((T) => T.origin)].map((m) => [m[0], m[m.length - 1]]);
    const defs = BENCHES[id];
    assert.ok(defs?.length, `${id}: a bench`);
    // the ground as it is before the benches are there
    const pre = defs.map((d) => {
      const [x, y, z] = d.at, f = V(Math.sin(d.face), 0, Math.cos(d.face)), r = V(f.z, 0, -f.x), say = (m) => bad.push(`${id} “${d.name}”: ${m}`);
      const g = physics.groundAt(x, y + 1.5, z, 4);
      if (!(Math.abs(g - y) < 0.3)) say(`ground at ${g?.toFixed(2)}, written ${y}`);
      // flat: one surface under the seat and the space in front of it, where you walk up
      for (const a of [-1.1, 0, 1.1]) for (const b of [-0.3, 0.4, 1.1]) {
        const p = V(x, 0, z).addScaledVector(r, a).addScaledVector(f, b), gi = physics.groundAt(p.x, y + 1.5, p.z, 4);
        if (!(Math.abs(gi - y) < 0.25)) say(`not flat (${gi?.toFixed(2)} at ${a}, ${b})`);
      }
      // dry and outdoors
      const w = waters.surfaceAt(x, z, y + 0.3);
      if (w && w.y > y - 0.1) say(`in water (${w.y.toFixed(2)})`);
      if (interiorAt(V(x, y + 1, z))) say('in a room');
      // nothing over it, and room to stand in front of it (the body's capsule pushed by nothing)
      const up = physics.rayDistance(V(x, y + 0.6, z), V(0, 1, 0), 4);
      if (up < 4) say(`something ${up.toFixed(1)} m over the seat`);
      const stand = V(x, y, z).addScaledVector(f, BENCH.depth / 2 + 0.6), push = physics.pushCapsule(stand.clone(), CAPSULE.radius, CAPSULE.step, CAPSULE.height, V());
      if (push && push.length() > 0.02) say(`no room to stand in front of it (pushed ${push.length().toFixed(2)} m)`);
      for (const m of races) if (Math.hypot(m[0] - x, m[1] - z) < RACE_CLEAR) say(`${Math.hypot(m[0] - x, m[1] - z).toFixed(0)} m from a race's start`);
      return { d, f };
    });
    // with the benches built: each seat stood on, its shot behind it clear of the world and over the ground
    clearInteractables();
    const B = createBenches({ levelId: id, scene: null, physics, level, player: null, defs });
    try {
      for (const [i, b] of B.list.entries()) {
        const say = (m) => bad.push(`${id} “${b.def.name}”: ${m}`);
        const top = physics.groundAt(b.pos.x, b.pos.y + 1, b.pos.z, 3);
        if (!(Math.abs(top - b.pos.y) < 0.05)) say(`its seat not stood on (${top?.toFixed(2)} for ${b.pos.y.toFixed(2)})`);
        const shot = benchFraming(b, physics), head = b.pos.clone().add(V(0, 0.85, 0)), to = shot.eye.clone().sub(head), L = to.length();
        if (physics.rayDistance(head, to.normalize(), L) < L - 0.05) say('something between him and the camera');
        const g = level.ground?.heightAt?.(shot.eye.x, shot.eye.z);
        if (Number.isFinite(g) && shot.eye.y < g + 0.5) say('the camera in the ground');
        const back = -shot.eye.clone().sub(b.pos).dot(pre[i].f);
        if (back < 2.5) say(`the camera only ${back.toFixed(1)} m behind the seat`);
        // the view itself is open: the sight line out the way it faces goes 25 m or more (a bench looking through glass meets its pane)
        const eye = b.pos.clone().add(V(0, 1.4, 0)), far = physics.rayDistance(eye, pre[i].f, 25);
        if (far < 25 && !b.def.glass) say(`the view blocked ${far.toFixed(0)} m out`);
      }
    } finally { B.dispose(); }
  }
  assert.deepEqual(bad, []);
});

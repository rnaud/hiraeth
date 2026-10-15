// The load's shader warm-up one program at a time on ANGLE over OpenGL (src/warm-shaders.js oneAtATime; issue #52:
// the Steam Deck's loading pen stopped 0.1-1.1 s while the GPU process built a dozen big programs asked for at once).
import test from 'node:test';
import assert from 'node:assert/strict';
import { warmShadersSliced, oneAtATime } from '../src/warm-shaders.js';

test('one program at a time on ANGLE over OpenGL only, and ?serial= sets it', () => {
  assert.equal(oneAtATime('ANGLE (AMD, AMD Custom GPU 0932 (radeonsi vangogh ACO), OpenGL 4.6)'), 300);
  assert.equal(oneAtATime('ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'), 0);
  assert.equal(oneAtATime('ANGLE (Microsoft, Direct3D11 vs_5_0 ps_5_0, D3D11)'), 0);   // (the Xbox: two at a time, in parallel)
  assert.equal(oneAtATime('Adreno (TM) 740'), 0);
  assert.equal(oneAtATime('', ''), 0);
  assert.equal(oneAtATime('ANGLE (Apple, ANGLE Metal Renderer)', '?level=desert&serial=150'), 150);
  assert.equal(oneAtATime('ANGLE (AMD, OpenGL 4.6)', '?serial=0'), 0);
});

/** a renderer whose every material is a program of its own, linked `linkMs` after it is asked for */
function fakeRenderer(linkMs) {
  const props = new Map(), log = [];
  const r = {
    info: { programs: [] }, log, flushes: 0,
    getRenderTarget: () => null, setRenderTarget() {},
    getContext: () => ({ flush: () => { r.flushes++; } }),
    properties: { get: (m) => { if (!props.has(m)) props.set(m, {}); return props.get(m); } },
    compile(o) {
      const m = o.material, p = r.properties.get(m);
      if (!p.currentProgram) {
        const asked = Date.now();
        // (each asked for while an earlier one is still being built is logged so: the GPU process's backlog)
        log.push(r.info.programs.filter((q) => !q.isReady()).length);
        p.currentProgram = { isReady: () => Date.now() - asked >= linkMs };
        r.info.programs.push(p.currentProgram);
      }
      return new Set([m]);
    },
  };
  return r;
}
const sceneOf = (n) => {
  const kids = Array.from({ length: n }, (_, i) => ({ isMesh: true, material: { id: i }, geometry: { attributes: { position: {} } } }));
  return { traverse: (f) => kids.forEach(f) };
};
const slice = async () => {};

test('off: every program asked for in one go; on: each waited for before the next', async () => {
  const off = fakeRenderer(20);
  assert.equal(await warmShadersSliced(off, sceneOf(6), {}, { slice }), 6);
  assert.deepEqual(off.log, [0, 1, 2, 3, 4, 5], 'without it a slice queues them behind each other');
  const on = fakeRenderer(20);
  const t0 = Date.now();
  assert.equal(await warmShadersSliced(on, sceneOf(6), {}, { slice, one: 300 }), 6);
  assert.deepEqual(on.log, [0, 0, 0, 0, 0, 0], 'one at a time: none asked for while another is being built');
  assert.equal(on.flushes, 6, 'each flushed to the GPU process at once');
  assert.ok(Date.now() - t0 >= 6 * 20 - 5, 'it waited for each');
});

test('a program that never says it is ready holds each step up only for `one` ms', async () => {
  const r = fakeRenderer(1e9);
  const t0 = Date.now();
  await warmShadersSliced(r, sceneOf(3), {}, { slice, one: 30, wait: 0 });
  const ms = Date.now() - t0;
  assert.ok(ms >= 85 && ms < 400, `three capped waits (${ms} ms)`);
});

test('a program already built (a kind sharing it) is not waited for', async () => {
  const r = fakeRenderer(50);
  const shared = { id: 'shared' };
  const kids = Array.from({ length: 5 }, () => ({ isMesh: true, material: shared, geometry: { attributes: { position: {} }, morphAttributes: {} }, isInstancedMesh: false }));
  // (five meshes of one kind: one representative; then a second kind on the same material)
  kids[4].isInstancedMesh = true;
  const t0 = Date.now();
  assert.equal(await warmShadersSliced(r, { traverse: (f) => kids.forEach(f) }, {}, { slice, one: 300 }), 2);
  assert.equal(r.info.programs.length, 1);
  assert.ok(Date.now() - t0 < 50 + 40, 'only the one new program waited for');
});

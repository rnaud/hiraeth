// The shipped court, its south-rim spawn, Keeper collision and button edges.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import cistern, { stoneAt, stoneUnder } from '../src/minigames/cistern.js';
import { SceneMirror } from '../engine/mirror.js';
import { botMove } from '../src/minigames/channels.js';

function court(seed, difficulty = 'easy', helper = true) {
  const scene = new THREE.Scene(), gen = cistern.build(scene); let step;
  do { step = gen.next(); } while (!step.done);
  const level = step.value, results = [], scores = [], status = [];
  const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), finishFrame() {} };
  const ctx = { scene, level, player, camera: new THREE.PerspectiveCamera(44, 16 / 9, .1, 1000),
    sfx: new Proxy({}, { get: () => () => {} }), sound: null,
    helper: helper ? { seed, temple: 'desert' } : null, option: () => difficulty,
    add: o => { scene.add(o); return o; }, setFov() {}, flash() {}, status: s => status.push(s),
    setScore: s => scores.push(s), finish: r => results.push(r) };
  const session = cistern.start(ctx);
  const tick = (input = {}, dt = 1 / 30, live = true) => session.update(dt, { x: 0, y: 0, ...input }, { live, phase: live ? 'playing' : 'paused' });
  return { session, tick, results, scores, status, player, scene, camera: ctx.camera };
}

for (const fps of [30, 60]) test(`Cistern: walk from the south rim and solve all three plans at ${fps} Hz`, () => {
  const c = court(23, 'hard'); // Even a saved arcade Hard choice cannot impose a story countdown.
  try {
    const start = c.player.pos.clone(); assert.ok(start.z > 19);
    const materials = new Map(), nodes = new Map();
    const mirror = new SceneMirror({ material: (id, _spec, mat) => materials.set(id, mat),
      create: (id, desc, object) => nodes.set(id, { object, material: materials.get(desc.mids[0]), shown: false }),
      visible: (id, shown) => { nodes.get(id).shown = shown; }, destroy: id => nodes.delete(id) });
    const checkPreviewRendering = () => {
      mirror.sync(c.scene, c.camera);
      let shown = 0;
      c.scene.traverse(g => {
        if (!g.userData.connected) return;
        for (const mesh of [g.userData.channels, g.userData.connected]) {
          const native = [...nodes.values()].find(n => n.object === mesh);
          if (mesh.visible) { assert.ok(native?.shown); assert.equal(native.material, mesh.material, 'native renderer binds the visible channel material'); }
          else if (native) assert.equal(native.shown, false, 'inactive channel must not cover the preview');
        }
        if (g.userData.connected.visible) shown++;
      });
      const { B, preview } = c.session.state;
      assert.equal(shown, preview ? preview.connected.filter((v, i) => v && !B.cells[i].fixed).length : 0);
    };
    checkPreviewRendering();
    let frames = 0, turns = 0, valve = false, turnCooldown = 0;
    for (; frames < fps * 1200 && !c.results.length; frames++) {
      const { B, F, me, preview, awaitingRetry } = c.session.state;
      const input = { x: 0, y: 0, tuck: 0 };
      turnCooldown = Math.max(0, turnCooldown - 1 / fps);
      if (F.planning) {
        assert.equal(F.t, 0, 'walking time cannot consume the plan');
        const s = stoneUnder(me.pos.x, me.pos.z) ?? { x: -1, y: -1 };
        const m = botMove(B, F, s.x, s.y);
        if (m.to) {
          const p = stoneAt(...m.to), dx = p.x - me.pos.x, dz = p.z - me.pos.z, d = Math.hypot(dx, dz);
          if (s.x === m.to[0] && s.y === m.to[1] && d < 1) {
            if (!turnCooldown) { input.jumpPressed = true; turns++; turnCooldown = .25; }
          }
          else { input.x = dx / Math.max(d, 1); input.y = -dz / Math.max(d, 1); }
        } else { assert.equal(preview.complete, true); input.tuck = valve ? 0 : 1; }
      } else input.tuck = 1;
      assert.equal(awaitingRetry, false, 'physically walked planned route reaches every trough');
      if (preview?.complete || frames % 300 === 0) checkPreviewRendering();
      valve = input.tuck > .3; c.tick(input, 1 / fps);
    }
    assert.equal(c.results.length, 1); assert.ok(turns > 10);
    assert.equal(c.results[0].failed, false);
    assert.deepEqual(c.results[0].goal, { game: 'cistern', complete: true });
    assert.equal(c.session.state.total.floods.length, 3);
    assert.ok(c.session.state.total.floods.every(f => f.troughs === f.of));
  } finally { c.session.end(); }
});

test('Cistern: a failed release retries the same rotations without points and needs a fresh valve press', () => {
  const c = court(9);
  try {
    // A valve held through pause does not activate when play resumes.
    c.tick({ tuck: 1 }, 1 / 30, false); c.tick({ tuck: 1 });
    assert.equal(c.session.state.F.planning, true);
    c.tick({ tuck: 0 }); c.tick({ tuck: 1 });
    for (let i = 0; i < 18000 && !c.session.state.awaitingRetry; i++) c.tick({ tuck: 1 });
    assert.equal(c.session.state.awaitingRetry, true);
    assert.deepEqual(c.scores, []); assert.equal(c.session.state.total.points, 0);
    const B = c.session.state.B, turns = B.cells.map(x => x.r);
    c.tick({ tuck: 1 }); assert.equal(c.session.state.awaitingRetry, true, 'held button does not retry');
    c.tick({ tuck: 0 }); c.tick({ tuck: 1 });
    assert.equal(c.session.state.B, B); assert.deepEqual(B.cells.map(x => x.r), turns);
    assert.equal(c.session.state.F.planning, true);
    c.tick({ tuck: 1 }); assert.equal(c.session.state.F.planning, true, 'retry press cannot also open valve');
    c.tick({ tuck: 0 }); c.tick({ tuck: 1 }); assert.equal(c.session.state.F.started, true);
  } finally { c.session.end(); }
});

test('Cistern: arcade Hard retains the timed opening', () => {
  const c = court(9, 'hard', false);
  try { assert.equal(c.session.state.F.planning, false); for (let i = 0; i < 300; i++) c.tick(); assert.equal(c.session.state.F.started, true); }
  finally { c.session.end(); }
});

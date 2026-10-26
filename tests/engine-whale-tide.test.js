// #628/#629: through the actual native game host, not a fixture that calls Waters.update itself.
// Start beside the deep valve; all later motion and valve use goes through ordinary game input.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath, removeTemp } from '../scripts/temp-dirs.mjs';
import { TEMPLE_HOME } from '../src/temples/attachment.js';

import { backend, quiet } from './whale-engine-fixtures.js';

// #628: a completed-save exit regression, NOT an earned full-temple walkthrough.
// Completion flags and one initial approach placement are explicit fixtures.
// Thereafter only ordinary look/W input may reach the real portal and Passage.
test('Whale House engine host: staged completed save walks through the final exit and retains completion', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-whale-exit-${process.pid}.js`));
  const privateStore = new Map();
  let g;
  try {
    await bundle('godot', { input: 'tests/fixtures/whale-exit-entry.mjs', out: [file] });
    const B = loadBundle(file, { storage: {
      get: key => privateStore.get(key) ?? null,
      set: (key, value) => privateStore.set(key, String(value)),
      remove: key => privateStore.delete(key),
    } }).exports;
    B.game.set('temple.underwater.boss', 'done');
    B.game.set('temple.underwater.done', true);
    B.game.save(); B.game.reload();
    assert.ok(privateStore.size, 'initial completed fixture persisted privately');
    assert.equal(B.game.flag('temple.underwater.boss'), 'done');
    assert.equal(B.game.flag('temple.underwater.done'), true);
    await quiet(async () => {
      g = await B.createGame({ levelId: TEMPLE_HOME.underwater ?? 'underwater', backend, audio: null, saves: false, waterBed: false, fight: true });
      const rt = g.level.temples.find(t => t.id === 'underwater'), P = g.player;
      assert.ok(rt, 'real Whale runtime');
      // The accepted physical approach beside d5; no positioning after this.
      P.teleport(rt.kit.world(-107.96661765108897, -24, 47.00846775148874), P.frame.up.clone(), P.frame.fwd.clone());
      for (let i = 0; i < 30; i++) g.frame(1 / 30);
      assert.ok(P.onGround && !P.dead && rt.inside(P.pos));
      assert.equal(rt.guardian.state, 'resolved');
      assert.ok(rt.logic.isOpen('d5'));
      const portals = rt.portals.filter(p => p.toUp && p.label === 'way out' &&
        p.at.distanceTo(rt.kit.world(-109.6, -23.5, 47)) < .01);
      assert.equal(portals.length, 1, 'authored final portal');
      const portal = portals[0], walks = g.doorWalk.walks, phases = [];
      let arrived = false, settled = false;
      for (let frame = 0; frame < 300; frame++) {
        assert.ok(!P.dead && rt.logic.isOpen('d5'), 'survives with the exit open');
        assert.equal(B.game.flag('temple.underwater.done'), true);
        const phase = g.passage.cur?.phase;
        if (phase && phases.at(-1) !== phase) phases.push(phase);
        if (g.doorWalk.phase === 'arrive' && !rt.inside(P.pos) && P.pos.distanceTo(portal.to) < 6) arrived = true;
        if (arrived && !g.passage.active && !g.doorWalk.active) { settled = true; break; }
        if (arrived || g.passage.active || g.doorWalk.active) g.key('KeyW', false);
        else {
          const toward = portal.at.clone().sub(P.pos);
          const yaw = Math.atan2(-toward.dot(P.frame.right), -toward.dot(P.frame.fwd));
          const turn = Math.atan2(Math.sin(yaw - g.rig.yaw), Math.cos(yaw - g.rig.yaw));
          g.look(-turn / (.0025 * g.rig.sensitivity), 0);
          g.key('KeyW', true);
        }
        g.frame(1 / 30);
      }
      g.key('KeyW', false);
      assert.ok(arrived && settled, 'real arrive then idle within 300 input frames');
      assert.ok(phases.includes('cover') && phases.includes('reveal'));
      assert.ok(phases.indexOf('cover') < phases.indexOf('reveal'), 'covered before revealing the exterior');
      assert.equal(g.doorWalk.walks, walks + 1, 'exactly one production transition');
      assert.ok(!rt.inside(P.pos) && P.pos.distanceTo(portal.to) < 6 && !P.dead, 'alive at the authored exterior destination');
      B.game.save(); B.game.reload();
      assert.equal(B.game.flag('temple.underwater.done'), true, 'private save/reload retains completion, not a full world reboot');
      assert.equal(B.game.flag('temple.underwater.boss'), 'done');
    });
  } finally {
    g?.key('KeyW', false);
    removeTemp(file);
    privateStore.clear();
  }
});

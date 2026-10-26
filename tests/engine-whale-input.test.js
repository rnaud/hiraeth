// The ordinary input cases use the fixed game entry; the private completed-save fixture stays separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { DEEP, TIDE, SOUND } from '../src/temples/underwater.js';
import { TEMPLE_HOME } from '../src/temples/attachment.js';
import { backend, quiet } from './whale-engine-fixtures.js';

test('Whale House engine host: ordinary valve input raises swimmable water, swimmer reaches the dais and lowers it again', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-whale-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file);
  await quiet(async () => {
    const g = await B.exports.createGame({ levelId: TEMPLE_HOME.underwater ?? 'underwater', backend, saves: false, waterBed: false });
    const rt = (g.level.temples ?? [g.level.temple]).find(t => t?.id === 'underwater');
    assert.ok(rt, 'the real Whale House is loaded');
    const P = g.player, world = (...p) => rt.kit.world(...p), local = () => rt.kit.local(P.pos);
    const frame = (n = 1, keys = {}) => { for (const [k, v] of Object.entries(keys)) g.key(k, v); for (let i = 0; i < n; i++) g.frame(1 / 30); };
    const tap = key => { frame(1, { [key]: true }); frame(1, { [key]: false }); };
    // Initial fixture only: no tide/progression flags or water cache changes.
    P.teleport(world(2.5, DEEP + .1, 40), P.frame.up.clone(), P.frame.fwd.clone());
    P.vel.set(0, 0, 0); frame(30);
    assert.ok(P.onGround && !P.swim, 'dry floor beside the low-tide valve');
    assert.ok(!rt.logic.isOpen('dL'), 'the Listener lock starts closed');
    tap('KeyE');
    assert.ok(rt.logic.drumOn('tide', 'tHigh'), 'ordinary use turns the nearby valve');
    frame((TIDE.run + 2) * 30);
    assert.ok(P.swim, `raised visible water must float the traveller, local ${local().toArray()}`);
    assert.ok(local().y > TIDE.hall[1] - 2, 'swimmer rides up with the real tide');
    const surface = P.water.surfaceAt(P.pos.x, P.pos.z, P.pos.y);
    assert.ok(Math.abs(surface.y - world(0, TIDE.hall[1], 0).y) < .05, 'gameplay surface matches the drawn high tide');
    assert.ok(!rt.logic.isOpen('dL'), 'raising water does not bypass the Listener lock');
    const walk = (q, seconds = 35) => {
      const to = world(...q);
      for (let i = 0; i < seconds * 30; i++) {
        if (Math.hypot(P.pos.x - to.x, P.pos.z - to.z) < .65 && Math.abs(P.pos.y - to.y) < 1.6) { frame(1, { KeyW: false }); return true; }
        // Ordinary camera yaw/stick input, with real player collision and swim mantle.
        g.rig.yaw = Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
        frame(1, { KeyW: true });
      }
      frame(1, { KeyW: false }); return false;
    };
    assert.ok(walk([21, TIDE.hall[1], SOUND.z1 - 3]), 'swim across the Sound');
    assert.ok(walk([21, 0, SOUND.z1 + 3]), 'mantle onto the dais');
    assert.ok(P.onGround && !P.swim, 'standing on the dry dais');
    assert.ok(walk([6.5, 0, 78]), 'walk to the dais valve');
    const valve = rt.piece('valve.dais');
    const valveId = 'temple.underwater.valve.dais';
    const inView = () => {
      const p = valve.top.clone().project(g.camera);
      return p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
    };
    // Arriving from the east leaves the view facing west, away from the valve.
    // Nearby but unseen is deliberately not actionable (#636).
    assert.equal(inView(), false, 'the last walking view has the valve out of frame');
    assert.notEqual(g.story.promptEntry?.id, valveId, 'no prompt offers the hidden valve');
    tap('KeyE');
    assert.ok(rt.logic.drumOn('tide', 'tHigh'), 'an away-facing use does not lower the tide');
    // CameraRig yaw describes its backwards arm in the player's local-up frame.
    // Turn through the same pointer-look API as gameplay, without relocating the player,
    // assigning a camera matrix, invoking the valve, or writing a tide flag.
    const toward = valve.top.clone().sub(P.pos);
    const yaw = Math.atan2(-toward.dot(P.frame.right), -toward.dot(P.frame.fwd));
    const turn = Math.atan2(Math.sin(yaw - g.rig.yaw), Math.cos(yaw - g.rig.yaw));
    g.look(-turn / (0.0025 * g.rig.sensitivity), 0);
    frame(60);
    assert.ok(inView(), 'ordinary camera turn brings the valve into frame');
    assert.equal(g.story.promptEntry?.id, valveId, 'the visible valve is the offered use target');
    assert.equal(g.story.prompt, 'let the sea out');
    tap('KeyE');
    assert.ok(rt.logic.drumOn('tide', 'tLow'), 'ordinary use of the visible valve lowers the tide');
    frame((TIDE.run + 2) * 30);
    const low = P.water.surfaceAt(world(0, 0, 40).x, world(0, 0, 40).z, world(0, DEEP, 40).y);
    assert.ok(Math.abs(low.y - world(0, TIDE.hall[0], 0).y) < .05, 'the low swim bounds return with the surface');
  });
});

// Equipment is the initial fixture here; the ear and door are never triggered by the test.
// This distinguishes the intended low indoor spring-hop from the ordinary jump -> stomp input.
test('Whale House engine host: jump then spring-use sounds the deep ear without bypassing the indoor hop cap', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-whale-stomp-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = await loadBundle(file);
  await quiet(async () => {
    const g = await B.exports.createGame({ levelId: TEMPLE_HOME.underwater ?? 'underwater', backend, saves: false, waterBed: false });
    const rt = (g.level.temples ?? [g.level.temple]).find(t => t?.id === 'underwater');
    const P = g.player;
    B.exports.items.grant('springs');
    const at = rt.piece('eSt').at.clone().setY(rt.kit.world(0, DEEP, 0).y);
    at.z += 1.5;
    P.teleport(at, P.frame.up.clone(), P.frame.fwd.clone()); P.vel.set(0, 0, 0);
    const frame = (n = 1, keys = {}) => { for (const [k, v] of Object.entries(keys)) g.key(k, v); for (let i = 0; i < n; i++) g.frame(1 / 30); };
    frame(40);
    assert.equal(g.gadgets.equipped, 'springs');
    assert.ok(P.onGround && rt.inside(P.pos), 'initial standing fixture inside the Whale House');
    assert.ok(!rt.logic.isLit('eSt') && !rt.logic.isOpen('dS'));
    const floor = P.pos.y;
    frame(36, { KeyT: true }); frame(1, { KeyT: false });
    let peak = P.pos.y;
    for (let i = 0; i < 120; i++) { frame(); peak = Math.max(peak, P.pos.y); }
    assert.ok(peak - floor > 1 && peak - floor < 3, `indoor hop remains limited: ${peak - floor}`);
    assert.ok(!rt.logic.isLit('eSt'), 'a normal spring hop does not fake a stomp');
    assert.ok(P.onGround);
    const hearts = P.hearts;
    frame(1, { Space: true }); frame(1, { Space: false });
    let jumped = false;
    for (let i = 0; i < 24; i++) {
      if (P.pos.y - floor >= 1.8 && P.vel.y > 0) { jumped = true; break; }
      frame();
    }
    assert.ok(jumped, 'ordinary jump reaches the stomp input window');
    frame(1, { KeyT: true }); frame(1, { KeyT: false }); frame(90);
    assert.ok(rt.logic.isLit('eSt'), 'real spring-use input emits the deep note heard by the ear');
    assert.ok(rt.logic.isOpen('dS'), 'the low-tide Horn Store door opens');
    assert.equal(P.hearts, hearts, 'the stomp protects its landing');
    assert.ok(!rt.logic.isOpen('dL'), 'the later Listener lock is still intact');
  });
});


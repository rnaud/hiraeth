// A foe's eyes on the traveller (issue #508, src/enemies/gaze.js): once it has noticed him its eyes turn, lean or slide
// toward him, never past their reach; idle they look where it is going; only transforms move (the shared geometries of
// src/foe-shapes.js are never rewritten).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { GAZE, gazePart, gazeApply, watchingHim } from '../src/enemies/gaze.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const player = (at) => ({ pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {} });
const world = (P) => { const scene = new THREE.Scene(); const foes = new Foes({ scene, level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null) }); foes.waveRest = 1e9; return { scene, foes }; };
// (a frame: the scene's matrices as the renderer leaves them, then the foe drawn)
const frames = (scene, foes, f, n, each = () => {}) => { for (let i = 0; i < n; i++) { each(i); f.dist = Math.hypot(foes.player.pos.x - f.pos.x, foes.player.pos.z - f.pos.z); scene.updateMatrixWorld(true); foes.look(f, DT); } };
const versions = (g) => { const out = []; g.traverse((o) => { if (o.geometry?.attributes?.position) out.push([o.geometry, o.geometry.attributes.position.version]); }); return out; };

const KINDS = ['crab', 'toad', 'lizard', 'brute', 'wisp', 'blot', 'roller', 'heron', 'moth', 'shade', 'drone', 'cart', 'hound', 'jelly', 'ray', 'centipede', 'rootknot', 'worm'];

test('a foe that has noticed the traveller turns its eyes to him, within their reach; behind it, they stop at the edge of it', () => {
  clearTargets();
  for (const kind of KINDS) {
    const P = player(v(5, 0, 4)), { scene, foes } = world(P);
    const f = foes.add(kind, v(0, 0, 0)); f.heading = 0; f.state = 'chase'; f.provoked = true;
    const E = f.model.gaze;
    assert.ok(E?.length, `${kind}: has eyes that follow`);
    const before = versions(f.model.group);
    frames(scene, foes, f, 90);
    assert.ok(watchingHim(f, P), `${kind}: watching him`);
    for (const e of E) {
      assert.ok(e.yaw > 0.2, `${kind}: its eyes turned to his side (${e.yaw.toFixed(2)})`);
      assert.ok(e.yaw <= e.yawMax + 1e-9 && e.pitch <= e.up + 1e-9 && e.pitch >= -e.down - 1e-9, `${kind}: within reach`);
      const moved = e.mode === 'slide' ? e.node.position.distanceTo(e.rest) : 2 * Math.acos(Math.min(1, Math.abs(e.node.quaternion.w)));
      assert.ok(moved > (e.mode === 'slide' ? e.slide * 0.3 : 0.1), `${kind}: the eye moved (${e.mode}, ${moved.toFixed(3)})`);
    }
    // behind it, a little to its left: held at its left edge, never swung across
    P.pos.set(-1, 0, -8);
    frames(scene, foes, f, 120);
    for (const e of E) assert.ok(e.yaw < 0 && Math.abs(e.yaw) <= e.yawMax + 1e-9, `${kind}: held at its reach behind it (${e.yaw.toFixed(2)} of ${e.yawMax})`);
    assert.ok(before.every(([g, n]) => g.attributes.position.version === n), `${kind}: no geometry rewritten (only transforms move)`);
    foes.dispose(); clearTargets();
  }
});

test('idle, it looks where it is going: ahead as it walks on, to its side as it drifts sideways; noticed, back on him', () => {
  clearTargets();
  for (const kind of ['crab', 'toad', 'lizard', 'brute', 'wisp']) {
    const P = player(v(6, 0, 3)), { scene, foes } = world(P);
    const f = foes.add(kind, v(0, 0, 0)); f.heading = 0; f.state = 'chase'; f.provoked = true;
    frames(scene, foes, f, 60);
    assert.ok(f.model.gaze.every((e) => e.yaw > 0.2), `${kind}: on him`);
    // he goes; it walks on along its heading: its eyes come back to its way
    f.state = 'idle'; f.provoked = false; f.watcher = false; P.pos.set(-30, 0, 0);
    frames(scene, foes, f, 90, () => { f.pos.z += 1.5 * DT; });
    assert.ok(!f.gaze.watching, `${kind}: not watching`);
    for (const e of f.model.gaze) assert.ok(Math.abs(e.yaw) < 0.1 && e.pitch < 0.05, `${kind}: back to its way ahead (yaw ${e.yaw.toFixed(3)}, pitch ${e.pitch.toFixed(3)})`);
    // drifting to its right (its heading unchanged): its eyes lead the way it goes
    frames(scene, foes, f, 120, () => { f.pos.x += 1.5 * DT; });
    for (const e of f.model.gaze) assert.ok(e.yaw > 0.2, `${kind}: looking the way it drifts (${e.yaw.toFixed(2)})`);
    // he comes back on its left and it notices him: its eyes go back to him
    P.pos.set(f.pos.x - 2.4, 0, f.pos.z + 1.2); f.state = 'chase';   // (near: a crab faces him rather than scuttling side-on)
    frames(scene, foes, f, 60);
    for (const e of f.model.gaze) assert.ok(e.yaw < -0.2, `${kind}: back on him (${e.yaw.toFixed(2)})`);
    foes.dispose(); clearTargets();
  }
});

test('the gaze is eased and held: a turn eye reaches its target in a fraction of a second, and stays inside its reach for any target', () => {
  const root = new THREE.Group(), head = new THREE.Group(); head.position.set(0, 1, 0.5); root.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.1)));
  const E = gazePart(root, head, { mode: 'turn', yaw: 0.6, up: 0.3, down: 0.4 });
  assert.equal(E.node.parent, head, 'an inner group, the head\'s own pose left to its anim');
  root.updateMatrixWorld(true);
  const at = v(Math.tan(0.5), 1, 1.5);   // (0.5 rad to its right, level)
  for (let i = 0; i < 30; i++) gazeApply([E], at, DT);
  assert.ok(Math.abs(E.yaw - 0.5) < 0.02 && Math.abs(E.pitch) < 0.02, `half a second: on it (${E.yaw.toFixed(3)})`);
  for (const p of [v(0, 9, 0.5), v(0, -9, 0.6), v(-5, 1, -3), v(5, 1, 0.4)]) {
    for (let i = 0; i < 120; i++) gazeApply([E], p, DT);
    assert.ok(Math.abs(E.yaw) <= 0.6 + 1e-9 && E.pitch <= 0.3 + 1e-9 && E.pitch >= -0.4 - 1e-9, `held within its reach for ${p.toArray()}`);
  }
  assert.ok(GAZE.rate > 4 && GAZE.far > 20);
});

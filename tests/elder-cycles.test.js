// The Elder's acceptance (issue #237): her whole cycles without snaps, frozen parts or tearing (scripts/tripo/elder-cycles.mjs
// measures them); her own pose for each move (the gale and the feathers posed as the buffet); the peck's beak down at
// you, not curled under her; her take-off and landing eased (she rose 3.5 m in a frame), her turns gathered (0 to
// 3 rad/s in a frame, a 12 rad/s whip as a move began); her wingtips and feet on her skin. Before: the peck's first frame moved her head 82 m/s in a frame, the stamp's
// 62, the weary pose flipped a thigh half a turn, the throat tore 60 cm open at the peck's blow.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { loadElderGltf, measure, SNAP, POP } from '../scripts/tripo/elder-cycles.mjs';
import { createElderCreature, ELDER_POSE, ELDER_TURN } from '../src/characters/elder-v3-creature.js';
import * as fit from '../src/characters/elder-v3-fit.js';
import { Guardian } from '../src/temples/boss.js';
import { ELDER } from '../src/temples/arzach.js';
import { driveElder } from '../tools/elder-drive.js';

globalThis.ProgressEvent ??= class { constructor(type, v) { this.type = type; Object.assign(this, v); } };
const gltf = await loadElderGltf();
const V = (...a) => new T.Vector3(...a);
const rig = (m) => new Guardian({ def: { id: 'elder-cycles' }, root: new T.Group(), logic: {}, notice() {}, player: { pos: V(0, 0, 9), dead: false }, physics: { groundAt: () => 0 } }, { def: ELDER, model: m, arena: { center: V(), r: 20, y: 0 } });

test('every move and state runs its whole cycle without a pop, a frozen part or a tear', () => {
  for (const motion of ['idle', 'walk', 'peck', 'stamp', 'buffet', 'gale', 'feathers', 'dive', 'sleep', 'wake', 'weary', 'open', 'flightCycle']) {
    const r = measure(gltf, motion, { every: 24 });
    for (const [part, q] of Object.entries(r.parts)) {
      // (the stamp's foot stops on the floor in a frame: that is its blow)
      if (motion === 'stamp' && part === 'legL') continue;
      assert.ok(!(q.snap > SNAP && q.pop > POP), `${motion}: ${part} pops (${q.snap} m/s in a frame of ${q.speed} at ${q.at} s)`);
      if (!part.startsWith('leg')) assert.ok(q.moves > 0.05, `${motion}: ${part} frozen (${q.moves} m)`);
    }
    assert.ok(r.tear < 20, `${motion}: an edge ${r.tear} cm off its length`);
  }
});

test('the gale, the feathers and the buffet each have their own wind-up; links pose as their moves', () => {
  const at = (move, k = 0.9) => {
    const m = createElderCreature(gltf, { fit }), a = ELDER.attacks[move], frame = (k) => { m.group.position.copy(m.pos); m.animate(1 / 60, 1, { state: 'fight', attack: { ...a, id: a.pose ?? move, move }, k, kit: { ground: () => 0 } }); };
    for (let i = 0; i < 120; i++) frame(k);
    const p = { ...m.pose }; m.dispose(); return p;
  };
  const buffet = at('buffet'), gale = at('gale'), feathers = at('feathers');
  assert.ok(gale.raise - buffet.raise > 0.1 && gale.sweep < buffet.sweep - 0.2, 'the gale rears its wings high and back');
  assert.ok(feathers.quiver > 0.5 && buffet.quiver < 0.1, 'the feathers shiver');
  const peck2 = at('peck2'), peck = at('peck');
  assert.ok(Math.abs(peck2.neck - peck.neck) < 0.05 && peck2.neck < -0.3, 'peck2 draws its neck back as the peck does');
});

test('the peck brings her beak down ahead of her, pointing at the traveller, not curled under her breast', () => {
  const m = createElderCreature(gltf, { fit }), g = rig(m);
  let t = 0;
  for (let f = 0; f < 2.75 * 60; f++) { t += 1 / 60; driveElder({ model: m, guard: g, t, dt: 1 / 60, motion: 'peck' }); }
  const d = m.mouth.clone().sub(m.head.getWorldPosition(V())), down = Math.atan2(-d.y, d.z) * 180 / Math.PI;
  assert.ok(m.mouth.z > 3 && m.mouth.y < 1.6, `the beak 1-1.5 m up, 3 m and more ahead (${m.mouth.z.toFixed(2)}, ${m.mouth.y.toFixed(2)})`);
  assert.ok(down > 30 && down < 75, `pointing forward and down (${down.toFixed(0)}°; it was 128°, back under her)`);
  assert.ok(ELDER_POSE.peck.strike.reach > 1, 'the neck stretched out');
  m.dispose();
});

test('she takes off and lands eased, and gathers her turns: no jump of her body in a frame', () => {
  const m = createElderCreature(gltf, { fit }), g = rig(m);
  g.wake(); g.enter('fight'); g.cool = 1e9;
  let last = m.pos.y, step = 0, top = 0;
  for (let f = 0; f < 240; f++) { if (f === 30) g.meter = g.floor = 0.46; g.update(1 / 60, f / 60); step = Math.max(step, Math.abs(m.pos.y - last)); last = m.pos.y; top = Math.max(top, m.pos.y); }
  assert.ok(top > 3, `aloft (${top.toFixed(2)} m)`);
  assert.ok(step < 0.15, `up at most ${step.toFixed(3)} m a frame (3.5 m at once before)`);
  // a turn from still: its speed rises over frames, never past ELDER_TURN
  g.frame += 5; m.heading = 0; let h = m.heading, v0 = 0, dv = 0, top2 = 0;   // (a turn not asked for last frame starts from still)
  for (let f = 0; f < 60; f++) { g.turnTo(1 / 60, Math.PI, 20); g.frame++; const v = (m.heading - h) * 60; dv = Math.max(dv, Math.abs(v - v0)); top2 = Math.max(top2, v); v0 = v; h = m.heading; }
  assert.ok(dv < 0.5 && top2 <= ELDER_TURN + 1e-6, `gathered: ${dv.toFixed(2)} rad/s more a frame at most, ${top2.toFixed(2)} rad/s at most`);
  m.dispose();
});

test('her wingtips and feet are points of her drawn skin, in every pose', () => {
  const m = createElderCreature(gltf, { fit }), g = rig(m), mesh = m.meshes[0], v = V(), P = V();
  let t = 0;
  for (const motion of ['buffet', 'stamp', 'hover']) for (let f = 0; f < 150; f++) {
    t += 1 / 60; driveElder({ model: m, guard: g, t, dt: 1 / 60, motion, phase: motion === 'hover' ? 1 : 0 });
    if (f % 30) continue;
    m.group.updateMatrixWorld(true);
    for (const [name, side] of [['wings', 1], ['wings', -1], ['feet', 1], ['feet', -1]]) {
      m.part(name, P, side);
      let d = Infinity; for (let i = 0; i < mesh.geometry.attributes.position.count; i += 3) { mesh.getVertexPosition(i, v); d = Math.min(d, v.applyMatrix4(mesh.matrixWorld).distanceTo(P)); }
      assert.ok(d < 0.12, `${motion}: her ${name} (${side}) ${d.toFixed(2)} m from her skin (the joints lay 0.43 and 0.26 m off it)`);
    }
  }
  m.dispose();
});

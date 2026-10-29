// The combo's third blow lands (issue #759, the author: "When doing a 3 way attack I feel like my third blow never connects
// with enemies. Like he is attacking up and backward vs towards the enemy?"). Measured on the reach rig with the foes'
// own minds and the shoves of the first two blows (scripts/combat-reach.mjs's traveller, real clips and blade): the
// second cut slid a grunt 1.9 m back through the third's 0.42 s wind-up, out of its reach; a hulk's or a warlord's chest
// leapt him off the ground (#747); and through the wind-up the clip turned his hips 73° away from the foe, the sword
// dropped behind his head. Now the swing keeps to its foe until the blade arrives (src/fluid-blade.js TRACK, follow) and
// he is held turned into it through the coil (SWINGS[2].face, hipYaw).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { reachRig } from '../scripts/combat-reach.mjs';
import { allTargets, clearTargets } from '../src/targets.js';
import { FOES } from '../src/foes.js';
import { SWINGS, TRACK, hipYaw } from '../src/fluid-blade.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60;
let rig = null;

/** The three blows pressed at a `kind` standing `gap` m off its body, its mind on (no blows of its own, no dodging): which landed, and how far his hips turned off it in the third's wind-up (rad). */
async function combo(kind, gap, locked) {
  rig ??= await reachRig();
  const { p, tool, foes, home, tick } = rig, B = tool.blade;
  B.stop(); B.cool = 0; B.chainT = 0; B.buffered = 0; B.queued = false; B.last = -1;
  p.pos.copy(home); p.vel.set(0, 0, 0); p.heading = 0; p.lockOn = null; p.aim = null; p.health = 99;
  for (let i = 0; i < 30; i++) tick({});
  const f = foes.add(kind, v(home.x, home.y, home.z + FOES[kind].radius + gap));
  f.heading = Math.PI; f.state = 'idle'; f.provoked = true; f.hp = 999;
  f.fight = { ...f.fight, evade: null }; f.def = { ...f.def, answerMash: null };   // (its own dodges out of a combo are its design, not this)
  for (let i = 0; i < 40; i++) foes.look(f, DT);
  const T = allTargets().find((t) => t.foe === f), hits = new Set(), orig = T.onHit;
  T.onHit = (...a) => { hits.add(B.n); return orig?.(...a); };
  rig.setLock(locked ? T : null);
  let pressed = 0, hip = 0;
  tick({ KeyF: true });
  for (let i = 0; i < 260; i++) {
    const press = pressed < 2 && B.swinging && B.n === pressed && B.phase === 'recover';
    if (press) pressed++;
    if (locked) p.lockOn = { dir: v(f.pos.x - p.pos.x, 0, f.pos.z - p.pos.z).normalize() };
    f.cool = 9;
    tick(press ? { KeyF: true } : {});
    foes.update(DT);
    if (B.n === 2 && B.phase === 'wind') {
      const d = p.heading + hipYaw(p) - p.frame.headingOf(v(f.pos.x - p.pos.x, 0, f.pos.z - p.pos.z));
      hip = Math.max(hip, Math.abs(Math.atan2(Math.sin(d), Math.cos(d))));
    }
    if (!B.swinging && pressed >= 2 && i > 30) break;
  }
  rig.setLock(null); foes.remove(f);
  return { hits: [0, 1, 2].map((n) => (hits.has(n) ? 1 : 0)).join(''), hip };
}

test('the third blow lands on foes from 1.2 to 2.5 m off, the hulk too, locked on or not (#759)', async () => {
  assert.ok(SWINGS[2].face > 0 && TRACK.from.includes('wind'));
  const misses = [];
  for (const kind of ['blot', 'grunt', 'hulk']) for (const gap of [1.2, 1.5, 2, 2.5]) for (const locked of [false, true]) {
    const r = await combo(kind, gap, locked);
    if (r.hits !== '111') misses.push(`${kind} ${gap} m${locked ? ' locked' : ''}: ${r.hits}`);
  }
  assert.deepEqual(misses, [], `the blows that missed (first, second, third): ${misses.join('; ')}`);
});

test('through the third\'s wind-up he stays turned at the foe: his hips never more than 55° off it (73° before) (#759)', async () => {
  for (const locked of [false, true]) {
    const r = await combo('crab', 1.5, locked);
    assert.ok(r.hip < 55 / 57.3, `${locked ? 'locked' : 'free'}: hips ${(r.hip * 57.3).toFixed(0)}° off the foe at most`);
  }
  rig.tool.dispose(); clearTargets();
});

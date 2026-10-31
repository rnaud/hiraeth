// A foe left to its calm on flat ground (as tests/foe-slope.test.js runs it: Math.random seeded, the clock run by the
// frames, the traveller out of the fight): its lowest skinned vertex every 3rd frame, over many seeds; the worst printed
// with the bone that carries it, the state and the body's height. For a part that sinks.
//
//   node references/enemy-redesign-2026-10-30/trials/familyA-tripo/probe-ground.mjs <kind> [seeds 20] [frames 150]
import * as THREE from 'three';
import { Foes } from '../../../../src/foes.js';
import { GameState } from '../../../../src/game-state.js';
import { clearTargets } from '../../../../src/targets.js';
import { resetFeel } from '../../../../src/feel.js';

const [kind = 'toad', seeds = '20', frames = '150'] = process.argv.slice(2);
const v = new THREE.Vector3();
// (SLOPE=1: the slope test's plane, a rise of 0.2 a metre along x and 0.15 along z)
const G = process.env.SLOPE ? (x, z) => 0.2 * x + 0.15 * z : () => 0;
const random = Math.random, now = performance.now;
let worst = { d: -Infinity };
for (let seed = 1; seed <= +seeds; seed++) {
  let s = seed * 7919, clock = 1000;
  Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  performance.now = () => clock;
  clearTargets(); resetFeel();
  const P = { pos: new THREE.Vector3(0, 0, -10), vel: new THREE.Vector3(), heading: 0, onGround: true, health: 1, down: null, dead: true, frame: { up: new THREE.Vector3(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: new THREE.Vector3(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: (x, y, z) => G(x, z), rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), tool: { drops: { add() {} } } });
  foes.setPractice('');
  const f = foes.add(kind, new THREE.Vector3(0, G(0, 6), 6));
  for (let i = 0; i < +frames; i++) {
    clock += 1000 / 60; foes.update(1 / 60);
    if (i < 20 || i % 3) continue;
    f.model.group.updateMatrixWorld(true);
    f.model.group.traverseVisible((o) => {
      if (!o.isSkinnedMesh) return;
      o.skeleton.update();
      const Pp = o.geometry.attributes.position, J = o.geometry.attributes.skinIndex;
      for (const k of new Set(o.geometry.index.array)) {
        o.applyBoneTransform(k, v.fromBufferAttribute(Pp, k)).applyMatrix4(o.matrixWorld);
        if (G(v.x, v.z) - v.y > worst.d && process.env.LEGS) { const L = f.model.rig.legs[+(process.env.LEGS)], w = (q) => q.getWorldPosition(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2)); worst.legs = { hip: w(L.root), knee: w(L.shin), foot: w(L.foot), g: f.model.group.position.toArray().map((x) => +x.toFixed(2)) }; }
        if (G(v.x, v.z) - v.y > worst.d) worst = { legs: worst.legs, d: +(G(v.x, v.z) - v.y).toFixed(3), seed, frame: i, mesh: o.name, bone: o.skeleton.bones[J.getX(k)].name, rest: [Pp.getX(k), Pp.getY(k), Pp.getZ(k)].map((x) => +x.toFixed(2)), state: f.state, body: +f.model.body.position.y.toFixed(3), scale: +f.model.body.scale.y.toFixed(3) };
      }
    });
  }
  foes.dispose();
}
Math.random = random; performance.now = now;
console.log(JSON.stringify(worst));

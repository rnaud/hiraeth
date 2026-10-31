// #800 family G: tests/foe-ragdoll.test.js's wall (a box 0.6 m before it, the level's BVH) for one kind, on rig seeds
// 0..N (src/motion-kit/rig.js nextRigSeed): how far its particles go past the wall's face, which particle first, and when.
//   node references/enemy-redesign-2026-10-30/trials/familyG-tripo/wall-probe.mjs <kind> [seeds] [dir x,z]
import * as THREE from 'three';
import { Foes } from '../../../../src/foes.js';
import { GameState } from '../../../../src/game-state.js';
import { clearTargets } from '../../../../src/targets.js';
import { resetFeel } from '../../../../src/feel.js';
import { Physics } from '../../../../src/physics.js';
import { nextRigSeed } from '../../../../src/motion-kit/rig.js';
import { JOINTS } from '../../../../src/ragdoll.js';

const kind = process.argv[2] ?? 'hulk', N = +(process.argv[3] ?? 12), [dx, dz] = (process.argv[4] ?? '0,1').split(',').map(Number), DT = 1 / 60, wallZ = 0.6;
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const scene = new THREE.Scene(), g = new THREE.PlaneGeometry(40, 40, 20, 20); g.rotateX(-Math.PI / 2); scene.add(new THREE.Mesh(g));
const w = new THREE.Mesh(new THREE.BoxGeometry(20, 4, 0.3)); w.position.set(0, 2, wallZ + 0.15); scene.add(w); scene.updateMatrixWorld(true);
const physics = new Physics(scene);
/** tests/foe-ragdoll.test.js's drawn(): every drawn vertex of the body (not what it held, let go as a piece of its own). */
function drawn(group, body) {
  group.updateMatrixWorld(true);
  const out = [], q = v(), mine = (o) => { for (let x = o; x; x = x.parent) if (x === body) return true; return false; };
  group.traverseVisible((m) => {
    if (!m.isMesh || m.userData.noGround) return;
    const P = m.geometry.attributes.position;
    if (m.isSkinnedMesh) m.skeleton.update();
    const SI = m.geometry.attributes.skinIndex, SW = m.geometry.attributes.skinWeight;
    for (let i = 0; i < P.count; i++) {
      if (m.isSkinnedMesh) { let b = 0, w = -1; for (let k = 0; k < 4; k++) if (SW.getComponent(i, k) > w) { w = SW.getComponent(i, k); b = SI.getComponent(i, k); } if (!mine(m.skeleton.bones[b])) continue; }
      out.push({ p: (m.isSkinnedMesh ? m.getVertexPosition(i, q) : q.fromBufferAttribute(P, i)).applyMatrix4(m.matrixWorld).clone(), what: `${m.name || m.parent?.name}${m.isSkinnedMesh ? ' / ' + m.skeleton.bones[SI.getComponent(i, 0)].name : ''}` });
    }
  });
  return out;
}
for (let seed = 0; seed < N; seed++) {
  nextRigSeed(seed); clearTargets(); resetFeel();
  const P = { pos: v(0, 0, -30), vel: v(), heading: 0, onGround: true, health: 1, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: seeded(9), tool: { drops: { add() {} } } });
  foes.setPractice('');
  const f = foes.add(kind, v(0, 0, 0)); f.heading = 0;
  for (let i = 0; i < 10; i++) foes.update(DT);
  f.hp = 0.1; f.state = 'recover'; f.timer = 0.5; foes.hurt(f, 'blade', v(dx, 0, dz).normalize(), { damage: 9, combo: 2 }, f.chest.clone());
  const R = f.dying.rag; let through = 0, first = null;
  for (let t = 0; t < 2.6 && foes.list.includes(f) && !(f.dead <= 0.4); t += DT) {
    foes.update(DT);
    R.rag.x.forEach((p, i) => { const d = p.z - wallZ; if (d > through) { through = d; if (d > 0.02 && !first) first = `${JOINTS[i][0]} at ${t.toFixed(2)} s, r ${R.rag.r[i].toFixed(2)}`; } });
  }
  const D = drawn(f.model.group, f.model.joints.body).filter((d) => d.p.y < 3.9).sort((a, b) => b.p.z - a.p.z)[0];
  console.log('seed', seed, 'through', (through * 100).toFixed(0), 'cm', first ?? '', '| drawn past the face', ((D.p.z - wallZ) * 100).toFixed(1), 'cm on', D.what);
  foes.dispose();
}

// #800 family G: tests/foe-hit-defeat.test.js's defeat on a slope for one kind (the blow from behind, at (0, 0, 6), its
// own seeded Math.random), frame by frame: how deep under the ground its drawn body goes and which mesh and bone.
//   node references/enemy-redesign-2026-10-30/trials/familyG-tripo/defeat-probe.mjs <kind>
import * as THREE from 'three';
import { Foes } from '../../../../src/foes.js';
import { GameState } from '../../../../src/game-state.js';
import { clearTargets } from '../../../../src/targets.js';
import { resetFeel } from '../../../../src/feel.js';
import { underGround, plane } from '../../../../tests/under-ground.js';

const kind = process.argv[2] ?? 'hulk', DT = 1 / 60, v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
let s = 12345; for (const c of kind) s = (s * 31 + c.charCodeAt(0)) % 2147483647; s ||= 1; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const ground = process.env.FLAT ? plane(0, 0) : plane(0.2, 0.15);
clearTargets(); resetFeel();
const P = { pos: v(0, 0, 0), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: (x, y, z) => ground(x, z), rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), tool: { drops: { add() {} } } });
foes.setPractice('');
function deepest() {
  const g = f.model.group; g.updateMatrixWorld(true);
  let worst = -1, what = '';
  g.traverse((o) => { if (!o.isMesh) return; const Pp = o.geometry.attributes.position, SI = o.geometry.attributes.skinIndex, SW = o.geometry.attributes.skinWeight;
    for (let i = 0; i < Pp.count; i++) { const p = v().fromBufferAttribute(Pp, i); if (o.isSkinnedMesh) o.applyBoneTransform(i, p); p.applyMatrix4(o.matrixWorld); const d = ground(p.x, p.z) - p.y;
      if (d > worst) { let b = 0; if (SW) for (let k = 1; k < 4; k++) if (SW.getComponent(i, k) > SW.getComponent(i, b)) b = k; worst = d; what = `${o.name || o.parent?.name} / ${o.isSkinnedMesh ? o.skeleton.bones[SI.getComponent(i, b)].name : '-'} at ${p.toArray().map((q) => q.toFixed(2))}`; } } });
  return [worst, what];
}
const f = foes.add(kind, v(0, 0, 6));
for (let i = 0; i < 12; i++) foes.update(DT);
const before = underGround(f.model.group, ground);
console.log('before the blow', (before.worst * 100).toFixed(1), 'cm on', deepest()[1], 'state', f.state, f.calm, 'pos', f.pos.toArray().map((q) => q.toFixed(2)), 'want', f.model.driver?.want?.kind);
f.hp = 1; f.buried = false; f.open = 1; f.state = 'recover'; f.timer = 0.5;
foes.hurt(f, 'blade', v(Math.sin(f.heading), 0, Math.cos(f.heading)), { damage: 5 }, f.chest.clone());
for (let n = 0; f.dying && f.dead === undefined && n < 200; n++) {
  foes.update(DT);
  if (n > 12 && !(process.env.FLAT && n % 10 === 0)) continue;
  const [worst, what] = deepest();
  console.log(n, 'u', f.dying.u.toFixed(3), 'rag', !!f.dying.rag, (worst * 100).toFixed(1), 'cm', what);
}
foes.dispose();

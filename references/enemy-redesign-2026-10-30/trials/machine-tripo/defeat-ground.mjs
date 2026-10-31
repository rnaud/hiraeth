// #800 family D: how far under a slope (0.2, 0.15) each part of a foe goes through its defeat (tests/foe-hit-defeat.test.js's
// check, per part): which piece sinks, and when.   node defeat-ground.mjs cart
import * as THREE from 'three';
import { Foes } from '../../../../src/foes.js';
import { ARCHETYPES } from '../../../../src/enemies/archetypes.js';
import { GameState } from '../../../../src/game-state.js';
import { clearTargets } from '../../../../src/targets.js';
import { resetFeel } from '../../../../src/feel.js';
import { underGround, plane } from '../../../../tests/under-ground.js';
const id = process.argv[2] ?? 'cart', A = ARCHETYPES[id], v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60;
for (const [where, ground] of [['flat', plane(0, 0)], ['slope', plane(0.2, 0.15)]]) {
  clearTargets(); resetFeel();
  const P = { pos: v(0, 0, 0), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: (x, y, z) => ground(x, z), rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), tool: { drops: { add() {} } } });
  foes.setPractice('');
  const f = foes.add(A.kind, v(0, 0, 6));
  for (let i = 0; i < 12; i++) foes.update(DT);
  const lowest = () => { let sm = null; f.model.group.traverse((o) => { if (o.isSkinnedMesh) sm = o; }); f.model.group.updateMatrixWorld(true); const q = new THREE.Vector3(); let best = [Infinity, -1, -1];
    const SI = sm.geometry.attributes.skinIndex; for (let i = 0; i < sm.geometry.attributes.position.count; i++) { sm.getVertexPosition(i, q); q.applyMatrix4(sm.matrixWorld); const d = q.y - ground(q.x, q.z); if (d < best[0]) best = [d, i, SI.getX(i)]; } const P0 = sm.geometry.attributes.position, W0 = sm.geometry.attributes.skinWeight, i = best[1]; return { depth: +(-best[0] * 100).toFixed(1), vertex: i, bone: sm.skeleton.bones[best[2]]?.name, bind: [P0.getX(i), P0.getY(i), P0.getZ(i)].map((x) => +x.toFixed(3)), joints: [0, 1, 2, 3].map((k) => [sm.skeleton.bones[SI.getComponent(i, k)]?.name, +W0.getComponent(i, k).toFixed(2)]) }; };
  console.log(where, 'at rest the lowest:', JSON.stringify(lowest()));
  if (process.env.BONES) { const H = f.model.body; console.log('  hull', H.name, H.position.toArray().map((x) => +x.toFixed(2)), [H.rotation.x, H.rotation.y, H.rotation.z].map((x) => +x.toFixed(2)), 'state', f.state); const J = f.model.cartJoints ?? f.model.joints; f.model.group.updateMatrixWorld(true); const e = new THREE.Euler(), q = new THREE.Quaternion(), p = new THREE.Vector3();
    for (const [k, b] of (J?.legBones ?? []).entries()) for (const n of ['thigh', 'shin', 'foot']) { b[n].getWorldPosition(p); b[n].getWorldQuaternion(q); e.setFromQuaternion(q); console.log('  leg', k, n, p.toArray().map((x) => +x.toFixed(2)), [e.x, e.y, e.z].map((x) => +x.toFixed(2))); }
    for (const [k, L] of (J?.legs ?? []).entries()) console.log('  kit', k, L.root.position.toArray().map((x) => +x.toFixed(2)), L.shin.position.toArray().map((x) => +x.toFixed(2)), L.foot.position.toArray().map((x) => +x.toFixed(2)), 'ankle', L.ankle); }
  const before = underGround(f.model.group, ground);
  f.hp = 1; f.state = 'recover'; f.timer = 0.5; f.buried = false; f.open = Math.max(f.open ?? 0, 1);
  foes.hurt(f, 'blade', v(Math.sin(f.heading), 0, Math.cos(f.heading)), { damage: 5 }, f.chest.clone());
  const rows = [];
  let deepest = null;
  while (f.dying && f.dead === undefined) { foes.update(DT); const r = underGround(f.model.group, ground); rows.push([f.dying.u, r.worst, r.who]); if (process.env.PARTS && (!deepest || r.worst > deepest.w)) deepest = { w: r.worst, u: f.dying.u, low: lowest() }; }
  if (deepest) console.log(where, 'deepest', (deepest.w * 100).toFixed(1), 'cm at', (deepest.u * 100).toFixed(0), '%', JSON.stringify(deepest.low));
  const worst = rows.reduce((a, b) => (b[1] > a[1] ? b : a), [0, -Infinity, null]);
  console.log(where, 'before', (before.worst * 100).toFixed(1), 'cm', before.who?.name ?? before.who, '| worst', (worst[1] * 100).toFixed(1), 'cm at', (worst[0] * 100).toFixed(0), '%', worst[2]?.name ?? worst[2]);
  for (const r of rows.filter((_, i) => i % 8 === 0).slice(0, 8)) console.log('  ', (r[0] * 100).toFixed(0), '%', (r[1] * 100).toFixed(1), 'cm', r[2]?.name ?? r[2]);
  foes.dispose();
}

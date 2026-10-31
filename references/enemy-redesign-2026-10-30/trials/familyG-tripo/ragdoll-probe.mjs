// #800 family G: a rebuilt biped struck down on flat ground and on tests/foe-ragdoll.test.js's slope, as that test does,
// and how deep its drawn body goes under the ground (the worst vertex, the mesh and the bone it hangs on), frame by frame.
//   node references/enemy-redesign-2026-10-30/trials/familyG-tripo/ragdoll-probe.mjs <kind>
import * as THREE from 'three';
import { Foes } from '../../../../src/foes.js';
import { GameState } from '../../../../src/game-state.js';
import { clearTargets } from '../../../../src/targets.js';
import { resetFeel } from '../../../../src/feel.js';
import { underGround, plane } from '../../../../tests/under-ground.js';

if (process.env.LEGACY) { const [{ TRIAL_BUILDERS }, M] = await Promise.all([import('../../../../src/enemies/plans/index.js'), import('../../../../src/enemies/plans/monster.js')]); TRIAL_BUILDERS.hulk = M.legacyHulkModel; }
const kinds = (process.argv[2] ?? 'mummerking').split(','), DT = 1 / 60;
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
import { nextRigSeed } from '../../../../src/motion-kit/rig.js';
const SEEDS = +(process.env.SEEDS ?? 0);
const DIRS = (process.env.DIRS ?? process.env.DIR ?? '0,0,1').split(';'), awake = {};
for (const [where, ground] of [['flat', plane(0, 0)], ['slope', plane(0.2, 0.15)]]) for (const kind of kinds) for (const dirS of DIRS) for (let seed = 0; seed < Math.max(1, SEEDS); seed++) {
  if (SEEDS) nextRigSeed(seed);
  clearTargets(); resetFeel();
  const P = { pos: v(0, 0, -30), vel: v(), heading: 0, onGround: true, health: 1, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: (x, y, z) => ground(x, z), rayDistance: () => Infinity, rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: seeded(9), tool: { drops: { add() {} } } });
  foes.setPractice('');
  const f = foes.add(kind, v(0, ground(0, 0), 0)); if (process.env.HEADING) f.heading = +process.env.HEADING;
  for (let i = 0; i < 10; i++) foes.update(DT);
  f.hp = 0.1; f.state = 'recover'; f.timer = 0.5; foes.hurt(f, 'blade', v(...dirS.split(',').map(Number)), { damage: 9, combo: 2 }, f.chest.clone()); const p0 = f.dying.rag?.rag?.pelvis?.clone();
  let worst = { worst: -Infinity };
  for (let t = 0; t < (process.env.PUFF ? 2.6 : 2.4) && foes.list.includes(f) && (process.env.PUFF ? !(f.dead <= 0.36) : f.dead === undefined); t += DT) {
    foes.update(DT);
    if (f.dying.u > 0.3) { const u = underGround(f.model.group, ground); if (u.worst > worst.worst) worst = { ...u, t: +t.toFixed(2) }; if (process.env.TRACE && (Math.round(t * 60) % 6 === 0 || (t > 0.8 && t < 0.95))) { const h = f.model.joints.hands[0], hp = h.getWorldPosition(v()), lay = f.dying.rag?.lay?.find((P) => P.o === h); const RV = f.dying.rag?.rag?.v ?? [], mi = RV.reduce((b, p, i) => (p.length() > (RV[b]?.length() ?? 0) ? i : b), 0); const RX = f.dying.rag?.rag; console.log(' ', t.toFixed(3), (u.worst * 100).toFixed(1), 'fastest', mi, RV[mi]?.length().toFixed(2), 'headUp', RX?.headUp?.toFixed(2), 'head', RX?.x[2].toArray().map((q) => q.toFixed(2)).join(','), 'r', RX?.r[2].toFixed(2), 'chest', RX?.x[1].toArray().map((q) => q.toFixed(2)).join(','), 'pelvis', RX?.x[0].toArray().map((q) => q.toFixed(2)).join(','), 'hand', hp.toArray().map((q) => q.toFixed(2)).join(','), 'q', h.quaternion.toArray().map((q) => q.toFixed(2)).join(','), 'pick', lay?.pick, 'asleep', f.dying.rag?.asleep); } }
  }
  // the worst vertex now, by mesh and its heaviest bone
  const g = f.model.group; g.updateMatrixWorld(true);
  const deep = [];
  g.traverse((o) => { if (!o.isMesh) return; const Pp = o.geometry.attributes.position, SI = o.geometry.attributes.skinIndex, SW = o.geometry.attributes.skinWeight;
    for (let i = 0; i < Pp.count; i++) { const p = v().fromBufferAttribute(Pp, i); if (o.isSkinnedMesh) o.applyBoneTransform(i, p); p.applyMatrix4(o.matrixWorld); const d = ground(p.x, p.z) - p.y;
      if (d > 0.01) { let b = 0; if (SW) for (let k = 1; k < 4; k++) if (SW.getComponent(i, k) > SW.getComponent(i, b)) b = k; deep.push([+(d * 100).toFixed(1), o.name || o.parent?.name, o.isSkinnedMesh ? o.skeleton.bones[SI.getComponent(i, b)].name : "-", [Pp.getX(i), Pp.getY(i), Pp.getZ(i)].map((q) => +q.toFixed(2)), SW ? [0, 1, 2, 3].map((k) => o.skeleton.bones[SI.getComponent(i, k)].name + ":" + SW.getComponent(i, k).toFixed(2)).join(" ") : ""]); } } });
  if (process.env.TRACE) for (const d of deep.sort((a, b) => b[0] - a[0]).slice(0, 6)) console.log("  deep", JSON.stringify(d));
  const by = {}; for (const [d, m, b] of deep) { const k = `${m} / ${b}`; by[k] = Math.max(by[k] ?? 0, d); }
  if (!f.dying?.rag?.asleep) awake[where] = (awake[where] ?? 0) + 1;
  if (!process.env.QUIET) console.log(kind, where, dirS, SEEDS ? `seed ${seed}` : '', 'asleep', f.dying?.rag?.asleep, 'pelvis moved', p0 && f.dying?.rag ? Math.hypot(f.dying.rag.rag.pelvis.x - p0.x, f.dying.rag.rag.pelvis.z - p0.z).toFixed(2) : '-', 'worst', (worst.worst * 100).toFixed(1), 'cm at', worst.t, 's on', worst.who, '| at the end:', JSON.stringify(by));
  foes.dispose();
}

console.log("awake at the puff:", JSON.stringify(awake));

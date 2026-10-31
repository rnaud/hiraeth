// A foe standing idle in a node Foes for a second: how far its skinned vertices end up from their bind (per bone that
// carries them most), its body's pose, and its legs' joints against the landmarks. For finding a rig that drifts.
//
//   node references/enemy-redesign-2026-10-30/trials/familyA-tripo/diag.mjs <kind@skin> [frames 45] [state idle] [attack id: wound up over the frames]
import * as THREE from 'three';
import { Foes } from '../../../../src/foes.js';
import { GameState } from '../../../../src/game-state.js';
import { clearTargets } from '../../../../src/targets.js';

THREE.ColorManagement.enabled = false;
const [id = 'toad@perdide', frames = '45', state = 'idle'] = process.argv.slice(2);
clearTargets();
const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(0, 0, 40), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
const f = foes.add(id, new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.state = state;
const atk = process.argv[5] ? f.def.attacks.find((a) => a.id === process.argv[5]) : null;
for (let i = 0; i < +frames; i++) {
  if (atk) { f.atk = atk; f.state = 'wind'; f.k = Math.min(1, i / +frames); f.attackAt = new THREE.Vector3(0, 0, 6); } else f.state = state;
  foes.look(f, 1 / 30);
  if (atk && i % 5 === 0) { const b = f.model.body; console.log(i, 'k', f.k.toFixed(2), 'body y', b.position.y.toFixed(3), 'z', b.position.z.toFixed(3), 'pitch', b.rotation.x.toFixed(3), 'group y', f.model.group.position.y.toFixed(3)); }
}
const M = f.model, g = M.group; g.updateMatrixWorld(true);
console.log('body pos', M.body.position.toArray().map((x) => x.toFixed(3)), 'rot', [M.body.rotation.x, M.body.rotation.y, M.body.rotation.z].map((x) => x.toFixed(3)), 'scale', M.body.scale.toArray().map((x) => x.toFixed(3)), 'group', g.position.toArray().map((x) => x.toFixed(2)));
const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
g.traverse((o) => {
  if (!o.isSkinnedMesh) return;
  o.skeleton.update();
  const P = o.geometry.attributes.position, SI = o.geometry.attributes.skinIndex, v = new THREE.Vector3(), r = new THREE.Vector3(), per = new Map();
  for (const i of new Set(o.geometry.index.array)) {
    r.fromBufferAttribute(P, i); o.applyBoneTransform(i, v.fromBufferAttribute(P, i)); v.applyMatrix4(o.matrixWorld).applyMatrix4(inv);
    const b = o.skeleton.bones[SI.getX(i)].name || SI.getX(i), d = v.distanceTo(r), e = per.get(b) ?? { n: 0, sum: 0, max: 0 };
    e.n++; e.sum += d; e.max = Math.max(e.max, d); per.set(b, e);
  }
  console.log(o.name, [...per].map(([b, e]) => `${b}: mean ${(e.sum / e.n).toFixed(3)} max ${e.max.toFixed(3)} (${e.n})`).join(' | '));
});
for (const [k, l] of M.rig.legs.entries()) {
  const w = (o) => o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).toArray().map((x) => x.toFixed(2)).join(',');
  console.log('leg', k, 'hip', w(l.root), 'knee', w(l.shin), 'foot', w(l.foot));
}
foes.dispose();

// What the desert's scene holds (a quick look before exporting): node scripts/unity-export/census.mjs
import { buildDesertWorld } from './build-world.mjs';
const t0 = Date.now();
const W = await buildDesertWorld();
console.log('built in', Date.now() - t0, 'ms');
const { scene } = W;
const kinds = {}; const mats = new Map(); let tris = 0, inst = 0;
scene.traverse((o) => {
  if (!o.isMesh && !o.isPoints && !o.isLine && !o.isSprite) return;
  const k = (o.isInstancedMesh ? 'inst' : o.isSkinnedMesh ? 'skin' : o.type) + (o.userData.noCollide ? ':nc' : '');
  kinds[k] = (kinds[k] || 0) + 1;
  const g = o.geometry; const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  tris += n * (o.isInstancedMesh ? o.count : 1);
  if (o.isInstancedMesh) inst += o.count;
  for (const m of Array.isArray(o.material) ? o.material : [o.material]) { const e = mats.get(m) ?? { n: 0, type: m.type, mode: m.uniforms?.uMode?.value, defines: m.defines }; e.n++; mats.set(m, e); }
});
console.log(kinds, 'tris', tris, 'instances', inst, 'materials', mats.size);
const byType = {};
for (const [, e] of mats) { const k = e.type + ':' + e.mode + ':' + JSON.stringify(e.defines ?? {}); byType[k] = (byType[k] || 0) + e.n; }
console.log(byType);
console.log('npcs', W.npcs.map((n) => `${n.def?.id ?? n.id ?? '?'}@${n.pos.x.toFixed(0)},${n.pos.z.toFixed(0)}`).join(' '));
console.log('boxes', W.boxes.list?.map((b) => Object.keys(b)));
console.log('story roots', W.storyRoots.map((r) => `${r.type}:${r.name}`).join(' '));
console.log('ship roots', W.shipRoots.map((r) => `${r.type}:${r.name}`).join(' '));
console.log('bike', Object.keys(W.bike), W.bike.pos);
console.log('crowd people', W.crowd.people.length, 'flora', W.flora?.count);
console.log('qanat.city', Object.keys(W.level.qanat.city));
console.log('qanat.cave', Object.keys(W.level.qanat.cave));

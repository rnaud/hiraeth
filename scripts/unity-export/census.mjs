// What a world's scene holds (a quick look before exporting):
//   node scripts/unity-export/census.mjs [levelId]
import { buildWorld } from './build-world.mjs';
const id = process.argv[2] ?? 'desert';
const t0 = Date.now();
const W = await buildWorld(id);
console.log(id, 'built in', Date.now() - t0, 'ms');
const { scene, level } = W;
const kinds = {}; const mats = new Map(); let tris = 0, inst = 0;
scene.traverse((o) => {
  if (!o.isMesh && !o.isPoints && !o.isLine && !o.isSprite) return;
  const k = (o.isInstancedMesh ? 'inst' : o.isSkinnedMesh ? 'skin' : o.type) + (o.userData.noCollide ? ':nc' : '');
  kinds[k] = (kinds[k] || 0) + 1;
  const g = o.geometry; if (!g?.attributes?.position) return; const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  tris += n * (o.isInstancedMesh ? o.count : 1);
  if (o.isInstancedMesh) inst += o.count;
  for (const m of Array.isArray(o.material) ? o.material : [o.material]) { const e = mats.get(m) ?? { n: 0, type: m.type, mode: m.uniforms?.uMode?.value, defines: m.defines, name: m.name }; e.n++; mats.set(m, e); }
});
console.log(kinds, 'tris', tris, 'instances', inst, 'materials', mats.size);
const byType = {};
for (const [, e] of mats) { const k = e.type + ':' + e.mode + ':' + JSON.stringify(e.defines ?? {}); byType[k] = (byType[k] || 0) + e.n; }
console.log(byType);
console.log('level keys', Object.keys(level).join(' '));
console.log('ground', level.ground?.size, level.ground?.seg, !!level.ground?.heightAt, 'gravityAt', !!level.gravityAt, 'features', JSON.stringify(level.features), 'defaults', JSON.stringify(level.defaults));
console.log('sky', JSON.stringify(level.sky)?.slice(0, 300));
console.log('portals', (level.portals ?? []).length, 'vehicles', (level.vehicles ?? []).map((v) => v.kind).join(','), 'mount', W.bike?.kind, 'lights', (level.lights ?? []).length);
console.log('waters', W.waters.bodies.length, W.waters.bodies.map((b) => `${b.mesh.name}:${b.top.toFixed(1)}${b.huge ? ':huge' : ''}`).slice(0, 12).join(' '));
console.log('npcs', W.npcs.map((n) => `${n.def?.id ?? n.id ?? '?'}@${n.pos.x.toFixed(0)},${n.pos.y.toFixed(0)},${n.pos.z.toFixed(0)}`).join(' '));
console.log('boxes', W.boxes.list?.map((b) => `${b.id}:${b.item}`).join(' '));
console.log('story roots', W.storyRoots.length, W.storyRoots.map((r) => `${r.type}:${r.name}`).slice(0, 40).join(' '));
console.log('crowd people', W.crowd?.people.length ?? 0, 'flora', W.flora?.count, 'grass fields', W.grass?.length);
console.log('ship site', JSON.stringify(W.ship.site));
console.log('startFlags', JSON.stringify(W.startFlags));
console.log('interactables', W.interactables.map((e) => `${e.id}`).join(' '));
console.log('targets', W.targets.map((e) => e.kind).join(' '));
console.log('weather', JSON.stringify(W.content.weather), 'life', Object.keys(level.life ?? {}).join(','), 'wildlife', JSON.stringify(W.content.wildlife)?.slice(0, 100));

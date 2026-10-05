// A scratch look at the desert's story objects (development aid for the exporter).
import { buildDesertWorld } from './build-world.mjs';
const W = await buildDesertWorld();
W.scene.traverse((o) => { if (o.isInstancedMesh) { let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false; console.log(o.name || o.parent?.name, o.count, vis, o.material?.uniforms?.uSway?.value, o.userData.dynamic ? 'dyn' : ''); } });
console.log(Object.keys(W.flora));

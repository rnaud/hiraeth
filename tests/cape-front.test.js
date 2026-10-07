import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// What a cloak hides from behind is fine; from the front, where the sheets show a person's bag, keys, gourds
// or bead fringe, the cloak's opening must leave them in sight (docs/systems/characters.md).
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { resetDrapes } = await import('../src/cape.js');
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');
const { PEOPLE } = await import('../src/story/desert-data.js');
const { loadAssets } = await import('./gait-sim.js');
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** The share of a person's chest pieces (rigid on the chest bone) that the cloak covers, seen from in front at `yaw`. */
export function chestHidden(npc, yaw = 0) {
  const H = npc.humanoid, cape = npc.cape, chest = H.b.spine_03;
  H.char.root.updateMatrixWorld(true); cape.mesh.updateMatrixWorld(true);
  const pts = []; for (let i = 0; i < cape.p.length; i += 3) pts.push(V(cape.p[i], cape.p[i + 1], cape.p[i + 2]).applyMatrix4(cape.mesh.matrixWorld));
  const ix = cape.geo.index.array, tris = [];
  for (let i = 0; i < ix.length; i += 3) tris.push([pts[ix[i]], pts[ix[i + 1]], pts[ix[i + 2]]]);
  const h = npc.heading + yaw, eyeDir = V(Math.sin(h), 0, Math.cos(h));
  let n = 0, hidden = 0;
  const ray = new THREE.Ray(), hit = V();
  H.char.root.traverse((o) => {
    if (!o.isSkinnedMesh || o === H.body) return;
    const P = o.geometry.attributes.position, J = o.geometry.attributes.skinIndex, W = o.geometry.attributes.skinWeight, ci = o.skeleton.bones.indexOf(chest);
    for (let i = 0; i < P.count; i++) {
      if (J.getX(i) !== ci || W.getX(i) < 0.99) continue;
      const v = V().fromBufferAttribute(P, i); o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld);
      if (v.y > 1.3 * npc.object.scale.y) continue;   // (the collar's pieces: the cape's own roll sits on them)
      // (only what faces you: a piece's side or back the body hides anyway, and a fringe round the hips goes under
      //  the cloak at the sides)
      if ((v.x - npc.pos.x) * eyeDir.x + (v.z - npc.pos.z) * eyeDir.z < 0.08) continue;
      const eye = v.clone().addScaledVector(eyeDir, 6);
      ray.set(eye, V().subVectors(v, eye).normalize());
      n++;
      if (tris.some(([a, b, c]) => ray.intersectTriangle(a, b, c, false, hit) && hit.distanceTo(eye) < 5.99)) hidden++;
    }
  });
  return { n, share: hidden / Math.max(n, 1) };
}

const SHEET = ['bako', 'nour'];
test('from the front, the cloak leaves the bags, keys, gourds and fringe in sight', async () => {
  resetDrapes();
  const { lib, human } = await loadAssets();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2)));
  scene.updateMatrixWorld(true);
  const physics = new Physics(scene);
  const player = { pos: V(0, 0, 4), vel: V(), riding: false, ride: null, wind: V() }, camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 4);
  const out = {};
  for (const id of ['bako', 'hessa', 'nour', 'ama']) {
    const def = PEOPLE[id];
    const npc = new NPC(scene, physics, { route: [V(0, 0, 0)], def, kind: def.kind, cape: def.cape, palette: def.palette, head: def.head, look: def.look, world: 'desert', lines: def.lines, lib, human: human[def.kind] });
    npc.heading = 0;
    for (let f = 0; f < 120; f++) npc.update(1 / 60, player, camera);
    const front = chestHidden(npc, 0), quarter = Math.max(chestHidden(npc, 0.5).share, chestHidden(npc, -0.5).share);
    out[id] = { n: front.n, front: +(100 * front.share).toFixed(1), quarter: +(100 * quarter).toFixed(1) };
    assert.ok(front.n > 12, `${id}: wears a chest piece`);
    assert.ok(front.share < 0.1, `${id}: from the front, ${(100 * front.share).toFixed(1)} % behind the cloak`);
    // (three-quarters, the near edge of the cloak crosses the hips: the sheets' pieces, Bako's bag and Nour's
    //  gourds, stay mostly in sight; the keepers' fringe and keys, drawn for no sheet, go under it at the side)
    if (SHEET.includes(id)) assert.ok(quarter < 0.25, `${id}: three-quarters, ${(100 * quarter).toFixed(1)} % behind the cloak`);
    npc.cape?.dispose(scene);
  }
  console.log('  chest pieces behind the cloak (%):', JSON.stringify(out));
});

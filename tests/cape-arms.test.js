import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// "Hands and arms poke through capes on several people." The cloth only kept out of the arms by the nearest
// way out of each collider: the cape fell from the collar inside the arms and stayed there (Bako's and the
// Speaker's arms lay over their cloaks), and a hand had no collider at all (Nour's hung on the outside of
// hers). Now the hands are colliders, and the forearms and hands lift the cloth out over them (cape.js OVER).
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { Cape, OVER, resetDrapes } = await import('../src/cape.js');
const { CAPSULES, CAPE_OVER } = await import('../src/humanoid.js');
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');
const { PEOPLE } = await import('../src/story/desert-data.js');
const { loadAssets } = await import('./gait-sim.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);

test('the hands are colliders, and the forearms and hands the cloth goes over', () => {
  for (const s of ['l', 'r']) assert.ok(CAPSULES.some(([a, b]) => a === `hand_${s}` && /middle/.test(b)), `hand_${s}`);
  assert.ok(CAPE_OVER.test('lowerarm_l') && CAPE_OVER.test('hand_r') && !CAPE_OVER.test('thigh_l') && !CAPE_OVER.test('spine_03'));
  assert.ok(OVER.reach > 0.05 && OVER.reach < 0.2);
});

test('cloth between an arm and the body goes out over the arm, not under it', () => {
  const scene = new THREE.Scene(), anchor = new THREE.Object3D();
  anchor.position.y = 0.75; scene.add(anchor); scene.updateMatrixWorld(true);
  // a narrow cape round a trunk, a forearm hanging beside it a little out from the hip (its cone starts inside the arm)
  const trunk = { a: V(0, 0.9, 0), b: V(0, 1.4, 0), r: 0.17 };
  const arm = (over) => ({ a: V(0.3, 1.15, 0), b: V(0.32, 0.85, 0.02), r: 0.05, over });
  const lie = (over) => {
    resetDrapes();
    const cape = new Cape(scene, anchor, { cols: 10, rows: 8, length: 1.3, bottom: 0.3 });
    const s = { up: V(0, 1, 0), vel: V(), wind: V(), floor: V(), capsules: [trunk, arm(over)] };
    cape.reset();
    for (let k = 0; k < 120; k++) cape.update(1 / 60, s);
    // the cloth at the arm's height and angle: inside the arm's line from the body, or outside it
    let inside = 0, outside = 0;
    for (let i = 0; i < cape.p.length; i += 3) {
      const x = cape.p[i], y = cape.p[i + 1], z = cape.p[i + 2];
      if (y < 0.85 || y > 1.15 || Math.abs(Math.atan2(z, x)) > 0.35) continue;
      if (Math.hypot(x, z) < 0.3) inside++; else outside++;
    }
    cape.dispose(scene);
    return { inside, outside };
  };
  const under = lie(false), over = lie(true);
  assert.ok(under.inside > 0, `a plain collider leaves the cloth inside the arm (${JSON.stringify(under)})`);
  assert.equal(over.inside, 0, `over the arm (${JSON.stringify(over)})`);
  assert.ok(over.outside > 0);
});

test('standing about, the desert’s cloaked people keep their hands and forearms under the cloak (Quaternius bodies; the studio measures MakeHuman ones walking and talking)', async () => {
  resetDrapes();
  const { lib, human } = await loadAssets();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2)));
  scene.updateMatrixWorld(true);
  const physics = new Physics(scene);
  // (you stand 10 m off, past their greeting: a greeting's wave brings the arm out of the cloak, src/wave.js)
  const player = { pos: V(0, 0, 10), vel: V(), riding: false, ride: null, wind: V() }, camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 4);
  const out = {};
  for (const id of ['bako', 'speaker', 'nour', 'hessa']) {
    const def = PEOPLE[id];
    const npc = new NPC(scene, physics, { route: [V(0, 0, 0)], def, kind: def.kind, cape: def.cape, palette: def.palette, head: def.head, look: def.look, world: 'desert', lines: def.lines, lib, human: human[def.kind] });
    npc.heading = 0;
    let poke = 0, n = 0;
    for (let f = 0; f < 150; f++) {
      npc.update(1 / 60, player, camera);
      if (f < 60 || f % 15) continue;
      const H = npc.humanoid, body = H.body, cape = npc.cape, g = body.geometry;
      const P = g.attributes.position, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
      const want = new Set(body.skeleton.bones.map((b, i) => (/^(hand|lowerarm|thumb|index|middle|ring|pinky)/.test(b.name) ? i : -1)).filter((i) => i >= 0));
      H.char.root.updateMatrixWorld(true); cape.mesh.updateMatrixWorld(true);
      const pts = []; for (let i = 0; i < cape.p.length; i += 3) pts.push(V(cape.p[i], cape.p[i + 1], cape.p[i + 2]).applyMatrix4(cape.mesh.matrixWorld));
      const tris = []; const ix = cape.geo.index.array; for (let i = 0; i < ix.length; i += 3) tris.push(new THREE.Triangle(pts[ix[i]], pts[ix[i + 1]], pts[ix[i + 2]]));
      const pel = H.b.pelvis.getWorldPosition(V()), neck = H.b.neck_01.getWorldPosition(V()), ax = V().subVectors(neck, pel);
      const ray = new THREE.Ray(), hit = V();
      for (let i = 0; i < P.count; i += 5) {
        let w = 0; for (let k = 0; k < 4; k++) if (want.has(J.getComponent(i, k))) w += W.getComponent(i, k);
        if (w < 0.6) continue;
        const v = V().fromBufferAttribute(P, i); body.applyBoneTransform(i, v); v.applyMatrix4(body.matrixWorld);
        if (v.y > neck.y) continue;
        const t = THREE.MathUtils.clamp(V().subVectors(v, pel).dot(ax) / ax.lengthSq(), 0, 1), o = pel.clone().addScaledVector(ax, t);
        const len = v.distanceTo(o); ray.set(o, V().subVectors(v, o).normalize());
        n++;
        if (tris.some((tr) => ray.intersectTriangle(tr.a, tr.b, tr.c, false, hit) && hit.distanceTo(o) < len - 0.005 && hit.distanceTo(o) > 0.01)) poke++;
      }
    }
    out[id] = +(100 * poke / Math.max(n, 1)).toFixed(1);
    npc.cape?.dispose(scene);
  }
  console.log('  out through the cloak (% of hand and forearm points):', JSON.stringify(out));
  for (const [id, v] of Object.entries(out)) assert.ok(v < 3, `${id}: ${v} %`);
});

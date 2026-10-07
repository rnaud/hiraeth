import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// The rest of what the desert's character sheets draw (references/The Desert/characters, docs/makehuman.md):
// Nour's gourds, keys and pierced disc staff, Marrow's salvage bag and pack, the bells on Sefa's hem and her
// oud's tassels, the Speaker's streamers; and the oud kept out of her cloak as she walks.
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };

const { BODIES, PROPS, BACKS, BODY_IDS, PROP_IDS, BODY_ID_LIMIT, PROP_BULK, FIXED, dressFor, namedLook, lookPieces, packDress, unpackDress, silhouette } = await import('../src/costumes.js');
const { PROP_GRIPS } = await import('../src/hands.js');
const { Cape, BELLS, resetDrapes } = await import('../src/cape.js');
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');
const { PEOPLE } = await import('../src/story/desert-data.js');
const { mulberry32 } = await import('../src/noise.js');
const { loadAssets } = await import('./gait-sim.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const finite = (g) => { const P = g.attributes.position; for (let i = 0; i < P.count; i++) if (!Number.isFinite(P.getX(i) + P.getY(i) + P.getZ(i))) return false; return P.count > 0; };
const look = (id) => { const d = PEOPLE[id]; return namedLook({ world: 'desert', id, palette: d.palette ?? {}, head: d.head ?? null, cape: d.cape ?? null, look: d.look ?? {}, kind: d.kind }); };
const box = (list) => { const b = new THREE.Box3(); for (const pc of list) { pc.geo.computeBoundingBox(); b.union(pc.geo.boundingBox); } return b; };

test('the new pieces build at every quality, have their ids and grips, and the crowd shader still reads them back', () => {
  for (const id of ['gourds', 'scavbag']) assert.ok(BODIES[id] && BODY_IDS.includes(id), id);
  assert.ok(PROPS.discstaff && PROP_IDS.includes('discstaff'));
  assert.equal(PROP_GRIPS.discstaff, 'grip');
  assert.ok(BODY_IDS.length <= BODY_ID_LIMIT);
  assert.ok(FIXED.clay, 'the gourds’ clay is a fixed colour (a palette accent would have shifted the look’s random draws)');
  for (const q of [1, 0.55, 0.3]) for (const [body, prop] of [['gourds', 'discstaff'], ['scavbag', 'oud'], ['scavbag', 'bellstaff']]) {
    const s = dressFor('desert', mulberry32(4), { kind: 'f', look: { head: 'sunhat', body, prop, mask: 'none' } });
    for (const [where, list] of Object.entries(lookPieces(s, q))) for (const pc of list) assert.ok(finite(pc.geo), `${body}/${prop} q${q} ${where}`);
    const d = packDress(s);
    assert.deepEqual(unpackDress(d.dress, d.w), silhouette(s));
  }
});

test('the people carry what their sheets draw', () => {
  const nour = look('nour'), marrow = look('marrow'), sefa = look('sefa');
  assert.equal(nour.prop, 'discstaff'); assert.equal(nour.body, 'gourds');
  assert.equal(marrow.body, 'scavbag'); assert.equal(marrow.prop, 'hook');
  // his sheet draws a long patched coat, not a cloak: no cape over his pack (it hid every piece he wears)
  assert.equal(marrow.capeLen, 0); assert.ok(marrow.robe > 0); assert.equal(marrow.trim, 'patches');
  assert.equal(sefa.capeBells, 10);
  // the gourds hang at the belt, in front, where the cloak's opening shows them
  const g = box(BODIES.gourds(1));
  assert.ok(g.min.y > 0.1 && g.max.y < 0.36 && g.max.z > 0.15, `gourds at the belt: ${g.min.y.toFixed(2)}..${g.max.y.toFixed(2)}`);
  // Marrow's bag at his left hip in front, his pack on his back (the back slot: BACKS.pack)
  const kit = BODIES.scavbag(1);
  for (const pc of kit) pc.geo.computeBoundingBox();
  assert.ok(kit.some((pc) => pc.role === 'hat' && pc.geo.boundingBox.min.x > 0.05 && pc.geo.boundingBox.min.z > 0.1), 'a bag at the left hip, in front');
  assert.equal(marrow.back, 'pack');
  const back = box(BACKS.pack(1));
  assert.ok(!back.isEmpty() && back.max.z < 0 && back.min.y > 0.2, 'a pack behind');
  // the disc at the staff's head, above the hand; the streamers under the bell's arm; the oud's tassels
  const disc = box(PROPS.discstaff(1).filter((pc) => pc.role === 'hat'));
  assert.ok(disc.min.y > 0.9 && disc.max.x - disc.min.x > 0.14, 'a pierced disc at its head');
  assert.ok(PROPS.bellstaff(1).length >= PROPS.staff(1).length + PROPS.bell(1).length + 5, 'streamers on the bell staff');
  assert.ok(PROPS.oud(1).length > 9, 'tassels on the oud');
});

test('a cape’s bells hang from its hem, simulated and hung alike', () => {
  resetDrapes();
  const scene = new THREE.Scene(), root = new THREE.Object3D(), anchor = new THREE.Object3D();
  anchor.position.y = 0.75; root.add(anchor); scene.add(root); root.updateMatrixWorld(true);
  const cape = new Cape(scene, anchor, { cols: 10, rows: 8, length: 1.2, bottom: 0.45, bells: 10 });
  const plain = new Cape(scene, anchor, { cols: 10, rows: 8, length: 1.2, bottom: 0.45 });
  assert.equal(plain.bells, null, 'no bells unless asked');
  assert.ok(cape.bells && cape.bells.parent === cape.mesh, 'one mesh, carried by the cape’s');
  const caps = [{ a: V(0, 0.95, 0), b: V(0, 1.4, 0), r: 0.2 }];
  const s = { up: V(0, 1, 0), vel: V(), wind: V(), floor: V(), capsules: caps };
  cape.bake(s, { force: true });
  cape.reset();
  for (let k = 0; k < 30; k++) cape.update(1 / 30, s);
  const near = () => {
    // every bell vertex within a bell's length of its hem point, and the bells below the hem's row above
    const P = cape.bells.geometry.attributes.position.array, at = cape.bells.userData.at, per = P.length / at.length;
    let worst = 0;
    at.forEach((i, b) => {
      for (let v = b * per; v < (b + 1) * per; v += 3) worst = Math.max(worst, Math.hypot(P[v] - cape.p[i * 3], P[v + 1] - cape.p[i * 3 + 1], P[v + 2] - cape.p[i * 3 + 2]));
    });
    return worst;
  };
  assert.equal(cape.bells.userData.at.length, 10);
  assert.ok(cape.bells.userData.at.every((i) => i >= 7 * 10), 'all on the hem’s row');
  assert.ok(near() < BELLS.size * 2.5, `simulated: on the hem (${near().toFixed(3)} m)`);
  // walking off: it hangs from the anchor in its drape, the bells with it
  root.position.set(30, 0, -12); root.rotation.y = 1.1; root.updateMatrixWorld(true);
  assert.ok(cape.hang());
  root.updateMatrixWorld(true);
  assert.ok(near() < BELLS.size * 2.5, `hung: on the hem (${near().toFixed(3)} m)`);
  const w = V().fromArray(cape.bells.geometry.attributes.position.array).applyMatrix4(cape.bells.matrixWorld);
  assert.ok(w.distanceTo(V(30, 0, -12)) < 1.5, 'and carried with the body');
  cape.dispose(scene); plain.dispose(scene);
});

test('a look’s bells draw nothing from its random stream: everyone else looks as they did', () => {
  const a = dressFor('desert', mulberry32(11), { kind: 'f', look: { head: 'hood' } });
  const b = dressFor('desert', mulberry32(11), { kind: 'f', look: { head: 'hood', capeBells: 8 } });
  assert.equal(b.capeBells, 8); assert.equal(a.capeBells, 0);
  for (const k of ['cloak', 'cloth', 'capeLen', 'capeWide', 'height', 'build', 'eyes', 'flare']) assert.equal(a[k], b[k], k);
});

test('Sefa’s oud pushes her cloak aside: its bowl and neck are cloth colliders in her hand', async () => {
  resetDrapes();
  const { lib, human } = await loadAssets();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2)));
  scene.updateMatrixWorld(true);
  const physics = new Physics(scene);
  const mk = (def) => new NPC(scene, physics, { route: [V(0, 0, 0)], def, kind: def.kind, cape: def.cape, palette: def.palette, head: def.head, look: def.look, world: 'desert', lines: def.lines, lib, human: human[def.kind] });
  const sefa = mk(PEOPLE.sefa), nour = mk(PEOPLE.nour);
  const player = { pos: V(0, 0, 6), vel: V(), riding: false, ride: null, wind: V() }, camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 5);
  for (let f = 0; f < 30; f++) { sefa.update(1 / 60, player, camera); nour.update(1 / 60, player, camera); }
  const H = sefa.humanoid, caps = H.capsules(), extra = PROP_BULK.oud.length;
  assert.equal(caps.length, nour.humanoid.capsules().length + extra, 'the oud’s capsules, besides the body’s');
  // they sit on the oud: its bowl's vertices (rigid on the hand) inside them
  const hand = H.b.hand_r.getWorldPosition(V());
  const props = H.propCapsules();
  for (const { cap } of props) assert.ok(cap.a.distanceTo(hand) < 0.6 && cap.b.distanceTo(hand) < 0.7, 'in the hand');
  const seg = (p, { a, b }) => { const ab = V().subVectors(b, a); const t = THREE.MathUtils.clamp(V().subVectors(p, a).dot(ab) / ab.lengthSq(), 0, 1); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
  let inside = 0, n = 0;
  H.char.root.updateMatrixWorld(true);
  H.char.root.traverse((o) => {
    if (!o.isSkinnedMesh || o === H.body) return;
    const P = o.geometry.attributes.position, J = o.geometry.attributes.skinIndex, W = o.geometry.attributes.skinWeight, hi = o.skeleton.bones.indexOf(H.b.hand_r);
    for (let i = 0; i < P.count; i++) {
      if (J.getX(i) !== hi || W.getX(i) < 0.99) continue;
      const v = V().fromBufferAttribute(P, i); o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld);
      n++; if (props.some(({ cap }) => seg(v, cap) <= cap.r)) inside++;
    }
  });
  assert.ok(n > 100 && inside / n > 0.85, `the oud inside its colliders: ${inside} of ${n}`);
  // its drape is its own (a cape baked round an oud is not shared with one baked without)
  assert.match(sefa.drapeKey(0), /~oud/);
  assert.doesNotMatch(nour.drapeKey(0), /~oud/);
  // and the cloth keeps off them
  const cape = sefa.cape;
  for (let f = 0; f < 60; f++) sefa.update(1 / 60, player, camera);
  let into = 0;
  for (let i = 0; i < cape.p.length; i += 3) { const q = V(cape.p[i], cape.p[i + 1], cape.p[i + 2]); if (cape.hung) q.applyMatrix4(cape.mesh.matrixWorld); if (props.some(({ cap }) => seg(q, cap) < cap.r - 0.01)) into++; }
  assert.equal(into, 0, 'no cloth point inside the oud');
});

// A second carried slot (costumes.js BACKS, look.back) and leg pieces (SHINS, look.shins): Sefa's oud slung on
// her back while she walks (look.stow: the held one while she stands), Marrow's pack and his wrapped shins.
test('a stowed prop goes on the back while walking: the meshes swap, the hand lets go, the colliders follow', async () => {
  resetDrapes();
  const { npcHands } = await import('../src/hands.js');
  const { STOW_AT } = await import('../src/npc.js');
  const { BACK_BULK } = await import('../src/costumes.js');
  const { lib, human } = await loadAssets();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2)));
  scene.updateMatrixWorld(true);
  const def = PEOPLE.sefa;
  const npc = new NPC(scene, new Physics(scene), { route: [V(0, 0, 0)], def, kind: def.kind, cape: def.cape, palette: def.palette, head: def.head, look: def.look, world: 'desert', lines: def.lines, lib, human: human[def.kind] });
  const H = npc.humanoid;
  assert.equal(look('sefa').back, 'oud'); assert.ok(look('sefa').stow);
  assert.ok(H._held && H._slung, 'the held and the slung oud, each its own mesh');
  assert.ok(STOW_AT > 0.1 && STOW_AT < 0.6);
  const standing = H.capsules().length;
  assert.ok(H._held.visible && !H._slung.visible && npcHands(npc).prop === 'oud', 'standing: in hand');
  H.stow(true);
  assert.ok(!H._held.visible && H._slung.visible, 'walking: on the back');
  assert.equal(npcHands(npc).prop, null, 'and the hand lets go');
  assert.equal(H.capsules().length, standing - PROP_BULK.oud.length + BACK_BULK.oud.length, 'the cloth now goes under the slung oud, not round the held one');
  assert.ok(H.capsules().slice(-BACK_BULK.oud.length).every((c) => c.under));
  // the slung oud on her back: behind the body, its neck up by the shoulder
  H.char.root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(H._slung, true), chest = H.b.spine_03.getWorldPosition(V());
  assert.ok(b.min.z < chest.z - 0.2 && b.max.z < chest.z + 0.25, `behind her (${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)})`);
  assert.ok(b.max.y > H.b.neck_01.getWorldPosition(V()).y - 0.05, 'the neck up by the shoulder');
  H.stow(false);
  assert.ok(H._held.visible && !H._slung.visible && H.capsules().length === standing);
});

test('Marrow carries his pack on his back and wears his shins wrapped, the wraps following his legs', async () => {
  const { lib, human } = await loadAssets();
  const { SHINS, SHIN_IDS, BACK_IDS } = await import('../src/costumes.js');
  assert.ok(SHIN_IDS.includes('wraps') && BACK_IDS.includes('pack') && BACK_IDS.includes('oud'));
  const m = look('marrow');
  assert.equal(m.back, 'pack'); assert.equal(m.shins, 'wraps'); assert.ok(!m.stow);
  for (const q of [1, 0.55]) for (const pc of SHINS.wraps(q, { len: 0.42, r: 0.05 })) assert.ok(finite(pc.geo));
  // the wraps on his body: rigid on each calf bone
  const scene = new THREE.Scene(), def = PEOPLE.marrow;
  const npc = new NPC(scene, new Physics(scene), { route: [V(0, 0, 0)], def, kind: def.kind, cape: def.cape, palette: def.palette, head: def.head, look: def.look, world: 'desert', lines: def.lines, lib, human: human[def.kind] });
  const H = npc.humanoid, mesh = H._costume[0], bones = mesh.skeleton.bones;
  const J = mesh.geometry.attributes.skinIndex, W = mesh.geometry.attributes.skinWeight, C = mesh.geometry.attributes.color;
  const linen = new THREE.Color(FIXED.linen);
  const on = { l: 0, r: 0 };
  let k = -1;
  for (let i = 0; i < J.count; i++) {
    if (Math.abs(C.getX(i) - linen.r) > 1e-3 || Math.abs(C.getY(i) - linen.g) > 1e-3 || Math.abs(C.getZ(i) - linen.b) > 1e-3) continue;
    const name = bones[J.getX(i)]?.name;
    assert.ok(/^calf_[lr]$/.test(name) && W.getX(i) > 0.99, `a wrap's vertex on ${name}`);
    on[name.slice(-1)]++;
    if (k < 0 && name === 'calf_l') k = i;
  }
  assert.ok(on.l > 50 && on.r > 50, `both shins wrapped: ${JSON.stringify(on)}`);
  // bending the knee moves the wraps with the shin
  H.char.root.updateMatrixWorld(true);
  const P = mesh.geometry.attributes.position, before = V(), after = V();
  mesh.applyBoneTransform(k, before.fromBufferAttribute(P, k));
  H.b.calf_l.rotation.x += 0.9; H.char.root.updateMatrixWorld(true);
  mesh.applyBoneTransform(k, after.fromBufferAttribute(P, k));
  assert.ok(before.distanceTo(after) > 0.05, `the wrap moves with the shin (${before.distanceTo(after).toFixed(3)} m)`);
});

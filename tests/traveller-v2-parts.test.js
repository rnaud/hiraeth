// The v2 traveller's last four parts before the switch (issue #493; src/characters/traveller-v2.js): his shirt moves
// like cloth (traveller-v2-cloth.js: B3's solver on its hem and back, the thigh-lift keys kept), the fluid glove trims
// his hand (and any sleeve or glove of the outfit) under it, his far levels cost no more than B3's, and the build
// carries his models (scripts/traveller-v2-ship.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { readFileSync } from 'node:fs';
const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { Player, buildCharacter } = await import('../src/player.js');
const { Physics } = await import('../src/physics.js');
const { Animator, libraryFrom, sprintFrom } = await import('../src/animator.js');
const { createTraveller } = await import('../src/characters/traveller.js');
const { travellerB3 } = await import('./gait-sim.js');
const { course, CAM_PLUS_Z } = await import('../src/gait-course.js');
const { bindParts, dressTravellerV2 } = await import('../src/characters/traveller-v2.js');
const { makeV2Cloth, V2_CLOTH } = await import('../src/characters/traveller-v2-cloth.js');
const { buildTravellerLod } = await import('../src/characters/traveller-lod.js');
const { garmentDepthMaterial } = await import('../src/characters/tripo-cloth.js');
const { shippedFiles, shippedBytes, UNSHIPPED_NODES } = await import('../scripts/traveller-v2-ship.mjs');

const DIR = 'data/characters/traveller-v2/';
const manifest = JSON.parse(readFileSync(DIR + 'manifest.json', 'utf8'));
const list = JSON.parse(readFileSync(DIR + 'outfits.json', 'utf8'));
/** A GLB parsed as the game's GLTFLoader reads it (its pictures left out: node has no image decoder). */
async function glb(path) { return glbOf(readFileSync(path)); }
async function glbOf(g) {
  const n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
  json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials ?? []) { delete m.pbrMetallicRoughness?.baseColorTexture; delete m.normalTexture; delete m.emissiveTexture; }
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const parse = (file) => { const b = readFileSync(file); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
const [assets, lib, baseGltf] = await Promise.all([travellerB3(), parse('public/anim/ual.glb').then(libraryFrom), glb(DIR + 'traveller.glb')]);
const outfit = async (id) => { const m = JSON.parse(readFileSync(DIR + `outfits/${id}/manifest.json`, 'utf8')); return { id, manifest: m, gltf: await glb(DIR + `outfits/${id}/${m.glb}`) }; };
const sources = (worn = { id: 'default' }) => ({ root: DIR, list, baseManifest: manifest, baseGltf, outfit: worn });

/** The game's traveller standing at the origin facing +z, dressed as v2 (the cloth on, as in a page). */
function traveller({ v2 = true, cloth = true } = {}) {
  const scene = course(), physics = new Physics(scene);
  const p = new Player(physics, { climb: false, health: false });
  p.animator = new Animator(lib, p.char);
  p.character = createTraveller(p.char, assets, { gpu: false, useWorker: false });
  if (v2) dressTravellerV2(p.character, sources(), { cloth });
  p.humanoid = p.character.humanoid;
  p.gear = { update() {}, device: { visible: true } };
  p._lastVel = new T.Vector3();
  p.pos.set(0, physics.groundAt(0, 5, 0), 0); p.heading = 0; p.vel.set(0, 0, 0); p.onGround = true; p.lastSafe.copy(p.pos);
  scene.add(p.object);
  return p;
}

test('his shirt moves like cloth: free below the chest only, swinging at a jog and a sprint, settling at rest', { timeout: 300000 }, () => {
  const p = traveller(), state = p.character.v2State, cloth = state.cloth, clothes = state.meshes[1];
  assert.ok(cloth, 'the default\'s shirt has its cloth');
  const [start, count] = p.character.v2.wardrobe.worn.ranges[V2_CLOTH.garment];
  const P = clothes.geometry.attributes.position;
  let free = 0;
  for (let i = 0; i < cloth.free.length; i++) {
    if (!(cloth.free[i] > 0)) continue;
    free++;
    assert.ok(i >= start && i < start + count, `vertex ${i} free outside the shirt`);
    assert.ok(P.getY(i) < V2_CLOTH.top && Math.abs(P.getX(i)) < V2_CLOTH.maxX, 'free only below the chest, not the sleeves');
  }
  assert.ok(free > count * 0.3, `the hem and back free (${free} of the shirt's ${count})`);
  // B3's overshirt put away: neither drawn nor stepped; v2's stepped by Player.updateCloth
  assert.equal(p.character.cloth.garment.visible, false);
  const dt = 1 / 60, at = {}, lifts = { thighLift_l: 0, thighLift_r: 0 }, lift = clothes.userData.thighLift;
  for (let i = 0; i < 9 * 60; i++) {
    const phase = i < 60 ? 'idle' : i < 3 * 60 ? 'jog' : i < 5 * 60 ? 'sprint' : 'stop';
    p.update(dt, phase === 'jog' ? { KeyW: true } : phase === 'sprint' ? { KeyW: true, ShiftLeft: true } : {}, CAM_PLUS_Z);
    const s = cloth.swing();
    if (phase === 'idle' && i < 30) continue;   // (the first half second: the cage drops from its targets)
    const k = phase + (phase === 'stop' && i > 7 * 60 ? '-late' : '');
    at[k] = { max: Math.max(at[k]?.max ?? 0, s.max), mean: Math.max(at[k]?.mean ?? 0, s.mean) };
    if (phase !== 'idle' && phase !== 'stop') for (const [key, v] of Object.entries(lift.update())) lifts[key] = Math.max(lifts[key], v);
  }
  const cm = (x) => `${(x * 100).toFixed(1)} cm`;
  const say = Object.entries(at).map(([k, v]) => `${k} ${cm(v.mean)} (most ${cm(v.max)})`).join(', ');
  assert.ok(at.jog.mean > at.idle.mean * 2 && at.sprint.mean > at.idle.mean * 3, `the hem swings out running: ${say}`);
  assert.ok(at.sprint.mean > 0.03, `a sprint swings it several cm: ${say}`);
  assert.ok(at['stop-late'].mean < at.idle.mean * 1.5, `it settles stopped: ${say}`);
  // the thigh-lift keys stay on with it: lifted running, and the shader carries the keyed shape
  assert.ok(lifts.thighLift_l > 0.3 && lifts.thighLift_r > 0.3, `the keys lift running: ${JSON.stringify(lifts)}`);
});

test('the shader moves the shirt: its material patched with the keys applied, its shadow drawn the same shape', () => {
  const p = traveller({ cloth: false }), clothes = p.character.v2State.meshes[1];
  assert.equal(p.character.v2State.cloth, null, 'no cloth asked: none');
  const cloth = makeV2Cloth(clothes, p.character.v2.wardrobe.worn.ranges.Shirt, { gpu: true, useWorker: false });
  const m = clothes.material;
  assert.ok(m.defines.GARMENT && m.vertexShader.includes('vec3 garmentRest = transformed;'), 'the rest shape with its shape keys');
  assert.ok(m.vertexShader.indexOf('garmentRest = transformed') < m.vertexShader.indexOf('#include <skinbase_vertex>'), 'taken before skinning');
  assert.ok(cloth.shadow.material.vertexShader.includes('#include <morphtarget_vertex>'), 'the shadow keyed too');
  assert.equal(cloth.shadow.morphTargetInfluences, clothes.morphTargetInfluences, 'one set of keys');
  // only the shirt below the chest has a cell; the tee, trousers, boots and scarf are skinned as before
  const C = clothes.geometry.attributes.aCage, [start, count] = p.character.v2.wardrobe.worn.ranges.Shirt;
  for (let i = 0; i < C.count; i += 7) if (C.getW(i) > 0) assert.ok(i >= start && i < start + count);
  p.object.updateMatrixWorld(true);
  cloth.update(1 / 60, 'game', true);
  const u = m.uniforms, S = cloth.gpuState;
  assert.equal(u.uClothP.value, S.P);
  assert.equal(u.uGarmentSim.value, 1);
  for (let i = 0; i < 40; i++) assert.equal(S.P.image.data[i * 4 + 1], Math.fround(cloth.sim.P[i * 3 + 1]));
  assert.ok(u.uGarmentCapA.value.every((v) => v.w === 0), 'the shader\'s own leg push off, as B3\'s (detailCollisions: false)');
  // B3's garment shader as it was: its rest is the bare position
  const b3 = garmentDepthMaterial(32);
  assert.ok(b3.vertexShader.includes('vec3 restP = position;') && b3.vertexShader.includes('uGarmentRigid * vec4(restP, 1.0)') && !b3.vertexShader.includes('morphtarget'));
  assert.equal(b3.uniforms.uGarmentHang.value.z, 0, 'B3\'s hangs from its attachment alone');
  // (v2's hangs from its skin low down: issue #709)
  assert.deepEqual(u.uGarmentHang.value.toArray(), [V2_CLOTH.hang[0], V2_CLOTH.hang[1], 1]);
  assert.ok(m.vertexShader.includes('float skinW = max(sk, hang)') && m.vertexShader.includes('normalize(carry * aOutward)'));
  cloth.dispose();
});

test('hunched into his sprint the shirt stays over his back and his seat (issue #709)', { timeout: 300000 }, async () => {
  const p = traveller(), cloth = p.character.v2State.cloth;
  const kev = await parse('public/anim/sprint-kevin.glb');
  p.animator.useSprint(sprintFrom(kev, 'kevin'));
  const N = cloth.rest.length, COLS = cloth.cols;
  // (hung low: the hem's rows on the shirt's own skin, the chest's on spine_02)
  assert.equal(cloth.hangs[0], 0);
  assert.equal(cloth.hangs[N - 1], 1);
  let deepest = 0, highest = 0, turned = 0, sprinted = 0;
  const dt = 1 / 60, P = cloth.sim.P, G = cloth.simTarget, out = cloth.posedOut, rest = cloth.outwards;
  for (let i = 0; i < 5 * 60; i++) {
    p.update(dt, i < 60 ? {} : { KeyW: true, ShiftLeft: true }, CAM_PLUS_Z);
    if (i < 2 * 60) continue;
    if (p.animator.w.sprint > 0.9) sprinted++;
    for (let j = COLS + 1; j < N; j++) {
      const r = cloth.rest[j];
      if (r.z > 0) continue;   // (his back half)
      const k = j * 3, d = [P[k] - G[k], P[k + 1] - G[k + 1], P[k + 2] - G[k + 2]];
      // how far behind its target along its side of him as posed (his back bent forward: no longer level)
      deepest = Math.max(deepest, -(d[0] * out[k] + d[1] * out[k + 1] + d[2] * out[k + 2]));
      turned = Math.max(turned, Math.acos(Math.min(1, out[k] * rest[k] + out[k + 1] * rest[k + 1] + out[k + 2] * rest[k + 2])));
      if (cloth.sim.lift[j] < 1) { const up = cloth.sim.up; highest = Math.max(highest, d[0] * up[0] + d[1] * up[1] + d[2] * up[2]); }
    }
  }
  assert.ok(sprinted > 60, `his sprint (${sprinted} frames)`);
  assert.ok(turned > 0.25, `his back's side turned with him: ${(turned * 180 / Math.PI).toFixed(0)}°`);
  assert.ok(deepest <= V2_CLOTH.inward + 1e-3, `no deeper into his back than ${V2_CLOTH.inward * 1000} mm: ${(deepest * 1000).toFixed(1)} mm`);
  assert.ok(highest <= V2_CLOTH.lift + 1e-3, `the back hem no higher off his seat than ${V2_CLOTH.lift * 1000} mm: ${(highest * 1000).toFixed(1)} mm`);
});

test('the fluid glove trims his hand under it, and an outfit\'s sleeve or glove, in every outfit', async () => {
  const p = traveller({ cloth: false }), h = p.humanoid, v2 = p.character.v2;
  const lamp = await outfit('lamplighter');
  v2.put('lamplighter', lamp.manifest, bindParts(lamp.gltf, h.body.skeleton.bones));
  const covered = (m) => { const P = m.geometry.attributes.position, I = m.geometry.index.array, v = new T.Vector3(); let k = 0; for (let i = 0; i < I.length; i += 3) if ([0, 1, 2].every((d) => h.glove.covers(v.fromBufferAttribute(P, I[i + d])))) k++; return k; };
  const tris = (m) => m.geometry.index.count / 3;
  for (const id of ['default', 'lamplighter']) {
    v2.wardrobe.wear(id);
    const meshes = p.character.v2State.meshes;
    assert.deepEqual(h.glove.skins.slice(-2), meshes, `${id}: his body and clothes trimmed with the glove`);
    const bare = meshes.map(tris), under = meshes.map(covered);
    assert.ok(under[0] + under[1] > 100, `${id}: his hand (or the outfit's glove) is under it (${under} triangles)`);
    h.glove.show(true);
    assert.deepEqual(meshes.map(covered), [0, 0], `${id}: nothing under the glove drawn`);
    assert.ok(tris(meshes[0]) + tris(meshes[1]) < bare[0] + bare[1], `${id}: the hand left out`);
    h.glove.show(false);
    assert.deepEqual(meshes.map(tris), bare, `${id}: bare again`);
  }
  assert.ok(covered(p.character.v2State.meshes[1]) > 0, 'the lamplighter\'s right glove lies under it');
  // worn while he changes: the new outfit comes on trimmed
  h.glove.show(true);
  v2.wardrobe.wear('default');
  assert.deepEqual(p.character.v2State.meshes.map(covered), [0, 0]);
  assert.ok(!h.glove.skins.some((m) => !m.parent && m !== p.character.mesh), 'the old outfit\'s meshes let go');
});

test('his far levels: v2\'s body and clothes, no more triangles or draws far off than B3\'s, following his outfit', async () => {
  await MeshoptSimplifier.ready;
  const b3 = createTraveller(buildCharacter(), assets, { gpu: false, useWorker: false });
  const v2 = createTraveller(buildCharacter(), { ...assets, v2: sources() });
  assert.ok(v2.v2 && v2.mesh.visible === false, 'createTraveller dresses him as v2 from the assets');
  const [L3, L2] = await Promise.all([buildTravellerLod(b3, { simplifier: MeshoptSimplifier }), buildTravellerLod(v2, { simplifier: MeshoptSimplifier })]);
  v2.lod = L2;
  assert.deepEqual(L2.entries.map((e) => e.mesh.name).sort(), ['TravellerPortraitHead', 'TravellerV2.body', 'TravellerV2.clothes']);
  const clothesLevels = [...L2.entries.find((e) => e.mesh.name === 'TravellerV2.clothes').byBase.values()][0].levels;
  assert.ok(clothesLevels.length >= 4, `the clothes go down to ${clothesLevels.at(-1).count / 3} triangles`);
  const pxPerRad = 810 / (2 * Math.tan(T.MathUtils.degToRad(55) / 2));
  const tri = (m) => (m?.visible === false || !m ? 0 : (m.geometry.drawRange.count === Infinity ? m.geometry.index.count : m.geometry.drawRange.count) / 3);
  for (const d of [10, 40, 120]) {
    L3.update(d, 1, pxPerRad, 2); L2.update(d, 1, pxPerRad, 2);
    // everything each draws of himself: B3's body, head, overshirt, trousers and inner shirt; v2's body, clothes, head
    const b3Tris = [b3.mesh, b3.head, b3.cloth.garment, b3.cloth.underlayer, b3.cloth.innerShirt].reduce((n, m) => n + tri(m), 0);
    const v2Tris = [...v2.v2State.meshes, v2.head].reduce((n, m) => n + tri(m), 0);
    assert.ok(v2Tris <= b3Tris, `${d} m: v2 ${v2Tris} triangles against B3's ${b3Tris}`);
    assert.ok(v2.v2State.meshes.length + 1 < 5, 'fewer draws');
  }
  // a new outfit: its meshes get their levels, the old ones let go
  const gp = await outfit('glider-pilot');
  v2.v2.put('glider-pilot', gp.manifest, bindParts(gp.gltf, v2.humanoid.body.skeleton.bones));
  v2.v2.wardrobe.wear('glider-pilot');
  await L2.ready();
  assert.ok(L2.entries.some((e) => e.mesh === v2.v2State.meshes[1]) && L2.entries.every((e) => e.mesh.parent), 'the new clothes tracked, the old let go');
});

test('the build carries his models: the base (without the head and hair it never draws) and the fifteen outfits', async () => {
  const files = shippedFiles();
  assert.ok(files.includes(DIR + 'traveller.glb') && files.includes(DIR + 'outfits.json') && files.includes(DIR + 'manifest.json'));
  for (const o of list.outfits.filter((x) => x.dir)) assert.ok(files.some((f) => f.startsWith(DIR + o.dir) && f.endsWith('.glb')), `${o.id} ships`);
  assert.ok(!files.some((f) => /\.blend$|previews\//.test(f)), 'not the .blend nor the previews');
  const mb = files.reduce((n, f) => n + shippedBytes(f).length, 0) / 2 ** 20;
  assert.ok(mb < 40, `${mb.toFixed(1)} MB added to the build`);
  assert.match(readFileSync('vite.config.js', 'utf8'), /travellerV2Plugin\(\)/);
  // the shipped base: every part the game draws as the pipeline wrote it, the head and hair left out
  const raw = readFileSync(DIR + 'traveller.glb'), shipped = shippedBytes(DIR + 'traveller.glb');
  assert.ok(shipped.length < raw.length - 1.5e6, `${(raw.length / 1e6).toFixed(2)} -> ${(shipped.length / 1e6).toFixed(2)} MB`);
  const pruned = await glbOf(shipped);
  const names = [];
  pruned.scene.traverse((o) => { if (o.isSkinnedMesh) names.push(o.name); });
  assert.deepEqual(names.sort(), Object.keys(manifest.parts).filter((n) => !UNSHIPPED_NODES.includes(n)).sort());
  const bones = createTraveller(buildCharacter(), assets, { gpu: false, useWorker: false }).humanoid.body.skeleton.bones;
  const a = bindParts(baseGltf, bones, 'raw'), b = bindParts(pruned, bones, 'shipped');
  for (const n of names) for (const k of ['position', 'skinIndex', 'skinWeight', 'uv']) assert.deepEqual(b[n].geometry.attributes[k].array, a[n].geometry.attributes[k].array, `${n} ${k}`);
  assert.deepEqual(b.Shirt.geometry.morphAttributes.position.map((x) => x.name), a.Shirt.geometry.morphAttributes.position.map((x) => x.name));
});

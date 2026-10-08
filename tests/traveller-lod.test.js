// The traveller's shipped files (scripts/tripo/slim-traveller.mjs) and his levels of detail (src/characters/traveller-lod*.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { readGlb, usedParts, TRAVELLER_FILES, SLIM } from '../scripts/tripo/slim-traveller.mjs';
import { TRAVELLER_LOD, pickTravellerLevel } from '../src/characters/traveller-lod-core.js';
import { buildTravellerLod, combineLevels, TravellerLod } from '../src/characters/traveller-lod.js';
const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { parseBody } = await import('../src/makehuman/body.js');
const { buildCharacter } = await import('../src/player.js');
const { createTravellerV1 } = await import('../src/characters/traveller-v1.js');

const SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
/** an accessor's bytes (tightly packed views, as Tripo's exports and the slim files have) */
const bytesOf = ({ json, bin }, i) => {
  const a = json.accessors[i], v = json.bufferViews[a.bufferView], at = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return bin.subarray(at, at + a.count * N[a.type] * SIZE[a.componentType]);
};
/** a JPEG's width and height (its first start-of-frame marker) */
function jpegSize(b) {
  assert.equal(b.readUInt16BE(0), 0xffd8, 'a JPEG');
  for (let at = 2; at < b.length;) {
    const marker = b.readUInt16BE(at), len = b.readUInt16BE(at + 2);
    if (marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker)) return [b.readUInt16BE(at + 7), b.readUInt16BE(at + 5)];
    at += 2 + len;
  }
  return null;
}

test('the shipped traveller files keep the export\'s geometry byte for byte, and drop what nothing reads', () => {
  for (const [src, dst] of TRAVELLER_FILES) {
    const a = readGlb(readFileSync(src)), b = readGlb(readFileSync(dst));
    assert.deepEqual(b.json.meshes.map((m) => m.primitives.map((p) => Object.keys(p.attributes))), a.json.meshes.map((m) => m.primitives.map((p) => Object.keys(p.attributes))));
    a.json.meshes.forEach((m, mi) => m.primitives.forEach((p, pi) => {
      const q = b.json.meshes[mi].primitives[pi];
      for (const k of Object.keys(p.attributes)) assert.ok(bytesOf(a, p.attributes[k]).equals(bytesOf(b, q.attributes[k])), `${dst} ${k} unchanged`);
      assert.ok(bytesOf(a, p.indices).equals(bytesOf(b, q.indices)), `${dst} indices unchanged`);
    }));
    for (const [si, s] of (a.json.skins ?? []).entries()) {
      assert.deepEqual(b.json.skins[si].joints, s.joints);
      assert.ok(bytesOf(a, s.inverseBindMatrices).equals(bytesOf(b, b.json.skins[si].inverseBindMatrices)), 'inverse binds unchanged');
    }
    assert.deepEqual(b.json.nodes, a.json.nodes, 'the same nodes (the skeleton)');
    // nothing left that nothing reads
    const used = usedParts(b.json);
    assert.equal(used.accessors.size, b.json.accessors.length, `${dst}: every accessor is read`);
    assert.equal(used.images.size, b.json.images.length, `${dst}: every image is a material's`);
    for (const img of b.json.images) {
      const v = b.json.bufferViews[img.bufferView], size = jpegSize(b.bin.subarray(v.byteOffset, v.byteOffset + v.byteLength));
      assert.equal(img.mimeType, 'image/jpeg');
      assert.deepEqual(size, [SLIM.maxTexture, SLIM.maxTexture], `${dst}: the base colour at ${SLIM.maxTexture}²`);
    }
    assert.ok(readFileSync(dst).length < readFileSync(src).length * 0.7, `${dst} is smaller`);
  }
  // the head's untouched export is the one its provenance describes
  const prov = JSON.parse(readFileSync('public/characters/traveller-v1/head-v2/provenance.json'));
  assert.equal(createHash('sha256').update(readFileSync(prov.source_file)).digest('hex'), prov.sha256);
});

// the character as the game makes him, from the shipped files (images left out: Node decodes none)
const dir = 'public/characters/traveller-v1/';
const glb = (f) => {
  const g = readFileSync(f), n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
  json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
  delete json.images; delete json.textures; delete json.materials; for (const m of json.meshes) for (const p of m.primitives) delete p.material;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
};
const b = readFileSync('public/anim/mh/body.bin'), data = parseBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const asset = { gltf: await glb(dir + 'model.glb'), head: await glb(dir + 'head-v2/model.glb'), data, report: JSON.parse(readFileSync(dir + 'rig.json')), colors: JSON.parse(readFileSync(dir + 'colors.json')) };
await MeshoptSimplifier.ready;

test('his levels: coarser index lists over the same vertices, drawn by the draw range', async () => {
  const c = createTravellerV1(buildCharacter(), asset);
  const before = new Map([c.mesh, c.head, c.cloth.garment].map((m) => [m, { index: m.geometry.index, attrs: { ...m.geometry.attributes }, morph: m.geometry.morphAttributes.position }]));
  const lod = await buildTravellerLod(c, { simplifier: MeshoptSimplifier });
  assert.ok(lod instanceof TravellerLod);
  assert.deepEqual(lod.entries.map((e) => e.mesh.name).sort(), ['TravellerOvershirt', 'TravellerTripoHeadV2', 'TravellerV1']);
  for (const e of lod.entries) assert.equal(e.mesh.geometry.index, before.get(e.mesh).index, 'nothing changes until a frame picks a level');
  const pxPerRad = 810 / (2 * Math.tan(T.MathUtils.degToRad(55) / 2));
  // up close (the conversation's shots) always full
  lod.update(2, 1, pxPerRad, 2);
  for (const e of lod.entries) {
    const g = e.mesh.geometry, L = g.userData.travellerLevels, was = before.get(e.mesh);
    assert.equal(g.index.lodBase, was.index, `${e.mesh.name}: its index made from its own`);
    assert.ok(L.length >= 3, `${e.mesh.name}: levels`);
    assert.deepEqual([L[0].start, L[0].count], [0, was.index.count]);
    assert.deepEqual(Array.from(g.index.array.subarray(0, was.index.count)), Array.from(was.index.array), 'the full list first, as it was');
    assert.deepEqual([g.drawRange.start, g.drawRange.count], [0, was.index.count], 'close: full');
    for (const k of Object.keys(was.attrs)) assert.equal(g.attributes[k], was.attrs[k], `${e.mesh.name}: the same ${k}`);
    assert.equal(g.morphAttributes.position, was.morph, 'the same face keys');
    const n = g.attributes.position.count;
    for (let i = 1; i < L.length; i++) {
      assert.ok(L[i].count < L[i - 1].count * TRAVELLER_LOD.keep && L[i].count % 3 === 0);
      assert.ok(L[i].error >= L[i - 1].error && L[i].error <= TRAVELLER_LOD.maxError);
      assert.ok(g.index.array.subarray(L[i].start, L[i].start + L[i].count).every((v) => v < n), 'only the mesh\'s own vertices');
    }
    // the first level halves him for under 2 mm, the coarsest is a sixth or less
    assert.ok(L[1].count <= was.index.count * 0.55 && L[1].error < 0.002, `${e.mesh.name}: ${L[1].count / 3} triangles at ${L[1].error}`);
    assert.ok(L[L.length - 1].count <= was.index.count * 0.15);
  }
  // the overshirt's shadow draws the same geometry, so the same level
  if (c.cloth.shadow) assert.equal(c.cloth.shadow.geometry, c.cloth.garment.geometry);

  // far off at Handheld (lodPx 2) coarse; px 0 full
  lod.update(40, 1, pxPerRad, 2);
  assert.ok(lod.j >= 3 && lod.stats.tris < lod.stats.full * 0.15, `far: ${lod.stats.tris} of ${lod.stats.full}`);
  for (const e of lod.entries) { const g = e.mesh.geometry, l = g.userData.travellerLevels[e.cur]; assert.deepEqual([g.drawRange.start, g.drawRange.count], [l.start, l.count]); }
  lod.update(40, 1, pxPerRad, 0);
  assert.equal(lod.j, -Infinity, 'no levels at a preset without them');
  lod.update(40, 1, pxPerRad, 2); lod.reset();
  for (const e of lod.entries) {
    const g = e.mesh.geometry;
    assert.equal(g.index, before.get(e.mesh).index, 'reset: its own index again');
    assert.deepEqual([g.drawRange.start, g.drawRange.count], [0, Infinity]);
  }

  // the glove (worn with the tank) swaps the body's index for one without the hand under it: that
  // list gets levels of its own, the full one drawn until they are ready, and never an empty draw
  const body = lod.entries.find((e) => e.mesh === c.mesh), g = c.mesh.geometry;
  lod.update(40, 1, pxPerRad, 2);
  c.humanoid.glove.show(true);
  const gloved = g.index;
  assert.ok(!gloved.lodBase && gloved !== before.get(c.mesh).index && gloved.count < before.get(c.mesh).index.count, 'the glove\'s list, made from the bare one');
  lod.update(40, 1, pxPerRad, 2);
  assert.equal(g.index, gloved); assert.deepEqual([g.drawRange.start, g.drawRange.count], [0, Infinity], 'its full list while its levels are made');
  await lod.ready();
  lod.update(40, 1, pxPerRad, 2);
  assert.equal(g.index.lodBase, gloved);
  assert.ok(body.cur >= 3 && g.drawRange.start + g.drawRange.count <= g.index.count && g.drawRange.start >= gloved.count);
  c.humanoid.glove.show(false);
  assert.equal(g.index, before.get(c.mesh).index, 'off: the bare list (not a level index)');
  lod.update(40, 1, pxPerRad, 2);
  assert.equal(g.index.lodBase, before.get(c.mesh).index, 'and its levels straight away (made already)');
});

test('picking a level: within the allowance, never close, and steady at the boundary', () => {
  const levels = [{ error: 0.001 }, { error: 0.003 }, { error: 0.009 }];
  const o = { ...TRAVELLER_LOD, near: 3, pxScale: 0.5, hyst: 0.8 }, ppr = 1000;
  assert.equal(pickTravellerLevel(levels, 0, 2.9, 1, ppr, 2, o), 0, 'nearer than near: full');
  assert.equal(pickTravellerLevel(levels, 0, 100, 1, ppr, 0, o), 0, 'lodPx 0: full');
  // at d the allowance is px × pxScale × d / ppr: 1 mm a metre here
  assert.equal(pickTravellerLevel(levels, 0, 4, 1, ppr, 2, o), 2, '4 mm allowed: the 3 mm level (under 0.8 × 4)');
  assert.equal(pickTravellerLevel(levels, 0, 1e3, 1, ppr, 2, o), 3);
  // 3.5 mm allowed: 3 mm is over 0.8 × 3.5 to step down to, but under 3.5 to stay at
  assert.equal(pickTravellerLevel(levels, 1, 3.5, 1, ppr, 2, o), 1);
  assert.equal(pickTravellerLevel(levels, 2, 3.5, 1, ppr, 2, o), 2);
  // a bigger traveller: his errors are bigger in metres, and near scales too
  assert.equal(pickTravellerLevel(levels, 0, 4, 2, ppr, 2, o), 0);
  assert.equal(pickTravellerLevel(levels, 0, 8, 2, ppr, 2, o), 2);
});

test('levels appended to an index list', () => {
  const g = new T.BoxGeometry(1, 1, 1, 4, 4, 4), base = g.index, n = base.count;
  const r = combineLevels(base, [{ index: new Uint32Array([0, 1, 2, 3, 4, 5]), error: 0.01 }], g.attributes.position.count);
  assert.deepEqual(r.levels.map((l) => [l.start, l.count]), [[0, n], [n, 6]]);
  assert.equal(r.attr.count, n + 6);
  assert.equal(r.attr.lodBase, base);
  assert.deepEqual(Array.from(r.attr.array.subarray(0, n)), Array.from(base.array));
  assert.deepEqual(Array.from(r.attr.array.subarray(n)), [0, 1, 2, 3, 4, 5]);
});

// The v2 traveller's loader in the game (issue #493; src/characters/traveller-v2.js), and its switch: it binds
// every bone the GLBs use to the game's skeleton by name, the thigh-lift keys follow the thighs (0 standing, up toward
// 1 with a thigh swung forward running), the game draws v2 (since v1.88) unless B3 is asked for (?traveller=b3, the dev
// menu), and v2 on puts B3 away.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { Player } = await import('../src/player.js');
const { Physics } = await import('../src/physics.js');
const { Animator, libraryFrom } = await import('../src/animator.js');
const { createTraveller } = await import('../src/characters/traveller.js');
const { travellerB3 } = await import('./gait-sim.js');
const { course, CAM_PLUS_Z } = await import('../src/gait-course.js');
const { bindParts, v2Wardrobe, ThighLift, liftOf, pitchDeg, travellerSetting } = await import('../src/characters/traveller-v2.js');
const { devTabs } = await import('../src/world-debug.js');

const DIR = 'data/characters/traveller-v2/';
const manifest = JSON.parse(readFileSync(DIR + 'manifest.json', 'utf8'));
const list = JSON.parse(readFileSync(DIR + 'outfits.json', 'utf8'));

/** A GLB parsed as the game's GLTFLoader reads it (its pictures left out: node has no image decoder). */
async function glb(path) {
  const g = readFileSync(path), n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
  json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials ?? []) { delete m.pbrMetallicRoughness?.baseColorTexture; delete m.normalTexture; delete m.emissiveTexture; }
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const parse = (file) => { const b = readFileSync(file); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
const [assets, lib, baseGltf] = await Promise.all([travellerB3(), parse('public/anim/ual.glb').then(libraryFrom), glb(DIR + 'traveller.glb')]);

/** The game's traveller (B3) standing at the origin facing +z. */
function traveller() {
  const scene = course(), physics = new Physics(scene);
  const p = new Player(physics, { climb: false, health: false });
  p.animator = new Animator(lib, p.char);
  p.character = createTraveller(p.char, assets);
  p.humanoid = p.character.humanoid;
  p.gear = { update() {}, device: { visible: true } };
  p._lastVel = new T.Vector3();
  p.pos.set(0, physics.groundAt(0, 5, 0), 0); p.heading = 0; p.vel.set(0, 0, 0); p.onGround = true; p.lastSafe.copy(p.pos);
  scene.add(p.object);
  return p;
}

test('the loader binds every bone the GLBs use to his skeleton, by name', async () => {
  const p = traveller(), bones = p.humanoid.body.skeleton.bones;
  const files = [['base', baseGltf], ...await Promise.all(list.outfits.filter((o) => o.dir).map(async (o) => {
    const m = JSON.parse(readFileSync(DIR + o.dir + 'manifest.json', 'utf8'));
    return [o.id, await glb(DIR + o.dir + m.glb)];
  }))];
  for (const [id, gltf] of files) {
    const parts = bindParts(gltf, bones, id);
    assert.ok(Object.keys(parts).length >= 3, `${id}: its parts`);   // (#684: the shell-cut outfits are three: jacket, trousers, boots)
    for (const [name, part] of Object.entries(parts)) {
      // every bone the part's skin names is on the game's skeleton, and every weighted vertex now points at it
      for (const b of part.bones) assert.ok(bones.some((x) => x.name === b), `${id} ${name}: bone ${b} on his skeleton`);
      const si = part.geometry.attributes.skinIndex, sw = part.geometry.attributes.skinWeight;
      const used = new Set();
      for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > 0) used.add(si.getComponent(i, k));
      for (const j of used) assert.ok(j < bones.length && part.bones.includes(bones[j].name), `${id} ${name}: joint ${j} (${bones[j]?.name}) one of the GLB's`);
    }
  }
  // the GLB's own skin, read straight: each source joint lands on the bone of its name
  let src = null;
  baseGltf.scene.traverse((o) => { if (o.isSkinnedMesh && o.name === 'Shirt') src = o; });
  const shirt = bindParts(baseGltf, bones).Shirt.geometry.attributes.skinIndex, from = src.geometry.attributes.skinIndex;
  for (let i = 0; i < from.count; i += 97) for (let k = 0; k < 4; k++) assert.equal(bones[shirt.getComponent(i, k)].name, src.skeleton.bones[from.getComponent(i, k)].name);
  // a bone the skeleton lacks is said, not bound to bone 0
  assert.throws(() => bindParts(baseGltf, bones.filter((b) => b.name !== 'calf_l'), 'base'), /bone calf_l not on his skeleton/);
});

test('the thigh-lift keys follow the thighs: 0 standing, lifted with a thigh forward running (the manifest\'s drivers)', { timeout: 300000 }, () => {
  assert.deepEqual(Object.keys(manifest.drivers).sort(), ['thighLift_l', 'thighLift_r']);
  assert.equal(liftOf(25, [25, 80]), 0); assert.equal(liftOf(80, [25, 80]), 1); assert.equal(liftOf(52.5, [25, 80]), 0.5);
  assert.equal(liftOf(-40, [25, 80]), 0); assert.equal(liftOf(120, [25, 80]), 1);
  assert.ok(Math.abs(pitchDeg(new T.Vector3(0, -1, 0))) < 1e-9 && pitchDeg(new T.Vector3(0, -1, 1)) > 44.9, 'forward (+z) is positive');
  const p = traveller();
  const base = bindParts(baseGltf, p.humanoid.body.skeleton.bones);
  const { wardrobe } = v2Wardrobe(p.character, { list, baseManifest: manifest, base });
  wardrobe.wear('default');
  const clothes = wardrobe.meshes[1], lift = clothes.userData.thighLift;
  assert.ok(lift, 'the clothes carry a driver');
  assert.deepEqual(lift.keys.map((k) => k.key).sort(), ['thighLift_l', 'thighLift_r']);
  for (const k of lift.keys) assert.equal(clothes.morphTargetDictionary[k.key], k.index);
  assert.ok(clothes.geometry.morphAttributes.position.length === 2, 'the keys joined with the clothes');
  // (offsets, as glTF's are: read as positions a key at 1 doubled every vert and threw the clothes off him)
  assert.equal(clothes.geometry.morphTargetsRelative, true, 'the joined keys are offsets');
  for (const a of clothes.geometry.morphAttributes.position) {
    let far = 0;
    for (let i = 0; i < a.count; i++) far = Math.max(far, Math.hypot(a.getX(i), a.getY(i), a.getZ(i)));
    assert.ok(far > 0.002 && far < 0.15, `a key moves the shirt a little: at most ${(far * 100).toFixed(1)} cm`);
  }
  // (the keys move the shirt only: the other garments carry them at zero, pass 5)
  const moved = clothes.geometry.morphAttributes.position.map((a) => { let n = 0; for (let i = 0; i < a.count; i++) if (Math.hypot(a.getX(i), a.getY(i), a.getZ(i)) > 1e-4) n++; return n; });
  assert.ok(moved.every((n) => n > 50), `each key moves verts (${moved})`);
  // standing at rest: both 0
  p.humanoid.body.skeleton.pose();
  p.object.updateMatrixWorld(true);
  const rest = lift.update();
  assert.ok(Object.values(rest).every((v) => v === 0), `at rest ${JSON.stringify(rest)}`);
  for (const k of lift.keys) assert.ok(Math.abs(k.deg) < 1, `${k.key}: ${k.deg.toFixed(2)}° at rest`);
  // the game's idle, then a jog and a sprint: each frame drawn sets them (onBeforeRender)
  const dt = 1 / 60, max = { thighLift_l: 0, thighLift_r: 0 }, idle = { thighLift_l: 0, thighLift_r: 0 };
  let frames = 0;
  for (let i = 0; i < 6 * 60; i++) {
    const running = i >= 2 * 60;
    p.update(dt, running ? { KeyW: true, ShiftLeft: i >= 4 * 60 } : {}, CAM_PLUS_Z);   // (the idle, a jog, a sprint) p.object.updateMatrixWorld(true);
    clothes.onBeforeRender();
    const v = Object.fromEntries(lift.keys.map((k) => [k.key, clothes.morphTargetInfluences[k.index]]));
    for (const k of Object.keys(v)) { if (running && i > 3 * 60) max[k] = Math.max(max[k], v[k]); else if (!running && i > 60) idle[k] = Math.max(idle[k], v[k]); }
    if (running && v.thighLift_l > 0 && v.thighLift_r > 0) frames++;
  }
  assert.ok(idle.thighLift_l < 0.05 && idle.thighLift_r < 0.05, `standing (the idle): ${JSON.stringify(idle)}`);
  assert.ok(max.thighLift_l > 0.3 && max.thighLift_r > 0.3, `running, each thigh lifts its key: ${JSON.stringify(max)}`);
  assert.ok(frames < 60, `the two thighs lift in turn, not together (${frames} frames both)`);
});

test('the game draws v2 unless B3 is asked for: no address, nothing kept', () => {
  const kept = new Map();
  globalThis.localStorage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v), removeItem: (k) => kept.delete(k) };
  try {
    assert.deepEqual(travellerSetting.get(''), { on: true, outfit: 'default' });
    assert.deepEqual(travellerSetting.get('?level=desert&outfits=default'), { on: true, outfit: 'default' }, 'the outfits page is not the switch');
    assert.deepEqual(travellerSetting.get('?traveller=b3'), { on: false, outfit: 'default' }, 'B3 kept for comparison');
    const main = readFileSync('src/main.js', 'utf8');
    assert.match(main, /const travellerV2 = \{ \.\.\.travellerSetting\.get\(\)/);
    assert.match(main, /loadTraveller\(import\.meta\.env\.BASE_URL, \{ v2: travellerV2 \}\)/, 'v2 loaded unless the switch is off');
    assert.match(main, /if \(!query\.has\('outfits'\)\) buildTravellerLod/, 'his far levels, B3\'s or v2\'s');
    const traveller = readFileSync('src/characters/traveller.js', 'utf8');
    assert.match(traveller, /v2\?\.on\?loadTravellerV2/, 'loadTraveller fetches v2 only when asked');
    assert.match(traveller, /if\(assets\.v2\)\{yield;dressTravellerV2\(model,assets\.v2\)\}/, 'createTraveller dresses him from what it fetched');
  } finally { delete globalThis.localStorage; }
});

test('the switch takes effect: the address, the dev menu, and v2 on with B3 away', () => {
  const kept = new Map();
  globalThis.localStorage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v), removeItem: (k) => kept.delete(k) };
  try {
    assert.deepEqual(travellerSetting.get('?traveller=v2'), { on: true, outfit: 'default' });
    assert.deepEqual(travellerSetting.get('?traveller=v2&outfit=pearl-diver'), { on: true, outfit: 'pearl-diver' });
    travellerSetting.set(true, 'lamplighter');
    assert.deepEqual(travellerSetting.get(''), { on: true, outfit: 'lamplighter' }, 'the dev menu\'s choice kept');
    assert.deepEqual(travellerSetting.get('?traveller=b3'), { on: false, outfit: 'lamplighter' }, 'the address wins');
    travellerSetting.set(false);
    assert.equal(travellerSetting.get('').on, false);
  } finally { delete globalThis.localStorage; }
  // the dev menu's Traveller tab: the switch and an outfit row each; the engines (no 'traveller' cap) leave it out
  const outfits = list.outfits.map(({ id, name }) => ({ id, name }));
  const tab = devTabs({ toggles: { travellerV2: true }, traveller: { on: true, outfit: 'pearl-diver', outfits } }).find((t) => t.id === 'traveller');
  assert.ok(tab, 'a Traveller tab');
  assert.deepEqual(tab.rows[0].act, { do: 'toggle', key: 'travellerV2' });
  assert.equal(tab.rows[0].state, true);
  assert.equal(tab.rows.length, 1 + outfits.length);
  assert.deepEqual(tab.rows.filter((r) => r.state).map((r) => r.act.outfit ?? r.act.key), ['travellerV2', 'pearl-diver']);
  assert.ok(!devTabs({ traveller: { on: false, outfits }, caps: new Set(['quest']) }).some((t) => t.id === 'traveller'), 'not in the engines');
  assert.ok(!devTabs({}).some((t) => t.id === 'traveller'), 'not without the host\'s say');
  const main = readFileSync('src/main.js', 'utf8');
  assert.match(main, /a\.key === 'travellerV2'\) void setTraveller\(!travellerV2\.dress\)/);
  assert.match(main, /a\.do === 'traveller'\) void setTraveller\(true, a\.outfit\)/);
  // dressed: B3's body and cloth put away, two draws of v2 on his skeleton; an outfit swaps live
  const p = traveller(), h = p.humanoid;
  const base = bindParts(baseGltf, h.body.skeleton.bones);
  const { wardrobe } = v2Wardrobe(p.character, { list, baseManifest: manifest, base });
  const worn = wardrobe.wear('default');
  assert.equal(p.character.mesh.visible, false, 'B3 put away');
  for (const m of [p.character.cloth?.garment, p.character.cloth?.underlayer, p.character.cloth?.innerShirt]) if (m) assert.equal(m.visible, false);
  assert.notEqual(p.character.updateCloth, p.character.b3Away.updateCloth, 'B3\'s overshirt no longer stepped');
  assert.ok(p.character.head?.visible !== false, 'the game\'s head stays');
  assert.equal(worn.draws, 2);
  for (const m of wardrobe.meshes) {
    assert.equal(m.skeleton, h.body.skeleton, `${m.name} on his skeleton`);
    assert.ok(m.parent === h.body.parent && m.visible);
  }
  // the body's hidden areas culled: fewer triangles drawn than the base body has
  const bodyTris = wardrobe.meshes[0].geometry.index.count / 3;
  assert.ok(bodyTris < manifest.parts.Body.triangles + manifest.parts.Skin.triangles, `${bodyTris} body triangles drawn`);
});

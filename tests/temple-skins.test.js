// A temple's skin (src/temples/skins/index.js, issue #342): its look only. The hooks run in order round the layout,
// and a house without one wears none.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { houseSkin } from '../src/temples/skins/index.js';
import { roseHouseSkin } from '../src/temples/skins/rose-house.js';
import { TEMPLES } from '../src/temples/index.js';
import { TempleRuntime } from '../src/temples/runtime.js';
import { GameState } from '../src/game-state.js';
import { Door } from '../src/temples/pieces.js';

test('a house without a skin wears none', () => {
  const rt = { def: {} };
  assert.equal(houseSkin(rt), null);
  assert.equal(rt.skin, null);
});

test('a skin is made once for its house, and switched off by rt.noSkin', () => {
  let made = 0;
  const skin = () => { made++; return { dress() {}, done() {} }; };
  const rt = { def: { skin } };
  assert.ok(houseSkin(rt)?.dress);
  assert.equal(made, 1);
  assert.equal(rt.skin, houseSkin.length >= 0 && rt.skin);
  const off = { def: { skin }, noSkin: true };
  assert.equal(houseSkin(off), null);
  assert.equal(made, 1);
});

// ------------------------------------------------------------------ the Warden's Well in its futuristic skin
// (src/temples/skins/wardens-well.js, after references/temples/future/wardens-well/sheet-1.jpg and sheet-2.jpg; the
// names its own, W*, so the other houses' sections beside it never clash)
import * as W3 from 'three';
import { TEMPLES as wTEMPLES } from '../src/temples/index.js';
import { TempleRuntime as WTempleRuntime } from '../src/temples/runtime.js';
import { GameState as WGameState } from '../src/game-state.js';
import { sharedUniforms as wShared } from '../src/materials.js';
import { Door as WDoor } from '../src/temples/pieces.js';
import { wardensWellSkin, WELL_ROOMS } from '../src/temples/skins/wardens-well.js';

const wBuild = (skin = true) => new WTempleRuntime({ scene: new W3.Scene(), level: { lights: [] }, def: skin ? wTEMPLES.incal.def : { ...wTEMPLES.incal.def, skin: undefined }, game: new WGameState(null) });
let wWell = null;
const wellRt = () => (wWell ??= wBuild());
const wSkinOf = (rt) => rt.kit.group.children.filter((m) => m.userData.skin);
/** Every vertex of a mesh's geometry, rounded to the mm, in order (two builds' collision compared). */
const wVerts = (m) => Array.from(m.geometry.attributes.position.array, (v) => Math.round(v * 1000));

test('the Warden’s Well wears its futuristic skin: slate, machined metal and plates, glowing, its dressing drawn', () => {
  const rt = wellRt();
  assert.equal(wTEMPLES.incal.def.skin, wardensWellSkin);
  assert.equal(rt.skin?.name, 'wardens-well');
  for (const [k, body] of [['wall', 'slate'], ['wallGlyph', 'metal'], ['floor', 'plates']]) {
    const m = rt.skin.mats[k];
    assert.equal(m.userData.houseSkin, body, `its ${k} the skin's ${body}`);
    assert.ok(m.fragmentShader.includes('float detail = skInk;') && m.fragmentShader.includes('emit = max(emit, skGlow);'), `the ${k}'s pen lines and glow the pattern's`);
    assert.ok(m.uniforms.uSkN.value > 4 && m.uniforms.uSkN.value <= WELL_ROOMS, `its rooms in the shader (${m.uniforms.uSkN.value})`);
  }
  // the rooms drawn in the skin's surfaces, the house's own back for the exterior
  const kitMats = new Set(rt.kit.group.children.filter((m) => !m.userData.skin).map((m) => m.material));
  assert.ok(kitMats.has(rt.skin.mats.wall) && kitMats.has(rt.skin.mats.floor) && kitMats.has(rt.skin.mats.glyph), 'the rooms in the skin');
  assert.ok(!rt.M.wall.userData.houseSkin && !rt.M.floor.userData.houseSkin && rt.M.glyph !== rt.skin.mats.glyph, 'rt.M the house’s own again');
  assert.equal(rt.P, wTEMPLES.incal.def.palette, 'its palette its own again');
  assert.equal(rt.kit.plan, null);
  // the pieces' own surfaces in their own frame (a riding disc, a door's slab, an iris's blade)
  const pieceMats = new Set();
  for (const p of rt.pieces) p.group?.traverse?.((o) => o.material && pieceMats.add(o.material));
  assert.ok(pieceMats.has(rt.skin.mats.floorObj) && pieceMats.has(rt.skin.mats.wallGlyphObj) && !pieceMats.has(rt.skin.mats.floor));
  const s = rt.skin.stats;
  assert.ok(s.lenses >= 6 && s.lit >= 3 && s.vanes >= 6 && s.rims >= 4 && s.blades === 16 * s.rims, JSON.stringify(s));
  assert.ok(wSkinOf(rt).length === 5 && wSkinOf(rt).every((m) => m.isInstancedMesh && m.userData.noCollide && m.userData.keepBuried && m.userData.castShadow === false), 'five drawn-only instanced meshes');
});

test('the Warden’s Well’s skin adds no collision and moves nothing', () => {
  const a = wellRt(), b = wBuild(false);
  assert.equal(b.skin, null);
  for (const end of [' collision', ' climbs']) {
    const ma = a.kit.group.children.find((m) => m.name.endsWith(end)), mb = b.kit.group.children.find((m) => m.name.endsWith(end));
    assert.ok(ma && mb, end);
    assert.deepEqual(wVerts(ma), wVerts(mb), `its${end} the same, vertex for vertex`);
  }
  const own = a.pieces.filter((p) => !p.constructor.name.startsWith('Skin'));
  assert.equal(own.length, b.pieces.length, 'the same pieces');
  own.forEach((p, i) => {
    const q = b.pieces[i];
    assert.equal(p.constructor, q.constructor);
    assert.equal(p.id, q.id);
    if (p.pos?.isVector3) assert.ok(p.pos.distanceTo(q.pos) < 1e-6, `${p.id ?? p.constructor.name} where it was`);
    if (p.center?.isVector3) assert.ok(p.center.distanceTo(q.center) < 1e-6);
  });
});

test('the Warden’s Well’s dressing keeps out of every doorway; its vanes turn, not on the lighter presets', () => {
  const rt = wellRt();
  const p = new W3.Vector3(), q = new W3.Quaternion(), sc = new W3.Vector3(), m4 = new W3.Matrix4();
  const doors = rt.pieces.filter((d) => d instanceof WDoor).map((d) => ({ at: rt.kit.local(d.group.position), w: d.o.w ?? 5, h: d.o.h ?? 6 }));
  assert.ok(doors.length >= 4);
  for (const m of wSkinOf(rt).filter((x) => /lens|vane/.test(x.name))) {
    for (let i = 0; i < m.count; i++) {
      m.getMatrixAt(i, m4); m4.decompose(p, q, sc);
      const l = rt.kit.local(p);
      for (const d of doors) assert.ok(!(Math.hypot(l.x - d.at.x, l.z - d.at.z) < d.w / 2 + 2 && l.y > d.at.y - 2 && l.y < d.at.y + d.h + 2), `${m.name} #${i} by a doorway at ${l.toArray().map((v) => v.toFixed(1))}`);
    }
  }
  const motion = rt.pieces.find((x) => x.constructor.name === 'SkinMotion'), vm = wSkinOf(rt).find((m) => /vane/.test(m.name));
  const was = wShared.uWearLite.value, before = new W3.Matrix4(), after = new W3.Matrix4();
  try {
    wShared.uWearLite.value = 0;
    vm.getMatrixAt(0, before); motion.update(1); vm.getMatrixAt(0, after);
    assert.ok(!before.equals(after), 'its vanes turn');
    wShared.uWearLite.value = 1; motion.update(1); vm.getMatrixAt(0, before);
    assert.ok(before.equals(after), 'and stand still on the lighter presets');
  } finally { wShared.uWearLite.value = was; }
  assert.ok(rt.skin.mats.wall.fragmentShader.includes('bool lite = uWearLite > 0.5;'), 'the slabs’ tones, chamfers and jogs off on the lighter presets');
});

// ---- the Rose House in its futuristic skin (src/temples/skins/rose-house.js; docs/systems/temples.md "Futuristic skins")
// (rt.noSkin is read by houseSkin while the constructor runs: a runtime that has it from its prototype)
class NoSkin extends TempleRuntime { get noSkin() { return true; } }
const buildHouse = (id, bare = false) => new (bare ? NoSkin : TempleRuntime)({ scene: new THREE.Scene(), level: { lights: [] }, def: TEMPLES[id].def, game: new GameState(null) });
const verts = (m) => Array.from(m.geometry.attributes.position.array, (v) => Math.round(v * 1000));
const skinned = (rt) => rt.kit.group.children.filter((m) => m.userData.skin);
let rose = null;
const roseHouse = () => (rose ??= buildHouse('desert'));

test('the Rose House wears its futuristic skin: slate slabs, floor plates and circuits, its dressing drawn', () => {
  const rt = roseHouse();
  assert.equal(TEMPLES.desert.def.skin, roseHouseSkin);
  assert.equal(rt.skin?.id, 'rose-house');
  for (const k of ['wall', 'machine', 'floor', 'basin']) {
    const m = rt.skin.mats[k];
    assert.ok(m?.userData.roseSkin, `its ${k} is the skin's`);
    assert.ok(m.fragmentShader.includes('float detail = skInk;') && m.fragmentShader.includes('float emit = skEmit;'), `the ${k}'s pen lines and glow are the pattern's`);
  }
  const kitMats = new Set(rt.kit.group.children.filter((m) => !m.userData.skin).map((m) => m.material));
  for (const k of ['wall', 'machine', 'floor', 'basin', 'glyph']) assert.ok(kitMats.has(rt.skin.mats[k]), `the rooms drawn in its ${k}`);
  assert.ok(!rt.M.wall.userData.roseSkin && !rt.M.floor.userData.roseSkin, 'rt.M the house’s own again, for its exterior');
  assert.equal(rt.kit.plan, null);
  const s = rt.skin.stats;
  assert.ok(s.obelisks >= 8 && s.plates >= 30 && s.rings >= 5 && s.spouts === 1 && s.grooves >= 7 && s.signs > 40, JSON.stringify(s));
  // the braziers are obelisk terminals, their circuit lit with the bowl
  const b = rt.piece('b0');
  assert.ok(b.skinLines);
  b.ignite(true);
  assert.ok(b.skinLines.uniforms.uGlow.value > 0.9);
});

test('the Rose House’s skin adds no collision and moves nothing: its solids, climbs and pieces as without it', () => {
  const a = roseHouse(), b = buildHouse('desert', true);
  assert.equal(b.skin, null);
  assert.equal(skinned(b).length, 0);
  for (const end of [' collision', ' climbs']) {
    const ma = a.kit.group.children.find((m) => m.name.endsWith(end)), mb = b.kit.group.children.find((m) => m.name.endsWith(end));
    assert.ok(ma && mb, `its${end}`);
    assert.deepEqual(verts(ma), verts(mb), `its${end} the same, vertex for vertex`);
  }
  assert.equal(a.pieces.length, b.pieces.length);
  a.pieces.forEach((p, i) => {
    const q = b.pieces[i];
    assert.equal(p.constructor, q.constructor); assert.equal(p.id, q.id);
    if (p.pos?.isVector3) assert.ok(p.pos.distanceTo(q.pos) < 1e-6, `${p.id ?? p.constructor.name} where it was`);
  });
  // the dressing: drawn only, never buried, out of the shadow passes, and clear of every doorway
  const dress = skinned(a);
  assert.ok(dress.length >= 3);
  for (const m of dress) assert.ok(m.userData.noCollide && m.userData.keepBuried && m.userData.dynamic && m.castShadow === false && m.userData.castShadow === false, m.name);
  const box = new THREE.Box3(), v = new THREE.Vector3();
  for (const p of a.pieces.filter((p) => p instanceof Door)) {
    p.group.updateMatrixWorld(true);
    box.setFromObject(p.slab).expandByVector(new THREE.Vector3(0.5, 0, 0.5));
    for (const m of dress) {
      const P = m.geometry.attributes.position;
      for (let i = 0; i < P.count; i++) assert.ok(!box.containsPoint(v.fromBufferAttribute(P, i)), `${m.name} in the doorway of ${p.id}`);
    }
  }
});

// ---- the Whale-House in its futuristic skin (src/temples/skins/whale-house.js); its own names (wh*), beside the other
// houses' tests in this file
const whTHREE = await import('three');
const { TEMPLES: whTEMPLES } = await import('../src/temples/index.js');
const { TempleRuntime: WhRuntime } = await import('../src/temples/runtime.js');
const { GameState: WhGame } = await import('../src/game-state.js');
const { sharedUniforms: whShared } = await import('../src/materials.js');
const { Door: WhDoor } = await import('../src/temples/pieces.js');
const whBuild = (skin = true) => {
  if (!skin) WhRuntime.prototype.noSkin = true;
  try { return new WhRuntime({ scene: new whTHREE.Scene(), level: { lights: [] }, def: whTEMPLES.underwater.def, game: new WhGame(null) }); }
  finally { delete WhRuntime.prototype.noSkin; }
};
let whBuilt = null;
const whHouse = () => (whBuilt ??= whBuild());
const whDressing = (rt) => rt.kit.group.children.filter((m) => m.userData.skin);

test('the Whale-House wears its skin: slate and lit lines on its surfaces, its machined dressing drawn', () => {
  const rt = whHouse();
  assert.equal(rt.skin?.name, 'whale-house');
  for (const k of ['wall', 'wallGlyph', 'floor']) {
    const m = rt.skin.mats[k];
    assert.ok(m.userData.houseSkin && m.fragmentShader.includes('float emit = whGlow;') && m.fragmentShader.includes('float detail = whInkV;'), `its ${k}: the skin's slabs, seams and lit lines`);
  }
  assert.equal(rt.skin.mats.wall.uniforms.uWhRoundN.value, 2, 'its two round halls handed to the shader');
  const kitMats = new Set(rt.kit.group.children.filter((m) => !m.userData.skin).map((m) => m.material));
  for (const k of ['wall', 'floor', 'trim', 'orb', 'ring', 'sea']) assert.ok(kitMats.has(rt.skin.mats[k]), `the rooms drawn in the skin's ${k}`);
  assert.ok(!rt.M.wall.userData.houseSkin && !rt.M.floor.userData.houseSkin && rt.M.ornament.kind === 'whorl', 'rt.M the house’s own again, for its exterior');
  assert.equal(rt.kit.plan, null);
  const s = rt.skin.stats;
  assert.ok(s.horns >= 20 && s.slabs >= 12 && s.lenses >= s.horns, JSON.stringify(s));
  assert.ok(whDressing(rt).length <= 6, 'a handful of draws');
});

test('the Whale-House’s skin adds no collision and moves nothing (rt.noSkin: the house without it)', () => {
  const a = whHouse(), b = whBuild(false);
  assert.equal(b.skin, null);
  assert.equal(whDressing(b).length, 0);
  const verts = (m) => Array.from(m.geometry.attributes.position.array, (v) => Math.round(v * 1000));
  for (const end of [' collision', ' climbs']) {
    const ma = a.kit.group.children.find((m) => m.name.endsWith(end)), mb = b.kit.group.children.find((m) => m.name.endsWith(end));
    assert.ok(ma && mb, `its${end}`);
    assert.deepEqual(verts(ma), verts(mb), `its${end} the same, vertex for vertex`);
  }
  const own = a.pieces.filter((p) => !p.constructor.name.startsWith('Skin'));
  assert.equal(own.length, b.pieces.length, 'the same pieces');
  own.forEach((p, i) => {
    const q = b.pieces[i];
    assert.equal(p.constructor, q.constructor);
    assert.equal(p.id, q.id);
    if (p.pos?.isVector3) assert.ok(p.pos.distanceTo(q.pos) < 1e-6, `${p.id ?? p.constructor.name} where it was`);
  });
  for (const m of whDressing(a)) assert.ok(m.isInstancedMesh && m.userData.noCollide && m.userData.keepBuried && m.userData.castShadow === false, `${m.name} drawn only`);
});

test('the Whale-House’s dressing keeps out of every doorway, and the lighter presets hide its finest', () => {
  const rt = whHouse(), p = new whTHREE.Vector3(), q = new whTHREE.Quaternion(), s = new whTHREE.Vector3(), m4 = new whTHREE.Matrix4();
  const doors = rt.pieces.filter((d) => d instanceof WhDoor).map((d) => ({ at: rt.kit.local(d.group.position), w: d.o.w ?? 5, h: d.o.h ?? 6 }));
  assert.ok(doors.length >= 8);
  for (const m of whDressing(rt)) for (let i = 0; i < m.count; i++) {
    m.getMatrixAt(i, m4); m4.decompose(p, q, s);
    const l = rt.kit.local(p);
    for (const d of doors) assert.ok(!(Math.hypot(l.x - d.at.x, l.z - d.at.z) < d.w / 2 + 0.6 && l.y > d.at.y - 0.5 && l.y < d.at.y + d.h), `${m.name} #${i} in a doorway at ${l.toArray().map((v) => v.toFixed(1))}`);
  }
  const fine = whDressing(rt).filter((m) => m.userData.skinFine), life = rt.pieces.find((x) => x.constructor.name === 'SkinLife'), was = whShared.uWearLite.value;
  assert.ok(fine.length >= 1 && life);
  try {
    whShared.uWearLite.value = 1; life.update(0, 0);
    assert.ok(fine.every((m) => !m.visible), 'hidden on Low');
    whShared.uWearLite.value = 0; life.update(0, 0);
    assert.ok(fine.every((m) => m.visible), 'shown on High');
  } finally { whShared.uWearLite.value = was; }
  assert.ok(rt.skin.mats.wall.fragmentShader.includes('uWearLite < 0.5'), 'the chamfers and the finer lines off on the lighter presets');
});

test('the Whale-House’s skin: brass horns with dark mouths, brass dishes and ears, a few heavy mullions, its own light', async () => {
  const rt = whHouse();
  const horns = whDressing(rt).find((m) => m.name.endsWith('brass horns'));
  const C = horns.geometry.attributes.color;
  assert.ok(C && horns.material === rt.skin.mats.brassHorn && horns.material.vertexColors, 'the horns coloured by vertex');
  const tones = new Set(Array.from({ length: C.count }, (_, i) => C.getX(i)));
  assert.ok(Math.min(...tones) < 0.1 && Math.max(...tones) > 1.1, 'a near-black mouth and a bright lip');
  assert.ok(!whDressing(rt).some((m) => /mouth/.test(m.name)), 'the mouths in the horns’ own draw');
  const { Dish, EchoEar, Glass } = await import('../src/temples/pieces.js');
  for (const p of rt.pieces.filter((q) => q instanceof Dish || q instanceof EchoEar)) {
    const mats = new Set();
    for (const g of p.group ? [p.group] : p.ends.map((e) => e.g)) g.traverse((o) => o.isMesh && mats.add(o.material));
    assert.ok(mats.has(rt.skin.mats.brass), `${p.id ?? p.constructor.name} in the skin's brass`);
  }
  for (const g of rt.skinGlass) {
    const bars = g.glass.group.children[1];
    const n = bars.geometry.attributes.position.count / 36;   // (boxes, non-indexed)
    assert.ok(n <= 6, `the window's mullions a few heavy bars (${n})`);
    assert.ok(g.glass instanceof Glass && bars.material === rt.skin.mats.trim, 'in the frames’ dark metal');
  }
  // the house's light inside: the skin's own (a neutral shade), the house's palette's without it
  const { attachTemple } = await import('../src/temples/index.js');
  const level = (id) => ({ id, lights: [], atmo: () => ({ tint: [1, 1, 1], fog: 0.6, name: 'the sea' }) });
  const lit = (skin) => {
    const L = level('underwater');
    if (!skin) WhRuntime.prototype.noSkin = true;
    const w = console.warn, l = console.log; console.warn = console.log = () => {};
    try { attachTemple('underwater', new whTHREE.Scene(), L); } finally { delete WhRuntime.prototype.noSkin; console.warn = w; console.log = l; }
    const t = L.temple, p = t.kit.world(0, 1, 20);
    assert.equal(L.atmo(p.x, p.z, p.y).script, t.lightScript, 'the house’s light inside');
    return t.lightScript.find((k) => k[0] >= 12)[3];
  };
  assert.equal(lit(true), rt.skin.light.shadow, 'the skin’s shade by day');
  assert.equal(lit(false), whTEMPLES.underwater.def.palette.light.shadow, 'the house’s own without the skin');
});

// The Founders' Belfry in its futuristic skin (src/temples/skins/founders-belfry.js): its look only.
import './register-gadgets.js';
import { BellEar } from '../src/temples/pieces.js';

const quietly = (f) => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return f(); } finally { console.warn = w; console.log = l; } };
const belfry = (noSkin) => quietly(() => {
  const def = { ...TEMPLES.arzach2.def, exterior: null, change: null };
  // (rt.noSkin is read in houseSkin, called inside the constructor: set it on the prototype for this build)
  const was = TempleRuntime.prototype.noSkin;
  TempleRuntime.prototype.noSkin = noSkin;
  try { return new TempleRuntime({ scene: new THREE.Scene(), level: { lights: [] }, def, game: new GameState(null) }); } finally { TempleRuntime.prototype.noSkin = was; }
});
const solids = (rt) => rt.kit.group.children.filter((m) => m.name.endsWith(' collision') || m.name.endsWith(' climbs')).map((m) => [m.name, [...m.geometry.attributes.position.array]]);

test('the Founders’ Belfry wears its futuristic skin; collision, climbs and pieces as without it', () => {
  const on = belfry(false), off = belfry(true);
  assert.equal(on.skin?.name, 'founders-belfry');
  assert.equal(off.skin, null);
  assert.deepEqual(solids(on), solids(off), 'collision and climbs vertex for vertex');
  assert.deepEqual(on.pieces.filter((p) => p.id).map((p) => [p.id, p.constructor.name]), off.pieces.filter((p) => p.id).map((p) => [p.id, p.constructor.name]));
  // its three bells drawn as rings, a note for every ear, lens terminals beside the doorways
  assert.equal(on.skin.stats.bells, 3);
  assert.equal(on.skin.stats.notes, on.pieces.filter((p) => p instanceof BellEar).length);
  assert.ok(on.skin.stats.lenses > 20, `lenses ${on.skin.stats.lenses}`);
  // the house's own materials back for its exterior; the cobalt casts no shadow
  assert.notEqual(on.M.wall, on.skin.mats.wall);
  assert.equal(on.P, TEMPLES.arzach2.def.palette);
  const cobalt = on.kit.group.children.find((m) => m.material === on.skin.mats.cobalt);
  assert.ok(cobalt && !cobalt.castShadow && cobalt.userData.castShadow === false);
  // a bell that rings lights its note
  const ear = on.piece('e1');
  on.logic.ringing.add('e1'); ear.left = 8;
  const note = on.pieces.find((p) => p.constructor.name === 'BelfryNote');
  for (let i = 0; i < 30; i++) note.update(1 / 30);
  assert.ok(on.skin.U.bells.value.some((b) => b.w > 0.9), 'the porch bell rings');
});

// ---- the Aerie in its futuristic skin (src/temples/skins/aerie.js, after references/temples/future/aerie/sheet-*.jpg;
// its names its own, a*, so the other houses' sections beside it never clash)
import { aerieSkin, signGeometry as aSign } from '../src/temples/skins/aerie.js';
import { sharedUniforms as aShared } from '../src/materials.js';
class ANoSkin extends TempleRuntime { get noSkin() { return true; } }
const aBuild = (bare = false) => new (bare ? ANoSkin : TempleRuntime)({ scene: new THREE.Scene(), level: { lights: [], ground: { baseAt: () => 0, heightAt: () => 0 } }, def: TEMPLES.arzach.def, game: new GameState(null) });
let aOn = null;
const aerie = () => (aOn ??= aBuild());
const aSolids = (rt) => rt.kit.group.children.filter((m) => m.name.endsWith(' collision') || m.name.endsWith(' climbs')).map((m) => [m.name, Array.from(m.geometry.attributes.position.array, (v) => Math.round(v * 1000))]);

test('the Aerie wears its futuristic skin: slate slabs, sand ledges, peach circuits, turbines and floating plates', () => {
  const rt = aerie();
  assert.equal(TEMPLES.arzach.def.skin, aerieSkin);
  assert.equal(rt.skin?.name, 'aerie');
  for (const [k, body] of [['wall', 'slate'], ['wallGlyph', 'metal'], ['trim', 'metal'], ['floor', 'plates']]) {
    const m = rt.skin.mats[k];
    assert.equal(m.userData.houseSkin, body, `its ${k} the skin's ${body}`);
    assert.ok(m.fragmentShader.includes('float detail = skInk;') && m.fragmentShader.includes('emit = max(emit, skGlow);'), `the ${k}'s pen lines and glow the pattern's`);
  }
  assert.ok(rt.skin.mats.wall.fragmentShader.includes('bool lite = uWearLite > 0.5;'), 'the slabs’ tones, chamfers and climbing circuits off on the lighter presets');
  const s = rt.skin.stats;
  // (the four great vents' turbines, the raised slabs' rims, the well's bands, the rings round the throats, the wing lines
  // recoloured, every frieze glyph redrawn as the picks' sign, floating discs and hexagons)
  assert.ok(s.turbines === 4 && s.rims >= 16 && s.bands >= 3 && s.rings >= 10 && s.wing > 20 && s.signs > 50 && s.floaters >= 12 && s.hexes >= 2, JSON.stringify(s));
  const dressing = rt.kit.group.children.filter((m) => m.userData.skin);
  assert.ok(dressing.length === 7 && dressing.every((m) => m.isInstancedMesh && m.userData.noCollide && m.userData.keepBuried && m.userData.castShadow === false), 'seven drawn-only instanced meshes, out of the shadow passes');
  // its lights out of the shadow passes; the house's own materials and palette back for the exterior
  for (const m of rt.kit.group.children) if ([rt.skin.mats.ring, rt.skin.mats.wing, rt.skin.mats.glyph, rt.skin.mats.slot].includes(m.material)) assert.equal(m.userData.castShadow, false, m.name);
  assert.ok(!rt.M.wall.userData.houseSkin && rt.M.glyph !== rt.skin.mats.glyph);
  assert.equal(rt.P, TEMPLES.arzach.def.palette);
  assert.equal(rt.kit.plan, null);
  // the picks' sign: a long low arch with its dots, far wider than it is tall
  const z = new THREE.Box3().setFromBufferAttribute(aSign(1.62).attributes.position).getSize(new THREE.Vector3());
  assert.ok(z.x > 1.55 && z.x < 1.75 && z.y < 0.6, `the sign ${z.x.toFixed(2)} by ${z.y.toFixed(2)}`);
});

test('the Aerie’s skin adds no collision and moves nothing (rt.noSkin: the house without it)', () => {
  const on = aerie(), off = aBuild(true);
  assert.equal(off.skin, null);
  assert.deepEqual(aSolids(on), aSolids(off), 'collision and climbs vertex for vertex');
  const own = on.pieces.filter((p) => !p.constructor.name.startsWith('Skin'));
  assert.equal(own.length, off.pieces.length, 'the same pieces');
  own.forEach((p, i) => {
    const q = off.pieces[i];
    assert.equal(p.constructor, q.constructor);
    assert.equal(p.id, q.id);
    if (p.pos?.isVector3) assert.ok(p.pos.distanceTo(q.pos) < 1e-6, `${p.id ?? p.constructor.name} where it was`);
    if (p.foot?.isVector3) assert.ok(p.foot.distanceTo(q.foot) < 1e-6);
  });
});

test('the Aerie’s floating plates keep off its doorways and winds; its turbines turn with the wind; Low draws half the plates', () => {
  const rt = aerie(), K = rt.kit;
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const doors = rt.pieces.filter((d) => d instanceof Door).map((d) => ({ at: K.local(d.group.position), w: d.o.w ?? 5, h: d.o.h ?? 6 }));
  const winds = rt.pieces.filter((w) => w.constructor.name === 'Updraft').map((w) => ({ f: K.local(w.foot), r: w.r, h: w.hMax }));
  assert.ok(doors.length >= 4 && winds.length >= 6);
  const plates = rt.kit.group.children.filter((m) => /floating (discs|hexagons)$/.test(m.name));
  for (const m of plates) for (let i = 0; i < m.count; i++) {
    m.getMatrixAt(i, m4); m4.decompose(p, q, sc);
    const l = K.local(p);
    for (const d of doors) assert.ok(!(Math.hypot(l.x - d.at.x, l.z - d.at.z) < d.w / 2 + 3 && l.y > d.at.y - 2 && l.y < d.at.y + d.h + 2), `${m.name} #${i} by a doorway`);
    for (const w of winds) assert.ok(!(Math.hypot(l.x - w.f.x, l.z - w.f.z) < w.r + sc.x + 1 && l.y > w.f.y - 1 && l.y < w.f.y + w.h + 2), `${m.name} #${i} in a wind's column at ${l.toArray().map((v) => v.toFixed(1))}`);
  }
  const motion = rt.pieces.find((x) => x.constructor.name === 'SkinMotion'), tm = rt.kit.group.children.find((m) => m.name === 'skin: turbines');
  const i = motion.turbines.findIndex((t) => t.piece.o.id === 'column'), wind = motion.turbines[i].piece;
  const was = aShared.uWearLite.value, a = new THREE.Matrix4(), b = new THREE.Matrix4();
  try {
    // (the well's column rising, as it does once the hall's stone sits in its vent)
    Object.defineProperty(wind, 'on', { value: true, configurable: true });
    tm.getMatrixAt(i, a); for (let k = 0; k < 30; k++) motion.update(0.1); tm.getMatrixAt(i, b);
    assert.ok(!a.equals(b), 'a turbine turns while its wind rises');
    aShared.uWearLite.value = 1; motion.update(0.1);
    const n = plates.reduce((s, m) => s + m.count, 0);
    aShared.uWearLite.value = 0; motion.update(0.1);
    assert.ok(n < plates.reduce((s, m) => s + m.count, 0), 'the lighter presets draw fewer plates');
  } finally { aShared.uWearLite.value = was; delete wind.on; }
});

// ---- the Hush-House in its futuristic skin (src/temples/skins/hush-house.js, after
// references/temples/future/hush-house/sheet-1.jpg): its look only. Its own names (hh*), beside the other houses'.
import { hushHouseSkin, HUSH_ROOMS } from '../src/temples/skins/hush-house.js';
import { sharedUniforms as hhShared } from '../src/materials.js';
const hhBuild = (noSkin) => quietly(() => {
  const def = { ...TEMPLES.perdide.def, exterior: null, change: null };
  const was = TempleRuntime.prototype.noSkin;
  TempleRuntime.prototype.noSkin = noSkin;
  try { return new TempleRuntime({ scene: new THREE.Scene(), level: { lights: [] }, def, game: new GameState(null) }); } finally { TempleRuntime.prototype.noSkin = was; }
});
let hhOn = null;
const hhHouse = () => (hhOn ??= hhBuild(false));

test('the Hush-House wears its futuristic skin: coffered slate, machined metal and plates, violet circuits, its dressing drawn', () => {
  const rt = hhHouse();
  assert.equal(TEMPLES.perdide.def.skin, hushHouseSkin);
  assert.equal(rt.skin?.name, 'hush-house');
  for (const [k, body] of [['wall', 'coffer'], ['wallGlyph', 'metal'], ['floor', 'plates']]) {
    const m = rt.skin.mats[k];
    assert.equal(m.userData.houseSkin, body, `its ${k} the skin's ${body}`);
    assert.ok(m.fragmentShader.includes('float detail = skInk;') && m.fragmentShader.includes('emit = max(emit, skGlow);'), `the ${k}'s pen lines and glow the pattern's`);
    assert.ok(m.uniforms.uSkN.value > 6 && m.uniforms.uSkN.value <= HUSH_ROOMS, `its rooms in the shader (${m.uniforms.uSkN.value})`);
  }
  const kitMats = new Set(rt.kit.group.children.filter((m) => !m.userData.skin).map((m) => m.material));
  for (const k of ['wall', 'wallGlyph', 'floor', 'glyph', 'pool', 'cable', 'spikeTeal', 'spikeViolet']) assert.ok(kitMats.has(rt.skin.mats[k]), `the rooms drawn in its ${k}`);
  // the house's own materials and drawing back for its exterior, its own light inside
  assert.ok(!rt.M.wall.userData.houseSkin && !rt.M.floor.userData.houseSkin && rt.M.glyph !== rt.skin.mats.glyph, 'rt.M the house’s own again');
  assert.equal(rt.kit.plan, null);
  assert.ok(!Object.hasOwn(rt.kit, 'add'), 'the kit draws as its own again');
  assert.ok(rt.skin.light?.shadow && rt.skin.light.light);
  const s = rt.skin.stats;
  assert.ok(s.wedges > 60 && s.resonators === 8 && s.lit === 4 && s.rings === 12 && s.plinths >= 10 && s.jaws === 4, JSON.stringify(s));
  const dressing = rt.kit.group.children.filter((m) => m.userData.skin);
  assert.ok(dressing.length === 2 && dressing.every((m) => m.userData.noCollide && m.userData.keepBuried && m.userData.castShadow === false && !m.castShadow), 'two drawn-only meshes out of the shadow passes');
  // the lights out of the shadow passes too
  for (const m of rt.kit.group.children.filter((o) => o.material === rt.skin.mats.glyph)) assert.equal(m.userData.castShadow, false);
});

test('the Hush-House’s skin adds no collision and moves nothing: its solids, climbs and pieces as without it', () => {
  const on = hhHouse(), off = hhBuild(true);
  assert.equal(off.skin, null);
  assert.deepEqual(solids(on), solids(off), 'collision and climbs vertex for vertex');
  const own = on.pieces.filter((p) => !p.constructor.name.startsWith('Skin'));
  assert.equal(own.length, off.pieces.length, 'the same pieces');
  own.forEach((p, i) => {
    const q = off.pieces[i];
    assert.equal(p.constructor, q.constructor);
    assert.equal(p.id, q.id);
    if (p.pos?.isVector3) assert.ok(p.pos.distanceTo(q.pos) < 1e-6, `${p.id ?? p.constructor.name} where it was`);
    if (p.center?.isVector3) assert.ok(p.center.distanceTo(q.center) < 1e-6);
  });
  // the jaws drawn as slate shutters in their own leaves' shapes (what is drawn is what collides), frosting when stilled
  const jaw = on.piece('d2'), motion = on.pieces.find((p) => p.constructor.name === 'SkinMotion');
  for (const { g } of jaw.halves) {
    assert.ok(g.children.every((c) => c.visible), 'its leaves drawn');
    assert.equal(g.children[0].material.userData.houseSkin, 'shutter');
    assert.equal(g.children[2].material, on.skin.mats.lip);
  }
  const shell = jaw.halves[0].g.children[0].material, slate = shell.uniforms.uColor.value.clone();
  jaw.frost = 1; motion.update(0.1);
  assert.ok(shell.uniforms.uGlow.value > 0.2 && !shell.uniforms.uColor.value.equals(slate), 'stilled, its shutters frost');
});

test('the Hush-House’s dressing keeps out of every doorway, and the lighter presets draw less of it', () => {
  const rt = hhHouse();
  const doors = rt.pieces.filter((d) => d instanceof Door).map((d) => ({ at: rt.kit.local(d.group.position), w: d.o.w ?? 5, h: d.o.h ?? 6 }));
  assert.ok(doors.length >= 6);
  const p = new THREE.Vector3();
  for (const m of rt.kit.group.children.filter((x) => x.userData.skin)) {
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 3) {
      const l = rt.kit.local(p.fromBufferAttribute(pos, i));
      for (const d of doors) assert.ok(!(Math.hypot(l.x - d.at.x, l.z - d.at.z) < d.w / 2 + 1 && l.y > d.at.y - 1 && l.y < d.at.y + d.h + 1), `${m.name} by a doorway at ${l.toArray().map((v) => v.toFixed(1))}`);
    }
  }
  const motion = rt.pieces.find((x) => x.constructor.name === 'SkinMotion'), was = hhShared.uWearLite.value;
  try {
    hhShared.uWearLite.value = 0; motion.update(0.1);
    const full = motion.slate.geometry.drawRange.count, rings = motion.light.geometry.drawRange.count;
    hhShared.uWearLite.value = 1; motion.update(0.1);
    assert.ok(motion.slate.geometry.drawRange.count < Math.min(full, motion.slate.geometry.attributes.position.count), 'every other wedge on the lighter presets');
    assert.ok(motion.light.geometry.drawRange.count < Math.min(rings, motion.light.geometry.attributes.position.count), 'and no rings');
  } finally { hhShared.uWearLite.value = was; }
  assert.ok(rt.skin.mats.wall.fragmentShader.includes('bool lite = uWearLite > 0.5;'));
});

// ---- the Engine-House in its futuristic skin (src/temples/skins/engine-house.js): its look only; its own names (eh*)
const { engineHouseSkin: ehSkin } = await import('../src/temples/skins/engine-house.js');
const { sharedUniforms: ehShared } = await import('../src/materials.js');
const ehBuild = (noSkin) => quietly(() => {
  const def = { ...TEMPLES.buried.def, exterior: null, change: null };
  const was = TempleRuntime.prototype.noSkin;
  TempleRuntime.prototype.noSkin = noSkin;
  try { return new TempleRuntime({ scene: new THREE.Scene(), level: { lights: [] }, def, game: new GameState(null) }); } finally { TempleRuntime.prototype.noSkin = was; }
});
let ehOn = null;
const ehHouse = () => (ehOn ??= ehBuild(false));

test('the Engine-House wears its futuristic skin: slate, plates and amber circuits, its pits warm, its dressing drawn', () => {
  const rt = ehHouse();
  assert.equal(TEMPLES.buried.def.skin, ehSkin);
  assert.equal(rt.skin?.name, 'engine-house');
  for (const k of ['wall', 'machine', 'floor', 'floorObj', 'machineObj']) {
    const m = rt.skin.mats[k];
    assert.ok(m.userData.houseSkin, `its ${k} is the skin's`);
    assert.ok(m.fragmentShader.includes('float detail = skInk;') && m.fragmentShader.includes('float emit = skEmit;'), `the ${k}'s pen lines and glow the pattern's`);
  }
  const kitMats = new Set(rt.kit.group.children.filter((m) => !m.userData.skin).map((m) => m.material));
  for (const k of ['wall', 'machine', 'floor', 'glyph', 'ember']) assert.ok(kitMats.has(rt.skin.mats[k]), `the rooms drawn in its ${k}`);
  // the pieces that move drawn in their own frame (the riding discs, the bridge, the doors' leaves)
  const pieceMats = new Set();
  for (const p of rt.pieces) p.group?.traverse?.((o) => o.material && pieceMats.add(o.material));
  assert.ok(pieceMats.has(rt.skin.mats.floorObj) && pieceMats.has(rt.skin.mats.machineObj) && !pieceMats.has(rt.skin.mats.floor));
  // its rooms, its two pits (the Crank Hall's and the Furnace's) and the landings' lips in the shader
  assert.ok(rt.skin.U.count.value >= 16, `rooms ${rt.skin.U.count.value}`);
  assert.equal(rt.skin.U.pits.value, 2);
  assert.deepEqual(rt.skin.U.pitB.value.slice(0, 2).map((v) => v.y), [7, 7], 'each pit warms up to its landings');
  const s = rt.skin.stats;
  assert.ok(s.signs > 60 && s.pilasters >= 20 && s.terminals >= 4 && s.lit >= 2 * s.terminals, JSON.stringify(s));
  const drawn = rt.kit.group.children.filter((m) => m.userData.skin);
  assert.ok(drawn.length === 5 && drawn.every((m) => m.isInstancedMesh && m.userData.noCollide && m.userData.castShadow === false), 'five drawn-only instanced meshes, out of the shadow passes');
  // the house's own back for its exterior; what glows casts no shadow
  assert.notEqual(rt.M.wall, rt.skin.mats.wall);
  assert.equal(rt.P, TEMPLES.buried.def.palette);
  for (const mat of [rt.skin.mats.glyph, rt.skin.mats.ember, rt.skin.mats.glow]) {
    const m = rt.kit.group.children.find((o) => o.material === mat);
    assert.ok(m && !m.castShadow && m.userData.castShadow === false);
  }
  assert.equal(rt.skin.light, rt.skin.S.light);
});

test('the Engine-House’s skin adds no collision and moves nothing (rt.noSkin: the house without it)', () => {
  const on = ehHouse(), off = ehBuild(true);
  assert.equal(off.skin, null);
  assert.deepEqual(solids(on), solids(off), 'collision and climbs vertex for vertex');
  const own = on.pieces.filter((p) => !p.constructor.name.startsWith('Skin'));
  assert.deepEqual(own.map((p) => [p.id, p.constructor.name]), off.pieces.map((p) => [p.id, p.constructor.name]));
  own.forEach((p, i) => { const q = off.pieces[i]; if (p.pos?.isVector3) assert.ok(p.pos.distanceTo(q.pos) < 1e-6, `${p.id ?? p.constructor.name} where it was`); });
});

test('the Engine-House’s dressing keeps out of every doorway; the lighter presets hide its finest', () => {
  const rt = ehHouse(), K = rt.kit;
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const doors = rt.pieces.filter((d) => d instanceof Door).map((d) => ({ at: K.local(d.group.position), w: d.o.w ?? 5, h: d.o.h ?? 6 }));
  assert.ok(doors.length >= 6);
  for (const m of rt.kit.group.children.filter((x) => x.userData.skin)) {
    for (let i = 0; i < m.count; i++) {
      m.getMatrixAt(i, m4); m4.decompose(p, q, sc);
      const l = K.local(p);
      for (const d of doors) assert.ok(!(Math.hypot(l.x - d.at.x, l.z - d.at.z) < d.w / 2 + 0.8 && l.y > d.at.y - 1 && l.y < d.at.y + d.h + 1), `${m.name} #${i} in a doorway at ${l.toArray().map((v) => v.toFixed(1))}`);
    }
  }
  const life = rt.pieces.find((x) => x.constructor.name === 'SkinLife'), fine = rt.kit.group.children.find((m) => m.userData.skinFine);
  const was = ehShared.uWearLite.value;
  try {
    ehShared.uWearLite.value = 1; life.update(0.1, 1); assert.equal(fine.visible, false);
    ehShared.uWearLite.value = 0; life.update(0.1, 1); assert.equal(fine.visible, true);
  } finally { ehShared.uWearLite.value = was; }
  assert.ok(rt.skin.mats.wall.fragmentShader.includes('bool lite = uWearLite > 0.5;'), 'the chamfers, tones and foot lines off on the lighter presets');
});

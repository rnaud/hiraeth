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
  // its bells drawn as rings (the stair's, the oculus's, the porch's; since issue #377 the Hall of Echoes', the far door's and
  // the Cloud-Mother's four, each with a pull-ring for the hook), a note for every ear, lens terminals beside the doorways
  assert.equal(on.skin.stats.bells, 9);
  assert.equal(on.pieces.filter((p) => p.constructor.name === 'HookBell').length, 9, 'a pull-ring under every bell');
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
import { aerieSkin } from '../src/temples/skins/aerie.js';
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
  // recoloured, every frieze glyph the shared makers' mark lit peach, floating discs and hexagons)
  assert.ok(s.turbines === 4 && s.rims >= 16 && s.bands >= 3 && s.rings >= 10 && s.wing > 20 && s.signs > 50 && s.floaters >= 12 && s.hexes >= 2, JSON.stringify(s));
  const dressing = rt.kit.group.children.filter((m) => m.userData.skin);
  assert.ok(dressing.length === 7 && dressing.every((m) => m.isInstancedMesh && m.userData.noCollide && m.userData.keepBuried && m.userData.castShadow === false), 'seven drawn-only instanced meshes, out of the shadow passes');
  // its lights out of the shadow passes; the house's own materials and palette back for the exterior
  for (const m of rt.kit.group.children) if ([rt.skin.mats.ring, rt.skin.mats.wing, rt.skin.mats.glyph, rt.skin.mats.slot].includes(m.material)) assert.equal(m.userData.castShadow, false, m.name);
  assert.ok(!rt.M.wall.userData.houseSkin && rt.M.glyph !== rt.skin.mats.glyph);
  assert.equal(rt.P, TEMPLES.arzach.def.palette);
  assert.equal(rt.kit.plan, null);
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

// ---- the Lamp-House in its futuristic skin (src/temples/skins/lamp-house.js); its own names (lh*), beside the other
// houses' tests in this file
const lhTHREE = await import('three');
const { TEMPLES: lhTEMPLES } = await import('../src/temples/index.js');
const { TempleRuntime: LhRuntime } = await import('../src/temples/runtime.js');
const { GameState: LhGame } = await import('../src/game-state.js');
const { sharedUniforms: lhShared } = await import('../src/materials.js');
const { Door: LhDoor, Switch: LhSwitch } = await import('../src/temples/pieces.js');
const { machineMoth: lhMachine, LAMP_SKIN: LH } = await import('../src/temples/skins/lamp-house.js');
const lhBuild = (skin = true) => quietly(() => {
  const was = LhRuntime.prototype.noSkin;
  LhRuntime.prototype.noSkin = !skin;
  try { return new LhRuntime({ scene: new lhTHREE.Scene(), level: { lights: [] }, def: lhTEMPLES.perdide2.def, game: new LhGame(null) }); }
  finally { LhRuntime.prototype.noSkin = was; }
});
let lhBuilt = null;
const lhHouse = () => (lhBuilt ??= lhBuild());
const lhDressing = (rt) => rt.kit.group.children.filter((m) => m.userData.skin);
const lhLife = (rt) => rt.pieces.find((x) => x.constructor.name === 'SkinLife');

test('the Lamp-House wears its skin: dark slabs, plates and gold lines, bronze basins, its dressing drawn', () => {
  const rt = lhHouse();
  assert.equal(rt.skin?.name, 'lamp-house');
  for (const k of ['wall', 'wallGlyph', 'floor', 'water', 'plate']) {
    const m = rt.skin.mats[k];
    assert.ok(m.userData.houseSkin && m.fragmentShader.includes('float emit = lhGlow;') && m.fragmentShader.includes('float detail = lhInkV;'), `its ${k}: the skin's pattern and light`);
  }
  assert.equal(rt.skin.mats.wall.uniforms.uLhRoundN.value, 2, 'its two round halls handed to the shader');
  assert.equal(rt.skin.mats.floor.uniforms.uLhPoolN.value, 7, 'its seven basins ringed (four pools, three lure pools)');
  const kitMats = new Set(rt.kit.group.children.filter((m) => !m.userData.skin).map((m) => m.material));
  for (const k of ['wall', 'floor', 'trim', 'bronze', 'water', 'conduit', 'glyph']) assert.ok(kitMats.has(rt.skin.mats[k]), `the rooms drawn in the skin's ${k}`);
  assert.ok(!rt.M.wall.userData.houseSkin && !rt.M.floor.userData.houseSkin && rt.M.ornament.kind === 'lamp', 'rt.M the house’s own again, for its exterior');
  assert.equal(rt.P, lhTEMPLES.perdide2.def.palette, 'its palette its own again');
  assert.equal(rt.kit.plan, null);
  const s = rt.skin.stats;
  assert.ok(s.rings === 7 && s.sockets >= 20 && s.rows >= 4 && s.plates >= 20, JSON.stringify(s));
  assert.ok(lhDressing(rt).length <= 4, 'a handful of draws');
  // the eyes gold while the layout was built, the gallery's lantern-shown stones pale plates
  assert.equal('#' + rt.piece('s1').glow.uniforms.uColor.value.getHexString(), LH.glow);
  const br1 = rt.piece('br1'), mats = new Set();
  br1.root.traverse((o) => o.isMesh && mats.add(o.material));
  assert.ok(mats.has(rt.skin.mats.stone));
  // what glows casts no shadow
  for (const m of rt.kit.group.children.filter((o) => o.material === rt.skin.mats.glyph)) assert.equal(m.userData.castShadow, false);
});

test('the Lamp-House’s skin adds no collision and moves nothing (rt.noSkin: the house without it)', () => {
  const a = lhHouse(), b = lhBuild(false);
  assert.equal(b.skin, null);
  assert.equal(lhDressing(b).length, 0);
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
    if (p.center?.isVector3) assert.ok(p.center.distanceTo(q.center) < 1e-6);
  });
  for (const m of lhDressing(a)) assert.ok(m.isInstancedMesh && m.userData.noCollide && m.userData.keepBuried && m.castShadow === false && m.userData.castShadow === false, `${m.name} drawn only`);
});

test('the Lamp-House’s dressing keeps out of every doorway; its lines wake to the light, its finest hidden on Low', () => {
  const rt = lhHouse(), p = new lhTHREE.Vector3(), q = new lhTHREE.Quaternion(), sc = new lhTHREE.Vector3(), m4 = new lhTHREE.Matrix4();
  const doors = rt.pieces.filter((d) => d instanceof LhDoor).map((d) => ({ at: rt.kit.local(d.group.position), w: d.o.w ?? 5, h: d.o.h ?? 6 }));
  assert.ok(doors.length >= 7);
  for (const m of lhDressing(rt)) for (let i = 0; i < m.count; i++) {
    m.getMatrixAt(i, m4); m4.decompose(p, q, sc);
    const l = rt.kit.local(p);
    for (const d of doors) assert.ok(!(Math.hypot(l.x - d.at.x, l.z - d.at.z) < d.w / 2 + 0.6 && l.y > d.at.y - 0.5 && l.y < d.at.y + d.h), `${m.name} #${i} in a doorway at ${l.toArray().map((v) => v.toFixed(1))}`);
  }
  // the floating plates high over the floors (out of any jump's reach and the camera's way)
  const plates = lhDressing(rt).find((m) => /floating/.test(m.name));
  for (let i = 0; i < plates.count; i++) { plates.getMatrixAt(i, m4); m4.decompose(p, q, sc); assert.ok(rt.kit.local(p).y > 12, `plate #${i} high`); }
  // the lines wake by the lights: none in the dark, a lit pool's round it
  const life = lhLife(rt), U = rt.skin.U, was = lhShared.uWearLite.value;
  rt.player = { pos: rt.kit.world(0, 0, 30), vel: new lhTHREE.Vector3() };
  life.update(0, 0);
  assert.equal(U.srcN.value, 0, 'dark: no lantern yet, nothing lit');
  rt.logic.light('s1'); rt.piece('s1').on = true;
  life.update(0, 0);
  assert.equal(U.srcN.value, 1, 'a lit pool wakes the lines round it');
  assert.deepEqual(U.src.value[0].toArray(), [...rt.piece('s1').center.toArray(), LH.reach.pool]);
  const fine = lhDressing(rt).filter((m) => m.userData.skinFine);
  try {
    lhShared.uWearLite.value = 1; life.update(0, 0);
    assert.ok(fine.length && fine.every((m) => m.count === m.userData.skinFine.lite && m.count < m.userData.skinFine.full), 'the sockets’ lamps left out on Low');
    lhShared.uWearLite.value = 0; life.update(0, 0);
    assert.ok(fine.every((m) => m.count === m.userData.skinFine.full), 'drawn on High');
  } finally { lhShared.uWearLite.value = was; delete rt.player; }
  assert.ok(rt.skin.mats.floor.fragmentShader.includes('uWearLite < 0.5'), 'the chamfers and the finer lines off on the lighter presets');
});

test('the Lampless in the Lamp-House’s skin: a machine of white plates, its parts and motion as they were', () => {
  const rt = lhBuild(), m = rt.guardian.model;   // (its own build: the other tests' frames made theirs a machine)
  const groups = [];
  m.group.traverse((o) => groups.push(o.type));
  lhLife(rt).update(0, 0);
  assert.ok(m.machine, 'made a machine on the first frame');
  assert.equal(lhMachine(m), false, 'once');
  const body = m.body.children.find((o) => o.isMesh), C = body.geometry.attributes.color, white = new lhTHREE.Color(LH.moth.plate);
  assert.ok(Array.from({ length: C.count }, (_, i) => C.getX(i)).some((x) => Math.abs(x - white.r) < 1e-3), 'its plates white');
  const lenses = [];
  m.group.traverse((o) => /lens/.test(o.name) && lenses.push(o));
  assert.equal(lenses.length, 4, 'the sign on each wing in a lens');
  const after = [];
  m.group.traverse((o) => after.push(o.type));
  assert.equal(after.length, groups.length + 4, 'its parts as they were, and the lenses');
  m.animate(1 / 30, 0, { state: 'fight' });
});

// ---- the Casting-House in its futuristic skin (src/temples/skins/casting-house.js, after
// references/temples/future/casting-house/sheet-*.jpg; its names its own, c*, beside the other houses' sections)
import { castingHouseSkin, CASTING } from '../src/temples/skins/casting-house.js';
import { UP as cUP } from '../src/temples/moonfoundry.js';
class CNoSkin extends TempleRuntime { get noSkin() { return true; } }
const cBuild = (bare = false) => quietly(() => new (bare ? CNoSkin : TempleRuntime)({ scene: new THREE.Scene(), level: { lights: [], ground: { baseAt: () => 0, heightAt: () => 0 } }, def: TEMPLES.moonfoundry.def, game: new GameState(null) }));
let cOn = null;
const casting = () => (cOn ??= cBuild());
const cSolids = (rt) => rt.kit.group.children.filter((m) => m.name.endsWith(' collision') || m.name.endsWith(' climbs')).map((m) => [m.name, Array.from(m.geometry.attributes.position.array, (v) => Math.round(v * 1000))]);

test('the Casting-House wears its futuristic skin: slate slabs, ivory circuits, cracked moons, frames, rings and cradles', () => {
  const rt = casting();
  assert.equal(TEMPLES.moonfoundry.def.skin, castingHouseSkin);
  assert.equal(rt.skin?.name, 'casting-house');
  for (const [k, body] of [['wall', 'slate'], ['wallGlyph', 'metal'], ['trim', 'metal'], ['floor', 'plates'], ['moon', 'moon']]) {
    const m = rt.skin.mats[k];
    assert.equal(m.userData.houseSkin, body, `its ${k} the skin's ${body}`);
    assert.ok(m.fragmentShader.includes('float detail = skInk;') && m.fragmentShader.includes('emit = max(emit, skGlow);'), `the ${k}'s pen lines and glow the pattern's`);
  }
  assert.ok(rt.skin.mats.wall.fragmentShader.includes('bool lite = uWearLite > 0.5;'), 'the slabs’ tones, chamfers and climbing circuits off on the lighter presets');
  const s = rt.skin.stats;
  // (every ivory moon in the moon's shader, the great one's chains and the old seams gone, the founders' iron warmed, the
  // frieze's glyphs and the doors' medallions the shared makers' mark, a frame round every door, two rings over each
  // pilot flame, the two hooded cradles drawn by the skin)
  assert.ok(s.moons >= 30 && s.chains === 3 && s.seams >= 30 && s.iron > 40 && s.signs > 50 && s.frames >= 6 && s.flames === 2 && s.cradles === 2, JSON.stringify(s));
  assert.ok(rt.kit.group.children.some((m) => m.material === rt.skin.mats.moon), 'the moons drawn cracked');
  const dressing = rt.kit.group.children.filter((m) => m.userData.skin);
  assert.ok(dressing.length === 2 && dressing.every((m) => m.isInstancedMesh && m.userData.noCollide && m.userData.keepBuried && m.userData.castShadow === false), 'two drawn-only instanced meshes, out of the shadow passes');
  for (const m of rt.kit.group.children) if ([rt.skin.mats.glyph, rt.skin.mats.lights, rt.skin.mats.ring].includes(m.material)) assert.equal(m.userData.castShadow, false, m.name);
  // the cradles: the skin's half-pipe and hood, their sign lit, the fire and the hood's logic the piece's own
  for (const id of ['bG', 'bH']) {
    const b = rt.piece(id), names = [];
    b.group.traverse((o) => o.isMesh && names.push(o.name));
    assert.ok(names.includes('cradle (skin)') && names.includes('cradle sign (skin)') && b.o.hood, `${id}: ${names}`);
  }
  // the house's own materials and palette back for the exterior; the grating handed to the floor
  assert.ok(!rt.M.wall.userData.houseSkin && rt.M.glyph !== rt.skin.mats.glyph);
  assert.equal(rt.P, TEMPLES.moonfoundry.def.palette);
  assert.equal(rt.kit.plan, null);
  assert.deepEqual(rt.skin.mats.floor.uniforms.uSkQ.value.toArray(), [CASTING.grate.x, CASTING.grate.z, CASTING.grate.hx, CASTING.grate.hz]);
  assert.equal(CASTING.up, cUP, 'the walls’ second tier of circuits at the house’s upper floor');
});

test('the Casting-House’s skin adds no collision and moves nothing (rt.noSkin: the house without it)', () => {
  const on = casting(), off = cBuild(true);
  assert.equal(off.skin, null);
  assert.deepEqual(cSolids(on), cSolids(off), 'collision and climbs vertex for vertex');
  const own = on.pieces.filter((p) => !p.constructor.name.startsWith('Skin'));
  assert.equal(own.length, off.pieces.length, 'the same pieces');
  own.forEach((p, i) => {
    const q = off.pieces[i];
    assert.equal(p.constructor, q.constructor);
    assert.equal(p.id, q.id);
    if (p.pos?.isVector3) assert.ok(p.pos.distanceTo(q.pos) < 1e-6, `${p.id ?? p.constructor.name} where it was`);
  });
});

test('the Casting-House’s frames and rings keep off its doorways and the moons’ rails; a lit cradle’s sign brightens', () => {
  const rt = casting(), K = rt.kit;
  const doors = rt.pieces.filter((d) => d instanceof Door).map((d) => ({ at: d.o.at, w: d.o.w, h: d.o.h, yaw: d.o.yaw ?? 0 }));
  const balls = rt.pieces.filter((b) => b.constructor.name === 'Ball').map((b) => ({ a: K.local(K.world(...b.o.a)), b: K.local(K.world(...b.o.b)), r: b.o.r }));
  const m = rt.kit.group.children.find((x) => x.name === 'skin: machined frames and rings');
  const p = m.geometry.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(K.inv);
    // (no point of the dressing in a doorway's opening)
    for (const d of doors) {
      const dx = v.x - d.at[0], dz = v.z - d.at[2], x = dx * Math.cos(d.yaw) - dz * Math.sin(d.yaw), zt = dx * Math.sin(d.yaw) + dz * Math.cos(d.yaw);
      assert.ok(!(Math.abs(x) < d.w / 2 - 0.1 && Math.abs(zt) < 1.5 && v.y > d.at[1] + 0.1 && v.y < d.at[1] + d.h - 0.8), `the dressing in a doorway at ${v.toArray().map((q) => q.toFixed(1))}`);
    }
    // (none in a moon's way along its rail)
    for (const b of balls) {
      const ab = b.b.clone().sub(b.a), t = THREE.MathUtils.clamp(v.clone().sub(b.a).dot(ab) / ab.lengthSq(), 0, 1), q = b.a.clone().addScaledVector(ab, t);
      assert.ok(!(Math.hypot(v.x - q.x, v.z - q.z) < b.r + 0.2 && v.y < q.y + 2 * b.r + 0.4), `the dressing over a rail at ${v.toArray().map((q) => q.toFixed(1))}`);
    }
  }
  const cr = rt.pieces.find((x) => x.constructor.name === 'SkinCradles'), b = rt.piece('bG'), u = b.skinGlow.uniforms.uGlow;
  for (let i = 0; i < 40; i++) cr.update(0.1, i * 0.1);
  const cold = u.value;
  b.ignite(true);
  for (let i = 0; i < 40; i++) cr.update(0.1, i * 0.1);
  assert.ok(u.value > cold + 0.2, `lit ${u.value.toFixed(2)} over cold ${cold.toFixed(2)}`);
});

// ---- the Undertower in its futuristic skin (src/temples/skins/undertower.js, after
// references/temples/future/undertower/sheet-1.jpg and sheet-2.jpg); its own names (ut*), beside the other houses' tests
const { undertowerSkin: utSkin, UNDERTOWER_SKIN: UT } = await import('../src/temples/skins/undertower.js');
const { Dish: UtDish, EchoEar: UtEar, Door: UtDoor } = await import('../src/temples/pieces.js');
const utBuild = (noSkin) => quietly(() => {
  const def = { ...TEMPLES.bazaar.def, exterior: null, change: null };
  const was = TempleRuntime.prototype.noSkin;
  TempleRuntime.prototype.noSkin = noSkin;
  try { return new TempleRuntime({ scene: new THREE.Scene(), level: { lights: [] }, def, game: new GameState(null) }); } finally { TempleRuntime.prototype.noSkin = was; }
});
let utBuilt = null;
const utHouse = () => (utBuilt ??= utBuild(false));
const utDressing = (rt) => rt.kit.group.children.filter((m) => m.userData.skin);

test('the Undertower wears its futuristic skin: slate panels and coral circuits, brass, bronze, cable in its pits', () => {
  const rt = utHouse();
  assert.equal(TEMPLES.bazaar.def.skin, utSkin);
  assert.equal(rt.skin?.name, 'undertower');
  for (const k of ['wall', 'wallGlyph', 'floor', 'cable']) {
    const m = rt.skin.mats[k];
    assert.ok(m.userData.houseSkin && m.fragmentShader.includes('float emit = utGlow;') && m.fragmentShader.includes('float detail = utInkV;'), `its ${k}: the skin's panels, seams and lit lines`);
  }
  assert.equal(rt.skin.mats.wall.uniforms.uUtRoundN.value, 3, 'its three round halls handed to the shader');
  // the lights crisp (just over the post's halo start), out of the shadow passes
  assert.ok(UT.emit >= 0.68 && UT.emit <= 0.8 && rt.skin.mats.glow.uniforms.uGlow.value >= 0.68 && rt.skin.mats.glow.uniforms.uGlow.value <= 0.8);
  const kitMats = new Set(rt.kit.group.children.filter((m) => !m.userData.skin).map((m) => m.material));
  for (const k of ['wall', 'floor', 'glyph', 'brass']) assert.ok(kitMats.has(rt.skin.mats[k]), `the rooms drawn in the skin's ${k}`);
  assert.equal('#' + rt.skin.mats.trim.paint.getHexString(), new THREE.Color(UT.trim).getHexString().replace(/^/, '#'), 'its frames a dark slate paint (in the kit’s paint mesh: no draw of their own)');
  for (const m of rt.kit.group.children) if (m.material === rt.skin.mats.glyph || m.material === rt.skin.mats.slot) assert.ok(!m.castShadow && m.userData.castShadow === false, 'its glyphs and slits cast no shadow');
  assert.ok(!rt.M.wall.userData.houseSkin && !rt.M.floor.userData.houseSkin && rt.M.trimMat !== rt.skin.mats.brass, 'rt.M the house’s own again, for its exterior');
  assert.equal(rt.kit.plan, null);
  // the dishes and horns in brass, the balls and eggs bronze (their notes' rings their own)
  for (const p of rt.pieces.filter((q) => q instanceof UtDish || q instanceof UtEar)) {
    const mats = new Set();
    for (const g of p.group ? [p.group] : p.ends.map((e) => e.g)) g.traverse((o) => o.isMesh && mats.add(o.material));
    assert.ok(mats.has(rt.skin.mats.brass) && !mats.has(p.cream), `${p.id ?? p.constructor.name} in the skin's brass`);
    assert.ok(p.glow && mats.has(p.glow), 'its light its own');
  }
  const ball = rt.piece('ball1'), bm = new Set(); ball.group.traverse((o) => o.isMesh && bm.add(o.material));
  assert.ok(bm.has(rt.skin.mats.bronze) && bm.has(ball.glow), 'the singing ball bronze, its rings its note’s');
  const s = rt.skin.stats;
  assert.ok(s.slabs >= 12 && s.stands >= 7 && s.lines >= 4 && s.cables === 2 * UT.cables.n, JSON.stringify(s));
  assert.ok(utDressing(rt).length <= 5, `a handful of draws (${utDressing(rt).length})`);
});

test('the Undertower’s skin adds no collision and moves nothing (rt.noSkin: the house without it)', () => {
  const a = utHouse(), b = utBuild(true);
  assert.equal(b.skin, null);
  assert.equal(utDressing(b).length, 0);
  assert.deepEqual(solids(a), solids(b), 'collision and climbs vertex for vertex');
  const own = a.pieces.filter((p) => !p.constructor.name.startsWith('Skin'));
  assert.equal(own.length, b.pieces.length, 'the same pieces');
  own.forEach((p, i) => {
    const q = b.pieces[i];
    assert.equal(p.constructor, q.constructor);
    assert.equal(p.id, q.id);
    if (p.pos?.isVector3) assert.ok(p.pos.distanceTo(q.pos) < 1e-6, `${p.id ?? p.constructor.name} where it was`);
  });
  for (const m of utDressing(a)) assert.ok(m.userData.noCollide && m.userData.keepBuried && m.userData.castShadow === false && !m.castShadow, `${m.name} drawn only`);
});

test('the Undertower’s dressing keeps out of every doorway, and the lighter presets hide its finest', () => {
  const rt = utHouse(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const doors = rt.pieces.filter((d) => d instanceof UtDoor).map((d) => ({ at: rt.kit.local(d.group.position), w: d.o.w ?? 5, h: d.o.h ?? 6 }));
  assert.ok(doors.length >= 8);
  for (const m of utDressing(rt).filter((x) => x.isInstancedMesh || x.userData.places)) for (let i = 0; i < (m.isInstancedMesh ? m.count : m.userData.places.length); i++) {
    if (m.isInstancedMesh) m.getMatrixAt(i, m4); else m4.copy(m.userData.places[i]);
    m4.decompose(p, q, s);
    const l = rt.kit.local(p);
    for (const d of doors) assert.ok(!(Math.hypot(l.x - d.at.x, l.z - d.at.z) < d.w / 2 + 0.6 && l.y > d.at.y - 0.5 && l.y < d.at.y + d.h), `${m.name} #${i} in a doorway at ${l.toArray().map((v) => v.toFixed(1))}`);
  }
  const fine = utDressing(rt).filter((m) => m.userData.skinFine), life = rt.pieces.find((x) => x.constructor.name === 'SkinLife'), was = wShared.uWearLite.value;
  assert.ok(fine.length >= 1 && life);
  try {
    wShared.uWearLite.value = 1; life.update(0, 0);
    assert.ok(fine.every((m) => !m.visible), 'hidden on Low');
    wShared.uWearLite.value = 0; life.update(0, 0);
    assert.ok(fine.every((m) => m.visible), 'shown on High');
  } finally { wShared.uWearLite.value = was; }
  assert.ok(rt.skin.mats.wall.fragmentShader.includes('uWearLite < 0.5'), 'the chamfers and the finer lines off on the lighter presets');
});

// ---- the Clock-House in its futuristic skin (src/temples/skins/clock-house.js, after
// references/temples/future/clock-house/sheet-1.jpg); its own names (ch*), beside the other houses' tests in this file
const chTHREE = await import('three');
const { TEMPLES: chTEMPLES } = await import('../src/temples/index.js');
const { TempleRuntime: ChRuntime } = await import('../src/temples/runtime.js');
const { GameState: ChGame } = await import('../src/game-state.js');
const { sharedUniforms: chShared } = await import('../src/materials.js');
const { Door: ChDoor, Platform: ChPlatform } = await import('../src/temples/pieces.js');
const { clockHouseSkin, CLOCK_ROOMS } = await import('../src/temples/skins/clock-house.js');
const chBuild = (skin = true) => {
  if (!skin) ChRuntime.prototype.noSkin = true;
  try { return new ChRuntime({ scene: new chTHREE.Scene(), level: { lights: [] }, def: chTEMPLES.garage.def, game: new ChGame(null) }); }
  finally { delete ChRuntime.prototype.noSkin; }
};
let chBuilt = null;
const chHouse = () => (chBuilt ??= chBuild());
const chDressing = (rt) => rt.kit.group.children.filter((m) => m.userData.skin);

test('the Clock-House wears its skin: slate, cream and plates in its surfaces, teal lights, the clocks and lenses drawn', () => {
  const rt = chHouse();
  assert.equal(chTEMPLES.garage.def.skin, clockHouseSkin);
  assert.equal(rt.skin?.name, 'clock-house');
  for (const [k, body] of [['wall', 'wall'], ['floor', 'floor'], ['machine', 'machine'], ['floorObj', 'floor'], ['machineObj', 'machine']]) {
    const m = rt.skin.mats[k];
    assert.equal(m.userData.clockSkin, body, `its ${k} the skin's ${body}`);
    assert.ok(m.fragmentShader.includes('float detail = skInk;') && m.fragmentShader.includes('float emit = skEmit;'), `the ${k}'s pen lines and light the pattern's`);
    assert.ok(m.uniforms.uSkN.value >= 10 && m.uniforms.uSkN.value <= CLOCK_ROOMS, `its rooms in the shader (${m.uniforms.uSkN.value})`);
  }
  // the landings' walking level handed to the shader for the halls without a floor (the Escapement's pit, the gallery's chasm)
  const walks = rt.skin.U.roomsY.value.slice(0, rt.skin.U.count.value).filter((y) => y.z - y.x > 4).map((y) => y.z);
  assert.deepEqual(walks.sort((a, b) => a - b), [0, 10]);
  const kitMats = new Set(rt.kit.group.children.filter((m) => !m.userData.skin).map((m) => m.material));
  for (const k of ['wall', 'floor', 'machine', 'trim', 'glyph', 'pillar']) assert.ok(kitMats.has(rt.skin.mats[k]), `the rooms drawn in its ${k}`);
  assert.ok(!rt.M.wall.userData.clockSkin && !rt.M.floor.userData.clockSkin && rt.M.ornament.kind === 'clock', 'rt.M the house’s own again, for its exterior');
  assert.equal(rt.P, chTEMPLES.garage.def.palette);
  assert.equal(rt.kit.plan, null);
  // the escapement's riding disc brass, the doors' slabs the pattern in their own frame
  assert.ok(rt.pieces.some((p) => p instanceof ChPlatform && p.group.children.some((o) => o.material === rt.skin.mats.disc)), 'the riding disc brass');
  const doorMats = new Set();
  for (const p of rt.pieces.filter((q) => q instanceof ChDoor)) p.group.traverse((o) => o.isMesh && doorMats.add(o.material));
  assert.ok(doorMats.has(rt.skin.mats.machineObj) && !doorMats.has(rt.skin.mats.machine));
  const s = rt.skin.stats;
  assert.ok(s.clocks === 2 && s.lenses >= 24 && s.lit >= s.lenses / 2 && s.lit < s.lenses && s.plates === 6, JSON.stringify(s));
  // the dressing: a handful of drawn-only merged meshes out of the shadow passes, the glass among them
  const dress = chDressing(rt);
  assert.ok(dress.length >= 4 && dress.length <= 6, dress.map((m) => m.name).join(', '));
  for (const m of dress) assert.ok(m.userData.noCollide && m.userData.keepBuried && m.userData.dynamic && m.castShadow === false && m.userData.castShadow === false, m.name);
  assert.ok(dress.some((m) => m.material === rt.skin.mats.glass), 'the clock’s glass');
  const glyph = rt.kit.group.children.find((m) => m.material === rt.skin.mats.glyph);
  assert.ok(glyph && glyph.castShadow === false, 'the lit glyphs out of the shadow passes');
  // the Foreman's drum in the skin's brass
  assert.equal(rt.skin.foreman.brass, '#c09048');
});

test('the Clock-House’s skin adds no collision and moves nothing (rt.noSkin: the house without it)', () => {
  const a = chHouse(), b = chBuild(false);
  assert.equal(b.skin, null);
  assert.equal(chDressing(b).length, 0);
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
    if (p.path) p.path.forEach((v, k) => assert.ok(v.distanceTo(q.path[k]) < 1e-6));
  });
  assert.deepEqual(a.arrival.pos.toArray(), b.arrival.pos.toArray());
});

test('the Clock-House’s dressing keeps out of every doorway, and the lighter presets leave out its finest', () => {
  const rt = chHouse(), box = new chTHREE.Box3(), v = new chTHREE.Vector3();
  const doors = rt.pieces.filter((p) => p instanceof ChDoor);
  assert.ok(doors.length >= 8);
  for (const p of doors) {
    p.group.updateMatrixWorld(true);
    box.setFromObject(p.slab).expandByVector(new chTHREE.Vector3(0.6, 0.3, 0.6));
    for (const m of chDressing(rt)) {
      const P = m.geometry.attributes.position;
      for (let i = 0; i < P.count; i += 3) assert.ok(!box.containsPoint(v.fromBufferAttribute(P, i)), `${m.name} in the doorway of ${p.id}`);
    }
  }
  const fine = chDressing(rt).filter((m) => m.userData.fine), life = rt.pieces.find((x) => x.constructor.name === 'SkinLife'), was = chShared.uWearLite.value;
  assert.ok(fine.length >= 3 && life);
  try {
    chShared.uWearLite.value = 1; life.update(0, 0);
    assert.ok(fine.every((m) => m.geometry.drawRange.count === m.userData.coarse && m.userData.coarse < m.geometry.attributes.position.count), 'the fine parts left out on Low');
    chShared.uWearLite.value = 0; life.update(0, 0);
    assert.ok(fine.every((m) => m.geometry.drawRange.count === Infinity), 'all drawn on High');
  } finally { chShared.uWearLite.value = was; }
  assert.ok(rt.skin.mats.wall.fragmentShader.includes('uWearLite < 0.5'), 'the slabs’ tones and chamfers off on the lighter presets');
});

// ---- the Mooring-House in its futuristic skin (src/temples/skins/mooring-house.js): its look only; its own names (mh*)
const { mooringHouseSkin: mhSkin, MOORING_SKIN: MH, MOORING_ROOMS: MH_ROOMS } = await import('../src/temples/skins/mooring-house.js');
const { sharedUniforms: mhShared } = await import('../src/materials.js');
const mhBuild = (noSkin) => quietly(() => {
  const def = { ...TEMPLES.spacecity.def, exterior: null, change: null };
  const was = TempleRuntime.prototype.noSkin;
  TempleRuntime.prototype.noSkin = noSkin;
  try { return new TempleRuntime({ scene: new THREE.Scene(), level: { lights: [] }, def, game: new GameState(null) }); } finally { TempleRuntime.prototype.noSkin = was; }
});
let mhOn = null;
const mhHouse = () => (mhOn ??= mhBuild(false));

test('the Mooring-House wears its futuristic skin: slate, plates, a capstan banded in teal, its dressing drawn', () => {
  const rt = mhHouse();
  assert.equal(TEMPLES.spacecity.def.skin, mhSkin);
  assert.equal(rt.skin?.name, 'mooring-house');
  for (const k of ['wall', 'machine', 'floor', 'drum', 'floorObj', 'machineObj']) {
    const m = rt.skin.mats[k];
    assert.ok(m.userData.houseSkin, `its ${k} is the skin's`);
    assert.ok(m.fragmentShader.includes('float detail = skInk;') && m.fragmentShader.includes('float emit = skEmit;'), `the ${k}'s pen lines and glow the pattern's`);
  }
  assert.ok(rt.skin.U.count.value >= 10 && rt.skin.U.count.value <= MH_ROOMS, `rooms ${rt.skin.U.count.value}`);
  const kitMats = new Set(rt.kit.group.children.filter((m) => !m.userData.skin).map((m) => m.material));
  for (const k of ['wall', 'floor', 'drum', 'glyph', 'glow']) assert.ok(kitMats.has(rt.skin.mats[k]), `the rooms drawn in its ${k}`);
  const pieceMats = new Set();
  for (const p of rt.pieces) p.group?.traverse?.((o) => o.material && pieceMats.add(o.material));
  assert.ok(pieceMats.has(rt.skin.mats.floorObj) && pieceMats.has(rt.skin.mats.machineObj) && !pieceMats.has(rt.skin.mats.floor));
  const s = rt.skin.stats;
  assert.ok(s.rings >= 20 && s.slots === MH.slots.angles.length && s.plates >= 14 && s.islands >= 5, JSON.stringify(s));
  const drawn = rt.kit.group.children.filter((m) => m.userData.skin);
  assert.ok(drawn.length === 3 && drawn.filter((m) => m.isInstancedMesh).length === 2 && drawn.every((m) => m.userData.noCollide && m.userData.castShadow === false && !m.castShadow), 'the plates (two instanced meshes) and the islands, drawn only, out of the shadow passes');
  // the house's own back for its exterior; what glows casts no shadow
  assert.notEqual(rt.M.wall, rt.skin.mats.wall);
  assert.equal(rt.kit.plan, null);
  for (const mat of [rt.skin.mats.glyph, rt.skin.mats.glow]) {
    const m = rt.kit.group.children.find((o) => o.material === mat && !o.userData.skin);
    assert.ok(m && !m.castShadow && m.userData.castShadow === false);
  }
  assert.equal(rt.skin.light, MH.light);
});

test('the Mooring-House’s skin adds no collision and moves nothing (rt.noSkin: the house without it)', () => {
  const on = mhHouse(), off = mhBuild(true);
  assert.equal(off.skin, null);
  assert.deepEqual(solids(on), solids(off), 'collision and climbs vertex for vertex');
  const own = on.pieces.filter((p) => !p.constructor.name.startsWith('Skin'));
  assert.deepEqual(own.map((p) => [p.id, p.constructor.name]), off.pieces.map((p) => [p.id, p.constructor.name]));
  own.forEach((p, i) => { const q = off.pieces[i]; for (const k of ['pos', 'center', 'home']) if (p[k]?.isVector3) assert.ok(p[k].distanceTo(q[k]) < 1e-6, `${p.id ?? p.constructor.name} where it was`); });
});

test('the Mooring-House’s floating plates keep out of every doorway and well over its floors; still on the lighter presets', () => {
  const rt = mhHouse(), K = rt.kit;
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const doors = rt.pieces.filter((d) => d instanceof Door).map((d) => ({ at: K.local(d.group.position), w: d.o.w ?? 5, h: d.o.h ?? 6 }));
  assert.ok(doors.length >= 6);
  const [body, lenses] = rt.kit.group.children.filter((x) => x.userData.skin && x.isInstancedMesh);
  for (let i = 0; i < body.count; i++) {
    body.getMatrixAt(i, m4); m4.decompose(p, q, sc);
    const l = K.local(p);
    for (const d of doors) assert.ok(!(Math.hypot(l.x - d.at.x, l.z - d.at.z) < d.w / 2 + 2 && l.y > d.at.y - 1 && l.y < d.at.y + d.h + 3), `plate #${i} by a doorway at ${l.toArray().map((v) => v.toFixed(1))}`);
    assert.ok(l.y > 9.5, `plate #${i} high (${l.y.toFixed(1)})`);
  }
  const life = rt.pieces.find((x) => x.constructor.name === 'SkinLife');
  const was = mhShared.uWearLite.value, a = new THREE.Matrix4(), b = new THREE.Matrix4();
  try {
    mhShared.uWearLite.value = 0; life.update(0.1, 1); body.getMatrixAt(0, a); life.update(0.1, 3); body.getMatrixAt(0, b);
    assert.ok(!a.equals(b), 'they bob');
    assert.equal(lenses.visible, true);
    mhShared.uWearLite.value = 1; life.update(0.1, 4); body.getMatrixAt(0, a); life.update(0.1, 6); body.getMatrixAt(0, b);
    assert.ok(a.equals(b) && lenses.visible === false, 'still, their lenses hidden, on the lighter presets');
  } finally { mhShared.uWearLite.value = was; }
  assert.ok(rt.skin.mats.wall.fragmentShader.includes('bool lite = uWearLite > 0.5;'));
});

// ---- the Footprint in its futuristic skin (src/temples/skins/footprint.js; its own names, fp*)
const { footprintSkin, FOOT_ROOMS, walkLevels } = await import('../src/temples/skins/footprint.js');
const { sharedUniforms: fpShared } = await import('../src/materials.js');
const fpBuild = (noSkin = false) => quietly(() => {
  const was = TempleRuntime.prototype.noSkin;
  TempleRuntime.prototype.noSkin = noSkin;
  try { return new TempleRuntime({ scene: new THREE.Scene(), level: { lights: [] }, def: TEMPLES.spheres.def, game: new GameState(null) }); } finally { TempleRuntime.prototype.noSkin = was; }
});
let fpBuilt = null;
const fpHouse = () => (fpBuilt ??= fpBuild());
const fpDressing = (rt) => rt.kit.group.children.filter((m) => m.userData.skin);

test('the Footprint wears its futuristic skin: cream panels, machined doors and plates, pale lines, its dressing drawn', () => {
  const rt = fpHouse();
  assert.equal(TEMPLES.spheres.def.skin, footprintSkin);
  assert.equal(rt.skin?.name, 'footprint');
  for (const [k, body] of [['wall', 'plaster'], ['wallGlyph', 'metal'], ['floor', 'plates']]) {
    const m = rt.skin.mats[k];
    assert.equal(m.userData.houseSkin, body, `its ${k} the skin's ${body}`);
    assert.ok(m.fragmentShader.includes('float detail = fpInkV;') && m.fragmentShader.includes('emit = max(emit, fpGlow);'), `the ${k}'s pen lines and glow the pattern's`);
    assert.ok(m.uniforms.uFpN.value > 6 && m.uniforms.uFpN.value <= FOOT_ROOMS, `its rooms in the shader (${m.uniforms.uFpN.value})`);
  }
  const kitMats = new Set(rt.kit.group.children.filter((m) => !m.userData.skin).map((m) => m.material));
  for (const k of ['wall', 'floor', 'glyph']) assert.ok(kitMats.has(rt.skin.mats[k]), `the rooms drawn in its ${k}`);
  assert.ok(!rt.M.wall.userData.houseSkin && !rt.M.floor.userData.houseSkin && rt.M.ornament?.kind === 'porthole', 'rt.M the house’s own again, for its exterior');
  assert.equal(rt.P, TEMPLES.spheres.def.palette);
  assert.equal(rt.kit.plan, null);
  // light and pale, as its pick: the walls' and floors' albedo cream, never dark slate
  for (const k of ['wall', 'floor']) { const c = rt.skin.mats[k].uniforms.uColor.value; assert.ok(Math.min(c.r, c.g, c.b) > 0.6, `its ${k} pale`); }
  const s = rt.skin.stats;
  // (rings under the oculi: four since issue #401, the rooms of the lower floors roofed by the ones over them)
  assert.ok(s.walks >= 10 && s.lenses >= 6 && s.rings >= 4, JSON.stringify(s));
  const dress = fpDressing(rt);
  assert.ok(dress.length === 5 && dress.every((m) => m.isInstancedMesh && m.userData.noCollide && m.userData.keepBuried && m.castShadow === false && m.userData.castShadow === false), 'five drawn-only instanced meshes');
  // the walkways over the doorways and the frieze, never near its glyphs nor the ceiling
  assert.deepEqual(walkLevels({ kind: 'hall', y0: 0, y1: 18 }).map((y) => +y.toFixed(2)), [10.4, 14.76]);
  assert.deepEqual(walkLevels({ kind: 'hall', y0: 0, y1: 12 }), []);
});

test('the Footprint’s skin adds no collision and moves nothing (rt.noSkin: the house without it)', () => {
  const a = fpHouse(), b = fpBuild(true);
  assert.equal(b.skin, null);
  assert.equal(fpDressing(b).length, 0);
  assert.deepEqual(solids(a), solids(b), 'collision and climbs vertex for vertex');
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

test('the Footprint’s dressing keeps out of every doorway; its rings turn, and are not drawn on the lighter presets', () => {
  const rt = fpHouse();
  const box = new THREE.Box3(), v = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const doors = rt.pieces.filter((p) => p instanceof Door);
  assert.ok(doors.length >= 5);
  for (const d of doors) {
    d.group.updateMatrixWorld(true);
    box.setFromObject(d.slab).expandByVector(new THREE.Vector3(0.5, 0.3, 0.5));
    for (const m of fpDressing(rt)) {
      const P = m.geometry.attributes.position;
      for (let k = 0; k < m.count; k++) {
        m.getMatrixAt(k, m4);
        for (let i = 0; i < P.count; i += 3) assert.ok(!box.containsPoint(v.fromBufferAttribute(P, i).applyMatrix4(m4)), `${m.name} in the doorway of ${d.id}`);
      }
    }
  }
  const motion = rt.pieces.find((x) => x.constructor.name === 'SkinMotion'), rm = fpDressing(rt).find((m) => /rings/.test(m.name));
  const was = fpShared.uWearLite.value, before = new THREE.Matrix4(), after = new THREE.Matrix4();
  const tilted = rt.skin.stats.rings - 1;
  try {
    fpShared.uWearLite.value = 0;
    rm.getMatrixAt(tilted, before); motion.update(1); rm.getMatrixAt(tilted, after);
    assert.ok(!before.equals(after) && rm.visible, 'its rings turn');
    fpShared.uWearLite.value = 1; motion.update(1);
    assert.ok(!rm.visible, 'and are not drawn on the lighter presets');
  } finally { fpShared.uWearLite.value = was; motion.update(0); }
  assert.ok(rt.skin.mats.wall.fragmentShader.includes('bool lite = uWearLite > 0.5;'), 'the panels’ tones, chamfers and plates off on the lighter presets');
});

// A temple's skin (src/temples/skins/index.js, issue #342): its look only. The hooks run in order round the layout,
// and a house without one wears none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { houseSkin } from '../src/temples/skins/index.js';

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

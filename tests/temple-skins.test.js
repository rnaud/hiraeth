// The houses' alien skins (issue #342, src/temples/skins.js, docs/systems/temples.md "Alien skins"): the Rose House in
// its cactus and the Warden's Well in its comb; the other houses as they were; nothing of a house's layout changed by
// its skin: the same collision, the same pieces where they were, the dressing drawn only and clear of the doorways.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TEMPLES } from '../src/temples/index.js';
import { TempleRuntime } from '../src/temples/runtime.js';
import { GameState } from '../src/game-state.js';
import { sharedUniforms } from '../src/materials.js';
import { SKINS, SKIN_ROOMS } from '../src/temples/skins.js';
import { Door } from '../src/temples/pieces.js';

const build = (id, skin = true) => {
  const def = skin ? TEMPLES[id].def : { ...TEMPLES[id].def, skin: undefined };
  return new TempleRuntime({ scene: new THREE.Scene(), level: { lights: [] }, def, game: new GameState(null) });
};
const built = new Map();
const house = (id) => { if (!built.has(id)) built.set(id, build(id)); return built.get(id); };
const skinMeshes = (rt) => rt.kit.group.children.filter((m) => m.userData.skin);
/** Every vertex of a mesh's geometry, rounded to the mm, in order (two builds' collision compared). */
const verts = (m) => Array.from(m.geometry.attributes.position.array, (v) => Math.round(v * 1000));
const PICKED = { desert: 'cactus', incal: 'comb' };

test('the Rose House wears the cactus and the Warden’s Well the comb: their surfaces patterned, their dressing drawn', () => {
  for (const [id, name] of Object.entries(PICKED)) {
    const rt = house(id);
    assert.equal(rt.def.skin, name, `${id}: its def asks for the ${name}`);
    assert.equal(rt.skin?.name, name, `${id}: built in it`);
    for (const k of ['wall', 'wallGlyph', 'floor']) {
      const m = rt.skin.mats[k];
      assert.ok(m.userData.houseSkin, `${id}: its ${k} is the skin's`);
      assert.ok(m.fragmentShader.includes('float detail = skInk;') && m.fragmentShader.includes('vec3 skP = vWorldPos - uSkinO;'), `${id}: the ${k}'s albedo and pen lines are the pattern's`);
      // (its rooms handed to the shader: a round room's walls patterned round its middle)
      assert.ok(m.uniforms.uSkN.value > 0 && m.uniforms.uSkN.value <= SKIN_ROOMS, `${id}: its rooms in the shader`);
    }
    // the kit's batches drew the rooms in the skin's surfaces, and the house's own came back for the exterior
    const kitMats = new Set(rt.kit.group.children.filter((m) => !m.userData.skin).map((m) => m.material));
    assert.ok(kitMats.has(rt.skin.mats.wall) && kitMats.has(rt.skin.mats.floor), `${id}: the rooms in the skin`);
    assert.ok(!rt.M.wall.userData.houseSkin && !rt.M.floor.userData.houseSkin, `${id}: rt.M the house's own again, for its exterior`);
    assert.equal(rt.kit.plan, null, `${id}: the kit records nothing once built`);
    const dress = skinMeshes(rt);
    assert.ok(dress.length >= 4 && dress.some((m) => m.count > 50), `${id}: its dressing (${dress.map((m) => `${m.name} ${m.count}`).join(', ')})`);
  }
  // the cactus's ribs, pores and capsules; the comb's cells, panes and nest mouths
  const s = house('desert').skin.stats, c = house('incal').skin.stats;
  assert.ok(s.fins > 100 && s.ribs > 50 && s.pores > 50 && s.lamps > 5, JSON.stringify(s));
  assert.ok(c.cells > 100 && c.panes > 0 && c.nests >= 3, JSON.stringify(c));
});

test('the other houses wear no skin: their surfaces and dressing as they were', () => {
  for (const id of Object.keys(TEMPLES).filter((t) => !PICKED[t])) {
    const def = TEMPLES[id].def;
    assert.ok(!def.skin || !SKINS[def.skin], `${id}: no skin asked for`);
  }
  const rt = build('arzach2');
  assert.equal(rt.skin, undefined);
  assert.equal(skinMeshes(rt).length, 0);
  assert.ok(!rt.M.wall.userData.houseSkin);
});

test('a skin adds no collision and moves nothing: the same solids, climbs and pieces as the house without it', () => {
  for (const id of Object.keys(PICKED)) {
    const a = house(id), b = build(id, false);
    for (const end of [' collision', ' climbs']) {
      const ma = a.kit.group.children.find((m) => m.name.endsWith(end)), mb = b.kit.group.children.find((m) => m.name.endsWith(end));
      assert.equal(!!ma, !!mb, `${id}: its${end} as without the skin`);
      if (ma) assert.deepEqual(verts(ma), verts(mb), `${id}: its${end} the same, vertex for vertex`);
    }
    // the pieces (and the skin's own: the finer dressing's switch, no body) where they were
    const own = a.pieces.filter((p) => !p.constructor.name.startsWith('Skin'));
    assert.equal(own.length, b.pieces.length, `${id}: the same pieces`);
    own.forEach((p, i) => {
      const q = b.pieces[i];
      assert.equal(p.constructor, q.constructor);
      assert.equal(p.id, q.id);
      if (p.pos?.isVector3) assert.ok(p.pos.distanceTo(q.pos) < 1e-6, `${id}: ${p.id ?? p.constructor.name} where it was`);
    });
    // the dressing: drawn only, walked through, never buried, casting no shadow
    for (const m of skinMeshes(a)) {
      assert.ok(m.isInstancedMesh && m.userData.noCollide && m.userData.keepBuried && m.userData.castShadow === false, `${id}: ${m.name} drawn only`);
    }
  }
});

test('the dressing keeps out of every doorway', () => {
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), m4 = new THREE.Matrix4();
  for (const id of Object.keys(PICKED)) {
    const rt = house(id);
    const doors = rt.pieces.filter((d) => d instanceof Door).map((d) => ({ at: rt.kit.local(d.group.position), w: d.o.w ?? 5, h: d.o.h ?? 6 }));
    assert.ok(doors.length >= 3, `${id}: its doors`);
    for (const m of skinMeshes(rt)) {
      if (/membrane|nest|pore|plate|ceiling/.test(m.name)) continue;   // (high under the ceilings, over every door)
      for (let i = 0; i < m.count; i++) {
        m.getMatrixAt(i, m4); m4.decompose(p, q, s);
        const l = rt.kit.local(p);
        for (const d of doors) {
          const inside = Math.hypot(l.x - d.at.x, l.z - d.at.z) < d.w / 2 + 0.3 && l.y > d.at.y - 0.5 && l.y < d.at.y + d.h - 0.5;
          assert.ok(!inside, `${id}: ${m.name} #${i} stands in a doorway at ${l.toArray().map((v) => v.toFixed(1))}`);
        }
      }
    }
  }
});

test('on the lighter presets the finest dressing is hidden, as the shader leaves out its crackle', () => {
  const rt = house('desert'), was = sharedUniforms.uWearLite.value;
  const fine = skinMeshes(rt).filter((m) => m.userData.skinFine);
  assert.ok(fine.length >= 1);
  const detail = rt.pieces.find((p) => p.constructor.name === 'SkinDetail');
  try {
    sharedUniforms.uWearLite.value = 1; detail.update();
    assert.ok(fine.every((m) => !m.visible), 'hidden on Low');
    sharedUniforms.uWearLite.value = 0; detail.update();
    assert.ok(fine.every((m) => m.visible), 'shown on High');
  } finally { sharedUniforms.uWearLite.value = was; }
  for (const [id, k] of [['desert', 'cactusWall'], ['desert', 'cactusFloor'], ['incal', 'combWall'], ['incal', 'combFloor']]) assert.ok(Object.values(house(id).skin.mats).some((m) => m.userData?.houseSkin === k), k);
  assert.ok(house('desert').skin.mats.wall.fragmentShader.includes('uWearLite < 0.5'), 'the crackle off on the lighter presets');
});

test('the Rose House’s braziers are seed capsules over the same hooded bowls, lit as before', () => {
  const rt = house('desert');
  const braziers = rt.pieces.filter((p) => p.constructor.name === 'Brazier');
  assert.ok(braziers.length >= 6);
  for (const b of braziers) {
    assert.ok(b.skinCapsule, `${b.id}: its capsule`);
    assert.ok(Math.abs(b.top - 1.66 * (b.o.scale ?? 1)) < 1e-6, `${b.id}: its fire where it was`);
  }
  const b = braziers.find((x) => !x.flames);
  b.ignite(true);
  assert.ok(b.skinCapsule.material.uniforms.uGlow.value > 0.5, 'lit, its capsule glows');
  assert.ok(b.fire, 'and it is a fire, for a tar ball rolled past it');
});

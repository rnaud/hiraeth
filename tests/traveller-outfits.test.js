// The traveller's outfits on the Blender rebuild (issue #540): every outfit in the list has its garments,
// skinned to the game's skeleton by name, its hide list names real body areas, it stays within the default's
// triangles; and the wardrobe (src/characters/outfits.js) swaps outfits: the old garments off, the new on,
// the body's hidden areas and his skin piece's cut left out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as T from 'three';
import { B3_JOINTS } from '../src/characters/traveller-b3-fit.js';
import { Wardrobe, planOutfit, cullByArea, cutByBoxes, hiddenAreaSet, swingSpecOf, skirtSwingWeights, weightSkirts, SkirtSwing, SWING_PANELS } from '../src/characters/outfits.js';

const DIR = 'data/characters/traveller-v2/';
const list = JSON.parse(readFileSync(DIR + 'outfits.json', 'utf8'));
const base = JSON.parse(readFileSync(DIR + 'manifest.json', 'utf8'));

function glb(path) {
  const b = readFileSync(path);
  const jl = b.readUInt32LE(12);
  const json = JSON.parse(b.toString('utf8', 20, 20 + jl));
  const bin = 20 + jl + 8;
  const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const C = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
  const accessor = (i) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView];
    const Arr = C[a.componentType];
    const n = a.count * N[a.type];
    const off = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return new Arr(b.buffer.slice(b.byteOffset + off, b.byteOffset + off + n * Arr.BYTES_PER_ELEMENT));
  };
  const meshes = {};
  for (const node of json.nodes) if (node.mesh !== undefined) meshes[node.name] = { node, mesh: json.meshes[node.mesh] };
  return { json, accessor, meshes };
}
const triangles = (g, name) => g.meshes[name].mesh.primitives.reduce((n, p) => n + g.json.accessors[p.indices].count / 3, 0);
const baseGlb = glb(DIR + 'traveller.glb');
const baseBones = baseGlb.json.skins[0].joints.map((j) => baseGlb.json.nodes[j].name);
const others = list.outfits.filter((o) => o.dir);
// skinned skirts, not cloth (#545): the salt pilgrim's robe and tunic swing with his thighs, and at full stride
// his trousers and the tunic come through them (and the tunic through the sash's hanging ends) here and
// there; bounded in its own test
const LOOSE = { 'salt-pilgrim': ['PilgrimTrousers>Tunic', 'Tunic>Robe', 'PilgrimTrousers>Robe', 'Sash>Robe', 'Tunic>Sash'] };
const RUNNING = ['jog-a', 'jog-b', 'sprint'];
const defaultGarments = base.outfits.default.parts.filter((p) => base.parts[p].kind === 'garment');
const defaultTris = defaultGarments.reduce((n, p) => n + base.parts[p].triangles, 0);

test('the list names the default and at least one outfit of its own, each with its files', () => {
  assert.equal(list.outfits[0].id, 'default');
  assert.ok(others.length >= 1);
  assert.equal(new Set(list.outfits.map((o) => o.id)).size, list.outfits.length, 'ids unique');
  for (const o of others) {
    assert.ok(existsSync(DIR + o.dir + 'manifest.json'), `${o.id} manifest`);
    const m = JSON.parse(readFileSync(DIR + o.dir + 'manifest.json', 'utf8'));
    assert.equal(m.id, o.id);
    assert.ok(existsSync(DIR + o.dir + m.glb), `${o.id} GLB`);
    assert.ok(existsSync(m.reference), `${o.id}: its reference sheet ${m.reference}`);
  }
});

for (const o of others) {
  const m = JSON.parse(readFileSync(DIR + o.dir + 'manifest.json', 'utf8'));
  const g = glb(DIR + o.dir + m.glb);
  test(`${o.id}: every garment is a skinned mesh on the game's skeleton, weighted, with UVs`, () => {
    assert.equal(g.json.skins.length, 1);
    const bones = g.json.skins[0].joints.map((j) => g.json.nodes[j].name);
    for (const b of bones) assert.ok(baseBones.includes(b), `bone ${b} on the base skeleton`);
    for (const b of Object.keys(B3_JOINTS)) assert.ok(bones.includes(b), `bone ${b}`);
    for (const name of Object.keys(m.parts)) {
      const part = g.meshes[name];
      assert.ok(part, `garment ${name} in the GLB`);
      assert.equal(part.node.skin, 0, `${name} skinned`);
      for (const p of part.mesh.primitives) {
        for (const a of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']) assert.ok(p.attributes[a] !== undefined, `${name} ${a}`);
        // every vertex weighted (its four weights add up to one) to real joints
        const w = g.accessor(p.attributes.WEIGHTS_0), j = g.accessor(p.attributes.JOINTS_0);
        for (let i = 0; i < w.length; i += 4) {
          const s = w[i] + w[i + 1] + w[i + 2] + w[i + 3];
          assert.ok(Math.abs(s - 1) < 0.01, `${name} vertex ${i / 4}: weights add to ${s}`);
          for (let k = 0; k < 4; k++) assert.ok(j[i + k] < bones.length);
        }
      }
      assert.equal(triangles(g, name), m.parts[name].triangles, `${name} triangles as listed`);
    }
    assert.equal(g.json.materials.length, 1, 'one material: one draw for the clothes');
    assert.equal(g.json.images.length, 1, 'one atlas');
  });
  test(`${o.id}: its hides are body areas, and the outfit stays within the default's triangles`, () => {
    for (const a of m.hides) assert.ok(base.areas.includes(a), `area ${a}`);
    for (const [name, p] of Object.entries(m.parts)) for (const a of p.hides) assert.ok(base.areas.includes(a), `${name}: area ${a}`);
    for (const a of base.parts.Skin.hides) assert.ok(m.hides.includes(a), `his skin piece's own ${a} stays hidden`);
    for (const b of m.skinCut) assert.ok(b.absx[0] <= b.absx[1] && b.y[0] <= b.y[1], 'skin cut boxes');
    // (the default's garments: 50 k triangles; an outfit near that, never past it)
    assert.ok(m.triangles <= defaultTris, `${m.triangles} triangles against the default's ${defaultTris}`);
    assert.equal(m.triangles, Object.values(m.parts).reduce((n, p) => n + p.triangles, 0));
  });
  test(`${o.id}: posed, nothing comes through its garments by more than 1.5 cm`, () => {
    for (const [pose, pairs] of Object.entries(m.pokes.posed)) {
      for (const [pair, r] of Object.entries(pairs)) {
        if (LOOSE[o.id]?.includes(pair) && RUNNING.includes(pose)) continue;   // (checked in the outfit's own test)
        assert.ok(r.deepestMm <= 15, `${pose}: ${pair} out by ${r.deepestMm} mm`);
      }
    }
  });
}

test('the body loses its hidden areas\' triangles, his skin piece the cut ones (the real model)', () => {
  const body = baseGlb.meshes.Body.mesh.primitives[0];
  const area = baseGlb.accessor(body.attributes._AREA), index = baseGlb.accessor(body.indices);
  const plan = planOutfit(list, base, Object.fromEntries(others.map((o) => [o.id, JSON.parse(readFileSync(DIR + o.dir + 'manifest.json', 'utf8'))])), others[0].id);
  const kept = cullByArea(index, area, hiddenAreaSet(base.areas, plan.hides));
  assert.ok(kept.length < index.length * 0.5, `most of the body goes: ${kept.length / 3} of ${index.length / 3}`);
  const naked = cullByArea(index, area, new Set());
  assert.equal(naked.length, index.length);
  // (since #554 his skin piece is his hands alone, the body's arms joined to them at the wrist: the glider pilot's
  // boxes under its sleeves cut nothing of it, his hands stay; the lamplighter's gloves cut them)
  const skin = baseGlb.meshes.Skin.mesh.primitives[0];
  const skinTris = baseGlb.json.accessors[skin.indices].count;
  const bare = cutByBoxes(baseGlb.accessor(skin.indices), baseGlb.accessor(skin.attributes.POSITION), plan.skinCut);
  assert.equal(bare.length, skinTris, 'his hands stay');
  const gloved = planOutfit(list, base, Object.fromEntries(others.map((o) => [o.id, JSON.parse(readFileSync(DIR + o.dir + 'manifest.json', 'utf8'))])), 'lamplighter');
  const cut = cutByBoxes(baseGlb.accessor(skin.indices), baseGlb.accessor(skin.attributes.POSITION), gloved.skinCut);
  assert.ok(cut.length < skinTris, 'the skin under the gloves goes');
});

// a small stand-in: a body of four triangles in two areas, a skin piece, two garment sets
function geometry(tris, extra = {}) {
  const g = new T.BufferGeometry();
  const pos = [], idx = [];
  tris.forEach((t, i) => { pos.push(...t); idx.push(i * 3, i * 3 + 1, i * 3 + 2); });
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(pos.map(() => 0), 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(Array(pos.length / 3 * 2).fill(0), 2));
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(Array(pos.length / 3 * 4).fill(0), 4));
  g.setAttribute('skinWeight', new T.Float32BufferAttribute(Array(pos.length / 3 * 4).fill(0.25), 4));
  for (const [k, v] of Object.entries(extra)) g.setAttribute(k, new T.Float32BufferAttribute(v, 1));
  g.setIndex(idx);
  return g;
}
const tri = (x, y) => [x, y, 0, x + 0.01, y, 0, x, y + 0.01, 0];

test('swapping takes the old garments off, puts the new on, and applies the hides', () => {
  const stub = {
    areas: ['chest', 'thigh.L'],
    parts: { Shirt: { kind: 'garment' }, Body: { kind: 'body' }, Skin: { kind: 'skin' } },
    outfits: { default: { parts: ['Skin', 'Shirt'], hides: ['chest'] } },
  };
  const stubList = { outfits: [{ id: 'default', name: 'Own' }, { id: 'pilot', name: 'Pilot', dir: 'x/' }] };
  const baseG = {
    Body: geometry([tri(0, 1.3), tri(0.1, 1.3), tri(0, 0.6), tri(0.1, 0.6)], { _area: Array(3).fill(0).concat(Array(3).fill(0), Array(6).fill(1)) }),
    Skin: geometry([tri(0.5, 1.3), tri(0.7, 1.3)], { _area: Array(6).fill(-1) }),
    Shirt: geometry([tri(0, 1.3), tri(0, 1.2), tri(0, 1.1)]),
  };
  const parent = new T.Group();
  const made = [];
  const w = new Wardrobe({ list: stubList, baseManifest: stub, base: baseG, parent, make: (g, role, plan) => { const m = new T.Mesh(g); m.name = `${plan.id}.${role}`; made.push(m); return m; } });
  let worn = w.wear('default');
  assert.deepEqual(parent.children.map((c) => c.name), ['default.body', 'default.clothes']);
  assert.equal(worn.draws, 2);
  // the chest's two triangles left out; thighs and both skin triangles drawn; the shirt's three
  assert.equal(parent.children[0].geometry.index.count / 3, 4);
  assert.equal(parent.children[1].geometry.index.count / 3, 3);
  assert.throws(() => w.wear('pilot'), /not loaded/);
  w.add('pilot', { parts: { Jacket: {}, Jodhpurs: {} }, hides: ['chest', 'thigh.L'], skinCut: [{ absx: [0.6, 0.8], y: [1, 2] }] },
    { Jacket: geometry([tri(0, 1.3)]), Jodhpurs: geometry([tri(0, 0.6), tri(0.1, 0.6)]) });
  const old = parent.children.slice();
  worn = w.wear('pilot');
  assert.deepEqual(parent.children.map((c) => c.name), ['pilot.body', 'pilot.clothes'], 'the old draws are off');
  for (const m of old) assert.equal(m.parent, null);
  // every body triangle hidden; the skin's at x 0.7 cut, the one at 0.5 kept
  assert.equal(parent.children[0].geometry.index.count / 3, 1);
  assert.equal(parent.children[1].geometry.index.count / 3, 3);
  assert.equal(worn.triangles, 4);
  assert.equal(w.next().id, 'default', 'next cycles round');
  assert.equal(parent.children.length, 2);
  assert.throws(() => planOutfit(stubList, stub, {}, 'nobody'), /no outfit/);
  assert.throws(() => hiddenAreaSet(stub.areas, ['elbow']), /no body area/);
});

test('the test page cycles his own clothes and the five outfits (#542, #545)', () => {
  assert.deepEqual(list.outfits.map((o) => o.id), ['default', 'glider-pilot', 'lamplighter', 'pearl-diver', 'moss-gardener', 'salt-pilgrim']);
});

test('the lamplighter: its jacket, trousers and tall boots, none of his skin through them, near the pilot\'s triangles', () => {
  const m = JSON.parse(readFileSync(DIR + 'outfits/lamplighter/manifest.json', 'utf8'));
  const pilot = JSON.parse(readFileSync(DIR + 'outfits/glider-pilot/manifest.json', 'utf8'));
  assert.deepEqual(Object.keys(m.parts).sort(), ['BootShafts', 'Gloves', 'Jacket', 'LampBoots', 'LampTrousers', 'OilCan']);
  assert.ok(m.reference.startsWith('references/characters/traveller-outfits/lamplighter/'));
  // the tall boots' shafts hide his shins, the jacket his arms, the trousers his thighs and knees
  for (const a of ['shin.L', 'shin.R', 'upperarm.L', 'upperarm.R', 'thigh.L', 'knee.R']) assert.ok(m.hides.includes(a), a);
  assert.ok(!m.hides.includes('neck'), 'the stand collar leaves his neck');
  for (const [pose, pairs] of Object.entries(m.pokes.posed)) {
    for (const [pair, r] of Object.entries(pairs)) if (pair.startsWith('Skin>')) assert.equal(r.out, 0, `${pose}: his skin through ${pair}`);
  }
  assert.ok(Math.abs(m.triangles - pilot.triangles) < 0.15 * pilot.triangles, `${m.triangles} against the pilot's ${pilot.triangles}`);
  for (const k of ['indigo', 'lamp', 'charcoal', 'brass']) assert.ok(m.atlas.palette[k], `palette ${k}`);
});

// #544: volume, props and the shared painter (scripts/blender/traveller/tailor.py, inkpaint.py)
const jointsOf = (g, name) => {
  const bones = g.json.skins[0].joints.map((j) => g.json.nodes[j].name);
  const p = g.meshes[name].mesh.primitives[0];
  const w = g.accessor(p.attributes.WEIGHTS_0), j = g.accessor(p.attributes.JOINTS_0), pos = g.accessor(p.attributes.POSITION);
  const out = [];
  for (let i = 0; i < w.length; i += 4) {
    const used = {};
    for (let k = 0; k < 4; k++) if (w[i + k] > 0.01) used[bones[j[i + k]]] = w[i + k];
    out.push({ used, y: pos[(i / 4) * 3 + 1] });
  }
  return out;
};

test('the lamplighter\'s props: gloves weighted to his hands, the oil can to the hip and thigh, his hands\' skin cut', () => {
  const m = JSON.parse(readFileSync(DIR + 'outfits/lamplighter/manifest.json', 'utf8'));
  const g = glb(DIR + 'outfits/lamplighter/' + m.glb);
  // (each glove vert has its hand vert's weights: a trace of spine_03 at his right wrist is the base skin's own)
  for (const v of jointsOf(g, 'Gloves')) {
    for (const [b, x] of Object.entries(v.used)) if (x > 0.05) assert.match(b, /^(hand|lowerarm|thumb|index|middle|ring|pinky)_/, `a glove vert on ${b}`);
  }
  const can = jointsOf(g, 'OilCan');
  for (const v of can) for (const b of Object.keys(v.used)) assert.ok(['pelvis', 'thigh_l'].includes(b), `the can on ${b}`);
  // the can itself (everything below the strap's foot, y < 0.8 in the game's frame) all on the thigh: rigid
  const low = can.filter((v) => v.y < 0.78);
  assert.ok(low.length > 200, `${low.length} can verts`);
  for (const v of low) assert.deepEqual(Object.keys(v.used), ['thigh_l']);
  // his hands' skin goes under the gloves: none of his skin piece's triangles past the wrist stays
  const skin = baseGlb.meshes.Skin.mesh.primitives[0];
  const pos = baseGlb.accessor(skin.attributes.POSITION);
  const kept = cutByBoxes(baseGlb.accessor(skin.indices), pos, m.skinCut);
  for (let i = 0; i < kept.length; i++) assert.ok(Math.abs(pos[kept[i] * 3]) < 0.7, 'a hand triangle kept under the gloves');
  assert.equal(m.parts.OilCan.prop, 'weighted');
  assert.ok(m.parts.Gloves.triangles < 3000 && m.parts.OilCan.triangles < 1500, 'props kept light');
  assert.equal(m.pokes.posed.sprint['Gloves>Jacket'].out, 0, 'the gloves\' cuffs stay under the sleeves');
});

test('the outfits have volume: the quilting, the raised pockets and straps, the puttees\' turns, the fleece', () => {
  const lamp = JSON.parse(readFileSync(DIR + 'outfits/lamplighter/manifest.json', 'utf8'));
  const pilot = JSON.parse(readFileSync(DIR + 'outfits/glider-pilot/manifest.json', 'utf8'));
  assert.ok(lamp.fit.Jacket.relief._quilting.puffed > 2000, 'the lamplighter\'s bands puffed');
  for (const k of ['_toggles', '_armband']) assert.ok(lamp.fit.Jacket.relief[k], k);
  const r = pilot.fit.Jacket.relief._jacket_relief;
  for (const k of ['pocket0', 'pocket1', 'flap0', 'flap1', 'strap', 'backStrap', 'sleevePocket']) assert.ok(r[k].raised > 0, `${k} raised`);
  assert.ok(r.fleece.fleece > 500, 'the fleece collar has its pile');
  assert.ok(pilot.fit.Puttees.relief._puttee_relief.rings >= 40, 'the puttees wound in turns');
  for (const k of ['belt', 'harness0', 'harness3']) assert.ok(pilot.fit.Jodhpurs.relief._jodhpur_relief[k].raised > 0, k);
});

test('the shared painter shaded every new garment (folds, occlusion, hatching), the kept boots left as they were', () => {
  for (const o of others) {
    const m = JSON.parse(readFileSync(DIR + o.dir + 'manifest.json', 'utf8'));
    const kept = Object.keys(m.parts).filter((n) => /Boots$/.test(n) && !m.fit[n]);
    for (const name of Object.keys(m.parts)) {
      if (kept.includes(name)) { assert.ok(!m.shading[name], `${o.id}: ${name} kept as it was`); continue; }
      const s = m.shading[name];
      assert.ok(s, `${o.id}: ${name} shaded`);
      assert.ok(s.shadow > 0.01 && s.change > 0.002, `${o.id}: ${name} has shading (${JSON.stringify(s)})`);
      // moderate: the game's ink material lights the clothes again
      assert.ok(s.change < 0.08, `${o.id}: ${name} not muddied (${s.change})`);
    }
  }
});

// #545: the pearl diver, the moss gardener, the salt pilgrim
const outfit = (id) => JSON.parse(readFileSync(DIR + `outfits/${id}/manifest.json`, 'utf8'));
const skinClear = (m) => {
  for (const [pose, pairs] of Object.entries(m.pokes.posed)) {
    for (const [pair, r] of Object.entries(pairs)) if (pair.startsWith('Skin>')) assert.equal(r.out, 0, `${pose}: his skin through ${pair}`);
  }
};

test('the pearl diver: suit, boots\' shafts, belt and props; his upper arms, forearms and shins bare; nothing through anything', () => {
  const m = outfit('pearl-diver');
  assert.deepEqual(Object.keys(m.parts).sort(), ['DiveBoots', 'DiveGear', 'DiveShafts', 'DiveSuit']);
  assert.ok(m.reference.startsWith('references/characters/traveller-outfits/pearl-diver/'));
  for (const a of ['chest', 'belly', 'knee.L', 'knee.R', 'shin_lower.L', 'foot.R']) assert.ok(m.hides.includes(a), a);
  for (const a of ['upperarm.L', 'forearm_upper.R', 'shin.L', 'shin.R', 'neck']) assert.ok(!m.hides.includes(a), `${a} shows his skin`);
  assert.deepEqual(m.skinCut, [], 'his forearms all drawn');
  for (const [pose, pairs] of Object.entries(m.pokes.posed)) {
    for (const [pair, r] of Object.entries(pairs)) assert.equal(r.out, 0, `${pose}: ${pair}`);
  }
  assert.ok(m.triangles <= 50000, `${m.triangles} triangles`);
  for (const k of ['blue', 'cream', 'brass', 'boot']) assert.ok(m.atlas.palette[k], `palette ${k}`);
});

test('the moss gardener: shirt, shorts, socks, waistcoat and its pockets; forearms, knees and shins bare; his skin through nothing', () => {
  const m = outfit('moss-gardener');
  assert.deepEqual(Object.keys(m.parts).sort(), ['GardenBoots', 'GardenGear', 'GardenShirt', 'Shorts', 'Socks', 'Waistcoat']);
  for (const a of ['chest', 'belly', 'hips', 'shin_lower.L', 'shin_lower.R']) assert.ok(m.hides.includes(a), a);
  for (const a of ['forearm_upper.L', 'knee.L', 'knee.R', 'shin.L', 'shin.R']) assert.ok(!m.hides.includes(a), `${a} shows his skin`);
  skinClear(m);
  assert.ok(m.triangles <= 50000, `${m.triangles} triangles`);
  for (const k of ['moss', 'ochre', 'rust', 'turquoise', 'wool']) assert.ok(m.atlas.palette[k], `palette ${k}`);
});

test('the salt pilgrim: robe and its hood, tunic, sash, trousers, sandals on soles (no boots); the skirts swing within bounds at full stride', () => {
  const m = outfit('salt-pilgrim');
  assert.deepEqual(Object.keys(m.parts).sort(), ['Hood', 'PilgrimTrousers', 'Robe', 'Sandals', 'Sash', 'Soles', 'Tunic']);
  assert.equal(m.parts.Soles.prop, 'weighted', 'the soles and toes: a prop');
  // #591: waist ease keeps the swinging tunic within 3 mm of the robe.
  // The sash still has one covered inner-tunic intersection in jog-b.
  for (const pose of RUNNING) {
    const p = m.pokes.posed[pose];
    assert.ok(p['PilgrimTrousers>Tunic'].deepestMm <= 25 && p['PilgrimTrousers>Tunic'].out <= 15, `${pose}: trousers through the tunic ${JSON.stringify(p['PilgrimTrousers>Tunic'])}`);
    assert.ok(p['Tunic>Robe'].deepestMm <= 3 && p['Tunic>Robe'].out <= 4, `${pose}: the tunic through the robe ${JSON.stringify(p['Tunic>Robe'])}`);
    assert.ok(p['Tunic>Sash'].deepestMm <= 22 && p['Tunic>Sash'].out <= 1, `${pose}: tunic through sash ${JSON.stringify(p['Tunic>Sash'])}`);
    assert.ok(p['Sash>Robe'].deepestMm <= 4 && p['Sash>Robe'].out <= 1, `${pose}: sash through robe ${JSON.stringify(p['Sash>Robe'])}`);
    assert.ok(p['PilgrimTrousers>Robe'].deepestMm <= 35 && p['PilgrimTrousers>Robe'].out <= 15, `${pose}: trousers through the robe ${JSON.stringify(p['PilgrimTrousers>Robe'])}`);
  }
  // the robe as white as the sheet's paper, the hood's colour the robe's
  assert.ok(m.atlas.palette.robe.every((c) => c >= 220) && m.atlas.palette.robe[0] >= 245, `robe ${m.atlas.palette.robe}`);
  // the sandals' feet over his: the body's feet and ankles hidden, the sandals hide them as well
  for (const a of ['foot.L', 'foot.R', 'ankle.L', 'ankle.R', 'upperarm.L', 'forearm_upper.R', 'thigh.L', 'knee.R']) assert.ok(m.hides.includes(a), a);
  assert.ok(m.skinCut.length >= 1, 'his forearms under the full sleeves cut');
  skinClear(m);
  // standing (the previews' pose, idle) the skirts lie over his legs: nothing through by more than 1.5 cm
  for (const pose of ['lowered', 'idle']) {
    for (const [pair, r] of Object.entries(m.pokes.posed[pose])) assert.ok(r.deepestMm <= 15, `${pose}: ${pair} out by ${r.deepestMm} mm`);
  }
  // running: the leg-through is a few dozen verts at most, the robe never torn open by his legs wholesale
  for (const pose of RUNNING) {
    for (const [pair, r] of Object.entries(m.pokes.posed[pose])) {
      const under = m.pokes.under[pair];
      assert.ok(r.out <= Math.max(25, 0.02 * under), `${pose}: ${pair} ${r.out} of ${under} verts out`);
    }
  }
  assert.ok(m.triangles <= 50000, `${m.triangles} triangles`);
  for (const k of ['robe', 'saffron', 'rose', 'turquoise', 'terracotta', 'skin']) assert.ok(m.atlas.palette[k], `palette ${k}`);
});

// #547: the salt pilgrim's skirts swing (src/characters/outfits.js, SkirtSwing; outfit_kit.py builds the same
// rule into Blender for the checks and the previews)
const pilgrimSwing = () => swingSpecOf(outfit('salt-pilgrim'));

test('only the salt pilgrim asks for a skirt swing: its robe and its tunic', () => {
  for (const o of others) {
    const s = swingSpecOf(outfit(o.id));
    if (o.id === 'salt-pilgrim') assert.deepEqual(Object.keys(s.garments).sort(), ['Robe', 'Tunic']);
    else assert.equal(s, null, `${o.id} asks for no swing`);
  }
  const plan = planOutfit(list, base, { 'salt-pilgrim': outfit('salt-pilgrim') }, 'salt-pilgrim');
  assert.ok(plan.swing, 'the plan carries it');
});

test('the swing weights the skirts from their rest: down the skirt all swung, the hips untouched, each panel its own below the slits', () => {
  const spec = pilgrimSwing();
  const m = outfit('salt-pilgrim');
  const g = glb(DIR + 'outfits/salt-pilgrim/' + m.glb);
  const prim = g.meshes.Robe.mesh.primitives[0];
  const pos = g.accessor(prim.attributes.POSITION), index = g.accessor(prim.indices);
  let swung = 0, top = 0;
  const panel = [];
  for (let i = 0; i < pos.length; i += 3) {
    const [x, y, z] = [pos[i], pos[i + 1], pos[i + 2]];
    const { mix, w } = skirtSwingWeights(x, y, z, spec, 'Robe');
    const sum = w.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6, `weights add to ${sum}`);
    panel.push(SWING_PANELS.filter((_, k) => w[2 * k] + w[2 * k + 1] > 1e-6));
    if (y > spec.mix[0]) { assert.equal(mix, 0); top++; continue; }
    if (y < spec.mix[1]) { assert.equal(mix, 1); swung++; }
    // below the slits a vert is on one panel alone, its upper or its lower bone
    if (y < spec.garments.Robe.slitTop) assert.equal(panel.at(-1).length, 1, `vert at ${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)} on ${panel.at(-1)}`);
  }
  // and the panels part at the slits: no triangle below them joins two (it would tear as they swing apart)
  const slit = spec.garments.Robe.slitTop;
  for (let t = 0; t < index.length; t += 3) {
    const v = [index[t], index[t + 1], index[t + 2]];
    if (v.some((i) => pos[i * 3 + 1] >= slit - 0.01)) continue;
    assert.equal(new Set(v.map((i) => panel[i][0])).size, 1, `a triangle across panels at ${pos[v[0] * 3].toFixed(3)} ${pos[v[0] * 3 + 1].toFixed(3)}`);
  }
  assert.ok(swung > 3000 && top > 2000, `${swung} skirt verts swung, ${top} over the hips not`);
});

test('re-weighted skirts keep four weights adding to one, on the swing\'s bones down the skirt', () => {
  const spec = pilgrimSwing();
  const g = new T.BufferGeometry();
  const P = [[0.15, 0.95, 0.05], [0.15, 0.7, 0.08], [-0.12, 0.45, -0.1], [0.1, 1.2, 0.1]];
  g.setAttribute('position', new T.Float32BufferAttribute(P.flat(), 3));
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(P.flatMap(() => [1, 2, 0, 0]), 4));
  g.setAttribute('skinWeight', new T.Float32BufferAttribute(P.flatMap(() => [0.6, 0.4, 0, 0]), 4));
  const moved = weightSkirts(g, spec, { Robe: [0, 4] }, 53);
  assert.equal(moved, 3, 'the vert over the hips stays');
  for (let i = 0; i < 4; i++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += g.attributes.skinWeight.getComponent(i, k);
    assert.ok(Math.abs(s - 1) < 1e-5);
  }
  // the vert at mid-thigh on his left front: all on the front-left's upper bone (53)
  const bones = [0, 1, 2, 3].filter((k) => g.attributes.skinWeight.getComponent(1, k) > 0).map((k) => g.attributes.skinIndex.getComponent(1, k));
  assert.deepEqual(bones, [53]);
  assert.equal(g.attributes.skinIndex.getComponent(3, 0), 1, 'over the hips: its own weights');
});

/** A stand-in skeleton: the pelvis, the thighs and the calves at the v2 traveller's joints. */
function legs() {
  const root = new T.Bone();
  root.name = 'Root';
  const mk = (name, parent, p) => { const b = new T.Bone(); b.name = name; b.position.set(...p); parent.add(b); return b; };
  const pelvis = mk('pelvis', root, [0, 0.955, -0.043]);
  const b = { root, pelvis };
  for (const [s, x] of [['l', 1], ['r', -1]]) {
    b[`thigh_${s}`] = mk(`thigh_${s}`, pelvis, [0.109 * x, -0.024, 0.004]);
    b[`calf_${s}`] = mk(`calf_${s}`, b[`thigh_${s}`], [0.01 * x, -0.443, 0.017]);
  }
  root.updateMatrixWorld(true);
  return { b, skeleton: new T.Skeleton(Object.values(b)) };
}
const deg = (a) => (a * 180) / Math.PI;

test('the swing: a front panel goes with its thigh forward and hangs when it goes back, a back panel the other way; it lags and settles', () => {
  const spec = pilgrimSwing();
  const { b, skeleton } = legs();
  const s = new SkirtSwing(spec, skeleton, new T.Matrix4());
  s.settle();
  assert.ok(s.angles().every((a) => Math.abs(a) < 1e-6), 'at rest: hanging');
  // the left thigh forward 50 degrees (knee up): the front-left panel with it, the back-left hanging
  b.thigh_l.rotation.x = -50 / 57.2958;
  b.calf_l.rotation.x = 50 / 57.2958;      // (the knee bent: the shin hanging plumb)
  b.root.updateMatrixWorld(true);
  s.settle();
  let [flU, , frU, , blU] = s.angles().map(deg);
  assert.ok(Math.abs(flU - 50) < 1, `front-left with the thigh: ${flU}`);
  assert.ok(Math.abs(blU) < 1 && Math.abs(frU) < 1, 'the back-left and the right hang');
  // the panels' bones move the skirt: a vert of the front-left at the knee comes forward and up
  const v = new T.Vector3(0.12, 0.5, 0.1).applyMatrix4(s.bones[0].matrixWorld);
  assert.ok(v.z > 0.3 && v.y > 0.65, `the front-left panel's knee point at ${v.toArray().map((x) => x.toFixed(2))}`);
  // its lower bone hangs from the knee (plumb, the hang's share): about -45 relative to the upper
  assert.ok(Math.abs(deg(s.angles()[1]) + 0.9 * 50) < 2, `the lower hangs: ${deg(s.angles()[1])}`);
  // the thigh swings back 30 (the knee bent behind): the front-left lags down to hanging, the back-left goes back
  b.thigh_l.rotation.x = 30 / 57.2958;
  b.calf_l.rotation.x = 80 / 57.2958;
  b.root.updateMatrixWorld(true);
  for (let i = 0; i < 6; i++) s.update(1 / 60);
  [flU, , , , blU] = s.angles().map(deg);
  assert.ok(flU > 15 && flU < 50, `the front-left falls back, not at once: ${flU}`);
  assert.ok(blU <= -30 + 1e-6, `the back-left pushed back by the thigh: ${blU}`);
  for (let i = 0; i < 240; i++) s.update(1 / 60);
  const a = s.angles().map(deg);
  assert.ok(Math.abs(a[0]) < 0.5, `settled hanging: ${a[0]}`);
  assert.ok(Math.abs(a[4] + 30) < 0.5, `the back-left on the thigh: ${a[4]}`);
  assert.ok(a[5] >= -deg(spec.lowerReach) - 1e-6, 'the back panel\'s hem kicked back no further than its reach');
  // a stop (the body slowing) swings the hanging panels forward, then they settle again
  b.thigh_l.rotation.x = 0;
  b.calf_l.rotation.x = 0;
  b.root.updateMatrixWorld(true);
  for (let i = 0; i < 240; i++) s.update(1 / 60);
  for (let i = 0; i < 30; i++) { b.root.position.z += 0.1; b.root.updateMatrixWorld(true); s.update(1 / 60); }   // running at 6 m/s
  let peak = 0;
  for (let i = 0; i < 40; i++) {
    b.root.position.z += Math.max(0, 0.1 - i * 0.004);   // slowing to rest
    b.root.updateMatrixWorld(true);
    s.update(1 / 60);
    peak = Math.max(peak, deg(s.angles()[2]));
  }
  assert.ok(peak > 2, `the front-right swings forward as he stops: ${peak}`);
  for (let i = 0; i < 300; i++) s.update(1 / 60);
  assert.ok(s.angles().every((x) => Math.abs(deg(x)) < 0.5), 'and settles');
  // the pelvis leant forward 20 (his legs with it): the front panels hang plumb (the hang's share of it)
  b.pelvis.rotation.x = 20 / 57.2958;
  b.root.updateMatrixWorld(true);
  s.settle();
  assert.ok(Math.abs(deg(s.angles()[2]) - 0.8 * 20) < 1, `plumb: ${deg(s.angles()[2])}`);
  assert.ok(Math.abs(deg(s.angles()[6])) < 1e-6, 'a back panel not into his legs (they lean with him)');
});

test('the wardrobe swings the skirts of an outfit that asks, on bones of their own, and only that outfit', () => {
  const spec = pilgrimSwing();
  const { skeleton } = legs();
  const stub = { areas: ['chest'], parts: { Shirt: { kind: 'garment' }, Body: { kind: 'body' }, Skin: { kind: 'skin' } }, outfits: { default: { parts: ['Skin', 'Shirt'], hides: [] } } };
  const stubList = { outfits: [{ id: 'default', name: 'Own' }, { id: 'pilgrim', name: 'Pilgrim', dir: 'x/' }] };
  const baseG = { Body: geometry([tri(0, 1.3)], { _area: [0, 0, 0] }), Skin: geometry([tri(0.5, 1.3)], { _area: [-1, -1, -1] }), Shirt: geometry([tri(0, 1.3)]) };
  const parent = new T.Group();
  const w = new Wardrobe({ list: stubList, baseManifest: stub, base: baseG, parent,
    make: (g) => { const m = new T.SkinnedMesh(g); m.bind(skeleton, new T.Matrix4()); return m; } });
  w.add('pilgrim', { parts: { Robe: {}, Tunic: {} }, hides: [], skinCut: [], fit: { Robe: { relief: { swing: spec } } } },
    { Robe: geometry([[0.15, 0.7, 0.08, 0.16, 0.7, 0.08, 0.15, 0.71, 0.08]]), Tunic: geometry([tri(0.1, 1.2)]) });
  assert.equal(w.wear('default').swing, false);
  assert.equal(parent.children[1].skeleton.bones.length, skeleton.bones.length, 'his own clothes: the game\'s bones');
  const worn = w.wear('pilgrim');
  assert.equal(worn.swing, true);
  const clothes = parent.children[1];
  assert.equal(clothes.skeleton.bones.length, skeleton.bones.length + 8);
  const pelvis = skeleton.bones.find((x) => x.name === 'pelvis');
  assert.ok(pelvis.children.some((c) => c.name === 'SkirtSwing'), 'its driver under the pelvis');
  // the robe's verts on the front-left panel's upper bone
  assert.equal(clothes.geometry.attributes.skinIndex.getComponent(0, 0), skeleton.bones.length);
  w.wear('default');
  assert.ok(!pelvis.children.some((c) => c.name === 'SkirtSwing'), 'taken off with the outfit');
});

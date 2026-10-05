import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The MakeHuman bodies, stage 1 (docs/makehuman.md): one parametric body (scripts/makehuman/build.py
// -> public/anim/mh/body.json + .bin), made into anyone on load (src/makehuman/body.js, shape.js),
// MakeHuman's own CC0 hair as shells with strand lines (hair.js), the people of a world by age and
// build (people.js), behind the studio's Body source and the game's ?mh=1; the Quaternius bodies
// left exactly as they were.

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { parseBody, shapeOf, part, makeBody, headScale, BONES, openEyes } = await import('../src/makehuman/body.js');
const { ageSlider, cornerWeights, nodeWeights, personParams, paramsKey, MH_BUILDS, AGES, WORLD_BODIES, faceTargets } = await import('../src/makehuman/shape.js');
const { personTemplate, MakeHumanPeople, filterFace, ageClassOf } = await import('../src/makehuman/people.js');
const { MH_HAIR, MH_STYLES, mhStyleOf, hairFor, splitLocks, mhLookPieces } = await import('../src/makehuman/hair.js');
const { keyWeights, inkShare, INK_SHARE } = await import('../src/makehuman/face-keys.js');
const { Humanoid, prepareHuman, FACE } = await import('../src/humanoid.js');
const { EAR_Z } = await import('../src/face-ink.js');
const { buildCharacter } = await import('../src/player.js');
const { TONE_EXPRESSIONS, cleanExpression } = await import('../src/expression.js');
const { HAIR_IDS, COSTUME_WORLDS } = await import('../src/costumes.js');
const { BLANK } = await import('../src/studio/people.js');
const { mhLineup, mhEntry, mhDef, likeDef, mhBuildsLineup, mhHairLineup, MH_PRESETS } = await import('../src/studio/makehuman.js');
const { DEFAULTS, encodeState, decodeState } = await import('../src/studio/state.js');
const { SkinnedLod } = await import('../src/skinned-lod.js');
const { triCount } = await import('../src/lod.js');
const { Hands, HAND_POSES } = await import('../src/hands.js');

const url = (p) => new URL(`../public/anim/${p}`, import.meta.url);
const meta = JSON.parse(readFileSync(url('mh/body.json'), 'utf8'));
const bin = readFileSync(url('mh/body.bin'));
const data = parseBody(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const parse = async (p) => {
  const b = await readFile(url(p));
  return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene;
};
const KEYS = ['smile', 'frown', 'jawOpen', 'browInnerUp', 'browDown', 'browOuterUp', 'blink', 'squint'];
const look = (o = {}) => ({ ...BLANK(o.kind ?? 'm'), ...o });

test('one parametric body for everyone: about 2 MB, MakeHuman\'s macro corners, the game\'s bones, face keys, the hair', () => {
  const bytes = statSync(url('mh/body.bin')).size + statSync(url('mh/body.json')).size;
  assert.ok(bytes < 2.2e6, `${(bytes / 1e6).toFixed(2)} MB`);
  assert.ok(gzipSync(bin).length < 1.4e6, 'compresses well');
  assert.ok(!existsSync(url('mh/man.glb')) && !existsSync(url('mh/people.json')), 'no baked people any more');
  assert.ok(existsSync(url('mh/LICENSE-MakeHuman-CC0.txt')));
  // gender x age x muscle x weight corners, height and proportions at each gender and age
  assert.equal(meta.nodes.filter((n) => n.kind === 'universal').length, 2 * 4 * 3 * 3);
  assert.ok(meta.nodes.some((n) => n.kind === 'height') && meta.nodes.some((n) => n.kind === 'proportions'));
  assert.ok(meta.K >= 8 && meta.K <= 48, `${meta.K} components`);
  assert.ok(meta.error.head < 0.005, `the head within ${(meta.error.head * 1000).toFixed(1)} mm at every corner`);
  const names = meta.bones.map((b) => b.name);
  for (const b of BONES) assert.ok(names.includes(b), b);
  for (const f of ['index', 'middle', 'ring', 'pinky', 'thumb']) for (const s of ['l', 'r']) for (const j of [1, 2, 3]) assert.ok(names.includes(`${f}_0${j}_${s}`), `${f}_0${j}_${s} (the hands)`);
  for (const k of KEYS) assert.ok(meta.keys[k]?.count > 0, `the key ${k}`);
  for (const st of [...MH_STYLES, 'beard']) assert.ok(meta.hair[st]?.triangles > 300 && meta.hair[st].triangles < 4000, `${st}: ${meta.hair[st]?.triangles} triangles`);
  for (const t of ['belly', 'hips', 'eyes', 'chinLong', 'cheekLean', 'noseLong']) assert.ok(meta.targets[t]?.count > 0, `the target ${t}`);
  assert.ok(meta.parts.body.count > 5000 && meta.parts.body.count < 7000);
});

test('MakeHuman\'s macro blend: the age slider, the corner weights, a corner is its own sample, height and proportions lean', () => {
  assert.equal(ageSlider(1), 0); assert.equal(ageSlider(11), 0.1875); assert.equal(ageSlider(25), 0.5); assert.equal(ageSlider(90), 1);
  assert.ok(ageSlider(8) > 0 && ageSlider(8) < 0.1875 && ageSlider(50) > 0.5);
  assert.deepEqual(cornerWeights(0.25, [0, 0.5, 1]), [0.5, 0.5, 0]);
  for (const p of [personParams({ kind: 'f', years: 7 }), personParams({ kind: 'm', years: 72, build: 'heavy', world: 'desert' }), { gender: 0.3, age: 0.7, muscle: 0.2, weight: 0.9, height: 0.8, proportions: 0.1 }]) {
    const w = nodeWeights(meta, p);
    assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'sums to 1');
    meta.nodes.forEach((n, i) => { if (n.kind !== 'universal') assert.ok(w[i] >= 0); });
  }
  const i = meta.nodes.findIndex((n) => n.kind === 'universal' && n.gender === 1 && n.age === 0.5 && n.muscle === 1 && n.weight === 0);
  const w = nodeWeights(meta, { gender: 1, age: 0.5, muscle: 1, weight: 0, height: 0.5, proportions: 0.5 });
  assert.equal(w[i], 1, 'a corner is exactly its sample');
  const tall = nodeWeights(meta, { gender: 1, age: 0.5, muscle: 0.5, weight: 0.5, height: 1, proportions: 0.5 });
  assert.equal(tall[meta.nodes.findIndex((n) => n.id === 'h-1-0.5-1')], 1, 'the tall lean at full');
  // the bodies themselves: a child is small, a man taller than a woman (true size), the heavy wider
  const size = (p) => shapeOf(data, p).size;
  assert.ok(size(personParams({ kind: 'f', years: 7 })) < 0.75);
  assert.ok(size(personParams({ kind: 'm' })) > size(personParams({ kind: 'f' })));
  const waist = (p) => { const b = part(data, shapeOf(data, p).pos, 'body'); let w = 0; for (let k = 0; k < b.length; k += 3) if (Math.abs(b[k + 1] - 1.08) < 0.1) w = Math.max(w, b[k + 2]); return w; };
  assert.ok(waist(personParams({ build: 'heavy' })) > waist(personParams({ build: 'slim' })) + 0.03, 'the heavy have a belly');
  assert.notEqual(paramsKey(personParams({ build: 'slim' })), paramsKey(personParams({ build: 'broad' })));
  for (const w2 of COSTUME_WORLDS.filter((x) => !['lab', 'atelier'].includes(x))) assert.ok(WORLD_BODIES[w2], `${w2}'s people have their proportions`);
  // the Moebius face for grown-ups, none on a child; bigger eyes for everyone, more for a child
  assert.ok(faceTargets('m', 35).chinLong > 0.4 && !faceTargets('f', 7).chinLong);
  assert.ok(faceTargets('f', 7).eyes > faceTargets('m', 35).eyes && faceTargets('m', 35).eyes > 0);
});

test('a MakeHuman person is a Humanoid template: the game bones, its own landmarks, a face on shape keys, open eyes', () => {
  const tpl = personTemplate(data, { kind: 'm', years: 35, build: 'broad', world: 'desert' });
  const prof = tpl.userData.profile;
  const names = new Set();
  tpl.traverse((o) => { if (o.isBone) names.add(o.name); });
  for (const b of BONES) assert.ok(names.has(b), b);
  const h = new Humanoid(tpl, buildCharacter(), 'm');
  assert.equal(h.profile, prof);
  assert.deepEqual(h.faceRest, prof.face);
  const [eyeY, eyeX, noseY, noseZ, chinY] = prof.face;
  assert.ok(eyeY > noseY && noseY > chinY && eyeX > 0.02 && eyeX < 0.05 && noseZ > 0.05, `${prof.face}`);
  assert.ok(Math.abs(prof.outfit[1] - meta.hipY) < 0.01, 'the hips where the Quaternius man\'s are');
  assert.ok(h.eyeMesh?.userData.eyeball && h.faceKeys?.brows, 'the eyeballs measured, the brows on keys');
  const body = h.body, smile = body.morphTargetDictionary.smile;
  h.setExpression(TONE_EXPRESSIONS.happy);
  assert.ok(body.morphTargetInfluences[smile] > 0.5, 'a happy face smiles on its shape key');
  assert.ok(Math.abs(body.material.uniforms.uMood.value.x - TONE_EXPRESSIONS.happy.smile * INK_SHARE.smile) < 1e-6, 'the ink draws its share');
  h.setExpression(TONE_EXPRESSIONS.surprised);
  assert.equal(body.morphTargetInfluences[smile], 0);
  assert.ok(h.browMesh.morphTargetInfluences[h.browMesh.morphTargetDictionary.browOuterUp] > 0.5, 'the brows go up with the skin');
  // the lids close on their key, the eyeball's painted lid with them
  h.char.root.updateMatrixWorld(true);
  h.eyeLook.blink = 1;
  h.updateEyes(0);
  assert.equal(h.eyeMesh.material.uniforms.uEyeLook.value.w, 1);
  assert.equal(body.morphTargetInfluences[body.morphTargetDictionary.blink], 1);
  // the eyes opened: no skin of the upper lid over the iris's top at rest
  const pos = Float32Array.from(part(data, shapeOf(data, prof.params).pos, 'body')), eyes = Float32Array.from(part(data, shapeOf(data, prof.params).pos, 'eyes'));
  const { center: C, radii: R } = openEyes(pos, eyes);
  let lidLow = Infinity;
  for (let i = 0; i < pos.length; i += 3) if (Math.abs(Math.abs(pos[i]) - C[0]) < R[0] * 0.25 && pos[i + 2] > C[2] + R[2] * 0.6 && pos[i + 1] > C[1] - 0.001) lidLow = Math.min(lidLow, pos[i + 1] - C[1]);
  assert.ok(lidLow > 0.0015, `the upper lid's rim ${(lidLow * 1000).toFixed(1)} mm over the eye's centre`);
  // a build is the body's own MakeHuman shape (keys kept), on the same skeleton
  const g0 = h.body.geometry;
  h.setBuild('heavy');
  assert.notEqual(h.body.geometry, g0);
  assert.equal(h.body.geometry.attributes.position.count, g0.attributes.position.count);
  assert.ok(h.body.geometry.morphAttributes.position?.length, 'the face keys kept');
  h.setBuild('broad');
  assert.equal(h.body.geometry, g0, 'its own build: the template\'s body');
  // the skull for the hats
  assert.ok(headScale(prof.skull, 'm').every((k) => k > 0.8 && k < 1.35));
});

test('MakeHuman\'s own hair: every style a closed shell fitted to the head, skinned to the head and neck, strand lines between its locks', () => {
  for (const kind of ['m', 'f']) for (const years of [8, 35, 72]) {
    const tpl = personTemplate(data, { kind, years });
    const prof = tpl.userData.profile, P = prof.body;
    let top = -Infinity;
    for (const i of data.head) top = Math.max(top, P[i * 3 + 1]);
    for (const st of [...MH_STYLES, 'beard']) {
      const s = hairFor(prof, st), G = s.geo.attributes.position;
      let maxY = -Infinity, minY = Infinity;
      for (let i = 0; i < G.count; i++) { maxY = Math.max(maxY, G.getY(i)); minY = Math.min(minY, G.getY(i)); }
      if (st !== 'beard') assert.ok(maxY > top && maxY < top + 0.06, `${st} on a ${kind} ${years}: over the crown (${(maxY - top).toFixed(3)})`);
      else assert.ok(maxY < prof.face[0] && minY > prof.face[4] - 0.08, 'the beard on the jaw');
      const names = meta.bones.map((b) => b.name);
      for (let i = 0; i < G.count; i++) {
        for (let q = 0; q < 4; q++) if (s.weights[i * 4 + q] > 0) assert.ok(['Head', 'neck_01', 'spine_03', 'spine_02'].includes(names[s.joints[i * 4 + q]]), `${st}: never the arms`);
      }
    }
  }
  // the locks: their borders split, each side's normals turned into the groove (a crease the ink draws)
  const prof = personTemplate(data, { kind: 'f', years: 28 }).userData.profile, s = hairFor(prof, 'bob02');
  assert.ok(s.locks >= 5);
  const P = s.geo.attributes.position, N = s.geo.attributes.normal, at = new Map();
  let creases = 0, pairs = 0;
  for (let i = 0; i < P.count; i++) {
    const k = `${P.getX(i).toFixed(6)}|${P.getY(i).toFixed(6)}|${P.getZ(i).toFixed(6)}`;
    const j = at.get(k);
    if (j === undefined) { at.set(k, i); continue; }
    pairs++;
    if (N.getX(i) * N.getX(j) + N.getY(i) * N.getY(j) + N.getZ(i) * N.getZ(j) < Math.cos((40 * Math.PI) / 180)) creases++;
  }
  assert.ok(pairs > 100 && creases > pairs * 0.4, `${creases} of ${pairs} border points a crease`);
  const sp = splitLocks([0, 1, 2, 1, 3, 2], [0, 0, 0, 1], 4);
  assert.equal(sp.from.length, 4, 'a vertex shared by triangles of one lock is not split');
});

test('the game\'s hairstyles on a MakeHuman head: MakeHuman\'s nearest style, the game\'s knots on top, hats on the skull, the beard on the jaw', () => {
  for (const id of HAIR_IDS) assert.ok(MH_HAIR[id], `${id} has a MakeHuman way`);
  for (const H of Object.values(MH_HAIR)) for (const st of [...(H.all ?? []), ...(H.m ?? []), ...(H.f ?? [])]) assert.ok(MH_STYLES.includes(st));
  assert.equal(mhStyleOf(look({ head: 'curls' })), 'afro01');
  assert.equal(mhStyleOf(look({ head: 'short' })), mhStyleOf(look({ head: 'short' })), 'the same person, the same style');
  assert.equal(mhStyleOf(look({ head: 'bald' })), null);
  assert.equal(mhStyleOf(look({ head: 'sunhat', mhHair: 'bob01' })), 'bob01', 'the studio forces one');
  const tpl = personTemplate(data, { kind: 'm', years: 50 });
  const h = new Humanoid(tpl, buildCharacter(), 'm');
  const pieces = mhLookPieces(look({ head: 'bun', mask: 'beard' }), h);
  assert.equal(pieces.skinned.length, 2, 'the hair and the beard: skinned shells');
  assert.ok(pieces.head.length > 0, 'the bun\'s knot, the game\'s');
  const hat = mhLookPieces(look({ head: 'sunhat' }), h);
  assert.equal(hat.skinned.length, 0);
  assert.ok(hat.head.length > 1, 'the hat and the short hair under it');
  h.dress(look({ head: 'braid', mask: 'beard' }));
  const n = h._costume[0].geometry.attributes.position.count;
  assert.ok(n > hairFor(h.profile, 'braid01').geo.attributes.position.count, 'dressed in it');
  assert.ok([...Humanoid._costumes.keys()].some((k) => k.startsWith(`${h.profile.id}|`) && k.endsWith('|braid01')), 'cached per body and style');
});

test('each world\'s people: their body by age and build, a child a child\'s, the crowd\'s pooled bodies grown-ups taking each build', () => {
  const people = new MakeHumanPeople(data, 'desert');
  const [m, f] = people.humans();
  assert.equal(m.userData.mhPeople, people);
  assert.equal(m.userData.profile.kind, 'm'); assert.equal(f.userData.profile.kind, 'f');
  assert.equal(ageClassOf({ def: { age: 'child' } }), 'child');
  assert.equal(ageClassOf({ dress: { faceType: 'elder' } }), 'elder');
  const lou = people.templateFor({ kind: 'm', def: { age: 'child', kind: 'f', body: 'm' } });
  assert.equal(lou.userData.profile.kind, 'f', 'a story child is a girl or a boy of their own kind');
  assert.ok(lou.userData.profile.heightFix < 0.98, 'stands as tall as the story says (its bigger head taken off)');
  assert.ok(lou.userData.profile.young > 0.9, 'a child\'s face drawn bare');
  assert.equal(people.templateFor({ kind: 'f', dress: { build: 'heavy' } }), people.template('f', 'adult', 'heavy'));
  assert.equal(people.templateFor({ kind: 'm', pooled: true, dress: { build: 'heavy' } }), people.template('m'), 'a pooled body: a grown-up of average build');
  // the game's face morphs: a child keeps only the ink, a grown-up half the shapes
  assert.deepEqual(filterFace({ eyeSize: 1.45, lines: 0, freckles: 0.6, young: 1 }, true), { lines: 0, freckles: 0.6, young: 1 });
  assert.ok(Math.abs(filterFace({ faceLength: 1.1, eyeSize: 1.4 }, false).faceLength - 1.05) < 1e-9 && filterFace({ eyeSize: 1.4 }, false).eyeSize <= 1.1);
  const hl = new Humanoid(lou, buildCharacter(), 'm');
  hl.setMorph({ headSize: 1.3, legLength: 0.76 });
  assert.equal(hl.morph, null, 'no Quaternius child morphs on a MakeHuman child');
  // the hands work on its fingers: relaxed and a fist differ
  const hands = hl.hands ?? new Hands(hl);
  assert.equal(hands.sides.length, 2);
  assert.ok(hands.sides.every((S) => S.joints.length >= 8 && S.thumb.length >= 2), 'the finger joints found');
  hands.set('relaxed');
  const q0 = hl.b.index_02_r.quaternion.clone();
  hands.set('fist');
  assert.ok(hl.b.index_02_r.quaternion.angleTo(q0) > 0.5, 'a fist curls the fingers');
  assert.ok(HAND_POSES.fist);
});

test('a far MakeHuman body draws a simpler mesh too: its levels without the shape keys, the full one (keys and all) up close', () => {
  const H = new Humanoid(personTemplate(data, { kind: 'f', years: 30 }), buildCharacter(), 'f');
  H.update();
  const lod = (H.lod = new SkinnedLod(H, { sync: true }));
  const full = H.body.geometry;
  assert.ok(full.morphAttributes.position?.length);
  assert.equal(lod.update(3, 1, 1000, 1), -Infinity);
  assert.equal(H.body.geometry, full);
  const j = lod.update(70, 1, 1000, 1);
  assert.ok(j > -Infinity, 'far: a level');
  const g = H.body.geometry;
  assert.notEqual(g, full);
  assert.ok(triCount(g) < triCount(full) * 0.6, `${triCount(full)} -> ${triCount(g)}`);
  assert.equal(Object.keys(g.morphAttributes).length, 0, 'no shape keys on the level');
  assert.ok(!H.eyeMesh.visible && !H.browMesh.visible, 'the eyes and brows hidden');
  H.setExpression(TONE_EXPRESSIONS.happy);   // (an expression far off: the keys' weights are set, nothing breaks)
  lod.update(3, 1, 1000, 1);
  assert.equal(H.body.geometry, full, 'up close the full mesh again');
});

test('the game\'s own bodies are as they were: no profile, the per-kind tables, no shape keys', async () => {
  const h = new Humanoid(prepareHuman(await parse('human_f.glb'), 'f'), buildCharacter(), 'f');
  assert.equal(h.profile, null);
  assert.equal(h.faceKeys, null);
  assert.equal(h.earZ, EAR_Z.f);
  assert.equal(h.faceRest[0], FACE.f[0]);
  h.setExpression(TONE_EXPRESSIONS.happy);
  assert.equal(h.body.material.uniforms.uMood.value.x, TONE_EXPRESSIONS.happy.smile, 'the ink draws the whole expression');
  h.setExpression({ brow: 1 });
  assert.ok(h._browBase, 'the brows posed on the CPU as before');
  // ?mh=1 only: the game's default people stay Quaternius
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /query\.get\('mh'\) === '1'/);
  assert.match(main, /player\.humanoid = new Humanoid\(humanT\[0\]/, 'the traveller on his own body');
});

test('expressions become shape keys: each tone pulls its own', () => {
  const w = (tone) => keyWeights(cleanExpression(TONE_EXPRESSIONS[tone]));
  assert.deepEqual(keyWeights(cleanExpression({})), { blink: 0 });
  assert.ok(w('happy').smile > 0.5 && !w('happy').frown);
  assert.ok(w('sad').frown > 0.4 && w('sad').browInnerUp > 0.6);
  assert.ok(w('angry').browDown > 0.8 && w('angry').squint > 0);
  assert.ok(w('surprised').jawOpen > 0.2 && w('surprised').browOuterUp > 0.6);
  for (const t of Object.keys(TONE_EXPRESSIONS)) for (const v of Object.values(w(t))) assert.ok(v >= 0 && v <= 1.2);
  const ink = inkShare(cleanExpression({ smile: 1, brow: -1 }));
  assert.equal(ink.smile, INK_SHARE.smile);
  assert.equal(ink.brow, -1, 'the frown creases stay the ink\'s');
});

test('the studio: MakeHuman a body source of its own, the comparison pairs, every age and build, every hairstyle', () => {
  assert.equal(DEFAULTS.source, 'quaternius');
  assert.equal(encodeState(DEFAULTS), '');
  assert.equal(decodeState('source=makehuman&mh=child&lineup=mhhair').lineup, 'mhhair');
  const pairs = mhLineup(8);
  assert.equal(pairs.length, MH_PRESETS.length * 2);
  assert.ok(pairs[0].twinOf && pairs[1].mh && pairs[0].twinOf === pairs[1].mh);
  assert.equal(mhLineup(8, 'child,man').length, 4);
  assert.equal(mhEntry('', 'f').kind, 'f');
  assert.ok(mhEntry('', 'f').years >= 18);
  assert.equal(mhEntry('', 'f', { child: true }).id, 'child');
  assert.equal(mhBuildsLineup('f').length, Object.keys(AGES).length * Object.keys(MH_BUILDS).length);
  assert.equal(mhBuildsLineup('m', 'elder').length, Object.keys(MH_BUILDS).length, 'one age');
  assert.equal(mhHairLineup('m').length, MH_STYLES.length + 1, 'and the beard');
  const child = MH_PRESETS.find((p) => p.id === 'child');
  assert.equal(mhDef(child, 0.64).scale, 0.64, 'their true size');
  assert.equal(likeDef(child).morph.headSize, child.like.morph.headSize);
  assert.ok(makeBody(data, personParams({ kind: 'f', years: 7 })).userData.profile.size < 0.75);
});

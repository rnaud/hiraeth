import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Warmer faces (TODO "Warmer faces on the current bodies"): people rest in a slight smile with their
// brows a touch raised, the mouth's corners never turned down at rest, softer and lighter brows, the
// lashes folded away and the upper lids lifted, a warm shade on the skin, gentler face shapes drawn
// per person from their people's odds, and some stern faces left by design.

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { PEOPLE_REST, REST_MOODS, REST_ODDS, restMood, TONE_EXPRESSIONS, expressionFor } = await import('../src/expression.js');
const { MOUTH_CORNER, cornerRise, faceYouth, FACE_INK_GLSL } = await import('../src/face-ink.js');
const { FACE_PRESETS, FACE_TYPES, FACE_ODDS, FACE_MORPHS, morphKey } = await import('../src/morph.js');
const { COSTUMES, crowdLook, namedLook, faceFor, browColour, tribeOf } = await import('../src/costumes.js');
const { FACE_SHADE } = await import('../src/post.js');
const { Humanoid, prepareHuman, LOWER_FACE, UPPER_LID } = await import('../src/humanoid.js');
const { buildCharacter } = await import('../src/player.js');
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');
const { mulberry32 } = await import('../src/noise.js');
const { PEOPLE: DESERT } = await import('../src/story/desert-data.js');

const load = async (kind) => {
  const bytes = await readFile(new URL(`../public/anim/human_${kind}.glb`, import.meta.url));
  return prepareHuman((await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene, kind);
};
const humans = { m: await load('m'), f: await load('f') };

test('people rest in a slight smile, the brows a touch raised, never knitted', () => {
  assert.ok(PEOPLE_REST.smile > 0.1 && PEOPLE_REST.smile < 0.35, `smile ${PEOPLE_REST.smile}`);
  assert.ok(PEOPLE_REST.brow > 0, 'the brows rest raised');
  assert.equal(PEOPLE_REST.squint, 0, 'the lids easy');
  for (const [k, m] of Object.entries(REST_MOODS)) if (k !== 'stern') {
    assert.ok(m.smile > 0, `${k}: a smile`);
    assert.ok((m.brow ?? 0) >= 0, `${k}: brows not lowered`);
  }
  // a tone still reads: sad, angry and solemn pull the mouth down from the resting smile
  for (const t of ['sad', 'angry', 'solemn']) assert.ok(expressionFor(t, { rest: PEOPLE_REST }).smile < 0, t);
  assert.ok(expressionFor('happy', { rest: PEOPLE_REST }).smile > PEOPLE_REST.smile);
  assert.ok(expressionFor('angry', { rest: PEOPLE_REST }).brow < 0, 'anger knits the brows');
  // a tone that says nothing about the mouth keeps the resting smile
  assert.equal(expressionFor('surprised', { rest: PEOPLE_REST }).smile, PEOPLE_REST.smile);
});

test("the mouth's corner ticks are never turned down at rest, only when sad", () => {
  for (const s of [0, 0.1, PEOPLE_REST.smile, 0.5, 1]) assert.ok(cornerRise(s) >= 0, `smile ${s}: ${cornerRise(s)}`);
  assert.ok(cornerRise(TONE_EXPRESSIONS.sad.smile) < -0.001, 'sad: down');
  assert.ok(cornerRise(1) > cornerRise(0.2));
  assert.ok(FACE_INK_GLSL.includes(String(MOUTH_CORNER.down)), 'the shader draws the same ticks');
});

test("moods and face shapes: most people kind, amused or curious; a few stern by design", () => {
  const n = 4000, count = {};
  for (let i = 0; i < n; i++) { const m = restMood(i / n); count[m] = (count[m] ?? 0) + 1; }
  const warm = (count.kind + count.amused + count.curious) / n;
  assert.ok(warm > 0.7, `warm moods ${warm.toFixed(2)}`);
  assert.ok(count.stern > 0 && count.stern / n < 0.1, `stern ${count.stern}`);
  assert.ok(REST_ODDS.stern > 0);
  // every tribe's odds name real shapes and moods; the bell monks and the bottom of the shaft keep some sternness
  for (const [w, set] of Object.entries(COSTUMES)) for (const T of set.tribes) {
    for (const k of Object.keys(T.faces)) assert.ok(FACE_TYPES[k], `${w} / ${T.name}: face ${k}`);
    for (const k of Object.keys(T.moods)) assert.ok(REST_MOODS[k], `${w} / ${T.name}: mood ${k}`);
  }
  assert.ok(COSTUMES.arzach2.tribes[0].moods.stern > 0);
  // few shapes, so few warped copies of the body: every shape's geometry key, plus the modelled face
  const keys = new Set(Object.values(FACE_TYPES).map((f) => morphKey(f, FACE_MORPHS, (d) => !d.ink)));
  assert.ok(keys.size <= 3, `${keys.size} geometries`);
  assert.equal(morphKey(FACE_TYPES.elder, FACE_MORPHS, (d) => !d.ink), '', "an elder's face is lines on the same head");
});

test("a person's face and mood come with their look, seeded, without changing the rest of the look", () => {
  const a = namedLook({ world: 'desert', id: 'someone' }), b = namedLook({ world: 'desert', id: 'someone' });
  assert.deepEqual(a.face, b.face);
  assert.equal(a.mood, b.mood);
  assert.deepEqual(a.rest, REST_MOODS[a.mood]);
  // a crowd's looks: various faces and moods
  const rng = mulberry32(7), looks = Array.from({ length: 120 }, () => crowdLook(rng, { world: 'bazaar' }));
  assert.ok(new Set(looks.map((l) => l.faceType)).size >= 3);
  assert.ok(new Set(looks.map((l) => l.mood)).size >= 3);
  assert.ok(looks.every((l) => l.face.lines >= 0.4 && l.face.lines <= 2), 'lines in range');
  assert.ok(looks.filter((l) => l.faceType === 'elder').every((l) => l.face.lines >= 1.6), 'elders keep their lines');
  // the story can say
  const T = tribeOf('desert');
  assert.deepEqual(faceFor(T, mulberry32(1), { mood: 'stern' }).rest, REST_MOODS.stern);
  assert.deepEqual(faceFor(T, mulberry32(1), { face: { cheeks: 0.3 } }).face, { cheeks: 0.3 });
});

test('the presets are gentler: no hollow cheeks or heavy brows but the elders\' and the weathered', () => {
  for (const [k, f] of Object.entries(FACE_PRESETS)) {
    if (/elder|Weathered/.test(k)) continue;
    assert.ok((f.cheeks ?? 0) > -0.3, `${k}: cheeks ${f.cheeks}`);
    assert.ok((f.browRidge ?? 0) <= 0.5, `${k}: brow ${f.browRidge}`);
  }
  assert.ok(FACE_PRESETS['Gaunt elder'].lines > 1.5 && FACE_PRESETS.Weathered.lines > 1.5, 'the elders keep their lines');
  assert.equal(faceYouth(FACE_PRESETS.Kind) < 0.3, true, 'a kind face is still a grown one');
  assert.ok(LOWER_FACE < 1.22, 'a shorter lower face than the old gaunt one');
  assert.ok(UPPER_LID > 0);
});

test('softer brows: the hair\'s colour toward the skin, lighter', () => {
  const lum = (h) => { const c = new THREE.Color(h); return 0.3 * c.r + 0.55 * c.g + 0.15 * c.b; };
  for (const hair of ['#2b211f', '#4a3226', '#a8552e']) {
    const b = browColour(hair, '#d9a98a');
    assert.ok(lum(b) > lum(hair), `${hair} -> ${b}`);
    assert.ok(lum(b) < lum('#d9a98a'), 'still darker than the skin');
  }
});

test("a face's shade is warm: the tint's darkness in a skin tone", () => {
  const t = FACE_SHADE.tone.slice(5).match(/[\d.]+/g).map(Number);
  assert.ok(t[0] > t[1] && t[1] > t[2], 'redder than it is blue');
  assert.ok(Math.abs(0.3 * t[0] + 0.55 * t[1] + 0.15 * t[2] - 1) < 0.06, 'about as dark as the tint');
  assert.ok(+FACE_SHADE.warm > 0.5);
});

test('on a body: everyone rests kindly, wears their look\'s face, and the story still wins', () => {
  const h = new Humanoid(humans.m, buildCharacter(), 'm');
  assert.ok(h.restExpression.smile > 0 && h.body.material.uniforms.uMood.value.x > 0, 'a blank body smiles a little');
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const def = DESERT.ama;
  const npc = new NPC(scene, physics, { route: [new THREE.Vector3(3, 0, 3)], lines: ['…'], human: humans[def.kind === 'f' ? 'f' : 'm'], kind: def.kind === 'f' ? 'f' : 'm', def, world: 'desert' });
  assert.deepEqual(npc.humanoid.ownFace, npc.look.face, 'their look\'s face');
  assert.deepEqual(npc.humanoid.restExpression, { ...npc.humanoid.restExpression, ...REST_MOODS[npc.look.mood] }, 'their look\'s mood');
  // a spawn spot's face and expression win
  const own = new NPC(scene, physics, { route: [new THREE.Vector3(5, 0, 5)], lines: ['…'], human: humans.f, kind: 'f', face: FACE_PRESETS['Wide-eyed'], expression: TONE_EXPRESSIONS.scared });
  assert.equal(own.humanoid.face.eyeSize, FACE_PRESETS['Wide-eyed'].eyeSize);
  assert.equal(own.humanoid.restExpression.brow, TONE_EXPRESSIONS.scared.brow);
  own.restyle(crowdLook(mulberry32(3), { world: 'desert', kind: 'f' }));
  assert.equal(own.humanoid.face.eyeSize, FACE_PRESETS['Wide-eyed'].eyeSize, 'a restyle keeps their own face');
  // the brows take the softened colour
  const brows = npc.humanoid.browMesh.material.uniforms.uColor.value.getHexString();
  assert.equal('#' + brows, browColour(npc.look.hair, npc.look.skin));
});

test("a crowd body takes each person's face and mood, and lets the last face's brows go", async () => {
  const { pooledNPC } = await import('../src/npc.js');
  const scene = new THREE.Scene();
  const physics = new Physics(scene);
  const n = pooledNPC(scene, physics, { kind: 'f', humans: [humans.m, humans.f] });
  const person = (seed) => ({ style: crowdLook(mulberry32(seed), { world: 'bazaar', kind: 'f' }), size: 1, pos: new THREE.Vector3(seed, 0, 0), heading: 0, lines: ['…'], lineIdx: 0, phase: 0, id: seed });
  const a = person(11), b = person(12);
  n.assign(a, null);
  assert.deepEqual(n.humanoid.ownFace, a.style.face);
  assert.ok(Math.abs(n.humanoid.body.material.uniforms.uFaceKit.value.x - a.style.face.lines) < 1e-6, 'their age lines in the ink');
  const browsA = n.humanoid.browMesh.geometry;
  let gone = false;
  browsA.addEventListener('dispose', () => { gone = true; });
  n.release();
  n.assign(b, null);
  assert.deepEqual(n.humanoid.ownFace, b.style.face);
  assert.deepEqual(n.humanoid.restExpression, { ...n.humanoid.restExpression, ...REST_MOODS[b.style.mood] });
  assert.ok(gone, "the last person's brows disposed");
});

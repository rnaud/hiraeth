import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The people's faces drawn the Moebius way (src/face-ink.js): the detail by the face's size on
// screen, the nose line on the shade's side, the ears, the flat face and its rounded light, the
// brows as one tapered stroke; and the Lab's gallery of giant faces (src/levels/lab.js).

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { FACE_LOD, FACE_HATCH_PX, faceDetail, noseSide, EAR_Z, FACE_INK_GLSL, FACE_ROUND } = await import('../src/face-ink.js');
const { makeMaterial, sharedUniforms, MODE_OUTFIT } = await import('../src/materials.js');
const { Humanoid, prepareHuman, taperBrows } = await import('../src/humanoid.js');
const { buildCharacter } = await import('../src/player.js');
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');
const { FACE_PRESETS } = await import('../src/morph.js');
const { TONE_EXPRESSIONS } = await import('../src/expression.js');
const { LAB_FACES, FACE_WALK, createLab } = await import('../src/levels/lab.js');
const { CONTENT } = await import('../src/levels/content.js');
const { TRAVELLER } = await import('../src/traveller.js');

const load = async (kind) => {
  const bytes = await readFile(new URL(`../public/anim/human_${kind}.glb`, import.meta.url));
  return prepareHuman((await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene, kind);
};
const humans = { m: await load('m'), f: await load('f') };

test('a face keeps its detail by its size on screen: the eyes and mouth first, hatching only up close', () => {
  const at = (px) => faceDetail(px);
  assert.deepEqual([at(8).basic, at(8).marks, at(8).fine], [0, 0, 0], 'a face of a few pixels: no drawn marks (just its eyes)');
  assert.equal(at(30).basic, 1);
  assert.equal(at(30).fine, 0, 'across the street: no hatching, no age lines');
  assert.ok(at(60).marks > 0 && at(60).fine === 0);
  assert.deepEqual([at(300).basic, at(300).marks, at(300).fine], [1, 1, 1], 'up close: everything');
  let prev = null;
  for (let px = 4; px <= 400; px += 4) {
    const d = at(px);
    if (prev) for (const k of ['basic', 'marks', 'fine', 'weight']) assert.ok(d[k] >= prev[k] - 1e-12, `${k} never drops as the face grows (${px} px)`);
    assert.ok(d.basic >= d.marks && d.marks >= d.fine, 'the steps come in order');
    prev = d;
  }
  assert.ok(at(10).weight < at(300).weight && at(10).weight > 0.6 && Math.abs(at(300).weight - 1.3) < 1e-9, 'a smaller face draws finer lines, up to a 1.3 px pen');
  assert.ok(FACE_LOD.basic[1] <= FACE_LOD.marks[0] && FACE_LOD.marks[1] <= FACE_LOD.fine[0]);
  assert.ok(FACE_HATCH_PX[0] >= 3, 'hatching strokes never closer than 3 px (a grey smear)');
  // the shader reads the same steps
  for (const v of [...FACE_LOD.basic, ...FACE_LOD.marks, ...FACE_LOD.fine]) assert.ok(FACE_INK_GLSL.includes(`${v}.0`), `the GLSL uses ${v}`);
});

test('the nose line goes down the side in shade, and holds while the light is nearly frontal', () => {
  assert.equal(noseSide(0.6, 1), -1, 'the +x side lit: the line on the -x side');
  assert.equal(noseSide(-0.6, -1), 1);
  assert.equal(noseSide(0.05, -1), -1, 'nearly frontal: as it was');
  assert.equal(noseSide(-0.05, 1), 1);
});

test('the people\'s material draws the face ink, a flat face and its rounded light', () => {
  const m = makeMaterial({ color: '#ffffff', mode: MODE_OUTFIT, skin: '#e8c6a8' });
  assert.ok(m.fragmentShader.includes('float faceInk(') && m.fragmentShader.includes('faceFlat('));
  assert.ok(m.vertexShader.includes('vec3 faceRound(') && m.vertexShader.includes('faceRound(position, objectNormal)'));
  assert.ok(FACE_ROUND > 0.3 && FACE_ROUND < 1, 'rounded, but the nose and the sockets still turn the light');
  assert.equal(m.uniforms.uMood2.value.y, 1, 'the nose line starts on the +x side');
  assert.deepEqual(m.uniforms.uFaceKit2.value.toArray(), [1, 1, 0, -0.03]);
});

test('on a body: the ears where the body\'s are, the nose\'s width and the cheeks to the ink, the line in the shade', () => {
  for (const kind of ['m', 'f']) {
    const h = new Humanoid(humans[kind], buildCharacter(), kind);
    assert.equal(h.body.material.uniforms.uFaceKit2.value.w, EAR_Z[kind]);
    h.setFace({ noseWidth: 1.3, cheeks: -0.5 });
    const u = h.body.material.uniforms;
    assert.deepEqual(u.uFaceKit2.value.toArray().slice(1).map((v) => +v.toFixed(3)), [1.3, -0.5, EAR_Z[kind]]);
    // the sun on the body's +x side: the nose line eases over to its -x side
    h.char.root.updateMatrixWorld(true);
    h.update();
    const sun = sharedUniforms.uSunDir.value, keep = sun.clone();
    sun.set(1, 0.3, 0.2).normalize();
    for (let i = 0; i < 60; i++) h.updateNoseSide(1 / 30);
    assert.ok(u.uMood2.value.y < -0.9, `on the shade's side (${u.uMood2.value.y.toFixed(2)})`);
    sun.set(-1, 0.3, 0.2).normalize();
    for (let i = 0; i < 60; i++) h.updateNoseSide(1 / 30);
    assert.ok(u.uMood2.value.y > 0.9);
    sun.copy(keep);
  }
});

test('the brows are one stroke each: thick at the inner end, thin at the outer', () => {
  for (const kind of ['m', 'f']) {
    const h = new Humanoid(humans[kind], buildCharacter(), kind);
    const P = h.browMesh.geometry.attributes.position;
    let x0 = Infinity, x1 = 0;
    for (let i = 0; i < P.count; i++) { x0 = Math.min(x0, Math.abs(P.getX(i))); x1 = Math.max(x1, Math.abs(P.getX(i))); }
    const span = (lo, hi) => {
      let a = Infinity, b = -Infinity;
      for (let i = 0; i < P.count; i++) {
        const u = (Math.abs(P.getX(i)) - x0) / (x1 - x0);
        if (u >= lo && u <= hi) { a = Math.min(a, P.getY(i)); b = Math.max(b, P.getY(i)); }
      }
      return b - a;
    };
    assert.ok(span(0.05, 0.15) > span(0.85, 0.95) * 1.3, `${kind}: inner ${span(0.05, 0.15).toFixed(4)} m, outer ${span(0.85, 0.95).toFixed(4)} m`);
  }
  // the taper itself, on a plain bar
  const g = new THREE.BoxGeometry(0.04, 0.01, 0.004, 8, 2, 1).translate(0.04, 1.7, 0.09);
  const [kMin, kMax] = taperBrows(g);
  assert.ok(kMax > 0.5 && kMin < 0.22 && kMin > 0.1);
});

test('an NPC can wear its own face and expression, and stand turned its way', () => {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const npc = new NPC(scene, physics, { route: [new THREE.Vector3(3, 0, 3)], lines: ['…'], human: humans.f, kind: 'f',
    face: FACE_PRESETS['Wide-eyed'], expression: TONE_EXPRESSIONS.scared, facing: 2 });
  const h = npc.humanoid;
  assert.equal(h.face.eyeSize, FACE_PRESETS['Wide-eyed'].eyeSize);
  assert.equal(h.restExpression.brow, TONE_EXPRESSIONS.scared.brow);
  assert.ok(Math.abs(h.body.material.uniforms.uMood.value.z - TONE_EXPRESSIONS.scared.brow) < 1e-6, 'the expression in the ink');
  const player = { pos: new THREE.Vector3(60, 0, 60), vel: new THREE.Vector3(), riding: false, ride: null, wind: new THREE.Vector3() };
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(60, 2, 60);
  for (let i = 0; i < 120; i++) npc.update(1 / 60, player, camera);
  assert.ok(Math.abs(Math.atan2(Math.sin(npc.heading - 2), Math.cos(npc.heading - 2))) < 0.02, 'turned its way');
  assert.ok(npc.pos.distanceTo(new THREE.Vector3(3, 0, 3)) < 0.05, 'on its spot');
});

test('the Lab\'s faces gallery: every face variant large, with an expression, facing the hub, a walkway at their faces', () => {
  const variants = new Set(LAB_FACES.map((g) => g.variant));
  for (const k of Object.keys(FACE_PRESETS)) assert.ok(variants.has(k), `${k} is in the gallery`);
  assert.ok(variants.has('The traveller\'s'));
  assert.equal(LAB_FACES.find((g) => g.variant === 'The traveller\'s').face, TRAVELLER.face);
  assert.ok(new Set(LAB_FACES.map((g) => g.tone)).size >= 10, 'a different expression on nearly every face');
  assert.ok(LAB_FACES.some((g) => g.kind === 'm') && LAB_FACES.some((g) => g.kind === 'f'));
  for (const g of LAB_FACES) {
    assert.deepEqual(g.expression, TONE_EXPRESSIONS[g.tone]);
    const [x, z] = g.at, toHub = Math.atan2(-x, -z);
    assert.ok(Math.abs(Math.atan2(Math.sin(g.facing - toHub), Math.cos(g.facing - toHub))) < 1e-9, 'facing the hub');
  }
  for (let i = 1; i < LAB_FACES.length; i++) {
    const [a, b] = [LAB_FACES[i - 1].at, LAB_FACES[i].at];
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 7, 'their plinths apart');
  }
  const giants = CONTENT.lab.npcs.filter((n) => n.scale >= 3);
  assert.equal(giants.length, LAB_FACES.length);
  for (const [i, n] of giants.entries()) assert.equal(n.face, LAB_FACES[i].face);
  // the walkway: solid at the height of their faces in front of each, and the ramp up to it
  const scene = new THREE.Scene();
  const level = createLab(scene);
  const physics = new Physics(scene, level.ground);
  const mid = (FACE_WALK.inner + FACE_WALK.outer) / 2;
  for (const g of LAB_FACES) {
    const a = Math.atan2(g.at[0], g.at[1]);
    const y = physics.groundAt(Math.sin(a) * mid, FACE_WALK.height + 2, Math.cos(a) * mid);
    assert.ok(Math.abs(y - FACE_WALK.height) < 0.05, `the walk in front of ${g.variant} (${y})`);
    const faceY = 0.4 + 4 * 1.66;   // (a 4x giant's eyes, on its plinth)
    assert.ok(Math.abs(FACE_WALK.height + 1.6 - faceY) < 0.6, 'eye to eye');
  }
  const foot = physics.groundAt(0, 3, FACE_WALK.inner - FACE_WALK.ramp.length + 1);
  const top = physics.groundAt(0, FACE_WALK.height + 2, FACE_WALK.inner - 1);
  assert.ok(foot < 0.8 && top > FACE_WALK.height - 0.8, `the ramp climbs to it (${foot.toFixed(2)} → ${top.toFixed(2)})`);
});

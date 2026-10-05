import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The MakeHuman bodies, stage 2 (docs/makehuman.md): the Desert's people are MakeHuman bodies by default
// (?mh=0 brings back the Quaternius ones), the body ships in one file, the story's children are children,
// heights as before, the crowd's figure and its promoted bodies matched, cloth and ragdolls round the new
// girths, the hair's scalp and its strand lines in shade.

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { parseBody, unpackBody } = await import('../src/makehuman/body.js');
const { personTemplate, MakeHumanPeople, ageClassOf, yearsOf, usesMakeHuman, MH_WORLDS, Q_TOP } = await import('../src/makehuman/people.js');
const { hairFor, mhLookPieces, SCALP_LIFT, MH_STYLES } = await import('../src/makehuman/hair.js');
const { Humanoid, prepareHuman, segmentGirths, CAPSULES, CAPSULE_MARGIN, hairEdge } = await import('../src/humanoid.js');
const { JOINTS } = await import('../src/ragdoll.js');
const { reshapeCopy } = await import('../src/morph.js');
const { buildCharacter } = await import('../src/player.js');
const { HEIGHT, namedLook } = await import('../src/costumes.js');
const { CROWD_JOINTS, CROWD_BODY } = await import('../src/crowd-shader.js');
const { PEOPLE, VILLAGERS } = await import('../src/story/desert-data.js');
const { BLANK } = await import('../src/studio/people.js');

const bin = readFileSync(new URL('../public/anim/mh/body.bin', import.meta.url));
const buffer = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
const data = parseBody(buffer);
const look = (o = {}) => ({ ...BLANK(o.kind ?? 'm'), ...o });
const parse = async (p) => {
  const b = await readFile(new URL(`../public/anim/${p}`, import.meta.url));
  return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene;
};
const top = (t) => { let y = 0; t.traverse((o) => { if (o.isSkinnedMesh) { const P = o.geometry.attributes.position; for (let i = 0; i < P.count; i++) y = Math.max(y, P.getY(i)); } }); return y; };

test('the Desert\'s people are MakeHuman bodies by default; ?mh=0 the Quaternius ones, ?mh=1 anywhere; the file ships', () => {
  assert.ok(MH_WORLDS.has('desert'));
  assert.equal(usesMakeHuman('desert'), true);
  assert.equal(usesMakeHuman('desert', '0'), false, '?mh=0: to compare');
  assert.equal(usesMakeHuman('bazaar'), false, 'the other worlds wait for their review');
  assert.equal(usesMakeHuman('bazaar', '1'), true);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /usesMakeHuman\(levelId, query\.get\('mh'\)\)/);
  // asked for as the page starts (not after the Quaternius bodies), awaited where the people are made
  assert.ok(main.indexOf('const mhPeople =') < main.indexOf('const humanT = await humans'));
  const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(vite, /process\.env\.MAKEHUMAN === '0'/, 'in the build unless MAKEHUMAN=0');
});

test('one file, one fetch: body.bin carries its header; the arrays are views on it', () => {
  const u = unpackBody(buffer);
  assert.equal(u.base % 8, 0);
  assert.ok(u.meta.buffers.body_tris && u.meta.parts.body.count > 5000);
  const t = data.get('body_tris');
  assert.equal(t.buffer, buffer, 'no copy');
  assert.throws(() => unpackBody(new ArrayBuffer(16)), /not a body\.bin/);
  const body = readFileSync(new URL('../src/makehuman/body.js', import.meta.url), 'utf8');
  assert.equal((body.match(/fetch\(/g) ?? []).length, 1);
});

test('the story\'s children are children, as tall as MakeHuman makes their age; grown-ups as tall as before', async () => {
  for (const d of [PEOPLE.ilo, VILLAGERS.find((p) => p.id === 'qanat.boy')]) assert.equal(ageClassOf({ def: d }), 'child', d.id);
  assert.equal(ageClassOf({ def: { scale: 0.72 } }), 'child', 'a small story person without an age');
  assert.equal(ageClassOf({ def: { scale: 0.93 } }), 'adult');
  for (const id of ['bako', 'nour', 'oum']) assert.equal(ageClassOf({ def: PEOPLE[id] }), 'elder', id);
  assert.equal(yearsOf({ def: PEOPLE.ilo }), 8);
  const people = new MakeHumanPeople(data, 'desert');
  const ilo = people.templateFor({ kind: 'f', def: PEOPLE.ilo }).userData.profile;
  const tall = ilo.trueScale * ilo.measured.height;
  assert.ok(tall > 1.05 && tall < 1.35, `Ilo (8) ${tall.toFixed(2)} m`);
  const [m, f] = people.humans().map((t) => t.userData.profile);
  assert.equal(m.heightFix, 1);
  // a woman as much shorter than a man of her world as the Quaternius woman is (MakeHuman's women stand taller in bind space)
  const q = { m: prepareHuman(await parse('human_m.glb'), 'm'), f: prepareHuman(await parse('human_f.glb'), 'f') };
  assert.ok(Math.abs(top(q.m) - Q_TOP.m) < 0.01 && Math.abs(top(q.f) - Q_TOP.f) < 0.01, 'Q_TOP measured');
  const ratio = (f.measured.height * f.heightFix) / (m.measured.height * m.heightFix);
  assert.ok(Math.abs(ratio - Q_TOP.f / Q_TOP.m) < 0.002, `${ratio.toFixed(3)}`);
  assert.ok(f.measured.height * f.heightFix * HEIGHT.f < 1.75, 'a woman of the desert ~1.68 m');
});

test('a crowd body come close takes its person\'s age and build: an elder\'s body on the pooled skeleton', () => {
  const people = new MakeHumanPeople(data, 'desert');
  const t = people.templateFor({ kind: 'm', pooled: true });
  assert.equal(t.userData.profile.yearsOf({ faceType: 'elder' }), 72);
  assert.equal(t.userData.profile.yearsOf({ faceType: 'plain' }), 32);
  const h = new Humanoid(t, buildCharacter(), 'm');
  h.setBuild('slim', 32);
  const adult = h.body.geometry;
  h.setBuild('slim', 72);
  assert.notEqual(h.body.geometry, adult, 'an elder\'s shape');
  assert.equal(h.years, 72);
  h.setBuild('slim', 32);
  assert.equal(h.body.geometry, adult, 'cached');
});

test('the crowd\'s bodies are made ahead, while the page is idle: every build of a grown-up and an elder', async () => {
  const people = new MakeHumanPeople(data, 'bazaar');
  const n = await people.warm({ gap: 0 });
  assert.equal(n, 16);
  const t = people.template('f');
  const before = data.cache.size;
  const h = new Humanoid(t, buildCharacter(), 'f');
  h.setBuild('heavy', 72);
  assert.equal(data.cache.size, before, 'an elder\'s heavy body was ready');
});

test('cloth and ragdolls fit the new girths: a heavy belly, a child\'s thin limbs', () => {
  const heavy = new Humanoid(personTemplate(data, { kind: 'm', build: 'heavy', world: 'desert' }), buildCharacter(), 'm');
  const avg = new Humanoid(personTemplate(data, { kind: 'm', world: 'desert' }), buildCharacter(), 'm');
  const gh = segmentGirths(heavy.body), ga = segmentGirths(avg.body);
  assert.equal(gh.length, CAPSULES.length);
  assert.ok(gh[0] > ga[0] * 1.25, `the heavy trunk ${gh[0].toFixed(3)} against ${ga[0].toFixed(3)}`);
  for (const H of [heavy, avg]) {
    H.char.root.updateMatrixWorld(true);
    const caps = H.capsules(), g = segmentGirths(H.body);
    caps.forEach((c, i) => assert.ok(c.r >= g[i] - 1e-9, `${CAPSULES[i][0]}: the collider holds the skin (${c.r.toFixed(3)} >= ${g[i].toFixed(3)})`));
    assert.ok(Math.abs(caps[0].r - (g[0] + CAPSULE_MARGIN[0])) < 1e-9);
  }
  assert.ok(heavy.capsules()[0].r > 0.29, 'no cloth through a heavy belly');
  // a child: the colliders at its size
  const child = new Humanoid(personTemplate(data, { kind: 'f', years: 8, world: 'desert' }), buildCharacter(), 'f');
  child.char.root.scale.setScalar(child.profile.trueScale);
  child.char.root.updateMatrixWorld(true);
  const cc = child.capsules();
  assert.ok(cc[0].r < avg.capsules()[0].r * 0.8, 'a child\'s trunk collider is a child\'s');
  // the ragdoll's particles
  const rh = heavy.ragdollRadii(), ra = avg.ragdollRadii();
  assert.equal(rh.length, JOINTS.length);
  assert.ok(rh[0] > ra[0], 'a fuller trunk to lie on');
  assert.equal(rh[2], JOINTS[2][2], 'the head as before');
  const q = new Humanoid(prepareHumanSync(), buildCharacter(), 'm');
  assert.equal(q.ragdollRadii(), null, 'the Quaternius bodies: JOINTS\' own');
});
// (a Quaternius-like body without a profile: the per-kind tables)
function prepareHumanSync() { const t = personTemplate(data, { kind: 'm' }).clone(); t.userData = {}; return t; }

test('the hair: a scalp under every style (no skin through the crown), its strand lines lighter on dark hair', () => {
  const prof = personTemplate(data, { kind: 'm', world: 'desert' }).userData.profile;
  for (const st of MH_STYLES) {
    const h = hairFor(prof, st);
    assert.ok(h.scalp > 300, `${st}: ${h.scalp} scalp triangles`);
    assert.equal(h.edge.length, h.geo.attributes.position.count);
    assert.ok(h.edge.some((e) => e > 0) && h.edge.some((e) => e === 0), `${st}: the lock borders marked`);
  }
  // the scalp: the skin's own points just off it
  const h = hairFor(prof, 'short02'), P = h.geo.attributes.position.array, n = P.length / 3;
  const B = prof.body, near = (i) => { let d = Infinity; for (const v of data.head) d = Math.min(d, Math.hypot(P[i * 3] - B[v * 3], P[i * 3 + 1] - B[v * 3 + 1], P[i * 3 + 2] - B[v * 3 + 2])); return d; };
  assert.ok(Math.abs(near(n - 1) - SCALP_LIFT) < 0.0006, 'the last vertex is the scalp\'s, SCALP_LIFT off the skin');
  assert.ok(hairEdge('#2b211f') > 0.9, 'dark hair: lighter strand lines');
  assert.equal(hairEdge('#b0a89a'), 0, 'grey hair: as drawn');
  // dressed: the lock borders a lighter colour than the rest
  const H = new Humanoid(personTemplate(data, { kind: 'm', world: 'desert' }), buildCharacter(), 'm');
  H.dress(look({ head: 'short', hair: '#2b211f' }));
  const g = H._costume[0].geometry, C = g.attributes.color, base = new THREE.Color('#2b211f');
  let lighter = 0;
  for (let i = 0; i < C.count; i++) if (C.getX(i) > base.r + 0.03) lighter++;
  assert.ok(lighter > 50, `${lighter} lighter vertices`);
});

test('the crowd\'s figure stands for a MakeHuman body: the same height, shoulders and hips within a few cm', () => {
  const people = new MakeHumanPeople(data, 'desert');
  for (const [i, kind] of ['m', 'f'].entries()) {
    const t = people.humans()[i], P = t.userData.profile;
    t.updateMatrixWorld(true);
    const B = {}; t.traverse((o) => { if (o.isBone) B[o.name] = o.getWorldPosition(new THREE.Vector3()); });
    const fem = kind === 'f' ? 1 : 0, k = kind === 'm' ? 1.03 : 1;   // (crowd.js: the instance's scale over the person's size)
    const fix = P.heightFix * (kind === 'f' ? HEIGHT.f : 1);
    const figTop = (1.64 + 0.1 * 1.22) * k * (kind === 'f' ? HEIGHT.f : 1), bodyTop = P.measured.height * fix;
    assert.ok(Math.abs(figTop - bodyTop) / bodyTop < 0.035, `${kind}: figure ${figTop.toFixed(2)} m, body ${bodyTop.toFixed(2)} m`);
    const figSh = CROWD_JOINTS.shoulderX * (1 - CROWD_BODY.shoulderF * fem) * k, bodySh = B.upperarm_l.x * P.heightFix;
    assert.ok(Math.abs(figSh - bodySh) < 0.012, `${kind}: shoulders ${figSh.toFixed(3)} / ${bodySh.toFixed(3)}`);
    const figHip = CROWD_JOINTS.hipX * CROWD_BODY.hips * k, bodyHip = B.thigh_l.x * P.heightFix;
    assert.ok(Math.abs(figHip - bodyHip) < 0.012, `${kind}: hips ${figHip.toFixed(3)} / ${bodyHip.toFixed(3)}`);
  }
});

test('a body\'s reshaped copies share its skin, triangles and face keys', () => {
  const t = personTemplate(data, { kind: 'f', world: 'desert' });
  let body = null; t.traverse((o) => { if (o.isSkinnedMesh && o.name === 'Body') body = o; });
  const g = body.geometry, c = reshapeCopy(g);
  assert.notEqual(c.attributes.position, g.attributes.position);
  assert.equal(c.attributes.skinIndex, g.attributes.skinIndex);
  assert.equal(c.index, g.index);
  assert.equal(c.userData.faceKeys, g.userData.faceKeys);
  // a template's other builds: the same keys' arrays
  const H = new Humanoid(t, buildCharacter(), 'f');
  H.setBuild('heavy');
  assert.notEqual(H.body.geometry, g);
  assert.equal(H.body.geometry.userData.faceKeys.texture, g.userData.faceKeys.texture);
});

test('the named desert people follow their character sheets', () => {
  const at = (id, def = PEOPLE[id]) => namedLook({ world: 'desert', id, palette: def.palette, head: def.head, cape: def.cape, look: def.look, kind: def.body ?? def.kind });
  assert.equal(at('bako').mask, 'beard'); assert.equal(at('bako').head, 'wrap');
  assert.equal(at('nour').head, 'sunhat'); assert.equal(at('nour').mask, 'veil'); assert.equal(at('nour').prop, 'staff');
  assert.equal(at('marrow').mask, 'browgoggles'); assert.equal(at('marrow').head, 'raghood'); assert.notEqual(ageClassOf({ def: PEOPLE.marrow, dress: at('marrow') }), 'elder');
  assert.equal(at('sefa').head, 'braid'); assert.equal(at('sefa').capeLen, 1.45);
  assert.equal(at('speaker').head, 'wizard'); assert.equal(at('speaker').mask, 'veil');
});

test('a cape on a heavy MakeHuman body hangs round its belly, not through it', async () => {
  const { loadAssets } = await import('./gait-sim.js');
  const { NPC } = await import('../src/npc.js');
  const { Physics } = await import('../src/physics.js');
  const { resetDrapes } = await import('../src/cape.js');
  resetDrapes();
  const { lib } = await loadAssets();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2)));
  scene.updateMatrixWorld(true);
  const people = new MakeHumanPeople(data, 'desert');
  const def = { id: 'test.heavy', name: 'Heavy', kind: 'm', cape: 1.25, palette: {}, look: { build: 'heavy', robe: 0, body: 'none' } };
  const npc = new NPC(scene, new Physics(scene), { route: [new THREE.Vector3()], def, kind: 'm', cape: 1.25, look: def.look, world: 'desert', lines: ['…'], lib, human: people.humans()[0] });
  assert.equal(npc.humanoid.build, 'heavy');
  npc.heading = 0;
  const player = { pos: new THREE.Vector3(0, 0, 6), vel: new THREE.Vector3(), riding: false, ride: null, wind: new THREE.Vector3() };
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.6, 5);
  for (let f = 0; f < 240; f++) npc.update(1 / 60, player, camera);
  const H = npc.humanoid, g = segmentGirths(H.body)[0] * npc.object.scale.y;
  const a = H.b.pelvis.getWorldPosition(new THREE.Vector3()), b = H.b.spine_03.getWorldPosition(new THREE.Vector3());
  const c = npc.cape, m = c.hung ? c.mesh.matrixWorld : new THREE.Matrix4(), p = new THREE.Vector3(), ab = b.clone().sub(a);
  let inside = 0, near = 0;
  for (let i = 0; i < c.p.length; i += 3) {
    p.set(c.p[i], c.p[i + 1], c.p[i + 2]).applyMatrix4(m);
    const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
    if (t <= 0 || t >= 1) continue;
    near++;
    if (p.distanceTo(a.clone().addScaledVector(ab, t)) < g * 0.95) inside++;
  }
  assert.ok(near > 5, `${near} cloth points by the trunk`);
  assert.equal(inside, 0, `${inside} cloth points inside the belly (${g.toFixed(3)} m)`);
});

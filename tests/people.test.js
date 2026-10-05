import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mulberry32 } from '../src/noise.js';
import { dressFor, namedLook, crowdLook, packBody, BUILDS, HEIGHT, HEAD_IDS, HEAD_ID_LIMIT, MASK_IDS, HEADS, MASKS, COSTUMES, GENERIC_HAIR, MASK_ID_LIMIT, BODY_ID_LIMIT, BODY_IDS, packDress, unpackDress } from '../src/costumes.js';
import { CROWD_GLSL } from '../src/crowd-shader.js';
import { figureGeometry, worldPieces, packLook } from '../src/crowd.js';
import { Humanoid, prepareHuman, buildGeometry } from '../src/humanoid.js';
import { buildCharacter } from '../src/player.js';

// People of different heights, builds and kinds (costumes.js dressFor: the body is part of the look).
const WORLDS = ['desert', 'bazaar', 'incal', 'arzach', 'garage', 'buried', 'edena', 'perdide'];
const crowdOf = (world, n = 400, seed = 7) => {
  const rng = mulberry32(seed), krng = mulberry32(seed + 1);
  return Array.from({ length: n }, () => crowdLook(rng, { world, kind: krng() < 0.5 ? 'm' : 'f' }));
};

test('everyone has a kind, a build and a height; crowds mix them all', () => {
  for (const world of WORLDS) {
    const ppl = crowdOf(world);
    const kinds = new Set(ppl.map((s) => s.kind)), builds = new Set(ppl.map((s) => s.build));
    assert.deepEqual([...kinds].sort(), ['f', 'm'], world);
    assert.deepEqual([...builds].sort(), Object.keys(BUILDS).sort(), `${world}: every build`);
    const h = ppl.map((s) => s.height);
    assert.ok(Math.min(...h) >= HEIGHT.min && Math.max(...h) <= HEIGHT.max, `${world}: heights within ${HEIGHT.min}..${HEIGHT.max}`);
    assert.ok(Math.min(...h) < 0.92 && Math.max(...h) > 1.08, `${world}: short and tall people`);
    const mean = (k) => { const a = ppl.filter((s) => s.kind === k).map((s) => s.height); return a.reduce((x, y) => x + y, 0) / a.length; };
    assert.ok(mean('f') < mean('m'), `${world}: women a little shorter on average`);
  }
});

test('a person looks the same on every visit, body included; the rest of a look is what it was', () => {
  for (const world of WORLDS) for (const id of ['ama', 'oum', 'crowd:12']) {
    const a = namedLook({ world, id, kind: 'f' }), b = namedLook({ world, id, kind: 'f' });
    assert.deepEqual(a, b);
    // the body is drawn after everything else, so the colours and pieces don't move
    const plain = dressFor(world, mulberry32(99), {}), man = dressFor(world, mulberry32(99), { kind: 'm' });
    for (const k of ['cloak', 'cloth', 'legs', 'skin', 'hair', 'hat', 'accent', 'body', 'prop', 'robe', 'capeLen', 'size']) assert.equal(man[k], plain[k], `${world}: ${k}`);
  }
});

test('women wear their hair long or up and have no beards; some men have a beard', () => {
  let beards = 0, men = 0, long = 0;
  for (const world of WORLDS) for (const s of crowdOf(world)) {
    if (s.kind === 'f') {
      assert.notEqual(s.mask, 'beard');
      assert.ok(!['hair', 'short'].includes(s.head), `${world}: a woman's bare head gets long hair, a bun or a tail`);
      if (['long', 'bun'].includes(s.head)) long++;
    } else { men++; if (s.mask === 'beard') beards++; }
  }
  assert.ok(long > 20 && beards > men * 0.05 && beards < men * 0.4, `${long} long-haired, ${beards}/${men} beards`);
  // story overrides win
  assert.equal(dressFor('desert', mulberry32(3), { kind: 'f', look: { head: 'hair', build: 'heavy', height: 1.1 } }).head, 'hair');
  // nobody's kind known (a story person without one): no beard, no hair swap
  for (let i = 0; i < 50; i++) assert.notEqual(namedLook({ world: 'bazaar', id: `x${i}` }).mask, 'beard');
});

test('the new hair and beard pieces are in every world\'s crowd figure, within the ids the shader packs', () => {
  assert.ok(HEAD_IDS.length <= HEAD_ID_LIMIT && MASK_IDS.length <= MASK_ID_LIMIT && BODY_IDS.length <= BODY_ID_LIMIT);
  // (the shader unpacks the mask, the shoulder piece and the prop as packDress packs them: 16 masks, 16 pieces)
  assert.ok(CROWD_GLSL.includes(`mod(aDress.y, ${MASK_ID_LIMIT}.0)`) && CROWD_GLSL.includes(`aDress.y / ${MASK_ID_LIMIT * BODY_ID_LIMIT}.0`));
  for (const mask of MASK_IDS) for (const body of BODY_IDS) for (const prop of ['none', 'staff', 'flower']) {
    const d = packDress({ head: 'brim', mask, body, prop, robe: 0, capeLen: 0.9, capeWide: 1.1, trim: 'none' });
    const u = unpackDress(d.dress, d.w);
    assert.deepEqual([u.mask, u.body, u.prop], [mask, body, prop]);
  }
  assert.ok(CROWD_GLSL.includes(`mod(aDress.x, ${HEAD_ID_LIMIT}.0)`) && CROWD_GLSL.includes(`aDress.x > ${HEAD_ID_LIMIT - 0.5}`), 'the shader unpacks the head id as costumes.js packs it');
  for (const id of ['long', 'bun']) assert.ok(HEADS[id] && HEAD_IDS.includes(id));
  assert.ok(MASKS.beard && MASK_IDS.includes('beard'));
  for (const world of WORLDS) {
    const W = worldPieces(world);
    // a tribe that goes bare-headed has its own hairstyles in the figure (and not the generic 'hair' / 'short')
    for (const t of COSTUMES[world].tribes) {
      if (!['heads', 'headsF', 'headsM'].some((k) => GENERIC_HAIR.some((h) => t[k]?.[h] > 0))) continue;
      for (const h of [...Object.keys(t.hair.m), ...Object.keys(t.hair.f)]) assert.ok(W.heads.includes(h), `${world}: ${h}`);
    }
    for (const h of GENERIC_HAIR) assert.ok(!W.heads.includes(h) || Object.values(COSTUMES[world].tribes).some((t) => t.hair.m[h] || t.hair.f[h]), `${world}: no generic ${h}`);
    assert.ok(W.masks.includes('beard'));
  }
  // the crowd's per-instance body
  const s = dressFor('bazaar', mulberry32(5), { kind: 'f', look: { build: 'heavy' } });
  assert.deepEqual(packBody(s), [1, BUILDS.heavy.width, BUILDS.heavy.girth, new THREE.Color(s.eyes).getHex()]);
  assert.equal(packLook(s).length, 4);
  assert.ok(figureGeometry('mid', 'bazaar').attributes.aRig);
});

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const bytes = await readFile(new URL('../public/anim/human_m.glb', import.meta.url));
const human = prepareHuman((await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene, 'm');

test('builds reshape the body round its bones; the head, hands and feet keep their size', () => {
  const H = (b) => new Humanoid(human, buildCharacter(), 'm', { build: b });
  const avg = H('average'), heavy = H('heavy'), slim = H('slim'), broad = H('broad');
  assert.equal(heavy.build, 'heavy');
  const B = avg.body.skeleton.bones, J = avg.body.geometry.attributes.skinIndex, W = avg.body.geometry.attributes.skinWeight;
  const main = (i) => { let best = 0, bw = -1; for (let k = 0; k < 4; k++) if (W.getComponent(i, k) > bw) { bw = W.getComponent(i, k); best = J.getComponent(i, k); } return B[best].name; };
  const P0 = avg.body.geometry.attributes.position;
  const span = (h, pred) => { const P = h.body.geometry.attributes.position; let x = 0, z = -1; for (let i = 0; i < P.count; i++) if (pred(P0.getY(i), i)) { x = Math.max(x, Math.abs(P.getX(i))); z = Math.max(z, P.getZ(i)); } return { x, z }; };
  const belly = (y) => y > 1.0 && y < 1.15;
  assert.ok(span(heavy, belly).z > span(avg, belly).z + 0.03, 'a heavy belly comes forward');
  assert.ok(span(heavy, belly).x > span(avg, belly).x + 0.02 && span(slim, belly).x < span(avg, belly).x, 'and out; the slim are slimmer');
  const chest = (y, i) => /spine_03|clavicle/.test(main(i));
  assert.ok(span(broad, chest).x > span(avg, chest).x + 0.012, `broad shoulders ${span(broad, chest).x} ${span(avg, chest).x}`);
  for (const h of [heavy, slim, broad]) {
    const P = h.body.geometry.attributes.position;
    for (let i = 0; i < P.count; i += 3) if (/^(Head|hand_|foot_|ball_)/.test(main(i)) && /^(Head|hand|foot|ball|index|middle|ring|pinky|thumb)/.test(main(i))) {
      // only vertices wholly on those bones are untouched
      let w = 0; for (let k = 0; k < 4; k++) if (/^(Head|hand_|foot_|ball_|index|middle|ring|pinky|thumb)/.test(B[J.getComponent(i, k)].name)) w += W.getComponent(i, k);
      if (w > 0.999) assert.ok(Math.abs(P.getX(i) - P0.getX(i)) + Math.abs(P.getY(i) - P0.getY(i)) + Math.abs(P.getZ(i) - P0.getZ(i)) < 1e-6, h.build);
    }
    // the soles are where they were: feet on the ground
    let min = Infinity, min0 = Infinity;
    for (let i = 0; i < P.count; i++) { min = Math.min(min, P.getY(i)); min0 = Math.min(min0, P0.getY(i)); }
    assert.ok(Math.abs(min - min0) < 0.005, `${h.build}: feet on the ground`);
  }
  // the geometry is shared per build, and a body can change build (a pooled crowd body)
  assert.equal(buildGeometry(heavy.body, 'heavy'), heavy.body.geometry);
  avg.setBuild('heavy');
  assert.equal(avg.body.geometry, heavy.body.geometry);
  avg.setBuild('average');
  assert.equal(avg.body.geometry, avg.body.userData.baseGeometry, 'and back');
  assert.equal(avg.body.geometry.attributes.position, P0);
  // fuller bodies push the cloth out further
  assert.ok(heavy.capsules()[0].r > avg.capsules()[0].r);
});

test('heights scale a body from its feet, and costumes fit every build', () => {
  const char = buildCharacter();
  char.root.scale.setScalar(1.12);
  const h = new Humanoid(human, char, 'm', { build: 'broad' });
  h.update();
  const toe = h.b.ball_l.getWorldPosition(new THREE.Vector3()), head = h.b.Head.getWorldPosition(new THREE.Vector3());
  const ref = new Humanoid(human, buildCharacter(), 'm');
  ref.update();
  assert.ok(Math.abs(toe.y - ref.b.ball_l.getWorldPosition(new THREE.Vector3()).y * 1.12) < 1e-4, 'the feet stay on the ground');
  assert.ok(Math.abs(head.y / ref.b.Head.getWorldPosition(new THREE.Vector3()).y - 1.12) < 1e-3, 'a taller person');
  // costumes are cached per build: a broad chest gets wider shoulder pieces
  const look = dressFor('arzach', mulberry32(4), { kind: 'm', look: { body: 'pauldrons', robe: 0 } });
  h.dress(look); ref.dress(look);
  const width = (x) => { x._costume[0].geometry.computeBoundingBox(); return x._costume[0].geometry.boundingBox.max.x - x._costume[0].geometry.boundingBox.min.x; };
  assert.ok(width(h) > width(ref) + 0.01, 'broad shoulders, broader pauldrons');
});

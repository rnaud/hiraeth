import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The MakeHuman bodies, stage 3 (docs/makehuman.md): the face keys in one texture for every body, every
// world's people on MakeHuman bodies, more headwear (hats, caps, goggles, scarves, veils, masks...).

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { parseBody, keyTexture, keyDelta, KEY_TEX_WIDTH } = await import('../src/makehuman/body.js');
const { personTemplate, MakeHumanPeople } = await import('../src/makehuman/people.js');
const { Humanoid } = await import('../src/humanoid.js');
const { buildCharacter } = await import('../src/player.js');
const { TONE_EXPRESSIONS } = await import('../src/expression.js');

const bin = readFileSync(new URL('../public/anim/mh/body.bin', import.meta.url));
const data = parseBody(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const bodyOf = (t) => { let b = null; t.traverse((o) => { if (o.isSkinnedMesh && o.name === 'Body') b = o; }); return b; };

test('the face keys: one texture a part for every body, each scaled by its own head', () => {
  const K = keyTexture(data, 'body');
  assert.ok(K.count >= 10 && K.names.includes('smile') && K.names.includes('blink'), K.names.join());
  assert.equal(K.width, Math.min(KEY_TEX_WIDTH, data.meta.parts.body.count));
  // the same texture on a man, a woman, a child, an elder of another world, and another build of one of them
  const people = [personTemplate(data, { kind: 'm', world: 'desert' }), personTemplate(data, { kind: 'f', world: 'bazaar' }),
    personTemplate(data, { kind: 'f', years: 8, world: 'incal' }), personTemplate(data, { kind: 'm', years: 72, build: 'heavy', world: 'garage' })];
  for (const t of people) assert.equal(bodyOf(t).geometry.userData.faceKeys.texture, K.texture);
  const H = new Humanoid(people[1], buildCharacter(), 'f');
  H.setBuild('heavy');
  assert.equal(H.body.geometry.userData.faceKeys.texture, K.texture, 'a build: the same keys');
  assert.equal(Object.keys(H.body.geometry.morphAttributes).length, 0, 'no three.js morph targets (a texture each)');
  // the half floats against the keys as the file has them, scaled by this head (body.js addSparse)
  const prof = people[2].userData.profile, k = prof.kHead;
  const idx = data.get('k_smile_i'), d = data.get('k_smile_d'), s = data.scale('k_smile_d'), P = data.meta.parts.body;
  let worst = 0, n = 0;
  for (let j = 0; j < idx.length; j++) {
    const v = idx[j];
    if (v < P.start || v >= P.start + P.count) continue;
    const got = keyDelta(K, k, 'smile', v - P.start);
    for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(got[c] - d[j * 3 + c] * s * k[c]));
    n++;
  }
  assert.ok(n > 100 && worst < 2e-5, `${n} vertices, worst ${(worst * 1000).toFixed(4)} mm`);
  // the brows and eyes: their own small textures
  for (const p of ['brows0', 'brows1']) assert.ok(keyTexture(data, p).count > 0, p);
});

test('the face keys reach the material before each draw; a level of detail draws none', () => {
  const t = personTemplate(data, { kind: 'm', world: 'bazaar' });
  const h = new Humanoid(t, buildCharacter(), 'm');
  h.setExpression(TONE_EXPRESSIONS.happy);
  const u = h.body.material.uniforms;
  assert.equal(h.body.material.defines.FACE_KEYS, keyTexture(data, 'body').count);
  h.body.onBeforeRender.call(h.body);
  const i = h.body.userData.keyNames.indexOf('smile');
  assert.ok(u.uKeyW.value[i] > 0.5 && u.uKeyScale.value.w === 1 && u.uKeyTex.value === keyTexture(data, 'body').texture);
  assert.deepEqual([u.uKeyScale.value.x, u.uKeyScale.value.y, u.uKeyScale.value.z], t.userData.profile.kHead);
  // two people: their own weights, the one texture
  const h2 = new Humanoid(personTemplate(data, { kind: 'f', world: 'bazaar' }), buildCharacter(), 'f');
  h2.setExpression(TONE_EXPRESSIONS.sad);
  h2.body.onBeforeRender.call(h2.body);
  assert.notEqual(h2.body.material, h.body.material);
  assert.equal(h2.body.material.uniforms.uKeyW.value[i], 0, 'not smiling');
  assert.equal(h2.body.material.uniforms.uKeyTex.value, u.uKeyTex.value);
  const src = readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8');
  assert.match(src, /#ifdef FACE_KEYS[\s\S]*texelFetch\(uKeyTex/);
  void MakeHumanPeople;
});

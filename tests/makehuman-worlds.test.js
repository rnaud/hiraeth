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

// ---------------------------------------------------------------- headwear on every head
const THREE = await import('three');
const { MeshBVH } = await import('three-mesh-bvh');
const { mergeVertices } = await import('three/addons/utils/BufferGeometryUtils.js');
const { mhLookPieces } = await import('../src/makehuman/hair.js');
const { HEADS, HEAD_IDS, HAIR_IDS, MASK_IDS, BODY_IDS, COSTUMES } = await import('../src/costumes.js');
const { BLANK } = await import('../src/studio/people.js');

/** The new headwear and face pieces (stage 3). */
const NEW_HEADS = ['brim', 'straw', 'trilby', 'bowler', 'peak', 'flatcap', 'beanie', 'trapper', 'aviator', 'bandana', 'kerchief', 'skullcap', 'circlet', 'helmet', 'hooddown'];
const NEW_MASKS = ['glasses', 'shades', 'scarfmask', 'facewrap', 'monocle'];
/** Heads to fit: a man and a woman grown up, a child, a teenager, the old and the heavy. */
const HEADS_TO_FIT = [['m', 32, 'average'], ['f', 32, 'slim'], ['f', 8, 'average'], ['m', 15, 'average'], ['m', 72, 'heavy'], ['f', 72, 'heavy'], ['m', 32, 'broad']];
const fitted = new Map();
const humanoid = (kind, years, build) => {
  const k = `${kind}|${years}|${build}`;
  if (!fitted.has(k)) fitted.set(k, new Humanoid(personTemplate(data, { kind, years, build, world: 'bazaar' }), buildCharacter(), kind));
  return fitted.get(k);
};

/** Whether a piece is a closed solid (every edge of its welded triangles shared by two). */
function closed(geo) {
  const g = geo.clone();
  for (const a of Object.keys(g.attributes)) if (a !== 'position') g.deleteAttribute(a);
  const w = mergeVertices(g, 1e-5), I = w.index.array, edges = new Map();
  for (let f = 0; f < I.length; f += 3) for (let k = 0; k < 3; k++) {
    const a = I[f + k], b = I[f + (k + 1) % 3];
    if (a === b) continue;
    const key = a < b ? a * 1e6 + b : b * 1e6 + a;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  for (const n of edges.values()) if (n !== 2) return false;
  return edges.size > 0;
}

/**
 * What of a head (its skin, and its hair) pokes through what a look wears on it: rays from the skull's
 * centre to every point of the head's skin (and of the hair under the headwear) that cross a piece
 * nearer than the point (by more than `slack`, m) and come out of it again: a point inside a closed piece
 * (an odd number of crossings) is hidden in it, one past an open shell (a hat's crown, a cloth) shows
 * through it. Returns { skin, hair } as fractions, and the worst (m).
 */
export function poking(h, look, slack = 0.002) {
  const pieces = mhLookPieces(look, h), F = h.headFrame(h.rest.get(h.b.Head).p, look);
  const solids = pieces.head.map((p) => {
    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()).applyMatrix4(F);
    for (const a of Object.keys(g.attributes)) if (a !== 'position') g.deleteAttribute(a);
    return { bvh: new MeshBVH(g), closed: closed(p.geo.clone().applyMatrix4(F)) };
  });
  if (!solids.length) return { skin: 0, hair: 0, worst: 0 };
  const c = new THREE.Vector3().setFromMatrixPosition(F);
  const ray = new THREE.Ray(), v = new THREE.Vector3(), dir = new THREE.Vector3();
  let worst = 0;
  const count = (P, idx) => {
    let n = 0, bad = 0;
    const each = (i) => {
      v.fromBufferAttribute(P, i);
      const d = v.distanceTo(c);
      ray.set(c, dir.copy(v).sub(c).divideScalar(d));
      n++;
      let through = 0, hidden = false;
      for (const s of solids) {
        const hits = s.bvh.raycast(ray, THREE.DoubleSide).filter((x) => x.distance < d - slack);
        if (!hits.length) continue;
        if (s.closed && hits.length % 2 === 1) { hidden = true; break; }
        through = Math.max(through, d - Math.min(...hits.map((x) => x.distance)));
      }
      if (!hidden && through > 0) { bad++; worst = Math.max(worst, through); }
    };
    if (idx) for (const i of idx) each(i); else for (let i = 0; i < P.count; i++) each(i);
    return n ? bad / n : 0;
  };
  const skin = count(h.body.geometry.attributes.position, data.head);
  const hair = pieces.skinned.length ? count(pieces.skinned[0].geo.attributes.position) : 0;
  return { skin, hair, worst };
}

test('the new headwear: on every kind of head, no skin and no hair through it', () => {
  for (const id of [...NEW_HEADS, ...NEW_MASKS]) assert.ok(HEAD_IDS.includes(id) || MASK_IDS.includes(id), id);
  assert.ok(BODY_IDS.includes('neckerchief') && BODY_IDS.includes('muffler') && BODY_IDS.includes('neckgoggles'));
  const bad = [];
  for (const [kind, years, build] of HEADS_TO_FIT) {
    const h = humanoid(kind, years, build);
    for (const head of NEW_HEADS) for (const under of ['flow', 'curls', 'short']) {
      if (!HEADS[head].cover && under !== 'short') continue;
      const r = poking(h, { ...BLANK(kind), kind, head, under, mask: 'none' });
      if (r.skin > 0.003 || r.hair > 0.01) bad.push(`${head}/${under} on ${kind} ${years} ${build}: skin ${(r.skin * 100).toFixed(1)}%, hair ${(r.hair * 100).toFixed(1)}%, ${(r.worst * 1000).toFixed(0)} mm`);
    }
    for (const mask of NEW_MASKS) {
      const r = poking(h, { ...BLANK(kind), kind, head: 'bald', mask });
      if (r.skin > 0.003) bad.push(`${mask} on ${kind} ${years} ${build}: skin ${(r.skin * 100).toFixed(1)}%, ${(r.worst * 1000).toFixed(0)} mm`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the older hats over hair: the hair squashed under them, none through them', () => {
  const old = HEAD_IDS.filter((id) => HEADS[id].cover && !NEW_HEADS.includes(id));
  assert.ok(old.length >= 10, old.join());
  const bad = [];
  for (const [kind, years, build] of HEADS_TO_FIT) {
    const h = humanoid(kind, years, build);
    for (const head of old) for (const under of ['flow', 'curls', 'bob']) {
      const r = poking(h, { ...BLANK(kind), kind, head, under, mask: 'none' });
      // (the wizard's hat, the Speaker's, over a woman's big curls: a few strands at its brim, 3 % at most)
      if (r.hair > (head === 'wizard' && under === 'curls' ? 0.035 : 0.012)) bad.push(`${head}/${under} on ${kind} ${years} ${build}: hair ${(r.hair * 100).toFixed(1)}%, ${(r.worst * 1000).toFixed(0)} mm`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the studio shows every headwear on MakeHuman heads of every age, and each world\'s own set', async () => {
  const { mhHeadwearLineup, HEADWEAR_HEADS } = await import('../src/studio/makehuman.js');
  const { worldPieces } = await import('../src/crowd.js');
  const heads = HEAD_IDS.filter((h) => !HAIR_IDS.includes(h));
  const L = mhHeadwearLineup('heads', { heads });
  assert.equal(L.length, heads.length);
  assert.ok(L.every((sp) => sp.mh && sp.look.head && sp.who === 'blank'));
  assert.ok(new Set(L.map((sp) => sp.mh.years)).size >= 4, 'children, teenagers, grown-ups and the old');
  assert.equal(mhHeadwearLineup('masks', { masks: MASK_IDS.slice(1) }).length, MASK_IDS.length - 1);
  const W = worldPieces('bazaar'), mine = mhHeadwearLineup('world', W);
  assert.equal(mine.length, W.heads.length + W.masks.length + W.bodies.length);
  assert.ok(W.heads.includes('flatcap') && W.heads.includes('kerchief') && W.masks.includes('glasses'));
  assert.ok(HEADWEAR_HEADS.length >= 6);
  const main = readFileSync(new URL('../src/studio/main.js', import.meta.url), 'utf8');
  assert.match(main, /'mhheadwear'/);
});

test('each world wears its own headwear: the new pieces where they belong', async () => {
  const has = (w, id) => COSTUMES[w].tribes.some((t) => [t.heads, t.headsF, t.headsM, t.masks, t.body, ...Object.values(t.more ?? {})].some((x) => x?.[id] > 0));
  for (const [w, ids] of Object.entries({
    desert: ['straw', 'kerchief', 'facewrap', 'scarfmask'], incal: ['bowler', 'peak', 'beanie', 'trapper', 'goggles', 'scarfmask'],
    garage: ['aviator', 'peak', 'neckgoggles'], buried: ['helmet', 'trapper'], edena: ['straw', 'circlet'], spheres: ['circlet'],
    perdide: ['brim', 'hooddown'], perdide2: ['beanie', 'muffler'], bazaar: ['flatcap', 'beanie', 'kerchief', 'glasses', 'muffler'], arzach2: ['skullcap', 'kerchief'],
  })) for (const id of ids) assert.ok(has(w, id), `${w}: ${id}`);
  // the desert keeps no caps, the City-Shaft's rim no ear-flaps
  assert.ok(!has('desert', 'peak') && !has('desert', 'beanie'));
  assert.ok(!COSTUMES.incal.tribes[0].heads.trapper && !COSTUMES.incal.tribes[0].more.heads.trapper);
  // the crowds wear them (a fair share), the story's people as they were drawn (none of the extras unless the story says so)
  const { crowdLook, namedLook } = await import('../src/costumes.js');
  const { mulberry32 } = await import('../src/noise.js');
  const rng = mulberry32(7), crowd = Array.from({ length: 300 }, (_, i) => crowdLook(rng, { world: 'bazaar', kind: i % 2 ? 'f' : 'm' }));
  const extra = (s) => ['heads', 'headsF', 'masks', 'body'].some((k) => COSTUMES.bazaar.tribes[0].more[k]?.[k === 'masks' ? s.mask : k === 'body' ? s.body : s.head]);
  const share = crowd.filter(extra).length / crowd.length;
  assert.ok(share > 0.25 && share < 0.7, `the market's crowd: ${(share * 100).toFixed(0)} % wear the new pieces`);
  for (let i = 0; i < 60; i++) {
    const n = namedLook({ world: 'bazaar', id: `someone${i}`, kind: i % 2 ? 'f' : 'm' });
    assert.ok(!extra(n), `a named person's look is the one drawn before (${n.head}, ${n.mask}, ${n.body})`);
  }
});

// ---------------------------------------------------------------- the worlds, one by one
const { MH_WORLDS, usesMakeHuman, ageClassOf, yearsOf } = await import('../src/makehuman/people.js');
const { namedLook: named } = await import('../src/costumes.js');
/** A story person on their world's MakeHuman body: { look, profile, height (m, as the game stands them) }. */
function onBody(world, def) {
  const kind = def.body ?? def.kind ?? 'm';
  // (as NPC dresses them: src/npc.js, a child or a teenager no beard)
  const look = named({ world, id: def.id, palette: def.palette ?? {}, head: def.head ?? null, cape: def.cape ?? null, look: def.look ?? {}, kind: def.body ?? def.kind ?? null, young: ['child', 'teen'].includes(ageClassOf({ def })) });
  const p = new MakeHumanPeople(data, world).templateFor({ kind, def, dress: look }).userData.profile;
  const scale = p.trueScale ?? (def.scale ?? look.height) * (p.heightFix ?? 1);
  return { look, profile: p, height: scale * p.measured.height };
}

test('the Signal Market\'s people are MakeHuman bodies: Kip a child of eleven, Sel old, the market dressed as itself', async () => {
  assert.ok(MH_WORLDS.has('bazaar') && usesMakeHuman('bazaar') && !usesMakeHuman('bazaar', '0'));
  const { PEOPLE, STREET } = await import('../src/story/bazaar-data.js');
  assert.equal(ageClassOf({ def: PEOPLE.kip }), 'child');
  assert.equal(yearsOf({ def: PEOPLE.kip }), 11);
  const kip = onBody('bazaar', PEOPLE.kip);
  assert.ok(kip.height > 1.25 && kip.height < 1.5, `Kip ${kip.height.toFixed(2)} m`);
  assert.equal(kip.look.head, 'peak');
  assert.equal(ageClassOf({ def: PEOPLE.sel }), 'elder');
  const sel = onBody('bazaar', PEOPLE.sel);
  assert.equal(sel.look.mask, 'glasses');
  assert.equal(onBody('bazaar', PEOPLE.ferro).look.head, 'bandana');
  assert.equal(onBody('bazaar', PEOPLE.brush).look.head, 'beret');
  assert.equal(onBody('bazaar', { ...STREET.teb, kind: 'm' }).look.head, 'flatcap');
  assert.equal(onBody('bazaar', { ...STREET.oyo, kind: 'm' }).look.mask, 'glasses');
  for (const def of [PEOPLE.sel, PEOPLE.ferro, PEOPLE.brush]) {
    const h = onBody('bazaar', def).height;
    assert.ok(h > 1.5 && h < 2.05, `${def.id} ${h.toFixed(2)} m`);
  }
});

/** A world's story people (every exported table of its story data with people in it). */
async function storyPeople(world) {
  let m;
  try { m = await import(`../src/story/${world}-data.js`); } catch { return []; }
  const out = [];
  for (const [k, v] of Object.entries(m)) {
    if (['THINGS', 'QUESTS', 'ITEMS'].includes(k)) continue;
    const list = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : [];
    for (const p of list) if (p?.id && p.name && (p.palette || p.head || p.kind) && !p.narrator) out.push(p);
  }
  return out;
}

test('every world on MakeHuman bodies: its children children (no beards), its grown-ups as tall as before', async () => {
  for (const world of MH_WORLDS) {
    for (const def of await storyPeople(world)) {
      const age = ageClassOf({ def }), { look, height } = onBody(world, def);
      if (age === 'child' || age === 'teen') {
        assert.notEqual(look.mask, 'beard', `${world}: ${def.id} is ${age}`);
        assert.ok(height > 0.95 && height < 1.7, `${world}: ${def.id} (${age}) ${height.toFixed(2)} m`);
      } else assert.ok(height > 1.4 && height < 2.15, `${world}: ${def.id} ${height.toFixed(2)} m`);
    }
  }
});

test('the City-Shaft\'s people are MakeHuman bodies: Pip a child of nine in a knit cap, the driver in an aviator\'s cap', async () => {
  assert.ok(MH_WORLDS.has('incal'));
  const { PEOPLE } = await import('../src/story/incal-data.js');
  assert.equal(yearsOf({ def: PEOPLE.pip }), 9);
  const pip = onBody('incal', PEOPLE.pip);
  assert.equal(pip.look.head, 'beanie');
  assert.notEqual(pip.look.mask, 'beard', 'a child: no beard (he had one)');
  assert.equal(onBody('incal', PEOPLE.wren).look.head, 'aviator');
});

test('Vael\'s people are MakeHuman bodies: Tam, who copies you, a boy of seven', async () => {
  assert.ok(MH_WORLDS.has('arzach'));
  const { CONTENT } = await import('../src/levels/content.js');
  const tam = CONTENT.arzach.npcs[0];
  assert.equal(ageClassOf({ def: { age: tam.age, years: tam.years } }), 'child');
  const p = new MakeHumanPeople(data, 'arzach').templateFor({ kind: tam.kind, def: { age: tam.age, years: tam.years, kind: tam.kind } }).userData.profile;
  const h = p.trueScale * p.measured.height;
  assert.ok(h > 1.05 && h < 1.35, `Tam ${h.toFixed(2)} m`);
  const npc = readFileSync(new URL('../src/npc.js', import.meta.url), 'utf8');
  assert.match(npc, /age: s\.age \?\? null, years: s\.years \?\? null/, 'a spawn spot gives its age');
});

test('Vael II\'s people are MakeHuman bodies: Tiv a novice of ten, Mother Ysolde old, in her spectacles', async () => {
  assert.ok(MH_WORLDS.has('arzach2'));
  const { PEOPLE } = await import('../src/story/arzach2-data.js');
  assert.equal(ageClassOf({ def: PEOPLE.tiv }), 'child');
  const tiv = onBody('arzach2', PEOPLE.tiv);
  assert.ok(tiv.height > 1.2 && tiv.height < 1.5, `Tiv ${tiv.height.toFixed(2)} m`);
  assert.equal(onBody('arzach2', PEOPLE.ysolde).look.mask, 'glasses');
});

test("The Hangar's people are MakeHuman bodies: Pip a child of nine, Ambroise's monocle", async () => {
  assert.ok(MH_WORLDS.has('garage'));
  const { PEOPLE } = await import('../src/story/garage-data.js');
  const pip = onBody('garage', PEOPLE.pip);
  assert.equal(ageClassOf({ def: PEOPLE.pip }), 'child');
  assert.ok(pip.height > 1.05 && pip.height < 1.45, `Pip ${pip.height.toFixed(2)} m`);
  assert.equal(onBody('garage', PEOPLE.ambroise).look.mask, 'monocle');
});

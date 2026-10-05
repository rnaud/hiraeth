import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DEFAULTS, cleanState, encodeState, decodeState, settingsJSON } from '../src/studio/state.js';
import { peopleIn, lookFor, BLANK, FACE_PRESETS, STORY_WORLDS, castOf } from '../src/studio/people.js';
import { BODY_MORPHS, FACE_MORPHS, NEUTRAL_BODY, BUILD_SHAPE, radialFactors, boneMorph, cleanMorph, morphKey, isNeutral, faceLandmarks, browPositions, plainGeometry } from '../src/morph.js';
import { EXPRESSION_KEYS, TONE_EXPRESSIONS, expressionFor, cleanExpression, mixExpression } from '../src/expression.js';
import { TONES } from '../src/story/tone.js';
import { HEAD_IDS, HEAD_ID_LIMIT, HAIR_IDS, HEADS, lookPieces, scalp, dressFor } from '../src/costumes.js';
import { mulberry32 } from '../src/noise.js';
import { Humanoid, prepareHuman, buildGeometry, FACE } from '../src/humanoid.js';
import { buildCharacter } from '../src/player.js';
import { BUILD_INPUT } from '../vite.config.js';

// The character studio (studio.html, src/studio/): its URL state, the people it shows, and the
// body / face / expression systems it tunes (src/morph.js, src/expression.js, humanoid.js).

test('studio settings round-trip through the URL; only what differs is written', () => {
  assert.equal(encodeState(DEFAULTS), '');
  const s = cleanState({ who: 'npc', world: 'bazaar', npc: 'sel', seed: 7, talk: true, hour: 17.25, view: 'face',
    b: { height: 1.1, belly: 1.4 }, f: { eyeSize: 1.2 }, l: { head: 'braid', robe: 0.3 }, c: { skin: '#c58c64' }, e: { smile: 0.5 } });
  const q = encodeState(s);
  assert.match(q, /who=npc/);
  assert.match(q, /c\.skin=%23c58c64/);
  assert.doesNotMatch(q, /preset=/, 'defaults are left out');
  const back = decodeState(q);
  assert.deepEqual(back, s);
  assert.equal(typeof back.seed, 'number');
  assert.equal(back.talk, true);
  assert.equal(back.b.belly, 1.4);
  assert.equal(back.c.skin, '#c58c64', 'colours stay strings');
  // junk is dropped, types follow the defaults
  const junk = decodeState('?who=crowd&seed=abc&nonsense=1&b.height=1.2&talk=0');
  assert.equal(junk.seed, DEFAULTS.seed);
  assert.equal(junk.talk, false);
  assert.ok(!('nonsense' in junk));
  assert.equal(junk.b.height, 1.2);
  // the JSON to paste into the code
  const j = JSON.parse(settingsJSON(s));
  assert.equal(j.npc, 'sel');
  assert.deepEqual(j.morph, { height: 1.1, belly: 1.4 });
  assert.deepEqual(j.face, { eyeSize: 1.2 });
  assert.equal(j.expression.smile, 0.5);
});

test('the studio is a page of the build, reachable from the title', () => {
  assert.ok(Object.values(BUILD_INPUT).some((p) => p.endsWith('/studio.html')), 'vite builds studio.html');
  assert.ok(Object.values(BUILD_INPUT).some((p) => p.endsWith('/index.html')), 'and the game');
  for (const p of Object.values(BUILD_INPUT)) assert.ok(existsSync(p), p);
  const html = readFileSync(new URL('../studio.html', import.meta.url), 'utf8');
  assert.match(html, /src="\/src\/studio\/main\.js"/);
  const title = readFileSync(new URL('../src/title.js', import.meta.url), 'utf8');
  assert.match(title, /data-a="studio"/);
  assert.match(title, /'studio\.html'/);
  // it loads only the people's assets: no world (levels/index.js) and no game boot
  const main = readFileSync(new URL('../src/studio/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /levels\/index\.js|from '\.\.\/main\.js'|boot\.js/);
});

test('the studio finds the story people of a world and dresses them as the game does', () => {
  const mod = {
    PEOPLE: { a: { id: 'a', name: 'A', palette: { cloak: '#ff0000' }, kind: 'f' }, b: { id: 'b', name: 'B', head: 'hat' } },
    LOCALS: [{ id: 'c', name: 'C', kind: 'm' }, { id: 'a', name: 'A again', kind: 'm' }],
    THINGS: { well: { id: 'well', name: 'The well', kind: 'm' } },
    ITEMS: { jar: 'a jar' },
  };
  assert.deepEqual(peopleIn(mod).map((d) => d.id), ['a', 'b', 'c']);
  const st = cleanState({ who: 'npc', l: { head: 'curls', beard: true }, c: { skin: '#123456' }, build: 'heavy' });
  const look = lookFor({ who: 'npc', def: mod.PEOPLE.a }, st, 'desert');
  assert.equal(look.cloak, '#ff0000', 'their own colours');
  assert.equal(look.head, 'curls');
  assert.equal(look.skin, '#123456');
  assert.equal(look.build, 'heavy');
  assert.equal(look.mask, 'beard');
  assert.equal(look.kind, 'f');
  // the crowd: the same person for the same seed
  const c1 = lookFor({ who: 'crowd', seed: 4 }, cleanState({ kind: 'f' }), 'bazaar'), c2 = lookFor({ who: 'crowd', seed: 4 }, cleanState({ kind: 'f' }), 'bazaar');
  assert.deepEqual(c1, c2);
  assert.equal(BLANK('f').head, 'long');
  for (const f of Object.values(FACE_PRESETS)) assert.deepEqual(Object.keys(cleanMorph(f, FACE_MORPHS)).sort(), FACE_MORPHS.map((d) => d.key).sort());
});

test('every world\'s faces: the traveller and a story person of each world, a close-up view, all in the URL', async () => {
  assert.match(readFileSync(new URL('../studio.html', import.meta.url), 'utf8'), /<link rel="icon"[^>]*icons\/icon-192\.png/, 'its own icon: no 404 for /favicon.ico');
  const s = decodeState(encodeState({ lineup: 'faces', view: 'close', seed: 2 }));
  assert.equal(s.lineup, 'faces');
  assert.equal(s.view, 'close');
  assert.deepEqual([...STORY_WORLDS].sort(), ['arzach', 'arzach2', 'bazaar', 'buried', 'desert', 'edena', 'garage', 'home', 'incal', 'perdide', 'perdide2', 'spheres']);   // (home: Lou and Aunt Tove)
  for (const w of STORY_WORLDS) assert.ok((await castOf(w)).length > 0, `${w} has story people to show`);
});

test('body morphs: neutral is exactly the build; each slider reshapes or rescales', () => {
  const names = ['spine_01', 'spine_02', 'spine_03', 'pelvis', 'clavicle_l', 'upperarm_l', 'lowerarm_r', 'thigh_l', 'calf_r', 'neck_01', 'Head', 'hand_l'];
  for (const [build, rules] of Object.entries(BUILD_SHAPE)) for (const name of names) {
    const r = rules.find(([re]) => re.test(name));
    assert.deepEqual(radialFactors(name, build, NEUTRAL_BODY), r ? r.slice(1) : null, `${build} ${name}`);
  }
  assert.equal(radialFactors('spine_01', 'average', null), null);
  assert.ok(radialFactors('spine_01', 'average', { belly: 1.5 })[1] > 1.4, 'a belly comes forward');
  assert.ok(radialFactors('clavicle_l', 'average', { shoulders: 1.2 })[0] > 1.15, 'shoulders out');
  // longer legs are thinned back by their length (they scale as a whole), and lift the pelvis
  assert.ok(Math.abs(radialFactors('thigh_l', 'average', { legLength: 1.1 })[0] - 1 / 1.1) < 1e-9);
  const bm = boneMorph({ legLength: 1.1, footSize: 1.2, headSize: 1.15 }, { legSpan: 0.9, ankle: 0.09 });
  assert.ok(Math.abs(bm.lift - (0.1 * 0.9 + 0.2 * 0.09)) < 1e-9);
  assert.ok(Math.abs(bm.scale.foot_l * bm.scale.thigh_l - 1.2) < 1e-9, 'the foot ends up its own size');
  assert.equal(bm.scale.Head, 1.15);
  assert.equal(boneMorph(null).lift, 0);
  // clamped, keyed
  assert.equal(cleanMorph({ height: 9 }).height, BODY_MORPHS.find((d) => d.key === 'height').max);
  assert.equal(morphKey(NEUTRAL_BODY), '');
  assert.equal(morphKey({ belly: 1.2 }), 'belly=1.200');
  assert.ok(isNeutral({}) && !isNeutral({ hips: 1.1 }));
});

test('expressions: every tone has one, in range; talking moves the mouth', () => {
  for (const t of TONES) {
    assert.ok(TONE_EXPRESSIONS[t], t);
    const e = expressionFor(t);
    for (const d of EXPRESSION_KEYS) assert.ok(e[d.key] >= d.min && e[d.key] <= d.max, `${t}.${d.key}`);
  }
  assert.ok(expressionFor('happy').smile > 0.5 && expressionFor('sad').smile < 0 && expressionFor('angry').brow < 0 && expressionFor('surprised').open > 0.3);
  assert.deepEqual(expressionFor('neutral'), cleanExpression({}));
  const opens = Array.from({ length: 40 }, (_, i) => expressionFor('neutral', { talking: true, t: i * 0.05 }).open);
  assert.ok(Math.max(...opens) > 0.15 && Math.min(...opens) < 0.05, 'the mouth opens and closes on the syllables');
  assert.equal(mixExpression({ smile: 0 }, { smile: 1 }, 0.25).smile, 0.25);
  assert.equal(cleanExpression({ smile: 5, squint: -1 }).smile, 1);
  // the brows: raised, lowered and drawn in, inner ends up
  const base = new Float32Array([0.02, 1.71, 0.09, 0.05, 1.71, 0.08, -0.02, 1.71, 0.09]);
  const up = browPositions(base, new Float32Array(9), { brow: 1 }, 0.02), down = browPositions(base, new Float32Array(9), { brow: -1 }, 0.02);
  const worry = browPositions(base, new Float32Array(9), { browTilt: 1 }, 0.02);
  assert.ok(up[1] > base[1] && up[4] > base[4]);
  assert.ok(down[1] < base[1] && Math.abs(down[0]) < Math.abs(base[0]), 'lowered, drawn together');
  assert.ok(worry[1] - base[1] > worry[4] - base[4], 'worry lifts the inner ends');
  assert.ok(Math.abs(faceLandmarks(FACE.m, { eyeHeight: 1 })[0] - FACE.m[0] - 0.004) < 1e-9);
});

test('hairstyles follow the skull: a hairline, not a bowl, inside the crowd shader ids', () => {
  assert.ok(HEAD_IDS.length <= HEAD_ID_LIMIT, 'the crowd packs the head id in 6 bits');
  for (const id of HAIR_IDS) assert.ok(HEADS[id] && HEAD_IDS.includes(id), id);
  for (const kind of ['m', 'f']) for (const id of ['crop', 'shaved', 'curls', 'braid', 'flow']) {
    const s = dressFor('desert', mulberry32(1), { kind, look: { head: id, mask: 'none' } });
    const pieces = lookPieces(s).head;
    assert.ok(pieces.length >= 1 && pieces.every((p) => p.role && p.geo.attributes.position.count > 0), `${kind} ${id}`);
    for (const p of pieces) { const P = p.geo.attributes.position; for (let i = 0; i < P.count; i++) assert.ok(Number.isFinite(P.getX(i) + P.getY(i) + P.getZ(i))); }
  }
  assert.equal(HEADS.bald.parts(1, {}).length, 0);
  // the crop's front edge clears the brow (the old cap came down over it)
  const g = scalp(1, { kind: 'm' }), P = g.attributes.position;
  let frontLow = Infinity;
  for (let i = 0; i < P.count; i++) if (P.getZ(i) > 0.07 && Math.abs(P.getX(i)) < 0.03) frontLow = Math.min(frontLow, P.getY(i));
  assert.ok(frontLow > 0.04, `hairline ${frontLow.toFixed(3)} m over the eyes`);
});

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const bytes = await readFile(new URL('../public/anim/human_m.glb', import.meta.url));
const human = prepareHuman((await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene, 'm');

test('a body takes a morph: girth on the mesh, proportions on the bones, the feet kept on the ground', () => {
  const h = new Humanoid(human, buildCharacter(), 'm', { build: 'broad' });
  const broad = h.body.geometry;
  h.setMorph({});
  assert.equal(h.body.geometry, broad, 'neutral: the build');
  assert.equal(buildGeometry(h.body, 'broad', null), broad);
  const z = (g) => { const P = g.attributes.position; let m = 0; for (let i = 0; i < P.count; i++) if (P.getY(i) > 1.0 && P.getY(i) < 1.15) m = Math.max(m, P.getZ(i)); return m; };
  h.setMorph({ belly: 1.6 });
  assert.ok(z(h.body.geometry) > z(broad) + 0.02, 'the belly comes forward');
  assert.equal(buildGeometry(h.body, 'broad', { belly: 1.6 }), h.body.geometry, 'cached');
  // longer legs: the pelvis rises by the longer leg, the soles stay on the floor
  h.setMorph({ legLength: 1.12, headSize: 1.2 });
  assert.ok(h.lift > 0.09 && h.lift < 0.12, `lift ${h.lift}`);
  assert.equal(h.b.Head.scale.x, 1.2);
  h.char.root.updateMatrixWorld(true);
  h.update();
  const sole = () => { h.model.updateMatrixWorld(true); return h.b.ball_l.getWorldPosition(new THREE.Vector3()).y; };
  const longSole = sole();
  h.setMorph(null);
  h.update();
  assert.ok(Math.abs(longSole - sole()) < 0.02, `the feet stay down (${longSole.toFixed(3)} vs ${sole().toFixed(3)})`);
  assert.equal(h.b.Head.scale.x, 1);
  assert.equal(h.lift, 0);
});

test('a face takes a morph and an expression, on its own materials', () => {
  const a = new Humanoid(human, buildCharacter(), 'm'), b = new Humanoid(human, buildCharacter(), 'm');
  const eyeR0 = a.eyeMesh.material.uniforms.uEyeR.value.x;
  a.setFace({ eyeSize: 1.25, eyeSpacing: 1, lines: 2, freckles: 0.5 });
  const u = a.body.material.uniforms;
  assert.ok(a.body.material.userData.own && a.body.material !== b.body.material, 'its own copies');
  assert.ok(a.eyeMesh.material.uniforms.uEyeR.value.x > eyeR0 * 1.15, 'bigger eyes');
  assert.ok(u.uFace.value.y > FACE.m[1] * 0.9 + 0.004, 'the lids follow the eyes apart');
  assert.deepEqual(u.uFaceKit.value.toArray(), [2, 1, 0.5, 1]);
  assert.equal(b.body.material.uniforms.uFaceKit.value.x, 1, 'the other face is as it was');
  a.setExpression({ smile: 0.7, brow: 0.8, squint: 0.4 });
  assert.deepEqual(u.uMood.value.toArray().map((x) => +x.toFixed(2)), [0.7, 0, 0.8, 0.4]);
  // the brows moved, their weights intact (the model's arrays are interleaved: written on a plain copy)
  const brows = a.browMesh.geometry, W = brows.attributes.skinWeight;
  assert.ok(!brows.attributes.position.isInterleavedBufferAttribute);
  for (let i = 0; i < W.count; i++) assert.ok(Number.isFinite(W.getX(i)));
  const y = (g) => { let s = 0; for (let i = 0; i < g.attributes.position.count; i++) s += g.attributes.position.getY(i); return s / g.attributes.position.count; };
  assert.ok(y(brows) > y(a.browMesh.userData.baseGeometry) + 0.002, 'raised brows');
  a.updateEyes(0.016);
  assert.ok(a.eyeMesh.material.uniforms.uEyeLook.value.w >= 0.4 * 0.45 - 1e-6, 'the squint narrows the lids');
  a.setFace(null);
  assert.equal(a.body.geometry, a.body.userData.baseGeometry, 'and back');
  assert.ok(plainGeometry(human.children[0]?.geometry ?? a.body.geometry).attributes.position.array.length > 0);
});

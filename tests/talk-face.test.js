import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TalkFace, TalkFaces, TALK_FACE, syllableOpen, syllableEnvelope, mouthAt } from '../src/talk-face.js';
import { planLine, voiceOf, VOWELS } from '../src/story/voice.js';
import { TONE_EXPRESSIONS } from '../src/expression.js';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { Dialogue } from '../src/story/dialogue.js';
import { Humanoid, prepareHuman } from '../src/humanoid.js';
import { buildCharacter } from '../src/player.js';

// Faces that talk (src/talk-face.js): the tone of the line on the speaker's face, the mouth on its
// syllables, back to rest after; the conversation (src/story/dialogue.js faces()) says who and how.

/** A stand-in for a Humanoid: it keeps what it was given. */
const face = (rest = null) => ({ restExpression: rest, expression: null, setExpression(e) { this.expression = e ? { ...e } : null; } });
const run = (f, seconds, o, dt = 1 / 60) => { let busy = true; for (let t = 0; t < seconds; t += dt) busy = f.update(dt, o); return busy; };

test('a syllable opens the mouth and shuts it again; a wide vowel more than a narrow one', () => {
  assert.ok(syllableOpen({ vowel: VOWELS.a }) > syllableOpen({ vowel: VOWELS.i }) + 0.3);
  assert.equal(syllableEnvelope(0, 0.1), 0);
  assert.ok(syllableEnvelope(0.065, 0.1) > 0.95);
  assert.equal(syllableEnvelope(0.14, 0.1), 0);
  // a whole line: open on its syllables, closed between and after
  const plan = planLine('~happy~ The water has risen, look!', { voice: voiceOf({ id: 'x' }) });
  const S = plan.syllables;
  assert.ok(S.length > 4);
  const wide = S.reduce((x, y) => (syllableOpen(y) > syllableOpen(x) ? y : x));
  assert.ok(mouthAt(plan, wide.t + wide.dur * 0.45) > 0.4);
  assert.equal(mouthAt(plan, plan.total + 0.2), 0);
  let shut = 0;
  for (let t = 0; t < plan.total; t += 0.005) if (mouthAt(plan, t) < 0.05) shut++;
  assert.ok(shut > 4, 'the mouth closes between syllables');
});

test('the speaker wears the tone while saying the line, keeps it a moment, then eases back to rest', () => {
  const h = face(), f = new TalkFace(h);
  run(f, 0.8, { speaking: true, tone: 'happy', mouth: 0.8 });
  assert.ok(Math.abs(h.expression.smile - TONE_EXPRESSIONS.happy.smile) < 0.03, `smiling ${h.expression.smile}`);
  assert.ok(h.expression.open > 0.25, 'the mouth open on a syllable');
  run(f, 0.3, { speaking: true, tone: 'happy', mouth: 0 });
  assert.ok(h.expression.open < 0.05, 'and shut between them');
  // a new line in another tone: the face goes over to it, not in a jump
  f.update(1 / 60, { speaking: true, tone: 'sad', mouth: 0 });
  assert.ok(h.expression.smile > 0.5, 'still mostly the last tone a frame later');
  run(f, 0.8, { speaking: true, tone: 'sad', mouth: 0 });
  assert.ok(h.expression.smile < -0.5 && h.expression.browTilt > 0.7, 'sad now');
  // the line said: held, then back to rest, and let go
  assert.ok(run(f, TALK_FACE.hold * 0.8, {}));
  assert.ok(h.expression.smile < -0.5, 'held a moment after the line');
  assert.equal(run(f, 4, {}), false);
  assert.equal(h.expression, null, 'at rest: neutral');
  // the traveller's rest is his little smile
  const t = face({ smile: 0.2 }), g = new TalkFace(t);
  run(g, 0.6, { speaking: true, tone: 'angry', mouth: 0.5 });
  assert.ok(t.expression.smile < 0 && t.expression.brow < -0.5);
  assert.equal(run(g, 6, {}), false);
  assert.deepEqual(t.expression, { smile: 0.2 });
  // a line with no voice to follow: the mouth moves by itself while it is said
  const n = face(), k = new TalkFace(n), opens = new Set();
  for (let i = 0; i < 60; i++) { k.update(1 / 60, { speaking: true, tone: 'neutral', mouth: null }); opens.add(n.expression.open.toFixed(2)); }
  assert.ok(opens.size > 10);
});

test('the set of talking faces: driven ones move, the rest ease back and are let go', () => {
  const F = new TalkFaces(), a = face(), b = face();
  for (let i = 0; i < 30; i++) { F.drive(a, { speaking: true, tone: 'surprised', mouth: 0.4 }); F.drive(b, { speaking: false }); F.update(1 / 60); }
  assert.equal(F.size, 1, 'a listener at rest is not kept');
  assert.ok(a.expression.brow > 0.6);
  // driven twice in a frame (a balloon and a conversation): speaking wins
  F.drive(b, { speaking: false }); F.drive(b, { speaking: true, tone: 'happy', mouth: 0 }); F.update(1 / 60);
  assert.ok(b.expression.smile > 0);
  for (let i = 0; i < 400; i++) F.update(1 / 60);
  assert.equal(F.size, 0);
  assert.equal(a.expression, null);
  F.drive(a, { speaking: true, tone: 'happy' }); F.update(1 / 60);
  F.release(a);
  assert.equal(F.size, 0);
  assert.equal(a.expression, null);
});

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const ANA = {
  id: 'ana', name: 'Ana', kind: 'f',
  talk: { nodes: {
    hello: { say: ['~sad~ The water has not risen.', '~happy~ But you came back.'], choices: [{ text: '~curious~ What happened here?', goto: 'more' }, { text: 'Goodbye.', end: true }] },
    more: { say: '~solemn~ The well went quiet one night.', choices: [{ text: 'Goodbye.', end: true }] },
  } },
};

test('a conversation says who speaks, in which tone, and how open their mouth is', () => {
  const game = new GameState(memory());
  const d = new Dialogue({ game, quests: new Quests({ game }) });
  d.start(ANA, { talkTo: null, pos: new THREE.Vector3(1, 0, 0) });
  // the first line, being revealed: she speaks, sad, her mouth on its syllables
  let open = 0, F;
  for (let i = 0; i < 20; i++) { d.update(1 / 60); F = d.faces(); open = Math.max(open, F.npc.mouth); }
  assert.equal(F.npc.speaking, true);
  assert.equal(F.npc.tone, 'sad');
  assert.equal(F.player.speaking, false);
  assert.ok(open > 0.2, `her mouth opens (${open.toFixed(2)})`);
  d.update(10);
  assert.equal(d.faces().npc.speaking, false, 'the line said');
  d.next(); d.update(0.05);
  assert.equal(d.faces().npc.tone, 'happy');
  d.update(10);
  // the traveller answers: his face, his tone, his mouth, for as long as he says it
  d.choose(0);
  let said = 0, mouth = 0;
  for (let i = 0; i < 120; i++) { d.update(1 / 60); const f = d.faces(); if (f.player.speaking) { said++; assert.equal(f.player.tone, 'curious'); mouth = Math.max(mouth, f.player.mouth); } }
  assert.ok(said > 10 && mouth > 0.2, `he answers (${said} frames, mouth ${mouth.toFixed(2)})`);
  // the last word ends the talk; it is still being said after the panel closes
  d.update(10);
  d.choose(0);
  assert.equal(d.open, false);
  d.update(1 / 60);
  assert.equal(d.faces().player.speaking, true);
  assert.equal(d.faces().npc.speaking, false);
});

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const bytes = await readFile(new URL('../public/anim/human_m.glb', import.meta.url));
const human = prepareHuman((await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene, 'm');

test('on a body: the face ink and the brows follow, the brows only when they move, the materials its own', () => {
  const a = new Humanoid(human, buildCharacter(), 'm'), b = new Humanoid(human, buildCharacter(), 'm');
  const shared = a.body.material === b.body.material;
  const f = new TalkFace(a);
  for (let i = 0; i < 40; i++) f.update(1 / 60, { speaking: true, tone: 'surprised', mouth: i % 2 });
  assert.ok(a.body.material.uniforms.uMood.value.z > 0.8, 'the brow raised in the ink');
  if (shared) assert.notEqual(a.body.material, b.body.material, 'its own material, the other body untouched');
  assert.equal(b.body.material.uniforms.uMood.value.z, 0);
  // the mouth on the syllables doesn't re-pose the brows' geometry every frame
  const P = a.browMesh.geometry.attributes.position;
  const v0 = P.version;
  for (let i = 0; i < 10; i++) a.setExpression({ ...a.expression, open: i % 2 ? 0.5 : 0 });
  assert.equal(P.version, v0);
});

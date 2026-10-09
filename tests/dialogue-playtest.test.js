// The dialogue notes from the playtest of 2026-10-08 (TODO.md "Dialogue"): the traveller calm while he
// talks, his eyes on the speaker, Nour's answers to "stand in water", the camp fire kept out of Ama's
// shot, and who gets a balloon over their head. (The answer no longer said back: tests/convo-closeup.test.js;
// his body held still with the real rig and clips: tests/idle-legs.test.js.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mulberry32 } from '../src/noise.js';
import { EyeLook, EYE_CALM } from '../src/eyes.js';
import { idleMotion, TALK_CALM } from '../src/player.js';
import { DialogueRunner } from '../src/story/dialogue.js';
import { PEOPLE } from '../src/story/desert-data.js';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { stripTone } from '../src/story/tone.js';
import { pickTwoShot, sightOf, VEIL_PAD, VEIL_CLOSE } from '../src/story/shot.js';
import { Flames, flameVeils } from '../src/story/flames.js';
import { balloonReason, hasBalloon } from '../src/story/balloons.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

// ---------------------------------------------------------------- calm while talking

test('the standing layer, talking: the weight shift held small, no head glances or nods', () => {
  let sway = 0, swayCalm = 0, look = 0, nod = 0;
  for (let t = 0; t < 60; t += 0.05) {
    const a = idleMotion(t, 0), b = idleMotion(t, 1);
    sway = Math.max(sway, Math.abs(a.w)); swayCalm = Math.max(swayCalm, Math.abs(b.w));
    look = Math.max(look, Math.abs(b.look)); nod = Math.max(nod, Math.abs(b.nod));
    assert.equal(a.breath, b.breath, 'he still breathes');
  }
  assert.ok(sway > 0.95);
  assert.ok(Math.abs(swayCalm - sway * TALK_CALM.sway) < 1e-9, `the shift keeps ${TALK_CALM.sway} of its size`);
  assert.equal(look, 0, 'no glances');
  assert.equal(nod, 0, 'no nods');
  // standing, he does look about
  assert.ok(Math.max(...Array.from({ length: 600 }, (_, i) => Math.abs(idleMotion(i * 0.1).look))) > 0.4);
});

test('calm eyes: on the speaker whenever they are in reach; otherwise fewer, smaller glances', () => {
  // the speaker in reach: always on them
  const e = new EyeLook(mulberry32(5)), toward = V(0.1, 0, 1).normalize();
  for (let i = 0; i < 600; i++) { e.update(1 / 60, toward, { calm: true }); if (i > 30) assert.ok(e.look.angleTo(toward) < 0.12, 'held on the speaker'); }
  assert.equal(e.held, true);
  // nobody in reach: count the glances over a minute
  const glances = (calm) => {
    const g = new EyeLook(mulberry32(7));
    let n = 0, far = 0, last = null;
    for (let i = 0; i < 3600; i++) {
      g.update(1 / 60, null, { calm });
      if (!last || !last.equals(g.glance)) { n++; last = g.glance.clone(); }
      far = Math.max(far, Math.abs(g.glance.x));
    }
    return { n, far };
  };
  const loose = glances(false), calm = glances(true);
  assert.ok(calm.n * 2 < loose.n, `${calm.n} glances a minute calm, ${loose.n} otherwise`);
  assert.ok(calm.far <= 0.25 * EYE_CALM.reach + 1e-9, `no further than ${calm.far.toFixed(2)} rad`);
});

// ---------------------------------------------------------------- Nour: "stand in water"

test('Nour: the answers to "stand in water" follow on from it', () => {
  const game = new GameState(memory()), quests = new Quests({ game });
  game.set('item.backpack', 1); game.set('tool.empty', true);
  const r = new DialogueRunner(PEOPLE.nour, { game, quests });
  assert.equal(r.nodeId, 'opened');
  while (!r.lastPage) r.advance();
  r.choose(r.choices().find((c) => /on my back/.test(c.text)).index);
  assert.equal(r.nodeId, 'pack');
  while (!r.lastPage) r.advance();
  assert.match(r.text, /Stand in water/);
  const answers = r.choices().map((c) => c.text);
  assert.equal(answers.length, 2);
  assert.ok(answers.every((a) => /water/i.test(a)), `each answer takes up the water: ${answers.join(' / ')}`);
  assert.ok(!answers.some((a) => /didn’t fall/.test(a)), 'not the crash, out of nowhere');
  // where is there water: she says why there is none, and the crash and the ship follow from that
  r.choose(r.choices().find((c) => /Where/.test(c.text)).index);
  assert.equal(r.nodeId, 'water');
  while (!r.lastPage) r.advance();
  assert.match(r.pages.join(' '), /stopped rising/);
  assert.deepEqual(r.choices().map((c) => PEOPLE.nour.talk.nodes.water.choices[c.index].goto), ['struck', 'power']);
  // every line in the new node has a tone
  for (const s of [...PEOPLE.nour.talk.nodes.water.say, ...PEOPLE.nour.talk.nodes.water.choices.map((c) => c.text), ...PEOPLE.nour.talk.nodes.pack.choices.map((c) => c.text)]) assert.notEqual(stripTone(s), s);
});

test('no reply in the desert opens by repeating the question it answers', () => {
  const { speaker } = PEOPLE;
  assert.ok(!/^The swamp of lights/.test(stripTone(speaker.talk.nodes.swamp.say[0])));
});

// ---------------------------------------------------------------- Ama and the camp fire

test('a fire between the camera and the face counts as blocked, and the two-shot goes round it', () => {
  const scene = new THREE.Scene();
  // the traveller at the origin, Ama 1.45 m along +x, the camp fire 2.2 m off to the +z side of them:
  // right where the two-shot from that side would look through it
  const a = V(0, 0, 0), b = V(1.45, 0, 0);
  const f = new Flames(scene, [{ at: V(0.9, 0.25, 2.2), h: 2.6, r: 0.75 }, { at: V(1.2, 0.25, 2.0), h: 1.7, r: 0.5 }]);
  const veils = flameVeils(V(), 30);
  assert.equal(veils.length, 2);
  assert.ok(Math.abs(veils[0].top.y - veils[0].base.y - 2.6) < 1e-6);
  const plain = pickTwoShot({ a, b, from: V(0.7, 2, 5), sight: sightOf(null) });
  const sight = sightOf(null, { veils: (near) => flameVeils(near, 30) });
  // (without the veils the camera stands on the fire's side, looking through it)
  assert.ok(sight.veil(plain.eye, V(1.45, 1.55, 0)) > 0 || sight.veil(plain.eye, V(0, 1.55, 0)) > 0, 'the old shot looked through the fire');
  const shot = pickTwoShot({ a, b, from: V(0.7, 2, 5), sight });
  assert.equal(shot.blocked ?? 0, 0, 'a clear shot found');
  for (const face of [V(1.45, 1.55, 0), V(0, 1.55, 0)]) assert.equal(sight.veil(shot.eye, face), 0, 'nothing of the fire between the camera and either face');
  assert.ok(sight.veilNear(shot.eye, shot.look) < 1, 'the camera not standing in the fire');
  // the camera standing in the flames (or a step from them) is blocked whichever way it looks; one beside a fire behind it is not
  assert.equal(sight.veilNear(V(0.9, 2, 2.2 + VEIL_CLOSE), V(0.9, 1.5, 10)), 1);
  assert.equal(sight.veilNear(V(0.9, 2, 5.5), V(0.9, 1.5, 10)), 0, 'the fire behind the camera, out of the frame');
  assert.ok(sight.veilNear(V(0.9, 2, 5.5), V(0.9, 1.5, 0)) > 0, 'the same fire in front of it, filling the frame: a cost');
  // a fire put out (or a level taken down) is no veil
  f.intensity = 0;
  assert.equal(flameVeils(V(), 30).length, 0);
  f.intensity = 1; scene.remove(f.mesh);
  assert.equal(flameVeils(V(), 30).length, 0);
  assert.ok(VEIL_PAD > 0);
});

// ---------------------------------------------------------------- balloons

test('balloons: only for someone with something for you', () => {
  const game = new GameState(memory()), quests = new Quests({ game });
  const nour = PEOPLE.nour, at = V(3, 0, 4);
  const ctx = (o = {}) => ({ game, quests, at, ...o });
  // a quest person you have never talked to: their first greeting
  assert.equal(balloonReason(nour, ctx()), 'new');
  game.set('met.nour', true);
  assert.equal(balloonReason(nour, ctx()), null, 'met, nothing new: no balloon');
  // the quest you follow points at her
  assert.equal(balloonReason(nour, ctx({ objective: { position: at.clone().add(V(0.5, 0, 0)) } })), 'objective');
  assert.equal(balloonReason(nour, ctx({ objective: { position: V(40, 0, 0) } })), null);
  // she opens the world's quest, still waiting for its first conversation
  quests.define({ id: 'q.test', title: 'Test', stages: [{ id: 'a', text: 'A' }] });
  quests.opensWith('q.test', ['nour']);
  assert.equal(balloonReason(nour, ctx()), 'quest');
  quests.start('q.test');
  assert.equal(balloonReason(nour, ctx()), null);
  // a bystander (listen-only): only news not yet heard
  const oum = { id: 'bys', talk: { listen: ['~tired~ Sand.', { after: { flag: 'world.done' }, say: '~happy~ It is done!' }] } };
  assert.equal(balloonReason(oum, ctx()), null, 'nothing new');
  game.set('world.done', true);
  assert.equal(balloonReason(oum, ctx()), 'news');
  const r = new DialogueRunner(oum, { game, quests });
  assert.match(r.text, /It is done/);
  assert.equal(hasBalloon(oum, ctx()), false, 'heard it: no balloon');
  // nobody with no talk at all
  assert.equal(hasBalloon({ id: 'x' }, ctx()), false);
  assert.equal(hasBalloon(null, ctx()), false);
});

test('balloons: the NPC keeps its balloon down when quiet, a shout still shows', async () => {
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/npc.js', import.meta.url), 'utf8'));
  assert.match(src, /!this\.hush && !this\.quiet && this\.greeted/, 'a greeting waits for something to say');
  assert.match(src, /if \(this\.shout && this\.time < this\.shout\.until\) this\.talking = true;/, 'a shout always shows');
  assert.match(src, /\(dist < 6 && !this\.quiet\) \|\| now < \(p\.shoutUntil/, 'a crowd person too');
});

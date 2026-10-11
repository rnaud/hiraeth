import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { pickSingle, pickTwoShot, sightOf, SINGLE } from '../src/story/shot.js';
import { Coverage, COVER, REACTS } from '../src/story/coverage.js';
import { Dialogue } from '../src/story/dialogue.js';
import { screen } from '../src/platform.js';

// The traveller's face in conversations: who the camera frames (src/story/coverage.js), the close shot of
// his face (src/story/shot.js pickSingle), the reply coming straight after his answer, his portrait on his lines
// (src/story/dialogue.js).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const level = (...boxes) => {
  const scene = new THREE.Scene();
  for (const [x, y, z, w, h, d] of [[0, -0.5, 0, 200, 1, 200], ...boxes]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); scene.add(m); }
  return new Physics(scene);
};
const clear = (physics, from, to, margin = 0.15) => physics.rayDistance(from, to.clone().sub(from).normalize(), from.distanceTo(to)) >= from.distanceTo(to) - margin;
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const deg = (r) => (r * 180) / Math.PI;

/** How tall a face (SINGLE.face m) is on the screen from `eye` looking at `look`, as a share of the frame's height, and where (NDC). */
function onScreen(eye, look, face, fov = 55, aspect = 16 / 9) {
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.05, 100);
  cam.position.copy(eye); cam.lookAt(look); cam.updateMatrixWorld();
  const top = face.clone().addScaledVector(UP, SINGLE.face / 2).project(cam), bot = face.clone().addScaledVector(UP, -SINGLE.face / 2).project(cam);
  const c = face.clone().project(cam);
  return { h: (top.y - bot.y) / 2, x: c.x, y: c.y };
}

// ---------------------------------------------------------------- who is framed

// The close shot is off in the game since v1.42 (COVER.close: the author's note, the zoom on his face added
// little); the tests of its machinery turn it on for themselves.
const closeOn = (fn) => () => { COVER.close = true; try { return fn(); } finally { COVER.close = false; } };

test('the close shot is off: his own pages and strong lines keep the two-shot of both of them', () => {
  assert.equal(COVER.close, false);
  const { changes, log } = run([{ tone: 'neutral' }, { speaker: 'player', tone: 'surprised' }, { tone: 'sad', letters: 60 }, { tone: 'neutral', answer: true }, { tone: 'shout', letters: 40 }]);
  assert.equal(changes.length, 0);
  assert.ok(log.every(([, w]) => w === 'two'));
});

/** Run a conversation through the coverage: pages [{ speaker, tone, letters, answer }] read at `read` s a page. */
function run(pages, { dt = 1 / 30, read = 2.5, reveal = 40, can = true } = {}) {
  const c = new Coverage(); c.reset(0);
  const log = [];
  let t = 0;
  pages.forEach((p, k) => {
    // the traveller's answer first (Dialogue's beat), then the page revealed and read
    for (let a = 0; p.answer && a < 1.2; a += dt, t += dt) log.push([t, c.update({ t, page: `p${k}`, speaker: 'npc', tone: p.tone, answering: true, letters: p.letters, can })]);
    const out = (p.letters ?? 30) / reveal;
    for (let s = 0; s < out + read; s += dt, t += dt) {
      const done = s >= out;
      log.push([t, c.update({ t, page: `p${k}`, speaker: p.speaker ?? 'npc', tone: p.tone ?? 'neutral', done, doneFor: done ? s - out : 0, letters: p.letters ?? 30, can })]);
    }
  });
  const changes = [];
  for (let i = 1; i < log.length; i++) if (log[i][1] !== log[i - 1][1]) changes.push(log[i]);
  return { c, log, changes };
}

test('the two-shot while they speak plainly: several pages in a row, no cut', () => {
  const { changes, log } = run([{ tone: 'neutral' }, { tone: 'curious' }, { tone: 'tired', letters: 80 }, { tone: 'neutral' }]);
  assert.equal(changes.length, 0);
  assert.ok(log.every(([, w]) => w === 'two'));
});

test('his answer: his face at once, for as long as he says it; then the two-shot for the reply', closeOn(() => {
  const { changes } = run([{ tone: 'neutral' }, { tone: 'neutral', answer: true }]);
  assert.deepEqual(changes.map(([, w]) => w), ['traveller', 'two']);
  assert.ok(changes[1][0] - changes[0][0] >= 1.1, 'held while he says it');
  // his own pages, in a row: one shot of him over all of them
  const own = run([{ tone: 'neutral' }, { speaker: 'player', tone: 'surprised' }, { speaker: 'player', tone: 'scared' }, { tone: 'neutral' }]);
  assert.deepEqual(own.changes.map(([, w]) => w), ['traveller', 'two']);
}));

test('a strong line: once it is out, his face taking it in, held until the page turns', closeOn(() => {
  const { changes, c } = run([{ tone: 'neutral' }, { tone: 'sad', letters: 60 }, { tone: 'neutral' }]);
  assert.deepEqual(changes.map(([, w]) => w), ['traveller', 'two']);
  const [[t0], [t1]] = changes;
  // (page 1 starts at 30/40 + 2.5 = 3.25 s; its 60 letters are out at 1.5 s into it)
  assert.ok(t0 >= 3.25 + 1.5 + COVER.react.after - 0.05, `not before the line is out and a moment after (${t0.toFixed(2)})`);
  assert.ok(Math.abs(t1 - (3.25 + 1.5 + 2.5)) < 0.1, `back when the page turns (${t1.toFixed(2)})`);
  assert.equal(c.reaction, null);
  assert.equal(REACTS.sad, 'sad');
  // his look is the reaction's while it lasts
  const r = new Coverage(); r.reset(0);
  r.update({ t: 5, page: 'a', tone: 'angry', done: true, doneFor: 1, letters: 40 });
  assert.equal(r.who, 'traveller'); assert.equal(r.reaction.look, 'scared');
}));

test('no cut thrash: reactions spaced out, short lines and quick pages left alone, the opening shot held', closeOn(() => {
  // a run of strong lines: his face no sooner than COVER.react.gap s after it was last on the screen
  const strong = run(Array.from({ length: 8 }, () => ({ tone: 'shout', letters: 40 })), { read: 1.4 });
  const into = strong.changes.filter(([, w]) => w === 'traveller').map(([t]) => t);
  const outs = strong.changes.filter(([, w]) => w === 'two').map(([t]) => t);
  assert.ok(into.length >= 2, 'it does react');
  for (let i = 1; i < into.length; i++) assert.ok(into[i] - outs[i - 1] >= COVER.react.gap - 0.05, `spaced: ${into.map((t) => t.toFixed(1))}`);
  // a cut it makes by itself (to his reaction) comes only after the shot before it was held COVER.hold s;
  // the way back is the page turning (a press)
  const all = [0, ...strong.changes.map(([t]) => t)];
  for (let i = 1; i < all.length; i++) if (strong.changes[i - 1][1] === 'traveller') assert.ok(all[i] - all[i - 1] >= COVER.hold - 0.05, `held: ${all.map((t) => t.toFixed(1))}`);
  // a short strong line ("Oh!"), or pages turned before the moment comes: no reaction
  assert.equal(run([{ tone: 'surprised', letters: 6 }, { tone: 'sad', letters: 10 }]).changes.length, 0);
  assert.equal(run([{ tone: 'sad', letters: 40 }, { tone: 'sad', letters: 40 }], { read: 0.3 }).changes.length, 0);
  // the opening two-shot is held before he reacts to the very first line
  const first = run([{ tone: 'shout', letters: 20 }]);
  assert.ok(first.changes[0][0] >= COVER.hold, `${first.changes[0][0]}`);
  // no close shot to be had (riding a cab, swimming): the two-shot throughout
  assert.equal(run([{ tone: 'sad', letters: 60 }, { tone: 'neutral', answer: true }], { can: false }).changes.length, 0);
}));

// ---------------------------------------------------------------- the close shot

test('the close shot: his face about a fifth of the frame, three-quarter, on the two-shot’s side, room to look', () => {
  const a = V(0, 0, 0), b = V(1.45, 0, 0);
  const fa = V(0, 1.61, 0), fb = V(1.45, 1.6, 0);
  for (const side of [1, -1]) {
    const s = pickSingle({ fa, fb, b, side, fov: 55, aspect: 16 / 9 });
    assert.equal(s.kind, 'single'); assert.ok(s.ok);
    const p = onScreen(s.eye, s.look, fa);
    assert.ok(p.h > 0.16 && p.h < 0.25, `the face's height: ${(p.h * 720).toFixed(0)} px at 720 (${(p.h * 1080).toFixed(0)} at 1080)`);
    assert.ok(p.y > 0.15 && p.y < 0.55, `in the upper part of the frame, clear of the panel (${p.y.toFixed(2)})`);
    // the side of the line between them the two-shot is on (cross(up, a→b))
    const two = pickTwoShot({ a, b, side });
    assert.equal(Math.sign(s.eye.z), Math.sign(two.eye.z), 'the 180° rule');
    assert.equal(two.side, side);
    const yaw = deg(V(1, 0, 0).angleTo(s.eye.clone().sub(fa).setY(0)));
    assert.ok(yaw > 20 && yaw < 50, `a three-quarter view (${yaw.toFixed(0)}°)`);
    // he looks toward +x: his face sits on the other side of the frame
    const cam = new THREE.PerspectiveCamera(55, 16 / 9); cam.position.copy(s.eye); cam.lookAt(s.look); cam.updateMatrixWorld();
    const ahead = fa.clone().add(V(1, 0, 0)).project(cam);
    assert.ok(Math.sign(ahead.x - p.x) === -Math.sign(p.x), `room in front of him (face at ${p.x.toFixed(2)})`);
  }
  // his head turned a little: the angle goes with it, still on its side
  const turned = pickSingle({ fa, fb, b, side: 1, facing: V(Math.cos(0.4), 0, -Math.sin(0.4)) });
  const yaw = deg(V(Math.cos(0.4), 0, -Math.sin(0.4)).angleTo(turned.eye.clone().sub(fa).setY(0)));
  assert.ok(yaw > 20 && yaw < 50 && turned.eye.z < 0, `${yaw.toFixed(0)}°, ${turned.eye.toArray().map((v) => v.toFixed(2))}`);
});

test('the close shot looks down with him at a child or someone seated, and never stands inside a giant', () => {
  const fa = V(0, 1.61, 0);
  const child = pickSingle({ fa, fb: V(1.2, 1.0, 0), b: V(1.2, 0, 0), side: 1 });
  assert.ok(child.eye.y < fa.y - 0.1, `lower (${child.eye.y.toFixed(2)})`);
  const giant = pickSingle({ fa, fb: V(1.9, 3.4, 0), b: V(1.9, 0, 0), radius: 0.7, side: 1 });
  const axis = Math.hypot(giant.eye.x - 1.9, giant.eye.z);
  assert.ok(axis > 0.8, `clear of the giant's body (${axis.toFixed(2)} m from their axis)`);
});

test('the close shot is not taken through a wall; with no room for it, the two-shot instead', () => {
  // a wall right beside them on the +z side: the +z close shot would be inside or behind it
  const physics = level([0.7, 2, 0.45, 6, 4, 0.2]);
  const sight = sightOf(physics);
  const fa = V(0, 1.61, 0), fb = V(1.45, 1.6, 0), b = V(1.45, 0, 0);
  const s = pickSingle({ fa, fb, b, side: 1, sight });
  if (s.ok) assert.ok(clear(physics, s.eye, fa) && sight.room(s.eye, 0.2), `seen from ${s.eye.toArray()}`);
  else assert.ok(s.cost > SINGLE.max || s.blocked || !s.room);
  // boxed in: a cupboard of a room round him, nowhere for a camera a metre off
  const boxed = level([0, 2, 0.5, 3, 4, 0.2], [0, 2, -0.5, 3, 4, 0.2], [0.6, 2, 0, 0.2, 4, 1.2], [-0.6, 2, 0, 0.2, 4, 1.2]);
  const shut = pickSingle({ fa, fb: V(0.4, 1.6, 0), b: V(0.4, 0, 0), side: 1, sight: sightOf(boxed) });
  assert.equal(shut.ok, false);
});

// ---------------------------------------------------------------- in the conversation

const ANA = {
  id: 'ana', name: 'Ana', kind: 'f', color: '#3a6ea5',
  talk: { nodes: {
    hello: { say: ['~neutral~ The water has not risen this year, nor the year before.'], choices: [{ text: '~curious~ What happened to the well?', goto: 'more' }, { text: 'Goodbye.', end: true }] },
    more: { say: '~sad~ It went quiet one night, and my brother went down to see why.', choices: [{ text: 'Goodbye.', end: true }] },
  } },
};

test('choosing an answer: it is not said back; she replies at once, the two-shot on her', closeOn(() => {
  // (playtest, October 2026: picking an answer used to put his words back in the panel, voiced, his face on
  // the screen, before the reply; it read as the line being played back)
  const game = new GameState(memory());
  const tones = [];
  const d = new Dialogue({ game, quests: new Quests({ game }), portraitYou: (tone) => { tones.push(tone); return { src: `data:you-${tone}`, background: '#fff' }; } });
  const npc = { talkTo: null, pos: V(1.45, 0, 0) };
  const player = { pos: V(0, 0, 0) };
  const cam = new THREE.PerspectiveCamera(55, 16 / 9); cam.position.set(0.7, 2.5, 5);
  const frame = (single = V(0, 1.61, 0)) => d.frameCamera(cam, player, npc.pos, UP, [], { faceA: V(0, 1.58, 0), faceB: V(1.45, 1.6, 0), single });
  d.start(ANA, npc);
  for (let i = 0; i < 30; i++) { d.update(1 / 30); frame(); }
  assert.ok(cam.position.distanceTo(V(0.725, 1.5, 0)) > 2.5, 'the two-shot while she speaks');
  d.update(10); frame();
  d.choose(0);
  assert.equal(d.beat, undefined, 'no answer beat');
  assert.equal(screen.state.dialogue.speaker, 'npc');
  assert.equal(screen.state.dialogue.name, 'Ana');
  assert.notEqual(screen.state.dialogue.text, 'What happened to the well?', 'his answer is not shown again');
  assert.match(screen.state.dialogue.text, /went quiet one night/);
  assert.equal(d.faces().player.speaking, false, 'he does not say it again');
  d.update(0.2); frame();
  assert.ok(d.revealed > 0, 'the reply starts at once');
  assert.equal(d.faces().npc.speaking, true);
  assert.ok(cam.position.distanceTo(V(0.725, 1.5, 0)) > 2.5, 'and the two-shot for it');
  // the sad reply, once out: his face taking it in, wearing its reaction
  for (let i = 0; i < 30 * (COVER.react.gap + 1); i++) { d.update(1 / 30); frame(); }
  assert.equal(d.cover.who, 'traveller');
  assert.equal(d.faces().player.look, 'sad');
  assert.ok(cam.position.distanceTo(V(0, 1.61, 0)) < 1.4);
  assert.deepEqual(tones, [], 'no portrait of him: he never had the floor');
  d.close();
}));

test('no close shot to be had keeps the two-shot', () => {
  const game = new GameState(memory());
  const d = new Dialogue({ game, quests: new Quests({ game }) });
  const npc = { talkTo: null, pos: V(1.45, 0, 0) };
  const cam = new THREE.PerspectiveCamera(55, 16 / 9); cam.position.set(0.7, 2.5, 5);
  d.start(ANA, npc);
  d.update(10);
  d.choose(0);
  assert.equal(d.revealed, 0, 'the reply starts from its first letter');
  d.update(0.2);
  assert.ok(d.revealed > 0);
  // riding, or no drawn face (o.single null): never the close shot
  for (let i = 0; i < 200; i++) { d.update(1 / 30); d.frameCamera(cam, { pos: V() }, npc.pos, UP, [], { single: null }); }
  assert.ok(d._shot.kind !== 'single');
  assert.ok(cam.position.distanceTo(V(0.725, 1.5, 0)) > 2.5);
  d.close();
});

test('in the game a conversation holds the two-shot: no cut to his face on a strong line', () => {
  const game = new GameState(memory());
  const d = new Dialogue({ game, quests: new Quests({ game }) });
  const npc = { talkTo: null, pos: V(1.45, 0, 0) };
  const cam = new THREE.PerspectiveCamera(55, 16 / 9); cam.position.set(0.7, 2.5, 5);
  const frame = () => d.frameCamera(cam, { pos: V() }, npc.pos, UP, [], { faceA: V(0, 1.58, 0), faceB: V(1.45, 1.6, 0), single: V(0, 1.61, 0) });
  d.start(ANA, npc);
  d.update(10); frame();
  d.choose(0);
  for (let i = 0; i < 30 * (COVER.react.gap + 2); i++) { d.update(1 / 30); frame(); }
  assert.equal(d.cover.who, 'two');
  assert.ok(d._shot.kind !== 'single');
  assert.ok(cam.position.distanceTo(V(0.725, 1.5, 0)) > 2.5, 'the camera stays back on both of them');
  d.close();
});

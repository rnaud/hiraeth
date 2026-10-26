// Temple endings (issue #655): every house goes door → introduction → ending game → completion film. The Rose House and
// the Aerie play a kit minigame (tests/helper-*.test.js); the other twelve play their guardian's trial in its hall
// (src/temples/trial-flow.js). Here, on each real house: the door's crossing holds the guardian asleep through its
// introduction (two panels, the table's two captions), its end wakes it and shuts the door, a knock-out's retry wakes
// it without the film, leaving the hall calls it off with nothing won, a reload plays the film again, the win gives
// the completion film and the temple's flag once, and a finished house plays nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { buildableById } from '../src/levels/buildable.js';
import { TEMPLES, TEMPLE_HOME, templeOf, setupTempleStory } from '../src/temples/index.js';
import { TEMPLE_ENDINGS, ENDING_CAPTIONS, HELPER_ENCOUNTERS, HELPER_ENTRANCES } from '../src/temples/endings.js';
import { endingOpeningShots, endingSubject, endingSubjects } from '../src/temples/helper-cinematics.js';
import { QUIT_AFTER } from '../src/temples/trial-flow.js';
import { TONES } from '../src/story/tone.js';
import { game } from '../src/game-state.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const TRIALS = Object.keys(TEMPLE_ENDINGS).filter((id) => TEMPLE_ENDINGS[id].kind === 'trial');

test('the endings table: every temple once, two toned captions each, helpers derived from it', () => {
  assert.deepEqual(Object.keys(TEMPLE_ENDINGS).sort(), Object.keys(TEMPLES).sort());
  assert.deepEqual(Object.keys(HELPER_ENCOUNTERS).sort(), ['arzach', 'desert']);
  assert.deepEqual(Object.keys(HELPER_ENTRANCES).sort(), ['arzach', 'desert']);
  assert.equal(TRIALS.length, 12);
  for (const [id, lines] of Object.entries(ENDING_CAPTIONS)) {
    assert.equal(lines.length, 2, id);
    for (const l of lines) {
      assert.equal(l.who, 'scene', id); assert.ok(TONES.includes(l.tone), `${id}: ${l.text}`);
      assert.ok(!l.text.includes('~') && l.text.length <= 90, `${id}: one short line: ${l.text}`);
    }
  }
  for (const id of TRIALS) assert.ok(TEMPLES[id].def.arenaDoor, `${id}: its special door is its arena door`);
});

/** A house built in its world, a stand-in traveller and a film stage that records what it is asked to play. */
function house(id) {
  const world = TEMPLE_HOME[id] ?? id;
  const level = quiet(() => buildableById(world).create(new THREE.Scene())), rt = templeOf(level, id) ?? level.temple;
  const G = rt.guardian, door = rt.piece(rt.def.arenaDoor);
  door.group.updateMatrixWorld(true);
  const toDoor = door.group.getWorldPosition(V()).sub(G.arena.center).setY(0).normalize();
  const inHall = G.arena.center.clone().addScaledVector(toDoor, G.arena.r - 2.5).setY(G.arena.y);
  const player = { pos: inHall.clone(), heading: 0, dead: false, opts: {}, frame: { up: V(0, 1, 0), dir: (_h, o) => o.set(0, 0, 1) } };
  const films = [];
  const moments = { current: null, get playing() { return !!this.current && !this.current.done; },
    play(spec) { const m = { spec, done: false, finish() { if (this.done) return; this.done = true; spec.onEnd?.(); } }; films.push(m); this.current = m; return m; } };
  const story = setupTempleStory({ level, levelId: world, player, game, moments, quests: { isStarted: () => true } });
  const finales = [];
  rt.onFinale = () => finales.push(id);
  const update = rt.update; rt.update = () => {};   // (the room's own physics is the playthroughs'; the flow is the story's and the guardian's)
  const step = (dt = 1 / 30) => { G.update(dt, 0); story.update(dt, 0); };
  return { rt, G, door, player, inHall, films, moments, story, finales, step, dispose() { rt.update = update; story.dispose(); rt.dispose?.(); } };
}

for (const id of TRIALS) test(`${id}: door → introduction → trial; retry, quit, reload, win`, () => {
  game.reset();
  let h = house(id);
  try {
    const { G, rt } = h;
    assert.equal(G.state, 'sleep');
    const before = rt.logic.isOpen(rt.def.arenaDoor);   // (as the puzzles leave it: shut in a fresh save)
    // the door crossed: the introduction, the guardian asleep through it
    h.step();
    assert.equal(h.films.length, 1, 'the crossing plays the introduction');
    const spec = h.films[0].spec;
    assert.equal(spec.shots.length, 2, 'guardian, then what is at stake');
    assert.deepEqual(spec.beats.map((b) => b.line.text), ENDING_CAPTIONS[id].map((l) => l.text));
    h.step(); h.step();
    assert.equal(G.state, 'sleep', 'it sleeps through its introduction');
    assert.equal(h.films.length, 1, 'one film per crossing');
    // its end (or its skip): the trial begins, the door shut behind
    h.films[0].finish();
    assert.equal(G.state, 'wake');
    assert.equal(rt.logic.isOpen(rt.def.arenaDoor), false, 'the special door shuts behind you');
    assert.equal(game.flag(`temple.${id}.done`), undefined, 'neither the film nor its skip completes anything');
    // knocked out: the runtime's own reset (runtime.js), then back in: no film again, it wakes at once
    G.reset(); rt.logic.force(rt.def.arenaDoor, null); rt.applyDoors();
    h.step();
    assert.equal(G.state, 'wake', 'a retry wakes it straight away');
    assert.equal(h.films.length, 1, 'no film on a retry');
    // left the hall another way (the last mark, the ship): called off, nothing won, its door open again
    h.player.pos.copy(G.arena.center).add(V(0, 0, 0)).addScaledVector(V(1, 0, 0), G.arena.r + 40);
    h.player.pos.y = G.arena.y;
    for (let t = 0; t <= QUIT_AFTER + 0.2; t += 1 / 30) h.story.update(1 / 30, 0);
    assert.equal(G.state, 'sleep', 'leaving the hall calls the trial off');
    assert.equal(rt.logic.isOpen(rt.def.arenaDoor), before, 'and its door is as the puzzles left it again');
    assert.equal(rt.logic.resolved, false); assert.equal(game.flag(`temple.${id}.done`), undefined);
    assert.equal(h.finales.length, 0, 'no completion film for a quit');
    // a knock-out is not a quit
    h.player.pos.copy(h.inHall); h.step(); assert.equal(G.state, 'wake');
    h.player.dead = true; h.player.pos.addScaledVector(V(1, 0, 0), 200);
    for (let t = 0; t <= QUIT_AFTER + 0.2; t += 1 / 30) h.story.update(1 / 30, 0);
    assert.equal(G.state, 'wake', 'the knock-out is the runtime’s to reset');
    h.player.dead = false; h.player.pos.copy(h.inHall);
    // a reload mid-trial: nothing of it saved, the introduction plays again
    h.dispose(); h = house(id);
    assert.equal(h.G.state, 'sleep'); h.step();
    assert.equal(h.films.length, 1, 'a reload plays the introduction again');
    h.films[0].finish(); assert.equal(h.G.state, 'wake');
    // the win: the completion film and the house's flag, once
    h.G.resolve();
    assert.deepEqual(h.finales, [id]);
    assert.equal(game.flag(`temple.${id}.done`), true); assert.equal(h.rt.logic.resolved, true);
    h.G.resolve(); assert.deepEqual(h.finales, [id], 'paid once');
    // finished: a later visit plays nothing and wakes nothing
    h.dispose(); h = house(id);
    assert.equal(h.G.state, 'resolved'); h.step();
    assert.equal(h.films.length, 0); assert.equal(h.G.state, 'resolved');
  } finally { h.dispose(); game.reset(); }
});

test('without a stage (a bench, the film unavailable) the trial wakes as it always did', () => {
  game.reset();
  const id = 'garage', h = house(id);
  try {
    h.moments.play = () => null;
    h.step();
    assert.equal(h.G.state, 'wake');
  } finally { h.dispose(); game.reset(); }
});

for (const id of TRIALS) test(`${id}: the introduction's second panel frames the house's own subject`, () => {
  game.reset();
  const h = house(id);
  try {
    const s = endingSubject(h.rt);
    assert.ok(s?.pos, 'a subject from its completion film');
    const shots = endingOpeningShots(h.rt, h.player, { entrance: true });
    assert.ok(shots, 'both panels found a clear lens');
    for (const sh of shots) {
      const f = sh.from;
      assert.ok(h.rt.inside(f.pos), 'the lens is inside the house');
      assert.ok(f.fov >= 52 && f.fov <= 68);
    }
    const look = shots[1].from.look;
    assert.ok(endingSubjects(h.rt).some((x) => look.distanceTo(x.pos) < 0.5), 'the second panel looks at one of the house’s subjects');
  } finally { h.dispose(); game.reset(); }
});

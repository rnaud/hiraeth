import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GameState, game } from '../src/game-state.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Ship } from '../src/ship/ship.js';
import { mapEntries, consoleAction } from '../src/ship/starmap.js';
import { HomecomingDirector } from '../src/ship/homecoming.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { HOME_SPOTS } from '../src/levels/home.js';
import {
  ENDING_WORLDS, HOME_ID, NOTHING, endingUnlocked, homeEntry, choiceList, chooseKeepsake, chosenKeepsake,
  reactionLines, FATHER_HOME, MOTHER_HOME, credits, creditsHtml, peopleOf,
} from '../src/story/ending.js';
import { callLines, callContext, pendingCall, applyCall, completedWorlds, ILEN_CALL } from '../src/story/calls.js';
import { birdAnswers, OPEN_SKY } from '../src/bird.js';
import { KEEPSAKE as BAZAAR_WORD } from '../src/story/bazaar-data.js';
import { KEEPSAKE as GEAR_TOOTH } from '../src/story/buried-data.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const memory = () => { const store = new Map(); return { store, game: new GameState({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }) }; };
const titles = Object.fromEntries(LEVELS.map((l) => [l.id, l.title]));

/** Hear every waiting call, as the console would. */
function hearAll(game, done) {
  const heard = [];
  let n;
  while ((n = pendingCall({ flag: (k) => game.flag(k), completed: done.length }))) {
    const lines = callLines(n, callContext(game, { titles, completed: done }));
    applyCall(game, lines);
    game.set(`calls.${n}`, true);
    heard.push({ n, lines });
  }
  return heard;
}

test('the ending opens once ENDING_WORLDS worlds are done, and that call asks you home', () => {
  assert.equal(ENDING_WORLDS, 6);
  assert.equal(endingUnlocked(ENDING_WORLDS - 1), false);
  assert.equal(endingUnlocked(ENDING_WORLDS), true);
  assert.equal(endingUnlocked(ORDER.slice(0, ENDING_WORLDS)), true);
  const { game } = memory();
  const done = [];
  for (const id of ORDER.slice(0, ENDING_WORLDS)) {
    game.set(`world.${id}.done`, true);
    done.push(id);
    const heard = hearAll(game, completedWorlds(ORDER, { flag: (k) => game.flag(k) }));
    const last = heard.at(-1);
    const home = last.lines.some((l) => /Come home\./.test(l.text));
    assert.equal(home, done.length === ENDING_WORLDS, `call ${last.n}: ${home ? 'asks you home' : 'does not ask yet'}`);
  }
  assert.equal(game.flag('calls.home'), true);
});

test('Home appears on the galactic map once the ending is open, at the centre of the route', () => {
  const base = { order: ORDER, levels: LEVELS, flag: () => undefined, journal: null, current: 'desert' };
  assert.ok(!mapEntries({ ...base, home: false }).some((e) => e.id === HOME_ID), 'not before');
  const list = mapEntries({ ...base, home: () => true });
  const home = list.find((e) => e.id === HOME_ID);
  assert.ok(home && home.home && home.title === 'Home', 'Home is a destination');
  assert.equal(list.length, ORDER.length + 1);
  assert.ok(!home.current);
  assert.ok(homeEntry({ unlocked: false, current: HOME_ID })?.current, 'standing at home, it is on the map anyway');
  // the level exists, hidden like the Atelier, with its people
  const L = LEVELS.find((l) => l.id === HOME_ID);
  assert.ok(L && L.hidden && L.title === 'Home');
  assert.equal(LEVELS.find((l) => l.id === 'atelier')?.hidden, true, 'the Atelier stays as it is');
  assert.deepEqual(CONTENT.home.npcs.map((n) => n.id), ['father', 'mother']);
  // the ship's map asks the ship whether home is open
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: new THREE.Vector3(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'desert', content: { npcs: [], relics: { spots: [] } } }));
  const done = new Set(ORDER.slice(0, 5));
  ship.attach({ order: ORDER, levels: LEVELS, journal: { storyDone: (id) => done.has(id), seen: () => false }, titles });
  assert.ok(!mapEntries({ ...ship.map.o }).some((e) => e.home), 'five worlds: no home yet');
  done.add(ORDER[5]);
  assert.ok(mapEntries({ ...ship.map.o }).some((e) => e.home), 'six worlds: home');
});

test('the keepsake chosen in the cockpit is stored in game (ending.keepsake)', () => {
  const { store, game } = memory();
  const ks = [GEAR_TOOTH, BAZAAR_WORD, { id: 'arzach.person', level: 'arzach', name: 'The bird’s promise', kind: 'person', text: '…' }];
  for (const k of ks) game.addKeepsake(k);
  const list = choiceList(game.keepsakes());
  assert.deepEqual(list.map((k) => k.id), [...ks.map((k) => k.id), NOTHING.id], 'every keepsake, then nothing');
  assert.ok(list.every((k) => k.name && k.kind && k.text), 'with their texts and kinds');
  chooseKeepsake(game, list[1]);
  assert.equal(game.flag('ending.keepsake'), BAZAAR_WORD.id);
  assert.equal(game.flag('ending.kind'), 'word');
  const again = new GameState({ getItem: (k) => store.get(k) ?? null, setItem: () => {} });
  assert.equal(chosenKeepsake(again)?.name, BAZAAR_WORD.name, 'remembered');
  chooseKeepsake(game, NOTHING);
  assert.equal(chosenKeepsake(game), NOTHING);
});

test('each kind gives a different father; the mother is always the same', () => {
  const sample = {
    thing: GEAR_TOOTH,
    song: { id: 's', name: 'The bell’s note', kind: 'song', text: 'One low note.' },
    word: { id: 'w', name: 'Look up once a day', kind: 'word', text: '“Look up once a day.” Nima.' },
    person: { id: 'p', name: 'Hollin’s lamps', kind: 'person', text: 'Come back one day.' },
    knowing: { id: 'k', name: 'What the giants left', kind: 'knowing', text: 'The giants carried the water.' },
    nothing: NOTHING,
  };
  assert.deepEqual(Object.keys(FATHER_HOME).sort(), Object.keys(sample).sort());
  const fathers = new Set(), mothers = new Set();
  for (const k of Object.values(sample)) {
    const lines = reactionLines(k);
    const f = lines.filter((l) => l.who === 'father').map((l) => l.text).join(' | ');
    fathers.add(f);
    mothers.add(lines.filter((l) => l.who === 'mother').map((l) => l.text).join(' | '));
    assert.ok(lines.at(-1).who === 'scene' && /Something of value/.test(lines.at(-1).text), 'a closing line');
  }
  assert.equal(fathers.size, Object.keys(sample).length, 'a different father for every kind');
  assert.equal(mothers.size, 1, 'one mother');
  assert.deepEqual(reactionLines(GEAR_TOOTH).filter((l) => l.who === 'mother'), MOTHER_HOME);
  assert.ok(MOTHER_HOME.every((l) => !/tooth|gift|brought/i.test(l.text)), 'about you, not the gift');
  assert.ok(reactionLines(sample.thing).some((l) => l.text.includes('rust gear tooth')), 'the thing is named');
  assert.ok(reactionLines(sample.word).some((l) => l.text.includes('Look up once a day')), 'the words are said');
  assert.ok(reactionLines(BAZAAR_WORD).some((l) => l.who === 'father' && /Those were mine/.test(l.text)), 'he knows his own words');
  assert.ok(reactionLines(NOTHING, { ilen: true }).some((l) => /Ilen/.test(l.text)));
});

test('the credits roll the worlds in order and the people from the story data', () => {
  const flags = { 'met.sel': true, 'met.teo': true, 'world.desert.done': true, 'bird.promise': true, 'calls.ilen.told': true };
  const storyTitles = Object.fromEntries(ORDER.map((id) => [id, CONTENT[id].story.title]));
  const c = credits({ order: ORDER, titles, storyTitles, flag: (k) => flags[k], keepsake: GEAR_TOOTH });
  assert.deepEqual(c.worlds.map((w) => w.id), ORDER);
  const names = c.worlds.flatMap((w) => w.people.map((p) => p.name));
  for (const n of ['Madame Sel', 'Teo', 'Ama', 'Nima', 'Oïa', 'Mother Ysolde', 'Ottla', 'Wen', 'Mira', 'Ume', 'Wendel', 'Hollin', 'Kip']) assert.ok(names.includes(n), `${n} is in the credits`);
  assert.ok(!names.some((n) => /^The (broadcast|root stone|Upward Shrine)/.test(n)), 'people only');
  const desert = c.worlds.find((w) => w.id === 'desert');
  assert.ok(desert.done && desert.people.find((p) => p.name === 'Teo').met && !desert.people.find((p) => p.name === 'Ama').met);
  assert.ok(c.home.some((h) => /bird/.test(h)) && c.home.some((h) => /Ilen/.test(h)));
  const html = creditsHtml(c);
  assert.ok(html.includes('Madame Sel') && html.includes('The Desert') && html.includes('A rust gear tooth'));
  assert.equal(peopleOf('nowhere').length, 0);
});

test('Ilen: the father deflects, the mother tells the truth in a later call of her own', () => {
  const { game } = memory();
  const done = ['desert', 'incal', 'arzach'];
  for (const id of done) game.set(`world.${id}.done`, true);
  game.set('desert.rumour.light', true);
  hearAll(game, done);
  game.set('ship.level', 'bazaar');
  game.addKeepsake(BAZAAR_WORD);
  game.set('clue.bazaar.home', true);
  game.set('world.bazaar.done', true);
  done.push('bazaar');
  const [call] = hearAll(game, done);
  assert.equal(call.n, 4);
  assert.ok(call.lines.some((l) => /Ilen/.test(l.text)), 'the call is about Ilen');
  assert.ok(call.lines.some((l) => l.who === 'father' && /relays/.test(l.text)), 'he deflects');
  assert.ok(!call.lines.some((l) => /sister/.test(l.text)), 'not the truth yet');
  assert.equal(pendingCall({ flag: (k) => game.flag(k), completed: done.length }), null, 'not while still at the market');
  game.set('ship.level', 'buried');
  assert.equal(pendingCall({ flag: (k) => game.flag(k), completed: done.length }), ILEN_CALL, 'after flying on, the mother calls');
  const [hers] = hearAll(game, done);
  assert.ok(hers.lines.every((l) => l.who === 'mother'), 'on her own');
  assert.ok(hers.lines.some((l) => /Ilen was your sister/.test(l.text)));
  assert.ok(hers.lines.some((l) => /singing/i.test(l.text)), 'the singing light: they heard it too');
  assert.equal(game.flag('calls.ilen.told'), true);
  game.set('world.buried.done', true);
  done.push('buried');
  const [next] = hearAll(game, done);
  assert.ok(next.lines.some((l) => l.who === 'father' && /Your mother told you/.test(l.text)), 'and then he says it himself');
});

test('the calls react to what happened: the bell, the bird, the glyph, the people met', () => {
  const flags = { 'arzach2.bell.note': true, 'met.ysolde': true, 'met.tiv': true };
  const lines = callLines(3, { keepsake: { id: 'arzach2.song', level: 'arzach2', name: 'The bell’s note', kind: 'song' }, flag: (k) => flags[k], completed: ['desert', 'arzach', 'arzach2'] });
  assert.ok(lines.some((l) => /bell/i.test(l.text) && /harbour/.test(l.text)), 'they hear the bell');
  assert.ok(lines.some((l) => l.who === 'mother' && /Mother Ysolde and Tiv/.test(l.text)), 'she asks after the people, by name');
  const bird = callLines(2, { keepsake: { id: 'arzach.person', name: 'The bird’s promise', kind: 'person' }, flag: (k) => k === 'bird.promise' });
  assert.ok(bird.some((l) => /bird/.test(l.text) && /promise/.test(l.text)));
  const glyph = callLines(2, { keepsake: GEAR_TOOTH, flag: (k) => k === 'clue.buried.mark' });
  assert.ok(glyph.some((l) => /Three dots over an arc/.test(l.text)));
  // each is said once
  const heard = { 'clue.buried.mark': true, 'calls.beat.glyph': true };
  assert.ok(!callLines(2, { keepsake: GEAR_TOOTH, flag: (k) => heard[k] }).some((l) => /Three dots/.test(l.text)));
});

test('the bird answers the whistle only under open sky, in worlds without a mount, once she has promised', () => {
  const flag = (k) => k === 'bird.promise';
  assert.ok(OPEN_SKY.has('edena') && OPEN_SKY.has('spheres') && OPEN_SKY.has('home'));
  assert.equal(birdAnswers('edena', { features: {} }, flag), true);
  assert.equal(birdAnswers('edena', { features: {} }, () => false), false, 'not before the promise');
  assert.equal(birdAnswers('desert', { features: {}, mount: () => null }, flag), false, 'the desert has its hoverbike');
  assert.equal(birdAnswers('incal', { features: {} }, flag), false, 'no open sky down the shaft');
});

test('the homecoming plays: in orbit, the choice, the landing, the door, the credits, then free play', () => {
  const meta = LEVELS.find((l) => l.id === HOME_ID);
  const scene = new THREE.Scene();
  const level = quiet(() => meta.create(scene));
  const physics = new Physics(scene, level.ground);
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: HOME_ID, content: CONTENT.home, prologue: true }));
  assert.ok(ship.spaceCopy, 'the ship in orbit');
  assert.ok(Math.hypot(ship.site.x - HOME_SPOTS.ship.x, ship.site.z - HOME_SPOTS.ship.z) < 0.01, 'it lands on the ring');
  assert.ok(ship.rampFoot.z < HOME_SPOTS.meet.z && ship.rampFoot.z > HOME_SPOTS.ship.z, 'the ramp comes down towards the house');
  const player = new Player(physics, { spawn: level.spawn });
  const rig = { yaw: 0, pitch: 0, target: new THREE.Vector3(), dist: 6 };
  const camera = new THREE.PerspectiveCamera();
  ship.attach({ player, rig, camera, sound: {}, levels: LEVELS, order: ORDER, titles, npcs: [] });
  const dir = new HomecomingDirector(ship);
  ship.cinematic = dir;
  dir.start();
  assert.equal(dir.stage, 'approach');
  const step = (secs, skip = false) => { for (let t = 0; t < secs && !dir.done; t += 1 / 30) { dir.update(1 / 30, skip); player.update(1 / 30, ship.input({}), rig.yaw); } };
  step(8);
  assert.equal(dir.stage, 'choose', 'waits for the choice');
  step(3, true);
  assert.equal(dir.stage, 'choose', 'the choice cannot be skipped');
  const pick = dir.items.find((k) => k.id === NOTHING.id);
  dir.choose(pick);
  step(4);
  assert.ok(['dive', 'descend'].includes(dir.stage), dir.stage);
  step(30);
  assert.ok(['walk', 'reaction', 'credits'].includes(dir.stage), `down and out: ${dir.stage}`);
  step(1.2, true); step(0.2); step(1.2, true); step(0.2); step(1.2, true);
  assert.ok(dir.done, 'skipped to the end');
  assert.equal(game.flag('ending.done'), true);
  assert.equal(game.flag('ending.keepsake'), NOTHING.id);
  assert.ok(!ship.spaceCopy && ship.parked.group.visible, 'parked on the ring, ready to fly');
});

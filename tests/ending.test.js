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
import { HOME_SPOTS, tombSlots, SLAB, tokenModel } from '../src/levels/home.js';
import {
  ENDING_WORLDS, HOME_ID, NOTHING, ALL, endingUnlocked, homeOpen, homeEntry, tokenList, tokenLine, leaveTokens, chosenKeepsake,
  tombLines, FINAL_RECORDING, TOKEN_ITEMS, credits, creditsHtml, peopleOf,
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
  assert.deepEqual(CONTENT.home.npcs, [], 'the family comes with the story (src/story/home.js)');
  assert.match(homeEntry({ unlocked: true }).blurb, /Nobody lives in the round house now/);
  assert.match(homeEntry({ unlocked: true }).blurb, /lamp lit/, 'and across the yard, the small house');
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
  game.set('calls.home', false);
  assert.ok(!mapEntries({ ...ship.map.o }).some((e) => e.home), 'six worlds, the last recording not heard yet: not yet');
  game.set('calls.home', true);
  assert.ok(mapEntries({ ...ship.map.o }).some((e) => e.home), 'six worlds and “Come home”: home');
  game.set('calls.home', false);
});

test('one rule for home: six worlds and the last recording, the same on the map, the charge and the reel', () => {
  const at = (o) => (k) => o[k];
  assert.equal(homeOpen({ flag: at({}), completed: ENDING_WORLDS }), false, 'six worlds alone: the recording comes first');
  assert.equal(homeOpen({ flag: at({ 'calls.home': true }), completed: ENDING_WORLDS - 1 }), false, 'not before six worlds');
  assert.equal(homeOpen({ flag: at({ 'calls.home': true }), completed: ORDER.slice(0, ENDING_WORLDS) }), true);
  assert.equal(homeOpen({ flag: at({ [`calls.${ENDING_WORLDS}`]: true }), completed: ENDING_WORLDS }), true, 'an older save that heard it');
  assert.equal(homeOpen({ flag: at({ 'ending.done': true }), completed: 0 }), true, 'after the ending, always');
  // the voicemail plays the waiting message (the last recording); once heard, home is there
  const { game: g } = memory();
  const done = ORDER.slice(0, ENDING_WORLDS);
  for (const id of done) g.set(`world.${id}.done`, true);
  const flag = (k) => g.flag(k);
  assert.equal(pendingCall({ flag, completed: done.length }), 1);
  assert.equal(consoleAction({ at: 'dash', powered: true, pendingCall: pendingCall({ flag, completed: done.length }) }), 'call');
  hearAll(g, done);
  assert.equal(homeOpen({ flag, completed: done }), true, 'heard: home is open');
  // past six, the rest of the route plays the reel's oldest side, and says home is waiting
  const more = ORDER.slice(0, ENDING_WORLDS + 1);
  g.set(`world.${more.at(-1)}.done`, true);
  const later = hearAll(g, more).at(-1);
  assert.equal(later.n, ENDING_WORLDS + 1);
  assert.ok(later.lines.some((l) => /oldest side/.test(l.text)) && later.lines.some((l) => /Home is on the map/.test(l.text)));
  // the worlds list says the same as the ship's map
  const L = LEVELS.find((l) => l.id === HOME_ID);
  assert.equal(L.blurb, homeEntry({ unlocked: true }).blurb);
  assert.match(L.lock.text, /six worlds/);
  assert.match(L.lock.text, /message on the ship’s voicemail/);
});

test('everything goes on the stone: the keepsakes, then the makers’ small gifts (not the backpack, jets or wings)', () => {
  const { store, game } = memory();
  const ks = [GEAR_TOOTH, BAZAAR_WORD, { id: 'arzach.person', level: 'arzach', name: 'The bird’s promise', kind: 'person', text: '…' }];
  for (const k of ks) game.addKeepsake(k);
  const list = tokenList([...game.keepsakes(), GEAR_TOOTH], ['backpack', 'jetpack', 'glider', 'star', 'lens', 'fire']);
  assert.deepEqual(list.map((t) => t.id), [...ks.map((k) => k.id), 'item.fire', 'item.lens', 'item.star'], 'every keepsake once, in order, then the gifts');
  assert.ok(list.every((t) => t.name && t.kind), 'with names and kinds');
  assert.ok(!TOKEN_ITEMS.some((id) => ['backpack', 'jetpack', 'glider'].includes(id)), 'he wears those');
  // the later charms go down too, each with its own line (the listening shell, the echo shell)
  const shells = tokenList([], ['shell', 'echo']);
  assert.deepEqual(shells.map((t) => t.id), ['item.shell', 'item.echo']);
  const said = shells.map((t) => tokenLine(t).text);
  assert.match(said[0], /listening shell/i); assert.match(said[1], /echo shell/i);
  assert.equal(new Set(TOKEN_ITEMS.map((id) => tokenLine({ kind: 'item', item: id, name: id }).text)).size, TOKEN_ITEMS.length, 'every gift its own line');
  assert.equal(leaveTokens(game, list), ALL);
  assert.equal(game.flag('ending.keepsake'), 'all');
  assert.equal(game.flag('ending.tokens'), list.length);
  const again = new GameState({ getItem: (k) => store.get(k) ?? null, setItem: () => {} });
  assert.equal(chosenKeepsake(again), ALL, 'remembered');
  // a save that ended before the stone, with one keepsake chosen, keeps it
  game.set('ending.keepsake', GEAR_TOOTH.id);
  assert.equal(chosenKeepsake(game)?.name, GEAR_TOOTH.name);
  game.set('ending.keepsake', NOTHING.id);
  assert.equal(chosenKeepsake(game), NOTHING);
});

test('at the stone: a line for every token as it is set down, the reel last, its oldest recording, the closing line', () => {
  const list = tokenList([GEAR_TOOTH, { id: 'incal.word', level: 'incal', name: 'Look up once a day', kind: 'word', text: '“Look up once a day.” Nima.' },
    { id: 's', name: 'Teo’s walking rhythm', kind: 'song' }, { id: 'p', name: 'Hollin’s lamps', kind: 'person' }, { id: 'k', name: 'What the giants left', kind: 'knowing' }], ['star', 'bell']);
  const lines = tombLines(list, { ilenTold: true });
  const set = lines.filter((l) => l.token);
  assert.deepEqual(set.map((l) => l.token.id), list.map((t) => t.id), 'one line per token, in order');
  assert.ok(set.every((l) => l.who === 'scene' && /^\(/.test(l.text)), 'quiet stage lines');
  assert.ok(set.some((l) => l.text.includes('rust gear tooth')), 'the thing is named');
  assert.ok(set.some((l) => l.text.includes('Look up once a day')), 'the words are said');
  assert.equal(new Set(set.map((l) => l.text.replace(/^\([^.]*\./, ''))).size, set.length, 'each kind says something of its own');
  const reel = lines.findIndex((l) => l.reel);
  assert.ok(reel > lines.indexOf(set.at(-1)), 'the reel goes down last');
  assert.deepEqual(lines.slice(reel + 1, reel + 1 + FINAL_RECORDING.length), FINAL_RECORDING, 'then it plays the oldest recording');
  assert.ok(FINAL_RECORDING.some((l) => l.who === 'mother' && /proud of you already/.test(l.text)));
  assert.ok(FINAL_RECORDING.some((l) => l.who === 'father' && /don’t have to bring us anything/i.test(l.text)));
  assert.ok(lines.at(-1).who === 'scene' && /Something of value/.test(lines.at(-1).text), 'a closing line');
  assert.ok(lines.some((l) => /Ilen/.test(l.text)), 'and a place for Ilen');
  assert.ok(!tombLines(list).some((l) => /Ilen/.test(l.text)), 'only once she is known');
  const empty = tombLines([]);
  assert.ok(!empty.some((l) => l.token) && empty.some((l) => /empty/.test(l.text)), 'empty hands');
  assert.ok(list.every((t) => tokenLine(t).text.length > 4));
});

test('at the stone, Esk’s hill: one line if the tea terraces came down, in your voice, before what you have', () => {
  const list = tokenList([GEAR_TOOTH], ['star']);
  const esk = (l) => /Esk’s hill/.test(l.text);
  assert.ok(!tombLines(list).some(esk), 'not if the terraces stand');
  assert.ok(!tombLines(list, { ilenTold: true, lou: true }).some(esk));
  for (const tokens of [list, []]) {
    const lines = tombLines(tokens, { broke: true, ilenTold: true });
    const i = lines.findIndex(esk);
    assert.ok(i > 0 && lines.filter(esk).length === 1, 'once');
    assert.equal(lines[i].who, 'you');
    assert.equal(lines[i].tone, 'sad');
    assert.ok(/could not mend/.test(lines[i].text));
    assert.ok(i > lines.findIndex((l) => /Ilen/.test(l.text)), 'after the space for Ilen');
    assert.ok(i < lines.findIndex((l) => /what I have/.test(l.text)), 'before “It’s what I have”');
    assert.ok(i < lines.findIndex((l) => l.reel), 'before the reel');
    if (tokens.length) assert.ok(i > lines.findIndex((l) => l.token?.id === 'item.star'), 'after the tokens');
  }
});

test('the late recordings know Lou, never by name: “She has your hands”, and her drawings in the last one', () => {
  const ctx = { flag: () => undefined, keepsake: null, keepsakes: [], completed: ORDER.slice(0, 5), lastWorld: ORDER[4] };
  const lou = (l) => /little one/.test(l.text);
  for (let n = 1; n <= 4; n++) assert.ok(!callLines(n, ctx).some(lou), `not on recording ${n}: before she came to the hill`);
  const five = callLines(5, ctx), hands = five.find(lou);
  assert.ok(hands && hands.who === 'mother' && /She has your hands/.test(hands.text) && hands.tone, 'the mother, four years ago');
  assert.ok(five.findIndex(lou) > five.findIndex((l) => /old drawings/.test(l.text)), 'after his old drawings');
  const last = callLines(ENDING_WORLDS, { ...ctx, completed: ORDER.slice(0, ENDING_WORLDS) }), drawn = last.find(lou);
  assert.ok(drawn && drawn.who === 'father' && /drawings/.test(drawn.text) && drawn.tone, 'the father, in the last recording');
  assert.ok(last.indexOf(drawn) < last.findIndex((l) => /^Come home\.$/.test(l.text)), 'just before “Come home.”');
  assert.ok(![...five, ...last].some((l) => /\bLou\b/.test(l.text)), 'never named on the reel');
});

test('the stone: room on the slab for every token, none on top of another', () => {
  for (const n of [1, 2, 5, 9, 14, 20, 26]) {
    const P = tombSlots(n);
    assert.equal(P.length, n);
    for (const p of P) assert.ok(Math.abs(p.x) <= SLAB.x && p.z >= SLAB.z0 - 1e-6 && p.z <= SLAB.z1 + 1e-6 && p.y > SLAB.top, `${n}: on the slab (${p.toArray()})`);
    let min = Infinity;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) min = Math.min(min, Math.hypot(P[i].x - P[j].x, P[i].z - P[j].z));
    assert.ok(min > 0.14, `${n} tokens: ${min.toFixed(2)} m apart`);
  }
  // every token has a model, small enough for the slab
  for (const t of tokenList([GEAR_TOOTH, BAZAAR_WORD, { id: 'x', kind: 'song', name: 's' }, { id: 'y', kind: 'person', name: 'p' }, { id: 'z', kind: 'knowing', name: 'k' }], TOKEN_ITEMS)) {
    const m = tokenModel(t);
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
    assert.ok(size.x < 0.45 && size.y < 0.45 && size.z < 0.45, `${t.id}: ${size.toArray().map((v) => v.toFixed(2))}`);
  }
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
  assert.ok(c.home.some((h) => /bird/.test(h)) && c.home.some((h) => /Ilen/.test(h)) && c.home.some((h) => /your father, on the hill/.test(h)));
  assert.ok(creditsHtml(c).includes('A rust gear tooth'), 'an older save: what it brought home');
  const html = creditsHtml(credits({ order: ORDER, titles, storyTitles, flag: (k) => flags[k], keepsake: ALL, tokens: tokenList([GEAR_TOOTH], ['star']) }));
  assert.ok(html.includes('Madame Sel') && html.includes('The Desert') && html.includes('Left on the stone') && html.includes('A rust gear tooth') && html.includes('Pale star'));
  assert.equal(peopleOf('nowhere').length, 0);
});

test('Ilen: he asks the reel for her, is not ready, and hears his mother’s recording somewhere else', () => {
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
  assert.ok(call.lines.some((l) => l.who === 'you' && /Ilen/.test(l.text)), 'he asks the reel for the name');
  assert.ok(call.lines.some((l) => l.who === 'ship' && /For when he asks/.test(l.text)), 'one recording, in her voice');
  assert.ok(call.lines.some((l) => l.who === 'you' && /Not here\. Not yet\./.test(l.text)), 'not here');
  assert.ok(!call.lines.some((l) => /sister/.test(l.text)), 'not the truth yet');
  assert.equal(pendingCall({ flag: (k) => game.flag(k), completed: done.length }), null, 'not while still at the market');
  game.set('ship.level', 'buried');
  assert.equal(pendingCall({ flag: (k) => game.flag(k), completed: done.length }), ILEN_CALL, 'after flying on, it waits');
  const [hers] = hearAll(game, done);
  assert.ok(hers.lines.filter((l) => l.who === 'father' || l.who === 'mother').every((l) => l.who === 'mother'), 'hers alone');
  assert.ok(hers.lines.some((l) => /Ilen was your sister/.test(l.text)));
  assert.ok(hers.lines.some((l) => /singing/i.test(l.text)), 'the singing light: they heard it too');
  assert.equal(game.flag('calls.ilen.told'), true);
  game.set('world.buried.done', true);
  done.push('buried');
  const [next] = hearAll(game, done);
  assert.ok(next.lines.some((l) => l.who === 'father' && /the same words to you at the port/.test(l.text)), 'and then his own words about it');
});

test('the recordings fit what happened, loosely: the bell, the bird, the glyph; he names the people he met', () => {
  const flags = { 'arzach2.bell.note': true, 'met.ysolde': true, 'met.tiv': true };
  const lines = callLines(3, { keepsake: { id: 'arzach2.song', level: 'arzach2', name: 'The bell’s note', kind: 'song' }, flag: (k) => flags[k], completed: ['desert', 'arzach', 'arzach2'] });
  assert.ok(lines.some((l) => /bell/i.test(l.text) && /harbour/.test(l.text)), 'the harbour bell behind them');
  assert.ok(lines.some((l) => l.who === 'mother' && /Who did you meet/.test(l.text)), 'she asks who he met');
  assert.ok(lines.some((l) => l.who === 'you' && /Mother Ysolde and Tiv/.test(l.text)), 'he answers with their names');
  assert.ok(lines.some((l) => l.who === 'you' && /bell/.test(l.text) && /^\(/.test(l.text)), 'he finds the bell in it');
  const bird = callLines(2, { keepsake: { id: 'arzach.person', name: 'The bird’s promise', kind: 'person' }, flag: (k) => k === 'bird.promise' });
  assert.ok(bird.some((l) => /bird/.test(l.text) && /promise/.test(l.text)));
  const glyph = callLines(2, { keepsake: GEAR_TOOTH, flag: (k) => k === 'clue.buried.mark' });
  assert.ok(glyph.some((l) => /three dots/.test(l.text) && /landing ring/.test(l.text)));
  // each is said once
  const heard = { 'clue.buried.mark': true, 'calls.beat.glyph': true };
  assert.ok(!callLines(2, { keepsake: GEAR_TOOTH, flag: (k) => heard[k] }).some((l) => /three dots/.test(l.text)));
});

test('the bird answers the whistle only under open sky, in worlds without a mount, once she has promised', () => {
  const flag = (k) => k === 'bird.promise';
  assert.ok(OPEN_SKY.has('edena') && OPEN_SKY.has('spheres') && OPEN_SKY.has('home'));
  assert.equal(birdAnswers('edena', { features: {} }, flag), true);
  assert.equal(birdAnswers('edena', { features: {} }, () => false), false, 'not before the promise');
  assert.equal(birdAnswers('desert', { features: {}, mount: () => null }, flag), false, 'the desert has its hoverbike');
  assert.equal(birdAnswers('incal', { features: {} }, flag), false, 'no open sky down the shaft');
});

test('the homecoming plays: in orbit, the cargo, the landing, the stone and its tokens, the end card, the credits, then free play', () => {
  const meta = LEVELS.find((l) => l.id === HOME_ID);
  const scene = new THREE.Scene();
  const level = quiet(() => meta.create(scene));
  assert.ok(level.tomb && level.tomb.group.parent === scene, 'the stone is in the yard');
  const physics = new Physics(scene, level.ground);
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: HOME_ID, content: CONTENT.home, prologue: true }));
  assert.ok(ship.spaceCopy, 'the ship in orbit');
  assert.ok(Math.hypot(ship.site.x - HOME_SPOTS.ship.x, ship.site.z - HOME_SPOTS.ship.z) < 0.01, 'it lands on the ring');
  assert.ok(ship.rampFoot.z < HOME_SPOTS.meet.z && ship.rampFoot.z > HOME_SPOTS.ship.z, 'the ramp comes down towards the house');
  const player = new Player(physics, { spawn: level.spawn });
  const rig = { yaw: 0, pitch: 0, target: new THREE.Vector3(), dist: 6 };
  const camera = new THREE.PerspectiveCamera();
  ship.attach({ player, rig, camera, sound: {}, levels: LEVELS, order: ORDER, titles, npcs: [] });
  game.addKeepsake(GEAR_TOOTH);
  game.addKeepsake(BAZAAR_WORD);
  const dir = new HomecomingDirector(ship);
  ship.cinematic = dir;
  dir.start();
  assert.equal(dir.stage, 'approach');
  assert.ok(dir.items.some((t) => t.id === GEAR_TOOTH.id) && dir.items.some((t) => t.id === BAZAAR_WORD.id), 'everything in the hold');
  const step = (secs, skip = false) => { for (let t = 0; t < secs && !dir.done; t += 1 / 30) { dir.update(1 / 30, skip); player.update(1 / 30, ship.input({}), rig.yaw); } };
  step(8);
  assert.equal(dir.stage, 'cargo', 'waits at the cargo check');
  dir.choose();
  assert.equal(game.flag('ending.keepsake'), 'all');
  step(4);
  assert.ok(['dive', 'descend'].includes(dir.stage), dir.stage);
  step(40);
  assert.ok(['walk', 'tomb'].includes(dir.stage), `down and out to the stone: ${dir.stage}`);
  while (dir.stage === 'walk' && !dir.done) step(1);
  assert.equal(dir.stage, 'tomb');
  assert.ok(player.pos.distanceTo(dir.standAt()) < 1.5, 'standing at the stone');
  const toStone = Math.atan2(HOME_SPOTS.tomb.x - player.pos.x, HOME_SPOTS.tomb.z - player.pos.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(player.heading - toStone), Math.cos(player.heading - toStone))) < 0.3, 'facing it');
  step(14);
  assert.ok(level.tomb.tokens.children.length >= 1, 'the tokens go down one by one');
  step(1.2, true);
  assert.equal(level.tomb.tokens.children.length, dir.items.length + 1, 'skipping on: all of them are on the stone, and the reel');
  step(0.2); step(1.2, true); step(0.2); step(1.2, true);
  assert.ok(dir.done, 'skipped to the end');
  assert.equal(game.flag('ending.done'), true);
  assert.ok(!ship.spaceCopy && ship.parked.group.visible, 'parked on the ring, ready to fly');
  // coming back later: the stone keeps them
  const again = quiet(() => meta.create(new THREE.Scene()));
  assert.ok(again.tomb.tokens.children.length >= 2, 'the stone keeps its tokens');
});

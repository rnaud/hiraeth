import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// The fellow traveller (src/story/fellow.js, src/story/fellow-data.js; docs/systems/story.md, "A fellow
// traveller"): Tansy, met four times along the route, each meeting changed by the last; where she stands in her
// stops, the order of the meetings and the flags they carry, the save's migration, the People page, Hesper.


await import('./register-gadgets.js');
const { TANSY, STOPS, MEETINGS, ITEMS, GREETING_LINES, HESPER_AFTER, HOME, HOME_TALK } = await import('../src/story/fellow-data.js');
const { fellowHere, fellowPerson, fellowSpot, setupFellow, homeSpot } = await import('../src/story/fellow.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { Quests } = await import('../src/story/quests.js');
const { GameState } = await import('../src/game-state.js');
const { migrateFlags } = await import('../src/save-migrate.js');
const { parseLine } = await import('../src/story/tone.js');
const { balloonReason } = await import('../src/story/balloons.js');
const { PERSON, personStory, personNow, interactions } = await import('../src/story/people-book.js');
const { ORDER } = await import('../src/levels/names.js');
const { LEVELS } = await import('../src/levels/index.js');
const { Physics } = await import('../src/physics.js');
const { CONTENT } = await import('../src/levels/content.js');
const { Ship } = await import('../src/ship/ship.js');
const { clearInteractables, allInteractables } = await import('../src/interact.js');
const { clearTargets } = await import('../src/targets.js');

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
const page = { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const quiet = (f) => { const w = console.warn, i = console.info, l = console.log; console.warn = console.info = console.log = () => {}; try { return f(); } finally { console.warn = w; console.info = i; console.log = l; } };

/** A fresh save and its quests (the dialogue's ctx). */
function fresh(flags = {}) {
  const game = new GameState(memory());
  Object.assign(game.data.flags, flags);
  const quests = new Quests({ game });
  quests.itemNames = { ...ITEMS };
  return { game, quests };
}
/** Talk to her in `world` and give these answers (by their first words); → the runner and every page said. */
function talk(world, ctx, answers = []) {
  const person = fellowPerson(world, fellowHere(ctx.game.data.flags, world));
  const r = new DialogueRunner(person, ctx), said = [];
  const read = () => { said.push(r.text); while (!r.lastPage) { r.advance(); said.push(r.text); } };
  // (on through the nodes that go `next` with no answers, to the next answers)
  const on = () => { while (!r.ended && !r.choices().some((c) => !c.end) && r.advance()) read(); };
  read();
  for (const a of answers) {
    on();
    const pick = r.choices().find((c) => c.text.startsWith(a));
    assert.ok(pick, `${world}: no answer "${a}" in ${JSON.stringify(r.choices().map((c) => c.text))} at ${r.nodeId}`);
    r.choose(pick.index);
    if (r.ended) break;
    read();
  }
  while (!r.ended && r.advance()) read();
  return { r, said: said.join(' ') };
}

test('the data: her stops in the route\'s order, every node reached and every line toned, a scene for each stop', () => {
  assert.equal(MEETINGS, 4);
  assert.equal(STOPS.length, MEETINGS);
  const at = STOPS.map((w) => ORDER.indexOf(w));
  assert.ok(at.every((i) => i > 0), 'route worlds, after the desert');
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in the route\'s order');
  assert.ok(at.some((i) => i < 6) && at[at.length - 1] === ORDER.length - 1, 'the first before the first homecoming, the last at the route\'s end');
  const nodes = TANSY.talk.nodes;
  for (const [id, n] of Object.entries(nodes)) {
    for (const c of n.choices ?? []) if (c.goto) assert.ok(nodes[c.goto], `${id}: goes to ${c.goto}`);
    if (n.next) assert.ok(nodes[n.next], `${id}: next ${n.next}`);
    for (const p of [n.say].flat()) {
      assert.ok(parseLine(p).explicit, `${id}: a tone on "${String(p.text ?? p).slice(0, 40)}"`);
      if (p.world) assert.ok(STOPS.includes(p.world), `${id}: ${p.world} is one of her stops`);
    }
    for (const c of n.choices ?? []) assert.ok(parseLine(c.text).explicit, `${id}: a tone on the answer "${c.text}"`);
  }
  for (const k of [1, 2, 3, 4]) assert.ok(GREETING_LINES[k].every((l) => parseLine(l).explicit), `greeting ${k}`);
  for (const e of [...HESPER_AFTER, ...HOME_TALK.listen]) for (const l of [e.say ?? e].flat()) assert.ok(parseLine(l).explicit, String(l).slice(0, 40));
  // every meeting opens on a scene in each stop, and is marked had by its last nodes
  for (const id of ['m1', 'm2', 'm3', 'm4.home', 'm4.on']) for (const w of STOPS) assert.ok(nodes[id].say.some((p) => p.world === w), `${id}: a scene in ${w}`);
  const had = Object.entries(nodes).filter(([, n]) => n.had).map(([id, n]) => [id, n.had]);
  for (const k of [1, 2, 3, 4]) assert.ok(had.some(([, h]) => h === k), `meeting ${k} is marked had somewhere`);
  // she looks the same everywhere: dressed for one world, every piece of her look named
  assert.equal(TANSY.world, 'saltharbour');
  for (const k of ['head', 'under', 'mask', 'body', 'prop']) assert.ok(TANSY.look[k], `her look names its ${k}`);
});

test('where she is: the first four of her stops landed in, one meeting each, in order; gone after the last', () => {
  assert.deepEqual(fellowHere({}, 'arzach'), { meeting: 1, again: false });
  assert.equal(fellowHere({}, 'desert'), null, 'not off her stops');
  assert.equal(fellowHere({}, 'saltharbour'), null, 'not at home before she goes home');
  // met in Vael: she stays there till the next, and waits with the next in every stop not yet had
  const one = { 'fellow.meet': 1, 'fellow.stop.arzach': 1 };
  assert.deepEqual(fellowHere(one, 'arzach'), { meeting: 1, again: true });
  assert.deepEqual(fellowHere(one, 'perdide'), { meeting: 2, again: false });
  assert.deepEqual(fellowHere(one, 'incal'), { meeting: 2, again: false }, 'a stop landed in out of order holds the next meeting, never a later one');
  const two = { ...one, 'fellow.meet': 2, 'fellow.stop.incal': 2 };
  assert.equal(fellowHere(two, 'arzach'), null, 'moved on from Vael');
  assert.deepEqual(fellowHere(two, 'incal'), { meeting: 2, again: true });
  assert.deepEqual(fellowHere(two, 'perdide'), { meeting: 3, again: false });
  const four = { 'fellow.meet': 4, 'fellow.stop.arzach': 1, 'fellow.stop.perdide': 2, 'fellow.stop.incal': 3, 'fellow.stop.bazaar': 4, 'fellow.end': 'home' };
  for (const w of STOPS) assert.equal(fellowHere(four, w), null, `gone from ${w} after the last meeting`);
  assert.deepEqual(fellowHere(four, HOME.world), { meeting: 'home', again: true }, 'home at the Salt Harbour');
  assert.equal(fellowHere({ ...four, 'fellow.end': 'on' }, HOME.world), null, 'gone on: not at home');
});

test('four meetings, each changed by the last: a world ahead, sent home, the compass (and Hesper’s soup)', () => {
  const ctx = fresh();
  // 1. Vael: what he is after, and his name in her book
  let t = talk('arzach', ctx, ['So you followed', 'Something of value', '(Sign it.)']);
  assert.match(t.said, /world ahead of you/);
  assert.match(t.said, /waves smaller/, 'Vael\'s scene');
  assert.ok(!/well back from the drop|counting coins|listening for some/.test(t.said), 'no other world\'s pages');
  assert.equal(ctx.game.flag('fellow.meet'), 1);
  assert.equal(ctx.game.flag('fellow.stop.arzach'), 1);
  assert.equal(ctx.game.flag('fellow.after'), 'value');
  assert.equal(ctx.game.flag('fellow.signed'), true);
  ctx.game.set('met.tansy', true);   // (the conversation panel's)
  assert.equal(balloonReason(fellowPerson('arzach', fellowHere(ctx.game.data.flags, 'arzach')), ctx), null, 'met, nothing new: no balloon');
  t = talk('arzach', ctx);
  assert.match(t.said, /water, sorry, and which way/, 'again in Vael: a word, no second meeting');
  assert.equal(ctx.game.flag('fellow.meet'), 1);
  // 2. Lorn II: she opens on his answer from Vael; send word home
  const p2 = fellowPerson('perdide', fellowHere(ctx.game.data.flags, 'perdide'));
  ctx.game.set('met.tansy', true);
  assert.equal(balloonReason(p2, ctx), 'new', 'a meeting waiting: her balloon, though she has been met');
  t = talk('perdide', ctx, ['Too long', 'Send word']);
  assert.match(t.said, /something of value yet/, 'his answer in Vael, remembered');
  assert.match(t.said, /goat ship/);
  assert.equal(ctx.game.flag('fellow.advice'), 'write');
  assert.equal(ctx.game.flag('fellow.meet'), 2);
  // 3. the City-Shaft: the letter he told her to write; who waits for him; Hesper still reads her page
  t = talk('incal', ctx, ['Someone I didn', 'Every night']);
  assert.match(t.said, /I wrote it/, 'the letter, because he said to send word');
  assert.ok(!/needle came back/.test(t.said), 'not the other path\'s opening');
  assert.match(t.said, /Lodestar/, 'the City-Shaft\'s own words');
  assert.equal(ctx.game.flag('fellow.told'), 'someone');
  assert.equal(ctx.game.flag('fellow.heart'), 'home');
  // 4. the Signal Market: the payoff
  t = talk('bazaar', ctx, ['Safe home']);
  assert.match(t.said, /minute on one of the towers/, 'the market: word home on a tower');
  assert.match(t.said, /say goodbye to your someone/, 'his own answer, given back to him');
  assert.match(t.said, /come and eat with us/);
  assert.equal(ctx.game.flag('fellow.end'), 'home');
  assert.equal(ctx.game.flag('fellow.meet'), 4);
  assert.ok(ctx.quests.has('saltcompass') && !ctx.quests.has('saltletter'), 'her compass in his bag');
  for (const w of STOPS) assert.equal(fellowHere(ctx.game.data.flags, w), null, `gone from ${w}`);
  // the People page has grown with every meeting
  const story = personStory(PERSON.get('tansy'), ctx.game.data.flags).join(' ');
  for (const bit of ['Salt Harbour', 'something of value', 'signed her book', 'Gone where the singing goes', 'send word home', 'did not say goodbye', 'reads her page', 'gave you her compass']) assert.ok(story.includes(bit), `the page: ${bit}`);
  assert.match(personNow(PERSON.get('tansy'), ctx.game.data.flags), /Home at the Salt Harbour/);
  const met = interactions(PERSON.get('tansy'), { flags: ctx.game.data.flags });
  assert.ok(met.things.some((x) => /compass/.test(x)) && /send word home/.test(met.choices[0]));
  // at home: Hesper and Tansy
  const home = fellowPerson(HOME.world, fellowHere(ctx.game.data.flags, HOME.world));
  assert.ok(home.talk.listen, 'a word or two at home');
  const h = new DialogueRunner(home, ctx);
  assert.match(h.pages.join(' '), /Hesper! Hesper/);
});

test('the other way: a race, the needle back, on past the charts, a letter for Hesper', () => {
  const ctx = fresh();
  let t = talk('arzach', ctx, ['Whatever it points at', 'Whatever brought', 'Another time']);
  assert.match(t.said, /underlines it twice/);
  assert.equal(ctx.game.flag('fellow.after'), 'light');
  assert.equal(ctx.game.flag('fellow.signed'), undefined);
  // walked off halfway through a meeting: it is had again next time
  const half = new DialogueRunner(fellowPerson('perdide', fellowHere(ctx.game.data.flags, 'perdide')), ctx);
  assert.equal(half.nodeId, 'm2');
  assert.equal(ctx.game.flag('fellow.meet'), 1, 'not had until its last answer');
  t = talk('perdide', ctx, ['That’s not really', 'You’ve come this far']);
  assert.match(t.said, /Still racing\? You’re winning/, 'his race, remembered');
  assert.equal(ctx.game.flag('fellow.advice'), 'go');
  t = talk('incal', ctx, ['Nobody', 'Find where it goes']);
  assert.match(t.said, /needle came back/);
  assert.equal(ctx.game.flag('fellow.heart'), 'on');
  t = talk('bazaar', ctx, ['(Sign the last page']);
  assert.match(t.said, /charts stop/);
  assert.match(t.said, /Race you/);
  assert.ok(!/say goodbye to your someone/.test(t.said), 'he never told her of anyone');
  assert.equal(ctx.game.flag('fellow.end'), 'on');
  assert.equal(ctx.game.flag('fellow.signed'), true, 'the last page signed');
  assert.ok(ctx.quests.has('saltletter') && !ctx.quests.has('saltcompass'));
  assert.equal(fellowHere(ctx.game.data.flags, HOME.world), null, 'gone on, not home');
  assert.match(personNow(PERSON.get('tansy'), ctx.game.data.flags), /past the last chart/);
  // Hesper takes the letter
  const hesper = CONTENT.saltharbour.npcs.find((n) => n.id === 'hesper');
  ctx.game.set('heard.hesper.n0', true);   // (the harbour book's line heard already)
  const r = new DialogueRunner(hesper, ctx);
  assert.match(r.pages.join(' '), /That’s my niece/);
  assert.ok(!ctx.quests.has('saltletter'), 'the letter given');
  assert.equal(ctx.game.flag('fellow.letter.given'), true);
  assert.match(personStory(PERSON.get('tansy'), ctx.game.data.flags).join(' '), /gave Hesper the letter/);
});

test('the last meeting away from the market says how she goes home from there', () => {
  const ctx = fresh({ 'fellow.meet': 3, 'fellow.stop.arzach': 1, 'fellow.stop.incal': 2, 'fellow.stop.bazaar': 3, 'fellow.heart': 'home' });
  const t = talk('perdide', ctx, ['Keep the page']);
  assert.match(t.said, /postal hulk/);
  assert.match(t.said, /under a fungus tree/, 'Lorn\'s scene');
  assert.ok(!/towers/.test(t.said));
  assert.equal(ctx.game.flag('fellow.stop.perdide'), 4);
});

test('an older save that had finished one of her stops meets her late: a world behind him, not ahead', () => {
  const old = { 'save.migrated': 6, 'world.desert.done': true, 'world.arzach.done': true };
  migrateFlags(old);
  assert.equal(old['fellow.late'], true);
  const early = { 'save.migrated': 6, 'world.desert.done': true };
  migrateFlags(early);
  assert.equal(early['fellow.late'], undefined, 'none of her stops done: she is ahead, as for anyone');
  const ctx = fresh(old);
  const t = talk('perdide', ctx, ['So you followed', 'I’m not sure', 'Another time']);
  assert.match(t.said, /world behind you/);
  assert.equal(ctx.game.flag('fellow.stop.perdide'), 1, 'her first meeting where she waited');
});

test('in each of her stops she waits a few steps from the ship, on ground you can walk to, looking the same', () => {
  const looks = [];
  for (const id of [...STOPS, HOME.world]) {
    clearInteractables(); clearTargets();
    const meta = LEVELS.find((l) => l.id === id);
    const scene = new THREE.Scene();
    const level = quiet(() => meta.create(scene));
    const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
    quiet(() => level.init?.(physics));
    // (the ship built with no page, so its drawings are skipped; the people want one for their balloons)
    delete globalThis.document;
    const ship = id === HOME.world ? null : quiet(() => new Ship({ scene, physics, level, levelId: id, content: CONTENT[id] }));
    globalThis.document = page;
    const game = new GameState(memory());
    if (id === HOME.world) game.data.flags['fellow.end'] = 'home';
    const quests = new Quests({ game });
    const npcs = [];
    const talkable = (npc, def) => { npc.def = def; };
    const got = quiet(() => setupFellow({ levelId: id, scene, physics, level, ship, npcs, game, quests, talkable }));
    assert.ok(got, `${id}: she is there`);
    const p = got.npc.pos;
    const g = physics.groundAt(p.x, p.y + 3, p.z, 8);
    assert.ok(Number.isFinite(g) && Math.abs(g - p.y) < 0.3, `${id}: on solid ground (${g?.toFixed?.(2)} vs ${p.y.toFixed(2)})`);
    assert.ok(!level.unsafe?.(p), `${id}: not in deep water`);
    if (ship) {
      const d = Math.hypot(p.x - ship.rampFoot.x, p.z - ship.rampFoot.z);
      assert.ok(d > 4 && d < 20, `${id}: a few steps from the ramp (${d.toFixed(1)} m)`);
      // not on the ramp's own line, where you walk out
      const out = ship.outDir, side = Math.abs((p.x - ship.rampFoot.x) * out.z - (p.z - ship.rampFoot.z) * out.x);
      assert.ok(side > 3, `${id}: off to one side of the way out (${side.toFixed(1)} m)`);
      // nobody of the world's own standing on her
      for (const n of CONTENT[id].npcs) assert.ok(Math.hypot(n.at[0] - p.x, n.at[1] - p.z) > 3, `${id}: clear of ${n.id ?? 'someone'}`);
      assert.deepEqual(fellowSpot({ ship, physics, level, npcs: [] }).at.toArray(), p.toArray(), `${id}: the same spot every visit`);
    } else {
      assert.ok(homeSpot(physics), 'home: her place by the book');
      const hesper = CONTENT[id].npcs.find((n) => n.id === 'hesper');
      assert.ok(Math.hypot(hesper.at[0] - p.x, hesper.at[1] - p.z) < 8, 'home: beside Hesper');
    }
    assert.equal(npcs.length, 1);
    looks.push(got.npc.look ?? got.npc.dress ?? null);
  }
  const keys = ['head', 'under', 'mask', 'body', 'prop', 'cloak', 'cloth', 'hair', 'skin', 'height', 'build'];
  assert.ok(looks[0]?.head, 'her look, as dressed');
  for (const L of looks.slice(1)) for (const k of keys) assert.equal(L[k], looks[0][k], `her ${k} the same in every world`);
});

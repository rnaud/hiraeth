import test from 'node:test';
import assert from 'node:assert/strict';

// The play-through: a new game played from the crash to the stone at home (the first homecoming), then out
// to the Lantern to find Ilen and home again for the true ending, world by world in the route's
// order (src/levels/names.js ORDER), on the game's own modules, by the agent in tests/playthrough-agent.js
// with what tests/playthrough-worlds.js knows of each world. Between worlds it goes aboard: the
// voicemail's waiting messages, the holo table's map, which must chart the next world. In each world it
// plays the quests the route needs (the main quest, the temple's gadget where the route needs it, the cab
// pass) and reports every soft-lock, every step without a target, every person missing, every place out of
// reach with what he has, every way of getting about before its time; the last test fails on any of them
// not in KNOWN. PLAYTHROUGH_VERBOSE=1 prints every step. docs/systems/testing.md.

const A = await import('./playthrough-agent.js');
const { game, items, V } = A;
/** Without the little DOM (the ship's cinema builds a real one when it sees a document): as tests/ending.test.js runs it. */
const noDom = (f) => { const d = globalThis.document; delete globalThis.document; try { return f(); } finally { globalThis.document = d; } };
const quiet = (f) => { const w = console.warn, l = console.log, i = console.info, e = console.error; console.warn = console.log = console.info = console.error = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; console.error = e; } };
const { nextSpot } = await import('../src/temples/index.js');

const { SOLVERS, WAYS, CHECKS, ACTIONS, ROUTE, each, FIRST, before } = await import('./playthrough-worlds.js');
const say = process.env.PLAYTHROUGH_VERBOSE ? console.log : () => {};

const journal = A.memoryJournal();
const ISSUES = [];
const report = (i) => { ISSUES.push(i); };
let prev = null;
game.reset();

for (const [k, R] of ROUTE.entries()) {
  test(`${k + 1}. ${R.id}`, async () => {
    const issue = (kind, text) => report({ world: R.id, quest: '-', stage: '-', kind, text });
    if (prev) A.shipTurn({ from: prev, to: R.id, journal, issue });
    const W = A.loadWorld(R.id, { journal, report });
    // nothing he could not have found yet
    for (const [m, at] of Object.entries(FIRST)) if (A.owned(W).includes(m) && before(R.id, at) && R.id !== at) issue('ability', `he arrives with ${m} before ${at}`);
    if (items.has('jetpack') && before(R.id, 'incal')) issue('ability', 'the jets before the City-Shaft');
    const fallback = W.boxes.list.filter((b) => b.fallback).map((b) => b.item);
    if (fallback.length) issue('box', `a fallback box by the ship (${fallback.join(', ')}): the route should have brought them`);
    for (const p of R.play) {
      if (p.temple) { const log = await A.templeTo(W, p.temple, issue, { nextSpot }); say(`  temple: ${log.join(' / ')}`); continue; }
      if (p.act) { ACTIONS[p.act](W, issue); continue; }
      const r = await A.playQuest(W, p, { solvers: SOLVERS, ways: WAYS, checks: CHECKS, each });
      say(`  ${p}${r.done ? ' (done)' : ' (NOT DONE)'}:\n    ${r.steps.join('\n    ')}`);
    }
    // the world counts as done, and its page closed
    if (!game.flag(`world.${R.id}.done`)) issue('route', `${R.id} is not done after its main quest`);
    W.dispose();
    prev = R.id;
    for (const i of ISSUES.filter((x) => x.world === R.id)) say(`  ISSUE [${i.kind}] ${i.quest} ${i.stage}: ${i.text}`);
  });
}

// ------------------------------------------------------------------ home
const { Ship } = await import('../src/ship/ship.js');
const { HomecomingDirector } = await import('../src/ship/homecoming.js');
test(`${ROUTE.length + 1}. home: the voicemail asks him home, the map shows it, the first homecoming plays to the stone`, async () => {
  const issue = (kind, text) => report({ world: 'home', quest: '-', stage: '-', kind, text });
  const { heard, map } = A.shipTurn({ from: prev, to: 'home', journal, issue });
  say(`  messages heard on the way: ${heard.join(', ') || 'none'}; charted: ${map.filter((e) => e.known).map((e) => e.id).join(', ')}`);
  const W = A.loadWorld('home', { journal, report });
  const ship = noDom(() => quiet(() => new Ship({ scene: W.scene, physics: W.physics, level: W.level, levelId: 'home', content: A.CONTENT.home, prologue: true })));
  const rig = { yaw: 0, pitch: 0, target: V(), dist: 6 };
  noDom(() => ship.attach({ player: W.player, rig, camera: W.camera, sound: {}, levels: A.LEVELS, order: A.ORDER, titles: {}, npcs: W.npcs, journal }));
  const dir = noDom(() => new HomecomingDirector(ship));
  ship.cinematic = dir;
  noDom(() => quiet(() => dir.start()));
  const kept = game.keepsakes().map((k) => k.id);
  for (const id of A.ORDER) if (!kept.some((k) => k.startsWith(`${id}.`))) issue('ending', `no keepsake from ${id} in the hold`);
  for (let t = 0; t < 400 && !dir.done; t += 1 / 30) {
    noDom(() => quiet(() => dir.update(1 / 30, dir.stage === 'tomb' || dir.stage === 'end' || dir.stage === 'credits')));
    noDom(() => quiet(() => W.player.update(1 / 30, ship.input({}), rig.yaw)));
    if (dir.stage === 'cargo' && !dir.chosen) noDom(() => dir.choose());
    if ((t * 30 | 0) % 10 === 0) W.step(1);
    if ((t * 30 | 0) % 300 === 0) await A.sleep(1);
  }
  if (!dir.done || !game.flag('ending.done')) issue('ending', `the homecoming stopped at "${dir.stage}"`);
  if (dir.kind !== 'first' || game.flag('ending.final')) issue('ending', 'the first flight home should be the first homecoming, and not end the story');
  else say(`  the homecoming: done; ${W.level.tomb.tokens.children.length} tokens on the stone`);
  W.dispose();
  for (const i of ISSUES.filter((x) => x.world === 'home')) say(`  ISSUE [${i.kind}] ${i.quest} ${i.stage}: ${i.text}`);
});

// ------------------------------------------------------------------ the final chapter: the Lantern, Ilen, the true ending
// (src/story/ending.js): after the first homecoming the ship's log of the light over the hill waits on the
// voicemail, and the map charts the Lantern past the market; he finds Ilen there, she comes home with him,
// and the next homecoming is the last: the reel's oldest recording at the stone, the end card, the credits.
const homecoming = async (issue, kind) => {
  const W = A.loadWorld('home', { journal, report });
  const ship = noDom(() => quiet(() => new Ship({ scene: W.scene, physics: W.physics, level: W.level, levelId: 'home', content: A.CONTENT.home, prologue: true })));
  const rig = { yaw: 0, pitch: 0, target: V(), dist: 6 };
  noDom(() => ship.attach({ player: W.player, rig, camera: W.camera, sound: {}, levels: A.LEVELS, order: A.ORDER, titles: {}, npcs: W.npcs, journal }));
  const dir = noDom(() => new HomecomingDirector(ship));
  if (dir.kind !== kind) issue('ending', `flying home plays the ${dir.kind} homecoming, not the ${kind}`);
  ship.cinematic = dir;
  noDom(() => quiet(() => dir.start()));
  for (let t = 0; t < 600 && !dir.done; t += 1 / 30) {
    noDom(() => quiet(() => dir.update(1 / 30, dir.stage === 'tomb' || dir.stage === 'card' || dir.stage === 'credits')));
    noDom(() => quiet(() => W.player.update(1 / 30, ship.input({}), rig.yaw)));
    if (dir.stage === 'cargo' && !dir.chosen) noDom(() => dir.choose());
    if ((t * 30 | 0) % 10 === 0) W.step(1);
    if ((t * 30 | 0) % 300 === 0) await A.sleep(1);
  }
  return { W, dir };
};
test(`${ROUTE.length + 2}. the Lantern: the light's trace on the map, Ilen at the lantern's step, she comes home with him`, async () => {
  const issue = (kind, text) => report({ world: 'lantern', quest: '-', stage: '-', kind, text });
  if (!game.flag('ending.done') || game.flag('ending.final')) issue('ending', 'the first homecoming should be over, and only it');
  const { heard } = A.shipTurn({ from: 'home', to: 'lantern', journal, issue });
  if (!heard.includes('trace')) issue('ship', `the ship's log of the light over the hill did not wait on the voicemail (heard: ${heard.join(', ')})`);
  const W = A.loadWorld('lantern', { journal, report });
  const r = await A.playQuest(W, 'lantern.ilen', { solvers: SOLVERS, ways: WAYS, checks: CHECKS, each });
  say(`  lantern.ilen${r.done ? ' (done)' : ' (NOT DONE)'}:\n    ${r.steps.join('\n    ')}`);
  if (!game.flag('finale.met')) issue('route', 'Ilen did not come home with him');
  if (!game.flag('world.lantern.done')) issue('route', 'the Lantern is not done after its quest');
  if (!game.keepsakes().some((k) => k.id === 'lantern.person')) issue('ending', 'no keepsake from the Lantern');
  W.dispose();
});
test(`${ROUTE.length + 3}. home again, with Ilen: the true ending at the stone, the oldest recording, the end card, the credits`, async () => {
  const issue = (kind, text) => report({ world: 'home', quest: '-', stage: '-', kind, text });
  A.shipTurn({ from: 'lantern', to: 'home', journal, issue });
  const { W, dir } = await homecoming(issue, 'final');
  if (!dir.done || !game.flag('ending.final')) issue('ending', `the true ending stopped at "${dir.stage}"`);
  if (!dir.lines?.some((l) => l.reel)) issue('ending', 'the reel was not set down at the true ending');
  if (!W.level.family?.ilen) issue('ending', 'Ilen is not at home');
  W.dispose();
  for (const i of ISSUES.filter((x) => x.world === 'home' || x.world === 'lantern')) say(`  ISSUE [${i.kind}] ${i.quest} ${i.stage}: ${i.text}`);
});

// ------------------------------------------------------------------ the report
// Issues the play-through knows about and that wait on a decision (each with why); anything else fails it.
const KNOWN = [
  // home's design, intentional and kept (the author's decision, October 2026): Lou runs down the path to meet
  // you and starts her homecoming talk herself, asking what you brought (src/story/home.js greet;
  // tests/home-family.test.js). The "call you over, never start the talk" rule is for everyone else.
  { world: 'home', kind: 'auto-talk', match: /^lou /, why: 'intentional: Lou runs to meet you at home and starts the homecoming talk herself (the author’s decision)' },
];
test('the report: no soft-lock, no step without a target, nothing out of reach, nothing early', () => {
  const known = (i) => KNOWN.find((k) => k.world === i.world && k.kind === i.kind && k.match.test(i.text));
  const fresh = ISSUES.filter((i) => !known(i));
  if (fresh.length || process.env.PLAYTHROUGH_VERBOSE) console.log(`\n  ${ISSUES.length} issue(s) on the route${ISSUES.length ? ':' : ''}`);
  if (fresh.length || process.env.PLAYTHROUGH_VERBOSE) for (const i of ISSUES) console.log(`  - ${i.world} [${i.kind}] ${i.quest} ${i.stage}: ${i.text}${known(i) ? `  (known: ${known(i).why})` : ''}`);
  assert.deepEqual(fresh.map((i) => `${i.world} [${i.kind}] ${i.text}`), []);
});

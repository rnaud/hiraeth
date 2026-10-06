import test from 'node:test';
import assert from 'node:assert/strict';

// The play-through: a new game played from the crash to the stone at home, world by world in the route's
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
test(`${ROUTE.length + 1}. home: the voicemail asks him home, the map shows it, the homecoming plays to the stone`, async () => {
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
  else say(`  the homecoming: done; ${W.level.tomb.tokens.children.length} tokens on the stone`);
  W.dispose();
  for (const i of ISSUES.filter((x) => x.world === 'home')) say(`  ISSUE [${i.kind}] ${i.quest} ${i.stage}: ${i.text}`);
});

// ------------------------------------------------------------------ the report
// Issues the play-through knows about and that wait on a decision (each with why); anything else fails it.
const KNOWN = [
  // home's design: Lou runs down the path to meet you and asks what you brought (src/story/home.js greet;
  // tests/home-family.test.js); the "call you over, never start the talk" rule was asked for Nour
  { world: 'home', kind: 'auto-talk', match: /^lou /, why: 'Lou runs to meet you at home (a design choice; see the report)' },
];
test('the report: no soft-lock, no step without a target, nothing out of reach, nothing early', () => {
  const known = (i) => KNOWN.find((k) => k.world === i.world && k.kind === i.kind && k.match.test(i.text));
  const fresh = ISSUES.filter((i) => !known(i));
  if (fresh.length || process.env.PLAYTHROUGH_VERBOSE) console.log(`\n  ${ISSUES.length} issue(s) on the route${ISSUES.length ? ':' : ''}`);
  if (fresh.length || process.env.PLAYTHROUGH_VERBOSE) for (const i of ISSUES) console.log(`  - ${i.world} [${i.kind}] ${i.quest} ${i.stage}: ${i.text}${known(i) ? `  (known: ${known(i).why})` : ''}`);
  assert.deepEqual(fresh.map((i) => `${i.world} [${i.kind}] ${i.text}`), []);
});

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
//
// Completion (issue #670): after a world's route, every temple it builds that is not yet done is played to its guardian
// with what the route has earned so far; between worlds the save goes through the game's own storage and is read back
// as a fresh page reads it (game.reload, migrateSave), and play continues from what was read; the last tests check
// tests/completion-spec.js's conditions (every world, every temple, the core gadgets, `ending.final`). Evidence and,
// on a failure, the state at every issue are written to $PLAYTHROUGH_OUT (default <tmp>/hiraeth-playthrough)/
// playthrough-evidence.json.

// The save's storage: a localStorage look-alike in memory, in place before the game's modules read it (src/save-slots.js),
// so the game state is written where a page writes it and can be read back from there.
const STORE = new Map();
globalThis.localStorage ??= { getItem: (k) => STORE.get(k) ?? null, setItem: (k, v) => { STORE.set(k, String(v)); }, removeItem: (k) => { STORE.delete(k); }, key: (i) => [...STORE.keys()][i] ?? null, get length() { return STORE.size; }, clear: () => STORE.clear() };

// (the gadgets as items: since issues #375 and #377 the temples' chests hold them, src/gadgets/registry.js)
await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { game, items, V } = A;
/** Without the little DOM (the ship's cinema builds a real one when it sees a document): as tests/ending.test.js runs it. */
const noDom = (f) => { const d = globalThis.document; delete globalThis.document; try { return f(); } finally { globalThis.document = d; } };
const quiet = (f) => { const w = console.warn, l = console.log, i = console.info, e = console.error; console.warn = console.log = console.info = console.error = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; console.error = e; } };
const { nextSpot } = await import('../src/temples/index.js');

const { SOLVERS, WAYS, CHECKS, ACTIONS, ROUTE, each, FIRST, before } = await import('./playthrough-worlds.js');
const { templesIn } = await import('../src/temples/index.js');
const { completionSpec } = await import('./completion-spec.js');
const { writeFileSync, mkdirSync } = await import('node:fs');
const { join } = await import('node:path');
const { tmpdir } = await import('node:os');
const { execSync } = await import('node:child_process');
const say = process.env.PLAYTHROUGH_VERBOSE ? console.log : () => {};

const journal = A.memoryJournal();
const ISSUES = [];
// (the state at each issue, for the failure's diagnosis: where he stood, what he carried, every flag)
let here = { world: '-', step: '-' };
const snapshot = () => ({ ...here, items: items.owned(), keepsakes: game.keepsakes().map((k) => k.id), flags: { ...game.data.flags } });
const report = (i) => { ISSUES.push({ ...i, step: i.step ?? here.step, state: snapshot() }); };
// the evidence of the run (written whatever the outcome): world by world what was played, how far, the save read back
const OUT = process.env.PLAYTHROUGH_OUT ?? join(tmpdir(), 'hiraeth-playthrough');
const rev = (() => { try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; } })();
const EVIDENCE = { test: 'tests/playthrough.test.js', rev, node: process.version, started: new Date().toISOString(), worlds: [], ending: {}, completion: null,
  methods: {
    real: 'the levels, collision, people, story runtime, quests, conversations (answers chosen from their data), boxes, temple logic, the ship\'s voicemail and map, the save written and read back through the game\'s storage, the homecomings',
    shortcuts: 'he is put at each objective once a walk (or a declared way he has) is found, not walked; temple steps are done through the temple\'s logic where he stands (tests/temple-playthrough.test.js rolls the balls by real hits); arena foes are counted beaten; guardians resolved once they can be faced (tests/guardian-completable.test.js fights them); the chime-pirates\' fight marked won; a world the signature search finds marked found',
    untested: 'rendering, input devices, audio, the traveller\'s own movement between objectives, Unity/native hosts (see docs/systems/testing.md, "Completion coverage")',
  } };
const writeEvidence = () => { try { mkdirSync(OUT, { recursive: true }); const f = join(OUT, 'playthrough-evidence.json'); writeFileSync(f, JSON.stringify({ ...EVIDENCE, issues: ISSUES }, null, 1)); return f; } catch { return null; } };
const templeState = (id) => ({ id, entered: !!game.flag(`temple.${id}.entered`), gadget: !!game.flag(`temple.${id}.gadget`), done: !!game.flag(`temple.${id}.done`) });
/** The save as the game wrote it, read back as a fresh page reads it; differences are issues. */
const SAVE_KEY = 'hiraeth.game.v1';
function saveRoundTrip(world, issue) {
  const mem = JSON.stringify(game.data), stored = game.storage?.getItem(SAVE_KEY);
  const diff = (a, b) => { const x = JSON.parse(a ?? '{}').flags ?? {}, y = JSON.parse(b ?? '{}').flags ?? {}; return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k])); };
  if (stored !== mem) issue('save', `the stored save differs from the game in play after ${world}: ${stored == null ? 'nothing stored' : diff(mem, stored).slice(0, 8).join(', ') || 'keepsakes'}`);
  game.reload(); A.migrateSave(game);
  const back = JSON.stringify(game.data);
  if (back !== mem) issue('save', `the save read back after ${world} is not the game that was saved: ${diff(mem, back).slice(0, 8).join(', ') || 'keepsakes'}`);
  return { bytes: stored?.length ?? 0, same: stored === mem && back === mem };
}
let prev = null;
// a new game, then the page that boots it: the save read back and its migrations' marks set (main.js), as every page after does
game.reset(); game.reload(); A.migrateSave(game);

for (const [k, R] of ROUTE.entries()) {
  test(`${k + 1}. ${R.id}`, async () => {
    const issue = (kind, text) => report({ world: R.id, quest: '-', stage: '-', kind, text });
    const ev = { world: R.id, plays: [], doneAfter: null, temples: [], save: null };
    EVIDENCE.worlds.push(ev);
    here = { world: R.id, step: 'arrival' };
    const doneYet = (label) => { if (!ev.doneAfter && game.flag(`world.${R.id}.done`)) ev.doneAfter = label; };
    if (prev) {
      // the first flight to a world never visited meets the chime-pirates (src/ambush.js): the playthrough wins the fight
      const fresh = !journal.seen.has(R.id), t = A.shipTurn({ from: prev, to: R.id, journal, issue });
      if (fresh !== !!t.ambushed) issue('ambush', `the flight to ${R.id} ${fresh ? 'was not ambushed though it is new' : 'was ambushed though he has been there'}`);
    }
    const W = A.loadWorld(R.id, { journal, report });
    // nothing he could not have found yet
    for (const [m, at] of Object.entries(FIRST)) if (A.owned(W).includes(m) && before(R.id, at) && R.id !== at) issue('ability', `he arrives with ${m} before ${at}`);
    if (items.has('jetpack')) issue('ability', 'the jets anywhere (a debug item since v1.38) in play');
    if (items.has('harness')) issue('ability', 'the Warden’s harness (gone since v1.42: the City-Shaft’s air pillars carry the wings) in play');
    if (items.has('fan') && before(R.id, 'incal')) issue('ability', 'the gust fan before the City-Shaft (its temple’s, since issue #377)');
    const fallback = W.boxes.list.filter((b) => b.fallback).map((b) => b.item);
    if (fallback.length) issue('box', `a fallback box by the ship (${fallback.join(', ')}): the route should have brought them`);
    for (const p of R.play) {
      const label = p.temple ? `temple ${p.id ?? R.id} to its ${p.temple === 'done' ? 'guardian' : 'chest'}` : p.act ? `${p.act}` : p;
      here.step = label;
      if (p.temple) { const log = await A.templeTo(W, p.temple, issue, { nextSpot, id: p.id }); say(`  temple: ${log.join(' / ')}`); ev.plays.push({ step: label, steps: log.length }); doneYet(label); continue; }
      if (p.act) { ACTIONS[p.act](W, issue); ev.plays.push({ step: label }); doneYet(label); continue; }
      const r = await A.playQuest(W, p, { solvers: SOLVERS, ways: WAYS, checks: CHECKS, each });
      say(`  ${p}${r.done ? ' (done)' : ' (NOT DONE)'}:\n    ${r.steps.join('\n    ')}`);
      ev.plays.push({ step: label, done: r.done, steps: r.steps.length });
      doneYet(label);
    }
    // the world counts as done, and its page closed
    if (!game.flag(`world.${R.id}.done`)) issue('route', `${R.id} is not done after its main quest`);
    // every temple here played to its guardian with what the route has earned by now (the route needs some only to their chest)
    for (const t of templesIn(R.id)) {
      if (game.flag(`temple.${t}.done`)) continue;
      here.step = `temple ${t} to its guardian (completion)`;
      const log = await A.templeTo(W, 'done', issue, { nextSpot, id: t });
      say(`  temple ${t} (completion): ${log.join(' / ')}`);
      ev.plays.push({ step: here.step, steps: log.length });
    }
    ev.temples = templesIn(R.id).map(templeState);
    for (const t of ev.temples) if (!t.done) issue('temple', `${t.id} is not done after its world (${JSON.stringify(t)})`);
    W.dispose();
    here.step = 'the save, written and read back';
    ev.save = saveRoundTrip(R.id, issue);
    prev = R.id;
    for (const i of ISSUES.filter((x) => x.world === R.id)) say(`  ISSUE [${i.kind}] ${i.quest} ${i.stage}: ${i.text}`);
  });
}

// ------------------------------------------------------------------ home
const { Ship } = await import('../src/ship/ship.js');
const { HomecomingDirector } = await import('../src/ship/homecoming.js');
test(`${ROUTE.length + 1}. home: the voicemail asks him home, the map shows it, the first homecoming plays to the stone`, async () => {
  const issue = (kind, text) => report({ world: 'home', quest: '-', stage: '-', kind, text });
  here = { world: 'home', step: 'the first homecoming' };
  const { heard, map, ambushed } = A.shipTurn({ from: prev, to: 'home', journal, issue });
  assert.equal(ambushed, false, 'no pirates on the way home');
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
  EVIDENCE.ending.first = { stage: dir.stage, done: dir.done, kind: dir.kind, worldsDone: A.completedWorlds(A.ORDER, { flag: (k) => game.flag(k), storyDone: journal.storyDone }).length };
  if (dir.kind !== 'first' || game.flag('ending.final')) issue('ending', 'the first flight home should be the first homecoming, and not end the story');
  else say(`  the homecoming: done; ${W.level.tomb.tokens.children.length} tokens on the stone`);
  W.dispose();
  here.step = 'the save, written and read back'; EVIDENCE.ending.firstSave = saveRoundTrip('the first homecoming', issue);
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
  here = { world: 'lantern', step: 'lantern.ilen' };
  if (!game.flag('ending.done') || game.flag('ending.final')) issue('ending', 'the first homecoming should be over, and only it');
  const { heard } = A.shipTurn({ from: 'home', to: 'lantern', journal, issue });
  if (!heard.includes('trace')) issue('ship', `the ship's log of the light over the hill did not wait on the voicemail (heard: ${heard.join(', ')})`);
  const W = A.loadWorld('lantern', { journal, report });
  const r = await A.playQuest(W, 'lantern.ilen', { solvers: SOLVERS, ways: WAYS, checks: CHECKS, each });
  say(`  lantern.ilen${r.done ? ' (done)' : ' (NOT DONE)'}:\n    ${r.steps.join('\n    ')}`);
  if (!game.flag('finale.met')) issue('route', 'Ilen did not come home with him');
  EVIDENCE.ending.lantern = { quest: r.done, met: !!game.flag('finale.met') };
  if (!game.flag('world.lantern.done')) issue('route', 'the Lantern is not done after its quest');
  if (!game.keepsakes().some((k) => k.id === 'lantern.person')) issue('ending', 'no keepsake from the Lantern');
  W.dispose();
  here.step = 'the save, written and read back'; EVIDENCE.ending.lanternSave = saveRoundTrip('the Lantern', issue);
});
test(`${ROUTE.length + 3}. home again, with Ilen: the true ending at the stone, the oldest recording, the end card, the credits`, async () => {
  const issue = (kind, text) => report({ world: 'home', quest: '-', stage: '-', kind, text });
  here = { world: 'home', step: 'the true ending' };
  A.shipTurn({ from: 'lantern', to: 'home', journal, issue });
  const { W, dir } = await homecoming(issue, 'final');
  if (!dir.done || !game.flag('ending.final')) issue('ending', `the true ending stopped at "${dir.stage}"`);
  EVIDENCE.ending.final = { stage: dir.stage, done: dir.done, flag: !!game.flag('ending.final') };
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
test('completion: every condition of tests/completion-spec.js met by what was played (every world, every temple, the core gadgets, the true ending)', () => {
  const spec = completionSpec(), missing = [];
  for (const w of spec.worlds) {
    if (!game.flag(w.doneFlag)) missing.push(w.doneFlag);
    for (const t of w.temples) if (!game.flag(t.doneFlag)) missing.push(t.doneFlag);
    for (const c of w.core) if (!items.has(c)) missing.push(`item.${c}`);
  }
  for (const f of ['ending.done', 'finale.met', spec.ending.final]) if (!game.flag(f)) missing.push(f);
  EVIDENCE.completion = { ok: !missing.length, missing, worldsDone: spec.worlds.filter((w) => game.flag(w.doneFlag)).length, templesDone: spec.worlds.flatMap((w) => w.temples).filter((t) => game.flag(t.doneFlag)).length, items: items.owned() };
  const f = writeEvidence();
  assert.deepEqual(missing, [], `not completed: ${missing.join(', ')} (state and evidence: ${f})`);
});
test('the report: no soft-lock, no step without a target, nothing out of reach, nothing early', () => {
  const known = (i) => KNOWN.find((k) => k.world === i.world && k.kind === i.kind && k.match.test(i.text));
  const fresh = ISSUES.filter((i) => !known(i));
  const f = writeEvidence();
  if (fresh.length) console.log(`  the state at each issue (every flag, what he carried, the step): ${f}`);
  if (fresh.length || process.env.PLAYTHROUGH_VERBOSE) console.log(`\n  ${ISSUES.length} issue(s) on the route${ISSUES.length ? ':' : ''}`);
  if (fresh.length || process.env.PLAYTHROUGH_VERBOSE) for (const i of ISSUES) console.log(`  - ${i.world} (at: ${i.step}) [${i.kind}] ${i.quest} ${i.stage}: ${i.text}${known(i) ? `  (known: ${known(i).why})` : ''}`);
  assert.deepEqual(fresh.map((i) => `${i.world} [${i.kind}] ${i.text}`), []);
});

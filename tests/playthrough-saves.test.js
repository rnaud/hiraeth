import test from 'node:test';
import assert from 'node:assert/strict';

// Old saves, from before the route was reordered (desert, City-Shaft, Vael, Vael II, Hangar, Buried
// Machine, Viridel, Garden, Lorn, Lorn II, market: git 4ab077b^), loaded the way a page boots them
// (src/game-state.js, src/save-migrate.js, src/boxes/index.js migrateSave, then each world's own
// migration as its story sets up), then played on by the play-through's agent (tests/playthrough-agent.js)
// with the same knowledge of the worlds as the route (tests/playthrough-worlds.js). Each must resume
// sanely: its migrations done, the route charting what it should, the world it stood in playable to its
// end with what it carries, and nothing it had taken away.

const A = await import('./playthrough-agent.js');
const { game, items } = A;
const { SOLVERS, WAYS, CHECKS, each } = await import('./playthrough-worlds.js');
const { knownWorlds } = await import('../src/story/route.js');
const { MIGRATED } = await import('../src/save-migrate.js');

const KEEP = {
  desert: { id: 'desert.knowing', level: 'desert', name: 'What the giants left', kind: 'knowing', text: 'The giants carried the water. The tree drinks what they left.', t: 1 },
  incal: { id: 'incal.word', level: 'incal', name: 'Look up once a day', kind: 'word', text: '“Look up once a day. Wherever you are, whatever is up there.” Nima, who sweeps the high terrace.', t: 2 },
};
// what a save that finished the desert (as it played before the reorder: the empty tank, the spark-stone) holds
const DESERT_DONE = {
  'prologue.done': true, 'charge.given': true, 'charge.card': true, 'save.migrated': 1, 'items.v': 2,
  'item.backpack': true, 'box.desert.backpack': true, 'tool.empty': false, 'tool.colours': 2, 'desert.quest.v': 3,
  'quest.desert.power': 'done', 'world.desert.done': true, 'ship.powered': true, 'ship.launched': true,
  'desert.city.entered': true, 'desert.elder.heard': true, 'desert.well.seen': true, 'desert.jar.given': true, 'desert.speaker.heard': true,
  'desert.cave.seen': true, 'desert.channel.open': true, 'desert.jar.filled': true, 'desert.well.watched': true, 'desert.spark.heard': true,
  'desert.bike.found': true, 'desert.hearth.seen': true, 'desert.hearth.open': true, 'desert.stone.taken': true, 'desert.tree.lit': true, 'desert.ship.fed': true,
  'met.marrow': true, 'met.nour': true, 'met.ama': true, 'met.speaker': true, 'calls.1': true, 'signature.told': true,
};
// …and the City-Shaft, second on the old route: the jets from the Warden's Well, the Lodestar lit
const SHAFT_DONE = {
  ...DESERT_DONE,
  'quest.incal.light': 'done', 'world.incal.done': true, 'incal.lit': true, 'met.nima': true, 'met.ossa': true, 'met.dov': true,
  'item.jetpack': true, 'box.incal.temple.jetpack': true, 'temple.incal.entered': true, 'temple.incal.gadget': true, 'quest.temple.incal': 'keeper',
  'calls.2': true, 'signature.incal': true, 'quest.tracked': 'temple.incal',
};
// the desert short of the Rose House on the quest's order before #278 (the gift, then the blade and guard): its migrations
// up to date, so nothing hands it the blade and the guard; `stage` 'gear' (fed, the ship awake) or 'ship' (the gift to come)
const DESERT_GEAR = (stage) => {
  const f = { ...DESERT_DONE, 'save.migrated': MIGRATED(), 'desert.quest.v': 5, 'quest.desert.power': stage, 'quest.tracked': 'desert.power', 'ship.level': 'desert',
    'item.doublejump': true, 'box.desert.lift': true, 'item.gun': true, 'box.desert.gun': true, 'desert.door.open': true, 'desert.pool.tinted': true, 'desert.bike.uncovered': true };
  for (const k of ['world.desert.done', 'ship.launched', 'calls.1', 'item.sword', 'item.shield']) delete f[k];
  if (stage === 'ship') for (const k of ['desert.ship.fed', 'ship.powered']) delete f[k];
  return f;
};
const SAVES = [
  {
    // (issue #278: the Rose House's step comes before the gift now; a save at it already, fed, stays there and ends with them)
    name: 'the desert at its old last step: Qanat’s gift had, the ship awake, the Rose House still to do',
    data: { flags: DESERT_GEAR('gear'), keepsakes: [] },
    journal: { stories: {}, seen: { desert: 1 } },
    known: ['desert', 'arzach', 'perdide'],
    play: { world: 'desert', quests: ['desert.power'], stage: 'blade' },
    after: (issue) => {
      if (!items.has('sword') || !items.has('shield')) issue('it ended without the blade and the guard');
      if (!game.flag('desert.ship.fed') || !game.flag('ship.powered')) issue('the gift it had was lost');
    },
  },
  {
    // (…and one waiting for the gift without them goes back to the Rose House's step, then the gift: desert.js migrateDesertQuest)
    name: 'the desert waiting for Qanat’s gift, the Rose House not done (before #278)',
    data: { flags: DESERT_GEAR('ship'), keepsakes: [] },
    journal: { stories: {}, seen: { desert: 1 } },
    known: ['desert', 'arzach', 'perdide'],
    play: { world: 'desert', quests: ['desert.power'], stage: 'blade' },
    after: (issue) => {
      if (!items.has('sword') || !items.has('shield')) issue('it ended without the blade and the guard');
      if (!game.flag('desert.ship.fed')) issue('no gift at the ship');
    },
  },
  {
    name: 'the jets and the City-Shaft done (the old second world), back at the ship',
    data: { flags: { ...SHAFT_DONE, 'ship.level': 'incal' }, keepsakes: [KEEP.desert, KEEP.incal] },
    journal: { stories: { desert: {}, incal: {} }, seen: { desert: 1, incal: 1 } },
    known: ['desert', 'arzach', 'perdide', 'incal'],
    play: { world: 'arzach', quests: [{ temple: 'gadget' }, 'arzach.bird'] },
    knownAfter: ['desert', 'arzach', 'perdide', 'edena', 'incal'],
    after: (issue) => {
      // (v1.38: the jets anywhere are a debug item: the save kept the Warden's harness, the City-Shaft's own; since v1.42
      // the harness is gone too, and the save has the Warden's bellows, the chest's find now)
      if (items.has('jetpack')) issue('the debug jets kept in play');
      if (items.has('harness')) issue('the Warden\'s harness kept in play');
      if (!items.has('wardenbellows')) issue('the Warden\'s bellows not given for the jets it had');
      if (!game.flag('box.incal.temple.jetpack')) issue('the Warden’s Well chest is shut again');
    },
  },
  {
    name: 'stuck on Vael’s old “ride her” step (the bird never ridden)',
    data: {
      flags: { ...SHAFT_DONE, 'ship.level': 'arzach', 'quest.arzach.bird': 'ride', 'arzach.watcher.met': true, 'arzach.glyph.drawn': true, 'met.oia': true, 'quest.tracked': 'arzach.bird' },
      keepsakes: [KEEP.desert, KEEP.incal],
    },
    journal: { stories: { desert: {}, incal: {} }, seen: { desert: 1, incal: 1, arzach: 1 } },
    known: ['desert', 'arzach', 'perdide', 'incal'],
    knownAfter: ['desert', 'arzach', 'perdide', 'edena', 'incal'],
    // (moved on to the wind: the step and Oïa send it to the Aerie for the wings first)
    play: { world: 'arzach', quests: [{ temple: 'gadget' }, 'arzach.bird'], stage: 'tower' },
    after: (issue) => { if (game.flag('arzach.rode')) issue('it rode the bird it never had'); },
  },
  {
    // (the old route charted Vael beside the City-Shaft: a player could go there straight from the desert)
    name: 'stuck on Vael’s old “ride her” step, come straight from the desert (no jets)',
    data: {
      flags: { ...DESERT_DONE, 'ship.level': 'arzach', 'quest.arzach.bird': 'ride', 'arzach.watcher.met': true, 'arzach.glyph.drawn': true, 'met.oia': true, 'quest.tracked': 'arzach.bird' },
      keepsakes: [KEEP.desert],
    },
    journal: { stories: { desert: {} }, seen: { desert: 1, arzach: 1 } },
    known: ['desert', 'arzach', 'perdide'],
    knownAfter: ['desert', 'arzach', 'perdide', 'edena'],
    play: { world: 'arzach', quests: [{ temple: 'gadget' }, 'arzach.bird'], stage: 'tower' },
    after: (issue) => { if (items.has('jetpack')) issue('it was given the jets'); },
  },
  {
    name: 'mid-desert, before the reorder: the water running, the well still to watch',
    data: {
      flags: {
        'prologue.done': true, 'charge.given': true, 'save.migrated': 1, 'items.v': 2, 'item.backpack': true, 'box.desert.backpack': true, 'tool.empty': false, 'tool.colours': 2, 'desert.quest.v': 3,
        'quest.desert.power': 'rise', 'desert.city.entered': true, 'desert.elder.heard': true, 'desert.well.seen': true, 'desert.jar.given': true, 'desert.speaker.heard': true,
        'desert.cave.seen': true, 'desert.channel.open': true, 'desert.jar.filled': true, 'item.water': 1, 'met.nour': true, 'met.ama': true, 'quest.tracked': 'desert.power',
      },
      keepsakes: [],
    },
    journal: { stories: {}, seen: { desert: 1 } },
    known: ['desert', 'arzach', 'perdide'],
    play: { world: 'desert', quests: ['desert.power'], stage: 'rise' },
  },
  {
    // (its water had risen: the tree saw it burn then, so the spark-stone's errand is skipped)
    name: 'mid-desert, from the first desert: the channel open, the jar to fill at the pool',
    data: { flags: { 'prologue.done': true, 'quest.desert.power': 'fill', 'desert.jar.given': true, 'desert.speaker.heard': true, 'desert.cave.seen': true, 'desert.channel.open': true, 'item.jar': 1, 'quest.tracked': 'desert.power' }, keepsakes: [] },
    journal: { stories: {}, seen: { desert: 1 } },
    known: ['desert', 'arzach', 'perdide'],
    play: { world: 'desert', quests: ['desert.power'], stage: 'fill' },
    after: (issue) => {
      if (!game.flag('desert.tree.lit')) issue('the tree it saw burn is cold');
      // hearth.seen now marks the shared Rose interior; visiting it for missing equipment is valid.
      assert.ok(!game.flag('desert.stone.taken'), 'a previously lit tree does not require the stone again');
      for (const s of ['spark', 'bike', 'stone']) if (game.flag(`desert.${s}.heard`) || game.flag(`desert.${s}.seen`) || game.flag(`desert.${s}.taken`)) issue(`it was sent on the spark-stone's errand (${s})`);
    },
  },
  {
    name: 'mid-desert, from the first desert (no items, a jar and the Speaker next)',
    data: { flags: { 'prologue.done': true, 'quest.desert.power': 'speaker', 'desert.jar.given': true, 'item.jar': 1, 'met.ama': true, 'quest.tracked': 'desert.power' }, keepsakes: [] },
    journal: { stories: {}, seen: { desert: 1 } },
    known: ['desert', 'arzach', 'perdide'],
    play: { world: 'desert', quests: ['desert.power'], stage: 'elder' },
    after: (issue) => {
      if (!items.has('backpack')) issue('a save from before the items lost the backpack');
      if (!items.has('doublejump')) issue('the old save skipped the valve needed to cross the Rose House');
      if (!game.flag('temple.desert.done')) issue('the old save took the spring stone without reaching the Keeper');
      if (game.flag('tool.empty')) issue('its tank was emptied');
    },
  },
];

for (const S of SAVES) {
  test(`an old save resumes: ${S.name}`, async () => {
    const issues = [];
    const issue = (text) => issues.push(text);
    A.loadSave(S.data);
    const journal = A.memoryJournal(S.journal);
    // the chart: what it had stays, and the route goes on from it
    const flag = (k) => game.flag(k);
    const chart = () => knownWorlds({ order: A.ORDER, done: (id) => !!flag(`world.${id}.done`) || journal.storyDone(id), visited: (id) => journal.seen.has(id) });
    assert.deepEqual(chart(), S.known, 'the worlds on the chart');
    assert.equal(A.homeOpen({ flag, completed: A.completedWorlds(A.ORDER, { flag, storyDone: journal.storyDone }) }), false, 'home not yet');
    // the world it stood in, played on from where it was
    const W = A.loadWorld(S.play.world, { journal, report: (i) => issues.push(`[${i.kind}] ${i.quest} ${i.stage}: ${i.text}`) });
    const main = S.play.quests.find((q) => typeof q === 'string');
    if (S.play.stage) assert.equal(W.quests.stage(main), S.play.stage, `${main} resumes at "${S.play.stage}"`);
    const fallback = W.boxes.list.filter((b) => b.fallback).map((b) => b.item);
    assert.deepEqual(fallback, [], 'no fallback box for what it carries already');
    for (const p of S.play.quests) {
      if (p.temple) { await A.templeTo(W, p.temple, (k, t) => issue(`[${k}] ${t}`), { nextSpot: (await import('../src/temples/index.js')).nextSpot }); continue; }
      const r = await A.playQuest(W, p, { solvers: SOLVERS, ways: WAYS, checks: CHECKS, each });
      if (process.env.PLAYTHROUGH_VERBOSE) console.log(`  ${p}${r.done ? ' (done)' : ' (NOT DONE)'}:\n    ${r.steps.join('\n    ')}`);
    }
    S.after?.(issue);
    if (S.knownAfter) assert.deepEqual(chart(), S.knownAfter, 'and once it is done, the route goes on');
    assert.equal(game.flag(`world.${S.play.world}.done`), true, `${S.play.world} done`);
    W.dispose();
    for (const i of issues) console.log(`  ISSUE ${i}`);
    assert.deepEqual(issues, []);
  });
}


test('Rose main equipment guidance follows reachable work after the blade, not the shield behind unopened gates', async () => {
  A.loadSave({ flags: { 'save.migrated': MIGRATED(), 'desert.quest.v': 7, 'prologue.done': true,
    'quest.desert.power': 'blade', 'item.backpack': true, 'item.doublejump': true,
    'desert.bike.found': true, 'desert.pool.tinted': true, 'desert.door.open': true }, keepsakes: [] });
  const issues = [], W = A.loadWorld('desert', { journal: A.memoryJournal() });
  try {
    const { nextSpot } = await import('../src/temples/index.js');
    await A.templeTo(W, 'gadget', (kind, text) => issues.push(`${kind}: ${text}`), { nextSpot, id: 'desert' });
    W.step(2);
    assert.equal(W.quests.stage('desert.power'), 'guard');
    assert.equal(W.level.temple.logic.next(), 'ballK');
    const target = A.objectiveNow(W).raw.position;
    assert.ok(target.distanceTo(nextSpot(W.level.temple)) < .01, 'main quest targets the next actionable House piece');
    assert.ok(target.distanceTo(new (await import('three')).Vector3(...W.level.temple.findSites.guard.at)) > 20, 'the locked shield chest is not the current route target');
    A.walkCheck(W, W.player.pos, target, text => issues.push(text));
    assert.deepEqual(issues, [], 'ordinary walking reaches the marked work before closed wing gates');
    await A.templeTo(W, 'done', (kind, text) => issues.push(`${kind}: ${text}`), { nextSpot, id: 'desert' });
    assert.equal(W.level.temple.logic.resolved, true);
    // A pre-consolidation completed House can be missing the newly moved gun.
    game.set('item.gun', false); game.set('box.desert.gun', false); game.set('temple.desert.found.gun', false);
    assert.equal(W.level.temple.logic.next(), 'gun', 'resolved legacy House still points to its unearned gun');
    assert.ok(nextSpot(W.level.temple).distanceTo(new (await import('three')).Vector3(...W.level.temple.findSites.gun.at)) < .01);
    assert.deepEqual(issues, []);
  } finally { W.dispose(); }
});

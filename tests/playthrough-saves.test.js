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
const SAVES = [
  {
    name: 'the jets and the City-Shaft done (the old second world), back at the ship',
    data: { flags: { ...SHAFT_DONE, 'ship.level': 'incal' }, keepsakes: [KEEP.desert, KEEP.incal] },
    journal: { stories: { desert: {}, incal: {} }, seen: { desert: 1, incal: 1 } },
    known: ['desert', 'arzach', 'perdide', 'incal'],
    play: { world: 'arzach', quests: [{ temple: 'gadget' }, 'arzach.bird'] },
    knownAfter: ['desert', 'arzach', 'arzach2', 'perdide', 'incal'],
    after: (issue) => {
      // (v1.38: the jets anywhere are a debug item: the save keeps the Warden's harness, the City-Shaft's own)
      if (items.has('jetpack')) issue('the debug jets kept in play');
      if (!items.has('harness')) issue('the Warden\'s harness not given for the jets it had');
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
    knownAfter: ['desert', 'arzach', 'arzach2', 'perdide', 'incal'],
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
    knownAfter: ['desert', 'arzach', 'arzach2', 'perdide'],
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
      for (const s of ['spark', 'bike', 'hearth', 'stone']) if (game.flag(`desert.${s}.heard`) || game.flag(`desert.${s}.seen`) || game.flag(`desert.${s}.taken`)) issue(`it was sent on the spark-stone's errand (${s})`);
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

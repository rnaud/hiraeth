// People outside the quests only talk: no answers, one to three lines, then the talk ends
// (src/story/dialogue.js pickListen). Every world's bystanders and crowd people are such
// talks; their lines are tagged with tones, vary from one talk to the next, and some of them
// react to what you've done (the temple, the world's main quest).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { DialogueRunner, Dialogue, pickListen, choiceHtml } from '../src/story/dialogue.js';
import { parseLine } from '../src/story/tone.js';

const SRC = new URL('../src/', import.meta.url);
const DATA = readdirSync(new URL('story/', SRC)).filter((f) => f.endsWith('-data.js'));
const { CONTENT } = await import('../src/levels/content.js');
const mod = {};
for (const f of DATA) mod[f.replace('-data.js', '')] = await import(new URL(`story/${f}`, SRC));
// (the Sealed Hangar's, dismissed in October 2026, kept with its world: src/levels/dismissed/hangar/)
mod.garage = await import(new URL('levels/dismissed/hangar/story-data.js', SRC));

/** A save and a quest log in a few lines: flags, items (item.<id>) and quests (quest.<id> = stage | 'done'). */
function world(flags = {}) {
  const F = { ...flags };
  const game = { flag: (k) => F[k], set: (k, v) => { F[k] = v; }, emit() {}, on() { return () => {}; }, flags: F };
  const quests = {
    stage: (q) => F[`quest.${q}`], has: (i) => !!F[`item.${i}`], isDone: (q) => F[`quest.${q}`] === 'done',
    isActive: (q) => F[`quest.${q}`] !== undefined && F[`quest.${q}`] !== 'done', isStarted: (q) => F[`quest.${q}`] !== undefined, reached: () => false,
  };
  return { game, quests };
}

/** Every listen-only talk in the game: [where, person]. */
const ALL = [];
const seen = new Set();
function walk(v, where) {
  if (!v || typeof v !== 'object' || seen.has(v)) return;
  seen.add(v);
  if (v.talk?.listen) { ALL.push([where, v]); return; }
  for (const [k, x] of Object.entries(v)) if (k !== 'talk') walk(x, `${where}.${k}`);
}
for (const [w, m] of Object.entries(mod)) for (const [k, v] of Object.entries(m)) walk(v, `${w}:${k}`);
for (const [id, c] of Object.entries(CONTENT)) walk(c.npcs, `content.${id}`);

const entryOf = (e) => (e && typeof e === 'object' && !Array.isArray(e) && 'say' in e ? e : { say: e });

test('listen: the people outside the quests only talk, in every world that has them', () => {
  const listening = (p) => !!p?.talk?.listen;
  const named = [
    mod.desert.PEOPLE.sefa, mod.desert.PEOPLE.bako, mod.desert.VILLAGER_TALK,
    ...CONTENT.desert.npcs.filter((n) => ['ysa', 'ennor', 'tamsin'].includes(n.id)),
    mod.incal.RIM.corvin, mod.incal.RIM.hask,
    mod.arzach.LOCALS.find((p) => p.id === 'tam'),
    ...mod.garage.LOCALS,
    mod.buried.PEOPLE.pim, mod.spheres.PEOPLE.ivo,
    mod.bazaar.STREET.doss, mod.bazaar.STREET.teb,
  ];
  assert.equal(named.length, 16);
  assert.deepEqual(named.filter((p) => !listening(p)).map((p) => p?.id ?? p?.name), [], 'bystanders offer no answers');
  for (const w of ['desert', 'incal', 'bazaar']) {
    const crowd = Object.values(mod[w].CROWD_TALK).flat();
    assert.ok(crowd.length >= 5);
    assert.deepEqual(crowd.filter((p) => !listening(p)).map((p) => p.name), [], `${w}: nobody in the crowd asks you anything`);
  }
  // and the people in the quests still have their conversations
  for (const p of [mod.desert.PEOPLE.ama, mod.desert.PEOPLE.hessa, mod.incal.RIM.lio, mod.bazaar.STREET.oyo, mod.arzach.LOCALS.find((l) => l.id === 'senn')]) assert.ok(p.talk.nodes, `${p.id} keeps their answers`);
  assert.ok(ALL.length >= 45, `${ALL.length} listen-only talks`);
});

test('listen: every entry is one to three lines, each with its tone; a talk has a few to cycle through', () => {
  const bad = [];
  for (const [where, p] of ALL) {
    const list = p.talk.listen;
    if ('nodes' in p.talk || 'entry' in p.talk) bad.push(`${where}: a listen talk with nodes`);
    const always = list.filter((e) => !(entryOf(e).if || entryOf(e).after));
    if (list.length < 3) bad.push(`${where}: only ${list.length} entries`);
    if (always.length < 2) bad.push(`${where}: fewer than two entries always open (they'd repeat)`);
    for (const [i, e] of list.entries()) {
      const { say, choices } = entryOf(e);
      if (choices) bad.push(`${where}[${i}]: choices`);
      const lines = [say].flat();
      if (lines.length < 1 || lines.length > 3) bad.push(`${where}[${i}]: ${lines.length} lines`);
      for (const l of lines) if (!parseLine(l).explicit) bad.push(`${where}[${i}]: untagged “${String(l).slice(0, 40)}”`);
      if (lines.join(' ').length > 330) bad.push(`${where}[${i}]: too long for a passing word`);
    }
  }
  assert.deepEqual(bad, []);
});

test('listen: no answers on any page, and the press after the last line ends the talk', () => {
  for (const [where, p] of ALL) {
    const ctx = world();
    const r = new DialogueRunner({ ...p, id: p.id ?? where }, ctx);
    assert.ok(!r.ended && r.text.length > 2, `${where} says something`);
    for (let k = 0; k < 4 && !r.ended; k++) {
      assert.deepEqual(r.choices(), [], `${where}: no answers`);
      r.advance();
    }
    assert.ok(r.ended, `${where}: over after its lines`);
    assert.equal(r.advance(), false);
  }
});

test('listen: talking again gives the next thing they say, never the same twice running', () => {
  for (const [where, p] of ALL) {
    // before anything, and after everything (every flag they read set, every quest done)
    const late = {};
    const atoms = (c) => { if (!c || typeof c !== 'object') return; if (Array.isArray(c)) return c.forEach(atoms); if (c.flag) late[c.flag] = true; if (c.quest) late[`quest.${c.quest}`] = 'done'; [c.all, c.any, c.not].forEach(atoms); };
    for (const e of p.talk.listen) { atoms(entryOf(e).if); atoms(entryOf(e).after); }
    for (const flags of [{}, late]) {
      const ctx = world(flags), person = { ...p, id: p.id ?? where };
      const said = [];
      for (let k = 0; k < 8; k++) said.push(new DialogueRunner(person, ctx).pages.join(' '));
      for (let k = 1; k < said.length; k++) assert.notEqual(said[k], said[k - 1], `${where}: the same twice running`);
      assert.ok(new Set(said).size >= Math.min(3, p.talk.listen.length - 1), `${where}: varies (${new Set(said).size})`);
    }
  }
});

test('listen: news first (once it holds, once), conditions keep entries out, effects run, people sharing a list keep apart', () => {
  const p = { id: 'pat', talk: { listen: [
    '~neutral~ One.', '~neutral~ Two.',
    { if: { flag: 'early' }, say: '~neutral~ Only early.' },
    { after: { quest: 'q', done: true }, say: ['~happy~ You did it!', '~playful~ I heard.'] },
    { say: '~happy~ (plays)', do: { set: { played: true } } },
  ] } };
  const ctx = world({ early: true });
  const heard = () => new DialogueRunner(p, ctx).pages.join(' ');
  const first = [heard(), heard(), heard(), heard()];
  assert.ok(first.includes('Only early.'));
  assert.ok(!first.some((s) => s.includes('did it')), 'news only once it holds');
  assert.ok(first.includes('(plays)') && ctx.game.flag('played'), 'an entry’s effects run when it is said');
  ctx.game.set('early', false);
  ctx.game.set('quest.q', 'done');
  assert.equal(heard(), 'You did it! I heard.', 'the news jumps the queue');
  const after = Array.from({ length: 6 }, heard);
  assert.ok(!after.includes('You did it! I heard.') || after.indexOf('You did it! I heard.') > 0, 'then it is just one of the others');
  assert.ok(!after.includes('Only early.'));
  // remembered in the save, by `heard` when given (a crowd's people share an id)
  assert.equal(typeof ctx.game.flag('heard.pat'), 'number');
  const a = { ...p, heard: 'crowd.x.0' };
  pickListen(a, ctx); pickListen(a, ctx);
  assert.equal(typeof ctx.game.flag('heard.crowd.x.0'), 'number');
  assert.equal(ctx.game.flag('heard.crowd.x.1'), undefined);
  // nothing open: nothing to say, the talk doesn't open
  assert.equal(new DialogueRunner({ id: 'none', talk: { listen: [{ if: () => false, say: '~neutral~ x' }] } }, ctx).ended, true);
});

test('listen: the panel closes on the press after the last line, with no answers shown', () => {
  const { game, quests } = world();
  game.emit = () => {};
  const d = new Dialogue({ game, quests });
  const person = { id: 'x', name: 'X', talk: { listen: [['~neutral~ One page.', '~neutral~ Two pages.'], '~neutral~ Other.'] } };
  for (let k = 0; k < 2; k++) {
    assert.ok(d.start(person, null));
    let presses = 0;
    while (d.open && presses < 10) { d.revealed = d.runner.text.length; assert.deepEqual(d.runner.choices(), []); d.next(); presses++; }
    assert.ok(!d.open, 'closed');
    assert.ok(presses <= 2, `${presses} presses`);
  }
});

test('answers: the mark sits in its own column, apart from the words', () => {
  const html = choiceHtml({ index: 3, text: '~curious~ What is *that* tree?' }, 0, 'A / ×');
  assert.match(html, /^<button data-i="3"><span class="dlg-key" aria-hidden="true"><b class="dlg-num">1<\/b><b class="dlg-mark">›<\/b><b class="key">A \/ ×<\/b><\/span><span class="dlg-say">What is <em>that<\/em> tree\?<\/span><\/button>$/);
});

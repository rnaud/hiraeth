// The detour worlds' traces (src/story/sightings-detours.js): one a world off the route, each told once by a
// person of that world or by a mark in it (its content's `traces`), and written down in the Sightings page.
// They hint at whoever came this way before; they never name her.
import test from 'node:test';
import assert from 'node:assert/strict';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { DETOUR_SIGHTINGS } = await import('../src/story/sightings-detours.js');
const { seen, THREADS } = await import('../src/story/sightings.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { parseLine, TONES } = await import('../src/story/tone.js');
const { CONTENT } = await import('../src/levels/content.js');
const { SIDE, SUB } = await import('../src/levels/names.js');

/** The talkers of a world's content: its people with a talk, and its traces' persons. */
const talkers = (world) => [
  ...(CONTENT[world].npcs ?? []).filter((n) => n.talk).map((n) => ({ person: n, where: `npc ${n.id}` })),
  ...(CONTENT[world].traces ?? []).map((t) => ({ person: t.person, where: `trace ${t.id}`, trace: t })),
];
/** Every { say, do } a talk holds: its nodes, or its listen entries. */
const entries = (talk) => [
  ...Object.values(talk.nodes ?? {}).map((n) => ({ say: n.say, do: n.do })),
  ...(talk.listen ?? []).map((e) => (e && typeof e === 'object' && !Array.isArray(e) && 'say' in e ? e : { say: e })),
];
const setsOf = (effects) => [].concat(effects ?? []).flatMap((e) => Object.keys(e?.set ?? {}));
const lines = (say) => [].concat(say ?? []).flat();

/** A save in memory, enough for the dialogue and the sightings. */
function fakeGame() {
  const flags = new Map();
  return { flags, flag: (k) => flags.get(k), set: (k, v) => flags.set(k, v), on: () => () => {}, emit() {}, addKeepsake: () => true };
}
const QUESTS = { start() {}, advance() {}, set() {}, give() {}, take() {}, track() {}, fail() {}, stage: () => null, active: () => false, done: () => false };

test('every detour world has exactly one trace, in a real thread, its id its own', () => {
  const ids = new Set();
  for (const s of DETOUR_SIGHTINGS) {
    assert.ok(SIDE.includes(s.world) || Object.hasOwn(SUB, s.world), `${s.id}: ${s.world} is a detour world (or a sub-level: the Overnight Train)`);
    assert.ok(s.id.startsWith(`${s.world}.`), `${s.id} starts with its world`);
    assert.ok(THREADS.some((t) => t.id === s.thread), `${s.id}: thread ${s.thread}`);
    assert.ok(!s.heard && !s.flag, `${s.id} is met by its own flag`);
    assert.ok(s.who && s.line && s.line.length < 160, `${s.id}: who and a short line`);
    assert.ok(!ids.has(s.id)); ids.add(s.id);
  }
  for (const w of SIDE) assert.equal(DETOUR_SIGHTINGS.filter((s) => s.world === w).length, 1, `${w} has one trace`);
});

test('each trace is set by exactly one line of its world, and every line there has a tone', () => {
  for (const s of DETOUR_SIGHTINGS) {
    const flag = `sight.${s.id}`;
    const setters = talkers(s.world).flatMap(({ person, where }) => entries(person.talk).filter((e) => setsOf(e.do).includes(flag)).map((e) => ({ where, e })));
    assert.equal(setters.length, 1, `${s.id}: set once (${setters.map((x) => x.where).join(', ')})`);
    for (const l of lines(setters[0].e.say)) {
      const p = parseLine(l);
      assert.ok(p.explicit && TONES.includes(p.tone), `${s.id}: a tone on "${String(l).slice(0, 50)}"`);
    }
  }
  // (and the traces' own talk, which tone.test.js doesn't walk)
  for (const w of SIDE) for (const t of CONTENT[w].traces ?? []) {
    assert.ok(t.person?.id && t.person?.name && Array.isArray(t.at) && t.at.length === 3, `${w}/${t.id}: a person and a place`);
    for (const e of entries(t.person.talk)) for (const l of lines(e.say)) assert.ok(parseLine(l).explicit, `${w}/${t.id}: a tone on "${String(l).slice(0, 50)}"`);
  }
});

test('they hint, never tell: no name, no "sister"', () => {
  for (const s of DETOUR_SIGHTINGS) {
    const said = talkers(s.world).flatMap(({ person }) => entries(person.talk).flatMap((e) => lines(e.say).map((l) => parseLine(l).text)));
    for (const t of [s.line, s.who, ...said]) assert.ok(!/ilen|sister/i.test(t), `${s.world}: "${t.slice(0, 60)}"`);
  }
});

test('talking to the trace (a person, or looking at a mark) writes it down', () => {
  for (const s of DETOUR_SIGHTINGS) {
    const flag = `sight.${s.id}`;
    const { person } = talkers(s.world).find(({ person: p }) => entries(p.talk).some((e) => setsOf(e.do).includes(flag)));
    const game = fakeGame();
    assert.equal(seen(s.id, game), false, `${s.id}: not seen before`);
    const run = new DialogueRunner(person, { game, quests: QUESTS });
    assert.ok(run.pages.length >= 1 && run.pages.length <= 3, `${s.id}: 1–3 pages`);
    assert.equal(game.flag(flag), true, `${s.id}: the first talk tells it`);
    assert.equal(seen(s.id, game), true, `${s.id}: seen`);
    while (run.advance());
  }
});

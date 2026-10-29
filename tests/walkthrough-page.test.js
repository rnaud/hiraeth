// The walkthrough page (walkthrough.html, src/walkthrough-page/; issue #777): its steps' shape, the parts against the route
// and its temples, the buttons in Xbox / PlayStation form, the page drawn with and without a daily result, and where it is
// linked, built and packaged. Whether each step is what the game plays is tests/playthrough.test.js's (tests/walkthrough.js),
// every push and every day. docs/systems/testing.md, "The walkthrough".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './register-gadgets.js';
import { WALKTHROUGH, HOW, PROOF, stepsOf } from '../src/walkthrough-page/steps.js';
import { walkthroughPage } from '../src/walkthrough-page/view.js';
import { ORDER } from '../src/levels/names.js';
import { TEMPLES, templeWorld } from '../src/temples/index.js';
import { PAGES } from '../src/world-picker.js';
import { BUILD_INPUT } from '../scripts/build-input.mjs';
import { siteOnly } from '../scripts/content-policy.mjs';
import { checkPart, statusFile } from './walkthrough.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const ID = /^([a-z0-9]+\.[a-z0-9]+:[a-zA-Z0-9.]+|temple:[a-z0-9]+:[a-zA-Z0-9]+(@[a-zA-Z0-9]+)?|act:[a-zA-Z]+|ship:[a-z0-9]+|home:(first|final))$/;
const BUTTON = /\b(A \/ ×|B \/ ○|X \/ □|Y \/ △|RT \/ R2|LT \/ L2|RB \/ R1|LB \/ L1|L3|R3|D-pad [↑↓←→])/g;

test('the parts: every world on the route in its order, then home, the Lantern and the true ending, each with the play-through test that plays it', () => {
  assert.deepEqual(WALKTHROUGH.map((p) => p.id), [...ORDER, 'home', 'lantern', 'ending']);
  ORDER.forEach((id, k) => assert.equal(WALKTHROUGH[k].test, `${k + 1}. ${id}`, `${id}: tests/playthrough.test.js names it so`));
  const pt = read('tests/playthrough.test.js');
  for (const p of WALKTHROUGH.slice(ORDER.length)) {
    const rest = p.test.replace(/^\d+\. /, '');
    assert.ok(pt.includes(rest), `${p.id}: the play-through has a test “${p.test}”`);
  }
  for (const p of WALKTHROUGH) assert.ok(p.title && p.short && p.intro, `${p.id}: a title, a short name and an intro`);
});

test('every step: a traced id, a known way of doing it, words a player can follow', () => {
  for (const p of WALKTHROUGH) {
    const steps = stepsOf(p);
    assert.ok(steps.length >= 2, `${p.id}: steps`);
    for (const s of steps) {
      const at = `${p.id} ${s.id}`;
      assert.match(s.id, ID, `${at}: an id the play-through traces`);
      assert.ok(HOW[s.how], `${at}: how “${s.how}” is one of HOW`);
      assert.ok(s.say?.length > 12 && /[.!?)]$/.test(s.say.trim()), `${at}: a sentence`);
      assert.doesNotMatch(s.say, /—/, `${at}: no em dash`);
      // the buttons as AGENTS.md writes them (src/native-pad.js renames them on a handheld): never a keyboard key or a click
      assert.doesNotMatch(`${s.say} ${s.note ?? ''}`, /\b(press|hold|tap) (E|F|Q|Space|Shift|Enter)\b|\bclick\b|\(E\)|\bspacebar\b/i, `${at}: buttons in Xbox / PlayStation form`);
    }
  }
  const buttons = new Set(WALKTHROUGH.flatMap(stepsOf).flatMap((s) => s.say.match(BUTTON) ?? []));
  for (const b of ['X / □', 'A / ×', 'RT / R2', 'RB / R1', 'LB / L1']) assert.ok(buttons.has(b), `the guide uses ${b}`);
});

test('every temple of every world is walked through in its world’s part, under its own heading', () => {
  for (const [id, T] of Object.entries(TEMPLES)) {
    const world = templeWorld(id), part = WALKTHROUGH.find((p) => p.id === world) ?? WALKTHROUGH.find((p) => p.steps.some((s) => s.temple === id));
    assert.ok(part, `${id}: a part`);
    const head = part.steps.find((s) => s.temple === id);
    assert.ok(head, `${id}: a heading in ${part.id}`);
    assert.equal(head.name, T.def.name, `${id}: its name (the temple and guardian tests are named by it)`);
    const own = stepsOf(part).filter((s) => s.id.startsWith(`temple:${id}:`));
    assert.ok(own.length >= 5, `${id}: its steps`);
    const boss = Object.entries(T.def.logic.elements).find(([, e]) => e.type === 'boss')?.[0];
    assert.equal(own.at(-1).id, `temple:${id}:${boss}`, `${id}: ends with its guardian`);
    assert.equal(own.at(-1).how, 'guardian');
    assert.match(PROOF.temple.name(id, head.name), new RegExp(`\\(${id}\\), played through for real`));
  }
  assert.match(read('tests/temple-playthrough.test.js'), /\$\{TEMPLES\[id\]\.def\.name \?\? id\} \(\$\{id\}\), played through for real: every ball rolled by real hits, its timers running, what it lights lit by it/);
  assert.match(read('tests/guardian-completable.test.js'), /\$\{TEMPLES\[id\]\.def\.name \?\? id\}’s guardian \(\$\{id\}\): combat offers a way in from every stance; helping guardians wait without attacking/);
});

test('the check: the same steps in the same order, done the same way, or the part fails at its first step that broke', () => {
  const part = WALKTHROUGH[0], want = stepsOf(part).map(({ id, how }) => ({ id, how }));
  assert.equal(checkPart(part.id, want, part.test).ok, true);
  const swapped = [...want]; [swapped[3], swapped[4]] = [swapped[4], swapped[3]];
  const r = checkPart(part.id, swapped, part.test);
  assert.equal(r.ok, false);
  assert.match(r.message, /broke at its step 4/);
  assert.deepEqual(r.steps.slice(0, 5).map((s) => s.ok), [true, true, true, false, false]);
  assert.match(checkPart(part.id, want.map((s, i) => (i === 2 ? { ...s, how: 'logic' } : s)), part.test).message, /step 3/, 'done another way');
  assert.match(checkPart(part.id, want.slice(0, -1), part.test).message, /the guide has \d+ steps, the play-through \d+/);
  assert.match(checkPart(part.id, want, 'another test').message, /names the test/);
  const st = statusFile([r], { rev: 'abc' });
  assert.equal(st.kind, 'hiraeth-walkthrough-status');
  assert.equal(st.ok, false);
  assert.equal(st.parts[0].steps.length, want.length);
});

test('the page: every part and step, the test that proves each, the buttons as badges; the daily run’s marks when there is one', () => {
  const { nav, main, count } = walkthroughPage();
  assert.equal(count, WALKTHROUGH.reduce((n, p) => n + stepsOf(p).length, 0));
  for (const p of WALKTHROUGH) { assert.ok(nav.includes(`href="#${p.id}"`), p.id); assert.ok(main.includes(`“${p.test}”`), `${p.id}: its test named`); }
  assert.match(main, /<b class="key">X \/ □<\/b>/);
  assert.match(main, /tests\/temple-playthrough\.test\.js/);
  assert.match(main, /This copy has no daily result/);
  assert.doesNotMatch(main, /class="mark/);
  // a day on which the Desert broke at its third step
  const parts = WALKTHROUGH.map((p) => checkPart(p.id, stepsOf(p).map(({ id, how }) => ({ id, how })), p.test));
  parts[0] = checkPart('desert', stepsOf(WALKTHROUGH[0]).map(({ id, how }, i) => (i === 2 ? { id, how: 'logic' } : { id, how })), WALKTHROUGH[0].test);
  const marked = walkthroughPage({ status: statusFile(parts, { rev: 'abc', at: '2026-10-29' }) }).main;
  assert.match(marked, /some steps broke/);
  assert.match(marked, /broke in the last daily run: the walkthrough's part &quot;desert&quot;/);
  assert.equal((marked.match(/class="mark ok"/g) ?? []).length, count - stepsOf(WALKTHROUGH[0]).length + 2);
  assert.ok((marked.match(/class="mark bad"/g) ?? []).length >= 1);
});

test('linked like the lore page, built, and its daily result the site’s alone', () => {
  assert.ok(PAGES.some((p) => p.href === 'walkthrough.html' && p.label === 'Walkthrough'), 'Debug → Pages → Walkthrough');
  assert.match(BUILD_INPUT.walkthrough, /walkthrough\.html$/);
  assert.match(read('notes.html'), /href="\.\/walkthrough\.html"/);
  assert.match(read('lore.html'), /href="walkthrough\.html"/);
  const html = read('walkthrough.html');
  assert.match(html, /<script type="module" src="\/src\/walkthrough-page\/main\.js"><\/script>/);
  assert.ok(siteOnly('walkthrough/status.json') && !siteOnly('walkthrough.html'), 'the page ships; the daily result is the site’s');
  assert.match(read('src/walkthrough-page/main.js'), /fetch\('\.\/walkthrough\/status\.json'/);
  for (const wf of ['deploy.yml', 'cloudflare.yml']) assert.match(read(`.github/workflows/${wf}`), /scripts\/walkthrough-status\.sh dist/, `${wf} puts the daily result on the site`);
});

test('daily: the completion job plays the route with its evidence (walkthrough-status.json beside it), and the temple and guardian tests run in the full suite', () => {
  const y = read('.github/workflows/nightly-tests.yml');
  assert.match(y, /PLAYTHROUGH_OUT: completion-evidence\/node/);
  assert.match(y, /node --test tests\/completion\.test\.js tests\/playthrough\.test\.js/);
  assert.match(y, /uses: \.\/\.github\/workflows\/tests\.yml\s+with:\s+full: true/);
  assert.match(read('scripts/walkthrough-status.sh'), /completion-evidence/);
});

// The loading screen's words and bar (issue #506; src/load-page.js): the bar moves with main.js's real steps, in their
// order, never back; each step's "why" is short; the page and the engines tell the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOAD_PLAN, LOAD_WHY, LOAD_WORD, loadShare, loadProgress, loadWords, stageIndex } from '../src/load-page.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

/** A file's stages and steps in source order: [['stage', line] | ['step', name]]. */
function sequence(src, stageRe, stepRe) {
  const out = [];
  const re = new RegExp(`${stageRe.source}|${stepRe.source}`, 'g');
  for (const m of src.matchAll(re)) out.push(m[1] != null ? ['stage', m[1]] : ['step', m[2]]);
  return out;
}

test('main.js: every step it names is in the plan, under its stage, in the plan\'s order', () => {
  const seq = sequence(read('src/main.js'), /await stage\([`'"]([a-z]+)/, /setStep\('([^']+)'\)/);
  let stage = -1, last = -1, n = 0;
  for (const [kind, v] of seq) {
    if (kind === 'stage') { stage = stageIndex(v); assert.ok(stage >= 0, `a stage of the plan: ${v}`); last = -1; continue; }
    if (stage < 0) continue;
    const k = LOAD_PLAN[stage].steps.findIndex(([s]) => s === v);
    assert.ok(k >= 0, `${v} is a step of ${LOAD_PLAN[stage].stage}`);
    assert.ok(k > last, `${v} after the step before it`);
    last = k; n++;
  }
  assert.ok(n >= 25, `${n} steps checked`);
  // and the plan has no step main.js doesn't run
  const named = new Set(seq.filter(([k]) => k === 'step').map(([, v]) => v));
  for (const s of LOAD_PLAN) for (const [name] of s.steps) assert.ok(named.has(name), `${name} is run by main.js`);
});

test('the bar: 0 at the start, 1 when ready, never back through every stage and step; an unknown step keeps it', () => {
  assert.equal(loadShare('sketching the desert…'), 0);
  assert.equal(loadShare('ready'), 1);
  let p = -1;
  for (const s of LOAD_PLAN) {
    const line = `${s.stage} something…`;
    for (const [name] of s.steps) { const q = loadShare(line, name); assert.ok(q > p || (q === p && q === 0), `${s.stage} / ${name} ${q} after ${p}`); p = q; }
  }
  assert.ok(p < 1);
  const pr = loadProgress();
  pr.stage('mixing the inks…'); const a = pr.step('surfaces').p;
  assert.equal(pr.step('no such step').p, a);
  assert.equal(pr.stage('sketching again…').p, a, 'never back');
  assert.equal(pr.stage('ready').p, 1);
});

test('why: each line short, lower case, for a step of the plan; kept until another step has one', () => {
  const steps = new Set(LOAD_PLAN.flatMap((s) => s.steps.map(([n]) => n)));
  for (const [k, v] of Object.entries(LOAD_WHY)) {
    assert.ok(steps.has(k), `${k} is a step`);
    assert.ok(v.length <= 80 && v === v.trim() && /^[a-z]/.test(v) && !/[.!]$/.test(v), `${k}: "${v}"`);
  }
  assert.match(LOAD_WHY.surfaces, /graphics card/);
  const pr = loadProgress();
  pr.stage('mixing the inks…');
  assert.equal(pr.step('surfaces').why, LOAD_WHY.surfaces);
  assert.equal(pr.step('post').why, LOAD_WHY.surfaces, 'post has none of its own');
});

test('the page has the bar and the line, and main.js drives them; the engines tell the same steps', () => {
  const html = read('index.html'), main = read('src/main.js'), engine = read('engine/game.js');
  assert.match(html, /<div class="bar"[^>]*><i><\/i><\/div>/);
  assert.doesNotMatch(html, /class="why"/, 'no why line under it any more (issue #791)');
  assert.ok(main.includes('progress.step(name)') && main.includes('progress.stage(msg)'));
  const seq = sequence(engine, /\bstage\([`'"]([a-z]+)/, /\bstep\('([^']+)'\)/);
  let stage = -1, p = -1;
  for (const [kind, v] of seq) {
    if (kind === 'stage') { stage = stageIndex(v); assert.ok(stage >= 0, v); continue; }
    const q = loadShare(`${LOAD_PLAN[stage].stage} …`, v);
    assert.ok(LOAD_PLAN[stage].steps.some(([n]) => n === v), `engine: ${v} under ${LOAD_PLAN[stage].stage}`);
    assert.ok(q > p, `engine: ${v} moves the bar on`); p = q;
  }
  assert.ok(engine.includes('onLoad?.(o)') && engine.includes('onStage?.(text)'), 'onLoad gets { line, why, p }; onStage the line once a stage');
});

// issue #791: black, the circle and the bar in the bottom-right corner, the one word "Loading"; a failure still readable
test('the loading screen says "Loading" alone: no stage line, no why line, not even for the sound effects', () => {
  const html = read('index.html'), main = read('src/main.js');
  const block = html.slice(html.indexOf('<div id="loading">'), html.indexOf('<script>', html.indexOf('<div id="loading">')));
  assert.match(block, /<div class="msg" data-t="load\.word">Loading<\/div>/);
  assert.equal(block.replace(/<[^>]+>/g, '').trim(), 'Loading', 'the only words on it');
  assert.match(block, /<div class="pen" aria-hidden="true"><\/div>/, 'the turning circle');
  assert.match(block, /<div class="bar" aria-hidden="true"><i><\/i><\/div>/, 'the bar');
  // black, in the corner, the circle turning or (reduced motion) pulsing
  assert.match(html, /#loading \{[^}]*background: #000;/);
  assert.match(html, /#loading \.corner \{[^}]*position: absolute; right: [^;]+; bottom: [^;]+;/);
  assert.match(html, /#loading \.pen \{[^}]*animation: spin /);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\) \{ #loading \.pen \{ animation: load-pulse /);
  assert.match(html, /html\.reduce-motion #loading \.pen \{ animation: load-pulse /);
  // main.js no longer writes a stage's line or the effects' count into it; the bar still follows the steps
  assert.ok(!/loadMsg\.textContent = msg/.test(main), 'no stage line');
  assert.ok(!/Loading sound effects/.test(main), 'no sound effects count');
  assert.ok(!/#loading \.why/.test(main), 'no why line');
  assert.match(main, /loadBar\.style\.transform = `scaleX\(\$\{p\.toFixed\(3\)\}\)`/);
  // a failure's line still goes in its place, as an alert, and is drawn whole
  assert.match(main, /loadMsg\.textContent = 'The ship could not be loaded\. Reload to try again\.'; loadMsg\.setAttribute\('role', 'alert'\)/);
  assert.match(html, /#loading \.msg\[role="alert"\] \{ white-space: normal;/);
  assert.equal(read('src/i18n/en.js').match(/'load\.word': '([^']+)'/)?.[1], LOAD_WORD);
});

test('the bar still moves with the load as the screen says only "Loading"', () => {
  const seen = [];
  const pr = loadProgress((s) => seen.push(s.p));
  pr.stage('sketching the desert…'); pr.step('world'); pr.step('openings');
  pr.stage('inking the collisions…'); pr.step('bake'); pr.step('ship');
  pr.stage('waking the people…'); pr.step('traveller'); pr.step('story');
  pr.stage('mixing the inks…'); pr.step('surfaces'); pr.step('passage');
  pr.stage('ready');
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1], `never back at ${i}`);
  assert.ok(new Set(seen).size >= 8, `it moves: ${seen.map((p) => p.toFixed(2)).join(' ')}`);
  assert.equal(seen.at(-1), 1);
});

test('the title\'s waiting mark: "Loading" through the load, a failure\'s line as it is', () => {
  for (const l of ['', null, 'ready', 'sketching the golden dunes…', 'inking the collisions…', 'waking the people…', 'mixing the inks…', 'Loading sound effects 3/40'])
    assert.equal(loadWords(l), 'Loading', String(l));
  assert.equal(loadWords('Sound effects couldn’t load.'), 'Sound effects couldn’t load.');
  assert.equal(loadWords('The ship could not be loaded. Reload to try again.'), 'The ship could not be loaded. Reload to try again.');
  const title = read('src/title.js'), css = read('src/menus.css');
  assert.match(title, /what\.textContent = loadWords\(hold\.stage\)/);
  assert.match(css, /#title \.starting \{ position: absolute; z-index: 5; right: [^;]+; bottom: [^;]+;/);
  // the title goes black while it waits, as the loading screen (the author, 2026-10-30), the mark over it
  assert.match(css, /#title\.waiting::after \{ content: ''; position: absolute; inset: 0; z-index: 4; background: #000; \}/);
});

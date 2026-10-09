// A guard for the Steam Deck's "mixing the inks…" hang (53ac1e80): the load's GPU pacer waited its full
// 250 ms on fences the driver never signalled, 741 times. Every await of the load in src/main.js, from its
// first stage to 'ready', must be one of the waits known to end (a slice, the pacer that gives up, a frame
// with its fallback, a race with a timer, a poll with a cap, …). A new await there that is none of them fails
// here: give it a bound (a timer, a fallback) and add it to KNOWN with the reason it ends.
// The browser's own test of the same: scripts/load-smoke.mjs (fences that never signal, no frames at all).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const loadSteps = readFileSync(new URL('../src/load-steps.js', import.meta.url), 'utf8');

/** main.js without its comments (a // after code or at a line's start; the URLs in it have none before a space). */
const uncomment = (src) => src.split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');

/** The load's section: from the first `await stage(` to `stage('ready')`. */
function loadSection(src = main) {
  const code = uncomment(src);
  const from = code.indexOf('await stage(');
  const to = code.indexOf("stage('ready')");
  assert.ok(from > 0 && to > from, 'main.js: the load\'s stages (await stage(…) … stage(\'ready\')) not found');
  return { code, from, to, text: code.slice(from, to) };
}

// [what the await's expression starts with, why it ends, a check on the text round it (optional)]
const KNOWN = [
  [/^slice\(\)/, 'the slicer: a fresh task (MessageChannel) once its budget ran'],
  [/^gpuPace\(\)/, 'the GPU pacer: at most 250 ms a wait, gives up after 3 full waits or 3 s in all (tests/gpu-pacer.test.js)'],
  [/^stage\(/, 'a stage: nextFrame() (a frame or 250 ms) and a timeout'],
  [/^nextFrame\(/, 'a frame or its fallback timer'],
  [/^runStepsAsync\(/, 'a world\'s build: slices, and the promises its own steps yield (workers and assets with a way out)'],
  [/^Physics\.create\(/, 'the collisions: its build in slices, the BVH worker with a main-thread fallback'],
  [/^(animLib|humans|mhPeople|traveller)\b/, 'an asset load started earlier, its failure caught (null)'],
  [/^new GLTFLoader\(\)\.loadAsync\(/, 'an asset load, its failure caught', (after) => /\.catch\(/.test(after.split('\n')[0])],
  [/^warmShaders\(/, 'the race below: compileAsync or 2 s'],
  [/^warmShadersSliced\(/, 'slices and the pacer per kind, then the pending() poll with its 2 s cap'],
  [/^Promise\.race\(\[/, 'a race with a timer', (after) => /setTimeout\(/.test(after.slice(0, 300))],
  [/^new Promise\(\(r\) => setTimeout\(r, \d+\)\)/, 'a poll in a loop with a time cap', (_, line) => /while \(.*performance\.now\(\) - t0 < \d+/.test(line)],
];

test('every await between the first stage and \'ready\' in main.js is one known to end', () => {
  const { code, from, text } = loadSection();
  const unknown = [], found = new Map();
  for (const m of text.matchAll(/\bawait\s+/g)) {
    const at = from + m.index;
    const after = code.slice(at + m[0].length, at + m[0].length + 400);
    const line = code.slice(code.lastIndexOf('\n', at) + 1, code.indexOf('\n', at));
    const lineNo = code.slice(0, at).split('\n').length;
    const k = KNOWN.find(([re, , check]) => re.test(after) && (!check || check(after, line)));
    if (!k) unknown.push(`main.js:${lineNo}: await ${after.split('\n')[0].slice(0, 90)}`);
    else found.set(k[1], (found.get(k[1]) ?? 0) + 1);
  }
  assert.deepEqual(unknown, [], `waits in the load not known to end (give each a bound, then list it in tests/load-awaits.test.js KNOWN):\n${unknown.join('\n')}`);
  assert.ok(found.size >= 8, `the parser found too few kinds of await (${found.size}): did the load move?`);
});

test('the guard catches an unbounded wait', () => {
  const src = main.replace("stage('ready')", 'await new Promise((r) => gl.onFence(r));\nawait fetch(url);\nstage(\'ready\')');
  const { code, from, text } = loadSection(src);
  const bad = [...text.matchAll(/\bawait\s+/g)].filter((m) => {
    const at = from + m.index, after = code.slice(at + m[0].length, at + m[0].length + 400);
    const line = code.slice(code.lastIndexOf('\n', at) + 1, code.indexOf('\n', at));
    return !KNOWN.some(([re, , check]) => re.test(after) && (!check || check(after, line)));
  });
  assert.equal(bad.length, 2);
});

test('the known waits keep their bounds', () => {
  const code = uncomment(main);
  // stage() waits for nextFrame(), which falls back on a timer
  assert.match(code, /const stage = \(msg\) => \{[\s\S]*?return nextFrame\(\)/, 'stage() waits on nextFrame()');
  assert.match(loadSteps, /export function nextFrame\(fallback = \d+\)[\s\S]*?setTimeout\(go, fallback\)/, 'nextFrame() has its fallback timer');
  assert.match(loadSteps, /export function gpuPacer\(gl, \{[^}]*most = 250, giveUp = 3, budget = 3000/, 'the pacer gives up');
  // the pacer is made with its defaults (no option that lifts the bounds)
  assert.match(code, /const gpuPace = gpuPacer\(renderer\.getContext\(\)\);/);
  // the asset loads waited for are caught
  for (const name of ['animLib', 'traveller', 'humans', 'mhPeople']) {
    const def = code.match(new RegExp(`const ${name} = ([^\\n]*)`));
    assert.ok(def && /\.catch\(/.test(def[1]), `${name}: its failure caught`);
  }
  // the watchdog runs through the load and stops at its end
  assert.match(code, /const loadWatch = loadWatchdog\(/);
  assert.ok(code.indexOf('loadWatch.stop()') < code.indexOf("stage('ready')"));
});

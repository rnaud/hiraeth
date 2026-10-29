// A local `t` must not hide i18n's t() where it is called (issue #374): src/carry.js's pickUp(p, t) called t('hint.carry')
// with its own `t`, the thing being picked up; "t is not a function" was thrown out of the use button's handler the first
// time a save picked something up, and the frame loop, which asks for its next frame at its end, stopped: the game hung.
// A plain scan (no parser): in each file that imports t from i18n, every function whose parameters name a `t`, and every
// `for (const t …)` loop, must not call t( in its body.
import test from 'node:test';
import assert from 'node:assert/strict';
// (the source through its literal catalogue, checked against the directory: tests/src-tree.js, tests/test-catalogs.test.js)
import { srcPaths, srcText } from './src-tree.js';
import * as engineSources from './catalogs/engine-sources.js';

const IMPORTS_T = /import\s*\{[^}]*(?<![\w$])t(?![\w$])(?!\s+as)[^}]*\}\s*from\s*'[^']*i18n(?:\.js)?'/;

/** The .js files under src/ and engine/: [path from the repository root, its text]. */
const files = () => [...srcPaths(/\.js$/).map((p) => [p, () => srcText(p)]),
  ...engineSources.files.filter((f) => f.endsWith('.js')).map((f) => ['engine/' + f, () => engineSources.source(f)])];

/** From `i` (just after a header), the body: a { … } block (strings and comments skipped), or the expression to the line's end. */
function bodyFrom(src, i) {
  while (/\s/.test(src[i])) i++;
  if (src[i] !== '{') return src.slice(i, src.indexOf('\n', i) >>> 0);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); if (j < 0) break; continue; }
    if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j + 2) + 1; continue; }
    if (c === "'" || c === '"' || c === '`') { const q = c; for (j++; j < src.length && src[j] !== q; j++) if (src[j] === '\\') j++; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return src.slice(i, j + 1);
  }
  return src.slice(i);
}

/** The places in `src` where a local `t` (a parameter, a loop's) is called as t( : [{ line, head }]. */
export function shadowedCalls(src) {
  const found = [];
  const heads = [
    /(?<![\w$.])\(([^()]*)\)\s*=>/g,                       // (a, t) =>
    /(?<![\w$.])t\s*=>/g,                                   // t =>
    /function\s*[\w$]*\s*\(([^()]*)\)\s*(?=\{)/g,           // function f(p, t) {
    /^\s*(?:async\s+)?(?!if\b|for\b|while\b|switch\b|catch\b)[\w$]+\s*\(([^()]*)\)\s*(?=\{)/gm,   // a method: f(p, t) {
    /for\s*\(\s*(?:const|let|var)\s+t\s+(?:of|in)\b[^)]*\)\s*/g,   // for (const t of …)
  ];
  for (const re of heads) for (const m of src.matchAll(re)) {
    const params = m[1] ?? 't';
    if (!/(?<![\w$.])t(?![\w$])\s*(?:=[^>]|,|$)/.test(params.trim()) && params !== 't') continue;
    const body = bodyFrom(src, m.index + m[0].length);
    const call = body.search(/(?<![\w$.'"`])t\(/);
    if (call >= 0) found.push({ line: src.slice(0, m.index).split('\n').length, head: m[0].trim().slice(0, 60) });
  }
  return found;
}

test('the scan finds the shape of issue #374', () => {
  assert.equal(shadowedCalls("export function pickUp(p, t, { from = 'hand' } = {}) {\n  notice?.(t('hint.carry'));\n}").length, 1, 'src/carry.js as it was');
  assert.equal(shadowedCalls("export function pickUp(p, t) {\n  if (x) { notice?.(t('hint.carry')); }\n}").length, 1);
  assert.equal(shadowedCalls("const f = (t) => say(t('a.b'));").length, 1);
  assert.equal(shadowedCalls("for (const t of things) { log(t('x')); }").length, 1);
  assert.equal(shadowedCalls("function ok(p) { return t('hint.carry'); }").length, 0);
  assert.equal(shadowedCalls("const g = (t) => t.name;").length, 0);
});

test('no file that imports i18n\'s t calls a local t in its place', () => {
  const bad = [];
  for (const [f, read] of files()) {
    const src = read();
    if (!IMPORTS_T.test(src)) continue;
    for (const s of shadowedCalls(src)) bad.push(`${f}:${s.line} ${s.head}`);
  }
  assert.deepEqual(bad, [], 'a local t hides i18n\'s t() (rename the import: import { t as tr })');
});

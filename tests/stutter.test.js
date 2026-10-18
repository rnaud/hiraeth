// The stutter harness's reading (engine/stutter.js, issue #468): the script's record, the join with Unity's frames, each
// spike's cause and the ranking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StutterLog, stutterState, diffState, parseTsv, quantile, frameStats, join, causeOf, analyse, rank, JS_COLS } from '../engine/stutter.js';

const tsv = (rows) => [Object.keys(rows[0]).join('\t'), ...rows.map((r) => Object.values(r).join('\t'))].join('\n') + '\n';
/** n Unity frames of `ms` each, waiting on script frames 1…n (frame 0 the load's). */
const unityRows = (n, ms = 16.7, over = {}) => Array.from({ length: n }, (_, i) => ({ f: i, t: i / 60, dur: ms, wait: 1, script: 8, ops: 0.5, js: i, gc: 0, allocKb: 1, gcAllocKb: 1, made: 0, madeKb: 0, gpu: 9, cpuMain: 10, cpuRender: 5, 'm:Shader.CreateGPUProgram': 0, steps: '', ...(over[i] ?? {}) }));

test('the script record: a row a frame, what was made that frame, the state and the region as events', () => {
  const L = new StutterLog();
  const backend = { stats: { commandBytes: 2048, bytes: 0 } };
  L.frame({ n: 5, r: { ms: { update: 3, mirror: 2 }, stats: { nodes: 100, geometries: 10, materials: 4, uploadedBytes: 0 } }, backend, vm: 6, state: 'level:desert' });
  L.frame({ n: 6, r: { ms: { update: 4, mirror: 9 }, stats: { nodes: 130, geometries: 12, materials: 4, uploadedBytes: 4096 } }, backend, vm: 14, fullGc: 170, state: 'level:desert foes:3', region: 'Rose canyons' });
  const j = JSON.parse(L.json());
  assert.deepEqual(j.cols, JS_COLS);
  const row = Object.fromEntries(j.cols.map((c, i) => [c, j.rows[1][i]]));
  assert.equal(row.n, 6); assert.equal(row.nodes, 30); assert.equal(row.geoms, 2); assert.equal(row.upKb, 4); assert.equal(row.fullGc, 1); assert.equal(row.cmdKb, 2);
  assert.equal(j.rows[0][JS_COLS.indexOf('nodes')], 0, 'the first frame made nothing it can be measured against');
  assert.deepEqual(j.events.map((e) => e[2]), ['load', 'spawn', 'region']);
  assert.equal(j.sections.length, 2, 'a sections entry a row, null or not, so join can read them by place');
});

test('a change of state is named by its kind', () => {
  assert.equal(diffState('', 'level:desert'), 'load');
  assert.equal(diffState('level:desert foes:1', 'level:desert foes:3'), 'spawn');
  assert.equal(diffState('level:desert foes:3', 'level:desert foes:1'), 'foe gone');
  assert.equal(diffState('level:desert', 'level:desert menu:game/map'), 'menu');
  assert.equal(diffState('level:desert', 'level:desert dialogue'), 'dialogue');
  assert.equal(diffState('level:desert', 'level:desert scene:Takeoff cine'), 'cinematic');
});

test('the state of a game as a few words', () => {
  const g = { level: { id: 'arena' }, screen: () => ({ state: { dialogue: { text: 'hi' }, cine: null } }), foes: { list: [{ alive: true }, { alive: false }] }, scenePlaying: false, passage: { active: false } };
  assert.equal(stutterState(g, { open: true, mode: 'game', state: { panel: { id: 'map' } } }), 'level:arena menu:game/map dialogue foes:1');
  assert.equal(stutterState({ level: { id: 'desert' } }), 'level:desert');
});

test('numbers: a tab-separated table read back, quantiles, the frame numbers', () => {
  const rows = parseTsv('a\tb\tsteps\n1\t2.5\tx 3\n4\t\t\n');
  assert.deepEqual(rows, [{ a: 1, b: 2.5, steps: 'x 3' }, { a: 4, b: '', steps: '' }]);
  assert.equal(quantile([5, 1, 3, 2, 4], 0.5), 3);
  const s = frameStats([16, 17, 16, 40, 60]);
  assert.equal(s.max, 60); assert.equal(s.over33, 2); assert.equal(s.over50, 1); assert.equal(s.p50, 17);
});

test('the join: the load before the first script frame kept apart', () => {
  const js = { cols: JS_COLS, rows: [[1, 3, 2, 6, 1, 0, 0, 0, 0, 0, 0, 6], [2, 3, 2, 6, 1, 0, 0, 0, 0, 0, 0, 6]], sections: [{ people: 1 }, { people: 1 }] };
  const { load, play } = join(unityRows(3), js);
  assert.equal(load.length, 1); assert.equal(play.length, 2);
  assert.equal(play[0].s.n, 1); assert.deepEqual(play[0].sections, { people: 1 });
});

test('a spike\'s cause: the script\'s (a V8 full collection, a section that grew), then Unity\'s (GC, a shader, the ops, the GPU)', () => {
  const frames = unityRows(20).map((u) => ({ ...u, s: { n: u.js, update: 3, mirror: 2, vm: 6, nodes: 0, geoms: 0, upKb: 0 }, sections: { people: 1, story: 0.5 } }));
  const at = (i, o, s = {}, sec = null) => { frames[i] = { ...frames[i], ...o, s: { ...frames[i].s, ...s }, ...(sec ? { sections: sec } : {}) }; return i; };
  const opt = (gc = []) => ({ med: 16.7, secMed: { people: 1, story: 0.5 }, gcAt: new Set(gc) });
  assert.equal(causeOf(frames, at(2, { dur: 60, wait: 40 }, { vm: 45 }), opt([4])).cause, 'script: V8 full GC', 'a full collection seen within the lag after the frame');
  assert.equal(causeOf(frames, at(3, { dur: 60, wait: 40 }, { vm: 45 }, { people: 30, story: 0.5 }), opt()).cause, 'script: people');
  assert.equal(causeOf(frames, at(5, { dur: 60, wait: 40 }, { vm: 8 }), opt()).cause, 'script: V8 pause (GC or compile)', 'the wait far over what the script measured of itself');
  assert.equal(causeOf(frames, at(6, { dur: 50, gc: 1 }), opt()).cause, 'C#: managed GC');
  assert.equal(causeOf(frames, at(7, { dur: 80, 'm:Shader.CreateGPUProgram': 55 }), opt()).cause, 'C#: shader / pipeline first use');
  assert.equal(causeOf(frames, at(8, { dur: 45, ops: 25, made: 40 }), opt()).cause, 'C#: objects made (ops)');
  assert.equal(causeOf(frames, at(9, { dur: 45, gpu: 42 }), opt()).cause, 'GPU');
  assert.equal(causeOf(frames, at(11, { dur: 110, wait: 100, ops: 95, gc: 21, made: 228 }), opt()).cause, 'C#: managed GC', 'the ops applied while it waits are not the script\'s');
  assert.equal(causeOf(frames, at(12, { dur: 70, wait: 60 }, { vm: 2, all: 60 }), opt()).cause, 'script: the route\'s act (spawn, set-down)');
  assert.equal(causeOf(frames, at(13, { dur: 35, gpu: 9, 'm:Gfx.PresentFrame': 30 }), opt()).cause, 'GPU / present wait');
  assert.equal(causeOf(frames, at(10, { dur: 45, steps: 'PostLateUpdate.FinishFrameRendering 20.1, Update.ScriptRunBehaviourUpdate 3' }), opt()).cause, 'C#: PostLateUpdate.FinishFrameRendering');
});

test('a run read, its spikes given what was happening near them; the causes ranked by the time they cost', () => {
  const u = unityRows(200, 16.7, { 50: { dur: 70, gc: 1 }, 120: { dur: 40, gc: 1 }, 150: { dur: 90, wait: 70 } });
  const js = { cols: JS_COLS, rows: Array.from({ length: 200 }, (_, i) => [i, 3, 2, i === 150 ? 72 : 6, 1, 0, 0, 0, 0, 0, 0, i === 150 ? 72 : 6]), sections: Array(200).fill(null), events: [[49, 'spawn', 'beat'], [151, 'state level:x foes:2', 'spawn']] };
  const a = analyse(parseTsv(tsv(u)), js, 'route-fight-1', { tailSecs: 0 });
  assert.equal(analyse(parseTsv(tsv(u)), js, 'x').spikes.length, 2, 'the first 2 s after the first played frame are the load\'s tail, kept apart');
  assert.equal(a.play.over33, 3); assert.equal(a.play.max, 90);
  assert.equal(a.spikes.length, 3);
  assert.equal(a.spikes.find((s) => s.ms === 70).at, 'spawn', 'a beat named near the spike');
  const ranked = rank([a]);
  assert.equal(ranked[0].cause, 'C#: managed GC', 'two GCs cost more than one script frame (53 + 23 against 73 ms over the median)');
  assert.equal(ranked[0].n, 2);
  assert.equal(ranked[1].cause, 'script: update');
});

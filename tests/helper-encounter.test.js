import test from 'node:test';
import assert from 'node:assert/strict';
import { beginHelperEncounter, helperRun, consumeHelperReturn, HELPER_KEY } from '../src/temples/helper-encounter.js';
const origin = { pos: [8, 600, 12], up: [0, 1, 0], fwd: [0, 0, -1] };
function state(flags = {}) {
  return { flag: k => flags[k], set: (k, v) => (flags[k] = JSON.parse(JSON.stringify(v))), flags };
}
function start(g, temple = 'desert') {
  const href = beginHelperEncounter(g, temple, { from: temple, returnPose: origin });
  const query = new URLSearchParams(href);
  return { href, token: query.get('encounter'), run: helperRun(g, query.get('game'), query.get('encounter')) };
}

test('only the two unresolved helpers can start; return pose is copied and completed old saves stay complete', () => {
  const g = state();
  assert.equal(beginHelperEncounter(g, 'incal', { from: 'incal', returnPose: origin }), null);
  assert.equal(beginHelperEncounter(g, 'desert', { from: 'desert', returnPose: { ...origin, pos: [NaN, 0, 0] } }), null);
  const s = start(g); assert.match(s.href, /^\?game=cistern&from=desert&encounter=1%3Adesert%3A1%3A/);
  assert.deepEqual(g.flag(HELPER_KEY).returnPose, origin);
  assert.notEqual(g.flag(HELPER_KEY).returnPose.pos, origin.pos);
  for (const key of ['temple.desert.done', 'temple.desert.boss']) {
    const old = state({ [key]: key.endsWith('.boss') ? 'done' : true });
    assert.equal(beginHelperEncounter(old, 'desert', { from: 'desert', returnPose: origin }), null);
  }
});

test('arcade, stale tokens, another game, another slot and partial scores cannot complete an encounter', () => {
  const a = state(), b = state(), first = start(a);
  assert.equal(helperRun(a, 'cistern', null), null);
  assert.equal(helperRun(a, 'elderflight', first.token), null);
  assert.equal(helperRun(b, 'cistern', first.token), null);
  for (const result of [{ failed: false, value: 99999 }, { goal: { game: 'cistern', complete: false } },
    { goal: { game: 'elderflight', complete: true } }, { failed: true, goal: { game: 'cistern', complete: true } }]) {
    assert.equal(first.run.onResult(result), false);
  }
  const second = start(a); assert.notEqual(second.token, first.token);
  assert.equal(first.run.onResult({ goal: { game: 'cistern', complete: true } }), false);
  assert.equal(a.flag(HELPER_KEY).success, false);
});

test('quitting restores the origin without progress; retry retains the same story board seed', () => {
  const g = state(), { run, token } = start(g);
  const current = helperRun(g, 'cistern', token);
  assert.equal(current.context.seed, run.context.seed);
  current.left(); const recovery = helperRun(g, 'cistern', token);
  assert.equal(recovery.recoveryHref(), '?level=desert');
  assert.equal(recovery.onResult({goal:{game:'cistern',complete:true}}), false);
  let restored = null, resolutions = 0;
  assert.equal(consumeHelperReturn(g, 'desert', 'arzach', {}), null);
  const r = consumeHelperReturn(g, 'desert', 'desert', { restore: p => { restored = p; }, resolve: () => resolutions++ });
  assert.equal(r.success, false); assert.deepEqual(restored, origin); assert.equal(resolutions, 0);
  assert.equal(g.flag(HELPER_KEY), null);
});

for (const [temple, gameId] of [['desert', 'cistern'], ['arzach', 'elderflight']]) test(`${temple}: explicit success survives reload and resolves once, after restoring the pose`, () => {
  const g = state(), { run } = start(g, temple);
  assert.equal(run.onResult({ failed: false, goal: { game: gameId, complete: true } }), true);
  assert.equal(run.onResult({ failed: false, goal: { game: gameId, complete: true } }), false);
  const reload = state(JSON.parse(JSON.stringify(g.flags))), order = [];
  const handlers = { restore: p => { assert.deepEqual(p, origin); order.push('pose'); },
    resolve: () => { order.push('resolve'); reload.set(`temple.${temple}.done`, true); } };
  assert.equal(consumeHelperReturn(reload, temple, temple, handlers).success, true);
  assert.deepEqual(order, ['pose', 'resolve']);
  assert.equal(consumeHelperReturn(reload, temple, temple, handlers), null);
  assert.deepEqual(order, ['pose', 'resolve']);
});

test('an interrupted return does not lose success or award twice', () => {
  const g = state(), { run } = start(g); run.onResult({ goal: { game: 'cistern', complete: true } });
  assert.equal(consumeHelperReturn(g, 'desert', 'desert', { resolve: () => {} }), null, 'failed resolver keeps the goal');
  assert.equal(g.flag(HELPER_KEY).success, true);
  g.set('temple.desert.done', true); // crash after the real resolver persisted completion but before clearing the receipt
  let again = 0;
  assert.equal(consumeHelperReturn(g, 'desert', 'desert', { resolve: () => again++ }).success, true);
  assert.equal(again, 0); assert.equal(g.flag(HELPER_KEY), null);
});


test('a live runner cannot write into another populated slot with the same temple and serial', () => {
  const stores = { a: state(), b: state() }; let active = 'a';
  const game = { flag: k => stores[active].flag(k), set: (k, v) => stores[active].set(k, v) };
  const begin = () => new URLSearchParams(beginHelperEncounter(game, 'desert', { from: 'desert', returnPose: origin, slot: active })).get('encounter');
  const tokenA = begin(), runA = helperRun(game, 'cistern', tokenA, { slot: () => active });
  active = 'b'; const tokenB = begin();
  assert.notEqual(tokenA, tokenB, 'both first attempts have independent identities');
  const beforeB = JSON.stringify(stores.b.flags);
  assert.equal(runA.onResult({ goal: { game: 'cistern', complete: true } }), false);
  runA.left(); assert.equal(JSON.stringify(stores.b.flags), beforeB, 'old left/result cannot change populated slot B');
  assert.equal(helperRun(game, 'cistern', tokenA, { slot: () => active }), null, 'reload in B cannot claim A URL');
  active = 'a';
  assert.equal(runA.onResult({ goal: { game: 'cistern', complete: true } }), true, 'original slot still owns its run');
  assert.equal(stores.b.flag(HELPER_KEY).success, false);
});

test('return resumes a resolver interrupted between its boss and world-completion flags', () => {
  const g = state(), { run } = start(g); run.onResult({ goal: { game: 'cistern', complete: true } });
  g.set('temple.desert.boss', 'done'); let resumed = 0;
  const result = consumeHelperReturn(g, 'desert', 'desert', { resolve: () => { resumed++; g.set('temple.desert.done', true); } });
  assert.equal(result.success, true); assert.equal(resumed, 1); assert.equal(g.flag(HELPER_KEY), null);
});

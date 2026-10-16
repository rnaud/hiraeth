// The Notes page's refresh (#388): the merge of the updated issues into the list kept on the device, when a whole
// read is due, the Worker's `since` route and trimmed rows, page 1 then every other page at once, the questions
// kept by updatedAt in the notebook's store, and a refresh timed before and after over a GitHub with latency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleIssues, listView } from '../worker/issues.js';
import { memoryStore } from '../worker/drafts.js';
import { QUESTION_CACHE, QUESTION_KEEP } from '../worker/questions.js';
import { mergeUpdates, sinceOf, needsFullReload, syncList, FULL_EVERY, SINCE_MARGIN } from '../src/notes-page/list-sync.js';
import { API, origin, env, repository, fakeGitHub, pageApi, sequentialLoad } from './notes-fake-github.js';

const row = (number, extra = {}) => ({ number, title: `Issue ${number}`, state: 'open', status: 'open', updatedAt: '2026-10-13T18:00:00Z', ...extra });
const NOW = Date.UTC(2026, 9, 16, 12);

test('the merge: updated, closed, reopened and new issues replace or join the kept list, newest first', () => {
  const kept = [row(5), row(4, { state: 'closed', status: 'done' }), row(3), row(1)];
  const merged = mergeUpdates(kept, [row(3, { status: 'progress', labels: ['in progress'] }), row(5, { state: 'closed', status: 'done' }),
    row(4), row(7), { number: 'x' }, null]);
  assert.deepEqual(merged.map((i) => [i.number, i.status]), [[7, 'open'], [5, 'done'], [4, 'open'], [3, 'progress'], [1, 'open']]);
  assert.deepEqual(merged.find((i) => i.number === 3).labels, ['in progress']);
  assert.deepEqual(mergeUpdates(kept, []).map((i) => i.number), [5, 4, 3, 1], 'nothing updated: the same list');
  assert.equal(kept.length, 4, 'the kept list is not changed in place');
});

test('since: the newest change less a margin, to the second; a whole read when nothing is kept, a day on, or asked', () => {
  assert.equal(sinceOf([row(1, { updatedAt: '2026-10-13T18:00:00Z' }), row(2, { updatedAt: '2026-10-14T09:30:15Z' })]),
    new Date(Date.parse('2026-10-14T09:30:15Z') - SINCE_MARGIN).toISOString().replace(/\.\d{3}Z$/, 'Z'));
  assert.equal(sinceOf([]), null);
  assert.equal(sinceOf([{ number: 1 }]), null);
  const kept = { issues: [row(1)], nextPage: null, fullAt: NOW - 3600_000 };
  assert.equal(needsFullReload(kept, NOW), false);
  assert.equal(needsFullReload(kept, NOW, true), true, 'Reload all');
  assert.equal(needsFullReload(null, NOW), true, 'nothing kept');
  assert.equal(needsFullReload({ ...kept, issues: [] }, NOW), true);
  assert.equal(needsFullReload({ ...kept, fullAt: NOW - FULL_EVERY - 1 }, NOW), true, 'over a day old');
  assert.equal(needsFullReload({ ...kept, fullAt: undefined }, NOW), true, 'an older format');
  assert.equal(needsFullReload({ ...kept, fullAt: NOW + 60_000 }, NOW), true, 'a clock gone back');
  assert.equal(needsFullReload({ ...kept, issues: [{ number: 1 }] }, NOW), true, 'nothing to go by');
});

async function cookie(fetcher = () => { throw new Error('GitHub must not be called'); }) {
  const r = await handleIssues(new Request(`${origin}/api/notes/session`, { method: 'POST', body: JSON.stringify({ password: env.HIRAETH_NOTES_PASSWORD }),
    headers: { Origin: origin, 'Content-Type': 'application/json' } }), env, fetcher, NOW);
  return r.headers.get('Set-Cookie').split(';')[0];
}
const get = async (path, c, fetcher) => handleIssues(new Request(`${origin}/api/notes/${path}`, { headers: c ? { Cookie: c } : {} }), env, fetcher, NOW);

test('the since route: state=all, updated order, the time checked strictly, rows trimmed, signed in only', async () => {
  const c = await cookie(), urls = [];
  const fetcher = async (url) => { urls.push(url); return Response.json([{ number: 9, title: 'Nine', state: 'closed', state_reason: 'not_planned', created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-15T08:00:00Z', closed_at: '2026-10-15T08:00:00Z', labels: [{ name: 'combat' }], comments: 2, body: 'x'.repeat(5000), user: { login: 'a' } },
  { number: 8, title: 'PR', pull_request: {}, labels: [] }]); };
  const r = await get('issues?state=all&since=2026-10-15T07:55:00Z', c, fetcher);
  assert.equal(r.status, 200);
  assert.deepEqual(urls, [`${API}?state=all&sort=updated&direction=desc&since=2026-10-15T07:55:00Z&per_page=100&page=1`]);
  const data = await r.json();
  assert.deepEqual(data, { issues: [{ number: 9, title: 'Nine', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-15T08:00:00Z', labels: ['combat'], comments: 2,
    state: 'closed', status: 'done', closedAt: '2026-10-15T08:00:00Z', stateReason: 'not_planned' }], nextPage: null, lastPage: 1 });
  for (const since of ['yesterday', '2026-10-15T07:55:00.000Z', '2026-10-15', '2026-10-15T07:55:00Z%26repo=evil/repo', '2026-13-45T99:99:99Z', '']) {
    assert.equal((await get(`issues?state=all&since=${since}`, c, fetcher)).status, 400, since);
  }
  assert.equal((await get('issues?since=2026-10-15T07:55:00Z', c, fetcher)).status, 400, 'only with state=all');
  assert.equal((await get('issues?state=all&since=2026-10-15T07:55:00Z', null, fetcher)).status, 401);
  assert.equal(urls.length, 1, 'nothing invalid reached GitHub');
});

test('a whole read: page 1 says the last page, the others are asked for at once; Load more past AUTO_PAGES', async () => {
  const repo = repository(390), github = fakeGitHub(repo, { latency: 15 });
  const api = await pageApi(github);
  const got = await syncList(api, null, { now: NOW, maxPages: 10 });
  assert.equal(got.full, true); assert.equal(got.fullAt, NOW);
  assert.equal(got.issues.length, 390); assert.equal(got.nextPage, null);
  assert.deepEqual(got.issues.slice(0, 2).map((i) => i.number), [390, 389]);
  assert.equal(github.calls.length, 4);
  assert.equal(github.maxInFlight(), 3, 'pages 2 to 4 together');
  // (more pages than the page reads by itself: the rest stays behind Load more)
  github.reset();
  const capped = await syncList(api, null, { now: NOW, maxPages: 2 });
  assert.equal(capped.issues.length, 200); assert.equal(capped.nextPage, 3);
  assert.equal(github.calls.length, 2);
});

test('a refresh asks only for what changed since the kept list, and merges it', async () => {
  const repo = repository(390), github = fakeGitHub(repo);
  let clock = NOW;
  const api = await pageApi(github, null, () => clock);
  const first = await syncList(api, null, { now: clock });
  // (on GitHub meanwhile: one closed, one reopened, one relabelled, one new)
  const later = (t) => new Date(Date.parse(repo.issues.at(-1).updated_at) + t).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const edit = (n, change) => Object.assign(repo.issues[n - 1], change);
  edit(388, { state: 'closed', state_reason: 'completed', closed_at: later(60_000), updated_at: later(60_000) });
  edit(387, { state: 'open', state_reason: null, closed_at: null, updated_at: later(120_000) });
  edit(10, { labels: [{ name: 'in progress' }], updated_at: later(180_000) });
  repo.issues.push({ ...repo.issues[0], number: 391, title: 'New one', state: 'open', labels: [], created_at: later(240_000), updated_at: later(240_000) });
  clock += 3600_000; github.reset();
  const next = await syncList(api, first, { now: clock });
  assert.equal(next.full, false); assert.equal(next.fullAt, first.fullAt, 'still the time of the whole read');
  assert.equal(github.calls.length, 1, 'one small call');
  assert.match(github.calls[0], /sort=updated&direction=desc&since=/);
  const by = new Map(next.issues.map((i) => [i.number, i]));
  assert.equal(next.issues.length, 391); assert.equal(next.issues[0].number, 391);
  assert.equal(by.get(388).status, 'done'); assert.equal(by.get(387).status, 'open'); assert.equal(by.get(10).status, 'progress');
  // (nothing changed: still one call, the same list)
  github.reset();
  const same = await syncList(api, next, { now: clock });
  assert.equal(github.calls.length, 1); assert.deepEqual(same.issues, next.issues);
  // (a day on, or Reload all: whole again)
  github.reset();
  assert.equal((await syncList(api, next, { now: first.fullAt + FULL_EVERY + 1 })).full, true);
  assert.equal((await syncList(api, next, { now: clock, all: true })).full, true);
});

test('more updates than the pages read: the whole list instead', async () => {
  const repo = repository(390), github = fakeGitHub(repo);
  const api = await pageApi(github);
  const kept = { issues: [row(1, { updatedAt: '2026-09-01T00:00:00Z' })], nextPage: null, fullAt: NOW - 1000 };
  const got = await syncList(api, kept, { now: NOW, maxPages: 2 });
  assert.equal(got.full, true);
  assert.deepEqual(github.calls.map((u) => /since=/.test(u)), [true, true, false, false]);
});

// ---- the questions, kept by updatedAt
const questions = async (store, github, now = NOW) => {
  const c = await cookie(github.fetch);
  const r = await handleIssues(new Request(`${origin}/api/notes/questions`, { headers: { Cookie: c } }), env, github.fetch, now, store);
  assert.equal(r.status, 200);
  return (await r.json()).questions;
};
const commentCalls = (github) => github.calls.filter((u) => /\/comments/.test(u)).length;

test('the questions: an unchanged issue costs no comment call; a changed one is read again; gone ones leave the cache', async () => {
  const repo = repository(390), github = fakeGitHub(repo), store = memoryStore();
  const asked = repo.issues.filter((i) => i.labels.some((l) => l.name === 'needs-author'));
  assert.ok(asked.length >= 5);
  const first = await questions(store, github);
  assert.equal(first.length, asked.length);
  assert.equal(commentCalls(github), asked.length);
  github.reset();
  assert.deepEqual(await questions(store, github), first, 'the same questions from the cache');
  assert.equal(commentCalls(github), 0);
  assert.equal(github.calls.length, 1, 'only the list of needs-author issues');
  // (a new comment answers one; another loses its label)
  const [one, two] = asked;
  repo.comments[one.number].push({ id: 1, author_association: 'OWNER', body: 'Go with A.' });
  Object.assign(one, { comments: 4, updated_at: '2026-10-16T11:00:00Z' });
  Object.assign(two, { labels: [], updated_at: '2026-10-16T11:00:00Z' });
  github.reset();
  const after = await questions(store, github);
  assert.equal(commentCalls(github), 1, 'only the changed issue');
  assert.deepEqual(after.map((q) => q.number), asked.slice(2).map((i) => i.number));
  assert.ok(!(two.number in store.map.get(QUESTION_CACHE)), 'an issue off the list leaves the cache');
  // (an hour on, each is read again: a box ticked by editing a comment may not move updatedAt)
  github.reset();
  await questions(store, github, NOW + QUESTION_KEEP + 1);
  assert.equal(commentCalls(github), asked.length - 1);
});

test('the questions without a store, or with one that fails, are read as before', async () => {
  const repo = repository(120), github = fakeGitHub(repo);
  const asked = repo.issues.filter((i) => i.labels.some((l) => l.name === 'needs-author')).length;
  await questions(null, github); await questions(null, github);
  assert.equal(commentCalls(github), asked * 2);
  github.reset();
  const broken = { get: async () => { throw new Error('store'); }, put: async () => { throw new Error('store'); } };
  assert.equal((await questions(broken, github)).length, asked);
  const failingPut = { ...memoryStore(), put: async () => { throw new Error('full'); } };
  assert.equal((await questions(failingPut, github)).length, asked);
});

test('timed over a GitHub with latency: a refresh before and after (#388)', async () => {
  const latency = 30, repo = repository(390);
  const time = async (run) => { const t = performance.now(); await run(); return performance.now() - t; };
  const github = fakeGitHub(repo, { latency });
  const api = await pageApi(github, null, () => NOW);
  const before = await time(() => sequentialLoad(api));
  const beforeCalls = github.calls.length;
  github.reset();
  const kept = await syncList(api, null, { now: NOW });
  const fullCalls = github.calls.length;
  github.reset();
  const after = await time(() => syncList(api, kept, { now: NOW + 60_000 }));
  assert.equal(beforeCalls, 4); assert.equal(fullCalls, 4); assert.equal(github.calls.length, 1);
  assert.ok(after < before / 2, `${after.toFixed(0)} ms after, ${before.toFixed(0)} ms before`);
  // (the rows: the page's fields only)
  const full = repo.issues.slice(0, 100);
  const trimmed = JSON.stringify(full.map(listView)).length;
  assert.ok(trimmed < JSON.stringify(full).length / 4);
});

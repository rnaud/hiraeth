// The Notes page's status of each note (#277): the mapping from GitHub's state and labels, the latest comment's
// excerpt, the closing commit, the Worker's list (state=all) and activity routes over a fake GitHub, and the page's
// filter, counts and caches. Fixtures in GitHub's REST shape; no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueStatus, commentExcerpt, latestComment, closingCommit, STATUSES } from '../worker/status.js';
import { handleIssues, REPOSITORY } from '../worker/issues.js';
import { statusOf, matchesFilter, sortForFilter, filterCounts, otherLabels, relativeTime, FILTERS, STATUS_TEXT,
  readList, writeList, cachedActivity, storeActivity } from '../src/notes-page/status-view.js';

const label = (name) => ({ id: 1, name, color: 'ffffff' });
const gh = (number, { state = 'open', labels = [], comments = 0, ...rest } = {}) => ({
  number, title: `Issue ${number}`, state, state_reason: state === 'closed' ? 'completed' : null,
  created_at: '2026-10-12T10:00:00Z', updated_at: '2026-10-13T18:00:00Z', closed_at: state === 'closed' ? '2026-10-13T18:52:50Z' : null,
  labels: labels.map(label), comments, user: { login: 'rnaud' }, author_association: 'OWNER', ...rest,
});
// (#284's events as GitHub gave them: closed by its commit, then referenced by a later one)
const EVENTS_284 = [
  { id: 1, event: 'labeled', label: { name: 'in progress' }, commit_id: null, created_at: '2026-10-13T17:00:00Z' },
  { id: 2, event: 'closed', commit_id: '3c068b42d96101c4c7cb8a30ca71f480c1cd3ee8', commit_url: 'https://api.github.com/repos/rnaud/hiraeth/commits/3c068b42d96101c4c7cb8a30ca71f480c1cd3ee8', created_at: '2026-10-13T18:52:50Z', actor: { login: 'rnaud' } },
  { id: 3, event: 'referenced', commit_id: '1d10c2aa9b86a0fcd871885e04bacbce0890272a', created_at: '2026-10-13T18:52:51Z', actor: { login: 'rnaud' } },
];
const COMMENT = { id: 4419, user: { login: 'rnaud' }, created_at: '2026-10-13T18:40:00Z', author_association: 'OWNER',
  body: '<!-- progress -->\n**Progress:** the guard redrawn to its turnaround.\n\nSix before/after pairs in the changelog.\nTests green; rebasing now.\nThen the build.\n![shot](https://example.com/a.jpg)' };

test('the status of an issue: closed is done; then needs-author, codex-only, in progress; else open', () => {
  assert.equal(issueStatus(gh(1)), 'open');
  assert.equal(issueStatus(gh(1, { labels: ['todo', 'answered'] })), 'open');
  assert.equal(issueStatus(gh(1, { labels: ['in progress'] })), 'progress');
  assert.equal(issueStatus(gh(1, { labels: ['codex-only'] })), 'blocked');
  assert.equal(issueStatus(gh(1, { labels: ['needs-author', 'in progress'] })), 'needs');   // (waiting on the author wins)
  assert.equal(issueStatus(gh(1, { labels: ['In Progress'] })), 'progress');
  assert.equal(issueStatus(gh(1, { state: 'closed', labels: ['in progress', 'needs-author'] })), 'done');
  assert.equal(issueStatus({ state: 'open', labels: ['codex-only'] }), 'blocked');          // (the Worker's view: names)
  assert.equal(issueStatus(undefined), 'open');
  for (const s of STATUSES) assert.ok(STATUS_TEXT[s]);
});

test('a comment\'s excerpt: plain first lines, markup comments and images out, three lines at most', () => {
  assert.equal(commentExcerpt(COMMENT.body), '**Progress:** the guard redrawn to its turnaround.\nSix before/after pairs in the changelog.\nTests green; rebasing now.…');
  assert.equal(commentExcerpt('One line.'), 'One line.');
  assert.equal(commentExcerpt('Look\r\n<details><summary>log</summary>\nlots\n</details>\nok'), 'Look\nok');
  const long = commentExcerpt('word '.repeat(100));
  assert.ok(long.length <= 281 && long.endsWith('…'), long);
  assert.equal(commentExcerpt(null), '');
});

test('the latest comment and the closing commit, from GitHub\'s JSON', () => {
  assert.deepEqual(latestComment([{ ...COMMENT, id: 1, body: 'old' }, COMMENT]),
    { author: 'rnaud', at: '2026-10-13T18:40:00Z', excerpt: commentExcerpt(COMMENT.body), id: 4419 });
  assert.equal(latestComment([]), null);
  assert.equal(latestComment('nope'), null);
  assert.deepEqual(closingCommit(EVENTS_284), { sha: '3c068b42d96101c4c7cb8a30ca71f480c1cd3ee8', at: '2026-10-13T18:52:50Z' });
  // (closed by hand, reopened, then closed by a commit: the last close counts; closed by hand last: no commit)
  const reopened = [{ event: 'closed', commit_id: null }, { event: 'reopened' }, EVENTS_284[1]];
  assert.equal(closingCommit(reopened).sha, EVENTS_284[1].commit_id);
  assert.equal(closingCommit([EVENTS_284[1], { event: 'reopened' }, { event: 'closed', commit_id: null }]), null);
  assert.equal(closingCommit([{ event: 'closed', commit_id: 'not-a-sha' }]), null);
  assert.equal(closingCommit(null), null);
});

// ---- the Worker
const origin = 'https://notebook.example';
const allow = { limit: async () => ({ success: true }) };
const env = { HIRAETH_ISSUES_TOKEN: 'test-github-token', HIRAETH_NOTES_PASSWORD: 'testpw', NOTES_LOGIN_LIMITER: allow, NOTES_WRITE_LIMITER: allow };
const now = Date.UTC(2026, 9, 13);
const noFetch = () => { throw new Error('GitHub must not be called'); };
const API = `https://api.github.com/repos/${REPOSITORY}/issues`;
async function login() {
  const response = await handleIssues(new Request(`${origin}/api/notes/session`, { method: 'POST', body: JSON.stringify({ password: 'testpw' }),
    headers: { Origin: origin, 'Content-Type': 'application/json' } }), env, noFetch, now);
  return response.headers.get('Set-Cookie').split(';')[0];
}
const get = (path, cookie) => new Request(`${origin}/api/notes/${path}`, { headers: cookie ? { Cookie: cookie } : {} });
const fake = (routes) => { const calls = []; return { calls, fetch: async (url) => {
  calls.push(url);
  const hit = routes[url];
  if (!hit) throw new Error(`unexpected ${url}`);
  return typeof hit === 'function' ? hit() : Response.json(hit);
} }; };

test('the list with every status: state=all, 100 a page, each issue\'s status and closing time', async () => {
  const c = await login();
  const github = fake({ [`${API}?state=all&sort=created&direction=desc&per_page=100&page=1`]: () => Response.json([
    gh(290, { labels: ['in progress'] }), gh(289, { labels: ['needs-author'] }), gh(288, { labels: ['codex-only', 'todo'] }),
    gh(284, { state: 'closed' }), gh(283), { ...gh(282), pull_request: {} },
  ], { headers: { Link: `<${API}?state=all&page=2>; rel="next"` } }) });
  const data = await (await handleIssues(get('issues?state=all', c), env, github.fetch, now)).json();
  assert.deepEqual(data.issues.map((i) => [i.number, i.status]), [[290, 'progress'], [289, 'needs'], [288, 'blocked'], [284, 'done'], [283, 'open']]);
  assert.equal(data.nextPage, 2);
  // (#388: only what the page uses; no link, no empty labels, no zero replies)
  assert.deepEqual(data.issues[3], { number: 284, title: 'Issue 284', createdAt: '2026-10-12T10:00:00Z',
    updatedAt: '2026-10-13T18:00:00Z', state: 'closed', status: 'done', closedAt: '2026-10-13T18:52:50Z', stateReason: 'completed' });
  assert.deepEqual(data.issues[0].labels, ['in progress']);
  assert.equal(data.issues[4].closedAt, undefined);
  assert.equal((await handleIssues(get('issues?state=closed', c), env, noFetch, now)).status, 400);
  assert.equal((await handleIssues(get('issues?state=all'), env, noFetch, now)).status, 401);
});

test('an opened note\'s activity: its newest comment (one a page) and, closed, its closing commit from the last page of events', async () => {
  const c = await login();
  const github = fake({
    [`${API}/284`]: gh(284, { state: 'closed', comments: 7 }),
    [`${API}/284/comments?per_page=1&page=7`]: [COMMENT],
    [`${API}/284/events?per_page=100`]: () => Response.json([], { headers: { Link: `<${API}/284/events?per_page=100&page=2>; rel="next", <${API}/284/events?per_page=100&page=3>; rel="last"` } }),
    [`${API}/284/events?per_page=100&page=3`]: EVENTS_284,
  });
  const response = await handleIssues(get('issues/284/activity', c), env, github.fetch, now);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.issue.status, 'done');
  assert.equal(data.comment.author, 'rnaud'); assert.equal(data.comment.id, 4419);
  assert.equal(data.closedBy.sha, '3c068b42d96101c4c7cb8a30ca71f480c1cd3ee8');
  assert.equal(github.calls.length, 4);
  assert.doesNotMatch(JSON.stringify(data), /test-github-token/);

  // (open, no comments: one call; in progress)
  const quiet = fake({ [`${API}/290`]: gh(290, { labels: ['in progress'] }) });
  const open = await (await handleIssues(get('issues/290/activity', c), env, quiet.fetch, now)).json();
  assert.equal(open.issue.status, 'progress');
  assert.equal(open.comment, null); assert.equal(open.closedBy, null);
  assert.equal(quiet.calls.length, 1);

  // gone, a pull request, GitHub's rate limit, signed out, a bad number, a write
  assert.equal((await handleIssues(get('issues/9/activity', c), env, async () => new Response('', { status: 404 }), now)).status, 404);
  assert.equal((await handleIssues(get('issues/9/activity', c), env, fake({ [`${API}/9`]: { ...gh(9), pull_request: {} } }).fetch, now)).status, 404);
  const limited = await handleIssues(get('issues/9/activity', c), env, async () => new Response('', { status: 403, headers: { 'X-RateLimit-Remaining': '0' } }), now);
  assert.equal(limited.status, 429);
  assert.equal((await handleIssues(get('issues/9/activity'), env, noFetch, now)).status, 401);
  assert.equal((await handleIssues(get('issues/0/activity', c), env, noFetch, now)).status, 404);
  const post = new Request(`${origin}/api/notes/issues/9/activity`, { method: 'POST', headers: { Cookie: c, Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal((await handleIssues(post, env, noFetch, now)).status, 405);
});

// ---- the page
test('the page\'s filter and counts: To do is everything not done; an older Worker\'s answer still gets a status', () => {
  const list = [
    { number: 1, state: 'open', status: 'progress', labels: ['in progress', 'todo'] },
    { number: 2, state: 'open', status: 'needs', labels: ['needs-author'] },
    { number: 3, state: 'open', status: 'blocked', labels: ['codex-only'] },
    { number: 4, state: 'closed', status: 'done', labels: [] },
    { number: 5, state: 'open', status: 'open', labels: [] },
    { number: 6, labels: ['in progress'] },   // (no status, no state: an older Worker's list of open issues)
  ];
  assert.equal(statusOf(list[5]), 'progress');
  assert.deepEqual(filterCounts(list), { todo: 5, all: 6, open: 1, progress: 2, needs: 1, blocked: 1, done: 1 });
  assert.deepEqual(list.filter((i) => matchesFilter(i, 'todo')).map((i) => i.number), [1, 2, 3, 5, 6]);
  assert.deepEqual(list.filter((i) => matchesFilter(i, 'done')).map((i) => i.number), [4]);
  assert.deepEqual(list.filter((i) => matchesFilter(i, 'all')).length, 6);
  assert.deepEqual(otherLabels(list[0]), ['todo']);
  assert.deepEqual(sortForFilter(list.filter((i) => matchesFilter(i, 'todo')), 'todo').map((i) => i.number), [2, 1, 6, 5, 3]);
  assert.equal(sortForFilter(list, 'all'), list);
  assert.deepEqual(FILTERS.map(([k]) => k), ['todo', 'all', 'open', 'progress', 'needs', 'blocked', 'done']);
});

test('relative times', () => {
  const at = Date.parse('2026-10-13T19:00:00Z');
  assert.equal(relativeTime('2026-10-13T18:59:40Z', at), 'just now');
  assert.equal(relativeTime('2026-10-13T18:55:00Z', at), '5 min ago');
  assert.equal(relativeTime('2026-10-13T16:00:00Z', at), '3 h ago');
  assert.equal(relativeTime('2026-10-11T19:00:00Z', at), '2 d ago');
  assert.equal(relativeTime('nope', at), '');
});

test('the caches: the last list, and an opened note\'s activity while its updatedAt stands', () => {
  const memory = new Map();
  const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };
  assert.equal(readList(storage), null);
  writeList(storage, [{ number: 1, title: 'a' }], 2, 1234, 1000);
  assert.deepEqual(readList(storage), { at: 1234, fullAt: 1000, issues: [{ number: 1, title: 'a' }], nextPage: 2 });
  memory.set('hiraeth.notes.list.v3', '{broken');
  assert.equal(readList(storage), null);
  // (a list of the older format, without fullAt: none, so the page reads the list whole)
  memory.set('hiraeth.notes.list.v3', JSON.stringify({ at: 1234, issues: [], nextPage: null }));
  assert.equal(readList(storage), null);

  const issue = { number: 284, updatedAt: '2026-10-13T18:00:00Z' };
  const data = { comment: null, closedBy: { sha: 'a'.repeat(40) } };
  assert.equal(cachedActivity(storage, issue), null);
  storeActivity(storage, issue, data);
  assert.deepEqual(cachedActivity(storage, issue), data);
  assert.equal(cachedActivity(storage, { ...issue, updatedAt: '2026-10-13T19:00:00Z' }), null);   // (a new comment or label)
  for (let n = 1; n <= 210; n++) storeActivity(storage, { number: n, updatedAt: 'x' }, data);
  assert.ok(Object.keys(JSON.parse(memory.get('hiraeth.notes.activity.v1'))).length <= 200);
  // (no storage at all: nothing kept, nothing thrown)
  assert.equal(readList(null), null);
  assert.equal(storeActivity({ getItem: () => null, setItem: () => { throw new Error('full'); } }, issue, data), false);
});

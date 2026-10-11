import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleIssues, REPOSITORY } from '../worker/issues.js';
import { parseQuestions, latestQuestion, answerBody, tickChoices } from '../worker/questions.js';
import { questionCard, pageTitle } from '../src/notes-page/needs-you.js';

// ---- the format (docs/systems/notes.md "Questions for the author")
const block = (question, options = null, mode = 'single') => [
  '<!-- question -->', `**Question:** ${question}`,
  ...(options ? [`<!-- options: ${mode} -->`, ...options.map((o) => `- [ ] ${o}`)] : []),
  '<!-- /question -->',
].join('\n');

test('a single-choice block, with the paragraph above it as context', () => {
  const text = `Long issue text.\n\nThe crab fight takes 40 s now.\nThe brief says 20.\n${block('Which way?', ['Halve its health', 'Double the damage'])}\n\nAfter.`;
  assert.deepEqual(parseQuestions(text), [{ context: 'The crab fight takes 40 s now.\nThe brief says 20.', question: 'Which way?', mode: 'single', options: ['Halve its health', 'Double the damage'], ticked: [] }]);
});

test('multi, free text, CRLF and a two-line question', () => {
  assert.equal(parseQuestions(block('Which worlds?', ['Lorn', 'Vael', 'Viridel'], 'multi'))[0].mode, 'multi');
  const free = parseQuestions(block('What should the title say?'))[0];
  assert.deepEqual(free, { context: '', question: 'What should the title say?', mode: 'text', options: [], ticked: [] });
  const crlf = block('First line\nsecond line', ['A', 'B']).replace(/\n/g, '\r\n');
  assert.equal(parseQuestions(crlf)[0].question, 'First line\nsecond line');
});

test('malformed blocks are ignored', () => {
  for (const bad of [
    '<!-- question -->\nNo bold question\n<!-- /question -->',
    '<!-- question -->\n**Question:**   \n<!-- /question -->',
    block('Q', ['A'], 'some'),
    '<!-- question -->\n**Question:** Q\n- [ ] A\n<!-- /question -->',               // options without their mode
    '<!-- question -->\n**Question:** Q\n<!-- options: single -->\n<!-- /question -->', // a mode and no options
    '<!-- question -->\n**Question:** Q\n<!-- options: single -->\n- [ ] A\nstray line\n<!-- /question -->',
    block('Q', ['A', 'A']),
    '<!-- question -->\n**Question:** never closed',
  ]) assert.deepEqual(parseQuestions(bad), [], bad);
});

test('the latest valid block wins, across the body and the comments', () => {
  const body = block('Old?', ['x', 'y']);
  const comment = `${block('Middle?')}\n\n${block('Newest?', ['a', 'b'], 'multi')}`;
  assert.equal(latestQuestion([body, comment]).question, 'Newest?');
  assert.equal(latestQuestion([body, comment, block('broken', ['a'], 'nope')]).question, 'Newest?');
  assert.equal(latestQuestion([body, 'a plain comment']).question, 'Old?');
  assert.equal(latestQuestion(['nothing here']), null);
  assert.equal(latestQuestion([body, comment]).answered, false);
});

test('answered on GitHub: a ticked box, or any later comment; the page ticks the chosen boxes', () => {
  const ticked = block('Which?', ['A', 'B']).replace('- [ ] B', '- [x] B');
  assert.deepEqual(parseQuestions(ticked)[0].ticked, ['B']);
  assert.equal(latestQuestion([ticked]).answered, true);
  assert.equal(latestQuestion([block('Which?', ['A', 'B']), 'no need for a migration, okay to lose saves for people']).answered, true);
  assert.equal(latestQuestion([block('Name?'), 'Call it Hiraeth']).answered, true);
  const text = `Context.\r\n${block('Which?', ['Lorn', 'Vael', 'Viridel'], 'multi').replace(/\n/g, '\r\n')}\r\n\r\n${block('Later?', ['Lorn'])}`;
  const q = latestQuestion([text]);
  const edited = tickChoices(text, q.start, q.end, ['Lorn']);
  assert.deepEqual(parseQuestions(edited).map((b) => b.ticked), [[], ['Lorn']], 'only the latest block is ticked');
  const first = parseQuestions(text)[0];
  assert.equal(first.question, 'Which?');
});

test('the answer comment', () => {
  assert.equal(answerBody(['Halve its health'], ''), '**Answer:** Halve its health\n\nAnswered from the Hiraeth notebook.');
  assert.equal(answerBody(['Lorn', 'Vael'], 'and keep Viridel for later'), '**Answer:** Lorn; Vael\n\nand keep Viridel for later\n\nAnswered from the Hiraeth notebook.');
  assert.equal(answerBody([], 'Call it Hiraeth'), '**Answer:** Call it Hiraeth\n\nAnswered from the Hiraeth notebook.');
});

// ---- the Worker
const origin = 'https://notebook.example';
const allow = { limit: async () => ({ success: true }) };
const env = { HIRAETH_ISSUES_TOKEN: 'test-github-token', HIRAETH_NOTES_PASSWORD: 'testpw', NOTES_LOGIN_LIMITER: allow, NOTES_WRITE_LIMITER: allow };
const now = Date.UTC(2026, 9, 11);
const noFetch = () => { throw new Error('GitHub must not be called'); };
const API = `https://api.github.com/repos/${REPOSITORY}/issues`;
const request = (path, { method = 'GET', body, cookie, headers = {} } = {}) => new Request(`${origin}/api/notes/${path}`, {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  headers: { ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
});
async function login() {
  const response = await handleIssues(request('session', { method: 'POST', body: { password: env.HIRAETH_NOTES_PASSWORD } }), env, noFetch, now);
  return response.headers.get('Set-Cookie').split(';')[0];
}
const issue = (number, extra = {}) => ({ number, title: `Issue ${number}`, state: 'open', body: 'Plain body.', author_association: 'OWNER', comments: 1, labels: [{ name: 'needs-author' }], ...extra });
/** A fake GitHub: an issue, its comments; records every call. */
function github(issues, comments) {
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url, method: options.method ?? 'GET', body: options.body ? JSON.parse(options.body) : undefined });
    assert.equal(options.headers.Authorization, `Bearer ${env.HIRAETH_ISSUES_TOKEN}`);
    if (url.startsWith(`${API}?`)) return Response.json(issues);
    if (url.startsWith(`${API}/comments/`)) return Response.json({});
    const m = /\/issues\/(\d+)(\/comments|\/labels.*)?(\?.*)?$/.exec(url);
    const n = Number(m[1]);
    if (m[2] === '/comments' && (options.method ?? 'GET') === 'GET') return Response.json(comments[n] ?? []);
    if (m[2]) return Response.json({}, { status: options.method === 'POST' ? 201 : 200 });
    if (options.method === 'PATCH') return Response.json({});
    const found = issues.find((i) => i.number === n);
    return found ? Response.json(found) : new Response('{}', { status: 404 });
  };
  return { calls, fetcher };
}
const answerCalls = (calls) => calls.filter((c) => c.method !== 'GET');

test('listing: the open needs-author issues with their latest question; a stranger’s block and PRs are ignored', async () => {
  const c = await login();
  const { calls, fetcher } = github([issue(4), issue(9, { comments: 0, body: block('In the body?') }), { ...issue(10), pull_request: {} }], {
    4: [{ author_association: 'OWNER', body: block('Which?', ['A', 'B']) }, { author_association: 'NONE', body: block('Phish?', ['Click me']) }],
  });
  const response = await handleIssues(request('questions', { cookie: c }), env, fetcher, now);
  assert.equal(response.status, 200);
  const { questions } = await response.json();
  assert.deepEqual(questions.map((q) => [q.number, q.question.question]), [[4, 'Which?'], [9, 'In the body?']]);
  assert.equal(questions[0].url, `https://github.com/${REPOSITORY}/issues/4`);
  assert.match(calls[0].url, /state=open&labels=needs-author/);
  assert.ok(!calls.some((x) => x.url.includes('/9/comments')), 'no comments, no call');
  assert.doesNotMatch(JSON.stringify(questions), /test-github-token/);
});

test('issues answered on GitHub (a ticked box, a later comment) leave the list, and cannot be answered again', async () => {
  const c = await login();
  const ask = block('Which?', ['A', 'B']);
  const issues = [issue(4, { comments: 0, body: ask.replace('- [ ] A', '- [x] A') }), issue(5, { comments: 2 }), issue(6, { comments: 1 })];
  const comments = { 5: [{ author_association: 'OWNER', body: ask }, { author_association: 'OWNER', body: 'no need for a migration, okay to lose saves for people' }], 6: [{ author_association: 'OWNER', body: ask }] };
  const { fetcher } = github(issues, comments);
  const { questions } = await (await handleIssues(request('questions', { cookie: c }), env, fetcher, now)).json();
  assert.deepEqual(questions.map((q) => q.number), [6]);
  for (const n of [4, 5]) {
    const { calls, fetcher: f } = github(issues, comments);
    assert.equal((await handleIssues(request(`questions/${n}/answer`, { method: 'POST', cookie: c, body: { choices: ['B'] } }), env, f, now)).status, 409);
    assert.equal(answerCalls(calls).length, 0);
  }
});

test('an answer to a block in the issue body ticks it in the body', async () => {
  const c = await login();
  const { calls, fetcher } = github([issue(8, { comments: 0, body: `Context line.\n${block('Which?', ['A', 'B'])}` })], {});
  assert.equal((await handleIssues(request('questions/8/answer', { method: 'POST', cookie: c, body: { choices: ['B'], text: '' } }), env, fetcher, now)).status, 200);
  const patch = answerCalls(calls).find((x) => x.method === 'PATCH');
  assert.equal(patch.url, `${API}/8`);
  assert.equal(patch.body.body, `Context line.\n${block('Which?', ['A', 'B']).replace('- [ ] B', '- [x] B')}`);
});

test('answering needs the session, the Origin and the write limiter, like every write', async () => {
  const c = await login();
  const body = { choices: ['A'], text: '' };
  assert.equal((await handleIssues(request('questions', {}), env, noFetch, now)).status, 401);
  assert.equal((await handleIssues(request('questions/4/answer', { method: 'POST', body }), env, noFetch, now)).status, 401);
  assert.equal((await handleIssues(request('questions/4/answer', { method: 'POST', body, cookie: c, headers: { Origin: 'https://evil.example' } }), env, noFetch, now)).status, 403);
  assert.equal((await handleIssues(request('questions/4/answer', { cookie: c }), env, noFetch, now)).status, 405);
  assert.equal((await handleIssues(request('questions', { method: 'POST', body, cookie: c }), env, noFetch, now)).status, 405);
  for (const path of ['questions/0/answer', 'questions/abc/answer', 'questions/4']) assert.equal((await handleIssues(request(path, { method: 'POST', body, cookie: c }), env, noFetch, now)).status, 404, path);
  const limited = { ...env, NOTES_WRITE_LIMITER: { limit: async () => ({ success: false }) } };
  assert.equal((await handleIssues(request('questions/4/answer', { method: 'POST', body, cookie: c }), limited, noFetch, now)).status, 429);
});

test('an answer posts the comment, then takes needs-author off and puts answered on', async () => {
  const c = await login();
  const { calls, fetcher } = github([issue(4)], { 4: [{ id: 77, author_association: 'OWNER', body: block('Which?', ['Lorn', 'Vael', 'Viridel'], 'multi') }] });
  const response = await handleIssues(request('questions/4/answer', { method: 'POST', cookie: c, body: { choices: ['Lorn', 'Vael'], text: ' and soon ' } }), env, fetcher, now);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { answered: 4 });
  assert.deepEqual(answerCalls(calls), [
    { url: `${API}/4/comments`, method: 'POST', body: { body: '**Answer:** Lorn; Vael\n\nand soon\n\nAnswered from the Hiraeth notebook.' } },
    { url: `${API}/comments/77`, method: 'PATCH', body: { body: block('Which?', ['Lorn', 'Vael', 'Viridel'], 'multi').replace('- [ ] Lorn', '- [x] Lorn').replace('- [ ] Vael', '- [x] Vael') } },
    { url: `${API}/4/labels/needs-author`, method: 'DELETE', body: undefined },
    { url: `${API}/4/labels`, method: 'POST', body: { labels: ['answered'] } },
  ]);
});

test('answers are checked against the question before anything is written', async () => {
  const c = await login();
  const comments = { 4: [{ author_association: 'OWNER', body: block('Which?', ['A', 'B']) }] };
  const post = async (body, issues = [issue(4)]) => {
    const { calls, fetcher } = github(issues, comments);
    const response = await handleIssues(request('questions/4/answer', { method: 'POST', cookie: c, body }), env, fetcher, now);
    return { status: response.status, writes: answerCalls(calls).length };
  };
  assert.deepEqual(await post({ choices: [], text: '  ' }), { status: 400, writes: 0 });
  assert.deepEqual(await post({ choices: 'A' }), { status: 400, writes: 0 });
  assert.deepEqual(await post({ text: 'x'.repeat(4001) }), { status: 400, writes: 0 });
  assert.deepEqual(await post({ choices: ['A', 'B'] }), { status: 409, writes: 0 });            // single: one at most
  assert.deepEqual(await post({ choices: ['Not offered'] }), { status: 409, writes: 0 });
  assert.deepEqual(await post({ choices: ['A'] }, [issue(4, { labels: [{ name: 'answered' }] })]), { status: 409, writes: 0 });
  assert.deepEqual(await post({ choices: ['A'] }, [issue(4, { state: 'closed' })]), { status: 409, writes: 0 });
  assert.deepEqual(await post({ choices: ['A'] }, []), { status: 404, writes: 0 });
  assert.deepEqual(await post({ choices: [], text: 'My own answer' }), { status: 200, writes: 3 });
});

test('a label that fails after the comment says the answer is posted', async () => {
  const c = await login();
  const { fetcher } = github([issue(4, { comments: 0, body: block('Free?') })], {});
  const failing = async (url, options = {}) => url.endsWith('/labels') ? new Response('nope', { status: 500 }) : fetcher(url, options);
  const response = await handleIssues(request('questions/4/answer', { method: 'POST', cookie: c, body: { text: 'yes' } }), env, failing, now);
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /answer was posted/);
});

// ---- the page's card, on a small stand-in for the DOM
class FakeElement {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.listeners = {}; this.attributes = {}; this.dataset = {}; this.textContent = ''; this.value = ''; this.checked = false; this.disabled = false; this.className = '';
    const self = this; this.classList = { toggle(name, on) { const set = new Set(self.className.split(' ').filter(Boolean)); if (on) set.add(name); else set.delete(name); self.className = [...set].join(' '); } }; }
  append(...kids) { this.children.push(...kids); }
  setAttribute(k, v) { this.attributes[k] = v; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  click() { return this.listeners.click?.(); }
  focus() {}
  all(predicate, out = []) { for (const k of this.children) { if (predicate(k)) out.push(k); k.all(predicate, out); } return out; }
  byClass(name) { return this.all((k) => k.className.split(' ').includes(name)); }
}
const doc = { createElement: (tag) => new FakeElement(tag) };
const item = (question) => ({ number: 12, title: 'The crab fight', question });

test('the card: single as buttons, multi as checkboxes with Send, always a free-text box', async () => {
  const sent = [];
  const answer = async (a) => { sent.push(a); };
  const single = questionCard(doc, item({ context: 'It takes 40 s.', question: 'Which way?', mode: 'single', options: ['Halve', 'Double'] }), answer);
  assert.equal(single.byClass('question-title')[0].href, 'https://github.com/rnaud/hiraeth/issues/12');
  assert.equal(single.byClass('question-context')[0].textContent, 'It takes 40 s.');
  assert.equal(single.byClass('question-text')[0].textContent, 'Which way?');
  assert.deepEqual(single.byClass('question-option').map((b) => b.textContent), ['Halve', 'Double']);
  assert.equal(single.byClass('question-free')[0].placeholder, 'Or write your own answer');
  single.byClass('question-free')[0].value = ' because ';
  await single.byClass('question-option')[1].click();
  assert.deepEqual(sent.pop(), { choices: ['Double'], text: 'because' });

  const multi = questionCard(doc, item({ context: '', question: 'Which?', mode: 'multi', options: ['Lorn', 'Vael', 'Viridel'] }), answer);
  assert.equal(multi.byClass('question-context').length, 0);
  const boxes = multi.all((k) => k.type === 'checkbox');
  assert.equal(boxes.length, 3);
  boxes[0].checked = boxes[2].checked = true;
  await multi.byClass('question-send')[0].click();
  assert.deepEqual(sent.pop(), { choices: ['Lorn', 'Viridel'], text: '' });

  const free = questionCard(doc, item({ context: '', question: 'Name?', mode: 'text', options: [] }), answer);
  assert.equal(free.byClass('question-option').length + free.all((k) => k.type === 'checkbox').length, 0);
  await free.byClass('question-send')[0].click();
  assert.equal(sent.length, 0, 'an empty answer is not sent');
  assert.match(free.byClass('question-error')[0].textContent, /Write an answer/);
  free.byClass('question-free')[0].value = 'Hiraeth';
  await free.byClass('question-send')[0].click();
  assert.deepEqual(sent.pop(), { choices: [], text: 'Hiraeth' });

  const missing = questionCard(doc, item(null), answer);
  assert.match(missing.byClass('question-text')[0].textContent, /No question block/);
});

test('a failed answer is said on the card and its controls come back; the title counts the questions', async () => {
  const card = questionCard(doc, item({ context: '', question: 'Which?', mode: 'single', options: ['A'] }), async () => { throw new Error('Please wait a minute.'); });
  await card.byClass('question-option')[0].click();
  assert.equal(card.byClass('question-error')[0].textContent, 'Please wait a minute.');
  assert.equal(card.byClass('question-option')[0].disabled, false);
  assert.equal(pageTitle(0), 'Hiraeth — Notes');
  assert.equal(pageTitle(3), '(3) Hiraeth — Notes');
});

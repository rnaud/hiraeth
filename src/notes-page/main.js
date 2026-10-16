// No game engine, audio or GitHub credential. Same-origin Worker calls only.
import { questionCard, pageTitle } from './needs-you.js';
import { FILTERS, STATUS_TEXT, statusOf, matchesFilter, sortForFilter, filterCounts, otherLabels, relativeTime, shortSha,
  readList, writeList, cachedActivity, storeActivity, LIST_CACHE, ACTIVITY_CACHE, AUTO_PAGES } from './status-view.js';
import { syncList, mergeUpdates } from './list-sync.js';
const $ = (id) => document.getElementById(id);
const DRAFT = 'hiraeth.notes.draft.v1';
const OUTBOX = 'hiraeth.notes.outbox.v1';
let outbox = [];
try {
  const saved = JSON.parse(localStorage.getItem(OUTBOX) ?? '[]');
  if (Array.isArray(saved)) outbox = saved.filter((n) => typeof n.id === 'string' && typeof n.text === 'string').map((n) => ({ ...n, state: 'failed', error: 'Delivery unconfirmed. Check GitHub before retrying.' }));
} catch { /* unavailable storage */ }
function persistOutbox() {
  try { localStorage.setItem(OUTBOX, JSON.stringify(outbox)); }
  catch { notice('Keep this page open: pending notes could not be saved on this device.', true); }
}
function resizeComposer() {
  const box = $('new-note'); box.style.height = 'auto';
  box.style.height = `${box.scrollHeight + 2}px`;
}
const HOSTED = 'https://hiraeth.alexandria-rnaud.workers.dev/notes';
// Bundled/native and GitHub Pages copies cannot use same-origin cookie auth on the Worker.
// Offer a normal top-level navigation instead of cross-origin credentials or tokens in URLs.
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const onWorker = location.hostname === new URL(HOSTED).hostname;
let issues = [], nextPage = null, loading = false, generation = 0;
// (#277: each note's status, a filter by it, and an opened note's latest comment and landing commit)
const FILTER = 'hiraeth.notes.filter.v1';
const store = (() => { try { return localStorage; } catch { return null; } })();
let filter = 'todo', listedAt = null, fullAt = null;
try { const f = store?.getItem(FILTER); if (FILTERS.some(([k]) => k === f)) filter = f; } catch { /* private browsing */ }
const expanded = new Set();
const activity = new Map();   // number → { updatedAt, state: 'loading' | 'ok' | 'error', data, error }
const REPO_URL = 'https://github.com/rnaud/hiraeth';

function notice(text = '', error = false) { $('notice').textContent = text; $('notice').classList.toggle('error', error); }
function signedIn(on) { $('signin').hidden = on; $('board').hidden = !on; $('lock').hidden = !on; if (on) resizeComposer(); }
function updateDraft() {
  resizeComposer();
  $('length').textContent = `${$('new-note').value.length} / 4000`;
  try {
    if ($('new-note').value) localStorage.setItem(DRAFT, $('new-note').value);
    else localStorage.removeItem(DRAFT);
    $('draft-hint').textContent = $('new-note').value ? 'Draft saved' : 'Enter for a new line · ⌘/Ctrl + Enter to add';
  } catch { $('draft-hint').textContent = 'Keep this page open to keep your draft.'; }
}
async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api/notes/${path}`, { ...options, credentials: 'same-origin', cache: 'no-store',
      signal: AbortSignal.timeout(20000), headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}) } });
  } catch {
    throw new Error(options.method === 'POST' && path === 'issues'
      ? 'We could not confirm whether the note was saved. Refresh the list before trying again.'
      : 'Could not connect. Check your connection and try again.');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('The notebook service is not available here yet. Please try again later.'); }
  if (!response.ok) {
    if (response.status === 401 && path !== 'session') signedIn(false);
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }
  return data;
}
function element(tag, className, text) {
  const el = document.createElement(tag); el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function outLink(className, text, href) {
  const a = element('a', className, text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
  return a;
}
function issueRow(issue) {
  const status = statusOf(issue), open = expanded.has(issue.number);
  const li = element('li', `issue status-${status}`); li.dataset.number = issue.number; li.dataset.status = status;
  const dot = element('span', 'issue-dot'); dot.setAttribute('aria-hidden', 'true');
  const content = element('div', 'issue-content');
  // Construct the destination rather than trusting a stored title/body/URL as markup.
  const href = `${REPO_URL}/issues/${Number(issue.number)}`;
  const link = outLink('issue-title', issue.title, href);
  const meta = element('div', 'issue-meta');
  meta.append(element('span', `status status-${status}`, STATUS_TEXT[status]));
  meta.append(element('span', '', `#${issue.number}`));
  const done = status === 'done';
  const date = new Date(done && issue.closedAt ? issue.closedAt : issue.createdAt);
  if (!Number.isNaN(date.valueOf())) meta.append(element('span', '', `${done ? 'closed ' : ''}${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`));
  for (const label of otherLabels(issue)) meta.append(element('span', 'label', label));
  if (issue.comments) meta.append(element('span', '', `${issue.comments} ${issue.comments === 1 ? 'reply' : 'replies'}`));
  const toggle = element('button', 'text-button issue-toggle', open ? 'Hide activity ▴' : 'Activity ▾'); toggle.type = 'button';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.addEventListener('click', () => {
    if (expanded.has(issue.number)) expanded.delete(issue.number); else expanded.add(issue.number);
    render(); document.querySelector(`#issues li[data-number="${Number(issue.number)}"] .issue-toggle`)?.focus();
  });
  meta.append(toggle);
  content.append(link, meta);
  if (open) content.append(activityPanel(issue));
  const arrow = element('span', 'issue-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true');
  li.append(dot, content, arrow); return li;
}
/** An opened note: its latest comment (who, when, the first lines), the commit that closed it, its issue. */
function activityPanel(issue) {
  const panel = element('div', 'activity');
  const a = activity.get(issue.number);
  if (!a || a.state === 'loading') { panel.append(element('p', 'activity-line', 'Reading its latest activity…')); return panel; }
  if (a.state === 'error') { panel.append(element('p', 'activity-line error', a.error)); return panel; }
  const { comment, closedBy } = a.data ?? {};
  const href = `${REPO_URL}/issues/${Number(issue.number)}`;
  if (comment) {
    const who = element('p', 'activity-who');
    who.append(element('strong', '', comment.author), element('span', '', ` · ${relativeTime(comment.at)}`));
    panel.append(who, element('p', 'activity-text', comment.excerpt || '(no text)'));
  } else panel.append(element('p', 'activity-line', 'No comments yet.'));
  const foot = element('p', 'activity-foot');
  if (closedBy) {
    const landed = element('span', '', 'Landed in ');
    landed.append(outLink('commit', shortSha(closedBy.sha), `${REPO_URL}/commit/${closedBy.sha}`));
    foot.append(landed);
  }
  else if (statusOf(issue) === 'done') foot.append(element('span', '', issue.stateReason === 'not_planned' ? 'Closed as not planned' : 'Closed'));
  foot.append(outLink('', comment?.id ? 'Read the thread ↗' : `Open #${Number(issue.number)} ↗`, comment?.id ? `${href}#issuecomment-${Number(comment.id)}` : href));
  panel.append(foot);
  return panel;
}
async function loadActivity(issue) {
  const n = issue.number;
  const cached = cachedActivity(store, issue);
  if (cached) { activity.set(n, { updatedAt: issue.updatedAt, state: 'ok', data: cached }); return; }
  activity.set(n, { updatedAt: issue.updatedAt, state: 'loading' });
  try {
    const { issue: fresh, comment, closedBy } = await api(`issues/${Number(n)}/activity`);
    const data = { comment, closedBy };
    storeActivity(store, fresh, data);
    activity.set(n, { updatedAt: fresh.updatedAt, state: 'ok', data });
    issues = issues.map((i) => i.number === n ? { ...i, ...fresh } : i);   // (its status may have moved since the list)
  } catch (e) { activity.set(n, { updatedAt: issue.updatedAt, state: 'error', error: e.message }); }
  render();
}
function renderFilters(counts) {
  $('filters').replaceChildren(...FILTERS.map(([key, text]) => {
    const b = element('button', `filter status-${key}`); b.type = 'button';
    b.setAttribute('aria-pressed', String(key === filter));
    b.append(element('span', '', text), element('span', 'filter-count', String(counts[key])));
    b.addEventListener('click', () => {
      filter = key; try { store?.setItem(FILTER, key); } catch { /* private browsing */ }
      render(); document.querySelector(`#filters .status-${key}`)?.focus();
    });
    return b;
  }));
}
function pendingRow(note) {
  const li = element('li', `issue pending ${note.state}`); li.dataset.pending = note.id;
  const dot = element('span', 'issue-dot'); dot.setAttribute('aria-hidden', 'true');
  const content = element('div', 'issue-content');
  content.append(element('div', 'issue-title pending-text', note.text));
  const meta = element('div', 'issue-meta');
  meta.append(element('span', '', note.state === 'sending' ? 'Sending…' : note.error));
  if (note.state === 'failed') {
    const check = element('a', '', 'Check GitHub'); check.href = 'https://github.com/rnaud/hiraeth/issues'; check.target = '_blank'; check.rel = 'noopener noreferrer';
    const retry = element('button', 'text-button', 'Retry'); retry.type = 'button'; retry.addEventListener('click', () => send(note));
    const discard = element('button', 'text-button', 'Remove draft'); discard.type = 'button'; discard.addEventListener('click', () => { outbox = outbox.filter((n) => n.id !== note.id); persistOutbox(); render(); });
    meta.append(check, retry, discard);
  }
  content.append(meta); li.append(dot, content); return li;
}
async function send(note) {
  if (note.state === 'sending') return;
  note.state = 'sending'; note.error = ''; persistOutbox(); render();
  try {
    const { issue } = await api('issues', { method: 'POST', body: JSON.stringify({ text: note.text }) });
    generation++;
    issues = [issue, ...issues.filter((i) => i.number !== issue.number)];
    outbox = outbox.filter((n) => n.id !== note.id);
  } catch (e) { note.state = 'failed'; note.error = e.message; }
  finally { persistOutbox(); render(); }
}
function render() {
  const q = $('search').value.trim().toLocaleLowerCase();
  const searched = issues.filter((i) => `${i.title} ${i.number} ${(i.labels ?? []).join(' ')} ${STATUS_TEXT[statusOf(i)]}`.toLocaleLowerCase().includes(q));
  const matches = sortForFilter(searched.filter((i) => matchesFilter(i, filter)), filter);
  const pending = filter === 'done' ? [] : outbox.filter((n) => n.text.toLocaleLowerCase().includes(q));
  // (an opened note's activity: from the cache while its updatedAt stands, else one call to the Worker)
  for (const i of matches) {
    const a = activity.get(i.number);
    if (expanded.has(i.number) && (!a || (a.state !== 'loading' && a.updatedAt !== i.updatedAt))) void loadActivity(i);
  }
  $('issues').replaceChildren(...pending.map(pendingRow), ...matches.map(issueRow));
  $('lock').disabled = outbox.some((n) => n.state === 'sending');
  renderFilters(filterCounts(searched));
  const all = filterCounts(issues);
  $('count').textContent = `${all.todo} to do · ${all.all}${nextPage ? '+' : ''} in all`;
  $('more').hidden = !nextPage;
  const which = filter === 'all' || filter === 'todo' ? '' : `“${STATUS_TEXT[filter]}” `;
  $('list-status').textContent = matches.length || pending.length ? '' : q || which
    ? `No ${which}${q ? 'matching ' : ''}notes${nextPage ? ' in the loaded list. Load more to keep looking' : ''}.`
    : nextPage ? 'No notes on this page. Load more to continue.' : filter === 'todo' && issues.length ? 'Nothing left to do.' : 'A clean page. Add your first thought above.';
  $('listed-at').textContent = listedAt ? `Updated ${relativeTime(new Date(listedAt).toISOString())}` : '';
}
/** The list with each note's status (state=all, 100 a page). A refresh asks only for the issues updated since the
 *  list kept on the device (#388, list-sync.js); a whole read (no list kept, a day old, Reload all) asks for page 1,
 *  then the rest up to AUTO_PAGES at once, so the filter's counts are whole; Load more reads one page past them. */
async function load({ page = 1, all = false } = {}) {
  if (loading) return;
  loading = true; $('refresh').disabled = $('reload-all').disabled = $('more').disabled = true;
  const version = generation;
  if (!issues.length) $('list-status').textContent = 'Reading your notes…';
  try {
    if (page > 1) {
      const data = await api(`issues?state=all&page=${page}`);
      if (version !== generation) return;
      issues = mergeUpdates(issues, data.issues); nextPage = data.nextPage;
    } else {
      const got = await syncList(api, { issues, nextPage, fullAt }, { all, maxPages: AUTO_PAGES });
      if (version !== generation) return;
      ({ issues, nextPage, fullAt } = got);
    }
    listedAt = Date.now();
    writeList(store, issues, nextPage, listedAt, fullAt ?? listedAt);
    render();
  } catch (e) {
    render();
    $('list-status').textContent = listedAt
      ? `${e.message} Showing the list from ${new Date(listedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}.`
      : e.message;
  }
  finally { loading = false; $('refresh').disabled = $('reload-all').disabled = $('more').disabled = false; }
}
/** The list kept from the last visit, shown while the new one loads. */
function showCachedList() {
  const cached = readList(store);
  if (!cached || issues.length) return;
  issues = cached.issues.filter((i) => Number.isSafeInteger(i?.number) && typeof i.title === 'string');
  nextPage = cached.nextPage; listedAt = cached.at; fullAt = cached.fullAt; render();
}
// ---- the screenshot drafts (worker/drafts.js, issue #8): taken in the game, written up and sent from here
let drafts = [];
const SHOTS = `${location.origin}/api/notes/shots/`;
function draftRow(d) {
  const li = element('li', 'draft'); li.dataset.draft = d.id;
  const img = document.createElement('img'); img.alt = 'Screenshot'; img.loading = 'lazy';
  if (typeof d.shot === 'string' && d.shot.startsWith(SHOTS)) img.src = d.shot;
  const body = element('div', 'draft-body');
  const meta = element('div', 'issue-meta');
  const c = d.context ?? {};
  for (const part of [c.world ?? c.level, c.x !== undefined ? `${c.x} ${c.y} ${c.z}` : null, c.build ? `build ${c.build}` : null, c.preset, c.device]) if (part) meta.append(element('span', '', String(part)));
  const date = new Date(d.createdAt);
  if (!Number.isNaN(date.valueOf())) meta.append(element('span', '', date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })));
  const text = document.createElement('textarea'); text.maxLength = 4000; text.value = d.text ?? ''; text.setAttribute('aria-label', 'What this screenshot shows');
  text.placeholder = 'What is wrong here? The first line is the title.';
  const actions = element('div', 'draft-actions');
  const send = element('button', 'send', 'Send as an issue'); send.type = 'button';
  const remove = element('button', 'text-button', 'Delete'); remove.type = 'button';
  const error = element('span', 'draft-error');
  send.addEventListener('click', async () => {
    if (!text.value.trim()) { error.textContent = 'Write a line first.'; text.focus(); return; }
    send.disabled = remove.disabled = true; error.textContent = '';
    try {
      const { issue } = await api(`drafts/${d.id}/publish`, { method: 'POST', body: JSON.stringify({ text: text.value }) });
      generation++;
      issues = [issue, ...issues.filter((i) => i.number !== issue.number)];
      drafts = drafts.filter((x) => x.id !== d.id); renderDrafts(); render();
    } catch (e) { error.textContent = e.message; send.disabled = remove.disabled = false; }
  });
  remove.addEventListener('click', async () => {
    if (!confirm('Delete this screenshot draft?')) return;
    send.disabled = remove.disabled = true;
    try { await api(`drafts/${d.id}`, { method: 'DELETE' }); drafts = drafts.filter((x) => x.id !== d.id); renderDrafts(); }
    catch (e) { error.textContent = e.message; send.disabled = remove.disabled = false; }
  });
  actions.append(send, remove, error);
  body.append(meta, text, actions);
  li.append(img, body);
  return li;
}
function renderDrafts() {
  $('drafts').replaceChildren(...drafts.map(draftRow));
  $('drafts-count').textContent = drafts.length ? `${drafts.length}` : '';
  $('drafts-section').hidden = !drafts.length;
}
async function loadDrafts() {
  try { ({ drafts } = await api('drafts')); renderDrafts(); }
  catch { drafts = []; renderDrafts(); }   // (no drafts store yet: the section stays hidden)
}
$('pair-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = $('pair-code').value.trim().toUpperCase();
  $('pair').disabled = true; $('pair-status').textContent = '';
  try { await api('pair/approve', { method: 'POST', body: JSON.stringify({ code }) }); $('pair-code').value = ''; $('pair-status').textContent = 'Paired. The device sends its screenshots in a moment.'; setTimeout(loadDrafts, 8000); }
  catch (err) { $('pair-status').textContent = err.message; }
  finally { $('pair').disabled = false; }
});

// ---- the questions waiting on the author (worker/questions.js, the `needs-author` label)
let questions = [];
function renderQuestions() {
  $('needs').replaceChildren(...questions.map((item) => questionCard(document, item, async (answer) => {
    await api(`questions/${Number(item.number)}/answer`, { method: 'POST', body: JSON.stringify(answer) });
    questions = questions.filter((x) => x.number !== item.number); renderQuestions();
    notice(`Answered #${item.number}.`);
  })));
  $('needs-count').textContent = questions.length ? `${questions.length}` : '';
  $('needs-section').hidden = !questions.length;
  document.title = pageTitle(questions.length);
}
async function loadQuestions() {
  try { ({ questions } = await api('questions')); renderQuestions(); }
  catch { questions = []; renderQuestions(); }   // (an older Worker: the section stays hidden)
}

async function enter() { signedIn(true); notice(); showCachedList(); await Promise.all([load(), loadDrafts(), loadQuestions()]); }

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault(); if ($('unlock').disabled) return;
  $('unlock').disabled = true; notice('Opening your notebook…');
  try { await api('session', { method: 'POST', body: JSON.stringify({ password: $('password').value }) }); $('password').value = ''; await enter(); $('new-note').focus(); }
  catch (e) { notice(e.message, true); }
  finally { $('unlock').disabled = false; }
});
$('note-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('new-note').value.trim();
  if (!text) return;
  const note = { id: crypto.randomUUID(), text, state: 'queued' };
  outbox.unshift(note); persistOutbox(); generation++;
  $('new-note').value = ''; $('search').value = ''; updateDraft(); notice();
  render(); $('new-note').focus();
  void send(note);
});
$('new-note').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.isComposing) { e.preventDefault(); $('note-form').requestSubmit(); }
});
window.addEventListener('resize', resizeComposer);
$('new-note').addEventListener('input', updateDraft);
$('search').addEventListener('input', render);
$('refresh').addEventListener('click', () => { load(); loadDrafts(); loadQuestions(); });
$('reload-all').addEventListener('click', () => { load({ all: true }); loadDrafts(); loadQuestions(); });
$('more').addEventListener('click', () => { if (nextPage) load({ page: nextPage }); });
$('lock').addEventListener('click', async () => {
  if (outbox.some((n) => n.state === 'sending')) return;
  $('lock').disabled = true;
  try {
    await api('session', { method: 'DELETE' }); generation++; issues = []; nextPage = null; listedAt = null; fullAt = null;
    questions = []; activity.clear(); expanded.clear();
    try { store?.removeItem(LIST_CACHE); store?.removeItem(ACTIVITY_CACHE); } catch { /* private browsing */ }
    renderQuestions(); render(); signedIn(false); notice('Signed out.');
  }
  catch (e) { notice(e.message, true); }
  finally { $('lock').disabled = false; }
});

if (!local && !onWorker) {
  notice('Your notebook lives on the Hiraeth website.');
  const link = element('a', 'more', 'Open your notebook ↗'); link.href = HOSTED; $('notice').after(link);
} else {
  try { $('new-note').value = localStorage.getItem(DRAFT) ?? ''; } catch { /* private browsing */ }
  updateDraft();
  try {
    const { authenticated } = await api('session');
    if (authenticated) await enter(); else { signedIn(false); notice(); }
  } catch (e) { notice(e.message, true); }
}

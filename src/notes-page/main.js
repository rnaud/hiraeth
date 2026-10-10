// No game engine, audio or GitHub credential. Same-origin Worker calls only.
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
const HOSTED = 'https://memento.alexandria-rnaud.workers.dev/notes';
// Bundled/native and GitHub Pages copies cannot use same-origin cookie auth on the Worker.
// Offer a normal top-level navigation instead of cross-origin credentials or tokens in URLs.
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const onWorker = location.hostname === new URL(HOSTED).hostname;
let issues = [], nextPage = null, loading = false, generation = 0;

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
function issueRow(issue) {
  const li = element('li', 'issue'); li.dataset.number = issue.number;
  const dot = element('span', 'issue-dot'); dot.setAttribute('aria-hidden', 'true');
  const content = element('div', 'issue-content');
  // Construct the destination rather than trusting a stored title/body/URL as markup.
  const href = `https://github.com/rnaud/hiraeth/issues/${Number(issue.number)}`;
  const link = element('a', 'issue-title', issue.title); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  const meta = element('div', 'issue-meta');
  meta.append(element('span', '', `#${issue.number}`));
  const date = new Date(issue.createdAt);
  if (!Number.isNaN(date.valueOf())) meta.append(element('span', '', date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })));
  for (const label of issue.labels ?? []) meta.append(element('span', 'label', label));
  if (issue.comments) meta.append(element('span', '', `${issue.comments} ${issue.comments === 1 ? 'reply' : 'replies'}`));
  content.append(link, meta);
  const arrow = element('span', 'issue-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true');
  li.append(dot, content, arrow); return li;
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
  const matches = issues.filter((i) => `${i.title} ${i.number} ${(i.labels ?? []).join(' ')}`.toLocaleLowerCase().includes(q));
  const pending = outbox.filter((n) => n.text.toLocaleLowerCase().includes(q));
  $('issues').replaceChildren(...pending.map(pendingRow), ...matches.map(issueRow));
  $('lock').disabled = outbox.some((n) => n.state === 'sending');
  $('count').textContent = `${issues.length}${nextPage ? '+' : ''} open`;
  $('more').hidden = !nextPage;
  $('list-status').textContent = matches.length || pending.length ? '' : q
    ? `No matching notes${nextPage ? ' in the loaded list. Load more to keep looking' : ''}.`
    : nextPage ? 'No notes on this page. Load more to continue.' : 'A clean page. Add your first thought above.';
}
async function load(page = 1) {
  if (loading) return;
  loading = true; $('refresh').disabled = $('more').disabled = true;
  const version = generation;
  $('list-status').textContent = 'Reading your notes…';
  try {
    const data = await api(`issues?page=${page}`);
    if (version !== generation) return;
    issues = [...new Map([...(page === 1 ? [] : issues), ...data.issues].map((i) => [i.number, i])).values()];
    nextPage = data.nextPage; render();
  } catch (e) { $('list-status').textContent = e.message; }
  finally { loading = false; $('refresh').disabled = $('more').disabled = false; }
}
async function enter() { signedIn(true); notice(); await load(); }

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
$('refresh').addEventListener('click', () => load());
$('more').addEventListener('click', () => { if (nextPage) load(nextPage); });
$('lock').addEventListener('click', async () => {
  if (outbox.some((n) => n.state === 'sending')) return;
  $('lock').disabled = true;
  try { await api('session', { method: 'DELETE' }); generation++; issues = []; nextPage = null; render(); signedIn(false); notice('Signed out.'); }
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

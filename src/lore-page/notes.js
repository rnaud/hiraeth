// The lore page's notes (issue #269, docs/systems/lore-page.md): a Note on any part of the page files a GitHub
// issue through the Notes page's own path, the Worker's POST /api/notes/issues (worker/issues.js), with the
// notebook's own signed-in session (its HttpOnly cookie: no token or password ever reaches this page). The issue's
// title is the comment's first line, its body the comment and what it is about, and its last line says it came from
// here (`source: 'lore'`: "Added from the Hiraeth lore page."). Away from the Worker (GitHub Pages, a bundled copy)
// the box says so and links to this page on the Notes site instead. Pure but for `fetch`: tests/lore-page.test.js.

/** The Notes site (as src/notes-page/main.js HOSTED), and this page on it. */
export const NOTES_SITE = 'https://hiraeth.alexandria-rnaud.workers.dev';
export const LORE_URL = `${NOTES_SITE}/lore`;
export const NOTES_URL = `${NOTES_SITE}/notes`;
export const MAX = 4000;

/** Can this copy of the page reach the notebook's API (same origin: the Worker, or a local `wrangler dev`)? */
export function notesHere(loc = globalThis.location) {
  const host = loc?.hostname ?? '';
  return host === new URL(NOTES_SITE).hostname || ['localhost', '127.0.0.1', '[::1]'].includes(host);
}

/** The issue's text: the comment, then the part of the page it is about (its name and its link). */
export function noteText(comment, { label, anchor }) {
  return `${String(comment).trim()}\n\nOn the lore page: **${label}** (${LORE_URL}#${anchor})`;
}

/** What the Worker gets: the text and where it came from. */
export const noteRequest = (comment, ref) => ({ text: noteText(comment, ref), source: 'lore' });

async function call(path, options = {}, fetcher = globalThis.fetch) {
  let response;
  try {
    response = await fetcher(`/api/notes/${path}`, { ...options, credentials: 'same-origin', cache: 'no-store',
      headers: options.body ? { 'Content-Type': 'application/json' } : {} });
  } catch {
    throw new Error(options.method === 'POST' ? 'We could not confirm whether the note was saved. Check the issues before sending it again.' : 'Could not reach the notebook. Check your connection.');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('The notebook is not available here.'); }
  if (!response.ok) { const e = new Error(data?.error || 'Something went wrong. Please try again.'); e.status = response.status; throw e; }
  return data;
}

/** Is this browser signed in to the notebook? (false if the API is not there) */
export async function signedIn(fetcher) {
  try { return (await call('session', {}, fetcher)).authenticated === true; } catch { return false; }
}

/**
 * File a note about `ref` ({ label, anchor }): the issue the Worker made ({ number, url, title }). `request`: what the
 * Worker gets for it (another page's own: the music page's, src/music-page/notes.js).
 */
export async function fileNote(comment, ref, fetcher, request = noteRequest) {
  const text = String(comment ?? '').trim();
  if (!text) throw new Error('Write a line first.');
  const body = request(text, ref);
  if (body.text.length > MAX) throw new Error(`Please keep a note under ${MAX - (body.text.length - text.length)} characters.`);
  const { issue } = await call('issues', { method: 'POST', body: JSON.stringify(body) }, fetcher);
  return issue;
}

// The note box of the pages that file notes as GitHub issues (the lore page, the music page: docs/systems/lore-page.md
// "Notes on everything"): one <dialog id="note-box">, opened by any `.note-btn` (its data-note, the anchor; data-label,
// what it is about). Signed in to the notebook on this origin, it files the note (`file`: src/lore-page/notes.js
// fileNote with the page's own request); not signed in, it sends you to the Notes page first; away from the Worker
// (GitHub Pages, a bundled copy) it links to the same part of the page on the Notes site (`siteUrl`).
import { notesHere, signedIn, NOTES_URL, MAX } from './notes.js';

export function setupNoteBox({ siteUrl, file, doc = document }) {
  const $ = (s) => doc.querySelector(s);
  const box = $('#note-box'), form = $('#note-form'), text = $('#note-text'), status = $('#note-status'), send = $('#note-send');
  const here = notesHere();
  let ref = null, session = null;
  const drafts = new Map();
  const say = (html, error = false) => { status.innerHTML = html; status.classList.toggle('error', error); };
  const link = (href, label) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;

  async function open(button) {
    ref = { anchor: button.dataset.note, label: button.dataset.label, id: button.dataset.id };
    $('#note-about').textContent = ref.label;
    text.value = drafts.get(ref.anchor) ?? '';
    form.hidden = true; say('');
    box.showModal();
    if (!here) {
      say(`Notes are filed from the Hiraeth site, where you are signed in to the notebook. ${link(`${siteUrl}#${encodeURIComponent(ref.anchor)}`, 'Open this on the Notes site ↗')}`);
      return;
    }
    session ??= signedIn();
    if (!await session) {
      session = null;   // (ask again next time: you may have signed in meanwhile)
      say(`Sign in to the notebook first: ${link('notes.html', 'open the Notes page ↗')}, unlock it, then come back and press Note again.`);
      return;
    }
    form.hidden = false; text.focus();
  }
  doc.addEventListener('click', (e) => { const b = e.target.closest('.note-btn'); if (b) open(b); });
  $('#note-close').addEventListener('click', () => box.close());
  text.maxLength = MAX - 300;
  text.addEventListener('input', () => { if (ref) drafts.set(ref.anchor, text.value); });
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (send.disabled || !ref || form.hidden) return;
    send.disabled = true; say('Sending…');
    try {
      const issue = await file(text.value, ref);
      drafts.delete(ref.anchor); text.value = ''; form.hidden = true;
      say(`Filed as ${link(`https://github.com/rnaud/hiraeth/issues/${Number(issue.number)}`, `#${Number(issue.number)} ↗`)}.`);
      const b = doc.querySelector(`.note-btn[data-note="${CSS.escape(ref.anchor)}"]`);
      if (b) { b.classList.add('noted'); b.textContent = 'Noted'; }
    } catch (err) {
      if (err.status === 401) { session = null; say(`The notebook signed you out. ${link('notes.html', 'Sign in again ↗')}; your note is kept here.`, true); }
      else say(err.message, true);
    } finally { send.disabled = false; }
  });
  const notes = $('#notes-link');
  if (notes) notes.href = here ? 'notes.html' : NOTES_URL;
}

// The lore page (lore.html, docs/systems/lore-page.md; issues #268, #269): the game's lore, its traveller, each world
// on the route with its people, temples, guardians and gadgets, and every item, built from the game's own data
// (scripts/lore-data.mjs, `virtual:hiraeth-lore`), with a Note on every part (src/lore-page/notes.js).
import LORE from 'virtual:hiraeth-lore';
import { lorePage } from './view.js';
import { notesHere, signedIn, fileNote, LORE_URL, NOTES_URL, MAX } from './notes.js';

const $ = (s) => document.querySelector(s);
const { nav, main } = lorePage(LORE);
$('#sections').innerHTML = nav;
$('#lore').innerHTML = main;
for (const img of document.querySelectorAll('#lore img')) img.addEventListener('error', () => img.closest('figure')?.remove() ?? img.remove(), { once: true });
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();

// ---- the notes: one box, opened by any part's Note button
const box = $('#note-box'), form = $('#note-form'), text = $('#note-text'), status = $('#note-status'), send = $('#note-send');
const here = notesHere();
let ref = null, session = null;
const drafts = new Map();
const say = (html, error = false) => { status.innerHTML = html; status.classList.toggle('error', error); };
const link = (href, label) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;

async function open(button) {
  ref = { anchor: button.dataset.note, label: button.dataset.label };
  $('#note-about').textContent = ref.label;
  text.value = drafts.get(ref.anchor) ?? '';
  form.hidden = true; say('');
  box.showModal();
  if (!here) {
    say(`Notes are filed from the Hiraeth site, where you are signed in to the notebook. ${link(`${LORE_URL}#${encodeURIComponent(ref.anchor)}`, 'Open this on the Notes site ↗')}`);
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
document.addEventListener('click', (e) => { const b = e.target.closest('.note-btn'); if (b) open(b); });
$('#note-close').addEventListener('click', () => box.close());
text.maxLength = MAX - 300;
text.addEventListener('input', () => { if (ref) drafts.set(ref.anchor, text.value); });
text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); form.requestSubmit(); } });
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (send.disabled || !ref || form.hidden) return;
  send.disabled = true; say('Sending…');
  try {
    const issue = await fileNote(text.value, ref);
    drafts.delete(ref.anchor); text.value = ''; form.hidden = true;
    say(`Filed as ${link(`https://github.com/rnaud/hiraeth/issues/${Number(issue.number)}`, `#${Number(issue.number)} ↗`)}.`);
    const b = document.querySelector(`.note-btn[data-note="${CSS.escape(ref.anchor)}"]`);
    if (b) { b.classList.add('noted'); b.textContent = 'Noted'; }
  } catch (err) {
    if (err.status === 401) { session = null; say(`The notebook signed you out. ${link('notes.html', 'Sign in again ↗')}; your note is kept here.`, true); }
    else say(err.message, true);
  } finally { send.disabled = false; }
});
$('#notes-link').href = here ? 'notes.html' : NOTES_URL;

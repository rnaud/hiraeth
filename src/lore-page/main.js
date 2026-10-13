// The lore page (lore.html, docs/systems/lore-page.md; issues #268, #269): the game's lore, its traveller, each world
// on the route with its people, temples, guardians and gadgets, and every item, built from the game's own data
// (scripts/lore-data.mjs, `virtual:hiraeth-lore`), with a Note on every part (src/lore-page/notes.js).
import LORE from 'virtual:hiraeth-lore';
import { lorePage } from './view.js';
import { fileNote, LORE_URL } from './notes.js';
import { setupNoteBox } from './note-box.js';

const $ = (s) => document.querySelector(s);
const { nav, main } = lorePage(LORE);
$('#sections').innerHTML = nav;
$('#lore').innerHTML = main;
for (const img of document.querySelectorAll('#lore img')) img.addEventListener('error', () => img.closest('figure')?.remove() ?? img.remove(), { once: true });
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();

// ---- the notes: one box, opened by any part's Note button (src/lore-page/note-box.js)
setupNoteBox({ siteUrl: LORE_URL, file: (text, ref) => fileNote(text, ref) });

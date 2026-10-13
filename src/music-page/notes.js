// The music page's notes (issue #270): a Note on any song or sound files a GitHub issue the way the lore page's do
// (src/lore-page/notes.js: the Worker's POST /api/notes/issues with the notebook's signed-in cookie), its body naming
// the song or sound, its id in the catalogue (src/music-page/catalog.js) and its link on the page, and its footer
// "Added from the Hiraeth music page." (`source: 'music'`, worker/issues.js SOURCES).
import { NOTES_SITE, fileNote } from '../lore-page/notes.js';

export const MUSIC_URL = `${NOTES_SITE}/music`;

/** The issue's text: the comment, then what it is about (its name, its id, its link). */
export function noteText(comment, { label, anchor, id = anchor }) {
  return `${String(comment).trim()}\n\nOn the music page: **${label}** (\`${id}\`, ${MUSIC_URL}#${anchor})`;
}
export const noteRequest = (comment, ref) => ({ text: noteText(comment, ref), source: 'music' });
/** File a note about a song or a sound: the issue the Worker made. */
export const fileMusicNote = (comment, ref, fetcher) => fileNote(comment, ref, fetcher, noteRequest);

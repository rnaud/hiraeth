// The game's source text by its path from the repository root, for tests whose files are named by a data table (the
// HUD's prompts, the sound QC's patterns): src/ and engine/ through their literal catalogues (tests/catalogs/, checked
// against the directories by tests/test-catalogs.test.js) and index.html by name, so the test selector follows every
// read, where it could not follow a path computed from data. A path anywhere else is refused, never read unseen.
import { readFileSync } from 'node:fs';
import { srcText } from './src-tree.js';
import { source as engineSource } from './catalogs/engine-sources.js';

/** The text of `src/…`, `engine/…` or `index.html`. */
export function gameText(path) {
  if (path === 'index.html') return readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  if (path.startsWith('engine/')) return engineSource(path.slice('engine/'.length));
  if (path.startsWith('src/')) return srcText(path);
  throw Error(`${path}: not under src/ or engine/, nor index.html (tests/game-text.js)`);
}

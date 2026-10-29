// The files under src/ for tests that scan the source, through the literal catalogue tests/catalogs/src-sources.js
// (checked against the directory by tests/test-catalogs.test.js, so none can be missed): the test selector follows
// these reads, where it could not follow a directory walk, so such a test runs for a change under src/, not for every one.
import { files, source } from './catalogs/src-sources.js';

/** Every file under src/ (.js, .css, .html) whose path from the repository root (`src/…`) matches `re`, in path order. */
export const srcPaths = (re = /\.js$/) => files.map((f) => 'src/' + f).filter((p) => re.test(p));
/** A file's text by its path from the repository root (`src/…`). */
export const srcText = (path) => {
  if (!path.startsWith('src/')) throw Error(`${path}: not under src/`);
  return source(path.slice('src/'.length));
};

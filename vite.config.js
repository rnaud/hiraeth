import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { existsSync, realpathSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditsPlugin } from './scripts/audits-data.mjs';
import { referenceLabPlugin } from './scripts/reference-lab/server.mjs';
import { referencesPlugin } from './scripts/references-index.mjs';
import { threeProgramKeys } from './scripts/three-program-keys.mjs';

// Relative asset paths so the build works both at a site root and under
// GitHub Pages' /moebius/ sub-path.
// In a git worktree node_modules may be a symlink into the main checkout;
// allow serving from where it really lives (the BVH worker is loaded from it).
/** The pages built (tests/studio.test.js checks the studio is one, tests/motion-page.test.js the Motion page). */
export const BUILD_INPUT = {
  notes: fileURLToPath(new URL('./notes.html', import.meta.url)),
  cinematics: fileURLToPath(new URL('./cinematics.html', import.meta.url)),
  enemies: fileURLToPath(new URL('./enemies.html', import.meta.url)),
  main: fileURLToPath(new URL('./index.html', import.meta.url)),
  studio: fileURLToPath(new URL('./studio.html', import.meta.url)),
  trailer: fileURLToPath(new URL('./trailer.html', import.meta.url)),
  motion: fileURLToPath(new URL('./motion.html', import.meta.url)),
  // the interactive changelog (src/changelog-page/; its pictures, changelog-media/, are the site's alone)
  changelog: fileURLToPath(new URL('./changelog.html', import.meta.url)),
  // the items to review (src/items-page/: each item's picture, what it does, where it is found)
  items: fileURLToPath(new URL('./items.html', import.meta.url)),
  // the audit reports and their scores (src/audits-page/; the data and the pictures, audits/, are the site's alone)
  audits: fileURLToPath(new URL('./audits.html', import.meta.url)),
  // the references page (src/references-page/; its index, thumbnails and web-size copies, dist/references/, are
  // the site's alone: the deploy writes them, scripts/references-site.mjs)
  references: fileURLToPath(new URL('./references.html', import.meta.url)),
};
const modules = existsSync('node_modules') ? realpathSync('node_modules') : null;
/**
 * The MakeHuman parametric body (public/anim/mh/body.bin, docs/makehuman.md: 1.7 MB, 1.06 gzipped): the
 * Desert's people (and ?mh=1 anywhere) are MakeHuman bodies, so it ships with the web bundle and the APK.
 * MAKEHUMAN=0 leaves it out (a build to measure without it: the people fall back to the Quaternius bodies).
 */
export const MH_DIR = 'anim/mh';
const dropMakeHuman = () => ({
  name: 'drop-makehuman',
  apply: 'build',
  writeBundle(options) { if (process.env.MAKEHUMAN === '0') rmSync(`${options.dir ?? 'dist'}/${MH_DIR}`, { recursive: true, force: true }); },
});
/**
 * What this build is, for the Debug menu's "This build" (src/world-picker.js buildInfo): its commit and its
 * build number (the commits up to it, as scripts/release-info.mjs gameBuild numbers the APK and the web
 * bundle; none from a shallow clone). Nothing when git isn't there.
 */
export function gitBuildInfo(run = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()) {
  const info = {};
  try { info.commit = run('rev-parse', '--short=8', 'HEAD'); } catch { return info; }
  try { if (run('rev-parse', '--is-shallow-repository') === 'false') info.build = Number(run('rev-list', '--count', 'HEAD')) || undefined; } catch { /* no count */ }
  return info;
}
export default defineConfig({
  base: './',
  define: { __HIRAETH_BUILD__: JSON.stringify(gitBuildInfo()) },
  // main.js loads in stages with top-level await
  // The game, trailer, character studio (studio.html, src/studio/) and Motion page
  // (motion.html, src/motion/: the traveller's loops against motion matching): they ship with the game
  build: { target: 'es2022', rolldownOptions: { input: BUILD_INPUT } },
  // (the reference lab, reference-lab.html: dev server only, not built: docs/systems/reference-lab.md; the
  // references page's live index is the dev server's, the site's is written by the deploy: docs/systems/references.md)
  // (threeProgramKeys: the surfaces' programs keyed without their side, normals or colours: fewer programs to compile)
  plugins: [threeProgramKeys(), dropMakeHuman(), auditsPlugin(), referenceLabPlugin(), referencesPlugin()],
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), ...(modules ? [modules] : [])] } },
});

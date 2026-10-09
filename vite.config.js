import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { existsSync, realpathSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Relative asset paths so the build works both at a site root and under
// GitHub Pages' /moebius/ sub-path.
// In a git worktree node_modules may be a symlink into the main checkout;
// allow serving from where it really lives (the BVH worker is loaded from it).
/** The pages built (tests/studio.test.js checks the studio is one, tests/motion-page.test.js the Motion page). */
export const BUILD_INPUT = {
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
export default defineConfig({
  base: './',
  // main.js loads in stages with top-level await
  // The game, trailer, character studio (studio.html, src/studio/) and Motion page
  // (motion.html, src/motion/: the traveller's loops against motion matching): they ship with the game
  build: { target: 'es2022', rolldownOptions: { input: BUILD_INPUT } },
  plugins: [dropMakeHuman()],
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), ...(modules ? [modules] : [])] } },
});

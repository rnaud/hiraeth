import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { existsSync, realpathSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Relative asset paths so the build works both at a site root and under
// GitHub Pages' /moebius/ sub-path.
// In a git worktree node_modules may be a symlink into the main checkout;
// allow serving from where it really lives (the BVH worker is loaded from it).
/** The pages built (tests/studio.test.js checks the studio is one, tests/motion-page.test.js the Motion page). */
export const BUILD_INPUT = {
  main: fileURLToPath(new URL('./index.html', import.meta.url)),
  studio: fileURLToPath(new URL('./studio.html', import.meta.url)),
  motion: fileURLToPath(new URL('./motion.html', import.meta.url)),
};
const modules = existsSync('node_modules') ? realpathSync('node_modules') : null;
/**
 * The MakeHuman prototype's bodies (public/anim/mh/, docs/makehuman.md: 6.4 MB, the character
 * studio's alone) stay out of the build the APK and the web bundle ship, unless MAKEHUMAN=1.
 */
export const MH_DIR = 'anim/mh';
const dropMakeHuman = () => ({
  name: 'drop-makehuman',
  apply: 'build',
  writeBundle(options) { if (process.env.MAKEHUMAN !== '1') rmSync(`${options.dir ?? 'dist'}/${MH_DIR}`, { recursive: true, force: true }); },
});
export default defineConfig({
  base: './',
  // main.js loads in stages with top-level await
  // three pages: the game, the character studio (studio.html, src/studio/) and the Motion page
  // (motion.html, src/motion/: the traveller's loops against motion matching): they ship with the game
  build: { target: 'es2022', rolldownOptions: { input: BUILD_INPUT } },
  plugins: [dropMakeHuman()],
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), ...(modules ? [modules] : [])] } },
});

import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Relative asset paths so the build works both at a site root and under
// GitHub Pages' /moebius/ sub-path.
// In a git worktree node_modules may be a symlink into the main checkout;
// allow serving from where it really lives (the BVH worker is loaded from it).
/** The pages built (tests/studio.test.js checks the studio is one). */
export const BUILD_INPUT = { main: fileURLToPath(new URL('./index.html', import.meta.url)), studio: fileURLToPath(new URL('./studio.html', import.meta.url)) };
const modules = existsSync('node_modules') ? realpathSync('node_modules') : null;
export default defineConfig({
  base: './',
  // main.js loads in stages with top-level await
  // two pages: the game, and the character studio (studio.html, src/studio/): it ships with the game
  build: { target: 'es2022', rolldownOptions: { input: BUILD_INPUT } },
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), ...(modules ? [modules] : [])] } },
});

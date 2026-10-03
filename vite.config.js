import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { existsSync, realpathSync } from 'node:fs';

// Relative asset paths so the build works both at a site root and under
// GitHub Pages' /moebius/ sub-path.
// In a git worktree node_modules may be a symlink into the main checkout;
// allow serving from where it really lives (the BVH worker is loaded from it).
const modules = existsSync('node_modules') ? realpathSync('node_modules') : null;
export default defineConfig({
  base: './',
  // main.js loads in stages with top-level await
  build: { target: 'es2022' },
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), ...(modules ? [modules] : [])] } },
});

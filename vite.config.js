import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { existsSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BUILD_INPUT } from './scripts/build-input.mjs';
export { BUILD_INPUT } from './scripts/build-input.mjs';
import { auditsPlugin } from './scripts/audits-data.mjs';
import { referenceLabPlugin } from './scripts/reference-lab/server.mjs';
import { referencesPlugin } from './scripts/references-index.mjs';
import { lorePlugin } from './scripts/lore-data.mjs';
import { travellerV2Plugin } from './scripts/traveller-v2-ship.mjs';
import { threeProgramKeys } from './scripts/three-program-keys.mjs';

// Relative asset paths so the build works both at a site root and under
// GitHub Pages' /hiraeth/ sub-path.
// In a git worktree node_modules may be a symlink into the main checkout;
// allow serving from where it really lives (the BVH worker is loaded from it).
const modules = existsSync('node_modules') ? realpathSync('node_modules') : null;
/**
 * The MakeHuman parametric body (public/anim/mh/body.bin, docs/makehuman.md: 1.7 MB, 1.06 gzipped): the
 * game's people are MakeHuman bodies in every world, so it ships with the web bundle and the APK.
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
/**
 * The game's version written into the build (src/version.js): the newest entry's `v` in src/changelog.js, so the
 * title and the settings needn't load the whole changelog for it. version.js holds the same literal, written by
 * `node scripts/changelog-md.mjs` (tests/changelog.test.js checks it); the build takes it from the changelog itself.
 */
export const changelogVersion = (text = readFileSync(new URL('./src/changelog.js', import.meta.url), 'utf8')) => /\{\s*v:\s*'([^']+)'/.exec(text)?.[1] ?? null;
const versionModule = () => {
  let build = false;
  return {
    name: 'version-module',
    configResolved(config) { build = config.command === 'build'; },
    transform(code, id) { return build && /[\\/]src[\\/]version\.js$/.test(id) ? `export const VERSION = ${JSON.stringify(changelogVersion())};` : null; },
  };
};
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
  // (travellerV2Plugin: the v2 traveller's GLBs and manifests copied from data/, which the build leaves out otherwise)
  plugins: [threeProgramKeys(), versionModule(), dropMakeHuman(), auditsPlugin(), referenceLabPlugin(), referencesPlugin(), lorePlugin(), travellerV2Plugin()],
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), ...(modules ? [modules] : [])] } },
});

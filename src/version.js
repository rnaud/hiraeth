// The game's version: the newest entry of src/changelog.js, written here by `node scripts/changelog-md.mjs` (with
// changelog.md), so the title screen, the settings and the engines show it without the 1 MB of every version's lines
// (issue #110), and so editing a changelog line doesn't reach every module that only shows the version.
// tests/changelog.test.js fails if this differs from the changelog.
export const VERSION = '2.39';

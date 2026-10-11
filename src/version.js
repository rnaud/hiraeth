// The game's version (the newest entry of src/changelog.js), without loading the changelog: the built game has this
// module replaced by the version alone (vite.config.js versionModule, read off changelog.js when the build starts),
// so the title screen and the settings show it without the 430 kB of every version's lines (issue #110). The dev
// server, the tests and the engine bundles read the changelog itself, so a version added while the dev server
// runs shows at once.
export { VERSION } from './changelog.js';

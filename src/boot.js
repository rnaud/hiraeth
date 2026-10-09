// Seed a temporary cinematic review before the game loads any progress.
if (new URLSearchParams(location.search).has('cinematicReview')) {
  const { seedReview } = await import('./cinematics-page/runtime.js');
  await seedReview();
}
// The page's entry: the title screen (src/title.js) when the game is opened, then the
// game (src/main.js) in the save slot chosen there. A world asked for directly skips
// the title and plays the current slot: ?level=<id> (the ship's arrivals, the dev
// shortcut), ?prologue=1, ?ending=1, and ?start (a save started over from the Start menu).
// ?worlds=1 alone (the title's Debug entry) shows only the worlds list. ?level=<id>&debugsave=1 (a
// route world picked in that list) first writes the debug save for it (src/debug-save.js).
// In the Android app, an update downloaded meanwhile is switched to before the title shows.

import './menus.css';
import './game-menu.css';
import './shop-panel.css';
import './world-picker.css';   // (the Debug menu, src/world-picker.js: over the game, and alone at ?worlds=1)
import { installNativePad, watchLabels } from './native-pad.js';
import { installGlyphs } from './pad-glyphs.js';
import { opensTitle } from './save-slots.js';
import { applyReadyUpdate } from './native-app.js';
import { audioGuard } from './audio-guard.js';
import { installKeyRemap } from './remap.js';
import { translatePage } from './i18n.js';
import { installXbox } from './xbox.js';
import { cameFromDebug, installDebugBack } from './debug-back.js';

installXbox();        // (the Xbox app only: the TV's safe area, the Back button; a no-op elsewhere: src/xbox.js)
audioGuard();         // (before any sound: silent while the app is away, from the title screen on)
installKeyRemap();    // (the player's own keys, first of every key listener: src/remap.js)
translatePage();      // (index.html's own words in the player's language: src/i18n.js)
installNativePad();   // (the Android handheld's controls, for the title screen too)
watchLabels();
installGlyphs();   // (the button glyphs in the menus, for the pad in hand: src/pad-glyphs.js)
// a brand-new profile (no seen version, no save anywhere) counts this version as seen, before the
// title writes a save: the "Updated to v…" toast is for players coming from an older version (src/first-run.js)
try { const [{ quietFirstRun }, { VERSION }] = await Promise.all([import('./first-run.js'), import('./changelog.js')]); quietFirstRun(globalThis.localStorage, VERSION); } catch (e) { console.warn(e); }
// a route world picked in the worlds list (Debug): its own save, as if every world before it were played
// through (src/debug-save.js), written into the debug slot before the game reads a save; a reload goes on with it
// a world opened from the Debug menu (its list, or a debug page's link, as the Arena from Creatures & spirits):
// the small "◀ Debug" button back to it (src/debug-back.js; click or tap only: B and Esc are the game's)
const fromDebugMenu = new URLSearchParams(location.search).has('level')
  && (new URLSearchParams(location.search).has('debugsave') || cameFromDebug(document.referrer, location.search));
if (new URLSearchParams(location.search).has('debugsave')) {
  const q = new URLSearchParams(location.search);
  const [{ seedDebugSave, DEBUG_PARAM }, { game }] = await Promise.all([import('./debug-save.js'), import('./game-state.js')]);
  seedDebugSave(q.get('level'), { state: game });
  q.delete(DEBUG_PARAM);
  history.replaceState(null, '', `${location.pathname}?${q}`);
}
const worldsOnly = new URLSearchParams(location.search).get('worlds') === '1' && opensTitle(location.search);
if (worldsOnly) {
  // the title's Debug entry: the worlds list alone, without building a world behind it (src/world-picker.js)
  const { showWorldsOnly } = await import('./world-picker.js');
  await showWorldsOnly();
} else if (opensTitle(location.search)) {
  // the Android app: a downloaded update starts here, before anything runs (the page reloads into it)
  if (await applyReadyUpdate()) await new Promise((r) => setTimeout(r, 5000));
  const { showTitle } = await import('./title.js');
  await showTitle();
} else if (new URLSearchParams(location.search).has('start')) history.replaceState(null, '', location.pathname);   // (a reload goes back to the title)
if (!worldsOnly) await import('./main.js');
if (fromDebugMenu) installDebugBack({ keys: false, pad: false, fade: true });

if (new URLSearchParams(location.search).has('cinematicReview')) {
  const { startReview } = await import('./cinematics-page/runtime.js');
  await startReview(window);
}

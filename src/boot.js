// The page's entry: the title screen (src/title.js) when the game is opened, then the
// game (src/main.js) in the save slot chosen there. A world asked for directly skips
// the title and plays the current slot: ?level=<id> (the ship's arrivals, the dev
// shortcut), ?prologue=1, ?ending=1, and ?start (a save started over from the Start menu).
// In the Android app, an update downloaded meanwhile is switched to before the title shows.

import './menus.css';
import { installNativePad, watchLabels } from './native-pad.js';
import { opensTitle } from './save-slots.js';
import { applyReadyUpdate } from './native-app.js';

installNativePad();   // (the Android handheld's controls, for the title screen too)
watchLabels();
if (opensTitle(location.search)) {
  // the Android app: a downloaded update starts here, before anything runs (the page reloads into it)
  if (await applyReadyUpdate()) await new Promise((r) => setTimeout(r, 5000));
  const { showTitle } = await import('./title.js');
  await showTitle();
} else if (new URLSearchParams(location.search).has('start')) history.replaceState(null, '', location.pathname);   // (a reload goes back to the title)
await import('./main.js');

// The page's entry: the title screen (src/title.js) when the game is opened, then the
// game (src/main.js) in the save slot chosen there. A world asked for directly skips
// the title and plays the current slot: ?level=<id> (the ship's arrivals, the dev
// shortcut), ?prologue=1, ?ending=1, and ?start (a save started over from the Start menu).

import './menus.css';
import { installNativePad, watchLabels } from './native-pad.js';
import { opensTitle } from './save-slots.js';

installNativePad();   // (the Android handheld's controls, for the title screen too)
watchLabels();
if (opensTitle(location.search)) {
  const { showTitle } = await import('./title.js');
  await showTitle();
} else if (new URLSearchParams(location.search).has('start')) history.replaceState(null, '', location.pathname);   // (a reload goes back to the title)
await import('./main.js');

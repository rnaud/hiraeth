// When each piece of the HUD shows (issue #430): one table for the page and the engines.
//
// The page hides its HUD's pieces by its body's classes (index.html, src/gadgets/hud.js, src/minigames/kit/minigames.css:
// `body.talking #prompt { visibility: hidden }`…) and by ship/cinema.js's hud(false); the engines' HUD (BridgeHud.cs)
// had its own conditions for the same, and they drifted: the prologue's voicemail E drew in Unity only while the HUD was
// on, where the page shows it in a scene you walk through (issue #394). Now the engines' HUD asks this table, sent with
// the screen's state as `shows` (engine/unity/game.js), and tests/hud-shows.test.js holds the page's CSS rules to it.
//
//   HUD_HIDES[state]  the screen's parts (src/platform.js screen) hidden while that state holds:
//     talking   a conversation is open (screen 'dialogue'; the page's body.talking)
//     bars      a ship's scene has its letterbox up and you don't walk through it (cine.bars; the page's body.cine-on)
//     hudOff    a ship's scene has the game's HUD off and you don't walk through it (cine.hud false; cinema.hud(false))
//     minigame  a run is under way (screen 'minigame'; the page's body.minigame), `onFootKeeps` kept in a game on foot
//   hudShows(state)  { part: false } for each part hidden now (a part not named shows whenever it is set)
//
// The page's CSS rules are all in the table; the table hides a few more where the page's own scripts do instead (the
// gadget's wheel and reticle in a conversation, the fight's ring and chips) or where the page has no such state.

export const HUD_HIDES = {
  talking: ['cue', 'health', 'keys', 'stamina', 'tool', 'prompt', 'balloons', 'gadget', 'gadgetWheel', 'reticle', 'gadgetMarks', 'guardian', 'foeTab', 'lock', 'warn', 'self'],
  bars: ['cue', 'tool', 'gadget', 'gadgetWheel', 'reticle', 'gadgetMarks'],
  hudOff: ['cue', 'health', 'stamina', 'keys', 'guardian', 'foeTab', 'lock', 'warn', 'words', 'self'],
  minigame: ['cue', 'stamina', 'tool', 'prompt', 'gadget', 'gadgetWheel', 'reticle'],
};
/** In a game played on foot (drives: false) these stay (the page's body.minigame:not(.mg-onfoot)). */
export const ON_FOOT_KEEPS = ['stamina', 'tool'];

/** The page's elements by the screen part they draw (the CSS check: tests/hud-shows.test.js). */
export const HUD_ELEMENTS = {
  '#cue': 'cue', '#health': 'health', '#keys': 'keys', '#stamina': 'stamina', '#tool': 'tool', '#prompt': 'prompt', '.balloon': 'balloons',
  '#gadget-chip': 'gadget', '#gadget-wheel': 'gadgetWheel', '#gadget-reticle': 'reticle', '#gadget-marks': 'gadgetMarks',
};
/** The page's body classes by the state above. */
export const HUD_CLASSES = { talking: 'talking', 'cine-on': 'bars', minigame: 'minigame' };

/**
 * A scene holds the screen (issue #501): its letterbox up or the HUD off, and you don't walk through it. The hearts
 * and the key count are quiet then (src/host/game-host.js wireHealth, main.js updateKeys), whichever scene it is: a
 * ship's, a world's moment or a makers' box (src/boxes/scene.js), which until then only the ship's scenes quieted.
 * @param s  src/platform.js screen.state (or the same as plain data)
 */
export function sceneHolds(s = {}) {
  const c = s.cine;
  return !!c && !c.walk && (!!c.bars || c.hud === false);
}

/**
 * Which parts are hidden now, from the screen's state itself: { part: false }, nothing for those that show.
 * @param s  src/platform.js screen.state (or the same as plain data)
 */
export function hudShows(s = {}) {
  const c = s.cine, walk = !!c?.walk, mg = s.minigame;
  const on = {
    talking: !!s.dialogue,
    bars: !!c?.bars && !walk,
    hudOff: !!c && c.hud === false && !walk,
    minigame: !!mg,
  };
  const out = {};
  for (const [state, parts] of Object.entries(HUD_HIDES)) {
    if (!on[state]) continue;
    for (const p of parts) if (!(state === 'minigame' && mg?.onFoot && ON_FOOT_KEEPS.includes(p))) out[p] = false;
  }
  // (photo mode: its keys in the cue's strip, over a run too: BridgeHud draws the photo's hint as the cue)
  if (s.photo && out.cue === false && !on.talking) delete out.cue;
  return out;
}

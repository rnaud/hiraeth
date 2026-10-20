// The HUD's own buttons for a pointer (issue #570): what a mouse or a finger can press on the HUD where the page has a
// button of its own and a pad has none to press. The page draws them as its elements (src/minigames/kit/minigames.css
// .mg-pause); an engine's HUD (the Unity bridge's BridgeHud.cs) draws them from the screen's 'buttons' part made here,
// hit-tests a press against the same part (hitHudButton) and does what the page's click does (pressHudButton).
//
//   the minigames' pause    top right under the score (the page's #minigame .mg-pause: right 16 px, top 64 px, 2.6 em
//                           round), while a run is on (the screen's 'minigame' part, the page's #minigame); hidden while a
//                           pad is in hand (body.controller, src/input-mode.js), back as the mouse or a finger presses;
//                           pressed, it pauses as Start / Menu does (the runner's padAction('start'))
//
// The page's other pointer-only pieces are the touch layout's (#touch, #gear, the potion, the sketch hunt's ✎: shown
// with body.touch), which an engine has none of: a touch there counts as the screen in hand ('keys', src/input-mode.js
// with touchDevice false), so none of them is asked for.

/** The page's --type-s at a screen H px tall (index.html: clamp(13px, 1.9vh, 28px) × the Text size setting, --ts). */
export const typeS = (H = 720, ts = 1) => Math.min(28, Math.max(13, H * 0.019)) * ts;

/** The minigames' pause, as minigames.css places it (CSS px, from the screen's top right; its size in em of --type-s). */
export const PAUSE_BUTTON = { id: 'pause', right: 16, top: 64, em: 2.6, glyph: '❚❚', label: 'Pause' };

/**
 * The buttons the HUD shows now: [{ id, right, top, size }] in the HUD's px (the canvas H tall: an engine's HUD is laid
 * out on a 720-tall canvas, as a 720-tall page), or [] for none.
 * @param s     src/platform.js screen.state (or the same as plain data)
 * @param o.kind what is in hand (src/input-mode.js: 'pad', 'keys', 'touch'); a pad hides them
 * @param o.ts   the Text size setting's scale (src/ui.js TEXT_SIZES): the button is sized in em, as the page's
 * @param o.under a menu or a run's card is up over the HUD: the buttons stay drawn under it, `under` (no hover: the page's
 *               card takes the pointer), and take no press (engine/game.js pointer)
 */
export function hudButtons(s = {}, { kind = 'keys', ts = 1, H = 720, under = false } = {}) {
  if (kind === 'pad' || !s.minigame) return [];
  const b = PAUSE_BUTTON;
  return [{ id: b.id, right: b.right, top: b.top, size: Math.round(b.em * typeS(H, ts) * 10) / 10, ...(under ? { under: true } : {}) }];
}

/** A button's box on a screen W px wide: { x, y, w, h } from the top left. */
export const buttonBox = (b, W) => ({ x: W - b.right - b.size, y: b.top, w: b.size, h: b.size });

/**
 * The button under a press at (x, y) (the HUD's px from its top left, on a screen W px wide), or null. The buttons are
 * round, as the page's (border-radius 50%: a press in the corner of its box misses, as on the page).
 */
export function hitHudButton(buttons, x, y, W) {
  if (!Array.isArray(buttons) || !Number.isFinite(x) || !Number.isFinite(y) || !(W > 0)) return null;
  for (let i = buttons.length - 1; i >= 0; i--) {   // (the last drawn is on top)
    const b = buttons[i], r = b.size / 2, cx = W - b.right - r, cy = b.top + r;
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return b.id;
  }
  return null;
}

/**
 * What a button does when pressed, as the page's click does: true when it was taken.
 * @param id       the button (hitHudButton)
 * @param o.trials the run under way (engine/trials.js: padAction, the runner's own, which a menu up turns down)
 */
export function pressHudButton(id, { trials = null } = {}) {
  if (id === 'pause') return !!trials?.padAction?.('start');   // (the run paused, as Start / Menu: the runner's padAction)
  return false;
}

/**
 * The Unity bridge's presses (BridgeHost.Pointer: "kind,x,y,w,button;…", kind mouse | touch, x and y the HUD's canvas px from
 * its top left, w its width, button 0 the main one and 2 the right) as the game's pointer takes them (engine/game.js pointer).
 */
export function parsePresses(text) {
  const out = [];
  for (const part of String(text ?? '').split(';')) {
    const [kind, x, y, w, button] = part.split(',');
    if ((kind === 'mouse' || kind === 'touch') && x !== '' && y !== '' && Number.isFinite(+x) && Number.isFinite(+y) && +w > 0) out.push({ kind, x: +x, y: +y, w: +w, button: +button || 0 });
  }
  return out;
}

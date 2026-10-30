// The menus heard (issue #379: no menu made a sound): what a press in a menu sounds as (Sound.ui's kinds), the same
// for the page's menus (src/main.js) and the engines' (engine/game.js, engine/menus.js).
//
//   uiKind({ key: 'ArrowDown' })        → 'move'
//   uiKind({ action: 'confirm' })        → 'confirm'
//   uiKind({ nav: [0, 1] })              → 'move'
//   wrapMenus(menus, (kind) => sound.ui(kind))   the engines' menus: their keys, pad actions and directions heard,
//                                                 and opening or closing (menusHeard(menus) once a frame)

const KEY_KINDS = {
  ArrowUp: 'move', ArrowDown: 'move', ArrowLeft: 'move', ArrowRight: 'move', KeyW: 'move', KeyA: 'move', KeyS: 'move', KeyD: 'move',
  Enter: 'confirm', NumpadEnter: 'confirm', Space: 'confirm',
  Escape: 'back', Backspace: 'back',
  KeyQ: 'tab', KeyE: 'tab', Tab: 'tab', BracketLeft: 'tab', BracketRight: 'tab', PageUp: 'tab', PageDown: 'tab',
};
const ACTION_KINDS = { confirm: 'confirm', back: 'back', tabPrev: 'tab', tabNext: 'tab' };

/** The sound of a press in a menu: a key's code, a pad's action, or a direction ([x, y]); null if it makes none. */
export function uiKind({ key = null, action = null, nav = null } = {}) {
  if (key) return KEY_KINDS[key] ?? null;
  if (action) return ACTION_KINDS[action] ?? null;
  if (nav) return nav[0] || nav[1] ? 'move' : null;
  return null;
}

/**
 * The engines' menus (engine/menus.js EngineMenus) heard: key(), action() and navigate() play their kind while a menu
 * is open (the press that opens one is heard as it opening, menusHeard). Returns `menus`.
 */
export function wrapMenus(menus, play) {
  if (!menus) return menus;
  // (wrapped once; a later world's sound takes over the same menus, a world swapped in place in the Unity bridge: #792)
  if (menus._heard) { menus._heard.play = play; return menus; }
  menus._heard = { open: !!menus.open, play };
  for (const [name, kind] of [['key', (a) => uiKind({ key: a[0] })], ['action', (a) => uiKind({ action: a[0] })], ['navigate', (a) => uiKind({ nav: [a[0], a[1]] })]]) {
    const f = menus[name];
    if (typeof f !== 'function') continue;
    menus[name] = function (...a) {
      const was = !!this.open, r = f.apply(this, a);
      const k = kind(a);
      if (was && this.open && k) this._heard.play(k);
      return r;
    };
  }
  return menus;
}

/** Once a frame: a menu that opened or closed since the last is heard ('open' / 'close'). */
export function menusHeard(menus) {
  const H = menus?._heard;
  if (!H) return;
  const open = !!menus.open;
  if (open !== H.open) { H.open = open; H.play(open ? 'open' : 'close'); }
}

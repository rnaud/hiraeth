// Where the title screen puts its name and its menu (src/title.js), for any screen: the name across
// the upper part, as on the covers (references/Title Screen/: the upper quarter to third); the menu
// small and to the left, low down, so the world shows: the main entries (Continue or New game, Saves)
// as a short column of compact text buttons, and under them the tools (Settings, What's new, Debug,
// Full screen) as a row of small icon buttons. Every shot leaves its lower left calm (the traveller
// stands right of the middle, the covers' focal points sit in the middle and the upper part); a shot
// may ask for its menu higher (`menu: 'mid'`, src/title-shots.js). Pure: sizes in CSS px.
//
//   titleLayout({ w, h, buttons, icons, safe, at })   -> { mode, logo, menu, ink }
//
// The title sets the result as CSS variables on #title (src/menus.css reads them).

import { LOGO_BOX, INK } from './title-logo.js';

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

/** The menu's sizes: a touch target never under 40 px tall, small words inside it. */
export const MENU = { minButton: 40, maxButton: 48, minFont: 12, maxFont: 15.5 };

/**
 * @param o.w, o.h     the screen (CSS px)
 * @param o.buttons    how many text entries (the column: Continue or New game, Saves)
 * @param o.icons      how many icon entries (the row: Settings, What's new, Debug, Full screen)
 * @param o.safe       the safe-area insets { top, right, bottom, left } (px)
 * @param o.at         'low' (the lower left, the default) or 'mid' (the column centred in the space under the name)
 * @returns { mode: 'wide' | 'short' | 'portrait',
 *            logo: { top, left, width, height },
 *            menu: { top, left, width, height,                        the whole menu (column and row)
 *                    list: { top, left, width, height, rows },          the text entries
 *                    row: { top, left, width, height, count },          the icon entries
 *                    button, gap, font, icon, columns },
 *            ink }   ink: the lettering's line in its own units (never under ~1.5 px on screen)
 */
export function titleLayout({ w, h, buttons = 2, icons = 4, safe = {}, at = 'low' } = {}) {
  const s = { top: 0, right: 0, bottom: 0, left: 0, ...safe };
  const W = Math.max(1, w - s.left - s.right), H = Math.max(1, h - s.top - s.bottom);
  const A = LOGO_BOX.w / LOGO_BOX.h;
  const aspect = W / H;
  const mode = aspect < 0.8 ? 'portrait' : H < 520 ? 'short' : 'wide';
  const margin = clamp(Math.min(W, H) * 0.04, 8, 40);

  // the name: as wide as the screen allows, no taller than its share of the height
  const maxW = mode === 'portrait' ? Math.min(W - margin * 2, 760) : Math.min(W * 0.86, 1500);
  const maxH = H * (mode === 'portrait' ? 0.16 : mode === 'short' ? 0.25 : 0.27);
  const lw = Math.min(maxW, maxH * A), lh = lw / A;
  const ltop = s.top + (mode === 'portrait' ? H * 0.075 : H * (mode === 'short' ? 0.05 : 0.07));
  const logo = { top: ltop, left: s.left + (W - lw) / 2, width: lw, height: lh };

  // the menu: small entries, a touch target tall, the words small inside
  const n = Math.max(0, buttons), m = Math.max(0, icons);
  const button = clamp(H * 0.042, MENU.minButton, MENU.maxButton);
  const font = clamp(button * 0.33, MENU.minFont, MENU.maxFont);
  const gap = Math.round(clamp(button * 0.2, 6, 10));
  const icon = button;
  const listW = n ? clamp(font * 14, 170, 240) : 0;
  const rowW = m ? m * icon + (m - 1) * gap : 0;
  const listH = n ? n * button + (n - 1) * gap : 0;
  const rowH = m ? icon : 0;
  const between = n && m ? Math.round(gap * 1.6) : 0;
  const height = listH + between + rowH, width = Math.max(listW, rowW);
  // to the left (inside the safe area), low down: its foot a little above the bottom edge
  const left = s.left + clamp(W * 0.035, 14, 64);
  const bottomPad = clamp(H * 0.05, 12, 56);
  const floor = s.top + H - bottomPad - height;          // (the lowest it may sit)
  const ceiling = ltop + lh + margin;                    // (the highest: under the name)
  const top = at === 'mid' ? Math.max(ceiling, Math.min(floor, ceiling + (floor - ceiling) * 0.5)) : Math.max(ceiling, floor);
  const list = { top, left, width: listW, height: listH, rows: n };
  const row = { top: top + listH + between, left, width: rowW, height: rowH, count: m };
  const menu = { top, left, width, height, list, row, button, gap, font, icon, columns: 1, rows: n };
  // the ink line: the cover's weight, never thinner than a pixel and a half
  const ink = Math.max(INK, (1.5 * LOGO_BOX.h) / Math.max(lh, 1));
  return { mode, logo, menu, ink };
}

/** The layout as CSS variables (px), for #title's style. */
export function layoutVars(L) {
  const px = (v) => `${Math.round(v * 10) / 10}px`;
  return {
    '--logo-top': px(L.logo.top), '--logo-w': px(L.logo.width), '--logo-h': px(L.logo.height),
    '--menu-top': px(L.menu.top), '--menu-left': px(L.menu.left), '--menu-w': px(L.menu.list.width),
    '--btn-h': px(L.menu.button), '--btn-gap': px(L.menu.gap), '--btn-font': px(L.menu.font), '--icon': px(L.menu.icon),
  };
}

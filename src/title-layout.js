// Where the title screen puts its name and its menu (src/title.js), for any screen: the name across
// the upper part, as on the covers (references/Title Screen/: the upper quarter to third), the menu
// in the quiet space below it, in the lower middle. A short screen (a phone on its side, 812 × 375)
// lays the menu out in two or three columns rather than letting it run under the name; a screen held
// upright sets it out in two columns at the bottom, the name at the top and the world between. Pure: sizes in CSS px.
//
//   titleLayout({ w, h, buttons, safe })   -> { mode, logo, menu, ink }
//
// The title sets the result as CSS variables on #title (src/menus.css reads them).

import { LOGO_BOX, INK } from './title-logo.js';

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

/**
 * @param o.w, o.h     the screen (CSS px)
 * @param o.buttons    how many entries the main menu has
 * @param o.safe       the safe-area insets { top, right, bottom, left } (px)
 * @returns { mode: 'wide' | 'short' | 'portrait',
 *            logo: { top, left, width, height },
 *            menu: { top, left, width, height, columns, rows, button, gap, font },
 *            ink }   ink: the lettering's line in its own units (never under ~1.5 px on screen)
 */
export function titleLayout({ w, h, buttons = 5, safe = {} } = {}) {
  const s = { top: 0, right: 0, bottom: 0, left: 0, ...safe };
  const W = Math.max(1, w - s.left - s.right), H = Math.max(1, h - s.top - s.bottom);
  const A = LOGO_BOX.w / LOGO_BOX.h;
  const aspect = W / H;
  const mode = aspect < 0.8 ? 'portrait' : H < 520 ? 'short' : 'wide';
  const margin = clamp(Math.min(W, H) * 0.04, 8, 40);
  const n = Math.max(1, buttons);

  // the name: as wide as the screen allows, no taller than its share of the height
  const maxW = mode === 'portrait' ? Math.min(W - margin * 2, 760) : Math.min(W * 0.86, 1500);
  const maxH = H * (mode === 'portrait' ? 0.16 : mode === 'short' ? 0.25 : 0.27);
  const lw = Math.min(maxW, maxH * A), lh = lw / A;
  const ltop = s.top + (mode === 'portrait' ? H * 0.075 : H * (mode === 'short' ? 0.05 : 0.07));
  const logo = { top: ltop, left: s.left + (W - lw) / 2, width: lw, height: lh };

  // the menu: one column if it fits under the name, else two or three, the entries smaller as needed
  const bottomPad = margin + (mode === 'portrait' ? H * 0.03 : H * 0.02);
  const below = s.top + H - bottomPad - (ltop + lh + margin);
  let button = clamp(H * 0.058, 32, 52);
  const gapOf = (b) => Math.round(b * 0.28);
  let columns = 1;
  const need = (cols, b) => Math.ceil(n / cols) * b + (Math.ceil(n / cols) - 1) * gapOf(b);
  if (mode !== 'portrait') {
    while (columns < 3 && need(columns, button) > below) columns++;
    if (need(columns, button) > below) button = clamp((below - (Math.ceil(n / columns) - 1) * 4) / Math.ceil(n / columns), 26, button);
  } else {
    // upright: two columns once there are more than four entries, so the world shows between the name and the menu
    columns = n > 4 ? 2 : 1;
    button = clamp(H * 0.052, 34, 48);
    if (need(columns, button) > below) button = clamp(below / (Math.ceil(n / columns) * 1.28), 30, button);
  }
  const rows = Math.ceil(n / columns), gap = gapOf(button);
  const colW = mode === 'portrait' ? (Math.min(W * 0.92, 460) - (columns - 1) * gapOf(button) * 1.5) / columns : clamp(W * (columns > 1 ? 0.25 : 0.24), 220, 360);
  const width = columns * colW + (columns - 1) * gap * 1.5;
  const height = need(columns, button);
  // (portrait: down near the bottom; landscape: in the middle of the space under the name, a little low)
  const top = mode === 'portrait'
    ? s.top + H - bottomPad - height
    : ltop + lh + margin + Math.max(0, (below - height) * 0.7);
  const menu = { top, left: s.left + (W - width) / 2, width, height, columns, rows, button, gap, font: clamp(button * 0.42, 12, 22) };
  // the ink line: the cover's weight, never thinner than a pixel and a half
  const ink = Math.max(INK, (1.5 * LOGO_BOX.h) / Math.max(lh, 1));
  return { mode, logo, menu, ink };
}

/** The layout as CSS variables (px), for #title's style. */
export function layoutVars(L) {
  const px = (v) => `${Math.round(v * 10) / 10}px`;
  return {
    '--logo-top': px(L.logo.top), '--logo-w': px(L.logo.width), '--logo-h': px(L.logo.height),
    '--menu-top': px(L.menu.top), '--menu-w': px(L.menu.width), '--menu-cols': String(L.menu.columns),
    '--btn-h': px(L.menu.button), '--btn-gap': px(L.menu.gap), '--btn-font': px(L.menu.font),
  };
}

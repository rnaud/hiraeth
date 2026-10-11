// The game's type (docs/systems/ui.md "Type", issue #128), for what is drawn on a canvas and for styles that
// show outside index.html (a page's back button: src/pad-glyphs.js). Everywhere else the CSS says it with
// index.html's variables: var(--face), var(--face-title), var(--face-mono), sized by var(--type) / var(--type-s).
//
//   FACE        everything a player reads: notices, the cue, cards, the minigames, the menus, conversations
//   TITLE_FACE  names and headings: a game's title, the menu's brand, a name board, the 3-2-1
//   MONO_FACE   only the debug and dev panels (the Debug menu, the dev menu, the input display, the hitboxes,
//               the frame-time readout), and the screens inside the world that are a machine's (the ship's
//               console, the Arcade's score board): never a player's UI (tests/typefaces.test.js)

export const FACE = "'Avenir Next', Futura, 'Futura PT', 'Helvetica Neue', Roboto, sans-serif";
export const TITLE_FACE = "Futura, 'Futura PT', 'Avenir Next', Roboto, 'Arial Black', sans-serif";
export const MONO_FACE = 'ui-monospace, Menlo, Consolas, monospace';

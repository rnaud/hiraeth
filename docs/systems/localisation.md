# Localisation

The game's words in the player's language: `src/i18n.js`, with one table a language in `src/i18n/`.
English (`en.js`) is the source; French (`fr.js`) is the first translation. The setting is
*Language* in the settings' first group (`lang`, saved with the settings; default English).

## How it works

- `t(key, vars)`: the words for `key` in the language now; a key the language lacks falls back to
  English, and a key English lacks shows as the key itself (never an empty line). `{name}` in a
  string is filled from `vars`: `t('title.deleteAsk', { n: 2 })`.
- `setLanguage(id)` (src/ui.js `applyAccess`, from the setting) sets `<html lang>` and tells
  `onLanguage` listeners. The Start menu redraws itself (on the page it was on), the game menu
  renames its tabs and draws its panels as they open, the title redraws its menu and saves,
  `translatePage()` (boot.js) rewrites index.html's `[data-t]` texts and `[data-t-aria]` labels, and
  native-pad.js renames the key badges ("ESPACE"). Words built each frame (the cue, the prompts,
  the toasts) are asked for as they are drawn.
- Keys are dotted by place: `menu.*` the Start menu, `set.*` the settings (`set.<setting>.<value>`
  for a choice's label), `rebind.*` and `verb.*` the Controls page's own keys and buttons, `ctl.*`
  its lists (`ctl.k.*` keyboard, `ctl.p.*` controller, `ctl.t.*` touch, `.how` the keys), `hud.*`
  the cue's lines, `hint.*`, `restart.*`, `toast.*`, `gm.*` the game menu, `title.*` the title
  screen, `key.*` the keys' names, `touch.*` the touch buttons' labels.
- **Button and key names stay in the game's own form** in every language ('A / ×', 'E', 'SPACE',
  'W/S'): native-pad.js prints them as the pad does and in the player's own keys (see
  docs/systems/controls.md, "Remapping"). A translation keeps them where the English has them, at
  the start of a " · " part so they become badges.
- French: the player is *vous*; menus are infinitives ("Reprendre"); a no-break space before
  `: ; ? !` and inside « ».

`tests/accessibility.test.js` checks that the French table has every English key and the same
`{names}` in each, that a missing key falls back to English and then to the key, and that the
Controls page and the HUD speak French when asked.

## What is covered

The Start menu and the settings, the Controls page (rebinding and every list), the title screen's
menu, saves and delete card, the game menu (tabs, prompts, the panels' fixed words), the cue's ride
lines and the boarding line, the close hints, the restart card, the hitbox toasts, the photo-mode
hint, the loading line, the touch buttons' labels.

Not yet, and still English: the dialogue and the story (src/story/*, the worlds' data), quest titles
and steps, item names and texts, the scout's lines, the minigames' cards, the loading stages, the
changelog, the dev tools. The setting's label says so ("the story is in English for now").

## Adding a language

1. Copy `src/i18n/fr.js` to `src/i18n/<id>.js`, translate the values (keep the keys, the `{names}`
   and the button names), and add it to `LANGUAGES` in src/i18n.js with its own name ("Deutsch").
2. `node --test tests/accessibility.test.js`: extend the completeness test to it. `missing(id)`
   lists what is left to translate.

## Extending it to the dialogue

The dialogue is the large part (every world's `*-data.js`, the calls, the recordings): thousands of
lines, each with a tone (`'~sad~ …'`, src/story/tone.js). The way to bring it in:

- **Key by place, not by text.** A conversation's lines become `world.npc.n` keys
  (`desert.ama.3`), generated once by a script from the data files, so the English stays the source
  and the data files keep their shape: a loader replaces each line's text by `t(key)` when the
  language is not English, and falls back to the line as written.
- **Keep the tone outside the words.** The tone prefix is metadata: the extraction strips it to a
  `{ text, tone }` pair and keys the text only, so a translator never edits a tone.
- **Highlights and glyphs** (`*the place*`, the translator's scripts) stay as markup inside the
  string; the translation moves them with the words.
- **One table a world**, loaded with the world (`src/i18n/<lang>/<world>.js`, dynamic import), so the
  first load does not carry every world's words.
- Names (people, places, relics) are a glossary of their own, translated once and used everywhere.

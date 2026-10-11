# Localisation

The game's words in the player's language: `src/i18n.js`, with one table a language in `src/i18n/`.
English (`en.js`) is the source; French (`fr.js`) is the first translation. The setting is
*Language* in the settings' first group (`lang`, saved with the settings; default English, never taken from the device). On a controller it changes only once opened with A / × (`data-pad="open"`, src/menu-pad.js: docs/systems/ui.md, "The Settings on a controller").

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
- Keys are dotted by place: `teach.*` the teaching lines and toasts, `vk.*` the words inputs are named by, `menu.*` the Start menu, `set.*` the settings (`set.<setting>.<value>`
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

**The teaching lines and the toasts that teach an input** (`teach.*`, v1.47): the desert's first steps
(src/first-steps.js), the ship's nudge (src/ship/prologue.js nudgeText), the tank's first fill, the first
fight's line, the hoverbike's call, the bell, shell and horn, the pen's and the bubble's notices, the
bellows' next step, the "switch the gun to push" tail of the shove hints, the controller-layout note. The
words an input is named by (`vk.*`: "the mouse", "the left stick", "R or the right mouse button") are
French too, so a `{key:verb}` reads whole in French. A shove hint's first sentence is the story's, and
stays English with it. `tests/teach-i18n.test.js` fails on a toast or notice whose literal text names an
input (`{key:…}`) without going through `t()`.

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
- **Keys** (`{key:aim}`, docs/systems/dialogue.md "Keys in lines") are never translated: `t()`
  fills only `{word}` names, so a translated line keeps them where the translator puts them.
- **Highlights and glyphs** (`*the place*`, the translator's scripts) stay as markup inside the
  string; the translation moves them with the words.
- **One table a world**, loaded with the world (`src/i18n/<lang>/<world>.js`, dynamic import), so the
  first load does not carry every world's words.
- Names (people, places, relics) are a glossary of their own, translated once and used everywhere.

## Notes for the dialogue's translator (the dialogue review v1.48)

The jokes below play on English words. Translate the idea, not the words; where a line carries an
instruction, the instruction must survive (the same instruction is always said plainly nearby too).

| Who (world) | The line | What it plays on |
|---|---|---|
| Kesh (Vael) | "Small to tall." | a rhyme for the knuckles' order; Kesh also mimes "little, first, ring, middle" |
| Fisk (the Buried Machine) | "A stone in the teeth" | gear teeth and a mouth's: the hint is to jam the gear |
| Ummu (the Signal Market) | "YOU HAVE A PUSH. WE HEARD IT." | the gun's push mode, heard as a sound |
| Lou (home) | "Admission is one button." | a coat's button, not a key |
| a window cleaner (the Signal Market) | "BUY becomes YUB." | the sign read backwards from behind the glass |
| the noodle cook (the Signal Market) | "three noodle men in a coat. … It's two." | the stacked-in-a-coat image |
| Corm (Lorn) | "Professional respect. One set of teeth to another." | the plants' jaws and the crystal as a "sky-tooth" |
| Perrine (the City-Shaft) | "Halfway prices: half of nothing." / "Hot at the top and warm at the bottom, like the city." | the middle levels; the city's rich top and poor bottom |
| Marrow (the desert) | "You've come to the right liar. Specialist, I meant." | a slip he means you to hear |
| Wendel (Lorn) | "The patient are never eaten." | a motto: keep it short and proverbial |
| Kip, Tansy (the Underside, the detours) | "their word for stop … is the same word as sorry"; "their word for sorry. It's a nod." | words that mean two things in a local tongue |
| Nima (the City-Shaft) | "the night the sky rang" | a shaft that rings like a bell: keep a bell's word; other worlds name the night their own way (lore/voice-guide.md) |

**Gender.** The bird, the skiff (Fen's) and Ummu's listeners are "she", "she" and "it" in English on
purpose; the stilt-walkers and the shellbacks are "it". Speakers' sexes are in the people's `kind`
(`'m'`, `'f'`) for the languages that need them in an adjective or a past participle.

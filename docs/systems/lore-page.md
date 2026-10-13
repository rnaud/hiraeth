# The lore page (issues #268, #269)

`lore.html` (`src/lore-page/`) shows the game's lore in its paper and ink. It lives on the site at
https://hiraeth.alexandria-rnaud.workers.dev/lore (the Notes site, where its notes work) and at
https://rnaud.github.io/hiraeth/lore.html. It is linked from the Notes page and the changelog page's header.

## What it shows

- **The story**: the singing light, the father and the reel, the makers (the Givers), the fragments, the Lantern.
  Anything that gives away the ending (what the light was, the parents, Ilen, the Lantern's island) sits behind a
  **Show the ending** fold in its part.
- **The traveller**: his canonical portrait and character sheet, who he is, his look, the backpack, the ship.
- **The worlds**, in the route's order (`src/levels/names.js` ORDER). For each: its thumbnail, its page title and
  intro (`src/levels/content.js`), its blurb (`src/levels/index.js`), its lore, and its temples (two in Vael and
  Lorn, one per part). Each temple has its design sheet (or the world's thumbnail), who stands at its door, its
  entry line, **its gadget** (picture and text), the gifts left in the open, and **its guardian**: its design sheet,
  calmed or stopped, the gimmick (the gadget is the key), each phase's hint in order, and the **second verb** the
  six guardians ask for (#257, `phase.asks`: the guard, the push, a splash, a perfect dodge). Then what changes
  after, and the world's people from the people book (`src/story/people-book.js`), folded.
- **The gadgets**: every item of `src/items.js` (the gadgets registered too), by kind, with its picture (or its
  glyph while `public/item-pictures/` has none), what it does with the buttons written out, where its boxes are
  (`src/boxes/placements.js`, as the items page), and, for a temple's gadget, the temple and guardian it opens.

## Built from the game's data

`scripts/lore-data.mjs` `buildLore()` imports the game's modules in node and returns plain JSON. Vite serves it as
`virtual:hiraeth-lore` (`lorePlugin`, `vite.config.js`), so the page loads none of the game. A dev server builds it
once: restart it to see a change to the game's data. `node scripts/lore-data.mjs` prints a summary.

The only hand-written words are `src/lore-page/lore-text.js`: the story's parts, the traveller, each world's lore
(short, from `docs/story-bible.md`, `lore/continuity.md` and `lore/characters/`) and the verbs' names. A new world on
the route needs its lore there (the test fails without it).

The pictures: worlds use `public/thumbs/`, items `public/item-pictures/`. The traveller, the guardians and the temples
use reference picks (`src/lore-page/pictures.js` SOURCES) made small by `node scripts/lore-pictures.mjs` into
`public/lore-pictures/` (720 px WebP, about 25 KB each). Those are the site's alone: the over-the-air zip, the APK and
the Deck leave them out (`scripts/web-update.mjs` LORE_FILE, `scripts/site-only.mjs`); the page drops a picture that
does not load.

## Notes on everything

Every part (each story part, the traveller and his gear, each world, temple, gadget, guardian, person and item) has a
small **Note** button. It opens one box: write a comment, Send (or ⌘/Ctrl + Enter). The note goes through the Notes
page's own path, `POST /api/notes/issues` on the same origin with the notebook's signed-in cookie (`worker/issues.js`;
no token or password on the page), as `{ text, source: 'lore' }`:

- the issue's **title** is the comment's first line;
- its **body** is the comment, then `On the lore page: **<the part>** (https://hiraeth.alexandria-rnaud.workers.dev/lore#<anchor>)`,
  then `Added from the Hiraeth lore page.` (the Worker's footer for `source: 'lore'`; any other source is the
  notebook's own).

Not signed in, the box sends you to the Notes page to unlock it first. Away from the Worker (GitHub Pages, a bundled
copy) it says notes are filed from the Hiraeth site and links to the same part of the page there. A draft is kept
while the page is open. `src/lore-page/notes.js` is pure but for `fetch`.

`tests/lore-page.test.js` checks the page against the data (every route world, temple, guardian, gadget and item;
the ending folded; every picture and link there), the note's request (the Notes API, its body, a fake fetch) and the
Worker's footer (a fake GitHub). No test files a real issue.

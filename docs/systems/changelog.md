# The interactive changelog: what changed, in pictures and numbers

`changelog.html` (a page of the build, `src/changelog-page/`) shows every version's lines, as the game's
own changelog (N) does, with what each one changed beside it:

- **before / after pictures**: a split you drag (or hover with a mouse), or Before, After and Side by side;
  several pictures for one line are tabs over it;
- **numbers** (frame times, frames a second, draw calls, the contact audit's counts…): a table of before,
  after and the change, the better way in green, with a bar for each;
- **how to see it**, for what a picture can't show (sound, feel, solid ground, a menu deep in a save).

Filters (with pictures, with numbers, performance, characters, devices, menus and controls, solid as
drawn, and each world) and a search narrow the list; the URL keeps them (`?kind=perf&world=desert&q=cab`),
and `#v0.79-3` links a line. Keyboard: ↑ ↓ from line to line, ← → move the split, Enter turns through the
modes (and a line's pictures), PageUp / PageDown and LB / RB jump a version, `/` searches, Escape or N
closes. A controller does the same through the game's own `Controller` (context `menu`). Touch drags the
split; on a narrow screen the side by side stacks.

## In the game

The changelog panel (N, or the settings' What's new) has **See what changed**: it opens the page over the
game in a frame (`changelog.html?embed=1`, from the game's own files, so it opens offline in the Android
app and on the Deck too). While it is up the game passes its controller presses to the page
(`Changelog.pad`, `window.changelogPad`) instead of polling it twice; the page's Close, B / ○, Escape or N
posts `changelog-close` and the panel takes the frame away. On the site the page also works by itself
(its own controller loop).

## Where a line's media lives

`src/changelog.js` stays the source of the lines: the game's panel, `changelog.md`
(`scripts/changelog-md.mjs`) and the release notes use their words only. A line is a string, or
`{ text, shots, numbers, see, tags }` with its media written beside it. The pictures and numbers for lines
written as strings (all the lines up to v0.80) are in **`src/changelog-media.js`**, by version, each entry
naming its line by its opening words (`match`, which must match exactly one line: tests check it). The
game never imports that file; only the page does.

```js
{ match: 'The Signal Market’s back alleys', shots: [
  { name: 'market-alley', caption: 'Into a back alley off the Signal Market’s street', commit: 'dfa7e07',
    view: { level: 'bazaar', player: [-24, 0, 73], eye: [-26, 5, 73], target: [-52, 9, 73], fov: 60 } },
], numbers: [{ title, unit, better: 'lower', device, rows: [{ where, before, after }], source }],
  see: 'how to see it in the game' }
```

A value in `numbers` is a number or a range as text (`'17–25'`, drawn by its middle); `after: null` shows a
dash (not measured yet). Lines get their filter tags from their words (`tagsOf`), plus any `tags`.

## Taking the pictures: `scripts/changelog-shots.mjs`

Each shot names the commit that made the change (`commit`; `before` defaults to its first parent) and the
**view** both pictures are taken from. The script, for every commit needed (one extraction per commit,
shared by every shot that needs it):

1. checks that at least 6 GB are free, extracts the commit with `git archive` into `$TMPDIR` (no worktree
   to prune) and links this checkout's `node_modules` into it;
2. serves it with Vite on `PORT` (default 5430; never 5173) with its own dependency cache;
3. drives a headless Chrome (muted, the game's volumes at 0, on the GPU) to each view: the same preset
   (High unless said), size (1280 × 720), hour (10), weather (clear), save, fixed resolution, the HUD
   hidden and the camera pinned, for the before and the after;
4. writes `changelog-media/<version>/<name>-before.webp` and `-after.webp` (cwebp, 1280 px wide at
   most, quality 72) and deletes the extracted commit.

```sh
node scripts/changelog-shots.mjs                       # every shot whose pictures are missing
node scripts/changelog-shots.mjs --only 0.79/market-alley --force [--keep-png]
node scripts/changelog-shots.mjs --version 0.80 --dry  # what would be taken at which commits
```

Views: `ref: '<References view id>'` (the References level's panels, `?level=references`, held on the
view); `level` with `eye`, `target`, `fov` and `player` (the bench viewpoints in
`scripts/bench/viewpoints.json` and `viewpoints-worlds.json` are good starting points); `people:
[{ id, yaw, dist, height }]` for people close up in the running game (each drawn by the game's
`captureView` from in front turned by `yaw`, side by side; `id` a story person's or `traveller`);
`page: 'studio.html', query` for the character studio (clipped to its view); `hud: true` and `setup`
(a script run in the page, e.g. `window.journal.toggle(true)` for the game menu); `quality`, `hour`,
`weather`, `size`, `save`, `wait`. `only: 'after'` is a picture with no before (a new screen); one with no
`view` is made by hand (`steam-art`: Steam's wide picture).

Look at every pair before committing it: the two must differ in the way the line says, and nowhere else
that matters (people move between the two loads; a view that shows nothing of the change is worse than a
note).

## Size: the pictures are the site's alone

The pictures never go to the devices. `changelog-media/` is at the repository's root, not in `public/`, so
Vite never builds it into `dist/`: the APK, the over-the-air zip (`scripts/web-update.mjs`) and the Deck's
runtime never hold it. The Cloudflare deploy copies it into `dist/` only after the zip and the Deck's
runtime are made, just before `wrangler deploy` (`.github/workflows/cloudflare.yml`); and should it ever be
in `dist/`, the zip (`MEDIA_FILE`), the Deck package and the Android workflow leave it out
(`tests/changelog-media.test.js` checks each). The page reads a picture beside itself on the site or a dev
server, and from the site (`https://memento.alexandria-rnaud.workers.dev/changelog-media/…`) in a bundled
game (the Android app, the Deck); offline it says the pictures are online and shows the words and numbers.

Limits (tests): a picture at most 150 KB, a pair 260 KB, the folder 30 MB. In practice a 1280 × 720 pair
is 60–150 KB.

A picture made by hand (no `view`) says where it came from in `from`: a screenshot of earlier work, or a
pair taken from that work's own before / after (the cab ride, the idle sheets); convert it with
`cwebp -q 72 -resize 1280 0 in.png -o changelog-media/<v>/<name>-after.webp`.

## Retroactive media (October 2026)

The lines from 6 October, 5 PM (the later half of v0.73) to v0.80 were given their media after the
fact (choices made while the author slept, noted here):

- **98 lines** show something: **55 with pictures** (61 before / after pairs and 8 after-only pictures,
  130 WebP files, 6.1 MB in all), **26 with numbers** (the Retroid's and the Mac's frame times and frame
  rates, draw calls, the contact audit's counts, the presets' distances), **39 with a "how to see it"
  note** (22 with only a note: solid ground, menus deep in a save, the Deck, things that only show in
  motion). The lines added while this was done (0.80's Deck crash and conversation lines, v0.81's) have none yet; v0.73's first four were written before 5 PM.
- Pictures were taken at each line's own commit and its parent; where the work had a work-in-progress
  commit first (the References' Garden of Spheres, Lorn II and Buried Machine), the before is the commit
  before that (`before:`). Numbers come from `docs/systems/performance.md`, `docs/systems/movement.md`
  and the commits' messages, with their device and preset.
- Dropped after looking at each pair: views where the before and the after looked the same at this size
  (fine grass, door stains and dust bands from afar, the City-Shaft's undersides from the rim, the
  studio's traveller poses, whose animation settings did not take): those lines got a note instead.
- Reused from tonight's agents' own screenshots: the cab ride before / after and the dash's screen, the
  idle sheets (16 s of the traveller standing), the Deck's Updates section and Steam library, the cab's
  prompt.
- A people shot moves the traveller a few steps behind each person in turn (people far from him are not
  drawn) and shoots from the way the body faces (its +z).

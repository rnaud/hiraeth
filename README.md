# Hiraeth

A three.js exploration game in ligne claire, drawn after Moebius and the game *Sable*
(formerly the Moebius / Sable shader PoC: the repository and internal ids keep the old
name, `moebius`). A traveller crash-lands in a desert and crosses a dozen small worlds by
ship; its foundation is a world that feels organic, responsive, mysterious and connected
([the world principles](docs/world-principles.md)). Design: [the game brief](docs/game-brief.md)
and [the story bible](docs/story-bible.md); the writing room is [lore/](lore/README.md).

**Play it:** https://memento.alexandria-rnaud.workers.dev/ (Cloudflare Workers).

**[Interactive changelog](https://memento.alexandria-rnaud.workers.dev/changelog.html):**
explore each release with before/after pictures, numbers and notes.

The game is now named **Hiraeth**. Existing technical identifiers, save keys, and the
`memento.alexandria-rnaud.workers.dev` address remain stable for installed copies.

## Run it

```bash
npm install
npm run dev     # http://localhost:5173
```

The page opens on the title screen (five save slots, Continue, the ship's prologue on a new
game). Keyboard, mouse, touch and any standard gamepad work; **H** shows the controls, **N** the
changelog, **F** the frame readout, **L** the worlds list. The full layout:
[docs/systems/controls.md](docs/systems/controls.md).

URL parameters that matter while developing:

| Parameter | What it does |
|---|---|
| `?level=<id>` | open a world directly, skipping the title (`desert`, `incal`, `arzach`, `arzach2`, `garage`, `buried`, `edena`, `spheres`, `perdide`, `perdide2`, `bazaar`, `home`; dev levels `lab`, `references`) |
| `?level=<id>&via=ship` | arrive as if by ship (the homecoming plays on `home`) |
| `?prologue=1`, `?ending=1` | play the prologue (desert) or the ending (home) again |
| `?worlds=1` | open the worlds list |
| `?items=all` / `none` / `backpack,glider` | grant or take away items |
| `?mh=0` / `?mh=1` | people on Quaternius bodies / on MakeHuman bodies in any world |
| `?mm=1` / `?mm=0` | the traveller moves by motion matching, or by the blended loops |
| `?fps=1` | the frame readout, for this session |
| `?pad=android` | Android button names in the prompts |
| `?level=references&view=<n>&look=desert` | one reference sheet's view, in a world's look |

Watch or export the 48-second in-engine trailer at `trailer.html`.

Other pages: `studio.html` (the character studio), `motion.html` (the Motion page),
`tools/rig-review.html`, `tools/people-review.html`, `tools/tongues.html`.

## Test and build

```bash
node --test tests/*.test.js     # the unit tests (Node's runner, no browser); also run by the pre-commit hook
npx vite build                  # the production build into dist/
```

Both must pass before every commit. Visual changes are checked in the running game with
headless Chrome screenshots against a dev server of your own (never port 5173, the author's;
Chrome always with `--mute-audio`). Measuring scripts live in `scripts/bench/`,
`scripts/handheld-perf/`, `scripts/lab-perf/` and `scripts/transition-perf/`.

Every player-visible change adds a line to the newest entry of `src/changelog.js`; then
`node scripts/changelog-md.mjs` regenerates [changelog.md](changelog.md) (see `CLAUDE.md`).

## How it ships

- **Web.** `.github/workflows/cloudflare.yml` builds the game and deploys it, with the content
  updates for the app and the Deck (`/updates/web.json` and its zip), to the Cloudflare Worker
  `memento` ([docs/cloudflare.md](docs/cloudflare.md)). `npm run dev:cloudflare` runs the Worker locally.
- **Android.** `.github/workflows/android.yml` builds a signed APK (a Capacitor shell running the
  game in its own GeckoView engine, the system WebView as fallback) on every push to `main` and
  publishes it to the GitHub release of the newest changelog version. Installed apps update the
  game over the air from the site's `web.json`; a new APK is offered only when `NATIVE_API`
  (the Java bridge) changes. Keep the signing key backup in `.local-tools/android-signing/`.
  Details: [docs/systems/android.md](docs/systems/android.md).
- **Steam Deck.** `.github/workflows/steam-deck.yml` builds a Linux (Electron) package that
  updates all of itself from the site, game and runtime, with an Updates section in the settings
  as on Android ([docs/steam-deck.md](docs/steam-deck.md)).
- **iPhone.** Add the web game to the home screen from Safari
  ([docs/systems/platforms.md](docs/systems/platforms.md)).

## The repository

| Path | What |
|---|---|
| `src/` | the game: `boot.js` (entry, title screen), `main.js` (the frame), `levels/` (one module per world), `story/` (quests, dialogue, voices), `materials.js` and `post.js` (the ink look), `player.js`, `humanoid.js`, `costumes.js`, `audio.js`, `score.js`, `ship/`, `temples/`, `boxes/`, `wildlife/`, `studio/`, `motion/` |
| `tests/` | `node --test` suites, one or more per system |
| `public/` | models, animation clips, motion data, icons, the web manifest |
| `scripts/` | release and update feeds, the changelog, the mocap and MakeHuman pipelines, benchmarks |
| `android/`, `desktop/` | the Android app (Capacitor, GeckoView) and the Steam Deck runtime |
| `engine/`, `unity/`, `godot/` | the game's JavaScript drawn by Unity (Puerts) or Godot, the engine only rendering ([docs/systems/engine-bridge.md](docs/systems/engine-bridge.md)); the earlier C# port in `unity/` ([docs/systems/unity.md](docs/systems/unity.md)) |
| `docs/` | design, the system notes and the archive ([docs/README.md](docs/README.md)) |
| `lore/`, `LORE.md` | the story's writing room and the lore |
| `references/` | the reference sheets the look is drawn from |
| `TODO.md`, `DONE.md` | open work, and what was done |

## Documentation

The full index is [docs/README.md](docs/README.md). The system notes, one file per topic:

- [Controls](docs/systems/controls.md), [movement, mounts and health](docs/systems/movement.md),
  [animation](docs/systems/animation.md)
- [Characters](docs/systems/characters.md), [faces](docs/systems/faces.md)
- [Rendering](docs/systems/rendering.md), [materials](docs/systems/materials.md),
  [performance](docs/systems/performance.md)
- [Worlds](docs/systems/worlds.md), [the living world](docs/systems/living-world.md),
  [water](docs/systems/water.md), [the makers' temples](docs/systems/temples.md)
- [Story and quests](docs/systems/story.md), [dialogue and voices](docs/systems/dialogue.md),
  [cutscenes and moments](docs/systems/cinematics.md), [the scout](docs/systems/scout.md),
  [items](docs/systems/items.md)
- [Screens, menus and the HUD](docs/systems/ui.md), [sound and music](docs/systems/audio.md)
- [Android](docs/systems/android.md), [iPhone and the Steam Deck](docs/systems/platforms.md)
- [The References level](docs/systems/references.md), [the Lab and the clipping audit](docs/systems/dev-tools.md),
  [the engine bridge](docs/systems/engine-bridge.md), [Unity](docs/systems/unity.md)

[Credits](docs/credits.md): animations and bodies by Quaternius (CC0), motion capture from the
CMU database, with their licences; the MakeHuman bodies: [docs/makehuman.md](docs/makehuman.md).

---
name: new-world
description: Add a world (a route world, a detour, or a special place like Home or the Lantern) to Hiraeth with everything wired — the level, its registration, people and tones, story and quests, music, thumbnail, foes or peace, voice and script, the map, sightings, temple/court/trial for route worlds, moments, tests and docs. Use when asked to add, create or build a new world, level, place or destination.
---

# A new world

A world touches about two dozen files, and the audits have already caught a world shipped with one
missed: the Lantern's quest was absent from `ALL_QUESTS`. Work through this list, and tick each item
in the final report. Look at the newest world of the same kind as a model:
- `src/levels/lantern.js` for a small special place;
- a detour, e.g. `src/levels/overnight-train.js`;
- a route world, e.g. `src/levels/spheres.js`.

## 0. Decide first (ask the author when it isn't given)

- **The kind:**
  - a **route world** (on `ORDER`: a quest line, a keepsake, five relics, a temple, a court, a trial);
  - a **detour** (on `SIDE`: people, a trace of the light, a viewpoint page);
  - a **special place** (reached by the story, like Home or the Lantern).
- **Where it sits** on the route and the galactic map, and what opens it.
- **Its reference:** a Moebius plate or sheet to build from (`references/levels/<World>/environment/`, its people in `characters/` beside it; its enemies are skins of `references/enemy-archetypes/`; `docs/systems/references.md`).
- **Its people and their tongue,** and the one thing the world is about (`docs/story-bible.md`, `LORE.md`).

## 1. The level

- **`src/levels/<id>.js`:** `create` and `build` (async steps, see the load steps), terrain, collision,
  spawn, `limit`, `killY`, `features`, portals and lights, built with the level kits like its
  neighbours.
- **`src/levels/index.js`:** the entry (`id`, `create`, `build`, `hidden: true` for detours and special
  places, never `dev`).
- **`src/levels/names.js`:**
  - its display name;
  - `ORDER` or `SIDE`;
  - `AFTER` if it opens after another world.
- **The galactic map:** `src/ship/planets.js` and `src/ship/starmap.js`.
- **The route rules:** `src/story/route.js`, or the story's own gate (`src/story/ending.js`'s
  `finaleOpen` is an example).
- **`src/edge.js` `EDGE_HINTS`:** the line at the world's edge.
- **`src/reactive-world.js`:** what notices the player (`docs/world-principles.md`).

## 2. People and words

- **`src/levels/content.js`:** the world's people, looks, listen-only bystanders, `traces` (a
  detour's trace of the light), and things to look at.
- **For a route world, the story data:**
  - `src/story/<id>-data.js`: `PEOPLE`, `THINGS`, `QUESTS`, `KEEPSAKE`, `CROWD_TALK`;
  - `src/story/<id>.js`: its logic;
  - registered in `src/story/index.js`;
  - **its `QUESTS` added to `src/story/all-quests.js`.**
- **Every line carries a `~tone~`.** Answers stay at most 3 a node, 2 on average. Bystanders only talk.
- **Lines that teach a control** use `{key:verb}`, never a button name.
- **The writing follows `lore/voice-guide.md`.** Add voice sheets to `lore/characters/worlds.md`. Run
  the `dialogue-review` extractor on the world and fix its flags.
- **The tongue:** `src/story/voice.js` `LANGUAGES`, and the world's script in `src/story/scripts.js`.
- **Looks:** `src/costumes.js`, the MakeHuman people (`src/makehuman/people.js`, `shape.js`) if the
  world uses them, and the portrait colours (`src/story/portrait-bg.js`).
- **Sightings:** an entry in `src/story/sightings.js`, or `sightings-detours.js` for a detour.
  Continuity with the finale: check `lore/continuity.md`.

## 3. Play

- **Foes:**
  - the roster in `src/foe-worlds.js`;
  - or peace: `PEACEFUL` in `src/foes.js`, or `level.peaceful`.

  The Enemies setting must be honoured.
- **A route world also gets:**
  - a temple: `src/temples/<id>.js` and `-data.js`, a guardian, a gadget;
  - a makers' court with a gadget (`src/finds/courts.js`);
  - a trial (`src/trials/`), whose reward is usable when won;
  - relics and a box (`src/boxes/placements.js`);
  - a filmed climax (`src/story/<id>-moments.js`, registered in `src/story/film.js`).
- **Mounts, vehicles and the bird** where the world needs them (`docs/systems/progression.md`).

## 4. Sound and pictures

- **Music:**
  - `src/soundtracks.js`, plus `public/music/<id>.mp3` and its `public/music/manifest.json` entry, or
    reuse another theme as the Lantern does;
  - an `AMBIENCE` bed in `src/audio.js`;
  - an entry for the procedural score in `src/score.js`.

  How a device gets the music (bundled or fetched) is in `docs/systems/audio.md`.
- **The thumbnail:** `scripts/world-thumbs.mjs`, giving `public/thumbs/<id>.jpg`.
- **Benchmark views:** add the world to `scripts/bench/viewpoints-worlds.json` (`--pick 1` in
  `scripts/bench/android-worlds.mjs` can choose them).
- **Colour:** check it against its reference sheet. The `visual-audit` skill's `views.mjs` can shoot it
  at four hours.

## 5. Tests and docs

- **Tests that walk every world,** which must pass with the new one:
  - `tests/tone.test.js`;
  - `tests/dialogue-choices.test.js`;
  - `tests/listen.test.js`;
  - `tests/key-placeholder.test.js`;
  - `tests/clip-audit.test.js`;
  - the names and levels tests.
- **The play-through:** a route world or special place goes into `tests/playthrough.test.js` (and its
  agent, `tests/playthrough-agent.js`) so the route is still played to the end.
- **A world test of its own:** `tests/<id>-world.test.js`, modelled on the detours'. It checks that it
  builds, has a spawn on ground, its people stand, and its trace or quest works.
- **Docs:** `docs/systems/worlds.md` (a section), `docs/story-bible.md`, `docs/systems/story.md` or
  `progression.md` if it changes the route, and `docs/README.md` if a new doc is needed.
- **Changelog:** a line for players (the `ship-release` skill), with a before/after or a picture of the
  new world, unless it's a spoiler (then a note).

## 6. Check it runs

In a muted headless Chrome on its own port (never 5173):
- load `?level=<id>`;
- read the console for errors;
- look at the boot view and two more;
- talk to a person;
- reach it from the galactic map.

`.claude/skills/game-audit/capture.mjs` with a one-line plan does this.

## 7. Tell the user

- what was built;
- the checklist ticked, with anything left open;
- the new lines for the author to read;
- what to play first.

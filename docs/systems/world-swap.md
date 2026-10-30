# Going between worlds without a page load

Issue #790. The author: "we shouldn't load web pages when we move from one world to another, we should swap in
place … so we don't lose sound when we get to a new page." Each world used to be its own page load
(`location.search = '?level=…'`): the sound's context died with the page, and a browser that had not been pressed in
the new page kept it silent until the next press.

## How it works

- **One world, one run.** `src/main.js` builds a world from the page's address inside `runWorld()`; the module runs
  the first one (`startWorlds(runWorld)`, `src/world-travel.js`). Its imports, the page-wide wrappers and the
  title stay loaded for the whole visit.
- **Every way to another world asks `travel(href)`** (`travelSearch(search)` for a bare `?…`). An address of this
  page that names a world (`?level=` or `?game=`) is swapped in place; anything else (the title, `cinematics.html`,
  `changelog.html`) loads as a page as before. A trip asked while a world is still being built, or one that fails,
  also loads the page (the old way). Links to worlds of this page (the Debug menu's cards, a game card's "Fly on")
  are caught by one click handler and swapped too.
- **The swap**, in order: the world's page-unload handlers run (`beforeunload`/`pagehide`: its save and play time,
  as a page load ran them); its scope closes (below); its sound is handed on (`Sound.handOver`); `teardown()` (the
  minigame ended, the levels-of-detail worker stopped, the renderer disposed and its WebGL context lost: all its GPU
  memory at once); its names on `window` (`window.player`, `window.scene`…) deleted so the old world is not held while
  the next builds; index.html's elements put back as the first world found them (the loading page back up, its
  space crossing for a flight or the pirates); the address replaced (`history.replaceState`: no history entry, as the
  handheld's Back is a game button, never the browser's); a route world from the Debug menu seeds its debug save as
  `src/boot.js` does; then `runWorld()` again.
- **The sound.** `Sound.handOver()` keeps the context running and its score going over the loading page (its beat
  set going again outside any world). The next world's `Sound` starts on that context at once (`start(ctx,
  { fadeIn: 1.5 })`: no press needed, the context was already allowed) and the last one is released (`release(1.5)`:
  faded out, its loops stopped, disconnected; the context is never closed). The music crossfades. Muting is read
  from the saved setting as each world's sound is built, so review mute holds across swaps.

## What a world leaves behind: `src/world-scope.js`

A world runs inside a scope. `installScopes(window)` (once) wraps the page's timers (`setTimeout`, `setInterval`),
frames (`requestAnimationFrame`, `requestIdleCallback`), observers, workers and `addEventListener`: what is made
while a scope is open is written into it. `scopeDispatcher(THREE.EventDispatcher.prototype)` (main.js) does the same
for three's `dispose` listeners, which each renderer hangs on what it draws. Listeners are kept only for targets that outlive a world (window, document,
`<html>`, `<head>`, `<body>`, index.html's own elements, the screen and viewport, media queries); a world's own
elements go with their listeners. `closeScope()` runs the unload handlers, takes the listeners off, clears the
timers, cancels the frames, disconnects the observers, stops the workers and calls every `owned()` remover.

**Registries** (module-level lists a world adds to) return their remover through `owned(off)`: `game.on`,
`items.on`, the interactables, targets, hazards, workings, indoors tests, wind screens, carryables and snaps,
carried lights and drinkers, irons, hitbox sources and listeners, the input display's and the language's and the
controls' listeners, the pad labels' hooks, the skinned levels of detail, live guardians, game labels, calm zones,
the interiors' rooms. Made outside a world (at a module's load) they stay. A page-wide service a world starts
lazily wraps itself in `persist(fn)` (the carry's put-down entry, the traveller's levels-of-detail worker, the
"◀ Debug" button, which is also marked `data-lasting` so the page keeps it). Adding a registry: return
`owned(off)`; a module-level variable set to a world's object (a class's static, a data object a world hangs
closures on) holds that world after it is let go: clear it with `owned()`, or copy the data.

**index.html's elements**: `markPage()` (src/boot.js, before the title paints) notes them; `snapshotPage()` keeps
their contents as the first world finds them (after the page's setup: glyphs, words); `restorePage()` takes away
what a world added to the body (its canvas, panels, cards) and a world's unnamed styles in the head, and puts each
element back with its first contents and attributes, in its first order.

## Checking it

- `tests/world-swap.test.js`: the scope (listeners, timers, frames, unload handlers, registries, `persist`), the page
  put back, which addresses swap, a swap end to end on a small page (the sound handed on, the address replaced), and
  every travel path going through `travel()`.
- `node scripts/world-swap-bench.mjs [--build] [--gpu] [--worlds desert,arzach,lantern] [--trips 10]`: the game in a
  headless muted Chrome swapped round the worlds many times; after each round trip (garbage collected) the JS heap,
  the renderer's geometries, textures and programs, the WebGL contexts alive, the canvases, the page's elements, the
  window's and document's listeners and the sound's context. Fails if anything grows from the second round trip on,
  if a swap was a page load, or if the sound's context changed or stopped. Prints each world's page load against
  its mean swap.

## Measured

2026-10-29, Mac (Apple M4 Pro), headless Chrome on the Mac's GPU (`--gpu`), the built game (dist/), the Low preset,
muted; the machine shared (load 12–20), so a few hundred ms either way are noise.

| | page load (navigation → first frame) | swap (travel → first frame), mean of 10 |
|---|---|---|
| Desert | 4.6–5.1 s | 3.5–5.0 s |
| Arzach | 5.5 s | 4.4–5.8 s |
| Lantern | 2.7–3.3 s | 1.4–1.5 s |

A swap skips the modules' download and parse and the page's start, but builds the world, its people and its
shader programs again (a new WebGL context): in the big worlds it takes about as long as a page load, in the light
ones about half. What it buys is the sound and the page staying up, not speed.

Memory over 30 swaps (desert → arzach → lantern, ten round trips), sampled after each round trip with garbage
collected: one WebGL context alive, one sound context (running, the first world's), 62 window listeners, 6 on the
document, 5349 page elements, the renderer's 751 geometries and 156 textures, the same after every trip; the JS heap
in a 252–337 MB band with no trend. At most the world playing and the one just let go are in memory (the last one is
sometimes still held a few seconds after the swap, then collected). Left: a slow growth of a few MB and about six
meshes per round trip, seen with the light worlds (88 → 108 MB over eight round trips round the Lantern); not found.

The leaks the bench found and fixed: a bare `addEventListener(…)` (no `this`) not recorded; index.html's children
kept with the last world's listeners when their markup had not changed; three's renderer's `dispose` listeners on
materials a module caches (`scopeDispatcher`), holding each old renderer and its canvas; the static batches' watches
on cached materials' uniforms (`src/static-batch.js watchUniform`); the cloth's workers; the interiors' rooms; the
lens's hidden things (`src/gadgets/hidden.js`); the desert kit's terrain (`Kit.terrain`); the quests' shared
definitions, on which each world's story hung its `onDone` (`Quests.define` now copies).

## Unity and Android

- **Android (Capacitor)** runs the same page: the swap is the same code; the native bridge is unchanged.
- **Unity** (the bridge build, `engine/unity/game.js`): there is no page and no browser rule holding sound back
  until a press, so the bug was the web's alone. A flight (`flyTo`) or a place reached by a page on the web
  (`pageTo`) restarts the script's engine and reloads the scene (`BridgeRunner.RebootNow`,
  unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs): the next world's sound starts by itself, but its music
  starts afresh rather than crossfading (BridgeAudio is made again with the scene). Swapping in place there (one
  script engine for several worlds, its audio kept) is its own piece of work. The C# port's own `Game.SwitchWorldNow`
  (unity/Hiraeth/Assets/Hiraeth/Runtime/Game.cs) already swaps its world in place.

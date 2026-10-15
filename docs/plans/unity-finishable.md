# Can Hiraeth be finished in Unity? (audit, 2026-10-15)

The author will make Unity the Steam Deck's default "once the game can be finished in Unity"
(docs/plans/unity-default-portables.md, D1–D3). This audit walks the critical path, from a new game to the true
ending's credits, against the engine bridge (`engine/game.js`, `engine/unity/game.js`, `engine/combat.js`,
`engine/trials.js`, `engine/menus.js`, the C# runtime). It was written from `f7178ba0d`; the foes and guardians
(`c5f1e5a92`, `a076b145c`) and the trials (`063efdfb5`) landed on main while it was written and are counted as there.

Evidence is of three kinds. **Unity** is a batch run of the editor (`scripts/unity-js-run.sh`, muted), whose pictures
were looked at. **VM** is `tests/engine-finishable.test.js` or `tests/engine-ship.test.js`: the same bundle the engines
run, in a bare V8 context. **Read** is the code, at file:line.

## The critical path

What finishing takes (src/story/ending.js): any **six** route worlds done (each world's main quest sets
`world.<id>.done`), and the last recording heard at the ship's console (`calls.home`). Then Home is on the chart.
Flying home plays the **first homecoming** (`ending.done`). Then comes the Signal Market's silent tower
(`bazaar.broadcast.on`, or the market done), and the **Lantern** opens. Meeting Ilen there sets `finale.met`. The next
flight home is the **final homecoming**: the end card and the credits, then `ending.final`.

| # | step | Unity | evidence |
|---|---|---|---|
| 1 | Title, new save, the prologue in orbit, the voicemail, down to the desert | works | VM: engine-ship.test.js; seen on the Xbox (#264) |
| 2 | Saves within Unity: three slots, continue where you left off, saved every 10 s | works | engine/game.js `save()`, `saveIn`; PlayerPrefs (`BridgeHost.Storage*`) |
| 3 | The desert's main quest: Nour, the channel, the tank, the shrine, the hoverbike, the hearth, the tree lit | works (read) | src/story/desert.js: conversations, interactables, fluid targets, all inside createStory. The fluid tool was handed to the story as `null` (the drum's push and the tank's moment lost it): **fixed**, now made before the story |
| 4 | The desert's leave gate: blade and guard from the Rose House (its arena) | works | leave-gate.js; the arena's foes since c5f1e5a92 (without them it lit by itself, runtime.js:255) |
| 5 | Powering the ship, the first flight (take-off, warp, arrival) | works | VM: engine-ship.test.js (`ship.travel('arzach')`, the warp, `onTravel`) |
| 6 | **Choosing a world never visited** at the holo table | **was missing, fixed** | The holo table opened the Worlds page, whose Travel here only went to worlds already visited (src/fast-travel.js `seen`). Nothing else reached a new world, so the route stopped at the desert. Now, aboard, the Worlds page lists the chart's worlds (`mapEntries`, engine/chart.js) and flies to any of them. A world waiting for its signature search is found as it is chosen (`map.found.<id>`, the ship's "Signature locked" line). VM: engine-finishable.test.js (Vael from the desert) |
| 7 | Vael: the tower on the glider, the flute, the bird; the Aerie's wings | works (read) | src/story/arzach.js; the bird is Vael's own mount |
| 8 | Lorn (and Lorn II's pools and skiff) | works (read) | perdide.js: splashes (the rain path wants `globalThis.weather`, main.js only, but the splash does it). The skiff's spot (`mountAt`) was not passed to the player: **fixed** |
| 9 | Viridel: the off-map cabin | works | portals since 6a1ce648b (`-through`) |
| 10 | The Underwater City: ends on the Listener (`temple.underwater.done`) | works (read) | the guardian inside TempleRuntime, its horn and touch through targets.js and interact.js; foes and lock-on since c5f1e5a92 |
| 11 | The City-Shaft: point the camera at the Lodestar | works (read) | incal.js:486, the JS camera the mirror draws |
| 12 | Glass Dunes, Moon Foundry, City in Space: their guardians | works | c5f1e5a92. The guardian's bar was not drawn: TempleRuntime.meterHud (src/temples/runtime.js:281) builds a DOM element, and the engines have none. **Fixed**: the screen's `guardian` (from `guardianBar`), which BridgeHud.cs DrawGuardian draws. **Unity**: `-level moonfoundry -fight guardian`, "THE LAST FOUNDER · HEALTH" under the fight; VM: engine-combat.test.js |
| 13 | The Buried Machine, the Garden of Spheres | works (read) | no temple; targets, interactables and conversations |
| 14 | A world's closing words and its sketchbook page | **was missing, fixed** | engine/game.js passed a stand-in story page (`complete() {}`). The world still counted as done (its quest sets the flag first), but nothing was said, and the next world's "signature somewhere new" note never came. Now it is src/quest.js's own Story. VM |
| 15 | The relics (each world's small things) | **was missing, fixed** | src/quest.js Relics, now placed. Its toast was the page's #toast; it now takes `say`. VM |
| 16 | The recording "Come home" at the console | works | ship.js `pendingCall`, the voicemail (VM: engine-ship.test.js) |
| 17 | Home on the chart, the flight home | works | homeOpen, through the chart of #6. VM |
| 18 | **The first homecoming** | **was missing, fixed** | engine/game.js called `ship.start` without `homecoming` and built no ship in orbit for it: flying home played a plain arrival, and `ending.done` was never set, so the Lantern could never open. Now it plays. Its cargo panel (a page with one answer, "Take it all down") is answered by itself once the ship has asked. **Unity**: `-ending first`, below |
| 19 | The Signal Market's tower, the broadcast | works (read) | bazaar.js: three bulbs shot within 6 s, the console, the film or its timer, then the conversation |
| 20 | The Lantern: the whistle by each lamp, Ilen, `finale.met` | works (read) | lantern.js listens for the whistle (gadgets → effects.js:124) |
| 21 | **The final homecoming, the end card, the credits** | **was missing, fixed** | the card and the credits were pages (`#endcard`, `#credits`). Without a page they now show as lines under the picture (src/story/ending.js creditLines), one every 3.4 s. **Unity**: `-ending final`, below; VM to `ending.final` |
| 22 | The Overnight Train (the market's halt, its bell) | **was a soft-lock, fixed** | Off the critical path. night-train.js travels by `location.search`, a stand-in in the engines, so the screen stayed black under its fade. Now `travel:page` restarts the engine there at the level's arrival (`from`). VM (the hand-over); the restart's arrival not run in Unity |

### The Unity runs

`-ending first|final` (new: engine/unity/game.js, BridgeArgs.cs) plays a homecoming on the **debug save**, with the
ship's scenes on. Pictures come every `-ending-every` seconds, and the stage and its subtitle are logged:

```sh
scripts/unity-js-run.sh ending-first -ending first -ending-every 5 -out <dir>
scripts/unity-js-run.sh ending-final -ending final -ending-every 5 -out <dir>
```

- **first**: approach, cargo ("Cargo check before descent…", answered), dive, descend, hatch, walk, tomb (Lou, the
  singing light over the hill, the promise), then `ending.done=true` and the traveller at the stone ("pay your
  respects"). The pictures show the ship coming down over the round house, Lou at the stone, the drawing and the
  light. On the worktree's first run, every frame after the descent was black with stars. The run after, with the
  same code, drew them all: it looked like the first import's shaders, not the game. If it comes back, it is worth
  a look.
- **final**: the cargo with Ilen, the tomb ("Mum. Dad. It's Ilen.", the reel's oldest recording, "Goodbye."), the end
  card's line, then the credits' lines ("The Desert · The Tree That Drinks", …, "At home: …", "The ship is ready
  whenever you are."). The run's 40 pictures ran out before the credits ended; the VM test plays them to `ending.final`.

## What is left, by size

| blocker | size | notes |
|---|---|---|
| **The signature search** is skipped | M | In Unity a findable world is found by choosing it. On the web it is a small search on the StarMap. A Unity StarMap (the chart, its scanner, the cue's rumble) belongs in BridgeMenu |
| **The galactic map's own page** (the system, the NEXT pennant, the relay's signal, the tower's line) | M | Unity has the Worlds page's cards. The charge card and the Quests page still say where to go |
| The night train's arrival in Unity | S | The hand-over is tested in the VM, but the restart at `level.arrivals[from]` has not been run in Unity yet |
| `isNight` for the story (the cranes' dusk run, the market tower at night) | done | now reads the engine's hour |
| `travel:refused` → the gadget's quest started (main.js:805) | S | not listened to in the engines: after a refusal, the quest log shows no lead (the quests also start from conversations) |
| The bird and the bike in other worlds (`birdAnswers`, `bikeComes`, main.js:399–403) | S | main.js only; no main quest needs them |
| The rain path of Lorn's singing (`globalThis.weather`) | XS | the splash path works |
| The "end of the road" page (every story and relic) | S | main.js's own page, not the ending; Home is reached without it |

Nothing found on the critical path needs a minigame, a typed input or a page that Unity lacks. Once the foes and
trials are in, which landed on main while this was written, the game can be played from a new save to the credits
in Unity. The Deck's other conditions are listed in docs/plans/unity-default-portables.md: the saves carried over
(D4–D6) and the launcher (D9).

# Story, quests and the route

Quests, the worlds' stories, the father's charge, the route and the galactic map, the recordings, the ending.

## Story, people, sound and weather

- **Story** (`src/quest.js`, `src/levels/content.js`):
  - each world has one quiet goal, marked by a beam of light, with its
    distance in the HUD;
  - a first visit says the world's title and opening words as a toast, and
    reaching the goal its closing words (the closing moment is drawn into the
    sketchbook); until October 2026 these were three-panel comic pages that held
    the screen. A long toast stays up longer (`toastSeconds`, up to 9 s).
- **Relics:** five per world, often on rooftops, mesas or trees you have to
  climb. Picking one up sketches the moment into your **sketchbook**: press
  **J** to open it. Progress is saved in `localStorage`.
- **People** (`src/npc.js`):
  - two to five per world, wearing the same rider design in their own
    colours, with simulated cloaks near the camera;
  - they walk their routes, stop to look at you, wave, and say a line in a
    speech balloon; shy ones run away if you charge at them.
- **Travel:** by the ship (its galactic map, `src/ship/starmap.js`). The
  stone gates and the walk off the edge of a world are gone (v0.38).
- **Sound** (`src/audio.js`): everything is synthesised with Web Audio, with
  no audio files.
  - A score per world, with its own mode, instruments and leitmotif, and
    the father's theme in each (see "The score, world by world" in [audio.md](audio.md)).
  - Each also has its own ambience bed: city horns and passing taxis,
    birdsong, frogs and insects, ticking gears, high wind, or rustling
    paper.
  - Wind that follows the gusts and storms, and rain.
  - Footsteps that match the ground (sand, stone, grass) and the cloak
    flutter.
  - The jetpack roar, an engine for the bike, skiff and taxis, and bird
    flaps.
  - Chimes for relics and page turns.
  - Sound starts on your first click, and **M** mutes.
- **Weather** (`src/weather.js`): each world alternates clear spells with
  its own weather, ramping in and out over a few seconds. You can force it
  from World → weather.
  - Sandstorms: a warm haze swallows the distance, and streaks of sand race
    across the screen.
  - Rain: slanted ink strokes falling over the scene.
  - Fog banks in the city-shaft and on Lorn.
  - Weather drives the wind on the cloak and the sound.
  - **Shelter** (`src/shelter.js`): the weather stays outdoors. Every
    `interiors.js` room and the traveller's ship are registered interiors
    (`addIndoors(test)` adds more); with the camera or the player in one, no
    rain or sand is drawn and the rain is a muffled drumming on the roof
    (the `rainRoof` sound layer). Under a roof (a ray straight up from the
    camera hits something within 30 m) the rain strokes skip everything
    nearer than `dryReach(roof height)` (`uRainNear` in the post pass), so
    the rain still falls out past the edge.
- **Loading:** the world is built in stages behind an animated inked loading
  screen, and every shader is compiled before the first frame, so there's no
  hitch when it appears.

## Errands and travel between worlds

- **Errands:** in each world one villager asks you to carry something to
  someone in the next world: a jar of singing sand, a taxi token, a feather,
  a brass gear, a glass seed, a humming crystal. Greeting them hands you the
  parcel, and the HUD shows what you're carrying. Greeting the receiver
  delivers it and puts a sketch of them in the sketchbook (J, "Errands").
  The errands are defined in `ERRANDS` in `levels/content.js`.
- **Travel between worlds** is by ship only (v0.38): the gates and the
  seamless edge crossings were removed. The edge of a world is a wall now
  (`player.opts.limit`).

## The father’s charge

"Bring back something of value", the father's last words on the prologue's
recording, is the journey's own quest (`src/story/charge.js`). Its state is read
off the save: given (`charge.given`, or any save past the prologue), out in the
worlds, home on the map, brought home (`ending.done`). It has
its own mark (✦, gold; a world's main quest is ◆, an errand ◇):

- **When home opens** (`homeOpen`, `src/story/ending.js`): one rule for the ship's
  map, this card and the ending. Any six worlds of the eleven, in any order, and
  the last recording on the reel heard ("Come home", `calls.home`; older saves:
  `calls.6`), or the ending already played. The console plays a waiting
  recording before it opens the map, so the two arrive together; between them the
  card says a recording is waiting. Past six the card counts on ("8 worlds done"),
  and the remaining worlds stay open, before home or after (their recordings come
  from the reel's oldest side).

- a title card when it is given, as the dust settles over the crash: the words
  SOMETHING OF VALUE lettered on a band of paper with a pen line and a gold dot,
  and its own sound (`sound.charge()`, a low fifth under three climbing notes). An
  older save gets the card once, at its first quiet moment (`charge.card`);
- a card pinned at the top of the sketchbook: his words, the step now, how many
  worlds, and what you carry (the keepsakes);
- a gold tag on the HUD's objective line: for a while after a keepsake is earned
  ("✦ Something of value: Teo's walking rhythm"), and whenever nothing nearer is
  asked of you.

## The traveller's story begins (v0.32)
Design: `docs/game-brief.md` (the brief and its working decisions) and
`docs/story-bible.md` (each world's story, quests, keepsake and clue). Shared
story state is `src/game-state.js`: persistent flags, keepsakes and an event bus.
Every system talks through it, and its header lists the flags and events.
- **The ship** (`src/ship/`): a 26 m round ship with a walkable interior (bunk
  corner, galley, entry, cockpit round a holo table; see "The ship's deck" in [worlds.md](worlds.md)). It has its own
  collider (`physics.addCollider`) and lands at each world's arrival point
  (`level.shipSite`, `SITE_OVERRIDES` in `sites.js`, or a site search near the
  spawn). In the desert it lies crashed at (58, 48), with a furrow behind it.
  E at the cockpit console plays a waiting call home, or opens the galactic map
  (`starmap.js`). The map is locked until `ship.powered`. Travel loads
  `?level=<id>&via=ship`.
- **The prologue** (`prologue.js` state machine, `cinematics.js` director)
  plays on a new game: waking in the bunk, the father's call, the impact, the
  crash landing seen from outside, stepping out. `?prologue=1` replays it; hold
  Esc to skip. "Reset progress" starts a new game.
- **Calls home** (`src/story/calls.js`): six calls, one waiting after each
  completed world. The father reacts to the latest keepsake's kind; the mother
  joins from the third.
- **The fluid backpack** (`src/fluid-tool.js`): a lava-lamp tank (`#ifdef FLUID`
  in `materials.js`), a hose and a wrist bracer. Shoot (G / click while aiming),
  push (C / middle click / pad B) and boost (jump again in the air) share three
  charges, and all three refill 2 s after the last use (for the jets, 2 s after landing). Hits reach `targets.js` as `'shoot'` and
  `'push'` (with `info { colours, strength, shove }`). `tool.refill({ addColour,
  tone })` adds a colour band for good.
- **Conversations and quests**:
  - `src/story/dialogue.js`: data-driven conversation trees, with conditions,
    choices and effects.
  - `src/story/quests.js`: quests with goto / talk / bring / flag stages,
    markers, HUD, the Q ping, and a journal section.
  - `src/interact.js`: decides who gets the E key. The ship wins inside it and
    at its ramp. Otherwise the nearest person, vehicle or thing wins, and only
    after that the player's whistle.
- **The desert story** (`src/story/desert.js`, `src/desert-city.js`, `magic-water.js`):
  "The Tree That Drinks" (see the story bible). It has the city of Qanat with the
  burning tree, the pilgrims' camps with positional music, a 72-person procession
  on a 2.1 km loop and the cave in a giant's chest. Pushing the fallen rib clears
  the channel; the tree drinks and the water refills the tank with a new colour.
  Bringing the water to the ship powers it. There are three side quests.

## Every world's story (v0.33)
Each world has a story module (`src/story/<world>.js` and `<world>-data.js`,
registered in `WORLDS` in `src/story/index.js`). Each has named people with
conversations, a main quest that ends in a keepsake and sets `world.<id>.done`,
two side quests, reactions and a clue to another world. Story pages are
`manual: true` and close when the main quest does. The story bible has the
walkthroughs and local names; each data file's header lists its flags.

| World | Main quest | Keepsake |
|---|---|---|
| Vael | climb the tower with boost-jumps, blow the rider's whistle | the bird's promise (person) |
| Vael II | fetch the clapper from the floating island, ring the bell: the cloud sinks 16 m | the bell's note (song; it then sounds when you shoot) |
| Hangar | carry the signal through all three zones to the Major's desk | the Major's note (knowing) |
| Buried Machine | push the oil valve, shoot the wick, stand in the light (amber band); the wheel turns a tooth | a rust gear tooth (thing) |
| Viridel | open Odile and Talo's overgrown ship, play their log, part the flowers over the scorch | Mira's words (word) |
| Garden of Spheres | splash the three spheres that remember, then the plaza's pole | the chord of the spheres (song) |
| Lorn | make the Great Crystal sing (rain or three shots), carry its splinter to the cave (violet band) | a singing splinter (thing) |
| Lorn II | relight three dark pools; the saucer answers; it is Odile and Talo's pod | Hollin's lamps (person) |
| City-Shaft | carry the splinter from the bottom to the palace; the Lodestar brightens | "Look up once a day" (word) |
| Signal Market | tune the antenna (three shots at once), play the recording: the father's voice; Oyo's last lantern pours into the tank (yellow-green band, `bazaar.tank.lantern`) | "You are not alone" (word) |

## The ending (v0.34)
- **Calls home** (`src/story/calls.js`): 11 calls, one per finished world. Each
  call reacts to what happened, and each reaction is heard once
  (`calls.beat.<id>`): the world just finished, clues, the bell's note, the
  bird's promise, the people met, and quiet keepsakes compared with things.
  After the broadcast the father deflects "Ilen"; later the mother tells the
  truth in a call of her own.
- **Homecoming** (`src/story/ending.js`, `src/ship/homecoming.js`): after
  `ENDING_WORLDS` (6) worlds, a call asks you home and the galactic map shows
  Home. The sequence:
  1. Take off and come out of the jump in orbit.
  2. Choose one keepsake (or nothing) at the cargo check.
  3. Descend and land at home.
  4. The parents react: the father according to the keepsake's kind, the mother
     always the same.
  5. Credits list every world and the people you met.

  The choice is stored as `ending.*`, and play continues afterwards.
  `?level=home&ending=1` replays it.
- **Home** (`src/levels/home.js`, hidden): a dusk dome house under two moons,
  with an umbrella tree, a washing line in the backpack's colours, and a landing
  ring painted with the glyph. The parents are there to talk to.
- **The bird's promise:** with `bird.promise` set, the whistle calls the Vael
  bird in worlds with open sky and no mount (Viridel, the Garden of Spheres, Home).

## The galactic map and the route (v0.38)
- **The route** (`src/story/route.js`, `knownWorlds`): the worlds open up in `ORDER`. The
  desert (the crash) is always known, then the next `AHEAD` (2) worlds that are not done,
  so there is always a choice of two. Finishing a world (`world.<id>.done` or its story
  page) brings in the next one, and the closing page's toast names it ("New on the ship's
  map: …"). Worlds you have visited, or stand in, stay known. Home opens on its own
  (`src/story/ending.js`). The level picker (L) and the sketchbook (J) apply the same rule; `?level=<id>` and the
  dev menu bypass it.
- **The map** (`src/ship/starmap.js`): unknown worlds are faint unnamed dots along the
  route. Known worlds are drawn planets in flat colours (`src/ship/planets.js`, no
  screenshots): a shadow crescent, an ink outline and one mark each (dunes, bands,
  craters, a ring, a moon, lit windows); ✦ marks a discovery, a dashed ring a world not yet
  visited. The chart is a grid: the field (the route) and a side column with the info
  panel (under the field on a phone held upright), so the panel never covers a name.
  `chartLayout(n, W, H)` places the worlds in pixels for the field's size: a ring round
  home when it fits at 80% scale or more, else a snake of rows. The tests check that no
  two footprints (disc, two lines of name, a tag) overlap at the measured field sizes.
- **Travel asks first:** choosing a world opens "Travel to X?" with Yes / No (Enter / Esc,
  a click, A / × and B / ○). The press that asks never answers: held keys repeat
  (`e.repeat`), the pad needs a fresh A, and a Yes within 150 ms of the question is ignored.
  B or Esc in the question says no and leaves the map open.
- **The gates are gone:** the stone gates (`Gate` in `quest.js`), the page-turn transition
  and the edge crossings (`via=gate`, `via=edge`) were removed; the scout's last objective is
  "Back to the ship". Ship sites no longer keep clear of the old gate spots; the City-Shaft and the market,
  where that moved the ship, pin it where it stood (`SITE_OVERRIDES`).

## The strike's signature: why these worlds
- **The reason for the route** (`src/story/signature.js`, the lore in `LORE.md`). Whatever
  struck the ship in the prologue left a magnetic signature in the glyph-shaped scar on its
  hull, a slow pulse in threes. The ship charts only the worlds whose field carries the same
  pulse (`SIGNATURE_WORLDS`: every world in `ORDER`, each with a reading and the place it is
  strongest), and reads the trace further on from each one you finish (the route's unlock
  rule, unchanged). Home has none: the ship knows that way by heart.
- **Where it shows:** the ship says it as the emergency power comes on after the crash
  (`CRASH_LINE`, the prologue's hatch), the first time the map opens with power (`MAP_LINE`,
  flag `signature.told`), and out of the jump the first time it comes to a world
  (`arrivalLine`, flag `signature.<id>`); the toast for newly charted worlds says the
  signature reads there too (`revealNote`). On the map (`src/ship/starmap.js`) every
  signature world wears a small glyph badge, the panel gives its reading ("matches the
  scar", then where it is strongest once visited), and a dashed box beside the chart
  explains it (a short form on small screens). A few locals notice it in their own words
  (compasses in Qanat, the City-Shaft and the Hangar, the antenna dish in the market, Saba
  at the Great Crystal). `tests/signature.test.js` checks that every destination carries it.

## The recordings, the hologram and the stone
- **No calls home** (`src/story/calls.js`; the arc in docs/story-bible.md, "The
  recordings"). The traveller plays old recordings of his parents on the cockpit console,
  one waiting after each finished world (`calls.<n>`, as before, so saves carry over). He
  asks the reel for the world's word (`REEL`: water, looking up, quiet, bell…) and it plays
  the one match: a line that fits loosely, never an answer. How old they are shows a little
  more each time (`AGE[n]`: a worn date stamp, his own child's voice behind them, "logged
  nineteen years ago", a worn tape), and the console's screen shows the stamp
  (`recordingLabel`). Recording `ENDING_WORLDS` is the last on the reel ("Come home", logged
  "eleven days before the house went quiet"); later ones come from the reel's oldest side
  (`OLDER`). Once-only beats (`calls.beat.<id>`) still follow the journey, and Ilen is a
  recording of the mother's labelled "For when he asks" (`calls.ilen.*`, as before). HUD:
  "E play a recording".
- **The hologram** (`src/ship/hologram.js`): the parents are the game's own people (the
  human bodies, dressed by `costumes.js`, played by the mocap library) projected as
  **coloured busts**: head, neck, shoulders and the top of the chest (`BUST`: cut across the
  chest in the figure's own frame, falling apart into grains below it, the bottom edge just
  over the lens). Each mesh keeps its own colours: `holoLook` reads its ink material (the
  body's clothes by region, as `MODE_OUTFIT`; costume vertex colours; the eyes; plain
  colours) and redraws it in light: two flat tones, a breath of the projector's tint, an
  edge line of paler light, thin climbing scanlines, flicker, slices that slide sideways
  now and then (more when torn up by the prologue's impact), the face's ink lines and a
  mouth that opens with the voice. `PEOPLE`: the father with short brown hair, a full
  trimmed beard (the `beard` mask) and a moustache (`addMoustache`, on the head bone), a
  rust-red shirt; the mother with her long dark hair down (`flow`), a teal scarf over a lilac
  top; the child in yellow. Their hair sits on their own skulls, with a hairline (`costumes.js
  scalp`, see *Hair, faces that talk*), and the beard follows the jaw.
  `show({ face })` turns each bust to the traveller's eyes every frame;
  their heads nod on stressed words, tilt, glance aside or at the other one talking, the
  shoulders breathe and sway. A faint cone and the lens's rings fit the lens (`lens`).
  It is not in the G-buffer: `HOLO.render` draws `HOLO.scene` after the composite into a
  target of its own with a depth buffer (a face hides the back of its head), depth-tested
  by hand against the G-buffer so the traveller in front still hides it, then lays it over
  the frame, slightly translucent, with a soft bloom of its own colours. `callShot` frames
  it from behind his right shoulder and pushes in on the busts' faces (`CALL_FACE`) while
  the hologram is up (`st.close`); `faceRecording` keeps him turned to it. At the stone the
  three busts (`REEL_HOLO`) rise over the reel, looking up at him.
- **The stone** (`src/levels/home.js` `buildTomb`, `src/ship/homecoming.js`,
  `src/story/ending.js`): nobody waits at the door; the window is dark. The cargo check lists
  everything (`tokenList`: the keepsakes, then the makers' small gifts, not the backpack,
  jets or wings). He walks to the parents' stone in the front yard and sets each token on
  the slab (`tombSlots`, `tokenModel`; one short line each, `tombLines`, on a brisk
  `tombTimeline`), last the reel (`reelModel`), which plays `FINAL_RECORDING`, the oldest,
  as a hologram of the three of them over the stone. Then the closing line, an end card and
  the credits ("Left on the stone"). `ending.keepsake` is `all`; saves that ended with one
  keepsake chosen keep it. Coming back later, the stone keeps its tokens.

## The desert reworked: an empty tank, a cold tree, the spark-stone
The desert's main quest (`desert.power`, `src/story/desert-data.js`) now runs: the city, the
chest (the backpack, **empty**), Nour, the well, Ama's jar, the Speaker, the skull, the rib
(levered off without fluid), the pool (the tank and the jar fill), **the well filling** while
you watch, Nour's story of the **spark-stone**, **Marrow's hoverbike**, the ride to **the
Givers' Hearth**, its **grille** and the stone, the stone set in the full well (**the tree
catches**), the ship.
- **The empty tank** (`src/fluid-tool.js`): game flag `tool.empty` (set when the desert's chest
  opens on a new save). `tool.dry`: no charges, no refill clock, every press only sputters and
  emits `'tool:dry'` (the desert says why, once in a while); the HUD reads `empty`, the glass is
  empty. Any `refill()` (the giant's pool) fills it and clears the flag for good; the first
  wade also adds the pool's colour band. An older save never had it set: its tank stays full.
  `story.world.toolHasPush()` is false while dry, so the drum's knuckle is heaved by hand; the
  hoverbike won't wake on an empty tank (`desert-bike.js fuelled()`).
- **The cold tree** (`src/desert-city.js` `city.setLit(k)`, 0..1): no flame (`FlameBody.lit`
  grows the fire up out of its base), no smoke (`SmokeColumn.light()` starts a column that climbs
  from the fire, one period to the end of the plume; `grow` gates the puffs), no sparks, no burn
  (the flame's hazard tests `city.lit`), no light, and only a slow bell for music. The level
  alone (no story) keeps it burning. An ember glob on the cold tree only hisses (the tree's
  target accepts `'fire'` to say so).
- **The rib without fluid** (`src/story/desert.js` `setupLever`): E on the rib with an empty tank
  is a heave that fails (`desert.pole.tried`), the marker moves to **the keepers' pole** leaning
  on the mural, then to **the carved post** beside the gutter; three presses there
  (`desert.lever`) each lift the rib a little more, the third tips it off. A full tank still
  pushes it.
- **The well filling**: once the water runs, walking up to the well starts its rise (some ten seconds of
  living water coming up the shaft, pale motes climbing the trunk, Hessa calling out); brimmed, it sets
  `desert.well.watched` and Nour has a story to tell.
- **The Givers' Hearth** (`src/desert-hearth.js`, `STORY.hearth`, ~1.6 km south-east of Qanat on a
  hilltop of the red rocks, its chimney seen from the way; `hearthStones()`: nine marked stones
  along the way): a butte with a porch whose door looks back at the city, and a dark round hall
  far overhead (portals, like the giant's chest). `src/story/desert-spark.js` drives it: the
  stone breathes (its light, the floor marks and the chimney slit pulse with it); a push target
  rolls the ball down its groove into the hole, the chain lifts the grille into the rock
  (`desert.hearth.open`); E on the shelf takes the stone (`desert.stone.taken`, item `stone`),
  which then rides at your side, lighting the way. E at the well sets it in the water: it
  sinks, a spark climbs the outside of the trunk, and the fire catches over six seconds in the
  cool colours (`desert.tree.lit`; the procession sings, the bands feast). The ship only takes
  the jar's water once the tree burns.
- **Old saves** (`migrateDesertQuest`, `desert.quest.v` 3): a save whose water had already
  risen (channel open, ship fed, or done) saw the tree burn: `desert.tree.lit` is set and the
  errand's stages (`SPARK_STAGES`) are skipped straight to the ship. Others find the tree cold
  and do the new errand with the full tank they already had.
- **Tests**: `tests/desert-story.test.js` plays the chain end to end (the empty tank, the lever,
  the fill, the rise, Nour, Marrow, the bike, the Hearth, the grille, the stone, the lighting,
  the ship); `tests/desert-spark.test.js` covers the migrations, the cold tree (no burn, the
  ember), the Hearth's order and a save restored part-way, the bike on an empty tank;
  `tests/fluid-tool.test.js` the empty tank itself.

## A quest that fails, fewer fetch quests, and the lore made one story

- **Quests can fail** (`src/story/quests.js`): `quests.fail(id)` ends a quest as `'failed'`
  (its flag `quest.<id>`; also `failed.<id>` = its title, for the charge). A failed quest is
  over like a finished one (not active, never tracked, `isEnded`), can't be restarted or
  retried, runs `onFail` instead of `onDone`, toasts "Failed: …" with three falling notes
  (`sound.fail`), and the sketchbook files it under its own **Failed** heading with a dashed
  earth-brown rule, a crossed **✗ Failed** stamp and its `failOutro`. Dialogue can test it
  (`{ quest, failed: true }`) and do it (`{ fail: id }`). A quest marked `major` toasts as
  "Quest" and wears ◆ like a main one. The father's charge card lists failed quests under
  "What you could not mend" (`chargeState({ failed })`, fed by main.js from the flags).
- **Viridel's tea terraces** (`src/story/terraces.js`, quest `edena.terraces`, Esk in
  `edena-data.js`; LORE.md, "The quest that fails", says why Viridel): four terraces on the
  white builders' steps down into the dry hollow south-east of the landing (`TERRACES` in
  `src/levels/edena.js`; flora and grass keep off them), Esk's tea bushes in rows (instanced),
  the builders' cistern on the rise with its gate and wheel. The steps are built from the ground
  up (`terraceLayout`: each step's top is level along x and at least 1.2 m over the one below),
  white walls with the makers' inscriptions, earth tops, a stone ramp up each wall at the north
  end; they collide through `physics.addCollider`, in three parts: the sides, the lane (the
  middle the flood takes) and the gate. The quest: push three clods out of the runnels, top
  first (a lower one slumps back); at Esk's asking water the roots on the gate's wheel (shoot),
  then one shove (push). The flood is scripted, ten seconds: the gate tears loose, a white sheet
  of water runs down the lane (a strip revealed by `drawRange`), each step of the lane sinks and
  goes as the front passes (its collider dropped), the lane's bushes are swept down into the
  hollow, the mud fan grows, the cistern empties (`sound.rumble`). What is left is built from the
  start and shown after: the mud lane with a stream, the fan and a muddy pond, the gate's slab
  and wheel and broken wall blocks in the mud (colliding), uprooted bushes. `edena.terraces.flooded`
  rebuilds it like that on every visit (and a save that stopped mid-flood comes back flooded).
  Then Esk blames you, you say sorry, she says it belongs to the ground now, and it fails. Mira,
  Sol and Vey each say a word about it once; a recording afterwards has the father on breaking
  things (`calls.js` beat `broke`), and Viridel's own recording gets a different answer
  (`REEL.edena.youAfter`). At the stone the traveller names it, once, after the space for Ilen
  (`tombLines(tokens, { broke })`, from `edena.terraces.flooded`).
  `tests/story-terraces.test.js` runs it end to end and reloads it.
- **Hands-on steps in the fetch quests** (each one solvable with a plain shot and push; ember
  shots work where lighting fits; existing stage ids kept, so old saves carry on):
  - - *Teo's drum* (desert, `src/story/desert-errands.js`): it stands on its rim under the ribcage,
    pinned against a rib's foot by a knuckle of spine; shoved toward the rib the knuckle only
    jams tighter, shoved from the side it rolls off and the drum rolls out like a wheel (by
    hand before the backpack). Stage `free`; flag `desert.drum.freed`.
  - *The mask in the sand*: sand has drifted over its eyes like lids; a splash washes one clear
    but the wind sifts it back in seven seconds: clear both at once and it looks at you. Stage
    `eyes`; flag `desert.mask.eyes`.
  - *A ration for the guard* (City-Shaft, `src/story/incal.js`, the prop in `src/levels/incal.js`):
    the tin hangs in an old goods hoist's basket out over the void; shoot out the rusted pin,
    then push the weight round the post (along the arm it only rocks). Stage `hoist`; flags
    `incal.hoist.pin`, `incal.hoist.in`.
  - *A letter across the aqueduct* (Vael II, `src/story/arzach2.js`): Ondine answers with the
    tower's old signal lamp: light it (shoot), turn its tiller notch by notch (push from the side)
    until it faces the carved bell toward the rose cliff, and a light answers from Ysolde's
    window. Stage `lamp`. *The bell's clapper* lies under tiles that fell up with it: push them off.
  - *The keeper's key* (Buried Machine, `src/story/buried.js`): the crane's jib hangs out over
    the drop; free its rusted collar with a splash, then ratchet it round with side-on pushes
    (the pawl only turns one way) until the hook is over the platform. Stage `swing`.
  - *The moss-dome latch* (Lorn II, `src/story/perdide2.js`): with the latch back, moss in the
    frame keeps Pim's door from shutting: wake the moss lamp over it (shoot), then push the door
    shut. Stage `shut`. *Whose skiff?*: Fen asks you to bring the skiff home once: light the lamp
    on his berth post, step off on his landing and nudge the empty skiff in. Stage `home`.
  - *Mira's water clock* (Viridel, `src/story/water-clock.js`): the Hangar's errand of a brass
    gear now ends on the clock: fit it (E), then fill its leaking bowl with three quick splashes
    so it tips and rings (quest `edena.clock`).
  - Left as they were, already hands-on: the bird's feathers and the stone hand, the cairn,
    the machines and Pip's ball, the gauges, the seed (watered), the pools, the fireflies, the
    plants, the spheres and the pebble, the crates and the oldest sign. The other between-world
    errands stay light parcels (a greeting gives, a greeting takes), on purpose.
- **The lore, one story** (LORE.md, section 10, has every decision): the light passed every
  world the same night, the night the ship was struck, and climbed away; Ilen's message is
  thirty years on the way; recording 4 is an old one made for him at ten; Odile and Talo were
  struck twice and went on across the swamp; the spheres came down out of the sky and the
  white builders copied them; the Hangar's board and Lorn II's Welcome draw the ∩; the bell
  whistle is clay, not a second bone whistle; the Atelier no longer claims an unlock; Ivo's
  Footprint points at the chest that exists; a few wrong directions are put right.
- **People who share a name have ids of their own** (`hask.buried`, `ossa.buried`,
  `pip.garage`, `lio.edena`, `hollin.perdide2`, `pim.perdide2`, `aube.spheres`, `ivo.perdide`;
  Clemence's old id `malvina` is `clemence`), so meeting one no longer marks the other in the
  credits or the mother's "who did you meet". `src/save-migrate.js` brings old saves up once
  (flag `save.migrated`): a "met" carries over to the renamed person if the save has been to
  their world; Clemence's flags move outright. `tests/save-migrate.test.js`.

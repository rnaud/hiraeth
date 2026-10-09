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

- **Errands:** in every world but the last one villager asks you to carry something to
  someone in the next world on the route (`ORDER`), never back to one already
  done: Pell's singing sand from the desert to Senn in Vael (who listens to
  stones); Kesh's feather of the bird from Vael to the sky stones of Vael II;
  Brother Calix's muffled hand bell from Vael II to Wendel, Lorn's egg-warden;
  Ivo's storm crystal from Lorn to Bram, who minds Lorn II's root cave; Pim's brass
  gear from Lorn II's domes to Mira's water clock in Viridel; Rue's glass seed
  from Viridel to Nima in the City-Shaft; Lio's taxi token from the City-Shaft
  to Clemence in the Sealed Hangar; Nikko's gear grease from the Hangar to Tull at
  the Buried Machine's oval doors; Ket's pipe whistle from the Buried Machine to
  Linnet, the spheres' listener; Nell's sliver of lake mirror from the Garden of
  Spheres to Oyo's lantern stall in the Signal Market (the last four since the story
  pass of October 2026, docs/story-audit.md). Greeting the giver hands you the parcel, and the HUD
  shows what you're carrying and where it goes (the receiver's world now, even
  for a parcel picked up before the errands were re-routed). Greeting the
  receiver delivers it and puts a sketch of them in the sketchbook (J,
  "Errands"). The errands are defined in `ERRANDS` in `levels/content.js`;
  `tests/errands-route.test.js` keeps each one going to the next world.
- **Travel between worlds** is by ship only (v0.38): the gates and the
  seamless edge crossings were removed. The edge of a world is a wall now
  (`player.opts.limit`).

## Two homecomings, the Lantern and the true ending (October 2026)

The ending is in two parts, so that the credits come after the story's peak (docs/audits/game-v0.97.md,
themes 5 and 6). One rule set in `src/story/ending.js` (pure; `tests/finale.test.js`):

- **The first homecoming** (`homecomingKind` → `'first'`: `ending.done` unset). Six worlds still bring
  him home (`ENDING_WORLDS`, `homeOpen`). `src/ship/homecoming.js` plays as before up to the stone:
  every token down, the choices the stone remembers (`choiceLines`), Ilen's space if he knows of her,
  Lou's drawing. Then, as he takes out the reel, the singing light comes over the hill (`lightOver`:
  lines with `light: 'come' | 'dip' | 'go'` fly a glowing point in from the valley, round the round
  house and away out along the route; the camera follows it). He keeps the reel; Lou makes him promise
  on the stone ("Once more. Then I'm staying."). `FIRST_CLOSING`, no end card, no credits; `ending.done`,
  `ending.first: 'new'`. The reel's oldest recording is not heard.
- **Pointing back out.** After it the voicemail holds the ship's log (`TRACE_CALL`, `calls.trace`,
  `src/story/calls.js`): the light passed over home, its trace runs back out along the route; he asks the
  reel for "singing" and finds the father at the window. Every recording from the reel's oldest side ends
  with where to go (`pointOut`). The relay (`src/story/relay.js`) has a third stage, `'trace'`: the map's
  Lantern pulses, the console's standby says LIGHT TRACE. The father's charge has stages `'light'` and
  `'ilen'` (`src/story/charge.js`) with their own HUD lines.
- **The Lantern** (`FINALE_ID = 'lantern'`; `finaleOpen`: after the first homecoming, once the market's
  broadcast has been heard, in either order). On the galactic map past the market, a dotted line out
  to it (`finaleEntry`, `src/ship/starmap.js`). The place: `src/levels/lantern.js` (docs/systems/worlds.md
  has no section: it is one small island; its header says what is where). The story: `src/story/lantern.js`
  and `lantern-data.js`. A filmed moment on first stepping onto the island (the light comes down into
  the crown, `lantern.moment.arrive`); Ilen at the lantern's step; one talk that answers the light (what it
  is, why it struck, the makers' sign), hears what he chose on the way, and asks him to tell Hollin. She
  comes home with him (`finale.met`, the quest "We Heard You" done, `world.lantern.done`, the keepsake
  `lantern.person`, which never goes on the slab: `NOT_SET_DOWN`). She walks down the bar and goes aboard.
- **The true ending** (`homecomingKind` → `'final'`: `finale.met`, `ending.final` unset). The cargo check
  lists Ilen and what is new; at the stone (`tombLines(fresh, { final: true })`) she speaks to them, sets
  down the message that reached her (`ILEN_TOKEN`), answers his choices (`ilenOnChoices`), Lou asks to
  draw her; then the reel at last and `FINAL_RECORDING`, `CLOSING`, the end card and the credits (the
  Lantern and Ilen in them). `ending.final`; afterwards the slab shows the reel and her message
  (`stoneTokens`, `src/levels/home.js`), the round window's lamp is lit, and Ilen lives at home
  (`ILEN_HOME`, `src/story/home.js`). `?level=home&ending=1` replays the first, `&ending=2` the last.
- **The choices the stone remembers** (`choicesMade`): Dov's lift token in the City-Shaft (keep it, or
  press it back into his hand: `incal.token` 'kept' | 'returned', `src/story/incal-data.js`); Hollin's
  promise in Lorn II, which costs the coming back (`perdide2.promise`; kept by talking to him again after
  finishing another world, `perdide2.promise.kept`; with Ilen's news he hears where Odile and Talo went,
  `src/story/perdide2-data.js promiseDue`); Esk's hill in Viridel (the quest that fails). Each has a line of
  his at the first homecoming, a reply of Ilen's at the Lantern, and a line of hers at the stone.
  A save from before the token was a choice (the keepsake given outright, no `incal.token`) reads as kept
  (`src/save-migrate.js` step 3, which reads the keepsakes too): the Lantern's `tokenKept`, and Dov's `lit`
  has a line for a kept token.
- **The route's people hear about Ilen** (October 2026). Once he knows who she was (`calls.ilen.told`), one
  answer each, once: Madame Sel's `after` (the Signal Market: "Ilen was my sister", `sister`, she hears it
  was the first of her two readings; `bazaar.sel.ilen`), Hollin's `after` (Lorn II: "I had a sister",
  `perdide2.hollin.ilen`, only before the Lantern) and Nour's `after` (the desert: the singing light her
  parents heard, `desert.nour.ilen`, only before the Lantern). Once he has found her (`finale.met`), Sel hears
  she heard it (`found`, `bazaar.sel.found`), and Hollin's `after` offers Odile and Talo's news too (it was
  only in `came`, the kept promise; `perdide2.hollin.found` stops it twice). Tests: `tests/route-ilen.test.js`.
- **Old saves** (`src/save-migrate.js` step 2): a save that ended under the old rules has had its first
  homecoming (`ending.first: 'old'`); the reel the old ending left on the slab is his again until the true
  ending; the ship's log waits on the voicemail; the Lantern opens once the market has been heard.

## The father’s charge

"Bring back something of value", the father's last words on the prologue's
recording, is the journey's own quest (`src/story/charge.js`). Its state is read
off the save: given (`charge.given`, or any save past the prologue), out in the
worlds, home on the map, then (after the first homecoming) follow the light, take Ilen home, and
brought home (`ending.final`). It has
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
  small, in the lower third (the world you arrive in is for looking at: clear of the
  toasts at the top and the subtitles at the bottom), gone after five seconds,
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
  E at the holo table in the middle of the deck opens the galactic map (`starmap.js`); the
  cockpit dash is the voicemail (docs/systems/ship-consoles.md). The map is locked until `ship.powered`. Travel loads
  `?level=<id>&via=ship`.
- **The prologue** (`prologue.js` state machine, `cinematics.js` director)
  plays on a new game: waking in the bunk, the father's call, the impact, the
  crash landing seen from outside, stepping out. `?prologue=1` replays it; hold
  Esc to skip. "Reset progress" starts a new game.
- **Calls home** (`src/story/calls.js`): six calls, one waiting after each
  completed world. The father reacts to the latest keepsake's kind; the mother
  joins from the third.
- **The fluid backpack** (`src/fluid-tool.js`): a lava-lamp tank (`#ifdef FLUID`
  in `materials.js`), a hose and a glove on the right hand, which is what shoots. Shoot (G / click while aiming),
  push (a gun mode, fired as a shot) and boost (jump again in the air) share three
  charges, and all three refill 2 s after the last use (for the jets, 2 s after landing). Hits reach `targets.js` as `'shoot'` and
  `'push'` (with `info { colours, strength, shove }`). `tool.refill({ addColour,
  tone })` adds a colour band for good.
- **Conversations and quests**:
  - `src/story/dialogue.js`: data-driven conversation trees, with conditions,
    choices and effects.
  - `src/story/quests.js`: quests with goto / talk / bring / flag stages,
    markers, HUD, the Q ping, and a journal section.
  - `src/interact.js`: decides who gets the E key. The ship wins inside it and
    at its ramp. Otherwise the nearest person, vehicle or thing *in the way you
    face* wins (its distance weighed ×1 ahead, ×2 to the side, ×3 behind:
    `facingWeight`; a vehicle measured from its side, `halfWidth`), so E boards
    the cab you walk up to with a passer-by at your shoulder; the prompt shown is
    always the one E will use; only after that the player's whistle.
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
- **Only finished worlds are charted** (playtest 2026-10-08): `WIP` in `src/levels/names.js` lists the
  worlds still being made (the twelve detours built in October 2026, never vetted or finished). The ship's
  map is given `CHARTED_SIDE` (the detours minus `WIP`, none for now) instead of `SIDE`, and the Sightings
  page leaves out the slots of a `WIP` world unless one was already met there. The worlds list (L, Debug),
  the dev menu (\`) and `?level=<id>` still open every world. To release a detour, play it through and
  take it out of `WIP`: the map charts it from then on. `tests/menus-settings.test.js`.
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
  "E voicemail" (no word of a recording before the third message gives it away).
- **The relay signal: Ilen before home** (`src/story/relay.js`, October 2026; docs/story-audit.md).
  The Signal Market is the last world on the route and home opens after six, so the ship hears the
  broadcast from far off instead of the worlds changing order. From `RELAY_FROM` (four) worlds done
  until the broadcast is heard (`clue.bazaar.home`), the market's place on the galactic map pulses
  with a dotted gold ring and the tag "a signal", whether it is charted yet or only a faint dot (the
  map's sub line and home's panel say it is further along the route); the console's standby screen
  says RELAY SIGNAL and its "No new messages" says where it comes from; "Come home" ends with the
  ship's word of it. Once he has asked the reel for Ilen, the recording is **held** ("Recording held.
  It will wait at the console.", RECORDING HELD on the screen, a line on home's panel) and it waits
  as soon as he steps out of the ship (`calls.ilen.later`, set on `ship:exit`) or the ship flies, so
  flying straight home from the market still leaves it at the console. After it, the father's own
  recording on Ilen (the `ilen.after` beat, `ILEN_AFTER_CALL`) waits the same way
  (`calls.ilen.after.later`) when no world is left to bring it; it now holds the line written for
  "Come home", which plays before the market in any run ("I would have welcomed her back with empty
  hands."). The recordings after "Come home" still ask the reel for the world's word first (so the
  City-Shaft's, the Hangar's, the Buried Machine's, the spheres' and the market's lines play), and
  "Come home" itself asks for the sixth world's before the last of all. After the ending, a player
  who learns about Ilen hears "And this space is for Ilen, wherever she is." once at the stone
  (`ilenAtStoneDue`; `ending.ilen` when the ending named her). `tests/relay.test.js` plays a run in
  the route's order and checks every world's reel line, the mother's recording and the father's are
  heard before the stone.
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
  everything (`tokenList`: the keepsakes, then the makers' small gifts in `TOKEN_ITEMS`, each with
  its own line: the stilling lens, the ember ring, the fourth chamber, the quick coil, the lantern
  charm, the glyph lens, the bell-note whistle, the listening shell and the echo shell (since the
  second story pass), the pale star; not the backpack, jets or wings). He walks to the parents' stone in the front yard and sets each token on
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
  (`desert.hearth.open`); E on the shelf takes the stone (`desert.stone.taken`, item `stone`)
  into your pack: nothing floats about you (players: "it should go in my inventory"); the
  sketchbook's Gear section lists the quest items you carry under "In your pack"
  (`quests.carried()`, `gearHtml({ carried })`), and so does the menu's Quests page; in the dark
  hall it glows a little through the pack. E at the well takes it out into your hand and into
  the water: it sinks, a spark climbs the outside of the trunk, and the fire catches over six seconds in the
  cool colours (`desert.tree.lit`; the procession sings, the bands feast). The ship only takes
  the jar's water once the tree burns.
- **Old saves** (`migrateDesertQuest`, `desert.quest.v` 3, now 4: see below): a save whose water had already
  risen (channel open, ship fed, or done) saw the tree burn: `desert.tree.lit` is set and the
  errand's stages (`SPARK_STAGES`) are skipped straight to the ship. Others find the tree cold
  and do the new errand with the full tank they already had.
- **The first ten minutes, as World 1-1 (October 2026, `docs/audits/game-v0.97.md` item 3)**:
  - **The makers' dregs**: the chest's tank is empty but for one shot of old fluid (`tool.dregs` = 1,
    set with `tool.empty` when the chest opens; `src/fluid-tool.js` `dregs`). The tank stays "dry"
    for the story (`dry()`, `toolHasPush()` false, the lever is still the way), but one press of
    shoot fires; a push only sputters ("too little to push with"). Spent (`'tool:dregs'` with
    `left: 0`), it is gone for good (`desert.dregs.spent`, one toast) until the pool fills the tank as
    before. The chest's toast names the aim and fire buttons for the input in your hands
    (`dregsText`, `verbKey`), and so does the pool's first fill (`filledText`).
  - **Four talks became two**: Nour has you listen at the dry well with her in her own talk (her
    `rim` node, `desert.well.seen`; the well can still be looked at), and Ama's jar and the
    Speaker's old words were one stage, `ask` (since the first hour was shortened, below, it is Ama's
    jar alone). Stages now: city, box, elder, ask, down, channel, fill, …
  - **Old saves** (`desert.quest.v` 4, `STAGE_MERGE` in `desert-data.js`): a save at the old `well`,
    `ama` or `speaker` stage goes to `ask` and keeps what it did (it advances at once if both were
    done). A v1 save first goes through `STAGE_MIGRATION` (to Nour), as before.
  - **The fire-bearers' way** (`src/story/desert-way.js`; `wayPlaces()` / `WAY` in
    `src/desert-sites.js`; drawn in `src/desert-hearth.js` `way`): three things by the marked stones
    on the 1.65 km ride to the Hearth. The keepers' bronze **bowl** at the second stone, whose mark
    is dull: any shot of fluid fills it and the mark wakes (`desert.way.bowl`). The keepers' cold
    **camp** halfway, its tally stone (three days out, three home; `desert.way.camp`). A small
    **bell** glinting in the sand near the end, a flash every few seconds (the sun on it) big
    enough to see from the saddle; ring it; the Speaker hears of it (`desert.way.bell`,
    `desert.way.told`). `tests/desert-spark.test.js` covers them and the v4 migration.
- **The first hour shorter (October 2026, `docs/fun-and-story-review.md` item 5)**: the review's "three talk
  stages in a row" were still three talks after the chest (Nour, Ama, the Speaker), and the ride's three
  things blinked past at 34 m/s.
  - **Nour says the verse.** Her `quest` node gives the Speaker's line herself ("Where the giant's eyes are
    marked, its mouth is a door", the marked skull beyond the back gate), so `ask` is **Ama's jar alone**:
    `askedDone` (`src/story/desert.js`) sets `desert.asked` once `desert.jar.given` is; the stage's marker is
    on Ama (`at: 'ama'`; `askWho` is gone). Ama's `power` points at the skull. The Speaker is a stage no
    more but keeps his whole talk (the giants carried the water from the swamp of lights, the clue
    `clue.desert.perdide`, `desert.speaker.heard`) for whoever walks with him; Nour's `down` and Ama's
    `power` say he keeps the old words whole. Old saves at `ask` with the jar pass on at once.
  - **The jar on the way in.** Ama's `early` (before Nour has sent you) leads to `jarEarly`, which gives the
    jar (only offered while `desert.jar.given` is unset); then Nour's `quest`, `rim` and `again` say the jar
    is on your hip already (`{ if: { has: 'jar' } }` lines) and `ask` passes the moment it comes. The camps
    lie on the way from the ship to the gate; the back gate is beside the tree.
  - **Ama calls you over for it.** While `amaCallsYou` (`src/story/desert.js`: no `desert.jar.given`, the tree
    cold), her shout as you come up to the camps before the chest is `CALLS.ama[0]` (come by my fire, a jar
    that wants carrying) instead of "To the city!" (`amaCampShout`), and she is a caller ("calling you over")
    with `max: 2`: the shout counts, so one more word at most as you pass within 14 m. Callers take an
    optional `max` and `flag`; hers sets `desert.ama.called`, which gives her `hello` the answer "You called
    me over. A jar?" (`jarCalled`, the same jar). With the jar given she waves you on as before.
  - **The ride, called out.** `setupWay` names each place once as it comes up ahead on the errand (stages
    `hearth`, `stone`, `light`): moving toward it (from where you were 2 m back) and within `CALL.range`
    (130 m; the Hearth's door 320 m, on the way out only), not nearer than `CALL.near` (18 m), and not once
    it is done (the bowl filled, `desert.way.camp`, `desert.way.bell`). The line (`CALLS`: what you would see
    from the saddle, no lore) goes to `ctx.cue`, which main.js points at the drone's line under the view
    (`scoutSays`, 6 s): a toast waits its turn in the queue, and "ahead" said late is behind you. Without a
    cue (the tests) it is a toast.
  - **Measured** (the story on the game's own modules, a direct player's shortest answers; words at 48
    letters a second plus 1.2 s a page and 1.5 s an answer, walking 6 m/s in straight lines, the Speaker at
    an average place on his loop): talks before the way down 4 → 3 (after the chest 3 → 2; 1 with the jar
    on the way in), pages 24 → 15, answers 10 → 6, walk 1040 → 865 m (625 m), stepping out to the giant's
    mouth ~275 → ~210 s (~174 s). The ride stays 1.6 km (~48 s each way at top speed).
  - Tests: `tests/desert-spark.test.js` (the merged stage on the jar alone, the jar on the way in, Ama's
    call twice at most and only without the jar, the call-outs out and home and not off the errand), `tests/desert-story.test.js` (the chain: Ama, then the
    way down; the Speaker optional).
- **Tests**: `tests/desert-story.test.js` plays the chain end to end (the empty tank, the lever,
  the fill, the rise, Nour, Marrow, the bike, the Hearth, the grille, the stone, the lighting,
  the ship); `tests/desert-spark.test.js` covers the migrations, the cold tree (no burn, the
  ember), the Hearth's order and a save restored part-way, the bike on an empty tank;
  `tests/fluid-tool.test.js` the empty tank itself.

## Quests open in a conversation; people call you over
Players: "the quest shouldn't just appear. I should talk to someone who gives me a hint about
where it is", and "the conversation with Nour should not auto trigger, but she should make a
sound to make it clear I should chat with her".
- **The opening conversation** (`src/story/quests.js` `opensWith(id, who, { label, at })`): a
  world's main quest is no longer started on arrival. Until it is, `objective()` (the scout's
  ping, the marker, the Quests page) finds the first of `who` (the first stage's label), ahead
  of a quest that started on its own (a box's, `background`; a temple's started on arrival,
  `arrival`) unless the player chose that one in the quest log (`quests.choose`). Talking to
  any of `who` starts it just before they speak (`Dialogue.start` calls `quests.opening(id)`,
  so their words are said with the quest under way); its "Quest:" toast waits for the end of
  the talk (`quests.opened()`), or comes with the stage the talk moves it to. Every world opens
  on its first stage's person (Oïa, Sister Aube, Madame Sel, Wen, Mira, Ambroise, Nima, Wendel,
  Hollin, Linnet); the desert on **Marrow**, who is at your ship when you step out, looking over
  the scar on its hull (`wreck` / `fire` nodes: the only fire that could wake a ship is the
  great tree's, in Qanat; ask Nour), or on Ama, the Speaker, Nour or Hessa if you walk past
  him. Once the quest is under way and you are 60 m off, he is back by his crates.
- **Calling you over** (`src/story/desert.js` `caller`, lines `CALLS` in `desert-data.js`):
  whoever has a word for you never starts the talk: every few seconds while you are near and
  haven't come over, a balloon in their own voice, Nour a "psst" and a little hum
  (`sound.psst(pos)`), and they turn to you; the prompt is theirs over the people standing
  about them (their talk's priority +1 while they call). Marrow at the ship; Nour once the chest
  has opened (she comes over to you and waits) and when the tree has drunk and stays cold.
- Tests: `tests/desert-story.test.js` (no quest on landing, Marrow calls and gives the hint, the
  quest starts in that talk; Nour comes over and calls, never opens the talk herself), each
  world's `tests/story-*.test.js` (the quest waits for its first talk).

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
  The Quests panel files it under **What happened** (a quiet `·`, not "Failed ✗"), and the toast
  reads "What happened: Water for the Tea Terraces" (`quests.js`, `game-menu.js`: any quest that
  fails; this is the only one). **Coming back** (a visit that began with the quest already
  failed sets `edena.esk.back`), Esk has decided there is a small job: the quest
  `edena.cutting` ("A Cutting for the Mud"): press one tea cutting from the rows that held into
  the mud beside the stream (E, or X / □, `edena.cutting.planted`), then tell her ("It won't be
  my grandmother's hill. It'll be this one."). The cutting stays in the mud on every visit
  after, and she checks it every morning.
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
  - *Mira's water clock* (Viridel, `src/story/water-clock.js`): Lorn II's errand of a brass
    gear now ends on the clock: fit it (E), then fill its leaking bowl with three quick splashes
    so it tips and rings (quest `edena.clock`).
  - Left as they were, already hands-on: the bird's feathers and the stone hand, the cairn,
    the machines and Zazie's ball, the gauges, the seed (watered), the pools, the fireflies, the
    plants, the spheres and the pebble, the crates and the oldest sign. The other between-world
    errands stay light parcels (a greeting gives, a greeting takes), on purpose.
- **The lore, one story** (LORE.md, section 10, has every decision): the light passed every
  world the same night, the night the ship was struck, and climbed away; Ilen's message is
  thirty years on the way; recording 4 is an old one made for him at ten; Odile and Talo were
  struck twice and went on across the swamp; the spheres came down out of the sky and the
  white builders copied them; the Hangar's board and Lorn II's Welcome draw the ∩; the bell
  whistle is clay, not a second bone whistle; the Atelier no longer claims an unlock; Emrys's
  Footprint points at the chest that exists; a few wrong directions are put right.
- **People who share a name have ids of their own** (`hask.buried`, `ossa.buried`,
  `pip.garage`, `lio.edena`, `hollin.perdide2`, `pim.perdide2`, `aube.spheres`, `ivo.perdide`;
  Clemence's old id `malvina` is `clemence`), so meeting one no longer marks the other in the
  credits or the mother's "who did you meet". `src/save-migrate.js` brings old saves up once
  (flag `save.migrated`): a "met" carries over to the renamed person if the save has been to
  their world; Clemence's flags move outright. `tests/save-migrate.test.js`.
- **Every name once** (the second story pass, October 2026): no two people share a name, nor
  look alike. The name stays where it is most established; the others took names in their
  world's style: the Hangar's Pip is **Zazie**, Viridel's Lio **Rue**, the City-Shaft's seller of
  views (Hask) **Tobin**, the Buried Machine's Ossa **Ket** and its Pim **Jot**, Vael's Hollin
  **Kesh**, the spheres' Ivo **Emrys** and Aube **Linnet**, the Undertower's Pell **Hobb**, the
  spheres' drifter Slow Pell **Slow Orm**; the near-misses Ysel (Vael II's bridge) **Agathe**, Ysa
  (the desert) **Rima**, Tamsin **Dalia**, Ferrol **Gaspard**, Brann **Fisk**, Lorn II's Wick
  **Robin** (the Buried Machine's Wick is only the lamp now); the desert's sketcher, listed as
  "The traveller", is **Naji**. Only names changed: ids and flags are kept (`hask`, `pip.garage`,
  `wick`…), so saves carry on. `tests/names.test.js` fails if two people (story people, the
  level people, the temple guides, the drifters) share a name or a name is "The traveller".

## Quests played out of order (the story pass, October 2026)

A stage that waits for a flag only one conversation sets is a soft-lock waiting to happen: do the thing
itself first and that conversation is never reached again (its entry has moved on). Where the story
can be done in another order, the quest catches up instead (docs/story-audit.md):

- **the desert**: the channel opened before Nour, the well, Ama or the Speaker sent you (`desert.js`
  `caughtUp`) passes those steps; Ama's `lateJar` still gives the jar;
- **the Buried Machine**: the Wick lit before Wen or Hask (`buried.js` `caughtUp`); Ket met after the
  gauges were read starts and ends her quest in that talk;
- **Viridel**: telling Rue about the tallest tree after reading Talo's note first starts and ends
  `edena.tree`; **the Signal Market**: Kip met before Sel moves the quest on when you see him again;
  **the Garden of Spheres**: Linnet met after all three spheres still counts as heard;
- **the temples**: a temple's quest that starts as you pass its door (the ship lands beside Vael's
  Aerie) counts as one that started on its own until you go in, so the drone still finds the world's
  opening conversation (`src/temples/index.js`).

Each has an out-of-order test in its world's story test.

## Places to stop on the way (the second story pass, October 2026)

The audit's empty stretches (docs/story-audit.md, "Places to fill"), one at a time, with the worlds'
own kits and systems, a few draws each, and colliders baked from what is drawn (`physics.addCollider`).

- **The halfway stall** (`src/story/halfway.js`; words in `incal-data.js`): the City-Shaft's middle
  levels (y −24), ten metres along the promenade from the middle cab stop, on the stretch the houses
  leave clearest (`HALFWAY`). Perrine's tea stall: a counter under a flat red awning, a kettle and
  cups, a bench, HALFWAY TEA on the board, and Perrine behind it (her lines change while you carry
  the splinter, and after). Beside it **the halfway mirror** on its pole: her mother set it to catch
  the Lodestar and throw a coin of its light down to the bottom; the smog greased it and someone at
  the top turned it to a billboard. Quest `incal.mirror` ("The Halfway Mirror"): wash it (shoot,
  `incal.mirror.washed`), push the frame from the side a notch at a time (eight notches,
  `incal.mirror.notch`, from 3) until it faces up the shaft (`incal.mirror.turned`; shoved straight
  at the glass it only rocks), tell Perrine (`incal.mirror.done`). Done in another order, she
  notices and it ends there. With the Lodestar lit, the glass glows, and Ossa at the bottom has seen
  the coin of light come back on Behla's wall. The Smog lantern relic (the world's third) sits over
  the awning's flat roof now (`content.js`, `AWNING_TOP`). Far above or below (160 m), the stall is
  not drawn. `tests/story-incal.test.js` plays it.
- **Vael's fallen giant** (`THINGS.colossus`, `src/story/arzach.js`): a look from in front of its
  face, out on the plain: it lies as if it lay down to rest, turned toward the lone tower; once the
  bird has come, her shadow crosses its face (`arzach.colossus.seen`).
- **The Givers' Hearth's frieze** (`src/desert-hearth.js` `FRIEZE`, `THINGS.carving`,
  `src/story/desert-spark.js`): along the porch's lintel, left of the Givers' mark, five small
  figures pass a light hand to hand toward a tree (drawn on the lintel's face, the light in the
  stone's own pulsing material). Once you have carried the spark-stone yourself, the look says
  you have been one of them (`desert.carving.seen`).
- **The masked head's chamber** (`level.maskRooms`, `THINGS.smallMask`): the little glowing mask on
  the pedestal is the dunes' sleeping face made small; if you have seen the lone tower's carved face
  in Vael II (`arzach2.face.seen` / `clue.arzach2.desert`), the look says so: somebody made it in more
  than one world (the tower's look already names the desert's mask).
- **The crashed hull's slate** (`src/desert-landmarks.js` `wreckSlate`, `THINGS.slate`): by the
  salvage camp's hut in the southern dunes, Marrow's old tally: plates, wire, two pumps, one good
  chair; "NO MARK ON HER. FELL ON HER OWN." (`desert.wreck.read`). Next time you meet him he brings it
  up himself, once (`desert.marrow.hull`): most ships that come down just come down; he checks every
  wreck for the mark since yours. `tests/desert-story.test.js` and `tests/story-arzach.test.js` check
  each look-at stands on walkable ground and says what it should.

## Sightings, and a trace in every detour world (October 2026)

The audit (docs/audits/game-v0.97.md, theme 4 and item 5): the game is built on signs that recur, and
nothing kept them; the twelve detour worlds were tourism. Now every trace of the singing light, the
makers' sign and the father's signal is written down as the traveller meets it, and each detour
world holds one more.

- **What a sighting is** (`src/story/sightings.js`): `{ id, thread, world, who, line }` and how it is
  met. `heard: { who, node, has? }`: a conversation reaches that person's node (the Dialogue's ctx
  `onNode` emits `dialogue:node` with the person's id, the node and what it says; a listen-only
  person's node is `listen`, and `has` is a few words of the entry). `flag`: a flag the story already
  sets (`perdide.crystal.sung`, `signature.told`). Or its own flag only: a detour line sets
  `sight.<id>` with its effect. Either way it is kept as the save flag `sight.<id>`, so it stays met
  (and a save from before has what its flags already hold written down quietly, without a toast).
- **The recorder** (`recordSightings(game, { toast })`, once per story runtime in `createStory`): a
  new one says "Noted in your sketchbook's Sightings: the singing light." once. Keying the route's
  sightings on the lines as they are (person and node) means no story data had to change for them:
  Oum, Dalia and Nour in the desert, Senn and Oïa, Calix, Sedge and Saba, Robin and the saucer, Mira,
  Sol and Odile's log, Nima, Dov and Wren, Lune and Clemence, Hask and Wen, Ume and Emrys, Ferro, Kip,
  Sel and the broadcast, the hull's scorched mark (Marrow), the scar's field beating in threes (the ship).
  The page is the Sketchbook's Sightings (docs/systems/ui.md).
- **Traces** (a world's content `traces`, passed by `main.js` to `createStory`): a thing to look at
  where no person is: `{ id, at: [x, y, z], label, glyph?: { size, yaw, lift, color }, range, person }`;
  the story draws the makers' sign there if asked (`glyphGeometry`, in the glyph material) and E looks
  at it (`person`'s talk, a thing's, with no portrait).
- **The detours' traces** (`src/story/sightings-detours.js`, the lines in each world's content): one a
  world, in its own voice, hints and never answers (docs/story-bible.md, "The detours' traces").
- Tests: `tests/sightings.test.js` (every route sighting is keyed on a real line or flag; written down
  once, with a word, and kept in the save; an old save written quietly; the page), and
  `tests/detour-traces.test.js` (one trace a detour world, each set by its own line).

## Vael's stone hand: the knuckle riddle (`src/story/knuckle-riddle.js`, v1.1)

Shoot the four knuckles smallest finger to tallest: little, first (index), ring, middle (`KNUCKLE_ORDER`
[3, 0, 2, 1], from the thumb side). After the 2026-10-08 playtest found it unclear, it is readable by looking:
- the fingers are clearly graded (src/levels/arzach.js: knuckles at 8, 14, 17, 20 m up the finger) and the
  knuckle stones with them (`RIDDLE.radius` 3.5-4.7 m, every one wider than the finger's 3 m);
- one to four dots are cut on each knuckle's palm side, its place in the order (`dots`);
- a right knuckle rings its note (a rising scale) and stays lit, so the chain shows; a miss gives a dull
  knock, all four flash rust and go dark, and the chain starts again (from that knuckle if it is the first);
- the second miss: Kesh calls the order out (`KNUCKLE_LINES.call`) and the journal's step spells it
  (`KNUCKLE_HINT_STEP`, flag `arzach.hand.hint`); from the third, the next right knuckle glints.
The hand's own text and Kesh's repeat both point at the dots. `strikeKnuckle` is the pure state machine
(tests/knuckle-riddle.test.js); arzach.js draws and sounds it (tests/story-arzach.test.js).

# Minigames

Small games played apart from the journey (v0.92), eleven of them: each in its own little arena built on the
fly, or in a corner of an existing world. **Dune skiing** (`src/minigames/ski.js`), **Sky steps**, the
platformer (`src/minigames/platformer.js`), the **Canyon run** (`src/minigames/canyon.js`), **Fishing**
(`src/minigames/fishing.js`), the **Ring race** (`src/minigames/rings.js`), the **Wing drop**
(`src/minigames/wingdrop.js`), **The shooting gallery** (`src/minigames/gallery.js`) and **Ink tide**
(`src/minigames/waves.js`), both played on foot with the blade and the fluid gun, the **Drum circle**, a
rhythm game (`src/minigames/drums.js`), and the **Sketch hunt** in the Signal Market
(`src/minigames/sketchhunt.js`), and **Chime pirates**, the rail shooter in space that is also the first flight to a new
world (`src/minigames/pirates.js`, below "Pirates between worlds"). Two help a guardian instead of fighting it (v1.79,
issue #339, docs/design/helper-guardians.md): **The Elder's flight** (`src/minigames/elderflight.js`) and **Cistern
channels** (`src/minigames/cistern.js`).

## Playing one

- **The Debug menu** (Debug on the title, L in play) has a **Games** section
  (`src/world-picker.js` `gamesRow(games, state)`): each opens the game's page, `?game=<id>`, its best in the
  save beside its name (`gameBest`: a best of each difficulty shows the one chosen last).
- **In a world**, an arcade sign: `placeGameMarker(world, gameId, pos)` (`src/minigames/kit/marker.js`) stands
  a glowing post with "play …" on the interact button; it opens `?game=<id>&from=<level>`. The desert has
  Fishing's on the shore of the mineral basin (`desert-vistas.js` `BASIN`), the Canyon run's under the lavender
  cliffs by the rope bridge, the Ring race's and the Wing drop's on the shelves at the ends of the hanging
  bridge (`src/levels/desert.js`); the Signal Market the shooting gallery's on the west pavement a few steps from
  the start (`bazaar.js` `GALLERY_SIGN`, kept clear of the crowd); the Arena Ink tide's by the way in. A game
  may name its own: `markers: [{ level, at: [x, y, z], heading }]` (y `null`: on the ground), placed by `main.js`
  in that world (the drum circle's by the pilgrims' small fire in the Desert, a few steps from the child who
  sits there, whose "talk" would win the button; the sketch hunt's on the market's pavement; Dune skiing's on
  the crest of the tall golden dune north-west of the Desert's start, `[-108, null, 124]`; Sky steps' on the
  west rim of the Sky Stones' start plateau, `[-52, 40.33, -61]`: there the ground found from high up is not the
  plateau's, so its height is given). Stand at a sign and the button must say "play …" (QA: every sign checked,
  and Quit puts you back by it).
- **Hosted** (v1.65, issue #248): in a world a sign starts nothing itself. Its host stands beside it (a person of
  that place, or where nobody could stand the sign itself, read), says in a line or two what the game is in the
  place's own story, and offers it: **Play** or **Not now**. Play does what the sign's button did (the game's page,
  or a trial's start card); below, "The hosts". The Arcade's signs (a developer's plaza) still play at once.
- **The Arcade** (`?level=arcade`, a developer's world in the Debug list): a sign for every game round one plaza, to
  try them one after another (below, "The Arcade").
- A game page skips the title (`save-slots.js` `DIRECT_PARAMS` has `game`) and plays in the save slot in use.
  It writes no position to the save (`main.js` `writeSave`), so the save still resumes where you left the world.

## How it runs

`src/main.js` builds the game's level instead of a world (`kit/world.js` `levelMetaFor`): the game's own
`build(scene)` generator under its host's id (`host`, default `'arena'`: the Arena's save corner, sound and
empty story; its beacon and the parked ship are taken out of the picture), or the level named by `world`.
Once everything is built, `MinigameRunner` (`kit/runner.js`) takes the traveller and the camera over: the
frame calls `minigame.update(dt, controls)` instead of `player.update` and the camera rig. The runner owns:

| phase | what |
|---|---|
| `intro` | the start card: name, blurb, one-line rules, the controls (the pad's in Xbox / PlayStation form when a pad is in use, else the keys; redrawn when the input changes), the best so far. A / × or Enter starts, B / ○ or Esc quits |
| `count` | 3, 2, 1, GO (`kit/flow.js` `COUNT`): the session runs and draws, without input |
| `play` | the clock (`ctx.time`, with penalties); Menu / Esc (or the ❚❚ button on a touch screen) pauses: Resume, Retry, Quit. The game's pause freezes the world as the full-screen menus do (`paused()`) |
| `finishing` | `ctx.finish()` was called: the score is kept, 1.7 s to coast |
| `results` | the score, its lines, the best, a "New best!" stamp (only for beating a best kept before); Retry (R) and Quit |

While a game runs the runner takes the pad's menu buttons (`padAction`) and the keys that would open the
worlds, photo mode, the scout, the sketchbook or lock-on; the game buttons (A / ×, the triggers, the stick)
reach the game through the merged controls only while it runs. **Quit** goes back to `?level=<from>` (the
place saved as you left), or to the worlds list.

**In the engines** (the Unity build, issue #264): the same runner, made by engine/trials.js as main.js makes it; what it
draws on the page is data too, its HUD the screen's `minigame` part (`publish`) and its card `cardModel`, which the
Unity bridge draws (BridgeHud.cs, BridgeMenu.cs through engine/menus.js's card): docs/systems/engine-bridge.md, "The
trials and games". A new card or HUD piece goes into both. A game that draws a canvas or a panel of its own (the
drum circle's ring, the sketch hunt's list, the fishing's meter, the pirates' reticle) publishes it as a screen part
too and draws its canvas only where `page.drawsHud()` (engine-bridge.md, "The games' own panels"); a `pose(kind)` on
its session gives the bridge's `-pose` and the web's comparison pictures the same moment.

**Scores** (`kit/scores.js`): `score: { kind: 'time' }` (lower is better, shown `1:23.45`) or
`{ kind: 'points', unit }`; kept in the save's flags as `minigame.<id>.best` and `minigame.<id>.plays`. A time
trial not finished keeps nothing; points count even when the lives run out. `recordScore` keeps a best only
above nothing (`keepable`: a run of 0 points is counted, never kept); `isNew` (the stamp) is a real
improvement over a best kept before, the first best kept is `first` (no stamp: nothing was beaten).

**Retry** starts a new session (`start` again after the last one's `end()`): what a session made for its run
(its skis, sprays, trails, fish, a drop's thermals) must leave with it, geometry and all, or every Retry piles
up GPU buffers. `kit/dispose.js` `disposeTree(...objects)` takes them out and disposes their geometries (the
materials are the cached `makeMaterial` ones); the runner does it for whatever went through `ctx.add`, a game's
`end()` for what it put in the scene itself (a `Dots`' mesh, a `Trail`'s). `src/foes.js` `remove` lets a foe's
shapes go too (each wave of Ink tide left them), and its floor warning's own glow material (`Telegraph.dispose`,
`materials.js` `releaseMaterial`: out of the cache; the outline is one shared material): 200 foes made and let go
leave the material count flat (`tests/minigames-waves.test.js`). QA: `renderer.info.memory.geometries` stays flat over three
Retries in every game.

## The hosts (v1.65, issue #248: `src/story/hosts-data.js`, `src/minigames/kit/hosts.js`)

A sign in a world asks for its host instead of registering a button: `placeGameMarker` (unless in the Arcade, or
`host: false`) and the trials' and makers' runs' signs (`makeTrial`'s `host`) call `queueHost({ id, name, at,
heading, play, enabled, whileRiding })`. The level is built before the story, so main.js hands the queue to the story
once both are up (`takeHosts()`, `storyRt.host(spot)`): a person is spawned beside the sign (`hostStand`: 1.5 m to its
side and half a metre toward you, or the host's own `stand: { side, ahead }`; on the ground there), with the prompt
"ask Kamal about the canyon run" (a def's `prompt`, src/story/index.js `talkable`); a thing (`object: true`) is an
interactable on the sign itself ("read the makers' post"), its talk shown over the shoulder as a trace's is. Either
way the talk is `hostTalk`: the host's one or two toned lines (`say`), then **Play** (called once the panel has
closed) or **Not now**. Without a host (node's tests: `createTrials` with no `host`) the sign's button opens the card
as before. Each host talks in their own voice (v1.68, issue #280, the dialogue review v1.66's findings 1 and 9): the
first page starts in the middle of their own work (Yusra's catch, Kamal's bike, Dagny's cab fare), not in the place's
custom told in the third person, and the rules are said the way that person would say them. Their names are their own
in their world (v1.73, issue #281): Ysolt, Brother Felix, Ostra, Nadir, Ilka, Ansgar and Darro, too near Mother Ysolde,
Brother Calix, Ossa, Naji and Idris, Ilo, Anselm and Marrow, are Elva, Brother Amos, Dagny, Bilal, Aziza, Rudi and
Kamal, and the canyon race is the Two Chasms (the Rose House and Qanat's rose-stone house keep the roses; the region
is still the Rose canyons): `tests/names.test.js` fails if two people met in one world nearly share a name. Tests: `tests/hosts.test.js`
(every game, trial and makers' run in a world has one; their lines, names, no two first pages opening alike and each
one somebody talking, Play / Not now; a hosted sign has no button; where the persons stand in the desert, the market
and Vael),
`tests/trials-worlds.test.js` (each trial's host on solid ground, out of the water).

**Not before it can be had** (v1.67, issue #226's quest QC): a trial's or makers' run's spot passes its `lacks()` (the
trial's own: "It wants the hoverbike.", "Its prize is for the lantern."). While it says something, the host adds it as
a last page ("It wants the hoverbike. Come back with it.") and offers only "I'll come back with it.": no Play to be
refused a moment later by the notice. Once had, the lines and Play / Not now as before.

| game | world, where | host | what they say |
|---|---|---|---|
| Fishing | Desert, the mineral basin's shore | Yusra, who fishes the basin | Six this morning, and one had legs. Whatever lives in the giants' water, it bites my hook. / Take the rod. Three minutes on my pier. When the float goes under, strike. Snap my line and you're mending it. |
| Canyon run | Desert, under the lavender cliffs | Kamal, who races the Two Chasms | Rebuilt my bike twice this week. The canyon keeps the bits it likes. Three laps, two chasms. Fancy it? / Hit the kickers flat out, or you'll meet the chasm floor. The drifts and the banks eat your speed. |
| Ring race | Desert, the hanging bridge's east shelf | Aziza, who keeps the brass hoops | I polish those brass hoops every week, and I still don't know what the makers hung them for. Do you? / So we fly them. Twenty, in order, on race-tuned jets. Every hoop you pass tops your tank up a little. |
| Wing drop | Desert, the hanging bridge's west shelf | Zayd, who painted the mesa | I mixed the paint for the pilgrims' bird mark up on the mesa. No bird's landed on it. So we do. / Three drops. Wings open, find the warm air, ride it up, and come down soft on the middle. Soft. It chips. |
| Drum circle | Desert, the pilgrims' small fire | Hamid, who keeps the camps' drums | I stretched these skins the night the procession set out. Every night since, the old song, round the fire. / Sit with us. When a beat rolls into the ring, strike it. Keep up and the whole camp gets dancing. |
| Dune skiing | Desert, the Long Dune's crest | Tarek, who made the sand-skis | The children slide down the Long Dune on boards. Boards! So I made skis. Nobody's thanked me yet. / Between every pair of poles. Tuck to go faster, and land your spins. |
| The shooting gallery | Signal Market, the west pavement | Fitz, who calls the shooting gallery | Roll up, roll up! Fish, ink blots and bells, all painted by my own hand! One minute on the clock! / Splash all you can. A miss breaks your streak, and so does a parasol. Those are my customers. |
| Sketch hunt | Signal Market, the pavement | Vesna, who draws the market | That stall sold tea yesterday. The market changes faster than its signs, so I draw it first. / My list: six things, three minutes. Frame each one nicely, then sketch it. You can borrow my pencil. |
| Sky steps | Vael (the sky stones), the start plateau's west rim | Sister Clem, who counts the fallen-up stones | I count them each morning: the small stones that fell up with the cloud. They make a path to the makers' gate. / Step from stone to stone to the gate. A fall costs a life. Those I don't count. |
| The Elder's flight | Vael, at the foot of the Aerie's great steps | Corra, who flew with the riders | I ask her each morning. She won’t fly. Not alone. / Her wing. Your wing. Through the gates. All the way to the Old Roost. |
| Cistern channels | Desert, beside the foot of the Rose House's steps | Nuri, who digs the Givers' channels | I dig the sand out of the Givers’ channels every spring. Not one drop has come down them. / Under the house the stones turn. Turn them ahead of the water, to every trough. The Keeper’s thirsty. |
| Dune line (trial) | Desert | Bilal, who rides the dune line | Sand in your teeth yet? You will. We ride the dunes down into the basin and up out. Most of us come back. / Every gate in order, down and back up. Stay on the bike: the clock won't stop to pick you up. |
| Wind ladder (trial) | Vael | Elva, who watches the wind ladder | (whispers) Hear it? Wind, climbing in two columns. I watch them. The riders went up them once, with their birds. / Wings open in the first. Up. Then the rings, in order. The second lifts you again. |
| Stone circuit (trial) | Vael, the sky stones | Brother Amos, who keeps the riders' round | I sweep the riders' gates each morning. Nobody has flown their round since they crossed the cloud. / Take the bird round the Needles, the Table and the Monastery, every gate in order. It knows the way. |
| Reed race (trial) | Lorn, the shore by its buoy | Wil, who races the reed-cutters | Crystal's quiet, the reeds are cut, and my skiff's faster than my mother's. Race you round the makers' buoys? / Every gate in order, round the lake and back. A gust of your fan in the sail and she flies. |
| Lagoon laps (trial) | Lorn, the Deep Wood's lagoon | the race buoy (read, from the skiff) | (A keepers' bell hangs in the buoy, the lamp-mark cut under it: two laps of the lagoon, rung off from here.) / (A tally is scratched below. The newest time is forty years old.) |
| Eye garden (trial) | Viridel | Linden, who waters the sleeping eyes | I water the beds, and the eyes in them open where the water lands. Only for a moment. The white builders left them. / Wake all eight, any order, as quick as you can. A few sleep high up: climb for those. |
| Shaft climb (trial) | City-Shaft, the rim | Dagny, a courier who won't pay for cabs | A cab up to the rim? Robbery. I take the air pillar from the middle terrace. Free, and faster. / Wings open, into the pillar, up through every ring. Steer out of its top and glide the rim for the last. |
| Glass slalom (trial) | Glass Dunes | Opal, a glassworker who flies the waves | Kiln's banked, so I'm flying. The slalom runs between the glass waves. They've never fallen on anyone. / Ride the first column up, then the rings in order. Sinking? Find the next column. Then home down the valley. |
| Canyon dive (trial) | Buried Machine | Tibor, who dives the canyon on Tooth Day | Tooth Day. Wings on, and down the canyon for luck. My father did it every year. Once with a goat. / Through every gate to the bottom, then ride the column up and out. Don't stop to look at the pipes. |
| Garden round (trial) | Garden of Spheres | Aurel, who walks the round of the spheres | Hush. This one remembers rain. I walk the round each day, so someone remembers with them. / Gate to gate, round the garden and back. Climb, jump, glide. The spheres don't hurry, but the clock does. |
| Tube run (trial) | Underwater City | Gil, who races the sealed tubes | Lamps trimmed, so we race the tubes. We wait till the whales are quiet. Lately that's every night. / Every ring, hall to hall through the glass. Take the bends tight, and don't miss one. |
| Floor round (trial) | Moon Foundry | Rudi, who ran the pour times | Forty years I ran the pour times round this floor. The house pours by itself now. My legs still go round. / Every gate in order, round the floor and back to the mouth, before the pour cools. I always made it. |
| Courier's round (trial) | City Floating in Space | Pia, who runs the oil bills | Oil bills, island to island, every evening. Late oil, dark lamps, cross customers. So I run. / Every ring in order over the bridges. Mind your feet: step off, and the dark is a long way down. |
| The Sunken Hall (fight temple) | Desert, the doorway west of the pilgrims' camps | Wafa, who keeps watch on the sunken hall | Third night I've sat on this step. The ink pools down there, and the blots breed in it. Every dusk, more. / Four rooms, and a lot of them. Small ones: one cut or two. Clear them, and what the makers left on the altar is yours. |
| The Pour Floor (fight temple) | Moon Foundry, just south of the workers' quarter | Marta, who tapped the crucibles | The house still pours under our floor. Nobody taps it now, and things come down to stand in the heat. / Four bays. When a channel's rim goes bright, step off it. The great crucible's altar is at the end. |
| The Drowned Mill (fight temple) | Lorn, the dry hillside south-east of the landing | Gert, who ground the reed-cutters' meal | I ground the reed-cutters' meal in that mill. Now it's flooded, and the stones roll with nobody at the gear. / Four rooms, ankle-deep and crawling. Where the floor goes rust, a stone's coming. The miller's altar is at the back. |
| The Wind Cloister (fight temple) | Vael, on the rose cliff north-east of the riders' monastery | Sister Maud, who sweeps the riders' cloister | My cloister. The wind comes through it, and now it brings them in. / Four courts. Many, small. Where the floor shows the wind, let it take them. The altar, after. |
| The Seed Vault (fight temple) | Viridel, the plateau west-south-west of the Builders' Greenhouse | Hollis, who keeps the seed cellars | I kept the seed cellars dry for twenty years. Now the eyes in the beds wake on their own. / Four rooms. When a bed's eyes open, get off it, and bring the moths onto it. The seed safe's altar is at the end. |
| The Lift Depot (fight temple) | City-Shaft, the middle terrace by its cab stop | Ulric, who drove the depot's cranes | I drove those cranes till the depot shut. They still drop loads, and nobody's at the levers. / Four bays. A ring on the deck means a load is coming down: step out of it. The dispatch floor's altar is at the end. |
| The Tooth Gallery (fight temple) | Buried Machine, east of the domes | Greta, who greased the gear-house rails | I greased those rails every morning, and the carts still run them. Empty, flat out, all day. / Four rooms. When a rail's lamp blinks, get off it and leave the crawlers on it. The tooth hall's altar is at the end. |
| The Back Rooms (fight temple) | Signal Market, the back alley west of the sign-hanger's ladder | Lettie, who locks up the back rooms | I lock the back rooms every night. Tonight the signs in there are ringing with the bell, and the rooms are full. / Four rooms. When a sign lights, the ring comes off it: roll through it. The counting house's altar is at the end. |
| The Flooded Gallery (fight temple) | Underwater City, the Dock hall | Sabine, who trims the gallery lamps | I trimmed the gallery lamps every night. Now they gutter, and the dark comes in under the glass. / Four halls. When the lamps flicker, get under one before they go out. The whale-watch altar is at the end. |
| The Kiln Yard (fight temple) | Glass Dunes, by the north camp's awnings | Ozren, who banked the kilns | I banked those kilns for thirty years. The sheds are full now, and the glass floor cracks under them. / Four sheds. When the tile under you goes white, get off it. The great kiln's altar is at the end. |
| The Quiet Orchard (fight temple) | Garden of Spheres, west of the round plaza | Wenna, who tends the walled gardens | My gardens are full of hounds. They run in the spheres' shade at dusk. / Four gardens. Keep to the light: in the shade they bite and you can't see them. The round garden's altar is at the end. |
| The Oil Exchange (fight temple) | City Floating in Space, the Towers' deck | Osric, who weighed the oil | I weighed the lamp oil at that depot till the drums started leaking. One spark and the deck burns. / Four decks. When oil spreads under you, get off it before it lights. The clearing house altar is at the end. |
| Avenue run (trial) | Signal Market | Quill, who hangs the signs | Hung thirty signs today and every one's crooked! Market night: we fly the avenue under the lot! / Ride the column at the avenue's head, then the rings in order. Halfway there's another column. Use it. |
| the makers' runs (16) | each in its world (docs/systems/challenges.md) | the makers' post, read | (Under the makers' mark:) what the run is in the house it was stood out from (the wind kept in a hall, the Hush over the causeway, the Belfry's fallen-up bridges…) / what to do, in one line |

The Arena's Ink tide and the Arcade's signs are a developer's and keep their buttons; Chime pirates is the flight
between worlds, not a sign.

## The Arcade

A developer's plaza for trying the games (`src/levels/arcade.js`, `?level=arcade`, `dev: true`, next to the Gadget
Yard in the Debug worlds list). A round paved court inside a ring of mushroom-capped pillars, a glowing basin and
a hooped spire in the middle.

- **The signs**: `kit/arcade.js` `arcadeSigns(GAMES)` puts one per game of the registry on a ring 14 m out, over
  270° from the south-west round the north to the south-east (the way in is the south), each facing the middle;
  a new game file gets its sign by itself. `placeGameMarker(…, { plate })` hangs a name plate on the post (the
  game's name and its best, `bestText`: drawn on a canvas when the level is built, so a new best shows on coming
  back). The interact button at a sign opens `?game=<id>&from=arcade`.
- **Coming back**: started from the Arcade, Quit is **Back to the Arcade**, `?level=arcade&back=<id>`
  (`arcadeHref`); the level puts the traveller at that sign's `stand`, facing it, and says `keepSpawn` so
  `main.js` does not move him to the place saved as he left.
- **The games board** (`src/levels/arcade-board.js` `ArcadeBoard`, the level's `quickMenu` as the References' list
  of views: `main.js` routes the pad to it and keeps the game still while it is open): every game, its line and its
  best; choose one to open it. Opened from the board by the way in (interact), **Tab**, **D-pad ↓** (the mount's
  call: there is no mount here), or the small "games" button (touch, mouse); B / ○ or Esc closes.
- **Next and previous**: `main.js` gives the runner `links: arcadeLinks(from, id)` (null unless `from=arcade`).
  The runner's `host.links` is generic: `{ quit: { label, href }, extra: [{ id, label, sub, href, step }] }`;
  the extra links are buttons on the start card, the pause card and the results (before Quit, under its label),
  and a link with a `step` is also **[ / ]** and **LB / RB** on any card. The Arcade's are Previous game and Next
  game (the games' order, round: `cycleGame`), each with the game's name under it.
- Tests: `tests/arcade.test.js` (a sign for every game file there is, facing the middle and in reach of its stand;
  the plaza built in node with its signs' interactables and the board; the way there and back; next and previous
  round all ten and back).

## How to add a game

One new file, `src/minigames/<id>.js`; the registry (`src/minigames/index.js`) finds it through Vite's glob, so
nothing else needs editing. (Restart a dev server started with `watch: null` to see a new file.) Its default
export:

```js
export default {
  id: 'kite', order: 3,                 // lower-case-with-dashes; order in the Games row
  name: 'Kite race', blurb: 'One line for the list and the card.',
  rules: 'One or two sentences: how to win, what costs you.',
  controls: { pad: [['Left stick', 'steer'], ['A / ×', 'flap']], keys: [['A  D', 'steer'], ['Space', 'flap']], touch: [...] },
  score: { kind: 'time' },              // or { kind: 'points', unit: 'pts' }, or { …, format: (v) => text }
  hud: { timer: true, score: false },   // what the HUD shows (default: by the score's kind)
  color: '#71d7cf',                     // the arcade sign's glow
  build: function* (scene) { …; return arenaLevel({ ground, spawn, name, hour, … }); },   // its own arena
  // or: world: 'desert' (an existing level; put the traveller where you want in start)
  start(ctx) { …; return { update(dt, input, { live, phase, t, raw }) {}, pause(on) {}, end() {} }; },
  // optional:
  options: [{ id: 'level', label: 'Difficulty', choices: [['easy', 'Easy'], ['hard', 'Hard']], default: 'easy' },
            { id: 'offset', label: 'Timing', min: -200, max: 200, step: 10, unit: 'ms', default: 0, hint: '…' }],
  bestBy: 'level',                      // a best for each value of that option (minigame.<id>.<value>.best)
  drives: false,                        // played on foot: the usual walking and camera, the game's update after them
  markers: [{ level: 'desert', at: [x, null, z], heading }],   // its arcade signs in the worlds
};
```

- `build` is a level builder like the worlds' (`yield` between big steps); `arenaLevel()` (`kit/world.js`)
  fills in everything a level needs (the desert's print sky, no reactions, the ship far away). Mark meshes
  that need no collision `userData.noCollide`.
- `start(ctx)` begins a run (and again on every Retry, after the last run's `end()`): put the traveller and the
  camera where they start and return the session. `ctx` has `scene`, `camera`, `player`, `physics`, `level`,
  `sound`, `wind`, `sfx` (`kit/sfx.js`: tick, coin, gate, miss, jump, spring, land, crumble, checkpoint, hurt,
  finish, lose), `time`, `addTime(s)`, `score`, `setScore`, `addScore`, `setLives(n, max)`, `status(text)` (the
  `setFov(f)`, `speed(k)` (ink streaks at the screen's edges), `add(object)` (taken out on Quit), `best()`,
  `state` (the save: `flag(name)` / `set(name, value)`, for what a game keeps besides its best).
- An arena is `peaceful` (`arenaLevel`): no ink blots come out of the sand in a game (`src/foes.js`).
  right-hand box), `flash(text, 'good' | 'bad' | 'big')`, `finish({ score, failed, title, lines, html, wide })`
  (`html`: a block of the game's own on the results, `wide` a wider card: the sketch hunt's page), `kick(k)`,
  `setFov(f)`, `speed(k)` (ink streaks at the screen's edges), `add(object)` (taken out on Quit), `best()`,
  `option(id)` (the start card's choice), and the world's own: `rig` (the camera rig), `capture(eye, look, w, h,
  { fov })` (a frame drawn from another viewpoint, a JPEG data URL: main.js `captureView`), `npcs`, `crowd`,
  `wildlife`, `flora`, and `people` (`{ lib, humans }`: what a game's own `NPC`s are made of).
- **Options** (`def.options`, `kit/flow.js`): rows of choices or a stepper on the start card, kept in the save's
  flags (`minigame.<id>.opt.<option>`); changing one starts the session again with it. `bestBy` keeps a best of
  each value. `hud.countdown: s` shows the time left of `s` seconds in the clock's box instead of the time taken.
- `update`'s third argument has `raw`, the merged controls (a game reading buttons of its own: the drum
  circle's four face buttons, `PadJump` / `PadE` / `PadEvade` / `PadGadget`); `pause(on)` is called when the
  pause card opens and closes (the drum circle stops its song and picks it up again). A game on foot may rewrite the
  controls before the traveller and the gadget in hand read them: `input(controls)`, called in play each frame from
  main.js through `MinigameRunner.filterInput` (none does now: the fight temples' jump turned into a roll until the
  author kept the jump, after #365).
- `update(dt, input)`: `input` is `kit/input.js` `readInput`: `x`, `y`, `jump` / `jumpPressed` / `jumpReleased`,
  `action` / `actionPressed`, `tuck` (RT / R2 or Shift: where they mean the same), `trigger` (RT / R2 alone),
  `boost` (Shift, RB / R1, L3 on a pad, the touch screen's run toggle: the Ring race's boost), `brake` (LT / L2,
  the stick pulled back).
- **A touch screen** (`def.touchButtons`, `kit/flow.js` `touchButtons`): the on-screen buttons a game keeps
  (`'jump'`, `'run'`, `'aim'`, `'fire'`, `'blade'`, `'guard'`, `'evade'`, `'lock'`, `'mode'`, `'use'`, `'ping'`,
  `'book'`; src/ui.js `TouchControls`), the others hidden while it runs; default jump and run for a game that
  drives, all of them on foot; `[]` none (the drum circle's sockets are tapped). They are hidden while a card is
  up, and on a short screen (a phone held sideways, under 560 px) the card is compact, its buttons always in
  sight. `controls.touch` names them by their glyphs (⤒, run, ◎, ✺, ⚔, ◇, ↶, ◉). It is
  `NO_INPUT` until GO and after the finish. Move the traveller yourself: set `player.pos`, `vel`, `heading`,
  `onGround` and call `player.finishFrame(dt, speed)` for the clips (the platformer), or pose the rig
  (`player.char`) and call `player.humanoid.update()` (the skier).
- **Gear for the run** (`kit/gear.js` `lendItems(ids)`): the registry (`src/items.js`) answers yes for the
  lent items until the returned function is called (the session's `end()`), so the fluid tool draws the tank,
  the jets' nozzles or the wings on the back; nothing is written to the save. Set the traveller's own flight
  state for the pose and the sound (`player.jetFlight`, `thrusting`, `jetPower`; `gliding`, `glideTurn`) and
  call `player.finishFrame(dt, speed)`.
- **On foot** (`drives: false`): the usual play runs (walking, the blade, the guard, the evade, the fluid gun,
  the lock-on on R3 / Tab) and the session's `update` comes after the camera; `ctx` also has `tool`, `foes`,
  `rig`, `settings`, `state`. `body.mg-onfoot` keeps the crosshair. `kit/onfoot.js`: `lendTool(tool, { max,
  delay, mode })` lends the backpack for the game (worn and full even on a save that has not found it; its tank's
  size held against the save's upgrades; `back.set({ max, delay })` for a boon; `back()` puts it all back),
  `tune(table, changes)` changes a tuning table (BLADE, EVADE…) for the game, `standAt(player, pos, heading, rig,
  yaw)`. `kit/labels.js` `WorldLabels`: a "+20" floating up from a point, a speech balloon, a label over a thing (the same words the screen's `words` part, for an engine to draw).
  `hud.countdown: s` shows the clock counting down. A game's page tells no story (its host's goal is not reached).
- Keep the rules pure where you can (a step function on plain objects) and test them in
  `tests/minigames.test.js`; play the game in headless Chrome through a virtual pad (override
  `navigator.getGamepads`; setting `window.input.stick` every frame does not work: main.js latches taps).

## Dune skiing (`ski.js`)

A kilometre of dune (`courseHeight`: a valley wandering down the fall line, rollers, four lips at the ends of
the steep pitches, dunes beyond; a 1400 m terrain at 2.5 m cells, whose exact mesh height is the ground). The
skier is `skiStep`: gravity along the slope, the edges killing the sideways slide and turning most of it into
speed (`SKI.keep`: a carve keeps its momentum; a skid on LT / L2 does not), drag cut by the tuck (about
75 km/h standing, 105 tucked on the average slope), take-off when the ground falls away faster than a body
thrown along it, a pop on A / ×, spins with the stick in the air, landings clean within ~52° (a spin landed
clean takes a second off) or sloppy (most of the speed lost). Seventeen gates on alternate sides
(`courseGates`; a miss +3 s), pennants turned teal as passed. Sand sprays off the edges (the fluid tool's
`Dots`), the field of view widens with the speed, and past the line the camera swings round to the front.

## Sky steps (`platformer.js`)

A course of stones in a plane (z = 0), seen from the side with a long lens (36°). The course is data
(`COURSE`: blocks, one-way slabs, drifting stones, crumbling stones, springs, 40 glyph coins, three banners,
the gate) and its world is pure (`PlatWorld`); the body is `platStep` (`PLAT`): run 8.6 m/s, a 2.9 m jump cut
to half its rise when the button is let go, more gravity on the way down, coyote time 0.11 s, a 0.13 s jump
buffer, carried by drifting stones, thrown by springs (higher with the button held). A fall below the course
costs a life and starts you at the last banner; out of lives ends the run with the glyphs' points. At the gate:
10 a glyph, 50 a life left, and (60 − seconds) × 6. The feet stand on the stones through a ground of the
course's own (`player._feetGround`). `botInput` plays the course; the tests run it at 120, 60, 30 and 20 fps
and require the gate with no fall.

## Canyon run (`canyon.js`)

The hoverbike (`src/bike.js` `buildBike`, the desert's own model; the rider posed as `animateRiding` does) round
the Two Chasms, three laps. The canyon is one closed loop (`makeTrack`: a ring of 172 m wobbled by three sines,
1024 samples, about 1.24 km round) and `nearest(track, x, z)` gives any place's `s` along it and `d` across it
(> 0 outward). On it `profileHeight(K, s, d)`: a floor 20–32 m wide that rises and falls, a sand bank 4.5 m wide,
then cliffs 7 m out to a plateau 20–35 m up; two chasms right across (13 and 15 m) each after a wooden kicker
3.4 m high; four sand drifts covering 55–60 % of the floor from one wall (a sand fence on each crest). The ground
is a 720 m terrain at 2 m cells whose cliffs stand 4 m further out (`shift`) behind banded strata faces built
on the loop, so the coarse triangles never poke through; natural arches span the canyon, hoodoos line the rims.

The bike is `bikeStep` (`BIKE`): the desert bike's throttle, steering, drift and hover spring on that height,
a hop on A / × that flies free of the spring (12 m/s: it clears a drift), the bank's sand dragging harder the
higher you ride up it, the cliff's foot throwing you back (the speed × 0.55), a drift bogging you down (× 0.5),
a boost pad (four, pale plates with three ink chevrons) flinging you to 46 m/s with a 52 m/s top for 1.6 s, and
a fall into a chasm (`fell`: back at the last checkpoint, +2 s). Its own motor sound (a sawtooth through a
low-pass, by the speed), the jets' fluid trails (`src/trail.js`), sand thrown off the banks and the drifts.

The race is `raceStep`: five splits a lap (the fifth is the line) from the unwrapped progress, in order, so no
shortcut counts; each split is flashed against the best run's (`minigame.canyon.splits`, kept when a run beats
it) and each lap against the best lap (`minigame.canyon.lap`). `botInput` drives it (the middle, onto the pads,
round the drifts): the tests run it three laps at 120, 60, 30 and 20 fps (about 1:42, no wall, no fall).
`window.__canyonBot = true` lets it drive the page (the screenshots).

## Fishing (`fishing.js`)

Three minutes at the end of a pier over the Still Oasis: a 300 m arena of dunes round a pond 27 m across
(`oasisHeight`, its bed 4.6 m deep in the middle), drawn by the water's own look (`src/water.js` finds the mesh:
the bed's bands, the foam at the shore and round the pier's posts, the rings), palms, reeds, lily pads, two
leaning monoliths and a stone ring across the water. The traveller sits on the pier's end, legs over the water;
the rod is six segments from the hand that bend toward the fish, the line twelve that sag when it is slack.

- **Cast**: hold A / × (Space) and the meter swings up and down (`castPower`, 1.3 s a sweep); let go and the
  float flies `castDistance` = 4–22 m where the stick aims (±0.6 rad), a ring on the water showing where.
- **The bite**: the pond's fish are printed shadows that wander their zones (shallow, mid, deep). One within
  8.5 m of the float comes to it; it nibbles (`biteSchedule`: its kind's count, the float dips, small rings),
  then takes the bait (the float goes under). Strike in its kind's window (0.34–0.6 s, `hookResult`); too soon
  and it takes fright, too late and the bait is gone. A / × while waiting reels in.
- **The fight** (`fightStep`, `FIGHT`): the fish rests and runs, each run one way or the other (its `turns`),
  some leap (the line jerks unless you give slack). RT / R2 reels; the tension rises with the reel and the fish's
  pull and falls with the stick held against the run (which also tires it and gives less line). Over 0.8 the
  line glows red and strains (a second of full red snaps it); a slack line for 2.2 s lets it slip the hook; 40 m
  out it is gone. In at 1.3 m: landed.
- **Eight kinds** (`SPECIES`): glass minnow, lantern carp, ribbon eel, whistling perch, bishop fish, sky-eye ray,
  shellback, and the Old Hermit (rare, 11–16 kg, a little house on its back), each its own model, weights
  (`rollWeight`, the heavy rarer), pull, speed, stamina, rests, runs, nibbles and strike window; the deep holds
  the heavy ones (`pickSpecies`).
- **Score** the weight landed (`score.format`: `4.3 kg`); a fight under way when the time runs out is finished.
  **The journal** (`recordCatch`, `minigame.fishing.journal`: `{ id: { n, best } }`) is drawn in the corner,
  each kind's heaviest; the catch is held up on the line with a card ("new in the journal").
- `botFight` plays a fight well (reels when easy, eases off at 0.66, holds against the runs): the tests land
  every kind with it, snap the heavy ones reeling flat out and lose them all left slack. `window.__fishBot = true`
  lets it fight in the page.
## Ring race (`rings.js`)

The Needle Field: a sand floor (`fieldHeight`), about a hundred sandstone needles (tapered columns of beds,
some with a hoodoo's cap, `courseField`: seeded, a pair flanking nine of the rings, the rest anywhere clear of
the flight line by 14 m), seven floating rocks round the high part, a start mesa with a pad. Twenty rings
(`RING_POINTS`, hand-placed: a slalom down the field, a climb to 110 m, a dive to 30, the long way home; 50 to
110 m apart, about 1.6 km), each `{ c, n, R: 6.5 }` facing along the line. The flyer is the jets' own model
(`flyStep`: `jetSteer`, `jetNose`, `jetStep`, `jetDroop` from `src/player.js`, `boost` on all the way: the
race-tuned jets fly at 31 m/s), lifting off the pad on the first squeeze. The tank burns `RACE.burn` (0.09) a
second at full throttle (about 11 s), each ring gives back `RACE.topUp` (0.28); dry, you glide.
`raceStep`: the rings in order; the next one passed or missed (`crossRing`: through its plane within R, or
within 6 R outside it), or one of the two after it went through (those between are missed: +5 s each).
`hitAt`: the sand, a needle or a rock with the body's 0.7 m reach is a crash: +3 s, again from the last
ring passed, flying on its way, the tank at least 0.4 full. The boost (`boost`: Shift, RB / R1, run on a touch
screen) flies at `RACE.surge` (1.28) of the jets' speed for `RACE.surgeBurn` (2.1) the burn: 31 m/s to 40, the
tank in about 5 s instead of 11 (under thrust `jetStep` is linear in the velocity: the surge flies it scaled).
Boosting on the straights with a quarter of the tank kept back is worth about 4 s on the ~54 s course (the tests'
pilot: 50.0 s against 53.9, never dry); boosting every straight to the last drop runs dry and glides for ~4.5 s,
losing most of that; boosting all the way runs dry and comes down. The camera chases behind the nose (tipped with it,
rolled a third of the bank); the arrow hangs at the top of the view (4.2 m ahead of the camera) pointing at
the next ring. **The ghost**: the run's track every 0.1 s and its ring splits, kept on this device
(`localStorage` `hiraeth.minigame.rings.ghost`, `packGhost`: ~8 KB) when it beats the ghost or the best; the
next runs fly it beside you (`ghostAt`) and flash the split at each ring. `botInput` flies the course; the tests
run it at 120, 60 and 30 fps and require every ring, no crash, about 55 s.

## Wing drop (`wingdrop.js`)

The Painted Mesa (`MESA`: r 36 m, its top at 62 m) with a bullseye painted on it (`TARGET.bands`: 1.6, 6, 11,
17, 24 m), smaller mesas and needles round it. Three drops a round (`dropPlan(i, seed)`, a new seed each
round): a start 280–370 m out and 130–160 m over the top, a wind of 1.5 m/s on the first growing to 5 on the
last (which blows mostly against you), three thermals between (r 15–21 m, lift 5–7 m/s, up to 230 m over the
top) and three star gates (one high in the first thermal, one off the line, one on the final approach).
The glider (`glideStep`, `WING`): a free fall to 44 m/s until A / × opens the wings (by themselves at 45 m
over the ground: −50 style); then an airspeed the stick asks for (12 neutral, 21 full forward, 4.5 full back),
a sink least at 11.5 m/s (2.4 m/s: a glide of about 5 to 1) and growing with the square away from it,
the thermals' lift (`thermalLift`: strongest in the middle, nothing past the edge or over the top), the wind
carrying you. The flare: the stick back within 4 m of the ground (fading out by 10 m) holds the sink off while
the speed lasts, so pulled in the last metre or two you touch down at ~1.5 m/s; too early and you are slow
and sinking again by the time you land. Flown into the mesa's side under its rim, the wings fold and you fall.
Landed, the camera is `landingShot` (`LANDING_SHOT`): up and back on the far side of you from the target's
middle, looking down over you at the bullseye; on the last drop the look is moved aside so you stand in the
left third, clear of the results card. While the camera is inside a thermal its swirls are left out (a stroke a
metre off the lens is a wedge across the view) and more motes rise round you instead. The star gates are
R 5.2 m; `starPilot` (a pilot for one or every star: climbs in the thermal under the high one, swings out and
comes back through along the gate's way, S-turns off height) shows each star of each drop can be flown through
(`tests/wingdrop-stars.test.js`), and threads the high star in the page through the virtual pad.
`scoreLanding`: aim `500 × (1 − d / 24)^1.2` on the target (+100 in the bull; 25 on the mesa off it), style 200
for a landing soft (`vy` 1.5 m/s or less) and slow (5 m/s or less across), a tumble (`vy` > 7) no style and half
the aim, 100 a star. The swirls are dashed ink helices round each column, turned at the lift's rate so they
seem to rise, drawn as pale hairlines while the camera is inside one. `botInput` (opens at once, glides at the
target, circles off height it has too much of, flares at 1.4 m) lands every drop of three seeds on the mesa,
gently, at 60 and 30 fps.
## The shooting gallery (`gallery.js`)

A fairground stall of the Signal Market (its paving, its plaster, its striped valance, a lit sign, shopfronts
round it), built as its own little level; the afternoon sun comes from over the shoulder into the booth
(`lightAt`). The traveller stands behind the counter (`STAND`, held there) with the stall's tank lent: six shots,
full again a second after the last (`GALLERY.tank`). Painted cutouts (`cutout`: fish and birds with bullseyes,
ink-blot figures, and the friends: Auntie Lumé under her parasol, a cat) slide along two brass rails or flip up
behind a low fence; four plates spin on sticks (they shatter and come back), two bells swing from the beam on long cords (`BELLS`: down at ~4.3 m, in the view
over the rails)
(`swing`). `GalleryDirector` says what comes out when over the minute (`galleryPlan`: busier toward the end, the
last 15 s with golds every 4 s and faster rails). Scoring is `scoreHit`: rail 10, fast rail 15, pop-up 25,
plate 20, bell 30, gold 100, friend −50; the multiplier (`comboMult`) goes up a step every three hits in a row
to ×5, and a miss ends the run. A shot is a miss when no target takes it within 1.5 s (`ShotLedger`, from the
tool's `tool:fire`). The stallkeeper, a round barker in a boater with a speaking-trumpet, calls out
(`KEEPER_LINES`, every line toned) in the market's patter (`planLine`, lang `bazaar`), in a balloon. A bot in
headless Chrome (hold LT, turn the rig toward the next target with a lead, pulse RT) scores about 1,500.

## The Elder's flight (`elderflight.js`, the rules in `formation.js`)

Helping Vael's Elder instead of fighting her (issue #339): she flies, out of the Aerie and across the sea of cloud to
the riders' Old Roost, as long as you fly at her wing. Its own arena: the open sky, the sky stones' tables and needles
(`sky-stones-kit.js`, Vael's look `SKY_STONES_LOOK` and sky), the cloud sea 90 m under the route, the Aerie's crown at
the start, the Old Roost (a great table ringed with stone feathers) at the end.

- **The route** (`makeRoute`, `ROUTE_POINTS`): a centripetal Catmull-Rom curve, 2.3 km, sampled every metre (pos, its
  level way along, its turn rate); she flies it at 17 m/s (slower climbing), at 11.5 while you are more than 16 m from
  your slot (`herStep`: she waits), banked into its turns a little ahead of them.
- **Your wings** (`wingStep`): the stick banks and turns, forward dives, back climbs; A / × held beats (+6 m/s²),
  LT / L2 (Shift, the right mouse) spreads wide (−7); alone the speed settles to 15 m/s and you sink 1.3 m/s. **Her
  wake** (`wakeAt`: 5–19 m out to either side, up to 22 m back, within 6 m of her height) holds the sink off and draws
  you to her pace: in it you fly with her for nothing.
- **The slot** (`slotAt`): 12 m out on her `side`, 5 m back, a ring of light (teal while you hold it). Within 5 m:
  10 points a second × the multiplier, which climbs a step every 3 s held (×5 at most) and falls to ×1 a second after
  you leave. Her courage comes back there (0.05 a second).
- **The gates** (`R.gates`, `GATE_SIDES`): thirteen between 150 m in and 160 m from the end, each her ring (R 8.5) on the
  route and yours (r 4.6) 12 m out on the side she wants you, hung from a beam between two rose needles 23 m either side.
  Through yours (`crossGate`): 100 × the multiplier, +50 "Together!" within 0.8 s of her. Missed, or 45 m behind her
  without you: −0.18 courage, the multiplier lost. After a gate whose next is on the other side she cries and calls it
  (`call`), dipping that wing.
- **Gusts** (`GUSTS`): three stretches where a crosswind of 6–7 m/s blows across her line (streaks round you); she
  holds her line, you crab into it.
- **Courage**: falls 0.075 a second while you are more than 28 m from her, with a gate missed, a stone hit (−0.15: you
  bounce off it slowed, `hitAt` on the stones as columns, `skyStones`) or a fall into the cloud (−0.2: back at her wing);
  out of it she turns back (the points kept). At the Old Roost: +300 and her courage × 500; she sets down on her own legs,
  you beside her, and the camera comes round in front of her (the pair in the left of the picture, clear of the card).
- **The camera**: a formation shot 23 m behind you and 4 m toward her, 7 m up, looking past you along her way, rolled a
  quarter of her bank; a passed gate is hidden as the camera nears it (its ring would fill the lens).
- `botInput` (the tests', the pictures': `window.__elderBot = true`) holds the slot, crosses to each called side and crabs
  into the gusts: every gate, all together, about 2 min 15 s, at 60 and 30 fps (`tests/minigames-helpers.test.js`).
- Unity (engine/trials.js): card, 3-2-1, run, pause and resume draw. Her wake's motes are placed from her frame on the
  route, not from her bones (`E.part`): placed from her bones they blacked out the bridge's whole frame. Cistern channels
  plays there as it is; the floating score words of both (kit/labels.js) are drawn there from the screen's `words`
  (docs/systems/engine-bridge.md, "The words in the world and the speed lines").

## Cistern channels (`cistern.js`, the rules in `channels.js`)

Helping the Keeper of the cistern instead of fighting it (issue #339): the Givers' sunken cistern court under the Rose
House, a floor of channel stones eight by six (6.5 m each) round a rim walk, the spout a carved muzzle high in the north
wall, the troughs in the rim. Seen from high over the court's south end (52 m up, 32 m back, a 44° lens), the whole
board in view, easing a little after you.

- **The stones** (`makeBoard`): straights, bends, tees, crosses and a few broken ones. The board is made with a way to
  every trough first (a tree from the spout: each trough's shortest way by random weights to what is built, never through
  a stone with three ways already), the rest random, then every stone that turns is turned at random (the spout's never
  left open to it). `B.way` and `B.depth` keep the way and the order the water reaches it.
- **You** walk the stones (the stick, on the screen's axes; the troughs and the Keeper in your way); A / × (Space) turns
  the stone under you a quarter clockwise, X / □ (E) back (`turnStone`: not a broken one, one the water is in, or one the
  Keeper stands on: "It’s lying on that one."). The stone under you is framed, gold if it turns, red if not.
- **The water** (`newFlow`, `flowStep`): the spout opens after 12 s (9 on Hard; 3 s less after the first flood), then it
  fills a stone in 3 s, each a little quicker (× 0.965) down to 1.6 s (Hard 2.2 to 1.1), drawn running in along its
  channel from the edge it came in by and out along its exits. A tee splits it; a cross takes it straight through
  (filled both ways: +100). Into a stone that does not open to it, or into the wall, it spills (a puddle, "spilled") and
  that stream ends; red arrows warn where a running stream is about to spill. RT / R2 (Shift) held hurries it, the wait
  too, three times as fast; the stones filled while it hurries count double.
- **Three floods** (`ROUNDS`, `round`): two troughs (west and east), three, four, the water quicker each time (× 0.88,
  × 0.78). A flood ends when its last stream has run out; then a new board. 10 a stone, 250 a trough (the Keeper goes to
  drink there, a brazier lights), 500 when a flood reaches all its troughs (`scoreOf`).
- **The Keeper** (the shipped model at 0.55 of its size, `keeperModel`, posed by hand): it wanders the court, curious
  about the water, a stone at a time, rests, and goes to drink at each trough that fills; its glyphs brighten.
- Easy and Hard keep their own bests (`bestBy: 'level'`). `botMove` (the tests', `window.__cisternBot = true` for the
  pictures) turns the way's stones in the order the water reaches them.

## Fight temples (`fight-<world>.js`, `src/fight-temples/`)

A Diablo-like temple in each world (issue #341; the design and the template: `docs/design/fight-temples.md`), one
built: the desert's **Sunken Hall** (`fight-desert.js`, its table `src/fight-temples/desert.js`). Played on foot
(`drives: false`) under a fixed isometric camera the session puts on its line after the rig every frame (the rig's
yaw held on it, so the stick walks him on the screen's axes; 57° down, 28 m, a 31° lens, as Diablo IV's: issue #365);
walls and pillars between the camera and him are seen through, a hole cut round him (`makeMaterial({ seeThrough })`).
B / ○ (Alt, the touch ↶) rolls there (`ROLL`, the evade made a roll; jumping is off: 535f87f9a) and the cut takes every
foe a drawn crescent covers (`WIDE_CUT`, below). Four rooms, two or three waves each of the desert's kinds made light (a cut or two, half the harm), up to
24 heads standing, out of the ink springs; a room cleared, its gate (a mover) sinks; the last wave brings a lamp
tripod and two whole herons, then the reliquary on the altar wins the Ember colours (`src/kit-colours.js`, items.md
"The kit's colours"). Hearts and chimes drop (`ctx.drop`: the runner's host passes the world's chime field). The
right stick or the mouse's ring aims; the blade and the gun take the foe in that cone (`FluidTool.lockOn` and
`updateAimPoint` wrapped for the run); RT / R2 alone a quick shot. Its sign is its own doorway (`marker.model`, solid:
`kit/marker.js`), its host Wafa. Score: the time to clear (a run lost keeps none). Tests: `tests/fight-temples.test.js`, `tests/fight-roll.test.js`, `tests/fight-temples-worlds.test.js`. Since v1.80 Vael's **Wind Cloister** too (`fight-arzach.js`), its gusts on lanes (`src/fight-temples/hazards.js`). Lorn's **Drowned Mill** (`fight-perdide.js`), its millstones. The Moon Foundry's **Pour Floor** (`fight-moonfoundry.js`), its pour. Each world's hazard, look and table: the design doc, "The hazards, the looks". Since v1.81 Viridel's **Seed Vault** (`fight-edena.js`, its bloom), the City-Shaft's **Lift Depot** (`fight-incal.js`, its loads), the Buried Machine's **Tooth Gallery** (`fight-buried.js`, its carts) and the Signal Market's **Back Rooms** (`fight-bazaar.js`, its toll). The Underwater City's **Flooded Gallery** (`fight-underwater.js`, its dark). The Glass Dunes' **Kiln Yard** (`fight-glassdunes.js`, its cracking floor). The Garden of Spheres' **Quiet Orchard** (`fight-spheres.js`, its shade). The City Floating in Space's **Oil Exchange** (`fight-spacecity.js`, its burning oil).

### The Sunken Hall as a game (issue #368)

The author: the hall should be a better game, and the bigger swing of v1.77 couldn't be seen (and felt too big).
Played through by a scripted player in headless Chrome (the scratchpad's `play.mjs`: walk to the next room, close on
the nearest foe, cut; with and without stepping out of the geysers) and judged as an action-RPG arena. What v1.77
had: nine waves of a pile of light foes each, the cut taking everything 3.9 m out with nothing drawn, no warning where
foes would come from, the toughest wave only at the very end, and a results card of counts. A mashing player cleared
it in about 100 s and a tripod could be left stuck outside the sanctum's wall, the run never ending. What changed:

- **The cut is drawn and is what hits** (`fluid-blade.js` `WIDE_CUT`, `src/slash-arc.js`). A crescent of the sword's
  water, flat at his waist, is laid as the swing goes (its leading edge where the cut has reached, 28 segments
  rewritten each frame), its outer edge a cream line exactly `WIDE_CUT.reach` (2.6 m) from his axis, lingering 0.2 s
  and thinning to that edge. The hits read the same state (`FluidBlade.slash`: the sweep, how far through it, the
  reach, his place, the cut's way): `sweepHits` takes every foe whose body (its drawn radius) the crescent has reached
  so far (`underSweep`, a wall between keeping one out) and nothing else, so nothing outside the picture is cut. Each
  swing sweeps the way its clip's sword goes (measured in the game: the first right to left, −1.2 → 1.2 rad; the
  second back, 1.1 → −1.1; the heavy third a narrow forward cleave ±0.5 rad, 2.9 m; the charged cut ±1.4, 2.9 m);
  the other moves cut with the sword alone. Brought down from 3.9 m from the chest and ±1.5 rad: in the game the
  hits' farthest body edge measured 2.54 m against the 2.6 m drawn. The sword itself is drawn 1.25 m long and 0.14
  wide in there (`tune(BLADE)`, its tip about 2.1 m out through a cut, the crescent's edge half a metre past it:
  a 0.85 m blade was a few pixels from this camera), and a swing at a foe a little out of reach steps in only to stand
  `WIDE_CUT.pull` (2 m) off its body, under the crescent, not up against it. The fury's ember tints it.
- **Where foes come from is seen first.** A spring wells up `CROWD.warn` (0.7 s) before a burst comes out of it: an
  ember ring on it tightening (`wellsUp` / `emerge`; the heads coming count against the cap).
- **Gorged ones** (`{ gorged: true }` in the table, `GORGED`): a light foe swollen with ink in most waves from the hall
  on (five in a run), 1.35 times its size, a pale ring at its feet, its kind's health and two more (Gentle one), striking
  as hard as its kind; felled, a heart, four chimes and an **ember shard**: walked over, `FURY` (8 s of every cut landing
  twice as hard, `BLADE.edge`, the crescent in ember). The wave's banner says one is in it.
- **A reason to move: ink geysers** (`GEYSER`, `geyserSpots`, a room's `geysers: { every, n }`): from the hall on,
  every 7 / 5.5 / 5 s of a wave (the last wave a quarter sooner) one to three pools open on the floor, one under him and
  the rest near him, off the pillars and apart, a dark pool filling to its ember rim over 1.25 s, then a burst: half a
  heart to him in it (a roll's i-frames take him through, as a blow's), two cuts to every foe in it (lure the crowd in).
- **The last few marked, strays put back.** With three or fewer left and none to come, each stands under a pillar of
  pale light; a foe out of the room more than 1.5 s (past a wall, in the trench) is put back by its far spring (the
  v1.77 run that never ended).
- **Escalation and the end.** Banners count the whole run (`wave 4 of 9`), the status line adds the live chain and the
  fury; the results give a **rank** (`rankFor`, S/A/B/C by the hearts lost, whatever took them, and the time against
  the table's `par`, 240 s), the time, the gorged felled, the furies. A run lost says how far it got and that the roll
  takes him through a blow or a geyser.

Measured with the scripted player (muted headless Chrome, High, nothing hurting him so it plays to the end): v1.77
cleared in about 100 s, 144 of 145 felled, then stuck on a tripod past the wall; now 137 s to the reliquary, all
150, 30 geysers, 5 gorged and 5 furies, and it is hit twice as often (it never rolls). Unity: all of it is meshes and
the session's logic, so the engine's runner plays it as is (`tests/engine-trials.test.js` runs a wave there); the
floating words (`WorldLabels`, DOM) stay web-only.

## Ink tide (`waves.js`)

A basin of sand (`basinHeight`: a flat floor, a low rim, the shore down under a sea of ink whose tide lines close
in while a wave is on), six broken pillars for cover, four ink springs. The game's foes are its own
(`level.foes.own`: on whatever the Enemies setting, nothing from the wilds, `noInk`: the blade does not grow from
them, src/foes.js). `waveKinds(n)`: a budget of `waveBudget(n)` (2 + 1.6 a wave) spent on the kinds come in so
far (`FIRST`: blot 1, spitter 2, swarm 3, machine 4, winged blot 5, shade 6, then the worlds' own kinds,
`src/foe-kinds.js`, one every wave or two: sign moth 7, dune ray 8, root stalker 9, salt crab 11, rust drone 12,
slag walker 14, glass golem 15, shadow hound 17; the new kind first, the heavier ones likelier later, a world kind
come in within two waves a little likelier; `COST`). Group kinds come whole for one cost (`GROUP`: five swarm,
three moths, two hounds). The crowd is capped (`waveCap`: 6 + n; Gentle 5 + n/4) by `heads` (a swarm's blots count
nothing, a golem counts as the three splinters it breaks into); Gentle (or Off) spends seven tenths, and the foes
themselves are gentle (src/foes.js `GENTLE`). They come up out of the springs farthest from you and keep after
you; whatever a foe breaks into (a golem's splinters) is adopted into the wave (`KILL.splinter`), so the wave is
cleared only when they are down too. Every kind works on the basin: the floor is sand (a ray swims under it and
bursts up), drones hover over it, and the hounds run as shadows among the six pillars' long shadows (the hour is
17.4). Style:
`KILL` points × the chain (`chainMult`: a quarter more for each foe cut down within 3 s of the last, to ×3), 30 a
perfect parry, 5 a block (`player.guard` heard), 100 a wave untouched; the score is `tideScore` (150 a wave
cleared + style). Between waves: 35% health back and three boons on plinths that rise ahead of you
(`boonChoice`, `BOONS`: a longer blade, a deeper tank, quick refill, a heavy hand, second wind, light feet, a keen
guard, and from wave 7 (`from`: once the moths have come) steady eyes, which cuts a flash's white and a harpoon's
or a root's hold as `Foes.blind` / `Foes.strike` land them (wrapped for the run, put back at its end);
`boonTunings` turns them into BLADE / EVADE / GUARD / FALL / tank values, put back when the game ends;
the longer blade is drawn longer too: `fluid-blade.js` builds the mesh at `BLADE.length` and stretches it each
frame to `bladeLength(state)`, the tuned length with the reach step on top):
walk onto one; after 14 s the next wave comes anyway. Knocked out, the run ends (the points kept).
## Drum circle (`drums.js`, the rules in `rhythm.js`)

A camp in a hollow of the dunes at dusk (its own arena): a fire in a ring of stones (`story/flames.js`), seven
logs round it, a goblet drum at each, tents. Six villagers drum on the logs and four dance, all `NPC` bodies
the game poses itself (`poseSeated`, `poseDancer`); the traveller sits on the near log with his own drum, his
hands the player's strokes. The **song** is the camps' own (D hijaz on the desert's root, the old desert score's mode: the desert's own score went to bayati in issue #207; the tanpura's drone, a sine
bass, the oud's riff, the ney's tune, the villagers' frame drum `darbuka` / `knock`, a shaker, a handbell; played
by `score-voices.js` and `Sound.instrument` into a bus of the game's own, the world's score hushed under it):
100 beats a minute, 34 bars in six sections (`SECTIONS`: a lead-in, the groove, the tune, a break, the whole
circle, the end), 82 s. The **chart** is written once at sixteen steps a bar (`BARS`: D dum, T tek, K ka, C clap,
B dum and clap) and thinned by `LEVELS`: Easy keeps the beats on three lanes (no clap; ka and clap folded onto the
others), Normal the eighths on four, Hard every step, chords included (121 / 172 / 205 notes).

- **Lanes** (`LANES`): the face buttons by position, A / × at the bottom (the dum), B / ○ right (tek), X / □
  left (ka), Y / △ top (a clap); the arrows or W A S D on the keys (the same diamond); a touch screen taps the
  sockets themselves. The glyphs (the PlayStation shape of their button in their Xbox colour) roll in along four
  spokes to sockets on the drum's ring (`ringLayout`), drawn on a canvas over the scene; the combo sits in the
  ring over the fire.
- **Timing**: the backing is scheduled on the audio clock 0.35 s ahead (a 40 ms interval and each frame, as the
  score's own `schedule`), beat 0 two beats after GO. The song time heard now is `heardSongTime`: the context's
  output timestamp (`getOutputTimestamp`: which context time leaves the speaker at which page time), else its time
  less `outputLatency + baseLatency`. A press is timed by its own event (`keydown` / `pointerdown` `timeStamp`, the
  pad's `timestamp` when it changed this frame), set against what was heard then, less the **Timing** offset (the
  start card's stepper, ±200 ms; the glyphs are drawn as heard, the offset moves only the judging). The results
  give the median error and the offset that would centre it (`timingAdvice`).
- **Judging** (`judgePress`, `sweepMisses`): within 50 ms perfect (100), within 110 ms good (40), a glyph 160 ms
  gone is missed; a press near nothing is a stray (the drum sounds, nothing breaks). Each hit in a row adds to the
  combo, ×2 from 10, ×3 from 20, ×4 from 30 (`multiplier`). `fervour(combo)` (0..1 over 40 in a row) is how hard
  the circle dances (the arms go up, the dancers turn on the spot) and how high the fire burns.
- **Pause**: the song stops (its bus cut) and picks up a bar and a half before where it stopped.
- `tests/minigames-drums-sketch.test.js` plays every level through with a perfect drummer at 60 fps (all perfect),
  a late and patchy one (goods, misses, the advice +80 ms), and checks the windows in pieces as the scheduler
  takes them.

## Sketch hunt (`sketchhunt.js`, the rules in `framing.js`)

Three minutes in the Signal Market (`world: 'bazaar'`, `drives: false`: you walk, run, ride the cabs as ever)
with a list of six things to sketch, drawn from `POOL` by `pickList`: one of each kind (an animal, a strange
plant, someone doing something, a landmark from a given side, a thing) and a sixth, a person always among them,
never the same twice; what the world can't show just now is left off. The subjects are the world's own: the
ticket finches and sign bugs (`wildlife`), the lamp flowers, strap palms, pipe blossoms and tin stars (`flora`),
the crowd at what they are doing (sitting on the kerb, leaning on a counter, on a skybridge seen from below,
talking in a circle: `crowd.people`' poses and groups), the silent tower from Signal Square or from far down the
avenue, a skybridge from right under it, the old sign, a cab in flight, a shop screen square on, a paper lantern.

- **The sketchbook**: hold LT / L2 (the right mouse button, R; the ✎ button on a touch screen) and the view goes
  to the traveller's eyes through the sketchbook's frame, looking where the rig looks (straight up allowed); LB /
  RB (the wheel, Z / C) zoom from 18° to 62°; RT / R2 (a click, G) sketches. A readout under the frame says which
  subject on the list it holds and how good a sketch it would be.
- **The score of a sketch** (`frameScore`, 0..1): its size (its radius over half the frame's height, against the
  subject's own `fill`, 0.6 by default, on a log scale), its centre (how far from the middle), and the side it is
  seen from (`from`: a direction and an angle; `'normal'` for each screen's own face) and where you stand (`eye`).
  Under 0.28 it is not a sketch of it. The readout and the sketch both ask the collision world and the crowd
  (`framing.js` `crowdInWay`: each body an upright capsule round its feet, sitters short; a dot product a body,
  so the readout asks it every time it looks) whether the subject can be seen; the sketch also asks what is
  drawn (a few rays through the scene: the stalls, the railings).
- A subject can be sketched again to do better. Each counts its best ×100; the whole list done early adds two
  points a second left (`huntScore`). The sketches are the frames (`ctx.capture`) turned to sepia ink on the
  page (`toSketch`), and the results show them as a two-page spread with their stars.


## Pirates between worlds (`pirates.js`, the rules in `pirates-rules.js`, the trip in `src/ambush.js`)

**Chime pirates** (v1.43), a rail shooter in space, is the flight between the take-off and the landing the first time
the ship goes to a world never visited: pirates come for the ship (its voice: "They want our hull."; their wrecks are worth chimes, issue #230). It is also an ordinary game (Debug → Games, the Arcade's sign: `?game=pirates`).

- **The rail** (`railPoint(s, u, v)`): the ship flies at `FLY.speed` (42 m/s) along a long gentle wander down -z
  (slopes under 0.3: `railX`, `railY`); it moves only across it, `u` right and `v` up within a 13 × 7.5 m box,
  steered as a plane is (pushing up dives, as in Star Fox 64 and on the jets, and the hints say so:
  `pirateHints(pitch)`, `pirateControls(pitch)` the long form). **No start card** (v1.65, issue #224: "we can skip the
  start screen"): the game is `direct` (the runner counts 3, 2, 1 in at once after the take-off, and flashes "On the way
  to …" over it on the way to a world) and its controls are `hints`: since v1.72 (issue #326, "make the buttons hints much
  smaller and minimal") **one small row** at the bottom right, a button and a word each (`[key, word, id]`: steer with
  the pitch, fire, charge, missile, roll), in the game's dark hint look (src/hint-look.js's strip, 11 px), drawn through
  `keyText` so a handheld's own names show (src/native-pad.js). It shows for the first `HINT_ROW.show` (7) s of play,
  then fades; each word goes `HINT_ROW.used` s after its button is first used (`ctx.hintUsed(id)`, the row closing up
  round it); a new input in hand shows them again (kit/flow.js `hintRow`, the runner's `drawHints`). The missiles left
  stay beside it in the same strip (`ctx.hintNote`). The **pitch switch** is a setting now, since there is
  no card to hold it: **Settings → Game → "Chime pirates: push the stick up to"** (`piratePitch`: As the jets' setting,
  Dive, Climb), its row hidden until the pirates have been beaten anywhere (the save's `minigame.pirates.beaten`; v1.59,
  issue #206: "don't let me switch controls at first"; src/ui.js `data-pirates`, main.js `piratesBeaten`). Until then
  the game's own jets setting decides (`piratePitch(ctx)`, v1.60, issue #230: Settings' `invertFlight` on, push up
  climbs, whatever was kept); once beaten, the setting, and a choice kept from the old start card if the setting is
  left as the jets'. Everything that flies with
  the ship (the pirates, their shots, the bolts) is kept relative to it (`ds` ahead); the rocks, the mines and the
  repair rings hang still in space at an absolute `s`. Pure: `runStep(S, input, dt)` returns the step's events
  (`shot`, `kill`, `hurt`, `deflect`, `blast`, `lock`, `say`, `part`, `checkpoint`, `win`, `dead`, …), which the game draws.
- **The run** (`SCRIPT`, about a minute and a half: 30 % shorter since v1.45, issue #88, the pilot's 138 s down to
  96): skiffs in a sweeping line and in a V, raiders that overtake from under the ship and hold ahead, firing, a hauler
  laying mines, two teal repair rings, then the captain's gunship at 70 s (102 before) (`BOSS`): two brass wingtip turrets
  (bursts of aimed shots), and once both are down the armoured bridge opens (rings of slow shots, skiffs from its
  hold). Left alone for `BOSS.stay` (52 s) it breaks off, and the run ends all the same without its bounty: a run
  always ends. Cut to get there: a line of skiffs, the second hauler and a vee; the belts drawn in with the script;
  the captain's parts 30 % lighter (32, 32 and 78). Rock belts (`BELTS`, `courseRocks(seedOf(destination))`): one
  layout per destination, never a wall (the test checks every 60 m leaves most of the box open).
- **The ship**: six pips of hull (the runner's lives); a rock, a shot, a ram or a mine costs one, then 1.1 s
  untouchable (it blinks). **A pip lost is unmistakable** (v1.59, issue #206; `HURT`): the screen's edges flare red
  under an ink band (0.7 s), the camera shakes (0.45 s), the ship sparks and blinks quicker at first, a row of pips
  shows under the ship for 2.2 s with the lost one bursting out of its place (always, faintly, at two or fewer), the
  corner's pip pops (`.mg-lives i.lost`), and a crunch sounds over the runner's hurt (`snd.hull`). Under Reduce motion,
  or with Camera shake at 0, there is no shake and no flare (`shakeScale()`, src/feel.js; the shake's size follows the
  slider; v1.60, issue #230): the pips, the blink and the crunch tell it. A tap of A / × (Space, the touch ✺) fires the twin bolts; RT / R2 held streams them,
  slower; **held**, the shot charges (0.7 s, an arc filling round the ring) and locks the pirate nearest the reticle
  (`findLock`, the coral LOCK brackets): let go and the gold shot homes in and bursts (9 m: everything in it, their shots too; a bonus for each
  kill past the first). **The barrel roll** (B / ○, LB / L1, X / □, Shift or E, the touch ↶): one quick whole turn
  (0.45 s, eased out so it snaps), a short shove aside, shots turned away while it spins. Scores: `POINTS`; a pip
  left at the end is worth 50.
- **Missiles** (v1.65, issue #224: "add missiles on top of normal lasers"; `FLY.missile`): four a run on their own
  button (**LT / L2**, F, the touch ◇), a teal ring gives one back (up to four), a checkpoint fills the rack. A press
  looses one at what lies nearest the reticle in a cone twice the charge's (`findLock(S, cone)`; with nothing there it
  flies straight on): it drops off the ship, its motor lights and it speeds up (55 to 115 m/s) turning after its target,
  and what it meets takes 14 (a raider or a gun pod's chunk in one) and a splash of 4 round it, their shots there gone.
  Feedback: a small teal pip over what a missile would lock now (while one is left; a diamond round it until v1.75), a hiss and a whine and a flare under
  the ship as it goes, a pale body with a coral head and a flame trailing smoke, a burst and the reticle's gold mark on a
  kill, "No missiles left" and a click when the rack is empty, "Missile +1" at a ring. **Balance**: a missile's kill is
  worth `MISSILE_POINTS` (three quarters) of its points, so a run's total and its chimes stay where the bolts left them:
  the pilot scores 1,619 on average with them against 1,642 without (80–81 chimes against 82; `tests/pirates.test.js`
  holds it within 4 %).
- **The reticle** (v1.75, issue #357: "I don't understand the double reticule. We can make one nicer single
  reticule. Look at the recent Star Fox game"): **one**, where the bolts will be 40 m down the line of fire
  (`aimAt`, `RETICLE.at`): a cream ink ring broken at its four points round a dot. On what the aim assist will bend
  the bolts onto (`aimTarget` within `FLY.assist.slack`: a pirate's or a live part's body and 2.6 m) it tightens
  (16 to 11 px at half size), turns coral and slides 70 % of the way onto it (`RETICLE.pull`, the assist's own `k`:
  where the bolts will go); held, the charge fills a gold ring round it, and the whole reticle is gold once full; a
  bolt that tells (the rules' `hit` event, or a kill) strikes a mark across it (`HIT_MARK`, gold for a kill) with a
  dry tick. The charge's LOCK brackets stay on the locked pirate; a missile's target has a small teal pip over it.
  v1.59 to v1.74 drew a broken ring 26 m down the line and a diamond 80 m down it (two marks that read as two
  reticles), tightening only on the plain line (0.6 m); until v1.59 it was two squares, 22 and 55 m down it.
- **Points, then chimes** (v1.59, issue #206: "don't show '+3 chimes', just have points and at the end they convert into
  chimes"): the run counts points only (`POINTS`, `S.score`: the corner's box, "+10" over each kill); won on the way to
  a world, the results' tally (`tallyHtml`, counted up by `tally()` with a chime heard each tenth) turns them into
  chimes at **one chime for every 20 points** (`CHIME_RATE`, `chimesFor(score)`), and main.js's `onResult` banks them
  into the wallet (`resources.addChimes(n, { source: 'pirates' })`) once, as the trip is marked won (a Retry after the
  win flies it again for the score alone). 20 keeps the economy: the pilot's runs score 1,580–1,670, 79–83 chimes,
  where the chimes per ship (`CHIMES_OF`, v1.45: a skiff 1, a raider 3, a hauler 5, a gun pod 6, the bridge 15) gave 79.
  A lost run keeps its points at the last checkpoint (`S.scoreAt`, `newRun({ score })`). The Arcade's game only scores.
- **No skip; lost, from the checkpoint** (v1.45, issue #88: "I shouldn't be able to skip it"): on the way to a world
  the runner's links are `mandatory` (`transitLinks`): no Quit on any card, Esc backs out of nothing, the results'
  one button after a loss is **Retry from the checkpoint** (`kit/flow.js resultActions`). The script has two
  checkpoints (`CHECKPOINTS`: 33 s, after the first ring; 66 s, just before the captain): a lost run starts again from
  the last one passed (`newRun({ from })`: the waves before it gone by, the hull full, a moment untouchable, the
  points won before it kept), and each loss makes the next run kinder (`MERCY`: the pirates fire 18 % less a loss,
  down to 45 %; a pip more hull a loss, up to two); from the third loss on the hull holds at its last pip, so the ship
  always comes through (the captain breaks off in the end if nothing else): every fight on the way can be won. The
  setting that turned the pirates off on their own ("Pirates on the first flight to a new world") went with the skip;
  the calm game (Enemies off) still has none, as it has no fights anywhere.
- **Gentler, fiercer**: the Enemies setting's gentle fires half as often and slower; each ambush met before
  (`ambushCount`) fires 6 % more often (`heat`, up to ten).
- **Drawn cheaply, no new shader**: the family ship's own model (`buildShipModel`, a quarter size, its rooms
  hidden); every pirate, rock, bolt, shot, spark and mote of dust is one of a few instanced meshes of the game's one
  material, coloured per instance (as the puffs and the dots are: the instancing variant every world compiles); the
  captain's gunship (`buildGunship`, v1.59, issue #206: a galleon under solar sails before; "the boss should be a space
  ship, not a floating pirate ship") 13 plain meshes, one material a part (a hull with a grappling jaw and a skull and
  crossbones on its face, gull wings to the turrets, two nacelles with glowing intakes and an engine astern, oxblood
  armour, gun ports, coral chevrons and a pennant, the bridge's lens behind shutters on a tower), tipped 0.16 rad toward
  the ship so its back reads, drawn to be read from in front; the sky the City Floating in Space's look (its stars and nebula, `INK_SPACE`, the
  destination's planet ahead in its galactic-map colour), so the ink pass's parts are the ones that world compiles.
  Measured (headless Chrome on the Mac, High, 1280 × 720): **1.5 ms of CPU and 7.5 ms of GPU a frame, ~50 draw
  calls, ~55k triangles**, in the waves and against the captain alike (the City Floating in Space's start: 6.7 / 9.2
  ms, 600 calls); no program on the page that the City Floating in Space, the Arena or the Desert don't build.
  The traveller waits hidden under the start (the shadows are placed round him, off the action: nothing there casts).
- **The trip** (`src/ambush.js`): `ambushDue({ to, flag, seen, settings })` is true for the first flight to a world
  the journal has never seen (old saves have their worlds seen: no migration), not home or the Lantern, not with
  Enemies off. The ship's take-off asks main.js (`ship.departure(to)`) and goes to
  `?game=pirates&to=<world>&from=<here>` instead of the landing; the loading screen there is space's ink too
  (index.html). On that page main.js marks `ambush.<world>` 'met' at once (a crash or a closed tab never sends you
  round it again: the one way past it left, and not one the game offers), 'won' on a win (`host.onResult`; saves from
  before v1.45 may hold 'skipped'); the way out is the win's, `?level=<world>&via=ship`. The runner's `host.links`
  (`transitLinks`): the count-in flashes where you are going (`links.intro.kicker`; the ship's warning is said in the run, its comms), `mandatory` (above),
  a win's main button **Fly on to <world>** (`links.win`).
- Tests: `tests/pirates.test.js` (the rail, the rocks, the pilot `botInput` winning at 120, 60, 30 and 20 fps in under
  three quarters of the old run's time, an idle ship lost, the charge's lock and burst, the roll, the rings, the
  captain breaking off, the controls and the pitch setting (not offered until beaten), no start card and the hints,
  the missiles (the lock, the chase, the rack, the ring, the totals with and without), the feel against Star Fox below,
  the points and the tally, a pip lost (the flash, the shake, the pips, the sound), the reticle's tightening and hit
  mark, the gunship, the checkpoints and the mercy; a session is run on a recording host in node), `tests/ambush.test.js` (which trips, the pages, the cards' buttons with no skip however
  often it is lost, the lines' tones, the wiring and the chimes banked); the playthrough wins each ambush on the way
  (`tests/playthrough-agent.js shipTurn`) and checks that every first flight to a new world is ambushed and none home.
  `minigame.session.forward(t)` flies the run ahead by the pilot (the screenshots); `globalThis.__piratesBot = true`
  lets the pilot fly the page.

### Made better (v1.72, issue #326)

The author: "Make the space pirate minigame better. Make the buttons hints much smaller and minimal. Better sound
effects, better enemy designs. Better game feel." The hints are above (one small row that fades). The rest:

- **The pirates, each its own** (`ATTACKS` in the rules, `pirateShapes` and `PIRATE_COLORS` on the page): pale flat
  colours that read against the black, the post's ink round them, a silhouette each, an attack each and a telegraph
  before it (`tell` s: the rules' `tell` event, and `tellK` 0..1 on the pirate or the captain while it winds up; the
  page heats the kind's `tell` part, swells a glow where it fires from, `TELL_AT`, and plays its whine):

  | kind | silhouette | attack | telegraph |
  |---|---|---|---|
  | fighter (skiff) | a coral needle, four cream blades swept forward in an X, a teal eye on top | one aimed shot | its eye flares, 0.4 s |
  | gunboat (raider) | a slate hammerhead, a mustard brow wide across, a cannon slung under it, rust pods striped cream, a dorsal sail | a fan of three (`n` 3, `gap` 0.13 s, 2.6 m apart at the ship; every 3.4 s, one shot every 1.5 s before) | the muzzle glows hot, 0.6 s, a rising whine |
  | bomber (hauler) | a lavender barrel bound in brass, plum bat wings drooping over it, a grab claw, the bomb bay under it | mines laid across the way | the bay's red lamps blink, 0.45 s before each, two blips |
  | mine | a rust ball of spikes, a red eye | contact | its eye blinks quicker within 40 m |
  | flagship (the captain's gunship) | as before | turret bursts; with both down, rings from the bridge | the next turret glows hot, 0.7 s, a growl rising; the bridge's lens swells, 0.9 s |

  The pilot's runs are as before (1,610 points against 1,614 over six destinations, no hit taken, 40.5 kills).
- **Sound** (`src/minigames/pirates-sfx.js` `pirateSounds`, the game's own synth): each a few layers (a body, a snap at
  the attack, a tail), filtered noise and triangles and sines, a sawtooth only low and short, nothing ringing above
  ~2.7 kHz: the twin bolts, a pirate's shot, each kind's telegraph, a bolt striking a hull, explosions sized by the wreck
  (a deep thump, the rumble, a crack, the debris crackling), the clank off the armour, the roll's whoosh, a deflected
  shot's ping, the charge, the lock, a missile, the rack empty, a ring's sparkle, a missile back, the hull's crunch, the
  low-hull warning, the captain's horn as the gunship comes in, a chain's rising note, the comms, the tally, and the
  engine's hum held while it flies (its pitch and filter opening as it steers). All are on the music page ("Chime
  pirates"; tests/music-page.test.js checks every one is listed; tests/pirates-feel.test.js that each has layers and
  nothing shrill).
- **The feel** (`FEEL`, `KILL_SIZE`, `TRAIL`): a kill shakes the camera a little by its size (0.1 m a fighter to 0.45
  a turret, at most 0.5 m however many come at once, fading at 9 /s; none under Reduce motion or with Camera shake at
  0, as the hit's); a **hit-stop** holds the world 35–90 ms (not again within 0.22 s; the flashes and shards crawl on at
  8 %); muzzle flashes at the twin guns and at a pirate's gun as it fires; sparks and a flash where a bolt strikes; a
  hit whitens a pirate and swells it 14 % a moment; explosions with a swelling ball of light and the wreck's shards in
  its colours flung out tumbling (one instanced mesh, 120 at most); the ship banks as before and trails two short
  streams of glowing drops from its nozzles, drawn after it across so they curve as it steers; the flames lengthen as
  it pushes; a hit still blinks it untouchable 1.1 s; kills within 1.8 s of each other count a **combo**, "×n" popped
  in teal over the wreck with a note a step higher each time (the points unchanged: the chimes stay where they were).
- **Tighter controls** (`FLY`): the stick taken up a little quicker (`response` 6 /s, 5 before), a **brake** when it
  is let go or turned back (10 /s: it stops where it is left), a **curve** on the stick (|x|^1.3: half a push is a fine
  correction, a full one as before), and **aim assist**: a bolt fired with a pirate within 2.6 m of the line of fire is
  bent 70 % of the way onto it (since v1.75 the reticle tightens on it and slides as far onto it, issue #357).
- Tests: `tests/pirates-feel.test.js` (the row's size, look and fade; each kind's silhouette, colours and tell part;
  each kind's attack after its telegraph, the fan's three shots; the sounds' layers and range; a kill's shake, hit-stop,
  combo and shards, none of the shake under Reduce motion; the trail and the buttons marked used; the curve, the brake
  and the assist).

### The controls, against Star Fox (v1.45, issue #88)

The author: "the controls feel weird and not super close to Star Fox. Do an audit to understand why." What Star Fox 64
does, what the shooter did (v1.43), and what it does now:

| | Star Fox 64 | Before (v1.43) | Now |
|---|---|---|---|
| The stick | sets where the Arwing heads; it gets there with weight, eased | a fixed acceleration (75 m/s²) to a fixed speed: reached in a quarter second, linear, then a hard stop | the stick's speed taken up with an easing (`FLY.response` 5/s: 63 % in 0.2 s, nearly all in 0.6), brisk at first and settling |
| The edge of the play space | soft: it slows against it | a wall: clamped, thrown back at a fifth of its speed (a bounce) | slowed to nothing over its last 22 % (`FLY.edge`), stopped there, never thrown back |
| The nose | points where it is going; the shots go where it points | the bolts flew straight down the rail with half the ship's sideways speed; the nose's turn was drawing only | the nose's slope (`FLY.aim` 0.09 at full stick) is the bolts' own way across too (`aimAt`): you aim by steering |
| The reticle | ahead of the nose, swinging out as it turns | two squares close in front of the ship, barely leading | the same squares where the bolts will be (`aimAt`): 2–8 m ahead of the ship in a full turn; the charge locks round it, not round the ship |
| Pitch | the nose up when climbing | **drawn nose down when climbing** (the sign was the wrong way round) | nose up when climbing, down when diving |
| Bank | hard into the turn | 0.7 rad at full speed, slow to follow (6/s) | 0.95 rad (54°), quick (`FLY.bank` 9/s) |
| The camera | follows part of the ship's move, late, leading it: the Arwing moves about the screen | followed 0.8 of the offset quickly: the ship sat nearly still in the middle and the space seemed to slide | 0.55 of it (`CAM.follow`), slower (`CAM.rate` 3.5/s), looking ahead of the ship's sideways speed (`CAM.lead`), a little of its bank (`CAM.roll`) |
| Stick forward | dives (a plane's) | dives, said only in the controls' list, tied to the jets' "Invert" setting | dives by default, as there; the start card shows **Stick forward: Dives / Climbs** and keeps the choice |
| The barrel roll | a quick spin (a double tap) that turns shots away | 0.55 s, linear, a 24 m/s shove, the steering a third as strong while it spun | 0.45 s, eased out (a snap), a 14 m/s shove, the steering kept |
| Lock-on | hold A: the reticle locks the nearest in it | locked round the ship's place | locked round the reticle at the target's distance |

Not done (Star Fox has them): the boost and the brake (C buttons), and the bank held on Z / R (the roll's buttons
do the roll here). `tests/pirates.test.js` "the feel, as Star Fox" checks the easing, the soft edge, the bank, the
nose and that a bolt reaches the reticle.


## Trials in the worlds (v0.98, `src/trials/`)

(With the makers' runs, the temples' kit in the open, they make the challenges: docs/systems/challenges.md.)

One optional **mastery trial** in each route world, built from what that world gives you, played where it stands
(not on a game page): the Desert's **Dune line** (the hoverbike, down into the basin), Vael's **Wind ladder** (the
wings up two columns of rising air and through rings between them), the Sky Stones' **Stone circuit** (the bird,
round the Needles, the great Table and the Monastery), Lorn's **Reed race** and Lorn II's **Lagoon laps** (the skiff;
the gust fan fills its sail), Viridel's **Eye garden** (eight sleeping eyes to splash), the City-Shaft's **Shaft
climb** (the wings, up the halfway air pillar from the middle terrace to the rim, v1.42; the jets before), the Glass
Dunes' **Glass slalom** (the Hangar's Pillar slalom that was), the Buried Machine's **Canyon dive** and the Signal Market's
**Avenue run** (on the jets until the jets became a debug item; on the wings since v1.43, each with columns of rising
air to climb again: the slalom four, the dive one on the rim and one at the canyon's end to climb out, the avenue one at
its head and one halfway), the Garden of Spheres' **Garden round** (on foot), and the three of v1.40 (the Underwater
City's **Tube run**, the Moon Foundry's **Floor round** and the floating city's **Courier's round**, on foot). No trial
wants the jets.

- **Data** (`data.js` `TRIALS`): mode, the sign, the start, gates (`[x, y, z, r]`, or `ground: true` laid `up` m over
  the ground or the water), eyes, wind columns, an easy pace (the par), the reward. **Rules** (`course.js`, pure): a
  gate is passed when the body's path this frame comes within its radius (`segmentDistance`), in order;
  `lacks` (the items, a mount found: the desert's bike only once uncovered), `inMode` (still on the mount),
  `parTime` (the course at the easy pace × 1.6 + 5 s: a first try that keeps going beats it).
- **In the world** (`index.js` `createTrials`, made by main.js): a sign (the arcade sign's model, in the trial's
  colour; a floating buoy in the lagoon, ridden up to) whose interact opens the start card. main.js makes a
  `MinigameRunner` for `trialGame(T)` (drives false: the usual play runs; its `navigate` just drops it, so Quit leaves
  you in the world). The session puts you at the line (on your mount if it wants one), holds you through 3, 2, 1,
  shows the next three gates (the next with a beam over it), counts gates or eyes, and ends the run if you are
  knocked out or off your mount for 3 s. The wilds' packs keep away while it runs. Gadgets stay in hand
  (`def.trial`): the fan into the skiff's sail.
- **Wind columns** (`winds.js` `WindColumn`): a temple Updraft in the open, a ring of stone at its foot; it lifts open
  wings and is a working (src/workings.js), so foes are thrown up by it too.
- **Best and reward**: the best time is the runner's (`minigame.trial-<world>.best`); the first finish sets
  `trial.<world>.done` and grants the reward (src/items.js items with `trial`), shown on the results card and the
  item's card. The rewards are upgrades to the gadgets (`upgrades.js` `UPGRADES`: the hook's line 34 m, a fourth
  bomb, a fourth spring bounce, five fan hops in the air, four boomerang locks, bubbles half as long again, half as much
  ink again in the pen, the magnet's reach 26 m, the lens clouding half as fast, 12 s of recall) and the hoverbike's
  (the desert's dune fins: 42 m/s at full throttle, not 34), set on the tuning tables while owned (`syncUpgrades`,
  before the gadgets are made and on every grant); the three v1.40 worlds give cosmetics. Every reward is for
  something you already have there (v1.47, issue #99): the Buried Machine's run gives the lens's clear glass, the
  Garden of Spheres' the bombs' fourth pouch, the Signal Market's the recall's long sand, each that world's own court
  gadget (`tests/trials.test.js` checks it against the route's order). Since that court can lie past the trial's sign,
  a trial whose prize is a gadget's upgrade waits for the gadget (`lacks` with the prize: "Its prize is for the grappling
  hook. Come back with it.", issue #125); a save that won the prize already runs it freely. The market's racer's ribbon stays an item for
  the saves that won it. A save that finished a trial before keeps what it won and gets the new reward on its next finish.
- **Fair courses** (`check.js` `checkCourse`): every gate in the open, the way between them clear, a ride with no
  wall or cliff on it (water all the way for the skiff), a glide never asking more than 1 : 5.2 without a column.
  `tests/trials-worlds.test.js` runs it in every world; `tests/trials.test.js` the pure parts.

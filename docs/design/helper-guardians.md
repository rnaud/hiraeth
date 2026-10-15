# Helping a guardian instead of fighting it (issue #339)

The author, after the first prototypes (v1.76: gliding round the Roost catching the Elder's feathers, a water cannon in
the Keeper's cistern, both played on the guardian inside its fight's arena): "That's not right. What I want is proper
mini games like we did with all the other minigames. Something that changes the way we approach the gameplay
completely. We might have to go to a giant room or even outside."

So each helping encounter is a **minigame on the kit** (docs/systems/minigames.md): its own page (`?game=<id>`), its own
arena, a start card, a 3-2-1, a clock or a score, a pause card, results with a best kept, and a sign with its host in
the guardian's world. And each is played with **a different verb and a different camera from the fight**: no lock-on,
no blows, no meter to fill by hitting the right thing at the right time. The fight asks "survive it and answer its
openings"; these ask something the guardian needs and cannot do alone.

The bar (the two games they are measured against): the **Wing drop** (`wingdrop.js`: a pure flight model, three
rounds, a score built from several skills, its own camera for each moment, thermals and stars drawn and felt) and the
**Shooting gallery** (`gallery.js`: a director that paces the minute, a combo that rewards keeping it clean, a host who
talks while you play, every hit with its sound and its number).

The first prototypes (`src/guardian-help/`, `?guardianHelp=`) are gone; these two are the one way to play each.

| Game | Page | Where its sign is | Host |
|---|---|---|---|
| **The Elder's flight** (`src/minigames/elderflight.js`, rules `formation.js`) | `?game=elderflight` | Vael, at the foot of the Aerie's great steps | Corra, who flew with the riders |
| **Cistern channels** (`src/minigames/cistern.js`, rules `channels.js`) | `?game=cistern` | the Desert, beside the Rose House's door | Nuri, who digs the channels |

## 1. The Elder's flight: formation flying across the open sky

The Elder will not fly alone (LORE.md, "The Aerie"). Here she does fly, out of the Aerie and across the sea of cloud to
the riders' old roost, as long as somebody flies at her wing. **The verb is keeping station**: you are her wingman.

- **Where**: outside, the open sky over Vael's sea of cloud, sky stones (tables and needles) standing out of it, a
  2.3 km route from the Aerie's crown to the Old Roost, a great table ringed with stone feathers. Its own arena, built
  with the sky stones' kit and look (`sky-stones-kit.js`, `SKY_STONES_LOOK`, the cloud deck and its puffs).
- **The camera**: a wide formation shot from behind and outside the pair, a long lens, both birds always in it,
  rolling a little with her. Nothing like the fight's lock-on: you look at the two of you flying.
- **Your wings** (`wingStep`, pure): the stick banks and turns, forward dives, back climbs (the Ring race's way); A / ×
  held beats your wings (faster), LT / L2 spreads them wide (slower). Alone you glide at 15 m/s and sink; she flies at
  17. **Her wake** (`wakeAt`): the air off her wingtip, behind and beside her, holds you up and draws you to her pace.
  Sit in it and you fly with her for free; that is the game's feel.
- **The slot**: a ring of light 12 m off her wingtip and 5 m back, on the side she wants you. In it (within 5 m)
  you score harmony every second, the multiplier climbing a step every 3 s held (×1 to ×5); out of it for more than a
  second, the multiplier falls back to ×1.
- **Wind gates**: thirteen great rings of turning wind strung between the stones. Each gate has her ring and yours
  beside it, on the side of her slot. Through yours: +100 × the multiplier, +50 more "Together!" when you go through
  within 0.8 s of her. **She calls the side**: after a gate she cries and dips the wing you should come to; the next
  gate is on that side, so you cross behind her to it. A gate missed costs her courage and your multiplier.
- **Gusts**: three stretches between pairs of stones where a crosswind (7 m/s) blows across the route, drawn as
  streaks: she is heavy and holds her line; you have to crab into it to stay in the slot.
- **Her courage** (0 to 1, the bar on screen): it falls while you are far from her (more than 28 m) and when you miss a
  gate or hit a stone; it comes back while you hold the slot. More than 16 m off your slot, she slows and waits for you. Out of
  courage she turns back to the Aerie: the flight ends there, the points kept. Reach the Old Roost and she lands:
  +300 for the flight, + her courage × 500.
- **Failing gently**: flown into a stone, you bounce off it slowed; into the cloud, you come up again in her wake. Both
  cost courage, never the run.
- **Score**: points (harmony + gates + the landing). A clean flight is about 2 minutes 20.

## 2. Cistern channels: routing water through a giant hall

The Keeper was thirsty (LORE.md, "The Keeper of the cistern"). Under the Rose House the Givers' great cistern court is a
floor of channel stones, eight by six, each turnable; their old spout in the north wall still holds water. **The verb
is routing**: turn the stones so the water runs from the spout to the Keeper's four troughs, ahead of the water.

- **Where**: a giant sunken court (60 × 50 m), the Rose House's stone and its channels' teal water, its roof long
  fallen so the sun comes in; the spout a carved muzzle high in the north wall; four stone troughs round the edges.
- **The camera**: high over the court's south end, looking down at the whole floor (the board), easing a little after
  you. A puzzle's view: you read the channels, not a foe.
- **You**, on foot in the court: the stick walks you across the stones. A / × turns the stone you stand on a quarter
  turn clockwise, X / □ the other way. RT / R2 held hurries the water (three times as fast, every stone it fills worth
  double while it hurries): to fill the troughs sooner, or to cut the wait at the start.
- **The stones** (`channels.js`, pure): straights, bends, tees (the water splits both ways) and crosses (it runs
  straight through; a cross filled both ways is +100), a few broken ones that never turn. A stone the water is in is
  set: it no longer turns.
- **The water**: the spout opens after 12 s (the card says when); then it runs along the channels a stone at a time,
  3 s a stone at first and quicker as it goes (to 1.6 s; on Hard 2.2 s to 1.1 s). Where a stone does not open toward
  it, or it runs into the wall, it spills and that stream ends. Every stone filled is 10 points; a trough reached is
  +250, and the Keeper comes to drink from it. All four reached: +500.
- **The Keeper**: it wanders the court while it is thirsty, curious about the water; a stone it stands on cannot be
  turned ("It's lying on that one."), so you work round it, or wait. When a trough fills it goes to drink, its glyphs
  brightening a quarter each time.
- **The end**: when the last stream has run out (spilled or into a trough). Each board is new (a seed), made with a way
  to reach all four troughs (`makeBoard` builds the route first, then scrambles every stone); Easy and Hard keep their
  own bests.

## Unity

Both play in the Unity bridge through engine/trials.js (it reads the games from src/minigames/index.js), checked in the
editor's batch (`scripts/unity-js-run.sh <name> -game elderflight -level arzach`, `-game cistern -level desert`): the
start card, the 3-2-1, the run with its HUD line, the pause card and the run resumed all draw. Web only for now: the
floating "+10" / "+250" / "×3" words over the board and the sky (kit/labels.js is DOM: docs/systems/engine-bridge.md,
"Not drawn yet"); the flashes, the status line and the cards are the bridge's own and show. In the batch the cistern's
start card is seen from the traveller's follow camera rather than the court's overview; from GO on, both games' own
cameras.

## What the author decides after playing

- Whether either replaces its guardian's fight, sits beside it (the second visit, or a choice at the door), or becomes
  the shape for every guardian (the pitches below).
- The Elder: her pace against yours (17 / 15 m/s), how strongly her wake holds you (`FORMATION.wake`), the slot's size,
  how fast her courage falls.
- The Cistern: the water's pace, the wait at the start, the board's size, how much the Keeper gets in the way.

## The other guardians, as minigame pitches

Each its own page, arena, verb and camera; none a fight with a twist.

| Guardian (temple) | The minigame |
|---|---|
| **The warden** (the Warden's Well) | **Vane breath**: a vertical shaft seen from the side. You hover with the jets, washing the four great vanes with the gun so the tower breathes again; each vane turned holds for a while and slows; keep all four turning for three minutes while the warden's heat rises and falls. Juggling, a plate-spinner. |
| **The Cloud-Mother** (the Founders' Belfry) | **Bell keeper**: a rhythm game under the open dome. Her calls are the beat; ring the bell on it to hold falling-up stones in the air while she gathers them under her fins; a stone rung early drops, late drifts out of the dome. The drum circle's lane, on a sky. |
| **The Mother Snapper** (the Hush-House) | **Hatchling crossing**: a side-on view over the gulf. Still the pendulums with the stilling glob so her hatchlings can hop across them to her; each still holds 3.5 s; chain them so no hatchling ever lands on a swinging stone. Lemmings on a clock. |
| **The Lampless** (the Lamp-House) | **Lamplighter's walk**: a top-down hall in the dark. It follows the last light it saw; carry the lantern ahead, lighting pools, and lead it home pool to pool before the ones behind go out. Leading, not fighting. |
| **The Gardener** (the Builders' Greenhouse) | **Sun on its back**: an overview of the louvred dome. Turn the louvres to throw the sun across the beds on its back in the seasons' order painted round the dome while the sun moves on; a bed in shade folds. A light-routing puzzle, Cistern channels' cousin. |
| **The Clockwork Foreman** (the First Garage) | **Wind the Foreman**: a dial seen face on. Hit its numerals in step from four o'clock, the quick coil's refills your breath, an hour on each round; a missed step ticks it back an hour. A rhythm and timing game, twelve rounds. |
| **The Tooth-Warden** (the Engine-House) | **Gear runner**: an isometric engine floor. Roll balls into the cranks to stop the pistons one bank at a time and clear the Tooth-Warden a path across the turning gear; restart each bank behind it with the cell. A traffic puzzle against the engine's stall meter. |
| **The Echo** (the Footprint) | **Song of the prints**: the Footprint's hall as a memory game. The Echo sings a phrase, you find the prints with the lens and sing the spheres back in their order; each round a note longer; a wrong note and it hums the last right one. Simon, in a sphere. |
| **The First Sign** (the Undertower) | **Relay**: a chain of dishes across the tower, seen from above. Carry its word in the echo shell to the far ear and the answer back, one word a trip, the words fading from the shell; route the shortest way round as the dishes turn. A courier's run. |
| **The Listener** (the Whale-House) | **Deep call**: through the glass, out to sea. Sound the whale-horn into the hall's dishes and set the dishes' balls so the note carries farther each round while the tide shifts them; three rounds and the whales answer. Aim and keep. |
| **The Last Founder** (the Casting-House) | **One whole moon**: the casting floor from the gantry. Carry the iron moons with the tongs through the pilot flame into its moulds while it pours, splash its heart between pours so the metal cools evenly; a cold moon cracks. A cooking game, Overcooked's rush. |
| **The Anchor-Warden** (the Mooring-House) | **Mooring run**: the void round the house, flown. Tether each drifting island's anchor home to its capstan arm; islands drift farther the longer they wait, so the order you fetch them in is the game. A route-planning race. |

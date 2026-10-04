# Story bible — "Something of value"

Companion to `game-brief.md`. One page per world: the local story, the people,
the quests, the discovery (a **keepsake**), and the **clue** that links it to
another world. Written to be built: each world gets one main quest, two side
quests, a handful of named NPCs with conversations, and one keepsake.

## The thread

The traveller is sent out to bring back "something of value". Their father
means something impressive: power, rare matter, a prize. Every world offers
one, and every world also offers something quieter. Keepsakes record both,
and the player decides at the end what they bring home.

**Keepsake kinds** (vary them across worlds): *thing* (an object), *song*,
*word* (something a person said), *person* (someone who asks to come along, or
a promise to return), *knowing* (an understanding of how the world works).

**The glyph**: three dots over an arc that bows upward (∩), never a smile. It is scorched into the ship's hull from
the impact. It recurs on the reactive scenery's three apertures in every world,
on the giants' bones, on the Lodestar's facets, on the Major's machine, on the
android ruins of Viridel and on the oldest market sign. Locals each have a
different name and story for it. Nobody knows what struck the ship; in each
world one person has seen "a falling light that sang" around the same time.

**The boxes** (src/boxes/, src/items.js): every item box in the game is an
artifact of the **makers**, the people whose sign is the glyph. Nobody has
seen a maker. They made the giants walk (the giants carried their water
across the worlds, and lay down where they could go no further), they marked
everything they made with the glyph, and they left gifts behind them for
travellers who would come a long way after them: the backpack, its jets and
wings, its lenses and rings, little charms. Each gift waits in a chest:
- **The look.** Knee-high, dark blue paint crazed with age, corners worn
  round, a tapering plinth, a frieze of carved glyph rings round the body and
  a carved ring round the lid's **pale four-point star**. They are very old
  and have never been broken; up close they hum, their star and carvings
  brighten and the seam leaks light.
- **The star** is the makers' sign for a traveller: what a traveller looks
  like from far off, "a small light, a long way from home" (Nour). The pale
  star item is a copy of it, worn on the hood.
- **They open only for someone who has come a long way.** Locals have sat
  beside them for generations and never seen one open. In the desert the old
  words say it plainly: "the Givers' chest opens for one who fell from the
  sky". The traveller is the first in living memory.
- **Where they are.** Where the makers' giants walked: shrines, high
  places, out-of-the-way ledges, never lying in the open by chance. Each
  world has its own name for them (table below), and one person in each
  world mentions theirs.
- **Open questions** (left for later): whether the singing light that struck
  the ship was a makers' thing too (Nour wonders: "whatever struck you knew
  their sign, or it was one of their gifts, too, and lost its way"); whether
  the chests opened for Ilen.

**The colours**: the backpack fluid starts two-tone (cyan and violet). Each
world that has a "source" (desert water, Lorn crystal, the bazaar's lantern
sun, the buried machine's oil-light) can add a colour band. By the end the
tank holds the colours of every world: the tool itself becomes a record of the
journey.

**The recordings** (src/story/calls.js; the full arc is the section "The
recordings" below). There are no calls home. The traveller plays old
recordings of the parents, one after each world, on the cockpit console, and
hopes each one has something to do with where he has just been. They don't
answer him. Over the game it comes out that they are very old, that the
parents were not happy with him when they made them, and, at the end, that the
parents are dead: the journey is a son trying to make them proud after the
fact.

**The translator.** Nobody out there speaks the traveller's language. The
traveller wears a small translator at the ear, a thing from home, so they
*hear* each world's own tongue (a mumble of syllables) and *read* it in their
own words. In the dialogue panel the last few letters still show in the
speaker's script as they come in, and a small tag on the panel's edge says
"translating · Qanati" (or Shaft cant, Lorn burble…). It is diegetic and
light-touch:
- the father mentions it in the prologue's recording, made the day the traveller
  left ("Keep the translator at your ear. Nobody out there talks like us…");
- Nour notices it ("I hear you, child: clicks and hums, like a pot coming to
  the boil. Then that little thing at your ear hums back at me…");
- on the recordings and at home it says nothing: the parents speak the home
  tongue, warm and familiar, and the tag stays hidden.

Each world's tongue (src/story/voice.js `LANGUAGES`) has its own sound:
- the desert is breathy and low;
- the City-Shaft is fast and clipped;
- Vael is almost silent, leaving words out;
- the cloud monks chant;
- the Hangar clanks like a voice-box;
- the buried city rumbles;
- Viridel lilts upward like birds;
- the spheres ring like glass;
- Lorn is watery (bloops and wobbles);
- the Signal Market patters through a speaker grille.

Every line carries a tone (`'~sad~ …'`, src/story/tone.js) that colours how it
is said. Narration and stage directions in brackets are silent; recordings
and broadcasts voice only their *quoted* words (the Signal Market's broadcast
in the father's own voice). The sound can be turned off: *Alien voices* in
the settings.

## World by world

### 1. The Desert — "The Tree That Drinks"
- **Local story**: Once a year the old city's burning tree "drinks": water
  rises from beneath the giants and the fire burns cool and many-coloured.
  Pilgrims cross the dunes in procession to see it. This year the water has
  not risen.
- **Place**: the old city of **Qanat** (230, 400), built round the burning tree,
  with pilgrims' camps outside its main gate (168, 292). Its sacred well is dry.
  Beside the well, opposite the carved stele, a **ledge juts out of the burning
  tree's trunk** a few metres up: a plank shelf on a buttress root marked with
  the glyph, cloths tied to its corners. On it, in the open where you see it
  from the stairs, the makers' chest that holds the backpack; you climb the
  root to reach it. Nour's stone bench is below it, under the tree's arm. (It
  was once a little blue shrine; the flag `desert.shrine.gathered` keeps its
  name.)
- **People**: Ama, keeper of the camp fires; Teo, a drummer who lost his drum;
  Sefa (oud) and Bako (ney), the camp musicians; the Speaker who leads the
  procession; a child, Ilo, who wants to see the cave; old Oum, the pilgrim who
  fell behind; Hessa, keeper of the dry well; Marrow, a salvager; **Nour, the
  eldest of Qanat**, Hessa's grandmother, who has kept the chest company for
  sixty years (her mother kept it before her); and a few people of Qanat (a
  weaver, a potter, a boy, a baker, a guard, a sweeper) about the terraces and
  the avenue.
- **Main quest** (`desert.power`, stages in src/story/desert-data.js):
  1. `city`: the ship is dark and the traveller's back is bare. "Follow the
     smoke to the city." On the way the camps and the procession wave them on
     (Ama: "To the city, sky-stranger! Up to the tree!"; the Speaker: "Qanat is
     ahead, little star"). Nothing on the way needs the tool.
  2. `box`: "Something is humming on a ledge up the burning tree's trunk." Up
     the main stairs, the ledge is left of the well; you climb the buttress root. The first time you come near, the people
     on the terrace turn and murmur, Hessa calls her grandmother, the tree
     flares. Nour, asked before it opens: it has not opened for anyone in
     living memory; it opens only for "one who fell from the sky".
  3. `elder`: it opens for the traveller (the backpack). Qanat gathers at the
     tree's foot under the ledge (the ones in the avenue come up the stairs),
     everyone looks up, the tree flares high, and Nour gets off her bench, waits
     for you to climb down ("Come down, child!"), comes to you and speaks: the old words, the singing light the chest hummed back to, the
     Givers, the star, the tank ("the same water the giants carried"), and the
     one power in the desert, the water that has not risen. She sends you on.
  4. `well`: listen at the dry well (Hessa). 5. `ama`: ask Ama at the fires for
     the drinking jar. 6. `speaker`: walk with the Speaker; the old words know
     the way down: "Where the giant's eyes are marked, its mouth is a door."
  7. `down`: out of the back gate to the fallen giant's skull (318, 530),
     whose open mouth is a doorway → the cave of shifting water in the giant's
     chest, where the tree's roots hang into the pool. 8. `channel`: the pool is
     dry (damp stains, a pale tide line, no water at all) because a giant's bone
     has fallen across the channel. Pushing it clear (fluid push; without the
     tool, a heave) lets the water run: the stream comes out of the crack, down
     the channel, and fills the pool; the tree drinks. 9. `fill`, 10. `ship`: the jar filled at the pool powers the ship
     (`ship.powered`, `world.desert.done`, the keepsake).
  Saves from before (stages `pack`, `camps`, then ama, speaker, well) move to
  `city` or to Nour and skip what they already did (src/story/desert.js
  `migrateDesertQuest`; src/boxes/index.js `migrateSave` marks the shrine's
  box open for anyone who already carries the backpack).
- **Keepsakes**: *knowing*: "What the giants left" (main quest); *song*: "Teo's
  walking rhythm" (his drum, found under the ribcage); *thing*: Oum's knotted
  cord (walk her back to the fire and she tells the rumour of the singing
  light).
- **Lore**: the giants carried the water from the swamp of lights and lay down
  where they could go no further; the water pooled in their hearts. The tree
  grows from this giant's heart and Qanat was built round it.
- **Clue**: the Speaker says the giants "came down from the swamp of lights"
  → Lorn. Someone saw a singing light fall the night the ship crashed.

### 2. The City-Shaft (incal) — "The Light Nobody Looks At"
- **Local story**: The Lodestar turns above the palace; the upper city calls it a
  tourist story, the lower levels pray to it. A sweeper on the high terraces
  says it has been dimming since "the night the sky rang".
- **Quests**: deliver a ration from the lower levels to the palace guard (who
  is from the lower levels himself); find the taxi driver who still stops for
  the poor; carry a message up the shaft.
- **Keepsake**: *word*: the sweeper's "Look up once a day."
- **Clue**: a Lodestar splinter carries the glyph and hums like Lorn's crystal.

### 3. Vael — "The Waiting Bird"
- **Local story**: The bird waits for a rider who left the lone tower long ago.
  Nobody speaks much. The world is silent by choice.
- **Quests**: find three feathers the bird has shed across the spires; ring
  the stone hand's knuckles in the right order; reach the tower window.
- **Keepsake**: *person*: the bird lets you ride, and will come if called
  from any world with sky (a promise, not an item).
- **Clue**: the tower's room has a map of the sky stones → Vael II.

### 4. Vael II — "The Bell Under the Cloud"
- **Local story**: The monastery bell has not rung since the cloud rose; the
  monks believe the stones fell *up* when the bell stopped. Ring it and the
  cloud will settle.
- **Quests**: retrieve the clapper from the floating island; carry a monk's
  letter across the aqueduct to the plain; balance the cairn stones.
- **Keepsake**: *song*: the bell's single note, which plays from the tank
  when you shoot afterwards.
- **Clue**: the tower on the plain holds the same masked face as the desert's
  sleeping head → the giants were here too.

### 5. The Sealed Hangar — "The Major Forgot"
- **Local story**: Major Brask built this pocket universe and forgot why.
  His people keep the machines turning out of habit, passing a signal around
  the three zones that nobody can read.
- **Quests**: carry the signal through the portals to the ring; fix three
  stopped machines (shoot to restart them); find the Major's note on the
  upside-down slab.
- **Keepsake**: *knowing*: the note: "I built it to see what I would do with
  it. I still don't know. That is the point."
- **Clue**: the signal decodes to coordinates of a buried wheel → the Buried
  Machine.

### 6. The Buried Machine — "One Tooth a Year"
- **Local story**: Below the dunes a great wheel turns one tooth a year; the
  dome people time their lives by it. The hanging city above is "its other
  half". The oculus window is warm: something inside is still alive.
- **Quests**: read the pressure gauges along the canyon; return the dome
  keeper's key; light the oculus.
- **Keepsake**: *thing*: a rust gear tooth, warm to the touch, the year it
  turned while you were there.
- **Clue**: oil-light in the oculus adds an amber band to the tank; the
  machine's maker's mark is the glyph.

### 7. Viridel — "The Garden Grows Over"
- **Local story**: Odile and Talo's ship fell here; the gardeners let the
  garden take it. They believe nothing that falls should be dug up again.
- **Quests**: find the crashed ship; return a pyramid seed to the gardener;
  climb the tallest tree.
- **Keepsake**: *word*: "We tend the garden. The garden tends us."
- **Clue**: Odile and Talo's ship was struck by the same singing light → the
  traveller's ship wasn't the first.

### 8. The Garden of Spheres — "What the Spheres Remember"
- **Local story**: The spheres came down long ago; each "remembers" one
  sound. The round plaza's pole hums when the great sphere is on the horizon.
- **Quests**: listen at three spheres (stand still nearby); carry a lake
  reflection (a mirrored pebble) to the plaza; walk the avenue slowly.
- **Keepsake**: *song*: the chord the three spheres make together.
- **Clue**: one sphere's sound is the desert's procession drum.

### 9. Lorn — "The Great Crystal"
- **Local story**: The crystal sings in the rain and the carnivorous plants
  fall silent. The swamp people say it is a piece of something that fell.
- **Quests**: feed nothing to the plants (a test of patience); bring a crystal
  splinter to the cave; follow the fireflies.
- **Keepsake**: *thing*: a crystal splinter that harmonises with the tank.
- **Clue**: the crystal's song matches the "singing light" → it is a fragment
  of whatever struck the ship.

### 10. Lorn II — "The Lamps Are Kept"
- **Local story**: In the deep wood people keep the pools lit for travellers
  who never come. You are the first in a long time.
- **Quests**: relight three dark pools (shoot them); return the moss-dome
  latch; find the skiff's owner.
- **Keepsake**: *person*: the lamp-keeper asks you to come back one day.
- **Clue**: the saucer half-sunk in the pool is Odile and Talo's escape pod
  → Viridel.

### 11. The Signal Market — "You Are Not Alone"
- **Local story**: A thousand signs speak; one tower is silent. The market
  believes the silent tower was the only one that told the truth.
- **Quests**: deliver the unsent recording; tune the antenna; restart the
  broadcast. The broadcast, once restarted, is the father's voice, a recording
  from long ago, sent to someone else's child.
- **Keepsake**: *word*: the broadcast's message.
- **Clue**: the broadcast was sent from the traveller's home system.

## The recordings (built: src/story/calls.js, src/ship/hologram.js)

**What is true, and is only said at the very end.** The traveller's mother and
father are dead. He left home at seventeen, after one fight too many, with his
father's words at the port ("make us proud, bring back something of value"),
and he did not come back while they were alive. They died two years ago,
within a season of each other. What is left of them is **the reel**: the old
house recorder's spool, every message they ever left him on it over twenty-odd
years, reminders and scoldings, birthdays, nights he did not come home, and
the ones made after he had gone. Most of them are not happy with him. He took
the reel and his father's old ship (the flight cap on the dash, the drawings
under the bunk, three stools in the galley) and went out to do, at last, the
thing he was asked: bring back something of value. After every world he plays
a recording, and hopes it is about where he has been.

**How it plays.** At the console, E plays a recording (`calls.<n>`, one waiting
after each finished world, as the calls were). The traveller asks the reel for
a word that belongs to the world just finished (the desert: *water*; the
City-Shaft: *looking up*; Vael: *quiet*; Vael II: *bell*; the Hangar: *why*;
the Buried Machine: *patience*; Viridel: *garden*; the spheres: *remember*;
Lorn: *rain*; Lorn II: *lamp*; the Signal Market: *listening*). The ship finds
one match and plays it: the parents rise over the projector on the dash as a
hologram, as they were when they made it, and the traveller stands facing them.
The recording fits loosely, sometimes oddly (he asks for water and gets his
father telling him to turn the tap off; he asks for patience and hears "one
tooth at a time, your grandfather said"). It never answers him. His own lines
are short: a hope that it fits ("He means the water. He must."), later an
answer the recording cannot hear (he says the names of the people he met
when his mother asks "who did you meet today?"; he holds the keepsake up to
the light, where they would see it).

**The recordings are old, and it shows a little more each time** (keyed to n,
the recordings heard, whatever the order of the worlds):
1. The prologue: "The reel is cued in the cockpit, where you left it." The
   father's speech the day he left; the player takes it for a call from home.
   The impact tears the hologram apart.
2. The first one after a world: no date; the father is short with him.
3. The father mentions things that cannot be now (exams, the fence, the Orrin
   boy). The screen shows a worn date stamp.
4. The mother joins. A child's voice behind them: "Is that for me?" It is the
   traveller's. The ship: "Logged nineteen years ago."
5. The tape is wearing: a word is lost. "When you are older you will
   understand." The traveller: "I know what it says. I just want to hear it."
6. The mother alone at the end of one: "Your father says I shouldn't make
   these. He says you never listen to them. I think one day you will."
7. (After `ENDING_WORLDS` worlds) the last recording on the reel: both of them,
   "Come home." The ship: "That was the last recording on the reel. Logged two
   years ago, eleven days before the house went quiet." Home is on the map.

Before that, a few recordings answer what happened in a way the traveller
cannot explain (each once, flags `calls.beat.<id>`): the father warning him
off "anything singing out there" (after the singing light); the harbour bell
behind them (after Vael II's bell); "ships get struck out there, that's all it
is" (after Odile and Talo's ship); the three dots he drew on the landing ring
as a boy (after the glyph); a bird's promise in a child's story; the lamp the
mother leaves in the round window. The keepsake kinds still matter: whichever
he brings, the recording happens to hold what his father once said about such
things (a song: "nobody ever fuelled a ship with a song"; words: "you always
have words, show me something"), and once he has heard about Ilen, what the
father said later, sorrier.

**Ilen.** The Signal Market's broadcast is the father's voice, years younger,
to a child called Ilen. Afterwards the traveller asks the reel for the name
(`calls.ilen.asked`). There is one recording, in the mother's voice, labelled
"For when he asks." He is not ready: "Not here. Not yet." Once the ship has
flown on, it is waiting (`calls.ilen`, `calls.ilen.told`): she made it knowing
he would hear the broadcast one day. Ilen was his elder sister, grown and gone
before he was born, sent out with the same words; she never came home; the
father sent that message after her every night for a year; the last thing that
came back from her ship was a sound like singing. "He isn't asking you for
something of value. He never was." After that the next recording he finds is
the father saying it himself: "I said the same words to you at the port that I
said to her."

**After the ending** the reel plays its oldest side, from when he was small;
they are happier, and he sometimes answers them.

## The ending (built: src/story/ending.js, src/ship/homecoming.js, src/levels/home.js)
After `ENDING_WORLDS` (6) worlds, the last recording asks the traveller home
and the galactic map shows **Home** just under its centre ("Nobody lives there
now. There is a stone on the hill."). Choosing it flies there. Out of the jump
the ship reads out the hold: every keepsake and every one of the makers' small
gifts (the charms, the lenses, the star; not the backpack and its wings and
jets, which he wears) goes down with him. The ship lands on the ring by the
small round house at dusk: the lamp in the round window is dark, the door is
shut. He walks past the door to the **stone** in the front yard, a round-topped
headstone over a low slab with two rings carved on it, overlapping like the
two moons. He sets the tokens on the slab one by one, each with a short line
of what it was ("Teo's walking rhythm. You can hum it now without thinking.";
for words, the words). Last he sets the reel down, and it plays by itself the
one recording he never searched for, the oldest: the parents young, a small
child between them waving at the recorder. "You don't have to bring us
anything. We are proud of you already." He says goodbye. The closing line
("Something of value. You brought it home on your own two feet."), an end
card, then the credits: the worlds and their people, and what he left on the
stone. Flags: `ending.done`; `ending.keepsake` is `all` (saves that chose one
keepsake before keep theirs). The stone keeps its tokens when you come back.

## Local names (as built)
| World | The glyph | The singing light | The makers' boxes |
|---|---|---|---|
| Desert | the mark between the giant's eyes; the Giver's mark (the keepers) | the singing light that turned (Oum); the chest hummed back to it all night (Nour) | the Givers' chest, the star-chest (Nour, Hessa) |
| Vael | the bird's track (Oïa) | heard in the stones (Senn) | a square with a star, drawn in the sand (Oïa, who doesn't speak) |
| Vael II | the Three Notes (Calix) | the bell hummed by itself for it | a bell-chest: it hummed back too (Calix) |
| Hangar | the maker's rivets (Ottla), the Major's thumbprint (Clemence) | seen through the ring's slit (Lune); three machines stopped that night | "for the next one": the Major found it and never opened it (Ottla) |
| Buried Machine | the Maker's Thumb | the Tuning Star (Hask, Dun) | thumb-boxes (Wen) |
| Viridel | the Builders' mark (Oro) | the Singer (Talo's word, Sol) | Builders' gifts (Oro) |
| Garden of Spheres | the Footprint, under every sphere (Ivo) | an Answerer (Ume) | left-behinds (Ivo) |
| Lorn | the Hush: three drops of rain over a shut mouth | Sedge saw it fall the night before the crash; the crystal's 213th phrase is its song | the sky-egg (Wendel) |
| Lorn II | the Welcome: three lamps over a hull | Wick saw it put the pools out | the traveller's chest (Hollin) |
| City-Shaft | the palace seal (rim), the Three Who Look Up (bottom) | it passed over the shaft and the Lodestar rang back; it left "toward the deserts" | lost property (rim), a promise (bottom; Ossa) |
| Signal Market | the First Sign (Sel), the tuning mark (Ferro) | the unsent recording "came in singing" (Kip) | (no box of its own) |

Built details beyond the bible: the bird's promise (`bird.promise`) could later
let her answer a whistle in other worlds; Vael II's clapper "fell up"; the
Major once visited the wheel and wrote "FOUND IT. NOW WHAT?" on the drum wall;
Odile and Talo left in the saucer for the deep wood where the lamps are kept;
each sphere remembers the last sound it heard before falling.

More built details: the Great Crystal adds a crystal-violet band to the tank,
and Wendel gives a second keepsake ("The patient are never eaten"). Hollin has
kept the deep wood's lamps for 41 years; Odile and Talo borrowed Fen's skiff and
left "the long way" through the root cave. The City-Shaft's rule: a light
nobody looks at goes out. The Signal Market's rule: the first thing anyone ever
sold there was an answer.

**Open thread: Ilen.** The Signal Market's broadcast is the father, years
younger, speaking to a child called Ilen, with the same words he said to his
own son. Sel offers two readings: he once had someone else to call home, or he
lent his voice to another family through the old relays.

**Ilen (as built, src/story/calls.js).** The first reading, made plain, by
the mother's own recording "For when he asks" (see "The recordings" above):
Ilen was the traveller's elder sister, grown and gone before he was born. She
went out the same way; at the port the father told her to make them proud and
bring back something of value. She never came home, and nobody found out why.
The broadcast is the message he sent after her every night for a year, until
the mother asked him to stop. The last thing that came back from Ilen's ship
was not a voice but a sound like singing: the parents heard the singing light
too. At the stone, the traveller leaves the last token for her.

# Story bible — "Something of value"

> **Current writing reference (2026-10-05):** See [the writing room](../lore/README.md)
> for revised voices and [continuity](../lore/continuity.md) for the current
> opening. The quotations and some quest summaries below describe earlier
> revisions; live story data is authoritative for current wording and flow.

Companion to `game-brief.md`. One page per world: the local story, the people,
the quests, the discovery (a **keepsake**), and the **clue** that links it to
another world. Written to be built: each world gets one main quest, two or more
side quests, a handful of named NPCs with conversations, and at least one
keepsake. (LORE.md gathers the story as built; where this page is short, it
follows the build.)

## The thread

The traveller is sent out to bring back "something of value". Their father
means something impressive: power, rare matter, a prize. Every world offers
one, and every world also offers something quieter. Keepsakes record both,
and he brings them home and sets them, one by one, on his parents' stone: once
at the first homecoming, and again at the true ending, with his sister beside him.

**Keepsake kinds** (vary them across worlds): *thing* (an object), *song*,
*word* (something a person said), *person* (someone who asks to come along, or
a promise to return), *knowing* (an understanding of how the world works).

**The glyph**: three dots over an arc that bows upward (∩), never a smile. It is scorched into the ship's hull where
the singing light brushed past it. It recurs on the reactive scenery's three apertures in every world,
on the giants' bones, on the Lodestar's facets, on the Major's machine, on the
android ruins of Viridel and on the oldest market sign. Locals each have a
different name and story for it. Nobody out on the route knows what drained the ship; in each
world at least one person (often several) saw a singing light pass over on the
night before it found the ship: it dipped low, turned "like it was looking for
something", and climbed away. It never fell. **What it was** (said only at the
end, by Ilen at the Lantern): her answer. The makers' lantern sends a light to
bring in anyone a long way from home; when the father's broadcast reached her,
thirty years late, she sang his own message into one, put the makers' sign on
it, and sent it home. It sang over the round house (the father at the window),
then went looking for the voice that had called her and found it on the reel
playing in his ship's cockpit (he paused the reel to listen to it). It passed so
close it drained the ship (they drink what a ship runs on as they pass), and he
came down in the desert: a forced landing, not a crash. It was trying to bring
the father to her; it found the son, and he chose to follow it.
The glyph scorched into the hull is the sign it carried: *we heard you*.

**The signature** (src/story/signature.js; LORE.md, "The light's signature"):
the scar is magnetised, and its field beats slowly in threes. The ship charts
only the worlds whose field carries the same signature (the worlds the singing
light passed through) and reads the trace further on from each one finished.
Home has none. The ship says so after the landing (and he tells it to follow
the light), on the map and out of each first jump; a few locals notice it as compasses and needles that turn.

**The boxes** (src/boxes/, src/items.js): every item box in the game is an
artifact of the **makers**, the people whose sign is the glyph. Nobody has
seen a maker. They made the giants walk (the giants carried their water
across the worlds, and lay down where they could go no further), they marked
everything they made with the glyph, and they left gifts behind them for
travellers who would come a long way after them: the backpack, its jets and
wings, its lenses and rings, little charms. Each gift waits in a chest:
- **The look.** The same in every world: a hip-high rounded shell of pale
  cream ceramic like a river stone, the **pale four-point star** on its top, a
  thin brass band round it and, in its front, a round glass lens of glowing jade
  fluid, the same living jade as the traveller's backpack (made by the same
  hands). At the heart of each temple waits a rarer one, a bud of white stone and
  gold with jade glass in its seams. A thin ray of light forever travels across
  them. They are very old and have never been broken; up close they hum, the star
  and the lens brighten and the ray crosses more often. Opened, a chest floats
  up, wobbles two or three times as if deciding, parts like petals with jade light
  rising out of it (the temple's bud opens like a flower), and comes apart into light.
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
- **Answered at the Lantern** (the final chapter, below): the singing light is a
  makers' light, sent from their lantern, and the one that drained the ship was
  Ilen's answer (Nour was right: "whatever brought you down knew their sign"); the
  chests opened for her too, thirty years ago. The glyph means *we heard you*.

**The colours**: the backpack fluid starts two-tone (cyan and violet). Each
world that has a "source" (desert water, Lorn crystal, the buried machine's
oil-light, the Signal Market's lantern sun: Oyo's last lantern, poured into the
hose) can add a colour band. By the end the
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
own words. In the dialogue panel the words come in the speaker's own
script as they are said (each world writes its own way: Qanati's joined
abjad, the City-Shaft's runes, Lorn's knots on a cord…), and each turns into
the traveller's words a moment later, as the translator catches up. It is
diegetic and light-touch:
- the father mentions it in the prologue's recording, made the day the traveller
  left ("Keep the translator at your ear. Nobody out there talks like us…");
- nobody asks how they understand each other, the traveller least of all: it
  is obvious (players found the question in Nour's talk fussy, and it went);
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

In route order (`src/levels/names.js` ORDER): the desert, then Vael (the wings
and the winds; the sky stones are its southern half now), Lorn (with the Deep
Wood north of its swamp), Viridel, the Underwater City, then, in the later half,
the City-Shaft (its own jets, the Warden's harness), the Glass Dunes and the
Buried Machine, the Moon Foundry, the Garden of Spheres, the City Floating in
Space and the Signal Market: twelve places.

**Why the three newest sit where they do (v1.40).** The three were detours built
in October 2026 and came onto the route with temples of their own.
- **The Underwater City, fifth**, between Viridel and the City-Shaft. It asks for
  nothing the first four worlds don't give (it is walked hall to hall under glass,
  through sealed tubes and a lift: nobody swims), so it fits before the jets, and
  it keeps the City-Shaft in the later half of the route (the seventh of fourteen
  places). Story: Viridel leaves the traveller knowing the light struck a ship
  before his; under the sea he hears that it sang to the whales, and the whales'
  answer sends him on to "a city built down a well" (the City-Shaft). Its temple's
  gadget, the whale-horn, plays one fixed note and so teaches listening, half a
  route before the Signal Market's echo shell teaches carrying notes.
- **The Moon Foundry, ninth**, right after the Buried Machine. Its folk speak the
  machine's tongue, Dun and Wen come up from the domes to see it, and Wen's wheel
  "one tooth a year" was cast somewhere: here. The foundry's ledger sends him on to
  the Garden of Spheres, whose spheres are the first moons, sent and fallen short
  (Emrys of the Garden already stands on the bowl, wondering at them).
- **The City Floating in Space, eleventh**, between the Garden and the Signal
  Market. It has no ground at all, so it comes late, for a traveller at ease on
  his wings; its visitors, Kip and Madame Sel, are the Market's, and its cables
  catch the planet's hum, which carries the broadcast of the Market's silent tower
  (the last world). Its trace, a ship that hailed with a sung note, is the nearest
  the route comes to Ilen before the Market says her name. Since October 2026 Vael II
and Lorn II are parts of Vael and Lorn, and the Sealed Hangar and the Atelier are
dismissed: kept whole (`src/levels/dismissed/`), off the route; the Hangar's
temple, the First Garage, stands in the Glass Dunes as the Clock-House. Nothing
was deleted: the sections of the old worlds stay below, marked.
The sections below are numbered by the old route (they keep the order they were
written in).

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
  1. `city`: the ship is dark and the traveller's back is bare. The quest
     doesn't just appear: Marrow the salvager is at the ship, looking over the
     scar on its hull, and calls the traveller over ("Sky-person! Over here!");
     he says the ship isn't broken but drained, that only Qanat, round its great
     tree, ever held that much power (the tree has gone cold, and burning or cold
     Qanat doesn't hand its fire to strangers), and to ask old Nour under the
     humming chest. Nour: put our tree right, "and Qanat will not let you leave in
     the dark". The quest
     starts in that talk (or with Ama, the Speaker, Nour or Hessa, whoever the
     traveller talks to first). On the way the camps and the procession wave them on
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
     for you to climb down ("Come down, child!"), comes to you and calls you
     over ("Psst. Child."), but leaves the talk to you: the old words, the singing light the chest hummed back to, the
     Givers, the star, the tank ("the same water the giants carried"), and the
     one power in the desert, the water that has not risen. She sends you on
     with the Speaker's old verse, the way down: "Where the giant's eyes are
     marked, its mouth is a door." If you like, she has you listen at the dry
     well with her first (the water moving far below).
  4. `ask`: Ama at the fires gives the drinking jar (or already did, if you sat
     at her fire on the way in). The Speaker, at the procession's head, tells
     the old words whole for whoever walks with him: the giants, the swamp of
     lights, the verse.
  5. `down`: out of the back gate to the fallen giant's skull (318, 530),
     whose open mouth is a doorway → the cave of shifting water in the giant's
     chest, where the tree's roots hang into the pool. 6. `channel`: the pool is
     dry (damp stains, a pale tide line, no water at all) because a giant's bone
     has fallen across the channel. Pushing it clear (fluid push; without the
     tool, a heave) lets the water run: the stream comes out of the crack, down
     the channel, and fills the pool; the tree drinks. 7. `fill` (the jar and the tank at the pool), then the
     spark-stone's errand lights the tree. 8. `ship`: **Qanat repays him.** Because he gave the city back its
     light, the city chooses to help him in return: the ones with something to give go down to his ship and pour
     in what their houses can spare (the camps' share of the Drinking, a street's lamps, the well's first water,
     an oven's fire-water, Marrow's last cell), one by one, Nour last ("You gave us back our light, child. So
     Qanat gives your ship its own."). That powers the ship (`ship.powered`, `world.desert.done`, the keepsake;
     src/story/desert-repay.js), not the tree's fire by itself.
  Saves from before (stages `pack`, `camps`, then ama, speaker, well) move to
  `city` or to Nour and skip what they already did (src/story/desert.js
  `migrateDesertQuest`; src/boxes/index.js `migrateSave` marks the shrine's
  box open for anyone who already carries the backpack).
- **Keepsakes**: *knowing*: "What the giants left" (main quest); *song*: "Teo's
  walking rhythm" (his drum, found under the ribcage). Oum's knotted cord is
  an item, not a keepsake: she tells the rumour of the singing light when you
  find her, and gives you the cord, one knot for every circuit, once you have
  walked her back to the fire.
- **Lore**: the giants carried the water from the swamp of lights and lay down
  where they could go no further; the water pooled in their hearts. The tree
  grows from this giant's heart and Qanat was built round it.
- **Clue**: the Speaker says the giants "came down from the swamp of lights"
  → Lorn. Someone saw a singing light go over the night before the ship came down (it dipped low, turned, and climbed away).

### 7. The City-Shaft (incal) — "The Light Nobody Looks At"
- **Local story**: The Lodestar turns above the palace; the upper city calls it a
  tourist story, the lower levels pray to it. A sweeper on the high terraces
  says it has faded a little every year since she was a girl (nobody looks up),
  and has been going out since "the night the sky rang".
- **Quests**: deliver a ration from the lower levels to the palace guard (who
  is from the lower levels himself); find Wren, the old cab that still stops for
  the poor (cabs drive themselves; Wren speaks from the little screen on its
  dash); carry a message up the shaft; earn a cab pass from Lio, the
  dispatcher on the rim, by collecting the fare Tobin owes him (until then no
  cab answers your whistle or lets you in; Wren, at its lamp, stops for anyone).
  You ride seated inside a cab and tell it where to go.
- **Gift**: the Warden's harness (v1.38: the jets, firing in the City-Shaft only; the jets anywhere are a debug item), in the Warden's Well on the rim. The route brings the
  City-Shaft in its later half (the seventh world), so the jets come long after
  the wings; right after the chest, a line, the drone and rings rising through
  the oculus show the first flight, up into the gallery.
- **Keepsake**: *word*: the sweeper's "Look up once a day."
- **Clue**: a Lodestar splinter carries the glyph and hums like Lorn's crystal.

### 2. Vael — "The Waiting Bird"
- **Local story**: The bird has not come down since her rider left the lone
  tower long ago: she keeps to the sky over the haze, and answers only the
  rider's call. Nobody speaks much. The world is silent by choice.
- **Quests**: find the fluid wings in the Aerie and ride the wind that rises up
  the tower's side to its balcony; climb to the window, where the rider left a
  little bone flute on the sill; play it (five notes: her call) and the bird
  comes down for the first time, and bows. Until then she is not seen and
  cannot be ridden. Then: find three feathers the bird has shed across the
  spires; ring the stone hand's knuckles in the right order.
- **Gift**: the fluid wings (the Aerie). Vael is the first world after the
  desert, so gliding and the winds come first.
- **Keepsake**: *person*: the bird lets you ride, and will come if called
  from any world with sky (a promise, not an item); calling her plays the
  rider's tune.
- **Clue**: through the window, a map of the sky stones on the wall → the sky
  stones, south of the plain over the cloud (once their own world, Vael II; one
  world with Vael since October 2026: the bird carries you there).

### 3. Vael II — "The Bell Under the Cloud"
*(Vael's southern half since October 2026: the sky stones' plateaus over the cloud, its story, temple and people
as they were, in the one world.)*
- **Local story**: The monastery bell has not rung since the cloud rose,
  thirty years ago; the monks believe its ringing kept the world down, and
  that when it stopped everything loose fell *up* (the sky stones themselves
  are far older: they have hung there since before anyone's mother). Ring it
  and the cloud will settle.
- **Quests**: retrieve the clapper from the floating island; carry a monk's
  letter across the aqueduct to the plain; balance the cairn stones.
- **Keepsake**: *song*: the bell's single note, which plays from the tank
  when you shoot afterwards.
- **Clue**: the tower on the plain holds the same masked face as the desert's
  sleeping head → the giants were here too.
- **The crossing** (v1.43): the bird riders of the plain set off over the cloud
  from the riders' gate at the plain's edge (their names scratched in its
  pillars, the newest thirty years old); the monks lit a string of lanterns from
  the rose cliff home to it, and strung a rope way to the island church before
  the cloud rose (its knots still hang on little stones). The first plateaus are
  a walk from the plain along the long aqueduct, where Ondine walks out each day.
- **Its page**: the bell closes Vael II's own page in the sketchbook (THE BELL
  UNDER THE CLOUD), after Vael's, and its own recording waits (*bell*).

### 8. The Sealed Hangar — "The Major Forgot"
*(Dismissed in October 2026, kept whole in `src/levels/dismissed/hangar/` with its people and story, to be used
elsewhere; its temple went to the Glass Dunes, below. Its place on the route is the Glass Dunes'.)*
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

### 8b. The Glass Dunes — "The Clock in the Glass"
- **Local story**: Glassworkers camp in a sand valley walled by waves of green
  glass that broke and never fell. East of the valley stands the Clock-House, a
  round stair-house of the makers with a clock over its door; its works set the
  pace for the camps' clocks, and they all stopped the night the singing light
  passed. Something underneath has been winding tighter ever since.
- **Quests**: Wim, who winds the clocks, sends you down the Clock-House: the
  Clockwork Foreman at its heart wants six numerals lit together (the makers'
  quick coil inside makes it possible).
- **Keepsake**: *sound*: Wim's tick, every clock in the dunes keeping the same
  time.
- **Clue**: Wim's word after: the Foreman keeps only the small time; the slow
  time comes from a great wheel under a far desert that turns one tooth a year
  → the Buried Machine.

### 5b. The Underwater City — "The Song Through the Glass" (v1.40)
*(A detour until v1.40, swum through; on the route since, redesigned so nobody swims: `src/levels/underwater.js`.)*
- **Local story**: A city of glass domes on the sea floor, its halls joined by
  sealed tubes and a lift up the great column of the Plaza: the Dock where the
  lock takes the ship down, the Avenue with its cafés under the greatest dome, the
  kelp Garden, the Plaza, the Crown under the surface's ripples, and the Whale
  Gallery hanging over the deep. Outside the glass the whales used to come close
  and sing. The night the sky rang a light came down through the sea singing one
  note; the whales sang it back, all at once, and went away. Since then the glass
  hums that one note all over the city, and something in the makers' Whale-House
  on the sea floor has been singing the light's note back at the whales.
- **Quests**: the main one is the temple, **the Whale-House** (Anselme at its
  door; Maelle in the Whale Gallery tells why the whales keep away): find the
  makers' **whale-horn** inside and calm its keeper. Two errands of the city's
  own: Mireille's glow-kelp cutting up the lift to Fabre in the Crown (*A Cutting
  for the Crown*), and Fabre's word down to Maelle that he has lit the Crown's
  lamps every dusk for the whales (*Lamps for the Whales*). Odette keeps the
  Air-Shop; Bastien the lock; Coralie a café.
- **Keepsake**: *song*: the whales' answer, the light's note first and then their own.
- **Trace (from its detour days)**: Coralie: a woman from up top listened all night
  to the whales, and hummed back the one that sang something she knew.
- **Clue**: the old ones in the pod say the light went up, on to a city built down a
  well where a light hangs that nobody looks at (`clue.underwater.incal`) → the City-Shaft.

### 9. The Buried Machine — "One Tooth a Year"
- **Local story**: Below the dunes a great wheel turned one tooth a year; the
  dome people time their lives by it. The hanging city above is "its other
  half". The oculus window is warm: something inside is still alive. The
  old story says the city settles onto the wheel when the last tooth turns.
  Once the traveller lights the Wick the wheel turns on and does not stop (as
  built: it turns forever, a real turning collider). The reading, Wen's, the
  morning after: a wheel has no last tooth; the last tooth is whichever one
  keeps it turning, and the Other Half stays up as long as it turns. They keep
  Tooth Day once a year all the same.
- **Quests**: read the pressure gauges along the canyon; return the dome
  keeper's key; light the oculus.
- **Keepsake**: *thing*: a rust gear tooth, warm to the touch, the year it
  turned while you were there.
- **Clue**: oil-light in the oculus adds an amber band to the tank; the
  machine's maker's mark is the glyph.

### 9b. The Moon Foundry — "The Moon Nobody Came For" (v1.40)
*(A detour until v1.40; on the route since, after the Buried Machine: `src/levels/moon-foundry.js`.)*
- **Local story**: Under a vast roof on rust pillars the founders cast small moons
  for somebody's sky; nobody came for them. They hang from the cranes, lie in
  orange claws, one is broken open with a street inside it, and the foundry's folk
  live in the old machinery. One furnace is still warm (Bertil's). The night the
  sky rang every hung moon turned on its hook toward where the light went, and
  since then the makers' **Casting-House** on the east of the floor pours again by
  itself at night, and the moulds crack, and the floor shakes.
- **Quests**: the main one is the temple, **the Casting-House** (Ilse at its door
  with the founders' ledger): find the **founders' tongs** inside (the push takes
  hold of the iron moons) and stop the Last Founder. Two errands of the foundry's
  own: Wen of the Buried Machine, on holiday, wants the moons counted from the
  lookout on the pillar under the moon on its pillar (*Thirty-One Moons*: there are
  thirty-two, one in the mould); Ottilie's mended ladle-hook to Bertil at the
  furnace (*The Ladle-Hook*). Gunnar keeps the Crucible.
- **Keepsake**: *thing*: a pocket moon, the last the Casting-House poured, still warm.
- **Trace (from its detour days)**: Bertil cast the mark on a plate for a lone
  woman's ship's nose: "So they'll know me."
- **Clue**: the ledger's first page: the first moons were sent to a garden far off,
  and fell short, and lie in its grass (`clue.moonfoundry.spheres`) → the Garden of Spheres.

### 6. Viridel — "The Garden Grows Over"
- **Local story**: Odile and Talo's ship fell here; the gardeners let the
  garden take it. They believe nothing that falls should be dug up again.
- **Quests**: find the crashed ship; return a pyramid seed to the gardener;
  climb the tallest tree; **water for Esk's tea terraces, the quest that fails**:
  clear her runnels, then, at her asking, open the white builders' cistern gate
  "a little". It gives way; the flood takes the middle of the terraces into the
  dry hollow, for good. She blames you, you say sorry, she says it belongs to
  the ground now. The journal files it as failed; the father's charge keeps it
  as "what you could not mend"; a recording afterwards lands differently.
- **Keepsake**: *word*: "We tend the garden. The garden tends us."
- **Clue**: Odile and Talo's ship was brought down by the same singing light → the
  traveller's ship wasn't the first.

### 10. The Garden of Spheres — "What the Spheres Remember"
- **Local story**: The spheres came down long ago; each "remembers" one
  sound. The round plaza's pole hums when the great sphere is on the horizon.
- **Quests**: listen at three spheres (splash each with the fluid); carry a lake
  reflection (a mirrored pebble) to the plaza; walk the avenue slowly.
- **Keepsake**: *song*: the chord the three spheres make together.
- **Clue**: one sphere's sound is the desert's procession drum.

### 10b. The City Floating in Space — "The Note That Passed" (v1.40)
*(A detour until v1.40; on the route since, before the Signal Market: `src/levels/space-city.js`.)*
- **Local story**: Heaped adobe houses on islands floating in the dark, joined by
  bridges, a great pale planet over the roofs. The islands are moored to each
  other by the moorers' cables, held by the great capstan in the makers'
  **Mooring-House** on the last island. The night the sky rang its note ran down
  every cable; since then the islands drift apart a hand's width a night and the
  bridges creak.
- **Quests**: the main one is the temple, **the Mooring-House** (Joss the moorer at
  its door): find **tether mode** inside (a cone that pulls instead of pushing) and
  resolve the Anchor-Warden. Two errands of the city's own: Madame Sel's notes on
  the planet's hum to Tamar under her cables (*The Planet's Hum*), and one of Kip's
  nine lamps hung at the far end of the Moorings bridge (*A Lamp at the Edge*).
  Amaro keeps the Oil-Lamp Shop: the city pays in lamp oil.
- **Keepsake**: *knowing*: what the cables are for: not holding the islands up, listening.
- **Trace (from its detour days)**: Tamar: a ship with no name, one pilot alone,
  hailed the city with a sung note; the night the sky rang the same note passed
  again, fast and high, going somewhere.
- **Clue**: with the cables taut, the planet's hum carries a broadcast from a
  market of a thousand signs where one tower is silent (`clue.spacecity.bazaar`) →
  the Signal Market.

### 4. Lorn — "The Great Crystal"
- **Local story**: The crystal sings in the rain and the carnivorous plants
  fall silent. The swamp people say it is a piece of something that fell.
- **Quests**: feed nothing to the plants (a test of patience); bring a crystal
  splinter to the cave; follow the fireflies.
- **Keepsake**: *thing*: a crystal splinter that harmonises with the tank.
- **Clue**: the crystal's song matches the "singing light" → it is a fragment
  of whatever passed the ship.

### 5. Lorn II — "The Lamps Are Kept"
*(Lorn's northern half since October 2026: the crystal swamp opens into the Deep Wood, its half-transparent
giant mushrooms, keepers, temple and story as they were, in the one world.)*
- **Local story**: In the deep wood people keep the pools lit for travellers
  who never come. You are the first in a long time.
- **Quests**: relight three dark pools (shoot them); return the moss-dome
  latch; find the skiff's owner (Fen, in the far dome: the skiff you whistle for
  in Lorn's swamp was his, lent to Odile and Talo forty years ago and never
  brought back up; he gives it to you).
- **Its page**: since v1.43 the lamps close Lorn II's own page in the sketchbook
  (THE LAMPS ARE KEPT), after Lorn's, and its own recording waits (*lamp*, then
  *why*: see "The recordings").
- **Keepsake**: *person*: the lamp-keeper asks you to come back one day.
- **Clue**: the saucer half-sunk in the pool is Odile and Talo's escape pod
  → Viridel.

### 11. The Signal Market — "You Are Not Alone"
- **Local story**: A thousand signs speak; one tower is silent. The market
  believes the silent tower was the only one that told the truth.
- **Quests**: deliver the unsent recording; tune the antenna; restart the
  broadcast. The broadcast, once restarted, is the father's voice, a recording
  from long ago, sent to someone else's child. Oyo's last lantern, relit the
  night the sky rang, adds the market's colour band to the tank.
- **Keepsake**: *word*: the broadcast's message.
- **Clue**: the broadcast was sent from the traveller's home system.

### 12. The Lantern — "We Heard You" (the final chapter)
- **Where**: past the Signal Market, on no chart; charted after the first
  homecoming once the market's broadcast is heard (the light's trace).
- **The place**: one small island in a still sea of light at dusk; the makers'
  lantern on its crown; Ilen's house, the top half of her own round ship; yellow
  flowers; a bench facing home; two stones on the point: Odile and Talo, who got
  there first (brought down twice, they came looking the third time), kept the lantern
  and kept her, and died there.
- **Ilen**: about fifty, grey coming into her hair, the mother's teal and coral;
  speaks the home tongue (no translator). A light brought her in thirty years
  ago and her ship never flew again (its last sound home was the light's
  singing). She meets her brother, learns the parents are dead, tells him what
  the light was and why it came to his ship, hears what he chose on the way, asks him to
  tell Hollin where Odile and Talo went, and comes home.
- **Keepsake**: *person*: Ilen herself (she walks to the stone; she is never
  set on it).

### 11b. The night mail: the Overnight Train (a side quest of the Signal Market; built: src/story/night-train-data.js)
- **Why here**: the Signal Market is the place of messages that travel a long way to reach someone who may not be
  listening. The Overnight Train's crowd were always its townsfolk out for the night (`COSTUMES.overnighttrain`), and
  the train's chalk mark was kept by "someone aboard" (the detours' traces, below). The train has no address; for forty
  years the market's night halt has been its post office.
- **Place**: past the landing at the market's south end, a single line of rail runs out east and west into the dark:
  the night halt (src/levels/night-halt.js). A low platform, a lamp on an iron post, a brass bell, a shelter with the
  timetable under glass (every column says WHEN RUNG), a board: NIGHT HALT.
- **People**: **Edda**, who keeps the halt's lamp and sorts the night mail; **Solange**, her grandmother, who boarded
  the night Edda was born "to see where the plain ends" and never got off, and rides the roofs of the long tail by the
  chalk mark she keeps; **Ambrose**, the conductor, who knows everyone aboard by the cup they drink from.
- **The quest** (`bazaar.nightmail`, "The Night Mail"; stages wren, board, find, agathe, stop, off, home):
  1. Edda at the halt: forty years of postcards from Solange, one a year, never a question; this year Edda has written
     back, and can't leave the lamp. She gives you the letter.
  2. Ring the bell: the train stops for the bell, it has to. The screen fades and you are aboard on the station-side
     porch, the train pulling out of the halt (`?level=overnighttrain&from=bazaar`).
  3. Ambrose on the porch: Solange never sits inside; she rides the roofs at the very back. Out past the landing wagon, up
     the ladder, and walk the roofs of the long tail till the rails run out behind you, the plain racing past.
  4. Solange by the chalk mark: she reads the letter with her back to the wind and writes her answer on the back of it
     in chalk. (The mark was there the night she boarded, nearly gone; she drew it over so it wouldn't be, and doesn't
     know who drew it first. A train should have one thing nobody can explain.)
  5. Back to Ambrose: he pulls the cord; a minute on, the brakes take hold and the train brakes into the market's halt.
  6. Step down on the station side once it has stopped (`?level=bazaar&from=overnighttrain`: on the halt's platform).
  7. Edda reads the answer under the lamp, twice: the plain doesn't end, and Solange will get off at the market's halt
     next spring, to see if the lamp is still lit. "It will be."
- **After**: the bell calls the train whenever it is rung (a ride for its own sake; Ambrose stops at the halt when asked).
  A save on the train wakes on the train, still running; the train never waits at a station unless someone asks.
- **Keepsake**: none; the quest's outro (Solange's answer pinned under the halt's lamp).

## The fellow traveller: Tansy (built: src/story/fellow-data.js; docs/systems/story.md)

One person travels too. **Tansy**, about nineteen, from the Salt Harbour: the harbour book's old line in home
letters (*…where the singing goes*) was the dare she grew up on, and the night the sky rang her compass swung
round and never swung back. She left her aunt Hesper one line in the book, *Gone where the singing goes*, took
the coins in Hesper's biscuit tin, and hitches world to world after the needle. She wants to get there first, so
the harbour writes her name in letters the salt can't eat (the salt eats every name in the end, if nobody
reads it). Loud in Vael, brave and broke, learns three words first in every world: water, sorry, which way.

Met four times, in the first four of Vael, Lorn, the City-Shaft and the Signal Market the traveller lands in,
a few steps from his ship. *A world ahead* (what is he after; sign her book), *the needle stops* (her ride gone,
thirty-one days from home: send word, or keep going?), *looking up* (who is waiting for him; does Hesper still
read her page?), *something to show*: home (word sent ahead, her compass to him, it still points after the light)
or on past the last chart (a letter for Hesper). If he told her of someone he never said goodbye to, she sends
him to say it. She mirrors him at seventeen and the sister he never knew, and names neither; she has no theory
of the light, only the needle. Afterwards, in the Salt Harbour, Hesper takes the letter, or Tansy is home.

## Between worlds: the chime-pirates (built: src/ambush.js, src/minigames/pirates.js; docs/systems/minigames.md)

The dark between the worlds is not empty. Since the night the sky rang, chimes have been the one coin every
world takes, and a ship that lands on many worlds carries them: so the pirates wait on the lanes. The first time
the family ship flies to a world it has never been to, a crew of them comes after it from behind (the ship's voice:
"Ships closing from behind. Pirates! They are after your chimes!"): rust-red skiffs, teal raiders, a hauler with a
grab claw laying mines, and their captain's galleon under cream solar sails, who hails on an open channel ("Heave to,
little ship! Every chime aboard, and we part friends."). Beaten, they break off; left too long, the galleon goes
off into the dark ("The dark is wide, and we are patient."). They take nothing either way: the fight is the flight,
and the ship lands where it was going. Later flights to a world already known are quiet. Never on the way home, nor
to the Lantern.

## The detours' traces (built: src/story/sightings-detours.js, each world's content)

The twelve worlds off the route each hold one trace of the singing light or of whoever came this way
before: a person who remembers, a mark, a fragment. They hint and never answer (nobody names anyone;
the reveal belongs to the finale), and each is written down in the Sketchbook's Sightings the first
time it is told (`sight.<id>`; the route's own sightings are listed in src/story/sightings.js).

| World | Trace | Thread |
|---|---|---|
| The White Mangrove | Liss, who poles the boats, once taught a woman who came down alone, in a ship no bigger than a boat, to draw the mark on the great tree's roots; she drew it on her knee until her hand knew it | before |
| The Glass Dunes | The mark fused into the sand from above in a skin of new glass, by the west camp; the camp leaves the sand round it untouched | glyph |
| The City Behind the Waterfall | Aldo: the night the falls went quiet and a light hung singing off the balcony, as if waiting for an answer | light |
| The Salt Harbour | The harbour book (Hesper): the line before yours is in home letters, a woman who came alone; "…where the singing goes. If anyone from home…"; the salt has eaten her name | before |
| The Forest of Antennas | Grete: her grandmother's dish caught a man's voice ("…older when you hear it…"), and under the hiss something singing his words back, as if learning them | signal |
| The Underwater City (on the route since v1.40) | Coralie: a woman from up top listened all night to the whales; one sang something she knew, and she hummed it back | before |
| The City During the Eclipse | Ansel: the light hung singing where the black sun sits; by morning every figure on the walls leaned the way it went | light |
| The Fallen Ring | The makers' sign burned fresh into the tilted piece's foot, by a hand that learned it: the arc wavers and starts again | glyph |
| The Moon Foundry | Bertil cast the mark on a plate for a lone woman's ship's nose; she drew it in soot like a new word: "So they'll know me" | before |
| The Underside | Maudie: a woman wintered alone and played a man's voice every night, always stopping it before the end | signal |
| The City Floating in Space (on the route since v1.40) | Tamar: a ship with no name, one pilot alone, hailed with a sung note; the night the sky rang the same note passed again, fast and high, going somewhere | light |
| The Overnight Train | The mark chalked on the last carriage's roof, drawn again over old chalk many times by someone who keeps it (Solange, the night mail: she found it there, nearly gone, the night she boarded) | glyph |

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
City-Shaft: *looking up*; Vael: *quiet*; the Glass Dunes: *time*;
the Buried Machine: *patience*; Viridel: *garden*; the spheres: *remember*;
Lorn: *rain*; the Signal Market: *listening*; the Underwater City: *deep*; the
Moon Foundry: *finish*; the City Floating in Space: *drift*). The merged worlds'
second stories have recordings of their own, after the world's (v1.43,
`PART_CALLS`): when Vael II's bell has rung he asks for *bell* (the father,
twenty years ago: "Ring the bell once. Once is plenty."); when Lorn II's lamps
are lit, for *lamp* (the mother's lamp in the window, eight years ago), then
*why*, the Hangar's old word ("Why did you start it? The boat, the radio…",
eleven years ago, when he was fifteen), and answers it with Hollin's forty years
of lamps. The ship finds
one match and plays it: the parents rise over the projector on the dash as a
hologram, as they were when they made it, and the traveller stands facing them.
The recording fits loosely, sometimes oddly (after the desert's water he gets
his father on the dry well nobody came to help him dig; he asks for patience and hears "one
tooth at a time, your grandfather said"). It never answers him. His own lines
are short: a hope that it fits ("He means the water. He must."), later an
answer the recording cannot hear (he says the names of the people he met
when his mother asks "who did you meet today?"; he holds the keepsake up to
the light, where they would see it).

**The recordings are old, and it shows a little more each time** (keyed to n,
the recordings heard, whatever the order of the worlds; numbered as
`src/story/calls.js` numbers them: the prologue's is recording 0, `AGE[1..5]`
follow, and the last is n = `ENDING_WORLDS`):
0. The prologue: "Good morning. You have one new message." (the voicemail
   button blinks on the dash). The father, years after he left: "We haven't
   heard from you for so long." He misses him ("Your mother still lays your
   place at the table"), is still disappointed in him ("You leave everything
   half done"), and gives the charge again: "Bring back *something of value*.
   Until then, don't come home." The player takes it for a call from home.
   Under it the singing light's theme comes nearer; he pauses the recording to
   listen, the light passes the ship and drains it, and the hologram goes with
   the power.
1. The first one after a world (after the desert): no date; the father alone,
   bitter, about people who were supposed to help him and didn't (the Orrins
   swore they would help him dig out the dry well; he waited all morning with
   three spades; "Everyone means to help, until the morning comes"). No line of
   the traveller's own in it, not even a thought (author, issue #90: the player
   does the reflecting, after a world whose giants left).
2. The father mentions things that cannot be now (exams, the fence, the Orrin
   boy). The screen shows a worn date stamp.
3. The mother joins. A child's voice behind them: "Is that for me?" It is the
   traveller's. The ship: "Logged nineteen years ago." (He was seven.)
4. An old one made for him at ten, the summer he was at his grandfather's:
   "Report, then. Like a pilot." The tape is wearing: a word is lost. "When you
   are older you will understand." The traveller: "I know what it says. I just
   want to hear it." Logged sixteen years ago.
5. The mother has found his old drawings: "The little one sat with me and
   looked at every one. She has your hands, love." (Lou, his daughter, on the
   hill a year and a half by then; the reel never names her.) At the end: "Your
   father says I shouldn't make these. He says you never listen to them. I think
   one day you will." Logged four years ago.
6. (After `ENDING_WORLDS` worlds) the last recording on the reel: both of them.
   The father, just before "Come home.": "The little one puts you in all her
   drawings. Somewhere at the edge, waving." The ship: "That was the last recording on the reel. Logged two
   years ago, eleven days before the house went quiet." Home is on the map.

Before that, a few recordings answer what happened in a way the traveller
cannot explain (each once, flags `calls.beat.<id>`): the father warning him
off "anything singing out there" (after the singing light); the harbour bell
behind them (after Vael II's bell); "ships go dark out there, it happens"
(after Odile and Talo's ship); "if you break something out there, you say
sorry, and you mean it, and then you go" (after the tea terraces in Viridel, the
quest that fails); the three dots he drew on the landing ring
as a boy (after the glyph); a bird's promise in a child's story; the lamp the
mother leaves in the round window. The keepsake kinds still matter: whichever
he brings, the recording happens to hold what his father once said about such
things (a song: "nobody ever fuelled a ship with a song"; words: "you always
have words, show me something"), and once he has heard about Ilen, what the
father said later, sorrier.

**Ilen.** The Signal Market's broadcast is the father's voice, years younger,
to a child called Ilen. Afterwards the traveller asks the reel for the name
(`calls.ilen.asked`). There is one recording, in the mother's voice, labelled
"For when he asks." He is not ready: "Not here. Not yet." Once he has stepped
out of the ship or the ship has flown on, it is waiting (`calls.ilen`, `calls.ilen.told`): she made it knowing
he would hear the broadcast one day. Ilen was his elder sister, grown and gone
before he was born, sent out with the same words; she never came home; the
father sent that message after her every night for a year; the last thing that
came back from her ship was a sound like singing. "He isn't asking you for
something of value. He never was." After that the next recording he finds is
the father saying it himself: "I said the same words to you at the port that I
said to her."

**After the first homecoming** the ship's log waits (the light over the hill, its
trace; "singing" finds the father at the window, three years ago), and the
reel's oldest side ends by pointing back out. **After the true ending** it plays
its oldest side, from when he was small; they are happier, and he sometimes
answers them.

## The ending (built: src/story/ending.js, src/ship/homecoming.js, src/levels/home.js, src/story/home.js, src/levels/lantern.js)
It comes in two parts: the **first homecoming** after six worlds (everything
below up to the reel; then the light comes over the hill, he keeps the reel and
promises Lou "once more", and there is no end card), and the **true ending**
after the Lantern (Ilen beside him, the reel and its oldest recording, the end
card, the credits). docs/systems/story.md, "Two homecomings", has the rules.

After `ENDING_WORLDS` (6) worlds, the last recording asks the traveller home
and the galactic map shows **Home** at its centre, where the route begins ("A
small round house on a small round hill, and two moons over it. Nobody lives in
the round house now; there is a stone in its yard. Across the yard, a smaller
house with its lamp lit."). Choosing it flies there. Out of the jump the ship
reads out the hold: every keepsake and every one of the makers' small gifts
(the charms, the lenses, the star; not the backpack and its wings and jets,
which he wears) goes down with him.

**Home.** Two houses on the hill. The parents' **round house** (a cream dome,
the round window, the mast the recorder sent through) is dark, dusty and still:
the father's chair turned to the window, his cap on the arm and, down the side
of the cushion, a child's drawings; the mother's scarf on the stand by the door;
the photo of the two of them with him at seven; the recorder, its spindle bare;
her lamp under the window, its wick black. Its door sticks ("Push, then lift").
Across the yard, **the small house**, the one he and his father started the
summer he was fifteen and he left half done; Aunt Tove finished it. It is warm
and lit, the door open: **Lou**, his daughter (seven and a half; he left her
with Tove at two, at night, and did not knock on his parents' door), **Aunt
Tove** (the mother's younger sister) and **Moustache**, the dog, live there.
Lou's drawings of every world he wrote to her from are on the wall, a copy of
every keepsake on her shelf. Between them, the garden (the yellow flowers were
the mother's favourite), a bench, a washing line, Lou's swing in the umbrella
tree, her bunting from chimney to mast.

**At the stone.** The ship lands on the ring at dusk: the lamp in the round
window is dark, the door is shut. Lou runs down the path from the small house
("You came! Tove! He came!"), the dog at her heels, and walks with him to the
**stone** in the front yard, a round-topped headstone over a low slab with two
rings carved on it, overlapping like the two moons; she stands at his left. He
sets the tokens on the slab one by one, each with a short line of what it was
("Teo's walking rhythm. You can hum it now without thinking."; for words, the
words). If he knows about Ilen: "And this space is for Ilen, wherever she is."
If Esk's hill came down in Viridel (the quest that fails): "And Esk's hill, in
the garden, which I could not mend. I said sorry, and I meant it, and then I
went." "It isn't what you asked for. It's what I have." Lou props her drawing
against the stone (the round house, the two of them, and the two of you, holding
hands; it stays there). *(The first homecoming stops here: he takes out the reel, and the singing light
comes in low over the valley, dips over the round house, turns, and climbs away
out along the route. Lou: "The singing star! Grandpa used to stand at the window
for it." He keeps the reel; she makes him promise on the stone, hand flat:
once more, then he stays. "Not home yet. Not all the way.")*

**At the true ending**, with Ilen at the stone's right-hand end: "Mum. Dad. It's
Ilen. I heard you." What is new goes down; she sets down the message that
reached her; she answers what he chose (Dov's token, Hollin's promise, Esk's
hill); Lou: "I left a space at the edge of my drawing." Last he sets the reel down, and it plays by itself the
one recording he never searched for, the oldest: the parents young, a small
child between them waving at the recorder. "You don't have to bring us
anything. We are proud of you already. Look at him. Look at his hands." He says
goodbye. Lou: "Was that you? The little one, waving?" "That was me." The closing
line ("Something of value. You brought it home on your own two feet."), an end
card, then the credits: the worlds and their people, "At home" (the bird if she
promised, the parents on the hill, Lou, Aunt Tove and Moustache in the small
house, Ilen if told), and what he left on the stone (every world on the route, its
parts' people and its sub-levels': the Overnight Train's are the Signal Market's,
`peopleOf`). Flags: `ending.done`;
`ending.keepsake` is `all` (saves that chose one keepsake before keep theirs).

**The choices the stone remembers.** Three, across the route: Dov's lift token
(the City-Shaft: keep it, or press it back into his hand so he goes home to the
bottom himself); the promise to Hollin (Lorn II: it costs the coming back, and
after the Lantern he can tell him where Odile and Talo went); Esk's hill
(Viridel: the quest that fails, whatever you do). The traveller names each at the
first homecoming; Ilen answers each at the Lantern and again at the stone.

**Coming back.** The game goes on; the stone keeps its tokens, the reel plays
its oldest side. Lou runs to meet him once a visit and asks what he brought (her
answer follows how many keepsakes, and the newest world he wrote from); Tove is
on the garden bench; the dog follows him. He can walk into both houses. At the
stone he can **pay his respects**: kneel, lay a flower picked in the garden, or
set down what he has found since; a quiet line, a word to them, and he rises.

**The makers' temples (built).** A temple in every world, with a guardian and a
gadget at its heart; half the makers' gifts wait inside them, half in the open
(LORE.md, section 11, "Temples"). Nothing at home depends on them.

## Local names (as built)
| World | The glyph | The singing light | The makers' boxes |
|---|---|---|---|
| Desert | the mark between the giant's eyes; the Givers' mark (the keepers) | the singing light that turned (Oum); the chest hummed back to it all night (Nour) | the Givers' chest (Nour, Hessa) |
| Vael | the bird's track (Oïa) | heard in the stones (Senn) | a square with a star, drawn in the sand (Oïa, who hardly speaks: three words) |
| Vael II | the Three Notes (Calix) | the bell hummed by itself for it | a bell-chest: it hummed back too (Calix) |
| Hangar (dismissed) | the maker's rivets (Ottla), the Major's thumbprint (Clemence) | seen through the ring's slit (Lune); three machines stopped that night | "for the next one": the Major found it and never opened it (Ottla) |
| Buried Machine | the Maker's Thumb | the Tuning Star (Hask, Dun) | thumb-boxes (Wen) |
| Viridel | the Builders' mark (Oro) | the Singer (Talo's word, Sol) | Builders' gifts (Oro) |
| Garden of Spheres | the Footprint, under every sphere (Emrys) | an Answerer (Ume) | left-behinds (Emrys) |
| Lorn | the Hush: three drops of rain over a shut mouth | Sedge saw it pass the night it went over, and climb away; the crystal's 213th phrase is its song | the sky-egg (Wendel) |
| Lorn II | the Welcome: three lamps over a hull | Robin saw it put the pools out | the traveller's chest (Hollin, the lamp-keeper) |
| City-Shaft | the palace seal (rim), the Three Who Look Up (bottom) | it passed over the shaft and the Lodestar rang back; it left "toward the deserts" | lost property (rim), a promise (bottom; Ossa) |
| Signal Market | the First Sign (Sel), the tuning mark (Ferro) | the unsent recording "came in singing" (Kip) | (no box of its own) |

Built details beyond the bible: the bird's promise (`bird.promise`) could later
let her answer a whistle in other worlds; Vael II's clapper "fell up"; the
clock-winder from the glass country (Wim's teacher: the Glass Dunes come just
before the Buried Machine) once came down to see where the slow time comes from,
and wrote "FOUND IT. NOW WHAT?" and a clock face with one hand on a single tooth
on the drum wall (it was the Hangar's Major until the Hangar left the route);
Odile and Talo left Viridel in the saucer for the deep wood, the way the light
went; it brought them down again over the wood; they waited a season in Lorn II, then
went down into the swamp in Fen's skiff to ask the Great Crystal, and went on
(where, nobody knows; the skiff stayed in the swamp and comes to anyone who
whistles: the one you ride in Lorn); each sphere remembers the last sound it heard before it came down
out of the sky (the white builders found the spheres and the pyramids already
there and copied both, and the mark).

More built details: the Great Crystal adds a crystal-violet band to the tank,
and Wendel gives a second keepsake ("The patient are never eaten"). Hollin has
kept the deep wood's lamps for 40 years, and the keepers' light between the
swamp and the wood; the water-way he lights runs on south to Lorn's landing. The City-Shaft's rule: a light
nobody looks at goes out. The Signal Market's rule: the first thing anyone ever
sold there was an answer.

**Ilen, found** (the Lantern, above): the light was her answer; she comes home.

**The thread as it was: Ilen.** The Signal Market's broadcast is the father, years
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
too. At the stone, the traveller leaves a space for her among the tokens.

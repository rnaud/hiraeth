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
on the giants' bones, on the Incal's facets, on the Major's machine, on the
android ruins of Edena and on the oldest market sign. Locals each have a
different name and story for it. Nobody knows what struck the ship; in each
world one person has seen "a falling light that sang" around the same time.

**The colours**: the backpack fluid starts two-tone (cyan and violet). Each
world that has a "source" (desert water, Perdide crystal, the bazaar's lantern
sun, the buried machine's oil-light) can add a colour band. By the end the
tank holds the colours of every world: the tool itself becomes a record of the
journey.

**Calls home** (src/story/calls.js) track the arc. The father starts warm and
exacting, and grows terser when keepsakes are quiet ones. The mother joins from
the third call and asks different questions ("Who did you meet?"). The last
call depends on the player's choice.

## World by world

### 1. The Desert — "The Tree That Drinks"
- **Local story**: Once a year the old city's burning tree "drinks": water
  rises from beneath the giants and the fire burns cool and many-coloured.
  Pilgrims cross the dunes in procession to see it. This year the water has
  not risen.
- **Place**: the old city of **Qanat** (230, 400), built round the burning tree,
  with pilgrims' camps outside its main gate (168, 292). Its sacred well is dry.
- **People**: Ama, keeper of the camp fires; Teo, a drummer who lost his drum;
  Sefa (oud) and Bako (ney), the camp musicians; the Speaker who leads the
  procession; a child, Ilo, who wants to see the cave; old Oum, the pilgrim who
  fell behind; Hessa, keeper of the dry well; Marrow, a salvager.
- **Main quest**: find power for the ship → camps → procession → old city →
  out of the back gate to the fallen giant's skull (318, 530), whose open mouth
  is a doorway → the cave of shifting water in the giant's chest, where the
  tree's roots hang into the pool. The
  water is low because a giant's bone has fallen across the channel. Pushing
  it clear (fluid push) lets the water rise; the tree drinks; the vessel filled
  at the pool powers the ship.
- **Keepsakes**: *knowing*: "What the giants left" (main quest); *song*: "Teo's
  walking rhythm" (his drum, found under the ribcage); *thing*: Oum's knotted
  cord (walk her back to the fire and she tells the rumour of the singing
  light).
- **Lore**: the giants carried the water from the swamp of lights and lay down
  where they could go no further; the water pooled in their hearts. The tree
  grows from this giant's heart and Qanat was built round it.
- **Clue**: the Speaker says the giants "came down from the swamp of lights"
  → Perdide. Someone saw a singing light fall the night the ship crashed.

### 2. The City-Shaft (incal) — "The Light Nobody Looks At"
- **Local story**: The Incal turns above the palace; the upper city calls it a
  tourist story, the lower levels pray to it. A sweeper on the high terraces
  says it has been dimming since "the night the sky rang".
- **Quests**: deliver a ration from the lower levels to the palace guard (who
  is from the lower levels himself); find the taxi driver who still stops for
  the poor; carry a message up the shaft.
- **Keepsake**: *word*: the sweeper's "Look up once a day."
- **Clue**: an Incal splinter carries the glyph and hums like Perdide's crystal.

### 3. Arzach — "The Waiting Bird"
- **Local story**: The bird waits for a rider who left the lone tower long ago.
  Nobody speaks much. The world is silent by choice.
- **Quests**: find three feathers the bird has shed across the spires; ring
  the stone hand's knuckles in the right order; reach the tower window.
- **Keepsake**: *person*: the bird lets you ride, and will come if called
  from any world with sky (a promise, not an item).
- **Clue**: the tower's room has a map of the sky stones → Arzach II.

### 4. Arzach II — "The Bell Under the Cloud"
- **Local story**: The monastery bell has not rung since the cloud rose; the
  monks believe the stones fell *up* when the bell stopped. Ring it and the
  cloud will settle.
- **Quests**: retrieve the clapper from the floating island; carry a monk's
  letter across the aqueduct to the plain; balance the cairn stones.
- **Keepsake**: *song*: the bell's single note, which plays from the tank
  when you shoot afterwards.
- **Clue**: the tower on the plain holds the same masked face as the desert's
  sleeping head → the giants were here too.

### 5. The Airtight Garage — "The Major Forgot"
- **Local story**: Major Grubert built this pocket universe and forgot why.
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

### 7. Edena — "The Garden Grows Over"
- **Local story**: Stel and Atan's ship fell here; the gardeners let the
  garden take it. They believe nothing that falls should be dug up again.
- **Quests**: find the crashed ship; return a pyramid seed to the gardener;
  climb the tallest tree.
- **Keepsake**: *word*: "We tend the garden. The garden tends us."
- **Clue**: Stel and Atan's ship was struck by the same singing light → the
  traveller's ship wasn't the first.

### 8. The Garden of Spheres — "What the Spheres Remember"
- **Local story**: The spheres came down long ago; each "remembers" one
  sound. The round plaza's pole hums when the great sphere is on the horizon.
- **Quests**: listen at three spheres (stand still nearby); carry a lake
  reflection (a mirrored pebble) to the plaza; walk the avenue slowly.
- **Keepsake**: *song*: the chord the three spheres make together.
- **Clue**: one sphere's sound is the desert's procession drum.

### 9. Perdide — "The Great Crystal"
- **Local story**: The crystal sings in the rain and the carnivorous plants
  fall silent. The swamp people say it is a piece of something that fell.
- **Quests**: feed nothing to the plants (a test of patience); bring a crystal
  splinter to the cave; follow the fireflies.
- **Keepsake**: *thing*: a crystal splinter that harmonises with the tank.
- **Clue**: the crystal's song matches the "singing light" → it is a fragment
  of whatever struck the ship.

### 10. Perdide II — "The Lamps Are Kept"
- **Local story**: In the deep wood people keep the pools lit for travellers
  who never come. You are the first in a long time.
- **Quests**: relight three dark pools (shoot them); return the moss-dome
  latch; find the skiff's owner.
- **Keepsake**: *person*: the lamp-keeper asks you to come back one day.
- **Clue**: the saucer half-sunk in the pool is Stel and Atan's escape pod
  → Edena.

### 11. The Signal Market — "You Are Not Alone"
- **Local story**: A thousand signs speak; one tower is silent. The market
  believes the silent tower was the only one that told the truth.
- **Quests**: deliver the unsent recording; tune the antenna; restart the
  broadcast. The broadcast, once restarted, is the father's voice, a recording
  from long ago, sent to someone else's child.
- **Keepsake**: *word*: the broadcast's message.
- **Clue**: the broadcast was sent from the traveller's home system.

## The ending (not built)
At the ship's cockpit after enough worlds, the player chooses one keepsake to
bring home. The father's reaction depends on its kind; the mother's does not.

## Local names (as built)
| World | The glyph | The singing light |
|---|---|---|
| Desert | the mark between the giant's eyes | the singing light that turned (Oum) |
| Arzach | the bird's track (Oïa) | heard in the stones (Senn) |
| Arzach II | the Three Notes (Calix) | the bell hummed by itself for it |
| Garage | the maker's rivets (Ottla), the Major's thumbprint (Malvina) | seen through the ring's slit (Lune); three machines stopped that night |
| Buried Machine | the Maker's Thumb | the Tuning Star (Hask, Dun) |
| Edena | the Builders' mark (Oro) | the Singer (Atan's word, Sol) |
| Garden of Spheres | the Footprint, under every sphere (Ivo) | an Answerer (Ume) |
| Perdide | the Hush: three drops of rain over a shut mouth | Sedge saw it fall the night before the crash; the crystal's 213th phrase is its song |
| Perdide II | the Welcome: three lamps over a hull | Wick saw it put the pools out |
| City-Shaft | the palace seal (rim), the Three Who Look Up (bottom) | it passed over the shaft and the Incal rang back; it left "toward the deserts" |
| Signal Market | the First Sign (Sel), the tuning mark (Ferro) | the unsent recording "came in singing" (Kip) |

Built details beyond the bible: the bird's promise (`bird.promise`) could later
let her answer a whistle in other worlds; Arzach II's clapper "fell up"; the
Major once visited the wheel and wrote "FOUND IT. NOW WHAT?" on the drum wall;
Stel and Atan left in the saucer for the deep wood where the lamps are kept;
each sphere remembers the last sound it heard before falling.

More built details: the Great Crystal adds a crystal-violet band to the tank,
and Wendel gives a second keepsake ("The patient are never eaten"). Hollin has
kept the deep wood's lamps for 41 years; Stel and Atan borrowed Fen's skiff and
left "the long way" through the root cave. The City-Shaft's rule: a light
nobody looks at goes out. The Signal Market's rule: the first thing anyone ever
sold there was an answer.

**Open thread: Ilen.** The Signal Market's broadcast is the father, years
younger, speaking to a child called Ilen, with the same words he said to his
own son. Sel offers two readings: he once had someone else to call home, or he
lent his voice to another family through the old relays. Later calls home, and
the mother, could pick this up.


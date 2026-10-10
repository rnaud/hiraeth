# Hiraeth: the story and the lore

> **Dialogue revision, 2026-10-05:** The current script and character voices
> are documented in [lore/README.md](lore/README.md). Quoted dialogue below
> generally predates that pass. See [continuity notes](lore/continuity.md) for
> the current desert opening and [plot review](lore/plot-review.md) for proposed
> future changes. The live story data governs current wording and quest flow.

A summary of everything the game says about its story, gathered from the
design docs (`docs/game-brief.md`, `docs/story-bible.md`) and from what is
actually built (`src/story/`, `src/levels/`, `src/ship/`, `src/boxes/`,
`src/items.js`). Where the docs and the build disagree, this file follows the
build and lists the difference under "Loose ends and contradictions" at the
end. Written to be edited: change anything, then carry it back into the data.

Contents
1. The premise
2. The traveller and the family
3. The recordings
4. The makers, the glyph and the singing light
5. The light's signature (why these worlds)
6. The worlds, in travel order
7. Home and the ending
8. Recurring motifs
9. Planned additions (from the author's backlog)
10. Loose ends and contradictions (and the decisions that settled the rest)
11. Temples (the makers' houses, their keepers, and the gifts inside)

---

## 1. The premise

"My son, make us proud. Bring back something of value."

A young traveller sets out in his father's old ship, a big round ball, to
bring back "something of value". Years out, in the cockpit, he plays a
message from his father ("We haven't heard from you for so long"); under it
something sings, nearer and nearer, and he pauses the recording to listen. A
singing light passes the ship, close, and drains its power as it goes; the ship
comes down on its last reserve in a desert, a hard landing, not a crash. He
chooses to follow the light. From there he walks, then flies, from world to world. Every world offers him
something impressive and something quieter, and he collects both as
**keepsakes**. Little by little the game lets him (and the player) find out
that the message was a recording, that every message he plays is old, and at
the very end that his parents are dead. The journey is a son trying to make
them proud after the fact, and learning what "something of value" meant.

The question the game asks: what counts as something of value? Its answer,
said in the father's own voice on a broadcast meant for someone else, and
again by the oldest recording at the grave: nothing out there is worth more
than you, walking back in through the door on your own two feet.

The loop: arrive, meet people, follow clues, explore and experiment, make a
discovery, go back to the ship, play a recording, choose the next world.

Tone: quiet, strange, warm; the world notices you (plants turn, screens wake,
people look up). Drawn in flat colours and fine ink lines.

## 2. The traveller and the family

**The traveller.** Unnamed; called "sky-stranger", "little star", "sky-child",
"sky-person" by the people he meets. About twenty-six (a recording logged
nineteen years ago is from "that day. I was seven"). He left home at
seventeen, after one fight too many, with his father's words at the port, and
did not come back while his parents were alive, except once: at night, five
years ago, to bring his daughter Lou to the small house across the yard, and he
did not knock on their door. He writes Lou a card from every world. He wears a **translator** at
his ear (from home): he hears each world's own tongue as a mumble and reads it
in his own words. His lines are short; in the recordings he answers people who
cannot hear him.

**The father.** Unnamed. Stern, terse, disappointed, with a dry humour that
shows in the oldest recordings. He asked both his children for "something of
value" and did not know how to ask for the other thing. He sent a message
after his daughter every night for a year. Late in life he stood at the window
and said he heard something singing.

**The mother.** Unnamed. Warm, curious ("Who did you meet today? Tell me one
person."), the one who keeps making recordings although the father says the
son never listens to them. She leaves the lamp on in the round window. She
made one recording on her own, "For when he asks", to tell him about Ilen.

**Ilen.** The traveller's elder sister, grown and gone before he was born: she
left about thirty years ago, some four years before his birth. She went out the
same way, sent off at the port with the same words. She never
came home and nobody found out why. The last thing that came back from her
ship was not a voice but a sound like singing. The father's nightly message
to her still travels the old relays; one of them, thirty years on the way,
reached the Signal Market the night the light passed (the light was carrying it
home, sung), and the traveller hears it there. **Found at the end**: a makers'
light brought her ship down at their lantern thirty years ago and it never flew
again; she kept the lantern (with Odile and Talo, then alone), and the singing
light was her answer (section 7). About fifty now; she comes home with him.

**Lou.** His daughter, seven and a half: lively, loud, curious, draws on
everything (the walls included). Born when he was nineteen, out at the port
towns, to **Maren**, a pilot on the long relay ships; they were young; Maren
went back out to the relays when Lou was one and sends a card at midwinter. At
two Lou came home to the hill with her father, who left her with Tove in the
small house and went back out. She knew her grandparents: the mother crossed
the yard every morning to do her hair; the father pretended he didn't watch
from the round window, and kept her drawings down the side of his chair. She
was five when the house went quiet. The reel has her twice, never by name ("the
little one"): the mother, four years ago, "She has your hands, love"; the father,
in the last recording, "The little one puts you in all her drawings. Somewhere at
the edge, waving." She does the flowers on their stone every
Sunday. She draws every world her father writes to her from and makes a copy of
every keepsake he tells her about, in clay and paper, for her shelf. She wants
to be a traveller, "the kind that comes back every Sunday".

**Aunt Tove.** The mother's younger sister. Brisk and kind; keeps the lamp by
the round house's door lit and the soup on. She moved into the small house to
raise Lou while the traveller travels. "Yes. And now you have. Both of those are
true, love."

**Moustache.** The dog: scruffy, medium-sized, sandy, with white whiskers under
his nose (Lou named him). He walked with the father at the end; now he walks
Lou to the stone and back, and follows whoever came home last.

**The parents' death.** Two years ago, within a season of each other. The
last recording ("Come home") was logged eleven days before the house went
quiet. Their stone stands in the front yard at home: a round-topped headstone
over a low slab, two rings carved on it, overlapping like the two moons, their
names under them.

**The ship.** The father's old ship: a big round ball with a bunk room, a
ring corridor, a galley (three stools), an entry hall and a cockpit with a
projector on the dash. His old flight cap is on the dash; the son's childhood
drawings are under the bunk ("the round ship, and the three of us, holding
hands"). The ship speaks in short, plain status lines.

**Home.** A small round house (a cream dome) on a small round hill, a round
window, an antenna the old recorder sent through, a tall umbrella tree (Lou's
swing hangs from it), a washing line, a landing ring, peach grass, lilac
mesas, two moons. Nobody lives in the round house now: it is dark, dusty and
still (the father's chair turned to the window, his cap on the arm; the
mother's scarf on the stand by the door; the photo of the two of them with him
at seven, scowling; the recorder with its spindle bare; her lamp under the
window, its wick black). Across the yard is **the small house**, the
traveller's own: he and his father started it the summer he was fifteen and
he left it half done ("You leave everything here half done"); Tove finished it.
Lou and Tove live there with the dog, the lamp lit, the door open: a kitchen
table covered in drawings, a hearth, two beds behind a curtain, Lou's shelf,
a window seat where she watched for a light coming down. Between the path and
the small house, their garden: three raised beds, a border of flowers (the
yellow ones are best; the mother liked the yellow ones), a bench, a picket
fence. Lou's bunting runs from the small house's chimney to the round house's
mast.

## 3. The recordings

There are no live calls. What the traveller has is **the reel**: the old
house recorder's spool, every message his parents ever left him on it over
twenty-odd years (reminders and scoldings, birthdays, nights he did not come
home, and the ones made after he had gone). Most are not happy with him.

**How they play** (`src/story/calls.js`, `src/ship/hologram.js`). After each
finished world one recording waits at the cockpit console. The traveller asks
the reel for a word that belongs to the world he has just left; the ship finds
one match; the parents rise over the projector as a hologram, as they were
when they made it. It fits loosely, never answers. He holds his newest
keepsake up to the projector "where they would see it", and the recording
happens to hold what his father once said about such things.

### The prologue recording (years after he left)
"Is it on? Right. There you are. We haven't heard from you for so long." "Your
mother still lays your place at the table. We miss you. Both of us." "And I'm
still disappointed in you. The boat, the school. You leave everything half
done." "My son, make us proud. Bring back *something of value*. Until then,
don't come home." "Keep the translator at your ear. Nobody out there talks
like—" and the traveller pauses it. The key phrase is lettered as itself on the
screen (gold, with the charge's ✦) here and wherever the story echoes it. Under
his words the singing light's theme (five notes, `src/story/light-theme.js`)
comes nearer each time, the makers' hum under the charge; in the pause it sings
alone, then the light passes the ship and the power goes with it: the light,
finding his voice on the reel. The player takes it for a call from home.

### What he asks the reel for, world by world
| World | Word | What the reel finds | What he makes of it |
|---|---|---|---|
| Desert | water | "Turn the tap off… Water doesn't come from nowhere, son. Somebody carries it." | Somebody carried it. The giants did. |
| City-Shaft | looking up | "Stop staring up at the lamps… mind the people at the top." | I looked up anyway. |
| Vael | quiet | "You never said much at the table either… I say you are sulking." | Nobody says much there. I liked it. |
| Vael II | bell | "Ring it once if you must. Once." | I rang it. The cloud came down. |
| Hangar | why | "You start things and you forget why. The boat. The radio." | So did the Major. He kept going anyway. |
| Buried Machine | patience | "One tooth at a time, your grandfather used to say." | One tooth at a time. |
| Viridel | garden | "Your mother's garden has grown over the old cart again." | They let the garden take the ships, there. |
| Spheres | remember | "Stones that remember sounds? Who told you that?" | One of them remembered a drum. |
| Lorn | rain | "Did you keep your boots dry, at least? No." | No. |
| Lorn II | lamp | "People who keep a light on for someone who never comes. That is not hope. That is a habit." | They keep the lamps lit there anyway. |
| Signal Market | listening | "You never listen… goes past you like weather." | I'm listening now. |

### How old they are (it shows a little more each time)
Keyed to how many recordings he has heard, whatever the order of the worlds.
Numbered as `calls.js` numbers them (and the story bible now too): the
prologue's recording is 0, then `AGE[1..5]`, then the last one at
`ENDING_WORLDS`.
1. The father alone, no date: "You didn't call back, so I am leaving this." "Keep looking, then. There is time."
2. The exams he missed; the Orrin boy came home with a reactor core; "mend the fence". He: the fence came down years ago. Screen: WORN.
3. The mother joins ("Is it recording? Oh. Hello, love."). A child's voice behind them: "Is that for me?" It is his. "I remember that day. I was seven." LOGGED 19 YEARS AGO.
4. An old one, made for him at ten, the summer he was sent to his grandfather's: "You have been at your grandfather's a week and we have not had one word." "Report, then. Like a pilot." The tape is worn; a few words go under the hiss: "…when you are older, you will understand why I…" "Keep it short. These spools cost." He: "I know what it says. I just want to hear it." LOGGED 16 YEARS AGO ("You were ten, and away for the summer").
5. The mother found his old drawings. "The little one sat with me and looked at every one. She has your hands, love." (Lou, three and a half, on the hill a year and a half; never named on the reel.) "Your father says I shouldn't make these. He says you never listen to them. I think one day you will." He: "I am." LOGGED 4 YEARS AGO.
6. (After six worlds) **The last recording on the reel.** Both of them. "I have been thinking about what I asked of you. Something of value. I never said what." The father: "The little one puts you in all her drawings. Somewhere at the edge, waving." "Come home." "Bring whatever you have. Or nothing at all. Just come." Ship: "Logged two years ago, eleven days before the house went quiet." Home appears on the map.
7. Afterwards: **the oldest side** of the reel, from when he was small and they were happier (a bird as big as the house; asleep in the cockpit chair under the father's cap; "I'm going to bring you back a star"; first day of school; fifth birthday).

From the third on the mother asks "Who did you meet today?" and he answers with
the names of people he met in that world. She cannot hear him.

### What the father once said about each kind of keepsake
Thing: "Now that is the kind of thing I mean. Something you can hold." Song:
"Nobody ever fuelled a ship with a song." Word: "Words. You always have words.
Show me something." Person: "Friends make promises. They are easy to make."
Knowing: "So you understand how it works. Then build it. Show me." He gets
terser as the quiet keepsakes outnumber the things. Once the truth about Ilen
is told, the recordings he finds are the sorrier ones ("Hum it for me some
time"; "Someone who wants you back. I understand that better than you think").

### Things the reel cannot have known (each once)
- **The singing light** (after two worlds' witnesses): "If you ever hear something singing out there, you turn the ship around." Later the mother: "Your father stood at the window last night a long time. He said he heard something singing."
- **Ships that go dark** (after Odile and Talo's ship): "Ships go dark out there. It happens."
- **The glyph** (after the Buried Machine or Lorn): "You have drawn those three dots on the landing ring again. Over an arc." He: "I drew that before I knew what it was."
- **The bell** (after Vael II): the harbour bell behind them, rung when a ship comes in.
- **The bird** (after Vael): "A bird made you a promise? You and your stories."
- **The lamps** (after Lorn II): the mother has left the lamp on in the round window.
- **Things** / **quiet**: two things he can hold ("Now we are getting somewhere"), or a whole year with nothing to show.
- **Something broken** (after the tea terraces in Viridel, the quest that fails): "And if you break something out there, and you will, you say sorry, and you mean it, and then you go. Standing about in their yard looking at it mends nothing." The mother: "Did they forgive you, love? People mostly do, if you let them." He: "Esk did. I don't think I have, yet." And Viridel's own recording (the garden that grew over the cart: "She says leave it. I say it is a cart") gets a different answer from him: "I didn't leave things be. I opened their gate."

### Ilen
After the Signal Market he asks the reel for the name. Nothing in the father's
voice; one recording in the mother's, labelled "For when he asks". He is not
ready ("Not here. Not yet."). Once the ship has flown on, it waits: Ilen was
his sister; she never came home; the father sent that message every night for
a year; the last thing back from her ship was a sound like singing; "He isn't
asking you for something of value. He never was. He just doesn't know how to
ask for the other thing." Logged six years ago. The next recording he finds is
the father: "I said the same words to you at the port that I said to your
sister. I heard myself say them. I could not stop."

## 4. The makers, the glyph and the singing light

### The makers
Nobody has seen one. They made the giants walk (the giants carried their water
across the worlds and lay down where they could go no further; the water pooled
in their hearts). They marked everything they made with the glyph. They left
gifts for travellers who would come a long way after them, in chests that open
only for "one who fell from the sky", "someone who has come further than the
bell can be heard". Each world has its own name for them:

| World | The makers | Their chest | The glyph |
|---|---|---|---|
| Desert | the Givers | the Givers' chest (Nour) | the Givers' mark; the Eye That Fell; "the bird" (children) |
| City-Shaft | (not named) | lost property (palace); a promise (bottom, Ossa) | the palace seal (rim); the Three Who Look Up (bottom) |
| Vael | "nobody knows who walked here first" | a square with a star, drawn in the sand (Oïa) | the bird's track |
| Vael II | the founders | a bell-chest (Calix) | the Three Notes |
| Hangar | (the Major found the mark, never its makers) | "for the next one" (the Major) | the maker's rivets; the Major's thumbprint |
| Buried Machine | the Maker | thumb-boxes (Wen) | the Maker's Thumb |
| Viridel | the Builders: the gardeners credit the white builders (androids), who in fact found the pyramids and the spheres already there and copied them, and the mark | Builders' gifts (Oro) | the Builders' mark ("a signature, or an apology"; copied from under the spheres, Oro thinks) |
| Spheres | something that walked through the sky putting spheres down | left-behinds, presents (Emrys, Ume): the one here is up on the grove's umbrella tree | the Footprint (under every sphere, and round the chest's sides) |
| Lorn | (not named) | the sky-egg (Wendel) | the Hush: three drops of rain over a shut mouth |
| Lorn II | (not named) | the traveller's chest (Hollin) | the Welcome: three lamps over a hull |
| Signal Market | (not named; "here before the market") | no chest | the First Sign; the tuning mark; three listeners and the edge of the world (Brush) |

**The chests.** Knee-high, dark blue paint crazed with age, corners worn
round, a frieze of glyph rings, a pale four-point star on the lid (the makers'
sign for a traveller: "a small light, a long way from home"). They hum when you
come near. They stand where the giants walked: shrines, high places, ledges,
never in the open by chance. Locals have sat beside them for generations and
never seen one open.

**Their gifts** (`src/items.js`, `src/boxes/placements.js`), half in the
open and half in the temples (§11 has why):
- *In the open*: the **magic-fluid backpack** (desert, the tree's ledge in Qanat: shoot, push, boost; it powers vehicles; it comes out of its chest empty and first fills at the giant's pool), the **pale star** (desert, a roof inside Qanat's gate: worn on the hood, does nothing, looks very good), the **soft-fall soles** (City-Shaft, the makers' pillar on the rim), the **hush-cloth** (Vael, the cap of the needle spire north of the landing), the **wind-silk scarf** (Vael II, the top of the balanced stack), the **brass level** (Hangar, the keep's south wall), the **climber's resin** (Buried Machine, the chimney stack's ring), the **seed pouch** (Viridel, an umbrella tree's top canopy), the **listening shell** (Spheres, the grove's umbrella canopy), the **breathing reed** (Lorn, the mossy rise among the creatures) and the **glow-moss pin** (Lorn II, the first root arch). The Signal Market has no chest in the open.
- *In the temples* (each one's key): **ember mode** (the Givers' House: a fire that hurts nobody), the **fluid jets** (the Warden's Well), the **fluid wings** (the Aerie), the **bell-note whistle** (the Founders' Belfry: a little whistle of blue-glazed clay shaped like a bell, not bone: the rider's whistle in Vael's tower is the bone one; one clear bell note, the same in every world; nearby chests answer), the **quick coil** (the First Garage: faster refill), the **fourth chamber** (the Engine-House: four charges), **bloom mode** (the Builders' Greenhouse: the makers' plants grow), the **glyph lens** (the Footprint: shows unopened chests from afar, and what is hidden), the **stilling mode** (the Hush-House: freezes for a few seconds), the **lantern charm** (the Lamp-House: never goes out) and the **echo shell** (the Undertower: keeps a note and plays it back).

**The tank's colours.** The tank comes out of the desert's chest empty; the
giant's pool fills it with cyan and violet and the pool's own coral at once.
Later sources add bands: Buried Machine's oil-light (amber), the Great
Crystal's violet, the market's lantern. By the end the tank is a record of the journey.

### The glyph
Three dots over an arc that bows upward (∩), never a smile. Scorched into the
ship's hull where the singing light brushed past it. It recurs on the reactive scenery's three apertures,
the giants' brows, the Lodestar's lower facets, the Major's machines, the
android ruins, the bell, the great wheel, the Great Crystal's root stone, the
oldest market sign. As a boy the traveller drew it on the landing ring at home
before he knew what it was.

### The singing light
What passed the ship and drained it (it never touched it but for the scorch).
Every world has a witness (usually several): a light
that came over low and slow, singing like a wet finger round the rim of a
glass; something answered it (the chest, the Lodestar, the stones, the bell,
the wheel, the pole, the crystal, the antenna); then **it turned**, "like it
was looking for something", and **climbed away**, trailing the signature. It
never fell: it dipped low (behind the desert's dunes, over Lorn II's pools) and
climbed again.

**One night everywhere.** Every world saw it pass on the same night: the night
before it found the traveller's ship. In the desert, where the ship came down the
next morning, people say "the night before you came down"; everywhere
else, "the night the light passed" or the local name ("the night the sky
rang"), and the traveller says "that was the night it passed my ship". No
witness dates it from the traveller's arrival (no "three nights ago").
How one light crossed worlds a journey apart in one night is not explained; it
is part of what it is. Local names: the singing light
(desert), the night the sky rang (City-Shaft, Lorn II, market), the Tuning
Star (Buried Machine), the Singer (Viridel, Talo's word), an Answerer
(Spheres). It brought down Odile and Talo's ship before his, forty-odd years ago, and
then their saucer too, over Lorn II's deep wood, when they went looking for it.
The Great Crystal on Lorn is a piece of the same light, fallen long ago (that
piece fell; the light itself never has). Ilen's ship sent back a
sound like singing. What it is, and why it turns, is never said.

The questions the game asks (was it a makers' thing too, "whatever brought you
down knew their sign", Nour? Did the chests open for Ilen?) are answered at the end,
at the Lantern (section 7): yes, and yes. It is a makers' light, and the one
that passed the ship was Ilen's answer to the father's broadcast. (They drink
what a ship runs on as they pass, Ilen says; it was never trying to bring him
down. And he followed it of his own accord: "A light can't make anyone do that.") The other
sightings stay as they were: the lights are older than her (Odile and Talo were
brought in by one forty-odd years ago); how one crossed worlds a journey apart in
one night is still part of what it is.

## 5. The light's signature (why these worlds)

*Built in this pass (`src/story/signature.js`).*

The singing light left more than a scorch where it brushed the hull: **the scar is
magnetised**, and its field beats slowly in threes, like the glyph's three
dots. The ship's instruments read that beat. **The galactic map charts only the
worlds whose own field carries the same signature**: the worlds the singing
light passed through. From each world the traveller finishes, the ship reads the
trace a little further on, which is why the worlds open one or two at a time.
Home does not carry it: the ship knows that way by heart. Following it is the
traveller's own choice, said as he steps out.

Where it shows in the game:
- **After the landing**, as the emergency power comes on: "Emergency power online. Whatever passed us drained the core and left a magnetic signature on the hull. I can track its pulse." He: "Then track it. When we can fly, we follow it. I want to hear it again."
- **The first time the map opens with power**: "These worlds carry the same magnetic signature as our scar. You asked me to follow the singing light: it went this way."
- **On the map**: a small glyph badge on every signature world; in the panel, "SIGNATURE · (reading) · matches the scar", and once visited, where it is strongest; a dashed box beside the chart explains it.
- **When a world is finished**: "New on the ship's map: X. The ship reads the light's signature there too."
- **Out of the jump, the first time at each world**: "The singing light's signature, here too. Strongest (place)."

The readings, world by world (editable in `SIGNATURE_WORLDS`):
| World | Reading from orbit | Strongest |
|---|---|---|
| Desert | in the scar itself | under the great tree |
| City-Shaft | strong, and ringing | at the Lodestar, over the palace |
| Vael | faint, very steady | among the humming standing stones |
| Vael II | faint, on one low note | at the bell on the rose cliff |
| Hangar | folded in on itself | at the slit in the ring |
| Buried Machine | slow, one beat a year | down at the great wheel |
| Viridel | old, overgrown | at a fallen ship in the south meadow |
| Spheres | many small echoes | over the round plaza |
| Lorn | the strongest yet | at the Great Crystal |
| Lorn II | faint, under water | at a saucer in the deep pool |
| Signal Market | on one channel only | at the silent tower |

The locals notice it in their own words: Marrow's compass in the desert points
at the ship instead of north; Wren's cab compass in the City-Shaft spun for an
hour that night and twitches near the ship; Lune says every compass in the
Hangar's ring points where the light turned, and so does the ship's scar; Saba
at the Great Crystal says the crystal pulls the same way as the hull ("That is
how your ship found us, I think"); Ferro's antenna dish in the market still
swings toward where it went, and toward the ship. (The City-Shaft's Lodestar
already carries the idea in its name; Lio's nine hundred cabs all lost their
compasses at once.)

Ideas not built, for the author: Ilen's ship's "sound like singing" could carry
the same signature (the ship could notice it in the mother's recording); the
Lodestar, a lodestone, could be the reason the light came to the City-Shaft at
all.

## 6. The worlds, in travel order

The route (`ORDER`): the desert is always known; then the next two unfinished
worlds, so there is always a choice of two; finishing one charts the next. Home
opens after six worlds. The order: the desert; Vael and Vael II (the fluid wings
and the winds come first; Vael II is charted only once Vael is done, for its
bird); Lorn and Lorn II; Viridel; then, in the later half, the City-Shaft (the
fluid jets), the Sealed Hangar and the Buried Machine (the worlds that want the
jets), the Garden of Spheres and the Signal Market. The sections below are
numbered by that route (they keep the order they were written in). Each world: its people (one line each), its main
quest, its side quests, its chest and keepsakes, and how it ties into the arc.

### 1. The Desert: "The Tree That Drinks"
Dunes, mesas, salt flats and the skeletons of giants. The old city of **Qanat**
is built round a great tree that grows from a fallen giant's heart. Its fire is
the living water it drinks, burning: once a year the water rises from beneath
the giants, the tree drinks, and the fire burns cool and many-coloured for the
drinking while pilgrims process round the walls; the rest of the year it burns
warm, and it had burned since before there was a city round it. This year the
water has not risen (a rib of the giant has fallen across the channel under the
city), and the night the singing light went over, the tree's fire went out
"like a lamp in a draught". When the traveller comes down the next morning it
stands over the walls black and cold: no flame, no smoke, no light at night,
only a slow bell. The giant's skull lies outside the back gate, its mouth a door
to the cave in its chest. Far out in the red rocks to the south-east, on a
hilltop, stands **the Givers' Hearth**, where the Givers kept their fire.

Why the tree needs a spark: living water does not burn by itself. The Givers lit
the tree once, long ago, with a stone carried from their hearth, the
**spark-stone**, and the keepers put it back in the Hearth afterwards; the tree
had never gone out since, so nobody living had needed it. Nothing else lights
living water: Ama's torches, the camp fires and the tank's own fire (ember mode,
the Givers' House) only hiss on the wet bark (and before the water rises, the
wood itself never burned: only the water in it ever did).

People:
- **Nour**, the eldest of Qanat: has kept the makers' chest company for sixty years; tells the old words, the Givers, the star, the empty tank, and her grandmother's story of the spark-stone.
- **Hessa**, keeper of the dry well, Nour's granddaughter: tired, practical; knows the glyph's local names; calls out when the well fills.
- **Ama**, keeper of the camp fires: "Nobody goes thirsty at my fires"; gives the jar; took a torch to the cold tree herself.
- **The Speaker**, who leads the procession: keeps the old words; "Where the giant's eyes are marked, its mouth is a door" and, once the water is up, "The fire was carried, and the fire must be carried"; calls you "little star".
- **Teo**, a drummer who lost his drum (the wind rolled it away "like a wheel").
- **Sefa** (oud) and **Bako** (ney), the camp musicians: Sefa plays "what the listener is missing"; Bako saw the burn on the ship.
- **Ilo**, a child who wants to see the cave: "Do you have a mother?"
- **Oum**, the pilgrim who fell behind: saw the light sing, and turn, and the tree go dark under it; "ask it why it turned".
- **Marrow**, salvager and liar: hid the hoverbike; has seen the glyph on things that fell before; his compass now points at your ship.
- Near the start: **Rima** the dune walker (the tree "burned every day of my life, until the night before your ball came down"), **Pell** the counter of bones ("Big things lie down and become places"), **Rook** who lost a bike, **Ennor** guide to the salt, **Dalia** who listens to stones, and a blue-cloaked **traveller** sketching the Sleeping Observatory.
- Qanat's people at the tree: Tamra the weaver, Idris the potter, Kito the boy, Lula the baker, Haro the guard, Mim the sweeper.

Main quest (`desert.power`), in order:
1. Walk to Qanat under its great dark tree (the camps and the procession wave you on).
2. Climb the buttress root to the makers' ledge; the chest opens: **the backpack, its tank
   empty** ("dry glass, not a drop"). The city gathers and Nour speaks ("Sixty years I guarded
   an empty jar"; "where the water is, it fills: find the water first").
3. Listen at the dry well; Ama's jar; walk with the Speaker ("its mouth is a door").
4. Out of the back gate into the giant's mouth, down to the dry pool. **The fallen rib** lies in
   the gutter, far too heavy for arms, and the empty tank pushes nothing. Beside the gutter
   stands a carved post with a notch worn in its top; **the old keepers' pole** (bone, two people
   long, shod in bronze, the mark burned into its grip) leans on the mural. Set it in the
   notch under the rib's flank and lean on it: three heaves, and the rib tips out over the rim
   and rolls clear. (An older save with a full tank can still push it.)
5. The water runs and the pool rises. Wading in, **the tank fills for the first time**, with
   cyan, violet and the coral of the giant's pool, and so does Ama's jar.
6. Back in Qanat, **the water climbs the roots into the well while you watch**, and the roots
   drink it. The tree stays cold.
7. Nour tells her grandmother's story: the spark-stone, the Givers' Hearth in the red rocks
   far to the south-east, "farther than walking", the keepers' marked stones on the way.
8. **Marrow's hoverbike** (the errand `desert.bike`): under the tarp in the hollow with the red
   rag; it runs on fluid, so it wakes only on a filled tank.
9. **The ride to the Givers' Hearth** (about 1.6 km from Qanat, a minute on the bike, more than
   four minutes' run), from marked stone to marked stone; the butte's tall chimney shows over
   the dunes, and at night a slit near its top glows: the stone's light, seeping up.
10. **The Hearth's puzzle**: a dark round hall. The stone breathes light behind a stone grille in
    a hollow up on the back wall's shelf; each breath washes the hall and lights old marks in
    the floor that lead round to a plinth. On it a stone ball sits in a groove, a bronze chain
    running from the hole at the groove's end up the wall and over to the grille. Hands can't
    move it; **a shove of fluid** rolls it down the groove into the hole, the chain runs, and the
    grille grinds up into the rock. Climb the shelf's plain face and take the stone: warm,
    light, breathing; it lights your way at your side.
11. **Home to the well**: set the stone in the water. It sinks; a spark climbs out of the well,
    up the outside of the trunk, into the crown, and the tree catches: the fire grows up out of
    the crown in the cool colours of the drinking, the smoke column climbs from it, the
    procession sings ("It burns!"), the bands play the feast. The water in Ama's jar catches
    the glow with it.
12. **Qanat repays him.** He put the tree right for the city's sake; because he did, the city
    chooses to help him in return. Nour: "You gave us back our light, child, and asked for
    nothing. Qanat pays its debts." A little after the tree catches, the ones with something to
    give go down to his ship and wait by the ramp; when he comes, they step up one by one and
    pour in what their houses can spare: Ama the camps' share of the Drinking, Idris the lamps of
    his street, Hessa the well's first water, Lula her oven's fire-water, Marrow a cell he was
    saving, and Nour last ("So Qanat gives your ship its own. Now go and follow yours."). The ship
    hums awake: "The galaxy is open." (`src/story/desert-repay.js`. Before the tree burns his jar
    alone won't take: the water lies still and dull in it, "nothing in it wants to burn".)

Side quests: Teo's drum (in the great ribcage, south: pinned against a rib by a
knuckle of spine; shove the knuckle from the side, by hand or with the fluid, and the drum rolls out like a
wheel); take Ilo to the skull; walk Oum back to the fires (her knotted cord);
Marrow's hoverbike (now part of the main way too); the masked head in the southern dunes (sand drifted over its
eyes like lids: wash both clear at once and it looks at you: it wants a filled tank); the Sleeping Observatory (three lenses, a roof that
opens on a constellation).

Keepsakes: *knowing* "What the giants left" (the cave's mural: the giants
carried the water; the tree drinks what they left); *song* "Teo's walking
rhythm". Chests: the backpack, the pale star (ember mode waits in the Givers' House, §11).

Ties: the giants "came down from the swamp of lights" (Lorn); the light was
seen the night before the ship came down, and the tree went out under it; the glyph is "the Givers' mark", "even you,
now, it seems". The stele by the well shows, behind the giants, a small figure carrying something round and bright: the
fire-bearer. Errands start here (a jar of singing sand for the City-Shaft).

**Decided in the rework (2026-10-05; change freely):**
- *What "the rubble" is*: the fallen rib in the gutter, the one obstacle on the way to the
  pool. Its fluid-free way is a lever (the keepers' pole over the carved post, three heaves),
  because the keepers "went down to clean the channel" and must have had a tool; a full tank
  (older saves) can still push it.
- *Where the tank fills*: the first wade in the risen pool (the same moment the jar fills).
  Every early step that wanted fluid was rerouted: the drum's knuckle is heaved by hand while
  the tank is empty; the bike, the masked head's eyes and the Givers' House wait for a filled
  tank (Sabri and a toast on entering the house say so); a press on an empty tank only
  sputters, and the HUD reads "empty".
- *The tank's colours*: it starts with nothing; the giant's pool fills it with cyan, violet and
  the pool's coral at once (the "starting" two tones and the desert's band arrive together).
- *The well fills itself, from below*, once the channel runs (the roots carry the water up):
  you go back and watch it rise. The jar is not poured into it.
- *Ember mode and the tree*: the Givers' House can be done before the tree is lit, but ember
  fire is the tank's own water set alight, and living water does not take it: only the spark
  it was first lit with. So ember mode lights braziers, brambles and lamps, never the tree.
- *The ship's power*: Qanat's gift, not the tree's by itself (October 2026, the third clarity
  item): the ship came down drained, and only the whole city, round its burning tree, ever held
  that much. Marrow says so at the ship ("burning or cold, Qanat doesn't hand its fire to
  strangers"), Nour promises it ("Do that, and Qanat will not let you leave in the dark"), and
  the city pays it once the tree burns (step 12), so the desert still can't be left cold.
- *The Hearth's place*: on a hilltop in the red rocks south-east of Qanat, about 1.6 km off
  (well past the scattered props' 1.5 km), chosen so its chimney shows over the dunes from the
  way; nine marked stones every 150 m from just past the procession's circuit.
- *Saves*: a save whose water had already risen (the channel open, the ship fed, the desert
  done) saw the tree burning and turning cool: it keeps it lit and skips the new errand. A
  save short of that finds the tree cold (the story explains it) and does the errand; its tank
  was never empty.
### 7. The City-Shaft: "The Light Nobody Looks At"
A city stacked down a 600 m pit: the rich on the sunny rim, the poor in the
depths over an acid lake, flying taxis between. The **Lodestar**, a light and
its dark twin, turns over the palace; the rim calls it a tourist story, the
bottom prays to it. It has faded a little every year for as long as Nima can
remember, and since "the night the sky rang" (when a splinter of it fell) it has
been going out. The rule here: a light nobody looks at goes out.

People:
- **Nima**, who sweeps the high terrace: has looked up once a day for forty years; Pell's cousin.
- **Ossa**, keeper of the Upward Shrine at the bottom: "Of course it's dimming"; gives the splinter and the bottom's message.
- **Pip**, a child at the bottom who has seen the sky once, for eleven seconds; Dov's nephew.
- **Dov**, guard at the palace gate, secretly from the bottom (minus two-nine-zero, stall nineteen); saw the glyph on the light itself.
- **Wren**, the old cab (it drives itself, as every cab does now, and speaks from the little screen on its dash) that still stops for anyone who lights the old lamp; its compass spun for an hour.
- **Corvin Sale**, of the rim, third generation: "A light show. A story for tourists."
- **Lio**, cab dispatcher: nine hundred cabs lost their compasses at once.
- **Tobin**, seller of views: "Up is free; I can't sell up."

Main quest (`incal.light`): Nima; down to Ossa and the splinter of the
Lodestar that fell into Behla's laundry; up to Dov at the palace gate; stand on
the palace and look up (the splinter flies home, the billboards read LOOK UP /
ONCE A DAY, the whole city looks up); tell Nima.

Side quests: carry Pip's ration up to Dov ("Dov's lift token"; first swing it in
from the old goods hoist over the void: shoot the rusted pin, push the weight
round the post); light Wren's
lamp (Wren comes when you hail in the depths); a cab pass from Lio (`incal.pass`:
the cabs stop for passes, not people; he writes one for the fare Tobin owes him,
which Tobin pays in one bent coin). Errand: a taxi token for Vael.

Keepsakes: *word* "Look up once a day"; *thing* "Dov's lift token". Chest: the
soft-fall soles on the makers' pillar (the fluid jets wait in the Warden's Well, §11).

Ties: the Lodestar rang back when the light passed and a piece came away; a
swamp trader once brought a crystal that sang the same note (Lorn); the light
went "toward the deserts".

### 2. Vael: "The Waiting Bird"
A silent, bone-white country of needle spires, arches, floating ruins and a
lone tower. A great bird waits, high over the haze, for a rider who left long
ago; she has not come down since, and comes only to the rider's call. Nobody
speaks much; the world is quiet by choice.

People:
- **Oïa**, who watches the tower: almost wordless ("Gone." "Her track." "Play."); draws in the sand, mimes the wind and the wings.
- **Tam**, a boy who copies you.
- **Senn**, who listens to stones: "They hum. Since the night the light went over."
- **Kesh**, who keeps the stone hand: "Alive, once. Rang, once." "Small to tall."
- **The bird**, unnamed; **the rider**, gone (a mural shows a small figure walking away along an aqueduct).

Main quest (`arzach.bird`): sit with Oïa; ride the wind up the tower's side on
the fluid wings (from the Aerie) to its balcony; climb to the window: on the
sill, the rider's little bone flute with a feather tied to it; through the
window, the rider's room and a map of the sky stones; play the flute (five
notes, her call) and the bird comes down for the first time, bows and
promises. Until then she is not seen and cannot be ridden.

Side quests: three feathers she shed the night the light went over; ring the
stone hand's knuckles small to tall (the third feather falls). Errand: a
feather for the Major (Kesh gives it with his hands and two words).

Keepsake: *person* "The bird's promise" (wherever there is sky, call, and she
will come). Chest: the hush-cloth on the needle spire (the fluid wings wait in the
Aerie, §11; the bell-note whistle went to Vael II).

Ties: the map in the tower points to Vael II; the stones answered the light.

### 3. Vael II: "The Bell Under the Cloud" (The Sky Stones)
Needles and balanced stones rise from a sea of cloud; cliff-top monasteries,
broken aqueducts, a floating island, a peach plain with a lone tower. The
monastery bell has not rung in thirty years; the monks believe its ringing kept
the world down, and that when it stopped everything loose fell *up*. The sky
stones themselves are older ("since my mother's day").

People:
- **Sister Aube**, hermit of the edge: "You came down out of the sky, then. That is almost as rude."
- **Brother Calix**, keeper of the silent bell: oils the yoke every morning; the bell hummed by itself the night the light went over.
- **Mother Ysolde**, who writes the letters she never sends to her sister.
- **Tiv**, a novice who balances stones: "Widest first. Always widest first."
- **Ondine**, who walked to the plain thirty years ago, Ysolde's sister: "Come home for supper."

Main quest (`arzach2.bell`): Aube; ride up to the monastery; Calix; fetch the
clapper from the floating island's church; ring the bell (the cloud sinks);
listen.

Side quests: carry Ysolde's letter across the long aqueduct to Ondine, who
answers with the tower's old signal lamp (light it, turn it notch by notch to
the carved bell facing the rose cliff, and a light answers from Ysolde's
window), and the sleeping face on the tower; the cairn that fell up. The
clapper lies under tiles that fell up with it (push them off).

Keepsake: *song* "The bell's note" (it sounds from the tank whenever you shoot).
Chest: the wind-silk scarf on the balanced stack (the bell-note whistle waits in the
Founders' Belfry, §11; the wings went to Vael).

Ties: the tower's face is the desert's sleeping head: the giants walked here
too. The bell recalls the harbour bell at home.

### 8. The Sealed Hangar: "The Major Forgot"
Major Brask's pocket universe: a plateau, an upside-down quarter, a ring where
gravity points outward, joined by portals. He built it, forgot why, and went
for a walk; his people keep the machines turning out of habit, passing a
ticking signal round the three zones that nobody can read.

People:
- **Ambroise**, clerk of the round: "Up is a matter of opinion." Has watched the board eleven years.
- **Ottla**, mechanic of everything: "It's not broken. It's thinking about whether to be broken." "Habit is a kind of love."
- **Lune**, who reads the signal at the ring's slit: saw the light go across and turn; three machines stopped that night.
- **Zazie**, a child who doesn't trust down.
- **Clemence**, who remembers the Major as "a man with a pencil and too many ideas".
- **Nikko**, who greases the gears; **Gaspard**, who walked round the ring and came back to his own older footprints.
- **Major Brask**, absent.

Main quest (`garage.signal`): Ambroise's tube; post it in the upside-down relay
(stamped with the glyph); Lune shines it through the slit (nine dots: "It's a
page number. Or a place."); the Major's note on his desk.

Side quests: restart three stopped machines; push Zazie's ball to where down stays
down. Errand: a brass gear for Viridel.

Keepsake: *knowing* "The Major's note" ("I built it to see what I would do with
it. I still don't know. That is the point."). On its back: a wheel half under
sand, "turns one tooth a year, go and see it turn". Chest: the brass level
on the keep's wall; the quick coil waits in the First Garage (§11): the Major found
it there, never opened it ("it's for the next one").

Ties: the note points to the Buried Machine; the Major copied the glyph from a
stone in his first garage "for luck, or for somebody".

### 9. The Buried Machine: "One Tooth a Year"
Pale dunes, domed huts, pipe elbows breaking the sand; below, rust canyons that
are the machine itself, and a great wheel that turns one tooth a year. The dome
people count their age in teeth. Overhead hangs an upside-down city, "the Other
Half".

People:
- **Wen**, who counts the teeth (forty-one teeth old): gives the keepsake.
- **Hask**, keeper of the Wick: has lit it for fifty-two Tooth Days and won't this year, afraid the Tuning Star "was looking for the wheel". (Id `hask.buried`: the City-Shaft's seller of views shared the name until October 2026 and is Tobin now.)
- **Dun**, who keeps the domes breathing: left his chimney key on the derrick hook the night the sky rang.
- **Jot**, nine teeth old.
- **Ket**, who listens to the walls: "I call it a signature." (Id `ossa.buried`: she was Ossa, as the City-Shaft's keeper of the shrine is, until October 2026.)
- **Tull**, who oils the oval doors and talks to the warm window; saw the Major.

Main quest (`buried.tooth`): Wen; Hask; down the sand ramp; through two oval
doors to the oculus; open the oil valve; light the Wick (an amber band for the
tank); watch the wheel turn; pick up the tooth it sheds; bring it to Wen ("You
were here the year it turned, so that one is yours").

Side quests: Dun's key (on a crane swung out over the drop: free the rusted
collar with a splash, then ratchet the jib in with pushes); read Ket's three
gauges; lay a hand on the warm window.
The Major's scratched numbers on the drum wall: "FOUND IT. NOW WHAT?"

Keepsake: *thing* "A rust gear tooth". Chest: the climber's resin on the chimney ring
(the fourth chamber waits in the Engine-House, §11; ember mode went to the desert).

Ties: the Maker's Thumb is on every plate; "someone signs their work, and
someone else signs their damage, with the same hand"; tell the wheel the Hangar
is still turning.

### 6. Viridel: "The Garden Grows Over"
A clean, colourful garden planet: giant umbrella trees, white step pyramids
grown from seeds, white android ruins, great pale spheres half sunk in the
meadow (they came down out of the sky; the white builders laid their garden out
round them). Odile and Talo's ship fell here forty years ago; the gardeners let
the garden take it. Nothing that falls should be dug up again.

People:
- **Mira**, who keeps the water clock: "A ball fell into the meadow and a person came out of it. That is twice in my life." Gives the keepsake.
- **Sol**, who followed Odile and Talo about as a boy: "Tea keeps."
- **Oro**, who grows pyramids; tells of the Builders.
- **Rue**, a child who wants the floating crown of the tallest tree.
- **Vey**, who has tended the ship's vines for forty years: "It fell. It belongs to the ground now."
- **Esk**, who keeps the tea terraces on the white builders' old steps above the dry hollow: every cup of tea in the garden comes from her hill.
- **Odile and Talo**, absent: their log and Talo's lookout note.

Main quest (`edena.garden`): Mira; the fallen ship in the south meadow; ask
Vey first; inside; play Odile's last log ("a light pacing us… singing… it's
coming about"); water the flowers on the flank; look at the scorch: the same
mark as yours, "not like it: the same"; tell Mira.

Side quests: Oro's pyramid seed; climb the tallest tree to Talo's lookout;
Mira's water clock (the Hangar's brass gear, fitted, then three quick splashes
to fill its leaking bowl); **water for the tea terraces, the quest that fails**
(below). Errand: a glass seed for Lorn.

Keepsake: *word* "Mira's words": "We tend the garden. The garden tends us."
Chest: the seed pouch on the umbrella tree's canopy (bloom mode waits in the
Builders' Greenhouse, §11; the lantern charm went to Lorn II).

Ties: the traveller's ship was not the first; Odile and Talo left in the little
round boat "to go and ask it", toward the deep wood on the far side of the swamp
of lights, the way the light went (Talo worked it out from the stars on the
tall tree). The deep wood's lamps were lit for them afterwards: Mira doesn't know
about the lamps.

#### The quest that fails: water for the tea terraces (`edena.terraces`)
*Built in this pass (`src/story/terraces.js`, the words in `edena-data.js`).*

**Why here.** Viridel is the one world whose people have a rule for what to do
when something goes wrong: nothing that falls should be dug up again; let it
rest and the garden makes something of it ("You dig it up, you put it back in
the world, and the world has to deal with it all over again", Vey). A failure
there is answered from inside the world's own belief, so the locals can blame
you and still accept it quietly, without melodrama. And the traveller's own
inheritance is the opposite rule ("So you understand how it works. Then build
it. Show me."): the one world where trying to fix things is the mistake is the
right place for the attempt to go wrong. It is mid-game (the seventh world),
and tea, the garden's small daily ritual (Mira's clock, Sol's "tea keeps", the
tea given to Odile and Talo), is the thing lost: something the whole garden
shares, not a life.

**How it plays.** Sol (asked where the tea comes from) or Esk herself starts
it. The spring under the top terrace dropped to a trickle the night the light
passed; the runnels silted up; the bushes are browning. (1) Clear three clods of
silt from the runnels with the fluid's push, top terrace first (a lower one
shoved early slumps back: the water has to have somewhere to go). Water runs,
a trickle. (2) Esk tells of the white builders' cistern above, shut behind its
gate since before anyone was born; "we don't open what isn't ours". Either
answer, she talks herself into it: "It isn't digging. It's a door." Open it
gently, *a little*: water the roots grown through its wheel so they let go
(shoot: asking, not cutting, like the vines on the ship), then *one turn* of
the wheel (push). (3) One notch, and the gate, shut a thousand years, tears
loose: the cistern comes out all at once; a white sheet of water takes the
middle of the terraces (the builders' walls, the rows of tea) down into the dry
hollow. Ten seconds, scripted; nothing the player does changes it, and it can't
be retried. (4) What is left, for good (`edena.terraces.flooded`): a raw mud
slope down the middle with a stream in it, broken white wall blocks, the gate's
slab and wheel in the mud, uprooted bushes, a muddy pond in the hollow, the
cistern nearly empty; the sides of the terraces held. (5) Esk, not looking at
you: "I said a little. I said one turn." If you say you only turned it once: "I
know. I watched you… And I asked you to. I know that too. I'm still angry with
you. I'm allowed to be both." You say sorry. "I know you are." Then what the
gardeners say about everything: "It's all right. It isn't, but it will be. It
fell; it belongs to the ground now… I never thought I'd have to say it about my
own hill. Go on, traveller. There's nothing here for you to mend. That's the
hard part, I know." The quest closes **failed** (`quests.fail`).

**Afterwards.** The sketchbook files it under its own heading, *Failed*, with a
crossed stamp and an earth-brown rule ("You opened the builders' gate a little,
as Esk asked, and the hill came down with the water. She said it was the
garden's now."). The father's charge card keeps it quietly, under what you
carry: *What you could not mend: Water for the Tea Terraces* (not a mark
against you; what happened). Each gardener says one word about it, once: Mira
("Some years that means letting a hill go"), Sol ("There's tea from last year.
Tea keeps."), Vey ("You put it back in the world, and the world had to deal
with it… and it is. Go and look at the mud in a month."); Esk's balloons go
quiet ("The sides held."). The next recording finds the father on breaking
things (section 3), and Viridel's own recording lands differently. It doesn't
touch the main quest or the route; at the stone the traveller names it (section 7).

### 10. The Garden of Spheres: "What the Spheres Remember"
Umbrella trees over white pyramids; giant pale spheres half sunk in the grass
and a mirror lake; an avenue to a round plaza with a humming pole. Each sphere
remembers one sound, the last it heard before it came down.

People:
- **Linnet**, the listener: explains the spheres. (`aube.spheres`; Vael II's Sister Aube keeps `aube`.)
- **Nell**, who looks into the lake: "Upside down is just another way up."
- **Emrys**, who climbs the white hill: has seen the Footprint under every sphere, and the blue box up on the grove's umbrella tree. (Id `ivo`: he was Ivo, as Lorn's firefly watcher is, until October 2026; Lorn's keeps the name, `ivo.perdide`.)
- **Cael**, who walks the avenue: "Walk slowly. It is that kind of road."
- **Ume**, who keeps the pole: saw an Answerer turn over the plaza; gives the keepsake.

Main quest (`spheres.listen`): Linnet; wake the three remembering spheres (a
glass bell, far voices, a walking drum); the plaza; play them on the pole; the
great sphere answers; tell Ume.

Side quests: carry the lake's reflection (a mirrored pebble) to the pole; walk
the avenue slowly.

Keepsake: *song* "The chord of the spheres". Chest: the listening shell on the grove's
canopy (the glyph lens waits in the Footprint, §11).

Ties: one sphere remembers the desert's procession drum ("Then you've walked
under where they flew").

### 4. Lorn: "The Great Crystal"
A twilight swamp of humming crystal forests, carnivorous plants and glowing eggs,
crossed by skiff. The Great Crystal sings in the rain and the plants fall
silent. It fell out of the sky long ago, singing, and stuck point-first in the
mud. It is a piece of the same light that passed the ship.

People:
- **Wendel**, egg-warden: thirty years keeping eggs warm, never having seen them hatch until the firefly quest; "The patient are never eaten."
- **Sedge**, reed-cutter, shy: saw the light pass over the reeds the night it passed everywhere, and the crystal sang back; then it climbed and was gone.
- **Saba**, the Listener: forty years at the crystal's foot, knows its 212 phrases; "The thing that passed you sang this? Then I think the crystal is a piece of it." Her first spring there, two strangers came across the swamp in a borrowed skiff and asked the crystal where the light had gone (Odile and Talo); they went on east, and the skiff came home on its own.
- **Ivo**, who watches the fireflies: "Everything goes home at dusk."
- **Corm**, who feeds the plants (Margit, Big Ollo): "The sky lost a tooth and it landed here."
- **Ysse**, keeper of the crystal cave: points to the lamp-keepers of the deep wood.

Main quest (`perdide.crystal`): Wendel; cross to the crystal; Saba; make it
sing (rain, or three splashes); it sings a 213th phrase, the light's song; take
the splinter it drops; hold it up at the cave's heart (a violet band for the
tank).

Side quests: feed nothing (stand in the snapping bed and wait); follow the
fireflies to their nest. Errand: a humming crystal for the desert's dune walker.

Keepsakes: *thing* "A singing splinter"; *word* "Wendel's saying". Chest: the
breathing reed, on the mossy rise among the creatures (Wendel's "sky-egg"); the
stilling mode waits in the Hush-House on the cave island (§11).

Ties: the strongest reading of the signature; Ysse sends you to Lorn II.

### 5. Lorn II: "The Lamps Are Kept" (The Deep Wood)
The far side of the swamp: giant pale mushrooms, dark trunks, a lit path of
pools to a root cave. For forty years the people have kept the pools lit
for travellers who never come. Three went dark the night the sky rang.

People:
- **Hollin**, keeper of the lamps: "you're the first who ever came… I don't know what to do with my hands."
- **Pim**, who lives in a moss dome ("Nobody built them; we found them").
- **Bram**, who minds the cave mouth.
- **Robin**, a young lamp-keeper: watched the pools go out under the light, "pop, pop, pop".
- **Fen**, who lives in the far dome: lent Odile and Talo his skiff, which came home without them.

Main quest (`perdide2.lamps`): Hollin; relight the three dark pools (they take
your colours); the saucer in the deep pool answers, three short, one long; look
inside (two couches, two names, a drawing of a garden of umbrella trees and
white pyramids); tell Hollin at the cave; he asks you to come back.

Side quests: Pim's moss-dome latch (back on, the door still sticks with moss:
wake the moss lamp over it, then push it shut; a moss lamp); find the skiff's
owner (Fen asks you to bring it home once: light his berth lamp and nudge the
empty skiff in).

Keepsake: *person* "Hollin's lamps" (a promise to come back, or not). Chest:
the glow-moss pin on the first root arch (the lantern charm waits in the
Lamp-House, §11; the fourth chamber went to the Buried Machine).

Ties: the saucer is Odile and Talo's ship's little round boat; it carries the
glyph scorch: the light found them again over the wood and brought them down a second
time. They waited a season for it to come back ("keep a light for us"), then
crossed the swamp in Fen's skiff toward the Great Crystal, to ask the piece of
the light that fell there; the skiff came back to the root cave on its own. The
drawing in the saucer is the garden they came from (Viridel, with the furrow
across its meadow), drawn so they wouldn't forget the way home. Where they went
after the crystal, nobody knows; Hollin likes to think they got home; Viridel
never saw them again. (The keepers' ids: `hollin.perdide2`, `pim.perdide2`;
Vael's stone hand is kept by Kesh.)

### 11. The Signal Market: "You Are Not Alone"
Coral towers, illustrated signs, a busy alien bazaar; a thousand signs speak,
one tower is silent. The market believes the silent tower was the only one
that told the truth. The first thing anyone ever sold here was an answer.

People:
- **Madame Sel**, who kept the silent tower for forty years: reads the recording's header (it came from your home port, the one on your ship's registry plate; thirty years on the way).
- **Kip**, courier of the skybridges: ran off with the last recording; "It hums against my back when I sleep."
- **Ferro**, who rigs the antenna: "Nobody has three hands and a long enough ladder."
- **Brush**, who repaints the signs: "A thousand signs. One brush."
- **Ummu**, one of the quiet ones, speaking through a screen: "YOU ARE LOUD. WE LIKE IT."
- **Doss**, who welcomes everyone; **Oyo**, who sells lanterns (they relit in a colour he has never sold, "a bruise when it's healing"; he kept one back, and pours its little sun into your tank: the market's colour band); **Teb**, cab tout.

Main quest (`bazaar.signal`): Sel; Kip's recording; tune the antenna (three
bulbs, quick); play it at the console: the father's voice, years younger, to a
child called Ilen ("Don't bring anything. Nothing out there is worth more than
you, walking back in through our door on your own two feet… you are not alone.
Someone is listening for you. I am. Every night, I am."); "It was your father's
voice. It was not your name."; Sel again: it came from your home system.

Side quests: wake the oldest sign (WE HEARD YOU); clear the crates for Ummu's
bowl.

Keepsakes: *word* "You are not alone"; *song* "The quiet ones' hum". No chest in
the open; the echo shell waits in the Undertower, under the silent tower (§11).

Ties: Ilen (the mother's recording follows); the signs end on COME HOME WHEN
READY.

### Errands between worlds
Small parcels carried from one world's person to another's: singing sand
(desert to the City-Shaft), a taxi token (City-Shaft to Vael), a feather (Vael
to the Hangar), a brass gear (Hangar to Viridel), a glass seed (Viridel to
Lorn), a humming crystal (Lorn to the desert).

## 7. Home and the ending

After any six worlds (of the eleven, in any order) the last recording asks him
home and, once it has played, the map shows **Home** at its centre (one rule for
the map, the charge card and the ending: `homeOpen`, `src/story/ending.js`): "A small round house on a small round hill, and two moons over
it. Nobody lives in the round house now; there is a stone in its yard. Across
the yard, a smaller house with its lamp lit."

Out of the jump, the ship reads out the hold: every keepsake and every one of
the makers' small gifts goes down with him (not the backpack, jets or wings: he
wears those). The ship lands on the ring by the house at dusk; the lamp in the
round window is dark; the door is shut. Lou runs down the path from the small
house ("You came! Tove! He came!"), the dog at her heels, waits for him on the
path and walks with him to the stone, where she stands at his left. He
sets the tokens on the slab one by one, each with a short line (a song: "You
can hum it now without thinking"; a word: the words; a person: "Someone out
there is waiting for you to come back"; the pale star: "a small light, a long
way from home"). "I brought everything." If he knows about Ilen: "And this
space is for Ilen, wherever she is." If Esk's hill came down in Viridel (the
quest that fails): "And Esk's hill, in the garden, which I could not mend. I said
sorry, and I meant it, and then I went." (his father's own advice, from the
reel). "It isn't what you asked for. It's what I have." Lou: "I brought something too. It's for them." She props her drawing
against the stone: the round house, the two of them, and the two of you,
holding hands. (It stays there.)

**The first homecoming stops there** (October 2026: the ending is in two parts,
so the credits come after the story's peak). He takes out the reel to set it
down, and the singing light comes in low over the valley, singing, dips over the
round house, turns the way every witness said it turns, and climbs away out
along the route. Lou: "The singing star! It comes over sometimes. Grandpa used
to stand at the window for it." He: "That's the light that passed my ship. I followed it all this way." He keeps the
reel ("Not yet. Not until you know what that was."). Lou: "You're going again."
"Once more. Then I'm staying." "Promise on the stone. Hand flat. That's how it
works here." "I promise." Closing line: "Not home yet. Not all the way." No end
card, no credits. On the ship the voicemail holds the receiver's log: the light
passed over home, its trace runs back out past the Signal Market; the reel's
match for "singing" is the father at the window, three years ago.

**The final chapter: the Lantern** (charted past the market once the first
homecoming is over and the broadcast heard). One small island in a still sea of
light; the makers' lantern on its crown; at its step, **Ilen**. She knows the
hull ("He let me paint the stripe on it when I was nine"), and speaks like home.
He tells her who he is, and that their parents are dead ("His message took
thirty to reach me, and I missed them by two"). What the light was: the makers'
lantern listens for anyone a long way from home and sends a light to bring them
in, not gently; one brought her in thirty years ago and her ship never flew
again (the top half of it is her house); when the father's broadcast finally
reached her she sang his own message into a light, put the makers' sign on it
(three dots over an arc, which Odile worked out means *we heard you*), and sent
it home. It sang over the round house, nobody called back ("A light can't
knock"), and it went looking for the voice that had called her: his voice, on
the reel, playing in the cockpit the morning it passed him (he had stopped the
reel to listen). It drained the ship in passing ("They drink what a ship runs on
as they pass"): "It wasn't trying to bring you down. It was trying to bring him
here." And: "You came after it, all this way. A light can't make anyone do that." Odile and Talo got to the
lantern first, long before her, kept it and her, and lie on the point. She asks
what he brought, hears what he chose (below), and comes home with him.

**The true ending.** Flying home with her plays the homecoming once more: the
cargo check lists her ("In the jump seat, his old cap in her lap"); at the stone
she says "Mum. Dad. It's Ilen. I heard you."; what is new goes down; she sets
down the recording that reached her ("Your message came the whole way, Dad");
she answers his choices; Lou left a space at the edge of her drawing. Then he
sets the reel down at last, and it plays by itself the one recording he never
searched for, the oldest: the parents young, a small child between them waving
at the recorder. "We are making this so you will have it. For when you are
big, and far away." "You don't have to bring us anything. Do you hear?
Nothing." "We are proud of you already. Look at him. Look at his hands."
"Goodbye, recorder." He: "Goodbye." Ilen: "I never saw you that small. I never saw you at all." He:
"You see me now." Lou: "Was that you? The little one, waving?" He: "That was me."

Closing line: "Something of value. Home, on your own two feet."
An end card, then the credits (SOMETHING OF VALUE): every world and its people
(those he never met drawn in pencil), "At home" (the bird, if she promised;
your mother and your father, on the hill; Lou, Aunt Tove and Moustache, in the
small house; and Ilen, who heard him, and answered, and came home), the Lantern
among the worlds, and what was left on the stone. The game goes on: the stone
keeps its tokens and the reel, the reel plays its oldest side, the lamp in the
round window is lit again, and Ilen lives in the round house.

**The choices the stone remembers.** Dov's lift token (the City-Shaft): keep it,
or press it back into his hand ("Eleven years I carried it so I wouldn't have to
decide"), and at the stone "Dov's lift token isn't here. I gave it back to him."
Hollin's promise (Lorn II): "A promise to come back costs the coming back"; kept
by going back to him after another world; Ilen sends him with the news of Odile
and Talo. Esk's hill (Viridel): the quest that fails. Each is named at the first
homecoming, answered by Ilen at the Lantern, and again by her at the stone.

**Visiting home** (after the ending, any time). Lou runs to meet him once a
visit and asks what he brought; her answer follows how much he has brought
(a few, a good many, lots, "the whole sky") and the newest world he wrote from
(her drawing of it). Tove is on the garden bench. The dog follows him
everywhere, barks at the bird and the scout drone, and likes to be petted. He
can walk into both houses: the small one is warm and lit, the round one dark
and still (its door sticks: "Push, then lift"), with its memories to look at.
At the stone he can **pay his respects**: he kneels, lays a flower he picked in
the garden (they stay on the stone), or sets down the keepsakes found since he
was last there, so the slab always holds everything he has brought home; a
quiet moment, a word to them ("Hello, you two."), and he rises. If Lou is near
she comes and stands beside him "and doesn't say anything at all, which is a first".

## 8. Recurring motifs

- **Three over an arc.** The glyph; the three dots he drew as a boy; three stools in the galley; three bulbs on the antenna; three spheres; three dark pools; three stopped machines; three charges in the tank; the signature's pulse in threes.
- **It turned.** The light always turns, "like it was looking for something". Oum: ask it why it turned.
- **Singing like a wet finger round a glass.** Every witness says it nearly the same way.
- **Answering.** The chest, the Lodestar, the stones, the bell, the wheel, the pole, the crystal, the antenna all answer the light. Recordings never answer him.
- **Lamps kept for someone.** Wren's call-lamp, Hollin's pools, the mother's lamp in the round window, the dark window at the end, the lantern charm that never goes out.
- **Looking up.** Nima's once a day; the Three Who Look Up; the giants lying face up to watch the sky.
- **Giants who carried water** and lay down where they could go no further; big things lie down and become places.
- **Something of value** vs. **on your own two feet**: the father's two phrases, one at the port, one on the relay, one at the grave.
- **Come home.** Ondine's letter ("Come home for supper"), the market's signs, the last recording.
- **Waiting.** The bird for her rider, the lamp-keepers for travellers, the Hangar for the Major, Sol's tea, the chests for the next one.
- **Habit as love.** Ottla; the father's "that is not hope, that is a habit".
- **Numbers that recur**: forty years (Nima, Sel, Saba, Vey, Hollin); thirty (the broadcast's age: Ilen left about thirty years ago); eleven (Dov's years away, Wren's dark lamp, Pip's seconds, Ambroise's years), forty-one (Wen's teeth).

## 9. Planned additions (from the author's backlog; not built)

- ~~A Makers' temple in every world, with a boss and a gadget at its heart~~: built, all eleven (section 11).
- ~~A quest you can fail, and failing it harms the locals~~: built, in Viridel (section 6, "The quest that fails"). It fails whatever you do; a quest you *can* fail by choice is still open.
- ~~Home gains a daughter and a dog~~: built (Lou, Aunt Tove and Moustache; §2, §7).
- **The holograms become coloured busts** (today the parents stand full length in teal light over the projector).

## 10. Loose ends and contradictions (and the decisions that settled the rest)

Each with where it is. Fixed earlier: the saucer's console said "STEL and
ATAN" (old names) and now says ODILE and TALO; Talo's lookout note was signed
"— A." and is now "— T.".

### Decided and fixed in this pass
- **The desert's tree starts cold (2026-10-05)**: the bible (`docs/story-bible.md`, "The Tree
  That Drinks") still has it burning from the start and the water alone making it drink and turn
  cool. The build now has it gone out the night the light passed, the backpack's tank empty
  until the giant's pool, the well filling from below, and a second errand for the
  spark-stone in the Givers' Hearth, reached on Marrow's hoverbike (section 6, the desert, has
  the order and the decisions). The bible is design history; this file follows the build.
- **When the light passed: one night everywhere**, the night the traveller's
  ship was struck. Witnesses say "the night the light passed" (or "the night
  the sky rang"); only the desert, where the ship came down the next morning,
  says "the night before your ball came down". Changed: Dalia (desert), Lune
  (Hangar: was "the night before you came"), Sol (Viridel), Ume and Emrys
  (Spheres: were "three nights ago"), Sedge and Corm (Lorn: were "the night
  before your ball came down / fell"), Hask (Buried Machine: dropped "the next
  night your ship came down"). The traveller says "that was the night my ship
  was struck" (Vael II, the Hangar).
- **It never fell: it climbed away**, trailing the signature. Changed: the
  desert's outro for Oum ("She saw the light go over, and turn, and climb
  away"), Ama ("saw a light go over"), the choice to Oum, the desert trader
  ("It didn't come down… it dipped low behind the dunes, like it was looking for
  something, and then it climbed away again"), Saba ("The other is still up
  there, singing, turning, looking"; "the singing light", not "the falling
  light"), and the story bible (Sedge, the desert's clue). Only the Great
  Crystal, a piece of it, ever fell.
- **Ilen's dates**: she left about thirty years ago, some four years before the
  traveller (about twenty-six) was born; the broadcast is "thirty years on the
  way" (Sel, Ferro, the crowd, Sel's balloon). Sel's own forty years at the
  tower stay forty.
- **The registry plate**: Sel now says the header's origin is "the same home
  port that's stamped on your ship's registry plate": a home-system mark, not
  the glyph.
- **"Something worth the trip"** in the broadcast is now "something of value",
  the father's words everywhere.
- **The restaged opening (2026-10-09, the author's story-clarity items)**: the
  prologue's recording is no longer from the day he left but from years after
  ("We haven't heard from you for so long"; he misses him, is still disappointed,
  and is not to come home without *something of value*, the key phrase, now
  lettered in gold wherever it is said). Nothing strikes the ship: the singing
  light's theme is heard over the message, he pauses it to listen, the light
  passes close and drains the ship, and it comes down on its reserve (a short
  skid, no fire, no smoke). He tells the ship to follow it. Changed with it:
  the ship's lines, the map's legend ("LIGHT SIGNATURE"), Marrow, Nour, Ama,
  Oum, the witnesses' "struck my ship" answers in every world (now drained or
  passed), the people book, the sightings, the Lantern's explanation, the
  homecoming's "That's the light that passed my ship". And Qanat repays him:
  the city fills his ship, not the tree's fire by itself (section 6, step 12).
- **Recording 4** is recast as an old recording made for him at ten, the summer
  he was at his grandfather's ("Report, then. Like a pilot."; the ship: "You
  were ten, and away for the summer"). **Numbering**: the story bible now
  numbers as `calls.js` does (the prologue's is 0, then 1..5, then the last at
  `ENDING_WORLDS`).
- **Odile and Talo, one story**: they left Viridel in their ship's saucer to go
  and ask the light, toward the deep wood the way it went; it found them over
  the wood and struck the saucer too (two strikes, both real; Viridel never
  knew of the second); they waited a season in Lorn II for it to come back
  ("keep a light for us"), then crossed the swamp in Fen's skiff toward the
  Great Crystal (Saba saw them, her first spring there); the skiff came home on
  its own to the root cave. The drawing in the saucer is Viridel, the garden
  they came from. Where they went next is not known. Changed: Mira (no longer
  "the deep wood where the lamps are kept": the lamps were lit for them
  afterwards), Hollin, Bram, Fen, the saucer's description, Saba's new lines.
- **Who made the spheres**: one story. The spheres came down out of the sky
  (put down by something that walked through the sky, the Spheres' people say:
  the makers); in Viridel the white builders (androids) found the spheres and
  the pyramids already there, laid their garden round the spheres and copied the
  mark from under them (Oro). The androids are not the makers.
- **The Atelier**: the claim is removed. It is a page off the route, reached
  only from the worlds list; nothing in the story mentions or unlocks it.
- **The Spheres' Footprint**: Emrys now points at what exists: the blue box up on
  the grove's umbrella tree, with Footprints round its sides.
- **The duplicate bone whistle**: the bell-note whistle is now blue-glazed clay,
  shaped like a bell; the rider's whistle is the only bone one. It stays in
  Vael (the note is the same in every world).
- **The glyph drawn as a smile**: the Hangar's board now lights ∩
  ([1,1,1, 0,1,0, 1,0,1]) and Ambroise likens it to "a doorway with three lamps
  lit over it"; Lorn II's Welcome stones bow upward.
- **Shared ids for people with the same name**: each now has an id of their own
  (`hask.buried`, `ossa.buried`, `pip.garage`, `lio.edena`, `hollin.perdide2`,
  `pim.perdide2`, `aube.spheres`, `ivo.perdide`; Clemence is `clemence`, was
  `malvina`). Names stay as they are. Old saves migrate once
  (`src/save-migrate.js`): a "met" carries over to the renamed person if the
  save has been to their world. The internal ids `stel` / `atan` in Viridel's
  log and Rue's node are now `odile` / `talo` / `bench`.
- **Directions**: Ossa's chest is "on top of the lone stone pillar" (was
  "behind the villas"); Hollin sends you to Robin "at the second dark pool, down
  the path past the glass dome"; Bram's far dome is "back toward the saucer's
  pool, this side of it".
- **Giver's / Givers'**: the plural everywhere ("the Givers' mark"); the
  bible's "star-chest" is gone.
- **The Major's note**: its back now has, in another pencil, "went. saw. came
  back." (Clemence says he went to see the wheel.)
- **A failable quest that harms locals**: built (Viridel's tea terraces,
  section 6). The recordings and the charge card both know of it.
- **A daughter and a dog at home** (decided while the author was away; change
  freely). The round house stays dark and empty ("Nobody lives in the round
  house now"); Lou (seven and a half, mother Maren, a relay pilot who went back
  out) lives in the small house across the yard with Aunt Tove (the mother's
  sister) and the dog, Moustache, while the traveller travels; he came back once,
  at night, to leave her there, and did not knock on his parents' door. She was
  on the hill the whole journey; he writes her a card from every world. She comes
  to the stone at the ending and leaves a drawing. (`src/story/home-data.js`,
  `src/story/ending.js` tombLines, `src/levels/home.js`.)
- **Lou on the reel**: the parents knew her three years, and two late
  recordings say so, understated and never by name ("the little one", so she is
  still first met at home): recording 5, logged four years ago, the mother after
  his old drawings, "The little one sat with me and looked at every one. She has
  your hands, love." (it answers the oldest recording at the stone: "Look at his
  hands"); the last recording, the father just before "Come home", "The little
  one puts you in all her drawings. Somewhere at the edge, waving." (her
  drawings on the wall, and the ones in his chair, have a small figure in a
  hood, waving). Tove at home now says "They knew her, you know. Not just about
  her." (`src/story/calls.js` AGE[5] and the last recording.)
- **The tea terraces at the stone**: if Esk's hill came down
  (`edena.terraces.flooded`), the traveller says at the stone, after the space
  for Ilen: "And Esk's hill, in the garden, which I could not mend. I said sorry,
  and I meant it, and then I went." (his father's advice from the reel, kept).
  (`tombLines(tokens, { broke })`.)
- **Home in the docs**: the story bible's ending and the game brief now describe
  home as built (the dark round house, the small lit house with Lou, Tove and
  Moustache, paying respects at the stone, the failed quest's line there). The
  brief's prologue "call" is now the recording, and its open questions are
  answered or pointed here. Both list the makers' temples as planned.
- **The bible's template**: "one witness per world" is now "at least one, often
  several"; "two side quests" is now "two or more"; Oum's knotted cord is an
  item (her thanks at the fire), not a keepsake, and she tells the rumour before
  the walk; Oïa "hardly speaks" (three words); the bazaar's lantern band is
  listed as planned, not built; the glyph's witnesses saw a singing light (not a
  falling one).
- **The words for the arc**: kept as they are. The docs and the ship say "arc";
  the locals say "three dots over a curve". The shape is ∩ everywhere.
- **Names that look alike**: were made unique in October 2026 (the second story
  pass, docs/story-audit.md): no two people share a name, and the near-misses went
  (Lorn II's young lamp-keeper is Robin, the Buried Machine's Wick is only a lamp;
  the Hangar's Gaspard, not Ferrol, beside the market's Ferro). Ids and flags kept.
- **How one light crossed worlds a journey apart in one night** is not
  explained, on purpose.
- **Home after six worlds, eleven on the route** (decided while the author was
  away): kept. Any six worlds, in any order, open the way home; the other five
  stay open, before home or after. The "last recording" is the last thing the
  parents recorded, not the last world: after it the reel turns over to its
  oldest side ("Home is on the map, whenever you are ready"). One rule now
  serves the map, the charge card and the ending (`homeOpen`,
  `src/story/ending.js`): six worlds done and the last recording heard
  (`calls.home`, or `calls.6` on older saves), or the ending already played.
  The charge card no longer says "Home is on the map" while that recording is
  still waiting at the console (it says a recording is waiting), counts on past
  six ("8 worlds done", not "6 of 6"), and reads "N of 6 worlds before home"
  until then. The worlds list's Home card now matches the map (the round house
  dark, the small house lit; it said "a lamp in the window… They are waiting").
- **The Signal Market's lantern band**: built, as the bible described. Oyo, who
  sold every relit lantern by morning, kept one back; ask him for it (with the
  tank on your back) and he pours its little sun into your hose: a sallow
  yellow-green band, "the colour of a bruise when it's healing"
  (`bazaar.tank.lantern`, `LANTERN_TONE`). The tank's five bands are now the
  two it starts with, the desert's water, the buried machine's oil-light, the
  Great Crystal and the market's lantern.
- **The Spheres' stillness timer**: removed. Listening by standing still was
  the first design (the bible still said "stand still nearby"); the game moved
  to splashing the spheres (Linnet: "give one a splash"), and the test already
  says standing does nothing. The timer and the ring that would have closed
  while you stood are gone; the bible now says "splash each with the fluid".
- **The Vael feather errand**: Kesh gives it the Vael way, with his hands and
  two words ("(…draws a ring in the air: a world hollow as a cup.) The
  Major."); asked again, he only draws the ring. Senn's thanks for the taxi
  token are a gesture and "A city." The test checks that Vael's errand lines say
  three words at most outside brackets.
- **Vael II's stones and the bell**: the sky stones and the floating island are
  older than the bell's silence ("since my mother's day", "long ago"). What the
  monks blame on the silent bell is the night the cloud rose, thirty years ago,
  when everything *loose* fell up (tiles, pebbles, a goat, the clapper). Aube
  now says "the bell kept the world down… everything loose fell up", and of the
  stones "long before the bell stopped, whatever the brothers say". Tiv, a
  child, could not have built his cairn thirty years ago: his stones fell up the
  night the light went over, when the bell hummed by itself.
- **The Lodestar and Nima**: both true. It has faded a little every year of
  Nima's life, as the city stopped looking up (Ossa's rule: a light nobody looks
  at goes out), and since the night the sky rang, when a splinter of it fell, it
  has been going out. Nima now says so; the bible and section 6 match.

### Still open
- **Wendel's eggs: the firefly quest resolves this.** The older design note
  proposed keeping them unhatched. The existing `perdide.fireflies` quest in
  `src/story/perdide-data.js` instead shows fireflies hatching at the nest;
  afterwards Wendel learns what he has been missing. His thirty years without
  seeing a hatch describe his experience, not an unchanging fact about the eggs.
  The Hush-House still flowers the swamp as its own, separate world change.
  The dialogue pass preserves both existing events.

### Planned additions that touch the existing story
- **Coloured busts** replace the full-length teal holograms (`src/ship/hologram.js`); the stone scene's hologram of "the three of them" over the stone would become busts too.
- ~~Makers' temples with bosses~~: built, in all eleven worlds (section 11). The
  reason that fits: every keeper was left to keep its house, and the keeping went
  wrong when the gift stopped, often the night the sky rang; the living ones are
  calmed, never hurt, and the machines are only stuck.

## 11. Temples (the makers' houses, their keepers, and the gifts inside)

*Built (`src/temples/`); decided while the author was away, change freely.
All eleven worlds have theirs: the desert, the City-Shaft, Vael, Vael II, the
Sealed Hangar, the Buried Machine, Viridel, the Garden of Spheres, Lorn, Lorn
II and the Signal Market (home has none: the makers never came there). Section
9's "A Makers' temple in every world" and the "Makers' temples with bosses" note
above are what this answers.*

### What a temple is
Each world has one great building of the makers, in that world's own
architecture and inked like everything else: the house where they kept what
they gave that world (its water, its breath, its light). Locals know the
outside and have their own name for it; almost nobody has been in. Inside it is
a Zelda-style dungeon: three to six rooms of puzzles built from the world's own
verbs (push, climb, ride, light, splash, fly), one of the makers' chests half-way
through, and at the heart the thing the makers left to keep the house.

**The keepers.** The makers were gentle, and so is everything they left. What
waits at the heart of a temple was put there to keep it, and the keeping went
wrong when the gift stopped (often the night the sky rang):
- an **organic guardian** has grown wild or afraid. It is never hurt: its
  meter is *calm*. You soothe it (light for one afraid of the dark, water for a
  thirsty one, the bell's note, a hand on its brow), and shoving it frightens it
  more. Calm, it lies down, and the house's gift comes back;
- a **robot sentinel** is broken: still walking its rounds, guarding nothing,
  its lamp gone red. Its meter is *damage*; you may break it, and the locals
  will say a machine is not wicked, only stuck.
Either kind fights the same way: it moves about its arena and attacks in a
loop, each attack telegraphed on the floor first (a disc, a fan or a lane that
fills in warning colours), then struck. A strike knocks you down (the ragdoll)
and takes a bite of the health bar, but never the last of it from a healthy
bar; only when you are already low does it knock you out, and then you wake at
the glyph stone outside the arena and the keeper is back where its current
phase began. After some attacks it is open for a moment (it pants, its vents
open): that is when soothing (or a shot) counts. Its meter shows at the top of
the screen while it is awake.

**The gadget is the key.** The chest half-way through holds one of the makers'
tools, and every room after it needs that tool: the doors, bridges and the
keeper's own fight cannot be done without it. A traveller who already carries
it (an old save, another way) finds the chest open and the doors answer.

**After.** Resolving the keeper changes the world outside, for good (a flag,
`temple.<world>.done`): water runs, fields grow, a shaft breathes. The local
who pointed you there says so, and their balloons change.

**Marks and falls.** Each room has a glyph stone (a mark): walk past it and it
is where you come back to. Fall into a chasm and you climb back to the last
mark; fall out of the temple altogether (it hangs far over the world) and the
same. No whistling the mount inside: it would come to the same spot on the
ground far below.

### Half in the temples, half in the open
The rule: **the makers kept their tools in their temples and left their small
gifts in the open.** A temple's chest holds an active tool (a gun mode, a way to
move, a way to call); the boxes in the open hold the passive gifts (charms,
upgrades, the star). The whole of it, eleven and eleven (`src/temples/index.js`
GADGETS; every row is built):

| World | In its temple (the key) | In the open | State |
|---|---|---|---|
| Desert | Ember mode (moved from the Buried Machine) | the backpack (the story's), the pale star | **built** |
| City-Shaft | Fluid jets (moved from the rim pillar) | Soft-fall soles (new, on the rim pillar) | **built** |
| Vael | Fluid wings (moved from Vael II's stack) | Hush-cloth (new: steps the wildlife doesn't hear; on the spire now) | **built** |
| Vael II | Bell-note whistle (moved from Vael's spire: it belongs to the bell world) | Wind-silk scarf (new, on the balanced stack now: the wings sink slower; it was to be an "updraft feather", renamed because Vael's feathers are the story's) | **built** |
| Hangar | Quick coil (moved from the keep's wall: the doors that want two tanks in one breath) | Brass level (new, on the keep's wall now: where down has turned, a little level shows how the floor lies) | **built** |
| Buried Machine | Fourth chamber (moved from Lorn II) | Climber's resin (new, on the chimney ring: climbing tires you half as fast) | **built** |
| Viridel | Bloom mode (new gun mode, leaf green and petal pink: seeds sprout, buds open, vines bridge and climb) | Seed pouch (new, on the umbrella tree's canopy now: flowers come up in your footsteps) | **built** |
| Spheres | Glyph lens | Listening shell (new, on the grove's canopy: the makers' unopened boxes near you hum back now and then) | **built** |
| Lorn | Stilling mode (moved from the mossy rise) | Breathing reed (new, on the mossy rise now: you hold your breath twice as long under water; it replaces the planned bog boots, since swimming came) | **built** |
| Lorn II | Lantern charm (moved from Viridel's canopy) | Glow-moss pin (new, on the first root arch: a soft light round your feet after dusk) | **built** |
| Signal Market | Echo shell (new: keeps the last note sung near you, plays it back) | (the market has no chest in the open) | **built** |

What moved for players already on their way: whoever owns ember mode, the jets,
the bell-note whistle, the fourth chamber, the glyph lens, the lantern charm,
the stilling mode, the fluid wings or the quick coil finds that temple's chest open and counted as found (`src/temples/migrate.js`;
bloom mode and the echo shell are new, so nobody has them yet);
the Buried Machine's chimney ring, the City-Shaft's pillar, Vael's spire, Lorn
II's first root arch, the Spheres' grove canopy, Viridel's umbrella canopy,
Lorn's mossy rise, Vael II's balanced stack and the Hangar's keep wall now hold the resin, the soles,
the hush-cloth, the glow-moss pin, the listening shell, the seed pouch, the
breathing reed, the wind-silk scarf and the brass level, new boxes for everyone (a save that opened the
keep wall's box when it held the coil finds a new one there). (This also settles a loose end of section 10: the bell-note
whistle is found in the bell world now, and Vael has only the rider's bone
whistle.)
Ember mode now comes in the first world, which suits it: the desert's camp
fires and dry brambles were always there to be lit. The City-Shaft is the one
world you can hardly cross without your temple's gadget: its quest starts as
you land, and the scout knows the way.

### The Givers' House (the Desert)
A great drum of rose stone, cornice, fins and a low pink dome, half sunk in the
high dunes east of Qanat (you see it from the walls); its door looks toward the
city. Qanat calls it the house of the Givers: the water once came from there,
down channels to the fields round the walls, until one year it stopped and the
fields went to sand.
- **The local: Sabri**, who digs wells (every one dry), at the camps' east
  edge. Her grandmother's stories: the Givers' house, the Keeper "who let the
  children ride on its shell to the fields", a lamp left lit for it in the
  fields because it hated the dark. Afterwards: the old channel runs, "I am
  going to dig a well that has water in it. Just to see what that's like."
- **Before the tree is lit**: the house wants the fluid from its first room (the push, the
  splash), so it waits for a filled tank (Sabri: "Nothing in the Givers' house will answer an
  empty jar"; walking in empty, a toast sends you to the giant's pool). Its ember mode does not
  light Qanat's tree: ember fire is the tank's own water set alight, and the tree's living water
  takes only the spark-stone's fire (section 6, the desert). The house's world change (the
  cistern, the channel to the city, the green fields) is its own, before or after the tree.
- **Inside** (rebuilt round one idea in v1.24: the Givers carried their fire): the Threshold (a stair hall, the
  first mark, the way out); the Hall of the Flame (the Givers' pilot flame, the one fire in the house that never went
  out, burns in the floor on a tar ball's groove: roll the ball through it and on into the hooded bowl by the door,
  which no ember reaches; a ball that burns out on the way rolls into the bowl cold and is tipped back); the Dry
  Channel (a sand pit; dry thorns choke the bridge's sockets at the end of a ball's groove, and the flame is behind
  the ball: back through it first, then into the thorns; a wall to climb to the gallery); the Chest Chamber (**ember
  mode** on a dais under the oculus; thorns choke the corridor on, and a tar ball by the dais runs through them to
  the Hall of Fires); the Hall of Fires (the hooded bowl on the near lip at the end of that ball's groove wakes the
  bridge); the Hall of Channels (the Givers' dry water-channels in its floor, and a long groove out to the bowl by
  the far door: lit at the start, the ball burns out short of it; the relay brazier beside the groove lights it
  again as it passes, and wakes the keepers' door back to the near ledge); the Cistern.
- **The Keeper of the cistern** (organic): a great pale beast of the Givers, a
  shell of bone plates on six long legs, a swan's neck and a long soft muzzle,
  its shell carved with glyphs that are dim and flickering while it is afraid.
  It stamps where you stand and sweeps the floor with its head; later it dives
  into the dry basin and bursts up under you. Calm it in three steps: light the
  four tall bronze braziers round the walls (it was afraid of the dark), splash water into
  its mouth each time it pants (it was thirsty), then lay a hand on its brow
  when it lies down by the dry spout. It turns to fire: a tar ball rolled in down one of the four spokes past a lit
  brazier makes it pant in the light, and at the last it will pant no other way (Sabri's grandmother's lamp, left
  lit in the fields for it).
- **After**: the stone under the spout sweats, the cistern fills with living
  water, a stream runs out of the house's door and down toward the city, green
  creepers climb the drum, and round Qanat six old fields come up green in
  rows, with channels of water between them.

### The Warden's Well (the City-Shaft)
The makers' tower on the rim, round from the ship: a stepped drum of cream
stone with steel-blue bands, tall slit windows and a dark blue crown ringed
with the glyph, like the makers' pillar. The rim calls it a folly; the bottom
says the makers built it to keep the shaft breathing: once a wind came up the
pit at night and carried the smog away. It stopped the night the sky rang, and
since then something walks round and round at the top. Inside it goes up, not
down: a well of the makers turned on its end.
- **The local: Vell**, who lights the rim's lamps, by the tower's forecourt.
  Afterwards: the wind came up the shaft, "warm, smelling of rain that never got
  down there"; the bottom folk stand along the parapet looking at the sky; she
  will light the lamp by the warden's door.
- **Inside** (reworked round one idea, v1.19: the tower breathes through its vanes; the breath turned the
  makers' bellows, the bellows turned its machines, and a vane still drives its machine only while it turns): the
  Threshold; the Turning Floors (two riding discs over a drop, riding only while the small vane over the far door
  spins: a splash, and go before it slows); the Climb (climb the block's face; the ball's groove crosses a slot whose
  stones stand only while the vane in the well's floor turns); the Jets' Chamber (**the fluid jets**; up through the
  oculus); the Lamp Gallery (an eye over the west shelf, hidden from the floor behind stone lids that lift only
  while the great vane in the floor turns, too heavy for a splash: hover over it on the jets and splash the eye;
  the iris in the ceiling opens); the loft (a ball on a high shelf, a gap in it whose stones stand only while the
  loft's great vane turns: hover over it and push the ball across from the air, and a second iris opens); the crown
  (the eye by the high door lifts its lids only while two vanes turn at once: the great one in the crown's floor, and
  a little one that stands on a post in the loft below, seen down through the second iris: splash it, then fly up to
  the great one and hover before the little one slows; v1.27); the Warden's Hall.
- **The warden** (robot): a tall machine of the makers on three legs, a ring
  of side vents and a lamp-eye. It beams along a lane, drops shots where you
  stand, and slams the floor round itself. After a beam its side vents open:
  shoot them. Halfway, it shuts its sides; only the hatch on its crown opens
  then, and only a shot from above it counts; it backs onto one of the four
  great vanes in the hall's floor, and over a turning vane the draught holds the
  hatch wide. In its last phase it keeps the hatch shut against still air:
  hover over its vane on the jets, and the draught lifts it. Broken, it sags and
  its eye goes dark.
- **After**: the shaft's breath comes back: beside the Upward Shrine a column
  of rising air (pale rings drifting up it) carries anyone who steps into it
  from the bottom terrace up past every level and sets them down on the rim.

### The Founders' Belfry (Vael II)
A round tower of bone-white stone rising straight out of the cloud west of the
starting plateau, a bridge from the plateau's rim to a gallery round its door,
an open belfry on top with a great bell in it and stones that fell up hanging
round it. The monks say the founders built it before the monastery to keep the
stones down: a bell in every room, and the stones stayed where they were put.
The bells stopped; the stones fell up; something in the top of the tower cries
every evening "like a bell with nothing to ring it".
- **The local: Agathe**, who keeps the founders' bridge (a quiet job: nobody
  crosses it). Afterwards: the stones coming down all over the sky, one on the
  monastery's kitchen roof ("Brother Calix laughed. I have never heard him
  laugh"); the Cloud-Mother swimming away over the cloud.
- **Inside**: the Threshold; the Hall of Stones (two stone balls in two
  grooves, both pushed onto their plates); the Stone Stair (a round well whose
  stair fell up: one great stone hangs at the top by the high door; a founders'
  bell low by the way in, its clapper a stone ball rolled into its mouth: while
  it rings the great stone comes down, and when it falls quiet the stone falls
  up again with whoever stands on it; v1.27); the Bell Chamber (**the
  bell-note whistle**, a silent bell hanging in the oculus that brings three
  stones down round the dais while it rings: nothing is locked by it); the Bell
  Porch (its door is held by the porch's own bell, open only while it rings);
  the Hall of Echoes (a chasm under the
  stones of its own bridge, hanging high where they fell up: sound the bell at
  its edge and they come down into place; a second bell door beyond, that only
  hears you close); the Cloud-Mother's Hall, open to the sky.
- **The Cloud-Mother** (organic): a great pale sky-whale, fins like sails, a
  fringe of cloud along her back, glyphs on her flanks dim while she is afraid.
  The founders kept her to carry the cloud away in the mornings; she rose with
  the stones and never came down. She gusts and dives, and later wails; each
  time she sinks low and cries, sound the bell near her (fluid only frightens
  her). Worn out, she lies on the floor of her hall: lay a hand on her brow.
- **After**: the stones that fell up come down all over Vael II, the floating
  stones settling onto what lies under them or into the cloud, and the stones
  round the belfry onto its gallery.

### The Engine-House (the Buried Machine)
A drum of rust-red iron as tall as the oculus, standing out of the dunes west
of the domes, banded in blue-grey, a ring window high on its face, pipe elbows
going into the sand round its foot, a teal cap; its oval door looks toward the
start hollow. The dome people say the wheel's engine is inside, and the machine
that minds it: it used to turn the wheel a tooth a day, not a tooth a year, and
the pipe-cart ran down the canyon to the oculus and back.
- **The local: Fisk**, who greases the Engine-House door every Tooth Day the
  way his father did ("A door wants grease anyway"). Afterwards: the pipe-cart
  lifting out of the sand "like it had been asleep"; Jot rode it nine times and
  says he is ten teeth old now, from the excitement.
- **Inside** (reworked round one idea, v1.19: a ball in the teeth stops the
  engine there; the Tooth-Warden jams the whole engine, and the makers' own
  jams are stone balls rolled into a crank's teeth): the Threshold; the Piston
  Hall (three pistons to the gantry: the valve's eye hisses, but a ball sits in
  their crank's teeth; roll it out and they ride, back in and they stop where
  they are); the Crank Hall (the engine's hammer slams down on a walkway over a
  pit: the gantry's ball rolled down its groove into the hammer's crank stops it
  at the top of its stroke); the Fourth Chamber (**the fourth chamber**; four
  still eyes on its wall wake together in one breath, and lock nothing); the
  Crank Passage (its door wants four eyes in one breath, standing on pistons that
  rise in turn behind a parapet, one crank for all four: jam it and all four
  stand up; v1.27); the Furnace
  (a chasm over embers; four eyes on pistons rising in turn behind the far
  parapet, a crank for each of the two west ones on the near lip: jam those two
  and catch the other two as they rise one after the other); the Tooth-Warden's
  Hall.
- **The Tooth-Warden** (robot): the makers' machine that minds the engine, on
  four legs, four vents round its drum, a lamp-eye; jammed since the night the
  sky rang. It beams, drops shots where you stand and slams; when all four vents
  open at once, hit all four inside a breath (two or three count for nothing).
  From its second phase it turns on the great gear in the floor (a ball in the
  gear's teeth, and a volley counts twice); in its last it stamps the ball out
  and opens turning, one vent at a time: jam the gear again and all four face
  out. Stopped, it locks up, every joint at once, and the engine catches and runs.
- **After**: the pipe-cart rides the canyon again, a round iron floor with a
  brass rail, from the start hollow down the sand ramp to the oculus and back,
  a pause at each end.

### The Footprint (the Garden of Spheres)
The one Emrys speaks of, which the garden never had until now (this settles that
loose end of section 10): north of the umbrella grove the meadow carries an
enormous three-toed print, its rim of white stone, as if the thing that walked
through the sky putting the spheres down had stepped here; its heel is a great
pale sphere, half sunk, with a round-headed door toward the grove.
- **The local: Tessa**, who walks the Footprint's rim once a day, toes and
  heel. She has heard the one note under the grass ("as if it had forgotten all
  the others"). Afterwards: the toes full of still water, "I saw myself in every
  toe"; the spheres humming together at dusk; "Linnet cried".
- **Inside** (rebuilt round one idea in v1.24: the lens shows where the walker set things down; what is real carries
  the walker's print, three toes like the Footprint itself): the Threshold; the Hall of Spheres (one white sphere in a
  groove past three carved prints of two, three and four toes, and three prints by the wall: the sphere set down on
  the walker's and you standing on the walker's; v1.27); the Still Pool (a sphere floating in it, which the stirring water draws back
  unless you stand on the stone that stills it: then it crosses to its berth, and stepping stones rise); the Lens
  Chamber (**the glyph lens**; through it, the walker's print on the wall and its prints over the floor); the Hall of
  the Unseen (a chasm, and a field of stepping stones only the lens shows, each with a print: only the walker's hold,
  the rest crumble; on the far landing a sphere's groove past two plain prints and the walker's, which only the lens
  shows, and an eye only the lens shows high on the near wall across the chasm); the keepers' gallery round to the
  Lens Chamber (its door opens from the far side); the Echo's Hall.
- **The Echo** (organic, after its fashion: a being of sound): what an Answerer
  left when it turned over the plaza the night the sky rang and went on. A pale
  heart inside three turning rings of glass, a veil under it; it sings one loud
  lost note. Each time it sings, one of the three resonant spheres round its hall
  glows with that note: splash that sphere (the wrong one makes it flinch;
  fluid on the Echo itself passes through its light). Through the lens the sphere that answers wears the walker's
  print; at the last it sings three notes at once, all three glow, and only the print tells. Calm, it sinks to the
  floor humming: hold out your hand to it.
- **After**: the Footprint's toes fill with still water, and every sphere in
  the garden wears a ring of the glyph's light at its foot, breathing in step.

### The Lamp-House (Lorn II)
A dark tower of the makers standing in the shallows east of the root cave,
banded, tapering, a glass lamp-room and a cap at the top, a causeway of flat
stones out to it from the end of the lit path. Its lamp lit the whole wood
once; the night the sky rang it went out, and three of the pools with it.
Hollin's people kept their pools lit for forty years without knowing there
had been a greater lamp.
- **The local: Tamsy**, who counts the lamps every night, all forty-one pools,
  and writes the number down. She saw something pale and winged come down out of
  the tower and go back up. Afterwards: the beam going round over the wood; the
  moth asleep on the lamp "like a cat on a warm stove"; Hollin says it is the
  forty-second lamp: "Forty-two. I wrote it down."
- **Inside** (dark: the lantern charm glows in it, day or night): the
  Threshold; the Hall of Dark Pools (three pool-lamps to splash); the Root Stair
  (a dark pool with moss-stones sunk in it that rise glowing once a pool-orb
  carries light to their lamp; a root-wall to climb; v1.27); the Lantern Chamber
  (**the lantern charm**; a lamp by the dais that wakes to it, locking nothing);
  the Lamp Passage (its door a lamp that wakes when you stand by it with the
  lantern); the Dark Gallery (a chasm crossed by moss-stones only the
  lantern's light shows, an eye only it shows, a second lamp-door); the
  Lamp-Room, its great lamp dark in a brass cradle overhead.
- **The Lampless** (organic): a great pale moth, wings wide as sails with glyph
  eye-spots, that drank the Lamp-House's light and is still hungry, and afraid
  of how dark it made everything. It swoops and gusts and later throws its dust;
  when it hangs low over the floor, searching, stand still by it with your
  lantern and let it drink (moving makes it flinch; fluid only beads on its fur).
  Fed, it folds its wings: lay a hand on its back, and it climbs to the lamp, and
  the lamp catches from it.
- **After**: the Lamp-House's lamp burns again, gold in its glass room, a light
  on the water round the tower, and a long beam turning slowly over the wood at
  night; inside, the lamp-room's great lamp glows.

### The Hush-House (Lorn)
A great low dome of violet stone on the cave island, ribbed, an oculus at its
top with a crystal crown, the swamp's crystals growing up through it and round
it, a stone porch toward the channel with the Hush cut over the door. The
makers taught the plants of Lorn not to eat in here (the swamp people's Hush,
three drops over a shut mouth, is theirs: they paint it on their doors without
knowing), and grew the first snapper of all to keep the house: the Mother,
whom every snapping plant on Lorn is seeded from. The night the sky rang the
house's crystals went out of tune, and she woke frightened and has snapped at
everything since; you can hear it through the stone.
- **The local: Teasel**, who cuts reeds round the cave island, never from the
  dome's shore. Wendel told him the makers had "something cold" for it.
  Afterwards: the dome in flower, white and blue, and a ring of the same flowers
  at the foot of every snapper on the swamp ("Wendel laughed till he sat
  down"); the Mother breathing very slow through the stone. "I always thought
  it was a warning. It was a lullaby."
- **Inside**: the Threshold; the Choir (four crystals of four heights: splash
  them low to high, and out of turn one rings flat and fades); the Bog Well (a
  disc that climbs over dark water, then a wall of roots to climb); the Stilling
  Chamber (**the stilling mode**; its way on is open); the Snapping Passage (its
  door a gate of jaws, two great leaves
  with teeth that snap and half open, snap and half open, and bite whoever
  tries: a stilling glob stills them, and they forget to close); the Pendulum
  Gallery (a narrow bridge over a chasm, three crystal pendulums swinging
  across it that knock you off: still them one by one; at its end a second
  gate of jaws); the Mother's Hall.
- **The Mother Snapper** (organic): rooted in the middle of a round hall in a
  ring of leaves, a neck of green beads, a head of two jaws as big as a cart, a
  crown of crystal. She does not walk; she lunges along a lane, sweeps low to
  the sides, rears up and spits seed. Spent after a lunge, her head lies on the
  floor, jaws agape: a stilling glob in her mouth calms her (plain fluid only
  startles her, a shove frightens her). Once she has begun to calm, stilling
  her mid-strike calms her too. Calm, her head comes down by her leaves: lay a
  hand on it, and she sleeps, and the dome's crystals hum in tune again.
- **After**: the dome flowers all over (vines and pale bells, glowing at dusk),
  its crown crystal burns bright, and every snapping plant on Lorn wears a ring
  of the same white flowers at its foot.
- *Changed from the first design*: the house is on the cave island, not under
  the Great Crystal (the crystal's island is the main quest's); she is calmed by
  stilling, not by standing still (that became the Lampless's way, next door);
  and the temple's world change is the flowers. Wendel's eggs hatch in the
  separate firefly quest (see section 10).

### The Aerie (Vael)
A great white house of the makers on the plain west of the landing: a broad
plinth, a great drum and a narrower one on it, banded in ochre, glyph lines up
the drum like the lines on a wing, and on top a crown of tall stone feathers
leaning out round a perch. It is where the makers gave Vael's great birds their
wings; the birds were raised in its roost (so the bird who waits for her rider
was hatched here, though nobody says so). The oldest of them, the **Elder**, so
old her feathers have gone to stone, kept the house. The night the light went
over she stopped flying; the others left; she stayed.
- **The local: Lark**, who sweeps the great steps, slowly, and speaks in single
  words like everyone in Vael: "The Aerie. Where the birds were given wings."
  "She stopped." "Wind, inside. Wait for it." Told the Elder is afraid to fly
  alone, she holds out her arms and tilts, riding the wind: "Together."
  Afterwards: she leans her broom against the wall ("No more sand. They fan it
  off.").
- **Inside**: the Threshold; the Hall of Winds (gusts blow down it from the far
  end and shove you back: wait them out behind the stone screens, screen to
  screen; an eye by the far door opens it); the Feather Stair (a wall to climb,
  a disc that rides straight up to the landing); the Wing Chamber (**the fluid
  wings**; its far side opens on nothing); the Gulf (thirty-four metres across to
  a lower ledge: glide it); the Wind Well (a column of rising wind: open your
  wings in it and it lifts you round and up to an eye and a balcony); the Roost.
- **The Elder** (organic): a great bird of stone-white feathers on long ochre
  legs, a long neck and a longer beak, in the roost under the open sky with a
  column of wind in its middle. She buffets with her wings, stamps, and later,
  off the floor and beating hard, dives. After a stamp or a dive she spreads her
  wings and looks up at the sky, trembling, and does not go: ride the wind
  beside her (open your wings near her) and she lifts a little. Fluid only
  beads on her feathers; a shove frightens her. Calm, she folds her wings: lay
  a hand on her neck, and she rides the wind up out of the roost.
- **After**: the Elder sits on the Aerie's crown with her wings open, the glyph
  lines on the drum glow, and a flock of the great birds wheels high over it.
- *Changed from the first design*: the house stands on the plain, not among the
  floating ruins (they are too high and too scattered to build in), it is "the
  Aerie" rather than "the House of the First Walkers", the bone whistle is not
  needed (it is the main quest's, and the waiting bird's), and the world change
  is the birds coming back, not the ruins settling into a chain (that is left
  for later: it would need the ruins reworked).

### The First Garage (the Sealed Hangar)
A round stair-house of the makers on the rim of Brask's plateau, west of the
keep past the windmill: pale stone banded in brass under a teal cap, a great
clock over its door, stopped, and under it, set into the island's cliff, the
makers' clockwork, great cogs half out of the rock. The Major found it when he
made the place (or the place made itself round it: nobody is sure), kept his
first car in its porch (his lean-to and bench are still there) and copied the
glyph off its door stone "for luck, or for somebody". This is also where he
found the quick coil, and left it: "it's for the next one". Everything that turns
in his pocket universe took its beat from the clockwork, kept by the makers'
**Clockwork Foreman**; the night the light passed it jumped its escapement, and
the three machines Lune saw stop stopped because of it.
- **The local: Wim**, who winds the Major's clocks every morning, every clock
  on the plateau, none of them agreeing. Afterwards: every clock agrees with the
  one over the door ("I went round and checked them all, twice"); Ambroise says
  the board has never blinked so tidily; Ottla cried and said it was oil.
- **Inside**: the Threshold (the Major's old bench, the first mark); the
  Escapement (a pit crossed by a disc that swings over it like a clock's
  escapement, still until you splash the eye over the far door); the Winding
  Well (a wall to climb; on top a stone ball in a groove onto its plate: only the
  ball's weight opens the door, it is the winding's counterweight); the Coil
  Chamber (**the quick coil**); the Winding Passage (its door is ringed by six eyes that wake only
  together, inside one breath of 4.6 seconds: three shots, a refill, three more,
  and the tank only refills fast enough with the coil); the Clock Gallery (a
  chasm whose bridge rises for a second bank of six, round a stopped clock face
  on the far wall); the Foreman's Workshop.
- **The Clockwork Foreman** (robot): a squat drum of brass on four short legs, a
  great clock for a chest with six numeral lamps round it, two arms with
  hammers, a little bell on its crown that it strikes the hour on; its hands
  race and stutter. It hammers in front of it, strikes the hour (a ring round
  itself) and later throws its cogs where you stand. When it has struck, the
  grille over its face swings up and the numerals glow: hit all six inside one
  breath (two tanks: the coil). Four times, and its hands come round, slowly,
  to the true time, and stop there. A machine, set right rather than broken:
  Wim says "it can rest a little, between ticks".
- **After**: the clock over the door keeps the true time, the cogs in the cliff
  turn in step with their hub lamps lit, and a pendulum swings in the porch.
- *Changed from the first design*: the doors want six shots in one breath, not
  three in three seconds (three is what any tank holds; six is what the coil
  makes possible); the Foreman is set right by the same volley, not by a
  choice; the stopped machines and the signal board are left as they were (the
  machines are Ottla's side quest, the board the main quest's) and the change is
  the First Garage's own clockwork; Wim's balloons say the rest.

### The Builders' Greenhouse (Viridel)
A round house of the white builders' clean gridded stone under a great ribbed
dome of glass, in the flat meadow hollow north of the white ruins (and well
away from Esk's tea terraces, south-east of the landing). The builders grew the
whole garden from in there, Oro says, and left a gardener in it to keep it
growing: a giant of moss as old as the pyramids, in flower from head to foot.
The night the light passed, every flower on it closed and fell, and since then
nothing sown round the Greenhouse comes up, and something walks about inside at
night, bare as a stick, and breaks the panes.
- **The local: Sorrel**, who sows the beds round the Greenhouse every year, and
  nothing comes up. Asked whether going in is digging up what fell (the garden's
  rule), she decides it isn't: "Nothing fell in there. It just stopped. A garden
  that stops isn't resting. It's waiting for someone to tell it to go on."
  Afterwards: every drill came up at once; the ruins are green to the top; Oro
  sat down in the grass and wouldn't get up. If Esk's hill came down, Sorrel says
  Esk came up to see the ruins and took a bag of seed down for the mud: "It isn't
  mended. It'll be something else. That's all right."
- **Inside**: the Threshold (dead sticks in every pot); the Potting Hall (a
  white stone seed in a groove onto its plate, and an eye over the potting
  benches: both); the Glass Stair (a root-wall to climb, a disc that rides up to
  the landing); the Seed Chamber (**bloom mode**, a new gun mode; a seed in the
  oculus's sun by the dais flowers when bloomed, locking nothing); the Bud
  Passage (its door a flower-door, a great bud over the doorway that water only
  runs off and ember curls tighter: a bloom glob opens it); the Vine Gulf (a chasm: a seed at
  its edge grows a vine bridge across; on the far side a wall of greenhouse
  glass too smooth to climb, until a seed at its foot grows a vine up it; at its
  top a second bud); the Glasshouse.
- **The Gardener** (organic): a great hunched mound of moss on four root legs,
  two long arms ending in root-claws, a face of the builders' white stone with
  two eyes that glow ember while it is wild and leaf-green as it calms, brown
  bare patches on its back where nothing grows. It sweeps, stamps, and later
  sends roots up under you. First bloom the four dead beds round the walls (a
  tenth of its calm each; flowers on its back before that it only shakes off);
  then each time it kneels, heaving, its bare back to the glass, bloom its back
  (water it only drinks; ember and a shove frighten it). Calm, it lies down in
  flower: lay a hand on its brow. The bud you came in by shuts behind you while
  it fights.
- **After**: the white ruins all over Viridel flower: vines climb every slab,
  flowers ring their feet and crown their tops; the Greenhouse's dome goes green
  with leaves and pink with blossom.
- *Changed from the first design*: the Greenhouse stands in the meadow hollow
  north of the ruins, not "in the android wood" (Viridel has no wood that dense:
  the ruins are scattered, and the flat hollow is clear); bloom mode does more
  than grow a climbable vine (seeds, buds, a bridge, a vine up glass); it is the
  fourth gun mode, after ember, with its own leaf-and-petal colours in the tank,
  and outside the temples a bloom glob leaves a few flowers where it lands.

### The Undertower (the Signal Market)
The foundations of the silent tower, "here before the market": an old doorway
of blue-grey makers' stone in the tower's back, where the square's paving gives
way to great blocks older than any sign, cables running from it into the
ground. The makers built the first sign of all here, a machine to say one line
into the dark, over and over, for whoever was listening; the market grew up
round it and built its towers on top, and forgot it. Sel's tower stands right
over it, and the market's belief that the silent tower was the only sign that
ever told the truth may have come up through its floor. The night the sky rang
it stuck on one word of its line; under the square at night you can hear it,
if you put your ear to the stones.
- **The local: Hobb**, who lies on the paving with his ear to the old stones and
  listens ("Nobody else in this market listens to anything; they're all too busy
  being heard"). The word is *somebody*. Afterwards: the tower said the whole
  line over the square and everybody stopped selling, even the noodle men; he
  won't need his ear on the stones any more.
- **Inside**: the Threshold; the Hall of Dishes (a singing ball in a groove onto
  a dish's footstone: splashed there, its note crosses the hall through the
  dishes to a horn, and the makers' pillars rise out of a pit full of their old
  cable; v1.27); the Cable Well (two discs that ride up, a ledge between them); the
  Shell Chamber (**the echo shell**, a new tool, and a low singing stone by the
  dais); the Listening Passage (its door listens for the low note played back
  close by: carry it from the chamber's stone); the Gallery of Voices (a chasm: a horn
  at its edge raises the bridge for the high stone's note, and the far door
  wants the middle one, whose stone is on the near side: the shell holds one note
  at a time, and from across the chasm it can't catch the middle stone, so you
  carry the notes in the right order; a low stone by the far door is a decoy);
  the First Sign's Hall.
- **The First Sign** (robot): a mast of the makers on three legs, a great
  listening dish on a yoke for a head, a ring of lamps round its rim, a coral
  horn at its focus. It cries its one word (a ring of sound round itself), beams
  along a lane, and later throws static where you stand. After it cries it
  lowers its dish and goes still, listening: play its word back into it (the
  shell catches the word whenever it says it) and it stops, and says the next
  words of its line, a new note to catch. Its line, four times: *somebody* /
  *out there* / *is talking* / *to you*. Given its whole line back, it says it
  once, quietly, and turns its dish up to the dark. Its meter is damage, as for
  any machine; here it reads as retuning, and nothing is broken.
- **After**: a lamp burns on the silent tower's crown, the Undertower's porch
  lamps are lit, and once a night, when you are about the square, the tower says
  the line in the First Sign's voice, *SOMEBODY OUT THERE IS TALKING TO YOU*, a ring of
  light going out from its crown. It is Sel's line ("it only ever said one thing,
  in a thousand voices: somebody out there is talking to you"), and the
  father's recording that plays at the console says it too, in other words.
- *Changed from the first design*: it is "the Undertower" (the market's name for
  "the foundations"); the First Sign is retuned with its own words, not switched
  off; the echo shell holds one note at a time (that is the gallery's puzzle);
  the market keeps no chest in the open, so the 50/50 is eleven and eleven with
  the desert's two.

### Loose ends the temples leave
- The temples do not count toward a world's discovery or the route; they are
  each world's second great quest. Should finishing every temple open
  something (the Atelier's last page is a candidate)?
- No keepsake comes out of a temple yet (the father's reactions count
  keepsakes); a temple could give one (the Keeper's calm, a *person*; the
  warden's dark lamp, a *thing*).
- The recordings never mention the temples; a late one could ("Your
  grandfather swore there was a house in the dunes that the water came from").
- Ket (Buried Machine) still says a chest waits "on the chimney ring" (it does:
  the resin now). Nour's lines about the desert's makers do not mention the
  Givers' House; Sabri carries that.
- The City-Shaft's main quest still reads as if you could reach Nima without
  the jets; the temple quest says where they are.
- ~~Lorn's section 9 still says its chest holds the stilling mode ("the sky-egg"),
  and the gift list above still puts it on the mossy rise~~: fixed. Section 6's
  "Chest:" lines and the gift list in section 4 now say what is where, temple by
  temple and in the open (the rise has the breathing reed, Wendel's "sky-egg";
  the stilling mode is in the Hush-House). Wendel's eggs hatch in the separate firefly quest
  (section 10), not as the Hush-House reward.
- The Hangar's three stopped machines (Ottla's side quest) and its signal board
  are left as they were by the First Garage: the Foreman's change is its own
  clockwork. Lune's three machines "stopped that night" because the Foreman
  jumped, which nobody in the Hangar knows; a later line for Lune or Ottla could
  say so once the First Garage keeps time.
- The silent tower's nightly line and the console's broadcast (the main quest)
  are two voices saying the same thing; nobody in the market remarks on that yet.
- The echo shell catches any note sung near it, so it could answer other worlds'
  singing things (the Spheres' spheres, Lorn's crystal); only the Undertower's
  stones and the First Sign emit notes for it so far.

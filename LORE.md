# Memento: the story and the lore

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
5. The strike's signature (why these worlds)
6. The worlds, in travel order
7. Home and the ending
8. Recurring motifs
9. Planned additions (from the author's backlog)
10. Loose ends and contradictions (and the decisions that settled the rest)

---

## 1. The premise

"My son, make us proud. Bring back something of value."

A young traveller sets out in his father's old ship, a big round ball, to
bring back "something of value". On the way out, in the cockpit, he plays a
message from his father; something singing strikes the ship mid-sentence, the
picture tears apart, and the ship falls, without power, into a desert. From
there he walks, then flies, from world to world. Every world offers him
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
did not come back while his parents were alive. He wears a **translator** at
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
reached the Signal Market the night the light passed, and the traveller hears it
there.

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
window, an antenna the old recorder sent through, a tall umbrella tree, a
washing line, a landing ring, peach grass, lilac mesas, two moons. Nobody lives
there now.

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

### The prologue recording (the day he left)
"Is it on? The little light is on. Right. There you are." Nobody out there owes
you anything. Keep the translator at your ear. "You leave everything here half
done. The boat. The school. Your mother." "My son, make us proud. Bring back
something of value." "We will be waiting for you at the—" (the impact cuts it
off). The player takes it for a call from home.

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
5. The mother found his old drawings. "Your father says I shouldn't make these. He says you never listen to them. I think one day you will." He: "I am." LOGGED 4 YEARS AGO.
6. (After six worlds) **The last recording on the reel.** Both of them. "I have been thinking about what I asked of you. Something of value. I never said what." "Come home." "Bring whatever you have. Or nothing at all. Just come." Ship: "Logged two years ago, eleven days before the house went quiet." Home appears on the map.
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
- **Struck ships** (after Odile and Talo's ship): "Ships get struck out there. That is all it is."
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
| Spheres | something that walked through the sky putting spheres down | left-behinds, presents (Ivo, Ume): the one here is up on the grove's umbrella tree | the Footprint (under every sphere, and round the chest's sides) |
| Lorn | (not named) | the sky-egg (Wendel) | the Hush: three drops of rain over a shut mouth |
| Lorn II | (not named) | the traveller's chest (Hollin) | the Welcome: three lamps over a hull |
| Signal Market | (not named; "here before the market") | no chest | the First Sign; the tuning mark; three listeners and the edge of the world (Brush) |

**The chests.** Knee-high, dark blue paint crazed with age, corners worn
round, a frieze of glyph rings, a pale four-point star on the lid (the makers'
sign for a traveller: "a small light, a long way from home"). They hum when you
come near. They stand where the giants walked: shrines, high places, ledges,
never in the open by chance. Locals have sat beside them for generations and
never seen one open.

**Their gifts** (`src/items.js`, one chest per world, `src/boxes/placements.js`):
- **Magic-fluid backpack** (desert, the tree's ledge in Qanat): a glass tank of living water filled with "what the giants carried"; shoot, push, boost; it powers vehicles.
- **Pale star** (desert, a roof inside Qanat's gate): worn on the hood; does nothing; looks very good.
- **Fluid jets** (City-Shaft, the makers' pillar on the rim).
- **Bell-note whistle** (Vael, the cap of the needle spire north of the landing): a little whistle of blue-glazed clay shaped like a bell (not bone: the rider's whistle in the tower is the bone one); one clear bell note, the same in every world; nearby chests answer. It is found in Vael, not under Vael II's bell, on purpose: the note is the same everywhere, and the chest is where the giants walked.
- **Fluid wings** (Vael II, the top of the balanced stack).
- **Quick coil** (Hangar, the keep's south wall): faster refill.
- **Ember mode** (Buried Machine, the chimney stack's ring): a fire that hurts nobody.
- **Lantern charm** (Viridel, an umbrella tree's top canopy): never goes out.
- **Glyph lens** (Spheres, the grove's umbrella canopy): shows unopened chests from afar.
- **Stilling mode** (Lorn, the mossy rise among the creatures): freezes for a few seconds.
- **Fourth chamber** (Lorn II, the first root arch): four charges.
- The Signal Market has no chest.

**The tank's colours.** The fluid starts cyan and violet. Sources add bands:
the desert pool's water, Buried Machine's oil-light (amber), the Great
Crystal's violet. By the end the tank is a record of the journey.

### The glyph
Three dots over an arc that bows upward (∩), never a smile. Scorched into the
ship's hull by the impact. It recurs on the reactive scenery's three apertures,
the giants' brows, the Lodestar's lower facets, the Major's machines, the
android ruins, the bell, the great wheel, the Great Crystal's root stone, the
oldest market sign. As a boy the traveller drew it on the landing ring at home
before he knew what it was.

### The singing light
Whatever struck the ship. Every world has a witness (usually several): a light
that came over low and slow, singing like a wet finger round the rim of a
glass; something answered it (the chest, the Lodestar, the stones, the bell,
the wheel, the pole, the crystal, the antenna); then **it turned**, "like it
was looking for something", and **climbed away**, trailing the signature. It
never fell: it dipped low (behind the desert's dunes, over Lorn II's pools) and
climbed again.

**One night everywhere.** Every world saw it pass on the same night: the night
the traveller's ship was struck. In the desert, where the ship came down the
next morning, people say "the night before your ball came down"; everywhere
else, "the night the light passed" or the local name ("the night the sky
rang"), and the traveller says "that was the night my ship was struck". No
witness dates it from the traveller's arrival (no "three nights ago").
How one light crossed worlds a journey apart in one night is not explained; it
is part of what it is. Local names: the singing light
(desert), the night the sky rang (City-Shaft, Lorn II, market), the Tuning
Star (Buried Machine), the Singer (Viridel, Talo's word), an Answerer
(Spheres). It struck Odile and Talo's ship before his, forty-odd years ago, and
then their saucer too, over Lorn II's deep wood, when they went looking for it.
The Great Crystal on Lorn is a piece of the same light, fallen long ago (that
piece fell; the light itself never has). Ilen's ship sent back a
sound like singing. What it is, and why it turns, is never said.

Open questions the game itself asks: was it a makers' thing too ("whatever
struck you knew their sign, or it was one of their gifts, too, and lost its
way", Nour)? Did the chests open for Ilen?

## 5. The strike's signature (why these worlds)

*Built in this pass (`src/story/signature.js`).*

Whatever struck the ship left more than a scorch: **the scar on the hull is
magnetised**, and its field beats slowly in threes, like the glyph's three
dots. The ship's instruments read that beat. **The galactic map charts only the
worlds whose own field carries the same signature**: the worlds the singing
light passed through. From each world the traveller finishes, the ship reads the
trace a little further on, which is why the worlds open one or two at a time.
Home does not carry it: the ship knows that way by heart.

Where it shows in the game:
- **After the crash**, as the emergency power comes on: "Emergency power. The scar on the hull is magnetised: whatever hit us left a signature. Logging it."
- **The first time the map opens with power**: "Charting by the scar's signature. These worlds carry the same pulse as whatever struck us. No others do."
- **On the map**: a small glyph badge on every signature world; in the panel, "SIGNATURE · (reading) · matches the scar", and once visited, where it is strongest; a dashed box beside the chart explains it.
- **When a world is finished**: "New on the ship's map: X. The ship reads the strike's signature there too."
- **Out of the jump, the first time at each world**: "Signature confirmed: the same pulse as the scar. Strongest (place)."

The readings, world by world (editable in `SIGNATURE_WORLDS`):
| World | Reading from orbit | Strongest |
|---|---|---|
| Desert | in the scar itself | under the burning tree |
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
opens after six worlds. Each world: its people (one line each), its main
quest, its side quests, its chest and keepsakes, and how it ties into the arc.

### 1. The Desert: "The Tree That Drinks"
Dunes, mesas, salt flats and the skeletons of giants. The old city of **Qanat**
is built round a burning tree that grows from a fallen giant's heart; once a
year the tree "drinks" (water rises from beneath the giants and the fire burns
cool and many-coloured) and pilgrims process round the walls. This year the
water has not risen. The giant's skull lies outside the back gate, its mouth a
door to the cave in its chest.

People:
- **Nour**, the eldest of Qanat: has kept the makers' chest company for sixty years; tells the old words, the Givers, the star, the tank.
- **Hessa**, keeper of the dry well, Nour's granddaughter: tired, practical; knows the glyph's local names.
- **Ama**, keeper of the camp fires: "Nobody goes thirsty at my fires"; gives the jar.
- **The Speaker**, who leads the procession: keeps the old words; "Where the giant's eyes are marked, its mouth is a door"; calls you "little star".
- **Teo**, a drummer who lost his drum (the wind rolled it away "like a wheel").
- **Sefa** (oud) and **Bako** (ney), the camp musicians: Sefa plays "what the listener is missing"; Bako saw the burn on the ship.
- **Ilo**, a child who wants to see the cave: "Do you have a mother?"
- **Oum**, the pilgrim who fell behind: saw the light sing, and turn; "ask it why it turned".
- **Marrow**, salvager and liar: hid the hoverbike; has seen the glyph on things that fell before; his compass now points at your ship.
- Near the start: **Ysa** the dune walker, **Pell** the counter of bones ("Big things lie down and become places"), **Rook** who lost a bike, **Ennor** guide to the salt, **Tamsin** who listens to stones, and a blue-cloaked **traveller** sketching the Sleeping Observatory.
- Qanat's people at the tree: Tamra the weaver, Idris the potter, Kito the boy, Lula the baker, Haro the guard, Mim the sweeper.

Main quest (`desert.power`): follow the smoke to Qanat; climb the buttress
root to the makers' ledge; the chest opens (the backpack), the city gathers and
Nour speaks; listen at the dry well; Ama's jar; walk with the Speaker; out of
the back gate into the giant's mouth; push the fallen rib off the channel so
the water runs, the pool fills and the tree drinks; fill the jar; bring it to
the ship. The ship has power: "The ship hums awake. The galaxy is open."

Side quests: Teo's drum (in the great ribcage, south: pinned against a rib by a
knuckle of spine; push the knuckle from the side and the drum rolls out like a
wheel); take Ilo to the skull; walk Oum back to the fires (her knotted cord);
Marrow's hoverbike; the masked head in the southern dunes (sand drifted over its
eyes like lids: wash both clear at once and it looks at you); the Sleeping Observatory (three lenses, a roof that
opens on a constellation).

Keepsakes: *knowing* "What the giants left" (the cave's mural: the giants
carried the water; the tree drinks what they left); *song* "Teo's walking
rhythm". Chests: the backpack, the pale star.

Ties: the giants "came down from the swamp of lights" (Lorn); the light was
seen the night before the crash; the glyph is "the Givers' mark", "even you,
now, it seems". Errands start here (a jar of singing sand for the City-Shaft).

### 2. The City-Shaft: "The Light Nobody Looks At"
A city stacked down a 600 m pit: the rich on the sunny rim, the poor in the
depths over an acid lake, flying taxis between. The **Lodestar**, a light and
its dark twin, turns over the palace; the rim calls it a tourist story, the
bottom prays to it. It has been dimming since "the night the sky rang". The
rule here: a light nobody looks at goes out.

People:
- **Nima**, who sweeps the high terrace: has looked up once a day for forty years; Pell's cousin.
- **Ossa**, keeper of the Upward Shrine at the bottom: "Of course it's dimming"; gives the splinter and the bottom's message.
- **Pip**, a child at the bottom who has seen the sky once, for eleven seconds; Dov's nephew.
- **Dov**, guard at the palace gate, secretly from the bottom (minus two-nine-zero, stall nineteen); saw the glyph on the light itself.
- **Wren**, the driver who still stops for anyone who lights the old lamp; her compass spun for an hour.
- **Corvin Sale**, of the rim, third generation: "A light show. A story for tourists."
- **Lio**, cab dispatcher: nine hundred cabs lost their compasses at once.
- **Hask**, seller of views: "Up is free; I can't sell up."

Main quest (`incal.light`): Nima; down to Ossa and the splinter of the
Lodestar that fell into Behla's laundry; up to Dov at the palace gate; stand on
the palace and look up (the splinter flies home, the billboards read LOOK UP /
ONCE A DAY, the whole city looks up); tell Nima.

Side quests: carry Pip's ration up to Dov ("Dov's lift token"; first swing it in
from the old goods hoist over the void: shoot the rusted pin, push the weight
round the post); light Wren's
lamp (her cab comes when you hail in the depths). Errand: a taxi token for Vael.

Keepsakes: *word* "Look up once a day"; *thing* "Dov's lift token". Chest: the
fluid jets on the makers' pillar.

Ties: the Lodestar rang back when the light passed and a piece came away; a
swamp trader once brought a crystal that sang the same note (Lorn); the light
went "toward the deserts".

### 3. Vael: "The Waiting Bird"
A silent, bone-white country of needle spires, arches, floating ruins and a
lone tower. A great bird waits for a rider who left long ago. Nobody speaks
much; the world is quiet by choice.

People:
- **Oïa**, who watches the tower: almost wordless ("Gone." "Her track." "Blow."); draws in the sand.
- **Tam**, a boy who copies you.
- **Senn**, who listens to stones: "They hum. Since the night the light went over."
- **Hollin**, who keeps the stone hand: "Alive, once. Rang, once." "Small to tall."
- **The bird**, unnamed; **the rider**, gone (a mural shows a small figure walking away along an aqueduct).

Main quest (`arzach.bird`): sit with Oïa; ride the bird; land on the tower's
balcony; climb to the window (the rider's room, a map of the sky stones, a bone
whistle); blow it; the bird bows and promises.

Side quests: three feathers she shed the night the light went over; ring the
stone hand's knuckles small to tall (the third feather falls). Errand: a
feather for the Major.

Keepsake: *person* "The bird's promise" (wherever there is sky, call, and she
will come). Chest: the bell-note whistle.

Ties: the map in the tower points to Vael II; the stones answered the light.

### 4. Vael II: "The Bell Under the Cloud" (The Sky Stones)
Needles and balanced stones rise from a sea of cloud; cliff-top monasteries,
broken aqueducts, a floating island, a peach plain with a lone tower. The
monastery bell has not rung in thirty years; the monks believe the stones fell
*up* when it stopped.

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
Chest: the fluid wings.

Ties: the tower's face is the desert's sleeping head: the giants walked here
too. The bell recalls the harbour bell at home.

### 5. The Sealed Hangar: "The Major Forgot"
Major Brask's pocket universe: a plateau, an upside-down quarter, a ring where
gravity points outward, joined by portals. He built it, forgot why, and went
for a walk; his people keep the machines turning out of habit, passing a
ticking signal round the three zones that nobody can read.

People:
- **Ambroise**, clerk of the round: "Up is a matter of opinion." Has watched the board eleven years.
- **Ottla**, mechanic of everything: "It's not broken. It's thinking about whether to be broken." "Habit is a kind of love."
- **Lune**, who reads the signal at the ring's slit: saw the light go across and turn; three machines stopped that night.
- **Pip**, a child who doesn't trust down.
- **Clemence**, who remembers the Major as "a man with a pencil and too many ideas".
- **Nikko**, who greases the gears; **Ferrol**, who walked round the ring and came back to his own older footprints.
- **Major Brask**, absent.

Main quest (`garage.signal`): Ambroise's tube; post it in the upside-down relay
(stamped with the glyph); Lune shines it through the slit (nine dots: "It's a
page number. Or a place."); the Major's note on his desk.

Side quests: restart three stopped machines; push Pip's ball to where down stays
down. Errand: a brass gear for Viridel.

Keepsake: *knowing* "The Major's note" ("I built it to see what I would do with
it. I still don't know. That is the point."). On its back: a wheel half under
sand, "turns one tooth a year, go and see it turn". Chest: the quick coil
(the Major found it, never opened it: "it's for the next one").

Ties: the note points to the Buried Machine; the Major copied the glyph from a
stone in his first garage "for luck, or for somebody".

### 6. The Buried Machine: "One Tooth a Year"
Pale dunes, domed huts, pipe elbows breaking the sand; below, rust canyons that
are the machine itself, and a great wheel that turns one tooth a year. The dome
people count their age in teeth. Overhead hangs an upside-down city, "the Other
Half".

People:
- **Wen**, who counts the teeth (forty-one teeth old): gives the keepsake.
- **Hask**, keeper of the Wick: has lit it for fifty-two Tooth Days and won't this year, afraid the Tuning Star "was looking for the wheel". (Not the City-Shaft's Hask: same name, his own id, `hask.buried`.)
- **Dun**, who keeps the domes breathing: left his chimney key on the derrick hook the night the sky rang.
- **Pim**, nine teeth old.
- **Ossa**, who listens to the walls: "I call it a signature." (`ossa.buried`; the City-Shaft has its own Ossa.)
- **Tull**, who oils the oval doors and talks to the warm window; saw the Major.

Main quest (`buried.tooth`): Wen; Hask; down the sand ramp; through two oval
doors to the oculus; open the oil valve; light the Wick (an amber band for the
tank); watch the wheel turn; pick up the tooth it sheds; bring it to Wen ("You
were here the year it turned, so that one is yours").

Side quests: Dun's key (on a crane swung out over the drop: free the rusted
collar with a splash, then ratchet the jib in with pushes); read Ossa's three
gauges; lay a hand on the warm window.
The Major's scratched numbers on the drum wall: "FOUND IT. NOW WHAT?"

Keepsake: *thing* "A rust gear tooth". Chest: ember mode.

Ties: the Maker's Thumb is on every plate; "someone signs their work, and
someone else signs their damage, with the same hand"; tell the wheel the Hangar
is still turning.

### 7. Viridel: "The Garden Grows Over"
A clean, colourful garden planet: giant umbrella trees, white step pyramids
grown from seeds, white android ruins, great pale spheres half sunk in the
meadow (they came down out of the sky; the white builders laid their garden out
round them). Odile and Talo's ship fell here forty years ago; the gardeners let
the garden take it. Nothing that falls should be dug up again.

People:
- **Mira**, who keeps the water clock: "A ball fell into the meadow and a person came out of it. That is twice in my life." Gives the keepsake.
- **Sol**, who followed Odile and Talo about as a boy: "Tea keeps."
- **Oro**, who grows pyramids; tells of the Builders.
- **Lio**, a child who wants the floating crown of the tallest tree.
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
Chest: the lantern charm.

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
touch the main quest, the route, the ending or the stone.

### 8. The Garden of Spheres: "What the Spheres Remember"
Umbrella trees over white pyramids; giant pale spheres half sunk in the grass
and a mirror lake; an avenue to a round plaza with a humming pole. Each sphere
remembers one sound, the last it heard before it came down.

People:
- **Aube**, the listener: explains the spheres. (`aube.spheres`; Vael II's Sister Aube keeps `aube`.)
- **Nell**, who looks into the lake: "Upside down is just another way up."
- **Ivo**, who climbs the white hill: has seen the Footprint under every sphere, and the blue box up on the grove's umbrella tree. (`ivo` here; Lorn's Ivo is `ivo.perdide`.)
- **Cael**, who walks the avenue: "Walk slowly. It is that kind of road."
- **Ume**, who keeps the pole: saw an Answerer turn over the plaza; gives the keepsake.

Main quest (`spheres.listen`): Aube; wake the three remembering spheres (a
glass bell, far voices, a walking drum); the plaza; play them on the pole; the
great sphere answers; tell Ume.

Side quests: carry the lake's reflection (a mirrored pebble) to the pole; walk
the avenue slowly.

Keepsake: *song* "The chord of the spheres". Chest: the glyph lens.

Ties: one sphere remembers the desert's procession drum ("Then you've walked
under where they flew").

### 9. Lorn: "The Great Crystal"
A twilight swamp of humming crystal forests, carnivorous plants and glowing eggs,
crossed by skiff. The Great Crystal sings in the rain and the plants fall
silent. It fell out of the sky long ago, singing, and stuck point-first in the
mud. It is a piece of the same light that struck the ship.

People:
- **Wendel**, egg-warden: thirty years keeping eggs warm, none ever hatched; "The patient are never eaten."
- **Sedge**, reed-cutter, shy: saw the light pass over the reeds the night it passed everywhere, and the crystal sang back; then it climbed and was gone.
- **Saba**, the Listener: forty years at the crystal's foot, knows its 212 phrases; "Whatever struck your ship sang the same song as this." Her first spring there, two strangers came across the swamp in a borrowed skiff and asked the crystal where the light had gone (Odile and Talo); they went on east, and the skiff came home on its own.
- **Ivo**, who watches the fireflies: "Everything goes home at dusk."
- **Corm**, who feeds the plants (Margit, Big Ollo): "The sky lost a tooth and it landed here."
- **Ysse**, keeper of the crystal cave: points to the lamp-keepers of the deep wood.

Main quest (`perdide.crystal`): Wendel; cross to the crystal; Saba; make it
sing (rain, or three splashes); it sings a 213th phrase, the light's song; take
the splinter it drops; hold it up at the cave's heart (a violet band for the
tank).

Side quests: feed nothing (stand in the snapping bed and wait); follow the
fireflies to their nest. Errand: a humming crystal for the desert's dune walker.

Keepsakes: *thing* "A singing splinter"; *word* "Wendel's saying". Chest:
stilling mode (the sky-egg).

Ties: the strongest reading of the signature; Ysse sends you to Lorn II.

### 10. Lorn II: "The Lamps Are Kept" (The Deep Wood)
The far side of the swamp: giant pale mushrooms, dark trunks, a lit path of
pools to a root cave. For forty-one years the people have kept the pools lit
for travellers who never come. Three went dark the night the sky rang.

People:
- **Hollin**, keeper of the lamps: "you're the first who ever came… I don't know what to do with my hands."
- **Pim**, who lives in a moss dome ("Nobody built them; we found them").
- **Bram**, who minds the cave mouth.
- **Wick**, a young lamp-keeper: watched the pools go out under the light, "pop, pop, pop".
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
the fourth chamber.

Ties: the saucer is Odile and Talo's ship's little round boat; it carries the
glyph scorch: the light found them again over the wood and struck them a second
time. They waited a season for it to come back ("keep a light for us"), then
crossed the swamp in Fen's skiff toward the Great Crystal, to ask the piece of
the light that fell there; the skiff came back to the root cave on its own. The
drawing in the saucer is the garden they came from (Viridel, with the furrow
across its meadow), drawn so they wouldn't forget the way home. Where they went
after the crystal, nobody knows; Hollin likes to think they got home; Viridel
never saw them again. (The keepers' ids: `hollin.perdide2`, `pim.perdide2`;
Vael's Hollin keeps the stone hand.)

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
- **Doss**, who welcomes everyone; **Oyo**, who sells lanterns (they relit in a colour he has never sold); **Teb**, cab tout.

Main quest (`bazaar.signal`): Sel; Kip's recording; tune the antenna (three
bulbs, quick); play it at the console: the father's voice, years younger, to a
child called Ilen ("Don't bring anything. Nothing out there is worth more than
you, walking back in through our door on your own two feet… you are not alone.
Someone is listening for you. I am. Every night, I am."); "It was your father's
voice. It was not your name."; Sel again: it came from your home system.

Side quests: wake the oldest sign (WE HEARD YOU); clear the crates for Ummu's
bowl.

Keepsakes: *word* "You are not alone"; *song* "The quiet ones' hum". No chest.

Ties: Ilen (the mother's recording follows); the signs end on COME HOME WHEN
READY.

### Errands between worlds
Small parcels carried from one world's person to another's: singing sand
(desert to the City-Shaft), a taxi token (City-Shaft to Vael), a feather (Vael
to the Hangar), a brass gear (Hangar to Viridel), a glass seed (Viridel to
Lorn), a humming crystal (Lorn to the desert).

## 7. Home and the ending

After six worlds the last recording asks him home and the map shows **Home**
at its centre: "A small round house on a small round hill, and two moons over
it. Nobody lives there now. There is a stone in the yard."

Out of the jump, the ship reads out the hold: every keepsake and every one of
the makers' small gifts goes down with him (not the backpack, jets or wings: he
wears those). The ship lands on the ring by the house at dusk; the lamp in the
round window is dark; the door is shut. He walks past the door to the stone and
sets the tokens on the slab one by one, each with a short line (a song: "You
can hum it now without thinking"; a word: the words; a person: "Someone out
there is waiting for you to come back"; the pale star: "a small light, a long
way from home"). "I brought everything." If he knows about Ilen: "And this
space is for Ilen, wherever she is." "It isn't what you asked for. It's what I
have."

Last he sets the reel down and it plays by itself the one recording he never
searched for, the oldest: the parents young, a small child between them waving
at the recorder. "We are making this so you will have it. For when you are
big, and far away." "You don't have to bring us anything. Do you hear?
Nothing." "We are proud of you already. Look at him. Look at his hands."
"Goodbye, recorder." He: "Goodbye."

Closing line: "Something of value. You brought it home on your own two feet."
An end card, then the credits (SOMETHING OF VALUE): every world and its people
(those he never met drawn in pencil), "At home" (the bird, if she promised;
your mother and your father, on the hill; Ilen, if told), and what was left on
the stone. The game goes on: the stone keeps its tokens, the reel plays its
oldest side.

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
- **Numbers that recur**: forty years (Nima, Sel, Saba, Vey); thirty (the broadcast's age: Ilen left about thirty years ago); eleven (Dov's years away, Wren's dark lamp, Pip's seconds, Ambroise's years), forty-one (Wen's teeth, Hollin's years).

## 9. Planned additions (from the author's backlog; not built)

- **A Makers' temple in every world**, with a boss and a gadget at its heart (a bigger set piece than the chests; each temple's gadget could be the world's chest item, or a new one).
- ~~A quest you can fail, and failing it harms the locals~~: built, in Viridel (section 6, "The quest that fails"). It fails whatever you do; a quest you *can* fail by choice is still open.
- **Home gains a daughter and a dog: the traveller has a daughter.** (See the loose ends: today home is empty and "nobody lives there now".)
- **The holograms become coloured busts** (today the parents stand full length in teal light over the projector).

## 10. Loose ends and contradictions (and the decisions that settled the rest)

Each with where it is. Fixed earlier: the saucer's console said "STEL and
ATAN" (old names) and now says ODILE and TALO; Talo's lookout note was signed
"— A." and is now "— T.".

### Decided and fixed in this pass
- **When the light passed: one night everywhere**, the night the traveller's
  ship was struck. Witnesses say "the night the light passed" (or "the night
  the sky rang"); only the desert, where the ship came down the next morning,
  says "the night before your ball came down". Changed: Tamsin (desert), Lune
  (Hangar: was "the night before you came"), Sol (Viridel), Ume and Ivo
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
- **The Spheres' Footprint**: Ivo now points at what exists: the blue box up on
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
  log and Lio's node are now `odile` / `talo` / `bench`.
- **Directions**: Ossa's chest is "on top of the lone stone pillar" (was
  "behind the villas"); Hollin sends you to Wick "at the second dark pool, down
  the path past the glass dome"; Bram's far dome is "back toward the saucer's
  pool, this side of it".
- **Giver's / Givers'**: the plural everywhere ("the Givers' mark"); the
  bible's "star-chest" is gone.
- **The Major's note**: its back now has, in another pencil, "went. saw. came
  back." (Clemence says he went to see the wheel.)
- **A failable quest that harms locals**: built (Viridel's tea terraces,
  section 6). The recordings and the charge card both know of it.

### Still open
- **Home after six worlds, eleven worlds on the route**: recordings 7 to 11
  come from the oldest side; the arc's "last recording" lands mid-journey.
  Intended, but worth a look once there are temples.
- **The bazaar's lantern colour band** (bible: "the bazaar's lantern sun" adds
  a band) is not built.
- **The words for the arc** vary ("arc", "curve", "arch"); the shape is always ∩.
- **Wick** is a Lorn II keeper and the Buried Machine's lamp; **Ferro** (market)
  and **Ferrol** (Hangar): different names, kept.
- **"One witness per world"** (bible): most worlds have several. **Two side
  quests per world** (bible template): most have more now. The Spheres' unused
  stillness timer is still in `spheres.js`.
- **Oum's knotted cord** is a *thing* keepsake in the bible but only an item in
  the game; she tells her rumour before the walk, not after.
- **Oïa "doesn't speak"** (bible) but says three words; the Vael feather
  errand's giver talks freely in a silent world.
- **Vael II**: the stones "fell up long ago" / "since my mother's day", older
  than the thirty-year silence the monks blame. (Calix's fallback line "Nobody
  goes there", about the plain where Ondine lives, is now "Only Ondine lives out
  there, and nobody goes to see her".)
- **The City-Shaft's Lodestar** dims "since the night the sky rang", but Nima
  says it was brighter when she was a girl. Soft.
- **How one light crossed worlds a journey apart in one night** is not
  explained, on purpose.
- **The game brief still describes a live call** from the father and a prologue
  "call"; the build plays recordings.

### Planned additions that touch the existing story
- **A daughter and a dog at home** conflict with what home is now: "Nobody
  lives there now. There is a stone in the yard", the dark lamp, the shut door,
  the traveller about twenty-six who left at seventeen and never came back.
  Questions to settle: who is her mother, where was she during the journey
  (aboard? waiting at home?), does she change the last recordings and the stone
  scene, and does "Nobody lives there now" go. (`src/story/ending.js`
  homeEntry, `src/levels/home.js`.)
- **Coloured busts** replace the full-length teal holograms
  (`src/ship/hologram.js`); the stone scene's hologram of "the three of them"
  over the stone would become busts too.
- **Makers' temples with bosses**: the makers are gentle in every world so far
  (gifts, water, a fire that hurts nobody); a boss needs a reason that fits (a
  guardian, a gift gone wrong, something the singing light woke). The builders'
  gate in Viridel is a small precedent: a makers'-era thing that does harm only
  because it is opened after a thousand years.
- **The tea terraces at the stone**: the ending does not mention them; a line
  at the stone ("and Esk's hill, which I could not mend") would be for the
  ending's own pass.

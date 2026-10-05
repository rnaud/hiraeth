# Game Brief — Working Draft

## Core vision
A mysterious science-fiction adventure about a young traveller sent into the galaxy to prove their worth.

The world should feel organic, connected, and aware of the player. Plants react as you pass, screens wake up, and people carry on with rituals, music, and daily life. Exploration should reward curiosity with strange encounters and discoveries.

The visual direction is inspired by Moebius: vast landscapes, unusual silhouettes, flat colours, delicate ink lines, and expressive characters.

## Story

### Premise
“My son, make us proud. Bring back something of value.”

The traveller leaves home under the weight of their parents’ expectations. Their journey across the different worlds gradually raises a question: what counts as something of value?

Each level should advance this story through its inhabitants, quests, and discoveries. The parents’ disappointment is the emotional tension behind the adventure.

### Prologue — real-time cinematic
The opening plays inside the game engine and leads directly into gameplay.

1. The traveller wakes aboard a large, spherical spaceship.
2. They enter the cockpit and play a message from their father, who asks them to make the family proud and return with something of value. The player takes it for a call from home; it is a recording, made the day the traveller left (built: there are no live calls, see working decision 1).
3. Something strikes the ship, interrupting the recording.
4. With its power depleted, the ship makes a forced landing in the desert.
5. The traveller steps outside. Their first objective is to find a new source of power.

The cause of the impact remains a mystery.

### Story across the levels
Restoring the ship opens the wider journey. Each world should offer:

- A local story involving its people and environment.
- NPC quests that give the player a reason to explore.
- A discovery connected to the search for “something of value.”
- A clue or consequence that links it to another world.

Proposed emotional arc: the traveller begins by seeking their parents’ approval, then gradually develops their own understanding of what is worth bringing home.

Built: eleven worlds on the route; one quest in Viridel fails whatever you do (the tea terraces), and the world stays changed. Built too: a makers’ temple in every world, with a guardian and a gadget at its heart, the makers’ gifts split half inside them and half in the open (LORE.md, “Temples”).

### Home (built)
A small round hill under two moons, with two houses on it. The parents’ round house is dark and still: they died two years ago, and their stone stands in the yard. Across the yard, the small lit house where the traveller’s daughter **Lou** (seven and a half) lives with **Aunt Tove**, the mother’s sister, and **Moustache**, the dog; he left her there at two and went back out. At the ending Lou runs to meet him and walks with him to the stone, where he sets down everything he brought (and, if it failed, names the tea terraces he could not mend) and the reel plays its oldest recording. Afterwards he can come home any time, walk into both houses, and pay his respects at the stone. (docs/story-bible.md, “The ending”; LORE.md, sections 2 and 7.)

## Core gameplay loop
Arrive → meet people → follow clues → explore and experiment → make a discovery → return to the ship → choose the next destination.

## Spaceship and travel
The spaceship is a large round ball with an explorable interior.

Players enter it to access the cockpit and a galactic map, then choose another level. It serves as the familiar place they return to between unfamiliar worlds.

## NPC conversations and quests
Players approach an NPC and press an interaction button to talk.

Some conversations offer quests; others reveal local beliefs, rumours, or connections to the wider story. Conversations should make the inhabitants feel like people with their own concerns.

## Signature mechanic — the magic-fluid backpack
The backpack contains a visible tank of magical fluid. Its colours continually shift and blend, like a multicoloured lava lamp.

A hose connects the tank to an attachment worn on the traveller’s hand. This is their main tool for movement and interaction.

### Abilities
- Shoot: fire bursts of magical fluid.
- Boost: use the fluid to perform powered jumps.
- Push: knock people or objects away.

### Charge rules
- The tool stores three shots.
- It recharges after five seconds.
- The tank and hand attachment should clearly communicate the available charge.

Proposed starting rule: five seconds after the last shot, all three charges refill. Whether jumps and pushes share these charges remains a design decision.

The fluid should feel playful, strange, and powerful. Its changing colours are a defining part of the character’s silhouette.

## First world — The Desert

### Main objective
Find power to restart the spaceship.

The desert introduces the traveller, the backpack tool, NPC interaction, and the world’s mysteries.

### Key locations and encounters
- **The old city and flaming tree:** an ancient city built around a tree that burns. Camps gather outside its entrance, where people play music and prepare for a holy event.
- **The procession:** a large procession of NPCs crosses the dunes toward the event. The player can follow it, walk among its participants, and learn why they have gathered.
- **The underwater cave:** a hidden cave contains magical water in shifting colours. Its visual connection to the backpack fluid should invite investigation.
- **The ancient giants:** the remains of giants, dead for a very long time, lie across the desert. Their scale and placement should suggest a history that the current inhabitants only partly understand.

### Proposed progression
Leave the powerless ship → discover the camps → learn about the procession → explore the old city and its surroundings → find the underwater cave → uncover a source of power → return to the ship.

The flaming tree, magical water, and ancient giants should feel connected, even before the player understands how.

## World behaviour
Every level should express the same underlying principle: the world notices you.

- Plants change colour, glow, release spores, or move as you approach.
- Screens turn on or change their messages.
- People acknowledge your presence and respond to your actions.
- Magical fluid causes visible reactions in suitable objects and environments.
- Recurring colours, symbols, and phenomena connect distant worlds.

Reactions should vary in intensity, leaving room for quiet and mystery.

## Decisions still to make
(Answered so far in the working decisions below; kept for the record.)
- Are the parents openly disappointed from the beginning, or does that emerge through later recordings? (Decision 1: from the beginning, softening as they age.)
- What struck the ship, and how does it connect to the wider story? (Decision 2: still a mystery; the singing light, LORE.md section 4.)
- Does the desert’s magical water power the ship, refill the backpack, or both? (Decision 3: both.)
- Do shooting, jumping, and pushing use the same three-charge reserve? (Decision 4: yes.)
- What does the traveller ultimately choose to bring home? (Decision 5: everything, set on his parents’ stone.)

---

# Working decisions (v0.32, provisional — easy to revisit)

These were chosen to unblock building. Each is a single constant or data entry where possible.

1. **Parents.** There are no live calls: the traveller plays **old recordings** of his parents on the cockpit console, one after each world, projected as a hologram over the dash. He picks one that seems to fit where he has been; it never answers him. They were not happy with him when they made them. Little by little it shows that the recordings are very old, and at the end that the parents are dead: he is trying to make them proud after the fact. The mother speaks from the third recording on. (`src/story/calls.js`, `src/ship/hologram.js`; docs/story-bible.md, "The recordings")
2. **The impact.** Left mysterious. Physical clues: the ship's hull has a scorched scar in the shape of the **recurring glyph** (three dots over an arc — the same mark that recurs on the reactive scenery's three apertures), and the same glyph appears as a faint motif in every world. Nobody explains it yet.
3. **The magical water** does **both**: in the desert it fills a vessel that restarts the ship, and wading into it fully refills the backpack and permanently tints the fluid with a new colour band.
4. **Charges.** Shoot, boost and push all share **one reserve of three charges**. Five seconds after the last use, all three refill at once. The tank shows the fill level as three stacked colour bands; the hand attachment shows three lit rings.
   Built (`src/fluid-tool.js`): boost is **jump again in the air** (a fresh press, not the jump itself); keep holding and the wings still open once you fall (with the glider), and with the tank empty a press just glides as before. With the jets, holding jump thrusts and a **quick double tap** boosts. Push is C / middle click / B (○); shoot is G / left click / RT while aiming.
5. **What the traveller brings home.** Each world's discovery is collected as a **keepsake** (a thing, a song, a memory, a person's words). Built: after six worlds Home is on the galactic map; the traveller brings everything home, the keepsakes and the makers' small gifts, little tokens of having grown up, and sets them one by one on his parents' grave on the hill, with his daughter Lou beside him (she lives in the small house across the yard with Aunt Tove and the dog); she leaves a drawing, the reel plays its oldest recording, and an end card follows. Home stays open after that: both houses to walk into, the stone to pay respects at (src/story/ending.js, src/ship/homecoming.js, src/story/home.js, src/levels/home.js).
6. **Travel.** The ship replaces walking gates between worlds as the main way to travel once it is powered: enter it, take the cockpit, pick a world on the galactic map. The ship lands at each world's arrival point. The walking gates are gone; the worlds open up one or two at a time as you finish them (`src/story/route.js`). The order puts the wings first and the jets in the later half: the desert, Vael (the fluid wings in its Aerie, the winds up its tower), Vael II (charted once Vael is done), Lorn, Lorn II, Viridel, then the City-Shaft (the fluid jets, the seventh world), the Sealed Hangar, the Buried Machine, the Garden of Spheres and the Signal Market. No world before the City-Shaft wants the jets (`docs/systems/progression.md`).
7. **Everything runs on the backpack.** The traveller's abilities are items (`src/items.js`), found in boxes and through quests; without the backpack there is no tool, no jets, no wings, and powered vehicles won't start ("It needs power."). Built (`src/fluid-tool.js`, `src/fluid-kit.js`, `src/player.js`):
   - **Fluid jets** (item `jetpack`): two nozzles clipped under the tank spit coloured fluid flames. They work in any world once owned (a level's `features.jetpack` only says it wants them). **Fuel rule:** thrust burns the same reserve as a smooth gauge, 0.3 charge a second (a full tank is ten seconds of flight); a shot, push or boost needs a whole charge left. After a burn the refill clock waits until you land, then the usual five seconds refill everything. The tank's level and the HUD's `jets` gauge show it.
   - **Fluid wings** (item `glider`): hold jump while falling and translucent, veined membranes in the fluid's lava-lamp tones bloom out of the tank's shoulders; they fold back on landing and flap gently, more in turns and in the wind. The glide physics are unchanged. Without the item, holding jump in the air does nothing. Input: a press in the air boosts; holding while falling glides; with the jets, holding thrusts, a double tap boosts, and Shift + hold (or an empty tank) glides.
   - **Gun modes** (items `stun`, `fire`): X, the D-pad left / right or the touch ◐ button cycle the owned modes; the tank and bracer retint (and the lava's pace changes: stilling nearly still, ember boiling) and the HUD names the mode. All modes share the three charges. *Fluid* (shoot) splashes: it wakes scenery, startles people, sends creatures scampering, and solves the story's fluid puzzles. *Stilling* (stun) freezes creatures and people for 3.5 s. *Ember* (fire) never hurts: it lights lamps and fuses, flares camp fires, burns dry brambles away (they regrow), makes creatures flee, people jump and Lorn's plants recoil. A target that doesn't accept a mode receives it as plain shoot (`src/targets.js`), so every puzzle works in every mode; fire-reactive things register as `kind: 'flammable'` (`src/flammable.js`: the desert camps' fires and brambles, the Signal Market's lamps; the Buried Machine's wick and Lorn II's lamp pools accept fire directly).
   - **Taxis** answer only a cab pass (the City-Shaft's dispatcher writes it, for a fare: `incal.pass`); without one a cab flies past, or its driver taps the card that says so. Wren's cab stops for anyone.
   - **Powered vehicles** (the hoverbike and the skiff; not the bird, who is alive, nor taxis, which are driven): getting on swings the backpack off into a socket behind the seat (about a second; moving skips it), a hose clicks into the engine and the fluid lights its caps and the hover trails. Getting off takes it back onto your back. While it is in the socket the tool is unavailable; an unpowered vehicle coasts to a stop.
   - For development, `?items=all` grants everything (`?items=none` takes it all, `?items=backpack,glider` sets exactly those).

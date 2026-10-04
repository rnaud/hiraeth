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
2. They enter the cockpit and receive a call from their father, who asks them to make the family proud and return with something valuable.
3. Something strikes the ship, interrupting the call.
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
- Are the parents openly disappointed from the beginning, or does that emerge through later calls?
- What struck the ship, and how does it connect to the wider story?
- Does the desert’s magical water power the ship, refill the backpack, or both?
- Do shooting, jumping, and pushing use the same three-charge reserve?
- What does the traveller ultimately choose to bring home?

---

# Working decisions (v0.32, provisional — easy to revisit)

These were chosen to unblock building. Each is a single constant or data entry where possible.

1. **Parents.** The father is warm but exacting in the prologue; disappointment is never stated outright at first. It emerges through **calls in the cockpit** after each world is completed: he asks what you brought, weighs it against what he expected, and grows terser. The mother speaks only from the third call on, and is gentler. (`src/story/calls.js`)
2. **The impact.** Left mysterious. Physical clues: the ship's hull has a scorched scar in the shape of the **recurring glyph** (three dots over an arc — the same mark that recurs on the reactive scenery's three apertures), and the same glyph appears as a faint motif in every world. Nobody explains it yet.
3. **The magical water** does **both**: in the desert it fills a vessel that restarts the ship, and wading into it fully refills the backpack and permanently tints the fluid with a new colour band.
4. **Charges.** Shoot, boost and push all share **one reserve of three charges**. Five seconds after the last use, all three refill at once. The tank shows the fill level as three stacked colour bands; the hand attachment shows three lit rings.
   Built (`src/fluid-tool.js`): boost is **jump again in the air** (a fresh press, not the jump itself); keep holding and the paraglider still opens once you fall, and with the tank empty a press just glides as before. On jetpack levels holding jump still thrusts and a **quick double tap** boosts. Push is C / middle click / B (○); shoot is G / left click / RT while aiming.
5. **What the traveller brings home.** Undecided by design. Each world's discovery is collected as a **keepsake** (a thing, a song, a memory, a person's words). At the end the player chooses one; the father's reaction depends on the choice. Built: after six worlds Home is on the galactic map; in orbit over home the traveller chooses one keepsake (or nothing); the father's words at the door depend on its kind, the mother's do not (src/story/ending.js).
6. **Travel.** The ship replaces walking gates between worlds as the main way to travel once it is powered: enter it, take the cockpit, pick a world on the galactic map. The ship lands at each world's arrival point. Old gates remain as a fallback.

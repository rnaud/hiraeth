# Helping a guardian instead of fighting it (issue #339)

**Prototypes for the author to play. They replace nothing yet.** The author: "I want to create 2 prototypes of different
guardian encounters where I help them instead of fighting them … fly alongside the large bird to grab things mid air in
a short period of time before X happens … my fluid gun which turns into a proper water cannon to help fill up all sorts
of recipients to open doors and restore the power and the water flow in the temple in the desert … and also give me
ideas for all the other guardians."

Both run in the shipped arena, on the shipped guardian, from a page of their own; without it the fights are as they
were (`tests/guardian-help.test.js` checks both ways). Each ends on the shipped hand on the guardian's brow, which
resolves the temple as the fight does (the world change, the door out). Progress is a sandbox: nothing is saved.

| Prototype | Page | Debug menu |
|---|---|---|
| Fly with the Elder (the Aerie's Roost) | `?level=arzach&guardianHelp=elder` | Debug → Prototypes → Fly with the Elder |
| Water for the Keeper (the Rose House's cistern) | `?level=desert&guardianHelp=keeper` | Debug → Prototypes → Water for the Keeper |

A panel at the top left says what to do now in one line, counts what is done (pips), and runs a bar down for what is
running out (the most urgent falling feather, the vessel that is leaking). The guardian's own bar at the bottom is the
encounter's progress.

## 1. Fly with the Elder (`src/guardian-help/elder.js`)

The Elder will not fly alone (LORE.md, "The Aerie"); her feathers have gone to stone, and the birds raised here shed
their first stone feathers in the Moult. This is her flying again, and moulting as she goes.

- **Start.** She stands on the Roost's floor, trembling. Open your wings in the rising wind of the vent (the rings, on
  the east side; the stone sits in the west one): she hops into the column beside you and rises with you to its top.
  Leave the wind before she is up and she drops back to her floor, nothing lost.
- **Her wake.** At the column's top she peels off and waits, slowly, until you are out of the wind, then gathers her
  pace (11.5 m/s; your wings cruise at 15, so you close up from behind). The air behind and beside her (10 m back, 7 to
  either side, `FLIGHT.wake`) holds your wings up level with her and carries you at her pace; let the stick go in it and
  it turns you along her line. Out of it you sink as anywhere, and the vent's wind takes you back up. Her wake is drawn
  as two trails of motes off her wingtips.
- **The feathers.** Three flights round the roost (2.5 turns each, about 17 s): low and level, then swinging out over the
  vents, then climbing toward the oculus. Five feathers a flight. Each first shakes loose on one wingtip, glowing, for
  1.4 s (the side to fly on: "A feather loosens on her left wing"), then comes away keeping two thirds of her pace and
  falls (2.1 m/s) behind her, tossed out of her turn: the right wing's (inside the turn) into her line, the left wing's
  outside it. A ring on the floor under each shrinks as it nears. Fly through it (3.2 m from your chest) to catch it.
- **Failing gently.** A feather that reaches the floor shatters and she flinches. A flight may lose one; lose a second
  and she falters, glides down and sits shaking (3.5 s), and that flight is flown again from the vent, what was caught
  in it let go with it. Nothing else is lost.
- **The end.** The three flown, she spirals up out of the oculus into the open sky and back down, calm, and folds her
  wings: lay a hand on her neck. She rides the wind up out of the roost; the birds come back to the Aerie.
- **Camera.** While she flies the boss framing widens (`view()`: arm +7 m) and the camera turns onto the two of you.
- A clean run is about 95 s (the scripted pilot in headless Chrome); with a falter or two, two to three minutes.

## 2. Water for the Keeper (`src/guardian-help/keeper.js`)

The Keeper was thirsty and afraid of the dark (LORE.md, "The Keeper of the cistern"); after it is calmed the cistern
fills and the water runs out of the house to Qanat. Here you bring the water back yourself, and it helps.

- **The water cannon.** The fluid gun lends a mode for this cistern only, `cannon` (`src/fluid-kit.js` MODES.cannon,
  `lent`: no item; `FluidTool.lent`, `FluidTool.pourStream`). Aim (LT / L2, right mouse) and hold the trigger (RT / R2,
  left mouse): one strong arc of water out of the glove (21 m/s, under gravity, traced against the world), the magic bar
  draining (half a unit a second: a full bar of three pours six seconds), refilling as ever once you let go. What it is
  poured into takes it at the first mouth it passes (`streamCatch`). X / D-pad → still cycles the other modes.
- **The vessels** (`VESSELS`): a jar on the floor (west), a jar on a corbel high on the north wall (an arc over the
  rim), the trough over the old water wheel on the south-east wall, and the Givers' great tank under the dry muzzle on
  the east wall, its stone lid on. Each has a glowing gauge on its face. The three small ones are cracked: off the
  stream for more than 1.2 s they leak back down (16 % a second), so each is filled in one go, near enough.
- **What each does.** A jar brims, tips, and a runnel of water runs down into the basin; the Keeper walks to where it
  comes in and drinks, and calms a little. The trough turns the wheel: the house's power is back, the four bronze
  braziers catch, the lamps round the walls wake, and the far door sinks open. The three done, the Keeper **helps**: it
  goes to the tank and heaves its stone lid off. Fill the tank (no crack, but more than one bar: you pour, let the bar
  fill, pour again) and the muzzle pours into the basin, the basin fills, the Keeper drinks deep and lies down by the
  running spout: lay a hand on its brow, and the shipped world change follows (the cistern, the channel to Qanat, the
  fields).
- **Failing gently.** A vessel left leaks. The Keeper paces the dry basin, and the stream in its face (0.3 s of it)
  frightens it: it rears, stamps, and any vessel near it (9 m) spills: "Water the jars, not the Keeper." Wait for it to
  pass, or pour from the other side. Nothing is lost for good.
- A clean run is about 80 s (the scripted player); finding the vessels and learning the arc, two to four minutes.

## What the author decides after playing

- Whether either replaces its shipped fight, sits beside it (a choice in the arena, or the second visit), or becomes
  the shape for every guardian (the ideas below).
- The Elder: her pace against the wings' (11.5 / 15 m/s), how strongly the wake carries you (`FLIGHT.wake.steer`,
  `draw`), how long a feather shakes loose before it falls (`feather.tell`), the misses a flight forgives (`miss`).
- The Keeper: whether the cannon stays a lent mode or becomes the Rose House's own gift; the leak (`LEAK`); whether the
  Keeper should do more than drink and lift the lid (nudge a jar under the muzzle, carry water in its mouth to the high
  jar).
- Not done in the prototypes: the guardians' voices and the music for helping, a cinematic at the end (each ends on the
  shipped hand on the brow), the Unity port, save and resume inside the encounter.

## One idea for each of the other guardians

Each uses its temple's gadget and what the guardian is, and keeps the house's idea (docs/systems/foes.md, "The
guardians' last phases"). Help, not harm: the machines are mended or set to their old work, the living ones eased.

| Guardian (temple, gadget) | Helping it |
|---|---|
| **The warden** (the Warden's Well, the jets) | The tower's breath has stopped and the warden is choking on its own heat, its crown hatch jammed. Fly the shaft with the jets, washing each of the four great vanes in turn so the breath rises again through the irises; every vane turning cools it a phase, and at the top you hover over its crown and wash the hatch open so it can breathe out. Fail: a vane slows if you leave it too long, and the heat comes back. |
| **The Cloud-Mother** (the Founders' Belfry, the bell) | She lost the stones she kept aloft, and the belfry's floor is falling up into the sky. Ring the bell to hold falling-up stones in the air while she gathers them back under her fins, one at a time; ring too early and they drop, too late and they are gone through the dome. A rhythm encounter: her calls are the beat. |
| **The Mother Snapper** (the Hush-House, stilling) | Her hatchlings are loose among the pendulums over the gulf. Still each pendulum as a hatchling clings to it so she can reach it with her jaws and lift it back to the nest, smallest first (low to high, the house's idea). A stilled pendulum holds 3.5 s: chain them so her path across is never swinging. |
| **The Lampless** (the Lamp-House, the lantern) | It is blind and lost in its own dark hall. Carry light ahead of it: hold the lantern by each dark pool so it lights, and walk the moth home pool to pool to its old roost under the oculus. It follows the last light it saw; let a pool go dark behind you before it reaches it and it wanders, circling, until you relight it. |
| **The Gardener** (the Builders' Greenhouse, bloom) | Its back is a garden that died in the shade. Turn the louvre's sun quarter by quarter and bloom the beds on its back while it kneels in each, in the order of the seasons painted on the dome; in full bloom it stands and opens the dome. The sun moves on: a bed bloomed in the shade folds, so you race the beam, not the Gardener. |
| **The Clockwork Foreman** (the First Garage, the quick coil) | Its spring has run down and it is stuck at four o'clock with every clock in the house. Wind it: ride the quick coil's refills to hit its six numerals in step from four within one breath, each round setting its hands an hour on; at the twelfth the house's clocks start together. A missed step and it ticks back an hour, never more. |
| **The Tooth-Warden** (the Engine-House, the cell) | The engine is grinding itself to pieces and the Tooth-Warden is trapped at its heart. Roll balls into the cranks to stop the pistons one bank at a time, clearing it a path out across the turning gear; carry the cell to each stopped piston to restart it gently once it has passed. Too many stopped at once and the engine stalls and shudders it back a step. |
| **The Echo** (the Footprint, the lens) | It has forgotten its song: the walker's notes are scattered on the spheres. Find each print with the lens and sing the spheres in the order the prints were set down; the Echo sings each back a little stronger, and at the last it sings the whole song. A wrong note and it falls silent a moment, then hums the last right one to help you. |
| **The First Sign** (the Undertower, the echo shell) | It is shouting its word to someone who left long ago. Carry its word through the dishes to the far ear where the answer still waits, and bring the answer's word back to it, one word of the line each time it lowers its dish; the line whole, it falls quiet and the tower's lamp lights. Words fade from the shell: a long way round loses one. |
| **The Listener** (the Whale-House, the whale-horn) | It is listening for whales that no longer answer. Sound the deep note into the hall's dishes so it carries out through the glass to the open sea, and set the dishes' balls so the note reaches farther each time; the third reaches the whales, whose answer comes back through the glass and the Listener sings with them. The tide moves the balls off the footstones: keep them set. |
| **The Last Founder** (the Casting-House, the tongs) | It has been trying for ages to cast one whole moon and every one cracks. Help it cast: carry the iron moons with the tongs through the pilot flame into its moulds while it pours, and splash its overheating heart between pours so the metal cools evenly. One whole moon and it stops, looks at it, and rests. A moon carried in cold cracks, and it starts that mould again. |
| **The Anchor-Warden** (the Mooring-House, the tether) | Its cables have snapped and the moorings are drifting off into the void. Tether each drifting island's anchor home within reach of its capstan arm, which takes it and winds it taut; three islands moored and it locks, humming. Islands drift farther the longer they wait: the order you fetch them in matters. |

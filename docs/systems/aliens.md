# Alien peoples (non-humanoid characters)

Some worlds have people who are not built like people: four species, each in
one world, three or four characters each. They are bystanders who can be
talked to, with listen-only lines (hints for the step a quest is at, the
world's lore, a brush-off, a joke, news once the world's story is done).
They have no skeleton and no face.

| Species | World | Body | Moves | Voice and script |
|---|---|---|---|---|
| **drifter** | Garden of Spheres | a ribbed bell with eyespots, a glowing heart, nine threads and four frilled arms, floating 2.7 m up | pulses (each pulse lifts it), bobs, turns slowly; its threads trail behind and wave | *drifter bell-song*: slow, ringing, gliding up · *drifter threads* |
| **stilt-walker** | Vael | three long legs (thigh and shin, a knee out and up) under a robe with tassels, a lantern for a head | steps one leg at a time (wave gait, IK knees); the lantern swings on its neck and turns to look | *stilt-walker drone*: low, breathy, few syllables · *lantern marks* (one a word) |
| **shellback** | Lorn II | a banded spiral shell with moss tufts and lamp dots, a soft foot, a head with feelers and eyes on stalks (1.45× the model) | glides with ripples along the foot, its shell rocking; the eye stalks look about | *shellback burr*: deep, slow, bubbling down · *shellback coils* |
| **murmur** | Signal Market | five (or four) pale bulbs with tips bent forward, dark eyes, a blush | hop as a cluster, squash on landing, each turned to what it looks at | *murmur chorus*: high and quick, four voices on every syllable · *murmur dots* |

## Code

- `src/aliens/species.js`: the species (sizes, face and prompt heights, speed,
  tongue, glow colour, LOD distances) and `TONE_BODY`, how each tone shows on a
  body without a face: glow brightness, warm or cold, rise or sink, pace, an open
  or shrunk pose, a tremble, a lean toward you, a spin.
- `src/aliens/bodies.js`: the procedural bodies in flat vertex colours
  (`figure: true`, so the post pass inks them like people), each with its own
  materials (cloned with the world's shared uniforms), and a merged far body.
- `src/aliens/alien.js`: `Alien`, which stands in for an NPC (`src/npc.js`)
  wherever the game asks for one, and one motor per species: idle, movement,
  the tone (`express`), and the reaction to the fluid tool.
- `src/aliens/index.js`: `spawnAliens(scene, physics, levelId)` and
  `alienSpots(levelId)` (the crowd keeps clear of them).
- `src/story/aliens-data.js`: the characters (`ALIENS[levelId]`) and what
  each species says when the tool hits it (`ALIEN_LINES`).

main.js spawns them after the world's people and pushes them into `npcs`, so
they are updated, show balloons, are kept by the flora and the room culler,
and become talkable through their `def.talk` (`src/story/index.js`). The
story runtime asks an alien for `talkAt` (where the prompt hangs), `faceAt`
(the two-shot and the traveller's eyes), `portraitShot` (the portrait
camera) and `express` (the tone of the line it is saying). Its `talkGap`
(`SPECIES[id].gap`) is the room a conversation leaves
(`src/story/spacing.js`), so you do not stand among a stilt-walker's legs or
under a drifter's threads. The two-shot
(`src/story/shot.js`) rises and steps back when one face is much higher than
the other, so a lantern 4 m up stays in frame. For two people of about the
same height the shot is unchanged.

## Tones without a face

Every line carries a tone (`src/story/tone.js`). On an alien the line's tone
eases the body toward that tone's `TONE_BODY`: the glow (drifter heart,
lantern, moss lamps) brightens or dims and turns warm or cold, and the body
rises or sinks, opens or droops, trembles, leans in or spins. Each syllable
pulses the glow and moves the body: the bell breathes, the lantern nods, the
eye stalks stretch, one of the murmurs bounces. Balloon lines work the same
way, following the balloon's own mumble.

## The fluid tool

There is no ragdoll. Each species reacts in its own way and recovers:

- **push**: a drifter floats back and up, tipping, then sinks back to its
  height; a stilt-walker sways on its legs and steps (two legs at once) to
  catch itself, the lantern swinging; a shellback pulls into its shell and
  rolls along the ground, rights itself and slowly comes out; the murmurs
  scatter, tumbling and bouncing, then hop back into place.
- **shoot**: tinted in the fluid's colours for a moment (threads curl, the
  lantern flinches, the eyes pop down, the murmurs jump); **fire**: a warm
  flare (a drifter shoots up); **stun**: frozen mid-move and frosted for 3.5 s.

## Cost

Few draw calls: a drifter is 3 meshes, a stilt-walker 7 (its thighs, shins,
knees and feet are one instanced mesh each), a shellback 8, a cluster of
murmurs 1 instanced mesh. Everything solid casts a
shadow, and the glowing parts skip the shadow passes. Levels of detail by
camera distance (`SPECIES[id].lod`):

- **near**: everything is animated every frame and the soft parts are bent
  on the CPU.
- **mid**: the same body, updated every 2nd frame, without the soft bending.
- **far**: one merged low-poly body (the murmurs use a low-poly instanced
  mesh), updated every 2nd frame.
- **distant**: the far body, updated every 4th frame.
- **hidden**: past `lod.hide` they are not drawn or updated.

## Tests

`tests/aliens.test.js` checks the species, the voices, the scripts, the
bodies and their LODs, every character loading and walking, the tool's
reactions and recovery, the listen talks and hints, and a conversation (its
tone on the body, facing you, the portrait). `tests/tone.test.js`,
`tests/listen.test.js` and `tests/scripts.test.js` cover the lines, talks,
tongues and scripts with everyone else's.

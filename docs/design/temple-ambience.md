# The houses' air: an ambience plan for the 13 skinned temples (issue #372)

The author, on the futuristic skins (v1.77–1.78, issue #342): *"Some of the new temple futuristic reskin is missing the
mark a bit in terms of mood and ambiance. What could we do? Like embers flying in the temple that has fire/lava."*

## What the houses lacked (the four biggest rooms of each, High, noon, 15 October)

Shot with the camera pinned in each house's four biggest rooms (contact sheets in the issue's scratchpad, `ambience/before`):

- **Air.** Nothing of the house's own. What drifted in every house was the *world's* motes, carried in from outside:
  the desert's sand dust in the Rose House and the Engine-House, the Glass Dunes' green specks in the Clock-House, grey
  city dust in the Casting-House and the Whale-House. No embers by the Rose House's braziers or over the Engine-House's
  glowing pits, nothing rising in the Warden's Well's updraft, no bubbles behind the Whale-House's sea windows.
- **Light.** The halls are evenly and steadily lit: the house's light tints the world's colour script (`rt.skin.light`)
  and its own lights (the layout's) never move. The fire houses' lamps don't flicker; nothing breathes.
- **Sound.** Inside, the world's ambience bed went on as outside: the desert's wind, the City-Shaft's car horns, the
  market's taxis, the Lorn swamp's frogs, inside sealed slate halls under the ground or the sea.
- **Movement.** The skins already turn their vanes, rings and wheels and pulse their lines (`SkinMotion`, `SkinLife`);
  the air was the still part.

## What each house gets

Three shared, cheap pieces, configured per house in `src/temples/air.js` `HOUSE_AIR`
(how they work: `docs/systems/temples.md`, "The houses' air"):

1. **its air**: one or two layers of the game's motes (`life.js Motes`: one draw each, points round the camera, hidden
   behind the walls by the G-buffer's depth), only while you are inside, the world's own motes hidden there;
   half as many on the handheld, Low and Deck presets;
2. **its light**: the house's own lights breathe, flicker, blink or tick (their reach, so both renderers carry it);
3. **its sound**: a bed (a low roar, a drone, wind) and its own events on the score's beat, in place of the world's.

| house (world) | theme | air | light | sound |
|---|---|---|---|---|
| Rose House (desert) | fire and sand | **embers** rising from the braziers' light; fine rose sand drifting low | flicker | fire crackle, a low roar, a breath of wind |
| Aerie (Vael) | wind | ochre sand **streaming** sideways on the turbine's wind; pale down tumbling up | slow breath | gusts howling through the shaft, the turbine's low thrum |
| Founders' Belfry (Vael II) | bells | bronze dust **hanging** in the light, glinting | slow swell | far bells ringing now and then, a low drone |
| Hush-House (Lorn) | hush, still water | slow violet motes, glowing; **drips** falling into the black pool | very slow breath | drips and their echo, a faint low hum |
| Lamp-House (Lorn II) | dark and lamplight | a few warm **sparks** in the dark; fine grey dust | lamplight swell | a filament's hum, a glassy tick |
| Whale-House (the sea) | the sea | **bubbles** rising; drips off the brass | slow wave | the sea's deep roar, a far whale's call, drips |
| Warden's Well (City-Shaft) | updraft | lavender dust **carried up** the shaft | slow breath | wind up the shaft, the vanes' whoosh, a drone |
| Clock-House (Glass Dunes) | time and sand | sand grains **falling slowly**, as in an hourglass | a tick each second | tick-tock on the beat, a low drone |
| Engine-House (Buried Machine) | fire and machine | **embers** over the pits; dark soot | flicker | the furnace's roar, gears ticking, a piston's thump |
| Casting-House (Moon Foundry) | the foundry | **sparks** flying up fast; warm heat dust | flicker | the forge's roar and crackle, a struck anvil's ring |
| Footprint (Garden of Spheres) | light and calm | pale blue-white motes, slow and bright | slow breath | glass chimes far off, a soft drone |
| Mooring-House (the Moorings) | space and cables | teal **glints** hanging like far stars | slow breath | a deep drone, cables creaking under strain |
| Undertower (Signal Market) | signals | coral dust in the dishes' light | a signal's blink | static in short clusters, a far signal tuning in |

Futuristic still: the air is of the makers' machines (embers, sparks, dust, drips, bubbles, glints), never organic
(no spores, leaves or insects in a house).

## Budgets

- Draws: +1 or +2 inside a house (its layers), none outside. The world's motes hidden inside give one back.
- Motes: 40–150 a house (half on low-detail presets); their positions a few hundred multiply-adds a frame.
- Unity: the same points reach the port's camera-facing quads on `Hiraeth/Mote` (its glow and alpha added); the lights'
  reach and the sound run in the same game script.

## Not done here (follow-ups to weigh)

- **Darker halls with pools of light.** The biggest gap in mood after the air is the even light: the skins' `light`
  tints the colour script all over a hall. Pools under the lamps and darker corners would need the light script per room
  (a darker shade in the big halls, the lights' pools kept) and a pass over every house against its picked drawings.
- **Heat shimmer** over the Engine-House's pits and the Casting-House's pouring floor (a screen-space wobble: a pass of its
  own and a port of it), and **steam** from the Whale-House's vents (soft large puffs, not motes).

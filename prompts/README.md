# Character prompts

Image-generation prompts for the game's characters, one file per world, five
characters each. They follow the prompt used for the hero (`hero.md`): an
exploration sheet with several variations, full body, readable silhouettes,
and the same style line at the end, so every sheet matches the traveller.

Each character is someone who already lives in that world (`src/story/*-data.js`)
or one of its crowds (`src/costumes.js`), with the colours they wear in the
game, so the sheets can be used to refine their models and outfits.

| File | World (internal id) |
|---|---|
| `desert.md` | The Desert (`desert`) |
| `city-shaft.md` | The City-Shaft (`incal`) |
| `vael.md` | Vael (`arzach`) |
| `vael-ii.md` | Vael II: The Sky Stones (`arzach2`) |
| `sealed-hangar.md` | The Sealed Hangar (`garage`) |
| `buried-machine.md` | The Buried Machine (`buried`) |
| `viridel.md` | Viridel (`edena`) |
| `garden-of-spheres.md` | The Garden of Spheres (`spheres`) |
| `lorn.md` | Lorn (`perdide`) |
| `lorn-ii.md` | Lorn II: The Deep Wood (`perdide2`) |
| `signal-market.md` | The Signal Market (`bazaar`) |

Tip: generate with the hero sheet attached as the style reference, so line
weight, palette and paper texture stay consistent across worlds.

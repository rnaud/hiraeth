# Temple endings (issue #655)

> The author: temple endings should go "pass through a special door → introduction cinematic → minigame →
> completion/world-change cinematic after winning".

Every makers' house now ends on the same four steps. Decided on 2026-10-25 while the author was away ("decide
yourself"); the choice for the twelve houses below is the cheap, consistent one, and each row names the kit game that
could replace its trial later, for the author to approve or not.

1. **The special door**: the guardian hall's own door (the temple's `arenaDoor`), past the house's puzzle and key
   gates, which are unchanged.
2. **The introduction**: two panels, two captions (`src/temples/endings.js`): the guardian, then what is at stake in
   its hall, shown as it is now (the same subject the completion film shows changed: `finale.js` `FINALES[id].sign`).
   Skippable; it plays on every visit's first crossing.
3. **The ending game**: either a **helper** game (a kit minigame on its own page, `?game=<id>`, its success receipt
   carried back) or the guardian's **trial** (its staged fight, played in its hall as a bounded challenge: the door
   shuts behind you, a knock-out retries from the phase it was in without the film, leaving the hall another way calls
   it off with nothing won, a reload plays the introduction again).
4. **The completion film** (`finale.js`) and the world change, as before; the temple's flag and reward once.

| House (world) | Guardian | Door | Ending game | Introduction's second panel | Status | A kit game for it later (not approved) |
|---|---|---|---|---|---|---|
| Rose House (Desert) | the Keeper | `d4` | helper: **Cistern channels** (`cistern`) | the dry basin under the spout | shipped v2.13 | |
| Aerie (Vael) | the Elder | `d3` | helper: **The Elder's flight** (`elderflight`) | the roost's still vent | shipped v2.13 | |
| Warden's Well (City-Shaft) | the warden | `d3` | trial: shoot its vents, then its crown | the four still vanes | converted | Vane breath (`waves`-like juggling) |
| Founders' Belfry (sky stones) | the Cloud-Mother | `d4` | trial: hook the bells as she cries | the stones hung in the air | converted | Bell keeper (the `rhythm` / `drums` lane) |
| Footprint (Garden of Spheres) | the Echo | `dG` | trial: answer its notes on the spheres | a silent sphere on its gallery | converted | Song of the prints (Simon) |
| Engine-House (Buried Machine) | the Tooth-Warden | `d4` | trial: hit its four vents | the jammed great gear, from above | converted | Gear runner |
| Lamp-House (Lorn II) | the Lampless | `d4` | trial: lead it with bubbles of light | the dark great lamp | converted | Lamplighter's walk |
| Hush-House (Lorn) | the Mother Snapper | `dG` | trial: still the crystals, sing the lullaby | the frosted crystals | converted | Hatchling crossing |
| Clock-House (Glass Dunes) | the Clockwork Foreman | `d4` | trial: hit its numerals in step | the stopped wall clocks | converted | Wind the Foreman (the `rhythm` lane) |
| Builders' Greenhouse (Viridel) | the Gardener | `d4` | trial: bloom the beds, then its back | a dry bed | converted | Sun on its back (Cistern channels' cousin) |
| Undertower (Signal Market) | the First Sign | `d4` | trial: play its word back into its dish | the silent word stones | converted | Relay |
| Mooring-House (City in Space) | the Anchor-Warden | `d6` | trial: tether the anchor home when it stalls | the barred gate to the hub | converted | Mooring run (the `rings` route) |
| Casting-House (Moon Foundry) | the Last Founder | `dA` | trial: splash its heart when it opens | the cold moon in its cradle | converted | One whole moon |
| Whale-House (Underwater City) | the Listener | `dA` | trial: stomp the deep note into its ear | the dry floor of the Sounding Hall | converted | Deep call |

Why trials and not twelve new games: the two helper games took a release each to build and tune; the guardians' fights
are already built, fair (`tests/guardian-completable.test.js`) and each asks its house's gadget, so framing them as the
ending game gives every house the same door-to-film flow now. The kit games in the last column are the pitches of
`docs/design/helper-guardians.md`; one moving from trial to helper is a new entry's `kind: 'helper'` and its game.

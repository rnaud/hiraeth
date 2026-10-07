# Progression: the route, the wings before the jets, the cab pass, Vael's bird

## The route (`src/levels/names.js`, `src/story/route.js`)

`ORDER` is the route: the desert, Vael, Vael II, Lorn, Lorn II, Viridel, the
City-Shaft, the Sealed Hangar, the Buried Machine, the Garden of Spheres, the
Signal Market. The desert is always known, then the next two unfinished worlds
(`AHEAD`). `AFTER` holds a world back, uncounted, until another is done:
Vael II waits for Vael, because it needs her bird.

- **The wings first.** Vael is the second world. Its Aerie holds the fluid wings,
  and its main quest rides the wind up the lone tower on them.
- **The jets in the later half.** The City-Shaft is seventh, and it is charted
  only once five worlds are done. Its Warden's Well holds the fluid jets. Every
  world that wants the jets (`features.jetpack`, which gets a safety-net box of
  jets by the ship from `FALLBACKS` in `src/boxes/placements.js`) comes after it.
  `tests/route.test.js` checks this order against the level files.
- Saves keep what they have: items are flags, nothing is taken away, and worlds
  already visited or done stay on the chart.

## After the jets (`src/temples/incal.js`)

A `JetGuide` piece in the Jets' Chamber does three things once the chest is
open. A moment after the box's card, a line says what the jets are for
(`JETS_NEXT`). The drone flies up and points (`game.emit('scout:ping')`,
handled in `main.js`). Pale rings rise from the plinth up through the oculus.
The temple quest gets a `use` stage (`QUEST.use` in the temple's words, done when
`def.used(rt)`: you reached the gallery). The guide fades once you are up there.

## The cab pass (`src/taxi.js`, `src/story/incal-data.js`)

Without the item `cabpass` (flag `item.cabpass`), `taxi.refuses(player, how)`
says no to a hail (the whistle, a glob) and to boarding. It shows
`Taxi.refusal` (the City-Shaft's text names Lio) at most every few seconds, and
calls `Taxi.onRefuse`, which starts the quest `incal.pass`. Lio sends you to
Hask for the fare he owes. Bring the coin back and Lio gives the pass
(`quests.give('cabpass')`). `ITEMS.cabpass` (kind `pass`, `quest: true`) lists
it in the gear. A `free` cab (Wren, the old cab at the bottom's lamp) never asks. In
the depths, once you know Wren, a hail brings Wren.

## Vael's bird, the wind and the flute (`src/story/arzach.js`, `src/bird.js`)

- The bird is `dormant` (not drawn, not boardable, deaf to the whistle:
  `onDormantCall` says why) until `arzach.bird.called`. Older saves that had
  ridden her (`arzach.rode`) keep her. A save on the old `ride` stage moves on to
  `tower`.
- `WIND`: a column of rising air beside the tower's balcony. Open wings in it
  are lifted (`windLift`), and at its top they are turned onto the balcony.
  Without wings it only says where wings are.
- The window is a deep stone arch now, not a flat panel. On the sill lies the
  rider's flute (`fluteModel`, item id `whistle` from older saves). Taking it
  sets the map clue. Playing it plays `RIDER_CALL` (`audio.tune`). The bird
  comes down from high over the haze to the balcony's open rim and bows. From
  then on, calling a bird plays the same tune (`main.js` `onWhistle`).
- Her ground gait (`GAIT`): legs stepping in turn, a bob, a sway and wings
  folded while you walk her. Take-off (`TAKEOFF`) is a crouch, then a leap with
  the wings opening, and the first wingbeat only at the top of the leap.
- Her landing (`LANDING`, `Bird.approach`): within `height` m of the ground and sinking (or within
  `ttc` s of it), her legs come down and reach forward, the wings flare and the body tips nose up;
  ridden, the flare brakes her and holds the last metre's sink to `touch` m/s. Over the last metre
  the legs swing back so the toes meet the ground level. Each foot finds the ground under it on its
  own ray (`FOOT`, on a slope one leg reaches down, the other draws up; standing and walking too).
  Touching down she sinks into her knees (`dip`, `settle`), wings half open, then walks out what is
  left of her speed (`runout`). Called down beside you or circling down riderless, the same.
  `tests/birds.test.js` lands her on flat and sloped ground.

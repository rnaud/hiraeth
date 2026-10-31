# The bell walker (`bell`), #800 family D

Reference: `../../keep-bell/b4852320-c23b-4bf7-a8e2-10c9ede8cabd-1.png` (the approved clean-background revision: "bell, arch,
clapper and four sturdy legs retained"). Straight to the Tripo route (no direct body); it replaces the bell's spider-legged
body in the game, which stays as `legacyBellModel` (src/enemies/plans/siege.js).

- **Generation:** Tripo task `63c37cb8-1f93-478f-8fc3-00e9d53434b6`, image to model, H3.1, texture v3.5 with Remove Lighting,
  PBR off, 30k face target: 29,520 triangles, 2048²; **30 credits** (balance 1,305 → 1,275). Untouched in
  `../../keep-bell/tripo/` with `task.json`. It read as its reference: the pink bell and its skirt, the cream arch, the
  machine behind, the black ball with its slit eyes under the mouth, four blocky legs with brass knees.
- **Prepare** (`../bell-tripo/prepare.mjs`): 3.4 m to the arch's top, centred between the feet, 12,000 triangles by the
  geometry alone (11,747 kept). Parts by geometry: the spirit (a sphere fitted to the black under the bell, r 0.41 m), each
  leg (outboard of the body over its foot, planes at 0.88 and 0.22 m), the arch (in the bell's middle plane, outside its
  radius measured round its own axis), the dome (inside it, over the skirt, under the crown's neck), the hull. Tripo had
  filled half the arch's inside with a web to the dome: dropped (a triangle bridging two parts that never touch, and what
  lies well inside the arch's outer edge). The spirit hung 8 cm lower than Tripo sat it, its eyes clear of the skirt's lip
  (from above, the skirt hid them). Repainted flat in the reference's sampled colours (sage `#728773`, dark `#253e28`,
  pink `#ddbc9f`, cream `#efd7a0`, brass `#ae8c58`, the spirit `#1b2826`; its slit eyes `#e8d9b0` the model's own).
  `public/enemies/bell/body.glb` and `landmarks.json`.
- **Rig and motion** (`src/enemies/plans/bell-tripo.js` on `plans/tripo-rigid.js`): the siege plan (one leg at a time), its
  knees bending forward; the frame turning about its middle (1.6 m). Walk audit (`../motion-audit.mjs bell@bazaar`): slide
  0.006 m a metre (worst 2.1 cm), cadence 0.9 steps a second, each leg its own group.
- **The spirit is the clapper:** on its own pendulum under the mouth (the toll's three swings, the hours tolled softly), the
  only part that takes harm, turning about its centre to look at you (tested both sides).
- **Kept:** id, def, toll and drop with their windows, the whistle, the opening, three plates (round the skirt; the winches'
  round the drum), every skin and its dress (the Market's coins and pennants, the winches' drum, chain and hook), death (a
  shorter sag, 0.6 m, for its 3.4 m: comes apart rigid), the lying body, the Arena warm-up.
- **Checks:** Arena arrivals: typical 16.8 ms, one 33.4 ms first arrival of a winch (before: 50.1 ms), no new programs.
  Defend (`combat-review/defend.mjs --per 120 --near 3`, the new option that holds each foe 3 m before the traveller between
  blows: the stock run never closes in for the drop, before or after): the toll blocks from 0.5 s, the drop blocks from
  0.5 s, parries at 0.06–0.12 s and evades at 0.15–0.25 s (before: 0.5 s, 0.06–0.12 s, 0.25 s). Dodge: the back flip off its
  toll starts a flurry. Bench (six sign automatons, the Signal Market): draws 646 → 491 (High), 492 → 388 (Deck); triangles
  −1 %. Unity (`-fight bells`): both looks draw the Tripo body and rear back for the toll. Tests: `tests/bell-tripo.test.js`.
- **Still off:** a sliver of Tripo's web at the arch's right foot; the dome shivers rather than swinging (it sits on the
  skirt, not hung); the machine behind is Tripo's busy detail, its creases inked close up.

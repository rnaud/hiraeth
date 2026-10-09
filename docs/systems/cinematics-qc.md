# Cinematics QC

Every cinematic on the review page (`cinematics.html`, Debug → Cinematics: 91 of them) is checked for
**technical quality** (it plays cleanly, the camera is never in a wall, the subject is in frame, the HUD
and notices are gone, it skips, it hands control back at a sensible spot, its sound is in time and not
too loud) and for **interest** (a purpose, the right length, varied shots, motion with intent, a beat).
The procedure, the checklist and the rubric are the project skill `.claude/skills/cinematics-qc/SKILL.md`.

## The script: `scripts/cinematics-qc.mjs`

```sh
PORT=5308 node scripts/cinematics-qc.mjs --out output/cinematics-qc/<run> [--only ids|prefix*] [--group "World moments"]
  [--frames 8] [--every 1] [--skip] [--size 844x390 --mobile] [--rest 3]
```

One Vite server (its own port, never 5173) and one muted headless Chrome (its debugging port picked by
Chrome), reused for every cinematic and closed at the end or on Ctrl-C. Each entry is opened as the
review page opens it (`index.html?level=…&cinematicReview=<id>`: temporary progress, the real directors).
A sampler in the page records every frame: playing or not (the ship's director, a moment, a world's own
scene, a box; not a conversation that follows), the camera, the HUD pieces showing, the letterbox, the
skip tag, the subtitle, the lens inside a solid or within 12 cm of one, the traveller in frame behind a
solid, the master bus's loudness. Out of it: `report.json`, `report.md`, and per cinematic a contact
sheet (`sheet.jpg`), N WebP frames and `samples.json`. `--skip` holds Esc 1.2 s in and checks it ends
within ~3 s with no menu opened; the box card is dismissed and the homecomings' cargo check confirmed as
a player would. The pure parts (`analyse`, `scoreTechnical`, `inkDensity`, `spread`, `pickEntries`,
`formatReport`) are tested in `tests/cinematics-qc.test.js`.

Known limits: a world whose gravity turns (the Space City's arrival) reads as hundreds of cuts; space in
the arrivals reads as "nearly empty" frames; the prologue and the homecomings are partly played, so
they time out and are judged from their frames; occlusion by fire or leaves is by eye (only solids are
cast against).

## The October 2026 pass (v1.1)

Runs: all 91 at 1280 × 720 on High (Apple M-series, Metal), the fixed ones again after each fix, five at
phone landscape (844 × 390, touch emulated: the touch controls hide, the tag reads "tap to skip", the
subtitle and the subject fit), and the skip on one of each kind (a moment, a home scene, a box, a
recording, an arrival, the takeoff, the Lantern): all ended within 1.6–3 s.

### Headline findings

After the fixes 86 of 91 score 4.5–5 technically; the five left are the Spheres temple's box (sunk into
its dais) and the long, partly played prologue, homecomings and home arrival, judged by hand. On
interest, 39 pass (4 or 5 of 5): the world moments but the City-Shaft's, the arrivals, the takeoff, the
trailer, home's stone. Of the 52 that need work, 49 are three designs repeated: the 32 box openings (one
scene for every box), the 14 recordings (one long push-in each), the homecomings (and the home arrival
that leads into them); the prologue, the City-Shaft's blank billboard and the window seat's single angle
are the rest. All are `TODO.md` items, not fixes, as they want new staging.

- **Notices over scenes.** A quest's card (the world's opening toast) sat across the top of recordings,
  arrivals, the takeoff and every box opening: only the filmed moments held toasts back. The gadget
  badge (bottom left) and the tank's gauge showed through moments too.
- **The pale star floated in every close-up.** The makers' star was pinned to where a hood's brow would
  be; the traveller has no hood, so in every moment's last panel it hung in the air by his face.
- **Lens in the ground.** Moments only pulled the lens out of colliders, and the terrain isn't one: on
  a slope, Vael's first panel was shot from 3 m inside a dune.
- **The Lantern's arrival** was the weakest: empty dusk with the lantern under the caption, then a lens
  pulled in against the crown's rail (white, then grey); its chime rang at 4.8 s because beats ran in
  the order listed, not by time.
- **Home's quiet scenes**: one angle each, the stone's held 15 s on his back, the window seat cutting his
  head off; neither showed a skip tag.
- **Boxes**: the reveal cut 1.2 m between two almost identical angles, which read as the camera jumping.
- The world moments otherwise hold up: four panels, a clear beat, his face last, 8.6–11.5 s, control back
  at the climax. No console errors anywhere. Loudness (RMS on the master, before its compressor): moments
  peak at −27 to −12 dBFS, every arrival's engines and the takeoff at −10.5, the homecoming at −6.9; none
  over the −6 flag.

### What changed in the systems

- `Cinema.dark()` (`src/ship/cinema.js`): toasts wait while the letterbox is down, unless the scene is one
  you walk through (`controls(true)`); a toast that went up just before is put back in the queue. The skip
  tag's words change only as it shows (a moment's tag no longer flashes "hold ESC to skip" as it fades).
- `index.html` / `src/gadgets/hud.js`: `body.cine-on` hides the tank's gauge (`#tool`) and the gadget
  badge, aiming mark and wheel.
- `Moment` (`src/story/moment.js`): the lens keeps `GROUND_CLEAR` (0.45 m) above the terrain in every
  panel; beats are sorted by time.
- `src/boxes/effects.js`: the star goes on the hood's brow only when a hood is up, otherwise on the lapel
  (`LAPEL_STAR` for the game's traveller, `TRAVELLER_STAR` for the outfit rig).
- `src/boxes/scene.js`: the reveal pushes in from the first angle over `PUSH_IN` (0.8 s).
- `src/story/lantern.js`: three panels (`LANTERN_SHOTS`); `src/story/home.js`: the stone's second angle
  (`HOMAGE_FACE`), the window seat framed wider, the skip tag on both; `src/story/desert-moments.js`: the
  fill's panel C from his side; `src/story/arzach-moments.js`: panel A on the lower side.
- `src/ship/cinematics.js` `planetDistance`: the approach planet's near face stays 110 m off, behind the
  ship, however large it grows (same size on screen).
- The review page imports notes (`Import`, merged by date): `docs/systems/cinematics-qc-notes.json` holds
  this pass's verdict and note for every cinematic.

### The follow-up (v1.2, the same day)

The TODO items worked through, each re-run with the script (`--only` the ids touched) and its frames looked at;
the table below carries the new scores and says "v1.2:" for what changed.

- **Two findings were not what they looked like.** The City-Shaft's blank billboard was the review page's
  staging: it called the film alone, so the splinter never landed and LOOK UP was never shown (in play it was).
  The Lantern's "dark disc" was the dusk's moon: the light itself was above the frame until 3 s. Both were
  found with the script's new `--probe` (an expression evaluated at every screenshot). The skill now says to
  check the staging before judging a shot.
- **Fixes:** the temple chests of the Garden of Spheres and both of Lorn stood sunk into their daises (a lathe
  collider with no top a ray lands on); the City-Shaft hands back behind him (`Moment` `behind`); Vael's long
  lens keeps the horizon (`riseLook`); the Lantern frames the crown and the light together (`frameBoth`); the
  window seat has a second angle; the pale star's words say overshirt.
- **Variety:** the recordings cut at their lines between four angles (`callCuts`): 3 shots in the shortest,
  9 in the longest, words and timing unchanged; the box openings take one of four camera plans per box
  (`BOX_PLANS`): 8 / 8 / 9 / 7 boxes, a plan that would stand behind a wall falls back to the first; the
  homecomings' setting-down cuts between four angles at the stone (`tombCuts`, 14–19 shots).
- Scores: interest passing (4–5) went from 39 to 82 of 91; technical 4.5–5 from 86 to 87 (the Spheres' box).
  Left as they were: the prologue (judged by hand), the arrival at home, the 8 boxes on the first plan (3:
  the same scene as before, by design for the first box and as the fallback).

### The table

Tech: the script's score on the first run (its heuristics, rescored with the final rules) → the score
after the fixes, by eye. Interest: by eye, one point each for purpose, length, shot variety, motion with
intent, a beat. Creative rework is in `TODO.md`, "Cinematics (QC pass)".

<!-- table -->
| Cinematic | Length | Cuts+1 | Tech /5 (script, first run → after) | Interest /5 | Problems found | Fixed |
|---|---|---|---|---|---|---|
| `prologue` · The crash · prologue | 150.2 s | 4 | 3 → 3 | 4 | Long and played (the crash, then a walk through the ship): no letterbox in the walking parts by design; the script can only time it out | Judged by hand (TODO) |
| `desert.flow` · the water runs for the first time | 11.5 s | 5 | 5 → 5 | 4 | Panel B frames the gutter from very close, the wall filling half the frame; the face held 3 s | — |
| `desert.fill` · the empty tank fills | 11.2 s | 3 | 4 → 5 | 4 | The tank’s gauge showed over the letterbox; panel C was shot from just behind his head, his hair a black blob filling half the frame, the glove and the glob unseen | Gauge hidden in cinematics; panel C reframed from his side with the pool |
| `arzach.bird` · the bird comes down out of the haze and bows | 10.2 s | 4 | 3.5 → 5 | 5 | Panel A shot from 3 m inside a dune on a slope (107 frames); B was 2 s of plain sky; the pale star floated by his face in C | Lens kept above the terrain; A takes the lower side; star on the lapel; v1.2: B keeps the horizon and the haze’s towers at its foot (riseLook), she starts 90 m up |
| `arzach2.bell` · the bell rings after thirty years and the cloud settles | 9.8 s | 4 | 5 → 5 | 5 | The pale star floated by his face in D; the tag flashed “hold ESC to skip” as it faded | Star on the lapel; tag text fixed |
| `perdide.crystal` · the cave sings the light’s phrase back to the splinter | 9.8 s | 4 | 5 → 5 | 4 | Gadget badge over the first frames; star by his face | Badge hidden; star fixed |
| `perdide2.pools` · the last dark pool is lit and the saucer blinks back across the water | 10.0 s | 4 | 5 → 5 | 4 | Gadget badge over the first frames; star by his face | Badge hidden; star fixed |
| `edena.terraces` · the cistern gate gives way and the flood takes the terraces | 8.8 s | 4 | 5 → 5 | 5 | Gadget badge; star by his face | Badge hidden; star fixed |
| `incal.lodestar` · the Lodestar lights again over the shaft | 9.0 s | 4 | 5 → 5 | 4 | Panel C’s billboard read blank: the review page called the film alone, so the light never landed and LOOK UP never showed; at 85 m and 26° the words would have been a smudge anyway; camera jammed against his head after the hand-back | v1.2: staged as play (giveBack, on the terrace, looking up); C framed from about 45 m at 22°, LOOK UP reads; hands back behind him (`behind`) |
| `garage.signal` · the signal is read through the ring’s slit | 10.0 s | 4 | 5 → 5 | 5 | Star by his face | Star fixed |
| `buried.wheel` · the great wheel turns, and goes on turning | 9.4 s | 4 | 5 → 5 | 5 | Star by his face | Star fixed |
| `spheres.chord` · the pole rings with the three spheres’ chord | 8.6 s | 4 | 5 → 5 | 4 | Star by his face | Star fixed |
| `bazaar.broadcast` · the silent tower broadcasts again | 9.6 s | 4 | 2.5 → 5 | 4 | Panel B (the signs going white) is a tilted wall with one small white sign | — |
| `lantern.arrive` · The light returns to the Lantern | 10.0 s | 3 | 4.5 → 5 | 5 | Panel A was empty dusk; B pulled in against the crown’s rail; chime at 4.8 s; then the light was above the frame until 3 s (the dark disc seen was the dusk’s moon) | Three panels; beats in time order; v1.2: the light comes from out past the crown, A frames the crown low and the light high (frameBoth), never under 3.2° on screen |
| `homecoming.first` · First homecoming | 120.2 s | 19 | 3.5 → 4 | 4 | Long and partly played; the cargo check waits for a press; the tokens were laid one by one on one held angle for over a minute; pops at 7.4 and 14.8 s (in space, by design: the cuts of the approach) | Script confirms the cargo check; v1.2: the setting-down cuts between over his shoulder, his hands along the slab, his face from the headstone and Lou as she speaks (tombCuts), 4 s at least each |
| `homecoming.final` · Final homecoming | 132.7 s | 14 | 3.5 → 4 | 4 | As the first homecoming | As the first homecoming (tombCuts) |
| `home.homage` · At the stone | 14.6 s | 3 | 3 → 5 | 4 | One angle held for 15 s, his back to us throughout; no skip tag | A second angle on his face from beside the stone; skip tag |
| `home.windowSeat` · The window seat | 9.5 s | 3 | 3 → 5 | 4 | His head cut off as he sits and stands; no skip tag; one angle for 9.5 s | Framed wider and higher; skip tag; v1.2: a second panel for the second line, from beside the seat, his profile against the round window (seatSide) |
| `call.1` · Recording 1 · Home | 25.4 s | 3 | 4 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `call.2` · Recording 2 · ·· WORN ·· | 35.4 s | 1 | 4 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `call.3` · Recording 3 · LOGGED 19 YEARS AGO | 40.6 s | 4 | 4 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `call.4` · Recording 4 · LOGGED 16 YEARS AGO | 58.1 s | 1 | 4 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `call.5` · Recording 5 · LOGGED 4 YEARS AGO | 54.7 s | 1 | 4 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `call.6` · Recording 6 · THE LAST RECORDING | 76.7 s | 9 | 4 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `call.7` · Recording 7 · THE LAST RECORDING | 76.9 s | 1 | 4 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `call.8` · Recording 8 · THE LAST RECORDING | 77.0 s | 1 | 4 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `call.9` · Recording 9 · THE LAST RECORDING | 76.9 s | 1 | 5 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `call.10` · Recording 10 · THE LAST RECORDING | 76.6 s | 1 | 4 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `call.11` · Recording 11 · THE LAST RECORDING | 76.4 s | 1 | 4 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `call.ilen` · Recording ilen · FOR WHEN HE ASKS | 58.6 s | 1 | 4 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `call.ilen.after` · Recording ilen.after · LOGGED 5 YEARS AGO | 32.3 s | 1 | 4 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `call.trace` · Recording trace · LOGGED 3 YEARS AGO | 41.5 s | 1 | 4 → 5 | 4 | A quest’s card over the recording (every recording reviewed in the desert); one continuous push-in for 25–77 s | Notices wait for the scene’s end; v1.2: cuts at the start of lines while the busts are up (callCuts: the two faces close, his face from over the dash, wide with the window; his own lines on his face; 4.5 s at least each), back behind him as they fold |
| `arrival.desert` · Arrival · The Desert | 17.8 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.arzach` · Arrival · Vael | 18.1 s | 6 | 4 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.arzach2` · Arrival · Vael II: The Sky Stones | 17.4 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.perdide` · Arrival · Lorn | 17.9 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.perdide2` · Arrival · Lorn II: The Deep Wood | 17.6 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.edena` · Arrival · Viridel | 17.6 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.incal` · Arrival · The City-Shaft | 17.4 s | 6 | 4 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.garage` · Arrival · The Sealed Hangar | 17.4 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.buried` · Arrival · The Buried Machine | 17.4 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.spheres` · Arrival · The Garden of Spheres | 17.4 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.bazaar` · Arrival · The Signal Market | 17.7 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.mangrove` · Arrival · The White Mangrove | 17.3 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.glassdunes` · Arrival · The Glass Dunes | 17.3 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.waterfall` · Arrival · The City Behind the Waterfall | 17.4 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.saltharbour` · Arrival · The Salt Harbour | 17.3 s | 6 | 4.5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.antennas` · Arrival · The Forest of Antennas | 18.1 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.underwater` · Arrival · The Underwater City | 18.4 s | 6 | 4.5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.eclipse` · Arrival · The City During the Eclipse | 17.2 s | 6 | 4.5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.fallenring` · Arrival · The Fallen Ring | 17.4 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.moonfoundry` · Arrival · The Moon Foundry | 17.4 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.underside` · Arrival · The Underside | 17.4 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.spacecity` · Arrival · The City Floating in Space | 17.4 s | — | 4.5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.overnighttrain` · Arrival · The Overnight Train | 16.4 s | 6 | 5 → 5 | 4 | Quest cards over some arrivals; space frames read as empty by design; the planet could, at its largest, come in front of the ship | Notices wait; planet kept behind the ship |
| `arrival.home` · Arrival · Home | 45.2 s | 1 | 3.5 → 4 | 3 | Leads into the homecoming’s cargo check (a choice) | As the homecomings |
| `arrival.lantern` · Arrival · The Lantern | 17.1 s | 6 | 4 → 5 | 4 | A quest card over the landing | Notices wait |
| `takeoff` · Departure · takeoff | 7.4 s | 2 | 4 → 5 | 4 | A quest card over the lift-off | Notices wait |
| `box.desert.backpack` · Makers’ box · backpack | 8.9 s | 1 | 4.5 → 5 | 3 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one shoulder (over his right shoulder, as before) |
| `box.desert.star` · Makers’ box · star | 8.7 s | 2 | 4.5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one side (from the box’s side, then from where it stood at the item and his face) |
| `box.desert.temple.fire` · Makers’ box · fire | 8.6 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one high (from above his shoulder, down on the box) |
| `box.incal.soles` · Makers’ box · soles | 8.6 s | 2 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one side (from the box’s side, then from where it stood at the item and his face) |
| `box.incal.temple.jetpack` · Makers’ box · jetpack | 8.7 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one left (over his left shoulder) |
| `box.incal.bridge` · Makers’ box · bridge | 8.7 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one left (over his left shoulder) |
| `box.arzach.hush` · Makers’ box · hush | 8.7 s | 2 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one side (from the box’s side, then from where it stood at the item and his face) |
| `box.arzach.temple.glider` · Makers’ box · glider | 8.7 s | 2 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one side (from the box’s side, then from where it stood at the item and his face) |
| `box.arzach.hook` · Makers’ box · hook | 8.7 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one left (over his left shoulder) |
| `box.arzach2.scarf` · Makers’ box · scarf | 8.7 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one left (over his left shoulder) |
| `box.arzach2.temple.bell` · Makers’ box · bell | 8.6 s | 1 | 5 → 5 | 3 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one shoulder (over his right shoulder, as before) |
| `box.arzach2.springs` · Makers’ box · springs | 8.7 s | 2 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one side (from the box’s side, then from where it stood at the item and his face) |
| `box.garage.level` · Makers’ box · level | 8.6 s | 1 | 5 → 5 | 3 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one shoulder (over his right shoulder, as before) |
| `box.garage.temple.coil` · Makers’ box · coil | 8.6 s | 1 | 5 → 5 | 3 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one shoulder (over his right shoulder, as before) |
| `box.garage.magnet` · Makers’ box · magnet | 8.6 s | 1 | 5 → 5 | 3 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one shoulder (over his right shoulder, as before) |
| `box.buried.resin` · Makers’ box · resin | 8.6 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one high (from above his shoulder, down on the box) |
| `box.buried.temple.cell` · Makers’ box · cell | 8.7 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one high (from above his shoulder, down on the box) |
| `box.buried.monocle` · Makers’ box · monocle | 8.6 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one left (over his left shoulder) |
| `box.edena.pouch` · Makers’ box · pouch | 8.7 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one high (from above his shoulder, down on the box) |
| `box.edena.temple.bloom` · Makers’ box · bloom | 8.7 s | 1 | 5 → 5 | 3 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one shoulder (over his right shoulder, as before) |
| `box.edena.bubble` · Makers’ box · bubble | 8.7 s | 2 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one side (from the box’s side, then from where it stood at the item and his face) |
| `box.spheres.shell` · Makers’ box · shell | 8.7 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one left (over his left shoulder) |
| `box.spheres.temple.lens` · Makers’ box · lens | 8.7 s | 2 | 5 → 5 | 4 | As every box; and the box sat sunk into the dais (its lathe had no top a ray lands on), so the camera framed off it was low and cut his head off | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one side (from the box’s side, then from where it stood at the item and his face); the dais solid as two cylinders (Lorn’s two temples too): the chest on top, his head in frame |
| `box.spheres.bomb` · Makers’ box · bomb | 8.7 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one left (over his left shoulder) |
| `box.perdide.reed` · Makers’ box · reed | 8.7 s | 2 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one side (from the box’s side, then from where it stood at the item and his face) |
| `box.perdide.temple.stun` · Makers’ box · stun | 8.6 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one high (from above his shoulder, down on the box) |
| `box.perdide.fan` · Makers’ box · fan | 8.6 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one high (from above his shoulder, down on the box) |
| `box.perdide2.moss` · Makers’ box · moss | 8.7 s | 2 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one side (from the box’s side, then from where it stood at the item and his face) |
| `box.perdide2.temple.lantern` · Makers’ box · lantern | 8.7 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one high (from above his shoulder, down on the box) |
| `box.perdide2.boomerang` · Makers’ box · boomerang | 8.6 s | 1 | 5 → 5 | 3 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one shoulder (over his right shoulder, as before) |
| `box.bazaar.temple.echo` · Makers’ box · echo | 8.7 s | 1 | 5 → 5 | 3 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one shoulder (over his right shoulder, as before) |
| `box.bazaar.recall` · Makers’ box · recall | 8.7 s | 1 | 5 → 5 | 4 | A quest card over the scene; the reveal cut 1.2 m between two near-identical angles (read as a jump); the same scene for all 32 boxes | Notices wait; the reveal pushes in; v1.2: one of four camera plans per box, this one left (over his left shoulder) |
| `trailer` · Hiraeth · in-engine trailer | 48.0 s | — | 5 → 5 | 5 | Frames only (scrubbed); no problems seen | — |
<!-- /table -->

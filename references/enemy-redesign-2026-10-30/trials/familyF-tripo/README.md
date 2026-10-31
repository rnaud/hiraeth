# Family F on Tripo bodies (#800): the creatures and spirits

The blot, the worm, the root knot and the wisp, rebuilt one at a time by the skill's recipe
(`.claude/skills/enemy-rework/references/tripo-rebuild.md`), each from its approved image, each landed in the game
replacing its archetype's body. The replaced builder stays in the repository under a `-legacy` name, standing in where
the new body is not loaded, so its look can come back as a foe of its own. Family A's tools (`../familyA-tripo/`) are
used as they are where they fit: `prep-kit.mjs`, `splat.mjs`, `warm-check.mjs`, `bench-world.sh`, `pair-shots.mjs`.

## The scripts

| Script | What |
|---|---|
| `generate.mjs <blot\|worm\|rootknot\|wisp> [--dry] [--again n]` | the Tripo generation (H3.1, texture v3.5, Remove Lighting, 30k faces): the untouched export and `task.json` (credits, the balance before and after) into the concept folder's `tripo/` (`--again n`: a second try into `tripo/again-<n>/`) |
| `probe.mjs <glb> <height> [k]` | an export's colours (k-means) and where each lies in the game's frame, for placing the cuts |
| `spine.mjs` | a long body's spine measured from its mesh (slabs across it from the tail's tip) |
| `prepare-<foe>.mjs` | one foe's asset: `<foe>-lod.glb`, `<foe>-landmarks.json`, `<foe>-texture.png` (the trial's; the game ships no picture) |
| `../../../../scripts/tripo/ship-body.mjs <foe>` | the game's file, `public/enemies/<foe>/body.glb` and `landmarks.json` |
| `shots.mjs <out> <name>=<kind@skin>[:pose[:at[:yaw[:pitch[:zoom]]]]] …` | working pictures of this checkout's foes through the creatures gallery |
| `bench-sum.mjs <bench.jsonl>` | `../familyA-tripo/bench-world.sh`'s runs as a table: what six add over none, before and after |

## The ink blot (`blot`)

Reference: `../../blob/eb43fb37-f063-47ab-9a4f-212ba29d443b-2.png` (approved). Task `ebbb5fc2-…`, 30 credits (balance
1,065 before; 945 after the four family F generations ran together). Home skin `desert` (the Desert's sand-edged blot);
22 skins in all.

- **What it is**: Tripo's 29k-triangle drop at 1.05 m to the tip of its hook (the legacy's 0.9 m drop and its splash),
  cut to 6,520 triangles (6,000 decimated, the cuts adding the rest). Tripo took the picture's view for the front, so the
  export is turned 30° about its foot to centre the painted eyes on +z. Three parts by geometry: the belly plate inside the
  ellipse fitted to its tan texels on the front (its raised plate's crease), the lilac flank beyond a plane on its right
  side, the ink. Tripo painted a whole half lilac (the picture's light on its left edge, seen half a turn aside): seen from
  the front, as it comes at you, that put a third of its face and an eye in lilac, so the plane is turned out to its right
  flank (20° ahead of square) and moved out past the right eye; from the front it is the picture's crescent down one edge.
  The painted eyes painted out.
- **The rig** (a soft body: no family fits; the nearest is the rigid parts', a drop that squashes rather than bends): one
  skinned mesh a part on two bones, the drop and its hook (above the eyes, blended over 0.74–0.98 m), the hook a spring
  that trails the hop's rise and fall and leans in as it rears. The drop squashes and stretches, coils and rears as the
  legacy did (the same formulas: the hop's phase by the distance covered). The eyes are cream ovals at the painted ones'
  size where they were, the slit pupils sliding toward the traveller (the author's rule). The pool (ink over the ragged
  rim of the world's colour, the legacy's) shows only as it melts down calm and spreads under its coil; standing, it is a
  drop of its own (the approved design: the floor-attached one was rejected).
- **Skins**: each keeps its palette (ink, light, eyes) and its world's edge colour, now on its belly plate too (`belly` in
  `skins.js`; the Desert's the reference's tan, its sand edge kept for the pool); the home skin wears the reference's
  colours; the Sealed Hangar's keeps its shavings, set on the measured surface. Surfaces: the ink's streaked gloss and
  mottle as before, a soft gloss and fade on the flank, a blotch on the belly.
- **Measured**: bind round trip < 0.1 mm; the hook bent alone moves nothing under the eyes. Six blots in the Desert (two
  rounds each, alternating, load 5–12): draws +342 → +87 (High), +228 → +60 (Handheld); triangles +31k → +128k (High);
  the script's time a frame +1.0 → +0.55 ms (High), +0.7 → +0.15 ms (Handheld). Arena warm-up: all 22 skins brought in
  after the Arena's load compile nothing at arrival (the legacy's Hangar skin compiled one); first frames 0.8–9 ms, one
  ~270 ms frame for the Hangar's skin as the legacy's (295 ms: not a program; the skin is not in the Arena's run).
  Defend: lunge and combo guarded from 0.5 s, parried at 0.06–0.12 s (a second run; the first missed one parry at 0.06 s),
  the lunge evaded at 0.08–0.15 s, as before (the baseline: parried at 0.06–0.12 s). Dodge: a back flip into the flurry.
  Sound unchanged: `ink` and the `blob` steps on target (0.0 dB off).
- **Still off**: the pool's ragged rim is the legacy's (a jagged flat shape); the eyes are smaller than the legacy's big
  round ones (the reference's size); its pooled state is not in the changelog pictures (the gallery stands it up).

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

## The dune worm (`worm`)

Reference: `../../dune-worm/ca727e90-9d58-49d2-a060-bbbd815e325f-3.png` (approved). Task `4cea24a8-…`, 30 credits (run with
the other three: 1,035 → 945 as the four finished). Home skin `desert` (the Desert's dune worm).

- **What it is**: Tripo's 30k-triangle grub (drawn facing +z: kept), scaled so it is the legacy's metre thick (2.6 m to its
  reared crown, 3.7 m along its spine), cut to 13,368 triangles. Its spine measured from the mesh (`spine.mjs`: a slab
  across the body each 0.12 m from the tail's tip, its middle the next point). Four parts by geometry: the cream belly is
  each point's angle round the spine from the inside of its curl under an edge fitted to the cream texels in 0.3 m bins
  along the spine and smoothed (on the head only the chin under the mouth: Tripo creamed the face round the mouth), the
  crown over a plane on the head, the turquoise mouth and its throat inside cylinders round the mouth's axis; the rest
  the ochre body. The painted eye dots painted out.
- **The rig** (the long body's, as family A's centipede): 16 bones along the spine (every second point), each vertex
  shared by the two round its place on it; the head a bone of its own at the end (blended in over its last 0.55 m), turned
  to the traveller (0.45 rad), the eyes, the teeth and the skin's drill or crest on it. Up, the chain stands out of the hole
  as the legacy's ring stack did: the burrower plan's pose and wave bend its top 2.6 m, the tail stands straight down in
  the sand, bunched up under −0.35 m (8 % of its depth, 0.55 of its girth: in the gallery a little of it shows under the
  hole, in the worlds the ground hides it); it swells and bunches to spit, the mouth widening, and leans over to dive, the
  teeth spinning. The reference's lying S-curve is not kept: it is a burrower, met standing out of its hole. Under, the
  legacy's mounds, fin and ripple on the head's path, the body hidden.
- **Skins**: the home skin the reference's colours; the drill grub (slate violet, a lavender belly, its drill) and the glass
  worm (mint glass, its crest) keep theirs, each belly its fin's pale (`belly`). The legacy's ivory sail along its back is
  gone (the approved design has none); the fin under the sand stays.
- **Measured**: bind round trip < 0.1 mm, every bone carrying vertices. Up: 7 meshes drawn (the legacy's 23), 14k
  triangles; under, 8 (mounds, fin, ripple). Six worms in the Desert, as they roam (under the sand): draws +147 → +143 (High),
  +96 → +96 (Handheld), the same mounds; the script's time a frame not separable (−0.2 / +0.4 ms). Arena warm-up: the
  three skins compile nothing at arrival (first frames 1.6–2.3 ms). Defend: erupt guarded from 0.5 s and parried at 0.12 s,
  the dive parried at 0.06–0.12 s, as before. Dodge: a back flip into the flurry. Sound unchanged (`earth`, the `burrower`
  steps on target). Unity: `-fight worm` winds up its dive, up out of the sand: the same body, pictured.
- **Still off**: standing straight, it does not have the reference's S-curve; its belly reads grey in its own shade; a
  little of its bunched tail shows under the hole where no ground hides it (the gallery).

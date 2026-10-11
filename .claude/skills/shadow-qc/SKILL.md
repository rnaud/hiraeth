---
name: shadow-qc
description: Check the quality of Hiraeth's sun shadows in motion — shadow acne, peter-panning (the shadow come loose from its foot), light leaks, shadows of casters off screen gone missing, shimmer and swimming of shadow edges as the camera moves, pops and seams where the cascades hand over, and the traveller's own shadow (how much of it is drawn, how far from his feet it starts) — by walking him through the Shadow Room (?level=shadows) in headless Chrome on High, Steam Deck and Handheld, evaluating the game's own shadow lookup at fixed probes every frame against ray-traced truth, and reporting per spot with numbers against thresholds and contact sheets of the worst frames. Use after any change to src/shadows.js, the cascades or presets in src/perf.js / main.js, materials.js's shadow lookup (SHADOW_GLSL: bias, normal offset, filter), when someone says shadows flicker, crawl, detach, go missing or look noisy, or before a release.
---

# The shadow QC

The sun's shadows (docs/systems/rendering.md: "Smooth cast-shadow edges", "Stable in motion", "The Shadow Room and
the shadow QC") are judged on what the surfaces actually draw, frame by frame, against the truth. The Shadow Room
(`src/levels/shadow-room.js`, Debug menu → Test rooms) lays the hard cases along one walk; the QC walks the
traveller through it and, every frame:

1. evaluates **the surfaces' own shadow code** (`SHADOW_GLSL`, compiled into a point shader: the frame's three
   cascade maps, their matrices, biases, normal offsets, the tent filter, the steepening) at ~350 000 fixed probes
   on the room's surfaces (`SHADOW_ROOM.receivers`: grids cast onto the ground, the walls, the stair risers, the
   tower's face), and whether each is on screen (against the G-buffer's depth) and its pixel's footprint;
2. compares each with **the truth**: a ray from the probe to the sun (the maps' quantised direction) through a BVH
   of every static caster, traced once per sun (`scripts/shadow-qc/probes.js`); the traveller's body is rebuilt
   as a BVH every frame (skinned as drawn) and laid probes on the ground under his shadow;
3. counts per spot (`scripts/shadow-qc/lib.mjs`) and keeps the worst frames, the misjudged probes marked.

## 1. Run it

```sh
export PATH="/Users/anf/Library/Application Support/Zed/node/node-v24.11.0-darwin-arm64/bin:$PATH"
VITE_CACHE=$PWD/.vite-cache node .claude/skills/shadow-qc/run.mjs <scratch>/shadows [--presets high,deck,handheld] [--suns 35/90,12/90] [--only props,stairs] [--look 5] [--walk]
```

- One muted headless Chrome (`--mute-audio`, the game's volumes at 0) and one Vite server, both closed at the end.
  PORT (default 5371; **never 5173**, the author's own server), CDP (default 5372). `VITE_CACHE` a dependency cache
  inside the checkout (a worktree whose node_modules is a link to the main checkout's needs it).
- A run is a preset and a sun (`el/az` in degrees: 35/90 is a morning sun from the east, 12/90 a low one that
  grazes the slopes), on a fresh boot. The walk runs (Shift) and stops at each `look` waypoint to turn the camera
  once round (`--look` seconds; 0 skips): the turn is the pure camera-motion test, the traveller standing still.
  A full run is about 3–4 minutes (the readback and the truth slow the game to ~20 fps; the measures are per frame,
  so compare runs with runs).
- Writes `shadows.json` (per run and spot: the counters, the measures, the verdict), `shadows.md` (the table),
  `<run>.<spot>.png` (the worst four frames, the misjudged probes dotted: red acne, blue leak, orange peter-pan,
  magenta off screen, yellow shimmer, cyan pop, green seam) and `<run>.series.json` (a line a frame). Exits 1 if a
  spot is red.

## 2. The spots (`SHADOW_ROOM.spots`)

| spot | what |
|---|---|
| props | crates, a bucket, a stool, bollards, a lamp post, a ball, a bench round the spawn (and the sun's boards) |
| poles | six poles from 20 cm down to 6 mm, a grate of 3 cm bars overhead, a fence of 2 cm bars |
| colonnade | ten columns and their beam: stripes across the walk |
| foliage | a pergola of two layers of leaf cut-outs (real holes: the depth pass has no alpha) |
| arch | an arch to walk through, a balcony and an eave over a wall (overhangs; the wall's foot) |
| stairs | 17 steps of 18 cm, a terrace with balusters, a ramp down |
| slopes | wedges of 25°, 30°, 33° rising toward the sun's east and a mound: grazing light at 35° |
| interior | a closed house with a door north and a slit window east: light to dark |
| movers | a lift, a slider (both stood on), a pendulum, a fan, a rolling ball |
| tower | an 82 m tower (shaft, balconies, a lattice crown, a spire): its shadow crosses all three cascades |

The boards by the spawn (interact) hold the sun lower, turn it round, give it back to the clock, stop the movers;
`level.shadowRoom` does the same from code (`setSun(el, az)`, `useClock(hour)`, `freeze()`).

## 3. What is measured (`scripts/shadow-qc/lib.mjs`, tested by `tests/shadow-qc.test.js`)

A probe is judged only where the truth is clear: further from the truth's nearest edge than the lookup can honestly
be off (the tolerance: the tent's half-width on the cascade it reads, 2.5 texels with 9 taps, 1.5 with 4, widened
to the pixel up to 2.5 times; the normal offset; half the probe spacing; 3 cm). A probe its patch's grid calls clear
but that is judged wrong is looked round first (rings of rays out to 1.6 m: a fence's 2 cm bars fall between
probes 6 cm apart). Probes the movers or the traveller could shade (this frame or the last) are left out of all but
the traveller's own measure; so are faces turned from the sun or grazing it under `FACET_EDGE`.

| measure | what | limit (green) |
|---|---|---|
| **acne** | lit in truth, drawn in shade (self-shadowing specks) | ≤ 0.2 % of the lit probes |
| **leak** | shaded in truth, drawn lit, not at a contact | ≤ 1 % |
| **peter-pan** | shaded by something within 0.6 m (a post's foot, a wall's), drawn lit | ≤ 5 % of those |
| **off screen** | shaded by a caster outside the view frustum, drawn lit (the shadow culler) | ≤ 1 % of those |
| **shimmer** | a probe near an edge changing its lit fraction by over 0.2 between frames, nothing moving over it, the light still, the cascades' blend unchanged (texel snapping, sub-texel rasterisation, the filter's spread) | ≤ 0.4 % of the edge probes a frame |
| **pops** | the same where the cascades' blend changed under it (a cascade's edge passing) | ≤ 0.2 % a frame |
| **seams** | in a cascade's fade band, the two cascades' answers (steepened) differing by over 0.5 | ≤ 8 % of the band's probes |
| **his shadow** | of his true shadow's area on the ground, the share drawn (1 − lit, weighted by area) | ≥ 70 % |
| **spill** | drawn shade outside his true shadow, as a share of it (blur, offset) | ≤ 35 % |
| **gap** | from a planted foot along the shadow's way, how much later the drawn shadow starts than the true one (p90) | ≤ 6 cm |

A spot needs 200 judged probes of a kind (10 frames of his shadow) before it is called. Look at the contact sheet
before believing a number.

## 4. Reading it, and the usual causes

- **Peter-pan at every foot** (a wall's, a post's, his): the depth bias (`Cascade` `bias`, in texels) lets a
  point within bias × texel of its occluder along the light count as lit; with no fine map (Steam Deck, Handheld)
  the near map's texel is 6–16 cm and the gap is that times the bias. The normal offset lifts the lookup off the
  surface and is what keeps grazing faces clean; the constant bias need only cover the depth's own steps.
- **Acne on the slopes at a low sun**: too little normal offset or bias for grazing faces (n·l small).
- **Shimmer on thin things** (the fence, the grate, the 2.5 cm pole): sub-texel rasterisation as the window steps;
  thinner than two texels flickers whatever the snapping.
- **Pops and seams at ~11 m from him on High**: the fine map's edge; what the fine map draws (a 2 cm pole) and the
  near one can't, appears and goes as he walks. The fade band's width trades a visible line for a softer hand-over.
- **Off screen**: a caster the culler dropped (shadows.js `ShadowCuller.hide`): the tower behind the camera.

## 5. Where it stands

docs/systems/rendering.md, "The Shadow Room and the shadow QC", has the tables before and after the fixes. When you
change the shadows: run it before and after on the same machine, put both tables in the docs and the numbers in the
changelog's media (docs/systems/changelog.md), and check two real worlds by eye (they share every setting).

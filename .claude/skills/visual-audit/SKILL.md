---
name: visual-audit
description: Look for what is wrong in Hiraeth's pictures — visual artifacts, lighting and shadow problems (acne, peter-panning, leaks, black or blown areas, shadows in caves and interiors), screen-space masks that ghost round people or slide as the camera turns, lit seams in caves and rooms, flicker and shimmer in motion, clipping and floating props, LOD pops, off-style colours, face and character problems — world by world and hour by hour, and write docs/audits/visual-v<version>.md with each problem's picture, cause and fix. Use when asked about visual quality, artifacts, glitches, lighting or shadows, or before a release. The broad sweep: shadows in motion go to shadow-qc, line weight and ink to ink-lines, coplanar stripes (z-fighting) to zfight-qc.
---

# The visual audit

This is a hunt for what looks wrong, not a review of the art direction: the style is judged in the
game audit (theme 7). Every finding is a picture you can point at, with its world, view, hour and
preset, and a likely cause in the renderer. Each report is `docs/audits/visual-v<version>.md`,
compared with the last.

Read first:
- `docs/systems/rendering.md`: the passes, the cast shadows, the ink shadows, smooth shadow edges,
  "Shadows close up", "Stable in motion", debug views;
- `docs/systems/materials.md`;
- `docs/systems/references.md`: the reference sheets each world is drawn after;
- `docs/systems/dev-tools.md`: the clipping audit;
- `docs/systems/movement.md`, "Contact";
- the open visual issues on GitHub (https://github.com/rnaud/hiraeth/issues; `gh issue list --search …`), such as
  shadow artifacts in caves and interiors and the traveller's face (TODO.md keeps their long-form context);
- the last `docs/audits/visual-v*.md`.

Still frames from fixed cameras miss what moves with the camera or with a person. Three bugs of October 2026 got past
this audit that way; sections 3-5 are there so they never do again, in any world (and a fourth, on a page beside the game):
1. **Pale person-shaped "shadows"** (Marrow by the ship, the traveller on the tree's stairs): the spot blacks'
   enclosure and the crease shading (post.js `enclosure`, `creaseAO`) counted taps landing on a person as open space,
   cutting a pale copy of them into a dark mass that slid with the camera (fixed in 620c4384, `occlusionShare`).
2. **Dark rectangular masses** on cave walls, room corners and stairs that changed shape as the camera moved: the taps
   sat at fixed screen offsets (fixed in c58cbcaa: taps anchored to the surface).
3. **A lit seam round the caves' floors**: geometry. rough() raised the dome's foot ring, a slit the sun shone
   through (fixed in c58cbcaa; `tests/cave-seams.test.js`, generalised in `tests/shell-seams.test.js`).
4. **Torn, streaky shadows in the creatures' gallery** (`enemies.html`, the dune skitter, "look at the shadows in
   motion"): the page reconfigured its shadow map without telling the shader its texel (`uShadowTexel`), so the tent's
   taps spread 2.5 times too far; only the gallery, not the game. Fixed by cascades that keep their own texel uniform and
   a window fitted to the creature (rendering.md, "Torn shadows in the creatures' gallery"; `tests/shadow-setup.test.js`).
   The galleries and studios (`enemies.html`, `items.html`, `studio.html`) draw with the game's pipeline but their own
   shadow setup: in an audit, look at one creature there in motion (its idle over 2 s, an orbit of ±32°) beside the
   same one in the Arena (`?level=arena&enemy=<id>`), the light term (debug 5) close on its shadow's edge.

**Rules for every run:** muted, never port 5173, on the real GPU (never SwiftShader), the High preset
unless the check is about a preset, the HUD hidden, and enemies off (the shadow maps follow the
traveller: knocked out, he stays where he fell and every room after is read unshadowed; visual-v1.21 finding 6). Look at every picture yourself: the numbers
only say where to look.

## 1. Stills: every world, several hours, inside every door

This is the broad sweep: it finds a fault and names its kind. Three kinds have a deeper check of their own, to hand
over to once found: shadows in motion (acne, peter-panning, shimmer, cascade seams, his own shadow) to **shadow-qc**;
line weight and ink at a distance or a low resolution (heavy lines, black blobs, black eyes) to **ink-lines**;
coplanar faces striping (z-fighting) to **zfight-qc**.

```sh
node .claude/skills/visual-audit/views.mjs <scratch>/visual [--worlds …] [--hours 7,12,18.5,22] [--preset high|handheld]
```

The script covers every world's benchmark views (up to 3, from `scripts/bench/viewpoints-worlds.json`; the desert's
from `viewpoints.json`) at dawn, noon, dusk and night, plus up to 6 interiors per world: just past each door, cave or
portal, at noon. A world without views there (the Underwater City, the Moon Foundry and the City Floating in Space, so
far) gets one view, the camera as it boots; to cover it properly, add views to
`viewpoints-worlds.json` (by hand, or `scripts/bench/android-worlds.mjs --pick 1` on the Android bench). The discarded side worlds (`DISCARDED`, src/levels/names.js) are left out unless
`--worlds` names them. Each picture
is measured, and flagged for:
- crushed blacks;
- blown whites;
- NaN-magenta pixels;
- mostly one colour, or very few colours (nothing drawn).
- the camera against something: a third of the frame or more within 2 m of it (the depth view, debug 4; a bench view
  placed badly: re-pick it, `tests/route-spawn.test.js` holds every view's frame clear of what stands before its traveller).

It also runs the clipping audit once per world (`window.clipAudit`). Then read `report.json`, open
every flagged picture and a sample of the rest, and check them against this list.

**Shadows and light**
- Acne: striped or speckled self-shadow on lit faces.
- Peter-panning: the shadow detached from its foot.
- Shadow edges that crawl.
- Cascade seams: a line where the shadow's sharpness changes.
- (Anything here that moves with the camera or with him: measure it with shadow-qc.)
- Light leaking through walls into interiors and caves, or interiors lit like the outside.
- Shade that is black or grey where the style wants a colour.
- Sun-facing facets lit edge-on.
- Shadows missing under people, props or the ship.

**Lines and ink**
- Outlines missing or doubled.
- Lines too heavy far away, or broken on thin bars (measure them at every distance and resolution with ink-lines).
- Hatching that swims across a surface.
- Haze banding.
- Sky seams.

**Geometry**
- Z-fighting (surfaces flickering against each other): zfight-qc counts and fixes them by geometry.
- Props floating or sunk; people standing inside walls (the clipping and contact audits).
- Holes in the terrain or in walls.
- Back faces showing.
- Transparency sorted wrongly (water, glass, wings, fluid).

**Characters**
- Faces off-model (the eyes: GitHub Issues).
- Hands or capes through the body.
- Portraits empty (`scripts/portrait-check.mjs`).
- People popping as their level of detail changes.

**Colour**
- A world off its reference sheets (the References level: `?level=references`, its views beside the
  sheets).
- A pass leaving its colour where it shouldn't, for example the eclipse or the space sky outside
  their worlds.

## 2. Motion: flicker, shimmer, pops

Stills can't show these. Use the motion check (`docs/systems/rendering.md`, "Stable in motion"):

```sh
npx vite build --outDir <dir>/dist-main          # a build is <dir>/dist-<name>, served at /<name>/
node scripts/motion-check/serve.mjs --builds <dir>
node scripts/motion-check/record.mjs --level <world> --build main --preset high --paths pan,zoom --out <dir> --save 1
```

To compare a fix, build the commit before into `<dir>/dist-before` the same way (from a scratch copy of it) and record
both with `--build before` and `--build main`. It steps the game's clock frame by frame, so every run is identical,
and measures the flicker per frame. `scripts/motion-check/survey.sh` runs every world. Look at the hottest clips. Pops at the
level-of-detail and cascade distances show on the zoom path.

## 3-5. The probes: people, a turning camera, enclosed spaces

```sh
node .claude/skills/visual-audit/probes.mjs <scratch>/probes [--worlds …] [--presets handheld,high] [--hour 9.5]
     [--auto 4] [--interiors 4] [--only known] [--spots name,…] [--skip seams] [--root <another checkout>] [--rest 20]
     [--people marrow,…] [--save-all]
```

One headless Chrome (muted, the real GPU) and one dev server (PORT, default 5333; Chrome's debugging port CDP, default
5391; neither may be 5173: other agents' tools hold the ports near PORT and have attached to a Chrome on 5338
before), world after world with a rest between; it never leaves a Chrome behind. By default it covers every route
world (`ORDER` in src/levels/names.js) at **Handheld and High** (Handheld's 4 spot taps are where the blocks showed):
about 10 minutes a world and preset. Per world it takes the **known spots** of past bugs (`KNOWN` in the script: the
Qanat tree's stairs, the cave under the giant, the Givers' Hearth, his own shadow by the ship's ramp (one view from
the sun's side: `shadow`), and for the contact foam Lorn's tree in the water (and two discarded detours' pools, kept
for `--worlds`); add each new
bug's spot there) and finds up to `--auto` more round the ways in (`level.portals`' `to`), the benchmark views and
the spawn: **stairs** (risers in a ground profile), a **room corner** (two walls square to each other), **walls**,
inside first. The pure logic is `scripts/visual-probes/lib.mjs` (`tests/visual-probes.test.js`: each function is
shown the bug it is for). It writes `report.json` and, for each flagged probe, its debug pictures (`--save-all`:
every probe's, the albedo and normals of the ghost takes and every orbit frame too).

What each probe catches, and when it flags (the pure checks in `scripts/visual-probes/lib.mjs`; where each limit
came from: rendering.md, "How the visual probes' limits were set"):

| probe | catches | how | flagged when |
|---|---|---|---|
| **3. Ghost** (`ghostCheck`) | bug 1: a pale copy of a person cut into a dark mass, or a dark halo round them | him 1.3 m before the spot's surface, the camera 5 m off; debug 9 (the enclosure, 8 taps) and 10 (the preset's spot mask) with him and with him hidden; his silhouette from debug 2 and 3; three more takes with nobody moving for the world's own noise (`noiseAcross`); `--people` the same with story people where he stood | a pale region beside him over 5 % of his size or 300 px; a dark one over 30 %; a person over a tenth of the frame is reported `close`, not judged |
| **4. Orbit** (`stability`, `orbitScale`, `seenAt`) | bug 2: a mask that jumps or changes shape on the same surface as the camera turns | ±32° round the spot in 8° steps, him hidden; the swing narrows in a small room (×0.75, 0.5, 0.25, reported as `swing`) until the eye keeps 85 % of its distance; the same surface points read in masks 9 and 10, kept where the albedo still matches and the depth view (debug 4) puts them at their own depth (a collider nothing draws, a drawn thing that doesn't collide: issue #301) | the frame-to-frame step's p95 over 0.3 (`unstable`); `drift` (most dark points move in small steps) is a picture to look at, not a verdict |
| **5. Seams** (`floorSlits`, `litRidges`) | bug 3: a gap under a wall's foot, the sky seen through it | in every way in and known cave: level rays at 6 cm, 0.3 m and 1 m all round (a gap: the foot ray through where the metre ray meets a wall, unless the 0.3 m ray goes through too: furniture on legs); the light term (debug 5) six ways round the floor's edge | under a ceiling: one direction with a gap, or a sky-white line of 60 px or more; 30-60 px kept as `look`, a picture to look at (glowing marks pass too) |

Look at the pictures each saves (`<spot>-ghost-d9with.png`, `…-d9without.png`, `…-d10…`, `…-light-<k>.png`) before
calling a flag. Both cameras are pulled in front of any wall between them and the spot.

**The geometry, as unit tests.** `tests/shell-seams.test.js` runs every displacement helper the worlds roughen shells
with (desert-city and desert-hearth `rough`, sky-stones `lumpy`, world.js `jitter` and `soften`) on a dome, a low dome,
a drum and a mound standing at y = 0: the foot ring never rises above the floor. A scan of `src/` finds any exported
helper that moves a geometry's vertices: it must join the test or be named as not a shell, so a new one can't bring the
seam back. A new enclosed shell built another way gets its own case there.

**Comparing with the build before a fix:** export that commit's `src`, `public`, the pages, `vite.config.js` and
`package.json` into a scratch folder (an archive of the commit, not a checkout), link `node_modules` into it and pass the
folder as `--root`: the same probes on the old code. Keep to the few spots that matter (`--only known --spots …`).

## 6. Close checks for what the open issues name

- **Caves and interiors:** walk the inside views, at least one per world, and the desert's caves and
  houses. Compare cast and ink shadows.
- **The traveller's face:** the character studio (`studio.html`), or a `people` view through
  `scripts/changelog-shots.mjs`.
- **Climbers and quick turns:** rendering.md, "Shadows close up".

## The rule for screen-space passes

Every new or changed screen-space pass (anything that reads the depth, normals or G-buffer of neighbouring pixels:
occlusion, spot blacks, crease shading, outlines, bloom, screen-space shadows or reflections) must say, in its section
of `docs/systems/rendering.md`:
- **how it treats people** (the hero and figure flags in gHatch.a): does a person count as an occluder, as open space,
  or is a tap on them left out? A person in front of a dark area must leave it as dark as without them;
- **how it behaves under camera motion**: are its taps or noise tied to the screen, or to the surface and the world? A
  turn of a few degrees must not move a mass across the same surface;
- and it comes with **a test twin** like `tests/occlusion-taps.test.js` (the estimate rebuilt in JS on a raycast scene:
  a person in front, a camera swinging round a riser), and a probe run (sections 3-4) on the known spots at Handheld and
  High before it merges.

Review a pass's change against this list; a pass that can't answer both questions isn't done.

## 7. Write `docs/audits/visual-v<version>.md`

Start the report with its score block, right under the title (an HTML comment GitHub hides; the audits page,
`audits.html`, reads it: `src/audits-page/parse.js`, docs/systems/ui.md "The audits page"):

```
<!-- audit-scores
overall: none
label: (none: the headline says it)
date: YYYY-MM-DD
-->
```

A visual audit has no overall score: write `overall: none` and, instead of `label:`, `headline:` with the
findings' counts by severity in one line. Keep the findings table's `severity` column (the page counts it).
Keep the score tables as Markdown tables with one row per finding and the 1-5 scores in their own columns (a
"total" or "Mean" column for the row's mean; a change by eye as `4 ✎3`, before and after as `2 → 3`): the
page draws them as bars and compares them with the last report's by the row's name and the column's header,
so keep both the same from one report to the next. `node --test tests/audits-page.test.js` checks the block.

- **The setup:** commit, preset, resolution, hours, GPU.
- **A findings table:** each problem's severity (*breaks the picture*, *noticeable*, *only when looking*, or
  *look*: a flag worth writing down that is no fault a player sees, the probe's own miss or an art call, kept so the
  next run knows it; visual-v1.21 findings 5-7), where it is (world, view, hour), the picture's path under
  `docs/audits/visual-v<version>/` (copy only the pictures that show a problem, as WebP: `cwebp -q 72`),
  the likely cause (file and line), and a suggested fix.
- **The probes' table:** per world and preset, the ghost, orbit and seam results, flagged first, and the known spots
  against the last report.
- **What was fixed** since the last report, and what is new.
- **The clipping and contact audits' counts per world,** against the last.
- **The motion check's worst views.**
- **What was not checked:** devices, presets and worlds left out.

**A probes-only rerun** (a fix checked on the known spots, no stills or motion): a short report of the same name,
the score block with `headline:` the flags before → after; the setup (commit, presets, `--only`/`--spots`, `--root`
of the build before); the probes' table for the spots run, before → after; the findings it closes or leaves; and
"not checked: the stills, the motion check, the other worlds".

Keep the folder small: under 3 MB a report. Add the report to the `docs/audits/` line of
`docs/README.md`. It's documentation only: no changelog line, no fixes, unless asked. Commit it if
asked, after the tests and the build pass.

## 8. Tell the user

- the count of problems by severity, and the worst three with their pictures;
- what's new since the last report;
- the fixes you'd do first.

Offer the fixes as work; don't start them unasked.

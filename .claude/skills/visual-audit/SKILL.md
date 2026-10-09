---
name: visual-audit
description: Look for what is wrong in Hiraeth's pictures — visual artifacts, lighting and shadow problems (acne, peter-panning, leaks, black or blown areas, shadows in caves and interiors), screen-space masks that ghost round people or slide as the camera turns, lit seams in caves and rooms, flicker and shimmer in motion, clipping and floating props, LOD pops, off-style colours, face and character problems — world by world and hour by hour, and write docs/audits/visual-v<version>.md with each problem's picture, cause and fix. Use when asked about visual quality, artifacts, glitches, lighting or shadows, or before a release.
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
- the open visual items in `TODO.md`, such as "shadow artifacts in caves and interiors" and the
  traveller's face;
- the last `docs/audits/visual-v*.md`.

Still frames from fixed cameras miss what moves with the camera or with a person. Three bugs of October 2026 got past
this audit that way; sections 3-5 are there so they never do again, in any world:
1. **Pale person-shaped "shadows"** (Marrow by the ship, the traveller on the tree's stairs): the spot blacks'
   enclosure and the crease shading (post.js `enclosure`, `creaseAO`) counted taps landing on a person as open space,
   cutting a pale copy of them into a dark mass that slid with the camera (fixed in 620c4384, `occlusionShare`).
2. **Dark rectangular masses** on cave walls, room corners and stairs that changed shape as the camera moved: the taps
   sat at fixed screen offsets (fixed in c58cbcaa: taps anchored to the surface).
3. **A lit seam round the caves' floors**: geometry. rough() raised the dome's foot ring, a slit the sun shone
   through (fixed in c58cbcaa; `tests/cave-seams.test.js`, generalised in `tests/shell-seams.test.js`).

**Rules for every run:** muted, never port 5173, on the real GPU (never SwiftShader), the High preset
unless the check is about a preset, and the HUD hidden. Look at every picture yourself: the numbers
only say where to look.

## 1. Stills: every world, several hours, inside every door

```sh
node .claude/skills/visual-audit/views.mjs <scratch>/visual [--worlds …] [--hours 7,12,18.5,22] [--preset high|handheld]
```

The script covers every world's benchmark views (up to 3) at dawn, noon, dusk and night, plus up to 6
interiors per world: just past each door, cave or portal, at noon. Each picture is measured, and
flagged for:
- crushed blacks;
- blown whites;
- NaN-magenta pixels;
- mostly one colour, or very few colours (nothing drawn).

It also runs the clipping audit once per world (`window.clipAudit`). Then read `report.json`, open
every flagged picture and a sample of the rest, and check them against this list.

**Shadows and light**
- Acne: striped or speckled self-shadow on lit faces.
- Peter-panning: the shadow detached from its foot.
- Shadow edges that crawl.
- Cascade seams: a line where the shadow's sharpness changes.
- Light leaking through walls into interiors and caves, or interiors lit like the outside.
- Shade that is black or grey where the style wants a colour.
- Sun-facing facets lit edge-on.
- Shadows missing under people, props or the ship.

**Lines and ink**
- Outlines missing or doubled.
- Lines too heavy far away, or broken on thin bars.
- Hatching that swims across a surface.
- Haze banding.
- Sky seams.

**Geometry**
- Z-fighting (surfaces flickering against each other).
- Props floating or sunk; people standing inside walls (the clipping and contact audits).
- Holes in the terrain or in walls.
- Back faces showing.
- Transparency sorted wrongly (water, glass, wings, fluid).

**Characters**
- Faces off-model (TODO.md: the eyes).
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
node scripts/motion-check/serve.mjs --builds <dir>
node scripts/motion-check/record.mjs --level <world> --build main --preset high --paths pan,zoom --out <dir> --save 1
```

It steps the game's clock frame by frame, so every run is identical, and measures the flicker per
frame. `scripts/motion-check/survey.sh` runs every world. Look at the hottest clips. Pops at the
level-of-detail and cascade distances show on the zoom path.

## 3-5. The probes: people, a turning camera, enclosed spaces

```sh
node .claude/skills/visual-audit/probes.mjs <scratch>/probes [--worlds …] [--presets handheld,high] [--hour 9.5]
     [--auto 4] [--interiors 4] [--only known] [--spots name,…] [--skip seams] [--root <another checkout>] [--rest 20]
```

One headless Chrome (muted, the real GPU) and one dev server (PORT, default 5333; Chrome's debugging port CDP, default
5391: other agents' tools hold the ports near PORT and have attached to a Chrome on 5338 before), world after world with a rest between; it never leaves a Chrome
behind. By default it covers every route world (`ORDER` in src/levels/names.js) at **Handheld and High** (Handheld's 4
spot taps are where the blocks showed): about 10 minutes a world and preset. Per world it takes the **known spots** of
past bugs (`KNOWN` in the script: the Qanat tree's stairs, the cave under the giant, the Givers' Hearth; add each new
bug's spot there) and finds up to `--auto` more round the ways in (`level.portals`' `to`), the benchmark views and the
spawn: **stairs** (risers in a ground profile), a **room corner** (two walls square to each other), **walls**, inside
first. The pure logic is `scripts/visual-probes/lib.mjs` (`tests/visual-probes.test.js`: each function is shown the bug
it is for). It writes `report.json` and, for each flagged probe, its debug pictures.

**3. Ghost: the post-pass check** (bug 1). The traveller stands 1.3 m in front of the spot's surface (on the known
stairs, where he stood in the playtest), the camera 5 m off. The probe renders the debug views (rendering.md, "Debug
views") **9** (the enclosure, 8 taps) and **10** (the spot tier's spot mask, the preset's own taps) with him and with
him hidden (his `visible` held false), his silhouette from **2** (the albedo's difference, the region at his chest), and
the same masks once more with nobody moving (the world's own motion, left out). `ghostCheck`: a **pale region** beside
him in a dark mask, over 5 % of his own size or 300 px, is the white shadow; a **dark** one over 30 % of his size, the
halo before it. Tuned on the bug: the Qanat stairs at Handheld, 0.11 of him before 620c4384 and 0.003 after; the
Hearth 703 px before, 0 after. Look at the pictures it saves (`<spot>-ghost-d9with.png`, `…-d9without.png`, `…-d10…`)
before calling it. A person over a tenth of the frame (the camera on top of him in a small room) is reported `close`,
not judged; both cameras are pulled in front of any wall between them and the spot.

**4. Orbit stability** (bug 2). The camera orbits the spot's point ±32° in 8° steps, the traveller hidden; the same
surface points (raycast once from the first view, projected again in each, left out where something stands in front)
are read in masks 10 and 9, and kept only where the albedo (debug 2) still matches the first view's (the same surface:
not a person, a drone or a prop the collision doesn't hold, not a pixel off an edge). `stability` and `unstable`: flagged when the frame-to-frame step's 95th percentile is over
0.3 (a mask that jumps on and off the same surface). Tuned on the bug, the build before c58cbcaa against main: the
stairs 0.60 before, 0.20-0.23 after; the Hearth 0.54 / 0.25 before, 0.03-0.24 after. `drift` (most dark points change,
in small steps) is a picture to look at, not a verdict: screen-space masks still slide a little with the view.

**5. Seams and leaks in enclosed spaces** (bug 3). Inside every way in and every known cave (where a ray up meets a
ceiling): level rays at the foot of the walls (6 cm up) and a metre up, all round (`floorSlits`: where the wall stands a
metre up but the foot ray goes through, there is a gap under it; the Hearth before c58cbcaa: 6 of 24 directions, after:
0); and the light term (debug **5**) looking round six ways at the floor's edge (`litRidges`: a thin line brighter than
both sides, sky-white: the sky seen through a slit is 1.0 there, a lamp-lit surface rarely is). A run of 60 px is
flagged (the Hearth's seam was 62-149 px before c58cbcaa); 30-60 px is saved as a picture to look at (bone markers,
the glowing kind, pass the test too).

**The geometry, as unit tests.** `tests/shell-seams.test.js` runs every displacement helper the worlds roughen shells
with (desert-city and desert-hearth `rough`, sky-stones `lumpy`, world.js `jitter` and `soften`) on a dome, a low dome,
a drum and a mound standing at y = 0: the foot ring never rises above the floor. A scan of `src/` finds any exported
helper that moves a geometry's vertices: it must join the test or be named as not a shell, so a new one can't bring the
seam back. A new enclosed shell built another way gets its own case there.

**Comparing with the build before a fix:** export that commit's `src`, `public`, the pages, `vite.config.js` and
`package.json` into a scratch folder (an archive of the commit, not a checkout), link `node_modules` into it and pass the
folder as `--root`: the same probes on the old code. That is how the thresholds above were set. Keep to the few spots
that matter (`--only known --spots …`).

## 6. Close checks for what the TODO names

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

- **The setup:** commit, preset, resolution, hours, GPU.
- **A findings table:** each problem's severity (*breaks the picture*, *noticeable*, or *only when
  looking*), where it is (world, view, hour), the picture's path under
  `docs/audits/visual-v<version>/` (copy only the pictures that show a problem, as WebP: `cwebp -q 72`),
  the likely cause (file and line), and a suggested fix.
- **The probes' table:** per world and preset, the ghost, orbit and seam results, flagged first, and the known spots
  against the last report.
- **What was fixed** since the last report, and what is new.
- **The clipping and contact audits' counts per world,** against the last.
- **The motion check's worst views.**
- **What was not checked:** devices, presets and worlds left out.

Keep the folder small: under 3 MB a report. Add the report to the `docs/audits/` line of
`docs/README.md`. It's documentation only: no changelog line, no fixes, unless asked. Commit it if
asked, after the tests and the build pass.

## 8. Tell the user

- the count of problems by severity, and the worst three with their pictures;
- what's new since the last report;
- the fixes you'd do first.

Offer the fixes as work; don't start them unasked.

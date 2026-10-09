---
name: enemy-rework
description: Building a new enemy of Hiraeth's roster or reworking one to its picked design sheets (references/enemy-archetypes/<id>/sheet-1.jpg the main skin, sheet-2.jpg the alternate) — silhouette and proportions, parts, the procedural surface (patterns, colour zones, glow, gloss: mandatory), each skin's palette, motion, attack wind-ups and telegraphs, the combat review, performance, and the changelog's before / after pictures with the sheet as its own picture. Use for every roster batch (docs/design/enemy-roster.md, batches 3–6), when an enemy looks far from its sheet, or when a skin is added.
---

# Reworking an enemy to its sheets

An enemy is right when, set beside its sheet at the same view, it reads as the same creature: the same silhouette
and proportions against the traveller, the same parts, **the same painted surface** (the patterns, colour zones,
glow and gloss the sheet draws), the same palette per skin, and it moves and winds up its attacks the way the design
says. A flat colour per part is never enough: the batch-1 art pass matched the shapes and still looked far from the
sheets until the surfaces were painted (v1.10).

Read first: `docs/design/enemy-roster.md` (the archetype: role, attacks, answers, calm, worlds and skins; "Status"),
`docs/systems/foes.md` ("The enemy roster", "Procedural surfaces", "Telegraphs: the body, not the floor"),
`docs/systems/procedural-animation.md`, and the archetype's plan in `src/enemies/plans/` with its skins in
`src/enemies/skins.js` and its surfaces in `src/enemies/surfaces.js`.

## 0. Look at both sheets

Open `references/enemy-archetypes/<id>/sheet-1.jpg` and `sheet-2.jpg` (and `manifest.json`: which world each skin is,
the prompt). Write down, per sheet: the views drawn (front, side, three-quarter, the attack pose, the black
silhouette, the traveller for scale); its height and length against the traveller (1.75 m); the parts and how they
join; the surface (what is painted on each part, where the colour changes, what glows, what is glossy, what is inked
dense); the palette. Which skin is which: `ARCHETYPES[id].art` (`{ main, alt }` worlds, or `'sheet-1'`: its own skin,
the first listed). Never invent detail the sheet doesn't show; where a sheet carries something from the other sheet's
shape that the skin shouldn't wear (the Mangrove hound's halo), leave it and note it for the author.

## 1. Silhouette and proportions

Against the sheet's black silhouette and the traveller's scale: overall height and length, the mass (where it is
heavy), the stance (legs splayed, upright, hugging the ground), the read from afar ("a black lump with two hooks on
top"). Fix this first: surface detail never rescues a wrong silhouette.

```sh
node scripts/enemy-roster/compare.mjs --out output/enemy-roster [--skins 1,2] <id>          # the sheet over the game's body (working tool)
node scripts/enemy-roster/compare.mjs --separate --out output/enemy-roster [--tag before] <id>   # each view alone, 1280 × 720
```

The contact sheet (`compare-<id>-<n>.png`) puts the sheet over the game's body in the sheet's skin and views (front,
side facing left, three-quarter, the wind-up the sheet draws): a working tool, never changelog media. `--separate`
writes `<id>-<n>-<view>[-tag].png`, large, 3D only, for looking closely and for a before / after. Add the archetype to
`WINDUPS` (and `MOVING`, `PITCH`, `AT`, `ALT` if needed) at the top of compare.mjs.

## 2. Parts

The parts the sheet draws, in order of how much they read: the big masses, then the limbs, then the face, then the
dress (props). Each part a mesh (or merged geometry) in `src/enemies/plans/<plan>.js` with a **named material**
(`M.mat('shell', P.shell)`): the name is how its surface is found. Keep the draw count low: one mesh per part, not
one per fleck. A pattern of many small things (lichen, barnacles, rivets, spots) is painted (step 3), not modelled;
keep a few raised ones only where the silhouette needs them.

## 3. The procedural surface (mandatory)

Every part the sheet paints gets its surface in `src/enemies/surfaces.js`: `SURFACES[id]['*'][part]` for every skin,
`SURFACES[id][skin][part]` over it. The features (`src/foe-surface.js`, docs/systems/foes.md "Procedural surfaces"):

| Sheet shows | Feature |
|---|---|
| specks, flecks, stippling | `spots2` small (scale 0.04–0.06 m, size 0.4–1) |
| lichen stars, snowflakes | `spots` with `star` 0.6–1 (sharp: the post pass outlines them) |
| barnacle rosettes, coin rosettes, eye-spots | `spots` with `ring`, plus `spots2` for the heart; `soft` 0.3–0.5 for no pen line |
| mottling, blotches, patches of another tone | `mottle` (scale, amount, soft, detail) |
| scales, plates, scutes | `scales` (mode 0 scales, 1 staggered plates; `ink` the outline, `tone` each one's shade) |
| segment bands, ribs, painted rings | `bands` (axis 0 x, 1 y, 2 z, 3 round the y axis), `stripes` for a second set |
| a belly of another colour, its plates | `belly` (edge, soft, seams, ink) |
| tips fading to another colour | `fade` (axis, from → to; from > to fades the other way) |
| rust, verdigris, pitting | `rust` (color, color2, amount, amount2, down, pits) |
| wood grain, bone, driftwood | `grain` |
| ink drips, rust streaks | `drips` (from, length, width, bulb) |
| translucent, an inner light, lanterns | `glow` (core, rim, pulse, emit; `center` + `radius` for a lantern at a point) |
| wet ink, glaze, enamel highlights | `gloss` (size, sky) |

Colours from the skin's palette (`'shell'`, `'shell*0.8'` darker, `'shell+0.3'` paler) so each skin repaints its
pattern; add palette keys in skins.js when a sheet needs one. Sizes are metres of the part (object space, scale
included). Iterate with `compare.mjs --separate` per view until each view reads as the sheet's at a glance, then
write down what still differs. Watch for: patterns too small to see at play distance (they fade to their mean
colour: that is fine far off, but near they should read); sharp colour steps drawing pen lines where the sheet has
none (raise `soft`); a hash-like regularity (vary scale, share, jitter). A faceted (`flat`) part's gloss comes off
the smooth normal: fine. If a pattern the sheet needs isn't there, add a feature to foe-surface.js (its define, its
uniforms in `FOE_SURFACE_PARS`, its block in `foeSurface`, a fade to its mean colour, the cheap path under
`uWearLite`) and a line to tests/foe-surface.test.js.

## 4. Palette per skin

sheet-1's colours on the main skin, sheet-2's on the alternate (skins.js, a comment saying what each sheet shows); the
other skins keep their own palettes and wear the archetype's `'*'` surfaces in them (check them all:
`node scripts/enemy-roster/skins.mjs --out output/enemy-roster <id>`).

## 5. Motion

`.claude/skills/procedural-animation/SKILL.md`: feet planted (no slide), the gait's groups, the body riding its feet,
secondary motion lagging, the plan's poses. Measure with its scripts; a rework that changes legs or proportions must
re-measure.

## 6. Attack wind-ups and telegraphs

docs/systems/foes.md, "Telegraphs: the body, not the floor": each attack its own wind-up pose of the body, complete
at 75 % of the wind-up and held; the glow on the striking part (`tell(attackId)`); the warning sound; the eyes;
fair wind-ups (`WIND_MIN`). **Only a lob marks the ground** (`lob: true`, its landing spot); nothing else draws on the
floor (`tests/telegraphs.test.js`). The sheet's attack pose is the target for the held pose.

## 7. Combat review

`.claude/skills/combat-review/SKILL.md` for the batch (Arena run, rubric, `docs/audits/combat-v<version>.md`).

## 8. Readability and cost

- In the Arena (`?level=arena&enemy=<id>@<skin>`) and in its worlds at play distance: it reads against the ground,
  its pattern doesn't shimmer, its tells show.
- Draw calls and frame time with a pack on screen, before and after, High at 1280 × 720 and the Steam Deck preset:

  ```sh
  node scripts/enemy-roster/bench.mjs --commit <before> --quality high      # then the same without --commit (this checkout)
  node scripts/enemy-roster/bench.mjs --quality deck [--pack crab@arzach2,…] [--shot pack.png]
  ```

  Headless numbers compare a before with an after on one machine; run each two or three times, alternating (the
  machine is shared). A surface feature must not add draws; a rework should lower them where it paints what was
  modelled.

## 9. The changelog: separate pictures, the sheet beside them

docs/systems/changelog.md, "Enemies". In `src/changelog-media.js`, per line, one pair per skin worth showing:

```js
{ name: 'art-crab', title: 'Vael II', caption: '…', commit: '<sha>', before: '<sha>^',
  view: { foe: { id: 'crab@arzach2', yaw: 0.75, pitch: 0.16 } },
  reference: { sheet: 'references/enemy-archetypes/crab/sheet-1.jpg', caption: 'The main design sheet: the cliff crab (Vael II)' } },
```

`node scripts/changelog-shots.mjs --only <v>/<name> --force` takes the game's body alone, large, 3D only, the same
camera before and after (the most telling view: three-quarter for a crab, the side for a lizard or a hound, from
above for the ray; a wind-up only if it shows the change better), and makes the sheet's `-ref.webp`. **Never stitch
the sheet into the render** (the stitched contact sheets stay a working tool). Where the before is another kind,
`view.before: { foe: { id } }`. A pair made by hand (commits that will be rebased) says where it came from in `from`
and keeps its `reference`. Look at every pair; check sizes (`tests/changelog-media.test.js`).

## Checklist

- [ ] Both sheets read: views, scale, parts, surface, palette written down; which skin each is.
- [ ] Silhouette and proportions match the black silhouette and the traveller's scale (contact sheet).
- [ ] Parts built, each with a named material; many small things painted, not modelled.
- [ ] **Surface painted on every part the sheet paints** (surfaces.js), main and alternate skin compared per view
      with `compare.mjs --separate`; what still differs written down.
- [ ] Palettes from sheet-1 / sheet-2; the other skins checked (skins.mjs).
- [ ] Motion measured (procedural-animation); wind-ups held at 75 %, glow, sound, eyes; only lobs mark the ground.
- [ ] Combat review written for the batch.
- [ ] Readable in the Arena and its worlds at play distance; draws and frame time before / after (High, Deck).
- [ ] Tests: `tests/foe-surface.test.js`, `tests/archetypes.test.js`, `tests/telegraphs.test.js`,
      `tests/foe-presence.test.js` pass; new logic has a test.
- [ ] Changelog line(s) in the newest entry, its pairs (3D only, one camera) and the sheet as its own picture;
      `node scripts/changelog-md.mjs`; `npx vite build`.
- [ ] docs/design/enemy-roster.md "Status" row updated (Drawn to its sheets, what differs).

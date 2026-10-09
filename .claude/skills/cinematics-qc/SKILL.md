---
name: cinematics-qc
description: Quality control for Hiraeth's cinematics — the world moments (each world's filmed climax), the box openings, the ship's arrivals, takeoff and recordings, the prologue, homecomings, home scenes and the trailer. Use when reviewing, auditing, scoring or fixing a cinematic, cutscene or moment, when adding or changing one (a new world's climax in src/story/<world>-moments.js, a new box, a new ship scene), or before a release; produces a scored table (technical and interest) and fixes.
---

# Cinematics QC

Every cinematic is judged twice: **technical** (does it play cleanly, framed, hidden HUD, skippable,
back to the player at a sensible spot) and **interest** (is it worth watching: a purpose, the right
length, varied shots, a beat). The numbers from the script only say where to look: **look at every
captured frame yourself.** Results go in `docs/systems/cinematics-qc.md` (one table, compared with
the last pass) and, for creative rework, `TODO.md` under "Cinematics (QC pass)".

Read first:
- `docs/systems/cinematics.md`: the moments (`src/story/moment.js`, `film.js`, the rules: 8–10 s,
  four panels, the last his face, no lines from him, control back at the climax), the ship's
  scenes (`src/ship/cinematics.js`, `approach.js`, `homecoming.js`), the box scene
  (`src/boxes/scene.js`), the trailer, and the review page (`cinematics.html`, Debug → Cinematics);
- `docs/story-bible.md` for what each moment is for; `docs/systems/cinematics-qc.md` for the last pass.

**Rules for every run:** Chrome muted (`--mute-audio`; the script does it), your own Vite port
(never 5173, the author's), the real GPU, the High preset unless the check is about a preset.

**Keep the machine's load light** (a full pass once overheated the laptop):
- **One** headless Chrome and **one** dev server at a time. The script starts one of each, reuses
  the same browser tab for every cinematic, and closes both when it ends; don't run a second copy
  (or a probe, the visual audit, the benchmark) beside it. Check nothing is left over before you
  start: `ps aux | grep -E "cinematics-qc|headless"`.
- It rests between cinematics (`--rest`, default 3 s, on `about:blank` so the world is unloaded);
  raise it on a hot machine. Run subsets (`--only`, `--group`) rather than everything again after a
  fix, and re-run only the ids a fix touches.
- Chrome picks its own debugging port (port 0), so a stray Chrome on a fixed port is never driven
  by mistake; still, never kill a Chrome you didn't start.

## 1. Every cinematic is on the review page

`src/cinematics-page/catalog.js` derives the list (`CINEMATICS`) from the registries:
`WORLD_MOMENTS` (src/story/film.js), `PLACEMENTS` (boxes), the routes (arrivals), the calls. A new
cinematic that isn't derived must be added there, with its staging in `runtime.js`
(`startReview`), and `tests/cinematics-page.test.js` must still pass. If it isn't on the page it
isn't reviewed.

## 2. Play them all headless

```sh
PORT=5308 node scripts/cinematics-qc.mjs --out output/cinematics-qc/<run>          # every one, 1280×720
node scripts/cinematics-qc.mjs --only arzach.bird,box.desert* --frames 10 --every 0.5
node scripts/cinematics-qc.mjs --group "World moments" --skip                      # + the skip test
node scripts/cinematics-qc.mjs --group "World moments" --size 844x390 --mobile     # phone landscape
```

It serves this checkout with Vite on `PORT` (default 5308; refuses 5173), opens each entry the way
the review page does (`index.html?level=…&cinematicReview=<id>`: temporary progress, the real
directors), and records **every frame** in the page (`SAMPLER`): playing or not, the camera, which
HUD pieces show (`#cue #fps #gear #touch #tool #health #stamina #prompt #toast …`), the letterbox,
the skip tag, the subtitle, the lens inside a solid (`physics.embedded`) or within 12 cm of one,
the traveller in frame but behind a solid, the master bus's loudness (dBFS; sound is on inside the
muted Chrome). A screenshot every `--every` s; `--frames` N of them kept as WebP in
`<out>/<id>/`, plus one 1.5 s after the hand-back (`NN-after.webp`). Console errors and exceptions
are logged per cinematic. `--skip` holds Esc 1.2 s in: it must end within ~3 s, with no menu
opened (run it as its own pass: a skipped cinematic has no frames to judge). Box cards are
dismissed automatically. Per cinematic: `<out>/<id>/sheet.jpg` (all kept frames in one labelled
picture: look at this first), the WebPs, and `samples.json` (every frame's camera and findings,
`t` from its start: find which panel a finding is in). Output: `<out>/report.json` (everything)
and `<out>/report.md` (the table). A full pass (~90 entries) takes over an hour, the 14 recordings
alone ~15 minutes; run it in the background and look at sheets as they land.

What "playing" means: the ship's director (`ship.playing`), a moment (`storyRt.moments.playing`),
a world's own scene (`storyRt.world.busy()`: home's quiet scenes) or a box (`boxes.busy()`). A
conversation that opens afterwards is not counted. The ship's scenes (recordings, arrivals,
takeoff, homecomings, the prologue) skip on a **hold**, and their tag only shows once you press:
"no skip tag" is expected there (`holdsToSkip`), the `--skip` pass is what proves it. The prologue
and homecomings are long and partly played: expect a time-out, judge them from the frames. Space
in an arrival's approach reads as "nearly empty" frames by design.

Pure logic (`analyse`, `scoreTechnical`, `inkDensity`, `spread`, `pickEntries`) is tested in
`tests/cinematics-qc.test.js`; keep it that way when you change the heuristics.

## 3. Technical checklist (score /5)

The script's `scoreTechnical` starts at 5 and takes points off; confirm or overrule each by eye.

| Check | How to see it |
|---|---|
| Listed on the review page | §1 |
| Plays start to finish, no console errors | `errors` in the report; status not "Could not play" |
| Camera never inside or grazing geometry | `embedded` / `graze` frames; look for a wall filling half the frame, a see-through face |
| Subject in frame, not occluded (fire, foliage, a pillar, the ship) | the frames; `hidden` counts solids only, so fire and leaves are by eye |
| No empty frames (sky only, blank ground) | `emptyFrames` (ink gradient < 3); the frames |
| No pops: a jump inside a shot, a teleport of a prop or the traveller | `pops`; frame pairs; `playerJump` on release |
| Letterbox on; HUD, prompts, toasts, touch controls hidden | `barsShare`, `hudLeaks` |
| Skippable (tag shown; Esc / B / tap works after the grace) | `skipShown`, `--skip` |
| Hands control back cleanly, at a sensible spot, camera behind him | `endedCleanly`, the `after` frame |
| Sound and music in sync with the picture, not too loud | `peakDb` (flag > −6 dBFS; compare with the world's normal level ≈ −25…−35); listen on the review page with Sound on |
| Every line carries a tone | `node --test tests/tone.test.js` |
| Desktop and phone landscape | a `--size 844x390 --mobile` run: subtitle, skip tag and letterbox fit, the subject still in frame at the narrower aspect |
| Moebius style | ink lines on everything, flat colour, no white or swimming shadows, no off-palette blooms; compare with `docs/systems/references.md` |

## 4. Interest checklist (score /5)

One point each, by watching (the frames, then the review page for the timing):
1. **Purpose**: a reveal, a payoff or an emotion you can name in one line, tied to the story
   (`docs/story-bible.md`, the world's arc).
2. **Length**: no longer than it needs; no dead time at the start or the end (the moments' rule:
   8–10 s; a box ≈ 7–9 s; an arrival ≈ 7 s of space plus the landing).
3. **Shot variety**: establishing, medium, close; not one static angle (`shots` ≥ 3 for a moment;
   `longestHold` under ~4 s unless the hold is the point).
4. **Motion with intent**: the camera moves toward what matters, follows something, or holds on
   purpose; no aimless drift.
5. **A beat**: a surprise, a turn, a light coming on, his face at the end.

## 5. Fix, then record

- Fix technical problems in the code (framing in the moment's shot list, the HUD in
  `src/ship/cinema.js` `hud()` or `index.html`'s `body.cine-on` rules, toasts with `cinema.held`,
  skip wiring, volumes in the swell). Re-run the affected ids and compare frames.
- Fix straightforward interest problems: trim dead time, rebalance panel lengths, add a cut or a
  push-in. **Don't invent story**: bigger creative rework goes in `TODO.md` under
  "Cinematics (QC pass)".
- Record the pass in `docs/systems/cinematics-qc.md`: one row per cinematic: technical /5, interest
  /5, problems, what was fixed. Optionally mirror the verdicts into the review page's notes (it
  stores them per browser in `localStorage['hiraeth.cinematics.qc.v1']`: `{ [id]: { verdict:
  'Pass' | 'Needs work', text, updated } }`; Export / import as JSON).
- Visible fixes get a changelog line with before/after frames (CLAUDE.md, docs/systems/changelog.md):
  the script's frames of the same id before and after the fix make the pair.
- Tests for each fix (`tests/moment.test.js`, `tests/moments-<world>.test.js`, `tests/box-*.test.js`),
  `npx vite build`, and the pre-commit hook.

## Output format

```
| Cinematic | Tech /5 | Interest /5 | Problems | Fixed |
|---|---|---|---|---|
| arzach.bird · Vael, the bird | 4 | 4 | lens through the cliff in A (47 frames) | A pulled out of the rock |
```
Then: headline findings (what's systematically wrong), the fixes, and the TODO items added.

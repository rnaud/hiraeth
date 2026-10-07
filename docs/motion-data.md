# Motion data: sources, terms, what is shipped

The game's own clips are Quaternius' Universal Animation Library (CC0, `public/anim/ual.glb`,
see docs/credits.md). On top of it come motion-captured takes from two sources, converted by
`scripts/mocap/` (docs/systems/animation.md, "Motion capture") into two compact files:

| File | What | Size | Loaded |
|---|---|---|---|
| `public/anim/walks.glb` | 12 walking cycles of CMU subjects: the people's own walks | 81 KB | always (after the game starts, not waited for) |
| `public/anim/moves.glb` | the traveller's own moves: 11 Mixamo clips (get-ups, jumps, a stumble, idles, a kneel, the petting) | 349 KB | always (after the game starts, not waited for) |
| `public/anim/locomotion.glb` | the motion-matching database: 75 CMU clips and 33 Mixamo ones (267 s; mirrored at load) | 1.39 MB | only with motion matching switched on (dev menu, `?mm=1`) and in the character studio |

Only these processed files are in the repository. The raw downloads live in `data/mocap/raw/`
and `data/mocap/mixamo/`, which git ignores; `node scripts/mocap/fetch-cmu.mjs` downloads the CMU
takes again, and the Mixamo files are downloaded by hand (docs/mixamo-shopping-list.md).

## CMU Graphics Lab Motion Capture Database

- **Site:** http://mocap.cs.cmu.edu/ (Carnegie Mellon University, Graphics Lab).
- **Format used:** the database's own ASF/AMC (no third-party conversion): per take,
  `http://mocap.cs.cmu.edu/subjects/<subject>/<subject>_<trial>.amc`, and each subject's skeleton
  `http://mocap.cs.cmu.edu/subjects/<subject>/<subject>.asf`. Subject 77 is captured at 60 fps,
  the others at 120. (Bruce Hahne's BVH conversion, hosted at cgspeed, also works:
  `scripts/mocap/bvh.js` reads its MotionBuilder-friendly naming, from `data/mocap/raw/bvh/`.)
- **Downloaded:** 141 takes of 33 subjects (and their 33 skeleton files), 130.9 MB, one file at a time with
  a pause between them (the site asks not to be crawled; this is a fixed, short list). The list
  with each take's description from the site's index is `scripts/mocap/cmu-takes.json`.
- **Usage terms, as the site states them** (home page, http://mocap.cs.cmu.edu/):
  > This data is free for use in research projects. You may include this data in
  > commercially-sold products, but you may not resell this data directly, even in converted form.
  > If you publish results obtained using this data, we would appreciate it if you would send the
  > citation to your published paper to jkh+mocap@cs.cmu.edu, and also would add this text to your
  > acknowledgments section: *The data used in this project was obtained from mocap.cs.cmu.edu.
  > The database was created with funding from NSF EIA-0196217.*

  and in the FAQ (http://mocap.cs.cmu.edu/faqs.php), "How can I use this data?": *"The motion
  capture data may be copied, modified, or redistributed without permission."* The home page
  also says the dataset "is free for all uses". The acknowledgment text is in the game's credits
  (docs/credits.md) and in the files' own `extras.credits`.
- **Shipped** (in the two files above, retargeted, cleaned, resampled to 30 fps and quantised):

  The matching database (`mm` in `cmu-takes.json`):

  | Kind | Takes |
  |---|---|
  | walks | 16_15, 16_21, 16_31, 16_47, 35_01, 69_01, 104_02 (5 s), 143_32, 104_35 (3 s) |
  | walking turns | 16_11 (veer left), 16_17, 16_27 (90° left), 69_20 (90° right), 69_28 (smooth 90° right), 104_27 (right-angle turns, 6 s), 143_38 (figure of eight, 5.2 s) |
  | turning on the spot | 69_13 (walk, turn in place, 10 s), 69_16, 69_18 |
  | starts and stops | 16_33 (slow walk, stop), 16_08, 16_57 (run/jog, sudden stop), 104_06 (start jog), 104_09 (jog stop), 104_53 (start run), 104_56 (run stop), 127_04 (walk to run), 127_05 (run to quick stop), 127_17 (run stop run), 143_02 (run to stop), 143_03 (start to run) |
  | runs and jogs | 16_35, 16_36, 16_45, 16_46, 16_56 (run/jog), 16_55 (run), 16_37, 16_39 (jog veers), 16_41 (jog 90°), 16_48, 16_49 (run veers), 16_51, 16_53 (run 90°), 127_03, 127_09, 127_11 (runs, left and right), 127_13, 127_14 (run side steps), 127_15, 127_16 (run turns), 35_17, 35_18, 09_01, 09_02, 143_01, 143_04 (figure of eight, 6 s) |
  | backwards and sideways | 143_39, 69_34 (backwards, 4 s each), 143_40, 69_42 (sideways, 4 s each) |
  | standing | 140_06 (idle, 6 s), 139_02 (shifting weight), 113_21 (standing still, 6 s), 137_28 (normal wait, 6 s) |

  Steady takes also give one seamless cycle each (16_15, 16_21, 35_01, 69_01, 104_35, 16_35, 35_17,
  16_45, 16_46, 09_01), which the matcher can play round and round.

  The people's walks (`npc`): 137_29 (normal walk), 137_42 (strong man), 137_20 (gangly teen),
  142_13 (relaxed), 142_07 (elderly man), 142_01 (childish), 17_08 (muscular, heavyset), 132_17
  (walk fast), 82_10 (sad walk forward), 82_09 (confident walk forward), 136_20 (normal walk),
  91_29 (normal walk): one cycle of each.

- **Downloaded, converted, not shipped** (`ref`, for later work; `node scripts/mocap/build-library.mjs
  --stats` shows what each became): more walks, turns and runs of the same subjects (left/right
  pairs: the runtime mirrors every clip); stairs (83_27, 83_28, 83_34, 113_19, 114_07, 111_27);
  uneven ground (36_01, 36_02, 03_01); sidesteps (83_01, 83_19, 83_33); backwards (136_25);
  jumps and landings (16_05, 16_06, 13_11, 91_39, 118_01, 82_02, 82_03 (jump off a ledge), 83_42,
  143_05); stepping up onto a ledge or box (83_02, 83_03, 141_07, 40_06); swimming (125_01
  breaststroke, 125_06 and 126_10 freestyle); walks left out for quality (142_14, 82_11, 137_24,
  141_19, 07_01, 02_01, 137_33, 08_01, 132_45: no clean cycle, a foot that creeps, or too fast to
  look like a walk). Subject 105 duplicates subject 91 (the site notes the same person may appear
  under more than one number), so only 91 is used. The database has no climb up a ledge with the
  hands (the CMU takes step up onto low ledges); Mixamo's list fills that.

## Mixamo (Adobe)

- **Site:** https://www.mixamo.com/ (needs an Adobe account: the author downloads, see
  docs/mixamo-shopping-list.md). The first batch (36 clips, 2026-10-07: all 25 starts, stops and
  turns, the get-ups, the jumps, the drop, the wall push-off, the stumble, breathing idle, looking
  around, kneeling inspection, petting an animal) is converted into `locomotion.glb` (the starts,
  stops and turns, and the breathing idle) and `moves.glb` (the rest); the raw FBX files stay in
  `data/mocap/mixamo/`, and `node scripts/mocap/build-library.mjs` converts them with the rest.
- **Terms, as Adobe's Mixamo FAQ states them** (https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html):
  characters and animations downloaded from Mixamo are royalty free for personal, commercial and
  non-profit projects (games, films, …), and may be used in a project you sell; what is not
  allowed is redistributing the raw Mixamo files themselves (the characters or animations as
  assets of their own, e.g. in an asset pack or a library others can download). Here only the
  converted, retargeted clips inside the game's own files would ship, and the raw FBX files stay
  out of git (`.gitignore`: `data/mocap/mixamo/*.fbx`). Re-read the FAQ when downloading: Adobe
  may change it.
- This page records what the two sources publish; it is not a legal opinion. For a determination
  on whether a particular use is allowed, ask Legal (legal@findheadway.com, #legal-support).

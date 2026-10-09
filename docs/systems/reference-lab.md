# The reference lab

October 2026. A dev tool for making reference pictures (the 21 enemy archetype sheets first,
[design/enemy-roster-prompts.md](../design/enemy-roster-prompts.md)) with several image AIs at once and
keeping the best: one prompt and a few style references from `references/` go to every chosen provider, the
results come back side by side with a reference picture to compare against, and **Pick** copies the chosen one
into its folder with a manifest entry. Midjourney stays the house tool; the lab is for the sheets it gets wrong
(bodies that need exact joints, a skin that must keep the same body) and for comparing.

Two ways in, same files: the page `reference-lab.html` (Debug → Reference lab, **on the dev server only**) and
the CLI `scripts/gen-reference.mjs`. The code is in `scripts/reference-lab/` (server side) and
`src/reference-lab/` (the page); the tests are `tests/reference-lab.test.js` (mocked fetch, no keys).

## Keys

| Provider id | Key | What |
|---|---|---|
| `openai` | `OPENAI_API_KEY` | OpenAI GPT Image (`gpt-image-2` by default; `gpt-image-2.5-sunburst`, `-flare`, `gpt-image-1.5`, `gpt-image-1`, `-mini`) |
| `gemini` | `GEMINI_API_KEY` | Google Gemini image, "Nano Banana" (`gemini-nano-banana-2.1` by default; `gemini-3-pro-image` is the one with real style references) |
| `fal-flux`, `fal-flux-pro`, `fal-seedream`, `fal-ideogram`, `fal-recraft` | `FAL_KEY` or `FAL_API_KEY` | fal.ai: FLUX.2 [dev] and [pro] with several references, Seedream 4.5, Ideogram 3 (references as style), Recraft V3 (one reference, restyled) |
| `bfl` | `BFL_API_KEY` | Black Forest Labs direct: FLUX.2 [pro] (`flux-2-pro`; `-pro-preview`, `-max`, `-flex`, `-klein-9b`) without fal in between |
| `tripo` (3D mode) | `TRIPO_3D_API_KEY` or `TRIPO_API_KEY` | Tripo 3D: a picked reference (or a prompt) turned into a GLB model, optionally rigged ([3D mode](#3d-mode)) |

Put them in **`.env.local`** (or `.env`) at the repository root, one `NAME=value` a line. Both files are
git-ignored (`.gitignore`: `.env`, `.env.*`, `.env.local`; `tests/reference-lab.test.js` checks it). A git
worktree has neither file, so the lab also reads the main checkout's (found with `git rev-parse
--git-common-dir`). Order: the process environment, then `.env.local`, then `.env`, here then in the main
checkout; the first that has a key wins. A provider without a key is greyed on the page ("add KEY to
.env.local") and skipped by the CLI; `--list` shows which have one.

How the keys are kept safe (`scripts/reference-lab/env.mjs`, `common.mjs`):

- read **server-side only**, by the CLI or the dev server's middleware; the page is told which providers have a
  key, never the key;
- sent only in a request header (`Authorization`, `x-goog-api-key`, `x-key`), never in a URL (Tripo's only to
  `openapi.tripo3d.ai`: its model files come from a signed CDN URL fetched without it); a polling URL a
  provider sends back gets the key only if it is on that provider's own hosts over https (`onHost`);
- redacted from every error message before it is printed or written (`redact`), and never in
  `candidates.json` or a manifest;
- the middleware answers this machine only (a dev server started with `--host` is reachable from the network,
  and Generate spends money) and refuses other origins.

## Costs (list prices, checked 2026-10-09)

Per picture, USD. The page shows the estimate for each provider and each candidate, with `~` where it is a guess.

| Provider | Price | Note |
|---|---|---|
| OpenAI `gpt-image-2` | 0.041–0.053 (medium) | high quality about 4x; the 2.5 models are billed by token, no estimate |
| Gemini `nano-banana-2.1` | 0.034 at 1K | `3-pro-image` 0.134, `3.1-flash-image` 0.067 |
| BFL FLUX.2 [pro] | 0.03, 0.045 with references | [max] 0.07, [flex] 0.05; the answer's own `cost` (credits, $0.01 each) is used when given |
| fal (all five) | ~0.035–0.06 | fal's pricing page lists none of these; the estimate is rough, the invoice is the truth |

A batch of 2 images from 3 providers is about $0.25. The page checks one provider per key by default (fal's
other four are a click away).

## Running it

**The page.** `npx vite --port 5365` (any port but the author's 5173), open
`http://localhost:5365/reference-lab.html`, or Debug → Reference lab on the title (listed only by a dev server:
`DEV_PAGES` in `src/world-picker.js`). Then:

1. **Prompt:** free text, or one from the list: every entry of the prompt documents (`docs/**/*prompts*.md`,
   e.g. each archetype's main sheet and alternate skin) and every prompt recorded in the references' manifests
   (`references/**/*.json`, e.g. the title covers). Choosing an archetype fills its aspect ratio and target
   folder (`references/enemy-archetypes/<id>/`). Midjourney's flags are turned into words: `--ar` becomes the
   aspect ratio, `--no a b` a closing "Avoid: a, b."
2. **Style references:** thumbnails of every picture under `references/`, filtered by folder or by words in
   the path; click to add or remove. The first one is shown beside the results for comparison (or choose
   another). A provider takes as many as it can (OpenAI 16, Gemini 14, BFL 8, FLUX.2 [dev] 4, Recraft 1).
3. **Providers, count, aspect ratio**, and a model per provider; **Generate** (G, or Menu on a pad).
4. The reference pictures the batch was drawn from (if any) sit on their own above everything; below, every
   provider's pictures together in one grid (each card naming its provider, with its time and cost), so the pick is one choice across all of them; a provider that failed says why (no-key, auth, credits, rate-limit, blocked, server…)
   and the others carry on. Click a picture (or Enter, A) to zoom; ← → (LB / RB) through them.
5. **Pick** (P, X) asks why (optional) and copies the picture to the target folder; **Discard** (Del, Y)
   deletes a candidate; *Discard the batch* deletes the whole folder. **None of them…** turns the whole batch
   down and asks why (required): the reason is kept in the batch and in the target's `manifest.json` under
   `rejected` (with the prompt), so the next prompt can learn from it; *Take back* undoes it.
6. Every batch is on the one page, newest first, five to a page with a pager, filtered: **To pick** (the
   default: finished, nothing picked, not turned down; batches still generating wait out of the way, counted
   beside the filters, and join it when done), Picked, None of them, All (`#show=…&page=N` survives a reload).
   Gemini and OpenAI are checked by default (`DEFAULT_PROVIDERS`; the CLI's default too); the others are a
   click (or `--providers`) away.

Mouse, keys and a controller all work: the D-pad and the stick move across the page (`data-grid-nav`), the
buttons carry their glyphs, B closes the zoom and then goes back to the Debug menu (the shared ◀ Debug button,
`src/debug-back.js`). Desktop only.

**The CLI.**

```sh
node scripts/gen-reference.mjs --list
node scripts/gen-reference.mjs --from docs/design/enemy-roster-prompts.md#crab \
  --refs "references/The Desert/environement/IMG_3773.JPG" --providers openai,gemini,fal-flux --n 2
node scripts/gen-reference.mjs --from docs/design/enemy-roster-prompts.md#crab/alt \
  --refs references/enemy-archetypes/crab/sheet-1.jpg          # the alternate skin, from the chosen sheet
node scripts/gen-reference.mjs --prompt "…" --refs a.jpg,b.jpg --ar 3:2 --target references/enemy-archetypes/heron/
node scripts/gen-reference.mjs --model gemini=gemini-3-pro-image --from …   # another model for one provider
node scripts/gen-reference.mjs --batches
node scripts/gen-reference.mjs --pick 2026-10-10-09-12-03-ab12/openai/2 --why "the clearest silhouette"
node scripts/gen-reference.mjs --discard 2026-10-10-09-12-03-ab12[/gemini/1]
node scripts/gen-reference.mjs --into 2026-10-10-09-12-03-ab12 --providers gemini   # retry one in the same batch
node scripts/gen-reference.mjs --reject <batch> --why "too cute, not Moebius"   # none of them
node scripts/gen-reference.mjs --merge <batch>,<batch>,…   # batches of one prompt run apart, joined into the first
```

Keep one prompt in one batch: a provider that failed is retried with `--into` (the batch's own prompt and
references), not in a new batch, so its pictures sit beside the others' for the pick.

`--providers` defaults to Gemini and OpenAI (name others to compare them). `--pick
latest/openai/1` picks from the newest batch.

## Files and manifests

```
references/_candidates/<batch>/candidates.json        git-ignored: what was asked, each provider, every candidate
references/_candidates/<batch>/<provider>/<n>.jpg      (or .png: Gemini answers PNG)
<target>/sheet-N.jpg                                    a pick: the next free number, never an overwrite
<target>/manifest.json                                  its record, appended
```

The candidates are kept in the **main checkout** (`/…/moebius/references/_candidates/`, found with `git
rev-parse --git-common-dir`) even when the lab runs from a git worktree, so every batch shows on the author's
own dev server too and outlives the worktree (`REFERENCE_LAB_STORE=<dir>` moves them). The folder carries its own
`.gitignore` (`*`) besides the root one. Everything is on disk: the page lists every batch on load, newest first,
reopens the page it showed (`#page=N`), and picks and discards are written straight into `candidates.json`.
The page reads the candidates' pictures through the dev server (`/__reference-lab/file/<batch>/<provider>/<n>.jpg`).

`candidates.json`: `{ batch, date, created, prompt, from, refs, ar, n, target, comparison, status, providers: {
<id>: { status, label, model, ms, costUSD, count, kind?, error? } }, candidates: [{ id: '<provider>/<n>',
provider, model, file, mime, bytes, sha256, ms, costUSD, status: new | picked | discarded, pickedAs? }] }`.

A pick appends to the target's `manifest.json` (created as `{ archetype?, created, sheets: [] }`; an existing
Midjourney manifest, as in the prompts document, keeps its fields and gets a new entry in `sheets`):

```json
{
  "file": "sheet-2.jpg",
  "service": "Reference lab",
  "provider": "gemini",
  "providerLabel": "Google Gemini (Nano Banana)",
  "model": "gemini-nano-banana-2.1",
  "prompt": "<the prompt as sent>",
  "from": "docs/design/enemy-roster-prompts.md#crab",
  "refs": ["references/The Desert/environement/IMG_3773.JPG"],
  "ar": "16:9",
  "date": "2026-10-10",
  "batch": "2026-10-10-09-12-03-ab12",
  "candidate": "gemini/1",
  "sha256": "…", "bytes": 512345, "costUSD": 0.0336,
  "why": "the clearest silhouette"
}
```

## How the picks feed the work

The archetype sheets go where the prompts document says, `references/enemy-archetypes/<id>/sheet-N.jpg` with
its `manifest.json`, so the modellers and the procedural rigs read them as they would a Midjourney sheet; the
same picking rules apply (silhouette first, then the joints, then the wind-up pose; colour last). For an
alternate skin, add the chosen sheet-1 as a reference (the prompt's `[sheet-1 image URL]` placeholder is
dropped and the page reminds you): the providers that take references keep the body. Any other folder under
`references/` works as a target the same way.

## Providers in detail (docs checked 2026-10-09)

Each module's header records its endpoints, models and the docs read. In short:

- **OpenAI** (`providers/openai.mjs`): `POST /v1/images/generations` (text alone) or `/v1/images/edits`
  (multipart, each reference an `image[]` part), `n` pictures in one call, JPEG out, exact sizes on the 2+
  models (multiples of 16, long edge 1536), the three fixed sizes on the 1.x ones.
- **Gemini** (`providers/gemini.mjs`): `models/<model>:generateContent` with the references as `inlineData`
  parts and `generationConfig.imageConfig.aspectRatio`; one picture a call. Google's image guide now shows the
  Interactions API (`/v1beta/interactions`) in its examples: `GEMINI_IMAGE_API=interactions` in `.env.local`
  switches to it if generateContent ever refuses a model.
- **fal** (`providers/fal.mjs`): the REST queue (`queue.fal.run/<endpoint>`, then its `status_url` and
  `response_url`), the references as data URIs in `image_urls`; text alone uses each model's generation
  endpoint.
- **BFL** (`providers/bfl.mjs`): `POST api.bfl.ai/v1/<model>` with `input_image`, `input_image_2` … (8 at most,
  base64), then its `polling_url` until `Ready`, and the signed `result.sample` downloaded.

Rate limits: a 429 is retried once after `Retry-After` (at most 20 s), then reported as `rate-limit`; 401 / 403
`auth`, 402 `credits`, 5xx `server`. Not checked live by the tests: a provider's first real run is the check
that its endpoint and model ids still hold.

## 3D mode

The lab's second mode turns a picked reference into a 3D model with **Tripo** (Tripo3D, API v3), so a creature
or a character sheet can be looked at from every side, wireframed, and rigged before anyone models it by hand.
Code: `scripts/reference-lab/providers/tripo.mjs` (the API; its header lists every doc page read),
`scripts/reference-lab/batch3d.mjs` (batches and picks), `scripts/reference-lab/crop.mjs` (cutting a view out of
a sheet, with sharp), `src/reference-lab/viewer3d.js` (the three.js viewer, loaded only when a 3D batch shows);
tests `tests/reference-lab-3d.test.js` (mocked fetch, no key, no real call).

**What goes in.** One picture → *image to model*; 2 to 4 views of one subject → *multiview to model* (each view
marked front, left, back or right; front is required); no picture and a prompt → *text to model*. Our sheets put
four views side by side, and Tripo wants one subject a picture, so each picture can be **cropped**: on the page,
*Crop…* on an input opens the picture to drag a rectangle (or *1/4 … 4/4* for one of four views across the top,
a starting point to adjust); on the CLI, one `--crop x,y,w,h` per picture (pixels of the original; `-` for none).
The same sheet can be added several times, one crop a view. A crop is cut server-side and sent as PNG (Tripo
reads JPEG and PNG). The pictures as sent are kept in the batch (`inputs/`) and shown above its models.

**Options.** Model (`v3.1-20260211` default, `v3.0-20250812`, `v2.5-20250123`; the low-poly P series
`P1-20260311` and `P2-20260801`, 48–20,000 / 50,000 faces), texture on/off, PBR (forces a texture), HD texture
(`texture_quality: detailed`, v3 and P only), a face limit (empty: adaptive), quad (v3 or P2; **the output is
then FBX**, which the viewer also opens), candidates (1–4: one task each, run at once), and **rig it**: after the
model, Tripo's rig check (free) says whether it can be rigged and as what (biped, quadruped, hexapod, octopod,
avian, serpentine, aquatic); then the rig (`v1.0-20240301` for a biped, `v2.5-20260210` for the other bodies,
Tripo's own bone names) and a preview animation retargeted onto it (`preset:biped:walk`,
`preset:hexapod:walk`… ; avian has no preset, so no walk). A rig that fails, or a model that cannot be rigged,
leaves the model itself standing.

**Running.** The page: the *3D models* switch in the header (remembered; `#mode=3d` opens it), click pictures in
the references panel, set the options in the *3D · Tripo* panel (it shows the account's credits), Generate. The
CLI:

```sh
node scripts/gen-reference.mjs --3d --images references/enemy-archetypes/crab/sheet-1.jpg --crop 800,130,420,380
node scripts/gen-reference.mjs --3d --images a.jpg,b.jpg --views front,left --rig --n 2 [--faces 20000] [--quad]
node scripts/gen-reference.mjs --3d --images references/enemy-archetypes/crab/sheet-1.jpg,references/enemy-archetypes/crab/sheet-1.jpg \
  --crop 0,100,450,400 --crop 470,100,330,390 --views front,left        # two views cut out of one sheet
node scripts/gen-reference.mjs --3d --prompt "a lamp on three legs" --target references/enemy-archetypes/tripod/3d/
node scripts/gen-reference.mjs --pick <batch>/tripo/1 --why "the legs read"      # --reject, --discard as for 2D
```

**A batch** is stored like a 2D one (`references/_candidates/<batch>/candidates.json`, `mode: '3d'`), so the
filters (To pick, Picked, None of them, All) and the pager take both kinds together. The picture(s) is uploaded
once (`POST /v3/files` → a `file_token`), then each candidate is one generation task polled every 2 s
(`GET /v3/tasks/<id>`, up to 10 minutes) while the page shows its stage and progress; the model (it expires
after 5 minutes) and Tripo's own render are downloaded at once. One candidate failing leaves the others; the
failures are listed with their kind. Files: `tripo/<n>.glb` (or `.fbx`), `tripo/<n>-preview.<ext>`,
`tripo/<n>-rigged.glb`, `tripo/<n>-animated.glb`. Each candidate records its task ids, credits and cost.

**The page** shows each model in a small three.js stage: drag to orbit, wheel to zoom, **Turn** (the turntable,
on by default), **Wire** (wireframe), **Clay** (no texture), **Walk** (the rigged model's preview walk). At most
eight live viewers at once (a browser has about 16 WebGL contexts), made as their cards scroll into view; the
others show Tripo's still. **Pick**, **Discard**, **None of them…** and *Discard the batch* work as for 2D.

**Where a pick goes, and why.** `references/<…>/3d/`, by default a `3d/` folder beside the first picture
(the crab's sheet → `references/enemy-archetypes/crab/3d/`), any folder inside `references/` with `--target`:

```
references/enemy-archetypes/crab/3d/model-N.glb            the model (.fbx when quad), never an overwrite
references/enemy-archetypes/crab/3d/model-N-preview.webp   a turntable sheet (8 angles) drawn by the page on Pick
                                                           (CLI pick: Tripo's own render instead)
references/enemy-archetypes/crab/3d/model-N-rigged.glb     with a rig; model-N-walk.glb (its preview animation)
references/enemy-archetypes/crab/3d/manifest.json          { archetype, created, models: [ … ] }
```

`references/` is never part of the game: Vite builds only `BUILD_INPUT` and copies `public/`, and the Android
and web bundles are made from that build, so a model there costs nothing to players however large (Tripo's
textured GLBs are a few MB; a face limit and no PBR keep them smaller). It sits beside the sheet it came from,
as a reference like the sheet, and is committed with it (a few MB each: pick one per subject, not every
candidate). The manifest entry records everything needed to make it again or explain it:

```json
{
  "file": "model-1.glb", "preview": "model-1-preview.webp", "rigged": "model-1-rigged.glb", "animated": "model-1-walk.glb",
  "service": "Reference lab 3D", "provider": "tripo", "model": "v3.1-20260211", "kind": "image",
  "inputs": [{ "path": "references/enemy-archetypes/crab/sheet-1.jpg", "view": "front", "crop": { "x": 800, "y": 130, "w": 420, "h": 380 } }],
  "options": { "model": "v3.1-20260211", "texture": true, "pbr": true, "textureQuality": "standard", "faceLimit": null, "quad": false, "rig": true },
  "tasks": { "model": "task_…", "rigCheck": "task_…", "rig": "task_…", "retarget": "task_…" },
  "rig": { "status": "done", "rigType": "hexapod", "rigModel": "v2.5-20260210", "animation": "preset:hexapod:walk" },
  "date": "2026-10-10", "batch": "…", "candidate": "tripo/1", "format": "glb", "sha256": "…", "bytes": 4200000,
  "credits": 65, "costUSD": 0.65, "why": "the legs read"
}
```

**Bringing a picked model into the game later** (not done by the lab): the game draws its creatures itself in
ink and flat colour, so a Tripo model is first a reference for proportions, joints and silhouette. To use one
as geometry: copy it out of `references/` into `public/models/<kind>/<id>.glb`, shrink it there (decimate to
the game's budget, drop the PBR maps for the game's own toon material, meshopt or Draco compression with
gltf-transform), and load it lazily with the `GLTFLoader` the game already uses (`three/addons`), never by an
import that would pull it into the main bundle; a rigged one's bones would drive the creature's own gait code.

**Costs** (Tripo's pricing page, 2026-10-09; 1 credit = $0.01, credits frozen when a task starts and charged only
on success): image or multiview to model 20 credits untextured, 30 textured; text to model 10 / 20; HD texture
+10, quad +5; rig check free, rig 25, a retargeted animation 10. So one textured model from a picture is **$0.30**,
rigged with its walk $0.65. The P series' prices sit on a tab of the pricing page not in its text: the same
figures are used as an estimate. The tasks' own `credits_consumed` is what is recorded. The page and the CLI
show the estimate before; the *3D · Tripo* panel shows the balance (`GET /v3/account/balance`, free).

**Failures**, sorted like the 2D providers': `no-key` (nothing sent), `auth` (401, codes 1000/1001), `credits`
(Tripo answers a 403 with "not enough credit", or code 2010: "out of Tripo credits: top up at
platform.tripo3d.ai"), `bad-request` (400, an option the model does not take), `blocked` (a banned task, code
2008), `server` (a failed or expired task, a 5xx), `rate-limit` (429, retried once), `timeout`.

**First real run** (2026-10-09): the key works (the upload succeeded), but the account had **0 credits**: the
crab's three-quarter view came back `credits`, nothing charged. Tripo's API credits are bought on
[platform.tripo3d.ai](https://platform.tripo3d.ai) (Billing); a $0.30 run is the next check.

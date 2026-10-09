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

Put them in **`.env.local`** (or `.env`) at the repository root, one `NAME=value` a line. Both files are
git-ignored (`.gitignore`: `.env`, `.env.*`, `.env.local`; `tests/reference-lab.test.js` checks it). A git
worktree has neither file, so the lab also reads the main checkout's (found with `git rev-parse
--git-common-dir`). Order: the process environment, then `.env.local`, then `.env`, here then in the main
checkout; the first that has a key wins. A provider without a key is greyed on the page ("add KEY to
.env.local") and skipped by the CLI; `--list` shows which have one.

How the keys are kept safe (`scripts/reference-lab/env.mjs`, `common.mjs`):

- read **server-side only**, by the CLI or the dev server's middleware; the page is told which providers have a
  key, never the key;
- sent only in a request header (`Authorization`, `x-goog-api-key`, `x-key`), never in a URL; a polling URL a
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
   deletes a candidate; *Discard the batch* deletes the whole folder. The history lists every batch.

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
node scripts/gen-reference.mjs --merge <batch>,<batch>,…   # batches of one prompt run apart, joined into the first
```

Keep one prompt in one batch: a provider that failed is retried with `--into` (the batch's own prompt and
references), not in a new batch, so its pictures sit beside the others' for the pick.

`--providers` defaults to every provider with a key (all of fal's five: name them to spend less). `--pick
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
reopens the one it showed (`#batch=<id>`), and picks and discards are written straight into `candidates.json`.
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

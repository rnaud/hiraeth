// The reference lab (docs/systems/reference-lab.md): providers' requests with a mocked fetch (the key only in a
// header, the references encoded right), availability by key presence, the candidates / pick / discard files
// and manifests, the page kept out of the build, and the keys' files git-ignored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanMidjourney, parsePromptDoc, resolveFrom, manifestPrompts } from '../scripts/reference-lab/prompts.mjs';
import { parseEnv, loadKeys, availability, keyFor } from '../scripts/reference-lab/env.mjs';
import { PROVIDERS, providerById } from '../scripts/reference-lab/providers/index.mjs';
import { openaiSize } from '../scripts/reference-lab/providers/openai.mjs';
import { falImageSize } from '../scripts/reference-lab/providers/fal.mjs';
import { parseAspect, sizeFor, redact, httpJson, readRef, onHost } from '../scripts/reference-lab/common.mjs';
import { runBatch, mergeBatches, reject, pick, discard, listBatches, readBatch, nextSheet, parseCandidate, checkTarget, CANDIDATES_DIR } from '../scripts/reference-lab/batch.mjs';
import { referenceLabMiddleware, sameMachine, listRefs, referenceLabPlugin } from '../scripts/reference-lab/server.mjs';
import { parseArgs, main } from '../scripts/gen-reference.mjs';
import { batchHtml, defaultChecked, filterBatches, filterHtml, pagerHtml, providerRow, promptFor, filterRefs, fileSrc } from '../src/reference-lab/view.js';
import { DEV_PAGES, pagesHere, PAGES } from '../src/world-picker.js';
import { cameFromDebug } from '../src/debug-back.js';
import { BUILD_INPUT } from '../vite.config.js';

const KEY = 'sk-test-SECRET-1234567890';
// (git run from a test inside the pre-commit hook inherits GIT_DIR / GIT_INDEX_FILE: never pass them on)
const NO_GIT_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
const B64 = JPEG.toString('base64');

/** A small repository: two references, a prompt document, a manifest with a prompt. */
function fakeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'reflab-'));
  mkdirSync(join(root, 'references/levels/The Desert/environment'), { recursive: true });
  writeFileSync(join(root, 'references/levels/The Desert/environment/rock.jpg'), JPEG);
  writeFileSync(join(root, 'references/levels/The Desert/environment/dune.png'), Buffer.from('89504e47', 'hex'));
  writeFileSync(join(root, 'references/levels/The Desert/environment/notes.json'), JSON.stringify({ images: [{ label: 'A1', prompt: 'A wide desert cover with a tiny traveller and a ringed planet, Moebius ligne claire --ar 16:9 --no photorealism 3d-render' }] }));
  mkdirSync(join(root, 'docs/design'), { recursive: true });
  writeFileSync(join(root, 'docs/design/enemy-roster-prompts.md'), DOC);
  return root;
}
const DOC = `# Prompts

## Creatures

### 1. Shellback crab (\`crab\`)

**Main sheet: Vael II, the cliff crab.**

\`\`\`
Creature sheet: one shellback crab, four views, ink --ar 16:9 --no photorealism 3d-render text
\`\`\`

**Alternate skin: the Salt Harbour, the anchor crab.**

\`\`\`
[sheet-1 image URL] The same crab with barnacles --ar 3:2 --no scenery
\`\`\`

### 2. Ink blot (\`blot\`)

\`\`\`
An ink blot --ar 1:1
\`\`\`
`;

/** A fetch that answers from a script of handlers and records every call. */
function mockFetch(handler) {
  const calls = [];
  const f = async (url, init = {}) => { calls.push({ url: String(url), init }); return handler(String(url), init, calls.length); };
  f.calls = calls;
  return f;
}
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
const img = () => new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } });
const noKeyIn = (calls) => { for (const c of calls) assert.ok(!c.url.includes(KEY), `the key in a URL: ${c.url}`); };
const fast = { sleep: async () => {}, pollEvery: 0 };

// ------------------------------------------------------------------ prompts
test('prompt documents: entries, variants, the Midjourney flags turned into an aspect ratio and an Avoid line', () => {
  const e = parsePromptDoc(DOC);
  assert.deepEqual(e.map((x) => x.id), ['crab', 'blot']);
  assert.deepEqual(e[0].variants.map((v) => v.key), ['main', 'alt']);
  assert.equal(e[0].variants[0].ar, '16:9');
  assert.match(e[0].variants[0].prompt, /^Creature sheet: one shellback crab, four views, ink\. Avoid: photorealism, 3d render, text\.$/);
  assert.equal(e[0].variants[1].needsImage, true);
  assert.doesNotMatch(e[0].variants[1].prompt, /image URL/);
  assert.deepEqual(cleanMidjourney('plain words'), { prompt: 'plain words', ar: null, negative: '' });
  const root = fakeRepo();
  const r = resolveFrom(root, 'docs/design/enemy-roster-prompts.md#crab');
  assert.equal(r.target, 'references/enemy-archetypes/crab/');
  assert.equal(r.ar, '16:9');
  assert.equal(resolveFrom(root, 'docs/design/enemy-roster-prompts.md#crab/alt').ar, '3:2');
  assert.throws(() => resolveFrom(root, 'docs/design/enemy-roster-prompts.md#nope'), /no "nope"/);
  assert.throws(() => resolveFrom(root, '../outside.md#x'), /outside the repository/);
  assert.equal(manifestPrompts(root).length, 1);
  rmSync(root, { recursive: true, force: true });
});

test('a prompt document can name its own target folder', async () => {
  const { targetFor } = await import('../scripts/reference-lab/prompts.mjs');
  assert.equal(targetFor('docs/design/desert-places-prompts.md', 'skull', 'x\nTarget folder: `references/levels/The Desert/places/<id>/`\n'), 'references/levels/The Desert/places/skull/');
  assert.equal(targetFor('docs/design/enemy-roster-prompts.md', 'crab'), 'references/enemy-archetypes/crab/');
  assert.equal(targetFor('docs/x-prompts.md', 'a'), 'references/a/');
});

test('the real enemy roster prompts parse: 21 archetypes, each with a main sheet', () => {
  const md = readFileSync(new URL('../docs/design/enemy-roster-prompts.md', import.meta.url), 'utf8');
  const e = parsePromptDoc(md);
  assert.equal(e.length, 21, e.map((x) => x.id).join(','));
  for (const x of e) assert.ok(x.variants[0].key === 'main' && x.variants[0].prompt.length > 200 && x.variants[0].ar, x.id);
});

// ------------------------------------------------------------------ keys
test('keys: .env.local then .env, only the providers\' names, fal under either name; availability tells no value', () => {
  assert.deepEqual(parseEnv('# c\nexport OPENAI_API_KEY="a b"\nFAL_API_KEY=xyz # note\nOTHER=1\n'), { OPENAI_API_KEY: 'a b', FAL_API_KEY: 'xyz', OTHER: '1' });
  const files = { '/r/.env.local': 'GEMINI_API_KEY=local\n', '/r/.env': 'GEMINI_API_KEY=late\nFAL_API_KEY=falkey\nSECRET_OTHER=1\n' };
  const root = mkdtempSync(join(tmpdir(), 'reflab-env-'));
  writeFileSync(join(root, '.env.local'), files['/r/.env.local']);
  writeFileSync(join(root, '.env'), files['/r/.env']);
  const keys = loadKeys(root, { processEnv: {}, files: [join(root, '.env.local'), join(root, '.env')] });
  assert.deepEqual(keys, { GEMINI_API_KEY: 'local', FAL_API_KEY: 'falkey' });
  assert.equal(keyFor(providerById('fal-flux'), keys), 'falkey');
  const av = availability(PROVIDERS, keys);
  assert.equal(av.find((p) => p.id === 'gemini').available, true);
  assert.equal(av.find((p) => p.id === 'fal-seedream').available, true);
  assert.equal(av.find((p) => p.id === 'openai').available, false);
  assert.equal(av.find((p) => p.id === 'bfl').available, false);
  const text = JSON.stringify(av);
  assert.ok(!text.includes('local') || !text.includes('"local"'), 'no key value');
  assert.ok(!text.includes('falkey'));
  assert.deepEqual(loadKeys(root, { processEnv: {}, files: [] }), {}, 'no files, no keys: nothing available');
  rmSync(root, { recursive: true, force: true });
});

test('.env.local, .env and the candidates are git-ignored', () => {
  const cwd = new URL('..', import.meta.url).pathname;
  for (const f of ['.env.local', '.env', 'references/_candidates/2026-10-09-x/openai/1.jpg']) {
    const out = execFileSync('git', ['check-ignore', '-v', '--no-index', f], { cwd, encoding: 'utf8', env: NO_GIT_ENV });
    assert.ok(out.trim(), `${f} ignored`);
  }
  assert.match(readFileSync(new URL('../.gitignore', import.meta.url), 'utf8'), /^\.env\.local$/m);
});

// ------------------------------------------------------------------ sizes
test('aspect ratios map to each provider\'s sizes', () => {
  assert.throws(() => parseAspect('wide'));
  assert.throws(() => parseAspect('5:1'));
  assert.deepEqual(sizeFor('16:9', 1536), { width: 1536, height: 864 });
  assert.deepEqual(sizeFor('2:3', 1536), { width: 1024, height: 1536 });
  assert.equal(openaiSize('gpt-image-2', '16:9'), '1536x864');
  assert.equal(openaiSize('gpt-image-1', '16:9'), '1536x1024');
  assert.equal(openaiSize('gpt-image-1', '1:1'), '1024x1024');
  assert.equal(falImageSize('16:9'), 'landscape_16_9');
  assert.deepEqual(falImageSize('3:2'), { width: 1536, height: 1024 });
});

// ------------------------------------------------------------------ requests
const REF = { name: 'rock.jpg', mime: 'image/jpeg', base64: B64, path: 'references/levels/The Desert/environment/rock.jpg' };

test('OpenAI: references as image[] parts of /images/edits, the key in the Authorization header only', async () => {
  const p = providerById('openai');
  const { url, init } = p.buildRequest({ prompt: 'a rock', refs: [REF, REF], ar: '16:9', n: 2 }, KEY);
  assert.equal(url, 'https://api.openai.com/v1/images/edits');
  assert.equal(init.headers.Authorization, `Bearer ${KEY}`);
  const parts = init.body.getAll('image[]');
  assert.equal(parts.length, 2);
  assert.deepEqual(Buffer.from(await parts[0].arrayBuffer()), JPEG);
  assert.equal(parts[0].type, 'image/jpeg');
  assert.equal(init.body.get('size'), '1536x864');
  const t = p.buildRequest({ prompt: 'a rock', ar: '1:1' }, KEY);
  assert.equal(t.url, 'https://api.openai.com/v1/images/generations');
  assert.equal(JSON.parse(t.init.body).model, 'gpt-image-2');
  const f = mockFetch(() => json({ data: [{ b64_json: B64 }, { b64_json: B64 }], usage: { total_tokens: 1 } }));
  const r = await p.generate({ prompt: 'a rock', refs: [REF], ar: '16:9', n: 2 }, { key: KEY, fetch: f, ...fast });
  assert.equal(r.images.length, 2);
  assert.deepEqual(r.images[0].bytes, JPEG);
  assert.ok(r.costUSD > 0);
  noKeyIn(f.calls);
});

test('Gemini: references as inlineData, the aspect ratio in imageConfig, one call a picture, x-goog-api-key header', async () => {
  const p = providerById('gemini');
  const { url, init } = p.buildRequest({ prompt: 'a rock', refs: [REF], ar: '3:2' }, KEY);
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-nano-banana-2.1:generateContent');
  assert.equal(init.headers['x-goog-api-key'], KEY);
  const body = JSON.parse(init.body);
  assert.deepEqual(body.contents[0].parts[0], { inlineData: { mimeType: 'image/jpeg', data: B64 } });
  assert.equal(body.contents[0].parts.at(-1).text, 'a rock');
  assert.deepEqual(body.generationConfig, { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:2' } });
  const ia = p.buildRequest({ prompt: 'a rock', refs: [REF], ar: '3:2', api: 'interactions' }, KEY);
  assert.equal(ia.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.deepEqual(JSON.parse(ia.init.body).input[1], { type: 'image', mime_type: 'image/jpeg', data: B64 });
  const f = mockFetch(() => json({ candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { mimeType: 'image/png', data: B64 } }] } }] }));
  const r = await p.generate({ prompt: 'a rock', refs: [REF], ar: '1:1', n: 3 }, { key: KEY, fetch: f, ...fast });
  assert.equal(f.calls.length, 3);
  assert.equal(r.images.length, 3);
  assert.equal(r.images[0].mime, 'image/png');
  noKeyIn(f.calls);
  const blocked = mockFetch(() => json({ promptFeedback: { blockReason: 'SAFETY' } }));
  await assert.rejects(p.generate({ prompt: 'x', n: 1 }, { key: KEY, fetch: blocked, ...fast }), (e) => e.kind === 'blocked');
});

test('fal: data-URI references, the queue polled with the key only on fal hosts, the pictures fetched without it', async () => {
  const p = providerById('fal-flux');
  const { url, init } = p.buildRequest({ prompt: 'a rock', refs: [REF, REF, REF, REF, REF], ar: '16:9', perCall: 2 }, KEY);
  assert.equal(url, 'https://queue.fal.run/fal-ai/flux-2/edit');
  assert.equal(init.headers.Authorization, `Key ${KEY}`);
  const body = JSON.parse(init.body);
  assert.equal(body.image_urls.length, 4, 'FLUX.2 [dev] edit takes 4');
  assert.equal(body.image_urls[0], `data:image/jpeg;base64,${B64}`);
  assert.equal(body.num_images, 2);
  assert.equal(body.image_size, 'landscape_16_9');
  assert.equal(p.buildRequest({ prompt: 'a rock' }, KEY).url, 'https://queue.fal.run/fal-ai/flux-2', 'text alone: the generation endpoint');
  const rec = providerById('fal-recraft').buildRequest({ prompt: 'x', refs: [REF, REF] }, KEY);
  assert.equal(JSON.parse(rec.init.body).image_url, `data:image/jpeg;base64,${B64}`);
  let polls = 0;
  const f = mockFetch((u, i) => {
    if (u === 'https://queue.fal.run/fal-ai/flux-2/edit') return json({ request_id: 'r1', status_url: 'https://queue.fal.run/fal-ai/flux-2/requests/r1/status', response_url: 'https://queue.fal.run/fal-ai/flux-2/requests/r1' });
    if (u.endsWith('/status')) { assert.equal(i.headers.Authorization, `Key ${KEY}`); return json({ status: ++polls < 2 ? 'IN_PROGRESS' : 'COMPLETED' }); }
    if (u.endsWith('/requests/r1')) return json({ images: [{ url: 'https://v3.fal.media/files/a.jpg' }, { url: 'https://v3.fal.media/files/b.jpg' }] });
    if (u.startsWith('https://v3.fal.media/')) { assert.equal(i.headers, undefined, 'no key to the picture host'); return img(); }
    throw new Error(`unexpected ${u}`);
  });
  const r = await p.generate({ prompt: 'a rock', refs: [REF], ar: '1:1', n: 2 }, { key: KEY, fetch: f, ...fast });
  assert.equal(r.images.length, 2);
  noKeyIn(f.calls);
  const evil = mockFetch((u) => (u.includes('queue.fal.run/fal-ai') ? json({ status_url: 'https://evil.example/status', response_url: 'https://evil.example/r' }) : json({})));
  await assert.rejects(p.generate({ prompt: 'x', n: 1 }, { key: KEY, fetch: evil, ...fast }), /not on fal/);
  assert.ok(!evil.calls.some((c) => c.url.includes('evil')), 'never called with the key');
});

test('Recraft: a long prompt cut at a clause to its 1000 characters', async () => {
  const { fitPrompt } = await import('../scripts/reference-lab/providers/fal.mjs');
  const long = Array.from({ length: 80 }, (_, i) => `clause number ${i}`).join(', ');
  const cut = fitPrompt(long, 1000);
  assert.ok(cut.length <= 1000 && long.startsWith(cut) && /\d$/.test(cut));
  assert.equal(fitPrompt('short', 1000), 'short');
});

test('BFL: input_image, input_image_2…, x-key header, the polling URL checked, the cost from the answer', async () => {
  const p = providerById('bfl');
  const { url, init } = p.buildRequest({ prompt: 'a rock', refs: Array(10).fill(REF), ar: '16:9' }, KEY);
  assert.equal(url, 'https://api.bfl.ai/v1/flux-2-pro');
  assert.equal(init.headers['x-key'], KEY);
  const body = JSON.parse(init.body);
  assert.equal(body.input_image, B64);
  assert.equal(body.input_image_8, B64);
  assert.equal(body.input_image_9, undefined, 'eight at most');
  assert.equal(body.width % 16, 0);
  assert.equal(body.width, 1920);
  const f = mockFetch((u) => {
    if (u === 'https://api.bfl.ai/v1/flux-2-pro') return json({ id: 't', polling_url: 'https://api.us.bfl.ai/v1/get_result?id=t', cost: 4.5 });
    if (u.startsWith('https://api.us.bfl.ai/')) return json({ status: 'Ready', result: { sample: 'https://delivery.us.bfl.ai/x.jpg' } });
    if (u.startsWith('https://delivery')) return img();
    throw new Error(u);
  });
  const r = await p.generate({ prompt: 'a rock', refs: [REF], n: 1, ar: '1:1' }, { key: KEY, fetch: f, ...fast });
  assert.equal(r.costUSD, 0.045);
  noKeyIn(f.calls);
  assert.equal(onHost('https://api.bfl.ai.evil.com/x', ['bfl.ai']), false);
  assert.equal(onHost('http://api.bfl.ai/x', ['bfl.ai']), false, 'https only');
});

test('errors: a 429 retried once, then a clear kind; the key redacted from what the provider echoes', async () => {
  let n = 0;
  const f = mockFetch(() => (++n === 1 ? json({ error: { message: 'slow down' } }, 429, { 'retry-after': '1' }) : json({ ok: 1 })));
  assert.deepEqual(await httpJson('x', 'https://a.b/c', {}, { fetch: f, sleep: async () => {} }), { ok: 1 });
  const g = mockFetch(() => json({ error: { message: `bad key ${KEY}` } }, 401));
  await assert.rejects(httpJson('x', 'https://a.b/c', {}, { fetch: g, secrets: [KEY] }), (e) => e.kind === 'auth' && !e.message.includes(KEY) && /\[redacted\]/.test(e.message));
  const h = mockFetch(() => json({ error: 'quota' }, 429));
  await assert.rejects(httpJson('x', 'https://a.b/c', {}, { fetch: h, sleep: async () => {} }), (e) => e.kind === 'rate-limit');
  assert.equal(h.calls.length, 2);
  assert.equal(redact(`a ${KEY} b`, [KEY]), 'a [redacted] b');
});

test('errors: a dropped connection or a 5xx retried twice before giving up; a 4xx never', async () => {
  const waits = [];
  const quick = { sleep: async (ms) => { waits.push(ms); } };
  let n = 0;
  const flaky = mockFetch(() => { if (++n < 3) throw new TypeError('fetch failed'); return json({ ok: 1 }); });
  assert.deepEqual(await httpJson('x', 'https://a.b/c', {}, { fetch: flaky, ...quick }), { ok: 1 });
  assert.deepEqual(waits, [2000, 6000]);
  const down = mockFetch(() => { throw new TypeError('fetch failed'); });
  await assert.rejects(httpJson('x', 'https://a.b/c', {}, { fetch: down, ...quick }), (e) => e.kind === 'network' && /tried 3 times/.test(e.message));
  assert.equal(down.calls.length, 3);
  let m = 0;
  const busy = mockFetch(() => (++m === 1 ? json({ error: 'overloaded' }, 503) : json({ ok: 2 })));
  assert.deepEqual(await httpJson('x', 'https://a.b/c', {}, { fetch: busy, ...quick }), { ok: 2 });
  const bad = mockFetch(() => json({ error: 'nope' }, 400));
  await assert.rejects(httpJson('x', 'https://a.b/c', {}, { fetch: bad, ...quick }), (e) => e.kind === 'bad-request');
  assert.equal(bad.calls.length, 1);
});

// ------------------------------------------------------------------ batches and picks
function labFetch() {
  return mockFetch((u) => {
    if (u.startsWith('https://api.openai.com/')) return json({ data: [{ b64_json: B64 }, { b64_json: B64 }] });
    if (u.startsWith('https://generativelanguage')) return json({ error: { message: 'Resource exhausted' } }, 429);
    throw new Error(`unexpected ${u}`);
  });
}

test('a batch: every provider at once, one failing without stopping the others, candidates.json written; then pick and discard', async () => {
  const root = fakeRepo();
  const keys = { OPENAI_API_KEY: KEY, GEMINI_API_KEY: 'gm-SECRET-abcdef' };
  const m = await runBatch({ root, prompt: 'a rock', refs: ['references/levels/The Desert/environment/rock.jpg'], providers: ['openai', 'gemini', 'bfl'], n: 2, ar: '16:9', target: 'references/enemy-archetypes/crab', keys, fetch: labFetch(), ...fast, batch: 'b1' });
  assert.equal(m.status, 'done');
  assert.equal(m.providers.openai.status, 'done');
  assert.equal(m.providers.gemini.status, 'error');
  assert.equal(m.providers.gemini.kind, 'rate-limit');
  assert.equal(m.providers.bfl.kind, 'no-key');
  assert.match(m.providers.bfl.error, /add BFL_API_KEY to \.env\.local/);
  assert.deepEqual(m.candidates.map((c) => c.id), ['openai/1', 'openai/2']);
  assert.equal(m.target, 'references/enemy-archetypes/crab/');
  assert.equal(m.comparison, 'references/levels/The Desert/environment/rock.jpg');
  const dir = join(root, CANDIDATES_DIR, 'b1');
  assert.deepEqual(readFileSync(join(dir, 'openai/1.jpg')), JPEG);
  const file = readFileSync(join(dir, 'candidates.json'), 'utf8');
  assert.ok(!file.includes(KEY) && !file.includes('gm-SECRET'), 'no key in the manifest');
  assert.equal(listBatches(root)[0].batch, 'b1');

  const p1 = pick({ root, batch: 'b1', candidate: 'openai/2', why: 'the clearest silhouette', now: () => Date.parse('2026-10-10T10:00:00Z') });
  assert.equal(p1.file, 'references/enemy-archetypes/crab/sheet-1.jpg');
  const p2 = pick({ root, batch: 'b1', candidate: 'openai/1' });
  assert.equal(p2.file, 'references/enemy-archetypes/crab/sheet-2.jpg');
  const p3 = pick({ root, batch: 'b1', candidate: 'openai/1', why: 'on second thought' });
  assert.ok(p3.again && p3.file === p2.file, 'picked twice: one sheet, the reason updated');
  const mf = JSON.parse(readFileSync(join(root, 'references/enemy-archetypes/crab/manifest.json'), 'utf8'));
  assert.equal(mf.archetype, 'crab');
  assert.equal(mf.sheets.length, 2);
  assert.deepEqual(Object.keys(mf.sheets[0]).slice(0, 5), ['file', 'service', 'provider', 'providerLabel', 'model']);
  assert.equal(mf.sheets[0].prompt, 'a rock');
  assert.deepEqual(mf.sheets[0].refs, ['references/levels/The Desert/environment/rock.jpg']);
  assert.equal(mf.sheets[0].batch, 'b1');
  assert.equal(mf.sheets[0].date, '2026-10-10');
  assert.equal(mf.sheets[0].why, 'the clearest silhouette');
  assert.equal(readBatch(root, 'b1').candidates.find((c) => c.id === 'openai/2').status, 'picked');
  assert.equal(nextSheet(join(root, 'references/enemy-archetypes/crab')), 3);

  discard({ root, batch: 'b1', candidate: 'openai/1' });
  assert.ok(!existsSync(join(dir, 'openai/1.jpg')));
  assert.throws(() => pick({ root, batch: 'b1', candidate: 'openai/1' }), /discarded/);
  assert.deepEqual(parseCandidate(root, 'b1/openai/2'), { batch: 'b1', candidate: 'openai/2' });
  assert.deepEqual(parseCandidate(root, 'openai/2', 'latest'), { batch: 'b1', candidate: 'openai/2' });
  discard({ root, batch: 'b1' });
  assert.ok(!existsSync(dir));
  assert.throws(() => checkTarget(root, '../x'), /outside/);
  assert.throws(() => checkTarget(root, 'src/'), /inside references/);
  assert.throws(() => checkTarget(root, 'references/_candidates/x'), /inside references/);
  assert.throws(() => readBatch(root, '../../etc'), /batch id/);
  assert.throws(() => readRef(root, '../../etc/passwd.jpg'), /outside/);
  rmSync(root, { recursive: true, force: true });
});

test('one batch for one pick: a provider run again into the same batch, batches run apart merged', async () => {
  const root = fakeRepo();
  const keys = { OPENAI_API_KEY: KEY, GEMINI_API_KEY: 'gm-SECRET-abcdef' };
  const o = { root, refs: ['references/levels/The Desert/environment/rock.jpg'], n: 2, ar: '16:9', target: 'references/x/', keys, fetch: labFetch(), ...fast };
  await runBatch({ ...o, prompt: 'a rock', providers: ['openai'], batch: 'm1' });
  await runBatch({ ...o, prompt: 'a rock', providers: ['gemini'], batch: 'm2' });
  await runBatch({ ...o, prompt: 'a tree', providers: ['openai'], batch: 'm3' });
  // run again into m1: its own prompt and references, the openai pictures replaced, nothing doubled
  const again = await runBatch({ root, providers: ['openai'], batch: 'm1', keys, fetch: labFetch(), ...fast });
  assert.equal(again.prompt, 'a rock');
  assert.deepEqual(again.candidates.map((c) => c.id), ['openai/1', 'openai/2']);
  assert.throws(() => mergeBatches({ root, into: 'm1', from: ['m3'] }), /another prompt/);
  const m = mergeBatches({ root, into: 'm1', from: ['m2'] });
  assert.deepEqual(Object.keys(m.providers).sort(), ['gemini', 'openai']);
  assert.equal(m.providers.gemini.status, 'error');
  assert.ok(!existsSync(join(root, CANDIDATES_DIR, 'm2')));
  assert.deepEqual(listBatches(root).map((b) => b.batch), ['m3', 'm1']);
  // none of them: kept with the batch and in the target's manifest; no pick meanwhile; taken back
  assert.throws(() => reject({ root, batch: 'm3', why: ' ' }), /say why/);
  reject({ root, batch: 'm3', why: 'not Moebius enough', now: () => Date.parse('2026-10-09T12:00:00Z') });
  assert.deepEqual(readBatch(root, 'm3').rejected, { why: 'not Moebius enough', date: '2026-10-09' });
  assert.equal(listBatches(root)[0].rejected.why, 'not Moebius enough');
  const mf = JSON.parse(readFileSync(join(root, 'references/x/manifest.json'), 'utf8'));
  assert.deepEqual(mf.rejected.map((x) => [x.batch, x.why, x.prompt]), [['m3', 'not Moebius enough', 'a tree']]);
  assert.throws(() => pick({ root, batch: 'm3', candidate: 'openai/1' }), /turned down/);
  reject({ root, batch: 'm3', why: null });
  assert.equal(readBatch(root, 'm3').rejected, undefined);
  assert.equal(JSON.parse(readFileSync(join(root, 'references/x/manifest.json'), 'utf8')).rejected, undefined);
  rmSync(root, { recursive: true, force: true });
});

test('the CLI: arguments, --list without values, a batch from a prompt document, then --pick', async () => {
  assert.deepEqual(parseArgs(['--prompt', 'x', '--refs', 'a.jpg, b.jpg', '--providers', 'openai,gemini', '--n', '2', '--ar', '16:9']),
    { n: 2, refs: ['a.jpg', 'b.jpg'], providers: ['openai', 'gemini'], prompt: 'x', ar: '16:9' });
  assert.throws(() => parseArgs(['--bogus', '1']), /unknown option/);
  const root = fakeRepo();
  const lines = [], log = (l) => lines.push(l);
  await main(['--list'], { root, keys: { OPENAI_API_KEY: KEY }, log });
  assert.match(lines.join('\n'), /✓ openai/);
  assert.match(lines.join('\n'), /add GEMINI_API_KEY to \.env\.local/);
  assert.ok(!lines.join('\n').includes(KEY));
  lines.length = 0;
  const f = labFetch();
  const code = await main(['--from', 'docs/design/enemy-roster-prompts.md#crab', '--refs', 'references/levels/The Desert/environment/rock.jpg', '--n', '2'], { root, keys: { OPENAI_API_KEY: KEY }, fetch: f, log });
  assert.equal(code, 0, lines.join('\n'));
  assert.ok(!lines.join('\n').includes(KEY));
  const b = listBatches(root)[0];
  assert.equal(readBatch(root, b.batch).from, 'docs/design/enemy-roster-prompts.md#crab');
  assert.equal(readBatch(root, b.batch).ar, '16:9');
  await main(['--pick', `${b.batch}/openai/1`], { root, keys: {}, log });
  assert.ok(existsSync(join(root, 'references/enemy-archetypes/crab/sheet-1.jpg')));
  assert.equal(await main(['--prompt', 'x'], { root, keys: {}, log }), 1, 'no key: says what to add');
  rmSync(root, { recursive: true, force: true });
});

// ------------------------------------------------------------------ the dev server
function fakeReq(method, url, body, { addr = '127.0.0.1', origin = null } = {}) {
  const listeners = {};
  const req = { method, url, headers: { host: 'localhost:5365', ...(origin ? { origin } : {}) }, socket: { remoteAddress: addr },
    on(ev, fn) { listeners[ev] = fn; if (ev === 'end') queueMicrotask(() => { if (body) listeners.data?.(Buffer.from(JSON.stringify(body))); fn(); }); return req; } };
  return req;
}
async function call(mw, method, url, body, opts) {
  let out;
  const done = new Promise((r) => { out = r; });
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { out({ status: this.statusCode, body: JSON.parse(b) }); } };
  await mw(fakeReq(method, url, body, opts), res, () => out({ status: 'next' }));
  return done;
}

test('the dev server: availability with no values, refs without the candidates, generate / poll / pick, this machine only', async () => {
  const root = fakeRepo();
  const mw = referenceLabMiddleware({ root, fetch: labFetch(), keys: () => ({ OPENAI_API_KEY: KEY }) });
  assert.equal((await call(mw, 'GET', '/src/main.js')).status, 'next');
  const prov = await call(mw, 'GET', '/__reference-lab/providers');
  assert.ok(!JSON.stringify(prov.body).includes(KEY));
  assert.equal(prov.body.providers.find((p) => p.id === 'openai').available, true);
  const g = await call(mw, 'POST', '/__reference-lab/generate', { prompt: 'a rock', refs: ['references/levels/The Desert/environment/rock.jpg'], providers: ['openai'], n: 1, ar: '1:1', target: 'references/x/' });
  assert.equal(g.status, 202);
  let b;
  for (let i = 0; i < 50; i++) { b = (await call(mw, 'GET', `/__reference-lab/batches/${g.body.batch}`)).body; if (b.status === 'done') break; await new Promise((r) => setTimeout(r, 10)); }
  assert.equal(b.status, 'done');
  assert.equal(listRefs(root).some((r) => r.path.startsWith(CANDIDATES_DIR)), false, 'the candidates are not offered as references');
  let served;
  const fileRes = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(buf) { served = { status: this.statusCode, type: this.headers['Content-Type'], buf }; } };
  await mw(fakeReq('GET', `/__reference-lab/file/${b.batch}/openai/1.jpg`), fileRes, () => {});
  assert.equal(served.status, 200);
  assert.equal(served.type, 'image/jpeg');
  assert.deepEqual(Buffer.from(served.buf), JPEG);
  assert.equal((await call(mw, 'GET', `/__reference-lab/file/${b.batch}/..%2F..%2Fx/1.jpg`)).status, 404, 'no path tricks');
  assert.equal((await call(mw, 'GET', '/__reference-lab/batches')).body.batches.length, 1, 'the history is read from disk (a reload lists it)');
  const pk = await call(mw, 'POST', '/__reference-lab/pick', { batch: b.batch, candidate: b.candidates[0].id });
  assert.equal(pk.body.file, 'references/x/sheet-1.jpg');
  assert.equal((await call(mw, 'POST', '/__reference-lab/generate', { prompt: '' })).status, 400);
  assert.equal((await call(mw, 'GET', '/__reference-lab/providers', null, { addr: '192.168.1.20' })).status, 403);
  assert.equal((await call(mw, 'POST', '/__reference-lab/generate', { prompt: 'x' }, { origin: 'https://evil.example' })).status, 403);
  assert.equal(sameMachine({ socket: { remoteAddress: '::1' }, headers: { host: 'localhost:5365', origin: 'http://localhost:5365' } }), true);
  assert.equal(referenceLabPlugin().apply, 'serve', 'the middleware exists only under vite dev');
  rmSync(root, { recursive: true, force: true });
});

test('the store: elsewhere than the checkout when told (the main checkout from a worktree), git-ignored on its own', async () => {
  // (no git is run here: a test inside the pre-commit hook must never touch a repository)
  const root = fakeRepo(), store = mkdtempSync(join(tmpdir(), 'reflab-store-'));
  process.env.REFERENCE_LAB_STORE = store;
  try {
    const m = await runBatch({ root, prompt: 'p', refs: ['references/levels/The Desert/environment/rock.jpg'], providers: ['openai'], n: 1, ar: '1:1', keys: { OPENAI_API_KEY: KEY }, fetch: labFetch(), ...fast, batch: 'w1' });
    assert.equal(m.candidates.length, 2, 'the mock answers two');
    assert.ok(existsSync(join(store, CANDIDATES_DIR, 'w1/openai/1.jpg')), 'in the store');
    assert.ok(!existsSync(join(root, CANDIDATES_DIR, 'w1')), 'not in the checkout');
    assert.equal(readFileSync(join(store, CANDIDATES_DIR, '.gitignore'), 'utf8').trim().split('\n').pop(), '*');
    assert.equal(listBatches(root)[0].batch, 'w1');
  } finally { delete process.env.REFERENCE_LAB_STORE; }
  rmSync(root, { recursive: true, force: true }); rmSync(store, { recursive: true, force: true });
});

// ------------------------------------------------------------------ the page
test('the page: not built, in the Debug menu only on the dev server, with the ◀ Debug button and controller glyphs', () => {
  const inputs = Object.values(BUILD_INPUT).map((p) => p.split('/').pop());
  assert.ok(!inputs.includes('reference-lab.html'), 'never in the build (so never in the web bundle, the APK or the Deck)');
  assert.ok(!PAGES.some((p) => p.href === 'reference-lab.html'));
  assert.ok(DEV_PAGES.some((p) => p.href === 'reference-lab.html'));
  assert.ok(pagesHere(true).some((p) => p.href === 'reference-lab.html'));
  assert.ok(!pagesHere(false).some((p) => p.href === 'reference-lab.html'));
  const html = readFileSync(new URL('../reference-lab.html', import.meta.url), 'utf8');
  assert.match(html, /<script type="module" src="\/src\/debug-back-page\.js"><\/script>/);
  assert.match(html, /<body[^>]* data-debug-back="pad-off"/);
  assert.match(html, /class="debug-room"/);
  assert.match(html, /data-glyph="back"/);
  assert.equal(cameFromDebug('http://localhost:5365/reference-lab.html', ''), true);
  const src = readFileSync(new URL('../src/reference-lab/main.js', import.meta.url), 'utf8');
  assert.match(src, /dataset\.gridNav = ''/);
  assert.doesNotMatch(src, /process\.env|\.env\.local'\)|readFileSync/, 'the page reads no keys: only the server does');
});

test('the page\'s drawing: a provider without a key greyed with the name to add, every provider\'s pictures in one grid beside its reference', () => {
  const off = providerRow({ id: 'bfl', label: 'BFL', keyName: 'BFL_API_KEY', available: false, models: ['m'], maxRefs: 8, costPerImage: 0.03 });
  assert.match(off, /class="prov off"/);
  assert.match(off, /add BFL_API_KEY to \.env\.local/);
  assert.match(off, /disabled/);
  const on = providerRow({ id: 'gemini', label: 'G', keyName: 'GEMINI_API_KEY', available: true, model: 'b', models: ['a', 'b'], maxRefs: 14, costPerImage: 0.0336 }, { checked: true });
  assert.match(on, /<option selected>b<\/option>/);
  assert.match(on, /checked/);
  const m = { batch: 'b1', status: 'done', ar: '16:9', n: 1, refs: ['references/levels/The Desert/environment/rock.jpg'], comparison: 'references/levels/The Desert/environment/rock.jpg', prompt: 'p', target: 'references/x/',
    providers: { openai: { status: 'done', label: 'OpenAI', model: 'gpt-image-2', count: 1, ms: 12000, costUSD: 0.041 }, gemini: { status: 'error', kind: 'auth', error: 'refused' } },
    candidates: [{ id: 'openai/1', provider: 'openai', file: 'openai/1.jpg', ms: 12000, costUSD: 0.041, status: 'new' }] };
  const h = batchHtml(m);
  assert.match(h, /src="\/references\/levels\/The%20Desert\/environment\/rock\.jpg"/, 'the reference');
  assert.ok(h.indexOf('class="refrow"') < h.indexOf('class="bhead"') && !/class="wall">[^]*rock\.jpg/.test(h), 'the reference on its own above everything, not in the grid');
  assert.match(h, /src="\/__reference-lab\/file\/b1\/openai\/1\.jpg"/, 'through the dev server: the store is the main checkout');
  assert.match(h, /data-pick="openai\/1"/);
  assert.match(h, /12\.0 s/);
  assert.match(h, /auth: refused/);
  assert.match(h, /class="wall"/, 'every provider\'s pictures in one grid, for one pick across them');
  assert.match(h, /<b>OpenAI<\/b> #1/, 'each card says which provider made it');
  assert.match(h, /data-batch-id="b1"/);
  assert.match(h, /data-reject/, 'none of them, when nothing is picked');
  const r = batchHtml({ ...m, rejected: { why: 'too cute', date: '2026-10-09' } });
  assert.match(r, /None of them<\/b> \(2026-10-09\): too cute/);
  assert.match(r, /data-unreject/);
  assert.doesNotMatch(r, /data-reject[ >]/);
  assert.match(pagerHtml(3, 1), /3 batches/);
  const pg = pagerHtml(23, 3);
  assert.match(pg, /data-page="2"/);
  assert.match(pg, /aria-current="page">3</);
  assert.match(pg, /data-page="5"[^>]*>5</);
  assert.match(pg, /11–15/);
  const list = [{ batch: 'a', picked: 1 }, { batch: 'b', picked: 0, rejected: { why: 'x' } }, { batch: 'c', picked: 0 }, { batch: 'd', picked: 0, status: 'running' }];
  assert.deepEqual(filterBatches(list).map((b) => b.batch), ['c'], 'to pick by default: finished, no pick, not turned down (d still generating)');
  assert.match(filterHtml(list), /1 generating…/);
  assert.deepEqual(filterBatches(list, 'picked').map((b) => b.batch), ['a']);
  assert.deepEqual(filterBatches(list, 'rejected').map((b) => b.batch), ['b']);
  assert.equal(filterBatches(list, 'all').length, 4, 'All shows the running ones too');
  assert.deepEqual(['openai', 'gemini', 'fal-flux', 'bfl'].map((id) => defaultChecked({ id, available: true })), [true, true, false, false], 'Gemini and OpenAI by default');
  assert.equal(defaultChecked({ id: 'openai', available: false }), false);
  assert.match(filterHtml(list), /class="btn small on" data-show="open" aria-pressed="true">To pick <small>1<\/small>/);
  assert.equal(fileSrc('references/a b/c.jpg'), '/references/a%20b/c.jpg');
  assert.equal(filterRefs([{ path: 'references/levels/The Desert/environment/x.jpg', folder: 'The Desert' }, { path: 'references/levels/Lorn/environment/y.jpg', folder: 'Lorn' }], { query: 'desert' }).length, 1);
  const prompts = { docs: [{ doc: 'd.md', entries: [{ id: 'crab', title: 'Crab', target: 'references/enemy-archetypes/crab/', variants: [{ key: 'main', prompt: 'P', ar: '16:9' }] }] }], manifests: [] };
  assert.deepEqual(promptFor(prompts, 'doc:d.md#crab/main'), { prompt: 'P', ar: '16:9', target: 'references/enemy-archetypes/crab/', from: 'd.md#crab', needsImage: undefined });
});

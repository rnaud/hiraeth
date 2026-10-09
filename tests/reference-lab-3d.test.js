// The reference lab's 3D mode (docs/systems/reference-lab.md, "3D mode"): Tripo's requests with a mocked fetch
// (the key only in the Authorization header and only to openapi.tripo3d.ai, the outputs fetched without it),
// polling, rigging, the failure kinds, crops, the batch files, the pick into references/…/3d/, the CLI, the
// dev server's routes and the page's drawing of a 3D batch. No real call is made.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tripo, { generationRequest, estimateCredits, tripoOptions, formatOf, tripoKind, TRIPO_API } from '../scripts/reference-lab/providers/tripo.mjs';
import { run3dBatch, prepare3dBatch, pick3d, pickAny, assignViews, default3dTarget, nextModel, previewFromDataUrl } from '../scripts/reference-lab/batch3d.mjs';
import { parseCrop, clampCrop, prepareView } from '../scripts/reference-lab/crop.mjs';
import { readBatch, pick, discard, reject, listBatches, runBatch } from '../scripts/reference-lab/batch.mjs';
import { referenceLabMiddleware } from '../scripts/reference-lab/server.mjs';
import { parseArgs, main } from '../scripts/gen-reference.mjs';
import { batchHtml, batch3dHtml, filterBatches } from '../src/reference-lab/view.js';

const KEY = 'tsk_test-SECRET-0987654321';
const KEYS = { TRIPO_3D_API_KEY: KEY };
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
const GLB = Buffer.concat([Buffer.from('glTF'), Buffer.from([2, 0, 0, 0, 20, 0, 0, 0]), Buffer.alloc(8)]);
const PNG1 = Buffer.from('89504e470d0a1a0a0000', 'hex');
const fast = { sleep: async () => {}, pollEvery: 0 };

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* the crop tests skip */ }

function fakeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'reflab3d-'));
  process.env.REFERENCE_LAB_STORE = root;   // (the store in the fake repository, not the real main checkout's)
  mkdirSync(join(root, 'references/enemy-archetypes/crab'), { recursive: true });
  writeFileSync(join(root, 'references/enemy-archetypes/crab/sheet-1.jpg'), JPEG);
  writeFileSync(join(root, 'references/enemy-archetypes/crab/side.jpg'), JPEG);
  return root;
}
const done = (root) => { rmSync(root, { recursive: true, force: true }); delete process.env.REFERENCE_LAB_STORE; };

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const ok = (data) => json({ code: 0, data });

/**
 * A scripted Tripo: uploads give tokens, each created task gets an id and answers `polls` running states before
 * its result; `script(path, body, n)` may return a Response to override. Records every call.
 */
function fakeTripo({ script = () => null, polls = 1, rigType = 'hexapod', riggable = true, credits = { model: 30, rig: 25, retarget: 10 } } = {}) {
  const calls = [], tasks = new Map();
  let t = 0, u = 0;
  const f = async (url, init = {}) => {
    url = String(url);
    calls.push({ url, init });
    const path = url.startsWith(TRIPO_API) ? url.slice(TRIPO_API.length) : null;
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    const over = script(path ?? url, body, calls.length);
    if (over) return over;
    if (url.startsWith('https://cdn.tripo3d.ai/')) {
      return url.endsWith('.webp') ? new Response(PNG1, { headers: { 'content-type': 'image/png' } }) : new Response(GLB, { headers: { 'content-type': 'model/gltf-binary' } });
    }
    if (path === '/files') return ok({ file_token: `file_${++u}` });
    if (path === '/account/balance') return ok({ balance: 1234.5, frozen: 30 });
    const m = path?.match(/^\/tasks\/(task_\d+)$/);
    if (m) {
      const k = tasks.get(m[1]);
      if (k.left-- > 0) return ok({ task_id: m[1], status: k.left ? 'queued' : 'running', progress: 40 });
      return ok({ task_id: m[1], status: 'success', progress: 100, output: k.output, credits_consumed: k.credits });
    }
    if (path?.startsWith('/generation/') || path?.startsWith('/animations/')) {
      const id = `task_${++t}`;
      const kind = path.split('/').pop();
      const output = kind === 'rig-check' ? { riggable, rig_type: rigType }
        : kind === 'rig' ? { model_url: `https://cdn.tripo3d.ai/out/${id}-rigged.glb` }
          : kind === 'retarget' ? { model_url: `https://cdn.tripo3d.ai/out/${id}-walk.glb` }
            : { model_url: `https://cdn.tripo3d.ai/out/${id}.glb?sig=1`, rendered_image_url: `https://cdn.tripo3d.ai/out/${id}.webp` };
      tasks.set(id, { left: polls, output, credits: kind === 'rig-check' ? 0 : kind === 'rig' ? credits.rig : kind === 'retarget' ? credits.retarget : credits.model, body });
      return ok({ task_id: id });
    }
    return json({ code: 2002, message: `unexpected ${url}` }, 404);
  };
  f.calls = calls; f.tasks = tasks;
  return f;
}
/** The key: only ever in an Authorization header to Tripo's API host, never in a URL or to the CDN. */
function keySafe(calls) {
  for (const c of calls) {
    assert.ok(!c.url.includes(KEY), `the key in a URL: ${c.url}`);
    const auth = c.init?.headers?.Authorization;
    if (c.url.startsWith(TRIPO_API)) assert.equal(auth, `Bearer ${KEY}`, c.url);
    else assert.equal(auth, undefined, `a header with the key to ${c.url}`);
  }
}

// ------------------------------------------------------------------ requests
test('Tripo requests: image, multiview (front first, 2–4 views), text; options the model takes; texture off means no PBR', () => {
  const img = generationRequest('image', { inputs: [{ token: 'file_1' }], options: { faceLimit: 20000 } });
  assert.equal(img.path, '/generation/image-to-model');
  assert.deepEqual(img.body, { input: 'file_1', model: 'v3.1-20260211', texture: true, pbr: true, texture_quality: 'standard', face_limit: 20000 });
  const mv = generationRequest('multiview', { inputs: [{ view: 'front', token: 'a' }, { view: 'left', token: 'b' }], options: { texture: false, pbr: true, quad: true } });
  assert.equal(mv.path, '/generation/multiview-to-model');
  assert.deepEqual(mv.body, { inputs: [{ front: 'a' }, { left: 'b' }], model: 'v3.1-20260211', texture: false, pbr: false, quad: true });
  assert.throws(() => generationRequest('multiview', { inputs: [{ view: 'left', token: 'a' }, { view: 'back', token: 'b' }] }), /front view/);
  assert.throws(() => generationRequest('multiview', { inputs: [{ view: 'front', token: 'a' }] }), /2 to 4/);
  assert.throws(() => generationRequest('multiview', { inputs: [{ view: 'front', token: 'a' }, { view: 'front', token: 'b' }] }), /two pictures/);
  const txt = generationRequest('text', { prompt: 'x'.repeat(2000), negative: 'n', options: { model: 'v2.5-20250123' } });
  assert.equal(txt.path, '/generation/text-to-model');
  assert.equal(txt.body.prompt.length, 1024);
  assert.equal(txt.body.texture_quality, undefined, 'v2.5 takes no texture_quality');
  assert.throws(() => generationRequest('image', { inputs: ['f'], options: { model: 'v2.5-20250123', quad: true } }), (e) => e.kind === 'bad-request' && /quad/.test(e.message));
  assert.throws(() => generationRequest('image', { inputs: ['f'], options: { model: 'nope' } }), /no Tripo model/);
  assert.equal(generationRequest('image', { inputs: ['f'], options: { model: 'P1-20260311', faceLimit: 90000 } }).body.face_limit, 20000);
  assert.deepEqual(tripoOptions({}), { model: 'v3.1-20260211', texture: true, pbr: true, textureQuality: 'standard', faceLimit: null, quad: false, rig: false });
});

test('Tripo costs: the pricing page per kind and add-on, a credit a cent', () => {
  assert.equal(estimateCredits('image', {}), 30);
  assert.equal(estimateCredits('image', { texture: false }), 20);
  assert.equal(estimateCredits('text', {}), 20);
  assert.equal(estimateCredits('multiview', { textureQuality: 'detailed', quad: true }), 45);
  assert.equal(estimateCredits('image', { rig: true }), 65);
  assert.equal(tripo.costPerImage(), 0.3);
  assert.equal(formatOf(GLB), 'glb');
  assert.equal(formatOf(Buffer.from('Kaydara FBX Binary  ')), 'fbx');
  assert.equal(formatOf(Buffer.from('????'), 'https://x/y.fbx?s=1'), 'fbx');
  assert.equal(tripoKind({ message: 'HTTP 403: Insufficient credits', kind: 'auth' }), 'credits');
});

// ------------------------------------------------------------------ batches
test('a 3D batch: the picture uploaded once, n tasks polled to the end, models and previews saved, one failing without stopping the other', async () => {
  const root = fakeRepo();
  let created = 0;
  const f = fakeTripo({ polls: 2, script: (path) => (path === '/generation/image-to-model' && ++created === 2 ? json({ code: 2002, message: 'Unsupported request parameter' }, 400) : null) });
  const m = await run3dBatch({ root, images: ['references/enemy-archetypes/crab/side.jpg'], n: 2, keys: KEYS, fetch: f, ...fast });
  keySafe(f.calls);
  assert.equal(f.calls.filter((c) => c.url.endsWith('/files')).length, 1, 'one upload for both candidates');
  const up = f.calls.find((c) => c.url.endsWith('/files'));
  assert.ok(up.init.body instanceof FormData && up.init.body.get('file'), 'multipart with a file part');
  const gen = f.calls.find((c) => c.url.endsWith('/generation/image-to-model'));
  assert.equal(JSON.parse(gen.init.body).input, 'file_1');
  assert.equal(m.mode, '3d');
  assert.equal(m.kind, 'image');
  assert.equal(m.target, 'references/enemy-archetypes/crab/3d/', 'beside the picture');
  assert.equal(m.candidates.length, 1);
  const c = m.candidates[0];
  assert.equal(c.format, 'glb');
  assert.equal(c.credits, 30);
  assert.equal(c.costUSD, 0.3);
  assert.equal(c.tasks.model, 'task_1');
  const dir = join(root, 'references/_candidates', m.batch);
  assert.deepEqual(readFileSync(join(dir, c.file)), GLB);
  assert.ok(existsSync(join(dir, c.preview)), 'Tripo\'s render kept');
  assert.ok(existsSync(join(dir, m.inputs[0].file)), 'the picture as sent');
  const p = m.providers.tripo;
  assert.equal(p.status, 'done');
  assert.equal(p.failures.length, 1);
  assert.equal(p.failures[0].kind, 'bad-request');
  assert.match(p.error, /1 of 2 failed/);
  assert.deepEqual(readBatch(root, m.batch).candidates.map((x) => x.id), [c.id]);
  assert.equal(listBatches(root)[0].mode, '3d');
  await assert.rejects(runBatch({ root, batch: m.batch, providers: ['openai'], keys: {} }), /3D batch/);
  done(root);
});

test('a rigged candidate: rig check, rig and a preview walk, each task\'s credits counted; a rig that fails leaves the model', async () => {
  const root = fakeRepo();
  const f = fakeTripo({ rigType: 'hexapod' });
  const m = await run3dBatch({ root, images: ['references/enemy-archetypes/crab/side.jpg'], options: { rig: true }, keys: KEYS, fetch: f, ...fast });
  keySafe(f.calls);
  const c = m.candidates[0];
  assert.equal(c.rig.status, 'done');
  assert.equal(c.rig.rigType, 'hexapod');
  assert.equal(c.rig.rigModel, 'v2.5-20260210');
  assert.equal(c.rig.animation, 'preset:hexapod:walk');
  assert.equal(c.credits, 65);
  const rig = JSON.parse(f.calls.find((x) => x.url.endsWith('/animations/rig')).init.body);
  assert.deepEqual(rig, { input: c.tasks.model, model: 'v2.5-20260210', rig_type: 'hexapod', spec: 'tripo', out_format: 'glb' });
  const rt = JSON.parse(f.calls.find((x) => x.url.endsWith('/animations/retarget')).init.body);
  assert.equal(rt.input, c.tasks.rig);
  const dir = join(root, 'references/_candidates', m.batch);
  assert.ok(existsSync(join(dir, c.rig.file)) && existsSync(join(dir, c.rig.animated)));

  const g = fakeTripo({ script: (path) => (path === '/animations/rig' ? json({ code: 2018, message: 'Model too complex' }, 400) : null) });
  const m2 = await run3dBatch({ root, images: ['references/enemy-archetypes/crab/side.jpg'], options: { rig: true }, keys: KEYS, fetch: g, ...fast });
  assert.equal(m2.candidates.length, 1, 'the model stands');
  assert.equal(m2.candidates[0].rig.status, 'error');
  assert.match(m2.candidates[0].rig.error, /too complex/);
  const h = fakeTripo({ riggable: false });
  const m3 = await run3dBatch({ root, images: ['references/enemy-archetypes/crab/side.jpg'], options: { rig: true }, keys: KEYS, fetch: h, ...fast });
  assert.equal(m3.candidates[0].rig.status, 'not-riggable');
  assert.equal(h.calls.filter((x) => x.url.endsWith('/animations/rig')).length, 0);
  done(root);
});

test('3D failures: no key (nothing sent), a refused key, no credits, a bad request, a refused task, a timeout; the key redacted', async () => {
  const root = fakeRepo();
  const run = (fetch, extra = {}) => run3dBatch({ root, images: ['references/enemy-archetypes/crab/side.jpg'], keys: KEYS, fetch, ...fast, ...extra });
  const none = fakeTripo();
  const m0 = await run3dBatch({ root, images: ['references/enemy-archetypes/crab/side.jpg'], keys: {}, fetch: none, ...fast });
  assert.equal(m0.providers.tripo.kind, 'no-key');
  assert.match(m0.providers.tripo.error, /TRIPO_3D_API_KEY/);
  assert.equal(none.calls.length, 0);
  const kinds = [
    [(p) => (p === '/files' ? json({ code: 1000, message: `Invalid API Key Bearer ${KEY}` }, 401) : null), 'auth'],
    [(p) => (p === '/generation/image-to-model' ? json({ code: 2010, message: 'Insufficient credits', suggestion: 'top up' }, 403) : null), 'credits'],
    [(p) => (p === '/generation/image-to-model' ? json({ code: 2002, message: 'Unsupported request parameter' }, 400) : null), 'bad-request'],
    [(p) => (p === '/generation/image-to-model' ? ok({}) : null), 'server'],
    [(p) => (/^\/tasks\//.test(p ?? '') ? ok({ status: 'banned' }) : null), 'blocked'],
    [(p) => (/^\/tasks\//.test(p ?? '') ? ok({ status: 'failed', error_code: 2010, error_message: 'credits ran out' }) : null), 'credits'],
  ];
  for (const [script, kind] of kinds) {
    const m = await run(fakeTripo({ script }));
    assert.equal(m.providers.tripo.status, 'error', kind);
    assert.equal(m.providers.tripo.kind, kind, `${kind}: ${m.providers.tripo.error}`);
    assert.ok(!JSON.stringify(m).includes(KEY), 'the key never in candidates.json');
    if (kind === 'credits' && /HTTP 403/.test(m.providers.tripo.error)) assert.match(m.providers.tripo.error, /^out of Tripo credits: top up/, 'not "the key was refused"');
  }
  let t = 0;
  const slow = await run(fakeTripo({ script: (p) => (/^\/tasks\//.test(p ?? '') ? ok({ status: 'running', progress: 10 }) : null) }), { now: () => (t += 60000), timeout: 300000 });
  assert.equal(slow.providers.tripo.kind, 'timeout');
  done(root);
});

test('crops: x,y,w,h parsed and kept inside the picture; a cut view sent as PNG; views assigned front first', async (t) => {
  assert.deepEqual(parseCrop('800, 130,420,380'), { x: 800, y: 130, w: 420, h: 380 });
  assert.equal(parseCrop('-'), null);
  assert.equal(parseCrop(''), null);
  assert.throws(() => parseCrop('1,2,3'), /x,y,w,h/);
  assert.throws(() => parseCrop('0,0,2,2'), /at least 8/);
  assert.deepEqual(clampCrop({ x: 1400, y: 800, w: 400, h: 400 }, 1536, 864), { x: 1400, y: 800, w: 136, h: 64 });
  assert.deepEqual(assignViews(3, [null, 'back']), ['front', 'back', 'left']);
  assert.deepEqual(assignViews(2), ['front', 'left']);
  assert.equal(default3dTarget('references/characters/hero/sheet.png'), 'references/characters/hero/3d/');
  assert.equal(default3dTarget('elsewhere/a.png'), null);
  const same = await prepareView(JPEG, 'image/jpeg', null);
  assert.equal(same.bytes, JPEG, 'a JPEG without a crop goes as it is');
  if (!sharp) return t.skip('no sharp here');
  const sheet = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#f7ecd2' } }).jpeg().toBuffer();
  const v = await prepareView(sheet, 'image/jpeg', { x: 100, y: 0, w: 100, h: 200 });
  assert.equal(v.mime, 'image/png');
  assert.deepEqual([v.width, v.height], [100, 200]);
  const meta = await sharp(v.bytes).metadata();
  assert.deepEqual([meta.width, meta.height, meta.format], [100, 200, 'png']);
  const root = fakeRepo();
  writeFileSync(join(root, 'references/enemy-archetypes/crab/sheet-big.jpg'), sheet);
  const f = fakeTripo();
  const m = await run3dBatch({ root, images: ['references/enemy-archetypes/crab/sheet-big.jpg', 'references/enemy-archetypes/crab/sheet-big.jpg'], crops: ['0,0,100,200', '100,0,100,200'], views: ['front', 'left'], keys: KEYS, fetch: f, ...fast });
  assert.equal(m.kind, 'multiview');
  assert.deepEqual(m.inputs.map((i) => [i.view, i.crop.x]), [['front', 0], ['left', 100]]);
  const body = JSON.parse(f.calls.find((c) => c.url.endsWith('/generation/multiview-to-model')).init.body);
  assert.deepEqual(body.inputs, [{ front: 'file_1' }, { left: 'file_2' }]);
  assert.equal(f.calls.filter((c) => c.url.endsWith('/files')).map((c) => c.init.body.get('file').type).join(), 'image/png,image/png');
  await assert.rejects(prepare3dBatch({ root, images: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'] }), /at most 4/);
  await assert.rejects(prepare3dBatch({ root, images: [] }), /pictures .* or a prompt/);
  await assert.rejects(prepare3dBatch({ root, images: ['../x.jpg'] }), /outside the repository/);
  done(root);
});

test('a 3D pick: the GLB, its turntable and its rig into references/…/3d/ as model-N, the record in manifest.json; discard and none of them', async () => {
  const root = fakeRepo();
  const m = await run3dBatch({ root, images: ['references/enemy-archetypes/crab/side.jpg'], options: { rig: true }, n: 2, keys: KEYS, fetch: fakeTripo({ rigType: 'biped' }), ...fast });
  assert.throws(() => pick({ root, batch: m.batch, candidate: 'tripo/1' }), /3D batch/);
  const turntable = `data:image/webp;base64,${Buffer.from('RIFF0000WEBPVP8 ').toString('base64')}`;
  const r = pickAny({ root, batch: m.batch, candidate: 'tripo/1', why: 'the legs read', preview: turntable, now: () => Date.parse('2026-10-10T10:00:00Z') });
  assert.equal(r.file, 'references/enemy-archetypes/crab/3d/model-1.glb');
  const dir = join(root, 'references/enemy-archetypes/crab/3d');
  for (const f of ['model-1.glb', 'model-1-preview.webp', 'model-1-rigged.glb', 'model-1-walk.glb']) assert.ok(existsSync(join(dir, f)), f);
  const mf = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  assert.equal(mf.archetype, 'crab');
  const e = mf.models[0];
  assert.equal(e.service, 'Reference lab 3D');
  assert.equal(e.model, 'v3.1-20260211');
  assert.deepEqual(e.inputs, [{ path: 'references/enemy-archetypes/crab/side.jpg', view: 'front' }]);
  assert.equal(e.options.rig, true);
  assert.equal(e.tasks.model, readBatch(root, m.batch).candidates[0].tasks.model);
  assert.equal(e.rig.rigType, 'biped');
  assert.equal(e.rig.animation, 'preset:biped:walk');
  assert.equal(e.why, 'the legs read');
  assert.equal(e.credits, 65);
  assert.equal(e.date, '2026-10-10');
  assert.ok(!JSON.stringify(mf).includes(KEY));
  assert.equal(readBatch(root, m.batch).candidates[0].pickedAs, r.file);
  const again = pick3d({ root, batch: m.batch, candidate: 'tripo/1', why: 'still' });
  assert.equal(again.again, true);
  const two = pick3d({ root, batch: m.batch, candidate: 'tripo/2' });
  assert.equal(two.file, 'references/enemy-archetypes/crab/3d/model-2.glb');
  assert.ok(existsSync(join(dir, 'model-2-preview.png')), 'Tripo\'s render when the page sends no turntable');
  assert.equal(nextModel(dir), 3);
  assert.throws(() => previewFromDataUrl('data:text/html;base64,AAAA'), /data URL/);
  // discard: the model, its preview and its rig files go
  const m2 = await run3dBatch({ root, images: ['references/enemy-archetypes/crab/side.jpg'], options: { rig: true }, keys: KEYS, fetch: fakeTripo(), ...fast });
  const c = m2.candidates[0], bdir = join(root, 'references/_candidates', m2.batch);
  discard({ root, batch: m2.batch, candidate: c.id });
  for (const f of [c.file, c.preview, c.rig.file, c.rig.animated]) assert.ok(!existsSync(join(bdir, f)), f);
  reject({ root, batch: m2.batch, why: 'a lump, not a crab' });
  const mf2 = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  assert.equal(mf2.rejected[0].mode, '3d');
  assert.deepEqual(mf2.rejected[0].inputs, ['references/enemy-archetypes/crab/side.jpg']);
  assert.equal(filterBatches(listBatches(root), 'rejected').length, 1);
  done(root);
});

// ------------------------------------------------------------------ the CLI and the dev server
test('the CLI: --3d with pictures, crops and options; text to model; --pick of a 3D candidate', async () => {
  const o = parseArgs(['--3d', '--images', 'a.jpg,b.jpg', '--crop', '1,2,30,40', '--crop', '-', '--views', 'front,left', '--rig', '--quad', '--no-texture', '--faces', '20000', '--model', 'v3.0-20250812', '--n', '2']);
  assert.deepEqual([o['3d'], o.images, o.crops, o.views, o.rig, o.quad, o['no-texture'], o.faces, o.model3d, o.n], [true, ['a.jpg', 'b.jpg'], ['1,2,30,40', '-'], ['front', 'left'], true, true, true, 20000, 'v3.0-20250812', 2]);
  assert.deepEqual(parseArgs(['--model', 'gemini=x']).models, { gemini: 'x' });
  const root = fakeRepo();
  const out = [];
  const f = fakeTripo();
  const code = await main(['--3d', '--images', 'references/enemy-archetypes/crab/side.jpg', '--faces', '8000'], { root, keys: KEYS, fetch: f, log: (s) => out.push(s) });
  assert.equal(code, 0, out.join('\n'));
  assert.equal(JSON.parse(f.calls.find((c) => c.url.endsWith('/generation/image-to-model')).init.body).face_limit, 8000);
  assert.ok(!out.join('\n').includes(KEY));
  assert.match(out.join('\n'), /✓ tripo 1 model/);
  const batch = listBatches(root)[0].batch;
  out.length = 0;
  assert.equal(await main(['--pick', `${batch}/tripo/1`, '--why', 'clean'], { root, keys: KEYS, log: (s) => out.push(s) }), 0);
  assert.match(out[0], /references\/enemy-archetypes\/crab\/3d\/model-1\.glb/);
  const g = fakeTripo();
  assert.equal(await main(['--3d', '--prompt', 'a lamp on three legs', '--target', 'references/enemy-archetypes/tripod/3d/'], { root, keys: KEYS, fetch: g, log: () => {} }), 0);
  assert.equal(JSON.parse(g.calls.find((c) => c.url.endsWith('/generation/text-to-model')).init.body).prompt, 'a lamp on three legs');
  assert.equal(g.calls.filter((c) => c.url.endsWith('/files')).length, 0);
  done(root);
});

/** A request / response pair for the middleware. */
function call(mw, method, url, body) {
  return new Promise((resolve) => {
    const chunks = body ? [Buffer.from(JSON.stringify(body))] : [];
    const req = { method, url, headers: { host: 'localhost:5365' }, socket: { remoteAddress: '127.0.0.1' }, on(ev, fn) { if (ev === 'data') chunks.forEach(fn); if (ev === 'end') setTimeout(fn, 0); return this; }, destroy() {} };
    const head = {};
    const res = { statusCode: 200, setHeader(k, v) { head[k.toLowerCase()] = v; }, end(data) { resolve({ status: this.statusCode, head, data, json: () => JSON.parse(String(data)) }); } };
    mw(req, res, () => resolve({ status: 404, next: true }));
  });
}

test('the dev server: Tripo\'s availability without the key, generate3d then poll, the GLB served, the balance', async () => {
  const root = fakeRepo();
  const f = fakeTripo();
  const mw = referenceLabMiddleware({ root, fetch: f, keys: () => KEYS });
  const prov = await call(mw, 'GET', '/__reference-lab/providers');
  assert.equal(prov.json().tripo.available, true);
  assert.deepEqual(prov.json().tripo.views, ['front', 'left', 'back', 'right']);
  assert.ok(!String(prov.data).includes(KEY));
  const bad = await call(mw, 'POST', '/__reference-lab/generate3d', { images: [] });
  assert.equal(bad.status, 400);
  const go = await call(mw, 'POST', '/__reference-lab/generate3d', { images: ['references/enemy-archetypes/crab/side.jpg'], options: { textureQuality: 'detailed' } });
  assert.equal(go.status, 202);
  assert.equal(go.json().estimateUSD, 0.4);
  const { batch } = go.json();
  let m;
  for (let i = 0; i < 200; i++) {
    m = (await call(mw, 'GET', `/__reference-lab/batches/${batch}`)).json();
    if (m.status === 'done') break;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal(m.status, 'done', JSON.stringify(m.providers));
  const glb = await call(mw, 'GET', `/__reference-lab/file/${batch}/tripo/1.glb`);
  assert.equal(glb.status, 200);
  assert.equal(glb.head['content-type'], 'model/gltf-binary');
  assert.equal((await call(mw, 'GET', `/__reference-lab/file/${batch}/${encodeURIComponent(m.inputs[0].file)}`)).status, 200);
  assert.equal((await call(mw, 'GET', `/__reference-lab/file/${batch}/tripo/..%2F..%2Fx.glb`)).status, 404);
  const bal = await call(mw, 'GET', '/__reference-lab/tripo/balance');
  assert.deepEqual(bal.json(), { available: true, balance: 1234.5, frozen: 30 });
  const picked = await call(mw, 'POST', '/__reference-lab/pick', { batch, candidate: 'tripo/1', why: 'ok', preview: `data:image/png;base64,${PNG1.toString('base64')}` });
  assert.equal(picked.status, 200, String(picked.data));
  assert.ok(existsSync(join(root, 'references/enemy-archetypes/crab/3d/model-1-preview.png')));
  keySafe(f.calls);
  done(root);
});

// ------------------------------------------------------------------ the page
test('the page\'s drawing of a 3D batch: the inputs above, a viewer per model with its controls, Pick / Discard, rig state, cost', () => {
  const m = {
    batch: 'b3', mode: '3d', kind: 'multiview', status: 'done', created: '', prompt: null, refs: ['references/a/s.jpg'], n: 1, target: 'references/a/3d/',
    options: tripoOptions({ rig: true }), estimateUSD: 0.65,
    inputs: [{ path: 'references/a/s.jpg', view: 'front', crop: { x: 1, y: 2, w: 30, h: 40 }, file: 'inputs/1-front.png' }, { path: 'references/a/s.jpg', view: 'left', crop: null, file: 'inputs/2-left.jpg' }],
    providers: { tripo: { status: 'done', label: 'Tripo 3D', model: 'v3.1-20260211', ms: 90000, count: 1, credits: 65, costUSD: 0.65 } },
    candidates: [{ id: 'tripo/1', provider: 'tripo', label: 'Tripo 3D', file: 'tripo/1.glb', format: 'glb', preview: 'tripo/1-preview.webp', ms: 90000, credits: 65, costUSD: 0.65, bytes: 4_200_000, status: 'new', rig: { status: 'done', rigType: 'hexapod', file: 'tripo/1-rigged.glb', animated: 'tripo/1-animated.glb', animation: 'preset:hexapod:walk' } }],
  };
  const html = batchHtml(m);
  assert.equal(html, batch3dHtml(m), 'batchHtml hands a 3D batch to batch3dHtml');
  assert.match(html, /\/__reference-lab\/file\/b3\/inputs\/1-front\.png/);
  assert.match(html, /front<\/b> · s\.jpg · crop 1,2 30×40/);
  assert.match(html, /data-model="\/__reference-lab\/file\/b3\/tripo\/1\.glb"/);
  assert.match(html, /data-anim="\/__reference-lab\/file\/b3\/tripo\/1-animated\.glb"/);
  assert.match(html, /data-still="\/__reference-lab\/file\/b3\/tripo\/1-preview\.webp"/);
  assert.match(html, /data-view-act="wire"/);
  assert.match(html, /data-view-act="spin"/);
  assert.match(html, /data-pick="tripo\/1"/);
  assert.match(html, /data-discard="tripo\/1"/);
  assert.match(html, /hexapod/);
  assert.match(html, /\$0\.65/);
  assert.match(html, /4\.2 MB/);
  assert.match(html, /data-reject/);
  const running = batch3dHtml({ ...m, status: 'running', candidates: [], providers: { tripo: { status: 'running', label: 'Tripo 3D', model: 'v3.1-20260211', stages: { 1: 'model 40%' } } } });
  assert.match(running, /#1 model 40%/);
  assert.doesNotMatch(running, /data-reject/);
});

// The reference lab's Pick mode (docs/systems/reference-lab.md#pick-mode), against a stub candidates folder: the
// queue in the prompt documents' order (a world's sheets together), a pick moving on to the next batch, skip and
// back, a pick changed (the first sheet taken back), none of them, the progress count; the drawing and the layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tempDir } from '../scripts/temp-dirs.mjs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANDIDATES_DIR, listBatches, pick, readBatch, reject, unpick } from '../scripts/reference-lab/batch.mjs';
import { listPrompts, parsePromptDoc } from '../scripts/reference-lab/prompts.mjs';
import { referenceLabMiddleware } from '../scripts/reference-lab/server.mjs';
import { PickSession, REJECT_WHY, bestColumns, buildPickQueue, nextOpen, pickBaseHtml, pickGridHtml, pickHeadHtml, pickProgress, progressText, worldOf } from '../src/reference-lab/pickmode.js';

const WORLDS = `# Level explorations: reference prompts

## Vael

### Direction A: Where the stones fall up (\`falling-up\`)

Target folder: \`references/levels/Vael/environment/explorations/falling-up/\`

#### 1. The edge that rises (\`va-falling-up-establishing\`)

**Main: the plain's edge breaking into stones that float up.**

\`\`\`
The edge of a plain, stones rising --ar 16:9
\`\`\`

#### 2. The stone that carries you (\`va-falling-up-ground\`)

**Main: standing on a rising slab.**

\`\`\`
On a floating slab --ar 16:9
\`\`\`

## Lorn

### Direction A: The roots of the crystal (\`crystal-roots\`)

Target folder: \`references/levels/Lorn/environment/explorations/crystal-roots/\`

#### 3. The veins under the swamp (\`lo-crystal-roots-establishing\`)

**Main: glowing veins under dark water.**

\`\`\`
Crystal veins under water --ar 16:9
\`\`\`
`;
const FLORA = `# Flora and fauna, world by world: reference prompts

Target folder: \`references/levels/<id>/environment/flora-fauna/\`

### 1. Lorn (\`Lorn\`)

**Main: the swamp's plants and creatures.**

\`\`\`
Lorn's flora --ar 3:2
\`\`\`
`;

const sha = (b) => createHash('sha256').update(b).digest('hex');
const pic = (n) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, n, n, n, 0xff, 0xd9]);

/** A stub repository: two prompt documents and a stub candidates folder (never the real one). */
function stubRepo() {
  const base = process.env.PICKMODE_TMP ?? tmpdir();
  mkdirSync(base, { recursive: true });
  const root = tempDir('pickmode-', base);
  mkdirSync(join(root, 'docs/design'), { recursive: true });
  mkdirSync(join(root, 'references'), { recursive: true });
  writeFileSync(join(root, 'docs/design/level-explorations-prompts.md'), WORLDS);
  writeFileSync(join(root, 'docs/design/flora-fauna-prompts.md'), FLORA);
  let k = 0;
  const batch = (id, { from = null, target, created, status = 'done', mode, picked = false, rejected = null, providers = ['gemini', 'openai'] }) => {
    const dir = join(root, CANDIDATES_DIR, id);
    const candidates = [];
    for (const p of providers) {
      mkdirSync(join(dir, p), { recursive: true });
      const bytes = pic(++k);
      writeFileSync(join(dir, p, '1.jpg'), bytes);
      candidates.push({ id: `${p}/1`, provider: p, label: p, model: `${p}-m`, file: `${p}/1.jpg`, mime: 'image/jpeg', bytes: bytes.length, sha256: sha(bytes), ms: 1000, costUSD: 0.04, status: picked && p === providers[0] ? 'picked' : 'new' });
    }
    writeFileSync(join(dir, 'candidates.json'), JSON.stringify({ batch: id, ...(mode ? { mode } : {}), date: created.slice(0, 10), created, prompt: `the prompt of ${id}. More words.`, from, refs: [], ar: '16:9', n: 1, target, comparison: null, status,
      providers: Object.fromEntries(providers.map((p) => [p, { status: 'done', label: p, model: `${p}-m`, count: 1 }])), candidates, ...(rejected ? { rejected } : {}) }));
  };
  const L = 'docs/design/level-explorations-prompts.md', F = 'docs/design/flora-fauna-prompts.md';
  // made in another order than the documents', on purpose
  batch('2026-10-11-10-00-00-aaaa', { from: `${L}#va-falling-up-ground`, target: 'references/levels/Vael/environment/explorations/falling-up/', created: '2026-10-11T10:00:00Z' });
  batch('2026-10-11-10-01-00-bbbb', { from: `${L}#lo-crystal-roots-establishing`, target: 'references/levels/Lorn/environment/explorations/crystal-roots/', created: '2026-10-11T10:01:00Z' });
  batch('2026-10-11-10-02-00-cccc', { from: `${L}#va-falling-up-establishing`, target: 'references/levels/Vael/environment/explorations/falling-up/', created: '2026-10-11T10:02:00Z' });
  batch('2026-10-11-10-03-00-dddd', { from: null, target: 'references/levels/Vael/environment/loose/', created: '2026-10-11T10:03:00Z' });
  batch('2026-10-11-10-04-00-eeee', { from: `${F}#Lorn`, target: 'references/levels/Lorn/environment/flora-fauna/', created: '2026-10-11T10:04:00Z', providers: ['gemini', 'openai', 'fal-flux'] });
  // not in the queue: picked, turned down, still running, 3D
  batch('2026-10-11-10-05-00-ffff', { from: `${L}#va-falling-up-ground`, target: 'references/levels/Vael/environment/explorations/falling-up/', created: '2026-10-11T10:05:00Z', picked: true });
  batch('2026-10-11-10-06-00-gggg', { from: `${L}#va-falling-up-ground`, target: 'references/levels/Vael/environment/explorations/falling-up/', created: '2026-10-11T10:06:00Z', rejected: { why: 'flat', date: '2026-10-11' } });
  batch('2026-10-11-10-07-00-hhhh', { from: `${L}#va-falling-up-ground`, target: 'references/levels/Vael/environment/explorations/falling-up/', created: '2026-10-11T10:07:00Z', status: 'running' });
  batch('2026-10-11-10-08-00-iiii', { from: null, target: 'references/levels/Vael/environment/3d/', created: '2026-10-11T10:08:00Z', mode: '3d', providers: ['tripo'] });
  return root;
}
const libApi = (root) => ({
  pick: async (o) => pick({ root, ...o }),
  unpick: async (o) => unpick({ root, ...o }),
  reject: async (o) => reject({ root, ...o }),
});

test('prompt documents: each entry knows its section (the world) and its group (the direction)', () => {
  const e = parsePromptDoc(WORLDS);
  assert.deepEqual(e.map((x) => [x.id, x.section, x.group?.id]), [
    ['va-falling-up-establishing', 'Vael', 'falling-up'], ['va-falling-up-ground', 'Vael', 'falling-up'], ['lo-crystal-roots-establishing', 'Lorn', 'crystal-roots']]);
  assert.equal(e[0].title, 'The edge that rises');
  const root = stubRepo();
  assert.equal(listPrompts(root).docs.find((d) => d.doc.endsWith('level-explorations-prompts.md')).title, 'Level explorations');
  rmSync(root, { recursive: true, force: true });
});

test('Pick mode\'s queue: only what is still to pick, in the documents\' order, a world\'s batches together', () => {
  const root = stubRepo();
  const q = buildPickQueue(listBatches(root), listPrompts(root));
  assert.deepEqual(q.map((x) => x.batch.slice(-4)), ['eeee', 'bbbb', 'cccc', 'aaaa', 'dddd'],
    'Lorn first (the flora document, first in order, starts with it), its explorations after; then Vael by the document; a batch from no document last in its world');
  assert.deepEqual(q.map((x) => x.world), ['Lorn', 'Lorn', 'Vael', 'Vael', 'Vael']);
  assert.equal(q[2].title, 'Vael · falling-up · The edge that rises');
  assert.equal(q[2].line, 'Main: the plain\'s edge breaking into stones that float up');
  assert.equal(q[2].id, 'va-falling-up-establishing');
  assert.equal(q[4].line, 'the prompt of 2026-10-11-10-03-00-dddd.', 'no document: the prompt\'s first sentence');
  assert.equal(worldOf('references/enemy-archetypes/crab/', { docTitle: 'Enemy roster' }), 'Enemy roster', 'an object: its document');
  assert.equal(progressText(pickProgress(q)), '5 of 5 to pick');
  rmSync(root, { recursive: true, force: true });
});

test('Pick mode: a pick moves on at once; skip, back, a pick changed, none of them, the progress', async () => {
  const root = stubRepo();
  const s = new PickSession(buildPickQueue(listBatches(root), listPrompts(root)), libApi(root));
  const id = () => s.current?.batch.slice(-4) ?? null;
  assert.equal(id(), 'eeee');

  const r = await s.pick('gemini/1', 'the clearest');
  assert.equal(r.file, 'references/levels/Lorn/environment/flora-fauna/sheet-1.jpg');
  assert.ok(existsSync(join(root, r.file)), 'the same pick as the Pick button: copied into references/');
  assert.equal(readBatch(root, '2026-10-11-10-04-00-eeee').candidates.find((c) => c.id === 'gemini/1').status, 'picked', 'candidates.json updated');
  assert.equal(JSON.parse(readFileSync(join(root, 'references/levels/Lorn/environment/flora-fauna/manifest.json'), 'utf8')).sheets[0].why, 'the clearest');
  assert.equal(id(), 'bbbb', 'on to the next batch at once');
  assert.equal(s.progress().left, 4);

  s.skip();
  assert.equal(id(), 'cccc');
  assert.equal(s.queue[1].state, 'skipped');
  assert.equal(s.progress().left, 4, 'a skip decides nothing');

  s.back(); assert.equal(id(), 'bbbb', 'back: the one shown before');
  s.back(); assert.equal(id(), 'eeee', 'back again: the picked one, to change it');
  await s.pick('fal-flux/1');
  const lorn = readBatch(root, '2026-10-11-10-04-00-eeee').candidates;
  assert.deepEqual(Object.fromEntries(lorn.map((c) => [c.id, c.status])), { 'gemini/1': 'new', 'openai/1': 'new', 'fal-flux/1': 'picked' });
  const mf = JSON.parse(readFileSync(join(root, 'references/levels/Lorn/environment/flora-fauna/manifest.json'), 'utf8'));
  assert.deepEqual(mf.sheets.map((x) => [x.file, x.candidate]), [['sheet-1.jpg', 'fal-flux/1']], 'the first pick taken back (its sheet and entry), the new one in its place');
  assert.equal(s.progress().left, 4, 'a pick changed is still one pick');
  assert.equal(id(), 'cccc', 'open batches first: the skipped one waits for the end');

  await s.reject('');
  assert.equal(readBatch(root, '2026-10-11-10-02-00-cccc').rejected.why, REJECT_WHY, 'none of them, with the default reason');
  assert.equal(JSON.parse(readFileSync(join(root, 'references/levels/Vael/environment/explorations/falling-up/manifest.json'), 'utf8')).rejected[0].why, REJECT_WHY);
  assert.equal(id(), 'aaaa');
  await s.pick('openai/1');
  assert.equal(id(), 'dddd');
  await s.pick('gemini/1');
  assert.equal(id(), 'bbbb', 'the skipped one comes back at the end');
  assert.equal(progressText(s.progress()), '1 of 5 to pick · 3 picked, 1 none of them');
  await s.pick('openai/1');
  assert.equal(s.current, null, 'everything decided');
  assert.equal(nextOpen(s.queue, 0), -1);
  assert.equal(progressText(s.progress()), 'all 5 done · 4 picked, 1 none of them');
  s.back();
  assert.equal(id(), 'bbbb', 'back from the end: the last one shown');

  // a pick on a batch turned down here: the "none of them" is taken back first
  s.back(); s.back(); s.back();
  assert.equal(id(), 'cccc');
  await s.pick('gemini/1');
  assert.equal(readBatch(root, '2026-10-11-10-02-00-cccc').rejected, undefined);
  assert.equal(s.progress().rejected, 0);
  rmSync(root, { recursive: true, force: true });
});

test('unpick: through the dev server; a sheet changed since stays, a manifest the pick made goes', async () => {
  const root = stubRepo();
  const mw = referenceLabMiddleware({ root, keys: () => ({}) });
  const post = (path, body) => new Promise((resolve) => {
    const chunks = [Buffer.from(JSON.stringify(body))];
    const req = { method: 'POST', url: `/__reference-lab/${path}`, headers: { host: 'localhost:5999' }, socket: { remoteAddress: '127.0.0.1' },
      on(ev, f) { if (ev === 'data') chunks.forEach((c) => f(c)); if (ev === 'end') setTimeout(f, 0); } };
    const res = { statusCode: 0, setHeader() {}, end(s) { resolve({ status: this.statusCode, body: JSON.parse(s) }); } };
    mw(req, res, () => resolve({ status: 'next' }));
  });
  const b = '2026-10-11-10-03-00-dddd';
  const p = await post('pick', { batch: b, candidate: 'gemini/1' });
  assert.equal(p.body.file, 'references/levels/Vael/environment/loose/sheet-1.jpg');
  const u = await post('unpick', { batch: b, candidate: 'gemini/1' });
  assert.equal(u.status, 200);
  assert.equal(u.body.removed, 'references/levels/Vael/environment/loose/sheet-1.jpg');
  assert.ok(!existsSync(join(root, 'references/levels/Vael/environment/loose/sheet-1.jpg')));
  assert.ok(!existsSync(join(root, 'references/levels/Vael/environment/loose/manifest.json')), 'a manifest only that pick made goes with it');
  assert.equal(readBatch(root, b).candidates[0].status, 'new');
  await post('pick', { batch: b, candidate: 'openai/1' });
  writeFileSync(join(root, 'references/levels/Vael/environment/loose/sheet-1.jpg'), 'edited by hand');
  assert.equal((await post('unpick', { batch: b, candidate: 'openai/1' })).body.removed, null, 'a sheet changed since is never deleted');
  assert.ok(existsSync(join(root, 'references/levels/Vael/environment/loose/sheet-1.jpg')));
  rmSync(root, { recursive: true, force: true });
});

test('Pick mode\'s drawing: numbered candidates with a zoom corner, the header, the largest layout', () => {
  const m = { batch: 'b1', ar: '16:9', providers: { gemini: { label: 'Gemini' } }, candidates: [
    { id: 'gemini/1', provider: 'gemini', file: 'gemini/1.png', status: 'new' }, { id: 'gemini/2', provider: 'gemini', file: 'gemini/2.png', status: 'discarded' }, { id: 'openai/1', provider: 'openai', file: 'openai/1.jpg', status: 'new' }] };
  const h = pickGridHtml(m, 'openai/1');
  assert.equal((h.match(/data-pm-cand=/g) ?? []).length, 2, 'a discarded one is not offered');
  assert.match(h, /<span class="pm-num">2<\/span>/);
  assert.match(h, /data-pm-zoom="openai\/1"/);
  assert.match(h, /class="pm-cand on" data-pm-cand="openai\/1"/, 'the pick made here shows');
  const head = pickHeadHtml({ world: 'Vael', title: 'Vael · falling-up · The edge', id: 'va-x', line: 'Main: rising', target: 'references/levels/Vael/environment/x/', prompt: 'p', state: 'open' });
  for (const t of ['Vael', 'falling-up', 'Main: rising', 'references/levels/Vael/environment/x/']) assert.ok(head.includes(t), t);
  // the base: every picture the batch was made from, a thumbnail each (a click enlarges it), named by folder and file
  const it = { world: 'Temple guardians', title: 'The Elder', id: 'elder', line: 'From the reference', target: 'references/guardians/elder/turnaround/', prompt: 'p', state: 'open' };
  const based = pickHeadHtml(it, { refs: ['references/guardians/elder/reference-v1-4.png', 'references/guardians/elder/sheet-1.jpg'], comparison: 'references/guardians/elder/reference-v1-4.png' });
  assert.match(based, /class="pm-base"[^>]*>.*Base</s);
  assert.equal((based.match(/data-pm-base="/g) ?? []).length, 2, 'both bases shown');
  assert.match(based, /data-pm-base="1"[^>]*>.*src="\/__references\/thumb\?p=references%2Fguardians%2Felder%2Fsheet-1\.jpg" data-full="\/references\/guardians\/elder\/sheet-1\.jpg"/s, 'a thumbnail in the strip (R or a click shows the full picture)');
  assert.match(based, /<small>elder\/reference-v1-4\.png<\/small>/);
  assert.equal(pickBaseHtml({ refs: [], comparison: 'references/guardians/elder/sheet-2.jpg' }).includes('data-pm-base'), false, 'text alone: no base, only what it is compared with');
  assert.match(pickBaseHtml({ refs: [], comparison: 'references/guardians/elder/sheet-2.jpg' }), /compared with/);
  assert.equal(pickBaseHtml({ refs: [] }), '');
  assert.equal(pickBaseHtml(null), '');
  assert.equal(bestColumns(2, '16:9', 1600, 800), 2, 'two wide pictures side by side');
  assert.equal(bestColumns(4, '16:9', 1600, 800), 2, 'four: two by two');
  assert.equal(bestColumns(3, '2:3', 1600, 800), 3, 'tall ones in a row');
  assert.equal(bestColumns(1, '1:1', 1600, 800), 1);
});

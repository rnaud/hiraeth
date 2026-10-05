#!/usr/bin/env node
// Download the CMU takes listed in scripts/mocap/cmu-takes.json (and each subject's skeleton)
// from the official site into data/mocap/raw/cmu/ (git-ignored). Idempotent: files already
// there are kept. One file at a time with a pause between them: the site asks not to be crawled
// (http://mocap.cs.cmu.edu/faqs.php), and this is a short, fixed list.
//
//   node scripts/mocap/fetch-cmu.mjs            # everything in the list
//   node scripts/mocap/fetch-cmu.mjs mm npc     # only those uses
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const RAW = resolve(ROOT, 'data/mocap/raw/cmu');
const BASE = 'http://mocap.cs.cmu.edu/subjects';

const list = JSON.parse(await readFile(resolve(HERE, 'cmu-takes.json'), 'utf8'));
const want = process.argv.slice(2);
const takes = list.takes.filter(([, use]) => !want.length || want.includes(use));
const subjects = [...new Set(takes.map(([id]) => id.split('_')[0]))];
await mkdir(RAW, { recursive: true });

const exists = async (p) => { try { return (await stat(p)).size > 0; } catch { return false; } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let fetched = 0, kept = 0, bytes = 0;
async function get(url, file) {
  if (await exists(file)) { kept++; return; }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(file, buf);
      fetched++; bytes += buf.length;
      await pause(250);
      return;
    } catch (e) {
      console.warn(`  ${url}: ${e.message}${attempt < 2 ? ', retrying' : ''}`);
      await pause(2000 * (attempt + 1));
    }
  }
  throw new Error(`could not download ${url}`);
}

for (const s of subjects) await get(`${BASE}/${s}/${s}.asf`, resolve(RAW, `${s}.asf`));
for (const [id] of takes) {
  const s = id.split('_')[0];
  await get(`${BASE}/${s}/${id}.amc`, resolve(RAW, `${id}.amc`));
}
console.log(`CMU: ${subjects.length} skeletons, ${takes.length} takes in ${RAW} (${fetched} downloaded, ${(bytes / 1e6).toFixed(1)} MB; ${kept} already there)`);

// A picture of the trial page (arena.html) as a reviewer sees it, muted, with its report: a check that the page loads,
// every variant builds and the review mute holds.
//   PORT=5488 CDP=5489 node references/enemy-redesign-2026-10-30/trials/page-shot.mjs <out.png> [query, e.g. foe=crab&variant=side&mode=attack] [seconds]
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const [OUT, Q = 'foe=crab&variant=side', SECS = '3'] = process.argv.slice(2);
if (process.env.PORT === '5173') throw new Error('never 5173');
const { serve, chrome } = await import(pathToFileURL(join(ROOT, 'scripts/changelog-shots.mjs')).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serve(ROOT);
const c = await chrome();
try {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await c.send('Page.navigate', { url: `http://127.0.0.1:${process.env.PORT}/references/enemy-redesign-2026-10-30/trials/arena.html?${Q}` });
  let ok = false;
  for (let i = 0; i < 480 && !ok; i++) { try { ok = await c.ev('!!window.__enemyTrial'); } catch { /* loading */ } if (!ok) await sleep(250); }
  if (!ok) throw new Error('the trial page did not come up: ' + JSON.stringify(c.errors.slice(0, 5)));
  await sleep(Number(SECS) * 1000);
  const report = await c.ev('window.__enemyTrial.report()');
  if (process.env.EVAL) console.log('eval', JSON.stringify(await c.ev(process.env.EVAL)));   // (a debugging look at the page)
  writeFileSync(OUT, Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  console.log(JSON.stringify({ report, errors: c.errors.slice(0, 5) }, null, 1));
} finally { await c.close(); await server.close(); }

// The gaze check of a trial foe (#800: every variant looks at the traveller, src/enemies/gaze.js): the trial page's row of
// three (current | direct | Tripo) idle, the traveller moved off to one side ahead of them; a picture once their heads
// have turned, and each body's gaze (its look's yaw) and the bearing to him.
//   PORT=5488 CDP=5489 node references/enemy-redesign-2026-10-30/trials/gaze-one.mjs <out.png> [foe] [cam] [variant: side (the row) | current | direct | tripo]
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const [OUT, FOE = 'brute', CAM = 'q', VARIANT = 'side'] = process.argv.slice(2);
if (process.env.PORT === '5173') throw new Error('never 5173');
const { serve, chrome } = await import(pathToFileURL(join(ROOT, 'scripts/changelog-shots.mjs')).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serve(ROOT);
const c = await chrome();
try {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await c.send('Page.navigate', { url: `http://127.0.0.1:${process.env.PORT}/references/enemy-redesign-2026-10-30/trials/arena.html?foe=${FOE}&variant=${VARIANT}&mode=idle&cam=${CAM}&ui=0` });
  let ok = false;
  for (let i = 0; i < 480 && !ok; i++) { try { ok = await c.ev('!!window.__enemyTrial'); } catch { /* loading */ } if (!ok) await sleep(250); }
  if (!ok) throw new Error('the trial page did not come up: ' + JSON.stringify(c.errors.slice(0, 5)));
  await sleep(2000);
  // (the traveller ahead of the row and off to its right as it faces him: their heads should swing that way)
  await c.ev(`(() => { const { THREE: T, player } = window; const at = ${VARIANT === 'side' ? 'new T.Vector3(-5.5, 0, 3.5)' : 'new T.Vector3(-2.6, 0, 0.8)'}; player.teleport(at, new T.Vector3(0, 1, 0), new T.Vector3(1, 0, -0.6).normalize()); return true; })()`);
  await sleep(3000);
  const report = await c.ev(`(() => { const p = window.player.pos; return { muted: window.sound.muted, master: window.sound.masterLevel(), pack: window.__enemyTrial.pack().map((f) => ({ variant: f.__variant, built: f.model.trial ?? 'current', gazeYaw: +(f.gaze?.yaw ?? 0).toFixed(2), watching: !!f.gaze?.watching, bearing: +(Math.atan2(p.x - f.pos.x, p.z - f.pos.z) - f.heading).toFixed(2) })) }; })()`);
  writeFileSync(OUT, Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  console.log(JSON.stringify({ report, errors: c.errors.slice(0, 5) }, null, 1));
} finally { await c.close(); await server.close(); }

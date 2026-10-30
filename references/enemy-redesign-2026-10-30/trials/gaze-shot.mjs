// Does each trial body look at the traveller (issue #508; the author's rule for every Tripo variant, #800)? The trial
// page in its row of three (current, direct, Tripo), idle and watching, the traveller to one side: a picture and each
// foe's eye/head yaw and pitch toward him (gaze.js), muted.
//   PORT=5471 CDP=5472 node references/enemy-redesign-2026-10-30/trials/gaze-shot.mjs <out.png> [foe] [cam]
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const [OUT, FOE = 'hound', CAM = 'front'] = process.argv.slice(2);
if (process.env.PORT === '5173') throw new Error('never 5173');
const { serve, chrome } = await import(pathToFileURL(join(ROOT, 'scripts/changelog-shots.mjs')).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serve(ROOT);
const c = await chrome();
try {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await c.send('Page.navigate', { url: `http://127.0.0.1:${process.env.PORT}/references/enemy-redesign-2026-10-30/trials/arena.html?foe=${FOE}&variant=side&mode=idle&cam=${CAM}&ui=0` });
  let ok = false;
  for (let i = 0; i < 480 && !ok; i++) { try { ok = await c.ev('!!window.__enemyTrial'); } catch { /* loading */ } if (!ok) await sleep(250); }
  if (!ok) throw new Error('the trial page did not come up: ' + JSON.stringify(c.errors.slice(0, 5)));
  await sleep(3000);
  // (the traveller to their right and ahead of them, in the picture: past the row's end, 2.4 m toward the camera)
  await c.ev(`(() => { const L = window.foes.list, T = window.THREE, m = new T.Vector3(); for (const f of L) m.add(f.pos); m.divideScalar(L.length);
    const h = L[0].heading, fwd = new T.Vector3(Math.sin(h), 0, Math.cos(h)), right = new T.Vector3(-fwd.z, 0, fwd.x);
    window.player.teleport(m.clone().addScaledVector(right, ${process.env.SIDE ?? -1} * 3.4).addScaledVector(fwd, 2.4), new T.Vector3(0, 1, 0), fwd.clone().negate()); return true; })()`);
  await sleep(2500);
  const mute = (await c.ev('window.__enemyTrial.report()')).mute ?? null;
  const looks = await c.ev(`window.foes.list.map((f) => { const E = f.model.gaze?.[0]; const d = new window.THREE.Vector3().subVectors(window.player.pos, f.pos);
    return { variant: f.__variant, watching: !!f.gaze?.watching, toHim: +Math.atan2(d.x, d.z).toFixed(2), heading: +f.heading.toFixed(2), yaw: E ? +E.yaw.toFixed(2) : null, pitch: E ? +E.pitch.toFixed(2) : null, eyes: E?.node?.name ?? null }; })`);
  writeFileSync(OUT, Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  console.log(JSON.stringify({ mute, looks, errors: c.errors.slice(0, 5) }, null, 1));
} finally { await c.close(); await server.close(); }

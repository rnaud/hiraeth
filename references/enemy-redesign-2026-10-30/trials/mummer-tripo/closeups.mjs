// #800 the Tripo mummer's fixes: close checks in the real Arena (High, 10:00, clear, muted), a variant a row
// (direct | tripo), the trial page in one variant at a time, the clip clock held and each frame posed by hand:
//   body   the whole body close, from the front, the left three-quarter and the back (the gourd's colours: one sage)
//   hands  the right mitten close with the club in it: idle, the whack's wind-up top, its strike (the grip), and the
//          left mitten from the front
//   clay   the front close with textures and colours off (what shade is left is the game's light)
//   PORT=5480 CDP=5481 node references/enemy-redesign-2026-10-30/trials/mummer-tripo/closeups.mjs <out-dir> [direct,tripo] [--tag before]
// Writes <out-dir>/mummer-close[-tag].webp (one sheet) and the frames' grip distances (the haft's axis to the mitten's
// centre, m) on stdout.
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const argv = process.argv.slice(2), ti = argv.indexOf('--tag'), TAG = ti >= 0 ? argv.splice(ti, 2)[1] : '';
const [OUT, LIST = 'direct,tripo'] = argv, VARIANTS = LIST.split(',');
if (!process.env.PORT || process.env.PORT === '5173') throw new Error('PORT in 5400–5499, never 5173');
const { serve, chrome } = await import(pathToFileURL(join(ROOT, 'scripts/changelog-shots.mjs')).href);
const sharp = createRequire(join(ROOT, 'package.json'))('sharp');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const label = (text, w) => Buffer.from(`<svg width="${w}" height="22"><rect width="${w}" height="22" fill="#f4ecd8" opacity="0.88"/><text x="6" y="16" font-family="Helvetica" font-size="13" fill="#3a2e22">${text}</text></svg>`);
const TW = 320, TH = 360;
const tile = async (buf, text) => sharp(await sharp(buf).extract({ left: 340, top: 0, width: 600, height: 675 }).resize(TW, TH).toBuffer()).composite([{ input: label(text, TW), top: 0, left: 0 }]).png().toBuffer();
// (each view: what to frame, the camera's yaw round the foe (0: in front), its distance, height over the target; the pose)
const VIEWS = [
  { name: 'front', at: 'body', yaw: 0, dist: 4.8, up: 0.15, mode: 'idle', t: 1.0 },
  { name: 'left 3q', at: 'body', yaw: 0.8, dist: 4.8, up: 0.3, mode: 'idle', t: 1.0 },
  { name: 'back', at: 'body', yaw: Math.PI, dist: 4.8, up: 0.15, mode: 'idle', t: 1.0 },
  { name: 'mask', at: 'head', yaw: 0.25, dist: 1.5, up: 0.05, mode: 'idle', t: 1.0 },
  { name: 'right mitten', at: 'hand0', yaw: -0.5, dist: 1.25, up: 0.15, mode: 'idle', t: 1.0 },
  { name: 'left mitten', at: 'hand1', yaw: 0.35, dist: 1.25, up: 0.15, mode: 'idle', t: 1.0 },
  { name: 'whack: wind', at: 'hand0', yaw: -1.0, dist: 1.8, up: 0.2, mode: 'attack', t: 0.7 },
  { name: 'whack: strike', at: 'hand0', yaw: -1.0, dist: 1.8, up: 0.2, mode: 'attack', t: 0.88 },
  { name: 'clay front', at: 'body', yaw: 0, dist: 4.8, up: 0.15, mode: 'idle', t: 1.0, clay: true },
];
const server = await serve(ROOT);
const c = await chrome();
const rows = [];
try {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  for (const v of VARIANTS) {
    await c.send('Page.navigate', { url: `http://127.0.0.1:${process.env.PORT}/references/enemy-redesign-2026-10-30/trials/arena.html?foe=mummer&variant=${v}&mode=idle&cam=front&ui=0` });
    let ok = false;
    for (let i = 0; i < 480 && !ok; i++) { try { ok = await c.ev('!!window.__enemyTrial && window.__enemyTrial.pack().length > 0'); } catch { /* loading */ } if (!ok) await sleep(250); }
    if (!ok) throw new Error('the trial page did not come up: ' + JSON.stringify(c.errors.slice(0, 5)));
    if (!(await c.ev('window.sound.muted && window.sound.masterLevel() === 0'))) throw new Error('not muted');
    await c.ev(`(() => { const T = window.THREE, tr = window.__enemyTrial;
      tr.pause(true); window.__closeEye = new T.Vector3(); window.__closeAt = new T.Vector3();
      const base = T.PerspectiveCamera.prototype.updateMatrixWorld, m4 = new T.Matrix4(), up = new T.Vector3(0, 1, 0);
      window.camera.updateMatrixWorld = function (force) { this.position.copy(window.__closeEye); this.quaternion.setFromRotationMatrix(m4.lookAt(window.__closeEye, window.__closeAt, up)); if (this.fov !== 30) { this.fov = 30; this.updateProjectionMatrix(); } return base.call(this, force); };
      const f = tr.pack()[0]; f.weapon = 'club'; })()`);
    const tiles = [];
    for (const w of VIEWS) {
      await c.ev(`window.__enemyTrial.set('t-mode', '${w.mode}'); window.__enemyTrial.set('t-attack', 'whack'); window.__enemyTrial.pause(false)`);
      // (posed at t: half a second of the clock run up to it in 60 Hz steps, then held; the club the spawn's weapon)
      await sleep(120);
      const info = await c.ev(`(() => { const T = window.THREE, tr = window.__enemyTrial, f = tr.pack()[0]; f.weapon = 'club';
        tr.setTime(${w.t} - 0.5); for (let i = 0; i < 30; i++) window.foes.update(1 / 60); tr.pause(true);
        const M = f.model; M.group.updateMatrixWorld(true);
        const what = ${JSON.stringify(w.at)};
        const at = what === 'body' ? f.pos.clone().add(new T.Vector3(0, 0.95, 0)) : what === 'head' ? M.group.getObjectByName('mask').getWorldPosition(new T.Vector3()) : M.joints.hands[${w.at === 'hand1' ? 1 : 0}].getWorldPosition(new T.Vector3());
        // (the traveller out of the frame: he stands to its left, where the clay's front camera would see him)
        if (window.player.object) window.player.object.visible = false;
        const yaw = f.heading + ${w.yaw};
        window.__closeAt.copy(at); window.__closeEye.copy(at).add(new T.Vector3(Math.sin(yaw) * ${w.dist}, ${w.up}, Math.cos(yaw) * ${w.dist}));
        // the grip (Tripo): the club's haft axis (its local y through its pivot) against the skinned mitten's centre (the
        // mean of the vertices on the right hand's bone, posed as drawn) and its half breadth
        let off = null, half = null;
        const sm = (() => { let s = null; M.group.traverse((o) => { if (o.isSkinnedMesh && o.name === 'tripo body') s = o; }); return s; })();
        if (sm) { sm.skeleton.update(); const b = sm.skeleton.bones.indexOf(M.joints.hands[0]), P = sm.geometry.attributes.position, SI = sm.geometry.attributes.skinIndex, SW = sm.geometry.attributes.skinWeight;
          const pts = []; for (let i = 0; i < P.count; i++) if (SI.getX(i) === b && SW.getX(i) > 0.9) pts.push(sm.applyBoneTransform(i, new T.Vector3().fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld));
          const hc = pts.reduce((s, p) => s.add(p), new T.Vector3()).divideScalar(pts.length);
          const club = M.group.getObjectByName('club'), o = club.getWorldPosition(new T.Vector3()), ax = new T.Vector3(0, 1, 0).applyQuaternion(club.getWorldQuaternion(new T.Quaternion()));
          const radial = (p) => { const d = p.clone().sub(o); return d.sub(ax.clone().multiplyScalar(d.dot(ax))); };
          off = +radial(hc).length().toFixed(3); half = +Math.max(...pts.map((p) => radial(p).length())).toFixed(3); }
        return { off, half, state: f.state, k: +f.k.toFixed(2) }; })()`);
      if (w.clay) await c.ev('window.__enemyTrial.toggleClay()');
      await sleep(w.clay ? 2000 : 250);
      const shot = Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64');
      if (w.clay) await c.ev('window.__enemyTrial.toggleClay()');
      tiles.push(await tile(shot, `${v}${TAG ? ` (${TAG})` : ''} · ${w.name}`));
      console.log(JSON.stringify({ variant: v, view: w.name, ...info }));
    }
    rows.push(tiles);
  }
  const W = TW * VIEWS.length, H = TH * rows.length;
  const comp = rows.flatMap((r, i) => r.map((b, j) => ({ input: b, left: j * TW, top: i * TH })));
  await sharp({ create: { width: W, height: H, channels: 3, background: '#f4ecd8' } }).composite(comp).webp({ quality: 86 }).toFile(join(OUT, `mummer-close${TAG ? `-${TAG}` : ''}.webp`));
  console.log('errors', JSON.stringify(c.errors.slice(0, 5)));
} finally { await c.close(); await server.close(); }

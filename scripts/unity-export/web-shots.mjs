// Screenshots of the web game from fixed viewpoints (views.mjs: the desert; views-worlds.mjs: every
// world, each view with its "world"), to compare with the Unity port's (unity-batch.sh Shots, or
// Play -tour): headless Chrome against a running dev server.
//
//   npx vite --port 5230 --strictPort &
//   PLAYWRIGHT=/path/to/playwright-core/index.mjs node scripts/unity-export/web-shots.mjs views.json out/
//
// PLAYWRIGHT points at playwright-core (not a dependency of the game); CHROME at a Chrome
// binary (default: the macOS app); URL at the dev server (default http://localhost:5230).
import { readFileSync, mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core');
const [viewsFile, out] = process.argv.slice(2);
const views = JSON.parse(readFileSync(viewsFile, 'utf8'));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const worlds = [...new Set(views.map((v) => v.world ?? 'desert'))];
for (const world of worlds) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log(world, 'pageerror', e.message));
  await page.goto(`${process.env.URL ?? 'http://localhost:5230'}/?level=${world}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.renderFrame && window.player && window.camera, null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  for (const v of views.filter((x) => (x.world ?? 'desert') === world)) {
    await page.evaluate((v) => {
      const { THREE, camera, player, setPhoto } = window;
      setPhoto(true);   // (hides the HUD and the panel)
      // and whatever else is over the canvas (the opening page, menus, the stats line)
      document.querySelectorAll('body > *').forEach((e) => { if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden'; });
      const eye = new THREE.Vector3(...v.eye), target = new THREE.Vector3(...v.target);
      player.pos.set(eye.x, eye.y - 1, eye.z);   // the shadow cascades and culling follow the player
      if (player.object) player.object.visible = false;
      camera.fov = v.fov ?? 55; camera.updateProjectionMatrix();
      // whatever the rig or the ship do with the camera, it renders from the eye
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, target, new THREE.Vector3(0, 1, 0)));
      camera.updateMatrixWorld = function () { this.position.copy(eye); this.quaternion.copy(q); THREE.Object3D.prototype.updateMatrixWorld.call(this, true); };
    }, v);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${out}/${v.name}.png` });
    console.log('shot', v.name);
  }
  await page.close();
}
await browser.close();

// Issue #501: every makers' box's scene hides the HUD the same way: its letterbox up and the HUD off through the
// cinema (src/ship/cinema.js, as main.js and engine/game.js wire the boxes' cam), and the hearts and the key count
// quiet under it (src/hud-shows.js sceneHolds), hurt or not. The City-Shaft's bridge box, a fight's prize, showed the
// hearts: only the ship's own scenes quieted them.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';
import { ITEMS } from '../src/items.js';
import { game } from '../src/game-state.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { BoxScene } from '../src/boxes/scene.js';
import { Cinema } from '../src/ship/cinema.js';
import { screen } from '../src/platform.js';
import { hudShows, sceneHolds } from '../src/hud-shows.js';
import { wireHealth } from '../src/host/game-host.js';
import { keysHud } from '../src/hud-state.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (f) => { const e = console.error, w = console.warn; console.error = console.warn = () => {}; try { return f(); } finally { console.error = e; console.warn = w; } };

test('every box scene hides the HUD: the hearts and the keys quiet under its letterbox, hurt or not (issue #501)', () => {
  const ids = Object.values(PLACEMENTS).flat().filter((p) => ITEMS[p.item]);
  assert.ok(ids.length >= 40, `the boxes: ${ids.length}`);
  const hurt = { health: 0.5, hearts: 1.5, maxHearts: 3, down: false };
  for (const p of ids) {
    game.reset();
    const cinema = new Cinema();
    const cam = { shot() {}, release() {}, hud: (on) => cinema.hud(on), bars: (on) => cinema.bars(on) };   // (main.js's, engine/game.js's)
    const health = wireHealth({ game });
    screen.set('cine', null);
    assert.ok(health.frame(0.1, { player: hurt }).hp, `${p.id}: hurt, before the scene: the hearts show`);
    const sc = new BoxScene({ box: { id: p.id, pos: V(), yaw: 0, parts: { mats: {} }, scene: null }, def: ITEMS[p.item], item: p.item, player: null, cam, onGrant() {}, onEnd() {} });
    quiet(() => { sc.start(); for (let i = 0; i < 30 && !sc.done; i++) sc.update(1 / 30); });
    assert.ok(sceneHolds(screen.state), `${p.id}: its scene holds the screen`);
    assert.equal(hudShows(screen.state).health, false, `${p.id}: the engines' hearts hidden (BridgeHud)`);
    assert.equal(health.frame(0.1, { player: hurt, fighting: true }).hp, null, `${p.id}: the page's hearts quiet`);
    quiet(() => sc.end?.());
    cinema.clear();
    assert.ok(!sceneHolds(screen.state), `${p.id}: over, the screen is the game's again`);
  }
  // walked through, a scene leaves them
  assert.equal(sceneHolds({ cine: { bars: true, hud: false, walk: true } }), false);
  assert.equal(keysHud({ inside: true, small: 1, quiet: sceneHolds({ cine: { bars: true } }) }), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LEVELS } from '../src/levels/index.js';
import { ORDER, CONTENT } from '../src/levels/content.js';
import { createReferences, viewCamera, frameBox, sunHour, sunTurn, cropStyle, worldPeople, VIEW_EXTENT } from '../src/levels/references.js';
import { REFERENCE_VIEWS, REFERENCE_SHEETS } from '../src/levels/reference-views.js';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { COSTUMES } from '../src/costumes.js';
import { applyTimeOfDay } from '../src/timeofday.js';

// one world's views at a time, as the level builds them (each built once, then shared by the tests)
const built = new Map();
async function refs(id = 'desert') {
  if (!built.has(id)) {
    await loadWorld(worldIndex(id));
    const scene = new THREE.Scene(), gone = [];
    built.set(id, { scene, gone, level: createReferences(scene, { params: new URLSearchParams(`world=${id}`), search: `?level=references&world=${id}`, go: (q) => gone.push(q) }) });
  }
  return built.get(id);
}
/** Every world built: each world's level, in order. */
const allWorlds = () => Promise.all(REFERENCE_WORLDS.map((w) => refs(w.id)));
/** a stand-in player and camera the level can frame */
function walker() {
  return {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), heading: 0, riding: false, object: new THREE.Object3D(), hidden: false,
    teleport(p) { this.pos.copy(p); this.vel.set(0, 0, 0); },
  };
}
globalThis.window ??= { innerWidth: 1260, innerHeight: 800 };

test('the references: a developer world in the worlds list, never on the route or the star map', async () => {
  const L = LEVELS.find((l) => l.id === 'references');
  assert.ok(L && L.dev && L.hidden, 'dev only (?level=references, the worlds list)');
  assert.ok(!ORDER.includes('references'), 'not on the route');
  assert.ok(CONTENT.references && COSTUMES.references, 'its content and its people\'s clothes');
  const { level } = await refs();
  assert.equal(level.id, 'references');
  assert.equal(level.reactions, false, 'nothing grows into the panels');
});

test('IMG_3775 has six views, each with a camera framed like its panel', async () => {
  const sheet = REFERENCE_VIEWS.filter((v) => v.sheet === 'IMG_3775');
  assert.equal(sheet.length, 6);
  assert.deepEqual(sheet.map((v) => v.panel), [1, 2, 3, 4, 5, 6]);
  const worlds = await allWorlds();
  assert.equal(worlds.reduce((n, { level }) => n + level.views.length, 0), REFERENCE_VIEWS.length, 'every view, world by world');
  for (const { level } of worlds) for (const v of level.views) {
    const d = v.def, [x, y, w, h] = d.crop, S = REFERENCE_SHEETS[d.sheet];
    assert.equal(REFERENCE_VIEWS[v.i], d, `${d.id}: numbered across the worlds as before`);
    assert.ok(x >= 0 && y >= 0 && x + w <= S.size[0] && y + h <= S.size[1], `${d.id}: the crop lies on its sheet`);
    const steep = d.camera.pitch !== undefined;   // (a view up or down a shaft: its pitch given outright)
    assert.ok(d.camera.fov > 15 && d.camera.fov < 90 && (steep ? Math.abs(d.camera.pitch) < 85 : d.camera.horizon > 0 && d.camera.horizon < 1), `${d.id}: a field of view and a horizon or pitch`);
    assert.equal(d.sky.length, 5, `${d.id}: its sky, shadow and light colours`);
    // the eye stands above its ground, in the world where the view is
    assert.ok(v.eye.y > level.ground.heightAt(v.eye.x, v.eye.z) + 1, `${d.id}: the eye clears the ground`);
    assert.ok(Math.abs(v.centre.x) <= VIEW_EXTENT && Math.abs(v.centre.z) <= VIEW_EXTENT && v.centre.length() > 1500, 'on the grid, clear of the ship at the origin');
    if (steep) continue;
    // the horizon lands where the panel has it: eye level projects to that height of the frame
    const cam = new THREE.PerspectiveCamera(d.camera.fov, w / h, 0.3, 5000);
    cam.position.copy(v.eye); cam.lookAt(v.target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const fwd = v.target.clone().sub(v.eye).setY(0).normalize();
    const p = v.eye.clone().addScaledVector(fwd, 1000).project(cam);
    assert.ok(Math.abs((1 - p.y) / 2 - d.camera.horizon) < 1e-3, `${d.id}: horizon at ${d.camera.horizon}`);
  }
  const all = worlds.flatMap(({ level }) => level.views);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
    assert.ok(all[i].centre.distanceTo(all[j].centre) > 3000, 'views far apart: only one is drawn');
});

test('each view\'s sun comes from the side its panel is lit from', async () => {
  const views = (await allWorlds()).flatMap(({ level }) => level.views);
  const U = { uSunDisc: { value: new THREE.Vector3() }, uMoonDisc: { value: new THREE.Vector3() }, uFlatten: { value: 0 }, uNight: { value: 0 }, uMoonVis: { value: 0 },
    uSkyTop: { value: new THREE.Color() }, uSkyHorizon: { value: new THREE.Color() }, uFogMul: { value: 1 }, uShadowTint: { value: new THREE.Color() },
    uLightTint: { value: new THREE.Color() }, uSunColor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() } };
  for (const v of views) {
    const sun = new THREE.Vector3();
    applyTimeOfDay(v.hour, sun, U, v.atmo, v.atmo.script);
    assert.ok(Math.abs(THREE.MathUtils.radToDeg(Math.asin(sun.y)) - v.def.sun.el) < 0.5, `${v.def.id}: sun ${v.def.sun.el}° high`);
    const fwd = v.target.clone().sub(v.eye).setY(0).normalize(), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const side = THREE.MathUtils.radToDeg(Math.atan2(sun.dot(right), sun.dot(fwd)));
    assert.ok(Math.abs(side - v.def.sun.side) < 0.5, `${v.def.id}: sun ${v.def.sun.side}° to the right (${side.toFixed(1)})`);
    assert.equal(sunTurn(v.def.sun, v.def.camera.yaw), v.group.rotation.y);
    assert.ok(sunHour(v.def.sun.el).hour > 6 && sunHour(v.def.sun.el).hour < 12);
  }
});

test('[ and ] frame the next and previous view; walking lets the camera go; \\ cycles the comparison', async () => {
  const { level, gone } = await refs();
  const player = walker(), camera = new THREE.PerspectiveCamera(55, 1260 / 800, 0.3, 5000);
  const rig = { yaw: 0, pitch: 0.2, _lastMouse: 0, target: new THREE.Vector3() };
  const step = (n = 2) => { for (let i = 0; i < n; i++) level.update(1 / 60, i / 60, { player, camera, rig }); };
  step();
  assert.equal(level.held, level.views[0], 'the first view is framed on arrival');
  assert.ok(camera.position.distanceTo(level.views[0].eye) < 1e-6 && player.hidden, 'the camera is the panel\'s, the traveller hidden');
  level.jump(1); step();
  assert.equal(level.held, level.views[1]);
  level.jump(-1); step();
  assert.equal(level.held, level.views[0]);
  player.pos.x += 2; step();
  assert.equal(level.held, null, 'walking: the camera is yours');
  assert.ok(!player.hidden && camera.fov === 55, 'the traveller back, the usual field of view');
  level.jump(1); step();
  assert.equal(level.held, level.views[1], 'a switch frames the panel again');
  assert.deepEqual([level.compare(), level.compare(), level.compare(), level.compare()], ['corner', 'overlay', 'half', 'off']);
  // the world's last view, then past it: the page goes to the next world's first (the world here goes with it)
  level.goTo(level.views.length - 1); step();
  assert.equal(level.held, level.views[level.views.length - 1]);
  assert.deepEqual(gone, [], 'still here');
  level.jump(1); step();
  assert.deepEqual(level.leaving, { k: 1, local: 0 });
  assert.deepEqual(gone, ['?level=references&world=shaft&view=1'], 'to the City-Shaft\'s first view');
});

test('the frame on screen keeps the panel\'s proportions; the crop is drawn from the sheet', () => {
  const wide = frameBox(1920, 1080, 463 / 294, 40), tall = frameBox(800, 1000, 463 / 294, 40);
  assert.ok(Math.abs(wide.w / wide.h - 463 / 294) < 1e-9 && wide.h === 1080 && wide.fov === 40);
  assert.ok(tall.w === 800 && tall.fov > 40, 'narrower than the panel: a wider field of view keeps its width');
  const c = viewCamera({ eye: [0, 2, 0], yaw: 0, fov: 40, horizon: 0.5 });
  assert.ok(Math.abs(c.pitch) < 1e-9 && c.target.z < 0, 'the horizon in the middle: looking level, down -z');
  const css = cropStyle(REFERENCE_VIEWS[0], 463, 294, REFERENCE_SHEETS);
  assert.match(css.backgroundImage, /IMG_3775\.JPG/);
  assert.equal(css.backgroundSize, '1024px 1024px');
  assert.equal(css.backgroundPosition, '-42px -44px');
});

test('the panels\' figures stand on their view\'s ground, in their own clothes: the people of the world built', async () => {
  for (const { level } of await allWorlds()) {
    const people = worldPeople(level.world);
    assert.equal(people.length, level.views.reduce((n, v) => n + (v.def.people?.length ?? 0), 0), `${level.world.id}: its panels' people`);
    for (const p of people) {
      const v = level.viewAt(p.at[0], p.at[1]);
      assert.ok(v, 'in a view');
      assert.ok(Math.abs(level.ground.heightAt(p.at[0], p.at[1]) - p.y) < 0.05, 'on the ground');
      assert.ok(p.lines.every((l) => /^~\w+~ /.test(l)), 'every line has a tone');
    }
  }
  // the level's people (content.js) are the world it built last, no other world's
  built.delete('desert');
  const { level } = await refs('desert');
  assert.deepEqual(CONTENT.references.npcs, worldPeople(level.world));
  assert.ok(CONTENT.references.npcs.length >= 4);
});

test('the other desert sheets: IMG_3772, 3773 and 3774 panel by panel, after IMG_3775, in order', async () => {
  const counts = { IMG_3775: 6, IMG_3772: 6, IMG_3773: 8, IMG_3774: 7 };
  for (const [s, n] of Object.entries(counts)) {
    const views = REFERENCE_VIEWS.filter((v) => v.sheet === s);
    assert.equal(views.length, n, `${s}: ${n} panels`);
    assert.deepEqual(views.map((v) => v.panel), Array.from({ length: n }, (_, i) => i + 1), `${s}: its panels in order`);
    assert.match(REFERENCE_SHEETS[s].url, new RegExp(`${s}\\.JPG$`));
    // no two panels of a sheet overlap
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const [ax, ay, aw, ah] = views[i].crop, [bx, by, bw, bh] = views[j].crop;
      assert.ok(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `${s}: panels ${i + 1} and ${j + 1} apart`);
    }
  }
  // [ ] cycles through all of them, sheet after sheet
  assert.deepEqual([...new Set(REFERENCE_VIEWS.map((v) => v.sheet))].slice(0, 4), ['IMG_3775', 'IMG_3772', 'IMG_3773', 'IMG_3774']);
  assert.equal(new Set(REFERENCE_VIEWS.map((v) => v.id)).size, REFERENCE_VIEWS.length, 'every view its own id');
  const { level } = await refs('desert');
  assert.equal(level.views.filter((v) => REFERENCE_SHEETS[v.def.sheet].name.startsWith('The Desert')).length, 27);
  assert.equal(level.views.length, 27, 'the desert\'s views alone');
});

test('the City-Shaft\'s sheets after the desert\'s, grouped by world, each panel on its sheet', () => {
  const counts = { IMG_3778: 1, IMG_3779: 5, IMG_3780: 5, IMG_3781: 5, IMG_3782: 7 };
  for (const [s, n] of Object.entries(counts)) {
    const views = REFERENCE_VIEWS.filter((v) => v.sheet === s);
    assert.equal(views.length, n, `${s}: ${n} panels`);
    assert.ok(REFERENCE_SHEETS[s].name.startsWith('The City-Shaft / '), 'the label names the world');
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const [ax, ay, aw, ah] = views[i].crop, [bx, by, bw, bh] = views[j].crop;
      assert.ok(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `${s}: panels ${i + 1} and ${j + 1} apart`);
    }
  }
  // grouped by world: every desert sheet before every City-Shaft one (and the worlds after them)
  const world = REFERENCE_VIEWS.map((v) => REFERENCE_SHEETS[v.sheet].name.split(' / ')[0]);
  assert.deepEqual([...new Set(world)].slice(0, 2), ['The Desert', 'The City-Shaft']);
  for (let i = 1; i < world.length; i++) assert.ok(world[i] === world[i - 1] || !world.slice(0, i).includes(world[i]), 'a world\'s views together');
  // the views up or down the shaft frame with a roll and a pitch
  const steep = REFERENCE_VIEWS.filter((v) => v.camera.pitch !== undefined);
  assert.ok(steep.length >= 8);
  const c = viewCamera({ eye: [0, 0, 0], fov: 60, pitch: -60, roll: 10 });
  assert.ok(Math.abs(c.pitch + Math.PI / 3) < 1e-9 && c.target.y < -40 && Math.abs(c.roll - Math.PI / 18) < 1e-9);
});

test('Vael II\'s sheets after the City-Shaft\'s, panel by panel, framed and labelled; ?look=vael2 draws them in the world\'s own look', async () => {
  const counts = { IMG_3783: 5, IMG_3784: 5, IMG_3785: 5, IMG_3786: 6, IMG_3787: 6, IMG_3788: 4 };
  for (const [s, n] of Object.entries(counts)) {
    const views = REFERENCE_VIEWS.filter((v) => v.sheet === s);
    assert.equal(views.length, n, `${s}: ${n} panels`);
    assert.deepEqual(views.map((v) => v.panel), Array.from({ length: n }, (_, i) => i + 1), `${s}: its panels in order`);
    assert.ok(REFERENCE_SHEETS[s].name.startsWith('Vael II, the Sky Stones / '), 'the label names the world and the sheet');
    assert.match(REFERENCE_SHEETS[s].url, new RegExp(`Vael%20II-%20The%20Sky%20Stones/${s}\\.JPG$`));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const [ax, ay, aw, ah] = views[i].crop, [bx, by, bw, bh] = views[j].crop;
      assert.ok(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `${s}: panels ${i + 1} and ${j + 1} apart`);
    }
  }
  const world = REFERENCE_VIEWS.map((v) => REFERENCE_SHEETS[v.sheet].name.split(' / ')[0]);
  assert.deepEqual([...new Set(world)].slice(0, 3), ['The Desert', 'The City-Shaft', 'Vael II, the Sky Stones']);
  const vael = REFERENCE_VIEWS.filter((v) => world[REFERENCE_VIEWS.indexOf(v)].startsWith('Vael II'));
  assert.equal(vael.length, 31);
  // the sheets' look: shade printed flat, no bounce under the caps, a clean sky
  for (const v of vael) assert.ok(v.look.uShadowFlat > 0.5 && v.look.uBounce === 0 && v.look.uCumulus === 0, `${v.id}: the sheets' print`);
  // its views build (the scene builder's pieces: needles, tables, stones, islands, monasteries, aqueducts, cloud, the tower, the bird)
  const { level } = await refs('vael2');
  for (const v of level.views.filter((x) => vael.includes(x.def))) assert.ok(v.group.children.length > 1, `${v.def.id}: something stands in it`);
  const { WORLD_LOOKS } = await import('../src/levels/references.js');
  const { SKY_STONES_LOOK, SKY_STONES_DAY } = await import('../src/levels/arzach2.js');
  assert.equal(WORLD_LOOKS.vael2.sky, SKY_STONES_DAY);
  assert.ok(WORLD_LOOKS.vael2.look.uShadowFlat > 0 && WORLD_LOOKS.vael2.look.uCumulus === SKY_STONES_LOOK.uCumulus, 'the world\'s own look, its flat print carried for the views');
  assert.ok(WORLD_LOOKS.desert, '?look=desert still');
});

test('Vael II\'s birds: one on the ground stands on its feet, wings folded; one in flight is well clear of the ground', async () => {
  const { level } = await refs('vael2');
  const birds = [];
  for (const v of level.views.filter((x) => x.def.sheet?.startsWith('IMG_378'))) v.group.traverse((o) => { if (o.userData.bird) birds.push({ id: v.def.id, ...o.userData.bird }); });
  assert.ok(birds.filter((b) => !b.fly).length >= 2 && birds.filter((b) => b.fly).length >= 1, JSON.stringify(birds));
  for (const b of birds) {
    if (b.fly) assert.ok(b.clear > 1.5, `${b.id}: a bird in flight, its feet ${b.clear.toFixed(2)} m off the ground (not hovering over it)`);
    else assert.ok(Math.abs(b.clear) < 0.1, `${b.id}: a bird on the ground, its feet ${b.clear.toFixed(2)} m off it`);
  }
});

test('the Buried Machine\'s sheets after Vael II\'s, panel by panel, framed and labelled', async () => {
  const counts = { IMG_3789: 5, IMG_3790: 6, IMG_3791: 6, IMG_3792: 5 };
  for (const [s, n] of Object.entries(counts)) {
    const views = REFERENCE_VIEWS.filter((v) => v.sheet === s);
    assert.equal(views.length, n, `${s}: ${n} panels`);
    assert.deepEqual(views.map((v) => v.panel), Array.from({ length: n }, (_, i) => i + 1));
    assert.ok(REFERENCE_SHEETS[s].name.startsWith('The Buried Machine / '));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const [ax, ay, aw, ah] = views[i].crop, [bx, by, bw, bh] = views[j].crop;
      assert.ok(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `${s}: panels ${i + 1} and ${j + 1} apart`);
    }
  }
  const world = REFERENCE_VIEWS.map((v) => REFERENCE_SHEETS[v.sheet].name.split(' / ')[0]);
  assert.deepEqual([...new Set(world)].slice(0, 4), ['The Desert', 'The City-Shaft', 'Vael II, the Sky Stones', 'The Buried Machine']);
  const buried = REFERENCE_VIEWS.filter((v, i) => world[i] === 'The Buried Machine');
  assert.equal(buried.length, 22);
  for (const v of buried) assert.ok(v.look.uSpot[0] > 0 && v.look.uSpot[3] > 0.3, `${v.id}: the sheets' spot blacks and dark cast shadows`);
  const { level } = await refs('buried');
  for (const v of level.views.filter((x) => buried.includes(x.def))) assert.ok(v.group.children.length > 1, `${v.def.id}: something stands in it`);
  const { WORLD_LOOKS } = await import('../src/levels/references.js');
  assert.ok(WORLD_LOOKS.buried.look.uSpot, '?look=buried');
});

test('the Garden of Spheres\' sheets after the Buried Machine\'s, panel by panel; the world\'s own look', async () => {
  const counts = { IMG_3793: 4, IMG_3794: 6, IMG_3795: 6, IMG_3796: 6 };
  for (const [s, n] of Object.entries(counts)) {
    const views = REFERENCE_VIEWS.filter((v) => v.sheet === s);
    assert.equal(views.length, n, `${s}: ${n} panels`);
    assert.deepEqual(views.map((v) => v.panel), Array.from({ length: n }, (_, i) => i + 1));
    assert.ok(REFERENCE_SHEETS[s].name.startsWith('The Garden of Spheres / '));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const [ax, ay, aw, ah] = views[i].crop, [bx, by, bw, bh] = views[j].crop;
      assert.ok(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `${s}: panels ${i + 1} and ${j + 1} apart`);
    }
  }
  const world = REFERENCE_VIEWS.map((v) => REFERENCE_SHEETS[v.sheet].name.split(' / ')[0]);
  assert.deepEqual([...new Set(world)].slice(0, 5), ['The Desert', 'The City-Shaft', 'Vael II, the Sky Stones', 'The Buried Machine', 'The Garden of Spheres']);
  const garden = REFERENCE_VIEWS.filter((v, i) => world[i] === 'The Garden of Spheres');
  assert.equal(garden.length, 22);
  const { SPHERES_LOOK } = await import('../src/levels/spheres.js');
  assert.ok(SPHERES_LOOK.uBounce === 0 && SPHERES_LOOK.uSpotTone[1] > SPHERES_LOOK.uSpotTone[0], 'dark canopy undersides, green spot blacks');
  for (const v of garden) assert.equal(v.look.uSpotTone, SPHERES_LOOK.uSpotTone, `${v.id}: the world's look`);
  const { level } = await refs('spheres');
  for (const v of level.views.filter((x) => garden.includes(x.def))) assert.ok(v.group.children.length > 1, `${v.def.id}: something stands in it`);
  const { WORLD_LOOKS } = await import('../src/levels/references.js');
  assert.ok(WORLD_LOOKS.spheres, '?look=spheres');
});

test('Lorn II\'s sheets after the Garden of Spheres\', panel by panel, named for the quick menu; their lights reach the shader', async () => {
  const counts = { IMG_3797: 6, IMG_3798: 6, IMG_3799: 5, IMG_3800: 6 };
  for (const [s, n] of Object.entries(counts)) {
    const views = REFERENCE_VIEWS.filter((v) => v.sheet === s);
    assert.equal(views.length, n, `${s}: ${n} panels`);
    assert.deepEqual(views.map((v) => v.panel), Array.from({ length: n }, (_, i) => i + 1));
    assert.equal(REFERENCE_SHEETS[s].name, `Lorn II / ${s}.JPG`, 'the quick menu groups by the name\'s world');
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const [ax, ay, aw, ah] = views[i].crop, [bx, by, bw, bh] = views[j].crop;
      assert.ok(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `${s}: panels ${i + 1} and ${j + 1} apart`);
    }
  }
  const world = REFERENCE_VIEWS.map((v) => REFERENCE_SHEETS[v.sheet].name.split(' / ')[0]);
  assert.deepEqual([...new Set(world)].slice(0, 6), ['The Desert', 'The City-Shaft', 'Vael II, the Sky Stones', 'The Buried Machine', 'The Garden of Spheres', 'Lorn II']);
  assert.equal(world.filter((w) => w === 'Lorn II').length, 23);
  const { level } = await refs('lorn');
  assert.ok(level.lights.length > 20, 'the views\' glowing eggs, pools and doors light what is near');
  for (const l of level.lights) assert.ok(level.viewAt(l.x, l.z), 'each light in its own view (turned with it)');
  const { WORLD_LOOKS } = await import('../src/levels/references.js');
  assert.ok(WORLD_LOOKS.lorn2, '?look=lorn2');
});

test('the Signal Market\'s sheets after Lorn II\'s, every panel, and the world\'s walls printed flat in its teal', async () => {
  const counts = { IMG_3801: 1, IMG_3802: 1, IMG_3803: 1, IMG_3804: 1, IMG_3805: 6, IMG_3806: 3, IMG_3807: 4, IMG_3808: 4 };
  for (const [s, n] of Object.entries(counts)) {
    const views = REFERENCE_VIEWS.filter((v) => v.sheet === s);
    assert.equal(views.length, n, `${s}: ${n} panels`);
    assert.deepEqual(views.map((v) => v.panel), Array.from({ length: n }, (_, i) => i + 1));
    assert.equal(REFERENCE_SHEETS[s].name, `The Signal Market / ${s}.JPG`);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const [ax, ay, aw, ah] = views[i].crop, [bx, by, bw, bh] = views[j].crop;
      assert.ok(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `${s}: panels ${i + 1} and ${j + 1} apart`);
    }
  }
  const world = REFERENCE_VIEWS.map((v) => REFERENCE_SHEETS[v.sheet].name.split(' / ')[0]);
  { const order = [...new Set(world)]; assert.equal(order.indexOf('The Signal Market'), order.indexOf('Lorn II') + 1, 'the Market right after Lorn II'); }
  assert.equal(world.filter((w) => w === 'The Signal Market').length, 21);
  const { MARKET_FLAT } = await import('../src/levels/bazaar.js');
  assert.ok(MARKET_FLAT > 0.5);
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/levels/bazaar.js', import.meta.url), 'utf8');
  assert.ok((src.match(/\.\.\.PRINT/g) ?? []).length >= 5, 'the walls and shops print their shade flat');
  const { WORLD_LOOKS } = await import('../src/levels/references.js');
  assert.ok(WORLD_LOOKS.bazaar, '?look=bazaar');
});

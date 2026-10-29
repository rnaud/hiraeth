// Cistern channels (docs/design/helper-guardians.md, issue #339): helping the Keeper of the cistern instead of fighting
// it. Under the Rose House the Givers' great cistern court is a floor of channel stones, eight by six; the old spout in
// its north wall still holds water. Walk the stones and turn them (A / × a quarter clockwise, X / □ back) so the water
// runs from the spout to every trough. Story/Easy waits for a deliberate valve press (RT / R2 or Shift; never L3's
// run, issue #788) and previews the current route, with a same-board drain/retry when water spills. Arcade Hard
// starts the water by itself. Three floods, each a new solvable board: two troughs, three, four, all against one
// clock (TIME: out of time, the run is lost and Retry plays the same boards again). RT / R2 held hurries water (double
// points per filled stone). The Keeper waits off the board while planning, then drinks from the filled troughs. The
// rules are channels.js; this is the court, the camera high over it, the stones, the water and the Keeper drawn.
// In the story it is played in the desert's own page (kit/here.js, issue #789): the court built far over the world at
// `level.at`, everything here drawn in the court's group and the traveller and the camera put over it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { arenaLevel } from './kit/world.js';
import { disposeTree } from './kit/dispose.js';
import { WorldLabels } from './kit/labels.js';
import { keeperGuardian } from '../temples/guardian-generated.js';
import { Dots } from '../fluid-tool.js';
import { makeBoard, newFlow, flowStep, releaseFlow, retryFlow, previewChannels, turnStone, openings, cellAt, scoreOf, round, botMove, ROUNDS, KINDS, DX, DY, N, opposite } from './channels.js';

// ------------------------------------------------------------------ the court's measures
export const COURT = { w: 8, h: 6, stone: 6.5, slab: 6.1, rim: 4, wall: 15, floorY: -0.8 };
const HW = (COURT.w * COURT.stone) / 2, HH = (COURT.h * COURT.stone) / 2;
/** A stone's middle in the world (x east, z south: row 0 is the north row, under the spout). */
export const stoneAt = (x, y, out = new THREE.Vector3()) => out.set((x - (COURT.w - 1) / 2) * COURT.stone, 0, (y - (COURT.h - 1) / 2) * COURT.stone);
/** The stone under a point of the court (or null off the board). */
export function stoneUnder(px, pz) {
  const x = Math.floor((px + HW) / COURT.stone), y = Math.floor((pz + HH) / COURT.stone);
  return x >= 0 && y >= 0 && x < COURT.w && y < COURT.h ? { x, y } : null;
}
/** Where a trough stands: in the rim, outside its stone's edge. */
export function troughAt(T, out = new THREE.Vector3()) {
  stoneAt(T.x, T.y, out);
  return out.set(out.x + DX[T.side] * (COURT.stone / 2 + COURT.rim / 2), 0, out.z + DY[T.side] * (COURT.stone / 2 + COURT.rim / 2));
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tag = (m) => { m.userData.noCollide = true; return m; };
const INK = '#2b211f', WATER = '#62c3c9';

/** The ground: the court's floor, sunk; round it the dunes rise to the desert's level over the walls. */
export function courtHeight(x, z) {
  const ox = Math.max(0, Math.abs(x) - HW - COURT.rim - 3), oz = Math.max(0, Math.abs(z) - HH - COURT.rim - 3);
  const d = Math.hypot(ox, oz);
  return COURT.floorY + 17 * smooth(0, 14, d) + 3 * Math.sin(x / 37) * Math.cos(z / 29) * smooth(10, 60, d);
}

// ------------------------------------------------------------------ the court, built
function* buildCourt(scene) {
  const terrain = yield* Terrain.make({
    size: 700, seg: 175, height: courtHeight,
    material: { color: '#efcf9c', color2: '#f5e0b8', color3: '#d9a77a', mode: MODE_TERRAIN, ripples: true, sandInk: true },
  });
  scene.add(terrain.mesh);
  yield;
  const stone = makeMaterial({ color: '#dc9583', color2: '#d38976', color3: '#e3a491', mode: MODE_STRATA, strataSize: 2.2, strataHatch: 0.4, cracks: 0.3 });
  const pale = makeMaterial({ color: '#e6ae9b', color2: '#d9a691', color3: '#efbfaa', mode: MODE_STRATA, strataSize: 1.6, strataHatch: 0.3 });
  const trim = makeMaterial({ color: '#c47b6b', flat: true });
  const dark = makeMaterial({ color: '#5a3640', flat: true });
  const water = makeMaterial({ color: WATER, glow: 0.35, flat: true, key: 'cistern.water' });
  const bronze = makeMaterial({ color: '#c99a52', metal: 'brass' });
  const geos = [], paleG = [], trimG = [], darkG = [];
  const box = (list, w, h, d, x, y, z, ry = 0) => list.push(new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z).toNonIndexed());
  const R = COURT.rim, X0 = -HW - R, X1 = HW + R, Z0 = -HH - R, Z1 = HH + R;
  // the rim's walk round the board, its top level with the stones'
  box(paleG, X1 - X0, 1, R, 0, -0.5, Z0 + R / 2); box(paleG, X1 - X0, 1, R, 0, -0.5, Z1 - R / 2);
  box(paleG, R, 1, Z1 - Z0 - 2 * R, X0 + R / 2, -0.5, 0); box(paleG, R, 1, Z1 - Z0 - 2 * R, X1 - R / 2, -0.5, 0);
  // the walls (north, east, west tall; the south a parapet, the camera's side), pilasters along them, a cornice
  const T = 1.6, H = COURT.wall;
  box(geos, X1 - X0 + 2 * T, H, T, 0, H / 2 - 0.8, Z0 - T / 2);
  box(geos, T, H, Z1 - Z0, X0 - T / 2, H / 2 - 0.8, (Z0 + Z1) / 2); box(geos, T, H, Z1 - Z0, X1 + T / 2, H / 2 - 0.8, (Z0 + Z1) / 2);
  box(geos, X1 - X0 + 2 * T, 1.6, T, 0, 0.0, Z1 + T / 2);
  for (let x = -HW; x <= HW + 0.01; x += COURT.stone) box(trimG, 1.3, H, 0.7, x, H / 2 - 0.8, Z0 + 0.3);
  for (let z = -HH; z <= HH + 0.01; z += COURT.stone) { box(trimG, 0.7, H, 1.3, X0 - 0.3, H / 2 - 0.8, z); box(trimG, 0.7, H, 1.3, X1 + 0.3, H / 2 - 0.8, z); }
  box(trimG, X1 - X0 + 2 * T + 1.2, 0.9, T + 1.2, 0, H - 0.8, Z0 - T / 2);
  box(trimG, T + 1.2, 0.9, Z1 - Z0, X0 - T / 2, H - 0.8, (Z0 + Z1) / 2); box(trimG, T + 1.2, 0.9, Z1 - Z0, X1 + T / 2, H - 0.8, (Z0 + Z1) / 2);
  // a band of the Givers' glyph-stones along the walls at head height, and the old water line, dark, higher up
  box(darkG, X1 - X0, 0.35, 0.2, 0, 6.2, Z0 + 0.05);
  box(darkG, 0.2, 0.35, Z1 - Z0, X0 + 0.05, 6.2, (Z0 + Z1) / 2); box(darkG, 0.2, 0.35, Z1 - Z0, X1 - 0.05, 6.2, (Z0 + Z1) / 2);
  scene.add(new THREE.Mesh(mergeGeometries(geos), stone), new THREE.Mesh(mergeGeometries(paleG), pale), tag(new THREE.Mesh(mergeGeometries(trimG), trim)), tag(new THREE.Mesh(mergeGeometries(darkG), dark)));
  yield;
  // four bronze braziers at the rim's corners (lit one by one as the troughs fill)
  const braziers = [[X0 + 1.6, Z0 + 1.6], [X1 - 1.6, Z0 + 1.6], [X0 + 1.6, Z1 - 1.6], [X1 - 1.6, Z1 - 1.6]].map(([x, z]) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0.2, 0], [0.35, 1.6], [0.9, 2.1], [1.1, 2.5], [0.95, 2.55]].map(([r, y]) => new THREE.Vector2(r, y)), 14), bronze);
    const flame = tag(new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.5, 8).translate(0, 3.2, 0), makeMaterial({ color: '#f6c84e', glow: 1, flat: true, key: 'cistern.flame' })));
    flame.visible = false;
    g.add(bowl, flame);
    g.userData.flame = flame;
    scene.add(g);
    return g;
  });
  // the Givers' spout: a long muzzle carved out of the north wall, its chute down to the rim (where it opens: the session
  // moves it over the board's spout column), the stream, a head basin in the rim
  const spout = new THREE.Group();
  spout.position.set(0, 0, Z0);
  const muzzle = new THREE.Mesh(mergeGeometries([
    new THREE.CylinderGeometry(1.0, 1.6, 3.2, 10).rotateX(Math.PI / 2).translate(0, 7.2, 1.6).toNonIndexed(),
    new THREE.SphereGeometry(2.0, 12, 8).scale(1.3, 1.1, 0.7).translate(0, 7.6, 0.2).toNonIndexed(),
    new THREE.BoxGeometry(2.4, 0.5, 1.0).translate(0, 8.9, 0.9).toNonIndexed(),
  ]), stone);
  const eyes = tag(new THREE.Mesh(mergeGeometries([new THREE.SphereGeometry(0.28, 8, 6).translate(-1.0, 8.3, 1.2), new THREE.SphereGeometry(0.28, 8, 6).translate(1.0, 8.3, 1.2)]), makeMaterial({ color: '#70e7df', glow: 0.6, flat: true, key: 'cistern.eyes' })));
  const stream = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 6.6, 10, 1, true).translate(0, 3.6, 3.2), water));
  const basin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 2.6).translate(0, -0.25, R - 1.4), pale);
  const basinWater = tag(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 2.0).translate(0, 0.16, R - 1.4), water));
  spout.add(muzzle, eyes, stream, basin, basinWater);
  scene.add(spout);
  yield;
  return arenaLevel({
    ground: terrain, name: 'The Givers’ cistern court', hour: 14.2,
    spawn: new THREE.Vector3(0, 0, HH + COURT.rim / 2),
    cistern: { braziers, spout, stream, basinWater, mats: { stone, pale, trim, dark, water, bronze } },
  });
}

// ------------------------------------------------------------------ the stones, drawn
const _box = new THREE.BoxGeometry(1, 1, 1);
/** A stone's model: the slab and its channels as its kind cut them, turned with it (its `turn` group). */
function stoneModel(c, mats) {
  const g = new THREE.Group(), turn = new THREE.Group();
  g.add(turn);
  const S = COURT.slab, broken = c.kind === 'O';
  const slab = [new THREE.BoxGeometry(S, 0.9, S).translate(0, -0.45, 0).toNonIndexed()];
  const cut = [];
  if (broken) {
    // a broken stone: split across, the two halves sunk and tipped apart, dark in the crack between
    slab.length = 0;
    slab.push(new THREE.BoxGeometry(S * 0.55, 0.9, S).rotateZ(0.05).translate(-S * 0.23, -0.72, 0).toNonIndexed(), new THREE.BoxGeometry(S * 0.4, 0.9, S * 0.96).rotateZ(-0.07).rotateY(0.06).translate(S * 0.29, -0.8, 0.05).toNonIndexed());
    cut.push(new THREE.BoxGeometry(S * 0.08, 0.05, S * 0.98).translate(S * 0.05, -0.3, 0).toNonIndexed());
  } else {
    const m = KINDS[c.kind];
    cut.push(new THREE.BoxGeometry(1.7, 0.06, 1.7).translate(0, 0.02, 0).toNonIndexed());
    for (let d = 0; d < 4; d++) if ((m >> d) & 1) cut.push(new THREE.BoxGeometry(DX[d] ? S / 2 : 1.7, 0.06, DX[d] ? 1.7 : S / 2).translate(DX[d] * S / 4, 0.02, DY[d] * S / 4).toNonIndexed());
    // the Givers' marks at the corners (which way it has been turned is read by its channel; these are its fittings)
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cut.push(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 8).translate(x * S * 0.38, 0.01, z * S * 0.38).toNonIndexed());
  }
  turn.add(new THREE.Mesh(mergeGeometries(slab), broken ? mats.broken : mats.slab), tag(new THREE.Mesh(mergeGeometries(cut), broken ? mats.crack : mats.groove)));
  turn.rotation.y = -c.r * Math.PI / 2;
  g.userData.turn = turn;
  g.userData.channels = turn.children[1];
  // Stable material bindings in both renderers: the engine mirrors visibility live,
  // while changing a mesh's material after creation does not rebind its renderer.
  const connected = tag(new THREE.Mesh(g.userData.channels.geometry, mats.connected));
  connected.visible = false;
  turn.add(connected); g.userData.connected = connected;
  return g;
}

/** A piece of running water in a stone's channel (a box scaled each frame), in the stone's group (world sides). */
function waterPiece(g, mat) {
  const m = tag(new THREE.Mesh(_box, mat));
  m.scale.set(0.001, 0.08, 0.001);
  g.add(m);
  return m;
}

// ------------------------------------------------------------------ the sounds
export function courtSounds(sound) {
  const on = () => !!sound?.ctx && !sound.muted && sound.fx;
  const note = (s) => 440 * Math.pow(2, s / 12);
  return {
    grind() { if (on()) { const t = sound.ctx.currentTime; sound.burst(t, { dur: 0.28, type: 'lowpass', freq: 380, q: 0.8, vol: 0.16, rate: 0.55 }); sound.sweep(t, 90, 70, 0.22, 0.05, 'triangle'); } },
    thunk() { if (on()) sound.sweep(sound.ctx.currentTime, 140, 60, 0.15, 0.05, 'square'); },
    fill(n) { if (on()) sound.pluck(note([0, 3, 7, 10, 12, 15, 19][n % 7] - 5), sound.ctx.currentTime, 0.05, 'sine', sound.fx); },
    spout() { if (on()) { const t = sound.ctx.currentTime; sound.burst(t, { dur: 1.4, type: 'bandpass', freq: 900, q: 0.5, vol: 0.12, rate: 0.9 }); sound.sweep(t, 110, 220, 0.9, 0.04, 'sine'); } },
    trough() { if (!on()) return; const t = sound.ctx.currentTime; [0, 4, 7, 12, 16].forEach((s, i) => sound.pluck(note(s), t + i * 0.07, 0.07, 'triangle', sound.fx)); },
    spill() { if (on()) { const t = sound.ctx.currentTime; sound.burst(t, { dur: 0.6, type: 'lowpass', freq: 700, q: 0.4, vol: 0.14, rate: 1 }); } },
  };
}

// ------------------------------------------------------------------ the game
/**
 * The clock (issue #788: "timed so it's a bit harder"): the three floods in 5 minutes, both difficulties. A bot that
 * knows the way and never stops walks the story's boards in 1:50–2:15 hurrying the water (2:25–2:55 not); with two
 * seconds' thought at each turn of a stone, 3:15–4:10 (tests/cistern-timer.test.js). Out of time: the run is lost,
 * Retry plays the same boards. `warn`: the seconds left that are called out.
 */
export const TIME = { limit: 300, warn: [60, 30, 10] };
const PLAYER = { walk: 6.2, accel: 14, reach: 0.6 };
const KEEPER = { scale: 0.55, speed: 1.3, body: 2.6, drink: 4.5 };
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _cw = new THREE.Vector3(), _cl = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);

function start(ctx) {
  const { player, camera, level, sfx, scene } = ctx;
  const L = level.cistern;
  // (where the court stands in the world: its own page's arena at the origin, or over the desert, kit/here.js)
  const O = level.at ? new THREE.Vector3().copy(level.at) : new THREE.Vector3();
  const atWorld = (v) => v.add(O);
  const snd = courtSounds(ctx.sound);
  const words = new WorldLabels(camera);
  const lvl = ctx.option('level') ?? 'easy';
  // Story encounters always allow a complete plan; the arcade Hard option keeps its timed challenge.
  const manual = !!ctx.helper || lvl !== 'hard';
  const seed0 = ctx.helper?.seed ?? (1 + Math.floor(Math.random() * 1e6));
  const mats = {
    slab: makeMaterial({ color: '#e6ae9b', color2: '#dca08c', color3: '#efbfaa', mode: MODE_STRATA, strataSize: 1.2, strataHatch: 0.35, key: 'cistern.slab' }),
    broken: makeMaterial({ color: '#9c6a5e', color2: '#8f5f54', color3: '#a8776a', mode: MODE_STRATA, strataSize: 0.8, cracks: 1, key: 'cistern.broken' }),
    groove: makeMaterial({ color: '#7a4a48', flat: true, key: 'cistern.groove' }),
    connected: makeMaterial({ color: '#53c6bd', glow: 0.3, flat: true, key: 'cistern.connected' }),
    crack: makeMaterial({ color: '#2b211f', flat: true, key: 'cistern.crack' }),
    water: L.mats.water,
    wet: makeMaterial({ color: '#4f8f96', flat: true, key: 'cistern.wet' }),
    here: makeMaterial({ color: '#f6c84e', glow: 0.9, flat: true, key: 'cistern.here' }),
    no: makeMaterial({ color: '#b8432e', glow: 0.7, flat: true, key: 'cistern.no' }),
    warn: makeMaterial({ color: '#e0442e', glow: 1, flat: true, key: 'cistern.warn' }),
  };
  (level.noShadow ??= []);
  const splash = new Dots(scene, 200, makeMaterial({ color: '#bfeff0', flat: true, key: 'cistern.splash' }));
  level.noShadow.push(splash.mesh);

  // the frame round the stone you stand on, and the warnings where the water is about to spill
  const frame = ctx.add(new THREE.Group());
  for (let k = 0; k < 4; k++) {
    const m = tag(new THREE.Mesh(_box, mats.here));
    const a = k * Math.PI / 2;
    m.position.set(Math.sin(a) * COURT.slab / 2, 0.06, Math.cos(a) * COURT.slab / 2);
    m.scale.set(k % 2 ? 0.22 : COURT.slab + 0.22, 0.1, k % 2 ? COURT.slab + 0.22 : 0.22);
    frame.add(m);
  }
  const arrowGeo = new THREE.ConeGeometry(0.75, 1.6, 3).rotateX(Math.PI / 2);
  const warns = Array.from({ length: 8 }, () => { const m = tag(ctx.add(new THREE.Mesh(arrowGeo, mats.warn))); m.visible = false; return m; });
  level.noShadow.push(frame, ...warns);

  // the Keeper, two-thirds the size of the shipped one (it shares the court with the board), wandering
  const keeperRoot = ctx.add(new THREE.Group());
  keeperRoot.scale.setScalar(KEEPER.scale);
  const K = keeperGuardian();
  keeperRoot.add(K.group);
  const keeperRest = new THREE.Vector3(HW + COURT.rim / 2, 0, -HH - COURT.rim / 2);
  const kp = manual ? keeperRest.clone() : new THREE.Vector3(stoneAt(1, 1).x, 0, stoneAt(1, 1).z);   // (its place in the world; K.pos is that over the scale)
  const keeper = { pos: kp, heading: Math.PI / 2, target: null, rest: 1.5, drinkAt: null, drink: 0, speed: 0, calm: 0, said: 0 };
  const kkit = { eye: null, ground: () => 0 };
  const placeKeeper = (dt, t) => {
    K.pos.copy(keeper.pos).divideScalar(KEEPER.scale);
    K.heading = keeper.heading;
    K.group.position.copy(K.pos);
    K.group.rotation.y = keeper.heading;
    K.animate(dt, t, { state: keeper.drink > 0 ? 'open' : 'fight', attack: null, k: 0, speed: keeper.speed / KEEPER.scale, meter: keeper.calm, kit: kkit });
  };
  placeKeeper(1 / 60, 0);

  // the feet stand on the stones' tops (y 0), drawn flat
  const feet = { heightAbove: (p) => p.y - O.y, groundNormal: (x, y, z, out = new THREE.Vector3()) => out.set(0, 1, 0), groundAt: () => O.y };
  const feet0 = player._feetGround;
  player._feetGround = feet;
  const me = { pos: new THREE.Vector3(0, 0, HH + COURT.rim / 2), vel: new THREE.Vector3(), heading: Math.PI };

  const total = { points: 0, floods: [] };
  let flood = -1, B = null, F = null, stones = [], wet = new Map(), puddles = [], between = 0, t = 0, lastWarnAt = -9, ended = false;
  let preview = null, awaitingRetry = false, valveHeld = false, played = 0, warned = 0;
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };

  function clearWater() {
    for (const p of puddles) {
      const i = level.noShadow.indexOf(p); if (i >= 0) level.noShadow.splice(i, 1);
      disposeTree(p);
    }
    for (const w of wet.values()) for (const m of w.pieces) disposeTree(m);
    wet.clear(); puddles = [];
    L.stream.visible = false; L.basinWater.visible = false;
    for (const g of L.troughs ?? []) { g.userData.water.visible = false; g.userData.fill = 0; }
    for (const b of L.braziers) b.userData.flame.visible = false;
  }

  function refreshPreview() {
    preview = manual && F.planning ? previewChannels(B) : null;
    stones.forEach((g, i) => {
      const on = !B.cells[i].fixed && !!preview?.connected[i];
      g.userData.connected.visible = on; g.userData.channels.visible = !on;
    });
  }

  function planAgain() {
    clearWater(); F = retryFlow(B, F); awaitingRetry = false;
    keeper.pos.copy(keeperRest); keeper.target = null; keeper.drinkAt = null; keeper.drink = 0;
    refreshPreview(); ctx.flash('Adjust the channels. Open the valve when ready.', '', 2.5);
  }

  function begin(i) {
    flood = i; clearWater();
    for (const o of stones) disposeTree(o);
    const R = round(i, lvl);
    B = makeBoard(seed0 + i * 97, { troughs: R.troughs, broken: R.broken });
    F = newFlow(B, { wait: R.wait, pace: R.pace, paceMin: R.paceMin, planning: manual });
    awaitingRetry = false;
    if (manual) { keeper.pos.copy(keeperRest); keeper.target = null; keeper.drinkAt = null; keeper.drink = 0; }
    stones = B.cells.map((c, k) => {
      const g = ctx.add(stoneModel(c, mats));
      stoneAt(k % B.w, (k / B.w) | 0, g.position);
      g.userData.angle = -c.r * Math.PI / 2;
      return g;
    });
    // the troughs of this flood, in the rim; the spout over its column
    for (const o of L.troughs ?? []) disposeTree(o);
    L.troughs = B.troughs.map((T) => {
      const g = ctx.add(new THREE.Group());
      troughAt(T, g.position);
      g.rotation.y = DX[T.side] ? Math.PI / 2 : 0;
      g.add(new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.1, 2.4).translate(0, 0.25, 0), L.mats.pale));
      const inner = tag(new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 1.8), mats.groove));
      inner.position.y = 0.83;
      const w = tag(new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 1.8), mats.water));
      w.position.y = 0.86; w.visible = false;
      g.add(inner, w);
      g.userData.water = w;
      return g;
    });
    L.spout.position.x = stoneAt(B.spout.x, 0).x;
    L.stream.visible = false; L.basinWater.visible = false;
    for (const b of L.braziers) b.userData.flame.visible = false;
    between = 0; refreshPreview();
    ctx.status(statusText());
    if (i > 0) ctx.flash(`Flood ${i + 1}: ${R.troughs} troughs`, 'good', 2);
  }

  function statusText() {
    if (!F) return '';
    const live = total.points + (F.done ? 0 : scoreOf(B, F).total);   // (a flood run out is in the total already)
    if (awaitingRetry) return `Flood ${flood + 1}/${ROUNDS.length} · troughs ${F.troughs}/${B.troughs.length}\nRT / R2: drain and adjust`;
    if (F.planning) return `Plan ${flood + 1}/${ROUNDS.length} · connected troughs ${preview.troughs}/${preview.of}\nRT / R2: open valve`;
    const wait = !F.started ? ` · the spout opens in ${Math.ceil(F.wait)}` : '';
    return `${live} pts · flood ${flood + 1}/${ROUNDS.length} · troughs ${F.troughs}/${B.troughs.length}${wait}`;
  }

  /** The water drawn: each running front's channel filling (in from its edge to the middle, then out along its exits). */
  function drawWater() {
    for (const fr of F.fronts) {
      const key = `${fr.x},${fr.y},${fr.from}`;
      let w = wet.get(key);
      if (!w) {
        const g = stones[fr.y * B.w + fr.x];
        const mat = mats.water;
        w = { fr, g, entry: waterPiece(g, mat), mid: waterPiece(g, mat), exits: fr.exits.map((d) => ({ d, m: waterPiece(g, mat) })) };
        w.pieces = [w.entry, w.mid, ...w.exits.map((e) => e.m)];
        wet.set(key, w);
      }
      w.fr = fr;
    }
    const S = COURT.slab / 2;
    for (const w of wet.values()) {
      const f = Math.min(1, w.fr.t), from = w.fr.from;
      const a = Math.min(1, f / 0.45), b = clamp((f - 0.35) / 0.2, 0, 1), c = clamp((f - 0.5) / 0.5, 0, 1);
      // in: from the edge of the side it came in by, toward the middle
      const len = S * a;
      w.entry.scale.set(DX[from] ? len : 1.25, 0.08, DX[from] ? 1.25 : len);
      w.entry.position.set(DX[from] * (S - len / 2), 0.07, DY[from] * (S - len / 2));
      w.mid.scale.set(1.25 * b + 0.001, 0.08, 1.25 * b + 0.001);
      w.mid.position.set(0, 0.07, 0);
      for (const e of w.exits) {
        const l = S * c;
        e.m.scale.set(DX[e.d] ? l + 0.001 : 1.25, 0.08, DX[e.d] ? 1.25 : l + 0.001);
        e.m.position.set(DX[e.d] * (l / 2), 0.07, DY[e.d] * (l / 2));
      }
    }
  }

  /** Red arrows where a running stream will spill: an exit into a stone that does not open to it, or into the wall. */
  function drawWarnings() {
    let n = 0;
    const pulse = 0.75 + 0.25 * Math.sin(t * 9);
    if (preview) for (const e of preview.spills) {
      if (n >= warns.length) break;
      const m = warns[n++]; stoneAt(e.x, e.y, m.position);
      m.position.x += DX[e.from] * COURT.stone / 2; m.position.z += DY[e.from] * COURT.stone / 2;
      m.position.y = 0.9; m.rotation.set(0, Math.atan2(DX[e.from], DY[e.from]), 0);
      m.scale.setScalar(pulse); m.visible = true;
    }
    for (const fr of F.fronts) for (const d of fr.exits) {
      const nx = fr.x + DX[d], ny = fr.y + DY[d], c = cellAt(B, nx, ny);
      const bad = c ? !((openings(c) >> opposite(d)) & 1) && !((c.wet >> opposite(d)) & 1) : !B.troughs.some((T) => T.x === fr.x && T.y === fr.y && T.side === d);
      if (!bad || n >= warns.length) continue;
      const m = warns[n++];
      stoneAt(fr.x, fr.y, m.position);
      m.position.x += DX[d] * (COURT.stone / 2); m.position.z += DY[d] * (COURT.stone / 2); m.position.y = 0.9 + 0.25 * Math.sin(t * 6);
      m.rotation.set(0, Math.atan2(DX[d], DY[d]), 0);
      m.scale.setScalar(pulse * (fr.t > 0.6 ? 1.3 : 1));
      m.visible = true;
      if (fr.t > 0.55 && t - lastWarnAt > 2.5 && fr.t < 0.7) { lastWarnAt = t; sfx.tick?.(1); }
    }
    for (let k = n; k < warns.length; k++) warns[k].visible = false;
  }

  function onEvents(ev) {
    for (const e of ev) {
      if (e.kind === 'start') { L.stream.visible = true; L.basinWater.visible = true; snd.spout(); ctx.flash('The spout opens!', 'good', 1.4); }
      else if (e.kind === 'fill') {
        snd.fill(F.filled);
        words.pop(atWorld(stoneAt(e.x, e.y, _v).setY(1.2)), e.hurried ? '+20' : '+10', e.hurried ? 'gold' : '', 0.8);
      } else if (e.kind === 'cross') { sfx.checkpoint(); words.pop(atWorld(stoneAt(e.x, e.y, _v).setY(1.6)), '+100 · both ways', 'combo', 1.2); }
      else if (e.kind === 'trough') {
        snd.trough();
        const T = B.troughs[e.i], g = L.troughs[e.i];
        g.userData.water.visible = true; g.userData.fill = 0; g.userData.water.scale.set(0.05, 1, 1);
        words.pop(atWorld(troughAt(T, _v).setY(2)), '+250', 'gold', 1.4);
        ctx.flash(F.troughs === B.troughs.length ? 'Every trough runs!' : 'The Keeper drinks!', 'good', 1.4);
        const lit = L.braziers.filter((b) => b.userData.flame.visible).length;
        if (lit < L.braziers.length) L.braziers[lit].userData.flame.visible = true;
        // the Keeper goes to drink there
        keeper.drinkAt = troughAt(T, new THREE.Vector3()).addScaledVector(_w.set(-DX[T.side], 0, -DY[T.side]), 3.4);
        keeper.drinkLook = troughAt(T, new THREE.Vector3());
        keeper.target = keeper.drinkAt.clone();
      } else if (e.kind === 'spill') {
        snd.spill(); sfx.miss();
        // (where it spills: the edge it came to, the stone it tried to run into's or the wall's)
        const at = stoneAt(e.x, e.y, new THREE.Vector3());
        at.x += DX[e.from] * (COURT.stone / 2); at.z += DY[e.from] * (COURT.stone / 2);
        const p = ctx.add(tag(new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), mats.wet)));
        p.position.set(at.x, 0.04, at.z); p.scale.setScalar(0.3); p.userData.grow = 0;
        puddles.push(p);
        level.noShadow.push(p);
        for (let k = 0; k < 26; k++) splash.add({ pos: _v.set(at.x, 0.3, at.z), vel: _w.set((Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6), size: 0.08 + Math.random() * 0.08, life: 0.9, color: Math.random() < 0.5 ? WATER : '#ffffff' });
        words.pop(atWorld(at.clone().setY(1.6)), 'spilled', 'bad', 1.2);
        ctx.flash('Spilled!', 'bad', 1.1);
      } else if (e.kind === 'done') floodDone();
    }
  }

  /** The seconds left (the runner's own clock where there is one: the HUD's countdown, kit/runner.js hud.countdown). */
  const timeLeft = () => TIME.limit - (Number.isFinite(ctx.time) ? ctx.time : played);
  function clockStep() {
    const left = timeLeft();
    if (left <= 0) { outOfTime(); return; }
    let w = -1;
    TIME.warn.forEach((s, i) => { if (left <= s) w = i; });
    if (w >= warned) {
      warned = w + 1;
      ctx.flash(TIME.warn[w] >= 60 ? 'One minute left!' : `${TIME.warn[w]} seconds left!`, 'bad', 1.6);
      sfx.tick?.(1);
    }
  }
  /** Out of time: the run is lost (its points kept as a score, never the goal); Retry plays the same boards again. */
  function outOfTime() {
    ended = true;
    const running = F && !F.done && !awaitingRetry && F.troughs > 0, done = total.floods.filter((f) => f.troughs === f.of).length;
    ctx.finish({ score: total.points, failed: true, goal: { game: 'cistern', complete: false }, title: 'Out of time', lines: [
      done ? `${done} of ${ROUNDS.length} floods reached every trough` : 'No flood reached every trough',
      ...(running ? [`Flood ${flood + 1}: troughs ${F.troughs}/${B.troughs.length} when the time ran out`] : []),
      ...(ctx.helper ? ['Retry: the same channels, from the first flood'] : []),
    ] });
  }

  function floodDone() {
    const sc = scoreOf(B, F);
    if (manual && F.troughs !== B.troughs.length) {
      awaitingRetry = true; L.stream.visible = false;
      ctx.flash('Some troughs are dry. Drain and adjust the same channels.', '', 3);
      return; // Failed attempts never bank points or consume a flood.
    }
    total.points += sc.total;
    total.floods.push({ ...sc, troughs: F.troughs, of: B.troughs.length, filled: F.filled });
    ctx.setScore(total.points);
    L.stream.visible = false;
    if (flood + 1 >= ROUNDS.length) {
      ended = true;
      const all = total.floods.reduce((n, f) => n + f.troughs, 0), of = total.floods.reduce((n, f) => n + f.of, 0);
      ctx.finish({ score: total.points, failed: all !== of, goal: { game: 'cistern', complete: all === of }, title: all === of ? 'The cistern runs!' : 'Some troughs are still dry', lines: [
        ...total.floods.map((f, k) => `Flood ${k + 1}: ${f.total} (troughs ${f.troughs}/${f.of} · ${f.filled} stones${f.crosses ? ` · ${f.crosses / 100} both ways` : ''}${f.all ? ' · every trough +500' : ''})`),
        `The Keeper drank at ${all} of ${of} troughs`,
      ] });
    } else {
      between = 3.2;
      ctx.flash(F.troughs === B.troughs.length ? `Flood ${flood + 1}: every trough! +${sc.total}` : `Flood ${flood + 1}: ${sc.total} pts`, F.troughs === B.troughs.length ? 'good big' : '', 2.4);
    }
  }

  // ---------------------------------------------------------------- the traveller, the Keeper, the camera
  function walk(dt, inp) {
    const want = _v.set(inp.x, 0, -inp.y);   // (on the screen's axes: the camera looks north)
    if (want.lengthSq() > 1) want.normalize();
    want.multiplyScalar(PLAYER.walk);
    me.vel.lerp(want, 1 - Math.exp(-PLAYER.accel * dt));
    me.pos.addScaledVector(me.vel, dt);
    // the rim's walls, the troughs, the Keeper's body
    const R = COURT.rim - 0.6;
    me.pos.x = clamp(me.pos.x, -HW - R, HW + R); me.pos.z = clamp(me.pos.z, -HH - R, HH + R);
    for (const g of L.troughs) {
      const along = g.rotation.y ? 1.4 : 2.6, across = g.rotation.y ? 2.6 : 1.4;
      const dx = me.pos.x - g.position.x, dz = me.pos.z - g.position.z;
      if (Math.abs(dx) < along + 0.4 && Math.abs(dz) < across + 0.4) {
        const px = along + 0.4 - Math.abs(dx), pz = across + 0.4 - Math.abs(dz);
        if (px < pz) me.pos.x += Math.sign(dx) * px; else me.pos.z += Math.sign(dz) * pz;
      }
    }
    _w.subVectors(me.pos, keeper.pos).setY(0);
    const kd = _w.length();
    if (kd < KEEPER.body && kd > 1e-3) me.pos.addScaledVector(_w, (KEEPER.body - kd) / kd);
    const sp = Math.hypot(me.vel.x, me.vel.z);
    if (sp > 0.4) me.heading += Math.atan2(Math.sin(Math.atan2(me.vel.x, me.vel.z) - me.heading), Math.cos(Math.atan2(me.vel.x, me.vel.z) - me.heading)) * (1 - Math.exp(-14 * dt));
    return sp;
  }

  function pose(dt, sp) {
    player.pos.copy(me.pos).add(O);
    player.vel.copy(me.vel);
    player.heading = me.heading;
    player.onGround = true;
    player._groundH = O.y;
    player._moveDir = (player._moveDir ?? new THREE.Vector3()).set(sp > 0.3 ? me.vel.x / sp : 0, 0, sp > 0.3 ? me.vel.z / sp : 0);
    player._wantSpeed = sp;
    player.gliding = false; player.jetFlight = null;
    player.finishFrame(dt, sp);
  }

  function moveKeeper(dt) {
    if (manual && F.planning) { keeper.speed = 0; return; }
    if (manual && !keeper.drinkAt && keeper.drink <= 0) {
      if (keeper.pos.distanceTo(keeperRest) < 0.6) { keeper.speed = 0; return; }
      keeper.target = keeperRest.clone();
    }
    if (keeper.drink > 0) { keeper.drink -= dt; keeper.speed = 0; if (keeper.drink <= 0) { keeper.drinkAt = null; keeper.target = null; keeper.rest = 1; } return; }
    if (!keeper.target) {
      if ((keeper.rest -= dt) > 0) { keeper.speed = 0; return; }
      // somewhere on the board it has not been, away from you, near the water if it runs (it is curious about it)
      const near = F?.fronts[0];
      for (let k = 0; k < 12; k++) {
        const x = Math.floor(Math.random() * COURT.w), y = Math.floor(Math.random() * COURT.h);
        const p = stoneAt(x, y, new THREE.Vector3());
        if (p.distanceTo(me.pos) < 9 || cellAt(B, x, y)?.set) continue;
        if (near && Math.abs(x - near.x) + Math.abs(y - near.y) > 4 && k < 8) continue;
        keeper.target = p; break;
      }
      keeper.rest = 2 + Math.random() * 3;
      if (!keeper.target) return;
    }
    _v.subVectors(keeper.target, keeper.pos).setY(0);
    const d = _v.length();
    if (d < 0.6) {
      keeper.target = null; keeper.speed = 0;
      if (keeper.drinkAt) { keeper.drink = KEEPER.drink; keeper.calm = Math.min(1, keeper.calm + 0.25 / ROUNDS.length * 2); if (keeper.drinkLook) keeper.heading = Math.atan2(keeper.drinkLook.x - keeper.pos.x, keeper.drinkLook.z - keeper.pos.z); }
      return;
    }
    const want = Math.atan2(_v.x, _v.z), turn = Math.atan2(Math.sin(want - keeper.heading), Math.cos(want - keeper.heading));
    keeper.heading += clamp(turn, -1.4 * dt, 1.4 * dt);
    keeper.speed = KEEPER.speed * (keeper.drinkAt ? 1.6 : 1) * Math.max(0, Math.cos(turn));
    keeper.pos.x += Math.sin(keeper.heading) * keeper.speed * dt;
    keeper.pos.z += Math.cos(keeper.heading) * keeper.speed * dt;
    // (it does not walk into you either)
    _w.subVectors(keeper.pos, me.pos).setY(0);
    const kd = _w.length();
    if (kd < KEEPER.body && kd > 1e-3) keeper.pos.addScaledVector(_w, (KEEPER.body - kd) / kd);
  }
  const keeperStone = () => stoneUnder(keeper.pos.x, keeper.pos.z);
  const underKeeper = (x, y) => { if (manual && F.planning) return false; const s = keeperStone(); return !!s && s.x === x && s.y === y; };

  function updateCamera(dt, snap = false) {
    // high over the court's south end, looking down at the whole board, easing a little after you
    _cl.set(me.pos.x * 0.1, 0, 2.5 + me.pos.z * 0.08);
    _cw.copy(_cl).add(_v.set(0, 52, 32));
    const e = snap ? 1 : 1 - Math.exp(-2.5 * dt);
    cam.pos.lerp(_cw, e); cam.look.lerp(_cl, e);
    camera.position.copy(cam.pos).add(O);
    camera.up.set(0, 1, 0);
    camera.lookAt(_cl.copy(cam.look).add(O));
    ctx.setFov(44);
  }

  function press(dir) {
    const s = stoneUnder(me.pos.x, me.pos.z);
    if (!s) return;
    const why = turnStone(B, s.x, s.y, dir, underKeeper);
    if (!why) { snd.grind(); const g = stones[s.y * B.w + s.x]; g.userData.angle -= dir * Math.PI / 2; refreshPreview(); return; }
    snd.thunk();
    const msg = { broken: 'That one’s broken.', set: 'The water’s in it.', blocked: 'It’s lying on that one.' }[why];
    if (msg) words.pop(atWorld(stoneAt(s.x, s.y, _v).setY(1.8)), msg, 'bad', 1.1);
  }

  begin(0);
  me.heading = Math.PI;
  pose(1 / 60, 0);
  updateCamera(0, true);
  let botCool = 0;

  return {
    get state() { return { B, F, flood, me, keeper, total, preview, awaitingRetry }; },
    update(dt, inp, { live, phase }) {
      t += dt;
      let ii = inp;
      // (a scripted player for the pictures and the checks: window.__cisternBot)
      if (live && globalThis.window?.__cisternBot) {
        const s = stoneUnder(me.pos.x, me.pos.z) ?? { x: -1, y: -1 };
        const m = botMove(B, F, s.x, s.y);
        ii = { x: 0, y: 0, jumpPressed: false, actionPressed: false, trigger: 0 };
        if (awaitingRetry || (F.planning && preview?.complete)) ii.trigger = valveHeld ? 0 : 1;
        else if (!F.planning) ii.trigger = 1;   // (and it hurries the water: the clock is short)
        if (m.to) {
          const p = stoneAt(m.to[0], m.to[1], _cw);
          const dx = p.x - me.pos.x, dz = p.z - me.pos.z, d = Math.hypot(dx, dz);
          if (s.x === m.to[0] && s.y === m.to[1] && d < 2.4) { if ((botCool -= dt) <= 0) { ii.jumpPressed = true; botCool = 0.3; } }
          else { ii.x = dx / Math.max(d, 1); ii.y = -dz / Math.max(d, 1); }
        }
      }
      // (the valve: RT / R2, or the keyboard's Shift; never the pad's L3, which runs: issue #788, "Pressing L3 shouldn't
      // start the game")
      const valveDown = Math.max(ii.trigger ?? 0, ii.shiftKey ? 1 : 0) > 0.3, valvePressed = valveDown && !valveHeld;
      valveHeld = valveDown; // Sample even while paused/counting down: holding cannot open the next flood.
      if (live && !ended) { played += dt; clockStep(); }
      const moving = live && !ended;
      const sp = moving ? walk(dt, ii) : walk(dt, { x: 0, y: 0 });
      if (moving && between <= 0) {
        if (awaitingRetry) {
          if (valvePressed) planAgain();
        } else {
          if (ii.jumpPressed) press(1);
          if (ii.actionPressed) press(-1);
          if (F.planning && valvePressed) { releaseFlow(F); refreshPreview(); }
          onEvents(flowStep(B, F, dt, { hurry: valveDown }));
        }
      }
      if (between > 0 && (between -= dt) <= 0 && live) begin(flood + 1);
      // the stones turn to their angles, the troughs fill, the puddles spread
      for (const g of stones) { const T = g.userData.turn; T.rotation.y += (g.userData.angle - T.rotation.y) * (1 - Math.exp(-18 * dt)); }
      for (const g of L.troughs) if (g.userData.water.visible && g.userData.fill < 1) { g.userData.fill = Math.min(1, g.userData.fill + dt / 1.2); g.userData.water.scale.set(0.05 + 0.95 * g.userData.fill, 1, 1); }
      for (const p of puddles) if (p.userData.grow < 1) { p.userData.grow = Math.min(1, p.userData.grow + dt / 1.5); p.scale.setScalar(0.3 + 1.9 * Math.sqrt(p.userData.grow)); }
      L.stream.material && (L.stream.scale.x = L.stream.scale.z = 1 + 0.06 * Math.sin(t * 23));
      drawWater();
      if (moving) drawWarnings(); else for (const w of warns) w.visible = false;
      // the frame round your stone: gold if it turns, red if not
      const s = stoneUnder(me.pos.x, me.pos.z);
      frame.visible = !!s && phase !== 'intro';
      if (s) {
        stoneAt(s.x, s.y, frame.position);
        const c = cellAt(B, s.x, s.y), ok = !c.fixed && !c.set && !underKeeper(s.x, s.y);
        for (const m of frame.children) m.material = ok ? mats.here : mats.no;
      }
      if (moving) moveKeeper(dt);
      placeKeeper(dt, t);
      splash.update(dt, _UP);
      words.update(dt);
      pose(dt, sp);
      updateCamera(dt);
      ctx.status(statusText());
    },
    end() {
      K.dispose();
      player._feetGround = feet0;
      disposeTree(splash.mesh);
      words.dispose();
      for (const o of [splash.mesh, frame, ...warns, ...puddles]) { const i = level.noShadow.indexOf(o); if (i >= 0) level.noShadow.splice(i, 1); }
      for (const o of L.troughs ?? []) disposeTree(o);
      L.troughs = [];
      L.stream.visible = false; L.basinWater.visible = false;
      for (const b of L.braziers) b.userData.flame.visible = false;
    },
  };
}

export default {
  id: 'cistern', order: 13,
  name: 'Cistern channels',
  blurb: 'Plan a path through the Givers’ channel stones, then open the valve and bring water to the Keeper before time runs out.',
  rules: 'Walk onto a stone to turn it. Teal channels show the water’s current route; red arrows show spills. Open the valve when the route is ready, and hold it to hurry the water. If a trough stays dry, drain and adjust the same board. Three floods (two troughs, three, four) in 5 minutes: out of time, try again. Hard starts the water automatically.',
  controls: {
    pad: [['Left stick', 'walk the stones'], ['A / ×', 'turn the stone clockwise'], ['X / □', 'turn it back'], ['RT / R2', 'open valve / drain and retry; hold to hurry'], ['Menu', 'pause']],
    keys: [['W A S D', 'walk the stones'], ['Space', 'turn the stone clockwise'], ['E', 'turn it back'], ['Shift', 'open valve / drain and retry; hold to hurry'], ['Esc', 'pause']],
    touch: [['Stick', 'walk'], ['⤒', 'turn the stone'], ['✺', 'open valve / retry; hold to hurry']],
  },
  touchButtons: ['jump', 'fire'],
  options: [{ id: 'level', label: 'Difficulty', choices: [['easy', 'Easy'], ['hard', 'Hard']], default: 'easy' }],
  bestBy: 'level',
  // (its sign in the desert: beside the Rose House's door, the side away from the path; its host Omar)
  markers: [{ level: 'desert', at: [479.9, null, 390.3], heading: 2.895 }],
  // (the Keeper's own run, from the Rose House: played in the desert's page, the court built here for it, far over the
  // world and clear of its rooms and halls (the house's at y 2400, the hall at 1000, the high box at 3000): kit/here.js,
  // issue #789, no loading screen either way)
  here: { desert: [-400, 2000, -900] },
  score: { kind: 'points', unit: 'pts' },
  // (the clock counts down the run's 5 minutes: TIME, issue #788)
  hud: { timer: true, countdown: TIME.limit, score: true, multiline: true },
  color: '#62c3c9',
  build: buildCourt,
  start,
};

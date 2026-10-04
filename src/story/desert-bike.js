import * as THREE from 'three';
import { registerInteractable, PRIORITY } from '../interact.js';
import { Banner } from '../life.js';
import { STORY } from '../desert-sites.js';
import { items } from '../items.js';
import { Paint, paintMaterial } from '../vehicle-kit.js';

// The desert's hoverbike isn't yours from the start. Marrow the salvager
// dragged it into a hollow between the ship and the camps (STORY.bike, the dip
// in desert-landmarks.js HOLLOWS) and threw a tarp over it; a red rag on a
// pole marks the place. Until it is found the bike lies there half in the
// sand (Hoverbike.rest: dormant, so no whistle, no "ride" prompt, nothing
// moves it). The quest desert.bike (desert-data.js) is started by Rook near
// the ship, by Marrow ("Got anything faster than walking?"), or once Nour has
// sent you on; it leads to Marrow, then to the hollow:
//
//   E on the tarp      pulls it back (desert.bike.uncovered)
//   E on the bike      with the backpack: the tank swings into its cradle,
//                      the bike lifts out of the sand and you're on it
//                      (desert.bike.found); without: "it runs on fluid"
//
// Flags: desert.bike.uncovered, desert.bike.found (the bike works as ever,
// in this save, for good), desert.bike.v (migrateBike ran),
// desert.marrow.bike (Marrow's word once it's found).

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const TARP = { w: 2.6, l: 4.2 };

/**
 * Old saves: before the bike had to be found, anyone with the backpack could
 * ride it. Those saves keep it (found), so nobody loses a bike they had; a
 * save without the backpack yet never rode it, and finds it like a new one.
 * (Saves from before items existed get the backpack from the boxes'
 * migration, which runs later: they count as having it.) Runs once per save.
 */
export function migrateBike(game) {
  if (game.flag('desert.bike.v')) return false;
  game.set('desert.bike.v', 1);
  const legacy = !!game.flag('prologue.done') && (game.flag('items.v') ?? 0) < 1;
  const had = !!game.flag('item.backpack') || !!game.flag('ship.powered') || legacy;
  if (had && !game.flag('desert.bike.found')) { game.set('desert.bike.found', true); return true; }
  return false;
}

/** Where the bike lies, its heading, and the hollow's props, in world space. */
export function hollowSite(ground) {
  const s = STORY.bike, h = (x, z) => ground.heightAt(x, z);
  const f = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw)), r = new THREE.Vector3(f.z, 0, -f.x);
  const at = (side, ahead) => { const p = new THREE.Vector3(s.x, 0, s.z).addScaledVector(r, side).addScaledVector(f, ahead); p.y = h(p.x, p.z); return p; };
  return { bike: at(0, 0), heading: s.yaw, pole: at(-2.6, -2.2), crates: [at(2.4, -1.6), at(2.9, -0.6)], heap: at(2.6, 1.4), f, r, at };
}

/** The tarp draped over the bike's shape, its skirt on the sand (vertex-coloured, two-sided). */
function tarpGeometry(site, ground) {
  const g = new THREE.PlaneGeometry(TARP.w, TARP.l, 10, 14).rotateX(-Math.PI / 2);
  const p = g.attributes.position, w = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    // over the bike: a long hump, the bars and the rudder poking up, slack folds in between
    const e = 1 - (x / 0.95) ** 2 - (z / 1.9) ** 2;
    let y = e > 0 ? 0.25 + 0.5 * Math.sqrt(e) : 0.25 * Math.max(0, 1 + e * 2.5);
    y = Math.max(y, 0.95 * Math.exp(-((Math.abs(x) - 0.5) ** 2 / 0.03 + (z - 0.55) ** 2 / 0.04)));
    y = Math.max(y, 1.05 * Math.exp(-(x ** 2 / 0.02 + (z + 1.5) ** 2 / 0.06)));
    y += Math.sin(x * 7 + z * 3) * 0.03 + Math.sin(z * 5.3) * 0.02;
    w.copy(site.at(x, z));
    p.setXYZ(i, w.x - site.bike.x, w.y - site.bike.y + y + 0.03, w.z - site.bike.z);
  }
  g.computeVertexNormals();
  const paint = new Paint();
  paint.add(g, '#b8864a');
  // a patch sewn on, and a rope across
  const patch = new THREE.PlaneGeometry(0.7, 0.6).rotateX(-Math.PI / 2).rotateY(0.4);
  const top = site.at(0.2, -0.3);
  paint.add(patch, '#5fb7ad', { at: [top.x - site.bike.x, top.y - site.bike.y + 0.8, top.z - site.bike.z] });
  return paint.geometry();
}

export function setupHoverbike(ctx) {
  const { level, player, quests, game, sound, toast, scene } = ctx;
  const ground = level.ground;
  migrateBike(game);
  const site = hollowSite(ground);
  const bike = player.mount?.kind === 'bike' ? player.mount : null;
  const found = () => !!game.flag('desert.bike.found');
  const uncovered = () => !!game.flag('desert.bike.uncovered') || found();

  // ---------------------------------------------------------------- the hollow's props
  const props = new Paint();
  const T = (p) => [p.x - site.bike.x, p.y - site.bike.y, p.z - site.bike.z];
  const pole = site.pole;
  props.add(new THREE.CylinderGeometry(0.05, 0.08, 6.4, 5), '#4a3a2a', { at: [T(pole)[0], T(pole)[1] + 3.1, T(pole)[2]] });
  for (const [i, c] of site.crates.entries()) props.add(new THREE.BoxGeometry(0.9 - i * 0.2, 0.6 - i * 0.1, 0.7), i ? '#c8483a' : '#d8a24a', { at: [T(c)[0], T(c)[1] + 0.25 - i * 0.05, T(c)[2]], rot: [0, site.heading + i * 0.6, 0.05] });
  // a spade stuck in the sand, and a drift of sand over the bike's near flank
  const sp = site.at(1.6, 0.9);
  props.add(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 4), '#4a3a2a', { at: [T(sp)[0], T(sp)[1] + 0.5, T(sp)[2]], rot: [0.3, 0, 0.25] });
  props.add(new THREE.BoxGeometry(0.22, 0.3, 0.03), '#8a96a8', { at: [T(sp)[0] - 0.08, T(sp)[1] + 0.02, T(sp)[2] - 0.12], rot: [0.3, 0, 0.25] });
  const drift = site.at(0.85, -0.2);
  props.add(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#e2c48e', { at: [T(drift)[0], T(drift)[1] - 0.12, T(drift)[2]], scale: [0.9, 0.24, 1.9], rot: [0, site.heading, 0] });
  const group = new THREE.Group();
  group.position.copy(site.bike);
  group.add(props.mesh({ smooth: true }));
  group.traverse((o) => { o.userData.noCollide = true; });
  scene.add(group);
  // the red rag on its pole: you see it from the dunes around
  const rag = new Banner(scene, pole.clone().add(new THREE.Vector3(0, 6.2, 0)), site.heading + Math.PI / 2, { width: 1.2, height: 1.8, color: '#c8483a', glyphs: false });

  // the tarp: draped over the bike until pulled back, then a heap beside it
  const tarp = new THREE.Mesh(tarpGeometry(site, ground), paintMaterial({ smooth: true, side: THREE.DoubleSide }));
  tarp.userData.noCollide = true;
  tarp.position.copy(site.bike);
  scene.add(tarp);
  const heap = { t: uncovered() ? 1 : 0, from: site.bike.clone(), to: site.heap.clone() };
  const placeTarp = (k) => {
    const e = THREE.MathUtils.smootherstep(k, 0, 1);
    tarp.position.lerpVectors(heap.from, heap.to, e);
    tarp.position.y += Math.sin(Math.PI * e) * 0.9 - e * 0.12;
    tarp.scale.set(1 - e * 0.45, 1 - e * 0.8, 1 - e * 0.55);
    tarp.rotation.y = e * 0.7;
  };
  placeTarp(heap.t);

  // the bike itself: dormant in the hollow until found
  if (bike && !found()) bike.rest(site.bike.x, site.bike.z, site.heading);
  game.on('flag:desert.bike.found', (v) => { if (v && bike?.dormant) bike.wake(); if (v && heap.t === 0) heap.t = 0.001; });

  // ---------------------------------------------------------------- the quest
  const marker = site.bike.clone().setY(site.bike.y + 0.6);
  quests.locate('bike', () => (bike && !bike.dormant ? bike.pos : marker));
  // (started on its own, it doesn't take the tracked objective from the main quest)
  const start = () => {
    if (found() || quests.isStarted('desert.bike')) return;
    const tracked = quests.tracked();
    quests.start('desert.bike');
    if (tracked) quests.track(tracked);
  };
  if (game.flag('desert.elder.heard')) start();
  game.on('flag:desert.elder.heard', (v) => { if (v) setTimeout(start, 2500); });   // (after Nour's own toasts)

  const pullTarp = () => {
    game.set('desert.bike.uncovered', true);
    heap.t = Math.max(heap.t, 0.001);
    sound.whoosh?.();
    // found before anyone told you of it: the errand picks up here
    const s = quests.stage('desert.bike');
    // (not when you could wake it this moment: no errand to hand you and take back at once)
    if ((s === undefined && !items.has('backpack')) || s === 'ask' || s === 'find') quests.set('desert.bike', 'wake');
    toast(items.has('backpack') ? 'A hoverbike, half in the sand, smelling of fluid. Its cradle is empty.' : 'A hoverbike, half in the sand. It won’t wake: it runs on fluid, and you have none.');
  };
  const wakeBike = () => {
    if (!items.has('backpack')) { toast('It runs on fluid, and your back is bare. Something in the city might hold some.'); return; }
    game.set('desert.bike.found', true);
    sound.chime?.();
    toast('The tank clicks into its cradle. The hoverbike hums awake: call it from anywhere (E, or X / □).');
    if (bike) setTimeout(() => { if (!player.ride && flat(player.pos, bike.pos) < 6) player.board?.(bike); }, 350);
  };
  registerInteractable({
    id: 'bike.tarp', priority: PRIORITY.use, range: 3.4,
    at: () => marker, enabled: () => !found(),
    prompt: () => (!uncovered() ? 'pull back the tarp' : items.has('backpack') ? 'wake the hoverbike' : 'look at the hoverbike'),
    distance: (p) => (Math.abs(p.pos.y - site.bike.y) < 4 ? flat(p.pos, site.bike) : Infinity),
    use: () => (!uncovered() ? pullTarp() : wakeBike()),
  });

  const update = (dt, t, camPos) => {
    if (heap.t > 0 && heap.t < 1) { heap.t = Math.min(1, heap.t + dt / 0.9); placeTarp(heap.t); }
    const d = flat(camPos, site.bike);
    rag.mesh.visible = d < 900;
    if (d < 220) rag.update(t);
  };
  return { site, tarp, rag, update, found, uncovered };
}

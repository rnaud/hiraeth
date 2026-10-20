import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { game as sharedGame } from './game-state.js';
import { items as sharedItems } from './items.js';
import { FRAGMENTS, fragKey, fragmentCounts, CHART_FLAG } from './fragments-data.js';
import { buildFragmentMarkers } from './fragment-markers.js';

// The fragments of the singing light (docs/systems/fragments.md, issue #196): small splinters of the light's song
// hidden in every world on the route (src/fragments-data.js), out of the way. Each floats a little over its spot,
// glows, and sings faintly when you are near (three soft notes of the light's theme, from where it is); walk into
// one and it is yours. The first brings the scientist (src/story/scientist.js); from then on he lives on the ship,
// counts them and sells his upgrades for them (src/fragment-shop.js: what you hold is what you found less what you
// spent). The cheapest is the finder (item `finder`): it beeps faster as a fragment comes closer, within FRAGMENT.finder.range.
//
//   createFragments({ levelId, scene, physics, level, player, sound, game, items, toast, lights })
//     → { list, update(dt, t), counts(), nearest(), take(i), finderOn(), dispose() }
//   fragmentCounts(flags)  → { found, total, worlds: { [world]: { found, total } } }  (pure: the menu, the scientist)
//   finderInterval(d)      → s between two beeps, a fragment d m away (null: out of range)
//
// The save: flags `frag.<world>.<i>` (found), `frag.finder.off` (the finder switched off from the items page).
// game.emit('fragment', { world, i, found, total, left }) after each.

export const FRAGMENT = {
  lift: 0.9,       // m over its spot
  take: 1.5,       // m: walk this close and it is yours
  sing: 26,        // m: it sings when you are this close
  singEvery: 3.4,  // s between its three notes
  finder: { range: 60, slow: 1.8, fast: 0.14 },   // the finder: beeps from `range` m, every `slow` s there, every `fast` s on top of it
  drawTo: 220,     // m: drawn this near (a splinter 0.6 m tall is a few pixels there); 24 a world since v1.70 (issue #317), not
                   // four draws each for every one in view across the world
};

export { fragKey, fragmentCounts };

/** Seconds between two of the finder's beeps with the nearest fragment `d` m away; null out of its range. */
export function finderInterval(d, F = FRAGMENT.finder) {
  if (!Number.isFinite(d) || d > F.range) return null;
  const k = Math.max(0, Math.min(1, d / F.range));
  return F.fast + (F.slow - F.fast) * k;   // (straight from fast to slow with the distance)
}

/** The finder's beep pitch (Hz): higher as it comes closer. */
export const finderPitch = (d, F = FRAGMENT.finder) => 1500 - 700 * Math.max(0, Math.min(1, d / F.range));

const UP = new THREE.Vector3(0, 1, 0);

/**
 * The Map's marks of Anselm's chart (issue #520: "A later unlock with Anselm should be to give me a map of all the light
 * fragments"): every fragment of this world still to find, { i, x, z }, once the chart is bought; none before (the Map
 * never shows one without it: docs/systems/ui.md, The Map).
 */
export function chartMarks(fragments, game = sharedGame) {
  if (!fragments?.list || !game?.flag?.(CHART_FLAG)) return [];
  return fragments.list.filter((f) => !f.found).map((f) => ({ i: f.i, x: f.pos.x, z: f.pos.z }));
}

/** The toast as one is taken: how many found so far, and nothing of how many there are (issue #519). */
export const fragmentToast = (found) => `A fragment of the singing light · ${found} found`;

/** The fragments of this world, made and hidden where they are. */
export function createFragments({ levelId, scene, physics = null, level = null, player, sound = null, game = sharedGame, items = sharedItems, toast = () => {}, lights = null }) {
  const spots = FRAGMENTS[levelId] ?? [];
  // (the props some stand on, where the world had no landmark left there: issue #550, src/fragment-markers.js)
  const markers = buildFragmentMarkers(scene, levelId, physics);
  const crystal = makeMaterial({ color: '#dff7ff', glow: 1, flat: true });
  const motes = makeMaterial({ color: '#ffffff', glow: 1 });
  const geo = new THREE.OctahedronGeometry(0.16, 0).scale(0.75, 1.9, 0.75);
  const moteGeo = new THREE.SphereGeometry(0.035, 6, 4);
  const list = spots.map(([x, y, z], i) => {
    // (on the ground there, if the ground has moved a little since the spot was written down)
    const g = physics?.groundAt?.(x, y + 1.5, z, 4);
    const pos = new THREE.Vector3(x, Number.isFinite(g) && Math.abs(g - y) < 0.8 ? g : y, z).addScaledVector(UP, FRAGMENT.lift);
    const grp = new THREE.Group();
    grp.name = `fragment.${levelId}.${i}`;
    grp.userData.noCollide = true;
    grp.userData.dynamic = true;
    const core = new THREE.Mesh(geo, crystal);
    grp.add(core);
    const orbit = new THREE.Group();
    for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(moteGeo, motes); m.position.set(Math.cos((k / 3) * Math.PI * 2) * 0.32, 0, Math.sin((k / 3) * Math.PI * 2) * 0.32); orbit.add(m); }
    grp.add(orbit);
    grp.position.copy(pos);
    const found = !!game.flag(fragKey(levelId, i));
    grp.visible = !found;
    scene?.add(grp);
    const light = new THREE.Vector4(pos.x, pos.y, pos.z, found ? 0 : 3);
    if (!found) lights?.push(light);
    return { i, pos, base: pos.y, grp, core, orbit, light, found, sungAt: -1e9 };
  });

  let beepAt = 0, clock = 0;
  const finderOn = () => items.has('finder') && !game.flag('frag.finder.off');
  const nearest = (at = player?.pos) => {
    let best = null, bd = Infinity;
    if (!at) return null;
    for (const f of list) { if (f.found) continue; const d = f.pos.distanceTo(at); if (d < bd) { bd = d; best = f; } }
    return best ? { f: best, d: bd } : null;
  };

  function take(i) {
    const f = list[i];
    if (!f || f.found) return null;
    f.found = true;
    f.grp.visible = false;
    if (lights) { const k = lights.indexOf(f.light); if (k >= 0) lights.splice(k, 1); }
    game.set(fragKey(levelId, i), true);
    const c = fragmentCounts(game.data?.flags ?? {}), here = c.worlds[levelId] ?? { left: list.filter((x) => !x.found).length };
    sound?.fragmentTaken?.({ pos: f.pos });
    sound?.musicCue?.('moment', { delay: 1.2 });
    // (how many found, never how many there are: issue #519, the author: "I shouldn't be able to tell how many fragments
    // of light there are in total")
    toast(fragmentToast(c.found));
    const e = { world: levelId, i, found: c.found, total: c.total, left: here.left };
    game.emit('fragment', e);
    return e;
  }

  return {
    list, nearest, take, finderOn,
    counts: () => fragmentCounts(game.data?.flags ?? {}),
    /** `quiet`: a conversation or a menu is up (main.js busy()): no finder's beep then (issue #231). */
    update(dt, t, { quiet = false } = {}) {
      clock += dt;
      const p = player?.pos;
      for (const f of list) {
        if (f.found) continue;
        // (out of drawing range: hidden, and nothing to turn)
        if (p) { const far = f.pos.distanceToSquared(p) > FRAGMENT.drawTo ** 2; f.grp.visible = !far; if (far) continue; }
        f.grp.position.y = f.base + Math.sin(t * 1.3 + f.i) * 0.07;
        f.core.rotation.y += dt * 0.8;
        f.orbit.rotation.y -= dt * 1.6;
        f.orbit.position.y = Math.sin(t * 2.1 + f.i) * 0.05;
        f.light.w = 2.6 + Math.sin(t * 3 + f.i) * 0.4;
        if (!p || player.hidden) continue;
        const dx = p.x - f.pos.x, dz = p.z - f.pos.z, dy = p.y + 0.9 - f.pos.y;
        if (Math.hypot(dx, dz) < FRAGMENT.take && Math.abs(dy) < 1.8) { take(f.i); continue; }
        // its song, faint, from where it is (three notes of the light's theme)
        const d = Math.hypot(dx, dy, dz);
        if (d < FRAGMENT.sing && clock - f.sungAt > FRAGMENT.singEvery) { f.sungAt = clock; sound?.fragmentSong?.(f.pos, 1 - d / FRAGMENT.sing); }
      }
      // the finder: a beep, faster as the nearest comes closer
      if (finderOn() && p && !player.hidden && !quiet) {
        const n = nearest(p), every = n ? finderInterval(n.d) : null;
        if (every != null && clock - beepAt >= every) { beepAt = clock; sound?.finderBeep?.(finderPitch(n.d)); }
      }
    },
    dispose() {
      for (const f of list) { f.grp.removeFromParent(); if (lights) { const k = lights.indexOf(f.light); if (k >= 0) lights.splice(k, 1); } }
      geo.dispose(); moteGeo.dispose();
      if (markers) { markers.removeFromParent(); markers.geometry.dispose(); }
    },
  };
}

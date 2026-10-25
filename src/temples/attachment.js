import * as THREE from 'three';
import { game as sharedGame } from '../game-state.js';
import { items } from '../items.js';
import { TempleRuntime } from './runtime.js';
import { templeVista } from './vistas.js';
import { templeLight } from './kit.js';
import { KEYS, colourScript } from '../timeofday.js';
import { runSteps } from '../load-steps.js';
import { attachCourt } from '../finds/courts.js';
import { partOf } from '../levels/names.js';

// Registry-free runtime wiring: callers supply their own temple entry.
export const TEMPLE_HOME = { garage: 'glassdunes' };
export const templeWorld = (id) => TEMPLE_HOME[id] ?? partOf(id);

/** Build a temple (by its id: the world it was made for) into a level and join it to the level's hooks. */
export function attachTempleDefinition(id, T, scene, level, { game = sharedGame } = {}) {
  if (!T || !level) return level;
  const rt = new TempleRuntime({ scene, level, def: T.def, game, items });
  addTemple(level, rt);
  // (first in the list: a level's own doorways keep their places at its end, where its story and tests look)
  (level.portals ??= []).unshift(...rt.portals);
  // (the scout and the quest marker route through the temple's door like any doorway)
  // A level with a list of its own, in another shape (the Hangar's gravity portals, { pos, to, toUp, toFwd },
  // which the level's own update walks to send you through): the temple's doorways join a copy of it, in that
  // shape, so whatever reads the list (the scout, the flora, the reactive world, the wildlife) reads them alike,
  // and the level's own list (level.garage.portals, its update's) is left as it was.
  if (level.navigationPortals && level.navigationPortals !== level.portals) level.navigationPortals = [...rt.portals.map(navigationPortal), ...level.navigationPortals];
  // the ground round the building is kept clear: no tree, rock or tuft of the world's own grows through it
  const keep = rt.outside?.clear ?? [];
  const site = T.def.site;
  const vista = site ? templeVista(site) : () => false;
  if (keep.length) {
    clearInstances(scene, keep, rt.root);
    const avoid = level.floraAvoid;
    level.floraAvoid = (x, z, r = 0) => vista(x, z, r) || keep.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r) || !!avoid?.(x, z, r);
  }
  // Background passers-by leave the forecourt open; named keepers and quest actors keep their places.
  const crowdSpots = level.crowdSpots;
  if (crowdSpots && site) level.crowdSpots = (...args) => {
    const spots = crowdSpots.apply(level, args);
    // The market's listening square is part of the broadcast quest, beside the Undertower.
    return { ...spots, clear: [...(spots.clear ?? []), { x: site.x, z: site.z, r: id === 'bazaar' ? 24 : 76 }] };
  };
  const init = level.init, initSteps = level.initSteps, dynamic = level.dynamic, update = level.update;
  // (in steps when the level's own are: src/load-steps.js; init runs them straight through)
  level.initSteps = function* (physics, o) { if (initSteps) yield* initSteps.call(level, physics, o); else init?.call(level, physics); rt.init(physics); };
  level.init = (physics) => runSteps(level.initSteps(physics));
  level.dynamic = () => { const base = dynamic ? dynamic.call(level) : []; return base.length ? [...base, ...rt.solids()] : rt.solids(); };
  level.update = function (dt, t, o = {}) {
    update?.call(level, dt, t, o);
    if (o.fade) rt.fadeFn ??= o.fade;
    rt.change?.late?.(dt, t);   // (after the level's own movers: a change may move what they move)
  };
  // the house's own light inside (its palette's `light`: kit.js templeLight): the colour script handed over with the
  // air while the traveller is in its rooms, as the Lab's rooms hand theirs (main.js updateSky); a house in a skin may
  // bring its own (rt.skin.light: src/temples/skins/whale-house.js)
  const light = rt.skin?.light ?? T.def.palette?.light;
  if (light && level.atmo) {
    const script = templeLight(level.sky?.script ? colourScript(level.sky.script) : KEYS, light), atmo = level.atmo, p = new THREE.Vector3();
    rt.lightScript = script;
    level.atmo = (x, z, y = 0, ...rest) => { const a = atmo.call(level, x, z, y, ...rest); return rt.inside(p.set(x, y, z)) ? { ...a, script, ...(light.fog !== undefined ? { fog: light.fog } : {}) } : a; };
  }
  // the world's makers' court: a box with its gadget, and what that gadget is for round it (src/finds/courts.js;
  // by the temple's world, or its part: a moved temple's court went with it)
  attachCourt(TEMPLE_HOME[id] ?? id, scene, level, { clear: clearInstances });
  return level;
}

/**
 * A temple runtime joins a level's list. With one, level.temple is it; with more (a merged world), level.temple is
 * the one the traveller is inside (each knows him once its story is connected), else the world's own (its id the
 * level's), else the first.
 */
export function addTemple(level, rt) {
  const list = (level.temples ??= []);
  list.push(rt);
  if (list.length === 1) { level.temple = rt; return; }
  Object.defineProperty(level, 'temple', {
    configurable: true, enumerable: true,
    get: () => list.find((t) => t.player && t.inside(t.player.pos)) ?? list.find((t) => t.id === level.id) ?? list[0],
    set: (v) => { if (v && !list.includes(v)) list.push(v); },
  });
}
/** A level's temple by its id (null if it has none). */
export const templeOf = (level, id) => level?.temples?.find((t) => t.id === id) ?? (level?.temple?.id === id ? level.temple : null);

/** A temple doorway in the shape of a level's own navigation portals (pos, toUp, toFwd: src/levels/garage.js). */
export function navigationPortal(p) {
  return { ...p, pos: p.at.clone(), toUp: p.toUp?.clone() ?? new THREE.Vector3(0, 1, 0), toFwd: new THREE.Vector3(Math.sin(p.heading ?? 0), 0, Math.cos(p.heading ?? 0)) };
}

/**
 * Walk-through instanced things a world scatters (trees, rocks, tufts: InstancedMesh, noCollide or not) whose
 * instances stand inside one of the circles [{ x, z, r }] are scaled to nothing (the temple stands there now).
 * Returns how many.
 */
export function clearInstances(scene, circles, except = null) {
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), w = new THREE.Matrix4();
  let n = 0;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isInstancedMesh || o.userData.dynamic) return;
    for (let q = o; q; q = q.parent) if (q === except) return;
    let changed = false;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      w.multiplyMatrices(o.matrixWorld, m);
      p.setFromMatrixPosition(w);
      if (!circles.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r)) continue;
      const e = m.elements;   // (scaled to nothing where it stood: its bounds stay where they were)
      e[0] = e[1] = e[2] = e[4] = e[5] = e[6] = e[8] = e[9] = e[10] = 0;
      o.setMatrixAt(i, m);
      changed = true; n++;
    }
    if (changed) o.instanceMatrix.needsUpdate = true;
  });
  return n;
}

/** Where the marker points inside a temple: the next thing to do (logic.next), else the arrival. */
export function nextSpot(rt) {
  // in the arena, while it is awake: it
  if (rt.guardian?.awake) return rt.guardian.model.pos.clone();
  const id = rt.logic.next();
  const e = id && rt.logic.el(id);
  if (e?.type === 'gadget' && rt.gadgetSite) return new THREE.Vector3(...rt.gadgetSite.at);
  if (e?.type === 'find' && rt.findSites?.[id]) return new THREE.Vector3(...rt.findSites[id].at);
  if (e?.type === 'boss' && rt.guardian) return rt.guardian.model.pos.clone();
  // an arena not won yet: the middle of its room (its mark's room)
  const arena = e?.type === 'arena' && rt.def.arenas?.find((A) => A.el === id);
  if (arena) return rt.kit.world(...arena.zone.min.map((v, i) => (v + arena.zone.max[i]) / 2)).setY(rt.kit.world(0, arena.zone.min[1] + 1, 0).y);
  const p = id && rt.piece(id);
  const at = p?.center ?? p?.pos ?? p?.group?.position;
  if (at) return at.clone();
  if (rt.logic.resolved) return rt.doorOut?.clone() ?? rt.arrival.pos.clone();
  return rt.arrival.pos.clone();
}

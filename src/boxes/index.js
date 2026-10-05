import * as THREE from 'three';
import { game as sharedGame } from '../game-state.js';
import { items, ITEMS } from '../items.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { buildBox, buildBeacon, BOX, BOX_COLORS, BOX_SCALE } from './model.js';
import { BoxScene } from './scene.js';
import { BoxCard } from './card.js';
import { PLACEMENTS, FALLBACKS, FALLBACK_OFFSETS } from './placements.js';
import { migrateTemples } from '../temples/migrate.js';

// Item boxes: the makers' chests (docs/story-bible.md, "The boxes"). Dark blue,
// carved with rings of the glyph, a pale star on the lid, each holding one
// item (src/items.js), left long ago for a traveller who comes a long way.
// They notice you: the star and the carvings brighten, light leaks from the
// lid's seam, the box hums and, close up, shudders. E opens one: the opening
// scene (scene.js: it lifts off the ground and comes apart into light), then the
// item is yours. An opened box is gone for good.
//
//   const boxes = createBoxes({ levelId, scene, physics, level, player, sound, quests, toast, cam, anchor });
//   boxes.update(dt, t, { camera })   per frame, after the player (it poses the kneel) and before the ship (camera)
//   boxes.busy()                      the opening scene is playing (input is cut, the HUD hidden)
//   boxes.list                        this world's boxes: { id, item, pos, yaw, spent(), opened() }
//   boxes.open(id, { instant })       open one (instant: no scene; tests and the dev menu)
//   boxes.skip()                      Esc / B: jump to the card, or past it
//   boxes.reset() / boxes.openAll()   every box closed again / every box opened (dev menu)
//   boxes.journalHtml()               "Boxes found n/m" per world, for the sketchbook
//
// Placement: src/boxes/placements.js (a table keyed by level id). Fallbacks:
// a world that needs an item you don't have (the jetpack worlds; the backpack
// everywhere but the desert) puts a box with it beside the ship's ramp.
//
// Flags (game-state.js): box.<id> = true once opened; items.v = 2 once the
// save has been migrated (migrateSave). Events: 'box:opened' { id, item, level }.
// Quest locators: 'box.<id>' (the desert's 'box' stage points at the ledge's box).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const smoothstep = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * Old saves. v1, from before items existed: anyone who finished the prologue
 * had the backpack on from the start. Rule: prologue.done and no item.<id> flag
 * of any registry item → grant the backpack. Returns true if it did.
 * v2, the backpack's box moved from the crash site into Qanat's shrine (same
 * id): whoever already carries the backpack finds that box open (and counted
 * as found), so the shrine never offers it again. The desert's quest stages
 * have their own migration (src/story/desert.js, migrateDesertQuest).
 */
export function migrateSave(g = sharedGame) {
  const v = g.flag('items.v') ?? 0;
  let legacy = false;
  if (v < 1) {
    legacy = !!g.flag('prologue.done') && !Object.keys(ITEMS).some((id) => g.flag(`item.${id}`) !== undefined);
    if (legacy) g.set('item.backpack', true);
  }
  if (v < 2) {
    if (g.flag('item.backpack') && !g.flag('box.desert.backpack')) g.set('box.desert.backpack', true);
    g.set('items.v', 2);
  }
  // the gadgets that moved into the temples: whoever carries one already finds its temple chest open
  migrateTemples(g);
  return legacy;
}

/** Where a placement stands: { pos (on the ground), yaw } or null if there is no ground there. */
export function resolvePlacement(p, { physics, level, anchor = null }) {
  let x, z, fromY, exact = false;
  if (typeof p.site === 'function') {
    // a spot the level builds (Qanat's ledge on the tree): { at: [x, y, z], face }
    const s = p.site(level);
    if (!s) return null;
    p = { ...p, ...s, site: null };
    exact = true;   // (built to fit the box: leave it where the level put it)
  }
  if (p.near) {
    // beside the ship's ramp (or the spawn): try a few offsets until one is on level ground
    const a = anchor ?? { pos: level.spawn, heading: level.spawnHeading ?? 0 };
    const h = a.heading ?? 0, f = V(Math.sin(h), 0, Math.cos(h)), r = V(-f.z, 0, f.x);
    for (const [ox, oz] of FALLBACK_OFFSETS[p.slot ?? 0]) {
      const c = a.pos.clone().addScaledVector(r, ox).addScaledVector(f, oz);
      const g = physics.groundAt(c.x, a.pos.y + 3, c.z, 8);
      if (!Number.isFinite(g) || Math.abs(g - a.pos.y) > 1.6) continue;
      const n = physics.groundNormal?.(c.x, g + 1, c.z);
      if (n && n.y < 0.85) continue;
      c.y = g;
      return { pos: c, yaw: Math.atan2(a.pos.x - c.x, a.pos.z - c.z) };
    }
    return null;
  }
  [x, z] = [p.at[0], p.at[p.at.length - 1]];
  fromY = p.at.length === 3 ? p.at[1] + 2 : 1e4;
  const g = physics.groundAt(x, fromY, z, p.at.length === 3 ? 8 : 2e4);
  if (!Number.isFinite(g)) return null;
  // the front faces `face` (a heading), or back toward where you come from
  const toward = p.toward ?? [level.spawn.x, level.spawn.z];
  const yaw = p.face ?? Math.atan2(toward[0] - x, toward[1] - z);
  if (p.lift || exact) return { pos: V(x, g + (p.lift ?? 0), z), yaw };
  const s = settle(physics, x, z, g, yaw);
  return { pos: V(s.x, s.y, s.z), yaw };
}

/**
 * A box's spot made good: on the edge of a ledge or a boulder, one corner of
 * the footprint hangs in the air (and another digs in on a slope). Look
 * within a metre or so, on the same level, for where all four corners meet
 * the ground; on a gentle slope, sit it down a little so the low corner touches.
 */
export function settle(physics, x, z, g, yaw, { reach = 1.2 } = {}) {
  const hw = (BOX.w / 2) * BOX_SCALE, hd = (BOX.d / 2) * BOX_SCALE, c = Math.cos(yaw), s = Math.sin(yaw);
  const corners = (cx, cz, gy) => {
    let lo = Infinity, hi = -Infinity;
    for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
      const h = physics.groundAt(cx + lx * c + lz * s, gy + 1, cz - lx * s + lz * c, 3);
      if (!Number.isFinite(h)) return null;
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    return { lo, hi };
  };
  let best = null;
  const tryAt = (cx, cz, d) => {
    const gc = d ? physics.groundAt(cx, g + 1, cz, 3) : g;
    if (!Number.isFinite(gc) || Math.abs(gc - g) > 0.6) return false;
    const k = corners(cx, cz, gc);
    if (!k) return false;
    const spread = Math.max(k.hi, gc) - Math.min(k.lo, gc), score = spread + d * 0.05;
    if (!best || score < best.score) best = { x: cx, z: cz, y: gc - Math.min(Math.max(0, gc - k.lo - 0.05), 0.12), score, spread };   // (down a little on a slope)
    return spread <= 0.08;
  };
  if (tryAt(x, z, 0)) return best;
  for (let r = 0.3; r <= reach + 1e-6; r += 0.3) {
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; if (tryAt(x + Math.cos(a) * r, z + Math.sin(a) * r, r)) return best; }
  }
  return best ?? { x, z, y: g };
}

/** This world's placements, with the fallbacks it needs right now. */
export function placementsFor(levelId, { level, has = (id) => items.has(id), table = PLACEMENTS } = {}) {
  const list = (table[levelId] ?? []).map((p) => ({ ...p }));
  for (const fb of FALLBACKS) {
    if (!fb.when({ levelId, level })) continue;
    if (has(fb.item)) continue;
    if (list.some((p) => p.item === fb.item)) continue;   // the world has its own box with it
    list.push({ id: `${levelId}.${fb.item}`, item: fb.item, near: 'ship', slot: fb.slot, fallback: true, beacon: true });
  }
  return list;
}

export function createBoxes({ levelId, scene, physics, level, player, sound = null, quests = null, toast = () => {}, cam = null, anchor = null, game: g = sharedGame, table = PLACEMENTS, quiet = () => false }) {
  const lights = level.lights ?? (level.lights = []);
  const noShadow = level.noShadow ?? (level.noShadow = []);
  // beacons hang off one always-visible group (noShadow re-shows its members after the shadow passes)
  const fx = new THREE.Group();
  fx.name = 'Box beacons';
  scene?.add(fx);
  noShadow.push(fx);
  const card = new BoxCard({ onDismiss: () => api.dismiss(), onSkip: () => api.skip() });
  const ground = (x, z, fromY) => { const y = physics.groundAt(x, fromY, z, 6); return Number.isFinite(y) ? y : NaN; };
  let current = null;   // the playing BoxScene
  const list = [];
  const offs = [];

  const opened = (b) => !!g.flag(`box.${b.id}`);
  // a world's own box is spent once opened, or once you have its item anyway; a fallback only while you have it
  const spent = (b) => (b.fallback ? items.has(b.item) : opened(b) || items.has(b.item));

  function build() {
    const anc = typeof anchor === 'function' ? anchor() : anchor;
    for (const p of placementsFor(levelId, { level, table })) {
      if (!ITEMS[p.item]) continue;
      const at = resolvePlacement(p, { physics, level, anchor: anc });
      if (!at) { console.warn(`box ${p.id}: no ground at its placement`); continue; }
      const parts = buildBox(p.id);
      parts.root.position.copy(at.pos);
      parts.root.rotation.y = at.yaw;
      parts.root.scale.setScalar(BOX_SCALE);
      scene?.add(parts.root);
      const b = {
        id: p.id, item: p.item, def: ITEMS[p.item], pos: at.pos, yaw: at.yaw, parts, place: p, fallback: !!p.fallback, scene, noShadow,
        light: new THREE.Vector4(0, -1e5, 0, 0), near: 0, shake: 0, glow: 0, sceneLight: 0, phase: Math.random() * 6,
        spent: () => spent(b), opened: () => opened(b),
      };
      lights.push(b.light);
      // solid: an invisible block the size of the body (you can stand on it)
      const S = BOX_SCALE, block = new THREE.Mesh(new THREE.BoxGeometry((BOX.w + 0.04) * S, (BOX.h + BOX.lid) * S, (BOX.d + 0.04) * S).translate(0, ((BOX.h + BOX.lid) * S) / 2, 0));
      block.position.copy(at.pos); block.rotation.y = at.yaw;
      b.collider = physics.addCollider?.(block) ?? null;
      // a pale column over it, seen from afar: always for the boxes you must find, for the rest with the glyph lens
      b.beacon = buildBeacon(p.id);
      b.beacon.position.copy(at.pos).add(V(0, 0.6 * BOX_SCALE, 0));
      b.beacon.visible = false;
      b.alwaysBeacon = !!p.beacon;
      b.beaconMax = typeof p.beacon === 'number' ? p.beacon : Infinity;   // (a number: only within that many metres, unless the lens shows it)
      fx.add(b.beacon);
      noShadow.push(parts.raysWrap);
      b.off = registerInteractable({
        id: `box.${p.id}`, priority: PRIORITY.use + 1, range: 3.2,
        prompt: 'open',
        at: () => (b._at ??= V()).set(b.pos.x, b.pos.y + 0.6 * BOX_SCALE + 0.5, b.pos.z),
        enabled: () => !spent(b) && !current && !player?.riding,
        distance: (pl) => (Math.abs(pl.pos.y - b.pos.y) < 2 ? flat(pl.pos, b.pos) : Infinity),
        use: () => api.open(b.id),
      });
      quests?.locate?.(`box.${p.id}`, () => b.pos);
      setSpentLook(b, spent(b));
      list.push(b);
    }
  }

  function setSpentLook(b, isSpent) {
    const P = b.parts;
    P.lid.rotation.z = 0;
    P.glowFloor.visible = false;
    P.rays.visible = false;
    P.mats.star.uniforms.uGlow.value = isSpent ? 0.12 : 0.35;
    P.mats.carve.uniforms.uGlow.value = isSpent ? 0.04 : 0.12;
    P.mats.seam.uniforms.uColor.value.set(BOX_COLORS.band);
    P.mats.seam.uniforms.uGlow.value = 0;
    b.light.set(0, -1e5, 0, 0);
    if (b.beacon) b.beacon.visible = false;
    b.isSpent = isSpent;
    // opened, it came apart into light: gone, and nothing to bump into (a fallback box
    // you no longer need goes the same way)
    P.root.visible = !isSpent;
    if (isSpent && b.collider) { physics.removeCollider?.(b.collider); b.collider = null; }
  }

  function dispose() {
    for (const b of list) {
      b.parts.root.removeFromParent(); b.beacon?.removeFromParent();
      b.off?.();
      if (b.collider) physics.removeCollider?.(b.collider);
      const i = lights.indexOf(b.light); if (i >= 0) lights.splice(i, 1);
      const j = noShadow.indexOf(b.parts.raysWrap); if (j >= 0) noShadow.splice(j, 1);
    }
    list.length = 0;
  }

  // keep the look in step with the items (the dev menu, a grant elsewhere)
  offs.push(items.on(() => { for (const b of list) if (b !== current?.box && spent(b) !== b.isSpent) setSpentLook(b, spent(b)); }));

  // ------------------------------------------------------------------ the bell's call (src/boxes/effects.js sounds it)
  offs.push(g.on('bell', ({ pos, reach = 90, soft = false } = {}) => {
    for (const b of list) {
      if (spent(b) || !pos) continue;
      const d = flat(pos, b.pos) + (soft ? Math.max(0, Math.abs(pos.y - b.pos.y) - 6) : 0);   // (the shell hears only what is near, up and down too)
      if (d > reach) continue;
      b.answer = { at: 0.4 + d / 60, k: soft ? 0.5 : 1 };
      setTimeout(() => sound?.boxAnswer?.(Math.max(0.2, 1 - d / 90) * (soft ? 0.45 : 1)), (0.4 + d / 60) * 1000);
    }
  }));

  // ------------------------------------------------------------------ the boxes' own quests
  // Each hidden box (with a hint) is a small quest in the sketchbook: it starts a few seconds after
  // you arrive while the box is still shut, its step says where to look, tracking it sends the scout
  // there, and opening the box finishes it (the flag box.<id>).
  const boxQuests = [];
  function defineQuests() {
    if (!quests?.define) return;
    for (const b of list) {
      if (b.fallback || !b.place.hint) continue;
      const id = `box.${b.id}`;
      if (!quests.def?.(id)) quests.define({ id, title: b.place.title ?? 'A Makers’ Box', world: levelId, outro: `${b.def.name}: yours.`, background: true,   // (offered on arrival: it doesn't take the scout from the quest you are on)
        stages: [{ id: 'find', text: b.place.hint, label: 'The makers’ box', flag: `box.${b.id}`, at: `box.${b.id}` }] });
      boxQuests.push({ b, id });
    }
  }
  let questClock = 0, questsOffered = false;
  function offerQuests(dt) {
    if (questsOffered || !quests?.start) return;
    if (quiet()) return;   // (not over a scene or a recording: the clock starts once they are over)
    if ((questClock += dt) < BOX_QUEST_DELAY || current) return;
    questsOffered = true;
    let n = 0;
    for (const { b, id } of boxQuests) if (!spent(b) && !quests.isStarted?.(id)) { quests.start(id); n++; }
    if (n) toast('Someone left a makers’ box in this world. Your sketchbook says where to look.');
  }

  const api = {
    list,
    card,
    /** The ids of this world's box quests. */
    get quests() { return boxQuests.map((q) => q.id); },
    busy: () => !!current,
    get scene() { return current; },
    open(id, { instant = false } = {}) {
      const b = list.find((x) => x.id === id);
      if (!b || current) return false;
      const grant = () => {
        items.grant(b.item);
        g.set(`box.${b.id}`, true);
      };
      const finish = () => {
        b.justOpened = true;
        setSpentLook(b, true);
        g.emit('box:opened', { id: b.id, item: b.item, level: levelId });
      };
      if (instant || !player) { grant(); finish(); return true; }
      if (spent(b)) return false;
      sound?.boxHum?.(0);
      current = new BoxScene({ box: b, def: b.def, item: b.item, player, cam, sound, card, groundAt: ground, physics,
        onGrant: grant,
        onEnd: () => { current = null; finish(); } });
      current.start();
      return true;
    },
    skip() { current?.skip(); },
    dismiss() { return current?.dismiss() ?? false; },
    reset() {
      for (const k of Object.keys(g.data?.flags ?? {})) if (k.startsWith('box.')) g.set(k, undefined);
      api.rebuild();
    },
    openAll() {
      for (const p of Object.values(table).flat()) { if (ITEMS[p.item]) { items.grant(p.item); g.set(`box.${p.id}`, true); } }
      for (const b of list) { b.justOpened = true; setSpentLook(b, true); }
    },
    rebuild() { if (current) current.end(); dispose(); build(); boxQuests.length = 0; defineQuests(); },
    /** Boxes found / placed per world (the table's own boxes; fallbacks don't count). */
    counts() {
      const out = {};
      for (const [id, ps] of Object.entries(table)) out[id] = { found: ps.filter((p) => g.flag(`box.${p.id}`)).length, total: ps.length };
      return out;
    },
    journalHtml(titles = {}) {
      const c = api.counts();
      const rows = Object.entries(c).filter(([, v]) => v.total).map(([id, v]) => `<li class="${v.found >= v.total ? 'done' : ''}">${titles[id] ?? id} · boxes found ${v.found}/${v.total}</li>`).join('');
      const found = Object.values(c).reduce((s, v) => s + v.found, 0), total = Object.values(c).reduce((s, v) => s + v.total, 0);
      return `<section class="quests boxes"><h2>Item boxes <span>${found}/${total}</span></h2><ul>${rows}</ul></section>`;   // (what they held: the Gear section at the top, items.js gearHtml)
    },
    update(dt, t, { camera } = {}) {
      // the reactions: star, seam, light, hum, shudder
      let hum = 0;
      const pp = player?.pos;
      for (const b of list) {
        const P = b.parts, M = P.mats;
        const playing = current?.box === b;
        if (!P.root.visible) continue;
        const d = pp ? flat(pp, b.pos) + Math.max(0, Math.abs(pp.y - b.pos.y) - 2) : Infinity;
        if (playing) {
          // the scene drives the lid; the box pours light
          const k = b.sceneLight;
          M.seam.uniforms.uColor.value.set(BOX_COLORS.seam); M.seam.uniforms.uGlow.value = 1;
          M.star.uniforms.uGlow.value = 0.6 + 0.4 * k;
          M.carve.uniforms.uGlow.value = 0.45 + 0.55 * k;
          b.light.set(b.pos.x, P.root.position.y + 0.5 * BOX_SCALE, b.pos.z, 3 + 8 * k);   // (the scene moves and turns the box)
          if (b.beacon) b.beacon.visible = false;
          continue;
        }
        if (b.isSpent) continue;
        const near = (b.near = smoothstep(22, 3.2, d));
        hum = Math.max(hum, near);
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + b.phase);
        M.star.uniforms.uGlow.value = 0.35 + 0.65 * near * (0.55 + 0.45 * pulse);
        // the carved glyph rings wake a moment after the star, a little out of step with it
        M.carve.uniforms.uGlow.value = 0.12 + 0.6 * smoothstep(0.15, 1, near) * (0.6 + 0.4 * Math.sin(t * 3.2 + b.phase - 0.8));
        const seam = near * (0.45 + 0.55 * Math.sin(t * 4.1 + b.phase) ** 2);
        M.seam.uniforms.uColor.value.set(BOX_COLORS.band).lerp(_c.set(BOX_COLORS.seam), Math.min(1, seam * 1.4));
        M.seam.uniforms.uGlow.value = seam;
        b.light.set(b.pos.x, b.pos.y + 0.7 * BOX_SCALE, b.pos.z, near > 0.01 ? 1.8 + 5 * near * (0.8 + 0.2 * pulse) : 0);
        // close up it shudders, in little fits, the lid knocking
        let shake = 0;
        if (d < 5.5) {
          const cyc = (t + b.phase) % 1.7;
          shake = cyc < 0.32 ? Math.sin(cyc / 0.32 * Math.PI) * smoothstep(5.5, 2.2, d) : 0;
        }
        if (b.answer) { b.answer.at -= dt; if (b.answer.at <= 0) { shake = Math.max(shake, b.answer.k); b.answer.k -= dt * 2; if (b.answer.k <= 0) b.answer = null; } }
        P.root.rotation.set(Math.sin(t * 47) * 0.02 * shake, b.yaw + Math.sin(t * 31) * 0.025 * shake, Math.sin(t * 53) * 0.02 * shake);
        P.lid.rotation.z = Math.max(0, Math.sin(t * 23)) * 0.06 * shake;
        // the beacon: from afar (always for the boxes that must be found, with the lens for all)
        if (b.beacon) {
          const lens = items.has('lens');
          const on = ((b.alwaysBeacon && d < b.beaconMax) || lens) && d > 9;
          b.beacon.visible = on;
          // (thicker far off, so it stays a few pixels wide at any distance)
          if (on) { const w = THREE.MathUtils.clamp(d * 0.03, 1, 12) * smoothstep(9, 22, d); b.beacon.scale.set(w, 36, w); }
        }
      }
      sound?.boxHum?.(current ? 0 : hum);
      offerQuests(dt);
      if (current) current.update(dt);
      void camera;
    },
    dispose() { dispose(); for (const f of offs) f(); offs.length = 0; },
  };
  build();
  defineQuests();
  return api;
}
/** Seconds after you arrive before a world's box quests start (the landing and the first page come first). */
export const BOX_QUEST_DELAY = 8;
const _c = new THREE.Color();

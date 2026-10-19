import * as THREE from 'three';
import { game as sharedGame } from '../game-state.js';
import { items, ITEMS } from '../items.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { buildBox, buildBeacon, chestKind, BOX, BOX_SCALE, RAY_PASS } from './model.js';
import { BoxScene, CARD_MIN } from './scene.js';
import { Veils } from '../veil.js';
import { BoxCard } from './card.js';
import { PLACEMENTS, FALLBACKS, FALLBACK_OFFSETS } from './placements.js';
import { partsOf, shiftAt } from '../levels/names.js';
import { migrateTemples } from '../temples/migrate.js';
import { HUM } from '../story/hum.js';
import { hintsFor } from '../hint-level.js';
import { buildLock, lockFlag, LOCK_SEALED } from './locks.js';

// Item boxes: the makers' chests (docs/story-bible.md, "The boxes"), the same in every world (model.js, chest.js):
// a rounded cream shell with the makers' star on its top, a brass band and a jade lens in its front; in the temples,
// a bud of white stone and gold. A ray of light forever travels across each; each holds one item (src/items.js),
// left long ago for a traveller who comes a long way. They notice you: the star and the lens brighten, the ray
// quickens, the chest hums and, close up, shudders. E opens one: the opening scene (scene.js: it floats up, wobbles
// two or three times like a caught thing deciding, parts like petals with jade light rising, and comes apart into
// light), then the item is yours. An opened chest stays where it stood, open (issue #223).
//
// Nothing speaks of the boxes before you find your first one yourself
// (boxesFound): no box quests, no toast, no "Item boxes" page in the sketchbook.
//
//   const boxes = createBoxes({ levelId, scene, physics, level, player, sound, quests, toast, cam, anchor });
//   boxes.update(dt, t, { camera })   per frame, after the player (it poses the kneel) and before the ship (camera)
//   boxes.busy()                      the opening scene is playing (input is cut, the HUD hidden)
//   boxes.list                        this world's boxes: { id, item, pos, yaw, spent(), opened() }
//   boxes.open(id, { instant })       open one (instant: no scene; tests and the dev menu)
//   boxes.skip()                      Esc / B: jump to the card, or past it
//   boxes.announce({ name, text })    a find's card with no scene (a temple's map, its great key: event 'temple:found')
//   boxes.reset() / boxes.openAll()   every box closed again / every box opened (dev menu)
//   boxes.journalHtml()               "Boxes found n/m" per world, for the sketchbook ('' before the first)
//
// Placement: src/boxes/placements.js (a table keyed by level id). Fallbacks:
// a world that needs an item you don't have (the jetpack worlds; the backpack
// everywhere but the desert) puts a box with it beside the ship's ramp.
//
// Flags (game-state.js): box.<id> = true once opened; items.v = 2 once the
// save has been migrated (migrateSave). Events: 'box:opened' { id, item, level }.
// Quest locators: 'box.<id>' (the desert's 'box' stage points at the box on Qanat's dais).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _up = new THREE.Vector3(0, 1, 0);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const smoothstep = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * Has the traveller found a makers' box yet (any box opened, a temple's chest too)? Until then
 * nothing tells of them: their quests wait, and the sketchbook has no page for them.
 */
export function boxesFound(g = sharedGame) {
  for (const [k, v] of Object.entries(g.data?.flags ?? {})) if (v === true && k.startsWith('box.')) return true;
  return false;
}

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
  // (issue #421: the engines' builds never ran this until v1.83, so a new save there finished the prologue with no
  // items.v, and src/story/desert-bike.js migrateBike took it for a save from before the items and gave it the
  // hoverbike: awake by the ship's spawn, nothing under the tarp, no quest. Such a save carries migrateBike's mark
  // without this one's, which a page always writes first. It is no old save: no backpack is granted, and a bike
  // "found" whose tarp was never pulled back goes back under it.)
  const engineMade = v < 1 && g.flag('desert.bike.v') !== undefined;
  if (engineMade && g.flag('desert.bike.found') && !g.flag('desert.bike.uncovered')) g.set('desert.bike.found', false);
  if (v < 1 && !engineMade) {
    // (the sword and the shield don't count: src/save-migrate.js step 12 gives them to every old save, before this runs)
    legacy = !!g.flag('prologue.done') && !Object.keys(ITEMS).some((id) => id !== 'sword' && id !== 'shield' && g.flag(`item.${id}`) !== undefined);
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
    // a spot the level builds (Qanat's dais at the tree's foot): { at: [x, y, z], face }
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

/** A part's placement where it stands in its world (a merged world moves a part's places: src/levels/names.js PART_OFFSET). */
export const shiftPlacement = (part, p) => ({ ...p, ...(p.at ? { at: shiftAt(part, p.at) } : {}), ...(p.toward ? { toward: shiftAt(part, p.toward) } : {}) });

/** This world's placements (its parts': a merged world has two tables), with the fallbacks it needs right now. */
export function placementsFor(levelId, { level, has = (id) => items.has(id), table = PLACEMENTS } = {}) {
  const list = partsOf(levelId).flatMap((part) => (table[part] ?? []).map((p) => shiftPlacement(part, p)));
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
  // (the light out of an opening chest is washes over the finished picture: src/boxes/light.js; a level without any
  // gets its Veils here, before main.js binds them)
  level.veils ??= new Veils();
  // beacons hang off one always-visible group (noShadow re-shows its members after the shadow passes)
  const fx = new THREE.Group();
  fx.name = 'Box beacons';
  scene?.add(fx);
  noShadow.push(fx);
  const card = new BoxCard({ onDismiss: () => api.dismiss(), onSkip: () => api.skip() });
  const ground = (x, z, fromY) => { const y = physics.groundAt(x, fromY, z, 6); return Number.isFinite(y) ? y : NaN; };
  let current = null;   // the playing BoxScene
  // a temple's find announced on the box's card, no scene (issue #486: the house's map, its great key): { t, done }
  let told = null;
  const endTold = () => { const d = told?.done; told = null; card.scene(false); d?.(); };
  const list = [];
  const offs = [];
  offs.push(g.on('temple:found', (e) => { if (e && !e.shown && api.announce(e)) e.shown = true; }));

  const opened = (b) => !!g.flag(`box.${b.id}`);
  // a world's own box is spent once opened, or once you have its item anyway; a fallback only while you have it
  const spent = (b) => (b.fallback ? items.has(b.item) : opened(b) || items.has(b.item));
  // a placement may wait for something first (`ready(game, items)`: the lift valve's chest, till the pool has filled your tank;
  // a small lock beside it, `lock`, till it is answered: src/boxes/locks.js, issue #518)
  const ready = (b) => (!b.place.ready || !!b.place.ready(g, items)) && (!b.place.lock || !!g.flag(lockFlag(b.id)));

  function build() {
    const anc = typeof anchor === 'function' ? anchor() : anchor;
    for (const p of placementsFor(levelId, { level, table })) {
      if (!ITEMS[p.item]) continue;
      const at = resolvePlacement(p, { physics, level, anchor: anc });
      if (!at) { console.warn(`box ${p.id}: no ground at its placement`); continue; }
      const parts = buildBox(p.id, { kind: chestKind(p) });   // (the same chest in every world: the temples' own kind, the makers' everywhere else)
      parts.root.position.copy(at.pos);
      parts.root.rotation.y = at.yaw;
      parts.root.scale.setScalar(BOX_SCALE);
      scene?.add(parts.root);
      const b = {
        id: p.id, item: p.item, def: ITEMS[p.item], pos: at.pos, yaw: at.yaw, parts, place: p, fallback: !!p.fallback, scene, noShadow,
        light: new THREE.Vector4(0, -1e5, 0, 0), near: 0, shake: 0, glow: 0, sceneLight: 0, phase: Math.random() * 6,
        spent: () => spent(b), opened: () => opened(b), ready: () => ready(b),
      };
      lights.push(b.light);
      // solid: an invisible block the size of the body (you can stand on it)
      const S = BOX_SCALE, Z = parts.size, block = new THREE.Mesh(new THREE.BoxGeometry((Z.w + 0.04) * S, Z.h * S, (Z.d + 0.04) * S).translate(0, (Z.h * S) / 2, 0));
      block.position.copy(at.pos); block.rotation.y = at.yaw;
      b.collider = physics.addCollider?.(block) ?? null;
      // a pale column over it, seen from afar: always for the boxes you must find, for the rest with the glyph lens
      b.beacon = buildBeacon(p.id);
      b.beacon.position.copy(at.pos).add(V(0, 0.6 * BOX_SCALE, 0));
      b.beacon.visible = false;
      b.alwaysBeacon = !!p.beacon;
      b.beaconMax = typeof p.beacon === 'number' ? p.beacon : Infinity;   // (a number: only within that many metres, unless the lens shows it)
      fx.add(b.beacon);
      b.off = registerInteractable({
        id: `box.${p.id}`, priority: PRIORITY.use + 1, range: 3.2,
        prompt: 'open',
        at: () => (b._at ??= V()).set(b.pos.x, b.pos.y + (parts.size.h + 0.1) * BOX_SCALE + 0.5, b.pos.z),
        enabled: () => !spent(b) && !current && !player?.riding && parts.root.visible,   // (a chest only the lens shows: not till seen, src/boxes/locks.js)
        distance: (pl) => (Math.abs(pl.pos.y - b.pos.y) < 2 ? flat(pl.pos, b.pos) : Infinity),
        // (a box that waits for something first, the placement's `ready`: shut and quiet till then, its `sealed` said on E)
        use: () => (ready(b) ? api.open(b.id) : (toast(p.sealed ?? LOCK_SEALED[p.lock?.tool] ?? 'The chest is shut fast, and silent.'), sound?.boxAnswer?.(0.15))),
      });
      // its small lock beside it (src/boxes/locks.js, issue #518)
      if (p.lock) b.lock = buildLock(b, p.lock, { scene, physics, game: g, sound, player });
      quests?.locate?.(`box.${p.id}`, () => b.pos);
      setSpentLook(b, spent(b));
      list.push(b);
    }
  }

  function setSpentLook(b, isSpent) {
    const P = b.parts;
    const A = P.mats.body.uniforms.uBoxA.value;   // (z, the star's reach, is the chest's own)
    A.x = isSpent ? 0 : 0.6; A.y = isSpent ? 0.12 : 0.35; A.w = b.phase;
    b.light.set(0, -1e5, 0, 0);
    if (b.beacon) b.beacon.visible = false;
    b.isSpent = isSpent;
    // opened, it stays where it stood, open and quiet, its halves parted (issue #223: it came apart into light until
    // then, and was gone); a box spent without being opened (a fallback you no longer need, an item you had anyway)
    // goes, with nothing left to bump into
    const open = isSpent && opened(b) && !b.fallback;
    P.setOpen?.(open ? 1 : 0);
    P.root.visible = !isSpent || open;
    if (open) { P.root.position.set(b.pos.x, b.pos.y, b.pos.z); P.root.quaternion.setFromAxisAngle(_up, b.yaw); P.root.scale.setScalar(BOX_SCALE); }
    for (const m of Object.values(P.mats ?? {})) m.uniforms?.uDissolve?.value.set(0, 0.09, 0, 0);
    for (const c of P.root.children) c.visible = true;
    // (and nothing to bump into: the block the closed chest stood as would be solid where the parted halves leave air, and
    //  what you stand on is what is drawn; the halves lie low on the ground)
    if (isSpent && b.collider) { physics.removeCollider?.(b.collider); b.collider = null; }
  }

  function dispose() {
    for (const b of list) {
      b.parts.root.removeFromParent(); b.beacon?.removeFromParent();
      b.off?.();
      if (b.collider) physics.removeCollider?.(b.collider);
      b.lock?.dispose();
      const i = lights.indexOf(b.light); if (i >= 0) lights.splice(i, 1);
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
  // there, and opening the box finishes it (the flag box.<id>). Not before you have found a box of
  // your own (boxesFound): then they start a few seconds after that first one opens.
  // Since issue #273 they are given: the local of the box's part's temple (who knows the makers' things) gives them as
  // they give the temple's quest, saying where each is (boxLine), or when you next talk to them once your first box is
  // found (src/story/quests.js givenBy). A box opened before anyone gave its quest is that quest done, quietly. A
  // world with no such local, or a save that had been here before the givers (`givers.old.<part>`: src/save-migrate.js
  // step 26), offers them on arrival as before.
  const boxQuests = [];
  const part = (b) => String(b.id).split('.')[0];
  const giverFor = (b) => quests?.giverOf?.(`temple.${part(b)}`) ?? quests?.givers?.find?.((x) => x.rank === 0) ?? null;
  const offered = (b) => !giverFor(b) || !!g.flag(`givers.old.${part(b)}`);
  function defineQuests() {
    if (!quests?.define) return;
    for (const b of list) {
      if (b.fallback || !b.place.hint) continue;
      const id = `box.${b.id}`;
      if (!quests.def?.(id)) quests.define({ id, title: b.place.title ?? 'A Makers’ Box', world: levelId, outro: `${b.def.name}: yours.`, background: true,   // (it doesn't take the scout from the quest you are on)
        stages: [{ id: 'find', text: b.place.hint, label: 'The makers’ box', flag: `box.${b.id}`, at: `box.${b.id}` }] });
      boxQuests.push({ b, id });
      const giver = !offered(b) && giverFor(b);
      if (giver) quests.givenBy(id, giver.who, { at: giver.at, label: giver.label, ready: () => boxesFound(g) && !spent(b), line: (k) => boxLine(b.place.hint, k) });
    }
  }
  let questClock = 0, questsOffered = false;
  function offerQuests(dt) {
    if (questsOffered || !quests?.start) return;
    if (quiet()) return;   // (not over a scene or a recording: the clock starts once they are over)
    if (!boxesFound(g)) { questClock = 0; return; }   // (nothing about the boxes before the first is found)
    if ((questClock += dt) < BOX_QUEST_DELAY || current) return;
    questsOffered = true;
    let n = 0;
    for (const { b, id } of boxQuests) if (offered(b) && !spent(b) && !quests.isStarted?.(id)) { quests.start(id); n++; }
    if (n && hintsFor('tip')) toast(n > 1 ? 'More makers’ boxes in this world: the menu’s Quests page says where.' : 'Another makers’ box in this world: the menu’s Quests page says where.');
  }

  const api = {
    list,
    card,
    /** The ids of this world's box quests. */
    get quests() { return boxQuests.map((q) => q.id); },
    busy: () => !!current || !!told,
    /**
     * A find's card without a scene (a temple's map or great key, pieces.js Key announce): its name and its line, the
     * button to go on, as a box's card (CARD_MIN before a press counts). `done` once it is put away. False if a box is
     * opening (the caller says it its own way).
     */
    announce({ name, text, done = null } = {}) {
      if (current || told || !name) return false;
      told = { t: 0, done };
      card.scene(true);
      card.show({ name }, { found: text ?? null });
      return true;
    },
    /** The announced card's state (tests): { t } while it is up. */
    get told() { return told; },
    get scene() { return current; },
    open(id, { instant = false } = {}) {
      const b = list.find((x) => x.id === id);
      if (!b || current) return false;
      const grant = () => {
        items.grant(b.item);
        g.set(`box.${b.id}`, true);
        // (found before anyone gave its quest: that quest is done, on the Quests page's finished list; issue #273)
        const qid = `box.${b.id}`;
        if (quests?.def?.(qid) && !quests.isStarted?.(qid)) g.set(`quest.${qid}`, 'done');
      };
      const finish = () => {
        b.justOpened = true;
        questClock = 0;   // (the world's other boxes are offered a few seconds after this one)
        setSpentLook(b, true);
        g.emit('box:opened', { id: b.id, item: b.item, level: levelId });
      };
      if (instant || !player) { grant(); finish(); return true; }
      if (spent(b)) return false;
      sound?.boxHum?.(0);
      // (the finders' closing beat turns him toward the nearest box still shut)
      const pointAt = () => list.filter((x) => x !== b && !spent(x)).sort((x, y) => flat(x.pos, b.pos) - flat(y.pos, b.pos))[0]?.pos ?? null;
      // (`dry`: the backpack comes out of the desert's chest empty, until the giant's pool fills it: shown so, issue #58)
      const dry = typeof b.place?.dry === 'function' ? !!b.place.dry(g) : !!b.place?.dry;
      current = new BoxScene({ box: b, def: b.def, item: b.item, player, cam, sound, card, groundAt: ground, physics, pointAt, dry, veils: level.veils,
        onGrant: grant,
        onEnd: () => { current = null; finish(); } });
      current.start();
      return true;
    },
    skip() { if (told) endTold(); else current?.skip(); },
    dismiss() {
      if (told) { if (told.t < CARD_MIN) return false; endTold(); return true; }
      return current?.dismiss() ?? false;
    },
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
      if (!boxesFound(g)) return '';   // (no page for them before the first is found)
      const c = api.counts();
      const rows = Object.entries(c).filter(([, v]) => v.total).map(([id, v]) => `<li class="${v.found >= v.total ? 'done' : ''}">${titles[id] ?? id} · boxes found ${v.found}/${v.total}</li>`).join('');
      const found = Object.values(c).reduce((s, v) => s + v.found, 0), total = Object.values(c).reduce((s, v) => s + v.total, 0);
      return `<section class="quests boxes"><h2>Item boxes <span>${found}/${total}</span></h2><ul>${rows}</ul></section>`;   // (what they held: the game menu's Items panel; the counts show on its Worlds panel, src/game-menu-data.js)
    },
    update(dt, t, { camera } = {}) {
      // the reactions: star, seam, light, hum, shudder
      let hum = 0, far = 0;   // (far: the hum itself, heard from further off: src/story/hum.js)
      const pp = player?.pos;
      for (const b of list) if (b.lock && !b.isSpent) b.lock.update(dt, t);
      for (const b of list) {
        const P = b.parts, M = P.mats;
        const playing = current?.box === b;
        if (!P.root.visible) continue;
        const d = pp ? flat(pp, b.pos) + Math.max(0, Math.abs(pp.y - b.pos.y) - 2) : Infinity;
        if (playing) {
          // the scene moves the box, winds its ray and sets its lamp (scene.js lightFrame: the light out of it)
          if (b.beacon) b.beacon.visible = false;
          continue;
        }
        if (b.isSpent) continue;
        // (not ready yet: dark and still, no hum, no shudder, no beacon)
        if (!ready(b)) { b.near = 0; b.light.set(0, -1e5, 0, 0); if (b.beacon) b.beacon.visible = false; P.root.rotation.set(0, b.yaw, 0); const A0 = M.body.uniforms.uBoxA.value; A0.x = 0.25; A0.y = 0.05; continue; }
        const near = (b.near = smoothstep(22, 3.2, d));
        hum = Math.max(hum, near);
        far = Math.max(far, smoothstep(HUM.reach, 4, d));
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + b.phase);
        // the star and the glyphs brighten; the ray of light crosses it more often, and brighter
        const A = M.body.uniforms.uBoxA.value;
        A.x = 0.6 + 0.4 * near;
        A.y = 0.35 + 0.65 * near * (0.55 + 0.45 * pulse);
        A.w += dt / THREE.MathUtils.lerp(RAY_PASS.far, RAY_PASS.near, near);
        b.glow = A.y;
        b.light.set(b.pos.x, b.pos.y + 0.7 * BOX_SCALE, b.pos.z, near > 0.01 ? 1.8 + 5 * near * (0.8 + 0.2 * pulse) : 0);
        // close up it shudders, in little fits, the lid knocking
        let shake = 0;
        if (d < 5.5) {
          const cyc = (t + b.phase) % 1.7;
          shake = cyc < 0.32 ? Math.sin(cyc / 0.32 * Math.PI) * smoothstep(5.5, 2.2, d) : 0;
        }
        if (b.answer) { b.answer.at -= dt; if (b.answer.at <= 0) { shake = Math.max(shake, b.answer.k); b.answer.k -= dt * 2; if (b.answer.k <= 0) b.answer = null; } }
        P.root.rotation.set(Math.sin(t * 47) * 0.02 * shake, b.yaw + Math.sin(t * 31) * 0.025 * shake, Math.sin(t * 53) * 0.02 * shake);
        // the beacon: from afar (always for the boxes that must be found, with the lens for all)
        if (b.beacon) {
          const lens = items.has('lens');
          const on = ((b.alwaysBeacon && d < b.beaconMax) || lens) && d > 9;
          b.beacon.visible = on;
          // (thicker far off, so it stays a few pixels wide at any distance)
          if (on) { const w = THREE.MathUtils.clamp(d * 0.03, 1, 12) * smoothstep(9, 22, d); b.beacon.scale.set(w, 36, w); }
        }
      }
      sound?.boxHum?.(current ? 0 : hum, current ? 0 : far);
      offerQuests(dt);
      if (told) told.t += dt;
      if (current) current.update(dt, camera);   // (play's lens, where the rig has it: a hand-back near it blends, scene.js)
    },
    dispose() { if (told) endTold(); dispose(); for (const f of offs) f(); offs.length = 0; },
  };
  build();
  defineQuests();
  return api;
}
/** Seconds after you arrive before a world's box quests start (the landing and the first page come first). */
export const BOX_QUEST_DELAY = 8;

/**
 * What the one who gives a box's quest says of it (issue #273): the first of a talk's boxes, then "and one…", with its
 * hint for the place (its first letter made small: "On the needle spire" → "on the needle spire").
 */
export function boxLine(hint, k = 0) {
  const where = String(hint ?? '').replace(/^./, (c) => c.toLowerCase());
  return k ? `~neutral~ And one *${where}*.` : `~curious~ The makers left chests out in the open too. One *${where}*.`;
}

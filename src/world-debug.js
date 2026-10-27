// The dev menu's world: what it gathers and where a teleport sets you down (docs/systems/dev-tools.md "The dev menu";
// issue #387). The menu itself is src/dev-menu.js on the page and engine/menus.js's 'dev' sheet in the engines; both
// draw the tabs devTabs() makes here, so the web and Unity show the same rows:
//
//   World        this world's name and its key places: the ship (or the start), the makers' temples, the fight
//                temple, a few landmarks (keyPlaces: picked from what the world has, no list kept per world)
//   Cheats       the frame readout, god mode (fly anywhere fast, nothing hurts, through walls: src/player.js GOD),
//                endless potions, full hearts, the fluid jets
//   then one tab a kind of place (every point gatherPoints finds: the landing, the quests' markers, the people,
//                the temple's rooms, the shops, the sights, the runs, the doors and named places, the finds),
//                Cinematics, Quest stage, Notes, Toggles (the hitboxes, the input display, the time of day),
//   and the old dev menu's: Items, Story (the boxes, the story's switches, motion matching), Travel (the worlds)
//
// The gathering, the landing and the tabs are pure (gatherPoints, landingSpot, godLanding, questJump, cinematicsFor,
// keyPlaces, devTabs, DevNav): main.js and engine/game.js feed them their live objects; tests/world-debug.test.js,
// tests/world-debug-worlds.test.js and tests/dev-menu.test.js feed them built worlds.

import * as THREE from 'three';
import { TRIALS, trialsFor } from './trials/data.js';
import { kitTrialsFor } from './trials/kit-data.js';
import { SITES, STORY } from './desert-sites.js';
import { CINEMATICS } from './cinematics-page/catalog.js';
import { partsOf, shiftAt } from './levels/names.js';
import { SHIP_MODELS } from './ship/selection.js';

/** The kinds of place, in the order the menu shows them: [key, title, its line]. */
export const KINDS = [
  ['landing', 'Landing', 'the ship and where the world starts'],
  ['quest', 'Quests', 'every stage of this world\'s quests, where its marker stands'],
  ['people', 'People', 'who lives here'],
  ['temple', 'Temple', 'its door, a mark in each room, its guardian'],
  ['shop', 'Shops', 'outside the door, and at the counter'],
  ['sight', 'Sights', 'the level design\'s things to stop for, its beacons and leading lines'],
  ['run', 'Runs & trials', 'the trial, the makers\' runs and court'],
  ['place', 'Places', 'doors into rooms, caves and halls, and named places'],
  ['find', 'Finds', 'the makers\' boxes and the relics'],
];

/** A point as [x, y, z] (y null: on the ground there), from a Vector3, an array ([x, z] too), { x, z }, { at } or { pos }. */
export function xyz(p) {
  if (p == null) return null;
  if (p.isVector3) return [p.x, p.y, p.z];
  if (Array.isArray(p)) {
    if (p.length === 2) return [+p[0], null, +p[1]];
    return [+p[0], Number.isFinite(+p[1]) && p[1] !== null && typeof p[1] !== 'string' ? +p[1] : null, +p[2]];
  }
  if (Number.isFinite(p.x) && Number.isFinite(p.z)) return [p.x, Number.isFinite(p.y) ? p.y : null, p.z];
  if (p.at) return xyz(p.at);
  if (p.pos) return xyz(p.pos);
  return null;
}
const finite = (a) => !!a && Number.isFinite(a[0]) && Number.isFinite(a[2]) && (a[1] === null || Number.isFinite(a[1]));
const list = (v) => (typeof v === 'function' ? v() : v) ?? [];
/** A room id as words ('firesFar' → 'fires far'). */
export const words = (id) => String(id ?? '').replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/[._-]+/g, ' ').toLowerCase();

/**
 * The world's points of interest (pure on what it is given; every source is optional):
 * [{ kind, label, hint, pos: [x, y|null, z], heading?, room?, exact? }]. `room`: in a room off the map or the
 * temple; `exact`: a spot made for standing on (an arrival, a mark), landed on as it is.
 * `key`: what keyPlaces picks it for (ship, start, temple, fight, goal, beacon, sight).
 * @param w { levelId, level, quests, npcs, boxes, relics, ship, content, games }  (games: src/minigames GAMES, their signs)
 */
export function gatherPoints(w) {
  const { levelId, level = {}, quests = null, npcs = [], boxes = null, relics = null, ship = null, content = null, games = [] } = w;
  const out = [];
  const temples = (level.temples?.length ? level.temples : [level.temple]).filter(Boolean);
  const inTemple = (v) => temples.some((t) => { try { return !!t.inside?.(v); } catch { return false; } });
  const ground = (x, z) => { try { const h = level.ground?.heightAt?.(x, z); return Number.isFinite(h) ? h : null; } catch { return null; } };
  const inRoom = (a) => {
    if (a[1] === null) return false;
    if (inTemple(new THREE.Vector3(a[0], a[1], a[2]))) return true;
    return a[1] > 1200 || rooms.some((r) => Math.hypot(r.x - a[0], r.y - a[1], r.z - a[2]) < 120);
  };
  // the rooms off the map: where the doors lead, far over the ground (as main.js finds them for the interior culler)
  const rooms = (level.portals ?? []).filter((p) => p.to && !p.toUp && p.to.y - (ground(p.to.x, p.to.z) ?? p.to.y) > 200).map((p) => p.to);
  const put = (kind, label, p, o = {}) => {
    const pos = xyz(p);
    if (!finite(pos)) return;
    const room = o.room ?? inRoom(pos);
    out.push({ kind, label: String(label), hint: o.hint ?? '', pos, ...(Number.isFinite(o.heading) ? { heading: o.heading } : {}), ...(room ? { room: true } : {}), ...(o.exact ? { exact: true } : {}), ...(o.q ? { q: o.q } : {}), ...(o.key ? { key: o.key } : {}), ...(o.face ? { face: true } : {}) });
  };
  // the landing: the ship's ramp (or where the world starts)
  const arrival = (() => { try { return ship?.arrivalSpot?.() ?? null; } catch { return null; } })();
  if (arrival?.pos) put('landing', 'the ship', arrival.pos, { hint: 'at the foot of its ramp', heading: arrival.heading, key: 'ship' });
  else if (level.ship?.pos) put('landing', 'the ship', level.ship.pos, { hint: 'where it lands', key: 'ship' });
  if (level.spawn) put('landing', 'the start', level.spawn, { hint: 'where the world starts (no ship)', heading: level.spawnHeading, key: 'start' });
  // the quests: each stage where its marker stands (main quests first, then the rest)
  if (quests?.defs) {
    const defs = [...quests.defs.values()].filter((d) => !d.world || d.world === levelId).sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0));
    for (const d of defs) {
      const now = quests.stage?.(d.id);
      d.stages.forEach((s, i) => {
        let p = null;
        try { p = quests.where(s); } catch { p = null; }
        put('quest', s.label ?? s.text ?? s.id, p, { hint: `${d.title ?? d.id} · stage ${i + 1} of ${d.stages.length}${now === s.id ? ' · now' : ''}`, q: `${d.id} ${s.id}` });
      });
    }
  }
  // the people (the crowd's pooled walkers are not people to find)
  const seen = new Set();
  for (const n of npcs ?? []) {
    const d = n?.def;
    if (n?.pooled || !d || !(d.name || d.id) || seen.has(d.id ?? d.name)) continue;
    seen.add(d.id ?? d.name);
    put('people', d.name ?? d.id, n.pos, { hint: d.title ?? '', q: d.id });
  }
  // the temples (a merged world has its parts'): outside each door, inside it, each room's mark, the guardian's arena
  for (const rt of temples) {
    const name = rt.def?.name ?? 'the temple';
    const D = rt.outside?.door;
    if (rt.doorOut) put('temple', `outside ${name}`, rt.doorOut, { hint: 'its door', heading: D ? D.heading + Math.PI : undefined, room: false, key: 'temple' });
    if (rt.arrival?.pos) put('temple', temples.length > 1 ? `inside ${name}` : 'inside the door', rt.arrival.pos, { hint: name, heading: rt.arrival.heading, room: true, exact: true });
    for (const m of rt.marks ?? []) put('temple', `the ${words(m.room)} room`, m.spot ?? m.pos, { hint: `${name} · its mark`, heading: m.heading, room: true, exact: true, q: m.room });
    if (rt.gadgetSite?.at) put('temple', 'the gadget\'s chest', rt.gadgetSite.at, { hint: name, room: true });
    const A = rt.guardian?.arena;
    if (A?.center) {
      const a = xyz(A.center), to = xyz(rt.arrival?.pos) ?? [a[0], a[1], a[2] + 1];
      const dx = to[0] - a[0], dz = to[2] - a[2], d = Math.hypot(dx, dz) || 1, r = (A.r ?? 8) * 0.7;
      put('temple', 'the guardian\'s arena', [a[0] + (dx / d) * r, A.y ?? a[1], a[2] + (dz / d) * r], { hint: `${name} · at its edge`, heading: Math.atan2(-dx, -dz), room: true });
    }
  }
  // the games' signs in this world (a merged world's parts' too): the fight temple's door with the temples, the rest with the runs
  for (const g of games ?? []) for (const m of g.markers ?? []) {
    if (!partsOf(levelId).includes(m.level)) continue;
    const at = shiftAt(m.level, m.at);
    if (g.fightTemple) put('temple', `fight temple: ${g.name}`, at, { hint: 'its door (a fight of many foes)', room: false, key: 'fight', face: true });
    else put('run', `game: ${g.name}`, at, { hint: 'its sign', room: false, face: true });
  }
  // the shops: outside the door (where its way out lands) and at the counter
  for (const s of level.shops ?? []) {
    const name = s.label ?? s.def?.name ?? 'the shop';
    const pp = s.portals ?? [];
    const out0 = pp.find((p) => p.toUp)?.to ?? pp[0]?.at;
    if (out0) put('shop', `outside ${name}`, out0, { hint: s.def?.keeper ? `${s.def.keeper}'s` : 'its door', room: false });
    if (s.counter?.at) put('shop', `${name}: the counter`, s.counter.at, { hint: 'inside', heading: Math.PI, room: true });
  }
  // the level design's sights, beacons and leading lines (scripts/level-design/audit.mjs reads the same)
  for (const s of list(level.sights)) put('sight', s.name, s.at, { hint: 'a thing to stop for', key: 'sight', face: true });
  for (const b of list(level.beacons)) { const t = xyz(b.top); if (t) put('sight', b.name, [t[0], t[1] - (b.height ?? 0), t[2]], { hint: 'a beacon (at its foot)', key: 'beacon', face: true }); }
  for (const l of list(level.lines)) if (l.points?.length) put('sight', `${l.name}: its start`, l.points[0], { hint: 'a leading line' });
  // the runs: the world's trial, the makers' runs, the makers' court
  for (const T of trialsFor(levelId)) put('run', `trial: ${T.name}`, T.start ?? T.marker, { hint: T.blurb ?? '', heading: T.heading });
  for (const K of kitTrialsFor(levelId)) put('run', `makers' run: ${K.name}`, K.origin, { hint: K.blurb ?? '', heading: K.yaw });
  for (const C of Object.values(level.finds?.courts ?? (level.finds?.court ? { one: level.finds.court } : {}))) put('run', 'the makers\' court', C.at ?? C.box ?? C.frame?.origin, { hint: 'a court and its box' });
  // the places: the doors into rooms, caves and halls (outside, and inside), the story's goal, named places
  for (const pt of level.portals ?? []) {
    if (pt.temple || !pt.at || pt.toUp || /shop/i.test(pt.label ?? '')) continue;
    const label = pt.label ?? 'a way in';
    put('place', label, pt.at, { hint: 'outside', room: false });
    if (pt.to) put('place', `${label}: inside`, pt.to, { hint: 'where it comes out', heading: pt.heading, exact: true });
  }
  const goal = content?.story?.goal;
  if (goal) put('place', content.story.label ?? 'the story\'s goal', goal, { hint: content.story.title ?? '', key: 'goal', face: true });
  if (levelId === 'desert') {
    for (const [k, s] of Object.entries(STORY)) if (s.y === undefined) put('place', `the ${words(k)}`, s, { hint: 'the desert\'s story' });
    for (const [k, s] of Object.entries(SITES)) put('place', `the ${words(k)}`, s, { hint: 'a landmark' });
  }
  // the finds: the makers' boxes and the relics left
  for (const b of boxes?.list ?? []) put('find', `box: ${b.item ?? b.id}`, b.pos ?? b.at, { hint: b.opened ? 'opened' : b.hint ?? 'a makers\' box', q: b.id });
  for (const r of relics?.items ?? []) if (!r.done) put('find', `relic: ${relics.names?.[r.i] ?? r.i + 1}`, r.pos, { hint: 'a relic' });
  return out;
}

/** The points by kind, in KINDS' order, only the kinds with something in them: [{ key, title, line, points }]. */
export function groupPoints(points) {
  return KINDS.map(([key, title, line]) => ({ key, title, line, points: points.filter((p) => p.kind === key) })).filter((g) => g.points.length);
}

const UP = new THREE.Vector3(0, 1, 0);
/**
 * Where to stand at (or near) a point (pure on `physics`): { pos: [x, y, z], heading?, ok }. On solid ground within
 * reach of the point's height (anywhere under it, when it has none), with room to stand, out of the doorways' discs
 * (a door would send you through: main.js portals), over the world's floor (killY). `exact` spots (a temple's mark,
 * a door's far side) are taken as they are, set down on their floor. ok false: nothing found, the point itself.
 */
export function landingSpot(physics, point, { portals = [], killY = -Infinity, radius = 9, below = false } = {}) {
  const [px, py, pz] = point.pos;
  const known = py !== null;
  const clearOfDoors = (x, y, z) => !portals.some((p) => p?.at && Math.hypot(p.at.x - x, p.at.z - z) < (p.r ?? 1.5) + 1.4 && Math.abs((p.at.y ?? y) - y) < 4);
  const floor = (x, z, drop) => {
    // (from a little over the point: under a low ceiling, not on the roof over it)
    const g = known ? physics.groundAt(x, py + 1.2, z, drop + 1.2) : physics.groundAt(x, 1e4, z, 2e4);
    return Number.isFinite(g) && g > killY + 0.5 ? g : null;
  };
  const roomy = (x, g, z) => !physics.rayDistance || physics.rayDistance(new THREE.Vector3(x, g + 0.3, z), UP, 1.9) >= 1.6;
  const ring = (r0, r1, step) => { const t = []; for (let r = r0; r <= r1; r += step) for (let a = 0; a < Math.PI * 2 - 1e-6; a += Math.PI / 6) t.push([Math.sin(a) * r, Math.cos(a) * r]); return t; };
  // first close by and near its height; then (a point in the air: a beacon's foot, a floating light, a mast's
  // top) wider, and anything under it within 60 m; last, the nearest floor within 60 m round it (tiles over the cloud)
  // (`below`: straight down first, however far: god mode let go over the ground, godLanding)
  // (`face`: a thing to look at, a sign, a beacon's foot: a few metres off it, facing it, not on it)
  const near = point.face ? ring(3.6, radius + 3.6, 1.2) : [[0, 0], ...ring(1.2, radius, 1.2)];
  const passes = point.exact ? [{ tries: [[0, 0]], drop: 6 }] : [...(below ? [{ tries: [[0, 0]], drop: 1e4 }] : []), { tries: near, drop: 6 }, { tries: ring(radius + 2, radius + 14, 3), drop: 60 }, { tries: near, drop: 60 }, { tries: ring(radius + 16, 60, 5), drop: 120 }];
  for (const { tries, drop } of passes) for (const [dx, dz] of tries) {
    const x = px + dx, z = pz + dz, g = floor(x, z, drop);
    if (g === null || (known && py - g > drop)) continue;
    if (!point.exact && (!clearOfDoors(x, g, z) || !roomy(x, g, z))) continue;
    // facing the point when set off it, else the way the point says
    const heading = Number.isFinite(point.heading) ? point.heading : dx || dz ? Math.atan2(-dx, -dz) : undefined;
    return { pos: [x, g + 0.05, z], ...(heading !== undefined ? { heading } : {}), ok: true };
  }
  return { pos: [px, known ? py : 0, pz], ...(Number.isFinite(point.heading) ? { heading: point.heading } : {}), ok: false };
}

/** This world's quests (main first) and their stages, for the Quest stage section: [{ id, title, main, now, stages: [{ id, label }] }]. */
export function questList(quests, levelId) {
  if (!quests?.defs) return [];
  return [...quests.defs.values()].filter((d) => d.world === levelId).sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0))
    .map((d) => ({ id: d.id, title: d.title ?? d.id, main: !!d.main, now: quests.stage?.(d.id) ?? null, stages: d.stages.map((s) => ({ id: s.id, label: s.label ?? s.text ?? s.id })) }));
}

/**
 * The flags a quest set to `stage` needs (pure): the flags the stages before it wait for set as the debug save sets
 * them (a stage's `flag` and `value`, src/debug-save.js progressBefore), the ones of that stage and after it cleared
 * (they would move it straight on), and `quest.<id>` itself. 'done' sets them all.
 */
export function questJump(def, stage) {
  const flags = {};
  const at = stage === 'done' ? def.stages.length : def.stages.findIndex((s) => s.id === stage);
  if (at < 0) throw new Error(`quest ${def.id} has no stage ${stage}`);
  def.stages.forEach((s, i) => { if (s.flag) flags[s.flag] = i < at ? s.value ?? true : undefined; });
  flags[`quest.${def.id}`] = stage;
  return flags;
}

/** Set a quest to a stage in the game (quests: src/story/quests.js; game: the game state): its flags, then the stage, through quests.set so its hooks run. */
export function applyQuestJump(quests, game, id, stage) {
  const def = quests.def(id);
  const flags = questJump(def, stage);
  for (const [k, v] of Object.entries(flags)) if (k !== `quest.${id}`) game.set(k, v);
  const prev = quests.stage(id);
  if (prev === 'failed' || (prev === stage)) game.set(`quest.${id}`, undefined);   // (a failed quest stays failed through set(): cleared first)
  if (stage === 'done') { if (!quests.isStarted(id)) quests.start(id); quests.complete(id); } else quests.set(id, stage);
  if (game.flag(`quest.${id}`) !== stage) game.set(`quest.${id}`, stage);
  return flags;
}

/**
 * The films the menu plays in this world (pure): the Cinematics page's entries of this world staged in it (its
 * moments, its makers' boxes), the ship's recordings and its takeoff when the ship is here, and the ones that open
 * on a page of their own (an arrival reloads the world by ship; the prologue and the homecomings: the Cinematics
 * page). [{ ...entry, how: 'here' | 'reload' | 'page' }]
 */
export function cinematicsFor(levelId, { ship = true, catalog = CINEMATICS } = {}) {
  const out = [];
  for (const e of catalog) {
    if (e.id === 'trailer') continue;
    if (e.id.startsWith('call.') || e.id === 'takeoff') { if (ship) out.push({ ...e, how: 'here' }); continue; }
    if (e.world !== levelId) continue;
    if (e.id.startsWith('arrival.')) out.push({ ...e, how: 'reload' });
    else if (e.query) out.push({ ...e, how: 'page' });
    else out.push({ ...e, how: 'here' });
  }
  return out;
}


const fmt = (p) => p.map((v) => (v === null ? '·' : Math.round(v))).join(' ');

/** The time-of-day choices (hours). */
export const HOURS = [['dawn', 6], ['morning', 9], ['noon', 12], ['afternoon', 15.5], ['dusk', 18.5], ['night', 22.5]];

/**
 * The first tab's places (pure, from gatherPoints' points): the ship and the start, the makers' temples' doors, the
 * fight temple's, then at most `landmarks` of the story's goal, the beacons and the sights, in that order. Nothing is
 * listed per world: what a world has decides it. Each place once: a name already listed, or a place within `near` m of
 * one (the start at the foot of the ship's ramp, the story's goal at its temple's door), is left out.
 */
export function keyPlaces(points, { landmarks = 3, near = 30 } = {}) {
  const by = (k) => points.filter((p) => p.key === k);
  const out = [];
  const far = (p) => out.every((q) => q.label !== p.label && Math.hypot(q.pos[0] - p.pos[0], q.pos[2] - p.pos[2]) >= near);
  for (const p of [...by('ship').slice(0, 1), ...by('start').slice(0, 1), ...by('temple'), ...by('fight')]) if (p.key === 'temple' || p.key === 'fight' || far(p)) out.push(p);
  let marks = 0;
  for (const p of [...by('goal'), ...by('beacon'), ...by('sight')]) if (marks < landmarks && far(p)) { out.push(p); marks++; }
  return out;
}

/** The kinds' short names, for the tab strip. */
export const KIND_TABS = { landing: 'Landing', quest: 'Quests', people: 'People', temple: 'Temple', shop: 'Shops', sight: 'Sights', run: 'Runs', place: 'Places', find: 'Finds' };

/**
 * The dev menu's tabs (pure): [{ id, name, title, line, note?, rows: [{ label, hint, act, state?, tag?, now?, head? }] }],
 * drawn by src/dev-menu.js on the page and engine/menus.js in the engines. A row's `act` says what it does ({ do: 'tp',
 * point } · { do: 'toggle', key } · { do: 'film', entry } · { do: 'quest', id, stage } · { do: 'item', id } ...); `state`
 * is a switch's on or off; `head` a heading the cursor steps over. `caps`: the acts the host can carry out (null: all;
 * an engine leaves out the page's: films, the screenshot, the hitboxes, the input display, the Debug menu, pages).
 */
export function devTabs({ world = '', points = [], films = [], quests = [], toggles = {}, save = '', notes = null, items = [], flags = [], boxes = null, levels = [], levelId = null, motion = false, traveller = null, ship = null, caps = null } = {}) {
  const can = (k) => !caps || caps.has(k);
  const tabs = [];
  const tp = (p) => ({ label: p.label, hint: [p.hint, fmt(p.pos)].filter(Boolean).join(' · '), act: { do: 'tp', point: p }, ...(p.room ? { tag: 'room' } : {}) });
  const sw = (key, label, hint, act = { do: 'toggle', key }) => ({ label, hint, act, state: !!toggles[key] });
  if (ship) tabs.push({ id: 'ship', name: 'Ship', title: 'Your ship', line: 'Choose the ship for your next world load',
    note: 'Return to the title and continue, or travel to another world. Your progress stays the same. The ship you are standing in stays until then.',
    rows: SHIP_MODELS.map(model => ({
      label: model.name, hint: ship.active === model.id ? 'Currently in this world' : 'Available for the next world load',
      act: { do: 'ship', id: model.id }, tag: ship.selected === model.id ? 'selected' : '', now: ship.selected === model.id,
    })) });
  tabs.push({ id: 'world', name: 'World', title: world || 'This world', line: 'its key places: a teleport lands you on your feet, facing it · every place by kind on the tabs further on',
    rows: keyPlaces(points).map(tp), empty: 'Nowhere to go here.' });
  tabs.push({ id: 'cheats', name: 'Cheats', title: 'Cheats', line: 'for this session: god mode is never saved (the potions and the jets are)', rows: [
    sw('fps', 'Frame readout (FPS)', 'the frame rate and its times in the corner (F3)'),
    sw('god', 'God mode', 'fly anywhere fast and through walls, nothing hurts: the stick, RT / R2 up, LT / L2 down, L3 boost (keys: Space, Ctrl, Shift) · off: set down on the ground below'),
    sw('potions', 'Endless potions', 'the flask never runs dry (D-pad ←)'),
    { label: '♥ Full hearts', hint: 'every heart back', act: { do: 'heal' } },
    sw('jets', 'Fluid jets (debug)', 'the jets in every world: hold jump in the air (out of play since v1.38; kept in the save)'),
  ] });
  for (const g of groupPoints(points)) tabs.push({ id: `tp-${g.key}`, name: KIND_TABS[g.key] ?? g.title, title: g.title, line: `teleport · ${g.line}`, rows: g.points.map(tp) });
  if (films.length && can('film')) {
    const how = { here: 'played here, then back where you stood', reload: 'reloads the world, arriving by ship', page: 'on the Cinematics page' };
    tabs.push({ id: 'films', name: 'Films', title: 'Cinematics', line: 'the Cinematics page\'s films of this world · some change the save (a box opened again)',
      rows: films.map((e) => ({ label: e.title, hint: `${e.group} · ${how[e.how]}`, act: { do: 'film', entry: e }, ...(e.how === 'here' ? {} : { tag: e.how }) })) });
  }
  if (quests.length && can('quest')) {
    const rows = can('reload') ? [{ label: '↻ Reload this world', hint: 'its people and places as the quests now say', act: { do: 'reload' } }] : [];
    for (const q of quests) {
      rows.push({ head: true, label: `${q.title}${q.main ? ' · main' : ''}`, hint: q.now ?? 'not started' });
      [...q.stages, { id: 'done', label: 'done (the quest finished)' }].forEach((s, i) => rows.push({ label: `${s.id === 'done' ? '✓' : `${i + 1}.`} ${s.label}`, hint: `${q.id} → ${s.id}`,
        act: { do: 'quest', id: q.id, stage: s.id }, ...(q.now === s.id ? { now: true, tag: 'now' } : {}) }));
    }
    tabs.push({ id: 'quests', name: 'Stages', title: 'Quest stage', line: 'set a quest of this world to a stage · changes the save', rows,
      note: `⚠ Setting a stage changes the save being played${save ? ` (${save})` : ''}: the stages before it count as done (their flags set, as the debug save sets them), the ones after it not. Reload the world for its people and places to follow.` });
  }
  // the Notes page's screenshot drafts (src/issue-draft.js, issue #8): the frame and where you are, kept for the notebook
  if (notes && can('shot')) {
    tabs.push({ id: 'notes', name: 'Notes', title: 'Notes', line: `a screenshot as a draft for the Notes page · ${notes.paired ? 'this device is paired' : 'pairs this device the first time'}`, rows: [
      { label: '📷 Screenshot to a Notes draft', hint: 'this frame, the world, where you stand, the build and the preset · write it up on the Notes page', act: { do: 'shot' } },
      ...(notes.code ? [{ label: `Pairing code: ${notes.code}`, hint: 'on the Notes page, choose Pair a device and enter it', act: { do: 'shot', pairOnly: true } }] : []),
      ...(notes.queued ? [{ label: `↑ Send ${notes.queued} waiting screenshot${notes.queued === 1 ? '' : 's'}`, hint: 'kept on this device until the notebook has them', act: { do: 'flush' } }] : []),
    ] });
  }
  tabs.push({ id: 'toggles', name: 'Toggles', title: 'Toggles', line: 'the debug overlays and the time of day', rows: [
    sw('soundSources', 'Sound effects', 'show recent sound starts, playing loops and their source; music and spoken dialogue excluded'),
    ...(can('hitboxes') ? [sw('hitboxes', 'Hitboxes', 'the fight\'s hitbox overlay (F4)')] : []),
    ...(can('inputs') ? [sw('inputs', 'Controller inputs', 'the input display (F6)')] : []),
    ...(can('clock') ? [sw('clock', 'Time runs', 'the sky\'s clock goes on (off: it stands still)')] : []),
    ...HOURS.map(([name, h]) => ({ label: `☼ ${name}`, hint: `the time of day: ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`, act: { do: 'hour', h } })),
  ] });
  // which traveller is drawn (issue #493): the Blender rebuild (v2, the game's since v1.88) and its outfit, or B3 for
  // comparison; the page's only. traveller: { on, outfit, outfits: [{ id, name }] | null, note }
  if (traveller && can('traveller')) tabs.push({ id: 'traveller', name: 'Traveller', title: 'The traveller', line: 'the Blender rebuild, v2 (the game\'s, issue #493), or B3 to compare · switching reloads the world; an outfit changes at once', rows: [
    sw('travellerV2', 'Traveller v2 (Blender rebuild)', 'his body, skin and clothes from data/characters/traveller-v2/ on the same skeleton, the shirt\'s cloth and the thigh-lift keys driven, the game\'s head · off: B3, the traveller before v1.88 · ?traveller=b3 / v2'),
    ...(traveller.outfits ?? []).map((o) => ({ label: `Outfit: ${o.name}`, hint: `${o.id}${traveller.on ? '' : ' · switches to v2 (reloads)'}`, act: { do: 'traveller', outfit: o.id }, state: traveller.on && traveller.outfit === o.id })),
    ...(traveller.note ? [{ label: traveller.note, hint: 'data/characters/traveller-v2/outfits.json', act: { do: 'none' } }] : []),
  ] });
  // the old dev menu's (its own panel until v1.81): the items, the boxes and the story's switches, the worlds
  if (items.length) tabs.push({ id: 'items', name: 'Items', title: 'Items', line: 'each item on or off · at once, in the save', rows: [
    { label: 'All items', hint: 'every item owned', act: { do: 'items', all: true } },
    { label: 'No items', hint: 'every item taken back', act: { do: 'items', all: false } },
    ...items.map((it) => ({ label: it.name, hint: `${it.kind} · ${it.id}`, act: { do: 'item', id: it.id }, state: !!it.on })),
  ] });
  tabs.push({ id: 'story', name: 'Story', title: 'Boxes and story', line: `the makers' boxes${boxes ? ` (here ${boxes.found}/${boxes.total} found)` : ''}, the story's switches${motion ? ', the traveller\'s motion' : ''}`, rows: [
    { label: 'Reset boxes', hint: 'every box closed again, its item taken back, so it can be opened again', act: { do: 'boxes', open: false } },
    { label: 'Open all boxes', hint: 'every box here opened, its item given', act: { do: 'boxes', open: true } },
    ...flags.map(([k, label, on]) => ({ label, hint: k, act: { do: 'flag', key: k }, state: !!on })),
    { label: 'Complete this world', hint: 'its main quests done, their endings run (the keepsakes, the ship\'s power)', act: { do: 'complete' } },
    ...(motion ? [sw('matching', 'Motion matching (CMU capture)', 'the traveller\'s walk, run, stops and turns picked from motion capture; off: the blended loops'),
      sw('moves', 'Captured starts, stops and turns', 'over the loops: setting off, stopping, turning on the spot, the pivot at a run (Mixamo\'s capture)'),
      sw('carryStop', 'Carried stop from a run', 'Breath of the Wild\'s: letting go of the stick at a run, he carries on over a couple of braking strides (1.9 m from a sprint) · off: he stops in a third of a metre, as before · ?stop=carry / snap'),
      ...(can('page') ? [{ label: 'The Motion page', hint: 'both side by side on a test ground, the matcher\'s debug, the people\'s walks (motion.html; leaves the game)', act: { do: 'page', href: 'motion.html' } }] : [])] : []),
  ] });
  if (levels.length) tabs.push({ id: 'travel', name: 'Travel', title: 'Travel', line: 'to any world, in the save being played', rows: [
    ...levels.map((l) => ({ label: l.title, hint: `${l.id}${l.id === levelId ? ' · you are here' : ''}`, act: { do: 'travel', id: l.id }, ...(l.id === levelId ? { now: true, tag: 'here' } : {}) })),
    ...(can('picker') ? [{ label: '◀ The Debug menu', hint: 'every world, the test rooms, the pages', act: { do: 'picker' } }] : []),
  ] });
  return tabs;
}

/** The tabs the strip shows round the open one: [start, end) of at most `k` (the menu has more tabs than fit). */
export function tabWindow(n, i, k = 7) {
  const start = Math.max(0, Math.min(i - Math.floor(k / 2), n - k));
  return [start, Math.min(n, start + k)];
}

/** Where the cursor is in the tabs (pure; the page's menu and the engines' share it): the tab, its row, kept a tab each. */
export class DevNav {
  constructor() { this.tab = 0; this.row = 0; this.rows = {}; }
  static pickable(r) { return !!r && !r.head && !!r.act; }
  /** Kept inside the tabs as they are now (drawn again: a tab gone, rows fewer). */
  fit(tabs) {
    this.tab = Math.max(0, Math.min(this.tab, tabs.length - 1));
    const rows = tabs[this.tab]?.rows ?? [];
    this.row = Math.max(0, Math.min(this.row, rows.length - 1));
    if (rows.length && !DevNav.pickable(rows[this.row])) this.step(tabs, 1);
    return this;
  }
  /** The tab before / after (round), back on the row it was left at. */
  turn(tabs, d) {
    if (!tabs.length) return;
    this.rows[tabs[this.tab]?.id] = this.row;
    this.tab = (this.tab + Math.sign(d) + tabs.length) % tabs.length;
    this.row = this.rows[tabs[this.tab].id] ?? 0;
    this.fit(tabs);
  }
  /** To a tab by its id. */
  show(tabs, id) {
    const i = tabs.findIndex((t) => t.id === id);
    if (i >= 0 && i !== this.tab) { this.rows[tabs[this.tab]?.id] = this.row; this.tab = i; this.row = this.rows[id] ?? 0; }
    this.fit(tabs);
  }
  /** Up / down the rows (round), over the headings. */
  step(tabs, d) {
    const rows = tabs[this.tab]?.rows ?? [];
    if (!rows.some(DevNav.pickable)) return;
    let r = this.row;
    do r = (r + Math.sign(d) + rows.length) % rows.length; while (!DevNav.pickable(rows[r]));
    this.row = r;
  }
  /** To a row (a click on it). */
  at(tabs, r) { if (DevNav.pickable(tabs[this.tab]?.rows?.[r])) this.row = r; }
  current(tabs) { const r = tabs[this.tab]?.rows?.[this.row]; return DevNav.pickable(r) ? r : null; }
}

/**
 * Where god mode, let go, sets you down (pure on `physics`): straight down from where you hover onto the floor under you
 * with room to stand (from just over you: a room's floor under its roof), then near it; from inside a solid or under the
 * ground, the top of whatever is there, from the sky; ok false: nowhere (the caller puts you back where you were last safe).
 */
export function godLanding(physics, pos, { portals = [], killY = -Infinity } = {}) {
  const p = pos.isVector3 ? pos : new THREE.Vector3(pos[0], pos[1], pos[2]);
  let inside = false;
  try { inside = !!physics.buried?.(p); } catch { inside = false; }
  const base = physics.base?.heightAt?.(p.x, p.z);
  if (Number.isFinite(base) && p.y < base - 0.2) inside = true;
  const o = { portals, killY, below: true };
  if (!inside) { const s = landingSpot(physics, { pos: [p.x, p.y, p.z] }, o); if (s.ok) return s; }
  return landingSpot(physics, { pos: [p.x, null, p.z] }, o);
}

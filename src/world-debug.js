// The world debug menu (L3 + R3 in a world, F2 on the keyboard; docs/systems/dev-tools.md "The world debug
// menu"): over the world you are in, in the Debug menu's paper and ink (src/world-picker.css styles both),
// in sections a chip each (LB / RB), with the same filter (Y, or type):
//
//   Teleport     this world's points of interest by kind, gathered from what the world already has (no list
//                kept here): the ship and the start, every quest stage's marker (quests.where), the people,
//                the temple's door, its rooms' marks and its guardian, the shops (outside and at the counter),
//                the level design's sights, beacons and leading lines, the trial, the makers' runs and court,
//                the doors into rooms and caves, named places, the makers' boxes and the relics
//   Cinematics   this world's films from the Cinematics page's list (src/cinematics-page/catalog.js), played
//                where they are staged, then back where you stood
//   Quest stage  any of this world's quests set to a stage (the flags of the stages before it set as the debug
//                save sets them, src/debug-save.js), with a warning: it changes the save being played
//   Toggles      the hitbox overlay (F4: what L3 + R3 did before), the input display (F6), god mode, endless
//                potions, full hearts, the time of day, and back to the Debug menu
//
// The gathering and the landing are pure (gatherPoints, landingSpot, questJump, cinematicsFor): main.js feeds
// them its live objects; tests/world-debug.test.js and tests/contact-audit.test.js feed them built worlds.

import * as THREE from 'three';
import { TRIALS, trialsFor } from './trials/data.js';
import { kitTrialsFor } from './trials/kit-data.js';
import { SITES, STORY } from './desert-sites.js';
import { CINEMATICS } from './cinematics-page/catalog.js';
import { rowHtml } from './world-picker.js';
import { menuNavigate } from './controller.js';

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
 * @param w { levelId, level, quests, npcs, boxes, relics, ship, content }
 */
export function gatherPoints(w) {
  const { levelId, level = {}, quests = null, npcs = [], boxes = null, relics = null, ship = null, content = null } = w;
  const out = [];
  const rt = level.temple ?? null;
  const ground = (x, z) => { try { const h = level.ground?.heightAt?.(x, z); return Number.isFinite(h) ? h : null; } catch { return null; } };
  const inRoom = (a) => {
    if (a[1] === null) return false;
    try { if (rt?.inside?.(new THREE.Vector3(a[0], a[1], a[2]))) return true; } catch { /* no bounds */ }
    return a[1] > 1200 || rooms.some((r) => Math.hypot(r.x - a[0], r.y - a[1], r.z - a[2]) < 120);
  };
  // the rooms off the map: where the doors lead, far over the ground (as main.js finds them for the interior culler)
  const rooms = (level.portals ?? []).filter((p) => p.to && !p.toUp && p.to.y - (ground(p.to.x, p.to.z) ?? p.to.y) > 200).map((p) => p.to);
  const put = (kind, label, p, o = {}) => {
    const pos = xyz(p);
    if (!finite(pos)) return;
    const room = o.room ?? inRoom(pos);
    out.push({ kind, label: String(label), hint: o.hint ?? '', pos, ...(Number.isFinite(o.heading) ? { heading: o.heading } : {}), ...(room ? { room: true } : {}), ...(o.exact ? { exact: true } : {}), ...(o.q ? { q: o.q } : {}) });
  };
  // the landing: the ship's ramp (or where the world starts)
  const arrival = (() => { try { return ship?.arrivalSpot?.() ?? null; } catch { return null; } })();
  if (arrival?.pos) put('landing', 'the ship', arrival.pos, { hint: 'at the foot of its ramp', heading: arrival.heading });
  else if (level.ship?.pos) put('landing', 'the ship', level.ship.pos, { hint: 'where it lands' });
  if (level.spawn) put('landing', 'the start', level.spawn, { hint: 'where the world starts (no ship)', heading: level.spawnHeading });
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
  // the temple: outside its door, inside it, each room's mark, the guardian's arena
  if (rt) {
    const name = rt.def?.name ?? 'the temple';
    const D = rt.outside?.door;
    if (rt.doorOut) put('temple', `outside ${name}`, rt.doorOut, { hint: 'its door', heading: D ? D.heading + Math.PI : undefined, room: false });
    if (rt.arrival?.pos) put('temple', 'inside the door', rt.arrival.pos, { hint: name, heading: rt.arrival.heading, room: true, exact: true });
    for (const m of rt.marks ?? []) put('temple', `the ${words(m.room)} room`, m.spot ?? m.pos, { hint: `${name} · its mark`, heading: m.heading, room: true, exact: true, q: m.room });
    if (rt.gadgetSite?.at) put('temple', 'the gadget\'s chest', rt.gadgetSite.at, { hint: name, room: true });
    const A = rt.guardian?.arena;
    if (A?.center) {
      const a = xyz(A.center), to = xyz(rt.arrival?.pos) ?? [a[0], a[1], a[2] + 1];
      const dx = to[0] - a[0], dz = to[2] - a[2], d = Math.hypot(dx, dz) || 1, r = (A.r ?? 8) * 0.7;
      put('temple', 'the guardian\'s arena', [a[0] + (dx / d) * r, A.y ?? a[1], a[2] + (dz / d) * r], { hint: `${name} · at its edge`, heading: Math.atan2(-dx, -dz), room: true });
    }
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
  for (const s of list(level.sights)) put('sight', s.name, s.at, { hint: 'a thing to stop for' });
  for (const b of list(level.beacons)) { const t = xyz(b.top); if (t) put('sight', b.name, [t[0], t[1] - (b.height ?? 0), t[2]], { hint: 'a beacon (at its foot)' }); }
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
  if (goal) put('place', content.story.label ?? 'the story\'s goal', goal, { hint: content.story.title ?? '' });
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
export function landingSpot(physics, point, { portals = [], killY = -Infinity, radius = 9 } = {}) {
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
  const passes = point.exact ? [{ tries: [[0, 0]], drop: 6 }] : [{ tries: [[0, 0], ...ring(1.2, radius, 1.2)], drop: 6 }, { tries: ring(radius + 2, radius + 14, 3), drop: 60 }, { tries: [[0, 0], ...ring(1.2, radius, 1.2)], drop: 60 }, { tries: ring(radius + 16, 60, 5), drop: 120 }];
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

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmt = (p) => p.map((v) => (v === null ? '·' : Math.round(v))).join(' ');

/** The time-of-day choices (hours). */
export const HOURS = [['dawn', 6], ['morning', 9], ['noon', 12], ['afternoon', 15.5], ['dusk', 18.5], ['night', 22.5]];

/**
 * The menu's sections (pure): [{ key, title, line, html }] as src/world-picker.js fillPicker draws them. Each row is a
 * link to `#wd-<n>`; `acts[n]` says what it does ({ do: 'tp', point } · { do: 'film', entry } · { do: 'quest', id,
 * stage } · { do: 'toggle', key } · { do: 'hour', h } · ...). `state`: { quests, toggles: { key: bool }, save }.
 */
export function debugSections({ points = [], films = [], quests = [], toggles = {}, save = '' } = {}) {
  const acts = [];
  const row = (act, o) => { const n = acts.push(act) - 1; return rowHtml({ href: `#wd-${n}`, ...o, extra: ` data-wd="${n}"` }); };
  const out = [];
  for (const g of groupPoints(points)) {
    out.push({ key: `tp-${g.key}`, title: g.title, line: `teleport · ${g.line}`, html: `<div class="rows">${g.points.map((p) => row({ do: 'tp', point: p }, {
      label: esc(p.label), hint: `${p.hint ? `${p.hint} · ` : ''}${fmt(p.pos)}`, q: `${g.title} ${p.q ?? ''} teleport`, tag: p.room ? '<small class="tag">room</small>' : '' })).join('')}</div>` });
  }
  if (films.length) {
    const how = { here: 'played here, then back where you stood', reload: 'reloads the world, arriving by ship', page: 'on the Cinematics page' };
    out.push({ key: 'films', title: 'Cinematics', line: 'the Cinematics page\'s films of this world · some change the save (a box opened again)', html: `<div class="rows">${films.map((e) => row({ do: 'film', entry: e }, {
      label: esc(e.title), hint: `${e.group} · ${how[e.how]}`, q: `${e.id} cinematic film`, tag: e.how === 'here' ? '' : `<small class="tag">${e.how}</small>` })).join('')}</div>` });
  }
  if (quests.length) {
    const warn = `<p class="debug-note wd-warn" data-q="quest stage save warning">⚠ Setting a stage changes the save being played${save ? ` (${esc(save)})` : ''}: the stages before it count as done (their flags set, as the debug save sets them), the ones after it not. Reload the world for its people and places to follow.</p>`;
    const reload = row({ do: 'reload' }, { label: '↻ Reload this world', hint: 'its people and places as the quests now say', q: 'reload' });
    const rows = quests.map((q) => `<h3 class="wd-quest" data-q="${esc(`${q.title} ${q.id} ${q.stages.map((s) => `${s.id} ${s.label}`).join(' ')} done quest stage`.toLowerCase())}">${esc(q.title)}${q.main ? ' <small>main</small>' : ''} <small>${esc(q.now ?? 'not started')}</small></h3><div class="rows">${
      [...q.stages, { id: 'done', label: 'done (the quest finished)' }].map((s, i) => row({ do: 'quest', id: q.id, stage: s.id }, {
        label: `${s.id === 'done' ? '✓' : `${i + 1}.`} ${esc(s.label)}`, hint: `${q.id} → ${s.id}`, q: `${q.title} ${q.id} ${s.id} quest stage`, tag: q.now === s.id ? '<small class="best">now</small>' : '' })).join('')}</div>`).join('');
    out.push({ key: 'quests', title: 'Quest stage', line: 'set a quest of this world to a stage · changes the save', html: `<div class="rows wd-lead">${warn}${reload}</div>${rows}` });
  }
  const tog = (key, label, hint) => row({ do: 'toggle', key }, { label, hint, q: `${key} toggle`, tag: `<small class="tag wd-state${toggles[key] ? ' on' : ''}" data-state="${key}">${toggles[key] ? 'on' : 'off'}</small>` });
  const hours = () => HOURS.map(([name, h]) => row({ do: 'hour', h }, { label: `☼ ${name}`, hint: `the time of day: ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`, q: `time hour ${name}` })).join('');
  out.push({ key: 'toggles', title: 'Toggles', line: 'the debug switches · god mode for this session, the others kept · the Debug menu has more', html: `<div class="rows">${
    tog('hitboxes', 'Hitboxes', 'the fight\'s hitbox overlay (F4)')
    + tog('inputs', 'Controller inputs', 'the input display (F6)')
    + tog('god', 'God mode', 'nothing hurts you, no fall is fatal')
    + tog('potions', 'Endless potions', 'the flask never runs dry (D-pad ←)')
    + tog('jets', 'Fluid jets (debug)', 'the jets in every world: hold jump in the air (out of play since v1.38; kept in the save)')
    + row({ do: 'heal' }, { label: '♥ Full hearts', hint: 'every heart back', q: 'heal hearts' })
    + tog('clock', 'Time runs', 'the sky\'s clock goes on (off: it stands still)')
    + hours()
    + row({ do: 'picker' }, { label: '◀ The Debug menu', hint: 'every world, the test rooms, the pages', q: 'debug menu worlds back' })
  }</div>` });
  return { sections: out, acts };
}

/**
 * The menu over the world (main.js makes one): drawn afresh each time it opens (the people have moved, a quest
 * has gone on), into a #wdebug element with the Debug menu's header, filter and chips (src/world-picker.js
 * fillPicker). Keys while open: type to filter, Esc clears it then closes, PgUp / PgDn a section, F2 closes;
 * the controller's buttons come through main.js (B back, LB / RB a section, Y the filter, L3 + R3 closes).
 * @param o.build () => { sections, acts } (debugSections)
 * @param o.act   (act, el) => void: a row chosen
 * @param o.title () => the world's name, in the header
 * @param o.fill  fillPicker (passed in: the tests draw it without a world)
 */
export class WorldDebugMenu {
  constructor({ doc = globalThis.document, build, act, title = () => '', fill, onToggle = () => {} }) {
    Object.assign(this, { doc, build, act, title, fill, onToggle });
    this.el = null; this.menu = null; this.acts = [];
    this.win = doc?.defaultView;
    this.win?.addEventListener('keydown', (e) => this.key(e), { capture: true });
  }
  get open() { return !!this.el?.classList.contains('open'); }
  toggle(on = !this.open) {
    if (on === this.open) return;
    if (!on) {
      if (this.doc.activeElement && this.el?.contains(this.doc.activeElement)) this.doc.activeElement.blur();
      this.el?.classList.remove('open');
      this.onToggle(false);
      return;
    }
    const { sections, acts } = this.build();
    this.acts = acts;
    const el = this.doc.createElement('div');
    el.id = 'wdebug';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'World debug menu');
    el.innerHTML = `<header><h1 class="debug-room">HIRAETH <span>· World debug · ${esc(this.title())}</span></h1><span class="tools"><em class="hint"></em><button type="button" class="close">close ✕</button></span></header>`;
    const old = this.doc.getElementById('wdebug');
    if (old) old.replaceWith(el); else this.doc.body.appendChild(el);
    this.el = el;
    this.menu = this.fill(el, { sections, label: 'Filter the world debug menu', remember: false });
    el.querySelector('.close').addEventListener('click', () => this.toggle(false));
    el.addEventListener('click', (e) => {
      const a = e.target.closest?.('[data-wd]');
      if (!a) return;
      e.preventDefault();
      const act = this.acts[+a.dataset.wd];
      if (act) this.act(act, a);
    });
    const hint = el.querySelector('header .hint');
    if (hint && !this.doc.body.classList.contains('controller')) hint.textContent = 'type to filter · F2 closes';
    el.classList.add('open');
    this.onToggle(true);
    // the first row has the focus on a controller (it starts there)
    if (this.doc.body.classList.contains('controller')) el.querySelector('.sections a[href]')?.focus({ preventScroll: true });
  }
  /** Each toggle's on / off, as it is now. */
  states(toggles) {
    for (const t of this.el?.querySelectorAll('.wd-state') ?? []) { t.textContent = toggles[t.dataset.state] ? 'on' : 'off'; t.classList.toggle('on', !!toggles[t.dataset.state]); }
  }
  /** The keyboard (capture: before the game's own keys see it). */
  key(e) {
    if (e.code === 'F2' && !e.repeat) { e.preventDefault(); e.stopPropagation(); this.toggle(); return; }
    if (!this.open || !this.menu) return;
    const search = this.menu.search;
    if (e.target === search) return;   // (the filter's keys are its own)
    if (e.code === 'Escape') { e.stopPropagation(); if (search.value) this.menu.filter(search.value = ''); else this.toggle(false); return; }
    if (e.code === 'PageDown' || e.code === 'PageUp') { e.preventDefault(); e.stopPropagation(); this.menu.jump(e.code === 'PageDown' ? 1 : -1); return; }
    const arrow = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.code];
    if (arrow) { e.preventDefault(); e.stopPropagation(); menuNavigate(this.el, ...arrow); return; }   // (the grid, as the pad moves in it)
    if (this.menu.typeKey(e)) e.stopPropagation();
  }
}

// The play-through's agent (tests/playthrough.test.js; docs/systems/testing.md).
//
// It plays Hiraeth in node, world by world in the route's order, on the game's own modules: the
// level as main.js builds it (its temple attached), real collision, the story runtime
// (src/story/index.js) with its people and interactables, the makers' boxes, a real Player who is
// put where the objective is (the agent teleports; it does not walk), and one game state carried
// from world to world as a save would be. At every step it asks the same questions:
//
//   - is there an objective, and does the drone's FIND (src/scout.js nextObjective) point at it?
//   - is its person there (spawned, visible, talkable), or its thing?
//   - can the traveller stand there, and if it is high up, how does he get there with what he
//     carries at this point of the route (a declared way: a climb, the wind on wings, the jets,
//     the bird, a cab), never with what he has not found yet?
//
// and then it does what a player would: talks (choosing the answers that move the quest on, read
// from the conversation's own data), uses what E offers there, shoots or pushes what is there to
// be hit, waits for what takes time, or, where a step is a puzzle, runs the world's solver
// (tests/playthrough.test.js SOLVERS). What it could not do is written down as an issue, not
// thrown: the report lists every soft-lock it found, world by world.

import * as THREE from 'three';

// a little DOM: the story never needs a real page
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, append() {}, setAttribute() {}, set textContent(v) {}, set innerHTML(v) {}, get firstElementChild() { return el(); } });
const ctx2d = () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ctx2d()), set: (o, k, v) => { o[k] = v; return true; } });
const canvas = () => Object.assign(el(), { width: 1, height: 1, getContext: () => ctx2d(), toDataURL: () => '' });
globalThis.document ??= { createElement: (tag) => (tag === 'canvas' ? canvas() : el()), body: el(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, hidden: false };

const { LEVELS } = await import('../src/levels/index.js');
const { CONTENT, ORDER } = await import('../src/levels/content.js');
const { Physics } = await import('../src/physics.js');
const { Player } = await import('../src/player.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { items } = await import('../src/items.js');
const { clearInteractables, bestInteractable, allInteractables } = await import('../src/interact.js');
const { allTargets, clearTargets } = await import('../src/targets.js');
const { createBoxes, boxesFound, migrateSave } = await import('../src/boxes/index.js');
const { nextObjective } = await import('../src/scout.js');
const { birdAnswers, promisedBird } = await import('../src/bird.js');

// what listens to the game before any world is loaded (the modules' own): each world starts from that, as
// each world is a page of its own in the game (a world's story listens to the game's flags for good)
const baseListeners = new Map([...game.listeners].map(([k, v]) => [k, new Set(v)]));
const { Taxi } = await import('../src/taxi.js');
const taxiStatics = { refusal: Taxi.refusal, onRefuse: Taxi.onRefuse, playerPos: Taxi.playerPos };
const freshListeners = () => { game.listeners = new Map([...baseListeners].map(([k, v]) => [k, new Set(v)])); Object.assign(Taxi, taxiStatics); };

export { game, items, ORDER, CONTENT, LEVELS, Player, boxesFound, migrateSave, allTargets, allInteractables, bestInteractable };

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export { flat };
const quiet = (f) => { const w = console.warn, l = console.log, i = console.info, e = console.error; console.warn = console.log = console.info = console.error = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; console.error = e; } };

/** A sound that does nothing (and remembers the tunes it was asked to play: the flute). */
export function silentSound() {
  const tunes = [];
  return new Proxy({ tunes, tune: (notes) => { tunes.push(notes); return true; } }, { get: (o, k) => (k in o ? o[k] : () => null) });
}

/** The journal's two questions the route asks (src/quest.js Journal): story pages done, worlds seen. */
export function memoryJournal({ stories = {}, seen: seenIn = {} } = {}) {
  const done = new Set(Object.keys(stories)), seen = new Set(Object.keys(seenIn));
  return { done, seen, storyDone: (id) => done.has(id), sections: [], el: { addEventListener() {} } };
}

const { migrateFlags } = await import('../src/save-migrate.js');
/**
 * Load a save (its game state, { flags, keepsakes }, as 'moebius.game.v1' holds it) into the game, as a
 * page does when it boots: the game state's own migration (src/game-state.js), then main.js's
 * (src/boxes/index.js migrateSave: the backpack for pre-item saves, the temple chests for the gadgets
 * carried). The worlds' own migrations run when their story is set up (the desert's, Vael's ride).
 */
export function loadSave(data) {
  game.data = JSON.parse(JSON.stringify(data));
  game.data.flags ??= {};
  game.data.keepsakes ??= [];
  migrateFlags(game.data.flags);
  migrateSave(game);
  game.save();
  return game;
}

/**
 * Build a world as main.js does, minus the drawing: the level (and its temple), collision, its people,
 * the story runtime, the boxes, the bird's promise, a real Player at the spawn.
 */
export function loadWorld(id, { journal = memoryJournal(), report = () => {} } = {}) {
  clearInteractables(); clearTargets(); freshListeners();
  const meta = LEVELS.find((l) => l.id === id);
  const scene = new THREE.Scene();
  const level = quiet(() => meta.create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  if (birdAnswers(id, level, (k) => game.flag(k))) { level.mount = (p) => promisedBird(p, level.spawn); level.mountName = 'bird'; }
  const player = quiet(() => new Player(physics, { mount: level.mount, jetpack: level.features?.jetpack, climb: level.features?.climb ?? true, spawn: level.spawn, spawnHeading: level.spawnHeading,
    gravityAt: level.gravityAt, unsafe: level.unsafe, dynamic: level.dynamic, killY: level.killY, health: false }));
  player.respawn?.(level.spawn.clone());
  player.vehicles.push(...(level.vehicles ?? []));
  const npcs = quiet(() => spawnNPCs(scene, physics, CONTENT[id]?.npcs ?? []));
  const sound = silentSound();
  const toasts = [];
  let pageDone = false;
  journal.seen.add(id);
  const story = { complete: () => { pageDone = true; journal.done.add(id); }, def: CONTENT[id]?.story ?? {}, done: false, goal: null };
  const rt = quiet(() => createStory({ levelId: id, scene, physics, level, player, npcs, crowd: null, sound, journal, story, capture: null, lib: null, humans: null,
    toast: (t) => toasts.push(t), tool: null, isNight: () => false }));
  // the ship's ramp stands in for the ship (src/ship/ship.js arrivalSpot): where the fallback boxes go and "back to the ship" points
  const anchor = { pos: level.spawn.clone(), heading: level.spawnHeading ?? 0 };
  level.ship ??= { pos: level.spawn.clone() };
  const boxes = quiet(() => createBoxes({ levelId: id, scene, physics, level, player, sound, quests: rt.quests, toast: (t) => toasts.push(t), anchor, quiet: () => rt.dialogue.open }));
  const camera = new THREE.PerspectiveCamera();
  let clock = 0, portalCool = 0;
  // nothing tells of the makers' boxes before the first is found: no box quest before then
  const offQuest = game.on('quest', ({ id: qid, stage, prev }) => {
    const d = rt.quests.def(qid);
    if (d?.background && prev === undefined && stage !== 'done' && !boxesFound()) report({ world: id, quest: qid, stage, kind: 'box-quest', text: `the box quest ${qid} started before any box was found` });
  });
  const W = {
    id, meta, scene, level, physics, player, npcs, rt, quests: rt.quests, world: rt.world, temple: rt.temple, boxes, sound, toasts, camera, journal, report,
    get pageDone() { return pageDone; },
    passed: [],   // the doorways walked through
    get clock() { return clock; },
    /** Frames of the world (people walk, the story and the boxes run). */
    step(n = 1, dt = 1 / 30) {
      for (let i = 0; i < n; i++) {
        clock += dt;
        camera.position.copy(player.pos).add(V(0, 2.5, 4)); camera.lookAt(W.look ?? player.pos); camera.updateMatrixWorld();
        for (const v of player.vehicles) if (v !== player.ride) quiet(() => v.update(dt, null, clock));
        // doorways (main.js): walk into one and you come out at its far side
        portalCool = Math.max(0, portalCool - dt);
        if (!portalCool && !player.riding) for (const pt of level.portals ?? []) {
          if (pt.at && pt.to && player.pos.distanceTo(pt.at) < pt.r) { W.at(pt.to.clone()); if (pt.heading != null) player.heading = pt.heading; portalCool = 1.5; W.passed.push(pt.label ?? 'doorway'); break; }
        }
        quiet(() => rt.update(dt, clock, { camera }));
        // nobody starts a talk by themselves (they call you over: src/story/desert.js caller)
        if (rt.dialogue.open && rt.dialogue.npc) {
          report({ world: id, quest: '-', stage: '-', kind: 'auto-talk', text: `${rt.dialogue.person?.id} started talking by themselves` });
          converse(W, { flags: new Set(), items: new Set(), quests: new Set() });
        } else if (rt.dialogue.open) converse(W, goalOf(W, rt.quests.tracked() ?? ''));   // (a thing that speaks: a recording played)
        for (const n of npcs) quiet(() => n.update(dt, player, camera));
        quiet(() => boxes.update(dt, clock, { camera }));
        quiet(() => level.update?.(dt, clock, { player, camera }));
      }
    },
    /** Put the traveller there (standing). */
    at(p) { player.pos.copy(p); player.vel.set(0, 0, 0); player.onGround = true; player.lastSafe?.copy(p); return player; },
    dispose() { offQuest(); boxes.dispose?.(); rt.temple?.dispose?.(); clearInteractables(); clearTargets(); },
  };
  return W;
}

// ------------------------------------------------------------------ where can he stand

/** A spot to stand on at (or near) p: on solid ground within `up` m of it, with headroom. Or null. */
export function standNear(W, p, { radius = 4, up = 3 } = {}) {
  const { physics } = W;
  const tries = [[0, 0]];
  for (let r = 0.8; r <= radius; r += 0.8) for (let a = 0; a < Math.PI * 2 - 1e-6; a += Math.PI / 6) tries.push([Math.sin(a) * r, Math.cos(a) * r]);
  for (const [dx, dz] of tries) {
    const x = p.x + dx, z = p.z + dz;
    const g = physics.groundAt(x, p.y + up, z, up * 2 + 2);
    if (!Number.isFinite(g) || Math.abs(g - p.y) > up) continue;
    if (physics.rayDistance(V(x, g + 0.3, z), V(0, 1, 0), 1.9) < 1.6) continue;   // no room to stand
    return V(x, g, z);
  }
  return null;
}

/** Where a quest locator stands now (a fresh Vector3), or null. */
export const objectiveAt = (W, name) => W.quests.resolve(name)?.clone() ?? null;

/** How high a spot stands over the open ground around it (the lowest top surface 12–40 m round). */
export function heightOverGround(W, p) {
  const { physics } = W;
  let low = Infinity;
  for (const r of [12, 25, 40]) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const g = physics.groundAt(p.x + Math.sin(a) * r, p.y + 30, p.z + Math.cos(a) * r, 120);
    if (Number.isFinite(g) && g > p.y - 120) low = Math.min(low, g);
  }
  return Number.isFinite(low) ? p.y - low : 0;
}

// ------------------------------------------------------------------ the traveller's means

/** What the traveller can do now: his items, the bird's promise, the cab pass. */
export function abilities(W) {
  const f = (k) => game.flag(k);
  return {
    climb: W.level.features?.climb ?? true,
    boost: items.has('backpack') && !f('tool.empty'),
    glider: items.has('backpack') && items.has('glider'),
    jetpack: items.has('backpack') && items.has('jetpack'),
    bird: !!f('bird.promise') || (W.id === 'arzach' && !!f('arzach.bird.called')),
    cab: !!f('item.cabpass'),
  };
}
export const owned = (W) => Object.entries(abilities(W)).filter(([, v]) => v).map(([k]) => k);

// ------------------------------------------------------------------ conversations

const listOf = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

/**
 * What the agent wants out of a conversation now: the tracked quest's later stages' flags, its items,
 * the quests it may start. A choice or node whose effects touch one of these moves the story on.
 */
export function goalOf(W, questId, extra = {}) {
  const q = W.quests, d = q.def(questId), now = q.stage(questId);
  const flags = new Set(extra.flags ?? []), items_ = new Set(extra.items ?? []), quests = new Set([questId, ...(extra.quests ?? [])]);
  if (d) {
    const i = Math.max(0, d.stages.findIndex((s) => s.id === now));
    for (const s of d.stages.slice(i)) { if (s.flag) flags.add(s.flag); if (s.bring) items_.add(s.bring); }
  }
  return { flags, items: items_, quests };
}
function moves(effects, goal) {
  let score = 0;
  for (const e of listOf(effects)) {
    if (typeof e === 'function') { score = Math.max(score, 0.3); continue; }
    if (e.advance && goal.quests.has(listOf(e.advance)[0])) return 1;
    if (e.stage && goal.quests.has(e.stage[0])) return 1;
    if (e.start && goal.quests.has(e.start)) return 1;
    if (e.give && goal.items.has(e.give)) return 1;
    if (e.set && Object.keys(e.set).some((k) => goal.flags.has(k))) return 1;
    if (e.keepsake) return 1;
  }
  return score;
}
/** Steps from each node to one whose effects (or a choice's) move the goal: a breadth-first walk backwards. */
function distances(talk, goal) {
  const nodes = talk.nodes ?? {}, dist = {};
  const edges = [];   // [from, to]
  for (const [id, n] of Object.entries(nodes)) {
    if (moves(n.do, goal) >= 1) dist[id] = 0;
    for (const c of n.choices ?? []) { if (moves(c.do, goal) >= 1) dist[id] = 0; if (c.goto) edges.push([id, c.goto]); }
    if (n.next) edges.push([id, n.next]);
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const [a, b] of edges) if (dist[b] !== undefined && (dist[a] === undefined || dist[a] > dist[b] + 1)) { dist[a] = dist[b] + 1; changed = true; }
  }
  return dist;
}

/**
 * Talk through the open conversation (W.rt.dialogue), choosing what moves `goal` on. Returns the pages
 * said and the choices taken.
 */
export function converse(W, goal, { maxSteps = 120, prefer = null } = {}) {
  const D = W.rt.dialogue;
  const said = [], took = [];
  const seen = new Map();
  for (let i = 0; i < maxSteps && D.open; i++) {
    D.revealed = Infinity;
    const r = D.runner;
    if (!r.lastPage || r.ended) { said.push(r.text); D.next(); continue; }
    said.push(r.text);
    const cs = r.choices();
    if (!cs.length) { D.next(); continue; }
    if (cs.length === 1 && cs[0].end && cs[0].index === -1) { D.next(); continue; }
    const dist = distances(r.talk, goal);
    const visits = (id) => seen.get(id) ?? 0;
    const score = (c) => {
      if (prefer && prefer.test(c.text)) return -10;
      const own = moves(c.do, goal);
      if (own >= 1) return -5;
      if (c.end || !c.goto) return 50 - own * 10;
      const d = dist[c.goto];
      return (d === undefined ? 20 : d) + visits(c.goto) * 8 - own * 5;
    };
    const pick = [...cs].sort((a, b) => score(a) - score(b))[0];
    took.push(pick.text);
    if (pick.goto) seen.set(pick.goto, visits(pick.goto) + 1);
    D.choose(pick.index);
  }
  if (D.open) D.close();
  return { said, took };
}

/** Talk to someone (their talk.<id> interactable, as E does), choosing what moves the goal on. */
export function talkTo(W, personId, goal, o = {}) {
  const e = allInteractables().find((x) => x.id === `talk.${personId}`);
  if (!e) return { error: `nobody to talk to: ${personId}` };
  const npc = e.npc;
  if (e.enabled && !e.enabled()) return { error: `${personId} cannot be talked to (hidden or stunned)` };
  if (npc) { const s = standNear(W, npc.pos, { radius: 2.5, up: 1.5 }) ?? npc.pos.clone(); W.at(s.clone().add(V(1.2, 0, 0))); }
  e.use(W.player);
  if (!W.rt.dialogue.open) return { error: `talking to ${personId} opened nothing` };
  return converse(W, goal, o);
}

// ------------------------------------------------------------------ one objective

/** The objective as the HUD and the drone see it, checked: { ob, scout } or an issue. */
export function objectiveNow(W) {
  const ob = W.rt.objective(), raw = W.quests.objective();
  const scout = nextObjective({ player: W.player, expedition: null, story: null, ship: W.level.ship, level: W.level, quest: () => W.rt.objective() });
  return { ob, raw, scout };
}

/** The interactables in reach of where the traveller stands (best first). */
export function inReach(W) {
  const b = bestInteractable(W.player);
  return b ? [b.entry] : [];
}

/** The targets (shoot / push) within r of p. */
export function targetsNear(p, r = 8) {
  const d = (t) => { try { return t.position?.()?.distanceTo(p) ?? Infinity; } catch { return Infinity; } };
  return allTargets().filter((t) => t.kind !== 'npc' && !t.npc && d(t) < r && (t.enabled?.() ?? true)).sort((a, b) => d(a) - d(b));
}

// ------------------------------------------------------------------ playing a quest

/**
 * Play quest `qid` to its end (or until it sticks), checking every step. `solvers` by
 * 'quest:stage' do a step the generic agent can't (a puzzle); `ways` by 'quest:stage' say how a
 * high objective is reached ({ needs: ['glider'], how: 'the wind' }, or a function returning an issue
 * text or null after trying it for real). Returns { done, steps: [...], issues: [...] }.
 */
export async function playQuest(W, qid, { solvers = {}, ways = {}, checks = {}, each = null, maxSteps = 60, track = true } = {}) {
  const q = W.quests, steps = [], issues = [];
  const issue = (kind, text) => { issues.push({ world: W.id, quest: qid, stage: q.stage(qid) ?? '(not started)', kind, text }); W.report(issues.at(-1)); };
  const d = q.def(qid);
  if (!d) { issue('no-quest', `no quest ${qid} in ${W.id}`); return { done: false, steps, issues }; }

  // ---- the opening conversation
  if (!q.isStarted(qid)) {
    const o = q.pendingOpener();
    if (o?.id === qid) {
      // from the ship to the one who opens it: on foot, or by a declared way he has
      const way = ways[`${qid}:opener`], giverAt = q.resolve(o.at ?? o.who[0])?.clone();
      if (giverAt) {
        const spot = standNear(W, giverAt, { radius: 3, up: 2 }) ?? giverAt;
        if (way) { for (const i of reach(W, { position: giverAt, id: 'opener' }, null, way).issues) issue(i.kind, `the way to ${o.who[0]}: ${i.text}`); }
        else walkCheck(W, W.level.ship?.pos ?? W.level.spawn, spot, (t) => issue('unreachable', `the one who opens it, ${o.who[0]}: ${t}`));
        steps.push(`opener: ${o.who[0]} (${fmt(giverAt)}; ${way?.how ?? 'on foot from the ship'})`);
      }
      const { ob, scout } = objectiveNow(W);
      if (!ob) issue('no-target', 'the quest waits for its first talk, but there is no objective to find the one who opens it');
      else if (!scout || scout.id !== ob.id) issue('drone', `the drone finds "${scout?.label}", not the one to talk to ("${ob.label}")`);
      const giver = o.who.find((who) => presence(W, who).ok);
      if (!giver) issue('no-giver', `nobody who opens it is here: ${o.who.map((w) => `${w} (${presence(W, w).why})`).join(', ')}`);
      else {
        if (giver !== o.who[0]) issue('giver', `the first giver (${o.who[0]}) is not here (${presence(W, o.who[0]).why}); ${giver} opens it`);
        // the one the drone finds is the first step's person (unless the opener is a hint-giver of its own,
        // with its own label: the desert's Marrow, who sends you to the city)
        const first = q.resolve(d.stages[0].at ?? d.stages[0].talk), by = presence(W, o.who[0]).npc;
        if (!o.label && first && by && flat(first, by.pos) > 3) issue('giver', `the first step points ${flat(first, by.pos).toFixed(0)} m from ${o.who[0]}, who opens it`);
        const r = talkTo(W, giver, goalOf(W, qid));
        if (r.error) issue('talk', r.error);
        W.step(2);
        steps.push(`talk to ${giver} (opens it): ${q.stage(qid)}`);
      }
    } else issue('no-opener', `the quest is not started and nobody opens it (opener: ${o?.id ?? 'none'})`);
    if (!q.isStarted(qid)) { issue('soft-lock', 'the quest never started'); return { done: false, steps, issues }; }
  }

  // ---- stage by stage: each try must move something (the stage, the objective, a flag), or it is stuck
  let flagsSet = 0;
  const offFlag = game.on('flag', () => { flagsSet++; });
  let last = null, idle = 0;
  for (let n = 0; n < maxSteps && q.isActive(qid); n++) {
    const stage = q.stage(qid), st = q.current(qid);
    if (track) q.choose(qid);
    const { ob, raw, scout } = objectiveNow(W);
    const key = `${stage}|${raw?.id}|${raw ? fmt(raw.position) : ''}`;
    const fresh = key !== last;
    if (fresh) {
      if (!raw) issue('no-target', `stage "${stage}" (${st.text}) has no target`);
      else if (!scout || scout.id !== ob.id) issue('drone', `the drone finds "${scout?.label ?? 'nothing'}", the HUD says "${ob?.label}"`);
      // its person is there
      if (st.talk) { const p = presence(W, st.talk); if (!p.ok) issue('no-person', `stage "${stage}": ${st.talk} is not here (${p.why})`); }
      if (st.bring && q.has(st.bring) && st.to) { const p = presence(W, st.to); if (!p.ok) issue('no-person', `stage "${stage}": ${st.to} is not here (${p.why})`); }
      // and its place can be stood on, and reached with what he has
      const way = ways[`${qid}:${stage}`];
      if (raw) {
        const R = reach(W, raw, ob, way);
        for (const i of R.issues) issue(i.kind, `stage "${stage}": ${i.text}`);
        // and the walk there from where he stands now
        const walk = way || !R.spot ? '' : walkCheck(W, W.player.pos, R.door ?? R.spot, (t) => issue('unreachable', `stage "${stage}": ${t}`));
        steps.push(`${stage}: ${raw.label ?? ob?.label} (${fmt(raw.position)}; ${R.how})${walk}`);
      }
      // what the world says must hold at this step
      if (each) { const why = each(W, st, qid); if (why) issue('ability', `stage "${stage}": ${why}`); }
      const c = checks[`${qid}:${stage}`];
      if (c) { try { const why = c(W); if (why) issue('check', `stage "${stage}": ${why}`); } catch (e) { issue('error', `check at "${stage}": ${e.message}`); } }
    }
    // ---- do it
    const before = flagsSet;
    const solver = solvers[`${qid}:${stage}`];
    try {
      if (solver) await solver(W, { q, qid, st, raw, issue, attempt: fresh ? 0 : idle });
      else await generic(W, qid, st, raw);
    } catch (e) { issue('error', `stage "${stage}": ${e.stack?.split('\n').slice(0, 3).join(' / ') ?? e}`); }
    for (let k = 0; k < 4 && q.stage(qid) === stage; k++) { W.step(2); await sleep(30); }
    if (q.stage(qid) !== stage) { last = null; idle = 0; continue; }
    const after = objectiveNow(W).raw;
    const moved = `${stage}|${after?.id}|${after ? fmt(after.position) : ''}` !== key;
    idle = moved || flagsSet > before ? 0 : idle + 1;
    last = key;
    if (idle >= 2) { issue('soft-lock', `stuck at stage "${stage}" (${st.text})`); break; }
  }
  offFlag();
  return { done: q.isDone(qid), steps, issues };
}

/**
 * Can the traveller get to the objective: somewhere to stand at it, and a way up if it is high. On
 * foot: a walk over the ground (steps no higher than a stair, drops no deeper than a jump) joins it
 * to the open ground round it. Higher than that: a declared way (`way`), or a climb where the world
 * allows climbing. Through a doorway (a room off the map): the doorway is checked on the ground.
 * Returns { spot, how, issues }.
 */
export function reach(W, raw, ob, way) {
  const issues = [];
  const means = owned(W);
  if (way) {
    const lacks = (way.needs ?? []).filter((k) => !means.includes(k));
    if (way.any && !way.any.some((k) => means.includes(k))) lacks.push(way.any.join(' or '));
    if (lacks.length) issues.push({ kind: 'ability', text: `needs ${lacks.join(', ')} (${way.how ?? ''}), not had yet (has ${means.join(', ') || 'nothing'})` });
    if (typeof way.check === 'function') { const why = way.check(W); if (why) issues.push({ kind: 'unreachable', text: why }); }
  }
  const spot = standNear(W, raw.position, { radius: 4, up: 3 });
  if (!spot) { if (!way?.air) issues.push({ kind: 'no-ground', text: `nowhere to stand at its target (${fmt(raw.position)})` }); return { spot, how: way?.how ?? 'in the air', issues }; }
  if (way) return { spot, how: way.how ?? (way.needs ?? way.any).join(' + '), issues };
  // through a doorway: walk to the doorway (on the ground), the room behind it is its own
  const door = ob && ob.id !== raw.id && ob.position ? standNear(W, ob.position, { radius: 4, up: 3 }) : null;
  const walk = walkable(W, door ?? spot);
  if (walk.ok) return { spot, door, how: door ? `on foot, through ${ob.label.replace(/^Through the /, 'the ')}` : 'on foot', issues };
  if (means.includes('climb')) return { spot, door, how: `a climb of ${walk.climb.toFixed(0)} m`, climb: true, issues };
  if (means.includes('jetpack')) return { spot, door, how: `the jets, ${walk.climb.toFixed(0)} m up`, issues };
  issues.push({ kind: 'unreachable', text: `${walk.climb.toFixed(0)} m above the ground round it, and he can neither climb nor fly here` });
  return { spot, how: 'out of reach', issues };
}

/**
 * Walk outward from a spot over the ground: steps up no higher than `stair`, down no deeper than
 * `drop` (the way back is a climb of that much). It joins the open ground when it gets `far` m out
 * or down to the low ground round it. { ok, climb: how far above that it stands }.
 */
export function walkable(W, spot, { cell = 1, far = 45, stair = 0.8, hop = 2.2 } = {}) {
  const { physics } = W;
  const base = spot.y - heightOverGround(W, spot);
  if (spot.y - base < 1.6) return { ok: true, climb: 0 };
  const key = (i, j) => `${i},${j}`;
  const seen = new Set([key(0, 0)]), todo = [[0, 0, spot.y]];
  let lowest = spot.y;
  for (let n = 0; n < todo.length && n < 30000; n++) {
    const [i, j, h] = todo[n];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj, k = key(a, b);
      if (seen.has(k)) continue;
      const x = spot.x + a * cell, z = spot.z + b * cell;
      // the floor of the next cell out: walking in from it is a step up of no more than a stair,
      // or a hop down (from a little over this one, so roofs and arches overhead don't count)
      const g = physics.groundAt(x, h + hop, z, hop + stair + 0.2);
      if (!Number.isFinite(g) || h - g > stair) continue;
      if (physics.rayDistance(V(x, g + 0.3, z), V(0, 1, 0), 1.9) < 1.5) continue;
      seen.add(k);
      lowest = Math.min(lowest, g);
      if (Math.hypot(a, b) * cell >= far || g - base < 1.2) return { ok: true, climb: 0 };
      todo.push([a, b, g]);
    }
  }
  return { ok: false, climb: lowest - base };
}

/**
 * Can he walk from where he stands to `to`? Returns '' when he can, or a note for the step's line;
 * calls `bad` when the gap is not a climb at the end (a wall to climb up to it is the world's own way).
 * Worlds whose gravity turns (the Hangar's zones) are not walked.
 */
export function walkCheck(W, fromPos, to, bad) {
  if (W.level.gravityAt) return '';
  // (from where he stands; from the air, where he comes down)
  const below = W.physics.groundAt(fromPos.x, fromPos.y + 0.5, fromPos.z, 300);
  const here = standNear(W, fromPos, { radius: 3, up: 2 }) ?? (Number.isFinite(below) ? V(fromPos.x, below, fromPos.z) : fromPos.clone());
  const w = walkTo(W, here, to);
  if (w.ok) return '';
  // the last of it is a climb (a wall, a trunk, a ledge) where climbing is allowed: the way the world means
  if ((W.level.features?.climb ?? true) && Math.hypot(w.at.x - to.x, w.at.z - to.z) < 12 && to.y > w.at.y) return ` (the last ${(to.y - w.at.y).toFixed(0)} m a climb)`;
  bad(`no way on foot from ${fmt(here)} (the walk gets within ${w.closest.toFixed(0)} m)`);
  return ' (not on foot)';
}

/**
 * A walk from one spot to another over the ground, best first: steps of `cell` m up no higher than a stair
 * or a hop (`rise`), down no deeper than a safe drop, with headroom; through the world's doorways
 * (level.portals) as a player walks into them. Floors stacked over one another are told apart (a key
 * per 4 m of height). { ok, closest (m), nodes }.
 */
export function walkTo(W, from, to, { cell = 2, rise = 1.4, drop = 6, near = 5, max = 120000 } = {}) {
  const { physics } = W;
  const key = (x, y, z) => `${Math.round(x / cell)},${Math.round(z / cell)},${Math.round(y / 4)}`;
  const h = (x, y, z) => Math.hypot(x - to.x, z - to.z) + Math.abs(y - to.y) * 2;
  const heap = [], push = (n) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (r < heap.length && heap[r].f < heap[m].f) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const seen = new Set([key(from.x, from.y, from.z)]);
  push({ x: from.x, y: from.y, z: from.z, f: h(from.x, from.y, from.z) });
  const portals = (W.level.portals ?? []).filter((p) => p.at && p.to);
  let closest = Infinity, at = from, n = 0;
  while (heap.length && n++ < max) {
    const c = pop();
    const d = Math.hypot(c.x - to.x, c.z - to.z) + Math.abs(c.y - to.y);
    if (d < closest) { closest = d; at = c; }
    if (d < near) return { ok: true, closest: d, nodes: n, at };
    const next = [];
    for (const [dx, dz] of [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]) {
      const x = c.x + dx, z = c.z + dz;
      const g = physics.groundAt(x, c.y + rise + 0.2, z, rise + drop + 0.2);
      if (!Number.isFinite(g) || g - c.y > rise || c.y - g > drop) continue;
      if (physics.rayDistance(V(x, g + 0.3, z), V(0, 1, 0), 1.9) < 1.5) continue;
      next.push([x, g, z]);
    }
    for (const p of portals) if (Math.hypot(c.x - p.at.x, c.z - p.at.z) < p.r + cell && Math.abs(c.y - p.at.y) < 2.5) next.push([p.to.x, p.to.y, p.to.z]);
    for (const [x, y, z] of next) {
      const k = key(x, y, z);
      if (seen.has(k)) continue;
      seen.add(k);
      push({ x, y, z, f: h(x, y, z) });
    }
  }
  return { ok: false, closest, nodes: n, at };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (p) => p ? `${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}` : '?';
export { fmt };

/** Is this person here: spawned, seen, talkable? { ok, why, npc } */
export function presence(W, id) {
  // (a person who shares a name with one in another world has an id of their own, '<name>.<world>': src/save-migrate.js)
  const e = allInteractables().find((x) => x.id === `talk.${id}`) ?? allInteractables().find((x) => x.id === `talk.${id}.${W.id}`);
  if (!e) return { ok: false, why: 'not spawned' };
  const npc = e.npc;
  if (npc && !Number.isFinite(npc.pos.y)) return { ok: false, why: 'nowhere', npc };
  // (people far from the camera are culled: go and look)
  if (npc) { const s = standNear(W, npc.pos, { radius: 3, up: 2 }); W.at((s ?? npc.pos).clone().add(V(1.5, 0, 0))); W.step(1); }
  if (npc && npc.object && !npc.object.visible) return { ok: false, why: 'hidden', npc };
  if (e.enabled && !e.enabled()) return { ok: false, why: 'not talkable', npc };
  return { ok: true, npc };
}

/** A box opening plays its scene and waits on its card: see it through (as Esc / B does). */
export function finishScenes(W) {
  for (let k = 0; k < 40 && W.boxes.busy(); k++) { W.step(10); W.boxes.skip(); }
}

/** The usual way through a step: go there, talk, use, shoot, push, wait. */
export async function generic(W, qid, st, raw) {
  const q = W.quests, stage = st.id, moved = () => q.stage(qid) !== stage;
  const goal = () => goalOf(W, qid);
  if (st.talk) { const r = talkTo(W, st.talk, goal()); W.step(2); if (moved() || !r.error) return; }
  if (st.bring && q.has(st.bring) && st.to) { talkTo(W, st.to, goal()); W.step(2); if (moved()) return; }
  if (!raw) return;
  const spot = standNear(W, raw.position, { radius: 4, up: 3 }) ?? raw.position.clone();
  W.at(spot); W.step(3);
  if (moved()) return;
  // a doorway there: in through it
  const door = (W.level.portals ?? []).find((pt) => pt.at && pt.to && pt.at.distanceTo(raw.position) < 6);
  if (door) { W.at(door.at.clone()); W.step(3); if (moved()) return; }
  // what E offers there
  for (let k = 0; k < 4 && !moved(); k++) {
    const e = bestInteractable(W.player)?.entry;
    if (!e) break;
    e.use(W.player);
    if (W.rt.dialogue.open) converse(W, goal());
    finishScenes(W);
    W.step(5);
  }
  if (moved()) return;
  // what is there to be hit
  for (const mode of ['shoot', 'push']) {
    for (const t of targetsNear(raw.position, 20)) { if (moved()) return; try { t.onHit(mode, t.position().clone(), V(0, 0, -1), { strength: 1, colours: 1, shove: 1 }); } catch { /* */ } W.step(10); }
  }
  // what takes time
  for (let k = 0; k < 30 && !moved(); k++) { W.at(spot); W.step(30, 1 / 10); await sleep(40); }
}

/**
 * Through the world's temple (src/temples/) as far as `until` ('gadget': its chest opened; 'done': its
 * guardian resolved), the way its quest marker leads: at each next thing to do (logic.next, the
 * marker's nextSpot) he must have somewhere to stand, and it must be doable with what he carries;
 * he does it (a chest: E; a brazier, a switch, a bell: lit with the right mode; a drum: rolled onto
 * its plate; a plate: stood on; the guardian: resolved). Returns the log; issues go to `issue`.
 */
export async function templeTo(W, until, issue, { nextSpot }) {
  const T = W.level.temple, L = T?.logic, log = [];
  if (!T) { issue('no-temple', `${W.id} has no temple`); return log; }
  const door = T.outside?.door?.at;
  if (door) {
    const s = standNear(W, door, { radius: 5, up: 3 });
    if (!s) issue('no-ground', `the temple's door (${fmt(door)}) has nowhere to stand`);
    else { W.at(s); W.step(3); const w = walkable(W, s); log.push(`door: ${w.ok ? 'on foot' : `a climb of ${w.climb.toFixed(0)} m`}`); }
  }
  W.at(T.arrival.pos.clone()); W.step(3);
  if (!game.flag(`temple.${T.id}.entered`)) issue('temple', `in through the door of ${T.def.name}, but it never counted as entered`);
  const reached = () => (until === 'gadget' ? L.gadget : L.resolved);
  for (let n = 0; n < 80 && !reached(); n++) {
    const id = L.next();
    if (!id) { issue('soft-lock', `${T.def.name}: nothing left to do, and ${until === 'gadget' ? 'the chest' : 'the guardian'} not reached (rooms open: ${[...L.reachable()].join(', ')})`); break; }
    const e = L.el(id), at = nextSpot(T);
    const s = at ? standNear(W, at, { radius: 4, up: 3.5 }) : null;
    if (!s && e.type !== 'boss') issue('no-ground', `${T.def.name}: ${e.type} ${id} (${fmt(at)}) has nowhere to stand by it`);
    if (s) { W.at(s); W.step(2); }
    if (e.type === 'gadget') {
      const box = W.boxes.list.find((b) => b.place.temple === W.id);
      if (!box) { issue('no-thing', `${T.def.name}: no chest`); break; }
      const by = standNear(W, box.pos.clone().add(V(Math.sin(box.yaw) * 1.4, 0, Math.cos(box.yaw) * 1.4)), { radius: 2, up: 2 });
      if (by) W.at(by);
      const b = bestInteractable(W.player)?.entry;
      if (b?.id !== `box.${box.id}`) issue('temple', `${T.def.name}: E by the chest is ${b?.id ?? 'nothing'}`);
      if (b?.id === `box.${box.id}`) { b.use(W.player); finishScenes(W); } else W.boxes.open(box.id, { instant: true });
      log.push(`chest: ${box.item}`);
    } else if (['brazier', 'bramble', 'switch', 'bell'].includes(e.type)) { L.light(id); T.onLit(id); log.push(`${e.type} ${id}`); }
    else if (e.type === 'drum') { L.moveDrum(id, e.plateAt ?? 1); log.push(`roll ${id}`); }
    else if (e.type === 'plate') { L.press(id, 'player'); T.applyDoors(); W.step(2); L.release(id, 'player'); log.push(`stand on ${id}`); }
    else if (e.type === 'boss') { if (T.guardian?.resolve) T.guardian.resolve(); else T.onBossResolved(); log.push(`guardian ${id}`); }
    T.applyDoors(); W.step(4);
    await sleep(5);
  }
  return log;
}

const { pendingCall, completedWorlds, callLines, callContext, applyCall } = await import('../src/story/calls.js');
const { consoleAction, mapEntries } = await import('../src/ship/starmap.js');
const { homeOpen, HOME_ID } = await import('../src/story/ending.js');
const { TITLES } = await import('../src/levels/names.js');
export { homeOpen, HOME_ID, pendingCall, completedWorlds };

/**
 * Aboard between worlds, as the ship's two consoles have it (src/ship/ship.js useConsole, useTable,
 * travel): every waiting message on the voicemail played, then the holo table: the map must be
 * powered and must chart `to`. Returns { heard: [n], map: entries } and reports what is wrong.
 */
export function shipTurn({ from, to, journal, issue }) {
  const flag = (k) => game.flag(k);
  const completed = () => completedWorlds(ORDER, { flag, storyDone: journal.storyDone });
  const heard = [];
  for (let n = pendingCall({ flag, completed: completed().length }); n != null && heard.length < 4; n = pendingCall({ flag, completed: completed().length })) {
    if (consoleAction({ at: 'dash', pendingCall: n }) !== 'call') { issue('ship', `the voicemail would not play message ${n}`); break; }
    const done = completed(), ctx = callContext(game, { titles: TITLES, completed: done, lastWorld: done.slice(-1)[0] });
    const lines = callLines(n, ctx);
    if (!lines?.length) issue('ship', `message ${n} has nothing in it`);
    applyCall(game, lines); game.set(`calls.${n}`, true); game.emit('call', { n });
    heard.push(n);
  }
  if (consoleAction({ at: 'table', powered: !!flag('ship.powered') }) !== 'map') issue('ship', `the holo table is locked (ship.powered ${flag('ship.powered')})`);
  const map = mapEntries({ order: ORDER, levels: LEVELS, flag, journal: { storyDone: journal.storyDone, seen: (id) => journal.seen.has(id) }, current: from, home: () => homeOpen({ flag, completed: completed() }) });
  const e = map.find((x) => x.id === to);
  if (!e?.known) issue('route', `the map does not chart ${to} after ${from} (charted: ${map.filter((x) => x.known).map((x) => x.id).join(', ')})`);
  game.emit('travel', { to }); game.set('ship.level', to); game.set('ship.launched', true);
  return { heard, map };
}

/** E on what is here, if it is `id` (throws otherwise). Returns the entry. */
export function useHere(W, id, goal = null) {
  const e = bestInteractable(W.player)?.entry;
  if (!e || (id && e.id !== id)) throw new Error(`E is not "${id}" here (it is ${e?.id ?? 'nothing'})`);
  e.use(W.player);
  if (W.rt.dialogue.open) converse(W, goal ?? { flags: new Set(), items: new Set(), quests: new Set() });
  finishScenes(W);
  return e;
}

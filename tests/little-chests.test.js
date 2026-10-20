// The little chests' rule (v1.86, issue #518, the author: "Little chests should always be a rewards for puzzles
// completion. And I should have all the tools available at that moment in the game to open them."): every makers' chest
// outside a temple and off the story's way, in every world on the route, is behind a puzzle (its world's makers' court's
// gate, or a small lock beside it: src/boxes/locks.js), and the tool that puzzle wants is earned no later than that world
// in the route's order (src/levels/names.js ORDER).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { ORDER, partOf, isDiscarded } from '../src/levels/names.js';
import { ITEMS } from '../src/items.js';
import { COURTS, attachCourt } from '../src/finds/courts.js';
import { LOCK_ITEM, LOCK_SEALED, lockFlag, buildLock } from '../src/boxes/locks.js';
import { boxTool, toolHeld } from '../src/boxes/index.js';
import { GameState } from '../src/game-state.js';
import { allTargets, clearTargets } from '../src/targets.js';
import { GadgetWorld } from '../src/gadgets/world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** Every placement of a world on the route, with the world it stands in (a part's: its world's). */
const ROUTE = Object.entries(PLACEMENTS).filter(([part]) => !isDiscarded(part) && ORDER.includes(partOf(part)))
  .flatMap(([part, list]) => list.map((p) => ({ ...p, part, world: partOf(part) })));
/** The little chests: not a temple's, not the story's, not the desert's first (the elder's, a temple chest on the dais). */
const LITTLE = ROUTE.filter((p) => !p.temple && !p.story && p.chest !== 'temple');
/** The first world on the route where `item` is earned: a temple's or the story's chest holds it (or its gadget, `with`). */
function earnedAt(item) {
  const at = ROUTE.filter((p) => (p.temple || p.story || p.chest === 'temple') && (p.item === item || ITEMS[p.item]?.with?.includes(item)))
    .map((p) => ORDER.indexOf(p.world));
  return at.length ? Math.min(...at) : Infinity;
}

test('every little chest on the route is a puzzle’s reward, its tool in hand by its world (issue #518)', () => {
  assert.ok(LITTLE.length >= 20, `the little chests found (${LITTLE.length})`);
  const rows = [];
  for (const p of LITTLE) {
    const here = ORDER.indexOf(p.world);
    let tool;
    if (p.court) {
      const c = COURTS[p.court];
      assert.ok(c, `${p.id}: its court (${p.court})`);
      assert.ok(c.boxAt, `${p.id}: behind its court's gate, not at its front edge`);
      assert.ok(!p.lock, `${p.id}: a court's or a lock's, not both`);
      tool = c.needs;
    } else {
      assert.ok(p.lock, `${p.id}: a little chest on a climb has a small lock (src/boxes/locks.js) or stands in a court`);
      assert.ok(LOCK_SEALED[p.lock.tool], `${p.id}: a lock of a known kind (${p.lock.tool})`);
      tool = LOCK_ITEM[p.lock.tool];
    }
    assert.ok(ITEMS[tool], `${p.id}: its tool is an item (${tool})`);
    const at = earnedAt(tool);
    assert.ok(at <= here, `${p.id} (${p.world}, ${here + 1}th): its ${tool} is earned in ${ORDER[at] ?? 'no world on the route'} (${at + 1}th)`);
    // (earned by its world is not enough: a tool from this world's own temple comes after its local speaks, and an earlier
    // world's can be left behind. Its quest waits for that very tool, so nothing points at the box before it is in hand:
    // issue #557, tests/box-quest-tools.test.js runs the quests)
    assert.equal(boxTool(p), tool, `${p.id}: its quest waits for its ${tool}`);
    assert.ok(!toolHeld(p, (id) => id !== tool), `${p.id}: not offered with every tool but its ${tool}`);
    assert.ok(p.hint, `${p.id}: its box quest's hint`);
    rows.push(`${p.id}: ${tool} from ${ORDER[at]}`);
  }
  // (the four courts that had no box have one now)
  for (const id of ['arzach2', 'incal', 'glassdunes', 'bazaar']) assert.ok(LITTLE.some((p) => p.court === id), `${id}: its court has a box`);
});

test('every court on the route: its gate across the alcove (or its tower), the box behind what its puzzle opens', () => {
  for (const [id, C] of Object.entries(COURTS)) {
    if (!ORDER.includes(partOf(id))) continue;
    const scene = new THREE.Scene();
    const level = { spawn: V(0, 0, 0), ground: { baseAt: () => 0 } };
    const court = attachCourt(id, scene, level);
    assert.ok(court, `${id}: built`);
    assert.equal(court.needs, C.needs, `${id}: wants its tool`);
    const W = level.gadgetWorld;
    const inv = new THREE.Matrix4().makeRotationY(court.frame.yaw).setPosition(court.frame.origin).invert();
    const box = V(...court.box.at).applyMatrix4(inv);
    if (box.y > 1) continue;   // (the Garden's: on a tower only the glass path reaches)
    const gates = W.gates ?? [], walls = W.breakables ?? [];
    // behind a gate (bars that sink), or a cracked wall (the bombs')
    const shut = [...gates.map((g) => g.object.position), ...walls.map((b) => (b.object ?? b.mesh)?.position).filter(Boolean)];
    assert.ok(shut.some((g) => box.z < g.z - 1 && Math.abs(box.x - g.x) < 1.5), `${id}: the box (${box.x.toFixed(1)}, ${box.z.toFixed(1)}) behind a gate or a cracked wall`);
  }
});

test('the new courts’ gates: rings tugged, plates latched, eyes in one throw, jaws stilled (issue #518)', () => {
  const build = (id) => {
    clearTargets();
    const scene = new THREE.Scene();
    const level = { spawn: V(0, 0, 0), ground: { baseAt: () => 0 } };
    attachCourt(id, scene, level);
    const W = new GadgetWorld({ scene, spec: level.gadgetWorld, physics: null, player: { pos: V(0, -50, 0) } });
    for (const t of level.targets ?? []) t.kind === 'seal' && (t.enabled ??= () => true);
    return { W, level, seals: (level.targets ?? []).filter((t) => t.kind === 'seal') };
  };
  const gate = (W) => W.gates.at(-1);
  const step = (W) => W.updatePlates(0.1);
  // Vael: two rings, the hook's tug only
  {
    const { W, seals } = build('arzach');
    assert.equal(seals.length, 2);
    seals[0].onHit('push', V(), V(), { mode: 'hook' }); step(W);
    assert.ok(!gate(W).latched, 'one ring: still shut');
    seals[1].onHit('shoot', V(), V(), { mode: 'shoot' }); step(W);
    assert.ok(!gate(W).latched, 'a glob is no tug');
    seals[1].onHit('push', V(), V(), { mode: 'hook' }); step(W);
    assert.ok(gate(W).latched, 'both rung: open for good');
  }
  // Lorn: the jaws, stilled
  {
    const { W, seals } = build('perdide');
    seals[0].onHit('fire', V(), V(), {}); step(W);
    assert.ok(!gate(W).latched, 'ember does nothing');
    seals[0].onHit('stun', V(), V(), {}); step(W);
    assert.ok(gate(W).latched, 'stilled: open');
  }
  // the Glass Dunes: three eyes, the boomerang's
  {
    const { W, seals } = build('glassdunes');
    assert.equal(seals.length, 3);
    for (const s of seals) s.onHit('shoot', V(), V(), { source: 'gun' });
    step(W);
    assert.ok(!gate(W).latched, 'the gun wakes none');
    for (const s of seals) s.onHit('shoot', V(), V(), { source: 'boomerang' });
    step(W);
    assert.ok(gate(W).latched, 'one throw through all three: open');
  }
  // the sky stones, the Deep Wood, the City-Shaft, the Signal Market: their plates up a climb latch
  for (const id of ['arzach2', 'perdide2', 'incal', 'bazaar']) {
    const { W } = build(id);
    const g = gate(W);
    const need = g.all ? g.plates : g.plates.slice(0, 1);
    for (const i of need) { assert.ok(W.plates[i].latch, `${id}: its plate stays down`); assert.ok(W.plates[i].pos.y > 5.5 - 1e-6 || id === 'never', `${id}: up a climb (${W.plates[i].pos.y.toFixed(1)} m)`); }
    if (g.all) { W.plates[need[0]].on = true; step(W); assert.ok(!g.latched, `${id}: one plate of two: still shut`); }
    for (const i of need) W.plates[i].on = true;
    step(W);
    assert.ok(g.latched, `${id}: open for good`);
    for (const i of need) W.plates[i].on = false;
    step(W);
    assert.ok(g.latched, `${id}: still open`);
  }
});

test('a small lock: shut and saying what it wants until its tool answers it, then the chest wakes, and stays answered', () => {
  const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
  for (const tool of Object.keys(LOCK_SEALED)) {
    clearTargets();
    const game = new GameState(memory());
    const scene = new THREE.Scene();
    const b = { id: `test.${tool}`, pos: V(0, 0, 0), yaw: 0, parts: { root: new THREE.Group() } };
    const player = { pos: V(50, 0, 0) };
    const L = buildLock(b, { tool }, { scene, game, player });
    L.update(0.016, 0);
    assert.ok(!L.solved(), `${tool}: shut at first`);
    assert.ok(!game.flag(lockFlag(b.id)));
    const T = allTargets().filter((t) => t.kind === 'lock');
    const hit = (mode, info = {}) => { for (const t of allTargets().filter((x) => x.kind === 'lock' && x.enabled())) t.onHit(mode, V(), V(), info); };
    // a wrong answer does nothing
    hit('shoot', { mode: 'shoot' });
    L.update(0.016, 0);
    assert.ok(!L.solved(), `${tool}: a plain glob does nothing`);
    if (tool === 'ember') hit('fire');
    else if (tool === 'hook') hit('push', { mode: 'hook' });
    else if (tool === 'stun') hit('stun');
    else if (tool === 'bloom') hit('bloom');
    else if (tool === 'springs') hit('push', { mode: 'stomp', source: 'stomp' });
    else if (tool === 'tether') hit('tether');
    else if (tool === 'bomb') game.emit('gadget:blast', { at: V(0.5, 0.3, 0) });
    else if (tool === 'magnet') { const disc = L.root.children.find((m) => m.userData?.metal); assert.ok(disc, 'its iron disc is metal'); game.emit('magnet:pull', { object: disc }); }
    else if (tool === 'bubble') player.pos.set(0, 0, 0).add(L.root.localToWorld(V(1.6, 6.5, -0.2)));
    else if (tool === 'lens') { assert.equal(b.parts.root.visible, false, 'lens: the chest unseen'); game.set(`lens.read.${lockFlag(b.id)}`, true); }
    L.update(0.016, 1);
    assert.ok(L.solved(), `${tool}: answered`);
    assert.ok(game.flag(lockFlag(b.id)), `${tool}: saved`);
    if (tool === 'lens') assert.equal(b.parts.root.visible, true, 'lens: seen, it stays');
    assert.ok(T.length || ['bomb', 'magnet', 'bubble', 'lens'].includes(tool), `${tool}: a target the tool hits`);
    L.dispose();
    // built again from the save: answered already
    const again = buildLock(b, { tool }, { scene, game, player });
    assert.ok(again.solved());
    again.dispose();
  }
});

// Issue #375: the gadgets moved into the temples, and some of their rooms now want a gadget to cross. A save loaded inside
// a house, past one of those gates without its gadget, is never stranded (src/temples/runtime.js unstrand): past the
// place the gadget is earned (the chest taken, the find found) the gadget is the save's; else the traveller is put back at
// the last mark he can reach, or the entrance's. Every gate of every house, both ways.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLES, TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { roomsPast, gateItems } from '../src/temples/runtime.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const DT = 1 / 60;
const BASE = ['backpack', 'gun', 'doublejump', 'sword', 'shield', 'glider', 'stun', 'bloom', 'tether'];
const own = (list) => { for (const id of Object.keys(ITEMS)) if (list.includes(id)) items.grant(id); else items.revoke(id); };

function world(id) {
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  return { level, physics, rt: templeOf(level, id) ?? level.temple };
}

/** A save standing at `at` in house `rt`, loaded: the traveller there, the house's first frame. */
function load(rt, w, at) {
  const P = new Player(w.physics, { spawn: at.clone(), dynamic: w.level.dynamic });
  rt.loaded = true;   // (as main.js does, putting a save's traveller where it left him)
  rt.checkpoint = null;
  rt.connect({ player: P });
  rt.update(DT, 0);
  return P;
}

const HOUSES = Object.keys(TEMPLES).filter((id) => gateItems(TEMPLES[id].def).length);

const MOVED = ['hook', 'bubble', 'springs', 'fan', 'bridge', 'boomerang', 'bomb', 'magnet', 'monocle', 'recall'];
test('the houses with gadget gates: every one of the ten gadgets that moved in, and the bridge pen', () => {
  const gated = HOUSES.flatMap((id) => gateItems(TEMPLES[id].def).map(([it]) => it)).sort();
  for (const it of MOVED) assert.ok(gated.includes(it), `${it}: a gate`);
});

for (const id of HOUSES) {
  test(`${id}: a save past its gadget gate without the gadget gets it if earned, else is put back where the way out is open`, () => {
    const w = world(id), rt = w.rt, def = rt.def.logic;
    for (const [it, how] of gateItems(rt.def)) {
      const others = HOUSES.flatMap((h) => gateItems(TEMPLES[h].def).map(([g]) => g)).filter((g) => g !== it);
      const without = (x) => x !== it;
      const near = roomsPast(def, without), all = roomsPast(def, () => true);
      const past = [...all].filter((r) => !near.has(r));
      // (a gate only a puzzle wants, nothing past it: the shield in the Rose House; every gadget that moved in has rooms past)
      if (MOVED.includes(it)) assert.ok(past.length, `${id}/${it}: rooms past the gate`);
      if (!past.length) continue;
      // a spot in each room past the gate: its mark, or one of its pieces, that the house places in that room
      const spots = [];
      for (const m of rt.marks) if (past.includes(m.room)) spots.push([m.room, m.spot.clone()]);
      for (const q of rt.pieces) { const r = q.id && def.elements[q.id]?.room, at = q.pos ?? q.center ?? q.at; if (past.includes(r) && at?.isVector3) spots.push([r, at.clone()]); }
      const usable = spots.filter(([r, at]) => rt.roomNear(at) === r);
      assert.ok(usable.length, `${id}/${it}: a spot past the gate the house knows the room of (${past.join(', ')})`);
      for (const [room, at] of usable.slice(0, 3)) {
        // not earned: back where the way out is open, the gadget not given
        game.reset(); own([...BASE, ...others].filter((g) => g !== it));
        const P = load(rt, w, at);
        assert.equal(items.has(it), false, `${id}/${it} in ${room}: not earned, not given`);
        const now = rt.roomNear(P.pos);
        assert.ok(near.has(now), `${id}/${it}: from ${room} put back in ${now}, where the way out is open`);
        assert.ok(rt.marks.some((m) => m.spot.distanceTo(P.pos) < 0.5), `${id}/${it}: at a mark`);
        assert.ok(roomsPast(def, without).has(rt.checkpoint?.room), `${id}/${it}: the mark the save wakes at is on the near side`);
        // earned (the chest taken, the find found): the gadget is the save's, and he stays where he stood
        game.reset(); own([...BASE, ...others].filter((g) => g !== it));
        if (how.chest) game.set(`temple.${id}.gadget`, true); else game.set(`temple.${id}.found.${how.find}`, true);
        const Q = load(rt, w, at);
        assert.equal(items.has(it), true, `${id}/${it} in ${room}: earned, given`);
        assert.ok(Q.pos.distanceTo(at) < 1.5, `${id}/${it}: and left where he stood`);
      }
    }
    // a save inside on the near side is left alone
    game.reset(); own(BASE);
    const P = load(rt, w, rt.arrival.pos);
    assert.ok(P.pos.distanceTo(rt.arrival.pos) < 1.5, `${id}: at the door, nothing moves`);
    game.reset(); own([]);
  });
}

import { buildableById } from '../src/levels/buildable.js';
import { TEMPLE_HOME } from '../src/temples/attachment.js';
// No way round a shut door, in any temple (issue #356: "In the Hush-House there is a locked door but I can just jump
// around it?"). For every door of a house's links (a door of stone: not a lift, a raft, a hammer; and not one the logic
// can go round by another link), shut with every other door open (the most the house ever lets you have):
//   - the walker's flood from each side of it (a cell at a time, up what the double jump climbs, down what a fall doesn't
//     hurt, never into a pit, with room for the traveller's body: tests/fragments-reach.js's steps) never reaches the other;
//   - from near it the real traveller (src/player.js), walking on every way, never comes out on the other side (he slides
//     along a wall, through a gap the walker's cells miss);
//   - and every locked door (a key's) keeps him on his side whatever way he goes from near it or from anywhere in reach of
//     the other side: walking on, a jump, the double jump at its highest and late for its length, and the wings in the
//     houses he may have them in (every house after the Rose House: the Aerie's are had before the rest of the route).
// What it found, fixed with it: the Hush-House's ledge door (over it on the double jump, round its post from the root-wall's
// top: a cloister past it now), the Builders' Greenhouse's great lock (walked round, the antechamber's end wider than the
// door: src/temples/pieces.js Door frame), the Mooring-House's Capstan door (jumped through beside it, the rotunda's gap
// wider than the door; and the exits beside the guardians' halls the same), the Capstan Floor's windows (out over the
// void on the wings and back in past its great lock: barred, spacecity.js WINDOW_BARS). A CLI: DOOR_LOG=1 node --test
// tests/door-bypass-<n>.test.js --test-name-pattern=<the house's name>. The houses are dealt out over the files
// tests/door-bypass-<n>.test.js (doorBypass(part, of)), so no one file outlasts a shard (#445: 340 s on GitHub in one).
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import { TEMPLES } from '../src/temples/index.js';
import { Door } from '../src/temples/pieces.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { V, own, carry, fmt, buildHouse, onlyShut, joinedWithout, sides, walk, spots } from './house-walk.js';

const DT = 1 / 60;

/**
 * The probe's reach: walked on from spots within `walkNear` m of any door; from spots `every` m apart within `near` m of a
 * locked door (and `rise` m of its foot), `headings` ways; and from those within `reach` m across (`below` m under,
 * `above` m over) of the other side, toward it and `fan` either way.
 */
const PROBE = { walkNear: 4, near: 10, rise: 7, every: 2.5, headings: 8, reach: 8, below: 8, above: 7, fan: [0, 0.5, -0.5] };

/** Where to go from on side F (the walker's spots) toward side G (spots(G)), the door at `at`: [{ at, yaws }]. */
function launches(F, G, at, { near = PROBE.near, reach = PROBE.reach } = {}) {
  const grid = new Set(), out = [];
  for (const p of F) {
    const k = `${Math.round(p.x / PROBE.every)},${Math.round(p.z / PROBE.every)},${Math.round(p.y / 2)}`;
    if (grid.has(k)) continue;
    if (Math.hypot(p.x - at.x, p.z - at.z) <= near && Math.abs(p.y - at.y) <= PROBE.rise) {
      grid.add(k);
      out.push({ at: p, yaws: Array.from({ length: PROBE.headings }, (_, h) => (h / PROBE.headings) * Math.PI * 2) });
      continue;
    }
    const g = reach > 0 ? G.nearest(p, reach, -PROBE.below, PROBE.above) : null;
    if (!g) continue;
    grid.add(k);
    const toward = Math.atan2(-(g.x - p.x), -(g.z - p.z));
    out.push({ at: p, yaws: PROBE.fan.map((d) => toward + d) });
  }
  return out;
}

/**
 * From each of `starts` the traveller walks on, jumps, double jumps (o.glider: and opens the wings; o.only: these ways
 * alone); → where he comes to stand [{ from, to, how, yaw }] when `land(to)` says so.
 */
function goes(P, starts, land, { glider = false, only = null } = {}) {
  let ways = [{ how: 'walk', walk: true }, { how: 'jump' }, { how: 'double jump', at: 6 }, { how: 'late double jump', at: -5 }];
  if (glider) ways.push({ how: 'double jump and the wings', at: -1, wings: true });
  if (only) ways = ways.filter((w) => only.includes(w.how));
  const found = [];
  for (const { at: s, yaws } of starts) for (const yaw of yaws) for (const w of ways) {
    P.respawn(V(s.x, s.y + 0.05, s.z));
    P.vel.set(0, 0, 0); P.onGround = true;
    for (let i = 0; i < 2; i++) P.update(DT, {}, yaw);
    if (!P.onGround || P.pos.distanceTo(s) > 0.8) continue;
    for (let i = 0; i < 8; i++) P.update(DT, { KeyW: true, ShiftLeft: true }, yaw);   // (a run-up)
    if (!P.onGround) continue;
    let pressed = w.at == null, out = null;
    for (let f = 0; f < (w.wings ? 300 : 200); f++) {
      const inp = { KeyW: true, ShiftLeft: true };
      if (w.walk) { if (f > 90) break; }
      else if (f < 3) inp.Space = true;
      else if (!pressed && !P.onGround && P.vel.y < w.at) { inp.Space = true; pressed = true; }
      else if (w.wings && pressed && f > 6) inp.Space = true;
      P.update(DT, inp, yaw);
      if (!w.walk && f > 4 && P.onGround && !P.climbing && !P.mantle) { out = P.pos.clone(); break; }
    }
    if (w.walk && P.onGround) out = P.pos.clone();   // (walked on a second and a half)
    if (out && land(out)) found.push({ from: s.clone(), to: out, how: w.how, yaw });
  }
  return found;
}


export function doorBypass(part, of) {
  for (const id of Object.keys(TEMPLES).filter((_, i) => i % of === part)) {
    test(`${TEMPLES[id].def.name}: no way round a shut door, walked, nor round a locked one, walked, jumped or flown`, () => {
      game.reset();
      own(...carry(id));
      const { level, physics, rt } = buildHouse(id, buildableById(TEMPLE_HOME[id] ?? id).create);
      const def = rt.logic.def, K = rt.kit;
      const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: false });
      const W = { physics, level, rt };
      const bad = [];
      let doors = 0;
      for (const link of def.links) {
        const el = def.elements[link.door];
        if (el?.type !== 'door' || !(rt.byId.get(link.door) instanceof Door) || joinedWithout(def, link)) continue;
        doors++;
        const name = `${link.door} (${link.a} | ${link.b})`;
        const S = sides(rt, physics, link.door);
        assert.ok(S.from[0] && S.from[1], `${name}: a floor on both sides of it`);
        onlyShut(rt, link.door);
        const tw = Date.now(), [A, B] = S.from.map((s) => walk(W, s));
        if (process.env.DOOR_LOG) console.error(`  [${id}] ${link.door}: walked ${A.length} + ${B.length} spots in ${Date.now() - tw} ms`);
        const [hasA, hasB] = [A, B].map((f) => spots(f));
        // walked round: the way it went, near the door
        const round = [[A, S.from[1]], [B, S.from[0]]].map(([F, to]) => F.find((p) => p.distanceTo(to) < 1.3)).find(Boolean);
        if (round) {
          const way = [];
          for (let p = round; p; p = p.prev) if (Math.hypot(p.x - S.at.x, p.z - S.at.z) < 5) way.unshift(fmt(K.local(p)));
          bad.push(`${name}: walked round, by ${way.join(' > ')}`);
          continue;
        }
        for (const [F, hasF, hasG] of [[A, hasA, hasB], [B, hasB, hasA]]) {
          const starts = el.lock ? launches(F, hasG, S.at) : launches(F, hasG, S.at, { near: PROBE.walkNear, reach: 0 }), t0 = Date.now();
          const got = goes(P, starts, (p) => hasG.has(p) && !hasF.has(p), { glider: P.canGlide, only: el.lock ? null : ['walk'] });
          if (process.env.DOOR_LOG) console.error(`  [${id}] ${link.door}: ${starts.length} spots, ${Date.now() - t0} ms, ${got.length} ways round`);
          if (got.length) { const g = got[0]; bad.push(`${name}: ${got.length} ways round, e.g. a ${g.how} from ${fmt(K.local(g.from))} heading ${g.yaw.toFixed(2)} to ${fmt(K.local(g.to))}`); break; }
        }
      }
      assert.ok(doors > 0, 'doors to try');
      assert.deepEqual(bad, [], `${id}: ${bad.join('; ')}`);
    });
  }
}

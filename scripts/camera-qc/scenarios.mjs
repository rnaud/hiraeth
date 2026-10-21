// The camera QC's scenarios (.claude/skills/camera-qc/SKILL.md): where each starts and what the hands do, segment by
// segment. A segment: { for (s), path: [[x, z] | [x, y, z], …] (walked to in turn), stick: [x, y] (camera-relative),
// wander: true (forward, turning away from what it meets), run, jumpEvery (s), hold (jump held: the wings), turn / pitch (deg/s of the camera,
// as the right stick), steer (deg/s: the camera turned after where you walk, as a player does), lock (Tab: lock on) }.
// A scenario: { name, world, about, at ([x, y, z]: teleported there), yaw (the camera's), setup (page code run first),
// flags (the save it boots with), query, settle (s), segs }.
import { CARS, car, FLOOR, WALK, NOSE_X, SHIP_SITE } from '../../src/levels/overnight-train.js';
import { TR } from '../../src/levels/overnight-train-kit.js';

// ------------------------------------------------------------------ the Overnight Train: the way through, from the deck to the balcony
const WAY = { prow: 0, dining: 0, sleeper: -2.1, dome: -0.5 };
const forward = [];
for (const c of CARS.filter((q) => WAY[q.kind] !== undefined).reverse()) {
  const z = WAY[c.kind];
  forward.push([c.x0 - 1.6, 0], [c.x0 + 1.2, 0], [c.x0 + 1.6, z], [c.x1 - 1.6, z], [c.x1 - 1.2, 0]);
}
forward.push([NOSE_X + 2.6, 0]);
const LW = car('landing'), D = car('dining'), S0 = car('sleeper', 0), B = car('dome');
const deck = [LW.x1 - 3, FLOOR + 0.1, 0];
const along = -Math.PI / 2;   // (the camera's yaw looking toward the nose, +x)

// ------------------------------------------------------------------ the Undertower's antechamber, locked on (ante-lock)
// [along the way in (+: toward the hall), across it (+: to his left going in)] from the blot in the room's middle (m); the
// room 8 m across and 6.9 m along, open on the far side to the passage into the hall, its jamb's end at about [3.8, -3.5]
export const ANTE_WAY = {
  round: [[-2.6, 0], [-2, -2], [0, -2.9], [2, -2], [2.8, 0]],         // (half round it, a wall at his back on the way)
  corner: [[3.2, -3.3]],                                                   // (backed into the corner by the door, the jamb beside him)
  in: [[1.6, -1.6]],                                                       // (a step in)
  back: [[2.8, 0], [2, 2], [0, 2.9], [-2, 2], [-2.6, 0]],             // (and half round the other way)
};
export const ANTE_SEGS = [{ for: 1, lock: true }, { for: 6, path: 'round', pace: 0.6, near: 0.35 }, { for: 3, path: 'corner', pace: 0.5 }, { for: 1.5 },
  { for: 2, path: 'in', pace: 0.5 }, { for: 3, path: 'corner', pace: 0.5 }, { for: 1 }, { for: 7, path: 'back', pace: 0.6, near: 0.35 }];

// ------------------------------------------------------------------ aboard the ship (ship-walk, issue #324): ship-local [x, z]
// (the ship twice the blockout's size since issue #338: the main room z -13.8..6.3 and |x| < 7.6, the holo table's console
// round (-0.2, -6.2), the bunk's alcove at x 6.4, z -7.35..-4.65, the cockpit forward of z -13.8, the cabin and the hold
// aft through 4.2 m doorways on the centre line; the blockout's way, each point twice as far out, one moved off a crate)
export const SHIP_WAY = {
  round: [[-4.6, -2], [-4.6, -11.2], [0, -13.2], [0, -16.4], [1.2, -12.8], [3, -10.8], [2.8, -3], [3.2, 3.6], [-2.8, 3.6], [-4.6, -2]],
  aft: [[0, 4.8], [0, 11], [2.2, 11.8], [0, 15.2], [0, 18.6], [-1.0, 19.6], [0, 17.6], [0, 8], [0, 2.4], [-4.4, 0.9]],
};

// Keep the real landing spawn, but aim the open-sand exercise south (-Z), away from Qanat.
// The city-facing arrival heading now crosses roofs before its first turn; that is not open-ground framing.
// Interior/roof collision coverage remains in desert-shop, ship-walk and train-roof.
export const DESERT_OPEN_YAW = 0;

export const SCENARIOS = [
  // ---------------------------------------------------------------- the train
  { name: 'train-walk', world: 'overnighttrain', about: 'walking from the landing deck through the library, the sleepers and the dining car to the balcony, the camera turned after the way',
    at: deck, yaw: along, segs: [{ for: 75, path: forward, steer: 120 }] },
  { name: 'train-run', world: 'overnighttrain', about: 'the same way at a run',
    at: deck, yaw: along, segs: [{ for: 45, path: forward, steer: 160, run: true }] },
  { name: 'train-turns', world: 'overnighttrain', about: 'standing in the dining car’s aisle: a full turn each way, a look up and down, then walking the aisle with the camera turning',
    at: [D.xc, FLOOR + 0.1, 0], yaw: along, segs: [{ for: 3, turn: 120 }, { for: 3, turn: -120 }, { for: 1.2, pitch: 40 }, { for: 1.5, pitch: -40 }, { for: 6, path: [[D.x1 - 3, 0], [D.x0 + 3, 0]], turn: 45 }] },
  { name: 'train-sleeper', world: 'overnighttrain', about: 'the sleeping car’s narrow corridor, walking along it and back, turning round in it',
    at: [S0.x0 + 2, FLOOR + 0.1, -2.1], yaw: along, segs: [{ for: 12, path: [[S0.x1 - 2, -2.1]] }, { for: 3, turn: 90 }, { for: 12, path: [[S0.x0 + 2, -2.1]], steer: 120 }] },
  { name: 'train-jumps', world: 'overnighttrain', about: 'jumping along the dining car and across a porch',
    at: [D.x0 + 2, FLOOR + 0.1, 0], yaw: along, segs: [{ for: 12, path: [[D.x1 - 1.6, 0], [D.x1 + 1.2, 0], [car('prow').x0 + 3, 0]], jumpEvery: 1.1, steer: 120 }] },
  { name: 'train-roof', world: 'overnighttrain', about: 'along the roof walk from past the sky lounge forward, over the plank bridges, at a run',
    at: [B.x1 - 3, WALK + 0.3, 0], yaw: along, segs: [{ for: 40, path: [[B.x1 - 0.5, 0], [S0.x0 + 1, 0], [S0.x1, 0], [car('sleeper', 1).x1 + 1, 0], [D.x1 - 1, 0], [car('prow').x1 - 3, 0]], run: true, steer: 120 }] },
  { name: 'train-deck', world: 'overnighttrain', about: 'round the ship on the landing wagon’s deck, by its rails',
    at: [SHIP_SITE.x + 12, FLOOR + 0.1, 10], yaw: along, segs: [{ for: 30, path: [[LW.x0 + 3, 11], [LW.x0 + 3, -11], [LW.x1 - 3, -11], [LW.x1 - 3, 11]], steer: 120 }] },
  // ---------------------------------------------------------------- the open, a town, a room, a fight
  // (framing: the traveller's height on the screen judged on foot in the open, Sable's third of the frame: lib.mjs LIMITS.framing)
  { name: 'desert-open', world: 'desert', about: 'running south across the open sand from the landing: turns, jumps', framing: true, yaw: DESERT_OPEN_YAW,
    segs: [{ for: 8, stick: [0, 1], run: true }, { for: 4, stick: [0, 1], run: true, turn: 70 }, { for: 6, stick: [0, 1], run: true, jumpEvery: 1.3 }, { for: 4, turn: -150 }, { for: 6, stick: [0.6, 0.8] }] },
  { name: 'desert-shop', world: 'desert', about: 'inside Qanat’s shop (an 8 × 7 m room): round the room between the counter and the door, turning, the camera after the way',
    setup: `const s = level.shops?.[0]; if (s) { const c = s.counter.at, l = s.counter.look, d = new THREE.Vector3(c.x - l.x, 0, c.z - l.z).normalize(), r = new THREE.Vector3(-d.z, 0, d.x);
      const P = (a, b) => { const p = c.clone().addScaledVector(d, a).addScaledVector(r, b); return [p.x, p.z]; };
      window.__cqPaths = { shop: [P(1, 2.6), P(2.4, 2.6), P(2.4, -2.6), P(1, -2.6), P(1, 2.6), P(2.2, 0.5)] };
      player.teleport(c.clone().addScaledVector(d, 1.2), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); rig.yaw = Math.atan2(d.x, d.z); }`,
    segs: [{ for: 24, path: 'shop', steer: 100 }, { for: 3, turn: 100 }] },
  // (issue #324, the author: "walking in my ship the camera keeps tilting up and clipping through my character": aboard
  // the parked ship, round the main room, into the cockpit, past the bunk, through the cabin to the hold and back, the
  // camera after the way; SHIP_WAY in ship-local [x, z], DECK 0)
  { name: 'ship-walk', world: 'desert', about: 'aboard the ship: round the main room, into the cockpit, by the bunk, through the cabin to the hold and back, the camera after the way',
    setup: `const m = window.ship?.parked; if (m) { const V = THREE.Vector3, W = ([x, z]) => { const p = ship.world(m, new V(x, 0, z)); return [p.x, p.z]; };
      window.__cqPaths = Object.fromEntries(Object.entries(${JSON.stringify(SHIP_WAY)}).map(([k, w]) => [k, w.map(W)]));
      const a = ship.world(m, m.interior.points.aboard), f = ship.world(m, new V(0, 0, -1)).sub(ship.world(m, new V(0, 0, 0))).setY(0).normalize();
      player.teleport(a.add(new V(0, 0.05, 0)), new V(0, 1, 0), f); rig.yaw = Math.atan2(-f.x, -f.z); rig.pitch = 0.1; }`, settle: 2,
    // (then the stick alone, the camera left where it is: toward the camera until the wall behind it, across, away, toward it
    // again after a turn by hand: walking back into the lens is where it went up under the ceiling and through him)
    // (the walks twice as long as before issue #338, the rooms twice the size; the stick held toward the camera for longer: its wall is further)
    segs: [{ for: 64, path: 'round', pace: 0.7, near: 0.4, steer: 110 }, { for: 4, turn: 90 }, { for: 34, path: 'aft', pace: 0.7, near: 0.4, steer: 110 },
      { for: 8, stick: [0, -1] }, { for: 2, stick: [1, 0] }, { for: 6, stick: [0, -1] }, { for: 3, stick: [-1, -0.4] }, { for: 2, stick: [0, 1] }, { for: 6, stick: [0, -1] },
      { for: 2, turn: -90 }, { for: 8, stick: [0, -1] }, { for: 3, stick: [0.6, 1] }, { for: 6, stick: [0, -1] }] },
  { name: 'bazaar-streets', world: 'bazaar', about: 'the Signal Market’s streets from the landing: wandering between the stalls with the camera after the way',
    segs: [{ for: 30, wander: true, heading: Math.PI, steer: 90 }] },
  // ---------------------------------------------------------------- locked on in a temple (issue #236): the Signal Market's
  // temple, its antechamber (ANTE, 8.8 x 7.4 m, issue #195: the close arm fitted to the room) and the First Sign's Hall
  // (a guardian 20 m across, tall: no swing off the line). The hall's axis from the ante's stone: src/temples/bazaar.js.
  { name: 'ante-lock', world: 'bazaar', runs: 3, about: 'in the Signal Market temple’s antechamber, locked on to an ink blot held in its middle: half round it each way at a walk, and twice back into the corner by the door to the hall, on purpose',
    setup: `const rt = (level.temples ?? []).find((t) => t.guardian && t.marks.some((m) => m.room === 'ante')); if (rt) {
      const V = THREE.Vector3, K = rt.kit, o = K.world(0, 0, 0), ax = K.world(0, 0, 1).sub(o).normalize(), sx = K.world(1, 0, 0).sub(o).normalize();
      const m = rt.marks.find((q) => q.room === 'ante'), mid = m.pos.clone().addScaledVector(sx, -(${4.4 - 1}));   // (the room's middle: its stone is half - 1 off it)
      foes.setPractice(''); foes.list.slice().forEach((x) => foes.remove(x)); foes.waveRest = 1e9; player.health = 1;
      window.__cqHeal ??= setInterval(() => { if (window.player) player.health = 1; }, 200);
      player.teleport(mid.clone().addScaledVector(ax, -2.6).add(new V(0, 0.1, 0)), new V(0, 1, 0), ax.clone());
      rig.yaw = Math.atan2(-ax.x, -ax.z);
      // (the way, in the room's own terms: ANTE_WAY, along the way in and across it from the blot)
      const side = new V(ax.z, 0, -ax.x), P = ([a, b]) => { const p = mid.clone().addScaledVector(ax, a).addScaledVector(side, b); return [p.x, p.z]; };
      window.__cqPaths = Object.fromEntries(Object.entries(${JSON.stringify(ANTE_WAY)}).map(([k, w]) => [k, w.map(P)]));
      const f = foes.add('blot', mid.clone()); f.update = () => []; f.state = 'chase'; }`, settle: 3,
    // (the blot held still in the room's middle, as the lizard: a bite's knock-down is not the camera's to judge. The way
    // walked by points, not by a held stick: locked on, the stick reads from the camera's own turn, so a millisecond's
    // difference in a frame took him somewhere else each run, and only one run in two to the corner; issue #289)
    segs: ANTE_SEGS },
  { name: 'guardian-lock', world: 'bazaar', about: 'in the First Sign’s Hall, locked on to the guardian awake: circling it each way, stepping back and in',
    setup: `const rt = (level.temples ?? []).find((t) => t.guardian && t.marks.some((m) => m.room === 'ante')); if (rt) {
      const V = THREE.Vector3, G = rt.guardian, A = G.arena, K = rt.kit, o = K.world(0, 0, 0), ax = K.world(0, 0, 1).sub(o).normalize();
      foes.list.slice().forEach((x) => foes.remove(x)); player.health = 1;
      window.__cqHeal ??= setInterval(() => { if (window.player) player.health = 1; }, 200);
      player.teleport(A.center.clone().addScaledVector(ax, -(A.r - 5)).setY(A.y + 0.1), new V(0, 1, 0), ax.clone());
      rig.yaw = Math.atan2(-ax.x, -ax.z);
      // (awake and turning to face him, its blows held: a knock-down is not the camera's to judge)
      if (G.state === 'sleep') G.wake(); G.enter('fight'); G.fight = (dt) => { G.face(dt, player.pos, 1); return 0; }; }`, settle: 4,
    segs: [{ for: 1, lock: true }, { for: 8, stick: [1, 0] }, { for: 2, stick: [0, -1] }, { for: 8, stick: [-1, 0.2], run: true }, { for: 2, stick: [0, 1] }] },
  // (issue #359, "with the mother snapper I cut off after the torso": locked on a guardian the camera frames you both whole,
  // the floor between; src/lock-frame.js. Every guardian in node: scripts/camera-qc/sim-guardians.mjs)
  { name: 'snapper-lock', world: 'perdide', about: 'in the Hush-House, locked on to the Mother Snapper awake: circling it each way, stepping back and in',
    setup: `const rt = (level.temples ?? []).find((t) => t.id === 'perdide' && t.guardian); if (rt) {
      const V = THREE.Vector3, G = rt.guardian, A = G.arena, c = G.model.home ?? A.center;
      const away = new V(A.center.x - c.x, 0, A.center.z - c.z); if (away.length() < 1) away.set(0, 0, -1); away.normalize();
      foes.list.slice().forEach((x) => foes.remove(x)); player.health = 1;
      window.__cqHeal ??= setInterval(() => { if (window.player) player.health = 1; }, 200);
      player.teleport(c.clone().addScaledVector(away, 9).setY(A.y + 0.1), new V(0, 1, 0), away.clone().negate());
      rig.yaw = Math.atan2(away.x, away.z);
      // (awake and turning to face him, its blows held: a knock-down is not the camera's to judge)
      if (G.state === 'sleep') G.wake(); G.enter('fight'); G.fight = (dt) => { G.face(dt, player.pos, 1); return 0; }; }`, settle: 4,
    segs: [{ for: 1, lock: true }, { for: 8, stick: [1, 0] }, { for: 2, stick: [0, -1] }, { for: 8, stick: [-1, 0.2], run: true }, { for: 2, stick: [0, 1] }] },
  // ---------------------------------------------------------------- rising air (src/updraft.js): the City-Shaft's halfway air pillar
  { name: 'incal-pillar', world: 'incal', about: 'riding the City-Shaft’s halfway air pillar on the wings: straight up past the terraces, the camera turned while rising, then steered out of it',
    flags: { 'item.backpack': true, 'item.glider': true }, at: [-53.3, -60, 179.2], yaw: 5.0, settle: 2,
    segs: [{ for: 12, hold: true }, { for: 6, hold: true, turn: 50 }, { for: 3, hold: true, pitch: 25 }, { for: 4, hold: true, stick: [1, 0] }] },
  { name: 'arena-lock', world: 'arena', runs: 3, about: 'locked on to an ink blot: circling it, stepping in and back',
    // (from the Arena's spawn, facing north, whatever the run before left, the blot's chances seeded: each run the same)
    setup: `foes.setPractice(''); foes.list.slice().forEach((x) => foes.remove(x)); if (window.__cqRand) foes.rng = window.__cqRand; player.health = 1;
      window.__cqHeal ??= setInterval(() => { if (window.player) player.health = 1; }, 200);
      { const V = THREE.Vector3; player.teleport(new V(0, 0, 6), new V(0, 1, 0), new V(0, 0, -1)); player.heading = Math.PI;
        const F = player.frame; if (F?.right) rig.yaw = Math.atan2(F.right.z, F.fwd.z); }
      foes.setPractice('blot');`, settle: 3,
    segs: [{ for: 1, lock: true }, { for: 8, stick: [1, 0] }, { for: 3, stick: [0, 1] }, { for: 3, stick: [0, -1] }, { for: 6, stick: [-1, 0.3], run: true }] },
  // (combat-v1.47: the lock camera lined a small foe up behind the traveller; the foe hidden is measured while locked)
  { name: 'arena-lock-lizard', world: 'arena', about: 'locked on to a horn lizard standing 7 m off to one side: standing, circling it each way, stepping back and in',
    // (from the Arena's spawn, facing north, whatever the scenario before left: the lizard 7 m ahead, 2.4 m to the left)
    setup: `foes.setPractice(''); foes.list.slice().forEach((x) => foes.remove(x)); foes.waveRest = 1e9; player.health = 1;
      { const V = THREE.Vector3; player.teleport(new V(0, 0, 6), new V(0, 1, 0), new V(0, 0, -1)); player.heading = Math.PI;
        const F = player.frame; if (F?.right) rig.yaw = Math.atan2(F.right.z, F.fwd.z);   // (the camera behind him, as main.js's lock sets it for a foe due north)
        const f = foes.add('lizard', new V(-2.4, 0, -1)); f.heading = 0; f.update = () => []; f.state = 'chase'; }`, settle: 3,
    segs: [{ for: 1, lock: true }, { for: 3 }, { for: 5, stick: [1, 0.3] }, { for: 1.5, stick: [0, -1] }, { for: 5, stick: [-1, 0.3] }, { for: 2, stick: [0, 1] }] },
];

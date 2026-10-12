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
  { name: 'desert-open', world: 'desert', about: 'running across the open sand from the landing: turns, jumps', framing: true,
    segs: [{ for: 8, stick: [0, 1], run: true }, { for: 4, stick: [0, 1], run: true, turn: 70 }, { for: 6, stick: [0, 1], run: true, jumpEvery: 1.3 }, { for: 4, turn: -150 }, { for: 6, stick: [0.6, 0.8] }] },
  { name: 'desert-shop', world: 'desert', about: 'inside Qanat’s shop (an 8 × 7 m room): round the room between the counter and the door, turning, the camera after the way',
    setup: `const s = level.shops?.[0]; if (s) { const c = s.counter.at, l = s.counter.look, d = new THREE.Vector3(c.x - l.x, 0, c.z - l.z).normalize(), r = new THREE.Vector3(-d.z, 0, d.x);
      const P = (a, b) => { const p = c.clone().addScaledVector(d, a).addScaledVector(r, b); return [p.x, p.z]; };
      window.__cqPaths = { shop: [P(1, 2.6), P(2.4, 2.6), P(2.4, -2.6), P(1, -2.6), P(1, 2.6), P(2.2, 0.5)] };
      player.teleport(c.clone().addScaledVector(d, 1.2), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); rig.yaw = Math.atan2(d.x, d.z); }`,
    segs: [{ for: 24, path: 'shop', steer: 100 }, { for: 3, turn: 100 }] },
  { name: 'bazaar-streets', world: 'bazaar', about: 'the Signal Market’s streets from the landing: wandering between the stalls with the camera after the way',
    segs: [{ for: 30, wander: true, heading: Math.PI, steer: 90 }] },
  // ---------------------------------------------------------------- locked on in a temple (issue #236): the Signal Market's
  // temple, its antechamber (ANTE, 8.8 x 7.4 m, issue #195: the close arm fitted to the room) and the First Sign's Hall
  // (a guardian 20 m across, tall: no swing off the line). The hall's axis from the ante's stone: src/temples/bazaar.js.
  { name: 'ante-lock', world: 'bazaar', about: 'in the Signal Market temple’s antechamber, locked on to an ink blot in its middle: half round it at a walk each way, a step in and back between the walls',
    setup: `const rt = (level.temples ?? []).find((t) => t.guardian && t.marks.some((m) => m.room === 'ante')); if (rt) {
      const V = THREE.Vector3, K = rt.kit, o = K.world(0, 0, 0), ax = K.world(0, 0, 1).sub(o).normalize(), sx = K.world(1, 0, 0).sub(o).normalize();
      const m = rt.marks.find((q) => q.room === 'ante'), mid = m.pos.clone().addScaledVector(sx, -(${4.4 - 1}));   // (the room's middle: its stone is half - 1 off it)
      foes.setPractice(''); foes.list.slice().forEach((x) => foes.remove(x)); foes.waveRest = 1e9; player.health = 1;
      window.__cqHeal ??= setInterval(() => { if (window.player) player.health = 1; }, 200);
      player.teleport(mid.clone().addScaledVector(ax, -2.6).add(new V(0, 0.1, 0)), new V(0, 1, 0), ax.clone());
      rig.yaw = Math.atan2(-ax.x, -ax.z);
      const f = foes.add('blot', mid.clone()); f.update = () => []; f.state = 'chase'; }`, settle: 3,
    // (the blot held still in the room's middle, as the lizard: a bite's knock-down is not the camera's to judge)
    segs: [{ for: 1, lock: true }, { for: 3, stick: [0.6, 0] }, { for: 1, stick: [0, 0.5] }, { for: 1, stick: [0, -0.5] }, { for: 4, stick: [-0.6, 0] }] },
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
  // ---------------------------------------------------------------- rising air (src/updraft.js): the City-Shaft's halfway air pillar
  { name: 'incal-pillar', world: 'incal', about: 'riding the City-Shaft’s halfway air pillar on the wings: straight up past the terraces, the camera turned while rising, then steered out of it',
    flags: { 'item.backpack': true, 'item.glider': true }, at: [-53.3, -60, 179.2], yaw: 5.0, settle: 2,
    segs: [{ for: 12, hold: true }, { for: 6, hold: true, turn: 50 }, { for: 3, hold: true, pitch: 25 }, { for: 4, hold: true, stick: [1, 0] }] },
  { name: 'arena-lock', world: 'arena', about: 'locked on to an ink blot: circling it, stepping in and back',
    setup: `foes.setPractice('blot'); player.health = 1;`, settle: 3,
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

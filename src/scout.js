import * as THREE from 'three';
import { makeMaterial, markHero } from './materials.js';
import { sweepCapsule } from './physics.js';
import { Trail } from './trail.js';
import { Drone, DroneFold } from './drone.js';

const RADIUS = 0.25;     // the drone's collision sphere
const CLEAR = 0.9;       // air it keeps below itself while flying
const MIN_CLEAR = 0.35;  // never lower than this over the ground
const STEER = 6;         // velocity response (1/s): smooth, no jitter
// Finding the objective (ping: Q, D-pad →, the touch "ping"): it comes (APPEAR), flies a little
// way towards it (or over it, when it is close), hovers there facing it (its own heading is the pointer: no beak,
// no beam), drops a flare on the spot, chirps, and goes. Nothing to find: it comes and shakes itself, no.
// In a guardian's fight the ping asks it for a hint instead (HINT): it rises over your shoulder,
// turns its lens on the weak point (or the thing to use) with a short beam, chirps, and the cue says
// what to do; asked again, it says it more plainly (src/temples/boss.js guardianHint).
export const FIND = {
  near: 14,       // m: closer than this, it flies right over the objective
  out: 7,         // m: otherwise this far towards it (plus a little for your speed), from where you are
  rise: 3.2,      // m over your feet (2.2 m over the objective when it flies to it)
  // up and down as well (lookoutSpot): a goal above you, it climbs toward its height, at most `climb` m
  // over your feet; one below, it sinks by how much deeper than `level` m it is, at most `dive` m under
  // them; and the more it climbs or sinks, the further out it goes (`spread` m per m), so it stays in
  // the camera's view behind you (measured in the Desert: 7 m out, 9 m over your feet is off the top)
  climb: 6.5,     // m over your feet at most (a rooftop, a tower's deck)
  shaft: 20,      // m over your feet at most when the goal is steeply overhead (up a shaft, through the oculus,
                  // a tower you stand at the foot of): from twice as high as it is far, between the two below that
  dive: 6,        // m under your feet at most (a pit, a cave below, the floor under this one)
  level: 4,       // m: a goal less than this below you is on your floor (it stays over your head)
  spread: 0.5,    // m further out per m it climbs or sinks
  seek: 4,        // s at most to get there
  point: 2.6,     // s hovering, facing it
  max: 9,         // s from the ping to heading home, whatever happens
  say: 6,         // s the find's line stays on the cue once the drone is there (it is up from the ping: onPing)
  shrug: 1.0,     // s: the little shake, no (between its coming and going)
};
/**
 * Keeping you company (issue #434): after the prologue it rides at your shoulder (APPEAR's spot) a while, until it has
 * something to say and somewhere to fly (a ping), or `secs` run out and it winks out into its light.
 */
export const ESCORT = { secs: 60 };
/** A hint in a guardian's fight: from just over your shoulder, the lens on the weak point for a while. */
export const HINT = {
  out: 1.6,       // m towards it from over your head (it stays by you: the fight is all round)
  rise: 2.6,      // m over your head
  point: 4.2,     // s with the beam on the weak point
  beam: 40,       // m: the longest the hint's beam reaches
  say: 7,         // s the line stays on the cue
};
const PITCH = 0.4;       // the body's most nose-up or nose-down (rad); the lens (its beam, in a hint) turns the rest of the way
const LEAN = { perSpeed: 0.03, max: 0.3 };   // it leans into its speed (rad per m/s, at most)
// Coming and going (issue #294: it is not carried on you, it comes when it is needed). Out of a small
// light over your left shoulder, a little behind you (in the camera's view), it grows, folded, its eye
// waking, and blooms; it flies its errand; then it rises away, folds, and winks out into the light.
export const APPEAR = {
  side: 0.55,     // m to your left of your head
  back: 0.35,     // m behind it
  over: 0.5,      // m over it (less under a ceiling)
  grow: 0.42,     // s: the light swells and the drone grows out of it
  bloomAt: 0.5,   // of the grow: the petals open from here
  leave: 0.8,     // s: rising away before it winks out
  rise: 2.4,      // m/s: how fast it rises away
  wink: 0.3,      // s: shrinking into the light, and gone
  light: 0.17,    // m: the light's radius at its brightest
};
/**
 * Something to tell you (issue #543, src/companion.js CRITICAL): at your shoulder (an escort), it hops now and then and
 * turns to you, a mark over it (an inked "!" of its glow, warm red); Plumb's button opens the talk.
 */
export const HAIL = {
  over: 0.42,     // m: the mark over the drone (clear of its antenna)
  size: 0.15,     // m: the mark's scale (about 0.3 m tall: as big as the drone, seen from behind you)
  every: 1.7,     // s between two hops
  hop: 0.11,      // m: how high it hops
  colour: '#e2643c',
};
/** The talk (issue #543): it hovers before your face, facing you, while the dialogue box shows its pages. */
export const TALK = {
  out: 1.05,      // m in front of your head (nearer than a person stands, src/story/spacing.js talkSpace: it is small)
  near: 0.7,      // m at the least, against a wall
  below: 0.12,    // m under your eyes' height
  bob: 0.035,     // m: its idle float; and as much again on each syllable it says
};
const _d = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3(), _n = new THREE.Vector3(), _f = new THREE.Vector3();
const _s = new THREE.Vector3(), _p = new THREE.Vector3(), _o = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _h = new THREE.Vector3(), _ax = new THREE.Vector3(), _qt = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);
const _y1 = new THREE.Vector3(0, 1, 0), _lk = new THREE.Vector3(), _lk2 = new THREE.Vector3(), _bm = new THREE.Vector3();
const _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _lv = new THREE.Vector3(), _d2 = new THREE.Vector3(), _f2 = new THREE.Vector3(), _o2 = new THREE.Vector3(), _lean = new THREE.Vector2(), _lv2 = new THREE.Vector3(), _go = new THREE.Vector3();

const objective = (id, label, position) => ({ id, label, position: position.clone() });

/**
 * Resolve the next actionable step, using the same progress as the journal.
 * `quest`: the tracked quest's objective ({ id, label, position }, or a
 * function returning it; src/story/quests.js). It comes first, except while
 * the observatory expedition is under way; then the expedition, then the
 * world's story goal (its beacon), then, once the story is told, the ship.
 * null: nothing to find here.
 */
export function nextObjective({ player, expedition, story, ship = null, level, quest = null }) {
  let target;
  const q = typeof quest === 'function' ? quest() : quest;
  const expeditionUnderWay = expedition && expedition.state.started && !expedition.state.returned;
  if (q && !expeditionUnderWay) target = objective(q.id, q.label, q.position);
  else if (expedition && !expedition.state.returned) {
    const { state, model, traveler } = expedition;
    if (!state.started || state.done) {
      target = objective('traveler', state.done ? 'Return to the traveler' : 'Meet the traveler', traveler.pos);
    } else {
      const horizontal = Math.hypot(player.pos.x - model.center.x, player.pos.z - model.center.z);
      if (player.pos.y < model.center.y - 2) {
        const i = model.ledges.findIndex((p) => p.y > player.pos.y + 1);
        const tier = i < 0 ? model.center : model.ledges[i];
        const direction = player.pos.clone().sub(model.center).setY(0);
        if (direction.lengthSq() < 0.01) direction.set(0, 0, 1);
        const radius = i < 0 ? 16 : Math.abs(tier.x - model.center.x);
        const p = model.center.clone().addScaledVector(direction.normalize(), radius);
        p.y = tier.y;
        target = objective(`ledge-${i}`, horizontal > 65 ? 'The sleeping observatory' : i < 0 ? 'Enter the lens chamber' : `Climb to ledge ${i + 1}`, p);
      } else {
        const i = model.receivers.findIndex((r) => !r.visible);
        target = i < 0 ? objective('observatory', 'Watch the roof open', model.center)
          : objective(`lens-${i}`, `Turn lens ${i + 1} toward the centre`, model.dials[i].getWorldPosition(new THREE.Vector3()));
      }
    }
  } else if (story && !story.done) target = objective('story', story.def.label, story.goal);
  // the world's story told: on to the ship (from away from it; the relics are yours to find)
  else if (ship?.pos && player.pos.distanceTo(ship.pos) > SHIP_NEAR) target = objective('ship', 'Back to the ship', ship.pos);
  return target ? viaPortal(player.pos, target, level.navigationPortals ?? level.portals ?? []) : null;
}
const SHIP_NEAR = 25;   // m: at the ship already, there is nothing more to find

/**
 * Where the scout looks from, in three dimensions (a fresh or `out` Vector3): over your head and a
 * little way towards the goal (`FIND.out`, more at speed), right over it when it is within
 * `FIND.near`, and at its height as well: a goal above you, it climbs toward it (2.2 m over its
 * level, at most `FIND.climb` m over your feet, `FIND.shaft` when it is steeply overhead); one well
 * below, it sinks toward it (by how much deeper than `FIND.level` it is, at most `FIND.dive` m under
 * your feet), further out the more it climbs or sinks (`FIND.spread`). A hint stays at
 * `HINT.rise` by you (the fight is all round). The way there is three legs from your head, each cut
 * short (`margin` m) where `ray(origin, dir, far)` (distance to the first thing hit, or Infinity)
 * meets something: up (to the higher of the two heights, under a ceiling), out (along the ground's
 * plane, short of a wall), down (to the goal's height, over a floor). So the spot is always in the
 * open and in reach from where you stand: up a shaft, out over a ledge, under the room's ceiling.
 * Returns `out`; `legs` (an array, when given) gets the two corners [up, out] for the flight's way round.
 *   feet: your position, goal: the objective, up: the world's up (unit), pSpeed: your speed.
 */
export function lookoutSpot({ feet, goal, up, pSpeed = 0, hint = false, ray = null, legs = null, margin = 0.6 }, out = new THREE.Vector3()) {
  const toGoal = _ls.subVectors(goal, feet), dy = toGoal.dot(up);
  const flat = toGoal.addScaledVector(up, -dy), range = flat.length();
  const near = !hint && Math.hypot(range, dy) < FIND.near;
  const base = hint ? HINT.rise : FIND.rise;
  // the height over your feet it looks from
  let H = base;
  if (near) H = dy + 2.2;
  else if (!hint && dy > base - 2.2) {
    const steep = THREE.MathUtils.clamp(dy / Math.max(range, 1e-3) - 1, 0, 1);   // 0 up to 45°, 1 from twice as high as far
    H = Math.min(dy + 2.2, THREE.MathUtils.lerp(FIND.climb, FIND.shaft, steep));
  }
  else if (!hint && dy < -FIND.level) H = Math.max(base + dy + FIND.level, -FIND.dive);
  // how far out along the ground's plane
  const reach = near ? range : Math.max(0, Math.min(range - 2, (hint ? HINT.out : FIND.out + Math.abs(H - base) * FIND.spread) + pSpeed * 0.4));
  if (range > 1e-3) flat.divideScalar(range); else flat.set(0, 0, 0);
  const free = (o, d, len) => {
    if (!(len > 1e-3)) return 0;
    const t = ray ? ray(o, d, len + margin) : Infinity;
    return t < len + margin ? Math.max(0, t - margin) : len;
  };
  const head = _lh.copy(feet).addScaledVector(up, HEAD);
  const top = Math.max(H, base);
  // up: to the higher height (cut short under a ceiling)
  out.copy(head).addScaledVector(up, free(head, up, top - HEAD));
  if (legs) (legs[0] ??= new THREE.Vector3()).copy(out);
  // out: towards the goal (cut short at a wall)
  if (reach > 1e-3) out.addScaledVector(flat, free(out, flat, reach));
  if (legs) (legs[1] ??= new THREE.Vector3()).copy(out);
  // down: to the goal's height (over a floor)
  if (H < top) out.addScaledVector(up, -free(out, _ld.copy(up).negate(), top - H));
  return out;
}
const HEAD = 1.6;   // m: your head over your feet, where the legs start
const _ls = new THREE.Vector3(), _lh = new THREE.Vector3(), _ld = new THREE.Vector3();

/** "320 m", "1.4 km": a rough distance for the find's toast. */
export function roughDistance(d) {
  if (d < 1000) return `${d < 100 ? Math.max(1, Math.round(d)) : Math.round(d / 10) * 10} m`;
  return `${(d / 1000).toFixed(1)} km`;
}
/**
 * The find's toast: what it found and roughly how far ("Madame Sel, under the silent tower · 320 m"),
 * and how far up or down when that is a good part of the way (`target.rise`, m over your feet:
 * "The observation deck · 60 m, 40 m above").
 */
export function findText(target, d) {
  const rise = target.rise ?? 0, far = `${target.label} · ${roughDistance(d)}`;
  if (Math.abs(rise) < FIND.level + 2 || Math.abs(rise) < d * 0.3) return far;
  return `${far}, ${roughDistance(Math.abs(rise))} ${rise > 0 ? 'above' : 'below'}`;
}

/**
 * The closed space a portal's end lies in (a room built off the map, a temple's rooms), or null for the open world.
 * portalPair tags its two ways (src/interiors.js: `toSpace` in, `fromSpace` out); a temple's door leads into
 * `temple:<id>` and its ways out (toUp) leave it.
 */
const spaceFrom = (p) => p.fromSpace ?? (p.temple && p.toUp ? `temple:${p.temple}` : null);
const spaceTo = (p) => p.toSpace ?? (p.temple && !p.toUp ? `temple:${p.temple}` : null);
/** How far up or down a find may be from a closed space's door and still be in it (the rooms are built far over the map). */
const IN_SPACE = 400;
/** How near one of a room's ways out you are to be in that room (the shops' rooms are a few metres, a slot 90 m apart). */
const ROOM_NEAR = 40;

/**
 * Use doorways / gravity portals when they shorten the route. A walk joins two ends only in the same space: out of a
 * room you go back through its own door, never across the void to another room built near it (issue #351: from Vael's
 * riders' gate the way to Sister Aube went in at one shop's door and out of the other shop's, a field away).
 */
export function viaPortal(start, target, portals) {
  const links = portals.map((p) => ({ from: p.at ?? p.pos, to: p.to, label: p.label ?? 'doorway', fromSpace: spaceFrom(p), toSpace: spaceTo(p) })).filter((p) => p.from && p.to);
  const nodes = [start, ...links.map((p) => p.to)];
  // (where you stand now: in a room when one of its ways out is near, else anywhere, as before the spaces)
  const near = links.filter((p) => p.fromSpace != null).sort((a, b) => a.from.distanceTo(start) - b.from.distanceTo(start))[0];
  const spaces = [near && near.from.distanceTo(start) < ROOM_NEAR ? near.fromSpace : undefined, ...links.map((p) => p.toSpace)];
  const costs = nodes.map(() => Infinity), first = nodes.map(() => -1), visited = new Set(); costs[0] = 0;
  let bestCost = start.distanceTo(target.position), best = -1;
  for (let k = 0; k < nodes.length; k++) {
    let n = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (n < 0 || costs[i] < costs[n])) n = i;
    if (n < 0 || !Number.isFinite(costs[n])) break;
    visited.add(n);
    const inside = spaces[n] != null && Math.abs(target.position.y - nodes[n].y) > IN_SPACE;   // (the find is out in the world, not in this room)
    const finish = costs[n] + nodes[n].distanceTo(target.position);
    if (!inside && finish < bestCost) { bestCost = finish; best = first[n]; }
    links.forEach((p, i) => {
      if (spaces[n] !== undefined && (spaces[n] ?? null) !== p.fromSpace) return;
      const cost = costs[n] + nodes[n].distanceTo(p.from) + 5;
      if (cost < costs[i + 1]) { costs[i + 1] = cost; first[i + 1] = n === 0 ? i : first[n]; }
    });
  }
  return best < 0 ? target : objective(`portal-${best}-${target.id}`, `Through the ${links[best].label}`, links[best].from);
}

/**
 * The scout: a small folding drone that is not carried on you (issue #294): it comes when it is
 * needed. ping() calls it to find the objective (FIND): out of a small light over your left
 * shoulder (APPEAR) it grows and blooms, flies a little way towards the objective (or right over
 * it), hovers and faces it, drops a flare on the spot and calls onFind(target, metres)
 * (onPing(target) at the ping: what it is off to find; main.js: a toast with the name and the
 * distance), then rises away and winks out. With nothing to find it comes, shakes itself, no, goes,
 * and calls onShrug().
 * getHint() (main.js: the temple's guardian in a fight, src/temples/boss.js guardianHint) returns
 * { id, lines: [first, plainer, plainest], at: () => Vector3 } or null: while it gives one, a ping is
 * a hint (HINT) and calls onHint(line, n): each ping on the same id says the next, plainer line.
 * Phases: away → appear → seek → point → leave → away (and shrug, from away; escort, at your shoulder, from away or
 * handed over by the prologue, issue #434, then seek on a ping or leave). Away, nothing is drawn.
 */
export class Scout {
  constructor({ scene, player, physics, getTarget, getHint = () => null, sound, onPing = () => {}, onFind = () => {}, onShrug = () => {}, onHint = () => {} }) {
    Object.assign(this, { player, physics, getTarget, getHint, sound, onPing, onFind, onShrug, onHint });
    this.hintAsked = new Map();   // hint id -> how many times asked (the next ping says it more plainly)
    this.phase = 'away'; this.age = 0; this.elapsed = 0;
    this.vel = new THREE.Vector3(); this.stuck = 0; this.over = 0; this.fade = null;
    this.object = new THREE.Group(); this.object.userData.noCollide = true; scene.add(this.object);
    // the drone (folding: src/drone.js), a glowing ring under it while it is out, and its lens' beam (hints)
    this.drone = new Drone(); this.fold = new DroneFold();
    this.object.add(this.drone.object);
    const lamp = makeMaterial({ color: '#70e7df', glow: 1 });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.01, 5, 28), lamp);
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = -0.14; this.object.add(this.ring);
    // the lens' pivot, aimed at the goal (up and down too) while it is out: the body keeps near level,
    // the lens turns all the way up or down (no beak on it: the drone's own heading points the way)
    const eye = this.drone.eye.at;
    this.lens = new THREE.Group(); this.lens.position.copy(eye); this.object.add(this.lens);
    // the lens beam, in a hint only: a thin lit line from the lens to the weak point (cut short where something is in the way)
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5), makeMaterial({ color: '#70e7df', glow: 1, side: THREE.DoubleSide }));
    this.beam.position.z = 0.3; this.beam.visible = false; this.beam.scale.set(1, 1, 1e-3); this.lens.add(this.beam);
    this.beamLen = 0;
    for (const o of [this.ring, this.beam]) o.userData.dynamic = true;
    markHero(this.object);
    // the light it comes out of and winks back into (APPEAR): a small inked star of its glow, in the scene (the drone scales, it does not)
    this.light = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0).scale(0.8, 1.25, 0.8), makeMaterial({ color: '#fff6dc', glow: 1, flat: true }));
    Object.assign(this.light.userData, { noCollide: true, dynamic: true, castShadow: false });
    this.light.visible = false; scene.add(this.light);
    this.lightK = 0;
    this.scene = scene; this._mark = null;
    this.hailing = false; this.mouth = 0;
    // a thin glowing trail behind it, so it's easy to follow by eye
    this.trail = new Trail(scene, { radius: 0.07, life: 1.5, offset: 1.2 });
    this.trail.mesh.visible = false;
    // the flare it drops on what it found (seen from afar, gone after a few seconds)
    this.flare = new Flare(scene);
    this.previousPlayer = player.pos.clone();
    this.hide();
  }
  /** Out (anything but away): drawn, flying or about to. */
  get out() { return this.phase !== 'away'; }
  /**
   * Where it comes out of its light (a fresh or `out` Vector3): over your left shoulder, a little behind
   * you (in the camera's view behind you), lower under a ceiling, short of a wall.
   */
  appearSpot(out = new THREE.Vector3()) {
    const p = this.player, up = p.frame.up, fwd = _f2;
    if (p.frame.dir && p.heading != null) p.frame.dir(p.heading, fwd);
    else if (p.char?.torso) fwd.set(0, 0, 1).applyQuaternion(p.char.torso.getWorldQuaternion(_q2));
    else fwd.set(0, 0, 1);
    fwd.addScaledVector(up, -fwd.dot(up));
    if (fwd.lengthSq() < 1e-6) fwd.set(up.y, -up.x, 0);
    fwd.normalize();
    const left = _ax.crossVectors(up, fwd);
    const head = _lh.copy(p.pos).addScaledVector(up, HEAD);
    const room = this.obstacle(head, up, APPEAR.over + 0.35)?.distance ?? Infinity;
    out.copy(head).addScaledVector(up, Math.max(0.1, Math.min(APPEAR.over, room - 0.35)));
    const side = _ls.copy(left).multiplyScalar(APPEAR.side).addScaledVector(fwd, -APPEAR.back), len = side.length();
    side.divideScalar(len);
    const wall = this.obstacle(out, side, len + RADIUS)?.distance ?? Infinity;
    return out.addScaledVector(side, Math.max(0, Math.min(len, wall - RADIUS)));
  }
  /** hide(): gone, folded, nothing drawn (away). */
  hide() {
    this.phase = 'away'; this.vel.set(0, 0, 0); this.stuck = this.over = 0; this.overUsed = false; this.fade = null; this.leaveT = null;
    this.appearSpot(this.object.position); this.object.scale.setScalar(1e-3);
    this.fold.snap(false); this.drone.pose(this.fold);
    this.ring.visible = false; if (this.beam) { this.beam.visible = false; this.beamLen = 0; }
    this.object.visible = false; this.lightK = 0; this.light.visible = false;
  }
  /**
   * Find the objective: it comes, a look, a flare, it goes. Pressed again while it is out it starts
   * over with the objective as it is now. Nothing to find: a shrug (false).
   */
  ping() {
    const hint = this.getHint?.();
    const target = hint ? this.hintTarget(hint) : this.getTarget();
    if (!target) { this.shrug(); return false; }
    this.hinting = hint ?? null;
    this.target = target; this.age = 0; this.relaunched = false; this.found = false; this.seekT = this.pointT = 0;
    if (this.phase === 'away' || this.phase === 'shrug') this.appear();
    else if (this.phase === 'appear') { /* already on its way */ }
    else { this.phase = 'seek'; this.leaveT = null; this.fade = null; this.object.scale.setScalar(1); this.setLight(0); }   // (leaving: it turns back)
    this.sound?.drone?.('go');
    if (!target.hint) this.onPing(target);   // (what it is off to find, said at once: main.js puts it on the cue)
    return true;
  }
  /** The hint's line for this ping (each ping on the same id a plainer one), as a target to point at. */
  hintTarget(hint) {
    const lines = hint.lines?.filter(Boolean) ?? [];
    const at = hint.at?.();
    if (!lines.length || !at) return null;
    const n = this.hintAsked.get(hint.id) ?? 0;
    this.hintAsked.set(hint.id, n + 1);
    return { id: `hint.${hint.id}`, label: lines[Math.min(n, lines.length - 1)], position: at.clone(), hint: true, n };
  }
  /** Nothing to find: it comes out of its light folded, shakes itself, no, and winks out; out already, it just goes. */
  shrug() {
    if (this.phase === 'away') { this.phase = 'shrug'; this.shrugT = 0; this.object.visible = !this.player.hidden; }
    else this.home();
    this.sound?.drone?.('shrug');
    this.onShrug();
  }
  /**
   * Ride at your shoulder for `secs` (escort): from `from` (world: the prologue's drone, handed over where it is, already
   * open) or out of its light there. A ping sends it off from here; nothing, and it winks out when the time is up.
   */
  escort(secs = ESCORT.secs, from = null) {
    if (this.phase !== 'away' && this.phase !== 'escort') return false;
    this.phase = 'escort'; this.escortT = secs; this.target = null; this.hinting = null; this.found = false;
    this.vel.set(0, 0, 0); this.stuck = this.over = 0; this.fade = null; this.leaveT = null;
    if (from) { this.object.position.copy(from); this.object.scale.setScalar(1); this.fold.snap(true); this.growT = APPEAR.grow; }
    else { this.appearSpot(this.object.position); this.object.scale.setScalar(1e-3); this.fold.snap(false); this.growT = 0; }
    this.object.visible = !this.player.hidden;
    return true;
  }
  /** It has something to tell you (on) or not any more: the mark over it and its hops while it rides at your shoulder (HAIL). */
  hail(on = true) { this.hailing = !!on; if (!on && this._mark) this._mark.visible = false; }
  /**
   * The mark over it when it has something to tell you (HAIL): a bar and a dot, its glow in warm red, in the scene. Made
   * the first time it is wanted (a scene that never needs it, a fight temple's, stays as it was: its streams with it).
   */
  get mark() {
    if (this._mark) return this._mark;
    const mat = makeMaterial({ color: HAIL.colour, glow: 1, flat: true });
    const m = this._mark = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0).scale(0.32, 1, 0.32).translate(0, 1.05, 0), mat);
    const dot = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), mat);
    m.add(bar, dot);
    for (const o of [m, bar, dot]) Object.assign(o.userData, { noCollide: true, dynamic: true, castShadow: false });
    m.visible = false; this.scene.add(m);
    return m;
  }
  /**
   * The talk (issue #543): it is before your face (TALK), open, facing you, until a ping sends it off (or home()). It is
   * put there at once: the conversation's camera cuts to the two-shot. Returns where it hovers.
   */
  talk() {
    const p = this.player, up = p.frame.up, fwd = _f2;
    if (p.frame.dir && p.heading != null) p.frame.dir(p.heading, fwd); else fwd.set(Math.sin(p.heading ?? 0), 0, Math.cos(p.heading ?? 0));
    fwd.addScaledVector(up, -fwd.dot(up));
    if (fwd.lengthSq() < 1e-6) fwd.set(up.y, -up.x, 0);
    fwd.normalize();
    const head = _lh.copy(p.pos).addScaledVector(up, HEAD - TALK.below);
    const wall = this.obstacle(head, fwd, TALK.out + RADIUS)?.distance ?? Infinity;
    this.talkAt = (this.talkAt ?? new THREE.Vector3()).copy(head).addScaledVector(fwd, Math.max(TALK.near, Math.min(TALK.out, wall - RADIUS)));
    this.phase = 'talk'; this.hail(false); this.target = null; this.hinting = null; this.found = false;
    this.vel.set(0, 0, 0); this.stuck = this.over = 0; this.fade = null; this.leaveT = null; this.mouth = 0;
    this.object.position.copy(this.talkAt); this.object.scale.setScalar(1); this.fold.snap(true); this.growT = APPEAR.grow; this.setLight(0);
    this.object.visible = !this.player.hidden;
    return this.talkAt;
  }
  /** While it talks: how open its "mouth" is (src/story/dialogue.js faces(): its syllables), a little bob on each. */
  express(f) { this.mouth = f?.speaking ? f.mouth ?? 0 : 0; }
  /** Send it away now (a find cut short, or done): it rises, folds and winks out. */
  home() { if (this.phase !== 'away' && this.phase !== 'leave' && this.phase !== 'shrug') { this.phase = 'leave'; this.leaveT = 0; this.fade = null; } }
  /**
   * Where it looks from (lookoutSpot: up and down as well as out, in the open), and the way there:
   * straight to it when nothing is in between, else by the legs' corners (up the shaft first, out
   * over the edge first). `out` the spot; returns the point to fly at now.
   */
  lookout(out, up, pSpeed = 0, toward = null) {
    const ray = (o, d, far) => this.obstacle(o, d, far)?.distance ?? Infinity;
    lookoutSpot({ feet: this.player.pos, goal: this.target.position, up, pSpeed, hint: !!this.target.hint, ray, legs: this._legs ??= [] }, out);
    // never inside the ground (the heightfield: the rays only see meshes)
    const h = this.clearance(out, up);
    if (h < CLEAR) out.addScaledVector(up, CLEAR - h);
    if (!toward) return out;
    // the way there: in sight, straight; else the corner it can see (the climb's top, the edge)
    const pos = this.object.position, sees = (p) => { const d = _lv2.subVectors(p, pos), l = d.length(); return l < 0.5 || ray(pos, d.divideScalar(l), l) >= l - 0.3; };
    if (sees(out)) return toward.copy(out);
    for (let i = this._legs.length - 1; i >= 0; i--) if (sees(this._legs[i])) return toward.copy(this._legs[i]);
    return toward.copy(out);
  }
  /** Height above whatever is below along -up (meshes and the heightfield), Infinity if nothing. */
  clearance(p, up) {
    const P = this.physics;
    if (P.heightAbove) return P.heightAbove(p, up, 0.1);   // from just above: a ceiling overhead is not ground
    if (P.base && up.y > 0.99) return p.y - P.base.heightAt(p.x, p.z);
    return Infinity;
  }

  /** First obstacle along a ray: { distance, normal } (normal facing back at us), or null. */
  obstacle(origin, dir, far) {
    const P = this.physics;
    if (P.rayHit) return P.rayHit(origin, dir, far);
    const d = P.rayDistance?.(origin, dir, far) ?? Infinity;
    return d < far ? { distance: d, normal: dir.clone().negate() } : null;
  }

  /**
   * Steer smoothly toward `destination`: a damped velocity that eases in
   * and out (arrives without overshooting or ping-ponging), slides along
   * walls instead of stopping at them, and keeps a cushion of air over the
   * ground by rising over terrain instead of refusing to move. If it makes
   * no progress for a moment it glides straight up and over; still boxed in,
   * it reports `true` so the caller can recall it.
   */
  fly(destination, maxSpeed, up, dt, carry = null) {
    if (dt <= 0) return false;
    const pos = this.object.position, vel = this.vel;
    const to = _d.subVectors(destination, pos), dist = to.length();
    // arrive: full speed far away, slowing down inside the last couple of metres
    // (carry: the destination's own motion, e.g. yours, so it keeps pace instead of trailing)
    const want = _w.copy(to).multiplyScalar(dist > 1e-4 ? Math.min(maxSpeed, dist * 3.2) / dist : 0);
    if (carry) want.add(carry);
    if (this.over > 0) {
      // boxed in: rise up and over whatever is in the way
      this.over -= dt;
      want.multiplyScalar(0.35).addScaledVector(up, Math.max(4, maxSpeed * 0.7));
    }
    // terrain following: hold ~1 m of air below, here and a little ahead
    // (less right at the destination, so it can still settle low)
    const clear = Math.min(CLEAR, MIN_CLEAR + dist * 0.4);
    const ahead = _a.copy(pos).addScaledVector(vel, 0.35);
    const h = Math.min(this.clearance(pos, up), this.clearance(ahead, up) + 0.25);
    const rise = want.dot(up);
    if (h < clear) want.addScaledVector(up, (clear - h) * 6 - Math.min(rise, 0));
    else if (h < clear * 2 && rise < 0) want.addScaledVector(up, -rise * (1 - (h - clear) / clear));
    // walls ahead: steer along them (never straight into them)
    const speed = vel.length();
    if (speed > 0.05 || want.lengthSq() > 0.01) {
      const dir = _n.copy(speed > 0.05 ? vel : want).normalize();
      const look = 0.6 + speed * 0.45;
      const hit = this.obstacle(pos, dir, look);
      if (hit) {
        const into = want.dot(hit.normal);
        if (into < 0) want.addScaledVector(hit.normal, -into);
        want.addScaledVector(hit.normal, (1 - hit.distance / look) * maxSpeed * 0.6);
      }
    }
    vel.lerp(want, 1 - Math.exp(-STEER * dt));
    // move: swept against the level so it can't pass through anything
    const from = _f.copy(pos);
    const step = _s.copy(vel).multiplyScalar(dt), len = step.length();
    if (len > 1e-6) {
      const hit = this.obstacle(pos, _n.copy(step).divideScalar(len), len + RADIUS);
      if (hit && hit.distance < len + RADIUS) {
        // slide: drop the part of the step (and the velocity) that goes into the surface
        const into = step.dot(hit.normal);
        if (into < 0) step.addScaledVector(hit.normal, -into);
        const vin = vel.dot(hit.normal);
        if (vin < 0) vel.addScaledVector(hit.normal, -vin);
        step.addScaledVector(hit.normal, Math.max(0, RADIUS - hit.distance) * 0.5);
      }
      pos.add(step);
      if (this.physics.pushCapsule) sweepCapsule(this.physics, pos, from, RADIUS, -RADIUS, RADIUS, _p, up);
    }
    // never inside the ground: lift out (keeping any sideways motion)
    const h2 = this.clearance(pos, up);
    if (h2 < MIN_CLEAR) {
      pos.addScaledVector(up, MIN_CLEAR - h2);
      const vu = vel.dot(up);
      if (vu < 0) vel.addScaledVector(up, -vu);
    }
    // facing: turn smoothly toward the flight direction (or what it points at: this.aim). A
    // drone keeps near level: it pitches at most PITCH toward it (the lens takes the rest,
    // update()) and leans into its own speed, its top tilting the way it goes
    const face = this.aim ?? (vel.lengthSq() > 0.09 ? vel : to);
    if (face.lengthSq() > 1e-6) {
      const rise = face.dot(up), level = _h.copy(face).addScaledVector(up, -rise);
      if (level.lengthSq() < 1e-8) level.set(0, 0, 1).applyQuaternion(this.object.quaternion).addScaledVector(up, -level.dot(up));   // straight up or down: keep its heading
      if (level.lengthSq() < 1e-8) level.set(up.y, -up.x, up.z).addScaledVector(up, -level.dot(up));
      const pitch = THREE.MathUtils.clamp(Math.atan2(rise, Math.sqrt(Math.max(face.lengthSq() - rise * rise, 0))), -PITCH, PITCH);
      _n.copy(level.normalize()).multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch));
      _m.lookAt(_o.set(0, 0, 0), _n.negate(), up);
      _q.setFromRotationMatrix(_m);
      const side = _h.copy(vel).addScaledVector(up, -vel.dot(up)), sp = side.length();
      if (sp > 0.05) _q.premultiply(_qt.setFromAxisAngle(_ax.crossVectors(up, side).divideScalar(sp), Math.min(LEAN.max, sp * LEAN.perSpeed)));
      this.object.quaternion.slerp(_q, 1 - Math.exp(-8 * dt));
    }
    // Progress watch: not getting closer although still far away. Distance
    // counts sideways, and up only when the goal is above: hovering right
    // over a goal that is inside a hill is as close as it can get.
    const gap = (p) => { const g = _d.subVectors(destination, p), u = g.dot(up); return Math.hypot(Math.sqrt(Math.max(g.lengthSq() - u * u, 0)), Math.max(u, 0)); };
    const before = gap(from), after = gap(pos);
    if (this.over > 0) { /* gliding up and over: hold the count */ }
    else if (after > 1.5 && (before - after) / dt < Math.min(1, maxSpeed * 0.15)) this.stuck += dt;
    else this.stuck = Math.max(0, this.stuck - dt * 2);
    if (this.stuck > 0.5 && !(this.over > 0) && !this.overUsed) { this.over = 0.9; this.overUsed = true; }
    if (this.stuck < 0.05 && !(this.over > 0)) this.overUsed = false;
    return this.stuck > 1.6;
  }
  /** Out of its light over your shoulder: it grows there (carried with you), folded and waking, then blooms. */
  appear() {
    this.growT = this.phase === 'shrug' ? APPEAR.grow * this.object.scale.x : 0;
    this.phase = 'appear';
    this.appearSpot(this.object.position);
    this.vel.copy(this.player.ride?.vel ?? this.player.vel ?? _o.set(0, 0, 0)); this.stuck = this.over = 0; this.fade = null; this.leaveT = null;
    if (this.growT === 0) { this.object.scale.setScalar(1e-3); this.fold.snap(false); }
    this.uprightAlong(_f.subVectors(this.target?.position ?? this.object.position, this.player.pos), this.player.frame.up, this.object.quaternion);
    this.object.visible = !this.player.hidden;
  }
  /** Boxed in: wink out (a short shrink into its light) and come again, once, if still guiding. */
  recall() { if (this.fade === null) this.fade = APPEAR.wink; }
  /** The light it comes from and goes into: k 0..1 its size, at the drone. */
  setLight(k) {
    this.lightK = k;
    this.light.visible = k > 0.01 && !this.player.hidden;
    if (!this.light.visible) return;
    this.light.position.copy(this.object.position);
    this.light.scale.setScalar(APPEAR.light * k);
    this.light.rotation.y = this.elapsed * 3;
  }
  /**
   * paused: a menu, the photo mode (nothing moves). gone: a talk or a filmed scene is under way: it is no
   * part of it (issue #294), so if it is out it is gone at once.
   */
  update(dt, paused = false, gone = false) {
    const up = this.player.frame.up;
    if (this.player.pos.distanceTo(this.previousPlayer) > 45 && this.out) this.hide();   // (a teleport: it stays behind)
    this.previousPlayer.copy(this.player.pos);
    if (gone && this.out && this.phase !== 'talk') this.hide();   // (its own talk, issue #543: it is the one in the shot)
    if (this._mark && (this.phase !== 'escort' || !this.hailing)) this._mark.visible = false;
    this.object.visible = this.out && !this.player.hidden;
    if (!paused) this.flare.update(dt);
    // the trail: laid while it flies (not while it grows, nor as it winks out), left to dissolve once it is gone
    const flying = this.phase === 'seek' || this.phase === 'point' || (this.phase === 'leave' && this.leaveT < APPEAR.leave);
    this.trail.update(dt, flying && this.fade === null && !this.player.hidden ? this.object.position : null);
    if (this.phase === 'away') { if (!this.trail.samples.length) this.trail.mesh.visible = false; return; }
    if (paused && this.phase !== 'talk') return;   // (a talk is a pause for the rest: it is the one talking)
    this.elapsed += dt;
    if (this.phase === 'talk') { this.talkFrame(dt, up); return; }
    if (this.phase === 'shrug') {
      // nothing to find: out of its light, folded, the eye opens, it shakes itself, no, and winks back in
      this.shrugT += dt;
      const t = this.shrugT, S = APPEAR.grow + FIND.shrug + APPEAR.wink;
      const grow = THREE.MathUtils.smoothstep(t, 0, APPEAR.grow), wink = 1 - THREE.MathUtils.smoothstep(t, S - APPEAR.wink, S);
      this.appearSpot(this.object.position);
      const k = THREE.MathUtils.clamp((t - APPEAR.grow) / FIND.shrug, 0, 1), shake = Math.sin(k * Math.PI * 6) * Math.sin(Math.PI * k) * 0.42;
      this.uprightAlong(_f.subVectors(this.player.pos, this.object.position), up, this.object.quaternion);   // (looking at you)
      this.object.quaternion.multiply(_qt.setFromAxisAngle(_ax.set(0, 1, 0), shake));
      this.object.scale.setScalar(Math.max(1e-3, grow * wink));
      const lit = t < APPEAR.grow ? Math.sin(Math.PI * t / APPEAR.grow) : t > S - APPEAR.wink ? Math.sin(Math.PI * (t - S + APPEAR.wink) / APPEAR.wink) : 0;
      this.setLight(lit);
      this.drone.pose(this.fold.update(dt, false, t < S - APPEAR.wink), dt);
      if (t >= S) this.hide();
      return;
    }
    if (this.phase === 'escort') { this.escortFrame(dt, up); return; }
    this.age += dt;
    if (this.hinting) {
      // a hint follows its weak point (the guardian moves); the fight over, it goes
      const h = this.getHint?.(), at = h && h.id === this.hinting.id ? h.at?.() : null;
      if (at && this.target?.hint) this.target.position.copy(at); else if (this.phase !== 'leave') this.home();
    } else this.target = this.getTarget();
    if (this.phase !== 'leave' && this.phase !== 'appear' && (this.age >= FIND.max || !this.target)) this.home();
    if (this.fade !== null) {
      this.fade -= dt;
      const k = Math.max(0, this.fade / APPEAR.wink);
      this.object.scale.setScalar(Math.max(1e-3, k));
      this.setLight(Math.sin(Math.PI * (1 - k)));
      if (this.fade <= 0) {
        // once per ping it comes again from over your shoulder to try again
        const again = this.phase !== 'leave' && this.target && !this.found && this.age < FIND.max - 3 && !this.relaunched;
        this.hide();
        if (again) { this.appear(); this.relaunched = true; }
      }
      return;
    }
    const pv = this.player.ride?.vel ?? this.player.vel ?? _o.set(0, 0, 0), pSpeed = pv.length();
    const lastVel = _lv.copy(this.vel);
    this.aim = null;
    let open = true, beam = false;
    if (this.phase === 'appear') {
      // out of its light over your shoulder (carried with you): it grows folded, its eye waking, and blooms
      this.growT = Math.min(APPEAR.grow, this.growT + dt);
      const e = this.growT / APPEAR.grow;
      this.appearSpot(this.object.position);
      this.object.scale.setScalar(Math.max(1e-3, THREE.MathUtils.smootherstep(e, 0, 1)));
      this.setLight(Math.sin(Math.PI * Math.min(1, e * 1.15)));
      open = e >= APPEAR.bloomAt;
      if (e >= 1) { this.phase = 'seek'; this.seekT = 0; this.vel.copy(pv).addScaledVector(up, 1.2); this.setLight(0); }
    } else if (this.phase === 'seek' || this.phase === 'point') {
      // out to the lookout (it keeps your pace, walking, riding or flying), then a hover there,
      // the beak and the beam on the objective, up or down as well
      const spot = this.lookout(_d2, up, pSpeed, _go);
      const go = _go;
      if (this.phase === 'point') { spot.addScaledVector(up, Math.sin(this.elapsed * 3) * 0.12); go.addScaledVector(up, Math.sin(this.elapsed * 3) * 0.12); }
      this.aim = (this._aim ??= new THREE.Vector3()).subVectors(this.target.position, this.object.position);   // (its own vector: fly() uses _p for the capsule sweep)
      if (this.fly(go, Math.max(8, pSpeed + 7), up, dt, pv)) this.recall();
      if (this.phase === 'seek') {
        this.seekT += dt;
        if (this.object.position.distanceTo(spot) < 0.8 || this.seekT >= FIND.seek) this.arrive();
      } else {
        this.pointT += dt; beam = !!this.target.hint;   // (a find has no beam: the drone faces it, the flare marks it)
        if (this.pointT >= (this.target.hint ? HINT.point : FIND.point)) this.home();
      }
      if (this.object.position.distanceTo(this.player.pos) > FIND.near + FIND.out + 20) this.home();   // (lost you: gone)
    } else {
      // leaving: it rises away where it is (keeping your pace), folds, and winks out into its light
      this.leaveT += dt;
      this.fly(_d2.copy(this.object.position).addScaledVector(up, APPEAR.rise), APPEAR.rise + pSpeed, up, dt, pv);
      open = this.leaveT < APPEAR.leave * 0.6;
      const w = (this.leaveT - APPEAR.leave) / APPEAR.wink;
      if (w > 0) { this.object.scale.setScalar(Math.max(1e-3, 1 - THREE.MathUtils.smoothstep(w, 0, 1))); this.setLight(Math.sin(Math.PI * Math.min(1, w))); }
      if (w >= 1) { this.hide(); return; }
    }
    this.fold.update(dt, open, true);
    // the antenna sways with the drone's own accelerations (in its frame)
    const acc = _a.subVectors(this.vel, lastVel).divideScalar(Math.max(dt, 1e-3)).applyQuaternion(_q3.copy(this.object.quaternion).invert());
    this.drone.pose(this.fold, dt, _lean.set(acc.x, acc.z));
    this.ring.visible = this.phase === 'seek' || this.phase === 'point'; this.ring.rotation.z += dt * 2;
    if (this.aim && this.aim.lengthSq() > 1e-6) {
      // the lens at the goal, in the drone's frame
      const local = _n.copy(this.aim).normalize().applyQuaternion(_q3.copy(this.object.quaternion).invert());
      this.lens.quaternion.slerp(_qt.setFromUnitVectors(_z, local), 1 - Math.exp(-10 * dt));
    }
    this.updateBeam(dt, beam);
  }
  /** Escorting: at your shoulder (grown out of its light first, if it was not handed over), facing the way you go. */
  escortFrame(dt, up) {
    const pv = this.player.ride?.vel ?? this.player.vel ?? _o.set(0, 0, 0), pSpeed = pv.length();
    const lastVel = _lv.copy(this.vel);
    this.escortT -= dt;
    let open = true;
    if (this.growT < APPEAR.grow) {
      this.growT = Math.min(APPEAR.grow, this.growT + dt);
      const e = this.growT / APPEAR.grow;
      this.appearSpot(this.object.position);
      this.object.scale.setScalar(Math.max(1e-3, THREE.MathUtils.smootherstep(e, 0, 1)));
      this.setLight(Math.sin(Math.PI * Math.min(1, e * 1.15)));
      open = e >= APPEAR.bloomAt;
    } else {
      this.setLight(0);
      const p = this.player, fwd = _f;
      if (p.frame?.dir && p.heading != null) p.frame.dir(p.heading, fwd); else fwd.set(Math.sin(p.heading ?? 0), 0, Math.cos(p.heading ?? 0));
      this.aim = (this._aim ??= new THREE.Vector3()).copy(fwd);
      const spot = this.appearSpot(_d2);
      if (this.hailing) {
        // something to tell you: it turns to you and hops now and then (HAIL), the mark over it
        const k = (this.elapsed % HAIL.every) / HAIL.every;
        spot.addScaledVector(up, k < 0.3 ? Math.sin((k / 0.3) * Math.PI) * HAIL.hop : 0);
        this.aim.subVectors(_lh.copy(p.pos).addScaledVector(up, HEAD), this.object.position);
      }
      this.fly(spot, Math.max(6, pSpeed + 4), up, dt, pv);
      this.aim = null;
    }
    if (this.hailing) {
      const g = this.object.scale.x, pulse = 1 + 0.12 * Math.sin(this.elapsed * 6);
      this.mark.visible = g > 0.6 && !this.player.hidden;
      this.mark.position.copy(this.object.position).addScaledVector(up, HAIL.over * g);
      this.mark.quaternion.setFromUnitVectors(_y1, up).multiply(_qt.setFromAxisAngle(_y1, this.elapsed * 2.4));
      this.mark.scale.setScalar(HAIL.size * g * pulse);
    }
    if (this.escortT <= 0) this.home();
    this.fold.update(dt, open, true);
    const acc = _a.subVectors(this.vel, lastVel).divideScalar(Math.max(dt, 1e-3)).applyQuaternion(_q3.copy(this.object.quaternion).invert());
    this.drone.pose(this.fold, dt, _lean.set(acc.x, acc.z));
    this.ring.visible = false;
    this.updateBeam(dt, false);
  }
  /** Talking (issue #543): before your face, open, facing you, floating, a little bob on each syllable it says. */
  talkFrame(dt, up) {
    const p = this.player;
    this.mouth *= Math.exp(-6 * dt);
    this.object.position.copy(this.talkAt).addScaledVector(up, Math.sin(this.elapsed * 2.2) * TALK.bob + this.mouth * TALK.bob);
    this.uprightAlong(_f.subVectors(_lh.copy(p.pos).addScaledVector(up, HEAD), this.object.position), up, _q);
    this.object.quaternion.slerp(_q, 1 - Math.exp(-10 * dt));
    this.lens.quaternion.slerp(_qt.identity(), 1 - Math.exp(-10 * dt));
    this.fold.update(dt, true, true);
    this.drone.pose(this.fold, dt, _lean.set(0, 0));
    this.ring.visible = false;
    this.updateBeam(dt, false);
  }
  /** At the lookout: the flare goes down on the objective, a chirp, and onFind (a hint: the beam on the weak point, its chirp, onHint). */
  arrive() {
    this.phase = 'point'; this.pointT = 0;
    if (this.found) return;
    this.found = true;
    if (this.target.hint) { this.sound?.drone?.('hint'); this.onHint(this.target.label, this.target.n); return; }
    const d = this.player.pos.distanceTo(this.target.position), up = this.player.frame.up;
    const rise = _a.subVectors(this.target.position, this.player.pos).dot(up);   // (the toast says "above" or "below" when it is a good part of the way)
    this.flare.drop(this.target.position, up, -rise);   // (far below you: its column rises past your feet)
    this.sound?.drone?.('found');
    this.onFind({ ...this.target, rise }, d);
  }
  /** The lens beam (a hint's): grows out to the weak point (or the first thing in the way, at most HINT.beam) while pointing, and draws back. */
  updateBeam(dt, on) {
    let want = 0;
    if (on && this.target) {
      this.lens.updateWorldMatrix(true, false);
      const from = this.lens.getWorldPosition(_bm), dir = _lk2.subVectors(this.target.position, from), far = dir.length();
      dir.divideScalar(Math.max(far, 1e-6));
      want = Math.min(far, HINT.beam);
      const hit = want > 1 ? this.obstacle(_lk.copy(from).addScaledVector(dir, 0.6), dir, want - 0.6) : null;
      if (hit) want = Math.min(want, hit.distance + 0.6);
    }
    this.beamLen += (want - this.beamLen) * (1 - Math.exp(-(want > this.beamLen ? 7 : 12) * dt));
    if (this.beamLen < 0.05 && !on) this.beamLen = 0;
    this.beam.visible = this.beamLen > 0.05;
    // a laser-thin line up close, a few pixels wide far off
    const w = 1 + this.beamLen * 0.04 + Math.sin(this.elapsed * 23) * 0.15;
    this.beam.scale.set(w, w, Math.max(this.beamLen - 0.3, 1e-3));
  }
  /** Level, facing along `dir`'s horizontal (any horizontal if it is straight up or down). */
  uprightAlong(dir, up, out) {
    const f = _f2.copy(dir).addScaledVector(up, -dir.dot(up));
    if (f.lengthSq() < 1e-6) f.set(up.y, -up.x, 0).addScaledVector(up, -f.dot(up));
    _m.lookAt(_o2.set(0, 0, 0), f.normalize().negate(), up);
    return out.setFromRotationMatrix(_m);
  }
}

/**
 * The flare the scout drops on what it found: a thin column of its light shooting up from the
 * spot and a ring that rings out round it, sized by the distance so it reads from far away,
 * gone after FLARE.life seconds. One at a time; drop() starts it over somewhere else.
 */
export const FLARE = { life: 9, rise: 0.5, fade: 1.6, height: 34 };   // height: m (12 m past your feet when it is further below you than that)
export class Flare {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.userData.noCollide = true; this.group.visible = false;
    const glow = makeMaterial({ color: '#70e7df', glow: 0.9, side: THREE.DoubleSide });
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 1, 8, 1, true).translate(0, 0.5, 0), glow);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 5, 32).rotateX(Math.PI / 2), makeMaterial({ color: '#fff6dc', glow: 1 }));
    this.spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0).scale(0.7, 1.3, 0.7), makeMaterial({ color: '#70e7df', glow: 1, flat: true }));
    for (const m of [this.column, this.ring, this.spark]) { m.userData.noCollide = true; m.userData.dynamic = true; m.userData.castShadow = false; }
    this.group.add(this.column, this.ring, this.spark);
    scene?.add(this.group);
    this.t = Infinity; this.at = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0); this.eye = null;
  }
  get on() { return this.t < FLARE.life; }
  /** below: how far under you it is (m), so the column rises past your feet to be seen from above. */
  drop(at, up = this.up, below = 0) {
    this.at.copy(at); this.up.copy(up); this.t = 0;
    this.height = Math.max(FLARE.height, below + 12);
    this.group.position.copy(at);
    this.group.quaternion.setFromUnitVectors(_y1, this.up);
  }
  /** How much of it shows (0..1) at time t: up fast, a hold, a fade. */
  static k(t) {
    if (!(t < FLARE.life)) return 0;
    return THREE.MathUtils.smoothstep(t, 0, FLARE.rise) * (1 - THREE.MathUtils.smoothstep(t, FLARE.life - FLARE.fade, FLARE.life));
  }
  /** eye: where it is seen from (the camera; main.js sets it), for its size. */
  update(dt) {
    if (!this.on) { this.group.visible = false; return; }
    this.t += dt;
    const k = Flare.k(this.t);
    this.group.visible = k > 0.01;
    if (!this.group.visible) return;
    const d = this.eye ? this.eye.distanceTo(this.at) : 30, s = Math.max(1, d * 0.012);   // (a few pixels wide however far)
    this.column.scale.set(s * k, (this.height ?? FLARE.height) * THREE.MathUtils.smoothstep(this.t, 0, FLARE.rise * 1.6) * (0.6 + 0.4 * k), s * k);
    const r = (this.t % 1.8) / 1.8;   // the ring rings out every 1.8 s
    this.ring.scale.setScalar(Math.max(1e-3, (0.6 + r * 3.2) * Math.max(1, s * 0.4) * k));
    this.ring.position.y = 0.15;
    this.spark.scale.setScalar(Math.max(1e-3, 0.6 * s * k));
    this.spark.position.y = 2.2 + s * 0.8 + Math.sin(this.t * 2.4) * 0.2;
    this.spark.rotation.y = this.t * 1.6;
  }
}

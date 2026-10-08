import * as THREE from 'three';
import { makeMaterial, markHero } from './materials.js';
import { sweepCapsule } from './physics.js';
import { Trail } from './trail.js';
import { Drone, DroneFold, DOCK_ON_TOP } from './drone.js';

const RADIUS = 0.25;     // the drone's collision sphere
const CLEAR = 0.9;       // air it keeps below itself while flying
const MIN_CLEAR = 0.35;  // never lower than this over the ground
const STEER = 6;         // velocity response (1/s): smooth, no jitter
// Finding the objective (ping: Q, R3 with no foe in reach, the touch "ping"): it flies a little way towards it
// (or over it, when it is close), hovers there facing it (its own heading is the pointer: no beak,
// no beam), drops a flare on the spot, chirps, and comes home. Nothing to find: a shrug on the dock.
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
  shrug: 1.0,     // s: the little wobble on the dock
};
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
// Launching and docking (the drone folds: src/drone.js). It hops off the dock
// folded, straight out along OUT, then blooms and flies; coming home it folds
// on the way in, waits at the end of that line until it is shut, and glides
// back down it onto the dock.
export const DOCKING = {
  out: new THREE.Vector3(0, 0.55, 0.84).normalize(),   // dock frame: away from the surface (+y), the way the lens looks (+z, back from you)
  hop: 0.42,      // m: how far off the dock the first hop goes, and where it lines up to come home
  pop: 0.32,      // s: the hop
  bloomAt: 0.45,  // of the hop: the petals open from here (clear of you)
  launch: 0.85,   // s: launched, it guides from here
  foldAt: 1.6,    // m from the line-up point: it folds on the way in
  settle: 0.4,    // s: the last glide onto the dock
};
const _d = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3(), _n = new THREE.Vector3(), _f = new THREE.Vector3();
const _s = new THREE.Vector3(), _p = new THREE.Vector3(), _o = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _h = new THREE.Vector3(), _ax = new THREE.Vector3(), _qt = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);
const _y1 = new THREE.Vector3(0, 1, 0), _lk = new THREE.Vector3(), _lk2 = new THREE.Vector3(), _bm = new THREE.Vector3();
const _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _out = new THREE.Vector3(), _l = new THREE.Vector3(), _lv = new THREE.Vector3(), _d2 = new THREE.Vector3(), _f2 = new THREE.Vector3(), _o2 = new THREE.Vector3(), _lean = new THREE.Vector2(), _lv2 = new THREE.Vector3(), _go = new THREE.Vector3();

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

/** Use doorways / gravity portals when they shorten the route. */
export function viaPortal(start, target, portals) {
  const links = portals.map((p) => ({ from: p.at ?? p.pos, to: p.to, label: p.label ?? 'doorway' })).filter((p) => p.from && p.to);
  const nodes = [start, ...links.map((p) => p.to)];
  const costs = nodes.map(() => Infinity), first = nodes.map(() => -1), visited = new Set(); costs[0] = 0;
  let bestCost = start.distanceTo(target.position), best = -1;
  for (let k = 0; k < nodes.length; k++) {
    let n = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (n < 0 || costs[i] < costs[n])) n = i;
    if (n < 0 || !Number.isFinite(costs[n])) break;
    visited.add(n);
    const finish = costs[n] + nodes[n].distanceTo(target.position);
    if (finish < bestCost) { bestCost = finish; best = first[n]; }
    links.forEach((p, i) => {
      const cost = costs[n] + nodes[n].distanceTo(p.from) + 5;
      if (cost < costs[i + 1]) { costs[i + 1] = cost; first[i + 1] = n === 0 ? i : first[n]; }
    });
  }
  return best < 0 ? target : objective(`portal-${best}-${target.id}`, `Through the ${links[best].label}`, links[best].from);
}

/**
 * The scout: a small folding drone on your pack. ping() sends it to find the objective
 * (FIND): it hops off its dock, flies a little way towards it (or right over it), hovers
 * and faces it, drops a flare on the spot and calls onFind(target, metres)
 * (main.js: a toast with the name and the distance), then comes home and docks. With
 * nothing to find it shrugs on the dock and calls onShrug().
 * getHint() (main.js: the temple's guardian in a fight, src/temples/boss.js guardianHint) returns
 * { id, lines: [first, plainer, plainest], at: () => Vector3 } or null: while it gives one, a ping is
 * a hint (HINT) and calls onHint(line, n): each ping on the same id says the next, plainer line.
 * Phases: docked → launch → seek → point → return → docked (and shrug, from the dock).
 */
export class Scout {
  constructor({ scene, player, physics, getTarget, getHint = () => null, sound, onFind = () => {}, onShrug = () => {}, onHint = () => {} }) {
    Object.assign(this, { player, physics, getTarget, getHint, sound, onFind, onShrug, onHint });
    this.hintAsked = new Map();   // hint id -> how many times asked (the next ping says it more plainly)
    this.phase = 'docked'; this.age = 0; this.elapsed = 0;
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
    // a thin glowing trail behind it, so it's easy to follow by eye
    this.trail = new Trail(scene, { radius: 0.07, life: 1.5, offset: 1.2 });
    this.trail.mesh.visible = false;
    // the flare it drops on what it found (seen from afar, gone after a few seconds)
    this.flare = new Flare(scene);
    this.previousPlayer = player.pos.clone();
    this.dock();
  }
  anchor() {
    const anchor = this.player.gear?.scoutDock;
    if (anchor) { anchor.updateWorldMatrix(true, false); return anchor.getWorldPosition(new THREE.Vector3()); }
    return this.player.char.torso.localToWorld(new THREE.Vector3(0, 0.7, -0.3));
  }
  /** The dock's orientation: the drone's up out of the surface it rests on, its lens looking back from you. */
  dockQuaternion(out = new THREE.Quaternion()) {
    const anchor = this.player.gear?.scoutDock;
    if (anchor) return anchor.getWorldQuaternion(out);
    return this.player.char.torso.getWorldQuaternion(out).multiply(DOCK_ON_TOP);
  }
  /** dock(): home, folded (snap: at once; false: the fold finishes where it is, after a glide in). */
  dock(snap = true) {
    this.phase = 'docked'; this.vel.set(0, 0, 0); this.stuck = this.over = 0; this.overUsed = false; this.fade = null; this.settleT = null; this.relaunch = false; this.dockOnBody = null;
    this.object.position.copy(this.anchor()); this.dockQuaternion(this.object.quaternion); this.object.scale.setScalar(1);
    if (snap) this.fold.snap(false);
    this.drone.pose(this.fold);
    this.ring.visible = false; if (this.beam) { this.beam.visible = false; this.beamLen = 0; }
  }
  /**
   * Find the objective: out, a look, a flare, home. Pressed again while it is out it starts
   * over with the objective as it is now. Nothing to find: a shrug (false).
   */
  ping() {
    const hint = this.getHint?.();
    const target = hint ? this.hintTarget(hint) : this.getTarget();
    if (!target) { this.shrug(); return false; }
    this.hinting = hint ?? null;
    this.target = target; this.age = 0; this.relaunched = false; this.found = false; this.seekT = this.pointT = 0; this.returnT = 0;
    if (this.phase === 'docked' || this.phase === 'shrug') { this.dock(false); this.launch(); }
    else if (this.phase === 'launch') { /* already on its way out */ }
    else if (this.settleT == null || this.settleT < DOCKING.settle * 0.5) { this.phase = 'seek'; this.settleT = null; this.object.scale.setScalar(1); }
    else this.relaunch = true;   // nearly home: it lands, then hops straight back out
    this.sound?.drone?.('go'); return true;
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
  /** Nothing to find: on the dock it wakes, hops a little and shakes itself, no; out already, it just comes home. */
  shrug() {
    if (this.phase === 'docked') { this.phase = 'shrug'; this.shrugT = 0; }
    else this.home();
    this.sound?.drone?.('shrug');
    this.onShrug();
  }
  /** Send it home now (a find cut short). */
  home() { if (this.phase !== 'docked' && this.phase !== 'return' && this.phase !== 'shrug') { this.phase = 'return'; this.settleT = null; this.returnT = 0; } }
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
    // (less right at the destination, so it can still settle onto a low dock)
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
  launch() {
    this.phase = 'launch'; this.popT = 0; this.relaunch = false; this.origin = this.anchor(); this.object.position.copy(this.origin);
    this.vel.copy(this.player.ride?.vel ?? this.player.vel ?? _o.set(0, 0, 0)); this.stuck = this.over = 0; this.fade = null; this.settleT = null;
    this.object.scale.setScalar(1);
  }
  /** The line home: from the dock, `hop` metres out along DOCKING.out (world). */
  outward(q = this.dockQuaternion(_q2)) { return _out.copy(DOCKING.out).applyQuaternion(q); }
  /** Boxed in: blink out (a short shrink) and come back to the dock, relaunching if still guiding. */
  recall() { if (this.fade === null) this.fade = 0.3; }
  update(dt, paused = false) {
    const up = this.player.frame.up;
    if (this.player.pos.distanceTo(this.previousPlayer) > 45) this.dock();
    this.previousPlayer.copy(this.player.pos);
    this.object.visible = !this.player.hidden;
    if (!paused) this.flare.update(dt);
    // the trail: laid while it flies (not on the hop off the dock nor the glide back in), left to dissolve once it is home
    const flying = this.phase !== 'docked' && this.phase !== 'shrug' && this.settleT == null && !(this.phase === 'launch' && this.popT < DOCKING.pop);
    this.trail.update(dt, flying && this.fade === null && !this.player.hidden ? this.object.position : null);
    if (this.phase === 'docked' && !this.trail.samples.length) this.trail.mesh.visible = false;
    if (this.phase === 'docked') {
      const home = this.anchor(), body = this.player.humanoid?.chestAnchor;
      // the dock itself moved on the body (the flask was found: from the rucksack's lid to the flask's upright): glide over to it, folded
      const onBody = body ? body.worldToLocal(_l.copy(home)) : null;
      const moved = onBody && this.dockOnBody && onBody.distanceTo(this.dockOnBody) > 0.25;   // (more than its own hops and the tank's swing make in a frame)
      if (onBody) (this.dockOnBody ??= new THREE.Vector3()).copy(onBody);
      if (moved && !this.player.hidden) {
        const q = this.dockQuaternion(_q2);
        this.phase = 'return'; this.age = DOCKING.launch; this.returnT = 0; this.settleT = 0; this.relaunch = false;
        this.settleFrom = _l.subVectors(this.object.position, home).applyQuaternion(_q3.copy(q).invert()).clone();
        this.settleQ = this.object.quaternion.clone();
        return;
      }
      this.object.position.copy(home);
      this.dockQuaternion(this.object.quaternion);
      this.drone.pose(this.fold.update(dt, false), dt);   // (a fold still closing finishes here)
      return;
    }
    if (paused) return;
    if (this.phase === 'shrug') {
      // nothing to find: the eye opens, it lifts a finger's breadth off the dock and shakes itself, no, and settles back
      this.shrugT += dt;
      const k = Math.min(1, this.shrugT / FIND.shrug), q = this.dockQuaternion(_q2);
      const lift = Math.sin(Math.PI * k) * 0.06, shake = Math.sin(k * Math.PI * 6) * Math.sin(Math.PI * k) * 0.42;
      this.object.position.copy(this.anchor()).addScaledVector(this.outward(q), lift);
      this.object.quaternion.copy(q).multiply(_qt.setFromAxisAngle(_ax.set(0, 1, 0), shake));
      this.drone.pose(this.fold.update(dt, false, k < 0.85), dt);
      if (k >= 1) this.dock(false);
      return;
    }
    this.age += dt; this.elapsed += dt;
    if (this.hinting) {
      // a hint follows its weak point (the guardian moves); the fight over, it comes home
      const h = this.getHint?.(), at = h && h.id === this.hinting.id ? h.at?.() : null;
      if (at && this.target?.hint) this.target.position.copy(at); else if (this.phase !== 'return') this.home();
    } else this.target = this.getTarget();
    if (this.phase !== 'return' && (this.age >= FIND.max || !this.target)) this.home();
    if (this.fade !== null) {
      this.fade -= dt;
      this.object.scale.setScalar(Math.max(0, this.fade / 0.3));
      if (this.fade <= 0) {
        // once per ping it pops back out of the dock to try again from your shoulder
        const relaunch = this.phase !== 'return' && this.target && !this.found && this.age < FIND.max - 3 && !this.relaunched;
        this.dock();
        if (relaunch) { this.launch(); this.relaunched = true; }
      }
      return;
    }
    const pv = this.player.ride?.vel ?? this.player.vel ?? _o.set(0, 0, 0), pSpeed = pv.length();
    const lastVel = _lv.copy(this.vel);
    this.aim = null;
    let open = true, awake = true, beam = false;
    if (this.phase === 'launch') {
      if (this.popT < DOCKING.pop) {
        // the hop: still folded, eye open, straight out from the dock (carried with you), turning upright
        this.popT = Math.min(DOCKING.pop, this.popT + dt);
        const e = THREE.MathUtils.smootherstep(this.popT / DOCKING.pop, 0, 1);
        const q = this.dockQuaternion(_q2), out = this.outward(q);
        this.object.position.copy(this.anchor()).addScaledVector(out, DOCKING.hop * e);
        this.object.quaternion.copy(q).slerp(this.uprightAlong(out, up, _q3), e);
        open = this.popT >= DOCKING.pop * DOCKING.bloomAt;
        if (this.popT >= DOCKING.pop) { this.origin.copy(this.object.position); this.vel.copy(pv).addScaledVector(out, 1.2); }
      } else {
        this.origin.addScaledVector(pv, dt);   // it lifts off your shoulder as you go, not where you were
        this.fly(_d2.copy(this.origin).addScaledVector(up, 1.4), 2.5 + pSpeed, up, dt, pv);
      }
      if (this.age >= DOCKING.launch) { this.phase = 'seek'; this.seekT = 0; }
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
      if (this.object.position.distanceTo(this.player.pos) > FIND.near + FIND.out + 20) this.home();   // (lost you: home)
    } else if (this.settleT != null) {
      // the glide in: down the line onto the dock, turning to sit on it (in the dock's frame, so it keeps up as you move)
      this.settleT = Math.min(DOCKING.settle, this.settleT + dt);
      const e = THREE.MathUtils.smootherstep(this.settleT / DOCKING.settle, 0, 1);
      const q = this.dockQuaternion(_q2);
      this.object.position.copy(this.anchor()).add(_l.copy(this.settleFrom).applyQuaternion(q).multiplyScalar(1 - e));
      this.object.quaternion.copy(this.settleQ).slerp(q, e);
      open = false; awake = !!this.relaunch;
      if (this.settleT >= DOCKING.settle) {
        const again = this.relaunch && this.target && this.age < FIND.max - 2;
        this.dock(false);
        if (again) this.launch();
        return;
      }
    } else {
      // home: to the end of the dock's line, folding on the way in
      this.returnT = (this.returnT ?? 0) + dt;
      const home = this.anchor(), q = this.dockQuaternion(_q2), line = _d2.copy(home).addScaledVector(this.outward(q), DOCKING.hop);
      const boxed = this.fly(line, 10 + pSpeed, up, dt, pv);
      const d = this.object.position.distanceTo(line);
      open = d > DOCKING.foldAt;
      if (d < 0.3 && this.fold.petals < 0.45) {
        // shut enough: glide in from here
        this.settleT = 0;
        this.settleFrom = _l.subVectors(this.object.position, home).applyQuaternion(_q3.copy(q).invert()).clone();
        this.settleQ = this.object.quaternion.clone();
      } else if (boxed) this.recall();
      // Recall safely if a closed doorway prevents a physical return.
      else if (this.returnT > 6.5) { this.object.scale.setScalar(Math.max(0, (7 - this.returnT) * 2)); if (this.returnT >= 7) { this.dock(); return; } }
    }
    this.fold.update(dt, open, awake);
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

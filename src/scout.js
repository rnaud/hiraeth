import * as THREE from 'three';
import { makeMaterial, markHero } from './materials.js';
import { sweepCapsule } from './physics.js';
import { Trail } from './trail.js';

const RADIUS = 0.25;     // the drone's collision sphere
const CLEAR = 0.9;       // air it keeps below itself while flying
const MIN_CLEAR = 0.35;  // never lower than this over the ground
const STEER = 6;         // velocity response (1/s): smooth, no jitter
const LEAD = { min: 6, perSpeed: 0.4, max: 15 };   // how far ahead of you it leads (m): further the faster you go
const _d = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3(), _n = new THREE.Vector3(), _f = new THREE.Vector3();
const _s = new THREE.Vector3(), _p = new THREE.Vector3(), _o = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();

const objective = (id, label, position) => ({ id, label, position: position.clone() });

/**
 * Resolve the next actionable step, using the same progress as the journal.
 * `quest`: the tracked quest's objective ({ id, label, position }, or a
 * function returning it; src/story/quests.js). It comes first, except while
 * the observatory expedition is under way.
 */
export function nextObjective({ player, expedition, story, relics, ship = null, level, quest = null }) {
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
  } else if (!story.done) target = objective('story', story.def.label, story.goal);
  else {
    const remaining = (relics?.items ?? []).filter((r) => !r.done).sort((a, b) => player.pos.distanceToSquared(a.pos) - player.pos.distanceToSquared(b.pos));
    target = remaining.length ? objective(`relic-${remaining[0].i}`, 'An undiscovered relic', remaining[0].pos)
      : ship?.pos ? objective('ship', 'Back to the ship', ship.pos) : null;
  }
  return target && viaPortal(player.pos, target, level.navigationPortals ?? level.portals ?? []);
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

/** How far ahead of you the scout leads (m) at your speed (m/s). */
export const guideLead = (speed) => Math.min(LEAD.max, LEAD.min + speed * LEAD.perSpeed);

/** Small physical guide: undocks, leads within sight, waits, then comes home. */
export class Scout {
  constructor({ scene, player, physics, getTarget, sound, label = null }) {
    Object.assign(this, { player, physics, getTarget, sound, label });
    this.phase = 'docked'; this.age = 0; this.elapsed = 0;
    this.vel = new THREE.Vector3(); this.stuck = 0; this.over = 0; this.fade = null;
    this.object = new THREE.Group(); this.object.userData.noCollide = true; scene.add(this.object);
    const shell = makeMaterial({ color: '#fff1ca', flat: true, glow: 0.35 });
    const brass = makeMaterial({ color: '#e2b552', flat: true, metal: 'brass' });
    const lamp = makeMaterial({ color: '#70e7df', glow: 1 });
    this.object.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8).scale(1, 0.7, 1.2), shell));
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 6), lamp); lens.position.z = 0.18; this.object.add(lens);
    this.wings = [];
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.12), brass);
      wing.position.x = side * 0.22; this.object.add(wing); this.wings.push(wing);
    }
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 5, 24), lamp);
    this.ring.rotation.x = Math.PI / 2; this.object.add(this.ring);
    // the pointer: a lit beak off the lens, aimed at the goal (up and down too) while guiding
    this.pointer = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.34, 8).rotateX(Math.PI / 2).translate(0, 0, 0.4), lamp);
    this.pointer.visible = false; this.object.add(this.pointer);
    markHero(this.object);
    // a thin glowing trail behind it, so it's easy to follow by eye
    this.trail = new Trail(scene, { radius: 0.07, life: 1.5, offset: 1.2 });
    this.trail.mesh.visible = false;
    this.previousPlayer = player.pos.clone();
    this.dock();
  }
  anchor() {
    const anchor = this.player.gear?.scoutDock;
    if (anchor) { anchor.updateWorldMatrix(true, false); return anchor.getWorldPosition(new THREE.Vector3()); }
    return this.player.char.torso.localToWorld(new THREE.Vector3(0, 0.7, -0.3));
  }
  dock() {
    this.phase = 'docked'; this.vel.set(0, 0, 0); this.stuck = this.over = 0; this.overUsed = false; this.fade = null; this.object.position.copy(this.anchor()); this.object.scale.setScalar(0.5);
    this.ring.visible = false; if (this.pointer) this.pointer.visible = false; if (this.label) this.label.hidden = true;
  }
  ping() {
    const target = this.getTarget();
    if (!target) return false;
    this.target = target; this.age = 0; this.relaunched = false;
    if (this.phase === 'docked') this.launch();
    else { this.phase = 'guide'; this.object.scale.setScalar(1); }
    this.sound?.chime?.(); return true;
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
    // facing: turn smoothly toward the flight direction (or what it points at: this.aim)
    const face = this.aim ?? (vel.lengthSq() > 0.09 ? vel : to);
    if (face.lengthSq() > 1e-6) {
      _n.copy(face).normalize();
      _m.lookAt(_o.set(0, 0, 0), _n.negate(), Math.abs(_n.dot(up)) > 0.98 ? _a.set(1, 0, 0) : up);   // (straight up or down: any other up will do)
      _q.setFromRotationMatrix(_m);
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
    this.phase = 'launch'; this.origin = this.anchor(); this.object.position.copy(this.origin);
    this.vel.copy(this.player.ride?.vel ?? this.player.vel ?? _o.set(0, 0, 0)); this.stuck = this.over = 0; this.fade = null;
  }
  /** Boxed in: blink out (a short shrink) and come back to the dock, relaunching if still guiding. */
  recall() { if (this.fade === null) this.fade = 0.3; }
  update(dt, paused = false) {
    const up = this.player.frame.up;
    if (this.player.pos.distanceTo(this.previousPlayer) > 45) this.dock();
    this.previousPlayer.copy(this.player.pos);
    this.object.visible = !this.player.hidden;
    // the trail: laid while it flies, left to dissolve once it is home
    this.trail.update(dt, this.phase !== 'docked' && this.fade === null && !this.player.hidden ? this.object.position : null);
    if (this.phase === 'docked' && !this.trail.samples.length) this.trail.mesh.visible = false;
    if (this.phase === 'docked') {
      this.object.position.copy(this.anchor());
      this.player.gear?.scoutDock?.getWorldQuaternion(this.object.quaternion);
      return;
    }
    if (paused) { if (this.label) this.label.hidden = true; return; }
    this.age += dt; this.elapsed += dt;
    this.target = this.getTarget();
    if (!this.target || this.age >= 5) this.phase = 'return';
    if (this.fade !== null) {
      this.fade -= dt;
      this.object.scale.setScalar(Math.max(0, this.fade / 0.3));
      if (this.fade <= 0) {
        // once per ping it pops back out of the dock to try again from your shoulder
        const relaunch = this.phase !== 'return' && this.target && this.age < 4.5 && !this.relaunched;
        this.dock();
        if (relaunch) { this.launch(); this.relaunched = true; }
      }
      return;
    }
    const pv = this.player.ride?.vel ?? this.player.vel ?? _o.set(0, 0, 0), pSpeed = pv.length();
    this.aim = null;
    if (this.phase === 'launch') {
      const k = Math.min(1, this.age / 0.8);
      this.origin.addScaledVector(pv, dt);   // it lifts off your shoulder as you go, not where you were
      this.fly(this.origin.clone().addScaledVector(up, 1.4), 2.5 + pSpeed, up, dt, pv);
      this.object.scale.setScalar(0.5 + k * 0.5);
      if (k === 1) this.phase = 'guide';
    } else if (this.phase === 'guide') {
      // it leads a few metres towards the goal from where you are, keeping
      // your pace (walking, driving or flying): ahead of you on the way, never far off
      const lead = guideLead(pSpeed);
      const from = this.player.pos.clone().addScaledVector(up, 2.2);
      const goal = this.target.position.clone().addScaledVector(up, 1.4);
      const delta = goal.clone().sub(from), range = delta.length();
      const ahead = from.clone().addScaledVector(delta.normalize(), Math.min(lead, range));
      ahead.addScaledVector(up, Math.sin(this.elapsed * 3) * 0.15);
      // and it points at the goal itself, up or down as well
      this.aim = _p.subVectors(this.target.position, this.object.position);
      if (this.fly(ahead, Math.max(7, pSpeed + 6), up, dt, pv)) this.recall();
      if (this.object.position.distanceTo(this.player.pos) > LEAD.max + 12) this.phase = 'return';   // (lost you: home)
    } else {
      const home = this.anchor();
      const boxed = this.fly(home, 10 + pSpeed, up, dt, pv);
      const d = this.object.position.distanceTo(home);
      this.object.scale.setScalar(Math.min(1, 0.5 + d));
      if (d < 0.4) this.dock();
      else if (boxed) this.recall();
      // Recall safely if a closed doorway prevents a physical return.
      else if (this.age > 6.5) { this.object.scale.setScalar(Math.max(0, (7 - this.age) * 2) * 0.5); if (this.age >= 7) this.dock(); }
    }
    this.ring.visible = this.pointer.visible = this.phase === 'guide'; this.ring.rotation.z += dt * 2;
    this.pointer.scale.setScalar(1 + Math.sin(this.elapsed * 6) * 0.12);
    this.wings.forEach((w, i) => { w.rotation.z = Math.sin(this.elapsed * 12 + i * Math.PI) * 0.25; });
  }
  placeLabel(camera) {
    if (!this.label) return;
    const show = (this.phase === 'launch' || this.phase === 'guide') && this.age < 5 && !!this.target;
    this.label.hidden = !show;
    if (!show) return;
    const p = this.object.position.clone().project(camera);
    const behind = this.object.position.clone().applyMatrix4(camera.matrixWorldInverse).z > 0;
    const x = behind ? -p.x : p.x, y = behind ? -p.y : p.y;
    const edge = behind || Math.abs(x) > 0.85 || Math.abs(y) > 0.75;
    this.label.style.left = `${THREE.MathUtils.clamp((x * 0.5 + 0.5) * innerWidth, 100, innerWidth - 100)}px`;
    this.label.style.top = `${THREE.MathUtils.clamp((-y * 0.5 + 0.5) * innerHeight - 30, 100, innerHeight - 100)}px`;
    const arrow = edge ? (Math.abs(x) > Math.abs(y) ? (x > 0 ? '→ ' : '← ') : (y > 0 ? '↑ ' : '↓ ')) : '◇ ';
    this.label.textContent = `${arrow}${this.target.label} · ${Math.round(this.player.pos.distanceTo(this.target.position))} m`;
  }
}

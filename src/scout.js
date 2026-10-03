import * as THREE from 'three';
import { makeMaterial, markHero } from './materials.js';

const objective = (id, label, position) => ({ id, label, position: position.clone() });

/** Resolve the next actionable step, using the same progress as the journal. */
export function nextObjective({ player, expedition, story, relics, gate, level }) {
  let target;
  if (expedition && !expedition.state.returned) {
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
      : gate ? objective('gate', `Gate to ${gate.destTitle}`, gate.pos) : null;
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

/** Small physical guide: undocks, leads within sight, waits, then comes home. */
export class Scout {
  constructor({ scene, player, physics, getTarget, sound, label = null }) {
    Object.assign(this, { player, physics, getTarget, sound, label });
    this.phase = 'docked'; this.age = 0; this.elapsed = 0;
    this.object = new THREE.Group(); this.object.userData.noCollide = true; scene.add(this.object);
    const shell = makeMaterial({ color: '#fff1ca', flat: true, glow: 0.35 });
    const brass = makeMaterial({ color: '#e2b552', flat: true });
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
    markHero(this.object);
    this.previousPlayer = player.pos.clone();
    this.dock();
  }
  anchor() {
    const anchor = this.player.gear?.scoutDock;
    if (anchor) { anchor.updateWorldMatrix(true, false); return anchor.getWorldPosition(new THREE.Vector3()); }
    return this.player.char.torso.localToWorld(new THREE.Vector3(0, 0.7, -0.3));
  }
  dock() {
    this.phase = 'docked'; this.object.position.copy(this.anchor()); this.object.scale.setScalar(0.5);
    this.ring.visible = false; if (this.label) this.label.hidden = true;
  }
  ping() {
    const target = this.getTarget();
    if (!target) return false;
    this.target = target; this.age = 0;
    if (this.phase === 'docked') { this.phase = 'launch'; this.origin = this.anchor(); this.object.position.copy(this.origin); }
    else { this.phase = 'guide'; this.object.scale.setScalar(1); }
    this.sound?.chime?.(); return true;
  }
  moveToward(destination, distance, up) {
    const pos = this.object.position, delta = destination.clone().sub(pos);
    if (delta.length() < 0.02) return;
    const step = Math.min(distance, delta.length()), direct = delta.normalize();
    const side = new THREE.Vector3().crossVectors(direct, up).normalize();
    const options = [direct, direct.clone().addScaledVector(up, 1.8).normalize(), side, side.clone().negate(), up.clone()];
    for (const direction of options) {
      if (direction.lengthSq() < 0.5) continue;
      if (this.physics.rayDistance(pos, direction, step + 0.4) < step + 0.35) continue;
      const next = pos.clone().addScaledVector(direction, step);
      if (this.physics.base && next.y < this.physics.base.heightAt(next.x, next.z) + 0.35) continue;
      pos.copy(next);
      this.object.up.copy(up); this.object.lookAt(pos.clone().add(direction)); return;
    }
  }
  update(dt, paused = false) {
    const up = this.player.frame.up;
    if (this.player.pos.distanceTo(this.previousPlayer) > 45) this.dock();
    this.previousPlayer.copy(this.player.pos);
    this.object.visible = !this.player.hidden;
    if (this.phase === 'docked') {
      this.object.position.copy(this.anchor());
      this.player.gear?.scoutDock?.getWorldQuaternion(this.object.quaternion);
      return;
    }
    if (paused) { if (this.label) this.label.hidden = true; return; }
    this.age += dt; this.elapsed += dt;
    this.target = this.getTarget();
    if (!this.target || this.age >= 5) this.phase = 'return';
    if (this.phase === 'launch') {
      const k = Math.min(1, this.age / 0.8);
      this.moveToward(this.origin.clone().addScaledVector(up, 1.4), dt * 2, up);
      this.object.scale.setScalar(0.5 + k * 0.5);
      if (k === 1) this.phase = 'guide';
    } else if (this.phase === 'guide') {
      const from = this.player.pos.clone().addScaledVector(up, 2.2);
      const goal = this.target.position.clone().addScaledVector(up, 1.4);
      const delta = goal.clone().sub(from), range = delta.length();
      const ahead = from.clone().addScaledVector(delta.normalize(), Math.min(9, range));
      ahead.addScaledVector(up, Math.sin(this.elapsed * 3) * 0.15);
      const speed = Math.max(7, (this.player.ride?.vel ?? this.player.vel)?.length() + 4 || 7);
      this.moveToward(ahead, dt * speed, up);
      if (this.object.position.distanceTo(this.player.pos) > 18) this.phase = 'return';
    } else {
      const home = this.anchor();
      this.moveToward(home, dt * 10, up);
      const d = this.object.position.distanceTo(home);
      this.object.scale.setScalar(Math.min(1, 0.5 + d));
      if (d < 0.4) this.dock();
      // Recall safely if a closed doorway prevents a physical return.
      else if (this.age > 6.5) { this.object.scale.setScalar(Math.max(0, (7 - this.age) * 2) * 0.5); if (this.age >= 7) this.dock(); }
    }
    this.ring.visible = this.phase === 'guide'; this.ring.rotation.z += dt * 2;
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

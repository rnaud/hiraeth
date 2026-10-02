import * as THREE from 'three';
import { buildCharacter } from './player.js';
import { Cape } from './cape.js';
import { Animator } from './animator.js';
import { Humanoid } from './humanoid.js';

// People of the world: they walk a looping route, pause and look around,
// turn and wave when you come close, then say a line in a comic speech
// balloon. Shy ones back away if you run at them. Their cloaks are the same
// cloth simulation as yours, updated only when they are near the camera.

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3(), _push = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

export class NPC {
  /**
   * @param o.route   [Vector3] waypoints (on the ground)
   * @param o.palette colours for buildCharacter
   * @param o.lines   things they say
   */
  constructor(scene, physics, { route, palette, lines, speed = 1.25, shy = false, scale = 1, lib = null, human = null, kind = 'm' }) {
    this.physics = physics;
    this.route = route;
    this.lines = lines;
    this.speed = speed * (0.85 + Math.random() * 0.3);
    this.shy = shy;
    this.char = buildCharacter(palette);
    this.char.pack.visible = Math.random() < 0.5;
    this.object = this.char.root;
    this.object.scale.setScalar(scale);
    this.object.userData.noCollide = true;
    scene.add(this.object);
    const SKINS = ['#e9cfb4', '#d9a98a', '#b07a5a', '#f1dccb', '#8a5a40'];
    this.humanoid = human ? new Humanoid(human, this.char, kind, { skin: SKINS[Math.floor(Math.random() * SKINS.length)] }) : null;
    this.cape = new Cape(scene, this.char.capeAnchor ?? this.char.torso, { color: this.char.colors.cloak, cols: 10, rows: 8 });
    this.animator = lib ? new Animator(lib, this.char) : null;
    this.pos = route[0].clone();
    this.heading = 0;
    this.wp = 1;
    this.pause = Math.random() * 3;
    this.phase = Math.random();
    this.time = Math.random() * 10;
    this.vel = new THREE.Vector3();
    this.greeted = 0;
    this.lineIdx = Math.floor(Math.random() * lines.length);

    this.balloon = document.createElement('div');
    this.balloon.className = 'balloon';
    document.body.appendChild(this.balloon);
  }

  update(dt, player, camera) {
    this.time += dt;
    const toPlayer = _v.subVectors(player.pos, this.pos);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const mover = player.ride ?? player;
    const playerSpeed = Math.hypot(mover.vel.x, mover.vel.z);
    const greetR = player.riding ? 18 : 9;
    let speed = 0, face = null;

    // a vehicle bearing down on them: jump aside (perpendicular to its path)
    const incoming = player.riding && dist < 9 && playerSpeed > 6 &&
      _w.set(mover.vel.x, 0, mover.vel.z).normalize().dot(_d.copy(toPlayer).normalize().negate()) > 0.6;
    if (incoming) {
      _w.set(-mover.vel.z, 0, mover.vel.x).normalize();
      if (_w.dot(toPlayer) > 0) _w.negate();
      speed = this.speed * 3.2;
      this.move(_w, speed, dt);
      face = Math.atan2(-toPlayer.x, -toPlayer.z) + Math.PI;
      this.greeted = 0;
    } else if (this.shy && dist < 7 && playerSpeed > 6) {
      // run away from a charging player
      _w.copy(toPlayer).normalize().negate();
      speed = this.speed * 2.6;
      this.move(_w, speed, dt);
      face = Math.atan2(_w.x, _w.z);
      this.greeted = 0;
    } else if (dist < greetR) {
      // stop, face the player, wave once
      face = Math.atan2(toPlayer.x, toPlayer.z);
      if (!this.greeted) { this.greeted = this.time; this.lineIdx = (this.lineIdx + 1) % this.lines.length; }
    } else {
      this.greeted = 0;
      if (this.pause > 0) this.pause -= dt;
      else {
        const target = this.route[this.wp];
        _w.subVectors(target, this.pos); _w.y = 0;
        const d = _w.length();
        if (d < 0.6) {
          this.wp = (this.wp + 1) % this.route.length;
          this.pause = 1.5 + Math.random() * 4;
        } else {
          _w.divideScalar(d);
          speed = this.speed;
          this.move(_w, speed, dt);
          face = Math.atan2(_w.x, _w.z);
        }
      }
    }
    if (face !== null) {
      let dh = face - this.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      this.heading += dh * (1 - Math.exp(-5 * dt));
    }
    // stay on the ground
    const g = this.physics.groundAt(this.pos.x, this.pos.y + 1.5, this.pos.z);
    if (Number.isFinite(g)) this.pos.y += (g - this.pos.y) * (1 - Math.exp(-15 * dt));

    this.pose(dt, speed, this.greeted ? this.time - this.greeted : -1, dist, player);
    this.object.position.copy(this.pos);
    this.object.quaternion.setFromAxisAngle(Y, this.heading);
    if (camera.position.distanceTo(this.pos) < 160) this.humanoid?.update();

    // cloth only near the camera
    const camD = camera.position.distanceTo(this.pos);
    this.cape.mesh.visible = camD < 220;
    if (camD < 70) {
      this.object.updateMatrixWorld(true);
      this.vel.set(Math.sin(this.heading) * speed, 0, Math.cos(this.heading) * speed);
      this.cape.update(dt, { up: Y, vel: this.vel, wind: player.wind, floor: this.pos, capsules: this.humanoid ? this.humanoid.capsules() : this.capsules() });
    }

    // speech balloon
    const talking = this.greeted && this.time - this.greeted > 0.6 && dist < greetR;
    if (talking) {
      _w.copy(this.pos).add(_v.set(0, 2.7, 0)).project(camera);
      const on = _w.z < 1 && Math.abs(_w.x) < 1.1 && Math.abs(_w.y) < 1.1;
      if (on) {
        this.balloon.textContent = this.lines[this.lineIdx];
        this.balloon.style.left = `${(_w.x * 0.5 + 0.5) * window.innerWidth}px`;
        this.balloon.style.top = `${(-_w.y * 0.5 + 0.5) * window.innerHeight}px`;
      }
      this.balloon.classList.toggle('show', on);
    } else this.balloon.classList.remove('show');
  }

  move(dir, speed, dt) {
    this.pos.addScaledVector(dir, speed * dt);
    // don't walk through walls, rocks or buildings
    this.physics.pushCapsule(this.pos, 0.4, 0.6, 2.0, _push);
  }

  capsules() {
    const c = this.char;
    if (!this._caps) {
      this._caps = [{ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.2 }];
      for (let i = 0; i < 2; i++) this._caps.push({ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.11 });
    }
    const K = this._caps;
    c.torso.localToWorld(K[0].a.set(0, 0.05, 0));
    c.torso.localToWorld(K[0].b.set(0, 0.6, 0));
    for (let i = 0; i < 2; i++) {
      c.legs[i].localToWorld(K[1 + i].a.set(0, 0, 0));
      c.feet[i].localToWorld(K[1 + i].b.set(0, 0, 0));
    }
    return K;
  }

  /** Mocap clips (walk / jog when fleeing / idle / talking), wave layered on top. */
  pose(dt, speed, waveT, dist, player) {
    const c = this.char;
    if (this.animator) {
      const N = this.animator.lib.native;
      this.animator.update(dt, {
        speed, onGround: true, mode: waveT >= 0 ? 'talk' : 'ground',
        walkAt: N.walk * 1.3, jogAt: N.jog, sprintAt: N.sprint * 1.2, strideScale: 1.05,
      });
      this.object.position.copy(this.pos);
      this.object.quaternion.setFromAxisAngle(Y, this.heading);
      this.animator.apply(this.object, { legScale: 1.04 });
      if (waveT >= 0 && waveT < 2.2) {
        const k = Math.min(waveT * 4, 1) * Math.min((2.2 - waveT) * 4, 1);
        c.arms[1].rotation.set(-0.2 * k, 0, 0.12 + 2.5 * k);
        c.elbows[1].rotation.set(-(0.3 + 0.5 * Math.sin(waveT * 14) * k), 0, 0);
      }
      if (dist < 12) {
        _v.subVectors(player.pos, this.pos);
        let a = Math.atan2(_v.x, _v.z) - this.heading;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        c.head.rotateY(THREE.MathUtils.clamp(a, -1.1, 1.1) * 0.8);
      }
      return;
    }
    const moving = Math.min(speed / 1.5, 1), run = Math.min(Math.max((speed - 3) / 3, 0), 1);
    this.phase = (this.phase + (speed / THREE.MathUtils.lerp(1.5, 2.6, run)) * dt) % 1;
    const ph = this.phase * Math.PI * 2;
    const hip = Math.sin(ph) * THREE.MathUtils.lerp(0.45, 0.85, run) * moving;
    const kneeAmp = THREE.MathUtils.lerp(0.7, 1.5, run) * moving;
    c.legs[0].rotation.set(hip, 0, 0);
    c.legs[1].rotation.set(-hip, 0, 0);
    c.knees[0].rotation.x = Math.max(0, -Math.cos(ph)) * kneeAmp + 0.05;
    c.knees[1].rotation.x = Math.max(0, Math.cos(ph)) * kneeAmp + 0.05;
    c.feet[0].rotation.x = -(hip + c.knees[0].rotation.x) * 0.8;
    c.feet[1].rotation.x = -(-hip + c.knees[1].rotation.x) * 0.8;
    const walkBob = 0.5 + 0.5 * Math.cos(2 * ph);
    c.body.position.y = walkBob * 0.03 * moving + Math.sin(this.time * 2) * 0.006;
    c.body.rotation.set(0.04 * moving + run * 0.2, 0, 0);
    c.torso.rotation.set(0, Math.sin(ph) * 0.12 * moving, 0);
    c.arms[0].rotation.set(-hip * 0.9, 0, -0.06);
    c.arms[1].rotation.set(hip * 0.9, 0, 0.06);
    c.elbows[0].rotation.x = c.elbows[1].rotation.x = -(0.2 + run * 1.2);
    // wave: right arm up, hand swinging, for ~2 s after greeting
    if (waveT >= 0 && waveT < 2.2) {
      const k = Math.min(waveT * 4, 1) * Math.min((2.2 - waveT) * 4, 1);
      c.arms[1].rotation.set(-0.2 * k, 0, 0.12 + 2.5 * k);
      c.elbows[1].rotation.x = -(0.3 + 0.5 * Math.sin(waveT * 14) * k);
    }
    // look: at the player when near, around when idle
    let look = Math.sin(this.time * 0.4) * 0.5 * (1 - moving);
    if (dist < 12) {
      _v.subVectors(player.pos, this.pos);
      let a = Math.atan2(_v.x, _v.z) - this.heading;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      look = THREE.MathUtils.clamp(a, -1.1, 1.1);
    }
    c.head.rotation.set(0, look, 0);
    c.hatTip.rotation.x = Math.cos(2 * ph) * 0.1 * moving;
  }

  dispose(scene) {
    scene.remove(this.object);
    this.cape.dispose(scene);
    this.balloon.remove();
  }
}

/**
 * Scatter a level's people: each walks a small loop around a centre.
 * @param spots [{ at: [x, z] | Vector3, palette, lines, shy, radius }]
 */
export function spawnNPCs(scene, physics, spots, { fromY = 1e4, lib = null, humans = null } = {}) {
  return spots.map((s, k) => {
    const cx = s.at[0], cz = s.at[1];
    const r = s.radius ?? 14;
    const route = [];
    const n = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.8;
      const x = cx + Math.cos(a) * r * (0.5 + Math.random() * 0.5), z = cz + Math.sin(a) * r * (0.5 + Math.random() * 0.5);
      const y = physics.groundAt(x, s.y !== undefined ? s.y + 2 : fromY, z);
      route.push(new THREE.Vector3(x, Number.isFinite(y) ? y : 0, z));
    }
    const kind = k % 2 ? 'f' : 'm';
    return new NPC(scene, physics, { route, palette: s.palette, lines: s.lines, shy: s.shy, speed: s.speed, lib,
      human: humans ? humans[kind === 'm' ? 0 : 1] : null, kind });
  });
}

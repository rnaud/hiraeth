import * as THREE from 'three';
import { buildCharacter } from './player.js';
import { Cape } from './cape.js';
import { Animator } from './animator.js';
import { Humanoid } from './humanoid.js';
import { makeMaterial, sharedUniforms, MODE_OUTFIT } from './materials.js';
import { registerTarget } from './targets.js';

// People of the world: they walk a looping route, pause and look around,
// turn and wave when you come close, then say a line in a comic speech
// balloon. Shy ones back away if you run at them. Their cloaks are the same
// cloth simulation as yours, updated only when they are near the camera.
//
// Pooled NPCs (pooled: true) are the near tier of the city crowds (crowd.js):
// no mind of their own. assign(person) restyles one to match a crowd person,
// and it then mirrors that person's simulated place, pose and reactions until
// release().
//
// The player's fluid tool: hit(mode). A glob splashes and startles them (a
// jump, a turn to the shooter, a short line); the push shoves them back a
// couple of metres, stumbling with their arms flung up.
//
// Story people (src/story/): `follow` walks them toward a moving target
// (the head of a procession, the player), `seat` sits them on a cushion at
// that height, and while `talkTo` is set they stop, turn to the player and
// gesture as they speak. `def` is their conversation data.

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3(), _push = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
const SPLASHED = ['Hey! I\u2019m soaked!', 'Ugh, it\u2019s all colours!', 'Who threw that?', 'Was that you?', 'Hey, not funny!'];
const SHOVED = ['Whoa! Watch it!', 'Oof! Hey!', 'Mind where you push!', 'Easy, traveller!'];

export class NPC {
  /**
   * @param o.route   [Vector3] waypoints (on the ground)
   * @param o.palette colours for buildCharacter
   * @param o.lines   things they say
   * @param o.pooled  a crowd's near-tier body (hidden until assign())
   */
  constructor(scene, physics, { route, palette, lines, speed = 1.25, shy = false, scale = 1, lib = null, human = null, kind = 'm', pooled = false, follow = null, seat = null, head = null, cape = null, def = null }) {
    this.physics = physics;
    this.follow = follow;   // () => { pos, speed, near } | null: walk there instead of the route
    this.seat = seat;       // sit on something this high (m) instead of walking
    this.def = def;
    this.talkTo = null;     // set by the conversation: face the player, stay put
    this.scene = scene;
    this.kind = kind;
    this.pooled = pooled;
    this.person = null;
    this.stumbleUntil = -1;
    this.knock = new THREE.Vector3();   // a shove's velocity (m/s), dying away
    this.startleAt = -1e9;
    this.shout = null;
    this.route = route;
    this.lines = lines;
    this.speed = speed * (0.85 + Math.random() * 0.3);
    this.shy = shy;
    this.char = buildCharacter(palette);
    this.char.pack.visible = !pooled && Math.random() < 0.5;
    this.object = this.char.root;
    this.object.scale.setScalar(scale);
    this.object.userData.noCollide = true;
    scene.add(this.object);
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const SKINS = ['#e9cfb4', '#d9a98a', '#b07a5a', '#f1dccb', '#8a5a40'];
    const HAIR = ['#2b211f', '#4a3226', '#6e4a32', '#b0a89a', '#a8552e', '#e8dcc0'];
    this.humanoid = human ? new Humanoid(human, this.char, kind, { skin: pick(SKINS) }) : null;
    // costume: headwear and a cape from shoulder-short to floor-length (or none)
    head = pooled ? 'hood' : head ?? pick(['hood', 'hat', 'hat', 'wrap', 'hair', 'hair']);
    if (!pooled) this.humanoid?.setHeadwear(head, { color: palette.hat ?? pick(['#d8a24a', '#e6875f', '#f3ead8', '#62c3c9', '#a99be0']), hair: palette.hair ?? pick(HAIR), accent: this.char.colors.cloak });
    const capeLen = pooled ? 0 : cape ?? (head === 'hood' ? 1.45 : pick([0, 0.55, 0.9, 1.25, 1.45]));
    this.cape = capeLen > 0
      ? new Cape(scene, this.char.capeAnchor ?? this.char.torso, { color: this.char.colors.cloak, cols: 10, rows: capeLen > 1 ? 8 : 6, length: capeLen, bottom: 0.25 + capeLen * 0.17 })
      : null;
    if (!this.cape) this.char.root.traverse((o) => { if (o.isMesh && o.geometry.type === 'TorusGeometry' && o.parent === this.char.capeAnchor) o.visible = false; });
    this.animator = lib ? new Animator(lib, this.char) : null;
    this.pos = route[0].clone();
    this.heading = 0;
    this.wp = 1 % route.length;
    this.pause = Math.random() * 3;
    this.phase = Math.random();
    this.time = Math.random() * 10;
    this.vel = new THREE.Vector3();
    this.greeted = 0;
    this.lineIdx = Math.floor(Math.random() * lines.length);

    this.balloon = document.createElement('div');
    this.balloon.className = 'balloon';
    document.body.appendChild(this.balloon);
    if (pooled) this.hide();
  }

  /** Shown bodies are in the scene; hidden ones leave it, so their hundred bones skip every pass's matrix update. */
  show(on) {
    this.object.visible = on;
    if (on && !this.object.parent) this.scene.add(this.object);
    else if (!on && this.object.parent) this.object.removeFromParent();
  }

  hide() {
    this.show(false);
    if (this.cape) this.cape.mesh.visible = false;
    this.talking = false;
    this.balloon.classList.remove('show');
  }

  /** Become a crowd person: their clothes, size and place (pooled NPCs only). */
  assign(person, crowd) {
    this.person = person;
    this.crowd = crowd;
    this.restyle(person.style);
    this.object.scale.setScalar(person.size);
    this.pos.copy(person.pos);
    this.heading = person.heading;
    this.lines = [person.lines[person.lineIdx % person.lines.length]];
    this.lineIdx = 0;
    this._frozen = false;
    if (this.animator) this.animator.phase = person.phase;
    if (this.cape) this.cape.ready = false;   // the cloth drops into place at the new spot
  }

  release() {
    this.person = null;
    this.hide();
  }

  /** Re-dress: tunic / trousers / skin on the body, headwear, and a cape of the right colour and length. */
  restyle(s) {
    if (this._style === s) return;
    this._style = s;
    const h = this.humanoid, c = this.char;
    Object.assign(c.colors, { cloak: s.cloak, cloth: s.cloth, legs: s.legs });
    if (h) {
      // own copies of the body and brow materials, so recolouring touches only this body
      if (!this._mats) {
        this._mats = new Map();
        const ink = new THREE.Color(c.colors.ink).getHex();
        h.model.traverse((o) => {
          if (!o.isSkinnedMesh || !o.material?.uniforms) return;   // body, eyes, brows (not the headwear on the bones)
          if (!this._mats.has(o.material)) {
            const m = o.material.clone();
            Object.assign(m.uniforms, sharedUniforms);
            m.userData.role = m.uniforms.uMode.value === MODE_OUTFIT ? 'body' : m.uniforms.uColor.value.getHex() === ink ? 'eyes' : 'brows';
            this._mats.set(o.material, m);
          }
          o.material = this._mats.get(o.material);
        });
      }
      for (const m of this._mats.values()) {
        const u = m.uniforms;
        if (m.userData.role === 'body') { u.uColor.value.set(s.cloth); u.uColor2.value.set(s.legs); u.uSkin.value.set(s.skin); u.uGlove.value.w = 0; }   // bare hands, like the crowd figures
        else if (m.userData.role === 'brows') u.uColor.value.set(s.hair);
      }
      // headwear: drop what setHeadwear added last time, then dress again
      const A = h.headAnchor;
      for (const o of this._headwear ?? []) { A.remove(o); o.traverse((m) => m.geometry?.dispose()); }
      const before = new Set(A.children);
      h.setHeadwear(s.head, { color: s.hat, hair: s.hair, accent: s.accent });
      this._headwear = A.children.filter((o) => !before.has(o));
      for (const part of h.hood) part.traverse((o) => {
        if (o.isMesh) o.material = makeMaterial({ color: s.cloak, ...(o.material.side === THREE.DoubleSide ? { side: THREE.DoubleSide } : {}) });
      });
    }
    // the cape: the same colour and length as the crowd figure
    this.cape?.dispose(this.scene);
    this.cape = s.capeLen > 0
      ? new Cape(this.scene, c.capeAnchor ?? c.torso, { color: s.cloak, cols: 10, rows: s.capeLen > 1 ? 8 : 6, length: s.capeLen, bottom: 0.25 + s.capeLen * 0.17 })
      : null;
    if (this.cape) this.cape.mesh.visible = false;
    c.root.traverse((o) => { if (o.isMesh && o.geometry.type === 'TorusGeometry' && o.parent === c.capeAnchor) o.visible = !!this.cape; });
  }

  /** The fluid tool: 'shoot' startles (a jump, a turn to the shooter, a short line), 'push' shoves them back, stumbling. */
  hit(mode, dir, info) {
    if (this.time < this.stumbleUntil) return;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    if (dir) this.faceTo = Math.atan2(-dir.x, -dir.z);
    if (mode === 'push') {
      this.stumbleUntil = this.time + 0.9; this._frozen = false;
      if (dir) this.knock.set(dir.x, 0, dir.z).normalize().multiplyScalar(4 * (info?.shove ?? 2.4) * (0.6 + 0.4 * (info?.strength ?? 1)));   // dies away at 4/s: ~shove metres
      this.startleAt = this.time + 0.1;   // no hop after the stumble: they just stand and glare (until ~2.5 s)
      this.shout = { text: pick(SHOVED), until: this.time + 3 };
      return;
    }
    this.startleAt = this.time;
    this.shout = { text: pick(SPLASHED), until: this.time + 2.2 };
  }

  /** Where the tool aims: the chest. */
  chest(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + 1.15 * this.object.scale.y, this.pos.z);
  }

  update(dt, player, camera) {
    if (this.pooled) {
      if (!this.person) { if (this.object.visible) this.hide(); return; }
      this.updatePuppet(dt, player, camera, this.person);
      return;
    }
    // far away: hidden past 260 m, updated at a quarter rate past 110 m
    const camD0 = camera.position.distanceTo(this.pos);
    this.show(camD0 < 260);
    if (this.cape) this.cape.mesh.visible = camD0 < 220;
    if (camD0 > 110 && this.follow) {
      // far away a follower simply keeps up (no walking simulation)
      const f = this.follow();
      if (f?.pos) { _w.subVectors(f.pos, this.pos); _w.y = 0; if (_w.lengthSq() > 0.25) this.heading = Math.atan2(_w.x, _w.z); this.pos.copy(f.pos); }
      this.object.position.copy(this.pos);
      this.object.quaternion.setFromAxisAngle(Y, this.heading);
    }
    if (camD0 > 260) { this.talking = false; return; }
    if (camD0 > 110) { this._skip = ((this._skip ?? 0) + 1) % 4; this._acc = (this._acc ?? 0) + dt; if (this._skip) return; dt = this._acc; this._acc = 0; }
    else this._acc = 0;
    this.time += dt;
    // shoved: knocked back (not through walls), stumbling with the arms flung up
    if (this.time < this.stumbleUntil) {
      this.greeted = 0;
      this.talking = !!this.shout;
      const sp = this.knock.length();
      if (sp > 0.05) { this.move(_w.copy(this.knock).divideScalar(sp), sp, dt); this.knock.multiplyScalar(Math.exp(-4 * dt)); }
      const g = this.physics.groundAt(this.pos.x, this.pos.y + 1.5, this.pos.z);
      if (Number.isFinite(g)) this.pos.y += (g - this.pos.y) * (1 - Math.exp(-15 * dt));
      this.posture(dt, { stumble: true });
      if (camD0 < 160) this.humanoid?.update();
      return;
    }
    this._frozen = false;
    const toPlayer = _v.subVectors(player.pos, this.pos);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const mover = player.ride ?? player;
    const playerSpeed = Math.hypot(mover.vel.x, mover.vel.z);
    const greetR = player.riding ? 18 : 9;
    let speed = 0, face = null;
    const startled = this.time - this.startleAt < 2.4 && this.faceTo !== undefined;

    // a vehicle bearing down on them: jump aside (perpendicular to its path)
    const incoming = player.riding && dist < 9 && playerSpeed > 6 &&
      _w.set(mover.vel.x, 0, mover.vel.z).normalize().dot(_d.copy(toPlayer).normalize().negate()) > 0.6;
    if (this.talkTo) {
      // in conversation: still, turned to the player (seated people only turn their head)
      if (!this.seat) face = Math.atan2(toPlayer.x, toPlayer.z);
      this.greeted = 0;
    } else if (incoming && !this.seat) {
      _w.set(-mover.vel.z, 0, mover.vel.x).normalize();
      if (_w.dot(toPlayer) > 0) _w.negate();
      speed = this.speed * 3.2;
      this.move(_w, speed, dt);
      face = Math.atan2(-toPlayer.x, -toPlayer.z) + Math.PI;
      this.greeted = 0;
    } else if (startled) {
      // darted: stand still, turned to the shooter
      face = this.faceTo;
      this.greeted = 0;
    } else if (this.seat) {
      // seated: stays put, turns the head toward you when you're close
      this.greeted = dist < greetR ? (this.greeted || this.time) : 0;
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
    } else if (this.follow) {
      // walk toward a moving target, matching its pace; wait when close enough
      this.greeted = 0;
      const f = this.follow();
      if (f?.pos) {
        _w.subVectors(f.pos, this.pos); _w.y = 0;
        const d = _w.length(), near = f.near ?? 1.2;
        if (d > 40) { this.pos.copy(f.pos); }           // fell far behind (a teleport, a long fall): catch up
        else if (d > near) {
          _w.divideScalar(d);
          speed = Math.min((f.speed ?? this.speed) + (d - near) * 0.6, f.max ?? 4.5);
          this.move(_w, speed, dt);
          face = Math.atan2(_w.x, _w.z);
        } else if (f.face !== undefined) face = f.face;
      }
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
    const g = this.physics.groundAt(this.pos.x, this.pos.y + 1.5 - (this.seat ?? 0), this.pos.z);
    if (Number.isFinite(g)) this.pos.y += (g + (this.seat ?? 0) - this.pos.y) * (1 - Math.exp(-15 * dt));

    const waveT = this.talkTo ? -1 : this.greeted && !this.seat ? this.time - this.greeted : -1;
    this.pose(dt, speed, waveT, dist, player, this.talkTo ? (this.talkTo.speaking ? 'talk' : 'ground') : null);
    this.object.position.copy(this.pos);
    this.object.quaternion.setFromAxisAngle(Y, this.heading);
    this.posture(dt, { startle: this.time - this.startleAt, pose: this.seat ? 4 : 0 });
    if (this.seat) {
      // the hips down on the cushion, a little behind its front edge
      const s = this.object.scale.y;
      this.object.position.x -= Math.sin(this.heading) * 0.12 * s;
      this.object.position.z -= Math.cos(this.heading) * 0.12 * s;
      this.object.position.y += (0.05 - 0.95) * s;
    }
    if (camera.position.distanceTo(this.pos) < 160) this.humanoid?.update();

    // cloth only near the camera
    const camD = camera.position.distanceTo(this.pos);
    if (this.cape) this.cape.mesh.visible = camD < (this.lowDetail ? 120 : 220);
    // (every frame up close; every 2nd / 3rd frame further off, where a camp full of people
    // spent ~0.7 ms a frame on cloth nobody could see move)
    this._clothDt = (this._clothDt ?? 0) + dt;
    const every = camD < 12 ? 1 : camD < 35 ? 2 : 3;
    this._clothN = ((this._clothN ?? 0) + 1) % every;
    if (this.cape && camD < (this.lowDetail ? 30 : 70) && (this._clothN === 0 || !this.cape.ready)) {
      this.object.updateMatrixWorld(true);
      this.vel.set(Math.sin(this.heading) * speed, 0, Math.cos(this.heading) * speed);
      this.cape.update(Math.min(this._clothDt, 1 / 20), { up: Y, vel: this.vel, wind: player.wind, floor: this.pos, capsules: this.humanoid ? this.humanoid.capsules() : this.capsules() });
      this._clothDt = 0;
    } else if (!this.cape || camD >= (this.lowDetail ? 30 : 70)) this._clothDt = 0;

    // speech balloon: placed by placeBalloon() after the camera has moved this frame
    this.talking = !this.talkTo && this.greeted && this.time - this.greeted > 0.6 && dist < greetR;
    if (this.shout && this.time < this.shout.until) this.talking = true;
  }

  /** The near tier of a crowd: mirror the simulated person (crowd.js does the thinking). */
  updatePuppet(dt, player, camera, p) {
    this.time += dt;
    const now = this.crowd?.time ?? 0;
    this.show(true);
    this.pos.copy(p.pos);
    this.heading = p.heading;
    _v.subVectors(player.pos, this.pos); _v.y = 0;
    const dist = _v.length();
    const moving = p.speed > 0.05;
    if (now < p.stumbleUntil) this.posture(dt, { stumble: true });
    else {
      this._frozen = false;
      const waveT = p.greetT >= 0 && p.pose === 0 && !p.group ? now - p.greetT : -1;
      this.pose(dt, p.speed, waveT, 99, player, p.talk > 0.45 && !moving ? 'talk' : null);
      // the crowd decides where they look
      this.char.head.rotateY(p.headYaw * 0.85);
      this.char.head.rotateX(p.headPitch * 0.7);
      this.object.position.copy(this.pos);
      this.object.quaternion.setFromAxisAngle(Y, this.heading);
      this.posture(dt, { pose: moving ? 1 : p.pose, startle: now - p.startleT, seed: p.seed });
    }
    const jump = this.object.position.y - this.pos.y;
    this.object.position.copy(this.pos);
    this.object.position.y += Math.max(jump, 0);
    this.object.quaternion.setFromAxisAngle(Y, this.heading);
    if (!moving && (p.pose === 3 || p.pose === 4)) {
      // seated: the hips go down onto the seat, a little behind the edge
      const back = (p.pose === 3 ? 0.22 : 0.12) * p.size;
      this.object.position.x -= Math.sin(this.heading) * back;
      this.object.position.z -= Math.cos(this.heading) * back;
      this.object.position.y += ((p.pose === 3 ? 0.03 : 0.05) - 0.95) * p.size;
    }
    this.humanoid?.update();
    const camD = camera.position.distanceTo(p.pos);
    if (this.cape) this.cape.mesh.visible = true;
    // the cloth is the costly part: every other frame unless right by the camera
    this._clothDt = (this._clothDt ?? 0) + dt;
    this._clothTick = !this._clothTick;
    if (this.cape && (camD < 5 || this._clothTick || !this.cape.ready)) {
      this.object.updateMatrixWorld(true);
      this.vel.set(Math.sin(this.heading) * p.speed, 0, Math.cos(this.heading) * p.speed);
      this.cape.update(Math.min(this._clothDt, 1 / 20), { up: Y, vel: this.vel, wind: player.wind, floor: p.pos, capsules: this.humanoid ? this.humanoid.capsules() : this.capsules() });
      this._clothDt = 0;
    }
    const line = now < (p.shoutUntil ?? -1) ? p.say : p.lines[p.lineIdx % p.lines.length];
    if (this.lines[0] !== line) { this.lines = [line]; this.lineIdx = 0; }
    this.talking = p.speaking && (dist < 6 || now < (p.shoutUntil ?? -1));
  }

  /**
   * Poses the mocap clips don't have, laid over the rig after the clip:
   * pose 2 lean on a rail, 3 sit on an edge, 4 sit on a kerb, 6 lean on a wall;
   * stumble (shoved: caught mid-flail, arms up) and startle (a jump, for ~0.8 s).
   */
  posture(dt, { pose = 0, stumble = false, startle = 99, seed = 0.5 } = {}) {
    const c = this.char;
    if (stumble) {
      // hold the clip's last frame with the arms flung up, one knee raised, leaning back
      if (!this._frozen) {
        this._frozen = true;
        c.arms[0].rotation.set(-0.2, 0, -2.4); c.arms[1].rotation.set(0.1, 0, 2.55);
        c.elbows[0].rotation.set(-0.45, 0, 0); c.elbows[1].rotation.set(-0.25, 0, 0);
        c.legs[1].rotation.set(-0.65, 0, 0); c.knees[1].rotation.set(1.05, 0, 0);
        c.body.rotation.set(-0.12, 0, 0.1);
        c.head.rotation.set(-0.22, 0.25, 0);
      }
      c.body.rotation.z = 0.1 + 0.08 * Math.sin(this.time * 9);   // wobbling for balance
      this.object.position.copy(this.pos);
      this.object.quaternion.setFromAxisAngle(Y, this.heading);
      return;
    }
    if (pose === 2) {
      c.torso.rotation.x += 0.42;
      for (let i = 0; i < 2; i++) { c.arms[i].rotation.set(-1.0, 0, (i ? 1 : -1) * 0.12); c.elbows[i].rotation.set(-1.05, 0, 0); }
      c.head.rotateX(-0.32);
    } else if (pose === 3 || pose === 4) {
      const kick = pose === 3 ? Math.sin(this.time * 1.6 + seed * 20) * 0.25 : 0;
      const hip = pose === 3 ? 1.5 : 1.8;
      c.body.position.set(0, 0, 0);
      c.body.rotation.set(0, 0, 0);
      for (let i = 0; i < 2; i++) {
        c.legs[i].rotation.set(-hip, 0, 0);
        c.knees[i].rotation.set(hip + (i ? -kick : kick), 0, 0);
        c.feet[i].rotation.set(0, 0, 0);
        c.arms[i].rotation.set(pose === 3 ? -0.25 : -0.65, 0, (i ? 1 : -1) * 0.2);
        c.elbows[i].rotation.set(pose === 3 ? -0.35 : -0.9, 0, 0);
      }
      c.torso.rotation.x += pose === 3 ? 0.12 : 0.22;
    } else if (pose === 6) {
      c.body.rotation.x -= 0.06;
      c.legs[0].rotation.set(-0.32, 0, 0); c.knees[0].rotation.set(0.75, 0, 0);
    }
    if (startle >= 0 && startle < 0.8) {
      const k = Math.sin(Math.PI * Math.min(startle / 0.8, 1));
      this.object.position.y += 0.3 * Math.sin(Math.PI * Math.min(startle / 0.45, 1));
      c.arms[0].rotation.z -= 1.5 * k; c.arms[1].rotation.z += 1.5 * k;
      c.head.rotateX(-0.25 * k);
    }
  }

  /** Put the balloon over the head (call after the camera update; only for the one that talks). */
  /** @param lift extra pixels up (the E prompt hangs over this person's head) */
  placeBalloon(camera, show, lift = 0) {
    if (!show || !this.talking) { this.balloon.classList.remove('show'); return; }
    const head = this.humanoid?.b?.Head;
    if (head) head.getWorldPosition(_w).add(_v.set(0, 0.62, 0));
    else _w.copy(this.pos).add(_v.set(0, 2.3, 0));
    _w.project(camera);
    const on = _w.z < 1 && Math.abs(_w.x) < 1.1 && Math.abs(_w.y) < 1.1;
    if (on) {
      const text = this.shout && this.time < this.shout.until ? this.shout.text : this.lines[this.lineIdx];
      if (this.balloon.textContent !== text) this.balloon.textContent = text;
      // kept on the screen (on a phone a balloon over someone near the edge ran off it)
      const w = this.balloon.offsetWidth || 200;
      const x = THREE.MathUtils.clamp((_w.x * 0.5 + 0.5) * window.innerWidth - 22, 6, Math.max(6, window.innerWidth - w - 6));
      this.balloon.style.transform = `translate(${x.toFixed(1)}px, ${((-_w.y * 0.5 + 0.5) * window.innerHeight - lift).toFixed(1)}px) translate(0, calc(-100% - 12px))`;
    }
    this.balloon.classList.toggle('show', on);
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
  pose(dt, speed, waveT, dist, player, mode = null) {
    const c = this.char;
    if (this.animator) {
      const N = this.animator.lib.native;
      this.animator.update(dt, {
        speed, onGround: true, mode: mode ?? (waveT >= 0 ? 'talk' : 'ground'),
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
    this.cape?.dispose(scene);
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
    const npc = new NPC(scene, physics, { route, palette: s.palette, lines: s.lines, shy: s.shy, speed: s.speed, lib,
      human: humans ? humans[kind === 'm' ? 0 : 1] : null, kind, def: s.talk ? s : null });
    return npc;
  });
}

/** A hidden NPC body for a crowd's near tier (see crowd.js). */
export function pooledNPC(scene, physics, { kind = 'm', lib = null, humans = null } = {}) {
  return new NPC(scene, physics, { route: [new THREE.Vector3()], palette: { cloak: '#c8483a', lining: '#2b211f' }, lines: ['…'], lib,
    human: humans ? humans[kind === 'm' ? 0 : 1] : null, kind, pooled: true });
}

/** Put quest and village NPCs on the tool's target list (crowd people register themselves in crowd.js). */
export function registerNPCTargets(npcs) {
  return npcs.filter((n) => !n.pooled).map((n) => {
    const at = new THREE.Vector3();
    return registerTarget({ kind: 'npc', radius: 0.45, npc: n, position: () => n.chest(at), enabled: () => n.object.visible, onHit: (mode, point, dir, info) => n.hit(mode, dir, info) });
  });
}

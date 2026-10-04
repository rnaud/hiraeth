import * as THREE from 'three';
import { game } from '../game-state.js';
import { buildShipModel, buildSpace } from './model.js';
import { R, RI, DECK, CEIL, LIFT, HATCH_A, HINGE_R, WINDOW, HATCH, LEG_A, SCAR } from './hull.js';
import { polar } from './geo.js';
import { CONSOLE_R } from './interior.js';
import { findShipSite, siteAvoid, decorAvoid } from './sites.js';
import { buildCrashSite } from './crash.js';
import { Puffs } from './fx.js';
import { Cinema, Warp } from './cinema.js';
import { StarMap, consoleAction } from './starmap.js';
import { pendingCall, completedWorlds, callLines, callContext, applyCall, ILEN_CALL } from '../story/calls.js';
import { endingUnlocked, HOME_ID } from '../story/ending.js';
import { HomecomingDirector } from './homecoming.js';
import * as sfx from './sfx.js';
import { padIndex } from '../native-pad.js';
import { Prologue } from './prologue.js';
import { PrologueDirector, ArrivalDirector, TakeoffDirector, CallDirector, OBJECTIVE } from './cinematics.js';

// The traveller's ship: a big round ball, home between worlds.
//
//  - It stands at each world's arrival point (src/ship/sites.js). In the
//    desert, until it first flies again, it lies where it crashed: tilted,
//    dug into a dune at the end of its furrow.
//  - Walk up the ramp and in: bunk room, ring corridor, galley, entry hall,
//    cockpit. All of it collides (physics.addCollider).
//  - E at the cockpit console: a waiting call home, else the galactic map
//    (locked until `ship.powered`). Choosing a world takes off and lands
//    there (?level=<id>&via=ship).
//  - E at the foot of the ramp walks you aboard; E in the entry hall walks
//    you out. Anywhere else inside the ship, E does nothing (no whistling
//    the hoverbike into the cockpit).
//  - The prologue (src/ship/prologue.js) plays on a new game.
//
// Flags: prologue.done, ship.powered, ship.level, ship.launched, calls.<n>,
// objective. Events on `game`: ship:enter, ship:exit, travel { to }, call { n }; it sends
// tool:enable { on } to put the fluid tool away indoors and during its scenes.

const Y = new THREE.Vector3(0, 1, 0);
const rAt = (r, y) => Math.sqrt(Math.max(r * r - y * y, 0));
const SPACE_Y = 2600;
export const SMOKE = ['#f3ede0', '#e6dfd0', '#d9d1c2', '#cdc4b4'];

export class Ship {
  /**
   * Build the ship in the level. Call after the level and its physics exist
   * (and before crowds are placed, so they keep clear of it).
   * @param o { scene, physics, level, levelId, content, prologue: play the opening here }
   */
  constructor({ scene, physics, level, levelId, content, prologue = false }) {
    Object.assign(this, { scene, physics, level, levelId, content });
    this.lights = level.lights ?? (level.lights = []);
    this.noShadow = level.noShadow ?? (level.noShadow = []);
    this.heightAt = level.ground?.heightAt ? (x, z) => level.ground.heightAt(x, z) : null;
    const avoid = [...siteAvoid({ level, content }), ...decorAvoid(scene, level, { near: level.spawn }).filter((d) => d.y1 > level.spawn.y - 20 && d.y0 < level.spawn.y + 40)];
    const site = (this.site = findShipSite({ level, physics, levelId, avoid }) ?? { x: level.spawn.x + 30, z: level.spawn.z, heading: -Math.PI / 2, ground: level.spawn.y, source: 'fallback' });
    this.crashed = !!site.crash && !game.flag('ship.launched');
    this.inside = false;
    this.cam = null;          // a cinematic camera, or null to leave the rig alone
    this.shakeK = 0;
    this.auto = null;
    this.busyK = false;
    this.cinematic = null;
    this.powerState = game.flag('ship.powered') ? 'on' : 'emergency';
    this.place();
    if (prologue) this.buildSpaceCopy();
    this.cinema = new Cinema();
    this.warp = new Warp();
    game.on('flag:ship.powered', (v) => { this.setPower(v ? 'on' : 'emergency'); if (v) this.clearObjective(); });
    if (game.flag('ship.powered')) this.clearObjective();
  }

  /** The prologue's "Find a new source of power." is done once the ship has power (it stayed on the HUD). */
  clearObjective() { if (game.flag('objective') === OBJECTIVE) game.set('objective', null); }

  // ------------------------------------------------------------------ placement
  groundAt(x, z, fromY) {
    const g = this.physics.groundAt(x, fromY ?? (this.site.ground ?? 0) + 60, z, 600);
    return Number.isFinite(g) ? g : this.heightAt?.(x, z) ?? this.site.ground;
  }

  place() {
    const s = this.site, crash = this.crashed ? s.crash : null;
    const yaw = s.heading - Math.PI / 2;      // the hatch (local +x) faces site.heading
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(crash?.pitch ?? 0, yaw, crash?.roll ?? 0, 'YXZ'));
    const base = new THREE.Vector3(s.x, 0, s.z);
    const toW = (v, cy) => v.clone().applyQuaternion(q).add(base).setY(v.clone().applyQuaternion(q).y + cy);
    let cy;
    if (crash) {
      cy = this.groundAt(s.x, s.z) + LIFT - crash.sink;   // sunk below its parked height over the spot itself
      // keep the deck and the hatch sill clear of the sand
      let need = -Infinity;
      for (const r of [0, 3, 6, 8.2, 9.3]) for (let k = 0; k < 16; k++) {
        const w = toW(polar(r, (k / 16) * Math.PI * 2, DECK - 0.35), cy);
        need = Math.max(need, this.groundAt(w.x, w.z, w.y + 40) + 0.05 - w.y);
      }
      const h = toW(polar(HINGE_R, HATCH_A, DECK), cy);
      need = Math.max(need, this.groundAt(h.x, h.z, h.y + 40) + 0.3 - h.y);
      if (need > 0) cy += need;
    } else {
      cy = s.ground + LIFT;
      for (const r of [0, 4, 8, 11]) for (let k = 0; k < 12; k++) {
        const p = polar(r, (k / 12) * Math.PI * 2, 0).applyQuaternion(q).add(base);
        cy = Math.max(cy, this.groundAt(p.x, p.z) + rAt(R, r) + 0.4);
      }
    }
    this.restPos = new THREE.Vector3(s.x, cy, s.z);
    this.restQuat = q;
    this.yaw = yaw;
    const m = new THREE.Matrix4().compose(this.restPos, q, new THREE.Vector3(1, 1, 1));
    const W = (v) => v.clone().applyMatrix4(m);
    // the feet find the ground; the ramp reaches it at a walkable slope
    const footY = (a) => {
      const f = W(polar(R + 3, a, -LIFT));
      return this.groundAt(f.x, f.z) - cy;
    };
    const hinge = W(polar(HINGE_R, HATCH_A, DECK));
    const out = new THREE.Vector3(Math.sin(s.heading), 0, Math.cos(s.heading));
    let foot = null;
    for (let d = 1.2; d <= 24; d += 0.2) {
      const p = hinge.clone().addScaledVector(out, d);
      const g = this.groundAt(p.x, p.z, hinge.y + 5);
      if ((hinge.y - g) / d <= Math.tan(THREE.MathUtils.degToRad(27))) { foot = p.setY(g - 0.08); break; }
    }
    foot ??= hinge.clone().addScaledVector(out, 20).setY(this.groundAt(hinge.x + out.x * 20, hinge.z + out.z * 20) - 0.08);
    const rampWorld = foot.clone().sub(hinge);
    const rampLocal = rampWorld.clone().applyQuaternion(q.clone().invert());
    const model = buildShipModel({ legs: crash ? 'up' : 'down', footY, ramp: { dir: rampLocal.clone().normalize(), length: rampLocal.length() + 0.25 } });
    model.group.position.copy(this.restPos);
    model.group.quaternion.copy(q);
    this.scene.add(model.group);
    this.parked = model;
    this.rampFoot = foot.clone().addScaledVector(out, 1.6);
    this.rampFoot.y = this.groundAt(this.rampFoot.x, this.rampFoot.z, foot.y + 5);
    this.hinge = hinge;
    this.outDir = out;
    this.doorK = 1; this.rampK = 1;
    this.setDoor(model, 1);
    // the lamps light the rooms (they are local lights, see main.js updateLights)
    model.lightVecs = model.interior.lamps.map((l) => { const v = new THREE.Vector4(); v.userData = l; this.lights.push(v); return v; });
    this.syncLights(model);
    // the furrow and the heaped sand
    if (crash && this.heightAt) {
      const C = this.restPos;
      const az = (p) => Math.atan2(p.x - C.x, p.z - C.z);
      const protect = [];
      for (let k = 0; k <= 12; k++) {
        const p = W(polar(R, WINDOW.a0 + ((WINDOW.a1 - WINDOW.a0) * k) / 12, WINDOW.y0));
        protect.push({ a: az(p), y: p.y - 0.9, w: 0.1 });
      }
      for (let k = 0; k <= 4; k++) {
        const p = W(polar(R, HATCH.a0 - 0.1 + ((HATCH.a1 - HATCH.a0 + 0.2) * k) / 4, HATCH.y0));
        protect.push({ a: az(p), y: p.y - 0.8, w: 0.14 });
      }
      protect.push({ a: s.heading, y: this.groundAt(foot.x, foot.z) - 0.6, w: 0.42 });
      this.crashSite = buildCrashSite({ heightAt: this.heightAt, centre: C, travel: s.crash.travel, length: s.crash.length, sandMat: this.level.ground.mesh?.material, protect });
      this.scene.add(this.crashSite.group);
    }
    this.colliders = [this.physics.addCollider(model.group)];
    if (this.crashSite) this.colliders.push(this.physics.addCollider(this.crashSite.group));
    // smoke, dust and flame
    this.smoke = new Puffs(this.scene, { count: 150, glow: 0.35, tag: 'ship-smoke', noShadow: this.noShadow });
    this.flame = new Puffs(this.scene, { count: 70, glow: 1, tag: 'ship-flame', noShadow: this.noShadow });
    this.dust = new Puffs(this.scene, { count: 140, glow: 0.55, tag: 'ship-dust', noShadow: this.noShadow });
    this.dust.drag = 1.4;
    this.smoke.lift = 0.5;
    this.smokeT = 0;
    this.setPower(this.powerState, model);
  }

  /** The prologue's ship, in orbit high above the map, wrapped in a dome of stars. */
  buildSpaceCopy() {
    const model = buildShipModel({ space: true, legs: 'up', ramp: null });
    const pos = new THREE.Vector3(this.site.x, SPACE_Y, this.site.z);
    model.group.position.copy(pos);
    this.scene.add(model.group);
    this.setDoor(model, 0);
    const space = buildSpace();
    space.position.copy(pos);
    this.scene.add(space);
    this.noShadow.push(space);
    model.lightVecs = model.interior.lamps.map((l) => { const v = new THREE.Vector4(); v.userData = l; this.lights.push(v); return v; });
    this.syncLights(model);
    this.setPower('on', model);
    this.spaceCopy = { model, space, collider: this.physics.addCollider(model.group) };
  }

  removeSpaceCopy() {
    const s = this.spaceCopy;
    if (!s) return;
    this.physics.removeCollider(s.collider);
    s.model.group.removeFromParent();
    s.space.removeFromParent();
    for (const v of s.model.lightVecs) { const i = this.lights.indexOf(v); if (i >= 0) this.lights.splice(i, 1); }
    const k = this.noShadow.indexOf(s.space);
    if (k >= 0) this.noShadow.splice(k, 1);
    this.spaceCopy = null;
  }

  syncLights(model, on = !model.lightsOff) {
    model.group.updateMatrixWorld(true);
    for (const v of model.lightVecs) {
      const l = v.userData, p = l.p.clone().applyMatrix4(model.group.matrixWorld);
      const r = !on ? 0 : this.powerOf(model) === 'on' ? l.r : this.powerOf(model) === 'emergency' ? l.r * 0.8 : this.powerOf(model) === 'alarm' ? l.r * 0.9 : 0;
      v.set(p.x, p.y, p.z, r);
    }
  }

  powerOf(model) { return model.power ?? 'on'; }

  /** 'on' (lamps warm, core lit), 'emergency' (dim amber, no core: the crashed ship), 'dead', 'alarm' (red). */
  setPower(state, model = this.parked) {
    if (!model) return;
    model.power = state;
    const M = model.mats;
    const col = { on: '#fff1c8', emergency: '#e8a860', dead: '#3a3530', alarm: '#ff4a38' }[state];
    M.lamp.uniforms.uColor.value.set(col);
    M.lamp.uniforms.uGlow.value = state === 'dead' ? 0 : 1;
    M.core.uniforms.uColor.value.set(state === 'on' ? '#7fe3d6' : '#3e5560');
    M.core.uniforms.uGlow.value = state === 'on' ? 1 : 0.05;
    for (const [k, c] of [['btnA', '#f2c54b'], ['btnB', '#5fd0c6'], ['btnC', '#e6503a']]) {
      M[k].uniforms.uColor.value.set(state === 'on' ? c : state === 'alarm' ? '#e6503a' : k === 'btnC' ? '#e6503a' : '#5a5048');
      M[k].uniforms.uGlow.value = state === 'on' || state === 'alarm' || k === 'btnC' ? 1 : 0;
    }
    M.portIn.uniforms.uGlow.value = 1;
    if (model.lightVecs) this.syncLights(model, !model.lightsOff);
    model.callScreen?.set({ who: state === 'on' ? 'idle' : state === 'emergency' ? 'locked' : 'off', power: state === 'dead' ? 0 : 1 });
    if (model === this.parked) this.powerState = state;
  }

  /** k = 0 shut .. 1 open (slid up the hull). */
  setDoor(model, k) {
    model.door.rotation.z = 0.25 * k;
    model.doorK = k;
  }

  /** k = 0 stowed .. 0.5 slid out level .. 1 lowered to the ground. */
  setRamp(model, k) {
    const r = model.ramp;
    if (!r) return;
    r.visible = k > 0.01;
    const L = r.userData.length;
    if (k < 0.5) {
      r.quaternion.identity();
      r.scale.set(Math.max(0.02, k * 2), 1, 1);
    } else {
      r.scale.set(1, 1, 1);
      r.quaternion.identity().slerp(r.userData.deployed, (k - 0.5) * 2);
    }
    void L;
    model.rampK = k;
  }

  // ------------------------------------------------------------------ wiring
  /** The rest of the game, once it exists. */
  attach(deps) {
    Object.assign(this, deps);   // player, rig, camera, sound, journal, post, story, wind, levels, order, titles, levelTitle
    this.map = new StarMap({
      order: deps.order, levels: deps.levels, journal: deps.journal, current: this.levelId,
      flag: (k) => game.flag(k), powered: () => !!game.flag('ship.powered'),
      home: () => endingUnlocked(this.completed()) || this.levelId === HOME_ID,   // src/story/ending.js
      onTravel: (id) => this.travel(id),
    });
    globalThis.addEventListener?.('keydown', (e) => { if (e.code === 'Escape') this._esc = true; this._keyT = performance.now(); });
    globalThis.addEventListener?.('keyup', (e) => { if (e.code === 'Escape') this._esc = false; });
    globalThis.addEventListener?.('blur', () => { this._esc = false; });
  }

  /** Called when the world is ready. via: 'ship' (arriving by ship) | null. */
  start({ via, prologue, homecoming, onReady }) {
    this.onReady = onReady;
    if (homecoming && this.spaceCopy) {
      // the end: out of the jump over home, the choice in the cockpit, the landing, the door (src/ship/homecoming.js)
      this.cinematic = new HomecomingDirector(this);
      this.cinematic.start();
      return;
    }
    if (prologue && this.spaceCopy) {
      const director = new PrologueDirector(this);
      this.prologue = new Prologue({ director, game });
      this.cinematic = this.prologue;
      this.prologue.start();
      return;
    }
    this.removeSpaceCopy();
    if (this.crashSite) this.crashSite.reveal(1);
    if (this.crashed) this.startSmoke = true;
    if (via === 'ship') {
      this.cinematic = new ArrivalDirector(this);
      this.cinematic.start();
      return;
    }
    onReady?.();
  }

  /** Something is playing on its own (input to the player is cut). */
  busy() {
    if (this.map?.open) return true;
    if (this.auto) return false;   // walking on its own: the autopilot's input must reach the player
    const c = this.cinematic;
    if (!c || c.done) return false;
    return !c.interactive?.();
  }

  get playing() { return !!this.cinematic && !this.cinematic.done; }

  // ------------------------------------------------------------------ the player in and around the ship
  local(model, p) { return model.group.worldToLocal(p.clone()); }
  world(model, v) { model.group.updateMatrixWorld(); return v.clone().applyMatrix4(model.group.matrixWorld); }
  worldHeading(model, localHeading) {
    const d = new THREE.Vector3(Math.sin(localHeading), 0, Math.cos(localHeading)).applyQuaternion(model.group.quaternion);
    return Math.atan2(d.x, d.z);
  }

  isInside(model, p) {
    const l = this.local(model, p);
    return l.y > DECK - 0.8 && l.y < CEIL && Math.hypot(l.x, l.z) < rAt(RI, Math.max(l.y, DECK)) + 0.3;
  }

  /** Which ship the player is in (the parked one or the one in orbit), or null. */
  modelOf(p) {
    if (this.spaceCopy && this.isInside(this.spaceCopy.model, p)) return this.spaceCopy.model;
    if (this.isInside(this.parked, p)) return this.parked;
    return null;
  }

  atConsole() {
    const m = this.modelOf(this.player.pos);
    if (!m) return false;
    const l = this.local(m, this.player.pos), c = m.interior.points.cockpit;
    return Math.hypot(l.x - c.x, l.z - c.z) < CONSOLE_R;
  }

  atHatchInside() {
    const m = this.parked;
    if (!this.isInside(m, this.player.pos)) return false;
    const l = this.local(m, this.player.pos), c = m.interior.points.hatchIn;
    return Math.hypot(l.x - c.x, l.z - c.z) < 2.2;
  }

  atRampFoot() {
    const p = this.player.pos;
    return Math.hypot(p.x - this.rampFoot.x, p.z - this.rampFoot.z) < 3.2 && Math.abs(p.y - this.rampFoot.y) < 3;
  }

  /** Where you stand when you arrive by ship: the foot of the ramp, facing out. */
  arrivalSpot() { return { pos: this.rampFoot.clone(), heading: this.site.heading }; }

  /** Put the player somewhere (world), facing a heading, shown or hidden. */
  placePlayer(pos, heading, visible = true) {
    const P = this.player;
    P.respawn(pos.clone().add(new THREE.Vector3(0, 0.05, 0)));
    P.heading = heading;
    P.lastSafe?.copy(P.pos);
    this.showPlayer(visible);
  }

  showPlayer(on) {
    const P = this.player;
    P.object.visible = on;
    P.hidden = !on;
    if (P.gear?.device) P.gear.device.visible = on;
  }

  /** Walk the player along world points; the camera stays behind (or a shot is used). */
  autopilot(points, onDone, { run = false } = {}) {
    this.auto = { points: points.map((p) => p.clone()), i: 0, onDone, run, t: 0 };
  }

  /** Filter the player's input: the ship's E, and the autopilot. Called before player.update. */
  input(ctl) {
    if (this.auto) {
      const a = this.auto, P = this.player;
      let tgt = a.points[a.i];
      while (tgt && Math.hypot(P.pos.x - tgt.x, P.pos.z - tgt.z) < 0.55) tgt = a.points[++a.i];
      if (!tgt || (a.t += 1 / 60) > 30) {
        const done = a.onDone;
        this.auto = null;
        done?.();
        return { ...ctl, KeyW: false, KeyE: false };
      }
      const h = Math.atan2(tgt.x - P.pos.x, tgt.z - P.pos.z);
      // the camera swings round behind; the stick walks straight at the target whatever the camera does
      this.rig.yaw += Math.atan2(Math.sin(h + Math.PI - this.rig.yaw), Math.cos(h + Math.PI - this.rig.yaw)) * 0.06;
      const rel = h - this.rig.yaw;
      return { ShiftLeft: a.run, stick: { x: Math.sin(rel), y: -Math.cos(rel) } };
    }
    const c = this.cinematic;
    if (c && !c.done) return { ...ctl, KeyE: false };   // nothing to use while a scene plays
    // E belongs to the ship inside it and at the hatch
    // (not while riding up to it: then E gets you off, as the HUD says)
    const inShip = this.inside || (this.atRampFoot() && !this.player.ride);
    if (inShip && ctl.KeyE) {
      if (!this._eHeld) this.use();
      this._eHeld = true;
      return { ...ctl, KeyE: false };
    }
    this._eHeld = !!ctl.KeyE;
    return ctl;
  }

  /** E: the console, the hatch. */
  use() {
    if (this.atConsole()) return this.useConsole();
    if (this.atHatchInside()) {
      sfx.hatch(this.sound);
      return this.autopilot([this.world(this.parked, this.parked.interior.points.hatchIn), this.hinge.clone(), this.rampFoot.clone()]);
    }
    if (this.atRampFoot()) {
      sfx.hatch(this.sound);
      return this.autopilot([this.rampFoot.clone().lerp(this.hinge, 0.3), this.hinge.clone(), this.world(this.parked, this.parked.interior.points.hatchIn), this.world(this.parked, polar(5.5, HATCH_A, DECK))]);
    }
  }

  completed() {
    return completedWorlds(this.order ?? [], { flag: (k) => game.flag(k), storyDone: (id) => this.journal?.storyDone(id) });
  }

  useConsole() {
    const n = pendingCall({ flag: (k) => game.flag(k), completed: this.completed().length });
    const action = consoleAction({ powered: !!game.flag('ship.powered'), pendingCall: n });
    if (action === 'call') {
      const done = this.completed();
      const lines = callLines(n, callContext(game, { titles: this.titles, completed: done, lastWorld: done.slice(-1)[0] }));
      this.cinematic = new CallDirector(this, { n, lines, who: n === ILEN_CALL ? 'mother' : undefined,
        onDone: () => { applyCall(game, lines); game.set(`calls.${n}`, true); game.emit('call', { n }); } });
      this.cinematic.start();
      return;
    }
    if (action === 'locked') {
      sfx.beep(this.sound);
      this.parked.callScreen?.set({ who: 'locked' });
      this.cinema.say({ who: 'ship', text: 'No power. The engines are cold and the map is dark. Find a new source of power.' }, { secs: 4.2 });
      this.map.toggle(true);   // shown, but locked
      return;
    }
    sfx.beep(this.sound, true);
    this.parked.callScreen?.set({ who: 'map' });
    this.map.toggle(true);
  }

  travel(to) {
    if (!game.flag('ship.powered')) return;
    game.emit('travel', { to });
    game.set('ship.level', to);
    this.cinematic = new TakeoffDirector(this, {
      to, title: this.levels.find((l) => l.id === to)?.title ?? to,
      onDone: () => { game.set('ship.launched', true); location.search = `?level=${to}&via=ship`; },
    });
    this.cinematic.start();
  }

  hud() {
    if (this.playing && !this.cinematic.interactive?.()) return null;
    if (this.auto) return null;
    if (this.inside) {
      if (this.atConsole()) {
        const call = pendingCall({ flag: (k) => game.flag(k), completed: this.completed().length });
        return call ? 'E answer the call home' : game.flag('ship.powered') ? 'E galactic map' : 'E console (no power)';
      }
      if (this.atHatchInside()) return 'E step outside';
      return 'aboard the ship';
    }
    if (this.atRampFoot() && !this.player.ride) return 'E go aboard';
    return null;
  }

  // ------------------------------------------------------------------ camera
  /** A cinematic camera for this frame: { pos, look, fov?, roll? } (world). */
  shot(s) { this.cam = s; }
  release(blend = 0.9) {
    if (this.cam) this.blend = { from: this.cam, t: 0, dur: blend };
    this.cam = null;
  }
  shake(k) { this.shakeK = Math.max(this.shakeK, k); }

  applyCamera(dt) {
    const cam = this.camera;
    const base0 = cam.userData.baseFov ?? (cam.userData.baseFov = cam.fov);
    const base = base0 + 10 * (this.rig?.indoorK ?? 0);   // a wider lens in the rooms
    let fov = base;
    if (this.cam) {
      cam.position.copy(this.cam.pos);
      cam.up.set(0, 1, 0);
      cam.lookAt(this.cam.look);
      if (this.cam.roll) cam.rotateZ(this.cam.roll);
      fov = this.cam.fov ?? base;
    } else if (this.blend) {
      const b = this.blend;
      b.t += dt;
      const k = Math.min(1, b.t / b.dur), e = k * k * (3 - 2 * k);
      _p.copy(b.from.pos).lerp(cam.position, e);
      _l.copy(cam.position).add(_d.set(0, 0, -1).applyQuaternion(cam.quaternion).multiplyScalar(10));
      _l2.copy(b.from.look).lerp(_l, e);
      cam.position.copy(_p);
      cam.lookAt(_l2);
      fov = THREE.MathUtils.lerp(b.from.fov ?? base, base, e);
      if (k >= 1) this.blend = null;
    }
    if (this.shakeK > 0.001) {
      const s = this.shakeK, t = performance.now() / 1000;
      cam.position.x += (Math.sin(t * 61) + Math.sin(t * 23)) * 0.09 * s;
      cam.position.y += (Math.sin(t * 53) + Math.sin(t * 31)) * 0.09 * s;
      cam.rotateZ(Math.sin(t * 37) * 0.025 * s);
      this.shakeK *= Math.exp(-2.2 * dt);
    }
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }

  // ------------------------------------------------------------------ per frame
  /**
   * After the player and the camera rig: inside/outside, the cinematic,
   * the screen, smoke, and the camera override.
   * @param raw the unfiltered input (to read the skip button during cinematics)
   */
  update(dt, t, raw = {}, { photo = false } = {}) {
    const P = this.player;
    const inside = !!this.modelOf(P.pos);
    if (inside !== this.inside) {
      this.inside = inside;
      game.emit(inside ? 'ship:enter' : 'ship:exit', { level: this.levelId });
      // a close, over-the-shoulder camera in the rooms (the rig's tight-space mode,
      // src/player.js CameraRig: it eases in and back out by itself), and no climbing
      // the curved walls of home
      this.rig.indoor = inside;
      if (inside) { this._climb = P.opts.climb; P.opts.climb = false; }
      else if (this._climb !== undefined) { P.opts.climb = this._climb; this._climb = undefined; }
    }
    this.cinema.update(dt);   // timed subtitles; everything on screen kept in its own place
    const c = this.cinematic;
    if (c && !c.done) {
      const skipHeld = !!(raw.Escape || this._esc || padSkip());
      c.update(dt, skipHeld);
      const recent = performance.now() - (this._keyT ?? -1e9) < 2500;
      if (c.skippable !== false) this.cinema.skip(Math.min(1, (c.skipT ?? 0) / 0.9), !c.interactive?.() && ((c.skipT ?? 0) > 0.05 || recent));
      if (c.done) { this.cinematic = null; this.cinema.skip(0, false); }
    }
    // the fluid tool is put away at home and while a scene plays (src/fluid-tool.js listens)
    const toolOn = !this.inside && !(this.cinematic && !this.cinematic.done) && !this.auto;
    if (toolOn !== this._toolOn) { this._toolOn = toolOn; game.emit('tool:enable', { on: toolOn }); }
    // rooms are only drawn when the camera is near enough to see in
    for (const m of [this.parked, this.spaceCopy?.model]) {
      if (!m) continue;
      const near = this.camera.position.distanceTo(m.group.position) < 48;
      if (near !== m.indoorShown) {
        m.indoorShown = near;
        for (const o of m.indoor) o.visible = near;
      }
    }
    // the screen, the mobile, the guide chevrons
    for (const m of [this.parked, this.spaceCopy?.model]) {
      if (!m) continue;
      m.callScreen?.update(dt);
      const mob = m.group.userData.mobile;
      if (mob) mob.rotation.y += dt * 0.15;
      if (m.interior.guide.visible) m.interior.chevrons.forEach((g, i) => { g.scale.setScalar(0.8 + 0.35 * Math.max(0, Math.sin(t * 4 - i * 0.7))); });
    }
    this.map?.update();
    this.warp.update(dt);
    // smoke rising from the wreck until it has power again
    if (this.startSmoke && this.powerState !== 'on') {
      if ((this.smokeT -= dt) <= 0) {
        this.smokeT = 0.3;
        const m = this.parked;
        const src = this.world(m, polar(R + 0.5, SCAR.a, SCAR.y + 1));
        const top = this.world(m, new THREE.Vector3(1.5, R - 0.6, 3));
        const at = Math.random() < 0.6 ? src : top;
        this.smoke.emit(at.add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)), new THREE.Vector3(0.8 + Math.random(), 3.2 + Math.random() * 1.5, 0.3), 0.6 + Math.random() * 0.6, 7 + Math.random() * 2, new THREE.Color(SMOKE[Math.floor(Math.random() * SMOKE.length)]));
      }
    }
    this.smoke.update(dt);
    this.dust.update(dt);
    this.flame.update(dt);
    if (!photo) this.applyCamera(dt);
  }
}

const _p = new THREE.Vector3(), _l = new THREE.Vector3(), _l2 = new THREE.Vector3(), _d = new THREE.Vector3();

function padSkip() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return false;
  for (const gp of navigator.getGamepads()) if (gp && (gp.buttons[padIndex('back')]?.pressed || gp.buttons[9]?.pressed)) return true;   // printed B, or Menu / Start
  return false;
}

export { SPACE_Y, LEG_A };

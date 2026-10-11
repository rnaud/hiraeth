import { CHARTED_SIDE } from '../levels/names.js';
import * as THREE from 'three';
import { game } from '../game-state.js';
import { buildShipModel, buildSpace, poseRamp, DETAIL_FAR } from './model.js';
import { R, DECK, LIFT, HATCH_A, HINGE_R, WINDOW, HATCH, LEGS, footOf, SCAR, ROOF, CENTRE_Z, undersideAt, WALL_IN, reachAt } from './hull.js';
import { polar } from './geo.js';
import { CONSOLE_R, TABLE_R, ROOMS, inRooms, cockpitHalf } from './interior.js';
import { findShipSite, siteAvoid, decorAvoid } from './sites.js';
import { buildCrashSite } from './crash.js';
import { buildApproach } from './approach.js';
import { HoloTable } from './holotable.js';
import { Puffs } from './fx.js';
import { Cinema, Warp } from './cinema.js';
import { StarMap, consoleAction } from './starmap.js';
import { pendingCall, completedWorlds, callLines, callContext, applyCall, recordingLabel } from '../story/calls.js';
import { Hologram } from './hologram.js';
import { homeOpen, HOME_ID, finaleOpen } from '../story/ending.js';
import { relaySignal, RELAY_TEXT } from '../story/relay.js';
import { MAP_LINE } from '../story/signature.js';
import { foundFlag, foundLine, SEARCH_LINE } from '../story/signature-search.js';
import { HomecomingDirector } from './homecoming.js';
import * as sfx from './sfx.js';
import { padIndex } from '../native-pad.js';
import { shakeScale } from '../feel.js';
import { Prologue } from './prologue.js';
import { ReboardGate } from './landing.js';
/** Walking into the ramp takes you aboard (issue #87): this near its foot (m), this fast up it (m/s). */
export const RAMP_IN = { near: 2.4, speed: 1.2 };
import { PrologueDirector, ArrivalDirector, TakeoffDirector, CallDirector, OBJECTIVE } from './cinematics.js';

// The traveller's ship: the angular family ship, home between worlds (src/ship/hull.js, docs/systems/ship.md).
//
//  - It stands at each world's arrival point (src/ship/sites.js). In the
//    desert, until it first flies again, it lies where it came down when the singing light drained it:
//    on its belly, dug into a dune at the end of a short skid.
//  - Walk up the ramp and in: the main room (galley, entry, the holo table), the cockpit,
//    the sleeping cabin, the hold. All of it collides (physics.addCollider).
//  - E at the cockpit console: the voicemail button (it blinks while a message waits): the
//    parents' message, as a hologram over the dash (src/story/calls.js, src/ship/hologram.js).
//  - E at the holo table in the middle of the deck: the galactic map (locked until
//    `ship.powered`). Choosing a world takes off and lands there (?level=<id>&via=ship).
//  - E at the foot of the ramp walks you aboard; E in the entry hall walks
//    you out. Anywhere else inside the ship, E does nothing (no whistling
//    the hoverbike into the cockpit).
//  - The prologue (src/ship/prologue.js) plays on a new game.
//
// Flags: prologue.done, ship.powered, ship.level, ship.launched, calls.<n>,
// objective. Events on `game`: ship:enter, ship:exit, travel { to }, call { n }; it sends
// tool:enable { on } to put the fluid tool away indoors and during its scenes.

const Y = new THREE.Vector3(0, 1, 0);
const SPACE_Y = 2600;
const DOOR_POP = 0.14;       // m the door comes out of its frame before it slides
const DOOR_TRAVEL = 1.5;     // m forward along the hull: clear of the opening
const ease = (t) => { t = Math.min(Math.max(t, 0), 1); return t * t * (3 - 2 * t); };
/** The door's motion for k 0 (shut) .. 1 (open): it pops out (0 .. 0.25), then slides up (0.2 .. 1), easing. */
export function doorPhases(k) { return { pop: ease(k / 0.25), slide: ease((k - 0.2) / 0.8) }; }
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
    this.reboard = new ReboardGate();   // (stepped out: the ramp doesn't offer to take you straight back in, src/ship/landing.js)
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

  /**
   * The ground itself at (x, z), under the parked ship as well: groundAt() from above finds the
   * ship's own hull there (its collider stays where it is parked, even while it flies).
   */
  floorAt(x, z) {
    const r = Math.hypot(x - this.restPos.x, z - this.restPos.z);
    if (r > R + 4) return this.groundAt(x, z);
    // from just under the hull's belly, its bells and its legs' pads (or a little above the ground round it)
    const l = _p.set(x - this.restPos.x, 0, z - this.restPos.z).applyQuaternion(_q.copy(this.restQuat).invert());
    const u = undersideAt(l.x, l.z);
    const from = this.restPos.y + (u !== null ? Math.min(u - 0.55, -1.85) : -LIFT + 0.6);
    const g = this.physics.groundAt(x, from, z, 60);
    return Number.isFinite(g) ? g : this.heightAt?.(x, z) ?? this.groundAt(x, z);
  }

  place() {
    const s = this.site, crash = this.crashed ? s.crash : null;
    const yaw = s.heading - HATCH_A;          // the hatch (local -x, heading HATCH_A) faces site.heading
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(crash?.pitch ?? 0, yaw, crash?.roll ?? 0, 'YXZ'));
    const base = new THREE.Vector3(s.x, 0, s.z);
    const toW = (v, cy) => v.clone().applyQuaternion(q).add(base).setY(v.clone().applyQuaternion(q).y + cy);
    let cy;
    if (crash) {
      cy = this.groundAt(s.x, s.z) + LIFT - crash.sink;   // sunk below its parked height over the spot itself
      // keep the deck and the hatch sill clear of the sand
      let need = -Infinity;
      for (let z = ROOMS.cockpit.z0; z <= ROOMS.hold.z1 + 1e-6; z += 1.2) for (const f of [-1, -0.5, 0, 0.5, 1]) {
        const w = toW(new THREE.Vector3(f * (z < ROOMS.main.z0 ? cockpitHalf(z) : WALL_IN), DECK - 0.35, z), cy);
        need = Math.max(need, this.groundAt(w.x, w.z, w.y + 40) + 0.05 - w.y);
      }
      const h = toW(polar(HINGE_R, HATCH_A, DECK), cy);
      need = Math.max(need, this.groundAt(h.x, h.z, h.y + 40) + 0.3 - h.y);
      if (need > 0) cy += need;
    } else {
      // on its legs, the belly clear of the ground everywhere under it
      cy = s.ground + LIFT;
      for (let z = -9.5; z <= 12; z += 1.5) for (const x of [-2.6, -1.4, 0, 1.4, 2.6]) {
        const u = undersideAt(x, z);
        if (u === null) continue;
        const p = new THREE.Vector3(x, 0, z).applyQuaternion(q).add(base);
        // (the terrain itself where the level has one: a prop under the hull, a bush or a bone, never lifts it on stilts)
        const g = Math.min(this.heightAt?.(p.x, p.z) ?? this.groundAt(p.x, p.z), s.ground + 2.6);
        cy = Math.max(cy, g - u + 0.45);
      }
    }
    this.restPos = new THREE.Vector3(s.x, cy, s.z);
    this.restQuat = q;
    this.yaw = yaw;
    const m = new THREE.Matrix4().compose(this.restPos, q, new THREE.Vector3(1, 1, 1));
    const W = (v) => v.clone().applyMatrix4(m);
    // the feet find the ground; the ramp reaches it at a walkable slope
    const footY = (leg) => {
      const fo = footOf(leg), f = W(new THREE.Vector3(fo.x, -LIFT, fo.z));
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
    this.addHoloTable(model);
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
      const C = W(new THREE.Vector3(0, 0, CENTRE_Z));   // the middle of the hull's plan, at deck height
      const az = (p) => Math.atan2(p.x - C.x, p.z - C.z);
      const protect = [];
      for (let k = 0; k <= 6; k++) {
        const p = W(new THREE.Vector3(0, WINDOW.y0, WINDOW.z0 - 0.4 + k * 0.1));
        protect.push({ a: az(p), y: p.y - 0.9, w: 0.1 });
      }
      for (let k = 0; k <= 4; k++) {
        const p = W(new THREE.Vector3(-HINGE_R, HATCH.y0, HATCH.z0 - 0.3 + ((HATCH.z1 - HATCH.z0 + 0.6) * k) / 4));
        protect.push({ a: az(p), y: p.y - 0.8, w: 0.14 });
      }
      protect.push({ a: s.heading, y: this.groundAt(foot.x, foot.z) - 0.6, w: 0.42 });
      const reach = (a, dy) => reachAt(a - yaw, dy);   // (a world heading into the ship's frame)
      this.crashSite = buildCrashSite({ heightAt: this.heightAt, centre: C, reach, travel: s.crash.travel, length: s.crash.length, sandMat: this.level.ground.mesh?.material, protect });
      this.scene.add(this.crashSite.group);
    }
    this.colliders = [this.physics.addCollider(model.group)];
    if (this.crashSite) this.colliders.push(this.physics.addCollider(this.crashSite.group));
    // smoke, dust and flame
    this.smoke = new Puffs(this.scene, { count: 150, glow: 0.35, tag: 'ship-smoke', noShadow: this.noShadow });
    this.flame = new Puffs(this.scene, { count: 120, glow: 1, tag: 'ship-flame', noShadow: this.noShadow });
    this.dust = new Puffs(this.scene, { count: 220, glow: 0.55, tag: 'ship-dust', noShadow: this.noShadow });
    // the lift jets' flame (src/ship/exhaust.js): no drag, so each tongue keeps the ship's speed and leaves the bell downward
    this.jets = new Puffs(this.scene, { count: 160, glow: 1, tag: 'ship-jets', noShadow: this.noShadow });
    this.jets.drag = 0;
    this.dust.drag = 1.4;
    this.smoke.lift = 0.5;
    this.smokeT = 0;
    this.setPower(this.powerState, model);
  }

  /** The holo table's planet: the world the ship is at (in the prologue, the one below it). */
  addHoloTable(model) {
    model.holoTable = new HoloTable(model, this.levelId);
    model.indoor.push(model.holoTable.object);
    this.noShadow.push(model.holoTable.object);
  }

  /** The prologue's ship, in orbit high above the map, wrapped in a dome of stars. */
  buildSpaceCopy() {
    const model = buildShipModel({ space: true, legs: 'up', ramp: null });
    const pos = new THREE.Vector3(this.site.x, SPACE_Y, this.site.z);
    model.group.position.copy(pos);
    this.scene.add(model.group);
    this.addHoloTable(model);
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
    for (const v of [...s.model.lightVecs, s.model.vmailLight]) { const i = this.lights.indexOf(v); if (i >= 0) this.lights.splice(i, 1); }
    const h = this.noShadow.indexOf(s.model.holoTable?.object);
    if (h >= 0) this.noShadow.splice(h, 1);
    const k = this.noShadow.indexOf(s.space);
    if (k >= 0) this.noShadow.splice(k, 1);
    this.spaceCopy = null;
  }

  /** Space round the parked ship for an arrival's approach, high over the site, with the destination planet (src/ship/approach.js). */
  buildApproach() {
    if (this.approach) return this.approach;
    const a = buildApproach(this.levelId);
    a.centre = new THREE.Vector3(this.site.x, SPACE_Y, this.site.z);
    a.group.position.copy(a.centre);
    this.scene.add(a.group);
    this.noShadow.push(a.group);
    this.approach = a;
    return a;
  }

  removeApproach() {
    const a = this.approach;
    if (!a) return;
    a.group.removeFromParent();
    const k = this.noShadow.indexOf(a.group);
    if (k >= 0) this.noShadow.splice(k, 1);
    this.approach = null;
  }

  /** The ground's own colours, lightened a little: for the dust the engines raise. */
  dustColors() {
    if (this._dust) return this._dust;
    const U = this.level.ground?.mesh?.material?.uniforms;
    const base = U?.uColor ? [U.uColor.value, U.uColor2?.value ?? U.uColor.value, U.uColor3?.value ?? U.uColor.value] : null;
    const white = new THREE.Color('#fff6e4');
    this._dust = base ? [...base, base[0]].map((c, i) => '#' + c.clone().lerp(white, 0.3 + 0.08 * i).getHexString()) : ['#e3c58f', '#d8b884', '#efd29b', '#cfa877'];
    return this._dust;
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
    model.holoTable?.power(state);
    if (model.lightVecs) this.syncLights(model, !model.lightsOff);
    model.callScreen?.set({ who: state === 'on' ? 'idle' : state === 'emergency' ? 'locked' : 'off', power: state === 'dead' ? 0 : 1 });
    if (model === this.parked) this.powerState = state;
  }

  /**
   * k = 0 shut .. 1 open. The door first unseals, popping a hand's width out of its frame, then slides forward
   * along the outside of the hull on its track, clear of the doorway (it never passes through the hull).
   */
  setDoor(model, k) {
    const { pop, slide } = doorPhases(k);
    model.door.rotation.set(0, 0, 0);
    model.door.position.set(Math.sin(HATCH_A) * DOOR_POP * pop, 0, -DOOR_TRAVEL * slide);
    model.doorK = k;
  }

  /** k = 0 stowed .. 1 lowered to the ground: it slides out, tips down, telescopes out (src/ship/model.js poseRamp). */
  setRamp(model, k) {
    if (!model.ramp) return;
    poseRamp(model.ramp, k);
    model.rampK = k;
  }

  // ------------------------------------------------------------------ wiring
  /** The rest of the game, once it exists. */
  attach(deps) {
    Object.assign(this, deps);   // player, rig, camera, sound, journal, post, story, wind, levels, order, titles, levelTitle, lib, humans, departure (to) => href | null
    // the recordings' hologram: the game's own people, drawn in light (needs the bodies and the mocap library)
    if (deps.lib && deps.humans && !this.holo) this.holo = new Hologram({ lib: deps.lib, humans: deps.humans });
    this.map = new StarMap({
      order: deps.order, levels: deps.levels, journal: deps.journal, current: this.levelId,
      flag: (k) => game.flag(k), powered: () => !!game.flag('ship.powered'),
      home: () => homeOpen({ flag: (k) => game.flag(k), completed: this.completed() }) || this.levelId === HOME_ID,   // src/story/ending.js
      relay: () => this.relay(),
      finale: () => finaleOpen({ flag: (k) => game.flag(k), completed: this.completed() }),   // the Lantern, past the market (src/story/ending.js)
      side: deps.side ?? CHARTED_SIDE,   // (the finished worlds off the route, never the ones still being made: src/levels/names.js WIP)
      onTravel: (id) => this.travel(id),
      sound: () => this.sound,
      // the signature search charted a world (src/story/signature-search.js)
      onFound: (id, title) => { game.set(foundFlag(id), true); this.cinema?.say(foundLine(title), { secs: 3.6 }); },
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
      this.cinematic = new HomecomingDirector(this, { kind: typeof homecoming === 'string' ? homecoming : undefined });
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
    // (no smoke: the singing light drained it and it came down on its belly; nothing on it burns)
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

  isInside(model, p) { return inRooms(this.local(model, p)); }

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

  /** Beside the holo table in the middle of the deck (it opens the galactic map). */
  atTable() {
    const m = this.modelOf(this.player.pos);
    if (!m) return false;
    const l = this.local(m, this.player.pos), c = m.interior.points.table;
    return Math.hypot(l.x - c.x, l.z - c.z) < TABLE_R;
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
    if (c && !c.done) {
      // nothing to use while a scene plays, unless it hands you the controls and asks for E
      // (the prologue's walk: the voicemail button on the console)
      if (ctl.KeyE && !this._eHeld && c.interactive?.()) c.use?.();
      this._eHeld = !!ctl.KeyE;
      return { ...ctl, KeyE: false };
    }
    // E belongs to the ship inside it; at the ramp you walk in (its "go aboard" button was one press for what your
    // feet already meant, issue #87: E at the ramp's foot is yours, to talk or pick up)
    if (this.inside && ctl.KeyE) {
      if (!this._eHeld) this.use();
      this._eHeld = true;
      return { ...ctl, KeyE: false };
    }
    this._eHeld = !!ctl.KeyE;
    if (!this.inside && this.walksIntoRamp()) { this.walkAboard(); return { ...ctl, KeyW: false, stick: null }; }
    return ctl;
  }

  /**
   * Walking into the ramp (issue #87): on foot at its foot (RAMP_IN.near m), heading up it at a walk or more (RAMP_IN.speed
   * m/s along the way in), and not just stepped out (the reboard gate: walked RAMP_IN's 7 m away once since).
   */
  walksIntoRamp() {
    const P = this.player;
    if (!P || P.ride || !this.reboard.open || this.auto || (this.cinematic && !this.cinematic.done)) return false;
    const dx = P.pos.x - this.rampFoot.x, dz = P.pos.z - this.rampFoot.z;
    if (Math.hypot(dx, dz) > RAMP_IN.near || Math.abs(P.pos.y - this.rampFoot.y) > 3) return false;
    const ix = this.hinge.x - this.rampFoot.x, iz = this.hinge.z - this.rampFoot.z, il = Math.hypot(ix, iz) || 1;
    return ((P.vel?.x ?? 0) * ix + (P.vel?.z ?? 0) * iz) / il > RAMP_IN.speed;
  }

  /** Up the ramp and in, the ship walking you (the ramp has no floor of its own to climb: its collider is the stowed one). */
  walkAboard() {
    sfx.hatch(this.sound);
    this.autopilot([this.rampFoot.clone().lerp(this.hinge, 0.3), this.hinge.clone(), this.world(this.parked, this.parked.interior.points.hatchIn), this.world(this.parked, this.parked.interior.points.aboard)]);
  }

  /** E aboard: the voicemail button, the holo table (the map), the hatch. */
  use() {
    if (this.atConsole()) return this.useConsole();
    if (this.atTable()) return this.useTable();
    if (this.atHatchInside()) {
      sfx.hatch(this.sound);
      return this.autopilot([this.world(this.parked, this.parked.interior.points.hatchIn), this.hinge.clone(), this.rampFoot.clone()]);
    }
  }

  completed() {
    return completedWorlds(this.order ?? [], { flag: (k) => game.flag(k), storyDone: (id) => this.journal?.storyDone(id) });
  }

  /** The relay signal (src/story/relay.js): the broadcast heard from far off, or the mother's recording held. */
  relay() { return relaySignal({ flag: (k) => game.flag(k), completed: this.completed() }); }

  /** The message waiting on the voicemail, or null. */
  waitingCall() { return pendingCall({ flag: (k) => game.flag(k), completed: this.completed().length }); }

  /** The voicemail button: the waiting message plays; with none, the ship says so. */
  useConsole() {
    const n = this.waitingCall();
    if (consoleAction({ at: 'dash', pendingCall: n }) === 'call') {
      const done = this.completed();
      const ctx = callContext(game, { titles: this.titles, completed: done, lastWorld: done.slice(-1)[0] });
      const lines = callLines(n, ctx);
      this.cinematic = new CallDirector(this, { n, lines, label: recordingLabel(n, ctx),
        onDone: () => { applyCall(game, lines); game.set(`calls.${n}`, true); game.emit('call', { n }); } });
      this.cinematic.start();
      return;
    }
    sfx.beep(this.sound);
    const sig = this.relay();
    this.cinema.say(sig ? { who: 'ship', text: RELAY_TEXT.console[sig.stage], tone: 'neutral' } : NO_MESSAGES, { secs: sig ? 5.2 : 2.4 });
  }

  /** The holo table: the galactic map (shown but locked without power). */
  useTable() {
    if (consoleAction({ at: 'table', powered: !!game.flag('ship.powered') }) === 'locked') {
      sfx.beep(this.sound);
      this.parked.callScreen?.set({ who: 'locked' });
      this.cinema.say({ who: 'ship', text: 'No power. The engines are cold and the map is dark. Find a new source of power.' }, { secs: 4.2 });
      this.map.toggle(true);   // shown, but locked
      return;
    }
    sfx.beep(this.sound, true);
    this.parked.callScreen?.set({ who: 'map' });
    this.map.toggle(true);
    // the first time with power: why these worlds (src/story/signature.js)
    const first = !game.flag('signature.told');
    if (first) { game.set('signature.told', true); this.cinema.say(MAP_LINE, { secs: 7 }); }
    // the first time there is a world to find: how the search works (src/story/signature-search.js)
    if (this.map.targets?.length && !game.flag('signature.search.told')) { game.set('signature.search.told', true); this.cinema.say(SEARCH_LINE, { secs: 7, queue: first }); }
  }

  travel(to) {
    if (!game.flag('ship.powered')) return;
    game.emit('travel', { to });
    game.set('ship.level', to);
    this.cinematic = new TakeoffDirector(this, {
      to, title: this.levels.find((l) => l.id === to)?.title ?? to,
      // (the first flight to a world never visited goes by way of the chime-pirates: main.js departure, src/ambush.js)
      onDone: () => { game.set('ship.launched', true); location.search = this.departure?.(to) ?? `?level=${to}&via=ship`; },
    });
    this.cinematic.start();
  }

  hud() {
    if (this.playing && !this.cinematic.interactive?.()) return null;
    if (this.auto) return null;
    if (this.playing) return this.cinematic.prompt?.() ?? null;   // (a scene you walk through says what E does in it)
    if (this.inside) {
      if (this.atConsole()) return 'E voicemail';
      if (this.atTable()) return game.flag('ship.powered') ? 'E galactic map' : 'E galactic map (no power)';
      if (this.atHatchInside()) return 'E step outside';
      return 'aboard the ship';
    }
    return null;   // (the ramp: walk up it, no "go aboard": issue #87)
  }

  /** The ship whose voicemail button blinks: the prologue's, until its message plays; else the parked one while a message waits. */
  messageWaiting() {
    const c = this.cinematic;
    if (c && !c.done) { this._waitT = 0; return c.waiting?.() ?? null; }   // (not while a message plays; asked again after)
    if (!this._waitT || performance.now() - this._waitT > 500) { this._waitT = performance.now(); this._wait = this.order ? this.waitingCall() : null; this._relaySig = this.order ? this.relay() : null; }
    return this._wait ? this.parked : null;
  }

  /**
   * The voicemail button: while a message waits it pulses (voicemailBlink), lighting the dash
   * round it; else it glows dimly (dark without power).
   */
  blinkVoicemail(m, on, t) {
    const U = m.mats.vmail?.uniforms;
    if (!U) return;
    const k = on ? voicemailBlink(t) : 0;
    m.callScreen?.set({ waiting: on, pulse: k });   // (the screen above says so, glowing with it)
    const off = this.powerOf(m) === 'dead' ? 0 : 0.3;
    U.uGlow.value = on ? 0.6 + 0.4 * k : off;
    U.uColor.value.set(on ? '#ff7a4a' : '#b8644a').lerp(_warm, 0.75 * k);
    // the pool of light round it on the console: the console's own blue, warming as it pulses
    const H = m.mats.vmailHalo?.uniforms;
    if (H) { H.uColor.value.set('#34405e').lerp(_glowC, 0.85 * k); H.uGlow.value = 0.95 * k; }
    if (!m.vmailLight) {
      m.vmailLight = new THREE.Vector4();
      this.lights.push(m.vmailLight);
    }
    m.group.updateMatrixWorld();
    const p = _p.copy(m.interior.points.voicemail).applyMatrix4(m.group.matrixWorld);
    m.vmailLight.set(p.x, p.y + 0.3, p.z, on ? 1.2 + 2.8 * k : 0);
  }

  // ------------------------------------------------------------------ camera
  /** A cinematic camera for this frame: { pos, look, fov?, roll? } (world). */
  shot(s) { this.cam = s; }
  release(blend = 0.9) {
    if (this.cam) this.blend = { from: this.cam, t: 0, dur: blend };
    this.cam = null;
  }
  shake(k) { this.shakeK = Math.max(this.shakeK, k * shakeScale()); }   // (the motion settings: src/feel.js)

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
      // the mother's recording, held after the broadcast ("Not here. Not yet."): it waits once he has stepped out (src/story/relay.js)
      if (!inside && game.flag('calls.ilen.asked') && !game.flag('calls.ilen.told')) game.set('calls.ilen.later', true);
      else if (!inside && game.flag('calls.ilen.told') && !game.flag('calls.beat.ilen.after')) game.set('calls.ilen.after.later', true);
      // a close, over-the-shoulder camera in the rooms (the rig's tight-space mode,
      // src/player.js CameraRig: it eases in and back out by itself), and no climbing
      // the curved walls of home
      this.rig.indoor = inside;
      if (inside) { this._climb = P.opts.climb; P.opts.climb = false; }
      else if (this._climb !== undefined) { P.opts.climb = this._climb; this._climb = undefined; }
    }
    // the ramp's "go aboard": quiet after stepping out, until you have walked away from it once
    this.reboard.update({ aboard: inside || this.playing || !!this.auto, fromRamp: Math.hypot(P.pos.x - this.rampFoot.x, P.pos.z - this.rampFoot.z) });
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
    // the screen, the mobile, the voicemail button
    const waiting = this.messageWaiting();
    for (const m of [this.parked, this.spaceCopy?.model]) {
      if (!m) continue;
      m.callScreen?.update(dt);
      const mob = m.group.userData.mobile;
      if (mob) mob.rotation.y += dt * 0.15;
      this.blinkVoicemail(m, waiting === m, t);
      m.callScreen?.set({ signal: m === this.parked && this._relaySig ? RELAY_TEXT.screen[this._relaySig.stage] : '' });   // (its standby says so)
    }
    // the map put away: the screen over the dash goes back to standby
    if (this.parked.callScreen?.state.who === 'map' && !this.map?.open && !this.playing) this.parked.callScreen.set({ who: 'idle' });
    this.holo?.update(dt);
    this.map?.update();
    this.warp.update(dt);
    // smoke rising from the wreck until it has power again
    if (this.startSmoke && this.powerState !== 'on') {
      if ((this.smokeT -= dt) <= 0) {
        this.smokeT = 0.3;
        const m = this.parked;
        const src = this.world(m, new THREE.Vector3(SCAR.x - 0.4, SCAR.y + 1, SCAR.z));
        const top = this.world(m, new THREE.Vector3(1.0, ROOF + 0.3, 2.5));
        const at = Math.random() < 0.6 ? src : top;
        this.smoke.emit(at.add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)), new THREE.Vector3(0.8 + Math.random(), 3.2 + Math.random() * 1.5, 0.3), 0.6 + Math.random() * 0.6, 7 + Math.random() * 2, new THREE.Color(SMOKE[Math.floor(Math.random() * SMOKE.length)]));
      }
    }
    this.smoke.update(dt);
    this.dust.update(dt);
    this.flame.update(dt);
    this.jets.update(dt);
    if (!photo) this.applyCamera(dt);
    // rooms are only drawn when the camera is near enough to see in (measured once the camera is placed: a scene's
    // shot inside the ship while you stand far off, as the review page stages the takeoff, drew no walls)
    for (const m of [this.parked, this.spaceCopy?.model]) {
      if (!m) continue;
      const d = this.camera.position.distanceTo(this.world(m, _c.set(0, 1, CENTRE_Z))), near = d < 48;
      if (near !== m.indoorShown) {
        m.indoorShown = near;
        for (const o of m.indoor) o.visible = near;
      }
      // and far off, the outside's small things too (seams, the scorch, the lights: src/ship/model.js DETAIL_FAR)
      const detail = d < DETAIL_FAR;
      if (detail !== m.detailShown) { m.detailShown = detail; for (const o of m.details ?? []) o.visible = detail; }
    }
    // (after the camera is placed: the holo table's planet turns its lit face to it, a cinematic's shot too)
    for (const m of [this.parked, this.spaceCopy?.model]) if (m?.indoorShown) m.holoTable?.update(dt, this.camera);
  }
}

const _p = new THREE.Vector3(), _l = new THREE.Vector3(), _l2 = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion();
const _warm = new THREE.Color('#fff1c4'), _glowC = new THREE.Color('#ff9a66');
/** The ship's answer to the voicemail button when nothing waits. */
export const NO_MESSAGES = { who: 'ship', text: 'No new messages.', tone: 'neutral' };
/** The voicemail button's pulse (0..1) at time t: a slow breath, bright for a moment every 1.6 s. */
export function voicemailBlink(t) { const u = (t % 1.6) / 1.6; return u < 0.5 ? Math.sin(u * Math.PI * 2) ** 2 : 0; }

function padSkip() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return false;
  for (const gp of navigator.getGamepads()) if (gp && gp.buttons[padIndex('back')]?.pressed) return true;   // printed B (Menu / Start pauses the scene instead)
  return false;
}

export { SPACE_Y, LEGS };

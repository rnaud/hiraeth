// Water for the Keeper (issue #339, a prototype: ?level=desert&guardianHelp=keeper; docs/design/helper-guardians.md).
//
// The Rose House's cistern, dry, and its Keeper pacing the empty basin: thirsty, afraid of the dark (LORE.md, "The Keeper
// of the cistern"). The fluid gun lends a fifth mode for it, the water cannon (fluid-kit.js MODES.cannon, FluidTool.
// pourStream): aim and hold the trigger and it pours one strong arc of water, the magic bar draining as it goes. Fill
// the Givers' vessels round the cistern (VESSELS): a jar on its floor, a jar on a corbel high on the north wall (an arc
// over the rim), and the trough over the old water wheel on the south-east wall. Each is cracked: let the stream off it
// and it leaks back down (LEAK). Full, a jar spills down a runnel into the basin and the Keeper comes to drink, and calms
// a little; the trough turns the wheel, and the house's power comes back: the four bronze braziers catch, the lamps on
// the walls glow and the far door sinks open. The three done, the Keeper helps: it goes to the Givers' great tank under
// the dry muzzle on the east wall and heaves its stone lid off (it remembers where the water was kept). Fill the tank
// (no crack in it, but more than one bar of water) and the muzzle pours again, the basin fills, the Keeper drinks deep
// and lies down by the spout: the shipped hand on its brow (boss.js final 'touch') resolves the Rose House.
// The gentle failures: a jar left leaks; a blast in the Keeper's face startles it, it rears and stamps, and a jar beside
// it spills (FRIGHT). Nothing is lost for good.

import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { RIM } from '../temples/desert.js';
import { lathe } from '../temples/kit.js';
import { poseGuardian } from './pose.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

/**
 * The vessels, over the cistern's floor (x east, z north off its middle, y up; the way in is south): at (the foot),
 * mouth (its mouth's middle over the foot), r (how near the stream passes its mouth to pour in, m), fill (s of stream
 * to fill it), leaks (a crack: it drains when the stream is off it), kind (jar, trough, tank), runnel (the way its water
 * runs to the basin, floor points), basin (how much of the basin it fills), lid (shut until the Keeper lifts it).
 */
export const VESSELS = [
  { id: 'jar', name: 'the floor jar', kind: 'jar', at: [-11.9, 0, 1.6], mouth: 1.75, r: 0.95, fill: 2.8, leaks: true,
    runnel: [[-11.1, 1.5], [-6.6, 0.9]], basin: 0.12 },
  { id: 'high', name: 'the high jar', kind: 'jar', at: [-5.6, 5.6, 16.0], mouth: 1.75, r: 1.0, fill: 3.2, leaks: true, corbel: true,
    runnel: [[-5.3, 15.2], [-3.4, 9.4], [-2.4, 6.2]], fall: true, basin: 0.12 },
  { id: 'wheel', name: 'the wheel’s trough', kind: 'trough', at: [13.6, 4.2, -9.1], mouth: 0.55, r: 1.25, fill: 3.6, leaks: true,
    runnel: [[13.1, -8.6], [5.7, -3.6]], fall: true, basin: 0.12, power: true },
  { id: 'tank', name: 'the Givers’ tank', kind: 'tank', at: [16.0, 0, 0], mouth: 2.5, r: 1.7, fill: 8.5, leaks: false, lid: true, basin: 1 },
];
/** A crack: how long (s) a vessel holds after the stream is off it, then how fast (a share a second) it drains. */
export const LEAK = { hold: 1.2, rate: 0.16 };
/**
 * The Keeper: how long its stream in its face startles it (s, summed), how long it rears (s), how near a vessel must be to
 * spill as it stamps (m), how long before it can be startled again (s); calm: what each jar's drink is worth, the
 * flow's; drink (s at the basin), lift (s to heave the tank's lid), pace (m/s), its body's sphere for the stream (r, m).
 */
export const FRIGHT = { soak: 0.3, rear: 1.6, spill: 9, again: 2.5 };
export const KEEPER_HELP = { calm: [0.2, 0.2, 0.2], flow: 0.9, drink: 3.2, deep: 4.5, lift: 3.2, pace: 1.8, body: 2.6 };

/**
 * The earliest place a traced arc (points, a segment each `step` s) passes within reach of one of `spheres`
 * ([{ c: Vector3, r }]): { i (its segment), point, t (s along the arc), sphere } or null. Pure.
 */
export function arcCatch(points, spheres, step) {
  const ab = V(), ap = V(), q = V();
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    ab.subVectors(b, a);
    const L2 = ab.lengthSq();
    let best = null;
    for (const s of spheres) {
      if (!s) continue;
      const u = L2 > 1e-9 ? clamp(ap.subVectors(s.c, a).dot(ab) / L2, 0, 1) : 0;
      q.copy(a).addScaledVector(ab, u);
      if (q.distanceTo(s.c) < s.r && (!best || u < best.u)) best = { u, s, point: q.clone() };
    }
    if (best) return { i, point: best.point, t: (i + best.u) * step, sphere: best.s };
  }
  return null;
}

export class KeeperFlow {
  /** rt: the Rose House's runtime (its guardian, the Keeper; its arena, the cistern); o: { tool (the FluidTool to lend the cannon), hud }. */
  constructor(rt, { tool = null, hud = null } = {}) {
    this.rt = rt; this.G = rt.guardian; this.hud = hud; this.tool = tool;
    const A = this.G.arena;
    this.c = A.center.clone(); this.floor = A.y;
    this.vessels = VESSELS.map((d) => ({ ...d, level: 0, idle: 9, full: false, open: !d.lid, run: 0, poured: 0 }));
    this.phase = 'thirsty'; this.t = 0; this.time = 0;
    this.keeper = { mode: 'pace', t: 0, to: null, soak: 0, calm: 0, startled: -9, wander: 0 };
    this.basin = 0; this.power = 0; this.flow = 0;
    this.queue = [];   // (the drinks it goes to: one for each runnel that reached the basin)
    this.spills = 0; this.startles = 0;
    this.view3 = new KeeperView(rt, this);
    // collision for the vessels (their stone, in the traveller's way: rt.solids)
    for (const v of this.vessels) if (v.kind !== 'trough') {
      const p = this.at(...v.at), r = v.kind === 'tank' ? 2.0 : 0.95;
      rt.pieces.push({ solid: { pos: p, r, bottom: p.y, top: p.y + (v.kind === 'tank' ? 2.5 : 1.8), vel: V() }, update() {} });
    }
    this.lend(tool);
    rt.notice('The cistern is dry, and the Keeper paces it, thirsty. Your gun pours water now: aim, hold the trigger.', 'help.keeper.start');
  }

  /** Lend the gun the water cannon (MODES.cannon) and take it in hand; the stream poured into this cistern's vessels. */
  lend(tool) {
    if (!tool) return;
    this.tool = tool;
    (tool.lent ??= new Set()).add('cannon');
    tool.setMode?.('cannon');
    tool.streamCatch = (points, step) => this.catchStream(points, step);
  }

  enter(P) {
    const at = this.c.clone().add(V(-4, 0.2, -11));
    P.teleport(at, V(0, 1, 0), V(0, 0, 1));
    P.heading = Math.atan2(this.c.x - at.x, this.c.z - at.z) - 0.6;
    P.vel?.set?.(0, 0, 0);
  }

  get done() { return this.phase === 'done'; }
  at(x, y, z, out = V()) { return out.set(this.c.x + x, this.floor + y, this.c.z + z); }
  vessel(id) { return this.vessels.find((v) => v.id === id); }
  /** Where a vessel's mouth is (world). */
  mouthOf(v, out = V()) { return this.at(v.at[0], v.at[1] + v.mouth, v.at[2], out); }
  /** The Keeper's body, as the stream meets it. */
  bodyOf(out = V()) { return out.copy(this.G.model.pos).add(V(0, 2.2, 0)); }

  /** The cannon's arc, traced (FluidTool.streamCatch): the first open vessel's mouth or the Keeper's body on it takes it. */
  catchStream(points, step) {
    const spheres = this.vessels.filter((v) => v.open && !v.full).map((v) => ({ c: this.mouthOf(v), r: v.r, v }));
    if (this.phase !== 'done' && this.phase !== 'calm') spheres.push({ c: this.bodyOf(), r: KEEPER_HELP.body, keeper: true });
    const hit = arcCatch(points, spheres, step);
    this.poured = hit ? (hit.sphere.keeper ? 'keeper' : hit.sphere.v) : null;
    return hit;
  }

  update(dt, t) {
    this.t += dt; this.time += dt;
    const streaming = !!this.tool?.streaming;
    const into = streaming ? this.poured : null;
    // the vessels: filling while the stream is in them; a crack drains the rest back down
    for (const v of this.vessels) {
      if (v.full) { v.run = Math.min(1, v.run + dt / 1.6); continue; }
      if (into === v) { v.level = Math.min(1, v.level + dt / v.fill); v.idle = 0; v.poured += dt; }
      else { v.idle += dt; if (v.leaks && v.idle > LEAK.hold) v.level = Math.max(0, v.level - LEAK.rate * dt); }
      if (v.level >= 1) this.filled(v);
    }
    if (into === 'keeper') this.soak(dt); else this.keeper.soak = Math.max(0, this.keeper.soak - dt);
    if (!streaming) this.poured = null;
    // the house's power, the basin, the flow out of the muzzle
    if (this.vessel('wheel').full) this.power = Math.min(1, this.power + dt / 2.5);
    const want = this.vessels.reduce((s, v) => s + (v.full ? v.basin * smooth(v.run) : 0), 0);
    this.basin += (Math.min(1, want) - this.basin) * (1 - Math.exp(-0.6 * dt));
    if (this.vessel('tank').full) this.flow = Math.min(1, this.flow + dt / 2);
    this.moveKeeper(dt, t);
    this.view3.update(dt, t);
    this.showHud();
  }

  filled(v) {
    v.full = true; v.level = 1; v.run = 0;
    this.rt.sound?.chime?.();
    if (v.power) {
      this.rt.notice('The trough tips; the old wheel turns. The braziers catch, the lamps wake, and the far door sinks open.', 'help.keeper.power');
      for (const id of RIM) this.rt.piece(id)?.ignite?.(false);
      this.rt.logic.force('d5', true); this.rt.applyDoors();
    } else if (v.kind === 'tank') {
      this.rt.notice('The tank is full. Above it the Givers’ muzzle coughs, and pours.', 'help.keeper.flow');
      this.phase = 'flowing';
    } else this.rt.notice(`${v.name[0].toUpperCase()}${v.name.slice(1)} brims, tips, and the water runs down into the basin.`, `help.keeper.full.${v.id}`);
    if (v.kind !== 'tank') this.queue.push(v);
  }
  /** The stream in its face: summed over FRIGHT.soak s, it rears and stamps, and a vessel near it spills. */
  soak(dt) {
    const K = this.keeper;
    if (this.time - K.startled < FRIGHT.again || K.mode === 'lift') return;
    if ((K.soak += dt) < FRIGHT.soak) return;
    K.soak = 0; K.startled = this.time; this.startles++;
    K.mode = 'rear'; K.t = 0;
    const p = this.G.model.pos;
    let spilt = 0;
    for (const v of this.vessels) if (!v.full && v.level > 0.05 && this.at(...v.at).distanceTo(p) < FRIGHT.spill) { v.level = 0; spilt++; }
    this.spills += spilt;
    this.rt.rumble?.(0.6, 0.4);
    this.rt.sound?.critter?.('creak', 1.4);
    this.rt.notice(spilt ? 'The blast in its face frightens it: it rears and stamps, and the jar by it spills. Water the jars, not the Keeper.' : 'The blast in its face frightens it: it rears and stamps. Water the jars, not the Keeper.', 'help.keeper.startle');
  }

  /** What the Keeper does: paces the dry basin, drinks where a runnel comes in, rears when blasted, lifts the tank's lid, drinks deep. */
  moveKeeper(dt, t) {
    const G = this.G, m = G.model, K = this.keeper, KH = KEEPER_HELP;
    K.t += dt;
    let pose = 'fight', speed = 0;
    const lid = this.vessel('tank');
    if (K.mode === 'rear') { pose = 'wake'; if (K.t > FRIGHT.rear) { K.mode = 'pace'; K.t = 0; } }
    else if (K.mode === 'pace') {
      // (round the basin's rim, slowly, now and then turning to look at you)
      if (this.queue.length) { K.mode = 'toDrink'; K.v = this.queue.shift(); K.t = 0; }
      else if (this.queue.length === 0 && this.vessels.filter((v) => v.kind !== 'tank' && v.full).length === 3 && !lid.open) { K.mode = 'toLid'; K.t = 0; }
      else if (this.phase === 'flowing') { K.mode = 'toDeep'; K.t = 0; }
      else {
        K.wander -= dt;
        if (!K.to || K.wander <= 0 || Math.hypot(K.to.x - m.pos.x, K.to.z - m.pos.z) < 1) {
          const a = (Math.floor(this.time / 6) * 2.4) % (Math.PI * 2);
          K.to = this.at(Math.sin(a) * 9.5, 0, Math.cos(a) * 9.5); K.wander = 6;
        }
        speed = G.walk(dt, K.to, KH.pace * 0.6, 0.5);
      }
    } else if (K.mode === 'toDrink' || K.mode === 'toDeep') {
      const end = K.mode === 'toDeep' ? [8, 0] : K.v.runnel[K.v.runnel.length - 1], a = Math.atan2(end[0], end[1]);
      const spot = this.at(Math.sin(a) * 8.4, 0, Math.cos(a) * 8.4);
      speed = G.walk(dt, spot, KH.pace, 0.3);
      if (speed < 0.1 || K.t > 9) { K.mode = K.mode === 'toDeep' ? 'deep' : 'drink'; K.t = 0; }
    } else if (K.mode === 'drink' || K.mode === 'deep') {
      // (head down in the basin's water, mouth open: drinking)
      G.face(dt, this.c, 2);
      pose = 'open';
      if (K.mode === 'drink' && K.t > KH.drink) {
        K.calm = Math.min(0.75, K.calm + KH.calm[Math.min(2, Math.round(K.calm / 0.2))]);
        K.mode = 'pace'; K.t = 0;
        this.rt.notice(this.power > 0 ? 'It drinks, and in the light it stops trembling.' : 'It drinks, and looks at you, and trembles a little less.', `help.keeper.drink.${Math.round(K.calm * 10)}`);
      }
      if (K.mode === 'deep' && K.t > KH.deep) this.calmed();
    } else if (K.mode === 'toLid') {
      const spot = this.at(lid.at[0] - 4.6, 0, lid.at[2]);
      speed = G.walk(dt, spot, KH.pace, 0.3);
      if (speed < 0.1 || K.t > 10) { K.mode = 'lift'; K.t = 0; this.rt.notice('It goes to the great tank under the dry muzzle, and sets its head to the lid.', 'help.keeper.lid'); }
    } else if (K.mode === 'lift') {
      G.face(dt, this.at(lid.at[0], 0, lid.at[2]), 2.5);
      pose = 'wake';
      this.lidK = smooth(K.t / KH.lift);
      if (K.t > KH.lift) { lid.open = true; K.mode = 'pace'; K.t = 0; this.rt.notice('It heaves the stone lid off the Givers’ tank. Fill it.', 'help.keeper.lifted'); }
    } else if (K.mode === 'weary') pose = G.state === 'resolved' ? 'resolved' : 'weary';
    if (K.mode !== 'weary') G.meter = Math.min(0.85, K.calm + (lid.open ? 0.05 : 0) + (this.flow > 0 ? 0.1 : 0));
    else if (G.state === 'resolved') this.phase = 'done';
    if (K.mode === 'weary' && G.state !== 'resolved') speed = G.walk(dt, m.rest ?? this.c, 1.4, 0.2);
    poseGuardian(G, dt, t, { state: pose, phase: Math.min(2, Math.floor(K.calm / 0.25)), speed, place: true });
  }
  calmed() {
    const G = this.G, K = this.keeper;
    K.mode = 'weary'; K.t = 0; this.phase = 'calm';
    G.meter = KEEPER_HELP.flow; G.floor = KEEPER_HELP.flow;
    G.state = 'weary'; G.t = 0;   // (the shipped hand on its brow, boss.js final 'touch')
    this.rt.notice('It drinks deep, and lies down by the running spout, calm. Go to it.', 'help.keeper.weary');
  }

  view() {
    if (this.phase === 'done') return { camera: null };
    return { camera: { arm: 2.4, pitch: 0.06, look: 0.4, rate: 1.4 } };
  }

  showHud() {
    if (!this.hud) return;
    const jars = this.vessels.filter((v) => v.kind !== 'tank');
    const pips = this.vessels.map((v) => ({ on: v.full }));
    const filling = this.vessels.find((v) => !v.full && v.level > 0.01 && (this.poured === v || v.idle < LEAK.hold + 6));
    const K = this.keeper, lid = this.vessel('tank');
    let line;
    if (this.phase === 'done') line = 'The water runs again.';
    else if (this.phase === 'calm') line = 'It lies down by the spout. Lay a hand on its brow.';
    else if (this.phase === 'flowing') line = 'The muzzle pours; the basin fills. It goes to drink.';
    else if (K.mode === 'rear') line = 'Frightened: water the vessels, not the Keeper.';
    else if (K.mode === 'lift' || K.mode === 'toLid') line = 'It goes to the Givers’ tank to help.';
    else if (lid.open) line = 'Fill the Givers’ tank under the muzzle. It holds; it takes more than one bar.';
    else if (filling && this.poured !== filling) line = `${filling.name[0].toUpperCase()}${filling.name.slice(1)} is leaking: keep pouring.`;
    else line = `Aim, hold the trigger, and fill the jars and the trough (${jars.filter((v) => v.full).length} / ${jars.length}).`;
    const count = `${this.vessels.filter((v) => v.full).length} / ${this.vessels.length} vessels`;
    this.hud.set({ line, count, pips, bar: filling ? filling.level : 0, tone: '#3f9fd0' });
  }

  dispose() {
    this.view3.dispose(); this.hud?.dispose();
    if (this.tool) { this.tool.lent?.delete('cannon'); if (this.tool.streamCatch) this.tool.streamCatch = null; }
  }
}

// ------------------------------------------------------------------ the view: the vessels, their water, the wheel, the flow
class KeeperView {
  constructor(rt, E) {
    this.rt = rt; this.E = E;
    const root = (this.root = new THREE.Group());
    root.name = 'Water for the Keeper (prototype)';
    root.userData.noCollide = true;
    rt.root.add(root);
    const M = rt.M;
    // (the house's own stone and its bronze fittings: M.stone and M.trim are paint for its batches, not materials)
    this.stone = M.stoneMat ?? makeMaterial({ color: '#e6ae9b', flat: true });
    this.trim = M.trimMat ?? makeMaterial({ color: '#9c8a5c', flat: true });
    this.waterM = makeMaterial({ color: '#62c3c9', glow: 0.35, flat: true, side: THREE.DoubleSide, key: 'help.keeper.water' });
    this.gaugeM = makeMaterial({ color: '#7fd3e8', glow: 0.75, flat: true, key: 'help.keeper.gauge' });
    this.lampM = makeMaterial({ color: '#f6c84e', glow: 0.05, flat: true, key: 'help.keeper.lamp' });
    const add = (g, m, p) => { const o = new THREE.Mesh(g, m); if (p) o.position.copy(p); o.userData.noCollide = true; root.add(o); return o; };
    this.parts = new Map();
    for (const v of E.vessels) {
      const P = E.at(...v.at), o = { v };
      if (v.kind === 'jar') {
        // an amphora of the Givers' rose stone, a band of glyph at its shoulder; a corbel under the high one
        o.body = add(lathe([[0.01, 0], [0.55, 0.05], [0.85, 0.55], [0.9, 1.0], [0.7, 1.45], [0.42, 1.62], [0.5, 1.78], [0.38, 1.8]], 18), this.stone, P);
        if (v.corbel) add(new THREE.BoxGeometry(2.4, 0.5, 2.2), this.trim, P.clone().add(V(0, -0.25, 0.4)));
        o.water = add(new THREE.CircleGeometry(0.36, 16).rotateX(-Math.PI / 2), this.waterM, P.clone());
        o.gauge = add(new THREE.BoxGeometry(0.16, 1, 0.06).translate(0, 0.5, 0), this.gaugeM, P.clone().add(this.toward(P, 0.92, 0.25)));
        o.top = 1.72; o.bottom = 0.3;
      } else if (v.kind === 'trough') {
        // a stone trough on a corbel over the old wheel, tipped by its weight once full; the wheel under it
        const g = new THREE.Group(); g.position.copy(P); g.rotation.y = Math.atan2(-v.at[0], -v.at[2]); root.add(g);
        const tr = new THREE.Mesh(new THREE.BoxGeometry(3, 0.7, 1.3), this.stone); tr.position.y = 0.2; g.add(tr);
        const w = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.08, 1.0), this.waterM); g.add(w);
        const corbel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4, 1.6), this.trim); corbel.position.set(0, -0.35, -0.25); g.add(corbel);
        // (the wheel faces the cistern, its axle into the wall: it turns as the trough's water falls on its paddles)
        const wheel = new THREE.Group(); wheel.position.set(0, -2.2, -0.2); g.add(wheel);
        wheel.add(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 6, 20), this.trim));
        wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10).rotateX(Math.PI / 2), this.trim));
        for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.9, 0.14), this.trim); s.rotation.z = (i / 4) * Math.PI; wheel.add(s); }
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, s = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.5), this.stone); s.position.set(Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0); s.rotation.z = a; wheel.add(s); }
        g.traverse((x) => { x.userData.noCollide = true; });
        Object.assign(o, { group: g, water: w, wheel, top: 0.5, bottom: -0.1 });
        o.gauge = add(new THREE.BoxGeometry(0.16, 1, 0.06).translate(0, 0.5, 0), this.gaugeM, P.clone().add(V(0, -0.9, 0)).add(this.toward(P, 0.9, 0)));
      } else {
        // the Givers' great tank under the muzzle: a stone box against the wall, its heavy lid on it until the Keeper lifts it
        const yaw = 0;   // (its long side along the east wall)
        o.body = add(new THREE.BoxGeometry(1.6, 2.5, 3.8).translate(0, 1.25, 0), this.stone, P); o.body.rotation.y = yaw;
        o.lid = add(new THREE.BoxGeometry(1.9, 0.35, 4.1), this.trim, P.clone().add(V(0, 2.65, 0))); o.lid.rotation.y = yaw;
        o.water = add(new THREE.BoxGeometry(1.35, 0.05, 3.5), this.waterM, P.clone()); o.water.rotation.y = yaw;
        o.gauge = add(new THREE.BoxGeometry(0.2, 1, 0.06).translate(0, 0.5, 0), this.gaugeM, P.clone().add(V(-0.83, 0.2, 0)));
        o.gauge.rotation.y = yaw;
        o.top = 2.45; o.bottom = 0.2;
      }
      // its runnel to the basin: a strip of water along the floor (and down the wall from the high ones), grown once it spills
      o.runs = [];
      const pts = v.runnel ? [...(v.fall ? [[v.at[0], v.at[2], v.at[1] + (v.kind === 'trough' ? -0.3 : 0.2)]] : []), ...v.runnel.map(([x, z]) => [x, z, 0])] : [];
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = E.at(pts[i][0], pts[i][2] + 0.04, pts[i][1]), b = E.at(pts[i + 1][0], pts[i + 1][2] + 0.04, pts[i + 1][1]);
        const s = add(new THREE.BoxGeometry(0.45, 0.04, 1).translate(0, 0, 0.5), this.waterM, a);
        s.lookAt(b); s.userData.len = a.distanceTo(b); s.scale.set(1, 1, 0.001); s.visible = false;
        o.runs.push(s);
      }
      this.parts.set(v, o);
    }
    // the basin's water, rising
    this.pool = add(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), this.waterM, E.at(0, -1.1, 0));
    this.pool.visible = false;
    // the muzzle's pour: an arc of water from the east wall's muzzle into the basin
    const m0 = E.at(13.1, 6.2, 0), m1 = E.at(4.6, -0.6, 0), mid = m0.clone().lerp(m1, 0.35).add(V(0, 1.2, 0));
    this.pour = add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(m0, mid, m1), 20, 0.32, 6), this.waterM);
    this.pour.visible = false;
    // the lamps round the walls: they wake with the wheel's power
    this.lamps = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.39, r = 17.85, p = E.at(Math.sin(a) * r, 3.4, Math.cos(a) * r);
      const l = add(new THREE.CircleGeometry(0.42, 14), this.lampM, p); l.lookAt(E.at(0, 3.4, 0));
      this.lamps.push(l);
    }
    this.lit = false;
  }
  /** A small offset from a vessel at P toward the cistern's middle (its face to you), `d` m out, `y` up. */
  toward(P, d, y) { const o = V(this.E.c.x - P.x, 0, this.E.c.z - P.z).normalize().multiplyScalar(d); o.y = y; return o; }
  update(dt, t) {
    const E = this.E;
    for (const [v, o] of this.parts) {
      const k = v.level, P = E.at(...v.at);
      if (o.gauge) { o.gauge.scale.y = Math.max(0.001, k * (v.kind === 'tank' ? 2 : 1.3)); o.gauge.material = this.gaugeM; }
      if (v.kind === 'jar') { o.water.visible = k > 0.02; o.water.position.y = P.y + o.bottom + (o.top - o.bottom) * k; o.water.scale.setScalar(0.8 + 0.9 * Math.sin(Math.PI * Math.min(0.95, k)) ); }
      if (v.kind === 'trough') {
        o.water.visible = k > 0.02; o.water.position.y = 0.05 + 0.4 * k;
        // full: the trough tips toward its wheel, and the wheel turns
        o.group.children[0].rotation.x = v.full ? -0.35 * smooth(v.run) : 0;
        if (v.full) o.wheel.rotation.z -= dt * 1.6 * smooth(v.run);
      }
      if (v.kind === 'tank') {
        o.water.visible = k > 0.02; o.water.position.y = P.y + o.bottom + (o.top - o.bottom) * k;
        const u = E.lidK ?? (v.open ? 1 : 0);
        o.lid.position.set(P.x - 1.6 * u, P.y + 2.65 + Math.sin(Math.PI * Math.min(1, u)) * 0.8 - 2.3 * smooth((u - 0.6) / 0.4), P.z);
        o.lid.rotation.z = -0.9 * smooth((u - 0.3) / 0.7);
      }
      // the runnels grow one after the other as it spills
      const n = o.runs.length;
      o.runs.forEach((s, i) => { const u = clamp(v.run * n - i, 0, 1); s.visible = u > 0.01; s.scale.z = Math.max(0.001, u * s.userData.len); });
    }
    this.pool.visible = E.basin > 0.01;
    this.pool.position.y = E.floor - 1.1 + 0.85 * E.basin;
    this.pool.scale.setScalar(3.6 + 2.6 * E.basin);
    this.pour.visible = E.flow > 0.01; this.pour.scale.setScalar(1);
    this.waterM.uniforms.uGlow.value = 0.32 + 0.1 * Math.sin(t * 2.1);
    this.lampM.uniforms.uGlow.value = 0.05 + 0.85 * E.power;
    if (E.power > 0 && !this.lit) {
      this.lit = true;
      for (const l of this.lamps) this.rt.lights.push(new THREE.Vector4(l.position.x, l.position.y, l.position.z, 7));
    }
  }
  dispose() { this.root.removeFromParent(); }
}

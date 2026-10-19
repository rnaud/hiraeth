// A fight temple's run (docs/design/fight-temples.md): played on foot (a minigame with drives: false, so the usual
// walking, blade, guard, evade and fluid gun run), under a fixed isometric camera. Room by room: the gate behind
// you, the waves come up out of the ink springs, many light foes of the world's kinds, as many standing at once as
// the crowd's cap allows; a wave cleared, a breather; a room cleared, its gate sinks; the last room's last wave is
// the tough one, and then the reliquary rises on the altar with the world's colours for the backpack, the sword and
// the shield (src/kit-colours.js). The pure rules are in rules.js; the rooms in rooms.js.
//
// The camera: CameraRig still runs (main.js), then this puts the camera on the iso line every frame (the rig's yaw is
// held at ISO.yaw, so the stick and WASD walk him relative to the screen). The aim: the right stick, or the mouse's
// reticle on the floor, or the way he walks; the blade and the gun take the foe in that cone (FluidTool.lockOn and
// updateAimPoint wrapped for the run). The walls and pillars between the camera and him are seen through (SEE: a hole with
// a hand-cut edge opens in them round him, materials.js SEE_HOLE). The button printed B rolls (B / ○; the bottom one with Nintendo letters: rules.js rollInput, #442; ROLL; jumping is disabled here), and the blade's cut
// takes every foe in a wider, longer cone (WIDE_CUT); both only here (issue #365).
//
// Reading the crowd (issue #534, view.js): a hazard or a geyser warning near him draws the view toward it and back a
// little (frameIso), and one still off the frame gets a marker at the screen's edge (Foes.extraWarn: the foes' own
// chips); hidden by the foes' bodies he gets an inked ring over them (self-mark.js); R3 / Tab, with no lock in here,
// flashes the aim's ring with the lock's tick (Foes.lockAnswer).

import * as THREE from 'three';
import { makeMaterial, SEE_HOLE } from '../materials.js';
import { ROLL, WIDE_CUT, BLADE, QUICK_CUT } from '../fluid-blade.js';
import { FOES } from '../foes.js';
import { lendTool, standAt, tune } from '../minigames/kit/onfoot.js';
import { WorldLabels } from '../minigames/kit/labels.js';
import { unlockColours, colourById, applyKitColours } from '../kit-colours.js';
import { reliquaryModel } from './rooms.js';
import { roomHazards, HAZARD } from './hazards.js';
import { KillFx } from './kill-fx.js';
import {
  ISO, isoOffset, followIso, SEE, sightPoints, inTheWay, easeSee, seeOpen, AIM, pickTarget, stickToGround, screenUp, screenRight,
  roomAt, inRoom, roomWaves, release, CROWD, headOf, heartChance, chimesFor, pursesFor, totalFoes,
  GORGED, FURY, GEYSER, geyserSpots, rankFor, clock, rollInput, rollKey,
} from './rules.js';
import { padFaces } from '../native-pad.js';
import { frameIso, telegraphs, nearestTelegraph, FRAME, LOCK_ANSWER, answerScale } from './view.js';
import { SelfMark } from './self-mark.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
/** A light foe's blows: this share of its kind's (many of them, each felled in a cut or two, each hurting less). */
export const LIGHT_HARM = 0.5;

/** A heart lying on the floor: a small red glowing gem, bobbing; walked over (or drawn in), a heart back. */
function heartModel() {
  const g = new THREE.Group();
  const red = makeMaterial({ color: '#e0453a', flat: true, glow: 0.7 });
  const s = new THREE.Shape();
  s.moveTo(0, -0.22); s.bezierCurveTo(0.05, -0.12, 0.26, -0.02, 0.24, 0.12); s.bezierCurveTo(0.22, 0.26, 0.04, 0.27, 0, 0.14);
  s.bezierCurveTo(-0.04, 0.27, -0.22, 0.26, -0.24, 0.12); s.bezierCurveTo(-0.26, -0.02, -0.05, -0.12, 0, -0.22);
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 8 }).translate(0, 0, -0.04), red);
  m.scale.setScalar(1.25);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.4, 24).rotateX(-Math.PI / 2), makeMaterial({ color: '#ffb0a0', flat: true, glow: 0.8 }));
  g.add(m, ring);
  g.traverse((o) => { o.userData.noCollide = true; });
  return Object.assign(g, { gem: m, ring });
}

/** An ember shard (a gorged one's): a small burning diamond, bobbing; walked over, FURY. */
function shardModel() {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0).scale(1, 1.5, 1), makeMaterial({ color: FURY.tones[0], flat: true, glow: 0.9 }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 24).rotateX(-Math.PI / 2), makeMaterial({ color: FURY.tones[1], flat: true, glow: 0.8 }));
  g.add(gem, ring);
  g.traverse((o) => { o.userData.noCollide = true; });
  return Object.assign(g, { gem, ring });
}

/**
 * The floor's warnings (issue #368), flat on the stone: a spring welling up (an ember ring that tightens as the foes
 * it brings rise), an ink geyser about to burst (a dark pool filling to its ember rim), a gorged one's ring, and a
 * pillar of light over each of the last few.
 */
function warnMarks(P = {}) {
  const ember = makeMaterial({ color: P.glyph ?? '#e8703a', flat: true, glow: 0.9 });
  const pale = makeMaterial({ color: P.pale ?? '#ffc890', flat: true, glow: 0.85 });
  const ink = makeMaterial({ color: P.ink ?? '#2a2440', flat: true });
  const mesh = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.renderOrder = 2; m.userData.noCollide = true; m.visible = false; return m; };
  return {
    well: () => mesh(new THREE.RingGeometry(0.75, 1.0, 32).rotateX(-Math.PI / 2), ember, 0.09),
    geyser: () => {
      const g = new THREE.Group(); g.visible = false; g.userData.noCollide = true;
      const rim = mesh(new THREE.RingGeometry(GEYSER.radius - 0.12, GEYSER.radius, 40).rotateX(-Math.PI / 2), ember, 0.07);
      const fill = mesh(new THREE.CircleGeometry(GEYSER.radius - 0.12, 40).rotateX(-Math.PI / 2), ink, 0.06);
      rim.visible = fill.visible = true;
      g.add(rim, fill);
      return Object.assign(g, { rim, fill });
    },
    gorged: () => mesh(new THREE.RingGeometry(0.95, 1.15, 32).rotateX(-Math.PI / 2), pale, 0.07),
    beacon: () => mesh(new THREE.CylinderGeometry(0.09, 0.09, 7, 6, 1, true).translate(0, 3.5, 0), pale, 0),
  };
}

/** The aim's marks on the floor: a chevron at his feet the way he aims, a ring under the foe taken, the mouse's reticle. */
function aimMarks() {
  const glow = makeMaterial({ color: '#fff1c8', flat: true, glow: 0.9 });
  const warm = makeMaterial({ color: '#f6a94a', flat: true, glow: 0.9 });
  const s = new THREE.Shape(); s.moveTo(0, 0.42); s.lineTo(0.26, 0.05); s.lineTo(0.13, 0.05); s.lineTo(0, 0.24); s.lineTo(-0.13, 0.05); s.lineTo(-0.26, 0.05); s.closePath();
  const chevron = new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), glow);
  const target = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 32).rotateX(-Math.PI / 2), warm);
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24).rotateX(-Math.PI / 2), glow);
  for (const m of [chevron, target, reticle]) { m.userData.noCollide = true; m.renderOrder = 2; }
  const g = new THREE.Group(); g.add(chevron, target, reticle); g.userData.noCollide = true;
  return Object.assign(g, { chevron, target, reticle });
}

/**
 * The end card's colours line (issue #480): the colours go on what the traveller carries (his own things, not the run's
 * lent kit), and wait for the rest; `has(id)` the save's items. One line.
 */
export function coloursLine(name, has = () => true) {
  const KIT = [['backpack', 'the backpack'], ['sword', 'the sword'], ['shield', 'the shield']];
  const and = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0]);
  const own = KIT.filter(([id]) => has(id)).map(([, w]) => w), rest = KIT.filter(([id]) => !has(id)).map(([, w]) => w.replace('the ', 'your '));
  if (!rest.length) return `New colours: ${name}, for ${and(own)}. Wearing them now; change them in Items.`;
  if (!own.length) return `New colours: ${name}, for ${and(rest)}, once you have them.`;
  return `New colours: ${name}, on ${and(own)} now; ${and(rest)} will take them once found.`;
}

export function startFightTemple(ctx) {
  const { player, camera, level, sfx, sound, tool, foes, rig, physics, state } = ctx;
  const F = level.fight, def = F.def, rooms = def.rooms;
  const gentle = foes?.difficulty === 'gentle';
  // (a table's `stage`: the foes' place on the route's curve in here, src/foes.js stageHere, when its world's own is too
  // harsh for a crowd this size: how many strike at once, how hard)
  const stageWas = foes?.stage;
  if (foes && def.stage != null) foes.stage = def.stage;
  const own = tool?.items ?? null;   // (the save's own things, before the run lends its kit: the end card's colours, coloursLine)
  const giveBack = lendTool(tool, { mode: 'shoot' });   // (the save's own bar; the plain shot in hand, the push a press of X / D-pad → away)
  const spawn = new THREE.Vector3(...def.spawn);
  standAt(player, spawn, Math.PI, rig, ISO.yaw);
  const words = new WorldLabels(camera);
  const first = !state?.flag?.(`kit.colours.${def.colours}`);   // (the reward not won yet: the full loot)
  const plan = rooms.map((r) => roomWaves(r, { gentle, hpOf: (k) => FOES[k]?.hp ?? 2 }));
  const run = { room: 0, wave: -1, phase: 'wait', kills: 0, chain: 0, lastKill: -99, bestChain: 0, hearts: 0, chimes: 0, total: totalFoes(def, { gentle }),
    waveN: 0, waves: plan.reduce((a, w) => a + w.length, 0), lost: 0, gorged: 0, gorgedOf: plan.flat(2).filter((q) => q.gorged).length, geysers: 0, furies: 0 };
  let t = 0, queue = [], mine = [], spawnT = 0, restT = 0, over = false, deadT = 0, reward = null, rewardT = 0;
  const hearts = [], shards = [];
  let heartsWas = player.hearts ?? 0, runClock = 0;
  globalThis.document?.body?.classList.add('fight-iso');

  // ---------------------------------------------------------------- the camera: the rig's yaw held on the iso line
  const yawWas = Object.getOwnPropertyDescriptor(rig ?? {}, 'yaw'), yaw0 = rig?.yaw;
  if (rig) Object.defineProperty(rig, 'yaw', { get: () => ISO.yaw, set: () => {}, configurable: true });
  ctx.setFov(ISO.fov);
  const look = player.pos.clone().setY(player.pos.y + ISO.look);
  const offset = isoOffset(ISO, new THREE.Vector3());
  // (the framing toward the nearest telegraph, eased: view.js frameIso; `tells` this frame's, the hazards' and geysers')
  const framed = { dx: 0, dz: 0, zoom: 1 }, aimAt = new THREE.Vector3();
  let tells = [];
  function placeCamera(dt) {
    followIso(look, player.pos, player.vel, dt);
    const want = frameIso(player.pos, nearestTelegraph(tells, player.pos), camera.aspect || 16 / 9);
    const e = 1 - Math.exp(-(want.zoom > 1 || want.dx || want.dz ? FRAME.ease : FRAME.back) * dt);
    framed.dx += (want.dx - framed.dx) * e; framed.dz += (want.dz - framed.dz) * e; framed.zoom += (want.zoom - framed.zoom) * e;
    aimAt.set(look.x + framed.dx, look.y, look.z + framed.dz);
    camera.position.copy(aimAt).addScaledVector(offset, framed.zoom);
    camera.up.set(0, 1, 0);
    camera.lookAt(aimAt);
    camera.updateMatrixWorld();
  }
  // the hazards still off the frame marked at its edge, as a foe winding up out of sight is (src/foes.js warnings)
  const tellTone = def.palette.glyph ?? '#e8703a';
  if (foes) foes.extraWarn = () => tells.map((p) => ({ pos: new THREE.Vector3(p.x, 0.3, p.z), k: p.k, tone: tellTone }));
  // the traveller found in his crowd: a ring over the foes that hide him
  const selfMark = new SelfMark(camera);
  // the walls and pillars solid (a Retry: all of them again), the gates shut, their colliders movers
  const setSee = (c, k) => { c.k = k; const v = seeOpen(k) * (c.kind === 'pillar' ? SEE.pillar : 1); for (const u of c.see ?? []) u.value = v; };
  for (const c of F.cuttables) setSee(c, 0);
  const movers = F.gates.map((g) => { g.group.position.y = 0; g.open = false; g.sink = 0; g.group.updateMatrixWorld(true); return physics?.addMover?.(g.group, { all: true }) ?? null; });
  /** The walls and pillars in the camera's way seen through, a hole opening round him in each (the others solid). */
  function seeThrough(dt) {
    SEE_HOLE.value.set(player.pos.x, player.pos.y + SEE.chest, player.pos.z, SEE.radius);
    const want = new Set(inTheWay(camera.position, F.cuttables, sightPoints(player.pos)));
    F.cuttables.forEach((c, i) => { const k = easeSee(c.k, want.has(i), dt); if (k !== c.k) setSee(c, k); });
  }
  // the blade's dodge roll and its generous cut (fluid-blade.js ROLL, WIDE_CUT): only in here
  const blade = tool?.blade;
  if (blade) { blade.roll = ROLL; blade.wide = WIDE_CUT; blade.quick = QUICK_CUT; }   // (and its quicker combo: QUICK_CUT, #442)
  // (the sword drawn longer and broader in here, to the crescent: its tip about 2.1 m out, the crescent's edge past it)
  const edge0 = BLADE.edge ?? 1;
  const keepBlade = tune(BLADE, { length: WIDE_CUT.length, width: WIDE_CUT.width, edge: edge0 });
  let furyT = 0;

  // ---------------------------------------------------------------- the floor's warnings (issue #368)
  const W = warnMarks(def.palette);
  const wells = [], geysers = [], filling = [], beacons = Array.from({ length: CROWD.few }, () => ctx.add(W.beacon()));
  const wellMesh = () => wells.find((w) => !w.busy) ?? (wells[wells.length] = { busy: false, m: ctx.add(W.well()) });
  const geyserMesh = () => geysers.find((g) => !g.busy) ?? (geysers[geysers.length] = { busy: false, m: ctx.add(W.geyser()) });
  let pending = [], geyserT = 0;
  // the world's own hazard in its rooms (hazards.js: Vael's gusts, Lorn's millstones, the Foundry's pour), on lanes
  const hz = roomHazards({ ctx, def, player, foes, tool, sfx, sound, gentle, mine: () => mine });
  // the kills made to read from up here (kill-fx.js, issue #442): thrown back, a ring, a splash, a splat that dries, a thump;
  // a body thrown is kept in the room and off the pillars
  const kills = new KillFx({ add: ctx.add, tool, sound, palette: def.palette, keep: (f) => {
    const R = rooms[run.room], r = (f.def.radius ?? 0.5) + 0.3;
    if (R) { f.pos.x = THREE.MathUtils.clamp(f.pos.x, R.x[0] + r, R.x[1] - r); f.pos.z = THREE.MathUtils.clamp(f.pos.z, R.z[0] + r, R.z[1] - r); }
    for (const c of F.cuttables) {
      if (c.kind !== 'pillar') continue;
      const cx = (c.box.min.x + c.box.max.x) / 2, cz = (c.box.min.z + c.box.max.z) / 2, hx = (c.box.max.x - c.box.min.x) / 2 + r, hz2 = (c.box.max.z - c.box.min.z) / 2 + r;
      const dx = f.pos.x - cx, dz = f.pos.z - cz;
      if (Math.abs(dx) >= hx || Math.abs(dz) >= hz2) continue;
      if (hx - Math.abs(dx) < hz2 - Math.abs(dz)) f.pos.x = cx + Math.sign(dx || 1) * hx; else f.pos.z = cz + Math.sign(dz || 1) * hz2;
    }
  } });

  // ---------------------------------------------------------------- the aim
  const marks = ctx.add(aimMarks());
  const reticle = new THREE.Vector2(0, 3);   // (the mouse's, screen x right / y up, m)
  let mouseT = -99;
  const onMouse = (e) => {
    if (!globalThis.document?.pointerLockElement) return;
    reticle.x += e.movementX * AIM.mouse; reticle.y -= e.movementY * AIM.mouse;
    const L = reticle.length(), [lo, hi] = AIM.reticle;
    if (L > hi) reticle.multiplyScalar(hi / L); else if (L < lo && L > 1e-3) reticle.multiplyScalar(lo / L);
    mouseT = t;
  };
  globalThis.addEventListener?.('mousemove', onMouse);
  const aimDir = new THREE.Vector3(0, 0, -1);
  let source = 'walk', pick = null, gunPick = null;
  function aim(raw) {
    const rs = raw?.lookStick, stick = rs ? stickToGround(rs, AIM.stick, ISO, _v) : null;
    if (stick) { aimDir.copy(stick); source = 'stick'; }
    else if (t - mouseT < AIM.mouseKeep) { stickToGround({ x: reticle.x, y: reticle.y }, 0.01, ISO, aimDir); source = 'mouse'; }
    else {
      source = 'walk';
      const hs = Math.hypot(player.vel?.x ?? 0, player.vel?.z ?? 0);
      if (hs > 0.6) aimDir.set(player.vel.x, 0, player.vel.z).normalize();
      else if (player.frame?.dir) { player.frame.dir(player.heading, aimDir); aimDir.setY(0).normalize(); }
    }
    const live = mine.filter((f) => f.alive && f.dead === undefined);
    pick = pickTarget(player.pos, aimDir, live, { range: AIM.blade });
    gunPick = pickTarget(player.pos, aimDir, live, { range: AIM.gun, cone: AIM.cone * 0.8 });
  }
  const targetOf = (f) => (f ? (f._isoT ??= { position: () => f.chest, aim: () => f.aim ?? f.chest, enabled: () => f.alive && f.dead === undefined, lock: true, radius: (f.def.radius ?? 0.5) + 0.15 }) : null);
  // R3 / Tab: no lock in here (it would turn the view off the iso line), so the press is answered: the aim's ring
  // flashes under the foe it takes and the lock's tick sounds (none in the cone: a ring goes out round him and the
  // tick falls); the first press of a run also says how to aim (view.js LOCK_ANSWER)
  let answerT = -1, answerTold = false;
  if (foes) foes.lockAnswer = () => {
    const tgt = tool?.k > 0.3 ? gunPick ?? pick : pick;
    answerT = 0;
    sound?.lockOn?.(!!tgt);
    if (!tgt) tool?.rings?.add({ from: _v.set(player.pos.x, 0.1, player.pos.z), dir: _up, reach: 0.02, r0: 0.5, r1: LOCK_ANSWER.ring, life: LOCK_ANSWER.secs, color: '#f6a94a', thick: 1 });
    if (!answerTold) { answerTold = true; ctx.flash(LOCK_ANSWER.line, '', 2.6); }
    return tgt ?? true;   // (truthy: answered, so no scout's ping either)
  };
  const lockOn0 = tool?.lockOn;
  if (tool) tool.lockOn = () => targetOf(tool.k > 0.3 ? gunPick ?? pick : pick) ?? lockOn0?.() ?? null;
  const aimPoint0 = tool?.updateAimPoint, aimOwn = !!tool && Object.hasOwn(tool, 'updateAimPoint');
  if (tool && aimPoint0) tool.updateAimPoint = function () {
    const shot = aimPoint0.call(tool);
    const chest = _w.copy(player.pos).addScaledVector(_up, 1.3);
    if (gunPick) tool.aimPoint.copy(gunPick.chest); else tool.aimPoint.copy(chest).addScaledVector(aimDir, 14).addScaledVector(_up, -0.7);
    tool.aimDir.subVectors(tool.aimPoint, chest).normalize();
    (tool.aimFrom ??= new THREE.Vector3()).copy(chest);
    tool.aimKind = gunPick ? 'target' : 'none'; tool.aimLocked = !!gunPick;
    return shot;
  };
  let bladeHeld = false;
  /** In a room, or in the doorway of a gate that is open (0.5 m either side of it: the step from a room into it). */
  const inHall = (p) => rooms.some((r) => inRoom(r, p.x, p.z, 0)) || F.gates.some((g) => g.open && p.x > g.gap.x[0] - 0.5 && p.x < g.gap.x[1] + 0.5 && p.z > g.gap.z[0] - 0.5 && p.z < g.gap.z[1] + 0.5);

  // ---------------------------------------------------------------- the rooms and their waves
  const gate = (i) => F.gates.find((g) => g.door.from === i) ?? null;
  function startWave() {
    run.wave++;
    run.phase = 'fight';
    queue = plan[run.room][run.wave].slice();
    // (shuffled a little: the kinds mixed as they come up)
    for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
    queue.sort((a, b) => +a.tough - +b.tough);   // (the tough ones last: the crowd first, then them)
    spawnT = 0.2; geyserT = 0;
    run.waveN++;
    const last = lastWave(), g = plan[run.room][run.wave].filter((q) => q.gorged).length;
    ctx.flash(last ? `The last of them · wave ${run.waveN} of ${run.waves}` : `${rooms[run.room].name} · wave ${run.waveN} of ${run.waves}${g ? ` · ${g > 1 ? `${g} gorged` : 'a gorged one'} in it` : ''}`, last ? 'bad big' : 'big', 1.8);
    sound?.foeWarn?.('machine');
    sfx.whoosh?.();
  }
  function springsFor(i) {
    const S = F.springs[i] ?? [];
    return S.slice().sort((a, b) => b.distanceTo(player.pos) - a.distanceTo(player.pos));
  }
  function bringUp(dt, cap = gentle ? CROWD.gentle : CROWD.cap) {
    if (!queue.length) return;
    if ((spawnT -= dt) > 0) return;
    spawnT = CROWD.every;
    const coming = pending.reduce((a, w) => a + w.items.reduce((b, q) => b + headOf(q.kind), 0), 0);
    const standing = mine.filter((f) => f.alive).reduce((a, f) => a + headOf(f.kind), 0) + coming;
    const n = release(queue, standing, cap, cap === Infinity ? queue.length : CROWD.burst);
    if (!n) return;
    const S = springsFor(run.room);
    // (each spring wells up first, CROWD.warn s, its ring tightening, and then they come out of it: where they will
    // be is seen before they are there; the checks' crowd comes up at once)
    const by = new Map();
    for (let i = 0; i < n; i++) { const s = S[i % Math.min(S.length, 3)] ?? spawn; if (!by.has(s)) by.set(s, []); by.get(s).push(queue.shift()); }
    for (const [s, items] of by) {
      const warn = cap === Infinity ? 0 : CROWD.warn;
      const w = { at: s, items, t: warn, warn, mark: warn > 0 ? wellMesh() : null };
      if (w.mark) { w.mark.busy = true; w.mark.m.position.set(s.x, 0.09, s.z); w.mark.m.scale.setScalar(1.6); w.mark.m.visible = true; }
      pending.push(w);
      if (warn <= 0) emerge(w);
    }
    pending = pending.filter((w) => !w.done);
  }
  /** The springs welling: their rings tighten; once one is through, its foes come up out of it. */
  function wellsUp(dt) {
    for (const w of pending) {
      w.t -= dt;
      if (w.mark) { const k = 1 - Math.max(0, w.t) / w.warn; w.mark.m.scale.setScalar(1.6 - 0.9 * k + 0.06 * Math.sin(t * 22)); }
      if (w.t <= 0) emerge(w);
    }
    pending = pending.filter((w) => !w.done);
  }
  function emerge(w) {
    if (w.done) return;
    w.done = true;
    if (w.mark) { w.mark.busy = false; w.mark.m.visible = false; }
    const s = w.at;
    for (const q of w.items) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.8;
      const at = new THREE.Vector3(s.x + Math.cos(a) * r, 0, s.z + Math.sin(a) * r);
      const f = foes?.add(q.kind, at);
      if (!f) continue;
      f.hp = q.hp; f.light = !q.tough && !q.gorged; f.tough = q.tough; f.gorged = q.gorged;
      // (it sees the whole room and keeps after you; no high ground to hold (the pillars' tops); a light one strikes
      // half as hard, a gorged one as hard as its kind)
      f.def = { ...f.def, sight: 80, giveUp: 1e9, perch: false, clamber: false, ...(q.tough || q.gorged ? {} : { attacks: f.def.attacks.map((a) => ({ ...a, damage: (a.damage ?? 1) * (def.lightHarm ?? LIGHT_HARM) })) }) };   // (a table's lightHarm: its own share)
      if (!q.tough) { f.def.attack = f.def.attacks[0]; f.atk = f.def.attack; }
      f.state = 'chase'; f.cool = 0.8 + Math.random() * 0.8;
      if (q.tough) f.model.group.scale.multiplyScalar(1.12);
      if (q.gorged) {
        // (swollen with the ink, a pale ring at its feet: it takes longer to fell, and leaves a heart and an ember shard)
        f.model.group.scale.multiplyScalar(GORGED.scale);
        f.gorgedRing = ctx.add(W.gorged()); f.gorgedRing.visible = true; f.gorgedRing.position.set(f.pos.x, 0.07, f.pos.z);
        words.pop(_v.copy(f.pos).setY(2.6), 'gorged!', 'bad', 1.2);
      }
      mine.push(f);
    }
    splash(s);
  }

  // ---------------------------------------------------------------- the ink geysers (rules.js GEYSER)
  const lastWave = () => run.room === rooms.length - 1 && run.wave === plan[run.room].length - 1;
  const geyserEvery = () => { const G = rooms[run.room]?.geysers; return G ? G.every * (lastWave() ? GEYSER.last : 1) * (gentle ? GEYSER.gentle : 1) : 0; };
  function openGeysers(dt) {
    const every = geyserEvery();
    if (!every || run.phase !== 'fight' || player.dead) return;
    if ((geyserT += dt) < every) return;
    geyserT = 0;
    for (const [x, z] of geyserSpots(rooms[run.room], player.pos, rooms[run.room].geysers.n)) {
      const g = geyserMesh(); g.busy = true; g.m.position.set(x, 0, z); g.m.visible = true; g.m.fill.scale.setScalar(0.05);
      filling.push({ at: new THREE.Vector3(x, 0, z), t: 0, mark: g });
    }
    sound?.foeWarn?.('ink');
  }
  function geysersUp(dt) {
    for (let i = filling.length - 1; i >= 0; i--) {
      const g = filling[i]; g.t += dt;
      const k = Math.min(1, g.t / GEYSER.warn);
      g.mark.m.fill.scale.setScalar(0.05 + 0.95 * k * k);
      g.mark.m.rim.scale.setScalar(1 + (k > 0.75 ? 0.05 * Math.sin(t * 40) : 0));
      if (k < 1) continue;
      burst(g.at);
      g.mark.busy = false; g.mark.m.visible = false; filling.splice(i, 1);
    }
  }
  function burst(at) {
    run.geysers++;
    const tones = [def.palette.ink, def.palette.inkLite, '#6d4fa8', def.palette.glyph];
    for (let i = 0; i < 26; i++) tool?.drops?.add({ pos: _v.set(at.x + (Math.random() - 0.5) * GEYSER.radius, 0.2, at.z + (Math.random() - 0.5) * GEYSER.radius), vel: _w.set((Math.random() - 0.5) * 2.5, 6 + Math.random() * 6, (Math.random() - 0.5) * 2.5), drag: 1.2, grav: 14, size: 0.07 + Math.random() * 0.07, stretch: 2.5, life: 0.6 + Math.random() * 0.4, color: tones[i % tones.length] });
    tool?.rings?.add({ from: _v.set(at.x, 0.1, at.z), dir: _up, reach: 0.02, r0: 0.4, r1: GEYSER.radius + 0.4, life: 0.35, color: def.palette.glyph, thick: 1.2 });
    sfx.splash?.();
    // him: in it, and not rolling through it (the roll's i-frames, as a blow's)
    const d = Math.hypot(player.pos.x - at.x, player.pos.z - at.z);
    if (!player.dead && d < GEYSER.radius && !player.dodge?.(at, 'strike', gentle)) {
      player.hurt?.(GEYSER.harm * (gentle ? 0.5 : 1), 'geyser');
      if (d > 0.05) player.vel?.addScaledVector(_w.set(player.pos.x - at.x, 0, player.pos.z - at.z).normalize(), 4);
      player.vel?.addScaledVector(_up, 3);
      player.flinch?.();
    }
    // the foes in it: cut by it (lured in, a crowd goes down with it)
    for (const f of mine.slice()) {
      if (!f.alive || Math.hypot(f.pos.x - at.x, f.pos.z - at.z) > GEYSER.radius + (f.def.radius ?? 0.5) * 0.5) continue;
      foes?.hurt?.(f, 'world', _w.set(f.pos.x - at.x + 1e-3, 0, f.pos.z - at.z).normalize(), { damage: GEYSER.damage, source: 'geyser' });
    }
  }

  // ---------------------------------------------------------------- the ember shards (FURY)
  function dropShard(at) {
    const m = ctx.add(shardModel());
    m.position.set(at.x, 0.7, at.z);
    shards.push({ m, age: 0 });
  }
  function shardsUp(dt) {
    for (let i = shards.length - 1; i >= 0; i--) {
      const h = shards[i]; h.age += dt;
      h.m.gem.rotation.y += dt * 3; h.m.gem.position.y = Math.sin(h.age * 4) * 0.08; h.m.ring.position.y = -0.62;
      const dx = player.pos.x - h.m.position.x, dz = player.pos.z - h.m.position.z, d = Math.hypot(dx, dz);
      if (d < 2.4 && h.age > 0.4) { h.m.position.x += (dx / d) * Math.min(d, 7 * dt); h.m.position.z += (dz / d) * Math.min(d, 7 * dt); }
      if ((d < 0.8 && h.age > 0.3) || h.age > 30) {
        if (h.age <= 30) {
          furyT = FURY.secs; run.furies++;
          sound?.potionPickup?.(); sfx.whoosh?.();
          words.pop(_v.copy(player.pos).setY(player.pos.y + 2.2), 'bright!', 'gold', 1.1);
          ctx.flash(`The blade runs bright · cuts land ${FURY.edge}× for ${FURY.secs} s`, 'good', 1.6);   // (no "fury": the house voice's words, issue #483)
        }
        h.m.removeFromParent(); shards.splice(i, 1);
      }
    }
    const was = BLADE.edge;
    furyT = Math.max(0, furyT - dt);
    BLADE.edge = furyT > 0 ? edge0 * FURY.edge : edge0;
    if (blade) blade.slashTones = furyT > 0 ? FURY.tones : null;
    if (was !== BLADE.edge && furyT <= 0) ctx.flash('The blade dims', '', 1.0);
  }

  // ---------------------------------------------------------------- the last few marked, the strays put back
  function lastFew(dt) {
    const left = run.phase === 'fight' && !queue.length && !pending.length ? mine.filter((f) => f.alive) : [];
    beacons.forEach((b, i) => {
      const f = left.length <= CROWD.few ? left[i] : null;
      b.visible = !!f;
      if (f) { b.position.set(f.pos.x, 0, f.pos.z); b.scale.set(1, 0.92 + 0.08 * Math.sin(t * 6 + i), 1); }
    });
    // (a foe got out of the room, past a wall or into a corner it can't leave: back by the spring nearest it)
    const R = rooms[run.room];
    for (const f of mine) {
      if (!f.alive || !R || f.air) continue;
      if (inRoom(R, f.pos.x, f.pos.z, 0) && !(f.pos.y > 1.2 && !f.def.hover)) { f.strayT = 0; continue; }   // (out, or up on a wall: a hazard's knock can fling one there)
      if ((f.strayT = (f.strayT ?? 0) + dt) < 1.5) continue;
      const s = springsFor(run.room).at(-1) ?? spawn;
      f.pos.set(s.x, 0, s.z); f.model?.group?.position.copy(f.pos); f.vel?.set?.(0, 0, 0); f.strayT = 0;
    }
    for (const f of mine) if (f.gorgedRing) { f.gorgedRing.position.set(f.pos.x, 0.07, f.pos.z); f.gorgedRing.visible = f.alive; }
  }
  /** A walker that got up onto a pillar's top (a hop, a leap) is put down beside it: the fight is on the floor. */
  function offTheTop(f) {
    for (const c of F.cuttables) {
      if (c.kind !== 'pillar') continue;
      const cx = (c.box.min.x + c.box.max.x) / 2, cz = (c.box.min.z + c.box.max.z) / 2, dx = f.pos.x - cx, dz = f.pos.z - cz, d = Math.hypot(dx, dz);
      if (d > 1.3) continue;
      const k = d > 1e-3 ? 1.6 / d : 1;
      f.pos.set(cx + (d > 1e-3 ? dx : 1) * k, 0, cz + (d > 1e-3 ? dz : 0) * k);
      f.model?.group?.position.copy(f.pos);
      return;
    }
    // (or onto a wall's top, a toad's leap: put down inside the room by it; the run waited on it up there for ever)
    const R = rooms[run.room];
    if (R && !inRoom(R, f.pos.x, f.pos.z, 0.2)) {
      const r = (f.def.radius ?? 0.5) + 0.4;
      f.pos.set(THREE.MathUtils.clamp(f.pos.x, R.x[0] + r, R.x[1] - r), 0, THREE.MathUtils.clamp(f.pos.z, R.z[0] + r, R.z[1] - r));
      f.model?.group?.position.copy(f.pos);
    }
  }
  function splash(s) {
    const tones = [def.palette.ink, def.palette.inkLite, '#6d4fa8'];
    for (let i = 0; i < 10; i++) tool?.drops?.add({ pos: _v.set(s.x, 0.3, s.z), vel: _w.set((Math.random() - 0.5) * 3, 3 + Math.random() * 4, (Math.random() - 0.5) * 3), drag: 1.5, grav: 12, size: 0.05 + Math.random() * 0.05, stretch: 2, life: 0.5 + Math.random() * 0.4, color: tones[i % 3] });
  }
  function felled(f) {
    run.kills++;
    kills.felled(f, player.pos);
    run.chain = t - run.lastKill <= 2.5 ? run.chain + 1 : 1;
    run.lastKill = t;
    run.bestChain = Math.max(run.bestChain, run.chain);
    if (run.chain >= 3 && run.chain % 5 === 0) words.pop(_v.copy(f.pos).setY(f.pos.y + 1.8), `chain ×${run.chain}`, 'combo', 1.0);
    // the loot: a heart now and then (more when you are hurt), a chime from a light one now and then, more from a tough one
    if (f.gorged) {
      // (a gorged one: a heart always, its ember shard, and its ring gone with it)
      run.gorged++;
      dropHeart(f.pos); dropShard(_v.copy(f.pos).add(_w.set(0.9, 0, 0.4)));
      f.gorgedRing?.removeFromParent(); f.gorgedRing = null;
      ctx.kick?.(0.35);
    } else if (Math.random() < heartChance(player.hearts ?? 3, player.maxHearts ?? 3)) dropHeart(f.pos);
    const n = chimesFor(f, Math.random, first);
    if (n) { ctx.drop?.(f.pos.clone().setY(f.pos.y + 0.3), n); run.chimes += n; }
  }
  function dropHeart(at) {
    const m = ctx.add(heartModel());
    m.position.set(at.x, 0.6, at.z);
    hearts.push({ m, age: 0, vy: 3.2 });
  }
  function purse(what, at) {
    const n = pursesFor(what, first);
    if (n && ctx.drop) { ctx.drop(at.clone(), n); run.chimes += n; }
  }
  function waveCleared() {
    const last = run.wave >= plan[run.room].length - 1;
    purse(last ? 'room' : 'wave', player.pos.clone().addScaledVector(aimDir, 1.5));
    sfx.checkpoint?.();
    if (!last) { run.phase = 'rest'; restT = CROWD.breather; ctx.flash('Cleared', 'good', 1.2); return; }
    const g = gate(run.room);
    player.restore?.(1);   // (a heart back for a room cleared)
    if (g) {
      g.open = true;
      run.phase = 'wait'; run.room++; run.wave = -1;
      ctx.flash(`${rooms[run.room - 1].name} cleared · the way on is open`, 'good big', 2.0);
      sound?.chime?.();
    } else {
      // the last room: the reliquary rises on the altar
      run.phase = 'reward';
      purse('finale', F.altar ?? player.pos);
      const pal = colourById(def.colours);
      reward = ctx.add(reliquaryModel(def.palette, pal?.water.base ?? '#e8703a'));
      reward.position.copy(F.altar ?? player.pos).setY(-1.6);
      rewardT = 0;
      ctx.flash('The reliquary rises', 'good big', 2.2);
      sound?.chime?.();
    }
  }
  function takeReward() {
    const pal = colourById(def.colours);
    const fresh = unlockColours(state, def.colours);
    if (fresh) applyKitColours(tool, state);
    for (let i = 0; i < 40; i++) tool?.glow?.add({ pos: reward.lid.getWorldPosition(_v), vel: _w.randomDirection().multiplyScalar(3), drag: 2, size: 0.08, life: 0.9, color: i % 2 ? pal.water.base : pal.pack.cloth, grow: true });
    sfx.coin?.(3); sfx.gate?.();
    reward.visible = false;
    over = true;
    const rank = rankFor({ secs: runClock, lost: run.lost }, def.par);
    run.rank = rank;
    // (issue #483: a spring-house ends quiet, not cleared; the place speaks first, its table's `quiet`, the scores under it)
    ctx.finish({ title: `${def.name} is quiet · rank ${rank}`, lines: [
      ...(def.quiet ? [def.quiet] : []),
      fresh ? coloursLine(pal.name, (id) => own?.has?.(id) ?? true) : `${pal.name}: yours already (Items, Colours)`,
      `Rank ${rank} · ${clock(runClock)} (par ${clock(def.par ?? 240)}) · hearts lost ${+run.lost.toFixed(2)}`,
      `Foes felled ${run.kills} · gorged ${run.gorged} of ${run.gorgedOf} · longest chain ${run.bestChain}`,
      `Hearts found ${run.hearts} · bright blade ${run.furies}× · chimes ${run.chimes}${gentle ? ' · gentle foes' : ''}`,
      ...(def.seed ? [`This run: ${def.seed} (the same rooms and waves again: ?seed=${def.seed})`] : []),
    ] });
  }

  return {
    // The isometric fight stays on the floor (touch jump also feeds Space); the roll on the button printed B (rules.js rollInput)
    input(controls) { rollInput(controls, padFaces().faces); },
    /** (the checks: n more of this room's kinds at once, over the cap: the frame budget with a full crowd) */
    crowd(n = CROWD.cap) {
      const kinds = plan[run.room].flat().filter((q) => !q.tough);
      for (let i = 0; i < n; i++) queue.unshift({ ...kinds[i % kinds.length] });
      spawnT = 0; bringUp(0, Infinity);
      return mine.filter((f) => f.alive).length;
    },
    /** (the console, the checks: where the run is) */
    get run() { return { ...run, queue: queue.length, coming: pending.reduce((a, w) => a + w.items.length, 0), standing: mine.filter((f) => f.alive).length, source, seen: F.cuttables.filter((c) => c.k > 0.5).length, hazards: hz.count, hazardsOn: hz.active }; },
    /** (the checks: the run's own table, drawn from the theme: generate.js) */
    get def() { return def; },
    /** (the checks: the world's hazard, hazards.js) */
    get hazards() { return hz; },
    /** (the pictures, an engine plan's -pose: the `n` foes nearest him felled from where he stands: kill-fx.js's marks) */
    pose(n = 3) {
      const near = mine.filter((f) => f.alive).sort((a, b) => a.pos.distanceTo(player.pos) - b.pos.distanceTo(player.pos)).slice(0, typeof n === 'number' ? n : 3);
      for (const f of near) foes?.hurt?.(f, 'blade', _w.set(f.pos.x - player.pos.x + 1e-3, 0, f.pos.z - player.pos.z).normalize(), { damage: 99 });
      return near.length > 0;
    },
    /** (the checks: the ring round him in a crowd, self-mark.js; the framing toward a telegraph, view.js) */
    get self() { return selfMark; },
    get framed() { return { ...framed, tells: tells.length }; },
    /** (the checks: the kills' marks, kill-fx.js) */
    get kills() { return kills; },
    update(dt, inp, { live, raw, t: clockNow }) {
      t += dt;
      kills.update(dt);
      runClock = clockNow ?? t;   // (the runner's clock: the time the results show)
      // (no lock-on here: the aim takes the foe in its cone, and a lock would turn the view and the stick off the iso line)
      if (foes?.lock) foes.lock = null;
      aim(raw);
      // (on foot the stick walks him on the screen's axes: the rig's yaw is held on the iso line above)
      if (live && !over) {
        // RT / R2 (or G) alone fires a quick shot at the foe in the cone (the gun's own aim needs LT held)
        if (raw && !raw.PadAim && !raw.MouseRight && !raw.KeyR && (raw.PadFire || raw.KeyG)) raw.TouchFire = true;
        // a swing begun with no foe in reach goes the way you aim
        const blade = !!(raw?.PadBlade || raw?.KeyF || raw?.TouchBlade || raw?.MouseLeft);
        if (blade && !bladeHeld && !pick && source !== 'walk' && player.frame?.headingOf) player.heading = player.frame.headingOf(aimDir);
        bladeHeld = blade;
        // the foes of the wave: those a foe broke into are the wave's too
        for (const f of foes?.list ?? []) if (f.alive && !f.counted && !mine.includes(f)) { f.def = { ...f.def, sight: 80, giveUp: 1e9 }; f.state = 'chase'; mine.push(f); }
        for (const f of mine) if (f.alive && (f.state === 'idle' || f.state === 'home') && !player.dead) f.state = 'chase';
        for (const f of mine) if (f.alive && !f.def.hover && f.pos.y > 1.2) offTheTop(f);
        for (const f of mine) if (!f.alive && !f.counted) { f.counted = true; felled(f); }
        mine = mine.filter((f) => !f.counted);
        // (the hearts he lost, for the rank: whatever took them)
        const h = player.hearts ?? 0;
        if (h < heartsWas) run.lost += heartsWas - h;
        heartsWas = h;
        wellsUp(dt);
        openGeysers(dt);
        const here = roomAt(rooms, player.pos.x, player.pos.z, 1.0);
        if (run.phase === 'wait' && here === run.room) startWave();
        else if (run.phase === 'fight') { bringUp(dt); if (!queue.length && !pending.length && !mine.length) waveCleared(); }
        else if (run.phase === 'rest' && (restT -= dt) <= 0) startWave();
        else if (run.phase === 'reward' && reward) {
          rewardT += dt;
          const k = Math.min(1, rewardT / 1.6);
          reward.position.y = (F.altar?.y ?? 0) - 1.6 + 1.6 * (1 - (1 - k) ** 3);
          reward.lid.rotation.y += dt * 1.6; reward.ring.rotation.z += dt;
          if (k > 0.7 && Math.hypot(player.pos.x - reward.position.x, player.pos.z - reward.position.z) < 1.7) takeReward();
        }
        const left = queue.length + mine.length + pending.reduce((a, w) => a + w.items.length, 0);
        const extra = `${t - run.lastKill <= 2.5 && run.chain >= 3 ? ` · chain ×${run.chain}` : ''}${furyT > 0 ? ` · bright ${Math.ceil(furyT)} s` : ''}`;
        ctx.status(run.phase === 'fight' ? `${rooms[run.room].name} · ${left} left${extra}` : run.phase === 'rest' ? `Breathe · next wave in ${Math.max(0, restT).toFixed(1)} s`
          : run.phase === 'wait' ? `On to ${rooms[run.room].name}` : run.phase === 'reward' ? 'Take the reliquary' : '');
        if (player.dead) {
          over = true;
          ctx.finish({ failed: true, title: `${def.name} took you`, lines: [`Rooms cleared ${run.room} of ${rooms.length} · wave ${run.waveN} of ${run.waves} · foes felled ${run.kills} of ${run.total}`, `Gorged ${run.gorged} of ${run.gorgedOf} · longest chain ${run.bestChain} · chimes ${run.chimes}`, `A roll (${rollKey(padFaces().faces)}) takes you through a blow or ${HAZARD[rooms.find((r) => r.hazard)?.hazard.kind]?.word ?? 'a geyser'} unharmed.`, ...(def.seed ? [`This run: ${def.seed} (?seed=${def.seed} to try it again)`] : [])] });
        }
      }
      // the geysers filling and bursting, the world's hazard on its lanes, the shards and the fury, the last few marked
      geysersUp(dt);
      hz.update(dt, { fighting: live && !over && run.phase === 'fight' && !player.dead, room: run.room, last: lastWave() });
      shardsUp(dt);
      lastFew(dt);
      if (over && player.dead && (deadT += dt) > 1.2) player.restart?.();
      // the gates sink as their rooms are cleared (their colliders with them)
      F.gates.forEach((g) => {
        if (!g.open || g.sink >= 1) return;
        g.sink = Math.min(1, g.sink + dt / 1.4);
        g.group.position.y = -3.6 * g.sink * g.sink;
        g.group.userData.mark.visible = g.sink < 0.3;
      });
      // the hearts on the floor: they pop up, settle, bob, are drawn in and taken
      for (let i = hearts.length - 1; i >= 0; i--) {
        const h = hearts[i]; h.age += dt;
        h.vy -= 12 * dt; h.m.position.y = Math.max(0.55, h.m.position.y + h.vy * dt);
        if (h.m.position.y <= 0.55) h.vy = 0;
        h.m.gem.rotation.y += dt * 2.2; h.m.gem.position.y = Math.sin(h.age * 3) * 0.06; h.m.ring.position.y = -0.5;
        const dx = player.pos.x - h.m.position.x, dz = player.pos.z - h.m.position.z, d = Math.hypot(dx, dz);
        if (d < 2.4 && h.age > 0.5) { h.m.position.x += (dx / d) * Math.min(d, 7 * dt); h.m.position.z += (dz / d) * Math.min(d, 7 * dt); }
        if ((d < 0.8 && h.age > 0.4 && (player.hearts ?? 0) < (player.maxHearts ?? 3)) || h.age > 30) {
          if (h.age <= 30) { player.restore?.(1); run.hearts++; sound?.potionPickup?.(); words.pop(_v.copy(player.pos).setY(player.pos.y + 2), '+1 heart', 'gold', 0.9); }
          h.m.removeFromParent(); hearts.splice(i, 1);
        }
      }
      // in the rooms and their doorways: a jump onto a wall's top, or past a gate, puts him back on the floor
      if (!player.dead && !inHall(player.pos)) {
        const r = rooms[Math.max(0, roomAt(rooms, player.pos.x, player.pos.z, -1.5))] ?? rooms[run.room];
        player.pos.x = THREE.MathUtils.clamp(player.pos.x, r.x[0] + 0.4, r.x[1] - 0.4);
        player.pos.z = THREE.MathUtils.clamp(player.pos.z, r.z[0] + 0.4, r.z[1] - 0.4);
      }
      // the camera on its line (drawn toward a telegraph near him), the walls in the way seen through, the aim's marks,
      // the ring round him when the foes hide him
      tells = live && !over && run.phase === 'fight' ? telegraphs(hz.list, rooms, player.pos, filling, GEYSER.warn) : [];
      placeCamera(Math.min(dt, 0.1));
      seeThrough(dt);
      selfMark.update(dt, player, mine.filter((f) => f.alive && f.dead === undefined).map((f) => ({ pos: f.pos, radius: (f.def.radius ?? 0.5) * (f.gorged ? GORGED.scale : f.tough ? 1.12 : 1), height: f.def.height ?? 1 })), !live || over);
      const p = player.pos, y = 0.06;
      marks.chevron.position.set(p.x + aimDir.x * 1.1, y, p.z + aimDir.z * 1.1);
      marks.chevron.rotation.y = Math.atan2(aimDir.x, aimDir.z);
      const tgt = tool?.k > 0.3 ? gunPick ?? pick : pick;
      marks.target.visible = !!tgt && live;
      if (answerT >= 0 && (answerT += dt) > LOCK_ANSWER.secs) answerT = -1;
      const flashK = answerScale(answerT);
      if (tgt) { marks.target.position.set(tgt.pos.x, y + 0.01, tgt.pos.z); const s = Math.max(0.8, (tgt.def.radius ?? 0.6) * 1.3); marks.target.scale.setScalar(s * flashK); }
      marks.chevron.scale.setScalar(flashK);
      marks.reticle.visible = source === 'mouse' && live;
      if (source === 'mouse') { const u = screenUp(ISO, _v), r = screenRight(ISO, _w); marks.reticle.position.set(p.x + r.x * reticle.x + u.x * reticle.y, y, p.z + r.z * reticle.x + u.z * reticle.y); }
      marks.chevron.visible = live;
      words.update(dt);
    },
    end() {
      globalThis.removeEventListener?.('mousemove', onMouse);
      for (const f of foes?.list.slice() ?? []) foes.remove(f);
      if (foes) foes.lock = null;
      for (const h of hearts) h.m.removeFromParent();
      hearts.length = 0;
      for (const h of shards) h.m.removeFromParent();
      shards.length = 0;
      for (const f of mine) f.gorgedRing?.removeFromParent();
      for (const w of [...wells, ...geysers]) { w.busy = false; w.m.visible = false; }
      pending = []; filling.length = 0;
      hz.clear();
      kills.dispose();
      selfMark.dispose();
      tells = [];
      if (foes) { delete foes.lockAnswer; delete foes.extraWarn; }
      keepBlade();
      if (blade) blade.slashTones = null;
      movers.forEach((m) => m && physics?.removeCollider?.(m));
      for (const c of F.cuttables) setSee(c, 0);
      SEE_HOLE.value.set(0, -1e4, 0, SEE.radius);
      if (blade) { blade.roll = null; blade.wide = null; blade.quick = null; }
      if (tool) { tool.lockOn = lockOn0; if (aimOwn) tool.updateAimPoint = aimPoint0; else delete tool.updateAimPoint; }
      if (rig) { delete rig.yaw; if (yawWas) Object.defineProperty(rig, 'yaw', yawWas); else rig.yaw = yaw0; }
      globalThis.document?.body?.classList.remove('fight-iso');
      words.dispose();
      giveBack();
      if (foes && def.stage != null) foes.stage = stageWas;
      if (player.dead) player.restart?.();
    },
  };
}

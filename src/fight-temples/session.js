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
// a hand-cut edge opens in them round him, materials.js SEE_HOLE). B / ○ rolls (ROLL; jumping is disabled here), and the blade's cut
// takes every foe in a wider, longer cone (WIDE_CUT); both only here (issue #365).

import * as THREE from 'three';
import { makeMaterial, SEE_HOLE } from '../materials.js';
import { ROLL, WIDE_CUT } from '../fluid-blade.js';
import { FOES } from '../foes.js';
import { lendTool, standAt } from '../minigames/kit/onfoot.js';
import { WorldLabels } from '../minigames/kit/labels.js';
import { unlockColours, colourById, applyKitColours } from '../kit-colours.js';
import { reliquaryModel } from './rooms.js';
import {
  ISO, isoOffset, followIso, SEE, sightPoints, inTheWay, easeSee, seeOpen, AIM, pickTarget, stickToGround, screenUp, screenRight,
  roomAt, inRoom, roomWaves, release, CROWD, headOf, heartChance, chimesFor, pursesFor, totalFoes,
} from './rules.js';

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

export function startFightTemple(ctx) {
  const { player, camera, level, sfx, sound, tool, foes, rig, physics, state } = ctx;
  const F = level.fight, def = F.def, rooms = def.rooms;
  const gentle = foes?.difficulty === 'gentle';
  const giveBack = lendTool(tool, { mode: 'shoot' });   // (the save's own bar; the plain shot in hand, the push a press of X / D-pad → away)
  const spawn = new THREE.Vector3(...def.spawn);
  standAt(player, spawn, Math.PI, rig, ISO.yaw);
  const words = new WorldLabels(camera);
  const first = !state?.flag?.(`kit.colours.${def.colours}`);   // (the reward not won yet: the full loot)
  const plan = rooms.map((r) => roomWaves(r, { gentle, hpOf: (k) => FOES[k]?.hp ?? 2 }));
  const run = { room: 0, wave: -1, phase: 'wait', kills: 0, chain: 0, lastKill: -99, bestChain: 0, hearts: 0, chimes: 0, total: totalFoes(def, { gentle }) };
  let t = 0, queue = [], mine = [], spawnT = 0, restT = 0, over = false, deadT = 0, reward = null, rewardT = 0;
  const hearts = [];
  globalThis.document?.body?.classList.add('fight-iso');

  // ---------------------------------------------------------------- the camera: the rig's yaw held on the iso line
  const yawWas = Object.getOwnPropertyDescriptor(rig ?? {}, 'yaw'), yaw0 = rig?.yaw;
  if (rig) Object.defineProperty(rig, 'yaw', { get: () => ISO.yaw, set: () => {}, configurable: true });
  ctx.setFov(ISO.fov);
  const look = player.pos.clone().setY(player.pos.y + ISO.look);
  const offset = isoOffset(ISO, new THREE.Vector3());
  function placeCamera(dt) {
    followIso(look, player.pos, player.vel, dt);
    camera.position.copy(look).add(offset);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    camera.updateMatrixWorld();
  }
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
  if (blade) { blade.roll = ROLL; blade.wide = WIDE_CUT; }

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
    spawnT = 0.2;
    const last = run.room === rooms.length - 1 && run.wave === plan[run.room].length - 1;
    ctx.flash(last ? 'The last of them' : `${rooms[run.room].name} · wave ${run.wave + 1} of ${plan[run.room].length}`, last ? 'bad big' : 'big', 1.8);
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
    const standing = mine.filter((f) => f.alive).reduce((a, f) => a + headOf(f.kind), 0);
    const n = release(queue, standing, cap, cap === Infinity ? queue.length : CROWD.burst);
    const S = springsFor(run.room);
    for (let i = 0; i < n; i++) {
      const q = queue.shift(), s = S[i % Math.min(S.length, 3)] ?? spawn;
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.8;
      const at = new THREE.Vector3(s.x + Math.cos(a) * r, 0, s.z + Math.sin(a) * r);
      const f = foes?.add(q.kind, at);
      if (!f) continue;
      f.hp = q.hp; f.light = !q.tough; f.tough = q.tough;
      // (it sees the whole room and keeps after you; no high ground to hold (the pillars' tops); a light one strikes half as hard)
      f.def = { ...f.def, sight: 80, giveUp: 1e9, perch: false, clamber: false, ...(q.tough ? {} : { attacks: f.def.attacks.map((a) => ({ ...a, damage: (a.damage ?? 1) * LIGHT_HARM })) }) };
      if (!q.tough) { f.def.attack = f.def.attacks[0]; f.atk = f.def.attack; }
      f.state = 'chase'; f.cool = 0.8 + Math.random() * 0.8;
      if (q.tough) f.model.group.scale.multiplyScalar(1.12);
      mine.push(f);
      splash(s);
    }
  }
  /** A walker that got up onto a pillar's top (a hop, a leap) is put down beside it: the fight is on the floor. */
  function offTheTop(f) {
    for (const c of F.cuttables) {
      if (c.kind !== 'pillar') continue;
      const cx = (c.box.min.x + c.box.max.x) / 2, cz = (c.box.min.z + c.box.max.z) / 2, dx = f.pos.x - cx, dz = f.pos.z - cz, d = Math.hypot(dx, dz);
      if (d > 1.3) continue;
      const k = d > 1e-3 ? 1.6 / d : 1;
      f.pos.set(cx + (d > 1e-3 ? dx : 1) * k, 0, cz + (d > 1e-3 ? dz : 0) * k);
      f.model.group.position.copy(f.pos);
      return;
    }
  }
  function splash(s) {
    const tones = [def.palette.ink, def.palette.inkLite, '#6d4fa8'];
    for (let i = 0; i < 10; i++) tool?.drops?.add({ pos: _v.set(s.x, 0.3, s.z), vel: _w.set((Math.random() - 0.5) * 3, 3 + Math.random() * 4, (Math.random() - 0.5) * 3), drag: 1.5, grav: 12, size: 0.05 + Math.random() * 0.05, stretch: 2, life: 0.5 + Math.random() * 0.4, color: tones[i % 3] });
  }
  function felled(f) {
    run.kills++;
    run.chain = t - run.lastKill <= 2.5 ? run.chain + 1 : 1;
    run.lastKill = t;
    run.bestChain = Math.max(run.bestChain, run.chain);
    if (run.chain >= 3 && run.chain % 5 === 0) words.pop(_v.copy(f.pos).setY(f.pos.y + 1.8), `chain ×${run.chain}`, 'combo', 1.0);
    // the loot: a heart now and then (more when you are hurt), a chime from a light one now and then, more from a tough one
    if (Math.random() < heartChance(player.hearts ?? 3, player.maxHearts ?? 3)) dropHeart(f.pos);
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
    ctx.finish({ title: `${def.name} cleared`, lines: [
      fresh ? `New colours: ${pal.name}, for the backpack, the sword and the shield. Wearing them now; change them in Items.` : `${pal.name}: yours already (Items, Colours)`,
      `Foes felled ${run.kills} · longest chain ${run.bestChain}`,
      `Hearts found ${run.hearts} · chimes ${run.chimes}${gentle ? ' · gentle foes' : ''}`,
    ] });
  }

  return {
    // The isometric fight stays on the floor. Touch jump also feeds Space; leave evade inputs alone.
    input(controls) {
      controls.Space = false;
      controls.PadJump = false;
    },
    /** (the checks: n more of this room's kinds at once, over the cap: the frame budget with a full crowd) */
    crowd(n = CROWD.cap) {
      const kinds = plan[run.room].flat().filter((q) => !q.tough);
      for (let i = 0; i < n; i++) queue.unshift({ ...kinds[i % kinds.length] });
      spawnT = 0; bringUp(0, Infinity);
      return mine.filter((f) => f.alive).length;
    },
    /** (the console, the checks: where the run is) */
    get run() { return { ...run, queue: queue.length, standing: mine.filter((f) => f.alive).length, source, seen: F.cuttables.filter((c) => c.k > 0.5).length }; },
    update(dt, inp, { live, raw }) {
      t += dt;
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
        const here = roomAt(rooms, player.pos.x, player.pos.z, 1.0);
        if (run.phase === 'wait' && here === run.room) startWave();
        else if (run.phase === 'fight') { bringUp(dt); if (!queue.length && !mine.length) waveCleared(); }
        else if (run.phase === 'rest' && (restT -= dt) <= 0) startWave();
        else if (run.phase === 'reward' && reward) {
          rewardT += dt;
          const k = Math.min(1, rewardT / 1.6);
          reward.position.y = (F.altar?.y ?? 0) - 1.6 + 1.6 * (1 - (1 - k) ** 3);
          reward.lid.rotation.y += dt * 1.6; reward.ring.rotation.z += dt;
          if (k > 0.7 && Math.hypot(player.pos.x - reward.position.x, player.pos.z - reward.position.z) < 1.7) takeReward();
        }
        const left = queue.length + mine.length;
        ctx.status(run.phase === 'fight' ? `${rooms[run.room].name} · ${left} left` : run.phase === 'rest' ? `Breathe · next wave in ${Math.max(0, restT).toFixed(1)} s`
          : run.phase === 'wait' ? `On to ${rooms[run.room].name}` : run.phase === 'reward' ? 'Take the reliquary' : '');
        if (player.dead) {
          over = true;
          ctx.finish({ failed: true, title: `${def.name} took you`, lines: [`Rooms cleared ${run.room} of ${rooms.length} · foes felled ${run.kills} of ${run.total}`, `Longest chain ${run.bestChain} · chimes ${run.chimes}`] });
        }
      }
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
      // the camera on its line, the walls in the way seen through, the aim's marks
      placeCamera(Math.min(dt, 0.1));
      seeThrough(dt);
      const p = player.pos, y = 0.06;
      marks.chevron.position.set(p.x + aimDir.x * 1.1, y, p.z + aimDir.z * 1.1);
      marks.chevron.rotation.y = Math.atan2(aimDir.x, aimDir.z);
      const tgt = tool?.k > 0.3 ? gunPick ?? pick : pick;
      marks.target.visible = !!tgt && live;
      if (tgt) { marks.target.position.set(tgt.pos.x, y + 0.01, tgt.pos.z); const s = Math.max(0.8, (tgt.def.radius ?? 0.6) * 1.3); marks.target.scale.setScalar(s); }
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
      movers.forEach((m) => m && physics?.removeCollider?.(m));
      for (const c of F.cuttables) setSee(c, 0);
      SEE_HOLE.value.set(0, -1e4, 0, SEE.radius);
      if (blade) { blade.roll = null; blade.wide = null; }
      if (tool) { tool.lockOn = lockOn0; if (aimOwn) tool.updateAimPoint = aimPoint0; else delete tool.updateAimPoint; }
      if (rig) { delete rig.yaw; if (yawWas) Object.defineProperty(rig, 'yaw', yawWas); else rig.yaw = yaw0; }
      globalThis.document?.body?.classList.remove('fight-iso');
      words.dispose();
      giveBack();
      if (player.dead) player.restart?.();
    },
  };
}

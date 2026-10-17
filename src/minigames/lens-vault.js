// The Lens Vault (issue #382, docs/systems/minigames.md "The Lens Vault"): a test of another way to play, through the
// traveller's own eyes, as an exploring shooter in the manner of Metroid Prime. Four rooms of a makers' vault (the
// temples' kit), the fluid glove seen from his eyes as an arm that shoots (a press a bolt, held a charged one), the lock
// on LT / L2 that turns the view onto a foe and makes the stick circle-strafe round it, and the lens (Y / △): what it is
// held on it reads, a line in the game's voice; it reads the sealed door's lock open. Doors open to a shot (the heavy
// one to a charged shot only); the last room's two waves end the run. Score: the time.
//
// Played on foot (drives: false): the traveller walks, jumps and is hurt as ever, hidden; the session takes the buttons
// before he and the tool read them (input), keeps its own look (the rig's look turned to the eye's), and puts the camera
// in his eyes after the rig. The rules are pure in lens-vault-rules.js; the rooms lens-vault-level.js; the arm
// lens-vault-arm.js; the visor's HUD lens-vault-hud.js (the screen's 'visor' part: an engine draws it).

import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { page, screen } from '../platform.js';
import { stripTone } from '../story/tone.js';
import { hurtRadius } from '../foes.js';
import { buildVault, RING } from './lens-vault-level.js';
import { armModel, placeArm, kickArm } from './lens-vault-arm.js';
import { visorPart, drawVisor, NO_CANVAS } from './lens-vault-hud.js';
import { FPS, ROOMS, LENS, START, anglesOf, lookDir, triggerStep, pickLock, scanStep, doorTakes, bob, segPoint, segBox, resultLines, wrap } from './lens-vault-rules.js';
import { standAt } from './kit/onfoot.js';

/** The buttons the session takes for itself before the traveller and the tool read them (the blade, the guard, the evade, the gun's, the gadgets'). */
export const TAKEN = ['PadAim', 'PadFire', 'PadThrust', 'PadBlade', 'PadGuard', 'PadEvade', 'PadModeNext', 'PadWhistle', 'PadGadgetPick', 'PadE', 'KeyE',
  'MouseLeft', 'MouseRight', 'MouseMiddle', 'KeyF', 'KeyG', 'KeyR', 'KeyX', 'KeyZ', 'KeyC', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'TouchFire', 'TouchBlade', 'TouchGuard', 'TouchEvade'];
/** The buttons it reads: fire (hold to charge), the lock, the lens. */
export function readButtons(c = {}) {
  return {
    fire: !!(c.PadFire || c.MouseLeft || c.KeyG || c.TouchFire || +c.PadThrust > 0.5),
    lock: !!(c.PadAim || c.MouseRight || c.KeyR),
    lens: !!(c.PadWhistle || c.KeyF || c.KeyX),
  };
}

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _v = V3(), _w = V3(), _d = V3(), _p = V3(), _e = V3(), _to = V3();

/** Which room a point is in (its index), or -1 (a passage). */
export function roomAt(p) {
  for (const [i, R] of ROOMS.entries()) {
    if (R.round) { if (Math.hypot(p.x - R.x, p.z - R.z) < R.r) return i; continue; }
    if (Math.abs(p.x - R.x) < R.w / 2 && Math.abs(p.z - R.z) < R.d / 2) return i;
  }
  return -1;
}

function start(ctx) {
  const { player, camera, level, sfx, sound, tool, foes, rig, physics, scene } = ctx;
  const VA = level.vault;
  standAt(player, V3(START.x, 0, START.z), 0, rig, Math.PI);
  const S = {
    yaw: Math.PI, pitch: 0.04, mode: 'arm', lock: null, lockWas: false, phase: 0,
    trig: { held: false, heldT: 0, charge: 0, cool: 0 }, scan: { id: null, k: 0 }, readSet: new Set(),
    reading: null, readT: 0, readN: 0, red: 0, hearts: player.hearts, lensWas: false, auto: null, pointer: 'none', said: new Set(),
  };
  const run = { shots: 0, hits: 0, charged: 0, kills: 0, total: ROOMS.reduce((n, R) => n + R.foes.length + (R.then?.length ?? 0), 0), read: 0, readable: Object.keys(LENS).length, room: -1, woke: new Set(), wave2: false, over: false };
  const B = { fire: false, lock: false, lens: false };
  let t = 0, deadT = 0, mine = [];

  // ---------------------------------------------------------------- the eye's look (the rig's turned to it)
  const look0 = rig?.look, lookOwn = !!rig && Object.hasOwn(rig, 'look');
  if (rig) rig.look = (dx, dy) => {
    if (S.lock || run.over) return;
    const k = 0.0025 * (rig.sensitivity ?? 1);
    S.yaw -= dx * k;
    S.pitch = THREE.MathUtils.clamp(S.pitch + dy * k * (rig.invertY ? -1 : 1), -FPS.pitch, FPS.pitch);
  };
  // (the pointer captured from a click, as ever, but a refusal is heard: then the look is a drag)
  const dom = typeof document !== 'undefined' ? [...(document.body?.children ?? [])].find((e) => e.tagName === 'CANVAS') : null;
  const lockReq = dom?.requestPointerLock, reqOwn = !!dom && Object.hasOwn(dom, 'requestPointerLock');
  const refused = () => { S.pointer = 'refused'; };
  if (dom && lockReq) dom.requestPointerLock = function (...a) {
    try { const p = lockReq.apply(this, a); p?.catch?.(refused); return p; } catch { refused(); return undefined; }
  };
  const offErr = page.on('pointerlockerror', refused);
  globalThis.document?.addEventListener?.('pointerlockerror', refused);
  globalThis.document?.body?.classList.add('lens-vault');

  // ---------------------------------------------------------------- what is drawn: the arm, the bolts, the visor
  const arm = ctx.add(armModel());
  const boltMat = makeMaterial({ color: '#bff3ec', flat: true, glow: 0.95, key: 'lensvault.bolt' });
  const chargedMat = makeMaterial({ color: '#f6e7a0', flat: true, glow: 0.95, key: 'lensvault.bolt.charged' });
  const boltGeo = new THREE.SphereGeometry(1, 10, 8);
  const pool = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(boltGeo, boltMat); m.visible = false; m.userData.noCollide = true; m.frustumCulled = false; return ctx.add(m); });
  const bolts = [];
  const root = typeof document !== 'undefined' ? document.getElementById('minigame') ?? document.body : null;
  const cv = root && typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (cv) { cv.className = 'lens-visor'; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; root.prepend(cv); }
  const style = typeof document !== 'undefined' ? document.createElement('style') : null;
  if (style) { style.textContent = 'body.lens-vault #tool, body.lens-vault #stamina, body.lens-vault #health { display: none !important; }'; document.head.appendChild(style); }

  // ---------------------------------------------------------------- the doors (movers: they rise into their lintels)
  const doors = VA.doors.map(({ def, group }) => {
    group.position.y = 0; group.updateMatrixWorld(true);
    for (const m of group.userData.lit) m.visible = true;
    return { def, group, open: false, k: 0, mover: physics?.addMover?.(group, { all: true }) ?? null };
  });
  if (VA.lock) { VA.lock.eye.color?.set?.(RING.sealed); VA.lock.ball.material = makeMaterial({ color: RING.sealed, flat: true, glow: 0.9, key: 'lensvault.eye' }); }
  const doorBox = (d) => ({ min: { x: d.def.x - d.def.w / 2, y: 0, z: d.def.z - 0.3 }, max: { x: d.def.x + d.def.w / 2, y: d.def.h, z: d.def.z + 0.3 } });
  /** The room behind a door is still fought: its ring dark until they are down. */
  const holding = (d) => mine.some((f) => f.alive && f.room === d.def.from);
  function openDoor(d, how = '') {
    if (d.open) return;
    d.open = true;
    sfx.gate?.(); sound?.chime?.();
    const c = _v.set(d.def.x, d.def.h * 0.55, d.def.z);
    for (let i = 0; i < 18; i++) tool?.glow?.add({ pos: c, vel: _w.randomDirection().multiplyScalar(2.2), drag: 2, size: 0.08, life: 0.6, color: RING[d.def.kind], grow: true });
    if (how) ctx.flash(how, 'good', 1.4);
  }

  // ---------------------------------------------------------------- the foes of a room, woken as he walks in
  function wake(ri, list) {
    for (const [i, [kind, x, z]] of list.entries()) {
      const at = V3(x, 0, z);
      const f = foes?.add(kind, at);
      if (!f) continue;
      f.def = { ...f.def, sight: 45, giveUp: 1e9 };
      f.state = 'chase'; f.cool = 1.2 + i * 0.35; f.room = ri;
      mine.push(f);
      for (let k = 0; k < 16; k++) tool?.drops?.add({ pos: _v.set(x, 0.4, z), vel: _w.set((Math.random() - 0.5) * 3, 2.5 + Math.random() * 4, (Math.random() - 0.5) * 3), drag: 1.5, grav: 12, size: 0.05, stretch: 2, life: 0.6, color: k % 2 ? '#2a2440' : '#4a3d6e' });
      tool?.rings?.add({ from: _v.set(x, 0.1, z), dir: _w.set(0, 1, 0), r0: 0.3, r1: 2.0, life: 0.5, color: '#6d4fa8', thick: 1.4 });
    }
    if (list.length) { sound?.foeWarn?.('machine'); sfx.whoosh?.(); }
  }
  function entered(ri) {
    if (run.woke.has(ri)) return;
    run.woke.add(ri);
    const R = ROOMS[ri];
    ctx.flash(R.name, 'big', 1.6);
    wake(ri, R.foes);
  }

  // ---------------------------------------------------------------- the lens: what it can read
  const things = Object.entries(LENS).map(([id, L]) => {
    const d = L.door ? doors.find((x) => x.def.id === L.door) : null;
    return { id, L, door: d, pos: d ? V3(d.def.x, d.def.h * 0.55, d.def.z - 0.3) : L.at ? V3(...L.at) : null };
  }).filter((x) => x.pos);
  const lensOf = (f) => (LENS[f.kind] ? f.kind : null);
  function seen(eye, p, slack = 0.6) {
    const d = _d.subVectors(p, eye), L = d.length();
    if (!physics?.rayDistance || L < 0.5) return true;
    return physics.rayDistance(eye, d.divideScalar(L), L) >= L - slack;
  }
  function read(id) {
    const L = LENS[id];
    run.read = S.readSet.size;
    S.reading = { name: L.name, text: stripTone(L.line), on: true, n: ++S.readN };
    S.readT = FPS.readFor;
    sound?.chime?.(); sfx.coin?.(1);
    if (L.opens) {
      const d = doors.find((x) => x.def.id === L.opens);
      // (read while the room is still fought: it opens once they are down)
      if (d) { d.pending = true; if (VA.lock) VA.lock.ball.material = makeMaterial({ color: RING.shot, flat: true, glow: 0.9, key: 'lensvault.eye.read' }); }
    }
  }
  function say(id, text, kind = '') { if (S.said.has(id)) return; S.said.add(id); ctx.flash(text, kind, 1.8); }

  // ---------------------------------------------------------------- the bolts
  function fire(kind, from, dir) {
    const m = pool.find((x) => !x.visible) ?? pool[0];
    const charged = kind === 'charged';
    m.material = charged ? chargedMat : boltMat;
    m.visible = true; m.scale.setScalar(charged ? 0.26 : 0.09); m.position.copy(from);
    const b = bolts.find((x) => x.m === m);
    if (b) bolts.splice(bolts.indexOf(b), 1);
    bolts.push({ m, pos: from.clone(), vel: dir.clone().multiplyScalar(charged ? FPS.chargedSpeed : FPS.speed), life: FPS.life, charged });
    run.shots++; if (charged) run.charged++;
    kickArm(arm, charged ? 1.6 : 1);
    sound?.fluidShoot?.(charged ? 'fire' : 'shoot');
    ctx.kick?.(charged ? 0.25 : 0.06);
    const tones = charged ? ['#f6e7a0', '#f2c54b', '#bff3ec'] : ['#72d5bf', '#bff3ec'];
    for (let i = 0; i < (charged ? 16 : 6); i++) tool?.drops?.add({ pos: from, vel: _w.copy(dir).multiplyScalar(3 + i).add(_e.randomDirection().multiplyScalar(1.2)), drag: 6, grav: 4, size: 0.02, life: 0.3, color: tones[i % tones.length] });
  }
  function splash(at, normal, charged) {
    const tones = charged ? ['#f6e7a0', '#f2c54b', '#bff3ec'] : ['#72d5bf', '#bff3ec', '#e8ef9b'];
    for (let i = 0; i < (charged ? 26 : 10); i++) tool?.drops?.add({ pos: at, vel: _w.randomDirection().addScaledVector(normal, 1.2).normalize().multiplyScalar(2 + Math.random() * (charged ? 6 : 4)), drag: 2.4, grav: 9, size: 0.03 + Math.random() * 0.03, stretch: 2.2, life: 0.4 + Math.random() * 0.3, color: tones[i % tones.length] });
    tool?.rings?.add({ from: at, dir: normal, reach: 0.02, r0: 0.1, r1: charged ? 1.6 : 0.6, life: 0.35, color: tones[0], thick: 1 });
  }
  function stepBolts(dt) {
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= dt;
      const from = _p.copy(b.pos), to = _to.copy(b.pos).addScaledVector(b.vel, dt);
      const r = b.charged ? FPS.chargedR : FPS.r;
      let best = null;
      for (const d of doors) {
        if (d.open && d.k > 0.4) continue;
        const u = segBox(from, to, doorBox(d), r * 0.5);
        if (u != null && (!best || u < best.u)) best = { u, door: d };
      }
      for (const f of mine) {
        if (!f.alive || f.dead !== undefined) continue;
        const q = segPoint(from, to, f.chest);
        if (q.d < hurtRadius(f.def) + r && (!best || q.t < best.u)) best = { u: q.t, foe: f };
      }
      const L = from.distanceTo(to), dir = _d.subVectors(to, from).normalize();
      const wall = physics?.rayDistance && L > 0 ? physics.rayDistance(from, dir, L) : Infinity;
      // (a door is in the bake's movers too: the wall's hit is the door's own unless it is clearly nearer)
      if (wall < L && (!best || wall / L < best.u - (best.door ? 0.5 / Math.max(L, 1e-3) : 0))) best = { u: wall / L, wall: true };
      if (best) {
        const at = from.clone().lerp(to, best.u), normal = dir.clone().negate();
        splash(at, normal, b.charged);
        if (best.foe) {
          run.hits++;
          foes.hurt(best.foe, 'blade', dir.clone(), { damage: b.charged ? FPS.chargedDamage : FPS.damage, source: 'cannon', breaks: b.charged, combo: b.charged ? 2 : 0 });
        } else if (best.door) {
          const d = best.door;
          if (holding(d)) say(`hold.${d.def.id}`, 'Not while they’re about.', 'bad');
          else if (doorTakes(d.def, b.charged ? 'charged' : 'plain')) { run.hits++; openDoor(d); }
          else if (d.def.kind === 'charge') say('door3', 'It only splashes. Hold the trigger, let it build.', 'bad');
          else if (d.def.kind === 'sealed') say('door2', 'Sealed. Read the lock beside it: Y / △, the lens.', 'bad');
        }
        b.m.visible = false; bolts.splice(i, 1); continue;
      }
      b.pos.copy(to); b.m.position.copy(to);
      if (b.life <= 0) { b.m.visible = false; bolts.splice(i, 1); continue; }
      if (Math.random() < (b.charged ? 0.9 : 0.4)) tool?.drops?.add({ pos: b.pos, vel: _w.randomDirection().multiplyScalar(0.4), drag: 3, grav: 1, size: b.charged ? 0.05 : 0.025, life: 0.25, color: b.charged ? '#f2c54b' : '#72d5bf' });
    }
  }

  // ---------------------------------------------------------------- the camera in his eyes
  const eye = V3();
  function eyeAt(dt) {
    const hs = Math.hypot(player.vel?.x ?? 0, player.vel?.z ?? 0);
    if (player.onGround) S.phase += (hs * dt) / FPS.bob.step;
    const bb = bob(S.phase, player.onGround ? hs : 0);
    eye.set(player.pos.x, player.pos.y + FPS.eye, player.pos.z);
    camera.rotation.set(-S.pitch, S.yaw, 0, 'YXZ');
    camera.up.set(0, 1, 0);
    camera.position.copy(eye);
    _w.set(bb.x, bb.y, 0).applyQuaternion(camera.quaternion);
    camera.position.add(_w);
    camera.updateMatrixWorld();
    return bb;
  }
  const project = (p) => {
    _e.copy(p).project(camera);
    const W = globalThis.innerWidth ?? 1280, H = globalThis.innerHeight ?? 720;
    return { x: (_e.x * 0.5 + 0.5) * W, y: (-_e.y * 0.5 + 0.5) * H, front: _e.z < 1 && _e.z > -1 && Math.abs(_e.x) < 1.1 && Math.abs(_e.y) < 1.1 };
  };

  // ---------------------------------------------------------------- the visor
  function drawHud() {
    const W = globalThis.innerWidth ?? 1280, H = globalThis.innerHeight ?? 720;
    let lock = null;
    if (S.lock) {
      const p = S.lock.pos(), q = project(p);
      if (q.front) { const d = Math.max(1, p.distanceTo(camera.position)); lock = { x: q.x, y: q.y, r: (S.lock.r * H) / (d * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) + 8 }; }
    }
    const marks = [];
    if (S.mode === 'lens') {
      for (const x of things) {
        if (x.door?.open) continue;
        if (x.pos.distanceTo(camera.position) > FPS.scanRange) continue;
        const q = project(x.pos); if (q.front) marks.push({ x: q.x, y: q.y - 18, read: S.readSet.has(x.id) });
      }
      for (const f of mine) {
        if (!f.alive || f.dead !== undefined || !lensOf(f)) continue;
        const q = project(_v.copy(f.chest).setY(f.chest.y + (f.def.height ?? 0.6) * 0.6 + 0.3)); if (q.front) marks.push({ x: q.x, y: q.y, read: S.readSet.has(lensOf(f)) });
      }
    }
    const hint = S.pointer === 'refused' ? 'The pointer was refused: drag to look' : '';
    const M = { ...visorPart(W, H, { mode: S.mode, hearts: player.hearts, max: player.maxHearts, charge: S.mode === 'arm' ? S.trig.charge : 0, lock, marks, scan: S.scan.k, read: S.reading, red: S.red, room: run.room >= 0 ? ROOMS[run.room].name : '' }), hint };
    if (cv) {
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const g = page.drawsHud() ? cv.getContext('2d') : NO_CANVAS;
      g.setTransform?.(dpr, 0, 0, dpr, 0, 0);
      drawVisor(g, M);
      if (hint && page.drawsHud()) { g.font = `13px 'Avenir Next', sans-serif`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#2b211f'; g.strokeText(hint, W / 2, H / 2 + 44); g.fillStyle = '#f7ecd2'; g.fillText(hint, W / 2, H / 2 + 44); }
    }
    screen.set('visor', M);
  }

  function finishRun(failed) {
    if (run.over) return;
    run.over = true;
    run.read = S.readSet.size;
    S.lock = null;
    if (failed) ctx.finish({ failed: true, title: 'The vault keeps you out', lines: [`Rooms reached ${run.woke.size} of ${ROOMS.length}`, ...resultLines(run), 'Lock on (LT / L2) and the stick circles the foe: keep moving.'] });
    else ctx.finish({ title: 'The vault is quiet', lines: resultLines(run) });
  }

  ctx.setScore(0);
  const session = {
    S, run, doors, things,
    get mine() { return mine; },
    /** The buttons, before the traveller and the tool read them: the session's own taken out. */
    input(c) {
      const r = readButtons(c);
      B.fire = r.fire || !!S.auto?.fire; B.lock = r.lock || !!S.auto?.lock;
      const lens = r.lens || !!S.auto?.lens;
      B.lensPress = lens && !S.lensWas; S.lensWas = lens;
      for (const k of TAKEN) if (c[k]) c[k] = false;
      if (foes) foes.lock = null;
      // locked on: the traveller's own strafe round the foe (src/player.js orbitLock), and his hop to its side on A / ×
      const L = S.lock;
      if (L && !run.over) {
        const p = L.pos();
        const lk = (player._lockOn ??= { dir: V3() });
        lk.dir.set(p.x - player.pos.x, 0, p.z - player.pos.z);
        if (lk.dir.lengthSq() > 1e-6) { lk.dir.normalize(); (lk.at ??= V3()).copy(p); (lk.hop ??= V3()).copy(lk.dir); player.lockOn = lk; } else player.lockOn = null;
      } else player.lockOn = null;
    },
    update(dt, inp, { live }) {
      t += dt;
      ctx.setFov(FPS.fov);
      if (player.object) player.object.visible = false;
      // the lens up or down
      if (live && B.lensPress && !run.over) {
        S.mode = S.mode === 'arm' ? 'lens' : 'arm';
        S.trig.charge = 0; S.trig.held = false; S.scan.k = 0;
        sound?.uiTick?.(); sfx.tick?.(1);
      }
      B.lensPress = false;
      // the lock: held on what is nearest the middle of the view (the lens's things too, with the lens up)
      const eyeNow = V3(player.pos.x, player.pos.y + FPS.eye, player.pos.z), dirNow = lookDir(S.yaw, S.pitch, V3());
      if (live && B.lock && !run.over) {
        if (S.lock && !S.lock.ok()) S.lock = null;
        if (!S.lock && !S.lockWas) {
          const cand = mine.filter((f) => f.alive && f.dead === undefined).map((f) => ({ id: f, pos: f.chest, seen: seen(eyeNow, f.chest) }));
          if (S.mode === 'lens') for (const x of things) if (!x.door?.open) cand.push({ id: x, pos: x.pos, seen: seen(eyeNow, x.pos, 1.2) });
          const c = pickLock(eyeNow, dirNow, cand);
          if (c?.id?.chest) { const f = c.id; S.lock = { foe: f, pos: () => f.chest, ok: () => f.alive && f.dead === undefined && f.chest.distanceTo(player.pos) < FPS.lockRange + 6, r: hurtRadius(f.def), lens: lensOf(f) }; }
          else if (c) { const x = c.id; S.lock = { thing: x, pos: () => x.pos, ok: () => !x.door?.open, r: x.L.r ?? 1.4, lens: x.id }; }
          if (S.lock) sound?.lockOn?.();
        }
        S.lockWas = true;
      } else { S.lock = null; S.lockWas = false; }
      // the view: the stick's and the pointer's (rig.look), or swung onto the lock
      if (S.lock) {
        const want = anglesOf(_v.subVectors(S.lock.pos(), eyeNow));
        const k = 1 - Math.exp(-FPS.lockTurn * dt);
        S.yaw += wrap(want.yaw - S.yaw) * k;
        S.pitch += (THREE.MathUtils.clamp(want.pitch, -FPS.pitch, FPS.pitch) - S.pitch) * k;
      }
      if (rig) { rig.yaw = S.yaw; rig.target?.copy(player.pos); }
      const bb = eyeAt(dt);
      // the arm: fires (the lens down), charges; the lens reads what it is held on
      const mouth = placeArm(arm, camera, { bob: bb, charge: S.mode === 'arm' ? S.trig.charge : 0, t, visor: S.mode, dt }, V3());
      if (S.mode === 'arm') {
        const shot = triggerStep(S.trig, live && B.fire && !run.over, dt);
        if (shot) {
          // straight from the mouth to what the reticle is on (the lock's foe, or the world FPS.lockRange out)
          const aimAt = S.lock ? S.lock.pos().clone() : (() => {
            const far = physics?.rayDistance ? Math.min(60, physics.rayDistance(camera.position, lookDir(S.yaw, S.pitch, _d), 60)) : 30;
            return camera.position.clone().addScaledVector(lookDir(S.yaw, S.pitch, _d), Math.max(2, far));
          })();
          fire(shot, mouth, aimAt.sub(mouth).normalize());
        }
        S.scan.k = 0;
      } else {
        triggerStep(S.trig, false, dt);
        let id = S.lock?.lens ?? null;
        if (!id) {
          const cand = things.filter((x) => !x.door?.open).map((x) => ({ id: x.id, pos: x.pos }));
          for (const f of mine) if (f.alive && f.dead === undefined && lensOf(f)) cand.push({ id: lensOf(f), pos: f.chest });
          id = pickLock(eyeNow, dirNow, cand, { cone: FPS.scanCone, range: FPS.scanRange })?.id ?? null;
        }
        const got = scanStep(S.scan, id, live && B.fire && !run.over, dt, S.readSet);
        if (got) read(got);
      }
      if (S.readT > 0 && (S.readT -= dt) <= 0 && S.reading) S.reading = { ...S.reading, on: false };
      stepBolts(dt);
      // the doors rise; a room behind one still fought keeps its ring dark
      for (const d of doors) {
        const hold = holding(d) && !d.open;
        if (d.pending && !d.open) { if (hold) say(`hold.${d.def.id}`, 'Not while they’re about.', 'bad'); else openDoor(d, 'The lock has read you. It opens.'); }
        for (const m of d.group.userData.lit) m.visible = !hold || (d.def.kind === 'sealed');
        if (!d.open || d.k >= 1) continue;
        d.k = Math.min(1, d.k + dt / 0.6);
        d.group.position.y = (d.def.h + 0.4) * (1 - (1 - d.k) ** 3);
        d.group.updateMatrixWorld(true);
      }
      if (live && !run.over) {
        // which room: walked into, its foes wake
        const ri = roomAt(player.pos);
        if (ri >= 0 && ri !== run.room) { run.room = ri; entered(ri); }
        // the felled counted
        for (const f of mine) if (!f.alive && !f.counted) { f.counted = true; run.kills++; }
        const R = ROOMS[3], left = (ri2) => mine.filter((f) => f.alive && f.room === ri2).length;
        if (run.woke.has(3) && !run.wave2 && !left(3)) { run.wave2 = true; ctx.flash('The lamps wake.', 'big', 1.6); wake(3, R.then); }
        else if (run.wave2 && !left(3)) finishRun(false);
        if (run.room >= 0) ctx.status(`${ROOMS[run.room].name}${left(run.room) ? ` · ${left(run.room)} left` : ''}`);
        if (player.dead) finishRun(true);
        // first steps: the lens taught by the door it opens
        if (t > 4 && !S.said.has('lens') && S.readSet.size === 0) say('lens', 'Y / △: the lens. Hold RT / R2 on a thing to read it.');
      }
      if (run.over && player.dead && (deadT += dt) > 1.2) player.restart?.();
      // hurt: the visor's edges flare
      if (player.hearts < S.hearts - 1e-6) S.red = 1;
      S.hearts = player.hearts;
      S.red = Math.max(0, S.red - dt * 2.2);
      drawHud();
    },
    /** A moment for the pictures (the bridge's -pose, the web's comparison): the lens up on the mark, the lock, the charge. */
    pose(kind = 'lens') {
      if (kind === 'lens' || kind === 'on') { S.mode = 'lens'; S.readSet.add('mark'); read('mark'); }
      else if (kind === 'charge') { S.mode = 'arm'; S.trig.held = true; S.trig.charge = 1; }
      else return false;
      return true;
    },
    end() {
      for (const d of doors) { if (d.mover) physics?.removeCollider?.(d.mover); d.group.position.y = 0; d.group.updateMatrixWorld(true); }
      for (const f of foes?.list.slice() ?? []) foes.remove(f);
      if (foes) foes.lock = null;
      player.lockOn = null;
      if (player.object) player.object.visible = true;
      if (rig) { if (lookOwn) rig.look = look0; else delete rig.look; }
      if (dom && lockReq) { if (reqOwn) dom.requestPointerLock = lockReq; else delete dom.requestPointerLock; }
      offErr?.();
      globalThis.document?.removeEventListener?.('pointerlockerror', refused);
      globalThis.document?.body?.classList.remove('lens-vault');
      cv?.remove(); style?.remove();
      screen.set('visor', null);
      if (player.dead) player.restart?.();
    },
  };
  return session;
}

export default {
  id: 'lens-vault', order: 12,
  name: 'The Lens Vault',
  blurb: 'Through your own eyes: a sealed makers’ vault, the glove as an arm that shoots, and a lens that reads what it is held on.',
  rules: 'Four rooms to the round hall at the end. Doors open to a shot; the heavy one only to a charged shot (hold the trigger). One door is sealed: read its lock with the lens. Lock on and the stick circles the foe. Clear the round hall’s two waves. Score: the time.',
  drives: false,
  controls: {
    pad: [['Left stick', 'walk (locked on: circle the foe)'], ['Right stick', 'look'], ['RT / R2', 'shoot (hold: charge, let go)'], ['LT / L2', 'lock on (held)'], ['Y / △', 'the lens (RT / R2 held on a thing reads it)'], ['A / ×', 'jump (locked on: hop aside)'], ['Menu', 'pause']],
    keys: [['W A S D', 'walk (locked on: circle the foe)'], ['Mouse (click to capture it)', 'look'], ['Left mouse or G', 'shoot (hold: charge, let go)'], ['Right mouse or R', 'lock on (held)'], ['F', 'the lens (left mouse held on a thing reads it)'], ['Space', 'jump (locked on: hop aside)'], ['Esc', 'pause']],
    touch: [['Stick', 'walk'], ['Drag', 'look'], ['✺', 'shoot (hold: charge)'], ['◎', 'lock on'], ['◐', 'the lens'], ['⤒', 'jump']],
  },
  touchButtons: ['jump', 'run', 'aim', 'fire', 'mode'],
  score: { kind: 'time' },
  hud: { timer: true, score: true },
  color: '#71d7cf',
  build: buildVault,
  start,
};

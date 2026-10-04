import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { QUESTS, PEOPLE, LOCALS, THINGS, ITEMS, MACHINES, SIGNAL, BOARD_GLYPH } from './garage-data.js';

// The Airtight Garage's story, alive (garage-data.js has the words): "The Major Forgot".
//
//   A, the plateau      Ambroise at the signal board (its nine lamps blink the
//                       signal); Ottla by the stopped windmill; Malvina, Nikko and
//                       Ferrol (the level's own people)
//   B, the upside-down  the relay box by the path, the stopped lamp pump, and at
//                       the slab's far edge the Major's desk, its lamp still lit
//   C, the ring         Lune near the entrance, the stopped turbine; Pip and her
//                       ball, which rolls forever on the curve (gravity is radial:
//                       nothing ever pulls it back down) until you push it up the
//                       wall and through the portal to the plateau
//
// The machines and props live in src/levels/garage.js (level.garage).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function setupGarage(ctx) {
  const { level, physics, player, quests, dialogue, game, sound, story, spawn, talkable, scene, toast, npcs } = ctx;
  const G = level.garage;
  if (!G) return null;
  const Q = 'garage.signal';
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = { ...(quests.itemNames ?? {}), ...ITEMS };
  if (!quests.isStarted(Q)) quests.start(Q);
  const C = G.C_POS, R = G.RING_R;
  const floorY = (z) => C.y - Math.sqrt(R * R - z * z);
  const groundA = (x, z) => { const g = physics.groundAt(x, 40, z, 100); return Number.isFinite(g) ? g : 0; };

  // ---------------------------------------------------------------- the people
  const people = {};
  LOCALS.forEach((def, i) => { const n = npcs[i]; if (n && !n.def?.talk) { talkable(n, def); people[def.id] = n; } });
  const boardSide = G.board.pos.clone().add(V(3.2, 0, 3.6)); boardSide.y = groundA(boardSide.x, boardSide.z);
  people.ambroise = spawn(PEOPLE.ambroise, { route: [boardSide.clone(), boardSide.clone().add(V(1.5, 0, -0.8))], speed: 0.5 });
  const ottlaAt = V(-100, 0, 54); ottlaAt.y = groundA(ottlaAt.x, ottlaAt.z);
  people.ottla = spawn(PEOPLE.ottla, { route: [ottlaAt.clone(), V(-100, groundA(-100, 48), 48)], speed: 0.6 });
  const luneAt = V(2872, floorY(10), 10);
  people.lune = spawn(PEOPLE.lune, { route: [luneAt.clone(), V(2878, floorY(14), 14)], speed: 0.5 });
  const pipAt = V(3036, floorY(-6), -6);
  people.pip = spawn(PEOPLE.pip, { route: [pipAt.clone(), V(3042, floorY(-2), -2)], speed: 0.9 });

  // ---------------------------------------------------------------- things
  const thing = (def, at, { range = 3, prompt, enabled = () => true, look = null, use, height = 4 } = {}) => registerInteractable({
    id: def.id, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ')}`,
    at: () => at, enabled, distance: (p) => (Math.abs(p.pos.y - at.y) < height ? flat(p.pos, at) : Infinity),
    use: use ?? (() => dialogue.start(def, null, at, look)),
  });
  thing(THINGS.relay, G.relay.foot, { range: 3.2, look: G.relay.pos, prompt: () => (quests.has('signal') && !game.flag('garage.signal.stamped') ? 'post the signal in the relay box' : 'look at the relay box') });
  thing(THINGS.note, G.desk.foot, { range: 3, look: G.desk.pos, prompt: () => (game.flag('garage.note.read') ? 'look at the Major’s desk' : 'read the paper on the desk') });

  // ---------------------------------------------------------------- the three stopped machines
  const lampGlow = makeMaterial({ color: '#f2c54b', glow: 0.6 });   // the upside-down quarter's lamp posts (garage.js)
  const startMachine = (id, instant = false) => {
    const m = G.machines[id];
    if (!m || m.target === 1) return false;
    m.target = 1;
    if (instant) m.speed = 1;
    if (id === 'pump') lampGlow.uniforms.uGlow.value = 1;
    if (instant) return true;
    game.set(`garage.machine.${id}`, true);
    if (!quests.isStarted('garage.machines')) quests.start('garage.machines');
    const n = ['mill', 'pump', 'turbine'].filter((k) => game.flag(`garage.machine.${k}`)).length;
    toast(`${MACHINES[id][0].toUpperCase()}${MACHINES[id].slice(1)} coughs, shudders, and turns. (${n} of 3)`);
    sound.critter?.('whirr', 1);
    sound.chime();
    return true;
  };
  for (const [id, m] of Object.entries(G.machines)) {
    if (game.flag(`garage.machine.${id}`)) startMachine(id, true);
    registerTarget({ kind: 'machine', radius: m.radius, position: () => m.pos, enabled: () => m.target !== 1 && player.pos.distanceTo(m.pos) < 90,
      onHit: (mode) => {
        if (mode === 'shoot') startMachine(id);
        else if (!m.nudged) { m.nudged = true; toast('It rocks on its bearings and settles. It wants something in the works, not a shove: shoot it.'); }
        return true;
      } });
  }
  quests.locate('machine', () => {
    let best = null, bd = Infinity;
    for (const [id, m] of Object.entries(G.machines)) {
      if (game.flag(`garage.machine.${id}`)) continue;
      const d = player.pos.distanceTo(m.pos);
      if (d < bd) { bd = d; best = m.pos; }
    }
    return best;
  });

  // ---------------------------------------------------------------- Pip's ball
  const ball = { r: 1.1, mode: 'ring', x: 0, phi: 0, vx: 0, vt: 0, pos: V(0, 0, 0), vel: V(0, 0, 0), spin: new THREE.Quaternion(), back: 0 };
  const START = { x: 3040, phi: -Math.PI / 2 - 0.08 };
  const Rb = R - ball.r;
  const portalA = G.portals.find((p) => p.zone === 'A');          // the ring's portal, on the -z wall
  const portalFoot = portalA ? portalA.pos.clone().sub(C).setX(0).setLength(R).add(C).setX(portalA.pos.x) : V(3060, 0, -150);
  const ballMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(ball.r, 2), makeMaterial({ color: '#f2c54b', flat: true, grid: 0.9, glow: 0.2 }));
  ballMesh.userData.noCollide = true;
  scene.add(ballMesh);
  const ringPlace = () => ball.pos.set(ball.x, C.y + Math.sin(ball.phi) * Rb, C.z + Math.cos(ball.phi) * Rb);
  const tangent = (out) => out.set(0, Math.cos(ball.phi), -Math.sin(ball.phi));
  const fromBottom = () => Math.atan2(Math.cos(ball.phi), -Math.sin(ball.phi));
  const resetBall = () => { ball.mode = 'ring'; ball.x = START.x; ball.phi = START.phi; ball.vx = ball.vt = 0; ringPlace(); };
  const toPlateau = (instant = false) => {
    ball.mode = 'flat';
    ball.pos.copy(G.aSpawn).add(V(3, 0, -9)); ball.pos.y = groundA(ball.pos.x, ball.pos.z) + ball.r;
    ball.vel.set(0, 0, instant ? 0 : -3);
  };
  if (game.flag('garage.ball.through')) toPlateau(true); else resetBall();
  const _t = V(0, 0, 0), _d = V(0, 0, 0), _n = V(0, 0, 0), _ax = V(0, 0, 0), _q = new THREE.Quaternion();
  registerTarget({ kind: 'ball', radius: ball.r + 0.2, position: () => ball.pos,
    onHit: (mode, point, dir, info) => {
      const imp = mode === 'push' ? 4 + 5 * (info?.strength ?? 1) : mode === 'shoot' ? 1.5 : 0;
      if (!imp || !dir) return true;
      if (ball.mode === 'ring') {
        ball.vx += dir.x * imp;
        ball.vt += dir.dot(tangent(_t)) * imp;
      } else {
        ball.vel.x += dir.x * imp; ball.vel.z += dir.z * imp;
      }
      if (!quests.isStarted('garage.ball') && ball.mode === 'ring') quests.start('garage.ball');
      sound.critter?.('boing', 0.6);
      return true;
    } });
  const updateBall = (dt) => {
    const step = (speed) => Math.max(0, speed - dt * (0.35 + speed * 0.04));   // rolling friction: it goes a long way
    if (ball.mode === 'ring') {
      const sp = Math.hypot(ball.vx, ball.vt);
      if (sp > 1e-3) {
        const k = step(sp) / sp; ball.vx *= k; ball.vt *= k;
        // buildings and the rims in the way: bounce
        _d.set(ball.vx, 0, 0).addScaledVector(tangent(_t), ball.vt);
        const len = _d.length() * dt;
        if (len > 0 && physics.rayDistance(ball.pos, _d.normalize(), len + ball.r) < len + ball.r) { ball.vx *= -0.5; ball.vt *= -0.5; }
        ball.x += ball.vx * dt;
        ball.phi += (ball.vt / Rb) * dt;
        if (Math.abs(ball.x - C.x) > G.RING_L / 2 - 4) { ball.x = THREE.MathUtils.clamp(ball.x, C.x - G.RING_L / 2 + 4, C.x + G.RING_L / 2 - 4); ball.vx *= -0.5; }
      }
      ringPlace();
      // it got through the portal on the wall: on to the plateau, where down stays down
      if (ball.pos.distanceTo(portalFoot) < 4.8) {
        toPlateau();
        game.set('garage.ball.through', true);
        toast('The ball rolls up the wall, into the portal, and is gone. Far away, on the plateau, someone shouts: “Ball!”');
        sound.critter?.('portal', 1);
        return;
      }
      // off its lane (round the far side, toward the slit, off along the ring): Pip puts it back
      const fb = fromBottom();
      if (!quests.isDone('garage.ball') && (fb > 0.9 || fb < -2.3 || Math.abs(ball.x - START.x) > 150) && sp < 6) {
        ball.back += dt;
        if (ball.back > 2) { ball.back = 0; resetBall(); const p = people.pip; if (p) p.shout = { text: '~shout~ Again!', until: p.time + 2 }; }
      } else ball.back = 0;
      _n.copy(C).setX(ball.x).sub(ball.pos).normalize();   // up, here: toward the axis
    } else {
      const sp = Math.hypot(ball.vel.x, ball.vel.z);
      if (sp > 1e-3) {
        const k = step(sp * 2) / (sp * 2); ball.vel.x *= k; ball.vel.z *= k;
        _d.set(ball.vel.x, 0, ball.vel.z);
        const len = sp * dt;
        if (physics.rayDistance(ball.pos, _d.normalize(), len + ball.r) < len + ball.r) { ball.vel.multiplyScalar(-0.5); }
        ball.pos.x += ball.vel.x * dt; ball.pos.z += ball.vel.z * dt;
      }
      const g = physics.groundAt(ball.pos.x, ball.pos.y + 2, ball.pos.z, 30);
      ball.pos.y = (Number.isFinite(g) ? g : ball.pos.y - 0.5) + ball.r;
      if (ball.pos.y < -60) toPlateau(true);
      _n.set(0, 1, 0);
    }
    // roll: about the axis across the motion
    const v = ball.mode === 'ring' ? _d.set(ball.vx, 0, 0).addScaledVector(tangent(_t), ball.vt) : _d.copy(ball.vel);
    const s = v.length();
    if (s > 1e-3) { _ax.crossVectors(_n, v).normalize(); _q.setFromAxisAngle(_ax, (s * dt) / ball.r); ballMesh.quaternion.premultiply(_q); }
    ballMesh.position.copy(ball.pos);
  };

  // ---------------------------------------------------------------- the signal board, the relay, the desk
  const lampOn = makeMaterial({ color: '#f2c54b', glow: 0.9 }), lampOff = G.board.lamps[0]?.material;
  const glyphOn = makeMaterial({ color: '#62c3c9', glow: 0.9 });
  let beat = 0, beatT = 0;
  const showBoard = (pattern, on) => G.board.lamps.forEach((l, i) => { l.material = pattern[i] ? on : lampOff; });
  game.on('flag:garage.signal.stamped', (v) => { if (v) stamp.t = 0.001; });
  const stamp = { t: 0, y0: G.relay.stamp?.position.y ?? 0 };

  // ---------------------------------------------------------------- the story catches up when you take it out of order
  const catchUp = () => {
    if (quests.isDone(Q)) return;
    if (game.flag('garage.note.read')) { quests.complete(Q); return; }
    const want = game.flag('garage.signal.read') ? 'note' : game.flag('garage.signal.stamped') && quests.has('signal') ? 'ring' : game.flag('garage.signal.given') ? 'relay' : null;
    if (want && !quests.reached(Q, want)) quests.set(Q, want);
  };
  game.on('flag', catchUp);
  catchUp();
  quests.def(Q).onDone = () => {
    game.set('world.garage.done', true);
    toast('The Major’s note, folded small. On its back: a wheel under sand, turning one tooth a year.');
    setTimeout(() => story.complete?.(), 1500);
  };
  const crown = makeMaterial({ color: '#f2c54b', grid: 3 });   // the great machine's crown (garage.js)

  // ---------------------------------------------------------------- places for the quest markers
  for (const [id, n] of Object.entries(people)) quests.locate(id, () => n.pos);
  quests.locate('relay', () => G.relay.foot);
  quests.locate('desk', () => G.desk.foot);
  quests.locate('ball', () => ball.pos);

  // ---------------------------------------------------------------- per frame
  const st = { zone: G.zoneId(player.pos), bSeen: false };
  const update = (dt, t) => {
    const pp = player.pos;
    updateBall(dt);
    // the board blinks the signal as it goes round; once the Major's note is read it shows his mark
    beatT += dt;
    if (game.flag('garage.note.read')) { if (beat !== -1) { beat = -1; showBoard(BOARD_GLYPH, glyphOn); } }
    else if (beatT > 0.55) { beatT = 0; beat = (beat + 1) % SIGNAL.length; showBoard(SIGNAL[beat], lampOn); }
    // the relay's lamp blinks when the signal comes near it; its stamp comes down once
    if (G.relay.lamp) G.relay.lamp.visible = !(quests.has('signal') && !game.flag('garage.signal.stamped') && pp.distanceTo(G.relay.foot) < 30 && Math.sin(t * 8) < 0);
    if (stamp.t > 0 && G.relay.stamp) {
      stamp.t += dt;
      G.relay.stamp.position.y = stamp.y0 - Math.sin(Math.min(stamp.t / 0.6, 1) * Math.PI) * 0.7;
      if (stamp.t > 0.6) stamp.t = 0;
    }
    // coming through a portal: the people there notice
    const z = G.zoneId(pp);
    if (z !== st.zone) {
      const from = st.zone; st.zone = z;
      if (z === 'C' && people.lune && pp.distanceTo(people.lune.pos) < 80) people.lune.shout = { text: from === 'B' ? '~shout~ Welcome round!' : '~shout~ Mind your feet, down moves here!', until: people.lune.time + 2.5 };
      if (z === 'A' && from === 'C' && people.ambroise && pp.distanceTo(people.ambroise.pos) < 60) people.ambroise.shout = { text: '~shout~ Round you come!', until: people.ambroise.time + 2.5 };
      if (z === 'B' && !st.bSeen) { st.bSeen = true; if (!game.flag('garage.b.seen')) { game.set('garage.b.seen', true); toast('Down is up here. The slab is your floor now; the sky is under your feet.'); } }
    }
    // the great machine glows at the crown once the Major's note is read
    crown.uniforms.uGlow.value = game.flag('garage.note.read') ? 0.35 + 0.1 * Math.sin(t * 1.5) : 0;
  };

  return { people, update, ball, startMachine, resetBall };
}

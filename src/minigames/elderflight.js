// The Elder's flight (docs/design/helper-guardians.md, issue #339): helping Vael's Elder instead of fighting her. She
// will not fly alone; here she flies, out of the Aerie and across the sea of cloud to the riders' Old Roost, as long as
// somebody flies at her wing. You are her wingman: keep station in the slot off her wingtip (her wake holds you up and
// draws you to her pace), go through your ring of every wind gate beside her, cross behind her to the side she calls,
// crab into the gusts, keep off the stones. Her courage falls while you are far from her and with every gate missed;
// out of it she turns back. The rules are formation.js (pure, tests/minigames-helpers.test.js); this is the sky, the
// stones, the gates, the two of you and the camera that keeps you both in the picture.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { arenaLevel } from './kit/world.js';
import { disposeTree } from './kit/dispose.js';
import { lendItems } from './kit/gear.js';
import { WorldLabels } from './kit/labels.js';
import { elderModel } from '../temples/guardians.js';
import { Dots } from '../fluid-tool.js';
import { table, needle, lumpy } from '../levels/sky-stones-kit.js';
import { SKY_STONES_LOOK, SKY_STONES_DAY, SKY_STONES_DUSK, SKY_STONES_NIGHT, CLOUD_PRINT } from '../levels/arzach2.js';
import { FORMATION, makeRoute, routeAt, newFlight, herStep, slotAt, wakeAt, newWings, wingStep, flightStep, flightScore, flightGuide, skyStones, gustAt, botInput } from './formation.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tag = (m) => { m.userData.noCollide = true; return m; };
const INK = '#2b211f';
const ROUTE = makeRoute();
const CLOUD_Y = -30;   // (the sea of cloud, far under the route: FORMATION.cloud is where you are lost in its top)
const STONES = skyStones(ROUTE);

/** A level of flat ground far under the cloud (nothing stands on it: the stones are drawn, the flight collides by itself). */
const FLOOR = { heightAt: () => -90, normalAt: (x, z, out = new THREE.Vector3()) => out.set(0, 1, 0) };

/** Position and normal only, non-indexed (the kit's pieces carry others: merged per material). */
function plain(g) {
  const n = g.index ? g.toNonIndexed() : g;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', n.getAttribute('position').clone());
  if (n.getAttribute('normal')) out.setAttribute('normal', n.getAttribute('normal').clone()); else out.computeVertexNormals();
  return out;
}

// ------------------------------------------------------------------ the sky, built
function* buildSky(scene) {
  const PRINT = { shadeFlat: 0.85 };
  const DS = THREE.DoubleSide;
  const M = {
    bone: makeMaterial({ color: '#f3ead8', color2: '#f0e4cf', color3: '#f5ede0', mode: MODE_STRATA, strataSize: 7, flat: true, side: DS, hatch: 0.4, strataHatch: 0, ...PRINT }),
    needle: makeMaterial({ color: '#f3ead8', color2: '#f0e4cf', color3: '#f5ede0', mode: MODE_STRATA, strataSize: 7, side: DS, hatch: 0.4, strataHatch: 0, ...PRINT }),
    cap: makeMaterial({ color: '#f5e5d1', color2: '#f3e0cb', color3: '#f6e9d8', mode: MODE_STRATA, strataSize: 5, side: DS, ...PRINT }),
    rose: makeMaterial({ color: '#d9a59a', color2: '#c98f86', color3: '#e3b5a8', mode: MODE_STRATA, strataSize: 9, flat: true, side: DS, ...PRINT }),
    ochre: makeMaterial({ color: '#d8a24a', flat: true, ...PRINT }),
    feather: makeMaterial({ color: '#efe6d2', color2: '#e2d6bf', color3: '#f5efe2', mode: MODE_STRATA, strataSize: 2.5, flat: true, ...PRINT }),
  };
  const lists = new Map();
  const add = (mat, g) => { if (!lists.has(mat)) lists.set(mat, []); lists.get(mat).push(plain(g)); };
  // the stones: the gates' needles, the tables and needles round the route
  STONES.forEach((c, i) => {
    if (c.kind === 'needle') add(c.gate != null ? M.rose : M.needle, needle({ x: c.x, y: c.y0, z: c.z, H: c.y1 - c.y0, R: c.r, seed: i * 0.37 + 1 }).vis);
    else if (c.kind === 'table') add(i % 3 ? M.cap : M.bone, table({ x: c.x, z: c.z, R: c.R, stalk: c.stalk, top: c.top, base: -50, seed: i * 0.53 + 2, seg: 56, colSeg: 8, lean: [Math.sin(i) * 0.06, Math.cos(i * 1.3) * 0.06] }).vis);
  });
  yield;
  // the Aerie's crown under the start: the great drum, its ochre bands, the stone feathers leaning out round the perch
  const start = ROUTE.pos[0], end = ROUTE.pos[ROUTE.pos.length - 1];
  const crownY = start.y - 14;
  add(M.bone, new THREE.CylinderGeometry(15, 19, crownY + 50, 40, 6).translate(start.x, (crownY - 50) / 2, start.z - 6));
  add(M.ochre, new THREE.CylinderGeometry(15.4, 15.6, 1.6, 40, 1, true).translate(start.x, crownY - 5, start.z - 6));
  add(M.ochre, new THREE.CylinderGeometry(16.6, 16.9, 1.2, 40, 1, true).translate(start.x, crownY - 14, start.z - 6));
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    add(M.feather, new THREE.SphereGeometry(1, 10, 8).scale(1.6, 9, 0.5).rotateX(0.35).rotateY(a + Math.PI / 2).translate(start.x + Math.cos(a) * 13, crownY + 6, start.z - 6 + Math.sin(a) * 13));
  }
  // the Old Roost at the end: a great table ringed with standing stone feathers, where she lands
  const roostTop = end.y - 7;
  add(M.cap, table({ x: end.x, z: end.z + 18, R: 30, stalk: 10, top: roostTop, dome: 0.2, base: -50, seed: 9, seg: 72, colSeg: 8 }).vis);
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2 + 0.3;
    add(M.feather, new THREE.SphereGeometry(1, 10, 8).scale(1.4, 7, 0.45).rotateX(0.25).rotateY(a + Math.PI / 2).translate(end.x + Math.cos(a) * 24, roostTop + 5, end.z + 18 + Math.sin(a) * 24));
  }
  for (const [mat, list] of lists) scene.add(tag(new THREE.Mesh(mergeGeometries(list), mat)));
  yield;
  // the sea of cloud: a flat deck, and cauliflower puffs on it (the sky stones' own look)
  const cloudMat = makeMaterial({ color: '#fffbf4', ...CLOUD_PRINT, line: 0.45, lineTint: 1 });
  const noShadow = [];
  const puff = (detail) => { const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv')); lumpy(g, 0.17, 2.3, detail); g.computeVertexNormals(); return g; };
  let s = 11;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const near = [], far = [];
  // cauliflower clusters far under the route: a big puff, lobes round it and on top
  for (let i = 0; i < 900; i++) {
    const z = -600 + rand() * 3300, x = (rand() * 2 - 1) * 1000, sc = 12 + rand() * 22, y = CLOUD_Y + rand() * 5;
    const d = Math.min(...[0, 400, 800, 1200, 1600, 2000].map((q) => Math.hypot(x - ROUTE.pos[Math.min(ROUTE.pos.length - 1, q)].x, z - q)));
    const list = d < 450 ? near : far;
    list.push({ x, y, z, s: sc });
    for (let k = 0, n = 2 + Math.floor(rand() * 3); k < n; k++) {
      const a = rand() * Math.PI * 2, rr = sc * (0.6 + rand() * 0.4), ls = sc * (0.4 + rand() * 0.3);
      list.push({ x: x + Math.cos(a) * rr, y: y - ls * 0.2, z: z + Math.sin(a) * rr, s: ls });
    }
    if (rand() < 0.6) list.push({ x, y: y + sc * 0.45, z, s: sc * 0.55 });
  }
  const dummy = new THREE.Object3D();
  for (const [list, detail] of [[near, 2], [far, 1]]) {
    const im = new THREE.InstancedMesh(puff(detail), cloudMat, list.length);
    list.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.scale.set(p.s, p.s * 0.72, p.s * (0.8 + rand() * 0.3)); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.frustumCulled = false;
    scene.add(tag(im));
    noShadow.push(im);
  }
  const deck = tag(new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), makeMaterial({ color: '#e6e2ef', glow: 0.5 })));
  deck.position.y = CLOUD_Y - 4;
  scene.add(deck);
  noShadow.push(deck);
  yield;
  return arenaLevel({
    ground: FLOOR, name: 'The open sky over Vael', hour: 9.5, look: SKY_STONES_LOOK,
    sky: { script: { day: SKY_STONES_DAY, dusk: SKY_STONES_DUSK, night: SKY_STONES_NIGHT }, planets: [{ az: 200, el: 26, size: 6.5, color: '#f3ead8', craters: false }] },
    spawn: start.clone(), noShadow,
    features: { mount: false, wind: true, jetpack: false, climb: false },
    flight: { roostTop, end: end.clone() },
  });
}

// ------------------------------------------------------------------ the gates, the slot, drawn
/** A wind gate: her great ring of turning wind and, beside it on the side she wants you, your smaller one. */
function gateModel(G, mats) {
  const g = new THREE.Group();
  const hers = new THREE.Group(), yours = new THREE.Group();
  hers.add(tag(new THREE.Mesh(new THREE.TorusGeometry(FORMATION.gate.R, 0.32, 6, 48), mats.wind)));
  const blades = new THREE.Group();
  for (let k = 0; k < 6; k++) {
    const arc = tag(new THREE.Mesh(new THREE.TorusGeometry(FORMATION.gate.R * (0.55 + 0.12 * (k % 3)), 0.12, 4, 16, 1.1), k % 2 ? mats.ink : mats.wind));
    arc.rotation.z = (k / 6) * Math.PI * 2;
    blades.add(arc);
  }
  hers.add(blades);
  hers.position.copy(G.hers);
  hers.lookAt(G.hers.clone().add(G.n));
  const ring = tag(new THREE.Mesh(new THREE.TorusGeometry(FORMATION.gate.r, 0.36, 6, 40), mats.yours));
  const hoop = tag(new THREE.Mesh(new THREE.TorusGeometry(FORMATION.gate.r + 0.5, 0.08, 4, 40), mats.ink));
  yours.add(ring, hoop);
  yours.position.copy(G.yours);
  yours.lookAt(G.yours.clone().add(G.n));
  // the beam between the pillars the rings hang from
  const span = G.hers.clone().addScaledVector(G.right, -FORMATION.gate.pillar), span2 = G.hers.clone().addScaledVector(G.right, FORMATION.gate.pillar);
  const top = Math.max(G.hers.y, G.yours.y) + FORMATION.gate.R + 2.5;
  span.y = top; span2.y = top;
  const len = span.distanceTo(span2);
  const beam = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, len, 6).rotateZ(Math.PI / 2), mats.ink));
  beam.position.lerpVectors(span, span2, 0.5);
  beam.rotation.y = Math.atan2(G.right.x, G.right.z) - Math.PI / 2;
  for (const [o, y0] of [[hers, G.hers.y + FORMATION.gate.R], [yours, G.yours.y + FORMATION.gate.r + 0.5]]) {
    const cord = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, top - y0, 4).translate(0, (top - y0) / 2, 0), mats.ink));
    cord.position.set(o.position.x, y0, o.position.z);
    g.add(cord);
  }
  g.add(hers, yours, beam);
  g.userData = { blades, ring, yours };
  return g;
}

// ------------------------------------------------------------------ the sounds
function skySounds(sound) {
  const on = () => !!sound?.ctx && !sound.muted && sound.fx;
  const note = (s) => 440 * Math.pow(2, s / 12);
  return {
    cry(high = false) { if (!on()) return; const t = sound.ctx.currentTime; sound.sweep(t, high ? 760 : 620, high ? 1180 : 980, 0.42, 0.05, 'triangle'); sound.sweep(t + 0.32, high ? 1100 : 900, high ? 820 : 700, 0.5, 0.04, 'sine'); },
    gate(together, mult) { if (!on()) return; const t = sound.ctx.currentTime; (together ? [0, 4, 7, 12] : [0, 7]).forEach((s, i) => sound.pluck(note(s + mult), t + i * 0.06, 0.07, 'triangle', sound.fx)); },
    mult(m) { if (on()) sound.pluck(note(5 + m * 2), sound.ctx.currentTime, 0.06, 'sine', sound.fx); },
    gust() { if (on()) sound.burst(sound.ctx.currentTime, { dur: 1.6, type: 'bandpass', freq: 600, q: 0.4, vol: 0.12, rate: 0.6 }); },
  };
}

// ------------------------------------------------------------------ the game
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _cw = new THREE.Vector3(), _cl = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);
const BODY_Y = 4.4;   // (her body's middle over her model's feet: the route is where her body flies)

function start(ctx) {
  const { player, camera, level, sfx, scene } = ctx;
  const snd = skySounds(ctx.sound);
  const words = new WorldLabels(camera);
  const giveBack = lendItems(['backpack', 'glider']);
  const feet0 = player._feetGround;
  const mats = {
    wind: makeMaterial({ color: '#9fd6ee', glow: 0.55, flat: true, key: 'ef-wind' }),
    yours: makeMaterial({ color: '#f2c54b', glow: 0.85, flat: true, key: 'ef-yours' }),
    passed: makeMaterial({ color: '#71d7cf', glow: 0.7, flat: true, key: 'ef-passed' }),
    lost: makeMaterial({ color: '#8c8a96', flat: true, key: 'ef-lost' }),
    ink: makeMaterial({ color: INK, flat: true, key: 'ef-ink' }),
    slot: makeMaterial({ color: '#f2c54b', glow: 0.9, flat: true, key: 'ef-slot' }),
    held: makeMaterial({ color: '#71d7cf', glow: 1, flat: true, key: 'ef-held' }),
  };
  (level.noShadow ??= []);
  const gates = ROUTE.gates.map((G) => ctx.add(gateModel(G, mats)));
  level.noShadow.push(...gates);
  // the slot: a ring of light off her wingtip, turned along her way
  const slotRing = ctx.add(new THREE.Group());
  const slotMesh = tag(new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.14, 5, 32), mats.slot));
  slotRing.add(slotMesh);
  level.noShadow.push(slotRing);
  // her wake's motes off each wingtip, and the gusts' streaks
  const motes = new Dots(scene, 360, makeMaterial({ color: '#ffffff', flat: true, key: 'ef-motes' }));
  level.noShadow.push(motes.mesh);

  // the Elder, in a frame of her own that flies (her legs' kit keeps its feet in her frame: they tuck under her)
  const herRoot = ctx.add(new THREE.Group());
  const E = elderModel();
  herRoot.add(E.group);
  E.group.position.set(0, -BODY_Y, 0);
  const ekit = { eye: null, ground: () => 0 };
  E.animate(1 / 60, 0, { state: 'fight', phase: 0, attack: null, k: 0, meter: 1, kit: ekit });   // (her feet planted once, then tucked)
  // in flight her long legs trail back under her tail, as a heron's do (the walking legs' kit is for the floor)
  for (const c of E.group.children) if (/^guardian leg/.test(c.name)) c.visible = false;
  const legMat = makeMaterial({ color: '#d8a24a', flat: true, key: 'ef-legs' });
  const tucked = [];
  for (const sx of [-1, 1]) {
    const leg = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 4.6, 6).rotateX(Math.PI / 2 - 0.12).translate(sx * 0.75, 3.55, -2.4), legMat));
    const toes = tag(new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 5).rotateX(-Math.PI / 2).translate(sx * 0.75, 3.25, -5.0), legMat));
    E.rig.add(leg, toes);
    tucked.push(leg, toes);
  }
  const standing = (on) => { for (const c of E.group.children) if (/^guardian leg/.test(c.name)) c.visible = on; for (const m of tucked) m.visible = !on; };

  let landed = null, R = ROUTE, F = newFlight(R), W = newWings(slotAt(F, R), F.her.yaw, FORMATION.her.speed), t = 0, beatPh = 0, callT = 0, callSide = 0, gustOn = false, arrived = false;
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), roll: 0 };

  function poseHer(dt) {
    if (landed) {
      // on the Old Roost, on her own legs, her wings opening and folding once (resolved: calm)
      herRoot.position.copy(landed.her);
      herRoot.rotation.set(0, landed.yaw, 0, 'YXZ');
      E.animate(dt, t, { state: 'resolved', phase: 0, attack: null, k: 0, meter: 1, kit: ekit });
      E.group.updateMatrixWorld(true);
      return;
    }
    herRoot.position.copy(F.her.pos);
    const climb = clamp(Math.atan(F.her.climb), -0.3, 0.3);
    herRoot.rotation.set(-climb * 0.6, F.her.yaw, -F.bank, 'YXZ');
    E.heading = 0;
    E.animate(dt, t, { state: 'fight', phase: 1, attack: null, k: 0, meter: F.courage, kit: ekit });
    // her wings spread wide, beating slowly (harder climbing, gliding down), the side she calls dipped
    const amp = arrived ? 0.5 : clamp(0.22 + F.her.climb * 3, 0.06, 0.5);
    beatPh += dt * (arrived ? 9 : 6.2);
    for (const { w, s, joints } of E.wings) {
      const dip = callT > 0 && s === -callSide ? -0.35 * Math.min(1, callT) : 0;   // (her wing's s: +1 her left, -1 her right)
      w.rotation.set(0, 0, s * (0.08 + amp * Math.sin(beatPh) + dip), 'YXZ');
      joints.forEach((j, i) => { if (i) j.rotation.z = s * amp * 0.35 * Math.sin(beatPh - i * 0.55); });
    }
    E.group.updateMatrixWorld(true);
  }

  function poseMe(dt) {
    if (landed) {
      player.pos.copy(landed.me); player.vel.set(0, 0, 0); player.heading = landed.yaw + 0.5;
      player.onGround = true; player.gliding = false; player.glideTurn = 0;
      player._moveDir = (player._moveDir ?? new THREE.Vector3()).set(0, 0, 0); player._wantSpeed = 0;
      player.finishFrame(dt, 0);
      player.object.visible = true;
      return;
    }
    player.pos.copy(W.pos);
    player.vel.copy(W.vel);
    player.heading = W.yaw;
    player.onGround = false;
    player.gliding = true;
    player.glideTurn = W.turn;
    player.jetFlight = null; player.thrusting = false; player.jetPower = 0;
    player._moveDir = (player._moveDir ?? new THREE.Vector3()).set(0, 0, 0);
    player._wantSpeed = 0;
    player.finishFrame(dt, W.v);
    player.object.visible = W.blink > 0 ? Math.floor(W.blink * 10) % 2 === 0 : true;
  }

  function updateCamera(dt, snap = false) {
    if (landed) {
      // landed: from the roost's edge, the two of you in the left of the picture (the results card comes up in its middle)
      const f = _w.set(Math.sin(landed.yaw), 0, Math.cos(landed.yaw)), r = new THREE.Vector3().crossVectors(f, _UP);
      const mid = _v.lerpVectors(landed.me, landed.her, 0.5);
      // (seen from in front of her, the camera's right is her -r: looking that way of the pair puts them on the left)
      _cw.copy(mid).addScaledVector(f, 17).addScaledVector(r, -2).addScaledVector(_UP, 8);
      _cl.copy(mid).addScaledVector(r, -12).addScaledVector(_UP, 3);
      const e = 1 - Math.exp(-1.6 * dt);
      cam.pos.lerp(_cw, e); cam.look.lerp(_cl, e);
      camera.position.copy(cam.pos); camera.up.set(0, 1, 0); camera.lookAt(cam.look);
      return;
    }
    // a wide formation shot: behind you and a little outside, looking past you along her way, both of you in it
    const f = F.her.fwd, side = F.side;
    const mid = _v.lerpVectors(W.pos, F.her.pos, 0.42);
    _cw.copy(W.pos).addScaledVector(f, -23).addScaledVector(F.her.right, -side * 4).addScaledVector(_UP, 7);
    _cl.copy(mid).addScaledVector(f, 14).addScaledVector(_UP, 0.5);
    const e = snap ? 1 : 1 - Math.exp(-2.6 * dt);
    cam.pos.lerp(_cw, e); cam.look.lerp(_cl, snap ? 1 : 1 - Math.exp(-4 * dt));
    cam.roll += (-F.bank * 0.25 - cam.roll) * (1 - Math.exp(-2 * dt));
    camera.position.copy(cam.pos);
    _w.subVectors(cam.look, cam.pos).normalize();
    camera.up.set(0, 1, 0).applyAxisAngle(_w, cam.roll);
    camera.lookAt(cam.look);
    ctx.setFov(52);
  }

  const bar = (k) => '▰'.repeat(Math.round(k * 8)) + '▱'.repeat(8 - Math.round(k * 8));
  function statusText() {
    const sc = flightScore(F);
    return `Gate ${Math.min(F.gate + 1, R.gates.length)}/${R.gates.length} · ${Math.floor(100 * F.s / R.length)}% to the Roost\n${sc.harmony + sc.gates} pts · ×${F.mult} · courage ${bar(F.courage)}\n${flightGuide(F, R, W)}`;
  }

  function onEvents(ev) {
    for (const e of ev) {
      if (e.kind === 'gate') {
        const g = gates[e.k];
        g.userData.ring.material = mats.passed; g.userData.pop = 1;
        snd.gate(e.together, F.mult);
        words.pop(R.gates[e.k].yours.clone().setY(R.gates[e.k].yours.y + 3), `+${e.pts}`, e.together ? 'gold' : '', 1.1);
        if (e.together) ctx.flash('Together!', 'good', 1.1);
      } else if (e.kind === 'miss') {
        gates[e.k].userData.ring.material = mats.lost;
        sfx.miss(); ctx.flash('Gate missed · she falters', 'bad', 1.5);
      } else if (e.kind === 'call') {
        callT = 1.6; callSide = e.side;
        snd.cry(e.side > 0);
        ctx.flash(e.side > 0 ? 'She calls you to her right  →' : '←  She calls you to her left', 'good', 1.8);
      } else if (e.kind === 'mult') { snd.mult(e.mult); words.pop(slotAt(F, R, new THREE.Vector3()).setY(W.pos.y + 2.5), `×${e.mult}`, 'combo', 0.9); }
      else if (e.kind === 'slot' && !e.in) ctx.flash('Out of her wake', 'bad', 1);
      else if (e.kind === 'bump') { sfx.hurt(); ctx.kick(0.6); ctx.flash('Into the stone! She flinches', 'bad', 1.4); }
      else if (e.kind === 'cloud') { sfx.miss(); ctx.flash('Lost in the cloud · back at her wing', 'bad', 1.6); }
      else if (e.kind === 'turnback') finish(true);
      else if (e.kind === 'arrive') finish(false);
    }
  }

  function finish(turned) {
    arrived = !turned;
    const sc = flightScore(F);
    ctx.setScore(sc.total);
    ctx.finish({ score: sc.total, failed: turned, goal: { game: 'elderflight', complete: !turned }, title: turned ? 'She turned back' : 'The Old Roost!', lines: [
      `Harmony ${sc.harmony} · ${Math.round(F.t)} s flown`,
      `Gates ${F.passed}/${R.gates.length} (${F.together} together) · ${sc.gates}`,
      ...(turned ? ['Return to her wing to restore courage, then try again'] : [`Landing ${sc.landing} · her courage ${sc.courage}`]),
      ...(F.bumps || F.clouds ? [`Stones hit ${F.bumps} · into the cloud ${F.clouds}`] : []),
    ] });
  }

  poseHer(1 / 60); poseMe(1 / 60); updateCamera(0, true);
  ctx.status(statusText());

  return {
    get state() { return { F, W, R }; },
    update(dt, inp, { live, phase, raw = {} }) {
      t += dt;
      const moving = live || phase === 'finishing';
      if (moving && !F.done) {
        // (LT / L2, the right mouse or Shift spreads the wings wide; the stick pulled back only climbs)
        const spread = live && (raw.PadAim || raw.MouseRight || raw.ShiftLeft || raw.ShiftRight) ? 1 : 0;
        const ii = globalThis.window?.__elderBot ? botInput(F, R, W) : { x: inp.x, y: inp.y, beat: inp.jump, brake: spread };
        const p0 = W.pos.clone();
        herStep(F, R, dt, W.pos.distanceTo(slotAt(F, R, _v)) > FORMATION.her.far);
        const wind = gustAt(R, F);
        if (!!wind !== gustOn) { gustOn = !!wind; if (gustOn) { snd.gust(); ctx.flash('A gust across her line!', '', 1.4); } }
        wingStep(W, ii, dt, { wake: wakeAt(F, R, W.pos), herSpeed: F.v, wind });
        onEvents(flightStep(F, R, W, p0, dt, { stones: STONES }));
      } else if (arrived && !landed) {
        // arrived: she sets down on the Old Roost, you beside her
        const E0 = level.flight.end, top = level.flight.roostTop, yaw = F.her.yaw;
        const her = new THREE.Vector3(E0.x, top + BODY_Y, E0.z + 14), right = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).cross(_UP);
        landed = { her, yaw, me: her.clone().addScaledVector(right, F.side * 7).setY(top) };
        standing(true);
        player._feetGround = { heightAbove: (p) => p.y - top, groundNormal: (x, y, z, out = new THREE.Vector3()) => out.set(0, 1, 0), groundAt: () => top };
        sfx.land(0.4); snd.cry(true);
      }
      if (callT > 0) callT -= dt;
      // the slot's ring: gold, teal while you hold it; your next ring breathes
      slotAt(F, R, slotRing.position);
      slotRing.lookAt(_v.copy(slotRing.position).add(F.her.fwd));
      const inSlot = W.pos.distanceTo(slotRing.position) < FORMATION.slot.r;
      slotMesh.material = inSlot ? mats.held : mats.slot;
      slotMesh.scale.setScalar(inSlot ? 1 : 1 + 0.12 * Math.sin(t * 6));
      slotRing.visible = !F.done && phase !== 'intro';
      if (landed) gates.forEach((g) => { g.visible = false; });
      gates.forEach((g, k) => {
        g.userData.blades.rotation.z += dt * 1.6;
        const u = g.userData;
        if (u.pop > 0) { u.pop = Math.max(0, u.pop - dt * 2); u.yours.scale.setScalar(1 + 0.4 * Math.sin(Math.PI * (1 - u.pop))); }
        else u.yours.scale.setScalar(k === F.gate ? 1 + 0.06 * Math.sin(t * 5) : 1);
        // (a gate the camera flies through is let go of a moment: a ring a metre off the lens is a wall)
        // (once you are through, the camera behind you would fly through her ring: it goes as the camera nears it)
        g.visible = k >= F.gate || _v.subVectors(camera.position, R.gates[k].hers).dot(R.gates[k].n) < -16;
      });
      // her wake off her wingtips (the side you are on brighter), the gust's streaks round you
      for (const s of [-1, 1]) {
        // (her wingtips from her frame on the route, not from her bones (E.part): in the Unity bridge, motes put there blacked
        // the whole frame out)
        _v.copy(F.her.pos).addScaledVector(F.her.right, -s * 7.6).addScaledVector(F.her.fwd, -1.2);
        if (Math.random() < 0.7) motes.add({ pos: _v, vel: _w.copy(F.her.fwd).multiplyScalar(-2).addScaledVector(_UP, -0.4), size: 0.07, stretch: 2, life: 1.6, color: s === -F.side ? '#9fd6ee' : '#ffffff' });
      }
      if (gustOn && !F.done) for (let k = 0; k < 3; k++) {
        const g = gustAt(R, F) ?? { x: 0, z: 0 };
        _v.copy(W.pos).add(_w.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 30)).addScaledVector(F.her.fwd, 10);
        motes.add({ pos: _v, vel: _w.set(g.x * 4, 0, g.z * 4), size: 0.05, stretch: 6, life: 0.7, color: '#ffffff' });
      }
      motes.update(dt, _UP);
      words.update(dt);
      poseHer(dt);
      poseMe(dt);
      updateCamera(dt);
      ctx.speed(clamp((W.v - 19) / 8, 0, 1));
      ctx.status(statusText());
    },
    end() {
      giveBack();
      player._feetGround = feet0;
      disposeTree(motes.mesh);
      words.dispose();
      for (const o of [motes.mesh, slotRing, ...gates]) { const i = level.noShadow.indexOf(o); if (i >= 0) level.noShadow.splice(i, 1); }
      player.gliding = false; player.glideTurn = 0;
      player.object.visible = true;
      ctx.speed(0);
    },
  };
}

export default {
  id: 'elderflight', order: 12,
  name: 'The Elder’s flight',
  blurb: 'The Elder won’t fly alone. Fly at her wing across the sea of cloud to the riders’ Old Roost.',
  rules: 'Hold the slot off her wingtip: her wake carries you, and every second there scores, ×5 if you keep it. Go through your ring of each wind gate, crossing to the side she calls. Stray far, miss a gate or hit a stone and her courage falls; out of it, she turns back.',
  controls: {
    pad: [['Left stick left / right', 'bank and turn'], ['Left stick forward / back', 'dive / climb'], ['A / ×, held', 'beat your wings: faster'], ['LT / L2, held', 'spread wide: slower'], ['Menu', 'pause']],
    keys: [['A  D', 'bank and turn'], ['W  S', 'dive / climb'], ['Space, held', 'beat your wings: faster'], ['Shift or right mouse, held', 'spread wide: slower'], ['Esc', 'pause']],
    touch: [['Stick', 'turn, dive, climb'], ['⤒, held', 'beat your wings'], ['◎, held', 'spread wide']],
  },
  touchButtons: ['jump', 'aim'],
  // (its sign in Vael: at the foot of the Aerie's great steps, beside them, facing their foot; its host Corra)
  markers: [{ level: 'arzach', at: [-167.0, null, -24.7], heading: -0.395 }],
  score: { kind: 'points', unit: 'pts' },
  hud: { timer: false, score: true, multiline: true },
  color: '#9fd6ee',
  build: buildSky,
  start,
};

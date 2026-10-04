import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { Taxi } from '../taxi.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glyphGeometry, textGeometry } from './sign-text.js';
import { QUESTS, PEOPLE, THINGS, LINES, ITEMS, CROWD_TALK } from './incal-data.js';

// The City-Shaft's story, alive (incal-data.js has the words).
//
//   the rim          Corvin, Lio and Hask (content.js); the ship lands here
//   the high terrace Nima sweeps the first terrace below the rim (y 150)
//   the bottom       Ossa keeps the Upward Shrine (y −290), where the splinter
//                    fell; Pip plays round it; the dead taxi call-lamp at the edge
//   the palace       Dov guards the landing ring round the gold dome (y 320); the
//                    crown on top of the dome, under the Lodestar
//
// The light: level.shaft.incal.k goes from 0 (dim, guttering) to 1 when the
// splinter is given back and you look up at it from the palace. Then the city
// looks up with you: the crowd's heads turn up, the lines change, lamps come on
// down the lower terraces and the smog thins.
//
// The cabs don't stop in the depths (below −200) until you have lit the
// call-lamp and met Wren; after that, hailing down there brings her cab.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const Q = 'incal.light';
const DEPTHS = -200;          // below this, the cabs don't stop (until Wren)
const UP = V(0, 1, 0);
const _v = V(0, 0, 0), _d = V(0, 0, 0);

export function setupIncal(ctx) {
  const { level, physics, player, crowd, quests, dialogue, game, sound, story, spawn, scene, toast, npcs } = ctx;
  const S = level.shaft;
  if (!S?.places) return null;
  const P = S.places, rig = S.incal, PY = P.palace.y;
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = { ...(quests.itemNames ?? {}), ...ITEMS };
  if (!quests.isStarted(Q)) quests.start(Q);
  // a quest tracked in another world has no marker here: track this world's
  if (!quests.def(quests.tracked() ?? '')) quests.track(quests.isActive(Q) ? Q : quests.active().find((d) => d.world === 'incal')?.id);

  const lit = () => !!game.flag('incal.lit');
  const ground = (p, from = 2) => { const g = physics.groundAt(p.x, p.y + from, p.z, 6); return Number.isFinite(g) ? g : p.y; };
  const onGround = (p) => V(p.x, ground(p), p.z);
  const around = (c, r, n, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * Math.PI * 2; return onGround(V(c.x + Math.sin(a) * r, c.y, c.z + Math.cos(a) * r)); });
  const facing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

  // ---------------------------------------------------------------- the people
  const people = {};
  people.nima = npcs.find((n) => n.def?.id === 'nima') ?? spawn(PEOPLE.nima, { route: around(P.nima, 1.8, 4), speed: 0.45 });
  people.ossa = spawn(PEOPLE.ossa, { route: [onGround(P.ossa)], heading: facing(P.ossa, P.shrine), speed: 0.4 });
  people.pip = spawn(PEOPLE.pip, { route: around(P.pip, 2.6, 5, 0.4), speed: 2.1 });
  people.dov = spawn(PEOPLE.dov, { route: [onGround(P.palace.dov), onGround(P.palace.dov.clone().add(V(0, 0, -5)))], speed: 0.5 });
  const wrenSpawn = () => { if (!people.wren) { people.wren = spawn(PEOPLE.wren, { route: [onGround(P.wren)], heading: facing(P.wren, P.cab) }); quests.locate('wren', () => people.wren.pos); } };
  for (const [id, n] of Object.entries(people)) quests.locate(id, () => n.pos);

  // ---------------------------------------------------------------- the splinter
  // in the shrine's bowl until Ossa gives it; then it floats at your shoulder, humming,
  // until you give it back to the light
  const splMat = makeMaterial({ color: '#fff8e8', flat: true, glow: 1, key: 'incal.splinter' });
  const splinter = new THREE.Group();
  splinter.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0).scale(1, 2.4, 1), splMat));
  const sg = new THREE.Mesh(glyphGeometry(0.16, 0.01).translate(0, -0.05, 0.075), makeMaterial({ color: '#8a6a3a', flat: true }));
  splinter.add(sg);
  splinter.traverse((o) => { o.userData.noCollide = true; });
  splinter.position.copy(P.bowlTop);
  scene.add(splinter);
  const st = { release: null, lookT: 0, k: lit() ? 1 : 0, shoutT: 0, carryT: 0, refuseT: -1e9, lampK: game.flag('incal.lamp.lit') ? 1 : 0, gaze: 0 };
  splinter.visible = !lit();

  // ---------------------------------------------------------------- things to look at
  const thing = (def, at, { range = 3, prompt, enabled = () => true } = {}) => registerInteractable({
    id: def.id, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ')}`,
    at: () => at, enabled, distance: (p) => (Math.abs(p.pos.y - at.y) < 3 ? flat(p.pos, at) : Infinity),
    use: () => dialogue.start(def, null, at),
  });
  thing(THINGS.bowl, P.bowlTop, { range: 3.2, prompt: 'look into the bowl' });
  const lampAt = P.lamp.clone().add(V(0, 1.4, 0));
  thing(THINGS.lamp, lampAt, { range: 3, prompt: 'look at the call-lamp' });

  // ---------------------------------------------------------------- the call-lamp and Wren's cab
  const lampHead = P.lampHead, lampWorld = V(0, 0, 0);
  const lampLight = new THREE.Vector4(0, -1e5, 0, 0);
  level.lights.push(lampLight);
  const cab = new Taxi(physics, '#f2c54b', 2.1, null);
  cab.driverOut = () => !!people.wren;   // Wren drives it until she steps out by the lamp
  const cabHome = P.cab.clone(), cabHeading = facing(P.cab, P.lamp) + Math.PI / 2;
  // before the lamp: she circles low in the depths, looking for a fare that never calls
  const circling = (t, taxi) => {
    const a = t * 0.045 + 1.3, rad = 150;
    taxi.pos.set(Math.cos(a) * rad, -255 + Math.sin(t * 0.3) * 6, Math.sin(a) * rad);
    taxi.heading = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI;
    taxi.bank = -0.18; taxi.pitch = 0;
  };
  const home = (t, taxi) => { taxi.pos.copy(cabHome); taxi.pos.y += Math.sin(t * 1.3) * 0.15; taxi.heading = cabHeading; taxi.bank = 0; taxi.pitch = 0; };
  cab.lane = game.flag('incal.lamp.lit') ? home : circling;
  cab.update(0, null, 0);
  scene.add(cab.object);
  level.vehicles.push(cab);
  player.vehicles.push(cab);
  if (game.flag('incal.lamp.lit')) { cab.pos.copy(cabHome); cab.mode = 'parked'; cab.parkY = cabHome.y; }
  const lightLamp = () => {
    if (game.flag('incal.lamp.lit')) return;
    if (!quests.isStarted('incal.wren')) quests.start('incal.wren');
    game.set('incal.lamp.lit', true);
    toast('The call-lamp flickers, coughs out a moth, and burns yellow over the void.');
    sound.chime?.();
    // somewhere out in the depths, a cab turns toward it
    cab.lane = home;
    if (cab.mode !== 'driven') { cab.target = cabHome.clone(); cab.targetHeading = cabHeading; cab.mode = 'hail'; }
    setTimeout(() => wrenSpawn(), 2500);
  };
  registerTarget({ kind: 'lamp', radius: 0.9, position: () => lampHead.mesh.getWorldPosition(lampWorld), enabled: () => !game.flag('incal.lamp.lit') && flat(player.pos, P.lamp) < 80,
    onHit: (mode) => {
      if (mode === 'shoot') { lightLamp(); return true; }
      st.lampWobble = 1;
      return true;
    } });
  if (game.flag('incal.lamp.lit')) wrenSpawn();
  quests.locate('lamp', () => lampAt);

  // the cabs don't stop in the depths; after Wren, hailing down there brings her
  const refuse = () => {
    const now = performance.now?.() ?? 0;
    if (now - st.refuseT < 6000) return;
    st.refuseT = now;
    toast(game.flag('incal.lamp.lit') ? 'The cab slows, looks at the smog, and flies on. Wren is the one who stops down here.' : 'The cab slows, looks at the smog and the laundry, and flies on. Cabs don’t stop down here.');
  };
  const cabHail = cab.hail.bind(cab);
  for (const v of level.vehicles) {
    if (v.kind !== 'taxi') continue;
    const own = v.hail.bind(v);
    v.hail = (p, h) => {
      if (p.y > DEPTHS) return own(p, h);
      if (game.flag('incal.wren.met')) return cabHail(p, h);
      refuse();
    };
  }

  // ---------------------------------------------------------------- the light, given back
  const incalPos = () => V(rig.pos.x, rig.pos.y, rig.pos.z);
  quests.locate('crown', () => P.palace.crown);
  quests.locate('incal', incalPos);
  const onPalace = (p) => Math.hypot(p.x, p.z) < 60 && p.y > PY - 3 && p.y < PY + 60;
  const lowerLights = [];
  {
    // warm lamps along the lower terraces' promenades (only the nearest few reach the shader)
    for (const t of S.terraces) {
      if (t.y > -80 || lowerLights.some((l) => l.ty === t.y)) continue;
      for (let k = 0; k < 6; k++) {
        const a = t.a0 + (k + 0.5) / 6 * (t.a1 - t.a0), r = t.r0 + 8;
        lowerLights.push({ ty: t.y, at: new THREE.Vector4(Math.cos(a) * r, t.y + 4, Math.sin(a) * r, 26), v: new THREE.Vector4(0, -1e5, 0, 0) });
      }
    }
    for (const l of lowerLights) level.lights.push(l.v);
  }
  // what the story's people say in passing follows the story
  const say = () => {
    if (lit()) {
      people.nima.lines = ['~happy~ Once a day.', '~playful~ Did you look up today?', '~happy~ The steps went gold.'];
      people.ossa.lines = ['~solemn~ Eyes open, face up.', '~surprised~ It came all the way down.', '~happy~ It doesn’t sting.'];
      people.dov.lines = ['~playful~ I looked. On duty.', '~happy~ Worth it.', '~playful~ Eyes on the visitors. Mostly.'];
      people.pip.lines = ['~shout~ I SAW IT!', '~happy~ Twelve seconds! More!', '~surprised~ It’s still there!'];
    } else if (quests.has('splinter')) people.ossa.lines = ['~solemn~ Up, all the way up.', '~neutral~ Hold it higher.'];
    if (game.flag('incal.wren.met') && people.wren) people.wren.lines = ['~curious~ Need a lift?', '~neutral~ Space to climb, Shift to drop.', '~happy~ She knows the way home.'];
  };
  say();
  game.on('flag', ({ name }) => { if (name.startsWith('incal.')) say(); });
  const zoneOf = (p) => p.spot?.id ?? (p.pos.y >= S.TOP - 1 ? 'rim' : p.pos.y >= S.LEVELS[1] - 1 ? 'upper' : p.pos.y >= S.LEVELS[4] - 1 ? 'middle' : 'lower');
  // the billboards on the shaft wall stop selling: LOOK UP, on every one (one mesh, shown once it burns)
  const lookUp = (() => {
    const parts = S.billboards.map((b, i) => textGeometry(i % 3 === 2 ? 'ONCE\nA DAY' : 'LOOK\nUP', { width: b.w * (i % 3 === 2 ? 0.62 : 0.42), depth: 0.06 })
      .applyMatrix4(new THREE.Matrix4().compose(b.pos.clone().add(V(0, 0, 0).set(0, 0, 0.47).applyQuaternion(b.quat)), b.quat, V(1, 1, 1))));
    const m = new THREE.Mesh(mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; })), makeMaterial({ color: '#fff8e8', flat: true, glow: 0.9, key: 'incal.lookUp' }));
    m.userData.noCollide = true; m.visible = false;
    scene.add(m);
    return m;
  })();
  const applyLit = (instant) => {
    lookUp.visible = true;
    if (crowd) for (const p of crowd.people) { const z = zoneOf(p); p.lines = LINES.lit[z] ?? p.lines; }
    for (const l of lowerLights) l.v.copy(l.at);
    sound.setBandMode?.('shrine', 'feast');
    splinter.visible = false;
    if (instant) { st.k = 1; rig.k = 1; }
  };
  if (lit()) applyLit(true);
  // the moment, framed: from out beside the palace, low, looking up past the dome to the light
  // (the follow camera can't look that steeply up); blends in, holds through the flare, blends out
  const startCine = () => {
    // from out on the +x side, low beside the dome: the crown below, the light above, open sky beyond
    // (the megastructure hangs over the −x side)
    st.cine = { t: 0, dur: 11, eye: V(100, PY + 4, 34), look: V(0, PY + 80, 0) };
  };
  const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = V(0, 0, 0);
  const frameCamera = (camera) => {
    const c = st.cine;
    if (!c) return;
    const w = THREE.MathUtils.smootherstep(c.t, 0, 1.6) * (1 - THREE.MathUtils.smootherstep(c.t, c.dur - 1.8, c.dur));
    if (w <= 0) return;
    _e.copy(c.eye).addScaledVector(UP, c.t * 0.5);   // a slow rise
    camera.position.lerp(_e, w);
    _m.lookAt(camera.position, c.look, UP);
    _q.setFromRotationMatrix(_m);
    camera.quaternion.slerp(_q, w);
    camera.updateMatrixWorld();
  };
  const giveBack = (camera) => {
    if (st.release || lit()) return;
    startCine();
    st.release = { t: 0, from: splinter.position.clone() };
    toast('The splinter slips out of your hand and climbs, singing, toward the light.');
    sound.whoosh?.();
  };
  const arrive = () => {
    quests.take('splinter');
    if (quests.stage(Q) === 'palace') quests.set(Q, 'look');   // straight past the guard: fine
    game.set('incal.lit', true);
    rig.flare = 1.4;
    sound.chime?.();
    applyLit(false);
    // every level looks up with you, for a while; the people near you say so
    if (crowd) {
      crowd.lookAt?.(incalPos(), 28);
      const near = crowd.people.filter((p) => p.pos.distanceToSquared(player.pos) < 60 * 60).slice(0, 8);
      near.forEach((p, i) => { p.say = LINES.shout[i % LINES.shout.length]; p.shoutUntil = crowd.time + 3 + i * 0.4; });
      if (near[0]) crowd.shout = near[0];
    }
    for (const n of Object.values(people)) if (n) n.shout = { text: n === people.dov ? '~solemn~ …' : '~shout~ Look!', until: n.time + 3 };
    toast('The Lodestar flares. Light pours down the shaft, level after level, all the way to the bottom.');
  };
  // sending messages home: once it burns, the HUD objective is to tell Nima (quest stage 'tell')

  // ---------------------------------------------------------------- the main quest's end
  quests.def(Q).onDone = () => {
    game.set('world.incal.done', true);
    game.addKeepsake({ id: 'incal.word', level: 'incal', name: 'Look up once a day', kind: 'word', text: '“Look up once a day. Wherever you are, whatever is up there.” Nima, who sweeps the high terrace.' });
    setTimeout(() => story.complete?.(), 1200);
  };
  quests.locate('palaceGate', () => P.palace.gate);

  // ---------------------------------------------------------------- music: the shrine's hum
  sound.setBands?.([
    { id: 'shrine', pos: P.shrine, radius: 70, parts: ['chant', 'bell'], mode: lit() ? 'feast' : 'play', vol: 0.6, duck: 0.4 },
  ]);

  // ---------------------------------------------------------------- per frame
  const look = V(0, 0, 0);
  const update = (dt, t, { camera }) => {
    const pp = player.pos;
    // the light: eases toward its state; a flare fades
    st.k += ((lit() ? 1 : 0) - st.k) * (1 - Math.exp(-dt / 2.2));
    rig.k = st.k;
    rig.flare = Math.max(0, (rig.flare ?? 0) - dt * 0.35);
    if (st.cine && (st.cine.t += dt) > st.cine.dur) st.cine = null;

    // the splinter: in the bowl, at your shoulder, or on its way home
    if (st.release) {
      const r = st.release, k = Math.min(1, (r.t += dt) / 3.6), e = THREE.MathUtils.smootherstep(k, 0, 1);
      const to = incalPos();
      splinter.position.lerpVectors(r.from, to, e);
      splinter.position.x += Math.sin(k * Math.PI) * 6; splinter.position.y += Math.sin(k * Math.PI) * 10;
      splinter.scale.setScalar(1 + e * 6);
      splMat.uniforms.uGlow.value = 1;
      if (k >= 1) { st.release = null; splinter.visible = false; arrive(); }
    } else if (quests.has('splinter')) {
      splinter.visible = true;
      const f = player.frame?.dir ? player.frame.dir(player.heading, _d) : _d.set(Math.sin(player.heading), 0, Math.cos(player.heading));
      look.copy(pp).addScaledVector(UP, 1.9 + Math.sin(t * 2.1) * 0.08).add(_v.set(-f.z * 0.55, 0, f.x * 0.55)).addScaledVector(f, -0.2);
      splinter.position.lerp(look, 1 - Math.exp(-dt * 10));
      splinter.rotation.y = t * 1.6;
      // the people of the middle and the bottom notice what you carry
      if (crowd && pp.y < S.LEVELS[2] && (st.carryT -= dt) <= 0) {
        st.carryT = 0.8;
        for (const p of crowd.people) {
          if (p.pos.distanceToSquared(pp) > 14 * 14 || Math.abs(p.pos.y - pp.y) > 3) continue;
          p.lookUntil = crowd.time + 2.5;
          if (p.shoutUntil < crowd.time - 6 && Math.random() < 0.05) { p.say = LINES.carrying[Math.floor(Math.random() * LINES.carrying.length)]; p.shoutUntil = crowd.time + 2.6; crowd.shout = p; }
        }
      }
    } else if (!lit() && !game.flag('incal.splinter.given')) {
      // in the bowl (drawn only when you're down there)
      splinter.visible = !camera || camera.position.distanceToSquared(P.bowlTop) < 160 * 160;
      splinter.position.copy(P.bowlTop); splinter.position.y += Math.sin(t * 1.7) * 0.04;
      splinter.rotation.y = t * 0.5;
    }

    // look up at the light from the palace with the splinter: it goes home
    if ((quests.stage(Q) === 'look' || quests.stage(Q) === 'palace') && quests.has('splinter') && !st.release && camera && onPalace(pp)) {
      camera.getWorldDirection(_d);
      const to = _v.copy(incalPos()).sub(camera.position).normalize();
      const up = _d.y > 0.4 || _d.dot(to) > 0.9;
      st.lookT = up ? st.lookT + dt : Math.max(0, st.lookT - dt * 2);
      if (st.lookT > 1.0) giveBack(camera);
      if (!st.hinted && quests.stage(Q) === 'look') { st.hinted = true; toast('The splinter tugs upward. Look up at the light (move the camera up).'); }
    }

    // the call-lamp: lit, it sways a little and throws light; a push only rattles it
    st.lampK += ((game.flag('incal.lamp.lit') ? 1 : 0) - st.lampK) * (1 - Math.exp(-dt * 3));
    if (flat(pp, P.lamp) < 300) {
      lampHead.mat.uniforms.uColor.value.set('#5d574b').lerp(_c.set('#ffd27a'), st.lampK);
      lampHead.mat.uniforms.uGlow.value = st.lampK * (0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 3.3));
      lampHead.signMat.uniforms.uGlow.value = st.lampK * 0.8;
      lampHead.mesh.getWorldPosition(lampWorld);
      if (st.lampK > 0.05) lampLight.set(lampWorld.x, lampWorld.y, lampWorld.z, 14 * st.lampK); else lampLight.set(0, -1e5, 0, 0);
      if (st.lampWobble > 0) { st.lampWobble = Math.max(0, st.lampWobble - dt * 2); lampHead.mesh.position.y = 4.1 + Math.sin(st.lampWobble * 30) * 0.05 * st.lampWobble; }
    }
  };
  const _c = new THREE.Color();

  return {
    people, update, state: st, cab, frameCamera,
    giveBack, lightLamp,
    /** E on a crowd person: a short conversation, by where they live (and whether the light is back). */
    crowdTalk(p) {
      const z = zoneOf(p);
      const list = lit() && (z === 'lower' || z === 'middle' || p.seed < 0.35) ? CROWD_TALK.lit : CROWD_TALK[z];
      if (!list) return null;
      const base = list[Math.floor(p.seed * 997) % list.length];
      return { id: `crowd.incal.${z}`, color: p.style?.cloak ?? '#d8a24a', kind: p.kind, seed: `crowd:${p.id}`, scale: p.size, ...base }   // a voice of their own (src/story/voice.js voiceOf hashes the seed);
    },
  };
}

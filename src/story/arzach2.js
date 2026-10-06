import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { registerTarget } from '../targets.js';
import { Flames } from './flames.js';
import { ownMaterial } from './puffs.js';
import { game as sharedGame } from '../game-state.js';
import { audioAway } from '../audio-guard.js';
import { QUESTS, PEOPLE, LOCALS, THINGS, ITEMS, CAIRN_STONES } from './arzach2-data.js';

// Vael II's story, alive (arzach2-data.js has the words): "The Bell Under the Cloud".
//
//   the start plateau  Sister Aube by her hermitage, watching the cloud
//   the monastery      Brother Calix under the bell tower, Mother Ysolde by the
//                      courtyard wall; the bell in its open belfry, its rope
//   the island         the clapper, lying before the church door under a heap of
//                      tiles that fell up with it (push them off)
//   the great table    Tiv by his cairn's footing stone; the sky stones climb
//                      round from the table's east rim, three cairn stones on them
//   the plain          Ondine, walking to the lone tower; the face on its plinth,
//                      and the monks' old signal lamp beside it: push its tiller
//                      round until the mirror looks at the carved bell (the rose
//                      cliff), light it with a shot, and Ysolde's lamp answers
//
// Ringing the bell swings it in the belfry and tolls; the cloud sea settles
// (its puffs and deck sink), and the floating stones come down a little. After
// Calix gives you the note, the tank sings it whenever you shoot, in every
// world (the listener below is installed when this module loads).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const SETTLE = 16;          // m the cloud sinks when the bell rings
const NOTCH = Math.PI / 4;  // the signal lamp's turntable: eight notches
const LS = 1.35;            // the signal lamp's size (it's drawn at a person's scale, then grown to read from afar)
export const LAMP_START = 3; // the notch it stands at (0 faces the rose cliff)
const STONES_DOWN = 6;      // m the floating stones come down

// ------------------------------------------------------------------ the bell's note, from the tank
// A low FM bell. In Vael II it plays through the level's Sound; elsewhere the
// module keeps a tiny AudioContext of its own (shooting is a user gesture).
let noteSound = null, ownCtx = null, lastNote = -1;
export function playBellNote({ vol = 0.07, f = 164.8 } = {}) {
  try {
    if (globalThis.localStorage?.getItem('moebius.muted') === '1' || audioAway()) return false;
    if (noteSound?.ctx) { noteSound.instrument?.('bell', f, noteSound.ctx.currentTime + 0.05, 2, vol * 1.4, noteSound.fx); return true; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    ownCtx ??= new AC();
    const ctx = ownCtx, t = ctx.currentTime + 0.05;
    if (ctx.state === 'suspended') ctx.resume();
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), out = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(1, t + 2.4);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(vol, t + 0.01); out.gain.exponentialRampToValueAtTime(0.0005, t + 3);
    mod.connect(mg).connect(car.frequency); car.connect(out).connect(ctx.destination);
    car.start(t); mod.start(t); car.stop(t + 3.1); mod.stop(t + 3.1);
    return true;
  } catch { return false; }
}
sharedGame.on('tool:fire', (e) => {
  if (e?.mode !== 'shoot' || !sharedGame.flag('arzach2.bell.note')) return;
  const now = globalThis.performance?.now?.() ?? 0;
  if (now - lastNote < 250) return;
  lastNote = now;
  playBellNote();
});

export function setupArzach2(ctx) {
  const { level, physics, player, quests, dialogue, game, sound, story, spawn, talkable, scene, toast, npcs } = ctx;
  const A = level.arzach2;
  if (!A) return null;
  noteSound = sound;
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = { ...(quests.itemNames ?? {}), ...ITEMS };
  // the main quest doesn't just appear: it starts when you talk to Sister Aube (the scout finds them till then: src/story/quests.js opensWith)
  if (!quests.isStarted('arzach2.bell')) quests.opensWith('arzach2.bell', 'aube');
  if (game.flag('arzach2.cairn.placed') === undefined) game.set('arzach2.cairn.placed', 0);
  const ground = (x, z, from) => { const g = physics.groundAt(x, from, z, 60); return Number.isFinite(g) ? g : from - 3; };
  const Q = 'arzach2.bell';

  // ---------------------------------------------------------------- the people
  const people = {};
  LOCALS.forEach((def, i) => { const n = npcs[i]; if (n && !n.def?.talk) { talkable(n, def); people[def.id] = n; } });
  const ysAt = V(-244, 0, -246); ysAt.y = ground(ysAt.x, ysAt.z, A.monastery.y + 10);
  people.ysolde = spawn(PEOPLE.ysolde, { route: [ysAt.clone(), V(-238, ground(-238, -249, A.monastery.y + 10), -249)], speed: 0.5 });
  const tivAt = V(-22, 0, -443); tivAt.y = ground(tivAt.x, tivAt.z, A.table.y + 6);
  people.tiv = spawn(PEOPLE.tiv, { route: [tivAt.clone()], heading: angleTo(tivAt, A.sky[0].pos) });

  // ---------------------------------------------------------------- things
  const thing = (def, at, { range = 3, prompt, enabled = () => true, use, height = 4 } = {}) => registerInteractable({
    id: def.id, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ')}`,
    at: () => at, enabled, distance: (p) => (Math.abs(p.pos.y - at.y) < height ? flat(p.pos, at) : Infinity),
    use: use ?? (() => dialogue.start(def, null, at)),
  });
  thing(THINGS.face, A.face, { range: 7, height: 8, prompt: 'look at the face on the tower' });

  // ---------------------------------------------------------------- the signal lamp on the plinth, and Ysolde's lamp on the cliff
  // Ondine answers the letter with a light: the monks' old signal brazier beside the face. Its
  // turntable has eight notches; push the tiller side-on and it turns one notch (pushed straight
  // along, it jams). Notch 0 looks at the little carved bell: the rose cliff. Lit (a shot) and
  // turned to the bell, after the letter is read, Ysolde's lamp on the monastery wall answers.
  const L = 'arzach2.letter';
  const lampAt = V(A.tower.x + 8.5, 0, A.tower.z + 8.5); lampAt.y = ground(lampAt.x, lampAt.z, A.face.y + 12);
  const ysLampAt = ysAt.clone().add(V(1.6, 0, 1.2)); ysLampAt.y = ground(ysLampAt.x, ysLampAt.z, A.monastery.y + 10);
  const aim0 = angleTo(lampAt, ysLampAt);
  const notch = () => (((game.flag('arzach2.lamp.notch') ?? LAMP_START) % 8) + 8) % 8;
  const yawOf = (n) => aim0 + n * NOTCH;
  const lampLit = () => !!game.flag('arzach2.lamp.lit');
  const answered = () => !!game.flag('arzach2.lamp.answered');
  const brass = makeMaterial({ color: '#c99a52', flat: true, metal: 'brass' });
  const stoneLamp = makeMaterial({ color: '#efe4cf', flat: true });
  const ink = makeMaterial({ color: '#3c4660', flat: true });
  const wood = makeMaterial({ color: '#8a5a3a', flat: true });
  const lampGroup = new THREE.Group();
  lampGroup.position.copy(lampAt);
  lampGroup.scale.setScalar(LS);
  lampGroup.userData.noCollide = true;
  scene.add(lampGroup);
  {
    // the fixed ring: eight notches cut round the turntable, a little brass bell by the one that faces the cliff
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.5, 16).translate(0, 0.25, 0), stoneLamp);
    lampGroup.add(drum);
    for (let i = 0; i < 8; i++) {
      const a = yawOf(i), m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.3), ink);
      m.position.set(Math.sin(a) * 1.3, 0.04, Math.cos(a) * 1.3); m.rotation.y = a;
      lampGroup.add(m);
    }
    const bellMark = new THREE.Group();
    bellMark.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 0.32, 8).translate(0, 0.16, 0), brass), new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4).translate(0, 0.34, 0), brass));
    bellMark.position.set(Math.sin(aim0) * 1.62, 0, Math.cos(aim0) * 1.62);
    lampGroup.add(bellMark);
  }
  // the turning head: post, brazier, the mirror cupped behind it, a cap, the tiller out the back
  const head = new THREE.Group();
  head.rotation.y = yawOf(notch());
  lampGroup.add(head);
  const mirrorMat = ownMaterial({ color: '#e8c27a', flat: true, metal: 'brass', side: THREE.DoubleSide });
  {
    head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.1, 8).translate(0, 1.0, 0), brass));
    head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.35, 12).translate(0, 1.7, 0), brass));
    // the mirror: a shallow brass cup facing +z (the way the light goes)
    const cup = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 8, 0, Math.PI * 2, 0, 0.75).rotateX(-Math.PI / 2).translate(0, 1.9, 0.95), mirrorMat);
    head.add(cup);
    for (const sx of [-1, 1]) head.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06).translate(sx * 0.42, 2.25, -0.05), brass));
    head.add(new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.42, 12).translate(0, 2.98, -0.05), brass));
    head.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.75).translate(0, 1.05, -1.05), wood));
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6).translate(0, 1.05, -1.95), wood));
  }
  head.traverse((o) => { o.userData.noCollide = true; });
  const gripAt = () => lampAt.clone().add(V(-Math.sin(head.rotation.y) * 1.85 * LS, 1.05 * LS, -Math.cos(head.rotation.y) * 1.85 * LS));
  const flameAt = lampAt.clone().add(V(0, 1.86 * LS, 0));
  // the beam: thin rays out of the mirror, the way it faces
  const rayMat = makeMaterial({ color: '#ffe6b0', glow: 1, flat: true });
  const beam = new THREE.Group();
  for (const [yaw, pitch, len, r] of [[0, 0.01, 34, 0.32], [0.035, 0.03, 26, 0.2], [-0.04, -0.005, 30, 0.24], [0.012, 0.05, 20, 0.16]]) {
    // a long spindle: from a point at the mirror, widest two-thirds out, back to a point (a comic-book ray)
    const prof = [[0.03, 0], [r * 0.7, len * 0.3], [r, len * 0.62], [r * 0.45, len * 0.88], [0, len]].map(([x, y]) => new THREE.Vector2(x, y));
    const ray = new THREE.Mesh(new THREE.LatheGeometry(prof, 6).rotateX(Math.PI / 2).rotateX(-pitch).rotateY(yaw), rayMat);
    ray.position.set(0, 1.95, 0.25);
    beam.add(ray);
  }
  beam.traverse((o) => { o.userData.noCollide = true; });
  beam.visible = false;
  head.add(beam);
  let flames = null;
  const kindle = () => {
    if (flames) return;
    const tongues = [{ at: V(0, 0, 0), h: 0.95, r: 0.26, core: 1 }];
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; tongues.push({ at: V(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2), h: 0.55 + (i % 2) * 0.2, r: 0.16 }); }
    const f = new THREE.Group(); f.position.copy(flameAt); f.scale.setScalar(LS); f.userData.noCollide = true; scene.add(f);
    flames = new Flames(f, tongues, { seed: 7 });
    beam.visible = true;
    mirrorMat.uniforms?.uGlow && (mirrorMat.uniforms.uGlow.value = 0.5);
    level.lights?.push(new THREE.Vector4(flameAt.x, flameAt.y + 0.5, flameAt.z, 10));
  };
  if (lampLit()) kindle();
  // Ysolde's lamp: on a post by her spot on the monastery wall; it answers, and burns from then on
  const ysLamp = new THREE.Group();
  ysLamp.position.copy(ysLampAt);
  {
    ysLamp.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 0.14).translate(0, 1.1, 0), wood));
    ysLamp.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08).translate(0.2, 2.15, 0), wood));
    ysLamp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 6).translate(0.42, 1.88, 0), brass));
  }
  const ysGlowMat = makeMaterial({ color: '#ffd98a', glow: 1, flat: true });
  const ysGlow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), ysGlowMat);
  ysGlow.position.set(0.42, 1.88, 0);
  ysGlow.visible = answered();
  ysLamp.add(ysGlow);
  ysLamp.traverse((o) => { o.userData.noCollide = true; });
  scene.add(ysLamp);
  const ysLight = new THREE.Vector4(ysLampAt.x + 0.42, ysLampAt.y + 2.2, ysLampAt.z, answered() ? 6 : 0);
  level.lights?.push(ysLight);
  const lampSt = { blink: -1, jam: 0, lonely: false, wayward: false, turned: false, splashed: false };
  const answer = () => {
    if (answered() || !lampLit() || notch() !== 0) return false;
    if (!quests.reached(L, 'lamp')) {
      if (!lampSt.lonely) { lampSt.lonely = true; toast('The beam reaches out across the plain toward the rose cliff. Nobody there is watching for it yet.'); }
      return false;
    }
    game.set('arzach2.lamp.answered', true);
    ysGlow.visible = true; ysLight.w = 6; lampSt.blink = 0;
    sound.chime?.();
    toast('The beam reaches across the plain to the rose cliff. For a long moment, nothing. Then, far off on the cliff wall, a small light answers: three long, one short.');
    const o = people.ondine; if (o) o.shout = { text: '~shout~ She answered!', until: o.time + 4 };
    return true;
  };
  const light = () => {
    if (lampLit()) return false;
    game.set('arzach2.lamp.lit', true);
    kindle();
    sound.whoosh?.();
    if (notch() !== 0) toast('The old wick takes the light, and the mirror throws a beam out across the plain. Not toward the cliff, though: the carved bell is behind it.');
    else if (!answer()) toast('The old wick takes the light, and the mirror throws a beam toward the rose cliff.');
    return true;
  };
  registerTarget({ kind: 'lamp', radius: 1.2, accepts: ['fire'], position: () => flameAt, enabled: () => flat(player.pos, lampAt) < 60,
    onHit: (mode) => {
      if (mode === 'push') return true;   // (the tiller takes the shove)
      if (!light()) answer();
      return true;
    } });
  const turn = (by) => {
    game.set('arzach2.lamp.notch', (((notch() + by) % 8) + 8) % 8);
    sound.critter?.('clack', 0.7);
    if (notch() === 0) {
      if (!lampLit()) toast('The turntable clunks into the notch by the carved bell. The mirror looks north now, at the rose cliff, far off over the plain.');
      else answer();
    } else if (!lampSt.turned) { lampSt.turned = true; toast('The turntable grinds round one notch. The carved bell is still not under the mirror.'); }
  };
  registerTarget({ kind: 'tiller', radius: 0.9, position: gripAt, enabled: () => flat(player.pos, lampAt) < 30,
    onHit: (mode, point, dir) => {
      if (mode !== 'push') {
        if (!lampSt.splashed) { lampSt.splashed = true; toast('The fluid splashes the old tiller. It wants a shove, not a splash.'); }
        return true;
      }
      const yaw = yawOf(notch());
      const h = Math.hypot(dir?.x ?? 0, dir?.z ?? 0) || 1, px = (dir?.x ?? 0) / h, pz = (dir?.z ?? 0) / h;
      const side = px * -Math.cos(yaw) + pz * Math.sin(yaw);
      if (Math.abs(side) < 0.35) { lampSt.jam = 1; toast('The tiller shudders against its pin. Shoved straight along, it won’t turn: push it from the side.'); return true; }
      turn(side > 0 ? 1 : -1);
      return true;
    } });
  thing(THINGS.lamp, lampAt, { range: 3.4, height: 5, prompt: 'look at the signal lamp' });
  game.on('quest', (e) => { if (e?.id === L) answer(); });

  // ---------------------------------------------------------------- the clapper, on the island
  const bronze = makeMaterial({ color: '#c99a52', flat: true, metal: 'brass' });
  const clapperGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.6, 6).translate(0, 0.8, 0);
  const clapperBall = new THREE.SphereGeometry(0.42, 10, 8);
  const makeClapper = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(clapperGeo, bronze), new THREE.Mesh(clapperBall, bronze));
    g.userData.noCollide = true;
    return g;
  };
  let lying = null, tiles = null;
  const clapperAt = A.clapper.clone();
  // the roof tiles that fell up with it have come down on top of it: a shove scatters them, and they fall up again
  const tileMat = makeMaterial({ color: '#c9765c', flat: true });
  const tileGeo = new THREE.BoxGeometry(0.95, 0.09, 0.62);
  function heapTiles(clapper) {
    const g = new THREE.Group();
    g.userData.noCollide = true;
    const rod = V(0, 1, 0).applyEuler(clapper.rotation);
    const centre = clapper.position.clone().addScaledVector(rod, 0.95).setY(clapperAt.y);
    const list = [];
    for (let i = 0; i < 13; i++) {
      const m = new THREE.Mesh(tileGeo, tileMat);
      const a = i * 2.4, r = 0.2 + (i % 4) * 0.24;
      m.position.set(centre.x + Math.cos(a) * r, centre.y + 0.1 + (i < 5 ? 0.04 : 0.3 + (i - 5) * 0.07), centre.z + Math.sin(a) * r);
      m.rotation.set(Math.sin(i * 1.7) * 0.5, a * 0.8, Math.cos(i * 1.3) * 0.45);
      m.userData.noCollide = true;
      g.add(m);
      list.push({ m, v: V(), w: V() });
    }
    scene.add(g);
    const st = { g, list, centre, covered: true, t: -1, hinted: false };
    const off = registerTarget({ kind: 'tiles', radius: 1.5, position: () => centre, enabled: () => st.covered && flat(player.pos, centre) < 60,
      onHit: (mode, point, dir) => {
        if (mode !== 'push') {
          for (const x of list) x.m.rotation.z += (Math.random() - 0.5) * 0.04;
          if (!st.hinted) { st.hinted = true; toast('The fluid rattles off the tiles. They are wedged tight: shove them off (push: C, middle click, or RB / R1).'); }
          return true;
        }
        scatterTiles(st, dir); off(); offLook();
        return true;
      } });
    const offLook = registerInteractable({ id: 'tiles', priority: PRIORITY.use, range: 2.8, prompt: 'look at the heap of tiles', at: () => centre, enabled: () => st.covered,
      distance: (p) => (Math.abs(p.pos.y - centre.y) < 3 ? flat(p.pos, centre) : Infinity), use: () => dialogue.start(THINGS.tiles, null, centre) });
    return st;
  }
  function scatterTiles(st, dir) {
    st.covered = false; st.t = 0;
    const d = V(dir?.x ?? 0, 0, dir?.z ?? 1);
    if (d.lengthSq() < 1e-4) d.set(0, 0, 1);
    d.normalize();
    for (const x of st.list) {
      x.v.copy(d).multiplyScalar(2.5 + Math.random() * 2.5).add(V((Math.random() - 0.5) * 2, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 2));
      x.w.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    }
    game.set('arzach2.tiles.cleared', true);
    sound.critter?.('clack', 0.8); sound.whoosh?.();
    toast('The tiles scatter, then lift off the island one by one, falling up again, slowly, into the sky. Under them lies the clapper.');
  }
  if (!quests.has('clapper') && !game.flag('arzach2.clapper.hung')) {
    lying = makeClapper();
    lying.position.copy(clapperAt).add(V(0, 0.35, 0));
    lying.rotation.set(0, 0.6, Math.PI / 2 - 0.15);
    scene.add(lying);
    const light = new THREE.Vector4(clapperAt.x, clapperAt.y + 1, clapperAt.z, 7);
    level.lights?.push(light);
    if (!game.flag('arzach2.tiles.cleared')) tiles = heapTiles(lying);
    const off = registerInteractable({ id: 'clapper', priority: PRIORITY.use, range: 2.8, prompt: 'pick up the bell’s clapper', at: () => clapperAt,
      enabled: () => !tiles?.covered,
      distance: (p) => (Math.abs(p.pos.y - clapperAt.y) < 3 ? flat(p.pos, clapperAt) : Infinity),
      use: () => {
        quests.give('clapper');
        toast(`Picked up ${ITEMS.clapper}. It is warm, and it hums very faintly against your hand.`);
        if (!quests.reached(Q, 'clapper')) quests.set(Q, 'clapper');
        lying.removeFromParent(); off(); light.set(0, -1e5, 0, 0); sound.chime();
      } });
  }
  // the clapper back in the bell (once Calix has hung it)
  const hungClapper = makeClapper();
  hungClapper.rotation.x = Math.PI;
  hungClapper.position.set(0, -0.5, 0);
  hungClapper.scale.setScalar(1.15);
  hungClapper.visible = !!game.flag('arzach2.clapper.hung');
  A.bell.add(hungClapper);
  game.on('flag:arzach2.clapper.hung', (v) => { hungClapper.visible = !!v; });

  // ---------------------------------------------------------------- the bell, the rope, the cloud
  // The rope sways after a pull: out from the tower and back to hanging straight (never past it,
  // so it can't swing in through the wall), and a little sideways along the wall.
  const ropeSway = (rope, t, decay) => {
    rope.rotation.x = -0.035 * (1 - Math.cos(t * 5)) * decay;   // <= 0: the foot only ever moves away from the wall (+z)
    rope.rotation.z = Math.sin(t * 3.1) * 0.025 * decay;
  };
  const bell = { t: -1, amp: 0, tolls: 0, settle: game.flag('arzach2.bell.rung') ? 1 : 0, dip: 0, ringing: false, next: 75 };
  const toll = (vol = 0.16) => {
    if (!sound.ctx || !sound.instrument) return;
    const t = sound.ctx.currentTime;
    sound.instrument('bell', 82.4, t, 3, vol, sound.fx);
    sound.instrument('bell', 164.8, t + 0.01, 3, vol * 0.8, sound.fx);
    sound.instrument('bell', 246.9, t + 0.02, 2, vol * 0.25, sound.fx);
  };
  const ring = (hard = true) => {
    bell.t = 0; bell.amp = hard ? 0.42 : 0.2; bell.ringing = true; bell.tolls = 0;
  };
  const pull = () => {
    if (!game.flag('arzach2.clapper.hung')) {
      bell.t = 0; bell.amp = 0.18; bell.ringing = false;
      dialogue.start(THINGS.bell, null, A.ropeFoot);
      return;
    }
    ring(true);
    if (!game.flag('arzach2.bell.rung')) {
      game.set('arzach2.bell.rung', true);
      toast('The bell speaks: one low note that goes on and on. Under the cliffs, the cloud begins to settle.');
      for (const id of ['calix', 'ysolde']) { const n = people[id]; if (n) n.shout = { text: id === 'calix' ? '~shout~ Listen. Listen!' : '~shout~ Thirty years!', until: n.time + 3 }; }
    } else bell.dip = 1;
  };
  registerInteractable({ id: 'bellrope', priority: PRIORITY.use, range: 2.6, at: () => A.ropeFoot,
    prompt: () => (game.flag('arzach2.clapper.hung') ? 'pull the bell rope' : 'pull the bell rope'),
    distance: (p) => (Math.abs(p.pos.y - A.ropeFoot.y) < 3 ? flat(p.pos, A.ropeFoot) : Infinity), use: pull });

  // ---------------------------------------------------------------- the cairn and the sky stones
  const stoneMat = makeMaterial({ color: '#f4ecdc', flat: true, glow: 0.12 });
  const stoneGeo = (s) => new THREE.SphereGeometry(1, 10, 7).scale(s.r * 1.15, s.r * s.sy, s.r);
  const stones = {};
  for (const s of CAIRN_STONES) {
    const sky = A.sky[s.sky];
    const m = new THREE.Mesh(stoneGeo(s), stoneMat);
    m.userData.noCollide = true;
    const at = sky.pos.clone().add(V(sky.r * 0.35, s.r * s.sy * 0.85, 0));
    m.position.copy(at);
    const st = stones[s.id] = { ...s, m, at, light: new THREE.Vector4(at.x, at.y + 1, at.z, 5) };
    level.lights?.push(st.light);
    scene.add(m);
    if (game.flag(`arzach2.${s.id}`)) { m.visible = false; st.light.set(0, -1e5, 0, 0); }
    st.off = registerInteractable({ id: `stone.${s.id}`, priority: PRIORITY.use, range: 2.6, prompt: `pick up ${ITEMS[s.id]}`, at: () => st.at,
      enabled: () => m.visible && m.parent === scene, distance: (p) => (Math.abs(p.pos.y - st.at.y) < 3 ? flat(p.pos, st.at) : Infinity),
      use: () => {
        m.visible = false; st.light.set(0, -1e5, 0, 0);
        game.set(`arzach2.${s.id}`, true);
        quests.give(s.id);
        if (!quests.isStarted('arzach2.cairn')) quests.start('arzach2.cairn');
        toast(`Picked up ${ITEMS[s.id]}`);
        sound.chime();
      } });
  }
  // the stack, as it grows on the footing stone
  const stackY = [];
  { let y = A.cairn.y; for (const s of CAIRN_STONES) { y += s.r * s.sy; stackY.push(y); y += s.r * s.sy * 0.92; } }
  const placed = CAIRN_STONES.map((s, i) => {
    const m = new THREE.Mesh(stoneGeo(s), makeMaterial({ color: '#efe4cf', flat: true }));
    m.position.set(A.cairn.x + (i - 1) * 0.06, stackY[i], A.cairn.z);
    m.rotation.y = i * 0.9;
    m.userData.noCollide = true;
    m.visible = (game.flag('arzach2.cairn.placed') ?? 0) > i;
    scene.add(m);
    return m;
  });
  game.on('arzach2:cairn', (id) => {
    const n = game.flag('arzach2.cairn.placed') ?? 0;
    if (!quests.has(id)) return;
    if (CAIRN_STONES[n]?.id === id) {
      quests.take(id);
      placed[n].visible = true;
      game.set('arzach2.cairn.last', 'ok');
      game.set('arzach2.cairn.placed', n + 1);
      sound.chime();
      if (n + 1 === 3) { cairnHum = 1; people.tiv && (people.tiv.shout = { text: '~shout~ It stands!', until: people.tiv.time + 3 }); }
    } else {
      game.set('arzach2.cairn.last', null);
      game.set('arzach2.cairn.last', 'fell');
      sound.critter?.('clack', 0.8);
    }
  });
  let cairnHum = 0;
  thing(THINGS.cairn, A.cairn, { range: 3.2, prompt: 'look at Tiv’s cairn' });
  quests.locate('cairnStone', () => {
    let best = null, bd = Infinity;
    for (const st of Object.values(stones)) {
      if (!st.m.visible) continue;
      const d = player.pos.distanceTo(st.at);
      if (d < bd) { bd = d; best = st.at; }
    }
    return best ?? A.cairn;
  });

  // ---------------------------------------------------------------- the story catches up when you take it out of order
  const catchUp = () => {
    if (quests.isDone(Q)) return;
    const want = game.flag('arzach2.bell.rung') ? 'listen' : game.flag('arzach2.clapper.hung') ? 'ring'
      : quests.has('clapper') || game.flag('arzach2.calix.asked') ? 'clapper' : null;
    if (want && !quests.reached(Q, want)) quests.set(Q, want);
  };
  game.on('flag', catchUp);
  catchUp();
  quests.def(Q).onDone = () => {
    game.set('world.arzach2.done', true);
    toast('The bell’s note goes with you. Shoot, and the tank will sing it.');
    setTimeout(() => story.complete?.(), 1500);
  };

  // ---------------------------------------------------------------- places for the quest markers
  for (const [id, n] of Object.entries(people)) quests.locate(id, () => n.pos);
  quests.locate('monastery', () => A.monastery);
  quests.locate('clapper', () => clapperAt);
  quests.locate('rope', () => A.ropeFoot);
  quests.locate('cairn', () => A.cairn);
  quests.locate('face', () => A.face);
  quests.locate('lamp', () => lampAt);

  // ---------------------------------------------------------------- per frame
  // three long, one short (twice), then a steady light
  const BLINK = [[0, 0.8], [1.1, 1.9], [2.2, 3.0], [3.3, 3.5]], BLINK_T = 4.6;
  const blinkOn = (t) => { if (t >= BLINK_T * 2) return true; const u = t % BLINK_T; return BLINK.some(([a, b]) => u >= a && u < b); };
  const cloudBase = A.cloud.map((m) => m.position.y), floatBase = A.floaters.position.y;
  const st = { landed: false };
  const update = (dt, t) => {
    const pp = player.pos;
    // the tiles fall up off the island
    if (tiles && tiles.t >= 0) {
      tiles.t += dt;
      for (const x of tiles.list) {
        x.v.y += dt * (tiles.t < 0.5 ? -6 : 1.4);   // a little hop, then they fall up
        x.v.multiplyScalar(1 - dt * 0.4);
        x.m.position.addScaledVector(x.v, dt);
        x.m.rotation.x += x.w.x * dt; x.m.rotation.y += x.w.y * dt; x.m.rotation.z += x.w.z * dt;
        x.m.scale.setScalar(Math.max(0.01, 1 - Math.max(0, tiles.t - 5) / 3));
      }
      if (tiles.t > 8) { tiles.g.removeFromParent(); tiles.t = -1; }
    }
    // the signal lamp turns to its notch (the short way round); its flame; Ysolde's lamp answers
    {
      const want = yawOf(notch()), d = Math.atan2(Math.sin(want - head.rotation.y), Math.cos(want - head.rotation.y));
      head.rotation.y += Math.abs(d) < 1e-3 ? d : d * Math.min(1, dt * 5);
      if (lampSt.jam > 0) { lampSt.jam = Math.max(0, lampSt.jam - dt * 3); head.rotation.y += Math.sin(lampSt.jam * 30) * 0.01 * lampSt.jam; }
      if (flames && flat(pp, lampAt) < 500) { flames.update(dt, t); }
      if (answered()) {
        if (lampSt.blink >= 0) { lampSt.blink += dt; if (lampSt.blink > BLINK_T * 2) lampSt.blink = -1; }
        ysGlow.visible = lampSt.blink < 0 || blinkOn(lampSt.blink);
        // (big enough to see from the tower, a star on the cliff; lamp-sized up close)
        ysGlow.scale.setScalar(THREE.MathUtils.clamp(pp.distanceTo(ysLampAt) / 120, 1, 14));
      }
    }
    // the bell swings (a damped pendulum), and tolls at the top of each swing
    if (bell.t >= 0) {
      bell.t += dt;
      const w = 2.1, decay = Math.exp(-bell.t / 4.5), a = bell.amp * decay * Math.sin(w * bell.t);
      A.bell.rotation.x = a;
      const beat = Math.floor((bell.t * w) / Math.PI);
      if (bell.ringing && beat > bell.tolls && decay > 0.15) { bell.tolls = beat; toll(0.16 * decay + 0.03); }
      if (bell.t === dt && bell.ringing) toll(0.2);
      ropeSway(A.rope, bell.t, decay);
      if (decay < 0.02) { bell.t = -1; A.bell.rotation.x = 0; ropeSway(A.rope, 0, 0); }
    }
    // the cloud settles once the bell has rung (and dips again, a little, each time you ring it)
    if (game.flag('arzach2.bell.rung') && bell.settle < 1) bell.settle = Math.min(1, bell.settle + dt / 12);
    bell.dip = Math.max(0, bell.dip - dt / 6);
    const k = THREE.MathUtils.smootherstep(bell.settle, 0, 1), dip = Math.sin(Math.PI * bell.dip) * 2.5;
    const drop = SETTLE * k + dip;
    A.cloud.forEach((m, i) => { m.position.y = cloudBase[i] - drop; });
    A.floaters.position.y = floatBase - STONES_DOWN * k;
    // after it has rung, the monks ring it at dusk and dawn (here: now and then, when you're near the cliff)
    if (game.flag('arzach2.bell.rung') && quests.isDone(Q)) {
      bell.next -= dt;
      if (bell.next <= 0) { bell.next = 90 + Math.random() * 40; if (pp.distanceTo(A.monastery) < 700 && bell.t < 0) ring(false); }
    }
    // the monks look up when you first land on the cliff
    if (!st.landed && flat(pp, A.monastery) < 70 && Math.abs(pp.y - A.monastery.y) < 6 && !player.riding) {
      st.landed = true;
      const y = people.ysolde; if (y) y.shout = { text: '~shout~ A visitor! On a bird!', until: y.time + 3 };
      const c = people.calix; if (c) c.greeted = 0;
    }
    // the cairn hums when it stands: its stones shimmer
    if (cairnHum > 0 || game.flag('arzach2.cairn.placed') === 3) {
      cairnHum = Math.max(0, cairnHum - dt * 0.3);
      for (const m of placed) m.position.x += Math.sin(t * 9 + m.position.y) * 0.002 * cairnHum;
    }
    // the cairn stones on the sky stones turn slowly (things that fell up are restless)
    for (const s of Object.values(stones)) if (s.m.visible) { s.m.rotation.y += dt * 0.3; s.m.position.y = s.at.y + Math.sin(t * 1.2 + s.sky) * 0.06; }
  };

  return { people, update, bell, stones, pull, ring, lamp: { at: lampAt, head, aim0, notch, yaw: () => yawOf(notch()) }, tiles: () => tiles };
}

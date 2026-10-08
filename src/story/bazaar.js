import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { textGeometry, glyphGeometry } from './sign-text.js';
import { QUESTS, PEOPLE, THINGS, LINES, ITEMS, CROWD_TALK, KEEPSAKE, LANTERN_TONE, LANTERN_FLAG } from './bazaar-data.js';
import { setupBazaarMoments, BROADCAST } from './bazaar-moments.js';

// The Signal Market's story, alive (bazaar-data.js has the words).
//
//   the avenue   Doss, Oyo and Teb (content.js); Brush and his ladder; the ship lands here
//   the bridges  Kip on the second skybridge, the oldest sign hanging dark beneath it
//   the square   Madame Sel on her crate at the silent tower's foot; Ummu, a quiet one,
//                by the crates fallen in an alley mouth
//   the balcony  Ferro, the console, and the antenna's tuning mark (three bulbs over a dish)
//
// The tower's screens are covered and dark until the broadcast. Playing it lifts
// the covers row by row, turns every street-facing sign white, stops the square
// and turns every head to the tower; the voice plays as a conversation (the
// camera frames the tower); afterwards the signs all say the same thing, and
// the ones you walk past greet you. The first time, the waking is filmed
// (bazaar-moments.js) and the voice opens at its end.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const Q = 'bazaar.signal';
const UP = V(0, 1, 0);
const MESSAGES = ['YOU ARE\nNOT ALONE', 'SOMEONE IS\nLISTENING', 'WE HEARD\nIT TOO', 'COME HOME\nWHEN READY'];
const GREETING = 'HELLO\nTRAVELLER';

export function setupBazaar(ctx) {
  const { level, physics, player, crowd, quests, dialogue, game, sound, story, spawn, scene, toast, moments } = ctx;
  const G = level.signal;
  if (!G) return null;
  const P = G.places;
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = { ...(quests.itemNames ?? {}), ...ITEMS };
  // the main quest doesn't just appear: it starts when you talk to Madame Sel (the scout finds them till then: src/story/quests.js opensWith)
  if (!quests.isStarted(Q)) quests.opensWith(Q, 'sel');
  if (!quests.def(quests.tracked() ?? '')) quests.track(quests.isActive(Q) ? Q : quests.active().find((d) => d.world === 'bazaar')?.id);

  // Oyo's last lantern (his talk, bazaar-data.js): its little sun runs down the hose, and the tank takes its colour for good
  game.on(`flag:${LANTERN_FLAG}`, (v) => {
    if (!v) return;
    game.emit('tool:refill', { addColour: true, tone: LANTERN_TONE });
    toast('The lantern’s little sun runs down your hose. The tank takes its colour: a bruise, healing.');
  });

  const onAir = () => !!game.flag('bazaar.broadcast.on');
  const tuned = () => !!game.flag('bazaar.antenna.tuned');
  const ground = (p) => { const g = physics.groundAt(p.x, p.y + 2, p.z, 6); return V(p.x, Number.isFinite(g) ? g : p.y, p.z); };
  const around = (c, r, n, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * Math.PI * 2; return ground(V(c.x + Math.sin(a) * r, c.y, c.z + Math.cos(a) * r)); });
  const st = { cast: null, cine: null, bulbs: [0, 0, 0], crateT: game.flag('bazaar.crates.clear') ? 1 : 0, signK: game.flag('bazaar.oldsign.awake') ? 1 : 0, coverK: onAir() ? 7 : 0, time: 0, near: -1 };

  // ---------------------------------------------------------------- the people
  const people = {};
  people.sel = spawn(PEOPLE.sel, { route: [P.sel.clone()], seat: 0.45, heading: 0 });
  people.kip = spawn(PEOPLE.kip, { route: [ground(P.kip), ground(P.kip.clone().add(V(9, 0, 0))), ground(P.kip.clone().add(V(4, 0, -1.2)))], speed: 1.6 });
  people.ferro = spawn(PEOPLE.ferro, { route: [ground(P.ferro), ground(P.ferro.clone().add(V(2.6, 0, -1.6)))], speed: 0.6 });
  people.brush = spawn(PEOPLE.brush, { route: [ground(P.brush.clone().add(V(1.2, 0, 1.3)))], heading: -Math.PI / 2 + 0.4 });
  for (const [id, n] of Object.entries(people)) quests.locate(id, () => n.pos);
  quests.locate('antenna', () => P.antenna);
  quests.locate('console', () => P.console);
  quests.locate('oldSign', () => V(P.oldSign.x, 0, P.oldSign.z + 6));
  quests.locate('crates', () => P.crates);
  quests.locate('bowl', () => G.bowl.position);
  quests.locate('ummu', () => P.ummu);

  // ---------------------------------------------------------------- things to look at and use
  const thing = (def, at, { range = 3, prompt, enabled = () => true, look = null, use } = {}) => registerInteractable({
    id: def.id, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ')}`,
    at: () => at, enabled, distance: (p) => (Math.abs(p.pos.y - at.y) < 3 ? flat(p.pos, at) : Infinity),
    use: use ?? (() => dialogue.start(def, null, at, look)),
  });
  const ready = () => quests.has('recording') && tuned() && !onAir() && !st.cast;
  thing(THINGS.console, P.console, { range: 2.8, prompt: () => (ready() ? 'play the recording' : 'look at the console'), use: () => (ready() ? play() : dialogue.start(THINGS.console, null, P.console)) });
  thing(THINGS.crates, P.crates.clone().add(V(0, 0.6, 0)), { range: 3.2, prompt: 'look at the crates', enabled: () => !game.flag('bazaar.crates.clear') });
  thing({ id: 'bowl', name: 'the bowl' }, G.bowl.position, { range: 2.4, prompt: 'pick up the brass bowl',
    enabled: () => !!game.flag('bazaar.crates.clear') && !quests.has('bowl') && !quests.isDone('bazaar.bowl') && G.bowl.visible,
    use: () => { quests.give('bowl'); G.bowl.visible = false; toast(`Picked up ${ITEMS.bowl}`); sound.chime?.(); if (!quests.isStarted('bazaar.bowl')) quests.start('bazaar.bowl', 'bowl'); } });
  // the oldest sign, seen from the street right under it: you have to look up
  const underSign = V(P.oldSign.x, 0, P.oldSign.z + 2.5);
  registerInteractable({ id: 'oldSign', priority: PRIORITY.use, range: 3.5, prompt: 'look up at the old sign', at: () => underSign.clone().setY(2.2),
    distance: (p) => (p.pos.y < 3 ? flat(p.pos, underSign) : Infinity), use: () => dialogue.start(THINGS.oldSign, null, underSign, P.oldSign) });
  const ummuAt = P.ummu.clone().add(V(0, 1.2, 0));
  thing(THINGS.ummu, ummuAt, { range: 3, prompt: 'listen to Ummu' });
  if (quests.has('bowl') || quests.isDone('bazaar.bowl')) G.bowl.visible = false;

  // Ummu speaks through its screen
  const screenMat = makeMaterial({ color: '#fff0bd', flat: true, glow: 0.9, key: 'bazaar.ummuText' });
  let screenText = null;
  const writeScreen = (text) => {
    if (screenText) { screenText.removeFromParent(); screenText.geometry.dispose(); }
    screenText = new THREE.Mesh(textGeometry(text, { width: 1.7, depth: 0.03 }).rotateY(Math.PI / 2), screenMat);
    screenText.position.copy(P.ummuScreen).add(V(0.04, 0, 0));
    screenText.userData.noCollide = true;
    screenText.visible = st.nearSquare !== false;
    scene.add(screenText);
    G.screen.material.uniforms.uGlow.value = 0.25;
  };
  game.on('bazaar:ummu', (t) => writeScreen(t));
  writeScreen(quests.isDone('bazaar.bowl') ? 'HELLO\nAGAIN' : '...');

  // ---------------------------------------------------------------- the antenna: three bulbs, lit at once
  const BULB_LIFE = 6;
  const bulbOn = new THREE.Color('#fff0bd'), bulbOff = new THREE.Color('#56686d');
  G.bulbs.forEach((b, i) => registerTarget({ kind: 'bulb', radius: 0.75, position: () => b.mesh.position, enabled: () => !tuned() && player.pos.distanceTo(P.antenna) < 70,
    onHit: (mode) => {
      if (mode !== 'shoot') { b.sway = 1; return true; }
      st.bulbs[i] = BULB_LIFE;
      sound.toolClick?.(true);
      if (st.bulbs.every((x) => x > 0)) tune();
      else if (!st.hinted) { st.hinted = true; toast('One bulb glows… and starts to fade. Light all three before the first goes dark.'); }
      return true;
    } }));
  const tune = () => {
    if (tuned()) return;
    game.set('bazaar.antenna.tuned', true);
    sound.chime?.();
    toast('The three bulbs burn together. The dish swings, catches something far off, and hums.');
  };

  // ---------------------------------------------------------------- the oldest sign
  const signText = new THREE.Group();
  {
    const cream = makeMaterial({ color: '#fff0bd', flat: true, glow: 0.85, key: 'bazaar.oldText' });
    signText.add(new THREE.Mesh(glyphGeometry(1.5, 0.04).translate(0, 0.75, 0), cream));
    signText.add(new THREE.Mesh(textGeometry('WE HEARD YOU', { width: 5.6, depth: 0.04 }).translate(0, -0.8, 0), cream));
    signText.position.copy(P.oldSign).add(V(0, 0, 0.14));
    signText.traverse((o) => { o.userData.noCollide = true; });
    signText.visible = st.signK > 0;
    scene.add(signText);
  }
  registerTarget({ kind: 'oldsign', radius: 3, position: () => V(P.oldSign.x, P.oldSign.y, P.oldSign.z + 0.3), enabled: () => !game.flag('bazaar.oldsign.awake') && flat(player.pos, P.oldSign) < 70,
    onHit: (mode) => {
      if (mode !== 'shoot') return false;
      if (!quests.isStarted('bazaar.oldsign')) quests.start('bazaar.oldsign');
      game.set('bazaar.oldsign.awake', true);
      signText.visible = true;
      sound.chime?.();
      toast('The old plate drinks the fluid’s colours and glows: the mark, and under it, WE HEARD YOU.');
      return true;
    } });

  // ---------------------------------------------------------------- the crates, and the bowl under them
  G.crates.forEach((c, i) => { c.aside = c.rest.clone().add(V(0.9 + (i % 3) * 0.9, -c.rest.y + c.mesh.geometry.parameters.height / 2 + 0.3, (i - 2.5) * 1.1)); c.spin = (i % 2 ? 1 : -1) * (1.2 + i * 0.3); });
  const clearCrates = () => {
    if (game.flag('bazaar.crates.clear')) return;
    game.set('bazaar.crates.clear', true);
    if (!quests.isStarted('bazaar.bowl')) quests.start('bazaar.bowl', 'bowl');
    st.crateT = 0.001;
    sound.whoosh?.();
    toast('The fluid shoves the heap: the crates tumble away across the pavement. Something brass is lying underneath.');
  };
  registerTarget({ kind: 'crates', radius: 1.9, position: () => V(P.crates.x, P.crates.y + 0.8, P.crates.z), enabled: () => !game.flag('bazaar.crates.clear'),
    onHit: (mode) => {
      if (mode === 'push') { clearCrates(); return true; }
      st.crateWobble = 1;
      if (!st.crateHint) { st.crateHint = true; toast('The crates rock and settle. They need a shove: push (the gun’s push mode: X or the D-pad, then shoot).'); }
      return true;
    } });
  const placeCrates = (k) => {
    for (const c of G.crates) {
      const e = THREE.MathUtils.smootherstep(k, 0, 1);
      c.mesh.position.lerpVectors(c.rest, c.aside, e);
      c.mesh.position.y += Math.sin(Math.PI * e) * 0.6;
      c.mesh.rotation.set(c.rot.x + e * c.spin * 0.5, c.rot.y + e * c.spin, c.rot.z);
    }
  };
  if (st.crateT >= 1) placeCrates(1);

  // ---------------------------------------------------------------- the tower: covers, the white signs, the cast
  const plateMat = makeMaterial({ color: '#fbf4e2', flat: true, glow: 0.8, key: 'bazaar.whitePlates' });
  const inkMat = makeMaterial({ color: '#3a535b', flat: true, key: 'bazaar.onAirText' });
  const boards = [...G.frontPosters, ...G.towerPosters.filter((q) => q.k === 6 && q.yaw === 0).map((q) => ({ ...q, z: q.z + 1.2 }))];
  const plates = new THREE.Mesh(mergeGeometries(boards.map((b) => new THREE.BoxGeometry(b.w * 0.94, b.h * 0.94, 0.1).rotateY(b.yaw).translate(b.x, b.y, b.z + 0.06))), plateMat);
  plates.userData.noCollide = true;
  scene.add(plates);
  const texts = boards.map((b, i) => {
    const m = new THREE.Mesh(textGeometry(i === boards.length - 1 ? MESSAGES[0] : MESSAGES[i % MESSAGES.length], { width: b.w * 0.78, depth: 0.05 }), inkMat);
    m.position.set(b.x, b.y, b.z + 0.14); m.userData.noCollide = true;
    scene.add(m);
    return m;
  });
  const greet = new THREE.Mesh(textGeometry(GREETING, { width: 15, depth: 0.05 }), inkMat);
  greet.userData.noCollide = true;
  scene.add(greet);
  const showBoards = (white, words) => { plates.visible = white; texts.forEach((t, i) => { t.visible = words && i !== st.near; }); greet.visible = words && st.near >= 0; };
  showBoards(onAir(), onAir());
  // n rows lifted: 0 = all dark (one mesh), 7 = all awake
  const setCovers = (n) => { G.coversAll.visible = n === 0; G.covers.forEach((c, k) => { c.visible = n > 0 && k >= n; }); };
  setCovers(onAir() ? 7 : 0);
  const towerAim = V(0, 58, -240);
  const film = setupBazaarMoments(ctx, { moments, towerAim });

  // what the story's people say in passing follows the story
  const say = () => {
    const onAir = () => !!game.flag('bazaar.broadcast.on') || !!st.cast;   // (while the tower wakes they talk about it already)
    if (tuned()) people.ferro.lines = onAir() ? ['~happy~ Clear as a bell!', '~happy~ Good antenna. Good, good antenna.'] : ['~surprised~ Listen to it hum!', '~neutral~ The console’s right there.'];
    if (game.flag('bazaar.kip.gave')) people.kip.lines = onAir() ? ['~surprised~ Everybody stopped! Even the fish man!', '~shout~ Messages! Real ones!'] : ['~curious~ Did you play it yet?', '~curious~ Is it still singing?'];
    if (onAir()) people.sel.lines = ['~happy~ It’s talking again, love.', '~solemn~ Listen. No. Listen properly.', '~solemn~ Thirty years on the way.'];
    if (game.flag('bazaar.oldsign.awake')) people.brush.lines = ['~happy~ WE HEARD YOU. Sixty-one signs so far.', '~playful~ Look in the corners.'];
  };
  say();
  game.on('flag', ({ name }) => { if (name.startsWith('bazaar.')) say(); });
  const applyOnAir = () => {
    if (crowd) for (const p of crowd.people) p.lines = LINES.onAir;
    sound.setBandMode?.('tower', 'play');
  };
  if (onAir()) applyOnAir();

  const play = () => {
    if (!ready()) return;
    quests.take('recording');
    st.cast = { t: 0, opened: false };
    say();
    st.cine = { t: 0, eye0: V(-31, 17, -186), eye1: V(-22, 12, -197), look: towerAim.clone() };
    toast('You slot the recording in. The console warms, the antenna hums, and the tower wakes.');
    sound.whoosh?.();
    // the market stops, and turns to the tower
    if (crowd) {
      crowd.lookAt?.(V(0, 70, -242), 45);
      for (const p of crowd.people) {
        if (p.walk && p.pos.distanceToSquared(P.square) < 220 * 220) p.walk.pause = 26 + p.seed * 6;
        if (p.group) { p.group.pauseUntil = crowd.time + 30; }
      }
    }
    // the first time it is filmed: the covers lifting, the signs going white, the square stopped, his face; the voice at its end
    const c = st.cast;
    c.film = film.broadcast({
      white: () => { if (!plates.visible) showBoards(true, false); },
      onEnd: () => { c.film = false; c.lifted = true; setCovers(7); if (st.cast === c && !c.opened) c.opened = dialogue.start(THINGS.broadcast, null, null); },
    });
  };
  const finish = () => {
    if (onAir()) return;
    game.addKeepsake(KEEPSAKE) && toast(`Keepsake: ${KEEPSAKE.name}`);
    game.set('bazaar.broadcast.on', true);
    applyOnAir();
    showBoards(true, true);
    setCovers(7);
    if (crowd) {
      const near = crowd.people.filter((p) => p.pos.distanceToSquared(player.pos) < 70 * 70).slice(0, 6);
      near.forEach((p, i) => { p.say = LINES.onAir[i % LINES.onAir.length]; p.shoutUntil = crowd.time + 3 + i * 0.5; });
      if (near[0]) crowd.shout = near[0];
    }
  };
  game.on('dialogue:end', ({ id }) => { if (id === 'broadcast') { finish(); if (st.cast) st.cast.done = true; } });

  // the camera moment: from above the square, the tower waking and the whole market turned toward it
  const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = V(0, 0, 0);
  const frameCamera = (camera) => {
    const c = st.cine;
    if (!c) return;
    const out = c.out ?? 0;
    const w = THREE.MathUtils.smootherstep(c.t, 0, 1.6) * (1 - THREE.MathUtils.smootherstep(out, 0, 1.8));
    if (w <= 0) return;
    _e.lerpVectors(c.eye0, c.eye1, THREE.MathUtils.smootherstep(Math.min(c.t / 40, 1), 0, 1));
    camera.position.lerp(_e, w);
    _m.lookAt(camera.position, c.look, UP);
    _q.setFromRotationMatrix(_m);
    camera.quaternion.slerp(_q, w);
    camera.updateMatrixWorld();
  };

  // ---------------------------------------------------------------- the main quest's end
  quests.def(Q).onDone = () => {
    game.set('world.bazaar.done', true);
    game.addKeepsake(KEEPSAKE);
    setTimeout(() => story.complete?.(), 1200);
  };

  // ---------------------------------------------------------------- music: the tower, once it talks
  sound.setBands?.([{ id: 'tower', pos: () => (onAir() ? towerAim : null), radius: 150, parts: ['bell', 'chant'], mode: 'play', vol: 0.45, duck: 0.3 }]);

  // ---------------------------------------------------------------- per frame
  const _c = new THREE.Color(), _w = V(0, 0, 0);
  const square = [G.dish, ...G.bulbs.map((b) => b.mesh), G.ummu, G.screen, ...G.crates.map((c) => c.mesh)];
  const update = (dt, t, { camera } = {}) => {
    st.time += dt;
    const pp = player.pos;
    // the square's small things are drawn only when you are near enough to see them
    if (camera) {
      const nearSquare = camera.position.distanceToSquared(P.square) < 170 * 170, nearSign = camera.position.distanceToSquared(P.oldSign) < 190 * 190;
      if (nearSquare !== st.nearSquare) { st.nearSquare = nearSquare; for (const o of square) o.visible = nearSquare; if (screenText) screenText.visible = nearSquare; G.bowl.visible = nearSquare && !quests.has('bowl') && !quests.isDone('bazaar.bowl'); }
      if (nearSign !== st.nearSign) { st.nearSign = nearSign; G.oldSign.visible = nearSign; signText.visible = nearSign && st.signK > 0; }
    }
    // the broadcast: covers lift bottom to top, the street signs go white, then the voice
    if (st.cast) {
      const c = st.cast;
      c.t += dt;
      setCovers(c.lifted ? 7 : Math.min(7, Math.floor(c.t / (c.film ? BROADCAST.rowSecs : 0.5))));
      // (filmed, the signs and the voice wait for its beats: bazaar-moments.js)
      if (!c.film && c.t > 1.2 && !plates.visible) showBoards(true, false);
      if (!c.film && c.t > 3.8 && !c.opened) { c.opened = dialogue.start(THINGS.broadcast, null, null) || c.t > 8; }
      if (c.done || (c.opened && !dialogue.open && c.t > 6)) { finish(); st.cast = null; if (st.cine) st.cine.out = 0.001; }
    }
    if (st.cine) { st.cine.t += dt; if (st.cine.out) { st.cine.out += dt; if (st.cine.out > 1.9) st.cine = null; } }
    // the antenna's bulbs: lit ones fade (flickering at the end); tuned, all three burn steady
    G.bulbs.forEach((b, i) => {
      st.bulbs[i] = Math.max(0, st.bulbs[i] - dt);
      const k = tuned() ? 1 : st.bulbs[i] > 0 ? (st.bulbs[i] > 1.5 ? 1 : 0.4 + 0.6 * (Math.sin(t * 30) > 0 ? 1 : 0)) : 0;
      b.mat.uniforms.uColor.value.copy(bulbOff).lerp(bulbOn, k);
      b.mat.uniforms.uGlow.value = k;
    });
    // the oldest sign warms up once woken
    if (game.flag('bazaar.oldsign.awake') && st.signK < 1) st.signK = Math.min(1, st.signK + dt / 2);
    G.oldMat.uniforms.uColor.value.set('#3b4547').lerp(_c.set('#d9785f'), st.signK);
    G.oldMat.uniforms.uGlow.value = 0.45 * st.signK;
    // the crates tumble
    if (st.crateT > 0 && st.crateT < 1) { st.crateT = Math.min(1, st.crateT + dt / 0.9); placeCrates(st.crateT); }
    else if (st.crateWobble > 0) { st.crateWobble = Math.max(0, st.crateWobble - dt * 2); G.crates[3].mesh.rotation.z = G.crates[3].rot.z + Math.sin(st.crateWobble * 25) * 0.06 * st.crateWobble; }
    // Ummu turns its whole head to whoever is near
    if (flat(pp, P.ummu) < 30) {
      const near = flat(pp, P.ummu) < 9;
      _w.subVectors(pp, P.ummu);
      const want = near ? THREE.MathUtils.clamp(Math.atan2(_w.x, _w.z) - G.ummu.rotation.y, -1.1, 1.1) : Math.sin(t * 0.3) * 0.3;
      G.ummuHead.rotation.y += (want - G.ummuHead.rotation.y) * (1 - Math.exp(-dt * 2));
      G.ummuHead.position.y = 2.05 * 1.18 + (dialogue.open && dialogue.person?.id === 'ummu' ? Math.sin(t * 6) * 0.03 : 0);
    }
    // on the air: the sign you are walking past greets you
    if (onAir() && !st.cast) {
      // the boards face +z, down the avenue: the one ahead of you at a comfortable reading distance says hello
      let best = -1, bd = Infinity;
      boards.forEach((b, i) => {
        const ahead = pp.z - b.z;
        if (i === boards.length - 1 || ahead < 45 || ahead > 160) return;
        const score = Math.abs(ahead - 85) + (Math.sign(b.x) === Math.sign(pp.x || 1) ? 0 : 6);
        if (score < bd) { bd = score; best = i; }
      });
      if (best !== st.near) {
        st.near = best;
        if (best >= 0) { const b = boards[best]; greet.position.set(b.x, b.y, b.z + 0.14); greet.scale.setScalar(b.w / 20); }
        showBoards(true, true);
      }
    }
  };

  return {
    people, update, state: st, frameCamera, play, tune, finish, clearCrates, film,
    /** E on a crowd person: a short conversation, by where they are (and whether the tower has spoken). */
    crowdTalk(p) {
      const z = p.spot?.id ?? (p.pos.y > 8 ? 'bridge' : p.pos.z < -200 ? 'square' : 'market');
      const air = onAir() && (z === 'square' || p.seed < 0.5), list = air ? CROWD_TALK.onAir : CROWD_TALK[z];
      if (!list) return null;
      const k = Math.floor(p.seed * 997) % list.length, base = list[k];
      // a voice of their own (src/story/voice.js voiceOf hashes the seed); `heard`: where the lines they've said are kept (dialogue.js pickListen)
      return { id: `crowd.bazaar.${z}`, heard: `crowd.bazaar.${air ? 'onAir' : z}.${k}`, color: p.style?.cloak ?? '#d8a24a', kind: p.kind, seed: `crowd:${p.id}`, scale: p.size, ...base };
    },
  };
}

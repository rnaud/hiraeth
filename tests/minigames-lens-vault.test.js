// Issue #382: the Lens Vault, a first-person minigame in the manner of Metroid Prime (src/minigames/lens-vault*.js;
// docs/systems/minigames.md "The Lens Vault"). Its rules (the trigger and the charge, the lock, the lens's reading, the
// doors, the view's angles and bob), its table (the rooms joined by their doors, every line toned), the game's definition
// and its rooms built in node; then the whole run in engine/game.js in a bare V8 context (the bundle the engines run): its
// card, the eye's camera, the visor's screen part, a door shot open, the gallery's foes woken, the lens reading the lock,
// the finish and its results, Quit back to the Arcade.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const R = await import('../src/minigames/lens-vault-rules.js');
const { parseLine } = await import('../src/story/tone.js');
const { checkGame } = await import('../src/minigames/index.js');
const game = (await import('../src/minigames/lens-vault.js')).default;
const { readButtons, TAKEN, roomAt } = await import('../src/minigames/lens-vault.js');
const { visorPart } = await import('../src/minigames/lens-vault-hud.js');

test('the trigger: a press a plain bolt, held the charge fills, let go full a charged one (lens-vault-rules triggerStep)', () => {
  const S = {}, F = R.FPS, dt = 1 / 60;
  assert.equal(R.triggerStep(S, true, dt), 'plain', 'a press fires at once');
  let out = null, t = 0;
  for (; t < F.chargeAfter + F.chargeTime + 0.1; t += dt) out = R.triggerStep(S, true, dt) ?? out;
  assert.equal(out, null, 'nothing while held');
  assert.equal(S.charge, 1, 'full');
  assert.equal(R.triggerStep(S, false, dt), 'charged', 'let go full: the charged bolt');
  assert.equal(S.charge, 0);
  // let go before it is full: nothing more
  for (let i = 0; i < 20; i++) R.triggerStep(S, false, dt);
  R.triggerStep(S, true, dt);
  for (let i = 0; i < 30; i++) R.triggerStep(S, true, dt);
  assert.ok(S.charge > 0 && S.charge < 1);
  assert.equal(R.triggerStep(S, false, dt), null, 'half a charge is lost');
  // the arm cools between two plain bolts
  const C = {};
  assert.equal(R.triggerStep(C, true, dt), 'plain');
  R.triggerStep(C, false, dt);
  assert.equal(R.triggerStep(C, true, dt), null, 'too soon');
  R.triggerStep(C, false, F.cool);
  assert.equal(R.triggerStep(C, true, dt), 'plain');
});

test('the lock takes what is nearest the middle of the view, seen and in range (pickLock)', () => {
  const eye = { x: 0, y: 1.6, z: 0 }, dir = { x: 0, y: 0, z: 1 };
  const a = { id: 'a', pos: { x: 1, y: 1.6, z: 10 } }, b = { id: 'b', pos: { x: 0.2, y: 1.6, z: 12 } }, c = { id: 'c', pos: { x: 0, y: 1.6, z: 8 }, seen: false };
  assert.equal(R.pickLock(eye, dir, [a, b, c]).id, 'b', 'the middle one; the hidden one never');
  assert.equal(R.pickLock(eye, dir, [{ id: 'far', pos: { x: 0, y: 1.6, z: 80 } }]), null, 'out of range');
  assert.equal(R.pickLock(eye, dir, [{ id: 'side', pos: { x: 10, y: 1.6, z: 5 } }]), null, 'out of the cone');
});

test('the lens fills on a thing held under it and reads it once; moved off, it empties (scanStep)', () => {
  const S = {}, read = new Set(), dt = 1 / 30;
  let got = null;
  for (let i = 0; i < 40 && !got; i++) got = R.scanStep(S, 'mark', true, dt, read);
  assert.equal(got, 'mark');
  assert.ok(read.has('mark'));
  for (let i = 0; i < 40; i++) assert.equal(R.scanStep(S, 'mark', true, dt, read), null, 'read once');
  R.scanStep(S, 'lamp', true, 0.3, read);
  assert.ok(S.k > 0.3);
  R.scanStep(S, null, true, 0.3, read);
  assert.ok(S.k < 0.1, 'off it, the reading empties');
});

test('the doors: a shot door to any bolt, the heavy one to a charged bolt, the sealed one to none', () => {
  assert.ok(R.doorTakes({ kind: 'shot' }, 'plain'));
  assert.ok(!R.doorTakes({ kind: 'charge' }, 'plain'));
  assert.ok(R.doorTakes({ kind: 'charge' }, 'charged'));
  assert.ok(!R.doorTakes({ kind: 'sealed' }, 'charged'));
  assert.ok(!R.doorTakes({ kind: 'shot', open: true }, 'plain'));
  // the sealed one is the lens's: its lock's reading opens it
  const sealed = R.DOORS.find((d) => d.kind === 'sealed');
  assert.equal(Object.values(R.LENS).find((L) => L.opens === sealed.id)?.name, 'The eye-lock');
});

test('the view: the rig\'s angles and the look agree; the bob is nothing standing', () => {
  for (const d of [{ x: 0, y: 0, z: 1 }, { x: 1, y: -0.5, z: 0.2 }, { x: -0.3, y: 0.8, z: -1 }]) {
    const L = Math.hypot(d.x, d.y, d.z), a = R.anglesOf(d), v = R.lookDir(a.yaw, a.pitch);
    assert.ok(Math.abs(v.x - d.x / L) < 1e-9 && Math.abs(v.y - d.y / L) < 1e-9 && Math.abs(v.z - d.z / L) < 1e-9, JSON.stringify(d));
  }
  // the rig's yaw π looks into the vault (+z)
  assert.ok(R.lookDir(Math.PI, 0).z > 0.99);
  const s = R.bob(0.37, 0);
  assert.equal(s.x, 0); assert.ok(Math.abs(s.y) < 1e-12);
  assert.ok(Math.abs(R.bob(0.5, 7).y) > 0.01);
});

test('the vault\'s table: rooms in a line, each door in the wall between its two, every line of the lens toned', () => {
  for (const d of R.DOORS) {
    const a = R.ROOMS[d.from], b = R.ROOMS[d.to];
    const aEnd = a.z + a.d / 2, bStart = b.round ? b.z - b.r : b.z - b.d / 2;
    assert.ok(d.z > aEnd && d.z < aEnd + 1.2, `${d.id} in ${a.id}'s far wall`);
    assert.ok(bStart > aEnd, `${b.id} beyond ${a.id}`);
  }
  assert.equal(roomAt({ x: 0, z: R.START.z }), 0, 'he starts in the Lens Room');
  assert.equal(roomAt({ x: 0, z: 78 }), 3, 'the Round Hall');
  assert.equal(roomAt({ x: 0, z: 14.5 }), -1, 'a passage');
  for (const [id, L] of Object.entries(R.LENS)) {
    assert.ok(parseLine(L.line).explicit, `${id}: a tone`);
    assert.ok(L.name && L.line.length < 90, `${id}: a short line`);
  }
  // every foe of the vault has its reading
  for (const Rm of R.ROOMS) for (const [kind] of [...Rm.foes, ...(Rm.then ?? [])]) assert.ok(R.LENS[kind], `${kind} is read`);
  assert.deepEqual(R.resultLines({ shots: 10, hits: 7, charged: 2, kills: 3, total: 18, read: 11, readable: 11 }), ['Foes felled 3 of 18 · charged shots 2', 'Shots 10 · on target 70%', 'The lens read 11 of 11 · every one']);
});

test('the game: its definition, the buttons it takes, its prompts in Xbox / PlayStation form, the visor\'s part', () => {
  assert.deepEqual(checkGame(game), []);
  assert.equal(game.drives, false, 'played on foot');
  assert.equal(game.score.kind, 'time');
  const pad = game.controls.pad.map(([k]) => k).join(' ');
  for (const k of ['RT / R2', 'LT / L2', 'Y / △', 'A / ×']) assert.ok(pad.includes(k), k);
  assert.deepEqual(readButtons({ PadFire: true, PadAim: true, PadWhistle: true }), { fire: true, lock: true, lens: true });
  assert.deepEqual(readButtons({ MouseLeft: true, KeyF: true }), { fire: true, lock: false, lens: true });
  for (const k of ['PadFire', 'PadAim', 'PadBlade', 'MouseLeft', 'MouseRight', 'PadEvade', 'PadWhistle']) assert.ok(TAKEN.includes(k), `${k} kept from the traveller`);
  const M = visorPart(1280, 720, { mode: 'lens', hearts: 2.25, max: 3, charge: 0, lock: { x: 600, y: 300, r: 4 }, marks: [{ x: 10, y: 20, read: true }], scan: 0.5, read: { name: 'The makers’ mark', text: 'x', on: true, n: 1 }, red: 0 });
  assert.equal(M.ret.x, 640); assert.equal(M.ret.hot, '#ef9479', 'locked: coral');
  assert.equal(M.lock.r, 14, 'the lock\'s brackets never smaller than 14 px');
  assert.deepEqual(M.hp, { n: 2.25, max: 3 });
  assert.equal(M.marks.length, 1);
  assert.equal(visorPart(1280, 720, { mode: 'arm', marks: [{ x: 1, y: 1 }] }).marks.length, 0, 'the marks only with the lens up');
});

test('the vault built in node: its rooms solid, three doors, the lock and the lens\'s points', async () => {
  const { buildVault } = await import('../src/minigames/lens-vault-level.js');
  const scene = new THREE.Scene();
  const it = buildVault(scene);
  let r = it.next();
  while (!r.done) r = it.next();
  const L = r.value;
  assert.equal(L.vault.doors.length, 3);
  assert.ok(L.vault.lock?.ball, 'the eye-lock');
  let solids = 0;
  scene.traverse((o) => { if (o.isMesh && /collision/.test(o.name)) solids += o.geometry.attributes.position.count / 3; });
  assert.ok(solids > 200, `the rooms' walls and floors are solid (${solids} triangles)`);
  for (const d of L.vault.doors) d.group.traverse((o) => assert.ok(o.userData.noCollide, 'a door is a mover, out of the bake'));
});

// ------------------------------------------------------------------ the run in the engines' bundle
const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const frames = (g, n, keys = {}) => quietly(() => { for (let i = 0; i < n; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 30); } });
const plain = (x) => JSON.parse(JSON.stringify(x ?? null));

let BUNDLE = null;
/** The engines' bundle (engine/game.js), made once for the tests here. */
async function engine() {
  if (BUNDLE) return BUNDLE;
  const { bundle } = await import('../scripts/engine-bundle.mjs');
  const { loadBundle } = await import('../engine/vm-run.mjs');
  const { tempPath } = await import('../scripts/temp-dirs.mjs');
  const { EngineMenus } = await import('../engine/menus.js');
  const file = tempPath(join(tmpdir(), `hiraeth-engine-lens-vault-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  BUNDLE = { X: loadBundle(file, { pads: () => [] }).exports, EngineMenus };
  return BUNDLE;
}

test('the Lens Vault in the engine: its card, the eye\'s camera, the visor, a door shot open, the lens, the finish, Quit (issue #382)', async () => {
  const { X, EngineMenus } = await engine();
  const menus = new EngineMenus({});
  const left = [];
  const g = await quietly(() => X.createGame({ levelId: 'arcade', game: 'lens-vault', from: 'arcade', backend, menus, onLeave: (h) => left.push(h) }));
  await frames(g, 2);
  assert.equal(menus.mode, 'card');
  const card = menus.view().card;
  assert.equal(card.title, 'The Lens Vault');
  assert.ok(card.rows.some(([, v]) => /lock on/.test(v)) && card.rows.some(([, v]) => /lens/.test(v)), JSON.stringify(card.rows));
  menus.key('Enter');
  await frames(g, 120);
  const runner = g.trials.runner, S = runner.session;
  assert.equal(runner.phase, 'play');
  // the camera in his eyes, looking into the vault; his body hidden
  const cam = g.camera ?? runner.ctx.camera;
  assert.ok(Math.abs(cam.position.y - (g.player.pos.y + 1.62)) < 0.15, `the eye (${cam.position.y} over ${g.player.pos.y})`);
  assert.ok(cam.getWorldDirection(new cam.position.constructor()).z > 0.9, 'looking in');
  assert.equal(g.player.object.visible, false);
  // the visor's part
  let P = plain(g.screen().state.visor);
  assert.ok(P && P.mode === 'arm' && P.ret && P.hp.max >= 3, JSON.stringify(P));
  // a shot at the ringed door: it rises
  g.key('KeyG', true); await frames(g, 2); g.key('KeyG', false);
  for (let i = 0; i < 40 && !S.doors[0].open; i++) await frames(g, 1);
  assert.ok(S.doors[0].open, 'the ringed door shot open');
  assert.ok(S.run.shots >= 1);
  // the lens up (F): its marks over what it reads; held on the mark over the door, it reads it
  g.key('KeyF', true); await frames(g, 1); g.key('KeyF', false); await frames(g, 1);
  assert.equal(S.S.mode, 'lens');
  S.S.yaw = Math.PI; S.S.pitch = -Math.atan2(5.6 - 1.62, 11.9 - g.player.pos.z);
  await frames(g, 2);
  P = plain(g.screen().state.visor);
  assert.ok(P.marks.length >= 1, 'the lens marks what it reads');
  g.key('KeyG', true); await frames(g, 40); g.key('KeyG', false);
  assert.ok(S.S.readSet.has('mark'), `the mark read (${[...S.S.readSet]})`);
  assert.equal(plain(g.screen().state.visor).read?.name, 'The makers’ mark');
  // into the gallery: its foes wake
  g.player.pos.set(0, 0.05, 20);
  await frames(g, 6);
  assert.ok(S.run.woke.has(1) && S.mine.length >= 5, `the gallery's foes (${S.mine.length})`);
  // the lock (held LT): onto one of them, the traveller's own strafe round it
  F: {
    g.key('KeyF', true); await frames(g, 1); g.key('KeyF', false);   // (the arm again)
    // (aimed at each in turn: one behind a plinth is not seen, and is never locked)
    for (const f of S.mine.filter((x) => x.alive)) {
      const d = f.chest.clone().sub(cam.position);
      S.S.yaw = Math.atan2(-d.x, -d.z); S.S.pitch = Math.asin(-d.y / d.length());
      g.key('KeyR', true); await frames(g, 3);
      if (S.S.lock) break;
      g.key('KeyR', false); await frames(g, 1);
    }
    assert.ok(S.S.lock?.foe, 'locked on');
    assert.ok(g.player._lockOn?.at?.distanceTo(S.S.lock.pos()) < 0.5, 'the stick circles it (the lock set before he moves: main.js and the engine clear it after)');
    g.key('KeyR', false); await frames(g, 1);
    assert.equal(S.S.lock, null, 'let go');
    break F;
  }
  // knocked out by the gallery's foes: the run lost, its results (how far it got), Quit back to the Arcade's sign
  await quietly(() => { for (let i = 0; i < 6 && !g.player.dead; i++) g.player.hurt(2, 'hit'); });
  await frames(g, 70);
  assert.ok(S.run.over, 'the run over');
  const res = menus.view().card;
  assert.equal(res.kind, 'results');
  assert.ok(JSON.stringify(plain(res)).includes('Rooms reached 2 of 4'), JSON.stringify(plain(res)).slice(0, 400));
  menus.navigate(0, 1); menus.action('confirm');
  await frames(g, 1);
  assert.equal(left.length, 1);
  assert.match(left[0], /level=arcade/);
  assert.equal(g.screen().state.visor, null, 'the visor gone with it');
});

test('the Round Hall\'s two waves cleared end the run: the time kept, its lines (the engine)', async () => {
  const { X, EngineMenus } = await engine();
  const menus = new EngineMenus({});
  const g = await quietly(() => X.createGame({ levelId: 'arcade', game: 'lens-vault', from: 'arcade', backend, menus }));
  await frames(g, 2);
  menus.key('Enter');
  await frames(g, 120);
  const runner = g.trials.runner, S = runner.session;
  g.player.god = true;
  g.player.pos.set(0, 0.05, 70);
  await frames(g, 4);
  assert.ok(S.run.woke.has(3), 'the Round Hall woken');
  const fell = () => quietly(() => { for (const f of S.mine) if (f.alive && f.dead === undefined) runner.ctx.foes.hurt(f, 'blade', new g.player.pos.constructor(0, 0, 1), { damage: 99 }); });
  await fell();
  for (let i = 0; i < 60 && !S.run.wave2; i++) await frames(g, 2);
  assert.ok(S.run.wave2, 'the second wave up');
  assert.ok(S.mine.some((f) => f.alive && f.kind === 'tripod'), 'the lamp tripod with it');
  await fell();
  for (let i = 0; i < 90 && !S.run.over; i++) await frames(g, 2);
  assert.ok(S.run.over, 'the run over');
  await frames(g, 70);
  const res = menus.view().card;
  assert.equal(res.kind, 'results');
  assert.match(res.big, /^\d+\.\d\d$/, 'the time');
  assert.ok(JSON.stringify(plain(res)).includes('Foes felled 10 of 18'), JSON.stringify(plain(res)).slice(0, 300));
  await quietly(() => runner.end());
});

// The mummers (issue #724; docs/design/enemy-roster-v2.md "The mummers"): the camp tribe on the humanoid rig. Each mummer
// carries one weapon and fights with it (a club's whack, a spear's jab, a bow's volley), a guarded whack knocks the club
// out of its hands and it digs up rocks until it has it back; its mask is knocked off by a headshot (two for the metal
// mask of its stronger tier), a charged cut, or as it breaks low: it drops what it holds, runs, and comes back swinging
// wide. The mummer king blows its horn (the camp within 25 m wakes) and throws a mummer at you, which lands dazed. The
// Desert keeps their camp (its blots' fire became theirs, with the king) and a pair of them walks the dunes; the Arena
// fields both.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, WAVES, CARRY, BLIND, pickWeight } from '../src/foes.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { FIGHT, TIERS, tierDef } from '../src/enemies/fight.js';
import { SITES, layoutSite } from '../src/encounters/sites.js';
import { WORLDS, ROSTERS, worldArchetypes } from '../src/foe-worlds.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { skinWorlds } from '../src/enemies/skins.js';
import { windMin } from '../src/telegraph.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { libraryFrom } from '../src/animator.js';
import { attachMotion } from '../src/motion-match.js';
import { stateClip, releaseClipTime, releaseReach, HOLD_AT, PROC_POSES, STATE_CLIPS, TURN, setFoeClips } from '../src/enemies/humanoid-rig.js';
import { MUMMER_MOVES, KING_MOVES } from '../src/enemies/plans/mummer.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function camp(o = {}) {
  clearTargets();
  const P = { pos: v(), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: 0, guardUp: false, parry: false,
    hurt() { this.hurts++; }, knockDown() { return true; }, stagger() {}, flinch() {},
    guarding() { return this.guardUp || this.parry; }, guard() { return this.parry ? 'perfect' : this.guardUp ? true : false; }, ...o };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: o.rng ?? Math.random });
  foes.setPractice('');
  return { foes, P, done: () => { foes.dispose(); clearTargets(); } };
}
const add = (foes, kind, at, o = {}) => { const f = foes.add(kind, at); f.heading = Math.PI; Object.assign(f, o); return f; };

test('the mummers on the roster: two spirits of their own plans, a camp\'s rank and file and its chief; built, skinned, every wind-up fair', () => {
  for (const id of ['mummer', 'mummerking']) {
    const A = ARCHETYPES[id];
    assert.equal(A.family, 'spirit'); assert.equal(A.status, 'built'); assert.equal(FOES[id], A.def);
    assert.ok(FIGHT[id] && TIERS[id], `${id}: its fight and its tier`);
    for (const w of skinWorlds(id)) { const m = archetypeModel(id, w); assert.ok(m?.driver, `${id}@${w}: a body on the humanoid rig`); m.dispose(); }
    for (const a of A.def.attacks) assert.ok(a.wind >= windMin(a) - 1e-9, `${id}.${a.id}: ${a.wind} s`);
  }
  assert.equal(ARCHETYPES.mummer.tier, 1); assert.equal(ARCHETYPES.mummerking.tier, 3);
  assert.ok(ARCHETYPES.mummer.def.height <= 1.15 && ARCHETYPES.mummerking.def.height >= 2.5, 'a head shorter than the traveller\'s shoulder; the king 2.6 m');
  // a body is a handful of draws: its parts skinned by material
  for (const id of ['mummer', 'mummerking']) { const m = archetypeModel(id, skinWorlds(id)[0]); let n = 0; m.group.traverse((o) => { if (o.isMesh) n++; }); assert.ok(n <= 12, `${id}: ${n} meshes`); m.dispose(); }
});

test('each carries one weapon and fights with it: the club\'s whack, the spear\'s jab, the bow\'s volley from afar; unarmed, rocks', () => {
  assert.equal(pickWeight({ club: 1, spear: 1 }, () => 0.1), 'club'); assert.equal(pickWeight({ club: 1, spear: 1 }, () => 0.9), 'spear');
  const { foes, done } = camp();
  const f = add(foes, 'mummer', v(0, 0, 2));
  assert.ok(['club', 'spear', 'bow'].includes(f.weapon), f.weapon);
  for (const [w, d, id] of [['club', 2, 'whack'], ['spear', 2.2, 'jab'], ['bow', 10, 'volley']]) {
    f.weapon = w;
    const can = f.attacksAt(d, 0).map((a) => a.id);
    assert.ok(can.includes(id), `${w}: ${can}`);
    for (const other of ['whack', 'jab', 'volley']) if (other !== id) assert.ok(!can.includes(other), `${w} never ${other}`);
    assert.ok(!can.includes('rock'), 'armed: no rock');
  }
  f.weapon = 'club'; f.disarmed = { at: v(3, 0, 3), from: v(), t: 9 };
  assert.deepEqual(f.attacksAt(6, 0).map((a) => a.id), ['rock'], 'its club knocked away: it lobs rocks');
  assert.ok(f.def.attacks.find((a) => a.id === 'rock').lob, 'a thrown rock shows its landing mark');
  done();
});

test('a guarded whack knocks the club out of its hands (a plain guard, not only a parry): it runs for it and picks it up', () => {
  const { foes, P, done } = camp({ guardUp: true });
  const f = add(foes, 'mummer', v(0, 0, 1.6), { weapon: 'club', provoked: true });
  f.state = 'chase'; f.cool = 0;
  f.beginWind(f.def.attacks.find((a) => a.id === 'whack'), P);
  for (let i = 0; i < 120 && !f.disarmed; i++) foes.update(DT);
  assert.ok(f.disarmed, 'the club flew');
  assert.equal(P.hurts, 0, 'the guard took it');
  assert.equal(f.droppedWeapon, 'club');
  P.guardUp = false; P.pos.set(0, 0, -20);   // (out of its rocks' reach, in its sight: it runs for its club)
  let picked = false;
  for (let i = 0; i < 900 && f.disarmed; i++) { foes.update(DT); if (f.reel === 'pickup') picked = true; }
  assert.ok(picked && !f.disarmed, 'bent to pick it up, armed again');
  done();
});

test('its mask: a headshot knocks it off (the metal mask of its tier takes two), and so does a charged cut; low, it comes off as it runs; then it swings wide', () => {
  const { foes, P, done } = camp();
  P.pos.set(0, 0, -6);
  const f = add(foes, 'mummer', v(0, 0, 0), { weapon: 'spear', provoked: true, state: 'chase' });
  foes.hurt(f, 'shoot', v(0, 0, 1), { damage: 0.25, zone: 'head' });
  assert.ok(f.unmasked, 'a headshot knocks the pot flying');
  assert.ok(f.disarmed, 'it drops its spear');
  assert.ok(f.fleeT > 0, 'and runs');
  // its stronger tier: a metal mask, two headshots
  assert.equal(tierDef('mummer', FOES.mummer).mask.hits, 2);
  const t = foes.add('mummer*', v(4, 0, 0)); t.provoked = true;
  foes.hurt(t, 'shoot', v(0, 0, 1), { damage: 0.25, zone: 'head' });
  assert.ok(!t.unmasked && t.alive, 'one shot rings off the metal');
  foes.hurt(t, 'shoot', v(0, 0, 1), { damage: 0.25, zone: 'head' });
  assert.ok(t.unmasked || !t.alive, 'the second knocks it off');
  // a charged cut
  const c = add(foes, 'mummer', v(-4, 0, 0), { provoked: true });
  c.hp = 5; c.def = { ...c.def, hp: 5 };
  foes.hurt(c, 'blade', v(0, 0, 1), { damage: 1, breaks: true, charged: true });
  assert.ok(c.unmasked, 'a charged cut knocks it off');
  // low: as it breaks and runs
  const l = add(foes, 'mummer', v(8, 0, 0), { provoked: true });
  foes.hurt(l, 'blade', v(0, 0, 1), { damage: 1 });
  assert.ok(l.alive && l.unmasked, `under half its health, unmasked (${l.hp}/${l.def.hp})`);
  // unmasked it can hardly see: its blows go wide of where you stand
  f.disarmed = null; f.weapon = 'club';
  const wide = [];
  for (let i = 0; i < 40; i++) { f.state = 'chase'; f.heading = 0; f.beginWind(f.def.attacks.find((a) => a.id === 'whack'), P); wide.push(f.attackH); }
  assert.ok(Math.max(...wide) - Math.min(...wide) > BLIND.wide * 0.5, 'its whack goes wide');
  done();
});

test('the mummer king: its horn wakes every mummer within 25 m; it picks one up, holds it over its crown and throws it: it lands dazed at the mark', () => {
  const { foes, P, done } = camp();
  P.pos.set(0, 0, 8);
  const k = add(foes, 'mummerking', v(0, 0, 0), { provoked: true, state: 'chase' });
  const near = add(foes, 'mummer', v(2, 0, -1)), far = add(foes, 'mummer', v(20, 0, 0)), away = add(foes, 'mummer', v(40, 0, 0));
  for (const m of [near, far, away]) { m.provoked = false; m.state = 'idle'; }
  // the horn: when it first comes on
  const horn = k.def.attacks.find((a) => a.id === 'horn');
  assert.ok(k.attacksAt(6, 0).includes(horn), 'its horn ready');
  k.cool = 0; k.beginWind(horn, P);
  for (let i = 0; i < 120 && k.state === 'wind'; i++) foes.update(DT);
  assert.ok(far.provoked && near.provoked, 'the camp within 25 m wakes');
  assert.ok(!away.provoked, '40 m off sleeps on');
  assert.ok(!k.attacksAt(6, 0).includes(horn), 'once, until half its health');
  k.hp = k.def.hp * 0.45;
  assert.ok(k.attacksAt(6, 0).includes(horn), 'and once more at half');
  // the throw: the nearest mummer, held high, then flying at the mark
  for (let i = 0; i < 60; i++) foes.update(DT);
  near.pos.set(1.5, 0, -1); near.stunned = 0; near.state = 'chase';
  k.state = 'chase'; k.cool = 0; k.pos.set(0, 0, 0);
  foes.update(DT);
  const thr = k.def.attacks.find((a) => a.id === 'throw');
  // (its turn come, it may choose the throw itself; else begun here)
  if (!(k.state === 'wind' && k.atk === thr)) { assert.ok(k.attacksAt(7, 0).includes(thr), 'a mummer near it to throw'); k.beginWind(thr, P); }
  assert.equal(k.carry, near, 'it picks up the nearest');
  let top = 0;
  for (let i = 0; i < 200 && k.state === 'wind'; i++) { foes.update(DT); top = Math.max(top, near.pos.y); }
  assert.ok(top > k.def.height, `held over its crown (${top.toFixed(2)} m)`);
  for (let i = 0; i < 5; i++) foes.update(DT);
  assert.equal(near.carriedBy, null, 'let go');
  assert.ok(near.pos.distanceTo(k.attackAt) < 0.5 && near.pos.y === 0, 'landed at the mark');
  assert.ok(near.stunned > CARRY.daze * 0.5, 'dazed: an easy cut');
  // nothing near it: no throw
  near.pos.set(30, 0, 30);
  foes.update(DT);
  assert.ok(!k.attacksAt(7, 0).includes(thr), 'no mummer near: no throw');
  done();
});

test('the Desert: the mummers\' camp became the grunts\' (roster v4, #726); the mummers kept in the Arena, the debug menu and the Sunken Hall\'s horde', () => {
  const S = SITES.desert.find((s) => s.kind === 'camp');
  assert.ok(S && S.lookout === 'grunt' && S.rack, 'the camp: grunts, a lookout and their rack');
  assert.deepEqual([...new Set(S.foes)].sort(), ['grunt', 'hulk']);
  const L = layoutSite(S, { radius: (a) => FOES[a].radius });
  assert.equal(L.foes.filter((f) => f.idle === 'sit').length, S.foes.length, 'round the fire');
  for (const a of ['mummer', 'mummerking']) {
    assert.ok(!worldArchetypes('desert').includes(a) && !ROSTERS.desert.wild[a], `${a}: off the Desert's roster`);
    assert.ok(Object.values(SITES).flat().every((s) => !s.foes.includes(a) && s.lookout !== a), `${a}: at no site`);
  }
  assert.ok(ROSTERS.desert.first === 'blot', 'the blot still leads: the Desert teaches');
  assert.equal(WORLDS.desert.stage, 0);
  assert.ok(WORLDS.desert.horde.mummer, 'the Sunken Hall\'s horde keeps them');
  assert.ok(WAVES.some((w) => w.includes('mummer')) && WAVES.some((w) => w.includes('mummerking')), 'the Arena\'s waves');
});

// (#724, the polish: the moves that had no clip) every move a clip, or a clip with a hand-made pose of the arms over it
const parse = async (n) => { const b = await readFile(new URL(`../public/anim/${n}`, import.meta.url)); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
let libP = null;
const library = () => (libP ??= Promise.all(['ual.glb', 'moves.glb', 'gestures.glb'].map(parse)).then(([u, m, g]) => { const lib = libraryFrom(u); attachMotion(lib, m); attachMotion(lib, g); return lib; }));

test('every mummer move is a shipped clip (a pose of the arms over it at most); the wind-ups pinned; the thrown ones held, then thrown as they let go', async () => {
  // the mind's timing is the contract: wind-up, strike, contact as before the clips
  const was = { mummer: { whack: [0.75, 0.3, 0.55], jab: [0.7, 0.2, 0.5], volley: [0.95, 0.2, 0.6], rock: [0.85, undefined, undefined] },
    mummerking: { smash: [1.1, 0.3, 0.55], swing: [1.1, 0.35, 0.5], horn: [1.2, undefined, undefined], throw: [1.0, undefined, undefined] } };
  for (const [id, moves] of Object.entries(was)) for (const [a, [wind, strike, contact]] of Object.entries(moves)) {
    const A = FOES[id].attacks.find((x) => x.id === a);
    assert.deepEqual([A.wind, A.strike, A.contact], [wind, strike, contact], `${id}.${a}`);
  }
  const lib = await library(), clip = (n) => lib.motion.clips.find((c) => c.name === n || c.name === `mixamo_${n}`);
  for (const [who, MOVES] of [['mummer', MUMMER_MOVES], ['mummerking', KING_MOVES]]) for (const a of FOES[who].attacks) {
    const m = MOVES[a.id], c = m && clip(m.clip);
    assert.ok(c, `${who}.${a.id}: a clip (${m?.clip})`);
    assert.ok(m.from < m.load && m.load < m.cut && m.cut < m.to && m.to <= c.duration + 1e-6, `${who}.${a.id}: from < load < cut < to`);
    if (m.pose) assert.ok(PROC_POSES[m.pose], `${who}.${a.id}: ${m.pose}`);
    // (thrown: its thing flies from the mind's own share, CARRY.fly for the mummer, the rock's lob from the same)
    if (a.lob && a.instant) assert.equal(m.release ?? CARRY.fly, CARRY.fly, `${who}.${a.id}: let go as it flies`);
  }
  for (const n of [STATE_CLIPS.down.fall.clip, STATE_CLIPS.sit.clip, STATE_CLIPS.sleep.clip, ...TURN.clips.map(([, n]) => n)]) assert.ok(clip(n), n);
  // a thrown move: loaded by releaseReach and held to the release (the telegraph), then thrown, never back
  for (const M of [MUMMER_MOVES.rock, KING_MOVES.throw]) {
    const r = releaseReach(M);
    assert.ok(r <= HOLD_AT && M.release - r >= 0.15, `held ${(M.release - r).toFixed(2)} of the wind-up before it lets go`);
    assert.ok(Math.abs(releaseClipTime(r, M) - M.load) < 1e-9 && releaseClipTime(M.release - 1e-6, M) === M.load, 'loaded, held');
    for (let k = 0.01; k <= 1; k += 0.01) assert.ok(releaseClipTime(k, M) >= releaseClipTime(k - 0.01, M) - 1e-12, 'never back');
    assert.ok(Math.abs(releaseClipTime(1, M) - M.to) < 1e-9, 'thrown through by the end of the wind-up');
    const s = stateClip({ state: 'wind', k: 0.9, atk: { id: M === KING_MOVES.throw ? 'throw' : 'rock' } }, M === KING_MOVES.throw ? KING_MOVES : MUMMER_MOVES);
    assert.ok(s.thrown > 0 && s.t > M.load, 'thrown');
  }
});

test('with the clips: the volley side-on, the rock and the mummer held high then thrown, the horn to the mask; sitting, asleep, falling, turning on the spot', async () => {
  setFoeClips(await library());
  const { foes, P, done } = camp({ dead: true, frame: { up: v(0, 1, 0) } });
  P.pos.set(0, 0, -6);
  const W = (f, j) => { f.model.group.updateMatrixWorld(true); return j.getWorldPosition(v()); };
  const run = (f, n, set) => { for (let i = 0; i < n; i++) { set?.(i); foes.look(f, DT); } };
  for (const kind of ['mummer', 'mummerking']) {
    const f = foes.add(kind, v()); f.provoked = true; f.heading = 0; f.state = 'chase';
    const J = f.model.joints, H = f.def.height;
    run(f, 40);
    const stand = { torso: W(f, J.torso).y, head: W(f, J.head).y };
    const wind = (id, k) => { run(f, 14, () => { f.state = 'wind'; f.atk = f.def.attacks.find((x) => x.id === id); f.k = k; f.weapon = f.atk.weapon ?? f.weapon; f.disarmed = null; }); return [W(f, J.hands[0]), W(f, J.hands[1])]; };
    const rest = () => { f.state = 'chase'; f.atk = null; run(f, 30); };
    if (kind === 'mummer') {
      const [r, l] = wind('volley', HOLD_AT), [r2, l2] = wind('volley', 0.97);
      assert.ok(l.z > 0.25 * H && r.z < l.z - 0.3 * H, `the volley: the bow hand out at you, the cord hand drawn back (${l.z.toFixed(2)}, ${r.z.toFixed(2)} m)`);
      assert.ok(Math.abs(r.y - stand.head) < 0.15 * H, `the cord drawn to its pot (${r.y.toFixed(2)} m)`);
      assert.ok(l.distanceTo(l2) < 0.12 * H && r.distanceTo(r2) < 0.12 * H, 'held to the end');
      rest();
    }
    const id = kind === 'mummer' ? 'rock' : 'throw', M = (kind === 'mummer' ? MUMMER_MOVES : KING_MOVES)[id];
    const held = wind(id, releaseReach(M)), late = wind(id, M.release - 0.01), thrown = wind(id, 0.97);
    const top = (h) => Math.min(h[0].y, h[1].y);
    assert.ok(top(held) > stand.head, `${id}: both hands high over its head (${top(held).toFixed(2)} m, the head ${stand.head.toFixed(2)} m)`);
    assert.ok(held[0].distanceTo(late[0]) < 0.05 * H, `${id}: held until it lets go`);
    assert.ok(top(thrown) < top(held) - 0.3 * H && thrown[0].z > held[0].z + 0.2 * H, `${id}: thrown, its hands down and out before it`);
    rest();
    if (kind === 'mummerking') {
      const [r, l] = wind('horn', 0.9);
      assert.ok(r.y > stand.head && l.y > stand.head && r.z > 0.2 * H, 'the horn raised to its cauldron in both hands');
      rest();
    }
    // sitting round the fire: on its seat, its feet on the ground before it; asleep on its back, breathing
    run(f, 60, () => { f.provoked = false; f.state = 'idle'; f.idle = { mode: 'sit' }; });
    const feet = J.feet.map((x) => W(f, x));
    assert.ok(W(f, J.torso).y < stand.torso * 0.5, `sitting: its hips down (${W(f, J.torso).y.toFixed(2)} m)`);
    assert.ok(feet.every((x) => x.y < 0.06 * H && x.z > 0.1 * H), 'its feet on the ground before it');
    run(f, 60, () => { f.idle = { mode: 'sleep' }; });
    const chest = [];
    run(f, 60, (i) => { if (i % 10 === 0) chest.push(J.torso.quaternion.clone()); });
    assert.ok(W(f, J.head).y < 0.2 * H, 'asleep, lying');
    assert.ok(Math.max(...chest.map((q) => q.angleTo(chest[0]))) > 0.02, 'breathing');
    f.provoked = true; f.idle = null; f.state = 'chase'; run(f, 40);
    // knocked down from its feet: it falls over backwards (no pop), lies
    const fall = [];
    f.state = 'recover'; f.downT = 1.6;
    run(f, 36, () => { f.downT -= DT; fall.push(W(f, J.head).y); });
    assert.ok(fall[0] > stand.head * 0.9, 'the first frame still on its feet');
    assert.ok(fall[Math.round(STATE_CLIPS.down.fall.secs * 60 * 0.5)] < stand.head && fall[Math.round(STATE_CLIPS.down.fall.secs * 60 * 0.5)] > stand.head * 0.6, 'half way through the fall: going over');
    for (let i = 1; i < fall.length; i++) assert.ok(fall[i] - fall[i - 1] < 0.08 * H && fall[i - 1] - fall[i] < 0.3 * H, `no pop (frame ${i}: ${fall[i - 1].toFixed(2)} → ${fall[i].toFixed(2)})`);
    assert.ok(fall.at(-1) < 0.2 * H, 'lying');
    f.downT = 0; f.state = 'chase'; run(f, 60);
    // turned round on the spot (the mind's heading set at once): the body follows at TURN.rate on the traveller's turn
    const R = f.model.group.getObjectByName('rig'), turns = [];
    f.heading = 1.6;
    for (let i = 0; i < 50; i++) { foes.look(f, DT); turns.push(R.rotation.y); }
    assert.equal(f.model.driver.turn?.clip, 'left_turn_90', 'a quarter turn to its left');
    assert.ok(turns[0] < -1.4, 'the body still facing where it was');
    for (let i = 1; i < turns.length; i++) assert.ok(turns[i] - turns[i - 1] <= TURN.rate * DT + 1e-6, 'never faster than TURN.rate');
    assert.ok(Math.abs(turns.at(-1)) < 0.01, 'and round');
    foes.remove(f);
  }
  done();
});

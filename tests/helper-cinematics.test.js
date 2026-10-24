import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { helperInvitation, helperWorldLease, helperOpeningShots, helperOpeningFlag, HELPER_CAPTIONS, HELPER_OPENING } from '../src/temples/helper-cinematics.js';
import { HELPER_KEY } from '../src/temples/helper-encounter.js';
import { Moment } from '../src/story/moment.js';
import { TONES } from '../src/story/tone.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function fixture(id = 'desert', { unavailable = false, seen = false } = {}) {
  const stores = { a: {}, b: {} }; let active = 'a';
  const game = { flag: k => stores[active][k], set: (k, v) => { stores[active][k] = JSON.parse(JSON.stringify(v)); } };
  if (seen) game.set(helperOpeningFlag(id), true);
  const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  const group = new THREE.Group(); root.add(group);
  const body = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial()); body.position.y = 2; group.add(body);
  const pool = new THREE.Group(); pool.position.set(12, 0, 0); root.add(pool);
  const wind = new THREE.Group(); wind.position.set(12, 0, 0); root.add(wind);
  scene.updateMatrixWorld(true);
  const rt = { id, root, logic: { resolved: false }, inside: () => true,
    guardian: { model: { pos: V(), group, height: 4, radius: 2 }, arena: { y: 0 }, def: { helper: id === 'desert' ? 'cistern' : 'elderflight' } },
    spring: { pool }, roostWinds: [{ foot: wind.position.clone(), root: wind }] };
  const player = { pos: V(0, 0, 6), vel: V(), heading: 0, frame: { up: V(0, 1, 0), dir: (_h, out) => out.set(0, 0, -1) } };
  const lease = helperWorldLease(game), paths = [], frames = [], captions = [];
  const stage = { game, player, shot: c => frames.push(c), say: line => { if (line) captions.push(line); } };
  const moments = { current: null, plays: 0, play(o) {
    this.plays++;
    if (unavailable) return null;
    const m = new Moment({ ...o, stage }); this.current = m; m.start(); return m;
  } };
  const invite = helperInvitation(rt, { game, player, moments, from: id, playGame: href => paths.push(href), liveWorld: lease.live, slot: () => active });
  const finish = () => { for (let i = 0; i < 100 && !moments.current.done; i++) moments.current.update(.1); };
  return { rt, player, scene, game, stores, lease, moments, invite, paths, frames, captions, finish, slot: x => { active = x; } };
}

for (const id of ['desert', 'arzach']) test(`${id}: two real-subject panels explain the game before creating one receipt`, () => {
  const f = fixture(id), origin = f.player.pos.toArray();
  assert.equal(f.invite.start(), true); assert.equal(f.invite.start(), false, 'held/repeated interaction cannot duplicate the film');
  assert.equal(f.paths.length, 0); assert.equal(f.game.flag(HELPER_KEY), undefined, 'opening is not gameplay success or a pending run');
  const m = f.moments.current; assert.equal(m.shots.length, 2); assert.equal(m.dur, HELPER_OPENING.context + HELPER_OPENING.guide);
  assert.equal(m.skip(), false, 'opening press cannot immediately skip');
  f.player.pos.set(90, 20, 80); f.finish();
  assert.equal(f.paths.length, 1); assert.equal(f.invite.start(), false);
  const receipt = f.game.flag(HELPER_KEY);
  assert.deepEqual(receipt.returnPose.pos, origin, 'return pose belongs to explicit interaction, before camera playback');
  assert.equal(receipt.slot, 'a'); assert.equal(receipt.success, false); assert.equal(receipt.returning, false);
  assert.equal(f.game.flag(`temple.${id}.done`), undefined, 'neither opening nor its skip can resolve a temple');
  assert.deepEqual(f.captions.map(l => l.text), HELPER_CAPTIONS[id].map(l => l.text));
  assert.ok(f.captions.every(l => l.who === 'scene' && TONES.includes(l.tone) && !l.text.includes('~')), 'unnamed captions have explicit valid tones');
  m.finish(true); assert.equal(f.paths.length, 1, 'repeated teardown cannot launch again');
});

for (const seconds of [.8, 3.4]) test(`skip in either panel (${seconds}s) launches once without success`, () => {
  const f = fixture(); f.invite.start(); f.moments.current.update(seconds);
  assert.equal(f.moments.current.skip(), true); f.moments.current.update(.01);
  assert.equal(f.paths.length, 1); assert.equal(f.game.flag(HELPER_KEY).success, false);
  f.moments.current.finish(false); assert.equal(f.paths.length, 1);
});

for (const mode of ['dispose', 'slot', 'world', 'detach']) test(`${mode}: stale film end cannot create a receipt or navigate`, () => {
  const f = fixture(); f.invite.start(); const film = f.moments.current;
  if (mode === 'dispose') f.invite.dispose();
  if (mode === 'slot') f.slot('b');
  if (mode === 'world') helperWorldLease(f.game);
  if (mode === 'detach') f.scene.remove(f.rt.root);
  film.update(.1); film.finish(true);
  assert.equal(f.paths.length, 0); assert.equal(f.stores.a[HELPER_KEY], undefined); assert.equal(f.stores.b[HELPER_KEY], undefined);
  assert.equal(f.invite.start(), false);
});

test('old-world disposal cannot invalidate the new world lease', () => {
  const game = {}, old = helperWorldLease(game), next = helperWorldLease(game);
  assert.equal(old.live(), false); assert.equal(next.live(), true); old.dispose(); assert.equal(next.live(), true);
  next.dispose(); assert.equal(next.live(), false);
});

for (const options of [{ unavailable: true }, { seen: true }]) test(`unavailable or already seen opening uses the same immediate receipt boundary: ${JSON.stringify(options)}`, () => {
  const f = fixture('desert', options); assert.equal(f.invite.start(), true);
  assert.equal(f.paths.length, 1); assert.equal(f.game.flag(HELPER_KEY).success, false);
  assert.equal(f.invite.start(), false); assert.equal(f.paths.length, 1);
});

test('resolved or old disposed world cannot start; missing safe views never invent scenery', () => {
  const resolved = fixture(); resolved.rt.logic.resolved = true; assert.equal(resolved.invite.start(), false);
  const old = fixture(); old.invite.dispose(); assert.equal(old.invite.start(), false);
  const blocked = fixture(); blocked.rt.inside = () => false;
  assert.equal(helperOpeningShots(blocked.rt, blocked.player), null);
  assert.equal(blocked.invite.start(), true); assert.equal(blocked.moments.plays, 0); assert.equal(blocked.paths.length, 1);
});

test('opening seen state survives reload without awarding anything or replaying the film', () => {
  const f = fixture(); f.invite.start(); f.invite.dispose();
  assert.equal(f.game.flag(helperOpeningFlag('desert')), true); assert.equal(f.game.flag(HELPER_KEY), undefined);
  const lease = helperWorldLease(f.game);
  const next = helperInvitation(f.rt, { game: f.game, player: f.player, moments: f.moments, from: 'desert',
    playGame: href => f.paths.push(href), liveWorld: lease.live, slot: () => 'a' });
  assert.equal(next.start(), true); assert.equal(f.moments.plays, 1); assert.equal(f.paths.length, 1);
  assert.equal(f.game.flag(HELPER_KEY).success, false);
});


test('completion elsewhere during the introduction cannot launch a new helper run', () => {
  const f = fixture(); f.invite.start(); f.rt.logic.resolved = true; f.finish();
  assert.equal(f.paths.length, 0); assert.equal(f.game.flag(HELPER_KEY), undefined);
});

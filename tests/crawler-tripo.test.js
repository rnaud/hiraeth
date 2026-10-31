// The survey crawler (issue #800): the Tripo body is the game's crawler (src/enemies/plans/crawler-tripo.js, its shipped
// asset public/enemies/crawler/body.glb), the legacy crawler (plans/crawler-legacy.js) its stand-in where the body is not
// loaded, kept so its look can come back. Its rigid parts' weights are sound, a bent joint moves only its own part, it
// stands at the traveller's hip grown (the knob of its antenna; its dome under it), four legs on the kit, its head looks
// at him, and it fights as the crawler did (its call rears it, its fuse blinks, it bursts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { TRIAL_BUILDERS, archetypeModel } from '../src/enemies/plans/index.js';
import { crawlerLegacyModel } from '../src/enemies/plans/crawler-legacy.js';
import { tripoCrawlerModel, crawlerSource, CRAWLER_BODY, CRAWLER_ROLES } from '../src/enemies/plans/crawler-tripo.js';
import { parseTripoBody } from '../src/enemies/plans/tripo-body.js';
import { PLANS } from '../src/motion-kit/plans.js';
import { nextRigSeed } from '../src/motion-kit/rig.js';

THREE.ColorManagement.enabled = false;
const SRC = crawlerSource();
const BUILD = { legacy: crawlerLegacyModel, tripo: (skin) => tripoCrawlerModel(skin, SRC) };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M) => { const out = []; M.group.traverse((o) => { if (o.isSkinnedMesh && o.name.startsWith('crawler ')) out.push(o); }); return out; };
/** A seeded random (the fights' own rng: tests that field foes are seeded, c5b8ab3c1). */
const seeded = (s = 13) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('the game\'s crawler is the Tripo survey crawler, from its shipped body, in its skin and its tier; the legacy kept (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS), []);
  for (const tier of [0, 1]) { const M = archetypeModel('crawler', 'desert', tier); assert.equal(M.tripo, 'tripo', `tier ${tier}`); M.dispose(); }
  const T = parseTripoBody(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyE-tripo/crawler-lod.glb', import.meta.url)));
  assert.deepEqual(Array.from(SRC.geometry.attributes.position.array), Array.from(T.geometry.attributes.position.array));
  assert.deepEqual(Array.from(SRC.geometry.index.array), Array.from(T.geometry.index.array));
  assert.equal(SRC.geometry.attributes.uv, undefined, 'no picture (no UVs)');
  assert.deepEqual(SRC.landmarks, JSON.parse(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyE-tripo/crawler-landmarks.json', import.meta.url), 'utf8')));
  assert.ok(readFileSync(new URL(`../public/${CRAWLER_BODY}`, import.meta.url)).length < 450 * 1024, 'under 450 KB');
  const M = crawlerLegacyModel(skinOf('crawler', 'desert')); assert.equal(M.tripo, undefined); M.dispose();
  const home = skinOf('crawler', 'desert').palette;
  assert.equal(home.ceramic, CRAWLER_ROLES.ceramic, 'the reference\'s cream');
  assert.equal(home.leg, CRAWLER_ROLES.leg, 'and its sage legs');
});

test('its skins build on the Tripo body: a handful of meshes, four legs on the kit\'s crawler plan, its tells', () => {
  for (const tier of [0, 1]) {
    const M = tripoCrawlerModel(skinOf('crawler', 'desert', tier), SRC);
    for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'gaze']) assert.ok(M[k] !== undefined, `${tier}: ${k}`);
    const sms = skinnedOf(M);
    assert.equal(new Set(sms.map((s) => s.skeleton)).size, 1, 'one skeleton');
    assert.ok(sms.some((s) => s.material.defines?.FOE_SURFACE), 'a painted surface');
    assert.ok(drawn(M.group) <= 8, `${drawn(M.group)} meshes`);
    assert.equal(M.rig.legs.length, 4, 'four legs');
    assert.equal(M.rig.plan, PLANS.crawler, 'the crawler plan');
    for (const a of ARCHETYPES.crawler.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `a tell for ${a.id}`);
    M.dispose();
  }
});

test('the Tripo skin: its triangles, normalised weights, an exact bind, every bone carrying vertices, a knee bent alone moves its own shin', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  const M = tripoCrawlerModel(skinOf('crawler', 'desert'), SRC), sms = skinnedOf(M), sk = sms[0].skeleton;
  M.group.updateMatrixWorld(true); sk.update();
  const v = new THREE.Vector3(), rest = new THREE.Vector3(), carried = new Set();
  let worst = 0;
  const pos = (sm, i) => sm.applyBoneTransform(i, v.fromBufferAttribute(sm.geometry.attributes.position, i)).applyMatrix4(sm.matrixWorld);
  for (const sm of sms) {
    const W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position;
    for (const i of new Set(sm.geometry.index.array)) {
      const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`);
      carried.add(J.getX(i));
      rest.fromBufferAttribute(P, i).applyMatrix4(sm.matrixWorld);
      worst = Math.max(worst, pos(sm, i).distanceTo(rest));
    }
  }
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  assert.equal(carried.size, sk.bones.length, 'every bone carries vertices');
  const si = sk.bones.findIndex((b) => b.name === 'leg0_shin');
  sk.bones[si].rotateX(0.4); M.group.updateMatrixWorld(true); sk.update();
  let stray = 0;
  for (const sm of sms) { const W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position;
    for (const i of new Set(sm.geometry.index.array)) { if ([0, 1, 2, 3].some((k) => J.getComponent(i, k) === si && W.getComponent(i, k) > 0)) continue; rest.fromBufferAttribute(P, i).applyMatrix4(sm.matrixWorld); stray = Math.max(stray, pos(sm, i).distanceTo(rest)); } }
  assert.ok(stray < 1e-4, `a vertex not on the shin moved ${stray}`);
  M.dispose();
});

function fight(build) {
  clearTargets(); TRIAL_BUILDERS.crawler = build; nextRigSeed(53);
  const player = { pos: new THREE.Vector3(0, 0, 6), heading: Math.PI };
  const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player, physics: { groundAt: () => 0 }, game: new GameState(null), rng: seeded() });
  const f = foes.add('crawler@desert', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  return { foes, f, player, done() { foes.dispose(); delete TRIAL_BUILDERS.crawler; clearTargets(); } };
}

test('grown, it reaches the traveller\'s hip with its antenna, its dome under it; it rears to call, lights its fuse and goes down (#741)', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    const { foes, f, done } = fight(build);
    for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
    const top = new THREE.Box3().setFromObject(f.model.group).max.y;
    assert.ok(top >= 0.955 && top < 1.4, `${v}: ${top.toFixed(2)} m`);
    // (reared on its hind pair: its front, its eyes, up)
    const tell = f.model.tell('bite'), at0 = tell.getWorldPosition(new THREE.Vector3());
    f.atk = f.def.attacks.find((a) => a.id === 'call'); f.state = 'wind';
    for (let i = 0; i <= 20; i++) { f.k = i / 20; foes.look(f, 1 / 30); }
    assert.ok(tell.getWorldPosition(new THREE.Vector3()).y > at0.y + 0.03, `${v}: it rears up to call`);
    f.atk = null; f.state = 'idle'; f.k = 0;
    // (a blow that would end it leaves a sliver: its fuse lit, then cut down in it, it goes)
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 300 && !(f.state === 'wind' && f.atk?.id === 'blast'); i++) foes.update(1 / 60);
    assert.ok(f.state === 'wind' && f.atk?.id === 'blast', `${v}: its fuse lit`);
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 40; i++) foes.update(1 / 30);
    assert.ok(f.dying || !f.alive, `${v}: down`);
    done();
  }
});

test('it looks at the traveller: its head turns his way (#800, the author\'s)', () => {
  const at = {};
  for (const side of [1, -1]) {
    const { foes, f, player, done } = fight(BUILD.tripo);
    player.pos.set(side * 4, 0, 3);
    for (let i = 0; i < 90; i++) { f.dist = player.pos.distanceTo(f.pos); f.state = 'idle'; foes.look(f, 1 / 60); f.model.group.updateMatrixWorld(true); }
    assert.ok(f.gaze.watching, 'it has noticed him');
    at[side] = f.model.gaze[0].yaw;
    done();
  }
  assert.ok(at[1] > 0.15 && at[-1] < -0.15, `the head turns his way (${at[1].toFixed(2)}, ${at[-1].toFixed(2)})`);
});

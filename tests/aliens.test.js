// The non-humanoid peoples (src/aliens/, docs/systems/aliens.md): their bodies build with a
// cheaper far version, every one of them loads, moves, reacts to the fluid tool in its own way
// and comes back, can be talked to (listen-only, every line with a tone), and speaks its own tongue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { SPECIES, TONE_BODY } from '../src/aliens/species.js';
import { buildBody, kneeOf, STILT } from '../src/aliens/bodies.js';
import { Alien } from '../src/aliens/alien.js';
import { spawnAliens, alienSpots, routeOf } from '../src/aliens/index.js';
import { ALIENS, ALIEN_LINES } from '../src/story/aliens-data.js';
import { DialogueRunner, Dialogue } from '../src/story/dialogue.js';
import { parseLine, TONES } from '../src/story/tone.js';
import { LANGUAGES, planLine, voiceOf } from '../src/story/voice.js';
import { SCRIPTS, scriptOf, writeChunk } from '../src/story/scripts.js';
import { selfLitSkips } from '../src/shadows.js';

const flat = { groundAt: () => 0, groundNormal: () => new THREE.Vector3(0, 1, 0), pushCapsule: () => null };
const LEVELS = [...readFileSync(new URL('../src/levels/index.js', import.meta.url), 'utf8').matchAll(/^\s+id: '(\w+)'/gm)].map((m) => m[1]);
const ALL = Object.entries(ALIENS).flatMap(([w, list]) => list.map((d) => [w, d]));

/** A save and a quest log in a few lines (as tests/listen.test.js). */
function world(flags = {}) {
  const F = { ...flags };
  const game = { flag: (k) => F[k], set: (k, v) => { F[k] = v; }, emit() {}, on() { return () => {}; } };
  const quests = { stage: (q) => F[`quest.${q}`], has: () => false, isDone: (q) => F[`quest.${q}`] === 'done', isActive: (q) => F[`quest.${q}`] !== undefined && F[`quest.${q}`] !== 'done', isStarted: (q) => F[`quest.${q}`] !== undefined, reached: () => false };
  return { game, quests };
}
const tris = (o) => { let n = 0; o.traverse((m) => { if (m.isMesh) n += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); }); return n; };
function frames(a, n, player, camera, dt = 1 / 60) { for (let i = 0; i < n; i++) a.update(dt, player, camera); }
function stage(a, d = 4) {
  const player = { pos: a.pos.clone().add(new THREE.Vector3(d, 0, 0)), vel: new THREE.Vector3() };
  const camera = { position: player.pos.clone().add(new THREE.Vector3(0, 2, 3)) };
  return { player, camera };
}

test('four peoples, each in a few worlds (not all), each with its own tongue and writing', () => {
  const ids = Object.keys(SPECIES);
  assert.ok(ids.length >= 3 && ids.length <= 5, `${ids.length} species`);
  const worlds = new Set(ids.flatMap((id) => SPECIES[id].worlds));
  assert.ok(worlds.size >= 3 && worlds.size < LEVELS.length / 2, `${worlds.size} worlds`);
  for (const id of ids) {
    const S = SPECIES[id];
    for (const w of S.worlds) assert.ok(LEVELS.includes(w), `${id}: ${w} is a level`);
    assert.ok(LANGUAGES[S.lang] && !LANGUAGES[S.lang].native, `${id} speaks ${S.lang}`);
    assert.equal(scriptOf(S.lang), SCRIPTS[S.lang], `${id} writes its own script`);
    assert.ok(S.lod.near < S.lod.mid && S.lod.mid < S.lod.far && S.lod.far < S.lod.hide, `${id}: levels of detail in order`);
    // and the cast: a few of them in each of their worlds, nowhere else
    for (const w of S.worlds) assert.ok((ALIENS[w] ?? []).filter((d) => d.species === id).length >= 3, `${id}: a few in ${w}`);
  }
  for (const [w, d] of ALL) assert.ok(SPECIES[d.species].worlds.includes(w), `${d.id} lives where its people do`);
  assert.equal(new Set(ALL.map(([, d]) => d.id)).size, ALL.length, 'ids are unique');
  // a tone is a body's gesture, not a face: every tone has one
  for (const t of TONES) assert.ok(TONE_BODY[t], `${t} shows on a body`);
});

test('their voices: a bell that glides up, a sparse drone, a burr that bubbles down, five at once', () => {
  const line = '~neutral~ We heard the tower speak tonight, all of us, over the market.';
  const plan = (lang, v = { id: 'x', voice: 1 }) => planLine(line, { voice: voiceOf(v), lang });
  const P = Object.fromEntries(['drifter', 'stilt', 'shell', 'murmur', 'desert'].map((l) => [l, plan(l)]));
  const glide = (p) => p.syllables.reduce((a, s) => a + Math.log2(s.pitch.at(-1)[1] / s.pitch[0][1]) * 12, 0) / p.syllables.length;
  assert.ok(glide(P.drifter) > 1 && P.drifter.syllables.every((s) => s.ring > 0.5), 'drifters: ringing, gliding up');
  assert.ok(P.stilt.syllables.length < P.desert.syllables.length * 0.7, 'stilt-walkers: few syllables');
  const mean = (p) => p.syllables.reduce((a, s) => a + s.f0, 0) / p.syllables.length;
  assert.ok(glide(P.shell) < glide(P.desert) - 0.3 && mean(P.shell) < mean(P.desert) * 0.9, 'shellbacks: deep, falling');
  // murmurs: every syllable said by all of them together, a little apart in pitch
  const M = P.murmur.syllables, lead = M.filter((s) => !s.chorus);
  assert.equal(M.length, lead.length * (1 + LANGUAGES.murmur.chorus.length));
  for (let k = 1; k < M.length; k++) assert.ok(M[k].i >= M[k - 1].i, 'in step with the letters');
  assert.ok(new Set(M.slice(0, 4).map((s) => Math.round(s.f0))).size === 4, 'four pitches at once');
  // written in their own scripts: the coils a syllable, the lantern marks a word
  assert.equal(writeChunk('garden', 'shell').glyphs.length, 2);
  assert.equal(writeChunk('lantern', 'stilt').glyphs.length, 1);
  assert.equal(writeChunk('five', 'murmur').glyphs.length, 4);
});

test('each body builds without a skeleton, with a far body of far fewer triangles; solid parts cast shadows', () => {
  for (const id of Object.keys(SPECIES)) {
    const B = buildBody(id, { count: SPECIES[id].members });
    let bones = 0, solid = 0, glowing = 0;
    B.root.traverse((o) => { if (o.isBone || o.isSkinnedMesh) bones++; if (o.isMesh) { if (selfLitSkips(o)) glowing++; else solid++; } });
    assert.equal(bones, 0, `${id}: no skeleton`);
    assert.ok(solid >= 1, `${id}: its body casts a shadow`);
    if (id !== 'murmur') {
      assert.ok(glowing >= 1, `${id}: something of it glows (its tone)`);
      assert.ok(B.far && tris(B.far) < tris(B.root) * 0.6, `${id}: the far body is cheaper (${tris(B.far)} vs ${tris(B.root)})`);
      assert.ok(!selfLitSkips(B.far), `${id}: the far body casts a shadow too`);
    } else {
      assert.ok(B.parts.near.isInstancedMesh && B.parts.far.isInstancedMesh, 'the five are one instanced draw');
      assert.ok(B.parts.far.geometry.attributes.position.count < B.parts.near.geometry.attributes.position.count * 0.5);
    }
    // their own materials: tinting one never tints another
    const B2 = buildBody(id, { count: SPECIES[id].members });
    assert.notEqual(B.mats.body, B2.mats.body);
  }
  // the stilt-walker's knees: as long as its bones, out and up between hip and foot
  const hip = new THREE.Vector3(0, STILT.hub, 0), foot = new THREE.Vector3(STILT.spread, 0, 0), knee = kneeOf(hip, foot, STILT.thigh, STILT.shin, new THREE.Vector3(), new THREE.Vector3(1, 0.7, 0));
  assert.ok(Math.abs(knee.distanceTo(hip) - STILT.thigh) < 1e-3 && Math.abs(knee.distanceTo(foot) - STILT.shin) < 1e-3);
  assert.ok(knee.y > STILT.hub && knee.x > 0, 'a harvestman’s knee, high and out');
});

test('every one of them loads, walks its round, and changes detail with distance', () => {
  const scene = new THREE.Scene();
  for (const [w, d] of ALL) {
    const [a] = spawnAliens(scene, flat, w).filter((x) => x.def.id === d.id);
    assert.ok(a, `${d.id} spawned`);
    assert.ok(a.route.length >= 2, `${d.id} has somewhere to go`);
    const far = { pos: a.pos.clone().add(new THREE.Vector3(60, 0, 0)), vel: new THREE.Vector3() };
    const camera = { position: a.pos.clone().add(new THREE.Vector3(0, 3, 8)) };
    const start = a.pos.clone();
    frames(a, 60 * 30, far, camera, 1 / 30);
    assert.ok(a.pos.distanceTo(start) > 0.3, `${d.id} wanders`);
    for (const v of [a.faceAt(), a.talkAt(), a.chest()]) assert.ok(Number.isFinite(v.x + v.y + v.z));
    assert.ok(a.talkAt().y > a.faceAt().y, `${d.id}: the prompt hangs over the face`);
    assert.equal(a.tier, 'near');
    camera.position.copy(a.pos).add(new THREE.Vector3(SPECIES[d.species].lod.mid + 5, 0, 0)); frames(a, 8, far, camera);
    assert.equal(a.tier, 'far');
    camera.position.copy(a.pos).add(new THREE.Vector3(SPECIES[d.species].lod.hide + 5, 0, 0)); frames(a, 8, far, camera);
    assert.equal(a.object.visible, false, `${d.id} hidden far away`);
    camera.position.copy(a.pos).add(new THREE.Vector3(0, 2, 5)); frames(a, 8, far, camera);
    assert.ok(a.object.visible && a.tier === 'near');
  }
});

test('the fluid tool: each people has its own reaction, and they all come back', () => {
  const scene = new THREE.Scene();
  const one = (w, species) => spawnAliens(scene, flat, w).find((a) => a.species === species);
  const push = (a) => { const { player, camera } = stage(a); frames(a, 30, player, camera); const p0 = a.pos.clone(); a.hit('push', new THREE.Vector3(-1, 0, 0), { strength: 1 }); return { player, camera, p0 }; };
  // the drifter floats back and up, then settles to its height again
  {
    const a = one('spheres', 'drifter'), { player, camera, p0 } = push(a);
    frames(a, 20, player, camera);
    assert.ok(a.motor.rise_ > 0.2, 'lifted');
    frames(a, 60, player, camera);
    assert.ok(a.pos.distanceTo(p0) > 1.5, 'floated back');
    frames(a, 60 * 8, player, camera);
    assert.ok(Math.abs(a.motor.rise_) < 0.1, 'settled');
    assert.ok(a.shout && ALIEN_LINES.drifter.pushed.includes(a.shout.text));
  }
  // the stilt-walker sways and steps to catch itself
  {
    const a = one('arzach', 'stilt'), { player, camera } = push(a);
    const feet0 = a.motor.feet.map((f) => f.at.clone());
    frames(a, 15, player, camera);
    assert.ok(a.motor.sway.length() > 0.1, 'it sways');
    frames(a, 90, player, camera);
    assert.ok(a.motor.feet.some((f, k) => f.at.distanceTo(feet0[k]) > 0.3), 'it steps');
    frames(a, 60 * 6, player, camera);
    assert.ok(a.motor.sway.length() < 0.1, 'and stands');
  }
  // the shellback pulls in and rolls, then rights itself and comes out
  {
    const a = one('perdide2', 'shell'), { player, camera, p0 } = push(a);
    frames(a, 20, player, camera);
    assert.ok(a.motor.inK > 0.6 && a.motor.roll > 0.5, 'in its shell, rolling');
    frames(a, 60 * 9, player, camera);
    assert.ok(a.pos.distanceTo(p0) > 1, 'rolled off');
    assert.ok(a.motor.roll === 0 && a.motor.inK < 0.15, 'upright and out again');
  }
  // the murmurs scatter and hop back to their places
  {
    const a = one('bazaar', 'murmur'), { player, camera } = push(a);
    frames(a, 30, player, camera);
    const spread = Math.max(...a.motor.members.map((m) => m.off.length()));
    assert.ok(spread > 1.2 && a.motor.members.some((m) => m.flung), `scattered (${spread.toFixed(2)} m)`);
    frames(a, 60 * 10, player, camera);
    assert.ok(a.motor.members.every((m) => !m.flung && m.off.length() < 1.1), 'together again');
  }
  // stilled: frozen and frosted, then free; splashed: in the fluid's colours a moment
  for (const [w, s] of [['spheres', 'drifter'], ['bazaar', 'murmur']]) {
    const a = one(w, s), { player, camera } = stage(a);
    frames(a, 10, player, camera);
    a.hit('stun', null, {});
    assert.ok(a.stunned());
    frames(a, 10, player, camera);
    assert.ok(a.body.mats.body.uniforms.uColor.value.b > a.body.mats.body.uniforms.uColor.value.r, 'frosted');
    frames(a, 60 * 4, player, camera);
    assert.ok(!a.stunned());
    a.hit('shoot', new THREE.Vector3(0, 0, -1), { colours: ['#ff0000', '#ff0000'] });
    frames(a, 10, player, camera);
    const c = a.body.mats.body.uniforms.uColor.value;
    assert.ok(c.r > c.g + 0.1, 'in the fluid’s colours');
    assert.ok(ALIEN_LINES[s].splashed.includes(a.shout.text));
  }
});

test('each of them can be talked to: listen-only, every line with a tone, hints while their quest is at that step', () => {
  for (const [w, d] of ALL) {
    assert.ok(d.talk?.listen?.length >= 3 && d.name && d.title, `${d.id} has something to say`);
    for (const l of [...d.lines, ...d.talk.listen.flatMap((e) => [e?.say ?? e].flat())]) assert.ok(parseLine(l).explicit, `${d.id}: “${String(l).slice(0, 40)}” has a tone`);
    const ctx = world();
    const r = new DialogueRunner(d, ctx);
    assert.ok(!r.ended && r.text.length > 2 && r.choices().length === 0, `${d.id} talks`);
  }
  // a hint for the step the quest is at (Ommo and the spheres, Moor and the pools, the murmurs and Kip)
  const said = (id, flags) => { const d = ALL.find(([, x]) => x.id === id)[1], ctx = world(flags); return Array.from({ length: 6 }, () => new DialogueRunner(d, ctx).pages.join(' ')).join(' | '); };
  assert.match(said('ommo.drifter', { 'quest.spheres.listen': 'listen' }), /Splash them/);
  assert.match(said('moor.shell', { 'quest.perdide2.lamps': 'pools' }), /Shoot the dark pools/);
  assert.match(said('murmur.square', { 'quest.bazaar.signal': 'kip' }), /second skybridge/);
  assert.doesNotMatch(said('murmur.square', {}), /second skybridge/);
  for (const k of ['splashed', 'pushed', 'singed']) for (const s of Object.keys(SPECIES)) assert.ok(ALIEN_LINES[s][k].every((l) => parseLine(l).explicit), `${s} ${k}`);
});

test('a conversation with one: it opens on them, and the tone of each line shows on their body', () => {
  const scene = new THREE.Scene();
  for (const species of Object.keys(SPECIES)) {
    const w = SPECIES[species].worlds[0];
    const a = spawnAliens(scene, flat, w).find((x) => x.species === species);
    const { player, camera } = stage(a, 2.5);
    const { game, quests } = world();
    const dialogue = new Dialogue({ game, quests, onOpen: (p, npc) => { npc.talkTo = { speaking: true }; }, onClose: (p, npc) => { npc.talkTo = null; } });
    // a line we know the tone of
    const person = { ...a.def, id: `${a.def.id}.test`, talk: { listen: ['~happy~ Hello, hello, small one, how bright you are today!'] } };
    assert.ok(dialogue.start(person, a), `${species}: the talk opens`);
    for (let i = 0; i < 40; i++) { dialogue.update(1 / 60); a.express(dialogue.faces().npc); a.update(1 / 60, player, camera); }
    assert.equal(a.tone, 'happy');
    assert.ok(a.mood.glow > 1.1 && a.mood.pose > 0.2, `${species}: brighter and open while it says a happy line`);
    // turned to the traveller
    const toYou = Math.atan2(player.pos.x - a.pos.x, player.pos.z - a.pos.z);
    for (let i = 0; i < 200; i++) a.update(1 / 60, player, camera);
    assert.ok(Math.abs(Math.atan2(Math.sin(a.heading - toYou), Math.cos(a.heading - toYou))) < 0.3, `${species} faces you`);
    // the portrait: from your side, looking at its face
    const P = a.portraitShot(player.pos), f = a.faceAt();
    assert.ok(P.eye.distanceTo(f) > 0.8 && P.eye.distanceTo(f) < 3.5);
    assert.ok(P.eye.clone().sub(a.pos).setY(0).dot(player.pos.clone().sub(a.pos).setY(0)) > 0, 'seen from where you stand');
    dialogue.close();
    assert.equal(a.talkTo, null);
  }
});

test('placed in their worlds: on the ground, apart from each other, off the crowd’s paths', () => {
  for (const [w, list] of Object.entries(ALIENS)) {
    const spots = alienSpots(w);
    assert.equal(spots.length, list.length);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i].at, b = list[j].at;
      assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 12, `${list[i].id} and ${list[j].id} apart`);
    }
    for (const d of list) { const { at, route } = routeOf(d, flat); assert.equal(at.y, 0); assert.ok(route.every((p) => p.distanceTo(at) < (d.wander ?? 300) + 1)); }
  }
});

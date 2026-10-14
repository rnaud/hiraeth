// Every guardian made fair as the Keeper was (issue #319; docs/systems/foes.md "Every guardian, fair"): the warden's and
// the Elder's blows took floor 18.7 and 15.1 m from their bodies, their locks were 2.4 and 2.5 m off their weak points,
// their combos' blows under a second apart; the Keeper's and the Elder's skins faced away from the fight; the Elder was
// inked as glass is. Now each blow lands with the guardian's posed body (`parts`) or with what it draws of it (`blast`:
// a beam, a front), the lock is on every weak point, a combo's blows are 1.4 s apart at least, the warden and the Elder
// open after every move, and every guardian is grounded and shadows whole.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './register-gadgets.js';
import { Guardian, windOf, Blast, BLAST, COLUMN, segmentGap } from '../src/temples/boss.js';
import { GUARDIANS } from '../src/arena-guardians.js';
import { WARDEN } from '../src/temples/incal.js';
import { ELDER } from '../src/temples/arzach.js';
import { MOTHER_GASP } from '../src/temples/arzach2.js';
import { elderGuardian, keeperGuardian } from '../src/temples/guardian-generated.js';
import { sentinelModel, whaleModel } from '../src/temples/guardians.js';
import { guardianLock } from '../src/foes.js';
import { selfLitSkips } from '../src/shadows.js';
import { guardianHitboxes } from '../src/hitboxes.js';

globalThis.ProgressEvent ??= class { constructor(type, v) { this.type = type; Object.assign(this, v); } };
const PUBLIC = new URL('../public/', import.meta.url);
GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  try {
    const bytes = fs.readFileSync(new URL(String(url).replace(/^\/+/, ''), PUBLIC)), len = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + len));
    for (const m of json.meshes) for (const p of m.primitives) delete p.material;
    delete json.materials; delete json.textures; delete json.images;
    json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + len).toString('base64');
    this.parse(JSON.stringify(json), '', onLoad, onError);
  } catch (e) { onError?.(e); }
};
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const fakePlayer = () => ({ pos: V(), vel: V(), heading: 0, dead: false, down: null, hearts: 3, maxHearts: 3, hurts: [], hurt(d) { this.hurts.push(d); }, knockDown() {} });

/** A guardian on its body in a plain ring (flat floor at 0), a still traveller `d` m before it. */
async function ring(def, model, d = 7) {
  const P = fakePlayer();
  const rt = { def: { id: `fair-${def.name}` }, root: new THREE.Group(), logic: { resolved: false }, physics: { groundAt: () => 0 }, player: P, notice() {}, rumble() {} };
  rt.root.add(model.group);
  await model.ready;
  const g = new Guardian(rt, { def, model, arena: { center: V(), r: 30, y: 0 } });
  model.pos.set(0, 0, 0); model.heading = 0; g.enter('fight'); g.cool = 99;
  P.pos.set(0, 0, d);
  let t = 0;
  const run = (s) => { for (let i = 0; i < s / DT; i++) g.update(DT, (t += DT)); };
  run(0.5);
  return { m: model, g, P, rt, run };
}

test('every guardian: a combo’s blows 1.4 s apart at least, and every blow on its body or drawn where it lands', () => {
  for (const G of GUARDIANS) {
    for (const [id, a] of Object.entries(G.def.attacks)) {
      if (a.then) {
        const next = G.def.attacks[a.then], s = (a.gap ?? 0.25) + windOf(next);
        assert.ok(s >= 1.4 - 1e-9, `${G.id}.${id} → ${a.then}: the next blow ${s.toFixed(2)} s after (≥ 1.4)`);
      }
      // (only a lob lands on the floor where its marks are drawn; everything else lands with the body or its blast)
      if (!a.lob) assert.ok(a.parts || a.blast, `${G.id}.${id}: lands with its body (parts) or with what it draws (blast)`);
    }
  }
});

test('the warden and the Elder: longer breaths, and an opening after every move in every phase', () => {
  for (const [D, pauses] of [[WARDEN, [2.2, 1.9, 1.7]], [ELDER, [2.2, 1.9, 1.7]]]) {
    assert.deepEqual(D.phases.filter((p) => !p.weary).map((p) => p.pause), pauses, `${D.name}: its pauses`);
    for (const [id, a] of Object.entries(D.attacks)) {
      assert.ok(a.then || a.open > 0, `${D.name}.${id}: it opens after it`);
      assert.ok(a.damage <= 0.75, `${D.name}.${id}: ${a.damage} of a heart at most`);
    }
    // (every move of every phase reaches an opening: a lone move's own, a combo's at its end)
    for (const p of D.phases.filter((x) => !x.weary)) for (const id of p.attacks) {
      let a = D.attacks[id], n = 0;
      while (a.then && n++ < 6) a = D.attacks[a.then];
      assert.ok(a.open > 0, `${D.name}: ${id} ends open`);
    }
  }
  // the Elder aloft dives in her last phase instead of pecking from the air (a peck there could only land on the floor 8 m off)
  assert.ok(!ELDER.phases[2].attacks.includes('peck') && ELDER.phases[2].attacks.includes('dive'));
});

test('a beam lands where it is drawn: down through the traveller it was aimed at, not a stride beside him', () => {
  const root = new THREE.Group(), mat = new THREE.MeshBasicMaterial(), B = new Blast(root, mat);
  const g = { arena: { y: 0 }, attackH: 0, model: { pos: V(), radius: 3 } }, a = { id: 'beam', range: 28, blast: { kind: 'beam', r: 0.75 } };
  B.aim(g, a, V(0, 8, 1), V(0, 0, 10)); B.set(0);
  assert.ok(B.touches(V(0, 0, 10)), 'the traveller it was aimed at');
  assert.ok(!B.touches(V(2.2, 0, 10)), 'a stride to the side: clear');
  assert.ok(!B.touches(V(0, 0, 20)), 'behind him, the beam is in the floor');
  B.draw(true);
  assert.ok(B.beam.visible && Math.abs(B.beam.scale.y - B.B.L) < 1e-9, 'drawn the length it hits');
  // a sweep crosses the fan over its window
  const s = { id: 'sweep', side: 1, range: 24, blast: { kind: 'beam', r: 0.75, sweep: 0.9 } };
  B.aim(g, s, V(0, 8, 1), V(0, 0, 10));
  const first = (x) => { for (let k = 0; k <= 1.0001; k += 0.01) { B.set(k); if (B.touches(V(x, 0, 8))) return k; } return null; };
  const [l, c, r] = [-5, 0, 5].map(first);
  assert.ok(l !== null && c !== null && r !== null && l < c && c < r, `from one side to the other (${l}, ${c}, ${r})`);
  assert.ok(segmentGap(V(0, 0, 0), V(0, 0, 10), V(1, 0, 5), V(1, 3, 5)) === 1);
  B.dispose();
});

test('a front runs out from its body and lands as it passes; a low one is jumped, and it lands where its bands are drawn', () => {
  const root = new THREE.Group(), B = new Blast(root, new THREE.MeshBasicMaterial());
  const g = { arena: { y: 0 }, attackH: 0, attackAt: V(), model: { pos: V(), radius: 3 } };
  const a = { id: 'stomp', shape: 'ring', at: 'self', radius: 6, blast: { kind: 'front', r0: 1, h: 0.6 } };
  B.aim(g, a, V(), null);
  const at = V(4, 0, 0), when = [];
  for (let k = 0; k <= 1.0001; k += 0.05) { B.set(k); if (B.touches(at)) when.push(+k.toFixed(2)); }
  assert.ok(when.length && when[0] > 0.4 && when.at(-1) < 0.8, `it reaches 4 m out as it passes there (${when})`);
  B.set((4 - 1) / 5);
  assert.ok(!B.touches(V(4, 0.9, 0)), 'jumped over (0.6 m high)');
  assert.ok(!B.touches(V(1.5, 0, 0)), 'already past him');
  B.draw(true);
  const p = B.front.geometry.attributes.position, v = V();
  let near = 0;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.y > -1 && Math.abs(Math.hypot(v.x, v.z) - B.B.r) < 1e-6) near++; }
  assert.ok(near >= 2 * (B.n + 1), `its band drawn on the front (${near} vertices)`);
  // a gale's lane: a wall of wind across its width, along its heading
  const gale = { id: 'gale', shape: 'lane', range: 18, width: 4.5, blast: { kind: 'front', r0: 2, h: 2.6 } };
  B.aim(g, gale, V(), null); B.set((9 - 2) / 16);
  assert.ok(B.touches(V(1.5, 0, 9)) && !B.touches(V(3.5, 0, 9)) && !B.touches(V(0, 0, 13)), 'across its width, where it has come to');
  B.dispose();
});

test('the warden: its beam out of its eye down to you, its stomp a shock round its feet, the lock on its vent, every mesh shadowing', async () => {
  const { m, g, P, run } = await ring(WARDEN, sentinelModel(), 10);
  P.hurts.length = 0;
  g.begin(P, null, 'beam');
  run(windOf(WARDEN.attacks.beam) + 0.05);
  assert.ok(g.live?.blast && g.blast.B.kind === 'beam', 'a beam, live');
  assert.ok(g.blast.B.o.distanceTo(g.partAt('eye', V())) < 1.5, `out of its eye (${g.blast.B.o.toArray().map((x) => x.toFixed(1))} vs ${g.partAt('eye', V()).toArray().map((x) => x.toFixed(1))})`);
  assert.ok(P.hurts.length === 1, 'down onto the traveller it aimed at');
  const shapes = guardianHitboxes(g, []);
  assert.ok(shapes.some((s) => s.tag === 'guardian.beam.beam'), 'the overlay draws it');
  // a traveller 3 m to the side of the beam's line is not caught
  g.stop(); run(0.5); P.pos.set(3.5, 0, 10); P.hurts.length = 0;
  g.begin(P, null, 'beam');
  for (let i = 0; i < (windOf(WARDEN.attacks.beam) * 0.7) / DT; i++) g.update(DT, 50 + i * DT);
  P.pos.set(6.5, 0, 10);   // (it stopped aiming: he stepped aside)
  run(1);
  assert.equal(P.hurts.length, 0, 'stepped out of its line once it stopped aiming: clear');
  const L = guardianLock(g);
  assert.ok(L.aim.distanceTo(m.mouth) < 1e-6, 'the lock on its vent');
  const meshes = []; m.group.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
  assert.ok(meshes.every((o) => !selfLitSkips(o)), `every drawn mesh shadows (${meshes.filter(selfLitSkips).map((o) => o.name).join(', ')})`);
  g.dispose();
});

test('the Elder: her skin faces the way she fights, her beak comes down at you, she is inked as the world is', async () => {
  const model = elderGuardian();
  const { m, g, P, run } = await ring(ELDER, model, 6);
  assert.ok(m.generated, 'on her skin');
  // (a heading past a quarter turn: the skin faced π − heading, away from the fight, issue #319)
  for (const h of [0, 2.4, Math.PI, -2.4]) {
    m.heading = h; g.stop(); g.enter('fight'); run(0.2);
    const f = m.group.getWorldDirection(V());
    // (she turns to the traveller as she fights: her heading now, whatever it is, is the way her skin faces)
    const d = Math.atan2(f.x, f.z) - m.heading;
    assert.ok(Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < 0.05, `faces her heading from ${h.toFixed(2)}`);
  }
  m.heading = 0; P.pos.set(0, 0, 3.6); P.hurts.length = 0; g.stop(); g.enter('fight'); run(0.3);
  g.begin(P, null, 'peck');
  let low = Infinity, ahead = 0;
  for (let i = 0; i < (windOf(ELDER.attacks.peck) + 0.35) / DT && g.attack?.id === 'peck'; i++) {
    m.heading = 0; g.update(DT, 30 + i * DT);
    if (g.struck) { low = Math.min(low, m.mouth.y); ahead = Math.max(ahead, m.mouth.z); }
  }
  assert.ok(low < COLUMN.h && ahead > 2, `her beak comes down ahead of her (${low.toFixed(2)} m up, ${ahead.toFixed(2)} m out)`);
  assert.equal(P.hurts.length, 1, 'onto the traveller there');
  for (const s of m.inner.meshes) assert.ok(s.userData.inkLine === undefined && s.userData.inkTint === undefined, 'the world’s ink weight and black');
  assert.ok(guardianLock(g).aim.distanceTo(m.mouth) < 1e-6, 'the lock on her beak');
  g.dispose();
});

test('the Keeper on its skin faces its heading past a quarter turn too', async () => {
  const { KEEPER } = await import('../src/temples/desert.js');
  const { m, g, run } = await ring(KEEPER, keeperGuardian());
  m.heading = Math.PI; run(0.2);
  const f = m.group.getWorldDirection(V());
  const d = Math.atan2(f.x, f.z) - m.heading;
  assert.ok(Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < 0.05, 'faces its heading');
  // (1.5 m: v1.71, issue #321, it turns its head to the traveller behind it as it steps round, its neck lagging the turn)
  assert.ok((m.mouth.x - m.pos.x) * Math.sin(m.heading) + (m.mouth.z - m.pos.z) * Math.cos(m.heading) > 1.5, 'its mouth ahead of it');
  g.dispose();
});

test('a guardian that swims in the air has a shadow on the floor under it, smaller the higher it hangs', async () => {
  const { m, g, run } = await ring({ ...GUARDIANS.find((x) => x.id === 'arzach2').def }, whaleModel());
  run(0.2);
  const [body] = g.ground.spots;
  assert.ok(g.ground.group.visible && body.visible, 'a patch under her');
  assert.ok(Math.abs(body.position.y - g.arena.y) < 0.1 && Math.hypot(body.position.x - m.pos.x, body.position.z - m.pos.z) < 2, 'on the floor, under her');
  const s0 = body.scale.x;
  m.hover = 12; run(0.3);
  assert.ok(body.scale.x < s0, 'smaller as she rises');
  assert.ok(MOTHER_GASP.open > 1 && MOTHER_GASP.bell < 1, 'her last phase: a gasp, worth a little of a ring');
  g.dispose();
});

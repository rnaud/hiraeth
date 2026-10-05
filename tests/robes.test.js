import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

// "Still have the bugs where people's robes are flying through them until I get close." Up close a
// cape is simulated every frame and lies on its wearer; further off it was simulated every 2nd or
// 3rd frame, and lived only 1/30 s of each update, all at the end of it: the body walked on at full
// speed through slow-motion cloth (it streamed out behind, the legs and the body went through it,
// and between updates it stood still in the air while they walked on). The crowd's figures drew a
// slim cone of a cape their arms came out through, and the robe under a cape showed through it.

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { Cape, resetDrapes } = await import('../src/cape.js');
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');
const { Humanoid, segmentGirths, CAPSULES } = await import('../src/humanoid.js');
const { SkinnedLod } = await import('../src/skinned-lod.js');
const { parseBody } = await import('../src/makehuman/body.js');
const { personTemplate, MakeHumanPeople } = await import('../src/makehuman/people.js');
const { buildCharacter } = await import('../src/player.js');
const { CROWD_GLSL, CROWD_CAPE, CROWD_JOINTS, crowdCapeHalfWidth } = await import('../src/crowd-shader.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const bin = readFileSync(new URL('../public/anim/mh/body.bin', import.meta.url));
const data = parseBody(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

/** A body walking at 1.25 m/s: trunk, shoulders, legs swinging (knees folding) and arms swinging, as capsules. */
function walker() {
  const scene = new THREE.Scene(), root = new THREE.Object3D(), anchor = new THREE.Object3D();
  anchor.position.y = 0.75; root.add(anchor); scene.add(root); root.updateMatrixWorld(true);
  const cape = new Cape(scene, anchor, { cols: 10, rows: 8, length: 1.25, bottom: 0.46 });
  const caps = Array.from({ length: 9 }, () => ({ a: V(), b: V(), r: 0.1 }));
  const pose = (t) => {
    root.position.set(0, 0, 1.25 * t); root.updateMatrixWorld(true);
    const L = (x, y, z) => V(x, y, z).applyMatrix4(root.matrixWorld);
    const ph = t * Math.PI * 2 * 0.9, sw = 0.5 * Math.sin(ph);
    const set = (k, a, b, r) => { caps[k].a.copy(a); caps[k].b.copy(b); caps[k].r = r; };
    set(0, L(0, 0.95, 0), L(0, 1.35, 0), 0.2); set(1, L(0, 1.35, 0), L(0, 1.5, 0), 0.17); set(2, L(-0.17, 1.42, 0), L(0.17, 1.42, 0), 0.12);
    for (const [i, s] of [[0, 1], [1, -1]]) {
      const a = sw * s, knee = L(0.1 * s, 0.95 - 0.45 * Math.cos(a), 0.45 * Math.sin(a)), kneeA = a - Math.max(0, Math.cos(ph) * s) * 0.6;
      set(3 + i * 2, L(0.1 * s, 0.95, 0), knee, 0.12);
      set(4 + i * 2, knee, L(0.1 * s, 0.95 - 0.45 * Math.cos(a) - 0.42 * Math.cos(kneeA), 0.45 * Math.sin(a) + 0.42 * Math.sin(kneeA)), 0.1);
      const b = -0.35 * Math.sin(ph) * s;
      set(7 + i, L(0.2 * s, 1.42, 0), L(0.2 * s, 1.42 - 0.55 * Math.cos(b), 0.55 * Math.sin(b)), 0.07);
    }
  };
  return { root, cape, caps, pose };
}
/** The cloth as drawn (its mesh's matrix too): how much of it is inside the body, how far the hem is behind (m, in the body's frame). */
function measure(W) {
  const c = W.cape, v = V(), seg = new THREE.Line3(), q = V(), toBody = new THREE.Matrix4().copy(W.root.matrixWorld).invert();
  c.mesh.updateMatrixWorld(true);
  let inside = 0, deep = 0, n = 0, hem = 0;
  for (let i = c.cols * 3; i < c.p.length; i += 3) {
    v.set(c.p[i], c.p[i + 1], c.p[i + 2]).applyMatrix4(c.mesh.matrixWorld);
    let best = Infinity;
    for (const k of W.caps) { seg.set(k.a, k.b); seg.closestPointToPoint(v, true, q); best = Math.min(best, q.distanceTo(v) - k.r); }
    n++; if (best < -0.02) inside++; deep = Math.max(deep, -best);
    if (i >= (c.rows - 1) * c.cols * 3) hem += v.applyMatrix4(toBody).z / c.cols;
  }
  return { inside: inside / n, deep, hem };
}
/** Walk for 6 s at `fps`, the cloth updated every `every` frames (carried along between, from 2 on, as people further off are). */
function walk(fps, every) {
  resetDrapes();
  const W = walker();
  W.pose(0);
  W.cape.bake({ up: UP, vel: V(), wind: V(), floor: V(), capsules: W.caps }, { force: true });
  let acc = 0, k = 0, inside = 0, deep = 0, hem = 0;
  for (let f = 0, t = 0; t < 6; f++, t += 1 / fps) {
    W.pose(t);
    acc += 1 / fps;
    if (f % every === 0) {
      W.cape.update(Math.min(acc, every > 1 ? 0.1 : 1 / 20), { up: UP, vel: V(0, 0, 1.25), wind: V(), floor: V(W.root.position.x, 0, W.root.position.z), capsules: W.caps, carry: every > 1 ? 1 : 0 });
      acc = 0;
    } else W.cape.follow();
    if (t > 2) { const m = measure(W); inside += m.inside; deep = Math.max(deep, m.deep); hem += m.hem; k++; }
  }
  return { inside: inside / k, deep, hem: hem / k };
}

test('a cape simulated every 2nd or 3rd frame hangs as it does every frame: it neither streams out behind nor lets the legs through', () => {
  const ref = walk(60, 1);
  for (const [fps, every] of [[60, 3], [30, 2], [30, 3]]) {
    const r = walk(fps, every);
    const say = `${fps} fps, every ${every}: hem ${r.hem.toFixed(3)} m (every frame ${ref.hem.toFixed(3)}), ${(r.inside * 100).toFixed(1)} % inside, ${r.deep.toFixed(3)} m deep`;
    assert.ok(Math.abs(r.hem - ref.hem) < 0.04, `hangs as near: ${say} (it streamed 7-15 cm further back)`);
    assert.ok(r.inside < 0.01, `nothing of the body through it: ${say} (8 % at 30 fps)`);
    assert.ok(r.deep < 0.1, `nor deep in it: ${say}`);
  }
});

test('between two updates the cloth goes along with the body (it stood in the air while they walked on)', () => {
  resetDrapes();
  const W = walker();
  W.pose(0);
  const s = { up: UP, vel: V(0, 0, 1.25), wind: V(), floor: V(), capsules: W.caps, carry: 1 };
  W.cape.bake(s, { force: true });
  W.cape.update(1 / 30, s);
  W.cape.mesh.updateMatrixWorld(true);
  const before = V(W.cape.p[60], W.cape.p[61], W.cape.p[62]).applyMatrix4(W.cape.mesh.matrixWorld);
  W.pose(0.1);   // 12.5 cm on
  W.cape.follow();
  W.cape.mesh.updateMatrixWorld(true);
  const after = V(W.cape.p[60], W.cape.p[61], W.cape.p[62]).applyMatrix4(W.cape.mesh.matrixWorld);
  assert.ok(Math.abs(after.z - before.z - 0.125) < 1e-3, `moved with the body: ${(after.z - before.z).toFixed(3)} m`);
  // the next update starts from where the cloth was drawn (no jump back), and the mesh is back where its points say
  W.cape.update(1 / 30, s);
  assert.ok(W.cape.mesh.position.lengthSq() === 0 && W.cape.mesh.quaternion.w === 1, 'the matrix back to none');
  const next = V(W.cape.p[60], W.cape.p[61], W.cape.p[62]);
  assert.ok(next.distanceTo(after) < 0.05, `no jump back: ${next.distanceTo(after).toFixed(3)} m`);
  // hung, follow() leaves it alone (the anchor carries it)
  W.cape.hang();
  W.cape.follow();
  assert.equal(W.cape.mesh.position.lengthSq(), 0);
});

test('a villager walking 40 m off (cloth every 3rd frame) wears the cape as one walking by you does', () => {
  const run = (dist, fps) => {
    resetDrapes();
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2)));
    scene.updateMatrixWorld(true);
    const npc = new NPC(scene, new Physics(scene), { route: [V(0, 0, 0), V(0, 0, 60)], cape: 1.2, lines: ['…'], world: 'desert' });
    const player = { pos: V(-150, 0, 0), vel: V(), riding: false, ride: null, wind: V() };   // (far: nobody stops to greet)
    const camera = new THREE.PerspectiveCamera();
    let hem = 0, k = 0, moved = 0;
    for (let f = 0; f < 8 * fps; f++) {
      camera.position.set(npc.pos.x - dist, 2, npc.pos.z);
      npc.update(1 / fps, player, camera);
      if (npc.cape.mesh.position.lengthSq() > 0) moved++;
      if (f > 3 * fps && npc.vel.length() > 0.5) {
        npc.object.updateMatrixWorld(true);
        const c = npc.cape, toBody = new THREE.Matrix4().copy(npc.object.matrixWorld).invert(), p = V();
        c.mesh.updateMatrixWorld(true);
        for (let i = (c.rows - 1) * c.cols * 3; i < c.p.length; i += 3) hem += p.set(c.p[i], c.p[i + 1], c.p[i + 2]).applyMatrix4(c.mesh.matrixWorld).applyMatrix4(toBody).z / c.cols;
        k++;
      }
    }
    return { hem: hem / Math.max(k, 1), k, moved, hung: npc.cape.hung };
  };
  // (up close at 60 fps, as on a computer; 40 m off at 30 fps, as on a handheld: a cloth update every 0.1 s)
  const near = run(6, 60), far = run(40, 30);
  console.log(`  the hem behind the body: up close ${near.hem.toFixed(3)} m, 40 m off ${far.hem.toFixed(3)} m`);
  assert.ok(near.k > 30 && far.k > 30, `they walked (${near.k}, ${far.k} frames)`);
  assert.equal(far.hung, false, 'still simulated at 40 m');
  assert.ok(far.moved > 100, `carried along between its updates (${far.moved} frames)`);
  assert.equal(near.moved, 0, 'up close: every frame, nothing to carry');
  assert.ok(Math.abs(far.hem - near.hem) < 0.05, `the hem as far behind as up close: ${far.hem.toFixed(3)} against ${near.hem.toFixed(3)} m`);
});

test('a cape lies over the robe under it: the robe has colliders round the legs, following them, and none seated', () => {
  const h = new Humanoid(personTemplate(data, { kind: 'm', world: 'desert' }), buildCharacter(), 'm');
  h.char.root.updateMatrixWorld(true);
  const plain = h.capsules().length;
  assert.equal(plain, CAPSULES.length);
  h.dress({ head: 'none', mask: 'none', body: 'none', prop: 'none', robe: 0.12, flare: 0.36, kind: 'm' });
  h.char.root.updateMatrixWorld(true);
  const caps = h.capsules();
  assert.equal(caps.length, plain + 2, 'a cone round each leg');
  for (const c of caps.slice(plain)) {
    assert.ok(c.rb > c.r, 'widening to the hem');
    assert.ok(c.a.y > 0.85 && c.a.y < 1.15, `from the belt (${c.a.y.toFixed(2)} m)`);
    assert.ok(Math.abs(c.b.y - 0.12) < 0.08, `to the hem (${c.b.y.toFixed(2)} m)`);
    assert.ok(Math.abs(c.rb - 0.3) < 0.04, `as wide as the robe there (${c.rb.toFixed(2)} m)`);
  }
  // the legs forward, seated: no cone (the cloth falls behind the robe on the lap, not round it like wings)
  for (const s of ['l', 'r']) h.char.legs[s === 'l' ? 0 : 1].rotation.set(-1.5, 0, 0);
  h.update(); h.char.root.updateMatrixWorld(true);
  assert.ok(h.capsules().slice(plain).every((c) => c.r === 0 && c.rb === 0), 'none seated');
  // undressed: back to the body's own
  h.dress({ head: 'none', mask: 'none', body: 'none', prop: 'none', robe: 0, kind: 'm' });
  assert.equal(h.capsules().length, plain);
});

test('a MakeHuman villager in a robe and a cape: the cloth stays out of the robe, near and as its drape', async () => {
  const { loadAssets } = await import('./gait-sim.js');
  resetDrapes();
  const { lib } = await loadAssets();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2)));
  scene.updateMatrixWorld(true);
  const people = new MakeHumanPeople(data, 'desert');
  const def = { id: 'test.robed', name: 'Robed', kind: 'm', cape: 1.25, palette: {}, look: { robe: 0.12, flare: 0.4, body: 'none' } };
  const npc = new NPC(scene, new Physics(scene), { route: [V()], def, kind: 'm', cape: 1.25, look: def.look, world: 'desert', lines: ['…'], lib, human: people.humans()[0] });
  assert.ok(npc.humanoid._robeLook, 'in a robe');
  assert.match(npc.drapeKey(), /robe0\.12\/0\.40/, 'its drape is a robed body\'s, not shared with the unrobed');
  npc.heading = 0;
  const player = { pos: V(0, 0, 6), vel: V(), riding: false, ride: null, wind: V() };
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.6, 5);
  for (let f = 0; f < 240; f++) npc.update(1 / 60, player, camera);
  const inRobe = () => {
    const caps = npc.humanoid.capsules(), cones = caps.slice(npc.humanoid._spec.length), c = npc.cape;
    const m = c.hung ? c.mesh.matrixWorld : new THREE.Matrix4(), p = V(), ab = V(), q = V();
    c.mesh.updateMatrixWorld(true);
    let worst = 0;
    for (let i = c.cols * 3; i < c.p.length; i += 3) {
      p.set(c.p[i], c.p[i + 1], c.p[i + 2]).applyMatrix4(m);
      for (const k of cones) {
        ab.subVectors(k.b, k.a);
        const t = q.subVectors(p, k.a).dot(ab) / ab.lengthSq();
        if (t <= 0 || t >= 1) continue;
        worst = Math.max(worst, k.r + (k.rb - k.r) * t - p.distanceTo(q.copy(k.a).addScaledVector(ab, t)));
      }
    }
    return worst;
  };
  assert.ok(inRobe() < 0.02, `simulated: no cloth inside the robe (${inRobe().toFixed(3)} m)`);
  // far off: its drape, baked over the robe
  camera.position.set(0, 1.6, 200); player.pos.set(0, 0, 200);
  for (let f = 0; f < 90; f++) npc.update(1 / 60, player, camera);
  assert.ok(npc.cape.hung);
  assert.ok(inRobe() < 0.02, `hung: no cloth inside the robe (${inRobe().toFixed(3)} m)`);
});

test('the crowd\'s capes are the full people\'s: as wide, over the shoulders and arms, the arms and the robe under the cloth', async () => {
  // a MakeHuman villager's baked drape, row by row, against the figures' cape (crowdCapeHalfWidth: the shader's)
  const { loadAssets } = await import('./gait-sim.js');
  resetDrapes();
  const { lib } = await loadAssets();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2)));
  scene.updateMatrixWorld(true);
  const people = new MakeHumanPeople(data, 'desert');
  for (const len of [0.9, 1.25, 1.45]) {
    resetDrapes();
    const def = { id: `test.cape${len}`, name: 'Caped', kind: 'm', cape: len, palette: {}, look: { robe: 0, body: 'none', build: 'average' } };
    const npc = new NPC(scene, new Physics(scene), { route: [V()], def, kind: 'm', cape: len, look: def.look, world: 'desert', lines: ['…'], lib, human: people.humans()[0] });
    npc.heading = 0;
    const player = { pos: V(0, 0, 200), vel: V(), riding: false, ride: null, wind: V() };
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.6, 200);
    for (let f = 0; f < 60; f++) npc.update(1 / 60, player, camera);
    const c = npc.cape;
    assert.ok(c.drape, 'baked');
    c.anchor.updateWorldMatrix(true, false);
    const toBody = new THREE.Matrix4().copy(npc.object.matrixWorld).invert().multiply(c.anchor.matrixWorld);
    const wide = (npc.look.capeWide ?? 1);
    for (let r = 2; r < c.rows; r++) {
      let half = 0;
      for (let k = 0; k < c.cols; k++) { const i = (r * c.cols + k) * 3; half = Math.max(half, Math.abs(V(c.drape[i], c.drape[i + 1], c.drape[i + 2]).applyMatrix4(toBody).x)); }
      const t = r / (c.rows - 1), fig = crowdCapeHalfWidth(t, c.local[1] - c.local[(c.rows - 1) * c.cols * 3 + 1], wide);
      assert.ok(Math.abs(fig - half) < 0.1, `a ${len} m cape, ${(t * 100).toFixed(0)} % down: the figure's ${fig.toFixed(2)} m wide, the cloth ${half.toFixed(2)} m (the figure's was a slim cone)`);
    }
    npc.dispose?.(scene);
  }
  // over the shoulders, the hanging arms are under the cloth (the figure's arm is 4.2 cm round)
  assert.ok(CROWD_CAPE.shoulders > CROWD_JOINTS.shoulderX + 0.042 + 0.03);
  // and the shader pushes the cloth out over the swinging and gesturing arms, and over the robe
  assert.match(CROWD_GLSL, /the arms under it/);
  assert.match(CROWD_GLSL, /crowdRobeTurn\(hip, dir\.x, tr\)/);
  assert.match(CROWD_GLSL, new RegExp(`\\* ${CROWD_CAPE.stream.toFixed(3)} \\* amp`), 'walking, it barely streams out behind (0.28 m: like a flag)');
});

test('a body far off drawing a simpler level of itself keeps its own girths for the cloth', () => {
  const h = new Humanoid(personTemplate(data, { kind: 'm', build: 'heavy', world: 'desert' }), buildCharacter(), 'm');
  h.char.root.updateMatrixWorld(true);
  const full = h.capsules().map((c) => c.r);
  const ref = segmentGirths(h.body);
  h.lod = new SkinnedLod(h, { sync: true });
  h.lod.update(120, 1, 400, 2);   // far: a coarse level
  assert.notEqual(h.body.geometry, h.lod.entries.find((e) => e.mesh === h.body).full, 'drawing a simpler level');
  h._caps = null;   // (measured again, now)
  const far = h.capsules().map((c) => c.r);
  far.forEach((r, i) => assert.ok(Math.abs(r - full[i]) < 1e-9, `${CAPSULES[i][0]}: ${r.toFixed(3)} as up close ${full[i].toFixed(3)}`));
  assert.deepEqual(segmentGirths(h.body, 0.9, h.fullBody()), ref);
});

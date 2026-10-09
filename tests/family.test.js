// The traveller's family as their selected designs draw them (src/characters/family.js, family-pieces.js;
// references/levels/Home/characters): each one's look (colours, hair, the outfit's parts), the same look in every
// scene they appear in (home, the Lantern, home again, the recordings, the studio), their costumes on both
// body families, and Moustache's legs on the locomotion kit (src/dog.js; scripts/motion-audit).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };
const { FAMILY, FAMILY_LOOKS, FAMILY_REFERENCES, DOG_LOOK, familyLook } = await import('../src/characters/family.js');
const { namedLook, SHINS } = await import('../src/costumes.js');
const { questPieces } = await import('../src/characters/quest-pieces.js');
const { PEOPLE: HOME } = await import('../src/story/home-data.js');
const { PEOPLE: LANTERN, ILEN_HOME } = await import('../src/story/lantern-data.js');
const { PEOPLE: HOLO } = await import('../src/ship/hologram.js');
const { castOf } = await import('../src/studio/people.js');
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');
const { parseBody } = await import('../src/makehuman/body.js');
const { MakeHumanPeople } = await import('../src/makehuman/people.js');
const { loadAssets } = await import('./gait-sim.js');
const { Dog, DOG } = await import('../src/dog.js');
const { dogSubject } = await import('../scripts/motion-audit/walk.mjs');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const hsl = (hex) => new THREE.Color(hex).getHSL({}, THREE.SRGBColorSpace);   // (as written: sRGB hex)
const IDS = ['father', 'mother', 'lou', 'ilen', 'tove'];

test('each of them has a selected reference image, and nothing else of theirs is drawn from the old sheets', () => {
  for (const id of [...IDS, 'moustache']) assert.ok(existsSync(new URL(`../${FAMILY_REFERENCES[id]}`, import.meta.url)), `${id}: ${FAMILY_REFERENCES[id]}`);
  const batch = JSON.parse(readFileSync(new URL('../references/batches/2026-10-09-selected-family-currency-ship-sword.json', import.meta.url), 'utf8'));
  for (const id of [...IDS, 'moustache']) {
    const [, , , , folder, file] = FAMILY_REFERENCES[id].split('/');
    assert.ok(batch.assets.some((a) => a.folder === `levels/Home/characters/${folder}` && a.file === file), `${id}: the user's selection`);
  }
});

test('their looks: the colours, the hair and the age of each selected design', () => {
  const L = FAMILY_LOOKS;
  // the father: a faded slate-blue coat over a rust vest, charcoal trousers, brown boots, short grey hair, clean-shaven
  assert.ok(hsl(L.father.cloth).h > 0.55 && hsl(L.father.cloth).h < 0.65, 'slate-blue coat');
  assert.ok(hsl(L.father.vest).h < 0.06 && hsl(L.father.vest).s > 0.4, 'rust vest');
  assert.ok(hsl(L.father.hair).s < 0.1 && hsl(L.father.hair).l > 0.65, 'grey hair');
  assert.equal(L.father.head, 'short'); assert.equal(L.father.mask, 'none');
  assert.ok(L.father.robe > 0.25 && L.father.robe < 0.45 && L.father.robeOpen > 0.3, 'a coat to the knee, open down the front');
  assert.equal(L.father.tool, 'flightCap', 'his old flight cap in his hand');
  // the mother: cream tunic, slate trousers, a long teal scarf lined in coral, silver hair in a low bun, the recorder
  assert.ok(hsl(L.mother.cloth).l > 0.8, 'cream tunic');
  assert.ok(hsl(L.mother.scarf).h > 0.45 && hsl(L.mother.scarf).h < 0.55, 'teal scarf');
  assert.ok(hsl(L.mother.lining).h < 0.06, 'coral lining');
  assert.equal(L.mother.head, 'bun'); assert.ok(hsl(L.mother.hair).s < 0.12 && hsl(L.mother.hair).l > 0.65, 'silver hair');
  assert.ok(L.mother.recorder, 'her voice recorder');
  // Lou: golden-yellow tunic, coral pockets, rust-red trousers, tan boots, chestnut bunches, a drawing in her hand
  assert.ok(hsl(L.lou.cloth).h > 0.09 && hsl(L.lou.cloth).h < 0.13 && hsl(L.lou.cloth).s > 0.6, 'golden-yellow tunic');
  assert.ok(hsl(L.lou.pockets).h < 0.05, 'coral pockets');
  assert.ok(hsl(L.lou.legs).h < 0.04 && hsl(L.lou.legs).s > 0.5, 'rust-red trousers');
  assert.ok(L.lou.bunches && hsl(L.lou.hair).h < 0.06, 'chestnut hair in two bunches');
  assert.equal(L.lou.tool, 'drawing');
  // Ilen: a teal wrap coat lined in coral over a cream shirt, charcoal trousers, tall boots, dark hair in a low bun
  assert.ok(hsl(L.ilen.cloth).h > 0.45 && hsl(L.ilen.cloth).h < 0.55, 'teal coat');
  assert.ok(hsl(L.ilen.robeLining).h < 0.06 && L.ilen.robeOpen > 0.3 && L.ilen.robe < 0.25, 'long, open, lined in coral');
  assert.equal(L.ilen.shins, 'boots'); assert.equal(L.ilen.head, 'bun');
  assert.ok(hsl(L.ilen.hair).l < 0.3, 'dark hair');
  // Aunt Tove: sturdy, a lavender shawl, a dusty-blue tunic under a pale apron, indigo trousers, silver bun
  assert.equal(L.tove.build, 'heavy');
  assert.ok(hsl(L.tove.shawl).h > 0.75 && hsl(L.tove.shawl).h < 0.85, 'lavender shawl');
  assert.ok(hsl(L.tove.cloak).h > 0.55 && hsl(L.tove.cloak).h < 0.65, 'dusty-blue tunic');
  assert.ok(L.tove.robePanels.length === 1 && L.tove.robePanels[0].role === 'accent', 'the apron over its skirt');
  assert.equal(L.tove.head, 'bun');
  // ages and bodies
  assert.ok(FAMILY.father.years >= 70 && FAMILY.mother.years >= 70 && FAMILY.tove.years >= 60, 'the old are old');
  assert.equal(FAMILY.ilen.years, 50); assert.equal(FAMILY.lou.age, 'child'); assert.equal(FAMILY.lou.years, 7.5);
  for (const id of IDS) for (const k of ['boot', 'skin', 'eyes']) assert.match(L[id][k], /^#[0-9a-f]{6}$/, `${id}.${k}`);
  for (const id of IDS) assert.ok(SHINS[L[id].shins], `${id}: their boots (${L[id].shins})`);
});

test('every scene they appear in wears the same look: home, the Lantern, home again, the recordings, the studio', async () => {
  for (const id of ['lou', 'tove']) {
    for (const k of ['palette', 'look', 'head', 'kind', 'years', 'scale']) assert.deepEqual(HOME[id][k], FAMILY[id][k], `home's ${id}.${k}`);
    assert.ok(HOME[id].talk && HOME[id].lines, `${id} keeps her words`);
  }
  assert.deepEqual(HOME.lou.morph, FAMILY.lou.morph); assert.deepEqual(HOME.lou.face, FAMILY.lou.face);
  for (const def of [LANTERN.ilen, ILEN_HOME]) for (const k of ['palette', 'look', 'head', 'kind', 'years']) assert.deepEqual(def[k], FAMILY.ilen[k], `Ilen's ${k}`);
  for (const id of ['father', 'mother']) assert.equal(HOLO[id].def, FAMILY[id], `the recordings' ${id}`);
  for (const [world, id] of [['home', 'lou'], ['home', 'tove'], ['home', 'ilen'], ['lantern', 'ilen'], ['home', 'father'], ['home', 'mother']]) {
    const s = namedLook({ world, id, palette: FAMILY[id].palette, look: FAMILY[id].look, kind: FAMILY[id].body ?? FAMILY[id].kind });
    assert.equal(s.reference, `family/${id}`, `${world}/${id}`);
    assert.equal(s.cloth, FAMILY_LOOKS[id].cloth); assert.equal(s.hair, FAMILY_LOOKS[id].hair); assert.equal(s.head, FAMILY_LOOKS[id].head);
    assert.equal(s.mask, 'none', `${id}: no beard drawn by chance`);
  }
  assert.equal(familyLook('desert', 'lou'), null, 'nobody else named Lou wears it');
  assert.equal(namedLook({ world: 'home', id: 'holo-child' }).reference, undefined, 'the child on the reel keeps his own');
  assert.deepEqual((await castOf('home')).map((p) => p.id), ['lou', 'tove', 'father', 'mother', 'ilen']);
  assert.deepEqual((await castOf('lantern')).map((p) => p.id), ['ilen']);
});

const bin = readFileSync(new URL('../public/anim/mh/body.bin', import.meta.url));
const data = parseBody(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const EXPECT = {
  father: (L) => [L.vest, L.shirt, L.collar, L.accent],
  mother: (L) => [L.scarf, L.lining, L.recorder],
  lou: (L) => [L.collar, L.pockets],
  ilen: (L) => [L.shirt, L.lapel, L.belt, L.pouch],
  tove: (L) => [L.cloak, L.apron, L.shawl],
};

test('their costumes on both body families: every part there, skinned to the trunk, following it as it bends', async () => {
  const { lib, human } = await loadAssets();
  const mh = new MakeHumanPeople(data, 'home');
  for (const family of ['makehuman', 'quaternius']) for (const id of IDS) {
    const def = HOME[id] ?? (id === 'ilen' ? LANTERN.ilen : FAMILY[id]), kind = def.body ?? def.kind;
    const template = family === 'makehuman' ? mh.templateFor({ kind, def }) : human[kind];
    const scene = new THREE.Scene();
    const npc = new NPC(scene, new Physics(scene), { world: 'home', def, kind, lines: ['…'], route: [V()], lib, human: template, palette: def.palette, head: def.head, look: def.look, scale: def.scale });
    const h = npc.humanoid, L = FAMILY_LOOKS[id];
    assert.equal(npc.look.reference, `family/${id}`);
    // the parts: each of the design's colours is a piece on the body
    const pieces = questPieces(npc.look, { head: [], chest: [], hand: [], back: [] }, h);
    const roles = pieces.skinned.map((p) => p.role);
    for (const c of EXPECT[id](L)) assert.ok(roles.includes(c), `${family}/${id}: a piece in ${c}`);
    if (L.tool) assert.ok(pieces.hand?.length > 0, `${family}/${id}: ${L.tool} in the hand`);
    if (L.bunches) assert.ok(pieces.head.length >= 2, 'Lou’s bunches');
    // every vertex skinned to the trunk (spine, pelvis, neck), weights normalised, all finite
    const bones = h.body.skeleton.bones;
    let vertices = 0;
    for (const p of pieces.skinned) {
      const P = p.geo.attributes.position, { J, W } = p.joints.arrays();
      vertices += P.count;
      for (let i = 0; i < P.count; i++) {
        assert.ok(Number.isFinite(P.getX(i) + P.getY(i) + P.getZ(i)));
        assert.ok(Math.abs(W[i * 4] + W[i * 4 + 1] + W[i * 4 + 2] + W[i * 4 + 3] - 1) < 1e-4, `${family}/${id}: normalised`);
        const top = [0, 1, 2, 3].reduce((a, k) => (W[i * 4 + k] > W[i * 4 + a] ? k : a), 0);
        assert.match(bones[J[i * 4 + top]].name, /spine|pelvis|neck/i, `${family}/${id}: on the trunk`);
      }
    }
    assert.ok(vertices < 40000, `${family}/${id}: a bounded budget (${vertices})`);
    // the whole costume: finite, normalised, wearable bounds
    for (const mesh of h._costume) {
      const g = mesh.geometry, P = g.attributes.position, W = g.attributes.skinWeight;
      for (let i = 0; i < P.count; i += 7) assert.ok(Math.abs(W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i) - 1) < 1e-4);
      g.computeBoundingBox(); assert.ok(g.boundingBox.getSize(V()).length() < 5);
    }
    // a piece on the chest follows the chest as the spine bends
    const mesh = h._costume.find((m) => m.geometry.attributes.position.count > 100);
    const g = mesh.geometry, J = g.attributes.skinIndex, Wt = g.attributes.skinWeight, s3 = bones.indexOf(h.b.spine_03);
    const i = Array.from({ length: J.count }, (_, k) => k).find((k) => J.getX(k) === s3 && Wt.getX(k) > 0.5);
    if (i !== undefined) {
      npc.object.updateMatrixWorld(true);
      const before = mesh.applyBoneTransform(i, V().fromBufferAttribute(g.attributes.position, i));
      h.b.spine_03.rotation.x += 0.4; npc.object.updateMatrixWorld(true);
      const after = mesh.applyBoneTransform(i, V().fromBufferAttribute(g.attributes.position, i));
      assert.ok(before.distanceTo(after) > 0.01, `${family}/${id}: follows the spine`);
    }
    npc.cape?.dispose(scene);
  }
});

test('the open coats leave a gap down the front lined in their own colour; the apron lies over the skirt', async () => {
  const { lib } = await loadAssets();
  const mh = new MakeHumanPeople(data, 'home');
  for (const id of ['father', 'ilen', 'tove']) {
    const def = id === 'ilen' ? LANTERN.ilen : FAMILY[id] === FAMILY.tove ? HOME.tove : FAMILY[id], kind = def.kind;
    const scene = new THREE.Scene();
    const npc = new NPC(scene, new Physics(scene), { world: 'home', def, kind, lines: ['…'], route: [V()], lib, human: mh.templateFor({ kind, def }), palette: def.palette, head: def.head, look: def.look, scale: def.scale });
    const h = npc.humanoid, L = FAMILY_LOOKS[id];
    const parts = h.robeGeometry(L.robe, L.flare, { open: L.robeOpen ?? 0, lining: L.robeLining, role: L.robeRole, hem: L.robeHem, panels: L.robePanels ?? [] });
    const front = (g) => { let n = 0; const P = g.attributes.position; for (let k = 0; k < P.count; k++) if (Math.abs(P.getX(k)) < 0.03 && P.getZ(k) > 0) n++; return n; };
    if (L.robeOpen) {
      assert.equal(front(parts[0].geo), 0, `${id}: nothing across the front`);
      assert.ok(parts.some((p) => p.role === L.robeLining), `${id}: lined`);
      // the lining just inside the coat, row by row, never out through it
      const outer = parts[0].geo.attributes.position, lining = parts.find((p) => p.role === L.robeLining).geo.attributes.position;
      let worst = -1;
      for (let k = 0; k < lining.count; k++) {
        let best = Infinity, r0 = 0;
        for (let j = 0; j < outer.count; j++) { const d = Math.abs(outer.getY(j) - lining.getY(k)) + Math.abs(Math.atan2(outer.getX(j), outer.getZ(j)) - Math.atan2(lining.getX(k), lining.getZ(k))); if (d < best) { best = d; r0 = Math.hypot(outer.getX(j), outer.getZ(j)); } }
        if (best < 0.01) worst = Math.max(worst, Math.hypot(lining.getX(k), lining.getZ(k)) - r0);
      }
      assert.ok(worst < 0, `${id}: the lining stays inside (${worst.toFixed(4)})`);
    } else {
      const apron = parts.find((p) => p.role === 'accent' && p !== parts[1]);
      assert.ok(apron && front(apron.geo) > 0, 'Tove’s apron down her front');
    }
    npc.cape?.dispose(scene);
  }
});

test('the robe without the family’s options is exactly as before (every other robed person)', async () => {
  const { lib, human } = await loadAssets();
  const scene = new THREE.Scene();
  const npc = new NPC(scene, new Physics(scene), { world: 'arzach', kind: 'm', lines: ['…'], route: [V()], lib, human: human.m });
  const parts = npc.humanoid.robeGeometry(0.3, 0.3);
  assert.equal(parts.length, 2);
  assert.deepEqual(parts.map((p) => p.role), ['cloth', 'accent']);
  // (six rows evenly from the belt to the hem band, 19 columns round: as the robe always was)
  assert.equal(parts[0].geo.attributes.position.count, 6 * 19);
  assert.equal(parts[1].geo.attributes.position.count, 2 * 19);
});

test('Moustache on the locomotion kit: four jointed legs, feet planted, diagonal pairs, the cadence by his pace', () => {
  const walk = dogSubject(1.6), half = dogSubject(1.6, 0.5), hurry = dogSubject(4.2);
  for (const [r, name] of [[walk, 'walking'], [half, 'half pace'], [hurry, 'hurrying']]) {
    assert.equal(r.legsN, 4);
    assert.ok(r.slidePerMetre < 0.05, `${name}: feet stay planted (${r.slidePerMetre.toFixed(3)} m/m)`);
    assert.ok(r.worstSlide < 0.06, `${name}: no contact slides (${r.worstSlide.toFixed(3)} m)`);
    assert.ok(r.reachShare > 0.15, `${name}: the knees and hocks bend (reach span ${(r.reachShare * 100).toFixed(0)} % of the leg)`);
    assert.ok(r.liftShare > 0.06, `${name}: the feet lift (${(r.liftShare * 100).toFixed(0)} %)`);
    const pairs = r.groups.map((g) => [...g].sort().join(',')).sort();
    assert.deepEqual(pairs, ['0,3', '1,2'], `${name}: a trot on diagonal pairs`);
  }
  assert.ok(half.cadence < walk.cadence * 0.75 && hurry.cadence > walk.cadence * 1.4, `the rhythm follows the pace (${half.cadence.toFixed(2)} / ${walk.cadence.toFixed(2)} / ${hurry.cadence.toFixed(2)} steps/s)`);
});

test('Moustache sits (the hind feet step in, the rump goes down), lies down, sniffs and wags', () => {
  const dog = new Dog(null, { at: V() });
  const dt = 1 / 60, run = (s, f) => { for (let t = 0; t < s; t += dt) f(); };
  dog.state = 'follow'; dog.sitPose.reset(0); dog.sitK = 0;
  run(1, () => dog.pose(dt, false, false));
  const stand = { rump: dog.tailRoot.getWorldPosition(V()).y, hind: dog.rig.footOf(2).z, head: dog.head.getWorldPosition(V()).y };
  run(3, () => { dog.state = 'sit'; dog.pose(dt, true, false); });
  dog.object.updateMatrixWorld(true);
  const sat = { rump: dog.tailRoot.getWorldPosition(V()).y, hind: dog.rig.footOf(2).z };
  assert.ok(sat.rump < stand.rump - 0.15, `the rump goes down (${stand.rump.toFixed(2)} → ${sat.rump.toFixed(2)})`);
  assert.ok(sat.hind > stand.hind + 0.1, `the hind feet stepped in under him (${stand.hind.toFixed(2)} → ${sat.hind.toFixed(2)})`);
  // the tail sweeps: its first link swings side to side while he is happy
  const swings = [];
  dog.wag = 1; run(1, () => { dog.state = 'petted'; dog.wag = 1; dog.pose(dt, true, false); swings.push(dog.tail[0].rotation.z); });
  assert.ok(Math.max(...swings) - Math.min(...swings) > 0.5, 'he wags');
  run(4, () => { dog.state = 'lie'; dog.pose(dt, false, true); });
  dog.object.updateMatrixWorld(true);
  assert.ok(dog.body.position.y < -DOG.lie.drop * 0.8, `lying down (${dog.body.position.y.toFixed(2)})`);
  // sniffing: the nose goes down
  const sniffer = new Dog(null, { at: V() });
  run(1, () => { sniffer.state = 'follow'; sniffer.pose(dt, false, false); });
  sniffer.object.updateMatrixWorld(true);
  const up = sniffer.head.getWorldPosition(V()).y;
  run(1.5, () => { sniffer.state = 'sniff'; sniffer.pose(dt, false, false); });
  sniffer.object.updateMatrixWorld(true);
  assert.ok(sniffer.head.getWorldPosition(V()).y < up - 0.05, 'his nose goes down to sniff');
  // his colours: sandy, the white moustache and brows (references/levels/Home/characters/Moustache)
  assert.ok(hsl(DOG_LOOK.fur).h > 0.07 && hsl(DOG_LOOK.fur).h < 0.11 && hsl(DOG_LOOK.white).l > 0.9);
});

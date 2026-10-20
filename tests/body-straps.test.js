import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

// Issue #552: straps worn across the chest lie on the body, from the shoulder to the hip. Marrow's bag strap
// was a straight board from his right shoulder down to the bag at his left hip, standing 9 cm off his chest,
// and the reference costumes' sash a straight rod from the shoulder down past the hip to beside the left hand:
// both read as a bar from the shoulder to the hand. Measured on the MakeHuman bodies as they walk.
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };

const { BODIES, lookPieces } = await import('../src/costumes.js');
const { QUEST_LOOKS } = await import('../src/characters/quest-looks.js');
const { questPieces } = await import('../src/characters/quest-pieces.js');
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');
const { parseBody } = await import('../src/makehuman/body.js');
const { MakeHumanPeople } = await import('../src/makehuman/people.js');
const { castOf } = await import('../src/studio/people.js');
const { loadAssets } = await import('./gait-sim.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const bin = readFileSync(new URL('../public/anim/mh/body.bin', import.meta.url));
const data = parseBody(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const SASH_KITS = ['sash', 'mechanic', 'rigger', 'cable', 'ladder', 'climbing', 'sphereLamp', 'rope', 'reeds', 'wickBag', 'parcel'];
const wearers = [['desert', 'marrow']];
for (const [world, designs] of Object.entries(QUEST_LOOKS)) for (const [id, d] of Object.entries(designs)) if (SASH_KITS.includes(d.kit)) wearers.push([world, id]);

/** Points along a piece's triangle edges, 2 cm apart (a box's corners alone say nothing of its middle). */
function along(geo) {
  const P = geo.attributes.position, idx = geo.index ? geo.index.array : [...Array(P.count).keys()], out = [];
  for (let t = 0; t + 2 < idx.length; t += 3) for (const [i, j] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
    const a = V().fromBufferAttribute(P, i), b = V().fromBufferAttribute(P, j), n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.02));
    for (let k = 0; k < n; k++) out.push(a.clone().lerp(b, k / n));
  }
  return out;
}

/** A person as the game builds them (a MakeHuman body), the straps among their chest pieces (chest frame). */
async function person(world, id, assets) {
  const def = (await castOf(world)).find((p) => p.id === id);
  assert.ok(def, `${world}/${id}`);
  const kind = def.body ?? def.kind ?? 'm', scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2))); scene.updateMatrixWorld(true);
  const npc = new NPC(scene, new Physics(scene), { world, def, kind, lines: ['…'], route: [V(0, 0, 0), V(0, 0, 30)], lib: assets.lib, human: new MakeHumanPeople(data, world).template(kind), palette: def.palette, head: def.head, look: def.look, scale: def.scale });
  const h = npc.humanoid, look = npc.look;
  const pieces = questPieces(look, h.profile?.lookPieces ? h.profile.lookPieces(look, h) : lookPieces(look, 1), h);
  return { npc, h, straps: pieces.chest.filter((pc) => pc.strap) };
}

test('every strap across the chest is a strap: tagged, and bending round the body, not a straight bar', () => {
  const marrow = BODIES.scavbag(1).filter((pc) => pc.strap);
  assert.equal(marrow.length, 1, 'Marrow’s bag strap');
  const g = marrow[0].geo, P = g.attributes.position;
  // a straight bar's points all lie on one line; a strap over the shoulder and down the back is far from any
  const a = V().fromBufferAttribute(P, 0), b = V().fromBufferAttribute(P, P.count - 1), line = new THREE.Line3(a, b);
  let off = 0;
  for (let i = 0; i < P.count; i++) off = Math.max(off, line.closestPointToPoint(V().fromBufferAttribute(P, i), true, V()).distanceTo(V().fromBufferAttribute(P, i)));
  assert.ok(off > 0.12, `it bends round the body (${off.toFixed(3)} m off the line between its ends)`);
  assert.ok(wearers.length >= 12, `the sash wearers found (${wearers.length})`);
});

test('straps lie on the body and stop at the hip: none stands off the chest or runs down past the hip to where the hands hang', async () => {
  const assets = await loadAssets(), player = { pos: V(0, 0, -40), vel: V(), riding: false, ride: null, wind: V() }, camera = new THREE.PerspectiveCamera();
  const rc = new THREE.Raycaster();
  for (const [world, id] of wearers) {
    const { npc, h, straps } = await person(world, id, assets);
    assert.ok(straps.length >= 1, `${world}/${id} wears a strap`);
    const B = h.b, body = h.body, si = body.skeleton.bones.indexOf(B.spine_03), tunic = npc.look.reference && (npc.look.robe > 0 || npc.look.bulk >= 2);
    let low = Infinity, wide = 0, stand = 0, inside = 0;
    const seen = new Set();   // (one ray per 2 cm of strap)
    for (let f = 0; f < 150; f++) {
      npc.update(1 / 60, player, camera);
      if (f % 30 !== 29) continue;
      h.char.root.updateMatrixWorld(true);
      // the chest frame as posed: the strap's points where they are drawn, and the body measured in it
      const toWorld = new THREE.Matrix4().multiplyMatrices(B.spine_03.matrixWorld, body.skeleton.boneInverses[si]).multiply(h.chestFrame()), toChest = toWorld.clone().invert();
      for (const { geo } of straps) {
        for (const c of along(geo)) {
          const w = c.clone().applyMatrix4(toWorld);
          low = Math.min(low, c.y); wide = Math.max(wide, Math.abs(c.x));
          // in front, across the chest: how far it stands off the body's own surface there (a tunic's wearers: over it)
          if (tunic || f !== 149 || c.z < 0.03 || Math.abs(c.x) > 0.11 || c.y < 0.42 || c.y > 0.66) continue;   // (below, it goes into a bag)
          const key = `${Math.round(c.x / 0.02)},${Math.round(c.y / 0.02)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const o = V(c.x, c.y, 1).applyMatrix4(toWorld);
          rc.set(o, w.clone().sub(o).normalize());
          const hit = rc.intersectObject(body, false)[0];
          if (!hit) continue;
          const d = c.z - hit.point.applyMatrix4(toChest).z;
          stand = Math.max(stand, d); inside = Math.min(inside, d);
        }
      }
    }
    const who = `${world}/${id}`;
    if (process.env.STRAPS) console.log(who, { low, wide, stand, inside, tunic });
    assert.ok(low > 0.2, `${who}: no lower than the hip (${low.toFixed(3)} m in the chest frame)`);
    assert.ok(wide < (tunic ? 0.26 : 0.23), `${who}: within the body's width, inside the arms (${wide.toFixed(3)})`);
    if (!tunic) {
      assert.ok(stand < 0.05, `${who}: lies on the chest (stands ${stand.toFixed(3)} m off it)`);
      assert.ok(inside > -0.01, `${who}: not sunk into it (${inside.toFixed(3)})`);
    }
    npc.cape?.dispose?.(npc.scene);
  }
});

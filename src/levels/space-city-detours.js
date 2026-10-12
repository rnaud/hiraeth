import * as THREE from 'three';
import { crownTree } from './space-city-kit.js';
import { STACK, TIERS } from './space-city-ways.js';
import { mulberry32 } from '../noise.js';
import { bar } from '../lorn-kit.js';

// ---------------------------------------------------------------------------
// The City Floating in Space's detours (level design audit v1.59, issue #233): the city's optional places all lay on the
// way (16 of 19 within 30 m of it). Four places off it, each a thing to look at with one line (src/story/spacecity.js,
// DETOURS in src/story/spacecity-people.js):
//   the Pier's end       a brass telescope at the far rail of the Pier, behind the ship, turned out at the dark
//   the Garden's pot     a sapling still in its carrying pot by the Garden's benches, its tag for the Balcony
//   the high lanes       up the stack past the capstan quarter, a coil of old cable on a stand in the tier's square
//   the washing tier     higher, a bench in its square under the washing, the whole city below
// Built into the islands' and the stack's own kits with dice of their own, so nothing else moves. Each is
// { id, name, stand, look } for the story and a sight for the audit.
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SOLID = { solid: true, shadow: true }, NC = { solid: false, shadow: false };

/** Where they stand: the Pier's south rail, the Garden's plaza by its benches, the middle of two tiers of the stack. */
export const DETOURS = {
  telescope: { x: -5, z: 145, island: 'pier' },
  sapling: { x: -103, z: -67.5, island: 'garden' },
  coil: { tier: 's4', a: 0.6 },
  bench: { tier: 's5', a: 5.7 },   // (facing out past the stairs' landings, where the tier is open)
};

/** Builds the four into `decks` (the islands' kits) and the stack's tiers (`ways.tiers`): { sights, detours }. */
export function buildDetours(decks, ways, ISLANDS) {
  const rng = mulberry32(72330), out = { sights: [], detours: [] };
  const put = (id, name, stand, look) => { out.detours.push({ id, name, stand, look }); out.sights.push({ name, at: [stand.x, stand.y, stand.z] }); };

  // the Pier's end: a brass telescope on a tripod at the rail, aimed out past the ship at the dark
  {
    const { kit, M } = decks.pier, T = DETOURS.telescope, y = ISLANDS.pier.y, brass = kit.mat({ color: '#c08a44', flat: true, metal: true, line: 0.6 });
    const head = V(T.x, y + 1.45, T.z);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.4; kit.add(M.iron, bar(V(T.x + Math.cos(a) * 0.55, y, T.z + Math.sin(a) * 0.55), head, 0.04, 5), SOLID); }
    // (the tube tipped up a little, its eyepiece toward the ship)
    const tube = new THREE.CylinderGeometry(0.11, 0.17, 1.5, 10).rotateX(Math.PI / 2 - 0.22).translate(T.x, y + 1.55, T.z + 0.15);
    kit.add(brass, tube, NC);
    kit.add(brass, new THREE.CylinderGeometry(0.19, 0.19, 0.12, 10).rotateX(Math.PI / 2 - 0.22).translate(T.x, y + 1.72, T.z + 0.85), NC);
    kit.add(M.iron, new THREE.SphereGeometry(0.12, 8, 6).translate(head.x, head.y, head.z), NC);
    put('telescope', 'the telescope at the Pier’s end', V(T.x, y, T.z - 1.6), V(T.x, y + 1.7, T.z + 3));
  }
  // the Garden: a sapling in its carrying pot by the benches, a tag tied on
  {
    const { kit, M } = decks.garden, T = DETOURS.sapling, y = ISLANDS.garden.y;
    kit.add(M.pot, new THREE.CylinderGeometry(0.55, 0.4, 0.75, 12).translate(T.x, y + 0.37, T.z), SOLID);
    // (the carrying pole across its rim, tied to it both sides)
    kit.add(M.wood, new THREE.CylinderGeometry(0.045, 0.045, 1.9, 6).rotateZ(Math.PI / 2).translate(T.x, y + 0.82, T.z), NC);
    for (const e of [-1, 1]) kit.add(M.cable, new THREE.TorusGeometry(0.07, 0.02, 4, 8).rotateY(Math.PI / 2).translate(T.x + e * 0.52, y + 0.78, T.z), NC);
    crownTree(kit, M, rng, T.x, y + 0.7, T.z, 0.75, { trunk: 1.1, detail: 0.75 });
    kit.add(M.pale, new THREE.BoxGeometry(0.16, 0.22, 0.02).translate(T.x + 0.08, y + 1.15, T.z + 0.13), NC);   // (the tag)
    put('sapling', 'the sapling in its pot', V(T.x + 1.4, y, T.z + 1.2), V(T.x, y + 1.1, T.z));
  }
  // the stack's high lanes and its washing tier: a coil of old cable on a stand, a bench under the washing
  const onTier = (D, d = 1.2) => { const t = TIERS[D.tier], tier = ways.tiers[D.tier]; return { t, kit: tier.kit, M: tier.M, at: V(STACK.x + Math.cos(D.a) * d, t.y, STACK.z + Math.sin(D.a) * d) }; };
  {
    const { t, kit, M, at } = onTier(DETOURS.coil), bronze = kit.mat({ color: '#c08a44', flat: true, metal: true, line: 0.6 });
    kit.add(M.wood, new THREE.BoxGeometry(0.9, 0.8, 0.9).translate(at.x, t.y + 0.4, at.z), SOLID);
    for (let k = 0; k < 4; k++) kit.add(M.cable, new THREE.TorusGeometry(0.34 - k * 0.02, 0.06, 5, 18).rotateX(Math.PI / 2).translate(at.x, t.y + 0.86 + k * 0.1, at.z), NC);
    // (its end, frayed: a few strands splayed out of a bronze ferrule over the edge)
    kit.add(bronze, new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8).rotateZ(Math.PI / 2).translate(at.x + 0.42, t.y + 1.2, at.z), NC);
    for (let k = 0; k < 5; k++) { const a = -0.5 + k * 0.25; kit.add(M.cable, new THREE.CylinderGeometry(0.012, 0.012, 0.3, 3).rotateZ(Math.PI / 2 + a).translate(at.x + 0.62, t.y + 1.2 + Math.sin(a) * 0.12, at.z + (k - 2) * 0.03), NC); }
    const out1 = V(Math.cos(DETOURS.coil.a), 0, Math.sin(DETOURS.coil.a));
    put('coil', 'the old cable on the high lanes', at.clone().addScaledVector(out1, 1.6), at.clone().setY(t.y + 1.1));
  }
  {
    const { t, kit, M, at } = onTier(DETOURS.bench, -0.6), a = DETOURS.bench.a, yaw = Math.atan2(Math.cos(a), Math.sin(a));
    const seat = new THREE.BoxGeometry(2.0, 0.1, 0.5).rotateY(yaw).translate(at.x, t.y + 0.48, at.z);
    kit.add(M.wood, seat, SOLID);
    for (const e of [-1, 1]) { const s = V(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(e * 0.8); kit.add(M.iron, new THREE.BoxGeometry(0.1, 0.44, 0.44).rotateY(yaw).translate(at.x + s.x, t.y + 0.22, at.z + s.z), SOLID); }
    const back = V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(-0.22);
    kit.add(M.wood, new THREE.BoxGeometry(2.0, 0.42, 0.08).rotateY(yaw).translate(at.x + back.x, t.y + 0.8, at.z + back.z), SOLID);
    const out1 = V(Math.cos(a), 0, Math.sin(a));
    put('bench', 'the bench on the washing tier', at.clone().addScaledVector(out1, 1.2), at.clone().addScaledVector(out1, 30).setY(t.y - 30));
  }
  return out;
}

// The crucible walker (issue #800, family D): the cart's approved redesign as its body (Tripo, src/enemies/plans/cart-tripo.js
// on public/enemies/cart/, loaded by src/enemies/foe-assets.js; the welding cart on its tracks, plans/tracked.js
// legacyCartModel, kept and standing in while the mesh loads). It keeps the cart's id, def, attacks and windows, skins and
// dress, armour, eye and death; its rig is a machine's (rigid parts on the kit's four legs, blended across the cuts).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { legacyCartModel } from '../src/enemies/plans/tracked.js';
import { tripoCartModel, CART_PARTS, CART_HOME } from '../src/enemies/plans/cart-tripo.js';
import { foeSource, FOE_ASSETS } from '../src/enemies/foe-assets.js';
import { PLANS } from '../src/motion-kit/plans.js';
import { FOE_MOVES, moveKey } from '../src/foe-sounds.js';
import { ARMOUR } from '../src/enemies/fight.js';

const SRC = foeSource('cart');
const world = () => new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(0, 0, 40), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
const skinned = (g) => { let s = null; g.traverse((o) => { if (o.isSkinnedMesh) s = o; }); return s; };

test('the cart is the crucible walker: its Tripo body by default, the welding cart kept as legacyCartModel', () => {
  assert.ok(FOE_ASSETS.cart && SRC, 'its asset is read at once in node');
  const M = archetypeModel('cart', 'garage');
  assert.equal(M.body3d, 'tripo');
  assert.match(M.group.name, /crucible walker \(Tripo\)/);
  M.dispose();
  const L = legacyCartModel(skinOf('cart', 'garage'));
  assert.ok(L.group.getObjectByName('turret') && L.group.getObjectByName('track left'), 'the old tracked cart still builds');
  L.dispose();
  assert.equal(ARCHETYPES.cart.plan, 'crucible'); assert.ok(PLANS.crucible && PLANS.tracked, 'its own plan, the old one kept');
  assert.ok(FOE_MOVES.crucible && moveKey({ archetype: 'cart', kind: 'cart', def: FOES.cart }) === 'crucible', 'its steps, its plan\'s');
});

test('it keeps the cart\'s fight: the def, both attacks and their windows, the jam, the douse, the trail, its armour', () => {
  const D = FOES.cart;
  assert.deepEqual(D.attacks.map((a) => a.id), ['pour', 'ram']);
  const pour = D.attacks[0], ram = D.attacks[1];
  assert.deepEqual([pour.wind, pour.strike, pour.contact, pour.range, pour.leaveLife], [1.2, 0.6, 0.4, 4.6, 4]);
  assert.deepEqual([ram.wind, ram.strike, ram.contact, ram.reverse, ram.stall, ram.lunge], [1.3, 0.9, 0.05, 1.2, 1.8, 10]);
  assert.ok(D.tracks && D.jams === 5 && D.douse === 4 && D.trail);
  assert.deepEqual([D.hp, D.radius, D.height, D.speed], [6, 1.1, 1.0, 2.0]);
  assert.equal(ARMOUR.cart.plates, 2);
});

test('every skin builds the contract on the one mesh: its palette, its dress, its plates, the eye, a weak point', () => {
  for (const w of Object.keys(SKINS.cart)) {
    const M = tripoCartModel(skinOf('cart', w), SRC);
    for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'tell', 'anim', 'dispose', 'gaze', 'weak']) assert.ok(M[k], `${w}: ${k}`);
    assert.equal(M.plates.length, 2, `${w}: two flank plates`);
    assert.ok(M.tell('pour') && M.tell('ram'), `${w}: a striking part for each attack`);
    let meshes = 0; M.group.traverseVisible((o) => { if (o.isMesh) meshes++; });
    assert.ok(meshes <= 12, `${w}: ${meshes} meshes drawn (the old cart's up to 17)`);
    const top = new THREE.Box3().setFromObject(M.group).max.y;
    assert.ok(top > 1.9 && top < 2.7, `${w}: ${top.toFixed(2)} m to its top (the rim 2 m, the torches over it)`);
    const sm = skinned(M.group), C = sm.geometry.attributes.color;
    if (w === 'garage') { const b = (x) => Math.round(x * 255).toString(16).padStart(2, '0'), hex = new Set(); for (let i = 0; i < C.count; i += 97) hex.add(`#${b(C.getX(i))}${b(C.getY(i))}${b(C.getZ(i))}`); assert.ok(hex.has(CART_HOME.body), `its home skin in the reference's sage (${[...hex].slice(0, 6)})`); }
    M.dispose();
  }
  const props = (w) => { const M = tripoCartModel(skinOf('cart', w), SRC); const n = skinned(M.group).geometry.attributes.position.count; const t = M.group.getObjectByName('torch arm'); M.dispose(); return { n, torch: !!t }; };
  assert.ok(props('garage').torch && !props('buried').torch, 'the Hangar\'s torch arms');
  assert.ok(props('buried').n > props('moonfoundry').n, 'the Buried Machine\'s iron hoops');
  assert.ok(props('overnighttrain').n > props('moonfoundry').n, 'the luggage strapped on');
});

test('the Tripo machine rig: 10–15k triangles, every vertex on its part\'s bone (blended only across a cut), an exact bind, a joint moves only its parts', () => {
  assert.ok(SRC.triangles >= 10000 && SRC.triangles <= 15000, `${SRC.triangles} triangles`);
  assert.deepEqual(SRC.rig.partNames, CART_PARTS);
  const M = tripoCartModel(skinOf('cart', 'garage'), SRC), sm = skinned(M.group), W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex;
  let blended = 0;
  for (let i = 0; i < W.count; i++) { const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i} weights sum ${s}`); if (W.getX(i) < 0.999) blended++; }
  assert.ok(blended > 0 && blended < W.count * 0.25, `${blended} vertices blended across the cuts`);
  // the bind: each vertex skinned at rest is where it was built
  M.group.updateMatrixWorld(true);
  const p = new THREE.Vector3(), q = new THREE.Vector3(); let worst = 0;
  for (let i = 0; i < W.count; i += 7) { p.fromBufferAttribute(sm.geometry.attributes.position, i); sm.getVertexPosition(i, q); worst = Math.max(worst, p.distanceTo(q)); }
  assert.ok(worst < 1e-4, `bind round trip ${(worst * 1000).toFixed(3)} mm`);
  // a knee bent alone moves only its leg's shin and foot (and the band either side of the knee)
  const shin = sm.skeleton.bones.findIndex((b) => b.name === 'leg0_shin'), own = new Set([shin, sm.skeleton.bones.findIndex((b) => b.name === 'leg0_foot'), sm.skeleton.bones.findIndex((b) => b.name === 'leg0_thigh')]);
  const before = []; for (let i = 0; i < W.count; i++) { sm.getVertexPosition(i, q); before.push(q.clone()); }
  sm.skeleton.bones[shin].rotateX(0.4); M.group.updateMatrixWorld(true);
  for (let i = 0; i < W.count; i++) { sm.getVertexPosition(i, q); if (q.distanceTo(before[i]) > 1e-6) assert.ok([0, 1, 2, 3].some((k) => W.getComponent(i, k) > 0 && own.has(J.getComponent(i, k))), `vertex ${i} moved by the knee is the leg's`); }
  M.dispose();
});

test('in the fight: it stands on its four planted feet, tips its rim for the pour, looks at you, and comes apart rigid', () => {
  clearTargets();
  const foes = world();
  const f = foes.add('cart@garage', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  for (let i = 0; i < 60; i++) foes.look(f, 1 / 30);
  const pot = f.model.body, rest = pot.rotation.x;
  const pour = f.def.attacks.find((a) => a.id === 'pour');
  f.atk = pour; f.state = 'wind';
  for (let i = 0; i <= 30; i++) { f.k = i / 30 * 0.8; foes.look(f, pour.wind / 30); }
  assert.ok(pot.rotation.x - rest > 0.2, `the pot tips its rim toward you (${(pot.rotation.x - rest).toFixed(2)} rad)`);
  f.atk = null; f.state = 'idle'; f.k = 0;
  // the eye unit slides round the pot toward the traveller, on either side
  const head = f.model.cartJoints.head, yaw = () => new THREE.Euler().setFromQuaternion(head.children[0].getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
  for (const [x, sign] of [[-6, -1], [6, 1]]) {
    foes.player.pos.set(x, 0, 3);
    for (let i = 0; i < 90; i++) { f.dist = 6; foes.look(f, 1 / 30); }
    assert.ok(Math.sign(yaw()) === sign && Math.abs(yaw()) > 0.4, `the traveller at x ${x}: its eye unit turned ${yaw().toFixed(2)} rad toward him`);
  }
  foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
  for (let i = 0; i < 40; i++) foes.update(1 / 30);
  assert.ok(f.dying, 'down');
  const sm = skinned(f.model.group) ?? (() => { let s = null; foes.group?.traverse((o) => { if (o.isSkinnedMesh && o.name === 'tripo skin') s = o; }); return s; })();
  const w = sm.geometry.attributes.skinWeight; let soft = 0; for (let i = 0; i < w.count; i++) if (w.getX(i) < 1) soft++;
  assert.equal(soft, 0, 'rigid as it comes apart (no stretched cuts)');
  foes.dispose(); clearTargets();
});

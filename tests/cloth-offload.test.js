// The game's traveller's (B3, src/characters/traveller.js) overshirt done by an engine (src/characters/tripo-cloth.js CLOTH_HOST, engine/cloth.js):
// the packet the module sends a frame, stepped and mapped apart, gives the garment the module gives it itself.
import test from 'node:test';
import assert from 'node:assert/strict';
const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { buildCharacter } = await import('../src/player.js');
const { createTraveller } = await import('../src/characters/traveller.js');
const { travellerB3 } = await import('./gait-sim.js');
const { CLOTH_HOST } = await import('../src/characters/tripo-cloth.js');
const { clothState, clothFrame, packClothDesc, unpackClothDesc, CLOTH_PIN_NORMALS, CLOTH_NO_DETAIL_COLLISIONS } = await import('../engine/cloth.js');
const assets = await travellerB3();

function traveller(offload) {
  const char = buildCharacter();
  char.root.position.set(12, 3, -40); char.root.rotation.y = 0.7;
  CLOTH_HOST.offload = offload;
  try { return { char, ch: createTraveller(char, assets) }; } finally { CLOTH_HOST.offload = null; }   // (as engine/game.js makes him)
}

// B3's fit (traveller-b3.js) keeps his pinned vertices' own skinned normals (preservePinNormals) and pushes no free vertex
// out of the leg capsules (detailCollisions: false): the description carries both, and map.pin, to the engines.
test('the overshirt done apart (engine/cloth.js) is the overshirt the module does itself, frame after frame', () => {
  const plain = traveller(null), plain2 = traveller(null);   // (two of the module's own: how far two runs of it differ)
  let desc = null, st = null, out = null, nrm = null, frames = 0, back = null, stBack = null, outBack = null, nrmBack = null;
  const off = traveller({
    init(d) { desc = d; st = clothState(d); out = new Float32Array(d.vertices * 3); nrm = new Float32Array(d.vertices * 3); },   // (floats, as the engines hold them)
    frame(p) { clothFrame(desc, st, p, out, nrm); if (back) clothFrame(back, stBack, p, outBack, nrmBack); frames++; },
  });
  assert.ok(desc && desc.N > 100 && desc.map.count > 1000, 'the description, once');
  assert.ok(off.ch.cloth.garment === desc.garment);
  assert.equal(desc.preservePinNormals, true); assert.equal(desc.detailCollisions, false);
  const pinned = Array.from({ length: desc.map.count }, (_, v) => desc.map.pin[v * 4 + 3]).filter((t) => t > 0).length;
  assert.ok(pinned > 500, `pinned vertices with their own normals: ${pinned}`);
  const buf = packClothDesc(desc), u = new Uint32Array(buf, 0, 8);
  assert.deepEqual(Array.from(u), [desc.N, desc.constants.edgeA.length, desc.map.count, desc.vertices, desc.index.length, desc.caps, desc.bones, CLOTH_PIN_NORMALS | CLOTH_NO_DETAIL_COLLISIONS], 'the layout\'s header');
  // (the engines' copy: the buffer read back, as BridgeCloth.cs reads it, run beside: floats where the module has doubles)
  back = unpackClothDesc(buf); stBack = clothState(back); outBack = new Float32Array(desc.vertices * 3); nrmBack = new Float32Array(desc.vertices * 3);
  const near = (x, y, what) => { assert.equal(x.length, y.length, what); for (let i = 0; i < x.length; i++) if (Math.abs(x[i] - y[i]) > 1e-6 * Math.max(1, Math.abs(y[i]))) assert.fail(`${what}[${i}]: ${x[i]} for ${y[i]}`); };
  for (const k of ['local', 'ids', 'weights', 'free', 'outward', 'out', 'base', 'skinB', 'skinW', 'pin']) near(back.map[k], desc.map[k], `map.${k}`);
  for (const k of Object.keys(desc.constants)) near(back.constants[k], desc.constants[k], k);
  near(back.index, desc.index, 'index');
  assert.deepEqual([back.N, back.caps, back.bones, back.vertices, back.preservePinNormals, back.detailCollisions], [desc.N, desc.caps, desc.bones, desc.vertices, true, false]);
  const garmentBefore = off.ch.cloth.garment.geometry.attributes.position.array.slice();
  // the same walk on both: the hips swing, the root travels (a few steps of the cage a frame)
  const pose = (t, { char, ch }) => {
    char.root.position.x += 0.02; char.root.rotation.y += 0.01;
    for (const bone of ch.humanoid.body.skeleton.bones) if (/thigh_l|thigh_r/.test(bone.name)) bone.rotation.x = Math.sin(t * 6) * (bone.name.endsWith('l') ? 0.5 : -0.5);
    char.root.updateMatrixWorld(true);
  };
  for (let i = 0; i < 40; i++) {
    for (const s of [plain, plain2, off]) { pose(i / 60, s); s.ch.updateCloth(1 / 60); }
  }
  assert.equal(frames, 40, 'a packet a frame');
  const a = plain.ch.cloth.garment.geometry.attributes.position.array, a2 = plain2.ch.cloth.garment.geometry.attributes.position.array;
  let max = 0, moved = 0, base = 0;
  for (let i = 0; i < a.length; i++) { max = Math.max(max, Math.abs(a2[i] - out[i])); base = Math.max(base, Math.abs(a[i] - a2[i])); moved = Math.max(moved, Math.abs(a[i] - garmentBefore[i])); }
  assert.ok(moved > 0.01, `the shirt moved (${moved.toFixed(3)} m)`);
  // (two travellers made one after the other already differ by a hair, 2e-5 m: no further apart than that)
  assert.ok(max < 1e-4 && max <= base * 1.5 + 1e-6, `the same garment: ${max} (two of the module's own: ${base})`);
  const na = plain2.ch.cloth.garment.geometry.attributes.normal.array;
  const nb = plain.ch.cloth.garment.geometry.attributes.normal.array;
  const apart = (x, y) => { let c = 0; for (let i = 0; i < x.length; i += 3) if (Math.hypot(x[i] - y[i], x[i + 1] - y[i + 1], x[i + 2] - y[i + 2]) > 1e-3) c++; return c; };
  const nOff = apart(na, nrm), nBase = apart(na, nb);
  assert.ok(nOff <= nBase * 1.5 + 5, `the same normals: ${nOff} apart (two of the module's own: ${nBase})`);
  // the description through its buffer: the same garment, to the floats' rounding
  let maxBack = 0, nBack = 0;
  for (let i = 0; i < out.length; i++) maxBack = Math.max(maxBack, Math.abs(outBack[i] - out[i]));
  for (let i = 0; i < nrm.length; i += 3) if (Math.hypot(nrmBack[i] - nrm[i], nrmBack[i + 1] - nrm[i + 1], nrmBack[i + 2] - nrm[i + 2]) > 1e-2) nBack++;
  assert.ok(maxBack < 1e-3, `the packed description's garment: ${maxBack} m off`);
  assert.ok(nBack <= 5, `the packed description's normals: ${nBack} apart`);
  // and the module left the offloaded garment's own geometry alone (nothing for the mirror to send)
  assert.deepEqual(Array.from(off.ch.cloth.garment.geometry.attributes.position.array), Array.from(garmentBefore));
});

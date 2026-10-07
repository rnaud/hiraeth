import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The overshirt drawn by its vertex shader (src/characters/tripo-cloth.js garmentShader, the game's path):
// the shader's inputs, run through the same sums here (the shader's own steps, written out in JS), put every
// vertex where the main-thread path (tests, a page without WebGL) puts it, frame after frame, the cloth swinging.

const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { parseBody } = await import('../src/makehuman/body.js');
const { createTravellerV1 } = await import('../src/characters/traveller-v1.js');
const { buildCharacter } = await import('../src/player.js');
const { GARMENT_GLSL } = await import('../src/characters/tripo-cloth.js');
const b = readFileSync('public/anim/mh/body.bin'), data = parseBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const dir = 'public/characters/traveller-v1/';
const report = JSON.parse(readFileSync(dir + 'rig.json')), colors = JSON.parse(readFileSync(dir + 'colors.json'));
const g = readFileSync(dir + 'model.glb'), n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
delete json.images; delete json.textures; delete json.materials; for (const m of json.meshes) for (const p of m.primitives) delete p.material;
const load = async () => new GLTFLoader().parseAsync(JSON.stringify(json), '');

/** The vertex shader's sums for vertex v (GARMENT_GLSL and the body garmentShader adds), from the garment's own inputs. */
function shaderVertex(garment, v, out = new T.Vector3()) {
  const geo = garment.geometry, u = garment.material.uniforms, C = geo.attributes.aCage, O = geo.attributes.aOutward;
  const rest = new T.Vector3().fromBufferAttribute(geo.attributes.position, v);
  const free = C.getW(v), cu = C.getY(v), cv = C.getZ(v), i0 = Math.round(C.getX(v)), cols1 = garment.userData.cols1;
  const skinned = garment.applyBoneTransform(v, rest.clone());   // (three's skinning: what the shader's skinning chunk does)
  out.copy(rest).applyMatrix4(u.uGarmentRigid.value).lerp(skinned, 1 - free);
  if (free > 0) {
    const at = (t, i) => new T.Vector3(t.image.data[i * 4], t.image.data[i * 4 + 1], t.image.data[i * 4 + 2]);
    const ids = [i0, i0 + 1, i0 + cols1, i0 + cols1 + 1], w = [(1 - cu) * (1 - cv), cu * (1 - cv), (1 - cu) * cv, cu * cv];
    ids.forEach((i, k) => out.addScaledVector(at(u.uClothP.value, i).sub(at(u.uClothG.value, i)), w[k] * free));
    if (u.uGarmentSim.value > 0.5 && free > 0.95) {
      const o = new T.Vector3().fromBufferAttribute(O, v);
      const d2 = (t, A, B) => { const d = out.clone().addScaledVector(o, t).sub(A); const s = T.MathUtils.clamp(d.dot(B) / B.lengthSq(), 0, 1); return d.addScaledVector(B, -s).lengthSq(); };
      for (let k = 0; k < u.uGarmentCapA.value.length; k++) {
        const A4 = u.uGarmentCapA.value[k], B4 = u.uGarmentCapB.value[k], r = A4.w, A = new T.Vector3(A4.x, A4.y, A4.z), B = new T.Vector3(B4.x, B4.y, B4.z);
        if (r <= 0 || d2(0, A, B) >= r * r) continue;
        let lo = 0, hi = r * 3;
        for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (d2(mid, A, B) < r * r) lo = mid; else hi = mid; }
        out.addScaledVector(o, hi);
      }
    }
  }
  return out;
}

test('the shader puts the overshirt where the main thread did, the cloth swinging and the legs pushing it', async () => {
  const make = async (gpu) => { const char = buildCharacter(); return { char, ...createTravellerV1(char, { gltf: await load(), data, report, colors }, { gpu }) }; };
  const cpu = await make(false), gpu = await make(true);
  assert.equal(gpu.cloth.gpu, true); assert.equal(cpu.cloth.gpu, false);
  assert.ok(gpu.cloth.garment.isSkinnedMesh && gpu.cloth.garment.material.defines.GARMENT, 'skinned, its material patched');
  assert.ok(gpu.cloth.garment.material.vertexShader.includes(GARMENT_GLSL.trim().split('\n')[0]));
  gpu.cloth.garment.userData.cols1 = 33;
  const G = gpu.cloth.garment.geometry, start = G.attributes.position.array.slice();
  // the same walk on both: the hips swing, a thigh lifts, the body turns
  let worst = 0;
  for (let f = 0; f < 40; f++) {
    for (const w of [cpu, gpu]) {
      const B = w.humanoid.b, t = f / 30;
      B.thigh_l.rotation.x = -0.6 * Math.sin(t * 5); B.thigh_r.rotation.x = 0.6 * Math.sin(t * 5); B.spine_01.rotation.y = 0.2 * Math.sin(t * 3);
      w.char.root.position.set(t * 1.4, 0, 0); w.char.root.rotation.y = 0.3 * t;
      w.char.root.updateMatrixWorld(true); w.mesh.skeleton.update();
      w.cloth.update(1 / 30, 'game', true);
    }
    if (f % 8 !== 7) continue;
    gpu.cloth.garment.skeleton.update();
    const P = cpu.cloth.garment.geometry.attributes.position, q = new T.Vector3(), c = new T.Vector3();
    for (let v = 0; v < P.count; v += 7) worst = Math.max(worst, shaderVertex(gpu.cloth.garment, v, q).distanceTo(c.fromBufferAttribute(P, v)));
  }
  assert.ok(worst < 2e-4, `every vertex where it was (worst ${(worst * 1000).toFixed(3)} mm)`);
  // nothing rewritten on the main thread: its own arrays stay the rest shape (the shader moves it)
  assert.deepEqual(G.attributes.position.array, start);
  assert.ok(gpu.cloth.gpuState.P.image.data.some((x) => x !== 0), 'the particles go to the shader');
});

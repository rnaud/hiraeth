// Issue #538: the City-Shaft's banners (life.js BannerSet, one merged mesh with each banner's colour and glyph cells per
// vertex, S_VMAT) drew as dark slabs in Unity. Each frame a banner waves its object-space points move too (aObjP, aObjN),
// so the bridge sends the whole geometry again (backend.js vertices → false, issue #113); geometryOf then made its variant
// without the vertex material, every banner's colour zero, black. The node keeps its vmat now, and the variant sent again
// carries the per-vertex values as the first did; and a player that reads them takes a waving banner's object frames with
// its points in op 8 (flag 8), not the whole geometry a frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { UnityBackend } from '../engine/unity/backend.js';
import { SceneMirror } from '../engine/mirror.js';
import { OP } from '../engine/unity/pack.js';
import { Banner, BannerSet } from '../src/life.js';
import { readFileSync } from 'node:fs';

THREE.ColorManagement.enabled = false;

function host(frames = false) {
  const H = { created: new Map(), materials: new Map(), geometries: [], setMesh: [] };
  if (frames) H.VertexFrames = () => true;
  H.Create = (id, json) => H.created.set(id, JSON.parse(json));
  H.Material = (mid, json) => H.materials.set(mid, JSON.parse(json));
  H.Geometry = (key, buf) => H.geometries.push({ key, flags: new Uint32Array(buf.b ?? buf)[2] });
  H.SetMesh = (id, key) => H.setMesh.push({ id, key });
  H.Frame = (buf) => { const a = buf.buffer ? buf : new Uint32Array(buf); H.last = new Uint32Array(a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength)); };
  return H;
}

const scene2 = () => {
  const scene = new THREE.Scene();
  const banners = [new Banner(null, new THREE.Vector3(5, 10, 0), 0.3, { width: 3, height: 7, color: '#a8c8e0' }),
    new Banner(null, new THREE.Vector3(-5, 10, 2), 1.2, { width: 2, height: 9, color: '#e0a8b8' })];
  const set = new BannerSet(scene, banners);
  return { scene, banners, set };
};

test('a player that reads them: a waved banner\'s object frames go with its points (op 8, flag 8), not the whole geometry', () => {
  const H = host(true), B = new UnityBackend(H);
  const { scene, banners, set } = scene2(), camera = new THREE.PerspectiveCamera();
  const mirror = new SceneMirror(B, { castsShadow: () => true });
  mirror.sync(scene, camera);
  for (const b of banners) b.update(2.3);
  H.geometries.length = 0; H.setMesh.length = 0;
  mirror.sync(scene, camera);
  assert.equal(H.geometries.length, 0, 'no geometry sent again');
  const u = H.last, f = new Float32Array(u.buffer), n = set.geo.attributes.position.count;
  let at = -1;
  for (let i = 0; i + 3 < u.length; i++) if (u[i] === OP.vertices && u[i + 2] === n && (u[i + 3] & 8)) { at = i; break; }
  assert.ok(at >= 0, 'op 8 with the object frames');
  const flags = u[at + 3], base = at + 4 + n * 3 + (flags & 1 ? n * 3 : 0);
  const P = set.geo.attributes.aObjP.array, N = set.geo.attributes.aObjN.array;
  for (const i of [0, 7, n * 3 - 1]) { assert.ok(Math.abs(f[base + i] - P[i]) < 1e-6, `aObjP ${i}`); assert.ok(Math.abs(f[base + n * 3 + i] - N[i]) < 1e-6, `aObjN ${i}`); }
});

test('a waved banner\'s geometry sent again keeps its colours and glyph cells per vertex (the vertex-material variant)', () => {
  const H = host(), B = new UnityBackend(H);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const banners = [new Banner(null, new THREE.Vector3(5, 10, 0), 0.3, { width: 3, height: 7, color: '#a8c8e0' }),
    new Banner(null, new THREE.Vector3(-5, 10, 2), 1.2, { width: 2, height: 9, color: '#e0a8b8' })];
  const set = new BannerSet(scene, banners);
  const mirror = new SceneMirror(B, { castsShadow: () => true });
  mirror.sync(scene, camera);
  const node = [...H.created.entries()].find(([, d]) => d.name === 'Banners');
  assert.ok(node, 'the banners are one drawable');
  assert.match(node[1].mesh, /:v$/, 'drawn with the vertex-material variant');
  assert.equal(H.geometries.find((g) => g.key === node[1].mesh).flags & 128, 128, 'its values per vertex sent');
  // a frame: the banners wave (their points, normals and object frames move): the whole geometry again
  for (const b of banners) b.update(1.7);
  H.geometries.length = 0;
  mirror.sync(scene, camera);
  assert.ok(H.setMesh.length > 0, 'the geometry sent again and set on its drawable');
  for (const { id, key } of H.setMesh.filter((s) => s.id === node[0])) {
    assert.match(key, /:v$/, 'still the vertex-material variant (it was the plain one: every banner\'s colour 0, black)');
    const g = H.geometries.find((x) => x.key === key);
    assert.ok(g, 'that variant sent again');
    assert.equal(g.flags & 128, 128, 'with its colours and glyph cells per vertex');
  }
  assert.ok(set.mesh.material.defines.S_VMAT !== undefined);
});

test('the C# side: op 8 reads the object frames after the colours, into the mesh\'s uv4 (the turn kept) and uv5', () => {
  const R = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs', import.meta.url), 'utf8');
  const H = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs', import.meta.url), 'utf8');
  assert.match(R, /hasF = \(vf & 8\) != 0;/);
  assert.match(R, /int co = o; if \(hasC\) o \+= n \* 4;\s+int fo = o; if \(hasF\) o \+= n \* 6;/, 'after the colours, 6n floats');
  assert.match(R, /md\.vmP\[i\] = new Vector4\(ff\[kp\], ff\[kp \+ 1\], ff\[kp \+ 2\], md\.vmP\[i\]\.w\);/);
  assert.match(R, /md\.mesh\.SetUVs\(4, md\.vmP\); md\.mesh\.SetUVs\(5, md\.vmN\);/);
  assert.match(R, /d\.vmP = vm\[3\]; d\.vmN = vm\[4\];/, 'kept from the geometry as first sent');
  assert.match(H, /public static bool VertexFrames\(\) => true;/, 'the player says it reads them (an older one takes the whole geometry)');
});

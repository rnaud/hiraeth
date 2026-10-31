// #800 family D: the vertices of a prepared body inside a box (game frame), by part and by z (or x, y): where a stray
// piece of Tripo's sits.   node box-probe.mjs <body.glb> <landmarks.json> x0,x1 y0,y1 z0,z1 [axis 0|1|2]
import { readFileSync } from 'node:fs';
const [IN, LM, X, Y, Z, AX] = process.argv.slice(2), L = JSON.parse(readFileSync(LM, 'utf8'));
const b = readFileSync(IN), jn = b.readUInt32LE(12), j = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
const acc = (i, A, size) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView]; return new A(bin.buffer.slice(bin.byteOffset + (v.byteOffset ?? 0), bin.byteOffset + (v.byteOffset ?? 0) + a.count * size * A.BYTES_PER_ELEMENT)); };
const pr = j.meshes[0].primitives[0], P = acc(pr.attributes.POSITION, Float32Array, 3), J = acc(pr.attributes.JOINTS_0, Uint8Array, 4);
const [x0, x1] = X.split(',').map(Number), [y0, y1] = Y.split(',').map(Number), [z0, z1] = Z.split(',').map(Number), ax = +(AX ?? 2);
const hist = new Map();
for (let i = 0; i < P.length / 3; i++) { const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; if (p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1 || p[2] < z0 || p[2] > z1) continue; const k = `${L.partNames[J[i * 4]]} ${(Math.round(p[ax] * 20) / 20).toFixed(2)}`; hist.set(k, (hist.get(k) ?? 0) + 1); }
console.log([...hist.entries()].sort().map(([k, n]) => `${k}: ${n}`).join('\n'));

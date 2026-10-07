// A small glTF 2.0 binary writer for the converted clips: a skeleton of named nodes (the UAL bones
// the clips animate, so three's GLTFLoader binds the tracks by name onto the library's skeleton)
// and one animation per clip. Rotations are stored as normalised 16-bit integers (core glTF:
// GLTFLoader dequantises them), positions and times as floats; every clip shares one time
// accessor's buffer (frame i at i / fps). Per-clip tags go in the animation's `extras` (three
// puts them in clip.userData).
const FLOAT = 5126, SHORT = 5122;

/**
 * @param nodes [{ name, parent (index or -1), translation, rotation }]
 * @param clips [{ name, fps, n, extras, channels: [{ node (index), path: 'rotation'|'translation', data: Float32Array }] }]
 */
export function writeGLB({ nodes, clips, extras = {} }) {
  const chunks = [];
  let byteLength = 0;
  const bufferViews = [], accessors = [];
  const pushView = (bytes) => {
    const pad = (4 - (byteLength % 4)) % 4;
    if (pad) { chunks.push(new Uint8Array(pad)); byteLength += pad; }
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.byteLength });
    chunks.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    byteLength += bytes.byteLength;
    return bufferViews.length - 1;
  };
  // the shared times
  const maxN = Math.max(1, ...clips.map((c) => c.n));
  const fps = clips[0]?.fps ?? 30;
  const times = new Float32Array(maxN);
  for (let i = 0; i < maxN; i++) times[i] = i / fps;
  const timeView = pushView(times);
  const timeAcc = new Map();
  const timeAccessor = (n) => {
    if (!timeAcc.has(n)) { accessors.push({ bufferView: timeView, componentType: FLOAT, count: n, type: 'SCALAR', min: [0], max: [(n - 1) / fps] }); timeAcc.set(n, accessors.length - 1); }
    return timeAcc.get(n);
  };
  const animations = clips.map((c) => {
    const samplers = [], channels = [];
    const input = timeAccessor(c.n);
    for (const ch of c.channels) {
      let acc;
      if (ch.path === 'rotation') {
        const q = new Int16Array(c.n * 4);
        for (let i = 0; i < c.n * 4; i++) q[i] = Math.round(Math.max(-1, Math.min(1, ch.data[i])) * 32767);
        accessors.push({ bufferView: pushView(q), componentType: SHORT, normalized: true, count: c.n, type: 'VEC4' });
      } else {
        const v = Float32Array.from(ch.data.subarray(0, c.n * 3));
        const min = [0, 1, 2].map((d) => { let m = Infinity; for (let i = 0; i < c.n; i++) m = Math.min(m, v[i * 3 + d]); return m; });
        const max = [0, 1, 2].map((d) => { let m = -Infinity; for (let i = 0; i < c.n; i++) m = Math.max(m, v[i * 3 + d]); return m; });
        accessors.push({ bufferView: pushView(v), componentType: FLOAT, count: c.n, type: 'VEC3', min, max });
      }
      acc = accessors.length - 1;
      samplers.push({ input, output: acc, interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: ch.node, path: ch.path } });
    }
    return { name: c.name, samplers, channels, extras: c.extras };
  });
  const gnodes = nodes.map((n) => {
    const o = { name: n.name };
    if (n.translation) o.translation = n.translation;
    if (n.rotation) o.rotation = n.rotation;
    const kids = nodes.map((m, i) => (m.parent === nodes.indexOf(n) ? i : -1)).filter((i) => i >= 0);
    if (kids.length) o.children = kids;
    return o;
  });
  const roots = nodes.map((n, i) => (n.parent < 0 ? i : -1)).filter((i) => i >= 0);
  const json = {
    asset: { version: '2.0', generator: 'Memento scripts/mocap' },
    scene: 0, scenes: [{ nodes: roots }], nodes: gnodes,
    animations, accessors, bufferViews, buffers: [{ byteLength }], extras,
  };
  const bin = new Uint8Array(byteLength);
  let o = 0;
  for (const c of chunks) { bin.set(c, o); o += c.byteLength; }
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4, binPad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + jsonBytes.length + jsonPad + 8 + bin.length + binPad;
  const out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length + jsonPad, true); dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20); out.fill(0x20, 20 + jsonBytes.length, 20 + jsonBytes.length + jsonPad);
  const b0 = 20 + jsonBytes.length + jsonPad;
  dv.setUint32(b0, bin.length + binPad, true); dv.setUint32(b0 + 4, 0x004e4942, true);
  out.set(bin, b0 + 8);
  return out;
}

/** Bytes <-> base64 (for small per-frame tags in extras). */
export const toBase64 = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');

/**
 * Read a file writeGLB made back into its input: { nodes, clips, extras } (rotations dequantised from
 * their 16-bit form), so clips can be added to a library without converting the others again
 * (build-library.mjs --add).
 */
export function readGLB(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jsonLen)));
  const b0 = 20 + jsonLen, bin = u8.subarray(b0 + 8, b0 + 8 + dv.getUint32(b0, true));
  const view = (acc) => {
    const a = json.accessors[acc], v = json.bufferViews[a.bufferView], size = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
    const at = bin.byteOffset + v.byteOffset, len = a.count * size;
    if (a.componentType === SHORT) { const s = new Int16Array(bin.buffer.slice(at, at + len * 2)); return Float32Array.from(s, (x) => Math.max(-1, x / 32767)); }
    return new Float32Array(bin.buffer.slice(at, at + len * 4));
  };
  const parent = new Map();
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
  const nodes = json.nodes.map((n, i) => ({ name: n.name, parent: parent.get(i) ?? -1, translation: n.translation, rotation: n.rotation }));
  const fps = json.extras?.fps ?? 30;
  const clips = (json.animations ?? []).map((a) => {
    const n = json.accessors[a.samplers[0].input].count;
    return { name: a.name, fps, n, extras: a.extras, channels: a.channels.map((ch) => ({ node: ch.target.node, path: ch.target.path, data: view(a.samplers[ch.sampler].output) })) };
  });
  return { nodes, clips, extras: json.extras ?? {} };
}

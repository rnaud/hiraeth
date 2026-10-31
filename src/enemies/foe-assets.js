import * as THREE from 'three';

// The foes whose bodies are built on a generated mesh (issue #800: the Tripo bodies the author picked; the shellback
// crab's has its own loader, plans/shellback-tripo.js, on the same lines), and that mesh's source: a GLB under
// public/enemies/<id>/ (its arrays only: position, normal, uv, the vertex colours sampled from its flat texture, and a
// skinned one's joints and weights) and its rig's numbers (a JSON beside it). The GLB's texture is not used: every skin
// draws the vertex colours (the home skin's are the texture's own colours), so the web and the engines draw the same
// body (the engines decode no picture in the VM) and no foe carries a 5 MB texture.
//
// A foe's body is built in the frame it comes in (src/enemies/plans/index.js archetypeModel: synchronous), so the source
// must be in before. The engines' host and Node (the tests, the audits) read it at once, the first time it is asked for
// (as the crab's); a browser fetches it: main.js asks for those its world fields (loadFoeAssets) with the other loads
// and waits for them, within LOAD_DEADLINE, before the foes' warm; the Arena asks for all. A body asked for before its
// source is in is built on the archetype's own direct body (its stand-in, plans/index.js), and the fetch begun, with a
// warning: it should not happen in play. Unity's builds carry the files in StreamingAssets (BridgeBuild.cs).
//
//   FOE_ASSETS[id]     { folder, rig }: its folder under public/ (body.glb in it) and its rig file's name
//   loadFoeAssets(ids) Promise: those of ids that have a source, each loaded once (resolves null for one that failed)
//   foeSource(id)      the source { geometry, rig, triangles } (read now where it can be), or null

export const FOE_ASSETS = {
  woodcutter: { folder: 'enemies/woodcutter/', rig: 'landmarks.json' },
  cart: { folder: 'enemies/cart/', rig: 'landmarks.json' },
  dunemummer: { folder: 'enemies/dunemummer/', rig: 'skeleton.json' },
  // (family A, #800: the toad, the centipede and the skitter, their triangles grouped by part, scripts/tripo/ship-body.mjs)
  toad: { folder: 'enemies/bellows-toad/', rig: 'landmarks.json' },
  centipede: { folder: 'enemies/centipede/', rig: 'landmarks.json' },
  skitter: { folder: 'enemies/skitter/', rig: 'landmarks.json' },
  jelly: { folder: 'enemies/cloud-jelly/', rig: 'landmarks.json' },
  moth: { folder: 'enemies/lamp-moth/', rig: 'landmarks.json' },
  ray: { folder: 'enemies/storm-ray/', rig: 'landmarks.json' },
};
/** How long the browser waits for a body (ms) before the direct body stands in (as the crab's, plans/shellback-tripo.js). */
export const LOAD_DEADLINE = 30000;

const sources = {}, loads = {}, tried = {};
const base = () => (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';

/** The arrays of a GLB's first mesh (its first primitive) as a BufferGeometry, no material, no picture. */
export function glbGeometry(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), jn = dv.getUint32(12, true);
  const j = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jn))), bin = 20 + jn + 8;
  const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const acc = (i) => {
    const a = j.accessors[i], v = j.bufferViews[a.bufferView], A = TY[a.componentType], off = u8.byteOffset + bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return new THREE.BufferAttribute(new A(u8.buffer.slice(off, off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)), CO[a.type], !!a.normalized);
  };
  const p = j.meshes[0].primitives[0], g = new THREE.BufferGeometry();
  for (const [k, name] of [['POSITION', 'position'], ['NORMAL', 'normal'], ['TEXCOORD_0', 'uv'], ['COLOR_0', 'color'], ['JOINTS_0', 'skinIndex'], ['WEIGHTS_0', 'skinWeight']]) {
    if (p.attributes[k] !== undefined) g.setAttribute(name, acc(p.attributes[k]));
  }
  if (p.indices !== undefined) g.setIndex(acc(p.indices));
  return { geometry: g, triangles: j.meshes[0].extras?.triangles ?? null };
}

const text = (b) => (typeof b === 'string' ? b : new TextDecoder().decode(b instanceof Uint8Array ? b : new Uint8Array(b)));
/** The source from its two files. */
const made = (glb, rig) => ({ ...glbGeometry(glb), rig: JSON.parse(text(rig)) });

/**
 * Its two files where they can be read at once: the engines' host (public/), Node's files (tests, tools); else null (a
 * browser). (Each foe's paths written out: the test selector reads which files a module reads, scripts/affected-tests.mjs.)
 */
const READ = {
  woodcutter: (host, fs) => (host ? [host.readFile('enemies/woodcutter/body.glb'), host.readFile('enemies/woodcutter/landmarks.json')]
    : [fs.readFileSync(new URL('../../public/enemies/woodcutter/body.glb', import.meta.url)), fs.readFileSync(new URL('../../public/enemies/woodcutter/landmarks.json', import.meta.url))]),
  jelly: (host, fs) => (host ? [host.readFile('enemies/cloud-jelly/body.glb'), host.readFile('enemies/cloud-jelly/landmarks.json')]
    : [fs.readFileSync(new URL('../../public/enemies/cloud-jelly/body.glb', import.meta.url)), fs.readFileSync(new URL('../../public/enemies/cloud-jelly/landmarks.json', import.meta.url))]),
  moth: (host, fs) => (host ? [host.readFile('enemies/lamp-moth/body.glb'), host.readFile('enemies/lamp-moth/landmarks.json')]
    : [fs.readFileSync(new URL('../../public/enemies/lamp-moth/body.glb', import.meta.url)), fs.readFileSync(new URL('../../public/enemies/lamp-moth/landmarks.json', import.meta.url))]),
  ray: (host, fs) => (host ? [host.readFile('enemies/storm-ray/body.glb'), host.readFile('enemies/storm-ray/landmarks.json')]
    : [fs.readFileSync(new URL('../../public/enemies/storm-ray/body.glb', import.meta.url)), fs.readFileSync(new URL('../../public/enemies/storm-ray/landmarks.json', import.meta.url))]),
  cart: (host, fs) => (host ? [host.readFile('enemies/cart/body.glb'), host.readFile('enemies/cart/landmarks.json')]
    : [fs.readFileSync(new URL('../../public/enemies/cart/body.glb', import.meta.url)), fs.readFileSync(new URL('../../public/enemies/cart/landmarks.json', import.meta.url))]),
  dunemummer: (host, fs) => (host ? [host.readFile('enemies/dunemummer/body.glb'), host.readFile('enemies/dunemummer/skeleton.json')]
    : [fs.readFileSync(new URL('../../public/enemies/dunemummer/body.glb', import.meta.url)), fs.readFileSync(new URL('../../public/enemies/dunemummer/skeleton.json', import.meta.url))]),
  toad: (host, fs) => (host ? [host.readFile('enemies/bellows-toad/body.glb'), host.readFile('enemies/bellows-toad/landmarks.json')]
    : [fs.readFileSync(new URL('../../public/enemies/bellows-toad/body.glb', import.meta.url)), fs.readFileSync(new URL('../../public/enemies/bellows-toad/landmarks.json', import.meta.url))]),
  centipede: (host, fs) => (host ? [host.readFile('enemies/centipede/body.glb'), host.readFile('enemies/centipede/landmarks.json')]
    : [fs.readFileSync(new URL('../../public/enemies/centipede/body.glb', import.meta.url)), fs.readFileSync(new URL('../../public/enemies/centipede/landmarks.json', import.meta.url))]),
  skitter: (host, fs) => (host ? [host.readFile('enemies/skitter/body.glb'), host.readFile('enemies/skitter/landmarks.json')]
    : [fs.readFileSync(new URL('../../public/enemies/skitter/body.glb', import.meta.url)), fs.readFileSync(new URL('../../public/enemies/skitter/landmarks.json', import.meta.url))]),
};
function readNow(id) {
  try {
    const host = globalThis.__HIRAETH_HOST__?.readFile ? globalThis.__HIRAETH_HOST__ : null, fs = host ? null : globalThis.process?.getBuiltinModule?.('node:fs');
    if (!host && !fs) return null;
    const [glb, rig] = READ[id](host, fs);
    return glb && rig ? made(glb, rig) : null;
  } catch (e) { /* not there: the direct body stands in */ }
  return null;
}

/** The source of archetype id's body, read now where it can be; else (a browser) the loaded one, or null (the load begun). */
export function foeSource(id) {
  if (sources[id] || !FOE_ASSETS[id]) return sources[id] ?? null;
  if (!tried[id]) { tried[id] = true; const now = readNow(id); if (now) return (sources[id] = now); }
  if (!loads[id] && typeof fetch === 'function') { console.warn(`the ${id}'s body was asked for before it loaded: its direct body stands in`); loadFoeAssets([id]); }
  return null;
}

/** Load the sources of those of `ids` (archetype ids) that have one; each once (a failed load is tried again next time). */
export function loadFoeAssets(ids, root = base()) {
  return Promise.all([...new Set(ids)].filter((id) => FOE_ASSETS[id]).map((id) => {
    if (!tried[id]) { tried[id] = true; const now = readNow(id); if (now) sources[id] = now; }
    if (sources[id]) return Promise.resolve(sources[id]);
    if (typeof fetch !== 'function') return Promise.resolve(null);
    if (loads[id]) return loads[id];
    let timer = null;
    const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve(null), LOAD_DEADLINE); });
    const A = FOE_ASSETS[id], get = async (name) => {
      const r = await fetch(`${root}${A.folder}${name}`);
      if (!r.ok || /text\/html/.test(r.headers?.get?.('content-type') ?? '')) throw new Error(`no ${A.folder}${name} (${r.status})`);
      return r.arrayBuffer();
    };
    return (loads[id] = Promise.race([deadline, Promise.all([get('body.glb'), get(A.rig)]).then(([glb, rig]) => (sources[id] = made(glb, rig)))])
      .then((src) => { clearTimeout(timer); if (!src) { loads[id] = null; console.warn(`the ${id}'s body did not load in time: its direct body stands in`); } return src; },
        (e) => { clearTimeout(timer); loads[id] = null; console.warn(`the ${id}'s body did not load: its direct body stands in`, e); return null; }));
  }));
}
/** The archetypes with a source a level needs: every one in the Arena, else those its world's tables field (its parts'). */
export const assetsOfWorld = (levelId, archetypesOf) => (levelId === 'arena' ? Object.keys(FOE_ASSETS) : [...new Set(archetypesOf(levelId))].filter((a) => FOE_ASSETS[a]));
/** The archetypes with a source among kinds ('woodcutter@edena', 'woodcutter*'): what a load should ask for. */
export const assetsOfKinds = (kinds) => [...new Set([...kinds].map((k) => String(k).split('@')[0].replace(/\*$/, '')).filter((a) => FOE_ASSETS[a]))];

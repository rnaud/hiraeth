// The people for the Unity port, dressed exactly as the web game dresses them: the traveller
// (traveller.js: the suit painted on a baggy copy of the people's body, the gear of traveller.glb,
// the kit of gear.js), the story's people and every crowd person (costumes.js: their look, build,
// robe, headwear, hair, mask, prop, cape), each on the Quaternius skeleton the UAL clips drive.
//
// Per person: the node tree of their model (bones, the anchors on them, rigid pieces) at the bind
// pose, every visible mesh (skinned: its bones and bind poses; rigid: on its node), the materials
// (the makeMaterial options read back, figure uniforms included: outfit zones, face, eyes, glass,
// creases), the cape (its cut, colours and the drape it settles into on that body, anchor space),
// and for the kinds the postures the clips don't have (seated, leaning), baked from npc.js on the rig.
//
// Geometry is shared between people (the same body for one kind / build / face). Everything is
// mirrored into Unity's frame like the rest of the export (x -> -x, windings flipped).
import * as THREE from 'three';
import { createHash } from 'node:crypto';

const mirrorM = (m) => {   // S·M·S, S = diag(-1, 1, 1, 1), column-major
  const e = m.elements.slice();
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) if ((r === 0) !== (c === 0)) e[c * 4 + r] = -e[c * 4 + r];
  return e;
};
const r6 = (v) => +v.toFixed(6);

export async function exportPeople({ W, blob, materialOf }) {
  const { scene, npcs, crowd, humans, lib, travellerTemplate, physics } = W;
  const { Humanoid } = await import('../../src/humanoid.js');
  const { buildCharacter } = await import('../../src/player.js');
  const { Gear } = await import('../../src/gear.js');
  const { pooledNPC, NPC } = await import('../../src/npc.js');

  // ------------------------------------------------------------ geometry (shared)
  const geoIds = new Map(), geometries = [], binds = new Map();
  function geometryOf(geo, { swapPos = null } = {}) {
    const key = swapPos ? null : geo;
    if (key && geoIds.has(key)) return geoIds.get(key);
    const P = swapPos ?? geo.attributes.position, N = geo.attributes.normal, C = geo.attributes.color, U = geo.attributes.uv, F = geo.attributes.aFold;
    const J = geo.attributes.skinIndex, Wt = geo.attributes.skinWeight;
    const n = P.count;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -P.getX(i); pos[i * 3 + 1] = P.getY(i); pos[i * 3 + 2] = P.getZ(i);
      if (N) { nrm[i * 3] = -N.getX(i); nrm[i * 3 + 1] = N.getY(i); nrm[i * 3 + 2] = N.getZ(i); } else nrm[i * 3 + 1] = 1;
    }
    const e = { id: geometries.length, vertices: n, pos: blob(pos).at, nrm: blob(nrm).at };
    if (C) { const c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = C.getX(i); c[i * 3 + 1] = C.getY(i); c[i * 3 + 2] = C.getZ(i); } e.col = blob(c).at; }
    if (U) { const u = new Float32Array(n * 2); for (let i = 0; i < n; i++) { u[i * 2] = U.getX(i); u[i * 2 + 1] = U.getY(i); } e.uv = blob(u).at; }
    if (F) { const f = new Float32Array(n * 2); for (let i = 0; i < n; i++) { f[i * 2] = F.getX(i); f[i * 2 + 1] = F.getY(i); } e.fold = blob(f).at; }
    if (J && Wt) {
      const j = new Uint16Array(n * 4), w = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { j[i * 4 + k] = J.getComponent(i, k); w[i * 4 + k] = Wt.getComponent(i, k); }
      e.joints = blob(j).at; e.weights = blob(w).at;
    }
    const src = geo.index ? geo.index.array : null, cnt = src ? src.length : n;
    const idx = new Uint32Array(cnt - (cnt % 3));
    for (let t = 0; t + 2 < cnt; t += 3) {   // (mirrored: the winding flips)
      const a = src ? src[t] : t, b = src ? src[t + 1] : t + 1, c = src ? src[t + 2] : t + 2;
      idx[t] = a; idx[t + 1] = c; idx[t + 2] = b;
    }
    e.indices = idx.length; e.idx = blob(idx).at;
    e.groups = (geo.groups ?? []).map((g) => [g.start, g.count, g.materialIndex ?? 0]);
    geometries.push(e);
    if (key) geoIds.set(key, e.id);
    return e.id;
  }

  // ------------------------------------------------------------ one person
  const visibleUnder = (o, stop) => { for (let p = o; p && p !== stop; p = p.parent) if (!p.visible) return false; return true; };
  function personOf(h, char, { id, role, hero = false, cape = null, extra = {} } = {}) {
    h.update(true);   // the bind pose (T-pose): the clips in Unity start from here
    const root = h.model;
    root.updateMatrixWorld(true);
    const nodes = [], index = new Map();
    root.traverse((o) => {
      if (!visibleUnder(o, root.parent)) return;
      index.set(o, nodes.length);
      const p = o === root ? root.position : o.position, q = o.quaternion, s = o.scale;
      nodes.push({ name: o.name || '', parent: o === root ? -1 : index.get(o.parent) ?? -1, bone: o.isBone ? 1 : 0,
        p: [r6(-p.x), r6(p.y), r6(p.z)], q: [r6(q.x), r6(-q.y), r6(-q.z), r6(q.w)], s: [r6(s.x), r6(s.y), r6(s.z)] });
    });
    const meshes = [];
    root.traverse((o) => {
      if (!o.isMesh || !index.has(o)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const m = { node: index.get(o), geo: geometryOf(o.geometry), mats: mats.map((x) => materialOf(x)), shadow: h.noShadow?.includes(o) ? 0 : 1 };
      if (o.isSkinnedMesh) {
        const bones = o.skeleton.bones.map((b) => index.get(b) ?? -1);
        const bind = new Float32Array(bones.length * 16), bm = new THREE.Matrix4();
        o.skeleton.boneInverses.forEach((inv, i) => bind.set(mirrorM(bm.multiplyMatrices(inv, o.bindMatrix)), i * 16));
        // (the same bind poses for many people of one kind: written once)
        const hk = createHash('md5').update(Buffer.from(bind.buffer)).digest('hex');
        if (!binds.has(hk)) binds.set(hk, blob(bind).at);
        m.bones = bones; m.bind = binds.get(hk);
      }
      meshes.push(m);
    });
    // the cape: its cut, and the drape it settles into on this body (anchor space)
    let capeOut = null;
    if (cape && index.has(cape.anchor)) {
      const g = cape.geo;
      const drape = cape.drape ?? cape.local;
      const P = new THREE.BufferAttribute(Float32Array.from(drape), 3);
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', P); gg.setAttribute('aFold', g.attributes.aFold); gg.setIndex(g.index);
      gg.computeVertexNormals();
      const [cols, rows, top, bottom, length, y, gap] = cape.cut.split('/').map(Number);
      capeOut = { node: index.get(cape.anchor), geo: geometryOf(gg), mat: materialOf(cape.mesh.material), cols: cape.cols, rows: cape.rows,
        top, bottom, length, y, gap, heavy: cape.cut.endsWith('true') ? 1 : 0, local: blob(Float32Array.from(cape.local, (v, i) => (i % 3 === 0 ? -v : v))).at };
    }
    // the eyes and brows: what the expressions move (Humanoid.setExpression, updateEyes)
    const brow = h.browMesh && index.has(h.browMesh) ? index.get(h.browMesh) : -1;
    const eye = h.eyeMesh && index.has(h.eyeMesh) ? index.get(h.eyeMesh) : -1;
    return { id, role, hero: hero ? 1 : 0, kind: h.kind, scale: +char.root.scale.y.toFixed(4), lift: h.lift ?? 0, nodes, meshes, cape: capeOut, brow, eye,
      rest: h.restExpression ?? null, build: h.build, ...extra };
  }

  const people = [];
  const player = { pos: new THREE.Vector3(1e5, 0, 0), wind: new THREE.Vector3(), hidden: true };
  const settle = (npc) => {
    // the idle pose a moment, the cloth settled on it (the drape the cape hangs in)
    npc.object.updateMatrixWorld(true);
    if (npc.animator) npc.pose(1 / 30, 0, -1, 99, player, null);
    npc.posture(0, { pose: npc.seat ? 4 : npc.person ? npc.person.pose : 0 });
    npc.object.updateMatrixWorld(true);
    npc.humanoid.update();
    if (npc.cape) { npc.cape.drape = null; npc.cape.ready = false; npc.cape.bake({ ...npc.clothState(player, 0), capsules: npc.clothCapsules(null) }, { force: true }); }
  };

  // ---- the traveller (main.js: the people's body as the traveller, the gear of gear.js)
  {
    const char = buildCharacter();
    const h = new Humanoid(humans[0], char, 'm', { outfit: travellerTemplate });
    new Gear(new THREE.Scene(), h, char);
    if (char.pack) char.pack.visible = false;
    people.push(personOf(h, char, { id: 'traveller', role: 'traveller', hero: true }));
  }
  // ---- the story's people
  for (const n of npcs) {
    if (!n.humanoid) continue;
    settle(n);
    people.push(personOf(n.humanoid, n.char, { id: n.def?.id ?? null, role: 'story', cape: n.cape, extra: { seat: n.seat ?? null } }));
  }
  // ---- the crowd: each person as the near tier dresses them (a pooled NPC given their look)
  const pool = { m: null, f: null };
  for (const p of crowd.people) {
    const npc = pooledNPC(new THREE.Scene(), physics, { kind: p.kind, lib, humans });
    npc.assign(p, crowd);
    npc.object.position.copy(p.pos);
    npc.object.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.heading);
    settle(npc);
    people.push(personOf(npc.humanoid, npc.char, { id: `crowd:${p.id}`, role: 'crowd', cape: npc.cape, extra: { crowd: p.id, pose: p.pose ?? 0 } }));
    pool[p.kind] ??= npc;
  }

  // ---- postures (npc.js posture: 2 rail, 3 edge, 4 kerb / cushion, 6 wall) per kind, over the idle clip
  const poses = {};
  for (const kind of ['m', 'f']) {
    const npc = pool[kind] ?? new NPC(new THREE.Scene(), physics, { route: [new THREE.Vector3()], palette: {}, lines: ['…'], lib, human: humans[kind === 'm' ? 0 : 1], kind });
    poses[kind] = {};
    for (const pose of [0, 2, 3, 4, 6]) {
      npc.object.position.set(0, 0, 0); npc.object.quaternion.identity(); npc.object.updateMatrixWorld(true);
      npc.pose(1 / 30, 0, -1, 99, player, null);
      npc.posture(0, { pose, seed: 0.5 });
      npc.object.updateMatrixWorld(true);
      npc.humanoid.update();
      const out = {};
      for (const b of npc.humanoid.order) out[b.name] = [r6(b.quaternion.x), r6(-b.quaternion.y), r6(-b.quaternion.z), r6(b.quaternion.w)];
      const pel = npc.humanoid.b.pelvis.position;
      poses[kind][pose] = { bones: out, pelvis: [r6(-pel.x), r6(pel.y), r6(pel.z)] };
    }
  }
  // ---- the clips, retargeted as the web game does it (animator.js onto the rig, humanoid.js aiming
  // the body's bones along it, the wrists from the clip): every bone's local rotation and the pelvis'
  // place, 30 frames a second, for each kind of body
  const { Animator } = await import('../../src/animator.js');
  const FPS = 30, anims = { native: lib.native, fps: FPS, kinds: {} };
  const bakeOne = (h, char) => {
    const A = new Animator(lib, char), out = {};
    const bones = h.order.map((b) => b.name);
    for (const [key, clip] of Object.entries(lib.clips)) {
      if (!clip) continue;
      const action = key === 'jumpLoop' ? A.actions.jumpLoop : A.actions[key];
      if (!action) continue;
      const frames = Math.max(2, Math.round(clip.duration * FPS) + 1);
      const q = new Float32Array(frames * bones.length * 4), pel = new Float32Array(frames * 3);
      for (let f = 0; f < frames; f++) {
        for (const a of Object.values(A.actions)) a.setEffectiveWeight(0);
        action.enabled = true; action.setEffectiveWeight(1);
        action.time = Math.min(clip.duration * 0.9999, f / FPS);
        A.mixer.update(0);
        A.src.updateMatrixWorld(true);
        char.root.updateMatrixWorld(true);
        A.apply(char.root, { legScale: 1.04 });
        h.update();
        if (!/drive|climb|ledge/.test(key)) h.poseHands(A);
        h.order.forEach((b, i) => { const k = (f * bones.length + i) * 4; q[k] = b.quaternion.x; q[k + 1] = -b.quaternion.y; q[k + 2] = -b.quaternion.z; q[k + 3] = b.quaternion.w; });
        const p = h.b.pelvis.position; pel[f * 3] = -p.x; pel[f * 3 + 1] = p.y; pel[f * 3 + 2] = p.z;
      }
      out[key] = { name: clip.name, duration: clip.duration, frames, q: blob(q).at, pelvis: blob(pel).at };
    }
    h.update(true);
    return { bones, clips: out };
  };
  for (const [kind, i] of [['m', 0], ['f', 1]]) { const char = buildCharacter(); anims.kinds[kind] = bakeOne(new Humanoid(humans[i], char, kind), char); }
  return { people, geometries, poses, anims };
}

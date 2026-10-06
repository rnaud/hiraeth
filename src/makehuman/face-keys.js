// The MakeHuman bodies' faces (docs/makehuman.md): their expressions on shape keys.
//
// The parametric body of scripts/makehuman/build.py carries MPFB's face units (ARKit) and visemes as morph
// targets, the left and right halves merged (smile, frown, jawOpen, browInnerUp, browDown,
// browOuterUp, blink, squint, cheekSquint, eyeWide, v_aa: the ones used here). A tone's
// expression (src/expression.js: smile, open, brow, browTilt, squint) becomes weights on them
// (keyWeights), so the skin itself moves: the mouth's corners, the jaw, the brows (their own mesh
// has the keys too), the lids. The face ink rides the skin (materials.js keeps vBind the rest
// position), and draws only its share on top (INK_SHARE: the creases, the forehead's lines, the
// dark of an open mouth). Humanoid.setExpression / updateEyes call it (Humanoid.faceKeys).

/** How much of each part of an expression the ink still draws over the moving skin (0..1). */
export const INK_SHARE = { smile: 0.4, open: 0.75, brow: 1, browTilt: 1, squint: 0.5 };

/** How strongly each part of an expression pulls its keys (a key's weight per unit of it). */
export const KEY_GAIN = {
  smile: { smile: 0.8, cheekSquint: 0.35 },
  frown: { frown: 0.85 },
  open: { jawOpen: 0.45, v_aa: 0.35 },
  browUp: { browInnerUp: 0.45, browOuterUp: 0.75, eyeWide: 0.2 },
  browDown: { browDown: 0.75 },
  worry: { browInnerUp: 0.9 },
  anger: { browDown: 0.55, browOuterUp: 0.25 },
  squint: { squint: 0.7, cheekSquint: 0.25 },
};

/** The shape keys a face wears for an expression (and a blink, 0..1). */
export function keyWeights(x = {}, blink = 0) {
  const w = {};
  const add = (gains, amount) => { if (amount > 0) for (const [k, g] of Object.entries(gains)) w[k] = (w[k] ?? 0) + g * amount; };
  const v = (k) => (Number.isFinite(x?.[k]) ? x[k] : 0);
  add(KEY_GAIN.smile, Math.max(v('smile'), 0));
  add(KEY_GAIN.frown, Math.max(-v('smile'), 0));
  add(KEY_GAIN.open, v('open'));
  add(KEY_GAIN.browUp, Math.max(v('brow'), 0));
  add(KEY_GAIN.browDown, Math.max(-v('brow'), 0));
  add(KEY_GAIN.worry, Math.max(v('browTilt'), 0));
  add(KEY_GAIN.anger, Math.max(-v('browTilt'), 0));
  add(KEY_GAIN.squint, v('squint'));
  w.blink = Math.max(blink, 0);
  for (const k of Object.keys(w)) w[k] = Math.min(1.2, Math.max(0, w[k]));
  return w;
}

/** The part of an expression the ink draws on top of the shape keys. */
export function inkShare(x) {
  return { ...x, smile: x.smile * INK_SHARE.smile, open: x.open * INK_SHARE.open, brow: x.brow * INK_SHARE.brow, browTilt: x.browTilt * INK_SHARE.browTilt, squint: x.squint * INK_SHARE.squint };
}

/**
 * The shape-key face of a Humanoid (the MakeHuman template's profile.faceKeys, src/makehuman/body.js): every mesh of its model
 * with face keys (geometry.userData.faceKeys: the part's shared texture, its head's scale), set together.
 * Each mesh keeps its weights (mesh.userData.keyWeights, by its key names: mesh.userData.keyNames) and hands
 * them to its material before each draw (bindKeys), with the texture and the scale of the geometry it draws
 * then: a level of detail (skinned-lod.js) has no keys, so the shader skips them.
 * set(expression) → the ink's share; eyes(blink, squint) → the eyeball's painted lid (with the real lids:
 * they rest opened wider than modelled, body.js openEyes).
 */
export function faceKeysFor(h) {
  const meshes = [];
  h.model.traverse((o) => {
    const k = o.isMesh && o.geometry?.userData.faceKeys;
    if (!k) return;
    o.userData.keyNames = k.names;
    o.userData.keyWeights = new Float32Array(k.names.length);
    o.onBeforeRender = bindKeys;
    meshes.push(o);
  });
  const names = new Set(meshes.flatMap((m) => m.userData.keyNames));
  let expr = {}, blink = 0;
  const write = () => {
    const w = keyWeights(expr, blink);
    for (const m of meshes) {
      const W = m.userData.keyWeights, N = m.userData.keyNames;
      for (let i = 0; i < N.length; i++) W[i] = w[N[i]] ?? 0;
    }
  };
  return {
    meshes, names,
    brows: !!h.browMesh?.geometry?.userData.faceKeys,
    weights: () => keyWeights(expr, blink),
    /** A mesh's weight on a key (0 if it has none). */
    weightOf: (mesh, key) => { const i = mesh.userData.keyNames?.indexOf(key) ?? -1; return i >= 0 ? mesh.userData.keyWeights[i] : 0; },
    set(x) { expr = x; write(); return inkShare(x); },
    // (the eyeball's painted lid comes down with the skin's: the lids, opened wider than modelled, shut over it)
    eyes(b) { if (Math.abs(b - blink) > 1e-4) { blink = b; write(); } return b; },
  };
}

/** A face-keyed mesh's onBeforeRender: its weights, the key texture and its head's scale into its material (none on a level of detail). */
export function bindKeys() {
  const u = this.material?.uniforms;
  if (!u?.uKeyW) return;
  const k = this.geometry?.userData.faceKeys, W = this.userData.keyWeights, out = u.uKeyW.value;
  if (!k || !W) { u.uKeyScale.value.w = 0; return; }
  u.uKeyTex.value = k.texture;
  u.uKeyWidth.value = k.width;
  u.uKeyScale.value.set(k.kHead[0], k.kHead[1], k.kHead[2], 1);
  for (let i = 0; i < out.length; i++) out[i] = W[i] ?? 0;
}

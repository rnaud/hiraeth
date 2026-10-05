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
 * with morph targets, set together. set(expression) → the ink's share; eyes(blink, squint) → the
 * eyeball's painted lid (with the real lids: they rest opened wider than modelled, body.js openEyes).
 */
export function faceKeysFor(h) {
  const meshes = [];
  h.model.traverse((o) => { if (o.isMesh && o.morphTargetDictionary && o.morphTargetInfluences?.length) meshes.push(o); });
  const names = new Set(meshes.flatMap((m) => Object.keys(m.morphTargetDictionary)));
  let expr = {}, blink = 0;
  const write = () => {
    const w = keyWeights(expr, blink);
    for (const m of meshes) {
      const inf = m.morphTargetInfluences;
      inf.fill(0);
      for (const [k, v] of Object.entries(w)) { const i = m.morphTargetDictionary[k]; if (i !== undefined) inf[i] = v; }
    }
  };
  return {
    meshes, names,
    brows: !!h.browMesh?.morphTargetDictionary,
    weights: () => keyWeights(expr, blink),
    set(x) { expr = x; write(); return inkShare(x); },
    // (the eyeball's painted lid comes down with the skin's: the lids, opened wider than modelled, shut over it)
    eyes(b) { if (Math.abs(b - blink) > 1e-4) { blink = b; write(); } return b; },
  };
}

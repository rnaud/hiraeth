// What a view draws, pass by pass (deck-worlds.mjs --draws 1): evaluated in the page, it counts every draw call over
// 8 frames, grouped by the object's own name and its nearest named ancestors, and returns the draws a frame of each.
// (I: instanced, B: batched, S: skinned)
(() => new Promise((done) => {
  const R = window.renderer, rbd = R.renderBufferDirect, render = R.render, FRAMES = 8;
  let pass = null, on = false;
  const out = {};
  const label = (o) => {
    const path = [];
    for (let p = o; p && path.length < 3; p = p.parent) if (p.name) path.push(p.name);
    return (o.isInstancedMesh ? 'I ' : o.isBatchedMesh ? 'B ' : o.isSkinnedMesh ? 'S ' : '') + (path.join(' < ') || o.type);
  };
  R.render = function (sc, cam) {
    const prev = pass;
    pass = sc.overrideMaterial ? 'shadow' : sc === window.scene ? 'gbuffer' : 'other';
    try { return render.call(this, sc, cam); } finally { pass = prev; }
  };
  R.renderBufferDirect = function (cam, sc, geo, mat, obj, grp) {
    if (on && pass) { const m = (out[pass] ??= {}); const k = label(obj); m[k] = (m[k] ?? 0) + 1; }
    return rbd.call(this, cam, sc, geo, mat, obj, grp);
  };
  let n = -2;
  const tick = () => {
    if (++n === 0) on = true;
    if (n < FRAMES) { requestAnimationFrame(tick); return; }
    R.render = render; R.renderBufferDirect = rbd;
    const res = {};
    for (const [p, m] of Object.entries(out)) {
      const e = Object.entries(m).map(([k, v]) => [k, +(v / FRAMES).toFixed(2)]).sort((a, b) => b[1] - a[1]);
      res[p] = { total: +e.reduce((s, x) => s + x[1], 0).toFixed(1), top: e.slice(0, 40) };
    }
    done(res);
  };
  requestAnimationFrame(tick);
}))()

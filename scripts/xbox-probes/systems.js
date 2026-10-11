// The main thread's time per frame by system on the console (docs/systems/xbox.md, "Why 20 fps"): the same wrappers
// as scripts/bench/android-worlds.mjs --profile (the world's updates and renderer.render by pass), 5 s, then the
// frame readout's own main-thread figure for the whole. Run: node scripts/xbox-devtools.mjs js @scripts/xbox-probes/systems.js
(async () => {
  const install = (() => {
  if (window.__prof) return true;
  const acc = {}, P = window.__prof = { on: false, acc, frames: 0 };
  const wrap = (name, obj, key) => {
    if (!obj || typeof obj[key] !== 'function' || obj[key].__w) return;
    const f = obj[key];
    const w = function (...a) { if (!P.on) return f.apply(this, a); const t = performance.now(); try { return f.apply(this, a); } finally { acc[name] = (acc[name] || 0) + performance.now() - t; } };
    w.__w = 1; obj[key] = w;
  };
  const W = window;
  for (const [n, o, k] of [['crowd', W.crowd, 'update'], ['player', W.player, 'update'], ['rig', W.rig, 'update'], ['story', W.storyRt, 'update'], ['wind', W.wind, 'update'],
    ['level', W.level, 'update'], ['reactive', W.reactiveWorld, 'update'], ['wildlife', W.wildlife, 'update'], ['waters', W.waters, 'update'], ['sound', W.sound, 'update'],
    ['ship', W.ship, 'update'], ['boxes', W.boxes, 'update'], ['tool', W.tool, 'update'], ['weather', W.weather, 'update'], ['scout', W.scout, 'update'], ['relics', W.relics, 'update'],
    ['storyPages', W.story, 'update'], ['flammables', W.flammables, 'update'], ['errands', W.errands, 'update'], ['sky', W, 'updateSky'],
    ['r.flora', W.flora, 'update'], ['r.grass', W.blades?.grass, 'update'], ['r.lod', W.lod?.(), 'update'], ['r.skinnedLods', W.skinnedLods, 'update'], ['r.interior', W.interiorCull, 'hide'],
    ['r.shadowCull', W.shadowCull, 'begin'], ['r.bloom', W.bloom, 'render'], ['r.waters', W.waters, 'renderOver']]) wrap(n, o, k);
  for (const n of W.npcs) wrap('npcs', n, 'update');
  for (const n of W.npcs) wrap('npcs.balloon', n, 'placeBalloon');
  for (const f of W.flocks ?? []) wrap('flocks', f, 'update');
  for (const v of W.player.vehicles ?? []) wrap('vehicles', v, 'update');
  // the passes, by what they draw
  const R = W.renderer, render = R.render;
  R.render = function (sc, cam) {
    if (!P.on) return render.call(this, sc, cam);
    const k = sc.overrideMaterial ? 'r.pass.shadow' : sc === W.scene ? 'r.pass.gbuffer' : sc === W.post.scene ? 'r.pass.composite' : 'r.pass.other';
    const t = performance.now(); try { return render.call(this, sc, cam); } finally { acc[k] = (acc[k] || 0) + performance.now() - t; }
  };
  return true;
})();
  install;
  const P = window.__prof, R = window.renderer;
  for (const k of Object.keys(P.acc)) delete P.acc[k];
  const f0 = R.info.render.frame, t0 = performance.now(); P.on = true;
  const reads = [];
  for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r, 1000)); reads.push(document.getElementById('fps')?.textContent ?? ''); }
  P.on = false;
  const wall = performance.now() - t0, renders = R.info.render.frame - f0;
  // (frames: the readout's fps over the wall time; renderer.info.render.frame counts every render() call, several a frame)
  const fps = reads.map((r) => +(/ (\d+) fps/.exec(r)?.[1] ?? NaN)).filter(Number.isFinite);
  const frames = Math.round((fps.reduce((s, x) => s + x, 0) / fps.length) * wall / 1000);
  const cpu = reads.map((r) => +(/cpu ([\d.]+)/.exec(r)?.[1] ?? NaN)).filter(Number.isFinite).sort((a, b) => a - b);
  const per = Object.fromEntries(Object.entries(P.acc).map(([k, v]) => [k, +(v / frames).toFixed(2)]).sort((a, b) => b[1] - a[1]));
  return { frames, renders_per_frame: +(renders / frames).toFixed(1), cpu_ms_readout: cpu[Math.floor(cpu.length / 2)], bySystem: per, last: reads.at(-1) };
})()

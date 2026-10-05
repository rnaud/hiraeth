// Injected before the game's own scripts (transitions.mjs): times every animation frame, splits the
// WebGL work into compiles, texture and buffer uploads, notes long tasks, and after each frame records
// the traveller (place, heading, speed, ground), the camera (its offset from the traveller, in the
// traveller's own frame), the clip blend and a pose signature (hands, feet and head in the body's
// space). With strip on, a small copy of each frame (the screen's fade painted over it) is kept.
(() => {
  const T = (window.__tp = { rec: false, frames: [], long: [], strip: null, phases: {} });
  // ---- long tasks
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (T.rec) T.long.push({ at: e.startTime, ms: e.duration }); }).observe({ type: 'longtask', buffered: false }); } catch { /* */ }
  // ---- WebGL work by kind
  const gl = { compile: 0, tex: 0, buf: 0, sync: 0, nCompile: 0, nTex: 0, nBuf: 0, slowest: 0, slowName: '' };
  const wrap = (proto, name, kind) => {
    const f = proto[name]; if (!f) return;
    proto[name] = function (...a) { const t0 = performance.now(); try { return f.apply(this, a); } finally { const d = performance.now() - t0; gl[kind] += d; if (d > gl.slowest) { gl.slowest = +d.toFixed(2); gl.slowName = name; } if (name === 'linkProgram') gl.nCompile++; if (kind === 'tex' && name !== 'pixelStorei') gl.nTex++; if (name === 'bufferData') gl.nBuf++; } };
  };
  for (const P of [window.WebGL2RenderingContext?.prototype].filter(Boolean)) {
    for (const n of ['compileShader', 'linkProgram', 'getProgramParameter', 'getShaderParameter', 'getProgramInfoLog', 'getShaderInfoLog', 'getUniformLocation', 'getActiveUniform', 'getActiveAttrib']) wrap(P, n, 'compile');
    for (const n of ['texImage2D', 'texSubImage2D', 'texStorage2D', 'texImage3D', 'texSubImage3D', 'texStorage3D', 'compressedTexImage2D', 'generateMipmap']) wrap(P, n, 'tex');
    for (const n of ['bufferData', 'bufferSubData']) wrap(P, n, 'buf');
    for (const n of ['getError', 'readPixels', 'getParameter', 'clientWaitSync', 'getQueryParameter', 'getSyncParameter', 'getBufferSubData', 'finish', 'flush', 'checkFramebufferStatus', 'getExtension', 'getContextAttributes']) wrap(P, n, 'sync');
  }
  // ---- named phases: wrapped once the game is up (see T.hook)
  const ph = {};
  T.time = (obj, name, label = name) => {
    const f = obj?.[name]; if (typeof f !== 'function' || f.__tp) return;
    const g = function (...a) { const t0 = performance.now(); try { return f.apply(this, a); } finally { ph[label] = (ph[label] ?? 0) + performance.now() - t0; } };
    g.__tp = true; obj[name] = g;
  };
  T.hook = () => {
    const w = window;
    T.time(w.player, 'update', 'player');
    T.time(w.rig, 'update', 'rig');
    T.time(w.level, 'update', 'level');
    T.time(w.ship, 'update', 'ship');
    T.time(w.flora, 'update', 'flora');
    T.time(w.blades?.grass, 'update', 'grass');
    T.time(w.renderer, 'render', 'render');
    T.time(w.lod?.(), 'update', 'lod');
    T.time(w.scout, 'update', 'scout');
    T.time(w.wildlife, 'update', 'wildlife');
    T.time(w.story, 'update', 'story');
    T.time(w.waters, 'update', 'water');
    T.time(w.shelter, 'update', 'shelter');
    T.time(w.crowd, 'update', 'crowd');
    for (const n of w.npcs ?? []) T.time(n, 'update', 'npcs');
    // diagnosis (T.diag): every draw waits for the GPU process (getError is a round trip), so a draw
    // that makes it build something (a pipeline, an upload) shows its own cost, with what it drew
    const R = w.renderer, rbd = R.renderBufferDirect, g = R.getContext();
    R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      if (!T.diag || !T.rec || !(T.diagOn || performance.now() < (T.diagUntil ?? 0))) return rbd.apply(this, arguments);
      g.getError();
      const t0 = performance.now();
      try { return rbd.apply(this, arguments); } finally {
        g.getError();
        const dt = performance.now() - t0;
        if (dt > 2) {
          const rt = R.getRenderTarget();
          let path = object.name || object.type, o = object.parent, n = 0;
          while (o && n++ < 4) { if (o.name) path = o.name + '/' + path; o = o.parent; }
          (T._slow ??= []).push({ ms: +dt.toFixed(1), what: path, mat: (material.name || material.type) + (material.defines ? ' ' + Object.keys(material.defines).slice(0, 6).join(',') : ''), inst: !!object.isInstancedMesh, skin: !!object.isSkinnedMesh, verts: geometry.attributes.position?.count ?? 0, rt: rt ? (rt.textures?.length > 1 ? 'mrt' + rt.textures.length : rt.depthTexture && !rt.texture?.image?.width ? 'depth' : 'rt') + ' ' + rt.width + 'x' + rt.height : 'canvas' });
        }
      }
    };
  };
  // ---- the pose signature
  const V = () => ({ x: 0, y: 0, z: 0 });
  let bones = null;
  const pose = (P) => {
    if (!P?.object) return null;
    if (!bones) {
      const list = [];
      P.object.traverse((o) => { if (o.isBone && /^(foot_l|foot_r|hand_l|hand_r|head)$/i.test(o.name)) list.push(o); });
      if (!list.length) P.object.traverse((o) => { if (o.isBone && /(foot|hand|head)/i.test(o.name) && list.length < 5) list.push(o); });
      bones = list;
    }
    const THREE = window.THREE, inv = (T._inv ??= new THREE.Matrix4()), v = (T._v ??= new THREE.Vector3());
    P.object.updateMatrixWorld(true);
    inv.copy(P.object.matrixWorld).invert();
    return bones.map((b) => { v.setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv); return [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)]; });
  };
  // what covers the screen: the cinema's fade (an opacity), the hand-over's sheet (src/passage.js: a
  // sheet sweeping across; its share of the screen's width, and where it is)
  const fadeOf = () => {
    let k = 0, col = '#2b211f', sheet = null;
    const f = document.querySelector('#cine .fade');
    if (f) { const s = getComputedStyle(f), o = +s.opacity; if (o > k && s.display !== 'none' && s.visibility !== 'hidden') { k = o; col = s.backgroundColor; } }
    const P = document.getElementById('passage');
    if (P && getComputedStyle(P).visibility !== 'hidden') {
      const r = P.getBoundingClientRect(), W = innerWidth, edge = r.width * 12 / 124;
      const a = Math.max(0, r.left + edge * 0.5), b = Math.min(W, r.right - edge * 0.5);
      sheet = { a: a / W, b: b / W };
      k = Math.max(k, Math.max(0, b - a) / W);
    }
    return { k, col, sheet };
  };
  // ---- the frame
  const raf = window.requestAnimationFrame.bind(window);
  let tick = -1, cpu = 0;
  window.requestAnimationFrame = (cb) => raf((ts) => {
    const start = ts !== tick;
    if (start) {
      if (tick >= 0 && T.rec && T._pending) { T._pending.dt = ts - tick; T._pending.cpu = cpu; T.frames.push(T._pending); }
      T._pending = null; tick = ts; cpu = 0;
      for (const k in gl) gl[k] = k === 'slowName' ? '' : 0;
      for (const k in ph) delete ph[k];
      T.pre?.(ts);
      T.pollFences(performance.now());
      // (diagnosis only near the way through: from 2.5 m before it to 1.5 s after)
      const P = window.player;
      if (T.diag && T.diagAt && P) { const d = Math.hypot(P.pos.x - T.diagAt[0], P.pos.y - T.diagAt[1], P.pos.z - T.diagAt[2]); if (d < 2.5) T.diagUntil = performance.now() + 1500; }
    }
    const t0 = performance.now();
    const drawn0 = window.renderer?.info?.render?.frame;
    try { cb(ts); } finally {
      cpu += performance.now() - t0;
      const w = window, P = w.player, cam = w.camera;
      // (only the callback that drew the game: another one in the same frame finds the canvas presented)
      if (T.rec && P && cam && w.THREE && w.renderer.info.render.frame !== drawn0) {
        const up = P.frame?.up ?? { x: 0, y: 1, z: 0 };
        const h = P.heading ?? 0, fx = Math.sin(h), fz = Math.cos(h);
        const dx = cam.position.x - P.pos.x, dy = cam.position.y - P.pos.y, dz = cam.position.z - P.pos.z;
        const A = P.animator;
        const fd = fadeOf();
        T._pending = {
          t: performance.now(), p: [P.pos.x, P.pos.y, P.pos.z].map((x) => +x.toFixed(3)), h: +h.toFixed(4),
          speed: +Math.hypot(P.vel.x, P.vel.z).toFixed(3), ground: !!P.onGround,
          // the camera in the traveller's frame: behind (+ along -fwd), right, up
          cam: [+(dx * fx + dz * fz).toFixed(3), +(dx * fz - dz * fx).toFixed(3), +(dy).toFixed(3)], camDist: +Math.hypot(dx, dy, dz).toFixed(3),
          yaw: +(w.rig?.yaw ?? 0).toFixed(4), curDist: +(w.rig?._curDist ?? 0).toFixed(3),
          w: A ? { idle: +A.w.idle.toFixed(3), walk: +A.w.walk.toFixed(3), jog: +A.w.jog.toFixed(3), sprint: +A.w.sprint.toFixed(3), air: +(A.w.air ?? 0).toFixed(3) } : null,
          phase: A ? +A.phase.toFixed(4) : null, pose: pose(P), fade: +fd.k.toFixed(3),
          gl: { ...gl }, ph: Object.fromEntries(Object.entries(ph).map(([k, v]) => [k, +v.toFixed(2)])),
          progs: w.renderer?.info?.programs?.length ?? 0, geo: w.renderer?.info?.memory?.geometries ?? 0, texs: w.renderer?.info?.memory?.textures ?? 0,
          mark: T.mark ?? null, ins: !!w.ship?.inside || !!w.level?.indoorAt?.(P.pos), slow: T._slow ?? null,
        };
        T.mark = null; T._slow = null;
        T.fence(T._pending);
        if (T.strip && T.strip.on) {
          const c = document.createElement('canvas'); c.width = T.strip.w; c.height = T.strip.h;
          const x = c.getContext('2d');
          x.drawImage(w.renderer.domElement, 0, 0, c.width, c.height);
          if (fd.sheet) {
            const a = fd.sheet.a * c.width, b = fd.sheet.b * c.width;
            if (b > a) { x.fillStyle = '#f2e7cf'; x.fillRect(a, 0, b - a, c.height); x.fillStyle = '#2b211f'; if (a > 0) x.fillRect(a - 1, 0, 2, c.height); if (b < c.width) x.fillRect(b - 1, 0, 2, c.height); }
          } else if (fd.k > 0.001) { x.globalAlpha = fd.k; x.fillStyle = fd.col; x.fillRect(0, 0, c.width, c.height); x.globalAlpha = 1; }
          T.strip.frames.push({ c, i: T.frames.length });
        }
      }
    }
  });
  // ---- the GPU's lag: a fence after each frame, polled at the start of the next ones; the time from
  // the end of a frame's commands to its fence signalling (what a display would wait for)
  const fences = [];
  T.pollFences = (now) => {
    const g = window.renderer?.getContext(); if (!g) return;
    while (fences.length) {
      const f = fences[0];
      const st = g.getSyncParameter(f.s, g.SYNC_STATUS);
      if (st !== g.SIGNALED) break;
      g.deleteSync(f.s); fences.shift();
      if (f.rec) f.rec.lat = +(now - f.t).toFixed(1);
    }
  };
  T.fence = (rec) => {
    const g = window.renderer?.getContext(); if (!g || fences.length > 30) return;
    fences.push({ s: g.fenceSync(g.SYNC_GPU_COMMANDS_COMPLETE, 0), t: performance.now(), rec });
    g.flush();
  };
  T.start = () => { T.frames = []; T.long = []; T.rec = true; };
  T.stop = () => { T.rec = false; return { frames: T.frames, long: T.long }; };
})();

// The motion check's frozen world (docs/systems/rendering.md, "Stable in motion"; issue #301). The check steps the
// clock 0.1 ms a frame, so what moves by time stands still; what moves by where the traveller is did not: every frame
// of a path puts him behind the camera, the flocks circle him (src/life.js Flock: its centre is his position), the
// creatures wake, sleep and flee round him (src/wildlife.js), the foes and the reactive things answer him. Viridel's
// pan read 12.8 flickering pixels per 10 000 at v1.66 where rendering.md had 2.5, nearly all of it birds and
// creatures. freezeLife holds them: the flocks keep the centre and the eye they had, the rest are updated as paused.
// Run in the page (its source is passed in), so it reads only what it is given.

/** The movers held (in the page's window `w`): the names of what was frozen. */
export function freezeLife(w) {
  const held = [];
  const pinned = (v) => (v && typeof v.clone === 'function' ? v.clone() : v);
  const focus = pinned(w.player?.pos), eye = pinned(w.camera?.position);
  (w.flocks ?? []).forEach((f, i) => {
    if (!f || typeof f.update !== 'function' || f.__held) return;
    const update = f.update.bind(f);
    f.update = (dt, t) => update(dt, t, focus, eye);   // (its centre and its birds' size kept where they were)
    f.__held = true; held.push(`flock ${i}`);
  });
  // (update(dt, t, player, camera, paused): wildlife, the reactive world; update(dt, paused): the foes)
  for (const [k, at] of [['wildlife', 4], ['reactiveWorld', 4], ['foes', 1]]) {
    const o = w[k];
    if (!o || typeof o.update !== 'function' || o.__held) continue;
    const update = o.update.bind(o);
    o.update = (...a) => { a.length = Math.max(a.length, at + 1); a[at] = true; return update(...a); };
    o.__held = true; held.push(k);
  }
  return held;
}

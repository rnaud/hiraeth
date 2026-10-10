// The motion QC's contact sheet in node (.claude/skills/motion-qc/SKILL.md): each of a run's worst frames drawn as an
// SVG panel: the pose from the body's right side (ghosts of the frames before and after, thinner), the ground under
// the feet, and from above the balls' trails over ±0.25 s (a filled dot where feet.js holds the foot). Captioned with
// what was wrong and by how much. (The browser run's sheets are pictures of the game itself.)
import { JOINTS } from './lib.mjs';

const J = Object.fromEntries(JOINTS.map((n, i) => [n, i]));
const LINES = [['pelvis', 'spine_03'], ['spine_03', 'Head'], ['spine_03', 'upperarm_l'], ['upperarm_l', 'lowerarm_l'], ['lowerarm_l', 'hand_l'],
  ['spine_03', 'upperarm_r'], ['upperarm_r', 'lowerarm_r'], ['lowerarm_r', 'hand_r'], ['pelvis', 'thigh_l'], ['thigh_l', 'calf_l'], ['calf_l', 'foot_l'], ['foot_l', 'ball_l'],
  ['pelvis', 'thigh_r'], ['thigh_r', 'calf_r'], ['calf_r', 'foot_r'], ['foot_r', 'ball_r']];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** One panel's SVG (w × h at x, y) for sample index i. */
function panel(S, i, what, x0, y0, w, h) {
  const s = S[i], hd = s.heading, f = [Math.sin(hd), 0, Math.cos(hd)];
  // the side view: across = the body's forward, up = y; centred on this frame's feet
  const side = (p, base) => [(p[0] - base[0]) * f[0] + (p[2] - base[2]) * f[2], p[1] - base[1]];
  const sc = h * 0.42, cx = x0 + w * 0.36, cy = y0 + h * 0.8;
  const P = (q) => [cx + q[0] * sc, cy - q[1] * sc];
  let g = `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#f8f2e6" stroke="#bbb"/>`;
  const base = s.pos;
  // the ground: the soles' ground at the frame, a line across
  const gy = Math.min(s.feet.l.gBall, s.feet.r.gBall) - base[1];
  g += `<line x1="${x0 + 4}" y1="${P([0, gy])[1]}" x2="${x0 + w * 0.72}" y2="${P([0, gy])[1]}" stroke="#a98" stroke-width="1"/>`;
  for (const k of [-8, -4, 4, 8]) {
    const o = S[i + k];
    if (!o) continue;
    const wp = (n) => side([o.joints[J[n]][0] + o.pos[0], o.joints[J[n]][1] + o.pos[1], o.joints[J[n]][2] + o.pos[2]], base);
    for (const [a, b] of LINES) { const A = P(wp(a)), B = P(wp(b)); g += `<line x1="${A[0].toFixed(1)}" y1="${A[1].toFixed(1)}" x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}" stroke="${k < 0 ? '#9ab' : '#cba'}" stroke-width="1"/>`; }
  }
  const wp = (n) => side([s.joints[J[n]][0] + s.pos[0], s.joints[J[n]][1] + s.pos[1], s.joints[J[n]][2] + s.pos[2]], base);
  for (const [a, b] of LINES) {
    const A = P(wp(a)), B = P(wp(b)), col = a.endsWith('_l') || b.endsWith('_l') ? '#246' : a.endsWith('_r') || b.endsWith('_r') ? '#a33' : '#222';
    g += `<line x1="${A[0].toFixed(1)}" y1="${A[1].toFixed(1)}" x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}" stroke="${col}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  const hp = P(wp('Head'));
  g += `<circle cx="${hp[0].toFixed(1)}" cy="${hp[1].toFixed(1)}" r="${(0.1 * sc).toFixed(1)}" fill="none" stroke="#222" stroke-width="2"/>`;
  // from above: the balls' trails over ±15 frames round the frame, in the body's frame (forward up the panel)
  const tx = x0 + w * 0.86, ty = y0 + h * 0.45, ts = h * 0.32;
  const r = [Math.cos(hd), 0, -Math.sin(hd)];
  const top = (p) => [tx - ((p[0] - base[0]) * r[0] + (p[2] - base[2]) * r[2]) * ts, ty - ((p[0] - base[0]) * f[0] + (p[2] - base[2]) * f[2]) * ts];
  g += `<rect x="${x0 + w * 0.72}" y="${y0 + 4}" width="${w * 0.27}" height="${h * 0.82}" fill="#fff" stroke="#ddd"/>`;
  for (const [side_, col] of [['l', '#246'], ['r', '#a33']]) {
    let d = '';
    for (let k = -15; k <= 15; k++) {
      const o = S[i + k];
      if (!o) continue;
      const q = top(o.feet[side_].ball);
      d += `${d ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`;
      if (o.feet[side_].held) g += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="1.6" fill="${col}"/>`;
    }
    g += `<path d="${d}" fill="none" stroke="${col}" stroke-width="1"/>`;
    const q = top(s.feet[side_].ball);
    g += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3.5" fill="none" stroke="${col}" stroke-width="1.5"/>`;
  }
  g += `<text x="${x0 + w * 0.735}" y="${y0 + h * 0.84}" font-size="9" fill="#777">from above, ±0.25 s (• held)</text>`;
  g += `<text x="${x0 + 6}" y="${y0 + 14}" font-size="11" fill="#222">t ${s.t.toFixed(2)} s · ${esc(s.tag)} · ${Math.hypot(s.vel[0], s.vel[2]).toFixed(1)} m/s${s.mm?.w > 0.5 ? ` · ${esc(s.mm.clip)}` : ''}${s.move ? ` · ${esc(s.move)}` : ''}</text>`;
  g += `<text x="${x0 + 6}" y="${y0 + h - 6}" font-size="11" fill="#900">${esc(what)}</text>`;
  return g;
}

/** The sheet: a title and the worst frames ({ i, what }), three across. */
export function sheetSVG(title, S, worst) {
  const C = 3, w = 380, h = 250, rows = Math.max(1, Math.ceil(worst.length / C));
  let g = `<svg xmlns="http://www.w3.org/2000/svg" width="${C * w}" height="${rows * h + 28}" font-family="sans-serif">`;
  g += `<rect width="100%" height="100%" fill="#f4ecdf"/><text x="8" y="19" font-size="15" font-weight="bold">${esc(title)}: the worst frames${worst.length ? '' : ' (none over a limit)'}</text>`;
  worst.forEach((x, k) => { g += panel(S, x.i, x.what, (k % C) * w, 28 + Math.floor(k / C) * h, w, h); });
  return `${g}</svg>\n`;
}

// The Lens Vault's visor (issue #382): what the traveller's eyes see over the world, in the game's ink and paper, not
// sci-fi chrome. The lens's rim (ink corner brackets, the arm's or the lens's tab at the top), his hearts at the top
// left, the reticle (a ring broken at its four points round a dot, the charge's gold ring round it), the lock's coral
// brackets and LOCK, and with the lens up: a teal wash at the edges, a diamond over each thing it can read (hollow once
// read), the reading's ring, and the reading itself at the bottom left (a dark card: the thing's name over its line).
//
// The model (visorPart) is the screen's 'visor' part (src/platform.js), in CSS px of a W × H screen: the page draws it
// on a canvas (drawVisor), an engine from the part (unity BridgeHud.Games.cs DrawVisor). Pure but for the canvas.

export const INK = '#2b211f', PAPER = '#f7ecd2', CORAL = '#ef9479', TEAL = '#71d7cf', GOLD = '#f2c54b', RED = '#d9643a';
/** The reticle's and the rim's measures (CSS px). */
export const RET = { r: 11, gap: 0.32, dot: 2.2, charge: 6, rim: 22, arm: 46 };
const r1 = (v) => Math.round(v * 10) / 10;

/**
 * The visor's part from the run's state: W, H the screen; S: { mode ('arm' | 'lens'), hearts, max, charge, lock: {x, y,
 * r} | null (screen px), marks: [{ x, y, read }], scan (0..1), read: { name, text, on, n } | null, red (0..1), room }.
 */
export function visorPart(W, H, S) {
  const k = Math.max(0, Math.min(1, S.charge ?? 0)), full = k >= 1;
  const hot = S.lock ? CORAL : S.mode === 'lens' ? TEAL : PAPER;
  return {
    W: Math.round(W), H: Math.round(H), mode: S.mode,
    hp: { n: Math.round((S.hearts ?? 0) * 4) / 4, max: S.max ?? 3 },
    ret: { x: r1(W / 2), y: r1(H / 2), r: RET.r, gap: RET.gap, dot: RET.dot, hot, charge: Math.round(k * 100) / 100, full, scan: Math.round((S.scan ?? 0) * 100) / 100 },
    lock: S.lock ? { x: r1(S.lock.x), y: r1(S.lock.y), r: r1(Math.max(14, S.lock.r)) } : null,
    marks: S.mode === 'lens' ? (S.marks ?? []).map((m) => ({ x: r1(m.x), y: r1(m.y), read: !!m.read })) : [],
    read: S.read ?? null,
    red: Math.round((S.red ?? 0) * 100) / 100,
    room: S.room ?? '',
  };
}

/** The visor drawn on a 2D canvas context (CSS px, the context scaled to the device's pixels already). */
export function drawVisor(g, M) {
  const { W, H } = M;
  g.clearRect(0, 0, W, H);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const inked = (draw, lw, c) => { g.strokeStyle = INK; g.lineWidth = lw + 2.4; draw(); g.strokeStyle = c; g.lineWidth = lw; draw(); };
  // the lens up: a teal wash in from the edges
  if (M.mode === 'lens') {
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    v.addColorStop(0, 'rgba(113, 215, 207, 0)'); v.addColorStop(1, 'rgba(113, 215, 207, 0.32)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }
  // the rim: four ink brackets in the corners, the tab at the top saying which of the arm and the lens is up
  const c = RET.rim, a = RET.arm, rim = M.mode === 'lens' ? TEAL : PAPER;
  for (const [x, y, sx, sy] of [[c, c, 1, 1], [W - c, c, -1, 1], [c, H - c, 1, -1], [W - c, H - c, -1, -1]]) {
    inked(() => { g.beginPath(); g.moveTo(x, y + sy * a); g.lineTo(x, y); g.lineTo(x + sx * a, y); g.stroke(); }, 2.4, rim);
  }
  // his hearts, top left: diamonds filled by the quarter; under them the tab saying which of the arm and the lens is up
  const hp = M.hp, hx = c + 18, hy = c + 22;
  for (let i = 0; i < hp.max; i++) {
    const x = hx + i * 30, fill = Math.max(0, Math.min(1, hp.n - i));
    const dia = () => { g.beginPath(); g.moveTo(x, hy - 12); g.lineTo(x + 10, hy); g.lineTo(x, hy + 12); g.lineTo(x - 10, hy); g.closePath(); };
    dia(); g.fillStyle = 'rgba(43, 33, 31, 0.45)'; g.fill();
    if (fill > 0) { g.save(); dia(); g.clip(); g.fillStyle = hp.n <= 1 ? RED : CORAL; g.fillRect(x - 11, hy + 12 - 24 * fill, 22, 24 * fill); g.restore(); }
    dia(); g.strokeStyle = INK; g.lineWidth = 2.6; g.stroke();
  }
  const tab = M.mode === 'lens' ? 'LENS' : 'ARM', tx = c + 8, ty = hy + 22, tw = 56;
  g.font = `700 11px Futura, 'Avenir Next', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = INK; g.fillRect(tx - 2, ty - 2, tw + 4, 22);
  g.fillStyle = rim; g.fillRect(tx, ty, tw, 18);
  g.fillStyle = INK; g.fillText(tab, tx + tw / 2, ty + 9.5);
  // what the lens can read: a diamond over each, hollow once read
  for (const m of M.marks) {
    const d = () => { g.beginPath(); g.moveTo(m.x, m.y - 7); g.lineTo(m.x + 6, m.y); g.lineTo(m.x, m.y + 7); g.lineTo(m.x - 6, m.y); g.closePath(); };
    d(); if (!m.read) { g.fillStyle = TEAL; g.fill(); }
    g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    if (m.read) { d(); g.strokeStyle = TEAL; g.lineWidth = 1; g.stroke(); }
  }
  // the lock: coral brackets round it, LOCK under them
  if (M.lock) {
    const { x, y, r } = M.lock;
    const b = (sx, sy) => { g.beginPath(); g.moveTo(x + sx * r, y + sy * (r - 7)); g.lineTo(x + sx * r, y + sy * r); g.lineTo(x + sx * (r - 7), y + sy * r); g.stroke(); };
    for (const [lw, col] of [[5, INK], [2.4, CORAL]]) { g.lineWidth = lw; g.strokeStyle = col; b(-1, -1); b(1, -1); b(-1, 1); b(1, 1); }
    g.font = `700 10px Futura, 'Avenir Next', sans-serif`;
    g.lineWidth = 3; g.strokeStyle = INK; g.strokeText('LOCK', x, y + r + 11); g.fillStyle = CORAL; g.fillText('LOCK', x, y + r + 11);
  }
  // the reticle: a ring broken at its four points round a dot; the charge's gold ring, the reading's teal one
  const R = M.ret;
  inked(() => { for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(R.x, R.y, R.r, k * Math.PI / 2 + R.gap, (k + 1) * Math.PI / 2 - R.gap); g.stroke(); } }, 2.1, R.hot);
  g.beginPath(); g.arc(R.x, R.y, R.dot, 0, Math.PI * 2); g.fillStyle = R.hot; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
  for (const [k, col, extra] of [[R.charge, GOLD, 0], [R.scan, TEAL, 0]]) {
    if (!(k > 0)) continue;
    g.beginPath(); g.arc(R.x, R.y, R.r + RET.charge + extra, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k));
    g.strokeStyle = INK; g.lineWidth = 4.6; g.stroke(); g.strokeStyle = col; g.lineWidth = R.full && col === GOLD ? 2.6 : 2; g.stroke();
  }
  // the reading: a dark card at the bottom left, the thing's name over its line
  if (M.read?.on) {
    const x0 = 22, maxW = Math.min(440, W * 0.7);
    g.font = `15px 'Avenir Next', Futura, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const lines = wrapText(g, M.read.text, maxW - 24);
    const bh = 30 + lines.length * 20, y0 = H - 22 - bh;
    g.fillStyle = 'rgba(0, 0, 0, 0.35)'; g.fillRect(x0 + 4, y0 + 4, maxW, bh);
    g.fillStyle = INK; g.fillRect(x0, y0, maxW, bh);
    g.font = `700 10px Futura, 'Avenir Next', sans-serif`; g.fillStyle = TEAL; g.fillText(M.read.name.toUpperCase(), x0 + 12, y0 + 18);
    g.font = `15px 'Avenir Next', Futura, sans-serif`; g.fillStyle = PAPER;
    lines.forEach((l, i) => g.fillText(l, x0 + 12, y0 + 38 + i * 20));
  }
  // hurt: the edges flare red a moment
  if (M.red > 0) {
    const m = Math.max(W, H), v = g.createRadialGradient(W / 2, H / 2, m * 0.32, W / 2, H / 2, m * 0.72);
    v.addColorStop(0, 'rgba(217, 70, 40, 0)'); v.addColorStop(1, `rgba(217, 70, 40, ${0.7 * M.red})`);
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }
}

/** A line broken into the lines that fit maxW (the canvas' measure). */
function wrapText(g, text, maxW) {
  const out = []; let line = '';
  for (const w of String(text ?? '').split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (line && g.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/** A 2D context that draws nothing (an engine: the visor is the screen's part there). */
export const NO_CANVAS = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 0 }) : () => {}), set: () => true });

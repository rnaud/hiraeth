import * as THREE from 'three';

// Little hand-drawn things for the ship's walls, painted on canvases in the
// game's ink-and-flat-colour look: a child's drawing of the family, the
// mother's note in the galley, a photo of home, the star chart.
// (In node, for tests, there is no canvas: every function returns null.)

const INK = '#2b211f', PAPER = '#f7ecd2';
export const hasCanvas = () => typeof document !== 'undefined' && !!document.createElement;

export function canvasTexture(w, h, draw) {
  if (!hasCanvas()) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.canvas = c;
  return t;
}

const wobblyLine = (g, pts, w = 3) => {
  g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
};

/** A child's crayon drawing: a round ship and three people under two moons, signed. */
export const familyDrawing = () => canvasTexture(256, 192, (g, w, h) => {
  g.fillStyle = '#fbf4e2'; g.fillRect(0, 0, w, h);
  g.strokeStyle = INK;
  // the round ship with its belt and legs
  g.fillStyle = '#f1e8d4'; g.beginPath(); g.arc(70, 78, 42, 0, Math.PI * 2); g.fill(); g.lineWidth = 3; g.stroke();
  g.fillStyle = '#d9643a'; g.fillRect(28, 74, 84, 8); g.strokeRect(28, 74, 84, 8);
  wobblyLine(g, [[44, 112], [34, 134]]); wobblyLine(g, [[96, 112], [106, 134]]);
  wobblyLine(g, [[70, 36], [70, 18]]); g.fillStyle = '#c8483a'; g.beginPath(); g.arc(70, 16, 4, 0, 7); g.fill();
  g.fillStyle = '#5fb7ad'; for (const x of [56, 84]) { g.beginPath(); g.arc(x, 60, 6, 0, 7); g.fill(); g.stroke(); }
  // two moons
  g.fillStyle = '#f2c54b'; g.beginPath(); g.arc(214, 30, 14, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#e9998a'; g.beginPath(); g.arc(186, 22, 7, 0, 7); g.fill(); g.stroke();
  // three people, holding hands: tall (father), round hair bun (mother), small (me)
  const person = (x, top, hgt, col, extra) => {
    g.fillStyle = '#e9b9a0'; g.beginPath(); g.arc(x, top, hgt * 0.16, 0, 7); g.fill(); g.lineWidth = 2.5; g.stroke();
    g.fillStyle = col; g.beginPath(); g.moveTo(x, top + hgt * 0.16); g.lineTo(x - hgt * 0.22, top + hgt * 0.75); g.lineTo(x + hgt * 0.22, top + hgt * 0.75); g.closePath(); g.fill(); g.stroke();
    wobblyLine(g, [[x - 6, top + hgt * 0.75], [x - 7, top + hgt]], 2.5); wobblyLine(g, [[x + 6, top + hgt * 0.75], [x + 7, top + hgt]], 2.5);
    extra?.(x, top, hgt);
  };
  person(150, 92, 86, '#34405e', (x, t) => { g.fillStyle = INK; g.fillRect(x - 10, t - 16, 20, 5); });   // the father's hat
  person(190, 104, 74, '#c8483a', (x, t) => { g.fillStyle = '#8a5638'; g.beginPath(); g.arc(x, t - 12, 7, 0, 7); g.fill(); });
  person(226, 132, 46, '#5fb7ad');
  wobblyLine(g, [[166, 128], [176, 132]], 2); wobblyLine(g, [[204, 136], [216, 146]], 2);
  // ground line and the signature
  g.strokeStyle = '#c9a27a'; wobblyLine(g, [[8, 182], [248, 180]], 3);
  g.fillStyle = INK; g.font = 'bold 15px ui-monospace, Menlo, monospace'; g.fillText('US', 16, 176);
});

/** The mother's note, pinned in the galley. */
export const motherNote = () => canvasTexture(192, 160, (g, w, h) => {
  g.fillStyle = '#fff6dc'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e9998a'; g.fillRect(0, 0, w, 14);
  g.fillStyle = INK; g.font = '15px ui-monospace, Menlo, monospace';
  ['Eat something warm.', 'Sleep in the bunk,', 'not in the chair.', '', 'We are proud of you', 'already.', '            — M.'].forEach((l, i) => g.fillText(l, 12, 36 + i * 18));
  g.strokeStyle = '#c8483a'; g.lineWidth = 2; g.beginPath(); g.arc(160, 132, 9, 0, Math.PI * 2); g.stroke();   // a little heart-ish circle
});

/** A faded photo of home: the parents in front of the house under two moons. */
export const homePhoto = () => canvasTexture(192, 144, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#93a6cf'); grd.addColorStop(0.6, '#f2c49a'); grd.addColorStop(1, '#d9a477');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2c54b'; g.beginPath(); g.arc(150, 30, 13, 0, 7); g.fill();
  g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(122, 22, 6, 0, 7); g.fill();
  g.fillStyle = '#efe2c8'; g.beginPath(); g.ellipse(52, 104, 40, 30, 0, Math.PI, 0); g.fill();   // a domed house
  g.fillStyle = '#34405e'; g.fillRect(46, 92, 12, 12);
  g.fillStyle = '#2b211f';
  for (const [x, hh, wid] of [[110, 62, 13], [136, 52, 12]]) { g.beginPath(); g.arc(x, 136 - hh, wid * 0.55, 0, 7); g.fill(); g.fillRect(x - wid / 2, 136 - hh + 6, wid, hh - 6); }
  g.strokeStyle = PAPER; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
});

/** A star chart pinned in the cockpit: rings, a dotted route, worlds as circles. */
export const starChart = () => canvasTexture(256, 192, (g, w, h) => {
  g.fillStyle = '#efe3c6'; g.fillRect(0, 0, w, h);
  g.strokeStyle = INK; g.lineWidth = 1.2;
  for (const r of [30, 55, 80, 105]) { g.beginPath(); g.ellipse(128, 96, r * 1.2, r * 0.7, -0.2, 0, 7); g.stroke(); }
  g.setLineDash([3, 4]); g.strokeStyle = '#c8483a'; g.lineWidth = 2;
  wobblyLine(g, [[30, 160], [70, 120], [110, 130], [150, 80], [200, 60], [232, 28]], 2);
  g.setLineDash([]);
  const cols = ['#d9a477', '#5fb7ad', '#f2ead6', '#e6875f', '#8a6fb8', '#7fa86a'];
  [[30, 160], [70, 120], [110, 130], [150, 80], [200, 60], [232, 28]].forEach(([x, y], i) => { g.fillStyle = cols[i]; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke(); });
  g.fillStyle = INK; g.font = '11px ui-monospace, Menlo, monospace'; g.fillText('HOME', 210, 182); g.fillText('?', 240, 24);
});

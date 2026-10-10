import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { mulberry32 } from '../noise.js';

// Lou's drawings (src/story/home-data.js says what each one is): crayon on
// paper, one for every world you have written to her from, pinned on the wall
// of the small house (src/levels/home-houses.js); and the photo in the round
// house. Painted once on a canvas each; without a DOM (the tests) they are
// plain paper.

const W = 256, H = 192;
const PAPER = '#f7ecd2';
const cache = new Map();

/** The worlds Lou has drawn (her drawing of each: see paint()). */
export const DRAWN = ['desert', 'incal', 'arzach', 'arzach2', 'garage', 'glassdunes', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar', 'underwater', 'moonfoundry', 'spacecity'];

function crayon(ctx, rng) {
  // a wobbly crayon line: each stroke drawn twice, a hair apart
  const line = (pts, color, w = 5) => {
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = color; ctx.lineWidth = w * (pass ? 0.6 : 1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalAlpha = pass ? 0.55 : 0.9;
      ctx.beginPath();
      pts.forEach(([x, y], i) => { const jx = x + (rng() - 0.5) * 2.5, jy = y + (rng() - 0.5) * 2.5; if (i) ctx.lineTo(jx, jy); else ctx.moveTo(jx, jy); });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  const scribble = (x, y, w, h, color) => {
    // filled the way a child fills: back and forth
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.globalAlpha = 0.6; ctx.beginPath();
    for (let k = 0; k <= h; k += 4) { ctx.moveTo(x + rng() * 4, y + k); ctx.lineTo(x + w - rng() * 4, y + k + (rng() - 0.5) * 3); }
    ctx.stroke(); ctx.globalAlpha = 1;
  };
  const circle = (x, y, r, color, fill = null, w = 5) => {
    const pts = [];
    for (let a = 0; a <= Math.PI * 2 + 0.3; a += 0.3) pts.push([x + Math.cos(a) * r * (1 + (rng() - 0.5) * 0.08), y + Math.sin(a) * r]);
    if (fill) { ctx.fillStyle = fill; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(x, y, r * 0.95, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    line(pts, color, w);
  };
  // a stick figure: the traveller in his hood (big), or anyone
  const person = (x, y, s, color, hood = false) => {
    circle(x, y - 34 * s, 8 * s, color, null, 4);
    line([[x, y - 26 * s], [x, y - 6 * s]], color, 4);
    line([[x - 10 * s, y - 20 * s], [x, y - 16 * s], [x + 10 * s, y - 20 * s]], color, 4);
    line([[x - 8 * s, y + 6 * s], [x, y - 6 * s], [x + 8 * s, y + 6 * s]], color, 4);
    if (hood) line([[x - 9 * s, y - 34 * s], [x, y - 52 * s], [x + 9 * s, y - 34 * s]], '#c8483a', 4);
  };
  return { line, scribble, circle, person };
}

/** Paint one drawing on a canvas context. */
function paint(ctx, kind) {
  const rng = mulberry32([...kind].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) >>> 0);
  const { line, scribble, circle, person } = crayon(ctx, rng);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const sun = (x, y) => { circle(x, y, 16, '#e8a33a', '#f2c54b'); for (let a = 0; a < 6.3; a += 0.8) line([[x + Math.cos(a) * 22, y + Math.sin(a) * 22], [x + Math.cos(a) * 30, y + Math.sin(a) * 30]], '#e8a33a', 4); };
  const ground = (color, y = 160) => { scribble(0, y, W, H - y, color); };
  switch (kind) {
    case 'desert':   // the giants who carried the water, lying down; a sun
      ground('#e6b86a', 150); sun(210, 40);
      line([[30, 150], [60, 110], [110, 100], [150, 115], [175, 150]], '#8a5a3c', 6);
      circle(62, 100, 16, '#8a5a3c');
      line([[90, 100], [100, 70], [96, 50]], '#5fb7ad', 5);
      person(205, 150, 0.9, '#2b211f', true);
      break;
    case 'incal':   // the shaft: lamps all the way down, and someone looking up
      scribble(70, 0, 116, H, '#9a8fb8');
      for (let y = 20; y < 180; y += 30) { circle(80 + (y % 60), y, 6, '#e8a33a', '#f2c54b', 3); circle(170 - (y % 60), y + 12, 6, '#e8a33a', '#f2c54b', 3); }
      line([[70, 0], [70, H]], '#2b211f', 5); line([[186, 0], [186, H]], '#2b211f', 5);
      person(128, 175, 0.8, '#2b211f', true);
      line([[128, 120], [128, 100]], '#c8483a', 3);
      break;
    case 'arzach':   // the bird, big as the house, and you on her back
      ground('#e3c58f', 165);
      line([[30, 100], [90, 70], [128, 90], [170, 60], [230, 90]], '#2b211f', 7);
      circle(128, 96, 22, '#2b211f', '#f3ead8');
      line([[148, 92], [170, 100], [150, 104]], '#e8a33a', 5);
      person(122, 76, 0.55, '#2b211f', true);
      break;
    case 'arzach2':   // stones in the sky and a bell
      for (const [x, y, r] of [[50, 60, 22], [130, 40, 30], [205, 75, 20]]) { circle(x, y, r, '#6e7d8c', '#b9a3c9'); line([[x - r * 0.6, y + r], [x, y + r + 14], [x + r * 0.6, y + r]], '#5f9e8a', 4); }
      line([[110, 130], [128, 112], [146, 130], [140, 150], [116, 150], [110, 130]], '#c9a35a', 6);
      circle(128, 156, 5, '#c9a35a', '#c9a35a', 3);
      break;
    case 'garage':   // the Major's machine, with a big wheel
      ground('#a8a8a8', 165);
      circle(90, 110, 40, '#2b211f'); for (let a = 0; a < 6.3; a += 1.05) line([[90, 110], [90 + Math.cos(a) * 40, 110 + Math.sin(a) * 40]], '#2b211f', 4);
      scribble(140, 80, 80, 60, '#c8553d'); line([[140, 80], [220, 80], [220, 140], [140, 140], [140, 80]], '#2b211f', 5);
      person(200, 165, 0.7, '#2b211f', true);
      break;
    case 'glassdunes':   // green glass waves over the sand, and the round clock house with its clock
      ground('#e3c58f', 160);
      for (const [x0, h] of [[10, 70], [150, 90]]) line([[x0, 160], [x0 + 30, 160 - h], [x0 + 70, 160 - h * 0.7], [x0 + 95, 160]], '#5fbf9f', 7);
      line([[100, 160], [100, 110], [140, 110], [140, 160]], '#2b211f', 5);
      circle(120, 96, 14, '#d2a648', '#f3ead8', 4);
      line([[120, 96], [120, 86]], '#2b211f', 3); line([[120, 96], [128, 96]], '#2b211f', 3);
      sun(220, 36);
      break;
    case 'buried':   // the great wheel's teeth, and a lamp underground
      scribble(0, 0, W, H, '#8a6a5a');
      for (let k = 0; k < 9; k++) { const a = k * 0.7; line([[128 + Math.cos(a) * 60, 110 + Math.sin(a) * 60], [128 + Math.cos(a) * 80, 110 + Math.sin(a) * 80]], '#a8582f', 9); }
      circle(128, 110, 60, '#a8582f');
      circle(40, 40, 10, '#f2c54b', '#ffe6b0', 4);
      break;
    case 'edena':   // the garden over the ships: flowers, a white pyramid
      ground('#7fb069', 140);
      line([[150, 140], [185, 70], [220, 140], [150, 140]], '#9aa6b2', 5);
      for (let x = 20; x < 140; x += 22) { line([[x, 160], [x + 3, 125]], '#4f6b34', 4); circle(x + 3, 120, 7, '#c8483a', ['#f2a7b5', '#f2c54b', '#b9a3c9'][x % 3]); }
      sun(40, 40);
      break;
    case 'spheres':   // big round spheres on the plain, one on the horizon
      ground('#e3c58f', 150);
      circle(70, 115, 34, '#2b211f', '#f3ead8'); circle(150, 125, 22, '#2b211f', '#5fb7ad'); circle(215, 140, 12, '#2b211f', '#f2a7b5');
      circle(200, 50, 40, '#9aa6b2');
      break;
    case 'perdide':   // rain over the wood, and the crystal
      scribble(0, 0, W, 60, '#9aa6b2');
      for (let k = 0; k < 14; k++) { const x = rng() * W, y = 60 + rng() * 80; line([[x, y], [x - 4, y + 12]], '#5f8fb8', 3); }
      line([[128, 170], [110, 100], [128, 60], [146, 100], [128, 170]], '#a99be0', 6);
      ground('#4f6b34', 172);
      break;
    case 'perdide2':   // three lamps in the deep wood
      scribble(0, 0, W, H, '#3f5a44');
      for (const x of [70, 128, 186]) { line([[x, 170], [x, 110]], '#2b211f', 5); circle(x, 100, 12, '#e8a33a', '#ffe6b0'); }
      break;
    case 'bazaar':   // the tower with its antenna, the signs, the crowd
      line([[118, 175], [124, 40], [132, 40], [138, 175]], '#2b211f', 6);
      line([[128, 40], [128, 14]], '#2b211f', 4); circle(128, 12, 6, '#c8483a', '#e6503a', 3);
      for (const [x, y] of [[40, 70], [190, 60], [60, 120], [200, 120]]) { scribble(x, y, 40, 22, '#f2c54b'); line([[x, y], [x + 40, y], [x + 40, y + 22], [x, y + 22], [x, y]], '#c8483a', 4); }
      for (let x = 20; x < 240; x += 26) circle(x, 172, 7, '#2b211f');
      break;
    case 'underwater':   // the city in bubbles at the bottom of the sea, a whale at the window
      scribble(0, 0, W, H, '#2a7fae');
      ground('#3f8088', 168);
      for (const [x, r] of [[70, 34], [150, 26], [210, 20]]) { circle(x, 168, r, '#bfe8ee'); line([[x - 6, 168], [x - 6, 152], [x + 6, 152], [x + 6, 168]], '#e08a5a', 4); }
      line([[20, 60], [70, 48], [120, 58], [140, 50], [130, 64], [70, 72], [20, 60]], '#5a7f96', 7);
      circle(40, 58, 3, '#2b211f', '#2b211f', 3);
      for (const [x, y] of [[180, 40], [190, 26], [200, 14]]) circle(x, y, 4, '#e9fbff', null, 3);
      break;
    case 'moonfoundry':   // moons hung on hooks under a roof, one in the claws
      line([[10, 20], [246, 20]], '#7a5a4a', 7);
      for (const [x, r] of [[60, 26], [140, 20], [205, 30]]) { line([[x, 20], [x, 80 - r]], '#2b211f', 3); circle(x, 80, r, '#2b211f', '#efe4cc'); circle(x - r * 0.3, 74, r * 0.2, '#c9a888', null, 3); }
      ground('#c9703e', 160);
      person(110, 160, 0.7, '#2b211f', true);
      break;
    case 'spacecity':   // islands in the dark with little houses, tied together with string
      scribble(0, 0, W, H, '#1a1e2e');
      for (const [x, y, w] of [[50, 80, 60], [150, 110, 70], [215, 60, 46]]) { line([[x - w / 2, y], [x + w / 2, y], [x, y + 30], [x - w / 2, y]], '#f4b49a', 6); circle(x, y - 10, 9, '#f2e2c4', '#f2e2c4', 4); }
      line([[80, 80], [115, 110]], '#f6efd0', 3); line([[185, 110], [200, 60]], '#f6efd0', 3);
      for (let k = 0; k < 12; k++) circle(rng() * W, rng() * 50, 2, '#f6f2e4', '#f6f2e4', 2);
      circle(220, 160, 30, '#f2e6cc');
      break;
    case 'family':   // the one she made for the stone: the round house, the two of them, the two of you
      ground('#eebd8e', 150);
      line([[30, 150], [40, 100], [80, 80], [120, 100], [130, 150]], '#2b211f', 5); circle(78, 108, 12, '#34405e', '#4a5a8a', 4);
      circle(200, 30, 12, '#e8a33a', '#f6efd0', 4); circle(222, 42, 6, '#e8a33a', '#f2c54b', 3);
      person(150, 160, 0.95, '#2b211f'); person(178, 160, 0.95, '#2b211f');
      person(208, 160, 0.95, '#2b211f', true); person(232, 166, 0.6, '#c8483a');
      break;
    case 'photo': {   // the photo in the round house: the two of them, and you at seven, scowling
      ctx.fillStyle = '#c9b48f'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e9dcc0'; ctx.beginPath(); ctx.ellipse(128, 150, 120, 90, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#4a3a2a';
      for (const [x, h, r] of [[88, 120, 14], [168, 112, 13], [128, 70, 10]]) {
        ctx.beginPath(); ctx.arc(x, H - h - r, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x - r, H - h, r * 2, h);
      }
      ctx.fillStyle = 'rgba(80,60,40,0.25)'; ctx.fillRect(0, 0, W, H);
      return;
    }
    default:
      sun(128, 90);
  }
}

/** The material for a drawing (a world's id, 'family', 'photo'): crayon on paper, painted once. */
export function drawingMaterial(kind) {
  if (cache.has(kind)) return cache.get(kind);
  let m;
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    paint(c.getContext('2d'), kind);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    m = makeMaterial({ color: '#ffffff', map: tex, flat: true, glow: 0.12, side: THREE.DoubleSide });
  } else m = makeMaterial({ color: PAPER, flat: true, side: THREE.DoubleSide });
  cache.set(kind, m);
  return m;
}

/** A drawing on its sheet of paper (w × h m), a little curled. */
export function drawingMesh(kind, w = 0.42, h = 0.32) {
  const g = new THREE.PlaneGeometry(w, h, 4, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.pow(Math.abs(p.getX(i)) / (w / 2), 2) * 0.012);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, drawingMaterial(kind));
  mesh.name = `drawing ${kind}`;
  mesh.userData.noCollide = true;
  return mesh;
}

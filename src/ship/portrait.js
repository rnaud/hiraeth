import * as THREE from 'three';
import { hasCanvas } from './art.js';

// The call screen: the father (and, later, the mother) drawn live on a
// canvas in the game's print look (flat colour, heavy ink contour, a few
// hatch strokes on the shadow side), with a talking mouth, blinks, a slow
// breathing bob, scanlines, and static that can swallow the picture.

const INK = '#2b211f';

export class CallScreen {
  constructor(size = 384) {
    this.size = size;
    this.state = { who: 'off', talk: 0, statik: 0, t: 0, speaker: 'father', crack: 0, power: 1 };
    if (!hasCanvas()) { this.texture = null; return; }
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.noise = document.createElement('canvas');
    this.noise.width = this.noise.height = 96;
    this.draw();
  }

  /** who: 'off' | 'idle' (a dim standby glyph) | 'locked' (NO POWER) | 'father' | 'both' | 'map' */
  set(o) { Object.assign(this.state, o); }

  update(dt) {
    if (!this.g) return;
    this.state.t += dt;
    this._acc = (this._acc ?? 0) + dt;
    if (this._acc < 1 / 30) return;   // 30 fps is plenty for a screen
    this._acc = 0;
    this.draw();
    this.texture.needsUpdate = true;
  }

  draw() {
    const g = this.g, S = this.size, s = this.state, t = s.t;
    g.save();
    g.fillStyle = '#18222e';
    g.fillRect(0, 0, S, S);
    if (s.who === 'off' || s.power <= 0) { g.restore(); return; }
    if (s.who === 'idle' || s.who === 'locked' || s.who === 'map') this.drawStandby(g, S, s);
    else this.drawRoom(g, S, s);
    // scanlines and a rolling bright band
    g.globalAlpha = 0.16;
    g.fillStyle = '#000';
    for (let y = 0; y < S; y += 4) g.fillRect(0, y, S, 1.5);
    g.globalAlpha = 0.08;
    g.fillStyle = '#fff6dc';
    g.fillRect(0, ((t * 60) % (S + 60)) - 60, S, 26);
    g.globalAlpha = 1;
    if (s.statik > 0) this.drawStatic(g, S, s.statik);
    if (s.crack > 0) this.drawCrack(g, S, s.crack);
    g.restore();
  }

  drawStandby(g, S, s) {
    const t = s.t;
    g.fillStyle = s.who === 'locked' ? '#3a1f22' : '#1f3440';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = s.who === 'locked' ? '#e6503a' : '#5fd0c6';
    g.lineWidth = 3;
    const c = S / 2, pulse = 0.5 + 0.5 * Math.sin(t * 3);
    if (s.who === 'locked') {
      g.globalAlpha = 0.6 + 0.4 * pulse;
      g.font = `bold ${S * 0.11}px ui-monospace, Menlo, monospace`;
      g.textAlign = 'center'; g.fillStyle = '#e6503a';
      g.fillText('NO POWER', c, c + S * 0.04);
      g.font = `${S * 0.05}px ui-monospace, Menlo, monospace`;
      g.fillText('find a new source', c, c + S * 0.14);
      g.globalAlpha = 1;
      return;
    }
    // a slowly turning star chart: rings and the route
    for (const r of [0.14, 0.24, 0.34]) { g.beginPath(); g.ellipse(c, c, S * r * 1.15, S * r * 0.7, 0.3 + t * 0.05, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#f2c54b';
    for (let i = 0; i < 6; i++) { const a = i * 1.1 + t * 0.2, r = S * (0.12 + i * 0.04); g.beginPath(); g.arc(c + Math.cos(a) * r * 1.1, c + Math.sin(a) * r * 0.65, 5, 0, 7); g.fill(); }
    g.font = `${S * 0.05}px ui-monospace, Menlo, monospace`;
    g.textAlign = 'center'; g.fillStyle = '#9fe0d6';
    g.fillText(s.who === 'map' ? 'GALACTIC MAP' : 'E · CONSOLE', c, S * 0.86);
  }

  drawRoom(g, S, s) {
    const t = s.t;
    // home: a dusky room, a round window with two moons, a lamp
    g.fillStyle = '#4a5a8a'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#7f8fc8'; g.beginPath(); g.arc(S * 0.5, S * 0.32, S * 0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2c49a'; g.fillRect(0, S * 0.42, S, S * 0.2);
    g.fillStyle = '#f2c54b'; g.beginPath(); g.arc(S * 0.66, S * 0.2, S * 0.05, 0, 7); g.fill();
    g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(S * 0.56, S * 0.14, S * 0.025, 0, 7); g.fill();
    g.strokeStyle = INK; g.lineWidth = S * 0.012; g.beginPath(); g.arc(S * 0.5, S * 0.32, S * 0.3, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#34405e'; g.fillRect(0, S * 0.62, S, S * 0.38);
    const bob = Math.sin(t * 1.3) * S * 0.004;
    if (s.who === 'both') {
      this.drawFather(g, S * 0.33, S * 0.6 + bob, S * 0.78, s, s.speaker === 'father');
      this.drawMother(g, S * 0.7, S * 0.64 - bob, S * 0.74, s, s.speaker === 'mother');
    } else this.drawFather(g, S * 0.5, S * 0.58 + bob, S, s, true);
  }

  mouth(s, speaking) {
    if (!speaking || s.talk <= 0) return 0;
    const t = s.t;
    return Math.max(0, Math.sin(t * 17) * 0.5 + Math.sin(t * 7.3) * 0.35 + 0.25) * s.talk;
  }

  blink(s, seed) { const p = (s.t * 0.37 + seed) % 1; return p < 0.035 ? 1 : 0; }

  /** The father: long face, shaved head under a dark band, square grey beard, high cream collar. */
  drawFather(g, x, y, k, s, speaking) {
    const u = k / 384;
    const L = (fn) => { g.save(); g.translate(x, y); g.scale(u, u); fn(); g.restore(); };
    L(() => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      const ink = (w = 5) => { g.strokeStyle = INK; g.lineWidth = w; g.stroke(); };
      // shoulders and the high collar
      g.fillStyle = '#7a3a35';
      g.beginPath(); g.moveTo(-170, 210); g.quadraticCurveTo(-150, 60, -40, 40); g.lineTo(40, 40); g.quadraticCurveTo(150, 60, 170, 210); g.closePath(); g.fill(); ink();
      g.fillStyle = '#efe2c8';
      g.beginPath(); g.moveTo(-66, 70); g.lineTo(-58, -10); g.lineTo(-20, 30); g.lineTo(20, 30); g.lineTo(58, -10); g.lineTo(66, 70); g.lineTo(0, 92); g.closePath(); g.fill(); ink();
      g.fillStyle = '#d9643a'; g.beginPath(); g.arc(0, 104, 13, 0, 7); g.fill(); ink(4);
      // neck and head
      g.fillStyle = '#d9a98a';
      g.beginPath(); g.ellipse(0, -96, 64, 88, 0, 0, Math.PI * 2); g.fill(); ink();
      // shadow side + hatching
      g.save(); g.beginPath(); g.ellipse(0, -96, 64, 88, 0, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#b98a72'; g.beginPath(); g.ellipse(34, -90, 44, 92, 0.1, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.6;
      for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(30 + i * 5, -150 + i * 4); g.lineTo(50 + i * 5, -40 + i * 4); g.stroke(); }
      g.restore();
      // the head band and a top knot
      g.fillStyle = '#34405e'; g.beginPath(); g.moveTo(-63, -128); g.quadraticCurveTo(0, -150, 63, -128); g.lineTo(60, -112); g.quadraticCurveTo(0, -132, -60, -112); g.closePath(); g.fill(); ink(4);
      g.fillStyle = '#c9c2b4'; g.beginPath(); g.ellipse(0, -186, 16, 12, 0, 0, 7); g.fill(); ink(4);
      // brows (heavy, a little stern), eyes, long nose
      const blink = this.blink(s, 0.13);
      g.strokeStyle = INK; g.lineWidth = 7;
      g.beginPath(); g.moveTo(-46, -104); g.lineTo(-12, -98); g.stroke();
      g.beginPath(); g.moveTo(46, -104); g.lineTo(12, -98); g.stroke();
      g.fillStyle = INK;
      for (const ex of [-28, 28]) {
        if (blink) { g.lineWidth = 3; g.beginPath(); g.moveTo(ex - 9, -86); g.lineTo(ex + 9, -86); g.stroke(); }
        else { g.beginPath(); g.ellipse(ex, -86, 7, 4.5, 0, 0, 7); g.fill(); }
      }
      g.lineWidth = 4; g.beginPath(); g.moveTo(-2, -82); g.lineTo(-8, -46); g.lineTo(6, -42); g.stroke();
      // beard: square, grey, with a mouth opening in it
      g.fillStyle = '#c9c2b4';
      g.beginPath(); g.moveTo(-52, -52); g.quadraticCurveTo(-60, 10, -34, 20); g.lineTo(34, 20); g.quadraticCurveTo(60, 10, 52, -52); g.quadraticCurveTo(0, -30, -52, -52); g.fill(); ink(4);
      g.strokeStyle = '#8f877a'; g.lineWidth = 2;
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 12, -24); g.lineTo(i * 13, 12); g.stroke(); }
      const m = this.mouth(s, speaking);
      g.fillStyle = '#3a1f22';
      g.beginPath(); g.ellipse(0, -28, 18, 2 + m * 12, 0, 0, Math.PI * 2); g.fill(); ink(3);
      // moustache over it
      g.fillStyle = '#b3ab9c'; g.beginPath(); g.moveTo(-34, -32); g.quadraticCurveTo(0, -50, 34, -32); g.quadraticCurveTo(0, -40, -34, -32); g.fill(); ink(3);
    });
  }

  /** The mother: round face, hair wrapped in a teal cloth with a coral band, gold rings at the ears. */
  drawMother(g, x, y, k, s, speaking) {
    const u = k / 384;
    g.save(); g.translate(x, y); g.scale(u, u);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const ink = (w = 5) => { g.strokeStyle = INK; g.lineWidth = w; g.stroke(); };
    g.fillStyle = '#c8483a';
    g.beginPath(); g.moveTo(-150, 220); g.quadraticCurveTo(-130, 60, -30, 46); g.lineTo(30, 46); g.quadraticCurveTo(130, 60, 150, 220); g.closePath(); g.fill(); ink();
    g.fillStyle = '#f2c54b'; g.beginPath(); g.moveTo(-40, 50); g.quadraticCurveTo(0, 90, 40, 50); g.lineTo(30, 46); g.quadraticCurveTo(0, 74, -30, 46); g.fill(); ink(3);
    g.fillStyle = '#e8b896';
    g.beginPath(); g.ellipse(0, -70, 60, 70, 0, 0, Math.PI * 2); g.fill(); ink();
    g.save(); g.beginPath(); g.ellipse(0, -70, 60, 70, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#cf9c80'; g.beginPath(); g.ellipse(-36, -64, 36, 80, -0.1, 0, Math.PI * 2); g.fill();
    g.restore();
    // the wrap
    g.fillStyle = '#5fb7ad';
    g.beginPath(); g.moveTo(-64, -84); g.quadraticCurveTo(-74, -190, 0, -196); g.quadraticCurveTo(74, -190, 64, -84); g.quadraticCurveTo(0, -120, -64, -84); g.fill(); ink();
    g.fillStyle = '#e6875f'; g.beginPath(); g.moveTo(-62, -96); g.quadraticCurveTo(0, -130, 62, -96); g.lineTo(60, -110); g.quadraticCurveTo(0, -142, -60, -110); g.closePath(); g.fill(); ink(3);
    g.strokeStyle = '#f2c54b'; g.lineWidth = 5;
    for (const ex of [-62, 62]) { g.beginPath(); g.arc(ex, -46, 10, 0, Math.PI * 2); g.stroke(); }
    const blink = this.blink(s, 0.61);
    g.fillStyle = INK; g.strokeStyle = INK;
    for (const ex of [-24, 24]) {
      if (blink) { g.lineWidth = 3; g.beginPath(); g.moveTo(ex - 8, -72); g.lineTo(ex + 8, -72); g.stroke(); }
      else { g.beginPath(); g.ellipse(ex, -72, 6, 6, 0, 0, 7); g.fill(); }
      g.lineWidth = 3; g.beginPath(); g.arc(ex, -76, 12, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(0, -66); g.lineTo(-5, -46); g.lineTo(4, -44); g.stroke();
    const m = this.mouth(s, speaking);
    g.fillStyle = '#7a2f2a';
    g.beginPath(); g.ellipse(0, -26, 14, 2 + m * 9, 0, 0, Math.PI * 2); g.fill(); ink(3);
    g.lineWidth = 2.5; g.beginPath(); g.arc(0, -34, 20, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();   // a small smile
    g.restore();
  }

  drawStatic(g, S, k) {
    const n = this.noise, ng = n.getContext('2d');
    const img = ng.createImageData(n.width, n.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() < 0.5 ? 30 + Math.random() * 40 : 190 + Math.random() * 60;
      img.data[i] = img.data[i + 1] = v; img.data[i + 2] = v * 0.95; img.data[i + 3] = 255;
    }
    ng.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false;
    // torn horizontal bands first, then the snow over everything
    for (let k2 = 0; k2 < 6; k2++) {
      const y = Math.random() * S, h = 6 + Math.random() * 26;
      g.drawImage(this.canvas, 0, y, S, h, (Math.random() - 0.5) * 60 * k, y, S, h);
    }
    g.globalAlpha = Math.min(1, k);
    g.drawImage(n, 0, 0, S, S);
    g.globalAlpha = 1;
  }

  drawCrack(g, S, k) {
    g.strokeStyle = '#f7ecd2'; g.lineWidth = 2.5; g.globalAlpha = Math.min(1, k);
    const c = [S * 0.62, S * 0.4];
    for (let i = 0; i < 7; i++) {
      g.beginPath(); g.moveTo(c[0], c[1]);
      let x = c[0], y = c[1];
      const a = i * 0.9 + 0.3;
      for (let j = 0; j < 5; j++) { x += Math.cos(a + Math.sin(j * 3 + i) * 0.4) * S * 0.09; y += Math.sin(a + Math.cos(j * 2 + i) * 0.4) * S * 0.09; g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
  }
}

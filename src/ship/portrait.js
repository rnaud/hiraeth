import * as THREE from 'three';
import { hasCanvas } from './art.js';

// The console's round screen: standby, NO POWER, the galactic map, and, while a
// recording plays (the parents themselves are the hologram over the dash,
// src/ship/hologram.js), the reel turning, its date stamp and the voice as a
// trace; scanlines, and static that can swallow the picture.

export class CallScreen {
  constructor(size = 384) {
    this.size = size;
    this.state = { who: 'off', talk: 0, statik: 0, t: 0, speaker: 'father', crack: 0, power: 1, label: '', waiting: false };
    if (!hasCanvas()) { this.texture = null; return; }
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.noise = document.createElement('canvas');
    this.noise.width = this.noise.height = 96;
    this.draw();
  }

  /** who: 'off' | 'idle' (a dim standby glyph) | 'locked' (NO POWER) | 'map' | 'tape' (a recording; also 'father' | 'mother' | 'both'); label: the recording's date stamp; waiting: a new message (idle says so) */
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
    else this.drawTape(g, S, s);
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
    if (s.who !== 'map' && s.waiting) {
      // a message waits: the whole face glows warm in time with the button, and says so
      const k = s.pulse ?? pulse;
      g.textAlign = 'center';
      g.globalAlpha = 0.25 + 0.6 * k;
      g.fillStyle = '#ff7a4a'; g.beginPath(); g.arc(c, c, S * 0.5, 0, 7); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = k > 0.5 ? '#fff1c4' : '#ffb08a';
      g.font = `bold ${S * 0.3}px ui-monospace, Menlo, monospace`;
      g.fillText('1', c, S * 0.56);
      g.font = `bold ${S * 0.075}px ui-monospace, Menlo, monospace`;
      g.fillText('NEW MESSAGE', c, S * 0.74);
      return;
    }
    // a slowly turning star chart: rings and the route
    for (const r of [0.14, 0.24, 0.34]) { g.beginPath(); g.ellipse(c, c, S * r * 1.15, S * r * 0.7, 0.3 + t * 0.05, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#f2c54b';
    for (let i = 0; i < 6; i++) { const a = i * 1.1 + t * 0.2, r = S * (0.12 + i * 0.04); g.beginPath(); g.arc(c + Math.cos(a) * r * 1.1, c + Math.sin(a) * r * 0.65, 5, 0, 7); g.fill(); }
    g.font = `${S * 0.05}px ui-monospace, Menlo, monospace`;
    g.textAlign = 'center'; g.fillStyle = '#9fe0d6';
    g.fillText(s.who === 'map' ? 'GALACTIC MAP' : 'VOICEMAIL', c, S * 0.86);
  }

  /** A recording playing: the reel turning, its label (the date stamp), the voice as a trace. */
  drawTape(g, S, s) {
    const t = s.t, c = S / 2;
    g.fillStyle = '#16303a'; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#5fd0c6'; g.fillStyle = '#5fd0c6'; g.lineWidth = 3;
    // two spools, turning; the tape between them
    const spin = s.talk > 0 ? t * 2.2 : t * 0.6;
    for (const [x, r] of [[S * 0.33, S * 0.12], [S * 0.67, S * 0.09]]) {
      g.beginPath(); g.arc(x, S * 0.36, r, 0, 7); g.stroke();
      g.beginPath(); g.arc(x, S * 0.36, r * 0.25, 0, 7); g.stroke();
      for (let k = 0; k < 3; k++) { const a = spin + (k * Math.PI * 2) / 3; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.3, S * 0.36 + Math.sin(a) * r * 0.3); g.lineTo(x + Math.cos(a) * r * 0.9, S * 0.36 + Math.sin(a) * r * 0.9); g.stroke(); }
    }
    g.beginPath(); g.moveTo(S * 0.33, S * 0.48); g.lineTo(S * 0.67, S * 0.45); g.stroke();
    // the voice: a trace that moves while someone on the reel is talking
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const x = S * 0.18 + (i / 48) * S * 0.64;
      const a = s.talk > 0 ? (Math.sin(i * 0.9 + t * 21) * 0.6 + Math.sin(i * 0.37 - t * 9) * 0.4) * S * 0.045 : Math.sin(i * 0.5 + t) * S * 0.004;
      if (i) g.lineTo(x, S * 0.6 + a); else g.moveTo(x, S * 0.6 + a);
    }
    g.stroke();
    g.textAlign = 'center';
    g.font = `bold ${S * 0.055}px ui-monospace, Menlo, monospace`;
    g.globalAlpha = 0.7 + 0.3 * Math.sin(t * 3);
    g.fillText('● PLAYBACK', c, S * 0.2);
    g.globalAlpha = 1;
    if (s.label) {
      g.font = `${S * 0.05}px ui-monospace, Menlo, monospace`;
      g.fillStyle = '#9fe0d6';
      g.fillText(s.label, c, S * 0.76);
    }
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
